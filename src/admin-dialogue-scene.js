(function () {
  'use strict';
  const {catalog, esc} = window.EzDialogue;
  const clone = value => JSON.parse(JSON.stringify(value));
  const profile = key => (window.__dialogSpeakers || []).find(s => s.character_key === key);
  const current = () => window.__dialogScene;
  const listening = () => window.__dialogMode === 'listening';
  function snapshot(key, position, speaker) {
    const c = catalog.characters.find(c => c.key === key), p = profile(key);
    return {characterKey:key, position, speaker, displayName:p?.default_display_name || c.displayName,
      voiceId:p?.voice_id || null, voiceName:p?.voice_name || '', profileVersion:p?.profile_version || 1, custom:false};
  }
  function defaults() {
    const speakers = [...new Set((window.__dialogRows || []).map(r=>r.speaker).filter(s=>s && s!=='N'))];
    return {schemaVersion:1, enabled:false, backgroundKey:'classroom', participants:[
      snapshot('anna-wijaya','left',speakers[0] || 'C1'), snapshot('hadi-pratama','right',speakers[1] || 'C2')
    ]};
  }
  function load(tr) {
    try { window.__dialogScene = JSON.parse(tr.querySelector('[name="dialog_scene"]')?.value || 'null'); }
    catch { window.__dialogScene = null; }
    // Saved expressions follow their line only while speaker and text match.
    const saved = window.__dialogScene?.expressions;
    (window.__dialogRows || []).forEach((r, i) => {
      const e = saved?.[i];
      r.expression = e && e.speaker === r.speaker && e.text === r.jp.trim() ? e.expression : '';
    });
  }
  function prepareListening() {
    if (current()) return;
    const speakers = [...new Set((window.__dialogRows || []).map(r=>r.speaker).filter(s=>s && s!=='N'))];
    const used = new Set();
    const participants = [0,1].map(i => {
      const speaker = speakers[i] || `C${i+1}`;
      const female = /^(a|w|f|女)$/i.test(speaker);
      const candidates = female ? ['anna-wijaya','aoi-takahashi','claire-bennett'] : ['hadi-pratama','ren-mori','daniel-foster'];
      const key = candidates.find(key=>!used.has(key)); used.add(key);
      const p = snapshot(key, i===0?'left':'right', speaker);
      // Legacy codes only suggest an initial cast. The selected voice is
      // explicit and validated before it can be applied to the question.
      return p;
    });
    window.__dialogScene = {schemaVersion:1,enabled:false,backgroundKey:'none',participants};
  }
  function ensure() { return window.__dialogScene ||= defaults(); }
  function voiceOptions(selected) {
    const voices = window.__elevenVoices || [];
    return `<option value="">Suara belum diatur</option>` +
      (selected && !voices.some(v=>v.voiceId===selected) ? `<option value="${esc(selected)}" selected>Suara tersimpan (muat katalog untuk memeriksa)</option>` : '') +
      voices.map(v=>`<option value="${esc(v.voiceId)}"${v.voiceId===selected?' selected':''}>${esc([v.name,v.labels?.language,v.labels?.accent].filter(Boolean).join(' - '))}</option>`).join('');
  }
  function html() {
    const scene = current() || defaults();
    return `<section class="ez-scene-admin"><h4>${listening() ? 'Karakter &amp; suara' : 'Karakter &amp; latar'}</h4>
      ${listening() ? '' : `
      <label><input type="checkbox" ${scene.enabled?'checked':''} onchange="EzDialogueAdmin.toggle(this.checked)"> Tampilkan panggung dialog</label>
      <div class="ez-scene-backgrounds">${catalog.backgrounds.map(b=>`<button type="button" aria-pressed="${scene.backgroundKey===b.key}" onclick="EzDialogueAdmin.background('${b.key}')">${b.asset?`<img loading="lazy" src="/assets/dialogue/${b.key}-mobile.webp" alt="">`:'<span class="ez-no-background"></span>'}${esc(b.name)}</button>`).join('')}</div>`}
      <div class="ez-scene-slots">${scene.participants.map((p,i)=>{
        const c = catalog.characters.find(c=>c.key===p.characterKey);
        const speakers = [...new Set([...(window.__dialogRows||[]).map(r=>r.speaker).filter(s=>s&&s!=='N'),...scene.participants.map(p=>p.speaker)])];
        const other=scene.participants[1-i];
        return `<div class="ez-scene-slot"><div class="ez-character-name">${listening() ? `Karakter ${i+1}` : `Tokoh ${p.position==='left'?'kiri':'kanan'}`}</div>
          <label>Pemeran<select aria-label="Pemeran" onchange="EzDialogueAdmin.character(${i},this.value)">${catalog.characters.map(c=>`<option value="${c.key}"${c.key===p.characterKey?' selected':''}${c.key===other.characterKey?' disabled':''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label>Pembicara naskah<select aria-label="Pembicara naskah" onchange="EzDialogueAdmin.mapping(${i},this.value)">${speakers.map((s,j)=>`<option value="${esc(s)}"${s===p.speaker?' selected':''}${s===other.speaker?' disabled':''}>${esc(/^[A-Z][0-9]?$/.test(s)?`Pembicara ${j+1}`:s)}</option>`).join('')}</select></label>
          <label><input type="checkbox" ${p.custom?'checked':''} onchange="EzDialogueAdmin.custom(${i},this.checked)"> Kustom ${listening()?'soal':'dialog'} ini</label>
          <label>Nama tampilan<input maxlength="40" value="${esc(p.displayName)}" ${p.custom?'':'disabled'} oninput="EzDialogueAdmin.field(${i},'displayName',this.value)"></label>
          <label>Suara<select aria-label="Suara" ${p.custom?'':'disabled'} onchange="EzDialogueAdmin.voice(${i},this.value)">${voiceOptions(p.voiceId)}</select></label>
          <small>${esc(p.voiceName || 'Suara belum diatur')}</small>
          <button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.editProfile('${c.key}')">Profil ${esc(c.name)}</button>
          ${listening() ? '' : `<button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.editArt('${c.key}')">Gambar &amp; ekspresi</button>`}
          <button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.latest(${i})">Gunakan profil terbaru</button>
        </div>`;
      }).join('')}</div>
      ${listening() ? '' : `<div id="ez-admin-scene-preview">${window.EzDialogue.html(scene,window.__dialogRows.map(r=>({speaker:r.speaker,text:r.jp.trim()})),window.EzDialogueFuriganaAdmin?.data())}</div>`}
    </section>`;
  }
  function render() { window.admRenderDialogModal(); }
  function mount() { if (!listening()) window.EzDialogue.mount(document.getElementById('ez-admin-scene-preview')); }
  function options(selected) {
    return (current()?.participants || []).map(p=>`<option value="${esc(p.speaker)}"${selected===p.speaker?' selected':''}>${esc(p.displayName)} - ${esc(catalog.characters.find(c=>c.key===p.characterKey)?.name)}</option>`).join('');
  }
  async function editProfile(key) {
    const p=profile(key), c=catalog.characters.find(c=>c.key===key);
    if(!p){notify('Profil belum tersedia. Jalankan migrasi karakter terlebih dahulu.',true);return;}
    try { await admLoadElevenVoices(true); } catch { notify('Katalog suara belum tersedia. Nama profil tetap dapat disimpan.',true); }
    window.__editingCharacter=key;
    openModal(`<h3>${esc(c.name)}</h3><div class="ez-scene-profile">
      <label>Nama tampilan bawaan<input id="ez-profile-name" maxlength="40" value="${esc(p.default_display_name||c.displayName)}"></label>
      <label>Suara bawaan<select aria-label="Suara bawaan" id="ez-profile-voice">${voiceOptions(p.voice_id)}</select></label>
      <button class="btn btn-ghost" type="button" onclick="EzDialogueAdmin.previewVoice()">Dengar sampel</button>
      <audio id="ez-profile-audio" controls hidden></audio></div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="EzDialogueAdmin.back()">Kembali</button><button class="btn btn-primary" onclick="EzDialogueAdmin.saveProfile(this)">Simpan profil</button></div>`);
  }
  function stopPreview() { const audio=document.getElementById('ez-profile-audio');if(audio){audio.pause();audio.removeAttribute('src');} }

  // ── Character art: uploaded base picture + expression pack (migration 177).
  // Uploads are saved immediately; the dialogue itself only stores which
  // expression each line uses (dialog_scene.expressions).
  const BASE_NAMES = new Set(['base','dasar','netral','neutral','default','bawaan']);
  const MAX_BYTES = 2 * 1024 * 1024;
  const slug = label => String(label || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
  const labelFromFile = name => { const t = String(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const artFor = key => window.EzDialogue.artFor?.(key) || {base: null, expressions: []};
  function thumb(key, expression) {
    const pic = window.EzDialogue.picture(key, expression);
    return pic ? `<img alt="" src="${esc(pic.src)}"${pic.mask ? ` style="mask-image:url(${esc(pic.mask)})"` : ''}>` : '';
  }
  // Downscale to the stage's working size, refuse art without a transparent
  // background (it would show as a box over the scene), and re-encode to WebP
  // (PNG where the browser cannot encode WebP, e.g. Safari).
  async function prepareArt(file) {
    if (!/^image\/(png|webp)$/.test(file.type) && !/\.(png|webp)$/i.test(file.name)) throw new Error(`${file.name}: gunakan PNG atau WebP berlatar transparan.`);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`${file.name}: gambar tidak terbaca.`)); i.src = url; });
      const scale = Math.min(1, 960 / img.naturalWidth, 1440 / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = Object.assign(document.createElement('canvas'), {width: w, height: h});
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let clear = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] < 250) clear++;
      if (clear < (w * h / 4) * 0.02) throw new Error(`${file.name}: latarnya belum transparan. Hapus latarnya dulu (mis. remove.bg), lalu unggah sebagai PNG/WebP.`);
      for (const [type, quality] of [['image/webp', 0.92], ['image/webp', 0.8], ['image/png']]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
        if (blob && blob.type === type && blob.size <= MAX_BYTES) return blob;
      }
      throw new Error(`${file.name}: gambar masih di atas 2 MB setelah dikompres.`);
    } finally { URL.revokeObjectURL(url); }
  }
  function uploadArt(expression, blob, label, mode) {
    const form = new FormData();
    if (label) form.append('label', label);
    if (mode) form.append('mode', mode);
    form.append('file', blob, `${expression}.${blob.type === 'image/png' ? 'png' : 'webp'}`);
    return api(`/admin/dialogue-art/${encodeURIComponent(window.__artCharacter)}/${encodeURIComponent(expression)}`, {method: 'PUT', body: form});
  }
  function artHtml(key) {
    const c = catalog.characters.find(c => c.key === key), own = artFor(key);
    const actions = (expression, extra) => `<div class="ez-art-actions"><label class="btn btn-ghost btn-sm">Ganti gambar<input type="file" accept="image/png,image/webp" hidden onchange="EzDialogueAdmin.replaceArt('${expression}',this)"></label>${extra}</div>`;
    return `<h3>Gambar &amp; ekspresi — ${esc(c.name)}</h3>
      <p class="ez-art-hint">PNG/WebP berlatar transparan. Samakan bingkai semua gambar satu karakter (ukuran, pose, posisi); cukup wajahnya yang berbeda, supaya karakter tidak bergeser saat ekspresinya berganti.</p>
      <div class="ez-art-grid">
        <div class="ez-art-card"><div class="ez-art-thumb">${thumb(key, null)}</div><strong>Dasar</strong><small>${own.base ? 'Unggahan' : 'Bawaan aplikasi'} · dipakai saat netral</small>
          ${actions('base', own.base ? `<button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.removeArt('base')">Kembalikan bawaan</button>` : '')}</div>
        ${own.expressions.map(e => `<div class="ez-art-card"><div class="ez-art-thumb">${thumb(key, e.key)}</div>
          <input type="text" aria-label="Nama ekspresi" maxlength="40" value="${esc(e.label)}" onchange="EzDialogueAdmin.renameArt('${e.key}',this)"><small>kode: ${esc(e.key)}</small>
          ${actions(e.key, `<button type="button" class="btn btn-danger btn-sm" onclick="EzDialogueAdmin.removeArt('${e.key}')">Hapus</button>`)}</div>`).join('')}
      </div>
      <div class="ez-art-add"><input type="text" id="ez-art-new" maxlength="40" placeholder="Nama ekspresi baru, mis. Kaget">
        <label class="btn btn-primary btn-sm" onclick="if(!EzDialogueAdmin.newArtName())event.preventDefault()">+ Tambah &amp; pilih gambar<input type="file" accept="image/png,image/webp" hidden onchange="EzDialogueAdmin.addArt(this)"></label></div>
      <div class="ez-art-add"><label class="btn btn-ghost btn-sm">Unggah paket (banyak file)<input type="file" accept="image/png,image/webp" multiple hidden onchange="EzDialogueAdmin.uploadPack(this)"></label>
        <small>Nama file menjadi nama ekspresi: <code>kaget.png</code> → Kaget. <code>dasar.png</code> mengganti gambar dasar. Nama yang sudah ada diganti gambarnya.</small></div>
      <p class="ez-art-status" id="ez-art-status" role="status"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="EzDialogueAdmin.back()">Kembali</button></div>`;
  }
  function renderArt() {
    openModal(artHtml(window.__artCharacter));
    const mc = document.getElementById('modal-content');
    if (mc) mc.style.maxWidth = '760px';
  }
  async function refreshArt() { await window.EzDialogue.art(true); if (window.__artCharacter) renderArt(); }
  function busy(message) {
    const status = document.getElementById('ez-art-status');
    if (status) status.textContent = message || '';
    document.querySelectorAll('#modal-content .ez-art-card input, #modal-content .ez-art-add input, #modal-content .ez-art-grid button, #modal-content .ez-art-add .btn').forEach(el => {
      if (el.tagName === 'LABEL') el.classList.toggle('is-busy', !!message); else el.disabled = !!message;
    });
  }
  async function runArt(message, work) {
    busy(message);
    try { await work(); await refreshArt(); return true; }
    catch (err) { busy(''); notify(err.message, true); return false; }
  }
  // Per-turn expression picker in the dialogue rows; only for a mapped
  // character, never for the narrator or in listening questions.
  function expressionSelect(r, i) {
    const p = !listening() && current()?.participants.find(p => p.speaker === r.speaker);
    if (!p) return '';
    const list = artFor(p.characterKey).expressions;
    const missing = r.expression && !list.some(e => e.key === r.expression);
    return `<select aria-label="Ekspresi" style="max-width:100%;" title="Ekspresi karakter saat giliran ini diucapkan" onchange="EzDialogueAdmin.expression(${i},this.value)">
      <option value="">Ekspresi: netral</option>${list.map(e => `<option value="${esc(e.key)}"${e.key === r.expression ? ' selected' : ''}>Ekspresi: ${esc(e.label)}</option>`).join('')}
      ${missing ? `<option value="${esc(r.expression)}" selected>⚠️ ${esc(r.expression)} (gambar tidak ada)</option>` : ''}</select>`;
  }
  window.EzDialogueAdmin = {
    html, load, mount, options, prepareListening,
    toggle(enabled){ensure().enabled=enabled;render();},
    background(key){ensure().backgroundKey=key;render();},
    character(i,key){const scene=ensure();if(scene.participants.some((p,j)=>j!==i&&p.characterKey===key))return;const p=scene.participants[i];scene.participants[i]=snapshot(key,p.position,p.speaker);render();},
    mapping(i,speaker){const scene=ensure();if(scene.participants.some((p,j)=>j!==i&&p.speaker===speaker))return;scene.participants[i].speaker=speaker;render();},
    async custom(i,on){const scene=ensure(),p=scene.participants[i];if(!on){scene.participants[i]=snapshot(p.characterKey,p.position,p.speaker);}else{p.custom=true;try{await admLoadElevenVoices();}catch{notify('Katalog suara belum tersedia.',true);}}render();},
    field(i,field,value){if(field==='displayName')ensure().participants[i][field]=value;},
    voice(i,id){const v=(window.__elevenVoices||[]).find(v=>v.voiceId===id);Object.assign(ensure().participants[i],{voiceId:v?.voiceId||null,voiceName:v?.name||''});render();},
    async latest(i){
      const scene=ensure(),p=scene.participants[i];
      try{await admLoadDialogSpeakers(true);}catch(err){notify('Gagal memuat profil terbaru: '+err.message,true);return;}
      if(current()!==scene || scene.participants[i]!==p)return;
      scene.participants[i]=snapshot(p.characterKey,p.position,p.speaker);render();
    },
    editProfile, expressionSelect,
    back(){stopPreview();window.__artCharacter=null;render();},
    async editArt(key){await window.EzDialogue.art(true);window.__artCharacter=key;renderArt();},
    newArtName(){
      const label=document.getElementById('ez-art-new')?.value.trim()||'',key=slug(label);
      if(!label){notify('Tulis nama ekspresi dulu, mis. Kaget.',true);return null;}
      if(!key||BASE_NAMES.has(key)){notify('Nama ekspresi harus memuat huruf latin atau angka, dan bukan "Dasar".',true);return null;}
      if(artFor(window.__artCharacter).expressions.some(e=>e.key===key)){notify(`Ekspresi "${label}" sudah ada. Pakai "Ganti gambar" pada kartunya.`,true);return null;}
      return {label,key};
    },
    async addArt(input){
      const file=input.files?.[0],name=this.newArtName();input.value='';
      if(!file||!name)return;
      await runArt('Mengunggah…',async()=>uploadArt(name.key,await prepareArt(file),name.label,'create'))&&notify(`Ekspresi "${name.label}" ditambahkan.`);
    },
    async replaceArt(expression,input){
      const file=input.files?.[0];input.value='';
      if(!file)return;
      const label=expression==='base'?'':artFor(window.__artCharacter).expressions.find(e=>e.key===expression)?.label;
      await runArt('Mengunggah…',async()=>uploadArt(expression,await prepareArt(file),label,''))&&notify('Gambar diganti.');
    },
    async renameArt(expression,input){
      const label=input.value.trim();
      if(!label){notify('Nama ekspresi tidak boleh kosong.',true);return renderArt();}
      await runArt('Menyimpan…',()=>api(`/admin/dialogue-art/${encodeURIComponent(window.__artCharacter)}/${encodeURIComponent(expression)}`,{method:'PUT',body:JSON.stringify({label})}));
    },
    async removeArt(expression){
      const e=artFor(window.__artCharacter).expressions.find(e=>e.key===expression);
      const question=expression==='base'?'Kembalikan gambar dasar ke gambar bawaan aplikasi?':`Hapus ekspresi "${e?.label||expression}"? Giliran dialog yang memakainya akan tampil dengan gambar dasar.`;
      if(!confirm(question))return;
      await runArt('Menghapus…',()=>api(`/admin/dialogue-art/${encodeURIComponent(window.__artCharacter)}/${encodeURIComponent(expression)}`,{method:'DELETE'}));
    },
    async uploadPack(input){
      const files=[...(input.files||[])];input.value='';
      if(!files.length)return;
      const failed=[];let done=0;
      busy(`Mengunggah 0/${files.length}…`);
      for(const file of files){
        const label=labelFromFile(file.name),key=slug(label),base=BASE_NAMES.has(key);
        try{
          if(!base&&!key)throw new Error(`${file.name}: nama file harus memuat huruf latin atau angka.`);
          const exists=artFor(window.__artCharacter).expressions.some(e=>e.key===key);
          await uploadArt(base?'base':key,await prepareArt(file),base?'':label,base||exists?'':'create');
          done++;
        }catch(err){failed.push(err.message);}
        busy(`Mengunggah ${done+failed.length}/${files.length}…`);
        await window.EzDialogue.art(true);
      }
      await refreshArt();
      notify(failed.length?`${done} gambar terunggah, ${failed.length} gagal: ${failed.join(' · ')}`:`${done} gambar terunggah.`,!!failed.length);
    },
    expression(i,key){
      const r=(window.__dialogRows||[])[i];if(!r)return;r.expression=key;
      const p=current()?.participants.find(p=>p.speaker===r.speaker);
      if(p)window.EzDialogue.pose(document.getElementById('ez-admin-scene-preview'),p,key||null);
    },
    previewVoice(){const v=(window.__elevenVoices||[]).find(v=>v.voiceId===document.getElementById('ez-profile-voice').value);const a=document.getElementById('ez-profile-audio');if(!v?.previewUrl){notify('Sampel suara tidak tersedia.',true);return;}a.src=v.previewUrl;a.hidden=false;a.play().catch(()=>notify('Sampel tidak dapat diputar.',true));},
    async saveProfile(btn){
      const p=profile(window.__editingCharacter),name=document.getElementById('ez-profile-name').value.trim(),id=document.getElementById('ez-profile-voice').value;
      if(!name){notify('Isi nama tampilan.',true);return;}btn.disabled=true;
      try{await api('/admin/dialogue-speakers/'+p.id,{method:'PUT',body:JSON.stringify({displayName:name,voiceId:id})});await admLoadDialogSpeakers(true);stopPreview();render();notify('Profil tersimpan. Pilih Gunakan profil terbaru untuk memperbarui dialog ini.');}catch(err){notify(err.message,true);btn.disabled=false;}
    },
    save(tr){
      const scene=current();
      if(scene && scene.participants.some(p=>!p.displayName.trim()))throw new Error('Isi nama tampilan pemeran.');
      const speakers=new Set((window.__dialogRows||[]).filter(r=>r.jp.trim()&&r.speaker!=='N').map(r=>r.speaker));
      if(scene && [...speakers].some(s=>!scene.participants.some(p=>p.speaker===s)))throw new Error('Petakan setiap pembicara naskah ke tokoh kiri atau kanan.');
      if(listening() && scene && [...speakers].some(s=>!scene.participants.find(p=>p.speaker===s)?.voiceId))throw new Error('Pilih suara ElevenLabs untuk setiap karakter yang berbicara.');
      // Aligned with the lines the student sees (empty rows are dropped when
      // the dialogue is serialized), keyed by speaker + text like furigana.
      if(scene && !listening()){
        const lines=(window.__dialogRows||[]).filter(r=>r.jp.trim()).map(r=>r.expression&&scene.participants.some(p=>p.speaker===r.speaker)
          ?{speaker:r.speaker,text:r.jp.trim(),expression:r.expression}:null);
        if(lines.some(Boolean))scene.expressions=lines;else delete scene.expressions;
      }
      const ta=tr?.querySelector('[name="dialog_scene"]');if(ta)ta.value=scene?JSON.stringify(clone(scene)):'';
    }
  };
})();
