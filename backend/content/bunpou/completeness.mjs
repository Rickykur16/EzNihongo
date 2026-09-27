// Original teaching material. Indices follow the approved Canva plan, not DB order.
// Existing good examples/dialogues are retained; additions fill named coverage gaps.
import fs from 'node:fs';
const plan = JSON.parse(fs.readFileSync(new URL('../../scripts/n5-bunpou-canva-plan.json', import.meta.url)));
export const cards = [];
function c(bab, index, notes, dialogue, examples = '') {
  const chapter = plan.find(p => p.bab === bab);
  const slots = chapter.parts.flatMap(p => p.patterns.map(pattern => ({lesson: p.slug, pattern})));
  const lines = dialogue.split('\n').map(s => s.split('|'));
  cards.push({bab, ...slots[index], notes,
    dialog: lines.map((p,i) => `${i % 2 ? 'B' : 'A'}: ${p[0]}`).join('\n'),
    translation: lines.map((p,i) => `${i % 2 ? 'B' : 'A'}: ${p[1]}`).join('\n'),
    addExamples: examples ? examples.split('\n').map(s => {
      const [japanese, highlight, indonesian] = s.split('|'); return {japanese, highlight, indonesian};
    }) : []});
}

c(3,0,'Pola: A は B です. A adalah orang yang dibicarakan; B menyebut nama, asal, atau pekerjaan. は ditulis ha tetapi dibaca wa. です membuat kalimat sopan. Untuk memperkenalkan diri, tidak perlu menambahkan さん pada nama sendiri.',
`はじめまして。わたしはアンナです。|Salam kenal. Saya Anna.
はじめまして。ハディです。|Salam kenal. Saya Hadi.`);
c(3,1,'Pola: A は B じゃありません／ではありません. Artinya A bukan B. ではありません lebih formal; keduanya sopan. Bentuk ini dipakai dengan kata benda, misalnya がくせい. Jangan menghilangkan は ketika membandingkan identitas seseorang.',
`がくせいですか。|Apakah Anda pelajar?
いいえ、がくせいじゃありません。せんせいです。|Bukan, saya bukan pelajar. Saya guru.`,
`わたしはせんせいではありません。|ではありません|Saya bukan guru.`);
c(3,2,'Pola: A は B ですか. Tambahkan か setelah です untuk bertanya. Jawab はい jika benar dan いいえ jika tidak; lalu sebutkan identitas yang tepat. Dalam tulisan Jepang, 。 dapat dipakai di akhir pertanyaan ini.',
`インドネシアじんですか。|Apakah Anda orang Indonesia?
はい、インドネシアじんです。|Ya, saya orang Indonesia.`);
c(3,3,'Pola: A の B. Kata utama adalah B; A menerangkan pemilik atau afiliasinya. わたしのなまえ = nama saya; さくらだいがくのがくせい = mahasiswa Universitas Sakura. Jadi の tidak selalu berarti milik: universitas menerangkan tempat seseorang belajar.',
`がくせいですか。|Apakah Anda mahasiswa?
はい、さくらだいがくのがくせいです。|Ya, saya mahasiswa Universitas Sakura.`,
`わたしはさくらだいがくのがくせいです。|の|Saya mahasiswa Universitas Sakura.`);
c(3,4,'Pola: A も B です. Gunakan も ketika informasi yang sama berlaku bagi orang lain. も menggantikan は pada pola ini. Contoh membutuhkan konteks: setelah seseorang berkata bahwa ia pelajar, わたしもがくせいです berarti saya juga pelajar.',
`わたしはがくせいです。|Saya pelajar.
わたしもがくせいです。|Saya juga pelajar.`);
c(3,5,'Tambahkan ね atau よ setelah kalimat lengkap. ね meminta persetujuan atau memastikan informasi yang diperkirakan sudah diketahui bersama. よ memberi informasi kepada lawan bicara. Keduanya bukan pengganti か untuk semua pertanyaan.',
`がくせいですね。|Anda pelajar, ya?
いいえ、せんせいですよ。|Bukan, saya guru, lho.`,
`わたしはインドネシアじんですよ。|よ|Saya orang Indonesia, lho.`);

c(4,0,'これ, それ, dan あれ berdiri sendiri sebagai kata ganti benda. これ: dekat pembicara; それ: dekat lawan bicara; あれ: jauh dari keduanya. Pola: これ／それ／あれ は kata benda です. Pilih berdasarkan posisi benda, bukan besar atau kecilnya.',
`それはほんですか。|Apakah itu buku?
はい、これはほんです。|Ya, ini buku.`,
`あれはかばんです。|あれ|Itu (jauh dari kita berdua) tas.`);
c(4,1,'この／その／あの／どの harus langsung diikuti kata benda: このほん, bukan このはほん. この dekat pembicara, その dekat lawan bicara, あの jauh dari keduanya. どの + kata benda menanyakan yang mana di antara pilihan. Untuk bertanya identitas pilihan, gunakan どのほんですか.',
`どのほんですか。|Buku yang mana?
そのほんです。|Buku itu (di dekat Anda).`,
`どのほんですか。|どの|Buku yang mana?`);
c(4,2,'Pola: A の B. B adalah benda utama; A menjelaskan jenis, bahasa, atau asalnya. にほんごのほん = buku bahasa Jepang; にほんのほん = buku dari Jepang. Jangan menyamakan にほん (Jepang) dengan にほんご (bahasa Jepang). Kepunyaan dengan の sudah dipelajari pada Bab 3.',
`これはにほんごのほんですか。|Apakah ini buku bahasa Jepang?
いいえ、インドネシアごのほんです。|Bukan, ini buku bahasa Indonesia.`);
c(4,3,'Gunakan はい、そうです untuk membenarkan pernyataan dalam pertanyaan. Untuk menyangkal, gunakan いいえ、ちがいます dan tambahkan informasi yang benar. ちがいます juga bentuk sopan, bukan bentuk kasual. Untuk pertanyaan apa/yang mana, sebutkan jawabannya; そうです saja tidak menjawab pertanyaan itu.',
`これはペンですか。|Apakah ini pena?
いいえ、ちがいます。えんぴつです。|Bukan. Ini pensil.
それはノートですか。|Apakah itu buku tulis?
はい、そうです。|Ya, benar.`);

