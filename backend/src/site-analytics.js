// First-party, cookieless visit counter for the public pages. Everything stored
// comes from a fixed vocabulary or is reduced to a short, non-identifying token:
// the page key (never the URL or query string), the referrer HOST only, UTM
// tags, a device class from the user agent, and a daily-salted visitor hash.
// The salt is random, kept only in memory and replaced every Jakarta day, so
// the hash counts unique visitors per day but cannot be joined across days or
// turned back into an IP address. A restart mid-day starts a new salt, which
// can count a returning visitor twice for that day — accepted, documented.
import { createHash, randomBytes } from 'node:crypto';

export const EVENT_KINDS = ['pageview', 'consult_open', 'wa_click'];
export const CONSULT_PATHS = ['belum-tahu', 'ssw', 'gijinkoku', 'ginou', 'ryugaku', 'bahasa'];
export const RETENTION_DAYS = 400;

const PAGES = new Map([
  ['/', 'home'], ['/index.html', 'home'],
  ['/courses/detail.html', 'course'],
  ['/login.html', 'login'],
  ['/privacy.html', 'privacy'],
  ['/terms.html', 'terms'],
]);
const SITE_HOSTS = new Set(['eznihongo.com', 'app.eznihongo.com']);
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|python-requests|curl|wget/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const HOST_RE = /^[a-z0-9.-]{1,100}$/;

export function jakartaDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function isBot(userAgent) {
  return !userAgent || BOT_RE.test(userAgent);
}

export function deviceClass(userAgent = '') {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

// Host only, lowercased, without "www."; own domain and invalid values → ''.
export function referrerHost(value) {
  if (typeof value !== 'string' || !value) return '';
  let host;
  try { host = new URL(value).hostname.toLowerCase(); } catch { return ''; }
  host = host.replace(/^www\./, '');
  if (!HOST_RE.test(host) || SITE_HOSTS.has(host) || host === 'localhost' || host === '127.0.0.1') return '';
  return host;
}

function tag(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Returns a row ready to insert (without visitor/device), or null if invalid.
export function normalizeEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!EVENT_KINDS.includes(body.kind)) return null;
  const page = typeof body.path === 'string' ? PAGES.get(body.path) : undefined;
  if (!page) return null;
  let detail = '';
  if (typeof body.detail === 'string' && body.detail) {
    if (body.kind === 'pageview') detail = page === 'course' && SLUG_RE.test(body.detail) ? body.detail : '';
    else detail = CONSULT_PATHS.includes(body.detail) ? body.detail : '';
  }
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  return {
    kind: body.kind, page, detail,
    referrer: body.kind === 'pageview' ? referrerHost(body.referrer) : '',
    utmSource: tag(utm.source), utmMedium: tag(utm.medium), utmCampaign: tag(utm.campaign),
  };
}

export function createVisitorHasher({ now = () => new Date(), random = () => randomBytes(32) } = {}) {
  let day = null;
  let salt = null;
  return function visitorHash(ip, userAgent) {
    const today = jakartaDate(now());
    if (today !== day) { day = today; salt = random(); }
    return createHash('sha256').update(salt).update(String(ip || '')).update('\n').update(String(userAgent || ''))
      .digest('hex').slice(0, 16);
  };
}

// Groups a source for the report: UTM wins (it is what campaigns set), then the
// referrer host collapsed to a recognisable name, otherwise direct traffic.
export function sourceLabel(utmSource, referrer) {
  if (utmSource) return utmSource;
  if (!referrer) return 'langsung';
  if (/(^|\.)google\./.test(referrer)) return 'google';
  if (/(^|\.)(instagram\.com|l\.instagram\.com)$/.test(referrer)) return 'instagram';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(referrer)) return 'facebook';
  if (/(^|\.)(tiktok\.com)$/.test(referrer)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(referrer)) return 'youtube';
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(referrer)) return 'x';
  if (/(^|\.)(bing\.com)$/.test(referrer)) return 'bing';
  return referrer;
}
