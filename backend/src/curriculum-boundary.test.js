import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  createCurriculumBoundaryLoader, getCurriculumBoundary, BoundaryContextError, BoundaryUnavailableError,
} from './curriculum-boundary.js';

const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const I = Object.fromEntries(Object.entries({
  c5: 5, c4: 4, c3: 3, c2: 2, m51: 51, m52: 52, m57: 57, m41: 41, m44: 44, m45: 45,
  m31: 31, m21: 21, l51: 151, l52: 152, l57: 157, l41: 141, l44: 144, l45: 145, l31: 131, l21: 121,
  v51: 251, v52: 252, v57: 257, v41: 241, v44: 244, v45: 245,
  g51: 351, g52: 352, g41: 341, g44: 344, k51: 451, k52: 452, k57: 457, k41: 441,
}).map(([key, n]) => [key, uid(n)]));

function fixture() {
  const courses = [['c5', 'n5'], ['c4', 'n4'], ['c3', 'n3'], ['c2', 'n2']]
    .map(([key, slug]) => ({ id: I[key], slug, level: slug.toUpperCase(), curriculum_boundary_mode: 'off' }));
  const modules = [
    ['m51', 'c5', 1], ['m52', 'c5', 2], ['m57', 'c5', 7],
    ['m41', 'c4', 1], ['m44', 'c4', 4], ['m45', 'c4', 5],
    ['m31', 'c3', 1], ['m21', 'c2', 1],
  ].map(([key, course, order]) => ({ id: I[key], course_id: I[course], sort_order: order, title: key }));
  const lessons = [['l51', 'm51'], ['l52', 'm52'], ['l57', 'm57'], ['l41', 'm41'],
    ['l44', 'm44'], ['l45', 'm45'], ['l31', 'm31'], ['l21', 'm21']]
    .map(([key, module]) => ({ id: I[key], module_id: I[module], slug: key, type: 'text' }));
  const vocabulary = [
    ['v51', 'm51', 'l51', 'せんせい', 'せんせい', 'guru'],
    ['v52', 'm52', 'l52', 'みらい', 'みらい', 'masa depan'],
    ['v57', 'm57', 'l57', 'せんせい', 'せんせい', 'guru'],
    ['v41', 'm41', 'l41', '学校', 'がっこう', 'sekolah'],
    ['v44', 'm44', 'l44', '教室', 'きょうしつ', 'kelas'],
    ['v45', 'm45', 'l45', 'みらい', 'みらい', 'masa depan'],
  ].map(([key, module, lesson, japanese, reading, indonesian]) => ({
    id: I[key], module_id: I[module], lesson_id: I[lesson], japanese, reading, indonesian,
  }));
  const grammar = [
    ['g51', 'm51', 'l51', '〜です'], ['g52', 'm52', 'l52', '〜ます'],
    ['g41', 'm41', 'l41', '〜そうです'], ['g44', 'm44', 'l44', '〜ようです'],
  ].map(([key, module, lesson, pattern]) => ({ id: I[key], module_id: I[module], lesson_id: I[lesson], pattern, meaning: pattern }));
  const kanji = [
    ['k51', 'l51', '日'], ['k52', 'l52', '先'], ['k57', 'l57', '日'], ['k41', 'l41', '学'],
  ].map(([key, lesson, character]) => ({ id: I[key], lesson_id: I[lesson], character, jlpt_level: 'N5', bab_kode: null }));
  const decks = vocabulary.map(row => ({ vocabulary_id: row.id, lesson_id: row.lesson_id }));
  return { courses, modules, lessons, vocabulary, grammar, kanji, decks,
    edges: [{ course_id: I.c4, prerequisite_course_id: I.c5 }], settings: [] };
}

