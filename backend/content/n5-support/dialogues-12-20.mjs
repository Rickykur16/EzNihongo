// Reviewed conversation support. Core grammar and vocabulary remain unchanged.
// Evidence indices are zero-based; cast order identifies speakers A and B.
const dialogues = [];
const characters = {
  anna: 'anna-wijaya', hadi: 'hadi-pratama', aoi: 'aoi-takahashi',
  ren: 'ren-mori', claire: 'claire-bennett', daniel: 'daniel-foster',
};
function add(chapter, grammarId, cast, backgroundKey, goal, lines, comprehension, transfer) {
  const turns = lines.trim().split('\n').map((line, index) => {
    const [japanese, indonesian, expression] = line.split('|');
    return {speaker: index % 2 ? 'B' : 'A', japanese, indonesian, expression: expression || null};
  });
  const offset = dialogues.length % 3;
  const question = (kind, data) => {
    const [prompt, correct, wrong1, wrong2, explanation, turnIndex, quote] = data;
    const options = [correct, wrong1, wrong2];
    for (let i = 0; i < offset; i++) options.unshift(options.pop());
    return {kind, prompt, options, correctIndex: offset, explanation,
      evidence: kind === 'comprehension' ? [{turnIndex, quote}, ...(data[7] || [])] : null};
  };
  dialogues.push({grammarId, chapter, cast: cast.map(key => characters[key]), backgroundKey, goal, turns,
    questions: [question('comprehension', comprehension), question('transfer', transfer)]});
}

add(12, 'fd9d207a-a687-4a65-b990-c0725bab12db', ['anna','hadi'], 'classroom',
'Anna dan Hadi membahas urutan belajar setelah pulang, memakai bentuk て kata kerja golongan 1.', `
きょう、うちで なにを しますか。|Hari ini Anda melakukan apa di rumah?|
ほんを よんで、しゅくだいを します。|Saya membaca buku, lalu mengerjakan PR.|
わたしは てがみを かいて、ほんを よみます。|Saya menulis surat, lalu membaca buku.|
てがみですか。だれに かきますか。|Surat? Kepada siapa Anda menulisnya?|berpikir
ははに かきます。|Saya menulis kepada ibu saya.|
いいですね。|Bagus, ya.|senang`,
['Hadi melakukan apa sebelum mengerjakan PR?', 'Membaca buku.', 'Menulis surat.', 'Menelepon ibunya.', 'Hadi menyebut membaca buku sebelum mengerjakan PR.', 1, 'ほんを よんで、しゅくだいを します。'],
['Anda menulis nama, lalu membaca buku. Kalimat yang sesuai adalah?', 'なまえを かいて、ほんを よみます。', 'ほんを よんで、なまえを かきます。', 'なまえを かいて、ねます。', 'かいて adalah bentuk て dari かきます; urutannya menulis nama lalu membaca.']);

add(12, 'e780063a-a317-439a-9fa6-8fb5fbcafdda', ['aoi','ren'], 'cafe',
'Aoi dan Ren membandingkan kegiatan pagi dengan bentuk て kata kerja golongan 2.', `
まいあさ、なにを しますか。|Setiap pagi Anda melakukan apa?|
おきて、あさごはんを たべます。|Saya bangun, lalu sarapan.|
あさごはんは なんですか。|Apa sarapannya?|
パンです。パンを たべて、おちゃを のみます。|Roti. Saya makan roti, lalu minum teh.|senang`,
['Apa yang diminum Ren setelah makan roti?', 'Teh.', 'Kopi.', 'Susu.', 'Ren mengatakan パンをたべて、おちゃをのみます.', 3, 'パンを たべて、おちゃを のみます。'],
['Anda menonton televisi, lalu tidur. Pilih kalimat yang sesuai.', 'テレビを みて、ねます。', 'テレビを みて、ごはんを たべます。', 'ねて、テレビを みます。', 'みます menjadi みて, lalu diikuti kegiatan tidur.']);

add(12, '6d7bb070-df40-4a6b-ae39-5ecfcbfb9ff5', ['claire','daniel'], 'park',
'Claire dan Daniel membahas kunjungan teman dan belajar bersama, memakai して dan きて.', `
きのうは なにを しましたか。|Kemarin Anda melakukan apa?|
ともだちが うちへ きて、いっしょに べんきょうしました。|Teman datang ke rumah, lalu kami belajar bersama.|
にほんごですか。|Bahasa Jepang?|
はい。にほんごを べんきょうして、ごはんを たべました。|Ya. Kami belajar bahasa Jepang, lalu makan.|senang`,
['Apa yang Daniel lakukan bersama temannya sebelum makan?', 'Belajar bahasa Jepang.', 'Membersihkan taman.', 'Menonton televisi.', 'Daniel menyebut belajar bahasa Jepang sebelum makan.', 3, 'にほんごを べんきょうして、ごはんを たべました。'],
['Teman datang ke rumah, lalu kalian makan bersama. Kalimat yang sesuai adalah?', 'ともだちが うちへ きて、いっしょに ごはんを たべます。', 'ともだちが うちへ くて、いっしょに ごはんを たべます。', 'ともだちが うちへ きますて、いっしょに ごはんを たべます。', 'きます memiliki bentuk て tidak beraturan, yaitu きて.']);

add(12, 'a6b34e67-2673-4f07-b954-09cc03e910ac', ['hadi','aoi'], 'classroom',
'Hadi dan Aoi menyusun urutan tiga kegiatan setelah kelas.', `
じゅぎょうの あと、なにを しますか。|Setelah pelajaran, Anda melakukan apa?|
としょかんへ いって、ほんを かりて、うちへ かえります。|Saya pergi ke perpustakaan, meminjam buku, lalu pulang.|
にほんごの ほんですか。|Buku bahasa Jepang?|
にほんごの ほんです。うちで よみます。|Buku bahasa Jepang. Saya membacanya di rumah.|senang`,
['Ke mana Aoi pergi sebelum pulang?', 'Ke perpustakaan.', 'Ke kantor pos.', 'Ke kafe.', 'Aoi menyebut pergi ke perpustakaan, meminjam buku, lalu pulang.', 1, 'としょかんへ いって、ほんを かりて、うちへ かえります。'],
['Urutannya mencuci tangan, makan, lalu minum teh. Pilih kalimat yang tepat.', 'てを あらって、ごはんを たべて、おちゃを のみます。', 'ごはんを たべて、おちゃを のんで、てを あらいます。', 'おちゃを のんで、てを あらって、ごはんを たべます。', 'Bentuk て menghubungkan tindakan sesuai urutan yang diberikan.']);

