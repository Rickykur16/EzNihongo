// One supplementary scene per existing video grammar lesson; anchor = its first grammar ID.
// Core grammar, lesson membership, character profiles, and lesson order are unchanged.
const dialogues = [];
const characterKeys = {
  anna:'anna-wijaya', hadi:'hadi-pratama', aoi:'aoi-takahashi',
  ren:'ren-mori', claire:'claire-bennett', daniel:'daniel-foster',
};
function add(chapter, grammarId, cast, backgroundKey, goal, lines, checks) {
  const turns = lines.trim().split('\n').map((line,index) => {
    const [japanese,indonesian,expression] = line.split('|');
    return {speaker:index % 2 ? 'B' : 'A',japanese,indonesian,expression:expression || null};
  });
  dialogues.push({grammarId,chapter,cast:cast.map(key=>characterKeys[key]),backgroundKey,goal,turns,
    checks:checks.map(([prompt,answer,explanation])=>({prompt,answer,explanation}))});
}

add(13,'84c2f6be-45ed-48e4-8f27-b84bcbaa2da9',['anna','hadi'],'station',
  'Anna bertanya kepada Hadi tentang jalan menuju perpustakaan. Mereka membedakan petunjuk rute dengan と dan tindakan setelah tiba dengan たら.',`
としょかんへ いきたいんですが、みちが わかりません。|Saya ingin ke perpustakaan, tetapi tidak tahu jalannya.|bingung
このみちを まっすぐ いくと、はしが あります。|Jika berjalan lurus di jalan ini, ada jembatan.|
はしを わたるんですか。|Apakah saya menyeberangi jembatan itu?|
はい。わたって、みぎに まがると、としょかんが あります。|Ya. Setelah menyeberang lalu berbelok ke kanan, ada perpustakaan.|
わかりました。ありがとうございます。|Saya mengerti. Terima kasih.|senang
ついたら、でんわして ください。|Setelah tiba, tolong telepon saya.|`,[
  ['Setelah menyeberangi jembatan, Anna harus berbelok ke mana?','Ke kanan.','Hadi mengatakan みぎにまがると setelah menyeberangi jembatan.'],
  ['Kapan Hadi meminta Anna menelepon?','Setelah tiba di perpustakaan.','ついたら、でんわしてください menempatkan telepon sesudah kedatangan.']
]);

add(13,'165c4efd-8898-48aa-992b-81bc882dc771',['claire','ren'],'cafe',
  'Claire merasa lelah menjelang ujian. Ren memberi saran dengan たらどうですか dan menyampaikan harapan dengan といいですね.',`
あした しけんなんですが、きのう あまり ねませんでした。|Besok saya ujian, tetapi kemarin saya kurang tidur.|
じゃ、きょうは はやく ねたら どうですか。|Kalau begitu, bagaimana kalau tidur lebih awal hari ini?|berpikir
そうですね。でも、まだ よんでいない ページが あります。|Benar juga. Tetapi masih ada halaman yang belum saya baca.|
まず、このページを よんだら どうですか。|Bagaimana kalau membaca halaman ini terlebih dahulu?|
はい。そうします。|Ya. Saya akan begitu.|
あした、じょうずに こたえられると いいですね。|Semoga besok Anda bisa menjawab dengan baik.|senang`,[
  ['Apa saran Ren tentang waktu tidur Claire?','Tidur lebih awal hari ini.','Ren menyarankan きょうははやくねたらどうですか.'],
  ['Apa yang Ren harapkan untuk ujian Claire?','Claire dapat menjawab dengan baik.','じょうずにこたえられるといいですね menyatakan harapan, bukan hasil ujian yang sudah pasti.']
]);

