// Tangkap halaman Live Class asli (tab Mendatang & Rekaman) dengan data contoh.
// node shoot-live.mjs <dir-keluaran>  — butuh http-server di :8099 pada root repo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const OUT = process.argv[2] || '.';
const user = { id:'u1', email:'pelajar@example.invalid', fullName:'Rina Pelajar' };
const course = { id:'c1', slug:'n5', title:'Bahasa Jepang N5', level:'Bahasa Jepang N5', progress:{percentage:35,completedLessons:14,totalLessons:40} };
const lesson = (slug,title,ch) => ({ slug, title, section:'Kurikulum', chapter:{ slug:ch, title:'Bab 5: Hari & Waktu' } });
const live = {
  course,
  upcoming: [
    { title:'Live Class Bab 5 — Hari & Waktu', status:'scheduled', startsAt:'2026-10-06T12:30:00Z', endsAt:'2026-10-06T14:00:00Z', description:'Kelas bersama sensei: membaca jam, hari, dan tanggal.', canJoin:true, meetingUrl:'#', relatedLessons:[lesson('kosakata','Kosakata 語彙 — Hari & Waktu','bab-5')] },
    { title:'Live Class Bab 5 — Latihan Percakapan', status:'scheduled', startsAt:'2026-10-09T12:30:00Z', endsAt:'2026-10-09T14:00:00Z', description:'Praktik bertanya jadwal dan membuat janji.', canJoin:false, meetingUrl:'#', relatedLessons:[lesson('tata-bahasa','Tata Bahasa: 〜に (waktu)','bab-5')] },
  ],
  recordings: [
    { title:'Live Class Bab 4 — Kore, Sore, Are', status:'completed', startsAt:'2026-10-02T12:30:00Z', endsAt:'2026-10-02T14:00:00Z', recordingUrl:'#', relatedLessons:[lesson('kosakata','Kosakata 語彙 — Benda di Sekitar','bab-4')] },
    { title:'Live Class Bab 4 — Latihan Percakapan', status:'completed', startsAt:'2026-09-29T12:30:00Z', endsAt:'2026-09-29T14:00:00Z', recordingUrl:'#', relatedLessons:[] },
  ],
  completedWithoutRecording: 0,
};
const b = await chromium.launch();
for (const tab of ['upcoming','recordings']) {
  const p = await b.newPage({ viewport:{width:1000,height:1250}, deviceScaleFactor:1.8, timezoneId:'Asia/Jakarta', locale:'id-ID' });
  await fontRoutes(p);
  await p.route('**/api/**', r => r.fulfill({status:404, contentType:'application/json', body:'{}'}));
  await p.route('**/api/auth/refresh', r => r.fulfill({json:{accessToken:'x', user}}));
  await p.route('**/api/auth/me', r => r.fulfill({json:{user}}));
  await p.route('**/api/progress/quiz/unfinished*', r => r.fulfill({json:{attempt:null}}));
  await p.route('**/api/dashboard/me*', r => r.fulfill({json:{ course, courses:[course] }}));
  await p.route('**/api/live-classes*', r => r.fulfill({json:live}));
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:8099/live.html?course=n5${tab==='recordings'?'&tab=recordings':''}`, {waitUntil:'networkidle'});
  await p.waitForTimeout(1500);
  await p.evaluate(()=>document.querySelectorAll('.maneko-widget,.maneko-panel').forEach(e=>e.style.display='none'));
  await p.screenshot({path:`${OUT}/live-${tab}.png`});
  await p.close();
}
await b.close();
