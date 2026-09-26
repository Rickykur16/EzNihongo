import { query } from './db.js';
import { getCurriculumBoundary } from './curriculum-boundary.js';
import { validateContentAgainstBoundary } from './curriculum-boundary-validator.js';

const id = value => value == null ? null : String(value);
const normalize = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ja');
const emptySet = () => ({ vocabulary: [], kanji: [], grammar: [] });

function bucketFor(row, targetSort) {
  const order = Number(row.module_sort);
  return order < targetSort ? 'previous' : order > targetSort ? 'future' : 'target';
}

function syntheticBoundary({ scope, kanjiRows, vocabularyRows, linkedGrammar }) {
  const target = emptySet(), previous = emptySet(), prerequisite = emptySet(), future = emptySet();
  const targetSort = Number(scope.module_sort);
  for (const [index, row] of (vocabularyRows || []).entries()) {
    const bucket = bucketFor(row, targetSort);
    const key = [normalize(row.japanese), normalize(row.reading), normalize(row.indonesian)].join('\u001f');
    const sourceId = id(row.id) || `legacy-vocabulary-${index}`;
    ({ target, previous, future })[bucket].vocabulary.push({
      key, japanese: row.japanese, reading: row.reading, sense: row.indonesian,
      sourceIds: [sourceId], earliestIntroduction: {
        courseId: id(scope.course_id), moduleId: id(row.module_id),
        moduleOrder: Number(row.module_sort), moduleTitle: row.module_title,
      },
    });
  }
  for (const [index, row] of (kanjiRows || []).entries()) {
    const bucket = bucketFor(row, targetSort);
    ({ target, previous, future })[bucket].kanji.push({
      key: row.character, character: row.character, sourceIds: [id(row.id) || `legacy-kanji-${index}`],
      earliestIntroduction: {
        courseId: id(scope.course_id), moduleId: id(row.module_id),
        moduleOrder: Number(row.module_sort), moduleTitle: row.module_title,
      },
    });
  }
  if (linkedGrammar) {
    const external = id(linkedGrammar.course_id) !== id(scope.course_id);
    const bucket = external ? 'future' : bucketFor(linkedGrammar, targetSort);
    ({ target, previous, future })[bucket].grammar.push({
      key: id(linkedGrammar.id), pattern: linkedGrammar.pattern, sourceIds: [id(linkedGrammar.id)],
      earliestIntroduction: {
        courseId: id(linkedGrammar.course_id), moduleId: id(linkedGrammar.module_id),
        moduleOrder: Number(linkedGrammar.module_sort), moduleTitle: linkedGrammar.module_title,
      },
    });
  }
  return {
    status: 'resolved', boundaryFingerprint: 'legacy-warning-adapter',
    course: { id: id(scope.course_id), slug: scope.course_slug },
    currentModule: { id: id(scope.module_id), sortOrder: targetSort, title: scope.module_title },
    lesson: scope.lesson_id || scope.lesson_slug ? { id: id(scope.lesson_id), slug: scope.lesson_slug } : null,
    target, previous, prerequisite, future,
    auxiliaryPolicy: { version: 0, terms: [] }, integrityIssues: [],
  };
}

function readableIntroduction(item) {
  const intro = item.introducedIn || {};
  return `Bab ${Number(intro.moduleOrder) || '?'}${intro.moduleTitle ? ` (${intro.moduleTitle})` : ''}`;
}

function legacyWarningsFromReport(report) {
  if (!report || !['evaluated', 'not_run'].includes(report.status)) return [{
    code: 'scope_check_unavailable',
    message: 'Pemeriksaan alur belajar sedang tidak tersedia. Periksa kembali konteks dan pemetaan materi.',
  }];
  const findings = [...(report.violations || []), ...(report.warnings || [])];
  const out = [];
  const add = (code, message) => {
    if (!out.some(item => item.code === code && item.message === message)) out.push({ code, message });
  };
  const futureKanji = findings.filter(item => item.code === 'future_kanji');
  if (futureKanji.length) add('future_kanji', `Kanji belum diajarkan: ${futureKanji.slice(0, 8)
    .map(item => `${item.value} (${readableIntroduction(item)})`).join(', ')}${futureKanji.length > 8 ? ', ...' : ''}.`);
  const unknownKanji = findings.filter(item => item.code === 'unregistered_kanji');
  if (unknownKanji.length) add('unregistered_kanji', `Kanji belum terdaftar di kurikulum kursus ini: ${[...new Set(unknownKanji.map(item => item.value))]
    .slice(0, 12).join('・')}${unknownKanji.length > 12 ? '...' : ''}.`);
  const futureVocabulary = findings.filter(item => ['future_vocabulary', 'future_vocabulary_uncertain',
    'future_vocabulary_reading_ambiguous', 'ambiguous_vocabulary_sense'].includes(item.code));
  if (futureVocabulary.length) add('future_vocabulary', `Kosakata dari bab berikutnya terdeteksi: ${futureVocabulary.slice(0, 8)
    .map(item => `${item.japanese || item.value || '?'}${item.reading ? ` (${item.reading})` : ''} - ${readableIntroduction(item)}`)
    .join(', ')}${futureVocabulary.length > 8 ? ', ...' : ''}.`);
  const futureGrammar = findings.find(item => item.code === 'future_grammar');
  if (futureGrammar) add('future_grammar', `Pola grammar yang ditautkan baru diajarkan di ${readableIntroduction(futureGrammar)}.`);
  for (const finding of findings) {
    if (['future_kanji', 'unregistered_kanji', 'future_vocabulary', 'future_vocabulary_uncertain',
      'future_vocabulary_reading_ambiguous', 'ambiguous_vocabulary_sense', 'future_grammar'].includes(finding.code)) continue;
    if (finding.code === 'target_grammar_unverified') add(finding.code, 'Pemakaian pola grammar target belum dapat diverifikasi otomatis.');
  }
  return out;
}

