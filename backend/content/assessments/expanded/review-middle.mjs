// V6 editorial proposals only. Historical V5 authoring remains untouched.
// options and reasons below are correct-first. For spoken rows audio_script is
// the stimulus alone: the V6 compiler must rotate spokenChoices with the key,
// append the numbered audio choices, and expose only numeric option labels.
const spokenPatch=(audio_script,options,explanation,reasons)=>({
  audio_script,options,explanation,reasons,assessment_meta:{spokenChoices:options},
});

export default {
  'b10-a-jlpt-r2-18-expanded':{
    question:'にちようびは どこで べんきょうしますか。その よるは なにを しますか。',
    passage:'わたしは にほんごの がくせいです。がっこうで にほんごを べんきょうします。ごぜん くじから じゅうにじまで にほんごを べんきょうします。ごごは としょかんで ほんを よみます。ともだちも としょかんへ いきます。わたしは にほんごの ほんを よみます。ともだちは えいごの ほんを よみます。にちようびは がっこうへ いきません。うちで べんきょうします。にちようびの よるは テレビを みます。ほんは よみません。',
    options:['うち、テレビを みます。','がっこう、テレビを みます。','うち、ほんを よみます。','がっこう、ほんを よみます。'],
    explanation:'Hari Minggu penulis belajar di rumah, lalu pada hari Minggu malam menonton televisi. Jawaban harus mempertahankan tempat belajar dan kegiatan malam pada hari yang diminta.',
    reasons:['Kedua fakta sesuai keterangan khusus hari Minggu: belajar di rumah dan menonton televisi malam itu.','Kegiatan malam benar, tetapi hari Minggu penulis tidak pergi ke sekolah dan belajar di rumah.','Tempat belajar benar, tetapi pada hari Minggu malam penulis menonton televisi dan secara eksplisit tidak membaca buku.','Kedua fakta salah untuk hari Minggu: belajar di rumah dan malamnya menonton televisi.'],
  },
  'b10-a-expanded-vocabulary-4':{
    options:['テレビ','ラジオ','ほん','ノート'],
    explanation:'ニュースを みます menyatakan menonton berita. Dari media yang ditawarkan, テレビ sesuai dengan kegiatan menonton berita.',
    reasons:['テレビ adalah media menonton berita yang sesuai dengan みます.','Berita dari radio didengarkan dengan ききます, bukan ditonton.','ほん adalah buku; konteks menyatakan menonton berita, bukan membaca buku.','ノート adalah buku catatan; konteks menyatakan menonton berita, bukan menulis atau membaca catatan.'],
  },
  'b11-a-jlpt-r2-13-expanded':{
    question:'しろい かみを ＿＿ ＿＿ ★ ＿＿ かいます。',
    options:['かみを','さんまい、','あかい','にまい'],
    explanation:'Urutan: しろい かみを さんまい、あかい かみを にまい かいます。Kertas putih dibeli tiga lembar dan kertas merah dua lembar. Posisi ★ adalah かみを.',
    reasons:[
      'かみを berada setelah あかい untuk membentuk objek kedua: kertas merah.',
      'さんまい、 melengkapi jumlah kertas putih pada posisi pertama, bukan ★.',
      'あかい berada pada posisi kedua untuk menerangkan かみを.',
      'にまい berada pada posisi keempat, sesudah objek kertas merah.',
    ],
    assessment_meta:{ordered:['さんまい、','あかい','かみを','にまい'],starPosition:2},
  },
  'b12-a-jlpt-r2-9-expanded':{
    question:'にほんごを べんきょう（　）、ねます。',
    options:['して','しって','するて','しますて'],
    explanation:'べんきょうする mengikuti kata kerja tidak beraturan する→して. Kegiatan belajar dihubungkan dengan tidur melalui べんきょうして.',
    reasons:[
      'する menjadi して; gabungan べんきょうする mengikuti perubahan yang sama.',
      'しって bukan bentuk て dari する; jangan menambah っ.',
      'する tidak membentuk て dengan langsung menambahkan て pada bentuk kamus.',
      'Bentuk て tidak dibentuk dengan menambahkan て pada します.',
    ],
  },
  'b12-a-jlpt-r2-10-expanded':{
    question:'ともだちが うちへ（　）、いっしょに ごはんを たべます。',
    options:['きて','きって','くて','きますて'],
    explanation:'Kata kerja tidak beraturan くる menjadi きて. Kalimat menghubungkan teman datang ke rumah dengan kegiatan makan bersama.',
    reasons:[
      'くる memiliki bentuk て tidak beraturan きて.',
      'きって bukan bentuk て dari datang; perubahan くる tidak memakai っ.',
      'くて tidak dibentuk dari くる; suku kata pertamanya berubah menjadi き.',
      'Tidak menambahkan て langsung setelah bentuk sopan きます.',
    ],
  },
  'b12-a-jlpt-r2-18-expanded':{
    question:'わたしは まちで なにを しますか。',
    passage:'きょうは ともだちと バスで まちへ いきます。まちで ともだちは みせの ほんを よみます。わたしは あたらしい ほんを かいます。ひるは ふたりで ごはんを たべます。おちゃは のみません。ともだちは コーヒーを のみます。ごご さんじに ふたりで うちへ かえります。かえってから、わたしは ほんを よんで、おちゃを のみます。ともだちは テレビを みます。',
    options:['ほんを かって、ごはんを たべます。','ほんを よんで、ごはんを たべます。','ほんを かって、おちゃを のみます。','ほんを よんで、おちゃを のみます。'],
    explanation:'Di kota penulis membeli buku, kemudian makan bersama temannya. Membaca buku di toko adalah kegiatan teman; penulis baru membaca buku dan minum teh sesudah pulang. Pilih gabungan dua kegiatan penulis di kota.',
    reasons:['Membeli buku dan ikut makan bersama teman adalah dua kegiatan penulis di kota.','Makan benar, tetapi membaca buku di toko dilakukan teman, bukan penulis.','Membeli buku benar, tetapi penulis tidak minum teh di kota; minum teh dilakukan setelah pulang.','Membaca buku dan minum teh adalah kegiatan penulis setelah pulang, bukan pasangan kegiatan di kota.'],
    assessment_meta:{objective:'goal2'},
  },
  'b12-a-expanded-vocabulary-5':{
    question:'いすを つかいます。たちません。いすに（　）、ほんを よみます。',
    options:['すわって','たって','あるいて','はしって'],
    explanation:'Penulis menggunakan kursi dan secara eksplisit tidak berdiri. Tindakan yang sesuai adalah duduk di kursi, いすに すわって.',
    reasons:['すわって menyatakan duduk di kursi sehingga sesuai dengan penggunaan kursi dan penyangkalan berdiri.','たって menyatakan berdiri, bertentangan dengan たちません.','あるいて menyatakan berjalan; tidak sesuai dengan memakai kursi untuk membaca.','はしって menyatakan berlari; tidak sesuai dengan duduk memakai kursi untuk membaca.'],
  },
  'b13-a-expanded-listening-2':spokenPatch(
    'A: この ことばを おしえて くれませんか。',
    ['はい、いいですよ。','いいえ、じしょじゃありません。','はい、しずかです。'],
    'てくれませんか meminta bantuan lawan bicara; はい、いいですよ menerima permintaan menjelaskan kata. Pola ini diajarkan di source13, kini Bab14.',
    ['いいですよ menerima permintaan untuk membantu menjelaskan kata.','Jawaban ini menyangkal identitas sebuah kamus, bukan menanggapi permintaan bantuan.','Jawaban ini menyatakan keadaan tenang, bukan kesediaan menjelaskan kata.'],
  ),
  'b13-a-expanded-listening-5':{
    audio_script:'N: がくせいは いま なにを していますか。\nA: せんせいは なにを していますか。\nB: こくばんに ことばを かいています。がくせいは その ことばを ノートに かいています。\nA: ほんを よんでいますか。\nB: いいえ、いまは かいています。\nN: がくせいは いま なにを していますか。',
    options:['ノートに ことばを かいています','こくばんに ことばを かいています','ほんを よんでいます','おちゃを のんでいます'],
    explanation:'Siswa menulis kata di buku catatan; guru menulis di papan tulis. Bacaan 黒板 adalah こくばん.',
    reasons:['B menyatakan siswa menuliskan kata tersebut di buku catatan.','Menulis di papan tulis adalah kegiatan guru, bukan siswa.','B secara eksplisit menyangkal membaca saat ini.','Minum teh tidak disebut sebagai kegiatan siswa.'],
  },
  'b13-a-expanded-listening-9':spokenPatch(
    'A: いま、この ペンを つかっていますか。',
    ['はい、いま なまえを かいています。','はい、きのう なまえを かきました。','はい、あした なまえを かきます。'],
    'Pertanyaan menanyakan pemakaian pena sekarang. Jawaban yang paling tepat menegaskan kegiatan menulis yang sedang berlangsung; dua respons lain hanya melaporkan kemarin atau rencana besok.',
    ['いま かいています menanggapi pemakaian pena yang sedang berlangsung sekarang.','かきました dengan きのう melaporkan kegiatan selesai kemarin dan tidak menjelaskan pemakaian pena sekarang.','かきます dengan あした menyatakan rencana besok, bukan kegiatan berlangsung sekarang.'],
  ),
  'b14-a-jlpt-r2-1-expanded':{
    question:'ここに <u>立たないで</u>ください。',
    options:['たたないで','またないで','かわないで','とらないで'],
    explanation:'立たないで dibaca たたないで, bentuk negatif 立つ yang dipakai dalam permintaan agar tidak berdiri.',
    reasons:['立つ menjadi 立たないで dan dibaca たたないで.','またないで adalah bentuk negatif 待つ, menunggu, bukan 立つ.','かわないで adalah bentuk negatif 買う, membeli, bukan 立つ.','とらないで adalah bentuk negatif 取る／撮る, mengambil atau memotret, bukan 立つ.'],
  },
  'b14-a-jlpt-r2-5-expanded':{
    question:'A「ここに なまえを かかなければ なりませんか。」B「いいえ、（　）です。」',
    options:['かかなくてもいい','かかなければならない','かきなくてもいい','かかないて'],
    explanation:'Pertanyaan menanyakan kewajiban menulis nama. Jawaban いいえ menyangkal kewajiban itu, sehingga digunakan かかなくてもいいです.',
    reasons:['かかなくてもいい menyatakan menulis nama tidak wajib.','かかなければならない menyatakan wajib, bertentangan dengan いいえ.','Negatif かく adalah かかない, sehingga bentuk tidak wajib dimulai かかなくても, bukan かきなくても.','かかないて tidak membentuk pola yang benar; bentuk ない tidak langsung diikuti て.'],
  },
  'b14-a-jlpt-r2-17-expanded':{
    options:['もって こなくてもいいです。','もって こなければ なりません。','テストで つかいます。','つかわなければ なりません。'],
    explanation:'Membawa kamus tidak wajib, dan teks meminta kamus tidak digunakan saat tes. Tidak wajib membawa berbeda dari wajib membawa maupun wajib memakai.',
    reasons:['Teks secara eksplisit menyatakan じしょは もって こなくてもいいです.','Kewajiban membawa berlaku pada pensil, bukan kamus.','Teks meminta じしょを つかわないでください sehingga kamus tidak digunakan saat tes.','Menggunakan kamus tidak diwajibkan; teks justru meminta tidak memakainya.'],
  },
  'b14-a-jlpt-r2-18-expanded':{
    question:'この ひとについて、ただしい ものは どれですか。',
    passage:'きのう、わたしは あたらしい えんぴつを かって、かばんに いれた。ノートは かばんに いれなかった。あしたは がっこうの テストです。えんぴつは もって いかなければ なりません。ノートは もって いかなくても いいです。ごぜん くじに がっこうへ いかなければ なりません。はちじはんに うちを でる。バスで がっこうへ いく。でんしゃは つかわない。',
    options:[
      'きのう えんぴつを かいました。あしたは バスで がっこうへ いきます。',
      'きのう ノートを かいました。あしたは バスで がっこうへ いきます。',
      'きのう えんぴつを かいました。あしたは でんしゃで がっこうへ いきます。',
      'きのう ノートを かいました。あしたは でんしゃで がっこうへ いきます。',
    ],
    explanation:'Teks melaporkan pembelian pensil kemarin dengan かった, lalu menyatakan perjalanan besok memakai bus. Kedua informasi harus dipertahankan.',
    reasons:[
      'Pembelian pensil kemarin dan perjalanan memakai bus besok sama-sama sesuai teks.',
      'Perjalanan memakai bus benar, tetapi barang yang dibeli kemarin adalah pensil, bukan buku catatan.',
      'Pembelian pensil benar, tetapi perjalanan besok memakai bus dan secara eksplisit tidak memakai kereta.',
      'Kedua informasi salah: yang dibeli pensil dan perjalanan memakai bus.',
    ],
  },
  'b14-a-jlpt-r2-19-expanded':{
    passage:'あしたの クラス\nじかん：9:00〜12:00\nもって こなければ なりません：ほん、ノート、えんぴつ\nもって こなくてもいいです：じしょ\nクラスで たべないでください。',
  },
  'b14-a-jlpt-r2-21-expanded':{
    question:'Aさんは あした なにを もって いかなければ なりませんか。',
    audio_script:'N: Aさんは あした なにを もって いかなければ なりませんか。\nA: あしたは じしょも ノートも もって いかなければ なりませんか。\nB: ノートは もって こなければ なりません。じしょは もって こなくてもいいです。\nA: はい、わかりました。\nN: Aさんは あした なにを もって いかなければ なりませんか。',
    options:['ノート','じしょ','かさ','しゃしん'],
    explanation:'Yang ditanyakan adalah barang yang wajib dibawa, bukan semua barang yang mungkin dibawa. ノート diwajibkan, sedangkan kamus tidak wajib.',
    reasons:['ノート secara eksplisit diikuti pola kewajiban もってこなければなりません.','Kamus tidak wajib; なくてもいい tidak menyatakan larangan membawanya.','Payung tidak disebut sebagai barang yang wajib dibawa.','Foto tidak disebut sebagai barang yang wajib dibawa.'],
  },
  'b14-a-jlpt-r2-23-expanded':spokenPatch(
    'N: ここは テストの へやです。この へやの ルールです。たべものは へやの そとです。Aさんは せんせいです。Bさんは がくせいです。Bさんは パンを もって、へやに はいります。\nN: Aさんは なんと いいますか。',
    ['たべものを もって はいらないでください。','たべものを もって はいらなくてもいいです。','わたしは たべものを もって はいります。'],
    'Aturan menempatkan makanan di luar ruang tes. Guru perlu meminta siswa tidak masuk sambil membawa makanan, menggunakan ないでください.',
    ['Permintaan negatif sesuai aturan makanan berada di luar ruang tes.','なくてもいい menyatakan membawa makanan masuk tidak wajib, sehingga tidak menyampaikan permintaan agar siswa tidak melakukannya.','Ini melaporkan tindakan guru sendiri dan tidak meminta siswa mengikuti aturan.'],
  ),
};

