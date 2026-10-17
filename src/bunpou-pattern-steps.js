(function () {
  'use strict';
  const mounted = new WeakSet();

  function mount(root, { canLeave, onLeave } = {}) {
    const host = root?.querySelector?.('.gt-pattern-steps');
    if (!host || mounted.has(host)) return;
    const cards = [...host.querySelectorAll('.gt-card')];
    if (!cards.length) return;
    mounted.add(host);
    const previous = host.querySelector('[data-gt-pattern-prev]');
    const next = host.querySelector('[data-gt-pattern-next]');
    const position = host.querySelector('[data-gt-pattern-position]');
    const status = host.querySelector('[data-gt-pattern-status]');
    const navigation = host.querySelector('.gt-pattern-nav');
    const complete = root.querySelector('#gt-complete-btn');
    let current = 0;

    function paint() {
      cards.forEach((card, index) => { card.hidden = index !== current; });
      if (position) position.textContent = `Pola ${current + 1} dari ${cards.length}`;
      if (previous) previous.disabled = current === 0;
      if (next) next.disabled = current === cards.length - 1;
      if (navigation) navigation.hidden = cards.length < 2;
      // gtUpdateComplete retains ownership of disabled/label and grading rules.
      if (complete) complete.hidden = current !== cards.length - 1;
    }

    function move(offset) {
      const target = current + offset;
      if (!host.isConnected || target < 0 || target >= cards.length) return;
      if (canLeave?.() === false) {
        if (status) {
          status.textContent = 'Selesaikan rekaman atau tunggu transkripsinya sebelum pindah pola.';
          status.hidden = false;
        }
        return;
      }
      if (status) { status.textContent = ''; status.hidden = true; }
      onLeave?.(cards[current]);
      current = target;
      paint();
      cards[current].querySelector('.gt-card__pattern')?.focus({ preventScroll: true });
      cards[current].scrollIntoView({ block: 'start', behavior: 'instant' });
    }

    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    paint();
  }

  window.EzBunpouSteps = { mount };
})();
