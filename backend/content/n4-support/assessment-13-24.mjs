// Reading/listening support for the fixed active N4 grammar sequence. No character dialogues.
export const chapters = [];
let sequence = 0;
function question(kind, text, prompt, answer, wrong1, wrong2, explanation, goal) {
  const options = [answer, wrong1, wrong2];
  for (let n = 0; n < sequence % 3; n++) options.push(options.shift());
  sequence++;
  return { prompt, options, answer, explanation, [kind === 'reading' ? 'passage' : 'audioScript']:text, goal };
}
function chapter(chapter, passages, listening) {
  const reading = passages.flatMap(([passage, questions]) => questions.map(q => question('reading',passage,...q)));
  const audio = listening.map(([script,...q]) => question('listening',script,...q));
  chapters.push({chapter,reading,listening:audio});
}

chapter(13,[
  ['えきから このみちを まっすぐ いくと、はしが あります。はしを わたって、みぎに まがると、としょかんが あります。としょかんに ついたら、わたしに でんわして ください。',[
    ['Sesudah menyeberangi jembatan, ke mana pembaca harus berbelok?','Ke kanan','Ke kiri','Kembali ke stasiun','Petunjuk setelah はしをわたって adalah みぎにまがる: berbelok ke kanan.',1],
    ['Kapan pembaca diminta menelepon?','Setelah sampai di perpustakaan','Sebelum keluar dari stasiun','Ketika belum menemukan jembatan','としょかんについたら menyatakan setelah tiba di perpustakaan.',1]
  ]],
  ['あした、はじめて にほんごの しけんを うけます。ともだちは「きょうは はやく ねたら どうですか」と いいました。わたしも そう おもいます。あした、しけんで じょうずに はなせると いいな。',[
    ['Apa saran teman untuk malam ini?','Tidur lebih awal','Belajar sepanjang malam tanpa tidur','Tidak mengikuti ujian','Saran teman ialah はやくねたらどうですか, yakni bagaimana kalau tidur lebih awal.',2],
    ['Apa yang diharapkan penulis?','Bisa berbicara dengan baik saat ujian','Ujiannya sudah selesai kemarin','Teman menggantikannya mengikuti ujian','じょうずにはなせるといいな menyatakan harapan dapat berbicara dengan baik.',3]
  ]]
],[
  ['このボタンを おすと、みずが でます。コップを おいたら、ボタンを おして ください。','Apa yang keluar ketika tombol ditekan?','Air','Karcis','Uang','みずがでます berarti air keluar; itu hasil otomatis menekan tombol.',1],
  ['あした、もし あめだったら、こうえんへは いきません。うちで えいがを みます。','Apa rencana pembicara jika besok hujan?','Menonton film di rumah','Pergi ke taman','Berenang di laut','Sesudah kondisi あめだったら, pembicara memilih うちでえいがをみます.',1],
  ['ほんが むずかしいんですか。まず、やさしいほんを よんだら どうですか。じしょも つかって みて ください。','Apa saran pertama pembicara?','Membaca buku yang mudah dahulu','Berhenti membaca semua buku','Membeli kamus lalu pergi tanpa membaca','まず diikuti やさしいほんをよんだらどうですか: mulai dari buku mudah.',2],
  ['らいしゅうは うみへ いきます。いい てんきだと いいですね。はれると、うみが とても きれいです。','Apa yang diharapkan untuk minggu depan?','Cuaca yang baik','Hujan sepanjang hari','Perjalanan dibatalkan','いいてんきだといいですね menyampaikan harapan cuaca baik.',3]
]);

