import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { dialogueFingerprint, dialogueTurns, questionFingerprint } from './dialogue-question-service.js';

const migrationUrl = new URL('../migrations/214_n5_b4_kosoado_dialogue_questions.sql', import.meta.url);
const manifestUrl = new URL('../content/n5-support/dialogue-support.json', import.meta.url);
const GRAMMAR_ID = 'b7874295-4a7e-471d-a29e-d316af9f2af9';

async function load() {
  const sql = await readFile(migrationUrl, 'utf8');
  const questions = JSON.parse(sql.match(/\$questions\$([\s\S]*?)\$questions\$/u)[1]);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const item = manifest.items.find(entry => entry.grammarId === GRAMMAR_ID);
  return { sql, questions, item };
}

test('214 question content matches the published Bab 4 これ／それ／あれ dialogue', async () => {
  const { sql, questions, item } = await load();
  const turns = dialogueTurns(item.replacement);
  assert.equal(dialogueFingerprint(item.replacement), item.dialogueFingerprint);
  assert.ok(sql.includes(item.dialogueFingerprint));
  assert.ok(sql.includes(`E'${item.replacement.example_dialog.replace(/\n/gu, '\\n')}'`));
  assert.deepEqual(questions.map(q => q.kind), ['comprehension', 'transfer']);
  for (const { fingerprint, ...question } of questions) {
    assert.equal(fingerprint, questionFingerprint(question), `${question.kind} fingerprint`);
    assert.equal(new Set(question.options).size, question.options.length);
    assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
  }
  const comprehension = questions[0];
  assert.ok(comprehension.evidence.every(e => turns[e.turnIndex].text.includes(e.quote)));
  // The comprehension item must hinge on それ/これ, not on ownership (〜の〜).
  assert.match(comprehension.prompt, /それ/u);
  assert.match(comprehension.prompt, /これ/u);
  assert.doesNotMatch(comprehension.prompt + comprehension.options.join(''), /milik/u);
  assert.doesNotMatch(questions[1].prompt, /jauh/u);
});

test('214 replaces active questions in place with new versions and keeps history',
  { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const { sql, questions, item } = await load();
    const foundation = await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8');
    const ddl = [
      foundation.slice(foundation.indexOf('CREATE FUNCTION grammar_dialog_options_valid'),
        foundation.indexOf('CREATE TABLE dialogue_question_attempts')),
    ].join('\n');
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    const schema = `m214_${Date.now()}`;
    try {
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(`SET search_path TO ${schema}, public`);
      await db.query(`CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid NOT NULL)`);
      await db.query(`CREATE TABLE module_grammar(id uuid PRIMARY KEY, module_id uuid NOT NULL,
        lesson_id uuid REFERENCES lessons, example_dialog text)`);
      await db.query(ddl);
      const moduleId = item.moduleId;
      await db.query('INSERT INTO lessons VALUES ($1,$2)', [item.sourceLessonId, moduleId]);
      await db.query('INSERT INTO module_grammar VALUES ($1,$2,$3,$4)',
        [GRAMMAR_ID, moduleId, item.sourceLessonId, item.replacement.example_dialog]);
      const insert = (q, state, dialogueFp = item.dialogueFingerprint) => db.query(`INSERT INTO grammar_dialog_questions
        (grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,
         question_fingerprint,dialogue_fingerprint,evidence,source_kind,boundary_fingerprint,validator_version,state)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,0,$8,$9,$10::jsonb,'manual','boundary-x','v-x',$11) RETURNING *`,
      [GRAMMAR_ID, item.sourceLessonId, q.kind, q.prompt, JSON.stringify(q.options), q.correctIndex,
        q.explanation, questionFingerprint(q), dialogueFp, q.evidence ? JSON.stringify(q.evidence) : null, state]);
      const before = [];
      for (const q of item.questions) before.push((await insert(q, 'active')).rows[0]);
      const archived = (await insert({ ...item.questions[1], prompt: 'arsip lama' }, 'archived')).rows[0];

      const migrate = async () => { await db.query('BEGIN'); await db.query(sql); await db.query('COMMIT'); };
      await migrate();
      const after = (await db.query(`SELECT * FROM grammar_dialog_questions WHERE state='active' ORDER BY kind`)).rows;
      assert.equal(after.length, 2);
      for (const [index, row] of after.entries()) {
        const { fingerprint, ...expected } = questions[index];
        const old = before.find(b => b.kind === row.kind);
        assert.equal(row.id, old.id, 'question identity is kept');
        assert.notEqual(row.question_version, old.question_version, 'new version for attempts');
        assert.equal(row.prompt, expected.prompt);
        assert.deepEqual(row.options, expected.options);
        assert.equal(row.correct_index, expected.correctIndex);
        assert.deepEqual(row.evidence, expected.evidence);
        assert.equal(row.question_fingerprint, questionFingerprint({ kind: row.kind, prompt: row.prompt,
          options: row.options, correctIndex: row.correct_index, explanation: row.explanation, evidence: row.evidence }));
        assert.equal(row.dialogue_fingerprint, old.dialogue_fingerprint);
        assert.equal(row.boundary_fingerprint, 'boundary-x');
      }
      const backup = (await db.query('SELECT before_row FROM n5_b4_kosoado_questions_backup_214 ORDER BY before_row->>\'kind\'')).rows;
      assert.deepEqual(backup.map(b => b.before_row.prompt), before.map(b => b.prompt).sort((a, b) =>
        before.find(x => x.prompt === a).kind.localeCompare(before.find(x => x.prompt === b).kind)));
      assert.equal((await db.query('SELECT prompt FROM grammar_dialog_questions WHERE id=$1', [archived.id])).rows[0].prompt, 'arsip lama');

      // Idempotent: a re-run keeps the same versions.
      const versions = after.map(r => r.question_version);
      await migrate();
      assert.deepEqual((await db.query(`SELECT question_version FROM grammar_dialog_questions
        WHERE state='active' ORDER BY kind`)).rows.map(r => r.question_version), versions);

      // An edited dialogue is never paired with these questions.
      await db.query(`UPDATE grammar_dialog_questions SET prompt='x', question_version=gen_random_uuid() WHERE state='active'`);
      await db.query(`UPDATE module_grammar SET example_dialog='A: ちがう。'`);
      await migrate();
      assert.deepEqual((await db.query(`SELECT DISTINCT prompt FROM grammar_dialog_questions WHERE state='active'`)).rows,
        [{ prompt: 'x' }]);

      // Stale question rows (other dialogue fingerprint) are skipped as well.
      await db.query(`UPDATE module_grammar SET example_dialog=$1`, [item.replacement.example_dialog]);
      await db.query(`UPDATE grammar_dialog_questions SET dialogue_fingerprint='sha256:other', question_version=gen_random_uuid() WHERE state='active'`);
      await migrate();
      assert.deepEqual((await db.query(`SELECT DISTINCT prompt FROM grammar_dialog_questions WHERE state='active'`)).rows,
        [{ prompt: 'x' }]);

      // Fresh install: no grammar row, no error.
      await db.query('DELETE FROM grammar_dialog_questions');
      await db.query('DELETE FROM module_grammar');
      await migrate();
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await db.end();
    }
  });
