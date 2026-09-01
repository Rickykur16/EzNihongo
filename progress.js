(() => {
  const app = document.getElementById('progress-app');
  const labels = { kana: 'Kana', vocabulary: 'Kosakata', kanji: 'Kanji', grammar: 'Grammar' };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  async function api(path) { const response = await ezApi(path); const body = await response.json().catch(() => ({})); if (!response.ok) throw Error(body.error || 'request_failed'); return body; }
  const url = (path, course) => `${path}?course=${encodeURIComponent(course)}`;
  function mastery(key, value = {}) {
    const percent = value.percentage;
    return `<div class="mastery-row"><strong>${labels[key]}</strong><div class="bar" aria-label="${labels[key]} ${percent == null ? 'belum cukup data' : `${percent}%`}"><i style="width:${percent == null ? 0 : percent}%"></i></div><span class="state">${percent == null ? 'Belum cukup data' : `${percent}% · `}${esc(value.label || 'Belum cukup data')}</span></div>`;
  }
  function chapter(item) {
    const performance = item.performance || {};
    return `<article class="chapter"><div class="chapter-top"><div><h3>${esc(item.title)}</h3><span class="muted">${esc(item.section || 'Kurikulum')}</span></div><strong>${item.progress.percentage}% selesai</strong></div><div class="chapter-progress-bar" role="progressbar" aria-label="Progres ${esc(item.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.progress.percentage}"><i style="width:${item.progress.percentage}%"></i></div><div class="chapter-meta"><span class="pill">${item.progress.completedLessons}/${item.progress.totalLessons} Pelajaran</span><span class="pill">${performance.percentage == null ? 'Belum cukup data' : `${esc(performance.label)} · ${performance.percentage}%`}</span>${item.reviewDue ? '<a class="pill" href="review.html">' + item.reviewDue + ' item review</a>' : ''}</div></article>`;
  }
  function trendText(activity) {
    if (activity.accuracyTrend == null) return 'Belum cukup data untuk melihat tren akurasi.';
    if (activity.accuracyTrend > 0) return `Akurasi latihan naik ${activity.accuracyTrend}% dibanding 7 hari sebelumnya.`;
    if (activity.accuracyTrend < 0) return `Akurasi latihan turun ${Math.abs(activity.accuracyTrend)}% dibanding 7 hari sebelumnya.`;
    return 'Akurasi latihan stabil dibanding 7 hari sebelumnya.';
  }
  function render(data) {
    if (!data.course) { app.innerHTML = '<div class="page"><div class="empty"><strong>Belum ada kelas aktif.</strong><br>Kelas aktif akan muncul setelah pendaftaran selesai.</div></div>'; return; }
    const course = data.course; const activity = data.weeklyActivity || {}; const masteryData = data.mastery || {};
    const grouped = new Map(); for (const item of data.chapters || []) { const section = item.section || 'Kurikulum'; if (!grouped.has(section)) grouped.set(section, []); grouped.get(section).push(item); }
    document.getElementById('learn-nav').href = url('welcome.html', course.slug);
    document.getElementById('live-nav').href = url('live.html', course.slug);
    app.innerHTML = `<div class="page"><section class="hero"><div><div class="eyebrow">進捗 · PROGRESS</div><h1>${esc(course.title)}</h1><p class="muted">Progres kelas menunjukkan penyelesaian kurikulum. Performa berasal dari bukti latihan.</p></div>${data.courses?.length > 1 ? `<label class="course-switch"><span>Kelas aktif</span><select id="course" class="course-select" aria-label="Pilih kelas">${data.courses.map((item) => `<option value="${esc(item.slug)}" ${item.id === course.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label>` : ''}</section><section class="grid"><article class="card"><div class="eyebrow">PROGRES KELAS</div><div class="number">${course.progress.percentage}%</div><div class="course-progress-bar" role="progressbar" aria-label="Progres kelas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${course.progress.percentage}"><i style="width:${course.progress.percentage}%"></i></div><p class="muted">${course.progress.completedLessons} dari ${course.progress.totalLessons} Pelajaran selesai.</p></article><article class="card"><div class="eyebrow">AKTIVITAS 7 HARI</div><h2>${activity.activeDays || 0} hari aktif</h2><p class="muted">${activity.lessonsCompleted || 0} Pelajaran · ${activity.reviewQuestions || 0} review · ${activity.accuracy == null ? 'Akurasi belum cukup data' : `${activity.accuracy}% akurasi`}</p></article></section><section class="card"><div class="eyebrow">PERFORMA</div><h2>Mastery berdasarkan bukti latihan</h2><div class="mastery">${Object.entries(labels).map(([key]) => mastery(key, masteryData[key])).join('')}</div></section><section class="card trend-card"><div class="eyebrow">AKTIVITAS & TREN</div><p>${esc(trendText(activity))}</p><p class="muted">${esc(data.weeklyInsight?.message || 'Lanjutkan dengan ritme belajar yang nyaman.')}</p>${data.review?.total ? `<a class="btn" href="review.html">Mulai Smart Review (${data.review.total})</a>` : ''}</section><section class="sections"><div><div class="eyebrow">PER BAB</div><h2>Progres dan kebutuhan review</h2></div>${[...grouped.entries()].map(([section, items]) => `<section><h3 class="section-title">${esc(section)}</h3><div class="chapters">${items.map(chapter).join('')}</div></section>`).join('') || '<div class="empty">Belum ada Bab pada kelas ini.</div>'}</section></div>`;
    app.querySelector('#course')?.addEventListener('change', (event) => load(event.target.value));
  }
  function renderError(error, course) {
    const expired = String(error?.message) === 'AUTH_EXPIRED';
    app.innerHTML = `<div class="page"><div class="empty"><strong>Progress belum bisa dimuat.</strong><br>${esc(ezStudentErrorMessage(error, 'Progress'))}<div class="chapter-meta">${expired ? '<a class="btn" href="login.html?next=progress.html">Masuk kembali</a>' : '<button class="btn" id="retry-progress" type="button">Coba lagi</button>'}</div></div></div>`;
    document.getElementById('retry-progress')?.addEventListener('click', () => load(course));
  }
  async function load(course = '') { try { render(await api(`/progress/me${course ? `?course=${encodeURIComponent(course)}` : ''}`)); } catch (error) { renderError(error, course); } }
  document.getElementById('logout').onclick = () => ezLogout();
  (async () => { if (await ezRequireAuth('login.html')) load(new URLSearchParams(location.search).get('course') || ''); })();
})();
