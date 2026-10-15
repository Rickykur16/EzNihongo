import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { BoundaryUnavailableError } from './curriculum-boundary.js';
import { dialogueFingerprint, dialogueTurns, questionFingerprint } from './dialogue-question-service.js';
import { KOSOADO_GRAMMAR_ID, KOSOADO_SOURCE_LESSON_ID, finalizeN5B4KosoadoQuestions,
  findQuote, kosoadoQuestions } from './n5-b4-kosoado-questions.js';

const manifest = JSON.parse(await readFile(new URL('../content/n5-support/dialogue-support.json', import.meta.url), 'utf8'));
const item = manifest.items.find(entry => entry.grammarId === KOSOADO_GRAMMAR_ID);

test('quotes are found despite edited spacing and stay literal substrings', () => {
  assert.equal(findQuote('はい、これは ほんです。', 'これは ほんです'), 'これは ほんです');
  assert.equal(findQuote('はい、これはほんです。', 'これは ほんです'), 'これはほんです');
  assert.equal(findQuote('はい、これ は　ほんです。', 'これは ほんです'), 'これ は　ほんです');
  assert.equal(findQuote('いいえ、あれは かばんです。', 'これは ほんです'), null);
});

test('the reviewed 186 dialogue yields a valid, name-free set tied to the それ/これ turns', () => {
  assert.equal(item.sourceLessonId, KOSOADO_SOURCE_LESSON_ID);
  const turns = dialogueTurns(item.replacement);
  const [comprehension, transfer] = kosoadoQuestions(turns);
  assert.deepEqual(comprehension.evidence.map(e => e.turnIndex), [0, 1]);
  assert.ok(comprehension.evidence.every(e => turns[e.turnIndex].text.includes(e.quote)));
  assert.equal(comprehension.options[comprehension.correctIndex], 'Dekat orang yang menjawab.');
  assert.equal(transfer.options[transfer.correctIndex], 'それは ペンですか。');
  const visible = JSON.stringify([comprehension, transfer]);
  for (const name of ['Anna', 'Hadi', 'アンナ', 'ハディ', 'milik', 'jauh dari tangan']) assert.ok(!visible.includes(name), name);
  for (const q of [comprehension, transfer]) assert.equal(new Set(q.options).size, q.options.length);
  assert.equal(kosoadoQuestions(dialogueTurns({ example_dialog: 'A: あれは かばんです。\nB: はい。' })), null);
  // Same speaker on both turns is not the asked/answered pair.
  assert.equal(kosoadoQuestions([{ speaker: 'A', text: 'それは ほんですか。' }, { speaker: 'A', text: 'これは ほんです。' }]), null);
});

