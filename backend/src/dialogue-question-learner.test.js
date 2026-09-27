import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueFingerprint, questionFingerprint } from './dialogue-question-service.js';
import { listLearnerDialogueQuestions, answerDialogueQuestion,
  latestDialogueQuestionAttempt } from './dialogue-question-learner.js';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: id(1), email: 'student@example.test' };
const lesson = { id: id(2), module_id: id(3), course_id: id(4), is_published: true };
const grammar = { id: id(5), module_id: lesson.module_id, lesson_id: lesson.id,
  example_dialog: 'A: ねこです。', example_dialog_id: 'A: Kucing.',
  communication_goal: 'Nama hewan', dialog_scene: null };
const question = { id: id(6), grammar_id: grammar.id, source_lesson_id: lesson.id,
  kind: 'comprehension', state: 'active', prompt: 'Hewan apa?',
  options: ['Kucing', 'Anjing', 'Burung'], correct_index: 0,
  explanation: 'Disebutkan kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }],
  sort_order: 0, question_version: id(7), boundary_fingerprint: 'sha256:boundary' };
question.dialogue_fingerprint = dialogueFingerprint(grammar);
question.question_fingerprint = questionFingerprint({ kind: question.kind, prompt: question.prompt,
  options: question.options, correctIndex: question.correct_index,
  explanation: question.explanation, evidence: question.evidence });
const inline = async () => ({ mode: 'inline', flowVersion: 2, reason: 'eligible', activeSessionId: null });
const body = { questionVersion: question.question_version, optionIndex: 0, requestId: id(8) };

function fixture({ questionRow = question, published = true, grant = true,
  accountEmail = user.email,
  session = null, batchRows = null } = {}) {
  const calls = [], attempts = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes('SELECT email FROM users')) return { rows: accountEmail == null ? [] : [{ email: accountEmail }] };
    if (sql.includes('FROM lessons l JOIN modules m')) return { rows: [{ ...lesson, is_published: published }] };
    if (sql.includes('FROM user_enrollments')) return { rows: grant ? [{ '?column?': 1 }] : [] };
    if (sql.includes('FROM grammar_task_sessions')) return { rows: session ? [session] : [] };
    if (sql.includes('FROM app_settings')) return { rows: [] };
    if (sql.includes('FROM grammar_dialog_questions q JOIN module_grammar g')) {
      return { rows: (batchRows || [questionRow]).map(row => ({ ...row, ...grammar, id: row.id,
        grammar_id: row.grammar_id, question_version: row.question_version,
        dialogue_fingerprint: row.dialogue_fingerprint })) };
    }
    if (sql.includes('FROM grammar_dialog_questions q WHERE q.id=')) {
      return { rows: [{ id: questionRow.id, grammar_id: questionRow.grammar_id,
        kind: questionRow.kind,
        source_lesson_id: questionRow.source_lesson_id }] };
    }
    if (sql.includes('FROM dialogue_question_attempts WHERE user_id=$1 AND request_id=$2')) {
      return { rows: attempts.filter(item => item.userId === params[0] && item.requestId === params[1])
        .map(item => ({ request_payload_hash: item.hash, response_snapshot: item.response })) };
    }
    if (sql.includes('FROM module_grammar WHERE id=')) return { rows: [grammar] };
    if (sql.includes('FROM grammar_dialog_questions') && sql.includes('FOR SHARE')) return { rows: [questionRow] };
    if (sql.includes('FROM modules m')) return { rows: [{ course_id: lesson.course_id }] };
    if (sql.includes('SELECT question_version')) return { rows: [{ question_version: questionRow.question_version }] };
    if (sql.includes('FROM dialogue_question_attempts') && sql.includes('ORDER BY')) {
      const found = attempts.filter(item => item.userId === params[0] &&
        item.questionId === params[1] && item.version === params[2]).at(-1);
      return { rows: found ? [{ response_snapshot: found.response }] : [] };
    }
    if (sql.includes('INSERT INTO dialogue_question_attempts')) {
      attempts.push({ userId: params[1], questionId: params[2], requestId: params[5],
        hash: params[6], version: params[7], response: JSON.parse(params[14]),
        snapshot: JSON.parse(params[11]) });
      return { rows: [] };
    }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    throw Error(`unhandled SQL: ${sql}`);
  } };
  return { client, calls, attempts, transaction: fn => fn(client), adminCheck: async () => false,
    lockCourse: async () => { calls.push({ sql: 'COURSE LOCK' }); } };
}

test('public batch returns only current comprehension with a strict answer-free whitelist', async () => {
  const f = fixture();
  const result = await listLearnerDialogueQuestions(lesson.id, user, { ...f, resolvePlacement: inline });
  assert.equal(result.grammars.length, 1);
  assert.deepEqual(result.grammars[0].questions[0], { id: question.id,
    version: question.question_version, kind: 'comprehension', prompt: question.prompt,
    options: question.options, sortOrder: 0 });
  const serialized = JSON.stringify(result);
  for (const secret of ['correctIndex', 'explanation', 'evidence', 'questionFingerprint',
    'dialogueFingerprint', 'boundaryFingerprint']) assert.equal(serialized.includes(secret), false);
  assert.deepEqual((await listLearnerDialogueQuestions(lesson.id, user, f)).grammars, []);
  assert.equal(f.calls.some(call => call.sql.includes('q.source_lesson_id=$1')), true);
});

