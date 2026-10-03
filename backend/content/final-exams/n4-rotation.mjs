// Independently authored alternatives. No official questions or recordings reproduced.
export function vocabulary({q}) {
 [
 ['kanji_reading','この 辺りは 夜も【安全】です。','あんぜん|あんせん|あぜん|あんねん','安全 dibaca あんぜん, aman.',10],
 ['orthography','駅に【きゅうこう】が 止まります。','急行|旅行|銀行|実行','きゅうこう ditulis 急行, kereta ekspres.',19],
 ['context_vocabulary','大切な 約束なので、（　）忘れないで ください。','絶対に|ほとんど|たいてい|だんだん','絶対に + negatif menegaskan jangan sampai lupa pada janji penting.',20],
 ['context_vocabulary','コップを 落として（　）しまいました。小さい ガラスが 床に あります。','割って|折って|破って|切って','Gelas kaca yang pecah memakai 割る, bukan 折る atau 破る.',6,7],
 ['paraphrase','「この 道具は 役に立ちます。」に 近い いみは どれですか。','この 道具は 使うと 便利です。|この 道具は すぐ 壊れます。|この 道具は 立てて 使います。|この 道具は 使っては いけません。','役に立つ berarti berguna, bukan berdiri secara fisik.',9],
 ['usage','【慣れる】の 使い方が ただしい ぶんは どれですか。','新しい 仕事に 少し 慣れました。|道を 慣れて 駅へ 行きます。|お金を 慣れて 払いました。|窓を 慣れて 空気を 入れます。','仕事に慣れる berarti mulai terbiasa dengan pekerjaan.',5],
 ].forEach(([type,p,o,e,...c])=>q(type,p,o,e,c));
}
export function textA({text}) {
 const p='先月、会社の 近くへ 引っこしました。前は 通うのに 一時間 かかって いましたが、今は 歩いて 十分です。朝の 時間が 長く 使える（①）ので、毎日 朝ごはんを 作って います。初めは 料理が 心配でした。（②）、簡単な 物から 作って みると、思ったより 楽しかったです。きのうは 隣の 人が 野菜を 分けて（③）。その 野菜で スープを 作りました。これからも 健康の ために、自分で 作る ことに（④）。';
 text(p,'①','ように なった|ことが した|ために あった|そうに した','Perubahan keadaan dinyatakan 使えるようになった.',[4,5]);
 text(p,'②','でも|だから|それで|それなのにので','でも menghubungkan kekhawatiran awal dengan pengalaman memasak yang menyenangkan.',[10]);
 text(p,'③','くれました|あげました|もらいました|やりました','隣の人が menjadi pemberi kepada pembicara: 分けてくれました.',[18]);
 text(p,'④','しました|なりましたか|ありません|できませんか','ことにしました menyatakan keputusan pembicara untuk terus memasak.',[5]);
}
export function textB({text}) {
 const p='わたしは 先週から 図書館で ボランティアを して います。初めて 行った 日は、返された 本を 棚に 戻す 仕事を（①）。本の 場所が 分からず 困って いると、先輩が 説明して くれました。次は 自分で できる（②）、メモを 取りました。仕事が 終わった 後、先輩に「分からない ときは、いつでも 聞いて（③）」と 言われて、安心しました。まだ 慣れて いませんが、少しずつ できる ことを 増やして（④）と 思います。';
 text(p,'①','しました|して ください|しましょうか|するな','初めて行った日 menjelaskan pengalaman yang sudah terjadi: しました.',[3]);
 text(p,'②','ように|ためで|ことが|そうな','Agar mampu sendiri berikutnya: できるように.',[15]);
 text(p,'③','ください|あげます|みました|しまいました','Senior mempersilakan bertanya: 聞いてください.',[18]);
 text(p,'④','いこう|いった|いっては|いきなさい','増やしていこうと思います menyatakan niat untuk terus menambah kemampuan.',[5,20]);
}
export function readingB({reading}) {
 reading('short_reading','【自転車置き場から】\n来週の 月曜日は 工事の ため、いつもの 場所が 使えません。その 日だけ、建物の 裏に 自転車を 置いて ください。火曜日からは 元の 場所を 使えます。入口の 前には 置かないで ください。','来週の 月曜日は どこに 自転車を 置きますか。','建物の 裏|いつもの 場所|入口の 前|建物の 中','Khusus Senin tempat parkir dipindahkan ke belakang gedung.',[3,10]);
 reading('short_reading','リーさんへ\n金曜日に 借りる 約束を した カメラですが、急に 仕事で 使う ことに なりました。土曜日の 朝なら お渡しできます。予定が 変わって すみません。都合が 悪ければ、今夜 電話して ください。\n木村','木村さんは 何を 伝えたいですか。','カメラを 渡せる 日が 変わった こと。|カメラが 壊れて しまった こと。|土曜日の 約束を 忘れた こと。|今夜 カメラを 返して ほしい こと。','Perubahan jadwal peminjaman dari Jumat ke Sabtu menjadi inti pesan.',[5,14]);
 reading('short_reading','先週から、昼休みに 十五分ほど 歩く ように して います。前は ずっと 机に 座って いたので、午後に 眠くなる ことが ありました。今は 歩いてから 仕事を 始めると、気持ちよく 働けます。雨の 日は 建物の 中の 階段を 使って います。','この 人は 歩く ように なって、どう なりましたか。','午後の 仕事が しやすく なりました。|昼休みが 長く なりました。|雨の 日は 仕事を 休む ように なりました。|仕事を 始める 時間が 遅く なりました。','Berjalan saat istirahat membantu bekerja dengan lebih nyaman pada siang hari.',[5,9]);
 const p='わたしの 町には、小さい 映画館が あります。新しい 映画は あまり 見られませんが、昔の 映画を 安く 見る ことが できます。先月、友だちに 誘われて 初めて 行きました。席は 少ないし、建物も 古いので、初めは あまり 期待して いませんでした。ところが、映画が 終わると、店の 人が その 映画について 話して くれました。ほかの お客さんの 感想も 聞けて、自分では 気づかなかった ことが 分かりました。家で 一人で 見るのとは 違う 楽しさが ありました。それから 毎月 一度、この 映画館に 通って います。今度は 妹も 連れて 行く つもりです。';
 reading('medium_reading',p,'初めて この 映画館に 行ったのは なぜですか。','友だちに 誘われたから。|新しい 映画しか 見られないから。|妹が 働いて いるから。|建物が 新しかったから。','Pemicu kunjungan pertama adalah ajakan teman.',[21]);
 reading('medium_reading',p,'「違う 楽しさ」と ありますが、どんな 楽しさですか。','映画について ほかの 人の 話を 聞ける こと。|一人で 大きい 席を 使える こと。|映画を 無料で 見られる こと。|映画の 途中で 自由に 話せる こと。','Diskusi setelah film memberi pemahaman baru melalui pendapat orang lain.',[18,19]);
 reading('medium_reading',p,'この 人は この 映画館について、今 どう 思って いますか。','これからも 通いたいと 思って います。|建物が 古いので、もう 行かないと 思って います。|妹だけ 行けば いいと 思って います。|新しい 映画が 始まるまで 待とうと 思って います。','Kunjungan bulanan dan rencana mengajak adik menunjukkan keinginan terus datang.',[5]);
 const info='【市民センター 週末教室】\n料理：土曜 10:00〜12:00／1回 1,500円／材料費込み／エプロンを 持参\n写真：土曜 14:00〜16:00／1回 1,000円／カメラを 持参\n絵：日曜 10:00〜12:00／1回 800円／道具代 200円が 別に 必要\n申込方法：教室の 二日前までに ウェブサイトで 申し込んで ください。\n電話での 質問は できますが、申し込みは できません。';
 reading('information_retrieval',info,'日曜日の 絵の 教室に 初めて 参加します。道具も 使います。全部で いくら 払いますか。','1,000円|800円|1,200円|1,500円','Biaya kelas 800 yen ditambah alat 200 yen, total 1.000 yen.',[19]);
 reading('information_retrieval',info,'土曜日の 料理の 教室に 参加したいです。どうすれば いいですか。','木曜日までに ウェブで 申し込み、エプロンを 持って 行く。|金曜日に 電話で 申し込み、カメラを 持って 行く。|土曜日に 直接 行き、材料を 買う。|木曜日までに 電話で 申し込み、道具代を 払う。','Dua hari sebelum Sabtu ialah Kamis, pendaftaran via web, perlengkapan kelas masak adalah celemek.',[3,16,19]);
}
export function listeningB({listening}) {
 [
 ['A: あしたの 旅行、切符は わたしが 買って おきますね。\nB: ありがとう。ホテルには もう 連絡しました。\nA: では、わたしは 駅へ 行って きます。','Aさんは これから 何を しますか。','切符を 買う。|ホテルに 電話する。|荷物を 送る。|ホテルへ 行く。','A bertugas membeli tiket; menghubungi hotel sudah selesai.',[7]],
 ['A: 先生、作文は メールで 送れば いいですか。\nB: ええ。でも 送る 前に、ファイルの 名前に 学生番号を 入れて ください。名前だけでは 分かりにくいので。','Aさんは 作文を 送る 前に 何を しますか。','ファイルの 名前に 学生番号を 入れる。|作文を 紙に 印刷する。|メールの アドレスを 変える。|先生に 学生番号を 聞く。','Guru meminta nomor mahasiswa dimasukkan pada nama berkas sebelum dikirim.',[3,9]],
 ['A: 夕食の 準備を 手伝いましょうか。\nB: じゃあ、野菜を 洗って ください。切るのは わたしが やります。\nA: お米は どうしますか。\nB: もう 炊いて あります。','Aさんは 何を しますか。','野菜を 洗う。|野菜を 切る。|お米を 炊く。|お皿を 買う。','Pembagian tugas: A mencuci sayur, B memotongnya; nasi sudah dimasak.',[7,18]],
 ['A: 荷物が 多いですね。全部 二階に 運びますか。\nB: 本の 箱だけ お願いします。服の 箱は 一階に 置いて おいて ください。','Aさんは 二階へ 何を 運びますか。','本の 箱だけ|服の 箱だけ|本と 服の 箱|空の 箱だけ','Hanya kotak buku yang dibawa ke lantai dua, pakaian ditinggal di lantai satu.',[7]],
 ['A: 来週の アルバイト、月曜日を 休ませて いただけませんか。\nB: いいですよ。その 代わり、火曜日に 来られますか。\nA: はい、大丈夫です。','Aさんは 来週 どうしますか。','月曜日は 休んで、火曜日に 働く。|月曜日も 火曜日も 休む。|月曜日も 火曜日も 働く。|月曜日に 働いて、火曜日は 休む。','Izin libur Senin diberikan dengan pengganti bekerja Selasa.',[4,22,24]],
 ['A: 雨が 強く なって きましたね。迎えに 行きましょうか。\nB: お願いします。今 駅の 東口に います。\nA: 東口は 車が 止められないので、西口で 待って いて ください。','Bさんは これから どこで 待ちますか。','駅の 西口|駅の 東口|家の 前|バスの 中','B diminta berpindah menunggu ke pintu barat karena mobil tak dapat berhenti di timur.',[4,20]],
 ['A: ポスターを 作りました。これで 印刷しても いいですか。\nB: 文字を もう 少し 大きく して ください。写真と 色は このままで いいです。','Aさんは ポスターの 何を 変えますか。','文字の 大きさ|写真の 数|背景の 色|紙の 厚さ','Hanya ukuran huruf diminta diperbesar; foto dan warna tetap.',[9,20]],
 ['A: 借りて いた 本を 返しに 来たんですが、図書館が 閉まって います。\nB: 入口の 横に 箱が ありますから、そこに 入れて ください。CDは 入れられませんが、本なら 大丈夫です。','Aさんは 本を どうしますか。','入口の 横の 箱に 入れる。|家へ 持って 帰る。|CDと 一緒に 店へ 送る。|受付の 人が 来るまで 待つ。','Kotak pengembalian menerima buku walaupun perpustakaan sedang tutup.',[4,14]],
 ].forEach(([s,p,o,e,c])=>listening('task_comprehension',s,p,o,e,c));
 [
 ['A: どうして その アパートに 決めたんですか。\nB: 駅からは 少し 遠いですが、家賃が 安いし、広いので。前の 部屋は 荷物を 置く 場所が なかったんです。','Bさんが アパートを 選んだ 理由は 何ですか。','安くて 広いから。|駅から 近いから。|荷物を 借りられるから。|前より 小さいから。','Alasan memilih apartemen adalah murah dan luas, meskipun jauh dari stasiun.',[10]],
 ['A: 試験の 結果は どうでしたか。\nB: 読む 問題は よく できたんですが、聞く 問題は 時間が 足りなくて。今度は 音声を たくさん 聞いて 練習しようと 思います。','Bさんは これから 何を 中心に 練習しますか。','聞く こと|読む こと|漢字を 書く こと|長い 文を 作る こと','Rencana perbaikan dinyatakan secara eksplisit sebagai latihan mendengar audio.',[5]],
 ['A: きのうの パーティーは 楽しかったですか。\nB: ええ。料理も よかったですが、久しぶりに 学生の ときの 友だちに 会えたのが 一番 うれしかったです。','Bさんが 一番 うれしかったのは 何ですか。','昔の 友だちに 会えた こと。|料理を 作れた こと。|新しい 学校に 入れた こと。|初めて パーティーを 開けた こと。','Hal paling menyenangkan ialah bertemu teman dari masa sekolah.',[4]],
 ['A: その 自転車、買ったんですか。\nB: いいえ、引っこす 友だちが くれました。ブレーキが 壊れて いたので、店で 直して もらったんです。','Bさんは 自転車を どうしましたか。','もらってから、店で 修理して もらった。|買ってから、友だちに あげた。|借りてから、自分で 直した。|直さないで、友だちに 返した。','Sepeda adalah pemberian teman, lalu rem diperbaiki oleh toko.',[7,17,18]],
 ['A: 旅行は 来月でしたね。\nB: ええ、三日から 五日までの 予定でしたが、仕事が 入って、四日から 六日までに しました。','Bさんは いつから 旅行しますか。','四日|三日|五日|六日','Tanggal keberangkatan diubah dari tanggal tiga ke empat.',[3,5]],
 ['A: 新しい 店で 食事を したんですね。どうでしたか。\nB: 味は よかったんですが、注文してから 料理が 来るまで 一時間も 待ったんです。次は 時間が ある ときに 行きます。','Bさんは 何が 残念でしたか。','料理が 来るのが 遅かった こと。|料理が おいしくなかった こと。|注文できなかった こと。|店が 早く 閉まった こと。','Yang dikeluhkan adalah waktu tunggu satu jam, bukan rasa makanan.',[3,8]],
 ['A: 週末は いつも テニスですか。\nB: 前は そうでしたが、最近は 山を 歩いて います。友だちに 誘われて 始めたら、気持ちが よくて。','Bさんは 最近 週末に 何を して いますか。','山を 歩く。|テニスを する。|家で 休む。|友だちに 勉強を 教える。','Kebiasaan terbaru ialah berjalan di gunung; tenis adalah kegiatan sebelumnya.',[5,13]],
 ].forEach(([s,p,o,e,c])=>listening('key_points',s,p,o,e,c));
 [
 ['N: Aさんは 借りて いた 本を ぬらして しまいました。友だちに 同じ 本を 買って 返したいと 伝えます。何と 言いますか。','同じ 本を 買って お返ししても いいですか。|同じ 本を 買って くださいましたか。|同じ 本を 貸して いただきました。','A meminta izin mengganti buku yang dirusaknya: 買ってお返ししてもいいですか.',[6,24],'book'],
 ['N: Aさんは 重い 箱を 持とうと して いる 友だちを 見ました。一緒に 運ぶ ことを 提案します。何と 言いますか。','重そうですね。一緒に 運びましょうか。|重いですね。一人で 運ばせて くださいました。|重そうですね。持って 来たそうです。','Tawaran membantu membawa memakai 運びましょうか, dengan dugaan 重そう.',[11,18],'box'],
 ['N: Aさんは お客様を 部屋へ 案内します。ドアを 開けて、先に 入って もらいたいです。何と 言いますか。','どうぞ、お先に お入りください。|どうぞ、先に 入って まいりました。|どうぞ、先に 入らせて いただきます。','Meminta tamu masuk lebih dahulu memakai bentuk hormat お入りください.',[23,24],'door'],
 ['N: Aさんは 電話を しています。相手の 声が 小さくて 聞こえません。丁寧に お願いします。何と 言いますか。','もう 少し 大きな 声で お話しいただけますか。|もう 少し 大きな 声で お話しして あげます。|もう 少し 大きな 声で お話しに なりました。','Meminta tindakan lawan bicara secara sopan menggunakan お話しいただけますか.',[18,24],'phone'],
 ['N: お客様が 帰った 後、Aさんは かばんを 見つけました。電話で お客様に 確かめます。何と 言いますか。','かばんを お忘れでは ありませんか。|かばんを お持ちして あげました。|かばんを お忘れに いただきますか。','Pertanyaan konfirmasi barang tertinggal: かばんをお忘れではありませんか.',[23,24],'bag'],
 ].forEach(([s,o,e,c,scene])=>listening('verbal_expression',s,'何と 言いますか。',o,e,c,scene));
 [
 ['A: もう この パソコンを 使っても よろしいですか。','はい、仕事は 終わりましたから、どうぞ。|はい、まだ 使って もらいましたか。|はい、パソコンへ 行って ください。','Permintaan izin dijawab dengan mempersilakan karena pekerjaan telah selesai.',[24]],
 ['A: わたしの 代わりに 受付を して もらえませんか。','分かりました。何時からですか。|受付に 行って もらいました。|受付が 代わりに なりました。','Persetujuan diikuti pertanyaan waktu sesuai permintaan menggantikan tugas.',[18]],
 ['A: この 道を まっすぐ 行けば、駅に 着きますか。','ええ、十分ぐらいで 着きますよ。|ええ、駅を まっすぐ 買います。|ええ、駅に 行かなかったからです。','Pertanyaan rute ditanggapi konfirmasi dan perkiraan lama perjalanan.',[14]],
 ['A: 先生に この 写真を 見て いただきたいんですが。','先生は 今 会議中なので、少し お待ちください。|先生が 写真を いただきましたか。|写真を 見る つもりでしたね、先生に。','Menanggapi keinginan bertemu guru dengan menjelaskan beliau sedang rapat.',[18,24]],
 ['A: せっかく 作ったのに、食べないんですか。','ごめんなさい。今 おなかが いっぱいなんです。|食べて くれて、ごめんなさい。|せっかく 食べなかったら いいですね。','Permintaan penjelasan dijawab alasan kenyang disertai permintaan maaf.',[2,10]],
 ['A: 最近、早く 起きる ように して いるんです。','そうですか。何時ごろ 起きるんですか。|早く 起きた ように 買いました。|最近は 何時を 起こしましたか。','Pertanyaan lanjutan jam bangun sesuai topik kebiasaan baru.',[5]],
 ['A: すみません、ここに 座っても かまいませんか。','そこは 人が 来ますので、隣の 席へ どうぞ。|かまいませんでしたから、座りましたか。|座って いる とおりに 来ます。','Tempat tersebut sudah untuk orang lain; tanggapan mengarahkan ke kursi sebelah.',[10]],
 ['A: 遅く なって しまって、申し訳ありません。','大丈夫ですよ。まだ 始まって いませんから。|申し訳なくて、遅れて ください。|いいえ、遅く して もらいましたか。','Permintaan maaf atas keterlambatan ditanggapi dengan meyakinkan acara belum mulai.',[6,24]],
 ].forEach(([s,o,e,c])=>listening('quick_response',s,'いちばん いい へんじを えらんで ください。',o,e,c));
}
