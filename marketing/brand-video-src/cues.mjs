// Ambil window.CUES dari video.html → cues.json (dibaca sfx.py).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8099/marketing/brand-video-src/video.html');
fs.writeFileSync(new URL('./cues.json', import.meta.url), JSON.stringify(await p.evaluate(() => window.CUES)));
await b.close();
