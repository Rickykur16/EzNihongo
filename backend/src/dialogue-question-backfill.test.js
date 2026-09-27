import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillDialogueQuestions, assessLegacyQuestion,
  legacySourceKey } from './dialogue-question-backfill.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { contentRevisionId } from './bunpou-flow-service.js';
import { dialogueFingerprint } from './dialogue-question-service.js';
import { parseArgs } from '../scripts/backfill-dialogue-questions.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const courseId = id(1), moduleId = id(2), lessonId = id(3), taskId = id(4), grammarId = id(5), runId = id(6);
const scope = { courseIds: [courseId], moduleIds: [moduleId], lessonIds: [lessonId], runId };
const grammar = { id: grammarId, module_id: moduleId, lesson_id: lessonId,
  course_id: courseId, example_dialog: 'A: ねこです。', example_dialog_id: 'A: Kucing.',
  communication_goal: 'Nama hewan', dialog_scene: null };
const comprehension = { prompt: 'Apa hewannya?', options: ['Kucing', 'Anjing', 'Burung'],
  correctIndex: 0, explanation: 'Dialog menyebut kucing.',
  evidence: [{ turnIndex: 0, quote: 'ねこです' }] };
const comparison = { prompt: 'Kalimat mana sesuai?',
  options: ['ねこです。', 'いぬです。', 'とりです。'], correctIndex: 0,
  explanation: 'Gunakan pola untuk menyebut kucing.' };
const emptyBoundary = { status: 'resolved', boundaryFingerprint: 'sha256:boundary',
  course: { id: courseId }, currentModule: { id: moduleId }, integrityIssues: [],
  target: { vocabulary: [], grammar: [], kanji: [] },
  previous: { vocabulary: [], grammar: [], kanji: [] },
  prerequisite: { vocabulary: [], grammar: [], kanji: [] },
  future: { vocabulary: [], grammar: [], kanji: [] } };

