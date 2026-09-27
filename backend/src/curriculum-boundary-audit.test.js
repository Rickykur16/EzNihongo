import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { auditCurriculumBoundary, validateAuditOptions } from './curriculum-boundary-audit.js';
import { parseArgs } from '../scripts/audit-curriculum-boundary.mjs';

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const course = { id: uid(1), slug: 'n5', curriculum_boundary_mode: 'audit' };
const empty = () => ({ vocabulary: [], kanji: [], grammar: [] });
const boundary = {
  status: 'resolved', boundaryFingerprint: 'sha256:boundary', course: { id: course.id, slug: 'n5', mode: 'audit' },
  currentModule: { id: uid(2), sortOrder: 1, title: 'Bab 1' }, lesson: { id: uid(3), slug: 'bab-1' },
  target: empty(), previous: empty(), prerequisite: empty(), future: empty(),
  auxiliaryPolicy: { version: 0, terms: [] }, integrityIssues: [],
};
const item = (n, contentType = 'grammar_example') => ({
  content_type: contentType, content_id: uid(10 + n), course_id: course.id, module_id: uid(2), lesson_id: uid(3),
  grammar_id: null, communication_goal: null,
  fields: [{ path: 'japanese', text: n === 1 ? 'こんにちは' : 'さようなら', language: 'ja' }],
});

function mockAuditDb({ persist = false } = {}) {
  const calls = []; let inserted = false;
  const rows = [item(1), item(2, 'vocabulary_example')];
  const dbQuery = async (sql, params = []) => {
    const tag = sql.match(/boundary-audit:([\w-]+)/)?.[1]; calls.push({ tag, sql, params });
    if (tag === 'course') return { rows: [course], rowCount: 1 };
    if (tag === 'run') return { rows: [], rowCount: 0 };
    if (tag === 'inventory') {
      const cursorType = params[4], cursorId = params[5], contentType = params[3];
      const remaining = rows.filter(row => (!contentType || row.content_type === contentType) &&
        (cursorType == null || row.content_type > cursorType ||
        (row.content_type === cursorType && row.content_id > cursorId)));
      return { rows: remaining.slice(0, params[6]), rowCount: Math.min(remaining.length, params[6]) };
    }
    if (tag === 'report' && persist) {
      if (inserted) return { rows: [], rowCount: 0 };
      inserted = true; return { rows: [{ id: uid(99) }], rowCount: 1 };
    }
    throw new Error(`unexpected query:${tag}`);
  };
  return { dbQuery, calls };
}

test('dry audit is paginated, deterministic, and never writes any table', async () => {
  const db = mockAuditDb(); const output = [];
  const summary = await auditCurriculumBoundary({ course: 'n5', pageSize: 1 }, {
    dbQuery: db.dbQuery, loadBoundary: async () => boundary, onResult: result => output.push(result),
  });
  assert.equal(summary.dryRun, true);
  assert.equal(summary.scanned, 2);
  assert.equal(summary.insertedReports, 0);
  assert.equal(output.length, 2);
  assert.ok(db.calls.filter(call => call.tag === 'inventory').length >= 3);
  assert.ok(!db.calls.some(call => call.tag === 'report' || /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/iu.test(call.sql)));
});

test('report persistence is explicit, resumable through the unique insert, and unavailable is not clean', async () => {
  const db = mockAuditDb({ persist: true }); const runId = uid(500); let loads = 0;
  const options = { course: 'n5', contentType: 'grammar_example', persistReports: true, auditRunId: runId };
  const first = await auditCurriculumBoundary(options, {
    dbQuery: db.dbQuery, loadBoundary: async () => { loads++; throw new Error('database offline'); },
  });
  assert.equal(first.scanned, 1);
  assert.equal(first.unavailable, 1);
  assert.equal(first.valid, 0);
  assert.equal(first.insertedReports, 1);
  const second = await auditCurriculumBoundary(options, {
    dbQuery: db.dbQuery, loadBoundary: async () => { loads++; throw new Error('database offline'); },
  });
  assert.equal(second.skippedReports, 1);
  assert.equal(loads, 2);
  const reportCalls = db.calls.filter(call => call.tag === 'report');
  assert.equal(reportCalls.length, 2);
  assert.ok(reportCalls.every(call => /ON CONFLICT DO NOTHING/iu.test(call.sql)));
});

test('audit arguments require explicit scope and persistence identity', () => {
  assert.deepEqual(parseArgs(['--course', 'n5', '--module-id', uid(2), '--content-type', 'reading', '--page-size', '25']), {
    persistReports: false, pageSize: 25, format: 'jsonl', course: 'n5', moduleId: uid(2), contentType: 'reading',
  });
  assert.equal(parseArgs(['--dry-run', '--course', 'n5', '--format', 'csv']).format, 'csv');
  assert.throws(() => parseArgs(['--dry-run', '--persist-reports', '--course', 'n5']), /conflicting_audit_mode/);
  assert.throws(() => parseArgs(['--fix']), /unknown_argument/);
  assert.throws(() => validateAuditOptions({ course: 'n5', persistReports: true }), /persist_requires_run_id/);
  assert.throws(() => validateAuditOptions({ course: 'n5', contentType: 'unknown' }), /invalid_content_type/);
});

