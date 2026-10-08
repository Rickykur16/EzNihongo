import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVisitorHasher, deviceClass, isBot, jakartaDate, normalizeEvent, referrerHost, sourceLabel,
} from './site-analytics.js';

test('only known public pages are accepted, and never with a query string', () => {
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/' }).page, 'home');
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/index.html' }).page, 'home');
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/courses/detail.html' }).page, 'course');
  for (const path of ['/dashboard.html', '/courses/order.html', '/?utm_source=x', '/login.html?next=a', '', null, 42]) {
    assert.equal(normalizeEvent({ kind: 'pageview', path }), null, String(path));
  }
  for (const body of [null, [], 'x', { kind: 'click', path: '/' }, { path: '/' }]) assert.equal(normalizeEvent(body), null);
});

test('detail is restricted to a course slug on pageviews and a consult path on clicks', () => {
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/courses/detail.html', detail: 'n5-bootcamp' }).detail, 'n5-bootcamp');
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/courses/detail.html', detail: 'a@b.com' }).detail, '');
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/', detail: 'n5-bootcamp' }).detail, '');
  assert.equal(normalizeEvent({ kind: 'wa_click', path: '/', detail: 'ssw' }).detail, 'ssw');
  assert.equal(normalizeEvent({ kind: 'consult_open', path: '/', detail: 'halo saya budi 0812' }).detail, '');
});

test('referrer keeps only a foreign host; UTM tags are reduced to safe tokens', () => {
  assert.equal(referrerHost('https://www.google.co.id/search?q=kerja+jepang'), 'google.co.id');
  assert.equal(referrerHost('https://eznihongo.com/login.html'), '');
  assert.equal(referrerHost('https://www.eznihongo.com/'), '');
  assert.equal(referrerHost('not a url'), '');
  const e = normalizeEvent({ kind: 'pageview', path: '/', referrer: 'https://l.instagram.com/?u=abc',
    utm: { source: 'Instagram', medium: 'Bio Link', campaign: 'SSW <script>' } });
  assert.deepEqual([e.referrer, e.utmSource, e.utmMedium, e.utmCampaign], ['l.instagram.com', 'instagram', 'bio-link', 'ssw-script']);
  assert.equal(normalizeEvent({ kind: 'wa_click', path: '/', referrer: 'https://google.com/' }).referrer, '');
  assert.equal(normalizeEvent({ kind: 'pageview', path: '/', utm: { source: 'x'.repeat(200) } }).utmSource.length, 60);
});

test('source grouping prefers UTM, then known referrers, then direct', () => {
  assert.equal(sourceLabel('ig-ads', 'google.com'), 'ig-ads');
  assert.equal(sourceLabel('', 'google.co.id'), 'google');
  assert.equal(sourceLabel('', 'l.instagram.com'), 'instagram');
  assert.equal(sourceLabel('', 'm.facebook.com'), 'facebook');
  assert.equal(sourceLabel('', 'blog.example.com'), 'blog.example.com');
  assert.equal(sourceLabel('', ''), 'langsung');
});

test('device class and bot detection from the user agent', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const androidPhone = 'Mozilla/5.0 (Linux; Android 14; SM-A146P) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36';
  const androidTab = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/128 Safari/537.36';
  assert.equal(deviceClass(iphone), 'mobile');
  assert.equal(deviceClass(androidPhone), 'mobile');
  assert.equal(deviceClass(androidTab), 'tablet');
  assert.equal(deviceClass('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128'), 'desktop');
  assert.equal(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)'), true);
  assert.equal(isBot('Mozilla/5.0 HeadlessChrome/128'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot(iphone), false);
  assert.equal(isBot(iphone + ' Instagram 300.0'), false);
});

test('visitor hash is stable within a Jakarta day and unlinkable across days', () => {
  let now = new Date('2026-10-08T16:59:00Z'); // 23:59 WIB
  let n = 0;
  const hash = createVisitorHasher({ now: () => now, random: () => Buffer.from('salt' + (n++)) });
  const a = hash('1.2.3.4', 'UA');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(hash('1.2.3.4', 'UA'), a);
  assert.notEqual(hash('1.2.3.5', 'UA'), a);
  assert.notEqual(hash('1.2.3.4', 'UA2'), a);
  now = new Date('2026-10-08T17:00:00Z'); // 00:00 WIB next day → new salt
  assert.notEqual(hash('1.2.3.4', 'UA'), a);
  assert.equal(n, 2);
  assert.equal(jakartaDate(new Date('2026-10-08T16:59:59Z')), '2026-10-08');
  assert.equal(jakartaDate(new Date('2026-10-08T17:00:00Z')), '2026-10-09');
});
