import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const user = { id: 'student', email: 'student@example.invalid', fullName: 'Siswa' };
const reply = (status = 200, body = { accessToken: 'access', user }) => ({
  ok: status === 200, status, json: async () => body,
  headers: { get: () => '42' },
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const file of ['api-client.js', 'app/api-client.js']) {
  function setup(fetch) {
    const storage = new Map();
    const ctx = vm.createContext({ fetch, location: {}, Date, URL, URLSearchParams,
      document: { currentScript: null },
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    });
    ctx.window = ctx;
    vm.runInContext(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), ctx);
    return ctx;
  }

  test(`${file}: repeated in-flight login sends one POST and allows a later login`, async () => {
    const gate = deferred();
    const requests = [];
    const ctx = setup((url, opts) => { requests.push({ url, opts }); return gate.promise; });
    const logins = Array.from({ length: 20 }, () => ctx.ezLoginWithGoogle('credential'));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].opts.credentials, 'include');
    await assert.rejects(ctx.ezLoginWithGoogle('other-account'), /sedang diproses/);
    assert.equal(requests.length, 1);
    gate.resolve(reply());
    for (const result of await Promise.all(logins)) assert.equal(result.id, user.id);
    await ctx.ezLoginWithGoogle('credential');
    assert.equal(requests.length, 2);
  });

  test(`${file}: first signup can retry with a name after profile_required`, async () => {
    const requests = [];
    const ctx = setup(async (_url, opts) => {
      const body = JSON.parse(opts.body); requests.push(body);
      return body.fullName ? reply() : reply(400, { error: 'profile_required', googleName: 'Nama Google' });
    });
    await assert.rejects(ctx.ezLoginWithGoogle('credential'), err => err.code === 'profile_required' && err.googleName === 'Nama Google');
    assert.equal((await ctx.ezLoginWithGoogle('credential', 'Siswa')).id, user.id);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].fullName, 'Siswa');
  });

  test(`${file}: network failures and 429 release the request; no automatic retry`, async () => {
    let requests = 0;
    const ctx = setup(async () => {
      requests++;
      if (requests === 1) throw new Error('offline');
      if (requests === 2) return reply(429, { error: 'Too many login attempts, slow down' });
      return reply();
    });
    await assert.rejects(ctx.ezLoginWithGoogle('credential'), /offline/);
    await assert.rejects(ctx.ezLoginWithGoogle('credential'), /Tunggu 42 detik/);
    assert.equal(requests, 2);
    await ctx.ezLoginWithGoogle('credential');
    assert.equal(requests, 3);
  });
}

for (const file of ['login.html', 'app/login.html', 'app/register.html']) {
  test(`${file}: callback and profile submit ignore repeats, then unlock after errors`, async () => {
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, { style: {}, value: 'Siswa', textContent: '',
        setAttribute() {}, focus() {}, select() {},
        addEventListener(event, handler) { this[event] = handler; },
        querySelector() { return element('submit'); },
      });
      return elements.get(id);
    };
    let gate = deferred(), calls = 0;
    const redirects = [];
    const ctx = vm.createContext({
      document: { getElementById: element },
      location: { search: '', replace: url => redirects.push(url) },
      URL, URLSearchParams, setTimeout: fn => fn(),
      sessionStorage: { setItem() {} },
      ezGetMe: async () => null,
      ezLoginWithGoogle: () => { calls++; return gate.promise; },
    });
    ctx.window = { location: { href: 'https://example.invalid/login.html' }, addEventListener() {} };
    const html = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(s => s.includes('handleGoogleCredential'));
    vm.runInContext(script, ctx, { filename: file });
    const first = ctx.handleGoogleCredential({ credential: 'credential' });
    await ctx.handleGoogleCredential({ credential: 'credential' });
    assert.equal(calls, 1);
    assert.equal(element('google-btn-container').inert, true);
    gate.reject(Object.assign(new Error('profile required'), { code: 'profile_required', googleName: 'Nama' }));
    await first;
    assert.equal(element('google-btn-container').inert, false);
    assert.equal(element('step-profile').style.display, 'block');
    gate = deferred();
    const event = { preventDefault() {}, target: element('profile-form') };
    const submit = element('profile-form').submit(event);
    await element('profile-form').submit(event);
    assert.equal(calls, 2);
    assert.equal(element('submit').disabled, true);
    gate.reject(new Error('offline'));
    await submit;
    assert.equal(element('submit').disabled, false);
    gate = deferred();
    const retry = element('profile-form').submit(event);
    gate.resolve(user);
    await retry;
    await ctx.handleGoogleCredential({ credential: 'credential' });
    assert.equal(calls, 3, 'Keep login locked while navigating after success');
    assert.equal(redirects.length, 1);
  });
}
