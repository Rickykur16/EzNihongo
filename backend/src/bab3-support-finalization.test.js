import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { finalizeBab3Support } from './bab3-support-finalization.js';
import { learningFlowReadiness } from './learning-flow-config.js';

const plan = JSON.parse(await readFile(new URL('../content/bab3/grammar-support.json', import.meta.url), 'utf8'));
const migration = name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const options = { skip: !process.env.TEST_DATABASE_URL && 'Set a disposable local TEST_DATABASE_URL', timeout: 60000 };

async function fixture(t) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 15000 });
  await client.connect();
  const schema = 'bab3_finalize_test_' + randomUUID().replaceAll('-', '');
  t.after(async () => {
    try { await client.query(`ROLLBACK; DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await client.end(); }
  });
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const name of ['147_bunpou_flow_pilot.sql', '148_dialogue_speakers.sql',
    '153_dialogue_scenes.sql', '154_dialogue_furigana.sql', '165_learning_flow_boundary_foundation.sql']) {
    await client.query(await migration(name));
  }
  const courseId = randomUUID(), moduleId = randomUUID(), futureModule = randomUUID();
  await client.query("INSERT INTO courses(id,slug,title,level,curriculum_boundary_mode) VALUES($1,'n5','N5','N5','enforce')", [courseId]);
  await client.query("INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES($1,$3,'n5-b3','Bab 3',3),($2,$3,'n5-b4','Bab 4',4)", [moduleId, futureModule, courseId]);
  await client.query("UPDATE dialogue_speakers SET voice_id='test-voice' WHERE character_key IN ('anna-wijaya','hadi-pratama')");
  const sources = new Map(), tasks = new Map(), grammarIds = [];
  for (const slug of [...new Set(plan.items.map(item => item.lesson))]) {
    const source = randomUUID(), task = randomUUID();
    sources.set(slug, source); tasks.set(slug, task);
    await client.query("INSERT INTO lessons(id,module_id,slug,title,type) VALUES($1,$2,$3,$3,'text')", [source, moduleId, slug]);
    await client.query("INSERT INTO lessons(id,module_id,slug,title,type,popup_after_lesson_id) VALUES($1,$2,$3,$3,'grammar_task',$4)", [task, moduleId, plan.items.find(i => i.lesson === slug).task, source]);
  }
  for (const [index, item] of plan.items.entries()) {
    const grammarId = randomUUID(); grammarIds.push(grammarId);
    await client.query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,notes,sort_order)
      VALUES($1,$2,$3,$4,$5,'Old notes', $6)`, [grammarId, moduleId, sources.get(item.lesson), item.pattern, 'Makna asli yang dipertahankan', index]);
    await client.query(`INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id,sort_order,instruction,required_count)
      VALUES($1,$2,$3,'Old instruction',1)`, [tasks.get(item.lesson), grammarId, index % 3]);
    await client.query(`INSERT INTO grammar_dialog_questions(grammar_id,source_lesson_id,kind,prompt,options,
      correct_index,explanation,sort_order,question_fingerprint,dialogue_fingerprint,evidence,source_kind,source_key,source_fingerprint,state)
      VALUES($1,$2,'comprehension','Old question','["Satu","Dua","Tiga"]',0,'Old explanation',0,'old-question','old-dialog',
        '[{"turnIndex":0,"quote":"Old"}]','legacy_bunpou',$3,'old-source','active')`, [grammarId, sources.get(item.lesson), 'old-' + grammarId]);
  }
  const userId = randomUUID();
  await client.query("INSERT INTO users(id,google_id,email,full_name) VALUES($1,'finalize-test','finalize@example.invalid','Test')", [userId]);
  await client.query(`INSERT INTO dialogue_question_attempts(user_id,question_id,grammar_id,lesson_id,request_id,
    request_payload_hash,question_version,question_fingerprint,dialogue_fingerprint,question_snapshot,selected_index,is_correct,response_snapshot)
    SELECT $1,id,grammar_id,source_lesson_id,gen_random_uuid(),'old-request',question_version,question_fingerprint,
      dialogue_fingerprint,jsonb_build_object('prompt',prompt),0,true,'{"correct":true}'::jsonb FROM grammar_dialog_questions`, [userId]);
  const transaction = async work => {
    await client.query('BEGIN');
    try { const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  await transaction(async c => { await c.query(await migration('180_bab3_grammar_support.sql')); await c.query(await migration('182_bab3_support_finalization.sql')); });
  return { client, transaction, courseId, moduleId, futureModule, grammarIds };
}

test('180 then finalizer restores real readiness, preserves attempts/settings, and repeats without overwriting admin edits', options, async t => {
  const { client, transaction, moduleId, grammarIds } = await fixture(t);
  const beforeAttempts = (await client.query('SELECT * FROM dialogue_question_attempts ORDER BY id')).rows;
  const archived = (await client.query('SELECT * FROM grammar_dialog_questions ORDER BY id')).rows;
  const settings = (await client.query('SELECT * FROM app_settings ORDER BY key')).rows;
  const modes = (await client.query('SELECT id,curriculum_boundary_mode FROM courses ORDER BY id')).rows;
  assert.equal(archived.length, 6);
  assert.ok(archived.every(q => q.state === 'archived'));
  const report = await finalizeBab3Support({ transaction });
  assert.equal(report.status, 'finalized');
  assert.equal(report.questionCount, 12);
  assert.equal(report.readiness.ready, true);
  assert.equal((await learningFlowReadiness(client, { enabled: true, courseIds: [], moduleIds: [moduleId], lessonIds: [] })).ready, true);
  assert.equal((await client.query("SELECT count(*)::int n FROM grammar_dialog_questions WHERE state='active'")).rows[0].n, 12);
  assert.deepEqual((await client.query("SELECT * FROM grammar_dialog_questions WHERE state='archived' ORDER BY id")).rows, archived);
  assert.deepEqual((await client.query('SELECT * FROM dialogue_question_attempts ORDER BY id')).rows, beforeAttempts);
  assert.deepEqual((await client.query('SELECT * FROM app_settings ORDER BY key')).rows, settings);
  assert.deepEqual((await client.query('SELECT id,curriculum_boundary_mode FROM courses ORDER BY id')).rows, modes);
  await client.query("UPDATE module_grammar SET notes='Admin edit after finalization' WHERE id=$1", [grammarIds[0]]);
  assert.equal((await finalizeBab3Support({ transaction })).status, 'already_finalized');
  assert.equal((await client.query('SELECT notes FROM module_grammar WHERE id=$1', [grammarIds[0]])).rows[0].notes, 'Admin edit after finalization');
});

test('a real boundary failure rolls back all companion and new-question writes', options, async t => {
  const { client, transaction, futureModule } = await fixture(t);
  // A duplicate curriculum order makes the actual resolver report invalid
  // scope. Kana lexical uncertainty alone is correctly only a warning.
  await client.query('UPDATE modules SET sort_order=3 WHERE id=$1', [futureModule]);
  const beforeLessons = (await client.query('SELECT * FROM lessons ORDER BY id')).rows;
  const beforeQuestions = (await client.query('SELECT * FROM grammar_dialog_questions ORDER BY id')).rows;
  await assert.rejects(finalizeBab3Support({ transaction }), error => {
    assert.ok(['question_boundary_rejected', 'curriculum_boundary_violation', 'boundary_context_invalid', 'bab3_support_readiness_failed'].includes(error.message), error.message);
    return true;
  });
  assert.deepEqual((await client.query('SELECT * FROM lessons ORDER BY id')).rows, beforeLessons);
  assert.deepEqual((await client.query('SELECT * FROM grammar_dialog_questions ORDER BY id')).rows, beforeQuestions);
  assert.equal((await client.query('SELECT count(*)::int n FROM n5_b3_support_finalization_182')).rows[0].n, 0);
});

test('finalizer is inert when migration 180 has not been applied', async () => {
  let reads = 0;
  const result = await finalizeBab3Support({ transaction: work => work({ query: async text => {
    reads++;
    assert.match(text, /to_regclass/);
    return { rows: [{ source_backup: null }] };
  } }) });
  assert.equal(result.status, 'not_applicable');
  assert.equal(reads, 1);
});
