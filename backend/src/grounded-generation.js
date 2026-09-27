import { getCurriculumBoundary } from './curriculum-boundary.js';
import { buildGroundedContext, dialogueSourceFingerprint, GroundedContextError } from './curriculum-boundary-context.js';
import { validateContentAgainstBoundary, validateQuestionShape } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';

const QUESTION_TYPES = new Set(['dialogue_comprehension', 'dialogue_transfer', 'dialogue_question',
  'quiz_question', 'listening_question', 'reading_question', 'quiz', 'assessment']);
const GRAMMAR_CONTENT_TYPES = new Set(['grammar_dialog', 'grammar_example']);
const demonstratesTargetGrammar = (contentType, field) => contentType === 'grammar_example'
  ? /^(?:japanese|examples\[\d+\]\.japanese)$/u.test(field || '')
  : /^(?:dialogue|exampleDialog|dialogScene\.turns\[\d+\]\.text)(?:$|\.)/u.test(field || '');
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Unified_Ideograph}]/u;
const SCHEMA_KEYS = {
  vocabulary_example: ['japanese', 'reading', 'highlight', 'indonesian', 'examples'],
  grammar_example: ['japanese', 'highlight', 'indonesian', 'examples'],
  grammar_dialog: ['dialogue', 'exampleDialog', 'exampleDialogId', 'dialogScene', 'dialogFurigana', 'communicationGoal'],
  dialogue_translation: ['dialog_id'],
  dialogue_comprehension: ['question', 'questions', 'evidence'],
  dialogue_transfer: ['question', 'questions'],
  dialogue_question: ['question', 'questions', 'evidence'],
  quiz_question: ['question', 'questions'],
  listening_question: ['question', 'questions'],
  reading_question: ['question', 'questions'],
  quiz: ['question', 'questions'],
  assessment: ['question', 'questions'],
  grammar_distractors: ['recognitionDistractors', 'controlledDistractors', 'distractors'],
  distractors: ['distractors', 'options'],
  quiz_options: ['options'],
  listening: ['text', 'passage', 'dialogue'],
  reading: ['text', 'passage'],
  shared_passage: ['text', 'passage'],
  kanji_compound_assessed: ['japanese', 'compound'],
  kanji_compound_exploration: ['japanese', 'compound'],
};
const errorReport = (status, code, fingerprint = null) => ({ status,
  valid: status === 'schema_invalid' ? false : null, boundaryFingerprint: fingerprint,
  violations: status === 'schema_invalid' ? [{ code }] : [],
  warnings: status === 'schema_invalid' ? [] : [{ code }],
  usage: {}, integrityIssues: [], exceptions: [] });
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

export function parseGroundedCandidate(raw) {
  if (plain(raw)) return raw;
  if (typeof raw !== 'string') throw new Error('model_output_invalid_json');
  let candidate;
  try { candidate = JSON.parse(raw); } catch { throw new Error('model_output_invalid_json'); }
  if (!plain(candidate)) throw new Error('model_output_invalid_json');
  return candidate;
}

const textField = (path, value) => typeof value === 'string' ? [{ path, text: value }] : [];
const stringArrayFields = (path, values) => Array.isArray(values)
  ? values.flatMap((value, index) => textField(`${path}[${index}]`, value)) : [];
const questionFields = (question, path) => !plain(question) ? [] : [
  ...textField(`${path}.prompt`, question.prompt),
  ...stringArrayFields(`${path}.options`, question.options),
  ...textField(`${path}.explanation`, question.explanation),
  ...(Array.isArray(question.evidence) ? question.evidence.flatMap((entry, index) =>
    textField(`${path}.evidence[${index}].quote`, entry?.quote)) : []),
];
const dialogueFields = (value, path) => {
  if (typeof value === 'string') return textField(path, value);
  const turns = Array.isArray(value) ? value : value?.turns;
  return Array.isArray(turns) ? turns.flatMap((turn, index) => [
    ...textField(`${path}.turns[${index}].speaker`, turn?.speaker),
    ...textField(`${path}.turns[${index}].text`, turn?.text),
  ]) : [];
};

