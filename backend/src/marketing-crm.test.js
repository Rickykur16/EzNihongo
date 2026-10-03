import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import express from 'express';
import pg from 'pg';
import {applyCompanyMigrations} from '../company-migrations/run.js';
import {applyCrmMigrations} from '../crm-migrations/run.js';
import {parseLead} from './marketing-crm-rules.js';
import '../../src/admin-workspace.js';

test('CRM validates contacts, price, loss reasons, timestamps and rejects unrelated fields',()=>{
  const input={fullName:'Ayu',phone:'0812 3456 7890'};
  assert.equal(parseLead(input).phone,'+6281234567890');
  assert.equal(parseLead({...input,email:' AYU@EXAMPLE.INVALID '}).email,'ayu@example.invalid');
  for(const body of [{...input,stage:'lost'},{...input,offeredPrice:1.2},{...input,nextFollowUp:'tomorrow'},{...input,phone:'<script>'},{...input,phone:''},{...input,paymentStatus:'approved'}])assert.throws(()=>parseLead(body));
  assert.equal(parseLead({...input,stage:'won',qualificationNote:'Target kerja Jepang dalam enam bulan.',nextFollowUp:'2026-10-01T00:00:00Z'}).nextFollowUp,null);
  assert.throws(()=>parseLead({...input,stage:'qualified'}),/crm_qualification_required/);
});
test('CRM menu belongs to Marketing and requires the feature and division grant',()=>{
  const menu=company=>globalThis.EzAdminWorkspace.routes({isAdmin:false},company,()=>false);
  const company={marketingCrm:{enabled:true},isAdmin:false,divisions:[{id:'marketing'}],scopes:{marketing:'global'}};
  assert.equal(menu(company).find(i=>i.key==='crm').group,'marketing');
  assert.equal(menu(company).find(i=>i.key==='growth').group,'marketing');
  assert.ok(!menu({...company,marketingCrm:{enabled:false}}).some(i=>i.key==='crm'));
  assert.ok(!menu({...company,scopes:{}}).some(i=>i.key==='crm'));
});

