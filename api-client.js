// api-client.js — EzNihongo self-hosted API client
// Replaces supabase-client.js. Auth via /api/auth/* on same origin.

const EZ_API_BASE = '/api';
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
    } catch (e) {
      _ezAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
  }
  return res;
}

async function ezRefresh() {
  if (_ezRefreshPromise) return _ezRefreshPromise;
  _ezRefreshPromise = (async () => {
    const res = await fetch(EZ_API_BASE + '/auth/refresh', {
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

// Exchange Google ID token for app session.
// On first-ever signup, backend returns 400 { error: 'profile_required', googleName }.
// Caller must then retry with fullName.
async function ezLoginWithGoogle(credential, fullName) {
  const body = fullName ? { credential, fullName } : { credential };
  const res = await fetch(EZ_API_BASE + '/auth/google', {
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
    await fetch(EZ_API_BASE + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  _ezAccessToken = null;
  localStorage.removeItem('ez_user');
  localStorage.removeItem('ez_courses');
  localStorage.removeItem('ez_progress');
  localStorage.removeItem('ez_stats');
  location.href = 'index.html';
}

// Validates current session. Tries refresh cookie first if no access token.
// Returns user object or null.
async function ezGetMe() {
  if (!_ezAccessToken) {
    try { await ezRefresh(); } catch { mirrorUserToLocal(null); return null; }
  }
  try {
    const res = await ezApi('/auth/me');
    if (!res.ok) { mirrorUserToLocal(null); return null; }
    const data = await res.json();
    mirrorUserToLocal(data.user);
    return data.user;
  } catch { mirrorUserToLocal(null); return null; }
}

function mirrorUserToLocal(user) {
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
  const user = await ezGetMe();
  if (!user) {
    const path = loginPath || 'login.html';
    const here = location.pathname.replace(/^\//, '') + location.search;
    location.replace(path + '?next=' + encodeURIComponent(here || 'welcome.html'));
    return null;
  }
  return user;
}

window.ezApi = ezApi;
window.ezRefresh = ezRefresh;
window.ezLoginWithGoogle = ezLoginWithGoogle;
window.ezLogout = ezLogout;
window.ezGetMe = ezGetMe;
window.mirrorUserToLocal = mirrorUserToLocal;
window.ezRequireAuth = ezRequireAuth;