add(12, 'dbf95b9e-1efa-4cea-a685-a5d8f0fb3a77', ['ren','claire'], 'station',
'Ren dan Claire membahas kegiatan yang baru dilakukan setelah tiba di rumah.', `
うちへ かえってから、なにを しますか。|Setelah pulang, Anda melakukan apa?|
ごはんを たべます。|Saya makan.|
べんきょうは いつ しますか。|Kapan Anda belajar?|
ごはんを たべてから、べんきょうします。|Setelah makan, saya belajar.|
わたしも ごはんを たべてから、べんきょうします。|Saya juga belajar setelah makan.|senang
そうですか。|Oh, begitu.`,
['Kapan Claire belajar?', 'Setelah makan.', 'Sebelum makan.', 'Sebelum pulang.', 'Claire menyebut makan sebagai kegiatan yang selesai lebih dahulu.', 3, 'ごはんを たべてから、べんきょうします。'],
['Anda akan mandi setelah berolahraga. Pilih kalimat yang sesuai.', 'うんどうしてから、シャワーを あびます。', 'シャワーを あびてから、うんどうします。', 'うんどうしてから、ごはんを たべます。', 'うんどうしてから menempatkan olahraga lebih dahulu, kemudian mandi.']);

add(13, 'b51465fb-7696-4fd3-bdd7-df547b73f6ab', ['daniel','anna'], 'classroom',
'Daniel membantu Anna mengisi lembar latihan dengan permintaan てください.', `
ここに なまえを かいてください。|Tolong tulis nama di sini.|
はい。じゅうしょも かきますか。|Baik. Apakah alamat juga ditulis?|berpikir
はい。なまえの したに かいてください。|Ya. Tolong tulis di bawah nama.|
はい、かきました。|Baik, sudah saya tulis.|senang`,
['Di mana Anna diminta menulis alamat?', 'Di bawah nama.', 'Di atas nama.', 'Di belakang buku.', 'Daniel meminta alamat ditulis di bawah nama.', 2, 'なまえの したに かいてください。'],
['Minta teman membaca buku ini dengan てください.', 'この ほんを よんでください。', 'この ほんを よんでも いいですか。', 'この ほんを よんでいます。', 'よんでください meminta lawan bicara membaca; pilihan lain meminta izin atau menyatakan kegiatan.']);

add(13, 'c0f374c3-d8a2-449f-8f01-38d6005bbf9e', ['aoi','claire'], 'cafe',
'Aoi meminta bantuan Claire untuk membaca menu dengan てくれませんか.', `
すみません。この メニューを よんでくれませんか。|Maaf, bisakah Anda membacakan menu ini?|
はい。これは ケーキです。|Ya. Ini kue.|
ありがとうございます。ねだんは いくらですか。|Terima kasih. Berapa harganya?|
はっぴゃくえんです。|Delapan ratus yen.|
はっぴゃくえんですか。すこし たかいですね。|Delapan ratus yen? Agak mahal, ya.|kaget`,
['Bantuan apa yang Aoi minta?', 'Membacakan menu.', 'Membayar kue.', 'Membawa minuman.', 'Aoi meminta Claire membaca menu.', 0, 'この メニューを よんでくれませんか。'],
['Anda meminta teman menulis alamat untuk Anda. Pilih permintaan てくれませんか.', 'じゅうしょを かいてくれませんか。', 'じゅうしょを かいても いいですか。', 'じゅうしょを かいてはいけません。', 'かいてくれませんか meminta bantuan menulis alamat; bentuk lain meminta izin atau melarang.']);

add(13, 'c74016d4-d6e1-40ff-967f-c641357098df', ['ren','hadi'], 'park',
'Ren menanyakan kegiatan Hadi yang sedang berlangsung di taman.', `
いま、なにを していますか。|Sekarang Anda sedang melakukan apa?|
ともだちに てがみを かいています。|Saya sedang menulis surat kepada teman.|
にほんごで かいていますか。|Apakah Anda menulisnya dalam bahasa Jepang?|
はい。じしょを つかっています。|Ya. Saya sedang memakai kamus.|berpikir`,
['Apa yang sedang Hadi lakukan?', 'Menulis surat kepada teman.', 'Membaca surat dari ibu.', 'Meminjam kamus.', 'Hadi mengatakan sedang menulis surat kepada teman.', 1, 'ともだちに てがみを かいています。'],
['Anda sedang membaca buku sekarang. Pilih kalimat yang menyatakan kegiatan berlangsung.', 'いま、ほんを よんでいます。', 'きのう、ほんを よみました。', 'あした、ほんを よみます。', 'いま dan よんでいます menyatakan kegiatan yang sedang berlangsung.']);

add(13, '99fe6c3e-4d6a-4660-b93a-f08156582ebd', ['anna','ren'], 'park',
'Anna meminta izin memotret Ren, lalu mengecek apakah bangku boleh dipakai.', `
しゃしんを とっても いいですか。|Bolehkah saya mengambil foto Anda?|
はい、いいですよ。|Ya, boleh.|senang
ありがとうございます。この ベンチに すわっても いいですか。|Terima kasih. Bolehkah saya duduk di bangku ini?|
はい、どうぞ。|Ya, silakan.`,
['Bagaimana jawaban Ren atas permintaan mengambil foto?', 'Ia mengizinkan.', 'Ia melarang.', 'Ia meminta Anna menunggu besok.', 'Ren menjawab はい、いいですよ sebagai izin.', 1, 'はい、いいですよ。'],
['Anda ingin meminta izin memakai kamus ini. Pilih kalimat yang tepat.', 'この じしょを つかっても いいですか。', 'この じしょを つかってください。', 'この じしょを つかってはいけません。', 'つかってもいいですか meminta izin untuk memakai kamus.']);

add(13, '943958a1-d9e0-4e81-bdf0-46f54febaefd', ['claire','daniel'], 'station',
'Claire dan Daniel memastikan aturan keselamatan saat berada di peron stasiun.', `
ここで はしっても いいですか。|Bolehkah berlari di sini?|
いいえ、ホームで はしってはいけません。|Tidak, dilarang berlari di peron.|
そうですか。でんしゃは まだ ありますか。|Oh, begitu. Apakah masih ada kereta?|bingung
はい。つぎの でんしゃは じゅっぷんごです。|Ya. Kereta berikutnya sepuluh menit lagi.|
じゃ、ここで まちます。|Kalau begitu, saya menunggu di sini.`,
['Apa yang dilarang oleh Daniel?', 'Berlari di peron.', 'Menunggu di peron.', 'Naik kereta berikutnya.', 'Daniel menyatakan larangan berlari di peron.', 1, 'ホームで はしってはいけません。'],
['Aturan melarang mengambil foto di sini. Pilih kalimat larangannya.', 'ここで しゃしんを とってはいけません。', 'ここで しゃしんを とっても いいです。', 'ここで しゃしんを とってください。', 'とってはいけません menyatakan larangan, bukan izin atau permintaan.']);

add(14, '665716b7-b859-4f8a-8549-8998351da934', ['hadi','aoi'], 'park',
'Hadi dan Aoi berbicara santai tentang kegiatan besok dengan bentuk kamus.', `
あした、なにを する？|Besok kamu melakukan apa?|
としょかんへ いく。ほんを かりる。|Aku pergi ke perpustakaan. Aku meminjam buku.|
としょかんで なにを よむ？|Kamu membaca apa di perpustakaan?|
にほんごの ほんを よむ。|Aku membaca buku bahasa Jepang.|senang`,
['Buku apa yang akan Aoi baca di perpustakaan?', 'Buku bahasa Jepang.', 'Buku masakan.', 'Buku tentang perjalanan.', 'Aoi menyebut にほんごのほんをよむ.', 3, 'にほんごの ほんを よむ。'],
['Ubah あした、うちでべんきょうします menjadi bentuk biasa afirmatif dengan isi yang sama.', 'あした、うちで べんきょうする。', 'あした、うちで べんきょうしない。', 'きのう、うちで べんきょうした。', 'します menjadi する; waktu besok dan informasi belajar di rumah tetap sama.']);

