// Navigation only. Existing API guards remain authoritative; never infer grants.
(function (global) {
  'use strict';
  const divisions = [
    {id:'technology',name:'Product & Technology',description:'Pengembangan produk, rilis dan tooling.',tabs:['tts','ai']},
    {id:'academic',name:'Academic & Learning',description:'Kurikulum, materi, kuis dan kelas.',tabs:['courses','modules','lessons','live']},
    {id:'marketing',name:'Growth & Marketing',description:'Kampanye, konten, sensei dan testimoni.',tabs:['sensei','testimonials']},
    {id:'operations',name:'Student Success & Operations',description:'Layanan siswa, diskusi dan akses belajar.',tabs:['users','discussions','access']},
    {id:'finance',name:'Finance',description:'Pesanan, pembayaran dan administrasi.',tabs:['orders']},
  ];
  const labels={courses:'Kursus',modules:'Modul',lessons:'Pelajaran & Kuis',live:'Live Class',sensei:'Sensei',testimonials:'Testimoni',users:'Pengguna',discussions:'Diskusi',access:'Beri Akses',orders:'Pesanan',tts:'TTS Cache',ai:'AI'};
  const shortNames={technology:'Produk & Teknologi',academic:'Akademik',marketing:'Marketing',operations:'Operasional Siswa',finance:'Finance'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function hasWork(company,id){return !!company?.divisions?.some(d=>d.id===id)&&(company.isAdmin===true||company.scopes?.[id]==='global'||(Array.isArray(company.scopes?.[id])&&company.scopes[id].length>0));}
  function routes(staff,company,canOpen){
    const result=[{key:'home',label:'Ringkasan',group:'general'}];
    if(divisions.some(d=>hasWork(company,d.id)))result.push({key:'desk',label:'Pusat Kerja Harian',group:'general'});
    if(company?.insights?.enabled&&Object.keys(company.insights.scopes||{}).length)result.push({key:'insights',label:'Data & Insights',group:'general'});
    for(const d of divisions){
      if(d.id==='finance'&&staff.finance?.enabled)result.push({key:'finance',label:'Pusat Finance',group:'finance'});
      if(hasWork(company,d.id))result.push({key:'work:'+d.id,label:d.id==='technology'?'Pekerjaan & Rilis':d.id==='marketing'?'Pekerjaan & Kampanye':'Pekerjaan Tim',group:d.id});
      for(const tab of d.tabs)if(canOpen(tab))result.push({key:'tab:'+tab,label:labels[tab],group:d.id,tab});
      if(d.id==='marketing'&&hasWork(company,d.id))result.push({key:'calendar',label:'Kalender Marketing',group:d.id});
    }
    if(company?.isAdmin===true&&staff.isAdmin===true)result.push({key:'members',label:'Akses Staf',group:'settings'},{key:'jobs',label:'Pengingat',group:'settings'});
    return result;
  }
  function navigation(items){
    const button=item=>`<button type="button" data-workspace="${esc(item.key)}"${item.tab?` data-tab="${esc(item.tab)}"`:''}>${esc(item.label)}</button>`;
    const section=(key,title)=>{
      const children=items.filter(i=>i.group===key);if(!children.length)return '';
      if(key==='general')return `<section class="workspace-nav-group workspace-nav-general">${children.map(button).join('')}</section>`;
      return `<details class="workspace-nav-group" data-group="${key}" name="workspace-division"><summary>${esc(title)}<span aria-hidden="true">›</span></summary><div class="workspace-submenu">${children.map(button).join('')}</div></details>`;
    };
    return section('general')+divisions.map(d=>section(d.id,shortNames[d.id])).join('')+section('settings','Pengaturan');
  }
  function overview(items){
    return `<div class="workspace-intro"><h1>Ringkasan</h1></div><div class="workspace-cards">${divisions.map(d=>{
      const links=items.filter(i=>i.group===d.id);if(!links.length)return '';
      return `<section class="workspace-card"><h2>${d.name}</h2><p>${d.description}</p><div>${links.map(i=>`<button type="button" class="btn btn-ghost" data-workspace="${esc(i.key)}">${esc(i.label)}</button>`).join('')}</div></section>`;
    }).join('')}</div>`;
  }
  const menuFlows={
    courses:['Kursus','Modul','Materi & Kuis'],modules:['Kursus','Modul','Materi & Kuis'],lessons:['Kursus','Modul','Materi & Kuis'],
    live:['Pilih kursus & jadwal','Hubungkan materi','Simpan kelas'],
    sensei:['Isi profil & foto','Atur status tampil','Simpan profil'],
    testimonials:['Isi cerita siswa','Pilih kelas & status','Simpan testimoni'],
    users:['Cari siswa','Buka Kelola Akses','Periksa akses & riwayat'],
    discussions:['Cari komentar','Tinjau isi','Hapus atau pulihkan'],
    access:['Cari email siswa','Pilih kursus & durasi','Kelola akses'],
    orders:['Pilih pesanan','Periksa bukti transfer','Setujui atau tolak'],
    tts:['Periksa statistik','Tinjau cache lama','Konfirmasi pembersihan'],
    ai:['Buka pengaturan','Edit prompt','Simpan prompt'],
    desk:['Pilih antrean','Buka pekerjaan','Perbarui status'],
    calendar:['Pilih bulan','Filter agenda','Buka pekerjaan'],
    insights:['Pilih cakupan','Muat ringkasan','Tinjau temuan'],
    members:['Cari akun','Pilih divisi & cakupan','Simpan akses'],
    jobs:['Lihat status pengingat','Periksa jumlah percobaan'],
    'work:technology':['Buat tugas atau rilis','Tetapkan penanggung jawab','Perbarui status'],
    'work:academic':['Buat pekerjaan materi','Tetapkan penanggung jawab','Review hasil'],
    'work:marketing':['Pilih kampanye atau konten','Atur penanggung jawab & jadwal','Review hasil'],
    'work:operations':['Pilih tugas atau kasus','Tetapkan penanggung jawab','Tindak lanjuti'],
    'work:finance':['Pilih tugas atau kasus','Tinjau transaksi terkait','Tindak lanjuti'],
    finance:['Catat transaksi','Cocokkan mutasi','Tinjau laporan'],
  };
  function workflow(key,items){
    const item=items.find(i=>i.key===key),id=item?.tab||key,steps=menuFlows[id];
    if(!item||!steps)return '';
    const curriculum=['courses','modules','lessons'],linked=curriculum.includes(id);
    const group=shortNames[item.group]||(item.group==='settings'?'Pengaturan':'Ruang Kerja');
    return `<nav class="workspace-breadcrumb" aria-label="Lokasi menu"><button type="button" data-workspace="home">Ringkasan</button><span aria-hidden="true">/</span><span>${esc(group)}</span><span aria-hidden="true">/</span><span>${esc(item.label)}</span></nav><ol class="workspace-steps" aria-label="Alur ${esc(item.label)}">${steps.map((label,index)=>{
      const target=linked?'tab:'+curriculum[index]:null,allowed=target&&items.some(i=>i.key===target);
      return `<li>${allowed?`<button type="button" data-workspace="${target}"${target===key?' aria-current="step"':''}>${index+1}. ${esc(label)}</button>`:`<span>${index+1}. ${esc(label)}</span>`}</li>`;
    }).join('')}</ol>`;
  }
  function validateCompany(data,staff){
    if(data?.version!==1||typeof data.isAdmin!=='boolean'||data.isAdmin!==staff.isAdmin||!Array.isArray(data.divisions)||!data.divisions.length||!data.scopes||!data.flows)throw new Error('invalid_company_access');
    if(data.divisions.some(d=>!divisions.some(known=>known.id===d.id)||typeof d.name!=='string'))throw new Error('invalid_company_access');
    if(new Set(data.divisions.map(d=>d.id)).size!==data.divisions.length)throw new Error('invalid_company_access');
    return data;
  }
  function search(items,query){
    const aliases={courses:'kelas kurikulum',modules:'bab',lessons:'materi soal quiz kuis',orders:'pembayaran transfer verifikasi',access:'enrollment masa aktif',users:'siswa murid',tts:'audio suara cache',ai:'prompt coaching',live:'jadwal kelas pertemuan',sensei:'guru pengajar',testimonials:'ulasan',desk:'tugas harian antrean',insights:'data analisis laporan',calendar:'jadwal konten',members:'karyawan staf izin',jobs:'notifikasi pengingat'};
    const words=String(query||'').trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
    return items.filter(item=>{
      const text=[item.label,item.group,shortNames[item.group],item.group==='finance'?'keuangan business administration':'',aliases[item.tab||item.key],item.key.startsWith('work:')?'tugas pekerjaan proyek':''].join(' ').toLocaleLowerCase('id-ID');
      return words.every(word=>text.includes(word));
    });
  }
  global.EzAdminWorkspace=Object.freeze({divisions,labels,routes,navigation,overview,workflow,search,validateCompany});
})(globalThis);
