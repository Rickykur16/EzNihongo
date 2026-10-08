import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import bunny from '../../src/bunny-video.js';
import { once } from 'node:events';
import express from 'express';

const identity = '770041/0495cf1c-2e6b-4306-b94e-fa08ce239e2a';
const play = `https://player.mediadelivery.net/play/${identity}`;
const embed = `https://player.mediadelivery.net/embed/${identity}`;

test('Bunny Play and Embed URLs normalize to the same durable library/video identity', () => {
  for (const url of [play, embed, `${play}/?autoplay=true&t=30s`]) {
    assert.deepEqual(bunny.parse(url), { provider: 'bunny', externalId: identity, sourceUrl: embed });
    const result = new URL(bunny.normalizeUrl(url));
    assert.equal(result.pathname, `/embed/${identity}`);
    assert.equal(result.searchParams.get('autoplay'), 'false');
    assert.equal(result.searchParams.get('rememberPosition'), 'false');
  }
  for (const url of [play.replace('https:', 'http:'), play.replace('mediadelivery.net', 'mediadelivery.net.evil.invalid'),
    play.replace('770041', 'invalid'), `${play}?token=expires-soon&expires=123`,
    `javascript:alert(1)`, `https://user@player.mediadelivery.net/play/${identity}`]) {
    assert.equal(bunny.parse(url), null, url);
  }
  assert.equal(bunny.embedUrl('missing-library'), null);
  assert.equal(bunny.normalizeUrl('https://existing.invalid/embed'), 'https://existing.invalid/embed');
});

