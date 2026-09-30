// Supporting material only: immutable grammar IDs select the existing Canva curriculum.
// No core pattern, meaning, lesson membership, ordering, or conversation is authored here.
export const items = [];
function optionsAt(answer, others, index) {
  const options = [...others];
  options.splice(index % 3, 0, answer);
  return options;
}
function add(chapter, id, notes, lines, recognition, controlled, taskInstruction) {
  const [rp, rj, ri, ra, ...ro] = recognition;
  const [cp, sentence, indonesian, ca, ...co] = controlled;
  const index = items.length;
  items.push({ id, chapter, notes,
    examples: lines.trim().split('\n').map(line => {
      const [japanese, highlight, indonesian] = line.split('|');
      return { japanese, highlight, indonesian };
    }),
    recognition: { prompt: rp, example: { japanese: rj, indonesian: ri }, options: optionsAt(ra, ro, index * 2), answer: ra },
    controlled: { prompt: cp, sentence, indonesian, options: optionsAt(ca, co, index * 2 + 1), answer: ca },
    taskInstruction
  });
}

// BAB 1 — penjelas benda dan nominalisasi.
add(1, '3b41a238-b4f1-4327-a8e9-de69cdfbc804',
  'Letakkan klausa penjelas bentuk biasa tepat sebelum benda: 母がつくった + りょうり. Pelaku di dalam penjelasan memakai が. Bentuk た, ない, dan ている dari N5 dapat dipakai; jangan menambahkan です／ます sebelum benda. Klausa luar tetap boleh sopan. えらぶ = memilih.', `
これは 母が つくった りょうりです。|母が つくった りょうり|Ini masakan yang dibuat ibu saya.
つかわない ものを はこに いれました。|つかわない もの|Saya memasukkan barang yang tidak dipakai ke dalam kotak.
あそこで 本を よんでいる ひとは あねです。|本を よんでいる ひと|Orang yang sedang membaca buku di sana adalah kakak perempuan saya.`,
  ['Siapa yang memilih buku, dan kepada siapa buku itu ditunjukkan?', 'わたしが えらんだ 本を 友だちに みせました。', 'Saya memperlihatkan buku yang saya pilih kepada teman.', 'Saya yang memilih; teman yang melihat buku itu.', 'Teman yang memilih; saya yang melihat buku itu.', 'Ibu yang memilih; teman yang melihat buku itu.'],
  ['Ibu membuat kue ini kemarin. Lengkapi bagian yang menerangkan kue.', 'これは 母が きのう ＿＿＿ ケーキです。', 'Ini kue yang dibuat ibu kemarin.', 'つくった', 'つくりました', 'つくります'],
  'Kartu foto: kakak laki-laki sedang membaca koran di sana. Tulis satu kalimat yang mengidentifikasi orang itu dengan klausa しんぶんをよんでいる + ひと. Gunakan あに untuk kakak Anda.');

add(1, 'eded72e5-8a76-4a04-8264-436f976f1a2d',
  'の membuat kegiatan dapat menempati posisi kata benda. Gunakan Vるのがすき／じょうず untuk kesukaan atau kemahiran; Vるのは〜 untuk memberi penilaian. Pada すき, kegiatan ditandai が, bukan を. Kalimat dapat berakhir です agar sopan.', `
わたしは しゃしんを とるのが すきです。|とるのが すきです|Saya suka memotret.
あねは 日本語で はなすのが じょうずです。|はなすのが じょうずです|Kakak perempuan saya pandai berbicara dalam bahasa Jepang.
友だちと りょうりを つくるのは たのしいです。|つくるのは たのしいです|Membuat masakan bersama teman itu menyenangkan.`,
  ['Apa yang dinilai menyenangkan dalam kalimat ini?', '友だちと りょうりを つくるのは たのしいです。', 'Membuat masakan bersama teman itu menyenangkan.', 'Kegiatan memasak bersama teman.', 'Teman yang sedang diperkenalkan.', 'Harga masakan yang dibeli.'],
  ['Ubah kegiatan mengambil foto menjadi hal yang disukai.', 'しゃしんを とる＿＿＿ すきです。', 'Saya suka memotret.', 'のが', 'を', 'に'],
  'Profil: Anda suka membaca novel, tetapi kurang pandai berenang. Tulis dua kalimat dengan Vるのがすき dan Vるのがあまりじょうずじゃありません. Gunakan しょうせつ (novel), よむ, およぐ.');

add(1, '6abc2710-0e56-41d0-b8a7-e6cab423aa2a',
  'Untuk menjelaskan isi hobi, gunakan しゅみは + V bentuk kamus + ことです. こと menominalkan kegiatan; kata kerja tidak memakai ます di posisi ini. しゅみ = hobi; あつめる = mengumpulkan.', `
わたしの しゅみは 本を よむことです。|よむことです|Hobi saya membaca buku.
父の しゅみは しゃしんを とることです。|とることです|Hobi ayah saya memotret.
あねの しゅみは きってを あつめることです。|あつめることです|Hobi kakak perempuan saya mengumpulkan perangko.`,
  ['Kegiatan apa yang merupakan hobi kakak?', 'あねの しゅみは きってを あつめることです。', 'Hobi kakak perempuan saya mengumpulkan perangko.', 'Mengumpulkan perangko.', 'Membeli kamera.', 'Membaca novel.'],
  ['Isi hobi Anda adalah membaca novel. Lengkapi kalimat dengan bentuk yang tepat.', 'わたしの しゅみは しょうせつを ＿＿＿ことです。', 'Hobi saya membaca novel.', 'よむ', 'よみます', 'よみました'],
  'Kartu profil: ayah gemar memotret, Anda gemar berenang. Tulis dua kalimat yang menjelaskan isi masing-masing hobi dengan しゅみは〜ことです.');

add(1, '54af13ff-97ed-4a59-a7af-5e899e581881',
  'Pilih sesuai konstruksi: Vるのがすき, しゅみはVることです. Untuk melihat atau mendengar langsung suatu kejadian, gunakan V bentuk biasa + のをみる／きく. 子どもがうたうのをききました berarti mendengar anak bernyanyi secara langsung; berbeda dari mendapat kabar tentang kejadian.', `
わたしは えを かくのが すきです。|かくのが|Saya suka menggambar.
しゅみは えを かくことです。|かくことです|Hobi saya menggambar.
こうえんで 子どもが うたうのを ききました。|うたうのを ききました|Saya mendengar anak bernyanyi di taman.`,
  ['Informasi apa yang diperoleh langsung melalui pendengaran?', 'こうえんで 子どもが うたうのを ききました。', 'Saya mendengar anak bernyanyi di taman.', 'Suara anak bernyanyi.', 'Kabar bahwa anak akan pindah.', 'Penjelasan tentang hobi anak.'],
  ['Anda menyaksikan langsung burung terbang. Lengkapi nominalisasinya.', 'とりが とぶ＿＿＿を みました。', 'Saya melihat burung terbang. とり = burung; とぶ = terbang.', 'の', 'こと', 'もの'],
  'Anda menyaksikan adik laki-laki berenang. Tulis satu kalimat memakai おとうとが およぐ + のをみました. Lalu tulis satu kalimat tentang hobi berenang Anda dengan しゅみは〜ことです.');

add(1, 'ebf36f26-ec73-4a27-a8f3-cd7186f674c0',
  'Jika benda sudah jelas, の dapat menggantikan nama benda: あかいかばん→あかいの. Sifat い tetap utuh; sifat な memerlukan な: しずかなの. Sebutkan konteks bendanya dahulu supaya pendengar tahu yang dimaksud.', `
かばんは あかいのを かいました。|あかいの|Untuk tas, saya membeli yang merah.
へやは しずかなのが いいです。|しずかなの|Untuk kamar, saya ingin yang tenang.
この ふたつの はこでは、ちいさいのを つかいます。|ちいさいの|Dari dua kotak ini, saya memakai yang kecil.`,
  ['Apa yang digantikan の dalam situasi memilih kamar ini?', 'へやは しずかなのが いいです。', 'Untuk kamar, saya ingin yang tenang.', 'Kamar yang tenang.', 'Orang yang pendiam.', 'Suara yang tenang.'],
  ['Anda sedang memilih tas dan menginginkan yang merah. Nama tas sudah jelas.', 'あかい＿＿＿を ください。', 'Tolong yang merah.', 'の', 'なの', 'こと'],
  'Dua kamar ditawarkan: satu ramai dan satu tenang. Jawab dengan satu kalimat bahwa Anda ingin yang tenang, tanpa mengulang kata へや; gunakan しずかなの.');

// BAB 2 — penjelasan, pendapat, dan kutipan.
add(2, 'fedee2bc-5852-4576-a9e5-a764b6a38859',
  'Jembatan bentuk biasa: N／sifat な: 学生だ・学生じゃない・学生だった・学生じゃなかった; しずかだ mengikuti pola sama. Sifat い: たかい・たかくない・たかかった・たかくなかった. Sebelum んです, だ afirmatif nonlampau menjadi な: 学生なんです. Bentuk lain tetap: 学生だったんです. Gunakan んです ketika memberi penjelasan yang berkaitan dengan keadaan/pertanyaan, bukan pada setiap pernyataan.', `
きょうは はやく かえります。あした しけんが あるんです。|あるんです|Hari ini saya pulang lebih awal. Soalnya besok ada ujian.
この 本を さがしています。日本語の 学生なんです。|学生なんです|Saya sedang mencari buku ini. Soalnya saya pelajar bahasa Jepang.
きのうは きませんでした。びょうきだったんです。|びょうきだったんです|Kemarin saya tidak datang. Soalnya saya sedang sakit waktu itu.`,
  ['Mengapa pembicara menggunakan んです pada kalimat kedua?', 'きょうは はやく かえります。あした しけんが あるんです。', 'Hari ini saya pulang lebih awal. Soalnya besok ada ujian.', 'Menjelaskan alasan pulang lebih awal.', 'Mengajak pendengar mengikuti ujian.', 'Membantah bahwa besok ada ujian.'],
  ['Jelaskan bahwa Anda adalah pelajar sekarang. 学生 adalah kata benda.', '学生＿＿＿。', 'Soalnya saya pelajar.', 'なんです', 'だんです', 'いんです'],
  'Situasi: teman heran mengapa Anda pulang lebih awal hari ini. Besok Anda ada ujian. Tulis dua kalimat: sebutkan pulang lebih awal, lalu beri penjelasan dengan んです.');

add(2, '86615a65-a342-4cc0-a5cf-b441cdab27ec',
  'んですが memberikan latar sebelum pertanyaan/permintaan; んだけど lebih akrab. Sesudah kata benda/sifat な afirmatif kini, gunakan なんですが: 学生なんですが. Jika maksud sudah dipahami, ucapan dapat berhenti pada んですが, tetapi latihan ini tetap menyebut permintaan secara jelas.', `
この ことばが わからないんですが、せつめいして ください。|わからないんですが|Saya tidak mengerti kata ini; bisa tolong jelaskan?
本を さがしているんですが、どこに ありますか。|さがしているんですが|Saya sedang mencari buku; ada di mana?
あしたは ひまなんだけど、いっしょに えいがを みませんか。|ひまなんだけど|Besok saya senggang; mau menonton film bersama?`,
  ['Apa hubungan bagian sebelum んですが dengan permintaan setelahnya?', 'この ことばが わからないんですが、せつめいして ください。', 'Saya tidak mengerti kata ini; bisa tolong jelaskan?', 'Ketidakpahaman menjadi latar meminta penjelasan.', 'Kata tersebut sudah sepenuhnya dipahami.', 'Pembicara melarang orang lain menjelaskan.'],
  ['Sampaikan keadaan mencari buku sebagai pembuka pertanyaan kepada petugas.', '本を さがしている＿＿＿、どこに ありますか。', 'Saya sedang mencari buku; ada di mana?', 'んですが', 'なんですが', 'だんですが'],
  'Anda tidak mengerti arti sebuah kata, ことばのいみ. Tulis satu permintaan kepada teman: buka dengan わからないんですが dan minta ia menjelaskan memakai せつめいしてください.');

