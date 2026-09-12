import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import pg from 'pg';
import { insightWindow, protectedRatio, INSIGHTS_SQL, readInsights, closeInsights } from './company-insights.js';
import { applyCompanyMigrations } from '../company-migrations/run.js';

test('Insights uses fixed complete UTC weeks across month/year boundaries', () => {
  assert.deepEqual(insightWindow(new Date('2026-09-12T23:00:00+09:00')), {
    previousStart: '2026-08-24T00:00:00.000Z', start: '2026-08-31T00:00:00.000Z', end: '2026-09-07T00:00:00.000Z',
  });
  assert.equal(insightWindow(new Date('2026-01-01T03:00:00Z')).end, '2025-12-29T00:00:00.000Z');
  assert.equal(insightWindow(new Date('2026-09-07T00:00:00Z')).end, '2026-09-07T00:00:00.000Z');
});

test('Insights suppresses entire ratios for small or empty groups and complements', () => {
  for (const args of [[0,0,0,0,0], [9,9,9,9,0], [1,100,100,1,99], [99,100,100,99,1], [50,100,9,9,0]]) {
    assert.deepEqual(protectedRatio(...args), { status:'insufficient_sample', percent:null, numerator:null, denominator:null });
  }
  assert.deepEqual(protectedRatio(10,20,20,10,10), { status:'available', percent:50, numerator:10, denominator:20 });
  assert.equal(protectedRatio(0,10,10,0,10).percent, 0);
  assert.equal(protectedRatio(10,10,10,10,0).percent, 100);
  assert.doesNotMatch(INSIGHTS_SQL, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
});

test('Insights PostgreSQL aggregates, gates, privacy, and non-mutation', { skip: !process.env.TEST_DATABASE_URL, timeout: 90000 }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname)); assert.match(url.pathname, /test/i);
  const schema = 'insights_test_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href }); await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.href; process.env.JWT_ACCESS_SECRET = 'insights-local-access';
  process.env.JWT_REFRESH_SECRET = 'insights-local-refresh'; process.env.ADMIN_EMAILS = 'owner@example.invalid';
  process.env.COMPANY_WORKSPACE_ENABLED = 'true'; process.env.COMPANY_STAFF_ENABLED = 'true'; process.env.COMPANY_INSIGHTS_ENABLED = 'true';
  const { db } = await import('./db.js');
  const { signAccessToken, signRefreshToken } = await import('./auth.js');
  const { signKanjiAccessToken } = await import('./kanji-auth.js');
  const { default: company } = await import('./routes/company.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    await closeInsights(); await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end();
  });
  await control.query(`
    CREATE TABLE users(id uuid PRIMARY KEY,email text UNIQUE,full_name text);
    CREATE TABLE admin_emails(email text);
    CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text);
    CREATE TABLE modules(id uuid PRIMARY KEY,course_id uuid REFERENCES courses(id));
    CREATE TABLE lessons(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),title text);
    CREATE TABLE orders(id uuid PRIMARY KEY,status text,expires_at timestamptz);
    CREATE TABLE discussions(id uuid PRIMARY KEY);
    CREATE TABLE user_enrollments(user_id uuid REFERENCES users(id),course_id uuid REFERENCES courses(id),enrolled_at timestamptz,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_progress(user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),completed boolean,completed_at timestamptz,note text,PRIMARY KEY(user_id,lesson_id));
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),completed_at timestamptz);
    CREATE TABLE quiz_question_results(id uuid PRIMARY KEY,attempt_id uuid REFERENCES quiz_attempts(id),user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),question_id uuid,is_correct boolean,created_at timestamptz);
    CREATE TABLE practice_attempts(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),course_id uuid REFERENCES courses(id),created_at timestamptz);
    CREATE TABLE grammar_attempts(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),created_at timestamptz,sentence text);
  `);
  await applyCompanyMigrations(control);
  const ids = Object.fromEntries(['owner','technology','academic','marketing','operations','finance','scoped','student','oldrole'].map(k => [k, randomUUID()]));
  for (const [key,id] of Object.entries(ids)) await control.query('INSERT INTO users VALUES ($1,$2,$3)', [id,key+'@example.invalid',key]);
  const c1=randomUUID(), c2=randomUUID(), small=randomUUID(), m1=randomUUID(), m2=randomUUID(), ms=randomUUID(), l1=randomUUID(), l2=randomUUID(), ls=randomUUID();
  for (const [c,m,l,title] of [[c1,m1,l1,'Fixture N5'],[c2,m2,l2,'Other course'],[small,ms,ls,'Small cohort']]) {
    await control.query('INSERT INTO courses VALUES ($1,$2,$3)', [c,title,c]);
    await control.query('INSERT INTO modules VALUES ($1,$2)', [m,c]);
    await control.query('INSERT INTO lessons VALUES ($1,$2,$3)', [l,m,title+' <uji>']);
  }
  const window=insightWindow(), stamp=(base, days)=>new Date(Date.parse(base)+days*86400000).toISOString();
  const students = Array.from({length:31},()=>randomUUID()), question=randomUUID();
  const practice=async(user,lesson,course,at)=>control.query('INSERT INTO practice_attempts VALUES ($1,$2,$3,$4,$5)',[randomUUID(),user,lesson,course,at]);
  const quiz=async(user,lesson,at,correct)=>{
    const id=randomUUID();await control.query('INSERT INTO quiz_attempts VALUES ($1,$2,$3,$4)',[id,user,lesson,at]);
    if(at)await control.query('INSERT INTO quiz_question_results VALUES ($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,user,lesson,question,correct,at]);
  };
  for(let i=0;i<31;i++) {
    const user=students[i]; await control.query('INSERT INTO users VALUES ($1,$2,$3)',[user,`private-${i}@example.invalid`,'Private learner']);
    await control.query('INSERT INTO user_enrollments VALUES ($1,$2,$3)',[user,c1,stamp(window.previousStart,i<20?1:-30)]);
    if(i<10||i>=20&&i<30)await practice(user,l1,c1,stamp(window.previousStart,2));
    if(i<20) {
      await quiz(user,l1,stamp(window.start,5),i>=10);
      await quiz(user,l1,stamp(window.start,6),i<10); // later opposite answers do not inflate accuracy/learners
      await practice(user,l1,c1,stamp(window.start,5)); // overlapping sources are not added as more learners
      if(i<10)await practice(user,null,c1,stamp(window.start,5)); // quality denominator includes course-tagged unmapped records
      await control.query('INSERT INTO grammar_attempts VALUES ($1,$2,$3,$4,$5)',[randomUUID(),user,l1,stamp(window.start,5),'PRIVATE SENTENCE']);
      await practice(user,l1,c2,stamp(window.previousStart,2)); // inconsistent course provenance excluded
      await practice(user,null,c1,stamp(window.previousStart,2)); // unscoped evidence excluded
    }
    await control.query('INSERT INTO user_progress VALUES ($1,$2,$3,NULL,$4)',[user,l1,i<10||i===30,'PRIVATE NOTE']);
    await quiz(user,l1,null,false); // merely starting a quiz is not evidence
    await practice(user,l1,c1,window.end); // exclusive end boundary
    if(i<9) {
      await control.query('INSERT INTO user_enrollments VALUES ($1,$2,$3)',[user,small,stamp(window.previousStart,1)]);
      await quiz(user,ls,stamp(window.start,2),false);
    }
    if(i<20)await quiz(user,l2,stamp(window.start,2),false);
  }
  const sourceTables=['users','courses','modules','lessons','user_enrollments','user_progress','quiz_attempts','quiz_question_results','practice_attempts','grammar_attempts'];
  const snapshot=async()=>{const result={};for(const name of sourceTables)result[name]=(await control.query(`SELECT COALESCE(jsonb_agg(r ORDER BY to_jsonb(r)::text),'[]'::jsonb) AS data FROM ${name} r`)).rows[0].data;return result;};
  const before=await snapshot();
  const app=express();app.use(express.json());app.use('/api/company',company);
  app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  async function request(who,path,body,token) {
    const jwt=token||await signAccessToken(ids[who],who+'@example.invalid');
    const res=await fetch(base+'/api/company'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:res.status,data:await res.json(),headers:res.headers};
  }
  const path=(division,course=c1)=>`/insights?division=${division}&courseId=${course}`;
  for(const who of ['technology','academic','marketing','operations','finance','scoped','oldrole']) {
    const r=await request('owner','/members',{userId:ids[who],role:who==='scoped'?'academic':who==='oldrole'?'marketing':who,scopes:[who==='scoped'?{type:'course',courseId:c1}:{type:'global'}]});assert.equal(r.status,201);
  }
  await t.test('correct 50% ratios, repeat de-duplication and no raw student fields',async()=>{
    const r=await request('technology',path('technology'));assert.equal(r.status,200,JSON.stringify(r.data));
    for(const key of ['activation','retention','completion'])assert.deepEqual(r.data[key],{status:'available',percent:50,numerator:10,denominator:20});
    assert.deepEqual(r.data.dataQuality,{status:'available',percent:67,numerator:20,denominator:30});
    assert.deepEqual(r.data.difficulties,[{lessonId:l1,title:'Fixture N5 <uji>',learners:20,incorrectPercent:50}]);
    assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('vary'),/Authorization/);
    const json=JSON.stringify(r.data);for(const privateValue of ['PRIVATE NOTE','PRIVATE SENTENCE','private-','user_id',...students])assert.ok(!json.includes(privateValue));
    assert.equal(r.data.cached,false);assert.equal((await request('technology',path('technology'))).data.cached,true);
  });
  await t.test('each role needs its own permission; marketing/finance/operations get no lesson details',async()=>{
    for(const who of ['marketing','finance','operations']) {
      const r=await request(who,path(who));assert.equal(r.status,200);assert.equal(r.data.detailAccess,false);assert.equal('difficulties' in r.data,false);
      assert.equal((await request(who,path('academic'))).status,403);
    }
    assert.equal((await request('academic',path('academic'))).data.detailAccess,true);
  });
  await t.test('scope isolation and small groups remain suppressed, including owner',async()=>{
    assert.equal((await request('scoped',path('academic'))).status,200);
    assert.equal((await request('scoped',path('academic',c2))).status,403);
    const r=await request('owner',path('technology',small));assert.equal(r.status,200);
    for(const key of ['activation','retention','completion'])assert.equal(r.data[key].percent,null);
    assert.deepEqual(r.data.difficulties,[]);
    assert.equal((await request('technology',path('technology',c2))).data.difficulties[0].incorrectPercent,100);
  });
  await t.test('fixed filters reject arbitrary dates, learners, malformed scopes and missing courses',async()=>{
    for(const suffix of ['&from=2020-01-01','&userId='+students[0],'&courseId='+c2])assert.equal((await request('technology',path('technology')+suffix)).status,400);
    assert.equal((await request('technology','/insights?division=technology')).status,400);
    assert.equal((await request('technology',path('technology',randomUUID()))).status,404);
  });
  await t.test('students, other realms, refresh and stale identity denied',async()=>{
    assert.equal((await request('student',path('marketing'))).status,403);
    for(const token of [await signKanjiAccessToken(ids.marketing,'marketing@example.invalid'),await signRefreshToken(ids.marketing,randomUUID()),await signAccessToken(ids.marketing,'wrong@example.invalid')])assert.equal((await request('marketing',path('marketing'),null,token)).status,401);
  });
  await t.test('flags, expired membership and role permission are checked even on cache hits',async()=>{
    process.env.COMPANY_INSIGHTS_ENABLED='false';assert.equal((await request('owner',path('technology'))).status,404);
    assert.equal((await request('owner','/access')).data.insights.enabled,false);process.env.COMPANY_INSIGHTS_ENABLED='true';
    process.env.COMPANY_STAFF_ENABLED='false';assert.equal((await request('marketing',path('marketing'))).status,403);process.env.COMPANY_STAFF_ENABLED='true';
    await control.query("UPDATE staff_memberships SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[ids.scoped]);
    assert.equal((await request('scoped',path('academic'))).status,403);
    await control.query("DELETE FROM staff_role_permissions WHERE permission_key='insights.marketing'");
    assert.equal((await request('oldrole',path('marketing'))).status,403);
    assert.equal(Object.hasOwn((await request('oldrole','/access')).data.insights.scopes,'marketing'),false);
    await control.query("INSERT INTO staff_role_permissions(role_key,permission_key) VALUES ('marketing','insights.marketing')");
  });
  await t.test('report reads leave every fixture source row unchanged',async()=>assert.deepEqual(await snapshot(),before));
  await t.test('read-only transaction enforces no writes and schema failure is not an empty report',async()=>{
    await control.query('BEGIN READ ONLY');
    await assert.rejects(control.query('UPDATE user_progress SET completed=FALSE'),e=>e.code==='25006');await control.query('ROLLBACK');
    await closeInsights();
    await control.query('ALTER TABLE quiz_question_results RENAME TO fixture_hidden_results');
    const r=await request('finance',path('finance'));assert.equal(r.status,503);assert.deepEqual(r.data,{error:'insights_unavailable'});
    await control.query('ALTER TABLE fixture_hidden_results RENAME TO quiz_question_results');
    assert.equal((await request('finance',path('finance'))).status,200);
  });
  await t.test('concurrent refresh is bounded; locked tables fail safely without cached zeroes',async()=>{
    await closeInsights();
    await control.query('BEGIN');await control.query('LOCK TABLE quiz_question_results IN ACCESS EXCLUSIVE MODE');
    const pending=readInsights(c1);
    const expected=assert.rejects(pending,e=>e.status===503&&e.message==='insights_unavailable');
    await assert.rejects(readInsights(c2),e=>e.status===503&&e.message==='insights_busy_retry_later');
    await expected;await control.query('ROLLBACK');
    assert.equal((await readInsights(c1)).activation.percent,50);
  });
  if(process.env.COMPANY_BROWSER_QA==='true')await t.test('browser Insights: role views, XSS escape, stale responses and mobile; progress preserved',async()=>{
    const {chromium}=await import(pathToFileURL(process.env.COMPANY_PLAYWRIGHT_MODULE).href);
    for(const file of ['company.html','src/company.js','src/company-desk.js','src/company-insights.js','src/company-insights-guide.js','styles/company.css','styles/tokens.css','api-client.js','logo.png'])app.get('/'+file,(req,res)=>res.sendFile(fileURLToPath(new URL('../../'+file,import.meta.url))));
    const browser=await chromium.launch({executablePath:process.env.COMPANY_BROWSER_EXECUTABLE,headless:true});
    try {
      for(const who of ['academic','marketing']) {
        const context=await browser.newContext({viewport:{width:1440,height:1000}}), errors=[];
        await context.addInitScript(()=>localStorage.setItem('ez_progress','insights-sentinel'));
        const token=await signAccessToken(ids[who],who+'@example.invalid'), user={id:ids[who],email:who+'@example.invalid',fullName:who,isAdmin:false};
        await context.route('**/*',async route=>{
          const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
          if(url.pathname==='/api/auth/refresh')return route.fulfill({json:{accessToken:token,user}});
          if(url.pathname==='/api/auth/me')return route.fulfill({json:{user}});
          return route.continue();
        });
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/company.html');
        await page.getByRole('button',{name:'Data & Insights',exact:true}).click();
        await page.locator('#insights-filters select[name=courseId]').selectOption(c1);
        await page.getByRole('button',{name:'Muat ringkasan',exact:true}).click();
        await page.locator('[data-metric=activation] .insight-value').filter({hasText:'50%'}).waitFor();
        assert.equal(await page.locator('[data-metric=dataQuality] .insight-value').textContent(),'67%');
        assert.equal(await page.locator('#insights-guide details').count(),6);
        assert.equal(await page.locator('#insights-guide a').count(),6);
        await page.locator('#insights-guide summary').filter({hasText:'Apakah siswa benar-benar belajar?'}).click();
        assert.match(await page.locator('#insights-guide details').first().textContent(),/IES/);
        assert.equal(await page.locator('#insights-filters select[name=division] option').count(),1);
        assert.equal(await page.getByRole('heading',{name:'Materi untuk ditinjau',exact:true}).count(),who==='academic'?1:0);
        assert.equal(await page.locator('#insights-report uji').count(),0);
        if(who==='academic'&&process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-insights-desktop.png',fullPage:true});
        await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(who==='academic'&&process.env.COMPANY_QA_OUTPUT_DIR)await page.screenshot({path:process.env.COMPANY_QA_OUTPUT_DIR+'/eznihongo-insights-mobile.png',fullPage:true});
        await page.locator('#insights-filters select[name=courseId]').selectOption(small);
        assert.equal(await page.locator('.insight-card').count(),0);
        await page.getByRole('button',{name:'Muat ringkasan',exact:true}).click();
        await page.locator('[data-metric=activation] .insight-value').filter({hasText:'—'}).waitFor();
        // Delay an in-flight report, leave the view, then return: stale report must not render.
        let release;const barrier=new Promise(r=>{release=r;});let entered;
        const started=new Promise(r=>{entered=r;});
        await page.route('**/api/company/insights?**',async route=>{entered();await barrier;await route.continue();});
        await page.getByRole('button',{name:'Muat ringkasan',exact:true}).click();await started;
        await page.locator('#divisions button').first().click();
        const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/company/insights');release();await response;
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.getByRole('button',{name:'Data & Insights',exact:true}).click();
        assert.equal(await page.locator('.insight-card').count(),0);
        assert.equal(await page.evaluate(()=>localStorage.getItem('ez_progress')),'insights-sentinel');assert.deepEqual(errors,[]);
        await context.close();
      }
    } finally {await browser.close();}
  });
});
