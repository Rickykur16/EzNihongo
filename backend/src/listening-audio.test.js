import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { assembleListeningWav, listeningTurnGaps, stripListeningMarkup, validateListeningPcm } from './listening-audio.js';

process.env.ELEVENLABS_API_KEY = 'listening-test-only';
process.env.ELEVENLABS_VOICE_ID = 'shared-voice';
process.env.ELEVENLABS_VOICE_NARRATOR = 'narrator-voice';
process.env.ELEVENLABS_MODEL = 'eleven_multilingual_v2';
delete process.env.ELEVENLABS_LISTENING_MODEL;
const { db } = await import('./db.js');
const { renderTtsAudio, fetchElevenListeningPcm, listeningHashKey, ttsHashKey,
  TTS_LISTENING_MODEL, TTS_LISTENING_SETTINGS_VERSION } = await import('./routes/tts.js');
after(() => db.end());
const clip = n => Buffer.from([n, 0, n, 0]);

function response() {
  const result = { headers: {}, status: 200 };
  const res = { set: (k, v) => { result.headers[k] = v; return res; },
    status: value => { result.status = value; return res; },
    send: audio => { result.audio = audio; return res; }, json: body => { result.body = body; return res; } };
  return { result, res };
}

test('WAV timeline adds exact silence at speaker changes and none for same speaker or final turn', () => {
  const turns = ['N', 'N', 'A', 'B'].map(speaker => ({ speaker }));
  const voices = turns.map(turn => ({ voiceId: 'same-id', role: turn.speaker === 'N' ? 'narrator' : 'dialogue' }));
  const gaps = listeningTurnGaps(turns, voices);
  assert.deepEqual(gaps, [0, 1800, 1200, 0], 'A and B remain different speakers even if their voice ID is shared');
  const wav = assembleListeningWav([clip(1), clip(2), clip(3), clip(4)], gaps);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000); assert.equal(wav.readUInt32LE(28), 48000);
  assert.equal(wav.readUInt16LE(32), 2); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 16 + 86400 + 57600);
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.deepEqual(wav.subarray(44, 52), Buffer.concat([clip(1), clip(2)]));
  assert.ok(wav.subarray(52, 52 + 86400).every(byte => byte === 0));
  assert.deepEqual(wav.subarray(52 + 86400, 56 + 86400), clip(3));
  assert.ok(wav.subarray(56 + 86400, -4).every(byte => byte === 0));
  assert.deepEqual(wav.subarray(-4), clip(4));
  assert.equal(assembleListeningWav([clip(1)], [0]).length, 48, 'single utterance has no artificial lead/trailing gap');
});

test('PCM validation rejects incomplete, empty, encoded and oversized responses', () => {
  for (const audio of [Buffer.alloc(0), Buffer.alloc(3), Buffer.alloc(28800002), Buffer.from('ID3invalid'), Buffer.from('OggSxxxx')]) {
    assert.throws(() => validateListeningPcm(audio));
  }
  assert.throws(() => validateListeningPcm(assembleListeningWav([clip(1)], [0])));
  assert.throws(() => validateListeningPcm(clip(1), 'audio/mpeg'));
  assert.throws(() => validateListeningPcm(clip(1), 'application/json'));
  assert.deepEqual(validateListeningPcm(clip(1), 'audio/pcm'), clip(1));
  assert.throws(() => assembleListeningWav([clip(1)], [1200]), /gap/);
});

test('listening uses v4 for all turns, strips authored SSML, and sends only supported voice parameters', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(clip(1), { headers: { 'Content-Type': 'audio/pcm' } });
  });
  assert.equal(TTS_LISTENING_MODEL, 'eleven_v4');
  await fetchElevenListeningPcm('narrator-voice', '[calm] 会話を 聞いてください。 <break time="700ms" />');
  await fetchElevenListeningPcm('speaker-voice', '<speak>こんにちは。</speak>');
  assert.ok(calls.every(call => call.url.endsWith('?output_format=pcm_24000')));
  assert.ok(calls.every(call => call.body.model_id === 'eleven_v4'));
  for (const call of calls) assert.deepEqual(Object.keys(call.body.voice_settings).sort(), ['similarity_boost', 'stability']);
  assert.equal(calls[0].body.text, '[calm] 会話を聞いてください。');
  assert.equal(calls[1].body.text, 'こんにちは。');
  assert.equal(stripListeningMarkup('<break time="1s" />'), '');
  await assert.rejects(fetchElevenListeningPcm('speaker-voice', '<break time="1s" />'), /text_empty/);
  assert.equal(calls.length, 2);
});

