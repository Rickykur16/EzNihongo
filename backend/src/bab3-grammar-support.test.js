import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validateCompanionEnvelope } from './bunpou-flow-service.js';

const plan = JSON.parse(await readFile(new URL('../content/bab3/grammar-support.json', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../migrations/180_bab3_grammar_support.sql', import.meta.url), 'utf8');
const expectedPatterns = ['〜は〜です', '〜は〜じゃ／ではありません', '〜ですか', '〜の〜', '〜も〜です', '〜文 + ね／よ'];

test('Bab 3 support has grounded dialogues and complete, unambiguous contextual practice', () => {
  assert.deepEqual(plan.items.map(item => item.pattern), expectedPatterns);
  assert.equal(plan.course, 'n5');
  assert.equal(plan.module, 'n5-b3');
  const ids = plan.items.map(() => randomUUID());
  const directions = {}, dialogChecks = {};
  for (const [index, item] of plan.items.entries()) {
    assert.equal(item.examples.length, 4, item.key);
    for (const example of item.examples) {
      assert.ok(example.japanese.includes(example.highlight));
      assert.ok(example.indonesian.trim());
      assert.doesNotMatch(example.japanese, /[一-龥]|これ|それ|あれ|この|その|あの|てんき|しゅみ|げつようび/u);
    }
    const jp = item.dialogue.japanese.split('\n');
    const id = item.dialogue.indonesian.split('\n');
    assert.ok(jp.length >= 4 && jp.length <= 6, item.key);
    assert.equal(jp.length, id.length, item.key);
    jp.forEach((line, lineIndex) => {
      assert.match(line, /^[AB]: /u);
      assert.equal(line.slice(0, 3), id[lineIndex].slice(0, 3));
      assert.doesNotMatch(line, /[一-龥]/u);
    });
    for (const evidence of item.dialogChecks.comprehension.evidence) {
      assert.ok(jp[evidence.turnIndex]?.slice(3).includes(evidence.quote), `${item.key}: ${evidence.quote}`);
    }
    assert.equal(item.dialogChecks.comparison.evidence, undefined);
    for (const drill of Object.values(item.drills)) {
      assert.equal(drill.options.filter(option => option === drill.answer).length, 1, item.key);
      assert.equal(new Set(drill.options).size, drill.options.length, item.key);
      assert.ok(drill.options.length >= 3 && drill.options.length <= 4, item.key);
      assert.ok(drill.prompt.trim());
    }
    assert.equal((item.drills.controlled.sentence.match(/＿＿＿/gu) || []).length, 1);
    assert.ok(item.taskInstruction.includes('Kartu') || item.taskInstruction.includes('Situasi'));
    directions[ids[index]] = item.direction;
    dialogChecks[ids[index]] = item.dialogChecks;
  }
  assert.deepEqual(validateCompanionEnvelope({ schemaVersion: 1, objective: plan.objective, directions, dialogChecks }, ids), { ok: true, errors: [] });
  const addition = plan.items.find(item => item.key === 'addition');
  assert.ok(addition.examples.every(example => example.indonesian.includes('Konteks:')));
  const stance = plan.items.find(item => item.key === 'stance');
  assert.ok(stance.examples.every(example => example.indonesian.includes('(')));
  assert.match(stance.drills.recognition.example.japanese, /ですね/u);
  assert.equal(stance.drills.controlled.answer, 'よ');
  assert.match(stance.dialogue.japanese, /ですね/u);
  assert.match(stance.dialogue.japanese, /ですよ/u);
});

test('migration embeds the reviewed content and targets support fields only', () => {
  const embedded = migration.match(/\$content\$([\s\S]*?)\$content\$::jsonb/u);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), plan);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS practice_config JSONB/u);
  assert.doesNotMatch(migration, /UPDATE\s+(?:vocabulary|kanji|module_kanji)/iu);
  const assignments = migration.match(/UPDATE module_grammar SET([\s\S]*?)WHERE id = grammar_id_180/u)[1];
  assert.doesNotMatch(assignments, /(?:pattern|meaning|lesson_id|required_count)\s*=/iu);
});

