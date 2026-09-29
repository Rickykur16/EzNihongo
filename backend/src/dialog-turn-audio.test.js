import test from 'node:test';
import assert from 'node:assert/strict';

// The module reads the ElevenLabs key once at load time, so it is set before
// the dynamic import. Every network call is mocked below; nothing leaves the
// process.
process.env.ELEVENLABS_API_KEY = 'test-key';
const {
  dialogTurnAudio, dialogTurnCacheKey, seedDialogTurnsFromLegacy, ttsHashKey, TTS_ELEVEN_MODEL,
} = await import('./routes/tts.js');

// In-memory stand-in for tts_cache that understands exactly the statements
// the per-turn cache issues.
function memoryCache() {
  const rows = new Map();
  const dbQuery = async (sql, params) => {
    if (/^SELECT text_hash, audio FROM tts_cache WHERE text_hash = ANY/.test(sql)) {
      return { rows: params[0].filter(key => rows.has(key)).map(key => ({ text_hash: key, audio: rows.get(key).audio })) };
    }
    if (/^SELECT text_hash FROM tts_cache WHERE text_hash = ANY/.test(sql)) {
      return { rows: params[0].filter(key => rows.has(key)).map(key => ({ text_hash: key })) };
    }
    if (/^SELECT alignment FROM tts_cache/.test(sql)) {
      return { rows: rows.has(params[0]) ? [{ alignment: rows.get(params[0]).alignment }] : [] };
    }
    if (/^SELECT audio FROM tts_cache/.test(sql)) {
      return { rows: rows.has(params[0]) ? [{ audio: rows.get(params[0]).audio }] : [] };
    }
    if (/^\s*INSERT INTO tts_cache/.test(sql)) {
      const [key, text, voice, model, audio] = params;
      if (rows.has(key) && !/DO UPDATE/.test(sql)) return { rows: [] };
      rows.set(key, { text, voice, model, audio });
      return { rows: [{ audio }] };
    }
    if (/^UPDATE tts_cache SET last_used_at/.test(sql)) return { rows: [] };
    throw new Error('Unexpected SQL: ' + sql);
  };
  return { rows, dbQuery };
}

// Each ElevenLabs call returns a distinct recording, so a test can tell which
// take is stored and served.
function mockEleven(t) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(`take-${calls.length}`).buffer };
  };
  t.after(() => { global.fetch = original; });
  return calls;
}

const text = 'N: [calm] ふたりが話しています。\nA: はじめまして [excited]。\nB: ハディです。';
const turns = [
  { speaker: 'N', text: '[calm] ふたりが話しています。' },
  { speaker: 'A', text: 'はじめまして [excited]。' },
  { speaker: 'B', text: 'ハディです。' },
];
const turnVoices = [
  { voiceId: 'voice_narrator', role: 'narrator' },
  { voiceId: 'voice_anna', role: 'dialogue' },
  { voiceId: 'voice_hadi', role: 'dialogue' },
];
const heard = map => [0, 1, 2].map(i => Buffer.from(map.get(i)).toString());

test('student and admin share one recording per turn; a cached turn is never generated again', async (t) => {
  const calls = mockEleven(t);
  const { rows, dbQuery } = memoryCache();
  const student = await dialogTurnAudio({ text, turns, turnVoices, dbQuery });
  assert.deepEqual(heard(student), ['take-1', 'take-2', 'take-3']);
  assert.equal(rows.size, 3, 'one cache row per turn');
  // Narrator keeps the reliable model with tags stripped; dialogue turns keep
  // the live model and tags, and no SSML break is appended between clips.
  assert.equal(calls[0].body.model_id, 'eleven_multilingual_v2');
  assert.doesNotMatch(calls[0].body.text, /\[calm\]/);
  assert.equal(calls[1].body.model_id, TTS_ELEVEN_MODEL);
  assert.match(calls[1].body.text, /\[excited\]/);
  assert.ok(calls.every(call => !/<break/.test(call.body.text)));

  const admin = await dialogTurnAudio({ text, turns, turnVoices, indices: [1], dbQuery });
  assert.equal(Buffer.from(admin.get(1)).toString(), 'take-2', 'the admin test plays what the student heard');
  assert.equal(calls.length, 3, 'no new ElevenLabs call');

  // The same turn inside another dialogue reuses its recording.
  const other = await dialogTurnAudio({ text: 'B: ハディです。', turns: [turns[2]], turnVoices: [turnVoices[2]],
    dbQuery });
  assert.equal(Buffer.from(other.get(0)).toString(), 'take-3');
  assert.equal(calls.length, 3);
});

