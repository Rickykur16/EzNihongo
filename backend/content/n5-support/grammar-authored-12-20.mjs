// Supporting examples and tasks only. Core selectors come from the immutable plan.
// Conversation content is intentionally deferred until the user's specific directions.
export const authored = [];
function add(bab, index, examples, recognition, controlled, taskInstruction) {
  authored.push({bab, index,
    examples: examples.trim().split('\n').map(line => {
      const [japanese, highlight, indonesian] = line.split('|');
      return {japanese, highlight, indonesian};
    }),
    recognition, controlled, taskInstruction,
  });
}

add(12,0,`
名前を 書いて、本を 読みます。|書いて|Saya menulis nama, lalu membaca buku.
本を 読んで、ねます。|読んで|Saya membaca buku, lalu tidur.
学校へ 行って、べんきょうします。|行って|Saya pergi ke sekolah, lalu belajar.`,
['Bentuk て dari 読みます／読む adalah yang mana?', '読んで', '読みて', '読って'],
['Ubah 書きます menjadi bentuk て agar tindakan menulis diikuti membaca.', '名前を ＿＿＿、本を 読みます。', 'Saya menulis nama, lalu membaca buku.', '書いて', '書きて', '書んで'],
'Urutan kegiatan: membaca buku (本を 読みます), lalu tidur (ねます). Gabungkan menjadi satu kalimat dengan bentuk て dari 読みます.');

add(12,1,`
パンを 食べて、学校へ 行きます。|食べて|Saya makan roti, lalu pergi ke sekolah.
テレビを 見て、ねます。|見て|Saya menonton televisi, lalu tidur.
あさ おきて、かおを あらいます。|おきて|Saya bangun pada pagi hari, lalu mencuci muka.`,
['Bentuk て dari 食べます／食べる adalah yang mana?', '食べて', '食べって', '食べんで'],
['Ubah 見ます menjadi bentuk て untuk menghubungkan dua tindakan.', 'テレビを ＿＿＿、ねます。', 'Saya menonton televisi, lalu tidur.', '見て', '見って', '見んで'],
'Urutan kegiatan: makan (ごはんを 食べます), lalu minum teh (おちゃを 飲みます). Buat satu kalimat dengan bentuk て dari 食べます.');

add(12,2,`
べんきょうして、ねます。|して|Saya belajar, lalu tidur.
ともだちが うちへ きて、いっしょに ごはんを 食べます。|きて|Teman datang ke rumah, lalu kami makan bersama.
そうじして、本を 読みます。|して|Saya membersihkan, lalu membaca buku.`,
['Pasangan bentuk て dari します dan きます yang tepat adalah yang mana?', 'して・きて', 'しって・きって', 'すって・くて'],
['Ubah します menjadi bentuk て.', 'にほんごを べんきょう＿＿＿、ねます。', 'Saya belajar bahasa Jepang, lalu tidur.', 'して', 'しって', 'するて'],
'Teman datang ke rumah (ともだちが うちへ きます), lalu kalian belajar bersama (いっしょに べんきょうします). Hubungkan dua kegiatan dengan bentuk て dari きます.');

add(12,3,`
あさ おきて、かおを あらいます。|おきて|Saya bangun pada pagi hari, lalu mencuci muka.
ごはんを 食べて、おちゃを 飲みます。|食べて|Saya makan, lalu minum teh.
学校で べんきょうして、うちへ かえります。|べんきょうして|Saya belajar di sekolah, lalu pulang.`,
['Pada ごはんを 食べて、おちゃを 飲みます, urutan yang dinyatakan adalah apa?', 'Makan lalu minum teh.', 'Minum teh lalu makan.', 'Hanya makan; tidak minum teh.'],
['Urutannya membaca buku lalu tidur. Hubungkan kalimat dengan bentuk て.', '本を ＿＿＿、ねます。', 'Saya membaca buku, lalu tidur.', '読んで', '読みますで', '読むで'],
'Kartu urutan: bangun (おきます) → mencuci muka (かおを あらいます) → sarapan (ごはんを 食べます). Sampaikan satu kalimat berurutan menggunakan bentuk て.');

add(12,4,`
ごはんを 食べてから、本を 読みます。|食べてから|Setelah selesai makan, saya membaca buku.
うちへ かえってから、べんきょうします。|かえってから|Setelah pulang, saya belajar.
かおを あらってから、ごはんを 食べます。|あらってから|Setelah mencuci muka, saya makan.`,
['Pada 本を 読んでから、ねます, apa yang dilakukan lebih dahulu?', 'Membaca buku.', 'Tidur.', 'Membaca dan tidur bersamaan.'],
['Tegaskan bahwa makan dilakukan dahulu, baru membaca.', 'ごはんを 食べて＿＿＿、本を 読みます。', 'Setelah makan, saya membaca buku.', 'から', 'まで', 'に'],
'Anda belajar setelah tiba di rumah. Gunakan うちへ かえります dan べんきょうします untuk membuat satu kalimat dengan てから.');

add(13,0,`
ここに 名前を 書いてください。|書いてください|Silakan tulis nama di sini.
ちょっと まってください。|まってください|Tolong tunggu sebentar.
この 本を 読んでください。|読んでください|Tolong baca buku ini.`,
['Apa maksud ちょっと まってください?', 'Meminta orang menunggu sebentar.', 'Menyatakan sudah menunggu.', 'Meminta izin untuk menunggu.'],
['Anda meminta teman menulis nama. Gunakan permintaan てください.', 'ここに 名前を ＿＿＿ください。', 'Tolong tulis nama di sini.', '書いて', '書き', '書く'],
'Anda ingin teman membaca buku ini (この 本を 読みます). Buat satu permintaan sopan memakai てください.');

