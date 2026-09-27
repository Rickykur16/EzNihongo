import {chapter,read,meaning} from './helpers.mjs';
export default [
chapter(18,'Perbandingan',['AはBより','AよりBのほうが','どちらが','の中で〜が一番'],['Memahami perbandingan dua pilihan.','Menanyakan dan menjawab perbandingan dua hal.','Menentukan pilihan paling sesuai dari tiga atau lebih pilihan.'],[
read('高い',['たかい','やすい','ながい','みじかい'],'mahal'),read('安い',['やすい','たかい','はやい','おそい'],'murah'),read('長い',['ながい','みじかい','あたらしい','ふるい'],'panjang'),meaning('はやい',['cepat/awal','lambat','pendek','murah']),meaning('おもい',['berat','ringan','cepat','pendek']),meaning('いちばん',['paling/nomor satu','kadang-kadang','setiap hari','sama sekali tidak'],2)],[
['Harga tas A 1.000 yen dan tas B 2.000 yen. Pilih perbandingan yang benar.',['Aは Bより やすいです。','Aは Bより たかいです。','Bは Aより やすいです。','Aと Bは おなじ ねだんです。'],'A lebih murah karena harganya 1.000 yen dibanding 2.000 yen.'],
['Waktu bus 40 menit dan kereta 20 menit. Pilih kalimat yang benar.',['バスより でんしゃの ほうが はやいです。','でんしゃより バスの ほうが はやいです。','バスと でんしゃは おなじです。','でんしゃは バスより おそいです。'],'Kereta lebih cepat karena waktu perjalanannya lebih singkat.'],
['Lengkapi pola perbandingan: Aは B（　）たかいです。',['より','まで','から','だけ'],'より menandai pembanding dalam pola AはBより.'],
['Lengkapi pola: Aより Bの（　）が やすいです。',['ほう','なか','まえ','した'],'のほうが menandai pilihan yang lebih memiliki sifat tertentu.'],
['Anda membandingkan harga dua tas. Pilih pertanyaan yang tepat.',['Aと Bと どちらが やすいですか。','Aは なんさいですか。','Bは なんじですか。','Aは だれですか。'],'どちら meminta memilih salah satu dari dua pembanding.',1],
['Pertanyaan: Aと Bと どちらが ながいですか。 Panjang A 20 cm; B 30 cm. Pilih jawaban.',['Bの ほうが ながいです。','Aの ほうが ながいです。','Aと Bは おなじです。','Bは Aより みじかいです。'],'B lebih panjang karena 30 cm lebih besar dari 20 cm.',1],
['Berat tas A 2 kg dan B 5 kg. Pilih kalimat yang benar.',['Aは Bより かるいです。','Aは Bより おもいです。','Bは Aより かるいです。','Aと Bは おなじです。'],'A lebih ringan daripada B.'],
['Harga buku A 300, B 500, C 200 yen. Buku mana yang paling murah?',['C','A','B','Ketiganya sama'],'C memiliki harga paling rendah, yaitu 200 yen.',2],
['Lengkapi makna “di antara tiga ini, A paling mahal”: この みっつの なかで、Aが（　）たかいです。',['いちばん','ときどき','ぜんぜん','まいにち'],'いちばん menyatakan sifat paling tinggi dalam suatu kelompok.',2],
['Waktu perjalanan A 50, B 30, C 40 menit. Pilih kalimat yang sesuai.',['この なかで、Bが いちばん はやいです。','この なかで、Aが いちばん はやいです。','この なかで、Cが いちばん はやいです。','Aと Bと Cは おなじです。'],'B paling cepat karena waktu perjalanannya paling singkat.',2]
],[
['がっこうまで：\nバス：よんじゅっぷん、にひゃくえん。\nでんしゃ：にじゅっぷん、さんびゃくえん。',[
['Sarana mana yang lebih murah?',['Bus','Kereta','Harganya sama','Tidak disebutkan'],'Bus 200 yen, kereta 300 yen.'],
['Anda memprioritaskan waktu perjalanan paling singkat. Mana yang dipilih?',['Kereta','Bus','Keduanya sama cepat','Tidak dapat ditentukan'],'Kereta membutuhkan 20 menit dibanding bus 40 menit.',1]]],
['かばん A：せんえん、にキロ。\nかばん B：にせんえん、いちキロ。\nかばん C：さんぜんえん、さんキロ。',[
['Tas mana yang paling ringan?',['B','A','C','Semuanya sama'],'B hanya satu kilogram.',2],
['Tas mana yang paling mahal?',['C','B','A','Semuanya sama'],'C berharga 3.000 yen, harga tertinggi.',2]]]
],[
['A: コーヒーは さんびゃくえんです。おちゃは にひゃくえんです。','detail',['Minuman mana yang lebih murah?',['Teh','Kopi','Harganya sama','Tidak disebutkan'],'Teh 200 yen dan kopi 300 yen.']],
['A: バスと でんしゃと、どちらが はやいですか。','intent',['Apa yang ingin diketahui pembicara?',['Sarana mana yang lebih cepat','Sarana mana yang lebih murah','Jumlah penumpang','Waktu keberangkatan'],'Pertanyaan membandingkan kecepatan bus dan kereta.',1]],
['A: Aと Bと、どちらが やすいですか。','response',['Fakta: A 500 yen, B 800 yen. Pilih jawaban yang benar.',['Aの ほうが やすいです。','Bの ほうが やすいです。','おなじ ねだんです。','Bが いちばん かるいです。'],'A lebih murah daripada B.',1]],
['A: Aは にじゅっぷんです。Bは さんじゅっぷんです。Cは じゅっぷんです。','inference',['Pilihan mana yang membutuhkan waktu paling singkat?',['C','A','B','Semuanya sama'],'C sepuluh menit, lebih singkat daripada A dua puluh dan B tiga puluh.',2]]
]),
chapter(19,'Keinginan & Rencana',['たい／たくない','が欲しい','つもり','予定','ましょう／ませんか'],['Menyatakan keinginan melakukan sesuatu atau memiliki benda.','Memahami niat dan jadwal/rencana kegiatan.','Memahami ajakan dan memilih tanggapannya.'],[
read('食べます',['たべます','のみます','かいます','よみます'],'makan'),read('飲みます',['のみます','たべます','みます','いきます'],'minum'),read('買います',['かいます','かきます','きます','よみます'],'membeli'),meaning('ほしい',['ingin memiliki','sudah punya','tidak boleh','harus']),meaning('よてい',['rencana/jadwal','pengalaman','harga','kemampuan'],1),meaning('つもり',['niat','larangan','kemampuan','perbandingan'],1)],[
['Anda ingin makan roti. Pilih kalimat yang tepat.',['パンを たべたいです。','パンを たべたくないです。','パンを たべました。','パンを たべてはいけません。'],'たい menyatakan keinginan melakukan tindakan.'],
['Anda tidak ingin minum kopi. Pilih kalimat yang tepat.',['コーヒーを のみたくないです。','コーヒーを のみたいです。','コーヒーを のみました。','コーヒーを のんでいます。'],'Negatif keinginan memakai たくないです.'],
['Lengkapi keinginan membeli buku: ほんを （　）です。',['かいたい','かいますたい','かうたい','かってたい'],'Bentuk ます tanpa ます diikuti たい: かい＋たい.'],
['Anda ingin memiliki kamera. Pilih kalimat yang sesuai.',['カメラが ほしいです。','カメラが できます。','カメラに なります。','カメラが じょうずです。'],'ほしい dipakai untuk keinginan memiliki benda.'],
['Lengkapi pernyataan niat: あした がっこうへ （　）つもりです。',['いく','いきます','いって','いき'],'Sebelum つもり dipakai bentuk biasa, di sini bentuk kamus いく.',1],
['Anda berniat tidak menonton televisi besok. Pilih kalimat.',['あした テレビを みない つもりです。','あした テレビを みる つもりです。','きのう テレビを みました。','いま テレビを みています。'],'Niat negatif memakai bentuk ない sebelum つもり.',1],
['Lengkapi rencana perjalanan: らいしゅう にほんへ （　）よていです。',['いく','いきます','いって','いき'],'Rencana tindakan memakai bentuk kamus＋よていです.',1],
['Apa arti にちようびに ともだちと あう よていです?',['Ada rencana bertemu teman pada Minggu','Sudah bertemu teman pada Minggu','Dilarang bertemu teman pada Minggu','Tidak bisa bertemu teman'],'よていです menyatakan rencana; あう adalah bertemu.',1],
['Anda mengajak teman makan bersama. Pilih ungkapannya.',['いっしょに ごはんを たべませんか。','いっしょに ごはんを たべませんでした。','ごはんを たべてはいけません。','ごはんが ほしいでした。'],'ませんか dapat digunakan sebagai ajakan sopan.',2],
['Teman mengajak minum teh bersama. Pilih jawaban yang menerima ajakan.',['いいですね。のみましょう。','すみません、きょうは ちょっと。','いいえ、のみたくないです。','きょうは だめです。'],'ましょう menyatakan mari melakukan bersama, sesuai penerimaan ajakan.',2]
],[
['アンナさんは あたらしい カメラが ほしいです。にちようびに カメラを かう つもりです。ハディさんは カメラを かいません。',[
['Apa yang diinginkan Anna?',['Kamera baru','Buku baru','Tas baru','Piano'],'Kalimat pertama menyebut あたらしい カメラ.'],
['Kapan Anna berniat membeli kamera?',['Minggu','Senin','Kemarin','Setiap hari'],'にちようびに menunjukkan hari Minggu.',1]]],
['アンナ：あした、いっしょに テニスを しませんか。\nハディ：いいですね。しましょう。\nアンナ：ごご さんじからです。',[
['Bagaimana tanggapan Hadi?',['Menerima ajakan','Menolak ajakan','Melarang bermain tenis','Meminta membeli raket'],'いいですね。しましょう menerima ajakan.',2],
['Kapan kegiatan dimulai?',['Besok pukul 15.00','Besok pukul 03.00','Hari ini pukul 15.00','Kemarin pukul 15.00'],'Ajakan menyebut あした dan ごご さんじ.',1]]]
],[
['A: なにが ほしいですか。\nB: あたらしい かばんが ほしいです。','detail',['Apa yang diinginkan pembicara kedua?',['Tas baru','Buku baru','Kamera','Sepatu'],'Jawaban menyebut あたらしい かばん.']],
['A: あした、いっしょに えいがを みませんか。','intent',['Apa maksud pembicara?',['Mengajak menonton film besok','Menceritakan film kemarin','Melarang menonton film','Menanyakan harga tiket'],'ませんか dalam konteks いっしょに adalah ajakan.',2]],
['A: いっしょに おちゃを のみませんか。','response',['Anda ingin menerima ajakan. Pilih jawabannya.',['いいですね。のみましょう。','すみません、きょうは ちょっと。','いいえ、のみません。','きょうは だめです。'],'いいですね dan ましょう menerima ajakan.',2]],
['A: きょうは げつようびです。あしたは ほんを かう つもりです。カメラは かいません。にちようびに カメラを かう よていです。','inference',['Barang apa yang direncanakan dibeli besok?',['Buku','Kamera','Buku dan kamera','Tidak ada'],'Buku direncanakan besok; kamera pada Minggu.',1]]
]),
chapter(20,'Pengalaman, Alasan & Penghubung Kalimat',['たことがあります／ありません','から','が','そして／それから／でも'],['Memahami pengalaman pernah dan belum pernah.','Memahami hubungan alasan dengan keputusan.','Membedakan tambahan, urutan, dan pertentangan informasi.'],[
read('行きます',['いきます','きます','かきます','おきます'],'pergi'),read('読みます',['よみます','のみます','かきます','かいます'],'membaca'),read('食べます',['たべます','のみます','みます','いきます'],'makan'),meaning('いちど',['satu kali','setiap hari','besok','selalu']),meaning('それから',['setelah itu','tetapi','karena','sebelum itu'],2),meaning('でも',['tetapi','kemudian','setiap minggu','paling'],2)],[
['Pilih kalimat yang menyatakan pernah pergi ke Jepang.',['にほんへ いったことが あります。','にほんへ いく つもりです。','にほんへ いきたいです。','にほんへ いってください。'],'たことがあります menyatakan pengalaman pernah melakukan sesuatu.'],
['Pilih kalimat yang menyatakan belum pernah makan sushi.',['すしを たべたことが ありません。','すしを たべたことが あります。','すしを たべたいです。','きのう すしを たべませんでした。'],'Belum pernah dinyatakan たことがありません; tidak makan kemarin bukan berarti belum pernah.'],
['Lengkapi pola pengalaman: この ほんを （　）ことが あります。',['よんだ','よみます','よむ','よんで'],'Sebelum ことがあります dipakai bentuk lampau biasa た; よむ menjadi よんだ.'],
['Pertanyaan: にほんへ いったことが ありますか。 Faktanya belum pernah. Pilih respons.',['いいえ、ありません。','はい、あります。','はい、いきたいです。','はい、あしたです。'],'Jawaban menyangkal pengalaman adalah いいえ、ありません.'],
['Anda tidak pergi karena hujan. Pilih kalimat yang menyatakan sebab tersebut.',['あめですから、いきません。','あめですが、いきます。','あめです。そして、いきました。','あめですか。いきます。'],'から menghubungkan hujan sebagai alasan tidak pergi.',1],
['Apa alasan dalam kalimat いそがしいですから、テレビを みません?',['Sibuk','Tidak suka televisi','Televisi rusak','Sedang hujan'],'Bagian sebelum から, yaitu いそがしい, menyatakan alasannya.',1],
['Maknanya: mahal, tetapi saya ingin membelinya. Lengkapi: たかいです（　）、かいたいです。',['が','から','まで','より'],'が menghubungkan dua informasi yang berlawanan dengan harapan.',2],
['Anda menjelaskan kegiatan berurutan: makan, setelah itu belajar. Penghubung mana yang secara jelas berarti “setelah itu”?',['それから','でも','しかし','だから'],'それから menandai urutan berikutnya.',2],
['Kalimat pertama menyebut kamar tenang. Kalimat berikutnya menambahkan bahwa kamar itu bersih. Penghubung penambahan mana yang tepat?',['そして','でも','だから','しかし'],'そして menambahkan informasi searah; penghubung lain menyatakan pertentangan atau akibat.',2],
['Maksudnya “Saya suka tenis. Tetapi saya tidak bisa bermain.” Lengkapi: テニスが すきです。（　）、できません。',['でも','だから','それから','そして'],'でも menandai pertentangan antara kesukaan dan kemampuan.',2]
],[
['アンナさんは にほんへ いったことが あります。すしも たべたことが あります。ハディさんは にほんへ いったことが ありません。',[
['Siapa yang pernah pergi ke Jepang?',['Anna','Hadi','Keduanya','Tidak ada'],'Anna memiliki pengalaman pergi; Hadi belum pernah.'],
['Pengalaman apa lagi yang disebut untuk Anna?',['Makan sushi','Bermain ski','Membaca buku Jepang','Memasak sushi'],'Teks menyebut すしも たべたことが あります.']]],
['きょうは あめですから、うちに います。ほんを よみます。それから、にほんごを べんきょうします。',[
['Mengapa pembicara berada di rumah?',['Karena hujan','Karena sakit','Karena buku mahal','Karena sekolah jauh'],'あめですから menyatakan hujan sebagai alasan.',1],
['Apa yang dilakukan setelah membaca buku?',['Belajar bahasa Jepang','Pergi ke sekolah','Membeli buku','Menonton televisi'],'それから menghubungkan belajar sebagai kegiatan berikutnya.',2]]]
],[
['A: すしを たべたことが ありますか。\nB: はい、あります。てんぷらは たべたことが ありません。','detail',['Makanan apa yang belum pernah dicoba pembicara kedua?',['Tempura','Sushi','Keduanya','Tidak ada'],'Ia pernah makan sushi tetapi belum pernah makan tempura.']],
['A: いそがしいですから、きょうは いきません。','intent',['Apa yang dilakukan pembicara?',['Menjelaskan alasan tidak pergi hari ini','Mengajak pergi besok','Menanyakan lokasi','Menceritakan pengalaman perjalanan'],'から memperkenalkan kesibukan sebagai alasan tidak pergi.',1]],
['A: にほんへ いったことが ありますか。','response',['Faktanya Anda pernah ke Jepang. Pilih jawabannya.',['はい、あります。','いいえ、ありません。','あした いく つもりです。','にほんへ いきたいです。'],'Pertanyaan pengalaman dijawab dengan pengakuan pernah; rencana dan keinginan tidak menjawab pengalaman.']],
['A: この ほんは たかいです。でも、おもしろいですから、かいたいです。','inference',['Mengapa pembicara ingin membeli buku meskipun mahal?',['Karena menarik','Karena murah','Karena belum pernah membaca','Karena diminta guru'],'でも menandai harga sebagai kendala; おもしろいですから menyatakan alasan ingin membeli.',1]]
])
];
