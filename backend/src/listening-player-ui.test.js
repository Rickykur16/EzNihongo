import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import EzFinalExam from '../../final-exam.js';

const html = fs.readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function renderListeningPlayer('), html.indexOf('function renderQuizPaperItem('));

function setup({ version = 'n5-assessment-v4', saved, blockedStorage = false, privateAudio = false, sections = 1, trackCount = 2, fetchAudio } = {}) {
  let now = 0, timerId = 0, objectId = 0;
  const timers = new Map(), audios = [], requests = [], storage = new Map();
  if (saved !== undefined) storage.set('ez_listening_speed', String(saved));
  const players = Array.from({ length: sections }, (_, section) => {
    const controls = new Map(['.qlp-play', '.qlp-speed-select', '.qlp-current-num', '.qlp-cur-time', '.qlp-total-time', '.qlp-bar', '.qlp-prev', '.qlp-next', '.qlp-jeda']
      .map(selector => [selector, { textContent: '', value: '', disabled: false }]));
    const tracks = Array.from({ length: trackCount }, (_, qi) => ({ qi, script: privateAudio ? '' : `audio-${section}-${qi}`, questionId: privateAudio ? `q-${section}-${qi}` : null }));
    return { dataset: { sectionKey: `s${section + 1}`, tracks: JSON.stringify(tracks) },
      querySelector: selector => controls.get(selector) || null, querySelectorAll: () => [] };
  });
  class Audio {
    constructor() {
      this.events = {}; this.paused = true; this.currentTime = 0; this.duration = 20;
      this.playbackRate = 1; this.defaultPlaybackRate = 1; this.preservesPitch = false;
      this.webkitPreservesPitch = false; this.mozPreservesPitch = false; this.plays = [];
      audios.push(this);
    }
    set src(value) { this._src = value; this.currentTime = 0; this.playbackRate = 1; }
    get src() { return this._src; }
    getAttribute(name) { return name === 'src' ? this._src : null; }
    removeAttribute(name) { if (name === 'src') this._src = ''; }
    addEventListener(name, fn) { this.events[name] = fn; }
    play() { this.paused = false; this.plays.push({ at: now, rate: this.playbackRate }); this.events.play?.(); return Promise.resolve(); }
    pause() { this.paused = true; this.events.pause?.(); }
    end() { this.currentTime = this.duration; this.paused = true; this.events.ended?.(); }
  }
  const ctx = vm.createContext({ window: { EzFinalExam, ezApi: async path => {
    requests.push(path); return fetchAudio ? fetchAudio(path) : { ok: true, blob: async () => ({}) };
  } }, quizState: { assessmentVersion: version, lessonApiId: 'lesson', attemptToken: 'attempt' },
  Audio, URL: { createObjectURL: () => `blob:audio-${++objectId}`, revokeObjectURL: () => {} },
  localStorage: { getItem: key => { if (blockedStorage) throw new Error('blocked'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (blockedStorage) throw new Error('blocked'); storage.set(key, value); } },
  document: { querySelectorAll: selector => selector === '.quiz-listening-player' ? players : [], querySelector: () => null },
  setTimeout: (fn, delay) => { timers.set(++timerId, { fn, due: now + delay }); return timerId; },
  clearTimeout: id => timers.delete(id), ttsUrl: text => `/fixture/${text}`,
  escapeHtml: text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) });
  vm.runInContext(source, ctx);
  ctx.initListeningPlayers();
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].due; next[1].fn();
    }
    now = target;
  }
  return { ctx, players, audios, requests, storage, timers, advance,
    state: key => ctx.window.__listeningPlayers[key || 's1'] };
}

test('assessment audio defaults to 0.9 with pitch preservation and a labelled native speed control', () => {
  const h = setup(), audio = h.state().audio;
  assert.equal(audio.playbackRate, 0.9);
  assert.equal(audio.defaultPlaybackRate, 0.9);
  assert.equal(audio.preservesPitch, true);
  assert.equal(audio.webkitPreservesPitch, true);
  assert.equal(audio.mozPreservesPitch, true);
  assert.equal(audio.plays.length, 0, 'initial rendering must not autoplay');
  const markup = h.ctx.renderListeningPlayer([{ index: 0, q: { audioScript: 'fixture' } }], 1);
  assert.match(markup, /<label for="qlp-speed-s1">Kecepatan audio<\/label>/);
  assert.match(markup, /<select id="qlp-speed-s1"[^>]*onchange="window.listeningSetSpeed\(this.value\)"/);
  assert.deepEqual([...markup.matchAll(/<option value="([^"]+)"( selected)?>/g)].map(m => [m[1], !!m[2]]),
    [['0.75', false], ['0.9', true], ['1', false]]);
});

