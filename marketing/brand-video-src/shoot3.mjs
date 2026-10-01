import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const S = process.argv[2];
const user = { id:'u1', email:'pelajar@example.invalid', fullName:'Rina Pelajar', name:'Rina' };
const dash = {
  greetingName:'Rina',
  course:{ id:'c1', slug:'n5', title:'Bahasa Jepang N5', level:'Bahasa Jepang N5', progress:{percentage:35, completedLessons:14, totalLessons:40} },
  courses:[{id:'c1',slug:'n5',title:'Bahasa Jepang N5'}],
  continueLearning:{ section:'Kurikulum', chapter:{slug:'bab-5',title:'Bab 5: Hari & Waktu'}, lesson:{slug:'kosakata',title:'Kosakata 語彙 — Hari & Waktu'} },
  review:{ total:12, byCategory:{kana:2, vocabulary:5, kanji:3, grammar:2} },
  mastery:{ kana:{percentage:82,label:'Baik'}, vocabulary:{percentage:68,label:'Perlu latihan'}, kanji:{percentage:54,label:'Perlu latihan'}, grammar:{percentage:72,label:'Baik'} },
  weeklyActivity:{ activeDays:4, lessonsCompleted:3, reviewQuestions:28, accuracy:78 },
  weeklyInsight:{ message:'Akurasi latihan naik 5% dibanding 7 hari sebelumnya. Pertahankan ritmenya!' },
  focus:{ title:'Kanji perlu diulang', detail:'3 kanji sering tertukar minggu ini.', action:'review', reviewCategory:'kanji' },
  liveClass:{ next:{ title:'Live Class Bab 5 — Hari & Waktu', startsAt:'2026-10-03T12:00:00Z', canJoin:false }, recentRecordings:[{title:'Bab 4 — Kore, Sore, Are', recordingUrl:'#'}] },
};
async function mock(p){ await fontRoutes(p);
  await p.route('**/api/**', r => r.fulfill({status:404, contentType:'application/json', body:'{}'}));
  await p.route('**/api/auth/refresh', r => r.fulfill({json:{accessToken:'x', user}}));
  await p.route('**/api/auth/me', r => r.fulfill({json:{user}}));
  await p.route('**/api/progress/quiz/unfinished*', r => r.fulfill({json:{attempt:null}}));
  await p.route('**/api/dashboard/me*', r => r.fulfill({json:dash}));
  await p.route('**/api/orders/me', r => r.fulfill({json:{orders:[]}}));
  await p.route('**/api/learning-state', r => r.fulfill({json:{ok:true}}));
  await p.addInitScript(() => { try { localStorage.setItem('ez_continue_backdrop','2'); sessionStorage.setItem('ez_dash_bars_seen','1'); } catch {} });
}
const b = await chromium.launch();
for (const [name, opts] of [['dash',{viewport:{width:1440,height:1100},deviceScaleFactor:1.25}],['m-dash',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
  const p = await b.newPage(opts); await mock(p);
   p.on('response', r=>{ if(/font/.test(r.url())) console.log('RESP',r.status(),r.url().slice(0,90)); }); p.on('pageerror', e=>console.log('ERR',e.message));
  await p.goto('http://127.0.0.1:8099/dashboard.html', {waitUntil:'networkidle'});
  await p.waitForTimeout(2500); console.log(name, await p.evaluate(async()=>{await document.fonts.ready; return [document.fonts.check('700 40px "Shippori Mincho"'), document.fonts.check('16px Inter'), getComputedStyle(document.body).fontFamily, [...document.fonts].filter(f=>f.status==='loaded').length]}));
  if (name==='m-dash'){
    await p.screenshot({path:`${S}/m-nav.png`, clip:{x:0,y:760,width:390,height:84}});
    const info = await p.evaluate(()=>{ const out=[]; for (const el of document.querySelectorAll('body *')){ const cs=getComputedStyle(el); if(cs.position==='fixed'){ const r=el.getBoundingClientRect(); out.push([el.tagName,el.className,Math.round(r.top),Math.round(r.height)]); el.style.visibility='hidden'; } } return out; });
    console.log(info);
    await p.screenshot({path:`${S}/m-dash.png`, fullPage:true});
  } else await p.screenshot({path:`${S}/${name}.png`});
  await p.close();
}
await b.close();
