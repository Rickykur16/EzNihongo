import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDialog, voiceForSpeaker } from './tts.js';

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
  assert.equal(voiceForSpeaker('A', 0).role, 'female');
  assert.equal(voiceForSpeaker('B', 1).role, 'male');
  assert.equal(voiceForSpeaker('男', 1).role, 'male');
  assert.equal(voiceForSpeaker('女', 0).role, 'female');
  // Unknown code still falls back to alternating by order, exactly as before.
  assert.equal(voiceForSpeaker('X', 0).role, 'female');
  assert.equal(voiceForSpeaker('X', 1).role, 'male');
});

test('voiceForSpeaker: a registry entry wins over both the pattern guess and the order fallback', () => {
  // サリ has no name-based pattern match at all, so before a registry entry
  // it would only ever get the order-fallback guess. This is the exact
  // migration-148 fix case: a female name previously coded "B" (which
  // pattern-matches MALE_PATTERNS) must be voiced female once registered.
  const registry = new Map([['サリ', 'female'], ['ハディ', 'male']]);
  assert.equal(voiceForSpeaker('サリ', 1, registry).role, 'female');
  assert.equal(voiceForSpeaker('ハディ', 0, registry).role, 'male');
});

test('voiceForSpeaker: narrator pattern still wins even if a same-named registry entry existed', () => {
  const registry = new Map([['N', 'female']]);
  assert.equal(voiceForSpeaker('N', 0, registry).role, 'narrator');
});

test('voiceForSpeaker: an unregistered real name still gets a usable (guessed) voice, never throws', () => {
  const registry = new Map([['アンナ', 'female']]);
  const result = voiceForSpeaker('新しい名前', 0, registry);
  assert.ok(result.role === 'female' || result.role === 'male');
});