add(14,'fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d',['aoi','daniel'],'park',
  'Aoi mengajak Daniel pergi ke laut jika ada waktu. Daniel menanggapi rencana itu dengan なら dan membandingkan transportasi.',`
にちようび、じかんが あれば、うみへ いきませんか。|Jika ada waktu hari Minggu, mau pergi ke laut?|
いいですね。うみへ いくなら、あさ はやく でましょう。|Boleh. Kalau pergi ke laut, mari berangkat pagi-pagi.|senang
バスと でんしゃでは、どちらが いいですか。|Mana yang lebih baik, bus atau kereta?|
でんしゃなら、いちじかんで つきます。バスは にじかん かかります。|Kalau kereta, kita sampai dalam satu jam. Bus memerlukan dua jam.|
じゃ、でんしゃで いきましょう。|Kalau begitu, mari naik kereta.|
はい。はちじの でんしゃは どうですか。|Ya. Bagaimana kalau kereta pukul delapan?|berpikir`,[
  ['Apa syarat ajakan Aoi?','Daniel memiliki waktu pada hari Minggu.','じかんがあれば adalah syarat keadaan untuk ajakan pergi.'],
  ['Mengapa mereka memilih kereta?','Kereta memerlukan satu jam, sedangkan bus dua jam.','Daniel menyebut waktu kedua transportasi, lalu Aoi memilih kereta.']
]);

add(14,'c9eb422c-64ee-469a-a942-156365943c33',['hadi','claire'],'station',
  'Hadi terlambat untuk kereta karena mampir ke toko. Ia menyesali pilihan yang sudah dilakukan memakai ばよかった dan なければよかった.',`
でんしゃは もう いって しまったんですか。|Apakah keretanya sudah berangkat?|kaget
はい。ごふんまえに でました。|Ya. Berangkat lima menit lalu.|
もっと はやく うちを でれば よかったです。|Seandainya saya berangkat dari rumah lebih awal.|
とちゅうで どこかに よったんですか。|Apakah Anda mampir ke suatu tempat di perjalanan?|
はい。みせに よらなければ よかったです。|Ya. Seandainya saya tidak mampir ke toko.|
つぎの でんしゃは じゅっぷんごです。ここで まちましょう。|Kereta berikutnya sepuluh menit lagi. Mari menunggu di sini.|`,[
  ['Apakah Hadi benar-benar mampir ke toko?','Ya, ia mampir lalu menyesal.','Hadi menjawab はい sebelum よらなければよかった, yang menunjukkan penyesalan atas tindakan yang sudah terjadi.'],
  ['Kapan kereta berikutnya datang menurut Claire?','Sepuluh menit lagi.','Claire mengatakan つぎのでんしゃはじゅっぷんごです.']
]);

add(15,'bcefdff6-4e96-47e3-9de8-06fcb5214a16',['ren','anna'],'classroom',
  'Ren menjelaskan tujuan pergi ke perpustakaan dan belajar bahasa Inggris. Anna menanyakan tujuan tindakan serta kemampuan yang sedang diusahakan.',`
これから、ほんを かりに としょかんへ いきます。|Setelah ini saya akan pergi ke perpustakaan untuk meminjam buku.|
どんな ほんを かりるんですか。|Buku seperti apa yang akan Anda pinjam?|
えいごの ほんです。りょこうのために、えいごを べんきょうしています。|Buku bahasa Inggris. Saya belajar bahasa Inggris untuk bepergian.|
ほんは よめますか。|Apakah Anda bisa membaca bukunya?|
まだ むずかしいです。よめるように、まいにち れんしゅうしています。|Masih sulit. Saya berlatih setiap hari agar bisa membacanya.|berpikir
いいですね。がんばって ください。|Bagus. Semangat, ya.|senang`,[
  ['Untuk apa Ren pergi ke perpustakaan?','Untuk meminjam buku bahasa Inggris.','ほんをかりに menyatakan tujuan perjalanan dan Ren kemudian menjelaskan jenis bukunya.'],
  ['Kemampuan apa yang Ren latih setiap hari?','Membaca buku bahasa Inggris.','よめるように、まいにちれんしゅうしています menyatakan kemampuan membaca sebagai hasil yang diupayakan.']
]);

