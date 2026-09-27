import {chapter,read,meaning} from './helpers.mjs';
export default [
chapter(8,'Keberadaan, Lokasi & Posisi',['に〜が あります／います','は〜に あります／います','どこ／どちら','の＋位置'],[
'Membedakan keberadaan benda dan makhluk hidup.','Menentukan lokasi serta posisi relatif dari informasi yang diberikan.','Memilih pertanyaan lokasi dan respons yang sesuai.'
],[read('上',['うえ','した','まえ','なか'],'atas',1),read('下',['した','うえ','そと','みぎ'],'bawah',1),read('右',['みぎ','ひだり','まえ','うしろ'],'kanan',1),meaning('となり',['sebelah','di dalam','di atas','di luar'],1),meaning('うしろ',['belakang','depan','kanan','bawah'],1),meaning('どこ',['di mana','berapa harga','berapa umur','yang mana'],2)],[
['Lengkapi keberadaan seekor kucing: へやに ねこが （　）。',['います','あります','ですか','じゃありません'],'Kucing adalah makhluk hidup sehingga keberadaannya memakai います.'],
['Lengkapi keberadaan sebuah buku: つくえの うえに ほんが （　）。',['あります','います','でしたか','じゃありません'],'Keberadaan buku memakai あります.'],
['Lengkapi: へや（　）いすが あります。',['に','を','へ','と'],'Lokasi keberadaan ditandai に.'],
['Lengkapi: へやに いす（　）あります。',['が','を','へ','と'],'が menandai benda yang ada di lokasi tersebut.'],
['Fakta: kucing berada di bawah meja. Pilih kalimat yang sesuai.',['ねこは つくえの したに います。','ねこは つくえの うえに います。','ねこは つくえの したに あります。','ねこは つくえの まえに あります。'],'した menunjukkan bawah dan います dipakai untuk kucing.',1],
['Urutan tempat dari kiri ke kanan: bank — sekolah — toko. Apa yang berada di sebelah kanan sekolah?',['みせ','ぎんこう','がっこう','えき'],'Dalam urutan tersebut, toko berada tepat di kanan sekolah.',1],
['Fakta: tas berada di dalam kotak. Lengkapi: かばんは はこの（　）に あります。',['なか','うえ','そと','うしろ'],'なか berarti dalam.',1],
['Anda mencari lokasi toilet. Pilih pertanyaan yang sesuai.',['トイレは どこですか。','トイレは いくらですか。','いま なんじですか。','おいくつですか。'],'どこですか meminta informasi lokasi.',2],
['Fakta: bank berada di sebelah sekolah. Pilih jawaban untuk ぎんこうは どこですか。',['がっこうの となりです。','はっさいです。','ごひゃくえんです。','くじです。'],'Jawaban lokasi harus menyatakan tempat, yaitu sebelah sekolah.',2],
['Fakta: di dalam kamar ada anjing. Pilih pertanyaan untuk mengetahui tempat anjing itu berada.',['いぬは どこに いますか。','いぬは どこに ありますか。','いぬは いくらですか。','どの ほんですか。'],'Untuk menanyakan lokasi anjing dipakai どこに いますか.',2]
],[
['つくえの うえに ほんが あります。つくえの したに ねこが います。いすの うえに かばんが あります。',[
['Di mana tas berada?',['Di atas kursi','Di bawah meja','Di atas meja','Di dalam tas'],'Kalimat terakhir menempatkan tas di atas kursi.',1],
['Apa yang berada di bawah meja?',['Kucing','Buku','Tas','Kursi'],'つくえの したに ねこが います menyebut kucing.',0]]],
['がっこうの みぎに ぎんこうが あります。がっこうの ひだりに みせが あります。ぎんこうの まえに ひとが います。',[
['Tempat apa yang berada di kiri sekolah?',['Toko','Bank','Stasiun','Toilet'],'みせ berada di ひだり, yaitu kiri.',1],
['Orang itu berada di mana?',['Di depan bank','Di dalam toko','Di belakang sekolah','Di kanan toko'],'Kalimat terakhir menyebut ぎんこうの まえ.',1]]]
],[
['A: かばんは どこですか。\nB: いすの したです。','detail',['Di mana tasnya?',['Di bawah kursi','Di atas kursi','Di bawah meja','Di dalam kotak'],'いすの した berarti bawah kursi.',1]],
['A: ねこは つくえの うえですか。\nB: いいえ、したです。','intent',['Apa yang dikoreksi pembicara kedua?',['Posisi kucing','Jumlah kucing','Pemilik meja','Harga meja'],'Dugaan atas meja dikoreksi menjadi bawah meja.',1]],
['A: がっこうは どこですか。','response',['Faktanya sekolah berada di sebelah bank. Pilih jawaban.',['ぎんこうの となりです。','さんびゃくえんです。','じゅうさいです。','ごぜん くじです。'],'Pertanyaan lokasi dijawab dengan posisi sekolah terhadap bank.',2]],
['A: へやに いぬが います。ねこは そとに います。','inference',['Hewan mana yang berada di luar kamar?',['Kucing','Anjing','Keduanya','Tidak ada'],'Anjing berada di kamar; kucing berada di luar.',0]]
]),
chapter(9,'Bepergian',['へ 行きます／来ます／帰ります','で＋交通','から〜まで','いつ／どこへ／だれと'],[
'Memilih arah perjalanan dan verba berdasarkan posisi pembicara.','Memahami sarana, asal, dan tujuan perjalanan.','Memahami pertanyaan waktu, tujuan, serta teman perjalanan.'
],[read('車',['くるま','でんしゃ','じてんしゃ','えき'],'mobil',1),read('駅',['えき','みせ','みち','くに'],'stasiun',1),read('電車',['でんしゃ','くるま','でんわ','じてんしゃ'],'kereta',1),meaning('バス',['bus','pesawat','kapal','sepeda'],1),meaning('ひこうき',['pesawat','bus','mobil','kereta'],1),meaning('だれと',['dengan siapa','ke mana','kapan','dari mana'],2)],[
['Anda berada di rumah dan akan menuju sekolah yang jauh dari rumah. Lengkapi: がっこうへ （　）。',['いきます','きます','かえります','あります'],'Pergerakan dari posisi pembicara menuju tempat lain memakai いきます.'],
['Anda sedang berada di sekolah. Teman akan bergerak menuju sekolah tempat Anda berada. Lengkapi: ともだちは がっこうへ （　）。',['きます','いきます','かえります','あります'],'Gerak menuju tempat pembicara berada memakai きます.'],
['Setelah selesai kegiatan di sekolah, Anda kembali ke rumah sendiri. Pilih verba untuk menyatakan kembali.',['かえります','きます','います','あります'],'かえります menyatakan kembali ke rumah atau tempat asal.'],
['Anda pergi naik kereta. Lengkapi: でんしゃ（　）がっこうへ いきます。',['で','に','を','の'],'Sarana transportasi ditandai で.',1],
['Perjalanan dimulai di rumah dan berakhir di stasiun. Lengkapi: うち（　）えきまで いきます。',['から','まで','と','を'],'から menandai titik asal perjalanan.',1],
['Perjalanan dimulai di sekolah dan berakhir di rumah. Lengkapi: がっこうから うち（　）かえります。',['まで','から','と','を'],'まで menandai titik akhir perjalanan.',1],
['Anda ingin mengetahui kapan teman akan berangkat. Pilih pertanyaan.',['いつ いきますか。','どこへ いきますか。','だれと いきますか。','いくらですか。'],'いつ menanyakan waktu perjalanan.',2],
['Anda ingin mengetahui tujuan perjalanan. Pilih pertanyaan.',['どこへ いきますか。','だれと いきますか。','いつ いきますか。','なんさいですか。'],'どこへ meminta informasi tujuan.',2],
['Anda ingin mengetahui orang yang menemani perjalanan. Pilih pertanyaan.',['だれと いきますか。','いつ いきますか。','どこへ いきますか。','なんじですか。'],'だれと menanyakan teman perjalanan.',2],
['Fakta: Anda ke sekolah bersama teman. Pilih jawaban untuk だれと いきますか。',['ともだちと いきます。','でんしゃで いきます。','がっこうへ いきます。','あした いきます。'],'Pertanyaan meminta orang yang menemani, bukan kendaraan, tempat, atau waktu.',2]
],[
['あした、アンナさんは ともだちと がっこうへ いきます。バスで いきます。',[
['Anna menggunakan kendaraan apa?',['Bus','Kereta','Mobil','Sepeda'],'バスで menyatakan sarana bus.',1],
['Dengan siapa Anna pergi?',['Teman','Guru','Ibu','Sendiri'],'ともだちと menyebut teman perjalanan.',2]]],
['ハディさんは うちから えきまで じてんしゃで いきます。えきから がっこうまで でんしゃで いきます。',[
['Kendaraan apa yang digunakan dari rumah ke stasiun?',['Sepeda','Kereta','Bus','Mobil'],'Bagian pertama perjalanan memakai じてんしゃ.',1],
['Apa tujuan akhir perjalanan Hadi?',['Sekolah','Rumah','Stasiun','Bank'],'Rute kedua berakhir di がっこう.',1]]]
],[
['A: どこへ いきますか。\nB: がっこうへ いきます。バスで いきます。','detail',['Apa tujuan perjalanan?',['Sekolah','Stasiun','Bank','Rumah'],'がっこうへ menyebut tujuan sekolah.',2]],
['A: ひとりで いきますか。\nB: いいえ、ともだちと いきます。','intent',['Apa yang dijelaskan pembicara kedua?',['Ia pergi bersama teman','Ia pergi sendiri','Ia pergi ke rumah','Ia pulang naik bus'],'Jawaban menyangkal bepergian sendiri dan menyebut ともだちと.',2]],
['A: いつ にほんへ いきますか。','response',['Pilih jawaban yang memberi informasi waktu.',['あした いきます。','ひこうきで いきます。','ともだちと いきます。','にほんへ いきます。'],'いつ meminta waktu; あした berarti besok.',2]],
['A: うちから えきまで バスで いきます。えきから がっこうまで でんしゃで いきます。','inference',['Di mana pembicara berganti sarana perjalanan?',['Stasiun','Rumah','Sekolah','Bank'],'Bus berakhir dan perjalanan kereta dimulai di stasiun.',1]]
]),
chapter(10,'Aktivitas Sehari-hari',['を','ます／ません／ました／ませんでした','毎日／いつも／時々／よく／ぜんぜん'],[
'Memilih bentuk kata kerja sopan sesuai waktu dan fakta kegiatan.','Memahami objek serta kosakata kegiatan sehari-hari.','Menafsirkan frekuensi kegiatan berdasarkan informasi nyata.'
],[read('見ます',['みます','よみます','かきます','いきます'],'melihat',1),read('書きます',['かきます','よみます','みます','のみます'],'menulis',1),read('読みます',['よみます','のみます','かいます','かきます'],'membaca',1),meaning('かきます',['menulis','membaca','makan','minum'],1),meaning('ときどき',['kadang-kadang','selalu','setiap hari','sama sekali tidak'],2),meaning('まいにち',['setiap hari','kemarin','besok','kadang-kadang'],2)],[
['Lengkapi objek kegiatan: パン（　）たべます。',['を','へ','と','から'],'Objek langsung dari たべます ditandai を.',1],
['Fakta: Anda membaca buku setiap hari. Pilih kalimat.',['まいにち ほんを よみます。','まいにち ほんを よみません。','きのう ほんを よみました。','きのう ほんを よみませんでした。'],'Kebiasaan sekarang memakai よみます dan まいにち.'],
['Fakta: kemarin Anda minum teh. Lengkapi: きのう おちゃを （　）。',['のみました','のみませんでした','のみます','のみません'],'Kejadian lampau positif memakai ました.'],
['Fakta: kemarin Anda tidak menonton televisi. Lengkapi: きのう テレビを （　）。',['みませんでした','みました','みます','みません'],'Kejadian lampau negatif memakai ませんでした.'],
['Anda tidak minum kopi sebagai kebiasaan. Pilih bentuk sopan yang tepat.',['コーヒーを のみません。','コーヒーを のみました。','コーヒーを のみませんでした。','コーヒーを のみます。'],'Kebiasaan negatif memakai ません.'],
['Ubah かきます menjadi lampau positif sopan.',['かきました','かきません','かきませんでした','かくです'],'Akhiran ます menjadi ました untuk lampau positif.'],
['Ubah たべます menjadi lampau negatif sopan.',['たべませんでした','たべました','たべません','たべるでした'],'Lampau negatif sopan memakai ませんでした.'],
['Dalam seminggu, Anna belajar pada semua tujuh hari. Kata yang paling tepat untuk “setiap hari” adalah ...',['まいにち','ときどき','きのう','あした'],'まいにち secara tepat menyatakan setiap hari.',2],
['Maksudnya “sama sekali tidak menonton televisi”. Lengkapi: ぜんぜん テレビを （　）。',['みません','みます','みました','よみます'],'ぜんぜん dalam pola ini berpasangan dengan bentuk negatif.',2],
['Pilih ungkapan yang secara langsung berarti “sering membaca buku”.',['よく ほんを よみます。','ときどき ほんを よみます。','ぜんぜん ほんを よみません。','きのう ほんを よみました。'],'よく menyatakan sering; ときどき berarti kadang-kadang.',2]
],[
['きのう、アンナさんは パンを たべました。おちゃを のみました。テレビを みませんでした。',[
['Apa yang diminum Anna kemarin?',['Teh','Kopi','Air','Susu'],'Teks menyebut おちゃを のみました.',1],
['Apa yang tidak dilakukan Anna kemarin?',['Menonton televisi','Makan roti','Minum teh','Semua kegiatan dilakukan'],'みませんでした menyatakan tidak menonton pada waktu lampau.',0]]],
['ハディさんは まいにち にほんごを べんきょうします。ときどき テレビを みます。コーヒーは ぜんぜん のみません。',[
['Apa kegiatan yang dilakukan setiap hari?',['Belajar bahasa Jepang','Menonton televisi','Minum kopi','Membeli buku'],'まいにち melekat pada kegiatan belajar bahasa Jepang.',2],
['Informasi mana yang benar?',['Hadi sama sekali tidak minum kopi','Hadi minum kopi setiap hari','Hadi tidak pernah menonton televisi','Hadi hanya belajar sesekali'],'ぜんぜん のみません menjelaskan kebiasaan tidak minum kopi.',2]]]
],[
['A: きのう なにを たべましたか。\nB: パンを たべました。','detail',['Apa yang dimakan kemarin?',['Roti','Ikan','Nasi','Buah'],'Jawaban menyebut パン.',1]],
['A: きのう テレビを みましたか。\nB: いいえ、みませんでした。ほんを よみました。','intent',['Apa maksud jawaban pembicara kedua?',['Mengoreksi dugaan dan menyebut kegiatan yang dilakukan','Meminta izin menonton','Mengajak membaca besok','Menyatakan menonton setiap hari'],'Ia tidak menonton kemarin; ia membaca buku.',0]],
['A: まいにち コーヒーを のみますか。','response',['Anda sama sekali tidak minum kopi. Pilih jawaban.',['いいえ、ぜんぜん のみません。','はい、まいにち のみます。','はい、よく のみます。','きのう のみました。'],'ぜんぜん のみません cocok dengan kebiasaan sama sekali tidak minum.',2]],
['A: きのうは ほんを よみませんでした。きょうは よみます。','inference',['Pernyataan mana yang sesuai?',['Kemarin tidak membaca; hari ini membaca','Kemarin dan hari ini membaca','Kemarin membaca; hari ini tidak','Kedua hari tidak membaca'],'Bentuk lampau negatif dan bentuk saat ini membedakan dua hari.',0]]
]),
chapter(11,'Jumlah & Kata Bantu Bilangan',['を＋数＋動詞','が＋数＋あります／います','いくつ／何人／何枚','ひとつ〜とお'],[
'Menggunakan penghitung sesuai jenis benda atau orang.','Memahami jumlah dalam kalimat kegiatan dan keberadaan.','Memilih pertanyaan jumlah dan responsnya.'
],[read('一人',['ひとり','いちにん','ひとつ','いっぽん'],'satu orang'),read('二人',['ふたり','ににん','ふたつ','にまい'],'dua orang'),read('毎週',['まいしゅう','まいにち','まいつき','まいとし'],'setiap minggu'),meaning('いつつ',['lima buah','empat buah','enam buah','tujuh buah']),meaning('ここのつ',['sembilan buah','delapan buah','enam buah','sepuluh buah']),meaning('とお',['sepuluh buah','tujuh buah','delapan buah','sembilan buah'])],[
['Ada tiga siswa. Lengkapi: がくせいが さん（　）います。',['にん','まい','ほん','だい'],'Penghitung orang pada jumlah tiga adalah にん.'],
['Ada dua lembar kertas. Lengkapi: かみが に（　）あります。',['まい','にん','だい','さい'],'Lembaran kertas memakai penghitung まい.'],
['Ada dua mobil. Lengkapi: くるまが に（　）あります。',['だい','にん','まい','さい'],'Kendaraan seperti mobil memakai penghitung だい.'],
['Fakta: Anda membeli tiga apel. Pilih kalimat dengan hitungan umum yang sesuai.',['りんごを みっつ かいます。','りんごを ふたつ かいます。','りんごを よっつ かいます。','りんごを いつつ かいます。'],'みっつ menunjukkan jumlah tiga.',1],
['Fakta: di ruangan ada dua orang. Pilih kalimat yang sesuai.',['へやに ひとが ふたり います。','へやに ひとが ふたつ あります。','へやに ひとが さんにん います。','へやに ひとが ふたり あります。'],'Dua orang memakai ふたり dan keberadaan orang memakai います.',1],
['Fakta: di atas meja ada empat apel. Pilih kalimat yang sesuai.',['つくえの うえに りんごが よっつ あります。','つくえの うえに りんごが よっつ います。','つくえの うえに りんごが みっつ あります。','つくえの したに りんごが よっつ あります。'],'よっつ berarti empat; apel berada di atas meja dan memakai あります.',1],
['Anda menanyakan jumlah orang. Pilih pertanyaannya.',['なんにん いますか。','なんまい ありますか。','いくらですか。','なんさいですか。'],'なんにん meminta jumlah orang.',2],
['Anda menanyakan jumlah lembar kertas. Lengkapi: かみは （　）ありますか。',['なんまい','なんにん','なんさい','なんじ'],'なんまい digunakan untuk jumlah lembaran.',2],
['Pertanyaan: りんごは いくつ ありますか。 Fakta: ada enam apel. Pilih jawabannya.',['むっつ あります。','いつつ あります。','ななつ あります。','やっつ あります。'],'Hitungan umum enam adalah むっつ.',2],
['Fakta: Anda makan satu apel. Lengkapi: りんごを （　）たべました。',['ひとつ','ひとり','いちまい','いちだい'],'Satu apel memakai hitungan umum ひとつ.',1]
],[
['つくえの うえに りんごが みっつ あります。かみが ごまい あります。へやに がくせいが ふたり います。',[
['Berapa jumlah lembar kertas?',['Lima','Tiga','Dua','Empat'],'ごまい berarti lima lembar.',0],
['Berapa siswa di ruangan?',['Dua orang','Tiga orang','Lima orang','Satu orang'],'ふたり berarti dua orang.',1]]],
['アンナさんは りんごを よっつ かいました。ハディさんは りんごを ふたつ かいました。ハディさんは りんごを ひとつ たべました。',[
['Berapa apel yang dibeli Anna?',['Empat','Dua','Satu','Lima'],'Anna membeli よっつ, yaitu empat.',1],
['Siapa yang disebut makan satu apel?',['Hadi','Anna','Keduanya','Tidak ada'],'Kalimat terakhir menyebut Hadi makan ひとつ.',1]]]
],[
['A: がくせいは なんにん いますか。\nB: よにん います。','detail',['Berapa jumlah siswa?',['Empat orang','Dua orang','Tiga orang','Lima orang'],'よにん berarti empat orang.',0]],
['A: かみは さんまいですか。\nB: いいえ、ごまいです。','intent',['Informasi apa yang dikoreksi?',['Jumlah lembar kertas','Harga kertas','Pemilik kertas','Warna kertas'],'Jumlah tiga lembar dikoreksi menjadi lima lembar.',0]],
['A: りんごは いくつ ありますか。','response',['Faktanya ada delapan apel. Pilih jawabannya.',['やっつ あります。','やっつ います。','はちにん います。','はちじです。'],'やっつ adalah delapan buah dan apel memakai あります.',2]],
['A: アンナさんは ほんを にさつ かいました。ハディさんも にさつ かいました。','inference',['Pernyataan mana yang sesuai?',['Anna dan Hadi masing-masing membeli dua buku','Hanya Anna membeli buku','Hadi membeli tiga buku','Anna membeli satu buku'],'も menyatakan Hadi juga membeli jumlah yang sama, yaitu dua buku.',1]]
])
];
