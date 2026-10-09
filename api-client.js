// api-client.js — EzNihongo self-hosted API client
// Replaces supabase-client.js. Auth via /api/auth/* on same origin.

const EZ_API_BASE = (typeof window !== 'undefined' && window.EZ_API_BASE) || '/api';
let _ezAccessToken = null;
let _ezRefreshPromise = null;
let _ezAuthGeneration = 0;
let _ezSessionUserId = null;
let _ezLoggingOut = false;
let _ezUnfinishedPromise = null;
let _ezUnfinishedGeneration = 0;

// Learning caches belong to the server-verified account, never to the browser
// or the unverified ez_user mirror. Keep old global caches untouched: they
// have no reliable owner and must not be silently imported into a new account.
function ezGetAuthenticatedUserId() {
  return _ezLoggingOut ? null : _ezSessionUserId;
}
function ezCaptureAuth() {
  return Object.freeze({ generation: _ezAuthGeneration, userId: ezGetAuthenticatedUserId() });
}
function ezIsAuthCurrent(snapshot) {
  return !!snapshot?.userId && snapshot.generation === _ezAuthGeneration
    && snapshot.userId === ezGetAuthenticatedUserId();
}
function _ezNotifyAuthChange() {
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('ez:auth-changed', { detail: { userId: ezGetAuthenticatedUserId() } }));
  }
}
function _ezAccountStorage(storageName) {
  const keyFor = (key) => {
    const owner = ezGetAuthenticatedUserId();
    return owner ? `ez_learning_v1:${encodeURIComponent(owner)}:${key}` : null;
  };
  return Object.freeze({
    getItem(key) {
      const scoped = keyFor(key);
      try { return scoped ? window[storageName].getItem(scoped) : null; } catch { return null; }
    },
    setItem(key, value) {
      const scoped = keyFor(key);
      if (!scoped) return false;
      try { window[storageName].setItem(scoped, value); return true; } catch { return false; }
    },
    removeItem(key) {
      const scoped = keyFor(key);
      if (!scoped) return false;
      try { window[storageName].removeItem(scoped); return true; } catch { return false; }
    },
  });
}
window.ezGetAuthenticatedUserId = ezGetAuthenticatedUserId;
window.ezCaptureAuth = ezCaptureAuth;
window.ezIsAuthCurrent = ezIsAuthCurrent;
window.ezLearningStorage = _ezAccountStorage('localStorage');
window.ezLearningSessionStorage = _ezAccountStorage('sessionStorage');

function ezClearUnfinishedAssignmentCache() {
  _ezUnfinishedGeneration++;
  _ezUnfinishedPromise = null;
}

function _ezBeginAuthChange() {
  _ezAuthGeneration++;
  _ezAccessToken = null;
  _ezRefreshPromise = null;
  _ezSessionUserId = null;
  ezClearUnfinishedAssignmentCache();
  _ezNotifyAuthChange();
  return _ezAuthGeneration;
}

function _ezCheckAuthGeneration(generation) {
  if (generation !== _ezAuthGeneration || _ezLoggingOut) throw new Error('AUTH_CHANGED');
}

// Only in-flight work is shared. A completed read is never reused after an
// assignment starts or finishes, and old-account responses cannot redirect.
async function ezGetUnfinishedAssignment({ force = false } = {}) {
  if (force) ezClearUnfinishedAssignmentCache();
  if (_ezUnfinishedPromise) return _ezUnfinishedPromise;
  const authGeneration = _ezAuthGeneration;
  const generation = _ezUnfinishedGeneration;
  const pending = (async () => {
    if (!_ezAccessToken) await ezRefresh();
    _ezCheckAuthGeneration(authGeneration);
    const owner = _ezSessionUserId;
    const res = await ezApi('/progress/quiz/unfinished', { cache: 'no-store' });
    _ezCheckAuthGeneration(authGeneration);
    if (generation !== _ezUnfinishedGeneration || owner !== _ezSessionUserId) throw new Error('AUTH_CHANGED');
    if (res.status === 404) return null; // Client/server rolling-deploy compatibility.
    if (!res.ok) throw new Error('ASSIGNMENT_CHECK_FAILED');
    const data = await res.json();
    _ezCheckAuthGeneration(authGeneration);
    if (generation !== _ezUnfinishedGeneration || owner !== _ezSessionUserId) throw new Error('AUTH_CHANGED');
    if (!data || !Object.prototype.hasOwnProperty.call(data, 'attempt')) throw new Error('ASSIGNMENT_CHECK_FAILED');
    if (data.attempt === null) return null;
    const attempt = data.attempt;
    if (!attempt || typeof attempt !== 'object' ||
        ['attemptToken', 'lessonId', 'lessonSlug', 'moduleSlug', 'courseSlug'].some(key => typeof attempt[key] !== 'string' || !attempt[key].trim())) {
      throw new Error('ASSIGNMENT_CHECK_FAILED');
    }
    return attempt;
  })();
  _ezUnfinishedPromise = pending;
  try { return await pending; }
  finally { if (_ezUnfinishedPromise === pending) _ezUnfinishedPromise = null; }
}

