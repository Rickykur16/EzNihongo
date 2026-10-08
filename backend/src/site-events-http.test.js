import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';

test('site visit beacon and admin report through real HTTP and PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL, timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  assert.ok(!url.searchParams.has('host'));
  const { default: pg } = await import('pg');
  const { default: express } = await import('express');
  const schema = 'site_events_http_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  let server, pool;
  t.after(async () => {
    try {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    } finally {
      try { await pool?.end(); }
      finally {
        try { await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
        finally { await control.end(); }
      }
    }
  });
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'site-events-http-access';
  process.env.JWT_REFRESH_SECRET = 'site-events-http-refresh';
  process.env.ADMIN_EMAILS = 'owner@example.invalid';
  process.env.COMPANY_WORKSPACE_ENABLED = 'true';
  process.env.COMPANY_STAFF_ENABLED = 'true';
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID', 'ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'OPENAI_API_KEY']) process.env[key] = '';

  await control.query(`
    CREATE TABLE users(id UUID PRIMARY KEY,email TEXT UNIQUE,full_name TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE admin_emails(email TEXT PRIMARY KEY);
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT UNIQUE,title TEXT,description TEXT,level TEXT,thumbnail_url TEXT,
      is_published BOOLEAN DEFAULT TRUE,is_available BOOLEAN DEFAULT TRUE,sort_order INTEGER DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID REFERENCES courses(id));
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID REFERENCES modules(id));
    CREATE TABLE user_enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id),
      course_id UUID REFERENCES courses(id),enrolled_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(user_id,course_id));
  `);
  for (const file of ['120_course_entitlements.sql', '121_course_orders.sql', '204_site_events.sql', '204_site_events.sql']) {
    await control.query(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  await control.query(await readFile(new URL('../contracts/staff-schema-v1.sql', import.meta.url), 'utf8'));
  const ids = { owner: randomUUID(), student: randomUUID(), erased: randomUUID() };
  await control.query('INSERT INTO users(id,email,full_name) VALUES($1,$2,$3),($4,$5,$6),($7,$8,$9)', [
    ids.owner, 'owner@example.invalid', 'Owner', ids.student, 'student@example.invalid', 'Student',
    ids.erased, `dihapus-${ids.erased}@dihapus.invalid`, '']);

  const { db } = await import('./db.js'); pool = db;
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const { default: siteEvents } = await import('./routes/site-events.js');
  const tokens = { owner: await signAccessToken(ids.owner, 'owner@example.invalid'), student: await signAccessToken(ids.student, 'student@example.invalid') };
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json()); app.use('/api/site-events', siteEvents); app.use('/api/admin', admin);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}/api`;
  const beacon = (body, { ua = PHONE, ip = '203.0.113.7', headers = {} } = {}) => fetch(origin + '/site-events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua, 'X-Forwarded-For': ip, ...headers },
    body: JSON.stringify(body),
  });
  const report = async (who, days = 7) => {
    const res = await fetch(origin + '/admin/site-analytics?days=' + days, { headers: who ? { Authorization: 'Bearer ' + tokens[who] } : {} });
    return { status: res.status, data: await res.json() };
  };
  const rows = async () => (await control.query(`SELECT * FROM ${schema}.site_events ORDER BY id`)).rows;

  await t.test('valid events are stored as counts only; invalid, bot and opted-out requests store nothing', async () => {
    const pv = await beacon({ kind: 'pageview', path: '/', referrer: 'https://www.google.co.id/search?q=a', utm: { source: 'IG', campaign: 'ssw-okt' } });
    assert.equal(pv.status, 204);
    const stored = await rows();
    assert.equal(stored.length, 1);
    const { id, occurred_at, visitor, ...rest } = stored[0];
    assert.deepEqual(rest, { kind: 'pageview', page: 'home', detail: '', referrer: 'google.co.id', utm_source: 'ig',
      utm_medium: '', utm_campaign: 'ssw-okt', device: 'mobile' });
    assert.match(visitor, /^[0-9a-f]{16}$/);
    assert.ok(!JSON.stringify(stored[0]).includes('203.0.113.7'));
    for (const body of [{ kind: 'pageview', path: '/dashboard.html' }, { kind: 'pageview', path: '/?x=1' }, { kind: 'scroll', path: '/' }]) {
      assert.equal((await beacon(body)).status, 400);
    }
    assert.equal((await beacon({ kind: 'pageview', path: '/' }, { ua: 'Googlebot/2.1' })).status, 204);
    assert.equal((await beacon({ kind: 'pageview', path: '/' }, { headers: { 'Sec-GPC': '1' } })).status, 204);
    assert.equal((await beacon({ kind: 'pageview', path: '/' }, { headers: { DNT: '1' } })).status, 204);
    assert.equal((await rows()).length, 1);
  });

  await t.test('report counts unique visitors per day, the WhatsApp funnel, sources and pages', async () => {
    // Same phone visitor again + a desktop visitor who opens the consult dialog and clicks WA.
    await beacon({ kind: 'pageview', path: '/index.html' });
    await beacon({ kind: 'pageview', path: '/', referrer: 'https://l.instagram.com/' }, { ua: DESKTOP, ip: '198.51.100.2' });
    await beacon({ kind: 'consult_open', path: '/', detail: 'ssw' }, { ua: DESKTOP, ip: '198.51.100.2' });
    await beacon({ kind: 'wa_click', path: '/', detail: 'ssw' }, { ua: DESKTOP, ip: '198.51.100.2' });
    await beacon({ kind: 'wa_click', path: '/', detail: 'ssw' }, { ua: DESKTOP, ip: '198.51.100.2' });
    await beacon({ kind: 'pageview', path: '/courses/detail.html', detail: 'n5-bootcamp' }, { ua: DESKTOP, ip: '198.51.100.2' });
    // Old row outside every range.
    await control.query(`INSERT INTO ${schema}.site_events(occurred_at,kind,page,device,visitor) VALUES(NOW()-INTERVAL '120 days','pageview','home','desktop','00000000000000ff')`);
    const before = await rows();
    const { status, data } = await report('owner');
    assert.equal(status, 200);
    assert.deepEqual(await rows(), before, 'report is read-only');
    assert.equal(data.daily.length, 7);
    assert.deepEqual(data.totals, { pageviews: 4, visitors: 2, waClicks: 2, signups: 2, paidOrders: 0 });
    assert.deepEqual(data.funnel, { homeVisitors: 2, consultVisitors: 1, waVisitors: 1 });
    assert.deepEqual(data.daily.at(-1), { date: data.daily.at(-1).date, pageviews: 4, visitors: 2, waClicks: 2 });
    assert.equal(data.daily.slice(0, -1).reduce((s, d) => s + d.pageviews, 0), 0);
    assert.deepEqual(data.pages, [{ page: 'home', pageviews: 3 }, { page: 'course', pageviews: 1 }]);
    assert.deepEqual(data.sources.map(s => [s.source, s.pageviews]).sort(), [['instagram', 1], ['langsung', 2], ['ig', 1]].sort());
    assert.deepEqual(data.consultPaths, [{ path: 'ssw', opens: 1, waClicks: 2 }]);
    assert.deepEqual(data.courses, [{ slug: 'n5-bootcamp', pageviews: 1 }]);
    assert.deepEqual(data.campaigns, [{ campaign: 'ssw-okt', pageviews: 1 }]);
    assert.deepEqual(data.devices.map(d => d.device).sort(), ['desktop', 'mobile']);
    assert.equal((await report('owner', 90)).data.totals.pageviews, 4);
  });

  await t.test('report is staff-only and validates the range', async () => {
    assert.equal((await report(null)).status, 401);
    assert.equal((await report('student')).status, 403);
    assert.equal((await report('owner', 365)).status, 400);
  });
});