async function fixture({ missingEvidence = false, stale = false, manualConflict = false,
  nullGrammarAmbiguous = false, taskMappingAmbiguous = false } = {}) {
  const rows = [];
  let writes = 0;
  let validationRefreshes = 0;
  let validationBoundaryFingerprint = 'sha256:boundary';
  const published = { dialogChecks: { [grammarId]: {
    comprehension: missingEvidence ? { ...comprehension, evidence: undefined } : comprehension,
    comparison,
  } } };
  const client = { async query(sql, params = []) {
    if (sql === 'SET TRANSACTION READ ONLY') return { rows: [] };
    if (sql.startsWith('SELECT id FROM courses')) return { rows: [{ id: courseId }] };
    if (sql.startsWith('SELECT id,course_id FROM modules')) return { rows: [{ id: moduleId,
      course_id: courseId }] };
    if (sql.startsWith('SELECT l.id,l.module_id')) return { rows: [{ id: lessonId,
      module_id: moduleId, course_id: courseId }] };
    if (sql.includes('SELECT s.id AS source_lesson_id')) return { rows: [{ source_lesson_id: lessonId,
      module_id: moduleId, course_id: courseId }] };
    if (sql.includes('SELECT s.id,s.module_id,s.bunpou_flow_published')) {
      const row = { id: lessonId, module_id: moduleId,
        bunpou_flow_published: published, bunpou_flow_draft: { note: 'diagnostic only' },
        task_lesson_id: taskId, task_module_id: moduleId };
      return { rows: taskMappingAmbiguous ? [row, { ...row, task_lesson_id: id(30) }] : [row] };
    }
    if (sql.includes('FROM lesson_grammar_task_items gi')) return { rows: [{ id: grammarId,
      pattern: '〜です', meaning: 'adalah', example: 'ねこです',
      example_dialog: grammar.example_dialog, example_dialog_id: grammar.example_dialog_id,
      recognition_distractors: null, controlled_distractors: null,
      sort_order: 0, instruction: '', requiredCount: 1 }] };
    if (sql.includes('FROM grammar_examples')) return { rows: [] };
    if (sql.includes('FROM module_grammar g') && sql.includes('JOIN lessons l')) {
      return { rows: [{ id: grammarId, pattern: '〜です', meaning: 'adalah',
        recognition_distractors: null, controlled_distractors: null }] };
    }
    if (sql.includes('SELECT id FROM module_grammar WHERE lesson_id=')) {
      return { rows: [{ id: grammarId }] };
    }
    if (sql.includes('SELECT g.*,m.course_id')) return { rows: [{ ...grammar,
      lesson_id: nullGrammarAmbiguous ? null : lessonId }] };
    if (sql.includes('SELECT DISTINCT s.id FROM lessons s')) return { rows: nullGrammarAmbiguous
      ? [{ id: lessonId }, { id: id(31) }] : [{ id: lessonId }] };
    if (sql.includes('FROM grammar_dialog_questions') && sql.includes('source_kind=')) {
      return { rows: rows.filter(row => row.grammar_id === params[0] ||
        row.source_kind === 'legacy_bunpou' && params[1].includes(row.source_key)) };
    }
    if (sql.includes('UPDATE grammar_dialog_questions') &&
        sql.includes('SET boundary_fingerprint=')) {
      const row = rows.find(candidate => candidate.id === params[0] &&
        candidate.state === 'active' && candidate.source_kind === 'legacy_bunpou' &&
        candidate.source_key === params[3] && candidate.source_fingerprint === params[4] &&
        candidate.question_fingerprint === params[5] && candidate.dialogue_fingerprint === params[6] &&
        candidate.boundary_fingerprint === params[7] && candidate.validator_version === params[8]);
      if (!row) return { rowCount: 0, rows: [] };
      row.boundary_fingerprint = params[1];
      row.validator_version = params[2];
      validationRefreshes++;
      return { rowCount: 1, rows: [{ id: row.id, question_version: row.question_version,
        boundary_fingerprint: row.boundary_fingerprint,
        validator_version: row.validator_version }] };
    }
    if (sql.includes('INSERT INTO grammar_dialog_questions')) {
      writes++;
      rows.push({ id: params[0], grammar_id: params[1], source_lesson_id: params[2],
        kind: params[3], prompt: params[4], options: JSON.parse(params[5]),
        correct_index: params[6], explanation: params[7], sort_order: 0,
        question_version: params[8], question_fingerprint: params[9],
        dialogue_fingerprint: params[10], evidence: params[11] ? JSON.parse(params[11]) : null,
        source_kind: 'legacy_bunpou', source_key: params[12],
        source_fingerprint: params[13], boundary_fingerprint: params[14],
        validator_version: params[15], state: 'active' });
      return { rows: [] };
    }
    if (sql.includes('SELECT * FROM grammar_dialog_questions WHERE id=')) {
      return { rows: rows.filter(row => row.id === params[0]) };
    }
    throw Error(`unexpected SQL ${sql}`);
  } };
  const query = client.query.bind(client);
  published.sourceFingerprint = contentRevisionId(await loadTaskConcepts(taskId, query),
    await loadModulePool(taskId, query));
  if (stale) published.sourceFingerprint = 'sha256:stale';
  if (manualConflict) rows.push({ id: id(20), grammar_id: grammarId,
    kind: 'comprehension', sort_order: 0, state: 'active', source_kind: 'manual' });
  return { client, published, rows, get writes() { return writes; },
    get validationRefreshes() { return validationRefreshes; },
    setValidationBoundaryFingerprint(value) { validationBoundaryFingerprint = value; },
    transaction: fn => fn(client), lockCourse: async () => {},
    resolveBoundary: async () => emptyBoundary,
    validate: () => ({ status: 'evaluated', valid: true,
      boundaryFingerprint: validationBoundaryFingerprint,
      warnings: [], violations: [] }) };
}

test('CLI requires explicit scope/run ID and defaults to dry-run', () => {
  assert.deepEqual(parseArgs(['--course-id', courseId, '--run-id', runId]),
    { courseIds: [courseId], moduleIds: [], lessonIds: [], apply: false, runId });
  assert.equal(parseArgs(['--course-id', courseId, '--lesson-id', lessonId,
    '--run-id', runId, '--apply']).apply, true);
  for (const args of [[], ['--apply'], ['--course-id', courseId],
    ['--course-id', courseId, '--run-id', runId, '--apply', '--dry-run']]) {
    assert.throws(() => parseArgs(args));
  }
});

