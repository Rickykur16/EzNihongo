import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import {
  parseRegistrationProfile, normalizeRegistrationPhone, validateBirthDate,
  serializeRegistrationProfile, loadRegistrationProfile,
} from './registration-profile.js';

const now = new Date('2026-10-03T00:00:00.000Z');
const valid = {
  courseSlug: 'n5-fixture', birthDate: '2000-02-29', province: 'Papua', city: 'Jayapura',
  phone: '0812 3456 7890', learningGoal: 'kerja_jepang', referralSource: 'teman_keluarga',
  background: 'ex_intern_hospitality', japanGoal: 'return', categoryInterest: 'Perhotelan',
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
  for (const key of ['courseSlug', 'birthDate', 'province', 'city', 'phone', 'learningGoal', 'referralSource', 'background', 'japanGoal', 'categoryInterest', 'primaryProblem', 'targetTimeline', 'referrerName']) {
    assert.throws(() => parseRegistrationProfile({ ...valid, [key]: '' }, now), { status: 400 }, key);
  }
  for (const consent of [false, 'true', 1, undefined]) assert.throws(() => parseRegistrationProfile({ ...valid, consent }, now), { message: 'consent_required' });
  for (const source of ['facebook', 'whatsapp', 'website', 'event', 'instagram', 'google', 'youtube', 'tiktok', 'lainnya']) {
    const profile = parseRegistrationProfile({ ...valid, referralSource: source, referrerName: undefined, sourceDetail: undefined }, now);
    assert.equal(profile.referrerName, ''); assert.equal(profile.sourceDetail, '');
    assert.equal(parseRegistrationProfile({ ...valid, referralSource: source }, now).referrerName, '');
  }
  for (const [field, value] of [['categoryInterest', 'x'.repeat(161)], ['city', 'x'.repeat(101)], ['referrerName', '<script>'], ['sourceDetail', 'line\nbreak'], ['background', 'unknown'], ['japanGoal', []], ['primaryProblem', {}], ['targetTimeline', 'tomorrow']]) {
    assert.throws(() => parseRegistrationProfile({ ...valid, [field]: value }, now), { status: 400 });
  }
});

test('legacy profiles are returned for prefilling while marked as needing an update', () => {
  assert.deepEqual(serializeRegistrationProfile(null), { hasProfile: false, needsUpdate: true });
  const row = { birth_date: new Date(2000, 1, 29), city: 'Jayapura', phone: '081234567890', strategy_version: 0 };
  const legacy = serializeRegistrationProfile(row);
  assert.equal(legacy.birthDate, '2000-02-29'); assert.equal(legacy.city, 'Jayapura');
  assert.equal(legacy.hasProfile, true); assert.equal(legacy.needsUpdate, true); assert.equal(legacy.background, '');
  assert.equal(serializeRegistrationProfile({ ...row, strategy_version: 2 }).needsUpdate, false);
});

test('checkout gate refuses missing or legacy profiles and returns the persisted v2 row', async () => {
  for (const rows of [[], [{ strategy_version: 0 }], [{ strategy_version: 1 }]]) {
    await assert.rejects(loadRegistrationProfile({ query: async () => ({ rows }) }, 'fixture-user'), { status: 428, message: 'registration_profile_required' });
  }
  const row = { strategy_version: 2, background: 'worker' };
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
  assert.equal((await control.query('SELECT strategy_version FROM user_marketing_profile WHERE user_id=$1', [userId])).rows[0].strategy_version, 0);
  const { db } = await import('./db.js'); pool = db;
  const { signAccessToken } = await import('./auth.js');
  const { default: profileRouter } = await import('./routes/profile.js');
  const token = await signAccessToken(userId, 'student@example.invalid');
  const app = express(); app.use(express.json()); app.use('/api', profileRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/api/profile/marketing`;
  const request = async body => {
    const response = await fetch(endpoint, { method: body ? 'PUT' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const legacy = await request();
  assert.equal(legacy.data.birthDate, '2000-02-29'); assert.equal(legacy.data.needsUpdate, true);
  await assert.rejects(loadRegistrationProfile(control, userId), { status: 428 });
  assert.equal((await request({ ...valid, courseSlug: 'absent' })).status, 404);
  await control.query('UPDATE courses SET is_available=false WHERE id=$1', [courseId]);
  assert.equal((await request(valid)).status, 403);
  assert.equal((await control.query('SELECT strategy_version FROM user_marketing_profile')).rows[0].strategy_version, 0);
  await control.query('UPDATE courses SET is_available=true WHERE id=$1', [courseId]);
  assert.equal((await request({ ...valid, birthDate: '2001-02-29' })).status, 400);
  assert.equal((await request({ ...valid, consent: false })).status, 400);
  assert.equal((await request(valid)).status, 200);
  assert.equal((await request(valid)).status, 200);
  const saved = await loadRegistrationProfile(control, userId);
  assert.equal(saved.phone, '+6281234567890'); assert.equal(saved.japan_goal, 'return');
  assert.equal(saved.background, 'ex_intern_hospitality'); assert.equal(saved.category_interest, 'Perhotelan');
  assert.equal(saved.referrer_name, 'Teman contoh'); assert.equal(saved.source_detail, 'Komunitas alumni');
  assert.equal((await control.query('SELECT count(*)::int AS n FROM user_marketing_profile')).rows[0].n, 1);
  const refreshed = await request();
  assert.equal(refreshed.data.needsUpdate, false); assert.equal(refreshed.data.birthDate, valid.birthDate);
  assert.equal(refreshed.data.primaryProblem, 'cost'); assert.equal(refreshed.data.targetTimeline, 'within_6_months');
  await assert.rejects(control.query("INSERT INTO user_marketing_profile(user_id,birth_date,province,city,phone,learning_goal,referral_source,consented_at,strategy_version) VALUES($1,'2000-01-01','Papua','Jayapura','081234567890','jlpt','instagram',NOW(),2)", [otherId]), { code: '23514' });
  await control.query("UPDATE users SET email='erased@dihapus.invalid' WHERE id=$1", [userId]);
  assert.equal((await request({ ...valid, city: 'Bandung' })).status, 401);
  assert.equal((await control.query('SELECT city FROM user_marketing_profile WHERE user_id=$1', [userId])).rows[0].city, 'Jayapura');
});
