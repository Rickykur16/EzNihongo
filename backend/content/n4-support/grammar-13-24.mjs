// Supporting material only. Core IDs/patterns/meanings/lesson placement stay in the live curriculum.
// Kana is intentional: these sentences practise grammar without requiring untaught kanji.
export const items = [];
const choices = (correct, wrong1, wrong2, offset) => {
  const result = [correct, wrong1, wrong2];
  for (let i = 0; i < offset % 3; i++) result.push(result.shift());
  return result;
};
function add(id, chapter, notes, lines, r, c, taskInstruction) {
  const examples = lines.trim().split('\n').map(line => {
    const [japanese, highlight, indonesian] = line.split('|');
    if (!japanese || !highlight || !indonesian || !japanese.includes(highlight)) throw new Error(`Invalid example: ${id}`);
    return { japanese, highlight, indonesian };
  });
  const recognition = { prompt:r[0], example:{japanese:r[1],indonesian:r[2]}, options:choices(r[3],r[4],r[5],items.length), answer:r[3] };
  const controlled = { prompt:c[0], sentence:c[1].replaceAll('___','＿＿＿'), indonesian:c[2], options:choices(c[3],c[4],c[5],items.length+1), answer:c[3] };
  items.push({id,chapter,notes,examples,recognition,controlled,taskInstruction});
}

add('84c2f6be-45ed-48e4-8f27-b84bcbaa2da9',13,
  'と menghubungkan kondisi dengan hasil otomatis, kebiasaan, atau penemuan. Untuk latihan kondisi dasar, klausa hasil bukan permintaan/ajakan/niat baru. Permintaan setelah tiba lebih cocok dengan たら. Sambungan: おす→おすと; やすい→やすいと; しずかだ→しずかだと; にちようびだ→にちようびだと. Bentuk lampau pada hasil dapat menyatakan sesuatu yang ditemukan.',
  `このボタンを おすと、ドアが あきます。|おすと|Jika tombol ini ditekan, pintunya terbuka.
このみちを まっすぐ いくと、はしが あります。|いくと|Jika berjalan lurus di jalan ini, ada jembatan.
このまちは よるに なると、しずかに なります。|なると|Kota ini menjadi sepi ketika malam tiba.`,
  ['Petunjuk mesin: hubungan apa yang ditunjukkan と?','カードを いれると、ドアが あきます。','Jika kartu dimasukkan, pintunya terbuka.','Hasil otomatis setelah kartu dimasukkan','Permintaan agar orang membuka pintu','Harapan agar kartu ditemukan'],
  ['Lengkapi petunjuk hasil otomatis; ubah おす dengan と.','このボタンを ___、でんきが つきます。','Jika tombol ini ditekan, lampunya menyala.','おすと','おしたと','おしてと'],
  'Tulis 3 petunjuk mesin atau arah jalan dengan と. Tentukan tindakan dan hasil yang benar-benar terjadi; jangan menutupnya dengan permintaan.');

add('ac1d8893-9a5f-4f4c-a65c-a2b240e819a9',13,
  'たら dapat dipakai untuk kondisi, tindakan sesudah suatu peristiwa, dan hasil yang baru ditemukan. Pembentukan: いく→いったら; たかい→たかかったら; ひまだ→ひまだったら; やすみだ→やすみだったら; いかない→いかなかったら. Bentuk た pada たら tidak otomatis menyatakan masa lampau. Klausa hasil dapat berupa permintaan.',
  `えきに ついたら、でんわして ください。|ついたら|Setelah tiba di stasiun, tolong telepon.
もし あした あめだったら、うちで べんきょうします。|あめだったら|Jika besok hujan, saya akan belajar di rumah.
まどを あけたら、うみが みえました。|あけたら|Ketika saya membuka jendela, terlihat laut.`,
  ['Pada kalimat ini, kapan permintaan dijalankan?','しゅくだいが おわったら、みせて ください。','Setelah PR selesai, tolong tunjukkan.','Sesudah PR selesai','Sebelum mulai mengerjakan PR','Selama guru mengerjakan PR'],
  ['Pakai たら untuk syarat あめだ besok.','あした ___、バスで いきます。','Jika besok hujan, saya akan naik bus.','あめだったら','あめだたら','あめならたら'],
  'Rencanakan perjalanan singkat. Tulis tindakan jika hujan, permintaan setelah tiba, dan satu kondisi tambahan; gunakan たら pada ketiganya.');

add('165c4efd-8898-48aa-992b-81bc882dc771',13,
  'Vたらどうですか menawarkan saran, bukan menanyakan bagaimana peristiwa lampau terjadi. Dapat terasa menekan jika terus diulang atau diarahkan kepada orang yang tidak meminta saran. Awali dengan masalah yang diketahui; untuk guru/atasan, perhatikan hubungan dan nada.',
  `みちが わからないんですか。ちずを みたら どうですか。|みたら どうですか|Anda tidak tahu jalannya? Bagaimana kalau melihat peta?
つかれたんですか。すこし やすんだら どうですか。|やすんだら どうですか|Anda lelah? Bagaimana kalau beristirahat sebentar?
このほんは むずかしいんですね。やさしいほんから よんだら どうですか。|よんだら どうですか|Buku ini sulit, ya. Bagaimana kalau mulai membaca buku yang mudah?`,
  ['Apa yang dilakukan pembicara setelah mengetahui masalah temannya?','ねむいんですか。コーヒーを のんだら どうですか。','Anda mengantuk? Bagaimana kalau minum kopi?','Memberi saran untuk minum kopi','Melaporkan bahwa ia sudah minum kopi','Melarang temannya minum kopi'],
  ['Beri saran dengan たらどうですか dari やすむ.','すこし ___ どうですか。','Bagaimana kalau beristirahat sebentar?','やすんだら','やすむたら','やすみたら'],
  'Pilih 3 masalah ringan teman, misalnya lelah, tidak tahu jalan, atau buku sulit. Tulis masalahnya dan satu saran たらどうですか untuk masing-masing.');

add('8f85170b-cb37-4455-993b-7ddb894a850f',13,
  'といいですね menyampaikan harapan kepada/bersama orang lain; といいな sering menjadi harapan pribadi. Konteks juga dapat membuatnya berupa saran. Sambungan N/Aな positif memakai だ: やすみだといい. Harapan tidak menyatakan hasil sudah pasti.',
  `あした はれると いいですね。|はれると いいですね|Semoga besok cerah.
つぎの しけんは やさしいと いいな。|やさしいと いいな|Semoga ujian berikutnya mudah.
こんどの にちようびは やすみだと いいですね。|やすみだと いいですね|Semoga Minggu ini libur.`,
  ['Apa sikap pembicara tentang hasil ujian?','しけんに ごうかくできると いいですね。','Semoga Anda dapat lulus ujian.','Mengharapkan hasil baik, belum memastikan hasil','Memastikan ujian sudah lulus','Memerintahkan orang mengulang ujian'],
  ['Lengkapi harapan tentang libur; gunakan kata やすみ.','あした ___ いいな。','Semoga besok libur.','やすみだと','やすみなと','やすみでと'],
  'Tulis 3 harapan: cuaca perjalanan, hasil belajar teman, dan waktu libur pribadi. Gunakan といいですね untuk teman dan といいな untuk diri sendiri.');

add('fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d',14,
  'Tabel: かく→かけば; いく→いけば; かう→かえば; まつ→まてば; はなす→はなせば; たべる→たべれば; する→すれば; くる→くれば. Aい: やすい→やすければ; いい→よければ. Negatif: いかない→いかなければ. N/Aな: やすみなら（ば）／やすみであれば. Pada syarat keadaan, ajakan dapat mengikuti: じかんがあれば、いきませんか. Jika syaratnya tindakan disengaja dan pelakunya sama, gunakan たら untuk urutan tindakan lalu permintaan/niat; jangan menganggap semua ば melarang ajakan.',
  `じかんが あれば、いっしょに いきませんか。|あれば|Jika ada waktu, mau pergi bersama?
このみちを いけば、えきに つきます。|いけば|Jika melalui jalan ini, kita akan sampai di stasiun.
もうすこし やすければ、このかばんを かいたいです。|やすければ|Jika sedikit lebih murah, saya ingin membeli tas ini.`,
  ['Mengapa ajakan dapat mengikuti kondisi ini?','ひまであれば、さんぽしませんか。','Jika sedang luang, mau berjalan-jalan?','Syaratnya keadaan sedang luang','ば selalu berarti perintah','Ajakan itu menyatakan kejadian masa lampau'],
  ['Bentuk ば dari いく untuk menjelaskan rute.','このみちを ___、こうえんに つきます。','Jika melalui jalan ini, kita akan sampai di taman.','いけば','いくば','いきれば'],
  'Tulis satu syarat rute dengan verba ば, satu syarat harga dengan Aければ, dan satu ajakan dengan じかんがあれば. Jelaskan hasil yang sesuai tiap kondisi.');

add('2c432704-654c-4497-8f53-8a3c0d2bbb17',14,
  'なら menanggapi topik/informasi yang sudah disebut atau diasumsikan. Sambungan: いくなら; やすいなら; ひまなら; バスなら. Tidak wajib berarti tindakan dalam klausa pertama selesai lebih dahulu; persiapan dapat dilakukan sebelum perjalanan.',
  `きょうとへ いくなら、このちずが べんりですよ。|いくなら|Kalau akan ke Kyoto, peta ini berguna.
バスなら、えきの まえから のれます。|バスなら|Kalau naik bus, Anda dapat naik dari depan stasiun.
にちようび ひまなら、いっしょに べんきょうしませんか。|ひまなら|Kalau hari Minggu luang, mau belajar bersama?`,
  ['Teman mengatakan akan naik bus. Apa fungsi なら dalam jawaban ini?','バスなら、えきの まえから のれます。','Kalau naik bus, Anda dapat naik dari depan stasiun.','Menanggapi pilihan bus yang baru disebut','Menyatakan bus sudah tiba kemarin','Menyatakan semua kendaraan dilarang'],
  ['Tanggapi pilihan teman: bus. Sambungkan N dengan なら.','___、えきの まえが べんりです。','Kalau bus, depan stasiun adalah tempat yang praktis.','バスなら','バスだなら','バスななら'],
  'Bayangkan teman menyebut tujuan perjalanan, transportasi, dan hari senggang. Tulis satu tanggapan なら yang relevan untuk tiap informasi.');

add('c9eb422c-64ee-469a-a942-156365943c33',14,
  'ばよかった menyatakan penyesalan tentang pilihan yang sudah terjadi. いけばよかった: ternyata saya tidak pergi; いかなければよかった: ternyata saya pergi. Bedakan dari harapan masa depan といい. Bentuk いい menjadi よかった.',
  `バスに まにあいませんでした。もっと はやく でれば よかったです。|でれば よかったです|Saya tidak sempat naik bus. Seandainya berangkat lebih awal.
みちを まちがえました。ちずを みれば よかったです。|みれば よかったです|Saya salah jalan. Seandainya melihat peta.
たべすぎて、おなかが いたいです。こんなに たべなければ よかったです。|たべなければ よかったです|Saya sakit perut karena terlalu banyak makan. Seandainya tidak makan sebanyak ini.`,
  ['Apa yang sebenarnya terjadi sebelum penyesalan ini?','きのう もっと べんきょうすれば よかったです。','Seandainya kemarin belajar lebih banyak.','Pembicara merasa belajarnya kemarin kurang','Pembicara pasti akan belajar besok','Pembicara melarang orang lain belajar'],
  ['Anda sudah makan terlalu banyak. Pakai bentuk penyesalan negatif dari たべる.','こんなに ___ よかったです。','Seandainya saya tidak makan sebanyak ini.','たべなければ','たべないば','たべなくれば'],
  'Tulis dua kejadian yang disesali. Untuk yang pertama gunakan Vばよかった, untuk yang kedua Vなければよかった; jelaskan kejadian sebenarnya dengan kalimat lampau.');

