import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { notifyAdmin } from '../telegram.js';
import { parseRegistrationProfile, serializeRegistrationProfile, registrationError, REGISTRATION_STRATEGY_VERSION } from '../registration-profile.js';
import { syncRegistrationLead } from '../registration-crm.js';

const router = Router();
router.use(requireAuth);

router.get('/profile/marketing', asyncHandler(async (req, res) => {
  const r = await query(`SELECT u.email, u.full_name, p.* FROM users u
    LEFT JOIN user_marketing_profile p ON p.user_id = u.id WHERE u.id = $1`, [req.user.id]);
  const row = r.rows[0];
  if (!row || row.email.endsWith('@dihapus.invalid')) throw registrationError(401, 'registration_account_unavailable');
  res.set('Cache-Control', 'private, no-store').json({
    ...serializeRegistrationProfile(row.user_id ? row : null),
    fullName: row.full_name,
    email: row.email,
  });
}));

router.put('/profile/marketing', asyncHandler(async (req, res) => {
  const data = parseRegistrationProfile(req.body);
  const user = await withTransaction(async client => {
    // Same first lock as account erasure: a save cannot recreate erased data.
    const person = (await client.query('SELECT id, email, full_name FROM users WHERE id = $1 FOR UPDATE', [req.user.id])).rows[0];
    if (!person || person.email.endsWith('@dihapus.invalid')) throw registrationError(401, 'registration_account_unavailable');
    const course = (await client.query('SELECT id, is_published, is_available FROM courses WHERE slug = $1 FOR SHARE', [data.courseSlug])).rows[0];
    if (!course || !course.is_published) throw registrationError(404, 'course_not_found');
    if (course.is_available === false) throw registrationError(403, 'course_not_available');

    // The account's verified email is authoritative; only the name is editable.
    if (data.fullName !== undefined && data.fullName !== person.full_name) {
      await client.query('UPDATE users SET full_name = $2 WHERE id = $1', [person.id, data.fullName]);
      person.full_name = data.fullName;
    }

    const profile = (await client.query(
      `INSERT INTO user_marketing_profile
         (user_id, birth_date, province, city, phone, learning_goal, referral_source,
          background, japan_goal, category_interest, primary_problem, target_timeline,
          referrer_name, source_detail, strategy_version, consented_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         birth_date = EXCLUDED.birth_date, province = EXCLUDED.province,
         city = EXCLUDED.city, phone = EXCLUDED.phone, learning_goal = EXCLUDED.learning_goal,
         referral_source = EXCLUDED.referral_source, background = EXCLUDED.background,
         japan_goal = EXCLUDED.japan_goal, category_interest = EXCLUDED.category_interest,
         primary_problem = EXCLUDED.primary_problem, target_timeline = EXCLUDED.target_timeline,
         referrer_name = EXCLUDED.referrer_name, source_detail = EXCLUDED.source_detail,
         strategy_version = EXCLUDED.strategy_version, consented_at = NOW()
       RETURNING *`,
      [person.id, data.birthDate, data.province, data.city, data.phone, data.learningGoal,
        data.referralSource, data.background, data.japanGoal, data.categoryInterest,
        data.primaryProblem, data.targetTimeline, data.referrerName, data.sourceDetail,
        REGISTRATION_STRATEGY_VERSION]
    )).rows[0];
    await syncRegistrationLead(client, person, profile, course.id);
    return person;
  });

  // Keep the existing notification fields; new research answers stay in the DB.
  await notifyAdmin([
    '🎓 Siswa baru mengisi data profil',
    `Nama: ${user.full_name || user.email}`,
    `Email: ${user.email}`,
    `Domisili: ${data.city}, ${data.province}`,
    `Tujuan: ${data.learningGoal}`,
    `WhatsApp: ${data.phone}`,
  ].join('\n'));
  res.json({ ok: true });
}));

export default router;
