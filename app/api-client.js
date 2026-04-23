// app/api-client.js — Kanji PWA client for the self-hosted API.
//
// This realm is SEPARATE from the main eznihongo.com site:
//   - hits /api/kanji-auth/* instead of /api/auth/* (its own users table)
//   - refresh cookie is `ez_kanji_refresh`, host-only to app.eznihongo.com
//   - access-token JWTs carry scope='kanji' so the main site can't honor them
//   - local mirror stored at `ez_kanji_user` (not `ez_user`) to avoid
//     colliding with a main-site session in the same browser
//
// Override the base URL (e.g. for staging) by setting `window.EZ_API_BASE`
// BEFORE loading this script. Nginx on app.eznihongo.com proxies /api → backend.

const EZ_API_BASE = (typeof window !== 'undefined' && window.EZ_API_BASE) || '/api';
const LOCAL_USER_KEY = 'ez_kanji_user';
let _ezAccessToken = null;
let _ezRefreshPromise = null;

async function _ezFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (_ezAccessToken) headers['Authorization'] = 'Bearer ' + _ezAccessToken;
  return fetch(EZ_API_BASE + path, { ...opts, headers, credentials: 'include' });
}

async function ezApi(path, opts = {}) {
  let res = await _ezFetch(path, opts);
  if (res.status === 401) {
    try {
      await ezRefresh();
      res = await _ezFetch(path, opts);
    } catch {
      _ezAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
  }
  return res;
}

async function ezRefresh() {
  if (_ezRefreshPromise) return _ezRefreshPromise;
  _ezRefreshPromise = (async () => {
    const res = await fetch(EZ_API_BASE + '/kanji-auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('refresh_failed');
    const data = await res.json();
    _ezAccessToken = data.accessToken;
    if (data.user) mirrorUserToLocal(data.user);
    return _ezAccessToken;
  })();
  try { return await _ezRefreshPromise; }
  finally { _ezRefreshPromise = null; }
}

// Exchange Google ID token for a Kanji PWA session.
// Pass fullName ALWAYS — the PWA captures the display name on every fresh
// sign-in, so the kanji_users row stays in sync with whatever the user typed
// rather than defaulting to the Google account name.
// Backend still returns 400 { error: 'profile_required', googleName } if the
// caller omits fullName and no row exists yet; UI should surface that form.
async function ezLoginWithGoogle(credential, fullName) {
  const body = fullName ? { credential, fullName } : { credential };
  const res = await fetch(EZ_API_BASE + '/kanji-auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
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

async function ezLogout() {
  try {
    await fetch(EZ_API_BASE + '/kanji-auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  _ezAccessToken = null;
  try { localStorage.removeItem(LOCAL_USER_KEY); } catch {}
  location.href = 'index.html';
}

async function ezGetMe() {
  if (!_ezAccessToken) {
    try { await ezRefresh(); } catch { mirrorUserToLocal(null); return null; }
  }
  try {
    const res = await ezApi('/kanji-auth/me');
    if (!res.ok) { mirrorUserToLocal(null); return null; }
    const data = await res.json();
    mirrorUserToLocal(data.user);
    return data.user;
  } catch { mirrorUserToLocal(null); return null; }
}

function mirrorUserToLocal(user) {
  if (!user) { try { localStorage.removeItem(LOCAL_USER_KEY); } catch {} return null; }
  const email = user.email || '';
  const name = user.fullName || (email ? email.split('@')[0] : 'User');
  const avatar = user.avatarUrl || '';
  const mirrored = {
    id: user.id,
    email,
    name,
    avatar,
    loggedInAt: Date.now(),
  };
  try { localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(mirrored)); } catch {}
  return mirrored;
}

window.ezApi = ezApi;
window.ezRefresh = ezRefresh;
window.ezLoginWithGoogle = ezLoginWithGoogle;
window.ezLogout = ezLogout;
window.ezGetMe = ezGetMe;
window.mirrorUserToLocal = mirrorUserToLocal;
