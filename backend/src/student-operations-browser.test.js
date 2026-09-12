import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import express from 'express';

test('operations browser: integrated workspace, drafts, errors, cases, attendance and responsive layout',{skip:!process.env.PLAYWRIGHT_MODULE,timeout:90000},async t=>{
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const app=express();app.use(express.static(fileURLToPath(new URL('../..',import.meta.url))));
  app.get('/operations-fixture',(req,res)=>res.type('html').send(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles/student-operations.css"><link rel="stylesheet" href="/styles/company.css"><style>body{margin:0;background:#f4f7fa;font-family:Arial,sans-serif;padding:28px}#company-workspace{max-width:1200px;margin:auto}button,input,select{font-family:inherit}</style><div id="company-workspace"></div><script type="module">
    import {mountCompanyWorkspace} from '/src/company.js';
    const course='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
    window.calls=[];window.conflict=false;window.failure=false;
    window.students=[{id:user,full_name:'Ayu — siswa contoh',email:'ayu@example.invalid',onboarding:'new',goal:'Belajar N5',assigned_to:null,version:0,completed:3,total_lessons:20,access_status:'active',expires_at:new Date(Date.now()+3*864e5).toISOString(),inactive:true,last_activity:new Date(Date.now()-9*864e5).toISOString(),next_follow_up:null}];window.cases=[];
    window.ezApi=async(path,opts={})=>{
      calls.push({path,method:opts.method||'GET',body:opts.body?JSON.parse(opts.body):null});let data={},status=200;const body=opts.body?JSON.parse(opts.body):{};
      if(path==='/company/courses')data={courses:[{id:course,title:'N5 — Dasar bahasa Jepang'},{id:other,title:'N4 — Menengah'}]};
      else if(path.startsWith('/company/assignees'))data={people:[{id:user,full_name:'PIC Contoh'}]};
      else if(path.startsWith('/company/operations/students?')){if(window.failure){status=503;data={error:'unavailable'};}else data={students:new URL('http://x'+path).searchParams.get('courseId')===course?students:[],summary:{active:1,onboarding:1,inactive:1,follow_up:0,expiring:1},hasMore:false};}
      else if(path.includes('/progress?'))data={lessons:[{id:'lesson',title:'Hiragana',chapter:'Bab 1',completed:true}]};
      else if(path.startsWith('/company/operations/students/')){if(window.conflict){status=409;data={error:'operations_version_conflict'};}else {Object.assign(students[0],body,{version:students[0].version+1});data={profile:students[0]};}}
      else if(path.includes('/cases/')&&path.includes('/events'))data={events:[],ok:true};
      else if(path.startsWith('/company/operations/cases?'))data={cases,summary:{open:cases.length,overdue:0},hasMore:false};
      else if(path==='/company/operations/cases'){const item={...body,id:'case',user_id:body.userId,course_id:body.courseId,status:'new',student_name:students[0].full_name,version:1};cases.push(item);data={case:item};}
      else if(path.startsWith('/company/operations/sessions?'))data={sessions:[{id:'session',title:'Latihan percakapan',starts_at:new Date(Date.now()-864e5).toISOString(),status:'completed',recorded:0,attended:0}],hasMore:false};
      else if(path.includes('/attendance?'))data={session:{status:'completed'},students:students.map(s=>({...s,status:null,note:'',eligible:true,version:0})),hasMore:false};
      else if(path.includes('/attendance/'))data={attendance:{version:1}};
      return {ok:status<400,status,json:async()=>data};
    };
    window.workspace=await mountCompanyWorkspace(document.querySelector('#company-workspace'),{user:{id:user},companyAccess:{isAdmin:true,divisions:[{id:'operations',name:'Operasional Siswa'}],scopes:{},flows:{},insights:{enabled:false,scopes:{}},studentOperations:{enabled:true}}});workspace.open('operations');
  </script></html>`));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');let browser;
  t.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.goto(`http://127.0.0.1:${server.address().port}/operations-fixture`);
  await page.getByRole('button',{name:'Ayu — siswa contoh',exact:true}).waitFor();
  await t.test('integrated view loads without hidden legacy actions or duplicated heading',async()=>{
    assert.equal(await page.locator('#title').isVisible(),false);assert.equal(await page.getByRole('heading',{level:1}).count(),1);
    assert.equal(await page.locator('#student-operations h1').isVisible(),true);
    assert.equal(await page.locator('#create-button').isVisible(),false);
  });
  const output=process.env.OPERATIONS_SCREENSHOT_DIR;
  if(output){await mkdir(output,{recursive:true});await page.screenshot({path:output+'/operasional-siswa-desktop.png',fullPage:true});}
  await t.test('profile writes preserve conflict drafts and progress reads do not change it',async()=>{
    await page.getByRole('button',{name:'Ayu — siswa contoh',exact:true}).click();await page.getByRole('button',{name:'Simpan pendampingan'}).waitFor();
    await page.getByLabel('Tujuan belajar',{exact:true}).fill('Target JLPT N5');await page.evaluate(()=>window.conflict=true);
    await page.getByRole('button',{name:'Simpan pendampingan'}).click();await page.getByText('Data sudah diubah anggota lain.',{exact:false}).waitFor();assert.equal(await page.getByLabel('Tujuan belajar',{exact:true}).inputValue(),'Target JLPT N5');
    await page.getByRole('button',{name:'Tutup',exact:true}).click();assert.equal(await page.locator('#ops-dialog').isVisible(),true);
    await page.getByRole('button',{name:'Lihat progres per pelajaran'}).click();await page.locator('#ops-progress').getByText('✓ Hiragana').waitFor();
    await page.evaluate(()=>window.conflict=false);await page.getByRole('button',{name:'Simpan pendampingan'}).click();await page.locator('#ops-dialog').waitFor({state:'hidden'});
  });
  await t.test('records a complaint against the selected student and shows it in the case queue',async()=>{
    await page.getByRole('button',{name:'Ayu — siswa contoh',exact:true}).click();await page.getByRole('button',{name:'Catat layanan / keluhan',exact:true}).click();
    await page.locator('#ops-dialog').getByLabel('Judul',{exact:true}).fill('Jadwal berbenturan');await page.getByLabel('Kategori',{exact:true}).selectOption('schedule');await page.getByRole('button',{name:'Simpan layanan',exact:true}).click();await page.locator('#ops-dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Layanan & keluhan',exact:true}).click();await page.getByRole('button',{name:'Jadwal berbenturan',exact:true}).waitFor();
    const created=await page.evaluate(()=>calls.find(c=>c.path==='/company/operations/cases'&&c.method==='POST'));assert.equal(created.body.userId,'33333333-3333-4333-8333-333333333333');assert.equal(created.body.category,'schedule');
    if(output)await page.screenshot({path:output+'/operasional-siswa-keluhan.png',fullPage:true});
  });
  await t.test('attendance has an explicit unrecorded state and saves only the selected student',async()=>{
    await page.getByRole('button',{name:'Jadwal & absensi',exact:true}).click();await page.getByRole('button',{name:'Latihan percakapan',exact:true}).click();
    await page.getByLabel('Kehadiran',{exact:true}).waitFor();assert.equal(await page.getByLabel('Kehadiran',{exact:true}).inputValue(),'');
    await page.getByLabel('Kehadiran',{exact:true}).selectOption('present');await page.locator('.ops-attendance button').click();await page.getByText('Absensi siswa tersimpan.',{exact:true}).waitFor();await page.getByRole('button',{name:'Tutup',exact:true}).click();await page.locator('#ops-dialog').waitFor({state:'hidden'});
  });
  await t.test('mobile layout stays inside the viewport and failed reads can retry',async()=>{
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Siswa & progres',exact:true}).click();await page.getByRole('button',{name:'Ayu — siswa contoh',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(output)await page.screenshot({path:output+'/operasional-siswa-mobile.png',fullPage:true});
    await page.evaluate(()=>window.failure=true);await page.getByRole('button',{name:'Tampilkan',exact:true}).click();await page.getByRole('button',{name:'Coba lagi',exact:true}).waitFor();
    await page.evaluate(()=>window.failure=false);await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await page.getByRole('button',{name:'Ayu — siswa contoh',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>calls.some(c=>c.path.includes('/orders')||c.path.includes('/user-access/grant'))),false);assert.deepEqual(errors,[]);
  });
});
