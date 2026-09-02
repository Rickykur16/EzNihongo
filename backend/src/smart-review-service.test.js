import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPracticeAttempt } from './learning-foundations.js';
import { deriveDrills, publicDrill } from './grammar-drills.js';
import { SMART_REVIEW_SOURCE, filterReviewScope, isReviewNeeded, makeReviewQuestion, pickCompoundOwners, reviewPriority, selectReviewCandidates, summarizeCandidates } from './smart-review-service.js';

const now = new Date('2026-09-01T00:00:00.000Z');
const candidate = (category, itemId, priorityState = {}) => ({ category, itemId, skill: 'k2r', state: priorityState, item: { id: itemId, character: 'あ', romaji: 'a' } });

test('review eligibility includes completed content and excludes future or revoked-course content', () => {
  const scoped = filterReviewScope([
    { lessonId: 'done', courseId: 'allowed', itemId: 'yes' },
    { lessonId: 'future', courseId: 'allowed', itemId: 'future' },
    { lessonId: 'done', courseId: 'revoked', itemId: 'revoked' },
  ], { completedLessonIds: ['done'], accessibleCourseIds: ['allowed'] });
  assert.deepEqual(scoped.map((row) => row.itemId), ['yes']);
});

test('due and previously incorrect review candidates receive a higher priority', () => {
  const dueWeak = candidate('kana', 'a', { attempts: 4, correct: 1, streak: 0, nextReviewAt: '2026-08-20T00:00:00Z' });
  const strongFuture = candidate('kana', 'b', { attempts: 5, correct: 5, streak: 5, nextReviewAt: '2026-09-08T00:00:00Z' });
  assert.ok(reviewPriority(dueWeak, now) > reviewPriority(strongFuture, now));
});

test('strong items scheduled in the future are not counted as currently due', () => {
  assert.equal(isReviewNeeded(candidate('kana', 'later', { attempts: 5, correct: 5, streak: 5, nextReviewAt: '2026-09-08T00:00:00Z' }), now), false);
  assert.equal(isReviewNeeded(candidate('kana', 'new', {}), now), true);
});

test('category counts are calculated from actual candidates', () => {
  const summary = summarizeCandidates([candidate('kana', 'a'), candidate('vocabulary', 'b'), candidate('vocabulary', 'c'), candidate('grammar', 'd')]);
  assert.deepEqual(summary, { total: 4, byCategory: { kana: 1, vocabulary: 2, kanji: 0, grammar: 1 } });
});

test('mixed sessions follow need rather than an equal category split', () => {
  const weakVocab = Array.from({ length: 12 }, (_, i) => ({ ...candidate('vocabulary', `v${i}`, { attempts: 4, correct: 0, streak: 0, nextReviewAt: '2026-08-01T00:00:00Z' }), skill: 'jp2id' }));
  const freshKana = [candidate('kana', 'k', { attempts: 5, correct: 5, streak: 5, nextReviewAt: '2026-09-10T00:00:00Z' })];
  const selected = selectReviewCandidates([...weakVocab, ...freshKana], { category: 'mixed', limit: 10 });
  assert.equal(selected.length, 10);
  assert.ok(selected.filter((row) => row.category === 'vocabulary').length > 5);
});

test('category session is scoped and gracefully returns fewer than twenty items', () => {
  const selected = selectReviewCandidates([candidate('kana', 'a'), candidate('kana', 'b'), candidate('vocabulary', 'c')], { category: 'kana', limit: 20 });
  assert.equal(selected.length, 2);
  assert.ok(selected.every((row) => row.category === 'kana'));
});

test('kana reverse question identifies the script and never mixes equivalent Hiragana and Katakana answers', () => {
  const pools = {
    kanaCharactersByKind: {
      hiragana: ['ぞ', 'ち', 'りゃ'],
      katakana: ['ゾ', 'チ', 'リャ'],
    },
    kanaRomajiByKind: {
      hiragana: ['zo', 'chi', 'rya'],
      katakana: ['zo', 'chi', 'rya'],
    },
  };
  const question = makeReviewQuestion({
    category: 'kana',
    itemId: 'katakana-zo',
    skill: 'r2k',
    item: { character: 'ゾ', romaji: 'zo', kind: 'katakana' },
  }, pools);
  assert.equal(question.script, 'Katakana');
  assert.equal(question.instruction, 'Pilih karakter Katakana yang tepat.');
  assert.ok(question.options.includes('ゾ'));
  assert.equal(question.options.includes('ぞ'), false);
});

