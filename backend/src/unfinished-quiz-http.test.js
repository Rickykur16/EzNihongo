import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('unfinished assignments resume the saved packet and drafts across sessions', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = 'unfinished_quiz_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect(); await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href; process.env.JWT_ACCESS_SECRET = 'unfinished-quiz-test'; process.env.ADMIN_EMAILS = '';
  const { db } = await import('./db.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end(); await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end();
  });
  await control.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  const user = randomUUID(), other = randomUUID();
  await control.query(`INSERT INTO users(id,google_id,email,full_name) VALUES ($1,'unfinished1','unfinished1@example.invalid','Test'),($2,'unfinished2','unfinished2@example.invalid','Other')`, [user, other]);
  const { signAccessToken } = await import('./auth.js');
  const { default: progress } = await import('./routes/progress.js');
  const app = express(); app.use(express.json(), progress);
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = await signAccessToken(user, 'unfinished1@example.invalid');
  const otherToken = await signAccessToken(other, 'unfinished2@example.invalid');
  async function call(path, body, method = 'GET', auth = token) {
    const res = await fetch(base + path, { method, headers: { ...(auth && { Authorization: `Bearer ${auth}` }), 'Content-Type': 'application/json' }, ...(method !== 'GET' && { body: JSON.stringify(body || {}) }) });
    return { status: res.status, cacheControl: res.headers.get('Cache-Control'), body: await res.json() };
  }
  const path = (f, suffix) => `/progress/lesson/${f.lesson}/${suffix}`;
  const discover = () => call('/progress/quiz/unfinished');
  async function fixture({ owner = user, count = 2, sample = count, enrollment = 'active', published = true, startedAt = '2026-09-01T01:00:00Z' } = {}) {
    const course = randomUUID(), module = randomUUID(), lesson = randomUUID(), attemptId = randomUUID(), attemptToken = randomUUID();
    await control.query(`INSERT INTO courses(id,slug,title,is_published) VALUES ($1::uuid,$1::text,'Course',$2)`, [course, published]);
    await control.query(`INSERT INTO modules(id,course_id,slug,title) VALUES ($1::uuid,$2,$1::text,'Module')`, [module, course]);
    await control.query(`INSERT INTO lessons(id,module_id,slug,title,type,questions_per_attempt,cooldown_hours) VALUES ($1::uuid,$2,$1::text,'Assignment','quiz',48,0)`, [lesson, module]);
    if (enrollment) await control.query(`INSERT INTO user_enrollments(user_id,course_id,status,expires_at) VALUES ($1,$2,$3,$4)`, [owner, course, enrollment === 'expired' ? 'active' : enrollment, enrollment === 'expired' ? '2000-01-01' : null]);
    const questions = [];
    for (let i = 0; i < count; i++) {
      const id = randomUUID(), optionId = randomUUID(), typed = i === sample - 1;
      await control.query(`INSERT INTO quiz_questions(id,lesson_id,question,question_type,correct_answer,sort_order) VALUES ($1,$2,'Question',$3,$4,$5)`, [id, lesson, typed ? 'fill_blank' : 'multiple_choice', typed ? 'いち' : null, i]);
      if (!typed) await control.query(`INSERT INTO quiz_options(id,question_id,option_text,is_correct) VALUES ($1,$2,'Answer',true)`, [optionId, id]);
      questions.push({ id, optionId, typed });
    }
    const sampled = questions.slice(0, sample);
    await control.query(`INSERT INTO quiz_attempts(id,user_id,lesson_id,attempt_token,sampled_question_ids,started_at) VALUES ($1,$2,$3,$4,$5,$6)`, [attemptId, owner, lesson, attemptToken, JSON.stringify(sampled.map(q => q.id)), startedAt]);
    return { course, module, lesson, attemptId, attemptToken, questions, sampled };
  }
  const main = await fixture({ count: 48, sample: 28 });
  const answers = main.sampled.map(q => q.typed ? { questionId: q.id, textAnswer: 'いち' } : { questionId: q.id, optionId: q.optionId });
  await t.test('read-only discovery is authenticated, scoped to entitled courses and never returns question secrets', async () => {
    assert.equal((await call('/progress/quiz/unfinished', null, 'GET', null)).status, 401);
    for (const enrollment of ['revoked', 'expired', null]) await fixture({ enrollment, startedAt: '2026-09-20' });
    await fixture({ published: false, startedAt: '2026-09-20' });
    await fixture({ owner: other, startedAt: '2026-09-20' });
    const before = (await control.query('SELECT count(*)::int n FROM quiz_attempts')).rows[0].n;
    const result = await discover(); assert.equal(result.status, 200); assert.equal(result.cacheControl, 'private, no-store');
    assert.equal(result.body.attempt.attemptToken, main.attemptToken); assert.equal(result.body.attempt.totalQuestions, 28);
    assert.equal(result.body.attempt.lessonSlug, main.lesson); assert.equal(result.body.attempt.courseSlug, main.course);
    assert.doesNotMatch(JSON.stringify(result.body), /audio_script|audio_scene|questions|draftAnswers|correct_answer|is_correct/);
    assert.equal((await control.query('SELECT count(*)::int n FROM quiz_attempts')).rows[0].n, before);
  });
  await t.test('old legacy attempt uses 28 saved questions despite a 48-question pool and survives absence', async () => {
    const status = await call(path(main, 'quiz-status'));
    assert.equal(status.body.questionsPerAttempt, 28); assert.equal(status.body.totalQuestions, 28); assert.equal(status.body.poolSize, 48);
    assert.equal(status.body.inProgressAttemptToken, main.attemptToken);
    const resumed = await call(path(main, 'quiz/start'), { resumeOnly: true, attemptToken: main.attemptToken }, 'POST');
    assert.equal(resumed.status, 200); assert.equal(resumed.body.attemptToken, main.attemptToken);
    assert.equal(resumed.body.totalQuestions, 28); assert.equal(resumed.body.questionsPerAttempt, 28); assert.equal(resumed.body.questions.length, 28);
    assert.equal(resumed.body.expiresAt, null); assert.equal(resumed.body.draftEnabled, true);
    assert.deepEqual(resumed.body.draftAnswers, []); assert.equal(resumed.body.draftRevision, 0);
  });
  await t.test('legacy choice and typed drafts survive resume; invalid choices and stale revisions cannot replace them', async () => {
    const draft = [answers[0], answers.at(-1)];
    const save = (a, revision = 0, auth = token) => call(path(main, 'quiz/draft'), { attemptToken: main.attemptToken, answers: a, revision }, 'PUT', auth);
    assert.equal((await save(draft, 0, otherToken)).status, 403);
    assert.equal((await save([{ questionId: main.sampled[0].id, optionId: main.sampled[1].optionId }])).status, 400);
    assert.equal((await save([draft[0], draft[0]])).status, 400);
    assert.equal((await save([{ ...draft[0], textAnswer: 'extra' }])).status, 400);
    assert.equal((await save([{ questionId: main.questions[40].id, optionId: main.questions[40].optionId }])).status, 400);
    assert.equal((await save(draft)).body.revision, 1);
    assert.equal((await save([])).status, 409);
    const resumed = await call(path(main, 'quiz/start'), { resumeOnly: true, attemptToken: main.attemptToken }, 'POST');
    assert.deepEqual(resumed.body.draftAnswers, draft); assert.equal(resumed.body.draftRevision, 1);
    assert.equal((await call(path(main, 'quiz-attempt'), { attemptToken: main.attemptToken, answers, draftRevision: 0 }, 'POST')).body.error, 'draft_conflict');
    const result = await call(path(main, 'quiz-attempt'), { attemptToken: main.attemptToken, answers, draftRevision: 1 }, 'POST');
    assert.equal(result.status, 200); assert.equal(result.body.total, 28); assert.equal(result.body.score, 28);
  });
  await t.test('a completed cross-tab attempt cannot be recreated by automatic resume', async () => {
    const before = (await control.query('SELECT count(*)::int n FROM quiz_attempts WHERE lesson_id=$1', [main.lesson])).rows[0].n;
    const stale = await call(path(main, 'quiz/start'), { resumeOnly: true, attemptToken: main.attemptToken }, 'POST');
    assert.equal(stale.status, 409); assert.equal(stale.body.error, 'attempt_not_pending');
    assert.equal((await control.query('SELECT count(*)::int n FROM quiz_attempts WHERE lesson_id=$1', [main.lesson])).rows[0].n, before);
    assert.equal((await discover()).body.attempt, null);
  });
  await t.test('missing legacy questions are not resized or forced by discovery', async () => {
    const missing = await fixture({ startedAt: '2026-09-21' });
    await control.query('DELETE FROM quiz_questions WHERE id=$1', [missing.sampled[0].id]);
    assert.equal((await discover()).body.attempt, null);
    const r = await call(path(missing, 'quiz/start'), { resumeOnly: true, attemptToken: missing.attemptToken }, 'POST');
    assert.equal(r.status, 409); assert.equal(r.body.error, 'quiz_questions_changed');
    const saved = (await control.query('SELECT sampled_question_ids,completed_at FROM quiz_attempts WHERE id=$1', [missing.attemptId])).rows[0];
    assert.equal(saved.sampled_question_ids.length, 2); assert.equal(saved.completed_at, null);
  });
  await t.test('selection is deterministic across courses and superseded legacy rows never resurrect', async () => {
    const one = await fixture({ startedAt: '2026-09-22' }), two = await fixture({ startedAt: '2026-09-22' });
    const latest = one.attemptId > two.attemptId ? one : two;
    assert.equal((await discover()).body.attempt.attemptToken, latest.attemptToken);
    await control.query(`UPDATE quiz_attempts SET score=0,total_questions=2,completed_at=NOW() WHERE id=ANY($1::uuid[])`, [[one.attemptId, two.attemptId]]);
    // An older abandoned attempt in a lesson with a newer completed attempt is history.
    await control.query(`INSERT INTO quiz_attempts(user_id,lesson_id,attempt_token,sampled_question_ids,started_at) VALUES ($1,$2,$3,$4,'2026-08-01')`, [user, one.lesson, randomUUID(), JSON.stringify(one.sampled.map(q => q.id))]);
    assert.equal((await discover()).body.attempt, null);
  });
});