test('transfer, stale dialogue and missing access cannot be answered', async () => {
  const transfer = fixture({ questionRow: { ...question, kind: 'transfer' } });
  await assert.rejects(answerDialogueQuestion(question.id, user, body,
    { ...transfer, resolvePlacement: inline }), e => e.status === 404);
  assert.equal(transfer.attempts.length, 0);
  const stale = fixture({ questionRow: { ...question, dialogue_fingerprint: 'sha256:old' } });
  await assert.rejects(answerDialogueQuestion(question.id, user, body,
    { ...stale, resolvePlacement: inline }), e => e.status === 409);
  assert.equal(stale.attempts.length, 0);
  const denied = fixture({ grant: false });
  await assert.rejects(answerDialogueQuestion(question.id, user, body,
    { ...denied, resolvePlacement: inline }), e => e.status === 403);
  assert.equal(denied.calls.some(call => call.sql.includes('INSERT INTO')), false);
  const erased = fixture({ accountEmail: `dihapus-${user.id}@dihapus.invalid` });
  await assert.rejects(answerDialogueQuestion(question.id, user, body,
    { ...erased, resolvePlacement: inline }), e => e.status === 403 && e.message === 'account_unavailable');
});

test('new answer saves one immutable snapshot, exact replay succeeds, changed request conflicts', async () => {
  const f = fixture();
  const args = { ...f, resolvePlacement: inline };
  const first = await answerDialogueQuestion(question.id, user, body, args);
  assert.equal(first.correct, true);
  assert.equal(first.correctIndex, 0);
  assert.equal(first.formativeOnly, true);
  assert.equal(f.attempts.length, 1);
  assert.equal(f.attempts[0].snapshot.correctIndex, 0);
  const replay = await answerDialogueQuestion(question.id, user, body, { ...f });
  assert.deepEqual(replay, first);
  assert.equal(f.attempts.length, 1);
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, optionIndex: 1 }, args), e => e.status === 409 && e.message === 'request_id_conflict');
  assert.equal(f.calls.filter(call => call.sql === 'COURSE LOCK').length, 1);
});

test('committed replay survives archive and edits, but remains access-checked', async () => {
  const current = { ...question };
  const f = fixture({ questionRow: current });
  const saved = await answerDialogueQuestion(question.id, user, body,
    { ...f, resolvePlacement: inline });
  current.state = 'archived';
  current.question_version = id(15);
  current.prompt = 'Edited';
  assert.deepEqual(await answerDialogueQuestion(question.id, user, body, f), saved);
  assert.deepEqual(await latestDialogueQuestionAttempt(question.id, user,
    question.question_version, f), saved);
  const revoked = fixture({ grant: false });
  await assert.rejects(answerDialogueQuestion(question.id, user, body, revoked),
    error => error.status === 403);
});

test('new attempts fail closed by default and malformed body never writes', async () => {
  const f = fixture();
  await assert.rejects(answerDialogueQuestion(question.id, user, body, f),
    e => e.status === 409 && e.message === 'inline_placement_unavailable');
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, optionIndex: '0' }, { ...f, resolvePlacement: inline }), e => e.status === 400);
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, requestId: [body.requestId] }, { ...f, resolvePlacement: inline }),
  e => e.status === 400 && e.message === 'answer_schema_invalid');
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, questionVersion: { value: body.questionVersion } }, { ...f, resolvePlacement: inline }),
  e => e.status === 400 && e.message === 'answer_schema_invalid');
  assert.equal(f.attempts.length, 0);
});

test('active v1 session is reported without serving inline questions; bad group counts fail closed', async () => {
  const legacy = fixture({ session: { id: id(11), flow_version: 1 } });
  const response = await listLearnerDialogueQuestions(lesson.id, user, legacy);
  assert.deepEqual(response.placement, { mode: 'legacy_session', flowVersion: 1,
    reason: 'active_legacy_session', activeSessionId: id(11) });
  assert.deepEqual(response.grammars, []);
  const tooMany = fixture({ batchRows: [question, { ...question, id: id(12) },
    { ...question, id: id(13) }] });
  const result = await listLearnerDialogueQuestions(lesson.id, user,
    { ...tooMany, resolvePlacement: inline });
  assert.deepEqual(result.grammars, []);
  assert.deepEqual(Object.keys(result.placement).sort(),
    ['activeSessionId', 'flowVersion', 'mode', 'reason']);
});

test('stale question version and invalid option never create attempts', async () => {
  const f = fixture();
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, questionVersion: id(14) }, { ...f, resolvePlacement: inline }),
  error => error.status === 409 && error.message === 'question_version_conflict');
  await assert.rejects(answerDialogueQuestion(question.id, user,
    { ...body, optionIndex: 4 }, { ...f, resolvePlacement: inline }),
  error => error.status === 400 && error.message === 'option_index_invalid');
  assert.equal(f.attempts.length, 0);
});

test('latest is scoped to the authenticated user and requested version; absent is null', async () => {
  const f = fixture();
  assert.equal(await latestDialogueQuestionAttempt(question.id, user, question.question_version, f), null);
  await answerDialogueQuestion(question.id, user, body, { ...f, resolvePlacement: inline });
  const latest = await latestDialogueQuestionAttempt(question.id, user, question.question_version, f);
  assert.equal(latest.questionId, question.id);
  assert.equal(await latestDialogueQuestionAttempt(question.id, { ...user, id: id(9) },
    question.question_version, f), null);
  assert.equal(await latestDialogueQuestionAttempt(question.id, user, id(10), f), null);
  await assert.rejects(latestDialogueQuestionAttempt(question.id, user, null, f),
    e => e.status === 400);
  await assert.rejects(latestDialogueQuestionAttempt(question.id, user,
    [question.question_version], f),
  e => e.status === 400 && e.message === 'invalid_question_version');
  const transfer = fixture({ questionRow: { ...question, kind: 'transfer' } });
  await assert.rejects(latestDialogueQuestionAttempt(question.id, user,
    question.question_version, transfer), e => e.status === 404);
});
