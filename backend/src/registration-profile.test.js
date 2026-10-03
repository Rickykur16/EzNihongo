import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import {
  parseRegistrationProfile, normalizeRegistrationPhone, validateBirthDate,
  serializeRegistrationProfile, loadRegistrationProfile, isRegistrationProfileComplete, isCurrentJapaneseLevel,
} from './registration-profile.js';

const now = new Date('2026-10-03T00:00:00.000Z');
const valid = {
  courseSlug: 'n5-fixture', birthDate: '2000-02-29', province: 'Papua', city: 'Jayapura',
  phone: '0812 3456 7890', learningGoal: 'kerja_jepang', referralSource: 'teman_keluarga',
  background: 'ex_intern_hospitality', japanGoal: 'return', japaneseLevel: 'basics', categoryInterest: 'Perhotelan',
  primaryProblem: 'cost', targetTimeline: 'within_6_months', referrerName: 'Teman contoh',
  sourceDetail: 'Komunitas alumni', consent: true,
};

test('birth dates require a real calendar day and completed age 5 through 100', () => {
  for (const date of ['2001-02-29', '2000-02-30', '2000-04-31', '2000-13-01', '2000-2-01', '01/02/2000', null, 2000]) {
    assert.throws(() => validateBirthDate(date, now), { status: 400, message: 'invalid_birth_date' });
  }
  for (const date of ['2000-02-29', '2021-10-03', '1926-10-03', '1925-10-04']) assert.equal(validateBirthDate(date, now), date);
  for (const date of ['2021-10-04', '1925-10-03', '2030-01-01']) assert.throws(() => validateBirthDate(date, now), { message: 'implausible_birth_date' });
  assert.equal(validateBirthDate('2020-02-29', new Date('2025-03-01T00:00:00Z')), '2020-02-29');
  assert.throws(() => validateBirthDate('2020-02-29', new Date('2025-02-28T00:00:00Z')), { message: 'implausible_birth_date' });
});

test('WhatsApp numbers have one canonical value for Indonesia and support international country codes', () => {
  for (const phone of ['081234567890', '6281234567890', '+62 812-3456-7890', '+62 (812) 3456 7890']) assert.equal(normalizeRegistrationPhone(phone), '+6281234567890');
  assert.equal(normalizeRegistrationPhone('+81 90-1234-5678'), '+819012345678');
  for (const phone of ['123', '0812abc56789', '+0 123456789', '09012345678', '819012345678', '+621234567890', '++6281234567890', '+1234567890123456', 8123456789]) {
    assert.throws(() => normalizeRegistrationPhone(phone), { status: 400, message: 'invalid_phone' });
  }
});

test('registration validates all required strategy fields, consent, plain text and reference attribution', () => {
  const result = parseRegistrationProfile({ ...valid, city: ' Jayapura ', categoryInterest: ' Perhotelan ' }, now);
  assert.equal(result.city, 'Jayapura');
  assert.equal(result.categoryInterest, 'Perhotelan');
  assert.equal(result.phone, '+6281234567890');
  for (const key of ['courseSlug', 'birthDate', 'province', 'city', 'phone', 'learningGoal', 'referralSource', 'background', 'japanGoal', 'japaneseLevel', 'categoryInterest', 'primaryProblem', 'targetTimeline', 'referrerName']) {
    assert.throws(() => parseRegistrationProfile({ ...valid, [key]: '' }, now), { status: 400 }, key);
  }
  for (const consent of [false, 'true', 1, undefined]) assert.throws(() => parseRegistrationProfile({ ...valid, consent }, now), { message: 'consent_required' });
  for (const source of ['facebook', 'whatsapp', 'website', 'event', 'instagram', 'google', 'youtube', 'tiktok', 'lainnya']) {
    const profile = parseRegistrationProfile({ ...valid, referralSource: source, referralSourceOther: 'Komunitas lokal', referrerName: undefined, sourceDetail: undefined }, now);
    assert.equal(profile.referrerName, ''); assert.equal(profile.sourceDetail, '');
    assert.equal(parseRegistrationProfile({ ...valid, referralSource: source, referralSourceOther: 'Komunitas lokal' }, now).referrerName, '');
  }
  for (const [field, value] of [['categoryInterest', 'x'.repeat(161)], ['city', 'x'.repeat(101)], ['referrerName', '<script>'], ['sourceDetail', 'line\nbreak'], ['background', 'unknown'], ['japanGoal', []], ['primaryProblem', {}], ['targetTimeline', 'tomorrow']]) {
    assert.throws(() => parseRegistrationProfile({ ...valid, [field]: value }, now), { status: 400 });
  }
});

