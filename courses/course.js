// course.js — CMS-driven course detail / checkout page.
// Source of truth is the admin CMS (/api/courses/:slug). Admin membuat course → course ada.
// Handles: login guard, not-found, unavailable (preview mode), enrolled redirect, checkout submit.

function formatRupiah(n) {
  return "Rp " + Number(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getSlugFromPage() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("slug");
  return fromQuery ? fromQuery.trim() : null;
}

function renderError(title, message, backHref) {
  const wrap = document.getElementById("c-wrap") || document.body;
  wrap.innerHTML = `
    <div role="alert" style="max-width:520px;margin:80px auto;padding:40px 24px;text-align:center;">
      <div aria-hidden="true" style="font-size:48px;margin-bottom:16px;">${backHref ? '🔒' : '❓'}</div>
      <h1 style="font-size:26px;margin:0 0 12px;color:#0a0a0a;">${title}</h1>
      <p style="color:#525252;line-height:1.6;margin:0 0 24px;">${message}</p>
      <a href="${backHref || '../index.html#pricing'}"
         style="display:inline-block;background:#C8102E;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
        ← Lihat kelas yang tersedia
      </a>
    </div>
  `;
}

async function ensureAuth(slug) {
  // If api-client is loaded, use cookie-based auth. Otherwise fall back to localStorage mirror.
  if (typeof window.ezGetMe === "function") {
    const user = await window.ezGetMe();
    if (user) return true;
  } else {
    const mirrored = localStorage.getItem("ez_user");
    if (mirrored) return true;
  }
  const here = `courses/detail.html?slug=${encodeURIComponent(slug)}`;
  window.location.replace(`../login.html?next=${encodeURIComponent(here)}`);
  return false;
}

async function fetchCourseBySlug(slug) {
  try {
    const res = await fetch(`/api/courses`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data.courses) ? data.courses : [];
    return list.find(c => c.slug === slug) || null;
  } catch { return null; }
}

function renderUnavailable(course) {
  const wrap = document.getElementById("c-wrap") || document.body;
  const title = course.title || course.slug;
  const priceLabel = course.price_label
    || (course.price_idr ? formatRupiah(course.price_idr) : "Belum ditentukan");
  wrap.innerHTML = `
    <div style="max-width:560px;margin:64px auto;padding:40px 28px;text-align:center;background:#fff;border:1px solid #e8e0d2;border-radius:16px;box-shadow:0 1px 3px rgba(15,27,60,0.04);">
      <div style="display:inline-block;padding:6px 14px;background:#fff4e5;color:#b45309;border:1px solid #fde68a;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:20px;">
        Segera Hadir
      </div>
      <h1 style="font-size:28px;margin:0 0 10px;color:#0a0a0a;letter-spacing:-0.02em;">${title}</h1>
      <p style="color:#525252;line-height:1.6;margin:0 0 8px;">${course.tagline || ""}</p>
      <p style="color:#8a7d66;font-size:14px;margin:0 0 24px;">${priceLabel}${course.period_label ? ' ' + course.period_label : ''}</p>
      <p style="color:#525252;line-height:1.7;margin:0 0 28px;">
        Kelas ini belum tersedia untuk pembelian. Pantau terus halaman harga — kami akan buka pendaftaran segera.
      </p>
      <a href="../index.html#pricing"
         style="display:inline-block;background:#C8102E;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
        ← Lihat kelas yang tersedia
      </a>
    </div>
  `;
}

// Kept in sync by hand with the same list in backend/src/routes/profile.js
// (PROVINCES) — see that file's comment for why this isn't a shared JSON.
const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi',
  'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat',
  'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];
const LEARNING_GOALS = [
  ['jlpt', 'Lulus JLPT (N5–N1)'],
  ['kerja_jepang', 'Kerja di Jepang (SSW / Tokutei Ginou)'],
  ['hobi', 'Hobi / minat pribadi'],
  ['kuliah', 'Kuliah / beasiswa ke Jepang'],
  ['lainnya', 'Lainnya'],
];
const REFERRAL_SOURCES = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['facebook', 'Facebook'],
  ['whatsapp', 'WhatsApp / grup komunitas'],
  ['google', 'Google / pencarian'],
  ['website', 'Website'],
  ['event', 'Acara / webinar'],
  ['teman_keluarga', 'Teman / keluarga'],
  ['lainnya', 'Lainnya'],
];
const BACKGROUNDS = [
  ['ex_intern_hospitality', 'Eks magang Jepang — hotel / restoran'],
  ['ex_intern_other', 'Eks magang Jepang — bidang lain'],
  ['fresh_graduate', 'Baru lulus sekolah / kuliah'],
  ['worker', 'Sedang bekerja'],
  ['other', 'Lainnya'],
];
const JAPAN_GOALS = [
  ['first_time', 'Pertama kali bekerja di Jepang'],
  ['return', 'Kembali bekerja di Jepang'],
  ['study', 'Melanjutkan studi di Jepang'],
  ['undecided', 'Belum menentukan'],
];
const PRIMARY_PROBLEMS = [
  ['cost', 'Biaya persiapan / keberangkatan'],
  ['language', 'Kemampuan bahasa Jepang / ujian'],
  ['jobs', 'Mencari lowongan / jalur kerja'],
  ['time', 'Waktu untuk belajar / persiapan'],
  ['trust', 'Menemukan informasi / lembaga tepercaya'],
  ['other', 'Kendala lainnya'],
  ['undecided', 'Belum tahu / belum ada kendala'],
];
const TARGET_TIMELINES = [
  ['within_3_months', 'Dalam 3 bulan'],
  ['within_6_months', 'Dalam 4–6 bulan'],
  ['within_12_months', 'Dalam 7–12 bulan'],
  ['over_12_months', 'Lebih dari 12 bulan'],
  ['undecided', 'Belum menentukan'],
];
const PROFILE_FIELDS = {
  birthDate: 'c-birth-date', province: 'c-province', city: 'c-city', phone: 'c-phone',
  learningGoal: 'c-learning-goal', background: 'c-background', japanGoal: 'c-japan-goal',
  categoryInterest: 'c-category-interest', primaryProblem: 'c-primary-problem',
  targetTimeline: 'c-target-timeline', referralSource: 'c-referral-source',
  referrerName: 'c-referrer-name', sourceDetail: 'c-source-detail', consent: 'c-consent',
};
const PROFILE_ERRORS = {
  invalid_birth_date: ['c-birth-date', 'Masukkan tanggal lahir yang benar.'],
  implausible_birth_date: ['c-birth-date', 'Periksa tanggal lahirmu. Usia yang dapat didaftarkan adalah 5–100 tahun.'],
  invalid_province: ['c-province', 'Pilih provinsi domisilimu.'],
  invalid_city: ['c-city', 'Isi kota atau kabupaten, maksimal 100 karakter.'],
  invalid_phone: ['c-phone', 'Masukkan nomor WhatsApp yang valid, misalnya 081234567890, +6281234567890, atau +819012345678.'],
  invalid_learning_goal: ['c-learning-goal', 'Pilih tujuan belajarmu.'],
  invalid_background: ['c-background', 'Pilih latar belakang yang paling sesuai.'],
  invalid_japan_goal: ['c-japan-goal', 'Pilih rencanamu ke Jepang, atau pilih “Belum menentukan”.'],
  invalid_category_interest: ['c-category-interest', 'Isi bidang yang kamu minati, maksimal 160 karakter. Jika belum tahu, tulis “Belum menentukan”.'],
  invalid_primary_problem: ['c-primary-problem', 'Pilih kendala utamamu, atau pilih “Belum tahu / belum ada kendala”.'],
  invalid_target_timeline: ['c-target-timeline', 'Pilih perkiraan waktumu, atau pilih “Belum menentukan”.'],
  invalid_referral_source: ['c-referral-source', 'Pilih dari mana kamu mengenal EzNihongo.'],
  invalid_referrer_name: ['c-referrer-name', 'Isi nama atau panggilan teman yang merekomendasikan, maksimal 160 karakter.'],
  invalid_source_detail: ['c-source-detail', 'Ringkas keterangan sumber menjadi maksimal 160 karakter.'],
  consent_required: ['c-consent', 'Baca Kebijakan Privasi, lalu centang persetujuan penggunaan data untuk melanjutkan.'],
};

