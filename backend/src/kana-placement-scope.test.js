import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { normalizeKanaReading } from './kana-placement.js';

const hiraganaReplacements = [
  [45, 'わたしは がっこうへ いきます。'],
  [46, 'これを ください。'],
  [47, 'きょうは いい てんきですね。'],
  [48, 'えきの まえで まって います。'],
  [49, 'にほんごの べんきょうは たのしいです。'],
  [50, 'おおきい びょういんへ いきました。'],
];
const katakanaReplacements = [
  [41, 'ソファ'], [42, 'フィルム'], [43, 'カフェ'], [44, 'フォーク'],
  [45, 'パーティー'], [46, 'ディスク'], [47, 'チェック'],
  [48, 'シェフ'], [49, 'ウェブ'], [50, 'ヴァイオリン'],
];
const variantFixes = [
  ['hiragana', 6, 'matsuri', 'maturi'],
  ['hiragana', 18, 'enpitsu', 'enpitu'],
  ['hiragana', 21, 'shashin', 'shasin'],
  ['hiragana', 33, 'mittsu', 'mittu'],
  ['katakana', 6, 'sofuto', 'sohuto'],
  ['katakana', 8, 'naifu', 'naihu'],
  ['katakana', 13, 'doitsu', 'doitu'],
  ['katakana', 21, 'shatsu', 'shatu'],
  ['katakana', 24, 'kyabetsu', 'kyabetu'],
];

test('active N5 kana placement asks only taught forms and has one valid choice', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL migration tests',
}, async (t) => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = `kana_scope_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=5000`);
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  t.after(async () => {
    await client.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  await client.query(`
    CREATE TABLE courses(id uuid PRIMARY KEY, slug text);
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid);
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid, slug text);
    CREATE TABLE quiz_questions(id uuid PRIMARY KEY, lesson_id uuid, sort_order int,
      section_number int, question text, correct_answer text, explanation text,
      section_label text, section_instruction text, updated_at timestamptz);
    CREATE TABLE quiz_options(question_id uuid, sort_order int, option_text text, is_correct boolean);
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY, lesson_id uuid, completed_at timestamptz,
      sampled_question_ids jsonb);
  `);
  const course = randomUUID();
  const module = randomUUID();
  const lessons = { hiragana: randomUUID(), katakana: randomUUID() };
  await client.query("INSERT INTO courses VALUES ($1, 'n5')", [course]);
  await client.query('INSERT INTO modules VALUES ($1, $2)', [module, course]);
  await client.query(`INSERT INTO lessons VALUES
    ($1, $3, 'assignment-bab-1-hiragana'),
    ($2, $3, 'assignment-bab-2-katakana')`, [lessons.hiragana, lessons.katakana, module]);

  const seeded = [];
  for (const [kind, items, section] of [
    ['hiragana', hiraganaReplacements, 7], ['katakana', katakanaReplacements, 6],
  ]) {
    for (const [sortOrder, question] of items) {
      seeded.push({ id: randomUUID(), kind, sortOrder, question, section,
        options: ['old correct', 'old wrong 1', 'old wrong 2', 'old wrong 3'] });
    }
  }
  for (const [kind, sortOrder, correct, equivalent] of variantFixes) {
    seeded.push({ id: randomUUID(), kind, sortOrder, question: `fixture ${kind} ${sortOrder}`,
      section: 1, options: [correct, equivalent, 'other a', 'other b'] });
  }
  for (const item of seeded) {
    await client.query(`INSERT INTO quiz_questions VALUES
      ($1, $2, $3, $4, $5, $6, 'old explanation', 'old section', 'old instruction', NOW())`,
    [item.id, lessons[item.kind], item.sortOrder, item.section, item.question, item.options[0]]);
    for (let i = 0; i < item.options.length; i += 1) {
      await client.query('INSERT INTO quiz_options VALUES ($1, $2, $3, $4)',
        [item.id, i, item.options[i], i === 0]);
    }
  }
  const changedId = seeded[0].id;
  await client.query(`INSERT INTO quiz_attempts VALUES
    ($1, $3, NULL, $4::jsonb), ($2, $3, NOW(), $4::jsonb)`,
    [randomUUID(), randomUUID(), lessons.hiragana, JSON.stringify([changedId])]);
  const sql = await readFile(new URL('../migrations/163_kana_placement_taught_scope.sql', import.meta.url), 'utf8');
  for (let run = 0; run < 2; run += 1) {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  const result = await client.query(`SELECT q.id, q.lesson_id, q.sort_order, q.question,
    q.correct_answer, q.section_label, q.section_instruction, q.explanation,
    jsonb_agg(jsonb_build_object('text', o.option_text, 'correct', o.is_correct)
      ORDER BY o.sort_order) AS options
    FROM quiz_questions q JOIN quiz_options o ON o.question_id = q.id
    GROUP BY q.id, q.lesson_id, q.sort_order, q.question,
      q.correct_answer, q.section_label, q.section_instruction, q.explanation`);
  assert.equal(result.rowCount, 25);
  for (const row of result.rows) {
    const original = seeded.find((item) => item.id === row.id);
    assert.ok(original);
    assert.equal(row.options[0].text, row.correct_answer);
    assert.equal(row.options[0].correct, true);
    for (const option of row.options.slice(1)) {
      assert.equal(option.correct, false);
      assert.notEqual(normalizeKanaReading(option.text), normalizeKanaReading(row.correct_answer),
        `${original.kind} question ${original.sortOrder} has an equivalent wrong choice`);
    }
    if (original.section === 7) {
      assert.notEqual(row.question, original.question);
      assert.doesNotMatch(row.question, /[はへを]/);
      assert.match(row.section_label, /Gabungan Bacaan/);
      assert.match(row.section_instruction, /tidak ada aturan partikel/);
    }
    if (original.kind === 'katakana' && original.section === 6) {
      assert.notEqual(row.question, original.question);
      assert.doesNotMatch(row.question, /[ァィェォヴ]/);
      assert.match(row.section_label, /Gabungan Kana/);
    }
  }
  const attempts = await client.query('SELECT completed_at FROM quiz_attempts');
  assert.equal(attempts.rowCount, 1);
  assert.ok(attempts.rows[0].completed_at);
});
