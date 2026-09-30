// One optional scene per existing grammar lesson; IDs and placement remain fixed.
const scenes = [];
export default scenes;
const pairs = [
  ['anna-wijaya', 'hadi-pratama'], ['hadi-pratama', 'aoi-takahashi'],
  ['aoi-takahashi', 'ren-mori'], ['ren-mori', 'claire-bennett'],
  ['claire-bennett', 'daniel-foster'], ['daniel-foster', 'anna-wijaya'],
  ['anna-wijaya', 'aoi-takahashi'], ['hadi-pratama', 'ren-mori'],
  ['aoi-takahashi', 'claire-bennett'], ['ren-mori', 'daniel-foster'],
  ['claire-bennett', 'anna-wijaya'], ['daniel-foster', 'hadi-pratama']
];
function add(grammarId, chapter, backgroundKey, goal, lines, checks) {
  scenes.push({ grammarId, chapter, cast: pairs[scenes.length % pairs.length], backgroundKey, goal,
    turns: lines.trim().split('\n').map((line, index) => {
      const [japanese, indonesian, expression] = line.split('|');
      return { speaker: index % 2 ? 'B' : 'A', japanese, indonesian, expression: expression || null };
    }),
    checks: checks.map(([prompt, answer, explanation]) => ({ prompt, answer, explanation }))
  });
}

add('3b41a238-b4f1-4327-a8e9-de69cdfbc804', 1, 'classroom',
  'Anna dan Hadi melihat dua tas di atas meja. Hadi membedakan tas yang dibeli kakaknya dan tas yang dipakai sehari-hari.', `
その かばんは、きのう かった かばんですか。|Apakah tas itu tas yang dibeli kemarin?|
はい。あねが かった かばんです。|Ya. Ini tas yang dibeli kakak perempuan saya.|
あおいのも、あねのですか。|Apakah yang biru juga milik kakak Anda?|berpikir
いいえ、あおいのは わたしのです。毎日 つかう かばんです。|Bukan, yang biru milik saya. Ini tas yang saya pakai setiap hari.|`, [
    ['Siapa yang membeli tas pertama?', 'Kakak perempuan Hadi.', 'Hadi menyebut あねがかったかばん.'],
    ['Tas biru dipakai oleh siapa dan seberapa sering?', 'Hadi, setiap hari.', 'あおいのはわたしのです dan 毎日つかう menunjukkan pemilik serta kebiasaannya.']
  ]);

add('eded72e5-8a76-4a04-8264-436f976f1a2d', 1, 'park',
  'Hadi dan Aoi membicarakan hobi di taman. Kesukaan pada fotografi dibandingkan dengan hobi membaca novel.', `
しゅみは 何ですか。|Apa hobi Anda?|
しゃしんを とることです。花の しゃしんを とるのが すきです。|Memotret. Saya suka memotret bunga.|senang
いいですね。わたしは しょうせつを よむのが すきです。|Bagus, ya. Saya suka membaca novel.|
どんな しょうせつを よみますか。|Novel seperti apa yang Anda baca?|
日本の しょうせつです。こうえんで よむのは たのしいです。|Novel Jepang. Membaca di taman itu menyenangkan.|
ここは しずかですから、いいですね。|Tempat ini tenang, jadi cocok, ya.|`, [
    ['Apa yang suka dipotret Aoi?', 'Bunga.', 'Aoi mengatakan 花のしゃしんをとるのがすきです.'],
    ['Kegiatan apa yang dinilai Hadi menyenangkan di taman?', 'Membaca novel.', 'Hadi menyebut novel Jepang, lalu こうえんでよむのはたのしいです.']
  ]);

add('fedee2bc-5852-4576-a9e5-a764b6a38859', 2, 'classroom',
  'Aoi melihat Ren hendak pulang lebih awal. Ren menjelaskan ujian besok lalu meminta bantuan memahami satu kata.', `
もう かえりますか。|Sudah mau pulang?|
はい。あした しけんが あるんです。|Ya. Soalnya besok ada ujian.|
そうですか。いえで べんきょうしますか。|Oh, begitu. Akan belajar di rumah?|
はい。でも、この ことばが わからないんですが、せつめいしてください。|Ya. Tapi saya tidak mengerti kata ini; tolong jelaskan.|bingung
はい。この ことばの いみは「休み」です。|Bisa. Arti kata ini adalah “libur”.|
わかりました。ありがとうございます。|Saya mengerti sekarang. Terima kasih.|senang`, [
    ['Mengapa Ren pulang lebih awal?', 'Karena besok ada ujian dan ia akan belajar di rumah.', 'Ren menjelaskan しけんがあるんです dan membenarkan rencana belajar di rumah.'],
    ['Bantuan apa yang diminta Ren sebelum pulang?', 'Penjelasan arti sebuah kata.', 'わからないんですが membuka permintaan せつめいしてください.']
  ]);

