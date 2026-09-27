(() => {
  // Post-load motion styles (see index.html). Requested here, after parsing, so the download
  // does not compete with the render-blocking landing.css; keep the version in step with it.
  const motionCss=document.createElement('link');motionCss.rel='stylesheet';motionCss.href='landing-motion.css?v=20260927-motion';document.head.append(motionCss);
  const learningTabs=[...document.querySelectorAll('.learning-tab')],learningPanels=[...document.querySelectorAll('.learning-panel')];
  function selectLearning(tab){learningTabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1});learningPanels.forEach(p=>p.hidden=p.id!==tab.getAttribute('aria-controls'))}
  learningTabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectLearning(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(i+1)%learningTabs.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(i+learningTabs.length-1)%learningTabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=learningTabs.length-1;else return;e.preventDefault();selectLearning(learningTabs[next]);learningTabs[next].focus()})});
  function orientLearning(){document.querySelector('.learning-tabs').setAttribute('aria-orientation',innerWidth>600&&innerWidth<=1000?'horizontal':'vertical')}
  orientLearning();window.addEventListener('resize',orientLearning);
  const screenDialog=document.querySelector('#screen-dialog'),screenImage=document.querySelector('#screen-dialog-image');let screenOpener;
  document.querySelectorAll('[data-expand]').forEach(b=>b.addEventListener('click',()=>{screenOpener=b;const panel=document.querySelector('#learn-panel-'+b.dataset.expand),img=panel.querySelector('img');screenImage.src=img.src;screenImage.alt=img.alt;document.querySelector('#screen-dialog-title').textContent=panel.querySelector('.screen-bar>span').textContent;screenDialog.showModal();document.querySelector('.screen-zoom').scrollTo(0,0)}));
  screenDialog.addEventListener('close',()=>screenOpener?.focus({preventScroll:true}));
  const menu=document.querySelector('.menu-button'),mobile=document.querySelector('#mobile-menu');
  function closeMenu(){mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Buka menu')}
  menu.addEventListener('click',()=>{const open=mobile.hidden;mobile.hidden=!open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Tutup menu':'Buka menu')});
  mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobile.hidden){closeMenu();menu.focus()}});
  window.addEventListener('resize',()=>{if(innerWidth>800)closeMenu()});
  let highlightTimer;
  function focusProgram(){const offer=document.querySelector('#bootcamp');offer.classList.add('highlighted');offer.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});clearTimeout(highlightTimer);highlightTimer=setTimeout(()=>offer.classList.remove('highlighted'),5000)}
  document.querySelectorAll('[data-stage]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();focusProgram()}));
  const dialog=document.querySelector('#program-dialog'),stage=document.querySelector('#stage');
  const needs={pemula:'Bahas kemampuan awal dan targetmu untuk mulai bootcamp. Kamu mendapat kelas online bersama sensei 2 kali seminggu serta dashboard untuk mengulang materi dan latihan di luar kelas.',rutinitas:'Bahas kecocokan 2 pertemuan online setiap minggu dengan pekerjaan atau kuliahmu. Dashboard yang termasuk dalam bootcamp memberi ruang untuk belajar dan review sesuai ritmemu di luar kelas.',karier:'Bahas kemampuan bahasa saat ini dan target kariermu untuk menentukan kebutuhan belajar di bootcamp. Tanyakan juga cakupan pendampingan tahap berikutnya, seperti SSW, wawancara, dan job matching.'};
  function updateRecommendation(){document.querySelector('#result-title').textContent='Bootcamp Bahasa Jepang';document.querySelector('#result-copy').textContent=needs[stage.value]}
  let opener;
  function openDialog(button){opener=button;closeMenu();stage.value=button.closest('.career')?'karier':'pemula';document.querySelector('#dialog-title').textContent='Diskusikan bootcamp-mu';updateRecommendation();dialog.showModal()}
  document.querySelectorAll('[data-program]').forEach(b=>b.addEventListener('click',()=>openDialog(b)));
  document.querySelectorAll('[data-consult]').forEach(b=>b.addEventListener('click',()=>openDialog(b)));
  document.addEventListener('landing:consult',event=>{if(event.detail?.opener instanceof HTMLElement)openDialog(event.detail.opener)});
  stage.addEventListener('change',updateRecommendation);
  dialog.addEventListener('close',()=>{if(opener)opener.focus({preventScroll:true})});
  document.querySelector('#see-program').addEventListener('click',()=>{dialog.close();focusProgram()});
  const scenes=[
    {title:'Mimpinya sudah<br>sampai Jepang.',copy:'Tapi langkah pertama masih tertahan biaya.'},
    {title:'Ingin hidup lebih baik.<br><em>Ingin membantu keluarga.</em>',copy:'Lalu kamu mulai menghitung: belajar, ujian, dokumen, dan perjalanan.'},
    {title:'Belum berangkat.<br><em>Sudah terasa berat.</em>',copy:'Apakah rencanamu harus berhenti sampai di sini?'},
    {title:'Kamu punya tujuan.<br><em>Belajarnya punya arahan.</em>',copy:'Kelas online bersama sensei 2 kali seminggu. Di luar kelas, lanjutkan lewat dashboard sesuai ritmemu.'},
    {title:'Pahami tahapannya.<br><em>Hitung kebutuhanmu.</em>',copy:'Bedakan biaya program, persyaratan, dan perjalanan. Cari bagian yang bisa disiapkan sendiri.'},
    {title:'Jepang tetap tujuanmu.<br><em>Sekarang, siapkan langkahnya.</em>',copy:'Bangun bekal bahasa lewat bootcamp dan dashboard belajar. Lalu siapkan tahap karier berikutnya.'}
  ];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),story=document.querySelector('.story'),frame=story.querySelector('.story-frame'),stageEl=document.querySelector('#story-stage'),title=document.querySelector('#scene-title'),copy=document.querySelector('#scene-copy'),counter=document.querySelector('#scene-count'),transcript=document.querySelector('#story-transcript'),header=document.querySelector('.header');
  let index=0,target=0,swapping=false,timer=null,transition=null,inView=false,pinned=false,pinFrame=0,headerHeight=0,motionCssOk=true;
  function stop(){clearTimeout(timer);clearTimeout(transition);timer=null;transition=null;swapping=false;stageEl.classList.remove('changing')}
  function splitLines(el,html){el.innerHTML=html.split(/<br\s*\/?>/i).map(line=>'<span class="ln"><span>'+line.trim()+'</span></span>').join(' ');el.querySelectorAll('.ln').forEach((ln,i)=>ln.style.setProperty('--li',i))}
  function update(){splitLines(title,scenes[index].title);copy.textContent=scenes[index].copy;counter.textContent=String(index+1).padStart(2,'0')+' / 06'}
  // Fade the current scene out, then let the next one rise in (or drop in when going back).
  function show(next){
    target=next;if(swapping||target===index)return;
    swapping=true;clearTimeout(timer);stageEl.classList.add('changing');
    transition=setTimeout(()=>{
      stageEl.classList.toggle('is-back',target<index);index=target;update();
      title.style.setProperty('--rd','0ms');copy.style.setProperty('--rd','180ms');copy.style.animation='none';void copy.offsetWidth;copy.style.animation='';
      stageEl.classList.remove('changing');swapping=false;
      if(target!==index)show(target);else schedule();
    },300);
  }
  function canAdvance(){return !pinned&&inView&&!document.hidden&&!reduced.matches&&index<scenes.length-1&&!story.contains(document.activeElement)}
  function schedule(){clearTimeout(timer);if(canAdvance())timer=setTimeout(()=>show(index+1),6000)}
  // Pinned story: the frame sticks under the header and scroll position picks the scene,
  // so readers set the pace instead of a timer. Short screens keep the timed version.
  const tallEnough=matchMedia('(min-height: 600px)');
  function measurePin(){
    pinFrame=0;if(!pinned)return;
    if(header.offsetHeight!==headerHeight){headerHeight=header.offsetHeight;story.style.setProperty('--hh',headerHeight+'px')}
    const travel=story.offsetHeight-frame.offsetHeight,p=travel>0?Math.min(1,Math.max(0,(headerHeight-story.getBoundingClientRect().top)/travel)):0;
    story.style.setProperty('--p',p.toFixed(4));
    show(Math.min(scenes.length-1,Math.floor(p*scenes.length)));
  }
  const onPinScroll=()=>{if(!pinFrame)pinFrame=requestAnimationFrame(measurePin)};
  function setPinned(on){
    if(on===pinned)return;pinned=on;story.classList.toggle('is-pinned',on);
    if(on){addEventListener('scroll',onPinScroll,{passive:true});addEventListener('resize',onPinScroll);motionCss.addEventListener('load',onPinScroll);measurePin()}
    else{removeEventListener('scroll',onPinScroll);removeEventListener('resize',onPinScroll);motionCss.removeEventListener('load',onPinScroll);story.style.removeProperty('--p')}
  }
  scenes.forEach(scene=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.innerHTML=scene.title.replace('<br>',' ');p.append(strong,document.createTextNode(scene.copy));transcript.append(p)});
  // The complete story remains available to screen readers without changing announcements.
  stageEl.setAttribute('aria-hidden','true');
  function motionPreference(){stop();stageEl.hidden=reduced.matches;counter.hidden=reduced.matches;transcript.classList.toggle('sr-only',!reduced.matches);setPinned(motionCssOk&&!reduced.matches&&tallEnough.matches&&'IntersectionObserver' in window);schedule()}
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)schedule();else if(!pinned)stop()},{threshold:.3}).observe(story);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{schedule();if(pinned)onPinScroll()}});
  // Without its stylesheet the pinned layout cannot exist; fall back to the timed story.
  motionCss.addEventListener('error',()=>{motionCssOk=false;motionPreference()});
  story.addEventListener('focusin',()=>{if(!pinned)stop()});story.addEventListener('focusout',()=>setTimeout(schedule,0));
  reduced.addEventListener('change',motionPreference);tallEnough.addEventListener('change',motionPreference);motionPreference();
  // Scroll reveals. Progressive enhancement only: nothing is hidden unless this observer
  // exists to reveal it again, anything already on screen is left alone because it may
  // have painted, and focus, printing, and a switch to reduced motion reveal immediately.
  const sentinel=document.createElement('div');
  sentinel.setAttribute('aria-hidden','true');sentinel.style.cssText='position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';document.body.prepend(sentinel);
  new IntersectionObserver(([entry])=>header.classList.toggle('is-scrolled',!entry.isIntersecting)).observe(sentinel);
  if(!reduced.matches){
    const pending=new Set(),rootEl=document.documentElement;
    // Targets entering together cascade in document order, capped so late items never wait long.
    const io=new IntersectionObserver(entries=>entries.filter(e=>e.isIntersecting).map(e=>e.target).sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1).forEach((el,i)=>reveal(el,Math.min(i,6)*90)),{rootMargin:'0px 0px -8% 0px'});
    function reveal(el,delay){pending.delete(el);io.unobserve(el);el.style.setProperty('--rd',delay+'ms');el.classList.add('is-in')}
    function register(el,type,fresh){
      if(el.dataset.reveal)return;
      const r=el.getBoundingClientRect();
      if(!fresh&&r.height&&r.bottom>0&&r.top<innerHeight)return;
      if(type==='lines'&&!el.querySelector('.ln'))splitLines(el,el.innerHTML);
      el.dataset.reveal=type;pending.add(el);io.observe(el);
    }
    [['main section:not(.hero):not(.start-strip) h2','lines'],
     ['main section:not(.hero):not(.start-strip) .eyebrow,#scene-count,#scene-copy,.story-bridge,.section-head>p,.bootcamp-offer,.program-note,.cms-courses>h3,#course-status,.learning-tab,.learning-extra,.learning-choices>.text-link,.learning-screens,.pathways,.split-copy>.section-lead,.career-options button,.split-copy>.fine,.cost-grid>div>p,.cost-section li,.faq-grid .text-link,.faq-items details,.closing p:not(.eyebrow),.closing-actions,.closing-login','up'],
     ['.editorial-photo','image'],['.journey-grid li','draw']
    ].forEach(([selector,type])=>document.querySelectorAll(selector).forEach(el=>register(el,type)));
    rootEl.classList.add('has-motion');
    // Course, sensei, and testimonial cards arrive later from the CMS; they have never painted.
    const cards=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1&&n.classList.contains('cms-card'))register(n,'up',true)})));
    document.querySelectorAll('.cms-grid').forEach(grid=>cards.observe(grid,{childList:true}));
    const revealAll=()=>pending.forEach(el=>reveal(el,0));
    document.addEventListener('focusin',e=>pending.forEach(el=>{if(el.contains(e.target))reveal(el,0)}));
    addEventListener('beforeprint',revealAll);
    reduced.addEventListener('change',()=>{if(reduced.matches){revealAll();cards.disconnect();rootEl.classList.remove('has-motion')}});
  }
  update();updateRecommendation();
})();
