import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

test('kana placement migration regrades high scores and backfills progress once', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL migration tests',
}, async (t) => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = `kana_migration_${randomUUID().replaceAll('-', '')}`;
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
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid, slug text, sort_order int);
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid, slug text, type text,
      sort_order int, content text, passing_score_pct int, duration_minutes int, updated_at timestamptz);
    CREATE TABLE kana_items(id uuid PRIMARY KEY, kind text);
    CREATE TABLE lesson_kana_items(lesson_id uuid, kana_id uuid);
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY, user_id uuid, lesson_id uuid,
      score int, total_questions int, completed_at timestamptz, grading_result jsonb);
    CREATE TABLE user_progress(user_id uuid, lesson_id uuid, completed boolean,
      completed_at timestamptz, updated_at timestamptz,
      UNIQUE(user_id, lesson_id));
    CREATE TABLE user_stats(user_id uuid PRIMARY KEY, xp int DEFAULT 0,
      total_lessons_completed int DEFAULT 0, total_minutes_learned int DEFAULT 0,
      updated_at timestamptz DEFAULT NOW());
  `);

  const ids = Object.fromEntries(
    ['course', 'module', 'kanaA', 'kanaB', 'assessment', 'itemA', 'itemB',
      'passingUser', 'failingUser', 'passingAttempt', 'failingAttempt']
      .map((key) => [key, randomUUID()])
  );
  await client.query("INSERT INTO courses VALUES ($1, 'n5')", [ids.course]);
  await client.query("INSERT INTO modules VALUES ($1, $2, 'bab-2', 2)", [ids.module, ids.course]);
  await client.query(`INSERT INTO lessons VALUES
    ($1, $4, 'katakana-a', 'kana', 1, NULL, 70, 4, NOW()),
    ($2, $4, 'katakana-b', 'kana', 2, NULL, 70, 4, NOW()),
    ($3, $4, 'assignment-bab-2-katakana', 'quiz', 3,
      'Lulus jika nilai total minimal 85% dan sedikitnya 3 dari 4 soal benar pada setiap bagian.',
      85, 5, NOW())`, [ids.kanaA, ids.kanaB, ids.assessment, ids.module]);
  await client.query("INSERT INTO kana_items VALUES ($1, 'katakana'), ($2, 'katakana')",
    [ids.itemA, ids.itemB]);
  await client.query('INSERT INTO lesson_kana_items VALUES ($1, $3), ($2, $4)',
    [ids.kanaA, ids.kanaB, ids.itemA, ids.itemB]);
  const oldResult = JSON.stringify({ passed: false, completionSaved: false,
    proficiencyCompletions: [], sectionResults: [{ sectionNumber: 7, score: 2, total: 4, passed: false }] });
  await client.query(`INSERT INTO quiz_attempts VALUES
    ($1, $3, $5, 30, 32, NOW(), $6::jsonb),
    ($2, $4, $5, 26, 32, NOW(), $6::jsonb)`, [
    ids.passingAttempt, ids.failingAttempt, ids.passingUser, ids.failingUser,
    ids.assessment, oldResult,
  ]);

  const sql = await readFile(new URL('../migrations/162_kana_placement_total_score.sql', import.meta.url), 'utf8');
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

  const result = await client.query(
    'SELECT user_id, grading_result FROM quiz_attempts ORDER BY score DESC'
  );
  assert.equal(result.rows[0].grading_result.passed, true);
  assert.equal(result.rows[0].grading_result.completionSaved, true);
  assert.equal(result.rows[0].grading_result.proficiencyCompletions.length, 2);
  assert.equal(result.rows[0].grading_result.sectionResults[0].passed, false);
  assert.equal(result.rows[1].grading_result.passed, false);
  const progress = await client.query(
    'SELECT lesson_id FROM user_progress WHERE user_id = $1 AND completed = TRUE',
    [ids.passingUser]
  );
  assert.deepEqual(new Set(progress.rows.map((row) => row.lesson_id)),
    new Set([ids.kanaA, ids.kanaB, ids.assessment]));
  const failedProgress = await client.query('SELECT 1 FROM user_progress WHERE user_id = $1', [ids.failingUser]);
  assert.equal(failedProgress.rowCount, 0);
  const stats = await client.query('SELECT xp, total_lessons_completed, total_minutes_learned FROM user_stats WHERE user_id = $1',
    [ids.passingUser]);
  assert.deepEqual(stats.rows[0], { xp: 15, total_lessons_completed: 1, total_minutes_learned: 5 });
  const lesson = await client.query('SELECT content FROM lessons WHERE id = $1', [ids.assessment]);
  assert.match(lesson.rows[0].content, /Nilai per bagian hanya menunjukkan/);
});