test('one internship choice records the selected field while preserving stored CRM background codes', () => {
  for (const internshipField of ['hospitality', 'manufacturing', 'construction', 'agriculture', 'caregiving', 'fisheries', 'other']) {
    const parsed = parseRegistrationProfile({ ...valid, background: 'ex_intern', internshipField, internshipFieldOther: 'Tekstil' }, now);
    assert.equal(parsed.background, internshipField === 'hospitality' ? 'ex_intern_hospitality' : 'ex_intern_other');
    assert.equal(parsed.internshipField, internshipField);
    assert.equal(parsed.internshipFieldOther, internshipField === 'other' ? 'Tekstil' : '');
  }
  assert.equal(parseRegistrationProfile(valid, now).internshipField, 'hospitality');
  for (const background of ['ex_intern', 'ex_intern_other']) assert.throws(() => parseRegistrationProfile({ ...valid, background }, now), { message: 'invalid_internship_field' });
  assert.throws(() => parseRegistrationProfile({ ...valid, background: 'ex_intern', internshipField: 'unknown' }, now), { message: 'invalid_internship_field' });
});

test('each active other choice requires bounded plain text and inactive details are cleared', () => {
  const cases = [
    [{ background: 'ex_intern', internshipField: 'other' }, 'internshipFieldOther', 'invalid_internship_field_other'],
    [{ background: 'other' }, 'backgroundOther', 'invalid_background_other'],
    [{ learningGoal: 'lainnya' }, 'learningGoalOther', 'invalid_learning_goal_other'],
    [{ primaryProblem: 'other' }, 'primaryProblemOther', 'invalid_primary_problem_other'],
    [{ referralSource: 'lainnya' }, 'referralSourceOther', 'invalid_referral_source_other'],
  ];
  for (const [parent, field, error] of cases) {
    for (const value of [undefined, '', ' ', null, 123, 'x'.repeat(161), '<tag>', 'two\nlines']) {
      assert.throws(() => parseRegistrationProfile({ ...valid, ...parent, [field]: value }, now), { status: 400, message: error });
    }
    assert.equal(parseRegistrationProfile({ ...valid, ...parent, [field]: '  Penjelasan khusus  ' }, now)[field], 'Penjelasan khusus');
  }
  const inactive = parseRegistrationProfile({ ...valid, background: 'worker', internshipField: 'other', internshipFieldOther: 'old', backgroundOther: 'old', learningGoalOther: 'old', primaryProblemOther: 'old', referralSourceOther: 'old' }, now);
  for (const field of ['internshipField', 'internshipFieldOther', 'backgroundOther', 'learningGoalOther', 'primaryProblemOther', 'referralSourceOther']) assert.equal(inactive[field], '');
});

test('profiles with a current language self-assessment only need updating for missing conditional answers', async () => {
  const unchanged = { strategy_version: 2, background: 'worker', learning_goal: 'jlpt', japanese_level: 'basics', primary_problem: 'cost', referral_source: 'instagram' };
  assert.equal(isRegistrationProfileComplete(unchanged), true);
  assert.equal(isRegistrationProfileComplete({ ...unchanged, background: 'ex_intern_hospitality' }), true);
  const oldIntern = { ...unchanged, background: 'ex_intern_other' };
  assert.equal(serializeRegistrationProfile(oldIntern).needsUpdate, true);
  assert.equal(serializeRegistrationProfile({ ...unchanged, background: 'ex_intern_hospitality' }).internshipField, 'hospitality');
  await assert.rejects(loadRegistrationProfile({ query: async () => ({ rows: [oldIntern] }) }, 'fixture'), { status: 428 });
  assert.equal(isRegistrationProfileComplete({ ...oldIntern, internship_field: 'manufacturing' }), true);
  for (const [parent, field] of [[{ background: 'other' }, 'background_other'], [{ learning_goal: 'lainnya' }, 'learning_goal_other'], [{ primary_problem: 'other' }, 'primary_problem_other'], [{ referral_source: 'lainnya' }, 'referral_source_other'], [{ background: 'ex_intern_other', internship_field: 'other' }, 'internship_field_other']]) {
    assert.equal(isRegistrationProfileComplete({ ...unchanged, ...parent }), false);
    assert.equal(isRegistrationProfileComplete({ ...unchanged, ...parent, [field]: 'Penjelasan tersimpan' }), true);
  }
});