chapter(14,[
  ['にちようび、じかんが あれば、いっしょに でかけませんか。うみへ いくなら、あさ はやく でましょう。でんしゃなら、いちじかんで つきます。バスは にじかん かかります。',[
    ['Apa syarat ajakan pergi bersama?','Ada waktu pada hari Minggu','Sudah membeli sepeda baru','Hujan turun pada hari Senin','にちようび、じかんがあれば adalah syarat keadaan untuk ajakan.',1],
    ['Transportasi apa yang memerlukan waktu satu jam?','Kereta','Bus','Keduanya dua jam','でんしゃなら、いちじかんでつきます menyatakan waktu tempuh kereta.',2]
  ]],
  ['きのう、かさを もたないで でかけました。かえりに あめが ふりました。かさを もって いけば よかったです。それから、バスを まちましたが、なかなか きませんでした。でんしゃで かえれば よかったです。',[
    ['Apa yang sebenarnya dilakukan penulis ketika berangkat?','Berangkat tanpa membawa payung','Membawa dua payung','Tidak jadi keluar rumah','かさをもたないででかけました menyatakan berangkat tanpa payung.',3],
    ['Transportasi apa yang kemudian dianggap lebih baik untuk pulang?','Kereta','Bus yang ditunggunya','Sepeda teman','でんしゃでかえればよかった adalah penyesalan: seandainya pulang naik kereta.',3]
  ]]
],[
  ['このへやが しずかであれば、ここで べんきょうしたいです。きょうは となりで こうじを していて、うるさいです。','Mengapa keinginan belajar di ruangan itu belum cocok dengan keadaan sekarang?','Sekarang ruangan itu terdengar bising','Ruangan itu terlalu murah','Pembicara tidak bisa membaca','Syaratnya tenang, tetapi saat ini うるさい karena pekerjaan konstruksi di sebelah. こうじ = pekerjaan konstruksi.',1],
  ['にほんごの じしょを かうなら、このみせが いいですよ。やすいし、しゅるいも おおいです。','Jika ingin membeli kamus, apa yang disarankan pembicara?','Toko ini','Stasiun yang baru dibangun','Tidak membeli apa pun','じしょをかうなら、このみせがいい menanggapi kebutuhan membeli kamus dengan rekomendasi toko.',2],
  ['きのう、しけんの べんきょうを しませんでした。きょうの しけんは むずかしかったです。もっと べんきょうすれば よかったです。','Apa yang disesali pembicara?','Tidak belajar lebih banyak sebelum ujian','Belajar terlalu banyak kemarin','Mengikuti ujian minggu depan','Penutur menyatakan tidak belajar kemarin lalu menyesal dengan べんきょうすればよかった.',3],
  ['あさ、コーヒーを たくさん のみました。いま、おなかが いたいです。こんなに のまなければ よかったです。','Apa yang sebenarnya sudah terjadi?','Pembicara minum banyak kopi','Pembicara sama sekali belum minum kopi','Pembicara meminta orang lain minum kopi','のまなければよかった adalah penyesalan setelah tindakan minum banyak kopi terjadi.',3]
]);

chapter(15,[
  ['にほんで はたらくために、にほんごを べんきょうしています。にほんごの ほんが よめるように、まいにち かんじを れんしゅうします。にちようびは、ほんを かりに としょかんへ いきます。',[
    ['Apa tujuan utama penulis belajar bahasa Jepang?','Bekerja di Jepang','Meminjam buku dari perpustakaan','Mengikuti pesta bersama teman','にほんではたらくために menyebut tujuan bekerja di Jepang.',2],
    ['Untuk apa penulis pergi ke perpustakaan pada Minggu?','Meminjam buku','Mengajar memasak','Membeli tiket kereta','ほんをかりに memakai batang ます＋に untuk tujuan meminjam buku.',1]
  ]],
  ['あしたの クラスでは、かみで はなを つくります。このはさみは かみを きるのに つかいます。せんせいは、はさみと かみを もって くるように いいました。はなを つくるのに、さんじゅっぷん かかります。',[
    ['Untuk apa gunting dipakai?','Memotong kertas','Mengukur waktu','Membawa bunga ke taman','かみをきるのにつかいます menjelaskan kegunaan gunting. はさみ = gunting.',3],
    ['Apa instruksi guru kepada peserta kelas?','Membawa gunting dan kertas','Membeli bunga yang sudah jadi','Tidak membawa perlengkapan','はさみとかみをもってくるようにいいました melaporkan instruksi membawa kedua benda.',3]
  ]]
],[
  ['あしたの パーティーのために、きょう りょうりを つくって おきます。あしたは じかんが ないからです。','Mengapa makanan disiapkan hari ini?','Untuk pesta besok ketika waktunya sempit','Karena pesta sudah selesai kemarin','Untuk sarapan sendiri pagi ini','パーティーのために menyatakan tujuan; besok tidak ada waktu.',2],
  ['わすれないように、ノートに じかんと ばしょを かいて ください。あつまるのは、くじに えきの まえです。','Mengapa waktu dan tempat perlu dicatat?','Agar tidak lupa','Agar acara dibatalkan','Agar datang satu hari lebih awal','わすれないように menyatakan hasil yang ingin dicapai: tidak lupa.',2],
  ['このどうぐは やさいを きるのに つかいます。てで きるより はやいです。つかいかたは、このせつめいしょに あります。','Apa kegunaan alat itu?','Memotong sayur','Menulis petunjuk','Menyimpan pakaian','やさいをきるのにつかいます menjelaskan fungsi memotong sayur.',3],
  ['せんせいは、あした くじまでに くるように いいました。おくれないように、はやく うちを でます。','Kapan murid diminta datang?','Paling lambat pukul sembilan besok','Setelah pukul sepuluh besok','Pukul sembilan kemarin','あしたくじまでにくるように adalah instruksi datang paling lambat pukul sembilan besok.',3]
]);

