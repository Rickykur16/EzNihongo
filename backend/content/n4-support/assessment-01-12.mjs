// Reading and single-speaker listening support. No character conversations.
export const chapters = [];
let questionIndex = 0;
function question(material, tuple, field) {
  const [prompt, answer, wrong1, wrong2, explanation, goal] = tuple;
  const options = [wrong1, wrong2];
  options.splice(questionIndex++ % 3, 0, answer);
  return { prompt, options, answer, explanation, [field]: material, goal };
}
function add(chapter, passage1, reading1, passage2, reading2, listening) {
  chapters.push({ chapter,
    reading: [...reading1.map(q => question(passage1, q, 'passage')), ...reading2.map(q => question(passage2, q, 'passage'))],
    listening: listening.map(([script, ...q]) => question(script, q, 'audioScript'))
  });
}

add(1,
  'これは 母が つくった りょうりです。母は りょうりを つくるのが じょうずです。わたしも 母と いっしょに つくりました。りょうりを つくるのは たのしいです。', [
    ['Masakan yang dimaksud dibuat oleh siapa?', 'Ibu, dengan pembicara ikut memasak.', 'Ayah sendirian.', 'Teman di sebuah restoran.', '母がつくった menerangkan masakan; pembicara juga menyebut ikut membuat bersama ibu.', 1],
    ['Kegiatan apa yang dinilai menyenangkan?', 'Membuat masakan.', 'Membeli peralatan.', 'Makan di restoran.', 'りょうりをつくるのはたのしい menilai kegiatan memasak sebagai menyenangkan.', 2]
  ],
  'わたしの しゅみは しゃしんを とることです。きのう、こうえんで 花の しゃしんを とりました。あかい 花と 白い 花が ありました。白いのが とても きれいでした。', [
    ['Apa hobi pembicara?', 'Memotret.', 'Mengumpulkan perangko.', 'Menanam pohon.', 'しゅみはしゃしんをとることです menyebut kegiatan memotret sebagai hobi.', 2],
    ['白いの menggantikan benda apa dalam bacaan?', 'Bunga putih.', 'Kamera putih.', 'Tas putih.', 'Benda yang sedang dibicarakan ialah bunga; の menggantikan 花 setelah sifat 白い.', 3]
  ], [
    ['あそこで 本を よんでいる 人は わたしの あねです。日本語の 本を よんでいます。あねは 毎日 本を よみます。', 'Siapa orang yang sedang membaca di sana?', 'Kakak perempuan pembicara.', 'Guru pembicara.', 'Adik laki-laki pembicara.', '本をよんでいる人 dijelaskan sebagai わたしのあね.', 1],
    ['わたしは およぐのが すきです。でも、あまり じょうずじゃありません。日よう日に 友だちと およぎます。', 'Bagaimana hubungan kesukaan dan kemampuan pembicara?', 'Suka berenang, tetapi belum begitu mahir.', 'Tidak suka berenang, tetapi sangat mahir.', 'Suka menari dan tidak pernah berenang.', 'すき menyatakan kesukaan; あまりじょうずじゃありません menyatakan tingkat kemahiran rendah.', 2],
    ['かばんを かいました。大きいのと 小さいのが ありました。わたしは 小さいのを えらびました。', 'Tas yang mana dipilih?', 'Yang kecil.', 'Yang besar.', 'Keduanya.', '小さいのをえらびました berarti memilih tas yang kecil; の menggantikan かばん.', 3],
    ['きのう、こうえんで 子どもが うたうのを ききました。子どもたちは 日本語で うたっていました。', 'Kejadian apa yang didengar langsung?', 'Anak-anak bernyanyi dalam bahasa Jepang.', 'Guru membaca pengumuman.', 'Teman berbicara melalui telepon.', 'うたうのをききました menominalkan kejadian bernyanyi yang didengar langsung.', 2]
  ]);