test('finalizer saves through the question service against the current dialogue',
  { skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database', timeout: 60000 }, async t => {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    assert.match(decodeURIComponent(url.pathname), /test/i);
    const schema = `kosoado_test_${randomUUID().replaceAll('-', '')}`;
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    t.after(async () => {
      await client.query('ROLLBACK').catch(() => {});
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    });
    const foundation = await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8');
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE courses(id UUID PRIMARY KEY, curriculum_boundary_mode TEXT NOT NULL DEFAULT 'off');
      CREATE TABLE course_prerequisites(course_id UUID, prerequisite_course_id UUID);
      CREATE TABLE modules(id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES courses(id));
      CREATE TABLE lessons(id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id));
      CREATE TABLE module_grammar(id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id),
        lesson_id UUID REFERENCES lessons(id), example_dialog TEXT, example_dialog_id TEXT,
        communication_goal TEXT, dialog_scene JSONB);
      CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    await client.query(foundation.slice(foundation.indexOf('CREATE FUNCTION grammar_dialog_options_valid'),
      foundation.indexOf('CREATE TABLE dialogue_question_attempts')));
    await client.query(foundation.slice(foundation.indexOf('CREATE TABLE curriculum_boundary_reports'),
      foundation.indexOf('CREATE INDEX curriculum_boundary_reports_course_time_idx')));
    const courseId = randomUUID();
    await client.query('INSERT INTO courses(id) VALUES ($1)', [courseId]);
    await client.query('INSERT INTO modules VALUES ($1,$2)', [item.moduleId, courseId]);
    await client.query('INSERT INTO lessons VALUES ($1,$2)', [item.sourceLessonId, item.moduleId]);
    const source = item.replacement;
    await client.query(`INSERT INTO module_grammar VALUES ($1,$2,$3,$4,$5,$6,$7)`, [KOSOADO_GRAMMAR_ID,
      item.moduleId, item.sourceLessonId, source.example_dialog, source.example_dialog_id,
      source.communication_goal, JSON.stringify(source.dialog_scene)]);
    const insert = (q, fp, state = 'active') => client.query(`INSERT INTO grammar_dialog_questions
      (grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,
       question_fingerprint,dialogue_fingerprint,evidence,source_kind,state)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,0,$8,$9,$10::jsonb,'manual',$11) RETURNING *`,
    [KOSOADO_GRAMMAR_ID, item.sourceLessonId, q.kind, q.prompt, JSON.stringify(q.options), q.correctIndex,
      q.explanation, questionFingerprint(q), fp, q.evidence ? JSON.stringify(q.evidence) : null, state]);
    const old = [];
    for (const q of item.questions) old.push((await insert(q, item.dialogueFingerprint)).rows[0]);

    // The production symptom: the dialogue was edited in Ruang Kerja, so the
    // old set no longer matches and students see no question.
    await client.query(`UPDATE module_grammar SET example_dialog=replace(example_dialog,'それは ほんですか','それはほんですか'),
      example_dialog_id=example_dialog_id || ' '`);
    const grammar = async () => (await client.query('SELECT * FROM module_grammar')).rows[0];
    assert.notEqual(dialogueFingerprint(await grammar()), item.dialogueFingerprint);

    const options = { transaction: async fn => {
      await client.query('BEGIN');
      try { const out = await fn(client); await client.query('COMMIT'); return out; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
    }, resolveBoundary: async () => { throw new BoundaryUnavailableError(new Error('test')); } };
    const active = async () => (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE state='active' ORDER BY kind`)).rows;

    const first = await finalizeN5B4KosoadoQuestions(options);
    assert.equal(first.status, 'applied', JSON.stringify(first));
    assert.deepEqual(first.previous.map(p => p.current), [false, false]);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM app_settings')).rows[0].n, 1, 'one-shot marker');
    const rows = await active();
    const currentFp = dialogueFingerprint(await grammar());
    assert.deepEqual(rows.map(r => r.kind), ['comprehension', 'transfer']);
    for (const row of rows) {
      const before = old.find(o => o.kind === row.kind);
      assert.equal(row.id, before.id, 'question identity kept');
      assert.notEqual(row.question_version, before.question_version, 'new version');
      assert.equal(row.dialogue_fingerprint, currentFp, 'current for students');
      assert.equal(row.question_fingerprint, questionFingerprint({ kind: row.kind, prompt: row.prompt,
        options: row.options, correctIndex: row.correct_index, explanation: row.explanation, evidence: row.evidence }));
    }
    assert.deepEqual(rows[0].evidence, [{ turnIndex: 0, quote: 'それはほんですか' }, { turnIndex: 1, quote: 'これは ほんです' }]);

    const versions = rows.map(r => r.question_version);
    assert.equal((await finalizeN5B4KosoadoQuestions(options)).status, 'already_applied');
    assert.deepEqual((await active()).map(r => r.question_version), versions);

    // One-shot: a later admin edit to the set is never overwritten by a deploy.
    await client.query(`UPDATE grammar_dialog_questions SET prompt='edit admin', question_version=gen_random_uuid()
      WHERE state='active' AND kind='transfer'`);
    assert.equal((await finalizeN5B4KosoadoQuestions(options)).status, 'already_applied');
    assert.equal((await active())[1].prompt, 'edit admin');
    await client.query('DELETE FROM app_settings');

    // A dialogue without the それ/これ pair is left untouched.
    await client.query(`UPDATE module_grammar SET example_dialog='A: あれは かばんです。\nB: はい。'`);
    const changed = await finalizeN5B4KosoadoQuestions(options);
    assert.equal(changed.status, 'skipped');
    assert.equal(changed.reason, 'dialogue_changed');
    assert.equal((await active())[1].prompt, 'edit admin');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM app_settings')).rows[0].n, 0);

    // Missing questions (all archived) are created again.
    await client.query(`UPDATE module_grammar SET example_dialog=$1`, [source.example_dialog]);
    await client.query(`UPDATE grammar_dialog_questions SET state='archived'`);
    await client.query('DELETE FROM app_settings');
    const recreated = await finalizeN5B4KosoadoQuestions(options);
    assert.equal(recreated.status, 'applied');
    assert.equal((await active()).length, 2);

    // Fresh install without the grammar row.
    await client.query('DELETE FROM curriculum_boundary_reports');
    await client.query('DELETE FROM grammar_dialog_questions');
    await client.query('DELETE FROM module_grammar');
    await client.query('DELETE FROM app_settings');
    assert.deepEqual(await finalizeN5B4KosoadoQuestions(options), { status: 'skipped', reason: 'grammar_not_found' });
  });
