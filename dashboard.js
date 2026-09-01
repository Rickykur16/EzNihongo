(() => {
  const app = document.getElementById('dashboard-app');
  const labels = { kana: 'Kana', vocabulary: 'Kosakata', kanji: 'Kanji', grammar: 'Grammar' };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  async function get(path) {
    const response = await ezApi(path);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error || 'request_failed');
    return body;
  }
  function learnUrl(data) {
    const course = data.course?.slug; const next = data.continueLearning;
    if (!course) return 'welcome.html';
    const params = new URLSearchParams({ course });
    if (next) { params.set('module', next.chapter.slug); params.set('lesson', next.lesson.slug); }
    return `welcome.html?${params}`;
  }
  const reviewUrl = (category = 'mixed') => category === 'mixed' ? 'review.html' : `review.html?category=${encodeURIComponent(category)}`;
  const courseUrl = (path, course) => `${path}?course=${encodeURIComponent(course)}`;
  const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  function errorMarkup(error) {
    const expired = String(error?.message) === 'AUTH_EXPIRED';
    return `<section class="card state-card"><div class="eyebrow">DASHBOARD</div><h1>Dashboard belum bisa dimuat</h1><p class="muted">${esc(ezStudentErrorMessage(error, 'Dashboard'))}</p>${expired ? '<a class="primary" href="login.html?next=dashboard.html">Masuk kembali</a>' : '<button class="secondary" id="retry-dashboard" type="button">Coba lagi</button>'}</section>`;
  }
  function masteryRow(key, value = {}) {
    const percent = value.percentage;
    return `<div class="mastery-row"><strong>${labels[key]}</strong><div class="bar" aria-label="${labels[key]} ${percent == null ? 'belum cukup data' : `${percent}%`}"><i style="width:${percent == null ? 0 : percent}%"></i></div><span class="state">${percent == null ? 'Belum cukup data' : `${percent}% · `}${esc(value.label || 'Belum cukup data')}</span></div>`;
  }
  function render(data) {
    if (!data.course) {
      app.innerHTML = '<section class="card state-card"><div class="eyebrow">DASHBOARD</div><h1>Belum ada kelas aktif</h1><p class="muted">Kelas aktif akan muncul setelah pendaftaran selesai.</p><a class="primary" href="welcome.html">Buka Belajar</a></section>';
      return;
    }
    const course = data.course; const next = data.continueLearning; const review = data.review || { total: 0, byCategory: {} };
    const mastery = data.mastery || {}; const activity = data.weeklyActivity || {}; const focus = data.focus; const live = data.liveClass || {};
    const focusMarkup = focus
      ? `<h3>${esc(focus.title)}</h3><p class="muted">${esc(focus.detail)}</p><a class="secondary" href="${focus.action === 'continue' ? learnUrl(data) : reviewUrl(focus.reviewCategory || 'mixed')}">${focus.action === 'continue' ? 'Lanjut Belajar' : 'Latihan Fokus'}</a>`
      : '<p class="muted">Belum ada fokus khusus. Tambahkan bukti latihan untuk mendapatkan rekomendasi.</p>';
    document.getElementById('learn-nav').href = learnUrl(data);
    document.getElementById('live-nav').href = courseUrl('live.html', course.slug);
    document.getElementById('progress-nav').href = courseUrl('progress.html', course.slug);
    const liveMarkup = live.next
      ? `<h2>${esc(live.next.title)}</h2><p class="muted">${formatDate(live.next.startsAt)}</p>${live.next.canJoin ? `<a class="primary" target="_blank" rel="noopener" href="${esc(live.next.meetingUrl)}">Join Class</a>` : `<a class="secondary" href="${courseUrl('live.html', course.slug)}">Lihat jadwal</a>`}`
      : '<h2>Belum ada kelas terjadwal</h2><p class="muted">Kelas dan rekaman akan muncul di sini saat tersedia.</p>';
    const recordings = (live.recentRecordings || []).map((item) => `<li>${esc(item.title)} <a target="_blank" rel="noopener" href="${esc(item.recordingUrl)}">Tonton</a></li>`).join('');
    app.innerHTML = `<section class="hero"><div><div class="eyebrow">DASHBOARD</div><h1>${data.greetingName ? `Halo, ${esc(data.greetingName)}.` : 'Halo.'}</h1><p class="muted">${esc(course.level || course.slug.toUpperCase())} · ${course.progress.percentage}% kurikulum selesai</p></div>${data.courses?.length > 1 ? `<label class="course-switch"><span>Kelas aktif</span><select class="course-select" id="course-select" aria-label="Pilih kelas">${data.courses.map((item) => `<option value="${esc(item.slug)}" ${item.id === course.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label>` : ''}</section>
    <section class="grid"><article class="card"><div class="eyebrow">PROGRES KELAS</div><div class="course-progress">${course.progress.percentage}% selesai</div><p class="muted">${course.progress.completedLessons} dari ${course.progress.totalLessons} Pelajaran selesai. Ini progres kurikulum, bukan mastery.</p><a class="secondary compact-action" href="${courseUrl('progress.html', course.slug)}">Lihat Progress</a></article><article class="card"><div class="eyebrow">LANJUT BELAJAR</div>${next ? `<div class="continue-label">${esc(next.section || 'Kurikulum')} · ${esc(next.chapter.title)}</div><div class="continue-title">${esc(next.lesson.title)}</div><a class="primary" href="${learnUrl(data)}">Lanjut Belajar</a>` : '<div class="continue-title">Kurikulum selesai</div><p class="muted">Semua Pelajaran pada kelas ini sudah selesai.</p>'}</article></section>
    <section class="grid"><article class="card"><div class="eyebrow">SMART REVIEW</div><div class="review-count">${review.total} item perlu direview</div><div class="counts">${Object.entries(labels).map(([key, label]) => `<div class="count"><strong>${Number(review.byCategory?.[key]) || 0}</strong><span>${label}</span></div>`).join('')}</div>${review.total ? `<a class="primary" href="${reviewUrl()}">Mulai Review</a>` : '<p class="muted">Review hari ini selesai. Lanjutkan belajar untuk membuka materi review berikutnya.</p>'}</article><article class="card live"><div class="eyebrow">LIVE CLASS · NEXT CLASS</div>${liveMarkup}${recordings ? `<div class="eyebrow recordings-label">RECENT RECORDINGS</div><ul class="live-recordings">${recordings}</ul>` : ''}<a class="secondary live-all" href="${courseUrl('live.html', course.slug)}">Lihat Semua</a></article></section>
    <section class="card"><div class="performance"><div><div class="eyebrow">PERFORMA BELAJAR</div><h2>Bukti latihan, bukan progres kurikulum.</h2>${Object.entries(labels).map(([key]) => masteryRow(key, mastery[key])).join('')}</div><aside class="focus"><div class="eyebrow">FOKUS BELAJARMU</div>${focusMarkup}</aside></div></section>
    <section class="card activity-card"><div class="eyebrow">AKTIVITAS MINGGU INI</div><h2>Perilaku belajar, bukan mastery.</h2><div class="activity"><div class="metric"><strong>${activity.activeDays || 0}</strong><span>hari aktif</span></div><div class="metric"><strong>${activity.lessonsCompleted || 0}</strong><span>Pelajaran selesai</span></div><div class="metric"><strong>${activity.reviewQuestions || 0}</strong><span>review selesai</span></div><div class="metric"><strong>${activity.accuracy == null ? '—' : `${activity.accuracy}%`}</strong><span>akurasi latihan</span></div></div><div class="insight">${esc(data.weeklyInsight?.message || 'Belum cukup data untuk melihat insight minggu ini.')}</div></section>`;
    document.getElementById('course-select')?.addEventListener('change', (event) => load(event.target.value));
  }
  async function load(course = '') {
    try { render(await get(`/dashboard/me${course ? `?course=${encodeURIComponent(course)}` : ''}`)); }
    catch (error) { app.innerHTML = errorMarkup(error); document.getElementById('retry-dashboard')?.addEventListener('click', () => load(course)); }
  }
  document.getElementById('logout').addEventListener('click', () => ezLogout());
  (async () => { if (await ezRequireAuth('login.html')) load(new URLSearchParams(location.search).get('course') || ''); })();
})();
