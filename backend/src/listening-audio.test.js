import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { assembleListeningWav, listeningTurnGaps, stripListeningMarkup, validateListeningPcm } from './listening-audio.js';

process.env.ELEVENLABS_API_KEY = 'listening-test-only';
process.env.ELEVENLABS_VOICE_ID = 'shared-voice';
process.env.ELEVENLABS_VOICE_NARRATOR = 'narrator-voice';
process.env.ELEVENLABS_MODEL = 'eleven_multilingual_v2';
delete process.env.ELEVENLABS_LISTENING_MODEL;
const { db } = await import('./db.js');
const { renderTtsAudio, fetchElevenListeningPcm, listeningTurnKey, dialogTurnKey, resolveDialogTurns, parseDialog, voiceForSpeaker, ttsHashKey,
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

test('turn cache varies with profile, text, role and voice, while canonical speech shares a take', () => {
  const text = '日本語を 聞いてください。', voice = { voiceId: 'voice-a', role: 'narrator' };
  const key = listeningTurnKey(text, voice);
  assert.notEqual(key, ttsHashKey(text, [voice.voiceId]));
  assert.notEqual(key, dialogTurnKey(text, voice));
  assert.notEqual(key, listeningTurnKey(text, { ...voice, voiceId: 'voice-b' }));
  assert.notEqual(key, listeningTurnKey(text, { ...voice, role: 'dialogue' }));
  assert.notEqual(key, listeningTurnKey(text + 'はい。', voice));
  assert.equal(key, listeningTurnKey('日本語を聞いてください。 <break time="1s"/>', voice));
  assert.equal(key, dialogTurnKey(text, voice, 'listening'));
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

function cacheFixture(t) {
  const cache = new Map(), writes = [];
  let competing = null;
  t.mock.method(db, 'query', async (sql, params = []) => {
    if (sql.includes('FROM dialogue_speakers')) return { rows: [] };
    if (sql.startsWith('SELECT text_hash, audio')) return { rows: params[0].filter(key => cache.has(key)).map(key => ({ text_hash: key, audio: cache.get(key) })) };
    if (sql.startsWith('UPDATE tts_cache')) return { rows: [] };
    if (sql.includes('INSERT INTO tts_cache')) {
      assert.equal(params[3], 'eleven_v4');
      assert.equal(params[5], 'audio/pcm');
      assert.equal(params[7], TTS_LISTENING_SETTINGS_VERSION);
      writes.push(params[0]);
      if (competing) cache.set(params[0], competing);
      else if (!cache.has(params[0]) || sql.includes('UPDATE SET')) cache.set(params[0], params[4]);
      return { rows: [] };
    }
    throw Error('Unexpected query: ' + sql);
  });
  return { cache, writes, compete: audio => { competing = audio; } };
}

test('parallel full audio requests and per-turn preview use the committed PCM take, including another-process winner', async t => {
  const state = cacheFixture(t); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    const n = ++calls; await new Promise(resolve => setImmediate(resolve));
    return new Response(clip(n), { headers: { 'Content-Type': 'audio/pcm' } });
  });
  const text = 'N: 聞いてください。\nA: おはよう。\nB: おはようございます。';
  const turns = parseDialog(text), turnVoices = turns.map((turn, i) => voiceForSpeaker(turn.speaker, i));
  state.cache.set(ttsHashKey(text, turnVoices.map(v => v.voiceId)), Buffer.from('old-v6'));
  state.cache.set('old-listening-full-wav', assembleListeningWav([clip(99)], [0]));
  const a = response(), b = response();
  await Promise.all([renderTtsAudio(text, a.res, { listening: true }), renderTtsAudio(text, b.res, { listening: true, privateResponse: true })]);
  assert.equal(calls, 3); assert.deepEqual(a.result.audio, b.result.audio);
  assert.equal(a.result.headers['Content-Type'], 'audio/wav');
  assert.equal(b.result.headers['Cache-Control'], 'private, no-store');
  const preview = await resolveDialogTurns({ turns, turnVoices, indices: [1], profile: 'listening' });
  assert.deepEqual(preview[0], clip(2));
  assert.deepEqual(a.result.audio, assembleListeningWav([clip(1), preview[0], clip(3)], [1800, 1200, 0]));
  assert.equal(calls, 3);
  assert.equal(state.writes.length, 3, 'only turn rows are written, never a stale full WAV');
  state.cache.clear(); state.compete(clip(99));
  const raced = response(); await renderTtsAudio(text, raced.res, { listening: true });
  assert.deepEqual(raced.result.audio, assembleListeningWav([clip(99), clip(99), clip(99)], [1800, 1200, 0]), 'compose committed takes, never losing generations');
});

test('editing or regenerating one turn reuses all other takes and immediately changes full listening audio', async t => {
  const { cache } = cacheFixture(t); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(clip(++calls), { headers: { 'Content-Type': 'audio/pcm' } }));
  const text = 'N: 聞いてください。\nA: おはよう。\nB: おはようございます。';
  const turns = parseDialog(text), turnVoices = turns.map((turn, i) => voiceForSpeaker(turn.speaker, i));
  // Testing a turn before full playback must generate that take only once.
  const [tested] = await resolveDialogTurns({ turns, turnVoices, indices: [1], profile: 'listening' });
  const first = response(); await renderTtsAudio(text, first.res, { listening: true });
  assert.equal(calls, 3);
  assert.deepEqual(first.result.audio, assembleListeningWav([clip(2), tested, clip(3)], [1800, 1200, 0]));
  const editedText = text.replace('おはよう。', 'こんにちは。');
  const edited = response(); await renderTtsAudio(editedText, edited.res, { listening: true });
  assert.equal(calls, 4, 'editing one line generates one new clip');
  assert.deepEqual(edited.result.audio, assembleListeningWav([clip(2), clip(4), clip(3)], [1800, 1200, 0]));
  const [regenerated] = await resolveDialogTurns({ turns, turnVoices, indices: [1], profile: 'listening', regenerate: true });
  assert.deepEqual(regenerated, clip(5));
  const replay = response(); await renderTtsAudio(text, replay.res, { listening: true });
  assert.equal(calls, 5, 'full playback makes no synthesis call after one-turn regeneration');
  assert.deepEqual(replay.result.audio, assembleListeningWav([clip(2), clip(5), clip(3)], [1800, 1200, 0]));
  assert.deepEqual(cache.get(listeningTurnKey(turns[0].text, turnVoices[0])), clip(2));
});

