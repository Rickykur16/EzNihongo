// Penghitung kunjungan EzNihongo sendiri (tanpa cookie, tanpa pihak ketiga).
// Mengirim: halaman (path, bukan query), host perujuk, tag UTM, dan klik CTA
// WhatsApp. Server menyimpan hitungan saja; lihat backend/src/site-analytics.js.
// Tidak mengirim apa pun kalau browser meminta tidak dilacak (GPC/DNT), kalau
// dijalankan otomatis (webdriver), atau kalau perangkat ini milik staf yang
// pernah membuka Ruang Kerja (localStorage ez_analytics_ignore).
(function () {
  'use strict';
  var nav = window.navigator || {};
  function ignored() {
    try { if (localStorage.getItem('ez_analytics_ignore') === '1') return true; } catch (e) {}
    return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.webdriver === true;
  }
  if (ignored()) return;
  var base = (window.EZ_API_BASE || '/api') + '/site-events';
  var params = new URLSearchParams(location.search);
  var utm = { source: params.get('utm_source') || '', medium: params.get('utm_medium') || '', campaign: params.get('utm_campaign') || '' };

  function send(event) {
    event.path = location.pathname;
    var body = JSON.stringify(event);
    try {
      if (nav.sendBeacon && nav.sendBeacon(base, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  }

  var detail = /\/courses\/detail\.html$/.test(location.pathname) ? (params.get('slug') || '') : '';
  send({ kind: 'pageview', detail: detail, referrer: document.referrer || '', utm: utm });

  // Dialog konsultasi (landing.js) memberi tahu saat benar-benar terbuka; klik
  // tautan WhatsApp mana pun (tombol di dialog, atau [data-consult] yang
  // langsung ke wa.me saat <dialog> tidak didukung) dihitung sebagai klik WA.
  document.addEventListener('landing:consult-opened', function (e) {
    send({ kind: 'consult_open', detail: (e.detail && e.detail.path) || '' });
  });
  // [data-consult] berujung wa.me, tapi saat dialog bisa dibuka klik itu
  // dibatalkan landing.js (yang terhitung consult_open, bukan klik WA).
  var dialogOpens = typeof window.HTMLDialogElement === 'function' &&
    typeof window.HTMLDialogElement.prototype.showModal === 'function';
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || (a.hasAttribute('data-consult') && dialogOpens && document.getElementById('program-dialog'))) return;
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(a.href)) {
      send({ kind: 'wa_click', detail: a.getAttribute('data-path') || '' });
    }
  }, true);
})();