add(15,'384aada6-16f6-49c9-914d-0861febfb53e',['daniel','anna'],'classroom',
  'Daniel dan Anna menyiapkan kegiatan membuat bunga kertas. Mereka membahas kegunaan gunting dan instruksi guru. はさみ berarti gunting.',`
あしたの クラスでは、なにを つくりますか。|Apa yang akan dibuat dalam kelas besok?|
かみで はなを つくります。せんせいは、はさみを もって くるように いいました。|Kita membuat bunga dari kertas. Guru meminta kita membawa gunting.|
はさみは、かみを きるのに つかうんですね。|Gunting digunakan untuk memotong kertas, ya.|
はい。のりも ひつようです。|Ya. Lem juga diperlukan.|
はなを つくるのに、どのくらい かかりますか。|Berapa lama diperlukan untuk membuat bunganya?|berpikir
さんじゅっぷんぐらいです。|Sekitar tiga puluh menit.|`,[
  ['Apa yang guru minta dibawa?','Gunting.','Anna melaporkan はさみをもってくるようにいいました.'],
  ['Berapa lama membuat bunga kertas itu?','Sekitar tiga puluh menit.','Anna menjawab さんじゅっぷんぐらい untuk waktu membuat bunga.']
]);

add(16,'7e65dba0-89b1-43a4-99ef-17b99c2eb1f0',['anna','claire'],'cafe',
  'Anna dan Claire memeriksa persiapan ujian. Mereka membedakan saran, kewajiban membawa alat, dan sesuatu yang tidak perlu dibawa.',`
あしたの しけんには、なにが ひつようですか。|Apa yang diperlukan untuk ujian besok?|
えんぴつを もって こないと いけません。にほん あったほうが いいですよ。|Kita harus membawa pensil. Sebaiknya ada dua batang.|
じしょも もって いきますか。|Apakah kita membawa kamus juga?|berpikir
いいえ。じしょを もって いく ひつようは ありません。|Tidak. Tidak perlu membawa kamus.|
わかりました。きょうは はやく ねたほうが いいですね。|Saya mengerti. Sebaiknya tidur lebih awal hari ini, ya.|
そうですね。あした、がんばりましょう。|Benar. Mari berusaha sebaik mungkin besok.|senang`,[
  ['Apa yang wajib dibawa Anna untuk ujian?','Pensil.','Claire menyatakan えんぴつをもってこないといけません sebagai kewajiban.'],
  ['Apakah kamus perlu dibawa?','Tidak perlu.','ひつようはありません menyatakan tidak perlu; kalimat itu tidak mengatakan kamus dilarang.']
]);

add(16,'441eb770-2e1e-4752-b7db-74c7764cdf8c',['ren','hadi'],'station',
  'Di dekat stasiun, Ren memperingatkan Hadi saat kendaraan mendekat. Bentuk perintah dipakai karena bahaya segera; larangan pada tanda dibaca sebagai kutipan.',`
ハディさん、とまれ！ くるまが きます！|Hadi, berhenti! Ada mobil datang!|kaget
あっ、あぶなかったです。ありがとうございます。|Ah, tadi berbahaya. Terima kasih.|
ここには「わたるな」と かいて あります。あのはしを わたりましょう。|Di sini tertulis “Jangan menyeberang”. Mari menyeberangi jembatan itu.|
はい。これからは、よく みます。|Baik. Mulai sekarang saya akan lebih memperhatikan.|`,[
  ['Mengapa Ren memakai perintah langsung とまれ?','Karena mobil sedang mendekat dan ada bahaya.','くるまがきます memberi konteks darurat; ini bukan contoh permintaan biasa antarteman.'],
  ['Setelah melihat tanda larangan, mereka akan menyeberang di mana?','Di jembatan yang ditunjuk Ren.','Ren menyarankan あのはしをわたりましょう setelah membaca larangan menyeberang di tempat itu.']
]);

