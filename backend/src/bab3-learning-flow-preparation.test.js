import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBab3LearningFlow, validateBab3PreparationOptions } from
  './bab3-learning-flow-preparation.js';
import { parseArgs } from '../scripts/prepare-bab3-learning-flow.mjs';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const courseId = id(1), moduleId = id(2), runId = id(3);
const sources = [
  { id: id(10), slug: 'bunpou-n5-b3', task_lesson_id: id(11) },
  { id: id(20), slug: 'bunpou2-n5-b3', task_lesson_id: id(21) },
];

const checks = base => Object.fromEntries([0, 1, 2].map(offset => [id(base + offset), {
  comprehension: { prompt: 'Apa yang terjadi?', options: ['A', 'B', 'C'], correctIndex: 0,
    explanation: 'Sesuai dialog.', evidence: [{ turnIndex: 0, quote: 'A' }] },
  comparison: { prompt: 'Mana yang benar?', options: ['X', 'Y', 'Z'], correctIndex: 0,
    explanation: 'Gunakan pola yang benar.' },
}]));

function fixture({ dirtyBackfill = false, snapshotDrift = false } = {}) {
  let updates = 0;
  const snapshotMd5 = 'a'.repeat(32);
  const rows = sources.map((source, index) => {
    const review = { version: 1, migration: '174_prepare_bab3_learning_flow.sql',
      sourceSnapshotMd5: snapshotMd5, draftPayloadMd5: `d${index}`,
      publishedPayloadMd5: `p${index}` };
    return { ...source, draft_payload_md5: `d${index}`, published_payload_md5: `p${index}`,
      bunpou_flow_draft: { schemaVersion: 1, dialogChecks: checks(index ? 200 : 100),
        editor: { email: 'migration/174_prepare_bab3_learning_flow.sql' },
        preparationReview: review },
      bunpou_flow_published: { schemaVersion: 1, dialogChecks: checks(index ? 200 : 100),
        publishedBy: { email: 'migration/174_prepare_bab3_learning_flow.sql' },
        preparationReview: review } };
  });
  const client = { async query(sql) {
    if (sql.includes('FROM courses c JOIN modules m')) return { rows: [{
      course_id: courseId, course_slug: 'n5', module_id: moduleId, module_slug: 'n5-b3',
    }] };
    if (sql.includes('AS source_snapshot_md5')) return { rows: [{
      source_snapshot_md5: snapshotDrift ? 'b'.repeat(32) : snapshotMd5,
    }] };
    if (sql.includes('FROM lessons s JOIN lessons t')) return { rows };
    if (sql.startsWith('UPDATE lessons')) { updates++; return { rowCount: 1, rows: [] }; }
    throw new Error(`unexpected SQL ${sql}`);
  } };
  const questionRows = Array.from({ length: 12 }, (_, index) => ({
    sourceLessonId: sources[index < 6 ? 0 : 1].id,
    grammarId: id(100 + Math.floor(index / 2)),
    legacyKind: index % 2 ? 'comparison' : 'comprehension',
    status: dirtyBackfill && index === 0 ? 'skipped_conflict' : 'inserted',
  }));
  return {
    transaction: fn => fn(client),
    lockCourse: async () => {},
    loadItems: async taskId => {
      const base = taskId === sources[0].task_lesson_id ? 100 : 200;
      return [0, 1, 2].map(offset => ({ id: id(base + offset), pattern: `p${offset}`,
        meaning: 'm', example: 'e', recognitionDistractors: [], controlledDistractors: [],
        examples: [], instruction: '', requiredCount: 1, sort_order: offset }));
    },
    loadPool: async taskId => {
      const base = taskId === sources[0].task_lesson_id ? 100 : 200;
      return [0, 1, 2].map(offset => ({ id: id(base + offset), pattern: `p${offset}`,
        meaning: 'm', recognitionDistractors: [], controlledDistractors: [] }));
    },
    validateEnvelope: () => ({ ok: true, errors: [] }),
    backfill: async () => ({ lessonCount: 2, rows: questionRows,
      counts: dirtyBackfill ? { inserted: 11, skipped_conflict: 1 } : { inserted: 12 },
      sourceChecksum: 'sha256:source', checksum: 'sha256:report' }),
    readiness: async () => ({ ready: true, issues: [], lessons: [
      { lessonId: sources[0].id, ready: true, issues: [] },
      { lessonId: sources[1].id, ready: true, issues: [] },
    ] }),
    get updates() { return updates; },
  };
}

test('Bab 3 preparation CLI requires exact UUID scope and defaults to dry-run', () => {
  assert.deepEqual(parseArgs(['--course-id', courseId, '--module-id', moduleId, '--run-id', runId]),
    { courseId, moduleId, runId, apply: false });
  assert.equal(parseArgs(['--course-id', courseId, '--module-id', moduleId,
    '--run-id', runId, '--apply']).apply, true);
  assert.throws(() => validateBab3PreparationOptions({ courseId, moduleId, runId: 'bad' }),
    /scope_invalid/u);
  assert.throws(() => parseArgs(['--course-id', courseId, '--module-id', moduleId,
    '--run-id', runId, '--apply', '--dry-run']), /conflicting/u);
});

test('dry-run simulates the full write, reports readiness, and requests rollback', async () => {
  const f = fixture();
  const report = await prepareBab3LearningFlow({ courseId, moduleId, runId }, f);
  assert.equal(report.dryRun, true);
  assert.equal(report.companion.length, 2);
  assert.equal(report.companion.every(row => row.status === 'would_refresh'), true);
  assert.deepEqual(report.questions.counts, { would_insert: 12 });
  assert.equal(report.readiness.ready, true);
  assert.equal(f.updates, 2);
});

test('apply returns committed statuses and any backfill conflict aborts', async () => {
  const f = fixture();
  const report = await prepareBab3LearningFlow({ courseId, moduleId, runId, apply: true }, f);
  assert.equal(report.dryRun, false);
  assert.equal(report.companion.every(row => row.status === 'refreshed'), true);
  assert.deepEqual(report.questions.counts, { inserted: 12 });

  const dirty = fixture({ dirtyBackfill: true });
  await assert.rejects(prepareBab3LearningFlow({ courseId, moduleId, runId, apply: true }, dirty),
    /question_backfill_not_clean/u);
});

test('preparation refuses a companion or source snapshot that changed after migration review', async () => {
  const changed = fixture({ snapshotDrift: true });
  await assert.rejects(prepareBab3LearningFlow({ courseId, moduleId, runId }, changed),
    /review_snapshot_changed/u);
});
