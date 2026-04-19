// supabase-client.js — Supabase init (migrated from Nihonggo learn)
const SUPABASE_URL = 'https://bawgehtwhxhydgoztbhp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4mDzwW_QNliMylit68ESxA_kld_aW_S';

function ensureSupabase() {
  return new Promise((resolve) => {
    if (window._supabase) { resolve(window._supabase); return; }
    const init = () => {
      window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      resolve(window._supabase);
    };
    if (window.supabase) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = init;
    document.head.appendChild(s);
  });
}

function mirrorSessionToLocal(session) {
  if (!session || !session.user) {
    localStorage.removeItem('ez_user');
    return null;
  }
  const u = session.user;
  const email = u.email || '';
  const name = u.user_metadata?.full_name || (email ? email.split('@')[0] : 'User');
  const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture || '';
  const mirrored = { email, name, avatar, loggedInAt: Date.now() };
  localStorage.setItem('ez_user', JSON.stringify(mirrored));
  return mirrored;
}

async function ezLoginWithGoogle(nextUrl) {
  const sb = await ensureSupabase();
  const next = nextUrl || new URLSearchParams(location.search).get('next') || 'welcome.html';
  const redirectTo = location.origin + '/auth-callback.html?next=' + encodeURIComponent(next);
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

async function ezLogout() {
  const sb = await ensureSupabase();
  await sb.auth.signOut();
  localStorage.removeItem('ez_user');
  localStorage.removeItem('ez_courses');
  location.href = 'index.html';
}

async function ezGetSession() {
  const sb = await ensureSupabase();
  const { data: { session } } = await sb.auth.getSession();
  mirrorSessionToLocal(session);
  return session;
}

window.ensureSupabase = ensureSupabase;
window.mirrorSessionToLocal = mirrorSessionToLocal;
window.ezLoginWithGoogle = ezLoginWithGoogle;
window.ezLogout = ezLogout;
window.ezGetSession = ezGetSession;
