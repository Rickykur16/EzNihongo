import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describeLegacyStaffAccess, STAFF_TAB_CAPABILITIES } from './staff-capabilities.js';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from);
  return html.slice(from, to);
};
const source = [
  slice('let CURRENT_USER = null;', 'function el(html)'),
  slice('// Staff discovery is separate', '\nbootAdmin();'),
  slice('function renderApp()', '// LIVE CLASS —'),
  slice('async function loadCourses()', 'function renderCourses()'),
  slice('async function loadVideoSources()', 'function renderModules()'),
].join('\n');

function setup({ user = { isAdmin: true, fullName: 'Local admin' }, status = 200, access = describeLegacyStaffAccess(true) } = {}) {
  const calls = [], rendered = [], notices = [];
  const panes = Object.fromEntries(Object.keys(STAFF_TAB_CAPABILITIES).map(tab => [tab, {
    dataset: { pane: tab }, innerHTML: '', classList: { toggle() {} },
  }]));
  const buttons = Object.keys(panes).map(tab => ({ dataset: { tab }, classList: { toggle() {} }, addEventListener() {} }));
  const state = { status, access, user, courseFailure: false, videoFailure: false, delayCourses: null, delayAccess: null, lock: '', login: false };
  const ctx = vm.createContext({
    root: { innerHTML: '', querySelector: () => ({ appendChild() {} }) },
    document: { querySelectorAll: selector => selector === 'nav.tabs button' ? buttons : Object.values(panes),
      querySelector: selector => panes[selector.match(/data-pane="([^"]+)"/)[1]] },
    ezGetMe: async () => state.user,
    ezApi: async path => {
      calls.push(path);
      const response = { status: state.status, ok: state.status === 200, json: async () => state.access };
      if (state.delayAccess) await state.delayAccess;
      return response;
    },
    api: async path => {
      calls.push(path);
      if (path === '/admin/courses') {
        if (state.delayCourses) await state.delayCourses;
        if (state.courseFailure) throw new Error('unavailable');
        return { courses: [] };
      }
      if (path === '/admin/video-sources') {
        if (state.videoFailure) throw new Error('unavailable');
        return { sources: [] };
      }
      throw new Error('Unexpected path: ' + path);
    },
    showLock: message => { state.lock = message; }, showLogin: () => { state.login = true; },
    el: value => value, escapeHtml: value => String(value),
    notify: message => notices.push(message), console: { warn() {} },
    loadSensei: async () => {}, renderSenseiList: () => rendered.push('sensei'),
    loadTestimonials: async () => {}, renderTestimonials: () => rendered.push('testimonials'),
    loadUsers: async () => {}, renderUsers: () => rendered.push('users'),
    renderAccess: () => rendered.push('access'), renderOrders: () => rendered.push('orders'),
    loadDiscussions: async () => {}, renderDiscussions: () => rendered.push('discussions'),
    renderTtsCachePane: () => rendered.push('tts'),
    loadLiveClasses: async () => {}, renderLiveClasses: () => rendered.push('live'),
    renderAiSettings: () => rendered.push('ai'), renderCourses: () => rendered.push('courses'),
    renderModules: () => rendered.push('modules'), renderLessons: () => rendered.push('lessons'),
  });
  vm.runInContext(source, ctx);
  return { ctx, state, calls, rendered, panes, buttons, boot: () => ctx.bootAdmin(), tab: name => ctx.switchTab(name) };
}

test('browser tab capability mapping matches the server catalogue', () => {
  const f = setup();
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(ADMIN_TAB_CAPABILITIES)', f.ctx)), STAFF_TAB_CAPABILITIES);
});

test('legacy admin boots with every menu and loads courses but not video sources', async () => {
  const f = setup(); await f.boot();
  assert.deepEqual(f.calls, ['/staff/capabilities', '/admin/courses']);
  assert.deepEqual(f.rendered, ['courses']);
  assert.ok(f.buttons.every(button => !button.hidden));
});

test('anonymous sessions stay local; students only discover access and never load admin data', async () => {
  for (const user of [null, { isAdmin: false }]) {
    const f = setup({ user }); await f.boot();
    assert.deepEqual(f.calls, user ? ['/staff/capabilities'] : []);
    assert.equal(f.rendered.length, 0);
    assert.ok(f.state.login || f.state.lock);
  }
});

test('limited staff requires explicit RBAC discovery and cannot use legacy fallback', async () => {
  const user={isAdmin:false};
  const access={version:1,authorizationMode:'company-rbac-v1',isAdmin:false,isStaff:true,tabs:['orders'],capabilities:['orders.review']};
  const f=setup({user,access});await f.boot();assert.deepEqual(f.rendered,['orders']);
  const old=setup({user,status:404});await old.boot();assert.equal(old.rendered.length,0);
});

test('only 404 permits verified legacy-admin fallback during an old-backend rollout', async () => {
  const old = setup({ status: 404 }); await old.boot();
  assert.deepEqual(old.rendered, ['courses']);
  for (const status of [401, 403, 500, 503]) {
    const f = setup({ status }); await f.boot();
    assert.deepEqual(f.calls, ['/staff/capabilities']);
    assert.equal(f.rendered.length, 0);
    assert.match(f.state.lock, /belum dapat diverifikasi/);
  }
});

test('invalid or unsupported discovery responses never open the panel', async () => {
  const good = describeLegacyStaffAccess(true);
  for (const access of [null, {}, { ...good, version: 2 }, { ...good, isStaff: false },
    { ...good, isAdmin: false }, { ...good, authorizationMode: 'rbac' },
    { ...good, tabs: ['__proto__'] }, { ...good, capabilities: [] }, { ...good, tabs: [] }]) {
    const f = setup({ access }); await f.boot();
    assert.equal(f.rendered.length, 0);
    assert.equal(f.calls.length, 1);
    assert.ok(f.state.lock);
  }
});

test('menu-filter fixture chooses its first allowed tab without prefetching curriculum', async () => {
  // Synthetic navigation fixture, not an enabled Finance-only production role.
  const f = setup({ access: { ...describeLegacyStaffAccess(true), tabs: ['orders'], capabilities: ['orders.review'] } });
  await f.boot(); await f.tab('courses'); await f.tab('unknown');
  assert.deepEqual(f.calls, ['/staff/capabilities']);
  assert.deepEqual(f.rendered, ['orders']);
  assert.equal(f.buttons.filter(button => !button.hidden).length, 1);
});

test('prerequisites load lazily once and survive normal tab switches', async () => {
  const f = setup(); await f.boot();
  for (const tab of ['orders', 'modules', 'lessons', 'live', 'testimonials', 'lessons']) await f.tab(tab);
  assert.deepEqual(f.calls, ['/staff/capabilities', '/admin/courses', '/admin/video-sources']);
  assert.equal(f.rendered.filter(tab => tab === 'lessons').length, 2);
});

test('failed course prerequisites show retry, then load again without caching a failure', async () => {
  const f = setup(); f.state.courseFailure = true; await f.boot();
  assert.match(f.panes.courses.innerHTML, /Coba lagi/);
  assert.equal(f.rendered.length, 0);
  f.state.courseFailure = false; await f.tab('courses');
  assert.deepEqual(f.rendered, ['courses']);
  assert.equal(f.calls.filter(path => path === '/admin/courses').length, 2);
});

test('video-source failure keeps the legacy lesson editor reachable and can retry later', async () => {
  const f = setup(); await f.boot(); f.state.videoFailure = true;
  await f.tab('lessons');
  assert.equal(f.rendered.at(-1), 'lessons');
  f.state.videoFailure = false; await f.tab('lessons');
  assert.equal(f.calls.filter(path => path === '/admin/video-sources').length, 2);
});

test('slow earlier tab loading cannot repaint over a newer selection', async () => {
  const f = setup(); await f.boot();
  vm.runInContext('adminDataLoads = new Map()', f.ctx);
  let release;
  f.state.delayCourses = new Promise(resolve => { release = resolve; });
  const slow = f.tab('modules');
  await f.tab('orders'); release(); await slow;
  assert.equal(f.rendered.at(-1), 'orders');
  assert.ok(!f.rendered.includes('modules'));
});

test('discovery failure can be retried without persisting capability grants', async () => {
  const f = setup({ status: 503 }); await f.boot();
  assert.equal(vm.runInContext('STAFF_ACCESS', f.ctx), null);
  f.state.status = 200; await f.boot();
  assert.deepEqual(f.rendered, ['courses']);
});

test('an older successful boot cannot reopen menus after a newer denied boot', async () => {
  const f = setup();
  let release;
  f.state.delayAccess = new Promise(resolve => { release = resolve; });
  const earlier = f.boot();
  await Promise.resolve(); // First boot has reached discovery.
  f.state.delayAccess = null; f.state.status = 403;
  await f.boot(); release(); await earlier;
  assert.equal(f.rendered.length, 0);
  assert.equal(vm.runInContext('STAFF_ACCESS', f.ctx), null);
});
