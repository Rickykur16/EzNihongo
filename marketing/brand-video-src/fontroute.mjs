import fs from 'node:fs';
const D=process.env.FONT_DIR || new URL('./fonts', import.meta.url).pathname;
export async function fontRoutes(p){
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType:'text/css', body: fs.readFileSync(D+'/fonts.css','utf8')}));
  await p.route('**/__fonts/*', r => { const f=r.request().url().split('/').pop(); r.fulfill({contentType:'font/woff2', body: fs.readFileSync(D+'/'+f)}); });
}
