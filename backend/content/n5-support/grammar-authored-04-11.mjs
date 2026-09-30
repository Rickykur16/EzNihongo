// Supporting examples and practice only. Conversation drafts remain outside the repo
// until the user supplies specific directions. Core selectors come from the approved plan.
export const authored=[];
function support(bab,index,examples,recognition,controlled,taskInstruction){
  authored.push({bab,index,examples:examples.trim().split('\n').map(line=>{const [japanese,highlight,indonesian]=line.split('|');return {japanese,highlight,indonesian};}),recognition,controlled,taskInstruction});
}

support(4,0,`
これは ほんです。|これ|Ini buku. (Buku dekat pembicara.)
それは ペンですか。|それ|Apakah itu pena? (Pena dekat lawan bicara.)
あれは かばんです。|あれ|Itu tas. (Tas jauh dari kedua orang.)`,
["B memegang buku dan mengatakan これはほんです. Di mana buku itu relatif terhadap B?","Dekat B yang berbicara.","Dekat A saja.","Jauh dari keduanya."],
["Anda memegang sebuah buku. Lengkapi pernyataan tentang benda di tangan Anda.","＿＿＿は ほんです。","Ini buku.","これ","それ","あれ"],
"Situasi: Anda memegang ペン (pena). Buat satu kalimat yang memperkenalkan benda di tangan Anda memakai これ.");

support(4,1,`
この ほんは わたしのです。|この|Buku ini milik saya. (Buku dekat pembicara.)
その ペンは ハディさんのです。|その|Pena itu milik Hadi. (Pena dekat lawan bicara.)
どの かばんですか。|どの|Tas yang mana? (Ada beberapa tas.)`,
["Mengapa この dalam このほん langsung diikuti ほん?","この menerangkan kata benda ほん.","この sudah berarti buku.","この menunjukkan pemilik buku."],
["Buku dekat Anda. Lengkapi frasa yang berarti buku ini.","＿＿＿ ほん","Buku ini.","この","これ","どの"],
"Situasi: かばん (tas) berada dekat lawan bicara dan milik アンナ (Anna). Buat satu kalimat tentang tas itu menggunakan その + kata benda.");

support(4,2,`
これは にほんごの ほんです。|の|Ini buku bahasa Jepang.
それは アンナさんの かばんです。|の|Itu tas milik Anna.
あれは インドネシアごの ほんです。|の|Itu buku bahasa Indonesia.`,
["Pada にほんごのほん, apa yang diterangkan oleh にほんご?","Bahasa buku.","Pemilik buku.","Harga buku."],
["Buku ini memakai bahasa Jepang. Lengkapi frasanya.","にほんご＿＿＿ ほん","Buku bahasa Jepang.","の","も","は"],
"Kartu: ほん (buku) di dekat Anda adalah buku bahasa Indonesia, インドネシアご. Buat satu kalimat dengan の yang menjelaskan bahasa buku itu.");

support(4,3,`
はい、そうです。|そうです|Ya, benar. (Menjawab dugaan yang tepat.)
いいえ、ちがいます。|ちがいます|Bukan. (Menjawab dugaan yang keliru.)
いいえ、ちがいます。これは ペンです。|ちがいます|Bukan. Ini pena. (Teman mengira benda ini pensil.)`,
["Teman mengira pensil sebagai pena. Apa fungsi ちがいます dalam jawaban?","Menyangkal dugaan yang keliru.","Membenarkan dugaan teman.","Menanyakan pemilik benda."],
["Teman bertanya apakah benda di tangan Anda pena. Benda itu memang pena. Lengkapi jawaban.","はい、＿＿＿。","Ya, benar.","そうです","ちがいます","そうですか"],
"Situasi: Anda memegang えんぴつ (pensil). Teman bertanya それはペンですか. Beri satu respons singkat: sangkal dengan ちがいます lalu sebutkan benda yang benar.");

support(5,0,`
この ペンは いくらですか。|いくら|Berapa harga pena ini?
この ほんは ごひゃくえんです。|ごひゃくえん|Buku ini harganya lima ratus yen.
その かばんは さんぜんえんです。|さんぜんえん|Tas itu harganya tiga ribu yen.`,
["Informasi apa yang diminta dengan いくら pada pertanyaan tentang pena?","Harga pena.","Pemilik pena.","Jumlah pena."],
["Anda belum mengetahui harga buku. Lengkapi pertanyaan tentang harganya.","この ほんは ＿＿＿ですか。","Berapa harga buku ini?","いくら","なんじ","なんさい"],
"Kartu toko: かばん (tas) harganya belum diketahui. Buat satu pertanyaan sopan untuk menanyakan harga tas dengan いくら.");

