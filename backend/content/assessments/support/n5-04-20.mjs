// Additive support layer: the published v3/v4 banks and migration history stay immutable.
import {banks as published, bankRows, validateBank} from '../jlpt/revised.mjs';
export {bankRows, validateBank};

const task = (title, focus, cards, exampleText, exampleDialogue, variations = '') => ({
  title,
  prompt: 'Tulis 4–5 kalimat berdasarkan fakta pada kartu. Coba dahulu sebelum membuka contoh. Latihan ini tidak mengubah nilai kuis.',
  steps: [
    `Baca kartu peran. ${focus}`,
    'Tulis 4–5 kalimat yang menyampaikan fakta pada kartu. Utamakan pola bab ini; materi dari bab sebelumnya boleh digunakan.',
    'Cocokkan tulisan dengan kartu dan rubrik. Setelah memeriksa contoh, perbaiki tulisan sendiri, lalu ganti satu fakta secara konsisten menggunakan kosakata yang sudah dipelajari.',
  ],
  roleCards: cards.slice(0, 1).map(([name, facts]) => ({role: 'A', name, facts})),
  exampleText,
  exampleDialogue,
  rubric: [
    'Informasi: sekurangnya tiga fakta disampaikan sesuai kartu; angka, waktu, orang, dan tempat tidak tertukar.',
    `Tata bahasa: ${focus}`,
    'Kelengkapan: tulisan terdiri dari 4–5 kalimat, menggunakan fokus bab, dan tidak bertentangan dengan fakta pada kartu.',
    'Keterpahaman: tulisan dapat dibaca dan hubungan antarkalimat jelas. Kesalahan kecil yang tidak mengubah maksud masih diterima.',
  ],
  rubricScale: ['2 — Terpenuhi secara mandiri dan maknanya jelas.', '1 — Sebagian terpenuhi; masih perlu petunjuk atau satu perbaikan.', '0 — Belum terlihat atau maknanya berbeda dari yang diminta.'],
  acceptedVariations: `Jawaban tidak perlu sama persis dengan contoh. Subjek yang sudah jelas boleh tidak diulang. Nama dan angka boleh diganti secara konsisten setelah percobaan pertama. ${variations}`.trim(),
});