add('bcefdff6-4e96-47e3-9de8-06fcb5214a16',15,
  'Tujuan kegiatan memakai batang ます: かいます→かいに; たべます→たべに; べんきょうします→べんきょうしに. に di sini menandai tujuan kegiatan; tempat tujuan tetap memakai へ/に. 来る dilihat dari tempat pembicara, 帰る untuk kembali.',
  `パンを かいに みせへ いきます。|かいに|Saya pergi ke toko untuk membeli roti.
ともだちが うちへ べんきょうしに きました。|べんきょうしに|Teman saya datang ke rumah untuk belajar.
ひるごはんを たべに うちへ かえります。|たべに|Saya pulang ke rumah untuk makan siang.`,
  ['Apa tujuan pembicara pergi ke perpustakaan?','ほんを かりに としょかんへ いきます。','Saya pergi ke perpustakaan untuk meminjam buku.','Meminjam buku','Mengembalikan uang','Membeli perpustakaan'],
  ['Gunakan かいます untuk menyatakan tujuan pergi.','のみものを ___ いきます。','Saya pergi untuk membeli minuman.','かいに','かうに','かってに'],
  'Tulis 3 rencana dengan tujuan kegiatan: satu memakai 行く, satu 来る, dan satu 帰る. Sertakan tempat tujuan dan kegiatan yang dilakukan di sana.');

add('22faf0ea-231d-4b8f-b3e2-8d22a3f33b14',15,
  'ために pada bab ini menyatakan tujuan yang disengaja atau manfaat, bukan sebab. Gunakan bentuk kamus untuk tindakan yang dituju dan の sesudah nomina. Pada Vるために, pelaku tujuan dan pelaku tindakan utama biasanya sama. Untuk hasil berupa kemampuan/keadaan, bandingkan ように.',
  `にほんで はたらくために、にほんごを べんきょうしています。|はたらくために|Saya belajar bahasa Jepang untuk bekerja di Jepang.
りょこうのために、おかねを ためています。|りょこうのために|Saya menabung uang untuk perjalanan.
かぞくのために、ばんごはんを つくります。|かぞくのために|Saya membuat makan malam untuk keluarga.`,
  ['Apa tujuan kegiatan menabung?','じてんしゃを かうために、おかねを ためています。','Saya menabung untuk membeli sepeda.','Membeli sepeda','Menjual uang','Karena sepedanya sudah rusak'],
  ['Sambungkan nomina りょこう dengan ために.','___、おかねを ためています。','Saya menabung untuk perjalanan.','りょこうのために','りょこうために','りょこうなために'],
  'Pilih tujuan nyata belajar, membeli sesuatu, atau bepergian. Tulis dua langkah dengan Vるために dan satu manfaat untuk orang lain dengan Nのために. Catatan kosakata: ためる = menabung/mengumpulkan.');

add('f35204fb-8af8-451a-a41d-28b8ca0c8a76',15,
  'ように mengarahkan tindakan agar keadaan/kemampuan terwujud atau kejadian buruk tidak terjadi. Sering memakai potensial atau negatif: よめるように、わすれないように. Berbeda dari tujuan tindakan sengaja yang langsung memakai ために; jangan menukar kedua pola secara mekanis.',
  `にほんごの ほんが よめるように、まいにち れんしゅうします。|よめるように|Saya berlatih setiap hari agar dapat membaca buku bahasa Jepang.
わすれないように、ノートに かいて おきます。|わすれないように|Saya mencatatnya di buku agar tidak lupa.
うしろの ひとにも きこえるように、おおきな こえで はなします。|きこえるように|Saya berbicara dengan suara keras agar orang di belakang juga dapat mendengar.`,
  ['Hasil apa yang ingin dicapai pembicara?','わすれないように、メモを します。','Saya membuat catatan agar tidak lupa.','Mencegah lupa','Menyatakan bahwa ia sudah lupa','Meminta orang membuang catatan'],
  ['Gunakan bentuk kemampuan よめる sebelum ように.','かんじが ___、まいにち れんしゅうします。','Saya berlatih setiap hari agar dapat membaca kanji.','よめるように','よめますように','よめたなように'],
  'Tulis 3 kebiasaan yang membantu belajar: agar bisa melakukan sesuatu, agar tidak lupa, dan agar orang lain memahami. Nyatakan hasil dengan ように.');

add('384aada6-16f6-49c9-914d-0861febfb53e',15,
  'Vるのに di sini menunjukkan kegunaan/kebutuhan/waktu untuk suatu kegiatan, bukan pertentangan “padahal”. Tanda pembeda adalah predikat seperti つかう、べんり、ひつよう、じかんがかかる. Sambungkan langsung bentuk kamus＋のに.',
  `このはさみは かみを きるのに つかいます。|きるのに|Gunting ini digunakan untuk memotong kertas.
このかばんは りょこうに いくのに べんりです。|いくのに|Tas ini praktis untuk bepergian.
このりょうりを つくるのに、いちじかん かかります。|つくるのに|Diperlukan satu jam untuk membuat masakan ini.`,
  ['Apa fungsi のに dalam kalimat ini?','このどうぐは かみを きるのに つかいます。','Alat ini digunakan untuk memotong kertas.','Menjelaskan kegunaan alat','Menunjukkan hasil yang bertentangan','Menunjukkan larangan memakai kertas'],
  ['Gunakan のに untuk waktu yang dibutuhkan; verba つくる.','ケーキを ___、にじかん かかります。','Diperlukan dua jam untuk membuat kue.','つくるのに','つくりのに','つくってのに'],
  'Pilih dua alat yang Anda pakai dan satu kegiatan yang memakan waktu. Tulis kegunaan/kebutuhan alat serta durasi kegiatan dengan Vるのに. Catatan: はさみ = gunting.');

add('a9a61b7f-ac7c-4638-9e6e-0b008784ed67',15,
  'ように言う melaporkan isi instruksi, bukan mengutip persis. Orang yang memberi instruksi menjadi は/が, orang yang menerima biasanya に. Isi memakai Vる atau Vない, bukan bentuk ます. Untuk larangan gunakan Vないように, bukan Vるなように.',
  `せんせいは がくせいに、テキストを もって くるように いいました。|くるように いいました|Guru meminta siswa membawa buku teks.
ははは わたしに、おそく ならないように いいました。|ならないように いいました|Ibu berpesan kepada saya agar tidak terlambat.
わたしは ともだちに、えきの まえで まつように いいました。|まつように いいました|Saya meminta teman menunggu di depan stasiun.`,
  ['Siapa yang menerima instruksi untuk membawa buku?','せんせいは がくせいに、ほんを もって くるように いいました。','Guru meminta siswa membawa buku.','Siswa','Guru','Tidak ada instruksi dalam kalimat ini'],
  ['Laporkan instruksi untuk menunggu: まつ.','えきで ___ いいました。','Saya meminta agar menunggu di stasiun.','まつように','まちますように','まってように'],
  'Tulis 3 laporan instruksi dari guru atau keluarga. Sebut pemberi dan penerima instruksi; dua berupa tindakan dan satu berupa sesuatu yang tidak boleh dilakukan.');

add('7e65dba0-89b1-43a4-99ef-17b99c2eb1f0',16,
  'Untuk saran tindakan spesifik gunakan Vたほうがいい; larangan/saran negatif memakai Vないほうがいい. Bentuk た tidak berarti tindakan sudah selesai. Saran tentang kesehatan di sini latihan bahasa, bukan diagnosis; sesuaikan dengan konteks yang diberikan.',
  `つかれていますね。きょうは はやく ねたほうが いいですよ。|ねたほうが いい|Anda terlihat lelah. Sebaiknya tidur lebih awal hari ini.
このみちは くらいので、よるは とおらないほうが いいです。|とおらないほうが いい|Karena jalan ini gelap, sebaiknya tidak melewatinya pada malam hari.
しけんの まえに、もういちど ノートを よんだほうが いいです。|よんだほうが いい|Sebelum ujian, sebaiknya membaca catatan sekali lagi.`,
  ['Apakah saran ini berarti pembicara sudah tidur?','きょうは はやく ねたほうが いいです。','Sebaiknya tidur lebih awal hari ini.','Tidak; bentuk た digunakan untuk saran tindakan','Ya; ia sedang melaporkan tidur kemarin','Ya; semua bentuk た pasti kejadian yang selesai'],
  ['Beri saran spesifik dengan bentuk た dari よむ.','しけんの まえに ノートを ___ いいです。','Sebaiknya membaca catatan sebelum ujian.','よんだほうが','よむたほうが','よんでほうが'],
  'Tulis 3 saran untuk teman yang akan ujian: dua tindakan yang lebih baik dilakukan dan satu yang lebih baik dihindari. Sertakan alasan singkat.');

add('698d3b5c-41f1-49c4-8768-4f37cbd124b0',16,
  'Tabel kewajiban: いかない→いかなくてはいけない／いかないといけない; いかなくては→いかなくちゃ; いかなければ→いかなきゃ. Bentuk pendek bersifat percakapan dan kadang tanpa いけない／ならない. Jangan menyamakan なくちゃ dengan izin untuk tidak melakukan.',
  `あしたまでに このしゅくだいを しなくては いけません。|しなくては いけません|Saya harus mengerjakan PR ini sebelum batas waktu besok.
としょかんの ほんを かえさないと いけません。|かえさないと いけません|Saya harus mengembalikan buku perpustakaan.
もう くじです。そろそろ かえらなきゃ。|かえらなきゃ|Sudah pukul sembilan. Saya harus segera pulang.`,
  ['Apa maksud bentuk pendek pada situasi ini?','あした しけんだから、べんきょうしなくちゃ。','Karena besok ujian, saya harus belajar.','Pembicara merasa harus belajar','Pembicara boleh tidak belajar','Pembicara dilarang belajar'],
  ['Lengkapi kewajiban dari かえす menggunakan ないといけません.','ほんを ___ いけません。','Saya harus mengembalikan buku.','かえさないと','かえすないと','かえしないと'],
  'Buat daftar 3 kewajiban sebelum bepergian. Tulis dua dengan bentuk lengkap dan satu sebagai catatan pribadi memakai なきゃ atau なくちゃ.');

add('8bcb42e7-bb94-474c-9d1d-33f384a62e58',16,
  '必要がある／必要はない menjelaskan ada atau tidak adanya kebutuhan. Pakai bentuk kamus: いくひつよう. 必要はない berarti tidak perlu, bukan dilarang. Bandingkan なくてもいい sebagai izin untuk tidak melakukan.',
  `しけんの まえに、じゅんびする ひつようが あります。|ひつようが あります|Sebelum ujian, perlu melakukan persiapan.
このみせでは、よやくする ひつようは ありません。|ひつようは ありません|Di toko ini, tidak perlu melakukan reservasi.
もう コピーが ありますから、もういちまい つくる ひつようは ありません。|ひつようは ありません|Karena sudah ada salinannya, tidak perlu membuat satu lagi.`,
  ['Apa arti ひつようはありません di sini?','あしたは がっこうへ いく ひつようは ありません。','Besok tidak perlu pergi ke sekolah.','Pergi ke sekolah tidak diperlukan','Pergi ke sekolah dilarang keras','Pergi ke sekolah wajib dilakukan'],
  ['Sambungkan じゅんびする dengan ひつようがあります.','しけんの まえに ___ ひつようが あります。','Sebelum ujian, perlu melakukan persiapan.','じゅんびする','じゅんびします','じゅんびして'],
  'Anda menyiapkan kegiatan kelas. Tulis dua hal yang perlu dilakukan dan satu yang tidak perlu, disertai alasan tentang perlengkapan atau jadwal.');

