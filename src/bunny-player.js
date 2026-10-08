(function () {
  'use strict';
  let apiPromise = null;
  let active = null;
  let epoch = 0;

  function loadApi() {
    if (window.playerjs?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); apiPromise = null; reject(new Error('Bunny player unavailable')); };
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function destroy() {
    epoch++;
    if (active) active.destroy();
    active = null;
  }

  async function mount({ elementId, externalId, startSeconds = 0, endSeconds = null }) {
    destroy();
    const ticket = epoch;
    const container = document.getElementById(elementId);
    if (!container) return;
    const status = document.getElementById(`${elementId}-status`);
    const src = window.EzBunnyVideo.embedUrl(externalId, startSeconds);
    if (!src) return;
    const stillHere = () => ticket === epoch && container.isConnected;
    try {
      await loadApi();
      if (!stillHere()) return;
      const iframe = document.createElement('iframe');
      const url = new URL(src);
      url.searchParams.set('ezlesson', `${elementId}-${ticket}`);
      iframe.src = url.href;
      iframe.title = 'Video pelajaran';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      container.replaceChildren(iframe);
      const player = new window.playerjs.Player(iframe);
      const readyTimeout = setTimeout(() => {
        if (stillHere() && status) status.textContent = 'Video belum dapat dimuat. Periksa koneksi atau izin domain video.';
      }, 15000);
      let ended = false;
      const hasEnd = Number.isInteger(endSeconds) && endSeconds > startSeconds;
      const finish = () => {
        if (!stillHere() || ended) return;
        ended = true;
        player.pause();
        if (status) status.textContent = 'Segmen selesai. Tandai pelajaran selesai untuk lanjut.';
      };
      const checkTime = (data) => {
        if (!stillHere()) return;
        const seconds = Number(data?.seconds);
        if (!Number.isFinite(seconds)) return;
        if (seconds < startSeconds - 0.3) player.setCurrentTime(startSeconds);
        else if (hasEnd && seconds >= endSeconds - 0.3) finish();
      };
      const onPlay = () => {
        if (!stillHere()) return;
        if (ended) {
          ended = false;
          if (status) status.textContent = '';
          player.setCurrentTime(startSeconds);
        }
      };
      const onError = () => {
        if (stillHere() && status) status.textContent = 'Video tidak dapat dimuat. Periksa koneksi atau akses video.';
      };
      const onReady = () => {
        clearTimeout(readyTimeout);
        if (!stillHere()) return;
        player.setCurrentTime(startSeconds);
        player.on('timeupdate', checkTime);
        player.on('play', onPlay);
        player.on('ended', finish);
        player.on('error', onError);
        if (status) status.textContent = '';
      };
      player.on('ready', onReady);
      active = { destroy() {
        clearTimeout(readyTimeout);
        try {
          player.off('ready', onReady);
          player.off('timeupdate', checkTime);
          player.off('play', onPlay);
          player.off('ended', finish);
          player.off('error', onError);
        } catch {}
        iframe.remove();
      } };
    } catch {
      if (stillHere() && status) status.textContent = 'Video Bunny tidak dapat dimuat. Periksa koneksi lalu buka pelajaran lagi.';
    }
  }

  window.EzBunnyPlayer = { mount, destroy };
})();
