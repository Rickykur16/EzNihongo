// Registration answers are first-party evidence, not a sales qualification or
// payment confirmation. Keep existing staff attribution and workflow intact.
const SOURCES = { teman_keluarga: 'referral', lainnya: 'other' };
const GOALS = { jlpt: 'Lulus JLPT', kerja_jepang: 'Kerja di Jepang', hobi: 'Hobi / minat pribadi', kuliah: 'Kuliah / beasiswa ke Jepang', lainnya: 'Lainnya' };
const JAPAN_GOALS = { first_time: 'Pertama kali bekerja di Jepang', return: 'Kembali bekerja di Jepang', study: 'Melanjutkan studi di Jepang', undecided: 'Rencana Jepang belum ditentukan' };
const TIMELINES = { within_3_months: 'Dalam 3 bulan', within_6_months: 'Dalam 4–6 bulan', within_12_months: 'Dalam 7–12 bulan', over_12_months: 'Lebih dari 12 bulan', undecided: 'Belum menentukan' };

export function registrationCrmFields(profile) {
  return {
    source: SOURCES[profile.referral_source] || profile.referral_source,
    source_detail: ['Form pendaftaran: ' + profile.referral_source, profile.source_detail].filter(Boolean).join(' · ').slice(0, 240),
    goal: [GOALS[profile.learning_goal], JAPAN_GOALS[profile.japan_goal]].filter(Boolean).join(' · '),
    referrer_name: profile.referrer_name || '',
    background: profile.background,
    category_interest: profile.category_interest,
    primary_problem: profile.primary_problem === 'undecided' ? '' : profile.primary_problem,
    target_timeline: TIMELINES[profile.target_timeline] || '',
  };
}

async function crmPresent(client) {
  const { rows } = await client.query("SELECT to_regclass('marketing_leads') IS NOT NULL AND to_regclass('marketing_lead_events') IS NOT NULL AS ready");
  return rows[0].ready;
}

export async function syncRegistrationLead(client, user, profile, courseId) {
  if (process.env.COMPANY_WORKSPACE_ENABLED !== 'true' || process.env.MARKETING_CRM_ENABLED !== 'true') return null;
  if (!(await crmPresent(client))) return null;
  const email = user.email.toLowerCase();
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['registration-crm:' + email + ':' + courseId]);
  const fields = registrationCrmFields(profile);
  let existing = (await client.query('SELECT * FROM marketing_leads WHERE course_id=$1 AND email=$2 FOR UPDATE', [courseId, email])).rows[0];
  if (!existing) {
    const phoneInUse = (await client.query('SELECT id FROM marketing_leads WHERE course_id=$1 AND phone=$2', [courseId, profile.phone])).rows.length > 0;
    const columns = Object.keys(fields);
    const values = [courseId, (user.full_name || 'Calon siswa').trim().slice(0, 160), phoneInUse ? '' : profile.phone, email, user.id, ...Object.values(fields)];
    const insert = `INSERT INTO marketing_leads(course_id,full_name,phone,email,created_by,${columns.join(',')}) VALUES(${values.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT DO NOTHING RETURNING *`;
    let created = (await client.query(insert, values)).rows[0];
    // A manual contact may have claimed the same phone concurrently. Keep the
    // verified account email; never merge two different people by phone alone.
    if (!created) {
      values[2] = '';
      created = (await client.query(insert, values)).rows[0];
    }
    if (created) {
      await client.query("INSERT INTO marketing_lead_events(lead_id,actor_user_id,event_key,stage,note,lead_version) VALUES($1,$2,'created','new','Dari formulir pendaftaran kelas.',1)", [created.id, user.id]);
      return created.id;
    }
    existing = (await client.query('SELECT * FROM marketing_leads WHERE course_id=$1 AND email=$2 FOR UPDATE', [courseId, email])).rows[0];
    if (!existing) throw new Error('registration_crm_conflict');
  }
  // Preserve the first source, staff notes, prices, stage, and interview fields.
  const missing = Object.entries(fields).filter(([key, value]) => key !== 'source' && value && !existing[key]);
  if (!missing.length) return existing.id;
  const updated = (await client.query(`UPDATE marketing_leads SET ${missing.map(([key], i) => key + '=$' + (i + 2)).join(',')},version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [existing.id, ...missing.map(([, value]) => value)])).rows[0];
  await client.query("INSERT INTO marketing_lead_events(lead_id,actor_user_id,event_key,stage,note,lead_version) VALUES($1,$2,'updated',$3,'Data yang belum tercatat dilengkapi dari formulir pendaftaran.',$4)", [updated.id, user.id, updated.stage, updated.version]);
  return updated.id;
}

export async function deleteRegistrationLeads(client, userId) {
  // Consent withdrawal must remove copies even if the CRM feature is disabled.
  const { rows } = await client.query("SELECT to_regclass('marketing_leads') IS NOT NULL AS ready");
  if (!rows[0].ready) return 0;
  const deleted = await client.query("DELETE FROM marketing_leads WHERE email<>'' AND email=(SELECT lower(email) FROM users WHERE id=$1)", [userId]);
  return deleted.rowCount;
}