// Model-authored `fields` are never read. Every scanned field has a path in
// the canonical content schema, including options and explanations.
export function groundedCandidateFields(candidate, contentType) {
  if (!plain(candidate)) return [];
  if (QUESTION_TYPES.has(contentType)) return [
    ...(candidate.question ? questionFields(candidate.question, 'question') : []),
    ...(Array.isArray(candidate.questions) ? candidate.questions.flatMap((question, index) =>
      questionFields(question, `questions[${index}]`)) : []),
    ...(Array.isArray(candidate.evidence) ? candidate.evidence.flatMap((entry, index) =>
      textField(`evidence[${index}].quote`, entry?.quote)) : []),
  ];
  if (contentType === 'vocabulary_example' || contentType === 'grammar_example') {
    const keys = contentType === 'vocabulary_example'
      ? ['japanese', 'reading', 'highlight', 'indonesian'] : ['japanese', 'highlight', 'indonesian'];
    return Array.isArray(candidate.examples)
      ? candidate.examples.flatMap((example, index) => keys.flatMap(key =>
        textField(`examples[${index}].${key}`, example?.[key])))
      : keys.flatMap(key => textField(key, candidate[key]));
  }
  if (contentType === 'grammar_dialog') return [
    ...dialogueFields(candidate.dialogue, 'dialogue'),
    ...['exampleDialog', 'exampleDialogId', 'communicationGoal']
      .flatMap(key => textField(key, candidate[key])),
    ...(Array.isArray(candidate.dialogScene?.participants) ? candidate.dialogScene.participants.flatMap((part, index) => [
      ...textField(`dialogScene.participants[${index}].speaker`, part?.speaker),
      ...textField(`dialogScene.participants[${index}].displayName`, part?.displayName),
    ]) : []),
    ...dialogueFields(candidate.dialogScene, 'dialogScene'),
    ...(Array.isArray(candidate.dialogFurigana?.lines) ? candidate.dialogFurigana.lines.flatMap((line, index) => [
      ...textField(`dialogFurigana.lines[${index}].speaker`, line?.speaker),
      ...textField(`dialogFurigana.lines[${index}].text`, line?.text),
      ...(Array.isArray(line?.readings) ? line.readings.flatMap((reading, n) =>
        textField(`dialogFurigana.lines[${index}].readings[${n}].reading`, reading?.reading)) : []),
    ]) : []),
  ];
  if (contentType === 'dialogue_translation') return textField('dialog_id', candidate.dialog_id);
  if (['grammar_distractors', 'distractors', 'quiz_options'].includes(contentType)) return [
    ...['recognitionDistractors', 'controlledDistractors', 'distractors', 'options']
      .flatMap(key => stringArrayFields(key, candidate[key])),
  ];
  if (['kanji_compound_assessed', 'kanji_compound_exploration'].includes(contentType)) return [
    ...textField('japanese', candidate.japanese),
    ...['japanese', 'reading', 'indonesian'].flatMap(key =>
      textField(`compound.${key}`, candidate.compound?.[key])),
  ];
  return [
    ...['text', 'passage'].flatMap(key => textField(key, candidate[key])),
    ...dialogueFields(candidate.dialogue, 'dialogue'),
  ];
}

