import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGroundedContent, groundedCandidateFields } from './grounded-generation.js';

const empty = () => ({ vocabulary: [], grammar: [], kanji: [] });
function boundary(fingerprint = 'sha256:one') {
  return { status: 'resolved', boundaryFingerprint: fingerprint,
    course: { id: 'n5', slug: 'n5', mode: 'enforce' }, currentModule: { id: 'm1' },
    lesson: { id: 'l1', slug: 'lesson-1' }, target: empty(), previous: empty(),
    prerequisite: empty(), allowed: empty(),
    future: { ...empty(), vocabulary: [{ key: 'school', japanese: '学校', reading: 'がっこう',
      sourceIds: ['v-school'] }], kanji: [
      { key: '学', character: '学', sourceIds: ['k1'] },
      { key: '校', character: '校', sourceIds: ['k2'] },
    ] }, auxiliaryPolicy: { terms: [] }, integrityIssues: [] };
}
const valid = () => ({ japanese: 'こんにちは。' });

test('malformed then future output receives bounded feedback and returns a review-only candidate', async () => {
  const calls = [];
  const outputs = ['not json', JSON.stringify({ japanese: '学校' }), JSON.stringify(valid())];
  let saveCalls = 0;
  const result = await generateGroundedContent({ scope: { lessonId: 'l1' },
    contentType: 'vocabulary_example', resolveBoundary: async () => boundary(),
    provider: async args => { calls.push(args); return outputs.shift(); },
    save: async () => { saveCalls++; } });
  assert.equal(result.status, 'ready');
  assert.equal(result.attempts.length, 3);
  assert.deepEqual(result.attempts.map(item => item.status), ['schema_invalid', 'evaluated', 'evaluated']);
  assert.ok(calls[2].repairFeedback.issues.some(item => item.code === 'future_kanji'));
  assert.deepEqual(result.candidate, valid());
  assert.equal(result.decision.canProceed, true);
  assert.equal(saveCalls, 0);
});

test('three invalid model outputs stop at two repairs and remain rejected', async () => {
  let calls = 0;
  const result = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(), provider: async () => { calls++; return '{'; } });
  assert.equal(calls, 3);
  assert.equal(result.status, 'rejected');
  assert.equal(result.report.status, 'schema_invalid');
  assert.equal(result.candidate, null);
  const future = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(), provider: async () => ({ japanese: '学校' }) });
  assert.equal(future.status, 'rejected');
  assert.equal(future.attempts.length, 3);
  assert.ok(future.report.violations.some(item => item.code === 'future_kanji'));
});

test('example batches validate every item and expose canonical indexed fields', async () => {
  const candidate = { examples: [{ japanese: 'こんにちは。', indonesian: 'Halo.' },
    { japanese: 'こんばんは。', indonesian: 'Selamat malam.' }] };
  assert.deepEqual(groundedCandidateFields(candidate, 'grammar_example').map(field => field.path),
    ['examples[0].japanese', 'examples[0].indonesian',
      'examples[1].japanese', 'examples[1].indonesian']);
  const ready = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => boundary(), provider: async () => candidate });
  assert.equal(ready.status, 'ready');
  const malformed = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => boundary(), provider: async () => ({ examples: [candidate.examples[0], null] }) });
  assert.equal(malformed.status, 'rejected');
  assert.equal(malformed.report.status, 'schema_invalid');
  const extra = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => boundary(), provider: async () =>
      ({ examples: [{ japanese: 'こんにちは。', invented: '学校' }] }) });
  assert.equal(extra.status, 'rejected');
  assert.ok(extra.report.violations.some(item => item.code === 'invalid_example_schema'));
});

test('stale preview and changed boundary after model call never return ready', async () => {
  let called = 0;
  const initial = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    expectedBoundaryFingerprint: 'sha256:old', resolveBoundary: async () => boundary(),
    provider: async () => { called++; return valid(); } });
  assert.equal(initial.status, 'stale'); assert.equal(called, 0);
  let reads = 0;
  const changed = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(++reads === 1 ? 'sha256:one' : 'sha256:two'),
    provider: async () => valid() });
  assert.equal(changed.status, 'stale');
  assert.equal(changed.report.status, 'version_conflict');
  let sourceCalls = 0;
  let modelCalls = 0;
  const staleSource = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    expectedSourceFingerprint: 'sha256:old', resolveBoundary: async () => boundary(),
    loadSource: async () => { sourceCalls++; return { turns: [{ text: 'いま' }] }; },
    provider: async () => { modelCalls++; return valid(); } });
  assert.equal(staleSource.status, 'stale');
  assert.equal(sourceCalls, 1);
  assert.equal(modelCalls, 0);
});

test('changed source dialogue and fabricated evidence are reported explicitly', async () => {
  const source = { turns: [{ text: 'せんせいです。' }] };
  let reads = 0;
  const candidate = { question: { prompt: 'だれですか', options: ['せんせい', 'がくせい', 'いしゃ'],
    correctIndex: 0, evidence: [{ turnIndex: 0, quote: 'せんせいです。' }] } };
  const stale = await generateGroundedContent({ scope: {}, contentType: 'dialogue_comprehension',
    resolveBoundary: async () => boundary(), loadSource: async () => ++reads === 1
      ? source : { turns: [{ text: 'がくせいです。' }] }, provider: async () => candidate });
  assert.equal(stale.status, 'stale');
  const fabricated = await generateGroundedContent({ scope: {}, contentType: 'dialogue_comprehension',
    resolveBoundary: async () => boundary(), loadSource: async () => source,
    provider: async () => ({ question: { ...candidate.question,
      evidence: [{ turnIndex: 0, quote: '学校に行きます。' }] } }) });
  assert.equal(fabricated.status, 'rejected');
  assert.ok(fabricated.report.violations.some(item => item.code === 'source_evidence_invalid'));
  let calls = 0;
  const missing = await generateGroundedContent({ scope: {}, contentType: 'dialogue_comprehension',
    resolveBoundary: async () => boundary(), provider: async () => { calls++; return candidate; } });
  assert.equal(missing.status, 'rejected');
  assert.equal(missing.report.warnings[0].code, 'source_dialogue_required');
  assert.equal(calls, 0);
});

