import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { n5VerbForms } from './n5-verb-forms.js';

const corpus = JSON.parse(readFileSync(new URL('../content/n5-support/vocabulary-examples.json', import.meta.url))).items;
const mislabeled = new Set(['毎朝', '毎晩', 'よく', 'レストラン', '生活']);
const verbs = corpus.filter(({ word, expectedCore: c }) => !mislabeled.has(word)
  && (c.category === '動詞' || /\b(?:Group I{1,3}|Godan|Ichidan|Irregular)\b/i.test(c.note || '')));

test('all 143 verb entries / 110 distinct verbs in the N5 corpus have both forms and readings', () => {
  assert.equal(verbs.length, 143);
  assert.equal(new Set(verbs.map(x => n5VerbForms(x.expectedCore, 'n5')?.dictionary)).size, 110);
  for (const item of corpus) {
    const before = JSON.stringify(item);
    const forms = n5VerbForms(item.expectedCore, 'n5');
    if (verbs.includes(item)) {
      assert.ok(forms, `Bab ${item.chapter}: ${item.word}`);
      assert.match(forms.dictionaryReading, /^[ぁ-ゖー]+$/u);
      assert.match(forms.masuReading, /^[ぁ-ゖー]+ます$/u);
      assert.ok(forms.masu.endsWith('ます'));
      assert.equal(item.word, item.word.endsWith('ます') ? forms.masu : forms.dictionary);
    } else assert.equal(forms, null, `Non-verb: ${item.word}`);
    assert.equal(JSON.stringify(item), before, 'Source content, IDs and deck membership stay intact');
  }
});

test('godan endings, ichidan exceptions and irregular readings conjugate correctly', () => {
  const cases = [
    ['買う','かう','買います','かいます'], ['書く','かく','書きます','かきます'],
    ['泳ぐ','およぐ','泳ぎます','およぎます'], ['話す','はなす','話します','はなします'],
    ['待つ','まつ','待ちます','まちます'], ['死ぬ','しぬ','死にます','しにます'],
    ['遊ぶ','あそぶ','遊びます','あそびます'], ['読む','よむ','読みます','よみます'],
    ['帰る','かえる','帰ります','かえります'], ['走る','はしる','走ります','はしります'],
    ['切る','きる','切ります','きります'], ['着る','きる','着ます','きます'],
    ['借りる','かりる','借ります','かります'], ['食べる','たべる','食べます','たべます'],
    ['来る','くる','来ます','きます'], ['する','する','します','します'],
    ['勉強する','べんきょうする','勉強します','べんきょうします'],
  ];
  for (const [dictionary, dictionaryReading, masu, masuReading] of cases) {
    const forms = n5VerbForms({ japanese: dictionary, reading: dictionaryReading }, 'n5');
    assert.equal(forms.masu, masu); assert.equal(forms.masuReading, masuReading);
    assert.deepEqual(n5VerbForms({ japanese: masu, reading: masuReading }, 'n5'), forms);
  }
});

test('early masu headwords gain dictionary forms without reversing ambiguous kana stems', () => {
  assert.deepEqual(n5VerbForms({ japanese: '寝ます', reading: null }, 'n5'), {
    dictionary:'寝る', dictionaryReading:'ねる', masu:'寝ます', masuReading:'ねます', group:2,
  });
  assert.equal(n5VerbForms({ japanese: '開く', reading: 'ひらく' }, 'n5'), null);
  assert.equal(n5VerbForms({ japanese: 'きます', reading: 'きます' }, 'n5'), null);
  assert.equal(n5VerbForms({ japanese: 'よろしくお願いします' }, 'n5'), null);
  assert.equal(n5VerbForms({ japanese: '読む', reading: 'よむ' }, 'n4'), null);
});