add('441eb770-2e1e-4752-b7db-74c7764cdf8c',16,
  'ます-stem＋なさい adalah instruksi tegas, misalnya guru kepada murid atau orang tua kepada anak. Bukan permintaan sopan universal kepada guru/atasan. Tabel: かきます→かきなさい; たべます→たべなさい; します→しなさい; きます→きなさい.',
  `せんせいは「ここに なまえを かきなさい」と いいました。|かきなさい|Guru berkata, “Tuliskan nama di sini.”
ははは こどもに「もう はちじです。おきなさい」と いいました。|おきなさい|Ibu berkata kepada anaknya, “Sudah pukul delapan. Bangunlah.”
せんせいは「テキストを よく よみなさい」と いいました。|よみなさい|Guru berkata, “Bacalah buku teks dengan saksama.”`,
  ['Dalam hubungan mana instruksi ini paling sesuai?','ここに なまえを かきなさい。','Tuliskan nama di sini.','Guru memberi instruksi kepada murid','Murid meminta bantuan kepada kepala sekolah','Pelanggan meminta tolong dengan sangat formal'],
  ['Guru memberi instruksi; ubah かきます menjadi なさい.','なまえを ___。','Tuliskan nama.','かきなさい','かくなさい','かいてなさい'],
  'Tulis 3 instruksi kelas dari sudut pandang guru kepada murid memakai なさい. Tambahkan label pemberi dan penerima agar register jelas.');

add('d5931f00-4b2f-4cd6-984c-4fb7ef5394f2',16,
  'Bentuk perintah: かく→かけ; いく→いけ; まつ→まて; はなす→はなせ; たべる→たべろ; する→しろ; くる→こい. Larangan: bentuk kamus＋な (いくな、たべるな). Sangat tegas; pelajari terutama untuk memahami tanda, kutipan, dan keadaan darurat. Untuk permintaan biasa gunakan bentuk yang lebih sesuai hubungan.',
  `あぶない！ そこで とまれ！|とまれ|Bahaya! Berhenti di situ!
ここには「はいるな」と かいて あります。|はいるな|Di sini tertulis “Jangan masuk”.
かじです。「はやく にげろ！」という こえが きこえます。|にげろ|Ada kebakaran. Terdengar suara, “Cepat lari!”`,
  ['Apa arti larangan pada tanda ini?','ここに はいるな。','Jangan masuk ke sini.','Dilarang masuk ke tempat ini','Silakan masuk dengan tenang','Tempat ini sudah dimasuki kemarin'],
  ['Bentuk larangan langsung dari はいる.','あぶないから、ここに ___。','Karena berbahaya, jangan masuk ke sini.','はいるな','はいりな','はいってな'],
  'Tulis dua tanda larangan dengan Vるな dan satu kutipan perintah dalam keadaan darurat. Jelaskan konteksnya dalam bahasa Indonesia; jangan menjadikannya permintaan biasa kepada guru.');

add('fdeb6c11-f394-4655-909e-6e3f814c1b21',17,
  'あげる melihat perpindahan benda dari pemberi kepada orang lain. Pemberiは、penerimaに、bendaを. Jangan memakai あげる untuk pemberian orang lain kepada saya; pilih くれる atau ubah sudut pandang menjadi もらう. Pemberian kepada orang yang dihormati akan dibahas dalam keigo.',
  `わたしは ともだちに ほんを あげました。|あげました|Saya memberikan buku kepada teman.
あねは いもうとに はなを あげました。|あげました|Kakak perempuan memberikan bunga kepada adik perempuan.
たんじょうびに、わたしは おとうとに おもちゃを あげます。|あげます|Pada hari ulang tahunnya, saya akan memberikan mainan kepada adik laki-laki.`,
  ['Siapa pemberi buku dalam kalimat ini?','わたしは ともだちに ほんを あげました。','Saya memberikan buku kepada teman.','Saya','Teman','Tidak ada perpindahan buku'],
  ['Saya memberikan bunga kepada teman. Lengkapi partikel penerima.','わたしは ともだち___ はなを あげました。','Saya memberikan bunga kepada teman.','に','を','が'],
  'Tulis 3 rencana hadiah untuk orang lain. Sebutkan pemberi, penerima, benda, dan kesempatan pemberian; gunakan あげる dari sudut pandang pemberi.');

add('a63c4082-f65c-47b9-a0cc-44afbb00619d',17,
  'もらう memakai penerima sebagai topik/subjek. Sumber orang dapat memakai に atau から; untuk organisasi/sumber nonorang, から lebih sesuai. Kedua partikel tidak boleh dijadikan opsi saling salah jika keduanya cocok dengan orang yang sama.',
  `わたしは ともだちに ほんを もらいました。|もらいました|Saya menerima buku dari teman.
あねは かいしゃから カレンダーを もらいました。|もらいました|Kakak perempuan menerima kalender dari perusahaan.
たんじょうびに、おとうとは そふから おもちゃを もらいました。|もらいました|Pada hari ulang tahunnya, adik laki-laki menerima mainan dari kakek.`,
  ['Siapa penerima kalender?','あねは かいしゃから カレンダーを もらいました。','Kakak perempuan menerima kalender dari perusahaan.','Kakak perempuan','Perusahaan','Orang yang membuat kalender'],
  ['Lengkapi sesuai arti menerima buku dari teman.','わたしは ともだちから ほんを ___。','Saya menerima buku dari teman.','もらいました','あげました','くれました'],
  'Tulis dua benda yang diterima dari orang dan satu benda yang diterima dari sekolah/perusahaan. Gunakan もらう dan pilih partikel sumber yang sesuai.');

add('35044c6f-f076-4cbe-963d-ffc03a6f5041',17,
  'くれる menempatkan pemberi sebagai subjek dan arah pemberian menuju saya/pihak yang saya pandang dekat. “Kelompok saya” ditentukan konteks, bukan semua orang yang dikenal. 私に boleh dihilangkan jika jelas. Bandingkan: ともだちがくれた／わたしがもらった.',
  `ともだちが わたしに はなを くれました。|くれました|Teman memberikan bunga kepada saya.
そぼが わたしの むすめに えほんを くれました。|くれました|Nenek memberikan buku bergambar kepada anak perempuan saya.
わたしの たんじょうびに、あねが このかばんを くれました。|くれました|Pada ulang tahun saya, kakak perempuan memberikan tas ini kepada saya.`,
  ['Ke arah siapa pemberian ini terjadi?','せんぱいが わたしに ペンを くれました。','Senior memberikan pena kepada saya.','Dari senior kepada saya','Dari saya kepada senior','Dari saya kepada toko'],
  ['Teman adalah pemberi dan saya penerimanya. Pilih kata kerja yang sesuai.','ともだちが わたしに ほんを ___。','Teman memberikan buku kepada saya.','くれました','もらいました','あげました'],
  'Tulis dua hadiah yang seseorang berikan kepada Anda dan satu kepada anggota keluarga dekat Anda. Nyatakan penerimanya dengan jelas sebelum memakai くれる. Catatan: えほん = buku bergambar.');

add('cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd',18,
  'てあげる memandang tindakan sebagai bantuan kepada orang lain. Partikel mengikuti verba: ひとにおしえる、ひとをおくる、ひとのにもつをもつ. Jangan menambahkan penerimaに secara mekanis. Kepada penerima langsung, てあげる dapat terdengar menonjolkan jasa sendiri; bukan tawaran sopan universal.',
  `わたしは おとうとに かんじを おしえて あげました。|おしえて あげました|Saya membantu adik laki-laki dengan mengajarinya kanji.
わたしは ともだちを えきまで おくって あげました。|おくって あげました|Saya membantu teman dengan mengantarnya sampai stasiun.
あねは いもうとの かばんを もって あげました。|もって あげました|Kakak perempuan membantu adik perempuan dengan membawakan tasnya.`,
  ['Siapa yang menerima manfaat dari tindakan pembicara?','わたしは おとうとの じてんしゃを なおして あげました。','Saya membantu adik laki-laki dengan memperbaiki sepedanya.','Adik laki-laki','Tukang sepeda yang tidak disebut','Pembicara menerima sepeda baru'],
  ['Pakai partikel dari pola ひとを おくる; saya mengantar teman.','わたしは ともだち___ えきまで おくって あげました。','Saya mengantar teman ke stasiun sebagai bantuan.','を','に','が'],
  'Tulis 3 bantuan yang pernah Anda lakukan. Tentukan pelaku, penerima manfaat, dan verba; gunakan partikel asli verba, termasuk satu penerima dengan を atau pemilik dengan の.');

add('4e0b4126-767b-40c6-a916-50c40c064dd9',18,
  'てくれる menampilkan pelaku yang membantu saya/pihak saya. Rumus penerimaに bukan aturan untuk setiap verba. Pertahankan hubungan verba: わたしにおしえる、わたしをおくる、わたしのにもつをもつ. Penerima manfaat sering tidak disebut jika sudah jelas. Bedakan tindakan netral dari rasa manfaat/terima kasih.',
  `ははが わたしに りょうりを おしえて くれました。|おしえて くれました|Ibu membantu saya dengan mengajari saya memasak.
ともだちが わたしを えきまで おくって くれました。|おくって くれました|Teman membantu saya dengan mengantar saya sampai stasiun.
あにが わたしの パソコンを なおして くれました。|なおして くれました|Kakak laki-laki membantu saya dengan memperbaiki komputer saya.`,
  ['Mengapa わたし memakai を pada kalimat ini?','ともだちが わたしを えきまで おくって くれました。','Teman mengantar saya ke stasiun sebagai bantuan.','Karena おくる memakai orang yang diantar sebagai objek を','Karena semua penerima てくれる harus memakai を','Karena saya adalah orang yang mengantar'],
  ['Teman mengantar saya. Ikuti pola ひとを おくる.','ともだちが わたし___ うちまで おくって くれました。','Teman membantu saya dengan mengantar saya sampai rumah.','を','に','から'],
  'Tulis 3 bantuan yang Anda terima memakai てくれる. Gunakan satu contoh dengan 私に, satu dengan 私を, dan satu dengan 私の＋benda; pilih verba yang memang cocok.');

add('af2ed71a-d82d-4d21-a6ad-34b3e93b21e0',18,
  'てもらう menjadikan penerima bantuan sebagai topik; orang yang melakukan tindakan ditandai に. Dapat menyatakan bantuan yang diatur atau diterima, tidak selalu permintaan lisan. Jangan menukar pelaku dan penerima saat mengubah てくれる menjadi てもらう.',
  `わたしは ともだちに パソコンを なおして もらいました。|なおして もらいました|Saya mendapat bantuan teman untuk memperbaiki komputer.
わたしは せんせいに さくぶんを みて もらいました。|みて もらいました|Saya mendapat bantuan guru untuk memeriksa karangan.
いもうとは あねに えきまで おくって もらいました。|おくって もらいました|Adik perempuan mendapat bantuan kakak perempuan untuk mengantarnya ke stasiun.`,
  ['Siapa yang memperbaiki komputer?','わたしは ともだちに パソコンを なおして もらいました。','Saya mendapat bantuan teman untuk memperbaiki komputer.','Teman','Saya sendiri','Guru'],
  ['Saya menerima bantuan guru. Lengkapi penanda pelaku bantuan.','わたしは せんせい___ さくぶんを みて もらいました。','Saya mendapat bantuan guru memeriksa karangan.','に','を','が'],
  'Tulis dua bantuan yang diterima dengan てもらう. Ubah salah satunya menjadi kalimat てくれる tanpa mengubah siapa pelaku dan penerima manfaat. Catatan: さくぶん = karangan.');

