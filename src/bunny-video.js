(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EzBunnyVideo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = /^([1-9]\d*)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

  function parse(value) {
    const raw = String(value || '').trim();
    let url;
    try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'https:' || url.hostname !== 'player.mediadelivery.net' ||
        url.port || url.username || url.password) return null;
    const match = url.pathname.match(/^\/(?:embed|play)\/(.+?)\/?$/);
    if (!match || !ID.test(match[1])) return null;
    const externalId = match[1].toLowerCase();
    // Signed URLs expire. Store the durable identity, never a temporary token.
    if (url.searchParams.has('token') || url.searchParams.has('expires')) return null;
    return { provider: 'bunny', externalId,
      sourceUrl: `https://player.mediadelivery.net/embed/${externalId}` };
  }

  function embedUrl(externalId, startSeconds = 0) {
    if (!ID.test(String(externalId || ''))) return null;
    const url = new URL(`https://player.mediadelivery.net/embed/${externalId}`);
    url.searchParams.set('autoplay', 'false');
    url.searchParams.set('loop', 'false');
    url.searchParams.set('rememberPosition', 'false');
    url.searchParams.set('t', String(Math.max(0, Number(startSeconds) || 0)));
    return url.href;
  }

  function normalizeUrl(value) {
    const parsed = parse(value);
    return parsed ? embedUrl(parsed.externalId) : String(value || '').trim();
  }

  return { parse, embedUrl, normalizeUrl };
});