add(2,
  'きのう、学校を 休みました。びょうきだったんです。友だちは「ゆっくり 休んでください」と いいました。きょうは げんきです。あしたは 学校へ いきます。', [
    ['Mengapa pembicara tidak masuk sekolah kemarin?', 'Karena sedang sakit.', 'Karena sekolah bernama Sakura.', 'Karena pergi berlibur ke Jepang.', 'びょうきだったんです menjelaskan latar ketidakhadiran kemarin.', 1],
    ['Apa pesan temannya?', 'Beristirahatlah tanpa terburu-buru.', 'Datang ke sekolah malam ini.', 'Belilah buku baru.', 'Kutipan ゆっくり休んでください dilaporkan dengan といいました.', 2]
  ],
  'さくらという みせで 友だちと ごはんを たべました。わたしは この みせの りょうりは おいしいと おもいます。友だちは「また 来たいです」と いっていました。日よう日も あいているのかな。', [
    ['さくらというみせ menyatakan apa?', 'Nama toko makan adalah Sakura.', 'Teman pembicara bernama Sakura.', 'Sakura sedang mengatakan sesuatu.', 'という menghubungkan nama さくら dengan jenis tempat みせ.', 3],
    ['Informasi apa yang masih diragukan pembicara?', 'Apakah toko buka juga pada hari Minggu.', 'Apakah ia sudah makan di toko itu.', 'Apakah temannya ingin datang lagi.', 'Kalimat terakhir memakai のかな untuk bertanya-tanya apakah toko buka hari Minggu.', 3]
  ], [
    ['きょうは はやく かえります。あした しけんが あるんです。いえで べんきょうします。', 'Apa alasan pulang lebih awal?', 'Besok ada ujian.', 'Hari ini tidak ada sekolah.', 'Teman datang dari Jepang.', 'あるんです menjelaskan bahwa adanya ujian besok melatarbelakangi pulang lebih awal.', 1],
    ['この 本は おもしろいと おもいます。わたしは きのう ぜんぶ よみました。友だちも「おもしろかった」と いっていました。', 'Bagaimana penilaian pembicara dan temannya?', 'Keduanya menilai bukunya menarik.', 'Keduanya menilai bukunya membosankan.', 'Pembicara suka, temannya menyebut mahal.', 'Pembicara memakai とおもいます; pendapat teman dikutip sebagai おもしろかった.', 2],
    ['あおいそらという 本を さがしているんですが、どこに ありますか。', 'Bantuan apa yang diminta pembicara?', 'Menunjukkan lokasi buku berjudul Aoi Sora.', 'Menjelaskan cuaca besok.', 'Menyebut nama penulis semua buku.', 'という memperkenalkan judul; さがしているんですが membuka pertanyaan lokasi.', 3],
    ['先生は「あしたの じゅぎょうは 九時からです」と いいました。八時じゃありません。九時です。', 'Pukul berapa pelajaran besok mulai?', 'Pukul 9.', 'Pukul 8.', 'Pukul 10.', 'Pesan guru menyatakan 九時から; 八時 secara eksplisit disangkal.', 2]
  ]);

add(3,
  'あしたは 九時まで としょかんで べんきょうします。それから 学校へ いきます。十時までに 学校へ 来てくださいと 先生が いいました。学校へ いくまえに、コンビニで 水を かいます。', [
    ['Apa yang dilakukan sampai pukul 9?', 'Belajar di perpustakaan.', 'Menunggu di sekolah.', 'Membeli air selama satu jam.', '九時まで menandai kegiatan belajar yang berlangsung sampai pukul sembilan.', 2],
    ['Kapan air dibeli relatif terhadap pergi ke sekolah?', 'Sebelum pergi ke sekolah.', 'Sesudah pelajaran selesai.', 'Ketika sedang tidur.', '学校へいくまえに menempatkan pembelian air sebelum perjalanan ke sekolah.', 1]
  ],
  'きのう、電車に のっているあいだ、ずっと 本を よんでいました。いえに かえったあとで、おんがくを ききながら りょうりを つくりました。夜は テレビを みないで、ねました。', [
    ['Apa yang berlangsung sepanjang naik kereta?', 'Membaca buku.', 'Memasak.', 'Menonton televisi.', 'あいだ dan ずっと menegaskan membaca berlangsung sepanjang rentang perjalanan.', 1],
    ['Manakah pasangan kegiatan yang bersamaan?', 'Memasak dan mendengarkan musik.', 'Tidur dan menonton televisi.', 'Membaca dan memasak di kereta.', 'ききながらりょうりをつくりました menyatakan memasak sambil mendengarkan musik.', 3]
  ], [
    ['レポートは 金曜日までに かいてください。金曜日の 五時までに 先生に みせてください。', 'Kapan laporan harus sudah diperlihatkan kepada guru?', 'Paling lambat Jumat pukul 5.', 'Mulai ditulis setelah Jumat pukul 5.', 'Hanya boleh dibaca pada hari Minggu.', 'までに menunjukkan tenggat penyelesaian, bukan waktu mulai.', 2],
    ['昼休みのあいだに、ぎんこうへ いきました。それから パンを かいました。ごはんを たべたあとで、しごとを はじめました。', 'Kapan pekerjaan dimulai?', 'Setelah makan.', 'Sebelum pergi ke bank.', 'Ketika membeli roti.', 'たべたあとで menempatkan awal pekerjaan sesudah makan.', 1],
    ['休みのひは、しゃしんを とったり、本を よんだりします。ときどき、友だちと ごはんを たべます。', 'Apa fungsi daftar memotret dan membaca dalam simakan?', 'Contoh kegiatan hari libur.', 'Urutan wajib yang tidak boleh berubah.', 'Dua kegiatan yang selalu dilakukan bersamaan.', 'たり menyebut beberapa contoh kegiatan; urutannya tidak dijadikan fokus.', 3],
    ['きょうは あさごはんを たべないで、学校へ いきました。学校で パンを たべました。', 'Kapan pembicara makan?', 'Setelah sampai di sekolah.', 'Sebelum berangkat ke sekolah.', 'Sambil berjalan ke sekolah.', 'たべないで berarti berangkat tanpa sarapan; roti baru dimakan di sekolah.', 3]
  ]);