c(5,0,'Pola: benda は いくらですか. いくら menanyakan harga. Jawab dengan angka + えん (yen), misalnya ごひゃくえんです. Jika bendanya sudah jelas, cukup いくらですか. Jangan memakai なんさい karena itu menanyakan umur.',
`このペンはいくらですか。|Berapa harga pena ini?
ひゃくえんです。|Seratus yen.`,
`このほんはいくらですか。|いくら|Berapa harga buku ini?
そのほんはごひゃくえんです。|ごひゃくえん|Buku itu harganya lima ratus yen.`);
c(5,1,'Pola: いま、angka + じ + angka + ふん／ぷん です. Pertanyaan: いま、なんじですか. Jam 4 = よじ, 7 = しちじ, 9 = くじ. Menit berubah bunyi: いっぷん, さんぷん, ろっぷん, はっぷん, じゅっぷん. はん berarti lewat setengah jam: さんじはん = 03.30.',
`いま、なんじですか。|Sekarang jam berapa?
さんじはんです。|Jam setengah empat.`,
`いま、よじです。|よじ|Sekarang pukul empat.
いま、くじじゅっぷんです。|くじじゅっぷん|Sekarang pukul sembilan lewat sepuluh menit.`);
c(5,2,'Pola: waktu awal から waktu akhir まで. から menunjukkan mulai/dari; まで menunjukkan sampai. Contoh: くじからごじまでです = dari pukul sembilan sampai pukul lima. Jangan tertukar dengan harga; harga ditanyakan dengan いくら.',
`じゅぎょうはなんじからなんじまでですか。|Pelajarannya dari jam berapa sampai jam berapa?
くじからじゅうじまでです。|Dari pukul sembilan sampai pukul sepuluh.`,
`じゅぎょうはくじからじゅうじまでです。|から|Pelajaran berlangsung dari pukul sembilan sampai pukul sepuluh.
やすみはじゅうじからじゅうじはんまでです。|まで|Istirahat berlangsung dari pukul sepuluh sampai pukul setengah sebelas.`);
c(5,3,'なんさいですか menanyakan umur. おいくつですか lebih halus. Jawaban: angka + さいです. Perhatikan いっさい (1), はっさい (8), じゅっさい (10), dan はたち (20). Tidak semua situasi perkenalan memerlukan pertanyaan umur; gunakan bila relevan.',
`おいくつですか。|Berapa usia Anda?
はたちです。|Dua puluh tahun.`,
`なんさいですか。|なんさい|Berapa umur Anda?
わたしははたちです。|はたち|Saya berusia dua puluh tahun.`);

c(6,0,'Pola: topik は kata sifat い です. Pertahankan い: あついです, bukan あつです atau あついだです. です membuat ucapan sopan. Pelajari kata sifat sebagai kata utuh: おいしい berarti enak, むずかしい berarti sulit.',
`このおちゃはあついですか。|Apakah teh ini panas?
はい、あついです。|Ya, panas.`);
c(6,1,'Untuk bentuk negatif, ganti い terakhir dengan くないです: たかい → たかくないです. Pengecualian penting: いい → よくないです. Jangan memakai たかいじゃありません. Rumus ini untuk kata sifat い; kata sifat な dibahas pada Bab 7.',
`このほんはたかいですか。|Apakah buku ini mahal?
いいえ、たかくないです。|Tidak, tidak mahal.`,
`きょうのてんきはよくないです。|よくないです|Cuaca hari ini tidak baik.`);
c(6,2,'Untuk menceritakan sifat pada masa lalu, ganti い terakhir dengan かったです: あつい → あつかったです. いい berubah menjadi よかったです. Gunakan penanda waktu yang jelas, misalnya きのう. Jangan memakai あついでした.',
`きのうはあつかったですか。|Apakah kemarin panas?
はい、とてもあつかったです。|Ya, sangat panas.`);
c(6,3,'Bentuk negatif lampau: buang い terakhir dari kata sifat, lalu tambah くなかったです. おいしい → おいしくなかったです. いい → よくなかったです. Bedakan くないです (tidak) dengan くなかったです (waktu itu tidak).',
`きのうはいそがしかったですか。|Apakah kemarin Anda sibuk?
いいえ、いそがしくなかったです。|Tidak, kemarin saya tidak sibuk.`);
c(6,4,'Pola: kata sifat い + kata benda. い tetap ada dan tidak disisipi な atau の: あたらしいほん = buku baru. Untuk membuat kalimat sopan, tambahkan です setelah kata bendanya: あたらしいほんです.',
`このほんはあたらしいほんですか。|Apakah buku ini buku baru?
はい、あたらしいほんです。|Ya, buku baru.`);
c(6,5,'とても berarti sangat. Letakkan sebelum kata sifat yang diterangkan: とてもあついです. とても bukan akhiran kata sifat dan tidak menggantikan です. Pada bab ini gunakan untuk menyatakan tingkat sifat, bukan seberapa sering kegiatan dilakukan.',
`このケーキはどうですか。|Bagaimana kue ini?
とてもおいしいです。|Sangat enak.`);
c(6,6,'Pada pola dasar ini, あまり + bentuk negatif berarti tidak terlalu. あまりたかくないです = tidak terlalu mahal. Untuk lampau: あまりたかくなかったです. Bedakan dengan とてもたかいです = sangat mahal. Contoh bab ini cukup memakai sifat; penghubung sebab dipelajari kemudian.',
`このりょうりはからいですか。|Apakah masakan ini pedas?
いいえ、あまりからくないです。|Tidak, tidak terlalu pedas.`);
c(6,7,'Pola: topik は どうですか. Gunakan untuk meminta pendapat atau kesan; jawab dengan sifat yang sesuai. どうでしたか menanyakan kesan tentang sesuatu yang sudah berlalu. どうですか bukan pertanyaan ya/tidak, jadi はい saja tidak cukup.',
`このりょうりはどうですか。|Bagaimana masakan ini?
おいしいです。あまりからくないです。|Enak. Tidak terlalu pedas.`);

