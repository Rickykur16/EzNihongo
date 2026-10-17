import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const pagerSource = await readFile(new URL('../../src/bunpou-pattern-steps.js', import.meta.url), 'utf8');
const welcome = (await readFile(new URL('../../welcome.html', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const slice = (from, to) => welcome.slice(welcome.indexOf(from), welcome.indexOf(to, welcome.indexOf(from)));

function button() {
  return { disabled: false, hidden: true, listeners: [], addEventListener(_event, handler) { this.listeners.push(handler); },
    click() { if (!this.disabled) this.listeners.forEach(handler => handler()); } };
}
function fixture(count = 3) {
  const previous = button(), next = button(), position = {}, navigation = { hidden: true }, status = { hidden: true },
    complete = { hidden: false, disabled: true }, hint = {}, left = [], focused = [];
  let recording = false;
  const cards = Array.from({ length: count }, (_, index) => ({ index, hidden: false,
    textarea: { value: 'draft ' + index }, feedback: '',
    querySelector: () => ({ focus: () => focused.push(index) }), scrollIntoView() {} }));
  const controls = { '[data-gt-pattern-prev]': previous, '[data-gt-pattern-next]': next,
    '[data-gt-pattern-position]': position, '[data-gt-pattern-status]': status, '.gt-pattern-nav': navigation };
  const host = { isConnected: true, querySelectorAll: () => cards, querySelector: key => controls[key] };
  const root = { querySelector: key => ({ '.gt-pattern-steps': host, '#gt-complete-btn': complete, '#gt-progress-hint': hint })[key] };
  const ctx = vm.createContext({ window: { __gtState: { passed: {}, total: count, hasNext: true } }, _gtScope: () => root });
  vm.runInContext(pagerSource, ctx);
  vm.runInContext(slice('function gtUpdateComplete()', 'window.gtPlayExample ='), ctx);
  const mount = () => ctx.window.EzBunpouSteps.mount(root, { canLeave: () => !recording, onLeave: card => left.push(card.index) });
  mount(); ctx.gtUpdateComplete();
  return { cards, previous, next, position, navigation, status, complete, hint, host, ctx, left, focused, mount,
    setRecording: value => { recording = value; } };
}
const visible = f => f.cards.filter(card => !card.hidden).map(card => card.index);

test('one Bunpou pattern at a time retains drafts and late feedback without granting completion', async () => {
  const f = fixture();
  assert.deepEqual(visible(f), [0]);
  assert.equal(f.position.textContent, 'Pola 1 dari 3');
  f.cards[0].textarea.value = 'わたしは がくせいです。';
  let finish;
  const pending = new Promise(resolve => { finish = resolve; }).then(() => {
    f.cards[0].feedback = 'Benar'; f.ctx.window.__gtState.passed['0-0'] = true; f.ctx.gtUpdateComplete();
  });
  f.next.click();
  finish(); await pending;
  assert.deepEqual(visible(f), [1], 'late grading cannot switch the visible pattern');
  assert.equal(f.complete.disabled, true, 'one passed sentence cannot complete three required sentences');
  f.previous.click();
  assert.equal(f.cards[0].textarea.value, 'わたしは がくせいです。');
  assert.equal(f.cards[0].feedback, 'Benar');
  f.next.click(); f.next.click();
  assert.equal(f.complete.hidden, false);
  assert.equal(f.complete.disabled, true, 'visiting the last pattern does not pass the assignment');
  assert.match(f.hint.textContent, /1 \/ 3 kalimat selesai/);
  f.ctx.window.__gtState.passed = { '0-0': true, '1-0': true, '2-0': true };
  f.ctx.gtUpdateComplete();
  assert.equal(f.complete.disabled, false);
  assert.match(f.complete.textContent, /Tandai Selesai/);
});

test('recording/transcription prevents navigation; after it finishes navigation stops the outgoing example audio', () => {
  const f = fixture(2);
  f.setRecording(true); f.next.click();
  assert.deepEqual(visible(f), [0]);
  assert.deepEqual(f.left, []);
  assert.equal(f.status.hidden, false);
  f.setRecording(false); f.next.click();
  assert.deepEqual(visible(f), [1]);
  assert.deepEqual(f.left, [0]);
  assert.deepEqual(f.focused, [1]);
  assert.equal(f.status.hidden, true);
});

test('one/zero pattern, duplicate mount, detached page and navigation boundaries remain safe', () => {
  const one = fixture(1);
  assert.equal(one.navigation.hidden, true);
  assert.equal(one.complete.hidden, false);
  const empty = fixture(0);
  assert.equal(empty.navigation.hidden, true);
  const f = fixture(2);
  f.mount(); assert.equal(f.next.listeners.length, 1);
  f.previous.click(); assert.deepEqual(f.left, []);
  f.next.click(); f.next.click(); assert.deepEqual(f.left, [0]);
  f.host.isConnected = false; f.previous.click(); assert.deepEqual(visible(f), [1]);
});

for (const course of ['n5', 'n4']) test(`${course}: full page and popup mount the same pager and retain slot/grammar IDs`, () => {
  const calls = [], root = { innerHTML: '' }, overlay = { innerHTML: '', addEventListener() {} };
  const doc = { getElementById: () => root, querySelector: () => null,
    createElement: () => overlay, addEventListener() {}, body: { style: {}, appendChild() {} } };
  const ctx = vm.createContext({ currentState: { course }, document: doc, window: { EzBunpouSteps: { mount: (root, options) => calls.push({ root, options }) } },
    escapeHtml: value => String(value ?? ''), _gtSttSupported: () => false, GT_MIC_SVG: '',
    _findLessonByApiId: () => null, learningStepAction: () => '', gtUpdateComplete() {}, gtLoadDrills() {}, loadBunpouAnalysis() {},
    setTimeout() {}, setTutorHidden() {}, _stopAllTts: () => calls.push('stop-audio') });
  vm.runInContext('let _gtRec = null;', ctx);
  vm.runInContext(slice('function gtTotalRequired', '// Bangun HTML kartu'), ctx);
  vm.runInContext(slice('function gtCardsHtml', '// ── Step 1 & 2'), ctx);
  vm.runInContext(slice('function gtMountPatternSteps(', '// Tutup tanpa menyelesaikan'), ctx);
  const items = [{ id: 'g1', pattern: 'AはBです', requiredCount: 2 }, { id: 'g2', pattern: 'AもBです' }];
  const lesson = { apiId: 'task', title: 'Bunpou', grammarTask: items }, module = { num: '03', id: 'm', title: 'Perkenalan' };
  ctx.renderGrammarTaskLesson({ name: course }, module, lesson, {});
  assert.equal(calls[0].root, root);
  assert.match(root.innerHTML, /class="gt-pattern-steps"/);
  assert.match(root.innerHTML, /id="gt-input-0-1"/);
  assert.match(root.innerHTML, /id="gt-input-1-0"/);
  assert.match(root.innerHTML, /data-grammar-id="g2"/);
  const speech = ctx.gtCardsHtml(items, true, true);
  assert.match(speech, /id="gt-mic-0-1"/);
  assert.match(speech, /id="gt-input-0-1"[^>]*hidden/);
  assert.match(speech, /data-gt-pattern-next/);
  assert.equal(calls[0].options.canLeave(), true);
  vm.runInContext('_gtRec = {};', ctx);
  assert.equal(calls[0].options.canLeave(), false);
  vm.runInContext('_gtRec = null;', ctx);
  calls[0].options.onLeave(); assert.equal(calls[1], 'stop-audio');
  ctx.openGrammarTaskPopup({ name: course }, module, lesson);
  assert.equal(calls[2].root, overlay);
  assert.match(overlay.innerHTML, /data-gt-pattern-next/);
  assert.equal(ctx.gtTotalRequired(items), 3);
});
