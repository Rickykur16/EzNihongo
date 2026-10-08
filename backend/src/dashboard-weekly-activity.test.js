import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { weeklyActivity, weeklyInsight } from './dashboard-service.js';

test('weekly learning activity includes lessons and submitted quizzes without inventing mastery evidence', {
  skip: !process.env.TEST_DATABASE_URL && 'Set a disposable local TEST_DATABASE_URL',
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.includes('test'));
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  t.after(async () => { await client.query('ROLLBACK'); await client.end(); });
  const schema = 'weekly_activity_' + randomUUID().replaceAll('-', '');
  await client.query(`BEGIN; CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}; SET LOCAL timezone TO 'UTC';
    CREATE TABLE modules (id text, course_id text);
    CREATE TABLE lessons (id text, module_id text);
    CREATE TABLE module_grammar (id text, module_id text);
    CREATE TABLE user_progress (user_id text, lesson_id text, completed boolean, completed_at timestamptz);
    CREATE TABLE quiz_attempts (user_id text, lesson_id text, completed_at timestamptz, score int);
    CREATE TABLE practice_attempts (user_id text, course_id text, created_at timestamptz, is_correct boolean, source text);
    CREATE TABLE grammar_attempts (user_id text, grammar_id text, created_at timestamptz, passed boolean, eval_source text);
    CREATE TABLE smart_review_sessions (id text, user_id text);
    CREATE TABLE smart_review_session_items (session_id text, lesson_id text, answered_at timestamptz);
    INSERT INTO modules VALUES ('n5-m', 'n5'), ('n4-m', 'n4');
    INSERT INTO lessons VALUES ('video', 'n5-m'), ('quiz', 'n5-m'), ('foreign', 'n4-m');
    INSERT INTO module_grammar VALUES ('grammar', 'n5-m');
  `);
  const load = (user = 'student', course = 'n5') => weeklyActivity(user, course, client.query.bind(client));

  await t.test('completed video and passed quiz today count one active day', async () => {
    await client.query(`
      INSERT INTO user_progress VALUES ('student', 'video', true, NOW()), ('student', 'quiz', true, NOW());
      INSERT INTO quiz_attempts VALUES ('student', 'quiz', NOW(), 10);
    `);
    const result = await load();
    assert.equal(result.activeDays, 1);
    assert.equal(result.lessonsCompleted, 2);
    assert.equal(result.attempts, 0);
    assert.equal(result.accuracy, null);
    assert.equal(result.reviewQuestions, 0);
    assert.notEqual(weeklyInsight(result).kind, 'low_activity');
  });

  await t.test('failed submitted quizzes count even without lesson completion', async () => {
    await client.query(`INSERT INTO quiz_attempts VALUES ('quiz-only', 'quiz', NOW(), 0)`);
    const result = await load('quiz-only');
    assert.equal(result.activeDays, 1);
    assert.equal(result.lessonsCompleted, 0);
    assert.equal(result.attempts, 0);
    assert.notEqual(weeklyInsight(result).kind, 'low_activity');
  });

  await t.test('practice, grammar, review and completions on one date do not double count', async () => {
    await client.query(`
      INSERT INTO practice_attempts VALUES ('student', 'n5', NOW(), true, 'smart_review');
      INSERT INTO grammar_attempts VALUES ('student', 'grammar', NOW(), false, 'smart_review');
      INSERT INTO smart_review_sessions VALUES ('session', 'student');
      INSERT INTO smart_review_session_items VALUES ('session', 'quiz', NOW());
    `);
    const result = await load();
    assert.equal(result.activeDays, 1);
    assert.equal(result.attempts, 2);
    assert.equal(result.accuracy, 50);
    assert.equal(result.reviewQuestions, 2);
    await client.query(`INSERT INTO quiz_attempts VALUES ('student', 'quiz', NOW() - INTERVAL '1 day', 0)`);
    assert.equal((await load()).activeDays, 2);
  });

  await t.test('other users, courses, old activity, drafts and undated legacy completion stay excluded', async () => {
    await client.query(`
      INSERT INTO user_progress VALUES
        ('excluded', 'video', true, NOW() - INTERVAL '8 days'),
        ('excluded', 'video', true, NULL),
        ('excluded', 'video', false, NOW()),
        ('excluded', 'foreign', true, NOW()),
        ('other-user', 'video', true, NOW());
      INSERT INTO quiz_attempts VALUES
        ('excluded', 'quiz', NULL, 0),
        ('excluded', 'quiz', NOW() - INTERVAL '8 days', 0),
        ('excluded', 'foreign', NOW(), 0),
        ('other-user', 'quiz', NOW(), 0);
    `);
    const result = await load('excluded');
    assert.equal(result.activeDays, 0);
    assert.equal(result.lessonsCompleted, 0);
    assert.equal(weeklyInsight(result).kind, 'low_activity');
    assert.equal((await load('excluded', 'n4')).activeDays, 1);
  });
});