add(4,
  'この としょかんでは、日本語の 本を よむことができます。パソコンも つかえます。でも、ここでは ごはんを たべることができません。ごはんは 外で たべてください。', [
    ['Selain membaca, kegiatan apa yang dapat dilakukan di perpustakaan?', 'Menggunakan komputer.', 'Makan di dalam.', 'Memasak untuk pengunjung.', 'パソコンもつかえます menyatakan komputer juga dapat dipakai.', 1],
    ['Apa maksud たべることができません dalam konteks ini?', 'Makan di dalam tidak diperbolehkan oleh aturan tempat.', 'Semua pengunjung tidak mampu mengunyah.', 'Tidak ada seorang pun yang lapar.', 'Instruksi agar makan di luar memperjelas bahwa larangan berasal dari aturan fasilitas.', 1]
  ],
  'わたしの へやは 二かいです。まどから 山が みえます。となりの へやから ピアノの おとが します。だいどころから コーヒーの いい においが します。', [
    ['Apa yang terlihat dari jendela?', 'Gunung.', 'Piano.', 'Kopi.', '山がみえます menjelaskan sesuatu yang terlihat, bukan kemampuan memainkan musik.', 2],
    ['Sensasi apa yang datang dari dapur?', 'Aroma kopi.', 'Bunyi piano.', 'Rasa lemon.', 'コーヒーのいいにおいがします berarti tercium aroma kopi yang harum.', 3]
  ], [
    ['わたしは 日本語の 本が よめます。でも、長い てがみは まだ かけません。毎日 れんしゅうしています。', 'Apa kemampuan pembicara sekarang?', 'Bisa membaca buku Jepang, tetapi belum bisa menulis surat panjang.', 'Bisa menulis surat panjang, tetapi tidak bisa membaca.', 'Tidak pernah berlatih bahasa Jepang.', 'よめます menunjukkan kemampuan membaca; まだかけません menunjukkan keterbatasan menulis.', 1],
    ['ここから うみが みえます。今日は てんきが いいです。とおくの 山も みえます。', 'Apa yang disampaikan dengan みえます?', 'Laut dan gunung tertangkap oleh penglihatan dari posisi ini.', 'Pembicara mendapat izin menonton film.', 'Pembicara ingin belajar berenang.', 'Konteks lokasi dan cuaca menunjukkan penglihatan langsung.', 2],
    ['この あめは レモンの あじが します。おいしいです。', 'Rasa apa yang disebutkan?', 'Lemon; pembicara menyukainya.', 'Kopi; pembicara tidak menyukainya.', 'Teh; pembicara belum mencicipinya.', 'レモンのあじがします menyatakan rasa lemon; pembicara menilainya enak.', 3],
    ['この サイトで 日本の ラジオが きけます。わたしは 毎朝 きいています。日本語の れんしゅうです。', 'Apa yang disediakan situs itu?', 'Akses mendengarkan radio Jepang.', 'Suara tetangga yang masuk lewat jendela.', 'Larangan belajar bahasa Jepang.', 'きけます di konteks situs menunjukkan akses/kemungkinan mendengarkan, bukan suara yang terdengar dengan sendirinya.', 2]
  ]);