async function _ezFetch(path, opts = {}) {
  if (_ezLoggingOut) throw new Error('AUTH_CHANGED');
  const headers = { ...(opts.headers || {}) };
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (_ezAccessToken) headers['Authorization'] = 'Bearer ' + _ezAccessToken;
  return fetch(EZ_API_BASE + path, { ...opts, headers, credentials: 'include' });
}

async function ezApi(path, opts = {}) {
  const { expectedUserId, ...fetchOptions } = opts;
  if (expectedUserId !== undefined && expectedUserId !== ezGetAuthenticatedUserId()) throw new Error('AUTH_CHANGED');
  const generation = _ezAuthGeneration;
  let res = await _ezFetch(path, fetchOptions);
  _ezCheckAuthGeneration(generation);
  if (res.status === 401) {
    try {
      await ezRefresh();
      // Refresh can discover an account changed in another tab. Never send
      // the old account's pending write with the replacement account's token.
      _ezCheckAuthGeneration(generation);
      if (expectedUserId !== undefined && expectedUserId !== ezGetAuthenticatedUserId()) throw new Error('AUTH_CHANGED');
      res = await _ezFetch(path, fetchOptions);
      _ezCheckAuthGeneration(generation);
    } catch (e) {
      if (generation !== _ezAuthGeneration || _ezLoggingOut || e.message === 'AUTH_CHANGED') throw new Error('AUTH_CHANGED');
      _ezAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
  }
  // Parsing a streamed body is asynchronous too. A response returned before
  // logout must not later repopulate the newly signed-in account's cache.
  const readJson = res.json.bind(res);
  res.json = async () => {
    const data = await readJson();
    _ezCheckAuthGeneration(generation);
    return data;
  };
  return res;
}

async function ezRefresh() {
  if (_ezLoggingOut) throw new Error('AUTH_CHANGED');
  if (_ezRefreshPromise) return _ezRefreshPromise;
  const generation = _ezAuthGeneration;
  const pending = (async () => {
    const res = await fetch(EZ_API_BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('refresh_failed');
    const data = await res.json();
    _ezCheckAuthGeneration(generation);
    _ezAccessToken = data.accessToken;
    if (data.user) mirrorUserToLocal(data.user);
    return _ezAccessToken;
  })();
  _ezRefreshPromise = pending;
  try { return await pending; }
  finally { if (_ezRefreshPromise === pending) _ezRefreshPromise = null; }
}

// Exchange Google ID token for app session.
// On first-ever signup, backend returns 400 { error: 'profile_required', googleName }.
// Caller must then retry with fullName.
async function ezLoginWithGoogle(credential, fullName) {
  _ezLoggingOut = false;
  const generation = _ezBeginAuthChange();
  const body = fullName ? { credential, fullName } : { credential };
  const res = await fetch(EZ_API_BASE + '/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  _ezCheckAuthGeneration(generation);
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'login_failed');
    err.code = data.error;
    err.googleName = data.googleName;
    err.credential = credential;
    throw err;
  }
  _ezAccessToken = data.accessToken;
  mirrorUserToLocal(data.user);
  return data.user;
}

// Email+password login (admin password-only / non-Google). On failure the
// backend returns a generic 401 { error: 'invalid_credentials' }.
async function ezLogin(email, password) {
  _ezLoggingOut = false;
  const generation = _ezBeginAuthChange();
  const res = await fetch(EZ_API_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  _ezCheckAuthGeneration(generation);
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'login_failed');
    err.code = data.error;
    throw err;
  }
  _ezAccessToken = data.accessToken;
  mirrorUserToLocal(data.user);
  return data.user;
}