add('a60c9112-86e9-4e45-bbc1-bcbe9ebf7873', 2, 'cafe',
  'Ren dan Claire membandingkan pendapat mereka tentang sebuah buku dan menyampaikan komentar seorang teman.', `
『はる』という 本を よみましたか。|Sudah membaca buku berjudul Haru?|
はい。とても おもしろいと おもいます。|Sudah. Menurut saya sangat menarik.|senang
わたしも そう おもいます。友だちも「おもしろかった」と いっていました。|Saya juga berpikir begitu. Teman saya juga bilang, “Menarik.”|
その 友だちも 日本の 本が すきですか。|Apakah teman itu juga suka buku Jepang?|
はい。毎週 本を かうと いっていました。|Ya. Ia bilang membeli buku setiap minggu.|
たくさん よんでいますね。|Banyak membaca, ya.|`, [
    ['Bagaimana pendapat Ren dan Claire tentang Haru?', 'Keduanya menilai buku itu menarik.', 'Claire menyampaikan おもしろいとおもいます dan Ren menyetujuinya.'],
    ['Seberapa sering teman Ren mengatakan ia membeli buku?', 'Setiap minggu.', 'Ren melaporkan 毎週本をかうといっていました.']
  ]);

add('95cd10ea-b201-4c44-83de-1b7aeff42c07', 3, 'station',
  'Claire dan Daniel menyusun waktu makan sebelum kereta berangkat, dengan batas kembali ke stasiun yang jelas.', `
電車は 何時ですか。|Keretanya pukul berapa?|
十時です。九時半までに ここへ 来てください。|Pukul sepuluh. Silakan kembali ke sini paling lambat setengah sepuluh.|
そのまえに、あさごはんを たべても いいですか。|Bolehkah sarapan sebelumnya?|
はい。たべたあとで、ここで まちましょう。|Boleh. Setelah makan, mari menunggu di sini.|
九時半までに ここへ 来ます。|Saya akan datang ke sini paling lambat setengah sepuluh.|
はい。わたしも ここで まちます。|Baik. Saya juga akan menunggu di sini.|senang`, [
    ['Paling lambat pukul berapa Claire harus kembali?', 'Pukul 09.30.', 'Daniel memakai 九時半までに untuk menetapkan tenggat kembali.'],
    ['Apa yang akan dilakukan setelah sarapan?', 'Menunggu di stasiun ini.', 'たべたあとで、ここでまちましょう menempatkan menunggu setelah makan.']
  ]);

add('773ded4a-7972-4a97-a07c-0b940908c219', 3, 'park',
  'Daniel dan Anna menceritakan kegiatan hari Minggu. Anna menjelaskan kegiatan memasak sambil mendengarkan musik.', `
日よう日は 何を しましたか。|Apa yang Anda lakukan hari Minggu?|
本を よんだり、りょうりを つくったりしました。|Saya antara lain membaca buku dan memasak.|
おんがくも ききましたか。|Apakah juga mendengarkan musik?|
はい。おんがくを ききながら、りょうりを つくりました。|Ya. Saya memasak sambil mendengarkan musik.|senang
わたしは テレビを みないで、早く ねました。|Saya tidur lebih awal tanpa menonton televisi.|
ゆっくり 休みましたね。|Anda beristirahat dengan santai, ya.|`, [
    ['Dua kegiatan apa yang dilakukan Anna bersamaan?', 'Memasak dan mendengarkan musik.', 'ききながら、りょうりをつくりました menunjukkan kegiatan bersamaan dengan pelaku yang sama.'],
    ['Kegiatan apa yang dilewatkan Daniel sebelum tidur?', 'Menonton televisi.', 'テレビをみないで berarti tidur tanpa menonton televisi.']
  ]);