// A real PostgreSQL run validates backup/replay behavior and the SQL joins. This
// is deliberately limited to a caller-provided LOCAL database named *test*.
test('migration preserves core rows, fixes support and is safe to replay after teacher edits', {
  skip: !process.env.TEST_DATABASE_URL && !process.env.PGLITE_MODULE_URL && 'Set TEST_DATABASE_URL or PGLITE_MODULE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  let client;
  if (process.env.TEST_DATABASE_URL) {
    const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(databaseUrl.hostname));
    assert.match(databaseUrl.pathname, /test/iu);
    assert.equal(databaseUrl.searchParams.has('host'), false);
    assert.equal(databaseUrl.searchParams.has('hostaddr'), false);
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: databaseUrl.href, statement_timeout: 10000 });
    await client.connect();
  } else {
    const moduleUrl = new URL(process.env.PGLITE_MODULE_URL);
    assert.equal(moduleUrl.protocol, 'file:');
    const { PGlite } = await import(moduleUrl.href);
    const database = new PGlite();
    client = {
      query: async (sql, params) => params ? database.query(sql, params) : (await database.exec(sql)).at(-1),
      end: () => database.close(),
    };
  }
  const schema = `b3_support_test_${randomUUID().replaceAll('-', '')}`;
  t.after(async () => {
    try { await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await client.end(); }
  });
  await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID,slug TEXT);
    CREATE TABLE course_prerequisites(course_id UUID,prerequisite_course_id UUID);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID,slug TEXT,type TEXT,popup_after_lesson_id UUID,
      bunpou_flow_draft JSONB,bunpou_flow_published JSONB,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE module_grammar(id UUID PRIMARY KEY,module_id UUID,lesson_id UUID,pattern TEXT,meaning TEXT,
      example TEXT,notes TEXT,example_dialog TEXT,example_dialog_id TEXT,communication_goal TEXT,
      dialog_scene JSONB,dialog_furigana JSONB,recognition_distractors TEXT,controlled_distractors TEXT,
      sort_order INT,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE grammar_examples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),grammar_id UUID,japanese TEXT,
      highlight TEXT,indonesian TEXT,sort_order INT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE lesson_grammar_task_items(lesson_id UUID,grammar_id UUID,sort_order INT,instruction TEXT,required_count INT);
    CREATE TABLE grammar_dialog_questions(id UUID PRIMARY KEY,grammar_id UUID,state TEXT,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE dialogue_speakers(character_key TEXT,voice_id TEXT,voice_name TEXT,profile_version INT);`);
  const courseId = randomUUID(), moduleId = randomUUID(), otherModuleId = randomUUID();
  await client.query("INSERT INTO courses VALUES ($1,'n5')", [courseId]);
  await client.query("INSERT INTO modules VALUES ($1,$3,'n5-b3'),($2,$3,'n5-b4')", [moduleId, otherModuleId, courseId]);
  await client.query("INSERT INTO dialogue_speakers VALUES ('anna-wijaya','anna-default','Anna',1),('hadi-pratama','hadi-default','Hadi',1)");
  const sources = [randomUUID(), randomUUID()];
  const tasks = [randomUUID(), randomUUID()];
  for (let index = 0; index < 2; index++) {
    const envelope = { sourceFingerprint: 'old', preparationReview: { old: true }, overlays: { old: true } };
    await client.query(`INSERT INTO lessons(id,module_id,slug,type,bunpou_flow_draft,bunpou_flow_published)
      VALUES ($1,$2,$3,'video',$4,$4)`, [sources[index], moduleId, index === 0 ? 'bunpou-n5-b3' : 'bunpou2-n5-b3', envelope]);
    await client.query(`INSERT INTO lessons(id,module_id,slug,type,popup_after_lesson_id)
      VALUES ($1,$2,$3,'grammar_task',$4)`, [tasks[index], moduleId, index === 0 ? 'tesbunpou1-n5-b3' : 'tesbunpou2-n5-b3', sources[index]]);
  }
  const grammarIds = plan.items.map(() => randomUUID());
  for (const [index, item] of plan.items.entries()) {
    const group = Math.floor(index / 3);
    const scene = { schemaVersion: 1, enabled: true, backgroundKey: 'classroom', participants: [
      { characterKey: 'anna-wijaya', speaker: 'A', position: 'left', displayName: 'OLD', voiceId: 'anna-custom', voiceName: 'Custom Anna', profileVersion: 2, custom: true },
      { characterKey: 'hadi-pratama', speaker: 'B', position: 'right', displayName: '山口', voiceId: 'hadi-custom', voiceName: 'Custom Hadi', profileVersion: 3, custom: true },
    ] };
    await client.query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,notes,dialog_scene,sort_order)
      VALUES ($1,$2,$3,$4,$5,'Old notes',$6,$7)`, [grammarIds[index], moduleId, sources[group], item.pattern, `Keep meaning ${index}`, scene, index % 3]);
    await client.query("INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order) VALUES ($1,'OLD','OLD','Old example',0)", [grammarIds[index]]);
    await client.query('INSERT INTO lesson_grammar_task_items VALUES ($1,$2,$3,$4,1)', [tasks[group], grammarIds[index], index % 3, 'Old instruction']);
    await client.query("INSERT INTO grammar_dialog_questions(id,grammar_id,state) VALUES ($1,$2,'active')", [randomUUID(), grammarIds[index]]);
  }
  const unrelatedId = randomUUID();
  await client.query("INSERT INTO module_grammar(id,module_id,pattern,meaning,notes) VALUES ($1,$2,'〜は〜です','Other meaning','Other notes')", [unrelatedId, otherModuleId]);
  const coreBefore = (await client.query('SELECT id,module_id,lesson_id,pattern,meaning,sort_order FROM module_grammar ORDER BY id')).rows;
  const membershipBefore = (await client.query('SELECT lesson_id,grammar_id,sort_order,required_count FROM lesson_grammar_task_items ORDER BY grammar_id')).rows;
  await client.query(migration);
  assert.deepEqual((await client.query('SELECT id,module_id,lesson_id,pattern,meaning,sort_order FROM module_grammar ORDER BY id')).rows, coreBefore);
  assert.deepEqual((await client.query('SELECT lesson_id,grammar_id,sort_order,required_count FROM lesson_grammar_task_items ORDER BY grammar_id')).rows, membershipBefore);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM grammar_examples')).rows[0].n, 24);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM n5_b3_grammar_support_backup_180')).rows[0].n, 6);
  for (const [index, item] of plan.items.entries()) {
    const row = (await client.query('SELECT * FROM module_grammar WHERE id=$1', [grammarIds[index]])).rows[0];
    assert.deepEqual(row.practice_config, item.drills);
    assert.equal(row.example_dialog, item.dialogue.japanese);
    assert.deepEqual(row.dialog_scene.participants.map(person => person.displayName), ['アンナ', 'ハディ']);
    assert.deepEqual(row.dialog_scene.participants.map(person => person.voiceId), ['anna-custom', 'hadi-custom']);
  }
  const backup = (await client.query('SELECT before_examples,before_dialog_questions FROM n5_b3_grammar_support_backup_180 WHERE grammar_id=$1', [grammarIds[0]])).rows[0];
  assert.equal(backup.before_examples[0].japanese, 'OLD');
  assert.equal(backup.before_dialog_questions[0].state, 'active');
  assert.equal((await client.query("SELECT count(*)::int AS n FROM grammar_dialog_questions WHERE state='active'")).rows[0].n, 0);
  for (const lessonId of sources) {
    const row = (await client.query('SELECT bunpou_flow_published FROM lessons WHERE id=$1', [lessonId])).rows[0];
    assert.equal(Object.keys(row.bunpou_flow_published.dialogChecks).length, 3);
    assert.equal(row.bunpou_flow_published.sourceFingerprint, undefined);
  }
  await client.query("UPDATE module_grammar SET notes='Later teacher edit' WHERE id=$1", [grammarIds[0]]);
  await client.query(migration);
  assert.equal((await client.query('SELECT notes FROM module_grammar WHERE id=$1', [grammarIds[0]])).rows[0].notes, 'Later teacher edit');
  assert.equal((await client.query('SELECT notes FROM module_grammar WHERE id=$1', [unrelatedId])).rows[0].notes, 'Other notes');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM n5_b3_grammar_support_backup_180')).rows[0].n, 6);
});
