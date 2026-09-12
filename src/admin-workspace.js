// Navigation only. Existing API guards remain authoritative; never infer grants.
(function (global) {
  'use strict';
  const divisions = [
    {id:'technology',name:'Product & Technology',description:'Pengembangan produk, rilis dan tooling.',tabs:['tts','ai']},
    {id:'academic',name:'Academic & Learning',description:'Kurikulum, materi, kuis dan kelas.',tabs:['courses','modules','lessons','live']},
    {id:'marketing',name:'Growth & Marketing',description:'Kampanye, konten, sensei dan testimoni.',tabs:['sensei','testimonials']},
    {id:'operations',name:'Student Success & Operations',description:'Layanan siswa, diskusi dan akses belajar.',tabs:['users','discussions','access']},
    {id:'finance',name:'Finance & Business Administration',description:'Pesanan, pembayaran dan administrasi.',tabs:['orders']},
  ];
  const labels={courses:'Kursus',modules:'Modul',lessons:'Pelajaran & Kuis',live:'Live Class',sensei:'Sensei',testimonials:'Testimoni',users:'Pengguna',discussions:'Diskusi',access:'Beri Akses',orders:'Pesanan',tts:'TTS Cache',ai:'AI'};
  const shortNames={technology:'Produk & Teknologi',academic:'Akademik',marketing:'Marketing',operations:'Operasional Siswa',finance:'Keuangan'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function hasWork(company,id){return !!company?.divisions?.some(d=>d.id===id)&&(company.isAdmin===true||company.scopes?.[id]==='global'||(Array.isArray(company.scopes?.[id])&&company.scopes[id].length>0));}
  function routes(staff,company,canOpen){
    const result=[{key:'home',label:'Ringkasan',group:'general'}];
    if(divisions.some(d=>hasWork(company,d.id)))result.push({key:'desk',label:'Pusat Kerja Harian',group:'general'});
    if(company?.insights?.enabled&&Object.keys(company.insights.scopes||{}).length)result.push({key:'insights',label:'Data & Insights',group:'general'});
    for(const d of divisions){
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
  function validateCompany(data,staff){
    if(data?.version!==1||typeof data.isAdmin!=='boolean'||data.isAdmin!==staff.isAdmin||!Array.isArray(data.divisions)||!data.divisions.length||!data.scopes||!data.flows)throw new Error('invalid_company_access');
    if(data.divisions.some(d=>!divisions.some(known=>known.id===d.id)||typeof d.name!=='string'))throw new Error('invalid_company_access');
    if(new Set(data.divisions.map(d=>d.id)).size!==data.divisions.length)throw new Error('invalid_company_access');
    return data;
  }
  global.EzAdminWorkspace=Object.freeze({divisions,labels,routes,navigation,overview,validateCompany});
})(globalThis);