add(5,
  '来年、日本へ いこうと おもっています。わたしは 日本語の 学校に かようことにしました。学校の じゅぎょうは 四月から はじまることになりました。いまは 毎日 日本語を べんきょうしています。', [
    ['Keputusan mana yang diambil sendiri oleh pembicara?', 'Mengikuti sekolah bahasa Jepang.', 'Menetapkan semua sekolah mulai April.', 'Membatalkan perjalanan ke Jepang.', 'かようことにしました menonjolkan keputusan pribadi untuk mengikuti sekolah.', 2],
    ['Apa status rencana pergi ke Jepang?', 'Niat untuk tahun depan.', 'Kejadian yang selesai tahun lalu.', 'Perintah kepada teman untuk pergi besok.', 'いこうとおもっています menyatakan niat; 来年 menentukan waktunya.', 1]
  ],
  '毎朝、日本語の 本を よむことにしています。はじめは あまり よめませんでした。いまは かんたんな 本が よめるようになりました。わからない ことばは じしょで しらべるようにしています。', [
    ['Perubahan kemampuan apa yang dialami?', 'Sekarang bisa membaca buku sederhana.', 'Sekarang tidak bisa membaca sama sekali.', 'Sekarang pasti memahami semua kata tanpa kamus.', 'よめるようになりました menunjukkan kemampuan membaca yang berkembang.', 3],
    ['Apa yang diusahakan ketika ada kata tidak diketahui?', 'Mencarinya di kamus.', 'Selalu menutup semua buku.', 'Menunggu guru menelepon.', 'しらべるようにしています menunjukkan usaha yang dipertahankan untuk mencari kata.', 3]
  ], [
    ['こんやは はやく ねようと おもっています。あしたは 六時に おきます。七時の 電車で 学校へ いきます。', 'Apa niat pembicara untuk malam ini?', 'Tidur lebih awal.', 'Naik kereta pukul 6 malam.', 'Belajar sampai pagi.', 'ねようとおもっています menyatakan niat tidur lebih awal; waktu berikutnya adalah jadwal besok.', 1],
    ['わたしは 来月から あるいて 学校へ いくことにしました。いえから 学校まで 二十分です。', 'Siapa yang menetapkan keputusan berjalan kaki?', 'Pembicara sendiri.', 'Guru yang memberi larangan.', 'Perusahaan kereta.', 'ことにしました menonjolkan keputusan pribadi pembicara.', 2],
    ['学校の りょこうは 土曜日に いくことになりました。日よう日じゃありません。みなさん、土曜日の 八時に 来てください。', 'Hari apa yang sudah ditetapkan untuk perjalanan sekolah?', 'Sabtu.', 'Minggu.', 'Jumat.', '土曜日にいくことになりました menyampaikan keputusan yang sudah ditetapkan.', 2],
    ['夜は コーヒーを のまないようにしています。毎日 はやく ねることにしています。でも、ときどき おそく なります。', 'Apakah kebiasaan pembicara selalu terlaksana sempurna?', 'Tidak; ia berusaha, tetapi kadang tetap terlambat tidur.', 'Ya; ia menyatakan tidak pernah tidur larut.', 'Tidak; ia sengaja minum kopi setiap malam.', 'ようにしています menyatakan usaha; ときどきおそくなります mengakui kadang tidak berhasil.', 3]
  ]);

add(6,
  'きのう、はじめて 日本の りょうりを つくってみました。すこし むずかしかったです。でも、かぞくは「おいしい」と いいました。つくってよかったです。また つくりたいです。', [
    ['Apa fungsi つくってみました?', 'Mencoba membuat masakan untuk mengetahui hasilnya.', 'Melihat orang lain memasak tanpa ikut mencoba.', 'Memerintahkan keluarga membuat masakan.', 'てみる menandai percobaan melakukan tindakan; pembicara sendiri yang memasak.', 1],
    ['Bagaimana pembicara menilai percobaannya setelah selesai?', 'Senang sudah mencobanya.', 'Menyesal dan pasti tidak mau mengulang.', 'Tidak mengetahui tanggapan keluarga.', 'つくってよかった dan またつくりたい menunjukkan tanggapan positif.', 3]
  ],
  'あしたの じゅぎょうの 本を ぜんぶ よんでしまいました。でも、その 本を 電車に わすれてしまいました。学校の 本です。あした、先生に あやまります。', [
    ['てしまいました yang pertama menekankan apa?', 'Seluruh buku selesai dibaca.', 'Buku belum mulai dibaca.', 'Buku sedang dipinjamkan kepada teman.', 'ぜんぶよんでしまいました menekankan penyelesaian seluruh bacaan.', 2],
    ['Kejadian mana yang menjadi masalah dan perlu permintaan maaf?', 'Buku sekolah tertinggal di kereta.', 'Pembicara selesai membaca terlalu cepat.', 'Guru tidak memberikan pelajaran.', 'わすれてしまいました menyatakan hasil yang tidak diharapkan; buku itu milik sekolah.', 2]
  ], [
    ['この おちゃを のんでみました。いい においが します。あまり あまくありません。わたしは すきです。', 'Apakah pembicara sudah mencoba teh?', 'Sudah mencobanya dan menyukainya.', 'Belum mencoba dan hanya melihat kemasannya.', 'Sudah mencoba dan melarang semua orang meminumnya.', 'のんでみました berbentuk lampau dan わたしはすきです memberi penilaian positif.', 1],
    ['うっかり 友だちの ペンを なくしてしまいました。大事な ペンです。すぐ 友だちに あやまりました。', 'Mengapa てしまいました bernuansa penyesalan?', 'Pena penting milik teman hilang karena kelalaian.', 'Semua pekerjaan sudah selesai sesuai rencana.', 'Pembicara berhasil membeli pena.', 'うっかり, 大事なペン, dan tindakan meminta maaf menegaskan hasil yang tidak diharapkan.', 2],
    ['かぎが ありました。かばんの 中に ありました。なくさなくて よかったです。', 'Hal apa yang membuat pembicara lega?', 'Kunci ternyata tidak hilang.', 'Kunci berhasil dibuang.', 'Kunci tertinggal di tempat yang tidak diketahui.', 'なくさなくてよかった menunjukkan rasa lega atas tidak terjadinya kehilangan.', 3],
    ['きのう、へんじを しなくて すみません。いそがしかったんです。きょうは 時間が あります。', 'Atas hal apa pembicara meminta maaf?', 'Tidak membalas kemarin.', 'Menelepon terlalu pagi hari ini.', 'Datang terlambat minggu depan.', 'へんじをしなくてすみません menyatakan maaf karena tidak memberi balasan.', 3]
  ]);

