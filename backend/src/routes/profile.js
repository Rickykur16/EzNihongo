import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { notifyAdmin } from '../telegram.js';

const router = Router();
router.use(requireAuth);

// Full-caps list, not free text — keeps the data actually usable for
// classification (free-text province names would fragment into a dozen
// spellings of the same place). Kept in sync by hand with the <select>
// options in courses/course.js; see CLAUDE.md's note on duplicated fixed
// option lists (QUIZ_CATEGORY_LABELS et al.) for why that's the accepted
// pattern in this repo rather than a shared JSON file.
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
const LEARNING_GOALS = new Set(['jlpt', 'kerja_jepang', 'hobi', 'kuliah', 'lainnya']);
const REFERRAL_SOURCES = new Set(['instagram', 'tiktok', 'youtube', 'google', 'teman_keluarga', 'lainnya']);
// Loose Indonesian mobile pattern (0812..., +62812..., 62812...) — enough to
// catch obviously-wrong input without rejecting real numbers over edge cases.
const PHONE_RE = /^(\+?62|0)8[0-9]{7,11}$/;

function serializeProfile(row) {
  if (!row) return { hasProfile: false };
  return {
    hasProfile: true,
    birthDate: row.birth_date,
    province: row.province,
    city: row.city,
    phone: row.phone,
    learningGoal: row.learning_goal,
    referralSource: row.referral_source,
  };
}

// GET /api/profile/marketing — courses/detail.html calls this before
// rendering checkout to decide whether the required fields are still needed
// (no row yet) or can be skipped (already given once, at an earlier enrollment).
router.get('/profile/marketing', asyncHandler(async (req, res) => {
  const r = await query(`SELECT * FROM user_marketing_profile WHERE user_id = $1`, [req.user.id]);
  res.json(serializeProfile(r.rows[0]));
}));

// PUT /api/profile/marketing — always requires the full set + explicit
// consent; there is no partial-save or skip path (see migration 138 comment
// for why: the row's mere existence is what tells the checkout flow "already
// asked", so a partial row would silently defeat that check next time).
router.put('/profile/marketing', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const birthDate = String(body.birthDate || '').trim();
  const province = String(body.province || '').trim();
  const city = String(body.city || '').trim();
  const phone = String(body.phone || '').trim().replace(/[\s-]/g, '');
  const learningGoal = String(body.learningGoal || '').trim();
  const referralSource = String(body.referralSource || '').trim();

  // Consent is the legal basis for storing any of this — validated here
  // regardless of what the UI already enforces, so a direct API call can't
  // bypass it.
  if (body.consent !== true) {
    return res.status(400).json({ error: 'consent_required' });
  }

  const parsedDate = birthDate ? new Date(birthDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'invalid_birth_date' });
  }
  const ageYears = (Date.now() - parsedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 5 || ageYears > 100) {
    return res.status(400).json({ error: 'implausible_birth_date' });
  }
  if (!PROVINCES.includes(province)) {
    return res.status(400).json({ error: 'invalid_province' });
  }
  if (!city || city.length > 100) {
    return res.status(400).json({ error: 'invalid_city' });
  }
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'invalid_phone' });
  }
  if (!LEARNING_GOALS.has(learningGoal)) {
    return res.status(400).json({ error: 'invalid_learning_goal' });
  }
  if (!REFERRAL_SOURCES.has(referralSource)) {
    return res.status(400).json({ error: 'invalid_referral_source' });
  }

  await query(
    `INSERT INTO user_marketing_profile
       (user_id, birth_date, province, city, phone, learning_goal, referral_source, consented_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET birth_date = $2, province = $3, city = $4, phone = $5,
           learning_goal = $6, referral_source = $7, consented_at = NOW()`,
    [req.user.id, birthDate, province, city, phone, learningGoal, referralSource]
  );

  const userRow = await query(`SELECT full_name FROM users WHERE id = $1`, [req.user.id]);
  await notifyAdmin([
    '🎓 Siswa baru mengisi data profil',
    `Nama: ${userRow.rows[0]?.full_name || req.user.email}`,
    `Email: ${req.user.email}`,
    `Domisili: ${city}, ${province}`,
    `Tujuan: ${learningGoal}`,
    `WhatsApp: ${phone}`,
  ].join('\n'));

  res.json({ ok: true });
}));

export default router;
