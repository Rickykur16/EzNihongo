import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../api-client.js', import.meta.url), 'utf8');
const userA = { id: 'user-a', email: 'a@example.invalid', fullName: 'A' };
const userB = { id: 'user-b', email: 'b@example.invalid', fullName: 'B' };
const attempt = {
  attemptToken: 'token-a', lessonId: 'lesson-a', lessonSlug: 'assignment-bab-3',
  lessonTitle: 'Assignment Bab 3', moduleSlug: 'bab-3', courseSlug: 'n5',
  startedAt: '2026-09-26T00:00:00Z', totalQuestions: 24, assessmentVersion: 'n5-assessment-v2',
};
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function setup(path = '/welcome.html', { scriptPath = '/api-client.js', intercept } = {}) {
  const requests = [], redirects = [], assignments = [], storage = new Map();
  let page = new URL(path, 'https://example.invalid');
  const location = {
    get href() { return page.href; }, set href(value) { assignments.push(value); page = new URL(value, page); },
    get pathname() { return page.pathname; }, get search() { return page.search; }, get origin() { return page.origin; },
    replace: target => redirects.push(target),
  };
  const state = { user: userA, attempt: null };
  const ctx = vm.createContext({
    window: null, location, URL, URLSearchParams, Date,
    document: { currentScript: { src: new URL(scriptPath, page).href } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, options = {}) => {
      const request = { url, path: new URL(url, page).pathname, ...options };
      requests.push(request);
      const custom = intercept?.(request, state);
      if (custom !== undefined) return custom;
      if (request.path.endsWith('/auth/refresh') || request.path.endsWith('/auth/login') || request.path.endsWith('/auth/google')) {
        return response({ accessToken: `access-${state.user.id}`, user: state.user });
      }
      if (request.path.endsWith('/auth/me')) return response({ user: state.user });
      if (request.path.endsWith('/auth/logout')) return response({ ok: true });
      if (request.path.endsWith('/progress/quiz/unfinished')) return response({ attempt: state.attempt });
      throw new Error(`Unexpected request ${request.path}`);
    },
  });
  ctx.window = ctx;
  vm.runInContext(source, ctx, { filename: 'api-client.js' });
  return { ctx, state, requests, redirects, assignments, storage, navigate: path => { page = new URL(path, page); } };
}

test('helper returns attempt/null with authentication and no-store, sharing only in-flight reads', async () => {
  const gate = deferred();
  let held = true;
  const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/quiz/unfinished') && held ? gate.promise : undefined });
  const first = h.ctx.ezGetUnfinishedAssignment(), second = h.ctx.ezGetUnfinishedAssignment();
  await flush();
  assert.equal(h.requests.filter(r => r.path.endsWith('/auth/refresh')).length, 1);
  const reads = h.requests.filter(r => r.path.endsWith('/quiz/unfinished'));
  assert.equal(reads.length, 1);
  assert.equal(reads[0].cache, 'no-store');
  assert.equal(reads[0].credentials, 'include');
  assert.equal(reads[0].headers.Authorization, 'Bearer access-user-a');
  gate.resolve(response({ attempt }));
  assert.deepEqual(plain(await first), attempt);
  assert.deepEqual(plain(await second), attempt);
  held = false;
  assert.equal(await h.ctx.ezGetUnfinishedAssignment(), null);
  assert.equal(h.requests.filter(r => r.path.endsWith('/quiz/unfinished')).length, 2, 'Completed results must not be cached');
});

test('helper allows a rolling-deploy 404 but propagates server/network/malformed responses', async () => {
  for (const [label, result, shouldReject] of [
    ['404', response({}, 404), false],
    ['500', response({ error: 'server_error' }, 500), true],
    ['invalid envelope', response({}), true],
    ['invalid attempt', response({ attempt: { lessonId: 'alone' } }), true],
  ]) {
    const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/quiz/unfinished') ? result : undefined });
    if (shouldReject) await assert.rejects(h.ctx.ezGetUnfinishedAssignment(), /ASSIGNMENT_CHECK_FAILED/, label);
    else assert.equal(await h.ctx.ezGetUnfinishedAssignment(), null);
  }
  const h = setup('/welcome.html', { intercept: req => {
    if (req.path.endsWith('/quiz/unfinished')) throw new Error('network offline');
  } });
  await assert.rejects(h.ctx.ezGetUnfinishedAssignment(), /network offline/);
});

test('validated student entry does not redirect to unfinished work', async () => {
  const h = setup('/index.html'); h.state.attempt = attempt;
  let followed = false;
  // Mirrors the landing/login-style continuation that used to replace a
  // chosen destination after ezGetMe returned a user.
  void h.ctx.ezGetMe().then(user => { followed = !!user; });
  void h.ctx.ezRequireAuth('login.html');
  await flush();
  await flush();
  assert.equal(followed, true);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.requests.filter(r => r.path.endsWith('/quiz/unfinished')).length, 0);
});

test('all actual student entry pages leave unfinished work available without checking or redirecting', async () => {
  for (const path of ['/', '/index.html', '/dashboard.html', '/review.html', '/live.html', '/progress.html', '/focus.html', '/courses/detail.html', '/courses/order.html']) {
    const h = setup(path);
    assert.equal((await h.ctx.ezGetMe()).id, userA.id, path);
    assert.equal(h.requests.filter(r => r.path.endsWith('/quiz/unfinished')).length, 0, path);
    assert.equal(h.redirects.length, 0, path);
  }
  for (const path of ['/welcome.html?resumeAssignment=1', '/admin.html', '/company.html', '/src/company-workspace.html', '/app/kanji.html', '/login.html']) {
    const h = setup(path); h.state.attempt = attempt;
    assert.equal((await h.ctx.ezGetMe()).id, userA.id, path);
    assert.equal(h.requests.filter(r => r.path.endsWith('/quiz/unfinished')).length, 0, path);
    assert.equal(h.redirects.length, 0, path);
  }
});

