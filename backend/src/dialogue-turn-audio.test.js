import test, {after, beforeEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';

// The admin's "🔊 Tes giliran ini" / "↻ Buat ulang suara" and the student's
// dialogue player must read ONE stored take per turn (resolveDialogTurns in
// routes/tts.js). ElevenLabs never returns the same take twice, so every
// fake generation below yields distinct bytes: "same bytes" in an assertion
// means "the same stored take", never a lucky coincidence.
process.env.JWT_ACCESS_SECRET = 'turn-audio-secret';
process.env.JWT_REFRESH_SECRET = 'turn-audio-refresh';
process.env.ADMIN_EMAILS = 'turn-admin@example.invalid';
process.env.COMPANY_STAFF_ENABLED = 'false';
process.env.ELEVENLABS_API_KEY = 'test-not-a-real-key';
process.env.ELEVENLABS_VOICE_NARRATOR = 'narrator-voice';
const {db} = await import('./db.js');
const {signAccessToken} = await import('./auth.js');
const {default: admin} = await import('./routes/admin.js');
const {default: tts, ttsHashKey} = await import('./routes/tts.js');

const id = '22222222-2222-4222-8222-222222222222';
const scene = () => ({schemaVersion: 1, enabled: true, backgroundKey: 'classroom', participants: [
  {characterKey: 'anna-wijaya', position: 'left', speaker: 'A', displayName: 'Anna', voiceId: 'anna-voice', voiceName: 'Anna Voice', profileVersion: 1, custom: false},
  {characterKey: 'hadi-pratama', position: 'right', speaker: 'B', displayName: 'Hadi', voiceId: 'hadi-voice', voiceName: 'Hadi Voice', profileVersion: 1, custom: false},
]});
const ORIGINAL = 'N: ふたりが はなしています。\nA: こんにちは。\nB: はじめまして。';
let savedText = ORIGINAL, savedScene = scene(), cache = new Map(), upstream = [], takes = 0;

const fakeQuery = async (sql, p = []) => {
  if (sql.includes('FROM admin_emails')) return {rows: []};
  if (sql.startsWith('SELECT 1 WHERE EXISTS')) return {rows: p[0] === savedText ? [{}] : []};
  if (sql.includes('SELECT dialog_scene FROM module_grammar')) {
    return {rows: p[0] === id && p[1] === savedText ? [{dialog_scene: structuredClone(savedScene)}] : []};
  }
  if (sql.startsWith('SELECT name, voice_id FROM dialogue_speakers')) return {rows: []};
  if (sql.includes('SELECT text_hash, audio FROM tts_cache WHERE text_hash = ANY')) {
    return {rows: p[0].filter(k => cache.get(k)?.audio).map(k => ({text_hash: k, audio: cache.get(k).audio}))};
  }
  if (sql.includes('SELECT alignment FROM tts_cache')) return {rows: cache.has(p[0]) ? [{alignment: cache.get(p[0]).alignment}] : []};
  if (sql.includes('UPDATE tts_cache SET last_used_at')) return {rows: []};
  if (sql.includes('INSERT INTO tts_cache')) {
    if (!cache.has(p[0]) || sql.includes('DO UPDATE')) cache.set(p[0], {audio: p[4], alignment: null});
    return {rows: []};
  }
  throw Error('Unexpected query: ' + sql);
};
mock.method(db, 'query', fakeQuery);
mock.method(db, 'connect', async () => ({query: fakeQuery, release() {}}));
const realFetch = globalThis.fetch;
mock.method(globalThis, 'fetch', async (url, options) => {
  if (String(url).startsWith('https://api.elevenlabs.io/')) {
    if (String(url).endsWith('/voices')) {
      return new Response(JSON.stringify({voices: ['anna-voice', 'hadi-voice'].map(voice_id => ({voice_id, name: voice_id}))}),
        {headers: {'Content-Type': 'application/json'}});
    }
    const body = JSON.parse(options.body);
    // Real generations take seconds; the delay lets two first plays overlap.
    await new Promise(r => setTimeout(r, 15));
    upstream.push({voice: decodeURIComponent(String(url).split('/text-to-speech/')[1].split('?')[0]), ...body});
    return new Response(Buffer.from(`take-${++takes}|${body.text}`), {headers: {'Content-Type': 'audio/mpeg'}});
  }
  return realFetch(url, options);
});

const token = await signAccessToken(id, 'turn-admin@example.invalid');
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/admin', admin);
app.use('/api', tts);
app.use((err, req, res, next) => { console.error(err); res.status(500).json({error: 'test error'}); });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
let ip = 1;
after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); mock.restoreAll(); await db.end(); });
beforeEach(() => { savedText = ORIGINAL; savedScene = scene(); cache = new Map(); upstream = []; });

