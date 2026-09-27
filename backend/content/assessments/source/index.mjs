import early from './b04-07.mjs';
import middle from './b08-11.mjs';
import verbs from './b12-14.mjs';
import social from './b15-17.mjs';
import late from './b18-20.mjs';
export const banks = [...early,...middle,...verbs,...social,...late];

// Every response item supplies its decisive facts in audio, never in the
// printed prompt. The four listening items have independent stimuli.
const responses = {
  4: ['A: これは にほんごの ほんです。\nB: えいごの ほんですか。',
    'いいえ、にほんごの ほんです。', 'はい、えいごの ほんです。', 'いいえ、かばんです。', 'はい、じしょです。'],
  5: ['A: わたしは じゅうはっさいです。\nB: じゅうきゅうさいですか。',
    'いいえ、じゅうはっさいです。','はい、じゅうきゅうさいです。','いいえ、じゅうろくさいです。','いいえ、はっさいです。'],
  6: ['A: この りょうりは とても おいしいです。\nB: この りょうりは どうですか。',
    'とても おいしいです。','あまり おいしくないです。','とても たかいです。','あたらしいです。'],
  7: ['A: きのうは げんきでした。\nB: きのうは どうでしたか。',
    'げんきでした。','げんきじゃありませんでした。','げんきじゃありません。','にぎやかな まちです。'],
  8: ['A: がっこうは ぎんこうの となりです。\nB: がっこうは どこですか。',
    'ぎんこうの となりです。','ぎんこうの なかです。','ぎんこうの うしろです。','みせの なかです。'],
  10: ['A: コーヒーは ぜんぜん のみません。\nB: まいにち コーヒーを のみますか。',
    'いいえ、ぜんぜん のみません。','はい、まいにち のみます。','はい、よく のみます。','きのう のみました。'],
  11: ['A: りんごは やっつ あります。\nB: りんごは いくつ ありますか。',
    'やっつ あります。','むっつ あります。','ななつ あります。','ここのつ あります。'],
  13: ['A: ここで しゃしんを とってはいけません。\nB: ここで しゃしんを とってもいいですか。',
    'いいえ、とってはいけません。','はい、とってもいいです。','はい、どうぞ。','はい、とってください。'],
  14: ['A: きのうは テレビを みました。ほんは よみませんでした。\nB: きのう、ほんを よみましたか。',
    'よまなかった。','よんだ。','よまない。','よむ。'],
  15: ['A: コーヒーは いかがですか。\nB: コーヒーは のみません。おちゃを おねがいします。',
    'おちゃですね。','コーヒーですね。','みずですね。','パンですね。'],
  16: ['A: わたしの たんじょうびは さんがつ みっかです。\nB: たんじょうびは なんがつ なんにちですか。',
    'さんがつ みっかです。','さんがつ よっかです。','しがつ みっかです。','しがつ よっかです。'],
  17: ['A: テニスが できます。ピアノは できません。\nB: どんな スポーツが できますか。',
    'テニスが できます。','ピアノが できます。','テニスが できません。','ピアノが すきです。'],
  18: ['A: Aは ごひゃくえんです。Bは はっぴゃくえんです。\nB: Aと Bと、どちらが やすいですか。',
    'Aの ほうが やすいです。','Bの ほうが やすいです。','おなじ ねだんです。','Bが いちばん かるいです。'],
  19: ['A: きょうは いそがしいです。あしたは ひまです。\nB: きょう、いっしょに おちゃを のみませんか。',
    'すみません、きょうは ちょっと。','いいですね。いま のみましょう。','はい、きょうは ひまです。','はい、すぐ いきましょう。'],
  20: ['A: きょねん、にほんへ いきました。\nB: にほんへ いったことが ありますか。',
    'はい、あります。','いいえ、ありません。','あした いく つもりです。','にほんへ いきたいです。']
};
const reasons = {
4:'Benda sudah dinyatakan buku bahasa Jepang; dugaan buku bahasa Inggris perlu dikoreksi.',
5:'Pembicara pertama menyatakan umur 18; dugaan 19 perlu dikoreksi.',
6:'Penilaian yang terdengar adalah sangat enak.',7:'Pembicara pertama menyatakan sehat kemarin; jawaban mengulang keadaan lampau itu.',
8:'Lokasi yang terdengar adalah sebelah bank.',10:'Kebiasaan yang terdengar adalah sama sekali tidak minum kopi.',
11:'Jumlah yang disebut adalah やっつ, delapan buah.',13:'Aturan di audio melarang foto, sehingga izin tidak diberikan.',
14:'Pembicara tidak membaca kemarin; bentuk biasa negatif lampau adalah よまなかった.',
15:'Pelanggan menolak kopi lalu meminta teh; pelayan mengonfirmasi teh.',16:'Tanggal yang terdengar adalah 3 Maret.',
17:'Kemampuan yang disebut adalah tenis; piano tidak bisa.',18:'A berharga 500 yen dan B 800 yen; A lebih murah.',
19:'Pembicara pertama sibuk hari ini, sehingga penolakan untuk ajakan hari ini sesuai dengan jadwalnya.',
20:'Pergi ke Jepang tahun lalu berarti pernah ke Jepang; jawaban pengalaman yang sesuai adalah はい、あります.'
};
for (const bank of banks) {
  const q=bank.forms.A.find(q=>q.listeningFocus==='response');
  if (responses[bank.chapter]) {
    const [audioScript,...options]=responses[bank.chapter];
    q.audioScript=audioScript;
    q.prompt=bank.chapter===15 ? 'Pilih ucapan pelayan untuk mengonfirmasi pesanan terakhir dalam audio.' :
      bank.chapter===14 ? 'Berdasarkan audio, pilih jawaban pembicara pertama dalam bentuk biasa.' :
      'Berdasarkan informasi audio, pilih jawaban pembicara pertama terhadap pertanyaan atau ajakan terakhir.';
    const offset=bank.chapter%4;
    q.options=[...options.slice(offset),...options.slice(0,offset)];
    q.answer=(4-offset)%4;
    q.explanation=reasons[bank.chapter];
    q.distractorReasons=q.options.map((o,i)=>i===q.answer?q.explanation:`“${o}” tidak sesuai informasi audio. ${q.explanation}`);
  }
  // Avoid coincidental single-character stem matches; retain the same skill.
  if (bank.chapter===9) bank.forms.A.find(q=>q.id==='b09-a-g10').prompt='Anda pergi naik kereta. Pilih partikel untuk menandai sarana transportasi dalam kalimat tersebut.';
  if (bank.chapter===18) {
    const q=bank.forms.A.find(q=>q.id==='b18-a-g14');
    q.options=q.options.map(o=>/^[ABC]$/.test(o)?`Buku ${o}`:o);
  }
}
