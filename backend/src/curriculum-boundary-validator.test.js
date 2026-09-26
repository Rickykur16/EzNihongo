import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisibleJapanese, validateContentAgainstBoundary, validateQuestionShape } from './curriculum-boundary-validator.js';

const entry = (key, values, moduleOrder) => ({ key, ...values, sourceIds: [`id-${key}`],
  earliestIntroduction: { courseId: 'n5-id', moduleId: `module-${moduleOrder}`, moduleOrder } });
const sets = () => ({ vocabulary: [], kanji: [], grammar: [] });
function boundary() {
  const target = sets(), previous = sets(), prerequisite = sets(), future = sets();
  target.vocabulary.push(entry('teacher', { japanese: 'せんせい', reading: 'せんせい', sense: 'guru' }, 1));
  previous.kanji.push(entry('日', { character: '日' }, 1));
  future.vocabulary.push(
    entry('school', { japanese: '学校', reading: 'がっこう', sense: 'sekolah' }, 7),
    entry('bridge', { japanese: 'はし', reading: 'はし', sense: 'jembatan' }, 7),
    entry('chopsticks', { japanese: 'はし', reading: 'はし', sense: 'sumpit' }, 8),
    entry('bridge-kanji', { japanese: '橋', reading: 'はし', sense: 'jembatan' }, 8),
  );
  future.kanji.push(entry('先', { character: '先' }, 7), entry('生', { character: '生' }, 7),
    entry('学', { character: '学' }, 7), entry('校', { character: '校' }, 7));
  target.grammar.push(entry('grammar-current', { pattern: '〜です' }, 1));
  future.grammar.push(entry('grammar-future', { pattern: '〜ています' }, 7));
  return { status: 'resolved', boundaryFingerprint: 'sha256:test', course: { id: 'n5-id', slug: 'n5' },
    lesson: { slug: 'lesson-bab-1' }, target, previous, prerequisite, future,
    auxiliaryPolicy: { version: 0, terms: [] }, integrityIssues: [] };
}
const validate = (text, options = {}) => validateContentAgainstBoundary({
  boundary: options.boundary || boundary(), contentType: options.contentType || 'grammar_example',
  operation: options.operation || 'audit', fields: options.fields || [{ path: 'example', text, language: 'ja' }],
  ...options,
});

test('B08/B09: known kana word does not permit future kanji, including ruby base and speaker names', () => {
  const plain = validate('せんせい');
  assert.equal(plain.valid, true);
  assert.equal(plain.usage.targetVocabulary.length, 1);
  const knownKanjiUnknownWord = validate('日日');
  assert.equal(knownKanjiUnknownWord.violations.length, 0);
  assert.ok(knownKanjiUnknownWord.warnings.some(item => item.code === 'lexical_coverage_unknown'));
  const rubyText = '<ruby>先生<rt>せんせい</rt></ruby>';
  const extracted = extractVisibleJapanese(rubyText);
  assert.equal(extracted[0].text, '先生');
  assert.equal(extracted[1].text, 'せんせい');
  const ruby = validate(rubyText);
  assert.deepEqual(ruby.violations.filter(item => item.code === 'future_kanji').map(item => item.value), ['先', '生']);
  assert.equal(ruby.violations[0].start, rubyText.indexOf('先'));
  assert.equal(ruby.violations[0].end, rubyText.indexOf('先') + 1);
  const speaker = validate('', { fields: [{ path: 'dialogue.turns[0].speaker', text: '先生', language: 'ja' }] });
  assert.equal(speaker.violations.filter(item => item.code === 'future_kanji').length, 2);
  const astral = validate('A𠮷B');
  const astralWarning = astral.warnings.find(item => item.code === 'unregistered_kanji' && item.value === '𠮷');
  assert.deepEqual([astralWarning.start, astralWarning.end], [1, 3]);
});

test('B10: whole-span future vocabulary is hard; substring and homophone are warnings', () => {
  const exact = validate('学校');
  assert.ok(exact.violations.some(item => item.code === 'future_vocabulary' && item.confidence === 'high'));
  assert.ok(exact.violations.some(item => item.code === 'future_kanji'));
  const embedded = validate('大学校');
  assert.ok(!embedded.violations.some(item => item.code === 'future_vocabulary'));
  assert.ok(embedded.warnings.some(item => item.code === 'future_vocabulary_uncertain'));
  const homophone = validate('はし');
  assert.ok(!homophone.violations.some(item => item.code === 'future_vocabulary'));
  assert.ok(homophone.warnings.some(item => item.code === 'ambiguous_vocabulary_sense'));
  const reading = validate('がっこう');
  assert.ok(reading.warnings.some(item => item.code === 'future_vocabulary_reading_ambiguous'));
  const inflectedBoundary = boundary();
  inflectedBoundary.future.vocabulary.push(entry('eat', { japanese: '食べる', reading: 'たべる', sense: 'makan' }, 9));
  const inflected = validate('せんせい たべました', { boundary: inflectedBoundary });
  assert.ok(inflected.warnings.some(item => item.code === 'lexical_coverage_unknown' && item.value.includes('たべました')));
  const decomposed = validate('か\u3099 学校');
  const school = decomposed.violations.find(item => item.code === 'future_vocabulary');
  assert.deepEqual([school.start, school.end], [3, 5]);
});

