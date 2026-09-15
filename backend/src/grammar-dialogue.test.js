import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyDraft, normalizeDraft, compileTurn, prepareDialogue, toKatakana,
  tokenizeWithReadings, suggestReadings, vocabularyDictionary, dialogueTimings } from '../../src/grammar-dialogue-core.js';
import { audioFingerprint, generateDialogueAudio, providerError, sendAudioBytes } from './grammar-dialogue-audio.js';

const voices = { N: 'NarratorVoice12345678', A: 'FemaleVoice123456789', B: 'MaleVoice12345678901' };
function fixture() {
  const draft = legacyDraft({
    pattern: '予定', example_dialog: 'A: 明日は学校に行きます。\nB: 田中さんも行きます。',
    example_dialog_id: 'A: Besok saya pergi ke sekolah.\nB: Tanaka juga pergi.',
  }, voices);
  draft.dictionary = [
    { text: '明日', reading: 'あした' }, { text: '学校', reading: 'がっこう' },
    { text: '行きます', reading: 'いきます' }, { text: '田中', reading: 'たなか' },
  ];
  const suggested = suggestReadings(draft);
  suggested.turns.forEach(turn => { turn.reviewed = true; });
  return suggested;
}

test('word readings include okurigana and retain Japanese particles', () => {
  const draft = fixture();
  assert.equal(compileTurn(draft.turns[0]), 'あしたはがっこうにいきます。');
  assert.equal(compileTurn(draft.turns[1]), 'たなかさんもいきます。');
  assert.equal(draft.turns[0].japanese, '明日は学校に行きます。');
  assert.equal(toKatakana('う\u3099ぁっきゃー'), 'ヴァッキャー');
});
test('ambiguous vocabulary is not guessed and explicit context overrides it', () => {
  const vocabulary = vocabularyDictionary([
    { japanese: '明日', reading: 'あした' }, { japanese: '明日', reading: 'あす' },
    { japanese: '学校', reading: 'がっこう' }, { japanese: '学校', reading: 'ガッコウ' },
  ]);
  assert.deepEqual(vocabulary, [{ text: '学校', reading: 'ガッコウ' }]);
  const draft = legacyDraft({ example_dialog: 'A: 明日。', example_dialog_id: 'A: Besok.' }, voices);
  draft.dictionary = [{ text: '明日', reading: 'あす' }];
  assert.equal(compileTurn(suggestReadings(draft, vocabulary).turns[0]), 'あす。');
});
test('manual corrections stay at their source offsets, including repeated words', () => {
  const text = '明日と明日';
  const previous = [{ text: '明日', reading: 'あす' }, { text: 'と', reading: '' }, { text: '明日', reading: 'あした' }];
  const tokens = tokenizeWithReadings(text, [{ text: '明日', reading: 'みょうにち' }], previous);
  assert.deepEqual(tokens.map(t => t.reading), ['あす', '', 'あした']);
});
test('names in the speaker dictionary apply when mentioned by the other speaker', () => {
  const draft = legacyDraft({ example_dialog: 'B: 田中さん。', example_dialog_id: 'B: Tanaka.' }, voices);
  draft.speakers[1].name = '田中'; draft.speakers[1].reading = 'たなか';
  assert.equal(compileTurn(suggestReadings(draft).turns[0]), 'たなかさん。');
});
test('updated dictionary suggestions replace old suggestions but not manual corrections', () => {
  let draft = fixture();
  draft.turns.forEach(turn => { turn.reviewed = false; });
  draft.dictionary[0].reading = 'あす';
  draft = suggestReadings(draft);
  assert.equal(compileTurn(draft.turns[0]), 'あすはがっこうにいきます。');
  draft.turns[0].tokens[0].reading = 'あした';
  draft.turns[0].tokens[0].source = 'manual';
  assert.equal(compileTurn(suggestReadings(draft).turns[0]), 'あしたはがっこうにいきます。');
});
test('unreviewed, missing, Latin, numeric and mismatched readings cannot reach TTS', () => {
  const draft = fixture();
  draft.turns[0].reviewed = false;
  assert.throws(() => prepareDialogue(draft), /Periksa/);
  const turn = { japanese: '学校', tokens: [{ text: '学校', reading: '' }] };
  assert.throws(() => compileTurn(turn), /Bacaan belum/);
  turn.tokens[0].reading = 'gakkou';
  assert.throws(() => compileTurn(turn), /kana/);
  turn.tokens[0].reading = '学校';
  assert.throws(() => compileTurn(turn), /kana/);
  turn.tokens[0].text = '学';
  assert.throws(() => compileTurn(turn), /cocok/);
  assert.throws(() => compileTurn({ japanese: '3日', tokens: [{ text: '3日', reading: '' }] }), /Bacaan belum/);
});
test('legacy translation mismatches never attach a translation to the wrong speaker', () => {
  const draft = legacyDraft({ example_dialog: 'A: はい。\nB: いいえ。', example_dialog_id: 'B: Ya.\nA: Tidak.' });
  assert.deepEqual(draft.turns.map(t => t.translation), ['', '']);
  assert.equal(legacyDraft({ example_dialog: 'A: [excited] はい。' }).turns[0].japanese, 'はい。');
});
test('draft validation rejects duplicate IDs, invalid roles, and oversized payloads', () => {
  const draft = fixture();
  draft.turns[1].id = draft.turns[0].id;
  assert.throws(() => normalizeDraft(draft), /unik/);
  draft.turns[1].id = 'other'; draft.turns[1].speaker = '__proto__';
  assert.throws(() => normalizeDraft(draft), /Speaker/);
  assert.throws(() => normalizeDraft({ padding: 'x'.repeat(100001) }), /besar/);
});
test('generation fingerprints preserve speaker order, readings, model choice and take ID', () => {
  const draft = fixture();
  const hash = audioFingerprint(draft, 'dialogue-v3', 'take-1');
  assert.equal(hash, audioFingerprint(fixture(), 'dialogue-v3', 'take-1'));
  const changed = structuredClone(draft);
  [changed.speakers[1].voiceId, changed.speakers[2].voiceId] = [changed.speakers[2].voiceId, changed.speakers[1].voiceId];
  assert.notEqual(hash, audioFingerprint(changed, 'dialogue-v3', 'take-1'));
  assert.notEqual(hash, audioFingerprint(draft, 'turns-v2', 'take-1'));
  assert.notEqual(hash, audioFingerprint(draft, 'dialogue-v3', 'take-2'));
  changed.turns[0].tokens[0].reading = 'あす';
  assert.notEqual(hash, audioFingerprint(changed, 'dialogue-v3', 'take-1'));
});
test('timestamps use dialogue_input_index, rejecting missing and malformed turns', () => {
  const turns = [{ id: 'a' }, { id: 'b' }];
  const segments = [
    { dialogue_input_index: 1, start_time_seconds: 2, end_time_seconds: 3 },
    { dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 1 },
    { dialogue_input_index: 0, start_time_seconds: 1, end_time_seconds: 1.5 },
  ];
  assert.deepEqual(dialogueTimings(segments, turns), [{ id: 'a', start: 0, end: 1.5 }, { id: 'b', start: 2, end: 3 }]);
  assert.throws(() => dialogueTimings(segments.slice(1), turns), /tidak tersedia/);
  assert.throws(() => dialogueTimings([{ dialogue_input_index: 0, start_time_seconds: NaN, end_time_seconds: 1 }], [turns[0]]), /tidak valid/);
});
test('dialogue generator sends reviewed kana, explicit v3 and Japanese language without changing the transcript', async () => {
  const draft = fixture(); draft.turns[0].intent = 'curious';
  let called = 0;
  const output = await generateDialogueAudio(draft, 'dialogue-v3', { apiKey: 'test-secret', voices, fetcher: async (url, options) => {
    called++;
    assert.match(url, /text-to-dialogue\/with-timestamps/);
    const body = JSON.parse(options.body);
    assert.equal(body.model_id, 'eleven_v3');
    assert.equal(body.language_code, 'ja');
    assert.equal(body.apply_text_normalization, 'off');
    assert.equal(body.inputs[0].text, '[curious] あしたはがっこうにいきます。');
    assert.ok(body.inputs.every(input => !/\p{Script=Han}/u.test(input.text)));
    return new Response(JSON.stringify({ audio_base64: Buffer.from('audio').toString('base64'), voice_segments: [
      { dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 2 },
      { dialogue_input_index: 1, start_time_seconds: 2, end_time_seconds: 4 },
    ] }));
  } });
  assert.equal(called, 1); assert.equal(output.alignment.mode, 'continuous');
  assert.equal(draft.turns[0].japanese, '明日は学校に行きます。');
});
test('v2 audition uses separate audio ranges and neutral kana without expression tags', async () => {
  const draft = fixture(); draft.turns[0].intent = 'excited';
  let calls = 0;
  const output = await generateDialogueAudio(draft, 'turns-v2', { apiKey: 'test-secret', voices, fetcher: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model_id, 'eleven_multilingual_v2'); assert.doesNotMatch(body.text, /\[/);
    // Flat delivery (high stability, style 0) is what made generated dialogue
    // sound recited; speakers must get the expressive preset from tts.js.
    assert.deepEqual(body.voice_settings,
      { stability: 0.35, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 0.92 });
    calls++;
    return new Response(JSON.stringify({ audio_base64: Buffer.from('audio' + calls).toString('base64'),
      alignment: { character_end_times_seconds: [0.5, 1.2] } }));
  } });
  assert.equal(calls, 2); assert.equal(output.alignment.mode, 'segments');
  const [a, b] = output.alignment.turns;
  assert.equal(output.audio.subarray(a.byteStart, a.byteEnd).toString(), 'audio1');
  assert.equal(output.audio.subarray(b.byteStart, b.byteEnd).toString(), 'audio2');
});
test('narrator is voiced with the calm preset while dialogue speakers stay expressive', async () => {
  const draft = legacyDraft({ example_dialog: 'N: ふたりははなします。\nA: はい。',
    example_dialog_id: 'N: Dua orang berbicara.\nA: Ya.' }, voices);
  draft.turns.forEach(turn => { turn.reviewed = true; });
  const sent = [];
  await generateDialogueAudio(draft, 'turns-v2', { apiKey: 'test-secret', voices, fetcher: async (_url, options) => {
    sent.push(JSON.parse(options.body).voice_settings);
    return new Response(JSON.stringify({ audio_base64: Buffer.from('audio').toString('base64'),
      alignment: { character_end_times_seconds: [0.5, 1.2] } }));
  } });
  assert.equal(sent[0].stability, 0.55); assert.equal(sent[0].speed, 0.95); assert.equal(sent[0].style, 0);
  assert.equal(sent[1].stability, 0.35); assert.equal(sent[1].speed, 0.92); assert.equal(sent[1].style, 0.4);
});
test('paid generation failures are not retried and permission errors do not expose credentials', async () => {
  let calls = 0;
  await assert.rejects(generateDialogueAudio(fixture(), 'dialogue-v3', {
    apiKey: 'test-secret', voices, fetcher: async () => {
      calls++;
      return new Response(JSON.stringify({ detail: { status: 'missing_permissions',
        message: 'key test-secret is missing voices_read' } }), { status: 401 });
    },
  }), /voices_read/);
  assert.equal(calls, 1);
  assert.doesNotMatch(providerError(401, { status: 'missing_permissions', message: 'key test-secret is missing voices_read' }), /test-secret/);
});
test('byte-range streaming supports seeking, suffixes and rejects invalid ranges', () => {
  function response(range) {
    const result = { headers: {}, code: 200 };
    const res = { set(k, v) { result.headers[k] = v; return this; }, status(code) { result.code = code; return this; },
      send(body) { result.body = body; return result; }, end() { return result; } };
    return sendAudioBytes({ headers: { range } }, res, Buffer.from('0123456789'), 'version', true);
  }
  assert.equal(response('bytes=2-4').body.toString(), '234');
  assert.equal(response('bytes=-3').body.toString(), '789');
  assert.equal(response('bytes=99-').code, 416);
  assert.equal(response('bytes=2-1').code, 416);
  assert.equal(response('bytes=-').code, 416);
  assert.equal(response().headers['Cache-Control'], 'public, max-age=31536000, immutable');
});
