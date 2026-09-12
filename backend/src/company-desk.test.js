import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import pg from 'pg';
import { applyCompanyMigrations } from '../company-migrations/run.js';

test('daily desk, calendar and server filtering on isolated PostgreSQL', {skip:!process.env.TEST_DATABASE_URL,timeout:90000}, async t => {
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
  const schema='desk_test_'+randomUUID().replaceAll('-',''), control=new pg.Client({connectionString:url.href});
  await control.connect();await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options',`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='desk-local-access';process.env.JWT_REFRESH_SECRET='desk-local-refresh';
  process.env.ADMIN_EMAILS='owner@example.invalid';process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';
  process.env.COMPANY_INSIGHTS_ENABLED='false';
  const {db}=await import('./db.js'), {signAccessToken,signRefreshToken}=await import('./auth.js');
  const {signKanjiAccessToken}=await import('./kanji-auth.js');
  const {default:company}=await import('./routes/company.js');
  const {parseWorkFilters,readCompanyWork}=await import('./company-read-work.js');
  const {requestAccess}=await import('./company-policy.js');
  let server;
  t.after(async()=>{
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();
  });
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text UNIQUE,full_name text);
    CREATE TABLE admin_emails(email text); CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text);
    CREATE TABLE orders(id uuid PRIMARY KEY,status text,expires_at timestamptz);
    CREATE TABLE discussions(id uuid PRIMARY KEY);
    CREATE TABLE user_progress(user_id uuid REFERENCES users(id),completed boolean,note text);`);
  await applyCompanyMigrations(control);
  const roles=['technology','academic','marketing','operations','finance'];
  const ids=Object.fromEntries(['owner',...roles,'mixed','student'].map(k=>[k,randomUUID()]));
  for(const [name,id]of Object.entries(ids))await control.query('INSERT INTO users VALUES ($1,$2,$3)',[id,name+'@example.invalid',name]);
  const c1=randomUUID(),c2=randomUUID(),order=randomUUID();
  await control.query("INSERT INTO courses VALUES ($1,'N5','n5'),($2,'N4','n4')",[c1,c2]);
  await control.query("INSERT INTO orders VALUES ($1,'approved',NOW()-INTERVAL '1 day')",[order]);
  await control.query("INSERT INTO user_progress VALUES ($1,true,'student data sentinel')",[ids.student]);
  const app=express();app.use(express.json());app.use('/api/company',company);
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  async function request(who,path,body,token){
    const res=await fetch(base+'/api/company'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(token||await signAccessToken(ids[who],who+'@example.invalid')),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return{status:res.status,data:await res.json(),headers:res.headers};
  }
  const grant=async(who,role,course)=>{
    const r=await request('owner','/members',{userId:ids[who],role,scopes:[course?{type:'course',courseId:course}:{type:'global'}]});assert.equal(r.status,201);
  };
  for(const role of roles)await grant(role,role);
  await grant('mixed','academic',c1);await grant('mixed','marketing',c2);
  async function item(division,title,extra={}){
    const fields={division_key:division,title,kind:'task',status:'ready',created_by:ids.owner,...extra};
    const keys=Object.keys(fields),r=await control.query(`INSERT INTO company_work_items(${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(fields));return r.rows[0];
  }
  const past=new Date(Date.now()-86400000).toISOString(),future=new Date(Date.now()+86400000).toISOString();
  const a=await item('academic','Review materi N5',{course_id:c1,status:'review',assigned_to:ids.mixed,scheduled_at:past});
  const b=await item('marketing','Susun konten N4',{course_id:c2,kind:'content',status:'draft',scheduled_at:future});
  const closed=await item('academic','Materi sudah selesai',{course_id:c1,status:'done',assigned_to:ids.mixed,scheduled_at:past});
  const noDate=await item('academic','Tanpa target',{course_id:c1});
  await item('academic','RAHASIA academic N4',{course_id:c2,status:'review',scheduled_at:past});
  await item('marketing','RAHASIA marketing N5',{course_id:c1,status:'review',scheduled_at:past});
  await item('marketing','RAHASIA marketing global',{status:'review',scheduled_at:past});
  await item('technology','Verifikasi rilis',{kind:'release',status:'testing',assigned_to:ids.technology});
  await item('finance','Review transaksi',{kind:'case',status:'new',source_order_id:order});
  await item('operations','Tindak lanjut diskusi',{kind:'task',status:'ready'});
  const calFrom='2026-08-31T15:00:00.000Z',calTo='2026-09-30T15:00:00.000Z';
  const calA=await item('marketing','Agenda awal bulan <uji>',{kind:'content',status:'draft',scheduled_at:calFrom,priority:'high'});
  const calB=await item('marketing','Agenda akhir bulan',{kind:'content',status:'draft',scheduled_at:'2026-09-30T14:59:59.999Z'});
  await item('marketing','Agenda bulan berikutnya',{kind:'content',status:'draft',scheduled_at:calTo});
  await item('academic','Bukan kalender Marketing',{scheduled_at:calFrom});
  // Older matching data is intentionally beyond page one and the legacy offset cap.
  await control.query(`INSERT INTO company_work_items(division_key,kind,title,description,status,priority,created_by,updated_at)
    SELECT 'technology','task','Bulk '||n,'bulk fixture',CASE WHEN n=10003 THEN 'blocked' ELSE 'ready' END,'low',$1,
      '2026-01-01T00:00:00Z'::timestamptz - n * INTERVAL '1 microsecond' FROM generate_series(1,10003) n`,[ids.owner]);
  const searchItem=await item('technology','Target %_ literal',{description:'Rare acceptance criterion',status:'blocked',priority:'low',updated_at:'2025-01-01T00:00:00Z'});
  const micro=[];
  for(const frac of ['000006','000005','000005','000002','000001'])micro.push(await item('technology','Micro '+frac,{description:'cursor-fixture',updated_at:`2026-02-01T00:00:00.${frac}Z`}));
  const sourceTables=['users','admin_emails','courses','orders','discussions','user_progress','company_work_items','company_work_events','company_outbox'];
  const snapshot=async()=>{const result={};for(const name of sourceTables)result[name]=(await control.query(`SELECT COALESCE(jsonb_agg(r ORDER BY to_jsonb(r)::text),'[]'::jsonb) AS data FROM ${name} r`)).rows[0].data;return result;};
  const before=await snapshot();

  await t.test('all five roles see only their division; mixed course grants never become a cross-product',async()=>{
    for(const who of roles){const r=await request(who,'/desk');assert.equal(r.status,200);assert.ok(r.data.items.length);assert.ok(r.data.items.every(i=>i.division_key===who));}
    const r=await request('mixed','/desk?bucket=all');assert.equal(r.status,200);
    assert.deepEqual(new Set(r.data.items.map(i=>i.id)),new Set([a,b,closed,noDate].map(i=>i.id)));
    assert.deepEqual(r.data.summary,{mine:1,unassigned:2,review:1,overdue:1});
    assert.equal(r.data.summaryScope,'all_authorized_work');assert.match(r.headers.get('cache-control'),/no-store/);
    for(const path of ['/desk?division=finance','/desk?division=academic&courseId='+c2,'/desk?courseId=global','/calendar?from='+calFrom+'&to='+calTo+'&courseId='+c1])assert.equal((await request('mixed',path)).status,403);
    const filtered=await request('mixed','/desk?division=marketing&q=Susun');assert.equal(filtered.data.items.length,1);assert.deepEqual(filtered.data.summary,r.data.summary);
  });
  await t.test('action buckets exclude completed/missing deadlines and payment status stays authoritative',async()=>{
    for(const [bucket,expected]of [['mine',[a]],['unassigned',[b,noDate]],['review',[a]],['overdue',[a]],['upcoming',[b]]]){
      const r=await request('mixed','/desk?bucket='+bucket);assert.equal(r.status,200);assert.deepEqual(new Set(r.data.items.map(i=>i.id)),new Set(expected.map(i=>i.id)));
    }
    assert.equal((await request('technology','/desk?bucket=review')).data.items[0].status,'testing');
    assert.equal((await request('finance','/desk')).data.items[0].source_payment_status,'approved');
  });
  await t.test('search/status/course/kind/priority/assignee filter the database, with literal wildcard characters',async()=>{
    const r=await request('technology','/work?division=technology&q='+encodeURIComponent('%_')+'&status=blocked&kind=task&priority=low');
    assert.equal(r.status,200);assert.deepEqual(r.data.items.map(i=>i.id),[searchItem.id]);
    assert.equal((await request('technology','/work?division=technology&status=blocked')).data.items.length,2);
    assert.deepEqual((await request('mixed','/work?division=academic&courseId='+c1+'&assignee=me&status=review')).data.items.map(i=>i.id),[a.id]);
    assert.equal((await request('technology','/desk?q='+encodeURIComponent("' OR 1=1 --"))).data.items.length,0);
  });
  await t.test('keyset pages preserve PostgreSQL microseconds and ties without duplicates',async()=>{
    const expected=(await control.query("SELECT id FROM company_work_items WHERE description='cursor-fixture' ORDER BY updated_at DESC,id")).rows.map(i=>i.id);
    const found=[];let cursor='';
    do{const r=await request('technology','/work?division=technology&q=cursor-fixture&limit=2'+(cursor?'&cursor='+cursor:''));assert.equal(r.status,200);found.push(...r.data.items.map(i=>i.id));cursor=r.data.nextCursor;}while(cursor);
    assert.deepEqual(found,expected);assert.equal(new Set(found).size,micro.length);
    const first=await request('technology','/work?division=technology&priority=low&limit=1&offset=10000');assert.equal(first.status,200);assert.ok(first.data.nextCursor);
    const after=await request('technology','/work?division=technology&priority=low&limit=1&cursor='+first.data.nextCursor);assert.equal(after.status,200);assert.notEqual(first.data.items[0].id,after.data.items[0].id);
    assert.equal(after.data.items[0].title,'Bulk 10002');
  });
  await t.test('cursors bind user, permissions and filters, and never replace authorization',async()=>{
    const first=await request('mixed','/work?division=academic&limit=1'),cursor=first.data.nextCursor;assert.ok(cursor);
    for(const [who,query]of [['owner','division=academic'],['mixed','division=academic&status=review']])assert.equal((await request(who,'/work?'+query+'&cursor='+cursor)).status,400);
    const forged=JSON.parse(Buffer.from(cursor,'base64url').toString());forged.id=randomUUID();forged.time='2026-02-30T00:00:00.000Z';
    assert.equal((await request('mixed','/work?division=academic&cursor='+Buffer.from(JSON.stringify(forged)).toString('base64url'))).status,400);
    assert.equal((await request('finance','/work?division=academic&cursor='+cursor)).status,403);
  });
  await t.test('calendar uses explicit half-open UTC bounds and supports ordered pagination',async()=>{
    const suffix='from='+calFrom+'&to='+calTo+'&q=Agenda&limit=1';
    const r=await request('marketing','/calendar?'+suffix);assert.equal(r.status,200);assert.equal(r.data.items[0].id,calA.id);assert.deepEqual(r.data.range,{from:calFrom,to:calTo});
    const next=await request('marketing','/calendar?'+suffix+'&cursor='+r.data.nextCursor);assert.equal(next.status,200);assert.deepEqual(next.data.items.map(i=>i.id),[calB.id]);assert.equal(next.data.hasMore,false);
    assert.equal((await request('academic','/calendar?'+suffix)).status,403);
    assert.equal((await request('marketing','/calendar?from='+calFrom+'&to=2026-12-01T00:00:00.000Z')).status,400);
  });
  await t.test('malformed filters reject arrays, injection, unknown values and excessive page sizes',()=>{
    for(const input of [{division:['academic','finance']},{division:'academic',status:'bogus'},{division:'academic',courseId:'not-uuid'},{division:'academic',limit:'101'},{division:'academic',limit:'0'},{division:'academic',offset:'10001'},{division:'academic',sort:'1;DROP TABLE users'},{division:'academic',q:'x'.repeat(121)},{division:'academic',cursor:'bad='},{division:'academic',cursor:'abc',offset:'1'}])assert.throws(()=>parseWorkFilters(input,'board'));
    for(const from of ['2026-02-30T00:00:00.000Z','2026-09-01','2026-09-01T00:00:00+09:00'])assert.throws(()=>parseWorkFilters({from,to:calTo},'calendar'));
  });
  await t.test('read-only queries fail closed on locks and re-check revoked/expired access before returning',async()=>{
    const headers={authorization:'Bearer '+await signAccessToken(ids.mixed,'mixed@example.invalid')};
    const stale=await requestAccess({headers});
    await control.query("UPDATE staff_memberships SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[ids.mixed]);
    assert.equal((await request('mixed','/desk')).status,403);
    await assert.rejects(readCompanyWork({headers,access:stale,query:{}},'desk'),e=>e.status===403&&e.message==='work_access_changed');
    await control.query('UPDATE staff_memberships SET expires_at=NULL WHERE user_id=$1',[ids.mixed]);
    await control.query("UPDATE staff_memberships SET status='revoked',revoked_at=NOW() WHERE user_id=$1",[ids.mixed]);
    assert.equal((await request('mixed','/desk')).status,403);
    await control.query("UPDATE staff_memberships SET status='active',revoked_at=NULL WHERE user_id=$1",[ids.mixed]);
    await control.query('BEGIN; LOCK TABLE company_work_items IN ACCESS EXCLUSIVE MODE');
    try{const r=await request('mixed','/desk');assert.equal(r.status,503);assert.deepEqual(r.data,{error:'work_list_unavailable'});}finally{await control.query('ROLLBACK');}
    assert.equal((await request('mixed','/desk')).status,200);
    for(const token of [await signRefreshToken(ids.mixed,randomUUID()),await signKanjiAccessToken(ids.mixed,'mixed@example.invalid'),await signAccessToken(ids.mixed,'wrong@example.invalid')])assert.equal((await request('mixed','/desk',null,token)).status,401);
    assert.equal((await request('student','/desk')).status,403);
    process.env.COMPANY_STAFF_ENABLED='false';assert.equal((await request('mixed','/desk')).status,403);process.env.COMPANY_STAFF_ENABLED='true';
    process.env.COMPANY_WORKSPACE_ENABLED='false';assert.equal((await request('owner','/desk')).status,404);process.env.COMPANY_WORKSPACE_ENABLED='true';
  });

  if(process.env.COMPANY_BROWSER_QA==='true')await t.test('browser: cross-division desk, whole-database search, local calendar, mobile and existing editor',async()=>{
    const {chromium}=await import(pathToFileURL(process.env.COMPANY_PLAYWRIGHT_MODULE).href);
    for(const file of ['company.html','src/company.js','src/company-desk.js','src/company-insights.js','src/company-insights-guide.js','styles/company.css','styles/tokens.css','api-client.js','logo.png'])app.get('/'+file,(req,res)=>res.sendFile(fileURLToPath(new URL('../../'+file,import.meta.url))));
    const browser=await chromium.launch({executablePath:process.env.COMPANY_BROWSER_EXECUTABLE,headless:true}),errors=[],writes=[];
    try{
      async function contextFor(who){
        const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Jayapura'});
        await context.addInitScript(()=>localStorage.setItem('ez_progress','desk-sentinel'));
        const token=await signAccessToken(ids[who],who+'@example.invalid'),user={id:ids[who],email:who+'@example.invalid',fullName:who,isAdmin:who==='owner'};
        await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
          if(u.pathname==='/api/auth/refresh')return route.fulfill({json:{accessToken:token,user}});
          if(u.pathname==='/api/auth/me')return route.fulfill({json:{user}});
          if(u.pathname.startsWith('/api/company')&&route.request().method()!=='GET')writes.push(u.pathname);
          return route.continue();});
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/company.html');return{page,context};
      }
      const {page,context}=await contextFor('owner');await page.locator('#desk-button').click();
      await page.locator('#desk-summary [data-bucket=mine]').waitFor();
      const firstId=await page.locator('[data-desk-item]').first().getAttribute('data-desk-item');
      await page.locator('#desk-next').click();await page.waitForFunction(()=>document.querySelector('#desk-page-label').textContent==='Halaman 2');
      assert.notEqual(await page.locator('[data-desk-item]').first().getAttribute('data-desk-item'),firstId);
      await page.locator('#desk-previous').click();await page.waitForFunction(()=>document.querySelector('#desk-page-label').textContent==='Halaman 1');
      assert.equal(await page.locator('[data-desk-item]').first().getAttribute('data-desk-item'),firstId);
      await page.locator('#desk-filters [name=q]').fill('%_');await page.locator('#desk-filters button[type=submit]').click();
      await page.locator('#desk-results').getByRole('button',{name:'Target %_ literal',exact:true}).waitFor();
      assert.equal(await page.locator('#desk-next').isDisabled(),true);
      await page.locator('#desk-reset').click();await page.locator('#desk-summary [data-bucket=review]').click();
      await page.locator('#desk-results').getByRole('button',{name:'Review materi N5',exact:true}).waitFor();
      if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-desk-desktop.png',fullPage:true});
      await page.locator('#desk-results').getByRole('button',{name:'Review materi N5',exact:true}).click();
      await page.locator('#editor[open]').waitFor();assert.equal(await page.locator('#work-form [name=title]').inputValue(),'Review materi N5');
      assert.equal(await page.locator('#title').textContent(),'Academic & Learning');await page.locator('#editor [data-close]').first().click();
      await page.locator('#calendar-button').click();await page.locator('#desk-filters [name=month]').fill('2026-09');
      await page.locator('#desk-filters [name=q]').fill('Agenda');
      const response=page.waitForResponse(r=>r.url().includes('/company/calendar?')&&r.url().includes('q=Agenda'));
      await page.locator('#desk-filters button[type=submit]').click();const calendar=await response;
      assert.equal(new URL(calendar.url()).searchParams.get('from'),calFrom);assert.equal(new URL(calendar.url()).searchParams.get('to'),calTo);
      await page.locator('#desk-results').getByRole('button',{name:'Agenda awal bulan <uji>',exact:true}).waitFor();
      assert.equal(await page.locator('#desk-results tbody tr').count(),2);assert.match(await page.locator('#desk-status').textContent(),/Asia\/Jayapura/);
      if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-marketing-calendar.png',fullPage:true});
      // Delayed reads must not paint after leaving the desk.
      let release,started,finished;const held=new Promise(r=>release=r),entered=new Promise(r=>started=r),handled=new Promise(r=>finished=r);
      await page.route('**/api/company/desk?**',async route=>{started();await held;await route.continue();finished();});
      await page.locator('#desk-button').click();await entered;
      await page.locator('[data-division=finance]').click();release();await handled;await page.unroute('**/api/company/desk?**');
      await page.locator('#content').getByRole('button',{name:'Review transaksi',exact:true}).waitFor();
      assert.equal(await page.locator('#desk-panel').isHidden(),true);
      assert.equal(await page.evaluate(()=>localStorage.getItem('ez_progress')),'desk-sentinel');
      const limited=await contextFor('mixed');await limited.page.setViewportSize({width:390,height:844});await limited.page.locator('#desk-button').click();
      await limited.page.locator('#desk-summary [data-bucket=mine]').click();
      await limited.page.locator('#desk-results').getByRole('button',{name:'Review materi N5',exact:true}).waitFor();
      assert.equal(await limited.page.locator('#desk-results tbody tr').count(),1);assert.doesNotMatch(await limited.page.locator('#desk-panel').textContent(),/RAHASIA/);
      assert.ok(await limited.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(process.env.COMPANY_QA_OUTPUT_DIR)await limited.page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-desk-mobile.png',fullPage:true});
      const finance=await contextFor('finance');await finance.page.locator('#desk-button').waitFor();assert.equal(await finance.page.locator('#calendar-button').isHidden(),true);
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await finance.context.close();await limited.context.close();await context.close();
    }finally{await browser.close();}
  });
  await t.test('desk/calendar request limiter returns a clear retry response',async()=>{
    let limited;
    for(let i=0;i<61;i++){const r=await request('finance','/desk');if(r.status===429){limited=r;break;}assert.equal(r.status,200);}
    assert.ok(limited);assert.deepEqual(limited.data,{error:'work_list_rate_limit'});assert.ok(Number(limited.headers.get('retry-after'))>0);
  });
  await t.test('all reads preserve work, events, outbox, orders and student data byte-for-byte',async()=>assert.deepEqual(await snapshot(),before));
});
