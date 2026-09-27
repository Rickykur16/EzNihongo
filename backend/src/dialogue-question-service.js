import { createHash, randomUUID } from 'node:crypto';
import { withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { BoundaryContextError, BoundaryUnavailableError, getCurriculumBoundary } from './curriculum-boundary.js';
import { validateContentAgainstBoundary, CURRICULUM_VALIDATOR_VERSION } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';
import { companionIsCurrent, contentRevisionId } from './bunpou-flow-service.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value ?? null);
const hash = value => `sha256:${createHash('sha256').update(stable(value)).digest('hex')}`;
const normalized = value => String(value || '').normalize('NFC').trim().replace(/[\s\u3000]+/gu, ' ').toLocaleLowerCase();
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

export class DialogueQuestionError extends Error {
  constructor(status, code, report = null) {
    super(code); this.status = status; this.code = code; this.report = report;
  }
}
const reject = (status, code, report) => { throw new DialogueQuestionError(status, code, report); };

export function dialogueTurns(grammar) {
  const scene = grammar.dialog_scene;
  if (Array.isArray(scene?.turns) && scene.turns.length) return scene.turns.map(turn =>
    ({ speaker: String(turn.speaker || ''), text: String(turn.text || turn.japanese || '').trim() }));
  return String(grammar.example_dialog || '').split(/\r?\n/u).map(line => line.trim()).filter(Boolean)
    .map(line => {
      const match = line.match(/^([^:：]{1,40})[:：]\s*(.*)$/u);
      return { speaker: match ? match[1].trim() : '', text: match ? match[2].trim() : line };
    });
}

export function dialogueFingerprint(grammar) {
  return hash({ version: 1, dialogue: String(grammar.example_dialog || '').normalize('NFC'),
    translation: String(grammar.example_dialog_id || '').normalize('NFC'),
    goal: String(grammar.communication_goal || '').normalize('NFC'),
    turns: dialogueTurns(grammar) });
}

export function questionFingerprint(question) {
  return hash({ version: 1, kind: question.kind, prompt: question.prompt,
    options: question.options, correctIndex: question.correctIndex,
    explanation: question.explanation, evidence: question.evidence || null });
}

export function questionsRevision(rows) {
  return hash({ version: 1, active: rows.filter(row => row.state === 'active')
    .map(row => ({ id: row.id, kind: row.kind, sortOrder: row.sort_order,
      questionVersion: row.question_version, dialogueFingerprint: row.dialogue_fingerprint }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)) });
}

const editorQuestion = (row, currentDialogueFingerprint) => ({
  id: row.id, kind: row.kind, prompt: row.prompt, options: row.options,
  correctIndex: row.correct_index, explanation: row.explanation,
  evidence: row.evidence, sortOrder: row.sort_order,
  questionVersion: row.question_version,
  dialogueFingerprint: row.dialogue_fingerprint,
  current: row.dialogue_fingerprint === currentDialogueFingerprint,
});

async function sourceLessonFor(client, grammar, requestedId) {
  const dbQuery = client.query.bind(client);
  let lesson;
  if (grammar.lesson_id) {
    if (requestedId && requestedId !== grammar.lesson_id) reject(409, 'source_lesson_mismatch');
    lesson = (await dbQuery('SELECT id,module_id FROM lessons WHERE id=$1 FOR SHARE',
      [grammar.lesson_id])).rows[0];
  } else {
    const candidates = await dbQuery(`SELECT l.id,l.module_id,l.bunpou_flow_published,t.id AS task_lesson_id
      FROM lessons l JOIN lessons t ON t.popup_after_lesson_id=l.id AND t.type='grammar_task'
      JOIN lesson_grammar_task_items i ON i.lesson_id=t.id AND i.grammar_id=$1
      WHERE l.module_id=$2 ORDER BY l.id FOR SHARE OF l,t,i`, [grammar.id, grammar.module_id]);
    if (candidates.rows.length !== 1) reject(422, 'source_lesson_mapping_ambiguous');
    lesson = candidates.rows[0];
    if (requestedId && requestedId !== lesson.id) reject(409, 'source_lesson_mismatch');
    const [items, pool] = await Promise.all([
      loadTaskConcepts(lesson.task_lesson_id, dbQuery), loadModulePool(lesson.task_lesson_id, dbQuery),
    ]);
    if (!companionIsCurrent(lesson.bunpou_flow_published, contentRevisionId(items, pool))) {
      reject(422, 'source_lesson_companion_not_current');
    }
  }
  if (!lesson || lesson.module_id !== grammar.module_id) reject(422, 'source_lesson_owner_mismatch');
  return lesson.id;
}

export async function loadDialogueQuestionContext(client, grammarId, sourceLessonId = null,
  { locked = false, shared = false } = {}) {
  const found = await client.query(`SELECT g.*,m.course_id,c.curriculum_boundary_mode AS boundary_mode
    FROM module_grammar g JOIN modules m ON m.id=g.module_id JOIN courses c ON c.id=m.course_id
    WHERE g.id=$1 ${locked ? 'FOR UPDATE OF g' : shared ? 'FOR SHARE OF g' : ''}`, [grammarId]);
  if (!found.rows.length) reject(404, 'grammar_not_found');
  const grammar = found.rows[0];
  const lessonId = await sourceLessonFor(client, grammar, sourceLessonId);
  return { grammar, sourceLessonId: lessonId, courseId: grammar.course_id,
    dialogueFingerprint: dialogueFingerprint(grammar), turns: dialogueTurns(grammar) };
}

function normalizeQuestion(input, index, turns) {
  if (!plain(input) || Object.keys(input).some(key => ![
    'id', 'kind', 'prompt', 'options', 'correctIndex', 'explanation', 'sortOrder', 'evidence',
  ].includes(key))) reject(422, 'question_schema_invalid');
  const { id = null, kind } = input;
  if (id != null && (typeof id !== 'string' || !UUID.test(id))) reject(422, 'question_id_invalid');
  if (!['comprehension', 'transfer'].includes(kind)) reject(422, 'question_kind_invalid');
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  const explanation = typeof input.explanation === 'string' ? input.explanation.trim() : '';
  if (!prompt || prompt.length > 2000 || !explanation || explanation.length > 2000) {
    reject(422, 'question_text_invalid');
  }
  const options = input.options;
  if (!Array.isArray(options) || options.length < 3 || options.length > 4 ||
      options.some(value => typeof value !== 'string' || !value.trim() || value.length > 500) ||
      new Set(options.map(normalized)).size !== options.length ||
      !Number.isInteger(input.correctIndex) || input.correctIndex < 0 ||
      input.correctIndex >= options.length) reject(422, 'question_options_invalid');
  const sortOrder = input.sortOrder ?? index;
  if (!Number.isInteger(sortOrder) || sortOrder < 0) reject(422, 'question_sort_order_invalid');
  let evidence = null;
  if (kind === 'comprehension') {
    evidence = input.evidence;
    if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 6 ||
        evidence.some(entry => !plain(entry) || Object.keys(entry).some(key =>
          !['turnIndex', 'quote'].includes(key)) || !Number.isInteger(entry.turnIndex) ||
          entry.turnIndex < 0 || entry.turnIndex >= turns.length ||
          typeof entry.quote !== 'string' || !entry.quote.trim() ||
          !turns[entry.turnIndex].text.includes(entry.quote))) reject(422, 'question_evidence_invalid');
    evidence = evidence.map(entry => ({ turnIndex: entry.turnIndex, quote: entry.quote }));
  } else if (input.evidence != null) reject(422, 'transfer_evidence_not_supported');
  return { id, kind, prompt, options: options.map(value => value.trim()),
    correctIndex: input.correctIndex, explanation, sortOrder, evidence };
}