export function groundedCandidateSchemaIssues(candidate, contentType) {
  const allowed = SCHEMA_KEYS[contentType];
  if (!allowed) return [{ code: 'unsupported_generation_content_type' }];
  const extras = Object.keys(candidate).filter(key => !allowed.includes(key));
  const errors = extras.map(field => ({ code: 'unknown_candidate_field', field }));
  const japanese = value => typeof value === 'string' && JAPANESE.test(value);
  const optionalString = (key, max = 2000) => {
    const value = candidate[key];
    if (value != null && (typeof value !== 'string' || value.length > max)) {
      errors.push({ code: 'invalid_candidate_field', field: key });
    }
  };
  const stringList = (key, min = 2, max = 6) => {
    const value = candidate[key];
    if (value == null) return;
    if (!Array.isArray(value) || value.length < min || value.length > max ||
        value.some(item => typeof item !== 'string' || !item.trim() || item.length > 500) ||
        new Set(value.map(item => typeof item === 'string' ? item.normalize('NFC').trim() : item)).size !== value.length) {
      errors.push({ code: 'invalid_candidate_array', field: key });
    }
  };
  const evidenceShape = (value, field) => {
    if (value == null) return;
    if (!Array.isArray(value) || value.length < 1 || value.length > 6 || value.some(item =>
      !plain(item) || Object.keys(item).some(key => !['turnIndex', 'quote'].includes(key)) ||
      !Number.isInteger(item.turnIndex) || item.turnIndex < 0 ||
      typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 500)) {
      errors.push({ code: 'invalid_evidence_schema', field });
    }
  };
  const turnShape = (turn, field) => {
    if (!plain(turn) || Object.keys(turn).some(key => !['speaker', 'text'].includes(key)) ||
        typeof turn.text !== 'string' || !turn.text.trim() || turn.text.length > 2000 ||
        (turn.speaker != null && (typeof turn.speaker !== 'string' || turn.speaker.length > 100))) {
      errors.push({ code: 'invalid_dialogue_schema', field });
    }
  };
  const dialogueShape = (value, field) => {
    if (value == null) return;
    if (typeof value === 'string') {
      if (!value.trim() || value.length > 8000) errors.push({ code: 'invalid_dialogue_schema', field });
      return;
    }
    const turns = Array.isArray(value) ? value : value?.turns;
    if ((!Array.isArray(value) && (!plain(value) || Object.keys(value).some(key => key !== 'turns'))) ||
        !Array.isArray(turns) || turns.length < 1 || turns.length > 40) {
      errors.push({ code: 'invalid_dialogue_schema', field }); return;
    }
    turns.forEach((turn, index) => turnShape(turn, `${field}.turns[${index}]`));
  };
  let meaningful = false;
  if (contentType === 'vocabulary_example' || contentType === 'grammar_example') {
    const keys = contentType === 'vocabulary_example'
      ? ['japanese', 'reading', 'highlight', 'indonesian'] : ['japanese', 'highlight', 'indonesian'];
    const batch = candidate.examples != null;
    if (batch && keys.some(key => key in candidate)) errors.push({ code: 'mixed_example_schema' });
    if (batch && (!Array.isArray(candidate.examples) || candidate.examples.length < 1 ||
        candidate.examples.length > 5)) errors.push({ code: 'invalid_example_batch' });
    const examples = batch ? (Array.isArray(candidate.examples) ? candidate.examples : []) : [candidate];
    meaningful = examples.length > 0 && examples.every(example => japanese(example?.japanese));
    for (const [index, example] of examples.entries()) {
      const prefix = batch ? `examples[${index}].` : '';
      if (!plain(example) || Object.keys(example).some(key => !keys.includes(key))) {
        errors.push({ code: 'invalid_example_schema', field: prefix || 'example' });
        continue;
      }
      if (typeof example.japanese !== 'string' || !example.japanese.trim() || example.japanese.length > 2000) {
        errors.push({ code: 'invalid_candidate_field', field: `${prefix}japanese` });
      }
      for (const key of keys.filter(key => key !== 'japanese')) {
        if (example[key] != null && (typeof example[key] !== 'string' || example[key].length > 2000)) {
          errors.push({ code: 'invalid_candidate_field', field: `${prefix}${key}` });
        }
      }
    }
  } else if (contentType === 'dialogue_translation') {
    meaningful = typeof candidate.dialog_id === 'string' && !!candidate.dialog_id.trim();
    if (!meaningful || candidate.dialog_id.length > 8000) {
      errors.push({ code: 'invalid_translation_schema', field: 'dialog_id' });
    }
  } else if (contentType === 'grammar_dialog') {
    meaningful = ['dialogue', 'exampleDialog', 'dialogScene', 'dialogFurigana']
      .some(key => candidate[key] != null && JAPANESE.test(JSON.stringify(candidate[key])));
    dialogueShape(candidate.dialogue, 'dialogue');
    for (const key of ['exampleDialog', 'exampleDialogId', 'communicationGoal']) optionalString(key, 8000);
    if (candidate.dialogScene != null) {
      const scene = candidate.dialogScene;
      if (!plain(scene) || Object.keys(scene).some(key => !['participants', 'turns'].includes(key)) ||
          (scene.participants != null && (!Array.isArray(scene.participants) || scene.participants.length > 12 ||
            scene.participants.some(part => !plain(part) || Object.keys(part).some(key =>
              !['speaker', 'displayName'].includes(key)) ||
              typeof part.speaker !== 'string' || typeof part.displayName !== 'string')))) {
        errors.push({ code: 'invalid_dialogue_schema', field: 'dialogScene' });
      }
      if (scene?.turns != null) dialogueShape({ turns: scene.turns }, 'dialogScene');
    }
    if (candidate.dialogFurigana != null) {
      const furigana = candidate.dialogFurigana;
      const invalidReading = reading => !plain(reading) ||
        Object.keys(reading).some(key => !['start', 'end', 'reading'].includes(key)) ||
        typeof reading.reading !== 'string' || !reading.reading.trim() ||
        (reading.start != null && (!Number.isInteger(reading.start) || reading.start < 0)) ||
        (reading.end != null && (!Number.isInteger(reading.end) || reading.end < 0));
      const invalidLine = line => !plain(line) ||
        Object.keys(line).some(key => !['speaker', 'text', 'readings'].includes(key)) ||
        typeof line.text !== 'string' ||
        (line.speaker != null && typeof line.speaker !== 'string') ||
        (line.readings != null && (!Array.isArray(line.readings) ||
          line.readings.length > 40 || line.readings.some(invalidReading)));
      if (!plain(furigana) || Object.keys(furigana).some(key => key !== 'lines') ||
          !Array.isArray(furigana.lines) || furigana.lines.length > 40 ||
          furigana.lines.some(invalidLine)) {
        errors.push({ code: 'invalid_dialogue_schema', field: 'dialogFurigana' });
      }
    }
  } else if (contentType.includes('question') || contentType === 'quiz' ||
      contentType === 'assessment' || contentType === 'dialogue_comprehension' ||
      contentType === 'dialogue_transfer') {
    meaningful = candidate.question != null || candidate.questions != null;
    if (candidate.question != null && candidate.questions != null) {
      errors.push({ code: 'invalid_question_schema', field: 'question' });
    }
    if (candidate.questions != null && (!Array.isArray(candidate.questions) ||
        candidate.questions.length < 1 || candidate.questions.length > 2)) {
      errors.push({ code: 'invalid_question_schema', field: 'questions' });
    }
    for (const [index, question] of (Array.isArray(candidate.questions) ? candidate.questions :
      candidate.question != null ? [candidate.question] : []).entries()) {
      if (plain(question) && (Object.keys(question).some(key =>
        !['prompt', 'options', 'correctIndex', 'explanation', 'evidence'].includes(key)) ||
        (question.explanation != null && (typeof question.explanation !== 'string' ||
          question.explanation.length > 2000)))) {
        errors.push({ code: 'invalid_question_schema', field: `questions[${index}]` });
      }
      evidenceShape(question?.evidence, `questions[${index}].evidence`);
    }
    evidenceShape(candidate.evidence, 'evidence');
  } else if (contentType.includes('distractors') || contentType === 'quiz_options') {
    const keys = ['recognitionDistractors', 'controlledDistractors', 'distractors', 'options'];
    meaningful = keys.some(key => candidate[key] != null);
    for (const key of keys) if (allowed.includes(key)) stringList(key,
      key === 'options' ? 3 : 2, key === 'options' ? 4 : 6);
  } else if (contentType === 'kanji_compound_assessed' || contentType === 'kanji_compound_exploration') {
    meaningful = japanese(candidate.japanese) ||
      (candidate.compound != null && JAPANESE.test(JSON.stringify(candidate.compound)));
    optionalString('japanese');
    if (candidate.compound != null && (!plain(candidate.compound) ||
        Object.keys(candidate.compound).some(key => !['japanese', 'reading', 'indonesian'].includes(key)) ||
        typeof candidate.compound.japanese !== 'string' || !candidate.compound.japanese.trim() ||
        candidate.compound.japanese.length > 2000 ||
        ['reading', 'indonesian'].some(key => candidate.compound[key] != null &&
          typeof candidate.compound[key] !== 'string'))) {
      errors.push({ code: 'invalid_compound_schema', field: 'compound' });
    }
  } else {
    meaningful = ['text', 'passage', 'dialogue'].some(key => japanese(candidate[key]) ||
      (key === 'dialogue' && candidate[key] != null && JAPANESE.test(JSON.stringify(candidate[key]))));
    for (const key of ['text', 'passage']) if (allowed.includes(key)) optionalString(key, 8000);
    if (allowed.includes('dialogue')) dialogueShape(candidate.dialogue, 'dialogue');
  }
  if (!meaningful) errors.push({ code: 'candidate_content_missing', contentType });
  return errors;
}

