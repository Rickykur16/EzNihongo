// Supporting usages for the nine fixed Bab 3 kanji. These are teaching
// examples, not additions to the vocabulary deck or changes to kanji readings.
// A whole question keeps 何's contextual reading unambiguous in word practice.
const words = [
  ['先生', 'せんせい', 'guru', 'ははは 先生です。', 'ははは せんせいです。', 'Ibu saya guru.'],
  ['学生', 'がくせい', 'pelajar', 'わたしは 学生です。', 'わたしは がくせいです。', 'Saya pelajar.'],
  ['大学生', 'だいがくせい', 'mahasiswa', 'あには 大学生です。', 'あには だいがくせいです。', 'Kakak laki-laki saya mahasiswa.'],
  ['大学', 'だいがく', 'universitas', 'わたしは さくら大学の がくせいです。', 'わたしは さくらだいがくの がくせいです。', 'Saya mahasiswa Universitas Sakura.'],
  ['高校', 'こうこう', 'SMA', 'おとうとは さくら高校の がくせいです。', 'おとうとは さくらこうこうの がくせいです。', 'Adik laki-laki saya pelajar SMA Sakura.'],
  ['学校', 'がっこう', 'sekolah', 'たなかさんは 学校の せんせいです。', 'たなかさんは がっこうの せんせいです。', 'Tanaka guru sekolah.'],
  ['国', 'くに', 'negara', 'わたしの 国は タイです。', 'わたしの くには タイです。', 'Negara saya Thailand.'],
  ['中国', 'ちゅうごく', 'Tiongkok', 'しゅっしんは 中国です。', 'しゅっしんは ちゅうごくです。', 'Saya berasal dari Tiongkok.'],
  ['名前', 'なまえ', 'nama', 'わたしの 名前は リナです。', 'わたしの なまえは リナです。', 'Nama saya Rina.'],
  ['お名前', 'おなまえ', 'nama (sopan)', 'お名前は なんですか。', 'おなまえは なんですか。', 'Siapa nama Anda?'],
  ['日本人', 'にほんじん', 'orang Jepang', 'たなかさんは 日本人です。', 'たなかさんは にほんじんです。', 'Tanaka orang Jepang.'],
  ['中国人', 'ちゅうごくじん', 'orang Tiongkok', 'リンさんは 中国人です。', 'りんさんは ちゅうごくじんです。', 'Lin orang Tiongkok.'],
  ['日本語', 'にほんご', 'bahasa Jepang', 'たなかさんは 日本語の せんせいです。', 'たなかさんは にほんごの せんせいです。', 'Tanaka guru bahasa Jepang.'],
  ['何ですか', 'なんですか', 'apa? (pertanyaan sopan)', 'おしごとは 何ですか。', 'おしごとは なんですか。', 'Apa pekerjaan Anda? 何 dibaca なん sebelum ですか.'],
];

const selections = {
  先: ['先生'], 生: ['学生', '先生', '大学生'], 学: ['学生', '大学', '大学生'],
  校: ['高校', '学校'], 国: ['国', '中国'], 名: ['名前', 'お名前'],
  人: ['日本人', '中国人'], 語: ['日本語'], 何: ['何ですか'],
};
const byWord = new Map(words.map(([japanese, reading, indonesian,
  exampleJapanese, exampleReading, exampleIndonesian]) => [japanese,
  { japanese, reading, indonesian, exampleJapanese, exampleReading, exampleIndonesian }]));

export function bab3KanjiSupport(character) {
  return (selections[character] || []).map(word => ({ ...byWord.get(word) }));
}