test('namespaced listening cache varies with text, roles and ordered voices, without changing legacy hash', () => {
  const text = 'N: 聞いてください。\nA: こんにちは。\nB: はい。';
  const voices = ['n', 'a', 'b'].map((voiceId, i) => ({ voiceId, role: i ? 'dialogue' : 'narrator' }));
  const key = listeningHashKey(text, voices);
  assert.notEqual(key, ttsHashKey(text, voices.map(voice => voice.voiceId)));
  assert.notEqual(key, listeningHashKey(text, [voices[0], voices[2], voices[1]]));
  assert.notEqual(key, listeningHashKey(text, voices.map(voice => ({ ...voice, role: 'dialogue' }))));
  assert.notEqual(key, listeningHashKey(text + 'はい。', voices));
  assert.match(TTS_LISTENING_SETTINGS_VERSION, /^listening-/);
});

test('oversized streaming PCM is cancelled before allocating an unbounded response', async t => {
  let cancelled = false, released = false;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true,
    headers: { get: () => 'audio/pcm' }, body: { getReader: () => ({
      read: async () => ({ done: false, value: { byteLength: 28800002 } }),
      cancel: async () => { cancelled = true; }, releaseLock: () => { released = true; },
    }) } }));
  await assert.rejects(fetchElevenListeningPcm('speaker', 'こんにちは。'), /pcm_too_long/);
  assert.equal(cancelled, true); assert.equal(released, true);
});

test('simultaneous previews and student requests share one stored WAV, including cross-process cache winner', async t => {
  let cache = new Map(), calls = 0, competing = null;
  t.mock.method(db, 'query', async (sql, params = []) => {
    if (sql.includes('FROM dialogue_speakers')) return { rows: [] };
    if (sql.startsWith('SELECT audio')) return { rows: cache.has(params[0]) ? [cache.get(params[0])] : [] };
    if (sql.startsWith('UPDATE tts_cache')) return { rows: [] };
    if (sql.startsWith('INSERT INTO tts_cache')) {
      if (competing) { cache.set(params[0], { audio: competing, content_type: 'audio/wav' }); return { rows: [] }; }
      assert.equal(params[3], 'eleven_v4'); assert.equal(params[6], TTS_LISTENING_SETTINGS_VERSION);
      const row = { audio: params[4], content_type: 'audio/wav' }; cache.set(params[0], row); return { rows: [row] };
    }
    throw Error('Unexpected query: ' + sql);
  });
  t.mock.method(globalThis, 'fetch', async () => {
    const n = ++calls; await new Promise(resolve => setImmediate(resolve));
    return new Response(clip(n), { headers: { 'Content-Type': 'audio/pcm' } });
  });
  const text = 'N: 聞いてください。\nA: おはよう。\nB: おはようございます。';
  cache.set(ttsHashKey(text, ['narrator-voice', 'shared-voice', 'shared-voice']), { audio: Buffer.from('old-v6'), content_type: 'audio/mpeg' });
  const a = response(), b = response();
  await Promise.all([renderTtsAudio(text, a.res, { listening: true }), renderTtsAudio(text, b.res, { listening: true, privateResponse: true })]);
  assert.equal(calls, 3); assert.deepEqual(a.result.audio, b.result.audio);
  assert.equal(a.result.headers['Content-Type'], 'audio/wav');
  assert.equal(b.result.headers['Cache-Control'], 'private, no-store');
  const repeat = response(); await renderTtsAudio(text, repeat.res, { listening: true });
  assert.equal(calls, 3); assert.deepEqual(repeat.result.audio, a.result.audio);
  cache = new Map(); competing = assembleListeningWav([clip(99)], [0]);
  const raced = response(); await renderTtsAudio(text, raced.res, { listening: true });
  assert.deepEqual(raced.result.audio, competing, 'return the committed take, never the losing generation');
});

test('invalid provider audio returns a retryable error and never creates a cache row', async t => {
  let writes = 0;
  t.mock.method(db, 'query', async sql => { if (sql.startsWith('INSERT')) writes++; return { rows: [] }; });
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(Buffer.from([1, 2, 3]), { headers: { 'Content-Type': 'audio/pcm' } }));
  const failed = response(); await renderTtsAudio('読みます。', failed.res, { listening: true });
  assert.equal(failed.result.status, 502); assert.equal(failed.result.body.error, 'tts_upstream'); assert.equal(writes, 0);
});