test('admin source endpoint saves Bunny and retains the old YouTube request contract', async t => {
  process.env.DATABASE_URL = '';
  process.env.JWT_ACCESS_SECRET = 'bunny-test-access';
  process.env.JWT_REFRESH_SECRET = 'bunny-test-refresh';
  process.env.ADMIN_EMAILS = 'bunny-admin@example.invalid';
  process.env.COMPANY_STAFF_ENABLED = 'false';
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const writes = [];
  mock.method(db, 'query', async (sql, params) => {
    assert.match(sql, /INSERT INTO video_sources/);
    writes.push(params);
    return { rows: [{ id: 'saved-source', provider: params[0], external_id: params[1], source_url: params[2] }] };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/admin', admin);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); mock.restoreAll(); await db.end(); });
  const token = await signAccessToken('22222222-2222-4222-8222-222222222222', 'bunny-admin@example.invalid');
  const post = async body => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/video-sources`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  assert.equal((await post({ provider: 'bunny', sourceUrl: play, title: 'Bab 1' })).status, 201);
  assert.deepEqual(writes[0], ['bunny', identity, embed, 'Bab 1']);
  assert.equal((await post({ sourceUrl: embed })).status, 201);
  assert.equal((await post({ youtubeUrl: 'https://youtu.be/abcdefghijk' })).status, 201);
  assert.deepEqual(writes[2].slice(0, 3), ['youtube', 'abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk']);
  assert.equal((await post({ provider: 'bunny', sourceUrl: 'https://youtube.com/watch?v=abcdefghijk' })).status, 400);
  assert.equal((await post({ provider: 'bunny', sourceUrl: `${play}?token=x&expires=123` })).status, 400);
  assert.equal(writes.length, 3);
});

test('Bunny segment controller starts, stops, replays, and cancels a pending mount on navigation', async () => {
  const source = await readFile(new URL('../../src/bunny-player.js', import.meta.url), 'utf8');
  let commands = [], player, mounts = [];
  const container = { isConnected: true, replaceChildren(node) { mounts.push(node); } };
  const status = { textContent: '' };
  const context = vm.createContext({ URL, Promise, Number, setTimeout() { return 1; }, clearTimeout() {},
    window: { EzBunnyVideo: bunny, playerjs: { Player: class {
      constructor() { this.events = {}; player = this; }
      on(event, callback) { this.events[event] = callback; }
      off(event) { delete this.events[event]; }
      setCurrentTime(seconds) { commands.push(['seek', seconds]); }
      pause() { commands.push(['pause']); }
    } } },
    document: { getElementById(id) { return id.endsWith('-status') ? status : container; },
      createElement() { return { remove() {} }; } },
  });
  vm.runInContext(source, context);
  await context.window.EzBunnyPlayer.mount({ elementId: 'lesson', externalId: identity, startSeconds: 30, endSeconds: 90 });
  assert.equal(new URL(mounts[0].src).searchParams.get('t'), '30');
  assert.equal(mounts[0].referrerPolicy, 'strict-origin-when-cross-origin');
  player.events.ready();
  assert.deepEqual(commands, [['seek', 30]]);
  player.events.timeupdate({ seconds: 10 });
  assert.deepEqual(commands.at(-1), ['seek', 30]);
  player.events.timeupdate({ seconds: 90 });
  assert.deepEqual(commands.at(-1), ['pause']);
  assert.match(status.textContent, /Segmen selesai/);
  player.events.play();
  assert.equal(status.textContent, '');
  assert.deepEqual(commands.at(-1), ['seek', 30]);
  player.events.timeupdate({ seconds: 90 });
  assert.deepEqual(commands.at(-1), ['pause']);
  context.window.EzBunnyPlayer.destroy();
  assert.deepEqual(Object.keys(player.events), []);
  const pending = context.window.EzBunnyPlayer.mount({ elementId: 'lesson', externalId: identity });
  context.window.EzBunnyPlayer.destroy();
  await pending;
  assert.equal(mounts.length, 1);
  await context.window.EzBunnyPlayer.mount({ elementId: 'lesson', externalId: identity, endSeconds: null });
  player.events.ready();
  commands = [];
  player.events.timeupdate({ seconds: 300 });
  assert.deepEqual(commands, [], 'full video has no artificial end boundary');
});

test('student renderer chooses Bunny source ahead of a stale URL and normalizes direct Play links', async () => {
  const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
  const start = html.indexOf('function renderVideoLessonPlayer(lesson) {');
  const end = html.indexOf('function renderLesson()', start);
  const jobs = [];
  const context = vm.createContext({ window: { EzBunnyVideo: bunny },
    setTimeout(fn) { jobs.push(fn); }, escapeHtml: value => String(value), formatSegmentTimestamp: String });
  vm.runInContext(html.slice(start, end), context);
  const result = context.renderVideoLessonPlayer({ id: 'bab1', videoSource: { provider: 'bunny', externalId: identity },
    videoStartSeconds: 30, videoEndSeconds: 90, videoUrl: 'https://old.invalid' });
  assert.match(result, /bunny-segment-bab1/);
  assert.doesNotMatch(result, /old.invalid/);
  assert.equal(jobs.length, 1);
  assert.match(context.renderVideoLessonPlayer({ videoUrl: play }), /\/embed\/770041/);
  assert.match(context.renderVideoLessonPlayer({ id: 'whole', videoSource: { provider: 'bunny', externalId: identity },
    videoStartSeconds: 0, videoEndSeconds: null }), /Akhir video/);
});

test('reopening a whole-video lesson keeps the optional end time blank', async () => {
  const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
  const start = html.indexOf('function formatVideoTimestamp(seconds) {');
  const end = html.indexOf('// Slug rules:', start);
  const fields = html.indexOf('function supportsVideoSegment(type) {');
  const fieldsEnd = html.indexOf('// Percakapan (migration 178)', fields);
  const context = vm.createContext({ STATE: { videoSources: [{ id: 'bunny-source', provider: 'bunny', title: 'Bab 1' }] },
    escapeHtml: String });
  vm.runInContext(html.slice(start, end) + html.slice(fields, fieldsEnd), context);
  const result = context.videoSegmentFieldsHtml({ id: 'lesson', type: 'video', video_source_id: 'bunny-source',
    video_start_seconds: 0, video_end_seconds: null });
  assert.match(result, /name="videoEnd" value=""/);
  assert.match(result, /name="videoStart" value="00:00"/);
  assert.match(result, /Bunny Stream · Bab 1/);
});