support(5,1,`
いま、よじです。|よじ|Sekarang pukul empat.
いま、しちじはんです。|しちじはん|Sekarang pukul setengah delapan.
いま、くじじゅっぷんです。|くじじゅっぷん|Sekarang pukul sembilan lewat sepuluh menit.`,
["Pukul berapa yang dinyatakan oleh しちじはん?","07.30","06.30","07.15"],
["Jam menunjukkan 04.00. Pilih bacaan jam yang sesuai.","いま、＿＿＿です。","Sekarang pukul empat.","よじ","よんじ","しじ"],
"Kartu jam: sekarang 09.30. Buat satu kalimat menggunakan いま dan bacaan jam tersebut.");

support(5,2,`
じゅぎょうは くじから じゅうじまでです。|から|Pelajaran dari pukul sembilan sampai sepuluh.
やすみは じゅうじから じゅうじはんまでです。|まで|Istirahat dari pukul sepuluh sampai setengah sebelas.
しごとは はちじから ごじまでです。|から|Jam kerja dari pukul delapan sampai lima.`,
["Pada くじからじゅうじまで, apa fungsi から?","Menandai waktu mulai pukul sembilan.","Menandai waktu selesai pukul sembilan.","Menyebut lama kegiatan sembilan jam."],
["Jadwal: mulai 09.00 dan selesai 10.00. Lengkapi penanda waktu selesai.","くじから じゅうじ＿＿＿です。","Dari pukul sembilan sampai sepuluh.","まで","から","の"],
"Jadwal: pelajaran mulai 08.00 dan selesai 10.30. Buat satu kalimat dengan から dan まで untuk menyampaikan rentang waktunya.");

support(5,3,`
おいくつですか。|おいくつ|Berapa usia Anda?
わたしは はたちです。|はたち|Saya berusia dua puluh tahun.
いもうとは はっさいです。|はっさい|Adik perempuan saya berusia delapan tahun.`,
["Berapa usia yang dinyatakan oleh はたち?","20 tahun","8 tahun","19 tahun"],
["Kartu usia: 20 tahun. Lengkapi jawaban dengan bacaan usia yang lazim.","わたしは ＿＿＿です。","Saya berusia dua puluh tahun.","はたち","はっさい","じゅっさい"],
"Kartu peran: Anda berusia 20 tahun. Buat satu kalimat sopan untuk menyebut usia memakai はたち.");

support(6,0,`
この おちゃは あついです。|あついです|Teh ini panas.
この ほんは おもしろいです。|おもしろいです|Buku ini menarik.
この かばんは おおきいです。|おおきいです|Tas ini besar.`,
["Sifat apa yang disampaikan oleh このおちゃはあついです?","Tehnya panas.","Tehnya mahal.","Tehnya dingin."],
["Kartu rasa: kue ini enak. Lengkapi pernyataan sopan dengan おいしい.","この ケーキは ＿＿＿。","Kue ini enak.","おいしいです","おいしです","おいしいだです"],
"Kartu: かばん (tas) ini おおきい (besar). Buat satu kalimat sopan untuk menyatakan sifat tas.");

support(6,1,`
この ほんは たかくないです。|たかくないです|Buku ini tidak mahal.
この ケーキは あまくないです。|あまくないです|Kue ini tidak manis.
きょうの てんきは よくないです。|よくないです|Cuaca hari ini tidak baik.`,
["Informasi apa yang diberikan oleh たかくないです tentang harga buku?","Buku tidak mahal.","Buku tidak menarik.","Buku mahal."],
["Cuaca hari ini tidak baik. Lengkapi bentuk negatif dari いい.","きょうの てんきは ＿＿＿。","Cuaca hari ini tidak baik.","よくないです","いくないです","いいじゃありません"],
"Kartu: ケーキ (kue) ini tidak あまい (manis). Buat satu kalimat dengan bentuk negatif kata sifat い.");

support(6,2,`
きのうは あつかったです。|あつかったです|Kemarin panas.
きのうの りょうりは おいしかったです。|おいしかったです|Masakan kemarin enak.
きのうの てんきは よかったです。|よかったです|Cuaca kemarin baik.`,
["Kapan keadaan panas itu berlaku dalam きのうはあつかったです?","Kemarin.","Besok.","Setiap hari."],
["Cuaca kemarin baik. Lengkapi bentuk lampau dari いい.","きのうの てんきは ＿＿＿。","Cuaca kemarin baik.","よかったです","いいでした","よくないです"],
"Kartu pengalaman: makanan kemarin おいしい (enak). Buat satu kalimat yang menilai makanan kemarin dengan bentuk lampau kata sifat い.");