add(13,1,`
ちょっと まってくれませんか。|まってくれませんか|Bisakah Anda menunggu sebentar?
ここに 名前を 書いてくれませんか。|書いてくれませんか|Bisakah Anda menulis nama di sini?
この 本を 読んでくれませんか。|読んでくれませんか|Bisakah Anda membaca buku ini?`,
['Apa maksud ちょっと まってくれませんか dalam permintaan ini?', 'Meminta lawan bicara menunggu.', 'Menawarkan untuk menunggu bagi lawan bicara.', 'Menyatakan bahwa lawan bicara tidak menunggu kemarin.'],
['Lengkapi permintaan agar lawan bicara menunggu sebentar.', 'ちょっと ＿＿＿くれませんか。', 'Bisakah Anda menunggu sebentar?', 'まって', 'まつ', 'まった'],
'Anda ingin teman menulis nama di sini (ここに 名前を 書きます). Buat permintaan menggunakan てくれませんか.');

add(13,2,`
いま 本を 読んでいます。|読んでいます|Sekarang saya sedang membaca buku.
ともだちは てがみを 書いています。|書いています|Teman sedang menulis surat.
いま ごはんを 食べています。|食べています|Sekarang saya sedang makan.`,
['Pada いま 本を 読んでいます, bagaimana keadaan kegiatan membaca?', 'Sedang berlangsung sekarang.', 'Sudah selesai kemarin.', 'Belum dilakukan dan baru direncanakan besok.'],
['Anna sedang makan sekarang. Lengkapi bentuk yang sesuai.', 'いま ごはんを ＿＿＿います。', 'Sekarang sedang makan.', '食べて', '食べる', '食べた'],
'Kartu kegiatan sekarang: Anda sedang membaca buku; teman sedang menulis nama. Buat dua kalimat dengan ています untuk masing-masing orang.');

add(13,3,`
ここで 本を 読んでもいいですか。|読んでもいいですか|Bolehkah saya membaca buku di sini?
ここで ごはんを 食べてもいいですか。|食べてもいいですか|Bolehkah saya makan di sini?
しゃしんを とってもいいですか。|とってもいいですか|Bolehkah saya mengambil foto?`,
['Apa yang diminta melalui ここで 食べてもいいですか?', 'Izin untuk makan di sini.', 'Bantuan agar orang lain makan.', 'Larangan makan di sini.'],
['Anda ingin meminta izin membaca buku di sini.', 'ここで 本を 読んで＿＿＿ですか。', 'Bolehkah saya membaca buku di sini?', 'もいい', 'はいけません', 'います'],
'Anda ingin mengambil foto di tempat ini. Tanyakan izinnya memakai ここで、しゃしんを とります dan てもいいですか.');

add(13,4,`
ここで 食べてはいけません。|食べてはいけません|Dilarang makan di sini.
ここで しゃしんを とってはいけません。|とってはいけません|Dilarang mengambil foto di sini.
としょかんで おおきい こえで はなしてはいけません。|はなしてはいけません|Dilarang berbicara dengan suara keras di perpustakaan.`,
['Apa arti ここで 食べてはいけません?', 'Makan di sini dilarang.', 'Makan di sini diperbolehkan.', 'Makan di sini tidak wajib.'],
['Aturan tempat ini melarang mengambil foto. Lengkapi larangannya.', 'ここで しゃしんを とっては＿＿＿。', 'Dilarang mengambil foto di sini.', 'いけません', 'いいです', 'います'],
'Aturan perpustakaan: tidak boleh berbicara dengan suara keras (おおきい こえで はなします). Nyatakan larangan dengan てはいけません.');

add(14,0,`
あした 学校へ 行く。|行く|Besok saya pergi ke sekolah. (Bentuk biasa.)
まいあさ パンを 食べる。|食べる|Setiap pagi saya makan roti. (Bentuk biasa.)
うちで にほんごを べんきょうする。|する|Saya belajar bahasa Jepang di rumah. (Bentuk biasa.)`,
['Bentuk kamus dari 食べます adalah yang mana?', '食べる', '食べた', '食べない'],
['Gunakan bentuk kamus dari 行きます untuk rencana besok.', 'あした 学校へ ＿＿＿。', 'Besok saya pergi ke sekolah.', '行く', '行った', '行って'],
'Ubah dua kalimat ini ke bentuk biasa afirmatif: まいあさ パンを 食べます。うちで べんきょうします。Pertahankan informasinya.');

add(14,1,`
コーヒーは 飲まない。|飲まない|Saya tidak minum kopi. (Bentuk biasa.)
あしたは 学校へ 行かない。|行かない|Besok saya tidak pergi ke sekolah.
きょうは テレビを 見ない。|見ない|Hari ini saya tidak menonton televisi.`,
['Bentuk negatif biasa dari 飲みます adalah yang mana?', '飲まない', '飲みない', '飲むない'],
['Besok tidak pergi ke sekolah. Gunakan bentuk ない dari 行きます.', 'あしたは 学校へ ＿＿＿。', 'Besok saya tidak pergi ke sekolah.', '行かない', '行きない', '行くない'],
'Kartu: hari ini tidak menonton televisi (テレビを 見ます) dan tidak belajar (べんきょうします). Buat dua kalimat negatif biasa memakai ない.');

