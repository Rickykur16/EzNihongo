import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {describeLegacyStaffAccess} from './staff-capabilities.js';

// All network requests are intercepted; this never opens a production session.
if(process.env.COMPANY_BROWSER_QA==='true')test('unified admin browser regression: login, disabled Company, original editors and data preservation', {timeout:90000}, async t=>{
  const {chromium}=await import(pathToFileURL(process.env.COMPANY_PLAYWRIGHT_MODULE).href);
  const browser=await chromium.launch({executablePath:process.env.COMPANY_BROWSER_EXECUTABLE,headless:true});
  t.after(()=>browser.close());
  const origin='http://eznihongo.test';
  const files=['admin.html','company.html','api-client.js','src/admin-workspace.js','src/company.js','src/company-productivity.js','src/company-workspace.html','src/company-desk.js','src/company-insights.js','src/company-insights-guide.js','styles/tokens.css','styles/components.css','styles/admin-workspace.css','styles/company.css'];
  const course={id:'11111111-1111-4111-8111-111111111111',slug:'n5',title:'Kursus Uji N5',level:'N5',sort_order:1,is_published:true,is_available:true,is_free:false};
  const lesson={id:'33333333-3333-4333-8333-333333333333',slug:'materi-1',title:'Materi asli siswa',type:'text',content:'Materi asli — jangan diubah',sort_order:1};
  const quiz={id:'44444444-4444-4444-8444-444444444444',slug:'kuis-1',title:'Kuis asli siswa',type:'quiz',sort_order:2,questions_per_attempt:10,cooldown_hours:0};
  const module={id:'22222222-2222-4222-8222-222222222222',slug:'bab-1',title:'Bab pertama',sort_order:1,lessons:[lesson,quiz],vocabulary:[],grammar:[]};
  const original=JSON.stringify({course,module});
  async function scenario(options,check){
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(6000);
    const state={loggedIn:true,student:false,capabilityStatus:200,companyStatus:404,courseFailures:0,moduleFailures:0,...options},calls=[],writes=[],errors=[];
    const user={id:'55555555-5555-4555-8555-555555555555',email:'admin@example.invalid',fullName:'Admin Uji Lokal',isAdmin:!state.student};
    await context.addInitScript(()=>{localStorage.setItem('ez_progress','unified-progress-sentinel');localStorage.setItem('ez_quiz_scores','unified-quiz-sentinel');});
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(url.origin!==origin)return route.abort();
      if(path.startsWith('/api/')){
        calls.push(path);let status=200,body={};
        if(!path.startsWith('/api/auth/')&&request.method()!=='GET')writes.push({path,method:request.method()});
        if(path==='/api/auth/login'){
          const credentials=request.postDataJSON();
          if(credentials.email===user.email&&credentials.password==='fixture-password-only'){state.loggedIn=true;body={accessToken:'fixture-token',user};}
          else{status=401;body={error:'invalid_credentials'};}
        }else if(path==='/api/auth/refresh'){status=state.loggedIn?200:401;body=state.loggedIn?{accessToken:'fixture-token',user}:{error:'No refresh token'};}
        else if(path==='/api/auth/me')body={user};
        else if(path==='/api/tts/version')body={version:'fixture'};
        else if(path==='/api/staff/capabilities'){status=state.capabilityStatus;body=state.access||describeLegacyStaffAccess(!state.student);}
        else if(path==='/api/company/access'){status=state.companyStatus;body={error:status===404?'company_workspace_disabled':'temporarily_unavailable'};}
        else if(path==='/api/admin/courses'){
          if(state.courseFailures-->0){status=503;body={error:'fixture_unavailable'};}else body={courses:[course]};
        }else if(path==='/api/courses/n5'){
          if(state.moduleFailures-->0){status=503;body={error:'fixture_unavailable'};}else body={course:{...course,modules:[module]}};
        }
        else if(path==='/api/admin/video-sources')body={sources:[]};
        else if(path===`/api/admin/lessons/${quiz.id}/quiz`)body={questions:[]};
        else if(path==='/api/admin/orders')body={orders:[],total:0};
        else if(path==='/api/admin/settings/bank-accounts')body={accounts:[]};
        else if(path==='/api/admin/sensei')body={sensei:[]};
        else if(path==='/api/admin/testimonials')body={testimonials:[]};
        else if(path==='/api/admin/live-classes')body={liveClasses:[]};
        else if(path==='/api/admin/users')body={users:[],total:0};
        else if(path==='/api/admin/discussions')body={discussions:[],total:0};
        else if(path==='/api/admin/settings/coaching-note-prompt')body={value:'Prompt uji lokal',default:'Default uji lokal'};
        else if(path==='/api/admin/tts/cache/stats')body={count:0,orphan_count:0,current_count:0,current_version:'fixture'};
        else{status=404;body={error:'fixture_route_not_found'};}
        return route.fulfill({status,json:body});
      }
      if(!files.includes(path.slice(1)))return route.abort();
      return route.fulfill({body:await readFile(new URL('../../'+path.slice(1),import.meta.url)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':'text/css'});
    });
    try{
      await page.goto(origin+(state.entry||'/admin.html'));await check({page,state,calls,writes});
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
      assert.equal(await page.evaluate(()=>localStorage.getItem('ez_progress')),'unified-progress-sentinel');
      assert.equal(await page.evaluate(()=>localStorage.getItem('ez_quiz_scores')),'unified-quiz-sentinel');
      assert.equal(JSON.stringify({course,module}),original);
    }catch(error){error.message+='\nBrowser errors: '+JSON.stringify(errors);throw error;}finally{await context.close();}
  }
  const nav=(page,key)=>({async click(){
    const button=page.locator('#workspace-nav [data-workspace="'+key+'"]');
    await button.waitFor({state:'attached'});
    const group=button.locator('xpath=ancestor::details[1]');
    if(await group.count()&&!await group.evaluate(el=>el.open))await group.locator('summary').click();
    await button.click();
  }});
  await t.test('quick menu search supports keyboard, Indonesian aliases, empty results and mobile without writes',()=>scenario({},async({page})=>{
    await page.locator('#workspace-search-open').waitFor();await page.keyboard.press('Control+k');
    await page.locator('#workspace-search[open]').waitFor();
    await page.locator('#workspace-search-query').fill('pembayaran');
    assert.equal(await page.locator('#workspace-search-results button').count(),1);
    await page.keyboard.press('Enter');await page.getByText('Tidak ada pesanan untuk filter ini.',{exact:true}).waitFor();
    await page.locator('#workspace-search-open').click();await page.locator('#workspace-search-query').fill('<img onerror=alert(1)>');
    assert.equal(await page.locator('#workspace-search-results button').count(),0);
    assert.equal(await page.locator('#workspace-search-results img').count(),0);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#workspace-search').isVisible(),false);
    await page.setViewportSize({width:390,height:844});await page.locator('#workspace-search-open').click();
    await page.locator('#workspace-search-query').fill('audio');await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.searchRoute),'tab:tts');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-productivity-search-mobile.png',fullPage:true});
  }));
  await t.test('quick search cannot discover tools outside the staff capability list',()=>scenario({access:{version:1,authorizationMode:'company-rbac-v1',isAdmin:false,isStaff:true,tabs:['users'],capabilities:['students.manage']}},async({page})=>{
    await page.locator('#workspace-search-open').click();await page.locator('#workspace-search-query').fill('pembayaran');
    assert.equal(await page.locator('#workspace-search-results button').count(),0);
    await page.locator('#workspace-search-query').fill('siswa');assert.equal(await page.locator('#workspace-search-results button').count(),1);
  }));
  await t.test('password login and old workspace URL lead to one shell even with Company disabled',()=>scenario({loggedIn:false,entry:'/company.html'},async({page,calls})=>{
    await page.getByRole('heading',{name:'Masuk Ruang Kerja',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/admin.html');
    await page.locator('#admin-login-form [name=email]').fill('admin@example.invalid');
    await page.locator('#admin-login-form [name=password]').fill('wrong-fixture');await page.locator('#admin-login-form button').click();
    await page.getByText('Email atau password salah.',{exact:true}).waitFor();
    await page.locator('#admin-login-form [name=email]').fill('admin@example.invalid');await page.locator('#admin-login-form [name=password]').fill('fixture-password-only');await page.locator('#admin-login-form button').click();
    await page.locator('#workspace-home h1').waitFor();assert.equal(await page.locator('#workspace-module-status').count(),0);
    assert.doesNotMatch(await page.locator('#workspace-home').textContent(),/bukan kegagalan login|belum diaktifkan|Periksa ulang modul|menggunakan akun serta data/);
    assert.equal(await page.locator('#workspace-nav [data-tab]').count(),12);assert.equal(await page.locator('iframe').count(),0);
    assert.equal(await page.locator('#workspace-nav details[open]').count(),0);
    assert.equal(await page.locator('#workspace-nav summary:visible').count(),5);
    assert.equal(await page.locator('#workspace-nav [data-workspace]:visible').count(),1);
    assert.equal(await page.getByRole('link',{name:'Panel existing',exact:true}).count(),0);assert.ok(!calls.some(p=>p.startsWith('/api/admin/')));
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-unified-admin-desktop.png',fullPage:true});
  }));
  await t.test('division accordion opens only one group and supports keyboard without fetching business data',()=>scenario({},async({page,calls})=>{
    const academic=page.locator('#workspace-nav [data-group=academic]'),finance=page.locator('#workspace-nav [data-group=finance]');
    await academic.locator('summary').focus();await page.keyboard.press('Enter');
    await academic.locator('[data-workspace="tab:courses"]').waitFor();
    assert.equal(await page.locator('#workspace-nav details[open]').count(),1);
    await finance.locator('summary').click();await finance.locator('[data-workspace="tab:orders"]').waitFor();
    assert.equal(await academic.evaluate(el=>el.open),false);
    assert.equal(await page.locator('#workspace-nav details[open]').count(),1);
    await finance.locator('summary').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>!document.querySelector('#workspace-nav details[open]'));
    assert.ok(!calls.some(path=>path.startsWith('/api/admin/')));
  }));
  await t.test('deep links and overview shortcuts reveal only the active division, including mobile',()=>scenario({entry:'/admin.html#view=tab%3Aorders'},async({page})=>{
    await page.getByText('Tidak ada pesanan untuk filter ini.',{exact:true}).waitFor();
    assert.equal(await page.locator('#workspace-nav details[open]').getAttribute('data-group'),'finance');
    assert.equal(await page.locator('#workspace-nav [aria-current=page]').getAttribute('data-workspace'),'tab:orders');
    await nav(page,'home').click();assert.equal(await page.locator('#workspace-nav details[open]').count(),0);
    await page.locator('#workspace-home [data-workspace="tab:courses"]').click();await page.locator('[data-pane=courses] table').waitFor();
    assert.equal(await page.locator('#workspace-nav details[open]').getAttribute('data-group'),'academic');
    await page.setViewportSize({width:390,height:844});await page.locator('#workspace-menu-toggle').click();
    await page.locator('#workspace-nav [data-workspace="tab:courses"]').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-compact-sidebar-mobile.png',fullPage:true});
  }));
  await t.test('course, module, lesson and quiz editors keep original IDs/content without automatic saves',()=>scenario({},async({page,calls})=>{
    await nav(page,'tab:courses').click();await page.locator('[data-pane=courses] table').waitFor();
    await page.locator('[data-pane=courses]').getByRole('button',{name:'Edit',exact:true}).click();
    assert.equal(await page.locator('#course-form [name=title]').inputValue(),course.title);await page.locator('#modal').getByRole('button',{name:'Batal',exact:true}).click();
    await nav(page,'tab:modules').click();await page.locator('#course-picker').selectOption('n5');
    await page.locator('[data-pane=modules]').getByText('Bab pertama',{exact:true}).waitFor();
    await nav(page,'tab:lessons').click();await page.locator('[data-lesson-id="'+lesson.id+'"]').click();
    assert.equal(await page.locator('#drawer-lesson-form [name=title]').inputValue(),lesson.title);
    assert.equal(await page.locator('#drawer-lesson-form [name=content]').inputValue(),lesson.content);
    await page.locator('[data-lesson-id="'+quiz.id+'"]').click();await page.getByRole('button',{name:'Kelola Kuis',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('modal').classList.contains('show'));
    assert.ok(calls.includes('/api/admin/lessons/'+quiz.id+'/quiz'));
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-unified-admin-quiz.png',fullPage:true});
  }));
  await t.test('course to module to lesson shortcuts preserve curriculum context and original content',()=>scenario({},async({page})=>{
    await nav(page,'tab:courses').click();
    await page.locator('[data-pane=courses]').getByRole('button',{name:'Kelola Modul',exact:true}).click();
    await page.locator('[data-pane=modules]').getByText('Bab pertama',{exact:true}).waitFor();
    assert.equal(await page.locator('#course-picker').inputValue(),'n5');
    await page.locator('[data-pane=modules]').getByRole('button',{name:'Materi & Kuis',exact:true}).click();
    await page.locator('[data-lesson-id="'+lesson.id+'"]').click();
    assert.equal(await page.locator('#lesson-module-picker').inputValue(),module.id);
    assert.equal(await page.locator('#drawer-lesson-form [name=content]').inputValue(),lesson.content);
    assert.equal(await page.locator('#workspace-flow [aria-current=step]').getAttribute('data-workspace'),'tab:lessons');
    await page.locator('#workspace-flow [data-workspace="tab:modules"]').click();
    assert.equal(await page.locator('#course-picker').inputValue(),'n5');
    await page.locator('#course-picker').selectOption('');
    await page.locator('#workspace-flow [data-workspace="tab:lessons"]').click();
    assert.equal(await page.locator('#lesson-module-picker').isDisabled(),true);
    assert.equal(await page.locator('[data-lesson-id]').count(),0);
  }));
  await t.test('curriculum shortcut retries the same context after a read failure',()=>scenario({moduleFailures:1},async({page,calls})=>{
    await nav(page,'tab:courses').click();
    await page.locator('[data-pane=courses]').getByRole('button',{name:'Kelola Modul',exact:true}).click();
    await page.locator('[data-pane=modules]').getByRole('button',{name:'Coba lagi',exact:true}).click();
    await page.locator('[data-pane=modules]').getByText('Bab pertama',{exact:true}).waitFor();
    assert.equal(await page.locator('#course-picker').inputValue(),'n5');
    assert.equal(calls.filter(path=>path==='/api/courses/n5').length,2);
  }));
  await t.test('all twelve existing menus expose a short workflow and secondary controls stay folded',()=>scenario({},async({page})=>{
    const menus={courses:'[data-pane=courses] table',modules:'#course-picker',lessons:'#lesson-course-picker',live:'[data-pane=live] .empty',sensei:'[data-pane=sensei] .empty',testimonials:'[data-pane=testimonials] .empty',users:'#users-filter',discussions:'#disc-filter',access:'#ac-email',orders:'#ord-status-filter',tts:'#ttsCacheStatsBox',ai:'#coach-prompt'};
    for(const [tab,ready] of Object.entries(menus)){
      await nav(page,'tab:'+tab).click();await page.locator(ready).waitFor();
      assert.ok(await page.locator('#workspace-flow .workspace-steps li').count()>=2);
    }
    await nav(page,'tab:tts').click();await page.locator('#tts-advanced').waitFor();
    assert.equal(await page.locator('#tts-advanced button').isVisible(),false);
    await nav(page,'tab:users').click();await page.locator('#users-filter').waitFor();
    assert.equal(await page.locator('#users-province-filter').isVisible(),false);
    await page.locator('#users-advanced-filters summary').click();await page.locator('#users-province-filter').waitFor();
    await nav(page,'tab:orders').click();await page.locator('#ord-status-filter').waitFor();
    assert.equal(await page.locator('#ord-status-filter').inputValue(),'awaiting_review');
    assert.equal(await page.locator('#bank-accounts-rows').isVisible(),false);
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-menu-flow-finance.png',fullPage:true});
    await page.locator('#order-bank-settings summary').click();
    await page.getByRole('button',{name:'+ Rekening',exact:true}).click();
    assert.equal(await page.locator('[data-bank-row]').count(),1);
  }));
  await t.test('Finance stays in the same page and uses existing payment routes',()=>scenario({},async({page,calls})=>{
    await nav(page,'tab:orders').click();await page.getByText('Tidak ada pesanan untuk filter ini.',{exact:true}).waitFor();
    assert.ok(calls.includes('/api/admin/orders'));assert.ok(calls.includes('/api/admin/settings/bank-accounts'));assert.ok(!calls.includes('/api/admin/courses'));
    assert.equal(new URL(page.url()).pathname,'/admin.html');
  }));
  await t.test('unavailable Company service does not disable authorized admin tools',()=>scenario({companyStatus:503},async({page})=>{
    await page.locator('#workspace-home h1').waitFor();assert.equal(await page.locator('#workspace-module-status').count(),0);
    await nav(page,'tab:courses').click();await page.locator('[data-pane=courses] table').waitFor();
  }));
  await t.test('invalid access fails closed and students never request business data',()=>scenario({student:true},async({page,calls})=>{
    await page.getByText('Akses admin belum dapat diverifikasi.',{exact:false}).waitFor();
    assert.ok(!calls.some(p=>p.startsWith('/api/admin/')||p.startsWith('/api/company/')));assert.equal(await page.locator('#workspace-nav').count(),0);
  }));
  await t.test('a failed course load retries without losing existing navigation',()=>scenario({courseFailures:1},async({page,calls})=>{
    await nav(page,'tab:courses').click();await page.locator('[data-pane=courses]').getByRole('button',{name:'Coba lagi',exact:true}).click();
    await page.locator('[data-pane=courses] table').waitFor();assert.equal(calls.filter(p=>p==='/api/admin/courses').length,2);
  }));
  await t.test('mobile division drawer and overview remain usable without horizontal page overflow',()=>scenario({},async({page})=>{
    await page.locator('#workspace-home h1').waitFor();await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#workspace-menu-toggle').click();await nav(page,'tab:orders').click();await page.getByText('Tidak ada pesanan untuk filter ini.',{exact:true}).waitFor();
    assert.equal(await page.locator('#workspace-sidebar').isVisible(),false);
    await page.locator('#workspace-menu-toggle').click();await nav(page,'home').click();
    if(process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-unified-admin-mobile.png',fullPage:true});
  }));
});