support(6,3,`
きのうは いそがしくなかったです。|いそがしくなかったです|Kemarin saya tidak sibuk.
きのうの りょうりは からくなかったです。|からくなかったです|Masakan kemarin tidak pedas.
きのうの てんきは よくなかったです。|よくなかったです|Cuaca kemarin tidak baik.`,
["Apa makna negatif lampau いそがしくなかったです?","Pada waktu itu tidak sibuk.","Sekarang tidak sibuk.","Pada waktu itu sangat sibuk."],
["Masakan kemarin tidak pedas. Lengkapi bentuk negatif lampau dari からい.","きのうの りょうりは ＿＿＿。","Masakan kemarin tidak pedas.","からくなかったです","からくないです","からかったです"],
"Kartu pengalaman: cuaca kemarin tidak baik, いい. Buat satu kalimat dengan bentuk negatif lampau yang sesuai.");

support(6,4,`
これは あたらしい ほんです。|あたらしい|Ini buku baru.
あれは おおきい かばんです。|おおきい|Itu tas besar.
これは おいしい りょうりです。|おいしい|Ini masakan yang enak.`,
["Dalam あたらしいほん, kata あたらしい menerangkan apa?","Buku.","Pemilik buku.","Bahasa buku."],
["Anda ingin menyebut sebuah tas besar. Lengkapi kata yang langsung menerangkan かばん.","＿＿＿ かばんです。","Ini tas besar.","おおきい","おおきいです","おおきいの"],
"Kartu: ほん (buku) ini あたらしい (baru). Buat satu kalimat yang memakai frasa あたらしい + kata benda.");

support(6,5,`
きょうは とても あついです。|とても|Hari ini sangat panas.
この ケーキは とても おいしいです。|とても|Kue ini sangat enak.
この かばんは とても おおきいです。|とても|Tas ini sangat besar.`,
["Apa yang ditambahkan oleh とても pada このケーキはとてもあまいです?","Tingkat rasa enaknya sangat tinggi.","Kue hanya dimakan kadang-kadang.","Kue tidak enak."],
["Kue ini sangat enak. Lengkapi penanda tingkat yang sesuai.","この ケーキは ＿＿＿ おいしいです。","Kue ini sangat enak.","とても","あまり","です"],
"Kartu: cuaca hari ini sangat あつい (panas). Buat satu kalimat sopan yang menekankan tingkat sifat menggunakan とても.");

support(6,6,`
この ほんは あまり たかくないです。|あまり|Buku ini tidak terlalu mahal.
この りょうりは あまり からくないです。|あまり|Masakan ini tidak terlalu pedas.
きのうは あまり いそがしくなかったです。|あまり|Kemarin saya tidak terlalu sibuk.`,
["Apa arti あまりたかくないです pada harga buku?","Tidak terlalu mahal.","Sangat mahal.","Tidak terlalu menarik."],
["Anda ingin mengatakan masakan ini tidak terlalu pedas. Pilih akhir yang cocok dengan あまり.","この りょうりは あまり ＿＿＿。","Masakan ini tidak terlalu pedas.","からくないです","からいです","からかったです"],
"Kartu: ほん (buku) ini tidak terlalu たかい (mahal). Buat satu kalimat memakai あまり dan bentuk negatif.");

support(6,7,`
この りょうりは どうですか。|どうですか|Bagaimana masakan ini?
にほんごは どうですか。|どうですか|Bagaimana bahasa Jepang menurut Anda?
きのうの りょうりは どうでしたか。|どうでしたか|Bagaimana masakan kemarin?`,
["Informasi apa yang diminta oleh どうですか dalam pertanyaan tentang masakan?","Pendapat atau kesan tentang masakan.","Harga masakan.","Pemilik masakan."],
["Anda meminta pendapat teman tentang buku ini. Lengkapi pertanyaan.","この ほんは ＿＿＿。","Bagaimana buku ini menurut Anda?","どうですか","いくらですか","だれですか"],
"Situasi: teman sudah mencoba りょうり (masakan). Buat satu pertanyaan dengan どうですか untuk meminta kesannya.");

support(7,0,`
この まちは しずかです。|しずかです|Kota ini tenang.
この へやは きれいです。|きれいです|Kamar ini bersih.
アンナさんは げんきです。|げんきです|Anna sehat dan bersemangat.`,
["Pada このへやはきれいです, bagian mana yang menyatakan sifat kamar?","きれいです","このへや","は"],
["Kartu kamar: bersih. Lengkapi pernyataan dengan きれい.","この へやは ＿＿＿。","Kamar ini bersih.","きれいです","きれいなです","きれいくです"],
"Kartu: このまち (kota ini) → しずか (tenang). Tulis satu kalimat sopan yang menyatakan sifat kota ini.");

