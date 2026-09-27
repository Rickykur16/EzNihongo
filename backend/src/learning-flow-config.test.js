import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLearningFlowConfig, loadLearningFlowConfig, flowScopeAllows,
  resolveFlowEligibility, getLearningFlowSettings, saveLearningFlowSettings,
  learningFlowReadiness, V2_RUNTIME_AVAILABLE } from './learning-flow-config.js';
import { permissionForLegacyRoute, LEGACY_ROUTES } from './company-route-policy.js';
import { contentRevisionId } from './bunpou-flow-service.js';
import { dialogueFingerprint, questionFingerprint } from './dialogue-question-service.js';
import { CURRICULUM_VALIDATOR_VERSION } from './curriculum-boundary-validator.js';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { courseId: id(1), moduleId: id(2), lessonId: id(3) };
const configured = { enabled: true, courseIds: [], moduleIds: [scope.moduleId], lessonIds: [] };

function configDb(initial = JSON.stringify(configured)) {
  let raw = initial;
  let rowRevision = raw == null ? null : '42';
  const calls = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes('FROM grammar_task_sessions')) return { rows: [] };
    if (sql.includes('FROM app_settings')) return { rows: raw == null ? [] :
      [{ value: raw, row_revision: rowRevision }] };
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('INSERT INTO app_settings')) {
      raw = params[1]; rowRevision = String(Number(rowRevision || 42) + 1);
      return { rows: [{ row_revision: rowRevision }] };
    }
    throw Error(`unexpected SQL: ${sql}`);
  } };
  return { client, calls, transaction: fn => fn(client), get raw() { return raw; } };
}

test('config parser is strict, canonical, and allowlist union is explicit', () => {
  assert.deepEqual(parseLearningFlowConfig(JSON.stringify(configured)), configured);
  assert.equal(flowScopeAllows(configured, scope), true);
  assert.equal(flowScopeAllows(configured, { ...scope, moduleId: id(4) }), false);
  assert.equal(flowScopeAllows({ ...configured, enabled: false }, scope), false);
  assert.equal(flowScopeAllows({ ...configured, courseIds: [scope.courseId], moduleIds: [] }, scope), true);
  assert.equal(flowScopeAllows({ ...configured, lessonIds: [scope.lessonId], moduleIds: [] }, scope), true);
  for (const bad of [null, '{}', '{bad', { ...configured, enabled: 'true' },
    { ...configured, moduleIds: [scope.moduleId, scope.moduleId] },
    { ...configured, moduleIds: ['not-uuid'] },
    { ...configured, surprise: true },
    { enabled: true, courseIds: [], moduleIds: [], lessonIds: [] }]) {
    assert.throws(() => parseLearningFlowConfig(bad), e => e.status === 400);
  }
});

test('missing/invalid config fail closed with distinct revision and diagnostic', async () => {
  const missing = await loadLearningFlowConfig(configDb(null).client);
  const invalid = await loadLearningFlowConfig(configDb('{broken').client);
  assert.equal(missing.config.enabled, false);
  assert.equal(missing.diagnostic, 'flow_config_missing');
  assert.equal(invalid.diagnostic, 'flow_config_invalid');
  assert.notEqual(missing.configRevision, invalid.configRevision);
  assert.equal((await getLearningFlowSettings({ ...configDb(null) })).readiness.ready, false);
});

test('v1 session wins and enabled allowlist still cannot activate passive PR6 runtime', async () => {
  assert.equal(V2_RUNTIME_AVAILABLE, false);
  const f = configDb();
  const args = { client: f.client, user: { id: id(5) }, ...scope };
  const passive = await resolveFlowEligibility(args);
  assert.deepEqual(passive, { mode: 'legacy', reason: 'v2_runtime_unavailable' });
  assert.equal(f.calls.some(call => call.sql.includes('grammar_dialog_questions')), false);
  const activeClient = { query: async (sql, params) => sql.includes('FROM grammar_task_sessions')
    ? { rows: [{ id: id(6), flow_version: 1 }] } : f.client.query(sql, params) };
  const active = await resolveFlowEligibility({ ...args, client: activeClient });
  assert.deepEqual(active, { mode: 'legacy_session', reason: 'active_legacy_session',
    activeSessionId: id(6) });
  const activeV2Client = { query: async (sql, params) => sql.includes('FROM grammar_task_sessions')
    ? { rows: [{ id: id(7), flow_version: 2 }] } : f.client.query(sql, params) };
  const activeV2 = await resolveFlowEligibility({ ...args, client: activeV2Client });
  assert.deepEqual(activeV2, { mode: 'legacy', reason: 'v2_runtime_unavailable' });
  const resumedV2 = await resolveFlowEligibility({ ...args, client: activeV2Client,
    runtimeAvailable: true });
  assert.deepEqual(resumedV2, { mode: 'inline', flowVersion: 2,
    reason: 'active_v2_session', activeSessionId: id(7) });
  const ready = await resolveFlowEligibility({ ...args, runtimeAvailable: true,
    checkLessonReadiness: async () => ({ ready: true, issues: [] }) });
  assert.equal(ready.mode, 'inline');
  const unready = await resolveFlowEligibility({ ...args, runtimeAvailable: true,
    checkLessonReadiness: async () => ({ ready: false, issues: [{ code: 'missing' }] }) });
  assert.equal(unready.mode, 'legacy');
});