function questionErrors(candidate, contentType, sourceDialogue) {
  if (!QUESTION_TYPES.has(contentType)) return [];
  const questions = Array.isArray(candidate.questions) ? candidate.questions :
    candidate.question ? [candidate.question] : [];
  if (!questions.length || questions.length > 2) return [{ code: 'invalid_question_schema' }];
  const errors = questions.flatMap(question => validateQuestionShape(question));
  if (contentType !== 'dialogue_comprehension') return errors;
  const turns = Array.isArray(sourceDialogue) ? sourceDialogue : sourceDialogue?.turns;
  if (!Array.isArray(turns) || !turns.length) return [...errors, { code: 'source_dialogue_required' }];
  for (const [index, question] of questions.entries()) {
    const evidence = question?.evidence || (questions.length === 1 ? candidate.evidence : null);
    if (!Array.isArray(evidence) || !evidence.length || evidence.some(item =>
      !Number.isInteger(item?.turnIndex) || item.turnIndex < 0 || item.turnIndex >= turns.length ||
      typeof item.quote !== 'string' || !item.quote.trim() ||
      !String(turns[item.turnIndex]?.text ?? turns[item.turnIndex]?.japanese ?? '').includes(item.quote))) {
      errors.push({ code: 'source_evidence_invalid', questionIndex: index });
    }
  }
  return errors;
}

