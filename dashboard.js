(() => {
  const app=document.getElementById('dashboard-app'); const labels={kana:'Kana',vocabulary:'Kosakata',kanji:'Kanji',grammar:'Grammar'};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function get(path){const r=await ezApi(path);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'request_failed');return d}
  function learnUrl(data){const c=data.course?.slug, n=data.continueLearning;if(!c)return'welcome.html';const p=new URLSearchParams({course:c});if(n){p.set('module',n.chapter.slug);p.set('lesson',n.lesson.slug)}return`welcome.html?${p}`}
  function reviewUrl(category='mixed'){return category==='mixed'?'review.html':`review.html?category=${encodeURIComponent(category)}`}
  function courseUrl(path,course){return `${path}?course=${encodeURIComponent(course)}`}
  function formatDate(value){return value?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):''}
  function masteryRow(key,value){const percent=value.percentage;return`<div class="mastery-row"><strong>${labels[key]}</strong><div class="bar" aria-label="${labels[key]} ${percent==null?'belum cukup data':percent+'%'}"><i style="width:${percent==null?0:percent}%"></i></div><span class="state">${percent==null?'Belum cukup data':percent+'% · '}${esc(value.label)}</span></div>`}
  function render(data){
    if(!data.course){app.innerHTML='<section class="card"><h1>Belum ada kelas aktif</h1><p class="muted">Kelas yang aktif akan muncul di Dashboard setelah pendaftaran selesai.</p></section>';return}
    const c=data.course,n=data.continueLearning,r=data.review,m=data.mastery,a=data.weeklyActivity,f=data.focus,live=data.liveClass||{};
    const focusMarkup=f
      ? '<h3>'+esc(f.title)+'</h3><p class="muted">'+esc(f.detail)+'</p><a class="secondary" href="'+(f.action==='continue'?learnUrl(data):reviewUrl(f.reviewCategory||'mixed'))+'">'+(f.action==='continue'?'Lanjut Belajar':'Latihan Fokus')+'</a>'
      : '<p class="muted">Belum ada fokus khusus. Tambahkan bukti latihan untuk mendapatkan rekomendasi.</p>';
    document.getElementById('learn-nav').href=learnUrl(data);
    document.getElementById('live-nav').href=courseUrl('live.html',c.slug);
    document.getElementById('progress-nav').href=courseUrl('progress.html',c.slug);
    const liveMarkup=live.next
      ? `<h2>${esc(live.next.title)}</h2><p class="muted">${formatDate(live.next.startsAt)}</p>${live.next.canJoin?`<a class="primary" target="_blank" rel="noopener" href="${esc(live.next.meetingUrl)}">Join Class</a>`:`<a class="secondary" href="${courseUrl('live.html',c.slug)}">Lihat jadwal</a>`}`
      : '<h2>Belum ada kelas terjadwal</h2><p class="muted">Kelas dan rekaman akan muncul di sini saat tersedia.</p>';
    const recordings=(live.recentRecordings||[]).map(x=>`<li>${esc(x.title)} <a target="_blank" rel="noopener" href="${esc(x.recordingUrl)}">Tonton</a></li>`).join('');
    app.innerHTML=`<section class="hero"><div><div class="eyebrow">DASHBOARD</div><h1>${data.greetingName?`Halo, ${esc(data.greetingName)}.`:'Halo.'}</h1><p class="muted">${esc(c.level||c.slug.toUpperCase())} · ${c.progress.percentage}% kurikulum selesai</p></div>${data.courses.length>1?`<select class="course-select" id="course-select">${data.courses.map(x=>`<option value="${esc(x.slug)}" ${x.id===c.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select>`:''}</section>
    <section class="grid"><article class="card"><div class="eyebrow">PROGRES KELAS</div><div class="course-progress">${c.progress.percentage}% selesai</div><p class="muted">${c.progress.completedLessons} dari ${c.progress.totalLessons} Pelajaran selesai. Ini progres kurikulum, bukan mastery.</p></article><article class="card"><div class="eyebrow">LANJUT BELAJAR</div>${n?`<div class="continue-label">${esc(n.section||'Kurikulum')} · ${esc(n.chapter.title)}</div><div class="continue-title">${esc(n.lesson.title)}</div><a class="primary" href="${learnUrl(data)}">Lanjut Belajar</a>`:`<div class="continue-title">Kurikulum selesai</div><p class="muted">Semua Pelajaran pada kelas ini sudah selesai.</p>`}</article></section>
    <section class="grid"><article class="card"><div class="eyebrow">SMART REVIEW</div><div class="review-count">${r.total} item perlu direview</div><div class="counts">${Object.entries(labels).map(([k,l])=>`<div class="count"><strong>${Number(r.byCategory?.[k])||0}</strong><span>${l}</span></div>`).join('')}</div>${r.total?`<a class="primary" href="${reviewUrl()}">Mulai Review</a>`:'<p class="muted">Review hari ini selesai. Lanjutkan belajar untuk membuka materi review berikutnya.</p>'}</article><article class="card live"><div class="eyebrow">LIVE CLASS · NEXT CLASS</div>${liveMarkup}${recordings?`<div class="eyebrow recordings-label">RECENT RECORDINGS</div><ul class="live-recordings">${recordings}</ul>`:''}<a class="secondary live-all" href="${courseUrl('live.html',c.slug)}">Lihat Semua</a></article></section>
    <section class="card"><div class="performance"><div><div class="eyebrow">PERFORMA BELAJAR</div><h2>Bukti latihan, bukan progres kurikulum.</h2>${Object.entries(m).map(([k,v])=>masteryRow(k,v)).join('')}</div><aside class="focus"><div class="eyebrow">FOKUS BELAJARMU</div>${focusMarkup}</aside></div></section>
    <section class="card" style="margin-top:18px"><div class="eyebrow">AKTIVITAS MINGGU INI</div><h2>Perilaku belajar, bukan mastery.</h2><div class="activity"><div class="metric"><strong>${a.activeDays}</strong><span>hari aktif</span></div><div class="metric"><strong>${a.lessonsCompleted}</strong><span>Pelajaran selesai</span></div><div class="metric"><strong>${a.reviewQuestions}</strong><span>review selesai</span></div><div class="metric"><strong>${a.accuracy==null?'—':a.accuracy+'%'}</strong><span>akurasi latihan</span></div></div><div class="insight">${esc(data.weeklyInsight.message)}</div></section>`;
    document.getElementById('course-select')?.addEventListener('change',e=>load(e.target.value));
  }
  async function load(course=''){try{const data=await get(`/dashboard/me${course?`?course=${encodeURIComponent(course)}`:''}`);render(data)}catch(e){app.innerHTML=`<section class="card"><h1>Dashboard belum bisa dimuat</h1><p class="muted">${esc(e.message)}</p></section>`}}
  document.getElementById('logout').addEventListener('click',()=>ezLogout());
  (async()=>{if(await ezRequireAuth('login.html'))load(new URLSearchParams(location.search).get('course')||'')})();
})();
