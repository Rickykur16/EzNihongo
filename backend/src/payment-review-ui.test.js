import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const start = html.indexOf('window.openOrderDetail = async');
const end = html.indexOf('// DISCUSSIONS', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);

function setup() {
  const state = { modal: '', calls: [], notices: [], closed: 0, error: null };
  state.detail = {
    order: { id: 'order-1', orderNumber: 'TEST', status: 'awaiting_review', user: {} },
    payments: [{ id: 'proof-1', status: 'pending', hasProof: true }],
  };
  const ctx = vm.createContext({
    window: {},
    api: async (path, opts) => {
      if (!opts) return state.detail;
      state.calls.push({ path, body: JSON.parse(opts.body) });
      if (state.error) throw state.error;
      return { ok: true };
    },
    ezApi: async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) }),
    URL: { createObjectURL: () => 'blob:local-proof' },
    openModal: content => { state.modal = content; },
    closeModal: () => { state.closed++; },
    notify: message => state.notices.push(message),
    confirm: () => true,
    document: { getElementById: () => ({ value: ' Nominal salah ' }) },
    escapeHtml: value => String(value), orderStatusBadge: value => value,
    formatIdr: value => String(value), loadOrders: async () => {}, renderOrdersResult: () => {},
  });
  vm.runInContext(source, ctx);
  return { state, ui: ctx.window };
}

test('admin detail and both decisions keep the displayed payment ID', async () => {
  const { state, ui } = setup();
  await ui.openOrderDetail('order-1');
  assert.match(state.modal, /approveOrder\('order-1','proof-1'\)/);
  assert.match(state.modal, /rejectOrder\('order-1','proof-1'\)/);
  // A newer response elsewhere must not change the proof captured by the button.
  state.detail.payments.unshift({ id: 'proof-2', status: 'pending' });
  await ui.approveOrder('order-1', 'proof-1');
  await ui.rejectOrder('order-1', 'proof-1');
  assert.deepEqual(state.calls, [
    { path: '/admin/orders/order-1/approve', body: { paymentId: 'proof-1' } },
    { path: '/admin/orders/order-1/reject', body: { paymentId: 'proof-1', reason: 'Nominal salah' } },
  ]);
});

test('returning from a proof preview never enables review of its unseen replacement', async () => {
  const { state, ui } = setup();
  await ui.viewOrderProof('order-1', 'proof-1');
  assert.match(state.modal, /openOrderDetail\('order-1','proof-1'\)/);
  state.detail.payments = [{ id: 'proof-2', status: 'pending' }, { id: 'proof-1', status: 'superseded' }];
  await ui.openOrderDetail('order-1', 'proof-1');
  assert.doesNotMatch(state.modal, /onclick="(?:approveOrder|rejectOrder)/);
  assert.match(state.modal, /sudah berubah/);
  await ui.openOrderDetail('order-1');
  assert.match(state.modal, /approveOrder\('order-1','proof-2'\)/);
  state.detail.order.status = 'cancelled';
  await ui.openOrderDetail('order-1');
  assert.doesNotMatch(state.modal, /onclick="(?:approveOrder|rejectOrder)/);
});

test('a review conflict prompts a fresh review without reporting success or retrying', async () => {
  const { state, ui } = setup();
  state.error = Object.assign(new Error('payment_not_pending'), { body: { error: 'payment_not_pending' } });
  await ui.approveOrder('order-1', 'proof-1');
  await ui.rejectOrder('order-1', 'proof-1');
  assert.equal(state.calls.length, 2);
  assert.equal(state.closed, 0);
  assert.equal(state.notices.length, 2);
  assert.ok(state.notices.every(message => message.includes('periksa bukti terbaru')));
});