add(2, 'a60c9112-86e9-4e45-bbc1-bcbe9ebf7873',
  'Pendapat ditandai とおもいます; とおもっています dapat menunjukkan pemikiran yang dipegang. Sebelum と gunakan bentuk biasa. N／sifat な afirmatif nonlampau memerlukan だ: べんりだとおもいます. Lampau dan negatif tidak ditambah だ: べんりだった／べんりじゃないとおもいます. Sifat い langsung: おもしろいとおもいます.', `
この しょうせつは おもしろいと おもいます。|おもしろいと おもいます|Menurut saya novel ini menarik.
この じしょは べんりだと おもいます。|べんりだと おもいます|Menurut saya kamus ini praktis.
かぞくとの 時間は たいせつだと おもっています。|たいせつだと おもっています|Saya berpendapat bahwa waktu bersama keluarga itu penting.`,
  ['Bagaimana pembicara menilai kamus?', 'この じしょは べんりだと おもいます。', 'Menurut saya kamus ini praktis.', 'Praktis menurut pendapatnya.', 'Tidak praktis menurut pendapatnya.', 'Kamus itu milik keluarganya.'],
  ['Lengkapi pendapat bahwa kamar ini tenang. しずか adalah sifat な.', 'この へやは しずか＿＿＿ おもいます。', 'Menurut saya kamar ini tenang.', 'だと', 'なと', 'ですと'],
  'Kartu ulasan: novel menarik, kamus praktis. Tulis dua pendapat memakai とおもいます; perhatikan perbedaan おもしろい dan べんり.');

add(2, '5e647985-8e3e-4c00-983c-34d3ad897283',
  'と menandai isi kutipan. Kutipan langsung boleh mempertahankan ucapan sopan di dalam 「」; laporan isi umumnya memakai bentuk biasa, termasuk Nだ. といっていました melaporkan perkataan sebelumnya; とききました melaporkan informasi yang didengar. って adalah penanda kutipan akrab. いま/あした dalam laporan harus sesuai sudut waktu pembicaraan.', `
先生は「あしたは やすみです」と いいました。|と いいました|Guru berkata, “Besok libur.”
友だちは 日本へ いくと いっていました。|と いっていました|Teman saya mengatakan bahwa ia akan pergi ke Jepang.
この みせは やすいと ききました。|と ききました|Saya mendengar bahwa toko ini murah.`,
  ['Apa yang disampaikan sebagai informasi dari orang lain?', 'この みせは やすいと ききました。', 'Saya mendengar bahwa toko ini murah.', 'Toko ini murah.', 'Pembicara sudah membeli toko ini.', 'Teman akan pergi ke Jepang.'],
  ['Laporkan ucapan guru secara langsung. Kata-kata di dalam tanda kutip tetap dipertahankan.', '先生は「本を よんでください」＿＿＿ いいました。', 'Guru berkata, “Silakan baca buku.”', 'と', 'を', 'に'],
  'Pesan teman hari ini: 「あした、学校へいきます」. Laporkan isinya kepada orang lain pada hari yang sama dengan といっていました; ubah いきます menjadi bentuk biasa.');

add(2, 'c96b9275-405d-4311-8e4a-195b54a0f2fa',
  'Nama + という + jenis benda/orang memperkenalkan sebutan: さくらというみせ = toko bernama Sakura. Setelah という tetap diperlukan kata benda. Ini penamaan, bukan pernyataan bahwa orang yang bernama itu sedang berbicara.', `
さくらという みせで ごはんを たべました。|さくらという みせ|Saya makan di toko makan bernama Sakura.
レンという 学生を しっています。|レンという 学生|Saya mengenal pelajar bernama Ren.
『はる』という 本を よんでいます。|『はる』という 本|Saya sedang membaca buku berjudul Haru.`,
  ['Apa fungsi という pada kalimat ini?', 'レンという 学生を しっています。', 'Saya mengenal pelajar bernama Ren.', 'Menjelaskan nama pelajar.', 'Mengutip perkataan pelajar.', 'Menyatakan hobi pelajar.'],
  ['Perkenalkan nama toko: Sakura.', 'さくら＿＿＿ みせです。', 'Ini toko bernama Sakura.', 'という', 'といった', 'とおもう'],
  'Anda baru membaca buku berjudul あおいそら. Tulis satu kalimat yang menyebut judul dan jenis benda dengan という本 lalu menyatakan sudah membacanya.');

add(2, '559a6627-fa7e-49f9-8b70-1edb9824993f',
  'かな menunjukkan pertanyaan kepada diri sendiri. Gunakan bentuk biasa: くるかな／くるのかな. Pada N／sifat な afirmatif kini: 学生かな atau 学生なのかな; jangan 学生だかな. Untuk bertanya sopan langsung kepada petugas, gunakan ですか／ますか. あいている = buka/tersedia dalam konteks toko.', `
あしたは あめかな。|あめかな|Besok hujan, ya? (Bertanya-tanya sendiri.)
この 本は おもしろいかな。|おもしろいかな|Buku ini menarik atau tidak, ya?
レンさんは もう かえったのかな。|かえったのかな|Ren sudah pulang atau belum, ya?`,
  ['Apa sikap pembicara dalam kalimat ini?', 'レンさんは もう かえったのかな。', 'Ren sudah pulang atau belum, ya?', 'Ia bertanya-tanya apakah Ren sudah pulang.', 'Ia menyuruh Ren pulang.', 'Ia memastikan Ren belum pernah pulang.'],
  ['Anda bertanya-tanya sendiri apakah besok libur. やすみ adalah kata benda.', 'あしたは やすみ＿＿＿。', 'Besok libur atau tidak, ya?', 'なのかな', 'だのかな', 'なだかな'],
  'Anda belum tahu apakah buku baru itu menarik. Tulis satu gumaman memakai おもしろいかな. Lalu buat pertanyaan sopan tentang buku yang sama dengan どうですか untuk penjual.');

// BAB 3 — hubungan waktu dan kegiatan.
add(3, '95cd10ea-b201-4c44-83de-1b7aeff42c07',
  'Vるとき melihat kegiatan sebelum selesai; Vたとき melihatnya sudah terjadi, relatif terhadap peristiwa utama, bukan sekadar waktu kini/lampau. 日本へいくとき = saat hendak pergi; 日本へいったとき = saat/sesudah pergi di sana. Sifat な memakai な, kata benda memakai の. 子どものとき = ketika masih anak-anak.', `
日本へ いくとき、かばんを かいました。|いくとき|Ketika hendak pergi ke Jepang, saya membeli tas.
日本へ いったとき、きものを かいました。|いったとき|Ketika berada di Jepang dalam kunjungan saya, saya membeli kimono.
子どものとき、よく こうえんで あそびました。|子どものとき|Ketika masih anak-anak, saya sering bermain di taman.`,
  ['Kapan tas dibeli dibanding perjalanan ke Jepang?', '日本へ いくとき、かばんを かいました。', 'Ketika hendak pergi ke Jepang, saya membeli tas.', 'Sebelum berangkat, sebagai bagian persiapan perjalanan.', 'Setelah pulang dari Jepang.', 'Setiap hari selama tinggal di Jepang.'],
  ['Gunakan kata benda 子ども untuk menyebut masa kanak-kanak.', '子ども＿＿＿とき、よく およぎました。', 'Ketika masih anak-anak, saya sering berenang.', 'の', 'な', 'だ'],
  'Dua kartu waktu: sebelum pergi ke Jepang Anda membeli tas; saat berkunjung di Jepang Anda membeli kimono. Tulis dua kalimat memakai いくとき dan いったとき dengan tepat.');

add(3, '209d208b-c857-42a0-a43f-7bed2024bec8',
  'Sebelum kegiatan: Vるまえに; sesudah kegiatan: Vたあとで. Bentuk sebelum まえに tetap kamus meskipun seluruh peristiwa terjadi kemarin. Kata benda: しごとのまえに／しごとのあとで. てから yang sudah dipelajari juga menunjukkan urutan, sering menekankan langkah pertama sebagai syarat.', `
ねるまえに、本を よみます。|ねるまえに|Saya membaca buku sebelum tidur.
ごはんを たべたあとで、さんぽしました。|たべたあとで|Saya berjalan-jalan setelah makan.
きのう、しごとのまえに コーヒーを のみました。|しごとのまえに|Kemarin saya minum kopi sebelum bekerja.`,
  ['Kegiatan mana yang terjadi lebih dahulu?', 'ごはんを たべたあとで、さんぽしました。', 'Saya berjalan-jalan setelah makan.', 'Makan.', 'Berjalan-jalan.', 'Keduanya selalu bersamaan.'],
  ['Nyatakan membaca buku sebelum tidur, walaupun kebiasaan ini terjadi dulu.', '子どものとき、＿＿＿まえに 本を よみました。', 'Ketika kecil, saya membaca buku sebelum tidur.', 'ねる', 'ねた', 'ねます'],
  'Jadwal kemarin: minum kopi → bekerja → berjalan-jalan. Tulis satu kalimat dengan しごとのまえに dan satu dengan しごとのあとで.');

add(3, '21fcd6c6-85c3-4a47-bf9d-64ffab9c8381',
  'あいだ menggambarkan kegiatan/keadaan sepanjang rentang; あいだに menempatkan suatu kejadian di dalam rentang itu. Contoh rentang dengan verba: ねているあいだ; dengan kata benda: やすみのあいだ. Pilih berdasarkan lamanya kegiatan yang ingin ditekankan.', `
でんしゃに のっているあいだ、ずっと 本を よんでいました。|のっているあいだ|Saya terus membaca buku sepanjang naik kereta.
わたしが ねているあいだに、友だちが きました。|ねているあいだに|Teman datang ketika saya sedang tidur.
ひるやすみのあいだに、ぎんこうへ いきました。|ひるやすみのあいだに|Saya pergi ke bank pada waktu istirahat siang.`,
  ['Apakah teman datang terus-menerus sepanjang waktu tidur?', 'わたしが ねているあいだに、友だちが きました。', 'Teman datang ketika saya sedang tidur.', 'Tidak; kedatangannya terjadi pada suatu saat dalam rentang tidur.', 'Ya; ia datang tanpa berhenti sepanjang rentang itu.', 'Tidak; kedatangannya harus sesudah saya bangun.'],
  ['Tekankan bahwa Anda membaca terus sepanjang perjalanan kereta, dari awal sampai akhir.', 'でんしゃに のっている＿＿＿、ずっと 本を よんでいました。', 'Saya terus membaca sepanjang perjalanan kereta.', 'あいだ', 'まえに', 'あとで'],
  'Situasi: Anda membaca sepanjang perjalanan kereta; ketika Anda tidur di rumah, teman datang sekali. Buat dua kalimat dengan あいだ dan あいだに untuk membedakan rentang dan kejadian.');

add(3, '78882d31-0895-4833-889d-a23c1c07171d',
  'まで menandai kegiatan yang berlanjut sampai batas; までに menandai tenggat penyelesaian. 5じまでまちます = menunggu sampai pukul lima; 5じまでにきてください = datang paling lambat pukul lima. Untuk batas berupa peristiwa, gunakan Vる: バスがくるまで.', `
ごじまで ここで まちます。|ごじまで|Saya menunggu di sini sampai pukul lima.
ごじまでに ここへ きてください。|ごじまでに|Silakan datang ke sini paling lambat pukul lima.
バスが くるまで、本を よみます。|くるまで|Saya membaca buku sampai bus datang.`,
  ['Apa arti batas pukul lima pada instruksi ini?', 'ごじまでに ここへ きてください。', 'Silakan datang ke sini paling lambat pukul lima.', 'Kedatangan harus paling lambat pukul lima.', 'Mulai menunggu tepat pukul lima.', 'Datang hanya setelah pukul lima.'],
  ['Anda harus menyelesaikan laporan paling lambat hari Jumat. Pilih penanda tenggat.', 'きんようび＿＿＿ レポートを かいてください。', 'Silakan selesaikan penulisan laporan paling lambat Jumat.', 'までに', 'から', 'のあいだ'],
  'Kartu: perpustakaan buka sampai pukul 6; buku harus dikembalikan paling lambat Jumat. Tulis dua kalimat dengan まで dan までに. Gunakan あいています (buka) dan かえしてください (tolong kembalikan).');