test('kana forward question uses distractor sounds from the same script', () => {
  const question = makeReviewQuestion({
    category: 'kana',
    itemId: 'hiragana-zo',
    skill: 'k2r',
    item: { character: 'ぞ', romaji: 'zo', kind: 'hiragana' },
  }, {
    kanaCharactersByKind: { hiragana: ['ぞ', 'ち'], katakana: ['ゾ', 'チ'] },
    kanaRomajiByKind: { hiragana: ['zo', 'chi'], katakana: ['zo', 'chi'] },
  });
  assert.equal(question.script, 'Hiragana');
  assert.equal(question.instruction, 'Pilih bunyi Hiragana yang tepat.');
  assert.deepEqual(new Set(question.options), new Set(['zo', 'chi']));
});

test('kanji contextual review question retains word directional skills', () => {
  const q = makeReviewQuestion({ category: 'kanji', itemId: 'k', skill: 'word2reading:abc', item: { character: '日' }, word: { japanese: '日本', reading: 'にほん', indonesian: 'Jepang' } }, { wordReadings: ['にほん', 'にち'], wordMeanings: [], words: [], kanjiMeanings: [], kanjiCharacters: [] });
  assert.equal(q.prompt, '日本');
  assert.ok(q.options.includes('にほん'));
});

test('vocabulary reverse-direction review preserves reading labels', () => {
  const q = makeReviewQuestion({ category: 'vocabulary', itemId: 'v', skill: 'id2jp', item: { japanese: '日本', reading: 'にほん', indonesian: 'Jepang' } }, { vocabJapanese: ['日本', '学校'], vocabReadingByJapanese: { 日本: 'にほん', 学校: 'がっこう' }, vocabIndonesian: [] });
  assert.equal(q.optionReadings[q.options.indexOf('日本')], 'にほん');
});

test('Smart Review scheduling returns incorrect answers sooner and expands successful spacing', () => {
  const incorrect = applyPracticeAttempt({ attempts: 3, correct: 2, streak: 2 }, { isCorrect: false, now });
  const first = applyPracticeAttempt(null, { isCorrect: true, now });
  const second = applyPracticeAttempt(first, { isCorrect: true, now });
  assert.equal(incorrect.nextReviewAt, now.toISOString());
  assert.ok(new Date(second.nextReviewAt) > new Date(first.nextReviewAt));
});

test('shared practice attempts use the canonical Smart Review source', () => {
  assert.equal(SMART_REVIEW_SOURCE, 'smart_review');
});

test('grammar review uses the existing derived drill and keeps answer data out of public payload', () => {
  const grammar = { id: 'g1', pattern: '〜です', meaning: 'adalah', examples: [{ japanese: '私は 学生です。', highlight: 'です', indonesian: 'Saya siswa.' }], recognitionDistractors: ['bukan', 'masa lalu'], controlledDistractors: [] };
  const raw = deriveDrills([grammar], [grammar]).get('g1').step1;
  assert.ok(raw);
  assert.equal(Object.hasOwn(publicDrill(raw), 'correctIndex'), false);
});

// 学生 contains both 学 and 生, so deriveCompounds() yields it twice — once per
// kanji. Both copies share a skill and differ only in itemId, so before this
// each word was two review items: the identical question showed up twice in a
// session, and answering one left the other due. Reported as "tidak salah tapi
// muncul berkali kali".
test('a compound word claims exactly one kanji owner', () => {
  const owners = pickCompoundOwners([
    { key: '学生::がくせい', baseId: 'k-gaku', hasState: false },
    { key: '学生::がくせい', baseId: 'k-sei', hasState: false },
    { key: '先生::せんせい', baseId: 'k-sen', hasState: false },
    { key: '先生::せんせい', baseId: 'k-sei', hasState: false },
  ]);
  assert.equal(owners.size, 2);
  assert.deepEqual([...owners.keys()].sort(), ['先生::せんせい', '学生::がくせい']);
});

test('the kanji already holding practice state keeps the word, so progress is not orphaned', () => {
  // k-sei arrives second and sorts later, but it is where the learner's
  // answers live; re-parenting the word would reset it to attempts = 0 and
  // bring the question straight back.
  const owners = pickCompoundOwners([
    { key: '学生::がくせい', baseId: 'k-gaku', hasState: false },
    { key: '学生::がくせい', baseId: 'k-sei', hasState: true },
  ]);
  assert.equal(owners.get('学生::がくせい').baseId, 'k-sei');
});

test('ownership is stable when no copy has state, regardless of arrival order', () => {
  const forward = pickCompoundOwners([
    { key: 'w', baseId: 'k-b', hasState: false },
    { key: 'w', baseId: 'k-a', hasState: false },
  ]).get('w').baseId;
  const reversed = pickCompoundOwners([
    { key: 'w', baseId: 'k-a', hasState: false },
    { key: 'w', baseId: 'k-b', hasState: false },
  ]).get('w').baseId;
  assert.equal(forward, reversed);
});
