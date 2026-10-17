// Original additions. Each authored option list is correct-first; the compiler
// rotates the key and its explicit rationale together. Historical banks stay intact.
import {q,listen,spoken} from '../jlpt/helpers.mjs';

const item=(itemType,raw,wrongReasons)=>({
  ...raw,itemType,reasons:[raw.explanation,...wrongReasons],
});

export default {
4:{
  vocabulary:[
    item('kanji_reading',q('Kartu kelas: せんせいの <u>本</u>。Pilih bacaannya.',['ほん','はな','ひと','くに'],'本 dibaca ほん; kartu tersebut menyebut buku guru.',2),['はな adalah bacaan 花, bukan 本.','ひと adalah bacaan 人, bukan 本.','くに adalah bacaan 国, bukan 本.']),
    item('orthography',q('Label pada kartu bunga: <u>はな</u>。Pilih kanji yang sesuai.',['花','魚','本','人'],'はな ditulis 花.',2),['魚 dibaca さかな, bukan はな.','本 dibaca ほん, bukan はな.','人 dibaca ひと, bukan はな.']),
    item('context_vocabulary',q('Kartu inventaris: alat tulis dengan isi grafit, bukan tinta. これは（　）です。',['えんぴつ','ボールペン','かさ','かばん'],'Alat tulis berisi grafit adalah pensil, えんぴつ.',2),['ボールペン memakai tinta; kartu secara eksplisit mengecualikan tinta.','かさ adalah payung, bukan alat tulis.','かばん adalah tas, bukan alat tulis.']),
  ],
listening:[
    item('key_points',listen('N: ペンについての はなしです。\nA: この ペンは リナさんのですか。\nB: いいえ、デニさんのです。リナさんのは あの かさです。\nN: デニさんの ものは どれですか。',q('Benda apa yang dinyatakan milik Deni?',['ペン','かさ','ほん','ノート'],'B mengoreksi pemilik pena menjadi Deni; Rina adalah pemilik payung.',2)),['Payung dinyatakan milik Rina.','Buku tidak disebut dalam audio.','Buku catatan tidak disebut dalam audio.']),
    item('quick_response',spoken('A: これは せんせいの かばんですか。',['はい、そうです。','はじめまして。','こちらこそ。'],'はい、そうです mengonfirmasi pertanyaan apakah tas tersebut milik guru.',3),['はじめまして adalah salam perkenalan pertama, bukan jawaban konfirmasi.','こちらこそ merespons kesopanan/salam timbal balik dan tidak menjawab pemilik tas.']),
  ],
},
5:{
  vocabulary:[
    item('kanji_reading',q('Label: この ペンは <u>六百円</u>です。',['ろっぴゃくえん','ろくひゃくえん','ろっぴゃくねん','ろくじゅうえん'],'六百円 dibaca ろっぴゃくえん; 百 berubah menjadi ぴゃく setelah ろっ.',1),['ろくひゃくえん tidak memakai perubahan bunyi 六百 yang benar.','ねん adalah tahun, bukan satuan harga 円.','ろくじゅうえん berarti enam puluh yen, bukan enam ratus.']),
    item('orthography',q('Kartu usia: アンナさんは <u>じゅうななさい</u>です。',['十七歳','十七時','七十歳','十七円'],'じゅうななさい ditulis 十七歳, yaitu usia tujuh belas tahun.',3),['時 menandai jam, bukan usia.','七十歳 adalah usia tujuh puluh, bukan tujuh belas.','円 menandai harga, bukan usia.']),
    item('context_vocabulary',q('Kartu menunjukkan 16:20. いま ごご よじ にじゅっ（　）です。',['ぷん','さい','えん','じ'],'Menit dua puluh dibaca にじゅっぷん; bagian kosong adalah ぷん.',2),['さい menandai usia dan tidak melengkapi menit pada jam.','えん menandai harga.','じ menandai jam; jam empat sudah disebut よじ.']),
  ],
listening:[
    item('key_points',listen('N: クラスと テストの じかんです。\nA: クラスは ごぜん じゅうじから じゅういちじまでです。\nB: テストも ごぜんですか。\nA: いいえ。テストは ごご さんじから よじまでです。\nN: テストは いつからですか。',q('Kapan tes dimulai?',['ごご さんじ','ごご よじ','ごぜん じゅうじ','ごぜん じゅういちじ'],'Audio membedakan kelas pagi dengan tes yang mulai pukul tiga siang.',2)),['Pukul empat siang adalah waktu selesai tes.','Pukul sepuluh pagi adalah awal kelas, bukan tes.','Pukul sebelas pagi adalah akhir kelas, bukan awal tes.']),
    item('quick_response',spoken('A: この ノートは いくらですか。',['にひゃくえんです。','にじです。','にさいです。'],'いくら meminta harga; にひゃくえん menyatakan harga 200 yen.',1),['にじ menyatakan pukul dua.','にさい menyatakan usia dua tahun.']),
  ],
},
6:{
  vocabulary:[
    item('kanji_reading',q('この ペンは <u>長い</u>です。',['ながい','たかい','ふるい','しろい'],'長い dibaca ながい, berarti panjang.',2),['たかい adalah bacaan 高い.','ふるい adalah bacaan 古い.','しろい adalah bacaan 白い.']),
    item('orthography',q('この かさは <u>しろい</u>です。',['白い','古い','安い','長い'],'しろい ditulis 白い.',2),['古い dibaca ふるい dan menyatakan lama/tua.','安い dibaca やすい dan menyatakan murah.','長い dibaca ながい dan menyatakan panjang.']),
    item('context_vocabulary',q('Kartu ulasan meminta penilaian suhu cuaca, bukan harga atau usia benda. きょうは とても（　）です。',['さむい','やすい','ふるい','ちいさい'],'さむい menyatakan cuaca dingin; sesuai aspek suhu yang diminta.',3),['やすい menilai harga murah, bukan suhu cuaca.','ふるい menilai lama/tua, bukan suhu cuaca.','ちいさい menilai ukuran kecil, bukan suhu cuaca.']),
  ],
listening:[
    item('key_points',listen('N: テストの はなしです。\nA: きのうの テストは やさしかったですか。\nB: いいえ、むずかしかったです。ながくなかったです。\nN: きのうの テストは どうでしたか。',q('Pernyataan mana sesuai dua penilaian tes kemarin?',['むずかしかったです。ながくなかったです。','やさしかったです。ながくなかったです。','むずかしかったです。ながかったです。','やさしかったです。ながかったです。'],'B menyatakan tes kemarin sulit tetapi tidak panjang; kedua informasi harus dipertahankan.',3)),['Audio menyebut sulit, bukan mudah.','Audio menyangkal panjang, sehingga bagian kedua pilihan ini salah.','Kedua penilaian bertentangan: tesnya sulit dan tidak panjang.']),
    item('quick_response',spoken('A: きのうの テストは むずかしかったですか。',['はい、とても むずかしかったです。','はい、きのうです。','いいえ、テストです。'],'Respons pertama menjawab penilaian kesulitan tes kemarin dengan bentuk lampau yang sesuai.',3),['Ini hanya menyebut waktu dan tidak menjawab apakah tesnya sulit.','Ini hanya menyebut benda/kegiatan tes dan tidak menjawab tingkat kesulitannya.']),
  ],
},
7:{
  vocabulary:[
    item('kanji_reading',q('あの <u>男</u>の ひとは にほんごの せんせいです。',['おとこ','おんな','こども','がっこう'],'男 dibaca おとこ.',2),['おんな adalah bacaan 女.','こども bukan bacaan 男.','がっこう adalah sekolah, bukan bacaan 男.']),
    item('orthography',q('あの <u>おんな</u>の ひとは リナさんです。',['女','男','人','気'],'おんな ditulis 女.',2),['男 dibaca おとこ.','人 dibaca ひと pada konteks ini, bukan おんな.','気 dibaca き, bukan おんな.']),
    item('context_vocabulary',q('Kartu menyebut tingkat kemampuan, bukan kesukaan. アンナさんは にほんごが とても（　）です。',['じょうず','すき','きらい','ひま'],'じょうず menyatakan mahir; kartu meminta penilaian kemampuan.',3),['すき menyatakan suka; seseorang dapat suka tanpa mahir.','きらい menyatakan tidak suka, bukan tingkat kemampuan.','ひま menyatakan luang dan tidak menilai kemahiran bahasa.']),
  ],
listening:[
    item('key_points',listen('N: アンナさんと デニさんの はなしです。\nA: アンナさんは にほんごが じょうずですね。\nB: はい。デニさんは にほんごが すきです。あまり じょうずじゃありません。\nN: デニさんは どうですか。',q('Pernyataan mana sesuai kemampuan dan kesukaan Deni?',['すきです。あまり じょうずじゃありません。','すきで、とても じょうずです。','きらいです。とても じょうずです。','きらいで、へたです。'],'Audio menyebut Deni suka bahasa Jepang tetapi belum begitu mahir.',3)),['Sangat mahir adalah informasi tentang Anna; tidak berlaku untuk Deni.','Audio menyebut Deni suka dan belum begitu mahir, bukan sebaliknya.','Bagian tidak suka bertentangan dengan audio.']),
    item('quick_response',spoken('A: これは どんな まちですか。',['しずかで、きれいな まちです。','まちは どこですか。','にほんごが じょうずです。'],'どんなまち meminta deskripsi kota; respons pertama menyebut tenang dan bersih/indah.',2),['Ini pertanyaan lokasi baru, bukan jawaban deskripsi kota.','Kemahiran bahasa Jepang menggambarkan kemampuan seseorang, bukan sifat kota.']),
  ],
},
8:{
  vocabulary:[
    item('kanji_reading',q('かばんは いすの <u>下</u>に あります。',['した','うえ','みぎ','なか'],'下 dibaca した.',2),['うえ adalah bacaan 上.','みぎ adalah bacaan 右.','なか adalah bacaan 中.']),
    item('orthography',q('いぬは へやの <u>そと</u>に います。',['外','中','上','間'],'そと ditulis 外.',2),['中 menyatakan dalam, bukan luar.','上 menyatakan atas, bukan luar.','間 menyatakan antara, bukan luar.']),
    item('context_vocabulary',q('Urutan pada denah dari kiri ke kanan: toko — bank — sekolah. ぎんこうは みせと がっこうの（　）です。',['あいだ','うえ','なか','うしろ'],'Bank terletak di antara toko dan sekolah, sehingga memakai あいだ.',2),['Denah satu baris tidak menempatkan bank di atas kedua tempat.','Bank bukan berada di dalam toko atau sekolah.','Denah tidak menempatkan bank di belakang kedua tempat.']),
  ],
listening:[
    item('key_points',listen('N: へやの なかの はなしです。\nA: いすの うえに かばんが あります。かばんの なかに ペンが あります。\nB: ねこも かばんの なかですか。\nA: いいえ、ねこは いすの したです。\nN: ペンは どこに ありますか。',q('Di mana pena berada?',['かばんの なか','いすの した','かばんの うえ','つくえの なか'],'Pena berada di dalam tas; kucing, bukan pena, ada di bawah kursi.',2)),['Di bawah kursi adalah posisi kucing.','Pena di dalam tas, bukan di atas tas.','Meja tidak disebut dalam audio.']),
    item('quick_response',spoken('A: この へやに せんせいは いますか。',['はい、います。','はい、あります。','はい、せんせいのです。'],'Keberadaan guru dijawab dengan います.',3),['あります bukan verba keberadaan untuk guru.','せんせいのです menyatakan kepemilikan, bukan apakah guru ada di ruangan.']),
  ],
},
9:{
  vocabulary:[
    item('kanji_reading',q('学校へ <u>車</u>で いきます。',['くるま','でんしゃ','じてんしゃ','ひこうき'],'車 dibaca くるま, yaitu mobil.',2),['でんしゃ adalah kereta dan ditulis 電車.','じてんしゃ adalah sepeda, bukan bacaan 車 saja.','ひこうき adalah pesawat, bukan bacaan 車.']),
    item('orthography',q('でんしゃで <u>えき</u>へ いきます。',['駅','道','車','東'],'えき ditulis 駅.',2),['道 dibaca みち pada kosakata bab ini.','車 dibaca くるま.','東 dibaca ひがし pada kosakata bab ini.']),
    item('context_vocabulary',q('A「なにで にほんへ いきますか。」B「（　）で いきます。」',['ひこうき','せんせい','あした','にほん'],'なにで meminta sarana perjalanan; ひこうき adalah pesawat.',2),['せんせい adalah orang; teman perjalanan memakai と.','あした menyatakan waktu, bukan sarana.','にほん menyatakan tempat, bukan sarana kendaraan.']),
  ],
listening:[
    item('key_points',listen('N: あしたの よていです。\nA: リナさん、あしたは デニさんと がっこうへ いきますか。\nB: いいえ、デニさんは えきへ いきます。わたしは せんせいと がっこうへ いきます。\nA: バスですか。\nB: いいえ、でんしゃです。\nN: リナさんは だれと がっこうへ いきますか。',q('リナさんは だれと がっこうへ いきますか。',['せんせい','デニさん','ひとりで','アンナさん'],'Rina mengoreksi dugaan pergi bersama Deni dan menyatakan pergi bersama guru.',3)),['Deni menuju stasiun dan secara eksplisit bukan teman perjalanan yang dipilih.','Rina mengatakan bersama guru, bukan sendiri.','Anna tidak disebut sebagai teman perjalanan.']),
    item('quick_response',spoken('A: この バスは どこまで いきますか。',['がっこうまで いきます。','くじに いきます。','ともだちと いきます。'],'どこまで meminta tujuan akhir rute bus; respons pertama menyebut sampai sekolah.',2),['Ini waktu berangkat, bukan tujuan akhir bus.','Ini teman perjalanan, bukan tujuan akhir bus.']),
  ],
},
};