test('settings write is optimistic, validates readiness, and does not enable on rejection', async () => {
  const f = configDb();
  const before = await loadLearningFlowConfig(f.client);
  const ready = { ready: true, issues: [], lessons: [{ lessonId: scope.lessonId, ready: true }] };
  const dependencies = { ...f, checkReadiness: async () => ready,
    resolveScope: async () => ({ issues: [], courseIds: [scope.courseId], lessons: [] }),
    lockCourses: async () => { f.calls.push({ sql: 'COURSE LOCK' }); } };
  await assert.rejects(saveLearningFlowSettings({ expectedConfigRevision: 'stale',
    config: configured }, dependencies),
  e => e.status === 409);
  await assert.rejects(saveLearningFlowSettings({ expectedConfigRevision: before.configRevision,
    config: configured }, { ...dependencies,
      checkReadiness: async () => ({ ...ready, ready: false }) }),
  e => e.status === 422 && e.message === 'flow_readiness_failed');
  assert.equal(f.calls.some(call => call.sql.includes('INSERT INTO app_settings')), false);
  const saved = await saveLearningFlowSettings({ expectedConfigRevision: before.configRevision,
    config: configured }, dependencies);
  assert.equal(saved.config.enabled, true);
  assert.equal(saved.configRevision, (await loadLearningFlowConfig(f.client)).configRevision);
  assert.equal(f.calls.filter(call => call.sql.includes('INSERT INTO app_settings')).length, 1);
  assert.notEqual(saved.configRevision, before.configRevision);
  const successfulWrite = f.calls.findIndex(call => call.sql.includes('INSERT INTO app_settings'));
  const courseLock = f.calls.map(call => call.sql).lastIndexOf('COURSE LOCK', successfulWrite);
  const settingLock = f.calls.findIndex((call, index) => index > courseLock &&
    call.sql.includes('pg_advisory_xact_lock') && call.params?.includes('learning-flow:config'));
  assert.ok(courseLock >= 0 && settingLock > courseLock && successfulWrite > settingLock);
  await assert.rejects(saveLearningFlowSettings({ expectedConfigRevision: before.configRevision,
    config: configured }, dependencies),
  e => e.status === 409);
  const missing = configDb();
  const revision = (await loadLearningFlowConfig(missing.client)).configRevision;
  await assert.rejects(saveLearningFlowSettings({ expectedConfigRevision: revision,
    config: configured }, { ...missing, checkReadiness: async () => ({ ready: false,
      issues: [{ code: 'flow_scope_id_missing', id: scope.moduleId }], lessons: [] }),
      resolveScope: async () => ({ courseIds: [], lessons: [],
        issues: [{ code: 'flow_scope_id_missing', id: scope.moduleId }] }),
      lockCourses: async () => {} }),
  e => e.status === 422 && e.message === 'flow_scope_invalid');

  const broken = configDb(JSON.stringify({ ...configured, enabled: true,
    moduleIds: [id(99)] }));
  const brokenRevision = (await loadLearningFlowConfig(broken.client)).configRevision;
  const disabledBroken = { enabled: false, courseIds: [], moduleIds: [id(99)], lessonIds: [] };
  const disabled = await saveLearningFlowSettings({ expectedConfigRevision: brokenRevision,
    config: disabledBroken }, { ...broken,
    resolveScope: async () => { throw Error('content lookup unavailable'); },
    checkReadiness: async () => { throw Error('readiness unavailable'); } });
  assert.equal(disabled.config.enabled, false);
});