add(14, '9b69f34a-1d9c-4bf6-a97e-ba3cd4d69045', ['claire','anna'], 'cafe',
'Claire dan Anna berbicara santai tentang minuman dan camilan, memakai bentuk ない.', `
ジュースを のむ？|Kamu minum jus?|
ううん、ジュースは のまない。おちゃを のむ。|Tidak, aku tidak minum jus. Aku minum teh.|
ケーキは たべる？|Kalau kue, kamu makan?|
うん、たべる。|Ya, aku makan.|senang`,
['Apa yang tidak diminum Anna?', 'Jus.', 'Teh.', 'Air.', 'Anna mengatakan ジュースはのまない.', 1, 'ジュースは のまない。'],
['Nyatakan “Besok saya tidak pergi ke sekolah” dalam bentuk negatif biasa.', 'あしたは がっこうへ いかない。', 'あしたは がっこうへ いく。', 'きのうは がっこうへ いかなかった。', 'いかない adalah negatif biasa untuk tidak pergi;あした mempertahankan waktu besok.']);

add(14, '9fed4209-8a4f-4a70-8b89-767b1a4a0f93', ['ren','daniel'], 'classroom',
'Ren dan Daniel berbicara santai mengenai akhir pekan menggunakan bentuk た.', `
きのう、なにを した？|Kemarin kamu melakukan apa?|
こうえんへ いった。しゃしんを とった。|Aku pergi ke taman. Aku mengambil foto.|
ひとりで いった？|Kamu pergi sendiri?|
ううん、ともだちと いった。|Tidak, aku pergi bersama teman.|senang`,
['Dengan siapa Daniel pergi ke taman?', 'Dengan teman.', 'Dengan ibu.', 'Sendirian.', 'Daniel menyangkal pergi sendiri lalu menyebut ともだちといった.', 3, 'ともだちと いった。'],
['Nyatakan “Kemarin saya membaca buku” dalam bentuk lampau biasa.', 'きのう、ほんを よんだ。', 'あした、ほんを よむ。', 'きのう、ほんを よまなかった。', 'よんだ adalah bentuk た dari よむ dan sesuai kegiatan membaca kemarin.']);

add(14, 'e3a6e9c9-3a74-4551-bfc4-f3cfab5e215b', ['aoi','claire'], 'station',
'Aoi dan Claire membicarakan kegiatan kemarin yang tidak dilakukan, memakai なかった.', `
きのう、えいがを みた？|Kemarin kamu menonton film?|
ううん、みなかった。うちで べんきょうした。|Tidak, aku tidak menonton. Aku belajar di rumah.|
えっ、テレビも みなかった？|Oh, kamu juga tidak menonton televisi?|kaget
うん、テレビも みなかった。|Ya, aku juga tidak menonton televisi.`,
['Apa yang Claire lakukan kemarin?', 'Belajar di rumah.', 'Menonton film.', 'Menonton televisi.', 'Claire mengatakan tidak menonton film dan belajar di rumah.', 1, 'うちで べんきょうした。'],
['Nyatakan “Kemarin saya tidak membeli buku” dalam bentuk lampau negatif biasa.', 'きのう、ほんを かわなかった。', 'きのう、ほんを かった。', 'あした、ほんを かわない。', 'かわなかった menyatakan tidak membeli pada masa lampau.']);

add(14, '9b3ac619-c222-48d4-bdfb-9da746153a8e', ['daniel','hadi'], 'park',
'Daniel mengingatkan Hadi agar tidak meninggalkan barang di bangku taman.', `
その かばんを ここに おかないでください。|Tolong jangan letakkan tas itu di sini.|
どこに おきますか。|Saya harus meletakkannya di mana?|bingung
この いすの うえに おいてください。|Tolong letakkan di atas kursi ini.|
はい。|Baik.|
かばんを わすれないでください。|Tolong jangan lupa tasnya.|
はい、ありがとうございます。|Baik, terima kasih.`,
['Di mana Hadi diminta meletakkan tas?', 'Di atas kursi.', 'Di dalam mobil.', 'Di bawah meja.', 'Daniel meminta tas diletakkan di atas kursi ini.', 2, 'この いすの うえに おいてください。'],
['Minta teman agar tidak membuka jendela.', 'まどを あけないでください。', 'まどを あけてください。', 'まどを あけても いいですか。', 'あけないでください meminta orang lain tidak membuka jendela.']);

add(14, '7f62a504-4763-4630-9417-bbcebdb731ea', ['anna','ren'], 'classroom',
'Anna dan Ren memastikan informasi yang wajib ditulis pada lembar kelas.', `
この かみに なまえを かきますか。|Apakah nama ditulis di kertas ini?|
はい。なまえを かかなければなりません。|Ya. Nama harus ditulis.|
じゅうしょも かきますか。|Apakah alamat juga ditulis?|
いいえ、じゅうしょは かかなくても いいです。|Tidak, alamat tidak perlu ditulis.|
はい。なまえを かきます。|Baik. Saya menulis nama.|senang`,
['Apa yang wajib Anna tulis?', 'Nama.', 'Alamat.', 'Nama dan alamat.', 'Ren menyatakan nama wajib ditulis, sedangkan alamat tidak wajib.', 1, 'なまえを かかなければなりません。'],
['Aturannya mengharuskan menulis nama. Pilih pernyataan kewajibannya.', 'なまえを かかなければなりません。', 'なまえを かかなくても いいです。', 'なまえを かいてはいけません。', 'かかなければなりません menyatakan kewajiban menulis nama.']);

add(14, 'd0186cb9-a23a-4405-bee9-fb55ec8d8802', ['claire','aoi'], 'classroom',
'Claire menanyakan bagian lembar latihan yang wajib dan tidak wajib diisi.', `
この かみに じゅうしょを かきますか。|Apakah alamat ditulis di kertas ini?|
いいえ、じゅうしょは かかなくても いいです。|Tidak, alamat tidak perlu ditulis.|
なまえは かきますか。|Kalau nama, apakah ditulis?|
はい、なまえは かいてください。|Ya, tolong tulis namanya.|
はい、ありがとうございます。|Baik, terima kasih.|senang`,
['Apa yang tidak perlu ditulis Claire?', 'Alamat.', 'Nama.', 'Keduanya wajib ditulis.', 'Aoi mengatakan alamat tidak perlu ditulis.', 1, 'じゅうしょは かかなくても いいです。'],
['Anda menjelaskan bahwa besok teman tidak perlu datang. Pilih kalimatnya.', 'あしたは こなくても いいです。', 'あしたは こなければなりません。', 'あしたは きてはいけません。', 'こなくてもいいです menyatakan tidak wajib datang; bukan kewajiban atau larangan.']);

