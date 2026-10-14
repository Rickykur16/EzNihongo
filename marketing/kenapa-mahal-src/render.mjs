// node render.mjs <dir-keluaran> <full|t1,t2,...>   (sajikan root repo di :8099 dulu)
// Env FONT_DIR = folder fonts.css + woff2 (lihat README). Env OVERLAY=1 = PNG transparan untuk
// compose.py (grafik di atas footage) + scenes.json berisi waktu tiap adegan.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const [out, mode] = [process.argv[2], process.argv[3]];
const FPS = 30;
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1080,height:1920} }); await fontRoutes(p);
p.on('pageerror', e => console.log('ERR', e.message));
const OV = !!process.env.OVERLAY;
await p.goto('http://127.0.0.1:8099/marketing/kenapa-mahal-src/video.html' + (OV ? '?overlay=1' : ''), {waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
const dur = await p.evaluate(()=>window.DUR);
if (OV) { const fs = await import('node:fs'); fs.writeFileSync(`${out}/scenes.json`, JSON.stringify(await p.evaluate(()=>({ dur: window.DUR, scenes: window.__SCENES.map(s=>({a:s.a,b:s.b})) })))); }
const times = mode==='full' ? Array.from({length:Math.round(dur*FPS)},(_,i)=>i/FPS) : mode.split(',').map(Number);
let n=0;
for (const t of times){ await p.evaluate(t=>render(t), t);
  const ext = OV ? 'png' : 'jpg';
  const f = mode==='full'?`${out}/f${String(n).padStart(4,'0')}.${ext}`:`${out}/p_${t}.${ext}`;
  await p.screenshot(OV ? {path:f,type:'png',omitBackground:true} : {path:f,type:'jpeg',quality:92}); n++; if(n%300===0) console.log(n); }
await b.close();
