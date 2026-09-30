import { createHash, randomUUID } from 'node:crypto';
import { withTransaction } from './db.js';
import { isAdminEmail } from './auth.js';
import { dialogueFingerprint, questionFingerprint } from './dialogue-question-service.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { resolveFlowEligibility } from './learning-flow-config.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const fail = (status, code) => { const error = new Error(code); error.status = status; throw error; };
const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const placementDto = value => {
  if (value?.mode === 'inline') return { mode: 'inline', flowVersion: 2,
    reason: String(value.reason || 'eligible'),
    activeSessionId: UUID.test(String(value.activeSessionId || '')) ? value.activeSessionId : null };
  if (value?.mode === 'legacy_session' && UUID.test(String(value.activeSessionId || ''))) {
    return { mode: 'legacy_session', flowVersion: 1,
      reason: String(value.reason || 'active_legacy_session'),
      activeSessionId: value.activeSessionId };
  }
  return { mode: 'legacy', flowVersion: null,
    reason: String(value?.reason || 'inline_flow_not_enabled'),
    activeSessionId: null };
};
const publicQuestion = row => ({ id: row.id, version: row.question_version,
  kind: 'comprehension', prompt: row.prompt, options: row.options, sortOrder: row.sort_order });

export const defaultDialoguePlacement = resolveFlowEligibility;

// A dedicated Percakapan lesson owns formative comprehension independently
// of the Bunpou v2 rollout. Keep its placement/session metadata unchanged.
async function hasConversationLesson(client, lessonId) {
  const result = await client.query(`SELECT c.id FROM lessons c
    JOIN lessons s ON s.id=c.conversation_source_lesson_id
    WHERE s.id=$1 AND c.type='conversation' AND s.type IN ('video','text')
      AND c.module_id=s.module_id LIMIT 1`, [lessonId]);
  return result.rows.length > 0;
}

async function lessonScope(client, lessonId, user, adminCheck) {
  if (!UUID.test(String(lessonId || ''))) fail(400, 'invalid_lesson_id');
  const account = (await client.query('SELECT email FROM users WHERE id=$1 FOR SHARE',
    [user?.id])).rows[0];
  if (!account || account.email?.toLocaleLowerCase() !== user?.email?.toLocaleLowerCase() ||
      account.email.endsWith('@dihapus.invalid')) fail(403, 'account_unavailable');
  const row = (await client.query(`SELECT l.id,l.module_id,m.course_id,c.is_published
    FROM lessons l JOIN modules m ON m.id=l.module_id
    JOIN courses c ON c.id=m.course_id WHERE l.id=$1`, [lessonId])).rows[0];
  if (!row) fail(404, 'lesson_not_found');
  const admin = await adminCheck(account.email);
  if (!row.is_published && !admin) fail(404, 'lesson_not_found');
  if (!admin) {
    const grant = await client.query(`SELECT 1 FROM user_enrollments
      WHERE user_id=$1 AND course_id=$2 AND status='active'
        AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1 FOR SHARE`, [user.id, row.course_id]);
    if (!grant.rows.length) fail(403, 'not_enrolled');
  }
  return row;
}

async function questionScope(client, questionId, user, adminCheck) {
  if (!UUID.test(String(questionId || ''))) fail(400, 'invalid_question_id');
  const question = (await client.query(`SELECT q.id,q.source_lesson_id,q.grammar_id,q.kind
    FROM grammar_dialog_questions q WHERE q.id=$1`, [questionId])).rows[0];
  if (!question) fail(404, 'question_not_found');
  const lesson = await lessonScope(client, question.source_lesson_id, user, adminCheck);
  return { question, lesson };
}

