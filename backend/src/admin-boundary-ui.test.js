// Focused VM tests for admin.html's guarded-save response/error presentation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const start = html.indexOf('function notifyLearningWarnings(result)');
const end = html.indexOf('// Disable a form\'s submit button', start);
assert.ok(start > 0 && end > start, 'boundary-save helper slice markers not found');

function setup() {
  const notices = [];
  const ctx = vm.createContext({
    URLSearchParams,
    notify: (...args) => notices.push(args),
    api: async () => ({ boundaryFingerprint: 'sha256:current' }),
  });
  vm.runInContext(html.slice(start, end), ctx);
  return { ctx, notices };
}

test('guarded success shows decision and field-level validation details', () => {
  const { ctx, notices } = setup();
  ctx.notifyLearningWarnings({ validation: {
    status: 'evaluated', violations: [{ field: 'japanese', code: 'future_kanji', message: 'Kanji di luar cakupan' }],
  }, decision: { action: 'reject' } });
  assert.match(notices[0][0], /Keputusan validasi: reject/);
  assert.match(notices[0][0], /japanese: Kanji di luar cakupan/);
});

for (const [status, phrase] of [[422, 'Save ditolak oleh validasi'], [409, 'Data berubah sejak editor dibuka'], [503, 'Validasi\/konteks kurikulum sedang tidak tersedia']]) {
  test(`guarded ${status} response shows report and leaves editor input untouched`, () => {
    const { ctx, notices } = setup();
    const input = { value: 'draft yang belum tersimpan' };
    ctx.notifyBoundarySaveError({ status, message: 'blocked', body: {
      decision: { action: 'reject' }, report: { violations: [{ field: 'question', message: 'Perbaiki soal' }] },
    } });
    assert.match(notices[0][0], new RegExp(phrase));
    assert.match(notices[0][0], /question: Perbaiki soal/);
    assert.match(notices[0][0], /Isi editor tetap tersedia/);
    assert.equal(input.value, 'draft yang belum tersimpan');
  });
}

test('metadata helper sends the available boundary fingerprint and revision', async () => {
  const { ctx } = setup();
  const body = await ctx.attachBoundarySaveMetadata({}, { lessonId: 'lesson-1' }, 'rev-7');
  assert.equal(body.expectedRevision, 'rev-7');
  assert.equal(body.boundaryFingerprint, 'sha256:current');
});

test('consecutive inline saves use the revision returned by the preceding save', async () => {
  const { ctx } = setup();
  const row = { dataset: { revision: 'rev-1' } };
  const firstBody = await ctx.attachBoundarySaveMetadata({}, { moduleId: 'module-1' }, row.dataset.revision);
  assert.equal(firstBody.expectedRevision, 'rev-1');
  ctx.updateSavedRowRevision(row, { updated_at: 'rev-2' });
  const secondBody = await ctx.attachBoundarySaveMetadata({}, { moduleId: 'module-1' }, row.dataset.revision);
  assert.equal(secondBody.expectedRevision, 'rev-2');
  assert.match(html.slice(html.indexOf('window.saveItemRow ='), html.indexOf('window.deleteItemRow =')), /updateSavedRowRevision\(tr, savedResult\.vocabulary \|\| savedResult\.grammar\)/);
  assert.match(html.slice(html.indexOf('window.grmrSaveExample ='), html.indexOf('window.grmrDeleteExample =')), /updateSavedRowRevision\(tr, savedResult\.example\)/);
  assert.match(html.slice(html.indexOf('window.deckSaveExample ='), html.indexOf('window.deckDeleteExample =')), /updateSavedRowRevision\(tr, savedResult\.example\)/);
});

test('bulk summary surfaces a successful item validation warning', () => {
  const { ctx } = setup();
  const summary = ctx.summarizeGuardedBatchOutcome([
    { id: 'item-1', validation: { warnings: [{ field: 'kana', code: 'reading_review', message: 'Periksa bacaan' }] } },
  ], []);
  assert.equal(summary.savedCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.issueCount, 1);
  assert.match(summary.message, /Berhasil 1/);
  assert.match(summary.message, /kana: Periksa bacaan/);
});

test('bulk summary explicitly reports mixed saves and bounded rejected item details', () => {
  const { ctx } = setup();
  const summary = ctx.summarizeGuardedBatchOutcome([
    { id: 'saved-1', validation: { warnings: [{ field: 'reading', message: 'Periksa kana' }] } },
  ], [
    { id: 'rejected-1', error: 'validation_rejected', status: 422,
      validation: { violations: [{ field: 'reading', code: 'invalid_reading', message: 'Bacaan tidak valid' }] } },
    { id: 'rejected-2', error: 'ai_unavailable', status: 502 },
    { id: 'rejected-3', error: 'bulk_item_failed', status: 500 },
    { id: 'rejected-4', error: 'bulk_item_failed', status: 500 },
  ]);
  assert.equal(summary.savedCount, 1);
  assert.equal(summary.failedCount, 4);
  assert.match(summary.message, /Berhasil 1 · gagal 4/);
  assert.match(summary.message, /rejected-1: validation_rejected HTTP 422/);
  assert.match(summary.message, /reading: Bacaan tidak valid/);
  assert.match(summary.message, /\+1 kegagalan/);
  assert.match(ctx.batchRequestErrorMessage('Generate kana', {
    status: 503, message: 'ai_disabled', body: { detail: 'AI tidak tersedia' },
  }), /HTTP 503: AI tidak tersedia/);
});