test('dry-run has no writes; apply copies exact source once and rerun is idempotent', async () => {
  const f = await fixture();
  const dry = await backfillDialogueQuestions(scope, f);
  assert.equal(dry.dryRun, true);
  assert.equal(dry.counts.would_insert, 2);
  assert.equal(JSON.stringify(dry).includes('correctIndex'), false);
  assert.equal(f.writes, 0);
  assert.equal(f.rows.length, 0);
  const first = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(first.counts.inserted, 2);
  assert.equal(first.sourceChecksum, dry.sourceChecksum);
  assert.equal(f.writes, 2);
  assert.deepEqual(f.rows.find(row => row.kind === 'comprehension').evidence,
    comprehension.evidence);
  assert.deepEqual(f.rows.find(row => row.kind === 'transfer').options,
    comparison.options);
  assert.equal(f.rows.every(row => row.dialogue_fingerprint === dialogueFingerprint(grammar)), true);
  const second = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(second.counts.already_present, 2);
  assert.equal(second.sourceChecksum, first.sourceChecksum);
  assert.equal(f.writes, 2);
  assert.equal(legacySourceKey({ sourceLessonId: lessonId, grammarId,
    legacyKind: 'comparison' }), f.rows.find(row => row.kind === 'transfer').source_key);
});

test('missing evidence, stale published companion, and manual conflict never overwrite', async () => {
  const missing = await fixture({ missingEvidence: true });
  const reviewed = await backfillDialogueQuestions({ ...scope, apply: true }, missing);
  assert.equal(reviewed.counts.needs_editor_review, 1);
  assert.equal(missing.rows.some(row => row.kind === 'comprehension'), false);
  const stale = await fixture({ stale: true });
  assert.equal((await backfillDialogueQuestions({ ...scope, apply: true }, stale)).counts.published_stale, 1);
  assert.equal(stale.writes, 0);
  const conflict = await fixture({ manualConflict: true });
  assert.equal((await backfillDialogueQuestions({ ...scope, apply: true }, conflict)).counts.skipped_conflict, 1);
  assert.equal(conflict.rows.find(row => row.id === id(20)).source_kind, 'manual');
});

test('boundary warnings remain diagnostic while errors block the backfill', async () => {
  const warning = await fixture();
  warning.resolveBoundary = async () => ({ ...emptyBoundary,
    integrityIssues: [{ code: 'vocabulary_unplaced', severity: 'warning' }] });
  const allowed = await backfillDialogueQuestions(scope, warning);
  assert.equal(allowed.counts.would_insert, 2);

  const invalid = await fixture();
  invalid.resolveBoundary = async () => ({ ...emptyBoundary,
    status: 'context_invalid',
    integrityIssues: [{ code: 'grammar_lesson_owner_mismatch', severity: 'error' }] });
  const blocked = await backfillDialogueQuestions(scope, invalid);
  assert.equal(blocked.counts.boundary_context_invalid, 1);
  assert.equal(invalid.writes, 0);
});

test('all active slots constrain transfer and comprehension count, including nonzero manual slots', async () => {
  const f = await fixture();
  f.rows.push({ id: id(21), grammar_id: grammarId, kind: 'transfer',
    sort_order: 1, state: 'active', source_kind: 'manual', options: ['a', 'b', 'c'],
    correct_index: 0 });
  f.rows.push({ id: id(22), grammar_id: grammarId, kind: 'comprehension',
    sort_order: 1, state: 'active', source_kind: 'manual', options: ['x', 'y', 'z'],
    correct_index: 0 });
  f.rows.push({ id: id(23), grammar_id: grammarId, kind: 'comprehension',
    sort_order: 2, state: 'active', source_kind: 'manual', options: ['d', 'e', 'f'],
    correct_index: 0 });
  const report = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(report.counts.skipped_conflict, 2);
  assert.equal(f.writes, 0);
});

