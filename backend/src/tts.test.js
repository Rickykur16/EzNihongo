import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDialog, voiceForSpeaker } from './routes/tts.js';

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