add(3, '773ded4a-7972-4a97-a07c-0b940908c219',
  'Bentuk た + り, lalu する di akhir: よんだり、かいたりします. Daftar ini memberi beberapa contoh kegiatan, tidak harus lengkap atau berurutan. Waktu kalimat ditandai します／しました pada bagian terakhir. Perubahan て→た dan で→だ mengikuti N5.', `
やすみのひは、本を よんだり、おんがくを きいたりします。|よんだり、おんがくを きいたりします|Pada hari libur, saya melakukan kegiatan seperti membaca buku dan mendengarkan musik.
きのうは、へやを そうじしたり、せんたくしたりしました。|そうじしたり、せんたくしたりしました|Kemarin saya melakukan kegiatan seperti membersihkan kamar dan mencuci pakaian.
りょこうで、しゃしんを とったり、おみやげを かったりしました。|とったり、おみやげを かったりしました|Dalam perjalanan, saya antara lain memotret dan membeli oleh-oleh.`,
  ['Apa yang ditekankan oleh たり dalam kalimat ini?', 'やすみのひは、本を よんだり、おんがくを きいたりします。', 'Pada hari libur, saya melakukan kegiatan seperti membaca buku dan mendengarkan musik.', 'Beberapa contoh kegiatan hari libur.', 'Urutan wajib: selesai membaca baru mendengarkan.', 'Larangan melakukan kegiatan selain membaca.'],
  ['Buat daftar contoh kegiatan kemarin: membaca dan menulis.', 'きのうは、本を ＿＿＿、にっきを かいたりしました。', 'Kemarin saya antara lain membaca buku dan menulis buku harian.', 'よんだり', 'よみたり', 'よむたり'],
  'Ceritakan hari Minggu lalu dengan dua contoh kegiatan, membersihkan kamar dan menonton film. Gunakan 〜たり、〜たりしました; tidak perlu menyatakan urutannya.');

add(3, 'c48ba199-7125-44ac-aa1f-d3e7cf426b2e',
  'Buang ます lalu tambah ながら: ききます→ききながら. Dua kegiatan dilakukan pelaku yang sama; kegiatan utama berada sesudah ながら. Ini berbeda dari てから yang menyatakan urutan.', `
おんがくを ききながら、りょうりを つくります。|ききながら|Saya memasak sambil mendengarkan musik.
ちずを みながら、あるきました。|みながら|Saya berjalan sambil melihat peta.
友だちと はなしながら、ごはんを たべました。|はなしながら|Saya makan sambil berbincang dengan teman.`,
  ['Kegiatan mana yang menjadi kegiatan utama dan siapa pelakunya?', 'おんがくを ききながら、りょうりを つくります。', 'Saya memasak sambil mendengarkan musik.', 'Memasak; saya juga yang mendengarkan musik.', 'Mendengarkan; orang lain yang memasak.', 'Memasak; musik baru didengarkan sesudahnya.'],
  ['Lengkapi bentuk ながら dari みます untuk melihat peta sambil berjalan.', 'ちずを ＿＿＿、あるきます。', 'Saya berjalan sambil melihat peta.', 'みながら', 'みるながら', 'みてながら'],
  'Anda sendiri membaca buku sambil mendengarkan musik. Buat satu kalimat ながら dengan membaca sebagai kegiatan utama. Gunakan きく dan よむ.');

add(3, '51e2a621-f323-4a92-b859-ea769d636a9a',
  'Pertahankan bentuk ない lalu tambah で: たべないで. Pola ini berarti melakukan B tanpa melakukan A. Bedakan たべないででかけました (pergi tanpa makan) dari たべないでください (permintaan agar tidak makan). でかける = pergi keluar.', `
あさごはんを たべないで、学校へ いきました。|たべないで|Saya pergi ke sekolah tanpa sarapan.
じしょを つかわないで、この 本を よみました。|つかわないで|Saya membaca buku ini tanpa memakai kamus.
きのうは テレビを みないで、ねました。|みないで|Kemarin saya tidur tanpa menonton televisi.`,
  ['Apa yang tidak dilakukan sebelum pergi ke sekolah?', 'あさごはんを たべないで、学校へ いきました。', 'Saya pergi ke sekolah tanpa sarapan.', 'Sarapan.', 'Pergi ke sekolah.', 'Membaca kamus.'],
  ['Sampaikan bahwa Anda membaca tanpa memakai kamus.', 'じしょを ＿＿＿、本を よみました。', 'Saya membaca buku tanpa memakai kamus.', 'つかわないで', 'つかったあとで', 'つかいながら'],
  'Kemarin malam Anda tidak menonton televisi dan langsung tidur. Tulis satu kalimat ないで yang menyampaikan kegiatan yang dilewati dan kegiatan yang dilakukan.');

// BAB 4 — kemampuan dan persepsi.
add(4, '820d48d1-48a8-47c9-b259-800de763b9c7',
  'Potensial: G1 akhir u→e＋る: よむ→よめる、かく→かける、かう→かえる. G2: たべる→たべられる. Khusus: する→できる、くる→こられる. Semua hasil ini berubah seperti verba G2: よめない、よめた、よめなかった. Objek dapat memakai が atau を sesuai konstruksi; jangan membuat soal yang menganggap hanya salah satunya selalu benar.', `
わたしは この 本が よめます。|よめます|Saya bisa membaca buku ini.
きのうは 学校へ こられませんでした。|こられませんでした|Kemarin saya tidak bisa datang ke sekolah.
あねは 車を うんてんできます。|うんてんできます|Kakak perempuan saya bisa mengemudi mobil.`,
  ['Apa yang dinyatakan tentang kemampuan kakak?', 'あねは 車を うんてんできます。', 'Kakak perempuan saya bisa mengemudi mobil.', 'Ia bisa mengemudi mobil.', 'Ia ingin membeli mobil.', 'Ia sedang mencuci mobil.'],
  ['Ubah よむ menjadi bentuk potensial sopan untuk mengatakan dapat membaca.', 'この 本が ＿＿＿。', 'Saya bisa membaca buku ini.', 'よめます', 'よみます', 'よみたいです'],
  'Kartu kemampuan: Anda bisa membaca bahasa Jepang tetapi tidak bisa mengemudi. Tulis dua kalimat bentuk potensial sopan, positif dan negatif, memakai よむ dan うんてんする.');

add(4, '9cbb1147-a95b-474c-8cef-388471c78075',
  'V bentuk kamus + ことができる menyatakan kemampuan atau kemungkinan yang tersedia. Bagian sebelum こと tetap kamus: およぐことができます, bukan およぎますこと. Konteks membedakan keahlian orang dan fasilitas/aturan tempat; misalnya memotret di museum hanya bila diperbolehkan.', `
わたしは 日本語で てがみを かくことができます。|かくことができます|Saya bisa menulis surat dalam bahasa Jepang.
この としょかんでは、パソコンを つかうことができます。|つかうことができます|Di perpustakaan ini, kita dapat memakai komputer.
あの びじゅつかんでは、しゃしんを とることができません。|とることができません|Di museum seni itu, kita tidak dapat memotret. (Peraturannya melarang foto.)`,
  ['Kemungkinan apa yang tersedia bagi pengguna perpustakaan?', 'この としょかんでは、パソコンを つかうことができます。', 'Di perpustakaan ini, kita dapat memakai komputer.', 'Menggunakan komputer.', 'Membeli komputer.', 'Membawa semua buku pulang tanpa meminjam.'],
  ['Lengkapi pernyataan kemampuan berenang dengan bentuk sebelum こと.', 'わたしは ＿＿＿ことができます。', 'Saya bisa berenang.', 'およぐ', 'およぎます', 'およいで'],
  'Kartu fasilitas perpustakaan: komputer boleh dipakai; foto tidak diperbolehkan. Tulis dua penjelasan dengan ことができます dan ことができません. Gunakan つかう dan しゃしんをとる.');

add(4, 'a71867c0-a1f5-45ec-bd43-9594fa317e20',
  'みえる／きこえる menyatakan sesuatu tertangkap indra; みられる／きける menyoroti kemampuan, kesempatan, atau akses. 山がみえます = gunung tampak; このえいががみられます = ada kesempatan/akses menonton film ini. Beri konteks indra atau akses sebelum memilih bentuk.', `
この へやから 山が みえます。|みえます|Gunung terlihat dari kamar ini.
となりの へやから こえが きこえます。|きこえます|Suara orang terdengar dari kamar sebelah.
この サイトで 日本の えいがが みられます。|みられます|Kita dapat menonton film Jepang melalui situs ini.`,
  ['Apakah きこえます di sini terutama menyatakan akses ke rekaman?', 'となりの へやから こえが きこえます。', 'Suara orang terdengar dari kamar sebelah.', 'Tidak; suara tertangkap oleh pendengaran.', 'Ya; rekaman sedang dijual.', 'Ya; pembicara meminta izin merekam.'],
  ['Anda melihat gunung dari jendela tanpa mencari video. Pilih pernyataan tentang apa yang tampak.', 'まどから 山が ＿＿＿。', 'Gunung terlihat dari jendela.', 'みえます', 'きこえます', 'きけます'],
  'Kartu kamar: dari jendela gunung terlihat; dari kamar sebelah musik terdengar. Tulis dua kalimat dengan みえます dan きこえます.');

add(4, '34f79daf-5e22-43ce-9cf3-d1910b789609',
  'Nがする dipakai untuk sensasi: おと／こえ／におい／あじ. Di sini する bukan berarti melakukan suatu kegiatan dengan sengaja. おと adalah bunyi, こえ suara makhluk, におい aroma, あじ rasa. Untuk penglihatan gunakan みえる, bukan bentuk ini.', `
となりの へやから ピアノの おとがします。|おとがします|Terdengar bunyi piano dari kamar sebelah.
この おちゃは いい においがします。|においがします|Teh ini beraroma harum.
この あめは レモンの あじがします。|あじがします|Permen ini terasa seperti lemon. (あめ di sini berarti permen.)`,
  ['Indra mana yang menjadi fokus kalimat ini?', 'この おちゃは いい においがします。', 'Teh ini beraroma harum.', 'Penciuman.', 'Pendengaran.', 'Penglihatan.'],
  ['Anda mengecap permen dan merasakan lemon. Lengkapi kata sensasinya.', 'この あめは レモンの ＿＿＿がします。', 'Permen ini terasa seperti lemon.', 'あじ', 'こえ', 'おと'],
  'Anda mendengar piano dari kamar sebelah dan mencium aroma kopi. Buat dua kalimat menggunakan おとがします dan においがします.');

// BAB 5 — niat, keputusan, kebiasaan.
add(5, '6a20afd1-7455-47fe-9518-ed99e6b659cd',
  'Tabel volisional: G1 かう→かおう、いく→いこう、はなす→はなそう、まつ→まとう、のむ→のもう、よぶ→よぼう、しぬ→しのう、とる→とろう、およぐ→およごう. G2 たべる→たべよう、みる→みよう. Khusus する→しよう、くる→こよう. Untuk niat pribadi tambahkan とおもいます／とおもっています. いっしょにいこう adalah ajakan akrab; いこうとおもっています menjelaskan niat pembicara.', `
来年、日本へ いこうと おもっています。|いこうと おもっています|Saya berniat pergi ke Jepang tahun depan.
こんやは はやく ねようと おもいます。|ねようと おもいます|Saya pikir akan tidur lebih awal malam ini.
休みのひに へやを そうじしようと おもっています。|そうじしようと おもっています|Saya berniat membersihkan kamar pada hari libur.`,
  ['Niat apa yang disampaikan, dan apakah sudah terjadi?', '来年、日本へ いこうと おもっています。', 'Saya berniat pergi ke Jepang tahun depan.', 'Pergi ke Jepang tahun depan; masih berupa niat.', 'Sudah pergi ke Jepang tahun lalu.', 'Memerintahkan teman pergi besok.'],
  ['Bentuk niat dari ねる untuk rencana malam ini.', 'こんやは はやく ＿＿＿と おもいます。', 'Saya pikir akan tidur lebih awal malam ini.', 'ねよう', 'ねろう', 'ねるよう'],
  'Rencana pribadi: tahun depan pergi ke Jepang dan mulai belajar setiap pagi. Tulis dua niat dengan いこうとおもっています dan べんきょうしようとおもっています.');

add(5, '05736360-eb7e-41ef-92cc-fa14ae95a7c6',
  'ことにする menonjolkan keputusan yang ditetapkan pembicara; ことになる menonjolkan keputusan/keadaan yang sudah ditentukan. Ini perbedaan sudut pandang, bukan aturan bahwa ことになる selalu berarti dipaksa. Gunakan Vる／Vない: いくことにしました、いかないことになりました.', `
わたしは 来年 日本へ いくことにしました。|いくことにしました|Saya memutuskan untuk pergi ke Jepang tahun depan.
こんやは コーヒーを のまないことにしました。|のまないことにしました|Saya memutuskan untuk tidak minum kopi malam ini.
学校の りょこうは 来月に いくことになりました。|いくことになりました|Telah diputuskan bahwa perjalanan sekolah dilakukan bulan depan.`,
  ['Bagian mana yang menonjolkan keputusan pribadi pembicara?', 'こんやは コーヒーを のまないことにしました。', 'Saya memutuskan untuk tidak minum kopi malam ini.', 'Pembicara memilih tidak minum kopi malam ini.', 'Sekolah melarang semua orang minum kopi.', 'Pembicara sudah tidak mampu minum.'],
  ['Anda sendiri baru memutuskan memilih kereta. Tekankan keputusan pribadi itu.', 'わたしは 電車で いくことに＿＿＿。', 'Saya memutuskan untuk pergi dengan kereta.', 'しました', 'なりました', 'できます'],
  'Dua informasi: Anda sendiri memutuskan pergi naik kereta; sekolah menetapkan perjalanan bulan depan. Tulis keputusan pribadi dengan ことにしました dan keputusan sekolah dengan ことになりました.');