add(14,2,`
きのう 本を 読んだ。|読んだ|Kemarin saya membaca buku. (Bentuk biasa lampau.)
きのう パンを 食べた。|食べた|Kemarin saya makan roti.
きのう 学校へ 行った。|行った|Kemarin saya pergi ke sekolah.`,
['Bentuk biasa lampau dari 読みます adalah yang mana?', '読んだ', '読む', '読まない'],
['Nyatakan bahwa kegiatan makan sudah dilakukan kemarin, dengan bentuk biasa.', 'きのう パンを ＿＿＿。', 'Kemarin saya makan roti.', '食べた', '食べる', '食べない'],
'Kartu kemarin: membaca buku (本を 読みます), kemudian belajar (べんきょうします). Buat dua kalimat afirmatif lampau dalam bentuk biasa.');

add(14,3,`
きのうは 本を 読まなかった。|読まなかった|Kemarin saya tidak membaca buku.
きのうは ごはんを 食べなかった。|食べなかった|Kemarin saya tidak makan.
きのうは 学校へ 行かなかった。|行かなかった|Kemarin saya tidak pergi ke sekolah.`,
['Apa yang dinyatakan oleh きのうは 本を 読まなかった?', 'Kemarin tidak membaca buku.', 'Besok tidak membaca buku.', 'Kemarin membaca buku.'],
['Gunakan negatif lampau biasa dari 見ます.', 'きのうは テレビを ＿＿＿。', 'Kemarin saya tidak menonton televisi.', '見なかった', '見ない', '見た'],
'Kartu kemarin: tidak pergi ke sekolah dan tidak belajar. Tulis dua kalimat dengan bentuk なかった dari 行きます dan べんきょうします.');

add(14,4,`
ここで 食べないでください。|食べないでください|Tolong jangan makan di sini.
この へやに 入らないでください。|入らないでください|Tolong jangan masuk kamar ini.
ここで しゃしんを とらないでください。|とらないでください|Tolong jangan mengambil foto di sini.`,
['Apa maksud この へやに 入らないでください?', 'Meminta orang tidak masuk kamar ini.', 'Meminta orang masuk kamar ini.', 'Menyatakan tidak perlu keluar dari kamar.'],
['Anda meminta pengunjung tidak mengambil foto.', 'しゃしんを ＿＿＿ください。', 'Tolong jangan mengambil foto.', 'とらないで', 'とらなく', 'とるないで'],
'Kartu aturan: pengunjung tidak boleh masuk kamar ini (この へやに 入ります). Sampaikan permintaan negatif yang sopan memakai ないでください.');

add(14,5,`
あした 学校へ 行かなければなりません。|行かなければなりません|Besok saya harus pergi ke sekolah.
ここに 名前を 書かなければなりません。|書かなければなりません|Harus menulis nama di sini.
まいにち べんきょうしなければなりません。|しなければなりません|Harus belajar setiap hari.`,
['Pada 名前を 書かなければなりません, menulis nama bersifat bagaimana?', 'Wajib dilakukan.', 'Tidak wajib dilakukan.', 'Dilarang dilakukan.'],
['Aturan mewajibkan menulis nama. Lengkapi pola kewajiban.', '名前を 書かなければ＿＿＿。', 'Harus menulis nama.', 'なりません', 'いいです', 'ください'],
'Kartu: besok wajib pergi ke sekolah dan wajib membawa pensil (えんぴつを もって 行きます). Nyatakan kedua kewajiban memakai なければなりません.');

add(14,6,`
あしたは 学校へ 行かなくてもいいです。|行かなくてもいいです|Besok tidak perlu pergi ke sekolah.
ここに 名前を 書かなくてもいいです。|書かなくてもいいです|Tidak perlu menulis nama di sini.
じしょは もって 行かなくてもいいです。|行かなくてもいいです|Kamus tidak perlu dibawa.`,
['Apa arti じしょは もって 行かなくてもいいです?', 'Membawa kamus tidak wajib.', 'Membawa kamus dilarang.', 'Kamus wajib dibawa.'],
['Menulis nama bersifat opsional. Gunakan pola tidak perlu.', '名前を 書かなくて＿＿＿です。', 'Tidak perlu menulis nama.', 'もいい', 'はいけません', 'なりません'],
'Kartu: buku wajib dibawa, tetapi kamus tidak perlu dibawa. Buat dua kalimat yang membedakan kewajiban dan ketidakwajiban dengan もって 行きます.');

add(15,0,`
コーヒーを 一つ おねがいします。|一つ おねがいします|Tolong satu kopi.
おちゃを 二つ おねがいします。|二つ おねがいします|Tolong dua teh.
この 本を 一さつ おねがいします。|一さつ おねがいします|Tolong satu buku ini.`,
['Pada コーヒーを 二つ おねがいします, apa pesanan pelanggan?', 'Dua kopi.', 'Satu kopi.', 'Dua teh.'],
['Anda memesan satu kopi. Pilih ungkapan pelanggan.', 'コーヒーを 一つ ＿＿＿。', 'Tolong satu kopi.', 'おねがいします', 'いかがですか', 'おまちください'],
'Menu: コーヒー dan おちゃ. Pesan dua kopi dan satu teh memakai penghitung serta おねがいします.');

