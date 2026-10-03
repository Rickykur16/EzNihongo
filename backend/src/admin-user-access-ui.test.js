import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
function slice(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from);
  return html.slice(from, to);
}
function action(name) {
  const start = html.indexOf(`window.${name} =`);
  assert.ok(start > 0);
  return html.slice(start, html.indexOf('\n};', start) + 4);
}
const source = [
  slice('let _userActionDialog = null;', 'window.uaDropMarketing ='),
  ...['uaDropMarketing', 'uaEraseAccount', 'uaRevoke', 'revokeAccess'].map(action),
].join('\n');
const email = "test.o'brien@example.invalid";

class Element {
  constructor(tag, state) {
    this.tag = tag; this.state = state; this.listeners = new Map(); this.attributes = {};
    this.textContent = ''; this.hidden = false; this.disabled = false; this.isConnected = true;
  }
  set innerHTML(value) {
    this.html = value;
    this.parts = Object.fromEntries(['#user-action-title', '#user-action-message', '[data-confirm]', '[data-cancel]', '.user-action-error', '.user-action-status']
      .map(selector => [selector, new Element(selector, this.state)]));
  }
  querySelector(selector) { return this.parts[selector]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, props = {}) {
    const event = { ...props, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    const completed = Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    return { event, completed };
  }
  focus() { this.state.focused = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  remove() { this.removed = true; this.isConnected = false; }
}

function setup({ typedEmail = email, paid = false, acknowledged = false } = {}) {
  const state = { calls: [], notices: [], dialogs: [], refresh: [], closedParent: 0, usersReloaded: 0, failure: null, wait: null };
  const emailInput = new Element('input', state); emailInput.value = typedEmail;
  const ack = paid ? new Element('checkbox', state) : null;
  if (ack) ack.checked = acknowledged;
  const error = new Element('error', state); error.hidden = true;
  const previousFocus = new Element('parent-button', state);
  const context = vm.createContext({
    window: {},
    document: {
      activeElement: previousFocus,
      createElement: tag => new Element(tag, state),
      body: { appendChild: dialog => state.dialogs.push(dialog) },
      getElementById: id => ({ 'ua-erase-confirm': emailInput, 'ua-erase-ack-paid': ack, 'ua-erase-error': error })[id],
    },
    api: async (path, opts) => {
      state.calls.push({ path, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
      if (state.wait) await state.wait;
      if (state.failure) throw state.failure;
      return { ok: true, deleted: true };
    },
    notify: message => state.notices.push(message),
    refreshUserAccessModal: async target => state.refresh.push(['modal', target]),
    lookupAccess: async () => state.refresh.push(['access']),
    closeModal: () => state.closedParent++,
    loadUsers: async () => state.usersReloaded++, renderUsers() {}, STATE: { tab: 'users' },
    confirm: () => { throw new Error('Native confirmation must not be used'); },
  });
  vm.runInContext(source, context);
  return { state, context, ui: context.window, emailInput, ack, error, previousFocus,
    dialog: () => state.dialogs.at(-1), button: () => state.dialogs.at(-1).querySelector('[data-confirm]') };
}

test('cancelling or Escape sends no revoke request and preserves the parent modal', async () => {
  for (const name of ['uaRevoke', 'revokeAccess']) {
    for (const mode of ['cancel', 'escape']) {
      const f = setup();
      const pending = f.ui[name](email, 'course-1');
      assert.equal(f.state.calls.length, 0);
      if (mode === 'cancel') await f.dialog().querySelector('[data-cancel]').dispatch('click').completed;
      else {
        const key = f.dialog().dispatch('keydown', { key: 'Escape' });
        assert.equal(key.event.stopped, true, 'Escape must not reach the dirty parent modal');
        const cancel = f.dialog().dispatch('cancel');
        assert.equal(cancel.event.prevented, true);
      }
      await pending;
      assert.equal(f.state.calls.length, 0);
      assert.equal(f.state.closedParent, 0);
      assert.equal(f.emailInput.value, email);
      assert.equal(f.state.focused, f.previousFocus);
      assert.equal(f.dialog().removed, true);
    }
  }
});

test('both revoke entrypoints send the correct request only after explicit confirmation', async () => {
  for (const name of ['uaRevoke', 'revokeAccess']) {
    const f = setup(), pending = f.ui[name](email, 'course-1');
    assert.match(f.dialog().querySelector('#user-action-message').textContent, /test\.o'brien/);
    await f.button().dispatch('click').completed;
    await pending;
    assert.deepEqual(f.state.calls, [{ path: '/admin/user-access/revoke', method: 'POST', body: { email, courseId: 'course-1' } }]);
    assert.deepEqual(f.state.refresh, [name === 'uaRevoke' ? ['modal', email] : ['access']]);
    assert.equal(f.state.closedParent, 0);
  }
});

test('failed mutation stays visible and retries clear its error before submitting', async () => {
  const f = setup();
  f.state.failure = new Error('network unavailable');
  const pending = f.ui.uaRevoke(email, 'course-1');
  await f.button().dispatch('click').completed;
  const error = f.dialog().querySelector('.user-action-error');
  assert.equal(f.dialog().open, true);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /belum berhasil/);
  assert.equal(f.button().disabled, false);
  assert.equal(f.state.refresh.length, 0);
  assert.equal(f.state.notices.length, 0);
  f.state.failure = null;
  let finish; f.state.wait = new Promise(resolve => { finish = resolve; });
  const retry = f.button().dispatch('click');
  assert.equal(error.hidden, true);
  assert.equal(error.textContent, '');
  finish(); await retry.completed; await pending;
  assert.equal(f.state.calls.length, 2);
  assert.equal(f.state.notices.length, 1);
});

test('double clicks, duplicate dialogs and Escape while pending cannot duplicate a mutation', async () => {
  const f = setup();
  let finish; f.state.wait = new Promise(resolve => { finish = resolve; });
  const pending = f.ui.uaRevoke(email, 'course-1');
  const first = f.button().dispatch('click');
  await f.button().dispatch('click').completed;
  await f.ui.revokeAccess(email, 'course-1');
  assert.equal(f.state.dialogs.length, 1);
  assert.equal(f.state.calls.length, 1);
  assert.equal(f.button().disabled, true);
  assert.equal(f.dialog().querySelector('[data-cancel]').disabled, true);
  f.dialog().dispatch('cancel');
  assert.equal(f.dialog().open, true);
  finish(); await first.completed; await pending;
  assert.equal(f.state.calls.length, 1);
});

test('account erasure still requires matching email and paid-history acknowledgement', async () => {
  const f = setup({ typedEmail: 'wrong@example.invalid', paid: true });
  await f.ui.uaEraseAccount(email);
  assert.match(f.error.textContent, /Email konfirmasi tidak cocok/);
  assert.equal(f.error.hidden, false);
  assert.equal(f.state.dialogs.length, 0);
  f.emailInput.value = email;
  await f.ui.uaEraseAccount(email);
  assert.match(f.error.textContent, /Centang konfirmasi/);
  assert.equal(f.state.dialogs.length, 0);
  f.ack.checked = true;
  const pending = f.ui.uaEraseAccount(email);
  assert.equal(f.error.hidden, true);
  f.dialog().dispatch('cancel'); await pending;
  assert.equal(f.state.calls.length, 0);
  assert.equal(f.emailInput.value, email);
  assert.equal(f.ack.checked, true);
  assert.equal(f.state.closedParent, 0);
});

test('confirmed erasure sends encoded email and explicit acknowledgement, explaining retained history', async () => {
  const f = setup({ typedEmail: ' ' + email.toUpperCase() + ' ', paid: true, acknowledged: true });
  const pending = f.ui.uaEraseAccount(email);
  await f.button().dispatch('click').completed; await pending;
  assert.deepEqual(f.state.calls, [{ path: '/admin/users/' + encodeURIComponent(email) + '/erase', method: 'POST',
    body: { confirmEmail: email.toUpperCase(), acknowledgePaidHistory: true } }]);
  assert.equal(f.state.closedParent, 1);
  assert.equal(f.state.usersReloaded, 1);
  assert.match(f.state.notices[0], /Pengguna dihapus/);
  assert.match(f.state.notices[0], /catatan transaksi/);
});

test('erase errors remain in the confirmation dialog without losing the typed email', async () => {
  const f = setup(); f.state.failure = new Error('cannot_erase_self');
  const pending = f.ui.uaEraseAccount(email);
  await f.button().dispatch('click').completed;
  assert.match(f.dialog().querySelector('.user-action-error').textContent, /sedang kamu pakai/);
  assert.equal(f.emailInput.value, email);
  assert.equal(f.state.closedParent, 0);
  assert.equal(f.state.notices.length, 0);
  f.dialog().dispatch('cancel'); await pending;
});

test('marketing withdrawal requires its own confirmation and does not erase the account', async () => {
  const f = setup(), cancelled = f.ui.uaDropMarketing(email);
  f.dialog().dispatch('cancel'); await cancelled;
  assert.equal(f.state.calls.length, 0);
  const confirmed = f.ui.uaDropMarketing(email);
  await f.button().dispatch('click').completed; await confirmed;
  assert.deepEqual(f.state.calls, [{ path: '/admin/users/' + encodeURIComponent(email) + '/marketing-profile', method: 'DELETE', body: undefined }]);
  assert.equal(f.state.closedParent, 0);
});

test('affected action markup treats apostrophes in email as data rather than JavaScript', () => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = vm.createContext({ escapeHtml: esc, formatIdr: String, orderStatusBadge: String });
  vm.runInContext(slice('const ENROLLMENT_SOURCE_LABEL =', 'async function refreshUserAccessModal'), ctx);
  vm.runInContext(slice('function privacyRightsPanelHtml(', '// These actions use an in-page dialog:'), ctx);
  const data = { user: { email, full_name: 'Sample' }, enrollments: [{ course_id: 'course-1', slug: 'n5', status: 'active', enrolled_at: '2026-01-01' }], courses: [], orders: [] };
  const markup = ctx.userAccessPanelHtml(data, { courseSelectId: 'ua-course', revokeFn: 'uaRevoke', grantFn: 'uaGrant', extendFn: 'uaExtend' }) + ctx.privacyRightsPanelHtml(data.user, []);
  const names = ['uaRevoke', 'uaDropMarketing', 'uaEraseAccount'];
  for (const name of names) {
    const handler = [...markup.matchAll(/onclick="([^"]+)"/g)].map(match => match[1]).find(value => value.startsWith(name + '('));
    assert.ok(handler);
    assert.ok(!handler.includes(email));
    let received;
    vm.runInNewContext(`(function(){${handler}}).call(button)`, { [name]: (...args) => { received = args; }, button: { dataset: { email } } });
    assert.equal(received[0], email);
  }
  assert.match(markup, /data-email="test\.o&#39;brien@example\.invalid"/);
  assert.match(html, /onclick="openUserAccess\(this\.dataset\.email\)"/);
});