test('quiz linked grammar is evidence, not boundary ownership, for prerequisite and future cases', async () => {
  const grammarId = uid(90);
  const quiz = { ...item(8, 'quiz_question'), grammar_id: grammarId, fields: [{ path: 'question', text: 'こんにちは', language: 'ja' }] };
  const run = async grammarBucket => {
    let sent = false; const scopes = []; const results = [];
    const dbQuery = async sql => {
      const tag = sql.match(/boundary-audit:([\w-]+)/)?.[1];
      if (tag === 'course') return { rows: [course], rowCount: 1 };
      if (tag === 'inventory') { if (sent) return { rows: [], rowCount: 0 }; sent = true; return { rows: [quiz], rowCount: 1 }; }
      throw new Error(`unexpected query:${tag}`);
    };
    const scopedBoundary = structuredClone(boundary);
    scopedBoundary[grammarBucket].grammar.push({ key: grammarId, pattern: '〜です', sourceIds: [grammarId],
      earliestIntroduction: { courseId: grammarBucket === 'prerequisite' ? uid(70) : course.id, moduleId: uid(71), moduleOrder: 7 } });
    await auditCurriculumBoundary({ course: 'n5', contentType: 'quiz_question' }, {
      dbQuery, loadBoundary: async scope => { scopes.push(scope); return scopedBoundary; }, onResult: value => results.push(value),
    });
    assert.equal(scopes[0].grammarId, null);
    return results[0].report;
  };
  const inherited = await run('prerequisite');
  assert.ok(!inherited.violations.some(finding => finding.code === 'future_grammar'));
  assert.ok(inherited.usage.prerequisiteGrammar.some(value => value.key === grammarId));
  const future = await run('future');
  assert.ok(future.violations.some(finding => finding.code === 'future_grammar'));
});

test('dry audit SQL executes on PostgreSQL and leaves source content byte-identical', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const schemaName = 'boundary_audit_test_' + randomUUID().replaceAll('-', '');
  const schema = `"${schemaName}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
  await client.connect();
  t.after(async () => {
    assert.match(schemaName, /^boundary_audit_test_[a-f0-9]{32}$/);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await client.query('ALTER TABLE lessons ADD COLUMN bunpou_flow_published JSONB');
  await client.query('CREATE TABLE grammar_task_sessions(id UUID PRIMARY KEY)');
  await client.query(await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8'));
  const ids = Array.from({ length: 4 }, () => randomUUID());
  await client.query("INSERT INTO courses(id,slug,title,level,curriculum_boundary_mode) VALUES ($1,'n5','N5','N5','audit')", [ids[0]]);
  await client.query("INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES ($1,$2,'bab-1','Bab 1',1)", [ids[1], ids[0]]);
  await client.query("INSERT INTO lessons(id,module_id,slug,title,type,content) VALUES ($1,$2,'reading-1','Reading','text','こんにちは')", [ids[2], ids[1]]);
  await client.query("INSERT INTO module_grammar(id,module_id,lesson_id,pattern,example,example_dialog,communication_goal,recognition_distractors,controlled_distractors) VALUES ($1,$2,$3,'〜です','こんにちは','A: こんにちは','Menyapa','さようなら','こんばんは')", [ids[3], ids[1], ids[2]]);
  const normalizedQuestion = randomUUID();
  await client.query(`INSERT INTO grammar_dialog_questions
    (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,question_fingerprint,dialogue_fingerprint,evidence,state)
    VALUES ($1,$2,$3,'comprehension','挨拶は何ですか？','["こんにちは","さようなら","こんばんは"]',0,'会話の挨拶です',0,'qhash','dhash','{}','active')`,
  [normalizedQuestion, ids[3], ids[2]]);
  await client.query(`UPDATE lessons SET bunpou_flow_published=$2::jsonb WHERE id=$1`, [ids[2], JSON.stringify({
    dialogChecks: { [ids[3]]: {
      comprehension: { prompt: '挨拶は？', options: ['こんにちは', 'さようなら', 'こんばんは'], correctIndex: 0, explanation: '会話から選ぶ' },
      comparison: { prompt: '正しい文は？', options: ['先生です', '先生をです', '先生にです'], correctIndex: 0, explanation: '助詞を確認する' },
    } },
  })]);
  const before = (await client.query('SELECT row_to_json(g)::text AS row FROM module_grammar g WHERE id=$1', [ids[3]])).rows[0].row;
  let pending = Promise.resolve();
  const serialQuery = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  const audited = [];
  const summary = await auditCurriculumBoundary({ course: 'n5', pageSize: 10 }, {
    dbQuery: serialQuery, onResult: result => audited.push(result),
  });
  assert.equal(summary.dryRun, true);
  assert.equal(summary.scanned, 5);
  assert.deepEqual(new Set(audited.map(result => result.contentType)), new Set([
    'grammar_dialog', 'dialogue_question', 'dialogue_comprehension', 'dialogue_transfer', 'reading',
  ]));
  assert.equal(summary.coverage.complete, true);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM curriculum_boundary_reports')).rows[0].n, 0);
  assert.equal((await client.query('SELECT row_to_json(g)::text AS row FROM module_grammar g WHERE id=$1', [ids[3]])).rows[0].row, before);
});
