// node render.mjs <dir-keluaran> <full|t1,t2,...>
// Env: VIDEO=video.html (atau video-9x16.html / video-vo.html), W/H = ukuran viewport (default 1920×1080),
// FRAMES = jumlah frame mode full (default 900 = 30 dtk @30fps).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from './fontroute.mjs';
const [out, mode] = [process.argv[2], process.argv[3]];
const VIDEO = process.env.VIDEO || 'video.html';
const W = +(process.env.W || 1920), H = +(process.env.H || 1080);
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:W,height:H} }); await fontRoutes(p);
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:8099/marketing/brand-video-src/${VIDEO}`, {waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
const NF = +(process.env.FRAMES || 900);
const times = mode==="full" ? Array.from({length:NF},(_,i)=>i/30) : mode.split(',').map(Number);
let n=0;
for (const t of times){ await p.evaluate(t=>render(t), t); const f = mode==='full'?`${out}/f${String(n).padStart(4,'0')}.jpg`:`${out}/p_${t}.jpg`; await p.screenshot({path:f,type:'jpeg',quality:93}); n++; }
await b.close();
