import { createHash } from 'node:crypto';
import { query } from './db.js';

export const BOUNDARY_CANONICALIZER_VERSION = 1;
export const BOUNDARY_POLICY_VERSION = 1;
const KINDS = ['vocabulary', 'grammar', 'kanji'];
const emptyKinds = () => Object.fromEntries(KINDS.map(kind => [kind, []]));
const id = value => value == null ? null : String(value);
const normalized = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ja');
const sortText = (a, b) => String(a).localeCompare(String(b), 'en');
const stable = value => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(sortText).map(key => [key, stable(value[key])]))
    : value;
const fingerprint = value => `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
const uniqueSorted = values => [...new Set(values)].sort(sortText);
const issue = (code, severity, details = {}) => ({ code, severity, ...details });

export class BoundaryContextError extends Error {
  constructor(code, details = {}) { super(code); this.name = 'BoundaryContextError'; this.code = code; this.details = details; }
}

export class BoundaryUnavailableError extends Error {
  constructor(cause) { super('boundary_unavailable', { cause }); this.name = 'BoundaryUnavailableError'; this.code = 'boundary_unavailable'; }
}

function parseAuxiliary(rows, issues) {
  const raw = rows[0]?.value;
  if (raw == null) return { version: 0, terms: [] };
  try {
    const policy = JSON.parse(raw);
    if (!policy || !Number.isInteger(policy.version) || policy.version < 1 || !Array.isArray(policy.terms)) throw new Error('shape');
    const terms = policy.terms.map((term, index) => {
      const validStrings = values => Array.isArray(values) && values.length > 0 &&
        values.every(value => typeof value === 'string' && value.trim());
      if (!term || typeof term.surface !== 'string' || !normalized(term.surface) ||
          (term.reading != null && (typeof term.reading !== 'string' || !term.reading.trim())) ||
          !validStrings(term.courseIds) || !validStrings(term.contentTypes) ||
          typeof term.reason !== 'string' || !term.reason.trim()) throw new Error(`term ${index}`);
      return {
        surface: term.surface.normalize('NFC').trim(), reading: term.reading?.normalize('NFC').trim() || null,
        courseIds: uniqueSorted(term.courseIds.map(id)), contentTypes: uniqueSorted(term.contentTypes.map(value => value.trim())),
        reason: term.reason.trim(),
      };
    });
    return { version: policy.version, terms: terms.sort((a, b) => sortText(JSON.stringify(stable(a)), JSON.stringify(stable(b)))) };
  } catch {
    issues.push(issue('auxiliary_policy_invalid', 'error'));
    return { version: 0, terms: [] };
  }
}

export async function loadAuxiliaryPolicy({ dbQuery = query, integrityIssues = [] } = {}) {
  let rows;
  try {
    ({ rows } = await dbQuery("/* boundary:auxiliary */ SELECT value FROM app_settings WHERE key='curriculum_boundary_auxiliary_terms'"));
  } catch (error) { throw new BoundaryUnavailableError(error); }
  return parseAuxiliary(rows, integrityIssues);
}

function graphPaths(courseId, courses, edges, issues) {
  const adjacent = new Map();
  for (const edge of edges) {
    const from = id(edge.course_id), to = id(edge.prerequisite_course_id);
    if (!adjacent.has(from)) adjacent.set(from, []);
    adjacent.get(from).push(to);
  }
  for (const values of adjacent.values()) values.sort(sortText);
  const paths = new Map();
  function visit(node, path) {
    for (const next of adjacent.get(node) || []) {
      if (!courses.has(next)) { issues.push(issue('prerequisite_course_missing', 'error', { courseId: node, prerequisiteCourseId: next })); continue; }
      if (path.includes(next)) { issues.push(issue('prerequisite_cycle', 'error', { path: [...path, next] })); continue; }
      const nextPath = [...path, next];
      if (!paths.has(next)) paths.set(next, []);
      const key = nextPath.join('>');
      if (!paths.get(next).some(existing => existing.join('>') === key)) paths.get(next).push(nextPath);
      visit(next, nextPath);
    }
  }
  visit(courseId, [courseId]);
  return paths;
}

function entryKey(kind, row) {
  if (kind === 'kanji') return normalized(row.character);
  if (kind === 'grammar') return id(row.id);
  // The legacy bank has no separate sense ID. Indonesian gloss is the
  // available sense discriminator; do not merge homophones with different glosses.
  return [normalized(row.japanese), normalized(row.reading), normalized(row.indonesian)].join('\u001f');
}

function introduction(source, currentCourseId, graph) {
  const paths = graph.get(source.courseId) || [];
  return {
    courseId: source.courseId, moduleId: source.moduleId,
    moduleOrder: source.moduleOrder, moduleTitle: source.moduleTitle,
    via: source.courseId === currentCourseId ? 'current_course' : 'prerequisite',
    prerequisitePaths: paths,
  };
}

function sourceRank(source, courseId, graph) {
  // All prerequisite modules precede modules of the current course. Within a
  // prerequisite graph, deeper ancestors are introduced before descendants.
  const depth = Math.max(0, ...(graph.get(source.courseId) || []).map(path => path.length));
  return [source.courseId === courseId ? 1 : 0, -depth, source.moduleOrder ?? Infinity,
    source.courseId, source.moduleId, source.id];
}
function compareRanks(a, b) {
  for (let i = 0; i < a.length; i++) {
    const cmp = typeof a[i] === 'number' ? a[i] - b[i] : sortText(a[i], b[i]);
    if (cmp) return cmp;
  }
  return 0;
}

function grouped(kind, rows, courseId, graph) {
  const byKey = new Map();
  for (const row of rows) {
    const key = entryKey(kind, row);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  return [...byKey].sort(([a], [b]) => sortText(a, b)).map(([key, sources]) => {
    sources.sort((a, b) => compareRanks(sourceRank(a, courseId, graph), sourceRank(b, courseId, graph)));
    const first = sources[0];
    return {
      key, ...(kind === 'vocabulary' ? { japanese: first.japanese, reading: first.reading, sense: first.indonesian }
        : kind === 'kanji' ? { character: first.character } : { pattern: first.pattern }),
      sourceIds: uniqueSorted(sources.map(source => source.id)),
      sources: sources.map(source => ({ ...source, prerequisitePaths: graph.get(source.courseId) || [] })),
      earliestIntroduction: introduction(first, courseId, graph),
    };
  });
}

function deriveSets(rowsByKind, courseId, current, graph) {
  const sets = { target: emptyKinds(), previous: emptyKinds(), prerequisite: emptyKinds(), allowed: emptyKinds(), future: emptyKinds() };
  for (const kind of KINDS) {
    const rows = rowsByKind[kind];
    const buckets = { target: [], previous: [], prerequisite: [], future: [] };
    for (const row of rows) {
      if (row.courseId === courseId) {
        if (row.moduleId === current.id) buckets.target.push(row);
        else if (row.moduleOrder < current.sortOrder) buckets.previous.push(row);
        else if (row.moduleOrder > current.sortOrder) buckets.future.push(row);
      } else if (graph.has(row.courseId)) buckets.prerequisite.push(row);
    }
    for (const bucket of Object.keys(buckets)) sets[bucket][kind] = grouped(kind, buckets[bucket], courseId, graph);
    sets.allowed[kind] = grouped(kind, [...buckets.target, ...buckets.previous, ...buckets.prerequisite], courseId, graph);
    const allowedKeys = new Set(sets.allowed[kind].map(item => item.key));
    sets.future[kind] = sets.future[kind].filter(item => !allowedKeys.has(item.key));
  }
  return sets;
}

function addOwnershipIssues(vocabulary, grammar, lessons, decks, issues) {
  const lessonById = new Map(lessons.map(row => [id(row.id), row]));
  for (const [kind, rows] of [['vocabulary', vocabulary], ['grammar', grammar]]) {
    for (const row of rows) {
      if (row.lesson_id && id(lessonById.get(id(row.lesson_id))?.module_id) !== id(row.module_id)) {
        issues.push(issue(`${kind}_lesson_owner_mismatch`, 'error', { itemId: id(row.id), lessonId: id(row.lesson_id) }));
      }
    }
  }
  const decksByVocab = new Map();
  for (const deck of decks) {
    const vocabularyId = id(deck.vocabulary_id);
    if (!decksByVocab.has(vocabularyId)) decksByVocab.set(vocabularyId, []);
    decksByVocab.get(vocabularyId).push(deck);
  }
  for (const row of vocabulary) {
    const links = decksByVocab.get(id(row.id)) || [];
    if (!row.lesson_id) issues.push(issue('vocabulary_legacy_no_lesson', 'warning', { itemId: id(row.id), deckLinked: links.length > 0 }));
    if (!links.length) issues.push(issue('vocabulary_without_deck', 'warning', { itemId: id(row.id), lessonLinked: Boolean(row.lesson_id) }));
    if (!row.lesson_id && !links.length) issues.push(issue('vocabulary_unplaced', 'warning', { itemId: id(row.id) }));
    for (const link of links) {
      if (id(link.deck_module_id) !== id(row.module_id)) {
        issues.push(issue('vocabulary_deck_owner_mismatch', 'error', { itemId: id(row.id), lessonId: id(link.lesson_id) }));
      }
    }
  }
}

function orderIssues(modules, issues) {
  const byCourse = new Map();
  for (const module of modules) {
    if (!byCourse.has(id(module.course_id))) byCourse.set(id(module.course_id), new Map());
    const order = module.sort_order;
    if (order == null || !Number.isInteger(Number(order))) {
      issues.push(issue('module_order_missing', 'error', { moduleId: id(module.id), courseId: id(module.course_id) }));
      continue;
    }
    const courseOrders = byCourse.get(id(module.course_id));
    if (courseOrders.has(Number(order))) {
      issues.push(issue('module_order_duplicate', 'error', {
        courseId: id(module.course_id), moduleIds: [courseOrders.get(Number(order)), id(module.id)], sortOrder: Number(order),
      }));
    } else courseOrders.set(Number(order), id(module.id));
  }
}

function normalizeSources(rows, kind, moduleById, lessons, issues) {
  const lessonById = new Map(lessons.map(row => [id(row.id), row]));
  const sources = [];
  for (const row of rows) {
    const moduleId = kind === 'kanji' ? id(lessonById.get(id(row.lesson_id))?.module_id) : id(row.module_id);
    const module = moduleById.get(moduleId);
    if (!module) {
      issues.push(issue(kind === 'kanji' ? 'kanji_orphan' : `${kind}_owner_unresolved`, 'warning', {
        itemId: id(row.id), lessonId: id(row.lesson_id), babKode: row.bab_kode ?? null, jlptLevel: row.jlpt_level ?? null,
      }));
      continue;
    }
    if (kind === 'kanji' && [...String(row.character ?? '')].length !== 1) {
      issues.push(issue('kanji_invalid_character', 'error', { itemId: id(row.id) }));
      continue;
    }
    if (kind === 'vocabulary' && !normalized(row.japanese) ||
        kind === 'grammar' && !normalized(row.pattern)) {
      issues.push(issue(`${kind}_content_missing`, 'error', { itemId: id(row.id) }));
      continue;
    }
    sources.push({
      id: id(row.id), courseId: id(module.course_id), moduleId, moduleOrder: module.sort_order == null ? null : Number(module.sort_order),
      moduleTitle: module.title, lessonId: id(row.lesson_id),
      ...(kind === 'vocabulary' ? { japanese: row.japanese, reading: row.reading, indonesian: row.indonesian }
        : kind === 'grammar' ? { pattern: row.pattern, meaning: row.meaning } : { character: row.character }),
      contentFingerprint: fingerprint(kind === 'vocabulary'
        ? [row.japanese, row.reading, row.romaji, row.indonesian, row.category, row.note]
        : kind === 'grammar'
          ? [row.pattern, row.meaning, row.example, row.notes, row.example_dialog, row.example_dialog_id, row.communication_goal]
          : [row.character, row.jlpt_level, row.on_reading, row.kun_reading, row.meaning_id, row.mnemonic, row.compounds, row.bab_kode]),
    });
  }
  return sources;
}

/** Read-only, batched resolver. Each call loads fresh DB state; no cross-request cache. */
export async function getCurriculumBoundary(scope, { dbQuery = query } = {}) {
  const { courseId, moduleId, lessonId, grammarId } = scope || {};
  if (!moduleId && !lessonId && !grammarId) throw new BoundaryContextError('boundary_leaf_context_required');
  const read = async (sql, params = []) => {
    try { return (await dbQuery(sql, params)).rows; }
    catch (error) { throw new BoundaryUnavailableError(error); }
  };
  const issues = [];
  const [courseRows, edgeRows, scopeLessons, scopeGrammar, auxiliaryPolicy] = await Promise.all([
    read('/* boundary:courses */ SELECT id,slug,level,curriculum_boundary_mode FROM courses'),
    read('/* boundary:edges */ SELECT course_id,prerequisite_course_id FROM course_prerequisites'),
    lessonId ? read('/* boundary:scope-lesson */ SELECT id,module_id,slug,type FROM lessons WHERE id=$1', [lessonId]) : [],
    grammarId ? read('/* boundary:scope-grammar */ SELECT id,module_id,lesson_id FROM module_grammar WHERE id=$1', [grammarId]) : [],
    loadAuxiliaryPolicy({ dbQuery, integrityIssues: issues }),
  ]);
  const courses = new Map(courseRows.map(row => [id(row.id), row]));
  const foundLesson = scopeLessons[0], foundGrammar = scopeGrammar[0];
  if (lessonId && !foundLesson) throw new BoundaryContextError('lesson_not_found', { lessonId });
  if (grammarId && !foundGrammar) throw new BoundaryContextError('grammar_not_found', { grammarId });
  const resolvedModuleId = id(moduleId || foundLesson?.module_id || foundGrammar?.module_id);
  if (moduleId && foundLesson && id(moduleId) !== id(foundLesson.module_id) ||
      moduleId && foundGrammar && id(moduleId) !== id(foundGrammar.module_id) ||
      foundLesson && foundGrammar && id(foundLesson.module_id) !== id(foundGrammar.module_id) ||
      foundLesson && foundGrammar && foundGrammar.lesson_id && id(foundLesson.id) !== id(foundGrammar.lesson_id)) {
    throw new BoundaryContextError('boundary_context_mismatch', { moduleId, lessonId, grammarId });
  }
  const modulesForScope = await read('/* boundary:scope-module */ SELECT id,course_id,sort_order,title FROM modules WHERE id=$1', [resolvedModuleId]);
  const current = modulesForScope[0];
  if (!current) throw new BoundaryContextError('module_not_found', { moduleId: resolvedModuleId });
  if (courseId && id(courseId) !== id(current.course_id)) throw new BoundaryContextError('boundary_context_mismatch', { courseId, moduleId: resolvedModuleId });
  if (!courses.has(id(current.course_id))) throw new BoundaryContextError('course_not_found', { courseId: id(current.course_id) });
  const selectedCourse = courses.get(id(current.course_id));
  if (selectedCourse.curriculum_boundary_mode != null &&
      !['off', 'audit', 'warn', 'enforce'].includes(selectedCourse.curriculum_boundary_mode)) {
    issues.push(issue('boundary_mode_invalid', 'error', { courseId: id(current.course_id) }));
  }
  const paths = graphPaths(id(current.course_id), courses, edgeRows, issues);
  const relevantCourseIds = [id(current.course_id), ...paths.keys()];
  const [modules, lessons, vocabulary, grammar, kanji, decks] = await Promise.all([
    read('/* boundary:modules */ SELECT id,course_id,sort_order,title FROM modules WHERE course_id=ANY($1::uuid[])', [relevantCourseIds]),
    read('/* boundary:lessons */ SELECT l.id,l.module_id,l.slug,l.type FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.course_id=ANY($1::uuid[])', [relevantCourseIds]),
    read('/* boundary:vocabulary */ SELECT v.id,v.module_id,v.lesson_id,v.japanese,v.reading,v.romaji,v.indonesian,v.category,v.note FROM module_vocabulary v JOIN modules m ON m.id=v.module_id WHERE m.course_id=ANY($1::uuid[])', [relevantCourseIds]),
    read('/* boundary:grammar */ SELECT g.id,g.module_id,g.lesson_id,g.pattern,g.meaning,g.example,g.notes,g.example_dialog,g.example_dialog_id,g.communication_goal FROM module_grammar g JOIN modules m ON m.id=g.module_id WHERE m.course_id=ANY($1::uuid[])', [relevantCourseIds]),
    read('/* boundary:kanji */ SELECT k.id,k.lesson_id,k.character,k.bab_kode,k.jlpt_level,k.on_reading,k.kun_reading,k.meaning_id,k.mnemonic,k.compounds FROM kanji_items k LEFT JOIN lessons l ON l.id=k.lesson_id LEFT JOIN modules m ON m.id=l.module_id WHERE m.course_id=ANY($1::uuid[]) OR k.lesson_id IS NULL', [relevantCourseIds]),
    read('/* boundary:decks */ SELECT d.vocabulary_id,d.lesson_id,l.module_id AS deck_module_id FROM lesson_deck_items d JOIN module_vocabulary v ON v.id=d.vocabulary_id LEFT JOIN lessons l ON l.id=d.lesson_id JOIN modules m ON m.id=v.module_id WHERE m.course_id=ANY($1::uuid[])', [relevantCourseIds]),
  ]);
  const moduleById = new Map(modules.map(row => [id(row.id), row]));
  const effectiveLesson = foundLesson || (foundGrammar?.lesson_id
    ? lessons.find(row => id(row.id) === id(foundGrammar.lesson_id)) : null);
  orderIssues(modules, issues);
  addOwnershipIssues(vocabulary, grammar, lessons, decks, issues);
  const rowsByKind = {
    vocabulary: normalizeSources(vocabulary, 'vocabulary', moduleById, lessons, issues),
    grammar: normalizeSources(grammar, 'grammar', moduleById, lessons, issues),
    kanji: normalizeSources(kanji, 'kanji', moduleById, lessons, issues),
  };
  const orderedCurrent = moduleById.get(id(current.id));
  const sets = deriveSets(rowsByKind, id(current.course_id),
    { id: id(current.id), sortOrder: orderedCurrent?.sort_order == null ? null : Number(orderedCurrent.sort_order) }, paths);
  const provenance = Object.fromEntries(KINDS.map(kind => [kind,
    Object.fromEntries(grouped(kind, rowsByKind[kind], id(current.course_id), paths).map(entry => [entry.key, entry.sources]))]));
  const graph = edgeRows.filter(edge => relevantCourseIds.includes(id(edge.course_id)))
    .map(edge => [id(edge.course_id), id(edge.prerequisite_course_id)]).sort((a, b) => sortText(a.join('>'), b.join('>')));
  const canonical = {
    canonicalizerVersion: BOUNDARY_CANONICALIZER_VERSION, policyVersion: BOUNDARY_POLICY_VERSION,
    courseId: id(current.course_id), moduleId: id(current.id),
    courses: courseRows.filter(row => relevantCourseIds.includes(id(row.id)))
      .map(row => [id(row.id), row.slug, row.level, row.curriculum_boundary_mode])
      .sort((a, b) => sortText(a[0], b[0])),
    graph, modules: modules.map(row => [id(row.id), id(row.course_id), row.sort_order, row.title]).sort((a, b) => sortText(a[0], b[0])),
    lessons: lessons.map(row => [id(row.id), id(row.module_id), row.slug, row.type]).sort((a, b) => sortText(a[0], b[0])),
    sources: Object.fromEntries(KINDS.map(kind => [kind, rowsByKind[kind].map(row => stable(row)).sort((a, b) => sortText(a.id, b.id))])),
    unresolvedKanji: kanji.filter(row => row.lesson_id == null)
      .map(row => [id(row.id), row.character, row.jlpt_level, row.bab_kode]).sort((a, b) => sortText(a[0], b[0])),
    decks: decks.map(row => [id(row.vocabulary_id), id(row.lesson_id), id(row.deck_module_id)]).sort((a, b) => sortText(a.join('>'), b.join('>'))),
    auxiliaryPolicy,
  };
  const course = courses.get(id(current.course_id));
  const status = issues.some(item => item.severity === 'error') ? 'context_invalid' : 'resolved';
  return {
    schemaVersion: 1, status, errorCode: status === 'context_invalid' ? 'boundary_context_invalid' : null,
    course: { id: id(course.id), slug: course.slug, level: course.level, mode: course.curriculum_boundary_mode ?? 'off' },
    currentModule: { id: id(current.id), sortOrder: current.sort_order == null ? null : Number(current.sort_order), title: current.title },
    lesson: effectiveLesson ? { id: id(effectiveLesson.id), type: effectiveLesson.type, slug: effectiveLesson.slug } : null,
    ...sets, auxiliaryPolicy, provenance,
    prerequisitePaths: Object.fromEntries([...paths].map(([courseId, coursePaths]) => [courseId, coursePaths])),
    unresolved: { kanji: issues.filter(item => item.code === 'kanji_orphan') },
    integrityIssues: issues,
    boundaryFingerprint: fingerprint(canonical), canonicalizerVersion: BOUNDARY_CANONICALIZER_VERSION,
  };
}

/** Construct per HTTP request; callers discard the loader after the request. */
export function createCurriculumBoundaryLoader({ dbQuery = query } = {}) {
  const cache = new Map();
  return scope => {
    const key = JSON.stringify(stable(scope));
    if (!cache.has(key)) cache.set(key, getCurriculumBoundary(scope, { dbQuery }));
    return cache.get(key);
  };
}