add(17,'fdeb6c11-f394-4655-909e-6e3f814c1b21',['aoi','claire'],'cafe',
  'Aoi menanyakan hadiah yang Claire terima pada hari ulang tahunnya. Mereka menyebut pemberi dan penerima dengan jelas, kemudian membahas rencana hadiah balasan.',`
そのかばん、あたらしいですね。|Tas itu baru, ya.|
はい。たんじょうびに、あねから もらいました。|Ya. Saya menerimanya dari kakak perempuan pada ulang tahun saya.|senang
すてきですね。そのペンも、おねえさんからですか。|Bagus, ya. Apakah pena itu juga dari kakak perempuan Anda?|
いいえ。ペンは ともだちが くれました。|Bukan. Pena ini diberikan teman kepada saya.|
こんどは、おねえさんに なにか あげますか。|Lain kali, apakah Anda akan memberikan sesuatu kepada kakak perempuan Anda?|
はい。あねの たんじょうびに、はなを あげる つもりです。|Ya. Saya berniat memberikan bunga pada ulang tahunnya.|berpikir`,[
  ['Siapa yang memberikan tas kepada Claire?','Kakak perempuan Claire.','Claire mengatakan あねからもらいました.'],
  ['Apa rencana hadiah Claire untuk kakak perempuannya?','Bunga pada hari ulang tahunnya.','Claire menyebut はなをあげるつもりです dengan kakaknya sebagai penerima.']
]);

add(18,'cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd',['daniel','hadi'],'park',
  'Daniel bertanya tentang bantuan saat Hadi pindah rumah. Percakapan menjaga sudut pandang てくれる、てもらう、てあげる dan partikel yang mengikuti verba.',`
ひっこしは、もう おわりましたか。|Apakah pindah rumahnya sudah selesai?|
はい。ともだちが にもつを もって くれました。|Ya. Teman membantu saya membawakan barang.|
えきから あたらしい うちまでは、どうやって いきましたか。|Dari stasiun ke rumah baru, bagaimana Anda pergi?|
あにに くるまで おくって もらいました。|Saya mendapat bantuan kakak laki-laki mengantar dengan mobil.|
たすかりましたね。|Bantuan itu sangat menolong, ya.|senang
はい。こんどは、わたしが ともだちの ひっこしを てつだって あげたいです。|Ya. Lain kali saya ingin membantu teman saya pindah rumah.|`,[
  ['Siapa yang mengantar Hadi dengan mobil?','Kakak laki-lakinya.','あにに…おくってもらいました menunjukkan kakak sebagai pelaku bantuan mengantar.'],
  ['Bantuan apa yang Hadi ingin berikan lain kali?','Membantu temannya pindah rumah.','Hadi mengatakan ともだちのひっこしをてつだってあげたいです.']
]);

add(18,'a45f36e6-96a1-49ba-8c0e-3e96352e7e7a',['anna','aoi'],'classroom',
  'Anna meminta Aoi menjelaskan bacaan suatu kata, menyampaikan keinginan agar dibaca perlahan, lalu berterima kasih atas bantuan yang selesai.',`
すみません。このことばを よんで もらえませんか。|Permisi, bisakah Anda membantu membacakan kata ini?|
はい。「としょかん」です。|Ya. Bacaannya “toshokan”.|
もういちど、ゆっくり よんで ほしいです。|Saya ingin Anda membacanya perlahan sekali lagi.|bingung
はい。「と・しょ・か・ん」です。|Baik. “To-sho-ka-n.”|
わかりました。おしえて くれて、ありがとう。|Saya mengerti. Terima kasih sudah menjelaskannya.|senang
どういたしまして。|Sama-sama.|`,[
  ['Bantuan apa yang Anna minta pada awal percakapan?','Membacakan sebuah kata.','よんでもらえませんか meminta bantuan membaca kata yang ditunjuk.'],
  ['Bagaimana Anna ingin kata itu dibaca untuk kedua kalinya?','Perlahan.','ゆっくりよんでほしいです menyatakan cara membaca yang Anna harapkan.']
]);

