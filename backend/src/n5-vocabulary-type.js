import { n5VerbForms } from './n5-verb-forms.js';

// Student-facing types, not the thematic [subcat: ...] tags used by the CMS.
// Resolve known legacy mistakes for display without rewriting source rows.
const overrides = new Map();
function assign(key, words) { for (const word of words.split('|')) overrides.set(word, key); }
assign('noun', 'レストラン|生活|ビール|お茶|お酒|コーヒー|ジュース|リンゴ|数|番号|アイスクリーム|家族|ベトナム|大学|インド|会社員|留学生|仕事|会社|中国|先生|タイ|高校|韓国人|看護師|姉|名前|銀行員|国|父|大学生|母|中国人|苗字|日本|お名前|兄|韓国|弟|学生|エンジニア|日本人|出身|医者');
assign('pronoun', 'これ|それ|あれ|この|その|あの|ここ|そこ|あそこ|私|僕|貴方');
assign('question', 'どう|どんな〜|どの|どれ|何|いくら|お幾つ|何時|何分|何回|何時間|どこ|どちら|何で|どうやって');
assign('adverb', 'あまり|いつも|たまに|もう|毎朝|毎晩|よく|少し|たくさん|まだ');
assign('i-adjective', '高い');
assign('particle', '〜の|〜から|〜まで|〜ぐらい');
assign('number', '〜時 (jam 4、よじ）|〜分|〜歳|〜年|〜月');
assign('affix', '〜さん|〜ちゃん|〜君');
assign('expression', 'ください|どうぞ|よろしくお願いします|ありがとうございます|すみません|こちらこそ|はじめまして');

const categoryTypes = new Map([
  ['動詞','verb'], ['verb','verb'], ['kata kerja','verb'],
  ['い形容詞','i-adjective'], ['i-adjective','i-adjective'],
  ['な形容詞','na-adjective'], ['na-adjective','na-adjective'],
  ['名詞','noun'], ['noun','noun'], ['kata benda','noun'],
  ['代名詞','pronoun'], ['pronoun','pronoun'],
  ['副詞','adverb'], ['adverb','adverb'],
  ['助数詞','number'], ['数詞','number'], ['counter','number'],
  ['助詞','particle'], ['particle','particle'],
  ['接続詞','conjunction'], ['conjunction','conjunction'],
  ['接尾辞','affix'], ['prefix','affix'], ['suffix','affix'],
  ['表現','expression'], ['挨拶','expression'], ['expression','expression'], ['greeting','expression'],
]);

export function n5VocabularyType(item, courseSlug) {
  if (courseSlug !== 'n5') return null;
  if (n5VerbForms(item, courseSlug)) return 'verb';
  const word = String(item.japanese || '').trim();
  const category = String(item.category || '').trim().toLowerCase();
  const subcat = String(item.note || '').match(/\[subcat:([^\]]*)\]/i)?.[1] || '';
  // 〜人 is the nationality suffix in Bab 3, but a counter in Bab 11.
  if (word === '〜人') return category === '助数詞' || /にん/.test(item.reading || '') ? 'number' : 'affix';
  if (overrides.has(word)) return overrides.get(word);
  if (/\bquestion(?:-place)?\b/.test(subcat)) return 'question';
  if (/\bdemonstrative(?:-place)?\b/.test(subcat)) return 'pronoun';
  if (/\bnumber\b/.test(subcat)) return 'number';
  if (/\bfrequency\b/.test(subcat)) return 'adverb';
  return categoryTypes.get(category) || 'other';
}