test('provider timeout and validator outage remain unavailable without save', async () => {
  const timeout = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(), providerTimeoutMs: 5,
    provider: async () => new Promise(() => {}) });
  assert.equal(timeout.status, 'unavailable');
  assert.equal(timeout.attempts.length, 3);
  const invalid = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(), provider: async () => valid(),
    validate: () => { throw new Error('db'); } });
  assert.equal(invalid.status, 'unavailable');
  assert.equal(invalid.report.warnings[0].code, 'validator_unavailable');
});

test('per-type schemas reject arbitrary or fields-only vocabulary candidates', async () => {
  for (const candidate of [{ irrelevant: 'hello' },
    { fields: [{ path: 'japanese', text: 'こんにちは' }] }]) {
    const result = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
      resolveBoundary: async () => boundary(), provider: async () => candidate });
    assert.equal(result.status, 'rejected');
    assert.equal(result.report.status, 'schema_invalid');
    assert.ok(result.report.violations.some(item => item.code === 'candidate_content_missing'));
  }
  const spoofed = { japanese: 'こんにちは', fields: [{ path: 'invented', text: '学校' }] };
  assert.deepEqual(groundedCandidateFields(spoofed, 'vocabulary_example'),
    [{ path: 'japanese', text: 'こんにちは' }]);
  const result = await generateGroundedContent({ scope: {}, contentType: 'vocabulary_example',
    resolveBoundary: async () => boundary(), provider: async () => spoofed });
  assert.equal(result.status, 'rejected');
  assert.ok(result.report.violations.some(item => item.code === 'unknown_candidate_field' && item.field === 'fields'));
  assert.ok(!result.report.violations.some(item => item.code === 'future_kanji'));
});

test('nested optional fields and distractor/question arrays require canonical types and bounds', async () => {
  const cases = [
    ['vocabulary_example', { japanese: 'こんにちは', reading: ['bad'] }, 'invalid_candidate_field'],
    ['grammar_distractors', { distractors: ['誤り', null] }, 'invalid_candidate_array'],
    ['quiz_options', { options: ['はい', 'いいえ', 'まだ', 'そう', 'いい'] }, 'invalid_candidate_array'],
    ['reading', { text: ['こんにちは'] }, 'invalid_candidate_field'],
    ['quiz_question', { question: { prompt: 'どれ', options: ['はい', {}, 'まだ'], correctIndex: 0 } },
      'invalid_question_schema'],
  ];
  for (const [contentType, candidate, code] of cases) {
    const result = await generateGroundedContent({ scope: {}, contentType,
      resolveBoundary: async () => boundary(), provider: async () => candidate });
    assert.equal(result.status, 'rejected', contentType);
    assert.equal(result.report.status, 'schema_invalid', contentType);
    assert.ok(result.report.violations.some(item => item.code === code), `${contentType}: ${code}`);
  }
});

test('null question in a plural result reports schema_invalid and permits bounded repair', async () => {
  let calls = 0;
  const source = { turns: [{ text: 'せんせいです。' }] };
  const result = await generateGroundedContent({ scope: {}, contentType: 'dialogue_comprehension',
    resolveBoundary: async () => boundary(), loadSource: async () => source,
    provider: async () => { calls++; return { questions: [null] }; } });
  assert.equal(calls, 3);
  assert.equal(result.status, 'rejected');
  assert.equal(result.report.status, 'schema_invalid');
  assert.ok(result.report.violations.some(item => item.code === 'invalid_question_schema'));
});

test('grammar generation requires observed server-owned target, not a linked or model-claimed ID', async () => {
  const targetBoundary = boundary();
  targetBoundary.target.grammar = [{ key: 'g1', pattern: '〜です', sourceIds: ['g1'] }];
  const ignored = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => targetBoundary,
    trustedValidation: { verifiedGrammarIds: ['g1'], focusGrammarIds: ['model-claim'] },
    provider: async () => ({ japanese: 'こんにちは。' }) });
  assert.equal(ignored.status, 'rejected');
  assert.ok(ignored.report.violations.some(item => item.code === 'target_grammar_not_demonstrated'));
  const observed = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => targetBoundary,
    trustedValidation: { grammarSignatures: [{ grammarId: 'g1', version: 'v1', regex: /です/u }] },
    provider: async () => ({ japanese: 'せんせいです。' }) });
  assert.equal(observed.status, 'ready');
  assert.ok(observed.report.usage.targetGrammar.some(item => item.key === 'g1' && item.field));
  const highlightOnly = await generateGroundedContent({ scope: {}, contentType: 'grammar_example',
    resolveBoundary: async () => targetBoundary,
    trustedValidation: { grammarSignatures: [{ grammarId: 'g1', version: 'v1', regex: /です/u }] },
    provider: async () => ({ japanese: 'こんにちは。', highlight: 'です' }) });
  assert.equal(highlightOnly.status, 'rejected');
  assert.ok(highlightOnly.report.violations.some(item => item.code === 'target_grammar_not_demonstrated'));
});