test('CRM persists in PostgreSQL with permission, concurrency, history and browser checks',{skip:!process.env.TEST_DATABASE_URL,timeout:120000},async t=>{
  const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.match(url.pathname,/test/);
  const schema='crm_test_'+randomUUID().replaceAll('-',''),control=new pg.Client({connectionString:url.href});await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.href;process.env.ADMIN_EMAILS='owner@example.invalid';process.env.JWT_ACCESS_SECRET='crm-test-only-access';process.env.JWT_REFRESH_SECRET='crm-test-only-refresh';
  process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';process.env.MARKETING_CRM_ENABLED='true';
  const {db}=await import('./db.js'),{signAccessToken}=await import('./auth.js'),{default:company}=await import('./routes/company.js');
  const {inspectStaffErasureTables,eraseStaffUserData}=await import('./staff-erasure.js');
  let server,browser;
  t.after(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  await control.query(`CREATE TABLE users(id UUID PRIMARY KEY,email TEXT UNIQUE,full_name TEXT);CREATE TABLE admin_emails(email TEXT);
    CREATE TABLE courses(id UUID PRIMARY KEY,title TEXT,slug TEXT);
    CREATE TABLE orders(id UUID PRIMARY KEY,user_id UUID REFERENCES users(id),course_id UUID REFERENCES courses(id),status TEXT,amount_idr INTEGER,created_at TIMESTAMPTZ DEFAULT NOW(),approved_at TIMESTAMPTZ);
    CREATE TABLE order_payments(id UUID PRIMARY KEY,order_id UUID REFERENCES orders(id),status TEXT);
    CREATE TABLE discussions(id UUID PRIMARY KEY,user_id UUID REFERENCES users(id));`);
  await applyCompanyMigrations(control);assert.deepEqual(await applyCrmMigrations(control),['001_marketing_crm','002_marketing_strategy']);assert.deepEqual(await applyCrmMigrations(control),[]);
  const ids=Object.fromEntries(['owner','marketing','scoped','finance','student','buyer'].map(k=>[k,randomUUID()])),c1=randomUUID(),c2=randomUUID();
  for(const [who,id]of Object.entries(ids))await control.query('INSERT INTO users VALUES($1,$2,$3)',[id,who+'@example.invalid',who]);
  await control.query("UPDATE users SET email='ayu@example.invalid' WHERE id=$1",[ids.buyer]);
  await control.query("INSERT INTO courses VALUES($1,'N5 — Dasar bahasa Jepang','n5'),($2,'N4 — Menengah','n4')",[c1,c2]);
  const tokens=Object.fromEntries(await Promise.all(Object.entries(ids).map(async([who,id])=>[who,await signAccessToken(id,who+'@example.invalid')])));
  const app=express();app.use(express.json());app.use('/api/company',company);
  app.use(express.static(fileURLToPath(new URL('../..',import.meta.url))));
  app.get('/crm-fixture',(req,res)=>res.type('html').send(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles/company.css"><style>body{margin:0;padding:28px;background:#f4f7fa;font-family:Arial,sans-serif}#company-workspace{max-width:1240px;margin:auto}button{font-family:inherit}</style><div id="company-workspace"></div><script type="module">
    import {mountCompanyWorkspace} from '/src/company.js';
    window.ezApi=(path,opts={})=>fetch('/api'+path,{...opts,headers:{Authorization:'Bearer ${tokens.owner}','Content-Type':'application/json'}});
    const access=await(await ezApi('/company/access')).json();
    window.workspace=await mountCompanyWorkspace(document.querySelector('#company-workspace'),{user:{id:'${ids.owner}'},companyAccess:access});workspace.open('crm');
  </script></html>`));
  app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  async function request(who,path,body,method=body?'POST':'GET'){
    const r=await fetch(origin+'/api/company'+path,{method,headers:{Authorization:'Bearer '+tokens[who],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
  }
  for(const [who,role,scope]of [['marketing','marketing',{type:'global'}],['scoped','marketing',{type:'course',courseId:c1}],['finance','finance',{type:'global'}]]){const r=await request('owner','/members',{userId:ids[who],role,scopes:[scope]});assert.equal(r.status,201,JSON.stringify(r.data));}
  const draft={id:randomUUID(),fullName:'Ayu contoh',phone:'081234567890',email:'ayu@example.invalid',courseId:c1,source:'referral',sourceDetail:'Teman sekolah',assignedTo:ids.marketing,nextFollowUp:'2020-01-01T00:00:00Z'};
  let lead;
  await t.test('creates durable records, normalizes contacts, retries once and blocks duplicates',async()=>{
    const r=await request('marketing','/crm/leads',draft);assert.equal(r.status,201,JSON.stringify(r.data));lead=r.data.lead;
    assert.equal(lead.phone,'+6281234567890');assert.equal((await request('marketing','/crm/leads',draft)).status,200);
    assert.equal((await request('marketing','/crm/leads',{...draft,id:randomUUID(),phone:'+62 812 3456 7890'})).status,409);
    assert.equal((await control.query('SELECT count(*) FROM marketing_leads')).rows[0].count,'1');assert.equal((await control.query('SELECT count(*) FROM marketing_lead_events')).rows[0].count,'1');
    const list=await request('marketing','/crm/leads?queue=due');assert.equal(list.data.summary.due,1);assert.equal(list.data.leads[0].full_name,draft.fullName);
  });
  await t.test('restricts records and aggregates to authorized courses and marketing roles',async()=>{
    for(const who of ['student','finance'])assert.equal((await request(who,'/crm/leads')).status,403);
    assert.equal((await request('scoped','/crm/leads?courseId='+c2)).status,403);
    assert.equal((await request('scoped','/crm/leads',{...draft,id:randomUUID(),courseId:null})).status,403);
    assert.equal((await request('scoped','/crm/leads',{...draft,id:randomUUID(),courseId:c2})).status,403);
    assert.equal((await request('marketing','/crm/leads',{...draft,id:randomUUID(),phone:'081299999999',email:'',assignedTo:ids.finance})).status,400);
    assert.equal((await request('scoped','/crm/leads/'+lead.id,{version:lead.version,courseId:c2},'PATCH')).status,403);
    const other=await request('owner','/crm/leads',{...draft,id:randomUUID(),courseId:c2});assert.equal(other.status,201);
    assert.equal((await request('scoped','/crm/leads')).data.summary.total,1);
    assert.equal((await request('scoped','/crm/leads/'+other.data.lead.id+'/events')).status,403);
    assert.equal((await request('marketing','/crm/leads?q=%')).data.summary.total,0);
    assert.equal((await request('marketing','/crm/leads?q=Ayu')).data.summary.total,2);
    assert.equal((await request('marketing','/crm/leads?offset[]=0')).status,400);
    assert.equal((await request('marketing','/crm/leads?stage[]=new')).status,400);
  });
  await t.test('preserves history, rejects lost updates and enforces close/reopen rules',async()=>{
    const change={version:lead.version,stage:'consulting',qualificationNote:'Punya target kerja Jepang dalam enam bulan dan ingin diskusi program.',offeredPrice:1500000,offerAngle:'career',background:'ex_intern_hospitality',primaryProblem:'cost',priceReaction:'reasonable',willingnessToPay:1200000,objection:'Minta rincian jalur kerja.',customerWords:'Biaya LPK terasa berat.'};
    const results=await Promise.all([request('marketing','/crm/leads/'+lead.id,change,'PATCH'),request('marketing','/crm/leads/'+lead.id,change,'PATCH')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);lead=results.find(r=>r.status===200).data.lead;
    let r=await request('marketing','/crm/leads/'+lead.id+'/events',{version:lead.version,note:'Ingin persiapan N5 sambil bekerja.'});assert.equal(r.status,201);lead=r.data.lead;
    assert.equal((await request('marketing','/crm/leads/'+lead.id,{version:lead.version,stage:'lost'},'PATCH')).status,400);
    r=await request('marketing','/crm/leads/'+lead.id,{version:lead.version,stage:'lost',lostReason:'Jadwal belum cocok'},'PATCH');assert.equal(r.status,200);lead=r.data.lead;assert.equal(lead.next_follow_up,null);
    r=await request('marketing','/crm/leads/'+lead.id,{version:lead.version,stage:'contacted',nextFollowUp:'2027-01-01T00:00:00Z'},'PATCH');assert.equal(r.status,200);lead=r.data.lead;assert.equal(lead.lost_reason,'');
    const events=(await request('marketing','/crm/leads/'+lead.id+'/events')).data.events;assert.equal(events.length,5);assert.ok(events.some(e=>e.note.includes('sambil bekerja')));
    assert.equal((await control.query('SELECT count(*) FROM orders')).rows[0].count,'0');
  });
  await t.test('weekly strategy dashboard counts verified payments and one experiment, with scoped access',async()=>{
    const orderId=randomUUID(),weekDate=new Date();weekDate.setUTCHours(0,0,0,0);weekDate.setUTCDate(weekDate.getUTCDate()-(weekDate.getUTCDay()+6)%7);const week=weekDate.toISOString().slice(0,10);
    await control.query("INSERT INTO orders(id,user_id,course_id,status,amount_idr,approved_at) VALUES($1,$2,$3,'approved',1500000,NOW())",[orderId,ids.buyer,c1]);
    await control.query("INSERT INTO order_payments(id,order_id,status) VALUES($1,$2,'approved')",[randomUUID(),orderId]);
    const list=await request('marketing','/crm/leads?courseId='+c1);assert.equal(list.status,200);assert.equal(list.data.summary.paid,1);assert.equal(list.data.leads[0].paid_order_id,orderId);
    const report=await request('scoped','/crm/growth?courseId='+c1+'&week='+week);assert.equal(report.status,200,JSON.stringify(report.data));
    assert.equal(report.data.summary.leads,1);assert.equal(report.data.summary.qualified,1);assert.equal(report.data.summary.cohort_paid,1);assert.equal(report.data.summary.period_paid,1);assert.equal(report.data.summary.period_revenue_idr,'1500000');
    assert.equal(report.data.angles.find(x=>x.label==='career').paid,1);
    assert.equal((await request('scoped','/crm/growth?courseId='+c2+'&week='+week)).status,403);
    assert.equal((await request('finance','/crm/growth?courseId='+c1+'&week='+week)).status,403);
    assert.equal((await request('scoped','/crm/growth?week='+week)).status,403);
    assert.equal((await request('owner','/crm/growth?courseId='+c1+'&week=2026-10-06')).status,400);
    const spend={courseId:c1,week,source:'referral',amountIdr:120000,note:'Uji referral',version:0};
    assert.equal((await request('scoped','/crm/growth/spend',spend,'PUT')).status,200);
    assert.equal((await request('scoped','/crm/growth/spend',spend,'PUT')).status,409);
    const review={courseId:c1,week,version:0,segmentDecision:'Eks-intern hospitality',buyerLanguage:'Biaya LPK terasa berat',topObjection:'Minta rincian jalur kerja',decision:'Uji pesan Career',experimentVariable:'message',experimentAngle:'career',experimentHypothesis:'Pesan Career menghasilkan lebih banyak lead berkualitas.',successMetric:'Qualified lead dari referral',experimentOwner:ids.marketing,status:'running'};
    assert.equal((await request('scoped','/crm/growth/review',review,'PUT')).status,200);
    assert.equal((await request('scoped','/crm/growth/review',review,'PUT')).status,409);
    const refreshed=await request('scoped','/crm/growth?courseId='+c1+'&week='+week);assert.equal(refreshed.data.spend[0].amount_idr,'120000');assert.equal(refreshed.data.review.experiment_angle,'career');
    assert.equal((await request('scoped','/crm/growth/review',{...review,version:1,status:'complete'},'PUT')).status,400);
    const completed=await request('owner','/crm/growth/review',{...review,version:1,status:'complete',experimentResult:'Satu siswa terbayar terhubung.'},'PUT');assert.equal(completed.status,200,JSON.stringify(completed.data));
  });
  await t.test('owner can erase prospects; account erasure handles exact email and FK contracts',async()=>{
    assert.equal((await request('marketing','/crm/leads/'+lead.id,{version:lead.version},'DELETE')).status,403);
    assert.equal((await request('owner','/crm/leads/'+lead.id,{version:1},'DELETE')).status,409);
    const personal=await request('marketing','/crm/leads',{id:randomUUID(),fullName:'Student',email:'student@example.invalid',source:'website'});assert.equal(personal.status,201);
    await control.query('BEGIN');const tables=await inspectStaffErasureTables(control);const erased=await eraseStaffUserData(control,ids.student,tables);await control.query('COMMIT');assert.equal(erased.marketing_leads_erased,1);
    assert.equal((await request('owner','/crm/leads/'+lead.id,{version:lead.version},'DELETE')).status,200);
    assert.equal((await control.query('SELECT count(*) FROM marketing_lead_events WHERE lead_id=$1',[lead.id])).rows[0].count,'0');
  });
  await t.test('browser uses real API and PostgreSQL: create, reload, notes, conflict, mobile',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
    const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
    await page.goto(origin+'/crm-fixture');await page.getByRole('button',{name:'Tambah calon siswa',exact:true}).click();
    await page.getByLabel('Nama',{exact:true}).fill('Bima — contoh CRM');await page.getByLabel('Nomor WhatsApp',{exact:true}).fill('081377777777');await page.getByLabel('Kursus diminati',{exact:true}).selectOption(c1);
    await page.getByLabel('Sumber',{exact:true}).last().selectOption('instagram');await page.getByLabel('Tujuan / kebutuhan',{exact:true}).fill('N5 untuk persiapan kerja');
    await page.getByRole('button',{name:'Simpan calon siswa',exact:true}).click();await page.locator('#crm-dialog').waitFor({state:'hidden'});
    await page.reload();await page.getByRole('button',{name:'Bima — contoh CRM',exact:true}).click();assert.equal(await page.getByLabel('Nomor WhatsApp',{exact:true}).inputValue(),'+6281377777777');
    await page.getByLabel('Hasil percakapan',{exact:true}).fill('Minta rincian program.');await page.getByRole('button',{name:'Tambah catatan',exact:true}).click();await page.getByText('Catatan tersimpan.',{exact:true}).waitFor();
    await page.getByText('Minta rincian program.',{exact:true}).waitFor();
    await page.getByLabel('Tujuan / kebutuhan',{exact:true}).fill('N5 dan latihan percakapan');
    await page.getByLabel('Hasil percakapan',{exact:true}).fill('Follow-up kedua setelah penjelasan program.');
    await page.getByRole('button',{name:'Simpan calon siswa',exact:true}).click();await page.getByText('Detail tersimpan. Catatan percakapan masih perlu ditambahkan.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Hasil percakapan',{exact:true}).inputValue(),'Follow-up kedua setelah penjelasan program.');
    await page.getByRole('button',{name:'Tambah catatan',exact:true}).click();await page.getByText('Catatan tersimpan.',{exact:true}).waitFor();
    const saved=(await control.query("SELECT * FROM marketing_leads WHERE phone='+6281377777777'")).rows[0];assert.equal(saved.full_name,'Bima — contoh CRM');
    await request('owner','/crm/leads/'+saved.id,{version:saved.version,stage:'contacted'},'PATCH');
    await page.getByLabel('Nama',{exact:true}).fill('Bima — draf konflik');await page.getByRole('button',{name:'Simpan calon siswa',exact:true}).click();await page.getByText('Data sudah diubah anggota lain.',{exact:false}).waitFor();assert.equal(await page.getByLabel('Nama',{exact:true}).inputValue(),'Bima — draf konflik');
    await page.getByRole('button',{name:'Tutup',exact:true}).click();assert.equal(await page.locator('#crm-dialog').isVisible(),true);
    // Reload deliberately discards this synthetic conflict draft; persisted data wins.
    await page.evaluate(()=>{document.querySelector('#crm-lead-form input').value='';});
    page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Tutup',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Bima — contoh CRM',exact:true}).waitFor();
    const output=process.env.CRM_SCREENSHOT_DIR;if(output){await mkdir(output,{recursive:true});await page.screenshot({path:output+'/calon-siswa-desktop.png',fullPage:true});}
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(output)await page.screenshot({path:output+'/calon-siswa-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Bima — contoh CRM',exact:true}).click();await page.getByText('Minta rincian program.',{exact:true}).waitFor();
    if(output)await page.screenshot({path:output+'/calon-siswa-detail.png',fullPage:true});
    await page.getByRole('button',{name:'Tutup',exact:true}).click();
    await page.route('**/api/company/crm/leads?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'crm_setup_required'})}),{times:1});
    await page.getByRole('button',{name:'Tampilkan',exact:true}).click();await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await page.getByRole('button',{name:'Bima — contoh CRM',exact:true}).waitFor();
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.workspace.open('growth'));
    const growth=page.locator('#marketing-growth'),weekDate=new Date();weekDate.setUTCHours(0,0,0,0);weekDate.setUTCDate(weekDate.getUTCDate()-(weekDate.getUTCDay()+6)%7);
    await growth.locator('#growth-filter [name="courseId"]').selectOption(c1);
    await growth.locator('#growth-filter [name="week"]').fill(weekDate.toISOString().slice(0,10));
    await growth.locator('#growth-filter button').click();await growth.getByRole('heading',{name:'Funnel dan ekonomi'}).waitFor();
    assert.ok(await growth.getByText('Konsultasi',{exact:true}).isVisible());
    await growth.locator('#growth-spend-form [name="source"]').selectOption('instagram');
    await growth.locator('#growth-spend-form [name="amountIdr"]').fill('25000');
    await growth.locator('#growth-spend-form button').click();await growth.getByText('Biaya tersimpan.',{exact:true}).waitFor();
    await growth.locator('#growth-review-form [name="decision"]').fill('Uji pesan baru minggu depan');
    await growth.locator('#growth-review-form button').click();await growth.getByText('Review mingguan tersimpan.',{exact:true}).waitFor();
    assert.equal((await control.query('SELECT decision FROM marketing_growth_reviews WHERE course_id=$1',[c1])).rows[0].decision,'Uji pesan baru minggu depan');
    if(output)await page.screenshot({path:output+'/growth-review-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(output)await page.screenshot({path:output+'/growth-review-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);await browser.close();browser=null;
  });
  await t.test('revoked memberships and feature flag deny further access',async()=>{
    await control.query("UPDATE staff_memberships SET status='revoked',revoked_at=NOW() WHERE user_id=$1",[ids.marketing]);assert.equal((await request('marketing','/crm/leads')).status,403);
    process.env.MARKETING_CRM_ENABLED='false';assert.equal((await request('owner','/crm/leads')).status,404);
  });
});