add('820d48d1-48a8-47c9-b259-800de763b9c7', 4, 'classroom',
  'Anna menanyakan penggunaan komputer kepada Aoi. Mereka memastikan fasilitas yang tersedia dan kemampuan mengetik bahasa Jepang.', `
ここで パソコンを つかうことができますか。|Bisa memakai komputer di sini?|
はい、つかえます。あの パソコンは いま つかっていません。|Ya, bisa. Komputer yang di sana sekarang tidak sedang dipakai.|
日本語も かけますか。|Bisa menulis bahasa Jepang juga?|
はい、日本語で レポートを かくことができます。|Ya, bisa menulis laporan dalam bahasa Jepang.|
じゃあ、つかいます。ありがとうございます。|Kalau begitu saya akan memakainya. Terima kasih.|senang
どうぞ。|Silakan.|`, [
    ['Apakah komputer yang ditunjuk sedang digunakan?', 'Tidak.', 'Aoi mengatakan いまつかっていません.'],
    ['Apa yang dapat ditulis memakai komputer itu?', 'Laporan dalam bahasa Jepang.', '日本語でレポートをかくことができます menjelaskan kemampuan yang tersedia.']
  ]);

add('a71867c0-a1f5-45ec-bd43-9594fa317e20', 4, 'cafe',
  'Hadi dan Ren duduk dekat jendela kafe, mengamati gunung dan mengenali aroma kopi.', `
この まどから 山が みえますね。|Gunung terlihat dari jendela ini, ya.|
はい。きょうは てんきが いいです。|Ya. Cuaca hari ini bagus.|
コーヒーの いい においも します。|Aroma kopi yang harum juga tercium.|senang
そうですね。コーヒーを のみませんか。|Benar. Mau minum kopi?|
いいですね。わたしは あたたかい コーヒーに します。|Boleh. Saya pilih kopi hangat.|
わたしも そうします。|Saya juga pilih itu.|`, [
    ['Apa yang terlihat dari jendela kafe?', 'Gunung.', 'Hadi menyatakan 山がみえます.'],
    ['Minuman apa yang akhirnya dipilih kedua orang?', 'Kopi hangat.', 'Hadi memilih あたたかいコーヒー; Ren mengatakan わたしもそうします.']
  ]);

add('6a20afd1-7455-47fe-9518-ed99e6b659cd', 5, 'classroom',
  'Aoi menanyakan rencana Claire mengikuti kelas. Claire membedakan keputusan pribadinya dengan jadwal yang ditetapkan sekolah.', `
来月も この クラスに 来ますか。|Bulan depan juga akan datang ke kelas ini?|
はい。もっと べんきょうしようと おもっています。|Ya. Saya berniat belajar lebih banyak.|
毎日 来ますか。|Akan datang setiap hari?|
月よう日と 水よう日と 金よう日に 来ることにしました。|Saya memutuskan datang pada hari Senin, Rabu, dan Jumat.|berpikir
じゅぎょうは 何時からですか。|Pelajarannya mulai pukul berapa?|
来月から 九時に はじまることになりました。|Mulai bulan depan, sudah ditetapkan pelajaran mulai pukul sembilan.|`, [
    ['Pada hari apa saja Claire memutuskan datang?', 'Senin, Rabu, dan Jumat.', 'Claire menyebut tiga hari tersebut dengan 来ることにしました.'],
    ['Jadwal mulai pelajaran yang sudah ditetapkan adalah pukul berapa?', 'Pukul 9, mulai bulan depan.', '九時にはじまることになりました melaporkan jadwal yang ditetapkan.']
  ]);

add('0fe354f8-3553-4fdc-963d-48697dacd11e', 5, 'park',
  'Ren dan Daniel membicarakan kebiasaan membaca. Daniel menjelaskan kemajuan yang dihasilkan kebiasaan kecil setiap pagi.', `
さいきん、日本語の 本を よんでいますね。|Akhir-akhir ini Anda membaca buku bahasa Jepang, ya.|
はい。毎朝 十分 よむことにしています。|Ya. Saya menetapkan kebiasaan membaca sepuluh menit setiap pagi.|
前より よめるようになりましたか。|Apakah sekarang menjadi lebih bisa membaca daripada sebelumnya?|
はい。かんたんな 本が よめるようになりました。|Ya. Sekarang saya bisa membaca buku sederhana.|senang
わたしも 毎日 よむようにします。|Saya juga akan berusaha membaca setiap hari.|
いいですね。いっしょに がんばりましょう。|Bagus. Mari berusaha bersama.|`, [
    ['Apa kebiasaan membaca Daniel?', 'Membaca sepuluh menit setiap pagi.', '毎朝十分よむことにしています menjelaskan kebiasaan yang sengaja ditetapkan.'],
    ['Kemampuan apa yang berkembang?', 'Membaca buku sederhana dalam bahasa Jepang.', 'かんたんな本がよめるようになりました menyatakan perubahan kemampuan.']
  ]);