add(5, '0fe354f8-3553-4fdc-963d-48697dacd11e',
  'Vる／Vないことにしている adalah aturan atau kebiasaan yang sengaja ditetapkan. Bedakan dari ことにした yang melaporkan satu keputusan. Sebutkan petunjuk rutin seperti 毎日 atau いつも supaya maknanya jelas.', `
毎日、ねるまえに 本を よむことにしています。|よむことにしています|Saya menetapkan kebiasaan membaca buku setiap hari sebelum tidur.
夜は コーヒーを のまないことにしています。|のまないことにしています|Saya membiasakan diri tidak minum kopi pada malam hari.
毎週 日曜日に、へやを そうじすることにしています。|そうじすることにしています|Saya menetapkan hari Minggu setiap minggu sebagai waktu membersihkan kamar.`,
  ['Apakah kalimat ini hanya menyatakan keputusan untuk satu malam?', '夜は コーヒーを のまないことにしています。', 'Saya membiasakan diri tidak minum kopi pada malam hari.', 'Tidak; ini aturan pribadi yang dipertahankan.', 'Ya; hanya menjelaskan kopi yang diminum kemarin.', 'Tidak; ini kemampuan membuat kopi.'],
  ['Nyatakan aturan pribadi yang terus dilakukan setiap hari.', '毎日 本を よむことに＿＿＿。', 'Saya menetapkan kebiasaan membaca setiap hari.', 'しています', 'しました', 'なりました'],
  'Tetapkan dua aturan belajar pribadi: membaca bahasa Jepang setiap pagi dan tidak menonton televisi sebelum belajar. Tulis dengan ことにしています, satu positif dan satu negatif.');

add(5, 'f198bd60-f4e2-4309-b27f-096a74102935',
  'ようになる menunjukkan perubahan menuju kemampuan atau kebiasaan. Potensial: よめるようになった = menjadi bisa membaca; verba biasa: よむようになった = mulai punya kebiasaan membaca. Vなくなる berarti tidak lagi melakukan, misalnya のまなくなった. Jadi ようになる tidak selalu berarti bisa.', `
日本語の 本が よめるようになりました。|よめるようになりました|Saya sekarang menjadi bisa membaca buku bahasa Jepang.
さいきん、毎朝 さんぽするようになりました。|さんぽするようになりました|Akhir-akhir ini saya mulai berjalan-jalan setiap pagi.
夜は コーヒーを のまなくなりました。|のまなくなりました|Saya tidak lagi minum kopi pada malam hari.`,
  ['Perubahan apa yang terjadi?', 'さいきん、毎朝 さんぽするようになりました。', 'Akhir-akhir ini saya mulai berjalan-jalan setiap pagi.', 'Kebiasaan berjalan-jalan setiap pagi mulai terbentuk.', 'Kemampuan berjalan hilang.', 'Perjalanan besok dibatalkan sekolah.'],
  ['Dulu tidak bisa membaca bahasa Jepang, sekarang bisa. Pilih bentuk kemampuan.', '日本語の 本が ＿＿＿ようになりました。', 'Saya menjadi bisa membaca buku bahasa Jepang.', 'よめる', 'よむ', 'よんだ'],
  'Kartu sebelum–sesudah: dulu tidak bisa membaca bahasa Jepang, sekarang bisa; dulu minum kopi malam hari, sekarang tidak lagi. Tulis dua perubahan dengan ようになりました dan なくなりました.');

add(5, '35ae0859-6fde-42d7-8f5d-31e10178dcb5',
  'Vる／Vないようにする menyatakan usaha agar tindakan terjadi/tidak terjadi. ようにしている menunjukkan usaha yang dipertahankan; belum menjamin selalu berhasil. Bandingkan ようになった, yang menyatakan perubahan sudah terjadi. なるべく = sebisa mungkin.', `
毎日、日本語で はなすようにしています。|はなすようにしています|Saya berusaha berbicara dalam bahasa Jepang setiap hari.
夜、おそく ねないようにしています。|ねないようにしています|Saya berusaha tidak tidur larut malam.
これから、なるべく あるくようにします。|あるくようにします|Mulai sekarang, saya akan berusaha berjalan kaki sebisa mungkin.`,
  ['Apa yang ditekankan pembicara?', '毎日、日本語で はなすようにしています。', 'Saya berusaha berbicara dalam bahasa Jepang setiap hari.', 'Usaha yang dipertahankan untuk memakai bahasa Jepang.', 'Jaminan sudah bisa berbicara tanpa kesalahan.', 'Larangan berbicara bahasa Jepang.'],
  ['Nyatakan usaha agar tidak tidur larut malam.', '夜、おそく ＿＿＿ようにしています。', 'Saya berusaha tidak tidur larut malam.', 'ねない', 'ねなかった', 'ねません'],
  'Anda ingin menjaga kebiasaan belajar: usahakan berbicara bahasa Jepang setiap hari dan jangan tidur larut. Buat dua kalimat ようにしています; jelaskan usaha, bukan kemampuan yang sudah tercapai.');

// BAB 6 — percobaan, hasil, dan tanggapan.
add(6, '6060cab0-e192-40cb-9e7f-71ca0973f18d',
  'Vてみる berarti melakukan sebagai percobaan untuk mengetahui hasilnya; みる di sini tidak berarti melihat dengan mata. てみたい menggabungkan keinginan dari N5. Bentuk sopan: ためしてみます; lampau: たべてみました.', `
この おちゃを のんでみます。|のんでみます|Saya akan mencoba minum teh ini.
きのう、日本の りょうりを つくってみました。|つくってみました|Kemarin saya mencoba membuat masakan Jepang.
あたらしい カメラを つかってみたいです。|つかってみたいです|Saya ingin mencoba memakai kamera baru.`,
  ['Apa yang ingin diketahui lewat tindakan ini?', 'この おちゃを のんでみます。', 'Saya akan mencoba minum teh ini.', 'Bagaimana teh itu setelah dicoba diminum.', 'Siapa yang sedang melihat teh.', 'Mengapa teh dilarang diminum.'],
  ['Anda mencoba membaca novel bahasa Jepang kemarin. Lengkapi bentuk percobaan lampau.', '日本語の しょうせつを ＿＿＿。', 'Saya mencoba membaca novel bahasa Jepang.', 'よんでみました', 'よむみました', 'よみてみました'],
  'Kartu percobaan: kemarin mencoba masakan Jepang; minggu depan ingin mencoba memakai kamera baru. Tulis satu kalimat てみました dan satu てみたいです.');

add(6, 'be008ffc-ce98-4337-8db9-4c36b660fc20',
  'てしまう dapat menekankan selesai seluruhnya atau hasil yang disesalkan; konteks menentukan. Jangan terjemahkan selalu tidak sengaja. Ragam akrab: たべてしまう→たべちゃう、のんでしまう→のんじゃう; lampau ちゃった／じゃった. なくす = kehilangan.', `
この 本は ぜんぶ よんでしまいました。|よんでしまいました|Saya sudah selesai membaca seluruh buku ini.
大事な かぎを なくしてしまいました。|なくしてしまいました|Saya kehilangan kunci penting, sayang sekali.
ケーキを ぜんぶ たべちゃった。|たべちゃった|Kuennya sudah saya habiskan. (Ucapan akrab.)`,
  ['Dengan petunjuk ぜんぶ, makna apa yang terutama ditekankan?', 'この 本は ぜんぶ よんでしまいました。', 'Saya sudah selesai membaca seluruh buku ini.', 'Bacaan telah selesai seluruhnya.', 'Pembicara pasti menyesal membaca.', 'Pembicara belum mulai membaca.'],
  ['Pilih bentuk akrab dari のんでしまった.', 'ジュースを ぜんぶ ＿＿＿。', 'Jusnya sudah saya habiskan.', 'のんじゃった', 'のんちゃった', 'のむちゃった'],
  'Tulis dua hasil berbeda dengan てしまいました: Anda selesai membaca seluruh buku; Anda kehilangan kunci penting. Tambahkan ぜんぶ atau 大事な agar nuansanya jelas.');

add(6, '64e59ad7-df3a-436e-b766-ddf5b8d8492e',
  'Vてよかった menyatakan lega/senang atas tindakan atau hasil; Vなくてよかった lega karena tidak terjadi/tidak dilakukan. Negatif dibentuk dari ない→なくて. Jelaskan hasil atau konteks yang membuatnya positif; bentuk ini bukan perintah agar mengulangi tindakan.', `
この えいがを みてよかったです。|みてよかったです|Saya senang sudah menonton film ini.
電車に まにあってよかったです。|まにあってよかったです|Syukurlah saya sempat naik kereta.
かぎを なくさなくてよかったです。|なくさなくてよかったです|Syukurlah saya tidak kehilangan kunci.`,
  ['Apa keadaan yang membuat pembicara lega?', 'かぎを なくさなくてよかったです。', 'Syukurlah saya tidak kehilangan kunci.', 'Kuncinya tidak hilang.', 'Kuncinya hilang.', 'Ia sengaja membuang kunci.'],
  ['Anda lega karena sempat naik kereta. Gunakan まにあう.', '電車に ＿＿＿よかったです。', 'Syukurlah saya sempat naik kereta.', 'まにあって', 'まにあわなくて', 'まにあうで'],
  'Anda pulang dan menemukan kunci masih di tas. Tulis satu kalimat lega karena tidak kehilangan kunci, dengan なくさなくてよかったです.');

add(6, '1f385dcf-d1af-4bba-99f9-40aa1cd78b5a',
  'Vてすみません meminta maaf atas tindakan; Vなくてすみません untuk sesuatu yang tidak dilakukan. Negatif memakai ない→なくて, bukan ないで pada pola ini. おくれる = terlambat; へんじ = balasan. Pilih bentuk kemampuan negatif ketika memang tidak bisa: こられなくて.', `
おくれて すみません。|おくれて すみません|Maaf saya terlambat.
きのう、へんじを しなくて すみません。|しなくて すみません|Maaf kemarin saya tidak membalas.
きのう、学校へ こられなくて すみません。|こられなくて すみません|Maaf kemarin saya tidak bisa datang ke sekolah.`,
  ['Pembicara meminta maaf karena apa?', 'きのう、へんじを しなくて すみません。', 'Maaf kemarin saya tidak membalas.', 'Tidak memberikan balasan kemarin.', 'Membalas terlalu panjang.', 'Meminta orang lain tidak membalas.'],
  ['Minta maaf karena tidak menelepon kemarin.', 'きのう、電話を ＿＿＿ すみません。', 'Maaf kemarin saya tidak menelepon.', 'しなくて', 'しないで', 'しなかったで'],
  'Anda terlambat datang dan kemarin tidak membalas pesan. Buat dua permintaan maaf singkat dengan おくれて dan へんじをしなくて.');

// BAB 7 — transitif, intransitif, keadaan, dan persiapan.
add(7, 'e57880e8-761f-449c-8ea6-da9f802ace6e',
  'Pelajari pasangan sebagai dua verba: あける／あく、しめる／しまる、こわす／こわれる. Transitif menyebut tindakan pada objek を; intransitif menyebut perubahan/keadaan benda が. Tidak semua verba Jepang memiliki pasangan, dan akhir kata tidak memberikan aturan pasti. Contoh bab ini fokus pada benda yang berubah, bukan seluruh penggunaan を.', `
わたしが まどを あけました。|まどを あけました|Saya membuka jendela.
まどが あきました。|まどが あきました|Jendelanya terbuka.
おとうとが コップを わりました。|コップを わりました|Adik laki-laki saya memecahkan gelas.`,
  ['Kalimat mana yang menyebut pelaku tindakan secara jelas?', 'わたしが まどを あけました。', 'Saya membuka jendela.', 'Saya melakukan tindakan membuka jendela.', 'Jendela membuka saya.', 'Tidak ada pelaku yang disebutkan.'],
  ['Deskripsikan gelas yang pecah, tanpa menyebut siapa yang memecahkannya.', 'コップが ＿＿＿。', 'Gelasnya pecah.', 'われました', 'わりました', 'わります'],
  'Dua kartu: Anda membuka pintu; kemudian pintu menutup tanpa pelaku disebutkan. Buat satu kalimat transitif memakai ドアをあける dan satu intransitif memakai ドアがしまる, keduanya lampau sopan.');

