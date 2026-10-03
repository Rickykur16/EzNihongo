import { Router } from 'express';
import dialogueFurigana from '../../../src/dialogue-furigana.js';
import { dialogueCatalog, keepStoredVoices, normalizeDialogScene, sceneTurnVoices,
  validateSceneVoices } from '../dialogue-scene.js';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { uploadLimits, uploadErrorHandler } from '../upload-safety.js';
import { BASE_EXPRESSION, MAX_EXPRESSIONS_PER_CHARACTER, inspectArt, isCharacterKey, isExpressionKey } from '../dialogue-art.js';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { landingCourseFields } from '../landing-course-fields.js';
import { isCanonicalUuid, validateLiveClassFields } from '../live-class-admin-rules.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';
import { requireCompanyAdmin, fail } from '../company-policy.js';
import {
  isAdminEmail,
  isEnvAdminEmail,
  listEnvAdminEmails,
  invalidateAdminEmailCache,
} from '../auth.js';
import { COACH_PROMPT_DEFAULT } from './recommendations.js';
import { callClaude, anthropicEnabled, ANTHROPIC_GEN_MODEL } from '../anthropic.js';
import { controlledSlot, slotShaped, deriveDrills } from '../grammar-drills.js';
import { deleteMarketingProfile, eraseUserAccount } from '../user-erasure.js';
import {
  NOTION_BAB_DB_ID_DEFAULT,
  NOTION_VOCAB_LESSON_RELATION,
  notionIdFromInput,
  notionPlainText,
  notionNumber,
  pickProp,
  notionQueryAll,
} from '../notion.js';
import {
  parseDialog,
  fetchElevenVoices,
  elevenLabsEnabled,
  TTS_SETTINGS_VERSION,
  renderTtsAudio,
  loadSpeakerRegistry,
  voiceForSpeaker,
  resolveDialogTurns,
} from './tts.js';
import {
  loadCourseVocab,
  deriveCompounds,
  loadKanjiCatalog,
  invalidateCourseVocabCache,
  invalidateKanjiCatalogCache,
} from '../kanji-compounds.js';
import { loadTaskConcepts, loadModulePool } from './grammar-task.js';
import {
  contentRevisionId, companionDraftRevision,
  dialogCheckAvailability, validateCompanionEnvelope,
  sanitizeCompanionEnvelope,
} from '../bunpou-flow-service.js';
import { loadMasteryShadow, summarizeShadow } from '../grammar-mastery-shadow.js';
import { loadPilotLessonOptions } from '../bunpou-pilot-catalog.js';
import { BoundaryContextError, getCurriculumBoundary } from '../curriculum-boundary.js';
import { validateAndWriteContent, boundaryWriteHttpError, lockCurriculumCourse,
  lockCurriculumCourses, lockCurriculumGraph } from '../curriculum-content-service.js';
import { validateContentAgainstBoundary, CURRICULUM_VALIDATOR_VERSION } from '../curriculum-boundary-validator.js';
import { generateGroundedContent } from '../grounded-generation.js';
import { dialogueSourceFingerprint } from '../curriculum-boundary-context.js';
import { DialogueQuestionError, loadDialogueQuestionContext, listDialogueQuestions,
  saveDialogueQuestions, assertDialogueQuestionLessonMoveAllowed } from '../dialogue-question-service.js';
import { getLearningFlowSettings, previewLessonFlowReadiness,
  saveLearningFlowSettings } from '../learning-flow-config.js';
import { CurriculumModeError, getCurriculumBoundaryMode,
  saveCurriculumBoundaryMode } from '../curriculum-boundary-mode.js';
import { captureReadinessAttestation,
  listReadinessAttestations } from '../curriculum-readiness-attestations.js';
import { validateBunpouPublish } from '../curriculum-bunpou-validation.js';
import { deckReadingSourceFingerprint, distractorSourceFingerprint,
  assertGenerationSourceUnchanged } from '../curriculum-generation-source.js';
import { decideBoundaryAction } from '../curriculum-boundary-policy.js';
import { V2_CONFIG, POLICY_V2, POLICY_SETTING_KEY, resolvePolicy } from '../grammar-mastery-policy.js';
import {
  grammarExampleLearningScopeWarnings,
  grammarLearningScopeWarnings,
  lessonContentLearningScopeWarnings,
  quizLearningScopeWarnings,
  vocabularyExampleLearningScopeWarnings,
} from '../learning-scope-warnings.js';

const router = Router();

// Draft generation is deliberately separate from guarded writes. The row is
// loaded again after Claude responds by generateGroundedContent, so a changed
// source cannot be presented as a current draft.
const groundedGenerationMetadata = result => ({ status: result.status,
  report: result.report, decision: result.decision ?? null, attempts: result.attempts,
  boundaryFingerprint: result.boundaryFingerprint ?? null,
  sourceFingerprint: result.sourceFingerprint ?? null });
const generationExampleCount = value => Math.max(1, Math.min(5, Math.trunc(Number(value) || 3)));

async function groundedDraft({ scope, contentType, loadSource, instruction, maxTokens,
  body, communicationGoal = '', scenario = '', trustedValidation = {},
  expectedExampleCount = null, additionalSchemaIssues = null,
  model = null, system = 'Create one Japanese learning-content draft. Return only one valid JSON object using the requested keys.',
  transformCandidate = x => x }) {
  return generateGroundedContent({ scope, contentType, loadSource, communicationGoal,
    scenario, trustedValidation, expectedExampleCount, additionalSchemaIssues,
    onTerminal: event => console.info(JSON.stringify(event)),
    expectedBoundaryFingerprint: body.boundaryFingerprint || null,
    expectedSourceFingerprint: body.sourceFingerprint || null,
    provider: async ({ prompt, repairFeedback }) => {
      const raw = await callClaude({
      system,
      userContent: `${instruction}\n\nAuthoritative curriculum context (JSON):\n${prompt}\n\n${repairFeedback
        ? `Repair the previous output. Issues: ${JSON.stringify(repairFeedback)}\n` : ''}Return only JSON.`,
      maxTokens,
      ...(model ? { model } : {}),
      });
      if (!raw) throw new Error('ai_upstream');
      return raw;
    },
    parse: raw => {
      const parsed = typeof raw === 'string' ? _extractJsonObject(raw) : raw;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('model_output_invalid_json');
      return transformCandidate(parsed);
    },
  });
}

function legacyQuizQuestionToCanonical(raw, { passage = null, listening = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const keys = listening ? ['question', 'audioScript', 'options', 'explanation'] :
    ['question', 'options', 'explanation'];
  if (Object.keys(raw).some(key => !keys.includes(key))) return raw;
  const options = Array.isArray(raw.options) ? raw.options.map(option => option?.text) : raw.options;
  const correct = Array.isArray(raw.options) ? raw.options.flatMap((option, index) =>
    option?.isCorrect === true ? [index] : []) : [];
  const invalidOptionShape = Array.isArray(raw.options) && raw.options.some(option =>
    !option || typeof option !== 'object' || Array.isArray(option) ||
    Object.keys(option).some(key => !['text', 'isCorrect'].includes(key)) ||
    typeof option.text !== 'string' || typeof option.isCorrect !== 'boolean');
  return { prompt: raw.question, options, correctIndex: invalidOptionShape || correct.length !== 1 ? -1 : correct[0],
    explanation: raw.explanation,
    ...(listening ? { audioScript: raw.audioScript } : {}),
    ...(passage != null ? { passage } : {}) };
}

function legacyQuizBatchToCanonical(parsed, { listening = false, needsPassage = false } = {}) {
  if (needsPassage) {
    if (!Array.isArray(parsed.passages) || Object.keys(parsed).some(key => key !== 'passages')) return parsed;
    return { questions: parsed.passages.flatMap(group =>
      group && typeof group === 'object' && !Array.isArray(group) &&
      Array.isArray(group.questions) && Object.keys(group).every(key => ['passage', 'questions'].includes(key))
        ? group.questions.map(question => legacyQuizQuestionToCanonical(question, { passage: group.passage }))
        : [null]) };
  }
  if (!Array.isArray(parsed.questions) || Object.keys(parsed).some(key => key !== 'questions')) return parsed;
  return { questions: parsed.questions.map(question => legacyQuizQuestionToCanonical(question, { listening })) };
}

const legacyQuizOptions = question => question.options.map((text, index) =>
  ({ text, isCorrect: index === question.correctIndex }));

function grammarGenerationSignature(row) {
  const literal = String(row.pattern || '').replace(/[〜～~（）()\[\]{}・….,/\s]/gu, '');
  if (!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Unified_Ideograph}]{2,}/u.test(literal)) return [];
  return [{ grammarId: String(row.id), version: CURRICULUM_VALIDATOR_VERSION,
    regex: new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u') }];
}

function groundedResponse(res, result, fields = {}, statusOverride = null) {
  const status = statusOverride ?? (result.status === 'stale' ? 409 : result.status === 'unavailable' ? 503 : 200);
  const generation = groundedGenerationMetadata(result);
  return res.status(status).json({ ...fields, candidate: result.candidate,
    ...generation, generation });
}

function rejectGroundedResult(result, violation) {
  result.status = 'rejected';
  result.report = { ...result.report, valid: false,
    violations: [...(result.report?.violations || []), violation] };
  result.decision = decideBoundaryAction({ mode: result.context?.course?.mode || 'enforce',
    operation: 'generate', report: result.report });
}

async function safeLearningWarnings(loadWarnings) {
  try {
    return await loadWarnings();
  } catch (err) {
    console.error('Learning-scope warning check failed:', err.message);
    return [{
      code: 'scope_check_unavailable',
      message: 'Konten tersimpan, tetapi pemeriksaan alur belajar sedang tidak tersedia. Periksa kembali materi bab ini.',
    }];
  }
}

// Every route in this file requires admin
router.use(requireAuth, requireCompanyAdmin);

function dialogueQuestionFailure(res, error) {
  if (!(error instanceof DialogueQuestionError)) throw error;
  res.set('Cache-Control', 'private, no-store');
  return res.status(error.status).json({ error: error.code,
    ...(error.report ? { validation: error.report, report: error.report } : {}) });
}

// Owner-only: these editor DTOs include answer keys and private transfer
// questions. Their exact methods are also recorded in company-route-policy.
router.get('/grammar/:id/dialogue-questions', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const result = await listDialogueQuestions(req.params.id,
      { sourceLessonId: req.query.sourceLessonId || null });
    res.set('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) { dialogueQuestionFailure(res, error); }
}));

router.put('/grammar/:id/dialogue-questions', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const result = await saveDialogueQuestions(req.params.id, req.body || {});
    res.set('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) { dialogueQuestionFailure(res, error); }
}));

router.post('/grammar/:id/generate-dialog-questions', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const body = req.body || {};
  const kind = body.kind;
  const count = body.count ?? 1;
  if (!body.sourceLessonId || !body.expectedDialogueFingerprint ||
      !['comprehension', 'transfer'].includes(kind) || !Number.isInteger(count) ||
      count < (kind === 'comprehension' ? 1 : 0) || count > (kind === 'comprehension' ? 2 : 1)) {
    return res.status(400).json({ error: 'dialogue_generation_context_required' });
  }
  let context;
  try { context = await loadDialogueQuestionContext({ query }, req.params.id, body.sourceLessonId); }
  catch (error) { return dialogueQuestionFailure(res, error); }
  if (context.dialogueFingerprint !== body.expectedDialogueFingerprint) {
    return res.status(409).json({ error: 'dialogue_changed_since_editor_open' });
  }
  if (!context.turns.some(turn => turn.text)) return res.status(422).json({ error: 'source_dialogue_missing' });
  const loadSource = async () => {
    const current = await loadDialogueQuestionContext({ query }, req.params.id, body.sourceLessonId);
    return { turns: current.turns, grammarId: current.grammar.id,
      sourceLessonId: current.sourceLessonId, dialogueFingerprint: current.dialogueFingerprint,
      goal: current.grammar.communication_goal || '',
      translation: current.grammar.example_dialog_id || '' };
  };
  const initialSource = await loadSource();
  if (initialSource.dialogueFingerprint !== context.dialogueFingerprint) {
    return res.status(409).json({ error: 'dialogue_changed_since_editor_open' });
  }
  const sourceFingerprint = dialogueSourceFingerprint(initialSource);
  if (count === 0) {
    const report = { status: 'not_run', valid: null, violations: [], warnings: [] };
    return groundedResponse(res, { status: 'ready', candidate: { questions: [] }, report,
      decision: { decision: 'allowed', canProceed: true, statusCode: 200, code: null },
      attempts: [], boundaryFingerprint: null, sourceFingerprint },
    { questions: [], dialogueFingerprint: context.dialogueFingerprint });
  }
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled' });
  const result = await groundedDraft({ scope: { grammarId: req.params.id,
    lessonId: context.sourceLessonId },
    contentType: kind === 'comprehension' ? 'dialogue_comprehension' : 'dialogue_transfer',
    loadSource, body: { ...body, sourceFingerprint },
    communicationGoal: context.grammar.communication_goal || '',
    maxTokens: 1300, model: ANTHROPIC_GEN_MODEL,
    instruction: `Create exactly ${count} ${kind} multiple-choice question(s) for the persisted Japanese dialogue. Return JSON {"questions":[{"prompt":"...","options":["...","...","..."],"correctIndex":0,"explanation":"..."${kind === 'comprehension' ? ',"evidence":[{"turnIndex":0,"quote":"exact source quote"}]' : ''}}]}. Every option, explanation and evidence quote must be grounded in the source. ${kind === 'comprehension' ? 'Evidence must cite an exact Japanese dialogue turn quote.' : 'Test transfer to a new situation; do not claim source-turn evidence.'}`,
    additionalSchemaIssues: candidate => {
      const questions = candidate.questions;
      if (!Array.isArray(questions) || questions.length !== count || candidate.question != null ||
          candidate.evidence != null) return [{ code: 'dialogue_question_count_invalid' }];
      return questions.flatMap((question, index) =>
        kind === 'comprehension' ? (!Array.isArray(question?.evidence) || !question.evidence.length
          ? [{ code: 'dialogue_question_evidence_required', questionIndex: index }] : []) :
          question?.evidence != null ? [{ code: 'transfer_evidence_not_supported', questionIndex: index }] : []);
    } });
  const current = await loadDialogueQuestionContext({ query }, req.params.id, body.sourceLessonId);
  if (current.dialogueFingerprint !== context.dialogueFingerprint) {
    result.status = 'stale';
    result.report = { ...result.report, status: 'version_conflict', valid: null,
      warnings: [{ code: 'dialogue_changed_during_generation' }] };
    result.decision = decideBoundaryAction({ mode: context.grammar.boundary_mode,
      operation: 'generate', report: result.report });
  }
  return groundedResponse(res, result, { questions: result.status === 'ready' ? result.candidate.questions : [],
    dialogueFingerprint: current.dialogueFingerprint });
}));

const boundaryField = (path, value) => ({ path, text: String(value ?? '') });
function boundaryFieldsFrom(path, value) {
  if (typeof value === 'string') return [boundaryField(path, value)];
  if (Array.isArray(value)) return value.flatMap((item, index) => boundaryFieldsFrom(`${path}[${index}]`, item));
  if (value && typeof value === 'object') return Object.entries(value)
    .flatMap(([key, item]) => boundaryFieldsFrom(`${path}.${key}`, item));
  return [];
}
export function dialogueVisibleFields(scene, furigana) {
  return [
    ...(scene?.participants || []).flatMap((participant, index) => [
      boundaryField(`dialogScene.participants[${index}].speaker`, participant.speaker),
      boundaryField(`dialogScene.participants[${index}].displayName`, participant.displayName),
    ]),
    ...(furigana?.lines || []).flatMap((line, index) => [
      boundaryField(`dialogFurigana.lines[${index}].speaker`, line.speaker),
      boundaryField(`dialogFurigana.lines[${index}].text`, line.text),
      ...(line.readings || []).map((reading, readingIndex) =>
        boundaryField(`dialogFurigana.lines[${index}].readings[${readingIndex}].reading`, reading.reading)),
    ]),
  ];
}
async function assertBatchLessonOwnership(client, moduleId, items) {
  const lessonIds = [...new Set(items.map(item => item?.lessonId).filter(Boolean))];
  if (!lessonIds.length) return;
  if (lessonIds.some(id => !isCanonicalUuid(id))) throw new BoundaryContextError('boundary_context_mismatch');
  const owned = await client.query('SELECT id FROM lessons WHERE module_id=$1 AND id=ANY($2::uuid[])',
    [moduleId, lessonIds]);
  if (owned.rows.length !== lessonIds.length) throw new BoundaryContextError('boundary_context_mismatch');
}
export async function assertQuizGrammarReachable(client, grammarId, lessonId) {
  if (!grammarId) return;
  const linked = await client.query(`WITH RECURSIVE reachable(course_id) AS (
      SELECT m.course_id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$2
      UNION
      SELECT p.prerequisite_course_id FROM course_prerequisites p
        JOIN reachable r ON r.course_id=p.course_id
    ) SELECT g.id FROM module_grammar g JOIN modules gm ON gm.id=g.module_id
      WHERE g.id=$1 AND gm.course_id IN (SELECT course_id FROM reachable)`, [grammarId, lessonId]);
  if (!linked.rows.length) throw new BoundaryContextError('grammar_lesson_owner_mismatch');
}
async function adminBoundaryWrite(res, options) {
  try { return await validateAndWriteContent(options); }
  catch (error) {
    const response = boundaryWriteHttpError(error);
    if (!response) {
      if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
        res.status(error.status).json({ error: error.message });
        return null;
      }
      throw error;
    }
    res.status(response.statusCode).json(response.body);
    return null;
  }
}

async function adminLockedMutation(res, loadCourseIds, mutate) {
  try {
    return await withTransaction(async client => {
      const initial = [...new Set(await loadCourseIds(client))].sort();
      if (!initial.length) return { missing: true };
      await lockCurriculumCourses(client, initial);
      const current = [...new Set(await loadCourseIds(client))].sort();
      if (JSON.stringify(initial) !== JSON.stringify(current)) {
        throw new BoundaryContextError('boundary_context_mismatch');
      }
      return { value: await mutate(client) };
    });
  } catch (error) {
    if (error instanceof BoundaryContextError) {
      res.status(422).json({ error: error.code || error.message });
      return null;
    }
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
      res.status(error.status).json({ error: error.message });
      return null;
    }
    throw error;
  }
}

// Global banks may be visible in any course. Until per-consumer validation is
// available, edit them only while every course is off, under the exclusive
// graph lock so a mode/topology change cannot race the check and write.
async function globalOffQuery(res, sql, params, { expectedGlobalKanjiId } = {}) {
  const result = await withTransaction(async client => {
    await lockCurriculumGraph(client, { exclusive: true });
    if (expectedGlobalKanjiId) {
      const current = await client.query('SELECT lesson_id FROM kanji_items WHERE id=$1 FOR UPDATE',
        [expectedGlobalKanjiId]);
      if (current.rows[0]?.lesson_id) return { scopeChanged: true };
    }
    const active = await client.query(`SELECT id FROM courses
      WHERE COALESCE(curriculum_boundary_mode,'off') <> 'off' LIMIT 1`);
    if (active.rows.length) return null;
    return client.query(sql, params);
  });
  if (result?.scopeChanged) res.status(409).json({ error: 'kanji_scope_changed' });
  else if (!result) res.status(409).json({ error: 'global_bank_requires_off_mode' });
  return result?.scopeChanged ? null : result;
}

const courseIdsForLesson = async (client, lessonId) => (await client.query(
  'SELECT DISTINCT m.course_id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$1',
  [lessonId])).rows.map(row => row.course_id);
const courseIdsForGrammar = async (client, grammarId) => (await client.query(
  'SELECT DISTINCT m.course_id FROM module_grammar g JOIN modules m ON m.id=g.module_id WHERE g.id=$1',
  [grammarId])).rows.map(row => row.course_id);
const courseIdsForVocabulary = async (client, vocabularyId) => (await client.query(
  'SELECT DISTINCT m.course_id FROM module_vocabulary v JOIN modules m ON m.id=v.module_id WHERE v.id=$1',
  [vocabularyId])).rows.map(row => row.course_id);
const courseIdsForVocabularyAndConsumers = async (client, vocabularyId) => (await client.query(`
  SELECT m.course_id FROM module_vocabulary v JOIN modules m ON m.id=v.module_id WHERE v.id=$1
  UNION SELECT m.course_id FROM lesson_deck_items di JOIN lessons l ON l.id=di.lesson_id
    JOIN modules m ON m.id=l.module_id WHERE di.vocabulary_id=$1`, [vocabularyId]))
  .rows.map(row => row.course_id);
const courseIdsForGrammarAndConsumers = async (client, grammarId) => (await client.query(`
  SELECT m.course_id FROM module_grammar g JOIN modules m ON m.id=g.module_id WHERE g.id=$1
  UNION SELECT m.course_id FROM lesson_grammar_task_items gi JOIN lessons l ON l.id=gi.lesson_id
    JOIN modules m ON m.id=l.module_id WHERE gi.grammar_id=$1
  UNION SELECT m.course_id FROM quiz_questions q JOIN lessons l ON l.id=q.lesson_id
    JOIN modules m ON m.id=l.module_id WHERE q.grammar_id=$1`, [grammarId]))
  .rows.map(row => row.course_id);
const courseIdsForBunpouPair = async (client, lessonId) => (await client.query(`
  SELECT m.course_id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$1
  UNION SELECT m.course_id FROM lessons task JOIN modules m ON m.id=task.module_id
    WHERE task.popup_after_lesson_id=$1 AND task.type='grammar_task'`, [lessonId]))
  .rows.map(row => row.course_id);

function kanjiBoundaryFields(row) {
  return [
    ...['character', 'on_reading', 'kun_reading', 'meaning_id', 'mnemonic', 'bab_kode']
      .map(name => boundaryField(`kanji.${name}`, row[name])),
    ...boundaryFieldsFrom('kanji.compounds', row.compounds),
  ];
}

async function kanjiWriteCandidate(client, id, proposed, targetLessonId, locked) {
  const old = id ? (await client.query(`SELECT * FROM kanji_items WHERE id=$1
    ${locked ? 'FOR UPDATE' : ''}`, [id])).rows[0] : null;
  if (id && !old) throw new BoundaryContextError('kanji_not_found');
  const lessonId = targetLessonId === undefined ? old?.lesson_id : targetLessonId;
  if (!lessonId) throw new BoundaryContextError('kanji_global_scope_unresolved');
  const sourceCourses = old?.lesson_id ? await courseIdsForLesson(client, old.lesson_id) : [];
  const merged = { ...old, ...proposed };
  return { scope: { lessonId }, relatedCourseIds: sourceCourses,
    contentType: 'kanji_compound_assessed', operation: 'live_write', contentId: id || null,
    fields: kanjiBoundaryFields(merged), currentRevision: old?.updated_at,
    expectedBoundaryFingerprint: proposed.boundaryFingerprint };
}

export async function kanjiUpsertCandidate(client, values, lessonId, hasCompounds, locked = false) {
  const existing = await client.query(`SELECT * FROM kanji_items
    WHERE character=$1 AND jlpt_level=$2 AND lesson_id=$3
    ${locked ? 'FOR UPDATE' : ''}`, [values.character, values.jlpt_level, lessonId]);
  const row = existing.rows[0] || null;
  const proposed = { ...values,
    compounds: hasCompounds ? values.compounds : row?.compounds || [],
  };
  const candidate = await kanjiWriteCandidate(client, row?.id || null, proposed, lessonId, locked);
  return { ...candidate, expectedRevision: values.expectedRevision,
    contentIsNewOrChanged: true };
}

export async function linkedContentCandidate(client, lessonId, ids, type, instructions = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const table = type === 'deck' ? 'module_vocabulary' : type === 'grammar' ? 'module_grammar' : 'kana_items';
  const key = type === 'deck' ? 'vocabulary' : type === 'grammar' ? 'grammar' : 'kana';
  const source = uniqueIds.length ? await client.query(type === 'kana'
    ? `SELECT k.* FROM kana_items k WHERE k.id=ANY($1::uuid[]) ORDER BY k.id`
    :
    `SELECT s.*,m.course_id FROM ${table} s JOIN modules m ON m.id=s.module_id
       WHERE s.id=ANY($1::uuid[]) ORDER BY s.id`, [uniqueIds]) : { rows: [] };
  if (source.rows.length !== uniqueIds.length) throw new BoundaryContextError(`${key}_owner_unresolved`);
  if (type !== 'kana' && source.rows.length) {
    if (type === 'deck') {
      const lesson = await client.query('SELECT module_id FROM lessons WHERE id=$1', [lessonId]);
      if (!lesson.rows.length || source.rows.some(row => row.module_id !== lesson.rows[0].module_id)) {
        throw new BoundaryContextError('vocabulary_deck_owner_mismatch');
      }
    }
    const reachable = await client.query(`WITH RECURSIVE courses(id) AS (
      SELECT m.course_id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$1
      UNION SELECT p.prerequisite_course_id FROM course_prerequisites p JOIN courses c ON c.id=p.course_id
    ) SELECT id FROM courses`, [lessonId]);
    const allowed = new Set(reachable.rows.map(row => row.id));
    if (source.rows.some(row => !allowed.has(row.course_id))) {
      throw new BoundaryContextError(`${key}_lesson_owner_mismatch`);
    }
  }
  const fields = source.rows.flatMap((row, index) => {
    if (type === 'grammar') return [
      ...['pattern', 'meaning', 'example', 'notes', 'example_dialog', 'example_dialog_id',
        'recognition_distractors', 'controlled_distractors', 'communication_goal']
        .map(name => boundaryField(`items[${index}].${name}`, row[name])),
      ...dialogueVisibleFields(row.dialog_scene, row.dialog_furigana)
        .map(field => ({ ...field, path: `items[${index}].${field.path}` })),
    ];
    if (type === 'kana') return ['character', 'romaji', 'mnemonic', 'group_label']
      .map(name => boundaryField(`items[${index}].${name}`, row[name]));
    return ['japanese', 'reading', 'romaji', 'indonesian', 'category', 'note']
      .map(name => boundaryField(`items[${index}].${name}`, row[name]));
  });
  if ((type === 'deck' || type === 'grammar') && uniqueIds.length) {
    const exampleTable = type === 'deck' ? 'vocabulary_examples' : 'grammar_examples';
    const ownerColumn = type === 'deck' ? 'vocabulary_id' : 'grammar_id';
    const readingColumn = type === 'deck' ? 'reading' : 'NULL::text AS reading';
    const examples = await client.query(`SELECT ${ownerColumn},japanese,${readingColumn},highlight,indonesian
      FROM ${exampleTable} WHERE ${ownerColumn}=ANY($1::uuid[])
      ORDER BY ${ownerColumn},sort_order,created_at,id`, [uniqueIds]);
    fields.push(...examples.rows.flatMap((row, index) =>
      ['japanese', 'reading', 'highlight', 'indonesian']
        .map(name => boundaryField(`${type}Examples[${index}].${name}`, row[name]))));
  }
  if (type === 'kana' && uniqueIds.length) {
    const examples = await client.query(`SELECT kana_id,japanese,reading,highlight,indonesian
      FROM kana_examples WHERE kana_id=ANY($1::uuid[]) ORDER BY kana_id,sort_order,created_at,id`, [uniqueIds]);
    fields.push(...examples.rows.flatMap((row, index) =>
      ['japanese', 'reading', 'highlight', 'indonesian']
        .map(name => boundaryField(`kanaExamples[${index}].${name}`, row[name]))));
  }
  fields.push(...instructions.map((value, index) => boundaryField(`items[${index}].instruction`, value)));
  return { scope: { lessonId }, contentType: type === 'deck' ? 'vocabulary_example' :
      type === 'grammar' ? 'grammar_example' : 'reading', operation: 'live_write', fields,
    relatedCourseIds: source.rows.map(row => row.course_id).filter(Boolean) };
}

// Bulk jobs persist per item. Keep every failure visible after earlier items
// have committed instead of returning an error that suggests zero writes.
async function bulkBoundaryWrite(options) {
  try { return { ok: true, outcome: await validateAndWriteContent(options) }; }
  catch (error) {
    const response = boundaryWriteHttpError(error);
    if (response) return { ok: false, status: response.statusCode,
      error: response.body.error, validation: response.body.validation };
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
      return { ok: false, status: error.status, error: error.message };
    }
    console.error('curriculum_bulk_item_failed', error);
    return { ok: false, status: 500, error: 'bulk_item_failed' };
  }
}

// ── YouTube video sources ────────────────────────────────────────────────
// Store an ID, never an embed URL. The same source can then be picked by many
// lessons, each with its own start/end range. This accepts the share, watch,
// embed, shorts, live, and youtu.be forms that creators commonly paste.
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function parseYouTubeSource(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (YOUTUBE_VIDEO_ID_RE.test(raw)) {
    return { externalId: raw, sourceUrl: `https://www.youtube.com/watch?v=${raw}` };
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  let externalId = '';

  if (host === 'youtu.be') {
    externalId = parts[0] || '';
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') ||
             host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    if (url.pathname === '/watch') externalId = url.searchParams.get('v') || '';
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) externalId = parts[1] || '';
  }

  if (!YOUTUBE_VIDEO_ID_RE.test(externalId)) return null;
  return {
    externalId,
    sourceUrl: `https://www.youtube.com/watch?v=${externalId}`,
  };
}

function normalizeSegment(sourceIdValue, startValue, endValue) {
  const sourceId = String(sourceIdValue || '').trim() || null;
  const hasStart = startValue !== undefined && startValue !== null && startValue !== '';
  const hasEnd = endValue !== undefined && endValue !== null && endValue !== '';
  if (!sourceId) {
    if (hasStart || hasEnd) return { error: 'Pilih sumber YouTube untuk memakai rentang waktu video.' };
    return { videoSourceId: null, videoStartSeconds: null, videoEndSeconds: null };
  }

  const start = hasStart ? Number(startValue) : 0;
  const end = hasEnd ? Number(endValue) : null;
  if (!Number.isInteger(start) || start < 0) {
    return { error: 'Waktu mulai video harus berupa detik bulat positif atau nol.' };
  }
  if (!Number.isInteger(end) || end <= start) {
    return { error: 'Waktu selesai video harus lebih besar dari waktu mulai.' };
  }
  return { videoSourceId: sourceId, videoStartSeconds: start, videoEndSeconds: end };
}

function supportsVideoSegment(type) {
  return type === 'video' || type === 'kana';
}

// GET /api/admin/video-sources — source picker for reusable YouTube videos.
router.get('/video-sources', asyncHandler(async (_req, res) => {
  const sources = await query(
    `SELECT vs.id, vs.provider, vs.external_id, vs.source_url, vs.title,
            vs.duration_seconds, vs.created_at, vs.updated_at,
            COUNT(l.id)::int AS lesson_count
       FROM video_sources vs
       LEFT JOIN lessons l ON l.video_source_id = vs.id
      GROUP BY vs.id
      ORDER BY vs.updated_at DESC, vs.created_at DESC`
  );
  res.json({ sources: sources.rows });
}));

// POST /api/admin/video-sources — creates (or reuses) a canonical YouTube
// source. No YouTube Data API key is needed just to embed a known video.
router.post('/video-sources', asyncHandler(async (req, res) => {
  const parsed = parseYouTubeSource(req.body?.youtubeUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'URL YouTube tidak valid. Tempel URL watch, share, embed, shorts, atau ID video.' });
  }
  const title = String(req.body?.title || '').trim().slice(0, 240) || null;
  const created = await query(
    `INSERT INTO video_sources (provider, external_id, source_url, title)
     VALUES ('youtube', $1, $2, $3)
     ON CONFLICT (provider, external_id) DO UPDATE
       SET source_url = EXCLUDED.source_url,
           title = COALESCE(EXCLUDED.title, video_sources.title),
           updated_at = NOW()
     RETURNING *`,
    [parsed.externalId, parsed.sourceUrl, title]
  );
  res.status(201).json({ source: created.rows[0], reused: created.rows[0].created_at !== created.rows[0].updated_at });
}));

// POST /api/admin/set-password — admin meng-set/ubah password (self-service).
// Tanpa `email` → set password milik admin yang sedang login. Dengan `email`
// (provisioning co-admin) → email itu WAJIB sudah admin (env ADMIN_EMAILS
// atau tabel admin_emails — tambah dulu via Kelola Admin). Ini hanya
// menambah cara login email+password, bukan pemberian akses.
router.post('/set-password', asyncHandler(async (req, res) => {
  const password = String(req.body?.password || '');
  const targetEmailRaw = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const email = targetEmailRaw || String(req.user.email || '').toLowerCase();

  if (password.length < 10) {
    return res.status(400).json({ error: 'weak_password', detail: 'Password minimal 10 karakter.' });
  }
  if (targetEmailRaw && !(await isAdminEmail(targetEmailRaw))) {
    return res.status(400).json({ error: 'not_admin_email', detail: 'Email itu bukan admin — tambahkan dulu lewat Kelola Admin.' });
  }

  const hash = await bcrypt.hash(password, 12);
  // UPSERT: kalau row email sudah ada → update password_hash; kalau belum ada
  // (admin password-only yang belum pernah login Google) → insert row minimal.
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rows.length > 0) {
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, existing.rows[0].id]);
  } else {
    const fallbackName = email.split('@')[0] || 'Admin';
    const ins = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      [email, hash, fallbackName]
    );
    await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [ins.rows[0].id]);
  }
  res.json({ ok: true, email });
}));

// ── Kelola admin (tabel admin_emails, migration 035) ──────────────────────
// Admin env (ADMIN_EMAILS) read-only dari UI — bootstrap anti-lockout.
// Admin DB bisa ditambah/dihapus tanpa edit .env + restart.

// GET /api/admin/admins — gabungan env + DB
router.get('/admins', asyncHandler(async (req, res) => {
  const envSet = new Set(listEnvAdminEmails());
  const result = await query(
    'SELECT email, added_by, created_at FROM admin_emails ORDER BY created_at ASC'
  );
  const admins = [
    ...[...envSet].map((email) => ({ email, source: 'env' })),
    ...result.rows
      .filter((r) => !envSet.has(String(r.email).toLowerCase()))
      .map((r) => ({
        email: r.email,
        source: 'db',
        addedBy: r.added_by,
        createdAt: r.created_at,
      })),
  ];
  res.json({ admins });
}));

// POST /api/admin/admins — tambah admin baru { email }
router.post('/admins', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email', detail: 'Format email tidak valid.' });
  }
  if (isEnvAdminEmail(email)) {
    return res.json({ ok: true, email, source: 'env', detail: 'Email sudah admin (via .env).' });
  }
  await query(
    `INSERT INTO admin_emails (email, added_by) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, String(req.user.email || '').toLowerCase()]
  );
  invalidateAdminEmailCache();
  res.json({ ok: true, email, source: 'db' });
}));

// DELETE /api/admin/admins/:email — cabut akses admin DB
router.delete('/admins/:email', asyncHandler(async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (isEnvAdminEmail(email)) {
    return res.status(400).json({ error: 'env_admin', detail: 'Admin bootstrap (.env) tidak bisa dihapus dari sini.' });
  }
  if (email === String(req.user.email || '').toLowerCase()) {
    return res.status(400).json({ error: 'cannot_remove_self', detail: 'Tidak bisa menghapus akses sendiri.' });
  }
  await query('DELETE FROM admin_emails WHERE email = $1', [email]);
  invalidateAdminEmailCache();
  res.json({ ok: true });
}));

// Notion import endpoints hit external API + heavy DB writes; cap at
// 5/min per admin IP supaya spam ga habisin Notion quota (3 req/s
// upstream limit). Aplikasi ke import-notion-deck, import-notion-pelajaran,
// import-notion-kanji-bab.
const notionImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_imports', detail: 'Tunggu 1 menit sebelum import lagi.' },
});

// Generic Notion error response — internal error message di-log ke
// server, tapi response ke client cuma generic. Sebelumnya
// `err.message` bocorin "Unauthorized" / "Invalid database" / request
// ID yang nge-disclose state integration ke client (info leak).
function notionErrorResponse(res, err, fallback = 'Sumber Notion tidak bisa diakses.') {
  console.error('[notion-import]', err?.notionStatus || '', err?.message || err);
  return res.status(502).json({
    error: 'notion_error',
    status: err?.notionStatus || 0,
    detail: fallback,
  });
}

// Mirror of the config in routes/uploads.js. Kept here so DELETE handlers
// can map a stored photo_url back to a filesystem path and unlink the file.
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/eznihongo/uploads';
const UPLOAD_PUBLIC_BASE = process.env.UPLOAD_PUBLIC_BASE || '/uploads';

// Unlink an uploaded photo from disk when its row is deleted. Ignores files
// we didn't manage (external URLs), and tolerates ENOENT (file already gone).
// path.basename strips any `..` shenanigans so we can't escape UPLOAD_DIR
// even if photo_url in DB was tampered with.
async function unlinkUploadByUrl(url) {
  if (!url || typeof url !== 'string') return;
  if (!url.startsWith(UPLOAD_PUBLIC_BASE + '/')) return;
  const filename = path.basename(url);
  if (!filename || filename === '.' || filename === '..') return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('unlinkUploadByUrl failed:', filePath, err.code || err.message);
    }
  }
}

// Slug: lowercase letters, digits, hyphens — no leading/trailing/double hyphens.
// Must match the client-side SLUG_REGEX in admin.html.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function badSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_REGEX.test(slug)) {
    return 'slug must be lowercase letters/digits/hyphens (e.g. "n5-dasar")';
  }
  return null;
}

// ===== COURSES =====

router.get('/courses', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM courses ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ courses: result.rows });
}));

// Owner-only mode control. A mode revision is rechecked after the same graph
// and course locks as content writers; enforce promotion remains closed until
// a trustworthy server-owned readiness evidence registry exists.
router.get('/courses/:id/curriculum-boundary-mode', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await getCurriculumBoundaryMode(req.params.id)); }
  catch (error) {
    if (!(error instanceof CurriculumModeError)) throw error;
    res.status(error.status).json({ error: error.code });
  }
}));

router.put('/courses/:id/curriculum-boundary-mode', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await saveCurriculumBoundaryMode(req.params.id, req.body)); }
  catch (error) {
    if (!(error instanceof CurriculumModeError)) throw error;
    res.status(error.status).json({ error: error.code });
  }
}));

// Passive owner attestations are never an enforce authorization. The service
// records current server observations and marks all captured claims unverified.
router.get('/courses/:id/readiness-attestations', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await listReadinessAttestations(req.params.id, req.query.moduleId)); }
  catch (error) {
    if (!(error instanceof CurriculumModeError)) throw error;
    res.status(error.status).json({ error: error.code });
  }
}));

router.post('/courses/:id/readiness-attestations', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.status(201).json(await captureReadinessAttestation(req.params.id,
    req.user.id, req.body)); }
  catch (error) {
    if (!(error instanceof CurriculumModeError)) throw error;
    res.status(error.status).json({ error: error.code });
  }
}));

// Read-only curriculum inspector. It remains owner-only in the explicit
// company route policy because it exposes cross-course provenance and
// readiness diagnostics rather than learner-facing content.
router.get('/curriculum-boundary', asyncHandler(async (req, res) => {
  const keys = ['courseId', 'moduleId', 'lessonId', 'grammarId'];
  const scope = Object.fromEntries(keys.filter(key => req.query[key] != null && req.query[key] !== '')
    .map(key => [key, req.query[key]]));
  if (!scope.moduleId && !scope.lessonId && !scope.grammarId) {
    return res.status(400).json({ error: 'moduleId, lessonId, or grammarId required' });
  }
  const invalid = keys.find(key => scope[key] != null && !isCanonicalUuid(scope[key]));
  if (invalid) return res.status(400).json({ error: `invalid_${invalid}` });
  try {
    const boundary = await getCurriculumBoundary(scope);
    res.set('Cache-Control', 'private, no-store');
    return res.json(boundary);
  } catch (error) {
    if (!(error instanceof BoundaryContextError)) throw error;
    const status = error.code.endsWith('_not_found') ? 404 : 400;
    return res.status(status).json({ error: error.code, details: error.details });
  }
}));

// Editor preview is informative only; every later save resolves and validates
// again in its write transaction. The existing owner-only route policy does
// not grant this new endpoint to company staff by default.
router.post('/curriculum-boundary/validate', asyncHandler(async (req, res) => {
  const input = req.body || {};
  const keys = ['courseId', 'moduleId', 'lessonId', 'grammarId'];
  const scope = Object.fromEntries(keys.filter(key => input.scope?.[key] != null && input.scope[key] !== '')
    .map(key => [key, input.scope[key]]));
  const invalid = keys.find(key => scope[key] != null && !isCanonicalUuid(scope[key]));
  if (invalid || (!scope.moduleId && !scope.lessonId && !scope.grammarId)) {
    return res.status(400).json({ error: invalid ? `invalid_${invalid}` : 'boundary_leaf_context_required' });
  }
  const operation = input.operation || 'live_write';
  try {
    const boundary = await getCurriculumBoundary(scope);
    const report = validateContentAgainstBoundary({ boundary, contentType: input.contentType,
      operation, fields: input.fields, communicationGoal: input.communicationGoal,
      contentIsNewOrChanged: true });
    const decision = decideBoundaryAction({ mode: boundary.course.mode, operation, report });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ report, decision, boundaryFingerprint: boundary.boundaryFingerprint });
  } catch (error) {
    if (!(error instanceof BoundaryContextError)) throw error;
    return res.status(error.code.endsWith('_not_found') ? 404 : 400).json({ error: error.code, details: error.details });
  }
}));

router.post('/courses', asyncHandler(async (req, res) => {
  const {
    slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured, isFree,
  } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' });
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const landing = landingCourseFields(req.body, true);
  if (landing.error) return res.status(400).json({ error: landing.error });
  // isFree is tri-state (true/false/null = "not yet classified") — pass
  // through as-is rather than coercing with !!, which would collapse
  // "unclassified" into "paid". See migration 121.
  const result = await withTransaction(async client => {
    await lockCurriculumGraph(client, { exclusive: true });
    return client.query(
    `INSERT INTO courses
       (slug, title, description, level, thumbnail_url, sort_order, is_published, is_available,
        price_idr, price_label, period_label, tagline, features, cta_label, is_featured, is_free, landing_price_published, landing_schedule)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
      slug, title, description || null, level || null, thumbnailUrl || null,
      sortOrder || 0, !!isPublished, isAvailable !== false,
      priceIdr || null, priceLabel || null, periodLabel || null, tagline || null,
      JSON.stringify(Array.isArray(features) ? features : []),
      ctaLabel || null, !!isFeatured,
      isFree === true ? true : (isFree === false ? false : null),
      landing.pricePublished, landing.schedule,
    ]
    );
  });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.status(201).json({ course: result.rows[0] });
}));

