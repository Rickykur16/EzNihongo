import test, {after, beforeEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
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
process.env.ELEVENLABS_MODEL = 'eleven_multilingual_v2';
delete process.env.ELEVENLABS_DIALOGUE_MODEL;
delete process.env.ELEVENLABS_LISTENING_MODEL;
const {db} = await import('./db.js');
const {signAccessToken} = await import('./auth.js');
const {default: admin} = await import('./routes/admin.js');
const {default: tts, ttsHashKey, TTS_DIALOGUE_MODEL, TTS_DIALOGUE_SETTINGS_VERSION} = await import('./routes/tts.js');

const id = '22222222-2222-4222-8222-222222222222';
const scene = () => ({schemaVersion: 1, enabled: true, backgroundKey: 'classroom', participants: [
  {characterKey: 'anna-wijaya', position: 'left', speaker: 'A', displayName: 'Anna', voiceId: 'anna-voice', voiceName: 'Anna Voice', profileVersion: 1, custom: false},
  {characterKey: 'hadi-pratama', position: 'right', speaker: 'B', displayName: 'Hadi', voiceId: 'hadi-voice', voiceName: 'Hadi Voice', profileVersion: 1, custom: false},
]});
const ORIGINAL = 'N: ふたりが はなしています。\nA: こんにちは。\nB: はじめまして。';
let savedText = ORIGINAL, savedScene = scene(), savedFurigana = null, cache = new Map(), upstream = [], takes = 0;

const fakeQuery = async (sql, p = []) => {
  if (sql.includes('FROM admin_emails')) return {rows: []};
  if (sql.startsWith('SELECT 1 WHERE EXISTS')) return {rows: p[0] === savedText ? [{}] : []};
  if (sql.includes('SELECT dialog_scene, dialog_furigana FROM module_grammar')) {
    return {rows: p[0] === id && p[1] === savedText ? [{dialog_scene: structuredClone(savedScene), dialog_furigana: structuredClone(savedFurigana)}] : []};
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
    const format = new URL(url).searchParams.get('output_format');
    upstream.push({voice: decodeURIComponent(String(url).split('/text-to-speech/')[1].split('?')[0]), format, ...body});
    const take = ++takes;
    if (format === 'pcm_24000') {
      const pcm = Buffer.alloc(8);
      for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(take, i);
      return new Response(pcm, {headers: {'Content-Type': 'audio/pcm'}});
    }
    return new Response(Buffer.from(`take-${take}|${body.text}`), {headers: {'Content-Type': 'audio/mpeg'}});
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
beforeEach(() => { savedText = ORIGINAL; savedScene = scene(); savedFurigana = null; cache = new Map(); upstream = []; });

async function student(text = savedText) {
  const r = await fetch(`${base}/api/tts/dialog?grammarId=${id}&text=${encodeURIComponent(text)}`,
    {headers: {'X-Forwarded-For': '198.51.100.' + (ip++ % 250)}});
  const body = await r.json();
  return {status: r.status, body, clips: r.ok ? body.segments.map(s => Buffer.from(s.audio_base64, 'base64').toString()) : null};
}
async function turn(turnIndex, {dialog = savedText, regenerate = false, auth = true, turnText, speaker, dialogScene = savedScene, dialogFurigana = savedFurigana, listening} = {}) {
  const lines = dialog.split('\n');
  const [spk, ...rest] = lines[turnIndex] ? lines[turnIndex].split(': ') : ['', ''];
  const r = await fetch(`${base}/api/admin/tts/dialog-turn`, {
    method: 'POST',
    headers: {...(auth ? {Authorization: 'Bearer ' + token} : {}), 'Content-Type': 'application/json'},
    body: JSON.stringify({dialog, turnIndex, speaker: speaker ?? spk, turnText: turnText ?? rest.join(': '), dialogScene, dialogFurigana, regenerate, listening}),
  });
  const bytes = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  return {status: r.status, type: r.headers.get('Content-Type'), cacheControl: r.headers.get('Cache-Control'), bytes,
    text: r.ok ? bytes.toString() : await r.json()};
}

async function fullListening() {
  const r = await fetch(`${base}/api/admin/tts/preview`, {
    method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify({text: savedText, dialogScene: savedScene, listening: true}),
  });
  return {status: r.status, type: r.headers.get('Content-Type'), bytes: Buffer.from(await r.arrayBuffer())};
}

test('the admin per-turn test plays exactly the take students hear, with no new generation', async () => {
  const first = await student();
  assert.equal(first.status, 200);
  assert.equal(first.clips.length, 3);
  assert.equal(upstream.length, 3, 'one generation per turn');
  assert.equal(TTS_DIALOGUE_MODEL, 'eleven_v4', 'dialogue does not inherit the generic v2 model');
  assert.equal(TTS_DIALOGUE_SETTINGS_VERSION, 'dialogue-v4-mp3-turn-v1');
  assert.deepEqual(upstream.map(u => u.voice), ['narrator-voice', 'anna-voice', 'hadi-voice']);
  for (const request of upstream) {
    assert.equal(request.model_id, 'eleven_v4', 'narrator and both characters use v4');
    assert.equal(request.format, 'mp3_44100_128');
    assert.deepEqual(Object.keys(request.voice_settings).sort(), ['similarity_boost', 'stability']);
  }
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
  assert.equal(upstream.at(-1).text, 'よろしくおねがいします。', 'word spaces are not spoken');
  assert.equal(after.clips[0], before[0]);
  assert.equal(after.clips[1], before[1]);
  assert.notEqual(after.clips[2], before[2]);
});

test('v4 rejects legacy whole-dialogue, single-preview and per-turn takes from v2 and v3', async () => {
  savedText = 'N: ふたりがはなしています。\nA: こんにちは。\nB: はじめまして。';
  const ORIGINAL = savedText;
  const voices = ['narrator-voice', 'anna-voice', 'hadi-voice'];
  const legacy = {format: 'dialog-segments-v1', segments: ['N', 'A', 'B'].map((speaker, i) => ({
    speaker, role: i ? 'dialogue' : 'narrator', content_type: 'audio/mpeg', audio_base64: Buffer.from(`legacy-${i}`).toString('base64'),
  }))};
  cache.set(ttsHashKey('dialogsegs1\n' + ORIGINAL, voices), {audio: Buffer.from('whole-dialog'), alignment: legacy});
  cache.set(ttsHashKey('A: こんにちは。', ['anna-voice']), {audio: Buffer.from('admin-tested-1'), alignment: null});
  for (const model of ['eleven_multilingual_v2', 'eleven_v3']) {
    const key = createHash('sha256').update(`elevenlabs|hadi-voice|${model}|v6|dialogturn1\ndialogue\nはじめまして。`).digest('hex');
    cache.set(key, {audio: Buffer.from('old-turn-' + model), alignment: null});
  }
  const played = await student();
  assert.equal(played.status, 200);
  assert.equal(upstream.length, 3, 'all three turns require their first v4 generation');
  assert.ok(played.clips.every(clip => clip.startsWith('take-')));
  assert.equal((await turn(2)).text, played.clips[2]);
  assert.deepEqual((await student()).clips, played.clips);
  assert.equal(upstream.length, 3, 'the new v4 cache is subsequently reused');
});

test('v4 spaced and unspaced spellings reuse the same spoken take', async () => {
  const first = await student();
  assert.equal(first.status, 200);
  assert.equal(upstream[0].text, 'ふたりがはなしています。');
  savedText = 'N: ふたりがはなしています。\nA: こんにちは。\nB: はじめまして。';
  const again = await student();
  assert.deepEqual(again.clips, first.clips);
  assert.equal(upstream.length, 3, 'removing display spaces must not regenerate audio');
  assert.equal((await turn(0)).text, first.clips[0], 'admin hears the same take');
});

test('v4 keeps audio tags for narrator and characters but never sends authored SSML', async () => {
  savedText = 'N: [calm] ふたりが はなしています。 <break time="1s" />\nA: [happy] こんにちは。\nB: <speak>はじめまして。</speak>';
  const played = await student();
  assert.equal(played.status, 200);
  assert.equal(upstream[0].text, '[calm] ふたりがはなしています。');
  assert.equal(upstream[1].text, '[happy] こんにちは。');
  assert.equal(upstream[2].text, 'はじめまして。');
  assert.ok(upstream.every(request => !/[<>]/.test(request.text)));
});

test('listening per-turn preview and regeneration feed the full WAV without changing grammar takes', async () => {
  const grammar = await student();
  const tested = await turn(1, {listening: true});
  assert.equal(tested.status, 200); assert.equal(tested.type, 'audio/wav');
  assert.equal(tested.cacheControl, 'private, no-store');
  assert.equal(tested.bytes.length, 52, 'single PCM turn is wrapped in WAV without a trailing gap');
  const first = await fullListening();
  assert.equal(first.status, 200); assert.equal(first.type, 'audio/wav');
  assert.equal(upstream.length, 6, 'grammar and listening each have their own three takes');
  const secondOffset = 44 + 8 + 86400;
  assert.deepEqual(first.bytes.subarray(secondOffset, secondOffset + 8), tested.bytes.subarray(44));
  const regenerated = await turn(1, {listening: true, regenerate: true});
  assert.equal(regenerated.status, 200);
  assert.notDeepEqual(regenerated.bytes, tested.bytes);
  const second = await fullListening();
  assert.equal(upstream.length, 7, 'regeneration changes exactly one turn');
  assert.deepEqual(second.bytes.subarray(secondOffset, secondOffset + 8), regenerated.bytes.subarray(44));
  assert.deepEqual(second.bytes.subarray(0, secondOffset), first.bytes.subarray(0, secondOffset));
  assert.deepEqual(second.bytes.subarray(secondOffset + 8), first.bytes.subarray(secondOffset + 8));
  assert.deepEqual((await student()).clips, grammar.clips, 'listening regeneration leaves grammar cache unchanged');
  assert.equal(upstream.length, 7);
});

// Kanji with furigana are spoken as their reading: a dialogue rewritten from
// kana to taught kanji keeps the take of its kana spelling, and ElevenLabs
// never chooses a reading of its own for those kanji.
test('kanji with furigana are voiced by their reading and share the kana take', async () => {
  const kana = await student();
  assert.equal(kana.status, 200);
  const generated = upstream.length;
  savedText = 'N: 二人が はなしています。\nA: こんにちは。\nB: はじめまして。';
  savedFurigana = {schemaVersion: 1, lines: [{speaker: 'N', text: '二人が はなしています。', readings: [{start: 0, end: 2, reading: 'ふたり'}]}]};
  const kanji = await student();
  assert.equal(kanji.status, 200);
  assert.deepEqual(kanji.clips, kana.clips, 'same takes as the kana dialogue');
  assert.equal(upstream.length, generated, 'no new generation');
  assert.equal((await turn(0)).text, kana.clips[0], 'the editor sends its furigana and hears the same take');
  savedFurigana = null;
  const unread = await student();
  assert.equal(upstream.at(-1).text, '二人がはなしています。', 'without furigana the kanji text itself is sent');
  assert.notEqual(unread.clips[0], kana.clips[0]);
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
  assert.equal((await turn(1, {listening: 'true'})).status, 400);
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