add(15,1,`
コーヒーは いかがですか。|いかがですか|Bagaimana kalau kopi? (Pelayan menawarkan minuman.)
おちゃは いかがですか。|いかがですか|Bagaimana kalau teh? (Menawarkan minuman kepada tamu.)
この かばんは いかがですか。|いかがですか|Bagaimana dengan tas ini? (Penjual menawarkan tas.)`,
['Seorang pelayan mengatakan おちゃは いかがですか kepada tamu. Apa maksudnya?', 'Menawarkan teh kepada tamu.', 'Memesan teh untuk dirinya.', 'Meminta tamu membayar teh.'],
['Anda pelayan yang menawarkan kopi kepada pelanggan.', 'コーヒーは ＿＿＿。', 'Bagaimana kalau kopi?', 'いかがですか', 'おねがいします', 'にします'],
'Anda pelayan yang menawarkan teh (おちゃ) kepada pelanggan. Tulis satu tawaran dengan はいかがですか.');

add(15,2,`
ごうけいで 五百円に なります。|五百円に なります|Totalnya 500 yen. (Petugas menyampaikan total pembayaran.)
ごうけいで 八百円に なります。|八百円に なります|Totalnya 800 yen. (Petugas menyampaikan total pembayaran.)
ごうけいで 千円に なります。|千円に なります|Totalnya 1.000 yen. (Petugas menyampaikan total pembayaran.)`,
['Kasir mengatakan ごうけいで 八百円に なります. Berapa total pembayaran?', '800 yen.', '1000 yen.', '500 yen.'],
['Petugas menyampaikan total 500 yen dengan pola になります.', 'ごうけいで 五百円＿＿＿なります。', 'Totalnya 500 yen.', 'に', 'を', 'で'],
'Kartu kasir: buku 500円 dan buku catatan 300円; total 800円. Nyatakan total pembayaran memakai ごうけいで…になります.');

add(15,3,`
すこし おまちください。|おまちください|Silakan tunggu sebentar.
どうぞ お入りください。|お入りください|Silakan masuk.
ここで おまちください。|おまちください|Silakan tunggu di sini.`,
['Bagian まち pada おまちください berasal dari bentuk apa?', 'Batang ます dari まちます.', 'Bentuk て, yaitu まって.', 'Bentuk kamus, yaitu まつ.'],
['Petugas meminta pelanggan menunggu dengan お〜ください.', 'すこし お＿＿＿ください。', 'Silakan tunggu sebentar.', 'まち', 'まって', 'まつ'],
'Anda petugas yang mempersilakan tamu masuk. Gunakan 入ります dan pola お〜ください untuk membuat satu kalimat.');

add(15,4,`
わたしは おちゃに します。|おちゃに します|Saya memilih teh.
この かばんに します。|この かばんに します|Saya memilih tas ini.
コーヒーを 二つに します。|二つに します|Saya memilih dua kopi. (Memutuskan jumlah pesanan.)`,
['Di kedai, pelanggan mengatakan おちゃに します. Apa yang ia lakukan?', 'Memilih teh untuk pesanannya.', 'Menawarkan teh kepada pelayan.', 'Menyatakan teh berubah menjadi kopi.'],
['Anda memilih teh dari menu kopi dan teh.', 'わたしは おちゃ＿＿＿します。', 'Saya memilih teh.', 'に', 'を', 'と'],
'Pilihan: tas putih (白い かばん) atau tas hitam (くろい かばん). Anda memutuskan tas putih. Nyatakan pilihan memakai にします.');

add(15,5,`
きょうは あたたかく なりました。|あたたかく なりました|Hari ini sudah menjadi lebih hangat. (Sebelumnya dingin.)
この へやは きれいに なりました。|きれいに なりました|Kamar ini menjadi bersih. (Sebelumnya kotor.)
せんせいに なりました。|せんせいに なりました|Saya menjadi guru. (Sebelumnya bukan guru.)`,
['Pasangan bentuk perubahan dari あたたかい dan きれい yang tepat adalah yang mana?', 'あたたかく なります・きれいに なります', 'あたたかいに なります・きれいく なります', 'あたたかな なります・きれいで なります'],
['Sebelumnya kamar kotor; sekarang sudah bersih. Gunakan pola perubahan.', 'へやが きれい＿＿＿なりました。', 'Kamar menjadi bersih.', 'に', 'く', 'で'],
'Kartu perubahan: kemarin dingin, sekarang hangat (あたたかい); kamar sebelumnya kotor, sekarang bersih (きれい). Buat dua kalimat perubahan yang membedakan く dan に.');

add(16,0,`
げつようびに 学校へ 行きます。|げつようびに|Saya pergi ke sekolah pada hari Senin.
午前 九時に おきます。|九時に|Saya bangun pukul sembilan pagi.
三月 三日に ともだちに 会います。|三月 三日に|Saya bertemu teman pada tanggal 3 Maret.`,
['Pada げつようびに 学校へ 行きます, に setelah げつようび menandai apa?', 'Waktu tertentu untuk kegiatan.', 'Alat transportasi.', 'Tempat kegiatan.'],
['Kegiatannya dimulai tepat pukul sembilan. Lengkapi penanda waktu.', '午前 九時＿＿＿べんきょうします。', 'Saya belajar pada pukul sembilan pagi.', 'に', 'で', 'を'],
'Kartu jadwal: Senin pergi ke sekolah; bangun pukul 06.00. Buat dua kalimat yang memakai に untuk waktu tertentu.');