router.put('/courses/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured, isFree,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  // isFree: only overwrite when the client explicitly sent true/false.
  // Omitted (undefined) keeps the existing value — it never collapses to
  // NULL/paid just because a caller didn't include the field.
  const isFreeExplicit = isFree === true || isFree === false;
  const landing = landingCourseFields(req.body);
  if (landing.error) return res.status(400).json({ error: landing.error });
  const result = await withTransaction(async client => {
    await lockCurriculumCourse(client, req.params.id);
    return client.query(
    `UPDATE courses SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       level = COALESCE($5, level),
       thumbnail_url = COALESCE($6, thumbnail_url),
       sort_order = COALESCE($7, sort_order),
       is_published = COALESCE($8, is_published),
       is_available = COALESCE($9, is_available),
       price_idr = COALESCE($10, price_idr),
       price_label = COALESCE($11, price_label),
       period_label = COALESCE($12, period_label),
       tagline = COALESCE($13, tagline),
       features = COALESCE($14::jsonb, features),
       cta_label = COALESCE($15, cta_label),
       is_featured = COALESCE($16, is_featured),
       is_free = CASE WHEN $17 THEN $18::boolean ELSE is_free END,
       landing_price_published = COALESCE($19::boolean, landing_price_published),
       landing_schedule = COALESCE($20, landing_schedule),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
      priceIdr, priceLabel, periodLabel, tagline,
      Array.isArray(features) ? JSON.stringify(features) : null,
      ctaLabel, isFeatured,
      isFreeExplicit, isFreeExplicit ? isFree : null,
      landing.pricePublished, landing.schedule,
    ]
    );
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.json({ course: result.rows[0] });
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  // Block delete when any student has enrolled — keeps paid users from losing access silently.
  // Admins can still set the course to draft/coming_soon via PUT instead.
  const n = await withTransaction(async client => {
    await lockCurriculumGraph(client, { exclusive: true });
    await lockCurriculumCourse(client, req.params.id);
    const enroll = await client.query('SELECT COUNT(*)::int AS n FROM user_enrollments WHERE course_id=$1', [req.params.id]);
    const count = enroll.rows[0]?.n || 0;
    if (!count) await client.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
    return count;
  });
  if (n > 0) {
    return res.status(409).json({
      error: `Tidak bisa hapus: ${n} siswa sudah terdaftar di kursus ini. Ubah status ke Draft supaya tidak tampil di landing.`,
      enrollmentCount: n,
    });
  }
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// ===== MODULES =====

router.get('/modules/:id', asyncHandler(async (req, res) => {
  const m = await query(`SELECT * FROM modules WHERE id = $1`, [req.params.id]);
  if (m.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const [lessons, vocab, grammar] = await Promise.all([
    query(`SELECT id, slug, title, type, sort_order, duration_minutes
           FROM lessons WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
    query(`SELECT * FROM module_vocabulary WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
    query(`SELECT * FROM module_grammar WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
  ]);
  res.json({
    module: { ...m.rows[0], lessons: lessons.rows, vocabulary: vocab.rows, grammar: grammar.rows },
  });
}));

router.post('/modules', asyncHandler(async (req, res) => {
  const {
    courseId, slug, title, description, sortOrder,
    jfTopic, cefrLevel, titleEn, scenario, sectionName,
    candoStatements, skillDistribution, quizSpec,
  } = req.body || {};
  if (!courseId || !slug || !title) {
    return res.status(400).json({ error: 'courseId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await withTransaction(async client => {
    await lockCurriculumCourse(client, courseId);
    return client.query(
    `INSERT INTO modules (
       course_id, slug, title, description, sort_order,
       jf_topic, cefr_level, title_en, scenario, section_name,
       cando_statements, skill_distribution, quiz_spec
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)
     RETURNING *`,
    [
      courseId, slug, title, description || null, sortOrder || 0,
      jfTopic || null, cefrLevel || null, titleEn || null, scenario || null,
      (sectionName && String(sectionName).trim()) || null,
      JSON.stringify(Array.isArray(candoStatements) ? candoStatements : []),
      JSON.stringify(typeof skillDistribution === 'object' && skillDistribution ? skillDistribution : {}),
      JSON.stringify(typeof quizSpec === 'object' && quizSpec ? quizSpec : {}),
    ]
    );
  });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.status(201).json({ module: result.rows[0] });
}));

router.put('/modules/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, description, sortOrder,
    jfTopic, cefrLevel, titleEn, scenario, sectionName,
    candoStatements, skillDistribution, quizSpec,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  // sectionName is special-cased: an empty string means "unset" so admin can
  // clear the value, whereas `undefined` keeps the current value.
  const hasSection = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionName');
  const sectionNorm = hasSection ? ((sectionName && String(sectionName).trim()) || null) : null;
  const result = await withTransaction(async client => {
    const owner = await client.query('SELECT course_id FROM modules WHERE id=$1', [req.params.id]);
    if (!owner.rows.length) return { rows: [] };
    await lockCurriculumCourse(client, owner.rows[0].course_id);
    return client.query(
    `UPDATE modules SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       sort_order = COALESCE($5, sort_order),
       jf_topic = COALESCE($6, jf_topic),
       cefr_level = COALESCE($7, cefr_level),
       title_en = COALESCE($8, title_en),
       scenario = COALESCE($9, scenario),
       section_name = CASE WHEN $13::boolean THEN $10 ELSE section_name END,
       cando_statements = COALESCE($11::jsonb, cando_statements),
       skill_distribution = COALESCE($12::jsonb, skill_distribution),
       quiz_spec = COALESCE($14::jsonb, quiz_spec),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, sortOrder,
      jfTopic, cefrLevel, titleEn, scenario, sectionNorm,
      Array.isArray(candoStatements) ? JSON.stringify(candoStatements) : null,
      skillDistribution && typeof skillDistribution === 'object' ? JSON.stringify(skillDistribution) : null,
      hasSection,
      quizSpec && typeof quizSpec === 'object' ? JSON.stringify(quizSpec) : null,
    ]
    );
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.json({ module: result.rows[0] });
}));

router.delete('/modules/:id', asyncHandler(async (req, res) => {
  await withTransaction(async client => {
    const owner = await client.query('SELECT course_id FROM modules WHERE id=$1', [req.params.id]);
    if (!owner.rows.length) return;
    await lockCurriculumCourse(client, owner.rows[0].course_id);
    await client.query('DELETE FROM modules WHERE id=$1', [req.params.id]);
  });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// ===== MODULE VOCABULARY =====

router.get('/module-vocabulary', asyncHandler(async (req, res) => {
  const { moduleId, lessonId } = req.query;
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });
  const params = [moduleId];
  let where = 'module_id = $1';
  if (lessonId) { where += ' AND lesson_id = $2'; params.push(lessonId); }
  const rows = await query(
    `SELECT * FROM module_vocabulary WHERE ${where} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  res.json({ vocabulary: rows.rows });
}));

router.post('/module-vocabulary', asyncHandler(async (req, res) => {
  const { moduleId, lessonId, japanese, reading, romaji, indonesian, category, note, sortOrder } = req.body || {};
  if (!moduleId || !japanese) return res.status(400).json({ error: 'moduleId and japanese required' });
  const outcome = await adminBoundaryWrite(res, {
    prepare: async () => ({ scope: { moduleId, lessonId: lessonId || undefined },
      contentType: 'vocabulary_example', operation: 'live_write',
      fields: [boundaryField('japanese', japanese), boundaryField('reading', reading),
        boundaryField('romaji', romaji), boundaryField('indonesian', indonesian),
        boundaryField('category', category), boundaryField('note', note)],
      expectedBoundaryFingerprint: req.body?.boundaryFingerprint }),
    write: async client => (await client.query(
      `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [moduleId, lessonId || null, japanese, reading || null, romaji || null, indonesian || null,
        category || null, note || null, sortOrder || 0])).rows[0],
  });
  if (!outcome) return;
  invalidateCourseVocabCache();
  res.status(201).json({ vocabulary: outcome.value, validation: outcome.report });
}));

router.put('/module-vocabulary/:id', asyncHandler(async (req, res) => {
  const { lessonId, japanese, reading, romaji, indonesian, category, note, sortOrder } = req.body || {};
  // lessonId is special: allow explicit null to unassign. Use has-own-property semantics.
  const hasLesson = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const outcome = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = await client.query(`SELECT * FROM module_vocabulary WHERE id=$1 ${locked ? 'FOR UPDATE' : ''}`, [req.params.id]);
      if (!old.rows.length) throw new BoundaryContextError('vocabulary_owner_unresolved');
      const row = old.rows[0];
      return { scope: { moduleId: row.module_id, lessonId: hasLesson ? lessonId || undefined : row.lesson_id || undefined },
        contentType: 'vocabulary_example', contentId: row.id, operation: 'live_write',
        fields: [boundaryField('japanese', japanese ?? row.japanese), boundaryField('reading', reading ?? row.reading),
          boundaryField('romaji', romaji ?? row.romaji), boundaryField('indonesian', indonesian ?? row.indonesian),
          boundaryField('category', category ?? row.category), boundaryField('note', note ?? row.note)],
        contentIsNewOrChanged: [japanese, reading, romaji, indonesian, category, note].some(value => value != null),
        expectedRevision: req.body?.expectedRevision, currentRevision: row.updated_at,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE module_vocabulary SET
       lesson_id = CASE WHEN $10::boolean THEN $2 ELSE lesson_id END,
       japanese = COALESCE($3, japanese),
       reading = COALESCE($4, reading),
       romaji = COALESCE($5, romaji),
       indonesian = COALESCE($6, indonesian),
       category = COALESCE($7, category),
       note = COALESCE($8, note),
       sort_order = COALESCE($9, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, lessonId || null, japanese, reading, romaji, indonesian, category, note, sortOrder, hasLesson]
    )).rows[0],
  });
  if (!outcome) return;
  invalidateCourseVocabCache();
  res.json({ vocabulary: outcome.value, validation: outcome.report });
}));

router.delete('/module-vocabulary/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, client => courseIdsForVocabularyAndConsumers(client, req.params.id),
    client => client.query('DELETE FROM module_vocabulary WHERE id=$1', [req.params.id]));
  if (!result) return;
  invalidateCourseVocabCache();
  res.json({ ok: true });
}));

router.post('/module-vocabulary/bulk', asyncHandler(async (req, res) => {
  const { moduleId, items, replace } = req.body || {};
  if (!moduleId || !Array.isArray(items)) return res.status(400).json({ error: 'moduleId and items[] required' });
  // replace=true DELETEs the whole module first; without a transaction a crash
  // mid-insert leaves the module emptied or half-populated.
  const outcome = await adminBoundaryWrite(res, {
    prepare: async client => {
      await assertBatchLessonOwnership(client, moduleId, items);
      return { scope: { moduleId }, contentType: 'vocabulary_example', operation: 'live_write',
      fields: items.flatMap((v, index) => ['japanese', 'reading', 'romaji', 'indonesian', 'category', 'note']
        .map(key => boundaryField(`items[${index}].${key}`, v?.[key]))),
      expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => {
      if (replace) await client.query(`DELETE FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const v = items[i] || {};
        if (!v.japanese) continue;
        const r = await client.query(
          `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [moduleId, v.lessonId || null, v.japanese, v.reading || null, v.romaji || null, v.indonesian || null,
            v.category || null, v.note || null, v.sortOrder ?? i]);
        out.push(r.rows[0]);
      }
      return out;
    },
  });
  if (!outcome) return;
  invalidateCourseVocabCache();
  res.status(201).json({ vocabulary: outcome.value, validation: outcome.report });
}));

// ===== VOCAB BANK PICKER (for deck lessons) =====
// All vocab items, searchable, optionally scoped to a course. Used by the deck
// editor's "tambah dari bank" picker.
router.get('/vocab-bank', asyncHandler(async (req, res) => {
  const { courseId, q } = req.query;
  const params = [];
  const where = [];
  if (courseId) {
    params.push(courseId);
    where.push(`v.module_id IN (SELECT id FROM modules WHERE course_id = $${params.length})`);
  }
  if (q && String(q).trim()) {
    params.push('%' + String(q).trim() + '%');
    const p = `$${params.length}`;
    where.push(`(v.japanese ILIKE ${p} OR v.reading ILIKE ${p} OR v.romaji ILIKE ${p} OR v.indonesian ILIKE ${p})`);
  }
  const rows = await query(
    `SELECT v.id, v.module_id, v.japanese, v.reading, v.romaji, v.indonesian, v.category,
            m.title AS module_title,
            (SELECT COUNT(*)::int FROM vocabulary_examples e WHERE e.vocabulary_id = v.id) AS example_count
     FROM module_vocabulary v JOIN modules m ON m.id = v.module_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY v.japanese ASC LIMIT 200`,
    params
  );
  res.json({ vocabulary: rows.rows });
}));

// ===== VOCABULARY EXAMPLE SENTENCES =====

router.get('/vocabulary-examples', asyncHandler(async (req, res) => {
  const { vocabularyId } = req.query;
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  const rows = await query(
    `SELECT * FROM vocabulary_examples WHERE vocabulary_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [vocabularyId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/vocabulary-examples', asyncHandler(async (req, res) => {
  const { vocabularyId, japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  if (!vocabularyId || !japanese) return res.status(400).json({ error: 'vocabularyId and japanese required' });
  const outcome = await adminBoundaryWrite(res, {
    prepare: async client => {
      const owner = await client.query('SELECT module_id,lesson_id FROM module_vocabulary WHERE id=$1', [vocabularyId]);
      if (!owner.rows.length) throw new BoundaryContextError('vocabulary_owner_unresolved');
      return { scope: { moduleId: owner.rows[0].module_id, lessonId: owner.rows[0].lesson_id || undefined },
        contentType: 'vocabulary_example', operation: 'live_write',
        fields: [boundaryField('japanese', japanese), boundaryField('reading', reading),
          boundaryField('highlight', highlight), boundaryField('indonesian', indonesian)],
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
      `INSERT INTO vocabulary_examples (vocabulary_id, japanese, reading, highlight, indonesian, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [vocabularyId, japanese, reading || null, highlight || null, indonesian || null, sortOrder || 0])).rows[0],
  });
  if (!outcome) return;
  const row = outcome.value;
  invalidateCourseVocabCache();
  const warnings = await safeLearningWarnings(() => vocabularyExampleLearningScopeWarnings(row.id));
  res.status(201).json({ example: row, warnings, validation: outcome.report });
}));

router.put('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  const hasHighlight = Object.prototype.hasOwnProperty.call(req.body || {}, 'highlight');
  const hasReading = Object.prototype.hasOwnProperty.call(req.body || {}, 'reading');
  const outcome = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = await client.query(`SELECT e.*,v.module_id,v.lesson_id FROM vocabulary_examples e
        JOIN module_vocabulary v ON v.id=e.vocabulary_id WHERE e.id=$1 ${locked ? 'FOR UPDATE OF e' : ''}`, [req.params.id]);
      if (!old.rows.length) throw new BoundaryContextError('vocabulary_owner_unresolved');
      const row = old.rows[0];
      return { scope: { moduleId: row.module_id, lessonId: row.lesson_id || undefined }, contentType: 'vocabulary_example',
        contentId: row.id, operation: 'live_write',
        fields: [boundaryField('japanese', japanese ?? row.japanese),
          boundaryField('reading', hasReading ? reading : row.reading),
          boundaryField('highlight', hasHighlight ? highlight : row.highlight),
          boundaryField('indonesian', indonesian ?? row.indonesian)],
        contentIsNewOrChanged: japanese != null || hasReading || hasHighlight || indonesian != null,
        expectedRevision: req.body?.expectedRevision, currentRevision: row.updated_at,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE vocabulary_examples SET
       japanese = COALESCE($2, japanese),
       reading = CASE WHEN $7::boolean THEN $8 ELSE reading END,
       highlight = CASE WHEN $5::boolean THEN $3 ELSE highlight END,
       indonesian = COALESCE($4, indonesian),
       sort_order = COALESCE($6, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, highlight || null, indonesian, hasHighlight, sortOrder, hasReading, reading || null]
    )).rows[0],
  });
  if (!outcome) return;
  invalidateCourseVocabCache();
  const warnings = await safeLearningWarnings(() => vocabularyExampleLearningScopeWarnings(outcome.value.id));
  res.json({ example: outcome.value, warnings, validation: outcome.report });
}));

router.delete('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, async client => {
    const example = await client.query('SELECT vocabulary_id FROM vocabulary_examples WHERE id=$1', [req.params.id]);
    return example.rows.length ? courseIdsForVocabularyAndConsumers(client, example.rows[0].vocabulary_id) : [];
  },
  client => client.query('DELETE FROM vocabulary_examples WHERE id=$1', [req.params.id]));
  if (!result) return;
  invalidateCourseVocabCache();
  res.json({ ok: true });
}));

// ===== DECK ITEMS (vocab picked into a 'deck' lesson) =====

router.get('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT di.lesson_id, di.vocabulary_id, di.sort_order, di.accent_color,
            v.japanese, v.reading, v.romaji, v.indonesian, v.category, v.module_id,
            (SELECT COUNT(*)::int FROM vocabulary_examples e WHERE e.vocabulary_id = v.id) AS example_count
     FROM lesson_deck_items di JOIN module_vocabulary v ON v.id = di.vocabulary_id
     WHERE di.lesson_id = $1
     ORDER BY di.sort_order ASC, v.japanese ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.post('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const { vocabularyId, sortOrder, accentColor } = req.body || {};
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  const guarded = await adminBoundaryWrite(res, {
    prepare: client => linkedContentCandidate(client, req.params.lessonId, [vocabularyId], 'deck'),
    write: async client => (await client.query(
    `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (lesson_id, vocabulary_id)
       DO UPDATE SET sort_order = EXCLUDED.sort_order, accent_color = EXCLUDED.accent_color
     RETURNING *`,
    [req.params.lessonId, vocabularyId, sortOrder ?? 0, accentColor || null]
    )).rows[0],
  });
  if (!guarded) return;
  res.status(201).json({ item: guarded.value, validation: guarded.report });
}));

router.put('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  // Whole reorder/upsert applied atomically — a partial failure must not leave
  // the deck with a mix of old and new sort orders.
  const guarded = await adminBoundaryWrite(res, {
    prepare: client => linkedContentCandidate(client, req.params.lessonId,
      items.map(item => item?.vocabularyId), 'deck'),
    write: async client => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.vocabularyId) continue;
      await client.query(
        `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (lesson_id, vocabulary_id)
           DO UPDATE SET sort_order = EXCLUDED.sort_order, accent_color = EXCLUDED.accent_color`,
        [req.params.lessonId, it.vocabularyId, it.sortOrder ?? i, it.accentColor || null]
      );
    }
    return { ok: true };
    },
  });
  if (!guarded) return;
  res.json({ ok: true, validation: guarded.report });
}));

router.delete('/lessons/:lessonId/deck-items/:vocabularyId', asyncHandler(async (req, res) => {
  const guarded = await adminLockedMutation(res, async client => [
    ...await courseIdsForLesson(client, req.params.lessonId),
    ...await courseIdsForVocabulary(client, req.params.vocabularyId),
  ], client => client.query(
    `DELETE FROM lesson_deck_items WHERE lesson_id = $1 AND vocabulary_id = $2`,
    [req.params.lessonId, req.params.vocabularyId]
  ));
  if (!guarded) return;
  res.json({ ok: true });
}));

// ===== KANA (hiragana/katakana) =====
// Source of truth = tabel kana_items (bank global). Admin "Kelola Kana"
// (mirror "Kelola Deck") memilih karakter ke pelajaran 'kana' via
// lesson_kana_items, edit mnemonic + contoh kata. Mirror pola deck/vocab.

const KANA_VARIANTS = ['base', 'dakuten', 'handakuten', 'youon', 'special'];

// Bank picker — semua karakter, searchable, optional filter kind.
router.get('/kana-bank', asyncHandler(async (req, res) => {
  const { kind, q } = req.query;
  const params = [];
  const where = [];
  if (kind === 'hiragana' || kind === 'katakana') {
    params.push(kind);
    where.push(`kind = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push('%' + String(q).trim() + '%');
    const p = `$${params.length}`;
    where.push(`(character ILIKE ${p} OR romaji ILIKE ${p} OR group_label ILIKE ${p})`);
  }
  const rows = await query(
    `SELECT k.id, k.character, k.kind, k.romaji, k.mnemonic, k.group_label, k.variant_type, k.sort_order,
            (SELECT COUNT(*)::int FROM kana_examples e WHERE e.kana_id = k.id) AS example_count
     FROM kana_items k
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY k.kind ASC, k.sort_order ASC LIMIT 400`,
    params
  );
  res.json({ kana: rows.rows });
}));

router.post('/kana', asyncHandler(async (req, res) => {
  const { character, kind, romaji, mnemonic, groupLabel, variantType, sortOrder } = req.body || {};
  const ch = String(character || '').trim();
  if (!ch) return res.status(400).json({ error: 'character required' });
  const kd = kind === 'katakana' ? 'katakana' : 'hiragana';
  const variant = KANA_VARIANTS.includes(variantType) ? variantType : 'base';
  const result = await globalOffQuery(res,
    `INSERT INTO kana_items (character, kind, romaji, mnemonic, group_label, variant_type, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (kind, character) DO UPDATE SET
       romaji = EXCLUDED.romaji, mnemonic = EXCLUDED.mnemonic,
       group_label = EXCLUDED.group_label, variant_type = EXCLUDED.variant_type,
       sort_order = EXCLUDED.sort_order, updated_at = NOW()
     RETURNING *`,
    [ch, kd, String(romaji || '').trim() || ch, (mnemonic && String(mnemonic).trim()) || null,
     (groupLabel && String(groupLabel).trim()) || null, variant, Number(sortOrder) || 0]
  );
  if (!result) return;
  res.status(201).json({ kana: result.rows[0] });
}));

router.put('/kana/:id', asyncHandler(async (req, res) => {
  const { character, kind, romaji, mnemonic, groupLabel, variantType, sortOrder } = req.body || {};
  const kd = kind === 'hiragana' || kind === 'katakana' ? kind : null;
  const variant = variantType && KANA_VARIANTS.includes(variantType) ? variantType : null;
  const result = await globalOffQuery(res,
    `UPDATE kana_items SET
       character = COALESCE($2, character),
       kind = COALESCE($3, kind),
       romaji = COALESCE($4, romaji),
       mnemonic = $5,
       group_label = $6,
       variant_type = COALESCE($7, variant_type),
       sort_order = COALESCE($8, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, character != null ? String(character).trim() : null, kd,
     romaji != null && String(romaji).trim() ? String(romaji).trim() : null,
     (mnemonic && String(mnemonic).trim()) || null,
     (groupLabel && String(groupLabel).trim()) || null,
     variant, sortOrder != null && sortOrder !== '' ? Number(sortOrder) : null]
  );
  if (!result) return;
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ kana: result.rows[0] });
}));

router.delete('/kana/:id', asyncHandler(async (req, res) => {
  if (!await globalOffQuery(res, `DELETE FROM kana_items WHERE id = $1`, [req.params.id])) return;
  res.json({ ok: true });
}));

// Contoh kata per karakter (mirror vocabulary-examples).
router.get('/kana-examples', asyncHandler(async (req, res) => {
  const { kanaId } = req.query;
  if (!kanaId) return res.status(400).json({ error: 'kanaId required' });
  const rows = await query(
    `SELECT * FROM kana_examples WHERE kana_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [kanaId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/kana-examples', asyncHandler(async (req, res) => {
  const { kanaId, japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  if (!kanaId || !japanese) return res.status(400).json({ error: 'kanaId and japanese required' });
  const r = await globalOffQuery(res,
    `INSERT INTO kana_examples (kana_id, japanese, reading, highlight, indonesian, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [kanaId, japanese, reading || null, highlight || null, indonesian || null, sortOrder || 0]
  );
  if (!r) return;
  res.status(201).json({ example: r.rows[0] });
}));

router.put('/kana-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  const r = await globalOffQuery(res,
    `UPDATE kana_examples SET
       japanese = COALESCE($2, japanese),
       reading = $3, highlight = $4, indonesian = $5,
       sort_order = COALESCE($6, sort_order), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, reading || null, highlight || null, indonesian || null, sortOrder]
  );
  if (!r) return;
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ example: r.rows[0] });
}));

router.delete('/kana-examples/:id', asyncHandler(async (req, res) => {
  if (!await globalOffQuery(res, `DELETE FROM kana_examples WHERE id = $1`, [req.params.id])) return;
  res.json({ ok: true });
}));

// Karakter dipilih ke pelajaran 'kana' (mirror deck-items).
router.get('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT lki.lesson_id, lki.kana_id, lki.sort_order,
            k.character, k.kind, k.romaji, k.mnemonic, k.group_label, k.variant_type,
            (SELECT COUNT(*)::int FROM kana_examples e WHERE e.kana_id = k.id) AS example_count
     FROM lesson_kana_items lki JOIN kana_items k ON k.id = lki.kana_id
     WHERE lki.lesson_id = $1
     ORDER BY lki.sort_order ASC, k.sort_order ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.post('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const { kanaId, sortOrder } = req.body || {};
  if (!kanaId) return res.status(400).json({ error: 'kanaId required' });
  const guarded = await adminBoundaryWrite(res, {
    prepare: client => linkedContentCandidate(client, req.params.lessonId, [kanaId], 'kana'),
    write: async client => (await client.query(
    `INSERT INTO lesson_kana_items (lesson_id, kana_id, sort_order)
     VALUES ($1,$2,$3)
     ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
     RETURNING *`,
    [req.params.lessonId, kanaId, sortOrder ?? 0]
    )).rows[0],
  });
  if (!guarded) return;
  res.status(201).json({ item: guarded.value, validation: guarded.report });
}));

router.put('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  // Whole reorder/upsert applied atomically.
  const guarded = await adminBoundaryWrite(res, {
    prepare: client => linkedContentCandidate(client, req.params.lessonId,
      items.map(item => item?.kanaId), 'kana'),
    write: async client => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.kanaId) continue;
      await client.query(
        `INSERT INTO lesson_kana_items (lesson_id, kana_id, sort_order)
         VALUES ($1,$2,$3)
         ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [req.params.lessonId, it.kanaId, it.sortOrder ?? i]
      );
    }
    return { ok: true };
    },
  });
  if (!guarded) return;
  res.json({ ok: true, validation: guarded.report });
}));

router.delete('/lessons/:lessonId/kana-items/:kanaId', asyncHandler(async (req, res) => {
  const guarded = await adminLockedMutation(res, client => courseIdsForLesson(client, req.params.lessonId),
  client => client.query(
    `DELETE FROM lesson_kana_items WHERE lesson_id = $1 AND kana_id = $2`,
    [req.params.lessonId, req.params.kanaId]
  ));
  if (!guarded) return;
  res.json({ ok: true });
}));

// ===== GRAMMAR TASK ITEMS (grammar picked into a 'grammar_task' lesson) =====
// Reuse module_grammar as the bank (same grammar can be used across tasks).

router.get('/lessons/:lessonId/grammar-task-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT gi.lesson_id, gi.grammar_id, gi.sort_order, gi.instruction, gi.required_count,
            g.pattern, g.meaning, g.example, g.module_id
     FROM lesson_grammar_task_items gi JOIN module_grammar g ON g.id = gi.grammar_id
     WHERE gi.lesson_id = $1
     ORDER BY gi.sort_order ASC, g.sort_order ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.put('/lessons/:lessonId/grammar-task-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  // Whole task-item set applied atomically.
  const guarded = await adminBoundaryWrite(res, {
    prepare: client => linkedContentCandidate(client, req.params.lessonId,
      items.map(item => item?.grammarId), 'grammar', items.map(item => item?.instruction)),
    write: async client => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.grammarId) continue;
      const reqCount = Math.min(10, Math.max(1, Number(it.requiredCount) || 1));
      await client.query(
        `INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (lesson_id, grammar_id)
           DO UPDATE SET sort_order = EXCLUDED.sort_order,
                         instruction = EXCLUDED.instruction,
                         required_count = EXCLUDED.required_count`,
        [req.params.lessonId, it.grammarId, it.sortOrder ?? i, (it.instruction || '').trim() || null, reqCount]
      );
    }
    return { ok: true };
    },
  });
  if (!guarded) return;
  res.json({ ok: true, validation: guarded.report });
}));

router.delete('/lessons/:lessonId/grammar-task-items/:grammarId', asyncHandler(async (req, res) => {
  const guarded = await adminLockedMutation(res, async client => [
    ...await courseIdsForLesson(client, req.params.lessonId),
    ...await courseIdsForGrammar(client, req.params.grammarId),
  ], client => client.query(
    `DELETE FROM lesson_grammar_task_items WHERE lesson_id = $1 AND grammar_id = $2`,
    [req.params.lessonId, req.params.grammarId]
  ));
  if (!guarded) return;
  res.json({ ok: true });
}));

// ===== APP SETTINGS (editable AI grammar-eval prompt) =====

router.get('/settings/grammar-eval-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'grammar_eval_prompt'`);
  res.json({ value: r.rows[0]?.value || '' });
}));

router.put('/settings/grammar-eval-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('grammar_eval_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

router.get('/settings/quiz-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'quiz_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: QUIZ_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/quiz-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('quiz_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

// Prompt catatan coaching belajar adaptif (app_settings.coaching_note_prompt).
// Placeholder: {{studentName}} {{weakCategory}} {{accuracyPct}} {{lessonTitles}}.
router.get('/settings/coaching-note-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'coaching_note_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: COACH_PROMPT_DEFAULT });
}));

router.put('/settings/coaching-note-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('coaching_note_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

// ===== NOTION IMPORT (vocab bank + per-chapter deck) =====
// "📚 Vocabulary 語彙" Notion DB -> module_vocabulary. Each vocab page is linked
// (relation "Lesson") to a "📗 Bab" page; the deck importer filters by that so
// one EzNihongo deck-lesson can pull exactly one chapter's words. Needs
// NOTION_TOKEN in env (integration shared with both DBs). Notion helpers
// (notionQueryAll/notionPlainText/etc.) live in src/notion.js — see imports.

// Upsert Notion vocab pages into module_vocabulary for `moduleId`, keyed by
// `japanese`. Existing rows get reading/indonesian/category/note refreshed from
// Notion (lesson_id + deck wiring untouched); new rows are appended. Returns
// counts plus `vocabIds` = the resulting row id for each page (Notion order).
async function upsertNotionVocab(moduleId, pages, dbQuery = query) {
  const existing = await dbQuery(`SELECT id, japanese FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
  const byJapanese = new Map();
  for (const r of existing.rows) {
    const j = (r.japanese || '').trim();
    if (j && !byJapanese.has(j)) byJapanese.set(j, r.id);
  }
  let imported = 0, updated = 0, total = 0, sort = byJapanese.size;
  const vocabIds = [];
  for (const page of pages) {
    const props = page.properties || {};
    const japanese = notionPlainText(pickProp(props, ['Japanese 日本語', 'Japanese', '日本語', 'Bahasa Jepang'])).trim();
    if (!japanese) continue;
    total++;
    const reading = notionPlainText(pickProp(props, ['Reading 読み', 'Reading', '読み', 'Cara Baca'])).trim() || null;
    const indonesian = notionPlainText(pickProp(props, ['Indonesian', 'Bahasa Indonesia'])).trim() || null;
    const category = notionPlainText(pickProp(props, ['Category', 'Kategori'])).trim() || null;
    const note = notionPlainText(pickProp(props, ['Note', 'Catatan'])).trim() || null;
    let id = byJapanese.get(japanese);
    if (id) {
      await dbQuery(
        `UPDATE module_vocabulary SET reading = $2, indonesian = $3, category = $4, note = $5, updated_at = NOW()
         WHERE id = $1`,
        [id, reading, indonesian, category, note]
      );
      updated++;
    } else {
      const r = await dbQuery(
        `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [moduleId, japanese, reading, indonesian, category, note, sort++]
      );
      id = r.rows[0].id;
      byJapanese.set(japanese, id);
      imported++;
    }
    vocabIds.push(id);
  }
  return { imported, updated, total, vocabIds };
}

// Lists chapters ("Bab") from the "📗 Bab" Notion DB so the deck editor can pick
// which chapter to pull. Sorted by Nomor Bab.
router.get('/notion-bab', asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const dbId = notionIdFromInput(req.query.notionDbId)
    || notionIdFromInput(process.env.NOTION_BAB_DB_ID)
    || NOTION_BAB_DB_ID_DEFAULT;
  let pages;
  try { pages = await notionQueryAll(dbId, token); }
  catch (err) { return notionErrorResponse(res, err, 'Gagal load daftar Bab dari Notion.'); }
  const bab = pages.map((p) => {
    const props = p.properties || {};
    return {
      id: p.id,
      name: notionPlainText(pickProp(props, ['Bab', 'Name', 'Title'])).trim() || '(tanpa judul)',
      kode: notionPlainText(pickProp(props, ['Kode Bab', 'Kode'])).trim() || null,
      nomor: notionNumber(pickProp(props, ['Nomor Bab', 'Nomor'])),
    };
  });
  bab.sort((a, b) => {
    if (a.nomor != null && b.nomor != null) return a.nomor - b.nomor;
    if (a.nomor != null) return -1;
    if (b.nomor != null) return 1;
    return a.name.localeCompare(b.name);
  });
  res.json({ bab });
}));

// Pulls one chapter's vocab into a deck-lesson: upsert the words into the
// module's bank, then append them to lesson_deck_items. body: { babPageId }.
router.post('/lessons/:lessonId/import-notion-deck', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const { babPageId } = req.body || {};
  if (!babPageId) return res.status(400).json({ error: 'babPageId required' });
  const dbId = notionIdFromInput((req.body || {}).notionVocabDbId) || notionIdFromInput(process.env.NOTION_VOCAB_DB_ID);
  if (!dbId) return res.status(400).json({ error: 'notion_db_required', detail: 'Set NOTION_VOCAB_DB_ID' });

  const lessonRow = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [req.params.lessonId]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const { module_id: moduleId, type } = lessonRow.rows[0];
  if (type !== 'deck') return res.status(400).json({ error: 'lesson_not_deck', detail: 'Pelajaran ini bukan tipe deck' });

  let pages;
  try {
    pages = await notionQueryAll(dbId, token, {
      filter: { property: NOTION_VOCAB_LESSON_RELATION, relation: { contains: babPageId } },
    });
  } catch (err) {
    return notionErrorResponse(res, err, 'Gagal import vocab dari Notion.');
  }
  const outcome = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const current = await client.query(`SELECT id,module_id,type FROM lessons WHERE id=$1
        ${locked ? 'FOR UPDATE' : ''}`, [req.params.lessonId]);
      if (!current.rows.length) throw new BoundaryContextError('lesson_not_found');
      if (current.rows[0].type !== 'deck' || current.rows[0].module_id !== moduleId) {
        throw new BoundaryContextError('boundary_context_mismatch');
      }
      const fields = pages.flatMap((page, index) => {
        const props = page.properties || {};
        return Object.entries(props).map(([key, value]) =>
          boundaryField(`pages[${index}].${key}`, notionPlainText(value)));
      });
      return { scope: { moduleId, lessonId: req.params.lessonId },
        contentType: 'vocabulary_example', operation: 'live_write', fields,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => {
      const dbQuery = client.query.bind(client);
      const { imported, updated, total, vocabIds } = await upsertNotionVocab(moduleId, pages, dbQuery);
      const cur = await dbQuery('SELECT vocabulary_id,sort_order FROM lesson_deck_items WHERE lesson_id=$1', [req.params.lessonId]);
      const inDeck = new Set(cur.rows.map(row => row.vocabulary_id));
      let nextSort = cur.rows.reduce((max, row) => Math.max(max, (row.sort_order ?? 0) + 1), 0);
      let added = 0;
      for (const vid of vocabIds) {
        if (inDeck.has(vid)) continue;
        inDeck.add(vid);
        await dbQuery(`INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order,accent_color)
          VALUES ($1,$2,$3,NULL) ON CONFLICT(lesson_id,vocabulary_id) DO NOTHING`,
        [req.params.lessonId, vid, nextSort++]);
        added++;
      }
      return { imported, updated, added, total };
    },
  });
  if (!outcome) return;
  invalidateCourseVocabCache();
  res.json({ ...outcome.value, validation: outcome.report });
}));

// ===== NOTION: BAB PELAJARAN (5 child pages of a Bab → EzNihongo lessons) =====
// Each Notion Bab page has child pages like "Pelajaran 1: Pengantar",
// "Pelajaran 2: Kosakata", "Pelajaran 3: Kanji", "Pelajaran 4: Tata Bahasa",
// "Pelajaran 5: Latihan". This pair of endpoints lets admin pick which child
// pages to import as EzNihongo lessons under a module, complete with the page
// body converted to HTML.

const SAFE_HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function _h(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => SAFE_HTML_ESCAPES[c]); }

function notionRichTextToHtml(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((t) => {
    let txt = _h(t.plain_text || '');
    const ann = t.annotations || {};
    if (ann.code) txt = `<code>${txt}</code>`;
    if (ann.strikethrough) txt = `<del>${txt}</del>`;
    if (ann.underline) txt = `<u>${txt}</u>`;
    if (ann.italic) txt = `<em>${txt}</em>`;
    if (ann.bold) txt = `<strong>${txt}</strong>`;
    const url = t.href || (t.text && t.text.link && t.text.link.url);
    if (url) txt = `<a href="${_h(url)}" target="_blank" rel="noopener">${txt}</a>`;
    return txt;
  }).join('');
}

// Convert a Notion page's body into simple HTML. Walks block children
// recursively (depth-limited), consolidating consecutive list items into
// <ul>/<ol>. Skips media types we don't render (table/columns/embeds) — the
// goal is "good enough text body that admin can polish", not 1:1 mirror.
async function notionBlocksToHtml(blockId, token, depth = 0, visited = new Set()) {
  if (depth > 5 || visited.has(blockId)) return '';
  visited.add(blockId);
  let children;
  try { children = await notionGetBlockChildren(blockId, token); }
  catch (err) { console.warn('notionBlocksToHtml:', err.message); return ''; }

  const parts = [];
  let listType = null;
  let listItems = [];
  const flushList = () => {
    if (listType && listItems.length) {
      parts.push(`<${listType}>${listItems.join('')}</${listType}>`);
    }
    listType = null;
    listItems = [];
  };

  for (const block of children) {
    const type = block.type;
    const data = block[type] || {};
    if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
      const want = type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (listType !== want) flushList();
      listType = want;
      const inner = notionRichTextToHtml(data.rich_text || []);
      listItems.push(`<li>${inner}</li>`);
      continue;
    }
    flushList();
    if (type === 'paragraph') {
      const inner = notionRichTextToHtml(data.rich_text || []);
      parts.push(inner.trim() ? `<p>${inner}</p>` : '<p><br></p>');
    } else if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
      const tag = type === 'heading_1' ? 'h2' : (type === 'heading_2' ? 'h3' : 'h4');
      parts.push(`<${tag}>${notionRichTextToHtml(data.rich_text || [])}</${tag}>`);
    } else if (type === 'quote') {
      parts.push(`<blockquote>${notionRichTextToHtml(data.rich_text || [])}</blockquote>`);
    } else if (type === 'code') {
      const code = (data.rich_text || []).map((t) => t.plain_text || '').join('');
      parts.push(`<pre><code>${_h(code)}</code></pre>`);
    } else if (type === 'divider') {
      parts.push('<hr>');
    } else if (type === 'toggle') {
      const title = notionRichTextToHtml(data.rich_text || []);
      if (title.trim()) parts.push(`<p><strong>${title}</strong></p>`);
      if (block.has_children) {
        const inner = await notionBlocksToHtml(block.id, token, depth + 1, visited);
        if (inner) parts.push(inner);
      }
    } else if (type === 'synced_block') {
      const src = data.synced_from;
      const srcId = (src && src.block_id) || block.id;
      const inner = await notionBlocksToHtml(srcId, token, depth + 1, visited);
      if (inner) parts.push(inner);
    } else if (type === 'image') {
      const url = (data.file && data.file.url) || (data.external && data.external.url);
      const caption = notionRichTextToHtml(data.caption || []);
      if (url) {
        parts.push(`<figure><img src="${_h(url)}" alt="${caption ? caption.replace(/<[^>]+>/g, '') : ''}">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`);
      }
    } else if (type === 'child_page') {
      // Note its title so admin can decide to import it as a separate lesson.
      const t = data.title || '';
      if (t) parts.push(`<p><em>↳ Sub-page Notion: ${_h(t)}</em></p>`);
    } else if (type === 'callout') {
      const ico = (data.icon && (data.icon.emoji || '')) || '💡';
      parts.push(`<blockquote>${_h(ico)} ${notionRichTextToHtml(data.rich_text || [])}</blockquote>`);
    }
    // Skip: table, column_list, embed, video, file, bookmark, equation —
    // either complex to render or rarely used in pelajaran pages.
  }
  flushList();
  return parts.join('\n');
}