test('ambiguous task or null-owner grammar source mapping fails closed', async () => {
  const task = await fixture({ taskMappingAmbiguous: true });
  assert.equal((await backfillDialogueQuestions({ ...scope, apply: true }, task))
    .counts.source_mapping_ambiguous, 1);
  const grammarScope = await fixture({ nullGrammarAmbiguous: true });
  assert.equal((await backfillDialogueQuestions({ ...scope, apply: true }, grammarScope))
    .counts.grammar_source_ambiguous, 1);
  assert.equal(grammarScope.writes, 0);
});

test('changed source and edited imported row are reported without overwrite', async () => {
  const f = await fixture();
  await backfillDialogueQuestions({ ...scope, apply: true }, f);
  const previousWrites = f.writes;
  f.published.dialogChecks[grammarId].comparison.prompt = 'Soal baru?';
  const changed = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(changed.counts.source_changed, 1);
  f.published.dialogChecks[grammarId].comparison.prompt = comparison.prompt;
  f.rows.find(row => row.kind === 'comprehension').prompt = 'Editor mengubah soal';
  const edited = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(edited.counts.edited_conflict, 1);
  assert.equal(f.writes, previousWrites);
  f.rows.find(row => row.kind === 'comprehension').prompt = comprehension.prompt;
  f.rows.find(row => row.kind === 'comprehension').validator_version = 'old';
  const oldValidator = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(oldValidator.counts.edited_conflict, 1);
});

test('canary-only refresh revalidates exact legacy rows and changes review metadata only', async () => {
  const f = await fixture();
  await backfillDialogueQuestions({ ...scope, apply: true }, f);
  const before = structuredClone(f.rows);
  f.setValidationBoundaryFingerprint('sha256:audit-boundary');
  const ordinary = await backfillDialogueQuestions({ ...scope, apply: true }, f);
  assert.equal(ordinary.counts.edited_conflict, 2);
  assert.equal(f.validationRefreshes, 0);

  const refreshed = await backfillDialogueQuestions({ ...scope, apply: true }, {
    ...f, validationRefreshOnly: true,
  });
  assert.equal(refreshed.counts.review_refreshed, 2);
  assert.equal(f.validationRefreshes, 2);
  assert.deepEqual(f.rows.map(row => ({ ...row, boundary_fingerprint: null })),
    before.map(row => ({ ...row, boundary_fingerprint: null })));
  assert.equal(f.rows.every(row => row.boundary_fingerprint === 'sha256:audit-boundary'), true);

  f.rows[0].prompt = 'Editor mengubah soal';
  f.setValidationBoundaryFingerprint('sha256:next-boundary');
  const conflict = await backfillDialogueQuestions({ ...scope, apply: true }, {
    ...f, validationRefreshOnly: true,
  });
  assert.equal(conflict.counts.edited_conflict, 1);
  assert.equal(f.rows[0].boundary_fingerprint, 'sha256:audit-boundary');
});

test('family and source grounding gate do not invent missing fields', () => {
  const boundary = emptyBoundary;
  const base = { grammar, sourceLessonId: lessonId, publishedFingerprint: 'sha256:source',
    boundary, validate: () => ({ status: 'evaluated', valid: true,
      boundaryFingerprint: 'sha256:boundary', warnings: [], violations: [] }) };
  const sameFamily = { comprehension, comparison: { ...comparison,
    options: comprehension.options, correctIndex: comprehension.correctIndex } };
  assert.equal(assessLegacyQuestion({ ...base, check: sameFamily,
    legacyKind: 'comparison' }).status, 'invalid_legacy_question');
  assert.equal(assessLegacyQuestion({ ...base, check: { comprehension: {
    ...comprehension, evidence: [{ turnIndex: 0, quote: 'いぬです' }] }, comparison },
  legacyKind: 'comprehension' }).status, 'needs_editor_review');
  assert.equal(assessLegacyQuestion({ ...base, check: { comprehension: {
    ...comprehension, correctIndex: '0' }, comparison },
  legacyKind: 'comprehension' }).status, 'needs_editor_review');
});