add(16,1,`
たんじょうびは 三月 三日です。|三月 三日|Ulang tahun saya tanggal 3 Maret.
テストは 四月 八日です。|四月 八日|Tesnya tanggal 8 April.
クラスは 九月 二十日です。|九月 二十日|Kelasnya tanggal 20 September.`,
['Tanggal 三月 三日 dibaca bagaimana?', 'さんがつ みっか', 'さんがつ さんにち', 'みつき みっか'],
['Tuliskan bacaan tanggal 8 April. Bagian bulan sudah tersedia.', 'しがつ ＿＿＿', 'Tanggal 8 April.', 'ようか', 'はちじ', 'はっさい'],
'Kartu: ulang tahun 3 Maret; tes 8 April. Buat dua kalimat tanggal. Tulis kana untuk bacaan tanggal yang belum lancar.');

add(16,2,`
クラスは なんようびですか。|なんようび|Kelasnya hari apa?
たんじょうびは 何月 何日ですか。|何月 何日|Ulang tahun Anda tanggal dan bulan berapa?
いつ 日本へ 行きますか。|いつ|Kapan Anda pergi ke Jepang?`,
['Anda membutuhkan nama hari dalam seminggu. Pertanyaan mana yang sesuai?', 'クラスは なんようびですか。', 'クラスは 何時ですか。', 'クラスは いくらですか。'],
['Anda menanyakan hari kelas. Jawabannya adalah hari Sabtu.', 'クラスは ＿＿＿ですか。', 'Kelasnya hari apa?', 'なんようび', '何時', 'いくら'],
'Tulis tiga pertanyaan berbeda: hari kelas, tanggal ulang tahun, dan kapan teman pergi ke Jepang. Gunakan なんようび、何月何日、いつ sesuai informasi yang diminta.');

add(16,3,`
毎週 どようびに べんきょうします。|毎週|Saya belajar setiap hari Sabtu.
毎月 三日に ともだちに 会います。|毎月|Saya bertemu teman setiap tanggal tiga setiap bulan.
毎年 三月に 日本へ 行きます。|毎年|Saya pergi ke Jepang setiap bulan Maret tiap tahun.`,
['Pada 毎月 三日に クラスが あります, seberapa sering kelas itu berlangsung?', 'Setiap bulan, pada tanggal tiga.', 'Setiap tiga hari.', 'Hanya pada 3 Maret.'],
['Kartu jadwal: ada kelas pada hari Sabtu setiap minggu. Lengkapi penanda frekuensi.', 'クラスは ＿＿＿ どようびに あります。', 'Kelas ada setiap hari Sabtu.', '毎週', 'なんようび', '何時'],
'Kartu rutin: belajar setiap Sabtu; bertemu teman setiap tanggal tiga; pergi ke Jepang setiap Maret. Buat tiga kalimat dengan 毎週、毎月、毎年.');

add(17,0,`
わたしは 日本語が すきです。|が すきです|Saya suka bahasa Jepang.
父は コーヒーが きらいです。|が きらいです|Ayah saya tidak suka kopi.
母も 日本語が すきです。|も 日本語が すきです|Ibu saya juga suka bahasa Jepang. (Saya sudah mengatakan bahwa saya suka bahasa Jepang.)`,
['Apa yang dinyatakan oleh 日本語が すきです?', 'Menyukai bahasa Jepang.', 'Pasti mahir berbahasa Jepang.', 'Tidak dapat berbahasa Jepang.'],
['Nyatakan bahwa Anda menyukai tenis. Lengkapi partikel pola kesukaan.', 'わたしは テニス＿＿＿すきです。', 'Saya suka tenis.', 'が', 'を', 'で'],
'Kartu diri: suka musik (おんがく), tidak suka kopi. Buat dua kalimat memakai すきです dan きらいです.');

add(17,1,`
母は ピアノが 上手です。|が 上手です|Ibu saya mahir bermain piano.
わたしは りょうりが 下手です。|が 下手です|Saya kurang mahir memasak.
父は 日本語が あまり 上手じゃありません。|上手じゃありません|Ayah saya belum begitu mahir berbahasa Jepang.`,
['Apa perbedaan 日本語がすきです dan 日本語が上手です?', 'Yang pertama kesukaan; yang kedua kemahiran.', 'Keduanya selalu berarti mahir.', 'Yang pertama kemampuan; yang kedua harga.'],
['Kartu: ibu mahir bermain piano. Lengkapi penilaian sesuai kartu.', '母は ピアノが ＿＿＿です。', 'Ibu saya mahir bermain piano.', '上手', '下手', 'きらい'],
'Kartu: ibu mahir bermain piano; Anda belum begitu mahir memasak. Buat dua kalimat kemahiran. Gunakan あまり…上手じゃありません untuk kalimat kedua.');