function notionPelajaranType(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('kosakata') || t.includes('語彙') || t.includes('vocab')) return 'deck';
  if (t.includes('latihan') || t.includes('練習') || t.includes('quiz') || t.includes('exercise')) return 'quiz';
  // pengantar / kanji / tata bahasa / grammar / 漢字 / 文法 → text
  return 'text';
}

// Notion menamai child page "Pelajaran 1: Pengantar", "Pelajaran 2: Kosakata",
// dst. Nomornya redundan dengan nomor urut yang sudah dirender sendiri oleh
// sidebar welcome.html, dan artinya beda (posisi dalam modul vs nomor global),
// jadi di layar jadi "87. Pelajaran 1: Pengantar". Strip prefix-nya lalu
// samakan varian generik ke bentuk kanonik — sejajar dengan migration 080 yang
// merapikan baris yang sudah terlanjur masuk DB. Judul spesifik (mis. "Kalimat
// Identitas (です…)") dikembalikan apa adanya setelah prefix di-strip.
function canonicalPelajaranTitle(title) {
  const t = String(title || '').replace(/^\s*pelajaran\s*\d+\s*[:\-–—]\s*/i, '').trim();
  if (/^(introduction|intro|pengantar)$/i.test(t)) return 'Pengantar';
  if (/^(kosakata|vocabulary|vocab)(\s*語彙)?$/i.test(t)) return 'Kosakata 語彙';
  if (/^kanji(\s*漢字)?$/i.test(t)) return 'Kanji 漢字';
  return t;
}

function slugifyJa(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `pelajaran-${Date.now()}`;
}

// List child pages of a Bab — admin uses this to choose which pelajaran to
// import. Returns [{ id, title, type }] in Notion order.
router.get('/notion-bab/:babPageId/pelajaran', asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const babPageId = req.params.babPageId;
  let blocks;
  try { blocks = await notionGetBlockChildren(babPageId, token); }
  catch (err) { return notionErrorResponse(res, err, 'Gagal load Pelajaran dari Bab Notion.'); }
  const pelajaran = [];
  for (const b of blocks) {
    if (b.type === 'child_page') {
      const title = (b.child_page && b.child_page.title) || '(tanpa judul)';
      pelajaran.push({ id: b.id, title, type: notionPelajaranType(title) });
    }
  }
  res.json({ pelajaran });
}));

// Create EzNihongo lessons under a module, one per Notion child-page id given.
// Body content rendered from the Notion page's blocks.
// body: { babPageId, pelajaranIds: [string], startSortOrder?: number }
router.post('/modules/:moduleId/import-notion-pelajaran', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const moduleId = req.params.moduleId;
  const { pelajaranIds } = req.body || {};
  if (!Array.isArray(pelajaranIds) || pelajaranIds.length === 0) {
    return res.status(400).json({ error: 'pelajaranIds[] required' });
  }
  const staged = [];
  const errors = [];
  for (const pageId of pelajaranIds) {
    let page;
    try {
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
      });
      if (!resp.ok) throw new Error(`Notion ${resp.status}`);
      page = await resp.json();
    } catch (err) {
      errors.push({ pageId, error: err.message });
      continue;
    }
    // Title — child_page block title or page properties.title.
    const titleProp = page.properties && Object.values(page.properties).find((p) => p.type === 'title');
    const title = canonicalPelajaranTitle(notionPlainText(titleProp)) || '(tanpa judul)';
    const type = notionPelajaranType(title);
    // Body content as HTML.
    let html = '';
    try { html = await notionBlocksToHtml(pageId, token); }
    catch (err) { console.warn('notionBlocksToHtml failed:', err.message); }
    staged.push({ pageId, title, type, html, baseSlug: slugifyJa(title) });
  }
  if (!staged.length) return res.json({ created: [], errors });
  const outcome = await adminBoundaryWrite(res, {
    prepare: async client => {
      const mod = await client.query('SELECT id FROM modules WHERE id=$1', [moduleId]);
      if (!mod.rows.length) throw new BoundaryContextError('module_not_found');
      const existing = await client.query('SELECT slug FROM lessons WHERE module_id=$1', [moduleId]);
      const used = new Set(existing.rows.map(row => row.slug));
      const sortStart = await client.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM lessons WHERE module_id=$1', [moduleId]);
      let nextSort = Number(sortStart.rows[0]?.next) || 0;
      const items = staged.map(item => {
        let slug = item.baseSlug, counter = 2;
        while (used.has(slug)) slug = `${item.baseSlug}-${counter++}`;
        used.add(slug);
        return { ...item, slug, sortOrder: nextSort++ };
      });
      return { scope: { moduleId }, contentType: 'reading', operation: 'live_write',
        fields: items.flatMap((item, index) => [boundaryField(`items[${index}].title`, item.title),
          boundaryField(`items[${index}].content`, item.html)]), items,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async (client, candidate) => {
      const created = [];
      for (const item of candidate.items) {
        const result = await client.query(`INSERT INTO lessons(module_id,slug,title,type,content,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,slug,title,type,sort_order`,
        [moduleId, item.slug, item.title, item.type, item.html || null, item.sortOrder]);
        created.push(result.rows[0]);
      }
      return created;
    },
  });
  if (!outcome) return;
  res.json({ created: outcome.value, errors, validation: outcome.report });
}));

// ===== MODULE GRAMMAR =====

router.get('/module-grammar', asyncHandler(async (req, res) => {
  const { moduleId, lessonId } = req.query;
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });
  const params = [moduleId];
  let where = 'module_id = $1';
  if (lessonId) { where += ' AND lesson_id = $2'; params.push(lessonId); }
  const rows = await query(
    `SELECT * FROM module_grammar WHERE ${where} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  res.json({ grammar: rows.rows });
}));

// ===== PENGECOH STEP 1 TUGAS BUNPOU (migration 124) =====
// Soal Step 1 menanyakan "Apa fungsi <pola>?". Tanpa pengecoh kurasi, pengecoh
// diturunkan dari arti pola LAIN di bab yang sama — terlalu mudah, karena bisa
// dieliminasi cuma dengan menyadari "ini bukan soal も". Endpoint ini membuat
// pengecoh yang menguji betulan: fungsi yang SALAH untuk pola itu sendiri.
//
// Di-generate SEKALI per pola oleh admin lalu disimpan. Siswa tidak pernah
// memicu panggilan AI untuk soal pilihan ganda — lihat prinsip "jangan
// overuse AI" di CLAUDE.md.
// Sibling meanings are authoritative exclusions for draft and bulk generation.
async function loadDistractorSiblings(item, dbQuery = query, locked = false) {
  // Fungsi pola LAIN di bab yang sama dikirim sebagai daftar-hindari: kalau
  // pengecoh kebetulan mendeskripsikan pola lain, soalnya jadi ambigu untuk
  // siswa yang tahu pola itu.
  const sib = await dbQuery(
    `SELECT id, pattern, meaning FROM module_grammar
      WHERE module_id = $1 AND id <> $2 AND meaning IS NOT NULL AND TRIM(meaning) <> ''
      ORDER BY sort_order ASC, id ASC LIMIT 12 ${locked ? 'FOR SHARE' : ''}`,
    [item.module_id, item.id]
  );
  return sib.rows;
}

// Muat satu pola LENGKAP dengan contohnya — dibutuhkan controlledSlot().
async function loadGrammarWithExamples(id, dbQuery = query, locked = false) {
  const g = await dbQuery(
    `SELECT id, module_id, lesson_id, pattern, meaning, updated_at,
       recognition_distractors, controlled_distractors
       FROM module_grammar WHERE id = $1 ${locked ? 'FOR UPDATE' : ''}`,
    [id]
  );
  if (g.rows.length === 0) return null;
  const ex = await dbQuery(
    `SELECT japanese, highlight, indonesian FROM grammar_examples
      WHERE grammar_id = $1 ORDER BY sort_order ASC, created_at ASC, id ASC ${locked ? 'FOR SHARE' : ''}`,
    [id]
  );
  return { ...g.rows[0], examples: ex.rows };
}

async function generateGroundedDistractorsFor(item, siblings, body = {},
  { needRecognition = true, needControlled = true } = {}) {
  const slot = controlledSlot(item);
  const includeControlled = needControlled && !!slot;
  if (includeControlled) {
    let boundary;
    try { boundary = await getCurriculumBoundary({ grammarId: item.id }); }
    catch { return { result: { status: 'unavailable', candidate: null,
      report: { status: 'unavailable', valid: null, violations: [], warnings: [{ code: 'boundary_unavailable' }] },
      attempts: [] }, slot, preflight: true }; }
    const slotReport = validateContentAgainstBoundary({ boundary, contentType: 'grammar_distractors',
      operation: 'generate', fields: [boundaryField('slot.sentence', slot.sentence),
        boundaryField('slot.answer', slot.answer)] });
    if (slotReport.status !== 'evaluated' || slotReport.valid !== true) {
      return { result: { status: 'rejected', candidate: null, report: slotReport,
        decision: decideBoundaryAction({ mode: boundary.course.mode, operation: 'generate', report: slotReport }),
        attempts: [], boundaryFingerprint: boundary.boundaryFingerprint, sourceFingerprint: null },
      slot, preflight: true };
    }
  }
  const loadSource = async () => {
    const current = await loadGrammarWithExamples(item.id);
    if (!current) throw new Error('grammar_changed');
    return { grammar: current, siblings: await loadDistractorSiblings(current),
      slot: controlledSlot(current) };
  };
  const result = await groundedDraft({ scope: { grammarId: item.id },
    contentType: 'grammar_distractors', loadSource, body,
    maxTokens: 950, model: ANTHROPIC_GEN_MODEL,
    instruction: `${needRecognition ? `Create exactly three Indonesian recognition distractors for persisted grammar ${JSON.stringify(item.pattern)}. Correct meaning: ${JSON.stringify(item.meaning)}. Avoid meanings of sibling grammar: ${JSON.stringify(siblings.map(row => ({ pattern: row.pattern, meaning: row.meaning })))}.` : 'Omit recognitionDistractors because they are already curated.'} ${includeControlled ? `Create exactly three Japanese controlled distractors for sentence ${JSON.stringify(slot.sentence)} and correct blank answer ${JSON.stringify(slot.answer)}.` : 'Omit controlledDistractors.'} Return only JSON {${[needRecognition ? '"recognitionDistractors":["...","...","..."]' : null,
      includeControlled ? '"controlledDistractors":["...","...","..."]' : null].filter(Boolean).join(',')}}.`,
    additionalSchemaIssues: candidate => {
      const issues = [];
      if (candidate.slot != null ||
          (needRecognition ? candidate.recognitionDistractors?.length !== 3 : candidate.recognitionDistractors != null) ||
          (includeControlled ? candidate.controlledDistractors?.length !== 3 : candidate.controlledDistractors != null)) {
        issues.push({ code: 'distractor_task_shape_invalid' });
      }
      const correct = item.meaning.trim().toLocaleLowerCase('id');
      const siblingMeanings = new Set(siblings.map(row => String(row.meaning || '').trim().toLocaleLowerCase('id')));
      if (Array.isArray(candidate.recognitionDistractors) && candidate.recognitionDistractors.some(value =>
        typeof value === 'string' && (value.trim().toLocaleLowerCase('id') === correct ||
          siblingMeanings.has(value.trim().toLocaleLowerCase('id')) || value.includes(item.pattern)))) {
        issues.push({ code: 'recognition_distractor_conflict' });
      }
      if (includeControlled && Array.isArray(candidate.controlledDistractors) && candidate.controlledDistractors.some(value =>
        typeof value !== 'string' || value === slot.answer || !slotShaped(slot.answer, value))) {
        issues.push({ code: 'controlled_distractor_shape_invalid' });
      }
      return issues;
    } });
  return { result, slot, preflight: false };
}

router.post('/module-grammar/:id/generate-distractors', asyncHandler(async (req, res) => {
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled' });
  const item = await loadGrammarWithExamples(req.params.id);
  if (!item) return res.status(404).json({ error: 'grammar not found' });
  if ((req.body?.lessonId && String(req.body.lessonId) !== String(item.lesson_id)) ||
      (req.body?.moduleId && String(req.body.moduleId) !== String(item.module_id))) {
    return res.status(409).json({ error: 'grammar_source_mismatch' });
  }
  if (!(item.meaning || '').trim()) {
    return res.status(400).json({ error: 'no_meaning', detail: 'Isi kolom Arti dulu — pengecoh dibuat berdasarkan fungsi yang benar.' });
  }
  const siblings = await loadDistractorSiblings(item);
  const { result, slot, preflight } = await generateGroundedDistractorsFor(item, siblings, req.body || {});
  return groundedResponse(res, result, { distractors: result.status === 'ready'
    ? result.candidate.recognitionDistractors : [],
  controlled: result.status === 'ready' ? result.candidate.controlledDistractors || [] : [],
  slot: result.status === 'ready' && slot ? { sentence: slot.sentence, answer: slot.answer } : null },
  preflight && result.status === 'rejected' ? 422 : null);
}));

// Generate + SIMPAN untuk semua pola satu kursus yang pengecohnya masih kosong.
//
// Dikerjakan per BATCH KECIL, bukan sekali jalan: nginx memutus request di 60s
// (proxy_read_timeout), dan satu panggilan AI makan beberapa detik. Frontend
// memanggil ini berulang sampai `remaining` habis.
//
// Aman diulang: yang sudah terisi dilewati, jadi klik ulang = melanjutkan,
// bukan menimpa. Pola tanpa `meaning` dilewati (tidak ada dasar jawabannya).
router.post('/module-grammar/generate-distractors-bulk', asyncHandler(async (req, res) => {
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled' });
  const { fromGrammarId, courseSlug } = req.body || {};
  const limit = Math.min(10, Math.max(1, Number(req.body?.limit) || 6));

  // Cakupan kursus diturunkan dari pola yang sedang dibuka admin — tidak perlu
  // menyalurkan courseId lewat seluruh UI hanya demi tombol ini.
  let courseId = null;
  if (fromGrammarId) {
    const c = await query(
      `SELECT m.course_id FROM module_grammar g JOIN modules m ON m.id = g.module_id WHERE g.id = $1`,
      [fromGrammarId]
    );
    courseId = c.rows[0]?.course_id || null;
  } else if (courseSlug) {
    const c = await query(`SELECT id FROM courses WHERE slug = $1`, [courseSlug]);
    courseId = c.rows[0]?.id || null;
  }
  if (!courseId) return res.status(400).json({ error: 'course_not_resolved' });

  // "Belum lengkap" = salah satu dari dua kolom masih kosong.
  const pendingSql = `
    SELECT g.id, g.module_id, g.pattern, g.meaning
      FROM module_grammar g
      JOIN modules m ON m.id = g.module_id
     WHERE m.course_id = $1
       AND g.meaning IS NOT NULL AND TRIM(g.meaning) <> ''
       AND ((g.recognition_distractors IS NULL OR TRIM(g.recognition_distractors) = '')
         OR (g.controlled_distractors  IS NULL OR TRIM(g.controlled_distractors)  = ''))
     ORDER BY m.sort_order ASC, g.sort_order ASC`;

  const batch = await query(`${pendingSql} LIMIT $2`, [courseId, limit]);

  let saved = 0;
  const failed = [];
  const failedItems = [];
  const savedItems = [];
  for (const row of batch.rows) {
    try {
    const item = await loadGrammarWithExamples(row.id);
    if (!item) { failed.push(row.pattern); failedItems.push({ id: row.id, error: 'grammar_not_found', status: 404 }); continue; }
    const siblings = await loadDistractorSiblings(item);
    const sourceFingerprint = distractorSourceFingerprint(item, siblings);
    // Hanya isi kolom yang masih kosong — yang sudah dikurasi admin tidak
    // pernah ditimpa, walau baris ini terpilih karena kolom satunya kosong.
    const needS1 = !(item.recognition_distractors || '').trim();
    const needS2 = !(item.controlled_distractors || '').trim();
    // Each item receives its own authoritative context and at most three
    // provider attempts. A fingerprint supplied for the starting grammar is
    // not authority for other grammars in this course-wide command.
    const { result, slot } = await generateGroundedDistractorsFor(item, siblings, {},
      { needRecognition: needS1, needControlled: needS2 });
    if (result.status !== 'ready' || (needS2 && !slot)) {
      const status = result.status === 'stale' ? 409 : result.status === 'unavailable' ? 503 : 422;
      failed.push(row.pattern);
      failedItems.push({ id: row.id, error: !slot && needS2 ? 'controlled_slot_missing' :
        result.status === 'stale' ? 'version_conflict' : result.status === 'unavailable' ?
          'generation_unavailable' : 'generation_rejected', status,
        generation: groundedGenerationMetadata(result) });
      continue;
    }
    const generatedS1 = needS1 ? result.candidate.recognitionDistractors.join('\n') : null;
    const generatedS2 = needS2 ? result.candidate.controlledDistractors.join('\n') : null;
    const guarded = await bulkBoundaryWrite({
      prepare: async (client, { locked }) => {
        const dbQuery = client.query.bind(client);
        const g = await loadGrammarWithExamples(row.id, dbQuery, locked);
        if (!g) throw new BoundaryContextError('grammar_not_found');
        const currentSiblings = await loadDistractorSiblings(g, dbQuery, locked);
        assertGenerationSourceUnchanged(sourceFingerprint,
          distractorSourceFingerprint(g, currentSiblings));
        assertGenerationSourceUnchanged(result.sourceFingerprint,
          dialogueSourceFingerprint({ grammar: g, siblings: currentSiblings, slot: controlledSlot(g) }));
        const recognition = (g.recognition_distractors || '').trim() ? g.recognition_distractors : generatedS1;
        const controlled = (g.controlled_distractors || '').trim() ? g.controlled_distractors : generatedS2;
        return { scope: { grammarId: g.id, moduleId: g.module_id, lessonId: g.lesson_id || undefined },
          contentType: 'grammar_distractors', operation: 'generate', contentId: g.id,
          fields: [boundaryField('recognitionDistractors', recognition), boundaryField('controlledDistractors', controlled)],
          expectedBoundaryFingerprint: result.boundaryFingerprint,
          contentIsNewOrChanged: recognition !== g.recognition_distractors || controlled !== g.controlled_distractors,
          recognition, controlled };
      },
      write: async (client, candidate) => (await client.query(`UPDATE module_grammar SET
        recognition_distractors=COALESCE(NULLIF(TRIM(recognition_distractors),''),$2),
        controlled_distractors=COALESCE(NULLIF(TRIM(controlled_distractors),''),$3),updated_at=NOW()
        WHERE id=$1 RETURNING id`, [row.id, candidate.recognition, candidate.controlled])).rows[0],
    });
    if (!guarded.ok) {
      failed.push(row.pattern);
      failedItems.push({ id: row.id, error: guarded.error, status: guarded.status,
        generation: groundedGenerationMetadata(result),
        ...(guarded.validation ? { validation: guarded.validation } : {}) });
      continue;
    }
    saved++;
    savedItems.push({ id: row.id, validation: guarded.outcome.report,
      generation: groundedGenerationMetadata(result) });
    } catch (error) {
      console.error('distractor_bulk_item_failed', error);
      failed.push(row.pattern);
      failedItems.push({ id: row.id, error: 'bulk_item_failed', status: 500 });
    }
  }

  const rest = await query(`SELECT COUNT(*)::int AS n FROM (${pendingSql}) t`, [courseId]);
  const noMeaning = await query(
    `SELECT COUNT(*)::int AS n FROM module_grammar g JOIN modules m ON m.id = g.module_id
      WHERE m.course_id = $1 AND (g.meaning IS NULL OR TRIM(g.meaning) = '')`,
    [courseId]
  );

  res.json({
    processed: batch.rows.length,
    saved,
    failed,
    savedItems,
    failedItems,
    remaining: rest.rows[0].n,
    skippedNoMeaning: noMeaning.rows[0].n,
  });
}));

// Baca pengecoh tersimpan untuk satu pola (dipakai modal admin saat dibuka).
router.get('/module-grammar/:id/distractors', asyncHandler(async (req, res) => {
  const item = await loadGrammarWithExamples(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  // Soal Step 2 (kalimat + jawaban) ikut dikirim: admin perlu melihat soal yang
  // sedang ia buatkan pengecohnya, sekaligus langsung sadar kalau contoh
  // kalimatnya berubah dan pengecoh lamanya jadi tidak cocok.
  const slot = controlledSlot({ ...item, examples: item.examples });
  res.json({
    pattern: item.pattern,
    meaning: item.meaning,
    value: item.recognition_distractors || '',
    controlled: item.controlled_distractors || '',
    slot: slot ? { sentence: slot.sentence, answer: slot.answer, indonesian: slot.indonesian } : null,
  });
}));

// Simpan (atau kosongkan) pengecoh kurasi. Kosong = kembali ke penurunan lama.
const cleanLines = (raw) => String(raw || '')
  .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);

router.put('/module-grammar/:id/distractors', asyncHandler(async (req, res) => {
  const body = req.body || {};
  // Presence-checked per field: modal boleh menyimpan salah satunya saja tanpa
  // diam-diam mengosongkan yang lain.
  const hasS1 = Object.prototype.hasOwnProperty.call(body, 'value')
    || Object.prototype.hasOwnProperty.call(body, 'distractors');
  const hasS2 = Object.prototype.hasOwnProperty.call(body, 'controlled');
  const s1 = Array.isArray(body.distractors) ? body.distractors.map(String) : cleanLines(body.value);
  const s2 = cleanLines(body.controlled);

  const guarded = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const current = await client.query(`SELECT * FROM module_grammar WHERE id=$1
        ${locked ? 'FOR UPDATE' : ''}`, [req.params.id]);
      if (!current.rows.length) throw new BoundaryContextError('grammar_not_found');
      const row = current.rows[0];
      const recognition = hasS1 ? (s1.length ? s1.join('\n') : null) : row.recognition_distractors;
      const controlled = hasS2 ? (s2.length ? s2.join('\n') : null) : row.controlled_distractors;
      return { scope: { grammarId: row.id, moduleId: row.module_id, lessonId: row.lesson_id || undefined },
        contentType: 'grammar_distractors', operation: 'live_write', contentId: row.id,
        fields: [boundaryField('recognitionDistractors', recognition),
          boundaryField('controlledDistractors', controlled)],
        contentIsNewOrChanged: recognition !== row.recognition_distractors || controlled !== row.controlled_distractors,
        expectedRevision: body.expectedRevision, currentRevision: row.updated_at,
        expectedBoundaryFingerprint: body.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE module_grammar SET
       recognition_distractors = CASE WHEN $3::boolean THEN $2 ELSE recognition_distractors END,
       controlled_distractors  = CASE WHEN $5::boolean THEN $4 ELSE controlled_distractors END,
       updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [
      req.params.id,
      s1.length ? s1.join('\n') : null, hasS1,
      s2.length ? s2.join('\n') : null, hasS2,
    ]
    )).rows[0],
  });
  if (!guarded) return;
  res.json({ ok: true, distractors: s1, controlled: s2, validation: guarded.report });
}));

// ── Bunpou Flow pilot: Pendamping Bunpou companion editor (Paket 1) ────────
// Draft/publish workflow for the JSONB envelope on ONE source lesson's
// bunpou_flow_draft/bunpou_flow_published (migration 147). Never touches
// module_grammar, grammar_examples, or lessons.content — this is additive
// companion content only, and the pilot flag/lesson id that decide whether
// it is ever served to a student live in app_settings (see
// bunpou-flow-config.js), not here.

// Scope = this lesson's own grammar cards UNION the grammar points actually
// picked into its paired Tugas Bunpou (if one exists yet) — matches the
// implementation plan's "semua grammarId milik lesson/tugas terkait".
async function bunpouFlowScope(lessonId, dbQuery = query) {
  const [own, task] = await Promise.all([
    dbQuery(`SELECT id FROM module_grammar WHERE lesson_id = $1`, [lessonId]),
    dbQuery(`SELECT id FROM lessons WHERE type = 'grammar_task' AND popup_after_lesson_id = $1 LIMIT 1`, [lessonId]),
  ]);
  const taskLessonId = task.rows[0]?.id || null;
  const taskItems = taskLessonId
    ? await dbQuery(`SELECT grammar_id FROM lesson_grammar_task_items WHERE lesson_id = $1`, [taskLessonId])
    : { rows: [] };
  const grammarIds = [...new Set([
    ...own.rows.map((r) => r.id),
    ...taskItems.rows.map((r) => r.grammar_id),
  ])];
  return { grammarIds, taskLessonId };
}

// Fingerprints the live content this lesson's companion is checked against
// (pattern/meaning/examples/distractors of every pattern in scope) so the
// editor can flag "materi berubah sejak draft/publikasi ini disimpan"
// without re-reading every field by eye. Purely a staleness signal for the
// admin UI — grading itself never depends on this value (each practice
// session freezes its own drill snapshot at creation time regardless; see
// routes/grammar-task-sessions.js).
async function currentSourceFingerprint(taskLessonId, dbQuery = query) {
  if (!taskLessonId) return null;
  const [items, pool] = await Promise.all([loadTaskConcepts(taskLessonId, dbQuery), loadModulePool(taskLessonId, dbQuery)]);
  return contentRevisionId(items, pool);
}

router.get('/lessons/:lessonId/bunpou-flow', asyncHandler(async (req, res) => {
  const lesson = await query(
    `SELECT id, title, bunpou_flow_draft, bunpou_flow_published FROM lessons WHERE id = $1`,
    [req.params.lessonId]
  );
  if (lesson.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const { grammarIds, taskLessonId } = await bunpouFlowScope(req.params.lessonId);
  const patternRows = grammarIds.length
    ? await query(`SELECT id, pattern FROM module_grammar WHERE id = ANY($1::uuid[])`, [grammarIds])
    : { rows: [] };
  const reviewItems = taskLessonId ? await loadTaskConcepts(taskLessonId) : [];
  const reviewPool = taskLessonId ? await loadModulePool(taskLessonId) : [];
  const reviewDrills = deriveDrills(reviewItems, reviewPool);
  res.json({
    lessonId: req.params.lessonId,
    lessonTitle: lesson.rows[0].title,
    taskLessonId,
    grammarIds,
    patterns: Object.fromEntries(patternRows.rows.map((r) => [r.id, r.pattern])),
    currentFingerprint: taskLessonId ? contentRevisionId(reviewItems, reviewPool) : null,
    reviewItems: reviewItems.map(item => ({ grammarId: item.id, pattern: item.pattern,
      meaning: item.meaning, dialog: item.example_dialog, dialogTranslation: item.example_dialog_id,
      instruction: item.instruction, ...reviewDrills.get(item.id) })),
    draft: lesson.rows[0].bunpou_flow_draft || null,
    draftRevision: companionDraftRevision(lesson.rows[0].bunpou_flow_draft),
    published: lesson.rows[0].bunpou_flow_published || null,
    // Paket 2: kelayakan pemeriksaan mandiri per pola, dihitung SERVER-side
    // dengan fungsi yang sama persis yang nanti dipakai session API untuk
    // memutuskan menyajikan atau tidak. Editor tidak menghitung sendiri,
    // supaya "hijau di admin tapi tidak muncul ke siswa" tidak mungkin
    // terjadi karena dua salinan aturan yang berbeda.
    checkAvailability: Object.fromEntries(grammarIds.map((gid) => [
      gid,
      dialogCheckAvailability(((lesson.rows[0].bunpou_flow_draft || lesson.rows[0].bunpou_flow_published || {}).dialogChecks || {})[gid]),
    ])),
  });
}));

router.put('/lessons/:lessonId/bunpou-flow/draft', asyncHandler(async (req, res) => {
  const guarded = await adminLockedMutation(res, client => courseIdsForBunpouPair(client, req.params.lessonId),
    async client => {
      const lesson = await client.query('SELECT bunpou_flow_draft FROM lessons WHERE id=$1 FOR UPDATE',
        [req.params.lessonId]);
      if (!lesson.rows.length) throw fail(404, 'lesson_not_found');
      const revision = companionDraftRevision(lesson.rows[0].bunpou_flow_draft);
      if ((req.body?.draftRevision ?? null) !== revision) throw fail(409, 'draft_changed_since_editor_open');
      const dbQuery = client.query.bind(client);
      const { grammarIds, taskLessonId } = await bunpouFlowScope(req.params.lessonId, dbQuery);
      const check = validateCompanionEnvelope(req.body, grammarIds);
      if (!check.ok) throw fail(400, 'invalid_envelope');
      const fingerprint = await currentSourceFingerprint(taskLessonId, dbQuery);
      if (!fingerprint || req.body?.sourceFingerprint !== fingerprint) throw fail(409, 'source_changed_since_review');
      const sanitized = sanitizeCompanionEnvelope(req.body);
      sanitized.editor = { email: req.user.email, at: new Date().toISOString() };
      sanitized.sourceFingerprint = fingerprint;
      return (await client.query(`UPDATE lessons SET bunpou_flow_draft=$2,updated_at=NOW()
        WHERE id=$1 RETURNING bunpou_flow_draft`, [req.params.lessonId, JSON.stringify(sanitized)])).rows[0];
    });
  if (!guarded) return;
  res.json({ ok: true, draft: guarded.value.bunpou_flow_draft,
    draftRevision: companionDraftRevision(guarded.value.bunpou_flow_draft) });
}));

// Publishing is deliberately its own explicit action (never implied by
// saving a draft) and requires `confirm: true` in the body — "tindakan
// publish harus eksplisit dan tercatat" (implementation plan §5). It always
// (re-)validates the CURRENT draft against the CURRENT scope, so a grammar
// point removed from the task after the draft was written cannot slip a
// now-out-of-scope overlay into what students see.
router.post('/lessons/:lessonId/bunpou-flow/publish', asyncHandler(async (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'confirm_required' });
  const outcome = await adminBoundaryWrite(res, {
    validate: validateBunpouPublish,
    prepare: async (client, { locked }) => {
      const dbQuery = client.query.bind(client);
      const lesson = await dbQuery(`SELECT id,module_id,bunpou_flow_draft FROM lessons WHERE id=$1
        ${locked ? 'FOR UPDATE' : ''}`, [req.params.lessonId]);
      if (!lesson.rows.length) throw fail(404, 'lesson_not_found');
      const row = lesson.rows[0], draft = row.bunpou_flow_draft;
      if (!draft) throw fail(400, 'no_draft_to_publish');
      if (!req.body?.draftRevision || req.body.draftRevision !== companionDraftRevision(draft)) {
        throw fail(409, 'draft_changed_since_review');
      }
      const { grammarIds, taskLessonId } = await bunpouFlowScope(row.id, dbQuery);
      const check = validateCompanionEnvelope(draft, grammarIds);
      if (!check.ok) throw fail(400, 'invalid_envelope');
      const fingerprint = await currentSourceFingerprint(taskLessonId, dbQuery);
      if (!fingerprint || draft.sourceFingerprint !== fingerprint) throw fail(409, 'source_changed_since_review');
      const sanitized = sanitizeCompanionEnvelope(draft);
      const relatedCourseIds = taskLessonId ? await courseIdsForLesson(client, taskLessonId) : [];
      return { scope: { moduleId: row.module_id, lessonId: row.id },
        relatedCourseIds,
        contentType: 'dialogue_comprehension', operation: 'publish', contentId: row.id,
        fields: boundaryFieldsFrom('bunpouFlowPublished', sanitized), draft, sanitized, fingerprint,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async (client, candidate) => {
      const published = { ...candidate.sanitized,
        publishedBy: { email: req.user.email, at: new Date().toISOString() },
        sourceFingerprint: candidate.fingerprint };
      const result = await client.query(`UPDATE lessons SET bunpou_flow_published=$2,updated_at=NOW()
        WHERE id=$1 AND bunpou_flow_draft=$3::jsonb RETURNING id,bunpou_flow_published`,
      [req.params.lessonId, JSON.stringify(published), JSON.stringify(candidate.draft)]);
      if (!result.rows.length) throw fail(409, 'draft_changed_during_publish');
      return result.rows[0];
    },
  });
  if (!outcome) return;
  res.json({ ok: true, published: outcome.value.bunpou_flow_published, validation: outcome.report });
}));

// Flag + pilot lesson id — plain app_settings rows (same mechanism as
// grammar_eval_prompt), read together by bunpou-flow-config.js. Enabling
// requires the target to actually be a lesson with a companion already
// published, so a typo'd or forgotten-to-publish lesson id can not be
// switched live by accident.
// Readiness and config name lessons/modules/courses by id only. The admin
// switch (Percakapan drawer, AI tab) shows the reasons per lesson, and a
// failure can name a lesson of another Bab, so the titles ride along.
const FLOW_TITLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
async function flowScopeTitles({ config, readiness } = {}) {
  const want = { course: new Set(config?.courseIds || []), module: new Set(config?.moduleIds || []),
    lesson: new Set(config?.lessonIds || []) };
  for (const row of readiness?.lessons || []) if (row?.lessonId) want.lesson.add(row.lessonId);
  for (const row of readiness?.issues || []) if (want[row?.kind] && row.id) want[row.kind].add(row.id);
  const ids = key => [...want[key]].filter(id => typeof id === 'string' && FLOW_TITLE_ID.test(id));
  const titles = { courses: {}, modules: {}, lessons: {} };
  if (ids('course').length) {
    for (const row of (await query('SELECT id, title FROM courses WHERE id = ANY($1::uuid[])',
      [ids('course')])).rows) titles.courses[row.id] = row.title;
  }
  if (ids('module').length) {
    for (const row of (await query(`SELECT m.id, m.title, c.title AS course_title
      FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = ANY($1::uuid[])`,
    [ids('module')])).rows) titles.modules[row.id] = { title: row.title, courseTitle: row.course_title };
  }
  if (ids('lesson').length) {
    for (const row of (await query(`SELECT l.id, l.title, m.title AS module_title,
        c.title AS course_title, cv.title AS conversation_title
      FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
      LEFT JOIN lessons cv ON cv.conversation_source_lesson_id = l.id
      WHERE l.id = ANY($1::uuid[])`, [ids('lesson')])).rows) {
      titles.lessons[row.id] = { title: row.title, moduleTitle: row.module_title,
        courseTitle: row.course_title, conversationTitle: row.conversation_title || null };
    }
  }
  return titles;
}

router.get('/settings/learning-flow-communication', asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const settings = await getLearningFlowSettings();
  res.json({ ...settings, titles: await flowScopeTitles(settings) });
}));

router.put('/settings/learning-flow-communication', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  let saved;
  try { saved = await saveLearningFlowSettings(req.body || {}); }
  catch (error) {
    if (!error.status) throw error;
    return res.status(error.status).json({ error: error.message,
      ...(error.readiness ? { readiness: error.readiness,
        titles: await flowScopeTitles({ readiness: error.readiness }) } : {}) });
  }
  res.json({ ...saved, titles: await flowScopeTitles(saved) });
}));

// Read-only preview for one source lesson (Tata Bahasa text/video): the same
// check the PUT runs, so a green preview means that lesson alone may be enabled.
router.get('/settings/learning-flow-communication/readiness', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const readiness = await previewLessonFlowReadiness(String(req.query.lessonId || ''));
    res.json({ readiness, titles: await flowScopeTitles({ readiness }) });
  } catch (error) {
    if (!error.status) throw error;
    res.status(error.status).json({ error: error.message });
  }
}));

router.get('/settings/bunpou-flow-pilot', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT key, value FROM app_settings WHERE key IN ('bunpou_flow_pilot_enabled','bunpou_flow_pilot_lesson_id')`
  );
  const byKey = Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
  res.json({
    enabled: byKey.bunpou_flow_pilot_enabled === 'true',
    lessonId: byKey.bunpou_flow_pilot_lesson_id || null,
    lessons: await loadPilotLessonOptions(),
  });
}));