test('changing pace keeps the current position and persists across sections, tracks and page reloads', () => {
  const h = setup({ sections: 2 }), audio = h.state().audio;
  h.ctx.window.listeningTogglePlay('s1'); audio.currentTime = 7;
  h.ctx.window.listeningSetSpeed('0.75');
  assert.equal(audio.currentTime, 7);
  assert.equal(audio.plays.length, 1, 'speed selection must not restart audio');
  for (const player of Object.values(h.ctx.window.__listeningPlayers)) {
    assert.equal(player.audio.playbackRate, 0.75);
    assert.equal(player.el.querySelector('.qlp-speed-select').value, '0.75');
  }
  h.ctx.window.listeningJump('s1', 1, true);
  assert.equal(audio.playbackRate, 0.75);
  assert.equal(audio.plays.at(-1).rate, 0.75);
  h.ctx.initListeningPlayers();
  assert.equal(h.state().audio.playbackRate, 0.75, 're-rendered sections retain the choice');
  assert.equal(h.storage.get('ez_listening_speed'), '0.75');
  assert.equal(setup({ saved: h.storage.get('ez_listening_speed') }).state().audio.playbackRate, 0.75);
});

test('invalid or blocked stored preferences still allow all supported speeds without a reload', () => {
  for (const config of [{ saved: 3 }, { saved: 'bad' }, { blockedStorage: true }]) {
    const h = setup(config);
    assert.equal(h.state().audio.playbackRate, 0.9);
    for (const rate of [0.75, 1, 0.9]) {
      h.ctx.window.listeningSetSpeed(String(rate));
      assert.equal(h.state().audio.playbackRate, rate);
      h.ctx.initListeningPlayers();
      assert.equal(h.state().audio.playbackRate, rate);
    }
    h.ctx.window.listeningSetSpeed('4');
    assert.equal(h.state().audio.playbackRate, 0.9);
  }
});

test('protected assessment audio uses the latest speed when a delayed response becomes playable', async () => {
  let release;
  const h = setup({ privateAudio: true, fetchAudio: () => new Promise(resolve => { release = resolve; }) });
  assert.equal(h.requests.length, 0, 'protected audio is loaded only on demand');
  const pending = h.ctx.loadListeningTrack('s1', 0, true);
  h.ctx.window.listeningSetSpeed('0.75');
  release({ ok: true, blob: async () => ({}) });
  await pending;
  assert.equal(h.state().audio.plays.at(-1).rate, 0.75);
  assert.equal(h.state().audio.preservesPitch, true);
  assert.match(h.requests[0], /quiz\/audio\/q-0-0\?attemptToken=attempt$/);
});

test('chapter and final listening wait for the learner after audio ends without loading the next question', async () => {
  const versions = [null, 'n5-assessment-v4', 'n4-assessment-v1',
    'jlpt-final-n5-v1', 'jlpt-final-n5-v2', 'jlpt-final-n4-v1', 'jlpt-final-n4-v2'];
  for (const version of versions) for (const privateAudio of [false, true]) {
    const h = setup({ version, privateAudio, trackCount: 4 }), audio = h.state().audio;
    await h.ctx.loadListeningTrack('s1', 0, true);
    const requestCount = h.requests.length;
    audio.end();
    h.advance(60000);
    assert.equal(h.state().currentIdx, 0);
    assert.equal(h.state().isPlaying, false);
    assert.equal(audio.paused, true);
    assert.equal(audio.plays.length, 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.requests.length, requestCount, 'ending audio must not request the next question');
    assert.equal(h.players[0].querySelector('.qlp-play').textContent, '▶');
    assert.equal(h.players[0].querySelector('.qlp-next').disabled, false);
    assert.equal(h.players[0].querySelector('.qlp-jeda').textContent, '');
  }
});

test('replaying a completed chapter track never advances after the replay ends', () => {
  const h = setup(), audio = h.state().audio;
  audio.end(); h.advance(1000);
  h.ctx.window.listeningTogglePlay('s1');
  assert.equal(h.timers.size, 0);
  assert.equal(h.players[0].querySelector('.qlp-jeda').textContent, '');
  h.advance(6000);
  assert.equal(h.state().currentIdx, 0);
  assert.equal(audio.paused, false);
  audio.end(); h.advance(60000);
  assert.equal(h.state().currentIdx, 0);
  assert.equal(audio.paused, true);
  assert.equal(h.timers.size, 0);
  assert.equal(audio.plays.at(-1).rate, 0.9);
});

