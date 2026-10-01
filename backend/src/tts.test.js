import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDialog, voiceForSpeaker, fetchElevenAudio, speechText, ttsHashKey, TTS_ELEVEN_MODEL, TTS_SETTINGS_VERSION } from './routes/tts.js';
import { createHash } from 'node:crypto';

test('TTS cache distinguishes a voice swap and preserves unambiguous legacy hashes', () => {
  const text = 'A: はじめまして。\nB: サリです。';
  assert.notEqual(ttsHashKey(text, ['anna', 'sari']), ttsHashKey(text, ['sari', 'anna']));
  assert.notEqual(ttsHashKey(text, ['anna', 'anna', 'sari']), ttsHashKey(text, ['anna', 'sari', 'anna']));
  for (const voices of [['anna'], ['anna', 'anna']]) {
    const legacy = createHash('sha256').update(`elevenlabs|${voices.slice().sort().join(':')}|${TTS_ELEVEN_MODEL}|${TTS_SETTINGS_VERSION}|${text}`).digest('hex');
    assert.equal(ttsHashKey(text, voices), legacy);
  }
});

// Mocks global fetch for the duration of one test — fetchElevenAudio calls
// the bare global `fetch(...)` (no import), resolved at call time, so
// swapping it here never touches a real ElevenLabs endpoint (blocked in this
// sandbox anyway). Returns just enough of a Response shape for the function
// to succeed and captures every call's parsed JSON body for inspection.
function mockElevenFetch(t) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  t.after(() => { global.fetch = original; });
  return calls;
}

test('parseDialog still accepts every legacy prefix form unchanged', () => {
  assert.deepEqual(parseDialog('N: 男の人と女の人が話しています。\nA: どちらですか。\nB: インドネシアです。'), [
    { speaker: 'N', text: '男の人と女の人が話しています。' },
    { speaker: 'A', text: 'どちらですか。' },
    { speaker: 'B', text: 'インドネシアです。' },
  ]);
  assert.deepEqual(parseDialog('男: こんにちは。\n女: こんにちは。'), [
    { speaker: '男', text: 'こんにちは。' },
    { speaker: '女', text: 'こんにちは。' },
  ]);
  assert.equal(parseDialog('学校へ行きます。'), null, 'plain text with no prefix stays non-dialog');
});

test('parseDialog accepts a real chosen name as a speaker prefix (migration 148)', () => {
  assert.deepEqual(parseDialog('N: アンナさんとハディさんがはじめてあいます。\nアンナ: はじめまして。\nハディ: どうぞよろしく。'), [
    { speaker: 'N', text: 'アンナさんとハディさんがはじめてあいます。' },
    { speaker: 'アンナ', text: 'はじめまして。' },
    { speaker: 'ハディ', text: 'どうぞよろしく。' },
  ]);
});

test('parseDialog continuation lines (no prefix) still attach to the previous turn for named speakers too', () => {
  const turns = parseDialog('アンナ: これは\n長い台詞です。');
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'これは 長い台詞です。');
});

test('voiceForSpeaker: legacy letter/gender-word guesses are unchanged when no registry is passed', () => {
  assert.equal(voiceForSpeaker('N', 0).role, 'narrator');
  assert.equal(voiceForSpeaker('A', 0).role, 'dialogue');
  assert.equal(voiceForSpeaker('B', 1).role, 'dialogue');
  assert.equal(voiceForSpeaker('男', 1).role, 'dialogue');
  assert.equal(voiceForSpeaker('女', 0).role, 'dialogue');
  // Unknown code still falls back to alternating by order, exactly as before.
  assert.equal(voiceForSpeaker('X', 0).role, 'dialogue');
  assert.equal(voiceForSpeaker('X', 1).role, 'dialogue');
});