add(15, 'e4b8facb-fce7-4bda-8b53-96ce835906d8', ['ren','claire'], 'cafe',
'Ren berperan sebagai pelanggan dan Claire sebagai petugas dalam simulasi memesan minuman dengan jumlah yang jelas.', `
コーヒーを ふたつ おねがいします。|Tolong dua kopi.|
はい。ケーキは いかがですか。|Baik. Apakah Anda ingin kue?|
ケーキを ひとつ おねがいします。|Tolong satu kue.|
はい。コーヒーを ふたつ、ケーキを ひとつですね。|Baik. Dua kopi dan satu kue, ya.|
はい、おねがいします。|Ya, tolong.|senang`,
['Berapa kopi dan kue yang dipesan Ren?', 'Dua kopi dan satu kue.', 'Satu kopi dan dua kue.', 'Dua kopi dan dua kue.', 'Claire mengulang pesanan dua kopi dan satu kue; Ren mengonfirmasi.', 3, 'コーヒーを ふたつ、ケーキを ひとつですね。'],
['Anda ingin memesan tiga roti. Pilih pesanan yang tepat.', 'パンを みっつ おねがいします。', 'パンを ふたつ おねがいします。', 'ケーキを みっつ おねがいします。', 'みっつ menyatakan tiga dan パン adalah barang yang dipesan.']);

add(15, '68bd15d4-d5b7-436d-8d11-f3c7b9aa6aab', ['daniel','anna'], 'cafe',
'Daniel berperan menawarkan minuman kepada Anna dalam simulasi layanan kafe.', `
おのみものは いかがですか。|Apakah Anda ingin minuman?|
おちゃを おねがいします。|Tolong teh.|
ケーキは いかがですか。|Apakah Anda ingin kue?|
いいえ、けっこうです。|Tidak, terima kasih.|
はい。おちゃですね。|Baik. Teh, ya.|
はい、ありがとうございます。|Ya, terima kasih.|senang`,
['Tawaran apa yang ditolak Anna?', 'Kue.', 'Teh.', 'Semua minuman.', 'Anna menjawab いいえ、けっこうです setelah ditawari kue.', 2, 'ケーキは いかがですか。'],
['Anda ingin menawarkan kopi dengan いかがですか. Pilih kalimatnya.', 'コーヒーは いかがですか。', 'コーヒーを おねがいします。', 'コーヒーに します。', 'いかがですか menawarkan; dua pilihan lain memesan atau menentukan pilihan.']);

add(15, '17cb4811-b197-49d7-a590-1927c5df346a', ['hadi','aoi'], 'cafe',
'Hadi menjadi pelanggan dan Aoi berlatih menyampaikan jumlah tagihan dalam simulasi kasir kafe.', `
おかいけいを おねがいします。|Tolong tagihannya.|
はい。コーヒーと ケーキで、ななひゃくえんに なります。|Baik. Kopi dan kuenya berjumlah tujuh ratus yen.|
せんえんで おねがいします。|Saya membayar dengan seribu yen.|
はい、おつりは さんびゃくえんです。|Baik, kembaliannya tiga ratus yen.|
ありがとうございます。|Terima kasih.|senang`,
['Berapa total tagihan Hadi?', 'Tujuh ratus yen.', 'Seribu yen.', 'Tiga ratus yen.', 'Aoi menyatakan total ななひゃくえんになります; seribu adalah uang pembayaran.', 1, 'ななひゃくえんに なります。'],
['Dalam simulasi kasir, total pesanan lima ratus yen. Gunakan になります untuk menyampaikannya.', 'ごひゃくえんに なります。', 'せんえんに なります。', 'ごひゃくえんを はらいます。', 'ごひゃくえんになります menyampaikan jumlah tagihan lima ratus yen.']);

add(15, 'c5368b5c-2ffa-4c30-a788-0a47678dd2d2', ['claire','daniel'], 'classroom',
'Claire dan Daniel berlatih menyambut tamu kelas dengan permintaan sopan お〜ください; peran ini khusus simulasi.', `
すみません。せんせいは いますか。|Permisi. Apakah gurunya ada?|
はい。ここで すこし おまちください。|Ya. Silakan tunggu sebentar di sini.|
はい。|Baik.|
どうぞ、おはいりください。|Silakan masuk.|
ありがとうございます。|Terima kasih.|senang`,
['Apa yang diminta Daniel sebelum Claire masuk?', 'Menunggu sebentar di sini.', 'Pulang dahulu.', 'Menelepon guru.', 'Daniel memakai おまちください untuk meminta Claire menunggu.', 1, 'ここで すこし おまちください。'],
['Dalam simulasi layanan, minta tamu menunggu dengan お〜ください.', 'すこし おまちください。', 'すこし まっても いいですか。', 'すこし まっています。', 'おまちください adalah permintaan sopan dari まちます.']);

add(15, '55aa7349-10bb-4f1b-a507-324f1112e692', ['anna','hadi'], 'cafe',
'Anna dan Hadi menentukan pilihan minuman dan makanan dari menu kafe.', `
のみものは なにに しますか。|Anda memilih minuman apa?|
おちゃに します。|Saya memilih teh.|
わたしは コーヒーに します。ケーキも ありますね。|Saya memilih kopi. Ada kue juga, ya.|berpikir
わたしは ケーキに します。|Saya memilih kue.|
わたしは パンに します。|Saya memilih roti.|senang`,
['Minuman apa yang dipilih Hadi?', 'Teh.', 'Kopi.', 'Jus.', 'Hadi menjawab おちゃにします.', 1, 'おちゃに します。'],
['Setelah melihat menu, Anda memutuskan memilih jus. Pilih kalimat yang sesuai.', 'ジュースに します。', 'ジュースが あります。', 'ジュースは いかがですか。', 'にします menyatakan keputusan memilih jus.']);

add(15, '722e0cd8-0b81-428c-bc45-02e969f11b98', ['aoi','ren'], 'park',
'Aoi dan Ren mengamati perubahan udara dan suasana taman menjelang sore.', `
すこし さむく なりましたね。|Sudah menjadi agak dingin, ya.|berpikir
そうですね。きのうは あたたかかったです。|Ya. Kemarin hangat.|
こうえんは しずかに なりましたね。|Tamannya menjadi sepi, ya.|
はい。こどもたちは もう かえりました。|Ya. Anak-anak sudah pulang.`,
['Perubahan udara apa yang disebut Aoi?', 'Menjadi agak dingin.', 'Menjadi sangat panas.', 'Menjadi lebih terang.', 'Aoi mengatakan さむくなりました.', 0, 'すこし さむく なりましたね。'],
['Ruangan yang sebelumnya kotor kini bersih. Pilih pernyataan perubahannya.', 'へやが きれいに なりました。', 'へやが きれいく なりました。', 'へやが きれいに します。', 'きれい adalah adjektiva な, sehingga perubahan keadaan memakai きれいになります.']);