add(7, '0e4fc372-5e3f-479c-924b-f537405e893e',
  'Verba perubahan intransitif + ている sering menjelaskan keadaan hasil: あく→あいている = dalam keadaan terbuka. Ini tidak selalu berarti perubahan sedang berlangsung. Bandingkan ドアがあきました (perubahan terjadi) dan ドアがあいています (keadaan sekarang).', `
ドアが あいています。|あいています|Pintunya dalam keadaan terbuka.
へやの 電気が ついています。|ついています|Lampu kamar menyala.
この パソコンは こわれています。|こわれています|Komputer ini rusak.`,
  ['Apakah こわれています mengharuskan proses rusak sedang berlangsung?', 'この パソコンは こわれています。', 'Komputer ini rusak.', 'Tidak; di sini menjelaskan keadaan hasil kerusakan.', 'Ya; komputer pasti sedang dipecahkan seseorang.', 'Tidak; artinya komputer belum pernah rusak.'],
  ['Anda melihat pintu sudah terbuka. Laporkan keadaan sekarang.', 'ドアが ＿＿＿。', 'Pintunya dalam keadaan terbuka.', 'あいています', 'あけています', 'あきます'],
  'Kartu pemeriksaan ruangan: jendela tertutup, lampu menyala. Tulis dua keadaan hasil memakai しまっています dan ついています.');

add(7, '927f5138-3988-45d7-ab3a-d4eebfd9ae13',
  'Verba transitif + てある menyatakan hasil tindakan sengaja yang masih ada. Pada pola benda が: まどがあけてあります = jendela sengaja sudah dibuka. Bandingkan intransitif まどがあいています yang cukup melaporkan keadaan. NをVてある juga digunakan untuk tindakan yang sudah disiapkan: きっぷをかってあります.', `
へやに いすが ならべてあります。|ならべてあります|Kursi sudah sengaja disusun di ruangan.
かべに しゃしんが かけてあります。|かけてあります|Foto sudah dipasang tergantung di dinding.
あしたの りょこうの きっぷを かってあります。|かってあります|Tiket untuk perjalanan besok sudah saya beli sebagai persiapan.`,
  ['Apa yang ditambahkan てあります pada keadaan kursi?', 'へやに いすが ならべてあります。', 'Kursi sudah sengaja disusun di ruangan.', 'Kursi tersusun sebagai hasil tindakan seseorang yang disengaja.', 'Kursi sedang bergerak sendiri.', 'Kursi belum pernah dipakai.'],
  ['Seseorang sengaja menyusun kursi dan susunannya masih ada. Lengkapi bentuk hasil persiapan.', 'いすが ならべて＿＿＿。', 'Kursi sudah disusun.', 'あります', 'います', 'みます'],
  'Persiapan kelas sudah selesai: kursi disusun di ruangan dan foto digantung di dinding. Tulis dua kalimat が〜てあります dengan ならべる dan かける.');

add(7, '5b399f7d-1fdb-47ec-b4a1-728ace562e18',
  'ておく menyatakan persiapan untuk keperluan nanti atau membiarkan keadaan tetap demikian. Sebutkan keperluan atau batasnya agar maksud jelas. Bentuk akrab: かっておく→かっとく、よんでおく→よんどく. Bandingkan てある yang menggambarkan hasil yang sudah tersedia.', `
りょこうのまえに、きっぷを かっておきます。|かっておきます|Saya akan membeli tiket terlebih dahulu sebelum perjalanan.
あしたの じゅぎょうの 本を よんでおきます。|よんでおきます|Saya akan membaca buku untuk pelajaran besok sebagai persiapan.
まだ つかいますから、いすは ここに おいておいてください。|おいておいてください|Kursinya masih akan dipakai, jadi biarkan di sini dulu.`,
  ['Mengapa buku dibaca sekarang?', 'あしたの じゅぎょうの 本を よんでおきます。', 'Saya akan membaca buku untuk pelajaran besok sebagai persiapan.', 'Untuk mempersiapkan pelajaran besok.', 'Untuk meminta izin membeli buku.', 'Untuk mengatakan buku sudah hilang.'],
  ['Pilih bentuk akrab dari よんでおく.', 'この 本を ＿＿＿ね。', 'Aku baca buku ini dulu sebagai persiapan, ya.', 'よんどく', 'よんとく', 'よむとく'],
  'Anda akan bepergian besok. Sebutkan dua persiapan: membeli tiket dan menyiapkan tas. Gunakan かっておきます dan かばんをじゅんびしておきます.');

// BAB 8 — arah, perkembangan, tahap kegiatan.
add(8, 'cdc54833-4399-44a8-a1c4-4802c5fda033',
  'ていく bergerak/berkembang menjauh dari titik acuan; てくる menuju titik acuan atau berkembang sampai sekarang. Arah tergantung lokasi/sudut waktu pembicara. Perubahan suhu: さむくなってきた = berangsur dingin sampai kini. ていく／てくる juga bisa berupa melakukan lalu pergi/datang; tentukan konteksnya.', `
レンさんは むこうへ あるいていきました。|あるいていきました|Ren berjalan pergi ke arah sana, menjauh dari sini.
子どもが こちらへ はしってきました。|はしってきました|Anak itu berlari datang ke sini.
さいきん、さむくなってきました。|さむくなってきました|Akhir-akhir ini cuaca berangsur menjadi dingin hingga sekarang.`,
  ['Ke mana arah gerak anak dibanding pembicara?', '子どもが こちらへ はしってきました。', 'Anak itu berlari datang ke sini.', 'Menuju tempat pembicara.', 'Menjauh dari pembicara.', 'Tidak ada gerakan sama sekali.'],
  ['Dari cuaca beberapa hari lalu hingga sekarang, suhu makin dingin. Pilih arah perkembangan sampai kini.', 'さいきん、さむくなって＿＿＿。', 'Akhir-akhir ini cuaca berangsur menjadi dingin hingga sekarang.', 'きました', 'いきます', 'おきます'],
  'Dua gambar dari posisi Anda: Ren berjalan menjauh; anak berlari mendekat. Tulis satu kalimat ていきました dan satu てきました, gunakan むこう dan こちら sebagai petunjuk arah.');

add(8, '931b1e73-e2ba-4cb6-8744-997b9b5380da',
  'Buang ます lalu tambah はじめる／だす. はじめる menandai mulai secara umum; だす sering menonjolkan awal mendadak. Keduanya dapat tumpang tindih, jadi konteks, bukan hafalan satu kata, menentukan pilihan. Bentuk gabungan tetap satu verba: よみはじめました.', `
先月、日本語を べんきょうしはじめました。|べんきょうしはじめました|Saya mulai belajar bahasa Jepang bulan lalu.
雨が ふりだしました。|ふりだしました|Hujan mulai turun. (Awalnya terasa mendadak.)
子どもが きゅうに なきだしました。|なきだしました|Anak itu tiba-tiba mulai menangis. (なく = menangis.)`,
  ['Apa yang ditonjolkan oleh きゅうに dan なきだしました?', '子どもが きゅうに なきだしました。', 'Anak itu tiba-tiba mulai menangis.', 'Tangisan mulai secara mendadak.', 'Tangisan sudah berhenti lama.', 'Anak selalu menangis sepanjang hari.'],
  ['Bentuk gabungan dari よみます + はじめる untuk mulai membaca.', 'きのう、この 本を ＿＿＿。', 'Kemarin saya mulai membaca buku ini.', 'よみはじめました', 'よむはじめました', 'よんではじめました'],
  'Anda mulai belajar bahasa Jepang bulan lalu; saat berjalan kemarin, hujan tiba-tiba mulai turun. Tulis satu kalimat しはじめました dan satu ふりだしました.');

add(8, '4002889e-6ecf-4b6e-b4bd-86254ec5d5c1',
  'Vます tanpa ます + つづける／おわる: よみつづける、よみおわる. Yang pertama mempertahankan kegiatan, yang kedua mencapai akhir kegiatan. ている saja tidak otomatis menyatakan terus-menerus; pilih つづける bila kesinambungan menjadi fokus.', `
二時間、あるきつづけました。|あるきつづけました|Saya terus berjalan selama dua jam.
この 本を よみおわりました。|よみおわりました|Saya sudah selesai membaca buku ini.
これからも 日本語を べんきょうしつづけます。|べんきょうしつづけます|Saya akan terus belajar bahasa Jepang ke depannya juga.`,
  ['Bagaimana keadaan kegiatan membaca sekarang?', 'この 本を よみおわりました。', 'Saya sudah selesai membaca buku ini.', 'Sudah mencapai akhir buku.', 'Baru akan dimulai.', 'Sedang diteruskan tanpa akhir.'],
  ['Lengkapi gabungan かきます + おわる: laporan sudah selesai ditulis.', 'レポートを ＿＿＿。', 'Saya sudah selesai menulis laporan.', 'かきおわりました', 'かくおわりました', 'かいておわりました'],
  'Kemarin Anda berjalan terus selama dua jam, lalu menyelesaikan bacaan sebuah buku. Tulis dua kalimat terpisah dengan あるきつづけました dan よみおわりました.');

add(8, 'daa05f6e-93ab-4f75-8c00-8ff7830e8e93',
  'Tiga tahap: Vるところ = tepat akan mulai; Vているところ = sedang di tengah kegiatan; Vたところ = baru saja selesai. Gunakan いまから／いま／たったいま sebagai petunjuk bila perlu. ところ di sini berarti tahap kegiatan, bukan tempat fisik. たったいま = baru saja saat ini.', `
いまから ごはんを たべるところです。|たべるところです|Saya tepat akan mulai makan sekarang.
いま、レポートを かいているところです。|かいているところです|Sekarang saya sedang di tengah menulis laporan.
たったいま、いえに かえったところです。|かえったところです|Saya baru saja tiba di rumah.`,
  ['Apakah makan sudah dimulai?', 'いまから ごはんを たべるところです。', 'Saya tepat akan mulai makan sekarang.', 'Belum; tepat akan mulai.', 'Sudah selesai seluruhnya.', 'Sudah berlangsung sejak pagi.'],
  ['Anda baru saja selesai makan beberapa saat ini. Pilih tahap selesai.', 'たったいま、ごはんを ＿＿＿ところです。', 'Saya baru saja selesai makan.', 'たべた', 'たべる', 'たべている'],
  'Tiga kartu aktivitas makan: segera akan mulai, sedang berlangsung, baru saja selesai. Tulis satu kalimat ところです untuk setiap kartu dengan bentuk verba yang sesuai.');

add(8, '2edf278e-e07f-436c-a0cd-86e13c3a87ad',
  'Vたばかり menyatakan sesuatu terasa baru terjadi menurut pembicara. Bisa beberapa menit atau lebih lama jika masih dianggap baru. Vたところ lebih menekankan tepat sesudah selesai. Jangan menolak 先月〜ばかり hanya karena bukan beberapa detik yang lalu.', `
さっき ごはんを たべたばかりです。|たべたばかりです|Saya baru saja makan tadi.
先月、この まちに ひっこしてきたばかりです。|ひっこしてきたばかりです|Saya baru pindah ke kota ini bulan lalu. (Masih terasa baru.)
この くつは きのう かったばかりです。|かったばかりです|Sepatu ini baru dibeli kemarin.`,
  ['Mengapa ばかり masih dapat dipakai dengan 先月?', '先月、この まちに ひっこしてきたばかりです。', 'Saya baru pindah ke kota ini bulan lalu.', 'Pembicara masih menganggap kepindahan itu baru.', '先月 berarti beberapa detik yang lalu.', 'ばかり selalu berarti sudah bertahun-tahun.'],
  ['Nyatakan sepatu baru dibeli kemarin.', 'この くつは きのう ＿＿＿ばかりです。', 'Sepatu ini baru dibeli kemarin.', 'かった', 'かう', 'かって'],
  'Anda pindah ke kota ini bulan lalu dan masih merasa baru tinggal di sini. Tulis satu kalimat memakai ひっこしてきたばかりです serta penanda 先月.');

