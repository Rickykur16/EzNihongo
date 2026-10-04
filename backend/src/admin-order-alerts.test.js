import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Menjalankan kode ASLI "NOTIFIKASI PESANAN" dari admin.html (vm-slice, pola
// sama dengan admin-boot.test.js), bukan reimplementasi.
const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `slice not found: ${start}`);
  return html.slice(from, to);
};
const source = slice('// NOTIFIKASI PESANAN', 'function bankAccountsCardHtml()');

const order = (id, status, activityAt, extra = {}) => ({
  id, orderNumber: 'EZN-' + id, status, activityAt, createdAt: activityAt, courseTitle: 'Kelas Uji',
  amountIdr: 150000, user: { fullName: 'Siswa ' + id, email: id + '@x.test' }, ...extra,
});

function setup({ canOpen = true, tab = 'home' } = {}) {
  const storage = new Map(), toasts = [], calls = [], switched = [], details = [];
  const state = { summary: { awaitingReview: 0, pendingPayment: 0, recent: [] }, fail: false };
  const makeTarget = (tagName = 'BUTTON') => {
    const node = { tagName, children: [], lastElementChild: { marker: '›' },
      appendChild(c) { this.children.push(c); }, insertBefore(c) { this.children.push(c); },
      querySelector() { const b = this.children.find(c => c.className?.startsWith('ws-badge')); return b ? { remove: () => { this.children.splice(this.children.indexOf(b), 1); } } : null; },
    };
    return node;
  };
  const targets = {
    '#workspace-nav [data-tab="orders"]': makeTarget(),
    '#workspace-nav details[data-group="finance"] > summary': makeTarget('SUMMARY'),
    '#workspace-menu-toggle': makeTarget(),
  };
  const slot = { innerHTML: '', querySelectorAll: () => [] };
  const document = { title: 'Ruang Kerja · EzNihongo', hidden: false, addEventListener() {}, removeEventListener() {},
    createElement: () => ({ className: '', textContent: '', title: '' }) };
  const ctx = vm.createContext({
    document, window: {}, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
    root: { querySelector: sel => (sel === '#order-alert-slot' ? slot : targets[sel] || null), querySelectorAll: () => [] },
    modal: { classList: { contains: () => false } },
    CURRENT_USER: { id: 'admin-1' }, STATE: { tab, ordersStatus: 'awaiting_review' },
    adminBootRequest: 1, adminTabRequest: 0,
    canOpenAdminTab: t => canOpen && t === 'orders',
    api: async path => { calls.push(path); if (state.fail) throw new Error('offline'); return JSON.parse(JSON.stringify(state.summary)); },
    notify: (msg, isErr, isWarn) => { const t = { msg, isWarn, title: '', listeners: [], addEventListener(_e, fn) { this.listeners.push(fn); } }; toasts.push(t); return t; },
    switchTab: async t => { switched.push(t); ctx.STATE.tab = t; ctx.adminTabRequest++; },
    openOrderDetail: async id => { details.push(id); },
    formatIdr: n => 'Rp ' + n, escapeHtml: v => String(v),
    setInterval: () => 1, clearInterval: () => {}, Date, Number, Set, Promise,
  });
  vm.runInContext(`const ORDER_WATCH_INTERVAL_MS = 60000; const WORKSPACE_TITLE = document.title; let orderWatch = null;\n${source}`, ctx);
  const badge = key => targets[key].children[0];
  return { ctx, state, toasts, calls, switched, details, slot, storage, document, badge, targets };
}

test('first load in a browser marks existing orders as known: badge counts, no toast flood', async () => {
  const t = setup();
  t.state.summary = { awaitingReview: 1, pendingPayment: 1, recent: [order('a', 'awaiting_review', '2026-10-04T01:00:00Z'), order('b', 'pending_payment', '2026-10-04T00:00:00Z')] };
  t.ctx.startOrderWatch(); await t.ctx.refreshOrderSummary();
  assert.equal(t.toasts.length, 0);
  assert.equal(t.storage.get('ez_admin_orders_seen_at:admin-1'), '2026-10-04T01:00:00Z');
  const nav = t.badge('#workspace-nav [data-tab="orders"]');
  assert.equal(nav.textContent, '2');
  assert.match(nav.className, /is-urgent/, 'bukti menunggu verifikasi = merah');
  assert.equal(t.badge('#workspace-menu-toggle').textContent, '2', 'tombol menu HP ikut ber-badge');
  assert.equal(t.document.title, 'Ruang Kerja · EzNihongo');
});

