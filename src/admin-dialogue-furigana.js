(function () {
  'use strict';
  const F = window.EzFurigana;
  function data(rows = window.__dialogRows || []) {
    return {schemaVersion:1, lines:rows.filter(r => r.jp.trim()).map(r => ({speaker:r.speaker, text:r.jp.trim(),
      readings:r.furiganaText === r.jp.trim() ? (r.furigana || []).filter(r=>r.reading.trim()) : []}))};
  }
  function load(tr) {
    let saved;
    try { saved = F.normalize(JSON.parse(tr.querySelector('[name="dialog_furigana"]')?.value || 'null')); } catch { saved = null; }
    (window.__dialogRows || []).forEach((r,i) => {
      r.furiganaText = r.jp.trim();
      r.furigana = F.lineFor(saved,i,{speaker:r.speaker,text:r.furiganaText})?.readings || [];
    });
  }
  function fields(r, i) {
    const text=r.jp.trim(), spans=F.groups(text);
    if (!spans.length) return '';
    return `<details class="ez-furigana-editor" open><summary>Furigana</summary><div class="ez-furigana-fields">${spans.map((s,j)=>{
      const value=r.furiganaText===text ? r.furigana?.find(v=>v.start===s.start&&v.end===s.end)?.reading || '' : '';
      return `<label><span lang="ja">${F.escape(s.text)}</span><input aria-label="Bacaan ${F.escape(s.text)} (${j+1})" lang="ja" maxlength="64" placeholder="よみ" value="${F.escape(value)}" oninput="EzDialogueFuriganaAdmin.edit(${i},${s.start},${s.end},this.value)"></label>`;
    }).join('')}</div><div id="dlg-furigana-preview-${i}" lang="ja" class="ez-furigana-preview">${F.html(text,{text,readings:r.furiganaText===text?r.furigana||[]:[]})}</div></details>`;
  }
  function refreshStage() {
    const scene=window.__dialogScene, root=document.getElementById('ez-admin-scene-preview');
    if(root && scene){root.innerHTML=EzDialogue.html(scene,window.__dialogRows.map(r=>({speaker:r.speaker,text:r.jp.trim()})),data());EzDialogue.mount(root);}
  }
  window.EzDialogueFuriganaAdmin = {
    load, fields, data,
    changed(i) {
      const r=window.__dialogRows[i];
      if(r.furiganaText!==r.jp.trim()){r.furigana=[];r.furiganaText=r.jp.trim();}
      const root=document.getElementById('dlg-furigana-'+i);if(root)root.innerHTML=fields(r,i);
      refreshStage();
    },
    edit(i,start,end,reading) {
      const r=window.__dialogRows[i];if(!r)return;
      if(r.furiganaText!==r.jp.trim()){r.furigana=[];r.furiganaText=r.jp.trim();}
      r.furigana=(r.furigana||[]).filter(v=>v.start!==start);
      if(reading.trim())r.furigana.push({start,end,reading});
      r.furigana.sort((a,b)=>a.start-b.start);
      const preview=document.getElementById('dlg-furigana-preview-'+i);
      if(preview)preview.innerHTML=F.html(r.jp.trim(),{text:r.jp.trim(),readings:r.furigana});
      refreshStage();
    },
    save(tr) {
      const value=F.normalize(data());
      const ta=tr?.querySelector('[name="dialog_furigana"]');if(ta)ta.value=JSON.stringify(value);
    }
  };
})();