add(7,
  'じゅぎょうのまえに、わたしが まどを あけました。先生が いすを ならべました。いま、まどが あいています。へやには いすが ならべてあります。', [
    ['Siapa yang melakukan tindakan membuka jendela?', 'Pembicara.', 'Guru.', 'Tidak ada pelaku yang disebutkan.', 'わたしがまどをあけました menyebut pembicara sebagai pelaku dan jendela sebagai objek.', 1],
    ['Apa yang ditekankan いすがならべてあります?', 'Susunan kursi merupakan hasil tindakan persiapan yang masih ada.', 'Kursi sedang menyusun diri sendiri.', 'Guru belum pernah menyentuh kursi.', 'ならべてあります memakai verba transitif untuk hasil penataan yang disengaja.', 2]
  ],
  'あした、友だちが 来ます。きょう、へやを かたづけておきます。コップも あらっておきます。テーブルは まだ つかいますから、ここに おいておいてください。', [
    ['Mengapa kamar dirapikan hari ini?', 'Sebagai persiapan kedatangan teman besok.', 'Karena semua teman sudah pulang kemarin.', 'Untuk melarang teman datang.', 'かたづけておきます menandai tindakan persiapan; keperluannya kedatangan teman besok.', 3],
    ['Apa yang diminta tentang meja?', 'Biarkan tetap di tempatnya karena masih akan dipakai.', 'Bawa keluar sekarang.', 'Pecahkan sebelum teman datang.', 'おいておいてください meminta mempertahankan letak meja untuk keperluan berikutnya.', 3]
  ], [
    ['子どもが ボールで あそんでいました。大きい おとが しました。まどが われました。', 'Kalimat terakhir menyatakan apa?', 'Jendela pecah; perubahan pada benda menjadi fokus.', 'Jendela memecahkan bola.', 'Pembicara menyuruh anak memecahkan jendela.', 'まどがわれました memakai verba intransitif untuk perubahan pada jendela.', 1],
    ['へやの 電気が ついています。でも、だれも いません。わたしが 電気を けします。', 'Bagaimana keadaan lampu sebelum pembicara bertindak?', 'Masih menyala.', 'Sudah padam.', 'Belum dipasang.', 'ついています menyatakan keadaan menyala; けします adalah tindakan yang akan dilakukan.', 2],
    ['テーブルの 上に 本が おいてあります。あしたの じゅぎょうで つかう 本です。ここに おいておいてください。', 'Mengapa buku ada di meja?', 'Sudah diletakkan untuk dipakai dalam pelajaran besok.', 'Buku jatuh sendiri dari kereta.', 'Pembicara baru ingin membeli buku.', 'おいてあります dan keterangan pelajaran besok menunjukkan hasil persiapan.', 2],
    ['あしたは 早く でかけます。きょうの 夜、かばんを じゅんびしておきます。きっぷは もう かってあります。', 'Persiapan mana yang masih akan dilakukan malam ini?', 'Menyiapkan tas.', 'Membeli tiket yang belum dibeli.', 'Memulai perjalanan malam ini.', 'じゅんびしておきます adalah rencana persiapan; tiket sudah dibeli menurut かってあります.', 3]
  ]);