c(7,0,'Pola: topik は kata sifat な tanpa な + です. しずかです = tenang; jangan menulis しずかなです. きれい dan きらい termasuk kata sifat な walaupun berakhir bunyi い. Bedakan dengan kata sifat い seperti あたらしい.',
`このへやはしずかですか。|Apakah ruangan ini tenang?
はい、しずかです。|Ya, tenang.`,
`このへやはしずかです。|しずかです|Ruangan ini tenang.`);
c(7,1,'Pola: kata sifat な + な + kata benda. な diperlukan sebelum kata benda: しずかなへや = ruangan yang tenang. Bandingkan へやはしずかです dengan しずかなへやです. Jangan menggunakan の untuk menyambungkan kata sifat な dengan kata bendanya.',
`これはしずかなへやですか。|Apakah ini ruangan yang tenang?
はい、しずかなへやです。|Ya, ruangan yang tenang.`,
`きれいなまちです。|きれいな|Kota yang indah.
しずかなへやです。|しずかな|Ruangan yang tenang.`);
c(7,2,'Pola negatif: kata sifat な tanpa な + じゃありません／ではありません. しずかじゃありません = tidak tenang. Jangan mengubahnya menjadi しずかくない. Jika sifat menerangkan kata benda, pertahankan な: しずかなへやじゃありません = bukan ruangan yang tenang.',
`このまちはしずかですか。|Apakah kota ini tenang?
いいえ、しずかじゃありません。|Tidak, tidak tenang.`,
`このへやはしずかじゃありません。|じゃありません|Ruangan ini tidak tenang.
あのまちはにぎやかではありません。|ではありません|Kota itu tidak ramai.`);
c(7,3,'Pola: orang は hal が すき／きらい／じょうず／へた です. すき = suka, きらい = tidak suka, じょうず = mahir, へた = kurang mahir. Kesukaan berbeda dari kemampuan: suka menyanyi belum tentu mahir. Gunakan が sebelum sifat-sifat ini; jangan menggantinya dengan を.',
`うたがすきですか。|Apakah Anda suka menyanyi?
はい、すきです。でも、あまりじょうずじゃありません。|Ya, suka. Tetapi saya tidak terlalu mahir.`,
`わたしはねこがすきです。|がすきです|Saya suka kucing.
わたしはさかながきらいです。|がきらいです|Saya tidak suka ikan.
たなかさんはうたがじょうずです。|がじょうずです|Tanaka mahir menyanyi.
わたしはりょうりがへたです。|がへたです|Saya kurang mahir memasak.`);
c(7,4,'Untuk menggabungkan sifat: kata sifat い → buang い + くて; kata sifat な → dasar + で. おいしくてやすいです = enak dan murah; しずかできれいです = tenang dan indah. Kata benda juga memakai で: がくせいで、はたちです. いい berubah menjadi よくて.',
`このへやはどうですか。|Bagaimana ruangan ini?
しずかできれいです。|Tenang dan bersih.`);
c(7,5,'Kata sifat な tanpa な + でした menyatakan sifat pada masa lalu. Negatifnya: じゃありませんでした. Contoh: しずかでした／しずかじゃありませんでした. Pola yang sama berlaku untuk kata benda. Kata sifat い tetap memakai かったです, bukan でした.',
`きのうはひまでしたか。|Apakah kemarin Anda senggang?
いいえ、ひまじゃありませんでした。|Tidak, kemarin saya tidak senggang.`,
`きのうはひまでした。|ひまでした|Kemarin saya senggang.
きのうのへやはしずかじゃありませんでした。|じゃありませんでした|Ruangan kemarin tidak tenang.`);

c(8,0,'Pola: tempat に benda/orang が あります／います. に menandai tempat; が memperkenalkan yang ada di situ. Gunakan います untuk manusia/hewan dan あります untuk benda serta tumbuhan. Kalimat ini menjawab apa/siapa yang ada di tempat itu.',
`きょうしつにせんせいがいますか。|Apakah ada guru di kelas?
はい、います。|Ya, ada.`);
c(8,1,'Pola: benda/orang は tempat に あります／います. Yang dicari sudah menjadi topik, lalu kita menjelaskan lokasinya. ほんはへやにあります menjawab bukunya di mana. Gunakan います untuk manusia/hewan, あります untuk benda/tumbuhan.',
`せんせいはどこにいますか。|Guru ada di mana?
きょうしつにいます。|Di kelas.`);
c(8,2,'ここ = tempat dekat pembicara; そこ = tempat dekat lawan bicara; あそこ = tempat jauh dari keduanya. Jika keduanya berdiri bersama, そこ dapat menunjuk tempat agak jauh dan あそこ tempat lebih jauh. Gunakan は untuk menjelaskan tempat atau に sebelum あります／います.',
`としょかんはどこですか。|Perpustakaan di mana?
あそこです。|Di sana.`,
`あそこはぎんこうです。|あそこ|Tempat di sana adalah bank.`);
c(8,3,'こちら／そちら／あちら adalah ungkapan sopan untuk tempat atau arah: sebelah sini/situ/sana. どちら menanyakan arah atau tempat dengan sopan. こちら juga bisa dipakai saat memperkenalkan seseorang; pada bab ini fokuskan pemakaiannya untuk lokasi.',
`トイレはどちらですか。|Toilet ada di sebelah mana?
あちらです。|Di sebelah sana.`,
`うけつけはこちらです。|こちら|Resepsionis ada di sebelah sini.
エレベーターはそちらです。|そちら|Lift ada di sebelah situ.`);
c(8,4,'Pola singkat untuk menyebut lokasi: topik は tempat です. トイレはにかいです = toilet di lantai dua. Dalam konteks lokasi, です di sini dipahami sebagai berada di. Bentuk yang lebih lengkap memakai tempat にあります／います; jangan menambahkan に tepat sebelum です.',
`トイレはどこですか。|Toilet di mana?
にかいです。|Di lantai dua.`,
`トイレはにかいです。|にかいです|Toilet ada di lantai dua.`);
c(8,5,'どこ menanyakan tempat. どこにほんがありますか menanyakan di mana ada buku. Jika buku tertentu sudah menjadi topik, gunakan ほんはどこにありますか. Untuk mencari seseorang, ganti あります dengan います. Jawab dengan tempat + にあります／います.',
`どこにほんがありますか。|Di mana ada buku?
あのへやにあります。|Ada di ruangan itu.`,
`どこにぎんこうがありますか。|どこに|Di mana ada bank?`);
c(8,6,'どこですか menanyakan tempat; どちらですか lebih sopan. Keduanya dapat dijawab dengan lokasi: にかいです, あそこです. Pada pelajaran ini どちら dipakai untuk lokasi. Pemakaian どちら untuk membandingkan dua pilihan dipelajari pada Bab 18.',
`うけつけはどちらですか。|Resepsionis ada di mana?
こちらです。|Di sebelah sini.`);
c(8,7,'Pola: benda patokan の posisi. つくえのうえ = di atas meja, した = bawah, まえ = depan, うしろ = belakang, となり = sebelah. Tambahkan に untuk lokasi keberadaan. Untuk di antara A dan B: A と B のあいだ. Pastikan terjemahan tetap menyebut benda/orang yang sama.',
`かばんはどこにありますか。|Tas ada di mana?
つくえのしたにあります。|Di bawah meja.`,
`ねこはつくえのしたにいます。|のした|Kucing ada di bawah meja.
ぎんこうはえきのまえにあります。|のまえ|Bank ada di depan stasiun.
くるまはいえのうしろにあります。|のうしろ|Mobil ada di belakang rumah.`);