export async function listLearnerDialogueQuestions(lessonId, user, {
  transaction = withTransaction, adminCheck = isAdminEmail,
  resolvePlacement = defaultDialoguePlacement,
} = {}) {
  return transaction(async client => {
    const lesson = await lessonScope(client, lessonId, user, adminCheck);
    const placement = placementDto(await resolvePlacement({ client, user, lessonId,
      courseId: lesson.course_id, moduleId: lesson.module_id }));
    const standalone = placement.mode !== 'inline' && await hasConversationLesson(client, lessonId);
    if (placement.mode !== 'inline' && !standalone) return { lessonId, placement, grammars: [] };
    const rows = (await client.query(`SELECT q.id,q.grammar_id,q.question_version,q.prompt,
        q.options,q.sort_order,q.dialogue_fingerprint,g.example_dialog,g.example_dialog_id,
        g.communication_goal,g.dialog_scene,g.module_id,g.lesson_id
      FROM grammar_dialog_questions q JOIN module_grammar g ON g.id=q.grammar_id
      WHERE q.source_lesson_id=$1 AND q.state='active' AND q.kind='comprehension'
      ORDER BY q.grammar_id,q.sort_order,q.id`, [lessonId])).rows;
    const groups = new Map();
    for (const row of rows) {
      if (row.module_id !== lesson.module_id || (row.lesson_id && row.lesson_id !== lessonId) ||
          row.dialogue_fingerprint !== dialogueFingerprint(row)) continue;
      if (!groups.has(row.grammar_id)) groups.set(row.grammar_id, []);
      groups.get(row.grammar_id).push(publicQuestion(row));
    }
    return { lessonId, placement, ...(standalone ? { standalone: true } : {}), grammars: [...groups]
      .filter(([, questions]) => questions.length >= 1 && questions.length <= 2)
      .map(([grammarId, questions]) => ({ grammarId, questions })) };
  });
}

function answerRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['questionVersion', 'optionIndex', 'requestId'].includes(key)) ||
      typeof body.questionVersion !== 'string' || !UUID.test(body.questionVersion) ||
      typeof body.requestId !== 'string' || !UUID.test(body.requestId) ||
      !Number.isInteger(body.optionIndex) || body.optionIndex < 0) fail(400, 'answer_schema_invalid');
}

