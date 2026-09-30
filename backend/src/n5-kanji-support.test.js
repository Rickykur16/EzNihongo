import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCompounds } from './kanji-compounds.js';

const chapterKanji = [[4,'魚本花'],[5,'八三十九一五四二六七'],[6,'安高古新白長'],[7,'男女気'],
  [8,'下前外間右中左後上'],[9,'車東道駅行西電北南'],[10,'見読書'],[11,'年百午半週万千毎'],
  [12,'食飲'],[13,''],[14,'立休入出'],[15,'言話聞買店円会社'],[16,'日月火水木金土時分'],
  [17,'子父母友手足口目耳'],[18,'大小多少'],[19,'雨天空山川'],[20,'来令']];
const uses = (character, chapter, vocabulary = []) => deriveCompounds(character, [], vocabulary, {
  courseLevel: 'N5', moduleSort: chapter,
});

test('every existing Bab4–20 kanji has a short curated support set with full kana sentence readings', () => {
  for (const [chapter, characters] of chapterKanji) for (const character of characters) {
    const support = uses(character, chapter);
    assert.ok(support.length > 0 && support.length <= 3, `Bab ${chapter}: ${character}`);
    for (const word of support) {
      assert.ok(word.japanese.includes(character));
      assert.ok(word.indonesian && word.exampleJapanese && word.exampleIndonesian);
      assert.doesNotMatch(word.reading, /[A-Za-z\p{Unified_Ideograph}]/u);
      assert.doesNotMatch(word.exampleReading, /\p{Unified_Ideograph}/u);
      assert.ok(word.exampleJapanese.includes(character), `${word.japanese}: target kanji in example`);
    }
  }
});

test('time readings and beginner vocabulary do not inherit unrelated whole-course automatic matches', () => {
  const future = [
    { japanese: '行う', reading: 'おこなう', indonesian: 'melaksanakan', course_level: 'N5', module_sort: 12 },
    { japanese: 'か行', reading: 'かぎょう', indonesian: 'baris ka', course_level: 'N5', module_sort: 1 },
    { japanese: '十分', reading: 'じゅうぶん', indonesian: 'cukup', course_level: 'N5', module_sort: 20 },
  ];
  assert.deepEqual(uses('行', 9, future).map(w => w.japanese), ['行きます']);
  const minutes = uses('分', 16, future).find(w => w.japanese === '十分');
  assert.equal(minutes.reading, 'じゅっぷん');
  assert.equal(minutes.indonesian, 'sepuluh menit');
  assert.equal(uses('四', 5)[0].reading, 'よじ');
  assert.equal(uses('七', 5)[0].reading, 'しちじ');
  assert.equal(uses('九', 5)[0].reading, 'くじ');
  assert.ok(uses('本', 4).some(w => w.japanese === '日本語'), 'earlier vocabulary remains usable');
});

test('curated support is scoped to existing N5 chapter assignments', () => {
  assert.deepEqual(deriveCompounds('魚', [], [], { courseLevel: 'N4', moduleSort: 4 }), []);
  assert.deepEqual(uses('魚', 20), []);
  assert.deepEqual(uses('魚', 13), []);
  assert.equal(uses('先', 3)[0].japanese, '先生');
});