async function student(text = savedText) {
  const r = await fetch(`${base}/api/tts/dialog?grammarId=${id}&text=${encodeURIComponent(text)}`,
    {headers: {'X-Forwarded-For': '198.51.100.' + (ip++ % 250)}});
  const body = await r.json();
  return {status: r.status, body, clips: r.ok ? body.segments.map(s => Buffer.from(s.audio_base64, 'base64').toString()) : null};
}
async function turn(turnIndex, {dialog = savedText, regenerate = false, auth = true, turnText, speaker, dialogScene = savedScene} = {}) {
  const lines = dialog.split('\n');
  const [spk, ...rest] = lines[turnIndex] ? lines[turnIndex].split(': ') : ['', ''];
  const r = await fetch(`${base}/api/admin/tts/dialog-turn`, {
    method: 'POST',
    headers: {...(auth ? {Authorization: 'Bearer ' + token} : {}), 'Content-Type': 'application/json'},
    body: JSON.stringify({dialog, turnIndex, speaker: speaker ?? spk, turnText: turnText ?? rest.join(': '), dialogScene, regenerate}),
  });
  return {status: r.status, type: r.headers.get('Content-Type'), text: r.ok ? Buffer.from(await r.arrayBuffer()).toString() : await r.json()};
}

test('the admin per-turn test plays exactly the take students hear, with no new generation', async () => {
  const first = await student();
  assert.equal(first.status, 200);
  assert.equal(first.clips.length, 3);
  assert.equal(upstream.length, 3, 'one generation per turn');
  assert.deepEqual(upstream.map(u => u.voice), ['narrator-voice', 'anna-voice', 'hadi-voice']);
  assert.ok(upstream.every(u => !/<break/.test(u.text)), 'clips carry no SSML break');
  for (const i of [0, 1, 2]) {
    const heard = await turn(i);
    assert.equal(heard.status, 200);
    assert.equal(heard.type, 'audio/mpeg');
    assert.equal(heard.text, first.clips[i], `turn ${i}: admin hears the student take`);
  }
  assert.equal(upstream.length, 3, 'testing never re-generates a stored take');
  assert.deepEqual((await student()).clips, first.clips, 'students keep the same takes');
});

test('a turn the admin tests first becomes the take students hear', async () => {
  const tested = await turn(2);
  assert.equal(tested.status, 200);
  assert.equal(upstream.length, 1);
  const played = await student();
  assert.equal(upstream.length, 3, 'only the two untested turns are generated');
  assert.equal(played.clips[2], tested.text);
});

test('"Buat ulang suara" replaces that one take for everyone and leaves the others alone', async () => {
  const before = (await student()).clips;
  const again = await turn(1, {regenerate: true});
  assert.equal(again.status, 200);
  assert.equal(upstream.length, 4, 'exactly one new generation');
  assert.notEqual(again.text, before[1]);
  assert.equal((await turn(1)).text, again.text, 'the next test plays the new take');
  const after = (await student()).clips;
  assert.equal(after[1], again.text, 'students hear the regenerated take');
  assert.equal(after[0], before[0]);
  assert.equal(after[2], before[2]);
  assert.equal(upstream.length, 4);
});

