import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
function slice(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `Missing source markers: ${start}`);
  return html.slice(from, to);
}
const source = slice('async function renderAiSettings()', 'window.coachPromptResetDefault');
const companionSource = slice('function bfCheckBlock(', '// Soal Step 1 =');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const liveId = '11111111-1111-4111-8111-111111111111';
const staleId = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';
const fixture = () => ({ lessons: [
  { id: liveId, title: 'Perkenalan', courseTitle: 'N5', moduleTitle: 'Bab 1', published: true, live: true, reason: null },
  { id: staleId, title: 'Waktu', courseTitle: 'N5', moduleTitle: 'Bab 2', published: true, live: false,
    reason: 'Materi perlu ditinjau dan dipublikasikan ulang' },
  { id: draftId, title: 'Hobi', courseTitle: 'N5', moduleTitle: 'Bab 2', published: false, live: false,
    reason: 'Pendamping belum dipublikasikan' },
] });
function element() {
  return {
    value: '', checked: false, disabled: true, textContent: '', markup: '',
    get innerHTML() { return this.markup; },
    set innerHTML(value) {
      this.markup = value;
      const options = [...value.matchAll(/<option\b([^>]*)>/g)];
      if (options.length) {
        const selected = options.find(option => /\bselected\b/.test(option[1])) || options[0];
        this.value = selected[1].match(/value="([^"]*)"/)?.[1] || '';
      }
    },
  };
}
function setup() {
  const ids = ['bf-companion-panel', 'bf-companion-live', 'bf-companion-lesson-id', 'bf-companion-status',
    'bf-companion-edit', 'bf-companion-withdraw', 'bf-companion-reload', 'ms-shadow-lesson', 'ms-shadow-status',
    'ms-shadow-run', 'ms-shadow-edit', 'ms-shadow-out', 'bf-objective', 'bf-reviewed'];
  const nodes = Object.fromEntries(ids.map(id => [id, element()]));
  const pane = element();
  const state = { data: fixture(), calls: [], notices: [], edits: [], closed: 0, confirms: [], confirmAnswer: true,
    detail: { currentFingerprint: 'source-at-preview', draftRevision: 'older-saved-draft', grammarIds: [], patterns: {} } };
  const ctx = vm.createContext({
    document: { getElementById: id => nodes[id] || null, querySelector: () => pane },
    escapeHtml,
    api: async (path, options) => {
      state.calls.push({ path, options });
      if (path === '/admin/settings/coaching-note-prompt') return {};
      if (options) {
        if (state.write) return state.write(path, options);
        if (path.endsWith('/draft')) return { ok: true, draftRevision: 'newly-saved-draft' };
        if (path.endsWith('/publish')) return state.publishResult || { ok: true, live: true, liveReason: null };
        return { ok: true };
      }
      if (path === '/admin/bunpou-flow/lessons') {
        if (state.load) return state.load();
        if (state.error) throw state.error;
        return state.data;
      }
      if (path.includes('/grammar-mastery/shadow')) return state.shadow || { totals: {}, metadataCoverage: {}, samples: [] };
      if (path.endsWith('/bunpou-flow')) return state.detail;
      throw new Error(`Unexpected API path: ${path}`);
    },
    notify: (message, error) => state.notices.push({ message, error }),
    manageBunpouFlow: (...args) => state.edits.push(args),
    openModal: content => { state.modal = content; },
    closeModal: () => { state.closed++; },
    modalContent: { style: {} },
    confirm: message => { state.confirms.push(message); return state.confirmAnswer; },
  });
  ctx.window = ctx;
  vm.runInContext(source, ctx);
  return { ctx, nodes, pane, state };
}
const writes = state => state.calls.filter(call => call.options);
const select = (ctx, nodes, id, value) => { nodes[id].value = value; ctx.bfCompanionUpdateControls(); };