add('a45f36e6-96a1-49ba-8c0e-3e96352e7e7a',18,
  'てもらえませんか meminta kesempatan menerima bantuan; てくれませんか meminta tindakan dari pelaku. Keduanya dapat sopan dalam hubungan yang sesuai. Bentuk てもらえない？／てくれない？ untuk hubungan akrab. Tambahkan konteks kebutuhan; jangan menganggap satu bentuk selalu paling sopan untuk semua orang.',
  `すみません。このじを よんで もらえませんか。|よんで もらえませんか|Permisi, bisakah Anda membantu membacakan huruf ini?
にもつが おもいんです。すこし てつだって くれませんか。|てつだって くれませんか|Barang bawaan saya berat. Bisakah Anda membantu sebentar?
ちょっと このかばんを もって くれない？|もって くれない|Bisa tolong pegang tas ini sebentar?`,
  ['Apa fungsi kalimat ini?','このじを よんで もらえませんか。','Bisakah Anda membantu membacakan huruf ini?','Meminta bantuan membaca','Melaporkan telah menerima hadiah','Melarang orang membaca'],
  ['Minta bantuan dengan bentuk て dari よむ＋もらえませんか.','このなまえを ___ もらえませんか。','Bisakah Anda membantu membacakan nama ini?','よんで','よむ','よみ'],
  'Tulis dua permintaan bantuan kepada teman sekelas dengan bentuk sopan, lalu satu kepada teman dekat dengan bentuk kasual. Sebutkan situasi dan alasan setiap permintaan.');

add('dec467ae-08fa-47ca-914e-9f9dc8f31863',18,
  'てほしい menunjukkan keinginan agar orang lain melakukan tindakan; pelaku yang diharapkan memakai に. Negatif: Vないでほしい. Berbeda dari Vたい untuk keinginan diri melakukan. Keinginan yang diucapkan langsung dapat terasa menuntut; bukan selalu permintaan sopan.',
  `ともだちに、あした うちへ きて ほしいです。|きて ほしいです|Saya ingin teman datang ke rumah besok.
こどもに、もっと ほんを よんで ほしいです。|よんで ほしいです|Saya ingin anak saya membaca lebih banyak buku.
ここでは おおきな こえで はなさないで ほしいです。|はなさないで ほしいです|Saya ingin orang tidak berbicara keras di sini.`,
  ['Siapa yang diharapkan datang?','ともだちに うちへ きて ほしいです。','Saya ingin teman datang ke rumah.','Teman','Saya pergi ke rumah teman','Tidak ada orang yang diharapkan datang'],
  ['Nyatakan keinginan agar orang tidak lupa; gunakan わすれる.','このことを ___ ほしいです。','Saya ingin Anda tidak melupakan hal ini.','わすれないで','わすれなくて','わすれるないで'],
  'Tulis dua harapan tentang tindakan keluarga/teman dan satu tindakan yang tidak Anda inginkan. Nyatakan pelaku dengan に bila perlu; gunakan てほしい dan ないでほしい.');

add('e9657f94-fc53-4b0c-a79b-bb8da4c9ff58',18,
  'てくれてありがとう menyebut tindakan orang lain yang membuat kita berterima kasih. Sambungan tetap bentuk て/で: くる→きてくれて; よむ→よんでくれて. Terima kasih atas benda saja dapat memakai Nをありがとう; bentuk tindakan membutuhkan verba.',
  `てつだって くれて、ありがとう。|てつだって くれて|Terima kasih sudah membantu.
たんじょうびに きて くれて、ありがとう。|きて くれて|Terima kasih sudah datang pada ulang tahun saya.
わたしの はなしを きいて くれて、ありがとう。|きいて くれて|Terima kasih sudah mendengarkan cerita saya.`,
  ['Apa yang dilakukan orang yang menerima ucapan terima kasih?','えきまで おくって くれて、ありがとう。','Terima kasih sudah mengantar saya ke stasiun.','Mengantar pembicara ke stasiun','Menerima hadiah dari stasiun','Meminta pembicara pulang sendiri'],
  ['Ucapkan terima kasih karena teman datang; gunakan くる.','パーティーに ___ くれて、ありがとう。','Terima kasih sudah datang ke pesta.','きて','くって','くる'],
  'Tulis 3 catatan terima kasih untuk tindakan yang berbeda: membantu pekerjaan, datang ke acara, dan mendengarkan/menjelaskan sesuatu. Gunakan てくれてありがとう.');

add('f0c421b9-ac27-4129-997e-d424784032a6',19,
  'Pertanyaan dengan kata tanya memakai か: いつくるか. Pertanyaan ya/tidak memakai かどうか: くるかどうか. Isi memakai bentuk biasa; N/Aな positif nonlampau tidak memakai だ: がくせいか、ひまかどうか. Pertanyaan tertanam bukan kalimat tanya langsung ですか di tengah kalimat.',
  `でんしゃが なんじに くるか、しらべます。|なんじに くるか|Saya akan memeriksa pukul berapa kereta datang.
あした さんかできるかどうか、まだ わかりません。|さんかできるかどうか|Saya belum tahu apakah bisa ikut besok atau tidak.
あのひとが だれか、しっていますか。|だれか|Apakah Anda tahu siapa orang itu?`,
  ['Apa yang belum diketahui pada kalimat ini?','あした さんかできるかどうか、まだ わかりません。','Saya belum tahu apakah bisa ikut besok atau tidak.','Bisa ikut atau tidak','Pukul berapa acara dimulai','Siapa pemilik gedung'],
  ['Tanamkan pertanyaan ya/tidak tentang さんかできる.','あした ___、まだ わかりません。','Saya belum tahu apakah bisa ikut besok atau tidak.','さんかできるかどうか','さんかできますかどうか','さんかできるだかどうか'],
  'Tulis dua hal yang perlu diperiksa sebelum acara: satu dengan kata tanya＋か dan satu dengan かどうか. Tambahkan kalimat tentang cara memeriksanya.');

add('a9303260-1760-45bb-b77b-6fec528f73b9',19,
  'だけ menyatakan batas secara netral dan dapat diikuti afirmatif. しか menuntut predikat negatif dan sering menekankan “hanya/sedikit sekali”. Contoh setara: ひとりだけいます／ひとりしかいません. しか＋negatif tetap menyatakan jumlah itu ada, bukan nol.',
  `きょうは さんにんだけ きました。|さんにんだけ|Hari ini hanya tiga orang yang datang.
おかねは ごひゃくえんしか ありません。|ごひゃくえんしか ありません|Uangnya hanya ada lima ratus yen.
このへやには つくえが ひとつだけ あります。|ひとつだけ|Di ruangan ini hanya ada satu meja.`,
  ['Berapa uang yang tersedia?','ごひゃくえんしか ありません。','Uangnya hanya ada lima ratus yen.','Ada 500 yen, jumlahnya ditekankan terbatas','Tidak ada uang sama sekali','Ada lebih dari 500 yen'],
  ['Gunakan しか dan predikat negatif untuk menyatakan hanya 2 orang.','ふたりしか ___。','Hanya ada dua orang.','いません','います','いました'],
  'Tulis 3 catatan persediaan untuk kegiatan: satu dengan だけ dan dua dengan しか＋negatif. Sebut jumlah pasti dan jelaskan mana yang terasa kurang.');

add('5fab0a1a-5b0e-4cda-9bfa-f4659e7516f5',19,
  'Nばかり menunjukkan sesuatu didominasi oleh jenis itu; Vてばかりいる menunjukkan tindakan yang terus diulang/terlalu sering, sering disertai keluhan. Tidak harus berarti setiap saat tanpa pengecualian. Berbeda dari Vたばかり “baru saja”.',
  `さいきん、パンばかり たべています。|パンばかり|Akhir-akhir ini saya kebanyakan makan roti saja.
おとうとは ゲームを してばかり います。|してばかり います|Adik laki-laki saya terus bermain gim saja.
このクラスは がくせいばかりです。|がくせいばかりです|Kelas ini berisi mahasiswa saja.`,
  ['Apa yang ditekankan pembicara?','おとうとは ゲームを してばかり います。','Adik laki-laki saya terus bermain gim saja.','Bermain gim terlalu sering/terus-menerus','Baru selesai bermain gim satu kali','Belum pernah bermain gim'],
  ['Gunakan bentuk tindakan berulang dari ねる.','やすみの ひは ___ います。','Pada hari libur, ia tidur terus saja.','ねてばかり','ねたばかり','ねるばかりで'],
  'Tulis dua kebiasaan yang terlalu sering dilakukan dan satu kelompok yang didominasi suatu jenis orang/benda. Bedakan Vてばかりいる dari Vたばかり.');

add('525f3286-15cd-49fa-898e-1b35a7240b62',19,
  'だけで menunjukkan syarat/sarana minimal yang cukup untuk hasil. Sambungkan N atau Vる. Nyatakan hasil yang realistis dan spesifik; jangan membuat janji mutlak seperti menguasai bahasa hanya dengan satu tindakan kecil.',
  `このボタンを おすだけで、ドアが あきます。|おすだけで|Cukup menekan tombol ini, pintunya terbuka.
なまえを かくだけで、もうしこみが できます。|かくだけで|Cukup menulis nama, pendaftaran dapat dilakukan.
このカードだけで、ほんが かりられます。|このカードだけで|Dengan kartu ini saja, buku dapat dipinjam.`,
  ['Apa yang diperlukan untuk membuka pintu ini?','このボタンを おすだけで、ドアが あきます。','Cukup menekan tombol ini, pintunya terbuka.','Cukup menekan tombol ini','Harus menekan tombol dan menelepon petugas','Harus membeli pintu baru'],
  ['Nyatakan cara minimal dengan bentuk kamus おす.','ボタンを ___、でんきが つきます。','Cukup menekan tombol, lampunya menyala.','おすだけで','おしてだけで','おしますだけで'],
  'Tulis 3 petunjuk layanan sederhana yang cukup dilakukan dengan satu langkah atau satu benda. Gunakan Vるだけで dan Nだけで serta hasil yang konkret.');

add('3dba7a3c-ffbd-49bf-b0e6-fb84fdbe0317',19,
  'Nだけでなく、Nも menambahkan unsur kedua dengan predikat yang sesuai keduanya. Jangan menghilangkan も tanpa alasan. Contoh awal memakai nomina agar sambungan jelas; perluasan klausa memerlukan perubahan sambungan yang berbeda.',
  `このみせには、パンだけでなく、ケーキも あります。|パンだけでなく、ケーキも|Di toko ini bukan hanya ada roti, tetapi juga kue.
あには、えいごだけでなく、にほんごも はなせます。|えいごだけでなく、にほんごも|Kakak laki-laki bukan hanya bisa berbahasa Inggris, tetapi juga bahasa Jepang.
パーティーには、がくせいだけでなく、せんせいも きました。|がくせいだけでなく、せんせいも|Ke pesta itu bukan hanya siswa yang datang, tetapi juga guru.`,
  ['Apa yang dijual/tersedia di toko menurut kalimat ini?','このみせには、パンだけでなく、ケーキも あります。','Di toko ini bukan hanya ada roti, tetapi juga kue.','Roti dan kue','Hanya roti','Hanya kue'],
  ['Tambahkan kelompok kedua dengan も.','がくせいだけでなく、せんせい___ きました。','Bukan hanya siswa, guru juga datang.','も','だけ','しか'],
  'Tulis 3 kalimat yang menambahkan informasi: isi toko, kemampuan seseorang, dan peserta acara. Gunakan Nだけでなく、Nも dengan predikat yang cocok untuk kedua unsur.');

