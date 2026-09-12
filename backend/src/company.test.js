import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import pg from 'pg';
import { LEGACY_ROUTES,permissionForLegacyRoute } from './company-route-policy.js';
import { applyCompanyMigrations } from '../company-migrations/run.js';

test('every current admin route has a deliberate policy; new routes default to owner-only',async()=>{
  const src=await readFile(new URL('./routes/admin.js',import.meta.url),'utf8');
  const actual=[...src.matchAll(/^router\.(get|post|put|delete|patch)\('([^']+)'/gm)].map(m=>[m[1].toUpperCase(),m[2]]);
  assert.deepEqual(LEGACY_ROUTES.map(r=>r.slice(0,2)),actual);
  assert.equal(permissionForLegacyRoute('GET','/future-route'),null);
  for(const [method,path]of actual)if(method==='DELETE'||path.includes('/admins')||path.includes('/erase'))assert.equal(permissionForLegacyRoute(method,path),null);
});

test('company workflows and RBAC on disposable PostgreSQL', {skip:!process.env.TEST_DATABASE_URL,timeout:90000},async t=>{
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
  const schema='company_test_'+randomUUID().replaceAll('-','');const control=new pg.Client({connectionString:url.href});await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options',`-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='company-local-access';process.env.JWT_REFRESH_SECRET='company-local-refresh';
  process.env.ADMIN_EMAILS='owner@example.invalid';process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';
  process.env.TELEGRAM_BOT_TOKEN='';process.env.ANTHROPIC_API_KEY='';process.env.ELEVENLABS_API_KEY='';
  const {db}=await import('./db.js');const {signAccessToken,signRefreshToken}=await import('./auth.js');const {signKanjiAccessToken}=await import('./kanji-auth.js');
  const {default:company}=await import('./routes/company.js');const {default:admin}=await import('./routes/admin.js');const {default:staff}=await import('./routes/staff.js');
  const {default:ordersRouter}=await import('./routes/orders.js');
  const {companyError}=await import('./company-policy.js');const {eraseUserAccount}=await import('./user-erasure.js');
  const {processCompanyJob,claimCompanyJob}=await import('./company-outbox.js');
  let server;
  t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text UNIQUE,full_name text,google_id text,google_name text,avatar_url text,updated_at timestamptz);
    CREATE TABLE admin_emails(email text);CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text,sort_order integer DEFAULT 0,created_at timestamptz DEFAULT NOW());
    CREATE TABLE modules(id uuid PRIMARY KEY,course_id uuid REFERENCES courses(id));CREATE TABLE lessons(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),title text,type text,video_source_id uuid,video_start_seconds integer,video_end_seconds integer);
    CREATE TABLE discussions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),parent_id uuid REFERENCES discussions(id),content text,is_deleted boolean DEFAULT FALSE,created_at timestamptz DEFAULT NOW(),updated_at timestamptz);
    CREATE TABLE user_enrollments(user_id uuid REFERENCES users(id),course_id uuid REFERENCES courses(id),PRIMARY KEY(user_id,course_id));`);
  for(const file of ['120_course_entitlements.sql','121_course_orders.sql'])await control.query(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  for(const name of ['sessions','user_marketing_profile','user_progress','user_learning_state','user_stats','user_practice_state','user_practice_legacy_imports','practice_attempts','quiz_question_results','quiz_attempts','grammar_attempts','smart_review_sessions'])await control.query(`CREATE TABLE ${name}(user_id uuid REFERENCES users(id))`);
  const ids=Object.fromEntries(['owner','technology','academic','marketing','operations','finance','student','scoped','erased'].map(k=>[k,randomUUID()]));
  for(const [key,id]of Object.entries(ids))await control.query('INSERT INTO users(id,email,full_name,google_id) VALUES ($1,$2,$3,$3)',[id,key+'@example.invalid',key]);
  const c1=randomUUID(),c2=randomUUID();await control.query("INSERT INTO courses(id,title,slug) VALUES ($1,'N5','n5'),($2,'N4','n4')",[c1,c2]);
  const before=(await control.query('SELECT * FROM users ORDER BY id')).rows;
  await t.test('additive migration is atomic, idempotent and leaves existing rows unchanged',async()=>{
    assert.equal((await applyCompanyMigrations(control)).length,2);assert.deepEqual(await applyCompanyMigrations(control),[]);
    assert.deepEqual((await control.query('SELECT * FROM users ORDER BY id')).rows,before);
    assert.equal((await control.query('SELECT count(*) FROM staff_memberships')).rows[0].count,'0');
  });
  const app=express();app.use(express.json());app.use('/api/company',company);app.use('/api/admin',admin);app.use('/api/staff',staff);app.use('/api',ordersRouter);app.use(companyError);
  app.use((e,req,res,next)=>res.status(e.code==='23505'?409:500).json({error:e.message}));
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api`;
  async function request(who,path,body,method=body?'POST':'GET',jwt=null){
    const token=jwt||await signAccessToken(ids[who],who+'@example.invalid');
    const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:res.status,data:res.headers.get('content-type')?.includes('application/json')?await res.json():Buffer.from(await res.arrayBuffer())};
  }
  const grant=(who,role,scopes=[{type:'global'}])=>request('owner','/company/members',{userId:ids[who],role,scopes});
  const make=(who,division,kind='task',extra={})=>request(who,'/company/work',{division,kind,title:'Fixture '+kind,description:'Acceptance criterion',...extra});
  const patch=(who,item,data)=>request(who,'/company/work/'+item.id,{version:item.version,...data},'PATCH');
  await t.test('five roles can be granted without altering admin allowlist',async()=>{
    for(const role of ['technology','academic','marketing','operations','finance'])assert.equal((await grant(role,role)).status,201);
    assert.equal((await control.query('SELECT count(*) FROM admin_emails')).rows[0].count,'0');
    assert.equal((await grant('owner','finance')).status,400);
  });
  await t.test('role matrix denies cross-division work and owner functions',async()=>{
    const roles=['technology','academic','marketing','operations','finance'];
    for(const who of roles){for(const division of roles)assert.equal((await make(who,division)).status,who===division?201:403);
      assert.equal((await request(who,'/company/members')).status,403);
      assert.equal((await request(who,'/admin/admins')).status,403);
      assert.equal((await request(who,'/admin/settings/bank-accounts',{accounts:[]},'PUT')).status,403);
    }
    assert.equal((await request('finance','/admin/orders')).status,200);
    assert.equal((await request('marketing','/admin/orders')).status,403);
    assert.equal((await request('academic','/admin/courses')).status,200);
  });
  await t.test('students, Kanji, refresh and stale identities cannot enter company APIs',async()=>{
    assert.equal((await request('student','/company/access')).status,403);
    assert.equal((await request('finance','/company/access',null,'GET',await signRefreshToken(ids.finance,randomUUID()))).status,401);
    assert.equal((await request('finance','/company/access',null,'GET',await signKanjiAccessToken(ids.finance,'finance@example.invalid'))).status,401);
    assert.equal((await request('finance','/company/access',null,'GET',await signAccessToken(ids.finance,'wrong@example.invalid'))).status,401);
  });
  await t.test('scope narrowing never falls back to global legacy access',async()=>{
    assert.equal((await grant('scoped','academic',[{type:'course',courseId:c1}])).status,201);
    assert.equal((await make('scoped','academic','task',{courseId:c1})).status,201);
    assert.equal((await make('scoped','academic','task',{courseId:c2})).status,403);
    assert.equal((await make('scoped','academic')).status,403);
    assert.equal((await request('scoped','/admin/courses')).status,403);
    const list=await request('scoped','/company/work?division=academic');assert.ok(list.data.items.every(i=>i.course_id===c1));
  });
  await t.test('limited staff cannot replace content or change lesson type',async()=>{
    const lesson=randomUUID();await control.query("INSERT INTO lessons(id,type) VALUES ($1,'quiz')",[lesson]);
    assert.equal((await request('academic','/admin/lessons/'+lesson,{type:'video'},'PUT')).status,403);
    assert.equal((await control.query('SELECT type FROM lessons WHERE id=$1',[lesson])).rows[0].type,'quiz');
    assert.equal((await request('academic','/admin/module-vocabulary/bulk',{replace:true})).status,403);
  });
  await t.test('case sync deduplicates actionable orders without mutating payment data',async()=>{
    const order=randomUUID();await control.query(`INSERT INTO orders(id,order_number,user_id,course_id,course_title_snapshot,amount_idr,status,expires_at)
      VALUES ($1,'CASE-TEST',$2,$3,'N5',100000,'awaiting_review',NOW()+INTERVAL '1 day')`,[order,ids.student,c1]);
    const payment=(await control.query("INSERT INTO order_payments(order_id,submitted_by,proof_image,proof_mime) VALUES ($1,$2,$3,'image/png') RETURNING id",[order,ids.student,Buffer.from('fixture-proof')])).rows[0].id;
    const before=(await control.query('SELECT * FROM orders WHERE id=$1',[order])).rows;
    assert.equal((await request('finance','/company/cases/sync',{division:'finance'})).data.created,1);
    assert.equal((await request('finance','/company/cases/sync',{division:'finance'})).data.created,0);
    assert.deepEqual((await control.query('SELECT * FROM orders WHERE id=$1',[order])).rows,before);
    const list=await request('finance','/company/work?division=finance');assert.equal(list.data.items.find(i=>i.source_order_id===order).source_payment_status,'awaiting_review');
    const proofPath='/orders/'+order+'/payments/'+payment+'/proof';
    assert.equal((await request('finance',proofPath)).status,200);
    assert.equal((await request('student',proofPath)).status,200);
    assert.equal((await request('marketing',proofPath)).status,403);
    assert.equal((await request('finance','/admin/orders/'+order+'/approve',{paymentId:randomUUID()})).status,409);
    assert.equal((await control.query('SELECT status FROM orders WHERE id=$1',[order])).rows[0].status,'awaiting_review');
    assert.equal((await request('finance','/admin/orders/'+order+'/approve',{paymentId:payment})).status,200);
    assert.equal((await control.query('SELECT status FROM user_enrollments WHERE user_id=$1 AND course_id=$2',[ids.student,c1])).rows[0].status,'active');
  });
  let content;
  await t.test('content approval, scheduling and editing use revision checks and one outbox row',async()=>{
    content=(await make('marketing','marketing','content',{scheduledAt:new Date(Date.now()+3600000).toISOString()})).data.item;
    assert.equal((await patch('marketing',content,{status:'published'})).status,409);
    for(const status of ['review','approved','scheduled']){const r=await patch('marketing',content,{status});assert.equal(r.status,200);content=r.data.item;}
    assert.equal((await control.query("SELECT count(*) FROM company_outbox WHERE state='pending'")).rows[0].count,'1');
    const stale=content;content=(await patch('marketing',content,{description:'Revised copy'})).data.item;assert.equal(content.status,'draft');
    assert.equal((await patch('marketing',stale,{title:'Stale overwrite'})).status,409);
    assert.equal((await control.query("SELECT count(*) FROM company_outbox WHERE state='pending'")).rows[0].count,'0');
  });
  await t.test('release evidence is mandatory and HTTPS links reject script URLs',async()=>{
    let item=(await make('technology','technology','release')).data.item;
    for(const status of ['ready','testing'])item=(await patch('technology',item,{status})).data.item;
    assert.equal((await patch('technology',item,{status:'merged'})).status,400);
    assert.equal((await patch('technology',item,{linkUrl:'javascript:alert(1)'})).status,400);
    item=(await patch('technology',item,{releaseSha:'a'.repeat(40),linkUrl:'https://github.com/Rickykur16/EzNihongo/pull/1'})).data.item;
    for(const status of ['merged','deployed','verified']){const r=await patch('technology',item,{status});assert.equal(r.status,200);item=r.data.item;}
  });
  await t.test('campaign links are validated without claiming measured revenue',async()=>{
    const item=(await make('marketing','marketing','campaign',{linkUrl:'https://eznihongo.com/courses/n5.html'})).data.item;
    const link=await request('marketing','/company/work/'+item.id+'/link',{source:'instagram',medium:'organic'});assert.equal(link.status,200);
    assert.equal(new URL(link.data.url).searchParams.get('utm_campaign'),item.id);
    assert.equal((await request('finance','/company/work/'+item.id+'/link',{source:'a',medium:'b'})).status,403);
  });
  await t.test('expired and revoked memberships are denied without a cache delay',async()=>{
    await control.query("UPDATE staff_memberships SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[ids.scoped]);assert.equal((await request('scoped','/company/access')).status,403);
    const m=(await control.query('SELECT id FROM staff_memberships WHERE user_id=$1',[ids.finance])).rows[0];
    assert.equal((await request('owner','/company/members/'+m.id+'/revoke',{})).status,200);
    assert.equal((await request('finance','/admin/orders')).status,403);await grant('finance','finance');
  });
  await t.test('disabled feature preserves legacy gates and exposes no company data',async()=>{
    process.env.COMPANY_STAFF_ENABLED='false';assert.equal((await request('finance','/company/access')).status,403);assert.equal((await request('owner','/company/access')).status,200);
    assert.equal((await request('finance','/admin/orders')).status,403);
    process.env.COMPANY_WORKSPACE_ENABLED='false';assert.equal((await request('owner','/company/access')).status,404);
    process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';
  });
  await t.test('worker retries failures, rejects stale revisions and never publishes content',async()=>{
    for(const status of ['review','approved','scheduled'])content=(await patch('marketing',content,{status})).data.item;
    await control.query("UPDATE company_outbox SET available_at=NOW()-INTERVAL '1 second' WHERE state='pending'");
    let sent=0;await processCompanyJob(control,async()=>{sent++;throw new Error('secret provider message');});assert.equal(sent,1);
    let j=(await control.query("SELECT * FROM company_outbox WHERE state='pending'")).rows[0];assert.equal(j.last_error,'delivery_failed');
    await control.query("UPDATE company_outbox SET available_at=NOW()-INTERVAL '1 second' WHERE id=$1",[j.id]);
    await processCompanyJob(control,async()=>{sent++;});assert.equal(sent,2);
    assert.equal((await control.query('SELECT status FROM company_work_items WHERE id=$1',[content.id])).rows[0].status,'scheduled');
    await control.query("INSERT INTO company_outbox(item_id,item_version,event_key,available_at) VALUES ($1,999,'work.scheduled',NOW())",[content.id]);
    await processCompanyJob(control,async()=>{throw new Error('Stale revision must not be sent');});
    assert.equal((await control.query('SELECT state FROM company_outbox WHERE item_id=$1 AND item_version=999',[content.id])).rows[0].state,'cancelled');
  });
  await t.test('company cleanup is in the same erasure transaction and preserves other work',async()=>{
    await grant('erased','marketing');const own=(await make('erased','marketing')).data.item;
    const other=(await make('marketing','marketing')).data.item;
    const before=(await control.query('SELECT * FROM company_work_items ORDER BY id')).rows;
    await control.query('BEGIN');await eraseUserAccount(control,ids.erased);await control.query('ROLLBACK');assert.deepEqual((await control.query('SELECT * FROM company_work_items ORDER BY id')).rows,before);
    await control.query('BEGIN');await eraseUserAccount(control,ids.erased);await control.query('COMMIT');
    assert.equal((await control.query('SELECT status FROM company_work_items WHERE id=$1',[own.id])).rows[0].status,'archived');
    assert.deepEqual(JSON.parse(JSON.stringify((await control.query('SELECT * FROM company_work_items WHERE id=$1',[other.id])).rows[0])),other);
    assert.equal((await request('erased','/company/access')).status,401);
  });
  if(process.env.COMPANY_BROWSER_QA==='true')await t.test('real browser: create, transition, campaign link, role isolation and mobile',async()=>{
    const {chromium}=await import(pathToFileURL(process.env.COMPANY_PLAYWRIGHT_MODULE).href);
    for(const path of ['company.html','src/company.js','src/company-insights.js','src/company-insights-guide.js','styles/company.css','styles/tokens.css','api-client.js','logo.png'])app.get('/'+path,(req,res)=>res.sendFile(fileURLToPath(new URL('../../'+path,import.meta.url))));
    const browser=await chromium.launch({executablePath:process.env.COMPANY_BROWSER_EXECUTABLE,headless:true});
    const errors=[];
    try {
      async function contextFor(who){
        const context=await browser.newContext({viewport:{width:1440,height:900}});
        await context.addInitScript(()=>localStorage.setItem('ez_progress','company-qa-sentinel'));
        const token=await signAccessToken(ids[who],who+'@example.invalid');
        const user={id:ids[who],email:who+'@example.invalid',fullName:who,isAdmin:who==='owner'};
        await context.route('**/*',async route=>{
          const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();
          if(url.pathname==='/api/auth/refresh')return route.fulfill({json:{accessToken:token,user}});
          if(url.pathname==='/api/auth/me')return route.fulfill({json:{user}});
          return route.continue();
        });
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};
      }
      const {context,page}=await contextFor('owner');await page.goto(base.replace('/api','')+'/company.html');
      await page.getByRole('button',{name:'+ Pekerjaan baru',exact:true}).click();
      await page.locator('#work-form input[name=title]').fill('Browser acceptance task');
      await page.locator('#work-form button[type=submit]').click();
      await page.getByRole('button',{name:'Browser acceptance task',exact:true}).click();
      await page.locator('#transitions').getByRole('button',{name:'Siap dikerjakan',exact:true}).click();
      await page.locator('#transitions .badge').filter({hasText:'Siap dikerjakan'}).waitFor();
      await page.locator('#editor [data-close]').first().click();
      await page.getByRole('button',{name:'Growth & Marketing',exact:true}).click();
      await page.getByRole('button',{name:'+ Pekerjaan baru',exact:true}).click();
      await page.locator('#work-form select[name=kind]').selectOption('campaign');
      await page.locator('#work-form input[name=title]').fill('Kampanye N5 — browser');
      await page.locator('#work-form input[name=linkUrl]').fill('https://eznihongo.com/courses/n5.html');
      await page.locator('#work-form button[type=submit]').click();
      await page.getByRole('button',{name:'Kampanye N5 — browser',exact:true}).click();
      await page.getByRole('button',{name:'Buat tautan UTM',exact:true}).click();
      await page.waitForFunction(()=>document.getElementById('utm-result').value.includes('utm_campaign='));
      await page.locator('#editor [data-close]').first().click();
      assert.equal(await page.evaluate(()=>localStorage.getItem('ez_progress')),'company-qa-sentinel');
      if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-company-desktop.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Student Success & Operations',exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-company-mobile.png',fullPage:true});
      const limited=await contextFor('finance');await limited.page.goto(base.replace('/api','')+'/company.html');
      await limited.page.getByRole('button',{name:'Finance & Business Administration',exact:true}).waitFor();
      assert.equal(await limited.page.locator('#divisions button').count(),1);
      assert.equal(await limited.page.locator('#members-button:visible').count(),0);
      assert.equal(await limited.page.evaluate(()=>localStorage.getItem('ez_progress')),'company-qa-sentinel');
      assert.deepEqual(errors,[]);await limited.context.close();await context.close();
    } finally {await browser.close();}
  });
});