test('native selectors have explicit labels, status descriptions, and no UUID entry fields', async () => {
  const { ctx, pane } = setup();
  await ctx.renderAiSettings();
  for (const id of ['bf-companion-lesson-id', 'ms-shadow-lesson']) {
    assert.match(pane.innerHTML, new RegExp(`<label for="${id}"`));
    assert.match(pane.innerHTML, new RegExp(`<select id="${id}" disabled aria-describedby=`));
    assert.doesNotMatch(pane.innerHTML, new RegExp(`<input[^>]*id="${id}"`));
  }
  assert.doesNotMatch(pane.innerHTML, /UUID pelajaran|ID pelajaran/);
});

test('the card has no activation switch: publishing is going live', async () => {
  const { ctx, pane } = setup();
  await ctx.renderAiSettings();
  assert.doesNotMatch(pane.innerHTML, /type="checkbox"|pilot/i);
  assert.match(pane.innerHTML, /langsung tampil ke siswa/);
  assert.match(pane.innerHTML, /Tarik publikasi/);
  assert.doesNotMatch(source, /settings\/bunpou-flow-pilot/);
});

test('options group course and bab and show live status or the reason it is not live', async () => {
  const { ctx, nodes } = setup();
  await ctx.bfCompanionLoadOptions();
  const picker = nodes['bf-companion-lesson-id'].innerHTML;
  assert.match(picker, /<optgroup label="N5 \/ Bab 1">/);
  assert.match(picker, /Perkenalan - Tampil ke siswa/);
  assert.match(picker, /Waktu - Dipublikasikan, belum tampil: Materi perlu ditinjau dan dipublikasikan ulang/);
  assert.match(picker, /Hobi - Belum tampil: Pendamping belum dipublikasikan/);
  assert.doesNotMatch(picker, /<option value="[^"]+"[^>]*disabled/);
  assert.doesNotMatch(picker.replace(/<[^>]*>/g, ''), /[0-9a-f]{8}-[0-9a-f-]{27}/);
  assert.equal(nodes['bf-companion-lesson-id'].value, '', 'no lesson is auto-selected');
  assert.equal(nodes['bf-companion-live'].textContent, 'Tampil ke siswa sekarang: Bab 1 — Perkenalan');
});

test('titles, grouping labels and reasons are escaped', () => {
  const { ctx } = setup();
  const lessons = fixture().lessons;
  Object.assign(lessons[1], { title: '<img onerror="bad">', courseTitle: '"><script>', reason: '<unsafe>' });
  const options = ctx.bfCompanionLessonOptions(lessons, staleId);
  assert.doesNotMatch(options, /<img|<script>|<unsafe>/);
  assert.match(options, /&lt;img/);
  assert.match(options, /&quot;&gt;&lt;script&gt;/);
  assert.match(options, /&lt;unsafe&gt;/);
});

test('withdraw is only offered for a published lesson; editing works for every lesson', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  assert.equal(nodes['bf-companion-withdraw'].disabled, true, 'nothing selected');
  assert.equal(nodes['bf-companion-edit'].disabled, true, 'nothing selected');
  select(ctx, nodes, 'bf-companion-lesson-id', draftId);
  assert.equal(nodes['bf-companion-withdraw'].disabled, true);
  assert.equal(nodes['bf-companion-edit'].disabled, false);
  assert.match(nodes['bf-companion-status'].textContent, /Edit Pendamping Bunpou/);
  await ctx.bfCompanionWithdraw();
  assert.equal(writes(state).length, 0, 'an unpublished lesson cannot be withdrawn even if the button is forced');
  ctx.bfCompanionEdit('bf-companion-lesson-id');
  assert.deepEqual(state.edits, [[draftId, 'Hobi']]);
  select(ctx, nodes, 'bf-companion-lesson-id', staleId);
  assert.equal(nodes['bf-companion-withdraw'].disabled, false, 'a published but not-live lesson can still be withdrawn');
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  assert.equal(nodes['bf-companion-withdraw'].disabled, false);
  assert.equal(nodes['bf-companion-status'].textContent, 'Tampil ke siswa');
});