add('40677b8e-a5a8-4193-9d29-c775b8184068',19,
  'Jumlah＋も menonjolkan jumlah yang terasa banyak dalam konteks; jumlah＋は dapat menetapkan perkiraan batas minimal. Makna ini membutuhkan konteks, bukan arti tetap semua は/も. Bandingkan “sebanyak 10” dengan “setidaknya 10”; keduanya bukan “hanya 10”.',
  `いちじかんも まちました。とても ながかったです。|いちじかんも|Saya menunggu sampai satu jam. Rasanya sangat lama.
きょうは コーヒーを ごはいも のみました。|ごはいも|Hari ini saya minum kopi sebanyak lima cangkir.
みんなで じゅうにんは きます。じゅういちにんかも しれません。|じゅうにんは|Setidaknya sepuluh orang akan datang. Mungkin sebelas orang.`,
  ['Apa sikap pembicara terhadap durasi menunggu?','にじかんも まちました。','Saya menunggu sampai dua jam.','Dua jam terasa lama/banyak','Dua jam adalah batas minimal resmi','Ia sama sekali tidak menunggu'],
  ['Pembicara terkejut jumlahnya banyak: 5 cangkir. Pilih penekanan jumlah.','コーヒーを ごはい___ のみました。そんなに のんだんですか。','Saya minum sampai lima cangkir kopi. Sebanyak itu?','も','しか','ごろ'],
  'Tulis satu jumlah yang mengejutkan dengan も dan satu perkiraan minimum dengan は. Tambahkan kalimat konteks yang menjelaskan rasa banyak atau batas minimumnya.');

add('b391824a-4944-467a-ada3-935d375e7ab5',20,
  'AはBほど〜ない membandingkan A yang tidak mencapai derajat B; predikatnya negatif. Fungsi derajat memakai N/V普通形＋ほど, misalnya こどもでもわかるほど = sampai tingkat anak pun paham. Jangan menyamakan semua ほど dengan “lebih daripada”.',
  `このまちは とうきょうほど おおきく ありません。|とうきょうほど おおきく ありません|Kota ini tidak sebesar Tokyo.
きょうは きのうほど さむく ありません。|きのうほど さむく ありません|Hari ini tidak sedingin kemarin.
こどもでも わかるほど、やさしく せつめいしました。|わかるほど|Saya menjelaskannya dengan mudah sampai anak-anak pun dapat memahami.`,
  ['Bagaimana perbandingan cuaca kedua hari?','きょうは きのうほど さむく ありません。','Hari ini tidak sedingin kemarin.','Kemarin lebih dingin daripada hari ini','Hari ini lebih dingin daripada kemarin','Kedua hari pasti sama dingin'],
  ['Nyatakan “tidak semahal tas itu” dengan ほど＋negatif.','このかばんは あのかばんほど ___。','Tas ini tidak semahal tas itu.','たかく ありません','たかいです','たかかったです'],
  'Bandingkan dua tempat atau barang dengan ほど〜ない dalam dua kalimat. Tambahkan satu kalimat yang menunjukkan tingkat kejelasan/kesulitan memakai V普通形＋ほど.');

add('b95dda50-4227-4e68-828e-66b240899ea2',20,
  'くらい／ぐらい untuk perkiraan jumlah atau durasi; ごろ untuk titik waktu. さんじごろ = sekitar pukul 3; さんじかんぐらい = sekitar 3 jam. Fungsi derajat: ひとりでもてるくらい = cukup/sampai tingkat bisa dibawa sendiri. くらい dan ぐらい sama-sama dapat dipakai pada contoh durasi ini.',
  `えきまで じゅっぷんぐらい かかります。|じゅっぷんぐらい|Perjalanan ke stasiun memerlukan sekitar sepuluh menit.
さんじごろ、うちへ かえります。|さんじごろ|Saya akan pulang sekitar pukul tiga.
このにもつは ひとりで もてるくらい かるいです。|もてるくらい|Barang bawaan ini cukup ringan untuk dibawa seorang diri.`,
  ['Mana yang ditunjukkan さんじごろ?','さんじごろ、えきで あいましょう。','Mari bertemu di stasiun sekitar pukul tiga.','Titik waktu sekitar pukul 3','Durasi sekitar 3 jam','Jumlah sekitar 3 orang'],
  ['Ini durasi perjalanan 2 jam; pilih ungkapan perkiraan durasi.','ここから にじかん___ かかります。','Dari sini diperlukan sekitar dua jam.','ぐらい','ごろ','にち'],
  'Tulis jadwal singkat yang berisi jam bertemu, durasi perjalanan, dan perkiraan biaya. Gunakan ごろ untuk jam dan くらい/ぐらい untuk durasi/jumlah.');

add('125510ff-57cc-426c-b80e-fad4bd67a2b3',20,
  'Periodeにjumlah回 menyatakan frekuensi: いっしゅうかんにさんかい. ごとに berarti setiap satuan/interval: いちじかんごとに. Bedakan tiga kali per minggu dari setiap tiga minggu; nama satuan menentukan makna.',
  `いっしゅうかんに さんかい、はしります。|いっしゅうかんに さんかい|Saya berlari tiga kali seminggu.
いちじかんごとに、すこし やすみます。|いちじかんごとに|Saya beristirahat sebentar setiap satu jam.
このバスは じゅっぷんごとに きます。|じゅっぷんごとに|Bus ini datang setiap sepuluh menit.`,
  ['Apa jadwal olahraga pembicara?','いっしゅうかんに さんかい、はしります。','Saya berlari tiga kali seminggu.','Tiga kali dalam satu minggu','Sekali setiap tiga minggu','Tiga minggu tanpa berhenti'],
  ['Lengkapi frekuensi dua kali per minggu.','いっしゅうかん___ にかい、うんどうします。','Saya berolahraga dua kali seminggu.','に','を','へ'],
  'Tulis dua kebiasaan dengan frekuensi per minggu/bulan dan satu jadwal berulang dengan ごとに. Nyatakan jumlah dan satuan dengan jelas.');

add('f0c253a0-ee38-491f-a957-c24ea0e1fa94',20,
  'Batas: 以上（いじょう）= ≥, 以下（いか）= ≤, 未満（みまん）= <. Jadi 10以上 termasuk 10; 10以下 juga termasuk 10; 10未満 tidak termasuk 10. 以外（いがい）berarti selain/di luar kelompok, bukan batas angka.',
  `じゅうはっさい いじょうの ひとが さんかできます。|じゅうはっさい いじょう|Orang berusia delapan belas tahun atau lebih dapat ikut.
にもつは ごキロ いかに して ください。|ごキロ いか|Tolong batasi barang bawaan menjadi lima kilogram atau kurang.
ろくさい みまんの こどもは むりょうです。|ろくさい みまん|Anak di bawah enam tahun tidak dikenai biaya.`,
  ['Apakah orang yang tepat berusia 18 tahun boleh ikut?','じゅうはっさい いじょうの ひとが さんかできます。','Orang berusia delapan belas tahun atau lebih dapat ikut.','Ya, karena batas 18 termasuk','Tidak, harus sudah 19 tahun','Hanya orang di bawah 18 tahun yang boleh'],
  ['Pilih batas yang berarti di bawah 6, tidak termasuk 6.','ろくさい ___の こどもは むりょうです。','Anak di bawah enam tahun gratis.','みまん','いじょう','いか'],
  'Buat tiga aturan acara dengan 以上、以下、未満 dan tulis apakah angka batas termasuk. Tambahkan satu keterangan N以外 seperti hari selain Minggu. Catatan: むりょう = gratis.');

add('b9365e25-6149-4998-9481-8bcaf30c3809',20,
  '場合（ばあい）は lazim dalam prosedur atau kemungkinan tertentu. Sambungan: いくばあい、いったばあい、あついばあい、しずかなばあい、あめのばあい. Jangan menambahkan の setelah verba atau な setelah nomina.',
  `あめの ばあいは、うんどうかいは ありません。|あめの ばあいは|Jika hujan, acara olahraga tidak diadakan.
ちこくする ばあいは、でんわして ください。|ちこくする ばあいは|Jika akan terlambat, tolong telepon.
ぐあいが わるい ばあいは、せんせいに いって ください。|わるい ばあいは|Jika kondisi badan tidak baik, tolong beri tahu guru.`,
  ['Apa yang harus dilakukan jika akan terlambat?','ちこくする ばあいは、でんわして ください。','Jika akan terlambat, tolong telepon.','Menelepon','Datang tanpa memberi kabar','Membatalkan semua kelas'],
  ['Sambungkan nomina あめ dengan ばあい.','___ ばあいは、うちで れんしゅうします。','Jika hujan, kami berlatih di rumah.','あめの','あめな','あめだ'],
  'Tulis 3 prosedur kegiatan kelas dengan 場合は: jika hujan, jika terlambat, dan jika kondisi badan buruk. Berikan tindakan yang konkret. Catatan: ちこくする = terlambat; うんどうかい = acara olahraga.');

add('31347e0b-b65f-4dec-81bd-48514de1a04a',20,
  'まま menyatakan keadaan dibiarkan tetap saat tindakan lain terjadi. Vたまま: hasil tindakan masih bertahan; Vないまま: tindakan belum/tidak dilakukan. Aい langsung, Aな＋な、N＋の. Berbeda dari ながら yang menekankan dua aktivitas bersamaan.',
  `でんきを つけたまま、ねて しまいました。|つけたまま|Saya tertidur dengan lampu masih menyala.
あさごはんを たべないまま、がっこうへ いきました。|たべないまま|Saya pergi ke sekolah tanpa sarapan terlebih dahulu.
このへやは むかしのままです。|むかしのまま|Ruangan ini masih seperti dahulu.`,
  ['Bagaimana keadaan lampu ketika pembicara tertidur?','でんきを つけたまま、ねて しまいました。','Saya tertidur dengan lampu masih menyala.','Lampu masih menyala','Lampu sudah dimatikan','Pembicara sedang memasang lampu baru'],
  ['Lampu sudah dinyalakan dan tetap menyala. Gunakan hasil keadaan＋まま.','でんきを ___、へやを でました。','Saya keluar kamar dengan lampu masih menyala.','つけたまま','つけてまま','つけますまま'],
  'Tulis dua situasi keadaan yang tidak berubah memakai Vたまま dan Vないまま. Tambahkan satu contoh keadaan tempat/benda dengan Nのまま.');