chapter(16,[
  ['あしたは しけんです。きょうは はやく ねたほうが いいです。よる おそくまで ゲームを しないほうが いいです。しけんでは えんぴつを つかいますから、えんぴつを もって こないと いけません。',[
    ['Kebiasaan apa yang disarankan untuk dihindari malam ini?','Bermain gim sampai larut','Tidur lebih awal','Membawa pensil','おそくまでゲームをしないほうがいい adalah saran negatif.',1],
    ['Apa yang wajib dibawa ke ujian?','Pensil','Konsol gim','Bantal','えんぴつをもってこないといけません menyatakan kewajiban membawa pensil.',2]
  ]],
  ['せんせいは がくせいに「もんだいを よく よみなさい」と いいました。こたえを すぐに かく ひつようは ありません。まず、なまえを かいて、それから もんだいを よんで ください。',[
    ['Siapa yang menyampaikan よみなさい kepada siapa?','Guru kepada siswa','Siswa kepada direktur perusahaan','Pelanggan kepada petugas toko','Teks secara eksplisit menyebut せんせいはがくせいに; なさい dipakai sebagai instruksi guru.',3],
    ['Apakah peserta perlu langsung menulis jawaban?','Tidak; tidak perlu segera menulis jawaban','Ya; semua jawaban harus langsung ditulis','Dilarang menulis jawaban sampai besok','こたえをすぐにかくひつようはありません menyatakan tidak perlu segera menulis jawaban, bukan larangan.',2]
  ]]
],[
  ['そのみちは よる くらいです。よるは ひとりで とおらないほうが いいですよ。えきの まえの あかるいみちを つかって ください。','Apa saran untuk jalan yang gelap itu?','Sebaiknya tidak dilewati sendirian pada malam hari','Sebaiknya selalu tidur di jalan itu','Wajib lewat di sana setiap malam','よるはひとりでとおらないほうがいい adalah saran menghindari jalan itu sendirian malam hari.',1],
  ['としょかんの ほんは あしたまでです。きょう かえさなくちゃ。もう よみましたから。','Apa yang merasa harus dilakukan pembicara hari ini?','Mengembalikan buku','Meminjam buku baru','Memperpanjang masa pinjam buku','かえさなくちゃ adalah bentuk percakapan kewajiban mengembalikan buku.',2],
  ['もう コピーは じゅうまい あります。がくせいも じゅうにんです。これから コピーを つくる ひつようは ありません。','Apakah perlu membuat salinan tambahan?','Tidak perlu karena sudah cukup','Wajib membuat sepuluh lagi','Dilarang membawa salinan yang ada','ひつようはありません berarti tidak perlu, dan jumlah salinan sudah sesuai jumlah siswa.',2],
  ['あぶない！ そこで とまれ！ くるまが きます。みちを わたるのは、くるまが とおってからです。','Mengapa terdengar perintah とまれ?','Ada kendaraan mendekat dan situasinya berbahaya','Petugas sedang menawarkan teh','Pembicara meminta perkenalan formal','あぶない dan くるまがきます memberi konteks darurat untuk perintah berhenti.',3]
]);