add(16, '667d7a42-136a-4eea-94a9-0c2aeda5667a', ['claire','hadi'], 'station',
'Claire dan Hadi mencocokkan waktu keberangkatan dan kedatangan kereta.', `
でんしゃは なんじに でますか。|Kereta berangkat pukul berapa?|
くじに でます。|Berangkat pukul sembilan.|
とうきょうには なんじに つきますか。|Tiba di Tokyo pukul berapa?|
じゅうじはんに つきます。|Tiba pukul setengah sebelas.|
じゃ、はちじはんに えきへ きます。|Kalau begitu, saya datang ke stasiun pukul setengah sembilan.|berpikir`,
['Pukul berapa kereta tiba di Tokyo?', 'Pukul setengah sebelas.', 'Pukul sembilan.', 'Pukul setengah sembilan.', 'Hadi menyebut じゅうじはん sebagai waktu tiba.', 3, 'じゅうじはんに つきます。'],
['Anda mulai belajar tepat pukul tujuh. Pilih kalimat yang sesuai.', 'しちじに べんきょうを はじめます。', 'しちじまで べんきょうします。', 'しちじに べんきょうを おわります。', 'に menandai waktu tertentu;はじめます berarti mulai.']);

add(16, 'd878d67d-9a52-41c5-81cd-7a2614551310', ['ren','anna'], 'classroom',
'Ren dan Anna mengecek tanggal ujian serta awal liburan dari kalender kelas.', `
しけんは なんがつ なんにちですか。|Ujiannya tanggal berapa dan bulan apa?|
しがつ みっかです。|Tanggal tiga April.|
やすみは いつからですか。|Liburnya mulai kapan?|
しがつ よっかからです。|Mulai tanggal empat April.|
しけんの つぎの ひですね。|Hari setelah ujian, ya.|senang
はい、そうです。|Ya, benar.`,
['Kapan ujian yang disebut Anna?', 'Tiga April.', 'Empat April.', 'Empat Maret.', 'Anna menjawab しがつみっか, yaitu tiga April.', 1, 'しがつ みっかです。'],
['Tanggal kegiatan adalah lima Mei. Pilih cara menyebut tanggal tersebut.', 'ごがつ いつかです。', 'いつがつ ごにちです。', 'ごがつ よっかです。', 'Mei dibaca ごがつ, sedangkan tanggal lima dibaca いつか.']);

add(16, '907782dd-a6dc-47e7-9ce9-6e529897b3a5', ['daniel','aoi'], 'classroom',
'Daniel mencari hari, tanggal, dan waktu rapat agar dapat mencatatnya dengan benar.', `
かいぎは なんようびですか。|Rapatnya hari apa?|
きんようびです。|Hari Jumat.|
なんがつ なんにちですか。|Tanggal berapa dan bulan apa?|
ごがつ はつかです。ごご にじからです。|Tanggal dua puluh Mei. Mulai pukul dua siang.|
はい、ノートに かきます。|Baik, saya mencatatnya di buku catatan.|berpikir`,
['Hari apa rapat yang disebut Aoi?', 'Jumat.', 'Kamis.', 'Sabtu.', 'Aoi menjawab きんようび.', 1, 'きんようびです。'],
['Anda ingin mengetahui hari dalam minggu ketika ujian berlangsung. Pertanyaan yang tepat adalah?', 'しけんは なんようびですか。', 'しけんは なんじですか。', 'しけんは どこですか。', 'なんようび menanyakan hari dalam minggu;なんじ menanyakan jam.']);

add(16, '2dc81cdf-b222-442d-8aea-06ad511838d6', ['hadi','claire'], 'park',
'Hadi dan Claire membahas frekuensi kegiatan rutin mingguan dan bulanan.', `
よく この こうえんへ きますか。|Apakah Anda sering datang ke taman ini?|
はい。まいしゅう にちようびに きます。|Ya. Saya datang setiap hari Minggu.|
としょかんにも いきますか。|Apakah Anda juga pergi ke perpustakaan?|
はい。まいつき としょかんへ いって、ほんを かります。|Ya. Setiap bulan saya pergi ke perpustakaan, lalu meminjam buku.|berpikir
わたしは まいしゅう いきます。|Saya pergi setiap minggu.`,
['Seberapa sering Claire datang ke taman ini?', 'Setiap hari Minggu.', 'Setiap hari.', 'Setiap tahun.', 'Claire menyebut まいしゅうにちようび.', 1, 'まいしゅう にちようびに きます。'],
['Anda pergi berwisata setiap tahun. Pilih kalimat yang sesuai.', 'まいとし、りょこうに いきます。', 'まいつき、りょこうに いきます。', 'まいしゅう、りょこうに いきます。', 'まいとし berarti setiap tahun;まいつき dan まいしゅう memiliki frekuensi berbeda.']);

add(17, '935d1bed-73ce-49b7-b8a3-ab8f3ce0a8dd', ['anna','daniel'], 'cafe',
'Anna dan Daniel membicarakan makanan yang disukai serta minuman yang tidak disukai.', `
あまい ものが すきですか。|Apakah Anda suka makanan manis?|
はい。ケーキが すきです。|Ya. Saya suka kue.|senang
コーヒーも すきですか。|Apakah Anda juga suka kopi?|
いいえ、コーヒーは きらいです。おちゃが すきです。|Tidak, saya tidak suka kopi. Saya suka teh.`,
['Apa yang tidak disukai Daniel?', 'Kopi.', 'Kue.', 'Teh.', 'Daniel mengatakan コーヒーはきらいです.', 3, 'コーヒーは きらいです。'],
['Anda suka sepak bola dan tidak suka berenang. Pilih kalimat yang sesuai.', 'サッカーが すきです。すいえいは きらいです。', 'サッカーは きらいです。すいえいが すきです。', 'サッカーも すいえいも すきです。', 'すき dan きらい harus sesuai dengan dua kegiatan pada kartu informasi.']);

add(17, '0da370cb-84cd-4f28-82ba-e6a61ef06ba2', ['aoi','hadi'], 'park',
'Aoi memuji keterampilan Hadi menggambar; Hadi menjelaskan kegiatan latihannya.', `
この えは あなたの えですか。|Apakah gambar ini buatan Anda?|
はい。きのう、ここで かきました。|Ya. Saya menggambarnya di sini kemarin.|
えが じょうずですね。|Anda pandai menggambar, ya.|senang
ありがとうございます。よく こうえんで れんしゅうします。|Terima kasih. Saya sering berlatih di taman.`,
['Keterampilan apa yang dipuji Aoi?', 'Menggambar.', 'Bernyanyi.', 'Memasak.', 'Aoi mengatakan えがじょうずですね.', 2, 'えが じょうずですね。'],
['Anda memuji teman karena pandai memasak. Pilih kalimat yang tepat.', 'りょうりが じょうずですね。', 'りょうりが へたですね。', 'りょうりが きらいですね。', 'じょうず memuji keterampilan;へた berarti kurang mahir dan きらい berarti tidak suka.']);