const authoredTransferTasks = {
  4: task('Mengenali benda dan mengoreksi dugaan', 'Bedakan これ／それ／あれ dan この／その／あの sesuai posisi; gunakan の serta konfirmasi atau koreksi.', [
    ['Anna', 'Anda memegang buku bahasa Jepang dan buku catatan milik sendiri. Hadi memegang payung milik Hadi. Tas milik Anna berada jauh dari kalian berdua.'],
    ['Hadi', 'Anda memegang payung. Anna memegang buku bahasa Jepang dan buku catatan. Tas di tempat yang jauh milik Anna, bukan milik Anda.'],
  ], 'これは にほんごの ほんです。この ノートは わたしのです。その かさは ハディさんのです。あの かばんは わたしのです。', [
    'A: その かさは ハディさんのですか。', 'B: はい、そうです。',
    'A: あれは ハディさんの かばんですか。', 'B: いいえ、ちがいます。アンナさんの かばんです。',
    'B: その ほんは にほんごの ほんですか。', 'A: はい、そうです。',
  ], 'Posisi benda harus tetap jelas. Bentuk singkat わたしのです dapat diterima jika bendanya sudah disebut.'),
  5: task('Menukar informasi harga dan jadwal', 'Gunakan satuan harga, jam, dan umur yang tepat serta から／まで untuk awal dan akhir.', [
    ['Anna', 'Kartu fiktif: umur 18 tahun. Buku 800 yen; pena 100 yen. Kelas bahasa Jepang pukul 09.00–12.00.'],
    ['Hadi', 'Tanyakan harga buku, waktu kelas mulai dan selesai, serta umur Anna pada kartu fiktif.'],
  ], 'この ほんは はっぴゃくえんです。この ペンは ひゃくえんです。クラスは ごぜん くじから じゅうにじまでです。わたしは じゅうはっさいです。', [
    'B: この ほんは いくらですか。', 'A: はっぴゃくえんです。',
    'B: クラスは なんじから なんじまでですか。', 'A: ごぜん くじから じゅうにじまでです。',
    'B: おいくつですか。', 'A: じゅうはっさいです。',
  ], 'なんさいですか dan おいくつですか diterima. Tidak perlu memberikan umur pribadi.'),
  6: task('Mendeskripsikan benda dan keadaan', 'Gunakan sifat い untuk menerangkan benda, derajat とても／あまり, serta waktu kini atau lampau yang sesuai.', [
    ['Anna', 'Tas Anda baru, kecil, dan tidak begitu mahal. Hari ini hangat. Kemarin dingin, tidak panas.'],
    ['Hadi', 'Tanyakan ukuran tas, harganya, dan apakah kemarin panas.'],
  ], 'これは あたらしい かばんです。この かばんは ちいさいです。あまり たかくないです。きょうは あたたかいです。きのうは さむかったです。', [
    'B: この かばんは おおきいですか。', 'A: いいえ、ちいさいです。',
    'B: たかいですか。', 'A: いいえ、あまり たかくないです。',
    'B: きのうは あつかったですか。', 'A: いいえ、あつくなかったです。さむかったです。',
  ], 'Bentuk negatif sopan くないです dan くありません sama-sama diterima.'),
  7: task('Mengenalkan kota dan kemampuan teman', 'Gunakan sifat な, hubungan sifat dengan で／くて, serta bedakan kesukaan dan kemahiran.', [
    ['Anna', 'Kota Anda tenang dan bersih. Sekolahnya nyaman untuk digunakan. Gurunya baik hati. Hadi suka bahasa Jepang, tetapi belum begitu mahir.'],
    ['Hadi', 'Tanyakan keadaan kota dan sifat guru. Untuk pertanyaan kemampuan, jawab sebagai Hadi yang suka bahasa Jepang tetapi belum begitu mahir.'],
  ], 'この まちは しずかで、きれいです。がっこうは べんりです。せんせいは しんせつな ひとです。ハディさんは にほんごが すきです。ハディさんは あまり じょうずじゃありません。', [
    'B: この まちは どうですか。', 'A: しずかで、きれいです。',
    'B: せんせいは どうですか。', 'A: とても しんせつです。',
    'A: ハディさんは にほんごが じょうずですか。', 'B: いいえ、あまり じょうずじゃありません。',
  ], '好き dan 上手 menyampaikan informasi berbeda; suka tidak otomatis berarti mahir.'),
  8: task('Menjelaskan posisi benda dan hewan', 'Bedakan あります／います dan gunakan tempat＋に serta hubungan posisi dengan の.', [
    ['Anna', 'Di kamar: buku di atas meja, kucing di bawah meja, tas di atas kursi. Anjing berada di luar kamar.'],
    ['Hadi', 'Tanyakan lokasi buku, kucing, dan anjing. Periksa apakah jawaban membedakan benda dan hewan.'],
  ], 'つくえの うえに ほんが あります。つくえの したに ねこが います。いすの うえに かばんが あります。いぬは へやの そとに います。', [
    'B: ほんは どこに ありますか。', 'A: つくえの うえに あります。',
    'B: ねこは どこに いますか。', 'A: つくえの したに います。',
    'B: いぬは へやの なかに いますか。', 'A: いいえ、へやの そとに います。',
  ], 'Jawaban singkat つくえの うえです juga diterima bila benda yang dimaksud jelas.'),
  9: task('Menjelaskan perjalanan', 'Bedakan tujuan, kendaraan, teman perjalanan, dan waktu memakai へ／で／と／に.', [
    ['Anna', 'Besok pukul 09.00 pergi ke kota bersama teman dengan kereta. Pulang ke rumah dengan bus.'],
    ['Hadi', 'Tanyakan waktu, teman perjalanan, dan kendaraan Anna.'],
  ], 'あした まちへ いきます。くじに いきます。ともだちと でんしゃで いきます。うちへは バスで かえります。', [
    'B: いつ まちへ いきますか。', 'A: あした くじに いきます。',
    'B: だれと いきますか。', 'A: ともだちと いきます。',
    'B: なにで いきますか。', 'A: でんしゃで いきます。',
  ], 'へ dan に untuk tujuan perjalanan diterima apabila maksudnya tetap sama.'),
  10: task('Menceritakan kebiasaan dan kegiatan kemarin', 'Gunakan を untuk objek, で untuk tempat, serta bentuk positif atau negatif dan kini atau lampau sesuai fakta.', [
    ['Anna', 'Setiap pagi makan roti dan minum teh; tidak pernah minum kopi. Hari Minggu membaca buku di rumah. Kemarin belajar di perpustakaan.'],
    ['Hadi', 'Tanyakan makanan pagi, minuman pagi, dan kegiatan Anna kemarin.'],
  ], 'まいあさ パンを たべます。おちゃを のみます。コーヒーは ぜんぜん のみません。にちようびは うちで ほんを よみます。きのうは としょかんで べんきょうしました。', [
    'B: まいあさ なにを たべますか。', 'A: パンを たべます。',
    'B: コーヒーを のみますか。', 'A: いいえ、のみません。おちゃを のみます。',
    'B: きのう どこで べんきょうしましたか。', 'A: としょかんで べんきょうしました。',
  ]),
  11: task('Menghitung perlengkapan kelompok', 'Pilih penghitung yang sesuai dengan orang, buku, pensil, dan benda umum; bedakan jumlah di tiap tempat dan jumlah keseluruhan.', [
    ['Anna', 'Di kamar ada Anda dan tiga teman: total empat orang. Buku: dua di meja dan tiga di tas. Pensil: tiga di meja dan satu di tas. Kursi: empat.'],
    ['Hadi', 'Tanyakan jumlah seluruh orang, buku, dan pensil. Gunakan data kartu yang sama.'],
  ], 'へやに ひとが よにん います。ほんは ぜんぶで ごさつ あります。えんぴつは ぜんぶで よんほん あります。いすは よっつ あります。', [
    'B: へやに ひとは なんにん いますか。', 'A: よにん います。',
    'B: ほんは ぜんぶで なんさつ ありますか。', 'A: ごさつ あります。',
    'B: えんぴつは ぜんぶで なんぼん ありますか。', 'A: よんほん あります。',
  ], 'Penghitung orang dan benda tidak dapat saling ditukar. Jawaban singkat seperti ごさつです diterima jika bendanya sudah jelas.'),
  12: task('Menyampaikan urutan kegiatan', 'Gunakan bentuk て dan てから untuk menjaga urutan kegiatan sesuai kartu.', [
    ['Anna', 'Urutan: bangun pukul 06.00 → mencuci muka → sarapan pukul 07.00 → pergi ke sekolah → belajar → pulang → membaca buku.'],
    ['Hadi', 'Tanyakan kegiatan setelah bangun, setelah sarapan, dan setelah pulang.'],
  ], 'あさ ろくじに おきて、かおを あらいます。しちじに ごはんを たべます。ごはんを たべてから、がっこうへ いきます。がっこうで べんきょうして、うちへ かえります。うちへ かえってから、ほんを よみます。', [
    'B: あさ おきてから、なにを しますか。', 'A: かおを あらいます。',
    'B: ごはんを たべてから、どこへ いきますか。', 'A: がっこうへ いきます。',
    'B: うちへ かえってから、なにを しますか。', 'A: ほんを よみます。',
  ], 'Bentuk て dan てから dapat sama-sama diterima ketika urutan tidak berubah; てから menegaskan bahwa kegiatan pertama selesai dahulu.'),
  13: task('Meminta izin dan menjelaskan aturan', 'Bedakan permintaan てください, kegiatan ています, izin てもいいです, dan larangan てはいけません.', [
    ['Anna', 'Anda petugas perpustakaan. Membaca diperbolehkan; makan di dalam dilarang; makan dan menelepon diperbolehkan di luar. Hadi sedang menulis surat.'],
    ['Hadi', 'Anda pengunjung. Tanyakan izin membaca, izin makan di dalam, dan tempat untuk menelepon.'],
  ], 'ここで ほんを よんでもいいです。ここで たべてはいけません。そとで たべてください。そとで でんわしてもいいです。ハディさんは てがみを かいています。', [
    'B: ここで ほんを よんでもいいですか。', 'A: はい、よんでもいいです。',
    'B: ここで たべてもいいですか。', 'A: いいえ、たべてはいけません。そとで たべてください。',
    'B: どこで でんわで はなしてもいいですか。', 'A: そとで はなしてください。',
  ], 'Permintaan sopan dan pernyataan aturan boleh berbeda bentuk selama izin atau larangannya tidak berubah.'),
  14: task('Memahami kewajiban dan hal yang tidak perlu', 'Bedakan bentuk biasa, permintaan negatif, kewajiban, dan tidak wajib. Tidak wajib bukan berarti dilarang.', [
    ['Anna', 'Besok tes pukul 09.00. Wajib membawa pensil. Kamus tidak wajib dibawa dan tidak boleh digunakan saat tes. Kemarin Anda sakit dan beristirahat di rumah.'],
    ['Hadi', 'Tanyakan kegiatan kemarin, kewajiban membawa pensil, dan apakah kamus perlu dibawa.'],
  ], 'きのうは びょうきでした。うちで やすみました。あしたは えんぴつを もって いかなければ なりません。じしょは もって いかなくてもいいです。テストで じしょを つかわないでください。', [
    'B: きのう がっこうへ いきましたか。', 'A: いいえ、いきませんでした。うちで やすみました。',
    'B: あしたは えんぴつを もって いかなければ なりませんか。', 'A: はい、もって いかなければ なりません。',
    'B: じしょも もって いかなければ なりませんか。', 'A: いいえ、じしょは もって いかなくてもいいです。',
  ], 'Gunakan ragam bahasa yang konsisten dalam tulisan. なくてもいい tidak boleh diganti てはいけない karena maknanya berbeda.'),
  15: task('Memesan dan memeriksa pembayaran', 'Gunakan ungkapan pelayanan, にします untuk pilihan, serta hitung total dan kembalian sesuai menu.', [
    ['Anna', 'Anda pelanggan. Pilih teh seharga 200 yen; bayar 1000 yen. Kedai dulu kecil, sekarang besar.'],
    ['Hadi', 'Anda pelayan. Menu: kopi 300 yen, teh 200 yen. Tawarkan kopi, terima pilihan teh, lalu berikan kembalian 800 yen.'],
  ], 'この みせは おおきく なりました。わたしは おちゃに します。おちゃは にひゃくえんです。せんえんを はらいます。おつりは はっぴゃくえんです。', [
    'B: コーヒーは いかがですか。', 'A: ありがとうございます。おちゃを おねがいします。',
    'B: はい。にひゃくえんです。', 'A: せんえんです。',
    'B: はっぴゃくえんの おつりです。', 'A: ありがとうございます。',
  ], 'Tulislah dari sudut pandang pelanggan. Pilihan pesanan, jumlah pembayaran, dan kembalian harus sesuai kartu.'),
  16: task('Mengonfirmasi jadwal yang berubah', 'Bedakan jadwal berulang dengan perubahan khusus serta sebutkan hari, jam, dan tanggal secara tepat.', [
    ['Anna', 'Kelas biasanya setiap Sabtu pukul 09.00–12.00. Khusus minggu depan: Minggu pukul 10.00–12.00. Ulang tahun Anda 3 Maret.'],
    ['Hadi', 'Tanyakan hari kelas minggu depan, jam mulainya, dan tanggal ulang tahun Anna.'],
  ], 'クラスは まいしゅう どようびに あります。いつもは くじから じゅうにじまでです。らいしゅうだけ にちようびに あります。じゅうじから じゅうにじまでです。わたしの たんじょうびは さんがつ みっかです。', [
    'B: らいしゅうの クラスは どようびですか。', 'A: いいえ、にちようびです。',
    'B: なんじからですか。', 'A: じゅうじからです。',
    'B: たんじょうびは なんがつ なんにちですか。', 'A: さんがつ みっかです。',
  ]),
  17: task('Mengenalkan hobi dan kemampuan', 'Pisahkan kesukaan, kemampuan, dan kemahiran; gunakan どんな untuk menanyakan jenis.', [
    ['Anna', 'Suka tenis dan musik Jepang. Bisa tenis, tidak bisa piano. Hadi bisa piano, tetapi tidak bisa tenis.'],
    ['Hadi', 'Tanyakan olahraga yang disukai Anna, kemampuan piano, dan jenis musik kesukaannya.'],
  ], 'わたしは テニスが すきです。テニスが できます。ピアノは できません。にほんの おんがくが すきです。ハディさんは ピアノが できます。', [
    'B: どんな スポーツが すきですか。', 'A: テニスが すきです。',
    'B: ピアノが できますか。', 'A: いいえ、できません。',
    'B: どんな おんがくが すきですか。', 'A: にほんの おんがくが すきです。',
  ], 'できる menyatakan kemampuan; jangan menyimpulkan seseorang mahir hanya karena ia menyukainya.'),
  18: task('Membandingkan pilihan berdasarkan kebutuhan', 'Sebutkan kriteria perbandingan dengan より／のほうが dan gunakan いちばん untuk tiga pilihan atau lebih.', [
    ['Anna', 'Tas merah: 1000 yen, 2 kg. Tas hitam: 800 yen, 3 kg. Tas putih: 1200 yen, 1 kg. Anda memilih tas yang paling ringan.'],
    ['Hadi', 'Tanyakan mana yang lebih murah antara merah dan hitam, mana yang paling ringan dari ketiganya, serta pilihan Anna.'],
  ], 'くろい かばんは あかい かばんより やすいです。あかい かばんの ほうが かるいです。みっつの なかで、しろい かばんが いちばん かるいです。わたしは しろい かばんに します。', [
    'B: あかい かばんと くろい かばんと、どちらが やすいですか。', 'A: くろい かばんの ほうが やすいです。',
    'B: みっつの なかで、どの かばんが いちばん かるいですか。', 'A: しろい かばんです。',
    'B: どの かばんに しますか。', 'A: しろい かばんに します。',
  ], 'Harga dan berat adalah kriteria berbeda. Pilihan tas harus mengikuti kebutuhan pada kartu, bukan selalu harga termurah.'),
  19: task('Menyepakati rencana bersama', 'Bedakan keinginan, niat, rencana, dan ajakan; respons harus sesuai ketersediaan pada kartu.', [
    ['Anna', 'Ingin menonton film besok. Berencana pergi ke kota. Ingin tas baru. Dapat bertemu besok pukul 14.00 di stasiun.'],
    ['Hadi', 'Besok pagi bekerja; setelah tengah hari luang. Dapat menonton dan bertemu pukul 14.00 di stasiun.'],
  ], 'あした えいがを みたいです。まちへ いく つもりです。あたらしい かばんが ほしいです。ごご にじに えきで あう よていです。', [
    'A: あした、いっしょに えいがを みませんか。', 'B: いいですね。ごぜんは しごとが あります。ごごは ひまです。',
    'A: では、ごご にじは どうですか。', 'B: はい、だいじょうぶです。',
    'A: えきで あいましょう。', 'B: はい、えきで あいましょう。',
  ], 'つもり dan よてい dapat sama-sama diterima jika sesuai maksud. Keduanya tidak perlu dipaksakan sebagai pilihan yang saling meniadakan.'),
  20: task('Menceritakan pengalaman dan alasan', 'Gunakan たことがあります untuk pengalaman, から untuk alasan, serta penghubung yang sesuai urutan atau pertentangan.', [
    ['Anna', 'Tahun lalu pergi ke Jepang bersama teman. Pernah makan sushi, belum pernah natto. Hari berikutnya hujan sehingga tidak pergi ke taman; membaca buku di hotel. Ingin kembali tahun depan.'],
    ['Hadi', 'Tanyakan pengalaman ke Jepang, pengalaman makan natto, dan alasan tidak pergi ke taman.'],
  ], 'わたしは にほんへ いったことが あります。きょねん、ともだちと いきました。すしを たべました。でも、なっとうは たべたことが ありません。つぎの ひは あめでしたから、こうえんへ いきませんでした。', [
    'B: にほんへ いったことが ありますか。', 'A: はい、きょねん いきました。',
    'B: なっとうを たべたことが ありますか。', 'A: いいえ、ありません。',
    'B: どうして こうえんへ いきませんでしたか。', 'A: あめでしたから。',
  ], 'Kejadian tertentu boleh memakai bentuk lampau biasa; pengalaman hidup memakai たことがあります. Variasi yang menjaga fakta dan hubungan sebab diterima.'),
};