add(8, '0221a8e3-c36b-4545-bf1e-5358e4b21396',
  'もう + lampau menyatakan sudah; まだ + ていない menyatakan belum; まだ + ている menyatakan masih. Jawaban negatif untuk もう〜ましたか yang berarti belum lazim memakai まだ〜ていません, bukan lampau negatif yang hanya menceritakan masa lalu.', `
もう レポートを かきました。|もう レポートを かきました|Saya sudah menulis laporan.
まだ レポートを かいていません。|まだ レポートを かいていません|Saya belum menulis laporan.
まだ レポートを かいています。|まだ レポートを かいています|Saya masih menulis laporan.`,
  ['Apakah penulisan laporan masih berlangsung?', 'まだ レポートを かいています。', 'Saya masih menulis laporan.', 'Ya, masih berlangsung.', 'Tidak, belum dimulai sama sekali.', 'Tidak, sudah selesai seluruhnya.'],
  ['Jawab bahwa Anda belum makan, tetapi nanti akan makan.', 'いいえ、まだ ＿＿＿。', 'Belum, saya belum makan.', 'たべていません', 'たべました', 'たべています'],
  'Tiga status tugas: laporan sudah ditulis; buku belum dibaca; kamar masih dibersihkan. Buat tiga kalimat dengan もう、まだ〜ていません、まだ〜ています.');

// BAB 9 — cara dan sifat.
add(9, '9310a766-a8a7-4520-904d-e9adfa304a44',
  'Buang ます lalu tambah かた: よみます→よみかた. Frasa ini kata benda, sehingga objek memakai の: この字をよむ→この字のよみかた. Nをする menjadi Nのしかた: べんきょうのしかた. かた bukan orang pada penggunaan ini.', `
この 字の よみかたを おしえてください。|字の よみかた|Tolong ajarkan cara membaca huruf ini.
この パソコンの つかいかたが わかりません。|パソコンの つかいかた|Saya tidak mengerti cara memakai komputer ini.
日本語の べんきょうの しかたを かえました。|べんきょうの しかた|Saya mengubah cara belajar bahasa Jepang.`,
  ['Informasi apa yang diminta?', 'この 字の よみかたを おしえてください。', 'Tolong ajarkan cara membaca huruf ini.', 'Cara membaca huruf tersebut.', 'Nama pemilik buku.', 'Waktu membeli komputer.'],
  ['Ubah つかいます menjadi kata benda yang berarti cara menggunakan.', 'この カメラの ＿＿＿を おしえてください。', 'Tolong ajarkan cara memakai kamera ini.', 'つかいかた', 'つかうかた', 'つかってかた'],
  'Anda belum tahu cara membaca sebuah huruf dan cara memakai kamera. Tulis dua permintaan おしえてください dengan よみかた dan つかいかた; benda diterangkan memakai の.');

add(9, 'd9ac7146-30d2-4df3-9bcc-4061c297dfab',
  'Vます tanpa ます + やすい／にくい menjadi sifat い: よみやすい、よみにくい. Artinya mudah/sulit dilakukan, bukan harga murah. Bentuk lampau: よみやすかった; negatif: よみやすくない. Sebutkan ciri benda atau situasi yang memengaruhi kemudahan.', `
この 本は 字が 大きいです。よみやすいです。|よみやすいです|Huruf buku ini besar. Bukunya mudah dibaca.
この くつは あるきにくいです。|あるきにくいです|Sepatu ini sulit dipakai berjalan.
この ペンは かきやすかったです。|かきやすかったです|Pena ini mudah dipakai menulis. (Penilaian setelah memakainya.)`,
  ['Apakah やすい di sini menunjukkan harga buku murah?', 'この 本は よみやすいです。', 'Buku ini mudah dibaca.', 'Tidak; menunjukkan kemudahan membaca.', 'Ya; menyatakan harga buku paling rendah.', 'Tidak; menyatakan buku belum dibaca.'],
  ['Pena sulit dipakai menulis. Bentuklah kata sifat dari かきます.', 'この ペンは ＿＿＿です。', 'Pena ini sulit dipakai menulis.', 'かきにくい', 'かくにくい', 'かいてにくい'],
  'Kartu ulasan: buku mudah dibaca; sepatu sulit dipakai berjalan. Tulis dua penilaian dengan よみやすい dan あるきにくい.');

add(9, 'ddd7b7eb-77fd-4fc0-8f96-7bcd27d5ca28',
  'Vます tanpa ます + すぎる; sifat い buang い; sifat な gunakan dasar: たべすぎる、たかすぎる、しずかすぎる. いい→よすぎる. すぎる berubah sebagai verba G2: すぎます／すぎました／すぎない. Maknanya melewati kadar yang sesuai.', `
きのう、ケーキを たべすぎました。|たべすぎました|Kemarin saya makan kue terlalu banyak.
この かばんは 高すぎます。|高すぎます|Tas ini terlalu mahal.
この へやは しずかすぎます。|しずかすぎます|Kamar ini terlalu sunyi.`,
  ['Apa penilaian pembicara terhadap harga tas?', 'この かばんは 高すぎます。', 'Tas ini terlalu mahal.', 'Harganya melebihi kadar yang dianggap sesuai.', 'Harganya murah.', 'Harganya belum diketahui sama sekali.'],
  ['Gabungkan たかい dengan すぎます.', 'この かばんは ＿＿＿。', 'Tas ini terlalu mahal.', 'たかすぎます', 'たかいすぎます', 'たかくすぎます'],
  'Kartu pengalaman: kemarin makan kue berlebihan; tas yang dilihat hari ini terlalu mahal. Tulis satu kalimat verba dan satu sifat dengan すぎる, sesuaikan waktunya.');

add(9, 'e5bad6e3-2a14-4549-a837-db3a4f3ff8c9',
  'Untuk menerangkan cara melakukan: sifat い→く＋V; sifat な→に＋V. はやくおきる = bangun awal; しずかにはなす = berbicara pelan/tenang. Bedakan はやい時間 (waktu awal) dari はやくおきる (cara/waktu tindakan). いい menjadi よく.', `
あしたは はやく おきます。|はやく おきます|Besok saya bangun lebih awal.
としょかんでは しずかに はなしてください。|しずかに はなしてください|Silakan berbicara pelan di perpustakaan.
名前を ていねいに かいてください。|ていねいに かいてください|Silakan tulis nama dengan rapi dan teliti.`,
  ['Apa yang diterangkan oleh ていねいに?', '名前を ていねいに かいてください。', 'Silakan tulis nama dengan rapi dan teliti.', 'Cara menulis nama.', 'Pemilik nama.', 'Jumlah huruf nama.'],
  ['Gunakan sifat な しずか untuk menerangkan cara berbicara.', 'しずか＿＿＿ はなしてください。', 'Silakan berbicara pelan.', 'に', 'な', 'の'],
  'Buat dua instruksi: tulis nama dengan teliti; berbicaralah pelan di perpustakaan. Gunakan ていねいに dan しずかに sebelum verba.');

add(9, '0e4531c6-642d-498d-badc-3dbc4e855abd',
  'くする／にする menunjukkan tindakan membuat keadaan berubah: おとを小さくする = mengecilkan suara. Sifat い→くする; sifat な/N→にする. Bandingkan 小さくなる yang menyatakan perubahan keadaan. にする juga dapat berarti memilih seperti pada N5, tetapi di sini fokus tindakan mengubah.', `
テレビの おとを 小さくしました。|小さくしました|Saya mengecilkan suara televisi.
へやを きれいにしました。|きれいにしました|Saya membuat kamar menjadi bersih.
かみを みじかくしたいです。|みじかくしたいです|Saya ingin membuat rambut menjadi lebih pendek. (かみ = rambut.)`,
  ['Apa peran pembicara dalam kalimat ini?', 'テレビの おとを 小さくしました。', 'Saya mengecilkan suara televisi.', 'Melakukan tindakan untuk mengecilkan suara.', 'Hanya mengamati suara mengecil sendiri.', 'Memilih membeli televisi baru.'],
  ['Anda membuat kamar menjadi bersih. きれい adalah sifat な.', 'へやを きれい＿＿＿しました。', 'Saya membuat kamar menjadi bersih.', 'に', 'く', 'な'],
  'Persiapan belajar: Anda mengecilkan suara televisi dan membersihkan kamar. Tulis dua tindakan yang mengubah keadaan, dengan 小さくしました dan きれいにしました.');

add(9, 'da290fe5-88a8-40e0-8424-3a591df34111',
  'Nomina derajat: sifat い buang い + さ; sifat な dasar + さ: たかさ、べんりさ. Pengecualian いい→よさ. Hasilnya kata benda sehingga dapat memakai は／が／を. Bedakan たかい (tinggi) dan たかさ (ketinggian).', `
この 山の 高さは 三千メートルです。|高さ|Ketinggian gunung ini tiga ribu meter.
この かばんの おもさを はかりました。|おもさ|Saya mengukur berat tas ini. (はかる = mengukur.)
この まちの べんりさが よく わかりました。|べんりさ|Saya memahami dengan baik kepraktisan kota ini.`,
  ['Apa jenis informasi yang dinyatakan oleh 高さ?', 'この 山の 高さは 三千メートルです。', 'Ketinggian gunung ini tiga ribu meter.', 'Ukuran ketinggian gunung.', 'Keinginan mendaki gunung.', 'Waktu gunung terlihat.'],
  ['Bentuk kata benda yang berarti berat dari おもい.', 'この かばんの ＿＿＿を はかります。', 'Saya akan mengukur berat tas ini.', 'おもさ', 'おもいさ', 'おもくさ'],
  'Kartu ukuran: gunung tingginya 3.000 meter. Tulis satu kalimat dengan 高さ. Lalu buat pertanyaan tentang berat tas memakai おもさはどのくらいですか.');

// BAB 10 — alasan dan pertentangan.
add(10, 'c61fa4fc-7998-4ad0-af86-1ce0da781ac9',
  'ので menyajikan alasan/latar suatu hasil. Bentuk biasa + ので; N／sifat な afirmatif nonlampau memakai な: やすみなので、しずかなので. Negatif/lampau tetap bentuk biasa: やすみじゃないので、しずかだったので. Bukan aturan bahwa ので selalu benar dan から selalu kasar; pilihan juga bergantung konteks.', `
雨が ふっているので、いえに います。|ふっているので|Karena sedang hujan, saya berada di rumah.
あしたは 休みなので、ゆっくり ねます。|休みなので|Karena besok libur, saya akan tidur santai tanpa terburu-buru.
この へやは しずかなので、べんきょうしやすいです。|しずかなので|Karena kamar ini tenang, belajar terasa mudah.`,
  ['Manakah alasan dan manakah hasil dalam kalimat ini?', '雨が ふっているので、いえに います。', 'Karena sedang hujan, saya berada di rumah.', 'Alasan: hujan; hasil: berada di rumah.', 'Alasan: berada di rumah; hasil: hujan.', 'Hujan dan berada di rumah saling bertentangan.'],
  ['Sambungkan kata benda やすみ dengan ので untuk keadaan besok.', 'あしたは やすみ＿＿＿、ゆっくり ねます。', 'Karena besok libur, saya akan tidur santai.', 'なので', 'だので', 'のので'],
  'Kartu alasan: besok libur, jadi akan berjalan-jalan; kamar tenang, jadi mudah belajar. Tulis dua kalimat ので dengan satu kata benda dan satu sifat な.');

add(10, 'ce6ba281-3e25-42ea-a34f-b2ef3e0402b4',
  'し menambah alasan/sifat, sering menyiratkan masih ada alasan lain. Bentuk biasa: やすいし、べんりだし. Bentuk sopan juga mungkin, tetapi latihan bentuk biasa ini menjaga satu ragam. Tidak harus selalu dua し; gunakan dua bila ingin menunjukkan dua alasan secara jelas.', `
この みせは 安いし、おいしいし、よく 来ます。|安いし、おいしいし|Toko makan ini murah dan enak, jadi saya sering datang.
この へやは しずかだし、ひろいし、いいですね。|しずかだし、ひろいし|Kamar ini tenang dan luas; bagus, ya.
きょうは いそがしいし、雨も ふっているし、でかけません。|いそがしいし、雨も ふっているし|Hari ini saya sibuk, dan juga sedang hujan, jadi tidak pergi keluar.`,
  ['Berapa alasan yang disebutkan untuk tidak pergi keluar?', 'きょうは いそがしいし、雨も ふっているし、でかけません。', 'Hari ini saya sibuk, dan juga sedang hujan, jadi tidak pergi keluar.', 'Dua: sibuk dan sedang hujan.', 'Satu: tidak menyukai rumah.', 'Dua: toko mahal dan kamar sempit.'],
  ['Hubungkan sifat な しずか sebagai alasan menggunakan bentuk biasa.', 'この へやは しずか＿＿＿、ひろいし、いいです。', 'Kamar ini tenang dan luas, jadi bagus.', 'だし', 'なし', 'くし'],
  'Rekomendasikan satu kamar karena tenang dan luas. Buat satu kalimat dengan しずかだし、ひろいし, lalu nyatakan bahwa kamar itu bagus.');