c(9,0,'Pola: tujuan へ いきます／きます／かえります. へ dibaca e. いきます = pergi ke tempat lain; きます = datang ke tempat pembicara atau titik acuan percakapan; かえります = pulang. Ketiganya tidak dapat saling diganti tanpa mengubah sudut pandang.',
`あした、ここへきますか。|Apakah besok Anda datang ke sini?
はい、きます。|Ya, saya akan datang.`,
`ともだちはあしたここへきます。|きます|Teman saya besok datang ke sini.`);
c(9,1,'Pola: kendaraan で tujuan へ kata kerja perjalanan. で menunjukkan kendaraan, へ menunjukkan tujuan. バスでがっこうへいきます = pergi ke sekolah naik bus. Untuk berjalan kaki gunakan あるいていきます, bukan あるいてでいきます. Hindari mencampur いきます dan きます tanpa titik acuan yang jelas.',
`がっこうへバスでいきますか。|Apakah Anda pergi ke sekolah naik bus?
いいえ、でんしゃでいきます。|Tidak, saya naik kereta.`);
c(9,2,'Jika tujuan sudah jelas, kendaraan でいきます cukup untuk menjelaskan cara pergi. でんしゃで = naik kereta; バスで = naik bus. Pola ini adalah latihan lanjutan penggunaan で dari kartu sebelumnya. Berjalan kaki memakai あるいて, tanpa で.',
`えきへバスでいきますか。|Apakah Anda pergi ke stasiun naik bus?
いいえ、あるいていきます。|Tidak, saya berjalan kaki.`);
c(9,3,'Pola rute: tempat awal から tempat tujuan まで kata kerja. から = dari; まで = sampai. Bandingkan Bab 5 yang memakai dua waktu. Kedua batas harus sejenis: tempat dengan tempat untuk rute, waktu dengan waktu untuk rentang waktu.',
`うちからえきまでバスでいきますか。|Apakah Anda pergi dari rumah sampai stasiun naik bus?
はい、バスでいきます。|Ya, naik bus.`);
c(9,4,'いつ menanyakan kapan dan biasanya tanpa に. どこへ menanyakan tujuan. だれと menanyakan teman perjalanan; と berarti bersama. Jawab masing-masing dengan waktu, tempat, atau orang. Jawaban ひとりで berarti sendirian dan tidak memakai と.',
`あした、どこへいきますか。|Besok Anda pergi ke mana?
とうきょうへいきます。|Saya pergi ke Tokyo.
だれといきますか。|Pergi bersama siapa?
ともだちといきます。|Bersama teman.`,
`いつにほんへいきますか。|いつ|Kapan Anda pergi ke Jepang?`);
c(10,0,'Pola: objek を kata kerja bentuk ます. を dibaca o dan menandai objek tindakan: ほんをよみます. ます dapat menyatakan kebiasaan atau kegiatan yang akan dilakukan; bukan berarti selalu sedang. Tujuan perjalanan tetap memakai へ／に, bukan を pada pola dasar ini.',
`まいあさ、なにをのみますか。|Apa yang Anda minum setiap pagi?
コーヒーをのみます。|Saya minum kopi.`);
c(10,1,'Ganti ます dengan ません: のみます → のみません. Bentuk sopan ini menyatakan tidak melakukan kegiatan sebagai kebiasaan atau rencana. Untuk kegiatan yang tidak dilakukan pada masa lalu, gunakan ませんでした.',
`コーヒーをのみますか。|Apakah Anda minum kopi?
いいえ、のみません。|Tidak, saya tidak minum kopi.`);
c(10,2,'Ganti ます dengan ました untuk kegiatan yang terjadi pada masa lalu: よみます → よみました. Penanda seperti きのう atau けさ membantu memperjelas waktu. Jangan menambahkan でした setelah ます.',
`きのう、ほんをよみましたか。|Apakah kemarin Anda membaca buku?
はい、よみました。|Ya, saya membaca buku.`);
c(10,3,'Ganti ます dengan ませんでした untuk kegiatan yang tidak dilakukan pada masa lalu. きのう、べんきょうしませんでした = kemarin tidak belajar. Bedakan dengan べんきょうしません yang menyatakan kebiasaan atau rencana tidak belajar.',
`きのう、テレビをみましたか。|Apakah kemarin Anda menonton televisi?
いいえ、みませんでした。|Tidak, kemarin saya tidak menonton televisi.`);
c(10,4,'まいにち = setiap hari; いつも = selalu/biasanya secara konsisten; ときどき = kadang-kadang. Letakkan sebelum kegiatan. まいにち menyebut siklus hari, sedangkan いつも tidak menentukan satuan waktu. Kata-kata ini tidak memakai に.',
`まいにち、ほんをよみますか。|Apakah Anda membaca buku setiap hari?
いいえ、ときどきよみます。|Tidak, saya kadang-kadang membaca.`,
`いつもあさごはんをたべます。|いつも|Saya selalu sarapan.`);
c(10,5,'よく + kata kerja berarti sering. ぜんぜん + bentuk negatif berarti sama sekali tidak, misalnya ぜんぜんみません. Bedakan dengan あまり + negatif yang berarti tidak terlalu sering. Untuk makna dasar yang dipelajari di sini, jangan memasangkan ぜんぜん dengan bentuk positif.',
`よくテレビをみますか。|Apakah Anda sering menonton televisi?
いいえ、ぜんぜんみません。|Tidak, saya sama sekali tidak menonton televisi.`);
c(11,0,'Pola: benda を jumlah + kata bantu bilangan + kata kerja. Contoh: ほんをにさつかいます = membeli dua buku. Pilih kata bantu sesuai benda: さつ untuk buku, まい untuk benda tipis, ほん untuk benda panjang. Jangan menaruh を lagi setelah jumlah.',
`ほんをなんさつかいますか。|Berapa buku yang Anda beli?
にさつかいます。|Saya membeli dua buku.`,
`ほんをにさつかいます。|にさつ|Saya membeli dua buku.
みずをさんぼんかいます。|さんぼん|Saya membeli tiga botol air.`);
c(11,1,'Pola: benda/orang が jumlah あります／います. ほんがさんさつあります = ada tiga buku. Untuk orang gunakan にん dengan います; satu dan dua orang adalah ひとり dan ふたり. Jumlah tidak mengubah pemilihan あります versus います.',
`きょうしつにがくせいがなんにんいますか。|Ada berapa siswa di kelas?
さんにんいます。|Ada tiga orang.`);
c(11,2,'いくつ menanyakan jumlah benda dengan hitungan umum; なんにん menanyakan orang; なんまい menanyakan lembar/benda tipis. Jawaban harus memakai satuan yang cocok: ふたり, さんまい. いくつ juga dapat menanyakan umur pada konteks lain, tetapi di kartu ini dipakai untuk jumlah benda.',
`きってはなんまいありますか。|Ada berapa lembar perangko?
さんまいあります。|Ada tiga lembar.`,
`きってはなんまいありますか。|なんまい|Ada berapa lembar perangko?`);
c(11,3,'Hitungan umum 1–10: ひとつ、ふたつ、みっつ、よっつ、いつつ、むっつ、ななつ、やっつ、ここのつ、とお. Bentuk 10 tidak berakhir つ. Gunakan untuk benda yang dapat dihitung secara umum, bukan pengganti semua satuan; orang memakai ひとり／ふたり／〜にん.',
`りんごはいくつありますか。|Ada berapa buah apel?
よっつあります。|Ada empat buah.`,
`りんごがとおあります。|とお|Ada sepuluh buah apel.`);
c(12,0,'Mulai dari bentuk kamus. Golongan 1: う・つ・る → って; む・ぶ・ぬ → んで; く → いて; ぐ → いで; す → して. Contoh: かう→かって、のむ→のんで、かく→かいて、およぐ→およいで、はなす→はなして. Pengecualian: いく→いって. Perubahan mengikuti golongan kata, bukan hanya satu huruf terakhir.',
`あした、なにをしますか。|Besok Anda melakukan apa?
ほんをよんで、てがみをかきます。|Saya membaca buku, lalu menulis surat.`);
c(12,1,'Untuk golongan 2, buang る dari bentuk kamus dan tambah て: たべる→たべて、みる→みて、おきる→おきて. Tidak semua kata berakhiran いる／える termasuk golongan 2: かえる (pulang) dan はいる (masuk) adalah golongan 1. Pelajari golongan bersama kosakatanya.',
`きょうのよる、なにをしますか。|Malam ini Anda melakukan apa?
ごはんをたべて、テレビをみます。|Saya makan, lalu menonton televisi.`);
c(12,2,'Dua kata kerja golongan 3: する→して dan くる→きて. Gabungan dengan する mengikuti pola yang sama: べんきょうする→べんきょうして. Bentuk て tidak menentukan waktu sendirian; akhir kalimat menentukan apakah kegiatannya kini, mendatang, atau lampau.',
`きのう、なにをしましたか。|Kemarin Anda melakukan apa?
べんきょうして、ほんをよみました。|Saya belajar, lalu membaca buku.`,
`ともだちはうちへきて、ごはんをたべました。|きて|Teman saya datang ke rumah, lalu makan.`);
c(12,3,'Untuk urutan kegiatan, pakai bentuk て pada kata kerja sebelum yang terakhir: あさごはんをたべて、がっこうへいきます. Waktu dan kesopanan dinyatakan oleh kata kerja terakhir. Bentuk て juga memiliki fungsi lain; pelajaran ini fokus pada rangkaian tindakan.',
`けさ、なにをしましたか。|Tadi pagi Anda melakukan apa?
あさごはんをたべて、がっこうへいきました。|Saya sarapan, lalu pergi ke sekolah.`);
c(12,4,'Pola: Vてから、kegiatan berikutnya. Artinya setelah kegiatan pertama, barulah kegiatan kedua. Dibanding rangkaian て yang biasa, てから menonjolkan urutan atau prasyarat. Jangan menambah から setelah bentuk ます untuk makna setelah melakukan.',
`しゅくだいをしてから、テレビをみますか。|Apakah Anda menonton televisi setelah mengerjakan PR?
はい、しゅくだいをしてから、みます。|Ya, saya menonton setelah mengerjakan PR.`);
c(13,0,'Pola: kata kerja bentuk て + ください. Dipakai untuk meminta tindakan atau memberi instruksi: かいてください = tolong tulis. Walaupun sopan, bentuk ini dapat terdengar langsung; sesuaikan dengan hubungan dan situasi. Jangan mengganti て dengan bentuk kamus.',
`ここになまえをかいてください。|Tolong tulis nama di sini.
はい、わかりました。|Baik, saya mengerti.`);
c(13,1,'Pola: Vて + くれませんか. Meminta bantuan dengan menanyakan kesediaan lawan bicara: よんでくれませんか = bisa tolong bacakan? Bukan pertanyaan apakah seseorang tidak melakukan kegiatan. Bentuk ini tidak otomatis cocok untuk semua atasan atau situasi sangat resmi.',
`すみません、このかんじをよんでくれませんか。|Permisi, bisa tolong bacakan kanji ini?
はい。「やま」です。|Ya. Bunyinya yama.`);
c(13,2,'Pola: Vて + います. Maknanya bergantung pada kata dan konteks: いまよんでいます = sedang membaca; すんでいます = tinggal; けっこんしています = sudah menikah; まいあさはしっています = rutin berlari setiap pagi. Jangan menerjemahkan semuanya sebagai sedang.',
`いま、なにをしていますか。|Sekarang Anda sedang melakukan apa?
ほんをよんでいます。|Saya sedang membaca buku.`,
`あにはけっこんしています。|けっこんしています|Kakak laki-laki saya sudah menikah.`);
c(13,3,'Pola: Vて + もいいですか untuk meminta izin. Jawaban izin: はい、いいですよ. Gunakan untuk tindakan pembicara sendiri. Bedakan よんでもいいですか (boleh saya membaca?) dengan よんでください (tolong Anda baca).',
`このほんをよんでもいいですか。|Bolehkah saya membaca buku ini?
はい、いいですよ。|Ya, boleh.`);
c(13,4,'Pola: Vて + はいけません. Menyatakan larangan atau aturan, bukan sekadar tidak suka. Bentuk て yang berakhir で tetap dipertahankan: あそんではいけません. Bedakan larangan ini dari てもいいです yang memberi izin.',
`ここでしゃしんをとってもいいですか。|Bolehkah saya memotret di sini?
いいえ、ここではとってはいけません。|Tidak, di sini tidak boleh memotret.`);
c(14,0,'Bentuk kamus adalah bentuk dasar yang ditemukan dalam kamus. Dari bentuk ます: golongan 1 ubah bunyi i sebelum ます menjadi u (のみます→のむ); golongan 2 ganti ます dengan る (たべます→たべる); します→する、きます→くる. Dalam kalimat mandiri bentuk ini biasa digunakan dengan teman dekat, bukan otomatis sopan.',
`あした、なにをする？|Besok mau melakukan apa? (percakapan akrab)
ほんをよむ。|Membaca buku.`);
c(14,1,'Dari bentuk kamus: golongan 1, bunyi u→a + ない (のむ→のまない); akhiran う menjadi わない (かう→かわない). Golongan 2: る→ない. Golongan 3: する→しない、くる→こない. Pengecualian: ある→ない. Ini bentuk negatif biasa; versi sopannya ません.',
`あした、がっこうへいく？|Besok pergi ke sekolah? (percakapan akrab)
ううん、いかない。|Tidak, aku tidak pergi.`);
c(14,2,'Bentuk lampau biasa dibuat dari bentuk て: ganti て→た atau で→だ. かいて→かいた、のんで→のんだ、たべて→たべた、して→した、きて→きた. いく menjadi いった. Dalam percakapan sopan, bentuk lampau mandiri memakai ました.',
`きのう、ほんをよんだ？|Kemarin membaca buku? (percakapan akrab)
うん、よんだ。|Ya, aku membaca buku.`);
c(14,3,'Mulai dari bentuk ない, lalu ganti ない dengan なかった: のまない→のまなかった、たべない→たべなかった. Ini berarti tidak melakukan pada masa lalu. Bedakan dengan ない (tidak/belum dalam konteks kini atau mendatang). Versi sopannya ませんでした.',
`きのう、テレビをみた？|Kemarin menonton televisi? (percakapan akrab)
ううん、みなかった。|Tidak, aku tidak menonton.`);
c(14,4,'Pola: bentuk ない UTUH + でください. い pada ない tidak dibuang: はいる→はいらない→はいらないでください. Artinya tolong jangan melakukan. Jangan tertukar dengan なくて atau mengubahnya menjadi はいらなでください.',
`このへやにはいらないでください。|Tolong jangan masuk ke ruangan ini.
はい、わかりました。|Baik, saya mengerti.`);
c(14,5,'Pola: bentuk ない, ganti ない dengan なければなりません. いく→いかない→いかなければなりません. Artinya harus melakukan, meskipun bentuknya mengandung unsur negatif. Jangan tertukar dengan てはいけません yang berarti dilarang melakukan.',
`あした、がっこうへいかなければなりませんか。|Apakah besok harus pergi ke sekolah?
はい、いかなければなりません。|Ya, harus pergi.`);
c(14,6,'Pola: bentuk ない, ganti ない dengan なくてもいいです. はらわない→はらわなくてもいいです = tidak perlu membayar. Maknanya boleh tidak melakukan, bukan dilarang. Bentuk ini membebaskan kewajiban.',
`あしたもしゅくだいをださなければなりませんか。|Apakah besok juga harus mengumpulkan PR?
いいえ、あしたはださなくてもいいです。|Tidak, besok tidak perlu mengumpulkannya.`);

