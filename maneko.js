(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = async path => { const response = await ezApi(path); if (!response.ok) throw Error('load_failed'); return response.json(); };
  let root, lastFocus, loading, summary, recommendations, seenSignature = '', courseUrl = 'welcome.html';
  const signature = () => JSON.stringify([summary?.total || 0, (recommendations?.weakGrammar || []).map(g => g.grammarId)]);
  function markSeen() { seenSignature = signature(); try { sessionStorage.setItem('ez_maneko_seen', seenSignature); } catch {} }
  function content() {
    if (loading) return '<h2>Menyiapkan fokus belajarmu…</h2><p>Aku sedang memeriksa jadwal review.</p>';
    if (!summary) return '<h2>Fokus belajar belum bisa dimuat</h2><p>Kamu tetap bisa membuka materi atau mencoba lagi.</p><div class="maneko-actions"><button class="maneko-primary" data-maneko-retry>Coba lagi</button><a class="maneko-link" href="welcome.html">Buka pelajaran</a></div>';
    if (summary.total > 0) return `<h2>Waktunya mengulang sebentar</h2><p>Ada materi yang siap direview berdasarkan riwayat belajarmu. Mulai dengan jawaban mandiri.</p><div class="maneko-actions"><a class="maneko-primary" href="review.html">Mulai review</a><a class="maneko-link" href="focus.html">Lihat detail</a></div>`;
    const weak = (recommendations?.weakGrammar || []).find(g => g.state === 'NEEDS_PRACTICE');
    if (weak) return `<h2>Perkuat satu pola dulu</h2><p>Pola <span lang="ja">${esc(weak.pattern)}</span> masih perlu latihan. Buka detail untuk memilih langkah berikutnya.</p><div class="maneko-actions"><a class="maneko-primary" href="focus.html">Lihat fokus belajar</a><a class="maneko-link" href="${esc(courseUrl)}">Lanjut belajar</a></div>`;
    return `<h2>Lanjutkan langkah kecilmu</h2><p>Belum ada review yang perlu dikerjakan. Lanjutkan pelajaran; rekomendasi akan mengikuti progresmu.</p><div class="maneko-actions"><a class="maneko-primary" href="${esc(courseUrl)}">Lanjut belajar</a><a class="maneko-link" href="focus.html">Lihat detail</a></div>`;
  }
  function renderContent() {
    if (!root) return;
    root.querySelector('[data-maneko-content]').innerHTML = content();
    root.querySelector('[data-maneko-retry]')?.addEventListener('click', refresh);
    const dot = root.querySelector('.maneko-dot');
    if (dot) dot.hidden = loading || !(summary?.total || recommendations?.weakGrammar?.length) || signature() === seenSignature;
    document.querySelectorAll('[data-maneko-dot]').forEach(node => { node.hidden = loading || !(summary?.total || recommendations?.weakGrammar?.length) || signature() === seenSignature; });
  }
  async function refresh() {
    if (loading) return;
    loading = true; renderContent();
    const data = await Promise.allSettled([get('/review/summary'), get('/recommendations/me')]);
    summary = data[0].status === 'fulfilled' ? data[0].value : null;
    recommendations = data[1].status === 'fulfilled' ? data[1].value : null;
    loading = false;
    if (root && !root.querySelector('.maneko-panel').hidden) markSeen();
    renderContent();
  }
  function close() {
    if (!root) return;
    root.querySelector('.maneko-panel').hidden = true;
    root.querySelector('.maneko-orb')?.setAttribute('aria-expanded', 'false');
    document.querySelector('.senpai-orb-btn')?.setAttribute('aria-expanded', 'false');
    if (lastFocus?.isConnected) lastFocus.focus();
  }
  function open() {
    if (window.innerHeight < 540 && window.innerWidth < 600) { location.href = 'focus.html'; return; }
    if (!root) mount({ externalOrb: !!window.AISenpai });
    lastFocus = document.activeElement === document.body ? document.querySelector('.senpai-orb-btn, .maneko-orb') : document.activeElement;
    root.querySelector('.maneko-panel').hidden = false;
    root.querySelector('.maneko-orb')?.setAttribute('aria-expanded', 'true');
    document.querySelector('.senpai-orb-btn')?.setAttribute('aria-expanded', 'true');
    markSeen(); renderContent(); root.querySelector('.maneko-close').focus();
  }
  function mount({ externalOrb = false } = {}) {
    if (root) return;
    try { seenSignature = sessionStorage.getItem('ez_maneko_seen') || ''; } catch {}
    root = document.createElement('div'); root.className = 'maneko-widget';
    root.innerHTML = `<section id="maneko-focus-panel" class="maneko-panel" aria-label="Fokus belajar bersama Maneko-chan" hidden><div class="maneko-top"><img src="assets/maneko.svg" alt=""><div><strong>Maneko-chan</strong><small>Teman belajarmu</small></div><button class="maneko-close" aria-label="Tutup Maneko">×</button></div><div data-maneko-content></div>${externalOrb ? '<div class="maneko-secondary"><button class="maneko-link" data-maneko-chat>Tanya materi kepada Maneko</button></div>' : ''}</section>${externalOrb ? '' : '<button class="maneko-orb" aria-label="Buka fokus belajar Maneko-chan" aria-expanded="false" aria-controls="maneko-focus-panel"><img src="assets/maneko.svg" alt=""><span class="maneko-dot" hidden></span></button>'}`;
    document.body.appendChild(root);
    root.querySelector('.maneko-close').addEventListener('click', close);
    root.querySelector('.maneko-orb')?.addEventListener('click', () => root.querySelector('.maneko-panel').hidden ? open() : close());
    root.querySelector('[data-maneko-chat]')?.addEventListener('click', () => { close(); window.AISenpai?.openExpanded(); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    document.addEventListener('click', event => { if (!root.querySelector('.maneko-panel').hidden && !event.composedPath().some(node => node === root || node.matches?.('.senpai-orb-btn'))) close(); });
    refresh();
  }
  async function renderDetails() {
    const host = document.getElementById('focus-app');
    if (!host) return;
    host.innerHTML = '<p role="status">Memuat fokus belajarmu…</p>';
    try {
      const [review, data] = await Promise.all([get('/review/summary'), get('/recommendations/me')]);
      const patterns = data.weakGrammar || [];
      const groups = [['Perlu diperkuat', patterns.filter(g => g.state === 'NEEDS_PRACTICE')], ['Saatnya mengulang', patterns.filter(g => g.state !== 'NEEDS_PRACTICE')]];
      host.innerHTML = `<a class="maneko-link" href="dashboard.html">← Dashboard</a><h1>Fokus belajarmu</h1><p class="maneko-focus-intro">Pilih satu langkah bersama Maneko. Review mandiri mengukur ingatan; bantuan dicatat sebagai latihan.</p><div class="maneko-actions"><a class="maneko-primary" href="${review.total ? 'review.html' : 'welcome.html'}">${review.total ? 'Mulai review mandiri' : 'Lanjut belajar'}</a><a class="maneko-link" href="progress.html">Lihat progres</a></div>${groups.map(([title, items]) => items.length ? `<h2>${title}</h2><div class="maneko-focus-list">${items.map(g => `<article class="maneko-focus-item"><span class="maneko-focus-tag">${g.state === 'NEEDS_PRACTICE' ? 'Penguatan materi' : 'Pengulangan terjadwal'}</span><h3 lang="ja">${esc(g.pattern)}</h3><p>${esc(g.message)}</p><small>${g.score == null ? 'Bukti belum cukup untuk menampilkan skor.' : `Skor penguasaan: ${esc(g.score)}% · ${esc(g.attempts)} percobaan mandiri`}</small></article>`).join('')}</div>` : '').join('')}${!patterns.length ? '<h2>Belum ada pola khusus yang disarankan</h2><p class="maneko-focus-intro">Lanjutkan belajar atau buka review yang tersedia. Rekomendasi muncul saat data belajarmu cukup.</p>' : ''}${(data.recommendedLessons || []).length ? `<h2>Pelajaran yang bisa diulang</h2><div class="maneko-focus-list">${data.recommendedLessons.map(l => `<a class="maneko-focus-item maneko-link" href="welcome.html?focusLesson=${encodeURIComponent(l.id)}">${esc(l.title)} →</a>`).join('')}</div>` : ''}`;
    } catch { host.innerHTML = '<h1>Fokus belajar belum bisa dimuat</h1><p>Coba lagi atau lanjutkan pelajaran.</p><div class="maneko-actions"><button class="maneko-primary" id="focus-retry">Coba lagi</button><a class="maneko-link" href="welcome.html">Lanjut belajar</a></div>'; host.querySelector('#focus-retry').onclick = renderDetails; }
  }
  window.Maneko = { mount, open, close, refresh, renderDetails, setContinue(url) { courseUrl = url; renderContent(); } };
})();
