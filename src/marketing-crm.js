const stages={new:'Baru',contacted:'Dihubungi',qualified:'Terkualifikasi',consulting:'Konsultasi',offered:'Ditawari program',won:'Deal dicatat',lost:'Batal'};
const sources={referral:'Referral',instagram:'Instagram',tiktok:'TikTok',whatsapp:'WhatsApp',website:'Website',event:'Acara',other:'Lainnya'};
const backgrounds={'':'Belum dicatat',ex_intern_hospitality:'Eks-intern/kerja Jepang · hospitality',ex_intern_other:'Eks-intern/kerja Jepang · lainnya',fresh_graduate:'Lulusan baru',worker:'Sedang bekerja',other:'Lainnya'};
const problems={'':'Belum dicatat',cost:'Biaya',language:'Bahasa',jobs:'Akses kerja',time:'Waktu/fleksibilitas',trust:'Kepercayaan',other:'Lainnya'};
const angles={'':'Belum diuji',cost:'Cost · biaya',career:'Career · jalur kerja',convenience:'Convenience · fleksibilitas',other:'Lainnya'};
const priceReactions={'':'Belum ditanya',cheap:'Murah',reasonable:'Masuk akal',somewhat_expensive:'Agak mahal',expensive:'Mahal',not_relevant:'Bukan pertimbangan utama'};
const errors={crm_version_conflict:'Data sudah diubah anggota lain. Salin perubahanmu lalu tutup dan buka kembali calon siswa.',crm_duplicate_contact:'Kontak ini sudah tercatat untuk kursus yang sama. Cari calon siswa tersebut sebelum menambah data.',crm_contact_required:'Isi nomor WhatsApp atau email.',crm_invalid_phone:'Nomor tidak valid. Gunakan 08… untuk Indonesia atau kode negara, misalnya +81….',crm_invalid_email:'Periksa alamat email.',crm_lost_reason_required:'Isi alasan batal terlebih dahulu.',crm_qualification_required:'Catat alasan kualifikasi sebelum mengubah tahap menjadi Terkualifikasi atau lebih lanjut.',crm_scope_required:'Kamu tidak memiliki akses Marketing untuk kursus ini.',crm_assignee_scope:'PIC harus memiliki akses Marketing untuk kursus ini.',crm_setup_required:'Penyimpanan calon siswa belum diaktifkan. Hubungi pengelola.',crm_access_changed:'Hak akses berubah. Muat ulang Ruang Kerja.',crm_create_conflict:'Data ini sudah pernah dikirim. Tutup dan cari calon siswa untuk memeriksa hasilnya.',crm_rate_limit:'Terlalu banyak permintaan. Coba kembali sebentar lagi.'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(items,selected='')=>Object.entries(items).map(([id,label])=>`<option value="${esc(id)}"${id===String(selected??'')?' selected':''}>${esc(label)}</option>`).join('');
const date=value=>value?new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Belum dijadwalkan';
const localDate=value=>{if(!value)return '';const d=new Date(value);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);};
function labelControls(root){root.querySelectorAll('label').forEach(label=>{const control=label.querySelector('input,select,textarea');if(control)control.setAttribute('aria-label',label.firstChild.textContent.trim());});}

