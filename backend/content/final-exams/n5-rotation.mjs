// New original items for the second final-exam package. First option is the key.
export function vocabulary(h) {
 const {q}=h;
 [
 ['kanji_reading','この 山には【白い】花が たくさん あります。','しろい|あかい|あおい|くろい','白い dibaca しろい, putih.',6],
 ['orthography','【らいねん】、日本へ 行きます。','来年|今年|毎年|去年','らいねん ditulis 来年, tahun depan.',16],
 ['context_vocabulary','この くつは 小さすぎます。もう すこし（　）のは ありますか。','大きい|短い|うすい|わかい','Sepatu terlalu kecil sehingga pembeli meminta yang lebih besar.',6],
 ['paraphrase','「店は えきの すぐ そばです。」と おなじ いみの ぶんは どれですか。','店は えきに とても ちかいです。|店は えきから とおいです。|店は えきの 中だけに あります。|店は えきより 大きいです。','すぐそば berarti sangat dekat, tidak mesti di dalam stasiun.',8],
 ].forEach(([type,p,o,e,c])=>q(type,p,o,e,[c]));
}
export function textA({text}) {
 const p='日よう日に 友だちと 海へ 行きました。いえから 海まで 電車で 一時間（①）。朝は 雨でした。（②）、海に ついた ときは、いい 天気でした。海で 写真を（③）あとで、昼ごはんを 食べました。とても 楽しかったです。また 友だちと（④）たいです。';
 text(p,'①','かかりました|かけました|いました|ありました','Perjalanan membutuhkan satu jam: 一時間かかりました.',[9,11]);
 text(p,'②','でも|それで|だから|そしても','でも menghubungkan hujan pagi dengan cuaca bagus saat tiba.',[19]);
 text(p,'③','とった|とる|とって|とります','Kegiatan sebelum あとで memakai Vた: 写真をとったあとで.',[20]);
 text(p,'④','行き|行く|行って|行った','たい melekat pada pangkal ます: 行きたい.',[15]);
}
export function textB({text}) {
 const p='わたしの いえの 近くに 小さい パン屋が あります。朝 七時（①）開いて います。わたしは 毎朝 そこで パンを 二つ（②）。店の 人は いつも 親切です。きのうは パンと 牛乳を 買いました。でも、お金が 少し（③）。店の 人は「残りは あしたで いいですよ」と 言いました。きょうは お金を 持って、お礼を（④）行きます。';
 text(p,'①','から|まで|を|と','から menandai awal jam buka, pukul tujuh.',[5]);
 text(p,'②','買います|買いましたか|買って ください|買いましょうか','毎朝 menunjukkan kebiasaan pembicara membeli dua roti.',[10]);
 text(p,'③','足りませんでした|足りませんか|足りました|足りて ください','Pembayaran sisanya ditunda karena uang kemarin tidak cukup.',[10]);
 text(p,'④','言いに|言ってに|言うに|言ったに','Tujuan pergi menggunakan pangkal ます + に行く: 言いに行きます.',[15]);
}
export function readingB({reading}) {
 reading('short_reading','リンさんへ\nきょうは 先に 帰ります。借りた 本は あなたの つくえの 上に 置きました。ノートは まだ 使って いますから、あした 返します。\nアリ','リンさんは きょう 何を 返して もらいますか。','本|ノート|本と ノート|何も 返して もらいません','Buku sudah diletakkan di meja; buku catatan baru dikembalikan besok.',[8,10]);
 reading('short_reading','【パン屋から】\nあしたは 店の そうじを しますから、午前中は 休みます。午後 二時から 六時まで 開けます。パンは 午後 二時から 買う ことが できます。','あした 何時に この 店で パンを 買う ことが できますか。','午後 三時|午前 九時|午後 一時|午後 七時','Toko buka pukul 14–18; hanya pukul 15 yang berada dalam jam buka.',[5,17]);
 const p='土よう日に 兄と 動物園へ 行きました。いえを 九時に 出ました。バスで 行きたかったですが、バスが なかなか 来ませんでしたから、電車で 行きました。動物園には 十時に つきました。わたしは ぞうが 一番 好きです。兄は 鳥が 好きです。ぞうを 見てから、鳥を 見ました。昼は 動物園の 中で おにぎりを 食べました。兄が 朝 作って くれました。午後は 少し 雨が ふりましたから、早く 帰りました。';
 reading('medium_reading',p,'二人は どうして 電車で 行きましたか。','バスが なかなか 来なかったから|電車の ほうが 安かったから|雨が ふって いたから|兄が 電車を 好きだから','Alasan menggunakan kereta ialah bus yang tidak kunjung datang, bukan hujan sore.',[9,19]);
 reading('medium_reading',p,'おにぎりは だれが 作りましたか。','兄|わたし|動物園の 人|母','Kalimat 兄が朝作ってくれました menyebut kakak sebagai pembuat bekal.',[10,19]);
 reading('information_retrieval','【みどり図書館】\n火〜金：午前十時〜午後七時\n土・日：午前九時〜午後五時\n月よう日：休み\n本：一人 五さつまで、二週間\nCD：一人 二まいまで、一週間','日よう日の 午前九時半に、本を 三さつ 借りたいです。どれが 正しいですか。','借りて、二週間 使えます。|借りて、一週間だけ 使えます。|まだ 開いて いません。|本は 二さつまでです。','Minggu buka pukul sembilan; tiga buku di bawah batas lima, masa pinjam dua minggu.',[5,11,16]);
}
export function listeningB({listening}) {
 [
 ['A: 机の 上の コップを 台所へ 持って 行きますか。\nB: はい。中に 水が 入って いますから、気を つけて ください。','Aさんは 何を しますか。','コップを 台所へ 持って 行きます。|水を 飲みます。|机を 台所へ 持って 行きます。|コップを 机に 置きます。','B menyetujui tindakan A membawa gelas ke dapur.',[8,13]],
 ['A: この 手紙、きょう 出しますか。\nB: はい。切手は もう はって ありますから、ポストに 入れて ください。','Aさんは この あと 何を しますか。','手紙を ポストに 入れます。|切手を 買います。|手紙を 書きます。|切手を はります。','Perangko sudah ditempel, jadi langkah selanjutnya memasukkan surat ke kotak pos.',[12,13]],
 ['A: りんごを 買いますね。いくつですか。\nB: 五つ お願いします。あ、家に 二つ ありました。じゃあ、三つで いいです。','Aさんは りんごを いくつ 買いますか。','三つ|二つ|五つ|七つ','Permintaan terakhir adalah tiga apel, karena dua sudah tersedia.',[11]],
 ['A: この 写真は ここに はりますか。\nB: いいえ、ドアの となりに お願いします。そこには カレンダーを はります。','Aさんは 写真を どこに はりますか。','ドアの となり|ドアの 外|カレンダーの 下|机の 上','Foto ditempel di samping pintu; lokasi semula untuk kalender.',[8,13]],
 ['A: きょうは 何を しましょうか。\nB: 天気が いいですから、外で 遊びましょう。\nA: じゃあ、近くの 公園へ 行きましょう。','二人は これから どこへ 行きますか。','公園|映画館|図書館|スーパー','Kedua pembicara sepakat pergi ke taman dekat rumah.',[9,15]],
 ['A: 先生、ノートを 集めますか。\nB: はい。でも まず、ここを 読んで ください。それから ノートを 集めます。','Aさんは まず 何を しますか。','先生が 言った ところを 読みます。|ノートを 集めます。|名前を 書きます。|本を 閉じます。','まず menunjukkan membaca bagian yang ditunjuk sebelum mengumpulkan catatan.',[10,13]],
 ['A: お父さん、おさらを 洗いましょうか。\nB: ありがとう。おさらは わたしが 洗いますから、はしを 並べて ください。','Aさんは 何を しますか。','はしを 並べます。|おさらを 洗います。|ごはんを 作ります。|おさらを 買います。','Ayah mencuci piring sendiri dan meminta A menata sumpit.',[13,15]],
 ].forEach(([s,p,o,e,c])=>listening('task_comprehension',s,p,o,e,c));
 [
 ['A: 休みは 何よう日ですか。\nB: 火よう日と 木よう日です。でも 今週は 木よう日も 働きます。','今週、Bさんの 休みは いつですか。','火よう日だけ|木よう日だけ|火よう日と 木よう日|水よう日だけ','Minggu ini Kamis tetap bekerja, sehingga hanya Selasa libur.',[16]],
 ['A: あの 青い かばんは だれのですか。\nB: 姉のです。わたしのは あかいです。黒いのは 兄のです。','Bさんの かばんは 何色ですか。','あか|青|黒|白','B mengatakan tasnya merah; biru milik kakak perempuan.',[4,6]],
 ['A: 学校まで どのぐらいですか。\nB: 歩くと 四十分です。わたしは 毎日 自転車で 十五分です。','Bさんは 毎日 学校まで 何分 かかりますか。','十五分|四十分|五十分|五分','Perjalanan rutin dengan sepeda membutuhkan lima belas menit.',[9,11]],
 ['A: お母さんの 誕生日に 何を あげましたか。\nB: 花を あげました。去年は ケーキを 作りましたが、今年は 時間が ありませんでした。','今年、Bさんは 何を あげましたか。','花|ケーキ|時計|本','Hadiah tahun ini bunga; kue dibuat tahun lalu.',[10,16]],
 ['A: この アイスは いくらですか。\nB: 一つ 百五十円です。でも 二つなら 二百円です。\nA: では 二つ ください。','Aさんは いくら はらいますか。','二百円|百五十円|三百円|四百円','Harga khusus untuk dua es krim ialah dua ratus yen.',[5,11]],
 ['A: 新しい 先生は どんな 人ですか。\nB: 若い 女の 先生です。いつも ゆっくり 話しますから、よく 分かります。','新しい 先生は どう 話しますか。','ゆっくり 話します。|とても はやく 話します。|小さい 声で 話します。|英語だけで 話します。','B menyebut guru selalu berbicara perlahan.',[6,10]],
 ].forEach(([s,p,o,e,c])=>listening('key_points',s,p,o,e,c));
 [
 ['N: Aさんは 友だちに 水を あげます。何と 言いますか。','水を どうぞ。|水を ください。|水は いくらですか。','Saat memberikan air, gunakan 水をどうぞ.',[3],'water'],
 ['N: Aさんは 友だちの 家から 帰ります。友だちの お母さんに 何と 言いますか。','おじゃましました。|おじゃまします。|いただきます。','Saat meninggalkan rumah setelah berkunjung, gunakan おじゃましました.',[3],'visit'],
 ['N: Aさんは 重い 箱を 持って います。友だちに 手伝って ほしいです。何と 言いますか。','手伝って ください。|手伝いましょうか。|手伝いましたか。','A meminta bantuan untuk dirinya: 手伝ってください.',[13],'box'],
 ['N: Aさんは 店で シャツを 見ています。今の シャツは 小さいです。大きい シャツが ほしいです。何と 言いますか。','もう すこし 大きいのは ありますか。|もう すこし 小さいのは ありますか。|これは 何時ですか。','A meminta ukuran yang lebih besar dengan 大きいのはありますか.',[6],'price'],
 ['N: Aさんは 電話で 友だちの 声が よく 聞こえません。もう 一度 聞きたいです。何と 言いますか。','すみません、もう 一度 言って ください。|すみません、よく 聞こえました。|すみません、電話を 買って ください。','Permintaan mengulang ucapan memakai もう一度言ってください.',[13],'phone'],
 ].forEach(([s,o,e,c,scene])=>listening('verbal_expression',s,'何と 言いますか。',o,e,c,scene));
 [
 ['A: あしたは 何時に 会いますか。','十時は どうですか。|駅の 前です。|友だちと 会います。','何時 meminta waktu; 十時 mengusulkan pukul sepuluh.',[5]],
 ['A: お茶は いかがですか。','はい、お願いします。|はい、お茶が 行きます。|はい、お茶でしたか。','いかがですか menawarkan teh; お願いします menerima tawaran.',[3]],
 ['A: この ペンを 使っても いいですか。','ええ、どうぞ。|ええ、ペンを 使いましたか。|ええ、ペンが います。','Pertanyaan izin dijawab dengan どうぞ untuk mempersilakan.',[13]],
 ['A: きのうの 映画は どうでしたか。','とても おもしろかったです。|あした 見ますか。|映画館へ 行きましょう。','どうでしたか menanyakan kesan tentang film yang sudah ditonton.',[7,10]],
 ['A: おなかが すきましたね。','何か 食べましょう。|何も 食べました。|もう おなかです。','Pernyataan lapar ditanggapi ajakan makan.',[15]],
 ['A: お誕生日 おめでとうございます。','ありがとうございます。|おやすみなさい。|いってらっしゃい。','Ucapan selamat ulang tahun ditanggapi dengan terima kasih.',[3]],
 ].forEach(([s,o,e,c])=>listening('quick_response',s,'いちばん いい へんじを えらんで ください。',o,e,c));
}