chapter(17,[
  ['きのうは おとうとの たんじょうびでした。わたしは おとうとに おもちゃを あげました。あねは おとうとに えほんを あげました。おとうとは わたしと あねに おれいを いいました。',[
    ['Apa yang diberikan penulis kepada adik laki-laki?','Mainan','Buku bergambar','Bunga','わたしはおとうとにおもちゃをあげました menjelaskan hadiah dari penulis.',1],
    ['Siapa yang memberikan buku bergambar?','Kakak perempuan','Penulis','Adik laki-laki','あねは…えほんをあげました menyatakan kakak perempuan sebagai pemberi. えほん = buku bergambar.',1]
  ]],
  ['わたしは せんぱいから このかばんを もらいました。きょねんの たんじょうびの おいわいです。ことしは、せんぱいが わたしに ペンを くれました。どちらも まいにち つかっています。',[
    ['Dari siapa penulis menerima tas?','Senior','Adik perempuan','Perusahaan','せんぱいから…もらいました menunjukkan senior sebagai sumber pemberian.',2],
    ['Apa yang senior berikan tahun ini?','Pena','Tas yang disebut untuk tahun lalu','Sepeda','ことしは…ペンをくれました membedakan hadiah tahun ini dari tas tahun lalu.',3]
  ]]
],[
  ['あしたは ともだちの たんじょうびです。わたしは ともだちに はなを あげます。ほんは、べつの ともだちが あげます。','Siapa yang akan memberikan bunga?','Pembicara','Teman lain yang memberi buku','Orang yang berulang tahun','わたしは…はなをあげます menyebut pembicara sebagai pemberi bunga.',1],
  ['このカレンダーは かいしゃから もらいました。うちの かべに かけて います。','Dari mana kalender itu diperoleh?','Perusahaan','Toko buku yang dikunjungi kemarin','Adik pembicara','かいしゃからもらいました menyatakan menerima kalender dari perusahaan.',2],
  ['きのう、そぼが わたしの むすめに おもちゃを くれました。むすめは とても よろこんで います。','Siapa penerima mainan?','Anak perempuan pembicara','Nenek','Pembicara sendiri','わたしのむすめに menunjukkan anak perempuan pembicara sebagai penerima dekat pihak pembicara.',3],
  ['このゆびわは、ははに もらいました。わたしの たんじょうびに、ははが くれたんです。','Bagaimana arah perpindahan cincin itu?','Ibu memberikan cincin kepada pembicara','Pembicara memberikan cincin kepada ibu','Ibu menerima cincin dari anak lain','ははにもらいました dan ははがくれた menjelaskan arah yang sama: ibu → pembicara.',2]
]);

chapter(18,[
  ['ひっこしの とき、ともだちが わたしの にもつを もって くれました。わたしは あにに くるまで えきまで おくって もらいました。つぎの ひ、わたしは ともだちに りょうりを つくって あげました。',[
    ['Siapa yang membawakan barang bawaan penulis?','Teman','Kakak laki-laki','Penulis membawakan barang orang lain','ともだちが…もってくれました menempatkan teman sebagai pelaku bantuan.',1],
    ['Bantuan apa yang diterima dari kakak laki-laki?','Diantar naik mobil sampai stasiun','Dibuatkan masakan','Dibelikan rumah baru','あにに…えきまでおくってもらいました menunjukkan bantuan mengantar ke stasiun.',1]
  ]],
  ['ともだちへ。あした、うちへ きて ほしいです。ひっこしの にもつが たくさん ありますから、すこし てつだって もらえませんか。じかんは ごご にじです。むりなら、れんらくして ください。',[
    ['Apa yang diminta penulis kepada teman?','Membantu mengurus barang pindahan','Meminjamkan uang untuk rumah','Membatalkan semua jadwal teman','てつだってもらえませんか adalah permintaan bantuan dengan barang pindahan.',2],
    ['Apa yang diharapkan penulis terjadi besok?','Teman datang ke rumah pukul dua siang','Teman pergi sendiri ke bandara','Penulis datang ke kantor teman pagi hari','うちへきてほしい dan ごごにじ menyatakan harapan datang pukul dua siang.',3]
  ]]
],[
  ['ともだちが わたしの パソコンを なおして くれました。いまは また つかえます。ほんとうに たすかりました。','Siapa yang memperbaiki komputer?','Teman pembicara','Pembicara sendiri','Penjual komputer yang tidak disebut','ともだちが…なおしてくれました menyebut pelaku bantuan dengan jelas.',1],
  ['すみません。えきまでの みちを おしえて もらえませんか。ちずを みても、よく わからないんです。','Bantuan apa yang diminta?','Menjelaskan jalan ke stasiun','Membeli peta baru','Mengantar paket ke sekolah','えきまでのみちをおしえてもらえませんか meminta penjelasan rute ke stasiun.',2],
  ['あしたは はやいので、こんやは おそくまで おおきな こえで はなさないで ほしいです。','Apa yang diharapkan pembicara tidak dilakukan malam ini?','Berbicara keras sampai larut','Datang lebih awal besok','Membaca buku pada pagi hari','おおきなこえではなさないでほしい menyatakan keinginan agar tindakan itu tidak dilakukan.',3],
  ['きょうは うちまで おくって くれて、ありがとう。あめが ふって いたから、とても たすかりました。','Untuk tindakan apa pembicara berterima kasih?','Diantar sampai rumah','Diberi hadiah ulang tahun','Diajari menulis surat','うちまでおくってくれて、ありがとう menyebut tindakan mengantar sebagai dasar terima kasih.',3]
]);