function normalizeSet(inputs, turns) {
  if (!Array.isArray(inputs) || inputs.length > 3) reject(422, 'question_set_invalid');
  const questions = inputs.map((input, index) => normalizeQuestion(input, index, turns));
  if (questions.filter(q => q.kind === 'comprehension').length > 2 ||
      questions.filter(q => q.kind === 'transfer').length > 1 ||
      new Set(questions.filter(q => q.id).map(q => q.id)).size !== questions.filter(q => q.id).length ||
      new Set(questions.map(q => `${q.kind}:${q.sortOrder}`)).size !== questions.length) {
    reject(422, 'question_set_invalid');
  }
  return questions;
}

const fieldsFor = q => [
  { path: 'question.prompt', text: q.prompt },
  ...q.options.map((text, index) => ({ path: `question.options[${index}]`, text })),
  { path: 'question.explanation', text: q.explanation },
  ...(q.evidence || []).map((entry, index) => ({ path: `question.evidence[${index}].quote`, text: entry.quote })),
];

async function writeReport(client, context, question, report, decision) {
  await client.query(`INSERT INTO curriculum_boundary_reports
    (course_id,module_id,lesson_id,content_type,content_id,content_fingerprint,
     boundary_fingerprint,validator_version,policy_version,operation,mode,
     validation_status,decision,violations,warnings,usage,integrity_issues)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'1','live_write',$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb)`, [
    context.courseId, context.grammar.module_id, context.sourceLessonId,
    question.kind === 'comprehension' ? 'dialogue_comprehension' : 'dialogue_transfer',
    question.id, questionFingerprint(question), report.boundaryFingerprint,
    CURRICULUM_VALIDATOR_VERSION, context.grammar.boundary_mode, report.status,
    decision.decision, JSON.stringify(report.violations || []), JSON.stringify(report.warnings || []),
    JSON.stringify(report.usage || {}), JSON.stringify(report.integrityIssues || []),
  ]);
}