test('withdrawing asks first, sends an explicit confirm, then reloads the statuses', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  state.confirmAnswer = false;
  await ctx.bfCompanionWithdraw();
  assert.equal(writes(state).length, 0, 'cancelled confirmation writes nothing');
  assert.match(state.confirms[0], /Perkenalan[\s\S]*berhenti tampil ke siswa[\s\S]*Draft tetap tersimpan/);
  state.confirmAnswer = true;
  state.data = { lessons: fixture().lessons.map(lesson => lesson.id === liveId
    ? { ...lesson, published: false, live: false, reason: 'Pendamping belum dipublikasikan' } : lesson) };
  await ctx.bfCompanionWithdraw();
  assert.deepEqual(writes(state).map(call => [call.path, JSON.parse(call.options.body)]),
    [[`/admin/lessons/${liveId}/bunpou-flow/unpublish`, { confirm: true }]]);
  assert.match(state.notices.at(-1).message, /Publikasi ditarik/);
  assert.equal(nodes['bf-companion-lesson-id'].value, liveId, 'selection survives the reload');
  assert.equal(nodes['bf-companion-withdraw'].disabled, true);
  assert.equal(nodes['bf-companion-live'].textContent, 'Belum ada Pendamping Bunpou yang tampil ke siswa.');
});

test('a failed withdraw is reported and leaves the controls usable', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  state.write = () => { throw new Error('offline'); };
  await ctx.bfCompanionWithdraw();
  assert.ok(state.notices.some(notice => notice.error && /Gagal menarik publikasi/.test(notice.message)));
  assert.equal(nodes['bf-companion-withdraw'].disabled, false);
});

test('a pending withdraw locks the controls and rejects duplicate requests', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  let release;
  state.write = () => new Promise(resolve => { release = resolve; });
  const pending = ctx.bfCompanionWithdraw();
  await ctx.bfCompanionWithdraw();
  await ctx.bfCompanionLoadOptions();
  assert.equal(writes(state).length, 1);
  assert.equal(nodes['bf-companion-lesson-id'].disabled, true);
  assert.equal(nodes['bf-companion-withdraw'].disabled, true);
  release({ ok: true });
  await pending;
  assert.equal(nodes['bf-companion-lesson-id'].disabled, false);
});

test('failed or malformed GET keeps every action disabled', async () => {
  for (const data of [null, {}, { lessons: 'x' }, { lessons: [{ id: liveId, title: 'Bad', live: 'true', published: true }] },
    { lessons: [{ id: liveId, title: 'Bad', live: true }] }]) {
    const { ctx, nodes, state } = setup();
    state.data = data;
    await ctx.bfCompanionLoadOptions();
    await ctx.bfCompanionWithdraw();
    await ctx.msShadowRun();
    assert.equal(writes(state).length, 0);
    assert.equal(nodes['bf-companion-withdraw'].disabled, true);
    assert.equal(nodes['bf-companion-edit'].disabled, true);
    assert.equal(nodes['ms-shadow-run'].disabled, true);
    assert.equal(nodes['bf-companion-reload'].disabled, false);
    assert.match(nodes['bf-companion-status'].textContent, /gagal dimuat/);
  }
});

test('a failed refresh keeps actions disabled until a retry succeeds', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  state.error = new Error('offline');
  await ctx.bfCompanionLoadOptions();
  await ctx.bfCompanionWithdraw();
  assert.equal(writes(state).length, 0);
  assert.equal(nodes['bf-companion-withdraw'].disabled, true);
  state.error = null;
  await ctx.bfCompanionLoadOptions();
  assert.equal(nodes['bf-companion-lesson-id'].value, liveId);
  assert.equal(nodes['bf-companion-withdraw'].disabled, false);
});

test('shadow can compare a lesson that is not live', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  assert.equal(nodes['ms-shadow-run'].disabled, true);
  select(ctx, nodes, 'ms-shadow-lesson', staleId);
  await ctx.msShadowRun();
  assert.ok(state.calls.some(call => call.path === '/admin/grammar-mastery/shadow?lessonId=' + staleId));
  assert.equal(nodes['ms-shadow-run'].disabled, false);
  assert.match(nodes['ms-shadow-status'].textContent, /belum tampil/);
});