function asFields(fields) {
  return (fields || []).map((field, index) => typeof field === 'object' && field !== null
    ? { path: field.path || field.label || `field[${index}]`, text: String(field.text ?? ''), language: field.language || 'ja' }
    : { path: `field[${index}]`, text: String(field ?? ''), language: 'ja' });
}

// Compatibility entry point retained for existing tests and callers that
// already loaded course rows. Rules are delegated to the shared validator.
export function buildLearningScopeWarnings({ scope, fields, kanjiRows = [], vocabularyRows = [], linkedGrammar = null }) {
  if (!scope) return [];
  const boundary = syntheticBoundary({ scope, kanjiRows, vocabularyRows, linkedGrammar });
  const contentType = boundary.course.slug === 'n5' &&
    ['assignment-bab-1-hiragana', 'assignment-bab-2-katakana'].includes(boundary.lesson?.slug)
    ? 'quiz_question' : 'grammar_example';
  const report = validateContentAgainstBoundary({
    boundary, contentType, operation: 'audit', fields: asFields(fields),
    verifiedGrammarIds: linkedGrammar ? [id(linkedGrammar.id)] : [],
  });
  return legacyWarningsFromReport(report);
}

async function warningsForScope(scope, fields, grammarId, contentType, dbQuery) {
  if (!scope) return [];
  const boundary = await getCurriculumBoundary({
    courseId: id(scope.course_id), moduleId: id(scope.module_id), lessonId: id(scope.lesson_id),
  }, { dbQuery });
  const report = validateContentAgainstBoundary({
    boundary, contentType, operation: 'audit', fields: asFields(fields),
    verifiedGrammarIds: grammarId ? [id(grammarId)] : [],
  });
  return legacyWarningsFromReport(report);
}

export async function quizLearningScopeWarnings(questionId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT q.question, q.audio_script, q.passage, q.explanation, q.grammar_id, q.lesson_id,
            c.slug AS course_slug, l.slug AS lesson_slug,
            m.id AS module_id, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM quiz_questions q
       JOIN lessons l ON l.id = q.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE q.id = $1`, [questionId]
  );
  const row = result.rows[0];
  if (!row) return [];
  const options = await dbQuery(
    `SELECT option_text FROM quiz_options WHERE question_id = $1 ORDER BY sort_order, id`,
    [questionId]
  );
  return warningsForScope(row, [
    { path: 'question', text: row.question },
    { path: 'passage', text: row.passage },
    { path: 'audioScript', text: row.audio_script },
    { path: 'explanation', text: row.explanation },
    ...options.rows.map((option, index) => ({ path: `options[${index}]`, text: option.option_text })),
  ], row.grammar_id, 'quiz_question', dbQuery);
}

export async function grammarLearningScopeWarnings(grammarId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT g.example, g.example_dialog, g.module_id, g.lesson_id,
            c.slug AS course_slug, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM module_grammar g JOIN modules m ON m.id = g.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE g.id = $1`, [grammarId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [
    { path: 'example', text: row.example }, { path: 'dialogue', text: row.example_dialog },
  ], grammarId, 'grammar_dialog', dbQuery);
}

export async function grammarExampleLearningScopeWarnings(exampleId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT e.japanese, g.module_id, g.lesson_id,
            c.slug AS course_slug, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM grammar_examples e
       JOIN module_grammar g ON g.id = e.grammar_id
       JOIN modules m ON m.id = g.module_id JOIN courses c ON c.id = m.course_id
      WHERE e.id = $1`, [exampleId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [{ path: 'japanese', text: row.japanese }], null, 'grammar_example', dbQuery);
}

export async function vocabularyExampleLearningScopeWarnings(exampleId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT e.japanese, v.module_id, v.lesson_id,
            c.slug AS course_slug, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM vocabulary_examples e
       JOIN module_vocabulary v ON v.id = e.vocabulary_id
       JOIN modules m ON m.id = v.module_id JOIN courses c ON c.id = m.course_id
      WHERE e.id = $1`, [exampleId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [{ path: 'japanese', text: row.japanese }], null, 'vocabulary_example', dbQuery);
}

export async function lessonContentLearningScopeWarnings(lessonId, fields, dbQuery = query) {
  const result = await dbQuery(
    `SELECT l.id AS lesson_id, c.slug AS course_slug, l.slug AS lesson_slug,
            m.id AS module_id, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM lessons l JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1`, [lessonId]
  );
  const scope = result.rows[0];
  if (!scope) return [];
  return warningsForScope(scope, fields, null, 'reading', dbQuery);
}
