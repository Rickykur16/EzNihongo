(function () {
  'use strict';
  const catalog = window.EZ_DIALOGUE_CATALOG;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = name => `/assets/dialogue/${name}`;
  const NARRATOR_COLOR = '#b89a55';
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function read(root) {
    try { return JSON.parse(root?.dataset.dialogScene || 'null'); } catch { return null; }
  }
  function speakerLook(scene, speaker) {
    const p = scene?.participants?.find(p => p.speaker === speaker);
    const c = p && catalog.characters.find(c => c.key === p.characterKey);
    return p && c ? {name: p.displayName, side: p.position, color: c.color} : {name: 'Situasi', side: 'narrator', color: NARRATOR_COLOR};
  }
  function html(scene, rows = [], furigana = null) {
    if (!scene?.enabled || scene.participants?.length !== 2) return '';
    const bg = catalog.backgrounds.find(b => b.key === scene.backgroundKey);
    const parts = scene.participants.map(p => ({...p, character: catalog.characters.find(c => c.key === p.characterKey)}));
    if (parts.some(p => !p.character)) return '';
    const first = rows.find(r => parts.some(p => p.speaker === r.speaker)) || rows[0];
    const look = speakerLook(scene, first?.speaker);
    return `<section class="ez-dialog-stage" aria-label="Adegan percakapan" data-state="idle">
      ${bg?.asset ? `<picture><source media="(max-width: 600px)" data-srcset="${asset(bg.key+'-mobile.webp')}"><img class="ez-dialog-backdrop" data-src="${asset(bg.key+'.webp')}" alt=""></picture>` : ''}
      <div class="ez-dialog-actors">${parts.map(p => `<div class="ez-dialog-actor" data-position="${esc(p.position)}" data-speaker="${esc(p.speaker)}" style="--character-color:${p.character.color}"><div class="ez-dialog-body"><img data-src="${asset(p.character.asset+'.webp')}" data-mask="${asset(p.character.asset+'-mask.png')}" alt="${esc(p.character.name)}" width="480" height="720"></div></div>`).join('')}</div>
      <div class="ez-dialog-caption" data-side="${esc(look.side)}" style="--speaker-color:${look.color}"><strong>${esc(look.name)}</strong><i class="ez-dialog-wave" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i><i class="ez-dialog-typing" aria-hidden="true"><b></b><b></b><b></b></i><span lang="ja">${window.EzFurigana ? EzFurigana.html(first?.text || '',EzFurigana.lineFor(furigana,rows.indexOf(first),first)) : esc(first?.text || '')}</span><i class="ez-dialog-progress" aria-hidden="true"></i></div>
    </section>`;
  }
  // opts.animate: the student view plays a one-time entrance and idle
  // breathing. The admin preview re-renders on every keystroke, so it stays still.
  function mount(root, opts = {}) {
    const stage = root?.querySelector('.ez-dialog-stage');
    if (!stage || stage.dataset.mounted) return;
    stage.dataset.mounted = '1';
    const motion = !!opts.animate && !reduced();
    if (motion) stage.classList.add('has-motion');
    const loads = [];
    const settle = el => new Promise(resolve => { el.addEventListener('load', resolve, {once:true}); el.addEventListener('error', resolve, {once:true}); });
    stage.querySelectorAll('[data-srcset]').forEach(el => { el.srcset = el.dataset.srcset; });
    stage.querySelectorAll('img[data-src]').forEach(img => {
      img.addEventListener('error', () => { stage.hidden = true; });
      if (img.dataset.mask) {
        const mask = new Image();
        mask.onerror = () => { stage.hidden = true; };
        mask.onload = () => { img.style.maskImage = `url("${img.dataset.mask}")`; img.style.visibility = 'visible'; };
        loads.push(settle(mask));
        mask.src = img.dataset.mask;
      }
      loads.push(settle(img));
      img.src = img.dataset.src;
    });
    if (!motion) return;
    // Enter once everything is decoded (actors never pop in one by one) and
    // the stage is actually on screen, so the entrance is not spent off-screen.
    // A slow network still gets its scene after 3 s instead of a blank stage.
    let loaded = false, seen = !('IntersectionObserver' in window);
    const enter = () => { if (loaded && seen && !stage.classList.contains('is-live')) requestAnimationFrame(() => stage.classList.add('is-live')); };
    Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 3000))]).then(() => { loaded = true; enter(); });
    if (seen) return stage.classList.add('is-visible');
    new IntersectionObserver(entries => entries.forEach(e => {
      stage.classList.toggle('is-visible', e.isIntersecting);
      if (e.isIntersecting) { seen = true; enter(); }
    }), {threshold: 0.25}).observe(stage);
  }
  // Conversation page: mount scenes shortly before they scroll into view and
  // let transcript bubbles arrive like a chat. Lines stay visible without JS.
  function enhance(page) {
    const players = [...(page?.querySelectorAll?.('.grammar-karaoke') || [])];
    const io = 'IntersectionObserver' in window;
    players.forEach(root => {
      if (!root.querySelector('.ez-dialog-stage')) return;
      if (!io) return mount(root, {animate: true});
      const near = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        near.disconnect();
        mount(root, {animate: true});
      }, {rootMargin: '600px 0px'});
      near.observe(root);
    });
    if (!io || reduced()) return;
    const lines = players.flatMap(root => [...root.querySelectorAll('.gk-transcript .gk-scene, .gk-transcript .gk-line')]);
    lines.forEach(line => line.classList.add('gk-in-wait'));
    let batch = 0, frame = 0;
    const show = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach(e => {
        show.unobserve(e.target);
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; batch = 0; });
        e.target.style.setProperty('--gk-in-delay', `${Math.min(batch++, 6) * 70}ms`);
        e.target.classList.replace('gk-in-wait', 'gk-in');
      });
    }, {threshold: 0.2});
    lines.forEach(line => show.observe(line));
  }
  function sync(root, index, state = 'idle') {
    if (root) root.dataset.playState = state;
    const stage = root?.querySelector('.ez-dialog-stage');
    if (!stage) return;
    const scene = read(root), turns = window.parseDialogLinesFE?.(root.dataset.dialog) || [];
    const turn = turns[index], p = scene?.participants.find(p => p.speaker === turn?.speaker);
    stage.dataset.state = state;
    stage.querySelectorAll('.ez-dialog-actor').forEach(actor => {
      actor.classList.toggle('is-speaking', !!p && actor.dataset.speaker === p.speaker);
    });
    if (state === 'idle') { stage.style.setProperty('--amp', '0'); stage.style.setProperty('--p', '0'); }
    if (turn) {
      const caption = stage.querySelector('.ez-dialog-caption');
      const look = speakerLook(scene, turn.speaker);
      const changed = caption.dataset.turn !== String(index);
      caption.dataset.turn = String(index);
      caption.dataset.side = look.side;
      caption.style.setProperty('--speaker-color', look.color);
      stage.querySelector('.ez-dialog-caption strong').textContent = p?.displayName || 'Situasi';
      let furigana;
      try { furigana = JSON.parse(root.dataset.dialogFurigana || 'null'); } catch { furigana = null; }
      const text=stage.querySelector('.ez-dialog-caption span');
      if(window.EzFurigana)text.innerHTML=EzFurigana.html(turn.text,EzFurigana.lineFor(furigana,index,turn));
      else text.textContent=turn.text;
      if (changed && !reduced() && caption.animate) {
        caption.animate([{opacity: 0, transform: 'translateY(10px) scale(.97)'}, {opacity: 1, transform: 'none'}],
          {duration: 320, easing: 'cubic-bezier(.2,.9,.25,1.15)'});
      }
    }
  }
  // Loudness envelope of one audio segment, decoded off the playback path:
  // the <audio> element keeps playing exactly as before, so a decode failure
  // (or a browser without Web Audio) only falls back to a generic rhythm.
  function envelope(seg) {
    if (!seg || typeof seg !== 'object') return Promise.resolve(null);
    if (!seg.__ezEnvelope) seg.__ezEnvelope = (async () => {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline || !seg.audio_base64) return null;
      const bin = atob(seg.audio_base64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ctx = new Offline(1, 1, 44100);
      const buf = await new Promise((resolve, reject) => {
        const p = ctx.decodeAudioData(bytes.buffer, resolve, reject);
        if (p?.then) p.then(resolve, reject);
      });
      const data = buf.getChannelData(0), hop = Math.max(1, Math.round(buf.sampleRate * 0.02));
      const values = new Float32Array(Math.ceil(data.length / hop));
      for (let f = 0; f < values.length; f++) {
        let sum = 0; const end = Math.min(data.length, (f + 1) * hop);
        for (let i = f * hop; i < end; i++) sum += data[i] * data[i];
        values[f] = Math.sqrt(sum / Math.max(1, end - f * hop));
      }
      const peak = [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)] || 1;
      for (let f = 0; f < values.length; f++) values[f] = Math.min(1, Math.sqrt(values[f] / peak));
      return {step: hop / buf.sampleRate, values, duration: buf.duration};
    })().catch(() => null);
    return seg.__ezEnvelope;
  }
  // Drives --amp (voice loudness, 0..1) and --p (line progress) while one
  // segment plays. Only the stage and the active transcript line are touched.
  function voice(root, audio, seg, index) {
    if (!root || !audio || reduced()) return;
    let env = null, raf = 0, level = 0;
    envelope(seg).then(e => { env = e; });
    const targets = () => [root.querySelector('.ez-dialog-stage'), root.querySelector(`.gk-transcript [data-line-index="${index}"]`)].filter(Boolean);
    const paint = (amp, progress) => targets().forEach(el => { el.style.setProperty('--amp', amp.toFixed(3)); el.style.setProperty('--p', progress.toFixed(4)); });
    const tick = () => {
      raf = 0;
      if (!root.isConnected || audio.paused) return;
      const t = audio.currentTime;
      const duration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : env?.duration || 0;
      let target;
      if (env) target = env.values[Math.min(env.values.length - 1, Math.floor(t / env.step))] || 0;
      else target = 0.45 + 0.35 * Math.sin(t * 13) * Math.sin(t * 4.7);
      level += (target - level) * (target > level ? 0.55 : 0.22);
      paint(level, duration ? Math.min(1, t / duration) : 0);
      raf = requestAnimationFrame(tick);
    };
    audio.addEventListener('playing', () => { if (!raf) raf = requestAnimationFrame(tick); });
    const rest = done => { if (raf) cancelAnimationFrame(raf); raf = 0; level = 0; targets().forEach(el => { el.style.setProperty('--amp', '0'); if (done) el.style.setProperty('--p', '1'); }); };
    audio.addEventListener('pause', () => rest(false));
    audio.addEventListener('ended', () => rest(true));
  }
  window.EzDialogue = {catalog, esc, html, read, mount, enhance, sync, voice, speakerLook};
})();
