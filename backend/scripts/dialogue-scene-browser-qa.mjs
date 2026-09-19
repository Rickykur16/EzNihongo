import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(process.env.EZ_QA_NODE_PACKAGE || import.meta.url);
const {chromium} = require('playwright');
const {PNG} = require('pngjs');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.EZ_QA_OUTPUT || path.join(repo,'backend/.qa');
await fs.mkdir(output,{recursive:true});
const admin=await fs.readFile(path.join(repo,'admin.html'),'utf8');
const welcome=await fs.readFile(path.join(repo,'welcome.html'),'utf8');
function slice(html,start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
const studentSource=slice(welcome,'window.__gk =','// ── ANALISIS BUNPOU');
const adminSource=slice(admin,'const DIALOG_SPK_RE =','// === Multi contoh grammar');
const modalSource=slice(admin,'let _modalDirty = false;', '// User-initiated dismiss');
const styles=[...welcome.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const fixture=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles/tokens.css"><link rel="stylesheet" href="/styles/components.css"><style>${styles}
body{display:block!important;background:#f4f6f5!important;margin:0!important;min-height:100vh;padding:16px!important;box-sizing:border-box}main{max-width:850px;margin:auto}.qa-title{font:600 18px system-ui;margin:0 0 16px}.qa-note{font:12px system-ui;color:#666}#modal-content{background:white;padding:16px;max-width:640px;margin:auto;box-sizing:border-box;width:100%}#modal-content textarea{max-width:100%}input,select,button,textarea{font-family:system-ui;max-width:100%;box-sizing:border-box}select,input,button{padding:7px}.modal-actions{display:flex;gap:8px;margin-top:12px}.btn{cursor:pointer;border:1px solid #ccc;background:white;border-radius:4px}.btn-primary{background:#b81e18;color:white}#saved-row{display:none}
</style><link rel="stylesheet" href="/styles/dialogue-scene.css"><main><h1 class="qa-title">Dialog Bunpou</h1><p class="qa-note">Pratinjau integrasi lokal. Data uji; suara ElevenLabs belum terhubung.</p><div id="student"></div><div id="modal"><div id="modal-content"></div></div><table id="saved-row"><tr><td><textarea name="example_dialog"></textarea><textarea name="example_dialog_id"></textarea><textarea name="dialog_scene"></textarea></td></tr></table></main>
<script src="/assets/dialogue/catalog.js"></script><script src="/src/dialogue-scene.js"></script><script src="/src/admin-dialogue-scene.js"></script>
<script>window.escapeHtml=EzDialogue.esc;window.notify=(text)=>{window.lastNotice=text};window.modal=document.getElementById('modal');window.modalContent=document.getElementById('modal-content');${modalSource}</script><script>${studentSource}</script><script>${adminSource}</script>
<script>
window.__dialogSpeakers=EZ_DIALOGUE_CATALOG.characters.map((c,i)=>({id:'profile-'+i,name:c.name,character_key:c.key,default_display_name:c.displayName,voice_id:'voice'+i,voice_name:'Suara contoh '+(i+1),profile_version:1}));
window.__elevenVoices=__dialogSpeakers.map(p=>({voiceId:p.voice_id,name:p.voice_name,labels:{language:'Japanese'}}));
window.api=async(url,opts)=>{if(url==='/admin/elevenlabs/voices')return{voices:__elevenVoices};if(url==='/admin/dialogue-speakers')return{speakers:__dialogSpeakers};if(url.startsWith('/admin/dialogue-speakers/')&&opts?.method==='PUT'){const p=__dialogSpeakers.find(p=>p.id===url.split('/').pop()),b=JSON.parse(opts.body);Object.assign(p,{default_display_name:b.displayName,voice_id:b.voiceId,voice_name:__elevenVoices.find(v=>v.voiceId===b.voiceId)?.name||'',profile_version:p.profile_version+1});return{speaker:p};}throw Error(url)};
window.__dialogRows=admParseDialogPair('N: 学校で話しています。\\nA: 今日、図書館へ行きますか。\\nB: はい、三時ごろ行きます。','N: Di sekolah.\\nA: Hari ini ke perpustakaan?\\nB: Ya, sekitar pukul tiga.');
window.__dialogTr=document.querySelector('#saved-row tr');window.__dialogTargetTa={jp:__dialogTr.querySelector('[name="example_dialog"]'),id:__dialogTr.querySelector('[name="example_dialog_id"]')};
window.__dialogScene=null;EzDialogueAdmin.toggle(true);
window.renderStudent=()=>{const pair=admSerializeDialogPair(__dialogRows);document.getElementById('student').innerHTML='<div class="grammar-dialog-block grammar-collapsible"><button onclick="grammarBlockToggle(this)">Dialog contoh</button>'+grammarKaraokeHtml(pair.jp,'qa',pair.id,__dialogScene,'11111111-1111-4111-8111-111111111111')+'</div>';EzDialogue.mount(document.getElementById('student'));};renderStudent();
</script></html>`;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'||url.pathname==='/preview.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;}
    const file=path.resolve(repo,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(repo+path.sep))throw Error('outside root');
    const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(process.env.EZ_QA_SERVE ? Number(process.env.EZ_QA_SERVE) : 0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
console.log(base+'/preview.html');
if(!process.env.EZ_QA_SERVE){
const browser=await chromium.launch({headless:true,...(process.env.EZ_QA_BROWSER ? {executablePath:process.env.EZ_QA_BROWSER}: {})});
try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],assets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/\.(webp|png)$/.test(r.url()))assets.push(r);});
  await page.goto(base);await page.waitForFunction(()=>[...document.querySelectorAll('.ez-dialog-actor img')].every(i=>i.complete&&i.naturalWidth&&getComputedStyle(i).visibility==='visible'));
  const slots=page.locator('.ez-scene-slot');
  await slots.nth(0).getByLabel('Pemeran',{exact:true}).selectOption('daniel-foster');
  assert.equal(await slots.nth(0).getByLabel('Nama tampilan',{exact:true}).inputValue(),'ダニエル');
  await slots.nth(0).getByLabel('Kustom dialog ini',{exact:true}).check();
  await slots.nth(0).getByLabel('Nama tampilan',{exact:true}).fill('Daniel Sensei');
  await slots.nth(0).getByLabel('Suara',{exact:true}).selectOption('voice2');
  await page.getByRole('button',{name:'Taman',exact:true}).click();
  await page.evaluate(()=>{admDialogSave();const saved=__dialogTr.querySelector('[name="dialog_scene"]').value;EzDialogueAdmin.load(__dialogTr);if(JSON.stringify(__dialogScene)!==saved)throw Error('round trip');admRenderDialogModal();renderStudent();});
  assert.equal(await slots.nth(0).getByLabel('Nama tampilan',{exact:true}).inputValue(),'Daniel Sensei');
  assert.equal(await slots.nth(0).getByLabel('Suara',{exact:true}).inputValue(),'voice2');
  await slots.nth(0).getByRole('button',{name:'Profil Daniel Foster',exact:true}).click();
  await page.getByLabel('Nama tampilan bawaan').fill('Daniel Baru');
  await page.getByLabel('Suara bawaan').selectOption('voice4');
  await page.getByRole('button',{name:'Simpan profil',exact:true}).click();
  assert.equal(await slots.nth(0).getByLabel('Nama tampilan',{exact:true}).inputValue(),'Daniel Sensei');
  await slots.nth(0).getByRole('button',{name:'Gunakan profil terbaru'}).click();
  assert.equal(await slots.nth(0).getByLabel('Nama tampilan',{exact:true}).inputValue(),'Daniel Baru');
  await slots.nth(0).getByLabel('Pemeran',{exact:true}).selectOption('anna-wijaya');
  await page.getByRole('button',{name:'Kelas',exact:true}).click();
  await page.evaluate(()=>renderStudent());
  // Audio events are controlled, so waiting/rejection/races are deterministic and free of provider cost.
  await page.evaluate(()=>{
    window.Audio=class extends EventTarget{constructor(src){super();this.src=src;this.paused=true;window.lastAudio=this;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}};
    window.fetch=async()=>({ok:true,json:async()=>({segments:[0,1,2].map(()=>({audio_base64:'fixture',content_type:'audio/mpeg'}))})});
  });
  const stage=page.locator('#student .ez-dialog-stage');
  await page.evaluate(()=>grammarKaraokeJumpTo('qa',1));
  assert.equal(await stage.getAttribute('data-state'),'idle');
  await page.evaluate(()=>lastAudio.dispatchEvent(new Event('playing')));
  assert.equal(await stage.getAttribute('data-state'),'speaking');
  assert.equal(await page.locator('#student .ez-dialog-actor.is-speaking').getAttribute('data-position'),'left');
  await page.evaluate(()=>grammarKaraokePlay('qa'));assert.equal(await stage.getAttribute('data-state'),'paused');
  await page.evaluate(()=>{grammarKaraokePlay('qa');lastAudio.dispatchEvent(new Event('playing'));lastAudio.dispatchEvent(new Event('waiting'));});
  assert.equal(await stage.getAttribute('data-state'),'paused');
  await page.evaluate(()=>{lastAudio.dispatchEvent(new Event('playing'));lastAudio.dispatchEvent(new Event('ended'));});
  assert.equal(await stage.getAttribute('data-state'),'idle');
  await page.evaluate(()=>{grammarKaraokeJumpTo('qa',2);lastAudio.dispatchEvent(new Event('playing'));});
  assert.equal(await page.locator('#student .ez-dialog-actor.is-speaking').getAttribute('data-position'),'right');
  await page.evaluate(()=>lastAudio.dispatchEvent(new Event('error')));assert.equal(await stage.getAttribute('data-state'),'idle');
  assert.equal(await page.locator('#student .gk-status').textContent(),'Audio tidak tersedia');
  await page.evaluate(()=>{gkStopAll();window.fetch=()=>new Promise(resolve=>{window.resolveAudio=resolve});grammarKaraokePlay('qa');gkStopAll();renderStudent();resolveAudio({ok:true,json:async()=>({segments:[{audio_base64:'late'}]})});});
  assert.equal(await page.evaluate(()=>Object.keys(__gk).length),0);
  assert.equal(await stage.getAttribute('data-state'),'idle');
  console.log('PASS admin snapshot round trip, profile reuse, audio play/pause/wait/ended/error, late-response lesson switch');
  for(const width of [360,390,768,1280]){
    await page.setViewportSize({width,height:1000});
    await page.waitForFunction(()=>[...document.querySelectorAll('.ez-dialog-actor img')].every(i=>i.complete&&i.naturalWidth&&getComputedStyle(i).visibility==='visible'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
    await page.screenshot({path:path.join(output,`Paket4_Implementasi_${width}.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>EzDialogue.sync(document.getElementById('gk-qa'),1,'speaking'));
  assert.equal(await page.locator('#student .ez-dialog-actor.is-speaking').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Changing the backdrop must not change solid character pixels.
  await page.evaluate(()=>{EzDialogue.sync(document.getElementById('gk-qa'),-1,'idle');document.querySelector('#student .ez-dialog-backdrop').style.display='none';});
  const point=await page.locator('#student .ez-dialog-actor img').first().evaluate(i=>{const r=i.getBoundingClientRect(),scale=Math.min(r.width/i.naturalWidth,r.height/i.naturalHeight);return{x:Math.floor(r.x+r.width/2),y:Math.floor(r.bottom-i.naturalHeight*scale*.45)};});
  const rgb=[];
  for(const color of ['#ff00ff','#00ffff']){await stage.evaluate((e,c)=>e.style.background=c,color);const png=PNG.sync.read(await page.screenshot());rgb.push([...png.data.subarray((point.y*png.width+point.x)*4,(point.y*png.width+point.x)*4+3)]);}
  assert.deepEqual(rgb[0],rgb[1]);
  await page.route('**/anna.webp',r=>r.fulfill({status:404,body:''}));
  await page.evaluate(()=>{renderStudent();const img=document.querySelector('#student .ez-dialog-actor img');img.src='/assets/dialogue/anna.webp?broken=1';});
  await page.route('**/anna.webp?broken=1',r=>r.fulfill({status:404,body:''}));
  await page.evaluate(()=>document.querySelector('#student .ez-dialog-actor img').dispatchEvent(new Event('error')));
  assert.equal(await stage.isVisible(),false);assert.equal(await page.locator('#student .gk-line').count(),2);
  await page.evaluate(async()=>{
    openModal('<table><tr><td><input name="pattern" value="Unsaved pattern"><textarea name="example_dialog">A: Hello\nB: Hi</textarea><textarea name="example_dialog_id"></textarea><textarea name="dialog_scene"></textarea><button id="open-dialog">Dialog</button></td></tr></table>');
    const row=modalContent.querySelector('tr');
    await grmrManageDialog(document.getElementById('open-dialog'));
    EzDialogueAdmin.toggle(true);admDialogSave();
    if(!row.isConnected || !row.querySelector('[name="dialog_scene"]').value || row.querySelector('[name="pattern"]').value!=='Unsaved pattern')throw Error('Parent grammar row lost');
  });
  console.log('PASS nested grammar modal returns live editable row after dialog save');
  assert.deepEqual(errors,[]);
  const unique=new Map();for(const r of assets)if(r.ok())unique.set(r.url(),(await r.body()).length);
  console.log('PASS 360/390/768/1280px, reduced motion, opaque clothing, image failure preserves transcript');
  console.log('Observed asset response bytes:',JSON.stringify(Object.fromEntries(unique)));
}finally{await browser.close();server.close();}
}
