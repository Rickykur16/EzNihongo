// Audited dictionary forms from the N5 vocabulary lessons (including early
// lessons whose source headword is already in ます form). Do not infer groups
// from spelling or category: the source contains mislabeled nouns/adverbs,
// and 切る/着る and 帰る/借りる need different conjugations.
const entries = [
  ['着く', 'つく', 1], ['渡る', 'わたる', 1], ['行く', 'いく', 1],
  ['降りる', 'おりる', 2], ['帰る', 'かえる', 1], ['乗る', 'のる', 1],
  ['歩く', 'あるく', 1], ['入る', 'はいる', 1], ['出かける', 'でかける', 2],
  ['曲がる', 'まがる', 1], ['走る', 'はしる', 1], ['出る', 'でる', 2],
  ['来る', 'くる', 3], ['起きる', 'おきる', 2], ['働く', 'はたらく', 1],
  ['やる', 'やる', 1], ['作る', 'つくる', 1], ['運動する', 'うんどうする', 3],
  ['履く', 'はく', 1], ['洗濯する', 'せんたくする', 3], ['聞く', 'きく', 1],
  ['飲む', 'のむ', 1], ['使う', 'つかう', 1], ['買い物する', 'かいものする', 3],
  ['料理する', 'りょうりする', 3], ['始める', 'はじめる', 2], ['休む', 'やすむ', 1],
  ['洗う', 'あらう', 1], ['着る', 'きる', 2], ['持つ', 'もつ', 1],
  ['終わる', 'おわる', 1], ['話す', 'はなす', 1], ['する', 'する', 3],
  ['見る', 'みる', 2], ['返す', 'かえす', 1], ['書く', 'かく', 1],
  ['遊ぶ', 'あそぶ', 1], ['脱ぐ', 'ぬぐ', 1], ['食べる', 'たべる', 2],
  ['磨く', 'みがく', 1], ['言う', 'いう', 1], ['読む', 'よむ', 1],
  ['起こす', 'おこす', 1], ['掃除する', 'そうじする', 3], ['寝る', 'ねる', 2],
  ['浴びる', 'あびる', 2], ['買う', 'かう', 1], ['勉強する', 'べんきょうする', 3],
  ['数える', 'かぞえる', 2], ['注文する', 'ちゅうもんする', 3], ['歌う', 'うたう', 1],
  ['始まる', 'はじまる', 1], ['死ぬ', 'しぬ', 1], ['飛ぶ', 'とぶ', 1],
  ['切る', 'きる', 1], ['結婚する', 'けっこんする', 3], ['引く', 'ひく', 1],
  ['落とす', 'おとす', 1], ['泳ぐ', 'およぐ', 1], ['止める', 'とめる', 2],
  ['閉める', 'しめる', 2], ['立つ', 'たつ', 1], ['卒業する', 'そつぎょうする', 3],
  ['笑う', 'わらう', 1], ['撮る', 'とる', 1], ['質問する', 'しつもんする', 3],
  ['入れる', 'いれる', 2], ['やめる', 'やめる', 2], ['止まる', 'とまる', 1],
  ['押す', 'おす', 1], ['渡す', 'わたす', 1], ['待つ', 'まつ', 1],
  ['つける', 'つける', 2], ['出来る', 'できる', 2], ['答える', 'こたえる', 2],
  ['勝つ', 'かつ', 1], ['貸す', 'かす', 1], ['開ける', 'あける', 2],
  ['消す', 'けす', 1], ['借りる', 'かりる', 2], ['覚える', 'おぼえる', 2],
  ['出す', 'だす', 1], ['動く', 'うごく', 1], ['教える', 'おしえる', 2],
  ['取る', 'とる', 1], ['案内する', 'あんないする', 3], ['知る', 'しる', 1],
  ['なる', 'なる', 1], ['呼ぶ', 'よぶ', 1], ['行う', 'おこなう', 1],
  ['泣く', 'なく', 1], ['探す', 'さがす', 1], ['忘れる', 'わすれる', 2],
  ['急ぐ', 'いそぐ', 1], ['座る', 'すわる', 1], ['開く', 'あく', 1],
  ['住む', 'すむ', 1], ['閉まる', 'しまる', 1], ['疲れる', 'つかれる', 2],
  ['触る', 'さわる', 1], ['吸う', 'すう', 1], ['払う', 'はらう', 1],
  ['予約する', 'よやくする', 3], ['描く', 'かく', 1], ['弾く', 'ひく', 1],
  ['違う', 'ちがう', 1], ['比べる', 'くらべる', 2], ['練習する', 'れんしゅうする', 3],
  ['習う', 'ならう', 1], ['旅行する', 'りょこうする', 3],
];
const iRow = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
function conjugate(text, group) {
  if (group === 1) return text.slice(0, -1) + iRow[text.slice(-1)] + 'ます';
  if (group === 2) return text.slice(0, -1) + 'ます';
  return text === '来る' ? '来ます' : text === 'くる' ? 'きます' : text.slice(0, -2) + 'します';
}
const byHeadword = new Map();
for (const [dictionary, dictionaryReading, group] of entries) {
  const forms = Object.freeze({ dictionary, dictionaryReading, masu: conjugate(dictionary, group), masuReading: conjugate(dictionaryReading, group), group });
  byHeadword.set(dictionary, forms);
  byHeadword.set(forms.masu, forms);
}

export function n5VerbForms(item, courseSlug) {
  if (courseSlug !== 'n5') return null;
  const word = String(item.japanese || '').trim();
  const forms = byHeadword.get(word);
  if (!forms) return null;
  // A changed reading may indicate another verb (e.g. 開く: あく vs ひらく).
  // Missing legacy readings can safely use the audited catalog reading.
  const expectedReading = word === forms.dictionary ? forms.dictionaryReading : forms.masuReading;
  if (item.reading && String(item.reading).trim() !== expectedReading) return null;
  return { ...forms };
}
