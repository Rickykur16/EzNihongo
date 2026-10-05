// Tangkap halaman Smart Review asli (tampilan HP) dengan data contoh.
// node shoot-review.mjs <dir-keluaran>  — butuh http-server di :8099 pada root repo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const OUT = process.argv[2] || '.';
const user = { id:'u1', email:'pelajar@example.invalid', fullName:'Rina Pelajar' };
const summary = { total: 12, byCategory: { kana: 2, vocabulary: 5, kanji: 3, grammar: 2 } };
const q = (category, prompt, reading, options) => ({ category, question: { prompt, reading, options } });
const questions = [
  q('vocabulary','学生','がくせい',['murid / pelajar','guru','sekolah','teman']),
  q('vocabulary','先生','せんせい',['murid / pelajar','guru','dokter','karyawan']),
  ...Array.from({length:10},()=>q('vocabulary','電車','でんしゃ',['kereta','mobil','sepeda','bus'])),
];
const answers = [{ passed:true, correctIndex:0 }, { passed:false, correctIndex:1 }];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, locale:'id-ID' });
await fontRoutes(p);
await p.route('**/api/**', r => r.fulfill({status:404, contentType:'application/json', body:'{}'}));
await p.route('**/api/auth/refresh', r => r.fulfill({json:{accessToken:'x', user}}));
await p.route('**/api/auth/me', r => r.fulfill({json:{user}}));
await p.route('**/api/review/summary', r => r.fulfill({json:summary}));
await p.route('**/api/review/sessions', r => r.fulfill({json:{ sessionId:'s1', questions }}));
await p.route('**/api/review/sessions/s1/answers', r => { const i = JSON.parse(r.request().postData()).questionIndex; r.fulfill({json:answers[i]}); });
p.on('pageerror', e => console.log('ERR', e.message));
const hide = () => p.evaluate(()=>document.querySelectorAll('.maneko-widget,.maneko-panel,.maneko-fab,[class*=maneko]').forEach(e=>e.style.display='none'));
await p.goto('http://127.0.0.1:8099/review.html', {waitUntil:'networkidle'});
await p.waitForSelector('#start-mixed'); await hide(); await p.waitForTimeout(400);
await p.screenshot({path:`${OUT}/rv-home.png`});
await p.click('#start-mixed'); await p.waitForSelector('[data-option]'); await hide(); await p.waitForTimeout(300);
await p.mouse.move(5,5); await p.screenshot({path:`${OUT}/rv-q1.png`});
await p.click('[data-option="0"]'); await p.waitForTimeout(250);
await p.screenshot({path:`${OUT}/rv-q1-ok.png`});
await p.waitForFunction(()=>document.querySelector('.progress')?.textContent.includes('SOAL 2')); await p.waitForTimeout(300);
await p.mouse.move(5,5); await p.screenshot({path:`${OUT}/rv-q2.png`});
await p.click('[data-option="0"]'); await p.waitForSelector('#review-next'); await p.waitForTimeout(300);
await p.screenshot({path:`${OUT}/rv-q2-ng.png`});
await b.close();