add(19,'f0c421b9-ac27-4129-997e-d424784032a6',['claire','daniel'],'cafe',
  'Claire dan Daniel memeriksa jumlah peserta acara. Mereka membedakan peserta yang sudah pasti dari seseorang yang belum memastikan kehadirannya.',`
あした、なんにん くるか、わかりますか。|Apakah Anda tahu berapa orang yang akan datang besok?|berpikir
いま、くると いった ひとは さんにんだけです。|Saat ini baru tiga orang yang mengatakan akan datang.|
レンさんも きますか。|Apakah Ren juga datang?|
レンさんが こられるかどうかは、まだ わかりません。|Saya belum tahu apakah Ren bisa datang atau tidak.|
さんにんしか いないんですね。|Jadi yang sudah pasti hanya tiga orang, ya.|
はい。レンさんに、もういちど きいて みます。|Ya. Saya akan mencoba menanyakan sekali lagi kepada Ren.|`,[
  ['Berapa peserta yang sudah menyatakan akan datang?','Tiga orang.','Daniel mengatakan さんにんだけ; Ren belum masuk jumlah yang sudah pasti.'],
  ['Apa yang belum diketahui tentang Ren?','Apakah Ren bisa datang atau tidak.','こられるかどうか adalah pertanyaan tertanam tentang kemungkinan hadir.']
]);

add(19,'525f3286-15cd-49fa-898e-1b35a7240b62',['hadi','ren'],'classroom',
  'Hadi dan Ren membahas layanan perpustakaan untuk siswa dan warga. Mereka memakai だけで、だけでなく、dan も sebagai penekanan jumlah.',`
このとしょかんは、がくせいだけが つかえるんですか。|Apakah perpustakaan ini hanya boleh digunakan siswa?|
いいえ。がくせいだけでなく、まちの ひとも つかえます。|Tidak. Bukan hanya siswa, warga kota juga boleh memakainya.|
どうすれば、ほんが かりられますか。|Apa yang harus saya lakukan agar bisa meminjam buku?|
このカードに なまえを かくだけで、かりられます。|Cukup menulis nama pada kartu ini, Anda dapat meminjam.|
べんりですね。たくさんの ひとが きますか。|Praktis, ya. Apakah banyak orang datang?|senang
はい。きのうは ごひゃくにんも きました。|Ya. Kemarin sampai lima ratus orang datang.|kaget`,[
  ['Selain siswa, siapa yang boleh memakai perpustakaan?','Warga kota.','まちのひとも menambahkan warga kota sebagai pengguna.'],
  ['Apa yang cukup dilakukan untuk meminjam buku?','Menulis nama pada kartu.','なまえをかくだけで menyatakan syarat minimal pada layanan ini.']
]);

add(20,'b391824a-4944-467a-ada3-935d375e7ab5',['aoi','anna'],'station',
  'Aoi menanyakan rute ke taman dan Anna menjelaskan pilihan transportasinya. Mereka membandingkan waktu berjalan dan naik bus serta interval bus.',`
こうえんまで、あるくと どのくらい かかりますか。|Berapa lama jika berjalan ke taman?|
にじゅっぷんぐらいです。バスほど はやく ありません。|Sekitar dua puluh menit. Tidak secepat bus.|
バスは なんぷんごとに きますか。|Bus datang setiap berapa menit?|berpikir
じゅっぷんごとです。バスなら、ごふんで つきます。|Setiap sepuluh menit. Kalau naik bus, sampai dalam lima menit.|
じゃ、きょうは バスで いきます。|Kalau begitu, hari ini saya naik bus.|
はい。つぎの バスは、さんじごろ きますよ。|Baik. Bus berikutnya datang sekitar pukul tiga.|`,[
  ['Berapa lama perjalanan berjalan kaki ke taman?','Sekitar dua puluh menit.','Anna menjawab にじゅっぷんぐらい untuk durasi berjalan.'],
  ['Seberapa sering bus datang?','Setiap sepuluh menit.','じゅっぷんごと menunjukkan interval kedatangan, berbeda dari durasi perjalanan bus lima menit.']
]);

