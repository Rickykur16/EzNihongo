// node render.mjs → slide-1.png … slide-7.png (butuh http-server di root repo port 8099 + FONT_DIR)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fontRoutes } from '../brand-video-src/fontroute.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1080,height:1350} }); await fontRoutes(p);
await p.goto('http://127.0.0.1:8099/marketing/carousel-mandiri/carousel.html', {waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
for (let i=1;i<=7;i++) await p.locator('#s'+i).screenshot({path:new URL(`./slide-${i}.png`, import.meta.url).pathname});
await b.close();