export async function listDialogueQuestions(grammarId, { sourceLessonId = null, transaction = withTransaction } = {}) {
  return transaction(async client => {
    const context = await loadDialogueQuestionContext(client, grammarId, sourceLessonId, { shared: true });
    const rows = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE grammar_id=$1 AND state='active' ORDER BY kind,sort_order,id`, [grammarId])).rows;
    return { grammarId, sourceLessonId: context.sourceLessonId,
      dialogueFingerprint: context.dialogueFingerprint, questionsRevision: questionsRevision(rows),
      questions: rows.map(row => editorQuestion(row, context.dialogueFingerprint)) };
  });
}

export async function saveDialogueQuestions(grammarId, body, {
  transaction = withTransaction, rejectedReportTransaction = transaction,
  resolveBoundary = getCurriculumBoundary, logger = console,
} = {}) {
  if (!body?.sourceLessonId || typeof body.expectedDialogueFingerprint !== 'string' ||
      typeof body.expectedQuestionsRevision !== 'string') reject(400, 'question_revision_required');
  let rejected = null;
  try { return await transaction(async client => {
    const preliminary = (await client.query(`SELECT m.course_id FROM module_grammar g
      JOIN modules m ON m.id=g.module_id WHERE g.id=$1`, [grammarId])).rows[0];
    if (!preliminary) reject(404, 'grammar_not_found');
    await lockCurriculumCourse(client, preliminary.course_id);
    const context = await loadDialogueQuestionContext(client, grammarId, body.sourceLessonId, { locked: true });
    if (context.courseId !== preliminary.course_id) reject(409, 'grammar_owner_changed');
    const oldRows = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE grammar_id=$1 ORDER BY kind,sort_order,id FOR UPDATE`, [grammarId])).rows;
    if (body.expectedDialogueFingerprint !== context.dialogueFingerprint ||
        body.expectedQuestionsRevision !== questionsRevision(oldRows)) reject(409, 'question_revision_conflict');
    const questions = normalizeSet(body.questions, context.turns);
    if (questions.length && !context.turns.some(turn => turn.text)) reject(422, 'source_dialogue_missing');
    const existing = new Map(oldRows.map(row => [row.id, row]));
    for (const question of questions) if (question.id) {
      const row = existing.get(question.id);
      if (!row || row.state !== 'active' || row.kind !== question.kind ||
          row.source_lesson_id !== context.sourceLessonId) reject(409, 'question_identity_conflict');
    }
    let boundary = null;
    await client.query('SAVEPOINT dialogue_question_boundary');
    try {
      boundary = await resolveBoundary({ grammarId, lessonId: context.sourceLessonId },
        { dbQuery: client.query.bind(client) });
      await client.query('RELEASE SAVEPOINT dialogue_question_boundary');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT dialogue_question_boundary');
      await client.query('RELEASE SAVEPOINT dialogue_question_boundary');
      if (!(error instanceof BoundaryContextError || error instanceof BoundaryUnavailableError)) throw error;
    }
    if (boundary && (boundary.course?.id !== context.courseId ||
        boundary.course?.mode !== context.grammar.boundary_mode)) reject(422, 'boundary_context_mismatch');
    const validated = questions.map(question => {
      const report = validateContentAgainstBoundary({ boundary,
        contentType: question.kind === 'comprehension' ? 'dialogue_comprehension' : 'dialogue_transfer',
        operation: 'live_write', fields: fieldsFor(question),
        question: { prompt: question.prompt, options: question.options,
          correctIndex: question.correctIndex } });
      const decision = decideBoundaryAction({ mode: context.grammar.boundary_mode,
        operation: 'live_write', report });
      if (!decision.canProceed) {
        rejected = { context, question, report, decision };
        reject(decision.statusCode, decision.code || 'question_boundary_rejected', report);
      }
      return { question, report, decision };
    });
    // Temporarily archive the locked set to release its partial unique slots;
    // selected IDs are restored in this same transaction. Only omitted IDs
    // remain archived at commit, preserving their attempts and provenance.
    await client.query(`UPDATE grammar_dialog_questions SET state='archived',updated_at=NOW()
      WHERE grammar_id=$1 AND state='active'`, [grammarId]);
    for (const { question, report, decision } of validated) {
      const previous = question.id ? existing.get(question.id) : null;
      const fingerprint = questionFingerprint(question);
      const version = previous && previous.question_fingerprint === fingerprint &&
        previous.dialogue_fingerprint === context.dialogueFingerprint
        ? previous.question_version : randomUUID();
      let id = question.id;
      if (previous) {
        await client.query(`UPDATE grammar_dialog_questions SET prompt=$2,options=$3::jsonb,
          correct_index=$4,explanation=$5,evidence=$6::jsonb,sort_order=$7,
          question_version=$8,question_fingerprint=$9,dialogue_fingerprint=$10,
          boundary_fingerprint=$11,validator_version=$12,state='active',updated_at=NOW()
          WHERE id=$1`, [id, question.prompt, JSON.stringify(question.options), question.correctIndex,
          question.explanation, question.evidence ? JSON.stringify(question.evidence) : null,
          question.sortOrder, version, fingerprint, context.dialogueFingerprint,
          report.boundaryFingerprint, CURRICULUM_VALIDATOR_VERSION]);
      } else {
        id = randomUUID();
        await client.query(`INSERT INTO grammar_dialog_questions
          (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,
           sort_order,question_version,question_fingerprint,dialogue_fingerprint,evidence,
           source_kind,boundary_fingerprint,validator_version,state)
          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,'manual',$14,$15,'active')`, [
          id, grammarId, context.sourceLessonId, question.kind, question.prompt,
          JSON.stringify(question.options), question.correctIndex, question.explanation,
          question.sortOrder, version, fingerprint, context.dialogueFingerprint,
          question.evidence ? JSON.stringify(question.evidence) : null,
          report.boundaryFingerprint, CURRICULUM_VALIDATOR_VERSION]);
      }
      await writeReport(client, context, { ...question, id }, report, decision);
    }
    const rows = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE grammar_id=$1 AND state='active' ORDER BY kind,sort_order,id`, [grammarId])).rows;
    return { grammarId, sourceLessonId: context.sourceLessonId,
      dialogueFingerprint: context.dialogueFingerprint, questionsRevision: questionsRevision(rows),
      questions: rows.map(row => editorQuestion(row, context.dialogueFingerprint)),
      validation: validated.map(({ question, report, decision }) => {
        const saved = rows.find(row => row.kind === question.kind && row.sort_order === question.sortOrder);
        return { id: saved?.id || question.id, kind: question.kind, report, decision };
      }) };
  }); } catch (error) {
    if (rejected) {
      try { await rejectedReportTransaction(client => writeReport(client, rejected.context,
        rejected.question, rejected.report, rejected.decision)); }
      catch (reportError) { logger.error('dialogue_question_rejected_report_unavailable',
        { code: reportError.code || reportError.message }); }
    }
    throw error;
  }
}