router.put('/settings/bunpou-flow-pilot', asyncHandler(async (req, res) => {
  const enabled = (req.body || {}).enabled === true;
  const lessonId = String((req.body || {}).lessonId || '').trim() || null;
  if (enabled && !lessonId) return res.status(400).json({ error: 'lesson_id_required_to_enable' });
  if (lessonId && !isCanonicalUuid(lessonId)) return res.status(400).json({ error: 'Pilih pelajaran dari daftar.' });
  if (enabled && lessonId) {
    const lesson = await query(`SELECT bunpou_flow_published FROM lessons WHERE id = $1`, [lessonId]);
    if (lesson.rows.length === 0) return res.status(404).json({ error: 'lesson_not_found' });
    if (enabled && !lesson.rows[0].bunpou_flow_published) {
      return res.status(400).json({ error: 'lesson_has_no_published_companion' });
    }
    if (enabled) {
      const selected = (await loadPilotLessonOptions()).find(row => row.id === lessonId);
      if (!selected?.ready) return res.status(409).json({ error: selected?.reason || 'Pelajaran belum siap untuk pilot.' });
    }
  }
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('bunpou_flow_pilot_enabled', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [enabled ? 'true' : 'false']
    );
    await client.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('bunpou_flow_pilot_lesson_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [lessonId]
    );
  });
  res.json({ ok: true, enabled, lessonId });
}));

// ── Paket 3: tinjauan MODE SHADOW kebijakan penguasaan ────────────────────
// Read-only sepenuhnya. Menghitung kebijakan usulan (v2) di samping
// kebijakan berjalan (v1) untuk siswa yang punya percobaan pada pola-pola
// satu pelajaran, lalu melaporkan perbedaannya. TIDAK menulis apa pun, dan
// tidak satu pun jalur siswa memanggil kode ini.
//
// Ini bahan keputusan aktivasi, BUKAN aktivasinya: rencana Paket 3 menaruh
// gerbangnya pada pemilik produk ("Pemilik produk meninjau kebijakan dan
// sampel perbedaan shadow ... Sebelum itu, flag penilaian baru tetap mati").
router.get('/grammar-mastery/shadow', asyncHandler(async (req, res) => {
  const pilot = await query(
    `SELECT value FROM app_settings WHERE key = 'bunpou_flow_pilot_lesson_id'`
  );
  const lessonId = String(req.query.lessonId || pilot.rows[0]?.value || '').trim();
  if (!lessonId) return res.status(400).json({ error: 'lesson_id_required' });

  const grammar = await query(
    `SELECT id, pattern FROM module_grammar WHERE lesson_id = $1 ORDER BY sort_order, created_at`,
    [lessonId]
  );
  if (grammar.rows.length === 0) return res.status(404).json({ error: 'no_grammar_for_lesson' });
  const ids = grammar.rows.map((r) => r.id);
  const patterns = Object.fromEntries(grammar.rows.map((r) => [r.id, r.pattern]));

  // Dibatasi supaya satu klik admin tidak memindai seluruh basis siswa.
  const students = await query(
    `SELECT DISTINCT user_id FROM grammar_attempts
      WHERE grammar_id = ANY($1::uuid[])
      ORDER BY user_id LIMIT 50`,
    [ids]
  );

  const totals = { concepts: 0, changed: 0, unchanged: 0, limitedHistoryConcepts: 0 };
  const byFlag = {};
  const coverage = { attempts: 0, withMetadata: 0 };
  const samples = [];

  for (const row of students.rows) {
    const shadow = await loadMasteryShadow(row.user_id, ids);
    const sum = summarizeShadow(shadow);
    totals.concepts += sum.concepts;
    totals.changed += sum.changed;
    totals.unchanged += sum.unchanged;
    totals.limitedHistoryConcepts += sum.limitedHistoryConcepts;
    coverage.attempts += sum.metadataCoverage.attempts;
    coverage.withMetadata += sum.metadataCoverage.withMetadata;
    for (const [flag, n] of Object.entries(sum.byFlag)) byFlag[flag] = (byFlag[flag] || 0) + n;

    for (const c of shadow.concepts) {
      if (!c.diff.changed || samples.length >= 40) continue;
      samples.push({
        pattern: patterns[c.grammarId] || c.grammarId,
        from: c.diff.from,
        to: c.diff.to,
        withheldReasons: c.diff.withheldReasons,
        flags: c.diff.flags,
        evidenceQuality: c.v2.evidenceQuality,
        attempts: c.v1.attempts,
        independentAttempts: c.v2.evidence.independentAttempts,
        distinctQuestions: c.v2.evidence.distinctQuestions,
        productionPasses: c.v2.evidence.eligibleProductionPasses,
        totalProductionPasses: c.v2.evidence.passed.production,
      });
    }
  }

  const setting = await query(`SELECT value FROM app_settings WHERE key = $1`, [POLICY_SETTING_KEY]);
  res.json({
    lessonId,
    studentsScanned: students.rows.length,
    activePolicy: resolvePolicy(setting.rows[0]?.value),
    proposedPolicy: POLICY_V2,
    // Ditandai eksplisit supaya layar admin tidak pernah menampilkan angka
    // ini seolah sudah jadi kebijakan.
    config: V2_CONFIG,
    totals,
    byFlag,
    metadataCoverage: {
      ...coverage,
      pct: coverage.attempts ? Math.round((coverage.withMetadata / coverage.attempts) * 100) : null,
    },
    samples,
  });
}));

// Bank pola grammar milik MODUL sebuah pelajaran — dipakai dropdown "Pola
// grammar yang diuji" di form soal kuis (migration 122). Terpisah dari
// /module-grammar di atas yang menuntut moduleId: editor kuis cuma memegang
// lessonId, dan menyalurkan moduleId ke seluruh alur Kelola Kuis hanya demi
// satu dropdown tidak sepadan.
router.get('/lessons/:lessonId/grammar-bank', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT g.id, g.pattern, g.meaning
       FROM module_grammar g
       JOIN lessons l ON l.module_id = g.module_id
      WHERE l.id = $1
      ORDER BY g.sort_order ASC, g.created_at ASC`,
    [req.params.lessonId]
  );
  res.json({ grammar: rows.rows });
}));

// ===== AI QUIZ GENERATOR (Claude) =====
// Generate draft soal kuis pakai Claude, grounded ke kosakata + grammar modul
// pelajaran. Endpoint ini TIDAK menyimpan ke DB — balikin draft buat admin
// review/edit di UI, lalu admin simpan lewat POST /admin/quiz-questions.
// ANTHROPIC_API_KEY opsional (kosong -> 503).
const QUIZ_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const QUIZ_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const QUIZ_GEN_SYSTEM = `You are a Japanese-language quiz author for Indonesian learners (JLPT N5/N4) on the EzNihongo platform. Write accurate questions grounded ONLY in the study material provided. CRITICAL: every "explanation" field MUST be written in Indonesian (Bahasa Indonesia), NEVER in Japanese — you may quote Japanese words/phrases inline, but the explanatory sentence itself must be Indonesian. Always reply with a single valid JSON object and nothing else.`;

const quizGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'Tunggu sebentar sebelum generate lagi.' },
});

function _extractJsonObject(text) {
  const str = String(text || '');
  const a = str.indexOf('{');
  const b = str.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(str.slice(a, b + 1)); } catch { return null; }
}

// Jenis soal yang bisa diminta admin -> (questionType, questionCategory).
const QUIZ_KINDS = {
  mc_vocab:   { type: 'multiple_choice', cat: 'vocabulary', label: 'pilihan ganda kosakata (questionType=multiple_choice, questionCategory=vocabulary, 4 opsi 1 benar)' },
  mc_grammar: { type: 'multiple_choice', cat: 'grammar',    label: 'pilihan ganda grammar (multiple_choice, grammar, 4 opsi 1 benar)' },
  fill_blank: { type: 'fill_blank',      cat: 'vocabulary', label: 'isian (questionType=fill_blank, isi "correctAnswer", "options": [])' },
  listening:  { type: 'multiple_choice', cat: 'listening',  label: 'menyimak (multiple_choice, questionCategory=listening, isi "audioScript" dialog gaya JLPT format N:/A:/B:, 4 opsi 1 benar)' },
};

// Prompt generator editable admin (app_settings.quiz_gen_prompt). Placeholder
// diisi per request: {{count}} {{kinds}} {{instruction}} {{vocab}} {{grammar}}.
const QUIZ_GEN_PROMPT_DEFAULT = `Buatkan {{count}} soal kuis bahasa Jepang gaya JLPT N5/N4. Distribusikan sesuai jenis yang diminta.

Jenis soal yang diminta:
{{kinds}}

{{instruction}}
Gunakan HANYA materi di bawah sebagai sumber. Jangan mengarang kosakata atau pola di luar ini.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}

Aturan umum:
- "explanation": 1 kalimat Bahasa Indonesia, alasan/arti singkat.
- multiple_choice: tepat 4 opsi, tepat 1 dengan "isCorrect": true. Distraktor masuk akal & sepadan (panjang/jenis mirip).

Aturan per jenis soal:
- kosakata (questionCategory "vocabulary", multiple_choice) = MOJI-GOI cara baca kanji:
  * field "question" HANYA satu kalimat contoh natural. DILARANG menulis pertanyaan ("読み方は何ですか" dsb) atau tanda kutip 「」 — instruksi mondai sudah otomatis tampil di header section.
  * kata target ditulis KANJI dan WAJIB dibungkus tag <u>…</u> (hanya kata target, bukan seluruh kalimat). Contoh: 私の <u>仕事</u> はエンジニアです。
  * 4 opsi = cara baca HIRAGANA kata target; 1 benar (sesuai "reading" di daftar), 3 salah = kana mirip/diacak (ubah urutan kana, vokal panjang/pendek, dengung す/ず・し/じ, atau っ/つ). Contoh しごと → しゅう, じぎょう, しぎょう.
- grammar (questionCategory "grammar", multiple_choice): kalimat dengan ＿＿ kosong; 4 opsi pola/partikel, 1 benar.
- isian (questionType "fill_blank", questionCategory "vocabulary"): isi "correctAnswer" (jawaban singkat), "options": [].
- menyimak (questionCategory "listening", multiple_choice): "audioScript" WAJIB diisi (soal tanpa audioScript akan DIBUANG) dengan dialog gaya JLPT, alurnya: narator → dialog → pertanyaan diulang. 1 baris per turn dengan prefix speaker, turn dipisah \\n:
  * baris pertama "N: " = narator membacakan kalimat situasi + pertanyaan (contoh: N: 店で、男の人と女の人が話しています。男の人は何を買いますか。)
  * baris tengah = dialog "A: " (perempuan) dan "B: " (laki-laki) bergantian, 3-6 turn — WAJIB ada baris A: dan B:, jangan pakai N: di sini
  * baris terakhir "N: " = pertanyaan yang sama diulang persis
  * N/A/B adalah KODE PERAN suara, BUKAN nama tokoh — dilarang menyebut 「Nさん」「Aさん」 di dialog/pertanyaan. Sebut tokoh sebagai 男の人/女の人/田中さん dsb.
  * dialog harus terdengar ALAMI seperti percakapan sehari-hari — jangan menjejalkan kosakata daftar (cukup 1-3 kata per soal, dipakai wajar); kealamian lebih penting daripada cakupan materi.
  * "question" = HANYA kalimat pertanyaan Jepang yang dibacakan narator. DILARANG menyalin dialog, prefix speaker (N:/A:/B:), atau instruksi meta ("音声を聞いてください" dsb) ke "question".
  4 opsi, 1 benar sesuai isi dialog. (Untuk soal listening per-mondai yang lebih autentik pakai tombol "Generate Listening JLPT".)

Balas HANYA JSON valid tanpa teks lain, bentuk:
{"questions":[{"question":"私の <u>仕事</u> はエンジニアです。","questionType":"multiple_choice","questionCategory":"vocabulary","audioScript":"","correctAnswer":"","explanation":"仕事 dibaca しごと = pekerjaan.","options":[{"text":"しごと","isCorrect":true},{"text":"しゅう","isCorrect":false},{"text":"じぎょう","isCorrect":false},{"text":"しぎょう","isCorrect":false}]},{"question":"女の人は何を買いますか。","questionType":"multiple_choice","questionCategory":"listening","audioScript":"N: 店で、女の人と店の人が話しています。女の人は何を買いますか。\\nA: すみません、りんごを三つください。\\nB: はい。みかんも安いですよ。\\nA: じゃあ、みかんも三つください。\\nN: 女の人は何を買いますか。","correctAnswer":"","explanation":"Perempuan membeli 3 apel lalu menambah 3 jeruk.","options":[{"text":"りんごとみかん","isCorrect":true},{"text":"りんごだけ","isCorrect":false},{"text":"みかんだけ","isCorrect":false},{"text":"バナナ","isCorrect":false}]}]}`;

function _fillTemplate(tpl, vars) {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

async function _loadQuizGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'quiz_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : QUIZ_GEN_PROMPT_DEFAULT;
  } catch {
    return QUIZ_GEN_PROMPT_DEFAULT;
  }
}

// The old bulk quiz generator has no grounded task contract. Reject its
// legacy path; use the scoped JLPT and listening draft generators instead.
router.post('/lessons/:lessonId/generate-quiz', quizGenLimiter, asyncHandler(async (_req, res) => {
  res.status(410).json({ error: 'use_scoped_generate_listening_or_jlpt' });
}));

// Generate opsi pilihan ganda (AI) untuk SATU soal — dipakai tombol "Generate
// opsi" di editor soal admin. Admin tulis pertanyaannya, AI isikan 4 opsi
// (1 benar) + penjelasan. Untuk listening, jawaban di-grounding ke audio
// script. ANTHROPIC_API_KEY kosong → 503.
// Cari definisi tipe mondai di kedua peta (JLPT tulis + listening) supaya
// generate-question-options bisa meminjam aturan "Opsi:" tipe spesifik.
function _taskForType(taskType) {
  if (!taskType) return null;
  return JLPT_GEN_TASKS[taskType] || JLPT_LISTENING_TASKS[taskType] || null;
}

router.post('/generate-question-options', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const question = String(body.question || '').trim().slice(0, 2000);
  const category = normalizeQuizCategory(body.questionCategory);
  const taskType = String(body.taskType || '').trim();
  const task = _taskForType(taskType);
  const optionCount = task ? (task.optionCount || 4) : 4;
  if (!body.lessonId) return res.status(400).json({ error: 'lessonId required' });
  if (!question) return res.status(400).json({ error: 'question required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });
  const lesson = await query(`SELECT id,module_id,slug,type FROM lessons WHERE id=$1`, [body.lessonId]);
  if (!lesson.rows.length) return res.status(404).json({ error: 'lesson not found' });
  let persisted = null;
  if (body.questionId) {
    const stored = await query(`SELECT id,lesson_id,question,question_category,passage,audio_script,updated_at
      FROM quiz_questions WHERE id=$1`, [body.questionId]);
    if (!stored.rows.length) return res.status(404).json({ error: 'question not found' });
    persisted = stored.rows[0];
    if (String(persisted.lesson_id) !== String(body.lessonId) ||
        question !== String(persisted.question).trim() ||
        category !== normalizeQuizCategory(persisted.question_category)) {
      return res.status(409).json({ error: 'question_source_mismatch' });
    }
  }
  const draftPassage = String(body.passage || '').trim().slice(0, 4000);
  const draftAudioScript = String(body.audioScript || '').trim().slice(0, 4000);
  let boundary;
  try { boundary = await getCurriculumBoundary({ lessonId: body.lessonId }); }
  catch { return res.status(503).json({ error: 'boundary_unavailable' }); }
  const sourceReport = validateContentAgainstBoundary({ boundary, contentType: 'quiz_question',
    operation: 'generate', fields: [boundaryField('question', question),
      boundaryField('passage', persisted?.passage || draftPassage),
      boundaryField('audioScript', persisted?.audio_script || draftAudioScript)] });
  if (sourceReport.status !== 'evaluated' || sourceReport.valid !== true) {
    return groundedResponse(res, { status: 'rejected', candidate: null,
      report: sourceReport, decision: decideBoundaryAction({ mode: boundary.course.mode,
        operation: 'generate', report: sourceReport }), attempts: [],
      boundaryFingerprint: boundary.boundaryFingerprint, sourceFingerprint: null },
    { options: [] }, 422);
  }
  const loadSource = async () => {
    const currentLesson = await query(`SELECT id,module_id,slug,type FROM lessons WHERE id=$1`, [body.lessonId]);
    if (!currentLesson.rows.length) throw new Error('lesson_changed');
    if (!persisted) return { lesson: currentLesson.rows[0], draft: {
      question, passage: draftPassage, audioScript: draftAudioScript } };
    const currentQuestion = await query(`SELECT id,lesson_id,question,question_category,passage,audio_script,updated_at
      FROM quiz_questions WHERE id=$1`, [body.questionId]);
    if (!currentQuestion.rows.length) throw new Error('question_changed');
    return { lesson: currentLesson.rows[0], question: currentQuestion.rows[0] };
  };
  const sourceText = persisted?.passage || persisted?.audio_script || draftPassage || draftAudioScript || '';
  const result = await groundedDraft({ scope: { lessonId: body.lessonId },
    contentType: 'quiz_question', loadSource, body, maxTokens: 800,
    scenario: `Draft question: ${question}; source: ${sourceText}`,
    instruction: `Create exactly ${optionCount} answer options for this Japanese learning question: ${JSON.stringify(question)}. Category: ${category}. ${task ? `Task: ${task.name}. ${String(task.rules || '').split(/\nBalas\s*:/)[0]}` : ''} ${sourceText ? `Persisted source: ${sourceText}` : ''} Return {"options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false}],"explanation":"..."}. Exactly one isCorrect must be true.`,
    transformCandidate: parsed => {
      if (!Array.isArray(parsed.options) || parsed.options.some(option =>
        !option || typeof option.text !== 'string' || typeof option.isCorrect !== 'boolean')) return parsed;
      const correct = parsed.options.flatMap((option, index) => option.isCorrect ? [index] : []);
      if (correct.length !== 1 || typeof parsed.explanation !== 'string') return parsed;
      return { question: { prompt: question, options: parsed.options.map(option => option.text),
        correctIndex: correct[0], explanation: parsed.explanation } };
    } });
  const candidateQuestion = result.candidate?.question;
  const options = candidateQuestion?.options?.map((text, index) =>
    ({ text, isCorrect: index === candidateQuestion.correctIndex })) || [];
  if (result.status === 'ready' && (options.length !== optionCount ||
      (task && !_normalizeJlptOptions(options, optionCount, taskType, question)))) {
    rejectGroundedResult(result, { code: 'question_options_task_mismatch' });
  }
  return groundedResponse(res, result, { options: result.status === 'ready' ? options : [],
    explanation: result.status === 'ready' ? candidateQuestion?.explanation || '' : '' });
}));

// ===== GENERATOR SOAL LISTENING GAYA JLPT (Claude) =====
// Satu run = satu tipe mondai JLPT (課題理解 / ポイント理解 / 発話表現 / 即時応答).
// AI menghasilkan soal LENGKAP: audioScript dialog format 3-voice (N:/A:/B:,
// sama dgn format yang dimengerti parseDialog di tts.js) + pertanyaan + opsi +
// penjelasan. Draft TIDAK disimpan — admin review di UI lalu simpan via
// POST /admin/quiz-questions, masuk section listening sesuai nomor mondai.
//
// Struktur tiap tipe mengikuti format resmi ujian JLPT N5/N4:
// - 課題理解 (mondai 1): N: situasi+pertanyaan → dialog A/B → N: pertanyaan
//   diulang. Pertanyaan = aksi berikutnya / barang yang dibeli. 4 opsi.
// - ポイント理解 (mondai 2): kerangka sama, pertanyaan menarget satu poin
//   (alasan/waktu/tempat/orang). 4 opsi.
// - 発話表現 (mondai 3): N: situasi singkat + 「何と言いますか。」. 3 opsi ucapan.
// - 即時応答 (mondai 4): satu ucapan pendek A/B tanpa narator. 3 opsi balasan.
// (Di ujian asli opsi mondai 3/4 dibacakan, tidak dicetak — di platform kita
// opsi tampil di layar; kompromi yang disengaja.)
const JLPT_LISTENING_TASKS = {
  kadai: {
    number: 1,
    label: 'もんだい1 課題理解',
    instruction: 'もんだい1では、はじめに しつもんを きいて ください。それから はなしを きいて、1から4の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 4,
    name: '課題理解 (memahami tugas/aksi berikutnya)',
    rules: `Struktur audioScript WAJIB:
- Baris pertama → N: [kalimat situasi][pertanyaan]. Pola situasi baku: 「店で、男の人と女の人が話しています。」「学校で先生が話しています。」 Pertanyaan menarget AKSI berikutnya atau barang/jumlah: 「男の人はこのあとまず何をしますか。」「女の人は何を買いますか。」
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian. WAJIB ada minimal satu baris A: DAN satu baris B: — narator (N:) HANYA untuk baris pertama & terakhir, JANGAN pakai N: untuk isi dialog.
- Baris terakhir → N: [pertanyaan yang SAMA PERSIS diulang].
Konvensi distraktor: dialog menyinggung opsi-opsi lain secara ALAMI lalu mengeliminasinya di alur percakapan (sudah dikerjakan / untuk besok / batal — 「もう〜ました」「やっぱり」「その前に」「あとで」). Tidak wajib menyebut semua opsi kalau hasilnya jadi kaku — kealamian lebih penting. Jawaban TIDAK boleh hanya dari kalimat pertama dialog.
"question" = teks pertanyaan Jepang yang sama dengan yang dibacakan narator.
Opsi: 4 frasa Jepang pendek (bukan kalimat panjang), TEPAT 1 benar.`,
  },
  point: {
    number: 2,
    label: 'もんだい2 ポイント理解',
    instruction: 'もんだい2では、はじめに しつもんを きいて ください。それから はなしを きいて、1から4の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 4,
    name: 'ポイント理解 (menangkap poin spesifik)',
    rules: `Struktur audioScript WAJIB:
- Baris pertama → N: [kalimat situasi][pertanyaan]. Pertanyaan menarget SATU poin spesifik: alasan (どうして), waktu (いつ/何時), tempat (どこ), orang (だれ), atau hal yang disukai/tidak. Contoh pola: 「女の人はどうしてパーティーに行きませんか。」「二人は何時に会いますか。」
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian; sedikit lebih panjang dari mondai 1. WAJIB ada minimal satu baris A: DAN satu baris B: — narator (N:) HANYA untuk baris pertama & terakhir, JANGAN pakai N: untuk isi dialog.
- Baris terakhir → N: [pertanyaan yang SAMA PERSIS diulang].
Konvensi distraktor: dialog menyebut beberapa kandidat jawaban yang salah sebelum jawaban benar muncul (mis. tebakan pertama lawan bicara salah, lalu dikoreksi).
"question" = teks pertanyaan Jepang yang sama dengan yang dibacakan narator.
Opsi: 4 frasa/klausa Jepang pendek, TEPAT 1 benar.`,
  },
  hatsuwa: {
    number: 3,
    label: 'もんだい3 発話表現',
    instruction: 'もんだい3では、ぶんを きいて、1から3の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 3,
    name: '発話表現 (memilih ucapan yang tepat untuk situasi)',
    rules: `Struktur audioScript WAJIB (pendek; HANYA narator — pilihan TIDAK dibacakan karena sudah tampil di layar siswa):
- Satu baris saja → N: [1-2 kalimat situasi]。何と言いますか。 Contoh pola: 「朝、学校で先生に会いました。何と言いますか。」「友達の消しゴムを使いたいです。何と言いますか。」 JANGAN tulis baris lain selain baris N: ini.
"question" = teks yang SAMA PERSIS dengan baris narator (tanpa prefix N:).
Opsi (field "options"): 3 ucapan Jepang pendek (3-8 kata), TEPAT 1 benar. Distraktor memakai kesalahan khas: arah memberi-menerima (あげます/くれます/もらいます), tingkat kesopanan salah, atau set phrase tertukar (いただきます vs ごちそうさま, 失礼します vs すみません).`,
  },
  sokuji: {
    number: 4,
    label: 'もんだい4 即時応答',
    instruction: 'もんだい4では、ぶんを きいて、1から3の なかから、いちばん いい へんじを ひとつ えらんで ください。',
    optionCount: 3,
    name: '即時応答 (respon cepat percakapan)',
    rules: `Struktur audioScript WAJIB (paling pendek, TANPA narator; balasan TIDAK dibacakan karena sudah tampil di layar siswa):
- Satu baris saja → A: [satu ucapan pendek] ATAU B: [satu ucapan pendek] (pertanyaan/permintaan/komentar 1 kalimat). Contoh pola: 「お国はどちらですか。」「この荷物、ちょっと持ってもらえない？」 JANGAN tulis baris lain.
"question" = teks tetap: いちばん いい へんじを えらんで ください。
Opsi (field "options"): 3 balasan Jepang sangat pendek (2-6 kata) seolah diucapkan LAWAN bicara, TEPAT 1 benar. Distraktor memakai: kata tanya tertukar (どちら = tempat vs pilihan), mengulang kata dari ucapan dengan makna salah, pasangan set phrase salah, atau bentuk waktu tidak nyambung.`,
  },
};

const JLPT_LISTENING_LEVELS = {
  N5: `Level N5 (KETAT — pelajar pemula sekali): dialog 3-6 turn (di luar baris narator), total dialog ±80-120 karakter. SEMUA bentuk sopan です/ます, kalimat pendek satu klausa. Kosakata HANYA dari ±800 kata inti N5 — kalau ragu sebuah kata masuk N5, JANGAN pakai, ganti kata dari daftar Bab. Angka/hari/jam diucapkan jelas. Tepat SATU "jebakan" revisi per dialog (mis. 「あ、やっぱり三つでいいです」). Setting: rumah, sekolah, toko, stasiun, restoran, rumah teman.`,
  N4: `Level N4: dialog 4-8 turn, total dialog ±120-200 karakter. Boleh satu pertukaran bentuk kasual antar teman; pegawai/staf boleh keigo ringan (いらっしゃいませ dsb). Boleh dua jebakan per dialog. Grammar boleh: 〜てもいい/〜てはいけない, 〜なければならない, kondisional と/ば/たら, あげる/くれる/もらう, bentuk potensial. Setting: + kantor, dokter, telepon, pengumuman stasiun.`,
};

// Prompt wrapper editable admin (app_settings.listening_gen_prompt).
// Placeholder per request: {{count}} {{level}} {{taskName}} {{taskRules}}
// {{levelRules}} {{topic}} {{vocab}} {{grammar}} {{avoid}}.
const LISTENING_GEN_PROMPT_DEFAULT = `Buatkan {{count}} soal LISTENING bahasa Jepang gaya ujian JLPT {{level}}, tipe {{taskName}}.

{{taskRules}}

{{levelRules}}

Format speaker audioScript (1 baris per turn, prefix + titik dua):
- "N: " = narator (membacakan situasi & pertanyaan)
- "A: " = pembicara perempuan
- "B: " = pembicara laki-laki

{{topic}}
GROUNDING MATERI (penting — soal ini ujian untuk Bab tertentu):
- Tiap dialog WAJIB berpusat pada kosakata/pola dari daftar di bawah — topik percakapan dan kata kuncinya (termasuk jawaban benar) diambil dari materi Bab.
- Kata konten lain di luar daftar hanya jika perlu melengkapi percakapan, dan WAJIB selevel. Kata fungsi (partikel, salam, angka, kata tanya) bebas.
- JANGAN menjejalkan banyak kata daftar ke satu dialog sampai kaku — cukup 2-3 kata daftar dipakai secara luwes per dialog, yang penting kata yang DIUJI berasal dari daftar.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}
{{avoid}}
Aturan umum:
- Dialog harus terdengar ALAMI seperti percakapan sehari-hari orang Jepang — bukan kalimat contoh buku teks yang kaku. Boleh respon pendek alami (そうですか、いいですね、あ、すみません) secukupnya.
- Setiap soal harus berdiri sendiri dengan situasi/topik BERBEDA satu sama lain.
- TEPAT 1 opsi "isCorrect": true per soal. Distraktor sepadan (panjang/jenis mirip), masuk akal, dan disebut/terkait di dialog.
- "explanation": WAJIB Bahasa Indonesia (JANGAN bahasa Jepang; frasa Jepang boleh dikutip), 1-2 kalimat — kutip frasa kunci dialog yang menentukan jawaban.
- audioScript maksimal 1200 karakter.

Balas HANYA JSON valid tanpa teks lain, bentuk:
{"questions":[{"question":"...","audioScript":"N: ...\\nB: ...\\nA: ...\\nN: ...","options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"explanation":"..."}]}`;

async function _loadListeningGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'listening_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : LISTENING_GEN_PROMPT_DEFAULT;
  } catch {
    return LISTENING_GEN_PROMPT_DEFAULT;
  }
}