function mockDb(data) {
  const calls = [];
  const dbQuery = async (sql, params = []) => {
    const tag = sql.match(/boundary:([\w-]+)/)?.[1];
    calls.push(tag);
    const ids = new Set(params[0] || []);
    const moduleById = new Map(data.modules.map(row => [row.id, row]));
    const lessonById = new Map(data.lessons.map(row => [row.id, row]));
    const courseForModule = moduleId => moduleById.get(moduleId)?.course_id;
    let rows;
    switch (tag) {
      case 'courses': rows = data.courses; break;
      case 'edges': rows = data.edges; break;
      case 'scope-lesson': rows = data.lessons.filter(row => row.id === params[0]); break;
      case 'scope-grammar': rows = data.grammar.filter(row => row.id === params[0]); break;
      case 'scope-module': rows = data.modules.filter(row => row.id === params[0]); break;
      case 'auxiliary': rows = data.settings; break;
      case 'modules': rows = data.modules.filter(row => ids.has(row.course_id)); break;
      case 'lessons': rows = data.lessons.filter(row => ids.has(courseForModule(row.module_id))); break;
      case 'vocabulary': rows = data.vocabulary.filter(row => ids.has(courseForModule(row.module_id))); break;
      case 'grammar': rows = data.grammar.filter(row => ids.has(courseForModule(row.module_id))); break;
      case 'kanji': rows = data.kanji.filter(row => !row.lesson_id || ids.has(courseForModule(lessonById.get(row.lesson_id)?.module_id))); break;
      case 'decks': rows = data.decks.filter(row => ids.has(courseForModule(data.vocabulary.find(v => v.id === row.vocabulary_id)?.module_id)))
        .map(row => ({ ...row, deck_module_id: lessonById.get(row.lesson_id)?.module_id || null })); break;
      default: throw new Error(`unexpected query: ${tag}`);
    }
    return { rows };
  };
  return { dbQuery, calls };
}

const keys = (boundary, set, kind) => boundary[set][kind].map(item => item.key);

test('B01/B06: target, previous and future use module order; repeated words and kanji stay allowed', async () => {
  const data = fixture(); const db = mockDb(data);
  const first = await getCurriculumBoundary({ lessonId: I.l51 }, db);
  assert.equal(first.status, 'resolved');
  assert.equal(first.course.mode, 'off');
  assert.ok(keys(first, 'target', 'vocabulary').includes(first.target.vocabulary[0].key));
  assert.ok(first.future.vocabulary.some(item => item.sourceIds.includes(I.v52)));
  assert.ok(first.future.kanji.some(item => item.character === '先'));
  assert.ok(!first.future.vocabulary.some(item => item.sourceIds.includes(I.v57)));
  assert.ok(!first.future.kanji.some(item => item.character === '日'));
  assert.ok(first.allowed.vocabulary.find(item => item.sourceIds.includes(I.v51)).sourceIds.includes(I.v51));
  assert.ok(db.calls.length <= 12, 'query count must not depend on number of terms');
  assert.ok(!db.calls.includes('write'));
  assert.equal((await getCurriculumBoundary({ grammarId: I.g51 }, mockDb(data))).lesson.id, I.l51);

  const seventh = await getCurriculumBoundary({ moduleId: I.m57 }, mockDb(data));
  const repeated = seventh.allowed.vocabulary.find(item => item.sourceIds.includes(I.v57));
  assert.deepEqual(repeated.sourceIds, [I.v51, I.v57]);
  assert.equal(repeated.earliestIntroduction.moduleId, I.m51);
  assert.equal(seventh.target.vocabulary.length, 1);
  assert.equal(seventh.lesson, null);
});

test('B02/B03: N4 inherits all mapped N5; transitive diamond keeps both paths', async () => {
  const data = fixture();
  const first = await getCurriculumBoundary({ lessonId: I.l41, grammarId: I.g41 }, mockDb(data));
  assert.equal(first.status, 'resolved');
  assert.ok(first.prerequisite.vocabulary.some(item => item.sourceIds.includes(I.v52)));
  assert.ok(first.allowed.kanji.some(item => item.character === '先'));
  assert.ok(first.future.grammar.some(item => item.sourceIds.includes(I.g44)));
  assert.ok(!first.future.vocabulary.some(item => item.sourceIds.includes(I.v45)));
  assert.deepEqual(first.prerequisitePaths[I.c5], [[I.c4, I.c5]]);
  const fourth = await getCurriculumBoundary({ moduleId: I.m44 }, mockDb(data));
  assert.ok(fourth.allowed.grammar.some(item => item.sourceIds.includes(I.g41)));
  assert.ok(fourth.allowed.grammar.some(item => item.sourceIds.includes(I.g44)));
  assert.equal(data.decks.length, 6, 'resolver never copies N5 items into N4 decks');

  data.edges.push({ course_id: I.c2, prerequisite_course_id: I.c4 },
    { course_id: I.c2, prerequisite_course_id: I.c3 },
    { course_id: I.c3, prerequisite_course_id: I.c5 });
  const diamond = await getCurriculumBoundary({ moduleId: I.m21 }, mockDb(data));
  assert.equal(diamond.status, 'resolved');
  assert.deepEqual(diamond.prerequisitePaths[I.c5], [[I.c2, I.c3, I.c5], [I.c2, I.c4, I.c5]]);
  assert.equal(diamond.allowed.kanji.filter(item => item.character === '日').length, 1);
  assert.equal(diamond.allowed.kanji.find(item => item.character === '日').sourceIds.length, 2);
});