add(17,2,`
わたしは テニスが できます。|が できます|Saya bisa bermain tenis.
父は りょうりが できます。|が できます|Ayah saya bisa memasak.
わたしは ピアノが できません。|が できません|Saya tidak bisa bermain piano.`,
['Pada ピアノが できます, informasi apa yang diberikan?', 'Bisa bermain piano.', 'Pasti suka bermain piano.', 'Pasti sangat mahir bermain piano.'],
['Kartu: Anda bisa bermain tenis. Lengkapi partikel pola kemampuan.', 'わたしは テニス＿＿＿できます。', 'Saya bisa bermain tenis.', 'が', 'を', 'へ'],
'Kartu: Anda bisa bermain tenis, tetapi tidak bisa bermain piano. Buat dua kalimat kemampuan dengan できます dan できません.');

add(17,3,`
どんな スポーツが すきですか。|どんな スポーツ|Olahraga seperti apa yang Anda sukai?
どんな おんがくが すきですか。|どんな おんがく|Musik seperti apa yang Anda sukai?
どんな 本を 読みますか。|どんな 本|Buku seperti apa yang Anda baca?`,
['Jawaban yang menyebut jenis olahraga untuk どんなスポーツがすきですか adalah yang mana?', 'テニスです。', '学校で します。', '毎週 します。'],
['Anda menanyakan jenis musik, bukan tempat atau waktunya.', '＿＿＿ おんがくが すきですか。', 'Musik seperti apa yang Anda sukai?', 'どんな', 'どこ', 'いつ'],
'Tanyakan jenis olahraga yang disukai teman dengan どんな. Lalu tulis satu jawaban yang menyebut jenis olahraga, misalnya テニス.');

add(18,0,`
この かばんは あの かばんより 安いです。|より 安いです|Tas ini lebih murah daripada tas itu. (Tas ini 800 yen; tas itu 1.000 yen.)
この 本は あの 本より 大きいです。|より 大きいです|Buku ini lebih besar daripada buku itu. (Bandingkan ukurannya.)
電車は バスより はやいです。|より はやいです|Kereta lebih cepat daripada bus. (Pada perjalanan yang sama: kereta 20 menit; bus 40 menit.)`,
['Pada AはBより安いです, barang mana yang lebih murah?', 'A.', 'B.', 'Keduanya sama murah.'],
['Tas ini 800 yen; tas itu 1.000 yen. Lengkapi perbandingan harga.', 'この かばんは あの かばんより ＿＿＿です。', 'Tas ini lebih murah daripada tas itu.', '安い', '高い', 'おもい'],
'Kartu: tas putih 600円, tas hitam 800円. Nyatakan tas mana yang lebih murah dengan AはBより…です.');

add(18,1,`
あの かばんより この かばんの ほうが 安いです。|の ほうが 安いです|Dibanding tas itu, tas ini lebih murah. (Tas ini 800 yen; tas itu 1.000 yen.)
この 本より あの 本の ほうが 大きいです。|の ほうが 大きいです|Dibanding buku ini, buku itu lebih besar.
バスより 電車の ほうが はやいです。|の ほうが はやいです|Dibanding bus, kereta lebih cepat. (Untuk perjalanan yang sama: bus 40 menit; kereta 20 menit.)`,
['Pada AよりBのほうが安いです, barang mana yang lebih murah?', 'B.', 'A.', 'Keduanya sama murah.'],
['Tas putih 600 yen dan tas hitam 800 yen. Lengkapi perbandingannya.', 'くろい かばんより 白い かばん＿＿＿ほうが 安いです。', 'Tas putih lebih murah daripada tas hitam.', 'の', 'を', 'に'],
'Kartu: kereta memerlukan 20分 dan bus 40分 untuk perjalanan yang sama. Nyatakan kendaraan yang lebih cepat dengan AよりBのほうが…です.');

add(18,2,`
この かばんと あの かばんと、どちらが 安いですか。|どちらが 安いですか|Mana yang lebih murah, tas ini atau tas itu?
電車と バスと、どちらが はやいですか。|どちらが はやいですか|Mana yang lebih cepat, kereta atau bus?
この 本と あの 本と、どちらが 大きいですか。|どちらが 大きいですか|Mana yang lebih besar, buku ini atau buku itu?`,
['Anda membandingkan harga dua tas. Pertanyaan mana yang sesuai?', 'どちらが 安いですか。', 'いつ 安いですか。', 'だれが 安いですか。'],
['Bandingkan harga dua pilihan, A dan B.', 'Aと Bと、＿＿＿が 安いですか。', 'Mana yang lebih murah, A atau B?', 'どちら', 'どこ', 'だれ'],
'Kartu: tas putih 600円, tas hitam 800円. Tulis satu pertanyaan perbandingan dengan どちらが dan satu jawaban yang sesuai harganya.');

add(18,3,`
三つの かばんの 中で、白い かばんが いちばん 安いです。|いちばん 安いです|Di antara tiga tas, tas putih paling murah. (Putih 600 yen; hitam 800 yen; merah 1.000 yen.)
この 三つの 本の 中で、この 本が いちばん 大きいです。|いちばん 大きいです|Di antara ketiga buku ini, buku ini paling besar.
三つの かばんの 中で、白い かばんが いちばん かるいです。|いちばん かるいです|Di antara tiga tas, tas putih paling ringan. (Putih 1 kg; merah 2 kg; hitam 3 kg.)`,
['Tas putih 600 yen, hitam 800 yen, merah 1.000 yen. Mana yang いちばん安い?', 'Tas putih.', 'Tas hitam.', 'Tas merah.'],
['Tas putih 1 kg, merah 2 kg, hitam 3 kg. Nyatakan yang paling ringan dari ketiganya.', '三つの 中で、白い かばんが ＿＿＿かるいです。', 'Di antara ketiganya, tas putih paling ringan.', 'いちばん', '毎週', 'ときどき'],
'Kartu tiga tas: putih 600円、hitam 800円、merah 1000円. Buat kalimat dengan の中で…がいちばん untuk menyebut tas paling murah.');