add(8,
  '先月、日本語の 本を よみはじめました。毎日 すこしずつ よみつづけました。きのう、やっと よみおわりました。前より 日本語が わかるようになってきました。', [
    ['Bagaimana urutan perkembangan membaca buku?', 'Mulai bulan lalu, dilanjutkan tiap hari, selesai kemarin.', 'Selesai bulan lalu, baru mulai kemarin.', 'Belum mulai dan tidak pernah membaca.', 'はじめる→つづける→おわる membentuk urutan tahap kegiatan dalam bacaan.', 2],
    ['Apa arah perkembangan kemampuan yang disebutkan?', 'Pemahaman bahasa Jepang bertambah hingga sekarang.', 'Kemampuan membaca pasti hilang seluruhnya.', 'Pembicara berhenti belajar sejak tahun lalu.', 'わかるようになってきました melihat perubahan yang berkembang sampai saat kini.', 1]
  ],
  'いま、レポートを かいているところです。まだ おわっていません。友だちは もう レポートを かきおわりました。わたしは あと 一時間 かくつもりです。', [
    ['Pada tahap apa laporan pembicara?', 'Sedang dikerjakan dan belum selesai.', 'Belum dimulai sama sekali.', 'Sudah selesai sejak kemarin.', 'かいているところ dan まだおわっていません menyatakan tahap sedang berlangsung.', 3],
    ['Siapa yang sudah selesai menulis laporan?', 'Teman pembicara.', 'Pembicara sendiri.', 'Tidak seorang pun.', '友だちはもう〜かきおわりました menyatakan laporan teman sudah selesai.', 3]
  ], [
    ['こちらを みてください。子どもが こちらへ はしってきます。あの 人は むこうへ あるいていきます。', 'Siapa yang bergerak mendekati pembicara?', 'Anak yang berlari.', 'Orang yang berjalan ke sana.', 'Tidak ada yang bergerak.', 'こちらへはしってきます menandai arah mendekat ke titik acuan pembicara.', 1],
    ['空が くらくなりました。雨が きゅうに ふりだしました。わたしは すぐ いえに かえりました。', 'Apa yang terjadi pada hujan?', 'Mulai turun secara mendadak.', 'Berhenti setelah berlangsung berhari-hari.', 'Belum pernah turun sampai akhir cerita.', 'きゅうにふりだしました menonjolkan awal yang mendadak.', 2],
    ['いまから ごはんを たべるところです。まだ たべていません。電話は あとで します。', 'Apakah pembicara sudah mulai makan?', 'Belum; tepat akan mulai.', 'Sudah selesai makan.', 'Sudah makan selama dua jam.', 'たべるところ dan まだたべていません sama-sama menunjukkan tahap sebelum mulai.', 3],
    ['先月、この まちに ひっこしてきたばかりです。まだ みせの 名前が よく わかりません。毎日 すこしずつ あるいています。', 'Mengapa ばかり dipakai meskipun pindahnya bulan lalu?', 'Kepindahan masih dianggap baru oleh pembicara.', '先月 berarti barusan beberapa detik lalu.', 'Pembicara telah tinggal puluhan tahun di sana.', 'たばかり memakai penilaian pembicara tentang kebaruan, tidak wajib beberapa detik sebelumnya.', 3]
  ]);

add(9,
  '新しい カメラを かいました。前の カメラは おもすぎました。新しいのは かるくて、つかいやすいです。でも、まだ つかいかたが よく わかりません。友だちに ききます。', [
    ['Apa masalah utama kamera lama?', 'Terlalu berat.', 'Terlalu murah.', 'Terlalu mudah digunakan.', '前のカメラはおもすぎました menyebut beratnya melewati kadar yang nyaman.', 2],
    ['Informasi apa yang akan ditanyakan kepada teman?', 'Cara menggunakan kamera baru.', 'Nama pemilik kamera lama.', 'Waktu toko tutup tahun lalu.', 'つかいかたがよくわかりません menunjukkan kebutuhan penjelasan cara penggunaan.', 1]
  ],
  'べんきょうのまえに、へやを きれいにしました。テレビの おとを 小さくしました。それから 名前を ていねいに かきました。字の 大きさも かえました。', [
    ['Apa yang dilakukan terhadap suara televisi?', 'Sengaja dikecilkan.', 'Hanya diamati mengecil sendiri.', 'Dibuat lebih keras.', 'おとを小さくしました menyatakan tindakan mengubah ukuran/tingkat suara.', 3],
    ['Dalam 字の大きさ, apa fungsi さ?', 'Membentuk kata benda tentang ukuran huruf.', 'Menyatakan keinginan menulis.', 'Menandai waktu lampau.', '大きい menjadi 大きさ, kata benda untuk besarnya/ukuran sesuatu.', 3]
  ], [
    ['この 本は 字が 大きいです。よみやすいです。あの 本は 字が 小さくて、よみにくいです。', 'Buku mana yang mudah dibaca?', 'Buku ini yang hurufnya besar.', 'Buku itu yang hurufnya kecil.', 'Kedua buku dinilai sulit dibaca.', 'この本 disebut よみやすい; あの本 disebut よみにくい.', 1],
    ['この コーヒーは あつすぎます。いまは のめません。すこし まちます。', 'Mengapa pembicara belum bisa minum kopi?', 'Kopinya terlalu panas.', 'Kopinya terlalu murah.', 'Tidak ada kopi sama sekali.', 'あつすぎます menandai suhu yang berlebihan untuk diminum sekarang.', 2],
    ['名前を ていねいに かいてください。小さく かかないでください。大きく かいてください。', 'Bagaimana nama harus ditulis?', 'Dengan teliti dan besar.', 'Sangat kecil dan terburu-buru.', 'Tidak perlu ditulis.', 'ていねいに dan 大きく menerangkan cara menulis; 小さく disangkal.', 3],
    ['この かばんは 大きすぎます。小さいのに します。かるい かばんが いいです。', 'Tas seperti apa yang dipilih?', 'Yang kecil dan ringan.', 'Yang terbesar dan terberat.', 'Yang tidak bisa dibawa.', '大きすぎます menilai tas pertama terlalu besar; pembicara memilih 小さいの.', 2]
  ]);

