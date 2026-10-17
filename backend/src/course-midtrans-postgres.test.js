import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('Self Learning Midtrans checkout and verified activation on PostgreSQL', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname)); assert.ok(!url.searchParams.has('host'));
  const control = new pg.Client({ connectionString: url.href }); await control.connect();
  const schema = 'course_midtrans_' + randomUUID().replaceAll('-', '');
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=15000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'course-midtrans-local-test';
  process.env.ADMIN_EMAILS = '';
  process.env.COURSE_MIDTRANS_SERVER_KEY = 'new-course-test-key';
  process.env.MIDTRANS_SERVER_KEY = 'old-kanji-test-key';
  process.env.COURSE_MIDTRANS_BASE = 'https://app.sandbox.midtrans.com';
  process.env.COURSE_APP_URL = 'https://eznihongo.com';
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text,full_name text);
    CREATE TABLE courses(id uuid PRIMARY KEY,slug text);
    CREATE TABLE user_enrollments(user_id uuid,course_id uuid,enrolled_at timestamptz DEFAULT NOW(),PRIMARY KEY(user_id,course_id));`);
  for (const name of ['120_course_entitlements.sql','121_course_orders.sql','214_enrollment_modes.sql','215_course_midtrans.sql']) await control.query(await readFile(new URL('../migrations/'+name, import.meta.url), 'utf8'));
  const student = randomUUID(), stranger = randomUUID(), course = randomUUID();
  await control.query('INSERT INTO users VALUES ($1,$2,$3),($4,$5,$6)', [student,'student@example.invalid','Siswa',stranger,'other@example.invalid','Lain']);
  await control.query("INSERT INTO courses VALUES ($1,'n5')", [course]);
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { default: payments } = await import('./routes/course-payments.js');
  const originalFetch = globalThis.fetch;
  let gatewayStatus, requestBody, creates = 0, providerDown = false;
  mock.method(globalThis, 'fetch', async (input, options) => {
    const address = String(input);
    if (!address.startsWith('https://app.sandbox.midtrans.com/') && !address.startsWith('https://api.sandbox.midtrans.com/')) return originalFetch(input, options);
    if (providerDown) throw Error('provider offline');
    assert.equal(options.headers.Authorization, 'Basic '+Buffer.from('new-course-test-key:').toString('base64'));
    if (address.includes('/snap/v1/transactions')) {
      creates++; requestBody = JSON.parse(options.body);
      assert.equal(options.headers['X-Override-Notification'],'https://eznihongo.com/api/course-payments/webhook');
      return new Response(JSON.stringify({ redirect_url:'https://app.sandbox.midtrans.com/snap/v4/redirection/test-token' }));
    }
    return new Response(JSON.stringify(gatewayStatus), { status: gatewayStatus ? 200 : 404 });
  });
  const app=express();app.use(express.json());app.use('/api/course-payments',payments);
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));mock.restoreAll();await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  const token=await signAccessToken(student,'student@example.invalid'), otherToken=await signAccessToken(stranger,'other@example.invalid');
  const base='http://127.0.0.1:'+server.address().port+'/api/course-payments';
  async function request(path,body={},auth=token){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
  async function fixture(provider='midtrans'){
    await control.query('DELETE FROM user_enrollments');
    const id=randomUUID(), number='EZN-'+randomUUID();
    await control.query(`INSERT INTO orders(id,order_number,user_id,course_id,course_title_snapshot,amount_idr,payment_provider,learning_mode,expires_at)
      VALUES($1,$2,$3,$4,'N5 Self Learning',249000,$5,'self_learning',NOW()+INTERVAL '3 days')`,[id,number,student,course,provider]);
    gatewayStatus={order_id:number,gross_amount:'249000.00',transaction_id:randomUUID(),transaction_status:'pending',currency:'IDR'};
    return {id,number};
  }
  function signed(number,key='new-course-test-key'){
    const body={order_id:number,status_code:'200',gross_amount:'249000.00',transaction_status:'settlement'};
    body.signature_key=createHash('sha512').update(number+'200'+'249000.00'+key).digest('hex');return body;
  }
  const enrollment=async()=> (await control.query('SELECT * FROM user_enrollments')).rows[0];
  await t.test('checkout is owner-only, uses snapshot pricing and reuses its saved URL',async()=>{
    const o=await fixture();
    assert.equal((await request(`/orders/${o.id}/checkout`,{},otherToken)).status,403);
    assert.equal((await request(`/orders/${o.id}/checkout`,{},null)).status,401);
    const responses=await Promise.all([request(`/orders/${o.id}/checkout`,{amountIdr:1}),request(`/orders/${o.id}/checkout`)]);
    assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));assert.equal(creates,1);
    assert.equal(requestBody.transaction_details.gross_amount,249000);assert.equal(await enrollment(),undefined);
    assert.match(requestBody.callbacks.finish,/courses\/order.html\?id=/);
  });
  await t.test('notifications require the new key and server GET Status; pending/challenge never activate',async()=>{
    const o=await fixture();
    assert.equal((await request('/webhook',signed(o.number,'old-kanji-test-key'),null)).status,403);
    // Signed payload claims settlement, but the provider still says pending.
    assert.equal((await request('/webhook',signed(o.number),null)).status,200);assert.equal(await enrollment(),undefined);
    gatewayStatus.transaction_status='capture';gatewayStatus.fraud_status='challenge';
    assert.equal((await request('/webhook',signed(o.number),null)).status,200);assert.equal(await enrollment(),undefined);
    gatewayStatus.gross_amount='1.00';
    assert.equal((await request('/webhook',signed(o.number),null)).status,502);assert.equal(await enrollment(),undefined);
  });
  await t.test('late settlement activates one year exactly once, and stale/repeated events cannot extend or revoke it',async()=>{
    const o=await fixture();gatewayStatus.transaction_status='settlement';
    await control.query("UPDATE orders SET expires_at=NOW()-INTERVAL '1 hour' WHERE id=$1",[o.id]);
    assert.equal((await request('/webhook',signed(o.number),null)).status,200);
    const first=await enrollment();assert.equal(first.learning_mode,'self_learning');
    const term=(await control.query("SELECT ABS(EXTRACT(EPOCH FROM(e.expires_at-(o.approved_at+INTERVAL '1 year')))) AS delta FROM user_enrollments e JOIN orders o ON o.id=e.order_id WHERE o.id=$1",[o.id])).rows[0];
    assert.ok(Number(term.delta)<1);
    await request('/webhook',signed(o.number),null);
    gatewayStatus.transaction_status='pending';await request('/webhook',signed(o.number),null);
    assert.deepEqual(await enrollment(),first);
    assert.equal((await control.query("SELECT count(*)::int AS n FROM order_payments WHERE order_id=$1 AND provider='midtrans'",[o.id])).rows[0].n,1);
  });
  await t.test('provider downtime grants nothing and status can be retried by the owner',async()=>{
    const o=await fixture();providerDown=true;
    assert.equal((await request(`/orders/${o.id}/sync`)).status,502);assert.equal(await enrollment(),undefined);
    providerDown=false;gatewayStatus.transaction_status='settlement';
    assert.equal((await request(`/orders/${o.id}/sync`)).status,200);assert.ok(await enrollment());
  });
  await t.test('an active Bootcamp grant is not downgraded by a delayed Self Learning payment',async()=>{
    const o=await fixture();await control.query("INSERT INTO user_enrollments(user_id,course_id,learning_mode,status,source) VALUES($1,$2,'bootcamp','active','admin_grant')",[student,course]);
    gatewayStatus.transaction_status='settlement';await request('/webhook',signed(o.number),null);
    assert.equal((await enrollment()).learning_mode,'bootcamp');assert.equal((await enrollment()).expires_at,null);
  });
  await t.test('full refunds revoke only access from that order and paid replays cannot resurrect it',async()=>{
    const o=await fixture();gatewayStatus.transaction_status='settlement';await request('/webhook',signed(o.number),null);
    gatewayStatus.transaction_status='refund';await request('/webhook',signed(o.number),null);assert.equal((await enrollment()).status,'revoked');
    gatewayStatus.transaction_status='settlement';await request('/webhook',signed(o.number),null);assert.equal((await enrollment()).status,'revoked');
  });
});