support(7,1,`
しずかな まちです。|しずかな まち|Kota yang tenang. (Menjelaskan kota yang sedang dibicarakan.)
これは べんりな かばんです。|べんりな かばん|Ini tas yang praktis.
たなかさんは しんせつな せんせいです。|しんせつな せんせい|Tanaka adalah guru yang baik hati.`,
["Dalam しずかなまち, kata sifat menerangkan apa?","Kota.","Guru.","Tas."],
["Gabungkan しずか dengan kata benda へや.","＿＿＿ へやです。","Kamar yang tenang.","しずかな","しずか","しずかに"],
"Kartu: たなかさん = せんせい (guru), しんせつ (baik hati). Perkenalkan Tanaka dalam satu kalimat memakai しんせつな + kata benda.");

support(7,2,`
この まちは しずかじゃありません。|しずかじゃありません|Kota ini tidak tenang.
この へやは きれいじゃありません。|きれいじゃありません|Kamar ini tidak bersih.
この かばんは べんりじゃありません。|べんりじゃありません|Tas ini tidak praktis.`,
["Apa informasi dalam このまちはしずかじゃありません?","Kota ini tidak tenang.","Kota ini tenang.","Kota ini dahulu tenang."],
["Kartu: kamar ini tidak bersih. Gunakan bentuk negatif きれい.","この へやは ＿＿＿。","Kamar ini tidak bersih.","きれいじゃありません","きれくないです","きれいです"],
"Kartu: このかばん (tas ini) tidak べんり (praktis). Tulis satu kalimat negatif sopan.");

support(7,3,`
わたしは にほんごが すきです。|にほんごが すきです|Saya suka bahasa Jepang.
アンナさんは うたが じょうずです。|うたが じょうずです|Anna pandai menyanyi.
わたしは りょうりが へたです。|りょうりが へたです|Saya kurang pandai memasak.`,
["Anna suka memasak tetapi kemampuannya belum diketahui. Kalimat mana hanya menyatakan kesukaannya?","アンナさんは りょうりが すきです。","アンナさんは りょうりが じょうずです。","アンナさんは りょうりが へたです。"],
["Anda suka bahasa Jepang. Lengkapi partikel sebelum すきです.","わたしは にほんご＿＿＿ すきです。","Saya suka bahasa Jepang.","が","の","へ"],
"Kartu: あなた suka にほんご (bahasa Jepang). Tulis satu kalimat dengan がすきです; tidak perlu menyatakan kemampuan.");

support(7,4,`
この へやは しずかで、きれいです。|しずかで|Kamar ini tenang dan bersih.
この かばんは やすくて、べんりです。|やすくて|Tas ini murah dan praktis.
この りょうりは おいしくて、やすいです。|おいしくて|Masakan ini enak dan murah.`,
["Pada このへやはしずかで、きれいです, dua sifat kamar yang disebut adalah…","Tenang dan bersih.","Murah dan praktis.","Enak dan murah."],
["Gabungkan やすい (murah) dengan べんりです (praktis).","この かばんは ＿＿＿、べんりです。","Tas ini murah dan praktis.","やすくて","やすいで","やすなで"],
"Kartu kamar: しずか (tenang) + きれい (bersih). Gabungkan kedua sifat menjadi satu kalimat menggunakan で.");

support(7,5,`
きのうは ひまでした。|ひまでした|Kemarin saya senggang.
きのう、この まちは しずかでした。|しずかでした|Kota itu tenang kemarin.
きのう、この へやは きれいじゃありませんでした。|きれいじゃありませんでした|Kamar itu tidak bersih kemarin.`,
["Kalimat きのうはひまでした menyatakan kondisi kapan?","Kemarin.","Sekarang.","Besok."],
["Kartu: kamar kemarin tidak bersih. Pilih bentuk negatif lampau.","きのう、この へやは ＿＿＿。","Kamar itu tidak bersih kemarin.","きれいじゃありませんでした","きれいでした","きれいじゃありません"],
"Kartu: きのう (kemarin) → ひま (senggang). Tulis satu kalimat positif lampau.");

support(8,0,`
へやに つくえが あります。|つくえが あります|Di kamar ada meja.
きょうしつに せんせいが います。|せんせいが います|Di kelas ada guru.
いすの したに ねこが います。|ねこが います|Di bawah kursi ada kucing.`,
["Pada へやにつくえがあります, informasi baru yang diperkenalkan adalah…","Ada meja di kamar.","Meja itu milik guru.","Kamar itu tidak bersih."],
["Di dalam kelas ada seorang guru. Lengkapi kata kerja keberadaan.","きょうしつに せんせいが ＿＿＿。","Di kelas ada guru.","います","あります","です"],
"Kartu lokasi: へや (kamar) berisi つくえ (meja). Tulis satu kalimat yang memperkenalkan keberadaan meja dengan に dan が.");

