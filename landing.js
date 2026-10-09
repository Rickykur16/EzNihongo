(() => {
  // Post-load motion styles (see index.html). Requested here, after parsing, so the download
  // does not compete with the render-blocking landing.css; keep the version in step with it.
  const motionCss=document.createElement('link');motionCss.rel='stylesheet';motionCss.href='landing-motion.css?v=20261007-jalur';document.head.append(motionCss);
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
  // Consultation dialog. Every consult CTA is a real wa.me link (works without JS); with JS
  // it opens this dialog first so the chosen path and situation land in the prefilled message.
  const WA_NUMBER='817084655520';
  const waLink=text=>'https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(text);
  const paths={
    'belum-tahu':{label:'Belum tahu, ingin dibantu memilih',title:'Mulai dari memetakan jalur',copy:'Kita cocokkan usia, pendidikan, pengalaman kerja, dan kemampuan bahasamu dengan jalur SSW, Gijinkoku, Ginou, atau Ryugaku sebelum menentukan langkah berikutnya.',link:'#jalur',linkText:'Bandingkan semua jalur'},
    ssw:{label:'Tokutei Ginou / SSW',title:'Jalur Tokutei Ginou (SSW)',copy:'Bahas bidang kerja yang diminati, ujian keterampilan dan bahasa (JFT-Basic atau JLPT N4 ke atas) yang perlu ditempuh, serta peluang matching melalui mitra TSK untuk lowongan yang tersedia.',link:'#jalur-ssw',linkText:'Baca rincian jalur SSW'},
    gijinkoku:{label:'Gijinkoku (kerja profesional)',title:'Jalur Gijinkoku',copy:'Bahas kaitan jurusan atau pengalaman kerjamu dengan posisi yang dituju. Siapkan informasi pendidikan dan riwayat kerja. EzNihongo belum memiliki mitra matching untuk jalur ini, tetapi bisa membantu melihat kesiapanmu.',link:'#jalur-gijinkoku',linkText:'Baca rincian jalur Gijinkoku'},
    ginou:{label:'Ginou / Skilled Labor',title:'Jalur Ginou (Skilled Labor)',copy:'Bahas keahlian dan lama pengalaman kerjamu, beserta dokumen yang dapat membuktikannya. Jalur ini berbeda dari program magang Ginou Jisshu. EzNihongo belum memiliki mitra matching untuk jalur ini.',link:'#jalur-ginou',linkText:'Baca rincian jalur Ginou'},
    ryugaku:{label:'Ryugaku (studi)',title:'Studi di Jepang (Ryugaku)',copy:'Bahas jenis sekolah yang kamu tuju, rencana biaya studi dan hidup, serta bekal bahasa yang dibutuhkan. EzNihongo belum menyediakan layanan pendaftaran sekolah.',link:'#jalur-ryugaku',linkText:'Baca rincian Ryugaku'},
    bahasa:{label:'Kelas bahasa Jepang',title:'Kelas bahasa Jepang',copy:'Bahas level yang sesuai, jadwal kelas, dan target bahasamu untuk jalur yang kamu tuju.',link:'#kelas',linkText:'Lihat kelas dan harga'}
  };
  const stages={
    pemula:{label:'Belum pernah belajar bahasa Jepang',note:'Bahasamu bisa dimulai dari kelas N5 sambil memastikan jalurnya cocok.'},
    dasar:{label:'Sudah belajar dasar (setara N5–N4)',note:'Kemampuanmu dicek dulu agar tidak mengulang materi yang sudah dikuasai.'},
    berpengalaman:{label:'Punya sertifikat JLPT/JFT atau pernah bekerja/magang di Jepang',note:'Kamu tidak harus mulai dari N5. Diskusinya akan fokus pada kesiapanmu untuk jalur yang dituju.'},
    sibuk:{label:'Sedang bekerja atau kuliah',note:'Jadwal persiapan dicocokkan dengan pekerjaan atau kuliahmu.'}
  };
  const dialog=document.querySelector('#program-dialog'),pathSelect=document.querySelector('#consult-path'),stage=document.querySelector('#stage'),waButton=document.querySelector('#consult-whatsapp'),pathLink=document.querySelector('#consult-path-link');
  function consultMessage(){const p=paths[pathSelect.value]||paths['belum-tahu'],s=stages[stage.value]||stages.pemula;return 'Halo EzNihongo, saya ingin mendiskusikan rencana ke Jepang.\n\nJalur yang diminati: '+p.label+'\nKondisi saya: '+s.label+'\n\nMohon info langkah yang sesuai untuk saya.'}
  function updateRecommendation(){
    const p=paths[pathSelect.value]||paths['belum-tahu'],s=stages[stage.value]||stages.pemula;
    document.querySelector('#result-title').textContent=p.title;
    document.querySelector('#result-copy').textContent=p.copy+' '+s.note;
    waButton.href=waLink(consultMessage());waButton.dataset.path=pathSelect.value;
    pathLink.href=p.link;pathLink.textContent=p.linkText;
  }
  let opener;
  function openDialog(button){
    if(typeof dialog.showModal!=='function')return false;
    opener=button;closeMenu();
    pathSelect.value=paths[button.dataset.path]?button.dataset.path:'belum-tahu';
    stage.value=stages[button.dataset.stage]?button.dataset.stage:'pemula';
    updateRecommendation();dialog.showModal();
    document.dispatchEvent(new CustomEvent('landing:consult-opened',{detail:{path:pathSelect.value}}));return true;
  }
  document.querySelectorAll('[data-consult]').forEach(b=>b.addEventListener('click',e=>{if(openDialog(b))e.preventDefault()}));
  document.addEventListener('landing:consult',event=>{if(event.detail?.opener instanceof HTMLElement)openDialog(event.detail.opener)});
  pathSelect.addEventListener('change',updateRecommendation);stage.addEventListener('change',updateRecommendation);
  waButton.addEventListener('click',()=>{waButton.href=waLink(consultMessage());setTimeout(()=>dialog.close(),0)});
  dialog.addEventListener('close',()=>{if(opener&&document.contains(opener))opener.focus({preventScroll:true})});
  // Path accordions: a link to #jalur-… opens that path's details, so the dialog, the hero
  // strip and shared URLs all land on the opened explanation.
  function openPath(hash){
    const target=hash&&hash.length>1?document.getElementById(decodeURIComponent(hash.slice(1))):null;
    if(!(target instanceof HTMLDetailsElement))return false;
    target.open=true;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return true;
  }
  pathLink.addEventListener('click',e=>{const hash=pathLink.getAttribute('href');opener=null;dialog.close();if(openPath(hash)){e.preventDefault();history.replaceState(null,'',hash)}});
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href^="#jalur-"]');if(a&&a!==pathLink&&openPath(a.getAttribute('href')))e.preventDefault()});
  addEventListener('hashchange',()=>openPath(location.hash));
  if(location.hash.startsWith('#jalur-'))openPath(location.hash);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),header=document.querySelector('.header');
  function splitLines(el,html){el.innerHTML=html.split(/<br\s*\/?>/i).map(line=>'<span class="ln"><span>'+line.trim()+'</span></span>').join(' ');el.querySelectorAll('.ln').forEach((ln,i)=>ln.style.setProperty('--li',i))}
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
     ['main section:not(.hero):not(.start-strip) .eyebrow,.savings-grid li,.story-bridge,.section-head>p,.path,.path-divider,.path-sources,.bootcamp-offer,.program-note,.cms-courses>h3,#course-status,.learning-tab,.learning-screens,.cost-grid>div>p,.cost-section li,.faq-grid .text-link,.faq-items details,.closing p:not(.eyebrow),.closing-actions,.closing-login','up'],
     ['.journey-grid li','draw']
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
  updateRecommendation();
})();