add('6060cab0-e192-40cb-9e7f-71ca0973f18d', 6, 'cafe',
  'Claire dan Anna membicarakan kue buatan Claire. Percobaan berhasil dan kuenya sudah habis dimakan.', `
きのう、ケーキを つくってみました。|Kemarin saya mencoba membuat kue.|
どうでしたか。|Bagaimana hasilnya?|
おいしかったです。かぞくと ぜんぶ たべてしまいました。|Enak. Sudah saya habiskan bersama keluarga.|senang
えっ、ぜんぶですか。|Wah, semuanya?|kaget
はい。また つくろうと おもっています。|Ya. Saya berniat membuatnya lagi.|
いいですね。わたしも つくってみたいです。|Bagus. Saya juga ingin mencoba membuatnya.|`, [
    ['Siapa yang menghabiskan kue?', 'Claire bersama keluarganya.', 'Claire menyebut かぞくとぜんぶたべてしまいました.'],
    ['Apakah てしまいました di sini menegaskan penyesalan?', 'Tidak; menegaskan kue sudah habis, dan hasilnya disukai.', 'Kuenya disebut enak dan Claire ingin membuat lagi, sehingga konteksnya penyelesaian.']
  ]);

add('64e59ad7-df3a-436e-b766-ddf5b8d8492e', 6, 'station',
  'Daniel terlambat menemui Hadi di stasiun dan meminta maaf. Mereka lega keretanya belum berangkat.', `
おくれて すみません。|Maaf saya terlambat.|
だいじょうぶです。電車は あと 五分です。|Tidak apa-apa. Keretanya masih lima menit lagi.|
よかった。電車に まにあって よかったです。|Syukurlah. Lega bisa sempat naik kereta.|senang
はい。きっぷは ありますか。|Ya. Apakah tiketnya ada?|
はい、あります。きのう かいました。|Ya, ada. Saya membelinya kemarin.|
じゃあ、いきましょう。|Kalau begitu, mari berangkat.|`, [
    ['Mengapa Daniel meminta maaf?', 'Karena terlambat datang.', 'Dialog dibuka dengan おくれてすみません.'],
    ['Mengapa mereka masih bisa naik kereta?', 'Kereta masih lima menit lagi dan Daniel sudah memiliki tiket.', 'Hadi menyebut あと五分, lalu Daniel membenarkan tiket sudah dibeli kemarin.']
  ]);

add('e57880e8-761f-449c-8ea6-da9f802ace6e', 7, 'classroom',
  'Anna dan Hadi memeriksa keadaan kelas sebelum pulang. Mereka membedakan keadaan lampu dengan tindakan mematikannya.', `
電気が ついていますね。|Lampunya menyala, ya.|
はい。わたしが けします。|Ya. Saya akan mematikannya.|
まども あいています。|Jendelanya juga terbuka.|
じゃあ、まども しめます。|Kalau begitu saya tutup jendelanya juga.|
ありがとうございます。わたしは ドアを しめます。|Terima kasih. Saya akan menutup pintu.|senang
はい。いっしょに かえりましょう。|Baik. Mari pulang bersama.|`, [
    ['Bagaimana keadaan lampu pada awal percakapan?', 'Menyala.', '電気がついています melaporkan keadaan awal lampu.'],
    ['Siapa yang akan menutup pintu?', 'Anna.', 'Anna, penutur pertama, mengatakan わたしはドアをしめます.']
  ]);

add('927f5138-3988-45d7-ab3a-d4eebfd9ae13', 7, 'classroom',
  'Hadi dan Aoi memeriksa persiapan kelas besok: kursi sudah tersusun, buku masih perlu disiapkan.', `
いすが ならべてありますね。|Kursinya sudah disusun, ya.|
はい。あしたの じゅぎょうで つかいます。|Ya. Akan dipakai dalam pelajaran besok.|
本も じゅんびしてありますか。|Apakah bukunya juga sudah disiapkan?|
いいえ。いまから じゅんびしておきます。|Belum. Saya akan menyiapkannya sekarang untuk besok.|berpikir
では、わたしが 本を おきます。ここで いいですか。|Kalau begitu, saya yang meletakkan buku-bukunya. Boleh di sini?|
はい。その テーブルに おいてください。|Ya. Letakkan di meja itu.|`, [
    ['Apa yang sudah siap pada awal percakapan?', 'Susunan kursi.', 'いすがならべてあります menyatakan hasil persiapan kursi yang sudah ada.'],
    ['Di mana buku akan diletakkan?', 'Di meja yang ditunjuk Aoi.', 'Aoi meminta そのテーブルにおいてください setelah Hadi menawarkan bantuan.']
  ]);