support(8,1,`
ほんは つくえの うえに あります。|ほんは|Buku itu ada di atas meja.
せんせいは きょうしつに います。|せんせいは|Guru itu ada di kelas.
ねこは いすの したに います。|ねこは|Kucing itu ada di bawah kursi.`,
["Teman sudah mengetahui buku yang dicari. ほんはつくえのうえにあります memberi tahu…","Lokasi buku tersebut.","Pemilik buku tersebut.","Harga buku tersebut."],
["Guru yang dicari berada di kelas. Lengkapi kalimat tentang lokasinya.","せんせいは きょうしつ＿＿＿ います。","Guru ada di kelas.","に","が","の"],
"Teman mencari ほん (buku) yang sudah kalian bicarakan. Lokasinya つくえのうえ (di atas meja). Tulis satu kalimat dengan は untuk memberi lokasinya.");

support(8,2,`
ここは きょうしつです。|ここ|Di sini ruang kelas. (Pembicara berada di tempat ini.)
そこは としょかんです。|そこ|Di situ perpustakaan. (Tempat dekat lawan bicara.)
あそこは ぎんこうです。|あそこ|Di sana bank. (Tempat jauh dari kedua penutur.)`,
["Pembicara dan pendengar sama-sama jauh dari bank yang ditunjuk. Kata penunjuk tempat mana yang cocok?","あそこ","ここ","そこ"],
["Anda berdiri di dalam kelas dan menjelaskan tempat Anda berada.","＿＿＿は きょうしつです。","Di sini ruang kelas.","ここ","そこ","あそこ"],
"Anda dan teman berdiri jauh dari ぎんこう (bank) yang ditunjuk. Tulis satu kalimat memakai あそこ.");

support(8,3,`
こちらは きょうしつです。|こちら|Di sebelah sini ruang kelas. (Petugas menunjuk area dekat dirinya.)
そちらは としょかんです。|そちら|Di sebelah situ perpustakaan. (Area dekat pengunjung.)
あちらは ぎんこうです。|あちら|Di sebelah sana bank. (Area jauh dari petugas dan pengunjung.)`,
["Petugas menunjuk bank yang jauh dari dirinya dan pengunjung. Pilihan sopan yang sesuai adalah…","あちらは ぎんこうです。","こちらは ぎんこうです。","そちらは ぎんこうです。"],
["Petugas berada di dekat ruang kelas; pengunjung berada lebih jauh. Lengkapi petunjuk sopan dari petugas.","＿＿＿は きょうしつです。","Di sebelah sini ruang kelas.","こちら","そちら","あちら"],
"Sebagai petugas, tunjukkan としょかん (perpustakaan) yang berada jauh dari Anda dan pengunjung. Tulis satu kalimat memakai あちら.");

support(8,4,`
トイレは あそこです。|あそこです|Toilet ada di sana. (Jauh dari kedua penutur.)
きょうしつは ここです。|ここです|Ruang kelas ada di sini.
としょかんは そこです。|そこです|Perpustakaan ada di situ. (Dekat lawan bicara.)`,
["Dalam トイレはあそこです, penutur sedang menjelaskan…","Lokasi toilet.","Sifat toilet.","Pemilik toilet."],
["Teman mencari toilet. Lokasinya jauh dari Anda berdua. Lengkapi jawaban lokasi singkat.","トイレは ＿＿＿です。","Toilet ada di sana.","あそこ","あれ","あの"],
"Kartu: きょうしつ (ruang kelas) berada di tempat Anda sekarang. Tulis satu jawaban lokasi memakai ここです.");

support(8,5,`
どこに ぎんこうが ありますか。|どこに|Di mana ada bank?
どこに トイレが ありますか。|どこに|Di mana ada toilet?
どこに せんせいが いますか。|どこに|Di mana ada guru?`,
["どこにぎんこうがありますか meminta informasi tentang…","Tempat yang memiliki bank.","Harga layanan bank.","Nama pemilik bank."],
["Anda mencari tempat yang memiliki toilet. Lengkapi kata tanya lokasi.","＿＿＿に トイレが ありますか。","Di mana ada toilet?","どこ","だれ","いくら"],
"Anda mencari ぎんこう (bank). Tulis satu pertanyaan dengan どこに〜がありますか.");