test('Japanese self-assessment is explicitly required and cannot be inferred from other answers', async () => {
  for (const japaneseLevel of ['new_to_japanese', 'basics', 'n5', 'n4', 'n3_plus', 'unsure']) {
    assert.equal(parseRegistrationProfile({ ...valid, japaneseLevel }, now).japaneseLevel, japaneseLevel);
    assert.equal(isCurrentJapaneseLevel(japaneseLevel), true);
  }
  const existing = { strategy_version: 2, background: 'ex_intern_hospitality', learning_goal: 'jlpt', city: 'Jayapura' };
  for (const japaneseLevel of [undefined, '', ' ', null, 4, {}, 'N4', 'certified_n4']) {
    assert.throws(() => parseRegistrationProfile({ ...valid, japaneseLevel }, now), { status: 400, message: 'invalid_japanese_level' });
    const row = { ...existing, japanese_level: japaneseLevel };
    assert.equal(isCurrentJapaneseLevel(japaneseLevel), false);
    assert.equal(serializeRegistrationProfile(row).needsUpdate, true);
    await assert.rejects(loadRegistrationProfile({ query: async () => ({ rows: [row] }) }, 'fixture'), { status: 428 });
  }
  assert.equal(serializeRegistrationProfile(existing).city, 'Jayapura');
  const completed = { ...existing, japanese_level: 'unsure' };
  assert.equal(serializeRegistrationProfile(completed).needsUpdate, false);
  assert.equal(await loadRegistrationProfile({ query: async () => ({ rows: [completed] }) }, 'fixture'), completed);
});

test('registration names are optional for older clients but supplied names must be valid plain text', () => {
  assert.equal(parseRegistrationProfile(valid, now).fullName, undefined);
  assert.equal(parseRegistrationProfile({ ...valid, fullName: '  Ayu Wulandari  ' }, now).fullName, 'Ayu Wulandari');
  for (const fullName of ['', '   ', null, 42, '<script>', 'Nama\nBaru', 'x'.repeat(101)]) {
    assert.throws(() => parseRegistrationProfile({ ...valid, fullName }, now), { status: 400, message: 'invalid_full_name' });
  }
  assert.equal(Object.hasOwn(parseRegistrationProfile({ ...valid, email: 'spoof@example.invalid' }, now), 'email'), false);
});

test('legacy profiles are returned for prefilling while marked as needing an update', () => {
  assert.deepEqual(serializeRegistrationProfile(null), { hasProfile: false, needsUpdate: true });
  const row = { birth_date: new Date(2000, 1, 29), city: 'Jayapura', phone: '081234567890', strategy_version: 0 };
  const legacy = serializeRegistrationProfile(row);
  assert.equal(legacy.birthDate, '2000-02-29'); assert.equal(legacy.city, 'Jayapura');
  assert.equal(legacy.hasProfile, true); assert.equal(legacy.needsUpdate, true); assert.equal(legacy.background, '');
  assert.equal(serializeRegistrationProfile({ ...row, strategy_version: 2 }).needsUpdate, true);
  assert.equal(serializeRegistrationProfile({ ...row, strategy_version: 2, japanese_level: 'basics' }).needsUpdate, false);
});

test('checkout gate refuses missing or legacy profiles and returns the persisted v2 row', async () => {
  for (const rows of [[], [{ strategy_version: 0 }], [{ strategy_version: 1 }]]) {
    await assert.rejects(loadRegistrationProfile({ query: async () => ({ rows }) }, 'fixture-user'), { status: 428, message: 'registration_profile_required' });
  }
  const row = { strategy_version: 2, background: 'worker', japanese_level: 'basics' };
  assert.equal(await loadRegistrationProfile({ query: async () => ({ rows: [row] }) }, 'fixture-user'), row);
});

