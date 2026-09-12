import { createInsightsView } from './company-insights.js?v=unified-admin-20260912';
import { createDeskView } from './company-desk.js?v=unified-admin-20260912';

export async function mountCompanyWorkspace(host,{user,companyAccess,onRoute}) {
  const response=await fetch(new URL('./company-workspace.html',import.meta.url),{cache:'no-store'});
  if(!response.ok)throw new Error('workspace_template_unavailable');
  host.innerHTML=await response.text();
const $=id=>host.querySelector('#'+id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={task:'Pekerjaan',case:'Kasus',campaign:'Kampanye',content:'Konten',release:'Rilis'};
const statuses={draft:'Draf',ready:'Siap dikerjakan',doing:'Dikerjakan',blocked:'Terhambat',review:'Perlu review',done:'Selesai',archived:'Arsip',new:'Baru',triaged:'Ditinjau',waiting:'Menunggu',resolved:'Ditangani',approved:'Disetujui',active:'Aktif',paused:'Dijeda',completed:'Selesai',scheduled:'Terjadwal',published:'Terbit',measured:'Dievaluasi',testing:'Diuji',merged:'Merged',deployed:'Terpasang',verified:'Terverifikasi'};
const descriptions={technology:'Backlog dan rilis. Pisahkan status merged, terpasang, dan terverifikasi.',academic:'Pekerjaan materi dan pemeriksaan akademik. Editor materi existing tetap tersedia.',marketing:'Kampanye, review konten, kalender publikasi, dan tautan UTM.',operations:'Tindak lanjut siswa dan kasus diskusi. Data belajar tetap di sistem existing.',finance:'Kasus review bukti pembayaran. Status pembayaran berasal dari transaksi existing.'};
let access=companyAccess,division,items=[],courses=[],current=null,generation=0,insightsView,deskView,boardCursor='',boardNext=null,boardHistory=[];
function resetBoardPages(){boardCursor='';boardNext=null;boardHistory=[];}
function showWork(){insightsView?.close();deskView?.close();for(const id of ['toolbar','content','pagination','create-button'])$(id).hidden=false;$('context').textContent='PEKERJAAN TIM';}
function showInsights(){deskView?.close();generation++;for(const id of ['toolbar','content','pagination','create-button'])$(id).hidden=true;$('title').textContent='Data & Insights';$('context').textContent='PEMBELAJARAN → PERBAIKAN BISNIS';$('subtitle').textContent='Ringkasan berbasis bukti untuk keputusan lintas divisi. Data belajar existing tidak diubah.';host.querySelectorAll('[data-division]').forEach(b=>b.removeAttribute('aria-current'));notice('');}
function showDesk(mode){insightsView?.close();generation++;for(const id of ['toolbar','content','pagination','create-button'])$(id).hidden=true;$('title').textContent=mode==='calendar'?'Kalender Marketing':'Pusat Kerja Harian';$('context').textContent='AGENDA TIM';$('subtitle').textContent=mode==='calendar'?'Agenda bulanan dari jadwal yang sudah dicatat; tidak menerbitkan konten otomatis.':'Satu antrean untuk tugas pribadi, review, dan target lintas divisi sesuai izin.';host.querySelectorAll('[data-division]').forEach(b=>b.removeAttribute('aria-current'));notice('');}
async function api(path,body,method=body?'POST':'GET'){
 const res=await ezApi('/company'+path,{method,cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Permintaan gagal');return data;
}
function notice(message,error=false){$('notice').textContent=message;$('notice').className=error?'error':'';}
function localDate(value){if(!value)return '';const d=new Date(value);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
function date(value){return value?new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';}
function render(){
 const filtered=items;
 $('content').innerHTML=filtered.length?`<div class="table-wrap"><table><thead><tr><th>Pekerjaan</th><th>Status</th><th>Jadwal / diperbarui</th><th>Prioritas</th></tr></thead><tbody>${filtered.map(i=>`<tr><td><button class="item-button" data-item="${i.id}">${esc(i.title)}</button><div class="meta">${esc(labels[i.kind])}${i.source_payment_status?' · Pembayaran: '+esc(i.source_payment_status):''}</div></td><td><span class="badge">${esc(statuses[i.status]||i.status)}</span></td><td>${esc(date(i.scheduled_at||i.updated_at))}</td><td>${esc(i.priority)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h3>Belum ada pekerjaan pada tampilan ini</h3><p>Buat pekerjaan baru atau ambil kasus terbaru dari sistem existing.</p></div>';
 $('content').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>edit(items.find(i=>i.id===b.dataset.item)));
 $('previous').disabled=!boardHistory.length;$('next').disabled=!boardNext;$('page-label').textContent=`Halaman ${boardHistory.length+1}`;
}
async function load(){const ticket=++generation;$('refresh-button').disabled=true;$('previous').disabled=true;$('next').disabled=true;try{const params=new URLSearchParams({division,...($('filter').value?{status:$('filter').value}:{}),...(boardCursor?{cursor:boardCursor}:{})});const data=await api('/work?'+params);if(ticket!==generation)return;items=data.items;boardNext=data.nextCursor;render();notice('');}catch(e){if(ticket===generation){items=[];$('content').innerHTML='';notice(e.message,true);}}finally{if(ticket===generation)$('refresh-button').disabled=false;}}
function selectDivision(id){showWork();division=id;resetBoardPages();$('title').textContent=access.divisions.find(d=>d.id===id).name;$('subtitle').textContent=descriptions[id];$('sync-button').hidden=!['finance','operations'].includes(id)||Array.isArray(access.scopes[id]);host.querySelectorAll('[data-division]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.division===id)));load();}
function options(values,selected=''){return values.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');}
async function assignees(){const f=$('work-form');try{const result=await api(`/assignees?division=${division}&courseId=${encodeURIComponent(f.elements.courseId.value)}`);f.elements.assignedTo.innerHTML=options([['','Belum ditugaskan'],...result.people.map(p=>[p.id,p.full_name||p.id])],current?.assigned_to||'');}catch{f.elements.assignedTo.innerHTML='<option value="">Belum ditugaskan</option>';}}
function workFields(){
 const form=$('work-form'),kind=current?.kind||form.elements.kind.value;
 form.querySelectorAll('[data-work-kinds]').forEach(field=>{
   field.hidden=!field.dataset.workKinds.split(' ').includes(kind)&&!field.querySelector('input').value;
 });
}
async function edit(item=null){
 current=item;$('editor-notice').textContent='';$('editor-title').textContent=item?'Detail pekerjaan':'Pekerjaan baru';const f=$('work-form');f.reset();
 const kinds=division==='marketing'?['task','campaign','content']:division==='technology'?['task','release']:['task'];if(item&&!kinds.includes(item.kind))kinds.push(item.kind);
 f.elements.kind.innerHTML=options(kinds.map(k=>[k,labels[k]]),item?.kind||'task');f.elements.kind.disabled=!!item;
 const allowedCourses=Array.isArray(access.scopes[division])?courses.filter(c=>access.scopes[division].includes(c.id)):courses;
 f.elements.courseId.innerHTML=options([...(Array.isArray(access.scopes[division])?[]:[['','Lintas kursus']]),...allowedCourses.map(c=>[c.id,c.title])],item?.course_id||'');
 const mapping={title:'title',description:'description',priority:'priority',linkUrl:'link_url',releaseSha:'release_sha',publishedUrl:'published_url'};
 for(const [key,col]of Object.entries(mapping))f.elements[key].value=item?.[col]??(key==='priority'?'normal':'');f.elements.scheduledAt.value=localDate(item?.scheduled_at);
 workFields();
 f.querySelector('button[type=submit]').disabled=item?.status==='archived';
 $('transitions').innerHTML=item?`<span class="badge">${esc(statuses[item.status])}</span>`+(access.flows[item.kind][item.status]||[]).map(s=>`<button data-status="${s}">${esc(statuses[s])}</button>`).join(''):'';
 $('transitions').querySelectorAll('button').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await api('/work/'+item.id,{version:item.version,status:b.dataset.status},'PATCH');await load();await edit(r.item);}catch(e){$('editor-notice').textContent=e.message;}finally{b.disabled=false;}});
 $('link-builder').hidden=item?.kind!=='campaign';$('utm-result').value='';if(!$('editor').open)$('editor').showModal();await assignees();
}
$('work-form').elements.courseId.onchange=assignees;
$('work-form').elements.kind.onchange=workFields;
$('work-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type=submit]');button.disabled=true;const d=Object.fromEntries(new FormData(form));d.division=division;d.kind=current?.kind||d.kind;d.scheduledAt=d.scheduledAt?new Date(d.scheduledAt).toISOString():null;d.courseId=d.courseId||null;d.assignedTo=d.assignedTo||null;if(current)d.version=current.version;try{await api(current?'/work/'+current.id:'/work',d,current?'PATCH':'POST');$('editor').close();await load();notice('Pekerjaan tersimpan.');}catch(e){$('editor-notice').textContent=e.message;}finally{button.disabled=false;}};
$('utm-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('/work/'+current.id+'/link',Object.fromEntries(new FormData(e.currentTarget)));$('utm-result').value=r.url;}catch(e){$('editor-notice').textContent=e.message;}};
async function members(){const result=await api('/members');$('member-list').innerHTML=result.members.map(m=>`<div class="member-row"><strong>${esc(m.email)}</strong><br>${esc(m.role_key)} · ${esc(m.status)}<br><span class="meta">${esc(m.scopes.map(s=>s.type==='global'?'Global':s.courseId).join(', '))} · Berlaku: ${esc(date(m.expires_at))}</span>${m.status==='active'?`<br><button data-revoke="${m.id}">Cabut akses</button>`:''}</div>`).join('')||'<p>Belum ada staf terbatas.</p>';host.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Cabut keanggotaan ini? Akun, progres, dan pembelian tidak dihapus.'))return;try{await api('/members/'+b.dataset.revoke+'/revoke',{});await members();}catch(e){$('member-notice').textContent=e.message;}});}
$('member-form').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;const d=Object.fromEntries(new FormData(e.currentTarget));try{const people=await api('/people?email='+encodeURIComponent(d.email));if(people.people.length!==1)throw new Error('Akun existing tidak ditemukan secara unik.');await api('/members',{userId:people.people[0].id,role:d.role,scopes:[d.courseId?{type:'course',courseId:d.courseId}:{type:'global'}],expiresAt:d.expiresAt?new Date(d.expiresAt).toISOString():null});$('member-notice').textContent='Akses tersimpan. Aktivasi staf mengikuti sakelar server.';await members();}catch(e){$('member-notice').textContent=e.message;}finally{b.disabled=false;}};
$('members-button').onclick=async()=>{$('member-notice').textContent='';$('members').showModal();try{await members();}catch(e){$('member-notice').textContent=e.message;}};
$('jobs-button').onclick=async()=>{showWork();const ticket=++generation;try{const r=await api('/jobs');if(ticket!==generation)return;notice(`${r.jobs.filter(j=>j.state==='failed').length} pengingat gagal dari ${r.jobs.length} pekerjaan terbaru. Pengingat tidak memublikasikan konten.`);$('content').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Pengingat</th><th>Status</th><th>Percobaan</th></tr></thead><tbody>${r.jobs.map(j=>`<tr><td>${esc(date(j.available_at))}</td><td>${esc(j.state)}</td><td>${j.attempts}</td></tr>`).join('')}</tbody></table></div>`;}catch(e){if(ticket===generation)notice(e.message,true);}};
$('sync-button').onclick=async()=>{try{const r=await api('/cases/sync',{division});await load();notice(`${r.created} kasus baru. Status transaksi tidak diubah.`);}catch(e){notice(e.message,true);}};
host.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('create-button').onclick=()=>edit();$('refresh-button').onclick=()=>{resetBoardPages();load();};$('filter').onchange=()=>{resetBoardPages();load();};
$('previous').onclick=()=>{if(boardHistory.length){boardCursor=boardHistory.pop();load();}};$('next').onclick=()=>{if(boardNext){boardHistory.push(boardCursor);boardCursor=boardNext;load();}};

access.userId=user.id;
courses=(await api('/courses')).courses;
$('divisions').innerHTML=access.divisions.map(d=>`<button data-division="${d.id}">${esc(d.name)}</button>`).join('');
host.querySelectorAll('[data-division]').forEach(b=>b.onclick=()=>selectDivision(b.dataset.division));
$('filter').innerHTML=options([['','Semua status'],...Object.entries(statuses)]);
$('members-button').hidden=!access.isAdmin;$('jobs-button').hidden=!access.isAdmin;
$('member-form').elements.role.innerHTML=options(access.divisions.map(d=>[d.id,d.name]));
$('member-form').elements.courseId.innerHTML=options([['','Global — seluruh divisi'],...courses.map(c=>[c.id,c.title])]);
insightsView=createInsightsView({root:host,api,access,courses,onOpen:showInsights});
deskView=createDeskView({root:host,api,access,courses,statuses,labels,onOpen:showDesk,onItem:item=>{
  selectDivision(item.division_key);onRoute?.('work:'+item.division_key);edit(item);
}});
return {
  open(key) {
    if(key.startsWith('work:')){const id=key.slice(5);if(!access.divisions.some(d=>d.id===id))throw new Error('division_scope_required');selectDivision(id);return;}
    const ids={desk:'desk-button',calendar:'calendar-button',insights:'insights-button',members:'members-button',jobs:'jobs-button'};
    const button=$(ids[key]);if(!button||button.hidden)throw new Error('workspace_view_unavailable');
    if(key==='members'||key==='jobs'){
      showWork();generation++;$('title').textContent=key==='members'?'Akses staf':'Pengingat';
      $('subtitle').textContent=key==='members'?'Pengelolaan staf terbatas; hak admin penuh tetap terpisah.':'Pengingat internal, bukan publikasi otomatis.';
      for(const id of ['toolbar','pagination','create-button'])$(id).hidden=true;
      $('content').innerHTML='';notice('');
    }
    button.onclick();
    if(key==='jobs')for(const id of ['toolbar','pagination','create-button'])$(id).hidden=true;
  },
  close(){generation++;insightsView?.close();deskView?.close();host.querySelectorAll('dialog[open]').forEach(d=>d.close());},
};

}