support(8,6,`
トイレは どこですか。|どこ|Toilet di mana?
きょうしつは どこですか。|どこ|Ruang kelas di mana?
としょかんは どちらですか。|どちら|Perpustakaan di sebelah mana? (Pertanyaan sopan.)`,
["Petugas ditanya としょかんはどちらですか. Jawaban apa yang memberikan informasi yang diminta?","あちらです。","ごひゃくえんです。","わたしのです。"],
["Anda menanyakan lokasi perpustakaan dengan pilihan kata yang lebih sopan.","としょかんは ＿＿＿ですか。","Perpustakaan di sebelah mana?","どちら","どれ","だれ"],
"Tanyakan lokasi トイレ (toilet) kepada petugas dalam satu kalimat memakai どちら.");

support(8,7,`
ほんは つくえの うえに あります。|つくえの うえ|Buku ada di atas meja.
ねこは いすの したに います。|いすの した|Kucing ada di bawah kursi.
ぎんこうは がっこうの となりに あります。|がっこうの となり|Bank ada di sebelah sekolah.`,
["Pada つくえのうえ, benda yang menjadi patokan posisi adalah…","Meja.","Buku.","Kursi."],
["Kartu lokasi: buku tepat di atas meja. Lengkapi hubungan kata benda dan posisi.","ほんは つくえ＿＿＿ うえに あります。","Buku ada di atas meja.","の","が","も"],
"Kartu lokasi: ねこ (kucing) berada di bawah いす (kursi). Tulis satu kalimat memakai いすのした.");

support(9,0,`
わたしは がっこうへ いきます。|がっこうへ いきます|Saya pergi ke sekolah.
あした、ハディさんは ここへ きます。|ここへ きます|Besok Hadi datang ke sini, ke tempat pembicara.
わたしは うちへ かえります。|うちへ かえります|Saya pulang ke rumah.`,
["Pembicara sedang di sekolah. Hadi akan bergerak menuju tempat pembicara besok. Kalimat yang sesuai adalah…","ハディさんは ここへ きます。","ハディさんは うちへ かえります。","ハディさんは ここに います。"],
["Anda selesai di sekolah dan kembali ke rumah sendiri. Pilih kata kerja yang menyatakan pulang.","わたしは うちへ ＿＿＿。","Saya pulang ke rumah.","かえります","きます","あります"],
"Anda sedang di rumah dan akan pergi ke がっこう (sekolah). Tulis satu kalimat memakai へいきます.");

support(9,1,`
わたしは バスで がっこうへ いきます。|バスで|Saya pergi ke sekolah dengan bus.
ハディさんは でんしゃで ここへ きます。|でんしゃで|Hadi datang ke sini dengan kereta.
わたしは タクシーで うちへ かえります。|タクシーで|Saya pulang ke rumah dengan taksi.`,
["Pada バスでがっこうへいきます, apa fungsi バスで?","Menjelaskan kendaraan yang digunakan.","Menjelaskan tujuan perjalanan.","Menjelaskan teman perjalanan."],
["Kartu perjalanan: kendaraan bus, tujuan sekolah. Isi partikel setelah kendaraan.","バス＿＿＿ がっこうへ いきます。","Saya pergi ke sekolah dengan bus.","で","へ","の"],
"Kartu: Anda pulang ke うち (rumah) dengan タクシー (taksi). Tulis satu kalimat yang menyebut kendaraan dan tujuan.");

support(9,2,`
がっこうへ じてんしゃで いきます。|じてんしゃで|Saya pergi ke sekolah dengan sepeda.
ぎんこうへ バスで いきます。|バスで|Saya pergi ke bank dengan bus.
えきへ タクシーで いきます。|タクシーで|Saya pergi ke stasiun dengan taksi.`,
["Kartu menyatakan perjalanan ke bank memakai bus. Kalimat mana sesuai?","ぎんこうへ バスで いきます。","ぎんこうへ タクシーで いきます。","がっこうへ バスで いきます。"],
["Kartu perjalanan ke stasiun: kendaraan taksi. Lengkapi kendaraan yang digunakan.","えきへ ＿＿＿で いきます。","Saya pergi ke stasiun dengan taksi.","タクシー","バス","じてんしゃ"],
"Kartu: tujuan がっこう (sekolah), kendaraan じてんしゃ (sepeda). Tulis satu kalimat dengan でいきます.");