export async function answerDialogueQuestion(questionId, user, body, {
  transaction = withTransaction, adminCheck = isAdminEmail,
  resolvePlacement = defaultDialoguePlacement, lockCourse = lockCurriculumCourse,
  onDisposition = null,
} = {}) {
  answerRequest(body);
  const committed = await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bunpou:${user.id}`]);
    const { question: source, lesson } = await questionScope(client, questionId, user, adminCheck);
    if (source.kind !== 'comprehension') fail(404, 'question_not_found');
    const payloadHash = digest({ schemaVersion: 1, questionId,
      questionVersion: body.questionVersion, optionIndex: body.optionIndex });
    const prior = (await client.query(`SELECT request_payload_hash,response_snapshot
      FROM dialogue_question_attempts WHERE user_id=$1 AND request_id=$2 FOR UPDATE`,
    [user.id, body.requestId])).rows[0];
    if (prior) {
      if (prior.request_payload_hash !== payloadHash) fail(409, 'request_id_conflict');
      return { response: prior.response_snapshot, disposition: 'replay' };
    }
    await lockCourse(client, lesson.course_id);
    const lockedLesson = (await client.query(`SELECT l.module_id,m.course_id
      FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$1 FOR SHARE OF l,m`,
    [source.source_lesson_id])).rows[0];
    if (!lockedLesson || lockedLesson.module_id !== lesson.module_id ||
        lockedLesson.course_id !== lesson.course_id) fail(409, 'question_owner_changed');
    const placement = placementDto(await resolvePlacement({ client, user,
      lessonId: source.source_lesson_id, courseId: lesson.course_id,
      moduleId: lesson.module_id, sharedConfig: true }));
    if (placement.mode !== 'inline' && !await hasConversationLesson(client, source.source_lesson_id)) {
      fail(409, 'inline_placement_unavailable');
    }
    // Authoring locks grammar before question; use the same order here.
    const grammar = (await client.query(`SELECT * FROM module_grammar WHERE id=$1 FOR SHARE`,
      [source.grammar_id])).rows[0];
    const question = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE id=$1 FOR SHARE`, [questionId])).rows[0];
    if (!grammar || !question || question.grammar_id !== source.grammar_id ||
        question.source_lesson_id !== source.source_lesson_id ||
        grammar.module_id !== lesson.module_id ||
        (grammar.lesson_id && grammar.lesson_id !== source.source_lesson_id)) {
      fail(409, 'question_owner_changed');
    }
    // The initial lookup was only for authorization and lock selection.
    // Ownership is rechecked after the curriculum lock, against locked rows.
    const currentCourse = (await client.query(`SELECT m.course_id FROM modules m
      WHERE m.id=$1`, [grammar.module_id])).rows[0]?.course_id;
    if (currentCourse !== lesson.course_id) fail(409, 'question_owner_changed');
    if (question.kind !== 'comprehension') fail(404, 'question_not_found');
    if (question.state !== 'active' || question.question_version !== body.questionVersion ||
        question.dialogue_fingerprint !== dialogueFingerprint(grammar)) {
      fail(409, 'question_version_conflict');
    }
    if (!Array.isArray(question.options) || body.optionIndex >= question.options.length ||
        !Number.isInteger(question.correct_index) || question.correct_index < 0 ||
        question.correct_index >= question.options.length) fail(400, 'option_index_invalid');
    const fingerprint = questionFingerprint({ kind: question.kind, prompt: question.prompt,
      options: question.options, correctIndex: question.correct_index,
      explanation: question.explanation, evidence: question.evidence });
    if (fingerprint !== question.question_fingerprint) fail(409, 'question_fingerprint_conflict');
    const attemptId = randomUUID();
    const response = { attemptId, questionId, questionVersion: question.question_version,
      selectedIndex: body.optionIndex, correct: body.optionIndex === question.correct_index,
      correctIndex: question.correct_index, explanation: question.explanation, formativeOnly: true };
    const snapshot = { kind: question.kind, prompt: question.prompt, options: question.options,
      correctIndex: question.correct_index, explanation: question.explanation,
      evidence: question.evidence };
    await client.query(`INSERT INTO dialogue_question_attempts
      (id,user_id,question_id,grammar_id,lesson_id,request_id,request_payload_hash,
       question_version,question_fingerprint,dialogue_fingerprint,boundary_fingerprint,
       question_snapshot,selected_index,is_correct,response_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb)`,
    [attemptId, user.id, questionId, question.grammar_id, question.source_lesson_id,
      body.requestId, payloadHash, question.question_version, question.question_fingerprint,
      question.dialogue_fingerprint, question.boundary_fingerprint,
      JSON.stringify(snapshot), body.optionIndex, response.correct, JSON.stringify(response)]);
    return { response, disposition: 'new' };
  });
  // This callback is an internal telemetry hint, emitted only after commit.
  // It cannot change the public snapshot or make a successful answer fail.
  try { onDisposition?.(committed.disposition); } catch { /* passive telemetry */ }
  return committed.response;
}

export async function latestDialogueQuestionAttempt(questionId, user, questionVersion = null, {
  transaction = withTransaction, adminCheck = isAdminEmail,
} = {}) {
  if (typeof questionVersion !== 'string' || !UUID.test(questionVersion)) {
    fail(400, 'invalid_question_version');
  }
  return transaction(async client => {
    const { question } = await questionScope(client, questionId, user, adminCheck);
    if (question.kind !== 'comprehension') fail(404, 'question_not_found');
    const row = (await client.query(`SELECT response_snapshot FROM dialogue_question_attempts
      WHERE user_id=$1 AND question_id=$2 AND question_version=$3
      ORDER BY created_at DESC,id DESC LIMIT 1`, [user.id, questionId, questionVersion])).rows[0];
    return row?.response_snapshot || null;
  });
}
