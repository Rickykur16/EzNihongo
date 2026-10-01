import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const [out, mode] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1920,height:1080} }); await fontRoutes(p);
await p.goto('http://127.0.0.1:8099/marketing/brand-video-src/video.html', {waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
const times = mode==='full' ? Array.from({length:900},(_,i)=>i/30) : mode.split(',').map(Number);
let n=0;
for (const t of times){ await p.evaluate(t=>render(t), t); const f = mode==='full'?`${out}/f${String(n).padStart(4,'0')}.jpg`:`${out}/p_${t}.jpg`; await p.screenshot({path:f,type:'jpeg',quality:93}); n++; }
await b.close();