c(15,0,'Pola pesanan: benda を jumlah おねがいします. Contoh: コーヒーをふたつおねがいします. おねがいします adalah ungkapan sopan untuk meminta atau memesan. Untuk jumlah, gunakan kata bantu yang cocok. Ini bukan rumus untuk mengganti semua penggunaan ください.',
`ごちゅうもんは？|Pesan apa?
コーヒーをふたつおねがいします。|Tolong dua kopi.`);
c(15,1,'Pola: benda は いかがですか. Dalam pelayanan, dipakai untuk menawarkan atau menyarankan sesuatu: おちゃはいかがですか. Jawaban menerima: おねがいします. Jawaban menolak dengan sopan: いいえ、けっこうです. いかが juga dapat menanyakan kesan dalam konteks lain.',
`おちゃはいかがですか。|Bagaimana kalau teh?
はい、おねがいします。|Ya, boleh. Terima kasih.`);
c(15,2,'Dalam menghitung harga, jumlah + になります berarti totalnya menjadi sekian: ぜんぶでせんえんになります. Pelajari sebagai ungkapan menyampaikan hasil perhitungan. Jangan menganggap になります pengganti です yang selalu lebih sopan. Untuk menunjuk barang atau kembalian, こちらがおつりです lebih sederhana dan jelas.',
`ぜんぶでいくらですか。|Semuanya berapa?
せんえんになります。|Totalnya seribu yen.`);
c(15,3,'Pola umum: お + kata kerja bentuk ます tanpa ます + ください. まちます→おまちください = silakan tunggu. Pelajari sebagai ungkapan pelayanan yang lazim. Tidak semua kata kerja bisa diubah secara mekanis; ごりようください memakai ご, bukan お. Jangan menempelkan お pada kalimat てください.',
`こちらでおまちください。|Silakan tunggu di sini.
はい。ありがとうございます。|Baik. Terima kasih.`);
c(15,4,'Pola: pilihan + にします. Dipakai saat memutuskan pilihan, misalnya コーヒーにします = saya pilih kopi. Bandingkan になります yang menyatakan perubahan/hasil. Kata sebelum に menunjukkan pilihan yang ditetapkan, bukan tempat kegiatan.',
`コーヒーとおちゃと、どちらにしますか。|Mau pilih kopi atau teh?
おちゃにします。|Saya pilih teh.`);
c(15,5,'Untuk perubahan: kata sifat い, ganti い→く + なります; kata sifat な tanpa な atau kata benda + になります. さむくなります = menjadi dingin; しずかになります = menjadi tenang; せんせいになります = menjadi guru. いい berubah menjadi よくなります. なりました menyatakan perubahan yang sudah terjadi.',
`さむくなりましたね。|Sudah menjadi dingin, ya?
そうですね。|Ya, benar.`,
`へやがしずかになりました。|しずかになりました|Ruangan menjadi tenang.`);
c(16,0,'Gunakan に untuk waktu tertentu: jam, tanggal, bulan, tahun; nama hari juga dapat memakai に. ろくじにおきます = bangun pukul enam. Kata seperti きょう、あした、まいにち、いつ biasanya tanpa に. Jangan menyimpulkan semua keterangan waktu harus memakai に.',
`なんじにおきますか。|Anda bangun jam berapa?
ろくじにおきます。|Saya bangun jam enam.`);
c(16,1,'Bulan memakai angka + がつ: しがつ (4), しちがつ (7), くがつ (9). Tanggal 1–10: ついたち、ふつか、みっか、よっか、いつか、むいか、なのか、ようか、ここのか、とおか. Perhatikan juga じゅうよっか (14), はつか (20), にじゅうよっか (24). Untuk kegiatan pada tanggal tertentu, tambahkan に setelah tanggal.',
`たんじょうびはなんがつなんにちですか。|Ulang tahun Anda tanggal berapa?
しがつはつかです。|Tanggal 20 April.`,
`たんじょうびはしちがつはつかです。|はつか|Ulang tahun saya tanggal 20 Juli.`);
c(16,2,'なんようび menanyakan hari dalam minggu, なんがつなんにち menanyakan bulan dan tanggal, いつ menanyakan waktu secara umum. Jawaban harus sesuai jenis pertanyaan. いつ biasanya tanpa に; なんじに menanyakan jam terjadinya kegiatan.',
`しけんはいつですか。|Kapan ujiannya?
げつようびです。|Hari Senin.
なんじからですか。|Mulai jam berapa?
くじからです。|Mulai pukul sembilan.`);
c(16,3,'まいしゅう = setiap minggu; まいつき = setiap bulan; まいとし／まいねん = setiap tahun. Letakkan sebelum kegiatan dan jangan tambahkan に langsung setelah kata-kata ini. Untuk hari tertentu dalam siklus mingguan: まいしゅう、どようびに〜.',
`まいしゅう、テニスをしますか。|Apakah Anda bermain tenis setiap minggu?
はい、どようびにします。|Ya, pada hari Sabtu.`);
c(17,0,'Ulasan Bab 7: orang は hal が すき／きらいです. すき adalah kesukaan, bukan kemampuan. きらい dapat terdengar kuat; あまりすきじゃありません lebih halus untuk tidak terlalu suka. Untuk membicarakan kegemaran, sebutkan benda atau kegiatan sebagai kata benda, misalnya おんがく atau りょうり.',
`どんなたべものがすきですか。|Anda suka makanan seperti apa?
からいたべものがすきです。|Saya suka makanan pedas.`);
c(17,1,'Ulasan Bab 7: orang は hal が じょうず／へたです. Menilai tingkat kemahiran, bukan sekadar bisa atau tidak. できます pada kartu berikutnya menyatakan kemampuan. じょうず biasanya dipakai memuji orang lain; untuk diri sendiri, できます lebih netral daripada memuji diri sebagai じょうず.',
`たなかさんはりょうりがじょうずですね。|Tanaka pandai memasak, ya?
はい、とてもじょうずです。|Ya, sangat pandai.`);
c(17,2,'Pola: orang は keterampilan ができます. Pakai kata benda keterampilan, misalnya にほんご、りょうり、うんてん、ピアノ. Negatifnya できません. できます berarti mampu; じょうず berarti mahir. Jangan memasang kata kerja bentuk ます langsung sebelum ができます.',
`ピアノができますか。|Apakah Anda bisa bermain piano?
はい、すこしできます。|Ya, bisa sedikit.`);
c(17,3,'Pola: どんな + kata benda. Menanyakan jenis atau sifat: どんなほん = buku seperti apa. Jawab dengan jenis atau penjelasan, bukan hanya ya/tidak. Bedakan どのほん (buku yang mana dari pilihan yang ada) dan ほんはどうですか (bagaimana pendapat tentang buku itu).',
`どんなほんをよみますか。|Anda membaca buku seperti apa?
にほんのりょうりのほんをよみます。|Saya membaca buku masakan Jepang.`);
c(18,0,'Pola: A は B より sifat です. A memiliki sifat itu lebih daripada B; B adalah pembanding. このほんはあのほんよりたかいです = buku ini lebih mahal daripada buku itu. Kata sifat tidak perlu diubah. Pastikan terjemahan tidak membalik A dan B.',
`このほんはあのほんよりたかいですか。|Apakah buku ini lebih mahal daripada buku itu?
はい、このほんのほうがたかいです。|Ya, buku ini lebih mahal.`);
c(18,1,'Pola: A より B のほうが sifat です. Yang lebih adalah B, yaitu kata sebelum のほうが. あかいかばんよりしろいかばんのほうがやすいです = tas putih lebih murah daripada tas merah. Bila pembandingnya sudah jelas, Aより bisa tidak disebutkan.',
`あかいかばんとしろいかばんと、どちらがやすいですか。|Mana yang lebih murah, tas merah atau tas putih?
しろいかばんのほうがやすいです。|Tas putih lebih murah.`);
c(18,2,'Untuk membandingkan dua pilihan: A と B と どちらが sifat ですか. Jawaban: pilihan のほうが sifat です. Jika sama-sama disukai, jawab どちらもすきです. Pertanyaan どちら pada bab ini meminta pilihan, bukan arah/tempat seperti Bab 8.',
`コーヒーとおちゃと、どちらがすきですか。|Mana yang lebih Anda sukai, kopi atau teh?
おちゃのほうがすきです。|Saya lebih suka teh.`);
c(18,3,'Pola: kelompok のなかで pilihan が いちばん sifat です. Sebutkan batas kelompok supaya paling punya acuan, misalnya くだもののなかで. Untuk bertanya, pilih kata tanya yang sesuai: なに (apa), だれ (siapa), どこ (mana/tempat), atau どれ (pilihan yang ditunjuk).',
`くだもののなかで、なにがいちばんすきですか。|Di antara buah-buahan, apa yang paling Anda sukai?
りんごがいちばんすきです。|Saya paling suka apel.`);
c(19,0,'Dari kata kerja bentuk ます, buang ます dan tambah たいです: いきます→いきたいです. Biasanya menyatakan keinginan sendiri atau menanyakan keinginan lawan bicara. Jangan menyatakan keinginan orang ketiga sebagai fakta tanpa konteks. Objek pada pola ini dapat memakai を atau が.',
`やすみに、どこへいきたいですか。|Saat libur, Anda ingin pergi ke mana?
にほんへいきたいです。|Saya ingin pergi ke Jepang.`);
c(19,1,'Bentuk negatif keinginan: dari たいです ganti たい dengan たくないです. たべたい→たべたくないです. Bedakan たべません (tidak makan) dengan たべたくないです (tidak ingin makan). たい berubah seperti kata sifat い.',
`きょう、でかけたいですか。|Apakah hari ini Anda ingin keluar?
いいえ、でかけたくないです。|Tidak, saya tidak ingin keluar.`);
c(19,2,'Pola: benda が ほしいです. Untuk ingin memiliki/mendapat sesuatu: あたらしいかばんがほしいです. Keinginan melakukan tindakan memakai Vたいです, bukan Vほしいです. Pada pola dasar ini digunakan untuk keinginan sendiri atau pertanyaan kepada lawan bicara.',
`いま、なにがほしいですか。|Sekarang Anda menginginkan apa?
あたらしいかばんがほしいです。|Saya ingin tas baru.`);
c(19,3,'Pola: kata kerja bentuk kamus + つもりです untuk niat melakukan; bentuk ない + つもりです untuk niat tidak melakukan. いくつもりです／いかないつもりです. Fokusnya keputusan atau niat pribadi. Jangan memakai いきますつもりです.',
`あした、なにをするつもりですか。|Besok Anda berniat melakukan apa?
うちでべんきょうするつもりです。|Saya berniat belajar di rumah.`);
c(19,4,'Pola: kata kerja bentuk kamus + よていです, atau kata benda kegiatan + のよていです. Menyatakan rencana/jadwal yang sudah diatur: しけんのよていです. Bedakan dari つもり yang menekankan niat pribadi. Keduanya belum berarti kegiatan sudah dilakukan.',
`らいしゅう、せんせいとあうよていですか。|Apakah minggu depan Anda dijadwalkan bertemu guru?
はい、げつようびにあうよていです。|Ya, jadwalnya bertemu hari Senin.`);
c(19,5,'Ganti ます dengan ませんか untuk mengajak sambil menanyakan kesediaan. Ganti ます dengan ましょう untuk mengajak atau menyetujui ajakan. いっしょにたべませんか = mau makan bersama? Jawaban setuju: はい、たべましょう. Konteks membedakan ajakan ませんか dari pertanyaan negatif biasa.',
`いっしょにひるごはんをたべませんか。|Maukah Anda makan siang bersama?
いいですね。たべましょう。|Ide bagus. Ayo makan.`);
c(20,0,'Pola: kata kerja bentuk た + ことがあります. Menyatakan pernah mengalami sesuatu sebelum sekarang, tanpa harus menyebut tanggal tertentu. いったことがあります = pernah pergi. Untuk menceritakan kejadian tertentu kemarin, gunakan きのういきました. Jangan memakai bentuk kamus sebelum こと pada pola pengalaman ini.',
`にほんへいったことがありますか。|Apakah Anda pernah pergi ke Jepang?
はい、いちどあります。|Ya, pernah sekali.`);
c(20,1,'Pola: kata kerja bentuk た + ことがありません. Artinya belum pernah mengalami kegiatan itu. Kata kerjanya tetap bentuk た, bukan bentuk negatif: たべたことがありません. いちども dapat ditambahkan untuk menegaskan belum pernah sekali pun. Bedakan dengan きのうたべませんでした yang hanya menyatakan kemarin tidak makan.',
`すしをたべたことがありますか。|Apakah Anda pernah makan sushi?
いいえ、まだたべたことがありません。|Belum, saya belum pernah memakannya.`);
c(20,2,'Pola: alasan から、hasil/keputusan. から berada setelah alasan. Bentuk sopan dapat langsung dipakai: あめですから. Pada bentuk biasa, kata benda/kata sifat な memakai だ: あめだから、しずかだから. Kata kerja dan kata sifat い tidak ditambah だ: いくから、やすいから. Ini berbeda dari tempat/waktu から yang berarti dari.',
`どうして、きょうはでかけませんか。|Mengapa hari ini Anda tidak keluar?
あめですから。|Karena hujan.`);
c(20,3,'Pola: kalimat pertama が、kalimat kedua. が di sini berarti tetapi dan menghubungkan dua hal yang berlawanan. Pertahankan bentuk akhir kalimat pertama: たかいですが、べんりです. Bedakan が penghubung dengan が penanda subjek seperti ねこがいます.',
`このかばんはどうですか。|Bagaimana tas ini?
たかいですが、じょうぶです。|Mahal, tetapi kuat.`);
c(20,4,'そして menambahkan informasi (dan/juga); それから menyebut kegiatan berikutnya (setelah itu); でも menyatakan pertentangan (tetapi). Ketiganya dapat mengawali kalimat baru. そして dan それから kadang sama-sama sesuai pada urutan kegiatan, jadi pilih berdasarkan hubungan makna, bukan hafalan bahwa hanya satu selalu benar.',
`きのう、なにをしましたか。|Kemarin Anda melakukan apa?
ほんをよみました。それから、てがみをかきました。|Saya membaca buku. Setelah itu, saya menulis surat.`);