chapter(19,[
  ['あしたの クラスに なんにん くるか、かくにんして います。いま、さんかすると いった ひとは はちにんだけです。あと ふたりは、こられるかどうか まだ わかりません。',[
    ['Apa informasi yang sedang dikonfirmasi?','Berapa orang yang datang ke kelas besok','Siapa yang membeli gedung sekolah','Berapa harga semua buku','なんにんくるか adalah pertanyaan tertanam tentang jumlah peserta.',1],
    ['Berapa orang yang sudah menyatakan akan ikut?','Delapan orang','Sepuluh orang sudah pasti','Dua orang saja','はちにんだけです membatasi jumlah yang sudah menyatakan ikut; dua lainnya belum pasti.',2]
  ]],
  ['このとしょかんは、がくせいだけでなく、まちの ひとも つかえます。カードに なまえを かくだけで、ほんが かりられます。きのうは、いちにちで ごひゃくにんも きました。とても おおいですね。',[
    ['Siapa yang boleh menggunakan perpustakaan?','Siswa dan warga kota','Hanya siswa','Hanya guru dari luar kota','がくせいだけでなく、まちのひとも menambahkan warga kota kepada siswa.',3],
    ['Apa yang cukup dilakukan untuk meminjam buku?','Menulis nama pada kartu','Membeli lima buku','Menunggu sampai lima ratus orang datang','なまえをかくだけで menyatakan langkah minimal untuk dapat meminjam.',3]
  ]]
],[
  ['あのひとが せんせいかどうか、わかりません。なまえは しっていますが、しごとは まだ きいて いません。','Apa yang belum diketahui pembicara?','Apakah orang itu guru atau bukan','Nama orang itu','Apakah orang itu sedang tidur','せんせいかどうか menyatakan pertanyaan ya/tidak tentang pekerjaan guru.',1],
  ['おかねは さんびゃくえんしか ありません。このほんは ごひゃくえんですから、いまは かえません。','Berapa uang pembicara?','300 yen','500 yen','Tidak ada sama sekali','さんびゃくえんしかありません berarti hanya ada 300 yen, bukan nol.',2],
  ['おとうとは さいきん ゲームを してばかり います。ほんを あまり よみません。もうすこし ほんも よんで ほしいです。','Kebiasaan apa yang dikeluhkan?','Terlalu sering bermain gim','Terlalu banyak membaca buku','Tidak pernah bermain gim','してばかりいます menekankan kegiatan gim yang mendominasi, bukan baru selesai satu kali.',2],
  ['あしたの パーティーには、じゅうにんは きます。あと ふたりも くるかも しれません。','Berapa jumlah minimum yang diperkirakan datang?','Sepuluh orang','Dua orang','Dua belas orang sudah pasti','じゅうにんはきます menempatkan sepuluh sebagai batas minimal; dua tambahan masih mungkin.',3]
]);