function profileDateBounds() {
  const now = new Date();
  const year = now.getUTCFullYear(), month = now.getUTCMonth(), day = now.getUTCDate();
  const min = new Date(Date.UTC(year - 101, month, day));
  if (min.getUTCMonth() === month && min.getUTCDate() === day) min.setUTCDate(min.getUTCDate() + 1);
  const max = new Date(Date.UTC(year - 5, month, day));
  if (max.getUTCMonth() !== month) max.setUTCDate(0);
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
}

function profileSelect(id, label, options, placeholder) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" required aria-describedby="${id}-error"><option value="" disabled selected>${placeholder}</option>${options.map(([v, text]) => `<option value="${v}">${text}</option>`).join('')}</select><p class="c-field-error" id="${id}-error" hidden></p></div>`;
}

// Requested at the first course signup, or once more when an older profile
// is missing the strategy fields. Account signup stays unchanged.
function profileFieldsHtml() {
  const bounds = profileDateBounds();
  return `
    <div id="c-profile-fields">
      <div class="c-profile-intro"><h2>Kenali kebutuhan belajarmu</h2><p>Bantu kami memahami tujuan dan kendalamu agar informasi kelas dan pendampingan lebih sesuai. Cukup lengkapi saat pendaftaran pertamamu.</p><p class="c-field-hint">Semua pertanyaan wajib diisi, kecuali yang bertanda opsional. Belum punya rencana? Pilih “Belum menentukan”.</p></div>
      <fieldset class="c-profile-section"><legend>1. Data diri &amp; kontak</legend>
        <div class="field-row">
          <div class="field"><label for="c-birth-date">Tanggal lahir</label><input type="date" id="c-birth-date" min="${bounds.min}" max="${bounds.max}" autocomplete="bday" required aria-describedby="c-birth-date-error" /><p class="c-field-error" id="c-birth-date-error" hidden></p></div>
          <div class="field"><label for="c-phone">Nomor WhatsApp aktif</label><input type="tel" id="c-phone" placeholder="081234567890" autocomplete="tel" maxlength="40" pattern="[+]?[0-9][0-9\\s\\(\\).\\-]{7,39}" required aria-describedby="c-phone-hint c-phone-error" /><p class="c-field-hint" id="c-phone-hint">Bisa pakai 08…, +62…, atau kode negara lain seperti +81….</p><p class="c-field-error" id="c-phone-error" hidden></p></div>
        </div>
        <div class="field-row">
          ${profileSelect('c-province', 'Provinsi domisili di Indonesia', PROVINCES.map(p => [p, p]), 'Pilih provinsi')}
          <div class="field"><label for="c-city">Kota / kabupaten</label><input type="text" id="c-city" maxlength="100" autocomplete="address-level2" placeholder="Contoh: Kabupaten Bekasi" required aria-describedby="c-city-error" /><p class="c-field-error" id="c-city-error" hidden></p></div>
        </div>
      </fieldset>
      <fieldset class="c-profile-section"><legend>2. Tujuan &amp; kebutuhanmu</legend>
        ${profileSelect('c-background', 'Latar belakang yang paling sesuai', BACKGROUNDS, 'Pilih latar belakang')}
        <div class="field-row">
          ${profileSelect('c-learning-goal', 'Tujuan utama belajar', LEARNING_GOALS, 'Pilih tujuan belajar')}
          ${profileSelect('c-japan-goal', 'Rencanamu ke Jepang', JAPAN_GOALS, 'Pilih rencana')}
        </div>
        <div class="field"><label for="c-category-interest">Bidang kerja / studi yang diminati</label><input type="text" id="c-category-interest" list="c-category-options" maxlength="160" placeholder="Pilih saran atau tulis bidangmu" required aria-describedby="c-category-hint c-category-interest-error" /><datalist id="c-category-options"><option value="Hotel / perhotelan"></option><option value="Restoran / layanan makanan"></option><option value="Pengolahan makanan"></option><option value="Pertanian"></option><option value="Perawatan lansia / kaigo"></option><option value="Manufaktur"></option><option value="Konstruksi"></option><option value="Studi / pendidikan"></option><option value="Belum menentukan"></option></datalist><p class="c-field-hint" id="c-category-hint">Boleh isi “Belum menentukan” jika masih mencari pilihan.</p><p class="c-field-error" id="c-category-interest-error" hidden></p></div>
        ${profileSelect('c-primary-problem', 'Kendala utama untuk mencapai tujuanmu', PRIMARY_PROBLEMS, 'Pilih kendala utama')}
        ${profileSelect('c-target-timeline', 'Kapan ingin berangkat / mencapai tujuanmu?', TARGET_TIMELINES, 'Pilih perkiraan waktu')}
      </fieldset>
      <fieldset class="c-profile-section"><legend>3. Mengenal EzNihongo</legend>
        ${profileSelect('c-referral-source', 'Pertama tahu EzNihongo dari mana?', REFERRAL_SOURCES, 'Pilih sumber')}
        <div class="field" id="c-referrer-field" hidden><label for="c-referrer-name">Nama teman / keluarga yang merekomendasikan</label><input type="text" id="c-referrer-name" maxlength="160" disabled aria-describedby="c-referrer-hint c-referrer-name-error" /><p class="c-field-hint" id="c-referrer-hint">Cukup nama atau panggilannya, tanpa nomor kontak.</p><p class="c-field-error" id="c-referrer-name-error" hidden></p></div>
        <div class="field"><label for="c-source-detail">Nama akun, grup, atau acara <span class="c-optional">(opsional)</span></label><input type="text" id="c-source-detail" maxlength="160" placeholder="Contoh: akun Instagram atau nama webinar" aria-describedby="c-source-detail-error" /><p class="c-field-error" id="c-source-detail-error" hidden></p></div>
      </fieldset>
      <div class="field c-consent-field"><div class="c-consent-row"><input type="checkbox" id="c-consent" required aria-describedby="c-consent-error" /><label for="c-consent">Saya setuju data ini disimpan dan digunakan EzNihongo untuk pendaftaran, pendampingan belajar, serta riset dan pengembangan pemasaran sesuai <a href="../privacy.html" target="_blank" rel="noopener noreferrer">Kebijakan Privasi</a>.</label></div><p class="c-field-error" id="c-consent-error" hidden></p></div>
    </div>
  `;
}

