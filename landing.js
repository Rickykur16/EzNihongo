(() => {
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
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),story=document.querySelector('.story'),stageEl=document.querySelector('#story-stage'),title=document.querySelector('#scene-title'),copy=document.querySelector('#scene-copy'),counter=document.querySelector('#scene-count'),transcript=document.querySelector('#story-transcript');
  let index=0,timer=null,transition=null,inView=false;
  function stop(){clearTimeout(timer);clearTimeout(transition);timer=null;transition=null;stageEl.classList.remove('changing')}
  function update(){title.innerHTML=scenes[index].title;copy.textContent=scenes[index].copy;counter.textContent=String(index+1).padStart(2,'0')+' / 06'}
  function canAdvance(){return inView&&!document.hidden&&!reduced.matches&&index<scenes.length-1&&!story.contains(document.activeElement)}
  function schedule(){clearTimeout(timer);if(canAdvance())timer=setTimeout(()=>{stageEl.classList.add('changing');transition=setTimeout(()=>{index+=1;update();stageEl.classList.remove('changing');schedule()},350)},6000)}
  scenes.forEach(scene=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.innerHTML=scene.title.replace('<br>',' ');p.append(strong,document.createTextNode(scene.copy));transcript.append(p)});
  // The complete story remains available to screen readers without changing announcements.
  stageEl.setAttribute('aria-hidden','true');
  function motionPreference(){stop();stageEl.hidden=reduced.matches;counter.hidden=reduced.matches;transcript.classList.toggle('sr-only',!reduced.matches);schedule()}
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)schedule();else stop()},{threshold:.3}).observe(story);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else schedule()});
  story.addEventListener('focusin',stop);story.addEventListener('focusout',()=>setTimeout(schedule,0));
  reduced.addEventListener('change',motionPreference);motionPreference();
  update();updateRecommendation();
})();
