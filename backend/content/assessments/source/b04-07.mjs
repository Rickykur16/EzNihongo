import {chapter,read,meaning} from './helpers.mjs';
export default [
chapter(4,'Benda di Sekitar',['これ／それ／あれ','この／その／あの／どの＋名詞','の','そうです／ちがいます'],[
'Memilih kata tunjuk berdasarkan posisi pembicara, lawan bicara, dan benda.',
'Memahami jenis atau hubungan benda dengan の.',
'Memilih konfirmasi atau koreksi yang sesuai informasi.'
],[read('本',['ほん','はな','さかな','ひと'],'buku'),read('花',['はな','ほん','くに','なまえ'],'bunga'),read('魚',['さかな','はな','ほん','がっこう'],'ikan'),meaning('えんぴつ',['pensil','payung','sepatu','tas']),meaning('かばん',['tas','buku','bunga','jam']),meaning('かさ',['payung','ikan','pensil','kamus'])],[
['Anda memegang sebuah buku. Lawan bicara berada jauh dari buku itu. Lengkapi: （　）は ほんです。',['これ','それ','あれ','どれ'],'これ menunjuk benda dekat pembicara.'],
['Lawan bicara memegang payung, jauh dari Anda. Lengkapi ucapan Anda: （　）は かさです。',['それ','これ','あれ','どれ'],'それ menunjuk benda dekat lawan bicara.'],
['Tas berada jauh dari Anda dan lawan bicara. Lengkapi: （　）は かばんです。',['あれ','これ','それ','どれ'],'あれ menunjuk benda jauh dari kedua orang.'],
['Pensil ada di tangan Anda. Lengkapi tanpa menambah kata: （　）えんぴつは わたしのです。',['この','これ','それ','あれ'],'Sebelum kata benda えんぴつ diperlukan この, bukan kata tunjuk yang berdiri sendiri.'],
['Buku ada di tangan lawan bicara, jauh dari Anda. Lengkapi: （　）ほんは にほんごの ほんですか。',['その','この','あの','これ'],'その menerangkan buku dekat lawan bicara.'],
['Anda ingin menanyakan buku yang mana. Lengkapi: （　）ほんですか。',['どの','この','その','あの'],'どの＋kata benda meminta lawan bicara menentukan pilihan.'],
['Pilih frasa yang berarti “buku bahasa Jepang”.',['にほんごの ほん','ほんの にほんご','にほんごも ほん','ほんは にほんご'],'の menghubungkan にほんご sebagai jenis/isi dengan ほん sebagai benda utama.',1],
['Fakta: tas ini milik Anna. Pilih pernyataan yang sesuai.',['これは アンナさんの かばんです。','これは わたしの かばんです。','これは アンナさんの ほんです。','これは ハディさんの かばんです。'],'Hanya pilihan yang menyebut tas milik Anna sesuai fakta.',1],
['Teman bertanya apakah benda itu kamus. Faktanya benar. Pilih jawaban konfirmasi.',['はい、そうです。','いいえ、ちがいます。','はじめまして。','おなまえは。'],'はい、そうです mengonfirmasi bahwa pernyataan lawan bicara benar.',2],
['Teman menyebut benda itu pensil, padahal benda itu pulpen. Pilih koreksi yang sesuai.',['いいえ、ちがいます。ボールペンです。','はい、そうです。','いいえ、かばんです。','はじめまして。'],'Koreksi perlu menyangkal identifikasi pensil dan menyatakan bahwa bendanya pulpen.',2]
],[
['アンナです。これは わたしの かばんです。これは ハディさんの ほんです。にほんごの ほんです。',[
['Benda milik Hadi adalah apa?',['Buku','Tas','Payung','Pensil'],'Teks menyebut ハディさんの ほん.',1],
['Apa jenis buku tersebut?',['Buku bahasa Jepang','Buku bahasa Inggris','Buku bahasa Indonesia','Buku bahasa Cina'],'にほんごの ほん berarti buku bahasa Jepang.',1]]],
['アンナ：これは じしょですか。\nハディ：いいえ、ちがいます。ノートです。\nアンナ：そうですか。',[
['Benda yang ditanyakan sebenarnya apa?',['Buku catatan','Kamus','Tas','Jam'],'Hadi mengoreksi dugaan kamus dengan ノート.',2],
['Mengapa Hadi mengatakan ちがいます?',['Dugaan Anna salah','Anna memperkenalkan diri','Benda itu tidak ada','Hadi tidak tahu namanya'],'Anna menduga kamus; Hadi tahu bahwa itu buku catatan.',2]]]
],[
['A: これは わたしの ほんです。にほんごの ほんです。','detail',['Buku yang disebut berbahasa apa?',['Jepang','Inggris','Indonesia','Cina'],'Pembicara menyebut にほんごの ほん.',1]],
['A: これは えんぴつですか。\nB: いいえ、ボールペンです。','intent',['Apa yang dilakukan pembicara kedua?',['Mengoreksi nama benda','Menyebut harga benda','Memperkenalkan diri','Menanyakan pemilik benda'],'Pembicara kedua menyangkal pensil dan menyebut pulpen.',2]],
['A: これは にほんごの ほんですか。','response',['Faktanya buku itu memang buku bahasa Jepang. Pilih jawaban yang sesuai.',['はい、そうです。','いいえ、ちがいます。','はじめまして。','おなまえは。'],'Pertanyaan benar, sehingga respons yang tepat adalah konfirmasi.',2]],
['A: この かばんは わたしのです。\nB: あの かばんも わたしのですか。\nA: いいえ、あの かばんは ハディさんのです。','inference',['Tentang tas yang jauh, informasi mana yang benar?',['Tas itu milik Hadi','Tas itu milik pembicara pertama','Tas itu milik pembicara kedua','Tas itu sebuah buku'],'あの menunjukkan tas yang jauh; pembicara pertama menyebut pemiliknya Hadi.',0]]
]),
chapter(5,'Angka, Waktu & Uang',['いくら','今〜時〜分','〜から〜まで','何歳／おいくつ'],[
'Memahami harga dan bacaan angka sederhana.','Memahami jam serta awal dan akhir rentang waktu.','Memahami pertanyaan dan informasi umur.'
],[read('四時',['よじ','よんじ','しじ','よじゅう'],'pukul empat',1),read('九時',['くじ','きゅうじ','きゅじ','くじゅう'],'pukul sembilan',1),read('三百円',['さんびゃくえん','さんひゃくえん','さんぴゃくえん','さんびゃくねん'],'tiga ratus yen'),read('六分',['ろっぷん','ろくふん','ろっふん','ろくぶん'],'enam menit',1),meaning('ごぜん',['pagi/sebelum tengah hari','sesudah tengah hari','umur','harga'],1),meaning('なんさい',['berapa umur','berapa harga','pukul berapa','benda yang mana'],2)],[
['Anda ingin mengetahui harga tas. Pilih pertanyaannya.',['この かばんは いくらですか。','この かばんは なんさいですか。','いま なんじですか。','おなまえは。'],'いくら digunakan untuk menanyakan harga.'],
['Label menunjukkan harga 500 yen. Pilih jawaban untuk pertanyaan harga.',['ごひゃくえんです。','ごじです。','ごさいです。','ごふんです。'],'Harga memakai satuan えん.'],
['Anda ingin mengetahui waktu saat ini. Lengkapi: いま （　）ですか。',['なんじ','いくら','なんさい','どの'],'なんじ meminta informasi jam saat ini.',1],
['Jam menunjukkan 08.30 pagi. Pilih informasi yang tepat.',['ごぜん はちじ はんです。','ごご はちじ はんです。','ごぜん はちじです。','ごぜん さんじ はんです。'],'08.30 pagi adalah ごぜん はちじ はん.',1],
['Kelas mulai pukul 9 dan berakhir pukul 12. Lengkapi: くじ（　）じゅうにじまでです。',['から','まで','の','も'],'から menandai awal rentang waktu.',1],
['Toko buka pukul 10 dan tutup pukul 18. Lengkapi: じゅうじから ろくじ（　）です。',['まで','から','か','も'],'まで menandai akhir rentang waktu.',1],
['Tertulis: ごご さんじから ごじまで. Kapan kegiatan selesai?',['Pukul 17.00','Pukul 15.00','Pukul 03.00','Pukul 05.00'],'Akhir rentang adalah ごご ごじ, yaitu pukul 17.00.',1],
['Anda menanyakan umur orang lain dengan sopan. Pilih ungkapannya.',['おいくつですか。','いくらですか。','いま なんじですか。','どの ほんですか。'],'おいくつですか menanyakan umur dengan sopan.',2],
['Fakta: Hana berumur delapan tahun. Pilih kalimat yang sesuai.',['ハナさんは はっさいです。','ハナさんは はちじです。','ハナさんは はっぴゃくえんです。','ハナさんは はっぷんです。'],'Umur delapan tahun dinyatakan はっさい.',2],
['Pilih respons yang sesuai: なんさいですか。 Fakta: Anda 19 tahun.',['じゅうきゅうさいです。','じゅうきゅうじです。','じゅうきゅうえんです。','じゅうきゅうふんです。'],'Pertanyaan umur dijawab dengan satuan さい.',2]
],[
['ノート：さんびゃくえん\nほん：はっぴゃくえん\nかばん：にせんえん',[
['Berapa harga buku catatan?',['300 yen','800 yen','2.000 yen','100 yen'],'ノート diberi harga さんびゃくえん.'],
['Benda apa yang harganya 800 yen?',['Buku','Buku catatan','Tas','Payung'],'ほん diberi harga はっぴゃくえん.']]],
['にほんごの クラス：ごぜん くじから じゅういちじまで。\nアンナさん：じゅうはっさい。ハディさん：じゅうきゅうさい。',[
['Kapan kelas selesai?',['11.00 pagi','09.00 pagi','11.00 malam','09.00 malam'],'Akhir kelas adalah ごぜん じゅういちじ.',1],
['Berapa umur Hadi?',['19 tahun','18 tahun','11 tahun','9 tahun'],'Profil Hadi menyebut じゅうきゅうさい.',2]]]
],[
['A: この ほんは いくらですか。\nB: ろっぴゃくえんです。','detail',['Berapa harga buku?',['600 yen','300 yen','800 yen','6.000 yen'],'ろっぴゃくえん adalah 600 yen.']],
['A: クラスは くじからですか。\nB: いいえ、じゅうじからです。','intent',['Apa yang dikoreksi pembicara kedua?',['Waktu mulai kelas','Harga kelas','Umur siswa','Waktu selesai kelas'],'Pembicara kedua mengoreksi awal kelas dari pukul sembilan menjadi sepuluh.',1]],
['A: おいくつですか。','response',['Fakta: Anda 18 tahun. Pilih jawaban yang sesuai.',['じゅうはっさいです。','じゅうはちじです。','じゅうはちえんです。','じゅうはちふんです。'],'おいくつ menanyakan umur, sehingga jawabannya memakai さい.',2]],
['A: クラスは ごぜん くじから じゅうじまでです。テストは ごぜん じゅういちじからです。','inference',['Apa yang mulai setelah kelas selesai?',['Tes pukul 11 pagi','Tes pukul 9 pagi','Kelas pukul 11 pagi','Tes pukul 10 malam'],'Kelas berakhir pukul 10 pagi; tes mulai pukul 11 pagi.',1]]
]),
chapter(6,'Kata Sifat い',['いです／くないです','かったです／くなかったです','い＋名詞','とても／あまり','どうですか'],[
'Memilih bentuk kata sifat い sesuai waktu dan keadaan.','Menggunakan kata sifat untuk menerangkan benda dan derajatnya.','Memahami pertanyaan serta deskripsi sifat dalam konteks.'
],[read('高い',['たかい','やすい','ながい','ふるい'],'tinggi/mahal'),read('安い',['やすい','たかい','しろい','あたらしい'],'murah'),read('新しい',['あたらしい','ふるい','おおきい','ちいさい'],'baru'),meaning('おいしい',['enak','panjang','putih','sibuk'],2),meaning('あつい',['panas','dingin','murah','pendek'],2),meaning('ながい',['panjang','baru','kecil','dingin'],2)],[
['Ubah たかい menjadi bentuk negatif sopan saat ini.',['たかくないです','たかいないです','たかかったです','たかくなかったです'],'Negatif saat ini: akhiran い berubah menjadi くないです.'],
['Kemarin cuaca panas. Pilih bentuk lampau positif dari あつい.',['あつかったです','あついです','あつくないです','あつくなかったです'],'Lampau positif kata sifat い memakai かったです.'],
['Kemarin makanan itu tidak enak. Pilih bentuk yang tepat.',['おいしくなかったです','おいしかったです','おいしくないです','おいしいです'],'Konteks lampau negatif membutuhkan くなかったです.'],
['Sekarang cuaca tidak dingin. Lengkapi: きょうは （　）。',['さむくないです','さむかったです','さむくなかったです','さむいです'],'Keadaan sekarang negatif memakai さむくないです.'],
['Pilih frasa yang berarti “buku baru”.',['あたらしい ほん','あたらしく ほん','あたらしいな ほん','あたらしかったです ほん'],'Kata sifat い langsung mendahului kata benda.',1],
['Pilih frasa yang berarti “tas kecil”.',['ちいさい かばん','ちいさなです かばん','ちいさく かばん','ちいさいな かばん'],'ちいさい langsung menerangkan かばん tanpa な.',1],
['Makanan ini sangat enak. Lengkapi: （　）おいしいです。',['とても','あまり','なんじ','どの'],'とても menunjukkan derajat sangat pada pernyataan positif.',1],
['Maksudnya “tidak begitu mahal”. Lengkapi: あまり （　）。',['たかくないです','たかいです','たかかったです','たかい ほんです'],'あまり pada pola ini dipakai bersama bentuk negatif.',1],
['Anda meminta pendapat teman tentang makanan. Pilih pertanyaan yang tepat.',['この たべものは どうですか。','この たべものは なんさいですか。','いま なんじですか。','おなまえは。'],'どうですか meminta penilaian atau kesan tentang makanan.',2],
['Pertanyaan: この ほんは どうですか。 Pilih jawaban yang menyatakan buku itu menarik.',['おもしろいです。','つまらないです。','さむいです。','はっさいです。'],'おもしろいです menyatakan bahwa buku itu menarik.',2]
],[
['この かばんは あたらしいです。ちいさいです。あまり たかくないです。',[
['Bagaimana ukuran tas itu?',['Kecil','Besar','Panjang','Tidak dijelaskan'],'Teks menyebut ちいさいです.',2],
['Bagaimana harga tas menurut teks?',['Tidak begitu mahal','Sangat mahal','Gratis','Tidak dijelaskan'],'あまり たかくないです berarti tidak begitu mahal.',1]]],
['きのうは あつかったです。きょうは あつくないです。きのうの たべものは とても おいしかったです。',[
['Apa perbedaan cuaca kemarin dan hari ini?',['Kemarin panas; hari ini tidak panas','Kemarin tidak panas; hari ini panas','Keduanya panas','Keduanya dingin'],'Dua kalimat pertama membedakan panas kemarin dan tidak panas hari ini.'],
['Bagaimana makanan kemarin?',['Sangat enak','Tidak enak','Tidak begitu enak','Sangat mahal'],'とても おいしかったです menyatakan sangat enak pada waktu lampau.',1]]]
],[
['A: この ほんは ながいですか。\nB: いいえ、みじかいです。','detail',['Bagaimana buku itu menurut jawaban pembicara kedua?',['Pendek','Panjang','Mahal','Baru'],'Pembicara kedua mengatakan みじかいです.',2]],
['A: きのうは さむかったですね。\nB: いいえ、さむくなかったです。','intent',['Apa maksud jawaban pembicara kedua?',['Menyangkal bahwa kemarin dingin','Menyatakan hari ini dingin','Menanyakan suhu besok','Menyetujui bahwa kemarin dingin'],'さむくなかったです adalah penyangkalan keadaan dingin di masa lampau.']],
['A: この りょうりは どうですか。','response',['Pilih jawaban yang berarti “sangat enak”.',['とても おいしいです。','あまり おいしくないです。','とても たかいです。','あたらしいです。'],'Pertanyaan meminta kesan makanan; とても おいしいです menyatakan sangat enak.',2]],
['A: この ほんは おもしろいです。あの ほんは あまり おもしろくないです。','inference',['Buku mana yang dinilai menarik?',['Buku yang dekat pembicara','Buku yang jauh dari kedua pembicara','Kedua buku dinilai sangat menarik','Tidak ada buku yang menarik'],'この ほん mendapat penilaian positif, sedangkan あの ほん tidak begitu menarik.',1]]
]),
chapter(7,'Kata Sifat な',['な形容詞です／じゃありません','な＋名詞','好き／嫌い／上手／下手','で／くて','でした／じゃありませんでした'],[
'Memilih bentuk kata sifat な sesuai waktu dan polaritas.','Menerangkan benda dan menggabungkan sifat.','Membedakan kesukaan dengan kemahiran.'
],[read('気',['き','ひと','くに','はな'],'semangat'),read('男',['おとこ','おんな','ひと','こども'],'laki-laki'),read('女',['おんな','おとこ','くに','はな'],'perempuan'),meaning('しずか',['tenang','ramai','mahal','panjang'],1),meaning('にぎやか',['ramai','sepi','dingin','kecil'],1),meaning('へた',['kurang mahir','sangat suka','terkenal','sehat'],2)],[
['Ubah しずかです menjadi negatif saat ini.',['しずかじゃありません','しずかくないです','しずかでした','しずかじゃありませんでした'],'Kata sifat な memakai じゃありません untuk negatif saat ini.'],
['Tempat itu ramai kemarin. Pilih bentuk lampau positif.',['にぎやかでした','にぎやかです','にぎやかじゃありません','にぎやかじゃありませんでした'],'Bentuk sopan lampau positif kata sifat な memakai でした.'],
['Kemarin Anda tidak sehat. Pilih kalimat yang sesuai.',['きのうは げんきじゃありませんでした。','きのうは げんきでした。','きょうは げんきです。','きょうは げんきじゃありません。'],'Konteks kemarin dan negatif membutuhkan じゃありませんでした.'],
['Pilih frasa “kota yang tenang”.',['しずかな まち','しずか まち','しずかい まち','しずかです まち'],'Sebelum kata benda, kata sifat な memakai な.',1],
['Pilih frasa “orang yang ramah/baik hati”.',['しんせつな ひと','しんせつい ひと','しんせつく ひと','しんせつです ひと'],'しんせつ adalah kata sifat な.',1],
['Gabungkan: この まちは しずかです。きれいです。',['この まちは しずかで、きれいです。','この まちは しずかくて、きれいです。','この まちは しずかな、きれいです。','この まちは しずかいで、きれいです。'],'Kata sifat な menghubungkan sifat dengan で.',1],
['Gabungkan: この へやは あかるいです。きれいです。',['この へやは あかるくて、きれいです。','この へやは あかるいで、きれいです。','この へやは あかるな、きれいです。','この へやは あかるくないで、きれいです。'],'Kata sifat い berubah menjadi くて ketika menghubungkan sifat positif.',1],
['Fakta: Anna menyukai musik. Pilih kalimat yang sesuai.',['アンナさんは おんがくが すきです。','アンナさんは おんがくが きらいです。','アンナさんは おんがくが へたです。','アンナさんは げんきじゃありません。'],'すき menyatakan kesukaan, bukan kemahiran.',2],
['Fakta: Hadi mahir memasak. Pilih kalimat yang sesuai.',['ハディさんは りょうりが じょうずです。','ハディさんは りょうりが へたです。','ハディさんは りょうりが きらいです。','ハディさんは しずかです。'],'じょうず menyatakan kemahiran.',2],
['Seseorang kurang mahir menyanyi. Kata mana yang tepat?',['へた','すき','にぎやか','しんせつ'],'へた menyatakan kurang mahir; すき hanya menyatakan kesukaan.',2]
],[
['この まちは しずかで、きれいです。あの まちは にぎやかです。',[
['Bagaimana kota yang dekat pembicara?',['Tenang dan bersih/indah','Ramai dan mahal','Tidak tenang','Tidak dijelaskan'],'この まち digambarkan しずかで、きれい.',1],
['Kota mana yang ramai?',['Kota yang jauh','Kota yang dekat','Kedua kota','Tidak ada'],'あの まち merujuk kota yang jauh.',1]]],
['アンナさんは うたが すきです。うたが へたです。ハディさんは りょうりが じょうずです。',[
['Informasi mana yang benar tentang Anna?',['Suka menyanyi tetapi kurang mahir','Tidak suka menyanyi','Mahir menyanyi','Mahir memasak'],'Anna disebut menyukai nyanyian namun kurang mahir.',2],
['Siapa yang mahir memasak?',['Hadi','Anna','Keduanya','Tidak disebutkan'],'Kalimat terakhir menyebut Hadi mahir memasak.',2]]]
],[
['A: この へやは しずかですか。\nB: はい、しずかです。きれいです。','detail',['Bagaimana ruangan itu?',['Tenang dan bersih/indah','Ramai dan kotor','Tidak tenang','Hanya disebut mahal'],'Dua sifat yang disebut adalah しずか dan きれい.',1]],
['A: ハディさんは うたが じょうずですね。\nB: いいえ、りょうりが じょうずです。','intent',['Apa yang dikoreksi?',['Bidang kemahiran Hadi','Nama Hadi','Umur Hadi','Waktu memasak'],'Pujian kemahiran menyanyi dikoreksi menjadi kemahiran memasak.',2]],
['A: きのうは げんきでしたか。','response',['Faktanya kemarin Anda sehat. Pilih respons yang tepat.',['はい、げんきでした。','いいえ、げんきじゃありませんでした。','はい、しずかな まちです。','きょうは なんじですか。'],'Pertanyaan lampau dijawab dengan げんきでした.']],
['A: アンナさんは りょうりが すきです。りょうりが へたです。ハディさんは りょうりが じょうずです。','inference',['Siapa yang disebut suka memasak tetapi kurang mahir?',['Anna','Hadi','Keduanya','Tidak ada'],'Dua keterangan pertama sama-sama merujuk Anna.',2]]
])
];
