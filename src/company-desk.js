const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buckets = {open:'Semua pekerjaan terbuka',mine:'Pekerjaan saya',unassigned:'Belum ditugaskan',review:'Review / pengujian',overdue:'Lewat target',upcoming:'Target 7 hari ke depan',all:'Semua termasuk selesai'};
const summaryLabels = {mine:'Pekerjaan saya',unassigned:'Belum ditugaskan',review:'Review / pengujian',overdue:'Lewat target'};
const errors = {work_list_unavailable:'Antrean belum dapat dimuat. Coba lagi; data tidak dianggap kosong.',work_access_changed:'Izin telah berubah. Muat ulang halaman untuk memeriksa akses.',work_scope_required:'Filter berada di luar cakupan akses Anda.',invalid_work_cursor:'Antrean atau filter telah berubah. Gunakan Muat ulang untuk mulai dari halaman pertama.',work_list_rate_limit:'Terlalu banyak permintaan. Tunggu satu menit sebelum mencoba lagi.'};

export function createDeskView({root=document,api,access,courses,statuses,labels,onOpen,onItem}) {
  const panel=root.querySelector('#desk-panel'), deskButton=root.querySelector('#desk-button'), calendarButton=root.querySelector('#calendar-button');
  const hasWork=d=>access.isAdmin||access.scopes[d]==='global'||(Array.isArray(access.scopes[d])&&access.scopes[d].length>0);
  const divisions=access.divisions.filter(d=>hasWork(d.id));
  deskButton.hidden=!divisions.length;calendarButton.hidden=!divisions.some(d=>d.id==='marketing');
  if(!divisions.length)return{close(){}};
  const options=entries=>entries.map(([key,label])=>`<option value="${esc(key)}">${esc(label)}</option>`).join('');
  panel.innerHTML=`<div id="desk-summary" class="desk-summary" aria-label="Ringkasan seluruh pekerjaan berizin"></div>
    <p id="desk-summary-note" class="hint">Ringkasan seluruh pekerjaan berizin, tidak hanya hasil filter di bawah. Angka dapat tumpang tindih dan tidak boleh dijumlahkan.</p>
    <form id="desk-filters"><div class="desk-filter-grid"><label>Antrean<select name="bucket">${options(Object.entries(buckets))}</select></label><label>Divisi<select name="division"><option value="">Semua divisi berizin</option>${options(divisions.map(d=>[d.id,d.name]))}</select></label><label>Cari judul / catatan<input name="q" maxlength="120" type="search"></label><label id="desk-month-label" hidden>Bulan lokal<input name="month" type="month"></label></div>
    <details><summary>Filter tambahan</summary><div class="desk-filter-grid"><label>Kursus<select name="courseId"></select></label><label>Jenis<select name="kind">${options([['','Semua jenis'],...Object.entries(labels)])}</select></label><label>Status<select name="status">${options([['','Semua status'],...Object.entries(statuses)])}</select></label><label>Prioritas<select name="priority">${options([['','Semua prioritas'],['urgent','Mendesak'],['high','Tinggi'],['normal','Normal'],['low','Rendah']])}</select></label></div></details>
    <div class="actions"><button type="button" id="desk-reset">Reset filter</button><button type="submit">Terapkan filter</button><button type="button" id="desk-refresh">Muat ulang antrean</button></div></form>
    <p id="desk-status" role="status" aria-live="polite"></p><div id="desk-results"></div><div class="desk-pages"><button id="desk-previous">Sebelumnya</button><span id="desk-page-label"></span><button id="desk-next">Berikutnya</button></div>
    <p id="desk-calendar-note" class="hint" hidden>Agenda memakai jadwal/target yang dicatat pada pekerjaan Marketing, termasuk draf; bukan kalender publikasi terverifikasi atau auto-publish. Waktu mengikuti zona perangkat. Mengubah jadwal dilakukan melalui editor existing.</p>
    <p class="hint">Lewat target hanya berarti jadwal tercatat sudah lewat dan pekerjaan belum selesai. Item tanpa jadwal tidak diberi tenggat buatan. Antrean berubah saat orang bekerja; muat ulang dari halaman pertama untuk keadaan terbaru.</p>`;
  const form=panel.querySelector('form'), results=panel.querySelector('#desk-results'), status=panel.querySelector('#desk-status'), summary=panel.querySelector('#desk-summary');
  const previous=panel.querySelector('#desk-previous'), next=panel.querySelector('#desk-next');
  let mode='desk', generation=0, items=[], history=[], cursor='', nextCursor=null, applied={};
  function resetPages(){history=[];cursor='';nextCursor=null;}
  function courseOptions(){
    const division=form.elements.division.value;
    const selected=division?divisions.filter(d=>d.id===division):divisions;
    const global=selected.some(d=>access.isAdmin||access.scopes[d.id]==='global');
    const ids=new Set(selected.flatMap(d=>Array.isArray(access.scopes[d.id])?access.scopes[d.id]:[]));
    form.elements.courseId.innerHTML=options([['','Semua kursus berizin'],...(global?[['global','Tanpa kursus']]:[]),...courses.filter(c=>global||ids.has(c.id)).map(c=>[c.id,c.title])]);
  }
  function readFilters(){
    const data=Object.fromEntries(new FormData(form));delete data.month;
    if(mode==='calendar') {
      data.division='marketing';
      const value=form.elements.month.value;
      if(!/^\d{4}-\d{2}$/.test(value))throw new Error('Pilih bulan kalender.');
      const [year,month]=value.split('-').map(Number);
      if(year<2000||year>2100||month<1||month>12)throw new Error('Pilih bulan antara tahun 2000 dan 2100.');
      data.from=new Date(year,month-1,1).toISOString();data.to=new Date(year,month,1).toISOString();
    }
    return Object.fromEntries(Object.entries(data).filter(([,v])=>v!==''));
  }
  function showRows(){
    const divisionName=id=>access.divisions.find(d=>d.id===id)?.name||id;
    const time=value=>value?new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Tanpa jadwal';
    results.innerHTML=items.length?`<div class="table-wrap"><table><thead><tr><th>Pekerjaan</th><th>Status</th><th>Jadwal / target lokal</th><th>Penanggung jawab</th></tr></thead><tbody>${items.map(i=>`<tr><td><button class="item-button" data-desk-item="${esc(i.id)}">${esc(i.title)}</button><div class="meta">${esc(divisionName(i.division_key))} · ${esc(labels[i.kind])} · ${esc(i.priority)}</div></td><td data-label="Status">${esc(statuses[i.status]||i.status)}${i.source_payment_status?`<div class="meta">Pembayaran: ${esc(i.source_payment_status)}</div>`:''}</td><td data-label="Jadwal / target lokal">${esc(time(i.scheduled_at))}</td><td data-label="Penanggung jawab">${i.assigned_to===access.userId?'Saya':i.assigned_to?'Sudah ditugaskan':'Belum ditugaskan'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h3>Tidak ada pekerjaan yang cocok</h3><p>Sesuaikan filter atau pilih antrean lain. Ini bukan perubahan pada data sumber.</p></div>';
    results.querySelectorAll('[data-desk-item]').forEach(b=>b.onclick=()=>onItem(items.find(i=>i.id===b.dataset.deskItem)));
    previous.disabled=!history.length;next.disabled=!nextCursor;panel.querySelector('#desk-page-label').textContent=`Halaman ${history.length+1}`;
  }
  async function load(){
    const ticket=++generation;items=[];results.innerHTML='';summary.innerHTML='';previous.disabled=true;next.disabled=true;status.textContent='Memuat antrean…';
    try{
      const data=await api('/'+mode+'?'+new URLSearchParams({...applied,...(cursor?{cursor}:{}),limit:'50'}));
      if(ticket!==generation||panel.hidden)return;
      items=data.items;nextCursor=data.nextCursor;showRows();
      status.textContent=mode==='calendar'?`Agenda bulan ${form.elements.month.value} · zona ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`:'Filter mencakup seluruh antrean yang diizinkan, bukan hanya halaman saat ini.';
      if(data.summary) {
        summary.innerHTML=Object.entries(summaryLabels).map(([key,label])=>`<button data-bucket="${key}"><strong>${esc(Number(data.summary[key]).toLocaleString('id-ID'))}</strong><span>${label}</span></button>`).join('');
        summary.querySelectorAll('button').forEach(b=>b.onclick=()=>{form.reset();form.elements.bucket.value=b.dataset.bucket;courseOptions();apply();});
      }
    }catch(e){if(ticket===generation){results.innerHTML='';summary.innerHTML='';status.textContent=errors[e.message]||e.message;}}
  }
  function apply(){try{applied=readFilters();resetPages();load();}catch(e){status.textContent=e.message;}}
  form.onsubmit=e=>{e.preventDefault();apply();};
  form.elements.division.onchange=courseOptions;
  // Editing filters invalidates in-flight results and page navigation; only
  // submit applies them, so typing never issues unbounded server requests.
  form.oninput=()=>{generation++;items=[];results.innerHTML='';summary.innerHTML='';previous.disabled=true;next.disabled=true;status.textContent='Filter berubah. Pilih Terapkan filter.';};
  panel.querySelector('#desk-refresh').onclick=apply;
  panel.querySelector('#desk-reset').onclick=()=>{configure(mode);apply();};
  previous.onclick=()=>{if(history.length){cursor=history.pop();load();}};
  next.onclick=()=>{if(nextCursor){history.push(cursor);cursor=nextCursor;load();}};
  function configure(nextMode){
    mode=nextMode;form.reset();form.elements.bucket.value=mode==='calendar'?'all':'open';
    form.elements.division.value=mode==='calendar'?'marketing':'';form.elements.division.disabled=mode==='calendar';
    const now=new Date();form.elements.month.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    for(const id of ['desk-month-label','desk-calendar-note'])panel.querySelector('#'+id).hidden=mode!=='calendar';
    for(const id of ['desk-summary','desk-summary-note'])panel.querySelector('#'+id).hidden=mode==='calendar';courseOptions();
  }
  function open(nextMode){configure(nextMode);onOpen(mode);panel.hidden=false;deskButton.setAttribute('aria-current',String(mode==='desk'));calendarButton.setAttribute('aria-current',String(mode==='calendar'));apply();}
  deskButton.onclick=()=>open('desk');calendarButton.onclick=()=>open('calendar');
  return {close(){generation++;items=[];results.innerHTML='';summary.innerHTML='';panel.hidden=true;deskButton.removeAttribute('aria-current');calendarButton.removeAttribute('aria-current');}};
}