test('regenerating one turn replaces only that turn, for students too', async (t) => {
  const calls = mockEleven(t);
  const { dbQuery } = memoryCache();
  await dialogTurnAudio({ text, turns, turnVoices, dbQuery });
  const fresh = await dialogTurnAudio({ text, turns, turnVoices, indices: [1], regenerate: true, dbQuery });
  assert.equal(Buffer.from(fresh.get(1)).toString(), 'take-4');
  assert.equal(calls.length, 4, 'exactly one new ElevenLabs call');
  assert.equal(calls[3].body.text, turns[1].text);
  const student = await dialogTurnAudio({ text, turns, turnVoices, dbQuery });
  assert.deepEqual(heard(student), ['take-1', 'take-4', 'take-3']);
  assert.equal(calls.length, 4);
});

test('existing student recordings are reused instead of paying for a new take', async (t) => {
  const calls = mockEleven(t);
  const { rows, dbQuery } = memoryCache();
  const legacyKey = ttsHashKey('dialogsegs1\n' + text, turnVoices.map(v => v.voiceId));
  const legacy = speakers => ({ format: 'dialog-segments-v1', segments: speakers.map((speaker, i) => ({
    speaker, role: turnVoices[i].role, audio_base64: Buffer.from(`old-${i}`).toString('base64'), content_type: 'audio/mpeg' })) });
  rows.set(legacyKey, { alignment: legacy(['N', 'A', 'B']) });
  const student = await dialogTurnAudio({ text, turns, turnVoices, dbQuery });
  assert.deepEqual(heard(student), ['old-0', 'old-1', 'old-2']);
  assert.equal(calls.length, 0);
  assert.equal(await seedDialogTurnsFromLegacy({ text, turns, turnVoices, dbQuery }), 0, 'seeding runs once');

  // A regenerated turn is never overwritten by the old payload afterwards.
  await dialogTurnAudio({ text, turns, turnVoices, indices: [2], regenerate: true, dbQuery });
  assert.deepEqual(heard(await dialogTurnAudio({ text, turns, turnVoices, dbQuery })), ['old-0', 'old-1', 'take-1']);

  // A payload that no longer lines up with the turns is ignored.
  const other = memoryCache();
  other.rows.set(legacyKey, { alignment: legacy(['N', 'B', 'A']) });
  assert.equal(await seedDialogTurnsFromLegacy({ text, turns, turnVoices, dbQuery: other.dbQuery }), 0);
  assert.equal(other.rows.size, 1);
});

test('the cache key follows the voice, the role and the spoken text', () => {
  const key = dialogTurnCacheKey(turns[1], turnVoices[1]);
  assert.notEqual(key, dialogTurnCacheKey(turns[1], { ...turnVoices[1], voiceId: 'voice_other' }));
  assert.notEqual(key, dialogTurnCacheKey(turns[1], { ...turnVoices[1], role: 'narrator' }));
  assert.notEqual(key, dialogTurnCacheKey({ ...turns[1], text: 'はじめまして。' }, turnVoices[1]));
  assert.equal(key, dialogTurnCacheKey({ ...turns[1], speaker: 'アンナ' }, turnVoices[1]),
    'the speaker label is not part of the audio');
});

test('without a voice or key nothing is generated and the caller gets a typed error', async (t) => {
  const calls = mockEleven(t);
  const { dbQuery } = memoryCache();
  await assert.rejects(dialogTurnAudio({ text, turns, turnVoices: [turnVoices[0], { voiceId: '', role: 'dialogue' }, turnVoices[2]],
    indices: [1], dbQuery }), { code: 'tts_disabled' });
  global.fetch = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  await assert.rejects(dialogTurnAudio({ text, turns, turnVoices, indices: [0], dbQuery }), { code: 'tts_upstream' });
  assert.equal(calls.length, 0);
});