test('bulk callers present item summaries and request failures instead of generic success', () => {
  const distractors = html.slice(html.indexOf('window.grmrGenDistractorsAll ='), html.indexOf('window.grmrSaveDistractors ='));
  const readings = html.slice(html.indexOf('window.deckGenAllReadings ='), html.indexOf('window.deckMove ='));
  assert.match(distractors, /summarizeGuardedBatchOutcome\(d\.savedItems, d\.failedItems, d\.failed\)/);
  assert.match(distractors, /batchRequestErrorMessage\('Bulk generate pengecoh', err\)/);
  assert.match(readings, /summarizeGuardedBatchOutcome\(d\.updatedItems, d\.failedItems\)/);
  assert.match(readings, /batchRequestErrorMessage\('Generate kana', err\)/);
});

test('Bunpou draft saves send the loaded revision and advance it after each save', async () => {
  const start = html.indexOf('async function bfPersistDraft(ctx)');
  const end = html.indexOf('function bfDraftSaveError(error)', start);
  assert.ok(start > 0 && end > start, 'Bunpou draft persistence helper markers not found');
  const requests = [], revisions = ['rev-2', 'rev-3'];
  const ctx = vm.createContext({
    bfCollectEnvelope: () => ({ objective: 'draft' }),
    api: async (_path, options) => {
      requests.push(JSON.parse(options.body));
      return { draftRevision: revisions.shift() };
    },
  });
  vm.runInContext(html.slice(start, end), ctx);
  const draftCtx = { lessonId: 'lesson-1', draftRevision: 'rev-1' };
  await ctx.bfPersistDraft(draftCtx);
  await ctx.bfPersistDraft(draftCtx);
  assert.equal(requests[0].draftRevision, 'rev-1');
  assert.equal(requests[1].draftRevision, 'rev-2');
  assert.equal(draftCtx.draftRevision, 'rev-3');
});

test('Bunpou 409 keeps the editor open and reports that the draft changed', async () => {
  const start = html.indexOf('function bfDraftSaveError(error)');
  const end = html.indexOf('window.bfPublish =', start);
  assert.ok(start > 0 && end > start, 'Bunpou draft save handler markers not found');
  const notices = [];
  let closeCount = 0;
  const input = { value: 'unsaved editor text' };
  const ctx = vm.createContext({
    window: { __bfCtx: { lessonId: 'lesson-1', draftRevision: 'stale' } },
    notify: (...args) => notices.push(args),
    closeModal: () => { closeCount++; },
    bfPersistDraft: async () => { throw Object.assign(new Error('draft_changed_since_review'), { status: 409 }); },
  });
  vm.runInContext(html.slice(start, end), ctx);
  await ctx.window.bfSaveDraft();
  assert.equal(closeCount, 0, 'conflicting save must not close the modal');
  assert.equal(input.value, 'unsaved editor text');
  assert.match(notices[0][0], /Draft atau materi sumber berubah/);
  assert.match(notices[0][0], /tetap terbuka/);
});

test('api preserves HTTP status and structured response body for guarded errors', async () => {
  const apiStart = html.indexOf('async function api(path, opts)');
  const apiEnd = html.indexOf('// Modal dirty-tracking', apiStart);
  assert.ok(apiStart > 0 && apiEnd > apiStart, 'api helper slice markers not found');
  const ctx = vm.createContext({ ezApi: async () => ({ ok: false, status: 422, json: async () => ({ error: 'validation_rejected', report: { violations: [{ field: 'japanese' }] } }) }) });
  vm.runInContext(html.slice(apiStart, apiEnd), ctx);
  let thrown;
  try { await ctx.api('/admin/module-vocabulary'); } catch (error) { thrown = error; }
  assert.equal(thrown.status, 422);
  assert.equal(thrown.body.report.violations[0].field, 'japanese');
});

test('admin save handlers route rejected responses to the preserving error presenter', () => {
  for (const name of ['submitLesson', 'submitQuestion', 'saveItemRow', 'grmrSaveExample', 'deckSaveExample']) {
    const at = html.indexOf(`function ${name}(`) >= 0 ? html.indexOf(`function ${name}(`) : html.indexOf(`window.${name} =`);
    assert.ok(at >= 0, `${name} handler not found`);
    const slice = html.slice(at, html.indexOf('\n};', at) > at ? html.indexOf('\n};', at) : at + 9000);
    assert.match(slice, /notifyBoundarySaveError\(err\)/, `${name} should display guarded rejection details`);
    assert.match(slice, /catch \(err\) \{ notifyBoundarySaveError\(err\); \}/, `${name} error path must only notify, leaving editor values in place`);
  }
  const quizStart = html.indexOf('async function submitQuestion(');
  const quizEnd = html.indexOf('// ─────────────────────────────────────────────────────────────\n// MODULE VOCAB', quizStart);
  const quizSource = html.slice(quizStart, quizEnd);
  assert.match(quizSource, /existingQuestion\?\.revision/, 'quiz save must send the backend revision token');
});