test('readiness rejects stale companion and missing normalized questions for a mapped task', async () => {
  const grammarId = id(10), taskId = id(11);
  const client = { async query(sql) {
    if (sql.startsWith('SELECT id FROM courses')) return { rows: [] };
    if (sql.startsWith('SELECT id,course_id FROM modules')) return { rows: [{ id: scope.moduleId,
      course_id: scope.courseId }] };
    if (sql.includes('SELECT l.id,l.module_id,l.type,m.course_id FROM lessons')) return { rows: [] };
    if (sql.includes('SELECT l.id,l.module_id')) return { rows: [{ id: scope.lessonId,
      module_id: scope.moduleId, course_id: scope.courseId, type: 'lesson' }] };
    if (sql.includes('SELECT t.id,s.bunpou_flow_published')) return { rows: [{ id: taskId,
      source_course_id: scope.courseId, task_course_id: scope.courseId,
      bunpou_flow_published: { sourceFingerprint: 'sha256:old' } }] };
    if (sql.includes('FROM lesson_grammar_task_items gi')) return { rows: [{ id: grammarId,
      pattern: '〜です', meaning: 'adalah', example: 'ねこです',
      recognition_distractors: null, controlled_distractors: null, sort_order: 0 }] };
    if (sql.includes('FROM grammar_examples')) return { rows: [] };
    if (sql.includes('FROM module_grammar g') && sql.includes('JOIN lessons l')) {
      return { rows: [{ id: grammarId, pattern: '〜です', meaning: 'adalah',
        recognition_distractors: null, controlled_distractors: null }] };
    }
    if (sql.includes('SELECT id FROM module_grammar WHERE lesson_id=')) return { rows: [{ id: grammarId }] };
    if (sql.includes('FROM module_grammar WHERE id=ANY')) return { rows: [{ id: grammarId,
      module_id: scope.moduleId, lesson_id: scope.lessonId,
      example_dialog: 'A: ねこです。', example_dialog_id: 'A: Kucing.',
      communication_goal: 'Nama hewan', dialog_scene: null }] };
    if (sql.includes('FROM grammar_dialog_questions')) return { rows: [] };
    throw Error(`unexpected SQL ${sql}`);
  } };
  const result = await learningFlowReadiness(client, configured, {
    resolveBoundary: async () => ({ status: 'resolved', boundaryFingerprint: 'sha256:test',
      course: { id: scope.courseId, slug: 'n5' }, currentModule: { id: scope.moduleId },
      lesson: { id: scope.lessonId, slug: 'lesson' }, target: { vocabulary: [], kanji: [], grammar: [] },
      previous: { vocabulary: [], kanji: [], grammar: [] },
      prerequisite: { vocabulary: [], kanji: [], grammar: [] },
      future: { vocabulary: [], kanji: [], grammar: [] },
      auxiliaryPolicy: { version: 0, terms: [] }, integrityIssues: [] }) });
  assert.equal(result.ready, false);
  assert.deepEqual(result.lessons[0].issues.map(item => item.code).sort(),
    ['flow_companion_not_current', 'flow_question_count_invalid']);
});