test('pausing a replay leaves the learner on the same chapter track', () => {
  const h = setup(), audio = h.state().audio;
  audio.end(); h.advance(1000);
  h.ctx.window.listeningTogglePlay('s1');
  h.ctx.window.listeningTogglePlay('s1');
  h.advance(10000);
  assert.equal(h.state().currentIdx, 0);
  assert.equal(audio.paused, true);
  assert.equal(h.timers.size, 0);
});

test('seeking or skipping back after audio ends leaves the learner on the chosen track', () => {
  for (const action of ['listeningSeek', 'listeningSkip']) {
    const h = setup(), audio = h.state().audio;
    audio.end(); h.advance(1000);
    h.ctx.window[action]('s1', action === 'listeningSeek' ? 50 : -10);
    h.advance(10000);
    assert.equal(h.state().currentIdx, 0);
    assert.equal(audio.currentTime, 10);
    assert.equal(audio.paused, true);
    assert.equal(h.timers.size, 0);
  }
});

test('manual next, previous and numbered tracks keep their playback behavior and last-track boundary', async () => {
  for (const privateAudio of [false, true]) {
    const h = setup({ privateAudio, trackCount: 4 }), audio = h.state().audio;
    h.ctx.window.listeningSetSpeed('0.75');
    assert.equal(h.players[0].querySelector('.qlp-prev').disabled, true);
    for (let idx = 1; idx < 4; idx++) {
      h.ctx.window.listeningJump('s1', 1, true);
      await new Promise(setImmediate);
      assert.equal(h.state().currentIdx, idx);
      assert.equal(audio.paused, false);
      assert.equal(audio.plays.at(-1).rate, 0.75);
      audio.end(); h.advance(10000);
      assert.equal(h.state().currentIdx, idx);
      assert.equal(audio.paused, true);
    }
    assert.equal(h.players[0].querySelector('.qlp-next').disabled, true);
    const plays = audio.plays.length, requests = h.requests.length;
    h.ctx.window.listeningJump('s1', 1, true);
    await new Promise(setImmediate);
    assert.equal(h.state().currentIdx, 3);
    assert.equal(audio.plays.length, plays);
    assert.equal(h.requests.length, requests);
    h.ctx.window.listeningJump('s1', -1, true);
    await new Promise(setImmediate);
    assert.equal(h.state().currentIdx, 2);
    assert.equal(audio.paused, false);
    h.ctx.window.listeningJump('s1', 0, false);
    await new Promise(setImmediate);
    assert.equal(h.state().currentIdx, 0);
    assert.equal(audio.paused, false, 'numbered tracks keep playback when already playing');
    audio.end();
    h.ctx.window.listeningJump('s1', 1, false);
    await new Promise(setImmediate);
    assert.equal(h.state().currentIdx, 1);
    assert.equal(audio.paused, true, 'numbered tracks only select when paused');
    h.ctx.window.listeningTogglePlay('s1');
    await new Promise(setImmediate);
    assert.equal(audio.paused, false);
    assert.equal(audio.plays.at(-1).rate, 0.75);
  }
});

test('a single-track section stops and re-rendering keeps protected audio idle until play', async () => {
  const h = setup({ privateAudio: true, trackCount: 1 });
  await h.ctx.loadListeningTrack('s1', 0, true);
  h.state().audio.end(); h.advance(10000);
  assert.equal(h.state().currentIdx, 0);
  assert.equal(h.players[0].querySelector('.qlp-next').disabled, true);
  assert.equal(h.players[0].querySelector('.qlp-prev').disabled, true);
  h.ctx.initListeningPlayers();
  h.advance(60000);
  assert.equal(h.requests.length, 1, 'reopening the section must not fetch or play audio');
  assert.equal(h.state().audio.plays.length, 0);
  assert.equal(h.state().audio.paused, true);
  assert.equal(h.state().currentIdx, 0);
  assert.equal(h.timers.size, 0);
});

test('all supported final exams stop after each audio and retain speed when the learner explicitly advances', () => {
  for (const level of ['n5', 'n4']) for (const version of ['v1', 'v2']) {
    const h = setup({ version: `jlpt-final-${level}-${version}` }), audio = h.state().audio;
    h.ctx.window.listeningSetSpeed('0.75');
    audio.end(); h.advance(10000);
    assert.equal(h.state().currentIdx, 0);
    assert.equal(audio.paused, true);
    assert.equal(h.timers.size, 0);
    h.ctx.window.listeningJump('s1', 1, true);
    assert.equal(h.state().currentIdx, 1);
    assert.equal(audio.plays.at(-1).rate, 0.75);
  }
});