test('B04/B05: graph and ordering errors are explicit; mismatched scope is rejected', async () => {
  const data = fixture();
  data.edges.push({ course_id: I.c5, prerequisite_course_id: I.c4 },
    { course_id: I.c4, prerequisite_course_id: uid(999) });
  data.modules.find(row => row.id === I.m52).sort_order = 1;
  const boundary = await getCurriculumBoundary({ moduleId: I.m51 }, mockDb(data));
  assert.equal(boundary.status, 'context_invalid');
  assert.ok(boundary.integrityIssues.some(item => item.code === 'prerequisite_cycle'));
  assert.ok(boundary.integrityIssues.some(item => item.code === 'prerequisite_course_missing'));
  assert.ok(boundary.integrityIssues.some(item => item.code === 'module_order_duplicate'));
  await assert.rejects(getCurriculumBoundary({ lessonId: I.l51, grammarId: I.g41 }, mockDb(fixture())),
    error => error instanceof BoundaryContextError && error.code === 'boundary_context_mismatch');
  await assert.rejects(getCurriculumBoundary({ courseId: I.c5 }, mockDb(fixture())),
    error => error.code === 'boundary_leaf_context_required');
  const self = fixture();
  self.edges.push({ course_id: I.c5, prerequisite_course_id: I.c5 });
  self.modules.find(row => row.id === I.m57).sort_order = null;
  self.grammar.find(row => row.id === I.g51).lesson_id = I.l52;
  const invalid = await getCurriculumBoundary({ moduleId: I.m51 }, mockDb(self));
  assert.equal(invalid.errorCode, 'boundary_context_invalid');
  assert.ok(invalid.integrityIssues.some(item => item.code === 'prerequisite_cycle'));
  assert.ok(invalid.integrityIssues.some(item => item.code === 'module_order_missing'));
  assert.ok(invalid.integrityIssues.some(item => item.code === 'grammar_lesson_owner_mismatch'));
  self.courses.find(row => row.id === I.c5).curriculum_boundary_mode = 'invalid';
  assert.ok((await getCurriculumBoundary({ moduleId: I.m51 }, mockDb(self))).integrityIssues
    .some(item => item.code === 'boundary_mode_invalid'));
});

test('B07: orphan kanji and legacy/deck placement are diagnosed without changing bank membership', async () => {
  const data = fixture();
  data.kanji.push({ id: uid(499), lesson_id: null, character: '時', bab_kode: 'N5-9', jlpt_level: 'N5' });
  data.vocabulary.find(row => row.id === I.v41).lesson_id = null;
  data.decks.find(row => row.vocabulary_id === I.v44).lesson_id = I.l51;
  const boundary = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.ok(boundary.integrityIssues.some(item => item.code === 'kanji_orphan'));
  assert.ok(boundary.integrityIssues.some(item => item.code === 'vocabulary_legacy_no_lesson' && item.itemId === I.v41 && item.deckLinked));
  assert.ok(!boundary.integrityIssues.some(item => item.code === 'vocabulary_unplaced' && item.itemId === I.v41));
  assert.ok(boundary.integrityIssues.some(item => item.code === 'vocabulary_deck_owner_mismatch'));
  assert.ok(!boundary.allowed.kanji.some(item => item.character === '時'));
  assert.ok(boundary.allowed.vocabulary.some(item => item.sourceIds.includes(I.v41)));
});

