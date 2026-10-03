export const REGISTRATION_STRATEGY_VERSION = 2;

// Keep stored choices aligned with the checkout form.
export const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi',
  'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat',
  'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];
export const LEARNING_GOALS = ['jlpt', 'kerja_jepang', 'hobi', 'kuliah', 'lainnya'];
export const REFERRAL_SOURCES = ['instagram', 'tiktok', 'youtube', 'google', 'teman_keluarga', 'lainnya', 'facebook', 'whatsapp', 'website', 'event'];
export const BACKGROUNDS = ['ex_intern_hospitality', 'ex_intern_other', 'fresh_graduate', 'worker', 'other'];
export const JAPAN_GOALS = ['first_time', 'return', 'study', 'undecided'];
export const PRIMARY_PROBLEMS = ['cost', 'language', 'jobs', 'time', 'trust', 'other', 'undecided'];
export const TARGET_TIMELINES = ['within_3_months', 'within_6_months', 'within_12_months', 'over_12_months', 'undecided'];

export const registrationError = (status, message) => Object.assign(new Error(message), { status });

function text(value, max, error, required = true) {
  if ((value === undefined || value === null) && !required) return '';
  if (typeof value !== 'string') throw registrationError(400, error);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max || /[\x00-\x1f\x7f<>]/.test(clean)) throw registrationError(400, error);
  return clean;
}

function choice(value, values, error) {
  if (typeof value !== 'string' || !values.includes(value.trim())) throw registrationError(400, error);
  return value.trim();
}

export function normalizeRegistrationPhone(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^\+?[\d\s().-]+$/.test(value.trim())) throw registrationError(400, 'invalid_phone');
  let clean = value.trim().replace(/[\s().-]/g, '');
  if (clean.startsWith('08')) clean = '+62' + clean.slice(1);
  else if (clean.startsWith('62')) clean = '+' + clean;
  if (!/^\+[1-9]\d{7,14}$/.test(clean)) throw registrationError(400, 'invalid_phone');
  if (clean.startsWith('+62') && !/^\+628\d{7,11}$/.test(clean)) throw registrationError(400, 'invalid_phone');
  return clean;
}

export function validateBirthDate(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw registrationError(400, 'invalid_birth_date');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw registrationError(400, 'invalid_birth_date');
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age--;
  if (age < 5 || age > 100) throw registrationError(400, 'implausible_birth_date');
  return value;
}

export function parseRegistrationProfile(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw registrationError(400, 'invalid_registration_fields');
  if (body.consent !== true) throw registrationError(400, 'consent_required');
  const referralSource = choice(body.referralSource, REFERRAL_SOURCES, 'invalid_referral_source');
  return {
    fullName: body.fullName === undefined ? undefined : text(body.fullName, 100, 'invalid_full_name'),
    courseSlug: text(body.courseSlug, 160, 'invalid_course_slug'),
    birthDate: validateBirthDate(body.birthDate, now),
    province: choice(body.province, PROVINCES, 'invalid_province'),
    city: text(body.city, 100, 'invalid_city'),
    phone: normalizeRegistrationPhone(body.phone),
    learningGoal: choice(body.learningGoal, LEARNING_GOALS, 'invalid_learning_goal'),
    referralSource,
    background: choice(body.background, BACKGROUNDS, 'invalid_background'),
    japanGoal: choice(body.japanGoal, JAPAN_GOALS, 'invalid_japan_goal'),
    categoryInterest: text(body.categoryInterest, 160, 'invalid_category_interest'),
    primaryProblem: choice(body.primaryProblem, PRIMARY_PROBLEMS, 'invalid_primary_problem'),
    targetTimeline: choice(body.targetTimeline, TARGET_TIMELINES, 'invalid_target_timeline'),
    referrerName: referralSource === 'teman_keluarga' ? text(body.referrerName, 160, 'invalid_referrer_name') : '',
    sourceDetail: text(body.sourceDetail, 160, 'invalid_source_detail', false),
  };
}

function dateOnly(value) {
  // pg parses DATE at local midnight; UTC conversion can move it to yesterday.
  if (value instanceof Date) return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  return String(value).slice(0, 10);
}

export function serializeRegistrationProfile(row) {
  if (!row) return { hasProfile: false, needsUpdate: true };
  return {
    hasProfile: true,
    needsUpdate: Number(row.strategy_version || 0) < REGISTRATION_STRATEGY_VERSION,
    strategyVersion: Number(row.strategy_version || 0),
    birthDate: dateOnly(row.birth_date),
    province: row.province,
    city: row.city,
    phone: row.phone,
    learningGoal: row.learning_goal,
    referralSource: row.referral_source,
    background: row.background || '',
    japanGoal: row.japan_goal || '',
    categoryInterest: row.category_interest || '',
    primaryProblem: row.primary_problem || '',
    targetTimeline: row.target_timeline || '',
    referrerName: row.referrer_name || '',
    sourceDetail: row.source_detail || '',
  };
}

export async function loadRegistrationProfile(client, userId) {
  const { rows } = await client.query('SELECT * FROM user_marketing_profile WHERE user_id = $1', [userId]);
  const row = rows[0];
  if (!row || Number(row.strategy_version || 0) < REGISTRATION_STRATEGY_VERSION) throw registrationError(428, 'registration_profile_required');
  return row;
}