test('editing one line re-voices only that line', async () => {
  const before = (await student()).clips;
  savedText = 'N: ふたりが はなしています。\nA: こんにちは。\nB: よろしく おねがいします。';
  const after = await student();
  assert.equal(after.status, 200);
  assert.equal(upstream.length, 4);
  assert.equal(upstream.at(-1).text, 'よろしく おねがいします。');
  assert.equal(after.clips[0], before[0]);
  assert.equal(after.clips[1], before[1]);
  assert.notEqual(after.clips[2], before[2]);
});

test('takes from before per-turn caching are adopted without calling ElevenLabs — the admin-tested take first', async () => {
  const voices = ['narrator-voice', 'anna-voice', 'hadi-voice'];
  const legacy = {format: 'dialog-segments-v1', segments: ['N', 'A', 'B'].map((speaker, i) => ({
    speaker, role: i ? 'dialogue' : 'narrator', content_type: 'audio/mpeg', audio_base64: Buffer.from(`legacy-${i}`).toString('base64'),
  }))};
  cache.set(ttsHashKey('dialogsegs1\n' + ORIGINAL, voices), {audio: Buffer.from('whole-dialog'), alignment: legacy});
  cache.set(ttsHashKey('A: こんにちは。', ['anna-voice']), {audio: Buffer.from('admin-tested-1'), alignment: null});
  const played = await student();
  assert.equal(played.status, 200);
  assert.deepEqual(played.clips, ['legacy-0', 'admin-tested-1', 'legacy-2']);
  assert.equal(upstream.length, 0);
  assert.equal((await turn(2)).text, 'legacy-2');
  assert.equal(upstream.length, 0);
});

test('a legacy whole-dialogue take that no longer lines up with the turns is not adopted', async () => {
  const voices = ['narrator-voice', 'anna-voice', 'hadi-voice'];
  const legacy = {segments: ['N', 'B', 'A'].map(speaker => ({speaker, audio_base64: Buffer.from('wrong').toString('base64')}))};
  cache.set(ttsHashKey('dialogsegs1\n' + ORIGINAL, voices), {audio: Buffer.from('x'), alignment: legacy});
  const played = await student();
  assert.equal(upstream.length, 3);
  assert.ok(played.clips.every(c => c.startsWith('take-')));
});

test('two first plays at once settle on one stored take per turn', async () => {
  const [a, b] = await Promise.all([student(), student()]);
  assert.equal(a.status, 200);
  assert.deepEqual(a.clips, b.clips);
  assert.deepEqual((await student()).clips, a.clips);
});

test('a changed voice is a different take; unsaved editor voices are keyed the same way students will be', async () => {
  const original = (await student()).clips;
  const editorScene = scene();
  editorScene.participants[0].voiceId = 'hadi-voice';
  const tested = await turn(1, {dialogScene: editorScene});
  assert.equal(tested.status, 200);
  assert.notEqual(tested.text, original[1]);
  assert.equal(upstream.at(-1).voice, 'hadi-voice');
  savedScene = editorScene; // the admin saves the dialogue with that voice
  assert.equal((await student()).clips[1], tested.text);
});

test('per-turn endpoint guardrails', async () => {
  assert.equal((await turn(1, {auth: false})).status, 401);
  assert.equal((await turn(5)).status, 400);
  assert.equal((await turn(0, {dialog: 'ただの ぶんです。'})).status, 400);
  const mismatch = await turn(1, {turnText: 'こんにちは。\nB: はい。'});
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.text.error, 'turn_mismatch');
  const voiceless = scene();
  voiceless.participants[1].voiceId = null;
  assert.equal((await turn(2, {dialogScene: voiceless})).status, 422);
  assert.equal(upstream.length, 0, 'no guardrail failure reaches ElevenLabs');
});