test('B15: fingerprints track bank, order, graph and auxiliary edits; cache belongs to one request', async () => {
  const data = fixture(); const db = mockDb(data);
  const load = createCurriculumBoundaryLoader(db);
  const cached = await load({ moduleId: I.m41 });
  assert.equal(await load({ moduleId: I.m41 }), cached);
  assert.ok(db.calls.length <= 12);
  const original = cached.boundaryFingerprint;
  data.vocabulary.find(row => row.id === I.v51).japanese = '先生';
  const changedBank = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedBank.boundaryFingerprint, original);
  data.modules.find(row => row.id === I.m57).sort_order = 8;
  const changedOrder = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedOrder.boundaryFingerprint, changedBank.boundaryFingerprint);
  data.edges.push({ course_id: I.c4, prerequisite_course_id: I.c3 });
  const changedGraph = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedGraph.boundaryFingerprint, changedOrder.boundaryFingerprint);
  data.settings = [{ value: JSON.stringify({ version: 1, terms: [{
    surface: 'ええ', courseIds: [I.c4], contentTypes: ['grammar_dialog'], reason: 'response',
  }] }) }];
  const changedPolicy = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedPolicy.boundaryFingerprint, changedGraph.boundaryFingerprint);
  assert.equal(changedPolicy.auxiliaryPolicy.terms[0].surface, 'ええ');
  data.kanji.find(row => row.id === I.k51).on_reading = 'ニチ';
  const changedReading = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedReading.boundaryFingerprint, changedPolicy.boundaryFingerprint);
  data.lessons.find(row => row.id === I.l51).module_id = I.m52;
  const changedOwnership = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.notEqual(changedOwnership.boundaryFingerprint, changedReading.boundaryFingerprint);
  assert.equal(changedOwnership.status, 'context_invalid');
});

test('vocabulary sense and grammar source ID remain distinct identities', async () => {
  const data = fixture();
  data.vocabulary.push({ ...data.vocabulary.find(row => row.id === I.v51), id: uid(999), indonesian: 'pengajar pribadi' });
  data.grammar.push({ ...data.grammar.find(row => row.id === I.g51), id: uid(998) });
  const boundary = await getCurriculumBoundary({ moduleId: I.m51 }, mockDb(data));
  assert.equal(boundary.allowed.vocabulary.filter(item => item.japanese === 'せんせい').length, 2);
  assert.equal(boundary.allowed.grammar.filter(item => item.pattern === '〜です').length, 2);
});

test('fingerprint is row-order stable, malformed auxiliary scopes fail closed, and query failures stay unavailable', async () => {
  const data = fixture();
  const original = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  for (const key of ['courses', 'modules', 'lessons', 'vocabulary', 'grammar', 'kanji', 'decks', 'edges']) data[key].reverse();
  const reordered = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.equal(reordered.boundaryFingerprint, original.boundaryFingerprint);

  data.settings = [{ value: JSON.stringify({
    version: 1, terms: [{ surface: 'はい', courseIds: [null], contentTypes: [{}], reason: '' }],
  }) }];
  const invalidAuxiliary = await getCurriculumBoundary({ moduleId: I.m41 }, mockDb(data));
  assert.equal(invalidAuxiliary.status, 'context_invalid');
  assert.deepEqual(invalidAuxiliary.auxiliaryPolicy, { version: 0, terms: [] });
  assert.ok(invalidAuxiliary.integrityIssues.some(item => item.code === 'auxiliary_policy_invalid'));

  const db = mockDb(fixture());
  await assert.rejects(getCurriculumBoundary({ moduleId: I.m41 }, {
    dbQuery: async (sql, params) => sql.includes('boundary:modules')
      ? Promise.reject(new Error('database offline')) : db.dbQuery(sql, params),
  }), error => error instanceof BoundaryUnavailableError && error.code === 'boundary_unavailable');
});