test('aggregate listening limit stops later paid turns, counting cached clips and deterministic gaps', async t => {
  const { cache } = cacheFixture(t); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(Buffer.alloc(48000), { headers: { 'Content-Type': 'audio/pcm' } }); });
  const text = 'N: 聞いてください。\nA: はい。\nB: わかりました。';
  const turns = parseDialog(text), turnVoices = turns.map((turn, i) => voiceForSpeaker(turn.speaker, i));
  cache.set(listeningTurnKey(turns[0].text, turnVoices[0]), Buffer.alloc(48000 * 596));
  await assert.rejects(resolveDialogTurns({ turns, turnVoices, profile: 'listening' }), /listening_audio_too_long/);
  assert.equal(calls, 2, '596 seconds + 3 seconds gaps + 1 second A reaches the bound; B exceeds it');
  cache.clear(); calls = 0;
  cache.set(listeningTurnKey(turns[0].text, turnVoices[0]), Buffer.alloc(48000 * 597));
  await assert.rejects(resolveDialogTurns({ turns, turnVoices, profile: 'listening' }), /listening_audio_too_long/);
  assert.equal(calls, 1, 'overflow after A prevents any B synthesis');
});

test('invalid provider audio returns a retryable error and never creates a cache row', async t => {
  let writes = 0;
  t.mock.method(db, 'query', async sql => { if (sql.startsWith('INSERT')) writes++; return { rows: [] }; });
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(Buffer.from([1, 2, 3]), { headers: { 'Content-Type': 'audio/pcm' } }));
  const failed = response(); await renderTtsAudio('読みます。', failed.res, { listening: true });
  assert.equal(failed.result.status, 502); assert.equal(failed.result.body.error, 'tts_upstream'); assert.equal(writes, 0);
});