chapter(20,[
  ['このみせは、えきの みせほど たかく ありません。えきから あるいて じゅっぷんぐらいです。わたしは いっしゅうかんに にかい、ここで かいものを します。きょうは さんじごろ いく つもりです。',[
    ['Bagaimana harga toko ini dibanding toko di stasiun?','Tidak semahal toko di stasiun','Lebih mahal daripada toko di stasiun','Pasti sama harganya','えきのみせほどたかくありません menyatakan tidak semahal toko pembanding.',1],
    ['Seberapa sering penulis berbelanja di toko ini?','Dua kali seminggu','Setiap dua minggu sekali','Dua kali sehari','いっしゅうかんににかい berarti dua kali dalam satu minggu.',2]
  ]],
  ['このクラスは、じゅうはっさい いじょうの ひとが さんかできます。にもつは ごキロ いかに して ください。あめの ばあいは、きょうしつで れんしゅうします。せんせいが せつめいした とおりに、じゅんびして ください。',[
    ['Apakah orang yang tepat berusia 18 tahun memenuhi batas usia?','Ya, 18 termasuk dalam 以上','Tidak, harus 19 tahun','Tidak, hanya orang di bawah 18','以上 mencakup angka batas, sehingga usia tepat 18 memenuhi aturan.',2],
    ['Jika hujan, di mana latihan dilakukan?','Di ruang kelas','Di luar stasiun','Di pantai','あめのばあいは、きょうしつで menyatakan prosedur bila hujan.',3]
  ]]
],[
  ['うちから えきまで さんじゅっぷんぐらい かかります。あしたは はちじごろ うちを でます。','Apa yang dinyatakan はちじごろ?','Waktu berangkat sekitar pukul delapan','Lama perjalanan sekitar delapan jam','Waktu tiba pasti tepat pukul delapan','ごろ mengikuti titik waktu はちじ; durasi perjalanan terpisah adalah sekitar 30 menit.',1],
  ['このバスは じゅうごふんごとに きます。つぎは にじに きます。そのつぎは にじじゅうごふんです。','Berapa interval kedatangan bus?','Setiap 15 menit','Setiap 2 jam','Setiap 30 menit','じゅうごふんごとに menyatakan setiap lima belas menit, diperjelas 2.00 lalu 2.15.',2],
  ['このサービスは、ろくさい みまんの こどもは むりょうです。ろくさいの こどもは、ひゃくえんです。','Apakah anak tepat usia enam tahun gratis?','Tidak; ia membayar 100 yen','Ya; semua anak enam tahun gratis','Tidak ada informasi tentang usia enam','未満 tidak memasukkan batas enam; teks juga menyebut harga 100 yen untuk usia enam.',2],
  ['へやを でるときは、でんきを けして ください。きのうは だれかが でんきを つけたまま かえりました。','Keadaan apa yang tertinggal kemarin?','Lampu tetap menyala setelah seseorang pulang','Pintu sudah dicat','Semua lampu sudah diganti','でんきをつけたままかえりました menunjukkan keadaan lampu tetap menyala.',3]
]);

chapter(21,[
  ['きのう、わたしは せんせいに さくぶんを ほめられました。とても うれしかったです。でも、かえりの でんしゃで、となりの ひとに あしを ふまれました。いたかったです。',[
    ['Siapa yang memuji karangan penulis?','Guru','Orang di sebelah dalam kereta','Penulis memuji gurunya','せんせいに…ほめられました menandai guru sebagai pelaku pujian.',2],
    ['Apa kejadian tidak menyenangkan saat pulang?','Kaki penulis diinjak','Karangan penulis dicuri','Guru memarahi penulis','あしをふまれました adalah pasif yang menyatakan dampak pada bagian tubuh penulis.',2]
  ]],
  ['このびじゅつかんは、さんじゅうねんまえに たてられました。ここには、まちの ひとによって かかれた えが あります。このえは わたしの そふによって かかれました。えには、むかしの えきが かいて あります。',[
    ['Kapan museum itu dibangun?','Tiga puluh tahun lalu','Tiga tahun lalu','Tiga puluh hari yang lalu','さんじゅうねんまえにたてられました menyatakan waktu pembangunan tiga puluh tahun lalu.',3],
    ['Siapa pembuat lukisan yang terakhir ditunjukkan penulis?','Kakek penulis','Penulis sendiri','Guru yang tidak disebut','このえはわたしのそふによってかかれました menyebut kakek sebagai pencipta. びじゅつかん = museum seni.',3]
  ]]
],[
  ['このやさいは やわらかいので、ちいさい こどもでも たべられます。おいしいですよ。','Apa makna たべられます pada konteks ini?','Anak kecil pun dapat memakannya','Sayuran itu dipaksa makan anak','Anak sudah dimakan oleh seseorang','やわらかいので dan こどもでも menunjukkan kemampuan/kemudahan makan, bukan penerima tindakan pasif.',1],
  ['わたしは きのう、せんせいに しかられました。しゅくだいを わすれたからです。','Apa makna しかられました dalam pengumuman pribadi ini?','Pembicara dimarahi oleh guru','Pembicara mampu memarahi guru','Pembicara menyuruh guru marah','わたしはせんせいに menampilkan penerima dan pelaku tindakan; bentuk ini pasif.',1],
  ['かえりに あめに ふられました。かさが なかったので、ふくが ぬれて しまいました。','Apa akibat kehujanan bagi pembicara?','Pakaiannya menjadi basah','Ia mendapat payung baru','Semua pakaiannya dicuci orang lain','あめにふられました diikuti ふくがぬれた menunjukkan dampak tidak menyenangkan. ぬれる = menjadi basah.',2],
  ['このあたらしい どうぐは、わたしたちの グループによって つくられました。やさいを はやく きるのに つかいます。','Siapa yang membuat alat baru itu?','Kelompok pembicara','Tamu museum','Anak kecil yang tidak disebut','わたしたちのグループによって menandai pihak pembuat dalam pasif penciptaan.',3]
]);