test('empty catalog does not auto-select a lesson or enable any action', async () => {
  const { ctx, nodes, state } = setup();
  state.data = { lessons: [] };
  await ctx.bfCompanionLoadOptions();
  assert.equal(nodes['bf-companion-lesson-id'].value, '');
  assert.equal(nodes['bf-companion-withdraw'].disabled, true);
  assert.equal(nodes['ms-shadow-run'].disabled, true);
  assert.match(nodes['bf-companion-status'].textContent, /Belum ada/);
});

test('both shortcuts open the selected companion with its title, including lessons that are not live', async () => {
  const { ctx, nodes, state } = setup();
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'bf-companion-lesson-id', liveId);
  ctx.bfCompanionEdit('bf-companion-lesson-id');
  select(ctx, nodes, 'ms-shadow-lesson', staleId);
  ctx.bfCompanionEdit('ms-shadow-lesson');
  assert.deepEqual(state.edits, [[liveId, 'Perkenalan'], [staleId, 'Waktu']]);
});

test('out-of-order refreshes cannot replace the most recently loaded statuses', async () => {
  const { ctx, nodes, state } = setup();
  let release;
  state.load = () => new Promise(resolve => { release = resolve; });
  const earlier = ctx.bfCompanionLoadOptions();
  state.load = null;
  state.data = { lessons: [] };
  await ctx.bfCompanionLoadOptions();
  release(fixture());
  await earlier;
  assert.match(nodes['bf-companion-status'].textContent, /Belum ada pelajaran Bunpou/);
  assert.equal(nodes['bf-companion-live'].textContent, 'Belum ada Pendamping Bunpou yang tampil ke siswa.');
});

test('companion draft and publish saves send the fingerprint captured at preview', async () => {
  const { ctx, nodes, state } = setup();
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, 'Perkenalan');
  state.detail.currentFingerprint = 'source-edited-later';
  nodes['bf-objective'].value = 'Tujuan';
  assert.equal(ctx.bfCollectEnvelope().sourceFingerprint, 'source-at-preview');
  await ctx.bfSaveDraft();
  nodes['bf-reviewed'].checked = true;
  await ctx.bfPublish();
  const drafts = writes(state).filter(call => call.path.endsWith('/draft'));
  assert.equal(drafts.length, 2);
  for (const draft of drafts) assert.equal(JSON.parse(draft.options.body).sourceFingerprint, 'source-at-preview');
  assert.equal(writes(state).filter(call => call.path.endsWith('/publish')).length, 1);
  assert.deepEqual(JSON.parse(writes(state).find(call => call.path.endsWith('/publish')).options.body),
    { confirm: true, draftRevision: 'newly-saved-draft' });
  assert.ok(state.calls.some(call => call.path === '/admin/bunpou-flow/lessons'), 'statuses refresh after publish');
});

test('publish tells the admin whether the companion is actually showing to students', async () => {
  for (const [result, pattern, isError] of [
    [{ ok: true, live: true, liveReason: null }, /dipublikasikan dan langsung tampil ke siswa/, undefined],
    [{ ok: true, live: false, liveReason: 'Video belum terhubung' }, /BELUM tampil ke siswa: Video belum terhubung/, true],
  ]) {
    const { ctx, nodes, state } = setup();
    vm.runInContext(companionSource, ctx);
    await ctx.manageBunpouFlow(liveId, 'Perkenalan');
    nodes['bf-reviewed'].checked = true;
    state.publishResult = result;
    await ctx.bfPublish();
    assert.match(state.notices.at(-1).message, pattern);
    assert.equal(state.notices.at(-1).error, isError);
    assert.match(state.confirms.at(-1), /langsung tampil ke siswa/);
    assert.doesNotMatch(state.confirms.at(-1), /flag pilot/);
  }
});