test('readiness pins every visible dialogue question to current source, review, and boundary', async () => {
  const grammarId = id(20), taskId = id(21), extraGrammarId = id(22);
  const rawItem = { id: grammarId, pattern: '〜です', meaning: 'adalah', example: 'ねこです',
    example_dialog: 'A: ねこです。', example_dialog_id: 'A: Kucing.',
    recognition_distractors: null, controlled_distractors: null, sort_order: 0,
    instruction: 'Buat kalimat', requiredCount: 1 };
  const rawPool = { id: grammarId, pattern: '〜です', meaning: 'adalah',
    recognition_distractors: null, controlled_distractors: null };
  const normalized = row => ({ ...row, recognitionDistractors: [], controlledDistractors: [], examples: [] });
  let companionFingerprint = contentRevisionId([normalized(rawItem)], [normalized(rawPool)]);
  const grammar = { id: grammarId, module_id: scope.moduleId, lesson_id: scope.lessonId,
    example_dialog: rawItem.example_dialog, example_dialog_id: rawItem.example_dialog_id,
    communication_goal: 'Menyebut hewan', dialog_scene: null };
  const dialogue = dialogueFingerprint(grammar);
  const makeQuestion = (kind, n, evidence = null) => {
    const authored = { kind, prompt: kind === 'comprehension' ? 'Hewan apa?' : 'Pilih respons tepat.',
      options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
      explanation: 'Jawaban sesuai konteks.', evidence };
    return { id: id(n), grammar_id: grammarId, source_lesson_id: scope.lessonId, kind,
      prompt: authored.prompt, options: authored.options, correct_index: authored.correctIndex,
      explanation: authored.explanation, evidence, dialogue_fingerprint: dialogue,
      question_fingerprint: questionFingerprint(authored), boundary_fingerprint: 'sha256:boundary',
      validator_version: CURRICULUM_VALIDATOR_VERSION, source_kind: 'manual',
      source_key: null, source_fingerprint: null };
  };
  const questions = [makeQuestion('comprehension', 23,
    [{ turnIndex: 0, quote: 'ねこです' }]), makeQuestion('transfer', 24)];
  let extraVisible = false;
  const client = { async query(sql) {
    if (sql.startsWith('SELECT id FROM courses')) return { rows: [] };
    if (sql.startsWith('SELECT id,course_id FROM modules')) return { rows: [{ id: scope.moduleId,
      course_id: scope.courseId }] };
    if (sql.includes('SELECT l.id,l.module_id,l.type,m.course_id FROM lessons')) return { rows: [] };
    if (sql.includes('SELECT l.id,l.module_id')) return { rows: [{ id: scope.lessonId,
      module_id: scope.moduleId, course_id: scope.courseId, type: 'video' }] };
    if (sql.includes('SELECT t.id,s.bunpou_flow_published')) return { rows: [{ id: taskId,
      source_course_id: scope.courseId, task_course_id: scope.courseId,
      bunpou_flow_published: { sourceFingerprint: companionFingerprint } }] };
    if (sql.includes('FROM lesson_grammar_task_items gi')) return { rows: [rawItem] };
    if (sql.includes('FROM grammar_examples')) return { rows: [] };
    if (sql.includes('FROM module_grammar g') && sql.includes('JOIN lessons l')) return { rows: [rawPool] };
    if (sql.includes('SELECT id FROM module_grammar WHERE lesson_id=')) return { rows:
      [{ id: grammarId }, ...(extraVisible ? [{ id: extraGrammarId }] : [])] };
    if (sql.includes('FROM module_grammar WHERE id=ANY')) return { rows: [grammar] };
    if (sql.includes('FROM grammar_dialog_questions')) return { rows: questions };
    throw Error(`unexpected SQL ${sql}`);
  } };
  const sets = () => ({ vocabulary: [], kanji: [], grammar: [] });
  let boundaryFingerprint = 'sha256:boundary';
  let futureKanji = [];
  const resolveBoundary = async () => ({ status: 'resolved', boundaryFingerprint,
    course: { id: scope.courseId, slug: 'n5' }, currentModule: { id: scope.moduleId },
    lesson: { id: scope.lessonId, slug: 'lesson' }, target: sets(), previous: sets(),
    prerequisite: sets(), future: { ...sets(), kanji: futureKanji },
    auxiliaryPolicy: { version: 0, terms: [] },
    integrityIssues: [] });
  const ready = await learningFlowReadiness(client, configured, { resolveBoundary });
  assert.equal(ready.ready, true);

  boundaryFingerprint = 'sha256:new-boundary';
  const staleReview = await learningFlowReadiness(client, configured, { resolveBoundary });
  assert.equal(staleReview.ready, false);
  assert.ok(staleReview.lessons[0].issues.some(item => item.code === 'flow_question_review_stale'));

  boundaryFingerprint = 'sha256:boundary';
  extraVisible = true;
  const incomplete = await learningFlowReadiness(client, configured, { resolveBoundary });
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.lessons[0].issues.some(item =>
    item.code === 'flow_task_dialogue_coverage_incomplete' && item.grammarId === extraGrammarId));

  extraVisible = false;
  grammar.example_dialog = 'A: ねこです。\nB: 学校です。';
  rawItem.example_dialog = grammar.example_dialog;
  companionFingerprint = contentRevisionId([normalized(rawItem)], [normalized(rawPool)]);
  const changedDialogue = dialogueFingerprint(grammar);
  for (const row of questions) row.dialogue_fingerprint = changedDialogue;
  futureKanji = [{ key: 'future-school', character: '学', sourceIds: [], earliestIntroduction: null }];
  const unsafeSource = await learningFlowReadiness(client, configured, { resolveBoundary });
  assert.equal(unsafeSource.ready, false);
  assert.ok(unsafeSource.lessons[0].issues.some(item =>
    item.code === 'flow_dialogue_boundary_invalid' && item.violations.includes('future_kanji')));
});

test('learning flow settings policy is exact and owner only', () => {
  assert.equal(LEGACY_ROUTES.filter(([method, path]) =>
    ['GET', 'PUT'].includes(method) && path === '/settings/learning-flow-communication').length, 2);
  assert.equal(permissionForLegacyRoute('GET', '/settings/learning-flow-communication'), null);
  assert.equal(permissionForLegacyRoute('PUT', '/settings/learning-flow-communication'), null);
  // Exact route inventory still matters: a broad staff wildcard is forbidden.
  assert.equal(permissionForLegacyRoute('POST', '/settings/learning-flow-communication'), null);
  assert.equal(permissionForLegacyRoute('GET', '/settings/learning-flow-communication/other'), null);
});