test('B12: auxiliary applies only to lexical checks in matching scope', () => {
  const matched = boundary();
  matched.auxiliaryPolicy = { version: 1, terms: [{ surface: '学校', courseIds: ['n5-id'], contentTypes: ['grammar_example'], reason: 'reviewed' }] };
  const report = validate('学校', { boundary: matched });
  assert.ok(!report.violations.some(item => item.code === 'future_vocabulary'));
  assert.ok(report.violations.some(item => item.code === 'future_kanji'));
  assert.equal(report.usage.auxiliary[0].reason, 'reviewed');
  const embedded = validate('大学校', { boundary: matched });
  assert.equal(embedded.usage.auxiliary.length, 0);
  const wrongType = validate('学校', { boundary: matched, contentType: 'quiz_question' });
  assert.ok(wrongType.violations.some(item => item.code === 'future_vocabulary'));
  const wrongCourse = boundary(); wrongCourse.course.id = 'another'; wrongCourse.auxiliaryPolicy = matched.auxiliaryPolicy;
  assert.ok(validate('学校', { boundary: wrongCourse }).violations.some(item => item.code === 'future_vocabulary'));
});

test('B13: kana-decoding carrier exemption is exact to N5 assessment slug and keeps kanji checks', () => {
  const allowed = boundary(); allowed.lesson.slug = 'assignment-bab-1-hiragana';
  const kana = validate('学校', { boundary: allowed, contentType: 'quiz_question' });
  assert.ok(!kana.violations.some(item => item.code === 'future_vocabulary'));
  assert.ok(kana.exceptions.some(item => item.code === 'kana_decoding_carrier'));
  assert.ok(kana.violations.some(item => item.code === 'future_kanji'));
  const dialogue = validate('学校', { boundary: allowed, contentType: 'grammar_dialog' });
  assert.ok(dialogue.violations.some(item => item.code === 'future_vocabulary'));
  const other = boundary(); other.lesson.slug = 'assignment-bab-3';
  assert.ok(validate('学校', { boundary: other, contentType: 'quiz_question' }).violations.some(item => item.code === 'future_vocabulary'));
});

test('B11: grammar needs a versioned source-ID signature or verified link; model claim is only a hint', () => {
  const signature = { grammarId: 'id-grammar-future', version: 'v1', regex: /(?:て|で)います/u };
  const future = validate('今、読んでいます', { grammarSignatures: [signature] });
  assert.ok(future.violations.some(item => item.code === 'future_grammar'));
  const negative = validate('いま、よみます', { grammarSignatures: [signature] });
  assert.ok(!negative.violations.some(item => item.code === 'future_grammar'));
  const declared = validate('いま、よみます', { usedGrammarIds: ['id-grammar-future'], focusGrammarIds: ['id-grammar-current'] });
  assert.ok(!declared.violations.some(item => item.code === 'future_grammar'));
  assert.ok(declared.warnings.some(item => item.code === 'model_grammar_claim_unverified'));
  assert.ok(declared.warnings.some(item => item.code === 'target_grammar_unverified'));
  const linked = validate('いま、よみます', { verifiedGrammarIds: ['id-grammar-future'] });
  assert.ok(linked.violations.some(item => item.code === 'future_grammar'));
});

test('B14: existing compound explorer stays outside assessed policy; copied question is checked', () => {
  const explorer = validate('学校', { contentType: 'kanji_compound_exploration' });
  assert.equal(explorer.status, 'not_run'); assert.equal(explorer.valid, null);
  const assessed = validate('学校', { contentType: 'kanji_compound_assessed' });
  assert.ok(assessed.violations.some(item => item.code === 'future_vocabulary'));
});

test('every visible field is checked, metadata ignored, and schema/goal/context results are explicit', () => {
  const report = validate('', { fields: [
    { path: 'dialogue.turns[0].speaker', text: '学校', language: 'ja' },
    { path: 'dialogue.turns[1].speaker', text: '学校', language: 'metadata' },
    { path: 'questions[0].options[2]', text: '先生', language: 'ja' },
    { path: 'explanation', text: 'Artinya 学校', language: 'id' },
    { path: 'voiceId', text: '学校', language: 'metadata' },
    { path: 'url', text: 'https://example.invalid/学校', language: 'ja' },
  ] });
  assert.ok(report.violations.some(item => item.field === 'dialogue.turns[0].speaker'));
  assert.ok(report.violations.some(item => item.field === 'dialogue.turns[1].speaker'));
  assert.ok(report.violations.some(item => item.field === 'questions[0].options[2]'));
  assert.ok(report.violations.some(item => item.field === 'explanation'));
  assert.ok(!report.violations.some(item => item.field === 'voiceId' || item.field === 'url'));
  const goal = validate('せんせい', { contentType: 'grammar_dialog', operation: 'live_write', contentIsNewOrChanged: true, communicationGoal: ' ' });
  assert.ok(goal.violations.some(item => item.code === 'communication_goal_missing'));
  assert.equal(validate('せんせい', { contentType: 'grammar_dialog', operation: 'live_write', contentIsNewOrChanged: false }).valid, true);
  assert.deepEqual(validateQuestionShape({ prompt: 'Soal', options: ['A', 'B', 'C'], correctIndex: 3 }), [{ code: 'invalid_question_schema' }]);
  const bad = validate('学校', { contentType: 'quiz_question', question: { prompt: 'Soal', options: ['A', 'A', 'C'], correctIndex: 0 } });
  assert.equal(bad.status, 'schema_invalid'); assert.equal(bad.valid, false);
  const invalidBoundary = boundary(); invalidBoundary.status = 'context_invalid';
  assert.equal(validate('学校', { boundary: invalidBoundary }).status, 'context_invalid');
  const incompleteBoundary = boundary(); delete incompleteBoundary.future;
  assert.equal(validate('学校', { boundary: incompleteBoundary }).status, 'unavailable');
});