add(10, '8aea44c1-727a-4bd6-83dc-4b5fca2371f3',
  'けど／けれど／けれども menghubungkan pertentangan atau menghaluskan pembuka; panjang bentuk dan situasi memengaruhi ragam. Bentuk biasa: 高いけど、しずかだけど. N／sifat な afirmatif nonlampau memakai だ; sifat い tidak ditambah だ. んですが pada B2 juga dapat mengantar permintaan tanpa pertentangan kuat.', `
この かばんは 高いけど、つかいやすいです。|高いけど|Tas ini mahal, tetapi mudah digunakan.
この へやは 小さいけれど、きれいです。|小さいけれど|Kamar ini kecil, tetapi bersih.
あしたは 休みだけど、いえで べんきょうします。|休みだけど|Besok libur, tetapi saya akan belajar di rumah.`,
  ['Bagaimana dua penilaian tas dihubungkan?', 'この かばんは 高いけど、つかいやすいです。', 'Tas ini mahal, tetapi mudah digunakan.', 'Kekurangan harga mahal dibandingkan dengan kelebihan kemudahan.', 'Kemudahan menyebabkan harga selalu menjadi murah.', 'Pembicara melarang orang lain memakai tas.'],
  ['Gabungkan sifat い たかい dengan けど.', 'この かばんは ＿＿＿、つかいやすいです。', 'Tas ini mahal, tetapi mudah digunakan.', 'たかいけど', 'たかいだけど', 'たかいなけど'],
  'Tulis dua penilaian berlawanan tentang kamar: kecil tetapi bersih. Gunakan けれど dan jangan menambah だ setelah 小さい.');

add(10, 'f1770505-1e8e-4eb3-9960-ee23a32ae9dc',
  'のに menyatakan hasil yang meleset dari harapan, sering dengan heran atau kecewa. Bentuk biasa + のに; N／sifat な afirmatif kini memakai なのに. Bedakan のに ini dari のに untuk kegunaan yang dipelajari nanti. Sertakan harapan yang masuk akal dalam konteks.', `
たくさん べんきょうしたのに、しけんが できませんでした。|べんきょうしたのに|Padahal sudah banyak belajar, saya tidak bisa mengerjakan ujian dengan baik.
日曜日なのに、学校に 人が たくさん います。|日曜日なのに|Padahal hari Minggu, ada banyak orang di sekolah.
この かばんは 高かったのに、すぐ こわれました。|高かったのに|Padahal tas ini mahal, tasnya segera rusak.`,
  ['Harapan apa yang ternyata tidak terpenuhi?', 'この かばんは 高かったのに、すぐ こわれました。', 'Padahal tas ini mahal, tasnya segera rusak.', 'Tas mahal diharapkan tidak cepat rusak.', 'Tas mahal memang diharapkan segera rusak.', 'Pembicara mengharapkan harga tas belum diketahui.'],
  ['Pembicara heran sekolah ramai padahal hari Minggu. 日曜日 adalah kata benda.', '日曜日＿＿＿、学校に 人が たくさん います。', 'Padahal hari Minggu, ada banyak orang di sekolah.', 'なのに', 'だのに', 'ののに'],
  'Anda membeli tas mahal dengan harapan awet, tetapi tas segera rusak. Tulis satu kalimat のに dengan 高かった dan すぐこわれました.');

add(10, 'e66f2ffc-6a6b-4e64-a6c7-05ba566759fb',
  'て／なくて dapat menghubungkan sebab dengan perasaan, kesulitan, atau hasil. Sifat い→くて; N／sifat な→で. Bandingkan ねないでべんきょうした (belajar tanpa tidur) dan ねられなくてこまった (kesulitan karena tidak bisa tidur). Untuk alasan diikuti keputusan/permintaan, gunakan から／ので yang sesuai; jangan menganggap semua sebab dapat diganti て.', `
友だちに あえて、うれしかったです。|あえて|Saya senang karena bisa bertemu teman.
しけんの もんだいが わからなくて、こまりました。|わからなくて|Saya kesulitan karena tidak mengerti soal ujian.
きのうは いそがしくて、本が よめませんでした。|いそがしくて|Kemarin saya sibuk sehingga tidak bisa membaca buku.`,
  ['Apa sebab kesulitan pembicara?', 'しけんの もんだいが わからなくて、こまりました。', 'Saya kesulitan karena tidak mengerti soal ujian.', 'Tidak memahami soal ujian.', 'Sudah selesai menjawab semua soal.', 'Tidak ingin guru memberi soal.'],
  ['Sambungkan sifat い いそがしい sebagai sebab tidak bisa membaca.', 'きのうは ＿＿＿、本が よめませんでした。', 'Kemarin saya sibuk sehingga tidak bisa membaca buku.', 'いそがしくて', 'いそがしいで', 'いそがしいくて'],
  'Anda kesulitan karena tidak mengerti soal ujian. Tulis satu kalimat わからなくて、こまりました. Lalu buat kalimat lain bahwa Anda senang karena bisa bertemu teman, memakai あえて.');

add(10, '561023dd-9854-4436-b113-370d72b42307',
  'ても menyatakan hasil tetap berlaku meskipun kondisi A terjadi. Vて＋も; sifat い→くても; N／sifat な→でも; negatif ない→なくても. Dapat dipakai untuk kondisi yang belum terjadi. のに menonjolkan harapan yang meleset pada konteks yang dibicarakan.', `
あした 雨が ふっても、学校へ いきます。|ふっても|Meskipun besok hujan, saya akan pergi ke sekolah.
この かばんは 高くても、かいたいです。|高くても|Walaupun tas ini mahal, saya ingin membelinya.
日曜日でも、この みせは あいています。|日曜日でも|Meskipun hari Minggu, toko ini buka.`,
  ['Apakah rencana sekolah bergantung pada tidak turunnya hujan?', 'あした 雨が ふっても、学校へ いきます。', 'Meskipun besok hujan, saya akan pergi ke sekolah.', 'Tidak; rencana tetap pergi sekalipun hujan.', 'Ya; hanya pergi jika tidak hujan.', 'Ya; pasti tidak pergi besok.'],
  ['Bentuk konsesi dari sifat い たかい.', 'この かばんは ＿＿＿、かいたいです。', 'Walaupun tas ini mahal, saya ingin membelinya.', 'たかくても', 'たかいでも', 'たかくでも'],
  'Rencana besok tetap pergi ke sekolah walaupun hujan. Tulis satu kalimat ても. Lalu nyatakan toko buka sekalipun hari Minggu memakai でも.');

// BAB 11 — penampakan, kabar, dugaan.
add(11, '4d3efc88-0326-40da-9745-e84d5e385949',
  'そう penampakan: Vます tanpa ます + そう; sifat い buang い; sifat な dasar: ふりそう、おいしそう、げんきそう. いい→よさそう、ない→なさそう. N tidak langsung memakai pola penampakan ini. Bedakan ふりそう (tampak akan turun) dan ふるそう (katanya turun).', `
空に くろい くもが あります。雨が ふりそうです。|ふりそうです|Ada awan hitam di langit. Kelihatannya akan hujan.
この ケーキは おいしそうです。|おいしそうです|Kue ini kelihatannya enak. (Dilihat dari tampilannya, belum dicicipi.)
レンさんは げんきそうです。|げんきそうです|Ren tampak sehat dan bersemangat.`,
  ['Atas dasar apa pembicara memperkirakan hujan?', '空に くろい くもが あります。雨が ふりそうです。', 'Ada awan hitam di langit. Kelihatannya akan hujan.', 'Tanda yang terlihat, yaitu awan hitam.', 'Ucapan guru yang dikutip.', 'Hujan yang terjadi bulan lalu.'],
  ['Anda melihat kue yang tampak enak tetapi belum mencicipinya.', 'この ケーキは ＿＿＿です。', 'Kue ini kelihatannya enak.', 'おいしそう', 'おいしいそう', 'おいしいだそう'],
  'Gambar: awan hitam di langit, hujan belum turun. Tulis pengamatan singkat tentang awan, lalu dugaan memakai 雨がふりそうです.');

add(11, 'b53db883-b610-4abc-92d8-1a8e720f52ce',
  'そう kabar memakai bentuk biasa utuh: ふるそうです、やすいそうです、学生だそうです. Beri sumber dalam konteks agar berbeda dari penampakan. Negatif/lampau berada sebelum そう: ふらないそう、ふったそう. Bentuk そう itu sendiri bukan bukti Anda menyaksikan kejadian.', `
あしたは 雨が ふるそうです。|ふるそうです|Katanya besok akan hujan. (Sumber: prakiraan cuaca.)
この みせは 安いそうです。|安いそうです|Katanya toko ini murah. (Informasi dari teman.)
レンさんは 大学生だそうです。|大学生だそうです|Katanya Ren mahasiswa. (Informasi dari guru.)`,
  ['Pembicara mengetahui hal ini dari teman. Apa fungsi そうです?', 'この みせは 安いそうです。', 'Katanya toko ini murah.', 'Melaporkan informasi yang didengar.', 'Menilai tampilan toko dengan mata saja.', 'Memerintahkan toko menurunkan harga.'],
  ['Guru mengatakan Ren mahasiswa. Laporkan kabar itu; 大学生 adalah kata benda.', 'レンさんは 大学生＿＿＿。', 'Katanya Ren mahasiswa.', 'だそうです', 'なそうです', 'そうです'],
  'Prakiraan cuaca mengatakan besok hujan. Sampaikan kabar itu dengan ふるそうです, lalu jelaskan dalam bahasa Indonesia sumber informasinya agar tidak tertukar dengan ふりそうです.');

add(11, '7445d762-bed3-4cb9-8f7b-8c6f72211cd3',
  'らしい pada bab ini berarti kabarnya/tampaknya dari informasi atau tanda tidak langsung. V／sifat い bentuk biasa, tetapi N／sifat な afirmatif nonlampau tanpa だ: 学生らしい. Gunakan sumber atau tanda yang jelas. Makna khas/seperti layaknya seseorang tidak menjadi target di sini.', `
レンさんは あした 日本へ いくらしいです。|いくらしいです|Kabarnya Ren pergi ke Jepang besok. (Pembicara mendapat informasi dari teman.)
あの みせは おいしいらしいです。|おいしいらしいです|Kabarnya makanan di toko itu enak. (Pembicara belum makan di sana.)
へやに かばんが ありません。レンさんは もう かえったらしいです。|かえったらしいです|Tasnya tidak ada di kamar. Tampaknya Ren sudah pulang.`,
  ['Apa yang mendukung dugaan bahwa Ren pulang?', 'へやに かばんが ありません。レンさんは もう かえったらしいです。', 'Tasnya tidak ada di kamar. Tampaknya Ren sudah pulang.', 'Tas Ren tidak lagi ada di kamar.', 'Ren mengatakan akan datang tahun depan.', 'Pembicara pasti melihat Ren tiba di rumah.'],
  ['Sampaikan kabar bahwa Ren mahasiswa menggunakan らしい; gunakan bentuk kata benda yang tepat.', 'レンさんは ＿＿＿らしいです。', 'Kabarnya Ren mahasiswa.', '学生', '学生だ', '学生な'],
  'Anda tidak menyaksikan Ren pulang, tetapi tasnya sudah tidak ada di kamar. Tulis bukti itu dan satu dugaan dengan かえったらしいです.');