add(17, 'ed2196c0-8a25-41df-a9e0-35e6514a9493', ['ren','claire'], 'classroom',
'Ren dan Claire mencari kegiatan yang dapat dilakukan bersama berdasarkan kemampuan.', `
ピアノが できますか。|Apakah Anda bisa bermain piano?|
はい、すこし できます。|Ya, sedikit.|senang
ギターも できますか。|Apakah Anda juga bisa bermain gitar?|
いいえ、ギターは できません。ピアノは まいしゅう れんしゅうしています。|Tidak, saya tidak bisa bermain gitar. Saya berlatih piano setiap minggu.`,
['Alat musik apa yang bisa dimainkan Claire?', 'Piano.', 'Gitar.', 'Piano dan gitar.', 'Claire mengiyakan pertanyaan tentang piano, lalu menyangkal bisa gitar.', 1, 'はい、すこし できます。'],
['Anda bisa berenang. Pilih kalimat yang menyatakan kemampuan tersebut.', 'すいえいが できます。', 'すいえいが すきです。', 'すいえいが へたです。', 'できます menyatakan kemampuan;すきです menyatakan kesukaan dan へたです menyatakan kurang mahir.']);

add(17, 'a2dd9d0c-2319-4a48-9533-bb9af779761b', ['daniel','anna'], 'cafe',
'Daniel dan Anna membicarakan jenis buku dan film yang mereka sukai.', `
どんな ほんが すきですか。|Anda suka buku seperti apa?|
りょこうの ほんが すきです。|Saya suka buku tentang perjalanan.|
えいがは どんな えいがが すきですか。|Kalau film, Anda suka film seperti apa?|
おもしろい えいがが すきです。|Saya suka film yang menarik.|senang`,
['Buku seperti apa yang disukai Anna?', 'Buku tentang perjalanan.', 'Buku tentang memasak.', 'Kamus.', 'Anna menjawab りょこうのほんがすきです.', 1, 'りょこうの ほんが すきです。'],
['Anda ingin tahu jenis olahraga yang disukai teman. Pilih pertanyaannya.', 'どんな スポーツが すきですか。', 'いつ スポーツを しますか。', 'どこで スポーツを しますか。', 'どんな menanyakan jenis atau sifat;いつ dan どこ menanyakan waktu dan tempat.']);

add(18, '09cf2792-28cf-428a-90db-a707913b5d2a', ['claire','aoi'], 'cafe',
'Claire dan Aoi membandingkan harga dua minuman pada menu kafe sebelum memilih.', `
この コーヒーは いくらですか。|Berapa harga kopi ini?|
よんひゃくえんです。おちゃは さんびゃくえんです。|Empat ratus yen. Tehnya tiga ratus yen.|
コーヒーは おちゃより たかいですね。|Kopi lebih mahal daripada teh, ya.|
はい。この コーヒーは おいしいですよ。|Ya. Kopi ini enak, lho.|senang
じゃ、コーヒーに します。|Kalau begitu, saya memilih kopi.`,
['Minuman mana yang lebih mahal pada menu ini?', 'Kopi.', 'Teh.', 'Keduanya sama mahal.', 'Claire menyimpulkan kopi lebih mahal setelah mendengar harga keduanya.', 2, 'コーヒーは おちゃより たかいですね。'],
['Tas ini 2.000 yen, tas itu 1.000 yen. Pilih perbandingan harga yang benar.', 'この かばんは その かばんより たかいです。', 'その かばんは この かばんより たかいです。', 'この かばんは その かばんより やすいです。', 'Tas ini lebih mahal, sehingga このかばん menjadi hal yang dibandingkan terhadap そのかばん.']);

add(18, '712ac4e1-5745-4de8-bb38-d7dbb81cb908', ['hadi','ren'], 'station',
'Hadi dan Ren membandingkan waktu perjalanan bus dan kereta pada rute menuju taman.', `
こうえんまで、バスで なんぷんですか。|Ke taman, berapa menit dengan bus?|
さんじゅっぷんです。でんしゃでは じゅっぷんです。|Tiga puluh menit. Dengan kereta sepuluh menit.|
あ、バスより でんしゃの ほうが はやいですね。|Oh, kereta lebih cepat daripada bus, ya.|kaget
はい。でんしゃで いきますか。|Ya. Apakah kita pergi naik kereta?|
はい、でんしゃに します。|Ya, saya memilih kereta.`,
['Mengapa Hadi mengatakan kereta lebih cepat?', 'Kereta sepuluh menit, bus tiga puluh menit.', 'Kereta tiga puluh menit, bus sepuluh menit.', 'Keduanya sepuluh menit.', 'Ren memberikan waktu perjalanan masing-masing sebelum Hadi membandingkannya.', 1, 'さんじゅっぷんです。でんしゃでは じゅっぷんです。'],
['Kamar ini lebih luas daripada kamar itu. Gunakan pola より〜のほうが.', 'その へやより この へやの ほうが ひろいです。', 'この へやより その へやの ほうが ひろいです。', 'その へやより この へやの ほうが せまいです。', 'Hal yang lebih luas diletakkan sebelum のほうが, yaitu このへや.']);

add(18, '2928e091-fed4-49a2-a161-667bc6e32480', ['anna','claire'], 'cafe',
'Anna dan Claire membandingkan dua pilihan makanan berdasarkan kesukaan masing-masing.', `
パンと ケーキと、どちらが すきですか。|Antara roti dan kue, mana yang lebih Anda sukai?|
ケーキの ほうが すきです。|Saya lebih suka kue.|senang
コーヒーと おちゃと、どちらが すきですか。|Antara kopi dan teh, mana yang lebih Anda sukai?|
おちゃの ほうが すきです。|Saya lebih suka teh.|
じゃ、ケーキと おちゃですね。|Kalau begitu, kue dan teh, ya.|
はい。|Ya.`,
['Di antara kopi dan teh, mana yang lebih disukai Claire?', 'Teh.', 'Kopi.', 'Keduanya sama-sama tidak disukai.', 'Claire menjawab おちゃのほうがすきです.', 3, 'おちゃの ほうが すきです。'],
['Anda ingin membandingkan kesukaan teman terhadap anjing dan kucing. Pilih pertanyaannya.', 'いぬと ねこと、どちらが すきですか。', 'いぬは どこに いますか。', 'ねこは なんびき いますか。', 'A と B とどちらが membandingkan dua pilihan berdasarkan sifat yang ditanyakan.']);

add(18, 'd73d2021-31fd-47a4-bdb4-655ca37338c8', ['daniel','ren'], 'park',
'Daniel dan Ren membicarakan pilihan olahraga yang paling disukai dari beberapa pilihan.', `
スポーツの なかで、なにが いちばん すきですか。|Di antara olahraga, apa yang paling Anda sukai?|
サッカーが いちばん すきです。|Saya paling suka sepak bola.|senang
テニスも すきですか。|Apakah Anda juga suka tenis?|
はい、すきです。サッカーの ほうが すきです。|Ya, saya suka. Saya lebih suka sepak bola.|
よく サッカーを しますか。|Apakah Anda sering bermain sepak bola?|
はい、まいしゅう します。|Ya, saya bermain setiap minggu.`,
['Olahraga apa yang paling disukai Ren?', 'Sepak bola.', 'Tenis.', 'Berenang.', 'Ren secara langsung mengatakan sepak bola adalah yang paling disukainya.', 1, 'サッカーが いちばん すきです。'],
['Di antara buah-buahan, Anda paling suka apel. Pilih kalimatnya.', 'くだものの なかで、リンゴが いちばん すきです。', 'くだものの なかで、バナナが いちばん すきです。', 'リンゴより バナナの ほうが すきです。', 'リンゴ dan いちばん menyatakan apel sebagai pilihan paling disukai dalam kelompok buah.']);

