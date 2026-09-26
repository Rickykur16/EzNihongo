const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');const path=require('path');const assert=require('assert/strict');const vm=require('vm');
const root=path.resolve(__dirname,'../..');const outputs=process.env.MANEKO_OUTPUT_DIR || path.join(require('os').tmpdir(),'eznihongo-maneko-preview');fs.mkdirSync(outputs,{recursive:true});
const reco={hasData:true,categories:[],weakGrammar:[{grammarId:'g1',pattern:'これ／それ／あれ',state:'NEEDS_PRACTICE',score:60,attempts:5,message:'Kamu masih beberapa kali tertukar saat menentukan posisi benda.'},{grammarId:'g2',pattern:'〜の〜',state:'MASTERED',score:100,attempts:8,dueReview:true,message:'Sudah waktunya mengulang pola ini agar tetap ingat.'}],recommendedLessons:[]};
const summary={total:3,byCategory:{kana:2,vocabulary:0,kanji:0,grammar:1}};
const course={id:'c1',slug:'n5',title:'Bahasa Jepang N5',level:'N5',progress:{percentage:35,completedLessons:7,totalLessons:20}};
const dashboard={greetingName:'Ricky',courses:[course],course,continueLearning:{section:'Dasar bahasa Jepang',chapter:{slug:'bab-3',title:'Bab 3'},lesson:{slug:'percakapan',title:'Mengenal benda di sekitarmu'}},review:summary,mastery:{kana:{label:'Sedang dipelajari',percentage:65},vocabulary:{label:'Sedang dipelajari',percentage:55},kanji:{label:'Belum cukup data'},grammar:{label:'Sedang dipelajari',percentage:60}},weeklyActivity:{activeDays:4,lessonsCompleted:3,reviewQuestions:12,accuracy:78},weeklyInsight:{message:'Kamu belajar pada 4 hari minggu ini.'},liveClass:{recentRecordings:[]}};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || undefined});
 const errors=[];
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));let helped=false;let failSummary=false;
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!=='maneko.test')return route.abort();
    let data;
    if(url.pathname.startsWith('/api/')){
     const p=url.pathname.slice(4);
     if(p==='/auth/refresh')data={accessToken:'fixture',user:{id:'user1',email:'test@example.test',fullName:'Ricky'}};
     else if(p==='/auth/me')data={user:{id:'user1',email:'test@example.test',fullName:'Ricky'}};
     else if(p==='/dashboard/me')data=dashboard;
     else if(p==='/review/summary'){if(failSummary)return route.fulfill({status:500,json:{error:'offline'}});data=summary;}
     else if(p==='/recommendations/me')data=reco;
     else if(p==='/review/sessions')data={sessionId:'session-1',questions:[{itemId:'i1',itemType:'kana',category:'kana',lessonId:'l1',question:{prompt:'あ の読み方は？',options:['a','i'],correctIndex:undefined}},{itemId:'i2',itemType:'kana',category:'kana',lessonId:'l1',question:{prompt:'い の読み方は？',options:['i','a']}}]};
     else if(p.endsWith('/help')){helped=true;data={text:'Perhatikan bentuk hurufnya lalu bandingkan kedua pilihan.',assisted:true,level:1};}
     else if(p.endsWith('/answers'))data={passed:true,assisted:helped,evidenceEligible:!helped,correctIndex:0};
     else data={orders:[],version:'test'};
     return route.fulfill({status:200,json:data});
    }
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!target.startsWith(root+path.sep)||!fs.existsSync(target))return route.fulfill({status:404,body:''});
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[path.extname(target)]||'application/octet-stream';
    return route.fulfill({status:200,contentType:type,body:fs.readFileSync(target)});
   });
   await page.goto('http://maneko.test/dashboard.html');
   await page.getByRole('button',{name:'Buka fokus belajar Maneko-chan'}).waitFor();
   assert.equal(await page.locator('.maneko-panel').isVisible(),false);
   await page.getByRole('button',{name:'Buka fokus belajar Maneko-chan'}).click();
   await page.getByRole('heading',{name:'Waktunya mengulang sebentar'}).waitFor();
   const box=await page.locator('.maneko-panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0);
   await page.screenshot({path:path.join(outputs,`maneko-dashboard-${width}.png`),fullPage:true});
   await page.keyboard.press('Escape');assert.equal(await page.locator('.maneko-panel').isVisible(),false);
   await page.getByRole('button',{name:'Buka fokus belajar Maneko-chan'}).click();
   await page.getByRole('link',{name:'Lihat detail',exact:true}).click();
   await page.getByRole('heading',{name:'Saatnya mengulang'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(outputs,`maneko-focus-${width}.png`),fullPage:true});
   await page.goto('http://maneko.test/review.html');
   await page.getByRole('button',{name:'Mulai Smart Review'}).click();
   await page.getByText('Bantuan Maneko-chan',{exact:true}).click();
   await page.getByRole('button',{name:'Minta petunjuk'}).click();
   await page.getByText('Dengan bantuan · jawaban ini tidak mengubah penguasaan atau jadwal review.',{exact:true}).waitFor();
   await page.screenshot({path:path.join(outputs,`maneko-review-${width}.png`),fullPage:true});
   await page.getByRole('button',{name:'a',exact:true}).click();
   await page.getByRole('button',{name:'Lanjut →'}).click();
   await page.getByText('Latihan terbantu · materi ini baru mendapat bantuan.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'i',exact:true}).click();await page.getByRole('button',{name:'Lanjut →'}).click();
   await page.getByRole('heading',{name:'Sesi selesai.'}).waitFor();
   assert.match(await page.locator('#review-app').innerText(),/2 soal dikerjakan dengan bantuan/);
   assert.match(await page.locator('#review-app').innerText(),/sepenuhnya latihan terbantu/);
   failSummary=true;await page.goto('http://maneko.test/dashboard.html');
   await page.getByRole('button',{name:'Buka fokus belajar Maneko-chan'}).click();
   await page.getByRole('heading',{name:'Fokus belajar belum bisa dimuat'}).waitFor();
   failSummary=false;await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await page.getByRole('heading',{name:'Waktunya mengulang sebentar'}).waitFor();
   // Run the actual existing welcome mascot object in a controlled lesson shell.
   const html=fs.readFileSync(path.join(root,'welcome.html'),'utf8');
   for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
   const a=html.indexOf('const S = (window.AISenpai = {');const b=html.indexOf('// ═══════════════════════════════════════════════\n// INIT',a);
   await page.evaluate(()=>{document.querySelector('.maneko-widget')?.remove();document.body.innerHTML='<main>Pelajaran</main>';window.currentState={course:'n5'};window.COURSE_CONTENT={};window.getProgress=()=>({});window.__tutorHidden=false;});
   await page.addScriptTag({url:'http://maneko.test/maneko.js'});
   await page.addScriptTag({content:html.slice(a,b)+'\nAISenpai.init();'});
   await page.locator('.senpai-orb-btn').click();await page.getByRole('heading',{name:'Waktunya mengulang sebentar'}).waitFor();
   await page.getByRole('button',{name:'Tanya materi kepada Maneko'}).click();await page.locator('#senpai-input').waitFor();
   assert.match(await page.locator('#ai-senpai').innerText(),/30 menit/);
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: 390px/1280px, dashboard → focus → review, assisted totals, related-item label, retry, Escape, welcome mascot integration; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
