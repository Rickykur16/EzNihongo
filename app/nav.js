// nav.js — inject shared navbar + dark mode toggle + EzNihongo API auth

// Ensures window.ezGetMe / ezLogout are available. api-client.js should
// already be loaded via <script> before nav.js, but we lazy-load it here as a
// safety net in case a page forgets.
function ensureApiClient() {
  return new Promise((resolve) => {
    if (typeof window.ezGetMe === 'function') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'api-client.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}
function renderNav() {
  return `
  <nav class="nav">
    <a href="index.html" class="nav-logo"><img src="logo.png" alt="EzNihongo" class="nav-logo-img"></a>

    <div class="nav-links" id="nav-links">
      <a href="index.html">Home</a>
      <a href="index.html#kursus">Kursus</a>
      <a href="#">Tentang</a>
      <div class="social-icons nav-social-mobile">
        <a class="social-icon" href="https://facebook.com/eznihongo" target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </a>
        <a class="social-icon" href="https://youtube.com/@eznihongo" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
        </a>
        <a class="social-icon" href="https://instagram.com/eznihongoofficial" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="white"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="white" stroke-width="2"/></svg>
        </a>
        <a class="social-icon" href="https://www.tiktok.com/@eznihongoofficial" target="_blank" rel="noopener" aria-label="TikTok">
          <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
        </a>
      </div>
      <div id="nav-auth-mobile" class="nav-auth-mobile"></div>
    </div>

    <div class="nav-right">
      <div class="social-icons nav-social-desktop">
        <a class="social-icon" href="https://facebook.com/eznihongo" target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </a>
        <a class="social-icon" href="https://youtube.com/@eznihongo" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
        </a>
        <a class="social-icon" href="https://instagram.com/eznihongoofficial" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="white"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="white" stroke-width="2"/></svg>
        </a>
        <a class="social-icon" href="https://www.tiktok.com/@eznihongoofficial" target="_blank" rel="noopener" aria-label="TikTok">
          <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
        </a>
      </div>
      <button class="btn-theme" id="theme-toggle" title="Toggle dark mode" aria-label="Toggle dark mode">
        <svg id="icon-moon" class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg id="icon-sun" class="icon-sun" viewBox="0 0 24 24" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
      <div id="nav-auth" class="nav-auth-desktop"></div>
      <button class="btn-hamburger" id="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const moonIcon = document.getElementById('icon-moon');
  const sunIcon  = document.getElementById('icon-sun');
  if (moonIcon) moonIcon.style.display = dark ? 'none' : 'block';
  if (sunIcon)  sunIcon.style.display  = dark ? 'block' : 'none';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !isDark;
  localStorage.setItem('nihongo-theme', next ? 'dark' : 'light');
  applyTheme(next);
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureApiClient();
  const navEl = document.getElementById('navbar');
  if (navEl) navEl.innerHTML = renderNav();

  // Apply saved theme or system preference
  const saved = localStorage.getItem('nihongo-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(isDark);

  // Attach toggle handler
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);

  // Hamburger toggle
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', open);
    });
    // Tutup menu saat klik link
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
      });
    });
  }

  // Auth area — resolves via refresh cookie → /api/kanji-auth/me.
  const user = typeof window.ezGetMe === 'function' ? await window.ezGetMe() : null;

  function buildAuthHTML(u, isMobile) {
    if (u) {
      const name    = u.fullName || (u.email ? u.email.split('@')[0] : 'User');
      const initial = name.charAt(0).toUpperCase();
      return `
        <div style="display:flex;align-items:center;gap:10px;${isMobile ? 'padding:4px 0;' : ''}">
          <a href="dashboard.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--red);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;">${initial}</div>
            <span style="font-size:14px;font-weight:500;color:var(--text-primary);">${name}</span>
          </a>
          <button class="btn btn-login" onclick="logoutUser()">Keluar</button>
        </div>`;
    }
    return `
      <a href="login.html"><button class="btn btn-login">Masuk</button></a>
      <a href="register.html"><button class="btn btn-primary">Daftar</button></a>`;
  }

  const navAuth = document.getElementById('nav-auth');
  if (navAuth) navAuth.innerHTML = buildAuthHTML(user, false);

  const navAuthMobile = document.getElementById('nav-auth-mobile');
  if (navAuthMobile) navAuthMobile.innerHTML = buildAuthHTML(user, true);
});

async function logoutUser() {
  if (typeof window.ezLogout === 'function') {
    await window.ezLogout();
  } else {
    location.href = 'index.html';
  }
}
