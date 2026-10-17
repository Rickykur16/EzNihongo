// Limited editorial patches for an additive v6 bank. The v5 source stays intact.
// Correct choice first; reasons follow options. Numbered speech is compiled later.
// Scope follows this repository's curated N5 progression, not a universal JLPT list.
const patch=(fields,options,explanation,...wrong)=>({
  ...fields,options,explanation,reasons:[explanation,...wrong],
});

export default {
'b15-a-jlpt-r2-10-expanded':patch({
  question:'この へやは まえは くらかったです。でんきを つけました。あかる（　）なりました。',
  assessment_meta:{objective:'goal3'},
},['く','に','いに','な'],
'あかるい adalah sifat い. Perubahan menjadi terang memakai あかるくなりました; ini melengkapi pengujian perubahan sifat な pada bab yang sama.',
'に dipakai langsung sesudah sifat な atau nomina, bukan akar あかる.',
'あかるいに tidak membentuk pola perubahan sifat い.',
'な bukan bentuk penghubung sifat い sebelum なりました.'),

'b15-a-jlpt-r2-18-expanded':patch({
  question:'きのう、ともだちは なにに しましたか。ふたりの のみものは ごうけいで いくらですか。',
  passage:'きのう ともだちと あたらしい みせへ いきました。みせは まえは ちいさかったです。いまは おおきく なりました。いすも きれいに なりました。わたしは コーヒーに しました。ともだちは おちゃに しました。コーヒーは さんびゃくえん、おちゃは にひゃくえんでした。せんえんを はらいました。みせの ひとは とても しんせつでした。ともだちは いつも コーヒーを のみます。きのうは おちゃに しました。コーヒーも おちゃも おいしかったです。みせは くじから ろくじまでです。',
},['おちゃ、500えん','コーヒー、500えん','おちゃ、1000えん','コーヒー、1000えん'],
'Kemarin teman memilih teh. Gabungkan harga kopi penulis 300 yen dan teh teman 200 yen: total dua minuman 500 yen. Pertanyaan mengharuskan membedakan orang, pilihan kemarin, dan total harga.',
'Total 500 yen benar, tetapi kopi adalah pilihan penulis dan kebiasaan teman, bukan pilihan teman kemarin.',
'Teh benar, tetapi 1000 yen adalah uang yang dibayarkan kepada kasir, bukan total harga minuman.',
'Kedua informasi keliru: teman memilih teh kemarin dan harga totalnya 500 yen.'),

'b15-a-expanded-listening-8':patch({
  audio_script:'N: Aさんは きゃくです。Aさんは パンを かいます。おちゃも コーヒーも いりません。\nB: パンと おちゃと コーヒーですね。\nN: Aさんは なんと いいますか。',
},['いいえ、パンを おねがいします。おちゃも コーヒーも いりません。','はい、パンと おちゃを おねがいします。','はい、パンと コーヒーを おねがいします。'],
'A mengoreksi pesanan menjadi roti tanpa teh atau kopi. Ucapan mempertahankan kedua penolakan yang diberikan dalam situasi.',
'A secara eksplisit tidak menginginkan teh, sehingga pesanan roti dan teh tidak sesuai.',
'A secara eksplisit tidak menginginkan kopi, sehingga pesanan roti dan kopi tidak sesuai.'),

'b16-a-jlpt-r2-6-expanded':patch({
  question:'「クラスは どようびに あります。どの しゅうも おなじです。」と おなじ いみの ぶんは どれですか。',
},['クラスは まいしゅう どようびに あります。','クラスは こんしゅう あります。らいしゅうは ありません。','クラスは まいしゅう にちようびに あります。','クラスは まいにち あります。'],
'どのしゅうもおなじ berarti jadwal yang sama setiap minggu: まいしゅうどようび.',
'Tidak ada kelas minggu depan bertentangan dengan jadwal yang sama setiap minggu.',
'Pilihan ini mengubah hari Sabtu menjadi Minggu.',
'Setiap hari berbeda dari satu hari tertentu setiap minggu.'),

'b16-a-jlpt-r2-17-expanded':patch({
  passage:'らいしゅうの クラスは どようびです。いつもは ごぜん くじからです。らいしゅうは じゅうじからです。おわりは じゅうにじです。ほんと ノートを もって きてください。',
},['10じ','9じ','11じ','12じ'],
'Pertanyaan meminta jadwal minggu depan: mulai pukul sepuluh. Pukul sembilan adalah waktu biasanya.',
'Pukul sembilan adalah jadwal biasa, bukan jadwal minggu depan yang ditanyakan.',
'Pukul sebelas tidak disebut sebagai waktu mulai kelas.',
'Pukul dua belas adalah waktu selesai, bukan waktu mulai.'),

'b16-a-expanded-listening-1':patch({
  audio_script:'N: Aさんは どの ようびに まいしゅう はたらきますか。\nA: みせで まいしゅう すいようびと きんようびに はたらきます。\nB: こんしゅうの どようびも はたらきますか。\nA: はい。こんしゅうの どようびは はたらきます。らいしゅうの どようびは はたらきません。\nN: Aさんは どの ようびに まいしゅう はたらきますか。',
},['すいようびと きんようび','きんようびと どようび','すいようびと どようび','すいようびと きんようびと どようび'],
'Rabu dan Jumat secara eksplisit merupakan jadwal setiap minggu. Sabtu tidak rutin karena A bekerja Sabtu minggu ini dan tidak bekerja Sabtu minggu depan.',
'Pilihan ini menghilangkan Rabu yang rutin dan memasukkan Sabtu yang tidak rutin.',
'Pilihan ini menghilangkan Jumat yang rutin dan memasukkan Sabtu yang tidak rutin.',
'Sabtu tidak termasuk jadwal setiap minggu, karena minggu depan A tidak bekerja pada Sabtu.'),

'b16-a-expanded-listening-8':patch({
  audio_script:'N: Aさんは まいしゅう げつようびと もくようびに はたらきます。かようびは はたらきません。\nB: いつ はたらきますか。\nN: Aさんは なんと いいますか。',
},['まいしゅう げつようびと もくようびです。','まいにち はたらきます。','まいしゅう かようびと もくようびです。'],
'Jawaban menyebut kedua hari kerja yang diberikan, Senin dan Kamis setiap minggu.',
'Setiap hari bertentangan dengan keterangan bahwa A tidak bekerja pada Selasa.',
'Pilihan ini mengganti Senin dengan Selasa yang secara eksplisit bukan hari kerja A.'),

'b17-a-jlpt-r2-18-expanded':patch({
  question:'アンナさんと ハディさんについて、ただしい ものは どれですか。',
},['アンナさんは ギターが できます。ハディさんは ピアノも ギターも できません。','アンナさんは ピアノが できます。ハディさんは ピアノも ギターも できません。','アンナさんは ギターが できます。ハディさんは ピアノが できます。','アンナさんは ピアノが できます。ハディさんは ギターが できます。'],
'Anna bisa gitar, sedangkan Hadi tidak bisa piano maupun gitar. Jawaban perlu menggabungkan kemampuan dua orang dan mempertahankan kedua penyangkalan Hadi.',
'Keterangan Hadi benar, tetapi Anna tidak bisa piano.',
'Keterangan Anna benar, tetapi Hadi tidak bisa piano.',
'Kedua kemampuan tidak sesuai: Anna tidak bisa piano dan Hadi tidak bisa gitar.'),

'b17-a-expanded-vocabulary-5':patch({
  question:'まいにち この ほんを よんで、ごはんや パンを つくります。この ほんで りょうりを べんきょうします。これは（　）です。',
},['りょうりの ほん','スポーツの ほん','おんがくの ほん','りょこうの ほん'],
'Buku dipakai belajar memasak dan membuat makanan, sehingga jenisnya りょうりのほん. Keempat pilihan merupakan jenis buku yang dapat dibaca.',
'Buku olahraga tidak sesuai bidang memasak yang disebut secara eksplisit.',
'Buku musik tidak sesuai kegiatan belajar memasak.',
'Buku perjalanan tidak sesuai bidang belajar memasak yang disebut dalam konteks.'),

'b17-a-expanded-listening-9':patch({
  audio_script:'A: にほんごが できますか。',
},['はい、すこし できます。','はい、にほんごが すきです。','にほんごの クラスは まいしゅうです。'],
'Pertanyaan meminta kemampuan berbahasa Jepang; はい、すこしできます menjawab kemampuan tersebut secara langsung.',
'Menyukai bahasa Jepang tidak menyatakan apakah pembicara mampu menggunakannya.',
'Jadwal kelas bahasa Jepang tidak menjawab kemampuan berbahasa pembicara.'),

'b18-a-expanded-listening-4':patch({
  audio_script:'N: Aさんは どの みちを いきますか。\nB: がっこうまで みちは ふたつです。えきの まえの みちは 10ぷん、みせの まえの みちは 15ふんです。\nA: きょうは じかんが ありません。じかんが みじかい ほうの みちを いきます。\nN: Aさんは どの みちを いきますか。',
},['えきの まえの みち','みせの まえの みち','がっこうの うしろの みち','かわの となりの みち'],
'A memilih waktu perjalanan lebih singkat. Rute depan stasiun membutuhkan 10 menit, lebih singkat daripada 15 menit lewat depan toko; dialog tidak mengumumkan nama rute pilihannya.',
'Rute depan toko membutuhkan 15 menit, lebih lama daripada rute depan stasiun.',
'Rute belakang sekolah tidak disebut sebagai pilihan perjalanan.',
'Rute tepi sungai tidak disebut dalam percakapan.'),

'b18-a-expanded-listening-5':patch({
  audio_script:'N: いちばん おもい はこは どれですか。\nA: あかい はこは ２キロです。あおい はこは ４キロです。しろい はこは ３キロです。\nN: いちばん おもい はこは どれですか。',
},['あおい はこ','あかい はこ','しろい はこ','みんな おなじです'],
'Bandingkan berat ketiga kotak: biru 4 kg lebih berat daripada putih 3 kg dan merah 2 kg. Tidak ada penutur yang menyebut hasil perbandingan secara langsung.',
'Kotak merah 2 kg justru paling ringan.',
'Kotak putih 3 kg masih lebih ringan daripada kotak biru 4 kg.',
'Ketiga berat berbeda, yaitu 2, 4, dan 3 kg.'),

'b19-a-expanded-listening-5':patch({
  audio_script:'N: Bさんは いつ くにへ かえりますか。\nA: ６がつに くにへ かえりますか。\nB: いいえ、６がつは しごとが あります。７がつに かえる よていです。\nA: ７がつですね。\nN: Bさんは いつ くにへ かえりますか。',
},['７がつ','６がつ','８がつ','５がつ'],
'B mengoreksi dugaan Juni menjadi rencana pulang pada Juli. Bulan dan よてい mengikuti materi Bab16 dan Bab19.',
'Juni adalah dugaan A yang disangkal B karena masih ada pekerjaan.',
'Agustus tidak disebut sebagai waktu pulang.',
'Mei tidak disebut sebagai waktu pulang.'),

'b19-a-jlpt-r2-18-expanded':patch({
  question:'アンナさんは なにを かいたいですか。ふたりは ごぜん なんじに えきで あいますか。',
},['にほんごの じしょ、９じ','あたらしい かばん、９じ','にほんごの じしょ、３じ','あたらしい かばん、３じ'],
'Anna ingin membeli kamus bahasa Jepang, dan keduanya berencana bertemu di stasiun pukul sembilan pagi. Tas adalah keinginan penulis, sedangkan pukul tiga merupakan waktu pulang sore.',
'Waktu bertemu benar, tetapi tas baru adalah keinginan penulis, bukan Anna.',
'Kamus benar, tetapi pukul tiga adalah waktu pulang sore, bukan pertemuan pagi.',
'Kedua informasi tertukar: Anna ingin kamus dan pertemuannya pukul sembilan pagi.'),

'b19-a-expanded-vocabulary-3':patch({
  question:'ピアノは うちに あります。あたらしい ピアノは かいません。らいしゅうから、ピアノの せんせいと れんしゅうを します。ピアノを（　）つもりです。',
  section_number:3,section_label:'ことばと ぶん',
  section_instruction:'（　）に あう ことばを えらんで ください。',
  assessment_meta:{itemType:'context_vocabulary'},
},['ならう','かう','かえす','つくる'],
'Berlatih piano bersama guru berarti belajar piano, ならう. Kata 習う termasuk kosakata Bab19; pola つもり tetap menyatakan niat tanpa menyamakannya dengan 予定.',
'かう berarti membeli; konteks membahas berlatih bersama guru, bukan membeli alat musik.',
'かえす berarti mengembalikan; tidak ada rencana pengembalian piano dalam konteks.',
'つくる berarti membuat; konteks menyatakan latihan piano bersama guru, bukan pembuatan alat musik.'),

'b20-a-jlpt-r2-19-expanded':patch({
  question:'20にちは どこへ いって、それから どこへ いきますか。',
  passage:'クラスと ばしょ\nにほんご：としょかん\nりょうり：がっこう\nテニス：こうえん\n\n20にちの おしらせ\nにほんごを べんきょうします。それから、りょうりを します。テニスは ありません。',
},['としょかん → がっこう','がっこう → としょかん','としょかん → こうえん','こうえん → がっこう'],
'それから menunjukkan kegiatan berikutnya: bahasa Jepang dahulu, kemudian memasak. Cocokkan masing-masing kegiatan dengan daftar tempat: perpustakaan lalu sekolah. Soal tetap pencarian informasi sekaligus menguji urutan pada goal3.',
'Pilihan ini membalik urutan memasak dan belajar bahasa Jepang.',
'Taman adalah tempat tenis; tidak ada kegiatan tenis pada tanggal 20.',
'Kegiatan pertama ialah bahasa Jepang di perpustakaan, bukan tenis di taman.'),

'b20-a-jlpt-r2-23-expanded':patch({
  audio_script:'N: Aさんは きょねん にほんへ いきました。\nB: にほんへ いったことが ありますか。\nN: Aさんは なんと いいますか。',
},['はい、あります。','いいえ、ありません。','らいねん いく つもりです。'],
'Perjalanan tahun lalu merupakan pengalaman yang sudah dimiliki A, sehingga jawaban pengalaman ialah はい、あります.',
'A sudah pergi tahun lalu, sehingga menyangkal pengalaman bertentangan dengan situasi.',
'Niat pergi tahun depan tidak menjawab pertanyaan tentang pengalaman yang telah dimiliki.'),

'b20-a-expanded-vocabulary-4':patch({
  question:'はじめに かおを あらいます。（　）、あさごはんを たべます。かおを あらってから、あさごはんを たべます。',
},['それから','でも','しかし','だから'],
'Kalimat terakhir menegaskan urutan dengan てから: mencuci muka dahulu, kemudian sarapan. Penghubung urutan ialah それから.',
'でも menyatakan pertentangan, bukan urutan yang ditegaskan dalam konteks.',
'しかし menyatakan pertentangan, bukan kegiatan berikutnya.',
'だから menyatakan akibat; konteks secara eksplisit menegaskan urutan dengan てから.'),

'b20-a-expanded-vocabulary-5':patch({
  question:'「この ほんは おもしろいですから、また よみたいです。」と おなじ いみは どれですか。',
},['この ほんは おもしろいです。だから、また よみたいです。','この ほんは やすいです。だから、また よみたいです。','この ほんは おもしろいです。でも、また よみたくないです。','この ほんは おもしろいです。だから、かいたいです。'],
'だから mempertahankan hubungan sebab yang dinyatakan から: buku menarik menjadi alasan ingin membacanya lagi. Kedua kalimat mempertahankan alasan dan tindakan yang diinginkan.',
'Pilihan ini mengganti alasan menarik dengan harga murah.',
'Pilihan ini membalik keinginan menjadi tidak ingin membaca lagi dan mengganti hubungan sebab dengan pertentangan.',
'Pilihan ini mengganti keinginan membaca lagi menjadi membeli buku.'),

'b20-a-expanded-listening-1':patch({
  audio_script:'N: Aさんは どうして バスで いきますか。\nA: がっこうまで あるいて いきますか。\nB: きょうは あめですから、バスで いきましょう。\nA: バスは たかいですね。でも、あめですから、あるきたくないです。バスに しましょう。\nN: Aさんは どうして バスで いきますか。',
},['あめですから','バスが やすいですから','あしが いたいですから','バスに のったことが ありませんから'],
'A memilih bus karena hujan dan tidak ingin berjalan. Bentuk から serta たくない memakai pola yang sudah diajarkan; pemahaman tidak bergantung pada kata ぬれる.',
'A justru menyebut ongkos bus mahal, bukan murah.',
'Tidak ada pernyataan kaki sakit dalam dialog.',
'Tidak ada pernyataan bahwa A belum pernah naik bus.'),

'b20-a-expanded-listening-4':patch({
},['500えんの ほん','300えんの ほん','ふたつの ほん','しゃしん'],
'A memilih buku 500 yen meskipun lebih mahal karena buku tersebut memiliki banyak foto.',
'Buku 300 yen adalah alternatif lebih murah yang tidak dipilih A.',
'A memilih satu buku 500 yen, bukan kedua buku.',
'Foto merupakan isi buku yang dipilih, bukan barang terpisah yang dibeli A.'),

'b20-a-expanded-listening-5':patch({
},['ふねと ひこうき','ふねと しんかんせん','ひこうきと しんかんせん','しんかんせん'],
'B pernah naik kapal dan pesawat, tetapi belum pernah naik shinkansen.',
'Pilihan ini memasukkan shinkansen yang belum pernah dinaiki dan menghilangkan pesawat.',
'Pilihan ini memasukkan shinkansen yang belum pernah dinaiki dan menghilangkan kapal.',
'B justru menyatakan belum pernah naik shinkansen.'),
};

