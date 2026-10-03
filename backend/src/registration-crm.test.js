import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const answers = {
  birthDate: '2000-02-29', province: 'Papua', city: 'Jayapura', phone: '+819012345678',
  learningGoal: 'kerja_jepang', referralSource: 'teman_keluarga', referrerName: 'Alumni contoh',
  background: 'ex_intern_hospitality', japanGoal: 'return', categoryInterest: 'Perhotelan',
  primaryProblem: 'cost', targetTimeline: 'within_6_months', sourceDetail: 'Komunitas alumni', consent: true,
};

test('registration CRM and checkout transactions on isolated PostgreSQL', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname)); assert.match(url.pathname, /test/);
  assert.ok(!url.searchParams.has('host'));
  const { default: pg } = await import('pg');
  const { default: express } = await import('express');
  const schema = 'registration_crm_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href }); await control.connect();
  let server, pool;
  t.after(async () => {
    await control.query('SELECT pg_advisory_unlock_all()');
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await pool?.end(); await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await control.end();
  });
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  url.searchParams.set('application_name', schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'registration-crm-test-access'; process.env.JWT_REFRESH_SECRET = 'registration-crm-test-refresh';
  process.env.COMPANY_WORKSPACE_ENABLED = 'true'; process.env.MARKETING_CRM_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = ''; process.env.TELEGRAM_ADMIN_CHAT_ID = '';
  process.env.ANTHROPIC_API_KEY = ''; process.env.ELEVENLABS_API_KEY = '';
  await control.query(`CREATE TABLE users(id UUID PRIMARY KEY,email TEXT UNIQUE,full_name TEXT);
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT UNIQUE,title TEXT,is_published BOOLEAN DEFAULT true,is_available BOOLEAN DEFAULT true,price_idr INTEGER);
    CREATE TABLE user_enrollments(id UUID DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id),course_id UUID REFERENCES courses(id),PRIMARY KEY(user_id,course_id));
    CREATE TABLE admin_emails(email TEXT);
    CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT);
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;`);
  const migrate = async (directory, file) => control.query(await readFile(new URL(`../${directory}/${file}`, import.meta.url), 'utf8'));
  for (const file of ['120_course_entitlements.sql', '121_course_orders.sql', '138_user_marketing_profile.sql', '200_registration_strategy.sql']) await migrate('migrations', file);
  // Normal migrations must also work before optional CRM has been installed.
  await migrate('migrations', '201_registration_crm_sources.sql');
  for (const file of ['001_marketing_crm.sql', '002_marketing_strategy.sql']) await migrate('crm-migrations', file);
  // Existing installations receive new source choices through normal deploy.
  await migrate('migrations', '201_registration_crm_sources.sql');
  await migrate('crm-migrations', '003_registration_sources.sql');
  await control.query(`CREATE TABLE test_failures(table_name TEXT PRIMARY KEY);
    CREATE FUNCTION fail_registration_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM test_failures WHERE table_name=TG_TABLE_NAME) THEN RAISE EXCEPTION 'forced registration test failure'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER fail_lead_event BEFORE INSERT ON marketing_lead_events FOR EACH ROW EXECUTE FUNCTION fail_registration_write();
    CREATE TRIGGER fail_order BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION fail_registration_write();
    CREATE TRIGGER fail_enrollment BEFORE INSERT ON user_enrollments FOR EACH ROW EXECUTE FUNCTION fail_registration_write();
    CREATE TABLE test_pause(email TEXT PRIMARY KEY);
    CREATE FUNCTION pause_registration_lead() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM test_pause WHERE email=NEW.email) THEN PERFORM pg_advisory_xact_lock(hashtext('${schema}')); END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER pause_lead BEFORE INSERT ON marketing_leads FOR EACH ROW EXECUTE FUNCTION pause_registration_lead();`);
  const courses = Object.fromEntries(['paid', 'paid2', 'free', 'free2'].map(key => [key, { id: randomUUID(), slug: 'fixture-' + key }]));
  for (const [key, course] of Object.entries(courses)) await control.query('INSERT INTO courses(id,slug,title,price_idr,is_free) VALUES($1,$2,$2,250000,$3)', [course.id, course.slug, key.startsWith('free')]);
  const { db, withTransaction } = await import('./db.js'); pool = db;
  const { signAccessToken } = await import('./auth.js');
  const { deleteMarketingProfile } = await import('./user-erasure.js');
  const { default: profile } = await import('./routes/profile.js');
  const { default: orders } = await import('./routes/orders.js');
  const { default: progress } = await import('./routes/progress.js');
  const app = express(); app.use(express.json()); app.use('/api', profile); app.use('/api', orders); app.use('/api', progress);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  let sequence = 0;
  async function user(label) {
    const id = randomUUID(), email = label + '-' + (++sequence) + '@example.invalid';
    await control.query('INSERT INTO users VALUES($1,$2,$3)', [id, email, 'Siswa ' + label]);
    return { id, email, token: await signAccessToken(id, email), phone: '+8190' + String(sequence).padStart(8, '0') };
  }
  async function request(person, path, body, method = 'POST') {
    const response = await fetch(origin + '/api' + path, { method, signal: AbortSignal.timeout(15000), headers: { Authorization: 'Bearer ' + person.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const save = (person, course = courses.paid, extra = {}) => request(person, '/profile/marketing', { ...answers, phone: person.phone, courseSlug: course.slug, ...extra }, 'PUT');
  const order = (person, course = courses.paid) => request(person, '/orders', { courseSlug: course.slug });
  const enroll = (person, course = courses.free) => request(person, '/enrollments', { courseSlug: course.slug });
  const leads = async person => (await control.query('SELECT * FROM marketing_leads WHERE email=$1 ORDER BY created_at,id', [person.email])).rows;
  const eventCount = async leadId => (await control.query('SELECT count(*)::int AS n FROM marketing_lead_events WHERE lead_id=$1', [leadId])).rows[0].n;
  async function waitForQueryLock(fragment, waitEvent) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const rows = (await control.query('SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND query LIKE $2 AND wait_event=$3', [schema, '%' + fragment + '%', waitEvent])).rows;
      if (rows.length) return;
      await delay(25);
    }
    assert.fail('Expected registration transaction to wait on ' + waitEvent + ': ' + fragment);
  }

  await t.test('new and legacy users cannot bypass mandatory registration through checkout endpoints', async () => {
    const person = await user('missing');
    for (const result of [await order(person), await enroll(person)]) { assert.equal(result.status, 428); assert.equal(result.data.error, 'registration_profile_required'); }
    await control.query("INSERT INTO user_marketing_profile(user_id,birth_date,province,city,phone,learning_goal,referral_source,consented_at) VALUES($1,'2000-01-01','Papua','Jayapura',$2,'jlpt','google',NOW())", [person.id, person.phone]);
    assert.equal((await order(person)).status, 428); assert.equal((await enroll(person)).status, 428);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM orders WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM user_enrollments WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await leads(person)).length, 0);
  });

  await t.test('concurrent form retries save one profile, lead and history event; next-course checkouts reuse v2 answers', async () => {
    const person = await user('concurrent');
    const results = await Promise.all(Array.from({ length: 6 }, () => save(person)));
    for (const result of results) assert.equal(result.status, 200, JSON.stringify(result.data));
    const [lead] = await leads(person); assert.ok(lead); assert.equal((await leads(person)).length, 1);
    assert.equal(await eventCount(lead.id), 1); assert.equal(lead.source, 'referral'); assert.equal(lead.referrer_name, answers.referrerName);
    assert.equal(lead.stage, 'new'); assert.equal(lead.offered_price, null); assert.equal(lead.background, answers.background);
    assert.match(lead.goal, /Kembali.*Jepang/); assert.equal(lead.target_timeline, 'Dalam 4–6 bulan');
    assert.equal((await control.query('SELECT strategy_version FROM user_marketing_profile WHERE user_id=$1', [person.id])).rows[0].strategy_version, 2);
    const paid = await Promise.all([order(person, courses.paid2), order(person, courses.paid2)]);
    assert.deepEqual(paid.map(result => result.status).sort(), [200, 201]); assert.equal(paid[0].data.order.id, paid[1].data.order.id);
    assert.equal((await leads(person)).filter(row => row.course_id === courses.paid2.id).length, 1);
    const free = await Promise.all([enroll(person), enroll(person)]);
    assert.ok(free.every(result => result.status === 200)); assert.deepEqual(free.map(result => result.data.alreadyEnrolled).sort(), [false, true]);
    assert.equal((await leads(person)).filter(row => row.course_id === courses.free.id).length, 1);
  });

  await t.test('registration preserves staff source, stage, price, attribution and prior notes', async () => {
    const person = await user('staff-contact'), staff = await user('staff');
    const lead = (await control.query(`INSERT INTO marketing_leads(course_id,full_name,phone,email,source,source_detail,goal,stage,offered_price,created_by,assigned_to,referrer_name)
      VALUES($1,'Nama dari staf',$2,$3,'instagram','Iklan sebelumnya','Tujuan hasil wawancara','offered',123000,$4,$4,'Referrer lama') RETURNING *`, [courses.paid.id, person.phone, person.email, staff.id])).rows[0];
    await control.query("INSERT INTO marketing_lead_events(lead_id,actor_user_id,event_key,stage,note,lead_version) VALUES($1,$2,'created','offered','Catatan staf tetap',1)", [lead.id, staff.id]);
    assert.equal((await save(person)).status, 200);
    const [updated] = await leads(person);
    for (const field of ['source', 'source_detail', 'stage', 'offered_price', 'created_by', 'assigned_to', 'goal', 'referrer_name', 'full_name']) assert.equal(updated[field], lead[field], field);
    assert.equal(updated.category_interest, answers.categoryInterest); assert.equal(updated.background, answers.background);
    assert.equal((await control.query('SELECT note FROM marketing_lead_events WHERE lead_id=$1 AND lead_version=1', [lead.id])).rows[0].note, 'Catatan staf tetap');
    assert.equal(await eventCount(lead.id), 2); assert.equal((await save(person)).status, 200); assert.equal(await eventCount(lead.id), 2);
  });

  await t.test('shared phone numbers never merge people with different verified account emails', async () => {
    const first = await user('shared-a'), second = await user('shared-b'); second.phone = first.phone;
    assert.equal((await save(first)).status, 200); assert.equal((await save(second)).status, 200);
    const [a] = await leads(first), [b] = await leads(second);
    assert.notEqual(a.id, b.id); assert.equal(a.phone, first.phone); assert.equal(b.phone, ''); assert.equal(b.email, second.email);
    assert.equal((await control.query('SELECT phone FROM user_marketing_profile WHERE user_id=$1', [second.id])).rows[0].phone, first.phone);
  });

  await t.test('new source choices persist in leads and spending without accepting unknown choices', async () => {
    for (const source of ['facebook', 'youtube', 'google']) {
      const person = await user(source);
      assert.equal((await save(person, courses.paid, { referralSource: source, referrerName: '' })).status, 200);
      assert.equal((await leads(person))[0].source, source);
      await control.query("INSERT INTO marketing_channel_spend(week_start,source,amount_idr) VALUES('2026-09-28',$1,10000)", [source]);
    }
    await assert.rejects(control.query("INSERT INTO marketing_channel_spend(week_start,source,amount_idr) VALUES('2026-09-28','unrecognized',1)"), { code: '23514' });
  });

  await t.test('consent withdrawal deletes copied CRM records and history with feature flags disabled', async () => {
    const person = await user('withdrawal'); assert.equal((await save(person)).status, 200); assert.equal((await order(person)).status, 201);
    const [lead] = await leads(person); assert.equal(await eventCount(lead.id), 1);
    process.env.COMPANY_WORKSPACE_ENABLED = 'false'; process.env.MARKETING_CRM_ENABLED = 'false';
    try { assert.deepEqual(await withTransaction(client => deleteMarketingProfile(client, person.id)), { deleted: true }); }
    finally { process.env.COMPANY_WORKSPACE_ENABLED = 'true'; process.env.MARKETING_CRM_ENABLED = 'true'; }
    assert.equal((await leads(person)).length, 0); assert.equal(await eventCount(lead.id), 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM user_marketing_profile WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM orders WHERE user_id=$1', [person.id])).rows[0].n, 1);
    assert.equal((await order(person, courses.paid2)).status, 428);
  });

  await t.test('failed audit/order/enrollment writes roll back profile and lead changes atomically', async () => {
    const person = await user('rollback');
    await control.query("INSERT INTO test_failures VALUES('marketing_lead_events')");
    try { assert.equal((await save(person)).status, 500); }
    finally { await control.query('DELETE FROM test_failures'); }
    assert.equal((await leads(person)).length, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM user_marketing_profile WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await save(person, courses.free)).status, 200);
    await control.query("INSERT INTO test_failures VALUES('marketing_lead_events')");
    try { assert.equal((await save(person, courses.paid, { city: 'Bandung' })).status, 500); }
    finally { await control.query('DELETE FROM test_failures'); }
    assert.equal((await control.query('SELECT city FROM user_marketing_profile WHERE user_id=$1', [person.id])).rows[0].city, 'Jayapura');
    await control.query("INSERT INTO test_failures VALUES('orders')");
    try { assert.equal((await order(person, courses.paid2)).status, 500); }
    finally { await control.query('DELETE FROM test_failures'); }
    assert.equal((await leads(person)).filter(row => row.course_id === courses.paid2.id).length, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM orders WHERE user_id=$1', [person.id])).rows[0].n, 0);
    await control.query("INSERT INTO test_failures VALUES('user_enrollments')");
    try { assert.equal((await enroll(person, courses.free2)).status, 500); }
    finally { await control.query('DELETE FROM test_failures'); }
    assert.equal((await leads(person)).filter(row => row.course_id === courses.free2.id).length, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM user_enrollments WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await order(person, courses.paid2)).status, 201); assert.equal((await enroll(person, courses.free2)).status, 200);
  });

  await t.test('concurrent consent withdrawal waits for the user save and removes all committed copies', async () => {
    const person = await user('withdraw-race');
    await control.query('INSERT INTO test_pause VALUES($1)', [person.email]);
    await control.query('SELECT pg_advisory_lock(hashtext($1))', [schema]);
    const saving = save(person);
    let withdrawing;
    try {
      await waitForQueryLock('INSERT INTO marketing_leads', 'advisory');
      withdrawing = withTransaction(client => deleteMarketingProfile(client, person.id));
      await waitForQueryLock('SELECT id FROM users', 'transactionid');
    } finally { await control.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); }
    assert.equal((await saving).status, 200);
    assert.deepEqual(await withdrawing, { deleted: true });
    assert.equal((await leads(person)).length, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM user_marketing_profile WHERE user_id=$1', [person.id])).rows[0].n, 0);
    assert.equal((await control.query('SELECT count(*)::int AS n FROM marketing_lead_events WHERE actor_user_id=$1', [person.id])).rows[0].n, 0);
  });
});