export function createMarketingCrm({root,api,access,courses,onOpen}){
  if(!document.querySelector('link[data-crm-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='styles/marketing-crm.css?v=20261003';link.dataset.crmStyle='true';document.head.append(link);}
  const node=document.createElement('section');node.id='marketing-crm';node.hidden=true;root.append(node);
  const global=access.isAdmin||access.scopes?.marketing==='global';
  const available=global?courses:courses.filter(c=>access.scopes?.marketing?.includes(c.id));
  const courseLabels=Object.fromEntries(available.map(c=>[c.id,c.title]));
  let generation=0,editorGeneration=0,rows=[],offset=0,hasMore=false,current=null,dirty=false,noteDirty=false,busy=false,peopleReady=false,opened=false;
  node.innerHTML=`<header class="crm-heading"><div><p class="crm-eyebrow">MARKETING / CALON SISWA</p><h1>Dari kenalan menjadi siswa.</h1><p>Catat minat, lanjutkan percakapan, dan pantau setiap peluang.</p></div><button id="crm-add" class="crm-primary">Tambah calon siswa</button></header>
    <div id="crm-summary" class="crm-stats"></div>
    <form id="crm-filter" class="crm-filter"><label>Cari calon siswa<input name="q" maxlength="160" placeholder="Nama, kontak, atau referral"></label><label>Kursus<select name="courseId">${options({'':'Semua kursus',...(global?{unassigned:'Belum dipilih'}:{}),...courseLabels})}</select></label><label>Tahap<select name="stage">${options({'':'Semua tahap',...stages})}</select></label><label>Sumber<select name="source">${options({'':'Semua sumber',...sources})}</select></label><label>Antrean<select name="queue">${options({all:'Semua calon siswa',open:'Masih diproses',due:'Follow-up jatuh tempo',mine:'Ditangani saya'})}</select></label><button>Tampilkan</button></form>
    <p class="crm-hint">Ringkasan mengikuti filter. Deal dicatat adalah status sales; Bayar terverifikasi hanya dihitung dari pesanan yang disetujui dan cocok dengan email serta kursus.</p>
    <p id="crm-notice" role="status" aria-live="polite"></p><div id="crm-list"></div>
    <nav class="crm-pagination" aria-label="Halaman calon siswa"><button id="crm-prev">Sebelumnya</button><span id="crm-page"></span><button id="crm-next">Berikutnya</button></nav>
    <dialog id="crm-dialog" aria-labelledby="crm-dialog-title"><header class="crm-dialog-head"><h2 id="crm-dialog-title"></h2><button id="crm-close" type="button">Tutup</button></header><p id="crm-editor-notice" role="status" aria-live="polite"></p><div id="crm-editor"></div></dialog>`;
  const $=id=>node.querySelector('#crm-'+id);
  labelControls(node);
  const message=e=>errors[e.message]||'Belum berhasil menyimpan atau memuat data. Periksa isian dan koneksi, lalu coba lagi.';
  function canLeave(){if(busy){$('editor-notice').textContent='Tunggu sampai penyimpanan selesai.';return false;}return !(dirty||noteDirty)||confirm('Isian belum disimpan. Tinggalkan perubahan?');}
  function closeDialog(){editorGeneration++;dirty=false;noteDirty=false;current=null;$('dialog').close();}
  $('close').onclick=()=>{if(canLeave())closeDialog();};
  $('dialog').addEventListener('cancel',e=>{e.preventDefault();if(canLeave())closeDialog();});
  $('dialog').addEventListener('input',e=>{if(e.target.closest('#crm-lead-form'))dirty=true;if(e.target.closest('#crm-note-form'))noteDirty=true;});
  $('dialog').addEventListener('change',e=>{if(e.target.closest('#crm-lead-form'))dirty=true;});
  async function load(){
    const token=++generation;rows=[];$('list').textContent='';$('summary').textContent='';$('notice').textContent='Memuat calon siswa…';$('prev').disabled=$('next').disabled=true;
    const query=new URLSearchParams([...new FormData($('filter'))].filter(([,v])=>v));query.set('offset',offset);
    try{
      const data=await api('/crm/leads?'+query);if(token!==generation||!opened)return;
      rows=data.leads;hasMore=data.hasMore;
      $('summary').innerHTML=[['total','Calon siswa'],['open','Masih diproses'],['due','Follow-up jatuh tempo'],['won','Deal dicatat'],['paid','Bayar terverifikasi'],['lost','Batal']].map(([key,label])=>`<article><span>${label}</span><strong>${Number(data.summary[key]||0)}</strong></article>`).join('');
      $('list').innerHTML=rows.length?`<div class="crm-table"><table><thead><tr><th>Calon siswa</th><th>Kursus & sumber</th><th>Tahap & bayar</th><th>PIC</th><th>Follow-up</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><button class="crm-link" data-row="${i}">${esc(r.full_name)}</button><small>${esc(r.phone||r.email)}</small></td><td>${esc(r.course_title||'Belum dipilih')}<small>${esc(sources[r.source])}${r.referrer_name?' · dari '+esc(r.referrer_name):r.source_detail?' · '+esc(r.source_detail):''}</small></td><td><span class="crm-stage crm-stage-${esc(r.stage)}">${esc(stages[r.stage])}</span>${r.paid_order_id?'<small class="crm-paid">✓ Bayar terverifikasi</small>':r.stage==='won'?'<small>Belum terhubung ke pesanan</small>':''}</td><td>${esc(r.assignee_name||'Belum ditugaskan')}</td><td${r.next_follow_up&&new Date(r.next_follow_up)<=new Date()&&!['won','lost'].includes(r.stage)?' class="crm-due"':''}>${esc(date(r.next_follow_up))}${r.next_action?`<small>${esc(r.next_action)}</small>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="crm-empty"><h2>${offset?'Tidak ada data di halaman ini':'Belum ada calon siswa pada filter ini'}</h2><p>Tambahkan calon siswa atau ubah filter untuk melihat percakapan lainnya.</p></div>`;
      $('list').querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>edit(rows[Number(b.dataset.row)]));
      $('page').textContent=`Halaman ${offset/50+1}`;$('prev').disabled=!offset;$('next').disabled=!hasMore;$('notice').textContent='';
    }catch(e){if(token!==generation||!opened)return;$('notice').textContent=message(e);$('list').innerHTML='<button id="crm-retry">Coba lagi</button>';$('retry').onclick=load;$('page').textContent='';}
  }
  function field(label,name,value='',extra=''){return `<label>${label}<input name="${name}" value="${esc(value??'')}" ${extra}></label>`;}
  function area(label,name,value='',max=1000,rows=2){return `<label class="crm-wide">${label}<textarea name="${name}" maxlength="${max}" rows="${rows}">${esc(value)}</textarea></label>`;}
  async function people(token){
    peopleReady=false;const form=$('lead-form');form.elements.assignedTo.disabled=true;form.querySelector('[type="submit"]').disabled=true;
    try{
      const data=await api('/assignees?'+new URLSearchParams({division:'marketing',courseId:form.elements.courseId.value}));if(token!==editorGeneration)return;
      const entries={'':'Belum ditugaskan',...Object.fromEntries(data.people.map(p=>[p.id,p.full_name||p.id]))};
      const previous=form.elements.assignedTo.value||current?.assigned_to||'';
      form.elements.assignedTo.innerHTML=options(entries,Object.hasOwn(entries,previous)?previous:'');peopleReady=true;$('people-retry').hidden=true;
    }catch(e){if(token!==editorGeneration)return;$('editor-notice').textContent='Daftar PIC gagal dimuat. Coba muat ulang sebelum menyimpan.';$('people-retry').hidden=false;}
    finally{if(token===editorGeneration){form.elements.assignedTo.disabled=false;form.querySelector('[type="submit"]').disabled=!peopleReady;}}
  }
  async function history(token){
    const box=$('history');if(!current)return;box.textContent='Memuat riwayat…';
    try{const data=await api('/crm/leads/'+current.id+'/events');if(token!==editorGeneration)return;
      box.innerHTML=`<ol>${data.events.map(e=>`<li><strong>${esc({created:'Ditambahkan',updated:'Data diperbarui',stage_changed:'Tahap diubah',note:'Catatan follow-up'}[e.event_key])}</strong> · ${esc(stages[e.stage])}<small>${esc(date(e.occurred_at))}</small>${e.note?`<p>${esc(e.note)}</p>`:''}</li>`).join('')}</ol>${data.events.length===100?'<p>Menampilkan 100 perubahan terbaru.</p>':''}`;
    }catch{if(token!==editorGeneration)return;box.innerHTML='<p>Riwayat belum berhasil dimuat.</p><button type="button">Coba lagi</button>';box.querySelector('button').onclick=()=>history(token);}
  }
  async function edit(item){
    current=item?{...item}:null;dirty=false;noteDirty=false;const token=++editorGeneration;
    const createId=crypto.randomUUID();$('dialog-title').textContent=item?'Detail calon siswa':'Tambah calon siswa';$('editor-notice').textContent='';
    const course=item?.course_id??(!global?available[0]?.id:'');
    $('editor').innerHTML=`<form id="crm-lead-form" class="crm-form">${field('Nama','fullName',item?.full_name,'required maxlength="160" autocomplete="off"')}${field('Nomor WhatsApp','phone',item?.phone,'type="tel" maxlength="40" placeholder="08… atau +kode negara"')}${field('Email','email',item?.email,'type="email" maxlength="254"')}
      <label>Kursus diminati<select name="courseId">${options({...global?{'':'Belum dipilih'}:{},...courseLabels},course)}</select></label><label>Sumber<select name="source">${options(sources,item?.source||'other')}</select></label>${field('Detail sumber / referral','sourceDetail',item?.source_detail,'maxlength="240" placeholder="Contoh: referral teman atau nama kampanye"')}
      ${field('Nama orang yang mereferensikan','referrerName',item?.referrer_name,'maxlength="160" placeholder="Untuk lead dari referral"')}
      <label>Latar belakang<select name="background">${options(backgrounds,item?.background)}</select></label>${field('Bidang kerja yang diminati','categoryInterest',item?.category_interest,'maxlength="160" placeholder="Contoh: hotel"')}
      <label>Masalah utama<select name="primaryProblem">${options(problems,item?.primary_problem)}</select></label>${field('Target waktu','targetTimeline',item?.target_timeline,'maxlength="160" placeholder="Contoh: ingin mulai dalam 3 bulan"')}
      <label>Tahap<select name="stage">${options(stages,item?.stage||'new')}</select></label>${field('Harga penawaran (Rp)','offeredPrice',item?.offered_price,'type="number" min="0" max="1000000000000" step="1"')}
      <label>Pesan penawaran yang diuji<select name="offerAngle">${options(angles,item?.offer_angle)}</select></label><label>Reaksi setelah tahu harga<select name="priceReaction">${options(priceReactions,item?.price_reaction)}</select></label>
      ${field('Harga yang dirasa masuk akal sebelum melihat penawaran (Rp)','willingnessToPay',item?.willingness_to_pay,'type="number" min="0" max="1000000000000" step="1"')}
      <label>PIC<select name="assignedTo"><option value="${esc(item?.assigned_to||'')}">Memuat PIC…</option></select></label>${field('Follow-up berikutnya','nextFollowUp',localDate(item?.next_follow_up),'type="datetime-local"')}
      ${field('Langkah berikutnya','nextAction',item?.next_action,'maxlength="500" placeholder="Contoh: kirim rincian program"')}
      ${area('Tujuan / kebutuhan','goal',item?.goal,2000,3)}${area('Mengapa lead ini memenuhi syarat?','qualificationNote',item?.qualification_note)}
      ${field('Wawancara dilakukan','interviewedAt',localDate(item?.interviewed_at),'type="datetime-local"')}${field('Alternatif yang dibandingkan','alternative',item?.alternative,'maxlength="500"')}
      ${area('Kata-kata calon siswa (persis)','customerWords',item?.customer_words,1500)}${area('Keberatan utama','objection',item?.objection)}${area('Alasan mengambil keputusan','decisionReason',item?.decision_reason)}
      <label id="crm-lost-field" class="crm-wide">Alasan batal<textarea name="lostReason" maxlength="1000" rows="2">${esc(item?.lost_reason)}</textarea></label>
      <p class="crm-hint crm-wide">Isi minimal satu kontak. Kualifikasi mencatat intent dan target waktu yang jelas. Deal dicatat tidak berarti pembayaran telah diterima; status bayar dibaca dari pesanan yang disetujui.</p><div class="crm-wide crm-actions"><button type="submit" class="crm-primary">Simpan calon siswa</button><button type="button" id="crm-people-retry" hidden>Muat ulang PIC</button></div></form>
      ${item?`<section class="crm-notes"><h3>Catatan follow-up</h3><form id="crm-note-form"><label>Hasil percakapan<textarea name="note" maxlength="2000" rows="3" required placeholder="Catat hasil dan langkah berikutnya"></textarea></label><button class="crm-primary">Tambah catatan</button></form><h3>Riwayat</h3><div id="crm-history"></div></section>${access.isAdmin?'<button type="button" id="crm-delete" class="crm-danger">Hapus data calon siswa</button>':''}`:''}`;
    const form=$('lead-form');
    function stageFields(){const closed=['won','lost'].includes(form.elements.stage.value);$('lost-field').hidden=form.elements.stage.value!=='lost';form.elements.lostReason.required=!$('lost-field').hidden;form.elements.nextFollowUp.disabled=closed;}
    stageFields();form.elements.stage.onchange=stageFields;
    form.elements.courseId.onchange=()=>{const t=++editorGeneration;people(t);if(current)history(t);};
    $('people-retry').onclick=()=>people(editorGeneration);
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||!peopleReady)return;
      const d=Object.fromEntries(new FormData(form));d.courseId=d.courseId||null;d.assignedTo=d.assignedTo||null;
      for(const key of ['nextFollowUp','interviewedAt'])d[key]=d[key]?new Date(d[key]).toISOString():null;
      for(const key of ['offeredPrice','willingnessToPay'])d[key]=d[key]===''?null:Number(d[key]);
      if(current)d.version=current.version;else d.id=createId;
      await saving(async()=>{const result=await api('/crm/leads'+(current?'/'+current.id:''),d,current?'PATCH':'POST');dirty=false;
        if(noteDirty){current=result.lead;await history(editorGeneration);await load();$('editor-notice').textContent='Detail tersimpan. Catatan percakapan masih perlu ditambahkan.';}
        else{closeDialog();await load();}
      });
    };
    if(item){
      $('note-form').onsubmit=async e=>{e.preventDefault();if(busy)return;if(dirty){$('editor-notice').textContent='Simpan perubahan detail sebelum menambah catatan. Catatan tetap tersedia untuk disalin.';return;}
        const note=e.currentTarget.elements.note.value;await saving(async()=>{const r=await api('/crm/leads/'+current.id+'/events',{note,version:current.version});current.version=r.lead.version;noteDirty=false;$('note-form').reset();await history(editorGeneration);await load();$('editor-notice').textContent='Catatan tersimpan.';});};
      if($('delete'))$('delete').onclick=()=>{if(busy||!confirm('Hapus kontak dan seluruh riwayat calon siswa ini secara permanen?'))return;saving(async()=>{await api('/crm/leads/'+current.id,{version:current.version},'DELETE');closeDialog();await load();});};
      history(token);
    }
    labelControls($('editor'));$('dialog').showModal();await people(token);
  }
  async function saving(fn){busy=true;$('editor').inert=true;$('editor-notice').textContent='Menyimpan…';try{await fn();}catch(e){$('editor-notice').textContent=message(e);}finally{busy=false;$('editor').inert=false;}}
  $('add').onclick=()=>edit(null);$('filter').onsubmit=e=>{e.preventDefault();offset=0;load();};
  $('prev').onclick=()=>{offset=Math.max(0,offset-50);load();};$('next').onclick=()=>{if(hasMore){offset+=50;load();}};
  const beforeUnload=e=>{if(opened&&(dirty||noteDirty||busy)){e.preventDefault();e.returnValue='';}};
  return {open(){opened=true;node.hidden=false;window.addEventListener('beforeunload',beforeUnload);onOpen();load();},canLeave,close(){opened=false;generation++;closeDialog();node.hidden=true;window.removeEventListener('beforeunload',beforeUnload);}};
}