router.get('/settings/listening-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'listening_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: LISTENING_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/listening-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('listening_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

router.post('/lessons/:lessonId/generate-listening', quizGenLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const taskType = String(req.body?.taskType || '');
  const task = JLPT_LISTENING_TASKS[taskType];
  if (!task) return res.status(400).json({ error: 'bad_task', detail: 'taskType harus kadai/point/hatsuwa/sokuji.' });
  const count = Math.min(8, Math.max(1, Math.trunc(Number(req.body?.count) || 3)));
  const topic = String(req.body?.topic || '').slice(0, 300).trim();
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const lessonRes = await query(`SELECT l.id,l.module_id,l.type,c.level
    FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
    WHERE l.id=$1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });
  const level = String(lesson.level || '').toUpperCase();
  if (!JLPT_LISTENING_LEVELS[level]) return res.status(422).json({ error: 'unsupported_course_level' });
  if (req.body?.level && String(req.body.level).toUpperCase() !== level) {
    return res.status(409).json({ error: 'course_level_mismatch' });
  }

  // Grounding vocab + grammar modul — query sama dgn generate-quiz.
  let vocabRes = await query(
    `SELECT DISTINCT v.japanese, v.reading, v.indonesian, v.category
     FROM module_vocabulary v
     JOIN lesson_deck_items di ON di.vocabulary_id = v.id
     JOIN lessons l ON l.id = di.lesson_id
     WHERE l.module_id = $1 AND l.type = 'deck' AND v.japanese IS NOT NULL AND v.japanese <> ''
     LIMIT 80`,
    [lesson.module_id]
  );
  if (vocabRes.rows.length < 4) {
    vocabRes = await query(
      `SELECT japanese, reading, indonesian, category
       FROM module_vocabulary
       WHERE module_id = $1 AND japanese IS NOT NULL AND japanese <> ''
       LIMIT 80`,
      [lesson.module_id]
    );
  }
  const grammarRes = await query(
    `SELECT pattern, meaning, example FROM module_grammar
     WHERE module_id = $1 AND pattern IS NOT NULL AND pattern <> ''
     LIMIT 30`,
    [lesson.module_id]
  );

  // Anti-duplikat: kasih AI baris situasi soal listening yang sudah ada.
  const existingRes = await query(
    `SELECT audio_script, question FROM quiz_questions
     WHERE lesson_id = $1 AND question_category = 'listening'
     ORDER BY created_at DESC LIMIT 30`,
    [lessonId]
  );
  const avoidLines = existingRes.rows
    .map((r) => String(r.audio_script || r.question || '').split('\n')[0].trim())
    .filter(Boolean);

  const vocabLines = vocabRes.rows.map((v) =>
    `- ${v.japanese}${v.reading ? ` (${v.reading})` : ''} = ${v.indonesian || '?'}${v.category ? ` [${v.category}]` : ''}`).join('\n');
  const grammarLines = grammarRes.rows.map((g) =>
    `- ${g.pattern}${g.meaning ? ` = ${g.meaning}` : ''}${g.example ? `. Contoh: ${g.example}` : ''}`).join('\n');

  const promptTpl = await _loadListeningGenPrompt();
  const userContent = _fillTemplate(promptTpl, {
    count,
    level,
    taskName: task.name,
    taskRules: task.rules,
    levelRules: JLPT_LISTENING_LEVELS[level],
    topic: topic ? `Topik/instruksi tambahan dari admin: ${topic}\n` : '',
    vocab: vocabLines || '(tidak ada — pakai kosakata standar level ini)',
    grammar: grammarLines || '(tidak ada — pakai grammar standar level ini)',
    avoid: avoidLines.length
      ? `\nSoal listening yang SUDAH ADA di kuis ini (jangan bikin situasi/pertanyaan serupa):\n${avoidLines.map((s) => `- ${s.slice(0, 120)}`).join('\n')}\n`
      : '',
  });

  const loadSource = async () => {
    const currentLesson = await query(`SELECT l.id,l.module_id,l.type,c.level
      FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
      WHERE l.id=$1`, [lessonId]);
    if (!currentLesson.rows.length || currentLesson.rows[0].type !== 'quiz') throw new Error('lesson_changed');
    const currentQuestions = await query(`SELECT audio_script,question FROM quiz_questions
      WHERE lesson_id=$1 AND question_category='listening'
      ORDER BY created_at DESC LIMIT 30`, [lessonId]);
    return { lesson: currentLesson.rows[0], existingQuestions: currentQuestions.rows,
      promptTemplate: await _loadListeningGenPrompt() };
  };
  const result = await groundedDraft({ scope: { lessonId }, body: req.body || {},
    contentType: 'listening_batch', loadSource, instruction: userContent,
    system: QUIZ_GEN_SYSTEM, model: ANTHROPIC_GEN_MODEL, maxTokens: 4096,
    transformCandidate: parsed => legacyQuizBatchToCanonical(parsed, { listening: true }),
    additionalSchemaIssues: candidate => {
      const issues = [];
      if (!Array.isArray(candidate.questions) || candidate.questions.length !== count) {
        issues.push({ code: 'listening_question_count_mismatch', expected: count });
      }
      for (const [index, question] of (Array.isArray(candidate.questions) ? candidate.questions : []).entries()) {
        if (!question || typeof question.prompt !== 'string' || question.prompt.includes('\n') ||
            /^[A-Za-z]{1,3}:\s*/u.test(question.prompt) || question.prompt.length > 1000 ||
            !Array.isArray(question.options) || question.options.length !== task.optionCount ||
            question.options.some(option => typeof option !== 'string' || option.length > 300)) {
          issues.push({ code: 'listening_question_format_invalid', questionIndex: index });
        }
        const turns = typeof question?.audioScript === 'string' ? parseDialog(question.audioScript) : null;
        if (!turns || (taskType === 'kadai' || taskType === 'point'
          ? turns.length < 3 || !turns.some(turn => /^(A|W|F|女)/iu.test(String(turn.speaker))) ||
            !turns.some(turn => /^(B|M|男)/iu.test(String(turn.speaker)))
          : turns.length > 2)) {
          issues.push({ code: 'listening_audio_format_invalid', questionIndex: index });
        }
      }
      return issues;
    } });
  const clean = result.status === 'ready' ? result.candidate.questions.map(question => ({
    question: question.prompt, audioScript: question.audioScript,
    options: legacyQuizOptions(question), explanation: question.explanation || '',
  })) : [];
  return groundedResponse(res, result, {
    questions: clean,
    section: { number: task.number, label: task.label, instruction: task.instruction },
    vocabPool: vocabRes.rows.length,
    grammarPool: grammarRes.rows.length,
  });
}));

// ===== GENERATOR SOAL JLPT PER-MONDAI: VOCAB (文字・語彙) / GRAMMAR (文法) /
// DOKKAI (読解) =====
// Saudara dari generate-listening: satu run = satu tipe mondai, draft di-review
// admin lalu disimpan via POST /admin/quiz-questions ke section kategori-nya
// (section_number = nomor mondai). Tugas ber-passage (dokkai + 文章の文法)
// minta AI balas {"passages":[{passage, questions:[...]}]} lalu di-flatten —
// semua soal satu bacaan membawa string passage IDENTIK (kunci grouping render
// di welcome.html).
const JLPT_GEN_TASKS = {
  // --- 文字・語彙 (vocabulary) ---
  goi_kanji: {
    category: 'vocabulary', number: 1, optionCount: 4,
    label: 'もんだい1 漢字読み',
    instruction: '＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '漢字読み (cara baca kanji)',
    rules: `Format soal: "question" = SATU kalimat Jepang natural; kata target ditulis KANJI (isi <u>…</u> WAJIB mengandung kanji, BUKAN kana) dan WAJIB dibungkus tag <u>…</u> (hanya kata target). Contoh: 私の <u>仕事</u> はエンジニアです。 DILARANG menulis kalimat tanya meta ("読み方は何ですか" dsb) — instruksi mondai sudah tampil otomatis.
Opsi: 4 cara baca HIRAGANA kata target (hiragana saja, tanpa kanji/romaji); 1 benar, 3 distraktor kana mirip: vokal panjang/pendek (おばさん/おばあさん), dakuten (か/が, す/ず), っ kecil (きて/きって), urutan kana ditukar.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_hyouki: {
    category: 'vocabulary', number: 2, optionCount: 4,
    label: 'もんだい2 表記',
    instruction: '＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '表記 (penulisan kanji/katakana)',
    rules: `Format soal: "question" = SATU kalimat Jepang; kata target ditulis HIRAGANA dan dibungkus <u>…</u>. Contoh: わたしは <u>でんしゃ</u>で がっこうへ いきます。 DILARANG menulis bentuk KANJI kata target di mana pun dalam kalimat (isi <u>…</u> WAJIB hiragana, tanpa kanji) — kalau kanjinya tertulis di soal, jawabannya bocor.
Opsi: 4 penulisan kanji (atau katakana utk kata serapan) kata target; 1 benar, 3 distraktor kanji mirip visual (電/雷, 持/待, 牛/午) atau katakana mirip (シ/ツ, ソ/ン).
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_bunmyaku: {
    category: 'vocabulary', number: 3, optionCount: 4,
    label: 'もんだい3 文脈規定',
    instruction: '（　）に なにを いれますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '文脈規定 (kata sesuai konteks)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan bagian kosong ditulis （　）. Contoh: あついですから、まどを（　）ください。
Opsi: 4 kata Jepang SEKELAS kata (semuanya kata kerja, atau semuanya kata benda, dst); 1 cocok konteks, 3 distraktor sekelas tapi nuansa/konteks salah.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_iikae: {
    category: 'vocabulary', number: 4, optionCount: 4,
    label: 'もんだい4 言い換え類義',
    instruction: '＿＿の ぶんと だいたい おなじ いみの ぶんが あります。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '言い換え類義 (makna terdekat / parafrase)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan kata/frasa target dibungkus <u>…</u>. Contoh: この へやは <u>くらい</u>です。
Opsi: 4 kalimat Jepang parafrase dari kalimat soal; 1 maknanya sama, 3 distraktor: antonim, konsep terkait tapi beda, salah tangkap makna kiasan.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_yougou: {
    category: 'vocabulary', number: 5, optionCount: 4,
    label: 'もんだい5 用法',
    instruction: 'つぎの ことばの つかいかたで いちばん いい ものを 1・2・3・4から ひとつ えらんで ください。',
    name: '用法 (penggunaan kata — N4)',
    rules: `Format soal: "question" = HANYA kata targetnya saja (1 kata Jepang, tanpa kalimat). Contoh: るす
Opsi: 4 kalimat Jepang yang SEMUANYA memuat kata target; TEPAT 1 yang penggunaannya benar (makna + kelas kata + kolokasi), 3 distraktor memakai kata itu di konteks yang salah/tidak natural.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  // --- 文法 (grammar) ---
  bunpou_keishiki: {
    category: 'grammar', number: 1, optionCount: 4,
    label: 'もんだい1 文の文法1',
    instruction: '（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    name: '文の文法1 (pilih bentuk/partikel)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan bagian kosong （　）. Contoh: わたしは バス（　）がっこうへ 行きます。
Opsi: 4 partikel ATAU 4 bentuk konjugasi dari kata yang sama; 1 benar, 3 distraktor = kesalahan khas pembelajar (partikel tertukar は/が/を/に/で, bentuk て/た/ない tertukar).
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  bunpou_kumitate: {
    category: 'grammar', number: 2, optionCount: 4,
    label: 'もんだい2 文の組み立て',
    instruction: '＿★＿に 入る ものは どれですか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    name: '文の組み立て (susun kalimat ★)',
    rules: `Format soal: "question" = kalimat dengan 4 slot kosong berurutan, salah satu diberi tanda bintang, ditulis PERSIS dengan pola: [awal kalimat]＿＿　＿＿　＿★＿　＿＿[akhir kalimat]。 (underscore full-width ＿, dipisah spasi full-width; posisi ★ boleh di slot mana saja).
Opsi: 4 POTONGAN kalimat BERBEDA yang SEMUANYA dipakai mengisi keempat slot, masing-masing TEPAT SATU KALI — [awal kalimat] + keempat potongan tersusun + [akhir kalimat] HARUS PERSIS membentuk kalimat utuh yang gramatikal (kalimat itu wajib ditulis di "explanation"; server memverifikasi dengan menyusun ulang potongan, draft yang tidak bisa disusun DIBUANG). DILARANG: (a) opsi berupa kata-kata alternatif yang hanya satu dipakai; (b) 4 opsi yang merupakan acakan urutan dari potongan yang sama (mis. 弟は銀行員 / は弟銀行員 / …); (c) 4 kata benda polos tanpa partikel — tiap potongan biasanya membawa partikelnya (「友だちと」「えいがを」「見に」). Campur jenis potongan (frasa benda+partikel / kata kerja / pelengkap) supaya urutannya menantang. "isCorrect": true HANYA pada potongan yang jatuh di posisi ★.
Contoh lengkap: question = きのう　＿＿　＿＿　＿★＿　＿＿。 opsi = 友だちと / えいがを / 見に / 行きました → susunan benar: きのう友だちとえいがを見に行きました。 → posisi ★ (slot ke-3) diisi 見に → "isCorrect": true di 見に.
"explanation" WAJIB menampilkan kalimat utuh dengan urutan benar (memuat KEEMPAT potongan) + terjemahan Indonesia singkat.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  bunpou_bunshou: {
    category: 'grammar', number: 3, optionCount: 4, needsPassage: true, qPerPassage: [1, 5],
    label: 'もんだい3 文章の文法',
    instruction: 'ぶんしょうの いみを かんがえて、（①）から（⑤）の 中に 入る いちばん いい ものを 1・2・3・4から 一つ えらんで ください。',
    name: '文章の文法 (cloze wacana — isi blank dalam teks)',
    rules: `Buat SATU wacana/teks pendek Jepang (cerita harian, surat, sakubun siswa; ±80-150 karakter utk N5, ±150-250 utk N4) berisi blank bernomor ditulis （①）（②）… sesuai jumlah soal yang diminta.
Tiap soal = satu blank: "question" = （①）に 入る ものは どれですか。 (sesuai nomornya); 4 opsi partikel/bentuk/kata penghubung yang cocok di blank itu, 1 benar.
Balas: {"passages":[{"passage":"[teks dengan （①）（②）…]","questions":[{"question":"（①）に 入る ものは どれですか。","options":[{"text":"...","isCorrect":true},...],"explanation":"..."},...]}]}`,
  },
  // --- 読解 (reading / dokkai) ---
  dokkai_tanbun: {
    category: 'reading', number: 1, optionCount: 4, needsPassage: true, qPerPassage: [1, 1],
    label: 'もんだい1 内容理解（短文）',
    instruction: 'つぎの ぶんしょうを よんで、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '内容理解・短文 (bacaan pendek, 1 soal/bacaan)',
    rules: `Tiap item = SATU bacaan pendek (±80-100 karakter utk N5, ±150-200 utk N4; topik harian: catatan, email pendek, pengalaman) + TEPAT 1 soal pemahaman.
Soal menarget: isi eksplisit, ide utama, atau inferensi sederhana. "question" = kalimat tanya Jepang. 4 opsi Jepang pendek, 1 benar (jawaban HARUS dari isi bacaan, distraktor = info yang disinggung tapi bukan jawaban).
Balas: {"passages":[{"passage":"...","questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}]}`,
  },
  dokkai_chuubun: {
    category: 'reading', number: 2, optionCount: 4, needsPassage: true, qPerPassage: [2, 3],
    label: 'もんだい2 内容理解（中文）',
    instruction: 'つぎの ぶんしょうを よんで、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '内容理解・中文 (bacaan sedang, 2-3 soal/bacaan)',
    rules: `Tiap item = SATU bacaan sedang (±200-300 karakter utk N5, ±400-600 utk N4; esai pendek/pengalaman/opini sederhana) + 2-3 soal pemahaman tentang bacaan YANG SAMA.
Soal menarget: alasan (どうして), maksud penulis, detail, urutan kejadian — tiap soal menarget bagian BERBEDA dari bacaan. 4 opsi, 1 benar.
Balas: {"passages":[{"passage":"...","questions":[{...},{...}]}]} — semua soal satu bacaan di array "questions" passage itu.`,
  },
  dokkai_jouhou: {
    category: 'reading', number: 3, optionCount: 4, needsPassage: true, qPerPassage: [2, 2],
    label: 'もんだい3 情報検索',
    instruction: 'つぎの おしらせを みて、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '情報検索 (cari info dari pengumuman/jadwal)',
    rules: `Tiap item = SATU teks praktis (pengumuman, jadwal, poster acara, brosur toko; ±150-350 karakter) ditulis TEKS POLOS per baris (label: isi, tanpa tabel/markdown). Contoh format:
としょかんの りようじかん
げつようび〜きんようび：9じ〜18じ
どようび・にちようび：10じ〜16じ
おやすみ：まいしゅう げつようび
+ TEPAT 2 soal mencari/membandingkan info spesifik (jam, hari, harga, syarat). 4 opsi, 1 benar.
Balas: {"passages":[{"passage":"...","questions":[{...},{...}]}]}`,
  },
};

const JLPT_GEN_LEVELS = {
  N5: `Level N5 (KETAT — ini pelajar pemula sekali):
- Kosakata HANYA dari ±800 kata inti N5. Kalau ragu sebuah kata masuk N5 atau bukan, JANGAN pakai — ganti dengan kata dari daftar kosakata Bab.
- Kanji HANYA ±100 kanji dasar N5 (日 月 火 水 木 金 土 人 大 小 山 川 田 中 上 下 左 右 前 後 年 時 分 今 何 私 行 来 見 食 飲 読 書 話 聞 買 学 校 生 先 国 dst). Kata dengan kanji di luar itu WAJIB ditulis hiragana/katakana.
- SEMUA kalimat bentuk sopan です/ます, satu klausa sederhana (tanpa kalimat majemuk), pendek.
- Topik: rumah, sekolah, belanja, makanan, waktu, cuaca, keluarga, perkenalan.`,
  N4: `Level N4: kosakata ±1500 kata / ±300 kanji (kanji di luar itu tulis kana), boleh bentuk kasual & 〜てもいい/〜なければならない/potensial/あげるくれるもらう, kalimat majemuk sederhana. Topik: + pekerjaan, kesehatan, rencana, perasaan, pengalaman.`,
};

// Prompt wrapper editable admin (app_settings.jlpt_gen_prompt). Placeholder:
// {{count}} {{level}} {{taskName}} {{taskRules}} {{levelRules}} {{topic}}
// {{vocab}} {{grammar}} {{avoid}}. Bentuk JSON output ditentukan aturan
// per-tipe ({{taskRules}}).
const JLPT_GEN_PROMPT_DEFAULT = `Buatkan {{count}} {{unit}} soal bahasa Jepang gaya ujian JLPT {{level}}, tipe {{taskName}}.

{{taskRules}}

{{levelRules}}

{{topic}}
GROUNDING MATERI (penting — soal ini ujian untuk Bab tertentu):
- KATA TARGET yang diuji tiap soal WAJIB diambil dari daftar kosakata di bawah (untuk soal kosakata: kata yang digarisbawahi/diisi; untuk grammar: pola dari daftar grammar). Hanya kalau daftar benar-benar tidak punya kata yang cocok untuk format mondai ini, boleh pakai kata umum selevel.
- Kata KONTEN lain (benda/kerja/sifat) di kalimat & opsi: utamakan dari daftar juga; di luar daftar hanya jika perlu melengkapi kalimat, dan WAJIB selevel.
- Kata fungsi (partikel, kopula, angka, kata tanya, salam) bebas.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}
{{avoid}}
Aturan umum:
- Kalimat & teks harus terdengar ALAMI seperti bahasa Jepang sehari-hari — bukan kalimat buku teks kaku. Alami TIDAK berarti boleh keluar dari materi: pakai kosakata daftar dengan cara yang luwes.
- Setiap soal berdiri sendiri dengan topik/situasi BERBEDA satu sama lain.
- TEPAT 1 opsi "isCorrect": true per soal. Distraktor sepadan (panjang/jenis mirip) dan menarget kesalahan khas pembelajar, bukan asal-asalan.
- "explanation": WAJIB Bahasa Indonesia (JANGAN bahasa Jepang; kata/pola Jepang boleh dikutip), 1-2 kalimat, jelaskan kenapa jawaban benar (sebut arti kata/pola kuncinya).
- Balas HANYA JSON valid tanpa teks lain, dengan bentuk PERSIS seperti dicontohkan di aturan tipe soal di atas.`;

async function _loadJlptGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'jlpt_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : JLPT_GEN_PROMPT_DEFAULT;
  } catch {
    return JLPT_GEN_PROMPT_DEFAULT;
  }
}

router.get('/settings/jlpt-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'jlpt_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: JLPT_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/jlpt-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('jlpt_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

// Validasi struktural per tipe mondai — draft yang melanggar format dibuang
// (pola sama dgn validasi listening). Return question ternormalisasi atau null.
function _validateJlptQuestion(taskType, rawQuestion) {
  const question = String(rawQuestion || '').split('\n')[0].trim().slice(0, 1000);
  if (!question) return null;
  const HAS_U = /<u>[^<]+<\/u>/;
  const KANJI_RE = /[一-鿿々]/;
  // Isi tag <u>…</u> (kata target) — dicek jenis hurufnya per tipe.
  const uContent = question.match(/<u>([^<]+)<\/u>/)?.[1] || '';
  switch (taskType) {
    case 'goi_kanji':
      // 漢字読み: kata target wajib KANJI (kalau kana semua, soal "baca
      // kanji"-nya trivial).
      if (!HAS_U.test(question) || !KANJI_RE.test(uContent)) return null;
      break;
    case 'goi_hyouki':
      // 表記: kata target wajib KANA (tanpa kanji) — kalau kanji-nya sudah
      // tertulis di soal, jawaban bocor (opsi benar = kanji yang sama).
      if (!HAS_U.test(question) || KANJI_RE.test(uContent)) return null;
      break;
    case 'goi_iikae':
      if (!HAS_U.test(question)) return null;
      break;
    case 'goi_bunmyaku':
    case 'bunpou_keishiki':
      if (!question.includes('（　）') && !question.includes('＿＿') && !/（\s*）/.test(question)) return null;
      break;
    case 'goi_yougou':
      if (question.length > 30 || HAS_U.test(question)) return null;
      break;
    case 'bunpou_kumitate':
      if (!question.includes('★') || (question.match(/＿＿/g) || []).length < 3) return null;
      break;
    case 'bunpou_bunshou':
      if (!/[①②③④⑤]/.test(question)) return null;
      break;
    default:
      break;
  }
  return question;
}

function _normalizeJlptOptions(rawOptions, optionCount, taskType, question) {
  let options = Array.isArray(rawOptions)
    ? rawOptions.map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect })).filter((o) => o.text)
    : [];
  if (options.length < 2) return null;
  options = options.slice(0, optionCount);
  // goi_kanji: opsi wajib hiragana murni (cara baca).
  if (taskType === 'goi_kanji' && !options.every((o) => /^[぀-ゟー\s]+$/.test(o.text))) return null;
  // goi_yougou: semua opsi harus memuat kata target (= question).
  if (taskType === 'goi_yougou' && question && !options.every((o) => o.text.includes(question))) return null;
  let firstCorrect = options.findIndex((o) => o.isCorrect);
  if (firstCorrect === -1) firstCorrect = 0;
  // goi_hyouki: jawaban (penulisan kanji) tidak boleh muncul di kalimat soal
  // — kalau muncul, jawabannya bocor (jaring pengaman kedua di samping cek
  // kana-only pada isi <u> di _validateJlptQuestion).
  if (taskType === 'goi_hyouki' && question && question.includes(options[firstCorrect].text)) return null;
  return options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
}

// 組み立て: verifikasi matematis bahwa soalnya beneran puzzle susun-kalimat.
// Kalimat soal = [prefix][4 slot][suffix]; kalimat utuh (wajib ada di
// explanation) harus PERSIS prefix + keempat potongan dalam suatu urutan +
// suffix (whitespace diabaikan). Coba 24 permutasi; kalau ada yang cocok,
// return indeks opsi yang jatuh di slot ★ (= kunci jawaban terverifikasi —
// dipakai meng-override penandaan model). Kalau tidak ada → null (soal
// pilihan-kata menyamar susun-kalimat, atau partikel penyambung hilang).
function _validateKumitate(question, options, explanation) {
  const slotRe = /(?:＿★＿|＿＿)(?:[　\s]*(?:＿★＿|＿＿)){3}/;
  const m = question.match(slotRe);
  if (!m) return null;
  const tokens = m[0].match(/＿★＿|＿＿/g) || [];
  if (tokens.length !== 4) return null;
  const starIdx = tokens.indexOf('＿★＿');
  if (starIdx === -1) return null;
  const strip = (s) => String(s).replace(/[\s　]/g, '');
  const prefix = strip(question.slice(0, m.index));
  const suffix = strip(question.slice(m.index + m[0].length));
  const expl = strip(explanation);
  const frags = options.map((o) => strip(o.text));
  if (frags.length !== 4 || frags.some((f) => !f)) return null;
  const ix = [0, 1, 2, 3];
  for (const a of ix) for (const b of ix) for (const c of ix) for (const d of ix) {
    if (new Set([a, b, c, d]).size !== 4) continue;
    const p = [a, b, c, d];
    const candidate = prefix + p.map((i) => frags[i]).join('') + suffix;
    if (expl.includes(candidate)) return p[starIdx];
  }
  return null;
}

const JLPT_PASSAGE_MAXLEN = { bunpou_bunshou: 600, dokkai_tanbun: 400, dokkai_chuubun: 1000, dokkai_jouhou: 800 };

router.post('/lessons/:lessonId/generate-jlpt', quizGenLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const taskType = String(req.body?.taskType || '');
  const task = JLPT_GEN_TASKS[taskType];
  if (!task) return res.status(400).json({ error: 'bad_task', detail: 'taskType tidak dikenal.' });
  // count = jumlah soal (non-passage) atau jumlah bacaan (passage task);
  // bunpou_bunshou = 1 wacana dengan `count` blank.
  const count = Math.min(taskType === 'bunpou_bunshou' ? 5 : 8,
    Math.max(1, Math.trunc(Number(req.body?.count) || 3)));
  const topic = String(req.body?.topic || '').slice(0, 300).trim();
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const lessonRes = await query(`SELECT l.id,l.module_id,l.type,c.level
    FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
    WHERE l.id=$1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });
  const level = String(lesson.level || '').toUpperCase();
  if (!JLPT_GEN_LEVELS[level]) return res.status(422).json({ error: 'unsupported_course_level' });
  if (req.body?.level && String(req.body.level).toUpperCase() !== level) {
    return res.status(409).json({ error: 'course_level_mismatch' });
  }

  // Grounding vocab + grammar modul — query sama dgn generator lain.
  let vocabRes = await query(
    `SELECT DISTINCT v.japanese, v.reading, v.indonesian, v.category
     FROM module_vocabulary v
     JOIN lesson_deck_items di ON di.vocabulary_id = v.id
     JOIN lessons l ON l.id = di.lesson_id
     WHERE l.module_id = $1 AND l.type = 'deck' AND v.japanese IS NOT NULL AND v.japanese <> ''
     LIMIT 80`,
    [lesson.module_id]
  );
  if (vocabRes.rows.length < 4) {
    vocabRes = await query(
      `SELECT japanese, reading, indonesian, category
       FROM module_vocabulary
       WHERE module_id = $1 AND japanese IS NOT NULL AND japanese <> ''
       LIMIT 80`,
      [lesson.module_id]
    );
  }
  const grammarRes = await query(
    `SELECT pattern, meaning, example FROM module_grammar
     WHERE module_id = $1 AND pattern IS NOT NULL AND pattern <> ''
     LIMIT 30`,
    [lesson.module_id]
  );

  // Anti-duplikat: soal existing di kategori yang sama (+ baris pertama
  // passage utk tugas bacaan).
  const existingRes = await query(
    `SELECT question, passage FROM quiz_questions
     WHERE lesson_id = $1 AND question_category = $2
     ORDER BY created_at DESC LIMIT 30`,
    [lessonId, task.category]
  );
  const avoidLines = [...new Set(existingRes.rows.flatMap((r) => [
    String(r.question || '').split('\n')[0].trim(),
    String(r.passage || '').split('\n')[0].trim(),
  ]))].filter(Boolean);

  const vocabLines = vocabRes.rows.map((v) =>
    `- ${v.japanese}${v.reading ? ` (${v.reading})` : ''} = ${v.indonesian || '?'}${v.category ? ` [${v.category}]` : ''}`).join('\n');
  const grammarLines = grammarRes.rows.map((g) =>
    `- ${g.pattern}${g.meaning ? ` = ${g.meaning}` : ''}${g.example ? `. Contoh: ${g.example}` : ''}`).join('\n');

  const promptTpl = await _loadJlptGenPrompt();
  const userContent = _fillTemplate(promptTpl, {
    count: taskType === 'bunpou_bunshou' ? `1 wacana dengan ${count}` : count,
    unit: task.needsPassage
      ? (taskType === 'bunpou_bunshou' ? 'blank' : 'bacaan (lihat aturan jumlah soal per bacaan)')
      : '',
    level,
    taskName: task.name,
    taskRules: task.rules,
    levelRules: JLPT_GEN_LEVELS[level],
    topic: topic ? `Topik/instruksi tambahan dari admin: ${topic}\n` : '',
    vocab: vocabLines || '(tidak ada — pakai kosakata standar level ini)',
    grammar: grammarLines || '(tidak ada — pakai grammar standar level ini)',
    avoid: avoidLines.length
      ? `\nSoal yang SUDAH ADA di kuis ini (jangan bikin soal/bacaan serupa):\n${avoidLines.map((s) => `- ${s.slice(0, 120)}`).join('\n')}\n`
      : '',
  });

  const loadSource = async () => {
    const currentLesson = await query(`SELECT l.id,l.module_id,l.type,c.level
      FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
      WHERE l.id=$1`, [lessonId]);
    if (!currentLesson.rows.length || currentLesson.rows[0].type !== 'quiz') throw new Error('lesson_changed');
    const currentQuestions = await query(`SELECT question,passage FROM quiz_questions
      WHERE lesson_id=$1 AND question_category=$2
      ORDER BY created_at DESC LIMIT 30`, [lessonId, task.category]);
    return { lesson: currentLesson.rows[0], existingQuestions: currentQuestions.rows,
      promptTemplate: await _loadJlptGenPrompt() };
  };
  const result = await groundedDraft({ scope: { lessonId }, body: req.body || {},
    contentType: 'jlpt_batch', loadSource, instruction: userContent,
    system: QUIZ_GEN_SYSTEM, model: ANTHROPIC_GEN_MODEL,
    maxTokens: task.needsPassage ? 6000 : 4096,
    transformCandidate: parsed => legacyQuizBatchToCanonical(parsed, { needsPassage: task.needsPassage }),
    additionalSchemaIssues: candidate => {
      const issues = [];
      const questions = Array.isArray(candidate.questions) ? candidate.questions : [];
      if (!questions.length || questions.length > 40) issues.push({ code: 'jlpt_question_count_invalid' });
      const groups = new Map();
      for (const [index, question] of questions.entries()) {
        const prompt = question?.prompt;
        const options = Array.isArray(question?.options) ? legacyQuizOptions(question) : [];
        if (typeof prompt !== 'string' || _validateJlptQuestion(taskType, prompt) !== prompt ||
            !Array.isArray(question?.options) || question.options.length !== task.optionCount ||
            question.options.some(option => typeof option !== 'string' || option.length > 300) ||
            !_normalizeJlptOptions(options, task.optionCount, taskType, prompt)) {
          issues.push({ code: 'jlpt_task_format_invalid', questionIndex: index });
        }
        if (taskType === 'bunpou_kumitate' &&
            _validateKumitate(String(prompt || ''), options, String(question?.explanation || '')) == null) {
          issues.push({ code: 'jlpt_kumitate_invalid', questionIndex: index });
        }
        if (task.needsPassage) {
          const passage = question?.passage;
          if (typeof passage !== 'string' || !passage.trim() ||
              passage.length > (JLPT_PASSAGE_MAXLEN[taskType] || 4000) ||
              (taskType === 'bunpou_bunshou' && !passage.includes('①'))) {
            issues.push({ code: 'jlpt_passage_invalid', questionIndex: index });
          } else groups.set(passage, (groups.get(passage) || 0) + 1);
        } else if (question?.passage != null) {
          issues.push({ code: 'unexpected_jlpt_passage', questionIndex: index });
        }
      }
      if (task.needsPassage) {
        const expectedGroups = taskType === 'bunpou_bunshou' ? 1 : count;
        const [minQ, maxQ] = taskType === 'bunpou_bunshou' ? [count, count] : task.qPerPassage;
        if (groups.size !== expectedGroups || [...groups.values()].some(n => n < minQ || n > maxQ)) {
          issues.push({ code: 'jlpt_passage_question_count_mismatch' });
        }
      } else if (questions.length !== count) issues.push({ code: 'jlpt_question_count_mismatch', expected: count });
      return issues;
    } });
  const clean = result.status === 'ready' ? result.candidate.questions.map(question => {
    let options = legacyQuizOptions(question);
    if (taskType === 'bunpou_kumitate') {
      const star = _validateKumitate(question.prompt, options, question.explanation || '');
      options = options.map((option, index) => ({ ...option, isCorrect: index === star }));
    }
    return { question: question.prompt, passage: question.passage || '',
      options, explanation: question.explanation || '' };
  }) : [];
  return groundedResponse(res, result, {
    questions: clean,
    section: { number: task.number, label: task.label, instruction: task.instruction },
    category: task.category,
    vocabPool: vocabRes.rows.length,
    grammarPool: grammarRes.rows.length,
  });
}));

// Generate contoh kalimat (AI) untuk satu kosakata deck — dipakai tombol
// "Generate contoh (AI)" di modal Kelola Deck → Contoh. Grounded ke kata di
// module_vocabulary. Mengembalikan daftar { japanese, highlight, indonesian }
// untuk di-review admin sebelum disimpan ke vocabulary_examples.
router.post('/generate-vocab-examples', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { vocabularyId, lessonId } = body;
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });
  const v = await query(`SELECT id,module_id,lesson_id,japanese,reading,indonesian,updated_at
    FROM module_vocabulary WHERE id=$1`, [vocabularyId]);
  if (v.rows.length === 0) return res.status(404).json({ error: 'vocab not found' });
  const word = v.rows[0];
  if (lessonId && String(lessonId) !== String(word.lesson_id)) {
    const assignment = await query(`SELECT d.lesson_id FROM lesson_deck_items d
      JOIN lessons l ON l.id=d.lesson_id
      WHERE d.vocabulary_id=$1 AND d.lesson_id=$2 AND l.module_id=$3`,
    [vocabularyId, lessonId, word.module_id]);
    if (!assignment.rows.length) {
      return res.status(409).json({ error: 'vocabulary_lesson_mismatch' });
    }
  }
  const scope = { moduleId: word.module_id, ...(lessonId || word.lesson_id ? { lessonId: lessonId || word.lesson_id } : {}) };
  const loadSource = async () => {
    const current = await query(`SELECT id,module_id,lesson_id,japanese,reading,indonesian,updated_at
      FROM module_vocabulary WHERE id=$1`, [vocabularyId]);
    if (!current.rows.length || String(current.rows[0].module_id) !== String(word.module_id)) throw new Error('source_changed');
    return current.rows[0];
  };
  const result = await groundedDraft({ scope, contentType: 'vocabulary_example', loadSource, body,
    maxTokens: 1000, expectedExampleCount: generationExampleCount(body.count),
    instruction: `Create exactly ${generationExampleCount(body.count)} short Japanese example sentences using the persisted word ${JSON.stringify(word.japanese)} (${word.reading || ''}; ${word.indonesian || ''}). Return {"examples":[{"japanese":"...","reading":"...","highlight":"...","indonesian":"..."}]}. Every highlight must occur verbatim in its sentence. Avoid: ${JSON.stringify(Array.isArray(body.avoid) ? body.avoid.slice(0, 20) : [])}` });
  const examples = Array.isArray(result.candidate?.examples) ? result.candidate.examples :
    result.candidate?.japanese ? [result.candidate] : [];
  if (result.status === 'ready' && examples.some(example => !String(example?.japanese || '').includes(String(word.japanese)) ||
      !String(example?.japanese || '').includes(String(example?.highlight || '')))) {
    rejectGroundedResult(result, { code: 'source_vocabulary_not_demonstrated', vocabularyId });
  }
  return groundedResponse(res, result, { examples: result.status === 'ready' ? examples : [] });
}));

// Backfill kana (reading) untuk contoh kalimat di sebuah deck yang masih kosong
// — tombol "Generate kana (AI)" di Kelola Deck. Contoh lama (sebelum kolom
// `reading` ada) tidak punya kana; ini mengisinya dari `japanese` via Claude.
// Hemat AI: kalimat tanpa kanji di-set reading=japanese langsung (exact, tanpa
// panggil model). Idempoten — default cuma isi yang kosong; { force:true }
// regenerate semua. Cap per run + batch supaya tidak timeout (re-run lanjut).
const _hasKanji = (s) => /[々一-鿿]/.test(String(s || ''));
async function saveDeckReading(deckLessonId, exampleId, reading, force, sourceFingerprint,
  expectedBoundaryFingerprint = null, sourceSnapshotFingerprint = null) {
  return bulkBoundaryWrite({
    prepare: async (client, { locked }) => {
      const result = await client.query(`SELECT e.*,v.module_id,v.lesson_id FROM vocabulary_examples e
        JOIN module_vocabulary v ON v.id=e.vocabulary_id WHERE e.id=$1
        ${locked ? 'FOR UPDATE OF e' : ''}`, [exampleId]);
      if (!result.rows.length) throw new BoundaryContextError('vocabulary_owner_unresolved');
      const row = result.rows[0], shouldWrite = force || !String(row.reading || '').trim();
      assertGenerationSourceUnchanged(sourceFingerprint, deckReadingSourceFingerprint(row));
      if (sourceSnapshotFingerprint) assertGenerationSourceUnchanged(sourceSnapshotFingerprint,
        dialogueSourceFingerprint(row));
      const consumers = await client.query('SELECT lesson_id FROM lesson_deck_items WHERE vocabulary_id=$1', [row.vocabulary_id]);
      if (consumers.rows.some(consumer => consumer.lesson_id !== deckLessonId)) {
        // Reading is stored on the shared example, so one deck's validation
        // cannot authorize a change visible in a second lesson context.
        throw new BoundaryContextError('boundary_context_mismatch');
      }
      return { scope: { lessonId: deckLessonId },
        contentType: 'vocabulary_example', operation: 'generate', contentId: row.id,
        expectedBoundaryFingerprint,
        fields: [boundaryField('japanese', row.japanese), boundaryField('reading', shouldWrite ? reading : row.reading),
          boundaryField('highlight', row.highlight), boundaryField('indonesian', row.indonesian)],
        shouldWrite, contentIsNewOrChanged: shouldWrite };
    },
    write: async (client, candidate) => candidate.shouldWrite
      ? (await client.query('UPDATE vocabulary_examples SET reading=$2,updated_at=NOW() WHERE id=$1 RETURNING id',
        [exampleId, reading])).rows[0]
      : { id: exampleId, skipped: true },
  });
}
router.post('/lessons/:lessonId/generate-deck-readings', asyncHandler(async (req, res) => {
  const force = (req.body || {}).force === true;
  const rows = await query(
    `SELECT e.*, v.module_id, v.lesson_id
       FROM vocabulary_examples e
       JOIN module_vocabulary v ON v.id = e.vocabulary_id
       JOIN lesson_deck_items di ON di.vocabulary_id = e.vocabulary_id
      WHERE di.lesson_id = $1 AND ($2::boolean OR e.reading IS NULL OR e.reading = '')
      ORDER BY e.id`,
    [req.params.lessonId, force]
  );
  const all = rows.rows.slice(0, 500); // cap aman per run; re-run lanjut sisanya
  const total = all.length;
  if (total === 0) return res.json({ total: 0, updated: 0, failed: 0 });

  const needsAi = all.filter(row => _hasKanji(row.japanese));
  if (needsAi.length && !anthropicEnabled()) {
    return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.', total, updated: 0, failed: needsAi.length });
  }

  let updated = 0;
  const updatedItems = [];
  const failedItems = [];
  const needAi = [];
  // 1) Kalimat tanpa kanji → reading == japanese (exact, tanpa AI).
  for (const r of all) {
    const jp = String(r.japanese || '').trim();
    if (!jp) { failedItems.push({ id: r.id, error: 'empty_japanese', status: 422 }); continue; }
    if (_hasKanji(jp)) { needAi.push(r); continue; }
    const outcome = await saveDeckReading(req.params.lessonId, r.id, jp.slice(0, 300), force,
      deckReadingSourceFingerprint(r), req.body?.boundaryFingerprint || null,
      dialogueSourceFingerprint(r));
    if (!outcome.ok) failedItems.push({ id: r.id, error: outcome.error, status: outcome.status,
      ...(outcome.validation ? { validation: outcome.validation } : {}) });
    else if (!outcome.outcome.value.skipped) {
      updated++;
      updatedItems.push({ id: r.id, validation: outcome.outcome.report });
    }
  }

  // 2) Sisanya (mengandung kanji) → Claude per batch.
  if (needAi.length > 0) {
    const BATCH = 5;
    for (let i = 0; i < needAi.length; i += BATCH) {
      const batch = needAi.slice(i, i + BATCH);
      const list = batch.map((r, j) => `${j + 1}. ${String(r.japanese).trim().slice(0, 280)}`).join('\n');
      const userContent = `Ubah tiap kalimat Jepang berikut menjadi cara baca KANA penuh.
Aturan:
- Semua kanji diganti hiragana (katakana untuk kata serapan).
- TANPA kanji, TANPA romaji, TANPA furigana/tanda kurung.
- Pertahankan partikel dan tanda baca (。、？！) apa adanya.

Kalimat:
${list}

Balas HANYA JSON valid tanpa teks lain. Salin kalimat Jepang persis dan sertakan cara bacanya dalam urutan yang sama:
{"examples":[{"japanese":"…","reading":"…"}]}`;
      const loadSource = async () => {
        const current = await query(`SELECT e.*,v.module_id,v.lesson_id FROM vocabulary_examples e
          JOIN module_vocabulary v ON v.id=e.vocabulary_id
          JOIN lesson_deck_items di ON di.vocabulary_id=e.vocabulary_id
          WHERE di.lesson_id=$1 AND e.id=ANY($2::uuid[]) ORDER BY e.id`,
        [req.params.lessonId, batch.map(row => row.id)]);
        if (current.rows.length !== batch.length) throw new Error('deck_source_changed');
        return current.rows;
      };
      const result = await groundedDraft({ scope: { lessonId: req.params.lessonId },
        contentType: 'vocabulary_example', loadSource, body: req.body || {},
        expectedExampleCount: batch.length, maxTokens: 1600, model: ANTHROPIC_GEN_MODEL,
        instruction: userContent,
        additionalSchemaIssues: candidate => {
          const examples = candidate.examples;
          if (!Array.isArray(examples) || examples.length !== batch.length) return [];
          return examples.flatMap((example, index) => {
            const issues = [];
            if (!example || typeof example !== 'object' || Array.isArray(example) ||
                typeof example.japanese !== 'string' || example.japanese !== batch[index].japanese ||
                Object.keys(example).some(key => !['japanese', 'reading'].includes(key))) {
              issues.push({ code: 'deck_reading_source_mismatch', exampleIndex: index });
            }
            if (typeof example?.reading !== 'string' || !example.reading.trim() ||
                example.reading.length > 300 || /[々一-鿿A-Za-z]/u.test(example.reading)) {
              issues.push({ code: 'deck_reading_format_invalid', exampleIndex: index });
            } else {
              let offset = 0;
              for (const segment of batch[index].japanese.match(/[\p{Script=Hiragana}\p{Script=Katakana}]+/gu) || []) {
                const found = example.reading.indexOf(segment, offset);
                if (found < 0) {
                  issues.push({ code: 'deck_reading_source_mismatch', exampleIndex: index });
                  break;
                }
                offset = found + segment.length;
              }
            }
            return issues;
          });
        } });
      if (result.status !== 'ready') {
        const status = result.status === 'stale' ? 409 : result.status === 'unavailable' ? 503 : 422;
        failedItems.push(...batch.map(row => ({ id: row.id,
          error: result.status === 'stale' ? 'version_conflict' :
            result.status === 'unavailable' ? 'generation_unavailable' : 'generation_rejected',
          status, generation: groundedGenerationMetadata(result) })));
        continue;
      }
      for (const [index, row] of batch.entries()) {
        const reading = result.candidate.examples[index].reading.trim();
        const outcome = await saveDeckReading(req.params.lessonId, row.id, reading, force,
          deckReadingSourceFingerprint(row), result.boundaryFingerprint,
          dialogueSourceFingerprint(row));
        if (!outcome.ok) failedItems.push({ id: row.id, error: outcome.error, status: outcome.status,
          ...(outcome.validation ? { validation: outcome.validation } : {}),
          generation: groundedGenerationMetadata(result) });
        else if (!outcome.outcome.value.skipped) {
          updated++;
          updatedItems.push({ id: row.id, validation: outcome.outcome.report,
            generation: groundedGenerationMetadata(result) });
        }
      }
    }
  }

  res.json({ total, updated, failed: failedItems.length, updatedItems, failedItems });
}));

// Generate gambar ilustrasi (AI) untuk kosakata deck — tombol "Gambar (AI)"
// di Kelola Deck. Provider default: OpenAI gpt-image-1 (quality=low,
// ~$0.011/gambar). Bytes disimpan di vocab_image_cache (BYTEA), 1 gambar
// per kosakata; klik ulang dgn force=true untuk regenerate. Public serve
// lewat GET /api/vocab-image?vocabularyId=... (routes/vocab-image.js).
// OPENAI_API_KEY opsional (bukan REQUIRED_ENV); kosong → 503.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

router.post('/generate-vocab-image', asyncHandler(async (req, res) => {
  const { vocabularyId, force } = req.body || {};
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'image_disabled', detail: 'OPENAI_API_KEY belum diset.' });

  const v = await query(`SELECT japanese, reading, indonesian, category FROM module_vocabulary WHERE id = $1`, [vocabularyId]);
  if (v.rows.length === 0) return res.status(404).json({ error: 'vocab not found' });
  const word = v.rows[0];

  if (!force) {
    const hit = await query(`SELECT 1 FROM vocab_image_cache WHERE vocabulary_id = $1`, [vocabularyId]);
    if (hit.rows.length > 0) {
      query(`UPDATE vocab_image_cache SET last_used_at = NOW() WHERE vocabulary_id = $1`, [vocabularyId]).catch(() => {});
      return res.json({ ok: true, cached: true });
    }
  }

  const concept = word.indonesian || word.japanese;
  const prompt = `Simple flat illustration showing the concept of "${concept}" (Japanese: ${word.japanese}${word.reading ? `, ${word.reading}` : ''}). Minimalist textbook-style art for a vocabulary card. No text or letters in the image. Clean white background. Friendly, clear, instantly recognizable.`;

  let bytes;
  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        n: 1,
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('OpenAI image:', upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'image_upstream', detail: detail.slice(0, 200) });
    }
    const data = await upstream.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: 'image_empty' });
    bytes = Buffer.from(b64, 'base64');
  } catch (err) {
    console.error('OpenAI image error:', err.message);
    return res.status(502).json({ error: 'image_upstream' });
  }

  await query(
    `INSERT INTO vocab_image_cache (vocabulary_id, image_bytes, mime, model, prompt, last_used_at)
     VALUES ($1, $2, 'image/png', $3, $4, NOW())
     ON CONFLICT (vocabulary_id) DO UPDATE
       SET image_bytes = EXCLUDED.image_bytes, mime = EXCLUDED.mime,
           model = EXCLUDED.model, prompt = EXCLUDED.prompt,
           created_at = NOW(), last_used_at = NOW()`,
    [vocabularyId, bytes, OPENAI_IMAGE_MODEL, prompt]
  );
  res.json({ ok: true, cached: false, sizeBytes: bytes.length });
}));

// Generate MULTI contoh kalimat (AI) untuk pola grammar — tombol "Contoh (AI)"
// di modal Kelola Contoh Grammar. Output: array { japanese, highlight,
// indonesian } siap dimasukkan ke grammar_examples. Pola sama persis dgn
// generate-vocab-examples (avoid list, count, dgn terjemahan).
router.post('/generate-grammar-examples', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.grammarId) return res.status(400).json({ error: 'grammarId required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });
  const found = await query(`SELECT id,module_id,lesson_id,pattern,meaning,communication_goal,updated_at
    FROM module_grammar WHERE id=$1`, [body.grammarId]);
  if (!found.rows.length) return res.status(404).json({ error: 'grammar not found' });
  const grammar = found.rows[0];
  if ((body.pattern && body.pattern !== grammar.pattern) ||
      (body.meaning && body.meaning !== grammar.meaning) ||
      (body.lessonId && String(body.lessonId) !== String(grammar.lesson_id))) {
    return res.status(409).json({ error: 'grammar_source_mismatch' });
  }
  const scope = { grammarId: grammar.id };
  const loadSource = async () => {
    const current = await query(`SELECT id,module_id,lesson_id,pattern,meaning,communication_goal,updated_at
      FROM module_grammar WHERE id=$1`, [grammar.id]);
    if (!current.rows.length) throw new Error('source_changed');
    return current.rows[0];
  };
  const result = await groundedDraft({ scope, contentType: 'grammar_example', loadSource, body,
    maxTokens: 1000, expectedExampleCount: generationExampleCount(body.count),
    trustedValidation: { grammarSignatures: grammarGenerationSignature(grammar) },
    instruction: `Create exactly ${generationExampleCount(body.count)} short Japanese example sentences that demonstrably use persisted grammar ${JSON.stringify(grammar.pattern)} (${grammar.meaning || ''}). Return {"examples":[{"japanese":"...","highlight":"...","indonesian":"..."}]}. Avoid: ${JSON.stringify(Array.isArray(body.avoid) ? body.avoid.slice(0, 20) : [])}` });
  const examples = Array.isArray(result.candidate?.examples) ? result.candidate.examples :
    result.candidate?.japanese ? [result.candidate] : [];
  return groundedResponse(res, result, { examples: result.status === 'ready' ? examples : [] });
}));

// Translate dialog 3-suara (AI) ke Bahasa Indonesia — output dgn struktur
// PARALEL (prefix N: / A: / B: per baris) supaya frontend bisa mencocokkan
// terjemahan tiap turn dgn turn dialog Jepangnya.
router.post('/generate-dialog-translation', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.grammarId) return res.status(400).json({ error: 'grammarId required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });
  const found = await query(`SELECT id,module_id,lesson_id,example_dialog,example_dialog_id,updated_at
    FROM module_grammar WHERE id=$1`, [body.grammarId]);
  if (!found.rows.length) return res.status(404).json({ error: 'grammar not found' });
  const grammar = found.rows[0];
  const dialog = String(body.dialog || grammar.example_dialog || '').trim();
  if (!dialog) return res.status(400).json({ error: 'dialog required' });
  if (body.lessonId && String(body.lessonId) !== String(grammar.lesson_id)) {
    return res.status(409).json({ error: 'dialog_source_mismatch' });
  }
  let boundary;
  try { boundary = await getCurriculumBoundary({ grammarId: grammar.id }); }
  catch { return res.status(503).json({ error: 'boundary_unavailable' }); }
  const sourceReport = validateContentAgainstBoundary({ boundary, contentType: 'grammar_example',
    operation: 'generate', fields: [boundaryField('dialog', dialog)] });
  if (sourceReport.status !== 'evaluated' || sourceReport.valid !== true) {
    return groundedResponse(res, { status: 'rejected', candidate: null,
      report: sourceReport, decision: decideBoundaryAction({ mode: boundary.course.mode,
        operation: 'generate', report: sourceReport }), attempts: [],
      boundaryFingerprint: boundary.boundaryFingerprint, sourceFingerprint: null },
    { dialog_id: '' }, 422);
  }
  const loadSource = async () => {
    const current = await query(`SELECT id,module_id,lesson_id,example_dialog,example_dialog_id,updated_at
      FROM module_grammar WHERE id=$1`, [grammar.id]);
    if (!current.rows.length) throw new Error('source_changed');
    return { grammar: current.rows[0], dialog };
  };
  const result = await groundedDraft({ scope: { grammarId: grammar.id },
    contentType: 'dialogue_translation', loadSource, body, maxTokens: 750,
    instruction: `Translate this persisted Japanese dialogue into natural Indonesian: ${JSON.stringify(dialog)}. Preserve line count and exact N:/A:/B: speaker prefixes. Return {"dialog_id":"..."}.` });
  const originalPrefixes = dialog.split('\n').map(line => /^\s*([^:]+):/.exec(line)?.[1] || null);
  const translationPrefixes = String(result.candidate?.dialog_id || '').split('\n')
    .map(line => /^\s*([^:]+):/.exec(line)?.[1] || null);
  if (result.status === 'ready' && JSON.stringify(originalPrefixes) !== JSON.stringify(translationPrefixes)) {
    rejectGroundedResult(result, { code: 'translation_turn_alignment_invalid' });
  }
  return groundedResponse(res, result, { dialog_id: result.status === 'ready' ? result.candidate?.dialog_id || '' : '' });
}));

// Generate contoh kalimat (AI) untuk pola grammar — tombol "Contoh (AI)" di
// editor grammar admin. Admin tulis pattern + meaning, AI bikin 1 kalimat
// pendek yang memakai pola itu (level pemula).
router.post('/generate-grammar-example', asyncHandler(async (req, res) => {
  res.status(410).json({ error: 'use_generate_grammar_examples_with_grammarId' });
}));

// Generate dialog 3-suara (AI) untuk pola grammar — tombol "Dialog (AI)" di
// editor grammar admin. Output langsung kompatibel dengan player karaoke
// (format JLPT: N/A/B per baris). N = narrator, A = cewe, B = cowo.
router.post('/generate-grammar-dialog', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.grammarId) return res.status(400).json({ error: 'grammarId required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });
  const found = await query(`SELECT id,module_id,lesson_id,pattern,meaning,example,
    communication_goal,example_dialog,updated_at FROM module_grammar WHERE id=$1`, [body.grammarId]);
  if (!found.rows.length) return res.status(404).json({ error: 'grammar not found' });
  const grammar = found.rows[0];
  if ((body.pattern && body.pattern !== grammar.pattern) ||
      (body.meaning && body.meaning !== grammar.meaning) ||
      (body.lessonId && String(body.lessonId) !== String(grammar.lesson_id))) {
    return res.status(409).json({ error: 'grammar_source_mismatch' });
  }
  const loadSource = async () => {
    const current = await query(`SELECT id,module_id,lesson_id,pattern,meaning,example,
      communication_goal,example_dialog,updated_at FROM module_grammar WHERE id=$1`, [grammar.id]);
    if (!current.rows.length) throw new Error('source_changed');
    return current.rows[0];
  };
  const result = await groundedDraft({ scope: { grammarId: grammar.id }, contentType: 'grammar_dialog',
    loadSource, body, maxTokens: 750, communicationGoal: grammar.communication_goal || '',
    trustedValidation: { grammarSignatures: grammarGenerationSignature(grammar) },
    instruction: `Create a 5-line Japanese dialogue using persisted pattern ${JSON.stringify(grammar.pattern)} (${grammar.meaning || ''}). Communication goal: ${grammar.communication_goal || '(missing)'}. Use speaker-prefix lines N:, A:, B:, A:, B:. A/B should demonstrate the pattern. Return {"dialogue":"N: ...\\nA: ...\\nB: ...\\nA: ...\\nB: ..."}.` });
  return groundedResponse(res, result, { dialog: result.status === 'ready' ? result.candidate?.dialogue || '' : '',
  });
}));

router.post('/module-grammar', asyncHandler(async (req, res) => {
  const { moduleId, lessonId, pattern, meaning, example, notes, exampleDialog, exampleDialogId, sortOrder, communicationGoal } = req.body || {};
  if (!moduleId || !pattern) return res.status(400).json({ error: 'moduleId and pattern required' });
  let scene, furigana;
  try { scene = normalizeDialogScene(req.body.dialogScene); furigana = dialogueFurigana.normalize(req.body.dialogFurigana); }
  catch (err) { return res.status(400).json({ error: err.message }); }
  const outcome = await adminBoundaryWrite(res, {
    prepare: async () => ({ scope: { moduleId, lessonId: lessonId || undefined },
      contentType: exampleDialog || scene || furigana ? 'grammar_dialog' : 'grammar_example', operation: 'live_write',
      communicationGoal, fields: [boundaryField('pattern', pattern), boundaryField('meaning', meaning),
        boundaryField('example', example), boundaryField('notes', notes), boundaryField('exampleDialog', exampleDialog),
        boundaryField('exampleDialogId', exampleDialogId), boundaryField('communicationGoal', communicationGoal),
        ...dialogueVisibleFields(scene, furigana)],
      expectedBoundaryFingerprint: req.body?.boundaryFingerprint }),
    write: async client => (await client.query(
      `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, example_dialog,
        example_dialog_id, sort_order, dialog_scene, dialog_furigana, communication_goal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12) RETURNING *`,
      [moduleId, lessonId || null, pattern, meaning || null, example || null, notes || null,
        exampleDialog || null, exampleDialogId || null, sortOrder || 0,
        scene ? JSON.stringify(scene) : null, furigana ? JSON.stringify(furigana) : null,
        communicationGoal || null])).rows[0],
  });
  if (!outcome) return;
  const warnings = await safeLearningWarnings(() => grammarLearningScopeWarnings(outcome.value.id));
  res.status(201).json({ grammar: outcome.value, warnings, validation: outcome.report });
}));

router.put('/module-grammar/:id', asyncHandler(async (req, res) => {
  const { lessonId, pattern, meaning, example, notes, exampleDialog, exampleDialogId, sortOrder, communicationGoal } = req.body || {};
  // COALESCE(new, old) can't tell "clear this field" (new = null) from "field
  // omitted" — it silently keeps the old value either way, so clearing a
  // field in the admin editor and saving never actually persisted as empty.
  // hasOwnProperty distinguishes the two, same pattern already used below for
  // lessonId/exampleDialogId.
  const has = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key);
  const hasLesson = has('lessonId');
  const hasDialogId = has('exampleDialogId');
  const hasPattern = has('pattern');
  const hasMeaning = has('meaning');
  const hasExample = has('example');
  const hasNotes = has('notes');
  const hasExampleDialog = has('exampleDialog');
  const hasSortOrder = has('sortOrder');
  let scene, furigana;
  try {
    scene = has('dialogScene') ? normalizeDialogScene(req.body.dialogScene) : null;
    furigana = has('dialogFurigana') ? dialogueFurigana.normalize(req.body.dialogFurigana) : null;
  }
  catch (err) { return res.status(400).json({ error: err.message }); }
  const outcome = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = await client.query(`SELECT * FROM module_grammar WHERE id=$1 ${locked ? 'FOR UPDATE' : ''}`, [req.params.id]);
      if (!old.rows.length) throw new BoundaryContextError('grammar_not_found');
      const row = old.rows[0];
      const effectiveLessonId = hasLesson ? lessonId : row.lesson_id;
      const changed = (enabled, next, previous) => enabled && JSON.stringify(next ?? null) !== JSON.stringify(previous ?? null);
      scene = keepStoredVoices(scene, row.dialog_scene);
      const mergedScene = has('dialogScene') ? scene : row.dialog_scene;
      const mergedFurigana = has('dialogFurigana') ? furigana : row.dialog_furigana;
      const goalChanged = changed(has('communicationGoal'), communicationGoal, row.communication_goal);
      const dialogChanged = changed(hasExampleDialog, exampleDialog, row.example_dialog) ||
        changed(hasDialogId, exampleDialogId, row.example_dialog_id) ||
        JSON.stringify(dialogueVisibleFields(mergedScene, mergedFurigana)) !==
          JSON.stringify(dialogueVisibleFields(row.dialog_scene, row.dialog_furigana)) ||
        (goalChanged && Boolean(row.example_dialog || mergedScene || mergedFurigana));
      const visibleChanged = dialogChanged || changed(hasPattern, pattern, row.pattern) ||
        changed(hasMeaning, meaning, row.meaning) || changed(hasExample, example, row.example) ||
        changed(hasNotes, notes, row.notes) || goalChanged;
      // On reassignment the stored grammar still points to the old lesson;
      // resolving both IDs would manufacture a false ownership mismatch.
      const movingLesson = hasLesson && (effectiveLessonId || null) !== (row.lesson_id || null);
      if (movingLesson) await assertDialogueQuestionLessonMoveAllowed(client, row.id,
        row.lesson_id, effectiveLessonId, { locked });
      return { scope: { ...(!movingLesson ? { grammarId: row.id } : {}),
          moduleId: row.module_id, lessonId: effectiveLessonId || undefined },
        contentType: dialogChanged ? 'grammar_dialog' : 'grammar_example', contentId: row.id,
        operation: 'live_write', communicationGoal: has('communicationGoal') ? communicationGoal : row.communication_goal,
        fields: [boundaryField('pattern', hasPattern ? pattern : row.pattern),
          boundaryField('meaning', hasMeaning ? meaning : row.meaning),
          boundaryField('example', hasExample ? example : row.example),
          boundaryField('notes', hasNotes ? notes : row.notes),
          boundaryField('exampleDialog', hasExampleDialog ? exampleDialog : row.example_dialog),
          boundaryField('exampleDialogId', hasDialogId ? exampleDialogId : row.example_dialog_id),
          boundaryField('communicationGoal', has('communicationGoal') ? communicationGoal : row.communication_goal),
          ...dialogueVisibleFields(mergedScene, mergedFurigana)],
        contentIsNewOrChanged: visibleChanged,
        expectedRevision: req.body?.expectedRevision, currentRevision: row.updated_at,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE module_grammar SET
       lesson_id = CASE WHEN $9::boolean THEN $2 ELSE lesson_id END,
       pattern = CASE WHEN $12::boolean THEN $3 ELSE pattern END,
       meaning = CASE WHEN $13::boolean THEN $4 ELSE meaning END,
       example = CASE WHEN $14::boolean THEN $5 ELSE example END,
       notes = CASE WHEN $15::boolean THEN $6 ELSE notes END,
       example_dialog = CASE WHEN $16::boolean THEN $7 ELSE example_dialog END,
       sort_order = CASE WHEN $17::boolean THEN $8 ELSE sort_order END,
       example_dialog_id = CASE WHEN $11::boolean THEN $10 ELSE example_dialog_id END,
       dialog_scene = CASE WHEN $18::boolean THEN $19::jsonb ELSE dialog_scene END,
       dialog_furigana = CASE WHEN $20::boolean THEN $21::jsonb ELSE dialog_furigana END,
       communication_goal = CASE WHEN $22::boolean THEN $23 ELSE communication_goal END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, lessonId || null, pattern, meaning, example, notes, exampleDialog, sortOrder, hasLesson, exampleDialogId || null, hasDialogId,
      hasPattern, hasMeaning, hasExample, hasNotes, hasExampleDialog, hasSortOrder, has('dialogScene'), scene ? JSON.stringify(scene) : null,
      has('dialogFurigana'), furigana ? JSON.stringify(furigana) : null, has('communicationGoal'), communicationGoal || null]
    )).rows[0],
  });
  if (!outcome) return;
  const warnings = await safeLearningWarnings(() => grammarLearningScopeWarnings(outcome.value.id));
  res.json({ grammar: outcome.value, warnings, validation: outcome.report });
}));

// === grammar_examples CRUD (mirror vocabulary-examples) ===
router.get('/grammar-examples', asyncHandler(async (req, res) => {
  const { grammarId } = req.query;
  if (!grammarId) return res.status(400).json({ error: 'grammarId required' });
  const rows = await query(
    `SELECT * FROM grammar_examples WHERE grammar_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [grammarId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/grammar-examples', asyncHandler(async (req, res) => {
  const { grammarId, japanese, highlight, indonesian, sortOrder } = req.body || {};
  if (!grammarId || !japanese) return res.status(400).json({ error: 'grammarId and japanese required' });
  const outcome = await adminBoundaryWrite(res, {
    prepare: async client => {
      const owner = await client.query('SELECT module_id,lesson_id FROM module_grammar WHERE id=$1', [grammarId]);
      if (!owner.rows.length) throw new BoundaryContextError('grammar_not_found');
      return { scope: { grammarId, moduleId: owner.rows[0].module_id, lessonId: owner.rows[0].lesson_id || undefined },
        contentType: 'grammar_example', operation: 'live_write',
        fields: [boundaryField('japanese', japanese), boundaryField('highlight', highlight),
          boundaryField('indonesian', indonesian)],
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
      `INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [grammarId, japanese, highlight || null, indonesian || null, sortOrder || 0])).rows[0],
  });
  if (!outcome) return;
  const warnings = await safeLearningWarnings(() => grammarExampleLearningScopeWarnings(outcome.value.id));
  res.status(201).json({ example: outcome.value, warnings, validation: outcome.report });
}));

router.put('/grammar-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, highlight, indonesian, sortOrder } = req.body || {};
  const hasHighlight = Object.prototype.hasOwnProperty.call(req.body || {}, 'highlight');
  const outcome = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = await client.query(`SELECT e.*,g.module_id,g.lesson_id FROM grammar_examples e
        JOIN module_grammar g ON g.id=e.grammar_id WHERE e.id=$1 ${locked ? 'FOR UPDATE OF e' : ''}`, [req.params.id]);
      if (!old.rows.length) throw new BoundaryContextError('grammar_not_found');
      const row = old.rows[0];
      return { scope: { grammarId: row.grammar_id, moduleId: row.module_id, lessonId: row.lesson_id || undefined },
        contentType: 'grammar_example', contentId: row.id, operation: 'live_write',
        fields: [boundaryField('japanese', japanese ?? row.japanese),
          boundaryField('highlight', hasHighlight ? highlight : row.highlight),
          boundaryField('indonesian', indonesian ?? row.indonesian)],
        contentIsNewOrChanged: japanese != null || hasHighlight || indonesian != null,
        expectedRevision: req.body?.expectedRevision, currentRevision: row.updated_at,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE grammar_examples SET
       japanese = COALESCE($2, japanese),
       highlight = CASE WHEN $5::boolean THEN $3 ELSE highlight END,
       indonesian = COALESCE($4, indonesian),
       sort_order = COALESCE($6, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, highlight || null, indonesian, hasHighlight, sortOrder]
    )).rows[0],
  });
  if (!outcome) return;
  const warnings = await safeLearningWarnings(() => grammarExampleLearningScopeWarnings(outcome.value.id));
  res.json({ example: outcome.value, warnings, validation: outcome.report });
}));

router.delete('/grammar-examples/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, async client => {
    const example = await client.query('SELECT grammar_id FROM grammar_examples WHERE id=$1', [req.params.id]);
    return example.rows.length ? courseIdsForGrammarAndConsumers(client, example.rows[0].grammar_id) : [];
  },
  client => client.query('DELETE FROM grammar_examples WHERE id=$1', [req.params.id]));
  if (!result) return;
  res.json({ ok: true });
}));

router.delete('/module-grammar/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, client => courseIdsForGrammarAndConsumers(client, req.params.id),
    client => client.query('DELETE FROM module_grammar WHERE id=$1', [req.params.id]));
  if (!result) return;
  res.json({ ok: true });
}));

router.post('/module-grammar/bulk', asyncHandler(async (req, res) => {
  const { moduleId, items, replace } = req.body || {};
  if (!moduleId || !Array.isArray(items)) return res.status(400).json({ error: 'moduleId and items[] required' });
  // replace=true wipes the module's grammar first; wrap so a crash mid-insert
  // can't leave it emptied or half-populated.
  const outcome = await adminBoundaryWrite(res, {
    prepare: async client => {
      await assertBatchLessonOwnership(client, moduleId, items);
      return { scope: { moduleId }, contentType: 'grammar_example', operation: 'live_write',
      fields: items.flatMap((g, index) => [
        boundaryField(`items[${index}].pattern`, g?.pattern),
        boundaryField(`items[${index}].meaning`, g?.meaning),
        boundaryField(`items[${index}].example`, g?.example),
        boundaryField(`items[${index}].notes`, g?.notes),
      ]), expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => {
      if (replace) await client.query(`DELETE FROM module_grammar WHERE module_id = $1`, [moduleId]);
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const g = items[i] || {};
        if (!g.pattern) continue;
        const r = await client.query(
          `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [moduleId, g.lessonId || null, g.pattern, g.meaning || null, g.example || null, g.notes || null, g.sortOrder ?? i]);
        out.push(r.rows[0]);
      }
      return out;
    },
  });
  if (!outcome) return;
  res.status(201).json({ grammar: outcome.value, validation: outcome.report });
}));

// ===== LESSONS =====

// A Percakapan lesson shows the dialogues of one text/video lesson in the same
// chapter (migration 178). The DB trigger enforces the same rules; checking
// here first turns a violation into a readable 400 instead of a 500.
async function conversationSourceError(client, { moduleId, sourceId, lessonId = null }) {
  if (!sourceId) return 'Pilih pelajaran Tata Bahasa sumber dialognya.';
  if (!/^[0-9a-f-]{36}$/i.test(String(sourceId))) return 'Pelajaran sumber tidak valid.';
  const src = (await client.query(
    `SELECT module_id, type FROM lessons WHERE id = $1`, [sourceId])).rows[0];
  if (!src || src.module_id !== moduleId || !['text', 'video'].includes(src.type)) {
    return 'Sumber Percakapan harus pelajaran teks/video di bab yang sama.';
  }
  const taken = (await client.query(
    `SELECT title FROM lessons WHERE conversation_source_lesson_id = $1 AND id IS DISTINCT FROM $2`,
    [sourceId, lessonId])).rows[0];
  if (taken) return `Pelajaran itu sudah punya Percakapan: "${taken.title}".`;
  return null;
}

router.post('/lessons', asyncHandler(async (req, res) => {
  const {
    moduleId, slug, title, type, content, videoUrl, videoSourceId,
    videoStartSeconds, videoEndSeconds, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
    conversationSourceLessonId,
  } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  // Video and kana lessons can share one YouTube source while using different
  // timeline ranges. Legacy video_url remains independent for Bunny content.
  const acceptsVideoSegment = supportsVideoSegment(type);
  const segment = normalizeSegment(
    acceptsVideoSegment ? videoSourceId : null,
    acceptsVideoSegment ? videoStartSeconds : null,
    acceptsVideoSegment ? videoEndSeconds : null
  );
  if (segment.error) return res.status(400).json({ error: segment.error });
  const outcome = await adminBoundaryWrite(res, {
    prepare: async () => ({ scope: { moduleId }, contentType: 'reading', operation: 'live_write',
      fields: [boundaryField('title', title), boundaryField('content', content)],
      expectedBoundaryFingerprint: req.body?.boundaryFingerprint }),
    write: async client => {
    const conversationSource = type === 'conversation' ? conversationSourceLessonId : null;
    if (type === 'conversation') {
      const error = await conversationSourceError(client, { moduleId, sourceId: conversationSource });
      if (error) return { error };
    }
    return { lesson: (await client.query(
    `INSERT INTO lessons (
       module_id, slug, title, type, content, video_url,
       video_source_id, video_start_seconds, video_end_seconds,
       duration_minutes, sort_order, passing_score_pct, questions_per_attempt,
       cooldown_hours, popup_after_lesson_id, conversation_source_lesson_id
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
    [
      moduleId, slug, title, type || 'text',
      content || null, videoUrl || null,
      segment.videoSourceId, segment.videoStartSeconds, segment.videoEndSeconds,
      durationMinutes || null, sortOrder || 0,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : 70,
      questionsPerAttempt != null && questionsPerAttempt !== '' ? Number(questionsPerAttempt) : null,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : 12,
      popupAfterLessonId || null,
      conversationSource || null,
    ]
    )).rows[0] };
    },
  });
  if (!outcome) return;
  if (outcome.value.error) return res.status(400).json({ error: outcome.value.error });
  invalidateKanjiCatalogCache();
  res.status(201).json({ lesson: outcome.value.lesson, validation: outcome.report });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, type, content, videoUrl, videoSourceId, videoStartSeconds,
    videoEndSeconds, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
    conversationSourceLessonId,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const hasQPA = Object.prototype.hasOwnProperty.call(req.body || {}, 'questionsPerAttempt');
  // `null` is intentional here: the editor sends it when an admin clears the
  // lesson notes. Only an omitted property means "keep the saved content".
  const hasContent = Object.prototype.hasOwnProperty.call(req.body || {}, 'content');
  const hasPopup = Object.prototype.hasOwnProperty.call(req.body || {}, 'popupAfterLessonId');
  const hasVideoSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoSourceId');
  const hasVideoStart = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoStartSeconds');
  const hasVideoEnd = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoEndSeconds');

  // Lesson type-switch cleanup: kalau type berubah dari yang punya konten
  // (quiz/kanji/deck), hapus konten lama sebelum UPDATE. Tanpa ini,
  // quiz_questions/kanji_items/lesson_deck_items orphan di DB + counter
  // di list pelajaran salah. FK ON DELETE CASCADE handle quiz_options +
  // quiz_attempts otomatis. ON DELETE CASCADE buat kanji_items udah ada
  // (migration 015), buat lesson_deck_items juga.
  // Type-switch cleanup + UPDATE must be atomic: this deletes quiz_attempts
  // (student progress) and other nested content before re-typing the lesson.
  // A crash between the DELETEs and the UPDATE would orphan content and lose
  // student history with no consistent state to recover to.
  const guarded = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const cur = await client.query(`SELECT * FROM lessons WHERE id=$1 ${locked ? 'FOR UPDATE' : ''}`, [req.params.id]);
      if (!cur.rows.length) throw new BoundaryContextError('lesson_not_found');
      const current = cur.rows[0];
      if (type && current.type !== type && req.companyAccess && !req.companyAccess.isAdmin) {
        throw fail(403, 'owner_required_for_type_change');
      }
      return { scope: { lessonId: current.id, moduleId: current.module_id },
        contentType: (type || current.type) === 'quiz' ? 'quiz' : 'reading',
        contentId: current.id, operation: 'live_write', existing: current,
        fields: [boundaryField('title', title ?? current.title),
          boundaryField('content', hasContent ? content : current.content)],
        contentIsNewOrChanged: title != null || hasContent,
        expectedRevision: req.body?.expectedRevision, currentRevision: current.updated_at,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async (client, candidate) => {
    const current = candidate.existing;
    const oldType = current.type;
    // Percakapan link: required while the lesson is a Percakapan, cleared the
    // moment it becomes anything else (the CHECK in migration 178).
    const effectiveType = type || oldType;
    const hasConversationSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'conversationSourceLessonId');
    let conversationSource = current.conversation_source_lesson_id;
    if (effectiveType !== 'conversation') conversationSource = null;
    else if (hasConversationSource || oldType !== 'conversation') conversationSource = conversationSourceLessonId || null;
    if (effectiveType === 'conversation' &&
        conversationSource !== current.conversation_source_lesson_id) {
      const error = await conversationSourceError(client, { moduleId: current.module_id,
        sourceId: conversationSource, lessonId: current.id });
      if (error) return { error };
    }
    if (type && oldType !== type && !['text', 'video'].includes(type)) {
      const linked = (await client.query(`SELECT title FROM lessons
        WHERE conversation_source_lesson_id = $1`, [current.id])).rows[0];
      if (linked) return { error: `Pelajaran ini sumber dialog "${linked.title}". Hapus pelajaran Percakapan itu dulu sebelum mengganti jenisnya.` };
    }
    if (type && oldType !== type) {
      if (req.companyAccess && !req.companyAccess.isAdmin) throw fail(403, 'owner_required_for_type_change');
      if (oldType === 'quiz') {
        await client.query(`DELETE FROM quiz_questions WHERE lesson_id = $1`, [req.params.id]);
        await client.query(`DELETE FROM quiz_attempts WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'kanji') {
        await client.query(`DELETE FROM kanji_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'deck') {
        await client.query(`DELETE FROM lesson_deck_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'kana') {
        await client.query(`DELETE FROM lesson_kana_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'grammar_task') {
        await client.query(`DELETE FROM lesson_grammar_task_items WHERE lesson_id = $1`, [req.params.id]);
      }
    }

      // PUT also supports partial callers. Only fields actually supplied in
      // the payload replace a saved segment; the admin editor sends all three
      // so it can deliberately clear the source when lesson type changes.
      const acceptsVideoSegment = supportsVideoSegment(effectiveType);
      const segment = normalizeSegment(
        acceptsVideoSegment
          ? (hasVideoSource ? videoSourceId : current.video_source_id)
          : null,
        acceptsVideoSegment
          ? (hasVideoStart ? videoStartSeconds : current.video_start_seconds)
          : null,
        acceptsVideoSegment
          ? (hasVideoEnd ? videoEndSeconds : current.video_end_seconds)
          : null
      );
      if (segment.error) return { error: segment.error };

      const result = await client.query(
        `UPDATE lessons SET
          slug = COALESCE($2, slug),
          title = COALESCE($3, title),
          type = COALESCE($4, type),
          content = CASE WHEN $21::boolean THEN $5 ELSE content END,
          video_url = COALESCE($6, video_url),
          video_source_id = CASE WHEN $10::boolean THEN $7 ELSE video_source_id END,
          video_start_seconds = CASE WHEN $11::boolean THEN $8 ELSE video_start_seconds END,
          video_end_seconds = CASE WHEN $12::boolean THEN $9 ELSE video_end_seconds END,
          duration_minutes = COALESCE($13, duration_minutes),
          sort_order = COALESCE($14, sort_order),
          passing_score_pct = COALESCE($15, passing_score_pct),
          questions_per_attempt = CASE WHEN $17::boolean THEN $16 ELSE questions_per_attempt END,
          cooldown_hours = COALESCE($18, cooldown_hours),
          popup_after_lesson_id = CASE WHEN $20::boolean THEN $19 ELSE popup_after_lesson_id END,
          conversation_source_lesson_id = $22
        WHERE id = $1 RETURNING *`,
        [
          req.params.id, slug, title, type, content, videoUrl,
          segment.videoSourceId, segment.videoStartSeconds, segment.videoEndSeconds,
          true, true, true,
          durationMinutes, sortOrder,
          passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : null,
          hasQPA && questionsPerAttempt !== '' && questionsPerAttempt != null ? Number(questionsPerAttempt) : null,
          hasQPA,
          cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : null,
          hasPopup && popupAfterLessonId ? popupAfterLessonId : null,
          hasPopup,
          hasContent,
          conversationSource,
        ]
      );
    if (result.rows.length === 0) return { notFound: true };
    return { lesson: result.rows[0] };
    },
  });
  if (!guarded) return;
  const outcome = guarded.value;
  if (outcome.notFound) return res.status(404).json({ error: 'Not found' });
  if (outcome.error) return res.status(400).json({ error: outcome.error });
  invalidateKanjiCatalogCache();
  res.json({ lesson: outcome.lesson, validation: guarded.report });
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, client => courseIdsForLesson(client, req.params.id),
    client => client.query('DELETE FROM lessons WHERE id=$1', [req.params.id]));
  if (!result) return;
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// ===== QUIZ QUESTIONS (with options in one call) =====

const QUIZ_CATEGORIES = new Set(['vocabulary', 'grammar', 'reading', 'listening', 'custom']);

function normalizeQuizCategory(value) {
  const category = String(value || 'vocabulary').toLowerCase();
  return QUIZ_CATEGORIES.has(category) ? category : 'vocabulary';
}

function normalizeQuizSectionNumber(value) {
  return Math.max(1, Number(value) || 1);
}

async function validateQuizAudioScene(scene, script, category) {
  if (!scene) return;
  if (category !== 'listening') throw new Error('Pemeran audio hanya untuk soal menyimak.');
  const turns = parseDialog(script);
  if (!turns) throw new Error('Skrip audio harus memakai label pemeran.');
  // Explicit mappings are mandatory for every non-narrator turn, including
  // when visuals are disabled. Do not silently guess a missing actor's voice.
  sceneTurnVoices(turns, scene, () => ({ voiceId: null, role: 'narrator' }));
  await validateSceneVoices(scene, fetchElevenVoices);
}

router.get('/lessons/:lessonId/quiz', asyncHandler(async (req, res) => {
  const lessonRow = await query(
    `SELECT id, passing_score_pct, questions_per_attempt, cooldown_hours, assessment_policy
       FROM lessons WHERE id = $1 LIMIT 1`,
    [req.params.lessonId]
  );
  const lessonMeta = lessonRow.rows[0] || null;
  const questions = await query(
    `SELECT *,xmin::text AS revision FROM quiz_questions
     WHERE lesson_id = $1
       AND ($2::text IS NULL OR assessment_meta->>'version' = $2)
     ORDER BY CASE question_category
                WHEN 'vocabulary' THEN 1
                WHEN 'grammar' THEN 2
                WHEN 'reading' THEN 3
                WHEN 'listening' THEN 4
                WHEN 'custom' THEN 5
                ELSE 9
              END,
              section_number ASC, sort_order ASC`,
    [req.params.lessonId, lessonMeta?.assessment_policy?.version || null]
  );
  const qIds = questions.rows.map((q) => q.id);
  let optsByQ = {};
  if (qIds.length > 0) {
    const opts = await query(
      `SELECT * FROM quiz_options WHERE question_id = ANY($1::uuid[]) ORDER BY sort_order ASC`,
      [qIds]
    );
    for (const o of opts.rows) {
      if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
      optsByQ[o.question_id].push(o);
    }
  }
  res.json({
    questions: questions.rows.map((q) => ({ ...q, options: optsByQ[q.id] || [] })),
    lessonMeta,
  });
}));

router.post('/quiz-questions', asyncHandler(async (req, res) => {
  const {
    lessonId, question, questionType, questionCategory, sectionNumber,
    sectionLabel, sectionInstruction, audioScript, audioScene, passage, imageUrl,
    correctAnswer, explanation, sortOrder, options, grammarId,
  } = req.body || {};
  if (!lessonId || !question) return res.status(400).json({ error: 'lessonId and question required' });

  const category = normalizeQuizCategory(questionCategory);
  const sectionNo = normalizeQuizSectionNumber(sectionNumber);
  const sectionTitle = (sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`;
  const script = (audioScript && String(audioScript).trim()) || null;
  let scene;
  try {
    scene = normalizeDialogScene(audioScene);
    await validateQuizAudioScene(scene, script, category);
  } catch (err) { return res.status(400).json({ error: err.message }); }

  // Question + options written atomically: a crash mid-loop must not leave a
  // question with a partial option set (a broken live quiz).
  const guarded = await adminBoundaryWrite(res, {
    prepare: async client => {
      await assertQuizGrammarReachable(client, grammarId, lessonId);
      return { scope: { lessonId }, contentType: 'quiz_question', operation: 'live_write',
      verifiedGrammarIds: grammarId ? [grammarId] : [],
      fields: [boundaryField('question', question), boundaryField('sectionLabel', sectionTitle),
        boundaryField('sectionInstruction', sectionInstruction), boundaryField('audioScript', audioScript),
        boundaryField('passage', passage), boundaryField('correctAnswer', correctAnswer),
        boundaryField('explanation', explanation),
        ...boundaryFieldsFrom('options', options)],
      expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => {
    const qRes = await client.query(
      `INSERT INTO quiz_questions (
         lesson_id, question, question_type, question_category,
         section_number, section_label, section_instruction, audio_script, passage, image_url,
         correct_answer, explanation, sort_order, grammar_id, audio_scene
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       RETURNING *,xmin::text AS revision`,
      [
        lessonId,
        question,
        questionType || 'multiple_choice',
        category,
        sectionNo,
        sectionTitle,
        sectionInstruction || null,
        script,
        (passage && String(passage).trim()) || null,
        (imageUrl && String(imageUrl).trim()) || null,
        correctAnswer || null,
        explanation || null,
        sortOrder || 0,
        // Tautan opsional ke pola grammar (migration 122) — bikin soal ini ikut
        // mengisi analisis per-konsep tanpa biaya AI (penilaiannya deterministik).
        (grammarId && String(grammarId).trim()) || null,
        scene ? JSON.stringify(scene) : null,
      ]
    );
    const row = qRes.rows[0];

    if (Array.isArray(options) && options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await client.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
        );
      }
    }
    return row;
    },
  });
  if (!guarded) return;
  const warnings = await safeLearningWarnings(() => quizLearningScopeWarnings(guarded.value.id));
  res.status(201).json({ question: guarded.value, warnings, validation: guarded.report });
}));

router.put('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const {
    question, questionType, questionCategory, sectionNumber,
    sectionLabel, sectionInstruction, audioScript, audioScene, passage, imageUrl,
    correctAnswer, explanation, sortOrder, options, grammarId,
  } = req.body || {};
  const category = questionCategory ? normalizeQuizCategory(questionCategory) : null;
  // Presence-checked, bukan COALESCE: admin harus bisa MELEPAS tautan pola
  // (kirim grammarId: null) — dengan COALESCE itu mustahil.
  const hasGrammarId = Object.prototype.hasOwnProperty.call(req.body || {}, 'grammarId');
  const grammarIdNorm = hasGrammarId ? ((grammarId && String(grammarId).trim()) || null) : null;
  const sectionNo = sectionNumber == null ? null : normalizeQuizSectionNumber(sectionNumber);
  const hasSectionInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  const hasAudioScript = Object.prototype.hasOwnProperty.call(req.body || {}, 'audioScript');
  const hasAudioScene = Object.prototype.hasOwnProperty.call(req.body || {}, 'audioScene');
  let scene;
  try { scene = hasAudioScene ? normalizeDialogScene(audioScene) : null; }
  catch (err) { return res.status(400).json({ error: err.message }); }
  const hasPassage = Object.prototype.hasOwnProperty.call(req.body || {}, 'passage');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'imageUrl');
  const audioScriptNorm = hasAudioScript ? ((audioScript && String(audioScript).trim()) || null) : null;
  const passageNorm = hasPassage ? ((passage && String(passage).trim()) || null) : null;
  const imageUrlNorm = hasImageUrl ? ((imageUrl && String(imageUrl).trim()) || null) : null;
  // Update + wholesale option replace must be atomic: the old DELETE-then-loop
  // could wipe every option then crash, leaving a live question answerless.
  const guarded = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = await client.query(`SELECT *,xmin::text AS row_revision FROM quiz_questions WHERE id=$1
        ${locked ? 'FOR UPDATE' : ''}`, [req.params.id]);
      if (!old.rows.length) throw new BoundaryContextError('lesson_not_found');
      const row = old.rows[0];
      if (locked && (hasAudioScene || hasAudioScript || category)) {
        try {
          await validateQuizAudioScene(hasAudioScene ? scene : row.audio_scene,
            hasAudioScript ? audioScriptNorm : row.audio_script, category || row.question_category);
        } catch (error) {
          error.status = 400;
          throw error;
        }
      }
      const oldOptions = Array.isArray(options) ? [] : (await client.query(
        'SELECT option_text,image_url FROM quiz_options WHERE question_id=$1 ORDER BY sort_order', [req.params.id])).rows;
      const effectiveGrammarId = hasGrammarId ? grammarIdNorm : row.grammar_id;
      await assertQuizGrammarReachable(client, effectiveGrammarId, row.lesson_id);
      return { scope: { lessonId: row.lesson_id }, contentType: 'quiz_question',
        contentId: row.id, operation: 'live_write', verifiedGrammarIds: effectiveGrammarId ? [effectiveGrammarId] : [],
        fields: [boundaryField('question', question ?? row.question),
          boundaryField('sectionLabel', sectionLabel ?? row.section_label),
          boundaryField('sectionInstruction', hasSectionInstruction ? sectionInstruction : row.section_instruction),
          boundaryField('audioScript', hasAudioScript ? audioScriptNorm : row.audio_script),
          boundaryField('passage', hasPassage ? passageNorm : row.passage),
          boundaryField('correctAnswer', correctAnswer ?? row.correct_answer),
          boundaryField('explanation', explanation ?? row.explanation),
          ...boundaryFieldsFrom('options', Array.isArray(options) ? options : oldOptions)],
        contentIsNewOrChanged: [question, sectionLabel, correctAnswer, explanation].some(value => value != null) ||
          hasSectionInstruction || hasAudioScript || hasPassage || Array.isArray(options) || hasGrammarId,
        expectedRevision: req.body?.expectedRevision, currentRevision: row.row_revision,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => {
    const result = await client.query(
      `UPDATE quiz_questions SET
         question = COALESCE($2, question),
         question_type = COALESCE($3, question_type),
         correct_answer = COALESCE($4, correct_answer),
         explanation = COALESCE($5, explanation),
         sort_order = COALESCE($6, sort_order),
         question_category = COALESCE($7, question_category),
         section_number = COALESCE($8, section_number),
         section_label = COALESCE($9, section_label),
         section_instruction = CASE WHEN $11::boolean THEN $10 ELSE section_instruction END,
         audio_script = CASE WHEN $13::boolean THEN $12 ELSE audio_script END,
         image_url = CASE WHEN $15::boolean THEN $14 ELSE image_url END,
         passage = CASE WHEN $17::boolean THEN $16 ELSE passage END,
         grammar_id = CASE WHEN $19::boolean THEN $18::uuid ELSE grammar_id END,
         audio_scene = CASE WHEN $21::boolean THEN $20::jsonb ELSE audio_scene END
        WHERE id = $1 RETURNING *,xmin::text AS revision`,
      [
        req.params.id,
        question,
        questionType,
        correctAnswer,
        explanation,
        sortOrder,
        category,
        sectionNo,
        sectionLabel || (sectionNo ? `Section ${sectionNo}` : null),
        sectionInstruction || null,
        hasSectionInstruction,
        audioScriptNorm,
        hasAudioScript,
        imageUrlNorm,
        hasImageUrl,
        passageNorm,
        hasPassage,
        grammarIdNorm,
        hasGrammarId,
        scene ? JSON.stringify(scene) : null,
        hasAudioScene,
      ]
    );
    if (result.rows.length === 0) return null;

    if (Array.isArray(options)) {
      // Replace options wholesale
      await client.query(`DELETE FROM quiz_options WHERE question_id = $1`, [req.params.id]);
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await client.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
        );
      }
    }
    return result.rows[0];
    },
  });
  if (!guarded) return;
  if (!guarded.value) return res.status(404).json({ error: 'Not found' });
  const warnings = await safeLearningWarnings(() => quizLearningScopeWarnings(guarded.value.id));
  res.json({ question: guarded.value, warnings, validation: guarded.report });
}));

router.delete('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const result = await adminLockedMutation(res, async client => (await client.query(
    `SELECT m.course_id FROM quiz_questions q JOIN lessons l ON l.id=q.lesson_id
      JOIN modules m ON m.id=l.module_id WHERE q.id=$1`, [req.params.id])).rows.map(row => row.course_id),
  client => client.query('DELETE FROM quiz_questions WHERE id=$1', [req.params.id]));
  if (!result) return;
  res.json({ ok: true });
}));

