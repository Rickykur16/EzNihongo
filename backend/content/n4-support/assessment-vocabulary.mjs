// Six explicitly authored questions per chapter. Reading/lexical support is
// mapped to a chapter goal; it does not replace the separate grammar questions.
import fs from 'node:fs';
const vocabulary=JSON.parse(fs.readFileSync(new URL('./vocabulary-examples.json',import.meta.url),'utf8')).items;
const sourceIds=new Map(vocabulary.map(w=>[`${w.chapter}:${w.japanese}`,w.id]));
const result=[];
let rotation=0;
function add(chapter,tuples){
  if(tuples.length!==6)throw Error(`Chapter ${chapter} needs six questions`);
  const questions=tuples.map(([word,goal,prompt,answer,wrong1,wrong2,explanation])=>{
    const sourceVocabularyId=sourceIds.get(`${chapter}:${word}`);
    if(!sourceVocabularyId)throw Error(`Unknown vocabulary ${chapter}:${word}`);
    const options=[wrong1,wrong2];options.splice(rotation++%3,0,answer);
    if(new Set(options).size!==3)throw Error('Duplicate answer option');
    return {prompt,options,answer,explanation,goal,sourceVocabularyId};
  });
  result.push({chapter,questions});
}
add(1,[
 ['道具',1,'Bagaimana bacaan 道具 dalam りょうりに つかう 道具?', 'どうぐ','とうぐ','どうく','道具 dibaca どうぐ, berarti alat atau perkakas.'],
 ['絹',2,'Bagaimana bacaan 絹 dalam 絹の きもの?', 'きぬ','もめん','きの','絹 dibaca きぬ dan berarti sutra; もめん adalah 木綿, katun.'],
 ['作品',1,'これは あねが つくった 作品です。Apa arti 作品 di sini?', 'Karya yang dibuat kakak.','Alat milik kakak.','Judul yang dipilih kakak.','作品 berarti karya; あねがつくった menerangkan siapa yang membuatnya.'],
 ['集める',2,'しゅみは きってを 集めることです。Apa hobinya?', 'Mengumpulkan perangko.','Mengirim perangko.','Menghitung harga perangko.','集める berarti mengumpulkan; こと menjadikan kegiatan itu nama hobi.'],
 ['選ぶ',3,'Anda mengambil tas merah dari dua pilihan. Lengkapi: あかいのを（　）。','えらびました','かざりました','うつしました','選ぶ berarti memilih; あかいの menggantikan tas merah yang sudah diketahui.'],
 ['飾る',1,'Manakah kalimat yang berarti menghias ruangan dengan bunga?', 'へやに はなを かざります。','へやで はなを うつします。','へやで はなを あつめます。','はなをかざる berarti menaruh bunga sebagai hiasan; 写す memotret dan 集める mengumpulkan.'],
]);
add(2,[
 ['理由',1,'Bagaimana bacaan 理由 dalam やすんだ 理由?', 'りゆう','りょう','じゆう','理由 dibaca りゆう dan berarti alasan.'],
 ['意見',2,'Bagaimana bacaan 意見 dalam あなたの 意見を ききたいです?', 'いけん','いみ','いげん','意見 dibaca いけん, berarti pendapat.'],
 ['実は',1,'実は、きょうは たんじょうびなんです。Apa fungsi 実は?', 'Membuka informasi sebenarnya.','Menunjukkan waktu selesai.','Menyatakan pilihan pengganti.','実は berarti sebenarnya; pembicara membuka latar keadaan.'],
 ['伝える',2,'かいぎの じかんを みなさんに 伝えました。Apa yang dilakukan?', 'Menyampaikan waktu rapat.','Mengubah waktu rapat.','Melupakan waktu rapat.','伝える berarti menyampaikan informasi kepada orang lain.'],
 ['確かめる',2,'Jadwal tertulis pukul sembilan, tetapi Anda ingin memastikannya lagi. Kata mana paling tepat?', 'たしかめる','かざる','あつめる','確かめる berarti memeriksa untuk memastikan kebenaran.'],
 ['辞典',3,'これは「さくら」という 辞典です。辞典 adalah benda apa?', 'Kamus.','Novel.','Laporan.','辞典 berarti kamus; さくらという memperkenalkan namanya.'],
]);
add(3,[
 ['途中',1,'Bagaimana bacaan 途中 dalam がっこうへ いく 途中?', 'とちゅう','とじゅう','とちょう','途中 dibaca とちゅう, berarti di tengah perjalanan atau kegiatan.'],
 ['再来週',2,'Bagaimana bacaan 再来週?', 'さらいしゅう','さいらいしゅう','せんらいしゅう','再来週 dibaca さらいしゅう, dua minggu lagi.'],
 ['間に合う',2,'はちじの でんしゃに 間に合いました。Apa yang terjadi?', 'Sempat naik kereta pukul delapan.','Tertinggal kereta pukul delapan.','Kereta pukul delapan dibatalkan.','間に合う berarti tiba atau selesai tepat waktu untuk sesuatu.'],
 ['昼休み',1,'昼休みに ごはんを たべます。Kapan makan dilakukan?', 'Saat istirahat siang.','Saat tengah malam.','Saat liburan musim panas.','昼休み berarti istirahat siang.'],
 ['先に',1,'Teman masih belajar, sedangkan Anda pulang lebih dahulu. Pilih kalimatnya.', 'わたしは さきに かえります。','わたしは さいごに かえります。','わたしは どうじに かえります。','先に menyatakan lebih dahulu; 最後 berarti terakhir dan 同時に pada saat yang sama.'],
 ['続ける',3,'ごはんを たべた あとで、べんきょうを 続けます。Apa tindakan setelah makan?', 'Melanjutkan belajar.','Berhenti belajar sepenuhnya.','Memilih buku untuk pertama kali.','続ける berarti melanjutkan kegiatan.'],
]);
add(4,[
 ['景色',2,'Bagaimana bacaan 景色 dalam まどから みえる 景色?', 'けしき','けいしょく','けじき','景色 dibaca けしき, berarti pemandangan.'],
 ['柔道',1,'Bagaimana bacaan 柔道?', 'じゅうどう','じゅどう','じゅうとう','柔道 dibaca じゅうどう, olahraga judo.'],
 ['声',3,'にわから こどもの 声が きこえます。Apa yang terdengar?', 'Suara anak-anak.','Aroma bunga.','Cahaya dari halaman.','声 dipakai untuk suara manusia atau hewan.'],
 ['見える',2,'まどから やまが 見えます。Apa makna 見えます?', 'Gunung terlihat dari jendela.','Gunung sedang dicari dari jendela.','Gunung baru ditemukan di jendela.','見える menyatakan sesuatu tertangkap penglihatan.'],
 ['できる',1,'Untuk menyatakan bisa menulis surat dalam bahasa Jepang, lengkapi: にほんごで てがみを かくことが（　）。','できます','きこえます','なります','ことができます menyatakan kemampuan melakukan kegiatan.'],
 ['吹く',3,'Kata yang tepat untuk angin bertiup: かぜが（　）。','ふいています','かんでいます','つっています','吹く berarti bertiup atau meniup; 噛む mengunyah dan 釣る memancing.'],
]);
add(5,[
 ['習慣',3,'Bagaimana bacaan 習慣 dalam あさ はしる 習慣?', 'しゅうかん','しゅかん','しゅうがん','習慣 dibaca しゅうかん, berarti kebiasaan.'],
 ['目標',1,'Bagaimana bacaan 目標?', 'もくひょう','もくびょう','めひょう','目標 dibaca もくひょう, berarti target atau sasaran.'],
 ['決める',2,'わたしが りょこうの ひを 決めました。Siapa yang menetapkan tanggal?', 'Pembicara sendiri.','Tanggalnya belum ditetapkan.','Tidak ada pelaku yang disebutkan.','わたしが adalah pelaku; 決める berarti menetapkan sesuatu.'],
 ['決まる',2,'りょこうの ひが 決まりました。Apa yang dijelaskan?', 'Tanggal perjalanan sudah pasti.','Tanggal perjalanan dibatalkan.','Seseorang lupa tanggal perjalanan.','決まる menyatakan hasil menjadi pasti; pelaku penetapan tidak disebutkan.'],
 ['できるだけ',3,'できるだけ にほんごで はなすように しています。Apa arti できるだけ?', 'Sebisa mungkin.','Tepat satu kali.','Tanpa pernah mencoba.','できるだけ menunjukkan usaha sampai batas kemampuan.'],
 ['ぜひ',1,'Manakah ajakan yang kuat dan ramah memakai ぜひ?', 'ぜひ うちへ きてください。','ぜひ かぎを なくしました。','ぜひ あめが ふっています。','ぜひ lazim menyertai harapan atau ajakan, seperti meminta seseorang berkunjung.'],
]);
add(6,[
 ['経験',1,'Bagaimana bacaan 経験?', 'けいけん','けけん','けいげん','経験 dibaca けいけん, berarti pengalaman.'],
 ['結果',3,'Bagaimana bacaan 結果 dalam しけんの 結果?', 'けっか','けつか','けっが','結果 dibaca けっか, berarti hasil.'],
 ['治る',3,'かぜが 治りました。Apa artinya?', 'Pileknya sembuh.','Jamnya diperbaiki.','Kuncinya ditemukan.','治る digunakan untuk pulih dari penyakit atau cedera.'],
 ['うっかり',2,'うっかり かぎを わすれてしまいました。Apa nuansa うっかり?', 'Tidak sengaja karena kurang perhatian.','Dengan rencana yang matang.','Dengan rasa puas setelah berhasil.','うっかり menandai kelalaian yang tidak disengaja.'],
 ['試す',1,'Anda ingin menguji pena baru sebelum membelinya. Kata yang paling sesuai?', 'ためす','にげる','すてる','試す berarti mencoba atau menguji; 逃げる kabur dan 捨てる membuang.'],
 ['直る',3,'Jam yang rusak kini bekerja lagi. Manakah kalimat yang tepat?', 'とけいが なおりました。','かぜを ひきました。','とけいを なくしました。','直る menyatakan benda menjadi baik kembali; dalam tulisan, bedakan dari 治る untuk penyakit.'],
]);
add(7,[
 ['並べる',1,'Bagaimana bacaan 並べる?', 'ならべる','ならぶる','なべる','並べる dibaca ならべる, menyusun benda berjajar.'],
 ['沸く',2,'Bagaimana bacaan 沸く dalam おゆが 沸く?', 'わく','はく','ふく','沸く dibaca わく, berarti mendidih.'],
 ['割れる',1,'コップが 割れました。Apa yang dijelaskan?', 'Gelas menjadi pecah.','Seseorang sedang mencuci gelas.','Gelas sudah diisi air.','割れる adalah verba intransitif untuk pecahnya benda.'],
 ['準備する',3,'あしたの しりょうを 準備しておきます。Apa tujuannya?', 'Menyiapkan dokumen untuk besok.','Membuang dokumen yang tidak diperlukan.','Mengubah isi dokumen tanpa tujuan.','準備する berarti mempersiapkan; ておく menunjukkan persiapan untuk nanti.'],
 ['乾く',2,'Handuk yang dicuci sekarang kering. Lengkapi: タオルが（　）。','かわきました','かわかしました','よごしました','乾く adalah perubahan menjadi kering; 乾かす adalah tindakan mengeringkan sesuatu.'],
 ['付く',2,'Manakah arti 付く pada シャツに ボタンが ついています?', 'Kancing terpasang pada kemeja.','Kancing menyala seperti lampu.','Kemeja sedang direbus.','付く berarti menempel atau terpasang; つく untuk lampu berarti menyala.'],
]);
add(8,[
 ['到着',3,'Bagaimana bacaan 到着?', 'とうちゃく','とうじゃく','とちゃく','到着 dibaca とうちゃく, berarti kedatangan.'],
 ['出発',3,'Bagaimana bacaan 出発?', 'しゅっぱつ','しゅつぱつ','しゅうはつ','出発 dibaca しゅっぱつ, berarti keberangkatan.'],
 ['増える',1,'この まちは ひとが 増えてきました。Bagaimana perubahan jumlah penduduk?', 'Bertambah.','Berkurang.','Tetap sama.','増える menyatakan jumlah bertambah; てくる menunjukkan perkembangan hingga sekarang.'],
 ['減らす',1,'コーヒーの さとうを 減らしました。Apa yang dilakukan?', 'Mengurangi gula.','Menambah gula.','Memindahkan cangkir.','減らす berarti sengaja mengurangi jumlah sesuatu.'],
 ['届く',3,'Surat yang dikirim teman baru tiba. Pilih kalimat yang tepat.', 'てがみが とどきました。','てがみを そだてました。','てがみが さがりました。','届く berarti mencapai tujuan atau tiba.'],
 ['だんだん',1,'だんだん はなせるように なりました。Bagaimana proses perubahannya?', 'Berangsur-angsur.','Tepat pada satu jam tertentu.','Tiba-tiba tanpa proses.','だんだん berarti sedikit demi sedikit atau berangsur-angsur.'],
]);
add(9,[
 ['高さ',3,'Bagaimana bacaan 高さ?', 'たかさ','たかいさ','こうさ','高さ dibaca たかさ, nomina yang menyatakan ketinggian.'],
 ['使い方',1,'Bagaimana bacaan 使い方?', 'つかいかた','つかうかた','しようほう','使い方 dibaca つかいかた, cara menggunakan.'],
 ['重い',2,'この はこは 重すぎて、もてません。Mengapa kotak tidak bisa dibawa?', 'Terlalu berat.','Terlalu ringan.','Terlalu dangkal.','重すぎる berarti terlalu berat.'],
 ['柔らかい',1,'この パンは 柔らかくて、たべやすいです。Bagaimana tekstur roti?', 'Lembut.','Keras.','Tipis seperti tali.','柔らかい berarti lunak atau lembut.'],
 ['適当',1,'適当に こたえないで、よく かんがえてください。Apa arti 適当に dalam konteks ini?', 'Sembarangan.','Dengan tepat sesuai kebutuhan.','Secara khusus untuk orang itu.','Larangan menjawab tanpa berpikir menentukan makna sembarangan; 適当 juga bisa berarti sesuai dalam konteks lain.'],
 ['丁寧',3,'Untuk meminta tulisan dibuat dengan teliti, lengkapi: なまえを（　）かいてください。','ていねいに','ふくざつに','ゆっくり','丁寧に berarti dengan teliti; ゆっくり berarti pelan-pelan, bukan secara khusus teliti.'],
]);
add(10,[
 ['原因',1,'Bagaimana bacaan 原因?', 'げんいん','げいいん','げんにん','原因 dibaca げんいん, berarti penyebab.'],
 ['都合',1,'Bagaimana bacaan 都合 dalam 都合が わるい?', 'つごう','とごう','とあい','都合 dibaca つごう, keadaan atau kecocokan jadwal.'],
 ['おかげ',1,'せんせいの おかげで、にほんごが はなせます。Apa makna おかげで?', 'Berkat guru.','Bertentangan dengan guru.','Sebagai pengganti guru.','おかげで mengaitkan hasil baik dengan bantuan atau faktor tertentu.'],
 ['それなのに',2,'よく ねました。それなのに、まだ ねむいです。Apa hubungan dua kalimat?', 'Hasilnya berlawanan dengan harapan.','Kalimat kedua menerangkan tujuan tidur.','Keduanya pilihan yang saling menggantikan.','それなのに menandai keadaan yang tetap terjadi walaupun bertentangan dengan harapan.'],
 ['ちっとも',3,'Mana kelanjutan yang sesuai untuk ちっとも?', 'わかりません。','よく わかります。','ぜんぶ わかりました。','ちっとも lazim dipakai bersama bentuk negatif: sama sekali tidak mengerti.'],
 ['代わり',2,'コーヒーの 代わりに おちゃを のみます。Minuman mana yang dipilih?', 'Teh sebagai pengganti kopi.','Kopi sebagai pengganti teh.','Kopi dan teh dalam jumlah sama.','Xの代わりにY berarti Y dipakai sebagai pengganti X.'],
]);
add(11,[
 ['天気予報',1,'Bagaimana bacaan 天気予報?', 'てんきよほう','てんきよぼう','てんきょうほう','天気予報 dibaca てんきよほう, prakiraan cuaca.'],
 ['気温',2,'Bagaimana bacaan 気温?', 'きおん','けおん','きおう','気温 dibaca きおん, suhu udara.'],
 ['うわさ',2,'それは うわさです。まだ たしかめていません。Bagaimana status informasinya?', 'Kabar yang belum dipastikan.','Fakta yang sudah diperiksa pembicara.','Petunjuk penggunaan alat.','うわさ berarti kabar angin; kalimat berikutnya menegaskan belum diperiksa.'],
 ['確か',2,'かいぎは、確か きんようびです。Apa makna 確か di sini?', 'Kalau tidak salah.','Pasti tanpa kemungkinan salah.','Secara tiba-tiba.','確か sebagai pengantar ingatan berarti kalau tidak salah.'],
 ['止む',1,'あめが（　）。かさは もう いりません。Pilih kata yang berarti hujan berhenti.', 'やみました','ふりだしました','くもりました','止む dipakai untuk berhentinya hujan atau angin.'],
 ['きっと',3,'まいにち れんしゅうしていますから、きっと じょうずに なるでしょう。Apa nuansa きっと?', 'Keyakinan kuat pembicara tentang perkiraan.','Laporan langsung dari berita.','Bukti bahwa hasil sudah terjadi.','きっと menyatakan keyakinan atau harapan kuat, bukan bukti hasil yang sudah terjadi.'],
]);
add(12,[
 ['気持ち',2,'Bagaimana bacaan 気持ち?', 'きもち','きもつ','けもち','気持ち dibaca きもち, berarti perasaan.'],
 ['優しい',2,'Bagaimana bacaan 優しい?', 'やさしい','やすしい','うれしい','優しい dibaca やさしい, berarti baik hati atau lembut.'],
 ['欲しがる',3,'いもうとは じてんしゃを 欲しがっています。Siapa yang menunjukkan keinginan?', 'Adik perempuan pembicara.','Pembicara sendiri.','Pemilik toko sepeda.','いもうと adalah subjek; 欲しがる menyampaikan keinginan orang lain dari tanda yang terlihat.'],
 ['似る',1,'あねと わたしは こえが 似ています。Apa yang mirip?', 'Suara kakak dan pembicara.','Tas kakak dan pembicara.','Suasana hati kakak dan pembicara.','こえが似ている berarti suara mereka mirip.'],
 ['怖がる',3,'Anak menunjukkan rasa takut pada anjing. Pilih kalimat yang sesuai.', 'こどもが いぬを こわがっています。','こどもが いぬと あそんでいます。','こどもが いぬを ほしがっています。','怖がる digunakan untuk rasa takut yang tampak pada orang lain.'],
 ['可笑しい',2,'その はなしは おかしくて、みんな わらいました。Makna おかしい di sini?', 'Lucu.','Menyedihkan.','Membahayakan.','Orang-orang tertawa menentukan makna lucu; おかしい juga dapat berarti aneh dalam konteks lain.'],
]);

