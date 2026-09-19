(function () {
  'use strict';
  const catalog = window.EZ_DIALOGUE_CATALOG;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = name => `/assets/dialogue/${name}`;
  function read(root) {
    try { return JSON.parse(root?.dataset.dialogScene || 'null'); } catch { return null; }
  }
  function html(scene, rows = []) {
    if (!scene?.enabled || scene.participants?.length !== 2) return '';
    const bg = catalog.backgrounds.find(b => b.key === scene.backgroundKey);
    const parts = scene.participants.map(p => ({...p, character: catalog.characters.find(c => c.key === p.characterKey)}));
    if (parts.some(p => !p.character)) return '';
    const first = rows.find(r => parts.some(p => p.speaker === r.speaker)) || rows[0];
    const who = parts.find(p => p.speaker === first?.speaker);
    return `<section class="ez-dialog-stage" aria-label="Adegan percakapan" data-state="idle">
      ${bg?.asset ? `<picture><source media="(max-width: 600px)" data-srcset="${asset(bg.key+'-mobile.webp')}"><img class="ez-dialog-backdrop" data-src="${asset(bg.key+'.webp')}" alt=""></picture>` : ''}
      <div class="ez-dialog-actors">${parts.map(p => `<div class="ez-dialog-actor" data-position="${esc(p.position)}" data-speaker="${esc(p.speaker)}" style="--character-color:${p.character.color}"><img data-src="${asset(p.character.asset+'.webp')}" data-mask="${asset(p.character.asset+'-mask.png')}" alt="${esc(p.character.name)}" width="480" height="720"></div>`).join('')}</div>
      <div class="ez-dialog-caption"><strong>${esc(who?.displayName || 'Situasi')}</strong><span lang="ja">${esc(first?.text || '')}</span></div>
    </section>`;
  }
  function mount(root) {
    const stage = root?.querySelector('.ez-dialog-stage');
    if (!stage || stage.dataset.mounted) return;
    stage.dataset.mounted = '1';
    stage.querySelectorAll('[data-srcset]').forEach(el => { el.srcset = el.dataset.srcset; });
    stage.querySelectorAll('img[data-src]').forEach(img => {
      img.addEventListener('error', () => { stage.hidden = true; });
      if (img.dataset.mask) {
        const mask = new Image();
        mask.onerror = () => { stage.hidden = true; };
        mask.onload = () => { img.style.maskImage = `url("${img.dataset.mask}")`; img.style.visibility = 'visible'; };
        mask.src = img.dataset.mask;
      }
      img.src = img.dataset.src;
    });
  }
  function sync(root, index, state = 'idle') {
    const stage = root?.querySelector('.ez-dialog-stage');
    if (!stage) return;
    const scene = read(root), turns = window.parseDialogLinesFE?.(root.dataset.dialog) || [];
    const turn = turns[index], p = scene?.participants.find(p => p.speaker === turn?.speaker);
    stage.dataset.state = state;
    stage.querySelectorAll('.ez-dialog-actor').forEach(actor => {
      actor.classList.toggle('is-speaking', !!p && actor.dataset.speaker === p.speaker);
    });
    if (turn) {
      stage.querySelector('.ez-dialog-caption strong').textContent = p?.displayName || 'Situasi';
      stage.querySelector('.ez-dialog-caption span').textContent = turn.text;
    }
  }
  window.EzDialogue = {catalog, esc, html, read, mount, sync};
})();