// Bulk update section meta (label / instruction / passage) — semua soal di
// (lesson, category, number) yang sama. Dipakai admin pas mereka edit info
// section, supaya ga perlu update tiap pertanyaan satu-satu. Passage dishare
// section-level untuk dokkai (reading).
router.put('/lessons/:lessonId/quiz/sections/:category/:number', asyncHandler(async (req, res) => {
  const { lessonId, category, number } = req.params;
  const { sectionLabel, sectionInstruction, passage } = req.body || {};
  const cat = normalizeQuizCategory(category);
  const sectionNo = normalizeQuizSectionNumber(number);
  const hasLabel = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionLabel');
  const hasInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  const hasPassage = Object.prototype.hasOwnProperty.call(req.body || {}, 'passage');
  if (!hasLabel && !hasInstruction && !hasPassage) {
    return res.status(400).json({ error: 'sectionLabel, sectionInstruction or passage required' });
  }
  const labelNorm = hasLabel
    ? ((sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`)
    : null;
  const instructionNorm = hasInstruction
    ? ((sectionInstruction && String(sectionInstruction).trim()) || null)
    : null;
  const passageNorm = hasPassage
    ? ((passage && String(passage).trim()) || null)
    : null;
  const guarded = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const rows = await client.query(`SELECT q.id,q.section_label,q.section_instruction,q.passage
        FROM quiz_questions q JOIN lessons l ON l.id=q.lesson_id
        WHERE q.lesson_id=$1 AND q.question_category=$2 AND q.section_number=$3
          AND (l.assessment_policy->>'version' IS NULL
               OR q.assessment_meta->>'version'=l.assessment_policy->>'version')
        ${locked ? 'FOR UPDATE OF q' : ''}`, [lessonId, cat, sectionNo]);
      return { scope: { lessonId }, contentType: 'shared_passage', operation: 'live_write',
        fields: rows.rows.flatMap((row, index) => [
          boundaryField(`questions[${index}].sectionLabel`, hasLabel ? labelNorm : row.section_label),
          boundaryField(`questions[${index}].sectionInstruction`, hasInstruction ? instructionNorm : row.section_instruction),
          boundaryField(`questions[${index}].passage`, hasPassage ? passageNorm : row.passage),
        ]), contentIsNewOrChanged: hasLabel || hasInstruction || hasPassage,
        expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
    },
    write: async client => (await client.query(
    `UPDATE quiz_questions q
        SET section_label = CASE WHEN $5::boolean THEN $3 ELSE section_label END,
            section_instruction = CASE WHEN $6::boolean THEN $4 ELSE section_instruction END,
            passage = CASE WHEN $8::boolean THEN $9 ELSE passage END
       FROM lessons l
      WHERE q.lesson_id = $1 AND l.id = q.lesson_id AND question_category = $2 AND section_number = $7
        AND (l.assessment_policy->>'version' IS NULL
             OR q.assessment_meta->>'version' = l.assessment_policy->>'version')`,
    [lessonId, cat, labelNorm, instructionNorm, hasLabel, hasInstruction, sectionNo, hasPassage, passageNorm]
    )),
  });
  if (!guarded) return;
  const warnings = hasPassage
    ? await safeLearningWarnings(() => lessonContentLearningScopeWarnings(lessonId, [passageNorm]))
    : [];
  res.json({ ok: true, updated: guarded.value.rowCount, warnings, validation: guarded.report });
}));

// Delete whole section — semua soal di (lesson, category, number) terhapus.
router.delete('/lessons/:lessonId/quiz/sections/:category/:number', asyncHandler(async (req, res) => {
  const { lessonId, category, number } = req.params;
  const cat = normalizeQuizCategory(category);
  const sectionNo = normalizeQuizSectionNumber(number);
  const guarded = await adminLockedMutation(res, client => courseIdsForLesson(client, lessonId), client => client.query(
    `DELETE FROM quiz_questions q USING lessons l
      WHERE q.lesson_id = $1 AND l.id = q.lesson_id AND question_category = $2 AND section_number = $3
        AND (l.assessment_policy->>'version' IS NULL
             OR q.assessment_meta->>'version' = l.assessment_policy->>'version')`,
    [lessonId, cat, sectionNo]
  ));
  if (!guarded) return;
  res.json({ ok: true, deleted: guarded.value?.rowCount || 0 });
}));

// ===== SENSEI =====

router.get('/sensei', asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM sensei ORDER BY sort_order ASC, created_at ASC`);
  res.json({ sensei: result.rows });
}));

router.post('/sensei', asyncHandler(async (req, res) => {
  const { name, title, bio, tags, photoUrl, photoPosition, sortOrder, isPublished } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = await query(
    `INSERT INTO sensei (name, title, bio, tags, photo_url, photo_position, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      name, title || null, bio || null,
      JSON.stringify(Array.isArray(tags) ? tags : []),
      photoUrl || null, photoPosition || null, sortOrder || 0, isPublished !== false,
    ]
  );
  res.status(201).json({ sensei: result.rows[0] });
}));

router.put('/sensei/:id', asyncHandler(async (req, res) => {
  const { name, title, bio, tags, photoUrl, photoPosition, sortOrder, isPublished } = req.body || {};
  const result = await query(
    `UPDATE sensei SET
       name = COALESCE($2, name),
       title = COALESCE($3, title),
       bio = COALESCE($4, bio),
       tags = COALESCE($5::jsonb, tags),
       photo_url = COALESCE($6, photo_url),
       photo_position = COALESCE($7, photo_position),
       sort_order = COALESCE($8, sort_order),
       is_published = COALESCE($9, is_published),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, name, title, bio,
      Array.isArray(tags) ? JSON.stringify(tags) : null,
      photoUrl, photoPosition, sortOrder, isPublished,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ sensei: result.rows[0] });
}));

