import {chapter,read,meaning} from './helpers.mjs';
export default [
chapter(12,'Bentuk Te: Konjugasi & Urutan Tindakan',['て形：五段／一段／する／くる','〜て、〜','〜てから'],['Membentuk te-form kata kerja yang sudah dipelajari.','Memahami penggabungan kegiatan.','Menentukan urutan kegiatan dengan てから.'],[
read('食べます',['たべます','のみます','みます','よみます'],'makan'),read('飲みます',['のみます','たべます','みます','よみます'],'minum'),read('読みます',['よみます','のみます','みます','かきます'],'membaca'),meaning('あらいます',['mencuci','beristirahat','menulis','membaca']),meaning('おきます',['bangun','tidur','makan','minum']),meaning('ねます',['tidur','bangun','datang','pulang'])],[
['Bentuk Te dari かきます adalah ...',['かいて','かって','かきて','かんで'],'Kata kerja berakhiran きます ini berubah menjadi いて.'],
['Bentuk Te dari よみます adalah ...',['よんで','よみて','よって','よいて'],'Akhiran みます berubah menjadi んで.'],
['Bentuk Te dari かいます adalah ...',['かって','かいて','かいで','かうて'],'Akhiran います pada かいます berubah menjadi って.'],
['Bentuk Te dari はなします adalah ...',['はなして','はなって','はなんで','はないて'],'Akhiran します pada はなします menjadi して.'],
['Bentuk Te dari たべます adalah ...',['たべて','たべって','たべんで','たべいて'],'Kata kerja golongan 2 mengganti ます dengan て.'],
['Bentuk Te dari します adalah ...',['して','しって','しんで','しいて'],'する memiliki bentuk Te tidak beraturan して.'],
['Bentuk Te dari きます (datang) adalah ...',['きて','きって','きいて','きんで'],'くる memiliki bentuk Te tidak beraturan きて.'],
['Bentuk Te dari いきます adalah ...',['いって','いいて','いきて','いんで'],'いく adalah pengecualian: bentuk Te-nya いって.'],
['Gabungkan dua kegiatan dalam satu kalimat: “makan roti, lalu minum teh”.',['パンを たべて、おちゃを のみます。','パンを たべますて、おちゃを のみます。','パンを たべて、おちゃを のみて。','パンを たべるて、おちゃを のみます。'],'Kegiatan pertama memakai Te-form dan kegiatan terakhir memakai bentuk sopan.',1],
['Maksudnya mencuci tangan dahulu, kemudian makan. Pilih kalimat yang sesuai.',['てを あらってから、ごはんを たべます。','ごはんを たべてから、てを あらいます。','てを あらいますから、ごはんを たべて。','てを あらうて、ごはんを たべます。'],'Kegiatan sebelum てから dilakukan terlebih dahulu.',2]
],[
['あさ、アンナさんは おきて、かおを あらいます。ごはんを たべてから、がっこうへ いきます。',[
['Apa yang dilakukan setelah bangun?',['Mencuci muka','Pergi ke sekolah','Tidur','Membaca buku'],'おきて、かおを あらいます menyatakan bangun lalu mencuci muka.',1],
['Apa yang dilakukan sebelum pergi ke sekolah?',['Makan','Tidur','Minum kopi','Menonton televisi'],'ごはんを たべてから menunjukkan makan dilakukan dahulu.',2]]],
['ハディさんは ほんを よんでから、てがみを かきます。てがみを かいてから、やすみます。',[
['Apa kegiatan pertama Hadi?',['Membaca buku','Menulis surat','Beristirahat','Makan'],'Membaca mendahului menulis; menulis mendahului istirahat.',2],
['Kapan Hadi beristirahat?',['Setelah menulis surat','Sebelum membaca buku','Sebelum menulis surat','Saat membeli buku'],'てがみを かいてから、やすみます menetapkan urutan tersebut.',2]]]
],[
['A: うちへ かえって、ごはんを たべます。','detail',['Apa yang dilakukan setelah pulang?',['Makan','Pergi ke sekolah','Membeli buku','Tidur'],'かえって diikuti ごはんを たべます.',1]],
['A: ごはんを たべてから、てを あらいますか。\nB: いいえ、てを あらってから、たべます。','intent',['Apa yang dikoreksi pembicara kedua?',['Urutan dua kegiatan','Harga makanan','Tempat tinggal','Nama makanan'],'Ia menjelaskan bahwa mencuci tangan dilakukan sebelum makan.',2]],
['A: がっこうへ いきます。ほんを よみます。','response',['Pilih kalimat yang menyatukan dua kegiatan sesuai urutan yang disebutkan.',['がっこうへ いって、ほんを よみます。','ほんを よんで、がっこうへ いきます。','がっこうへ いきて、ほんを よみます。','がっこうへ いって、ほんを よみて。'],'Urutannya pergi ke sekolah lalu membaca; bentuk Te いきます adalah いって.',1]],
['A: パンを かってから、うちへ かえります。うちへ かえってから、パンを たべます。','inference',['Urutan mana yang sesuai?',['Membeli roti → pulang → makan roti','Pulang → membeli roti → makan roti','Makan roti → pulang → membeli roti','Membeli roti → makan roti → pulang'],'Kedua てから menetapkan membeli sebelum pulang dan makan setelah pulang.',2]]
]),
chapter(13,'Bentuk Te: Permintaan, Keadaan, Izin & Larangan',['てください／てくれませんか','ています','てもいいですか','てはいけません'],['Memahami permintaan melakukan tindakan.','Memahami kegiatan berlangsung atau keadaan dengan ています.','Membedakan meminta izin dan menyatakan larangan.'],[
read('車',['くるま','でんしゃ','えき','みち'],'mobil'),read('駅',['えき','みせ','みち','くに'],'stasiun'),read('花',['はな','ほん','さかな','くに'],'bunga'),meaning('あけます',['membuka','menutup','membaca','minum']),meaning('しめます',['menutup','membuka','menulis','membeli']),meaning('つかいます',['menggunakan','mendengar','berbicara','kembali'],2)],[
['Mintalah teman membuka jendela. Pilih ungkapan yang tepat.',['まどを あけてください。','まどを あけています。','まどを あけてはいけません。','まどを あけてもいいですか。'],'てください meminta lawan bicara melakukan tindakan.'],
['Lengkapi permintaan: ちょっと （　）ください。 Kata asal: まちます.',['まって','まちて','まいて','まんで'],'Bentuk Te まちます adalah まって.'],
['Anda meminta bantuan teman menutup pintu. Pilih ungkapan yang sesuai.',['ドアを しめてくれませんか。','ドアを しめています。','ドアを しめてもいいですか。','ドアを しめてはいけません。'],'てくれませんか meminta orang lain melakukan tindakan untuk pembicara.'],
['Fakta: Anna sedang membaca sekarang. Pilih kalimat yang sesuai.',['アンナさんは いま ほんを よんでいます。','アンナさんは きのう ほんを よみました。','アンナさんは ほんを よんでください。','アンナさんは ほんを よんではいけません。'],'いま dan kegiatan yang sedang berlangsung cocok dengan ています.',1],
['Fakta: Hadi tinggal di Tokyo. Pilih kalimat yang menyatakan keadaan tempat tinggal.',['ハディさんは とうきょうに すんでいます。','ハディさんは とうきょうに すんでください。','ハディさんは とうきょうへ いきました。','ハディさんは とうきょうに すんではいけません。'],'すんでいます menyatakan keadaan tempat tinggal.',1],
['Lengkapi kegiatan yang sedang berlangsung: いま おちゃを （　）。',['のんでいます','のみてください','のむています','のみました'],'Bentuk Te のみます adalah のんで, diikuti います.',1],
['Anda meminta izin duduk di kursi ini. Pilih ungkapannya.',['ここに すわってもいいですか。','ここに すわってください。','ここに すわっています。','ここに すわってはいけません。'],'てもいいですか meminta izin untuk tindakan pembicara.',2],
['Aturan: dilarang mengambil foto. Pilih kalimat larangannya.',['しゃしんを とってはいけません。','しゃしんを とってもいいです。','しゃしんを とっています。','しゃしんを とってください。'],'てはいけません menyatakan larangan.',2],
['Seseorang meminta izin memakai pulpen Anda. Anda mengizinkan. Pilih jawabannya.',['はい、つかってもいいです。','いいえ、つかってはいけません。','いま つかっていますか。','つかってくださいませんか。'],'てもいいです memberi izin; pilihan lain melarang atau meminta tindakan.',2],
['Aturan: tidak boleh makan di ruangan ini. Lengkapi: ここで たべては （　）。',['いけません','いいです','います','ください'],'てはいけません adalah pola larangan.',2]
],[
['としょかんの ルール：\nほんを よんでもいいです。ここで たべてはいけません。しずかに してください。',[
['Kegiatan apa yang diizinkan?',['Membaca buku','Makan','Berbicara keras','Memasak'],'よんでもいいです mengizinkan membaca.',2],
['Apa yang diminta kepada pengunjung?',['Bersikap tenang','Membeli makanan','Menutup perpustakaan','Membawa kursi'],'しずかに してください meminta pengunjung tenang.',0]]],
['いま、アンナさんは へやで ほんを よんでいます。ハディさんは おちゃを のんでいます。',[
['Apa yang sedang dilakukan Anna?',['Membaca buku','Minum teh','Membeli buku','Membuka jendela'],'Anna sedang よんでいます.',1],
['Siapa yang sedang minum teh?',['Hadi','Anna','Keduanya','Tidak disebutkan'],'Hadi disebut おちゃを のんでいます.',1]]]
],[
['A: アンナさんは なにを していますか。\nB: ほんを よんでいます。','detail',['Apa yang sedang dilakukan Anna?',['Membaca buku','Menulis surat','Makan roti','Minum teh'],'Jawaban menyebut kegiatan よんでいます.',1]],
['A: まどを あけてくれませんか。','intent',['Apa maksud pembicara?',['Meminta lawan bicara membuka jendela','Meminta izin membuka jendela sendiri','Melarang membuka jendela','Menyatakan sedang membuka jendela'],'てくれませんか meminta bantuan orang lain.',0]],
['A: ここで しゃしんを とってもいいですか。','response',['Aturan tempat itu melarang foto. Pilih jawaban.',['いいえ、とってはいけません。','はい、とってもいいです。','しゃしんを とっています。','まどを あけてください。'],'Pertanyaan izin harus dijawab sesuai larangan foto.',2]],
['A: ここで ほんを よんでもいいです。たべてはいけません。\nB: はい。','inference',['Kegiatan mana yang sesuai aturan?',['Membaca tanpa makan','Makan sambil membaca','Hanya makan','Memasak di ruangan'],'Membaca diperbolehkan tetapi makan dilarang.',2]]
]),
chapter(14,'Bentuk Biasa Kata Kerja & Kewajiban',['辞書形／ない／た／なかった','ないでください','なければなりません','なくてもいいです'],['Membentuk bentuk biasa positif dan negatif, kini dan lampau.','Memahami permintaan agar tidak melakukan tindakan.','Membedakan kewajiban dengan tindakan yang tidak wajib.'],[
read('立ちます',['たちます','まちます','もちます','かちます'],'berdiri'),read('出ます',['でます','はいります','きます','いきます'],'keluar'),read('入ります',['はいります','いれます','かえります','はしります'],'masuk'),meaning('わすれます',['lupa','membawa','pulang','makan'],1),meaning('もってきます',['membawa ke sini','membawa pergi','membeli','membuang'],2),meaning('やすみます',['beristirahat','bekerja','belajar','berangkat'],2)],[
['Bentuk kamus dari よみます adalah ...',['よむ','よまない','よんだ','よまなかった'],'Bentuk kamus よみます adalah よむ.'],
['Bentuk biasa negatif saat ini dari いきます adalah ...',['いかない','いった','いく','いかなかった'],'いく berubah menjadi いかない untuk negatif nonlampau.'],
['Bentuk biasa lampau positif dari たべます adalah ...',['たべた','たべる','たべない','たべなかった'],'Lampau positif bentuk biasa adalah たべた.'],
['Bentuk biasa lampau negatif dari のみます adalah ...',['のまなかった','のまない','のんだ','のむ'],'Bentuk ない menjadi なかった untuk lampau negatif.'],
['Bentuk biasa lampau positif dari いきます adalah ...',['いった','いいた','いきた','いんだ'],'いく memiliki bentuk lampau いった.'],
['Bentuk biasa negatif saat ini dari します adalah ...',['しない','すない','した','しなかった'],'する berubah menjadi しない untuk negatif nonlampau.'],
['Mintalah seseorang agar tidak masuk. Pilih ungkapan yang tepat.',['はいらないでください。','はいってください。','はいっています。','はいらなくてもいいです。'],'ないでください meminta seseorang tidak melakukan tindakan.',1],
['Besok siswa wajib membawa buku. Pilih kalimat yang menyatakan kewajiban.',['あした ほんを もってこなければなりません。','あした ほんを もってこなくてもいいです。','あした ほんを もってこないでください。','きのう ほんを もってきました。'],'なければなりません berarti harus; dua pola negatif lainnya memiliki maksud berbeda.',2],
['Hari ini tidak perlu belajar. Pilih kalimat yang sesuai.',['きょうは べんきょうしなくてもいいです。','きょうは べんきょうしなければなりません。','きょうは べんきょうしないでください。','きょうは べんきょうしています。'],'なくてもいいです berarti tidak wajib, bukan larangan.',2],
['Apa arti なまえは かかなくてもいいです?',['Nama tidak perlu ditulis','Nama wajib ditulis','Nama dilarang ditulis','Nama sudah ditulis'],'なくてもいいです menyatakan tidak perlu melakukan tindakan.',2]
],[
['あしたは テストです。えんぴつを もってこなければなりません。じしょは もってこなくてもいいです。',[
['Apa yang wajib dibawa?',['Pensil','Kamus','Makanan','Payung'],'えんぴつ diikuti pola kewajiban.',2],
['Apa status membawa kamus?',['Tidak wajib','Wajib','Dilarang','Sudah dilakukan'],'じしょは もってこなくてもいいです berarti kamus tidak wajib dibawa.',2]]],
['アンナさんの メモ：\nきのうは ほんを よんだ。テレビは みなかった。きょうは ほんを よまない。',[
['Apa yang dilakukan Anna kemarin?',['Membaca buku','Menonton televisi','Membeli buku','Menulis surat'],'よんだ adalah lampau positif membaca.'],
['Apa yang tidak akan dilakukan Anna hari ini?',['Membaca buku','Makan','Pergi ke sekolah','Minum teh'],'きょうは よまない adalah negatif untuk hari ini.']]]
],[
['A: あした、えんぴつを もってこなければなりません。','detail',['Apa yang wajib dilakukan besok?',['Membawa pensil','Membawa kamus','Membeli buku','Beristirahat'],'もってこなければなりません menyatakan wajib membawa pensil.',2]],
['A: ここに はいらないでください。','intent',['Apa maksud pembicara?',['Meminta orang agar tidak masuk','Mengizinkan masuk','Mewajibkan masuk','Menceritakan sudah masuk'],'はいらないでください adalah permintaan negatif.',1]],
['A: きのう、ほんを よみましたか。','response',['Faktanya Anda tidak membaca kemarin. Pilih jawaban dalam bentuk biasa.',['よまなかった。','よんだ。','よまない。','よむ。'],'Instruksi meminta negatif lampau bentuk biasa, yaitu よまなかった.']],
['A: あしたは かいしゃへ いかなければなりません。あさはやく いかなくてもいいです。','inference',['Pernyataan mana yang sesuai?',['Wajib pergi ke kantor, tetapi tidak harus pagi-pagi','Tidak perlu pergi ke kantor','Dilarang pergi ke kantor','Wajib pergi pagi-pagi'],'Kalimat pertama mewajibkan pergi; kalimat kedua membebaskan keharusan pergi pagi-pagi.',2]]
])
];
