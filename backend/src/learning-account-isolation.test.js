import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const apiSource = readFileSync(new URL('../../api-client.js', import.meta.url), 'utf8');
const welcome = readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const dashboard = readFileSync(new URL('../../dashboard.js', import.meta.url), 'utf8');
function slice(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Use shipped source: ${from}`);
  return source.slice(start, end);
}
const A = { id: 'student-a', email: 'a@example.invalid' };
const B = { id: 'student-b', email: 'b@example.invalid' };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const kana = [
  { id: 'kana-a', kind: 'hiragana', character: 'あ', romaji: 'a' },
  { id: 'kana-i', kind: 'hiragana', character: 'い', romaji: 'i' },
];

function setup({ storage = new Map(), intercept, user = A } = {}) {
  const requests = [], listeners = new Map(), timers = new Map(), sessionStorage = new Map();
  const state = { user, reloads: 0, nextTimer: 0, redirects: [] };
  const button = { disabled: true, getAttribute: () => null };
  const hint = { innerHTML: '' };
  const store = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  const ctx = vm.createContext({
    URL, URLSearchParams, Date, console,
    localStorage: store(storage), sessionStorage: store(sessionStorage),
    location: { href: 'https://example.invalid/welcome.html', pathname: '/welcome.html', search: '', reload: () => state.reloads++, replace: path => state.redirects.push(path) },
    document: { getElementById: id => id === 'kana-complete-btn' ? button : id === 'kana-progress-hint' ? hint : null },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    addEventListener: (type, listener) => { const list = listeners.get(type) || []; list.push(listener); listeners.set(type, list); },
    dispatchEvent: event => { for (const listener of listeners.get(event.type) || []) listener(event); },
    setTimeout: fn => { const id = ++state.nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    COURSE_CONTENT: {},
    DECK_MASTERY_KEY: 'ez_deck_mastery_v1', KANJI_MASTERY_KEY: 'ez_kanji_mastery_v1',
    _legacyKanjiWordOwners: () => ({}), _recordPracticeAttempt: () => {},
    fetch: async (url, options = {}) => {
      const request = { url, ...options }; requests.push(request);
      const custom = intercept?.(request, state);
      if (custom !== undefined) return custom;
      if (/\/auth\/(login|google|refresh)$/.test(url)) return response({ user: state.user, accessToken: `token-${state.user.id}` });
      if (url.endsWith('/auth/me')) return response({ user: state.user });
      if (url.endsWith('/learning-state')) return response(options.method === 'PUT' ? { ok: true } : { progress: {}, quizScores: {} });
      if (url.endsWith('/practice/import-legacy')) return response({ unresolved: 0 });
      if (url.endsWith('/auth/logout')) return response({ ok: true });
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  ctx.window = ctx;
  vm.runInContext(apiSource, ctx);
  vm.runInContext(slice(welcome, 'function getEnrolledCourses()', 'function _currentPracticeLesson()'), ctx);
  vm.runInContext(slice(welcome, 'const KANA_MASTERY_KEY', 'function _kanaPickDistractors'), ctx);
  vm.runInContext(slice(welcome, 'function _applyDrillCompletionGate', 'function _practiceTimestamp'), ctx);
  vm.runInContext('const progressReconcileVersion = "ez_progress_reconcile_v2";\n'
    + slice(dashboard, '  async function reconcileCachedProgress()', '  function learnUrl'), ctx);
  ctx.__kanaData = kana;
  ctx.__kanaLessonArgs = [null, null, null, { isDone: false, next: {} }];
  return { ctx, state, storage, sessionStorage, requests, timers, button, hint };
}

test('boot never reads or imports unattributed browser data, even with a stale profile mirror', async () => {
  const storage = new Map([
    ['ez_user', JSON.stringify(A)],
    ['ez_progress', JSON.stringify({ n5: { 'bab-1:quiz': true } })],
    ['ez_kana_mastery_v1', JSON.stringify({ items: { 'hiragana::あ::a': { k2r: { attempts: 50, correct: 50 } } } })],
    ['ez_practice_legacy_import_v1', '1'],
  ]);
  const original = new Map(storage), h = setup({ storage, user: B });
  assert.equal(h.ctx.ezGetAuthenticatedUserId(), null);
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_progress'), null);
  assert.equal(h.ctx.ezLearningStorage.setItem('ez_progress', 'unverified'), false);
  assert.equal(h.ctx._kanaSummary(kana[0]).attempts, 0);
  await h.ctx.reconcileCachedProgress();
  assert.equal(h.requests.length, 0);
  await h.ctx.ezGetMe();
  await h.ctx.syncLearningStateFromServer({ reconcile: true });
  const put = h.requests.find(req => req.url.endsWith('/learning-state') && req.method === 'PUT');
  assert.deepEqual(JSON.parse(put.body).progress, {});
  assert.equal(h.requests.some(req => req.url.endsWith('/practice/import-legacy')), false);
  for (const [key, value] of original) if (key !== 'ez_user') assert.equal(storage.get(key), value, `${key} retained for explicit recovery`);
});

test('normal logout/login isolates actual drill gate, progress, scores and markers while retaining returning learner data', async () => {
  const h = setup();
  await h.ctx.ezGetMe();
  for (const item of kana) h.ctx._kanaRecordAnswer(item, 'k2r', true);
  h.ctx.setProgress({ n5: { 'bab-1:kana': true } });
  h.ctx.ezLearningStorage.setItem('ez_quiz_scores', '{"quiz":95}');
  h.ctx.ezLearningStorage.setItem('ez_practice_legacy_import_v1', '1');
  h.ctx.ezLearningSessionStorage.setItem('ez_tutor_chat', 'private A conversation');
  assert.equal(h.button.disabled, false);
  await h.ctx.ezLogout();
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_progress'), null);
  h.state.user = B;
  await h.ctx.ezLogin(B.email, 'password');
  h.ctx.kanaUpdateComplete();
  assert.equal(h.button.disabled, true);
  assert.match(h.hint.innerHTML, /0 \/ 2 huruf sudah dilatih/);
  assert.deepEqual(plain(h.ctx.getProgress()), {});
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_quiz_scores'), null);
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_practice_legacy_import_v1'), null);
  assert.equal(h.ctx.ezLearningSessionStorage.getItem('ez_tutor_chat'), null);
  h.ctx.setProgress({ n4: { 'bab-3:kana': true } });
  await h.ctx.ezLogout();
  h.state.user = A;
  await h.ctx.ezLogin(A.email, 'password');
  h.ctx.kanaUpdateComplete();
  assert.equal(h.button.disabled, false);
  assert.deepEqual(plain(h.ctx.getProgress()), { n5: { 'bab-1:kana': true } });
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_quiz_scores'), '{"quiz":95}');
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_practice_legacy_import_v1'), '1');
  assert.equal(h.ctx.ezLearningSessionStorage.getItem('ez_tutor_chat'), 'private A conversation');
});

test('reload verifies the account before restoring an existing namespace and same-user refresh preserves it', async () => {
  const first = setup(); await first.ctx.ezGetMe();
  first.ctx.setProgress({ n5: { lesson: true } });
  const reloaded = setup({ storage: first.storage });
  assert.deepEqual(plain(reloaded.ctx.getProgress()), {});
  await reloaded.ctx.ezGetMe();
  assert.deepEqual(plain(reloaded.ctx.getProgress()), { n5: { lesson: true } });
  const snapshot = reloaded.ctx.ezCaptureAuth();
  await reloaded.ctx.ezRefresh();
  assert.equal(reloaded.ctx.ezIsAuthCurrent(snapshot), true);
  assert.deepEqual(plain(reloaded.ctx.getProgress()), { n5: { lesson: true } });
});

test('401 refresh changing account does not replay the previous account write with the new token', async () => {
  let rejectWrite = false;
  const h = setup({ intercept: req => rejectWrite && req.url.endsWith('/learning-state') ? response({}, 401) : undefined });
  await h.ctx.ezGetMe();
  rejectWrite = true; h.state.user = B;
  await assert.rejects(h.ctx.ezApi('/learning-state', { expectedUserId: A.id, method: 'PUT', body: '{"progress":{"A":true}}' }), /AUTH_CHANGED/);
  const writes = h.requests.filter(req => req.url.endsWith('/learning-state'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].headers.Authorization, 'Bearer token-student-a');
  assert.equal(Object.hasOwn(writes[0], 'expectedUserId'), false, 'local ownership option never enters fetch');
  assert.equal(h.ctx.ezGetAuthenticatedUserId(), B.id);
  const count = h.requests.length;
  await assert.rejects(h.ctx.ezApi('/learning-state', { expectedUserId: A.id, method: 'PUT' }), /AUTH_CHANGED/);
  assert.equal(h.requests.length, count);
});

test('account switch during delayed JSON parsing cannot hydrate new-account progress from an old response', async () => {
  const body = deferred();
  const h = setup({ intercept: req => req.url.endsWith('/learning-state') && !req.method ? { ok: true, status: 200, json: () => body.promise } : undefined });
  await h.ctx.ezGetMe();
  const loading = h.ctx.syncLearningStateFromServer();
  await flush();
  h.state.user = B; await h.ctx.ezLogin(B.email, 'password');
  body.resolve({ progress: { n5: { 'A-only': true } }, quizScores: { quiz: 100 } });
  assert.equal(await loading, false);
  assert.deepEqual(plain(h.ctx.getProgress()), {});
  assert.equal(h.requests.some(req => req.url.endsWith('/learning-state') && req.method === 'PUT'), false);
});

test('enrollment and practice consumers recheck ownership after the transport JSON guard returns', async () => {
  for (const kind of ['enrollment', 'practice', 'course']) {
    const body = deferred();
    const path = kind === 'practice' ? '/practice/state?' : '/enrollments/me';
    const h = setup({ intercept: req => req.url.includes(path) ? { ok: true, status: 200, json: () => body.promise } : undefined });
    await h.ctx.ezGetMe();
    const checks = [], isCurrent = h.ctx.ezIsAuthCurrent;
    h.ctx.ezIsAuthCurrent = owner => { const result = isCurrent(owner); checks.push(result); return result; };
    let task;
    if (kind === 'practice') {
      vm.runInContext(slice(welcome, 'function _practiceTimestamp', 'const DAILY_GOAL_XP'), h.ctx);
      task = h.ctx.syncPracticeStateForLesson('kana', 'lesson-a', kana, () => { throw Error('stale merge callback'); });
    } else if (kind === 'course') {
      const course = readFileSync(new URL('../../courses/course.js', import.meta.url), 'utf8');
      Object.assign(h.ctx, { getSlugFromPage: () => 'n5', ensureAuth: async () => A,
        fetchCourseBySlug: () => { throw Error('stale course continuation'); } });
      vm.runInContext(slice(course, 'async function init()', 'document.addEventListener("DOMContentLoaded"'), h.ctx);
      task = h.ctx.init();
    } else task = h.ctx.syncEnrollmentsFromServer();
    await flush();
    body.resolve({ enrollments: [{ slug: 'A-only' }], states: [{ itemId: kana[0].id, skill: 'k2r', attempts: 20, correct: 20 }] });
    // The transport validates first; another completed auth flow then changes
    // ownership before the awaiting consumer resumes and writes its cache.
    queueMicrotask(() => queueMicrotask(() => h.ctx.mirrorUserToLocal(B)));
    await task;
    assert.equal(h.ctx.ezGetAuthenticatedUserId(), B.id);
    assert.ok(checks.includes(false), `${kind} must check ownership inside the consumer`);
    assert.equal(h.ctx.ezLearningStorage.getItem('ez_courses'), null);
    assert.equal(h.ctx._kanaSummary(kana[0]).attempts, 0);
  }
});

test('session guard redirects after its own invalidation following a successful refresh', async () => {
  for (const status of [401, 404, 500]) {
    const h = setup({ intercept: req => req.url.endsWith('/auth/me') ? response({}, status) : undefined });
    assert.equal(await h.ctx.ezRequireAuth('login.html'), null);
    assert.equal(h.ctx.ezGetAuthenticatedUserId(), null);
    assert.deepEqual(h.state.redirects, ['login.html?next=welcome.html']);
  }
});

test('stale failed validation cannot clear or redirect a newly authenticated account', async () => {
  const pending = deferred();
  const h = setup({ intercept: req => req.url.endsWith('/auth/me') ? pending.promise : undefined });
  const checking = h.ctx.ezRequireAuth('login.html');
  await flush();
  h.state.user = B;
  await h.ctx.ezLogin(B.email, 'password');
  pending.resolve(response({}, 404));
  assert.equal(await checking, null);
  assert.equal(h.ctx.ezGetAuthenticatedUserId(), B.id);
  assert.deepEqual(h.state.redirects, []);
});

test('cross-tab account changes invalidate pending requests and caches before reloading; same-user events do not', async () => {
  const pending = deferred();
  const h = setup({ intercept: req => req.url.endsWith('/learning-state') ? pending.promise : undefined });
  await h.ctx.ezGetMe();
  h.ctx.setProgress({ n5: { 'A-only': true } });
  h.ctx.dispatchEvent({ type: 'storage', key: 'ez_user', newValue: JSON.stringify(A) });
  assert.equal(h.state.reloads, 0);
  const reading = h.ctx.ezApi('/learning-state');
  const rejection = assert.rejects(reading, /AUTH_CHANGED/);
  h.ctx.dispatchEvent({ type: 'storage', key: 'ez_user', newValue: JSON.stringify(B) });
  assert.equal(h.state.reloads, 1);
  assert.equal(h.ctx.ezGetAuthenticatedUserId(), null);
  assert.deepEqual(plain(h.ctx.getProgress()), {});
  pending.resolve(response({ progress: { leaked: true } }));
  await rejection;
});

test('old scheduled pushes and late reconciliation acknowledgements cannot mutate the new account markers', async () => {
  const acknowledgement = deferred(); let hold = false;
  const h = setup({ intercept: req => hold && req.url.endsWith('/learning-state') && req.method === 'PUT' ? acknowledgement.promise : undefined });
  await h.ctx.ezGetMe(); h.ctx.setProgress({ n5: { 'A-only': true } });
  const oldTimer = [...h.timers.values()][0];
  hold = true;
  const saving = h.ctx.reconcileCachedProgress();
  await flush();
  h.state.user = B; await h.ctx.ezLogin(B.email, 'password');
  h.ctx.ezLearningStorage.setItem('ez_progress_pending_sync', '1');
  const before = h.requests.length;
  await oldTimer();
  assert.equal(h.requests.length, before);
  acknowledgement.resolve(response({ ok: true }));
  assert.equal(await saving, false);
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_progress_pending_sync'), '1');
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_progress_reconcile_v2'), null);
});

test('learner boot never imports new account-scoped practice aggregates alongside pending event replay', async () => {
  const h = setup(); await h.ctx.ezGetMe();
  for (const item of kana) h.ctx._kanaRecordAnswer(item, 'k2r', true);
  assert.equal(h.ctx.ezLearningStorage.getItem('ez_practice_legacy_import_v1'), null);
  const boot = slice(welcome, '(async () => {\n  if (!session) return;', '\n</script>');
  let rendered = false;
  Object.assign(h.ctx, {
    session: A, learningPageOwner: null,
    renderBootSkeleton: () => {}, syncEnrollmentsFromServer: async () => {},
    hydrateEnrolledCourses: async () => {}, _pruneProgressToHydratedCourses: () => {},
    renderBootError: error => { throw error; }, getEnrolledCourses: () => [],
    renderPaywall: () => { rendered = true; },
  });
  await vm.runInContext(boot, h.ctx);
  assert.equal(rendered, true);
  assert.equal(h.ctx._kanaSummary(kana[0]).attempts, 1);
  assert.equal(h.requests.some(req => req.url.endsWith('/practice/import-legacy')), false);
});