// Targeted replacements from the live DOM audit, 2026-09-27.
function edit(bab, patternIndex, change) {
  Object.assign(cards.filter(c=>c.bab===bab)[patternIndex], change);
}
// Bab 3 already uses a published learning flow. Its custom speaker token
// 山口 is intentionally mapped to Hadi in dialog_scene; it is not a name bug.
// Notes do not invalidate that flow's source fingerprint.
for (const card of cards.filter(c=>c.bab===3)) card.addExamples = [];
edit(4,1,{replaceExamples:[['その本は日本のほんですか。','そのほんはにほんごのほんですか。','の','Apakah buku itu buku bahasa Jepang?']]});
edit(4,2,{replaceDialog:true});
edit(4,3,{replaceDialog:true,meaning:'Membenarkan atau menyangkal dugaan lawan bicara.',replaceExamples:[
  ['Q: この本は日本語の本ですか？ A: いいえ、ちがいます。インドネシア語の本です。','A: このほんはにほんごのほんですか。 B: いいえ、ちがいます。インドネシアごのほんです。','ちがいます','A: Apakah buku ini buku bahasa Jepang? B: Bukan, buku bahasa Indonesia.']]});
edit(5,1,{replaceDialog:true});
edit(5,2,{replaceDialog:true});
edit(5,3,{replaceDialog:true});
edit(6,1,{meaning:'Menyatakan sifat yang tidak berlaku (bentuk negatif).'});
edit(6,2,{replaceExamples:[['きのう、たべもの、とてもおいしかったです。','きのうのりょうりはとてもおいしかったです。','おいしかったです','Masakan kemarin sangat enak.']]});
edit(6,3,{replaceExamples:[
  ['きょうの天気はよくなかったです。','きのうのてんきはよくなかったです。','よくなかったです','Cuaca kemarin tidak bagus.'],
  ['このケーキはおいしくなかったです。','このケーキはおいしくなかったです。','おいしくなかったです','Kue ini tadi tidak enak.']]});