add('cdc54833-4399-44a8-a1c4-4802c5fda033', 8, 'park',
  'Aoi dan Ren melihat cuaca berubah saat berjalan di taman. Hujan mulai turun dan mereka memutuskan segera pulang.', `
空が くらくなってきましたね。|Langit mulai menjadi gelap, ya.|
そうですね。あ、雨が ふりだしました。|Benar. Ah, hujan mulai turun.|kaget
かさは ありますか。|Apakah membawa payung?|
はい。でも、雨が つよくなってきました。|Ya. Tapi hujannya mulai bertambah deras.|
じゃあ、早く かえりましょう。|Kalau begitu mari cepat pulang.|
はい。あの みちを いきましょう。|Ya. Mari lewat jalan itu.|`, [
    ['Perubahan apa yang terlihat sebelum hujan mulai turun?', 'Langit menjadi gelap.', 'Aoi lebih dulu menyebut くらくなってきました.'],
    ['Mengapa mereka memutuskan cepat pulang?', 'Hujan mulai turun lalu semakin deras.', 'ふりだしました dan つよくなってきました menjadi konteks keputusan pulang.']
  ]);

add('daa05f6e-93ab-4f75-8c00-8ff7830e8e93', 8, 'classroom',
  'Ren mengajak Claire makan. Claire sedang menyelesaikan laporan, sedangkan Ren baru saja selesai.', `
ごはんを たべませんか。|Mau makan?|
いま、レポートを かいているところです。まだ おわっていません。|Saya sedang menulis laporan. Belum selesai.|
わたしは いま かきおわったところです。|Saya baru saja selesai menulisnya.|
あと 十分 まってください。|Tolong tunggu sepuluh menit lagi.|
はい。ここで まっています。|Bisa. Saya menunggu di sini.|
ありがとうございます。もうすこしです。|Terima kasih. Tinggal sedikit lagi.|senang`, [
    ['Siapa yang masih menulis laporan?', 'Claire.', 'Claire mengatakan かいているところ dan まだおわっていません.'],
    ['Berapa lama Claire meminta Ren menunggu?', 'Sepuluh menit lagi.', 'あと十分まってください menetapkan durasi menunggu yang diminta.']
  ]);

add('9310a766-a8a7-4520-904d-e9adfa304a44', 9, 'classroom',
  'Claire kesulitan memakai kamera yang dibawa Daniel. Ia meminta penjelasan cara penggunaan dan mempertimbangkan berat kamera.', `
この カメラの つかいかたが わかりません。|Saya tidak mengerti cara memakai kamera ini.|bingung
この ボタンを おしてください。|Tekan tombol ini.|
あ、しゃしんが とれました。でも、すこし おもすぎますね。|Ah, berhasil mengambil foto. Tapi kameranya agak terlalu berat, ya.|
そうですね。こちらの 小さいのは つかいやすいです。|Benar. Yang kecil di sini mudah dipakai.|
じゃあ、小さいのを つかってみます。|Kalau begitu saya coba yang kecil.|
どうぞ。|Silakan.|senang`, [
    ['Penjelasan apa yang diminta Claire?', 'Cara menggunakan kamera.', 'つかいかたがわかりません menyatakan kesulitan memahami cara pemakaian.'],
    ['Mengapa Claire ingin mencoba kamera kecil?', 'Kamera pertama terlalu berat, sedangkan yang kecil disebut mudah dipakai.', 'おもすぎます dan 小さいのはつかいやすい menjadi dasar pilihannya.']
  ]);