test('publishing uses its own save revision and preserves the editor when another editor replaces that draft', async () => {
  const { ctx, nodes, state } = setup();
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, 'Perkenalan');
  nodes['bf-reviewed'].checked = true;
  nodes['bf-objective'].value = 'My reviewed objective';
  let currentRevision;
  state.write = (path, options) => {
    if (path.endsWith('/draft')) {
      assert.equal(JSON.parse(options.body).sourceFingerprint, 'source-at-preview');
      currentRevision = 'another-editors-new-draft';
      return { ok: true, draftRevision: 'my-saved-draft' };
    }
    assert.deepEqual(JSON.parse(options.body), { confirm: true, draftRevision: 'my-saved-draft' });
    assert.notEqual(JSON.parse(options.body).draftRevision, currentRevision);
    throw new Error('Draft diganti editor lain. Tinjau ulang sebelum publikasi.');
  };
  await ctx.bfPublish();
  assert.equal(writes(state).length, 2, 'no automatic retry can overwrite another editor');
  assert.equal(state.closed, 0);
  assert.equal(nodes['bf-objective'].value, 'My reviewed objective');
  assert.match(state.notices.at(-1).message, /Draft diganti editor lain/);
  assert.ok(state.notices.every(notice => notice.error));
});

test('missing or invalid save revision blocks publish without falling back to the GET revision or source fingerprint', async () => {
  for (const draftRevision of [undefined, null, '', '   ', 123]) {
    const { ctx, nodes, state } = setup();
    vm.runInContext(companionSource, ctx);
    await ctx.manageBunpouFlow(liveId, 'Perkenalan');
    nodes['bf-reviewed'].checked = true;
    state.write = () => ({ ok: true, draftRevision });
    await ctx.bfPublish();
    assert.equal(writes(state).length, 1);
    assert.ok(writes(state)[0].path.endsWith('/draft'));
    assert.equal(state.closed, 0);
    assert.match(state.notices.at(-1).message, /Revisi draft tidak tersedia/);
  }
});

test('stale source rejection keeps the companion editor open and never publishes', async () => {
  const { ctx, nodes, state } = setup();
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, 'Perkenalan');
  state.write = () => { throw new Error('source_fingerprint_mismatch'); };
  await ctx.bfSaveDraft();
  nodes['bf-reviewed'].checked = true;
  await ctx.bfPublish();
  assert.equal(state.closed, 0);
  assert.ok(writes(state).every(call => call.path.endsWith('/draft')));
  assert.ok(state.notices.every(notice => notice.error));
});

function reviewItem() {
  return {
    grammarId: 'g1', pattern: 'Pattern A', meaning: 'Source meaning',
    dialog: 'A: First line\nB: Second line', dialogTranslation: 'Dialog translation', instruction: 'Source instruction',
    step1: { prompt: 'Recognition prompt', example: { japanese: 'Example sentence', indonesian: 'Example meaning' },
      options: ['Wrong meaning', 'Correct meaning', 'Another meaning'], correctIndex: 1 },
    step2: { variant: 'arrange', prompt: 'Arrange prompt', tokens: ['three', 'one', 'two'],
      answer: ['one', 'two', 'three'], japanese: 'Full correct sentence', indonesian: 'Sentence meaning' },
  };
}

test('companion preview captures reviewItems and shows per-pattern source and private drill answers', async () => {
  const { ctx, state } = setup();
  const item = reviewItem();
  state.detail = { ...state.detail, grammarIds: ['g1', 'g2'], patterns: { g1: 'Pattern A', g2: 'Pattern B' },
    reviewItems: [{ ...item, grammarId: 'g2', dialog: 'Second pattern dialog' }, item] };
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, 'Perkenalan');
  assert.equal(ctx.__bfCtx.reviewItems, state.detail.reviewItems);
  assert.match(state.modal, /<details[^>]*>\s*<summary>Tinjau sumber/);
  assert.match(state.modal, /Pattern A[\s\S]*A: First line\nB: Second line[\s\S]*Pattern B[\s\S]*Second pattern dialog/);
  for (const text of ['Source meaning', 'Dialog translation', 'Source instruction', 'Recognition prompt',
    'Example sentence', 'Example meaning', 'Wrong meaning', 'Another meaning', 'Arrange prompt',
    'three', 'one', 'two', 'Full correct sentence', 'Sentence meaning']) assert.ok(state.modal.includes(text), text);
  assert.match(state.modal, /Correct meaning <strong>\(benar\)<\/strong>/);
  assert.match(state.modal, /Jawaban benar:<\/strong> 2\. Correct meaning/);
  assert.match(state.modal, /Urutan benar:<\/strong> one \| two \| three/);
  assert.doesNotMatch(JSON.stringify(ctx.bfCollectEnvelope()), /reviewItems|Correct meaning|Full correct sentence/);
});