test('resolver queries execute against PostgreSQL and preserve N4 prerequisite ownership', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const schema = 'boundary_test_' + randomUUID().replaceAll('-', '');
  const quotedSchema = `"${schema}"`;
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => {
    assert.match(schema, /^boundary_test_[a-f0-9]{32}$/);
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${quotedSchema}; SET search_path TO ${quotedSchema}`);
  await client.query(`
    CREATE TABLE courses(id UUID PRIMARY KEY, slug TEXT UNIQUE NOT NULL, level TEXT, curriculum_boundary_mode TEXT NOT NULL DEFAULT 'off');
    CREATE TABLE modules(id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES courses(id), sort_order INT, title TEXT NOT NULL);
    CREATE TABLE lessons(id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id), slug TEXT NOT NULL, type TEXT NOT NULL);
    CREATE TABLE course_prerequisites(course_id UUID NOT NULL REFERENCES courses(id), prerequisite_course_id UUID NOT NULL REFERENCES courses(id), PRIMARY KEY(course_id, prerequisite_course_id));
    CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE module_vocabulary(id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id), lesson_id UUID REFERENCES lessons(id), japanese TEXT NOT NULL, reading TEXT, romaji TEXT, indonesian TEXT, category TEXT, note TEXT);
    CREATE TABLE module_grammar(id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id), lesson_id UUID REFERENCES lessons(id), pattern TEXT NOT NULL, meaning TEXT, example TEXT, notes TEXT, example_dialog TEXT, example_dialog_id TEXT, communication_goal TEXT);
    CREATE TABLE kanji_items(id UUID PRIMARY KEY, lesson_id UUID REFERENCES lessons(id), character TEXT NOT NULL, bab_kode TEXT, jlpt_level TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, mnemonic TEXT, compounds JSONB NOT NULL DEFAULT '[]');
    CREATE TABLE lesson_deck_items(lesson_id UUID NOT NULL REFERENCES lessons(id), vocabulary_id UUID NOT NULL REFERENCES module_vocabulary(id), PRIMARY KEY(lesson_id, vocabulary_id));
  `);
  const ids = Array.from({ length: 16 }, () => randomUUID());
  const [c5, c4, m51, m57, m41, m44, m45, l51, l57, l41, l44, l45, v51, v44, g51, k51] = ids;
  await client.query("INSERT INTO courses(id,slug,level) VALUES ($1,'n5','N5'),($2,'n4','N4')", [c5, c4]);
  await client.query(`INSERT INTO modules(id,course_id,sort_order,title) VALUES
    ($1,$6,1,'N5 Bab 1'),($2,$6,7,'N5 Bab 7'),($3,$7,1,'N4 Bab 1'),($4,$7,4,'N4 Bab 4'),($5,$7,5,'N4 Bab 5')`,
  [m51, m57, m41, m44, m45, c5, c4]);
  await client.query(`INSERT INTO lessons(id,module_id,slug,type) VALUES
    ($1,$6,'n5-bab-1','text'),($2,$7,'n5-bab-7','text'),($3,$8,'n4-bab-1','text'),($4,$9,'n4-bab-4','text'),($5,$10,'n4-bab-5','text')`,
  [l51, l57, l41, l44, l45, m51, m57, m41, m44, m45]);
  await client.query('INSERT INTO course_prerequisites VALUES ($1,$2)', [c4, c5]);
  await client.query("INSERT INTO app_settings VALUES ('curriculum_boundary_auxiliary_terms',$1)",
    [JSON.stringify({ version: 1, terms: [{ surface: 'ええ', courseIds: [c4], contentTypes: ['grammar_dialog'], reason: 'response' }] })]);
  await client.query("INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese,reading,indonesian) VALUES ($1,$2,$3,'先生','せんせい','guru'),($4,$5,$6,'教室','きょうしつ','kelas')",
    [v51, m51, l51, v44, m44, l44]);
  await client.query("INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning) VALUES ($1,$2,$3,'〜です','kopula')", [g51, m51, l51]);
  await client.query("INSERT INTO kanji_items(id,lesson_id,character,jlpt_level) VALUES ($1,$2,'先','N5')", [k51, l51]);
  await client.query('INSERT INTO lesson_deck_items VALUES ($1,$2),($3,$4)', [l51, v51, l44, v44]);
  let queryCount = 0;
  let pending = Promise.resolve();
  const serialQuery = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  const boundary = await getCurriculumBoundary({ courseId: c4, moduleId: m44, lessonId: l44 }, {
    dbQuery: async (sql, params) => { queryCount++; return serialQuery(sql, params); },
  });
  assert.equal(boundary.status, 'resolved');
  assert.equal(boundary.currentModule.sortOrder, 4);
  assert.ok(boundary.prerequisite.vocabulary.some(item => item.sourceIds.includes(v51)));
  assert.ok(boundary.prerequisite.grammar.some(item => item.sourceIds.includes(g51)));
  assert.ok(boundary.prerequisite.kanji.some(item => item.sourceIds.includes(k51)));
  assert.ok(boundary.target.vocabulary.some(item => item.sourceIds.includes(v44)));
  assert.equal(boundary.auxiliaryPolicy.version, 1);
  assert.ok(queryCount <= 12);
});