// Evidence of the assigned can-do, not merely a kanji reading or an unrelated
// fact inside a themed sentence. Keys still identify the immutable v5 sources.
// Form selection, category scoring and total scoring remain compiler concerns.
export const objectiveEvidenceKeys = [
  // Bab 15: service requests/offers; orders/payment; changes (including repaired
  // i-adjective grammar). Goal3 has deliberately only these three direct items.
  'b15-a-jlpt-r2-7-expanded','b15-a-jlpt-r2-8-expanded','b15-a-jlpt-r2-9-expanded',
  'b15-a-jlpt-r2-10-expanded','b15-a-jlpt-r2-11-expanded',
  'b15-a-jlpt-r2-13-expanded','b15-a-jlpt-r2-14-expanded',
  'b15-a-jlpt-r2-15-expanded','b15-a-jlpt-r2-16-expanded',
  'b15-a-jlpt-r2-17-expanded','b15-a-jlpt-r2-18-expanded','b15-a-jlpt-r2-19-expanded',
  'b15-a-jlpt-r2-21-expanded','b15-a-jlpt-r2-22-expanded',
  'b15-a-jlpt-r2-23-expanded','b15-a-jlpt-r2-24-expanded',
  'b15-a-expanded-listening-1','b15-a-expanded-listening-2',
  'b15-a-expanded-listening-3','b15-a-expanded-listening-4',
  'b15-a-expanded-listening-5','b15-a-expanded-listening-6',
  'b15-a-expanded-listening-7','b15-a-expanded-listening-8',

  // Bab 16: question/answer forms about schedules and dates; the recurring-day
  // grammar and audio distinguish a weekly rule from particular calendar dates.
  'b16-a-jlpt-r2-7-expanded','b16-a-jlpt-r2-8-expanded','b16-a-jlpt-r2-9-expanded',
  'b16-a-jlpt-r2-10-expanded','b16-a-jlpt-r2-11-expanded',
  'b16-a-jlpt-r2-13-expanded','b16-a-jlpt-r2-14-expanded','b16-a-jlpt-r2-15-expanded',
  'b16-a-jlpt-r2-17-expanded','b16-a-jlpt-r2-18-expanded','b16-a-jlpt-r2-19-expanded',
  'b16-a-jlpt-r2-21-expanded','b16-a-jlpt-r2-22-expanded',
  'b16-a-jlpt-r2-23-expanded','b16-a-jlpt-r2-24-expanded',
  'b16-a-expanded-listening-1','b16-a-expanded-listening-2',
  'b16-a-expanded-listening-3','b16-a-expanded-listening-4',
  'b16-a-expanded-listening-5','b16-a-expanded-listening-6',
  'b16-a-expanded-listening-7','b16-a-expanded-listening-8','b16-a-expanded-listening-9',

  // Bab 17: skill-negation in the explicit liking/skill dialogue and the audio
  // contrast of liking tennis vs being able to play soccer supply goal1 evidence.
  // Merely choosing a cookbook after its title is spoken is not goal1 evidence.
  'b17-a-jlpt-r2-7-expanded','b17-a-jlpt-r2-8-expanded','b17-a-jlpt-r2-9-expanded',
  'b17-a-jlpt-r2-10-expanded','b17-a-jlpt-r2-11-expanded',
  'b17-a-jlpt-r2-14-expanded','b17-a-jlpt-r2-15-expanded','b17-a-jlpt-r2-16-expanded',
  'b17-a-jlpt-r2-17-expanded','b17-a-jlpt-r2-18-expanded','b17-a-jlpt-r2-19-expanded',
  'b17-a-jlpt-r2-22-expanded',
  'b17-a-jlpt-r2-23-expanded','b17-a-jlpt-r2-24-expanded',
  'b17-a-expanded-listening-1','b17-a-expanded-listening-2',
  'b17-a-expanded-listening-5',
  'b17-a-expanded-listening-6','b17-a-expanded-listening-7',
  'b17-a-expanded-listening-8','b17-a-expanded-listening-9',

  // Bab 18: two-item comparison, comparison questions/replies and minima/maxima.
  // The old medium reading and old bag-choice audio state the final answer and
  // do not require understanding the comparison, so they are not tagged here.
  'b18-a-jlpt-r2-7-expanded','b18-a-jlpt-r2-8-expanded','b18-a-jlpt-r2-9-expanded',
  'b18-a-jlpt-r2-10-expanded','b18-a-jlpt-r2-13-expanded','b18-a-jlpt-r2-14-expanded',
  'b18-a-jlpt-r2-15-expanded','b18-a-jlpt-r2-16-expanded',
  'b18-a-jlpt-r2-17-expanded','b18-a-jlpt-r2-19-expanded',
  'b18-a-jlpt-r2-22-expanded','b18-a-jlpt-r2-23-expanded','b18-a-jlpt-r2-24-expanded',
  'b18-a-expanded-listening-1','b18-a-expanded-listening-2',
  'b18-a-expanded-listening-3','b18-a-expanded-listening-4',
  'b18-a-expanded-listening-5','b18-a-expanded-listening-6',
  'b18-a-expanded-listening-7','b18-a-expanded-listening-8','b18-a-expanded-listening-9',

  // Bab 19: desire forms, concrete plans and choosing an invitation response.
  // The two invitation-meeting-time audios only ask a quoted time, so omit them
  // from goal3 evidence even though they remain valid listening score items.
  'b19-a-jlpt-r2-7-expanded','b19-a-jlpt-r2-8-expanded','b19-a-jlpt-r2-9-expanded',
  'b19-a-jlpt-r2-10-expanded','b19-a-jlpt-r2-11-expanded',
  'b19-a-jlpt-r2-13-expanded','b19-a-jlpt-r2-14-expanded',
  'b19-a-jlpt-r2-15-expanded','b19-a-jlpt-r2-16-expanded',
  'b19-a-jlpt-r2-17-expanded','b19-a-jlpt-r2-18-expanded','b19-a-jlpt-r2-19-expanded',
  'b19-a-jlpt-r2-22-expanded','b19-a-jlpt-r2-23-expanded','b19-a-jlpt-r2-24-expanded',
  'b19-a-expanded-listening-1','b19-a-expanded-listening-2',
  'b19-a-expanded-listening-3',
  'b19-a-expanded-listening-5','b19-a-expanded-listening-7',
  'b19-a-expanded-listening-8','b19-a-expanded-listening-9',

  // Bab 20: experience, reasons and connectors. The repaired lookup requires
  // interpreting それから and mapping both activities to locations (goal3).
  // Action/price lookups that can ignore the stated reason are not goal2 evidence.
  'b20-a-jlpt-r2-7-expanded','b20-a-jlpt-r2-8-expanded','b20-a-jlpt-r2-9-expanded',
  'b20-a-jlpt-r2-10-expanded','b20-a-jlpt-r2-11-expanded',
  'b20-a-jlpt-r2-13-expanded','b20-a-jlpt-r2-14-expanded',
  'b20-a-jlpt-r2-15-expanded','b20-a-jlpt-r2-17-expanded',
  'b20-a-jlpt-r2-18-expanded','b20-a-jlpt-r2-19-expanded',
  'b20-a-jlpt-r2-22-expanded','b20-a-jlpt-r2-23-expanded','b20-a-jlpt-r2-24-expanded',
  'b20-a-expanded-listening-1','b20-a-expanded-listening-2',
  'b20-a-expanded-listening-5','b20-a-expanded-listening-6',
  'b20-a-expanded-listening-7','b20-a-expanded-listening-8','b20-a-expanded-listening-9',
];