chapter(22,[
  ['きょう、せんせいは がくせいに さくぶんを かかせました。わたしは まだ おわって いませんでした。「もうすこし かかせて ください」と いったら、せんせいは じゅっぷん まって くれました。',[
    ['Siapa yang menulis karangan atas instruksi?','Siswa','Guru','Petugas perpustakaan','せんせいはがくせいに…かかせました berarti guru menyuruh siswa menulis.',1],
    ['Apa yang penulis minta melalui かかせてください?','Izin melanjutkan menulis sedikit lagi','Agar guru menulis menggantikannya','Agar semua siswa berhenti menulis','かかせてください pada ucapan penulis meminta izin agar dirinya menulis.',2]
  ]],
  ['きのう、わたしは じょうしに おそくまで はたらかされました。きょうは やすみたかったのですが、また しごとを させられました。あしたは やすみだと いいなと おもっています。',[
    ['Bagaimana pembicara memandang pekerjaan sampai larut kemarin?','Sebagai tindakan yang terpaksa dilakukan','Sebagai izin libur yang diinginkan','Sebagai pekerjaan yang dilakukan atasannya sendiri','はたらかされました adalah kausatif-pasif pendek; pembicara dipaksa bekerja.',3],
    ['Apa yang terjadi hari ini?','Pembicara kembali disuruh bekerja','Pembicara berhasil libur sepanjang hari','Atasan menggantikan semua pekerjaannya','またしごとをさせられました menunjukkan kembali disuruh bekerja meskipun ingin istirahat.',3]
  ]]
],[
  ['せんせいは がくせいに このぶんを よませました。それから、いみを せつめいしました。','Siapa yang membaca kalimat itu?','Siswa','Guru saja','Orang tua siswa','がくせいによませました menandai siswa sebagai pelaku yang disuruh membaca.',1],
  ['せんせい、すこし はなさせて ください。きょうの れんしゅうについて、しつもんが あります。','Apa yang diminta pembicara?','Izin agar dirinya berbicara','Agar guru berhenti bekerja besok','Agar teman menulis karangannya','はなさせてください meminta kesempatan bagi pembicara untuk berbicara.',2],
  ['むすめは パーティーに いきたがって いました。しゅくだいが おわったので、わたしは いかせて あげました。','Mengapa kausatif di sini bermakna memberi izin?','Anak ingin pergi, lalu diizinkan setelah PR selesai','Anak tidak ingin pergi tetapi dipaksa','Pembicara menggantikan anak pergi ke pesta','Konteks いきたがっていた dan いかせてあげた menyatakan kesempatan memenuhi keinginan anak.',2],
  ['わたしは せんせいに なんども さくぶんを かかされました。もう ごかいめです。すこし つかれました。','Apa yang dilakukan pembicara berulang kali?','Menulis karangan karena disuruh','Memuji karangan guru','Mengizinkan guru menulis','かかされました adalah bentuk pendek かかせられました: disuruh/terpaksa menulis.',3]
]);