add(20,'b9365e25-6149-4998-9481-8bcaf30c3809',['daniel','claire'],'classroom',
  'Daniel dan Claire menyiapkan kegiatan kelas sesuai petunjuk guru. Mereka memeriksa lokasi jika hujan dan memastikan lampu dimatikan saat meninggalkan ruangan.',`
あした、あめの ばあいは、どこで れんしゅうしますか。|Jika besok hujan, di mana kita berlatih?|
このきょうしつです。せんせいが いったとおりに、つくえを うごかしましょう。|Di kelas ini. Mari memindahkan meja sesuai yang dikatakan guru.|
はい。あっ、となりの へやは でんきが ついたままですね。|Baik. Oh, lampu ruangan sebelah masih menyala, ya.|kaget
だれも いませんね。けして きます。|Tidak ada orang, ya. Saya akan mematikannya lalu kembali.|
ありがとうございます。わたしたちも、かえる ときに かくにんしましょう。|Terima kasih. Kita juga perlu memeriksanya ketika pulang.|
はい。わすれないように しましょう。|Ya. Mari berusaha agar tidak lupa.|`,[
  ['Jika hujan, di mana mereka akan berlatih?','Di kelas tempat mereka berada sekarang.','Claire menjawab このきょうしつです untuk kondisi hujan.'],
  ['Apa yang akan Claire lakukan di ruangan sebelah?','Mematikan lampunya lalu kembali.','Tidak ada orang tetapi lampu menyala; けしてきます menyatakan pergi mematikan lalu kembali.']
]);

add(21,'6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d',['ren','daniel'],'classroom',
  'Ren dan Daniel membicarakan hasil karangan. Kalimat pasif langsung dipakai untuk menunjukkan siapa yang menerima pujian dan siapa pelakunya.',`
ダニエルさん、うれしそうですね。|Daniel, Anda terlihat senang.|
はい。せんせいに さくぶんを ほめられました。|Ya. Karangan saya dipuji oleh guru.|senang
どんな さくぶんを かいたんですか。|Karangan tentang apa yang Anda tulis?|
かぞくの ことを かきました。「わかりやすい」と いわれました。|Saya menulis tentang keluarga. Saya diberi komentar, “Mudah dipahami.”|
よかったですね。わたしも よんでも いいですか。|Bagus. Bolehkah saya membacanya juga?|
はい。どうぞ。|Ya. Silakan.|`,[
  ['Siapa yang memuji karangan Daniel?','Guru.','せんせいに…ほめられました menandai guru sebagai pelaku pujian.'],
  ['Karangan Daniel membahas apa?','Keluarga.','Daniel mengatakan かぞくのことをかきました.']
]);

add(21,'b0f52855-f571-478f-a932-33b52781c2ab',['hadi','aoi'],'park',
  'Hadi menceritakan dua kejadian tidak menyenangkan kemarin kepada Aoi: kakinya diinjak dan ia kehujanan. ぬれる berarti menjadi basah.',`
きのうは たいへんな いちにちでした。|Kemarin hari yang berat.|
どうしたんですか。|Ada apa?|
でんしゃで となりの ひとに あしを ふまれました。|Di kereta, kaki saya diinjak orang di sebelah.|
えっ、いたかったでしょう。いまは だいじょうぶですか。|Wah, pasti sakit. Sekarang sudah tidak apa-apa?|kaget
はい。もう だいじょうぶです。それから、かえりに あめに ふられて、ふくも ぬれました。|Ya, sekarang sudah tidak apa-apa. Lalu saat pulang saya kehujanan, dan pakaian saya juga basah.|
それは たいへんでしたね。|Wah, itu pasti menyusahkan.|`,[
  ['Bagian tubuh Hadi yang diinjak adalah apa?','Kaki.','あしをふまれました menyatakan dampak pada bagian tubuh Hadi.'],
  ['Mengapa pakaian Hadi menjadi basah?','Ia kehujanan saat pulang.','あめにふられて、ふくもぬれました menyebut hujan sebagai kejadian yang berdampak pada Hadi.']
]);