test('voiceForSpeaker: a registry entry wins over both the pattern guess and the order fallback, using the REAL ElevenLabs voice_id verbatim', () => {
  // サリ has no name-based pattern match at all, so before a registry entry
  // it would only ever get the order-fallback guess. This is the
  // migration-148 fix case: a name previously coded "B" (which
  // pattern-matches MALE_PATTERNS and would guess ELEVEN_VOICE_MALE) must
  // resolve to whatever REAL ElevenLabs voice was actually assigned to it,
  // not a female/male bucket.
  const registry = new Map([['サリ', 'voice_abc123'], ['ハディ', 'voice_def456']]);
  const sari = voiceForSpeaker('サリ', 1, registry);
  assert.equal(sari.voiceId, 'voice_abc123');
  assert.equal(sari.role, 'dialogue');
  const hadi = voiceForSpeaker('ハディ', 0, registry);
  assert.equal(hadi.voiceId, 'voice_def456');
  assert.equal(hadi.role, 'dialogue');
});

test('voiceForSpeaker: narrator pattern still wins even if a same-named registry entry existed', () => {
  const registry = new Map([['N', 'voice_should_never_be_used']]);
  assert.equal(voiceForSpeaker('N', 0, registry).role, 'narrator');
});

test('voiceForSpeaker: an unregistered real name still gets a usable (guessed) voice, never throws', () => {
  // Deliberately does not assert result.voiceId is non-empty: that value
  // comes from ELEVEN_VOICE_FEMALE/_MALE/_ID env vars, which are legitimately
  // unset in this test environment (and in any deploy without ElevenLabs
  // configured) — the invariant this test protects is that an unregistered
  // name resolves deterministically to the shared 'dialogue' role/settings
  // preset without throwing, not that a particular env var was exported.
  const registry = new Map([['アンナ', 'voice_abc123']]);
  const result = voiceForSpeaker('新しい名前', 0, registry);
  assert.equal(result.role, 'dialogue');
  assert.ok('voiceId' in result);
});

test('fetchElevenAudio: the one generation call every dialogue turn goes through', async (t) => {
  // resolveDialogTurns (student /tts/dialog and the admin's per-turn test/
  // regenerate) generates each turn with exactly this call, so these are the
  // invariants of every dialogue clip: narrator forced to the reliable model
  // with emotion tags stripped, a "dialogue" turn on the live model with its
  // tags kept, and no SSML <break> (the player adds its own gap).
  const calls = mockElevenFetch(t);
  await fetchElevenAudio('voice_narrator', '[calm] アンナさんとハディさんが話しています。', 'narrator');
  await fetchElevenAudio('voice_anna', 'こんにちは [excited] お元気ですか。', 'dialogue');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /text-to-speech\/voice_narrator/);
  assert.equal(calls[0].body.model_id, 'eleven_multilingual_v2');
  assert.doesNotMatch(calls[0].body.text, /\[calm\]/);
  assert.match(calls[1].url, /text-to-speech\/voice_anna/);
  assert.equal(calls[1].body.model_id, TTS_ELEVEN_MODEL);
  assert.match(calls[1].body.text, /\[excited\]/);
  for (const call of calls) assert.doesNotMatch(call.body.text, /<break/);
});

test('speechText: word spaces between Japanese are not spoken; Latin, tags and SSML keep theirs', async (t) => {
  assert.equal(speechText('たなかさんは にほんの せんせいです。'), 'たなかさんはにほんのせんせいです。');
  assert.equal(speechText('日よう日は　何を しましたか。'), '日よう日は何をしましたか。');
  assert.equal(speechText('わたしは テレビを みないで、 早く ねました。'), 'わたしはテレビをみないで、早くねました。');
  assert.equal(speechText('[excited] こんにちは。'), '[excited] こんにちは。');
  assert.equal(speechText('Tanaka さん です'), 'Tanaka さんです');
  assert.equal(speechText('はい。 <break time="700ms" />'), 'はい。 <break time="700ms" />');
  const calls = mockElevenFetch(t);
  await fetchElevenAudio('voice_anna', 'こんにちは [excited] お元気 ですか。', 'dialogue');
  await fetchElevenAudio('voice_narrator', '[calm] ふたりが はなしています。', 'narrator');
  assert.equal(calls[0].body.text, 'こんにちは [excited] お元気ですか。');
  assert.equal(calls[1].body.text, 'ふたりがはなしています。');
});
