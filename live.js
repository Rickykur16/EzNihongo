(() => {
  const app = document.getElementById('app');
  let data = null;
  let tab = 'upcoming';
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const fmt = (value, options = { dateStyle: 'medium', timeStyle: 'short' }) => value ? new Intl.DateTimeFormat('id-ID', options).format(new Date(value)) : '';
  const lessonUrl = (course, lesson) => `welcome.html?course=${encodeURIComponent(course)}&module=${encodeURIComponent(lesson.chapter.slug)}&lesson=${encodeURIComponent(lesson.slug)}`;
  async function api(path) { const response = await ezApi(path); const body = await response.json().catch(() => ({})); if (!response.ok) throw Error(body.error || 'request_failed'); return body; }
  function emptyState(recording) {
    if (recording && data.completedWithoutRecording) return `<div class="empty"><strong>Rekaman belum dibagikan.</strong><br>Ada kelas yang sudah selesai; rekamannya akan muncul di sini setelah tersedia.</div>`;
    return `<div class="empty"><strong>${recording ? 'Belum ada rekaman.' : 'Belum ada kelas mendatang.'}</strong><br>${recording ? 'Rekaman kelas yang dibagikan akan muncul di sini.' : 'Sambil menunggu jadwal berikutnya, kamu bisa melanjutkan Pelajaran.'}${recording ? '' : `<div class="actions"><a class="btn secondary" href="welcome.html?course=${encodeURIComponent(data.course.slug)}">Lanjut Belajar</a></div>`}</div>`;
  }
  function cards(items, recording) {
    if (!items.length) return emptyState(recording);
    return `<div class="list">${items.map((item) => `<article class="card"><div class="eyebrow">${recording ? 'REKAMAN' : 'UPCOMING'} · ${esc(item.status)}</div><h2>${esc(item.title)}</h2><div class="meta">${fmt(item.startsAt)}${item.endsAt ? ` – ${fmt(item.endsAt, { timeStyle: 'short' })}` : ''}</div>${item.description ? `<p>${esc(item.description)}</p>` : ''}${item.relatedLessons?.length ? `<ul class="related">${item.relatedLessons.map((lesson) => `<li>${esc(lesson.section || lesson.chapter.title)} · <strong>${esc(lesson.title)}</strong> <a href="${lessonUrl(data.course.slug, lesson)}">Ulangi Materi</a></li>`).join('')}</ul>` : ''}<div class="actions">${!recording && item.canJoin ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.meetingUrl)}">Join Class</a>` : ''}${recording ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.recordingUrl)}">Tonton Rekaman</a>` : ''}</div></article>`).join('')}</div>`;
  }
  function render() {
    const recording = tab === 'recordings';
    const items = recording ? data.recordings : data.upcoming;
    app.innerHTML = `<div class="page"><section class="hero"><div class="eyebrow">LIVE CLASS</div><h1>${esc(data.course.title)}</h1><p class="muted">Kelas langsung dan rekaman yang terhubung ke Pelajaran yang sudah ada.</p></section><div class="tabs" role="tablist" aria-label="Jenis Live Class"><button class="${!recording ? 'active' : ''}" data-tab="upcoming" type="button" role="tab" aria-selected="${!recording}">Upcoming</button><button class="${recording ? 'active' : ''}" data-tab="recordings" type="button" role="tab" aria-selected="${recording}">Recordings</button></div>${cards(items, recording)}</div>`;
    app.querySelectorAll('[data-tab]').forEach((button) => { button.onclick = () => { tab = button.dataset.tab; render(); }; });
  }
  function renderError(error) {
    const expired = String(error?.message) === 'AUTH_EXPIRED';
    app.innerHTML = `<div class="page"><div class="empty"><strong>Live Class belum bisa dimuat.</strong><br>${esc(ezStudentErrorMessage(error, 'Live Class'))}<div class="actions">${expired ? '<a class="btn" href="login.html?next=live.html">Masuk kembali</a>' : '<button class="btn" id="retry-live" type="button">Coba lagi</button>'}</div></div></div>`;
    document.getElementById('retry-live')?.addEventListener('click', load);
  }
  async function load() {
    try {
      const requested = new URLSearchParams(location.search).get('course') || '';
      const dashboard = await api(`/dashboard/me${requested ? `?course=${encodeURIComponent(requested)}` : ''}`);
      if (!dashboard.course) { app.innerHTML = '<div class="page"><div class="empty"><strong>Belum ada kelas aktif.</strong><br>Daftar atau aktifkan kelas untuk melihat Live Class.</div></div>'; return; }
      document.getElementById('learn-nav').href = `welcome.html?course=${encodeURIComponent(dashboard.course.slug)}`;
      document.getElementById('progress-nav').href = `progress.html?course=${encodeURIComponent(dashboard.course.slug)}`;
      data = await api(`/live-classes?course=${encodeURIComponent(dashboard.course.slug)}`);
      if (new URLSearchParams(location.search).get('tab') === 'recordings') tab = 'recordings';
      render();
    } catch (error) { renderError(error); }
  }
  document.getElementById('logout').onclick = () => ezLogout();
  (async () => { if (await ezRequireAuth('login.html')) load(); })();
})();