test('controlled choice preview shows the blanked sentence and handles absent drills without inventing answers', () => {
  const { ctx } = setup();
  vm.runInContext(companionSource, ctx);
  const preview = ctx.bfReviewDrill('Step 2', { variant: 'choice', prompt: 'Complete', sentence: 'A ___ B',
    indonesian: 'Translation', options: ['first', 'second'], correctIndex: 0 });
  assert.match(preview, /A ___ B/);
  assert.match(preview, /Translation/);
  assert.match(preview, /Jawaban benar:<\/strong> 1\. first/);
  assert.match(ctx.bfSourcePreview(), /Pratinjau sumber dan soal belum tersedia/);
  assert.match(ctx.bfReviewDrill('Step 1', null), /Soal belum tersedia/);
  assert.match(ctx.bfReviewDrill('Step 1', { options: ['first'], correctIndex: 9 }), /Jawaban benar:<\/strong> Belum tersedia/);
});

test('source and drill previews escape every text field, option, token and answer against XSS', async () => {
  const { ctx, state } = setup();
  const attack = '\"><img src=x onerror="alert(1)"></textarea><script>alert(2)</script>&';
  const item = Object.fromEntries(['grammarId', 'pattern', 'meaning', 'dialog', 'dialogTranslation', 'instruction'].map(key => [key, attack]));
  item.step1 = { prompt: attack, example: { japanese: attack, indonesian: attack }, sentence: attack,
    indonesian: attack, options: [attack, 'safe'], correctIndex: 0 };
  item.step2 = { variant: 'arrange', prompt: attack, tokens: [attack], answer: [attack], japanese: attack, indonesian: attack };
  state.detail = { ...state.detail, grammarIds: [attack], patterns: { [attack]: attack }, reviewItems: [item] };
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, attack);
  assert.doesNotMatch(state.modal, /<img|<script>|id="[^"\n]*"><img/);
  assert.ok(state.modal.includes(escapeHtml(attack)));
  const preview = ctx.bfSourcePreview(item);
  assert.doesNotMatch(preview, /<img|<script>|<textarea|<\/textarea>/);
  assert.equal(preview.split(escapeHtml(attack)).length - 1, 17, 'all source and drill values are escaped, including repeated answer keys');
});

test('publish requires explicit review acknowledgment while saving a draft stays available', async () => {
  const { ctx, state } = setup();
  vm.runInContext(companionSource, ctx);
  await ctx.manageBunpouFlow(liveId, 'Perkenalan');
  assert.match(state.modal, /<input id="bf-reviewed" type="checkbox" \/>/);
  await ctx.bfPublish();
  assert.equal(writes(state).length, 0);
  assert.match(state.notices.at(-1).message, /Konfirmasi tinjauan/);
  await ctx.bfSaveDraft();
  assert.equal(writes(state).length, 1);
});

test('shadow separates eligible independent production passes from all production passes', async () => {
  const { ctx, nodes, state } = setup();
  state.shadow = { samples: [{ productionPasses: 2, totalProductionPasses: 7 }] };
  await ctx.bfCompanionLoadOptions();
  select(ctx, nodes, 'ms-shadow-lesson', liveId);
  await ctx.msShadowRun();
  assert.match(nodes['ms-shadow-out'].innerHTML, /2 produksi lulus mandiri yang memenuhi syarat/);
  assert.match(nodes['ms-shadow-out'].innerHTML, /7 total produksi lulus/);
  delete state.shadow.samples[0].totalProductionPasses;
  await ctx.msShadowRun();
  assert.doesNotMatch(nodes['ms-shadow-out'].innerHTML, /total produksi lulus/);
});
