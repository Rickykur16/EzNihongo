import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../src/conversation-steps.js', import.meta.url), 'utf8');
function button() {
  return { disabled: false, hidden: true, listeners: [],
    addEventListener(_type, handler) { this.listeners.push(handler); },
    click() { if (!this.disabled) this.listeners.forEach(handler => handler()); } };
}
function fixture(count = 3) {
  const previous = button(), next = button(), navigation = { hidden: true },
    position = { textContent: '' }, complete = { hidden: false }, left = [], calls = [];
  const cards = Array.from({ length: count }, (_, index) => ({
    index, hidden: false, answer: `saved answer ${index}`,
    querySelector() { return { focus: options => calls.push(['focus', index, options.preventScroll]) }; },
    scrollIntoView: options => calls.push(['scroll', index, options.block]),
  }));
  const controls = { '[data-conversation-prev]': previous, '[data-conversation-next]': next,
    '[data-conversation-position]': position, '.conversation-step-nav': navigation };
  const host = { isConnected: true, querySelectorAll: () => cards, querySelector: selector => controls[selector] };
  const root = { querySelector: selector => selector === '.conversation-steps' ? host : complete };
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context);
  const mount = () => context.window.EzConversationSteps.mount(root, { onLeave: card => left.push(card.index) });
  mount();
  return { previous, next, navigation, position, complete, left, calls, cards, host, mount };
}
const visible = f => f.cards.filter(card => !card.hidden).map(card => card.index);

test('one full pattern at a time: previous/next preserve card state and expose completion only on the last pattern', () => {
  const f = fixture();
  assert.deepEqual(visible(f), [0]);
  assert.equal(f.position.textContent, 'Percakapan 1 dari 3');
  assert.equal(f.previous.disabled, true);
  assert.equal(f.complete.hidden, true);
  f.cards[0].answer = 'student selection';
  f.next.click();
  assert.deepEqual(visible(f), [1]);
  assert.deepEqual(f.left, [0], 'the outgoing player is stopped before its card is hidden');
  assert.equal(f.position.textContent, 'Percakapan 2 dari 3');
  assert.equal(f.complete.hidden, true);
  assert.deepEqual(f.calls, [['focus', 1, true], ['scroll', 1, 'start']]);
  f.next.click();
  assert.deepEqual(visible(f), [2]);
  assert.equal(f.next.disabled, true);
  assert.equal(f.complete.hidden, false);
  f.previous.click(); f.previous.click();
  assert.deepEqual(visible(f), [0]);
  assert.equal(f.cards[0].answer, 'student selection', 'back navigation keeps the same question DOM and answers');
  assert.equal(f.complete.hidden, true);
});

test('single or empty lessons do not create unusable navigation', () => {
  const one = fixture(1);
  assert.deepEqual(visible(one), [0]);
  assert.equal(one.navigation.hidden, true);
  assert.equal(one.complete.hidden, false);
  assert.equal(one.previous.disabled, true);
  assert.equal(one.next.disabled, true);
  const empty = fixture(0);
  assert.equal(empty.navigation.hidden, true);
  assert.equal(empty.complete.hidden, false);
});

test('mounting twice, leaving the page, and clicking a boundary cannot advance or stop another player', () => {
  const f = fixture(2);
  f.mount();
  assert.equal(f.next.listeners.length, 1);
  f.previous.click();
  assert.deepEqual(f.left, []);
  f.next.click(); f.next.click();
  assert.deepEqual(f.left, [0]);
  f.host.isConnected = false;
  f.previous.click();
  assert.deepEqual(visible(f), [1]);
  assert.deepEqual(f.left, [0]);
});
