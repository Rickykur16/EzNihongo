// registration-form.js — formulir data pendaftaran siswa, dipakai BERSAMA oleh
// checkout kelas (courses/detail.html → course.js) dan layar "Belum ada kelas
// aktif" di dashboard (dashboard.js). Dulu hanya ada di course.js; dipindah ke
// sini apa adanya supaya kedua pintu masuk memakai pertanyaan, validasi, pesan
// galat, dan urutan simpan → pesanan yang SAMA, bukan dua salinan yang bisa
// melenceng. Skrip biasa (bukan module): semua deklarasi di bawah sengaja jadi
// global, karena course.js dan dashboard.js memanggilnya langsung.
// Satu halaman = satu formulir (id elemen tetap "c-…").

// Kept in sync by hand with the same list in backend/src/registration-profile.js
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
  ['ex_intern', 'Eks-magang Jepang'],
  ['fresh_graduate', 'Baru lulus sekolah / kuliah'],
  ['worker', 'Sedang bekerja'],
  ['other', 'Lainnya'],
];
const INTERNSHIP_FIELDS = [
  ['hospitality', 'Hotel / restoran'],
  ['manufacturing', 'Manufaktur'],
  ['construction', 'Konstruksi'],
  ['agriculture', 'Pertanian'],
  ['caregiving', 'Kaigo / perawatan lansia'],
  ['fisheries', 'Perikanan'],
  ['other', 'Lainnya'],
];
const JAPANESE_LEVELS = [
  ['new_to_japanese', 'Belum pernah belajar'],
  ['basics', 'Baru belajar hiragana, katakana, atau dasar bahasa Jepang'],
  ['n5', 'Kira-kira setara N5'],
  ['n4', 'Kira-kira setara N4'],
  ['n3_plus', 'N3 atau lebih tinggi'],
  ['unsure', 'Sudah pernah belajar, tetapi belum tahu levelnya'],
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
  fullName: 'c-full-name',
  birthDate: 'c-birth-date', province: 'c-province', city: 'c-city', phone: 'c-phone',
  learningGoal: 'c-learning-goal', background: 'c-background', japanGoal: 'c-japan-goal',
  japaneseLevel: 'c-japanese-level',
  internshipField: 'c-internship-field', internshipFieldOther: 'c-internship-field-other',
  backgroundOther: 'c-background-other', learningGoalOther: 'c-learning-goal-other',
  categoryInterest: 'c-category-interest', primaryProblem: 'c-primary-problem',
  primaryProblemOther: 'c-primary-problem-other',
  targetTimeline: 'c-target-timeline', referralSource: 'c-referral-source',
  referralSourceOther: 'c-referral-source-other',
  referrerName: 'c-referrer-name', sourceDetail: 'c-source-detail', consent: 'c-consent',
};
const PROFILE_ERRORS = {
  invalid_full_name: ['c-full-name', 'Isi nama lengkapmu, maksimal 100 karakter.'],
  invalid_birth_date: ['c-birth-date', 'Masukkan tanggal lahir yang benar.'],
  implausible_birth_date: ['c-birth-date', 'Periksa tanggal lahirmu. Usia yang dapat didaftarkan adalah 5–100 tahun.'],
  invalid_province: ['c-province', 'Pilih provinsi domisilimu.'],
  invalid_city: ['c-city', 'Isi kota atau kabupaten, maksimal 100 karakter.'],
  invalid_phone: ['c-phone', 'Masukkan nomor WhatsApp yang valid, misalnya 081234567890, +6281234567890, atau +819012345678.'],
  invalid_learning_goal: ['c-learning-goal', 'Pilih tujuan belajarmu.'],
  invalid_japanese_level: ['c-japanese-level', 'Pilih perkiraan kemampuan bahasa Jepangmu saat ini. Jika belum yakin, pilih “Sudah pernah belajar, tetapi belum tahu levelnya”.'],
  invalid_learning_goal_other: ['c-learning-goal-other', 'Ceritakan tujuan belajarmu, maksimal 160 karakter.'],
  invalid_background: ['c-background', 'Pilih latar belakang yang paling sesuai.'],
  invalid_background_other: ['c-background-other', 'Tuliskan latar belakangmu, maksimal 160 karakter.'],
  invalid_internship_field: ['c-internship-field', 'Pilih bidang magangmu di Jepang.'],
  invalid_internship_field_other: ['c-internship-field-other', 'Tuliskan bidang magangmu di Jepang, maksimal 160 karakter.'],
  invalid_japan_goal: ['c-japan-goal', 'Pilih rencanamu ke Jepang, atau pilih “Belum menentukan”.'],
  invalid_category_interest: ['c-category-interest', 'Isi bidang yang kamu minati, maksimal 160 karakter. Jika belum tahu, tulis “Belum menentukan”.'],
  invalid_primary_problem: ['c-primary-problem', 'Pilih kendala utamamu, atau pilih “Belum tahu / belum ada kendala”.'],
  invalid_primary_problem_other: ['c-primary-problem-other', 'Ceritakan kendala utamamu, maksimal 160 karakter.'],
  invalid_target_timeline: ['c-target-timeline', 'Pilih perkiraan waktumu, atau pilih “Belum menentukan”.'],
  invalid_referral_source: ['c-referral-source', 'Pilih dari mana kamu mengenal EzNihongo.'],
  invalid_referral_source_other: ['c-referral-source-other', 'Tuliskan dari mana kamu mengenal EzNihongo, maksimal 160 karakter.'],
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

function profileSelect(id, label, options, placeholder, conditional = false, hint = '') {
  return `<div class="field"${conditional ? ` id="${id}-group" hidden` : ''}><label for="${id}">${label}</label><select id="${id}" ${conditional ? 'disabled' : 'required'} aria-describedby="${hint ? `${id}-hint ` : ''}${id}-error"><option value="" disabled selected>${placeholder}</option>${options.map(([v, text]) => `<option value="${v}">${text}</option>`).join('')}</select>${hint ? `<p class="c-field-hint" id="${id}-hint">${hint}</p>` : ''}<p class="c-field-error" id="${id}-error" hidden></p></div>`;
}

function profileOtherField(id, label, placeholder) {
  return `<div class="field" id="${id}-group" hidden><label for="${id}">${label}</label><input type="text" id="${id}" maxlength="160" placeholder="${placeholder}" disabled aria-describedby="${id}-error" /><p class="c-field-error" id="${id}-error" hidden></p></div>`;
}

// Requested at the first course signup, or once more when an older profile
// is missing the strategy fields. Account signup stays unchanged.
function profileFieldsHtml({ privacyHref = '../privacy.html' } = {}) {
  const bounds = profileDateBounds();
  return `
    <div id="c-profile-fields">
      <div class="c-profile-intro"><h2>Kenali kebutuhan belajarmu</h2><p>Bantu kami memahami tujuan dan kendalamu agar informasi kelas dan pendampingan lebih sesuai. Cukup lengkapi saat pendaftaran pertamamu.</p><p class="c-field-hint">Semua pertanyaan wajib diisi, kecuali yang bertanda opsional. Belum punya rencana? Pilih “Belum menentukan”.</p></div>
      <fieldset class="c-profile-section"><legend>1. Data diri &amp; kontak</legend>
        <div class="field"><label for="c-full-name">Nama lengkap</label><input type="text" id="c-full-name" autocomplete="name" maxlength="100" required placeholder="Nama lengkap kamu" aria-describedby="c-full-name-hint c-full-name-error" /><p class="c-field-hint" id="c-full-name-hint">Diambil dari akunmu. Kamu bisa memperbaikinya di sini.</p><p class="c-field-error" id="c-full-name-error" hidden></p></div>
        <div class="field-row">
          <div class="field"><label for="c-phone">Nomor WhatsApp aktif</label><input type="tel" id="c-phone" placeholder="081234567890" autocomplete="tel" maxlength="40" pattern="[+]?[0-9][0-9\\s\\(\\).\\-]{7,39}" required aria-describedby="c-phone-hint c-phone-error" /><p class="c-field-hint" id="c-phone-hint">Bisa pakai 08…, +62…, atau kode negara lain seperti +81….</p><p class="c-field-error" id="c-phone-error" hidden></p></div>
          <div class="field"><label for="c-email">Email akun</label><input type="email" id="c-email" autocomplete="email" readonly aria-describedby="c-email-hint" /><p class="c-field-hint" id="c-email-hint">Menggunakan email Google yang kamu pakai untuk masuk.</p></div>
        </div>
        <div class="field"><label for="c-birth-date">Tanggal lahir</label><input type="date" id="c-birth-date" min="${bounds.min}" max="${bounds.max}" autocomplete="bday" required aria-describedby="c-birth-date-error" /><p class="c-field-error" id="c-birth-date-error" hidden></p></div>
        <div class="field-row">
          ${profileSelect('c-province', 'Provinsi domisili di Indonesia', PROVINCES.map(p => [p, p]), 'Pilih provinsi')}
          <div class="field"><label for="c-city">Kota / kabupaten</label><input type="text" id="c-city" maxlength="100" autocomplete="address-level2" placeholder="Contoh: Kabupaten Bekasi" required aria-describedby="c-city-error" /><p class="c-field-error" id="c-city-error" hidden></p></div>
        </div>
      </fieldset>
      <fieldset class="c-profile-section"><legend>2. Tujuan &amp; kebutuhanmu</legend>
        ${profileSelect('c-background', 'Latar belakang yang paling sesuai', BACKGROUNDS, 'Pilih latar belakang')}
        ${profileOtherField('c-background-other', 'Ceritakan latar belakangmu', 'Contoh: masih kuliah atau sedang mencari kerja')}
        ${profileSelect('c-internship-field', 'Bidang magang di Jepang', INTERNSHIP_FIELDS, 'Pilih bidang magang', true)}
        ${profileOtherField('c-internship-field-other', 'Sebutkan bidang magangmu di Jepang', 'Contoh: perbaikan kendaraan')}
        ${profileSelect('c-japanese-level', 'Bagaimana kemampuan bahasa Jepangmu saat ini?', JAPANESE_LEVELS, 'Pilih perkiraan kemampuan', false, 'Pilih perkiraan kemampuanmu. Tidak harus memiliki sertifikat JLPT.')}
        <div class="field-row">
          ${profileSelect('c-learning-goal', 'Tujuan utama belajar', LEARNING_GOALS, 'Pilih tujuan belajar')}
          ${profileSelect('c-japan-goal', 'Rencanamu ke Jepang', JAPAN_GOALS, 'Pilih rencana')}
        </div>
        ${profileOtherField('c-learning-goal-other', 'Ceritakan tujuan belajarmu', 'Contoh: berkomunikasi dengan keluarga di Jepang')}
        <div class="field"><label for="c-category-interest">Bidang kerja / studi yang diminati</label><input type="text" id="c-category-interest" list="c-category-options" maxlength="160" placeholder="Pilih saran atau tulis bidangmu" required aria-describedby="c-category-hint c-category-interest-error" /><datalist id="c-category-options"><option value="Hotel / perhotelan"></option><option value="Restoran / layanan makanan"></option><option value="Pengolahan makanan"></option><option value="Pertanian"></option><option value="Perawatan lansia / kaigo"></option><option value="Manufaktur"></option><option value="Konstruksi"></option><option value="Studi / pendidikan"></option><option value="Belum menentukan"></option></datalist><p class="c-field-hint" id="c-category-hint">Boleh isi “Belum menentukan” jika masih mencari pilihan.</p><p class="c-field-error" id="c-category-interest-error" hidden></p></div>
        ${profileSelect('c-primary-problem', 'Kendala utama untuk mencapai tujuanmu', PRIMARY_PROBLEMS, 'Pilih kendala utama')}
        ${profileOtherField('c-primary-problem-other', 'Ceritakan kendala utamamu', 'Contoh: belum tahu dokumen yang harus disiapkan')}
        ${profileSelect('c-target-timeline', 'Kapan ingin berangkat / mencapai tujuanmu?', TARGET_TIMELINES, 'Pilih perkiraan waktu')}
      </fieldset>
      <fieldset class="c-profile-section"><legend>3. Mengenal EzNihongo</legend>
        ${profileSelect('c-referral-source', 'Pertama tahu EzNihongo dari mana?', REFERRAL_SOURCES, 'Pilih sumber')}
        ${profileOtherField('c-referral-source-other', 'Dari mana kamu mengenal EzNihongo?', 'Contoh: rekomendasi guru di sekolah')}
        <div class="field" id="c-referrer-field" hidden><label for="c-referrer-name">Nama teman / keluarga yang merekomendasikan</label><input type="text" id="c-referrer-name" maxlength="160" disabled aria-describedby="c-referrer-hint c-referrer-name-error" /><p class="c-field-hint" id="c-referrer-hint">Cukup nama atau panggilannya, tanpa nomor kontak.</p><p class="c-field-error" id="c-referrer-name-error" hidden></p></div>
        <div class="field"><label for="c-source-detail">Nama akun, grup, atau acara <span class="c-optional">(opsional)</span></label><input type="text" id="c-source-detail" maxlength="160" placeholder="Contoh: akun Instagram atau nama webinar" aria-describedby="c-source-detail-error" /><p class="c-field-error" id="c-source-detail-error" hidden></p></div>
      </fieldset>
      <div class="field c-consent-field"><div class="c-consent-row"><input type="checkbox" id="c-consent" required aria-describedby="c-consent-error" /><label for="c-consent">Saya setuju data ini disimpan dan digunakan EzNihongo untuk pendaftaran, pendampingan belajar, serta riset dan pengembangan pemasaran sesuai <a href="${privacyHref}" target="_blank" rel="noopener noreferrer">Kebijakan Privasi</a>.</label></div><p class="c-field-error" id="c-consent-error" hidden></p></div>
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

function setupProfileFields(profile = {}, formId = 'c-checkout-form') {
  profile = { ...profile };
  if (profile.background === 'ex_intern_hospitality') {
    profile.background = 'ex_intern';
    profile.internshipField ||= 'hospitality';
  } else if (profile.background === 'ex_intern_other') {
    profile.background = 'ex_intern';
  }
  document.getElementById('c-email').value = profile.email || '';
  for (const [key, id] of Object.entries(PROFILE_FIELDS)) {
    const input = document.getElementById(id);
    if (key !== 'consent' && profile[key] != null) input.value = key === 'birthDate' ? String(profile[key]).slice(0, 10) : profile[key];
    input.addEventListener('input', () => setProfileFieldError(id));
    input.addEventListener('change', () => setProfileFieldError(id));
  }
  const toggleField = (id, active, groupId = `${id}-group`) => {
    const input = document.getElementById(id);
    document.getElementById(groupId).hidden = !active;
    input.required = active;
    input.disabled = !active;
    if (!active) input.value = '';
    setProfileFieldError(id);
  };
  const updateConditionalFields = () => {
    const background = document.getElementById('c-background').value;
    const source = document.getElementById('c-referral-source').value;
    toggleField('c-background-other', background === 'other');
    toggleField('c-internship-field', background === 'ex_intern');
    toggleField('c-internship-field-other', background === 'ex_intern' && document.getElementById('c-internship-field').value === 'other');
    toggleField('c-learning-goal-other', document.getElementById('c-learning-goal').value === 'lainnya');
    toggleField('c-primary-problem-other', document.getElementById('c-primary-problem').value === 'other');
    toggleField('c-referral-source-other', source === 'lainnya');
    toggleField('c-referrer-name', source === 'teman_keluarga', 'c-referrer-field');
  };
  for (const id of ['c-background', 'c-internship-field', 'c-learning-goal', 'c-primary-problem', 'c-referral-source']) {
    document.getElementById(id).addEventListener('change', updateConditionalFields);
  }
  updateConditionalFields();
  document.getElementById(formId).noValidate = true;
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


// Pesan untuk kode galat dari PUT /profile/marketing, POST /orders, dan
// POST /enrollments yang bukan galat per-isian (PROFILE_ERRORS).
const REGISTRATION_ERROR_MESSAGES = {
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
function registrationErrorMessage(code) {
  return REGISTRATION_ERROR_MESSAGES[code] || 'Pendaftaran belum berhasil diproses. Periksa koneksi internetmu, lalu coba lagi. Jika masih gagal, hubungi kami melalui WhatsApp.';
}

// Urutan kirim yang sama untuk kedua pintu masuk: simpan data (kalau diminta),
// lalu kelas gratis → enrollment, kelas berbayar → pesanan transfer manual.
// Mengembalikan hasilnya; pemanggil yang menentukan arah halaman karena path
// relatifnya berbeda (courses/ vs akar). Galat dilempar dengan kode server.
async function submitCourseRegistration(course, { needsProfile, onStep = () => {} } = {}) {
  if (needsProfile) {
    onStep('profile');
    await saveProfileFields(course.slug);
  }
  const free = course.is_free === true;
  onStep(free ? 'enroll' : 'order');
  const res = await window.ezApi(free ? '/enrollments' : '/orders', {
    method: 'POST',
    body: JSON.stringify({ courseSlug: course.slug }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return free ? { kind: 'enrolled', slug: course.slug } : { kind: 'order', orderId: data.order.id };
}