add(22,'048f2898-cc0e-4cf4-be16-d18a94db71c7',['claire','anna'],'classroom',
  'Claire dan Anna membahas latihan berbicara. Guru menyuruh siswa berbicara, lalu Anna mendapatkan izin untuk mencoba lagi.',`
きょうの クラスでは、なにを しましたか。|Apa yang dilakukan dalam kelas hari ini?|
せんせいが、がくせいに にほんごで はなさせました。|Guru menyuruh siswa berbicara bahasa Jepang.|
アンナさんも はなしたんですね。どうでしたか。|Anna juga berbicara, ya. Bagaimana hasilnya?|
すこし むずかしかったので、「もういちど はなさせて ください」と おねがいしました。|Karena agak sulit, saya meminta, “Izinkan saya berbicara sekali lagi.”|berpikir
もういちど できましたか。|Apakah Anda bisa mencobanya lagi?|
はい。せんせいが もういちど はなさせて くれました。|Ya. Guru memberi saya kesempatan berbicara sekali lagi.|senang`,[
  ['Siapa yang menyuruh siswa berbicara bahasa Jepang?','Guru.','せんせいが…はなさせました menunjukkan guru sebagai penyuruh dan siswa sebagai pelaku berbicara.'],
  ['Apakah Anna mendapat kesempatan kedua?','Ya, guru mengizinkannya berbicara sekali lagi.','はなさせてくれました menunjukkan pemberian kesempatan yang Anna minta.']
]);

add(22,'1bd12c89-d0c9-48c8-8f9b-50c0499f68af',['aoi','ren'],'cafe',
  'Aoi menjelaskan tugas yang harus ditulis berulang kali meskipun ia enggan. Ren mengenali bentuk penuh dan pendek kausatif-pasif tanpa mengubah pelakunya.',`
きのう、せんせいに さくぶんを なんども かかせられました。|Kemarin saya disuruh guru menulis karangan berkali-kali meskipun enggan.|
なんかい かいたんですか。|Berapa kali Anda menulisnya?|
さんかいも かかされました。つかれました。|Saya disuruh menulis sampai tiga kali. Saya lelah.|
さんかいもですか。どこが むずかしかったんですか。|Sampai tiga kali? Bagian mana yang sulit?|kaget
ながいぶんが うまく かけませんでした。でも、さいごは よく なりました。|Saya tidak bisa menulis kalimat panjang dengan baik. Tetapi akhirnya menjadi lebih baik.|
そうですか。がんばりましたね。|Begitu, ya. Anda sudah berusaha keras.|senang`,[
  ['Siapa yang menyuruh Aoi menulis karangan berulang kali?','Guru.','せんせいに…かかせられました menandai guru sebagai penyuruh.'],
  ['Berapa kali Aoi menulis karangannya?','Tiga kali.','さんかいもかかされました menyatakan jumlah tiga kali; かかされる adalah bentuk pendek kausatif-pasif.']
]);

add(23,'4d327a80-19df-4383-9ecf-c2819ee2b9a1',['daniel','hadi'],'classroom',
  'Simulasi penerimaan tamu sekolah: Daniel berperan sebagai tamu yang ingin menemui guru, Hadi sebagai petugas. Mereka memakai sonkeigo untuk tindakan guru, bukan untuk diri sendiri.',`
せんせいは、もう おかえりに なりましたか。|Apakah Guru sudah pulang?|
いいえ。いま、となりの へやで はなされています。|Belum. Sekarang beliau sedang berbicara di ruangan sebelah.|
なんじに おかえりに なりますか。|Pukul berapa beliau akan pulang?|berpikir
ろくじの よていです。ここで おまちに なりますか。|Rencananya pukul enam. Apakah Anda ingin menunggu di sini?|
はい。すこし まちます。|Ya. Saya akan menunggu sebentar.|
わかりました。こちらに どうぞ。|Baik. Silakan di sini.|`,[
  ['Apakah guru sudah pulang ketika Daniel datang?','Belum; guru sedang berbicara di ruangan sebelah.','Hadi menjawab いいえ dan menjelaskan となりのへやではなされています.'],
  ['Siapa yang dihormati oleh おかえりになる dan はなされる dalam adegan ini?','Guru yang dibicarakan.','Kedua ungkapan menyampaikan tindakan guru secara hormat; Daniel dan Hadi tidak meninggikan tindakan diri sendiri.']
]);