chapter(23,[
  ['せんせいは、あした くじに がっこうへ いらっしゃいます。はじめに、がくせいの えを ごらんに なります。それから、このほんを およみに なります。ひるごはんは がっこうで めしあがります。',[
    ['Apa yang guru lakukan pertama kali setelah datang?','Melihat gambar siswa','Makan siang','Pulang dari sekolah','はじめに…えをごらんになります menyatakan kegiatan pertama melihat gambar.',2],
    ['Apa makna およみになります pada teks?','Guru membaca buku dengan ungkapan hormat','Siswa membacakan buku untuk guru','Guru dipaksa menulis buku','お＋よみ＋になる adalah pola sonkeigo untuk tindakan membaca oleh guru.',1]
  ]],
  ['おきゃくさまへ。こちらで すこし おまちください。せんせいは じゅうじに いらっしゃいます。おまちの あいだ、このへやを ごりようください。おちゃは つくえの うえに あります。',[
    ['Apa yang diminta dari tamu saat ini?','Menunggu sebentar di sini','Segera meninggalkan gedung','Membawa meja ke luar','こちらですこしおまちください adalah instruksi hormat untuk menunggu.',3],
    ['Apa yang boleh digunakan selama menunggu?','Ruangan ini','Kantor pribadi di lantai lain','Mobil guru','このへやをごりようください secara eksplisit mempersilakan memakai ruangan ini.',3]
  ]]
],[
  ['しゃちょうは もう おかえりに なりました。あしたは くじに いらっしゃいます。','Apa yang sudah dilakukan direktur?','Sudah pulang','Sudah memulai rapat besok','Sudah makan di kelas','おかえりになりました adalah bentuk hormat untuk sudah pulang.',1],
  ['せんせいは「あしたは やすみです」と おっしゃいました。ですから、あしたの クラスは ありません。','Apa yang dikatakan guru?','Besok libur','Besok semua kelas ditambah','Kemarin tidak ada guru','おっしゃいました menghormati tindakan mengatakan; isi kutipannya あしたはやすみです.',2],
  ['せんせいは このまちを よく ごぞんじです。まちの れきしについても、たくさん しって いらっしゃいます。','Apa yang diketahui guru dengan baik?','Kota ini','Semua kota di dunia','Jadwal kereta besok saja','このまちをよくごぞんじです menyatakan guru mengenal kota ini dengan baik. れきし = sejarah.',2],
  ['なまえは、このかみの いちばん うえに おかきください。そのあと、こちらで おまちください。','Di mana nama diminta ditulis?','Di bagian paling atas kertas ini','Di belakang pintu','Di lantai ruang tunggu','このかみのいちばんうえにおかきください memberi instruksi lokasi penulisan nama.',3]
]);

chapter(24,[
  ['はじめまして。やまだと もうします。わたしが かいぎしつまで ごあんないいたします。かいぎしつは にかいに ございます。にもつは、わたしが おもちします。',[
    ['Siapa yang akan mengantar tamu dan membawa barang?','Yamada sebagai pembicara','Tamu yang sedang disambut','Guru yang tidak disebut','わたしがごあんないいたします dan わたしがおもちします merendahkan tindakan pembicara sendiri.',1],
    ['Di mana ruang rapat berada?','Lantai dua','Lantai satu','Di luar gedung','にかいにございます menyatakan lokasi di lantai dua dengan bahasa formal.',2]
  ]],
  ['せんせいへ。きのうは、さくぶんを みて いただき、ありがとうございました。せんせいが おしえて くださった ことを ノートに かきました。もういちど なおしましたので、らいしゅう みて いただけませんか。',[
    ['Untuk tindakan apa penulis berterima kasih?','Guru memeriksa karangannya','Guru menerima hadiah dari penulis','Penulis memeriksa karangan guru','さくぶんをみていただき、ありがとうございました menyatakan bantuan memeriksa karangan yang diterima penulis.',3],
    ['Apa permintaan penulis untuk minggu depan?','Guru memeriksa karangan yang telah diperbaiki','Guru menulis semua karangan dari awal','Guru membatalkan pelajaran','もういちどなおしましたので…みていただけませんか meminta pemeriksaan setelah revisi.',3]
  ]]
],[
  ['あした、ごじに せんせいの おたくに うかがいます。せんせいの あたらしい ほんを はいけんします。','Siapa yang akan berkunjung dan melihat buku?','Pembicara','Guru berkunjung ke rumah pembicara','Tamu lain yang tidak disebut','うかがいます dan はいけんします adalah tindakan pembicara yang merendah kepada pihak guru.',1],
  ['こちらが うけつけで ございます。おてあらいは、あちらに ございます。','Apa yang ditunjukkan sebagai tempat di sini?','Bagian penerimaan','Toilet','Ruang makan','こちらがうけつけでございます menyatakan identitas tempat ini; toilet ditunjuk あちら. うけつけ = bagian penerimaan.',2],
  ['せんせいから、あたらしい ほんを いただきました。わたしは おれいに はなを さしあげました。','Bagaimana arah pemberian buku?','Guru memberikan buku kepada pembicara','Pembicara memberikan buku kepada guru','Guru menerima buku dari toko yang tidak disebut','せんせいからほんをいただきました menempatkan pembicara sebagai penerima dari guru.',3],
  ['おてすうですが、ここに おなまえを かいて いただけませんか。そのあと、こちらで おまちください。','Apa yang diminta dilakukan terlebih dahulu?','Menuliskan nama di sini','Menunggu tanpa menulis nama','Pergi membawa formulir','かいていただけませんか adalah permintaan menulis nama; そのあと menyatakan menunggu sesudahnya.',3]
]);

export default chapters;