add('9b1195b6-a59c-467e-8c45-0e6480dc196c',20,
  'とおりに mengacu pada contoh/petunjuk yang diikuti: Vるとおりに、Vたとおりに、Nのとおりに. Sebagian nomina memakai どおりに langsung, misalnya よていどおりに. “Seperti yang saya katakan” tidak sama dengan “setelah saya mengatakan”; fokusnya kesesuaian.',
  `わたしが いうとおりに、かいて ください。|いうとおりに|Tolong tulis sesuai yang saya katakan.
せんせいが せつめいしたとおりに、つくりました。|せつめいしたとおりに|Saya membuatnya sesuai penjelasan guru.
よていどおりに、くじに はじめます。|よていどおりに|Kami akan mulai pukul sembilan sesuai rencana.`,
  ['Apa yang menjadi acuan cara membuatnya?','せんせいが せつめいしたとおりに、つくりました。','Saya membuatnya sesuai penjelasan guru.','Penjelasan guru','Cara acak yang baru ditemukan','Kebalikan dari penjelasan guru'],
  ['Sambungkan penjelasan yang sudah diberikan: せつめいした.','せんせいが ___、かいて ください。','Tolong tulis sesuai yang sudah dijelaskan guru.','せつめいしたとおりに','せつめいしたのとおりに','せつめいしたなとおりに'],
  'Tulis satu instruksi untuk mengikuti contoh lisan, satu laporan mengikuti penjelasan, dan satu jadwal yang berjalan sesuai rencana. Gunakan とおりに／どおりに.');

add('6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d',21,
  'Pasif: かく→かかれる、かう→かわれる、まつ→またれる、はなす→はなされる、よむ→よまれる; たべる→たべられる; する→される; くる→こられる. G1 berakhir う menjadi われる, bukan あれる. Bentuk G2 られる juga dapat menyatakan kemampuan; peran orang, partikel, dan konteks menentukan makna.',
  `わたしは せんせいに ほめられました。|ほめられました|Saya dipuji oleh guru.
このへやは まいにち そうじされます。|そうじされます|Ruangan ini dibersihkan setiap hari.
このほんは おおくの ひとに よまれています。|よまれています|Buku ini dibaca oleh banyak orang.`,
  ['Mengapa ほめられました di sini bermakna pasif?','わたしは せんせいに ほめられました。','Saya dipuji oleh guru.','Saya menerima tindakan memuji dari guru','Saya mampu memuji guru','Guru dan saya saling membeli buku'],
  ['Pilih bentuk pasif dari かう.','このみせで たくさんの ほんが ___。','Banyak buku dibeli di toko ini.','かわれます','かあれます','かえます'],
  'Buat tabel mini bentuk kamus→pasif untuk かく、かう、たべる、する、くる. Lalu tulis dua kalimat yang jelas menunjukkan penerima tindakan atau benda yang dikenai tindakan.');

add('72b03ce1-80bd-4b30-b23c-582fa5efab75',21,
  'Pasif langsung menjadikan orang yang dikenai tindakan sebagai topik. Bandingkan せんせいがわたしをほめた → わたしはせんせいにほめられた. Pelaku memakai に; penerima tindakan tidak otomatis merasa dirugikan, misalnya dipuji atau diundang.',
  `わたしは せんせいに ほめられました。|せんせいに ほめられました|Saya dipuji oleh guru.
あには ともだちに パーティーに さそわれました。|ともだちに パーティーに さそわれました|Kakak laki-laki diajak ke pesta oleh teman.
こどもは ははに しかられました。|ははに しかられました|Anak itu dimarahi oleh ibunya.`,
  ['Siapa yang melakukan tindakan memuji?','わたしは せんせいに ほめられました。','Saya dipuji oleh guru.','Guru','Saya','Teman guru'],
  ['Guru memuji saya. Lengkapi pelaku dalam kalimat pasif.','わたしは せんせい___ ほめられました。','Saya dipuji oleh guru.','に','を','と'],
  'Tulis tiga kalimat aktif tentang memuji, mengajak, atau memarahi. Ubah menjadi pasif langsung tanpa menukar siapa yang melakukan dan menerima tindakan.');

add('b0f52855-f571-478f-a932-33b52781c2ab',21,
  'Pasif milik/bagian tubuh menempatkan pemilik yang terdampak sebagai は, pelakuに, dan milik/bagian tubuhを. Misalnya kaki saya diinjak: わたしは…に あしをふまれた. Jangan menghapus を dari benda yang menjadi objek verba asal.',
  `わたしは おとうとに わたしの ケーキを たべられました。|ケーキを たべられました|Kue saya dimakan adik laki-laki, dan saya dirugikan.
わたしは でんしゃで となりの ひとに あしを ふまれました。|あしを ふまれました|Di kereta, kaki saya diinjak orang di sebelah.
あねは どろぼうに かばんを ぬすまれました。|かばんを ぬすまれました|Tas kakak perempuan dicuri pencuri.`,
  ['Milik siapa kue yang dimakan?','わたしは おとうとに わたしの ケーキを たべられました。','Kue saya dimakan adik laki-laki, dan saya dirugikan.','Milik saya, yang terdampak','Milik pencuri','Kalimat menyatakan saya makan kue adik'],
  ['Dalam pasif milik, pertahankan objek bagian tubuh dengan を.','わたしは となりの ひとに あし___ ふまれました。','Kaki saya diinjak orang di sebelah.','を','に','が'],
  'Tulis dua kejadian fiktif yang merugikan pemilik: benda dimakan/dirusak/dicuri atau kaki diinjak. Tandai pemilik, pelaku, dan benda/bagian tubuh dalam setiap kalimat pasif.');

add('14c1e4cb-db33-44d3-8a4a-806f63b9e27f',21,
  'Pasif tidak langsung menyatakan pihak yang terganggu oleh suatu kejadian, termasuk verba intransitif. 雨に降られる: pembicara terkena dampak hujan, bukan “dihujankan” secara harfiah. Tambahkan akibat supaya rasa terganggu jelas. Tidak semua pasif berarti kerugian; batas ini khusus konteks pasif tidak langsung.',
  `かえりに あめに ふられて、ふくが ぬれました。|あめに ふられて|Saat pulang saya kehujanan sehingga pakaian menjadi basah.
よる、あかんぼうに なかれて、ねむれませんでした。|あかんぼうに なかれて|Bayi menangis pada malam hari sehingga saya tidak bisa tidur.
ともだちに はやく かえられて、ひとりで かたづけました。|ともだちに はやく かえられて|Teman pulang lebih awal, sehingga saya terpaksa membereskan sendiri.`,
  ['Siapa yang terganggu oleh tangisan bayi?','よる、あかんぼうに なかれて、わたしは ねむれませんでした。','Bayi menangis pada malam hari sehingga saya tidak bisa tidur.','Saya yang tidak bisa tidur','Bayi menerima tindakan menangis dari saya','Teman yang tidak disebut dalam kalimat'],
  ['Gunakan pasif dari ふる dalam konteks kehujanan.','あめに ___、ふくが ぬれました。','Saya kehujanan sehingga pakaian basah.','ふられて','ふって','ふりられて'],
  'Tulis dua kejadian fiktif yang mengganggu seseorang. Gunakan pasif tidak langsung dan jelaskan akibatnya. Catatan: なく = menangis; ぬれる = menjadi basah.');

add('c74b4109-ff85-463c-8ef3-801d0a5b8555',21,
  'Pasif dapat menempatkan benda/peristiwa sebagai topik tanpa menyebut pelaku. によって menandai pelaku terutama dalam penciptaan, penemuan, atau karya; bukan pengganti universal に pada semua pasif orang. Lokasi tindakan tetap memakai で.',
  `このほんは せかいじゅうで よまれています。|よまれています|Buku ini dibaca di seluruh dunia.
このがっこうは ごじゅうねんまえに たてられました。|たてられました|Sekolah ini dibangun lima puluh tahun lalu.
このえは わたしの そふによって かかれました。|そふによって かかれました|Lukisan ini dibuat oleh kakek saya.`,
  ['Apa peran そふ pada kalimat ini?','このえは わたしの そふによって かかれました。','Lukisan ini dibuat oleh kakek saya.','Pembuat lukisan','Pembeli lukisan','Orang yang dilukis, pasti'],
  ['Pilih penanda pencipta karya pada pasif ini.','このえは そふ___ かかれました。','Lukisan ini dibuat oleh kakek.','によって','を','のためで'],
  'Tulis tiga deskripsi karya/tempat fiktif: satu tanpa pelaku, satu dengan waktu pembuatan, satu dengan pencipta＋によって. Pastikan tidak mengarang fakta tentang karya nyata.');

add('048f2898-cc0e-4cf4-be16-d18a94db71c7',22,
  'Kausatif: かく→かかせる; かう→かわせる; まつ→またせる; はなす→はなさせる; よむ→よませる; たべる→たべさせる; する→させる; くる→こさせる. Perubahan akhir う pada G1 menjadi わせる. Bentuknya sama untuk menyuruh atau mengizinkan; konteks membedakan.',
  `せんせいは がくせいに さくぶんを かかせました。|かかせました|Guru menyuruh siswa menulis karangan.
ははは こどもに やさいを たべさせました。|たべさせました|Ibu menyuruh anak makan sayur.
ぶちょうは ぶかに じゅんびを させました。|させました|Kepala bagian menyuruh bawahan melakukan persiapan.`,
  ['Apa yang dilakukan siswa pada kalimat ini?','せんせいは がくせいに さくぶんを かかせました。','Guru menyuruh siswa menulis karangan.','Menulis karangan atas instruksi guru','Menyuruh guru menulis karangan','Membaca karangan tanpa instruksi'],
  ['Pilih bentuk kausatif かう.','ははは こどもに パンを ___。','Ibu menyuruh anak membeli roti.','かわせました','かあせました','かえました'],
  'Buat tabel kamus→kausatif untuk かく、かう、たべる、する、くる. Pakai dua bentuk dalam kalimat yang menyebut penyuruh dan pelaku tindakan.');

add('04b312f4-1eda-4463-be08-ea3a506b12a2',22,
  'Transitif: penyebabは pelakuに bendaを V使役. Intransitif dapat memakai pelakuを atau に bergantung verba, kendali/izin, dan konteks; jangan menjadikan を/に sebagai dua jawaban yang otomatis saling salah. Hindari dua を pada satu klausa transitif. Makna izin harus diberi konteks keinginan/izin yang nyata.',
  `せんせいは がくせいに このぶんを よませました。|よませました|Guru menyuruh siswa membaca kalimat ini.
ははは こどもを はやく ねさせました。|ねさせました|Ibu menyuruh anak tidur lebih awal.
むすめが いきたがっていたので、ははは むすめを パーティーに いかせました。|いかせました|Karena anak perempuannya ingin pergi, ibu mengizinkannya pergi ke pesta.`,
  ['Mengapa いかせました bermakna mengizinkan pada konteks ini?','むすめが いきたがっていたので、ははは むすめを パーティーに いかせました。','Karena anaknya ingin pergi, ibu mengizinkannya pergi ke pesta.','Anak ingin pergi dan ibu memperbolehkannya','Semua kausatif selalu berarti paksaan','Ibu pergi menggantikan anaknya'],
  ['Pada klausa transitif, siswa pelaku dan buku objeknya.','せんせいは がくせい___ ほんを よませました。','Guru menyuruh siswa membaca buku.','に','を','の'],
  'Tulis satu kausatif bermakna menyuruh dan satu bermakna mengizinkan. Tambahkan konteks yang membedakan keduanya; tandai pelaku dengan partikel yang sesuai verba.');