test('login keeps its existing next flow, then dashboard does not enforce the pending assignment', async () => {
  const h = setup('/login.html'); h.state.attempt = attempt;
  assert.equal((await h.ctx.ezLoginWithGoogle('credential')).id, userA.id);
  assert.equal((await h.ctx.ezGetMe()).id, userA.id);
  assert.equal(h.redirects.length, 0);
  h.navigate('/dashboard.html');
  let returned = false;
  void h.ctx.ezRequireAuth().then(() => { returned = true; });
  await flush();
  assert.equal(returned, true);
  assert.equal(h.redirects.length, 0);
});

test('unfinished assignment lookup remains an explicit opt-in helper', async () => {
  const h = setup('/school/courses/order.html', { scriptPath: '/school/api-client.js?v=1' });
  h.state.attempt = { ...attempt, courseSlug: 'n5&next=https://other.invalid', moduleSlug: 'bab 3', lessonSlug: 'lesson/#?' };
  assert.equal((await h.ctx.ezGetMe()).id, userA.id);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.requests.filter(r => r.path.endsWith('/quiz/unfinished')).length, 0);
});

test('force/finish invalidation discards late pending responses without poisoning a fresh read', async () => {
  const gate = deferred(); let old = true;
  const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/quiz/unfinished') && old ? gate.promise : undefined });
  await h.ctx.ezGetMe();
  const pending = h.ctx.ezGetUnfinishedAssignment();
  const rejection = assert.rejects(pending, /AUTH_CHANGED/);
  await flush();
  old = false;
  assert.equal(await h.ctx.ezGetUnfinishedAssignment({ force: true }), null);
  gate.resolve(response({ attempt }));
  await rejection;
  h.ctx.ezClearUnfinishedAssignmentCache();
  assert.equal(await h.ctx.ezGetUnfinishedAssignment(), null);
});

test('an account switch cannot return the previous account attempt or clear the new session', async () => {
  const gate = deferred();
  const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/quiz/unfinished') && req.headers.Authorization === 'Bearer access-user-a' ? gate.promise : undefined });
  await h.ctx.ezGetMe();
  const old = h.ctx.ezGetUnfinishedAssignment();
  const rejection = assert.rejects(old, /AUTH_CHANGED/);
  await flush();
  h.state.user = userB;
  await h.ctx.ezLogin('b@example.invalid', 'password');
  gate.resolve(response({ attempt }));
  await rejection;
  assert.equal(await h.ctx.ezGetUnfinishedAssignment(), null);
  assert.equal(JSON.parse(h.storage.get('ez_user')).id, userB.id);
  assert.equal(vm.runInContext('_ezAccessToken', h.ctx), 'access-user-b');
  assert.equal(h.redirects.length, 0);
});

test('logout still reaches the normal destination without a pending-assignment guard', async () => {
  const gate = deferred();
  const h = setup('/dashboard.html', { intercept: req => req.path.endsWith('/quiz/unfinished') ? gate.promise : undefined });
  const pending = h.ctx.ezRequireAuth();
  await pending;
  await h.ctx.ezLogout();
  gate.resolve(response({ attempt }));
  assert.equal(h.storage.has('ez_user'), false);
  assert.deepEqual(h.redirects, []);
  assert.deepEqual(h.assignments, ['index.html']);
  assert.equal(h.storage.has('ez_user'), false);
  assert.equal(vm.runInContext('_ezAccessToken', h.ctx), null);
});

test('a refresh that finishes after logout cannot restore authentication or perform the pending lookup', async () => {
  const gate = deferred();
  const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/auth/refresh') ? gate.promise : undefined });
  const pending = h.ctx.ezGetUnfinishedAssignment();
  const rejection = assert.rejects(pending, /AUTH_CHANGED/);
  await flush();
  await h.ctx.ezLogout();
  gate.resolve(response({ accessToken: 'old-access', user: userA }));
  await rejection;
  assert.equal(h.storage.has('ez_user'), false);
  assert.equal(vm.runInContext('_ezAccessToken', h.ctx), null);
  assert.equal(h.requests.some(r => r.path.endsWith('/quiz/unfinished')), false);
});

test('unfinished lookup failure does not affect the verified session because it is opt-in', async () => {
  const h = setup('/dashboard.html', { intercept: req => req.path.endsWith('/quiz/unfinished') ? response({}, 503) : undefined });
  assert.equal((await h.ctx.ezGetMe()).id, userA.id);
  assert.equal(JSON.parse(h.storage.get('ez_user')).id, userA.id);
  assert.deepEqual(h.redirects, []);
});

test('a validated cookie account change retires a slower auth/me response from the old account', async () => {
  const gate = deferred(); let holdMe = false;
  const h = setup('/welcome.html', { intercept: req => req.path.endsWith('/auth/me') && holdMe ? gate.promise : undefined });
  await h.ctx.ezGetMe();
  holdMe = true;
  const pending = h.ctx.ezGetMe();
  await flush();
  // Another successful refresh establishes a different authenticated user.
  h.state.user = userB;
  await h.ctx.ezRefresh();
  gate.resolve(response({ user: userA }));
  assert.equal(await pending, null);
  assert.equal(JSON.parse(h.storage.get('ez_user')).id, userB.id);
  assert.equal(vm.runInContext('_ezAccessToken', h.ctx), 'access-user-b');
});