edit(6,4,{replaceExamples:[
  ['新（あたら）しい店（みせ）です。','あたらしいみせです。','あたらしい','Ini toko baru.'],
  ['Rendangは美味（おい）しいたべものです。','レンダンはおいしいたべものです。','おいしい','Rendang adalah makanan yang enak.']]});
edit(6,6,{meaning:'Menyatakan tingkat sifat yang tidak terlalu tinggi.',replaceExamples:[
  ['この映画はあまり面白くないから、途中で寝てしまいました。','このえいがはあまりおもしろくないです。','おもしろくないです','Film ini tidak terlalu menarik.']]});
edit(6,7,{replaceDialog:true});
edit(7,0,{translateExamples:[['この部屋はきれいです。','Ruangan ini bersih.']]});
edit(7,3,{meaning:'Menyatakan kesukaan atau tingkat kemahiran.'});
edit(7,4,{meaning:'Menghubungkan sifat atau keterangan kata benda.',replaceExamples:[
  ['この店は安くて美味しいです。','このりょうりはやすくておいしいです。','やすくて','Masakan ini murah dan enak.'],
  ['Soloはしずかできれいな町（まち）です。','ソロはしずかできれいなまちです。','しずかで','Solo adalah kota yang tenang dan indah.']]});
edit(7,4,{translationReplacements:[['A: Kopinya di sini juga enak.','A: Saya juga suka kopi di sini.']]});
edit(8,0,{dialogReplacements:[['いますか。。','いますか。']]});
edit(8,2,{replaceDialog:true});
edit(8,3,{replaceDialog:true});
edit(8,4,{meaning:'Menyatakan lokasi dengan kalimat singkat.'});
edit(8,7,{replaceDialog:true,replaceExamples:[['ぎんこうは学校とスーパーのあいだにあります。','ぎんこうはがっこうとスーパーのあいだにあります。','のあいだ','Bank berada di antara sekolah dan supermarket.']]});
edit(9,0,{replaceDialog:true});
edit(9,1,{replaceDialog:true});
edit(11,0,{meaning:'Menyebut jumlah objek dalam kegiatan.'});
edit(11,1,{meaning:'Menyebut jumlah benda atau orang yang ada.'});
edit(11,3,{meaning:'Menghitung benda secara umum dari satu sampai sepuluh.'});
edit(12,2,{replaceExamples:[['学校から かえって きて、ごはんを 食べます。','ともだちはうちへきて、ごはんをたべました。','きて','Teman saya datang ke rumah, lalu makan.']]});
edit(14,1,{replaceExamples:[['あさごはんを 食べない 人も います。','あしたはあさごはんをたべない。','たべない','Besok saya tidak sarapan.']]});
edit(15,2,{replaceExamples:[['こちらが おつりに なります。','コーヒーふたつでろっぴゃくえんになります。','になります','Dua kopi totalnya enam ratus yen.']]});
edit(15,4,{dialog:'A: なににしますか。\nB: おちゃにします。',translation:'A: Mau pilih apa?\nB: Saya pilih teh.'});
edit(20,3,{replaceExamples:[['この 店は 高いですが、おいしいです。','このりょうりはたかいですが、おいしいです。','ですが','Masakan ini mahal, tetapi enak.']]});
edit(19,3,{meaning:'Menyatakan niat pribadi untuk melakukan sesuatu.'});
edit(19,4,{meaning:'Menyatakan kegiatan yang sudah direncanakan atau dijadwalkan.'});
// Keep early chapters within the taught forms; no contrast connector before Bab 20.
edit(7,3,{dialog:'A: うたがすきですか。\nB: はい、すきです。\nA: うたがじょうずですか。\nB: いいえ、あまりじょうずじゃありません。',translation:'A: Apakah Anda suka menyanyi?\nB: Ya, suka.\nA: Apakah Anda mahir menyanyi?\nB: Tidak, saya tidak terlalu mahir.'});