function setProfileFieldError(id, message = '') {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  if (!input || !error) return;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  error.textContent = message;
  error.hidden = !message;
}

function setupProfileFields(profile = {}) {
  for (const [key, id] of Object.entries(PROFILE_FIELDS)) {
    const input = document.getElementById(id);
    if (key !== 'consent' && profile[key] != null) input.value = key === 'birthDate' ? String(profile[key]).slice(0, 10) : profile[key];
    input.addEventListener('input', () => setProfileFieldError(id));
    input.addEventListener('change', () => setProfileFieldError(id));
  }
  const source = document.getElementById('c-referral-source');
  const updateReferrer = () => {
    const required = source.value === 'teman_keluarga';
    const referrer = document.getElementById('c-referrer-name');
    document.getElementById('c-referrer-field').hidden = !required;
    referrer.required = required;
    referrer.disabled = !required;
    if (!required) referrer.value = '';
    setProfileFieldError('c-referrer-name');
  };
  source.addEventListener('change', updateReferrer);
  updateReferrer();
  document.getElementById('c-checkout-form').noValidate = true;
}

function validateProfileFields() {
  let firstInvalid = null;
  const errorsByField = Object.fromEntries(Object.values(PROFILE_ERRORS));
  for (const id of Object.values(PROFILE_FIELDS)) {
    const input = document.getElementById(id);
    if (!input || input.disabled) continue;
    let message = '';
    if (!input.checkValidity() || (input.required && input.type !== 'checkbox' && !input.value.trim())) message = errorsByField[id];
    if (id === 'c-birth-date' && input.value) {
      const date = new Date(`${input.value}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.value) message = PROFILE_ERRORS.invalid_birth_date[1];
    }
    if (id === 'c-birth-date' && !input.value) message = PROFILE_ERRORS.invalid_birth_date[1];
    if (id === 'c-phone' && input.value) {
      let phone = input.value.trim().replace(/[\s().-]/g, '');
      if (phone.startsWith('08')) phone = '+62' + phone.slice(1);
      else if (phone.startsWith('62')) phone = '+' + phone;
      if (!/^\+[1-9]\d{7,14}$/.test(phone) || (phone.startsWith('+62') && !/^\+628\d{7,11}$/.test(phone))) message = PROFILE_ERRORS.invalid_phone[1];
    }
    setProfileFieldError(id, message);
    if (message && !firstInvalid) firstInvalid = input;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}

async function saveProfileFields(courseSlug) {
  const body = { courseSlug };
  for (const [key, id] of Object.entries(PROFILE_FIELDS)) {
    const input = document.getElementById(id);
    body[key] = key === 'consent' ? input.checked : input.value.trim();
  }
  const res = await window.ezApi("/profile/marketing", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}

function renderCourseUI(course, needsProfile, profile = {}) {
  const title = course.title || course.slug;
  const tagline = course.tagline || course.description || "";
  const priceLabel = course.is_free === true ? 'Gratis' : course.price_label
    || (course.price_idr ? formatRupiah(course.price_idr) : "");
  const period = course.period_label || "";
  const features = Array.isArray(course.features) ? course.features : [];

  document.title = `${title} - EzNihongo`;
  document.getElementById("c-name").textContent = title;
  document.getElementById("c-tagline").textContent = tagline;
  document.getElementById("c-price").innerHTML = `${priceLabel} <span class="period">${period}</span>`;
  document.getElementById("c-summary-price").textContent = priceLabel;
  document.getElementById("c-summary-total").textContent = priceLabel;

  document.getElementById("c-features").innerHTML = features
    .map(f => `<li><span class="c-check">✓</span><span>${f}</span></li>`)
    .join("");

  // Modules list is out of scope for the course summary endpoint — hide that section
  // on the checkout page. (Module preview lives on the dashboard after purchase.)
  const modulesEl = document.getElementById("c-modules");
  if (modulesEl) modulesEl.closest("section").querySelector('h2:nth-of-type(2)')?.remove();
  if (modulesEl) modulesEl.remove();

  // Free courses (is_free === true) self-enroll instantly, same as before.
  // Everything else (paid, or not yet classified by an admin — see
  // migration 121) goes through the order/manual-transfer flow — the only
  // method actually wired up server-side (POST /api/orders).
  const submitBtn = document.getElementById("c-submit");
  submitBtn.textContent = course.is_free === true ? "Daftar Kelas Gratis →" : "Buat Pesanan →";
  if (course.is_free === true) document.querySelector('#c-checkout-form .c-payment-method').textContent = 'Gratis — tidak ada pembayaran.';
  const defaultLabel = submitBtn.textContent;

  const showProfileFields = () => {
    if (document.getElementById('c-profile-fields')) return;
    document.getElementById('c-wrap').classList.add('c-wrap--profile');
    submitBtn.insertAdjacentHTML("beforebegin", profileFieldsHtml());
    setupProfileFields(profile);
    if (profile.hasProfile) document.querySelector('.c-profile-intro p').textContent = 'Data yang pernah kamu isi sudah terisi kembali. Lengkapi pertanyaan tambahan agar informasi kelas dan pendampingan lebih sesuai dengan kebutuhanmu.';
  };
  if (needsProfile) showProfileFields();

  document.getElementById("c-checkout-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("c-submit");
    const status = document.getElementById("c-checkout-status");
    const error = document.getElementById("c-checkout-error");
    status.textContent = "";
    error.textContent = "";
    error.hidden = true;
    if (needsProfile && !validateProfileFields()) {
      error.textContent = 'Periksa isian yang ditandai sebelum melanjutkan.';
      error.hidden = false;
      return;
    }
    btn.disabled = true;

    try {
      if (needsProfile) {
        btn.textContent = "Menyimpan data...";
        status.textContent = "Menyimpan data profil...";
        await saveProfileFields(course.slug);
      }

      if (course.is_free === true) {
        btn.textContent = "Memproses...";
        status.textContent = "Memproses pendaftaran kelas...";
        const res = await window.ezApi("/enrollments", {
          method: "POST",
          body: JSON.stringify({ courseSlug: course.slug }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        window.location.href = `../dashboard.html?v=20260902-1&course=${encodeURIComponent(course.slug)}&new=1`;
        return;
      }

      btn.textContent = "Membuat pesanan...";
      status.textContent = "Membuat pesanan...";
      const res = await window.ezApi("/orders", {
        method: "POST",
        body: JSON.stringify({ courseSlug: course.slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.href = `order.html?id=${encodeURIComponent(data.order.id)}`;
    } catch (err) {
      btn.textContent = defaultLabel;
      btn.disabled = false;
      status.textContent = "";
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
        const messages = {
          already_enrolled: 'Kamu sudah terdaftar di kelas ini. Buka Dashboard untuk mulai belajar.',
          course_not_available: 'Pendaftaran kelas ini belum dibuka. Silakan kembali ke daftar kelas.',
          course_not_found: 'Kelas tidak ditemukan. Silakan kembali ke daftar kelas.',
          course_not_purchasable: 'Kelas ini belum dapat dipesan. Hubungi kami melalui WhatsApp untuk bantuan.',
          course_price_not_configured: 'Pendaftaran kelas ini belum siap. Hubungi kami melalui WhatsApp untuk bantuan.',
          unauthorized: 'Sesi masukmu berakhir. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          invalid_token: 'Sesi masukmu berakhir. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          'Missing token': 'Sesi masukmu berakhir. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          'Invalid token': 'Sesi masukmu berakhir. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          registration_account_unavailable: 'Akunmu tidak tersedia. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          'HTTP 401': 'Sesi masukmu berakhir. Muat ulang halaman dan masuk kembali untuk melanjutkan.',
          'HTTP 429': 'Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.',
        };
        error.textContent = messages[err.message] || 'Pendaftaran belum berhasil diproses. Periksa koneksi internetmu, lalu coba lagi. Jika masih gagal, hubungi kami melalui WhatsApp.';
      }
      error.hidden = false;
    }
  });
}

async function init() {
  const slug = getSlugFromPage();
  if (!slug) {
    renderError("Kelas tidak ditemukan", "Alamat halaman tidak menyertakan kelas apapun.");
    return;
  }

  if (!(await ensureAuth(slug))) return;

  // Already enrolled? Check server (source of truth) before sending them to
  // dashboard — localStorage can lie, especially right after login on a new
  // device. Fall back to localStorage only if the API is unreachable.
  let enrolled = [];
  if (typeof window.ezApi === "function") {
    try {
      const res = await window.ezApi("/enrollments/me");
      if (res.ok) {
        const data = await res.json();
        enrolled = (data.enrollments || []).map(e => e.slug).filter(Boolean);
        localStorage.setItem("ez_courses", JSON.stringify(enrolled));
      }
    } catch { enrolled = JSON.parse(localStorage.getItem("ez_courses") || "[]"); }
  } else {
    enrolled = JSON.parse(localStorage.getItem("ez_courses") || "[]");
  }
  if (enrolled.includes(slug)) {
    window.location.replace(`../dashboard.html?v=20260902-1&course=${encodeURIComponent(slug)}`);
    return;
  }

  const course = await fetchCourseBySlug(slug);
  if (!course) {
    renderError(
      "Kelas tidak ditemukan",
      "Kelas yang kamu tuju tidak ada di sistem kami. Mungkin sudah dihapus atau belum pernah dibuat."
    );
    return;
  }

  if (course.is_available === false) {
    renderUnavailable(course);
    return;
  }

  // Complete profiles skip the questions on later signups. Older profiles
  // are prefilled and prompted for the missing strategy questions.
  let needsProfile = true;
  let profile = {};
  try {
    const res = await window.ezApi("/profile/marketing");
    if (res.ok) {
      profile = await res.json();
      needsProfile = !profile.hasProfile || profile.needsUpdate === true;
    }
  } catch { /* keep needsProfile = true — see comment above */ }

  renderCourseUI(course, needsProfile, profile);
}

document.addEventListener("DOMContentLoaded", init);