add('e5bad6e3-2a14-4549-a837-db3a4f3ff8c9', 9, 'classroom',
  'Daniel dan Anna menyiapkan tulisan untuk kelas. Mereka memperbaiki ukuran dan kerapian huruf agar jelas bagi pembaca.', `
この 字の 大きさは どうですか。|Bagaimana ukuran huruf ini?|
すこし 小さいですね。もっと 大きく かいてください。|Agak kecil. Tolong tulis lebih besar.|
はい。ていねいに かきます。|Baik. Saya tulis dengan teliti.|
ありがとうございます。こちらの 名前も 大きくしてください。|Terima kasih. Nama di sebelah sini juga dibuat lebih besar.|
はい。これで いいですか。|Baik. Begini sudah sesuai?|
はい、よく なりました。|Ya, sudah lebih baik.|senang`, [
    ['Apa yang diperbaiki pada tulisan?', 'Ukuran huruf dibuat lebih besar.', 'Anna meminta 大きくかいてください dan 大きくしてください.'],
    ['Bagaimana Daniel mengatakan ia akan menulis?', 'Dengan teliti.', 'ていねいにかきます menjelaskan cara menulis.']
  ]);

add('c61fa4fc-7998-4ad0-af86-1ce0da781ac9', 10, 'cafe',
  'Anna dan Aoi memilih tempat belajar setelah makan. Aoi menjelaskan mengapa perpustakaan lebih sesuai.', `
ここで べんきょうしますか。|Apakah kita belajar di sini?|
きょうは 人が 多いので、としょかんへ いきたいです。|Hari ini banyak orang, jadi saya ingin pergi ke perpustakaan.|
としょかんは ここから ちかいですか。|Apakah perpustakaan dekat dari sini?|
はい。ちかいし、しずかだし、べんきょうしやすいです。|Ya. Dekat dan tenang, jadi mudah belajar di sana.|
じゃあ、ごはんを たべたあとで いきましょう。|Kalau begitu, mari pergi setelah makan.|
はい。そうしましょう。|Ya, mari begitu.|senang`, [
    ['Mengapa Aoi ingin pindah dari kafe?', 'Kafe ramai oleh banyak orang hari ini.', '人が多いので memberi alasan keinginannya pergi ke perpustakaan.'],
    ['Apa dua kelebihan perpustakaan yang disebutkan?', 'Dekat dan tenang.', 'ちかいし、しずかだし menambahkan dua alasan yang mendukung pilihan.']
  ]);

add('8aea44c1-727a-4bd6-83dc-4b5fca2371f3', 10, 'station',
  'Hadi dan Ren membicarakan rencana ke museum seni saat cuaca tidak sesuai harapan. Museum tetap menjadi tujuan meskipun hujan.', `
きょうは いい てんきだと おもったのに、雨ですね。|Padahal saya kira hari ini cuacanya akan bagus, ternyata hujan, ya.|
そうですね。でも、雨が ふっても、びじゅつかんへ いきます。|Benar. Tetapi meskipun hujan, saya tetap pergi ke museum seni.|
駅から とおいですか。|Apakah jauh dari stasiun?|
すこし とおいけど、バスで いけます。|Agak jauh, tetapi bisa naik bus.|
じゃあ、いっしょに バスで いきましょう。|Kalau begitu mari naik bus bersama.|
はい。あちらで まちましょう。|Ya. Mari menunggu di sana.|senang`, [
    ['Apa yang tidak sesuai harapan Hadi?', 'Ia memperkirakan cuaca bagus, tetapi ternyata hujan.', 'いいてんきだとおもったのに menyatakan harapan yang meleset.'],
    ['Bagaimana mereka akan pergi ke museum?', 'Naik bus bersama.', 'Ren menjelaskan バスでいけます dan Hadi mengusulkan バスでいきましょう.']
  ]);

add('4d3efc88-0326-40da-9745-e84d5e385949', 11, 'park',
  'Aoi dan Claire membedakan tanda hujan yang terlihat sekarang dengan kabar cuaca besok dari prakiraan.', `
空に くろい くもが ありますね。|Ada awan hitam di langit, ya.|
はい。雨が ふりそうです。|Ya. Kelihatannya akan hujan.|berpikir
あしたも 雨ですか。|Apakah besok juga hujan?|
てんきよほうでは、あしたは はれるそうです。|Menurut prakiraan cuaca, katanya besok cerah.|
じゃあ、あした また 来ましょう。|Kalau begitu, mari datang lagi besok.|
いいですね。きょうは 早く かえりましょう。|Boleh. Hari ini mari cepat pulang.|`, [
    ['Apa dasar perkiraan hujan sekarang?', 'Awan hitam yang tampak di langit.', 'ふりそうです mengikuti pengamatan くろいくもがあります.'],
    ['Dari mana Claire mendapat informasi bahwa besok cerah?', 'Dari prakiraan cuaca.', 'てんきよほうでは dan はれるそうです menyatakan sumber informasi.']
  ]);