support(9,3,`
うちから がっこうまで バスで いきます。|うちから がっこうまで|Saya pergi dari rumah sampai sekolah dengan bus.
えきから ぎんこうまで タクシーで いきます。|えきから ぎんこうまで|Saya pergi dari stasiun sampai bank dengan taksi.
がっこうから うちまで じてんしゃで かえります。|がっこうから うちまで|Saya pulang dari sekolah sampai rumah dengan sepeda.`,
["Pada えきからぎんこうまで, perjalanan dimulai dari mana?","Stasiun.","Bank.","Rumah."],
["Rute dimulai di rumah dan berakhir di sekolah. Lengkapi penanda titik awal.","うち＿＿＿ がっこうまで バスで いきます。","Saya pergi dari rumah sampai sekolah dengan bus.","から","まで","の"],
"Kartu rute: mulai えき (stasiun), selesai ぎんこう (bank), memakai タクシー. Tulis satu kalimat dengan から dan まで.");

support(9,4,`
いつ がっこうへ いきますか。|いつ|Kapan Anda pergi ke sekolah?
あした、どこへ いきますか。|どこへ|Besok Anda pergi ke mana?
だれと がっこうへ いきますか。|だれと|Anda pergi ke sekolah bersama siapa?`,
["Jawaban ともだちといきます menjawab pertanyaan tentang…","Teman perjalanan.","Waktu perjalanan.","Kendaraan perjalanan."],
["Anda tahu teman akan ke sekolah. Anda ingin tahu siapa yang pergi bersamanya.","＿＿＿ がっこうへ いきますか。","Anda pergi ke sekolah bersama siapa?","だれと","どこへ","いつ"],
"Teman mengatakan あした、いきます (besok pergi), tetapi tujuannya belum diketahui. Tulis satu pertanyaan memakai どこへ.");

support(10,0,`
わたしは パンを たべます。|パンを たべます|Saya makan roti.
わたしは みずを のみます。|みずを のみます|Saya minum air.
ハディさんは ほんを よみます。|ほんを よみます|Hadi membaca buku.`,
["Pada ほんをよみます, benda yang dibaca adalah…","Buku.","Air.","Roti."],
["Anda minum air. Lengkapi partikel penanda benda yang diminum.","わたしは みず＿＿＿ のみます。","Saya minum air.","を","へ","から"],
"Kartu kegiatan: Anda membaca ほん (buku). Tulis satu kalimat memakai を dan よみます.");

support(10,1,`
わたしは コーヒーを のみません。|のみません|Saya tidak minum kopi.
きょうは テレビを みません。|みません|Hari ini saya tidak menonton televisi.
あしたは がっこうへ いきません。|いきません|Besok saya tidak pergi ke sekolah.`,
["Pada コーヒーをのみません, apakah pembicara mengatakan akan minum kopi?","Tidak, ia menyatakan tidak minum kopi.","Ya, ia menyatakan minum kopi.","Ia menanyakan harga kopi."],
["Rencana hari ini: tidak menonton televisi. Lengkapi bentuk negatif sopan.","きょうは テレビを ＿＿＿。","Hari ini saya tidak menonton televisi.","みません","みます","みました"],
"Kartu: Anda tidak minum コーヒー (kopi). Tulis satu kalimat memakai のみません.");

support(10,2,`
きのう、ほんを よみました。|よみました|Kemarin saya membaca buku.
けさ、パンを たべました。|たべました|Tadi pagi saya makan roti.
きのう、がっこうへ いきました。|いきました|Kemarin saya pergi ke sekolah.`,
["きのう、ほんをよみました melaporkan kegiatan yang…","Sudah dilakukan kemarin.","Tidak dilakukan kemarin.","Akan dilakukan besok."],
["Catatan tadi pagi: sarapan roti sudah dilakukan.","けさ、パンを ＿＿＿。","Tadi pagi saya makan roti.","たべました","たべませんでした","たべます"],
"Catatan kemarin: Anda membaca ほん (buku). Laporkan kegiatan itu dalam satu kalimat dengan よみました.");

support(10,3,`
きのう、テレビを みませんでした。|みませんでした|Kemarin saya tidak menonton televisi.
けさ、コーヒーを のみませんでした。|のみませんでした|Tadi pagi saya tidak minum kopi.
きのう、がっこうへ いきませんでした。|いきませんでした|Kemarin saya tidak pergi ke sekolah.`,
["きのう、テレビをみませんでした berarti…","Kemarin tidak menonton televisi.","Kemarin menonton televisi.","Besok tidak menonton televisi."],
["Catatan kemarin: tidak pergi ke sekolah. Pilih bentuk negatif lampau.","きのう、がっこうへ ＿＿＿。","Kemarin saya tidak pergi ke sekolah.","いきませんでした","いきました","いきません"],
"Catatan tadi pagi: Anda tidak minum コーヒー (kopi). Tulis satu kalimat negatif lampau dengan のみませんでした.");