const old=(chapter,...numbers)=>numbers.map(n=>`b${chapter}-a-jlpt-r2-${n}-expanded`);
const added=(chapter,category,...numbers)=>numbers.map(n=>`b${chapter}-a-expanded-${category}-${n}`);

// Evidence is deliberately narrower than the existing objective labels.
// Exclude isolated readings/orthography, unrelated place/date lookup, a lexical
// noun choice mislabeled as tense, and local verb completion mislabeled as order.
// Keys refer to V5 identity, with this file's proposed repairs applied for V6.
export const objectiveEvidenceKeys = [
  // B10: tense/polarity in context; direct object/activity vocabulary;
  // actual contrasts between every morning, occasional and every day.
  ...old(10,6,9,10,18,23),
  ...added(10,'vocabulary',3,4,5),
  ...added(10,'listening',2,5,7,9),
  // B11: counter selection; quantity preservation/integration; count questions
  // and appropriate responses. The repaired star assesses quantity placement.
  ...old(11,4,5,7,9,10,11,13,14,17,18,22,23,24),
  ...added(11,'vocabulary',2,3,4),
  ...added(11,'listening',1,2,3,5,6,7,8,9),
  // B12: te formation, construction joining activities, and actual order.
  // Goal2 includes two constructions (11,14) and the repaired medium reading:
  // combine the writer's two city activities while excluding the friend's and
  // home activities. Unrelated lamp/seat vocabulary is still not evidence.
  ...old(12,6,7,8,9,10,11,13,14,15,17,18,19,21,22,23),
  ...added(12,'vocabulary',3),
  ...added(12,'listening',1,3,4,7),
  // Source13 is displayed B14: request forms/actions, ongoing/state forms,
  // current versus past activity, and permission versus prohibition.
  ...old(13,6,7,8,9,10,11,13,14,15,17,18,23,24),
  ...added(13,'vocabulary',2),
  ...added(13,'listening',1,2,3,4,6,7,8,9),
  // Source14 is displayed B13: plain forms, negative requests, obligation versus
  // optional action. Exclude polite verb/noun vocabulary mislabeled as plain.
  ...old(14,5,6,7,8,9,10,11,13,14,15,16,17,18,21,22,23,24),
  ...added(14,'listening',1,2,5,6,7,8,9),
];