add(23,'4ff7d528-056e-456a-b117-02174d3000ce',['aoi','claire'],'cafe',
  'Simulasi layanan kafe: Aoi berperan sebagai petugas dan Claire sebagai pelanggan. Petugas menawarkan menu, menanyakan pesanan dengan sonkeigo, lalu meminta pelanggan menunggu.',`
こちらの メニューを ごらんください。|Silakan melihat menu ini.|
ありがとうございます。おすすめは なんですか。|Terima kasih. Apa yang direkomendasikan?|berpikir
このケーキです。なにを めしあがりますか。|Kue ini. Anda ingin menyantap apa?|
では、ケーキと おちゃを おねがいします。|Kalau begitu, saya pesan kue dan teh.|senang
はい。すこし おまちください。|Baik. Mohon menunggu sebentar.|`,[
  ['Apa yang dipesan Claire?','Kue dan teh.','Claire menyebut ケーキとおちゃをおねがいします.'],
  ['Dalam adegan ini, mengapa Aoi memakai めしあがる?','Untuk menghormati tindakan makan/minum pelanggan.','Aoi bertindak sebagai petugas dan menanyakan pesanan Claire dengan verba hormat khusus.']
]);

add(24,'f0bb035c-2a94-4e0b-b943-e97fb4057610',['ren','anna'],'classroom',
  'Simulasi penerimaan peserta seminar: Ren berperan sebagai petugas dan Anna sebagai tamu. Petugas menyebut lokasi secara formal dan merendahkan tindakan mengantar serta membawakan barang. うけつけ berarti bagian penerimaan.',`
こちらが うけつけで ございます。|Di sinilah bagian penerimaan.|
ありがとうございます。かいぎしつは どこですか。|Terima kasih. Di mana ruang rapatnya?|
にかいに ございます。わたしが ごあんないいたします。|Di lantai dua. Saya akan mengantar Anda.|
おねがいします。このにもつは、ここに おいても いいですか。|Mohon bantuannya. Bolehkah barang bawaan ini saya taruh di sini?|
はい。にもつは、わたしが おもちします。|Boleh. Saya yang akan membawakan barangnya.|
では、おねがいします。|Kalau begitu, mohon bantuannya.|senang`,[
  ['Di lantai berapa ruang rapat berada?','Lantai dua.','Ren mengatakan にかいにございます.'],
  ['Siapa yang akan mengantar Anna dan membawakan barang?','Ren sebagai petugas.','わたしがごあんないいたします dan わたしがおもちします adalah tindakan petugas sendiri yang disampaikan secara merendah.']
]);

add(24,'7464741d-e555-41d3-9740-20a42e367d4f',['hadi','daniel'],'classroom',
  'Simulasi bimbingan membaca: Hadi berperan sebagai peserta dan Daniel sebagai pengajar. Peserta menyebut buku yang diterima, meminta bantuan formal, dan berterima kasih dengan menghormati pemberi bantuan.',`
せんせい、いただいた ほんを よみました。ありがとうございました。|Pak Guru, saya sudah membaca buku yang saya terima dari Anda. Terima kasih.|
どうでしたか。|Bagaimana bukunya?|
おもしろかったです。でも、このぶんが わかりません。よんで いただけませんか。|Menarik. Tetapi saya tidak memahami kalimat ini. Dapatkah Anda membacakannya?|bingung
ええ。ここは「なまえを かいて ください」です。|Tentu. Bagian ini berbunyi, “Tolong tulis nama.”|
わかりました。おしえて くださって、ありがとうございます。|Saya mengerti. Terima kasih sudah menjelaskannya.|senang
どういたしまして。|Sama-sama.|`,[
  ['Siapa yang menerima buku dalam simulasi ini?','Hadi sebagai peserta.','Hadi mengatakan いただいたほん, memakai sudut pandang menerima dari pengajar.'],
  ['Bantuan apa yang Hadi minta secara formal?','Membacakan kalimat yang belum ia pahami.','よんでいただけませんか meminta bantuan membaca; setelah dibacakan ia mengucapkan terima kasih.']
]);

export default dialogues;
