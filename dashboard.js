(() => {
  const app = document.getElementById('dashboard-app');
  const release = '20260902-5';
  const progressReconcileVersion = 'ez_progress_reconcile_v2';
  const labels = { kana: 'Kana', vocabulary: 'Kosakata', kanji: 'Kanji', grammar: 'Grammar' };
  const continueBackdrops = [
    { src: 'assets/dashboard/continue-kyoto-night.webp', position: 'center 56%' },
    { src: 'assets/dashboard/continue-hakone-torii.webp', position: 'center 48%' },
    { src: 'assets/dashboard/continue-sakura-train.webp', position: 'center 50%' },
  ];
  const continueBackdrop = (() => {
    const storageKey = 'ez_continue_backdrop';
    let previous = -1;
    try { previous = Number.parseInt(localStorage.getItem(storageKey) || '-1', 10); } catch {}
    const choices = continueBackdrops.map((_, index) => index).filter((index) => index !== previous);
    const index = choices[Math.floor(Math.random() * choices.length)] ?? 0;
    try { localStorage.setItem(storageKey, String(index)); } catch {}
    return continueBackdrops[index];
  })();
  let signedInUser = null;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  async function get(path) {
    const response = await ezApi(path);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error || 'request_failed');
    return body;
  }
  async function reconcileCachedProgress() {
    const owner = window.ezCaptureAuth();
    if (!owner.userId) return false;
    const learningStorage = window.ezLearningStorage;
    let progress = {};
    let quizScores = {};
    try {
      progress = JSON.parse(learningStorage.getItem('ez_progress') || '{}');
      quizScores = JSON.parse(learningStorage.getItem('ez_quiz_scores') || '{}');
    } catch {}
    const hasProgress = progress && typeof progress === 'object' && !Array.isArray(progress)
      && Object.values(progress).some((course) => course && typeof course === 'object' && Object.values(course).some((done) => done === true));
    const needsRepair = learningStorage.getItem('ez_progress_pending_sync') === '1'
      || (hasProgress && learningStorage.getItem(progressReconcileVersion) !== '1');
    if (!needsRepair) return true;
    try {
      const saved = await ezApi('/learning-state', {
        expectedUserId: owner.userId,
        method: 'PUT',
        body: JSON.stringify({ progress, quizScores }),
      });
      if (!saved.ok || !window.ezIsAuthCurrent(owner)) return false;
      learningStorage.removeItem('ez_progress_pending_sync');
      learningStorage.setItem(progressReconcileVersion, '1');
      return true;
    } catch { return false; }
  }
  function learnUrl(data) {
    const course = data.course?.slug; const next = data.continueLearning;
    if (!course) return 'welcome.html';
    const params = new URLSearchParams({ course });
    if (next) {
      params.set('module', next.chapter.slug);
      params.set('lesson', next.lesson.slug);
    }
    return `welcome.html?${params}`;
  }
  const reviewUrl = (category = 'mixed', course = '') => {
    const params = new URLSearchParams({ v: release });
    if (course) params.set('course', course);
    if (category !== 'mixed') params.set('category', category);
    return `review.html?${params}`;
  };
  const courseUrl = (path, course) => `${path}?v=${release}&course=${encodeURIComponent(course)}`;
  const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  function errorMarkup(error) {
    const expired = String(error?.message) === 'AUTH_EXPIRED';
    return `<section class="card state-card"><div class="eyebrow">DASHBOARD</div><h1>Dashboard belum bisa dimuat</h1><p class="muted">${esc(ezStudentErrorMessage(error, 'Dashboard'))}</p>${expired ? '<a class="primary" href="login.html?next=dashboard.html">Masuk kembali</a>' : '<button class="secondary" id="retry-dashboard" type="button">Coba lagi</button>'}</section>`;
  }
  // Mirrors ACTIONABLE_STATUSES in backend/src/routes/orders.js and the
  // labels in courses/order.html's STATUS_META — kept in sync by hand since
  // the API doesn't expose a "still needs attention" flag directly.
  const ACTIONABLE_ORDER_STATUSES = { pending_payment: 'Menunggu Transfer', awaiting_review: 'Menunggu Verifikasi Admin', rejected: 'Bukti Ditolak — Upload Ulang' };
  // A student who uploaded proof and lost the order.html URL previously had
  // no way back to it short of WhatsApp support — this closes that dead end.
  // Placed above whatever render() drew (course dashboard OR the "Belum ada
  // kelas aktif" empty state) since a pending order can exist in either case,
  // e.g. this is exactly the state a payment-not-yet-approved student in the
  // "belum ada kelas aktif" screen is in — that message alone reads like a
  // broken grant when it's really just an order still awaiting review.
  async function renderPendingOrderBanner() {
    let orders;
    try { orders = (await get('/orders/me')).orders || []; } catch { return; }
    const actionable = orders.filter((order) => ACTIONABLE_ORDER_STATUSES[order.status]);
    if (!actionable.length) return;
    const html = actionable.map((order) => `<a class="pending-order-row" href="courses/order.html?id=${encodeURIComponent(order.id)}">
      <strong>${esc(order.courseTitle || order.orderNumber)}</strong>
      <span>${esc(ACTIONABLE_ORDER_STATUSES[order.status])}</span>
    </a>`).join('');
    app.insertAdjacentHTML('afterbegin', `<section class="card pending-order-banner"><div class="eyebrow">PESANAN SAYA</div>${html}</section>`);
  }
  // Siswa yang masuk lewat Google tapi belum punya kelas aktif dulu cuma
  // melihat "Belum ada kelas aktif" lalu buntu. Sekarang formulir pendaftaran
  // muncul di sini: pilih kelas + data pendaftaran (formulir & alur kirim yang
  // SAMA dengan checkout, src/registration-form.js) → kelas berbayar jadi
  // pesanan transfer, kelas gratis langsung aktif. Kalau sudah ada pesanan
  // yang masih berjalan, form TIDAK ditampilkan (status ada di banner "Pesanan
  // Saya") supaya tidak terbentuk pesanan dobel.
  const formatRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  function registrationPriceLabel(course) {
    if (course.is_free === true) return 'Gratis';
    const price = course.price_label || (course.price_idr ? formatRupiah(course.price_idr) : '');
    return [price, course.period_label].filter(Boolean).join(' ');
  }
  // Cermin syarat server: POST /enrollments hanya untuk is_free=TRUE, POST
  // /orders hanya untuk is_free=FALSE ber-harga; is_free NULL belum diklasifikasi.
  const registrableCourse = (course) => course && course.is_available !== false
    && (course.is_free === true || (course.is_free === false && Number(course.price_idr) > 0));

  // Tombol chat admin di layar pendaftaran. Pesan pembuka menyertakan email akun
  // yang sedang login supaya admin langsung tahu akun mana yang dimaksud — kasus
  // "sudah diberi akses tapi tidak bisa masuk" hampir selalu soal akun yang beda.
  function whatsappChatHtml() {
    const email = signedInUser?.email ? ` Email akun saya: ${signedInUser.email}` : '';
    const text = `Halo admin EzNihongo, saya ingin bertanya tentang pendaftaran kelas.${email}`;
    return `<a class="wa-chat" href="${RENEW_WA}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>Chat admin via WhatsApp</a>`;
  }

  async function renderRegistration() {
    const slot = document.getElementById('register-slot');
    const lead = document.getElementById('register-lead');
    if (!slot) return;
    if (typeof submitCourseRegistration !== 'function') { slot.innerHTML = '<a class="primary" href="welcome.html">Buka Belajar</a>'; return; }
    let orders, courses, profile;
    try {
      [orders, courses, profile] = await Promise.all([
        get('/orders/me').then((body) => body.orders || []),
        get('/courses').then((body) => (body.courses || []).filter(registrableCourse)),
        // Gagal dibaca = tetap tanyakan datanya (fail-closed, sama dengan checkout).
        get('/profile/marketing').catch(() => ({})),
      ]);
    } catch {
      if (!slot.isConnected) return;
      slot.innerHTML = '<p class="muted">Formulir pendaftaran belum dapat dimuat.</p><button class="secondary" type="button" id="register-retry">Coba lagi</button>';
      slot.querySelector('#register-retry').addEventListener('click', () => { slot.innerHTML = '<p class="muted">Memuat formulir pendaftaran…</p>'; renderRegistration(); });
      return;
    }
    if (!slot.isConnected) return;
    if (orders.some((order) => ACTIONABLE_ORDER_STATUSES[order.status])) {
      lead.textContent = 'Pesananmu sedang diproses. Kelas akan aktif setelah pembayaran diverifikasi admin — lihat statusnya di "Pesanan Saya" di atas.';
      slot.innerHTML = '';
      return;
    }
    if (!courses.length) {
      lead.textContent = 'Belum ada kelas yang dibuka untuk pendaftaran saat ini.';
      slot.innerHTML = '';
      return;
    }
    profile = { fullName: signedInUser?.fullName || signedInUser?.full_name || '', email: signedInUser?.email || '', ...profile };
    let needsProfile = !profile.hasProfile || profile.needsUpdate === true;
    lead.textContent = 'Daftar kelas lewat formulir di bawah ini. Kelas berbayar akan dibuatkan pesanan dan instruksi transfer; kelasmu aktif setelah pembayaran diverifikasi.';
    const single = courses.length === 1;
    slot.innerHTML = `<form id="reg-form" class="register-form">
      <fieldset class="c-profile-section reg-course"><legend>Pilih kelas</legend>
        ${courses.map((course) => `<label class="reg-course-option"><input type="radio" name="reg-course" value="${esc(course.slug)}"${single ? ' checked' : ''}><span><strong>${esc(course.title || course.slug)}</strong><small>${esc(registrationPriceLabel(course))}</small></span></label>`).join('')}
        <p class="c-field-error" id="reg-course-error" hidden></p>
      </fieldset>
      <div id="reg-profile-slot"></div>
      <button class="primary" id="reg-submit" type="submit">Buat Pesanan →</button>
      <p class="muted reg-status" id="reg-status" role="status"></p>
      <p class="c-field-error" id="reg-error" role="alert" hidden></p>
    </form>`;
    const form = slot.querySelector('#reg-form');
    const btn = form.querySelector('#reg-submit');
    const status = form.querySelector('#reg-status');
    const error = form.querySelector('#reg-error');
    const courseError = form.querySelector('#reg-course-error');
    const selected = () => courses.find((course) => course.slug === form.querySelector('input[name="reg-course"]:checked')?.value);
    const submitLabel = () => (selected()?.is_free === true ? 'Daftar Kelas Gratis →' : 'Buat Pesanan →');
    btn.textContent = submitLabel();
    form.querySelectorAll('input[name="reg-course"]').forEach((radio) => radio.addEventListener('change', () => {
      courseError.hidden = true; courseError.textContent = '';
      btn.textContent = submitLabel();
    }));
    const showProfileFields = () => {
      if (document.getElementById('c-profile-fields')) return;
      form.querySelector('#reg-profile-slot').innerHTML = profileFieldsHtml({ privacyHref: 'privacy.html' });
      setupProfileFields(profile, 'reg-form');
      if (profile.hasProfile) document.querySelector('.c-profile-intro p').textContent = 'Data yang pernah kamu isi sudah terisi kembali. Lengkapi pertanyaan tambahan agar informasi kelas dan pendampingan lebih sesuai dengan kebutuhanmu.';
    };
    if (needsProfile) showProfileFields();
    form.noValidate = true;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = ''; error.textContent = ''; error.hidden = true;
      const course = selected();
      const profileOk = !needsProfile || validateProfileFields();
      if (!course) {
        courseError.textContent = 'Pilih kelas yang ingin kamu ikuti.';
        courseError.hidden = false;
        form.querySelector('input[name="reg-course"]').focus();
      }
      if (!course || !profileOk) {
        error.textContent = 'Periksa isian yang ditandai sebelum melanjutkan.';
        error.hidden = false;
        return;
      }
      btn.disabled = true;
      const steps = { profile: 'Menyimpan data...', enroll: 'Memproses pendaftaran kelas...', order: 'Membuat pesanan...' };
      try {
        const result = await submitCourseRegistration(course, { needsProfile, onStep: (step) => { btn.textContent = steps[step]; status.textContent = steps[step]; } });
        window.location.href = result.kind === 'enrolled'
          ? `dashboard.html?v=${release}&course=${encodeURIComponent(course.slug)}&new=1`
          : `courses/order.html?id=${encodeURIComponent(result.orderId)}`;
      } catch (err) {
        btn.disabled = false; btn.textContent = submitLabel(); status.textContent = '';
        const fieldError = PROFILE_ERRORS[err.message];
        if (fieldError) {
          setProfileFieldError(...fieldError);
          document.getElementById(fieldError[0])?.focus();
          error.textContent = 'Periksa isian yang ditandai sebelum melanjutkan.';
        } else if (err.message === 'registration_profile_required') {
          needsProfile = true;
          showProfileFields();
          document.getElementById('c-birth-date')?.focus();
          error.textContent = 'Lengkapi data pendaftaran di bawah ini agar kami bisa melanjutkan pendaftaran kelasmu.';
        } else {
          error.textContent = registrationErrorMessage(err.message);
        }
        error.hidden = false;
      }
    });
  }
  // Sisa masa aktif kelas. Sebelumnya expires_at cuma dipakai server sebagai
  // penyaring, jadi akses siswa bisa hilang tanpa pernah ada peringatan sama
  // sekali. Ambang 14 hari dipilih supaya masih ada waktu menghubungi admin
  // sebelum benar-benar terkunci, bukan pemberitahuan di hari terakhir.
  const RENEW_WA = 'https://wa.me/817084655520';
  const EXPIRY_WARNING_DAYS = 14;

  function accessNotice(course) {
    if (!course?.expiresAt) return '';
    const end = new Date(course.expiresAt);
    if (Number.isNaN(end.getTime())) return '';
    // Dibulatkan ke atas supaya "berakhir besok pagi" tidak terbaca "0 hari".
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
    const tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(end);
    const sisa = daysLeft <= 0 ? 'berakhir hari ini'
      : daysLeft === 1 ? 'tinggal 1 hari lagi'
      : `tinggal ${daysLeft} hari lagi`;
    const mendesak = daysLeft <= EXPIRY_WARNING_DAYS;
    return `<p class="access-notice${mendesak ? ' urgent' : ''}">
      Masa aktif kelas sampai <strong>${esc(tanggal)}</strong> · ${esc(sisa)}${
        mendesak ? ` — <a href="${RENEW_WA}" target="_blank" rel="noopener">hubungi admin untuk perpanjang</a>` : ''
      }
    </p>`;
  }

  function masteryRow(key, value = {}) {
    const percent = value.percentage;
    const state = percent == null
      ? esc(value.label || 'Belum cukup latihan')
      : `${percent}%${value.label ? ` · ${esc(value.label)}` : ''}`;
    return `<div class="mastery-row"><strong>${labels[key]}</strong><div class="bar" aria-label="${labels[key]} ${percent == null ? 'belum cukup latihan' : `${percent}%`}"><i style="width:${percent == null ? 0 : percent}%"></i></div><span class="state">${state}</span></div>`;
  }
  // Bars fill from empty the first time they come into view in a browser session; after
  // that, and under reduced motion, they simply show their value.
  let barObserver = null;
  function revealBars() {
    barObserver?.disconnect();
    const bars = [...app.querySelectorAll('.curriculum-bar i, .mastery-row .bar i')];
    let seen = false;
    try { seen = sessionStorage.getItem('ez_dash_bars_seen') === '1'; } catch {}
    if (seen || !bars.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    bars.forEach((bar) => bar.classList.add('bar-wait'));
    // Observe the track, not the bar: a bar clipped to zero width never counts as visible.
    const observer = barObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.querySelector('i')?.classList.replace('bar-wait', 'bar-fill');
      try { sessionStorage.setItem('ez_dash_bars_seen', '1'); } catch {}
    }), { threshold: 0.6 });
    bars.forEach((bar) => observer.observe(bar.parentElement));
  }
  function render(data) {
    app.removeAttribute('aria-busy');
    // Menu Belajar/Review/Live/Progres hanya berisi "Belum ada kelas aktif" untuk
    // siswa tanpa kelas — disembunyikan sampai kelasnya aktif (Keluar tetap ada).
    document.body.classList.toggle('no-active-course', !data.course);
    if (!data.course) {
      app.innerHTML = `<section class="card state-card register-card"><div class="eyebrow">DASHBOARD</div><h1>Belum ada kelas aktif</h1><p class="muted" id="register-lead">Kelas aktif akan muncul setelah pendaftaran selesai.</p>${ezSignedInAsHtml(signedInUser)}${whatsappChatHtml()}<div id="register-slot"><p class="muted">Memuat formulir pendaftaran…</p></div></section>`;
      renderRegistration();
      return;
    }
    const course = data.course; const next = data.continueLearning; const review = data.review || { total: 0, byCategory: {} };
    const mastery = data.mastery || {}; const activity = data.weeklyActivity || {}; const focus = data.focus; const live = data.liveClass || {};
    const focusMarkup = focus
      ? `<h3>${esc(focus.title)}</h3><p class="muted">${esc(focus.detail)}</p><a class="secondary" href="${focus.action === 'continue' ? learnUrl(data) : reviewUrl(focus.reviewCategory || 'mixed', course.slug)}">${focus.action === 'continue' ? 'Lanjut Belajar' : 'Latihan Fokus'}</a>`
      : '<p class="muted">Belum ada rekomendasi khusus. Lanjutkan latihan agar kami dapat menentukan fokus berikutnya.</p>';
    document.getElementById('learn-nav').href = learnUrl(data);
    document.querySelectorAll('.student-nav a[href^="review.html"]').forEach((link) => { link.href = reviewUrl('mixed', course.slug); });
    document.getElementById('live-nav').href = courseUrl('live.html', course.slug);
    document.getElementById('progress-nav').href = courseUrl('progress.html', course.slug);
    const liveMarkup = live.next
      ? `<h2>${esc(live.next.title)}</h2><p class="muted">${formatDate(live.next.startsAt)}</p>${live.next.canJoin ? `<a class="primary" target="_blank" rel="noopener" href="${esc(live.next.meetingUrl)}">Join Class</a>` : `<a class="secondary" href="${courseUrl('live.html', course.slug)}">Lihat jadwal</a>`}`
      : '<h2>Belum ada kelas terjadwal</h2><p class="muted">Kelas dan rekaman akan muncul di sini saat tersedia.</p>';
    const recordings = (live.recentRecordings || []).map((item) => `<li>${esc(item.title)} <a target="_blank" rel="noopener" href="${esc(item.recordingUrl)}">Tonton</a></li>`).join('');
    app.innerHTML = `<section class="hero"><div><div class="eyebrow">学習ダッシュボード · DASHBOARD</div><h1>${data.greetingName ? `Halo, ${esc(data.greetingName)}.` : 'Halo.'}</h1><p class="muted">${esc(course.level || course.slug.toUpperCase())} · ${course.progress.percentage}% kurikulum selesai</p>${accessNotice(course)}</div>${data.courses?.length > 1 ? `<label class="course-switch"><span>Kelas aktif</span><select class="course-select" id="course-select" aria-label="Pilih kelas">${data.courses.map((item) => `<option value="${esc(item.slug)}" ${item.id === course.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label>` : ''}</section>
    <section class="grid dashboard-primary"><article class="card continue-card"><div class="eyebrow">LANJUT BELAJAR</div>${next ? `<div class="continue-label">${esc(next.section || 'Kurikulum')} · ${esc(next.chapter.title)}</div><div class="continue-title">${esc(next.lesson.title)}</div><a class="primary" href="${learnUrl(data)}">Lanjut Belajar</a>` : '<div class="continue-title">Kurikulum selesai</div><p class="muted">Semua pelajaran pada kelas ini sudah selesai.</p>'}</article><article class="card review-card"><div class="eyebrow">SMART REVIEW</div><div class="review-count">${review.total} item perlu direview</div><div class="counts">${Object.entries(labels).map(([key, label]) => `<div class="count"><strong>${Number(review.byCategory?.[key]) || 0}</strong><span>${label}</span></div>`).join('')}</div>${review.total ? `<a class="primary" href="${reviewUrl('mixed', course.slug)}">Mulai Review</a>` : '<p class="muted">Review hari ini selesai. Lanjutkan belajar untuk membuka materi review berikutnya.</p>'}</article></section>
    <section class="grid dashboard-secondary"><article class="card progress-card"><div class="eyebrow">PROGRES KELAS</div><div class="course-progress">${course.progress.percentage}% selesai</div><div class="curriculum-bar" role="progressbar" aria-label="Progres kurikulum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${course.progress.percentage}"><i style="width:${course.progress.percentage}%"></i></div><p class="muted">${course.progress.completedLessons} dari ${course.progress.totalLessons} pelajaran telah diselesaikan.</p><a class="secondary compact-action" href="${courseUrl('progress.html', course.slug)}">Lihat Progres</a></article><article class="card live"><div class="eyebrow">LIVE CLASS · NEXT CLASS</div>${liveMarkup}${recordings ? `<div class="eyebrow recordings-label">RECENT RECORDINGS</div><ul class="live-recordings">${recordings}</ul>` : ''}<a class="secondary live-all" href="${courseUrl('live.html', course.slug)}">Lihat Semua</a></article></section>
    <section class="card performance-card"><div class="performance"><div><div class="eyebrow">PERKEMBANGAN KEMAMPUAN</div><h2>Kemampuanmu saat ini</h2>${Object.entries(labels).map(([key]) => masteryRow(key, mastery[key])).join('')}</div></div></section>
    <section class="card activity-card"><div class="eyebrow">AKTIVITAS MINGGU INI</div><h2>Ringkasan belajarmu minggu ini</h2><div class="activity"><div class="metric"><strong>${activity.activeDays || 0}</strong><span>hari aktif</span></div><div class="metric"><strong>${activity.lessonsCompleted || 0}</strong><span>pelajaran selesai</span></div><div class="metric"><strong>${activity.reviewQuestions || 0}</strong><span>review selesai</span></div><div class="metric"><strong>${activity.accuracy == null ? '—' : `${activity.accuracy}%`}</strong><span>akurasi mandiri</span></div></div><div class="insight">${esc(data.weeklyInsight?.message || 'Belum cukup aktivitas untuk menampilkan rangkuman minggu ini.')}</div></section>`;
    const continueCard = app.querySelector('.continue-card');
    if (continueCard && continueBackdrop) {
      continueCard.style.setProperty('--continue-bg-image', `url("${continueBackdrop.src}")`);
      continueCard.style.setProperty('--continue-bg-position', continueBackdrop.position);
    }
    document.getElementById('course-select')?.addEventListener('change', (event) => load(event.target.value));
    revealBars();
  }
  async function load(course = '') {
    try {
      render(await get(`/dashboard/me${course ? `?course=${encodeURIComponent(course)}` : ''}`));
      window.Maneko?.mount();
      window.Maneko?.setContinue(document.querySelector('.continue-card a')?.getAttribute('href') || 'welcome.html');
      renderPendingOrderBanner();
    }
    catch (error) { app.removeAttribute('aria-busy'); app.innerHTML = errorMarkup(error); document.getElementById('retry-dashboard')?.addEventListener('click', () => load(course)); }
  }
  document.getElementById('logout').addEventListener('click', () => ezLogout());
  (async () => {
    const me = await ezRequireAuth('login.html');
    if (!me) return;
    signedInUser = me;
    await reconcileCachedProgress();
    await load(new URLSearchParams(location.search).get('course') || '');
  })();
})();