router.delete('/sensei/:id', asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT photo_url FROM sensei WHERE id = $1`,
    [req.params.id]
  );
  await query(`DELETE FROM sensei WHERE id = $1`, [req.params.id]);
  await unlinkUploadByUrl(existing.rows[0]?.photo_url);
  res.json({ ok: true });
}));

// ===== TESTIMONIALS =====

router.get('/testimonials', asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM testimonials ORDER BY sort_order ASC, created_at ASC`);
  res.json({ testimonials: result.rows });
}));

router.post('/testimonials', asyncHandler(async (req, res) => {
  const { name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = await query(
    `INSERT INTO testimonials (name, location, occupation, photo_url, photo_position, quote, course_slug, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      name, location || null, occupation || null, photoUrl || null, photoPosition || null,
      quote || null, courseSlug || null, sortOrder || 0, isPublished !== false,
    ]
  );
  res.status(201).json({ testimonial: result.rows[0] });
}));

router.put('/testimonials/:id', asyncHandler(async (req, res) => {
  const { name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished } = req.body || {};
  const result = await query(
    `UPDATE testimonials SET
       name = COALESCE($2, name),
       location = COALESCE($3, location),
       occupation = COALESCE($4, occupation),
       photo_url = COALESCE($5, photo_url),
       photo_position = COALESCE($6, photo_position),
       quote = COALESCE($7, quote),
       course_slug = COALESCE($8, course_slug),
       sort_order = COALESCE($9, sort_order),
       is_published = COALESCE($10, is_published),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ testimonial: result.rows[0] });
}));

router.delete('/testimonials/:id', asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT photo_url FROM testimonials WHERE id = $1`,
    [req.params.id]
  );
  await query(`DELETE FROM testimonials WHERE id = $1`, [req.params.id]);
  await unlinkUploadByUrl(existing.rows[0]?.photo_url);
  res.json({ ok: true });
}));

// ===== USERS (admin view only) =====

// Shared between the paginated list below and the CSV export — the export
// is meant to pull exactly what the admin is currently looking at (same
// search + same marketing-profile filters), not the whole table.
function buildUserFilters(req) {
  const q = String(req.query.q || '').trim();
  const province = String(req.query.province || '').trim();
  const learningGoal = String(req.query.learningGoal || '').trim();
  const referralSource = String(req.query.referralSource || '').trim();
  const params = [];
  const clauses = [];
  if (q) {
    params.push('%' + q + '%');
    const p = `$${params.length}`;
    clauses.push(`(u.email ILIKE ${p} OR u.full_name ILIKE ${p} OR u.google_name ILIKE ${p})`);
  }
  if (province) { params.push(province); clauses.push(`mp.province = $${params.length}`); }
  if (learningGoal) { params.push(learningGoal); clauses.push(`mp.learning_goal = $${params.length}`); }
  if (referralSource) { params.push(referralSource); clauses.push(`mp.referral_source = $${params.length}`); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

router.get('/users', asyncHandler(async (req, res) => {
  // Server-side search + pagination so users beyond the old hard cap of 500
  // are reachable (search by name/email; page with limit/offset).
  const { where, params } = buildUserFilters(req);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const totalRes = await query(
    `SELECT COUNT(*)::int AS n FROM users u LEFT JOIN user_marketing_profile mp ON mp.user_id = u.id ${where}`,
    params
  );
  const listParams = params.slice();
  listParams.push(limit, offset);
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.google_name, u.avatar_url, u.created_at,
            COALESCE(s.xp, 0) AS xp, COALESCE(s.streak_days, 0) AS streak_days,
            COALESCE(s.total_lessons_completed, 0) AS total_lessons_completed,
            s.last_active_date,
            mp.birth_date, mp.province, mp.city, mp.phone, mp.learning_goal, mp.referral_source
     FROM users u
     LEFT JOIN user_stats s ON s.user_id = u.id
     LEFT JOIN user_marketing_profile mp ON mp.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  res.json({ users: result.rows, total: totalRes.rows[0].n });
}));

// GET /admin/users/marketing-export — CSV of every student matching the
// current filters (not paginated, unlike /users above), for pulling into
// spreadsheets or ads-audience tools. This is what actually makes the data
// usable for "pengembangan marketing" — an HTML table alone doesn't.
router.get('/users/marketing-export', asyncHandler(async (req, res) => {
  const { where, params } = buildUserFilters(req);
  const result = await query(
    `SELECT u.full_name, u.email, mp.birth_date::text AS birth_date, mp.province, mp.city, mp.phone,
            mp.learning_goal, mp.referral_source, mp.background, mp.japan_goal,
            mp.category_interest, mp.primary_problem, mp.target_timeline,
            mp.referrer_name, mp.source_detail, mp.strategy_version, u.created_at,
            mp.internship_field, mp.internship_field_other, mp.background_other,
            mp.learning_goal_other, mp.primary_problem_other, mp.referral_source_other
     FROM users u
     LEFT JOIN user_marketing_profile mp ON mp.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC`,
    params
  );
  const header = ['Nama', 'Email', 'Tanggal Lahir', 'Provinsi', 'Kota', 'WhatsApp', 'Tujuan Belajar', 'Sumber Referral', 'Latar Belakang', 'Rencana Jepang', 'Bidang Minat', 'Kendala Utama', 'Target Waktu', 'Nama Pemberi Rekomendasi', 'Detail Sumber', 'Versi Form', 'Bergabung', 'Bidang Magang', 'Bidang Magang Lainnya', 'Latar Belakang Lainnya', 'Tujuan Belajar Lainnya', 'Kendala Utama Lainnya', 'Sumber Kenal Lainnya'];
  const csvEscape = (v) => {
    const raw = v == null ? '' : String(v);
    const s = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // pg returns DATE/TIMESTAMPTZ columns as JS Date objects — String(date)
  // gives the verbose "Thu Jan 01 1998 00:00:00 GMT+0000 (...)" form, not
  // useful in a spreadsheet. Format explicitly instead.
  const asDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const rows = result.rows.map((r) => [
    r.full_name, r.email, asDate(r.birth_date), r.province || '', r.city || '', r.phone || '',
    r.learning_goal || '', r.referral_source || '', r.background || '', r.japan_goal || '',
    r.category_interest || '', r.primary_problem || '', r.target_timeline || '',
    r.referrer_name || '', r.source_detail || '', r.strategy_version ?? '', asDate(r.created_at),
    r.internship_field || '', r.internship_field_other || '', r.background_other || '',
    r.learning_goal_other || '', r.primary_problem_other || '', r.referral_source_other || '',
  ].map(csvEscape).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="siswa-eznihongo-${new Date().toISOString().slice(0, 10)}.csv"`);
  // BOM supaya Excel membuka UTF-8 dengan benar (nama/kota berkarakter non-ASCII).
  res.send('\uFEFF' + csv);
}));

// ===== AKSES DASHBOARD (course entitlement grants) =====
// Beri/cabut akses kursus tanpa lewat checkout: insert/soft-revoke baris
// user_enrollments (grant sama persis dengan POST /api/enrollments, tapi
// admin bisa pilih user mana by email; revoke mengubah status, bukan
// DELETE — lihat migration 120). user_enrollments = single source of
// truth akses, di-scope per course_id (akses N5 tidak pernah membuka N4).

// GET /api/admin/user-access?email= — cari user + daftar kursus yang sudah di-enroll
router.get('/user-access', asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email_required' });

  const userRow = await query(
    `SELECT id, email, full_name, created_at FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const enrolled = await query(
    `SELECT c.id AS course_id, c.slug, c.title, c.level, e.enrolled_at,
            e.status, e.expires_at, e.source, e.revoked_at
       FROM user_enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC`,
    [user.id]
  );
  const courses = await query(
    `SELECT id, slug, title, level, is_published, is_available, is_free
       FROM courses WHERE is_published = TRUE
      ORDER BY sort_order ASC, created_at ASC`
  );
  // Order history for this user — surfaced alongside enrollments so an
  // admin looking at "why does this user have access" (or "do they have a
  // pending order I should review") doesn't have to cross-reference the
  // Pesanan tab separately. Same effective-status computation as the
  // orders list/detail endpoints.
  const orders = await query(
    `SELECT o.id, o.order_number, o.course_title_snapshot, o.amount_idr,
            ${ORDER_EFFECTIVE_STATUS_SQL} AS status, o.created_at, o.expires_at, o.approved_at
       FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
    [user.id]
  );
  res.json({ user, enrollments: enrolled.rows, courses: courses.rows, orders: orders.rows });
}));

// POST /api/admin/user-access/grant — { email, courseSlug, expiresAt? } →
// enroll user ke kursus (atau reaktivasi entitlement yang sebelumnya
// di-revoke). expiresAt opsional (ISO string) untuk akses time-boxed;
// kosong = akses permanen sampai di-revoke manual.
router.post('/user-access/grant', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseSlug = String(req.body?.courseSlug || '').trim();
  const expiresAtRaw = req.body?.expiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAtRaw && Number.isNaN(expiresAt?.getTime())) {
    return res.status(400).json({ error: 'invalid_expires_at' });
  }
  // A past expiresAt would create a grant that's already lapsed the instant
  // it's saved (hasCourseAccess checks expires_at > NOW()) — silently
  // useless rather than an error, so reject it instead of accepting it.
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'expires_at_in_past' });
  }
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (!courseSlug) return res.status(400).json({ error: 'course_required' });

  const userRow = await query(
    `SELECT id, email, full_name FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const courseRow = await query(
    `SELECT id, slug, title, is_published FROM courses WHERE slug = $1 LIMIT 1`,
    [courseSlug]
  );
  const course = courseRow.rows[0];
  if (!course) return res.status(404).json({ error: 'course_not_found' });
  if (!course.is_published) return res.status(400).json({ error: 'course_not_published' });

  // ON CONFLICT reactivates a previously-revoked row (status back to active,
  // revoked_at cleared) instead of leaving it stuck revoked — grant is the
  // one explicit "give this user access" action, so it should always work.
  const ins = await query(
    `INSERT INTO user_enrollments (user_id, course_id, status, source, expires_at)
     VALUES ($1, $2, 'active', 'admin_grant', $3)
     ON CONFLICT (user_id, course_id) DO UPDATE
       SET status = 'active', revoked_at = NULL, expires_at = $3
     RETURNING id, (xmax = 0) AS inserted`,
    [user.id, course.id, expiresAt]
  );
  res.json({
    ok: true,
    alreadyEnrolled: !ins.rows[0].inserted,
    user: { email: user.email, full_name: user.full_name },
    course: { slug: course.slug, title: course.title },
  });
}));

// POST /api/admin/user-access/revoke — { email, courseId } → cabut akses
// (soft-revoke: status='revoked', bukan DELETE) supaya baris enrollment +
// riwayatnya tetap ada dan progres siswa (user_progress, tidak di-FK ke
// user_enrollments) tidak tersentuh.
router.post('/user-access/revoke', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseId = String(req.body?.courseId || '');
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (!courseId) return res.status(400).json({ error: 'course_required' });

  const userRow = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const upd = await query(
    `UPDATE user_enrollments
        SET status = 'revoked', revoked_at = NOW()
      WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      RETURNING id`,
    [user.id, courseId]
  );
  if (upd.rows.length === 0) return res.status(404).json({ error: 'enrollment_not_found' });
  res.json({ ok: true });
}));

// ===== HAK HAPUS DATA (privacy.html bagian 9) =====
// Admin-only dan itu memang sesuai janjinya: privacy.html menyuruh siswa
// menghubungi lewat WhatsApp menyebutkan email akunnya, bukan menekan tombol
// sendiri. Lihat backend/src/user-erasure.js untuk alasan teknis kenapa
// penghapusan akun berbentuk anonimisasi, bukan DELETE.

// DELETE /api/admin/users/:email/marketing-profile — tarik persetujuan saja.
// Akun, akses kursus, dan progres belajar TIDAK disentuh. Ini permintaan yang
// paling mungkin datang ("jangan pakai data saya untuk marketing"), jadi
// sengaja dipisah dari penghapusan akun supaya admin tidak perlu memakai palu
// besar untuk keperluan kecil.
router.delete('/users/:email/marketing-profile', asyncHandler(async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email_required' });

  const userRow = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const result = await withTransaction((client) => deleteMarketingProfile(client, user.id));
  res.json({ ok: true, ...result });
}));

// POST /api/admin/users/:email/erase — { confirmEmail, acknowledgePaidHistory? }
// → hapus akun. Tidak bisa dibatalkan, jadi admin wajib mengetik ulang email
// yang persis sama sebagai konfirmasi (pola yang sama dengan konfirmasi hapus
// repo di GitHub) — tombol saja terlalu mudah kepencet untuk aksi
// seireversibel ini. Seluruhnya dalam SATU transaksi: kalau ada satu tabel
// gagal dibersihkan, semuanya di-rollback dan akunnya tetap utuh — jauh lebih
// baik daripada akun setengah terhapus yang datanya tercecer.
router.post('/users/:email/erase', asyncHandler(async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const confirmEmail = String(req.body?.confirmEmail || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (confirmEmail !== email) return res.status(400).json({ error: 'confirmation_mismatch' });

  const userRow = await query(`SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  // Admin tidak boleh menghapus akunnya sendiri: dia akan kehilangan sesi di
  // tengah aksi dan (kalau itu admin terakhir) mengunci semua orang keluar.
  if (String(user.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'cannot_erase_self' });
  }

  // Fitur ini ditujukan untuk user yang TIDAK pernah membayar. Siswa yang
  // sudah pernah membayar datanya sengaja dipertahankan sebagai catatan
  // historis pelanggan, dan penghapusan tidak bisa dibatalkan — jadi
  // kebijakan itu dikunci di sini, bukan diandalkan pada ingatan admin saat
  // menekan tombol. Masih bisa ditembus kalau memang disengaja, tapi harus
  // eksplisit.
  const paid = await query(
    `SELECT count(*)::int AS n FROM orders WHERE user_id = $1 AND status = 'approved'`,
    [user.id]
  );
  const paidOrders = paid.rows[0]?.n || 0;
  if (paidOrders > 0 && req.body?.acknowledgePaidHistory !== true) {
    return res.status(409).json({ error: 'user_has_paid_orders', paidOrders });
  }

  const summary = await withTransaction((client) => eraseUserAccount(client, user.id));
  res.json({ ok: true, summary, paidOrders });
}));

// ===== ORDERS (Phase 2 — manual bank transfer payment verification) =====
// Course purchase orders, separate from the Kanji PWA's Midtrans-driven
// `subscriptions` (different table, different identity realm). Approval is
// the ONLY event that grants access — the user_enrollments upsert happens
// inside the same transaction as the order/payment status flip below, never
// at order-creation or proof-upload time. See backend/src/routes/orders.js
// for the student-facing side and migration 121 for the schema.

function orderEffectiveStatus(order) {
  if (order.status === 'approved' || order.status === 'cancelled') return order.status;
  if (new Date(order.expires_at).getTime() < Date.now()) return 'expired';
  return order.status;
}

// GET /api/admin/orders?status=&q=&limit=&offset= — queue listing.
// status: exact DB status to filter on, or omitted/'' for all.
// q: matches order_number or user email.
// 'expired' is never a stored status (see orderEffectiveStatus above) — a
// row can sit at status='pending_payment'/'awaiting_review' in the DB long
// after its expires_at has passed. Filtering on the raw `status` column
// would make `?status=expired` match zero rows forever, so both the list
// and the count query filter on this same CASE expression instead —
// mirrors orderEffectiveStatus() exactly, just computed in SQL.
const ORDER_EFFECTIVE_STATUS_SQL = `
  CASE
    WHEN o.status IN ('approved', 'cancelled') THEN o.status
    WHEN o.expires_at < NOW() THEN 'expired'
    ELSE o.status
  END`;

router.get('/orders', asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const result = await query(
    `SELECT o.*, u.email AS user_email, u.full_name AS user_full_name,
            (SELECT COUNT(*)::int FROM order_payments p WHERE p.order_id = o.id) AS payment_attempts
       FROM orders o
       JOIN users u ON u.id = o.user_id
      WHERE ($1 = '' OR ${ORDER_EFFECTIVE_STATUS_SQL} = $1)
        AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
      ORDER BY o.created_at DESC
      LIMIT $3 OFFSET $4`,
    [status, q, limit, offset]
  );
  const totalRes = await query(
    `SELECT COUNT(*)::int AS n
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE ($1 = '' OR ${ORDER_EFFECTIVE_STATUS_SQL} = $1)
        AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')`,
    [status, q]
  );
  res.json({
    orders: result.rows.map((o) => ({
      id: o.id, orderNumber: o.order_number, courseTitle: o.course_title_snapshot,
      amountIdr: o.amount_idr, status: orderEffectiveStatus(o), createdAt: o.created_at,
      expiresAt: o.expires_at, paymentAttempts: o.payment_attempts,
      user: { email: o.user_email, fullName: o.user_full_name },
    })),
    total: totalRes.rows[0].n,
  });
}));

// GET /api/admin/orders/:id — full detail incl. every payment attempt.
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const orderRes = await query(
    `SELECT o.*, u.email AS user_email, u.full_name AS user_full_name
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 LIMIT 1`,
    [req.params.id]
  );
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  const payments = await query(
    `SELECT p.*, r.email AS reviewed_by_email
       FROM order_payments p
       LEFT JOIN users r ON r.id = p.reviewed_by
      WHERE p.order_id = $1
      ORDER BY p.submitted_at DESC`,
    [order.id]
  );
  res.json({
    order: {
      id: order.id, orderNumber: order.order_number, courseId: order.course_id,
      courseTitle: order.course_title_snapshot, amountIdr: order.amount_idr,
      status: orderEffectiveStatus(order), createdAt: order.created_at,
      expiresAt: order.expires_at, approvedAt: order.approved_at,
      user: { email: order.user_email, fullName: order.user_full_name },
    },
    payments: payments.rows.map((p) => ({
      id: p.id, status: p.status, hasProof: !!p.proof_mime,
      claimedBankName: p.claimed_bank_name, claimedSenderName: p.claimed_sender_name,
      claimedAmountIdr: p.claimed_amount_idr, claimedTransferredAt: p.claimed_transferred_at,
      submittedAt: p.submitted_at, reviewedAt: p.reviewed_at, reviewedBy: p.reviewed_by_email,
      rejectionReason: p.rejection_reason,
    })),
  });
}));

// POST /api/admin/orders/:id/approve — { paymentId } from the reviewed detail.
// Never select a replacement proof on the admin's behalf. Grants access atomically: guarded
// status transitions on both order_payments and orders, then the
// user_enrollments upsert, all in one transaction — a duplicate/concurrent
// approve call finds nothing left in 'pending'/'awaiting_review' and 409s
// before it ever reaches the enrollment upsert.
router.post('/orders/:id/approve', asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const paymentId = req.body?.paymentId;
  if (typeof paymentId !== 'string' || !isCanonicalUuid(paymentId)) {
    return res.status(400).json({ error: 'valid_payment_id_required' });
  }

  try {
    const result = await withTransaction(async (client) => {
      // All payment writers acquire the order row first to serialize with
      // uploads/cancellation and avoid opposite-order row-lock deadlocks.
      const orderRes = await client.query(
        `UPDATE orders SET status = 'approved', approved_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'awaiting_review' AND expires_at > clock_timestamp()
          RETURNING *`,
        [orderId]
      );
      if (orderRes.rows.length === 0) throw Object.assign(new Error('order_not_approvable'), { code: 'ORDER_CONFLICT' });
      const order = orderRes.rows[0];

      const payRes = await client.query(
        `UPDATE order_payments SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
          WHERE id = $2 AND order_id = $3 AND status = 'pending'
          RETURNING *`,
        [req.user.id, paymentId, orderId]
      );
      if (payRes.rows.length === 0) throw Object.assign(new Error('payment_not_pending'), { code: 'ORDER_CONFLICT' });

      await client.query(
        `INSERT INTO user_enrollments (user_id, course_id, status, source, order_id, expires_at, revoked_at)
         VALUES ($1, $2, 'active', 'purchase', $3, NULL, NULL)
         ON CONFLICT (user_id, course_id) DO UPDATE
           SET status = 'active', source = 'purchase', order_id = $3, expires_at = NULL, revoked_at = NULL`,
        [order.user_id, order.course_id, orderId]
      );

      return { order, payment: payRes.rows[0] };
    });
    res.json({
      ok: true,
      order: { id: result.order.id, status: orderEffectiveStatus(result.order) },
    });
  } catch (err) {
    if (err.code === 'ORDER_CONFLICT') return res.status(409).json({ error: err.message });
    throw err;
  }
}));

// POST /api/admin/orders/:id/reject — { paymentId, reason } — both required.
// NOT terminal for the order: the student can submit a new proof, which
// flips the order back to 'awaiting_review' (see orders.js payment-proof).
router.post('/orders/:id/reject', asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'reason_required' });
  const paymentId = req.body?.paymentId;
  if (typeof paymentId !== 'string' || !isCanonicalUuid(paymentId)) {
    return res.status(400).json({ error: 'valid_payment_id_required' });
  }

  try {
    const result = await withTransaction(async (client) => {
      const orderRes = await client.query(
        `UPDATE orders SET status = 'rejected', updated_at = NOW()
          WHERE id = $1 AND status = 'awaiting_review'
          RETURNING *`,
        [orderId]
      );
      if (orderRes.rows.length === 0) throw Object.assign(new Error('order_not_rejectable'), { code: 'ORDER_CONFLICT' });

      const payRes = await client.query(
        `UPDATE order_payments
            SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
          WHERE id = $3 AND order_id = $4 AND status = 'pending'
          RETURNING *`,
        [req.user.id, reason, paymentId, orderId]
      );
      if (payRes.rows.length === 0) throw Object.assign(new Error('payment_not_pending'), { code: 'ORDER_CONFLICT' });

      return { order: orderRes.rows[0] };
    });
    res.json({ ok: true, order: { id: result.order.id, status: orderEffectiveStatus(result.order) } });
  } catch (err) {
    if (err.code === 'ORDER_CONFLICT') return res.status(409).json({ error: err.message });
    throw err;
  }
}));

// ===== SETTINGS — bank transfer accounts (manual payment instructions) =====
// Admin-editable, no redeploy needed — same app_settings pattern as the
// AI prompt settings below. Value is a JSON-encoded array of
// { label, bankName, accountNumber, accountHolder }. Never hardcoded in
// frontend source — fetched per-order from the student-facing API.
router.get('/settings/bank-accounts', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'bank_transfer_accounts'`);
  let accounts = [];
  try { accounts = JSON.parse(r.rows[0]?.value || '[]'); } catch { accounts = []; }
  res.json({ accounts: Array.isArray(accounts) ? accounts : [] });
}));

router.put('/settings/bank-accounts', asyncHandler(async (req, res) => {
  const accounts = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
  const cleaned = accounts.map((a) => ({
    label: String(a?.label || '').trim().slice(0, 100),
    bankName: String(a?.bankName || '').trim().slice(0, 100),
    accountNumber: String(a?.accountNumber || '').trim().slice(0, 50),
    accountHolder: String(a?.accountHolder || '').trim().slice(0, 100),
  })).filter((a) => a.bankName && a.accountNumber);
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('bank_transfer_accounts', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(cleaned)]
  );
  res.json({ ok: true, accounts: cleaned });
}));

// ===== DISCUSSIONS (admin moderation) =====

router.get('/discussions', asyncHandler(async (req, res) => {
  // Search (content / user / lesson), status filter (active|deleted|all) and
  // pagination so moderation isn't limited to the most recent 200 comments.
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || 'all').toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const conds = [];
  const params = [];
  if (status === 'active') conds.push('d.is_deleted = FALSE');
  else if (status === 'deleted') conds.push('d.is_deleted = TRUE');
  if (q) {
    params.push('%' + q + '%');
    const p = `$${params.length}`;
    conds.push(`(d.content ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR l.title ILIKE ${p})`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const totalRes = await query(
    `SELECT COUNT(*)::int AS n FROM discussions d
       JOIN users u ON u.id = d.user_id JOIN lessons l ON l.id = d.lesson_id ${where}`,
    params
  );
  const listParams = params.slice();
  listParams.push(limit, offset);
  const result = await query(
    `SELECT d.id, d.lesson_id, d.parent_id, d.content, d.is_admin_reply, d.is_deleted,
            d.created_at, d.user_id, u.full_name, u.email, u.avatar_url,
            l.title AS lesson_title
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     JOIN lessons l ON l.id = d.lesson_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  res.json({ discussions: result.rows, total: totalRes.rows[0].n });
}));

// Restore a soft-deleted comment (admin moderation undo).
router.post('/discussions/:id/restore', asyncHandler(async (req, res) => {
  const r = await query(
    `UPDATE discussions SET is_deleted = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

// ===== KANJI ITEMS (Daftar Kanji di main site) =====
// Terpisah dari PWA app/kanji.html (yang punya KD[] hardcoded). Source of
// truth = tabel kanji_items. Pola mirror module_vocabulary admin endpoints.

const KANJI_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
function normalizeKanjiLevel(value) {
  const v = String(value || '').toUpperCase();
  return KANJI_LEVELS.includes(v) ? v : 'N5';
}
function validateKanjiCompounds(value, character = '') {
  if (!Array.isArray(value)) return { items: [], error: null };
  const target = String(character || '').trim();
  const items = [];
  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const item = {
      japanese: String(value[i]?.japanese || '').trim(),
      reading: String(value[i]?.reading || '').trim(),
      indonesian: String(value[i]?.indonesian || '').trim(),
    };
    if (!item.japanese && !item.reading && !item.indonesian) continue;
    if (!item.japanese || !item.reading || !item.indonesian) {
      return { items: [], error: `Kata #${i + 1}: kata, bacaan, dan arti wajib diisi lengkap` };
    }
    if (target && !item.japanese.includes(target)) {
      return { items: [], error: `Kata #${i + 1} harus mengandung kanji ${target}` };
    }
    const key = `${item.japanese.toLowerCase()}::${item.reading.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return { items, error: null };
}

// List kanji per pelajaran. Lesson scope dipake admin "Kelola Kanji"
// (mirror "Kelola Deck"). Kanji jadi jenis pelajaran (lessons.type =
// 'kanji'), bukan tab admin global.
router.get('/lessons/:lessonId/kanji', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT k.id, k.character, k.jlpt_level, k.on_reading, k.kun_reading,
            k.meaning_id, k.mnemonic, k.compounds, k.stroke_count, k.bab_kode,
            k.sort_order, l.module_id, m.sort_order AS module_sort,
            c.slug AS course_slug, c.level AS course_level
       FROM kanji_items k
       JOIN lessons l ON l.id = k.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE k.lesson_id = $1
      ORDER BY k.sort_order ASC, k.character ASC`,
    [req.params.lessonId]
  );
  if (result.rows.length === 0) return res.json({ kanji: [] });

  const context = result.rows[0];
  const [vocab, kanjiCatalog] = await Promise.all([
    loadCourseVocab(context.course_slug),
    loadKanjiCatalog(),
  ]);
  const kanji = result.rows.map((row) => ({
    id: row.id,
    character: row.character,
    jlpt_level: row.jlpt_level,
    on_reading: row.on_reading,
    kun_reading: row.kun_reading,
    meaning_id: row.meaning_id,
    mnemonic: row.mnemonic,
    compounds: row.compounds,
    usages: deriveCompounds(row.character, row.compounds, vocab, {
      moduleId: row.module_id,
      moduleSort: row.module_sort,
      courseLevel: row.course_level,
      kanjiCatalog,
    }),
    stroke_count: row.stroke_count,
    bab_kode: row.bab_kode,
    sort_order: row.sort_order,
  }));
  res.json({ kanji });
}));