add('d15fef58-d4b8-4447-a4da-0bb330b3350a',22,
  'Kausatif＋てください dapat meminta izin agar saya melakukan sesuatu: はなさせてください. Dengan あげる／くれる／もらう, periksa siapa yang memberi izin dan siapa yang diberi kesempatan. Saya menerima izin: わたしはせんせいにはなさせてもらった. Jangan menganggap ini permintaan agar guru yang berbicara.',
  `せんせい、すこし はなさせて ください。|はなさせて ください|Pak/Bu Guru, izinkan saya berbicara sebentar.
ははが わたしを パーティーに いかせて くれました。|いかせて くれました|Ibu mengizinkan saya pergi ke pesta.
わたしは せんせいに もういちど やって みさせて もらいました。|みさせて もらいました|Saya mendapat izin guru untuk mencoba sekali lagi.`,
  ['Siapa yang ingin berbicara pada permintaan ini?','せんせい、すこし はなさせて ください。','Pak/Bu Guru, izinkan saya berbicara sebentar.','Saya, orang yang meminta izin','Guru diminta berbicara','Semua teman wajib berbicara'],
  ['Minta izin berbicara; gunakan kausatif dari はなす.','すこし ___ ください。','Izinkan saya berbicara sebentar.','はなさせて','はなして','はなされて'],
  'Tulis satu permintaan izin memakai kausatif＋てください, satu izin yang orang lain berikan dengan てくれる, dan satu kesempatan yang Anda terima dengan てもらう.');

add('1bd12c89-d0c9-48c8-8f9b-50c0499f68af',22,
  'Kausatif-pasif dibentuk dari kausatif: かく→かかせる→かかせられる; かう→かわせる→かわせられる; たべる→たべさせる→たべさせられる; する→させる→させられる; くる→こさせる→こさせられる. Bentuk penuh adalah dasar sebelum bentuk pendek. Konteks biasanya menekankan tindakan yang terpaksa dilakukan.',
  `わたしは せんせいに さくぶんを かかせられました。|かかせられました|Saya disuruh guru menulis karangan meskipun enggan.
こどもの とき、きらいな やさいを たべさせられました。|たべさせられました|Saat kecil, saya dipaksa makan sayur yang tidak saya sukai.
わたしは じょうしに にちようびも しごとを させられました。|させられました|Saya dipaksa atasan bekerja bahkan pada hari Minggu.`,
  ['Apa yang dinyatakan たべさせられました?','きらいな やさいを たべさせられました。','Saya dipaksa makan sayur yang tidak saya sukai.','Saya terpaksa memakan sayur','Sayur saya dimakan orang lain','Saya mengizinkan orang lain makan sayur'],
  ['Bentuk kausatif-pasif penuh dari たべる.','きらいな ものを ___。','Saya dipaksa memakan sesuatu yang tidak saya sukai.','たべさせられました','たべられさせました','たべさされました'],
  'Buat tabel tiga tahap kamus→kausatif→kausatif-pasif untuk かく、たべる、する、くる. Tulis satu situasi fiktif dengan bentuk penuh dan pelaku penyuruh yang jelas.');

add('e27a8964-c6ba-4fba-8c0b-505a79ae5b58',22,
  'Pelaku yang terpaksa menjadi topik は; penyuruh memakai に. Bandingkan せんせいがわたしにかかせた dengan わたしはせんせいにかかせられた. Pastikan kalimat tidak berubah menjadi pasif biasa: かかれた = ditulis, かかせられた = dipaksa menulis.',
  `わたしは せんせいに なんども さくぶんを かかせられました。|せんせいに なんども さくぶんを かかせられました|Saya disuruh guru menulis karangan berulang kali meskipun enggan.
あには じょうしに おそくまで はたらかせられました。|じょうしに おそくまで はたらかせられました|Kakak laki-laki dipaksa atasan bekerja sampai larut.
わたしは ははに へやを そうじさせられました。|ははに へやを そうじさせられました|Saya disuruh ibu membersihkan kamar meskipun enggan.`,
  ['Siapa penyuruh pada kalimat ini?','わたしは ははに へやを そうじさせられました。','Saya disuruh ibu membersihkan kamar meskipun enggan.','Ibu','Saya','Orang yang tinggal di kamar sebelah'],
  ['Tandai penyuruh dalam kausatif-pasif.','わたしは せんせい___ さくぶんを かかせられました。','Saya disuruh guru menulis karangan meskipun enggan.','に','を','が'],
  'Buat dua situasi fiktif yang melibatkan instruksi yang tidak diinginkan. Tulis siapa penyuruhnya dan ubah menjadi kalimat dengan orang yang terpaksa sebagai topik.');

add('4442b73f-f698-41f5-97b1-9c0a22b4f06a',22,
  'Bentuk pendek G1: かかせられる→かかされる; のませられる→のまされる; いかせられる→いかされる; またせられる→またされる. Jangan terapkan pada G1 akhir す: はなす→はなさせられる, bukan はなさされる. G2 たべさせられる dan する→させられる tidak dipendekkan dengan aturan ini.',
  `わたしは せんせいに さくぶんを かかされました。|かかされました|Saya disuruh guru menulis karangan meskipun enggan.
あには じょうしに おそくまで はたらかされました。|はたらかされました|Kakak laki-laki dipaksa atasan bekerja sampai larut.
わたしは せんせいに みんなの まえで はなさせられました。|はなさせられました|Saya disuruh guru berbicara di depan semua orang meskipun enggan.`,
  ['Mana penjelasan yang benar tentang dua bentuk ini?','かかせられました → かかされました','Disuruh menulis: bentuk penuh menjadi bentuk pendek.','Maknanya tetap kausatif-pasif','Bentuk pendek mengubahnya menjadi izin','Bentuk pendek berarti mampu menulis'],
  ['Pendekkan bentuk G1 かかせられました.','わたしは さくぶんを ___。','Saya disuruh menulis karangan meskipun enggan.','かかされました','かかれました','かきさせました'],
  'Ubah bentuk penuh かかせられる、のませられる、またせられる ke bentuk pendek. Tulis satu contoh はなさせられる dan jelaskan mengapa bentuk itu tidak dipendekkan.');

add('4d327a80-19df-4383-9ecf-c2819ee2b9a1',23,
  'Sonkeigo menghormati pelaku tindakan, bukan meninggikan diri sendiri. Pasangan yang sesuai: よむ→およみになる; かえる→おかえりになる; やすむ→おやすみになる; りようする→ごりようになる. Tidak semua verba menerima pola ini; misalnya みる memakai ごらんになる dan する memakai なさる. Hindari bentuk rangkap seperti およみになられる.',
  `せんせいは このほんを およみに なりました。|およみに なりました|Guru membaca buku ini. (hormat)
しゃちょうは もう おかえりに なりました。|おかえりに なりました|Direktur sudah pulang. (hormat)
おきゃくさまは このへやを ごりように なります。|ごりように なります|Tamu akan menggunakan ruangan ini. (hormat)`,
  ['Siapa yang dihormati oleh およみになります?','せんせいは このほんを およみに なります。','Guru membaca buku ini. (hormat)','Guru sebagai pelaku membaca','Buku sebagai penerima tindakan','Saya sebagai orang yang bertanya'],
  ['Ubah よみます ke pola お＋stem＋になる.','せんせいは ほんを ___。','Guru membaca buku. (hormat)','およみに なります','およむに なります','およんでに なります'],
  'Tulis 3 laporan kegiatan guru/tamu dengan sonkeigo yang cocok: membaca, pulang, dan menggunakan ruangan. Nyatakan pelakunya dan hindari bentuk hormat untuk tindakan diri sendiri.');

add('25c228b0-1f32-485f-b270-3b3f0ed8ba96',23,
  'れる／られる juga dapat menghormati pelaku aktif. Bandingkan せんせいがはなされる (guru berbicara, hormat) dengan わたしがせんせいにほめられる (saya dipuji, pasif). Bentuk saja tidak cukup; lihat siapa pelaku, objek, dan konteks. Tidak ada orang yang harus “dikenai tindakan” pada pemakaian hormat.',
  `せんせいは あした とうきょうへ いかれます。|いかれます|Guru akan pergi ke Tokyo besok. (hormat)
しゃちょうは かいぎで はなされました。|はなされました|Direktur berbicara dalam rapat. (hormat)
せんせいは このほんを かかれました。|かかれました|Guru menulis buku ini. (hormat)`,
  ['Pada konteks kegiatan guru, siapa yang menulis buku?','せんせいは このほんを かかれました。','Guru menulis buku ini. (hormat)','Guru sendiri','Orang lain menulis guru','Buku menulis tentang guru secara otomatis'],
  ['Nyatakan pergi secara hormat memakai bentuk れる dari いく.','せんせいは あした きょうとへ ___。','Guru akan pergi ke Kyoto besok. (hormat)','いかれます','いけます','いかせます'],
  'Tulis dua kegiatan guru memakai れる／られる bermakna hormat dan satu pasif biasa. Jelaskan peran pelaku/penerima agar kedua fungsi tidak tertukar.');

add('4ff7d528-056e-456a-b117-02174d3000ce',23,
  'Tabel hormat: 行く・来る・いる→いらっしゃる→いらっしゃいます; 食べる・飲む→召し上がる（めしあがる）→めしあがります; 見る→ご覧になる（ごらんになる）→ごらんになります. Gunakan untuk pelaku yang dihormati. Jangan membuat おみになる atau おたべになる sebagai latihan pengganti otomatis bentuk khusus ini.',
  `せんせいは いま きょうしつに いらっしゃいます。|いらっしゃいます|Guru sekarang berada di kelas. (hormat)
おきゃくさまは おちゃを めしあがります。|めしあがります|Tamu minum teh. (hormat)
しゃちょうは このしゃしんを ごらんに なりました。|ごらんに なりました|Direktur melihat foto ini. (hormat)`,
  ['Pada kalimat ini, いらっしゃいます menggantikan verba apa?','せんせいは いま きょうしつに いらっしゃいます。','Guru sekarang berada di kelas. (hormat)','いる','たべる','みる'],
  ['Gunakan verba hormat khusus untuk みる.','せんせいは このしゃしんを ___。','Guru melihat foto ini. (hormat)','ごらんに なります','めしあがります','いらっしゃいます'],
  'Tulis 3 kalimat tentang guru/tamu memakai masing-masing いらっしゃいます、めしあがります、ごらんになります. Pastikan konteks membedakan berada/pergi/datang pada いらっしゃる.');

add('c13c7fe2-d336-44f0-ac28-b4434a75d74a',23,
  'Tabel: する→なさる→なさいます; 言う→おっしゃる→おっしゃいます; 知っている→ご存じだ（ごぞんじだ）→ごぞんじです. ごぞんじ bukan verba yang dibentuk dengan られる. Pertanyaan ごぞんじですか menanyakan pengetahuan orang yang dihormati, bukan pengetahuan diri sendiri.',
  `せんせいは あした なにを なさいますか。|なさいますか|Apa yang akan Guru lakukan besok? (hormat)
せんせいは「あしたは やすみです」と おっしゃいました。|おっしゃいました|Guru mengatakan, “Besok libur.” (hormat)
このみせを ごぞんじですか。|ごぞんじですか|Apakah Anda mengetahui toko ini? (hormat)`,
  ['Ungkapan mana dalam kalimat ini menghormati tindakan mengatakan?','せんせいは「あしたは やすみです」と おっしゃいました。','Guru mengatakan, “Besok libur.” (hormat)','おっしゃいました','やすみです','あしたは'],
  ['Pilih bentuk hormat untuk mengetahui.','せんせい、このひとを ___か。','Pak/Bu Guru, apakah Anda mengenal orang ini?','ごぞんじです','ごぞんじます','ごしっています'],
  'Tulis satu kegiatan guru dengan なさいます, satu kutipan dengan おっしゃいました, dan satu pertanyaan pengetahuan dengan ごぞんじですか.');

