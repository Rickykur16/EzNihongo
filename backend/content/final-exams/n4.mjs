// Independently authored contexts and distractors; no official paper is copied.
export default function makeN4(h) {
 const {q,reading,listening,star,text}=h;
 // Vocabulary: 7 readings, 5 orthography, 7 context, 4 paraphrases, 4 usage.
 [
 ['出かける 前に、電車の 時間を【調べます】。','しらべます|くらべます|ならべます|えらびます','調べる dibaca しらべる: memeriksa atau mencari informasi.',3],
 ['駅までの 道を【説明】して ください。','せつめい|せつもん|せいめい|せきめい','説明 dibaca せつめい: penjelasan.',2],
 ['次の【特急】は 十時に 出発します。','とっきゅう|とくきゅ|ときゅう|とっきょう','特急 dibaca とっきゅう: kereta ekspres terbatas. Perhatikan geminasi dan vokal panjang.',19],
 ['【必要】な 物を かばんに 入れました。','ひつよう|ひつよ|ひちよう|びつよう','必要 dibaca ひつよう: diperlukan.',16],
 ['あの 店は いつも【親切】です。','しんせつ|しんぜつ|しんさい|しんさつ','親切 dibaca しんせつ: baik hati atau ramah.',12],
 ['この 仕事は【経験】が なくても できます。','けいけん|けいげん|けけん|けんけい','経験 dibaca けいけん: pengalaman.',10],
 ['あしたは 荷物を【運びます】。','はこびます|えらびます|ならびます|あそびます','運ぶ dibaca はこぶ: mengangkut.',7],
 ].forEach(([p,o,e,c])=>q('kanji_reading',p,o,e,[c]));
 [
 ['旅行の【じゅんび】は もう 終わりましたか。','準備|準番|用備|順美','じゅんび ditulis 準備: persiapan.',7],
 ['この【きかい】は 使い方が むずかしいです。','機械|機会|器会|期械','Alat atau mesin ditulis 機械; 機会 berarti kesempatan.',9],
 ['【とくべつ】な 日に この 服を 着ます。','特別|特列|持別|特利','とくべつ ditulis 特別: khusus.',20],
 ['この 川は【ふかい】ので、入らないで ください。','深い|浅い|重い|低い','ふかい ditulis 深い: dalam.',16],
 ['来週の【よてい】を 教えて ください。','予定|予走|予約|用定','よてい ditulis 予定: rencana/jadwal. 予約 dibaca よやく.',5],
 ].forEach(([p,o,e,c])=>q('orthography',p,o,e,[c]));
 [
 ['バスに 財布を 忘れましたが、運転手さんが（　）おいて くれました。','とって|ぬいで|わって|わらって','とっておく berarti menyimpan untuk sementara; pengemudi menyimpankan dompet.',7,18],
 ['朝は 道が（　）ので、車より 電車の ほうが 早いです。','こむ|すく|かわく|わく','道がこむ berarti lalu lintas padat.',10],
 ['だれも 来ないと 思って いたのに、友だちが（　）来て うれしかったです。','急に|必ず|だんだん|ずっと','急に sesuai kedatangan mendadak yang tidak diperkirakan.',8,10],
 ['書類を 出す 前に、名前が 正しいか（　）して ください。','確認|紹介|招待|出発','確認する berarti memastikan atau mengecek.',19],
 ['話が よく 聞こえません。もう 少し 声を（　）して ください。','大きく|多く|長く|高く','声を大きくする berarti memperbesar volume; 高くする mengubah tinggi nada.',4,9],
 ['この かばんは（　）が 丈夫なので、重い 物を 入れても 安心です。','持つ ところ|着る ところ|飲む ところ|読む ところ','Bagian untuk memegang tas harus kuat agar dapat membawa barang berat.',1,10],
 ['あの 人は 時間を よく 守ります。（　）遅れません。','めったに|必ず|いつも|だんだん','めったに + negatif berarti jarang terlambat.',20],
 ].forEach(([p,o,e,...c])=>q('context_vocabulary',p,o,e,c));
 [
 ['「きょうは 無理を しないで ください。」に 近い いみは どれですか。','きょうは 自分に できる ことだけに して ください。|きょうは 必ず 全部 終わらせて ください。|きょうは 休まず 働いて ください。|きょうは いつもより がんばって ください。','無理をしない meminta orang tidak memaksakan diri.',16],
 ['「この 本を 返すのは 来週でも かまいません。」に 近い いみは どれですか。','来週 返しても いいです。|来週まで 借りては いけません。|きょう 返す 必要が あります。|来週は 返せません。','てもかまいません memberikan izin.',10,16],
 ['「会議に 間に合いました。」に 近い いみは どれですか。','会議が 始まる 時間より 遅く なりませんでした。|会議の 時間を 間違えました。|会議には 行きませんでした。|会議が 終わってから 着きました。','間に合う berarti datang tepat waktu sebelum terlambat.',3],
 ['「まず 自分で やってみます。」に 近い いみは どれですか。','最初に 自分で できるか 試します。|最初から ほかの 人に 頼みます。|自分では 何も しません。|ほかの 人が するのを 見ます。','Vてみる menyatakan mencoba melakukan sendiri.',6],
 ].forEach(([p,o,e,...c])=>q('paraphrase',p,o,e,c));
 [
 ['【予約】の 使い方が ただしい ぶんは どれですか。','来週 泊まる ホテルを 予約しました。|きのうの 天気を 予約しました。|駅まで 歩いて 予約しました。|古い 服を 予約して 捨てました。','予約 adalah pemesanan lebih awal, misalnya hotel.',5],
 ['【残る】の 使い方が ただしい ぶんは どれですか。','料理が たくさん 残りました。|友だちを 駅で 残りました。|電気を 残って ください。|手紙を ポストに 残りました。','残る adalah verba intransitif: masakan tersisa.',7],
 ['【比べる】の 使い方が ただしい ぶんは どれですか。','二つの 店の 値段を 比べました。|バスに 比べて 家へ 帰りました。|窓を 比べて 空気を 入れました。|名前を 比べて 紙に 書きました。','比べる membandingkan dua hal seperti harga.',20],
 ['【連絡】の 使い方が ただしい ぶんは どれですか。','遅れる ときは、学校に 連絡して ください。|毎朝 ごはんを 連絡します。|この 靴は 足に 連絡します。|橋を 連絡して 川を 渡ります。','連絡する berarti menghubungi pihak lain untuk menyampaikan kabar.',2],
 ].forEach(([p,o,e,c])=>q('usage',p,o,e,[c]));
 // Grammar forms: 15.
 [
 ['これは 先週 兄が（　）ケーキです。','作った|作って|作ります|作り','Klausa yang menerangkan benda memakai bentuk biasa: 作ったケーキ.',1],
 ['頭が 痛い（　）、きょうは 早く 帰っても いいですか。','ので|のに|ても|ながら','ので menyatakan alasan meminta pulang.',2,10],
 ['レポートは 金曜日（　）出して ください。土曜日は 受け取りません。','までに|まで|から|だけ','までに memberi batas penyelesaian; まで untuk keberlangsungan.',3],
 ['子どもの ころは 泳げませんでしたが、今は（　）ように なりました。','泳げる|泳いで|泳ぎます|泳げた','Perubahan kemampuan menggunakan potensial + ようになる.',4,5],
 ['旅行の 前に ホテルを 予約して（　）。','おきます|あります|いますでした|くださいました','ておく menyatakan persiapan untuk perjalanan.',7],
 ['電車の 中で ねて、駅を（　）しまいました。','通りすぎて|通りすぎる|通りすぎた|通りすぎます','てしまう menyatakan kejadian yang disesali.',6],
 ['風で 窓が（　）います。だれか 閉めて ください。','開いて|開けて|開く|開ける','窓が開いている menggambarkan keadaan terbuka dengan verba intransitif.',7],
 ['この 字は 小さすぎて、（　）にくいです。','読み|読んで|読む|読んだ','Vます-stem + にくい menyatakan sulit dilakukan.',9],
 ['空が 暗く なりました。雨が（　）そうです。','降り|降る|降った|降って','Dugaan dari tampilan menggunakan pangkal ます + そう.',11],
 ['天気予報では、あしたは 雨が（　）そうです。','降る|降り|降って|降りますの','Kabar dari ramalan cuaca memakai bentuk biasa + そう.',11],
 ['弟は 新しい ゲームを 買い（　）います。','たがって|たいで|たいに|たく','Keinginan orang lain yang tampak dari perilaku memakai たがっている.',12],
 ['京都へ 行く（　）、この 地図を 持って 行くと 便利ですよ。','なら|ながら|までに|ための','なら menanggapi topik/rencana lawan bicara.',14],
 ['忘れない（　）、手帳に 書いて おきます。','ように|ためで|ことに|そうに','Hasil yang diupayakan, agar tidak lupa, memakai ように.',15],
 ['駅まで 友だちが 車で 送って（　）。わたしは とても 助かりました。','くれました|あげました|もらいました|やりました','友だちが menjadi pemberi bantuan kepada pembicara: てくれる.',18],
 ['わたしは 作文を 先生に（　）、とても うれしかったです。','ほめられて|ほめて|ほめさせて|ほめたくて','Pembicara menerima pujian dari guru: bentuk pasif ほめられて.',21],
 ].forEach(([p,o,e,...c])=>q('grammar_form',p,o,e,c));
 // Sentence composition: 5.
 star('友だちに ＿＿ ★ ＿＿ ＿＿。',['借りた','本を','返さなければ','なりません'],1,'Urutan: 友だちに借りた本を返さなければなりません。★ adalah 本を.',[1,16]);
 star('出かける ＿＿ ＿＿ ★ ＿＿ ください。',['前に','電気が','消えて いるか','確かめて'],2,'Urutan: 出かける前に電気が消えているか確かめてください。★ adalah 消えているか.',[3,19]);
 star('この アプリは ＿＿ ★ ＿＿ ＿＿ います。',['使い方が','簡単な','だけでなく','無料に なって'],1,'Urutan: 使い方が簡単なだけでなく無料になっています。★ adalah 簡単な.',[9,19]);
 star('わたしは 毎朝 ＿＿ ＿＿ ★ ＿＿。',['歩く','ことに','して','います'],2,'Urutan: 毎朝歩くことにしています。★ adalah して. ことにしている menyatakan kebiasaan yang sengaja dipertahankan.',[5]);
 star('先生が おっしゃった ＿＿ ★ ＿＿ ＿＿。',['とおりに','やって','みる','つもりです'],1,'Urutan: おっしゃったとおりにやってみるつもりです。★ adalah やって.',[5,6,20,23]);
 // Text grammar: 5.
 const t='去年まで、わたしは 自転車で 会社に 通って いました。しかし、引っこした 家は 会社から 遠い（①）、今は 電車を 使って います。電車の 中では 本を（②）、日本語の 音声を 聞いたり します。初めは 朝 早く 起きるのが 大変でしたが、今は 目覚まし時計が なくても 起きられる（③）。';
 text(t,'①','ので|のに|ても|ながら','Alasan menggunakan kereta ialah rumah jauh: ので.',[10]);
 text(t,'②','読んだり|読みたり|読んでたり|読むたり','Pola enumerasi memakai Vた + り: 読んだり.',[3]);
 text(t,'③','ように なりました|ために なりました|ことに しましたか|ところが あります','ようになった menunjukkan perubahan kemampuan bangun sendiri.',[5]);
 const t2='きのう、料理教室で パンを 作りました。初めてだったので 心配でしたが、先生が 手伝って（④）ので、うまく できました。家族にも 好評でした。次は 一人で 作って（⑤）と 思います。';
 text(t2,'④','くださった|さしあげた|いただいた|いたした','先生が pemberi bantuan yang dihormati: てくださった. いただいた memerlukan pembicara sebagai subjek penerima.',[18,24]);
 text(t2,'⑤','みよう|みるな|みないで|みられて','Niat mencoba dinyatakan てみようと思う.',[5,6]);
 // Reading: 4 short, 4 medium, 2 retrieval.
 reading('short_reading','【図書館から】\n返す 日を 過ぎた 本が ある 人は、その 本を 返すまで 新しい 本を 借りる ことが できません。ただし、館内で 本を 読む ことは できます。返却は 入口の 箱でも できます。','返す 日を 過ぎた 本が ある 人は、何が できますか。','図書館の 中で 本を 読む。|新しい 本を 借りる。|返す 日を 自分で 変える。|入口の 箱から 本を 借りる。','Pengecualian yang diizinkan ialah membaca di dalam perpustakaan.',[13,16]);
 reading('short_reading','山田さん\nあしたの 打ち合わせは 午後二時の 予定でしたが、三時に 変わりました。場所は 前と 同じです。書類は わたしが 持って 行きますから、印刷する 必要は ありません。\n木村','山田さんは どうすれば いいですか。','三時に 前と 同じ 場所へ 行く。|二時に 新しい 場所へ 行く。|三時までに 書類を 印刷する。|二時に 木村さんの 家へ 行く。','Jadwal berubah menjadi pukul tiga, tempat sama, dokumen dibawa Kimura.',[3,16]);
 reading('short_reading','駅の 近くに 新しい パン屋が できました。値段は 少し 高いですが、夜 九時まで 開いて いるので、仕事の 帰りに 買えて 助かります。前の 店は 六時に 閉まって いたので、間に合わない ことが 多かったです。','書いた 人が 新しい 店を 気に入って いるのは なぜですか。','仕事が 終わってから 買えるから。|前の 店より 安いから。|朝 早く 開くから。|仕事の 場所に 近いから。','Jam tutup yang lebih malam memungkinkan membeli setelah bekerja.',[4,10]);
 reading('short_reading','田中さんへ\n借りて いた かさを お返ししようと 思ったのですが、きょうは お会いできませんでした。明日の 朝、受付に 預けて おきます。お時間の ある ときに お受け取りください。\nリー','リーさんは 明日 何を しますか。','かさを 受付に 預ける。|田中さんから かさを 借りる。|受付で 田中さんを 待ち続ける。|新しい かさを 買う。','Besok Lee menitipkan payung di resepsionis; penerima mengambil saat sempat.',[7,17,24]);
 const r1='わたしは 日本語の 勉強を 始めた とき、毎日 新しい 言葉を 二十 覚える ことに して いました。でも、次の 週には ほとんど 忘れて しまいました。先生に 相談すると、「数を 少なく して、覚えた 言葉を 使って みたら どうですか」と 言われました。それからは 一日に 五つずつ 覚え、その 言葉で 短い 日記を 書いて います。前より 時間は かかりますが、話す ときにも 言葉が 出て くる ように なりました。たくさん 覚える ことだけが 大切なのではないと 思います。';
 reading('medium_reading',r1,'勉強の 方法を 変えたのは なぜですか。','覚えても すぐ 忘れて しまったから。|二十の 言葉を 知って いたから。|日記を 書くのが 好きではなかったから。|先生に 会えなく なったから。','Masalah awal ialah cepat lupa meski menghafal banyak kata.',[5,6,13]);
 reading('medium_reading',r1,'書いた 人が 今 大切だと 思って いるのは 何ですか。','覚えた 言葉を 実際に 使う こと。|できるだけ 多くの 言葉を 一度に 覚える こと。|日記を できるだけ 早く 書く こと。|新しい 言葉を 覚えない こと。','Pengalaman mendukung penggunaan nyata kata, bukan sekadar jumlah hafalan.',[1,5]);
 const r2='市の 料理教室に 参加しました。わたしは 料理が 得意ではないので、初めは 先生の 説明を 聞くだけだと 思って いました。しかし、四人の グループで 一緒に 作る 教室でした。わたしが 野菜を 切ろうと すると、隣の 人が「こうすると 切りやすいですよ」と 教えて くれました。食事の 時間には それぞれの 国の 料理について 話しました。完成した 料理も おいしかったですが、知らなかった 人と 話せたのが 一番 うれしかったです。来月も 参加したいと 思って います。';
 reading('medium_reading',r2,'教室は 書いた 人の 予想と どう 違いましたか。','説明を 聞くだけでなく、グループで 料理を 作りました。|先生が 一人で 全部 作りました。|料理を 作らず、食べるだけでした。|一人ずつ 違う 国へ 行きました。','Prediksi mendengarkan saja berbeda dari praktik memasak kelompok.',[9,19]);
 reading('medium_reading',r2,'書いた 人が 一番 うれしかった ことは 何ですか。','初めて 会った 人と 話せた こと。|先生に 料理を ほめられた こと。|一人で 料理を 完成させた こと。|野菜を 買わなくて よかった こと。','Bacaan secara eksplisit menyebut berbicara dengan orang baru sebagai hal paling menyenangkan.',[4,18]);
 const info='【市民センター 日本語講座】\nA：月・水 10:00〜11:30／会話中心／月3,000円\nB：火・木 19:00〜20:30／会話中心／月3,000円\nC：土 10:00〜12:00／読み書き中心／月2,000円\n申し込み：受付 または ウェブサイト（電話では できません）\n初回の 見学は 無料です。教材費は どの 講座も 別に500円です。';
 reading('information_retrieval',info,'平日の 昼は 働いて います。夜に 会話を 勉強したいです。どの 講座を 選びますか。','B|A|C|どれも 参加できません。','B berlangsung pada malam hari dan berfokus percakapan.',[3,20]);
 reading('information_retrieval',info,'Cに 申し込んで 初めの 一か月 通います。教材も 買います。全部で いくらですか。','2,500円|2,000円|3,000円|3,500円','C 2.000 yen ditambah biaya bahan 500 yen; gratis hanya untuk observasi pertama.',[19,20]);
 // Task comprehension: 8.
 [
 ['A: 会議の 準備、いすを 並べましょうか。\nB: いすは もう 並べて あります。先に プロジェクターが 使えるか 調べて ください。その 後で 書類を 配りましょう。','Aさんは まず 何を しますか。','機械を 確かめる。|いすを 並べる。|書類を 配る。|会議を 始める。','先に meminta pengecekan proyektor lebih dahulu.',[7,19]],
 ['A: あしたまでに この 書類を 出せば いいですか。\nB: ええ。でも、出す 前に 部長に 見せて ください。\nA: 部長は もう 帰られましたね。\nB: あしたの 朝 お願いします。','Aさんは あした まず 何を しますか。','部長に 書類を 見せる。|書類を すぐ 出す。|部長の 家へ 行く。|新しく 書き直す。','Sebelum menyerahkan, dokumen harus ditunjukkan kepada kepala bagian.',[3,23]],
 ['A: この 花、窓の そばに 置いても いいですか。\nB: 午後は 日が 強すぎますから、ドアの 近くに しましょう。水は もう あげました。','Aさんは 花を どこに 置きますか。','ドアの 近く|窓の そば|外の 庭|机の 下','Keputusan akhir memindahkan bunga ke dekat pintu.',[9,17]],
 ['A: バスが 遅れて いるので、待ち合わせに 十分ほど 遅れそうです。\nB: 分かりました。着いたら 電話して ください。先に 店に 入って 待って います。','Aさんは 着いたら 何を しますか。','Bさんに 電話する。|バス会社に 電話する。|駅で 十分 待つ。|別の 店を 探す。','Instruksi setelah tiba ialah menelepon B.',[11,13]],
 ['A: 注文した シャツが 小さかったんですが、交換できますか。\nB: はい。まず ウェブサイトで 交換の 申し込みを して ください。その 後で 返送して ください。','Aさんは まず 何を しますか。','ウェブで 申し込む。|シャツを 送り返す。|新しい シャツを 買う。|店へ 電話する。','Pendaftaran penukaran melalui web dilakukan sebelum mengirim barang kembali.',[3,9]],
 ['A: この 箱は 全部 捨てても いいですか。\nB: 小さいのは 捨てて かまいませんが、大きいのは 来週 使うので 残して おいて ください。','Aさんは どの 箱を 捨てますか。','小さい 箱だけ|大きい 箱だけ|全部の 箱|どれも 捨てない','Nominalisasi 小さいの merujuk kotak kecil yang boleh dibuang.',[1,7,19]],
 ['A: あしたの 発表は 五分ですね。原稿が 少し 長いんです。\nB: 例が 三つ ありますが、二つに すれば 五分に なりますよ。最後の まとめは 残した ほうが いいです。','Aさんは どう 直しますか。','例を 一つ 減らす。|まとめを 消す。|例を 二つ 増やす。|全部 早口で 読む。','Tiga contoh dikurangi menjadi dua; kesimpulan dipertahankan.',[14,16]],
 ['A: 先生、子どもが 熱を 出したので、きょうは 早く 帰らせて いただけませんか。\nB: 分かりました。帰る 前に 受付へ 連絡して おいて ください。','Aさんは 帰る 前に 何を しますか。','受付に 連絡する。|子どもを 受付へ 連れて 行く。|先生を 病院へ 送る。|熱を 測り直す。','Izin pulang diberikan dengan instruksi menghubungi resepsionis dahulu.',[22,24]],
 ].forEach(([s,p,o,e,c])=>listening('task_comprehension',s,p,o,e,c));
 // Key points: 7.
 [
 ['A: 新しい アルバイトは どうですか。\nB: 時給は 前より 低いんですが、家から 近いし、休みも 取りやすいので、ここに 決めました。','Bさんが 新しい 仕事を 選んだ 理由は 何ですか。','通いやすくて、休みを 取りやすいから。|時給が 高いから。|仕事が 少ないから。|友だちが 働いて いるから。','Dua alasan eksplisit adalah dekat rumah dan mudah mengambil libur.',[5,9,10]],
 ['A: 日本語が 上手に なりましたね。\nB: ありがとうございます。前は 教科書を 読むだけでしたが、今は 毎日 店の 人と 話す ように して いるんです。','Bさんは 今 どんな 工夫を して いますか。','毎日 人と 日本語で 話す。|毎日 教科書を 買う。|店で 働く 時間を 増やす。|教科書を 読むのを やめる。','ようにしている menunjukkan usaha rutin bercakap dengan staf toko.',[5,19]],
 ['A: この 店、閉まって いますね。\nB: 月曜日は 休みだそうです。きのう 来れば よかったですね。','二人は 何を 残念に 思って いますか。','きのう 来なかった こと。|あした 休めない こと。|店を 閉めた こと。|月曜日に 仕事を しなかった こと。','来ればよかった menyesali tidak datang kemarin.',[11,14]],
 ['A: きょうの 練習には 来られますか。\nB: 足は もう 痛くないんですが、医者に 今週は 運動しない ように 言われました。見るだけに します。','Bさんは きょう どうしますか。','練習を 見ますが、運動は しません。|少しだけ 運動します。|医者と 一緒に 練習します。|足が 痛いので 家から 出ません。','Instruksi dokter membatasi olahraga meski rasa sakit sudah hilang.',[15,21]],
 ['A: リーさん、その 時計は ご自分で 買ったんですか。\nB: いいえ、卒業した とき、姉が くれたんです。わたしは 姉に 本を あげました。','だれが だれに 時計を あげましたか。','姉が リーさんに。|リーさんが 姉に。|先生が リーさんに。|リーさんが 先生に。','姉がくれた berarti kakak memberikan jam kepada Lee.',[17]],
 ['A: 荷物は 届きましたか。\nB: はい。でも 留守の 間に 来たので、隣の 人が 受け取って くれました。さっき お礼を 言って きました。','Bさんは 何の お礼を 言いましたか。','荷物を 受け取って もらった こと。|荷物を 運んで もらった こと。|荷物を 送って もらった こと。|家で 待って もらった こと。','Tetangga menerima paket saat penerima tidak berada di rumah.',[3,18]],
 ['A: 新しい かばん、もう 使って いますか。\nB: 見た目は 気に入ったんですが、実際に 物を 入れると 重くて。今は 前のを 使って います。','Bさんは 新しい かばんを どう 思って いますか。','見た目は いいが、使うと 重い。|軽いが、色が 好きではない。|小さすぎて 何も 入らない。|古い かばんより 使いやすい。','B membedakan tampilan yang disukai dari bobot saat dipakai.',[1,9,12]],
 ].forEach(([s,p,o,e,c])=>listening('key_points',s,p,o,e,c));
 // Situational expressions: 5.
 [
 ['N: Aさんは 受付で 先生を 待って います。先生に 会いに 来た ことを 丁寧に 伝えます。何と 言いますか。','先生に お会いしに 参りました。|先生が お目にかかりました。|先生を ご覧に なりました。','Kunjungan diri sendiri memakai bentuk merendah お会いしに参りました.',[24],'visit'],
 ['N: Aさんは 友だちに 借りた 本を ぬらして しまいました。返す とき、何と 言いますか。','ぬらして しまって、ごめんなさい。|ぬらして くれて、ありがとう。|ぬらしても よかったですね。','Permintaan maaf mengakui akibat yang tidak disengaja dengan てしまって.',[6],'book'],
 ['N: Aさんは 重い 荷物を 持っています。友だちに ドアを 開けて ほしいです。何と 言いますか。','ドアを 開けて もらえませんか。|ドアを 開けて あげましょうか。|ドアを 開けないで くれました。','Permintaan bantuan kepada teman memakai てもらえませんか.',[18],'door'],
 ['N: Aさんは 会議中です。急ぎの 電話が 来たので、少し 外へ 出たいです。何と 言いますか。','少し 席を 外しても よろしいでしょうか。|少し 席を 外して くださいませんか。|少し 席を 外して いただきました。','Meminta izin untuk tindakan diri sendiri memakai てもよろしいでしょうか.',[24],'phone'],
 ['N: お客様が 帰ります。Aさんは 忘れ物が ないか 丁寧に 確かめます。何と 言いますか。','お忘れ物は ございませんか。|お忘れ物を いただきますか。|お忘れ物に なさいますか。','Pertanyaan layanan formal yang sesuai adalah お忘れ物はございませんか.',[23,24],'bag'],
 ].forEach(([s,o,e,c,scene])=>listening('verbal_expression',s,'何と 言いますか。',o,e,c,scene));
 // Quick responses: 8.
 [
 ['A: 窓を 開けても かまいませんか。','ええ、どうぞ。|ええ、開けませんでしたか。|ええ、開けて あげません。','Permintaan izin ditanggapi dengan persetujuan.',[10]],
 ['A: 駅まで 送って くださって、ありがとうございました。','いいえ、また いつでも 言って ください。|はい、送って ください。|どうぞ、ありがとう ございましたか。','Tanggapan wajar atas ucapan terima kasih menerima dan menawarkan bantuan lain.',[18,24]],
 ['A: この 漢字、どう 読むか 分かりますか。','すみません。わたしも 分からないんです。|はい、どこに 書きますか。|いいえ、読みやすかったです。','Menjawab ketidaktahuan sesuai pertanyaan tentang cara baca.',[2,19]],
 ['A: あしたまでに 終わりそうですか。','あと 少しなので、大丈夫だと 思います。|あしたまで どこですか。|終わったら そうです。','あと少し memberikan dasar perkiraan selesai sebelum tenggat.',[3,11]],
 ['A: その 本、読み終わったら 貸して もらえませんか。','いいですよ。来週 持って 来ますね。|いいですよ。借りて もらいます。|いいですよ。読むなと 言いました。','Permintaan meminjam setelah selesai dibaca ditanggapi janji membawa buku.',[8,18]],
 ['A: 先生は もう お帰りに なりましたか。','いいえ、まだ 職員室に いらっしゃいます。|いいえ、先生に 帰って まいりました。|いいえ、先生を お帰りします。','いらっしゃいます menyatakan keberadaan guru secara hormat.',[23]],
 ['A: どうしたんですか。元気が ありませんね。','きのう あまり 眠れなかったんです。|はい、元気が ありませんか。|きのう 眠らせて ください。','Pertanyaan meminta penjelasan keadaan, dijawab alasan kurang tidur.',[2,4]],
 ['A: 荷物を ここに 置いたままで いいですか。','はい、わたしが 見て いますから。|はい、もう 置きませんでした。|はい、わたしが 置いて ください。','Izin membiarkan barang dijawab dengan jaminan menjaganya.',[20]],
 ].forEach(([s,o,e,c])=>listening('quick_response',s,'いちばん いい へんじを えらんで ください。',o,e,c));
}
