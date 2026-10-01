// Ambil window.CUES dari halaman video → cues.json (dibaca sfx.py). Env VIDEO, OUT.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const VIDEO = process.env.VIDEO || 'video.html', OUT = process.env.OUT || 'cues.json';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://127.0.0.1:8099/marketing/brand-video-src/${VIDEO}`);
fs.writeFileSync(new URL('./' + OUT, import.meta.url), JSON.stringify(await p.evaluate(() => window.CUES)));
await b.close();
