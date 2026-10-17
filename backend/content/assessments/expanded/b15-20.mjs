import {q,listen,spoken} from '../jlpt/helpers.mjs';

// Original additions. Helpers keep the correct choice first; each reason follows
// its authored option. The compiler rotates choices and reasons together.
const item = (raw,itemType,...distractors) => ({...raw,itemType,reasons:[raw.explanation,...distractors]});

export default {
15:{
vocabulary:[
item(q('ラジオで ニュースを <u>聞きます</u>。',['ききます','かきます','いいます','かいます'],'聞きます dibaca ききます: mendengarkan berita melalui radio.',1),'kanji_reading','かきます berarti menulis, bukan bacaan 聞きます.','いいます adalah bacaan 言います, bukan 聞きます.','かいます adalah bacaan 買います, bukan 聞きます.'),
item(q('みせの ひと「パンは 200えん、ぎゅうにゅうは 150えんです。（　）で 350えんに なります。」',['ごうけい','おつり','おなまえ','おくに'],'ごうけい menyebut total harga dua barang, yaitu 350 yen.',2),'context_vocabulary','おつり adalah kembalian; belum ada uang pembayaran pada dialog.','おなまえ menyebut nama orang, bukan jumlah harga.','おくに menyebut negara, bukan total belanja.'),
item(q('みせの ひと「おまちください。」と おなじ いみは どれですか。',['まってください。','はいってください。','かえってください。','よんでください。'],'おまちください adalah permintaan sopan untuk menunggu, sama dengan まってください.',1),'paraphrase','はいってください meminta masuk, bukan menunggu.','かえってください meminta pulang, bukan menunggu.','よんでください meminta membaca atau memanggil, bukan menunggu.'),
],
listening:[
listen('N: きゃくは なにを ふたつ かいますか。\nA: パンを ふたつと おちゃを ひとつ おねがいします。\nB: すみません。パンは ひとつです。おにぎりは あります。\nA: では、パンは いりません。おにぎりを ふたつと おちゃを ひとつ おねがいします。\nN: きゃくは なにを ふたつ かいますか。',item(q('きゃくは なにを ふたつ かいますか。',['おにぎり','パン','おちゃ','おにぎりと パン'],'Pesanan terakhir mengganti dua roti dengan dua onigiri; teh tetap satu.',1),'key_points','Dua roti adalah pesanan awal yang dibatalkan dengan パンはいりません.','Teh dipesan satu, bukan dua.','Pelanggan menolak roti; tidak membeli kombinasi onigiri dan roti.')),
item(spoken('A: ジュースは いかがですか。',['はい、ひとつ おねがいします。','はい、ジュースは いかがですか。','はい、ひとつの おつりです。'],'はい、ひとつおねがいします menerima tawaran jus dengan satu pesanan.',1),'quick_response','Mengulang tawaran tidak menjawab apakah pembicara menerima jus.','おつり menyebut kembalian uang dan tidak sesuai respons terhadap tawaran minuman.'),
],
},
16:{
vocabulary:[
item(q('<u>水曜日</u>に じしょを かえします。',['すいようび','もくようび','かようび','にちようび'],'水曜日 dibaca すいようび, hari Rabu.',1),'kanji_reading','もくようび adalah 木曜日, hari Kamis.','かようび adalah 火曜日, hari Selasa.','にちようび adalah 日曜日, hari Minggu.'),
item(q('きょうは かようびです。あしたは すいようびです。（　）は もくようびです。',['あさって','きのう','きょう','おととい'],'あさって adalah lusa: dua hari sesudah Selasa ialah Kamis.',2),'context_vocabulary','きのう adalah sehari sebelum Selasa, yaitu Senin.','きょう adalah Selasa sesuai kalimat pertama.','おととい adalah dua hari sebelum Selasa, yaitu Minggu.'),
item(q('ことしも きょねんも おととしも、８がつに くにへ かえりました。いつも １ねんに １かいです。（　）８がつに かえります。',['まいとし','まいつき','まいしゅう','まいにち'],'Pengulangan satu kali setiap tahun pada Agustus dinyatakan dengan まいとし.',3),'context_vocabulary','まいつき berarti setiap bulan dan bertentangan dengan satu kali per tahun.','まいしゅう berarti setiap minggu, bukan satu kali setahun.','まいにち berarti setiap hari, bukan pengulangan tahunan.'),
],
listening:[
listen('N: Aさんは どの ようびに まいしゅう はたらきますか。\nA: みせで まいしゅう すいようびと きんようびに はたらきます。\nB: こんしゅうの どようびも はたらきますか。\nA: はい。どようびは こんしゅうだけです。\nN: Aさんは どの ようびに まいしゅう はたらきますか。',item(q('Aさんは どの ようびに まいしゅう はたらきますか。',['すいようびと きんようび','きんようびと どようび','すいようびと どようび','すいようびと きんようびと どようび'],'Rabu dan Jumat adalah jadwal setiap minggu; Sabtu hanya tambahan minggu ini.',3),'key_points','Pilihan ini menghilangkan Rabu yang rutin dan memasukkan Sabtu yang hanya sekali.','Pilihan ini menghilangkan Jumat yang rutin dan memasukkan Sabtu yang hanya sekali.','Sabtu dinyatakan こんしゅうだけ, sehingga tidak termasuk jadwal setiap minggu.')),
item(spoken('A: テストは ６がつですか、７がつですか。',['７がつです。','なのかです。','しちじです。'],'Pertanyaan membandingkan dua bulan; ７がつ adalah jawaban dalam satuan bulan.',1),'quick_response','なのか adalah tanggal tujuh, bukan bulan yang ditanyakan.','しちじ adalah pukul tujuh, bukan bulan ujian.'),
],
},
17:{
vocabulary:[
item(q('いもうとは <u>手</u>を あらっています。',['て','あし','くち','め'],'手 dibaca て, tangan yang sedang dicuci.',1),'kanji_reading','あし adalah bacaan 足, bukan 手.','くち adalah bacaan 口, bukan 手.','め adalah bacaan 目, bukan 手.'),
item(q('りょうりの ほんを よみます。まいにち うちで ごはんを つくります。わたしの しゅみは（　）です。',['りょうり','スポーツ','おんがく','りょこう'],'Membaca buku masak dan membuat makanan mendukung hobi りょうり.',3),'context_vocabulary','スポーツ tidak sesuai kegiatan membaca buku masak dan membuat makanan.','おんがく berkaitan dengan musik; tidak ada kegiatan musik dalam konteks.','りょこう adalah perjalanan, bukan kegiatan memasak di rumah.'),
item(q('「ギターは できます。ピアノは できません。」と おなじ いみは どれですか。',['ピアノは できません。ギターが できます。','ギターも ピアノも できます。','ピアノが できます。ギターは できません。','ギターも ピアノも できません。'],'Pilihan pertama mempertahankan kemampuan gitar dan ketidakmampuan piano meski urutan informasinya berbeda.',2),'paraphrase','Menyatakan kedua alat bisa dimainkan bertentangan dengan ピアノはできません.','Pilihan ini membalik alat yang bisa dan tidak bisa dimainkan.','Menyatakan keduanya tidak bisa bertentangan dengan ギターはできます.'),
],
listening:[
listen('N: Bさんは なにが できますか。\nA: りょうりが すきですか。\nB: はい。りょうりは すきです。あまり じょうずじゃありません。ピアノは できます。\nA: スポーツは どうですか。\nB: サッカーが すきです。サッカーは できません。りょうりも できません。\nN: Bさんは なにが できますか。',item(q('Bさんは なにが できますか。',['ピアノ','りょうり','サッカー','りょうりと サッカー'],'Hanya piano yang dinyatakan bisa; memasak dan sepak bola disukai tetapi tidak bisa.',2),'key_points','B menyukai memasak namun pada akhir dialog tegas menyatakan りょうりもできません.','B menyukai sepak bola namun mengatakan サッカーはできません.','Kedua kegiatan dalam pilihan ini justru dinyatakan tidak bisa.')),
item(spoken('A: どんな ほんが すきですか。',['りょうりの ほんです。','としょかんで よみます。','まいにち よみます。'],'りょうりのほん menyebut jenis buku dan menjawab どんなほん.',3),'quick_response','としょかんでよみます memberi tempat membaca, bukan jenis buku.','まいにちよみます memberi frekuensi membaca, bukan jenis buku.'),
],
},
18:{
vocabulary:[
item(q('この えんぴつは <u>長い</u>です。',['ながい','たかい','やすい','おもい'],'長い dibaca ながい, sifat panjang pada pensil.',1),'kanji_reading','たかい adalah bacaan 高い, bukan 長い.','やすい adalah bacaan 安い, bukan 長い.','おもい berarti berat dan bukan bacaan 長い.'),
item(q('この ほんは 100えんです。あの ほんは 300えんです。ねだんは この ほんの ほうが（　）です。',['やすい','たかい','おもい','ながい'],'Harga 100 yen lebih murah daripada 300 yen; kriterianya secara jelas ねだん.',1),'context_vocabulary','たかい membalik perbandingan karena 100 yen lebih rendah daripada 300 yen.','おもい membandingkan berat, sedangkan konteks hanya memberikan harga.','ながい membandingkan panjang atau durasi, sedangkan konteks memberikan harga.'),
item(q('「この みちより あの みちの ほうが ながいです。」と おなじ いみは どれですか。',['この みちは あの みちより みじかいです。','あの みちは この みちより みじかいです。','ふたつの みちは おなじ ながさです。','この みちは あの みちより ながいです。'],'Jika jalan itu lebih panjang, jalan ini lebih pendek; arah perbandingan tetap sama.',2),'paraphrase','Pilihan ini membalik jalan yang lebih pendek.','Panjang yang sama bertentangan dengan pernyataan lebih panjang.','Pilihan ini membalik jalan yang lebih panjang.'),
],
listening:[
listen('N: Aさんは どの りんごに しますか。\nB: あかい りんごは ひとつ 150えんです。あおい りんごは ひとつ 100えんです。\nA: きいろい りんごは いくらですか。\nB: ひとつ 120えんです。\nA: ねだんが いちばん やすい りんごに します。\nN: Aさんは どの りんごに しますか。',item(q('Aさんは どの りんごに しますか。',['あおい りんご','あかい りんご','きいろい りんご','あかい りんごと きいろい りんご'],'A memilih berdasarkan harga terendah per buah; apel hijau 100 yen lebih murah daripada 120 dan 150 yen.',3),'task_comprehension','Apel merah 150 yen adalah yang termahal, sedangkan A meminta yang termurah.','Apel kuning 120 yen masih lebih mahal daripada apel hijau 100 yen.','A memilih jenis yang paling murah, bukan dua jenis yang lebih mahal.')),
item(spoken('A: この へやと あの へやと、どちらが おおきいですか。',['あの へやの ほうが おおきいです。','あの へやは ２かいです。','あの へやは みっつです。'],'Respons pertama membandingkan ukuran dua kamar sesuai pertanyaan どちらがおおきいですか.',2),'quick_response','２かい memberi lantai tempat kamar, bukan perbandingan ukurannya.','みっつ memberi jumlah kamar, bukan kamar mana yang lebih besar.'),
],
},
19:{
vocabulary:[
item(q('しゅうまつに ともだちに <u>会います</u>。',['あいます','かいます','いいます','のみます'],'会います dibaca あいます, bertemu teman pada akhir pekan.',2),'kanji_reading','かいます adalah bacaan 買います, bukan 会います.','いいます adalah bacaan 言います, bukan 会います.','のみます adalah bacaan 飲みます, bukan 会います.'),
item(q('A「たんじょうびに なにが（　）ですか。」B「あたらしい とけいが ほしいです。」',['ほしい','じょうず','いそがしい','ひま'],'Jawaban menyatakan benda yang diinginkan, sehingga pertanyaan memakai なにがほしいですか.',1),'context_vocabulary','じょうず menanyakan kemahiran, bukan benda hadiah yang diinginkan.','いそがしい menyatakan kesibukan dan tidak cocok dengan なにが serta jawaban tentang jam tangan.','ひま menyatakan waktu luang, bukan keinginan memiliki barang.'),
item(q('「あしたは うちで やすむ つもりです。」と おなじ いみは どれですか。',['あしたは うちで やすむ よていです。','きのうは うちで やすみました。','あしたは うちへ かえりたくないです。','まいにち うちで やすんでいます。'],'Kedua kalimat menyampaikan rencana istirahat di rumah besok; waktu dan tindakannya tetap.',2),'paraphrase','Pilihan ini melaporkan kejadian kemarin, bukan rencana besok.','Tidak ingin pulang besok berbeda dari berencana istirahat di rumah.','Kebiasaan setiap hari tidak mempertahankan rencana khusus besok.'),
],
listening:[
listen('N: Bさんは にちようびの ごぜん なにを しますか。\nA: にちようび、いっしょに かいものに いきませんか。\nB: ごぜんは うちを そうじする よていです。ごごは ひまです。\nA: では、ごご いきましょう。\nB: はい。そうじを してから、いきます。\nN: Bさんは にちようびの ごぜん なにを しますか。',item(q('Bさんは にちようびの ごぜん なにを しますか。',['うちを そうじします','かいものに いきます','ともだちの うちへ いきます','うちで ひるごはんを つくります'],'Rencana pagi B adalah membersihkan rumah; belanja disepakati sesudahnya pada sore hari.',2),'key_points','Belanja dipindahkan ke sore karena pagi B sudah memiliki rencana membersihkan rumah.','Tidak ada rencana mengunjungi rumah teman dalam percakapan.','Membuat makan siang tidak disebut; kegiatan pagi yang disebut ialah bersih-bersih.')),
item(spoken('A: いっしょに ひるごはんを たべませんか。',['いいですね。たべましょう。','いいですね。たべませんでした。','いいですね。たべてはいけません。'],'いいですね。たべましょう menerima ajakan makan siang bersama.',3),'quick_response','たべませんでした melaporkan tidak makan pada masa lampau dan tidak menerima ajakan sekarang.','たべてはいけません menyatakan larangan makan dan bertentangan dengan penerimaan いいですね.'),
],
},
20:{
vocabulary:[
item(q('この ほんを <u>読みます</u>。',['よみます','のみます','かきます','いきます'],'読みます dibaca よみます, membaca buku.',1),'kanji_reading','のみます adalah bacaan 飲みます, bukan 読みます.','かきます adalah bacaan 書きます, bukan 読みます.','いきます adalah bacaan 行きます, bukan 読みます.'),
item(q('ピアノが すきです。（　）、ピアノは できません。',['でも','それから','だから','そしてから'],'でも menunjukkan pertentangan antara menyukai piano dan belum mampu memainkannya.',3),'context_vocabulary','それから menunjukkan urutan kegiatan; kalimat ini membandingkan selera dan kemampuan.','だから menyatakan akibat; tidak bisa piano bukan akibat logis dari menyukainya pada konteks ini.','そしてから bukan penghubung yang tepat untuk menyatakan pertentangan ini.'),
item(q('「この えいがは いちども みたことが ありません。」と おなじ いみは どれですか。',['この えいがは まだ みていません。','この えいがを いちど みました。','この えいがを まいとし みます。','この えいがは もう みました。'],'いちどもみたことがありません dan まだみていません sama-sama menyatakan film tersebut belum pernah ditonton sampai saat ini.',1),'paraphrase','いちどみました menyatakan sudah menonton satu kali, bertentangan dengan belum pernah.','まいとしみます menyatakan kebiasaan menonton setiap tahun, bukan belum pernah.','もうみました menyatakan film sudah ditonton, bertentangan dengan kalimat sumber.'),
],
listening:[
listen('N: Aさんは どうして バスで いきますか。\nA: がっこうまで あるいて いきますか。\nB: きょうは あめですから、バスで いきましょう。\nA: バスは たかいですね。でも、ぬれたくないです。バスに しましょう。\nN: Aさんは どうして バスで いきますか。',item(q('Aさんは どうして バスで いきますか。',['あめで ぬれたくないですから','バスが やすいですから','あしが いたいですから','バスに のったことが ありませんから'],'A menyetujui bus karena hujan dan tidak ingin basah, meskipun ongkosnya mahal.',2),'key_points','A justru menyebut ongkos bus mahal; murah bukan alasannya.','Tidak ada pernyataan kaki sakit dalam dialog.','Tidak ada pernyataan bahwa A belum pernah naik bus; alasan yang disebut ialah menghindari basah.')),
item(spoken('A: この みせで たべたことが ありますか。',['はい、いちど あります。','はい、あした たべたいです。','はい、ここで たべないでください。'],'はい、いちどあります menjawab pengalaman makan di toko itu dengan afirmatif satu kali.',1),'quick_response','Keinginan makan besok tidak menjawab apakah pembicara pernah makan di sana.','Permintaan agar tidak makan di sini tidak menjawab pertanyaan pengalaman.'),
],
},
};
