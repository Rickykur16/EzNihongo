// Japanese ambience layer for the "estetik" versions: drifting sakura petals,
// a faint seigaiha (wave) pattern, a tategaki (vertical text) accent and a hanko
// stamp. Everything is a pure function of time t, so frame rendering stays
// deterministic. Pages call JPAmbience.mount(stage, cfg) once and
// JPAmbience.render(t) at the end of their own render(t).
(function () {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const p = (t, a, b) => clamp((t - a) / (b - a));
  const seeded = (n) => { const x = Math.sin(n * 91.345 + 47.853) * 43758.5453; return x - Math.floor(x); };
  const PETAL = 'M0,-22 C9,-20 15,-8 12,6 C10,14 4,20 0,22 C-4,20 -10,14 -12,6 C-15,-8 -9,-20 -3,-22 L0,-15 Z';
  const petalSvg = (fill, edge) => `<svg viewBox="-16 -24 32 48" width="100%" height="100%"><defs><radialGradient id="g" cx="50%" cy="70%" r="70%">
    <stop offset="0" stop-color="${edge}"/><stop offset="1" stop-color="${fill}"/></radialGradient></defs><path d="${PETAL}" fill="url(#g)"/></svg>`;
  const WAVE = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><g fill="none" stroke="white" stroke-width="1.6">' +
    [0, 60, 120].map((cx) => [28, 20, 12].map((r) => `<circle cx="${cx}" cy="60" r="${r}"/>`).join('')).join('') +
    [30, 90].map((cx) => [28, 20, 12].map((r) => `<circle cx="${cx}" cy="30" r="${r}"/>`).join('')).join('') + '</g></svg>');
  let cfg = null, petals = [], layers = {};

  function mount(stage, c) {
    cfg = c;
    const mk = (id, css) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;' + css; return d; };
    layers.wave = mk('jpWave', `background:url("data:image/svg+xml,${WAVE}") repeat;opacity:0;`);
    layers.back = mk('jpPetalsBack', '');
    layers.front = mk('jpPetalsFront', '');
    const after = document.getElementById(c.backAfter || 'glow');
    after.after(layers.wave);
    layers.wave.after(layers.back);
    document.getElementById('grain').before(layers.front);
    // back petals: small and sharp; front petals: few, large, soft focus (depth)
    for (let i = 0; i < 22; i++) petals.push({ el: null, front: i >= 18, i });
    petals.forEach((pt) => {
      const r = (k) => seeded(pt.i * 13 + k);
      const d = document.createElement('div');
      const size = pt.front ? 46 + r(1) * 22 : 16 + r(1) * 16;
      d.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size * 1.5}px;will-change:transform;` + (pt.front ? 'filter:blur(3px);' : '');
      d.innerHTML = petalSvg(r(9) > 0.5 ? '#F8C9D4' : '#F3B3C3', '#FFF1F4');
      Object.assign(pt, { el: d, size, x0: r(2) * 1180 - 50, y0: r(3) * 2100, speed: (pt.front ? 150 : 70) + r(4) * 70,
                          amp: 30 + r(5) * 60, freq: 0.6 + r(6) * 0.9, ph: r(7) * 6.28, spin: (r(8) - 0.5) * 140, flip: 1 + r(10) * 2.2,
                          alpha: pt.front ? 0.55 : 0.5 + r(11) * 0.4 });
      (pt.front ? layers.front : layers.back).appendChild(d);
    });
    if (c.tategaki) {
      const tg = document.createElement('div');
      tg.id = 'jpTategaki';
      tg.textContent = c.tategaki.text;
      tg.style.cssText = `position:absolute;left:${c.tategaki.x}px;top:${c.tategaki.y}px;writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:600;font-size:34px;letter-spacing:.32em;color:rgba(220,230,245,.55);opacity:0;`;
      layers.back.after(tg);  // behind scene content and callouts
      layers.tategaki = tg;
    }
    if (c.hanko) {
      const h = document.createElement('div');
      h.id = 'jpHanko';
      h.innerHTML = `<span>${c.hanko.char}</span>`;
      h.style.cssText = `position:absolute;left:${c.hanko.x}px;top:${c.hanko.y}px;width:104px;height:104px;border-radius:14px;background:#C8102E;opacity:0;
        box-shadow:inset 0 0 0 6px #C8102E, inset 0 0 0 9px rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;
        font-family:'Shippori Mincho',serif;font-weight:800;font-size:66px;color:#FFF6F0;`;
      document.getElementById(c.hanko.parent || 'end').appendChild(h);
      layers.hanko = h;
    }
  }

  function render(t) {
    if (!cfg) return;
    // seigaiha: faint, drifts slowly, only where the navy background shows
    const wa = cfg.waveAlpha(t);
    layers.wave.style.opacity = String(wa);
    layers.wave.style.backgroundPosition = `${-12 * t}px ${6 * t}px`;
    const onPaper = cfg.onPaper ? cfg.onPaper(t) : false;
    const backA = cfg.petalsBack(t), frontA = cfg.petalsFront(t);
    petals.forEach((pt) => {
      const a = (pt.front ? frontA : backA) * pt.alpha;
      if (a <= 0.001) { pt.el.style.visibility = 'hidden'; return; }
      const y = ((pt.y0 + pt.speed * t) % 2140) - 110;
      const x = pt.x0 + pt.amp * Math.sin(pt.freq * t + pt.ph) + 24 * t;
      const xx = ((x % 1240) + 1240) % 1240 - 80;
      const rot = pt.spin * t + pt.ph * 57;
      const sx = Math.cos(pt.flip * t + pt.ph);
      pt.el.style.visibility = 'visible';
      pt.el.style.opacity = String(a);
      pt.el.style.filter = (pt.front ? 'blur(3px) ' : '') + (onPaper ? 'saturate(1.6) brightness(.92)' : '');
      pt.el.style.transform = `translate(${xx}px, ${y}px) rotate(${rot}deg) scaleX(${0.35 + 0.65 * Math.abs(sx)})`;
    });
    if (layers.tategaki) {
      const g = cfg.tategaki;
      layers.tategaki.style.opacity = String(clamp(p(t, g.tIn, g.tIn + 0.5) - p(t, g.tOut, g.tOut + 0.3)));
      layers.tategaki.style.transform = `translateY(${(1 - p(t, g.tIn, g.tIn + 0.8)) * 24}px)`;
    }
    if (layers.hanko) {
      const h = cfg.hanko, u = t - h.t;
      if (u < 0) { layers.hanko.style.opacity = '0'; return; }
      const s = 1 + 0.6 * Math.exp(-u / 0.07) * Math.cos(u * 30);
      layers.hanko.style.opacity = String(clamp(u / 0.06) * 0.95);
      layers.hanko.style.transform = `rotate(-7deg) scale(${Math.max(0.9, s)})`;
    }
  }
  window.JPAmbience = { mount, render };
})();