test('registration migration and HTTP flow persist strategy data without losing legacy answers', { skip: !process.env.TEST_DATABASE_URL, timeout: 30000 }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.match(url.pathname, /test/); assert.ok(!url.searchParams.has('host'));
  const { default: pg } = await import('pg');
  const { default: express } = await import('express');
  const schema = 'registration_profile_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  let server, pool;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await pool?.end();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await control.end();
  });
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'registration-test-only-access';
  process.env.JWT_REFRESH_SECRET = 'registration-test-only-refresh';
  process.env.MARKETING_CRM_ENABLED = 'false';
  process.env.TELEGRAM_BOT_TOKEN = ''; process.env.TELEGRAM_ADMIN_CHAT_ID = '';
  await control.query(`CREATE TABLE users(id UUID PRIMARY KEY, email TEXT, full_name TEXT);
    CREATE TABLE courses(id UUID PRIMARY KEY, slug TEXT UNIQUE, is_published BOOLEAN, is_available BOOLEAN);
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;`);
  await control.query(await readFile(new URL('../migrations/138_user_marketing_profile.sql', import.meta.url), 'utf8'));
  const userId = randomUUID(), otherId = randomUUID(), courseId = randomUUID();
  await control.query("INSERT INTO users VALUES($1,'student@example.invalid','Siswa contoh'),($2,'other@example.invalid','Siswa lain')", [userId, otherId]);
  await control.query("INSERT INTO courses VALUES($1,'n5-fixture',true,true)", [courseId]);
  await control.query("INSERT INTO user_marketing_profile(user_id,birth_date,province,city,phone,learning_goal,referral_source,consented_at) VALUES($1,'2000-02-29','Papua','Jayapura','081234567890','jlpt','instagram',NOW())", [userId]);
  const migration = await readFile(new URL('../migrations/200_registration_strategy.sql', import.meta.url), 'utf8');
  await control.query(migration); await control.query(migration);
  const detailMigration = await readFile(new URL('../migrations/202_registration_other_details.sql', import.meta.url), 'utf8');
  await control.query(detailMigration); await control.query(detailMigration);
  const levelMigration = await readFile(new URL('../migrations/203_registration_japanese_level.sql', import.meta.url), 'utf8');
  await control.query(levelMigration); await control.query(levelMigration);
  assert.equal((await control.query('SELECT strategy_version FROM user_marketing_profile WHERE user_id=$1', [userId])).rows[0].strategy_version, 0);
  const { db } = await import('./db.js'); pool = db;
  const { signAccessToken } = await import('./auth.js');
  const { default: profileRouter } = await import('./routes/profile.js');
  const token = await signAccessToken(userId, 'student@example.invalid');
  const app = express(); app.use(express.json()); app.use('/api', profileRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/api/profile/marketing`;
  const request = async (body, accessToken = token) => {
    const response = await fetch(endpoint, { method: body ? 'PUT' : 'GET', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const unregistered = await request(undefined, await signAccessToken(otherId, 'stale-token-email@example.invalid'));
  assert.equal(unregistered.status, 200);
  assert.deepEqual(unregistered.data, { hasProfile: false, needsUpdate: true, fullName: 'Siswa lain', email: 'other@example.invalid' });
  const legacy = await request();
  assert.equal(legacy.data.birthDate, '2000-02-29'); assert.equal(legacy.data.needsUpdate, true);
  assert.equal(legacy.data.fullName, 'Siswa contoh'); assert.equal(legacy.data.email, 'student@example.invalid');
  assert.equal(legacy.data.japaneseLevel, '');
  await assert.rejects(loadRegistrationProfile(control, userId), { status: 428 });
  assert.equal((await request({ ...valid, courseSlug: 'absent', fullName: 'Must not save' })).status, 404);
  assert.equal((await request()).data.fullName, 'Siswa contoh');
  await control.query('UPDATE courses SET is_available=false WHERE id=$1', [courseId]);
  assert.equal((await request(valid)).status, 403);
  assert.equal((await control.query('SELECT strategy_version FROM user_marketing_profile')).rows[0].strategy_version, 0);
  await control.query('UPDATE courses SET is_available=true WHERE id=$1', [courseId]);
  assert.equal((await request({ ...valid, birthDate: '2001-02-29' })).status, 400);
  assert.equal((await request({ ...valid, consent: false })).status, 400);
  assert.equal((await request({ ...valid, japaneseLevel: undefined })).data.error, 'invalid_japanese_level');
  assert.equal((await request({ ...valid, japaneseLevel: 'certified_n4' })).data.error, 'invalid_japanese_level');
  assert.equal((await request({ ...valid, fullName: ' ' })).data.error, 'invalid_full_name');
  assert.equal((await request(valid)).status, 200);
  assert.equal((await request(valid)).status, 200);
  assert.equal((await request()).data.fullName, 'Siswa contoh');
  assert.equal((await request({ ...valid, fullName: '  Nama Lengkap Diperbaiki  ', email: 'spoof@example.invalid' })).status, 200);
  assert.deepEqual((await control.query('SELECT full_name,email FROM users WHERE id=$1', [userId])).rows[0], { full_name: 'Nama Lengkap Diperbaiki', email: 'student@example.invalid' });
  const saved = await loadRegistrationProfile(control, userId);
  assert.equal(saved.phone, '+6281234567890'); assert.equal(saved.japan_goal, 'return');
  assert.equal(saved.japanese_level, 'basics');
  assert.equal(saved.background, 'ex_intern_hospitality'); assert.equal(saved.category_interest, 'Perhotelan');
  assert.equal(saved.referrer_name, 'Teman contoh'); assert.equal(saved.source_detail, 'Komunitas alumni');
  assert.equal((await control.query('SELECT count(*)::int AS n FROM user_marketing_profile')).rows[0].n, 1);
  const refreshed = await request();
  assert.equal(refreshed.data.needsUpdate, false); assert.equal(refreshed.data.birthDate, valid.birthDate);
  assert.equal(refreshed.data.fullName, 'Nama Lengkap Diperbaiki'); assert.equal(refreshed.data.email, 'student@example.invalid');
  assert.equal(refreshed.data.primaryProblem, 'cost'); assert.equal(refreshed.data.targetTimeline, 'within_6_months');
  assert.equal(refreshed.data.japaneseLevel, 'basics');
  await control.query("UPDATE user_marketing_profile SET japanese_level='' WHERE user_id=$1", [userId]);
  const incompleteLevel = (await request()).data;
  assert.equal(incompleteLevel.needsUpdate, true); assert.equal(incompleteLevel.city, 'Jayapura'); assert.equal(incompleteLevel.referrerName, valid.referrerName);
  await assert.rejects(loadRegistrationProfile(control, userId), { status: 428 });
  assert.equal((await request({ ...valid, japaneseLevel: 'n4' })).status, 200);
  assert.equal((await request()).data.needsUpdate, false); assert.equal((await loadRegistrationProfile(control, userId)).japanese_level, 'n4');
  await assert.rejects(control.query("UPDATE user_marketing_profile SET japanese_level='certified_n4' WHERE user_id=$1", [userId]), { code: '23514' });
  const detailed = { ...valid, background: 'ex_intern', internshipField: 'other', internshipFieldOther: 'Tekstil', learningGoal: 'lainnya', learningGoalOther: 'Mendampingi keluarga', primaryProblem: 'other', primaryProblemOther: 'Dokumen', referralSource: 'lainnya', referralSourceOther: 'Komunitas kota' };
  assert.equal((await request({ ...detailed, internshipFieldOther: '' })).status, 400);
  assert.equal((await request(detailed)).status, 200);
  const detailedRow = await loadRegistrationProfile(control, userId);
  assert.equal(detailedRow.background, 'ex_intern_other'); assert.equal(detailedRow.internship_field, 'other');
  assert.equal(detailedRow.internship_field_other, 'Tekstil'); assert.equal(detailedRow.learning_goal_other, 'Mendampingi keluarga');
  assert.equal(detailedRow.primary_problem_other, 'Dokumen'); assert.equal(detailedRow.referral_source_other, 'Komunitas kota');
  const detailedGet = (await request()).data;
  for (const key of ['internshipField', 'internshipFieldOther', 'learningGoalOther', 'primaryProblemOther', 'referralSourceOther']) assert.equal(detailedGet[key], detailed[key]);
  assert.equal(detailedGet.needsUpdate, false);
  assert.equal((await request({ ...valid, background: 'other', backgroundOther: 'Wiraswasta', internshipField: 'other', internshipFieldOther: 'Stale', learningGoalOther: 'Stale', primaryProblemOther: 'Stale', referralSourceOther: 'Stale' })).status, 200);
  const changedGet = (await request()).data;
  assert.equal(changedGet.backgroundOther, 'Wiraswasta');
  for (const key of ['internshipField', 'internshipFieldOther', 'learningGoalOther', 'primaryProblemOther', 'referralSourceOther']) assert.equal(changedGet[key], '');
  await assert.rejects(control.query('UPDATE user_marketing_profile SET background_other=$2 WHERE user_id=$1', [userId, 'x'.repeat(161)]), { code: '23514' });
  await assert.rejects(control.query("INSERT INTO user_marketing_profile(user_id,birth_date,province,city,phone,learning_goal,referral_source,consented_at,strategy_version) VALUES($1,'2000-01-01','Papua','Jayapura','081234567890','jlpt','instagram',NOW(),2)", [otherId]), { code: '23514' });
  await control.query("UPDATE users SET email='erased@dihapus.invalid' WHERE id=$1", [userId]);
  assert.equal((await request()).status, 401);
  assert.equal((await request({ ...valid, city: 'Bandung' })).status, 401);
  assert.equal((await control.query('SELECT city FROM user_marketing_profile WHERE user_id=$1', [userId])).rows[0].city, 'Jayapura');
});
