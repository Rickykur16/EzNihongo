(() => {
  const app = document.getElementById('app');
  const release = '20260902-4';
  let data = null;
  let tab = 'upcoming';
  let signedInUser = null;
  const tabs = ['upcoming', 'recordings'];
  const tabId = (value) => `live-tab-${value}`;
  const panelId = (value) => `live-panel-${value}`;
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
    return `<div class="list">${items.map((item) => `<article class="card ${recording ? 'recording-card' : 'upcoming-card'}"><div class="eyebrow">${recording ? 'REKAMAN' : 'UPCOMING'} · ${esc(item.status)}</div><h2>${esc(item.title)}</h2><div class="meta">${fmt(item.startsAt)}${item.endsAt ? ` – ${fmt(item.endsAt, { timeStyle: 'short' })}` : ''}</div>${item.description ? `<p>${esc(item.description)}</p>` : ''}${item.relatedLessons?.length ? `<ul class="related">${item.relatedLessons.map((lesson) => `<li>${esc(lesson.section || lesson.chapter.title)} · <strong>${esc(lesson.title)}</strong> <a href="${lessonUrl(data.course.slug, lesson)}">Ulangi Materi</a></li>`).join('')}</ul>` : ''}<div class="actions">${!recording && item.canJoin ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.meetingUrl)}">Join Class</a>` : ''}${recording ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.recordingUrl)}">Tonton Rekaman</a>` : ''}</div></article>`).join('')}</div>`;
  }
  function activateTab(next, { focus = false } = {}) {
    if (!tabs.includes(next)) return;
    tab = next;
    app.querySelectorAll('[role="tab"]').forEach((button) => {
      const selected = button.dataset.tab === tab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    app.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });
    if (focus) document.getElementById(tabId(tab))?.focus();
  }
  function handleTabKeydown(event) {
    const current = tabs.indexOf(event.currentTarget.dataset.tab);
    let next = null;
    if (event.key === 'ArrowRight') next = tabs[(current + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(current - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    activateTab(next, { focus: true });
  }
  function tabPanel(value) {
    const recording = value === 'recordings';
    const selected = tab === value;
    const items = recording ? data.recordings : data.upcoming;
    return `<section class="live-tabpanel" id="${panelId(value)}" data-panel="${value}" role="tabpanel" aria-labelledby="${tabId(value)}" tabindex="0"${selected ? '' : ' hidden'}>${cards(items, recording)}</section>`;
  }
  function render() {
    app.innerHTML = `<div class="page"><section class="hero"><div class="eyebrow">生配信 · LIVE CLASS</div><h1>${esc(data.course.title)}</h1><p>Kelas langsung dan rekaman yang terhubung ke Pelajaran yang sudah ada.</p></section><div class="tabs" role="tablist" aria-label="Jenis Live Class" aria-orientation="horizontal">${tabs.map((value) => {
      const selected = tab === value;
      return `<button class="${selected ? 'active' : ''}" id="${tabId(value)}" data-tab="${value}" type="button" role="tab" aria-controls="${panelId(value)}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${value === 'upcoming' ? 'Mendatang' : 'Rekaman'}</button>`;
    }).join('')}</div>${tabs.map(tabPanel).join('')}</div>`;
    app.querySelectorAll('[role="tab"]').forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.tab, { focus: true }));
      button.addEventListener('keydown', handleTabKeydown);
    });
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
      if (!dashboard.course) { app.innerHTML = `<div class="page"><div class="empty"><strong>Belum ada kelas aktif.</strong><br>Daftar atau aktifkan kelas untuk melihat Live Class.${ezSignedInAsHtml(signedInUser)}</div></div>`; return; }
      document.getElementById('learn-nav').href = `welcome.html?course=${encodeURIComponent(dashboard.course.slug)}`;
      document.getElementById('progress-nav').href = `progress.html?v=${release}&course=${encodeURIComponent(dashboard.course.slug)}`;
      data = await api(`/live-classes?course=${encodeURIComponent(dashboard.course.slug)}`);
      if (new URLSearchParams(location.search).get('tab') === 'recordings') tab = 'recordings';
      render();
    } catch (error) { renderError(error); }
  }
  document.getElementById('logout').onclick = () => ezLogout();
  (async () => {
    signedInUser = await ezRequireAuth('login.html');
    if (signedInUser) load();
  })();
})();