add(19, '61e0e363-d5e4-40bf-9db7-cc5b39257310', ['aoi','anna'], 'cafe',
'Aoi dan Anna membicarakan kegiatan yang ingin dilakukan selama liburan.', `
やすみに なにを したいですか。|Saat libur, Anda ingin melakukan apa?|
うみへ いきたいです。|Saya ingin pergi ke laut.|senang
うみで なにを したいですか。|Di laut, Anda ingin melakukan apa?|
およぎたいです。しゃしんも とりたいです。|Saya ingin berenang. Saya juga ingin mengambil foto.|
いいですね。|Bagus, ya.|senang`,
['Ke mana Anna ingin pergi saat libur?', 'Ke laut.', 'Ke gunung.', 'Ke perpustakaan.', 'Anna mengatakan うみへいきたいです.', 1, 'うみへ いきたいです。'],
['Anda ingin membaca buku ini. Pilih kalimat yang menyatakan keinginan melakukan tindakan.', 'この ほんを よみたいです。', 'この ほんを よみました。', 'この ほんを よみたくないです。', 'よみたいです menyatakan ingin membaca; pilihan lain menyatakan sudah membaca atau tidak ingin membaca.']);

add(19, 'a256a751-6a8a-428f-b726-fb01bb25775d', ['hadi','daniel'], 'park',
'Hadi dan Daniel mencari kegiatan yang sesuai setelah Daniel menyatakan tidak ingin berlari.', `
いっしょに はしりませんか。|Maukah Anda berlari bersama?|
すみません。きょうは はしりたくないです。|Maaf. Hari ini saya tidak ingin berlari.|
じゃ、この ベンチで やすみませんか。|Kalau begitu, mau beristirahat di bangku ini?|
はい。すこし やすみたいです。|Ya. Saya ingin beristirahat sebentar.|
ここは しずかですね。|Di sini tenang, ya.|
そうですね。|Ya, benar.|senang`,
['Apa yang tidak ingin Daniel lakukan hari ini?', 'Berlari.', 'Beristirahat.', 'Duduk di bangku.', 'Daniel mengatakan きょうははしりたくないです.', 1, 'きょうは はしりたくないです。'],
['Anda tidak ingin keluar hari ini. Pilih kalimat yang sesuai.', 'きょうは でかけたくないです。', 'きょうは でかけたいです。', 'きのうは でかけませんでした。', 'たくないです menyatakan tidak ingin melakukan tindakan;きょう mempertahankan waktunya.']);

add(19, 'ff9ae319-afb2-4363-982f-a0e8fc35e048', ['claire','ren'], 'cafe',
'Claire dan Ren membicarakan barang yang mereka inginkan untuk kegiatan sehari-hari.', `
いま、なにが ほしいですか。|Sekarang Anda ingin memiliki apa?|
あたらしい かばんが ほしいです。|Saya ingin tas baru.|
どんな かばんが ほしいですか。|Tas seperti apa yang Anda inginkan?|
おおきい かばんが ほしいです。ほんを たくさん いれます。|Saya ingin tas besar. Saya akan memasukkan banyak buku.|
わたしは ちいさい かばんが ほしいです。|Saya ingin tas kecil.|senang`,
['Tas seperti apa yang diinginkan Ren?', 'Tas besar.', 'Tas kecil.', 'Tas merah.', 'Ren menjelaskan ingin tas besar untuk banyak buku.', 3, 'おおきい かばんが ほしいです。'],
['Anda ingin memiliki sepeda baru. Pilih kalimat yang tepat.', 'あたらしい じてんしゃが ほしいです。', 'あたらしい じてんしゃを ほしいです。', 'あたらしい じてんしゃが ほしくないです。', 'Benda yang diinginkan menggunakan がほしいです.']);

add(19, '15594769-677f-46cf-b6c4-f09bd7aff189', ['anna','hadi'], 'park',
'Anna dan Hadi membicarakan niat pribadi untuk kegiatan akhir pekan.', `
にちようびは なにを する つもりですか。|Hari Minggu Anda berniat melakukan apa?|
うちで べんきょうする つもりです。|Saya berniat belajar di rumah.|
あさからですか。|Mulai pagi?|
はい。ごごは こうえんへ いく つもりです。|Ya. Siang harinya saya berniat pergi ke taman.|
いいですね。|Bagus, ya.|senang`,
['Apa niat Hadi untuk siang hari Minggu?', 'Pergi ke taman.', 'Berbelanja di toko.', 'Pergi ke perpustakaan.', 'Hadi menyebut ごごはこうえんへいくつもりです.', 3, 'ごごは こうえんへ いく つもりです。'],
['Anda berniat membeli buku besok. Pilih pernyataan niatnya.', 'あした、ほんを かう つもりです。', 'あした、ほんを かった つもりです。', 'あした、ほんを かいませんでした。', 'Niat melakukan tindakan memakai bentuk kamus かう sebelum つもりです.']);

add(19, '4ec7ead4-a5bf-4cf1-8cab-07a0cbc45888', ['ren','aoi'], 'classroom',
'Ren dan Aoi memastikan kegiatan yang sudah tercantum dalam jadwal perjalanan kelas.', `
らいしゅうの よていは なんですか。|Apa jadwal minggu depan?|
きんようびに きょうとへ いく よていです。|Kami dijadwalkan pergi ke Kyoto pada hari Jumat.|
なんじに でますか。|Berangkat pukul berapa?|
あさ はちじに でる よていです。|Dijadwalkan berangkat pukul delapan pagi.|
じゃ、しちじはんに ここへ きます。|Kalau begitu, saya datang ke sini pukul setengah delapan.|berpikir`,
['Kapan keberangkatan ke Kyoto dijadwalkan?', 'Jumat pukul delapan pagi.', 'Jumat pukul setengah delapan pagi.', 'Kamis pukul delapan pagi.', 'Aoi menyebut Jumat pada giliran sebelumnya dan pukul delapan sebagai waktu berangkat.', 3, 'あさ はちじに でる よていです。', [{turnIndex: 1, quote: 'きんようびに きょうとへ いく よていです。'}]],
['Jadwal menyebut Anda akan pulang hari Senin. Pilih kalimat yang tepat.', 'げつようびに かえる よていです。', 'げつようびに かえった よていです。', 'げつようびに かえりませんでした。', 'Rencana tindakan terjadwal memakai bentuk kamus かえる sebelum よていです.']);

add(19, '0c3c1c9d-5c8d-473e-8301-49330bcbd64c', ['daniel','claire'], 'park',
'Daniel dan Claire saling mengajak beristirahat dan minum setelah berjalan di taman.', `
すこし やすみませんか。|Mau beristirahat sebentar?|
いいですね。この ベンチで やすみましょう。|Ide bagus. Ayo beristirahat di bangku ini.|senang
おちゃを のみませんか。|Mau minum teh?|
はい。あの カフェへ いきましょう。|Ya. Ayo pergi ke kafe itu.|
じゃ、すこし やすんでから、いきましょう。|Kalau begitu, ayo pergi setelah beristirahat sebentar.`,
['Apa yang akan dilakukan sebelum pergi ke kafe?', 'Beristirahat sebentar.', 'Berlari satu jam.', 'Pulang ke rumah.', 'Daniel mengusulkan pergi setelah beristirahat sebentar.', 4, 'すこし やすんでから、いきましょう。'],
['Ajak teman menonton film bersama dengan ませんか.', 'いっしょに えいがを みませんか。', 'いっしょに えいがを みません。', 'いっしょに えいがを みました。', 'ませんか dengan intonasi tanya dapat digunakan sebagai ajakan.']);

