import {chapter,read,meaning} from './helpers.mjs';
export default [
chapter(15,'Pelayanan, Pilihan & Perubahan',['お願いします／いかがですか','になります','お〜ください','にします','くなります／になります'],['Memahami permintaan dan penawaran dalam pelayanan.','Memahami pilihan dan informasi pembayaran.','Menyatakan perubahan sifat atau keadaan.'],[
read('言います',['いいます','ききます','かいます','はなします'],'mengatakan'),read('聞きます',['ききます','いいます','かきます','いきます'],'mendengar'),read('買います',['かいます','いいます','きます','かきます'],'membeli',1),meaning('おかいけい',['pembayaran/tagihan','pesanan','kursi','menu'],1),meaning('ごうけい',['total','kembalian','diskon','satu barang'],1),meaning('おつり',['uang kembalian','harga','pesanan','meja'],1)],[
['Di restoran, Anda meminta air. Pilih ungkapan yang sesuai.',['みずを おねがいします。','みずに なります。','みずは いかがですか。','みずを のんでいます。'],'お願いします digunakan pelanggan untuk meminta sesuatu.'],
['Pelayan menawarkan kopi kepada pelanggan. Pilih ungkapannya.',['コーヒーは いかがですか。','コーヒーを おねがいします。','コーヒーに します。','コーヒーを のみました。'],'いかがですか dipakai untuk menawarkan sesuatu dengan sopan.'],
['Pelayan meminta pelanggan menunggu. Pilih ungkapan pelayanan yang tepat.',['おまちください。','おまってください。','おまつください。','おまちています。'],'お＋bentuk dasar ます tanpa ます＋ください menghasilkan おまちください.'],
['Pelayan mengarahkan pelanggan agar masuk. Pilih ungkapan yang sesuai.',['おはいりください。','おはいってください。','おはいるください。','おはいりますください。'],'はいります menjadi おはいりください dalam pola pelayanan ini.'],
['Total tagihan adalah 800 yen. Lengkapi ucapan kasir: はっぴゃくえんに （　）。',['なります','しますか','してください','なってもいいですか'],'Dalam pelayanan, 金額になります menyampaikan jumlah tagihan.',1],
['Anda sudah memutuskan memilih teh. Pilih kalimat yang menyatakan pilihan.',['おちゃに します。','おちゃに なります。','おちゃは いかがですか。','おちゃを のみませんでした。'],'にします menunjukkan keputusan memilih.',1],
['Pelayan bertanya コーヒーは いかがですか。 Anda ingin menolak dengan sopan. Pilih respons.',['いいえ、けっこうです。','はい、おねがいします。','コーヒーに します。','はい、ください。'],'いいえ、けっこうです menolak tawaran; tiga pilihan lainnya menerima.',0],
['Dulu mahal, sekarang menjadi murah. Lengkapi: やすく （　）。',['なりました','しましたか','ください','ですか'],'Perubahan kata sifat い memakai くなります; kejadian lampau menjadi なりました.',2],
['Kota yang dulu sepi sekarang menjadi ramai. Pilih kalimat yang sesuai.',['まちは にぎやかに なりました。','まちは にぎやかく なりました。','まちは にぎやかを なりました。','まちは にぎやかな なりました。'],'Perubahan kata sifat な memakai に なります.',2],
['Cuaca berubah menjadi dingin. Pilih bentuk yang tepat.',['さむく なりました。','さむいに なりました。','さむな なりました。','さむいで なりました。'],'さむい berubah menjadi さむく sebelum なります.',2]
],[
['コーヒー：さんびゃくえん\nおちゃ：にひゃくえん\nパン：ごひゃくえん\nアンナさんは コーヒーと パンに します。',[
['Apa yang dipilih Anna?',['Kopi dan roti','Teh dan roti','Kopi dan teh','Hanya roti'],'Kalimat terakhir menyebut コーヒーと パン.',1],
['Berapa total pilihan Anna?',['800 yen','700 yen','500 yen','300 yen'],'Kopi 300 yen ditambah roti 500 yen menjadi 800 yen.',1]]],
['この まちは まえは しずかでした。いまは にぎやかに なりました。みせの たべものは やすく なりました。',[
['Bagaimana perubahan kotanya?',['Dari tenang menjadi ramai','Dari ramai menjadi tenang','Dari dingin menjadi panas','Tidak berubah'],'しずかでした dan にぎやかに なりました menjelaskan perubahan kota.',2],
['Apa yang menjadi lebih murah?',['Makanan di toko','Kota','Tiket kereta','Buku'],'みせの たべもの diikuti やすく なりました.',2]]]
],[
['A: ごうけいで、きゅうひゃくえんに なります。','detail',['Berapa total tagihan?',['900 yen','600 yen','300 yen','9.000 yen'],'きゅうひゃくえん adalah 900 yen.',1]],
['A: おちゃは いかがですか。','intent',['Apa maksud pembicara?',['Menawarkan teh','Memesan teh','Menyatakan harga teh','Melarang minum teh'],'いかがですか adalah tawaran sopan.',0]],
['A: コーヒーは いかがですか。','response',['Anda ingin menerima tawaran. Pilih jawaban yang sesuai.',['はい、おねがいします。','いいえ、けっこうです。','いいえ、のみません。','いまは いりません。'],'はい、おねがいします menerima tawaran; yang lain menolak.',0]],
['A: コーヒーは さんびゃくえんです。パンは よんひゃくえんです。\nB: コーヒーと パンを おねがいします。','inference',['Berapa total pesanan?',['700 yen','300 yen','400 yen','800 yen'],'Pesanan terdiri dari kopi 300 yen dan roti 400 yen.',1]]
]),
chapter(16,'Waktu, Tanggal & Jadwal',['時点＋に','〜月〜日','いつ／何曜日／何月何日','毎週／毎月／毎年'],['Memahami tanggal dan hari.','Menanyakan serta menyampaikan jadwal tertentu.','Memahami kegiatan berulang.'],[
read('月曜日',['げつようび','かようび','すいようび','きんようび'],'Senin'),read('水曜日',['すいようび','もくようび','にちようび','どようび'],'Rabu'),read('毎週',['まいしゅう','まいにち','まいつき','まいとし'],'setiap minggu',2),meaning('あさって',['lusa','besok','kemarin','hari ini'],1),meaning('まいつき',['setiap bulan','setiap minggu','setiap hari','setiap tahun'],2),meaning('まいとし',['setiap tahun','setiap bulan','setiap minggu','setiap hari'],2)],[
['Kegiatan dilakukan pukul 9. Lengkapi: くじ（　）がっこうへ いきます。',['に','を','と','の'],'Waktu tertentu ditandai に.',1],
['Pilih bacaan tanggal “4 April”.',['しがつ よっか','よんがつ よっか','しがつ よんにち','よんがつ よんにち'],'April dibaca しがつ dan tanggal empat よっか.'],
['Pilih bacaan tanggal “1 Januari”.',['いちがつ ついたち','いちがつ いちにち','いちにち いちがつ','ついたち いちがつ'],'Tanggal satu dibaca ついたち; bulan mendahului tanggal.'],
['Anda menanyakan hari dalam seminggu. Lengkapi: テストは （　）ですか。',['なんようび','いくら','なんさい','なんにん'],'なんようび meminta nama hari.'],
['Anda menanyakan bulan dan tanggal ujian. Pilih pertanyaan.',['テストは なんがつ なんにちですか。','テストは なんにんですか。','テストは いくらですか。','テストは どんな ほんですか。'],'なんがつ なんにち menanyakan bulan dan tanggal.',1],
['Ujian dijadwalkan pada hari Jumat. Pilih jawaban untuk テストは なんようびですか。',['きんようびです。','ごじです。','ごにんです。','ごひゃくえんです。'],'Pertanyaan nama hari dijawab きんようび.'],
['Pilih ungkapan yang berarti “setiap minggu”.',['まいしゅう','らいしゅう','せんしゅう','こんしゅう'],'まいしゅう berarti setiap minggu, bukan satu minggu tertentu.',2],
['Kegiatan terjadi setiap tahun pada bulan April. Pilih kalimat.',['まいとし しがつに いきます。','まいつき しがつに いきます。','まいにち しがつに いきます。','せんしゅう しがつに いきます。'],'まいとし menunjukkan pengulangan tahunan.',2],
['Fakta: kelas berlangsung setiap Senin. Pilih kalimat yang sesuai.',['まいしゅう げつようびに クラスが あります。','まいしゅう きんようびに クラスが あります。','まいつき ついたちに クラスが あります。','まいとし しがつに クラスが あります。'],'まいしゅう げつようび menyatakan setiap Senin.',2],
['Pertanyaan いつ いきますか meminta informasi apa?',['Waktu pergi','Teman perjalanan','Harga perjalanan','Kendaraan yang digunakan'],'いつ meminta informasi waktu.',1]
],[
['にほんごの クラス：まいしゅう げつようびと もくようび。\nじかん：ごご ろくじから はちじまで。',[
['Pada hari apa kelas berlangsung?',['Senin dan Kamis','Senin dan Jumat','Selasa dan Kamis','Rabu dan Sabtu'],'げつようび adalah Senin; もくようび adalah Kamis.',0],
['Kapan kelas selesai?',['20.00','18.00','08.00','06.00'],'ごご はちじ berarti pukul 20.00.',1]]],
['テストは しがつ ふつかです。ごぜん くじに はじまります。まいつき ふつかに テストが あります。',[
['Tanggal berapa tes yang disebut?',['2 April','4 Februari','1 April','2 Januari'],'しがつ ふつか adalah 2 April.',0],
['Seberapa sering tes diadakan?',['Setiap bulan','Setiap minggu','Setiap hari','Setiap tahun'],'まいつき berarti setiap bulan.',2]]]
],[
['A: テストは なんようびですか。\nB: かようびです。','detail',['Tes dilaksanakan hari apa?',['Selasa','Senin','Kamis','Jumat'],'かようび berarti Selasa.',0]],
['A: テストは ごぜん くじですか。\nB: いいえ、じゅうじです。','intent',['Apa yang dikoreksi?',['Jam mulai tes','Tanggal tes','Jumlah siswa','Harga tes'],'Dugaan pukul sembilan dikoreksi menjadi sepuluh.',1]],
['A: たんじょうびは なんがつ なんにちですか。','response',['Faktanya ulang tahun Anda 3 Maret. Pilih jawaban.',['さんがつ みっかです。','さんじです。','さんにんです。','まいしゅうです。'],'Jawaban tanggal 3 Maret adalah さんがつ みっか.',0]],
['A: クラスは まいしゅう げつようびです。こんしゅうの テストは きんようびです。','inference',['Kegiatan mana yang disebut rutin setiap minggu?',['Kelas pada Senin','Tes pada Jumat','Tes pada Senin','Kelas setiap hari'],'まいしゅう menjelaskan kelas Senin; tes Jumat hanya dinyatakan untuk minggu ini.',2]]
]),
chapter(17,'Hobi & Kemampuan',['好き／嫌い／上手／下手（復習）','名詞＋ができます','どんな＋名詞'],['Membedakan kesukaan, kemahiran, dan kemampuan.','Menyatakan kemampuan atau ketidakmampuan dengan ができます.','Menanyakan jenis hobi dan memahami jawaban yang relevan.'],[
read('父',['ちち','はは','とも','こ'],'ayah sendiri'),read('母',['はは','ちち','ひと','て'],'ibu sendiri'),read('友だち',['ともだち','こだち','ははだち','ちちだち'],'teman'),meaning('ピアノ',['piano','sepeda','buku','kamera'],1),meaning('りょうり',['memasak/masakan','menyanyi','berenang','menulis'],1),meaning('スポーツ',['olahraga','musik','bahasa','makanan'],2)],[
['Fakta: Anna suka menyanyi tetapi belum mahir. Pilih pernyataan yang sesuai fakta.',['アンナさんは うたが すきです。','アンナさんは うたが じょうずです。','アンナさんは うたが きらいです。','アンナさんは りょうりが じょうずです。'],'Kesukaan tidak berarti kemahiran; fakta hanya mendukung うたが すきです.'],
['Apa perbedaan utama じょうずです dan できます?',['Mahir melakukan dibanding bisa melakukan','Suka dibanding benci','Lampau dibanding masa depan','Mahal dibanding murah'],'じょうず menilai tingkat kemahiran, sedangkan できます menyatakan kemampuan.'],
['Fakta: Anda bisa bermain piano. Pilih kalimat yang menyatakan kemampuan.',['ピアノが できます。','ピアノが すきです。','ピアノが きらいです。','ピアノが へたです。'],'できます menyatakan bisa; tiga pola lainnya menyatakan kesukaan atau tingkat kemahiran.',1],
['Fakta: Hadi tidak bisa berbahasa Jepang. Pilih kalimat.',['ハディさんは にほんごが できません。','ハディさんは にほんごが できます。','ハディさんは にほんごが すきです。','ハディさんは にほんごが じょうずです。'],'Negatif sopan kemampuan adalah できません.',1],
['Lengkapi pola kemampuan: テニス（　）できます。',['が','を','へ','から'],'Kemampuan dengan kata benda ditandai が.',1],
['Anda menanyakan apakah teman bisa bermain tenis. Pilih pertanyaan.',['テニスが できますか。','テニスが すきですか。','テニスは いくらですか。','テニスは どこですか。'],'できますか menanyakan kemampuan, bukan selera, harga, atau lokasi.',1],
['Pertanyaan: ピアノが できますか。 Faktanya Anda tidak bisa. Pilih jawaban.',['いいえ、できません。','はい、できます。','はい、じょうずです。','はい、まいにち します。'],'Jawaban negatif kemampuan adalah いいえ、できません.',1],
['Anda menanyakan jenis olahraga yang disukai. Pilih pertanyaan.',['どんな スポーツが すきですか。','スポーツは いくらですか。','スポーツは なんじですか。','スポーツが できますか。'],'どんな＋kata benda meminta jenis; がすきですか menanyakan selera.',2],
['Lengkapi pertanyaan tentang jenis buku: （　）ほんが すきですか。',['どんな','どう','いつ','だれ'],'どんな langsung menerangkan kata benda ほん.',2],
['Pertanyaan: どんな スポーツが できますか。 Pilih jawaban yang menyebut jenis olahraga.',['テニスが できます。','はい、すきです。','さんじです。','とても たかいです。'],'Pertanyaan meminta jenis olahraga yang bisa dilakukan; テニス memenuhi permintaan.',2]
],[
['アンナさんは テニスが すきです。テニスが できます。ハディさんは テニスが できません。ピアノが できます。',[
['Siapa yang bisa bermain tenis?',['Anna','Hadi','Keduanya','Tidak ada'],'Anna disebut テニスが できます, sedangkan Hadi できません.',1],
['Apa yang bisa dilakukan Hadi?',['Bermain piano','Bermain tenis','Berenang','Berbahasa Cina'],'Kemampuan yang disebut untuk Hadi adalah ピアノ.',1]]],
['アンナ：どんな ほんが すきですか。\nハディ：にほんごの ほんが すきです。\nアンナ：どんな スポーツが できますか。\nハディ：テニスが できます。',[
['Jenis buku apa yang disukai Hadi?',['Buku bahasa Jepang','Buku bahasa Inggris','Buku masakan','Buku olahraga'],'Jawaban pertama menyebut にほんごの ほん.',2],
['Apa yang ditanyakan Anna pada pertanyaan kedua?',['Jenis olahraga yang bisa dilakukan','Olahraga yang tidak disukai','Harga buku olahraga','Waktu bermain tenis'],'どんな スポーツが できますか menanyakan jenis dan kemampuan.',2]]]
],[
['A: ピアノが できますか。\nB: はい、できます。テニスは できません。','detail',['Apa yang bisa dilakukan pembicara kedua?',['Bermain piano','Bermain tenis','Keduanya','Tidak ada'],'Ia mengiyakan kemampuan piano lalu menyangkal kemampuan tenis.',1]],
['A: どんな おんがくが すきですか。','intent',['Informasi apa yang diminta pembicara?',['Jenis musik yang disukai','Kemampuan bermain piano','Harga alat musik','Jadwal konser'],'どんな おんがくが すきですか meminta jenis musik yang disukai.',2]],
['A: どんな スポーツが できますか。','response',['Faktanya Anda bisa bermain tenis. Pilih jawaban yang tepat.',['テニスが できます。','テニスが きらいです。','テニスは さんじです。','はい、おねがいします。'],'Jawaban menyebut jenis olahraga sekaligus kemampuan.',2]],
['A: アンナさんは ピアノが すきです。ピアノは できません。ハディさんは ピアノが できます。','inference',['Siapa yang suka piano tetapi belum bisa memainkannya?',['Anna','Hadi','Keduanya','Tidak disebutkan'],'Dua keterangan pertama membedakan kesukaan Anna dari kemampuannya.',0]]
])
];