add('c70802a3-abea-4002-a6f7-27123b74f27b',23,
  'Tabel sopan khusus: いらっしゃる→いらっしゃいます; なさる→なさいます; おっしゃる→おっしゃいます (bukan り＋ます). Instruksi hormat: まつ→おまちください; かく→おかきください; りようする→ごりようください. Pola お／ご tidak berlaku untuk semua verba; pelajari gabungan yang wajar.',
  `せんせいは なんじに いらっしゃいますか。|いらっしゃいますか|Pukul berapa Guru akan datang? (hormat)
こちらで すこし おまちください。|おまちください|Mohon menunggu sebentar di sini.
このへやを ごりようください。|ごりようください|Silakan menggunakan ruangan ini.`,
  ['Apa yang diminta dari tamu?','こちらで すこし おまちください。','Mohon menunggu sebentar di sini.','Menunggu di sini sebentar','Segera pulang','Membeli sesuatu di sini'],
  ['Pilih konjugasi sopan khusus dari いらっしゃる.','せんせいは あした ___。','Guru akan datang besok. (hormat)','いらっしゃいます','いらっしゃります','いらっしゃるます'],
  'Buat 3 kalimat untuk papan/petugas penerima tamu: pertanyaan waktu kedatangan, instruksi menunggu, dan izin menggunakan ruangan. Gunakan bentuk hormat yang wajar.');

add('f0bb035c-2a94-4e0b-b943-e97fb4057610',24,
  'Pola merendah menampilkan tindakan saya/pihak saya menuju pihak yang dihormati. Tabel: もつ→おもちする／おもちいたす; あんないする→ごあんないする／ごあんないいたす; せつめいする→ごせつめいする／ごせつめいいたす. Bentuk sopan: おもちします／ごあんないいたします. Tidak semua tindakan pribadi memakai お／ご＋する; perhatikan arah/manfaat tindakan.',
  `せんせい、かばんを おもちします。|おもちします|Pak/Bu Guru, saya akan membawakan tas Anda. (merendah)
かいぎしつまで ごあんないします。|ごあんないします|Saya akan mengantar Anda ke ruang rapat. (merendah)
わたしが つかいかたを ごせつめいいたします。|ごせつめいいたします|Saya akan menjelaskan cara penggunaannya. (merendah/formal)`,
  ['Siapa yang melakukan tindakan membawa pada tawaran ini?','せんせい、かばんを おもちします。','Pak/Bu Guru, saya akan membawakan tas Anda. (merendah)','Saya sebagai pembicara','Guru membawa tas saya','Tas itu dibawa sendiri'],
  ['Gunakan pola merendah dari もちます.','せんせいの かばんを ___。','Saya akan membawakan tas guru. (merendah)','おもちします','おもちに なります','おもつします'],
  'Tulis 3 tindakan petugas untuk membantu tamu: membawakan barang, mengantar, dan menjelaskan. Pakai bentuk merendah untuk tindakan petugas dan sebutkan penerima manfaatnya.');

add('a4fc5755-2cf0-4611-be9a-cd295f6f44fc',24,
  'Tabel langsung: 行く・来る→参る（まいる）→まいります; 言う→申す（もうす）→もうします; する→いたす→いたします; いる→おる→おります. Bentuk ini menyampaikan tindakan pihak saya dengan sangat sopan kepada pendengar. Menuju pihak yang dihormati: 訪ねる・聞く→伺う（うかがう）→うかがいます; 見る→拝見する（はいけんする）→はいけんします; 会う→お目にかかる（おめにかかる）→おめにかかります; 知っている→存じている（ぞんじている）→ぞんじております. 参る tidak otomatis menghormati tempat/orang tujuan; 伺う menghormati pihak yang dikunjungi/ditanya. Jangan gunakan bentuk merendah untuk meninggikan tindakan guru.',
  `はじめまして。やまだと もうします。|もうします|Salam kenal. Nama saya Yamada. (formal)
あした、ごじに そちらへ まいります。|まいります|Besok pukul lima saya akan datang ke tempat Anda. (sangat sopan)
あした、せんせいの おたくに うかがいます。|うかがいます|Besok saya akan mengunjungi rumah Guru. (menghormati guru yang dikunjungi)`,
  ['Dalam 先生のお宅に伺います, siapa yang dihormati sebagai pihak tujuan?','せんせいの おたくに うかがいます。','Saya akan mengunjungi rumah Guru.','Guru yang dikunjungi','Saya sendiri sebagai pengunjung','Semua rumah secara otomatis'],
  ['Lengkapi perkenalan nama secara formal dengan bentuk khusus dari いう.','はじめまして。やまだと ___。','Salam kenal. Nama saya Yamada. (formal)','もうします','おっしゃいます','いらっしゃいます'],
  'Tulis perkenalan formal dengan 申します, pemberitahuan perjalanan dengan 参ります, dan kunjungan kepada guru dengan 伺います. Jelaskan perbedaan arah penghormatan dua kalimat terakhir.');

add('67669ac0-c0f3-48a3-9ffe-50d8eec3fae7',24,
  'ございます adalah bentuk sangat sopan dari あります; でございます dari です. Ini 丁寧語 kepada pendengar, tidak otomatis kenjougo. Tabel: あります→ございます; ありません→ございません; です→でございます; ではありません→ではございません. Untuk keberadaan orang, jangan mengganti います dengan ございます.',
  `かいぎしつは にかいに ございます。|ございます|Ruang rapat berada di lantai dua. (formal)
こちらが うけつけで ございます。|で ございます|Di sinilah bagian penerimaan. (formal)
もうしわけありません。いま、おちゃは ございません。|ございません|Mohon maaf. Saat ini tidak tersedia teh. (formal)`,
  ['Apa yang berubah ketika あります menjadi ございます?','かいぎしつは にかいに ございます。','Ruang rapat berada di lantai dua. (formal)','Tingkat kesopanan kepada pendengar','Ruang rapat menjadi orang yang dihormati','Lokasi ruang rapat berubah'],
  ['Pakai bentuk formal dari です untuk menyatakan identitas tempat.','こちらが うけつけ___。','Di sinilah bagian penerimaan. (formal)','で ございます','に ございます','を ございます'],
  'Tulis 3 informasi layanan: lokasi ruangan dengan ございます, identitas tempat dengan でございます, dan ketiadaan barang dengan ございません. Catatan: うけつけ = bagian penerimaan.');

add('7464741d-e555-41d3-9740-20a42e367d4f',24,
  'Tabel arah pemberian: あげる→差し上げる（さしあげる）→さしあげます; もらう→いただく→いただきます; くれる→くださる→くださいます (bukan くださります). 差し上げる/いただく merendahkan pihak saya; くださる menghormati pemberi. Untuk benda, pilih bentuk berdasarkan siapa memberi dan menerima, bukan hanya siapa lawan bicara.',
  `わたしは せんせいに はなを さしあげました。|さしあげました|Saya memberikan bunga kepada Guru. (merendah)
わたしは せんせいから ほんを いただきました。|いただきました|Saya menerima buku dari Guru. (merendah)
せんせいが わたしに ペンを くださいました。|くださいました|Guru memberikan pena kepada saya. (hormat kepada pemberi)`,
  ['Siapa pemberi pena dalam kalimat ini?','せんせいが わたしに ペンを くださいました。','Guru memberikan pena kepada saya. (hormat)','Guru','Saya','Teman saya'],
  ['Guru memberi kepada saya; pertahankan guru sebagai subjek.','せんせいが わたしに ほんを ___。','Guru memberikan buku kepada saya. (hormat)','くださいました','いただきました','さしあげました'],
  'Tulis satu pemberian kepada guru, satu penerimaan dari guru, dan satu pemberian dari guru dengan guru sebagai subjek. Pakai masing-masing 差し上げる、いただく、くださる.');

add('a7d157a1-a976-4101-99ae-0c3976bbc0f0',24,
  'ていただく berpusat pada penerima bantuan pihak saya; てくださる menghormati pelaku bantuan. ていただけませんか／ていただけますか meminta bantuan secara formal. て差し上げる dapat menonjolkan jasa pembicara; jangan menjadikannya tawaran langsung otomatis kepada guru/atasan. Untuk menawarkan membawa tas guru, gunakan かばんをおもちしましょうか. て差し上げる tetap berguna dalam laporan tindakan yang konteksnya sesuai.',
  `わたしは せんせいに さくぶんを みて いただきました。|みて いただきました|Saya mendapat bantuan Guru memeriksa karangan. (merendah)
せんせいが みちを おしえて くださいました。|おしえて くださいました|Guru membantu saya dengan memberi tahu jalan. (hormat)
すみません。ここに おなまえを かいて いただけませんか。|かいて いただけませんか|Permisi, dapatkah Anda menuliskan nama di sini? (formal)`,
  ['Anda ingin langsung menawarkan membawa tas guru. Mana prinsip yang paling sesuai?','せんせい、かばんを おもちしましょうか。','Pak/Bu Guru, boleh saya membawakan tas Anda?','Tawarkan dengan お持ちしましょうか; tidak perlu menonjolkan jasa sendiri','Selalu gunakan て差し上げる karena pasti paling sopan','Gunakan perintah langsung agar guru memberi tas'],
  ['Minta bantuan secara formal memakai ていただけませんか dari かく.','ここに なまえを ___ いただけませんか。','Dapatkah Anda menuliskan nama di sini?','かいて','かく','かき'],
  'Tulis satu laporan menerima bantuan dengan ていただく, satu dengan pelaku＋てくださる, dan satu permintaan ていただけませんか. Tambahkan catatan Indonesia mengapa tawaran langsung kepada guru tidak otomatis memakai て差し上げる.');

add('90ed9f69-9235-4d85-ad1e-e30e615d3e39',24,
  'Ucapan terima kasih formal: Vていただき、ありがとうございます (sudut pandang menerima bantuan) dan Vてくださって、ありがとうございます (menghormati pelaku bantuan). Bentuk sambung: いただく→いただき; くださる→くださって. Partikel mengikuti sudut pandang: 先生に見ていただいた／先生が見てくださった. Setelah acara selesai, ありがとうございました juga dapat dipakai.',
  `せんせい、さくぶんを みて いただき、ありがとうございます。|みて いただき、ありがとうございます|Pak/Bu Guru, terima kasih atas bantuan memeriksa karangan saya.
おいそがしいのに、きて くださって、ありがとうございます。|きて くださって、ありがとうございます|Terima kasih sudah datang meskipun Anda sibuk.
くわしく せつめいして いただき、ありがとうございました。|せつめいして いただき、ありがとうございました|Terima kasih atas penjelasan yang terperinci. (sesudah penjelasan selesai)`,
  ['Sudut pandang apa yang digunakan ていただき?','さくぶんを みて いただき、ありがとうございます。','Terima kasih atas bantuan memeriksa karangan saya.','Saya menerima bantuan lalu berterima kasih','Saya memeriksa karangan orang lain dan meminta hadiah','Saya melarang guru memeriksa karangan'],
  ['Sambungkan くださる sebelum ありがとうございます.','きて ___、ありがとうございます。','Terima kasih sudah datang. (hormat)','くださって','くださりて','くださるて'],
  'Tulis tiga ucapan terima kasih formal untuk bantuan nyata/fiktif yang berbeda. Pakai kedua sudut pandang ていただき dan てくださって, serta bentuk lampau untuk satu kegiatan yang sudah selesai.');

// References for usage limits: Japan Foundation (と/ば), TUFS (benefactive particles/register),
// Agency for Cultural Affairs (keigo direction; humble vs courteous forms).
// https://www.kyozai.jpf.go.jp/kyozai/material/BTS00030/ja/render.do
// https://www.kyozai.jpf.go.jp/kyozai/material/BMA00018/ja/render.do
// https://www.coelang.tufs.ac.jp/mt/ja/gmod/courses/c02/lesson44/step1/explanation/086.html
// https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/keigo/chapter2/detail.html
export default items;
