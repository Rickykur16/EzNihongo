import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { backfillDialogueQuestions } from './dialogue-question-backfill.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { contentRevisionId } from './bunpou-flow-service.js';

test('PostgreSQL dry-run and two applies are idempotent; failed boundary query rolls back lesson unit', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 90000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const schemaName = `dialogue_backfill_test_${randomUUID().replaceAll('-', '')}`;
  const schema = `"${schemaName}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
  await client.connect();
  t.after(async () => {
    await client.query('ROLLBACK').catch(() => {});
    assert.match(schemaName, /^dialogue_backfill_test_[a-f0-9]{32}$/u);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(`
    CREATE TABLE courses(id UUID PRIMARY KEY);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID NOT NULL REFERENCES courses(id));
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID NOT NULL REFERENCES modules(id),
      type TEXT,popup_after_lesson_id UUID,bunpou_flow_published JSONB,bunpou_flow_draft JSONB);
    CREATE TABLE module_grammar(id UUID PRIMARY KEY,module_id UUID NOT NULL REFERENCES modules(id),
      lesson_id UUID REFERENCES lessons(id),pattern TEXT,meaning TEXT,example TEXT,
      example_dialog TEXT,example_dialog_id TEXT,communication_goal TEXT,dialog_scene JSONB,
      recognition_distractors TEXT,controlled_distractors TEXT,sort_order INT,
      created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE lesson_grammar_task_items(lesson_id UUID REFERENCES lessons(id),
      grammar_id UUID REFERENCES module_grammar(id),sort_order INT,instruction TEXT,required_count INT);
    CREATE TABLE grammar_examples(grammar_id UUID REFERENCES module_grammar(id),japanese TEXT,
      highlight TEXT,indonesian TEXT,sort_order INT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE course_prerequisites(course_id UUID,prerequisite_course_id UUID);
    CREATE TABLE grammar_dialog_questions(id UUID PRIMARY KEY,grammar_id UUID,
      source_lesson_id UUID,kind TEXT,prompt TEXT,options JSONB,correct_index INT,
      explanation TEXT,sort_order INT,question_version UUID,question_fingerprint TEXT,
      dialogue_fingerprint TEXT,evidence JSONB,source_kind TEXT,source_key TEXT UNIQUE,
      source_fingerprint TEXT,boundary_fingerprint TEXT,validator_version TEXT,state TEXT);
  `);
  const courseId = randomUUID(), moduleId = randomUUID(), lessonId = randomUUID(),
    taskId = randomUUID(), grammar1 = randomUUID(), grammar2 = randomUUID();
  await client.query('INSERT INTO courses VALUES ($1)', [courseId]);
  await client.query('INSERT INTO modules VALUES ($1,$2)', [moduleId, courseId]);
  await client.query(`INSERT INTO lessons(id,module_id,type) VALUES ($1,$3,'text'),($2,$3,'grammar_task')`,
    [lessonId, taskId, moduleId]);
  await client.query('UPDATE lessons SET popup_after_lesson_id=$1 WHERE id=$2', [lessonId, taskId]);
  for (const grammarId of [grammar1, grammar2]) {
    await client.query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,example,
      example_dialog,example_dialog_id,communication_goal,sort_order)
      VALUES ($1,$2,$3,'〜です','adalah','ねこです','A: ねこです。','A: Kucing.','Nama hewan',0)`,
    [grammarId, moduleId, lessonId]);
    await client.query(`INSERT INTO lesson_grammar_task_items
      (lesson_id,grammar_id,sort_order,instruction,required_count)
      VALUES ($1,$2,0,'',1)`, [taskId, grammarId]);
  }
  const query = client.query.bind(client);
  const published = { sourceFingerprint: contentRevisionId(
    await loadTaskConcepts(taskId, query), await loadModulePool(taskId, query)), dialogChecks: {} };
  for (const grammarId of [grammar1, grammar2]) published.dialogChecks[grammarId] = {
    comprehension: { prompt: 'Apa hewannya?', options: ['Kucing', 'Anjing', 'Burung'],
      correctIndex: 0, explanation: 'Dialog menyebut kucing.',
      evidence: [{ turnIndex: 0, quote: 'ねこです' }] },
    comparison: { prompt: 'Kalimat mana sesuai?',
      options: ['ねこです。', 'いぬです。', 'とりです。'], correctIndex: 0,
      explanation: 'Gunakan pola untuk menyebut kucing.' },
  };
  await client.query('UPDATE lessons SET bunpou_flow_published=$1::jsonb WHERE id=$2',
    [JSON.stringify(published), lessonId]);
  const transaction = async work => {
    await client.query('BEGIN');
    try { const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  const base = { courseIds: [courseId], moduleIds: [moduleId],
    lessonIds: [lessonId], runId: randomUUID() };
  const boundary = { course: { id: courseId }, currentModule: { id: moduleId },
    integrityIssues: [] };
  const validate = () => ({ status: 'evaluated', valid: true,
    boundaryFingerprint: 'sha256:test', warnings: [], violations: [] });
  const options = { transaction, validate,
    resolveBoundary: async () => boundary };
  const dry = await backfillDialogueQuestions(base, options);
  assert.equal(dry.counts.would_insert, 4);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM grammar_dialog_questions')).rows[0].n, 0);
  let reads = 0;
  await assert.rejects(backfillDialogueQuestions({ ...base, apply: true }, {
    ...options, resolveBoundary: async () => {
      reads++;
      if (reads === 2) await client.query('SELECT * FROM missing_boundary_relation');
      return boundary;
    },
  }), error => error.code === '42P01');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM grammar_dialog_questions')).rows[0].n, 0);
  const first = await backfillDialogueQuestions({ ...base, apply: true }, options);
  assert.equal(first.counts.inserted, 4);
  const second = await backfillDialogueQuestions({ ...base, apply: true }, options);
  assert.equal(second.counts.already_present, 4);
  assert.equal(second.sourceChecksum, first.sourceChecksum);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM grammar_dialog_questions')).rows[0].n, 4);
  const beforeRefresh = (await client.query(`SELECT id,question_version,prompt,options,
    correct_index,explanation,evidence,source_fingerprint,question_fingerprint,
    dialogue_fingerprint FROM grammar_dialog_questions ORDER BY id`)).rows;
  const refreshed = await backfillDialogueQuestions({ ...base, apply: true }, {
    ...options, validationRefreshOnly: true,
    validate: () => ({ status: 'evaluated', valid: true,
      boundaryFingerprint: 'sha256:audit', warnings: [], violations: [] }),
  });
  assert.equal(refreshed.counts.review_refreshed, 4);
  assert.deepEqual((await client.query(`SELECT id,question_version,prompt,options,
    correct_index,explanation,evidence,source_fingerprint,question_fingerprint,
    dialogue_fingerprint FROM grammar_dialog_questions ORDER BY id`)).rows, beforeRefresh);
  assert.deepEqual((await client.query(`SELECT DISTINCT boundary_fingerprint
    FROM grammar_dialog_questions`)).rows, [{ boundary_fingerprint: 'sha256:audit' }]);
});