add(13,[
 ['乗り換える',1,'Bagaimana bacaan 乗り換える?', 'のりかえる','のりがえる','のるかえる','乗り換える dibaca のりかえる, berarti berganti kendaraan.'],
 ['郊外',2,'Bagaimana bacaan 郊外?', 'こうがい','こうかい','きょうがい','郊外 dibaca こうがい, berarti pinggiran kota.'],
 ['下りる',1,'この かいだんを 下りると、でぐちが あります。Apa tindakan yang dilakukan?', 'Menuruni tangga.','Menaiki tangga.','Menutup tangga.','下りる pada konteks tangga berarti turun; untuk turun dari kendaraan, ejaan standarnya 降りる.'],
 ['寄る',2,'かえりに スーパーに 寄ります。Apa yang dilakukan?', 'Mampir ke supermarket saat pulang.','Pindah rumah ke supermarket.','Melewati supermarket tanpa berhenti.','寄る berarti mampir atau mendekat, sesuai konteks perjalanan.'],
 ['まっすぐ',1,'Petunjuknya meminta terus lurus. Lengkapi: この みちを（　）いってください。','まっすぐ','ときどき','しばらく','まっすぐ berarti lurus; しばらく menunjukkan lama waktu, bukan arah.'],
 ['旅館',2,'にほんの へやに とまりたいです。旅館は どうですか。旅館 adalah apa?', 'Penginapan bergaya Jepang.','Pelabuhan kapal.','Gedung perkantoran.','旅館 berarti penginapan bergaya Jepang.'],
]);
add(14,[
 ['条件',1,'Bagaimana bacaan 条件?', 'じょうけん','しょうけん','じょけん','条件 dibaca じょうけん, syarat atau kondisi.'],
 ['機会',1,'Bagaimana bacaan 機会?', 'きかい','ぎかい','きっかい','機会 dibaca きかい, kesempatan.'],
 ['十分',1,'いちじかん あれば、じかんは 十分です。Apa arti 十分 di sini?', 'Waktunya cukup.','Waktunya tepat sepuluh menit.','Waktunya tidak cukup.','十分（じゅうぶん）berarti cukup; sepuluh menit dibaca じゅっぷん atau じっぷん.'],
 ['できれば',2,'できれば、あしたまでに へんじを ください。Apa arti できれば?', 'Kalau memungkinkan.','Walaupun sudah selesai.','Setelah pasti dibatalkan.','できれば adalah bentuk syarat yang berarti kalau memungkinkan.'],
 ['それなら',2,'Teman mengatakan hari Jumat kosong. Respons yang menanggapi informasi itu adalah?', 'それなら、きんようびに あいましょう。','それなのに、きんようびに あいましょう。','なぜなら、きんようびに あいましょう。','それなら berarti kalau begitu dan memakai informasi teman sebagai dasar usulan.'],
 ['詳しい',2,'Anda mencari informasi kota. たなかさんは この まちに 詳しいです。Mengapa bertanya kepada Tanaka sesuai?', 'Ia mengenal kota itu dengan baik.','Ia baru saja pindah tanpa mengenal kota.','Ia tidak suka membicarakan kota.','場所に詳しい berarti mengenal tempat itu secara mendalam.'],
]);
add(15,[
 ['材料',2,'Bagaimana bacaan 材料?', 'ざいりょう','さいりょう','ざいりょ','材料 dibaca ざいりょう, bahan untuk membuat sesuatu.'],
 ['資料',3,'Bagaimana bacaan 資料?', 'しりょう','じりょう','しりょ','資料 dibaca しりょう, bahan informasi atau dokumen.'],
 ['役に立つ',3,'この じてんは、べんきょうに 役に立ちます。Apa artinya?', 'Kamus ini berguna untuk belajar.','Kamus ini sulit ditemukan.','Kamus ini sudah tidak boleh dipakai.','役に立つ berarti berguna atau bermanfaat.'],
 ['かかる',3,'レポートを かくのに、にじかん かかりました。Apa yang diperlukan?', 'Waktu dua jam.','Biaya dua ratus yen.','Dua orang penulis.','Waktu yang diikuti かかる menunjukkan durasi yang diperlukan.'],
 ['申し込む',1,'Anda mendaftarkan diri untuk ujian. Pilih kalimatnya.', 'しけんに もうしこみます。','しけんの じかんを たしかめます。','しけんの けっかを しらべます。','申し込む berarti mendaftar; dua opsi lain memeriksa waktu atau mencari hasil ujian.'],
 ['忘れ物',2,'かばんの なかを たしかめて、忘れ物を しないように します。Apa yang ingin dicegah?', 'Ada barang yang lupa dibawa.','Jumlah tas bertambah.','Barang dikirim terlalu cepat.','忘れ物 adalah barang yang terlupa atau tertinggal.'],
]);
add(16,[
 ['規則',2,'Bagaimana bacaan 規則?', 'きそく','ぎそく','きぞく','規則 dibaca きそく, peraturan.'],
 ['非常口',3,'Bagaimana bacaan 非常口?', 'ひじょうぐち','ひじょうくち','ひしょうぐち','非常口 dibaca ひじょうぐち, pintu darurat.'],
 ['無理',1,'つかれているなら、無理を しないほうが いいです。Apa sarannya?', 'Jangan memaksakan diri saat lelah.','Berusahalah tanpa beristirahat.','Abaikan rasa lelah sepenuhnya.','無理をする berarti memaksakan diri.'],
 ['守る',2,'がっこうの きそくを 守らなくては いけません。Apa kewajibannya?', 'Menaati peraturan sekolah.','Mengganti peraturan sekolah.','Mengingat nama sekolah.','規則を守る berarti menaati peraturan.'],
 ['片付ける',3,'Setelah bermain, orang tua menyuruh membereskan mainan. Pilih instruksinya.', 'おもちゃを かたづけなさい。','おもちゃを こわしなさい。','おもちゃを なくしなさい。','片付ける berarti membereskan; なさい di sini adalah instruksi orang tua kepada anak.'],
 ['休憩する',1,'Anda menyarankan istirahat sejenak. Lengkapi: すこし（　）ほうが いいです。','きゅうけいした','さわいだ','むりを した','休憩する berarti beristirahat sejenak.'],
]);
add(17,[
 ['贈り物',1,'Bagaimana bacaan 贈り物?', 'おくりもの','おこりもの','おくりもん','贈り物 dibaca おくりもの, hadiah.'],
 ['祖母',2,'Bagaimana bacaan 祖母?', 'そぼ','そふ','そば','祖母 dibaca そぼ, nenek sendiri; 祖父 adalah そふ.'],
 ['もらう',2,'わたしは ともだちに ほんを もらいました。Siapa penerima buku?', 'Pembicara.','Teman pembicara.','Guru teman.','Dengan もらう, subjek わたし adalah penerima dan ともだちに adalah pemberi.'],
 ['くれる',3,'たなかさんが わたしの むすめに はなを くれました。Kepada siapa bunga diberikan?', 'Putri pembicara.','Putri Tanaka.','Tanaka sendiri.','くれる menunjukkan pemberian kepada pembicara atau pihaknya, di sini putrinya.'],
 ['あげる',1,'Anda memberi pena kepada adik. Pilih kalimat yang sesuai.', 'わたしは おとうとに ペンを あげました。','わたしは おとうとに ペンを もらいました。','おとうとは わたしに ペンを くれました。','あげる memakai sudut pandang pemberi; dua opsi lain membuat pembicara menjadi penerima.'],
 ['贈る',1,'Untuk menonjolkan pemberian hadiah ulang tahun, kata mana yang tepat? ははに はなを（　）。','おくりました（贈りました）','ぬりました（塗りました）','ひろいました（拾いました）','贈る berarti menghadiahkan, berbeda dari 送る yang menonjolkan pengiriman.'],
]);
add(18,[
 ['手伝う',1,'Bagaimana bacaan 手伝う?', 'てつだう','てっだう','てづだう','手伝う dibaca てつだう, membantu pekerjaan seseorang.'],
 ['留守',2,'Bagaimana bacaan 留守?', 'るす','りゅす','るしゅ','留守 dibaca るす, keadaan tidak berada di rumah.'],
 ['世話',1,'ともだちに ねこの 世話を してもらいました。Bantuan apa yang diterima?', 'Perawatan kucing.','Pengiriman kucing.','Penjualan kucing.','ねこの世話 berarti mengurus atau merawat kucing.'],
 ['遠慮なく',2,'わからないことは、遠慮なく きいてください。Bagaimana sebaiknya bertanya?', 'Tanpa sungkan.','Tanpa mendengarkan jawaban.','Hanya setelah dimarahi.','遠慮なく berarti tanpa menahan diri karena sungkan.'],
 ['直す',2,'Sepeda Anda rusak. Pilih permintaan untuk memperbaikinya.', 'じてんしゃを なおしてもらえませんか。','じてんしゃを こわしてもらえませんか。','じてんしゃを すててもらえませんか。','直す berarti memperbaiki benda; てもらえませんか adalah permintaan bantuan.'],
 ['迎え',3,'えきまで 迎えに きてくれて、ありがとう。Bantuan apa yang disyukuri?', 'Datang menjemput di stasiun.','Mengantar kepergian di stasiun.','Mengirim surat ke stasiun.','迎えに来る berarti datang menjemput; 見送る berarti mengantar kepergian.'],
]);
add(19,[
 ['人数',1,'Bagaimana bacaan 人数?', 'にんずう','にんすう','にんぞう','人数 dibaca にんずう, jumlah orang.'],
 ['確認する',1,'Bagaimana bacaan 確認する?', 'かくにんする','かくねんする','かっにんする','確認する dibaca かくにんする, memeriksa untuk memastikan.'],
 ['ほとんど',2,'いそがしくて、ほとんど やすめませんでした。Apa artinya?', 'Hampir tidak bisa beristirahat.','Hampir sepanjang waktu beristirahat.','Sudah pasti beristirahat sepenuhnya.','ほとんど dengan negatif berarti hampir tidak.'],
 ['たった',3,'きたのは、たった さんにんでした。Apa penekanan たった?', 'Jumlahnya hanya tiga orang.','Jumlahnya lebih dari tiga puluh orang.','Tiga orang datang bersamaan.','たった menekankan kecilnya jumlah.'],
 ['尋ねる',1,'Anda menanyakan letak stasiun kepada seseorang. Pilih verba yang sesuai.', 'たずねる（尋ねる）','たずねる（訪ねる）','そだてる（育てる）','尋ねる berarti menanyakan; 訪ねる berarti mengunjungi walaupun bacaannya sama.'],
 ['足りる',2,'Peserta sepuluh orang, tetapi hanya ada delapan kursi. Lengkapi: いすが（　）。','たりません','のこっています','ふえました','足りない berarti tidak mencukupi; delapan kursi belum cukup untuk sepuluh orang.'],
]);
add(20,[
 ['以上',2,'Bagaimana bacaan 以上?', 'いじょう','いしょう','いじょ','以上 dibaca いじょう, atau lebih.'],
 ['未満',2,'Bagaimana bacaan 未満?', 'みまん','みばん','いまん','未満 dibaca みまん, kurang dari batas tanpa memasukkan batas itu.'],
 ['以下',2,'じゅうにん 以下という きそくです。Apakah tepat sepuluh orang masih diperbolehkan?', 'Ya, sepuluh termasuk batas.','Tidak, hanya sembilan atau kurang.','Hanya sebelas atau lebih.','以下 mencakup batas atas; 十人以下 berarti paling banyak sepuluh orang.'],
 ['以内に',2,'いちじかん 以内に おわってください。Apa batas waktunya?', 'Paling lama satu jam.','Paling cepat satu jam.','Harus lebih dari satu jam.','以内に menunjukkan penyelesaian dalam batas waktu, termasuk batasnya.'],
 ['そのまま',3,'まどは あけた ままです。そのままに してください。Apa yang diminta?', 'Biarkan jendela tetap terbuka.','Segera tutup jendela.','Ganti jendela dengan yang baru.','そのまま berarti mempertahankan keadaan yang baru disebutkan.'],
 ['倍',1,'Tas A berharga 1.000 yen dan tas B 2.000 yen. Harga B adalah Aの（　）です。','にばい','はんぶん','さんばい','倍 menunjukkan kelipatan; 2.000 adalah dua kali 1.000.'],
]);
add(21,[
 ['被害',2,'Bagaimana bacaan 被害?', 'ひがい','びがい','ひかい','被害 dibaca ひがい, kerugian atau dampak buruk yang dialami.'],
 ['発明',3,'Bagaimana bacaan 発明?', 'はつめい','はっめい','はつみょう','発明 dibaca はつめい, penemuan/ciptaan teknologi baru.'],
 ['盗む',2,'わたしは さいふを 盗まれました。Apa yang dialami pembicara?', 'Dompetnya dicuri.','Ia mencuri dompet.','Ia menerima dompet sebagai hadiah.','盗まれる adalah bentuk pasif dari 盗む; dompet pembicara menjadi sasaran pencurian.'],
 ['建てる',3,'この いえは さんじゅうねん まえに 建てられました。Apa yang terjadi tiga puluh tahun lalu?', 'Rumah dibangun.','Rumah dijual.','Rumah dibersihkan.','建てられる adalah pasif dari 建てる, membangun bangunan.'],
 ['踏む',2,'Seseorang menginjak kaki Anda di bus. Lengkapi: あしを（　）。','ふまれました','ほめられました','さそわれました','踏まれる berarti diinjak; 褒められる dipuji dan 誘われる diajak.'],
 ['発見する',3,'Sebuah pulau yang sudah ada baru ditemukan penjelajah. Verba mana yang sesuai?', 'はっけんする','はつめいする','せいさんする','発見する menemukan sesuatu yang sudah ada; 発明する menciptakan temuan baru dan 生産する memproduksi.'],
]);
add(22,[
 ['上司',1,'Bagaimana bacaan 上司?', 'じょうし','しょうし','じょうじ','上司 dibaca じょうし, atasan.'],
 ['許可',2,'Bagaimana bacaan 許可?', 'きょか','きょうか','きょが','許可 dibaca きょか, izin.'],
 ['残業',3,'じょうしに 残業させられました。Apa yang dialami pembicara?', 'Disuruh bekerja lembur.','Diizinkan pulang lebih awal.','Diminta memilih liburan.','残業 berarti lembur; させられる menunjukkan pengalaman dipaksa atau disuruh.'],
 ['自由',2,'こどもに 自由に えを かかせました。Bagaimana anak menggambar?', 'Dengan bebas.','Dengan aturan warna yang dipaksakan.','Tanpa diizinkan menggambar.','自由に berarti dengan bebas; konteks ini menyatakan memberi kesempatan.'],
 ['運ぶ',3,'Atasan menyuruh Anda membawa kotak berat. Lengkapi: はこを（　）。','はこばされました','そだてられました','ならわされました','運ばされる adalah kausatif-pasif pendek dari 運ぶ, disuruh mengangkut.'],
 ['許す',2,'ははは、こどもが ひとりで りょこうするのを 許しました。Apa yang ibu lakukan?', 'Mengizinkan anak bepergian sendiri.','Melarang anak bepergian sendiri.','Menyembunyikan rencana perjalanan.','許す dalam konteks tindakan yang akan dilakukan berarti mengizinkan.'],
]);
add(23,[
 ['召し上がる',2,'Bagaimana bacaan 召し上がる?', 'めしあがる','めしあける','めさあがる','召し上がる dibaca めしあがる, verba hormat untuk makan atau minum.'],
 ['ご存じ',2,'Bagaimana bacaan ご存じ?', 'ごぞんじ','ごそんじ','ごぞうじ','ご存じ dibaca ごぞんじ, mengetahui atau mengenal dalam bahasa hormat.'],
 ['ご覧になる',2,'せんせいは レポートを ご覧になりました。Apa tindakan guru?', 'Melihat atau membaca laporan.','Menulis nama laporan.','Membuang laporan.','ご覧になる adalah bentuk hormat dari 見る.'],
 ['いらっしゃる',2,'せんせいは、いま としょかんに いらっしゃいます。Apa maknanya?', 'Guru berada di perpustakaan sekarang.','Guru sudah meninggalkan perpustakaan.','Guru melarang penggunaan perpustakaan.','Dengan tempat dan いま, いらっしゃる bermakna berada; verba ini juga dapat berarti pergi atau datang.'],
 ['おっしゃる',3,'Lengkapi bentuk sopan: せんせいが「ありがとう」と（　）。','おっしゃいました','おっしゃりました','もうしました','Bentuk sopan khusus おっしゃる adalah おっしゃいます; 申す untuk pihak sendiri secara sangat sopan.'],
 ['お帰りになる',1,'Pilih bentuk hormat untuk “direktur pulang”.', 'しゃちょうが おかえりに なります。','しゃちょうが おかえりします。','しゃちょうが かえらせます。','お帰りになる menghormati tindakan orang lain; お帰りします tidak sesuai sebagai sonkeigo.'],
]);
add(24,[
 ['伺う',1,'Bagaimana bacaan 伺う?', 'うかがう','うかう','うがかう','伺う dibaca うかがう, bentuk merendah untuk berkunjung, bertanya, atau mendengar.'],
 ['お手数',3,'Bagaimana bacaan お手数 dalam permintaan sopan お手数ですが?', 'おてすう','おてす','おしゅすう','Dalam ungkapan お手数ですが, bacaannya おてすう, permintaan yang merepotkan pihak lain.'],
 ['いただく',3,'わたしは せんせいから ほんを いただきました。Siapa penerima buku?', 'Pembicara.','Guru.','Orang yang tidak disebutkan.','いただく adalah bentuk merendah untuk menerima; subjek わたし adalah penerima.'],
 ['ございます',2,'おてあらいは あちらに ございます。Apa maknanya?', 'Toilet berada di sebelah sana.','Toilet sedang dipindahkan.','Toilet belum tersedia.','ございます adalah bentuk sopan dari ある, menyatakan keberadaan.'],
 ['拝見する',1,'Anda mengatakan dengan merendah bahwa sudah melihat laporan guru. Pilih kalimatnya.', 'せんせいの レポートを はいけんしました。','せんせいの レポートを ごらんに なりました。','せんせいの レポートを おっしゃいました。','拝見する merendahkan tindakan melihat oleh pihak sendiri; ご覧になる menghormati tindakan orang lain.'],
 ['くださる',3,'Guru memberi buku kepada Anda. Pilih bentuk hormat yang tepat.', 'せんせいが ほんを くださいました。','せんせいが ほんを いただきました。','わたしが せんせいに ほんを さしあげました。','くださる menghormati pemberi yang memberi kepada pihak pembicara; いただく menempatkan subjek sebagai penerima.'],
]);

if(result.length!==24)throw Error('Expected all 24 chapters');
export default result;
