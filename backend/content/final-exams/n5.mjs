// Original EzNihongo questions. The first authored option is the key;
// the builder varies displayed positions without breaking spoken-choice order.
export default function makeN5(h) {
 const {q,reading,listening,star,text}=h;
 // Kanji reading: 8.
 [
 ['えきの【東】に スーパーが あります。','ひがし|にし|きた|みなみ','東 dibaca ひがし: timur.',9],
 ['【毎週】、日よう日に そうじを します。','まいしゅう|まいにち|らいしゅう|まいとし','毎週 berarti setiap minggu.',11],
 ['この みちは【長い】です。','ながい|たかい|おおい|ひろい','長い dibaca ながい: panjang.',6],
 ['パンを【半分】 たべました。','はんぶん|はんぷん|ばんぶん|はんふん','半分 dibaca はんぶん: separuh.',5],
 ['ここに なまえを【書いて】 ください。','かいて|きいて|はいて|あいて','書く menjadi 書いて, dibaca かいて.',10],
 ['母は【会社】に います。','かいしゃ|がいしゃ|かいじゃ|かしゃ','会社 dibaca かいしゃ: perusahaan.',15],
 ['【水曜日】に テストが あります。','すいようび|もくようび|かようび|きんようび','水曜日 adalah Rabu, すいようび.',16],
 ['わたしの【左】に すわって ください。','ひだり|みぎ|まえ|うしろ','左 dibaca ひだり: kiri.',8],
 ].forEach(([p,o,e,c])=>q('kanji_reading',p,o,e,[c]));
 // Orthography: 6.
 [
 ['【でんしゃ】で がっこうへ 行きます。','電車|電気|自転車|会社','でんしゃ ditulis 電車: kereta.',9],
 ['この シャツは【やすい】です。','安い|高い|古い|白い','やすい ditulis 安い: murah.',6],
 ['【きた】の まどを あけて ください。','北|西|南|東','きた ditulis 北: utara.',9],
 ['この ほんは【さんびゃく】円です。','三百|三千|三万|三十','さんびゃく adalah 300, ditulis 三百.',5],
 ['まいばん、ほんを【よみます】。','読みます|書きます|聞きます|話します','よむ ditulis 読む: membaca.',10],
 ['【ちち】は いま いえに いません。','父|母|子|人','ちち adalah ayah sendiri, ditulis 父.',17],
 ].forEach(([p,o,e,c])=>q('orthography',p,o,e,[c]));
 // Contextual vocabulary: 7.
 [
 ['あめですから、（　）を もって 行きます。','かさ|さいふ|くつした|かぎ','Saat hujan, benda yang dipakai melindungi diri adalah payung.',4],
 ['この スープは（　）です。すこし さましてから 飲みましょう。','あつい|さむい|つめたい|すずしい','Sup perlu didinginkan karena panas: あつい.',6],
 ['手が よごれました。手を（　）。','あらいます|はきます|しめます|かぶります','Tangan yang kotor dicuci: 手をあらいます.',12],
 ['いま 九時五十分です。十時まで（　）です。','あと十分|もう十分|十時間|十日前','Dari 09.50 menuju 10.00 masih sepuluh menit: あと十分.',5],
 ['つくえを ふきます。（　）を とって ください。','ぞうきん|えんぴつ|ざっし|きっぷ','Untuk mengelap meja, diperlukan ぞうきん, kain lap.',13],
 ['この へやは（　）です。まどを あけて、あかるく しましょう。','くらい|あまい|わかい|ながい','Membuka jendela agar terang menunjukkan ruangan gelap: くらい.',6],
 ['あしたは テストです。こんや ことばを（　）。','おぼえます|およぎます|つきます|ならびます','Kosakata dipelajari atau dihafal dengan おぼえます.',10],
 ].forEach(([p,o,e,c])=>q('context_vocabulary',p,o,e,[c]));
 // Paraphrases: 4.
 [
 ['「へやには だれも いません。」と おなじ いみの ぶんは どれですか。','へやに 人は いません。|へやに 一人 います。|へやに みんな います。|へやに 人が たくさん います。','だれも + negatif berarti tidak seorang pun.',8],
 ['「土よう日は ひまです。」と おなじ いみの ぶんは どれですか。','土よう日は いそがしく ありません。|土よう日は とても いそがしいです。|土よう日は 休みが ありません。|土よう日は 一日中 はたらきます。','ひま berarti memiliki waktu luang, tidak sibuk.',7],
 ['「りんごを 二つ ください。」と おなじ いみの ぶんは どれですか。','りんごが 二つ ほしいです。|りんごを 二人に あげます。|りんごは 二つ とも いりません。|りんごを 二つ 食べました。','Permintaan dua apel menunjukkan keinginan mendapat dua apel, bukan kejadian lampau.',11],
 ['「たなかさんは やまださんより せが 高いです。」どれが ただしいですか。','やまださんは たなかさんほど せが 高くないです。|やまださんの ほうが せが 高いです。|二人の せは おなじです。|たなかさんは せが ひくいです。','AよりB atau AはBより menyatakan perbandingan; やまだ lebih pendek daripada 田中.',18],
 ].forEach(([p,o,e,c])=>q('paraphrase',p,o,e,[c]));
 // Grammar forms: 15.
 [
 ['わたしは ベトナム人です。リンさん（　）ベトナム人です。','も|を|に|で','も menambahkan identitas yang sama: Lin juga orang Vietnam.',3],
 ['この ノートは だれ（　）ですか。','の|を|が|と','だれの menanyakan pemilik.',4],
 ['父は まいあさ 六時（　）おきます。','に|で|を|と','に menandai waktu tertentu suatu kegiatan.',5],
 ['きのう、友だち（　）いっしょに テニスを しました。','と|が|を|へ','といっしょに berarti bersama seseorang.',9],
 ['ここ（　）しゃしんを とっても いいですか。','で|へ|を|が','で menandai tempat berlangsungnya kegiatan memotret.',13],
 ['きのうは 休みでしたから、学校へ（　）。','行きませんでした|行きません|行きます|行きましょう','きのう dan keterangan libur meminta negatif lampau: 行きませんでした.',10],
 ['この りょうりは あまり（　）。','からくないです|からいでした|からくです|からいくないです','あまり + negatif; bentuk negatif からい ialah からくない.',6],
 ['きのうの テストは（　）。','かんたんでした|かんたんかった|かんたんなかった|かんたんくなかった','Kata sifat na memakai でした untuk positif lampau.',7],
 ['つくえの 上に ねこが（　）。','います|あります|します|なります','Hewan hidup memakai います.',8],
 ['水を 三（　）買いました。','本|人|まい|歳','Untuk air dalam botol, pencacah yang sesuai di antara pilihan ialah 本.',11],
 ['ここで たばこを（　）は いけません。','すって|すう|すい|すった','Larangan memakai Vてはいけません.',13],
 ['あした はやく おきますから、きょうは はやく（　）たいです。','ね|ねて|ねる|ねた','たい menempel pada pangkal ます: ねます → ねたい.',15],
 ['アリさんは、日本語を（　）ことが できます。','話す|話して|話した|話します','ことができる didahului verba bentuk kamus.',17],
 ['きのう、ばんごはんを（　）あとで、さんぽしました。','食べた|食べる|食べて|食べます','Vたあとで menyatakan setelah kegiatan selesai.',20],
 ['すみません。もう すこし ゆっくり（　）ください。','話して|話す|話した|話し','Permintaan sopan memakai Vてください.',13],
 ].forEach(([p,o,e,c])=>q('grammar_form',p,o,e,[c]));
 // Sentence composition: 5. The ordered array is private until submission.
 star('わたしは ＿＿ ＿＿ ★ ＿＿。',['学校の','ちかくに','すんで','います'],2,'Urutan: 学校のちかくにすんでいます。★ adalah すんで.',[8,13]);
 star('きのうは ＿＿ ★ ＿＿ ＿＿。',['あまり','さむく','ありません','でした'],1,'Urutan: あまりさむくありませんでした。★ adalah さむく. あまり diikuti bentuk negatif.',[6,7]);
 star('学校まで ＿＿ ＿＿ ★ ＿＿。',['バスで','三十分','かかり','ます'],2,'Urutan: バスで三十分かかります。★ adalah かかり, yang diikuti ます.',[9,11]);
 star('この へやは ＿＿ ★ ＿＿ ＿＿。',['あの へや','より','ずっと','ひろいです'],1,'Urutan: あのへやよりずっとひろいです。★ adalah より.',[18]);
 star('わたしは ＿＿ ＿＿ ★ ＿＿。',['日本語を','話す','ことが','できます'],2,'Urutan: 日本語を話すことができます。★ adalah ことが.',[17]);
 // Connected text: 5 blanks in two passages.
 const t1='わたしは アリです。毎日 学校へ 行きます。いえから 学校まで バスで 二十分（①）。きのうは バスが きませんでした。（②）、あるいて 行きました。学校に（③）とき、友だちは もう きょうしつに いました。';
 text(t1,'①','かかります|かけます|あります|います','移動時間 + かかります menyatakan waktu yang dibutuhkan.',[9,11]);
 text(t1,'②','それで|でも|それからも|けれども','Bus tidak datang, akibatnya ia berjalan: それで.',[19]);
 text(t1,'③','ついた|つきます|ついて|つくの','到着 yang sudah terjadi memakai ついたとき.',[20]);
 const t2='日よう日に 友だちが いえへ きます。友だちは さかなが すきですが、わたしは さかなが（④）。でも、友だちが きますから、さかなの りょうりを つくります。デザートも ほしいですから、あとで スーパーへ（⑤）。';
 text(t2,'④','きらいです|すきです|すきでした|だいすきです','が menandai kontras antara kesukaan teman dan pembicara; pilih きらいです.',[7,19]);
 text(t2,'⑤','買いに 行きます|買って きました|買いました|買いませんでした','Tujuan membeli dessert dinyatakan 買いに行きます; kegiatan masih akan dilakukan.',[15]);
 // Reading: 3 short + 2 medium + 1 retrieval.
 reading('short_reading','ミナさんへ\nわたしは スーパーへ 行きます。れいぞうこに カレーが あります。あたためて 食べて ください。パンは あしたの あさ 食べますから、いまは 食べないで ください。\n母','ミナさんは いま 何を 食べますか。','カレー|パン|パンと カレー|何も 食べません','Pesan meminta Mina memanaskan dan memakan kari; roti disimpan untuk besok pagi.',[13,14]);
 reading('short_reading','わたしの 会社は 九時から 五時までです。いえから 会社まで 電車で 三十分、えきから 会社まで あるいて 十分です。まいあさ 八時に いえを 出ます。','会社は 何時に おわりますか。','五時|八時|九時|十時','Kalimat pertama menyatakan jam kerja berakhir pukul lima; waktu perjalanan adalah pengecoh.',[5,9]);
 reading('short_reading','あしたの テニスは 三時からです。いつもの こうえんでは ありません。学校の うしろの コートです。あめの ときは テニスを しません。','あした あめではない とき、どこで テニスを しますか。','学校の うしろ|いつもの こうえん|学校の 前|えきの うしろ','Lokasi berubah menjadi lapangan di belakang sekolah.',[8,16]);
 const r='わたしは 土よう日に いもうとと 新しい 店へ 行きました。店は えきの となりに あります。わたしは あかい かばんが ほしかったですが、高かったですから、買いませんでした。いもうとは 白い くつを 買いました。それから 二人で ひるごはんを 食べました。わたしは カレー、いもうとは パンを 食べました。店を 出る とき あめでした。かさは 一つだけでしたから、二人で 一つの かさを つかいました。';
 reading('medium_reading',r,'わたしは どうして かばんを 買いませんでしたか。','高かったから|あかかったから|ちいさかったから|古かったから','Harga mahal merupakan alasan eksplisit tidak membeli tas.',[6,19]);
 reading('medium_reading',r,'二人は 店を 出る とき、どうしましたか。','一つの かさを いっしょに つかいました。|かさを 二つ 買いました。|いもうとだけ かさを つかいました。|あめが やんでから かえりました。','Akhir bacaan menyebut kedua orang memakai satu payung bersama.',[10,20]);
 reading('information_retrieval','【しの プール】\n月よう日：休み\n火〜金：午後一時〜午後八時\n土・日：午前九時〜午後六時\nおとな：四百円／学生：二百円\n十さいより ちいさい 子ども：百円','だいがくせいの アリさんは 日よう日の 午前十時に プールへ 行きます。いくら はらいますか。','二百円|百円|四百円|休みですから 入れません','Minggu pukul 10 buka; mahasiswa memakai tarif 学生, 200 yen.',[5,16,18]);
 // Listening task comprehension: 7.
 [
 ['A: おちゃを 入れましょうか。\nB: ありがとう。でも その 前に、まどを しめて ください。\nA: はい。','Aさんは まず 何を しますか。','まどを しめます。|おちゃを 入れます。|まどを あけます。|おちゃを 飲みます。','その前に menetapkan tindakan pertama: menutup jendela.',[13]],
 ['A: あした 何を もって 行きますか。\nB: 本は いりません。ノートと えんぴつを もって きて ください。','Aさんは 何を もって 行きますか。','ノートと えんぴつ|本と ノート|本だけ|えんぴつだけ','ノート dan pensil diminta; buku tidak diperlukan.',[14]],
 ['A: この はこを どこに おきますか。\nB: つくえの 下に おいて ください。上には パソコンを おきます。','Aさんは はこを どこに おきますか。','つくえの 下|つくえの 上|いすの 下|いすの 上','Kotak diletakkan di bawah meja; bagian atas untuk komputer.',[8,13]],
 ['A: バスと 電車、どちらで 行きますか。\nB: バスは 安いですが、おそいです。きょうは 時間が ありません。\nA: じゃあ、電車に しましょう。','二人は 何で 行きますか。','電車|バス|タクシー|じてんしゃ','Keputusan akhir ialah naik kereta karena waktu terbatas.',[9,18]],
 ['A: ケーキを 三つ ください。\nB: はい。\nA: あ、いもうとも きますから、もう 一つ おねがいします。','Bさんは ケーキを いくつ 入れますか。','四つ|一つ|二つ|三つ','Tiga kue ditambah satu menjadi empat.',[11]],
 ['A: この 紙に なまえを 書きました。つぎは 何ですか。\nB: 電話ばんごうを 書いてから、先生に わたして ください。','Aさんは つぎに 何を 書きますか。','電話ばんごう|なまえ|日にち|先生の なまえ','Nama sudah ditulis. Berikutnya nomor telepon, lalu diserahkan.',[12]],
 ['A: きょうの そうじは、わたしが へやを します。\nB: じゃあ、わたしは おふろですね。\nA: おふろは もう しました。げんかんを おねがいします。','Bさんは どこを そうじしますか。','げんかん|へや|おふろ|だいどころ','Koreksi terakhir meminta B membersihkan area pintu masuk.',[10,13]],
 ].forEach(([s,p,o,e,c])=>listening('task_comprehension',s,p,o,e,c));
 // Listening key points: 6.
 [
 ['A: パーティーは 六時からですか。\nB: いいえ、六時半からです。わたしは 六時に 行って、じゅんびを します。','パーティーは 何時からですか。','六時半|六時|五時半|七時','Acara mulai 18.30; pukul 18.00 adalah waktu persiapan.',[5]],
 ['A: 新しい いえは どうですか。\nB: ちいさいですが、えきに ちかくて べんりです。でも、すこし うるさいです。','新しい いえの いい ところは 何ですか。','えきに ちかい こと|おおきい こと|しずかな こと|安い こと','Kelebihan yang disebut ialah dekat stasiun dan praktis.',[6,7]],
 ['A: あした どこで 会いますか。\nB: えきの 中の 店に しましょう。外は さむいですから。','二人は どこで 会いますか。','えきの 中の 店|えきの 外|学校の 店|友だちの いえ','Lokasi pertemuan ada di toko dalam stasiun.',[8]],
 ['A: きのうは 何を しましたか。\nB: あさは せんたくを しました。午後は 友だちと さんぽして、夜は いえで えいがを 見ました。','Bさんは 午後 何を しましたか。','さんぽ|せんたく|えいが|買いもの','Urutan waktu menempatkan jalan-jalan pada sore hari.',[10]],
 ['A: その シャツ、千円でしたか。\nB: いいえ。前は 千円でしたが、きょうは 八百円でした。二まい 買いました。','Bさんは ぜんぶで いくら はらいましたか。','千六百円|八百円|千円|二千円','Dua baju × 800 yen = 1.600 yen.',[5,11]],
 ['A: どうして きょうは あるいて きましたか。\nB: じてんしゃが こわれました。バスも ありましたが、てんきが よかったですから 歩きました。','Bさんは どうして バスに のりませんでしたか。','てんきが よかったから|バスが なかったから|お金が なかったから|あめだったから','Pertanyaan menanyakan alasan tidak naik bus: cuacanya bagus.',[9,19]],
 ].forEach(([s,p,o,e,c])=>listening('key_points',s,p,o,e,c));
 // Spoken situational choices: 5.
 [
 ['N: レストランです。Aさんは 水が ほしいです。店の 人に 何と 言いますか。','水を ください。|水を あげます。|水を どうぞ。','Meminta air kepada staf memakai 水をください.',[15],'water'],
 ['N: Aさんは 友だちの いえに 入ります。何と 言いますか。','おじゃまします。|いってきます。|ごちそうさまでした。','Saat masuk rumah orang lain diucapkan おじゃまします.',[3],'visit'],
 ['N: 友だちが 重い はこを もっています。Aさんは 手つだいたいです。何と 言いますか。','持ちましょうか。|もって ください。|もっても いいですか、わたしの はこを。','Vましょうか menawarkan bantuan membawa kotak teman.',[15],'box'],
 ['N: Aさんは 先生の ことばが わかりませんでした。もう 一度 聞きたいです。何と 言いますか。','もう 一度 おねがいします。|もう 一度 言います。|よく わかりました。','Meminta pengulangan memakai もう一度お願いします.',[13],'repeat'],
 ['N: Aさんは 店で シャツを 見ています。ねだんを 知りたいです。何と 言いますか。','これは いくらですか。|これは いくつですか。|これは いつですか。','いくら menanyakan harga, bukan jumlah atau waktu.',[5],'price'],
 ].forEach(([s,o,e,c,scene])=>listening('verbal_expression',s,'何と 言いますか。',o,e,c,scene));
 // Quick responses: 6.
 [
 ['A: いっしょに ひるごはんを 食べませんか。','いいですね。行きましょう。|いいえ、食べましたか。|ごちそうさまですか。','Ajakan dijawab dengan persetujuan dan ajakan pergi.',[15]],
 ['A: すみません。ゆうびんきょくは どこですか。','あの ぎんこうの となりです。|三時までです。|百円です。','どこ memerlukan jawaban lokasi.',[8]],
 ['A: この ペンを 使っても いいですか。','はい、どうぞ。|はい、つかいました。|いいえ、使います。','Permintaan izin dijawab はい、どうぞ.',[13]],
 ['A: お国は どちらですか。','インドネシアです。|会社いんです。|二十さいです。','お国 menanyakan negara asal.',[3]],
 ['A: コーヒーは いかがですか。','ありがとうございます。いただきます。|おはよう ございます。|どういたしまして。','Menerima tawaran minuman dengan berterima kasih dan いただきます.',[15]],
 ['A: きのうの えいがは どうでしたか。','とても おもしろかったです。|三時から 見ます。|あした 見ませんか。','どうでしたか menanyakan kesan terhadap film yang sudah ditonton.',[7,10]],
 ].forEach(([s,o,e,c])=>listening('quick_response',s,'いちばん いい へんじを えらんで ください。',o,e,c));
}