test('a new order and a new proof each toast once, with title count; clicking opens that order', async () => {
  const t = setup();
  t.state.summary = { awaitingReview: 0, pendingPayment: 0, recent: [] };
  t.storage.set('ez_admin_orders_seen_at:admin-1', '2026-10-04T00:00:00Z');
  t.ctx.startOrderWatch(); await t.ctx.refreshOrderSummary();
  assert.equal(t.badge('#workspace-nav [data-tab="orders"]'), undefined, 'tanpa pesanan aktif tidak ada badge');

  t.state.summary = { awaitingReview: 0, pendingPayment: 1, recent: [order('n1', 'pending_payment', '2026-10-04T02:00:00Z')] };
  await t.ctx.refreshOrderSummary();
  assert.equal(t.toasts.length, 1);
  assert.match(t.toasts[0].msg, /^Pesanan baru — EZN-n1 · Siswa n1 · Kelas Uji \(Rp 150000\)/);
  assert.doesNotMatch(t.badge('#workspace-nav [data-tab="orders"]').className, /is-urgent/, 'menunggu transfer bukan merah');
  assert.equal(t.document.title, '(1) Ruang Kerja · EzNihongo');

  await t.ctx.refreshOrderSummary();
  assert.equal(t.toasts.length, 1, 'aktivitas yang sama tidak di-toast ulang tiap polling');

  t.state.summary = { awaitingReview: 1, pendingPayment: 0, recent: [order('n1', 'awaiting_review', '2026-10-04T03:00:00Z')] };
  await t.ctx.refreshOrderSummary();
  assert.equal(t.toasts.length, 2);
  assert.match(t.toasts[1].msg, /^Bukti transfer masuk — EZN-n1/);

  t.toasts[1].listeners.forEach(fn => fn());
  await new Promise(r => setImmediate(r));
  assert.deepEqual(t.switched, ['orders']);
  assert.equal(t.ctx.STATE.ordersStatus, 'awaiting_review', 'filter mengikuti status pesanan yang diklik');
  assert.deepEqual(t.details, ['n1']);
});

test('opening Pesanan marks activity seen; reload afterwards stays quiet', async () => {
  const t = setup();
  t.storage.set('ez_admin_orders_seen_at:admin-1', '2026-10-04T00:00:00Z');
  t.state.summary = { awaitingReview: 1, pendingPayment: 0, recent: [order('x', 'awaiting_review', '2026-10-04T05:00:00Z')] };
  t.ctx.startOrderWatch(); await t.ctx.refreshOrderSummary();
  assert.match(t.toasts[0].msg, /^Ada 1 aktivitas pesanan baru/, 'saat halaman dibuka: satu ringkasan, bukan per pesanan');
  t.ctx.markOrdersSeen();
  assert.equal(t.document.title, 'Ruang Kerja · EzNihongo');
  assert.equal(t.badge('#workspace-nav [data-tab="orders"]').textContent, '1', 'badge tetap menghitung yang masih perlu diverifikasi');

  const again = setup();
  again.storage.set('ez_admin_orders_seen_at:admin-1', t.storage.get('ez_admin_orders_seen_at:admin-1'));
  again.state.summary = t.state.summary;
  again.ctx.startOrderWatch(); await again.ctx.refreshOrderSummary();
  assert.equal(again.toasts.length, 0);
});

test('network failure is silent; staff without the orders menu never polls', async () => {
  const t = setup();
  t.state.fail = true;
  t.ctx.startOrderWatch(); await t.ctx.refreshOrderSummary();
  assert.equal(t.toasts.length, 0);

  const staff = setup({ canOpen: false });
  staff.ctx.startOrderWatch(); await staff.ctx.refreshOrderSummary();
  assert.deepEqual(staff.calls, []);
});
