(function () {
  'use strict';
  const mounted = new WeakSet();

  function mount(root, { onLeave } = {}) {
    const host = root?.querySelector?.('.conversation-steps');
    if (!host || mounted.has(host)) return;
    const cards = [...host.querySelectorAll('.conversation-step')];
    if (!cards.length) return;
    mounted.add(host);
    const previous = host.querySelector('[data-conversation-prev]');
    const next = host.querySelector('[data-conversation-next]');
    const position = host.querySelector('[data-conversation-position]');
    const navigation = host.querySelector('.conversation-step-nav');
    const complete = root.querySelector('.conversation-lesson-complete');
    let current = 0;

    function paint() {
      cards.forEach((card, index) => { card.hidden = index !== current; });
      if (position) position.textContent = `Percakapan ${current + 1} dari ${cards.length}`;
      if (previous) previous.disabled = current === 0;
      if (next) next.disabled = current === cards.length - 1;
      if (navigation) navigation.hidden = cards.length < 2;
      if (complete) complete.hidden = current !== cards.length - 1;
    }

    function move(offset) {
      const target = current + offset;
      if (!host.isConnected || target < 0 || target >= cards.length) return;
      onLeave?.(cards[current]);
      current = target;
      paint();
      // Keep the new pattern's heading clear of the sticky student header.
      cards[current].querySelector('h2')?.focus({ preventScroll: true });
      cards[current].scrollIntoView({ block: 'start', behavior: 'instant' });
    }

    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    paint();
  }

  window.EzConversationSteps = { mount };
})();
