(function () {
  'use strict';
  const {catalog, esc} = window.EzDialogue;
  const clone = value => JSON.parse(JSON.stringify(value));
  const profile = key => (window.__dialogSpeakers || []).find(s => s.character_key === key);
  const current = () => window.__dialogScene;
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
    return `<section class="ez-scene-admin"><h4>Karakter &amp; latar</h4>
      <label><input type="checkbox" ${scene.enabled?'checked':''} onchange="EzDialogueAdmin.toggle(this.checked)"> Tampilkan panggung dialog</label>
      <div class="ez-scene-backgrounds">${catalog.backgrounds.map(b=>`<button type="button" aria-pressed="${scene.backgroundKey===b.key}" onclick="EzDialogueAdmin.background('${b.key}')">${b.asset?`<img loading="lazy" src="/assets/dialogue/${b.key}-mobile.webp" alt="">`:'<span class="ez-no-background"></span>'}${esc(b.name)}</button>`).join('')}</div>
      <div class="ez-scene-slots">${scene.participants.map((p,i)=>{
        const c = catalog.characters.find(c=>c.key===p.characterKey);
        const speakers = [...new Set([...(window.__dialogRows||[]).map(r=>r.speaker).filter(s=>s&&s!=='N'),...scene.participants.map(p=>p.speaker)])];
        const other=scene.participants[1-i];
        return `<div class="ez-scene-slot"><div class="ez-character-name">Tokoh ${p.position==='left'?'kiri':'kanan'}</div>
          <label>Pemeran<select aria-label="Pemeran" onchange="EzDialogueAdmin.character(${i},this.value)">${catalog.characters.map(c=>`<option value="${c.key}"${c.key===p.characterKey?' selected':''}${c.key===other.characterKey?' disabled':''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label>Pembicara naskah<select aria-label="Pembicara naskah" onchange="EzDialogueAdmin.mapping(${i},this.value)">${speakers.map((s,j)=>`<option value="${esc(s)}"${s===p.speaker?' selected':''}${s===other.speaker?' disabled':''}>${esc(/^[A-Z][0-9]?$/.test(s)?`Pembicara ${j+1}`:s)}</option>`).join('')}</select></label>
          <label><input type="checkbox" ${p.custom?'checked':''} onchange="EzDialogueAdmin.custom(${i},this.checked)"> Kustom dialog ini</label>
          <label>Nama tampilan<input maxlength="40" value="${esc(p.displayName)}" ${p.custom?'':'disabled'} oninput="EzDialogueAdmin.field(${i},'displayName',this.value)"></label>
          <label>Suara<select aria-label="Suara" ${p.custom?'':'disabled'} onchange="EzDialogueAdmin.voice(${i},this.value)">${voiceOptions(p.voiceId)}</select></label>
          <small>${esc(p.voiceName || 'Suara belum diatur')}</small>
          <button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.editProfile('${c.key}')">Profil ${esc(c.name)}</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="EzDialogueAdmin.latest(${i})">Gunakan profil terbaru</button>
        </div>`;
      }).join('')}</div>
      <div id="ez-admin-scene-preview">${window.EzDialogue.html(scene,window.__dialogRows.map(r=>({speaker:r.speaker,text:r.jp})))}</div>
    </section>`;
  }
  function render() { window.admRenderDialogModal(); }
  function mount() { window.EzDialogue.mount(document.getElementById('ez-admin-scene-preview')); }
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
  window.EzDialogueAdmin = {
    html, load, mount, options,
    toggle(enabled){ensure().enabled=enabled;render();},
    background(key){ensure().backgroundKey=key;render();},
    character(i,key){const scene=ensure();if(scene.participants.some((p,j)=>j!==i&&p.characterKey===key))return;const p=scene.participants[i];scene.participants[i]=snapshot(key,p.position,p.speaker);render();},
    mapping(i,speaker){const scene=ensure();if(scene.participants.some((p,j)=>j!==i&&p.speaker===speaker))return;scene.participants[i].speaker=speaker;render();},
    async custom(i,on){const scene=ensure(),p=scene.participants[i];if(!on){scene.participants[i]=snapshot(p.characterKey,p.position,p.speaker);}else{p.custom=true;try{await admLoadElevenVoices();}catch{notify('Katalog suara belum tersedia.',true);}}render();},
    field(i,field,value){if(field==='displayName')ensure().participants[i][field]=value;},
    voice(i,id){const v=(window.__elevenVoices||[]).find(v=>v.voiceId===id);Object.assign(ensure().participants[i],{voiceId:v?.voiceId||null,voiceName:v?.name||''});render();},
    latest(i){const scene=ensure(),p=scene.participants[i];scene.participants[i]=snapshot(p.characterKey,p.position,p.speaker);render();},
    editProfile,
    back(){stopPreview();render();},
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
      const ta=tr?.querySelector('[name="dialog_scene"]');if(ta)ta.value=scene?JSON.stringify(clone(scene)):'';
    }
  };
})();