add('481653aa-ad49-4988-92d0-3dc088229c7f', 11, 'classroom',
  'Ren dan Daniel mencari sebuah buku. Mereka membedakan kemungkinan buku dibawa pulang dengan dugaan beralasan tentang letak buku.', `
わたしの 本が ありません。いえに わすれたかもしれません。|Buku saya tidak ada. Mungkin tertinggal di rumah.|bingung
きのう、この テーブルで よんでいましたよ。|Kemarin Anda membacanya di meja ini, lho.|
そうでしたね。まだ ここに あるでしょうか。|Benar juga. Kira-kira masih ada di sini?|
テーブルの 下に あるはずです。きのう、わたしが そこに おきました。|Seharusnya ada di bawah meja. Kemarin saya meletakkannya di sana.|
あ、ありました。ありがとうございます。|Ah, ada. Terima kasih.|senang
よかったですね。|Syukurlah ketemu.|`, [
    ['Kemungkinan awal Ren tentang tempat bukunya apa?', 'Mungkin tertinggal di rumah.', 'Ren membuka dengan いえにわすれたかもしれません.'],
    ['Di mana buku akhirnya ditemukan, dan apa dasar dugaan Daniel?', 'Di bawah meja; Daniel sendiri meletakkannya di sana kemarin.', 'Daniel menyebut テーブルの下 dan tindakannya わたしがそこにおきました; Ren kemudian menemukan buku.']
  ]);

add('b3b6d347-3555-432f-86a1-3979148bc6a3', 12, 'park',
  'Claire dan Anna melihat bunga putih serta anak-anak di taman. Mereka membandingkan penampilan bunga dan mengamati perasaan anak.', `
あの 花は ゆきのように 白いですね。|Bunga itu putih seperti salju, ya.|
はい。ゆきみたいです。でも、花なんですね。|Ya, seperti salju. Tapi ternyata bunga, ya.|kaget
あちらの 子どもたちも 花を みています。|Anak-anak di sana juga sedang melihat bunga.|
たのしそうに はなしていますね。|Mereka tampak senang saat berbincang, ya.|
わたしたちも しゃしんを とりませんか。|Bagaimana kalau kita juga mengambil foto?|
いいですね。白い 花を とりましょう。|Boleh. Mari memotret bunga putih itu.|senang`, [
    ['Bunga dibandingkan dengan apa?', 'Salju karena warnanya putih.', 'ゆきのように白い dan ゆきみたいです menyatakan kemiripan penampilan.'],
    ['Apa yang akhirnya akan dilakukan Claire dan Anna?', 'Memotret bunga putih.', 'Ajakan しゃしんをとりませんか diterima dengan 白い花をとりましょう.']
  ]);

add('06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb', 12, 'cafe',
  'Daniel dan Hadi membicarakan keinginan serta perasaan adik Hadi berdasarkan ucapan dan reaksi yang terlihat.', `
おとうとさんは どうしていますか。|Bagaimana kabar adik laki-laki Anda?|
げんきです。「うみへ いきたい」と なんども いっています。|Sehat. Ia berkali-kali berkata ingin pergi ke laut.|
うみへ いきたがっているんですね。|Jadi ia sedang ingin pergi ke laut, ya.|
はい。でも、大きい いぬを こわがっています。うみの ちかくに いぬが いるんです。|Ya. Tetapi ia takut kepada anjing besar. Ada anjing di dekat laut.|
そうですか。おとうとさんと いっしょに いきますか。|Oh, begitu. Apakah Anda akan pergi bersama adik?|
はい。来週、いっしょに いこうと おもっています。|Ya. Saya berniat pergi bersamanya minggu depan.|senang`, [
    ['Apa dasar pernyataan bahwa adik Hadi ingin ke laut?', 'Ia berkali-kali mengatakan ingin pergi ke laut.', 'Ucapan berulang うみへいきたい menjadi bukti untuk いきたがっている.'],
    ['Apa yang ditakuti adik Hadi?', 'Anjing besar di dekat laut.', 'Hadi menyebut 大きいいぬをこわがっています dan lokasi anjing itu.']
  ]);