async function ezLogout() {
  const generation = _ezBeginAuthChange();
  _ezLoggingOut = true;
  try {
    await fetch(EZ_API_BASE + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  if (generation !== _ezAuthGeneration) return;
  _ezAccessToken = null;
  localStorage.removeItem('ez_user');
  localStorage.removeItem('ez_courses');
  // Account-scoped learning data remains available when this learner returns.
  // Unowned legacy blobs are retained for explicit recovery, never imported.
  location.href = 'index.html';
}

// Validates current session. Tries refresh cookie first if no access token.
// Returns user object or null.
async function ezGetMe(authCheck = null) {
  const generation = _ezAuthGeneration;
  const invalidateCurrentSession = () => {
    if (generation !== _ezAuthGeneration || _ezLoggingOut) return;
    mirrorUserToLocal(null);
    // Let this guard redirect after its own invalidation without treating it
    // as a superseding login. A later account change still retires the guard.
    if (authCheck) authCheck.invalidatedGeneration = _ezAuthGeneration;
  };
  if (!_ezAccessToken) {
    try { await ezRefresh(); } catch { invalidateCurrentSession(); return null; }
  }
  let user;
  try {
    const res = await ezApi('/auth/me');
    if (!res.ok) { invalidateCurrentSession(); return null; }
    const data = await res.json();
    _ezCheckAuthGeneration(generation);
    mirrorUserToLocal(data.user);
    user = data.user;
  } catch { invalidateCurrentSession(); return null; }
  // An unfinished assignment remains resumable from its own lesson card, but
  // it must never hijack the page the learner intentionally opened.
  return user;
}

function mirrorUserToLocal(user) {
  const userId = user?.id || null;
  if (_ezSessionUserId !== userId) {
    const previousUserId = _ezSessionUserId;
    _ezSessionUserId = userId;
    // A refresh cookie can switch accounts in another tab without this page
    // calling a login function. Retire responses issued for the prior user.
    if (previousUserId !== null) _ezAuthGeneration++;
    // First refresh establishes the owner of an already in-flight lookup;
    // replacing an established account invalidates its outstanding results.
    if (previousUserId !== null || userId === null) ezClearUnfinishedAssignmentCache();
    _ezNotifyAuthChange();
  }
  if (!user) { localStorage.removeItem('ez_user'); return null; }
  const email = user.email || '';
  const name = user.fullName || (email ? email.split('@')[0] : 'User');
  const avatar = user.avatarUrl || '';
  const mirrored = {
    id: user.id,
    email,
    name,
    avatar,
    isAdmin: !!user.isAdmin,
    loggedInAt: Date.now(),
  };
  localStorage.setItem('ez_user', JSON.stringify(mirrored));
  return mirrored;
}

// Guard helper for protected pages. Redirects to login if not authenticated.
async function ezRequireAuth(loginPath) {
  const generation = _ezAuthGeneration;
  const authCheck = {};
  const user = await ezGetMe(authCheck);
  if (!user) {
    if (_ezLoggingOut || (generation !== _ezAuthGeneration
        && authCheck.invalidatedGeneration !== _ezAuthGeneration)) return null;
    const path = loginPath || 'login.html';
    const here = location.pathname.replace(/^\//, '') + location.search;
    location.replace(path + '?next=' + encodeURIComponent(here || 'dashboard.html'));
    return null;
  }
  return user;
}

window.ezApi = ezApi;
window.ezRefresh = ezRefresh;
window.ezLoginWithGoogle = ezLoginWithGoogle;
window.ezLogin = ezLogin;
window.ezLogout = ezLogout;
window.ezGetMe = ezGetMe;
window.mirrorUserToLocal = mirrorUserToLocal;
window.ezRequireAuth = ezRequireAuth;
window.ezGetUnfinishedAssignment = ezGetUnfinishedAssignment;
window.ezClearUnfinishedAssignmentCache = ezClearUnfinishedAssignmentCache;

// localStorage events arrive only in other tabs. Retire old requests and
// old in-memory lessons immediately; a fresh boot verifies the shared cookie.
window.addEventListener?.('storage', (event) => {
  if (event.key !== 'ez_user' && event.key !== null) return;
  let nextUserId = null;
  try { nextUserId = JSON.parse(event.newValue || 'null')?.id || null; } catch {}
  if (!_ezSessionUserId || nextUserId === _ezSessionUserId) return;
  _ezBeginAuthChange();
  window.location.reload?.();
});

// Keep student-facing API failures clear and consistent across the new
// platform pages; route/error codes should never be shown to learners.
function ezStudentErrorMessage(error, subject = 'Halaman ini') {
  const code = String(error?.message || '');
  if (code === 'AUTH_EXPIRED') return 'Sesi kamu sudah berakhir. Silakan masuk kembali.';
  if (code === 'not_enrolled' || code === 'course_not_found') return 'Akses ke kelas ini tidak tersedia atau sudah tidak aktif.';
  return `${subject} belum bisa dimuat. Periksa koneksi internet lalu coba lagi.`;
}
window.ezStudentErrorMessage = ezStudentErrorMessage;

// "Kelas kamu tidak muncul" is almost never a broken entitlement — it is
// almost always a second Google account. A student who lands on one of the
// dead-end screens ("Belum ada kelas aktif", the paywall) cannot tell which
// account they are signed in as, and neither can the admin who is looking at
// their screenshot, so the one fact that settles it is the one fact nobody
// can see. Print it on every dead end, with a way straight out.
//
// Pass the user object from ezRequireAuth() when the caller has it; otherwise
// this falls back to the ez_user mirror written by mirrorUserToLocal().
function ezSignedInAsHtml(user) {
  let email = user && user.email;
  if (!email) {
    try { email = JSON.parse(localStorage.getItem('ez_user') || '{}').email; } catch {}
  }
  if (!email) return '';
  const safe = String(email).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
  return `<p class="signed-in-as">Login sebagai <strong>${safe}</strong> · `
    + `<a href="#" onclick="event.preventDefault(); window.ezLogout();">Ganti akun</a></p>`;
}
window.ezSignedInAsHtml = ezSignedInAsHtml;