support(10,4,`
まいにち、にほんごを べんきょうします。|まいにち|Saya belajar bahasa Jepang setiap hari.
いつも バスで がっこうへ いきます。|いつも|Saya selalu pergi ke sekolah dengan bus.
ときどき、テレビを みます。|ときどき|Saya kadang-kadang menonton televisi.`,
["Catatan menunjukkan belajar bahasa Jepang dilakukan setiap hari. Kata mana yang menyatakan setiap hari?","まいにち","ときどき","きのう"],
["Anda hanya sesekali menonton televisi, bukan setiap hari. Lengkapi frekuensinya.","＿＿＿、テレビを みます。","Saya kadang-kadang menonton televisi.","ときどき","まいにち","いつも"],
"Kartu kebiasaan: Anda belajar にほんご (bahasa Jepang) setiap hari. Tulis satu kalimat memakai まいにち dan べんきょうします.");

support(10,5,`
よく ほんを よみます。|よく|Saya sering membaca buku.
よく としょかんへ いきます。|よく|Saya sering pergi ke perpustakaan.
テレビを ぜんぜん みません。|ぜんぜん みません|Saya sama sekali tidak menonton televisi.`,
["テレビをぜんぜんみません menunjukkan kebiasaan apa?","Sama sekali tidak menonton televisi.","Sering menonton televisi.","Kadang-kadang menonton televisi."],
["Anda sama sekali tidak minum kopi. Lengkapi kata kerja yang cocok dengan ぜんぜん.","コーヒーを ぜんぜん ＿＿＿。","Saya sama sekali tidak minum kopi.","のみません","のみます","のみました"],
"Kartu kebiasaan: Anda sering membaca ほん (buku). Tulis satu kalimat memakai よく dan よみます.");

support(11,0,`
りんごを みっつ かいます。|みっつ|Saya membeli tiga apel.
きってを ごまい かいます。|ごまい|Saya membeli lima perangko.
みずを にはい のみます。|にはい|Saya minum dua gelas air.`,
["きってをごまいかいます menyatakan pembelian apa?","Lima lembar perangko.","Tiga buah apel.","Dua gelas air."],
["Pesanan: tiga buah apel. Gunakan hitungan umum つ.","りんごを ＿＿＿ かいます。","Saya membeli tiga apel.","みっつ","ふたつ","よっつ"],
"Pesanan: きって (perangko) lima lembar. Tulis satu kalimat dengan ごまい dan かいます.");

support(11,1,`
きょうしつに がくせいが ふたり います。|ふたり|Di kelas ada dua pelajar.
つくえの うえに ほんが さんさつ あります。|さんさつ|Di atas meja ada tiga buku.
いすが よっつ あります。|よっつ|Ada empat kursi.`,
["がくせいがふたりいます menyatakan jumlah berapa orang?","Dua orang.","Satu orang.","Empat orang."],
["Kartu kelas: ada dua pelajar. Pilih hitungan orang.","きょうしつに がくせいが ＿＿＿ います。","Di kelas ada dua pelajar.","ふたり","ひとり","さんにん"],
"Kartu: di atas つくえ (meja) ada ほん (buku) sebanyak tiga jilid. Tulis satu kalimat memakai さんさつあります.");

support(11,2,`
りんごは いくつ ありますか。|いくつ|Ada berapa buah apel?
がくせいは なんにん いますか。|なんにん|Ada berapa orang pelajar?
きっては なんまい ありますか。|なんまい|Ada berapa lembar perangko?`,
["Pertanyaan がくせいはなんにんいますか meminta jumlah dalam satuan apa?","Orang.","Lembar.","Jilid."],
["Anda menanyakan jumlah pelajar dalam kelas. Lengkapi kata tanya untuk orang.","がくせいは ＿＿＿ いますか。","Ada berapa orang pelajar?","なんにん","なんまい","なんさつ"],
"Anda perlu tahu jumlah きって (perangko) dalam satuan lembar. Tulis satu pertanyaan memakai なんまいありますか.");

support(11,3,`
りんごが ひとつ あります。|ひとつ|Ada satu buah apel.
パンを ふたつ かいます。|ふたつ|Saya membeli dua buah roti.
いすが よっつ あります。|よっつ|Ada empat kursi.`,
["Dalam sistem hitungan umum つ, みっつ berarti…","Tiga buah.","Dua buah.","Empat buah."],
["Gunakan hitungan umum つ untuk dua buah roti.","パンを ＿＿＿ かいます。","Saya membeli dua buah roti.","ふたつ","ひとつ","みっつ"],
"Kartu: terdapat empat いす (kursi). Tulis satu kalimat memakai hitungan umum よっつ dan あります.");