add(10,
  'あたらしい へやを えらびました。学校に ちかいし、しずかだし、べんきょうしやすいです。すこし 小さいけど、きれいです。駅にも ちかいので、ここに すむことにしました。', [
    ['Apa alasan yang disebutkan untuk memilih kamar?', 'Dekat sekolah dan stasiun, serta tenang.', 'Jauh dari sekolah dan selalu ramai.', 'Paling besar dari semua kamar.', 'Bacaan menyebut 学校にちかい、しずか dan 駅にもちかい sebagai alasan positif.', 1],
    ['Kekurangan apa yang diakui meskipun kamar dipilih?', 'Kamarnya agak kecil.', 'Kamarnya kotor.', 'Tidak ada stasiun di dekatnya.', 'すこし小さいけど、きれいです mengakui ukuran kecil sambil menambahkan kelebihan kebersihan.', 2]
  ],
  'きのうは 日よう日なのに、学校で べんきょうしました。あした しけんが あるからです。あした 雨が ふっても、学校へ いきます。しけんに おくれたくないので、はやく おきます。', [
    ['Apa yang dianggap tidak sesuai kebiasaan/harapan kemarin?', 'Belajar di sekolah padahal hari Minggu.', 'Tidak adanya ujian sama sekali.', 'Tidur terus sepanjang hari Minggu.', '日よう日なのに menandai kontras dengan harapan hari Minggu sebagai hari libur.', 2],
    ['Apakah hujan besok akan membatalkan pergi ke sekolah?', 'Tidak; tetap pergi meskipun hujan.', 'Ya; selalu membatalkan perjalanan.', 'Teks tidak menyebut rencana sekolah.', '雨がふっても、学校へいきます menyatakan rencana tetap berlaku meskipun hujan.', 3]
  ], [
    ['きょうは 用事が あるので、はやく かえります。あしたは 時間が あります。あした、いっしょに べんきょうしませんか。', 'Mengapa pembicara pulang lebih awal hari ini?', 'Ada urusan.', 'Tidak suka belajar dengan teman.', 'Karena besok sekolah tutup selamanya.', '用事があるので memberikan alasan langsung untuk pulang lebih awal.', 1],
    ['この 本は 安いけど、おもしろいです。きのう かいました。もう ぜんぶ よみました。', 'Apa dua penilaian terhadap buku?', 'Murah tetapi menarik.', 'Mahal dan membosankan.', 'Belum diketahui harganya dan belum dibaca.', '安いけど、おもしろい menghubungkan harga murah dengan penilaian isi yang positif.', 2],
    ['たくさん べんきょうしたのに、しけんが できませんでした。ざんねんです。あしたから また がんばります。', 'Apa yang membuat pembicara kecewa?', 'Sudah banyak belajar, tetapi hasil ujian tidak baik.', 'Belum belajar sama sekali tetapi memperoleh nilai terbaik.', 'Ujiannya dibatalkan karena hujan.', 'のに menyoroti hasil yang berlawanan dengan harapan dari usaha belajar.', 2],
    ['土曜日でも この みせは あいています。雨が ふっても、あいています。でも、日よう日は 休みです。', 'Kapan toko tutup menurut pengumuman?', 'Hari Minggu.', 'Setiap Sabtu.', 'Setiap kali hujan.', 'でも／ても mempertahankan keadaan buka pada Sabtu atau hujan; hari Minggu secara eksplisit libur.', 3]
  ]);