router.post('/kanji', asyncHandler(async (req, res) => {
  const {
    lessonId, character, jlptLevel, onReading, kunReading, meaningId,
    mnemonic, compounds, strokeCount, babKode, sortOrder,
  } = req.body || {};
  const ch = String(character || '').trim();
  if (!ch) return res.status(400).json({ error: 'character required' });
  const level = normalizeKanjiLevel(jlptLevel);
  const hasCompounds = Object.prototype.hasOwnProperty.call(req.body || {}, 'compounds');
  const compoundValidation = validateKanjiCompounds(compounds, ch);
  if (compoundValidation.error) return res.status(400).json({ error: compoundValidation.error });
  const safeCompounds = compoundValidation.items;
  const sql = `INSERT INTO kanji_items (
       lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id,
       mnemonic, compounds, stroke_count, bab_kode, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (character, jlpt_level, lesson_id) DO UPDATE SET
       on_reading = EXCLUDED.on_reading,
       kun_reading = EXCLUDED.kun_reading,
       meaning_id = EXCLUDED.meaning_id,
       mnemonic = EXCLUDED.mnemonic,
       compounds = CASE WHEN $12::boolean THEN EXCLUDED.compounds ELSE kanji_items.compounds END,
       stroke_count = EXCLUDED.stroke_count,
       bab_kode = EXCLUDED.bab_kode,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING *`;
  const params = [
      lessonId || null,
      ch,
      level,
      (onReading && String(onReading).trim()) || null,
      (kunReading && String(kunReading).trim()) || null,
      (meaningId && String(meaningId).trim()) || null,
      (mnemonic && String(mnemonic).trim()) || null,
      JSON.stringify(safeCompounds),
      strokeCount != null && strokeCount !== '' ? Number(strokeCount) : null,
      (babKode && String(babKode).trim()) || null,
      Number(sortOrder) || 0,
      hasCompounds,
    ];
  const result = lessonId ? await adminBoundaryWrite(res, {
    prepare: (client, { locked }) => kanjiUpsertCandidate(client, {
      character: ch, jlpt_level: level,
      on_reading: params[3], kun_reading: params[4], meaning_id: params[5],
      mnemonic: params[6], compounds: safeCompounds, bab_kode: params[9],
      expectedRevision: req.body?.expectedRevision,
      boundaryFingerprint: req.body?.boundaryFingerprint }, lessonId, hasCompounds, locked),
    write: async client => (await client.query(sql, params)).rows[0],
  }) : await globalOffQuery(res, sql, params);
  if (!result) return;
  invalidateKanjiCatalogCache();
  res.status(201).json({ kanji: lessonId ? result.value : result.rows[0],
    ...(lessonId ? { validation: result.report } : {}) });
}));

router.put('/kanji/:id', asyncHandler(async (req, res) => {
  const {
    lessonId, character, jlptLevel, onReading, kunReading, meaningId,
    mnemonic, compounds, strokeCount, babKode, sortOrder,
  } = req.body || {};
  const ch = character != null ? String(character).trim() : null;
  const level = jlptLevel ? normalizeKanjiLevel(jlptLevel) : null;
  const hasLessonId = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const hasCompounds = Object.prototype.hasOwnProperty.call(req.body || {}, 'compounds');
  const compoundValidation = validateKanjiCompounds(compounds, ch);
  if (compoundValidation.error) return res.status(400).json({ error: compoundValidation.error });
  const safeCompounds = compoundValidation.items;
  const sql = `UPDATE kanji_items SET
       character = COALESCE($2, character),
       jlpt_level = COALESCE($3, jlpt_level),
       on_reading = $4,
       kun_reading = $5,
       meaning_id = $6,
       mnemonic = $7,
       stroke_count = $8,
       bab_kode = $9,
       sort_order = COALESCE($10, sort_order),
       lesson_id = CASE WHEN $12::boolean THEN $11 ELSE lesson_id END,
       compounds = CASE WHEN $14::boolean THEN $13::jsonb ELSE kanji_items.compounds END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`;
  const params = [
      req.params.id,
      ch || null,
      level,
      (onReading && String(onReading).trim()) || null,
      (kunReading && String(kunReading).trim()) || null,
      (meaningId && String(meaningId).trim()) || null,
      (mnemonic && String(mnemonic).trim()) || null,
      strokeCount != null && strokeCount !== '' ? Number(strokeCount) : null,
      (babKode && String(babKode).trim()) || null,
      sortOrder != null && sortOrder !== '' ? Number(sortOrder) : null,
      lessonId || null,
      hasLessonId,
      JSON.stringify(safeCompounds),
      hasCompounds,
    ];
  const existing = await query('SELECT lesson_id FROM kanji_items WHERE id=$1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
  const targetLessonId = hasLessonId ? (lessonId || null) : existing.rows[0].lesson_id;
  let result;
  if (!targetLessonId) {
    result = await globalOffQuery(res, sql, params,
      !hasLessonId ? { expectedGlobalKanjiId: req.params.id } : {});
    if (!result) return;
  } else {
    result = await adminBoundaryWrite(res, {
      prepare: async (client, { locked }) => {
        const old = (await client.query('SELECT * FROM kanji_items WHERE id=$1', [req.params.id])).rows[0];
        if (!old) throw new BoundaryContextError('kanji_not_found');
        const merged = { character: ch || old.character, on_reading: params[3], kun_reading: params[4],
          meaning_id: params[5], mnemonic: params[6], bab_kode: params[8],
          compounds: hasCompounds ? safeCompounds : old.compounds,
          boundaryFingerprint: req.body?.boundaryFingerprint };
        const candidate = await kanjiWriteCandidate(client, req.params.id, merged,
          hasLessonId ? (lessonId || null) : undefined, locked);
        return { ...candidate, expectedRevision: req.body?.expectedRevision };
      },
      write: async client => (await client.query(sql, params)).rows[0],
    });
    if (!result) return;
  }
  invalidateKanjiCatalogCache();
  res.json({ kanji: targetLessonId ? result.value : result.rows[0],
    ...(targetLessonId ? { validation: result.report } : {}) });
}));

router.delete('/kanji/:id', asyncHandler(async (req, res) => {
  const existing = await query('SELECT lesson_id FROM kanji_items WHERE id=$1', [req.params.id]);
  const lessonId = existing.rows[0]?.lesson_id;
  const guarded = lessonId
    ? await adminLockedMutation(res, async client => (await client.query(
      `SELECT m.course_id FROM kanji_items k JOIN lessons l ON l.id=k.lesson_id
        JOIN modules m ON m.id=l.module_id WHERE k.id=$1`, [req.params.id])).rows.map(row => row.course_id),
      client => client.query('DELETE FROM kanji_items WHERE id=$1', [req.params.id]))
    : await globalOffQuery(res, 'DELETE FROM kanji_items WHERE id=$1', [req.params.id],
      { expectedGlobalKanjiId: req.params.id });
  if (!guarded) return;
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// Pindahkan kanji ke pelajaran lain TANPA menyentuh field lain. Dipakai oleh
// board drag "Atur Kartu". PUT /kanji/:id meng-null-kan on/kun/meaning/mnemonic/
// stroke/bab_kode saat tidak dikirim, jadi tidak aman untuk move parsial.
router.post('/kanji/:id/move', asyncHandler(async (req, res) => {
  const { targetLessonId, sortOrder } = req.body || {};
  if (!targetLessonId) return res.status(400).json({ error: 'targetLessonId required' });
  const guarded = await adminBoundaryWrite(res, {
    prepare: async (client, { locked }) => {
      const old = (await client.query(`SELECT * FROM kanji_items WHERE id=$1
        ${locked ? 'FOR UPDATE' : ''}`, [req.params.id])).rows[0];
      if (!old) throw new BoundaryContextError('kanji_not_found');
      return kanjiWriteCandidate(client, req.params.id, {
        character: old.character, on_reading: old.on_reading, kun_reading: old.kun_reading,
        meaning_id: old.meaning_id, mnemonic: old.mnemonic, compounds: old.compounds,
        bab_kode: old.bab_kode, boundaryFingerprint: req.body?.boundaryFingerprint,
      }, targetLessonId, locked);
    },
    write: async client => (await client.query(
    `UPDATE kanji_items
        SET lesson_id = $1,
            sort_order = COALESCE($2, sort_order),
            updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
    [targetLessonId, sortOrder ?? null, req.params.id]
    )).rows[0],
  });
  if (!guarded) return;
  invalidateKanjiCatalogCache();
  res.json({ kanji: guarded.value, validation: guarded.report });
}));

// Bulk-import kanji dari Notion DB "📖 Kanji" ke satu pelajaran. Mirror
// pola import-notion-deck: filter by relation Bab page, upsert by
// (character, jlpt_level), set lesson_id ke pelajaran target.
//
// Robust matching:
// - babPageId opsional: kalau kosong / "all", import semua row di DB.
// - Coba beberapa relation prop name (Lesson/Pelajaran/Bab/Chapter).
//   Kalau semua gagal di-filter, fallback ke unfiltered + warn.
// - Kalau total=0 (ga ada character yg match property), return diagnostic
//   berisi property names yg ada di sample page biar admin bisa sesuain
//   nama propertinya di Notion.
router.post('/lessons/:lessonId/import-notion-kanji-bab', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const { babPageId, jlptLevel } = req.body || {};
  const dbId = notionIdFromInput((req.body || {}).notionKanjiDbId) || notionIdFromInput(process.env.NOTION_KANJI_DB_ID);
  if (!dbId) return res.status(400).json({ error: 'notion_db_required', detail: 'Set NOTION_KANJI_DB_ID atau paste URL DB di field' });
  const level = normalizeKanjiLevel(jlptLevel);
  const lessonId = req.params.lessonId;

  const lessonRow = await query(`SELECT id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  if (lessonRow.rows[0].type !== 'kanji') {
    return res.status(400).json({ error: 'lesson_not_kanji', detail: 'Pelajaran ini bukan tipe kanji' });
  }

  // Strategi filter berlapis:
  // 1. Coba pakai relation prop (Lesson/Pelajaran/Bab/Chapter/First Lesson)
  //    kalau babPageId valid. Lots of Notion DB nyebut beda-beda.
  // 2. Kalau gagal / babPageId='all', fallback ke filter by JLPT Level
  //    (kalau DB punya select property "JLPT Level") — supaya admin pilih
  //    level N5 ga dapet 2000+ kanji semua level.
  // 3. Kalau semuanya gagal, ambil unfiltered (warn user).
  const wantFilter = !!babPageId && babPageId !== 'all';
  const RELATION_CANDIDATES = [
    'Lesson', 'Pelajaran', 'Bab', 'Chapter', 'First Lesson',
    NOTION_VOCAB_LESSON_RELATION,
  ];
  const LEVEL_PROP_CANDIDATES = ['JLPT Level', 'JLPT', 'Level', 'Tingkat'];
  let pages = null;
  let matchedRelationProp = null;
  let matchedLevelProp = null;
  let usedFallbackUnfiltered = false;
  let notionError = null;

  if (wantFilter) {
    for (const propName of RELATION_CANDIDATES) {
      try {
        const r = await notionQueryAll(dbId, token, {
          filter: { property: propName, relation: { contains: babPageId } },
        });
        if (r.length > 0) { pages = r; matchedRelationProp = propName; break; }
      } catch (err) {
        notionError = err;
      }
    }
  }

  // Filter by JLPT Level select sebagai langkah kedua / fallback utama.
  if (!pages) {
    for (const propName of LEVEL_PROP_CANDIDATES) {
      try {
        const r = await notionQueryAll(dbId, token, {
          filter: { property: propName, select: { equals: level } },
        });
        if (r.length > 0) { pages = r; matchedLevelProp = propName; break; }
      } catch (err) {
        notionError = err;
      }
    }
  }

  // Fallback terakhir: ambil semua row dari DB (unfiltered).
  if (!pages) {
    try {
      pages = await notionQueryAll(dbId, token);
      usedFallbackUnfiltered = true;
    } catch (err) {
      return notionErrorResponse(res, err, 'Cek integration share ke DB Kanji di Notion.');
    }
  }

  const staged = [];
  // Aliases super-banyak supaya tahan beda-beda schema. Misal:
  // - On'yomi 音読み / On 音読み / On / 音読み / Onyomi / On Reading / On'yomi
  // - Meaning (ID) / Indonesian / Arti / Meaning / Bahasa Indonesia / Indo
  // Fallback meaning_id ke Meaning (EN) kalau ID kosong.
  for (const page of pages) {
    const props = page.properties || {};
    const character = notionPlainText(pickProp(props, ['Kanji 漢字', 'Kanji', '漢字', 'Character', 'Karakter', 'Name', 'Title'])).trim();
    if (!character) continue;
    const onReading = notionPlainText(pickProp(props, [
      "On'yomi 音読み", "On'yomi", 'On 音読み', 'On', '音読み', 'Onyomi', 'On Reading',
    ])).trim() || null;
    const kunReading = notionPlainText(pickProp(props, [
      "Kun'yomi 訓読み", "Kun'yomi", 'Kun 訓読み', 'Kun', '訓読み', 'Kunyomi', 'Kun Reading',
    ])).trim() || null;
    const meaningIdRaw = notionPlainText(pickProp(props, [
      'Meaning (ID)', 'Indonesian', 'Arti', 'Bahasa Indonesia', 'Indo',
    ])).trim();
    const meaningEn = notionPlainText(pickProp(props, ['Meaning (EN)', 'Meaning', 'English'])).trim();
    const meaningId = meaningIdRaw || meaningEn || null;
    const mnemonic = notionPlainText(pickProp(props, [
      'Mnemonic', 'Mnemonik', 'Cara Ingat', 'Trik', 'Note', 'Catatan',
    ])).trim() || null;
    const strokeCount = notionNumber(pickProp(props, ['Stroke Count', 'Goresan', 'Strokes', 'Stroke']));
    const babKode = notionPlainText(pickProp(props, ['Kode Bab', 'Kode', 'Code'])).trim() || null;

    // Scoped by lesson_id (bukan cuma character+level) — kanji yang sama
    // dipakai di Bab lain harus dapat baris sendiri, bukan "dicuri" via
    // UPDATE lesson_id (root cause deck kanji Bab lain jadi kosong,
    // didiagnosis di migration 049/050). Unique index sudah disesuaikan
    // di migration 064.
    staged.push({ character, onReading, kunReading, meaningId, mnemonic, strokeCount, babKode });
  }
  const total = staged.length;
  let imported = 0, updated = 0, validation = null;
  if (total) {
    const outcome = await adminBoundaryWrite(res, {
      prepare: async (client, { locked }) => {
        const current = await client.query(`SELECT id,type FROM lessons WHERE id=$1 ${locked ? 'FOR UPDATE' : ''}`, [lessonId]);
        if (!current.rows.length) throw new BoundaryContextError('lesson_not_found');
        if (current.rows[0].type !== 'kanji') throw new BoundaryContextError('boundary_context_mismatch');
        return { scope: { lessonId }, contentType: 'kanji_compound_assessed', operation: 'live_write',
          fields: staged.flatMap((item, index) => Object.entries(item)
            .filter(([, value]) => typeof value === 'string')
            .map(([key, value]) => boundaryField(`items[${index}].${key}`, value))),
          expectedBoundaryFingerprint: req.body?.boundaryFingerprint };
      },
      write: async client => {
        const start = await client.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM kanji_items WHERE lesson_id=$1', [lessonId]);
        let sort = Number(start.rows[0]?.next) || 0, added = 0, changed = 0;
        for (const item of staged) {
          const existing = await client.query(`SELECT id FROM kanji_items
            WHERE character=$1 AND jlpt_level=$2 AND lesson_id=$3 LIMIT 1`,
          [item.character, level, lessonId]);
          if (existing.rows.length) {
            await client.query(`UPDATE kanji_items SET on_reading=$2,kun_reading=$3,meaning_id=$4,
              mnemonic=$5,stroke_count=$6,bab_kode=COALESCE($7,bab_kode),updated_at=NOW() WHERE id=$1`,
            [existing.rows[0].id, item.onReading, item.kunReading, item.meaningId,
              item.mnemonic, item.strokeCount, item.babKode]);
            changed++;
          } else {
            await client.query(`INSERT INTO kanji_items(lesson_id,character,jlpt_level,on_reading,kun_reading,
              meaning_id,mnemonic,stroke_count,bab_kode,sort_order)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [lessonId, item.character, level, item.onReading, item.kunReading, item.meaningId,
              item.mnemonic, item.strokeCount, item.babKode, sort++]);
            added++;
          }
        }
        return { imported: added, updated: changed };
      },
    });
    if (!outcome) return;
    ({ imported, updated } = outcome.value);
    validation = outcome.report;
  }

  // Diagnostic: kalau ga ada satu pun character ke-extract, kasih tahu
  // properti apa yg sebenarnya ada di Notion biar admin bisa sesuain.
  const diagnostic = {};
  if (total === 0 && pages.length > 0) {
    const sampleProps = pages[0].properties || {};
    diagnostic.notionPropertyNames = Object.keys(sampleProps);
    diagnostic.expectedCharacterProperty = ['Kanji 漢字', 'Kanji', '漢字', 'Character', 'Karakter'];
    diagnostic.hint = 'Pages ditemukan tapi nama properti karakter di Notion ga match. Rename salah satu properti DB Notion-mu jadi "Kanji" atau "漢字".';
  } else if (pages.length === 0) {
    diagnostic.hint = 'DB Notion-mu kosong atau integration belum di-share ke DB tersebut (notion.so → Share → Add connection → pilih integration).';
  }

  invalidateKanjiCatalogCache();
  res.json({
    imported,
    updated,
    total,
    notionPagesScanned: pages.length,
    matchedRelationProp,
    matchedLevelProp,
    usedFallbackUnfiltered,
    validation,
    ...(Object.keys(diagnostic).length ? { diagnostic } : {}),
  });
}));

// ===== TTS ADMIN: test audio + cache management =====
//
// Endpoint admin-only buat dev workflow: preview audio sebelum save,
// hapus cache kalau hasil ga cocok, stats cache.
// Skip whitelist check (admin bisa test text apapun, bukan cuma yang
// udah saved di DB).

// POST /api/admin/tts/preview — body { text }, return MP3 stream.
router.post('/tts/preview', asyncHandler(async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 2000) return res.status(400).json({ error: 'text too long (max 2000 char)' });

  let scene;
  try {
    scene = normalizeDialogScene(req.body.dialogScene);
    if (scene) {
      const turns = parseDialog(text);
      if (!turns) throw new Error('Skrip audio harus memakai label pemeran.');
      sceneTurnVoices(turns, scene, () => ({ voiceId: null, role: 'narrator' }));
    }
  } catch (err) { return res.status(400).json({error: err.message}); }
  // Preview and student playback share voices, pauses, validation and cache.
  return renderTtsAudio(text, res, { privateResponse: true, dialogScene: scene });
}));

// POST /api/admin/tts/dialog-turn — body { dialog, turnIndex, speaker,
// turnText, dialogScene?, dialogFurigana?, regenerate? } → MP3 of ONE turn.
// The 🎭 Dialog editor's "🔊 Tes giliran ini" and "↻ Buat ulang": plays (or
// re-voices) the turn's take from the same per-turn cache students read
// (resolveDialogTurns in tts.js), so the take heard here IS the take students
// hear once this dialogue is saved. The whole dialogue comes along so the
// voice resolves exactly as it will for students and an older whole-dialogue
// take can be adopted instead of generating a new one. speaker+turnText must
// equal that turn: an editor row whose text holds a labelled line break
// would otherwise shift every index after it.
router.post('/tts/dialog-turn', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const dialog = String(body.dialog || '').trim();
  if (!dialog) return res.status(400).json({ error: 'dialog required' });
  if (dialog.length > 1500) {
    return res.status(400).json({ error: 'dialog_too_long', detail: 'Dialog maksimal 1500 karakter — lebih panjang dari itu siswa tidak bisa memutarnya.' });
  }
  const turns = parseDialog(dialog);
  if (!turns) return res.status(400).json({ error: 'not_a_dialog', detail: 'Setiap baris harus diawali label pemeran.' });
  const index = Number(body.turnIndex);
  if (!Number.isInteger(index) || index < 0 || index >= turns.length) return res.status(400).json({ error: 'invalid_turn_index' });
  const own = parseDialog(`${String(body.speaker || '')}: ${String(body.turnText || '').trim()}`);
  if (!own || own.length !== 1 || own[0].speaker !== turns[index].speaker || own[0].text !== turns[index].text) {
    return res.status(409).json({ error: 'turn_mismatch', detail: 'Teks giliran ini memuat baris baru berlabel pemeran — jadikan giliran sendiri, lalu tes lagi.' });
  }
  let scene;
  try { scene = normalizeDialogScene(body.dialogScene); } catch (err) { return res.status(400).json({ error: err.message }); }
  const registry = await loadSpeakerRegistry();
  let turnVoices;
  try { turnVoices = sceneTurnVoices(turns, scene, (t, i) => voiceForSpeaker(t.speaker, i, registry)); }
  catch (err) { return res.status(422).json({ error: 'dialog_voice_missing', detail: err.message }); }
  let audio;
  try {
    [audio] = await resolveDialogTurns({
      turns, turnVoices, dialogText: dialog, indices: [index], scene, regenerate: body.regenerate === true,
      // The editor's current furigana: kanji are voiced by their reading,
      // exactly as students hear them once the dialogue is saved.
      furigana: body.dialogFurigana || null,
    });
  } catch (err) {
    if (err.code === 'tts_disabled') {
      return res.status(503).json({ error: 'tts_disabled', detail: 'ElevenLabs belum aktif atau suara pemeran belum diatur.' });
    }
    console.error('TTS dialog turn upstream:', err.message);
    return res.status(502).json({ error: 'tts_upstream', detail: err.message });
  }
  res.set('Content-Type', 'audio/mpeg');
  res.set('Cache-Control', 'private, no-store');
  res.send(audio);
}));

// ── ElevenLabs voice catalog (admin-only) ───────────────────────────────────
// Backs the dialogue editor's speaker picker: lists the account's REAL
// ElevenLabs voices (name + voice_id) so an admin assigns a genuine voice
// per character instead of typing a name and picking female/male. Read-only,
// no DB involved — always a live call, so a voice added/renamed/removed in
// the ElevenLabs dashboard shows up immediately.
router.get('/elevenlabs/voices', asyncHandler(async (req, res) => {
  if (!elevenLabsEnabled()) {
    return res.status(503).json({ error: 'elevenlabs_disabled', detail: 'ELEVENLABS_API_KEY belum diset.' });
  }
  try {
    const voices = await fetchElevenVoices();
    res.json({ voices });
  } catch (err) {
    console.error('ElevenLabs voices:', err.message);
    res.status(502).json({ error: 'elevenlabs_upstream', detail: err.message });
  }
}));

// ── Dialogue speaker registry (migration 148) ──────────────────────────────
// A named speaker ("アンナ", "ハディ", ...) an admin can pick in the grammar
// dialogue editor instead of the bare TTS routing code (A/B), voiced by a
// REAL ElevenLabs voice_id (picked from the catalog above) rather than a
// female/male bucket. Deliberately just a name→voice_id lookup — see the
// migration for why this isn't a repeat of the reverted "Bacaan & audio"
// pipeline.
router.get('/dialogue-speakers', asyncHandler(async (req, res) => {
  const r = await query('SELECT id, name, voice_id, voice_name, character_key, default_display_name, profile_version FROM dialogue_speakers ORDER BY name ASC');
  res.json({ speakers: r.rows });
}));

router.post('/dialogue-speakers', asyncHandler(async (req, res) => {
  const name = String((req.body || {}).name || '').trim().slice(0, 30);
  const voiceId = String((req.body || {}).voiceId || '').trim().slice(0, 100);
  const voiceName = String((req.body || {}).voiceName || '').trim().slice(0, 100);
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!voiceId || !voiceName) return res.status(400).json({ error: 'voiceId and voiceName required (pick a real ElevenLabs voice)' });
  try {
    const r = await query(
      `INSERT INTO dialogue_speakers (name, voice_id, voice_name) VALUES ($1, $2, $3) RETURNING id, name, voice_id, voice_name`,
      [name, voiceId, voiceName]
    );
    res.status(201).json({ speaker: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'name_taken' });
    throw err;
  }
}));

router.put('/dialogue-speakers/:id', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const current = await query('SELECT * FROM dialogue_speakers WHERE id = $1', [req.params.id]);
  const profile = current.rows[0];
  if (!profile) return res.status(404).json({ error: 'not_found' });
  if (profile.character_key) {
    const character = dialogueCatalog.characters.find(c => c.key === profile.character_key);
    const displayName = String(req.body?.displayName || '').trim();
    const voiceId = String(req.body?.voiceId || '').trim();
    if (!character || !displayName || displayName.length > 40) return res.status(400).json({error: 'Nama tampilan tidak valid.'});
    let voice = null;
    if (voiceId) {
      try { voice = (await fetchElevenVoices()).find(v => v.voiceId === voiceId); }
      catch { return res.status(502).json({error: 'Katalog suara tidak tersedia.'}); }
      if (!voice) return res.status(400).json({error: 'Pilih suara dari katalog ElevenLabs.'});
    }
    const saved = await query(`UPDATE dialogue_speakers SET default_display_name = $2,
      voice_id = $3, voice_name = $4, profile_version = profile_version + 1
      WHERE id = $1 RETURNING *`, [req.params.id, displayName, voiceId, voice?.name || '']);
    return res.json({speaker: saved.rows[0]});
  }
  const name = String((req.body || {}).name || '').trim().slice(0, 30);
  const voiceId = String((req.body || {}).voiceId || '').trim().slice(0, 100);
  const voiceName = String((req.body || {}).voiceName || '').trim().slice(0, 100);
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!voiceId || !voiceName) return res.status(400).json({ error: 'voiceId and voiceName required (pick a real ElevenLabs voice)' });
  try {
    const r = await query(
      `UPDATE dialogue_speakers SET name = $2, voice_id = $3, voice_name = $4 WHERE id = $1 RETURNING id, name, voice_id, voice_name`,
      [req.params.id, name, voiceId, voiceName]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ speaker: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'name_taken' });
    throw err;
  }
}));

router.delete('/dialogue-speakers/:id', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const profile = await query('SELECT character_key FROM dialogue_speakers WHERE id = $1', [req.params.id]);
  if (profile.rows[0]?.character_key) return res.status(409).json({error: 'Karakter resmi tidak dapat dihapus.'});
  // No FK from anywhere to this table (see migration 148) — a dialogue
  // referencing this name by its plain-text prefix keeps working after
  // delete, it just falls back to the pattern/alternation guess in
  // voiceForSpeaker() like an unknown name always has.
  await query('DELETE FROM dialogue_speakers WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Character art (migration 177) ──────────────────────────────────────────
// PUT uploads or replaces one image of a character: 'base' replaces the bundled
// picture, any other key is an expression. mode=create refuses to overwrite an
// existing expression (the admin typed a name that is already taken); a PUT
// without a file only renames. The public manifest (/api/dialogue-art) is the
// list; there is no separate admin GET.
const artUpload = multer({ storage: multer.memoryStorage(), limits: uploadLimits(2 * 1024 * 1024, 2) });
const parseArtUpload = (req, res, next) => artUpload.single('file')(req, res,
  err => (err ? uploadErrorHandler(err, req, res, next) : next()));

router.put('/dialogue-art/:characterKey/:expressionKey', parseArtUpload, asyncHandler(async (req, res) => {
  const { characterKey, expressionKey } = req.params;
  if (!isCharacterKey(characterKey)) return res.status(404).json({ error: 'Karakter tidak dikenal.' });
  if (!isExpressionKey(expressionKey)) return res.status(400).json({ error: 'Nama ekspresi harus memakai huruf latin atau angka.' });
  const isBase = expressionKey === BASE_EXPRESSION;
  const label = isBase ? 'Dasar' : String(req.body?.label || '').trim();
  if (!label || label.length > 40) return res.status(400).json({ error: 'Isi nama ekspresi (maksimal 40 huruf).' });
  const create = req.body?.mode === 'create';
  if (!req.file) {
    if (isBase || create) return res.status(400).json({ error: 'Pilih berkas gambar.' });
    const renamed = await query(`UPDATE dialogue_character_art SET label = $3, updated_at = NOW()
      WHERE character_key = $1 AND expression_key = $2 RETURNING expression_key`, [characterKey, expressionKey, label]);
    if (!renamed.rows.length) return res.status(404).json({ error: 'Ekspresi tidak ditemukan.' });
    return res.json({ ok: true });
  }
  const art = inspectArt(req.file.buffer);
  if (art.error) return res.status(400).json({ error: art.error });
  const saved = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['dialogue-art:' + characterKey]);
    const existing = await client.query(`SELECT expression_key FROM dialogue_character_art WHERE character_key = $1`, [characterKey]);
    const exists = existing.rows.some(r => r.expression_key === expressionKey);
    if (exists && create) return { status: 409, body: { error: 'Nama ekspresi sudah dipakai karakter ini.' } };
    const expressions = existing.rows.filter(r => r.expression_key !== BASE_EXPRESSION).length;
    if (!exists && !isBase && expressions >= MAX_EXPRESSIONS_PER_CHARACTER) {
      return { status: 400, body: { error: `Maksimal ${MAX_EXPRESSIONS_PER_CHARACTER} ekspresi per karakter.` } };
    }
    const row = (await client.query(`INSERT INTO dialogue_character_art
        (character_key, expression_key, label, image, mime, width, height)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (character_key, expression_key) DO UPDATE SET label = EXCLUDED.label,
        image = EXCLUDED.image, mime = EXCLUDED.mime, width = EXCLUDED.width, height = EXCLUDED.height,
        version = dialogue_character_art.version + 1, updated_at = NOW()
      RETURNING expression_key, label, width, height, version`,
      [characterKey, expressionKey, label, req.file.buffer, art.mime, art.width, art.height])).rows[0];
    return { status: exists ? 200 : 201, body: { art: row } };
  });
  res.status(saved.status).json(saved.body);
}));

router.delete('/dialogue-art/:characterKey/:expressionKey', asyncHandler(async (req, res) => {
  const { characterKey, expressionKey } = req.params;
  if (!isCharacterKey(characterKey) || !isExpressionKey(expressionKey)) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });
  // Turns that picked this expression keep their saved key and simply show the
  // base picture; uploading the same name again brings the expression back.
  const r = await query(`DELETE FROM dialogue_character_art WHERE character_key = $1 AND expression_key = $2`,
    [characterKey, expressionKey]);
  if (!r.rowCount) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });
  res.json({ ok: true });
}));

// DELETE /api/admin/tts/cache — body { text } → cari cache entry yang
// match text hash (semua variasi voice), hapus. Berguna kalau admin
// tweak voice settings lalu mau force regen tertentu.
router.delete('/tts/cache', asyncHandler(async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  // Hapus by exact text match — coverage semua voice/model variasi.
  const r = await query(`DELETE FROM tts_cache WHERE text = $1`, [text]);
  res.json({ ok: true, deleted: r.rowCount });
}));

// GET /api/admin/tts/cache/stats — count + total size + breakdown
// current version vs orphan (version mismatch / NULL).
router.get('/tts/cache/stats', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(byte_size), 0)::bigint AS bytes,
            MAX(created_at) AS newest,
            MIN(created_at) AS oldest,
            COUNT(*) FILTER (WHERE settings_version = $1)::int AS current_count,
            COALESCE(SUM(byte_size) FILTER (WHERE settings_version = $1), 0)::bigint AS current_bytes,
            COUNT(*) FILTER (WHERE settings_version IS DISTINCT FROM $1)::int AS orphan_count,
            COALESCE(SUM(byte_size) FILTER (WHERE settings_version IS DISTINCT FROM $1), 0)::bigint AS orphan_bytes
       FROM tts_cache`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ...r.rows[0], current_version: TTS_SETTINGS_VERSION });
}));

// DELETE /api/admin/tts/cache/all — nuke all cache. Cost regenerate.
router.delete('/tts/cache/all', asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM tts_cache`);
  res.json({ ok: true, deleted: r.rowCount });
}));

// GET /api/admin/tts/cache/orphans — preview: count + bytes orphan
// (entries dgn settings_version != current atau NULL). Run sebelum
// DELETE supaya admin tau dampak.
router.get('/tts/cache/orphans', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(byte_size), 0)::bigint AS bytes
       FROM tts_cache
      WHERE settings_version IS DISTINCT FROM $1`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ...r.rows[0], current_version: TTS_SETTINGS_VERSION });
}));

// DELETE /api/admin/tts/cache/orphans — execute cleanup. Current version
// dibaca dari server const (bukan req body) → race-safe terhadap admin
// session lama yg hold version expired.
router.delete('/tts/cache/orphans', asyncHandler(async (req, res) => {
  const r = await query(
    `DELETE FROM tts_cache
      WHERE settings_version IS DISTINCT FROM $1`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ok: true, deleted: r.rowCount, current_version: TTS_SETTINGS_VERSION });
}));

// ===== TTS TAG LIBRARY (shared antar admin device) =====
// Tag custom yang admin save buat dipake ulang via picker chip. Source
// of truth di DB (tts_tag_library), localStorage cuma cache + offline.

router.get('/tts/tags', asyncHandler(async (req, res) => {
  const r = await query(`SELECT tag FROM tts_tag_library ORDER BY created_at DESC`);
  res.json({ tags: r.rows.map((x) => x.tag) });
}));

router.post('/tts/tags', asyncHandler(async (req, res) => {
  const raw = String((req.body || {}).tag || '').trim().toLowerCase();
  // Normalize: huruf + angka + underscore, dimulai dengan huruf, max 24 char.
  const tag = raw.replace(/[^a-z0-9_]/g, '');
  if (!tag || !/^[a-z]/.test(tag) || tag.length > 24) {
    return res.status(400).json({ error: 'invalid_tag', detail: 'Tag harus mulai dgn huruf, hanya huruf/angka/underscore, max 24 char.' });
  }
  await query(
    `INSERT INTO tts_tag_library (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING`,
    [tag]
  );
  res.status(201).json({ ok: true, tag });
}));

router.delete('/tts/tags/:tag', asyncHandler(async (req, res) => {
  const tag = String(req.params.tag || '').toLowerCase();
  await query(`DELETE FROM tts_tag_library WHERE tag = $1`, [tag]);
  res.json({ ok: true });
}));

// ── Live Class management ────────────────────────────────────────────────
async function liveClassPayload(body) {
  const courseId = String(body?.courseId || '').trim();
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim().slice(0, 4000) || null;
  const status = String(body?.status || 'scheduled');
  const lessonIds = [...new Set(Array.isArray(body?.lessonIds) ? body.lessonIds.map(String).filter(Boolean) : [])];
  const validation = validateLiveClassFields({ courseId, title, startsAt: body?.startsAt, endsAt: body?.endsAt, meetingUrl: body?.meetingUrl, recordingUrl: body?.recordingUrl, status });
  if (!validation.ok) return { error: validation.error };
  if (!lessonIds.every(isCanonicalUuid)) return { error: 'invalid_lessonIds' };
  const course = await query(`SELECT id FROM courses WHERE id = $1 LIMIT 1`, [courseId]);
  if (!course.rows.length) return { error: 'course_not_found' };
  if (lessonIds.length) {
    const lessons = await query(`SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ANY($1::uuid[]) AND m.course_id = $2`, [lessonIds, courseId]);
    if (lessons.rows.length !== lessonIds.length) return { error: 'related_lessons_must_belong_to_course' };
  }
  return { courseId, title, description, startsAt: validation.startsAt, endsAt: validation.endsAt, meetingUrl: validation.meetingUrl, recordingUrl: validation.recordingUrl, status, lessonIds };
}

async function adminLiveClassRows(courseId = null) {
  const rows = await query(
    `SELECT lc.*, c.title AS course_title, l.id AS lesson_id, l.title AS lesson_title, l.slug AS lesson_slug,
            m.title AS module_title, m.slug AS module_slug, m.section_name, lcl.sort_order AS lesson_sort
       FROM live_classes lc JOIN courses c ON c.id = lc.course_id
       LEFT JOIN live_class_lessons lcl ON lcl.live_class_id = lc.id
       LEFT JOIN lessons l ON l.id = lcl.lesson_id LEFT JOIN modules m ON m.id = l.module_id
      WHERE ($1::uuid IS NULL OR lc.course_id = $1)
      ORDER BY lc.starts_at DESC, lcl.sort_order`, [courseId]
  );
  const out = new Map();
  for (const row of rows.rows) {
    if (!out.has(row.id)) out.set(row.id, { id: row.id, courseId: row.course_id, courseTitle: row.course_title, title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at, meetingUrl: row.meeting_url, recordingUrl: row.recording_url, status: row.status, relatedLessons: [] });
    if (row.lesson_id) out.get(row.id).relatedLessons.push({ id: row.lesson_id, title: row.lesson_title, slug: row.lesson_slug, chapter: { title: row.module_title, slug: row.module_slug }, section: row.section_name || null });
  }
  return [...out.values()];
}

router.get('/live-classes', asyncHandler(async (req, res) => {
  const courseId = req.query.courseId ? String(req.query.courseId) : null;
  if (courseId && !isCanonicalUuid(courseId)) return res.status(400).json({ error: 'invalid_courseId' });
  res.json({ liveClasses: await adminLiveClassRows(courseId) });
}));

router.get('/live-classes/lessons', asyncHandler(async (req, res) => {
  const courseId = String(req.query.courseId || '').trim();
  if (!courseId) return res.status(400).json({ error: 'courseId_required' });
  if (!isCanonicalUuid(courseId)) return res.status(400).json({ error: 'invalid_courseId' });
  const lessons = await query(
    `SELECT l.id, l.slug, l.title, m.id AS module_id, m.slug AS module_slug,
            m.title AS module_title, m.section_name
       FROM lessons l JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = $1 ORDER BY m.sort_order, l.sort_order, l.created_at`, [courseId]
  );
  res.json({ lessons: lessons.rows.map((row) => ({ id: row.id, slug: row.slug, title: row.title, module: { id: row.module_id, slug: row.module_slug, title: row.module_title, section: row.section_name || null } })) });
}));

router.post('/live-classes', asyncHandler(async (req, res) => {
  const value = await liveClassPayload(req.body); if (value.error) return res.status(400).json({ error: value.error });
  const liveClass = await withTransaction(async (client) => {
    const created = await client.query(`INSERT INTO live_classes (course_id, title, description, starts_at, ends_at, meeting_url, recording_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [value.courseId, value.title, value.description, value.startsAt, value.endsAt, value.meetingUrl, value.recordingUrl, value.status]);
    for (const [sortOrder, lessonId] of value.lessonIds.entries()) await client.query(`INSERT INTO live_class_lessons (live_class_id, lesson_id, sort_order) VALUES ($1,$2,$3)`, [created.rows[0].id, lessonId, sortOrder]);
    return created.rows[0];
  });
  res.status(201).json({ liveClass: (await adminLiveClassRows()).find((row) => row.id === liveClass.id) });
}));

router.put('/live-classes/:id', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid_live_class_id' });
  const value = await liveClassPayload(req.body); if (value.error) return res.status(400).json({ error: value.error });
  const updated = await withTransaction(async (client) => {
    const row = await client.query(`UPDATE live_classes SET course_id=$2,title=$3,description=$4,starts_at=$5,ends_at=$6,meeting_url=$7,recording_url=$8,status=$9 WHERE id=$1 RETURNING id`, [req.params.id, value.courseId, value.title, value.description, value.startsAt, value.endsAt, value.meetingUrl, value.recordingUrl, value.status]);
    if (!row.rows.length) return null;
    await client.query(`DELETE FROM live_class_lessons WHERE live_class_id = $1`, [req.params.id]);
    for (const [sortOrder, lessonId] of value.lessonIds.entries()) await client.query(`INSERT INTO live_class_lessons (live_class_id, lesson_id, sort_order) VALUES ($1,$2,$3)`, [req.params.id, lessonId, sortOrder]);
    return row.rows[0];
  });
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json({ liveClass: (await adminLiveClassRows()).find((row) => row.id === updated.id) });
}));

router.delete('/live-classes/:id', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid_live_class_id' });
  const removed = await query(`DELETE FROM live_classes WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!removed.rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}));

export default router;