add(19,0,`
日本へ 行きたいです。|行きたいです|Saya ingin pergi ke Jepang.
この 本を 読みたいです。|読みたいです|Saya ingin membaca buku ini.
おちゃを 飲みたいです。|飲みたいです|Saya ingin minum teh.`,
['Pada 本を読みたいです, apa yang disampaikan?', 'Keinginan membaca buku.', 'Kewajiban membaca buku.', 'Pengalaman membaca yang sudah selesai.'],
['Nyatakan keinginan pergi ke Jepang dengan たいです.', '日本へ ＿＿＿たいです。', 'Saya ingin pergi ke Jepang.', '行き', '行く', '行って'],
'Kartu keinginan: membaca buku ini dan minum teh. Buat dua kalimat memakai たいです.');

add(19,1,`
きょうは コーヒーを 飲みたくないです。|飲みたくないです|Hari ini saya tidak ingin minum kopi.
いまは 何も 食べたくないです。|食べたくないです|Sekarang saya tidak ingin makan apa pun.
きょうは 外へ 行きたくないです。|行きたくないです|Hari ini saya tidak ingin keluar.`,
['Apa perbedaan 飲みたくないです dan 飲んではいけません?', 'Yang pertama tidak ingin; yang kedua larangan.', 'Keduanya selalu berarti dilarang.', 'Yang pertama larangan; yang kedua izin.'],
['Anda tidak ingin minum kopi sekarang. Lengkapi bentuk keinginan negatif.', 'いまは コーヒーを 飲み＿＿＿です。', 'Sekarang saya tidak ingin minum kopi.', 'たくない', 'たい', 'たかった'],
'Kartu: hari ini tidak ingin keluar dan tidak ingin minum kopi. Buat dua kalimat dengan たくないです, bukan kalimat larangan.');

add(19,2,`
新しい かばんが ほしいです。|が ほしいです|Saya ingin tas baru.
日本語の 本が ほしいです。|が ほしいです|Saya ingin buku bahasa Jepang.
いま 水が ほしいです。|が ほしいです|Sekarang saya ingin air.`,
['Mana yang menyatakan keinginan memiliki benda, bukan melakukan kegiatan?', '新しい かばんが ほしいです。', '日本へ 行きたいです。', '本を 読みたいです。'],
['Anda ingin tas baru. Lengkapi penanda benda yang diinginkan.', '新しい かばん＿＿＿ほしいです。', 'Saya ingin tas baru.', 'が', 'を', 'で'],
'Kartu: Anda ingin sebuah kamus bahasa Jepang (日本語の じしょ). Nyatakan keinginan terhadap benda dengan がほしいです.');

add(19,3,`
あした 学校へ 行く つもりです。|行く つもりです|Saya berniat pergi ke sekolah besok.
あした 友だちに 会う つもりです。|会う つもりです|Saya berniat bertemu teman besok.
きょうは テレビを 見ない つもりです。|見ない つもりです|Hari ini saya berniat tidak menonton televisi.`,
['Apa maksud きょうはテレビを見ないつもりです?', 'Berniat tidak menonton televisi hari ini.', 'Dilarang menonton televisi hari ini.', 'Tidak bisa menonton karena tidak ada televisi.'],
['Anda berniat pergi ke sekolah besok. Gunakan bentuk sebelum つもり.', 'あした 学校へ ＿＿＿つもりです。', 'Saya berniat pergi ke sekolah besok.', '行く', '行き', '行って'],
'Kartu niat: besok bertemu teman; malam ini tidak menonton televisi. Tulis dua kalimat dengan つもりです memakai bentuk afirmatif dan negatif.');

add(19,4,`
らいしゅう 日本へ 行く よていです。|行く よていです|Saya berencana pergi ke Jepang minggu depan.
あした 午後 二時に 友だちに 会う よていです。|会う よていです|Saya berencana bertemu teman besok pukul dua siang.
どようびは 学校で べんきょうする よていです。|する よていです|Saya berencana belajar di sekolah pada hari Sabtu.`,
['Pada あした午後二時に会うよていです, kapan pertemuannya direncanakan?', 'Besok pukul dua siang.', 'Kemarin pukul dua siang.', 'Setiap pagi pukul dua.'],
['Lengkapi rencana pergi ke Jepang minggu depan dengan よていです.', 'らいしゅう 日本へ ＿＿＿よていです。', 'Saya berencana pergi ke Jepang minggu depan.', '行く', '行き', '行って'],
'Kartu rencana: Sabtu pukul 10.00 bertemu teman di stasiun. Buat satu kalimat lengkap dengan waktu, tempat, kegiatan, dan よていです.');

