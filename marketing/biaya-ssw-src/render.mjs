// node render.mjs <dir-keluaran> <full|t1,t2,...>   (sajikan root repo di :8099 dulu)
// Env FONT_DIR = folder fonts.css + woff2 (lihat README).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const [out, mode] = [process.argv[2], process.argv[3]];
const FPS = 30;
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1080,height:1920} }); await fontRoutes(p);
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8099/marketing/biaya-ssw-src/video.html', {waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
const dur = await p.evaluate(()=>window.DUR);
const times = mode==='full' ? Array.from({length:Math.round(dur*FPS)},(_,i)=>i/FPS) : mode.split(',').map(Number);
let n=0;
for (const t of times){ await p.evaluate(t=>render(t), t);
  const f = mode==='full'?`${out}/f${String(n).padStart(4,'0')}.jpg`:`${out}/p_${t}.jpg`;
  await p.screenshot({path:f,type:'jpeg',quality:92}); n++; if(n%300===0) console.log(n); }
await b.close();
