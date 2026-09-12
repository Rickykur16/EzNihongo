import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { join } from 'node:path';
import express from 'express';
import pg from 'pg';
import { applyFinanceMigration } from '../finance-migrations/run.js';
import { describeLegacyStaffAccess } from './staff-capabilities.js';

if(process.env.FINANCE_BROWSER_QA==='true')test('Finance browser: course cashflow, bills, bank import, reconciliation, documents and mobile',{timeout:120000},async t=>{
  const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.match(url.pathname,/test/i);
  const schema='finance_browser_'+randomUUID().replaceAll('-',''),control=new pg.Client({connectionString:url.href});await control.connect();
  await control.query(`CREATE SCHEMA ${schema};SET search_path TO ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='finance-browser-access';process.env.JWT_REFRESH_SECRET='finance-browser-refresh';
  process.env.ADMIN_EMAILS='owner@example.invalid';process.env.FINANCE_ENABLED='true';process.env.COMPANY_WORKSPACE_ENABLED='false';
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text,full_name text);CREATE TABLE admin_emails(email text);
    CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text);
    CREATE TABLE orders(id uuid PRIMARY KEY,order_number text,course_id uuid REFERENCES courses(id),user_id uuid REFERENCES users(id),course_title_snapshot text,
      amount_idr integer,currency text DEFAULT 'IDR',status text,created_at timestamptz DEFAULT now(),approved_at timestamptz);
    CREATE TABLE order_payments(id uuid PRIMARY KEY,order_id uuid REFERENCES orders(id),status text);`);
  const owner=randomUUID(),student=randomUUID(),course=randomUUID(),order=randomUUID();
  await control.query("INSERT INTO users VALUES($1,'owner@example.invalid','Owner Fixture'),($2,'student@example.invalid','Student Fixture')",[owner,student]);
  await control.query("INSERT INTO courses VALUES($1,'Kursus N5 · Fixture','n5')",[course]);
  await control.query("INSERT INTO orders(id,order_number,course_id,user_id,course_title_snapshot,amount_idr,status,approved_at) VALUES($1,'EZN-FIXTURE-001',$2,$3,'Kursus N5 · Fixture',300000,'approved','2026-09-02T01:00:00Z')",[order,course,student]);
  await control.query("INSERT INTO order_payments VALUES($1,$2,'approved')",[randomUUID(),order]);await applyFinanceMigration(control);
  const {db}=await import('./db.js'),{signAccessToken}=await import('./auth.js'),{default:finance}=await import('./routes/finance.js');
  const token=await signAccessToken(owner,'owner@example.invalid'),user={id:owner,email:'owner@example.invalid',fullName:'Owner Fixture',isAdmin:true};
  const app=express();app.use(express.json());
  // Only authentication/discovery are fixtures. Every Finance API below uses real SQL.
  app.post('/api/auth/refresh',(req,res)=>res.json({accessToken:token,user}));app.get('/api/auth/me',(req,res)=>res.json({user}));
  app.get('/api/staff/capabilities',(req,res)=>res.json(describeLegacyStaffAccess(true)));
  app.get('/api/company/access',(req,res)=>res.status(404).json({error:'company_workspace_disabled'}));
  app.use('/api/finance',finance);app.use('/api',(req,res)=>res.status(404).json({error:'fixture_route_absent'}));
  const root=fileURLToPath(new URL('../../',import.meta.url));
  app.get('*',async(req,res)=>{const path=req.path.slice(1);if(!['admin.html','api-client.js'].includes(path)&&!/^((src|styles)\/[a-z0-9-]+\.(js|css))$/.test(path))return res.sendStatus(404);
    try{res.type(path.endsWith('.html')?'html':path.endsWith('.js')?'js':'css').send(await readFile(join(root,path)));}catch{res.sendStatus(404);}});
  app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  const {chromium}=await import(pathToFileURL(process.env.COMPANY_PLAYWRIGHT_MODULE).href);
  const browser=await chromium.launch({executablePath:process.env.COMPANY_BROWSER_EXECUTABLE,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addInitScript(()=>localStorage.setItem('ez_progress','finance-student-sentinel'));
  t.after(async()=>{if(errors.length)t.diagnostic(JSON.stringify(errors));await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  async function saved(){await page.locator('.fin-dialog[open]').waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:'Memuat…'}).waitFor({state:'hidden'});}
  async function submit(){await page.locator('.fin-dialog').getByRole('button',{name:'Simpan',exact:true}).click();await saved();}
  async function tab(name){await page.locator('.fin-tabs').getByRole('button',{name,exact:true}).click();await page.getByRole('status').filter({hasText:'Memuat…'}).waitFor({state:'hidden'});}
  await page.goto(origin+'/admin.html#view=finance');await page.getByLabel('Mulai pembukuan',{exact:true}).fill('2026-09-01');
  await page.getByRole('button',{name:'Mulai Finance',exact:true}).click();await page.getByRole('heading',{name:'Kelola keuangan kursus.'}).waitFor();
  await page.getByRole('button',{name:'Tambah rekening / kategori',exact:true}).click();
  await page.getByLabel('Kode unik').fill('BCA');await page.getByLabel('Nama',{exact:true}).fill('Bank Operasional · Fixture');
  await page.getByLabel('Saldo awal rekening').fill('1000000');await submit();
  await tab('Penerimaan');await page.getByRole('button',{name:'Sinkronkan pembayaran kursus'}).click();await page.getByRole('button',{name:'Alokasikan',exact:true}).waitFor();
  await page.getByRole('button',{name:'Alokasikan',exact:true}).click();await submit();
  await page.getByRole('button',{name:'Kuitansi',exact:true}).click();await page.frameLocator('.fin-document').getByText('EZN-FIXTURE-001').waitFor();
  await page.locator('.fin-dialog').getByRole('button',{name:'Batal',exact:true}).click();
  await tab('Pengeluaran & Tagihan');await page.getByRole('button',{name:'Tambah pengeluaran / tagihan'}).click();
  await page.getByLabel('Vendor / penerima').fill('Server Fixture');await page.getByLabel('Keperluan').fill('Hosting kursus September');
  await page.getByLabel('Cara mengisi nominal').selectOption('calculate');
  await page.getByLabel('Jumlah (sesi / jam / unit)',{exact:true}).fill('3');await page.getByLabel('Tarif per unit (Rp)',{exact:true}).fill('40000');
  await page.getByLabel('Potongan (Rp)',{exact:true}).fill('200000');assert.equal(await page.getByLabel('Nominal (rupiah bulat)').inputValue(),'');
  assert.equal(await page.locator('.fin-dialog form').evaluate(form=>form.checkValidity()),false);
  await page.getByLabel('Potongan (Rp)',{exact:true}).fill('20000');assert.equal(await page.getByLabel('Nominal (rupiah bulat)').inputValue(),'100000');
  assert.equal(await page.getByLabel('Nominal (rupiah bulat)').evaluate(input=>input.readOnly),true);
  assert.match(await page.locator('[data-amount-preview]').innerText(),/120\.000.*20\.000.*100\.000/);
  await page.getByLabel('Cara mengisi nominal').selectOption('manual');assert.equal(await page.getByLabel('Nominal (rupiah bulat)').evaluate(input=>input.readOnly),false);
  await page.getByLabel('Cara mengisi nominal').selectOption('calculate');
  if(process.env.FINANCE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FINANCE_SCREENSHOT_DIR,'finance-calculator.png'),fullPage:true});
  await submit();
  assert.equal((await control.query('SELECT amount FROM finance_bills')).rows[0].amount,'100000');
  await page.getByRole('button',{name:'Setujui',exact:true}).click();await page.getByRole('button',{name:'Catat pembayaran'}).waitFor();
  await page.getByRole('button',{name:'Catat pembayaran'}).click();await page.getByLabel('Referensi / keterangan').fill('BAYAR-FIXTURE');await submit();
  assert.match(await page.locator('.fin table').innerText(),/Lunas/);
  await tab('Kas & Bank');await page.getByRole('button',{name:'Impor mutasi CSV'}).click();
  const day=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jayapura',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  await page.locator('[name=csv]').setInputFiles({name:'mutasi-fixture.csv',mimeType:'text/csv',buffer:Buffer.from(`date,description,amount,reference\n${day},Penerimaan kursus,300000,COURSE-IN\n${day},Hosting kursus,-100000,HOSTING-OUT\n`)});
  await page.locator('[name=referenceColumn]').selectOption('3');await page.getByRole('button',{name:'Pratinjau impor'}).click();await submit();
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Cocokkan',exact:true}).first().click();await submit();}
  assert.equal(await page.getByRole('button',{name:'Cocokkan',exact:true}).count(),0);
  await tab('Ringkasan');assert.match(await page.locator('.fin-metrics').innerText(),/1\.200\.000/);
  if(process.env.FINANCE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FINANCE_SCREENSHOT_DIR,'finance-desktop.png'),fullPage:true});
  await tab('Laporan');
  const reportOrder=['1. Ringkasan manajemen','2. Laporan laba rugi','3. Laporan posisi keuangan (Neraca)','4. Laporan perubahan ekuitas','5. Laporan arus kas','6. Catatan laporan','7. Lampiran — Neraca saldo'];
  async function reportPeriod(mode,part){
    await page.getByLabel('Jenis laporan',{exact:true}).selectOption(mode);await page.getByLabel('Tahun',{exact:true}).fill('2026');
    if(mode==='month')await page.getByLabel('Bulan',{exact:true}).selectOption(String(part));
    if(mode==='quarter')await page.getByLabel('Kuartal',{exact:true}).selectOption(String(part));
    await page.getByRole('button',{name:'Tampilkan',exact:true}).click();await page.getByRole('status').filter({hasText:'Memuat…'}).waitFor({state:'hidden'});
  }
  for(const [mode,part,label] of [['month',9,'September 2026'],['quarter',3,'Q3 2026'],['annual',1,'2026']]){
    await reportPeriod(mode,part);await page.locator('.fin-report-heading').getByRole('heading',{name:label,exact:true}).waitFor();
    assert.match(await page.locator('.fin-metrics').innerText(),/100\.000/);
    assert.deepEqual(await page.locator('[data-report-section]').allTextContents(),reportOrder);
    assert.match(await page.locator('.fin-report-heading').innerText(),/Data pembanding belum lengkap/);
    if(process.env.FINANCE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FINANCE_SCREENSHOT_DIR,'finance-report-'+mode+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Cetak / Simpan PDF',exact:true}).click();await page.frameLocator('.fin-document').getByText('Laporan Finance',{exact:true}).waitFor();
  await page.frameLocator('.fin-document').getByRole('heading',{name:'Perbandingan periode'}).waitFor();
  assert.deepEqual(await page.frameLocator('.fin-document').locator('[data-report-section]').allTextContents(),reportOrder);
  await page.locator('.fin-dialog').getByRole('button',{name:'Batal',exact:true}).click();
  const reportDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh laporan CSV'}).click();
  const csv=await reportDownload;assert.equal(csv.suggestedFilename(),'finance-laporan-annual-2026-01-01.csv');
  const csvContents=await readFile(await csv.path(),'utf8');assert.match(csvContents,/Laba \/ rugi/);assert.match(csvContents,/Data pembanding belum lengkap/);
  let previousSection=-1;for(const title of reportOrder){const index=csvContents.indexOf(title);assert.ok(index>previousSection,'CSV follows company report order: '+title);previousSection=index;}
  await reportPeriod('month',10);assert.match(await page.locator('.fin-table-scroll').first().innerText(),/100\.000/);
  // A failed refresh must not show a prior period under a newly selected heading.
  await context.route('**/api/finance/report?*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Laporan belum tersedia"}'}));
  await reportPeriod('month',11);assert.equal(await page.locator('.fin-report-heading').count(),0);assert.match(await page.locator('.fin-message').innerText(),/Laporan belum tersedia/);
  await context.unroute('**/api/finance/report?*');await reportPeriod('month',9);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile report must not overflow');
  if(process.env.FINANCE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FINANCE_SCREENSHOT_DIR,'finance-report-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1050});
  await tab('Buku Transaksi');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh CSV transaksi'}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/finance-transaksi/);
  await page.setViewportSize({width:390,height:844});await tab('Ringkasan');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page must not overflow horizontally');
  if(process.env.FINANCE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FINANCE_SCREENSHOT_DIR,'finance-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>localStorage.getItem('ez_progress')),'finance-student-sentinel');assert.deepEqual(errors,[]);
  assert.equal((await control.query('SELECT count(*) FROM finance_matches')).rows[0].count,'2');
  assert.equal((await control.query('SELECT amount_idr,status FROM orders WHERE id=$1',[order])).rows[0].amount_idr,300000);
});