add(19,5,`
いっしょに おちゃを 飲みませんか。|飲みませんか|Maukah Anda minum teh bersama?
いっしょに えいがを 見ましょう。|見ましょう|Mari menonton film bersama.
午後 二時に 駅で 会いましょう。|会いましょう|Mari bertemu di stasiun pukul dua siang.`,
['Apa fungsi いっしょにおちゃを飲みませんか dalam situasi mengajak teman?', 'Mengajak minum teh bersama.', 'Melarang teman minum teh.', 'Menceritakan tidak minum teh kemarin.'],
['Anda menerima ajakan minum teh bersama. Lengkapi responsnya.', 'いいですね。いっしょに ＿＿＿。', 'Ide bagus. Mari minum bersama.', '飲みましょう', '飲みました', '飲みませんでした'],
'Tulis satu ajakan menonton film bersama dengan ませんか. Lalu tulis satu respons menerima ajakan dengan ましょう.');

add(20,0,`
日本へ 行ったことが あります。|行ったことが あります|Saya pernah pergi ke Jepang.
すしを 食べたことが あります。|食べたことが あります|Saya pernah makan sushi.
この 本を 読んだことが あります。|読んだことが あります|Saya pernah membaca buku ini.`,
['Apa maksud 日本へ行ったことがあります?', 'Pernah pergi ke Jepang setidaknya sekali.', 'Sedang berada di Jepang sekarang.', 'Pasti akan pergi ke Jepang besok.'],
['Anda pernah makan sushi. Gunakan bentuk pengalaman.', 'すしを ＿＿＿ことが あります。', 'Saya pernah makan sushi.', '食べた', '食べる', '食べて'],
'Kartu pengalaman: pernah ke Jepang dan pernah makan sushi. Nyatakan dua pengalaman dengan たことがあります tanpa menambah frekuensi yang tidak ada pada kartu.');

add(20,1,`
日本へ 行ったことが ありません。|行ったことが ありません|Saya belum pernah pergi ke Jepang.
なっとうを 食べたことが ありません。|食べたことが ありません|Saya belum pernah makan natto.
この 本を 読んだことが ありません。|読んだことが ありません|Saya belum pernah membaca buku ini.`,
['Apa arti この本を読んだことがありません?', 'Belum pernah membaca buku ini.', 'Tidak membaca buku ini hanya pada hari kemarin.', 'Tidak ingin membaca buku ini.'],
['Kartu: belum pernah pergi ke Jepang. Lengkapi pengalaman negatif.', '日本へ 行ったことが ＿＿＿。', 'Saya belum pernah pergi ke Jepang.', 'ありません', 'あります', 'います'],
'Kartu: pernah makan sushi, belum pernah makan natto. Buat dua kalimat pengalaman yang membedakan あります dan ありません.');

add(20,2,`
雨ですから、こうえんへ 行きません。|ですから|Karena hujan, saya tidak pergi ke taman.
きょうは 休みですから、うちに います。|ですから|Karena hari ini libur, saya berada di rumah.
この かばんは 安いですから、買います。|ですから|Karena tas ini murah, saya membelinya.`,
['Pada 雨ですから、こうえんへ行きません, apa alasannya?', 'Hujan.', 'Tidak pergi ke taman.', 'Harga tas murah.'],
['Hujan menjadi alasan tidak pergi ke taman. Lengkapi penghubung sebab.', '雨です＿＿＿、こうえんへ 行きません。', 'Karena hujan, saya tidak pergi ke taman.', 'から', 'まで', 'より'],
'Kartu: hari ini hujan; Anda tidak pergi ke taman. Gabungkan sebab dan tindakan dengan から, meletakkan sebab sebelum から.');

add(20,3,`
この かばんは 高いですが、べんりです。|ですが|Tas ini mahal, tetapi praktis.
日本語は むずかしいですが、おもしろいです。|ですが|Bahasa Jepang sulit, tetapi menarik.
この へやは 小さいですが、きれいです。|ですが|Kamar ini kecil, tetapi bersih.`,
['Pada このかばんは高いですが、べんりです, fungsi が adalah apa?', 'Menghubungkan dua penilaian yang dikontraskan.', 'Menandai tas sebagai objek kegiatan membeli.', 'Menandai akhir rentang harga.'],
['Hubungkan kekurangan harga mahal dengan kelebihan praktis menggunakan が.', 'この かばんは 高いです＿＿＿、べんりです。', 'Tas ini mahal, tetapi praktis.', 'が', 'を', 'に'],
'Kartu kamar: ukurannya kecil, tetapi bersih. Buat satu kalimat yang menghubungkan dua penilaian tersebut dengan が.');

add(20,4,`
この へやは しずかです。そして、きれいです。|そして|Kamar ini tenang. Selain itu, bersih.
ごはんを 食べました。それから、本を 読みました。|それから|Saya makan. Setelah itu, saya membaca buku.
コーヒーが すきです。でも、きょうは 飲みたくないです。|でも|Saya suka kopi. Tetapi hari ini saya tidak ingin meminumnya.`,
['Penghubung mana yang secara jelas menyatakan tindakan berikutnya setelah tindakan pertama?', 'それから', 'でも', 'それまで'],
['Urutannya makan, kemudian membaca. Pilih penghubung untuk tindakan berikutnya.', 'ごはんを 食べました。＿＿＿、本を 読みました。', 'Saya makan. Setelah itu, saya membaca buku.', 'それから', 'それまで', 'そこから'],
'Buat tiga pasangan kalimat: kamar tenang dan bersih (そして); makan lalu membaca (それから); suka kopi tetapi hari ini tidak ingin minum (でも). Pertahankan fungsi penghubung masing-masing.');