const feedbackFor = report => ({ status: report.status,
  issues: [...(report.violations || []), ...(report.warnings || [])]
    .slice(0, 12).map(item => ({ code: item.code, field: item.field ?? null,
      value: item.value ?? null })) });

async function callProvider(provider, args, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('providerTimeoutMs must be positive');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider({ ...args, signal: controller.signal })),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new Error('provider_timeout'));
      }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Draft generation only. The caller must use the guarded write service later. */
export async function generateGroundedContent({
  scope, contentType, provider, resolveBoundary = getCurriculumBoundary,
  loadSource = null, expectedBoundaryFingerprint = null, expectedSourceFingerprint = null,
  communicationGoal = '', scenario = '', contextOptions = {}, maxRepairs = 2,
  providerTimeoutMs = 30000,
  trustedValidation = {}, expectedExampleCount = null,
  parse = parseGroundedCandidate, validate = validateContentAgainstBoundary,
  decide = decideBoundaryAction,
} = {}) {
  if (typeof provider !== 'function' || typeof resolveBoundary !== 'function') {
    throw new TypeError('provider and resolveBoundary functions required');
  }
  const attempts = [];
  if (!SCHEMA_KEYS[contentType]) {
    const report = errorReport('schema_invalid', 'unsupported_generation_content_type');
    return { status: 'rejected', candidate: null, report, attempts };
  }
  let boundary;
  try { boundary = await resolveBoundary(scope); }
  catch { return { status: 'unavailable', candidate: null, attempts,
    report: errorReport('unavailable', 'boundary_unavailable') }; }
  const mode = boundary?.course?.mode || 'enforce';
  const decision = report => decide({ mode, operation: 'generate', report });
  if (boundary?.status !== 'resolved') {
    const report = errorReport('context_invalid', 'boundary_context_invalid', boundary?.boundaryFingerprint);
    return { status: 'rejected', candidate: null, report, decision: decision(report), attempts };
  }
  if (expectedBoundaryFingerprint && expectedBoundaryFingerprint !== boundary.boundaryFingerprint) {
    const report = errorReport('version_conflict', 'boundary_changed_since_preview', boundary.boundaryFingerprint);
    return { status: 'stale', candidate: null, report, decision: decision(report), attempts };
  }
  let sourceDialogue = null;
  if (loadSource) {
    try { sourceDialogue = await loadSource(scope); }
    catch { const report = errorReport('unavailable', 'source_unavailable', boundary.boundaryFingerprint);
      return { status: 'unavailable', candidate: null, report, decision: decision(report), attempts }; }
  }
  if (contentType === 'dialogue_comprehension' &&
      !(Array.isArray(sourceDialogue) ? sourceDialogue.length : sourceDialogue?.turns?.length)) {
    const report = errorReport('context_invalid', 'source_dialogue_required', boundary.boundaryFingerprint);
    return { status: 'rejected', candidate: null, report, decision: decision(report), attempts };
  }
  let built;
  try { built = buildGroundedContext({ boundary, sourceDialogue, communicationGoal, scenario, ...contextOptions }); }
  catch (error) {
    const code = error instanceof GroundedContextError ? error.code : 'grounded_context_unavailable';
    const report = errorReport('context_invalid', code, boundary.boundaryFingerprint);
    return { status: 'rejected', candidate: null, report, decision: decision(report), attempts };
  }
  if (expectedSourceFingerprint && expectedSourceFingerprint !== built.sourceFingerprint) {
    const report = errorReport('version_conflict', 'source_changed_since_preview', boundary.boundaryFingerprint);
    return { status: 'stale', candidate: null, report, decision: decision(report), attempts };
  }
  let candidate = null;
  let report = null;
  let feedback = null;
  const focusGrammarIds = GRAMMAR_CONTENT_TYPES.has(contentType)
    ? (boundary.target?.grammar || []).map(entry => String(entry.sourceIds?.[0] ?? entry.key)).filter(Boolean)
    : [];
  const limit = Math.min(2, Math.max(0, Number.isInteger(maxRepairs) ? maxRepairs : 2)) + 1;
  for (let attempt = 1; attempt <= limit; attempt++) {
    let raw;
    try { raw = await callProvider(provider, { prompt: built.prompt, context: built.context,
      attempt, repairFeedback: feedback }, providerTimeoutMs); }
    catch {
      report = errorReport('unavailable', 'provider_unavailable', boundary.boundaryFingerprint);
      attempts.push({ attempt, status: report.status, issues: ['provider_unavailable'] });
      feedback = feedbackFor(report);
      continue;
    }
    try { candidate = parse(raw); }
    catch {
      candidate = null;
      report = errorReport('schema_invalid', 'model_output_invalid_json', boundary.boundaryFingerprint);
      attempts.push({ attempt, status: report.status, issues: ['model_output_invalid_json'] });
      feedback = feedbackFor(report);
      continue;
    }
    const fields = groundedCandidateFields(candidate, contentType);
    const schemaIssues = [...groundedCandidateSchemaIssues(candidate, contentType),
      ...questionErrors(candidate, contentType, sourceDialogue)];
    if (expectedExampleCount != null &&
        (!Array.isArray(candidate.examples) || candidate.examples.length !== expectedExampleCount)) {
      schemaIssues.push({ code: 'example_count_mismatch', expected: expectedExampleCount });
    }
    try { report = validate({ boundary, contentType, operation: 'generate', fields,
        question: candidate.question, communicationGoal,
        // Model-supplied grammar IDs are never authority for the validator.
        contentIsNewOrChanged: true,
        verifiedGrammarIds: trustedValidation.verifiedGrammarIds,
        grammarSignatures: trustedValidation.grammarSignatures,
        focusGrammarIds }); }
    catch {
      const unavailable = errorReport('unavailable', 'validator_unavailable', boundary.boundaryFingerprint);
      return { status: 'unavailable', candidate, report: unavailable,
        decision: decision(unavailable), attempts, context: built.context };
    }
    if (!fields.length) schemaIssues.push({ code: 'empty_candidate_fields' });
    if (schemaIssues.length) report = { ...report, status: 'schema_invalid', valid: false,
      violations: [...(report.violations || []), ...schemaIssues] };
    if (report.status === 'evaluated' && focusGrammarIds.length &&
        !report.usage?.targetGrammar?.some(item => focusGrammarIds.includes(String(item.key)) &&
          demonstratesTargetGrammar(contentType, item.field))) {
      report = { ...report, valid: false, violations: [...(report.violations || []),
        { code: 'target_grammar_not_demonstrated', grammarIds: focusGrammarIds, confidence: 'unknown' }] };
    }
    if (report.status === 'evaluated' && contentType === 'grammar_example' &&
        Array.isArray(candidate.examples) && focusGrammarIds.length) {
      for (const [index] of candidate.examples.entries()) {
        if (!report.usage?.targetGrammar?.some(item => focusGrammarIds.includes(String(item.key)) &&
            item.field === `examples[${index}].japanese`)) {
          report = { ...report, valid: false, violations: [...(report.violations || []),
            { code: 'target_grammar_not_demonstrated', exampleIndex: index, grammarIds: focusGrammarIds }] };
        }
      }
    }
    attempts.push({ attempt, status: report.status, valid: report.valid,
      issues: (report.violations || []).map(item => item.code) });
    if (report.status === 'evaluated' && report.valid === true) break;
    feedback = feedbackFor(report);
  }
  if (!report) report = errorReport('unavailable', 'provider_unavailable', boundary.boundaryFingerprint);
  // Never reuse the prompt snapshot as save authority. Re-read current source
  // and boundary after the model call; a later save must recheck again.
  let currentBoundary, currentSource = null;
  try {
    currentBoundary = await resolveBoundary(scope);
    if (loadSource) currentSource = await loadSource(scope);
  } catch {
    const unavailable = errorReport('unavailable', 'freshness_check_unavailable', boundary.boundaryFingerprint);
    return { status: 'unavailable', candidate, report: unavailable,
      decision: decision(unavailable), attempts, context: built.context };
  }
  if (currentBoundary?.status !== 'resolved' ||
      currentBoundary?.boundaryFingerprint !== boundary.boundaryFingerprint ||
      (loadSource && dialogueSourceFingerprint(currentSource) !== built.sourceFingerprint)) {
    const stale = errorReport('version_conflict', 'generation_source_changed', currentBoundary?.boundaryFingerprint);
    return { status: 'stale', candidate, report: stale, decision: decision(stale),
      attempts, context: built.context };
  }
  return { status: report.status === 'unavailable' ? 'unavailable' :
      report.status === 'evaluated' && report.valid === true ? 'ready' : 'rejected',
    candidate, report, decision: decision(report), attempts, context: built.context,
    boundaryFingerprint: boundary.boundaryFingerprint,
    sourceFingerprint: built.sourceFingerprint };
}