add(11, '481653aa-ad49-4988-92d0-3dc088229c7f',
  'かもしれない menyatakan kemungkinan, bukan kepastian. Bentuk sopan かもしれません. V／sifat い memakai bentuk biasa; N／sifat な afirmatif kini tanpa だ: 雨かもしれません、しずかかもしれません. Lampau/negatif tetap dapat berada sebelum pola: わすれたかもしれません、こないかもしれません.', `
あしたは 雨かもしれません。|雨かもしれません|Besok mungkin hujan.
レンさんは きょう こないかもしれません。|こないかもしれません|Ren mungkin tidak datang hari ini.
かぎを いえに わすれたかもしれません。|わすれたかもしれません|Mungkin saya meninggalkan kunci di rumah.`,
  ['Seberapa pasti lokasi kunci diketahui pembicara?', 'かぎを いえに わすれたかもしれません。', 'Mungkin saya meninggalkan kunci di rumah.', 'Belum pasti; rumah hanya salah satu kemungkinan.', 'Pasti sudah ditemukan di rumah.', 'Pasti tidak pernah dibawa ke rumah.'],
  ['Sampaikan kemungkinan hujan; 雨 adalah kata benda.', 'あしたは ＿＿＿かもしれません。', 'Besok mungkin hujan.', '雨', '雨だ', '雨な'],
  'Kunci belum ditemukan dan Anda menduga tertinggal di rumah. Tulis dugaan lampau dengan わすれたかもしれません, tanpa menyatakannya sebagai kepastian.');

add(11, 'be145704-49e9-4840-8248-e05e2b363189',
  'でしょう／だろう dapat menyatakan perkiraan; でしょう dengan intonasi tertentu juga meminta konfirmasi. だろう lebih akrab/tegas, bukan pengganti sopan universal. N／sifat な afirmatif kini tanpa だ: 雨でしょう、べんりでしょう. Jelaskan konteks agar perkiraan dan konfirmasi tidak tertukar.', `
あしたは たぶん 雨でしょう。|雨でしょう|Besok barangkali hujan. (Perkiraan.)
きっと レンさんも 来るでしょう。|来るでしょう|Saya memperkirakan Ren juga akan datang.
この 本、おもしろいでしょう。|おもしろいでしょう|Buku ini menarik, bukan? (Meminta persetujuan setelah teman membacanya.)`,
  ['Dalam konteks kedua orang sudah membaca buku itu, apa maksud ucapan ini?', 'この 本、おもしろいでしょう。', 'Buku ini menarik, bukan?', 'Meminta persetujuan tentang penilaian buku.', 'Melarang teman membaca buku.', 'Menanyakan harga buku yang belum diketahui.'],
  ['Buat perkiraan sopan tentang hujan besok. Jangan tambahkan だ setelah kata benda.', 'あしたは たぶん ＿＿＿。', 'Besok barangkali hujan.', '雨でしょう', '雨だでしょう', '雨なでしょう'],
  'Buat dua kalimat: perkiraan hujan besok dengan たぶん〜でしょう; konfirmasi bahwa buku menarik dengan おもしろいでしょう. Tuliskan fungsi masing-masing dalam bahasa Indonesia.');

add(11, '9c82c41d-3152-4bc9-8a2f-9c22a69e1f05',
  'はずだ adalah dugaan kuat yang punya alasan; bukan kewajiban moral. はずがない berarti menurut alasan itu tidak mungkin. V／sifat い bentuk biasa; sifat な afirmatif kini + な; N + の. Bedakan こないはず (diperkirakan tidak datang) dan くるはずがない (tidak mungkin datang). Selalu beri dasar dugaan.', `
レンさんは さっき いえへ かえりました。いまは いえに いるはずです。|いるはずです|Ren tadi pulang ke rumah. Sekarang seharusnya ia ada di rumah.
この 本は 子どもの 本です。やさしいはずです。|やさしいはずです|Ini buku anak-anak. Seharusnya mudah dibaca.
レンさんは いま 日本に います。ここに いるはずがありません。|いるはずがありません|Ren sekarang ada di Jepang. Tidak mungkin ia ada di sini. (Pembicara berada di Indonesia.)`,
  ['Apa dasar dugaan bahwa Ren ada di rumah?', 'レンさんは さっき いえへ かえりました。いまは いえに いるはずです。', 'Ren tadi pulang ke rumah. Sekarang seharusnya ia ada di rumah.', 'Ia tadi pulang ke rumah.', 'Pembicara mewajibkan semua orang pulang.', 'Tidak ada informasi apa pun tentang Ren.'],
  ['Jadwal resmi mengatakan besok libur. Gunakan sambungan kata benda やすみ pada はず.', 'あしたは やすみ＿＿＿はずです。', 'Besok seharusnya libur.', 'の', 'な', 'だ'],
  'Informasi: Ren tadi pulang ke rumah. Tulis satu kalimat fakta, lalu satu kesimpulan いまはいえにいるはずです. Jangan memakai はず untuk memerintahnya pulang.');

// BAB 12 — kemiripan dan perasaan yang tampak.
add(12, 'b3b6d347-3555-432f-86a1-3979148bc6a3',
  'ようだ menyatakan dugaan dari tanda atau kemiripan. Sambungan: V／sifat い bentuk biasa; sifat な + な; N + の. Untuk menerangkan benda gunakan ような; cara/sifat gunakan ように. Bedakan ゆきのような (mirip salju) dari ようになる yang menyatakan perubahan pada B5.', `
空が くらくなりました。雨が ふるようです。|ふるようです|Langit menjadi gelap. Tampaknya akan hujan.
あの 人は 先生のようです。|先生のようです|Orang itu tampaknya guru. (Dilihat dari kegiatannya mengajar.)
ゆきのような 白い 花が さいています。|ゆきのような 白い 花|Bunga putih seperti salju sedang mekar. (さく = mekar.)`,
  ['Apa fungsi ような pada frasa bunga ini?', 'ゆきのような 白い 花が さいています。', 'Bunga putih seperti salju sedang mekar.', 'Membandingkan penampilan bunga dengan salju.', 'Menyatakan bunga pasti terbuat dari salju.', 'Memerintahkan salju turun.'],
  ['Bentuk frasa kata benda yang berarti bunga seperti salju.', 'ゆきの＿＿＿ 花です。', 'Ini bunga seperti salju.', 'ような', 'ように', 'ようだ'],
  'Gambar: bunga berwarna putih seperti salju. Tulis satu kalimat memakai ゆきのような白い花. Lalu jelaskan bahwa ような di sini membandingkan penampilan.');

add(12, 'feaf0131-8273-4b0e-9bac-cc4fb99a58ff',
  'みたいだ menyatakan tampaknya/mirip dalam percakapan. V／sifat い bentuk biasa; N／sifat な afirmatif kini tanpa だ/の: ゆきみたい、しずかみたい. Bentuk penjelas: みたいな＋N、みたいに＋V. Bedakan えいがをみたい (ingin menonton) dari ゆきみたい (seperti salju).', `
あの 人は 先生みたいです。|先生みたいです|Orang itu tampaknya guru. (Menduga dari keadaan.)
この 花は ゆきみたいに 白いです。|ゆきみたいに|Bunga ini putih seperti salju.
だれも いません。みんな かえったみたいです。|かえったみたいです|Tidak ada siapa-siapa. Tampaknya semua sudah pulang.`,
  ['Apa yang dimaksud oleh みたい pada kalimat bunga?', 'この 花は ゆきみたいに 白いです。', 'Bunga ini putih seperti salju.', 'Kemiripan dengan salju.', 'Keinginan menonton salju.', 'Perintah membuat salju.'],
  ['Gunakan kata benda 先生 sebelum みたい untuk menyatakan dugaan dalam percakapan.', 'あの 人は ＿＿＿みたいです。', 'Orang itu tampaknya guru.', '先生', '先生の', '先生だ'],
  'Anda masuk ke ruangan dan tidak menemukan siapa pun. Tulis pengamatan だれもいません, lalu dugaan bahwa semua sudah pulang dengan かえったみたいです.');

add(12, '07415387-6b6f-4eb7-a00e-0b321d59055f',
  'そう penampakan dari B11 berubah menjadi そうな sebelum kata benda dan そうに sebelum kegiatan: おいしそうなケーキ、たのしそうにはなす. Sifat い tetap dibuang い sebelum そう. Ini berbeda dari そうだ kabar yang memakai bentuk biasa utuh.', `
おいしそうな ケーキを かいました。|おいしそうな ケーキ|Saya membeli kue yang kelihatannya enak.
子どもたちは たのしそうに はなしています。|たのしそうに はなしています|Anak-anak tampak senang saat berbincang.
母は うれしそうな かおを しています。|うれしそうな かお|Wajah ibu saya tampak gembira.`,
  ['Apa yang diterangkan oleh たのしそうに?', '子どもたちは たのしそうに はなしています。', 'Anak-anak tampak senang saat berbincang.', 'Keadaan yang tampak saat anak-anak berbincang.', 'Kabar bahwa anak-anak membeli buku.', 'Nama permainan anak-anak.'],
  ['Terangkan kata benda ケーキ dengan penampakan enak.', 'おいしそう＿＿＿ ケーキですね。', 'Kuennya kelihatan enak, ya.', 'な', 'に', 'だ'],
  'Dua gambar: kue tampak enak; anak-anak tampak senang saat berbicara. Tulis satu frasa そうな＋kata benda dan satu kalimat そうに＋verba.');

add(12, '06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb',
  'がる menggambarkan tanda perasaan yang tampak, lazim untuk orang lain. Hanya sifat tertentu: こわい→こわがる、はずかしい→はずかしがる、いや→いやがる. Bentuk ている menunjukkan keadaan yang sedang terlihat. Sasaran rasa takut dapat memakai を: いぬをこわがる. Tidak semua kata sifat menerima がる.', `
子どもが いぬを こわがっています。|こわがっています|Anak itu menunjukkan rasa takut kepada anjing.
おとうとは 人の前で はなすのを はずかしがっています。|はずかしがっています|Adik laki-laki saya tampak malu berbicara di depan orang.
子どもは この くすりを のむのを いやがっています。|いやがっています|Anak itu menunjukkan keengganan minum obat ini.`,
  ['Perasaan apa yang terlihat dari anak?', '子どもが いぬを こわがっています。', 'Anak itu menunjukkan rasa takut kepada anjing.', 'Takut kepada anjing.', 'Ingin membeli anjing.', 'Bangga pada anjing.'],
  ['Ubah こわい untuk mendeskripsikan rasa takut yang tampak pada orang lain.', '子どもが いぬを ＿＿＿。', 'Anak itu menunjukkan rasa takut kepada anjing.', 'こわがっています', 'こわいがっています', 'こわくがっています'],
  'Anda melihat anak menjauh dari anjing dengan ekspresi takut. Tulis satu kalimat memakai いぬをこわがっています; nyatakan pengamatan, bukan perasaan Anda sendiri.');

add(12, 'ba4cb20f-1d8c-4e1d-b363-7e27f0169b61',
  'Vます tanpa ます + たがる; keadaan yang tampak sekarang たがっている. Untuk benda: Nをほしがっている. Berbeda dari keinginan sendiri たい／ほしい dan berbeda dari kemampuan. Sebutkan tanda/ucapan yang diamati agar tidak menebak isi hati orang tanpa dasar.', `
おとうとは なんども「うみへ いきたい」と いっています。うみへ いきたがっています。|いきたがっています|Adik berkali-kali berkata ingin ke laut. Ia menunjukkan keinginan pergi ke laut. (なんども = berkali-kali.)
子どもは「この ケーキを たべたい」と いっています。ケーキを たべたがっています。|たべたがっています|Anak berkata ingin makan kue ini. Ia menunjukkan keinginan makan kue.
いもうとは 毎日 あの かばんの 話を します。あの かばんを ほしがっています。|ほしがっています|Adik perempuan setiap hari membicarakan tas itu. Ia menunjukkan keinginan memiliki tas itu.`,
  ['Apa objek keinginan yang terlihat, dan apakah berupa benda atau kegiatan?', 'いもうとは あの かばんを ほしがっています。', 'Adik perempuan saya menunjukkan keinginan memiliki tas itu.', 'Tas; benda yang ingin dimiliki.', 'Berjalan; kegiatan yang ingin dilakukan.', 'Membaca; kemampuan yang sudah dimiliki.'],
  ['Adik menunjukkan keinginan pergi ke laut. Bentuklah dari いきます.', 'おとうとは うみへ ＿＿＿。', 'Adik laki-laki menunjukkan keinginan pergi ke laut.', 'いきたがっています', 'いくたがっています', 'いってたがっています'],
  'Kartu pengamatan: adik laki-laki berkali-kali berkata ingin ke laut; adik perempuan membicarakan tas yang diinginkannya. Tulis satu kalimat いきたがっています dan satu ほしがっています, gunakan を untuk tas.');

export default items;