add(20, 'd3e8046a-857d-4c2f-bf4b-c8606631dd6c', ['hadi','claire'], 'station',
'Hadi dan Claire saling menanyakan pengalaman mengunjungi Kyoto sebelum perjalanan mereka.', `
きょうとへ いった ことが ありますか。|Apakah Anda pernah pergi ke Kyoto?|
はい、いちど あります。|Ya, pernah satu kali.|
なにを しましたか。|Apa yang Anda lakukan di sana?|
おてらを みて、しゃしんを とりました。|Saya melihat kuil, lalu mengambil foto.|
わたしは にど いった ことが あります。きれいな まちですね。|Saya pernah pergi dua kali. Kotanya indah, ya.|
そうですね。|Ya, benar.|senang`,
['Berapa kali Claire pernah pergi ke Kyoto?', 'Satu kali.', 'Dua kali.', 'Belum pernah.', 'Claire menjawab いちど; dua kali adalah pengalaman Hadi.', 1, 'はい、いちど あります。'],
['Anda pernah naik shinkansen. Pilih kalimat yang menyatakan pengalaman itu.', 'しんかんせんに のった ことが あります。', 'しんかんせんに のる つもりです。', 'しんかんせんに のった ことが ありません。', 'のったことがあります menyatakan pengalaman pernah naik.']);

add(20, '9dca6dda-4df0-4815-bf60-185f8d3e5041', ['anna','ren'], 'cafe',
'Anna dan Ren membicarakan makanan yang belum pernah dicoba dan rencana mencobanya.', `
この ケーキを たべた ことが ありますか。|Apakah Anda pernah makan kue ini?|
いいえ、まだ たべた ことが ありません。|Belum, saya belum pernah memakannya.|
わたしは あります。とても おいしいですよ。|Saya pernah. Rasanya sangat enak, lho.|senang
じゃ、きょうは この ケーキに します。|Kalau begitu, hari ini saya memilih kue ini.`,
['Apakah Ren pernah makan kue ini?', 'Belum pernah.', 'Sudah satu kali.', 'Sudah berkali-kali.', 'Ren secara langsung menyatakan belum pernah memakannya.', 1, 'まだ たべた ことが ありません。'],
['Anda belum pernah pergi ke Hokkaido. Pilih pernyataan pengalamannya.', 'ほっかいどうへ いった ことが ありません。', 'ほっかいどうへ いった ことが あります。', 'ほっかいどうへ いかない つもりです。', 'いったことがありません berarti belum pernah pergi;つもり menyatakan niat.']);

add(20, 'a3a77148-3cd9-4c5e-b751-297889c630c4', ['aoi','daniel'], 'park',
'Aoi dan Daniel menjelaskan alasan perubahan rencana karena cuaca dan keadaan tubuh.', `
あめが ふっていますから、カフェへ いきませんか。|Karena sedang hujan, mau pergi ke kafe?|
はい、いきましょう。すこし さむいです。|Ya, ayo pergi. Agak dingin.|
カフェで なにを のみますか。|Di kafe Anda akan minum apa?|
さむいですから、あたたかい おちゃを のみたいです。|Karena dingin, saya ingin minum teh hangat.|berpikir`,
['Mengapa Daniel ingin minum teh hangat?', 'Karena merasa dingin.', 'Karena tehnya gratis.', 'Karena ia tidak suka kopi.', 'Daniel menghubungkan keadaan dingin dengan keinginan minum teh hangat menggunakan から.', 3, 'さむいですから、あたたかい おちゃを のみたいです。'],
['Anda beristirahat karena sakit kepala. Pilih urutan sebab dan akibat yang tepat.', 'あたまが いたいですから、やすみます。', 'やすみますから、あたまが いたいです。', 'あたまが いたいですが、やすみません。', 'Sebab diletakkan sebelum から: sakit kepala menjadi alasan beristirahat.']);

add(20, 'd731828b-eed8-448e-868a-5f6263342cb5', ['claire','anna'], 'cafe',
'Claire dan Anna menimbang kelebihan serta kekurangan kafe dengan penghubung が.', `
この カフェは どうですか。|Bagaimana menurut Anda kafe ini?|
ちいさいですが、しずかです。|Kecil, tetapi tenang.|
コーヒーは どうですか。|Bagaimana kopinya?|
すこし たかいですが、おいしいです。|Agak mahal, tetapi enak.|
じゃ、ここで コーヒーを のみましょう。|Kalau begitu, ayo minum kopi di sini.|senang`,
['Bagaimana Anna menilai kopi di kafe ini?', 'Agak mahal, tetapi enak.', 'Murah, tetapi tidak enak.', 'Agak mahal dan tidak enak.', 'Anna menyebut dua penilaian yang dihubungkan dengan が.', 3, 'すこし たかいですが、おいしいです。'],
['Anda ingin mengatakan “Kamar ini sempit, tetapi bersih”. Pilih kalimat yang sesuai.', 'この へやは せまいですが、きれいです。', 'この へやは せまいですから、きれいです。', 'この へやは ひろいですが、きれいじゃありません。', 'が menghubungkan dua penilaian yang berlawanan;から justru menyatakan sebab.']);

add(20, 'e5ec629d-8ff8-4cf8-9d15-cf24fd15393a', ['ren','hadi'], 'classroom',
'Ren dan Hadi menceritakan urutan kegiatan kemarin serta membandingkan rencana hari ini.', `
きのうは なにを しましたか。|Kemarin Anda melakukan apa?|
としょかんで べんきょうしました。それから、こうえんへ いきました。|Saya belajar di perpustakaan. Setelah itu, saya pergi ke taman.|
こうえんは どうでしたか。|Bagaimana tamannya?|
しずかでした。そして、とても きれいでした。|Tenang. Selain itu, sangat indah.|senang
きょうも いきますか。|Apakah hari ini Anda pergi lagi?|
いいえ。きょうは いきたいです。でも、しごとが あります。|Tidak. Hari ini saya ingin pergi. Tetapi ada pekerjaan.`,
['Ke mana Hadi pergi setelah belajar di perpustakaan?', 'Ke taman.', 'Ke tempat kerja.', 'Ke stasiun.', 'それから menandai kegiatan berikutnya, yaitu pergi ke taman.', 1, 'それから、こうえんへ いきました。'],
['Hubungkan dua kalimat ini untuk menyatakan urutan: “Saya makan. Setelah itu, saya belajar.”', 'ごはんを たべました。それから、べんきょうしました。', 'ごはんを たべました。でも、べんきょうしました。', 'べんきょうしました。それから、ごはんを たべました。', 'それから menyatakan urutan berikutnya, dengan makan lebih dahulu lalu belajar.']);

export default dialogues;
