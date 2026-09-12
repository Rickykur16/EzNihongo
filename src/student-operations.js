const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabels={new:'Baru',handling:'Ditangani',waiting_student:'Menunggu siswa',waiting_team:'Menunggu divisi',resolved:'Selesai'};
const categoryLabels={onboarding:'Onboarding',access:'Akses belajar',schedule:'Jadwal',academic:'Akademik',payment:'Pembayaran / refund',inactive:'Siswa tidak aktif',other:'Lainnya'};
const onboardingLabels={new:'Belum dihubungi',contacted:'Sudah dihubungi',ready:'Siap belajar'};
const attendanceLabels={present:'Hadir',late:'Terlambat',excused:'Izin',absent:'Tidak hadir'};
const date=value=>value?new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';
const local=value=>{if(!value)return '';const d=new Date(value);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);};
const options=(values,selected='')=>Object.entries(values).map(([v,label])=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(label)}</option>`).join('');
function labelControls(container){container.querySelectorAll('label').forEach(label=>{const field=label.querySelector('input,select,textarea');if(field)field.setAttribute('aria-label',label.firstChild.textContent.trim());});}
const errors={operations_version_conflict:'Data sudah diubah anggota lain. Draf tetap tersedia; tutup lalu buka kembali untuk memuat versi terbaru.',operations_scope_required:'Anda tidak memiliki akses Operasional Siswa untuk kursus ini.',resolution_required:'Isi hasil penyelesaian sebelum menutup keluhan.',escalation_team_required:'Pilih divisi tujuan sebelum menunggu tindak lanjut divisi.',assignee_lacks_operations_access:'PIC tidak lagi memiliki akses operasional pada kursus ini.',session_not_started:'Absensi hanya dapat dicatat setelah sesi dimulai dan bukan untuk sesi dibatalkan.',not_enrolled_at_session:'Masa kepesertaan siswa tidak mencakup waktu sesi.',student_operations_disabled:'Pusat Operasional Siswa belum diaktifkan.',student_enrollment_not_found:'Kepesertaan siswa tidak ditemukan.'};
export function createStudentOperations({root,api,access,courses,onOpen}){
  const node=document.createElement('section');node.id='student-operations';node.hidden=true;root.append(node);
  const permitted=access.isAdmin||access.scopes?.operations==='global'?courses:courses.filter(c=>access.scopes?.operations?.includes(c.id));
  let courseId=permitted[0]?.id||'',mode='students',queue='all',offset=0,hasMore=false,rows=[],generation=0,dialogGeneration=0,busy=false,dirty=false;
  node.innerHTML=`<div class="ops-heading"><div><p class="ops-eyebrow">OPERASIONAL SISWA</p><h1>Temani perjalanan belajar siswa</h1><p>Onboarding, progres, tindak lanjut, dan keluhan dalam satu ruang kerja.</p></div><label>Kursus<select id="ops-course">${permitted.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label></div>
    <div id="ops-summary" class="ops-summary"></div>
    <nav class="ops-tabs" aria-label="Bagian operasional"><button data-mode="students">Siswa & progres</button><button data-mode="cases">Layanan & keluhan</button><button data-mode="sessions">Jadwal & absensi</button></nav>
    <form id="ops-filter" class="ops-filter"><label id="ops-queue-label">Antrean<select id="ops-queue"></select></label><label id="ops-search-label">Cari siswa<input name="q" type="search" maxlength="120" placeholder="Nama atau email"/></label><button type="submit">Tampilkan</button></form>
    <p id="ops-notice" role="status" aria-live="polite"></p><div id="ops-list"></div><div class="ops-pagination"><button id="ops-prev">Sebelumnya</button><span id="ops-page"></span><button id="ops-next">Berikutnya</button></div>
    <details class="ops-guide"><summary>Panduan kerja & pembagian tanggung jawab</summary><p>Operasional Siswa menerima keluhan sampai siswa mendapat jawaban. Akademik menangani pengajaran; Finance memverifikasi pembayaran dan memutuskan refund. Eskalasi di sini mencatat koordinasi, tanpa mengirim pesan otomatis.</p><p>Prioritaskan keluhan mendesak, tindak lanjut jatuh tempo, lalu onboarding. Antrean tidak aktif memakai tujuh hari sejak aktivitas tercatat terakhir atau tanggal masuk. Perpanjangan memakai masa akses yang tersisa tujuh hari.</p><p>Progres dan masa akses dibaca dari data belajar yang sudah ada. Absensi kosong berarti belum dicatat. Status onboarding tidak memberikan akses berbayar.</p></details>
    <dialog id="ops-dialog" aria-labelledby="ops-dialog-title"><div class="ops-dialog-head"><h2 id="ops-dialog-title"></h2><button type="button" id="ops-close">Tutup</button></div><p id="ops-dialog-notice" role="status"></p><div id="ops-dialog-body"></div></dialog>`;
  const $=id=>node.querySelector('#ops-'+id),dialog=$('dialog');
  labelControls(node);
  const message=e=>errors[e.message]||'Permintaan belum berhasil. Periksa koneksi dan coba lagi.';
  const params=extra=>new URLSearchParams({courseId,...extra});
  const fetchApi=(path,body,method)=>api('/operations'+path,body,method);
  function canLeave(){if(busy){$('dialog-notice').textContent='Tunggu sampai penyimpanan selesai.';return false;}return !dirty||confirm('Perubahan belum disimpan. Tinggalkan perubahan?');}
  function closeDialog(){dialogGeneration++;dirty=false;if(dialog.open)dialog.close();}
  $('close').onclick=()=>{if(canLeave())closeDialog();};dialog.addEventListener('cancel',e=>{e.preventDefault();if(canLeave())closeDialog();});
  function markDirty(e){const form=e.target.closest('form');if(form&&form.id!=='ops-roster-search'){form.dataset.dirty='true';dirty=true;}}
  function saved(form){delete form.dataset.dirty;dirty=!!dialog.querySelector('form[data-dirty]');}
  dialog.addEventListener('input',markDirty);dialog.addEventListener('change',markDirty);
  function setupFilters(){
    const values=mode==='students'?{all:'Semua siswa',onboarding:'Onboarding belum selesai',inactive:'Tidak aktif ≥7 hari',follow_up:'Tindak lanjut jatuh tempo',expiring:'Masa akses ≤7 hari'}:{open:'Belum selesai',overdue:'Lewat tenggat',resolved:'Selesai',all:'Semua layanan'};
    $('queue').innerHTML=options(values,queue);$('queue-label').hidden=mode==='sessions';$('search-label').hidden=mode!=='students';
    node.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-current',b.dataset.mode===mode?'page':'false'));
  }
  function summary(data){
    const s=data.summary||{};
    const cards=mode==='students'?[['Siswa aktif',s.active],['Onboarding',s.onboarding],['Perlu dihubungi',s.follow_up],['Tidak aktif ≥7 hari',s.inactive],['Masa akses ≤7 hari',s.expiring]]:mode==='cases'?[['Layanan terbuka',s.open],['Lewat tenggat',s.overdue]]:[];
    $('summary').innerHTML=cards.map(([label,value])=>`<div class="ops-stat"><span>${label}</span><strong>${value??'—'}</strong></div>`).join('');
  }
  async function load(){
    if(!courseId){$('list').innerHTML='<p class="ops-empty">Belum ada kursus dalam cakupan akses Anda.</p>';$('filter').hidden=true;return;}
    const token=++generation;$('notice').textContent='Memuat…';$('list').innerHTML='';$('summary').innerHTML='';$('prev').disabled=$('next').disabled=true;
    try{
      const query=params({offset:String(offset),...(mode!=='sessions'?{queue}:{}),...(mode==='students'?{q:$('filter').elements.q.value.trim()}: {})});
      const data=await fetchApi('/'+mode+'?'+query);if(token!==generation)return;
      rows=data[mode];hasMore=data.hasMore;summary(data);render();$('notice').textContent=mode==='students'?'Ringkasan seluruh kursus terpilih. Aktivitas mencakup progres, kuis, latihan, dan tugas yang tercatat.':'';
    }catch(e){if(token===generation){rows=[];$('notice').textContent=message(e);$('list').innerHTML='<button id="ops-retry">Coba lagi</button>';$('retry').onclick=load;}}
  }
  function render(){
    $('page').textContent=`Halaman ${offset/50+1}`;$('prev').disabled=!offset;$('next').disabled=!hasMore;
    if(!rows.length){$('list').innerHTML=`<div class="ops-empty"><h2>${mode==='cases'?'Belum ada layanan pada antrean ini':mode==='sessions'?'Belum ada sesi belajar':'Belum ada siswa pada antrean ini'}</h2><p>${mode==='cases'?'Buka siswa di tab Siswa & progres untuk mencatat keluhan atau tindak lanjut.':mode==='sessions'?'Jadwal mengikuti Live Class yang dikelola Akademik.':'Siswa tampil setelah memiliki kepesertaan kursus. Coba antrean Semua siswa atau ubah pencarian.'}</p></div>`;return;}
    let heads,body;
    if(mode==='students'){
      heads=['Siswa','Onboarding','Progres','Aktivitas terakhir','Masa akses','Tindak lanjut'];
      body=rows.map((s,i)=>`<tr><td><button data-row="${i}" class="ops-link">${esc(s.full_name||s.email)}</button><small>${esc(s.email)}</small></td><td>${onboardingLabels[s.onboarding]}<small>${esc(s.assignee_name||'PIC belum dipilih')}</small></td><td>${s.completed} / ${s.total_lessons}<small>pelajaran selesai</small></td><td>${esc(date(s.last_activity))}${s.inactive?'<small class="ops-warning">Perlu ditinjau</small>':''}</td><td>${({active:'Aktif',expired:'Berakhir',revoked:'Dicabut'})[s.access_status]}<small>${s.expires_at?esc(date(s.expires_at)):'Tanpa batas waktu'}</small></td><td>${esc(date(s.next_follow_up))}</td></tr>`).join('');
    }else if(mode==='cases'){
      heads=['Layanan / keluhan','Siswa','Status','PIC','Tenggat'];body=rows.map((c,i)=>`<tr><td><button data-row="${i}" class="ops-link">${esc(c.title)}</button><small>${categoryLabels[c.category]} · ${{normal:'Normal',high:'Tinggi',urgent:'Mendesak'}[c.priority]}</small></td><td>${esc(c.student_name||'Siswa')}</td><td>${statusLabels[c.status]}<small>${({academic:'Eskalasi: Akademik',finance:'Eskalasi: Finance',technology:'Eskalasi: Teknologi'})[c.escalated_to]||''}</small></td><td>${esc(c.assignee_name||'Belum dipilih')}</td><td>${esc(date(c.due_at))}${c.status!=='resolved'&&c.due_at&&new Date(c.due_at)<new Date()?'<small class="ops-warning">Lewat tenggat</small>':''}</td></tr>`).join('');
    }else{heads=['Sesi','Jadwal','Status','Kehadiran'];body=rows.map((s,i)=>`<tr><td><button data-row="${i}" class="ops-link">${esc(s.title)}</button></td><td>${esc(date(s.starts_at))}</td><td>${({scheduled:'Terjadwal',completed:'Selesai',cancelled:'Dibatalkan'})[s.status]}</td><td>${s.attended} hadir / ${s.recorded} dicatat</td></tr>`).join('');}
    $('list').innerHTML=`<div class="ops-table"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
    $('list').querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>{const row=rows[Number(b.dataset.row)];if(mode==='students')student(row);else if(mode==='cases')caseEditor(row);else attendance(row);});
  }
  function showDialog(title,body){dialogGeneration++;dirty=false;$('dialog-title').textContent=title;$('dialog-notice').textContent='';$('dialog-body').innerHTML=body;labelControls($('dialog-body'));if(!dialog.open)dialog.showModal();return dialogGeneration;}
  async function loadPeople(selected,token){
    const field=$('dialog-body').querySelector('[name="assignedTo"]');if(!field)return;field.disabled=true;
    const people=await api('/assignees?'+new URLSearchParams({division:'operations',courseId}));if(token!==dialogGeneration)return;
    const values={'':'Belum ditugaskan',...Object.fromEntries(people.people.map(p=>[p.id,p.full_name||p.id]))};
    if(selected&&!values[selected])values[selected]='PIC sebelumnya (pilih ulang bila akses berubah)';field.innerHTML=options(values,selected);field.disabled=false;
  }
  async function saveForm(form,fn){
    if(form.id==='ops-case-form'&&$('note-form')?.elements.note.value.trim()){$('dialog-notice').textContent='Tambahkan catatan tindak lanjut terlebih dahulu, lalu simpan detail layanan.';return;}
    if(busy)return;busy=true;form.inert=true;const token=dialogGeneration;$('dialog-notice').textContent='Menyimpan…';
    try{await fn();if(token!==dialogGeneration)return;dirty=false;closeDialog();await load();}
    catch(e){if(token===dialogGeneration)$('dialog-notice').textContent=message(e);}
    finally{busy=false;form.inert=false;}
  }
  async function student(s){
    const token=showDialog(s.full_name||s.email,`<p>${esc(s.email)}</p><form id="ops-profile-form" class="ops-form"><label>Onboarding<select name="onboarding">${options(onboardingLabels,s.onboarding)}</select></label><label>PIC operasional<select name="assignedTo"></select></label><label>Tujuan belajar<textarea name="goal" maxlength="2000">${esc(s.goal)}</textarea></label><label>Tindak lanjut berikutnya<input name="nextFollowUp" type="datetime-local" value="${local(s.next_follow_up)}"/></label><button type="submit" disabled>Simpan pendampingan</button></form><div class="ops-actions"><button id="ops-new-case">Catat layanan / keluhan</button><button id="ops-progress-load">Lihat progres per pelajaran</button></div><div id="ops-progress"></div>`);
    const form=$('profile-form');
    form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));d.nextFollowUp=d.nextFollowUp?new Date(d.nextFollowUp).toISOString():null;d.assignedTo=d.assignedTo||null;saveForm(form,()=>fetchApi('/students/'+s.id,{...d,courseId,version:s.version},'PUT'));};
    $('new-case').onclick=()=>{if(canLeave())caseEditor(null,s);};
    $('progress-load').onclick=async()=>{const target=$('progress');target.textContent='Memuat progres…';try{const r=await fetchApi('/students/'+s.id+'/progress?'+params({}));if(token!==dialogGeneration)return;target.innerHTML=r.lessons.length?'<ul class="ops-progress">'+r.lessons.map(l=>`<li><strong>${l.completed?'✓':'○'} ${esc(l.title)}</strong><small>${esc(l.chapter)}${l.completed_at?' · '+esc(date(l.completed_at)):''}</small></li>`).join('')+'</ul>':'<p>Belum ada materi pada kursus ini.</p>';}catch(e){if(token===dialogGeneration)target.textContent=message(e);}};
    try{await loadPeople(s.assigned_to,token);if(token===dialogGeneration)form.querySelector('[type="submit"]').disabled=false;}catch(e){if(token===dialogGeneration)$('dialog-notice').textContent='PIC gagal dimuat. Tutup lalu buka kembali; data belum diubah.';}
  }
  async function caseEditor(c=null,s=null){
    const token=showDialog(c?'Detail layanan / keluhan':'Catat layanan / keluhan',`<p>${esc(c?.student_name||s?.full_name||s?.email||'Siswa')}</p><form id="ops-case-form" class="ops-form"><label>Judul<input name="title" maxlength="160" required value="${esc(c?.title)}"/></label><label>Kategori<select name="category">${options(categoryLabels,c?.category||'other')}</select></label><label>Prioritas<select name="priority">${options({normal:'Normal',high:'Tinggi',urgent:'Mendesak'},c?.priority||'normal')}</select></label><label>PIC operasional<select name="assignedTo"></select></label><label>Tenggat tindak lanjut<input type="datetime-local" name="dueAt" value="${local(c?.due_at)}"/></label><label>Keluhan / kebutuhan siswa<textarea name="description" maxlength="6000">${esc(c?.description)}</textarea></label><label>Eskalasi ke<select name="escalatedTo">${options({'':'Ditangani Operasional',academic:'Akademik',finance:'Finance',technology:'Teknologi'},c?.escalated_to||'')}</select></label>${c?`<label>Status<select name="status">${options(statusLabels,c.status)}</select></label><label>Hasil penyelesaian<textarea name="resolution" maxlength="4000">${esc(c.resolution)}</textarea></label>`:''}<p class="ops-hint">Operasional tetap menjadi PIC komunikasi. Pemilihan divisi mencatat koordinasi dan tidak mengirim pesan atau memproses pembayaran.</p><button type="submit" disabled>Simpan layanan</button></form>${c?'<details id="ops-history"><summary>Riwayat & catatan tindak lanjut</summary><div id="ops-events"></div><form id="ops-note-form" class="ops-form"><label>Catatan baru<textarea name="note" required maxlength="4000"></textarea></label><button type="submit">Tambahkan catatan</button></form></details>':''}`);
    const form=$('case-form');form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));d.assignedTo=d.assignedTo||null;d.dueAt=d.dueAt?new Date(d.dueAt).toISOString():null;d.userId=c?.user_id||s.id;d.courseId=courseId;if(c)d.version=c.version;saveForm(form,()=>fetchApi('/cases'+(c?'/'+c.id:''),d,c?'PATCH':'POST'));};
    if(c){
      const history=async()=>{try{const r=await fetchApi('/cases/'+c.id+'/events?'+params({}));if(token!==dialogGeneration)return;$('events').innerHTML='<ol>'+r.events.map(e=>`<li>${esc(({created:'Layanan dibuat',updated:'Detail diperbarui',status_changed:'Status diubah',note:'Catatan tindak lanjut'})[e.event_key])} · ${esc(date(e.occurred_at))}${e.note?'<p>'+esc(e.note)+'</p>':''}</li>`).join('')+'</ol>'+(r.events.length===100?'<p>Menampilkan 100 catatan terbaru.</p>':'');}catch(e){if(token===dialogGeneration)$('events').textContent=message(e);}};
      $('history').ontoggle=()=>{if($('history').open)history();};
      $('note-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const f=e.currentTarget;f.inert=true;try{await fetchApi('/cases/'+c.id+'/events',{courseId,userId:c.user_id,note:f.elements.note.value});if(token!==dialogGeneration)return;f.reset();saved(f);$('dialog-notice').textContent='Catatan tersimpan. Simpan formulir utama jika detail layanan ikut diubah.';await history();}catch(e){if(token===dialogGeneration)$('dialog-notice').textContent=message(e);}finally{busy=false;f.inert=false;}};
    }
    try{await loadPeople(c?.assigned_to,token);if(token===dialogGeneration)form.querySelector('[type="submit"]').disabled=false;}catch(e){if(token===dialogGeneration)$('dialog-notice').textContent='PIC gagal dimuat. Tutup lalu buka kembali; draf belum disimpan.';}
  }
  async function attendance(session){
    const token=showDialog('Absensi · '+session.title,'<p>Absensi kosong berarti belum dicatat. Daftar mengikuti kepesertaan kursus; hanya siswa dengan masa akses yang mencakup waktu sesi yang dapat dicatat.</p><form id="ops-roster-search" class="ops-filter"><label>Cari siswa<input type="search" name="q" maxlength="120"/></label><button>Cari</button></form><div id="ops-roster"></div><div class="ops-pagination"><button id="ops-roster-prev">Sebelumnya</button><span id="ops-roster-page"></span><button id="ops-roster-next">Berikutnya</button></div>');
    let start=0,request=0;
    async function roster(){
      const req=++request;$('roster').textContent='Memuat siswa…';$('roster-prev').disabled=$('roster-next').disabled=true;
      try{
        const r=await fetchApi('/sessions/'+session.id+'/attendance?'+params({offset:String(start),q:$('roster-search').elements.q.value.trim()}));if(token!==dialogGeneration||req!==request)return;
        const canRecord=session.status!=='cancelled'&&new Date(session.starts_at)<=new Date();
        $('roster').innerHTML=r.students.length?r.students.map((s,i)=>`<form class="ops-attendance" data-attendance="${i}"><strong>${esc(s.full_name||s.email)}</strong><label>Kehadiran<select name="status" required>${options({'':'Belum dicatat',...attendanceLabels},s.status||'')}</select></label><label>Catatan<input name="note" maxlength="2000" value="${esc(s.note)}"/></label><button type="submit"${canRecord&&s.eligible?'':' disabled'}>Simpan</button>${!s.eligible?'<small>Masa akses tidak mencakup waktu sesi.</small>':''}</form>`).join(''):'<p>Belum ada siswa yang sesuai.</p>';
        labelControls($('roster'));$('roster-page').textContent=`Halaman ${start/50+1}`;$('roster-prev').disabled=!start;$('roster-next').disabled=!r.hasMore;
        $('roster').querySelectorAll('[data-attendance]').forEach(f=>f.onsubmit=async e=>{
          e.preventDefault();if(busy)return;busy=true;f.inert=true;const s=r.students[Number(f.dataset.attendance)],d=Object.fromEntries(new FormData(f));
          try{const result=await fetchApi('/sessions/'+session.id+'/attendance/'+s.id,{...d,courseId,version:s.version},'PUT');if(token!==dialogGeneration)return;s.version=result.attendance.version;saved(f);$('dialog-notice').textContent='Absensi siswa tersimpan.';}
          catch(e){if(token===dialogGeneration)$('dialog-notice').textContent=message(e);}finally{busy=false;f.inert=false;}
        });
      }catch(e){if(token===dialogGeneration&&req===request)$('roster').textContent=message(e);}
    }
    $('roster-search').onsubmit=e=>{e.preventDefault();if(canLeave()){dirty=false;start=0;roster();}};
    $('roster-prev').onclick=()=>{if(canLeave()){dirty=false;start=Math.max(0,start-50);roster();}};$('roster-next').onclick=()=>{if(canLeave()){dirty=false;start+=50;roster();}};await roster();
  }
  node.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(!canLeave())return;closeDialog();mode=b.dataset.mode;offset=0;queue=mode==='cases'?'open':'all';setupFilters();load();});
  $('course').onchange=()=>{if(!canLeave()){$('course').value=courseId;return;}closeDialog();courseId=$('course').value;offset=0;load();};
  $('filter').onsubmit=e=>{e.preventDefault();queue=$('queue').value;offset=0;load();};$('prev').onclick=()=>{offset=Math.max(0,offset-50);load();};$('next').onclick=()=>{offset+=50;load();};
  return {open(){onOpen();node.hidden=false;setupFilters();load();},canLeave,close(){generation++;closeDialog();node.hidden=true;}};
}