add(11,
  'いま、空に くろい くもが あります。雨が ふりそうです。でも、てんきよほうでは、あしたは はれるそうです。あしたは こうえんへ いこうと おもっています。', [
    ['Apa dasar perkiraan hujan sekarang?', 'Awan hitam yang terlihat di langit.', 'Teman mengatakan hujan kemarin.', 'Aturan sekolah tentang cuaca.', 'ふりそう mengikuti pengamatan langsung terhadap awan hitam.', 1],
    ['Apa sumber informasi cuaca besok?', 'Prakiraan cuaca.', 'Tampilan kue di toko.', 'Kesimpulan bahwa semua hari pasti cerah.', 'てんきよほうでは dan はれるそうです menunjukkan laporan informasi dari prakiraan.', 1]
  ],
  '先生は「九時に 学校へ 来ます」と いっていました。いまは 八時半です。もうすぐ 来るはずです。でも、電車が おくれているらしいです。少し おくれるかもしれません。', [
    ['Apa dasar perkiraan guru akan segera datang?', 'Guru mengatakan akan datang pukul 9.', 'Pembicara melihat guru sudah di kelas.', 'Tidak ada informasi tentang jadwal guru.', 'Pernyataan guru menjadi dasar 来るはずです.', 3],
    ['Apakah keterlambatan guru dinyatakan sebagai kepastian?', 'Tidak; baru kemungkinan karena kabar kereta terlambat.', 'Ya; guru sudah menyatakan pasti tidak akan datang.', 'Ya; pembicara memerintahkan guru terlambat.', 'らしい melaporkan kabar dan かもしれません membatasi simpulan sebagai kemungkinan.', 2]
  ], [
    ['この ケーキは おいしそうですね。まだ たべていません。あとで たべてみます。', 'Apa dasar penilaian pembicara terhadap kue?', 'Tampilannya, karena belum dicicipi.', 'Rasanya setelah menghabiskan kue.', 'Larangan dari penjual.', 'おいしそう dan まだたべていません menunjukkan penilaian dari penampakan.', 1],
    ['友だちから ききました。あの みせは 来月 やすくなるそうです。わたしは 来月、この みせで かいものを します。', 'Informasi apa yang dilaporkan dari teman?', 'Harga di toko itu katanya turun bulan depan.', 'Toko itu pasti tutup selamanya hari ini.', 'Teman sudah membeli seluruh barang.', 'やすくなるそうです adalah kabar tentang harga yang menjadi lebih murah.', 1],
    ['かぎが ありません。いえに わすれたかもしれません。でも、まだ わかりません。いえで さがします。', 'Seberapa pasti pembicara mengetahui tempat kunci?', 'Belum pasti; mungkin tertinggal di rumah.', 'Pasti sudah ditemukan di rumah.', 'Pasti dibuang ke luar rumah.', 'かもしれません dan まだわかりません mempertahankan ketidakpastian.', 2],
    ['この 本は 子どもの 本です。字も 大きいです。やさしいはずです。わたしも よんでみます。', 'Mengapa buku diperkirakan mudah?', 'Buku untuk anak-anak dan hurufnya besar.', 'Semua buku tebal pasti mudah.', 'Pembicara sudah menghafal setiap halaman.', 'Informasi jenis buku dan ukuran huruf mendasari dugaan はずです.', 3]
  ]);

add(12,
  'こうえんに 白い 花が さいています。ゆきのように 白いです。子どもたちが 花を みながら、たのしそうに はなしています。母も うれしそうな かおを しています。', [
    ['Dengan apa warna bunga dibandingkan?', 'Salju.', 'Laut.', 'Kopi.', 'ゆきのように白い membandingkan warna putih bunga dengan salju.', 1],
    ['Bagaimana keadaan anak-anak saat berbincang?', 'Tampak senang.', 'Tampak sedang marah.', 'Pasti ingin pulang tanpa berbicara.', 'たのしそうにはなしています menerangkan keadaan yang tampak saat berbicara.', 2]
  ],
  'いもうとは 毎日、あの あかい かばんの 話を します。あの かばんを ほしがっています。おとうとは「うみへ いきたい」と なんども いいます。うみへ いきたがっています。', [
    ['Apa yang diinginkan adik perempuan?', 'Tas merah itu.', 'Pergi ke laut.', 'Buku tentang gunung.', 'かばんをほしがっています menyatakan keinginan memiliki benda.', 3],
    ['Apa tanda yang mendukung penilaian keinginan adik laki-laki?', 'Ia berkali-kali berkata ingin pergi ke laut.', 'Ia mengatakan tidak suka laut.', 'Tidak ada tanda apa pun yang disebutkan.', 'Ucapan berulang うみへいきたい menjadi dasar いきたがっています.', 3]
  ], [
    ['へやに だれも いません。かばんも ありません。みんな かえったみたいです。', 'Apa simpulan pembicara dari keadaan ruangan?', 'Tampaknya semua sudah pulang.', 'Semua pasti sedang tidur di dalam.', 'Semua sedang memesan tas baru.', 'Tidak adanya orang dan tas mendukung dugaan かえったみたいです.', 1],
    ['おいしそうな ケーキを かいました。母の たんじょうびです。母は うれしそうに はなしています。', 'Bagaimana ibu terlihat saat berbicara?', 'Tampak gembira.', 'Tampak takut kepada anjing.', 'Tampak ingin membuang semua kue.', 'うれしそうにはなしています menggambarkan kegembiraan yang terlihat saat berbicara.', 2],
    ['子どもが いぬを こわがっています。母の うしろに います。', 'Perasaan apa yang terlihat pada anak?', 'Takut kepada anjing.', 'Ingin memiliki anjing itu.', 'Bangga karena bisa berlari lebih cepat.', 'こわがっています menyebut ketakutan; posisi anak di belakang ibu memberikan konteksnya.', 3],
    ['おとうとは しゃしんを とりたがっています。「カメラを つかっても いいですか」と ききました。', 'Apa yang ingin dilakukan adik laki-laki?', 'Memotret.', 'Membeli semua kamera di toko.', 'Menulis surat kepada guru.', 'とりたがっています dan permintaan izin memakai kamera mendukung keinginan memotret.', 3]
  ]);

export default chapters;
