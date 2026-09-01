(() => {
  const app = document.getElementById('app');
  let data = null;
  let tab = 'upcoming';
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const fmt = (value, options = { dateStyle: 'medium', timeStyle: 'short' }) => value ? new Intl.DateTimeFormat('id-ID', options).format(new Date(value)) : '';
  const lessonUrl = (course, lesson) => `welcome.html?course=${encodeURIComponent(course)}&module=${encodeURIComponent(lesson.chapter.slug)}&lesson=${encodeURIComponent(lesson.slug)}`;
  async function api(path) { const response = await ezApi(path); const body = await response.json().catch(() => ({})); if (!response.ok) throw Error(body.error || 'request_failed'); return body; }
  function cards(items, recording) {
    if (!items.length) return `<div class="empty">Belum ada ${recording ? 'rekaman' : 'kelas mendatang'} untuk kelas ini.</div>`;
    return `<div class="list">${items.map((item) => `<article class="card"><div class="eyebrow">${recording ? 'REKAMAN' : 'UPCOMING'} · ${esc(item.status)}</div><h2>${esc(item.title)}</h2><div class="meta">${fmt(item.startsAt)}${item.endsAt ? ` – ${fmt(item.endsAt, { timeStyle: 'short' })}` : ''}</div>${item.description ? `<p>${esc(item.description)}</p>` : ''}${item.relatedLessons?.length ? `<ul class="related">${item.relatedLessons.map((lesson) => `<li>${esc(lesson.section || lesson.chapter.title)} · <strong>${esc(lesson.title)}</strong> <a href="${lessonUrl(data.course.slug, lesson)}">Ulangi Materi</a></li>`).join('')}</ul>` : ''}<div class="actions">${!recording && item.canJoin ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.meetingUrl)}">Join Class</a>` : ''}${recording ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.recordingUrl)}">Tonton Rekaman</a>` : ''}</div></article>`).join('')}</div>`;
  }
  function render() {
    const items = tab === 'upcoming' ? data.upcoming : data.recordings;
    app.innerHTML = `<div class="page"><section class="hero"><div class="eyebrow">LIVE CLASS</div><h1>${esc(data.course.title)}</h1><p class="muted">Kelas langsung dan rekaman materi yang terhubung ke Pelajaran yang sudah ada.</p></section><div class="tabs"><button class="${tab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">Upcoming</button><button class="${tab === 'recordings' ? 'active' : ''}" data-tab="recordings">Recordings</button></div>${cards(items, tab === 'recordings')}</div>`;
    app.querySelectorAll('[data-tab]').forEach((button) => { button.onclick = () => { tab = button.dataset.tab; render(); }; });
  }
  async function load() {
    try {
      const requested = new URLSearchParams(location.search).get('course') || '';
      const dashboard = await api(`/dashboard/me${requested ? `?course=${encodeURIComponent(requested)}` : ''}`);
      if (!dashboard.course) { app.innerHTML = '<div class="page"><div class="empty">Belum ada kelas aktif.</div></div>'; return; }
      document.getElementById('learn-nav').href = `welcome.html?course=${encodeURIComponent(dashboard.course.slug)}`;
      data = await api(`/live-classes?course=${encodeURIComponent(dashboard.course.slug)}`);
      if (new URLSearchParams(location.search).get('tab') === 'recordings') tab = 'recordings';
      render();
    } catch (error) { app.innerHTML = `<div class="page"><div class="empty">Live Class belum bisa dimuat: ${esc(error.message)}</div></div>`; }
  }
  document.getElementById('logout').onclick = () => ezLogout();
  (async () => { if (await ezRequireAuth('login.html')) load(); })();
})();