// Conversation models were drafted before the requested sequencing change.
// Hold them outside the applied payload until the final conversation review phase.
export const draftDialogueExamples = Object.fromEntries(Object.entries(authoredTransferTasks).map(([chapter, value]) => [chapter, value.exampleDialogue]));
export const transferTasks = Object.fromEntries(Object.entries(authoredTransferTasks).map(([chapter, {exampleDialogue, ...value}]) => [chapter, value]));

// Only these four source fields are edited. IDs, keys, choices, grading and audio stay unchanged.
export const supportEdits = [
  {chapter: 6, number: 4, field: 'prompt', value: 'A「この ほんは どうですか。たのしいですか。」B「はい、とても（　）です。」', reason: 'Pertanyaan meminta penilaian kesenangan membaca, sehingga warna putih bukan jawaban alternatif.'},
  {chapter: 10, number: 18, field: 'passage', transform: s => s.replace('まいにち がっこうで べんきょうします。', 'がっこうで にほんごを べんきょうします。'), reason: 'Menghapus klaim setiap hari di sekolah yang bertentangan dengan belajar di rumah pada hari Minggu.'},
  {chapter: 13, number: 17, field: 'passage', transform: s => s.replace('でんわで はなしてもいけません。', 'でんわで はなしては いけません。'), reason: 'Larangan menggunakan pola てはいけません yang dipelajari pada bab ini.'},
  {chapter: 19, number: 5, field: 'prompt', value: 'A「あしたは（　）ですか。」B「はい。いそがしくありません。しごとも ありません。」', reason: 'Tidak sibuk dinyatakan eksplisit; tidak adanya pekerjaan saja belum memastikan waktu luang.'},
].map(edit => {
  const before = published.find(b => b.chapter === edit.chapter).forms.A[edit.number - 1][edit.field];
  const value = edit.transform ? edit.transform(before) : edit.value;
  if (!before || before === value) throw Error(`Invalid support edit ${edit.chapter}:${edit.number}`);
  return {chapter: edit.chapter, number: edit.number, field: edit.field, before, value, reason: edit.reason};
});

export const banks = published.map(source => {
  const bank = structuredClone(source);
  bank.transferTask = transferTasks[bank.chapter];
  if (!bank.transferTask || !bank.transferTask.exampleText) throw Error(`Missing transfer task ${bank.chapter}`);
  for (const edit of supportEdits.filter(e => e.chapter === bank.chapter)) bank.forms.A[edit.number - 1][edit.field] = edit.value;
  validateBank(bank);
  return bank;
});
