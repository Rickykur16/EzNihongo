-- Curated vocabulary supporting the 24-chapter N4 flow (not an official JLPT word list).
-- Kana cross-checked with JMdict; Indonesian meanings and teaching notes authored for this course.
-- Reuse compatible bank entries without overwriting editor-authored meanings or other lesson links.
DO $migration$
DECLARE
  item JSONB;
  target_module UUID;
  target_lesson UUID;
  target_word UUID;
  course UUID;
BEGIN
  SELECT id INTO STRICT course FROM courses WHERE slug='n4';
  FOR item IN SELECT value FROM jsonb_array_elements($vocabulary$[
  {
    "chapter": 1,
    "japanese": "物",
    "reading": "もの",
    "indonesian": "barang; benda",
    "category": "名詞",
    "note": "Mengacu pada benda, bukan nominalisasi kegiatan.",
    "position": 1
  },
  {
    "chapter": 1,
    "japanese": "事",
    "reading": "こと",
    "indonesian": "hal; perkara",
    "category": "名詞",
    "note": "Bedakan kata benda 事 dari こと untuk nominalisasi.",
    "position": 2
  },
  {
    "chapter": 1,
    "japanese": "趣味",
    "reading": "しゅみ",
    "indonesian": "hobi",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 1,
    "japanese": "料理",
    "reading": "りょうり",
    "indonesian": "masakan; kegiatan memasak",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 1,
    "japanese": "道具",
    "reading": "どうぐ",
    "indonesian": "alat; perkakas",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 1,
    "japanese": "作品",
    "reading": "さくひん",
    "indonesian": "karya",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 1,
    "japanese": "題名",
    "reading": "だいめい",
    "indonesian": "judul karya",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 1,
    "japanese": "文字",
    "reading": "もじ",
    "indonesian": "huruf; karakter tulisan",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 1,
    "japanese": "作る",
    "reading": "つくる",
    "indonesian": "membuat",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 9
  },
  {
    "chapter": 1,
    "japanese": "使う",
    "reading": "つかう",
    "indonesian": "menggunakan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 1,
    "japanese": "選ぶ",
    "reading": "えらぶ",
    "indonesian": "memilih",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 11
  },
  {
    "chapter": 1,
    "japanese": "探す",
    "reading": "さがす",
    "indonesian": "mencari",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 1,
    "japanese": "泳ぐ",
    "reading": "およぐ",
    "indonesian": "berenang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 13
  },
  {
    "chapter": 1,
    "japanese": "集める",
    "reading": "あつめる",
    "indonesian": "mengumpulkan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 14
  },
  {
    "chapter": 1,
    "japanese": "楽しむ",
    "reading": "たのしむ",
    "indonesian": "menikmati",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 15
  },
  {
    "chapter": 1,
    "japanese": "得意",
    "reading": "とくい",
    "indonesian": "mahir; bidang yang dikuasai",
    "category": "な形容詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 1,
    "japanese": "苦手",
    "reading": "にがて",
    "indonesian": "kurang mahir; kurang menyukai",
    "category": "な形容詞",
    "note": "Makna mengikuti konteks kemampuan atau kesukaan.",
    "position": 17
  },
  {
    "chapter": 1,
    "japanese": "細かい",
    "reading": "こまかい",
    "indonesian": "kecil dan terperinci; halus",
    "category": "い形容詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 2,
    "japanese": "理由",
    "reading": "りゆう",
    "indonesian": "alasan",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 2,
    "japanese": "事情",
    "reading": "じじょう",
    "indonesian": "keadaan; situasi yang melatarbelakangi",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 2,
    "japanese": "意見",
    "reading": "いけん",
    "indonesian": "pendapat",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 2,
    "japanese": "意味",
    "reading": "いみ",
    "indonesian": "arti; makna",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 2,
    "japanese": "質問",
    "reading": "しつもん",
    "indonesian": "pertanyaan",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 2,
    "japanese": "答え",
    "reading": "こたえ",
    "indonesian": "jawaban",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 2,
    "japanese": "説明",
    "reading": "せつめい",
    "indonesian": "penjelasan",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 2,
    "japanese": "考え",
    "reading": "かんがえ",
    "indonesian": "pemikiran; gagasan",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 2,
    "japanese": "思う",
    "reading": "おもう",
    "indonesian": "berpikir; merasa; berpendapat",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 9
  },
  {
    "chapter": 2,
    "japanese": "考える",
    "reading": "かんがえる",
    "indonesian": "memikirkan; mempertimbangkan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 10
  },
  {
    "chapter": 2,
    "japanese": "伝える",
    "reading": "つたえる",
    "indonesian": "menyampaikan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 11
  },
  {
    "chapter": 2,
    "japanese": "答える",
    "reading": "こたえる",
    "indonesian": "menjawab",
    "category": "動詞",
    "note": "Kelompok 2. 質問に答える: menjawab pertanyaan.",
    "position": 12
  },
  {
    "chapter": 2,
    "japanese": "説明する",
    "reading": "せつめいする",
    "indonesian": "menjelaskan",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 13
  },
  {
    "chapter": 2,
    "japanese": "相談する",
    "reading": "そうだんする",
    "indonesian": "berkonsultasi; membicarakan masalah",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 14
  },
  {
    "chapter": 2,
    "japanese": "確かめる",
    "reading": "たしかめる",
    "indonesian": "memastikan; memeriksa kebenaran",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 15
  },
  {
    "chapter": 2,
    "japanese": "本当",
    "reading": "ほんとう",
    "indonesian": "benar; sungguh",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 2,
    "japanese": "実は",
    "reading": "じつは",
    "indonesian": "sebenarnya",
    "category": "副詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 2,
    "japanese": "多分",
    "reading": "たぶん",
    "indonesian": "mungkin; barangkali",
    "category": "副詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 3,
    "japanese": "朝",
    "reading": "あさ",
    "indonesian": "pagi",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 3,
    "japanese": "昼",
    "reading": "ひる",
    "indonesian": "siang",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 3,
    "japanese": "夕方",
    "reading": "ゆうがた",
    "indonesian": "sore menjelang malam",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 3,
    "japanese": "夜",
    "reading": "よる",
    "indonesian": "malam",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 3,
    "japanese": "今朝",
    "reading": "けさ",
    "indonesian": "tadi pagi; pagi ini",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 3,
    "japanese": "今夜",
    "reading": "こんや",
    "indonesian": "malam ini",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 3,
    "japanese": "最近",
    "reading": "さいきん",
    "indonesian": "akhir-akhir ini",
    "category": "名詞・副詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 3,
    "japanese": "先に",
    "reading": "さきに",
    "indonesian": "lebih dahulu",
    "category": "副詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 3,
    "japanese": "後で",
    "reading": "あとで",
    "indonesian": "nanti; setelah itu",
    "category": "副詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 3,
    "japanese": "途中",
    "reading": "とちゅう",
    "indonesian": "di tengah perjalanan atau kegiatan",
    "category": "名詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 3,
    "japanese": "食事",
    "reading": "しょくじ",
    "indonesian": "makan; waktu makan",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 3,
    "japanese": "出発する",
    "reading": "しゅっぱつする",
    "indonesian": "berangkat",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 3,
    "japanese": "帰る",
    "reading": "かえる",
    "indonesian": "pulang",
    "category": "動詞",
    "note": "Kelompok 1. Berakhiran る tetapi termasuk grup 1.",
    "position": 13
  },
  {
    "chapter": 3,
    "japanese": "急ぐ",
    "reading": "いそぐ",
    "indonesian": "bergegas",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 14
  },
  {
    "chapter": 3,
    "japanese": "間に合う",
    "reading": "まにあう",
    "indonesian": "sempat; tiba tepat waktu",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 15
  },
  {
    "chapter": 3,
    "japanese": "遅れる",
    "reading": "おくれる",
    "indonesian": "terlambat",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 16
  },
  {
    "chapter": 3,
    "japanese": "続ける",
    "reading": "つづける",
    "indonesian": "melanjutkan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 17
  },
  {
    "chapter": 3,
    "japanese": "同時に",
    "reading": "どうじに",
    "indonesian": "pada saat yang sama",
    "category": "副詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 4,
    "japanese": "力",
    "reading": "ちから",
    "indonesian": "kekuatan; tenaga",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 4,
    "japanese": "体",
    "reading": "からだ",
    "indonesian": "tubuh",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 4,
    "japanese": "音",
    "reading": "おと",
    "indonesian": "bunyi",
    "category": "名詞",
    "note": "Bunyi secara umum; bandingkan 声 untuk suara manusia atau hewan.",
    "position": 3
  },
  {
    "chapter": 4,
    "japanese": "声",
    "reading": "こえ",
    "indonesian": "suara manusia atau hewan",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 4,
    "japanese": "におい",
    "reading": "におい",
    "indonesian": "bau; aroma",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 4,
    "japanese": "味",
    "reading": "あじ",
    "indonesian": "rasa makanan atau minuman",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 4,
    "japanese": "景色",
    "reading": "けしき",
    "indonesian": "pemandangan",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 4,
    "japanese": "遠く",
    "reading": "とおく",
    "indonesian": "tempat yang jauh; kejauhan",
    "category": "名詞・副詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 4,
    "japanese": "見える",
    "reading": "みえる",
    "indonesian": "terlihat",
    "category": "動詞",
    "note": "Kelompok 2. Menyatakan sesuatu tertangkap penglihatan; bandingkan 見られる.",
    "position": 9
  },
  {
    "chapter": 4,
    "japanese": "聞こえる",
    "reading": "きこえる",
    "indonesian": "terdengar",
    "category": "動詞",
    "note": "Kelompok 2. Menyatakan bunyi tertangkap pendengaran; bandingkan 聞ける.",
    "position": 10
  },
  {
    "chapter": 4,
    "japanese": "できる",
    "reading": "できる",
    "indonesian": "bisa; mampu",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 11
  },
  {
    "chapter": 4,
    "japanese": "運転する",
    "reading": "うんてんする",
    "indonesian": "mengemudi",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 4,
    "japanese": "弾く",
    "reading": "ひく",
    "indonesian": "memainkan alat musik petik atau tuts",
    "category": "動詞",
    "note": "Kelompok 1. ピアノを弾く. Untuk alat tiup gunakan 吹く.",
    "position": 13
  },
  {
    "chapter": 4,
    "japanese": "吹く",
    "reading": "ふく",
    "indonesian": "meniup; bertiup",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 14
  },
  {
    "chapter": 4,
    "japanese": "強い",
    "reading": "つよい",
    "indonesian": "kuat",
    "category": "い形容詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 4,
    "japanese": "弱い",
    "reading": "よわい",
    "indonesian": "lemah",
    "category": "い形容詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 5,
    "japanese": "予定",
    "reading": "よてい",
    "indonesian": "jadwal; rencana",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 5,
    "japanese": "計画",
    "reading": "けいかく",
    "indonesian": "rencana yang disusun",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 5,
    "japanese": "習慣",
    "reading": "しゅうかん",
    "indonesian": "kebiasaan",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 5,
    "japanese": "目標",
    "reading": "もくひょう",
    "indonesian": "sasaran; tujuan yang ingin dicapai",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 5,
    "japanese": "将来",
    "reading": "しょうらい",
    "indonesian": "masa depan",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 5,
    "japanese": "自分",
    "reading": "じぶん",
    "indonesian": "diri sendiri",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 5,
    "japanese": "仕事",
    "reading": "しごと",
    "indonesian": "pekerjaan",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 5,
    "japanese": "決める",
    "reading": "きめる",
    "indonesian": "memutuskan; menetapkan",
    "category": "動詞",
    "note": "Kelompok 2. Rencana atau pilihanを決める; bandingkan 決まる.",
    "position": 8
  },
  {
    "chapter": 5,
    "japanese": "決まる",
    "reading": "きまる",
    "indonesian": "diputuskan; menjadi pasti",
    "category": "動詞",
    "note": "Kelompok 1. Rencana atau pilihanが決まる.",
    "position": 9
  },
  {
    "chapter": 5,
    "japanese": "働く",
    "reading": "はたらく",
    "indonesian": "bekerja",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 5,
    "japanese": "通う",
    "reading": "かよう",
    "indonesian": "pergi secara rutin; bersekolah",
    "category": "動詞",
    "note": "Kelompok 1. 学校に通う.",
    "position": 11
  },
  {
    "chapter": 5,
    "japanese": "習う",
    "reading": "ならう",
    "indonesian": "belajar dari seseorang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 5,
    "japanese": "頑張る",
    "reading": "がんばる",
    "indonesian": "berusaha dengan sungguh-sungguh",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 13
  },
  {
    "chapter": 5,
    "japanese": "やめる",
    "reading": "やめる",
    "indonesian": "berhenti melakukan; menghentikan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 14
  },
  {
    "chapter": 5,
    "japanese": "なるべく",
    "reading": "なるべく",
    "indonesian": "sebisa mungkin",
    "category": "副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 5,
    "japanese": "これから",
    "reading": "これから",
    "indonesian": "mulai sekarang; setelah ini",
    "category": "副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 5,
    "japanese": "必ず",
    "reading": "かならず",
    "indonesian": "pasti; tanpa terlewat",
    "category": "副詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 6,
    "japanese": "試験",
    "reading": "しけん",
    "indonesian": "ujian",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 6,
    "japanese": "結果",
    "reading": "けっか",
    "indonesian": "hasil",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 6,
    "japanese": "失敗",
    "reading": "しっぱい",
    "indonesian": "kegagalan; kesalahan dalam tindakan",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 6,
    "japanese": "成功",
    "reading": "せいこう",
    "indonesian": "keberhasilan",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 6,
    "japanese": "経験",
    "reading": "けいけん",
    "indonesian": "pengalaman",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 6,
    "japanese": "全部",
    "reading": "ぜんぶ",
    "indonesian": "semua; seluruhnya",
    "category": "名詞・副詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 6,
    "japanese": "試す",
    "reading": "ためす",
    "indonesian": "mencoba; menguji",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 7
  },
  {
    "chapter": 6,
    "japanese": "忘れる",
    "reading": "わすれる",
    "indonesian": "lupa",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 8
  },
  {
    "chapter": 6,
    "japanese": "なくす",
    "reading": "なくす",
    "indonesian": "kehilangan; menghilangkan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 9
  },
  {
    "chapter": 6,
    "japanese": "間違える",
    "reading": "まちがえる",
    "indonesian": "keliru; melakukan kesalahan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 10
  },
  {
    "chapter": 6,
    "japanese": "謝る",
    "reading": "あやまる",
    "indonesian": "meminta maaf",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 11
  },
  {
    "chapter": 6,
    "japanese": "安心する",
    "reading": "あんしんする",
    "indonesian": "merasa lega; merasa tenang",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 6,
    "japanese": "残念",
    "reading": "ざんねん",
    "indonesian": "disayangkan; mengecewakan",
    "category": "な形容詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 6,
    "japanese": "うっかり",
    "reading": "うっかり",
    "indonesian": "tanpa sengaja karena kurang perhatian",
    "category": "副詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 6,
    "japanese": "やっと",
    "reading": "やっと",
    "indonesian": "akhirnya setelah usaha atau penantian",
    "category": "副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 7,
    "japanese": "開ける",
    "reading": "あける",
    "indonesian": "membuka",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞: ドアを開ける. Pasangan: 開く.",
    "position": 1
  },
  {
    "chapter": 7,
    "japanese": "開く",
    "reading": "あく",
    "indonesian": "terbuka",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞: ドアが開く. Bacaan あく untuk konteks ini.",
    "position": 2
  },
  {
    "chapter": 7,
    "japanese": "閉める",
    "reading": "しめる",
    "indonesian": "menutup",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞: ドアを閉める. Pasangan: 閉まる.",
    "position": 3
  },
  {
    "chapter": 7,
    "japanese": "閉まる",
    "reading": "しまる",
    "indonesian": "tertutup",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞: ドアが閉まる.",
    "position": 4
  },
  {
    "chapter": 7,
    "japanese": "つける",
    "reading": "つける",
    "indonesian": "menyalakan",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞: 電気をつける. Pasangan: つく.",
    "position": 5
  },
  {
    "chapter": 7,
    "japanese": "つく",
    "reading": "つく",
    "indonesian": "menyala",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞: 電気がつく.",
    "position": 6
  },
  {
    "chapter": 7,
    "japanese": "消す",
    "reading": "けす",
    "indonesian": "mematikan; menghapus",
    "category": "動詞",
    "note": "Kelompok 1. 他動詞: 電気を消す. Pasangan: 消える.",
    "position": 7
  },
  {
    "chapter": 7,
    "japanese": "消える",
    "reading": "きえる",
    "indonesian": "padam; hilang",
    "category": "動詞",
    "note": "Kelompok 2. 自動詞: 電気が消える.",
    "position": 8
  },
  {
    "chapter": 7,
    "japanese": "壊す",
    "reading": "こわす",
    "indonesian": "merusakkan",
    "category": "動詞",
    "note": "Kelompok 1. 他動詞: 機械を壊す. Pasangan: 壊れる.",
    "position": 9
  },
  {
    "chapter": 7,
    "japanese": "壊れる",
    "reading": "こわれる",
    "indonesian": "rusak",
    "category": "動詞",
    "note": "Kelompok 2. 自動詞: 機械が壊れる.",
    "position": 10
  },
  {
    "chapter": 7,
    "japanese": "落とす",
    "reading": "おとす",
    "indonesian": "menjatuhkan",
    "category": "動詞",
    "note": "Kelompok 1. 他動詞. Pasangan: 落ちる.",
    "position": 11
  },
  {
    "chapter": 7,
    "japanese": "落ちる",
    "reading": "おちる",
    "indonesian": "jatuh",
    "category": "動詞",
    "note": "Kelompok 2. 自動詞.",
    "position": 12
  },
  {
    "chapter": 7,
    "japanese": "入れる",
    "reading": "いれる",
    "indonesian": "memasukkan",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞. Pasangan: 入る.",
    "position": 13
  },
  {
    "chapter": 7,
    "japanese": "入る",
    "reading": "はいる",
    "indonesian": "masuk",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞; berakhiran る tetapi grup 1.",
    "position": 14
  },
  {
    "chapter": 7,
    "japanese": "並べる",
    "reading": "ならべる",
    "indonesian": "menyusun berjajar",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞. Pasangan: 並ぶ.",
    "position": 15
  },
  {
    "chapter": 7,
    "japanese": "並ぶ",
    "reading": "ならぶ",
    "indonesian": "berjajar; mengantre",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞.",
    "position": 16
  },
  {
    "chapter": 7,
    "japanese": "準備する",
    "reading": "じゅんびする",
    "indonesian": "mempersiapkan",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 17
  },
  {
    "chapter": 7,
    "japanese": "片付ける",
    "reading": "かたづける",
    "indonesian": "membereskan; merapikan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 18
  },
  {
    "chapter": 7,
    "japanese": "窓",
    "reading": "まど",
    "indonesian": "jendela",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 7,
    "japanese": "鍵",
    "reading": "かぎ",
    "indonesian": "kunci",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 8,
    "japanese": "始める",
    "reading": "はじめる",
    "indonesian": "memulai",
    "category": "動詞",
    "note": "Kelompok 2. 他動詞. Pasangan: 始まる.",
    "position": 1
  },
  {
    "chapter": 8,
    "japanese": "始まる",
    "reading": "はじまる",
    "indonesian": "dimulai; mulai berlangsung",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞.",
    "position": 2
  },
  {
    "chapter": 8,
    "japanese": "終わる",
    "reading": "おわる",
    "indonesian": "berakhir; selesai",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 3
  },
  {
    "chapter": 8,
    "japanese": "進む",
    "reading": "すすむ",
    "indonesian": "maju; berkembang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 4
  },
  {
    "chapter": 8,
    "japanese": "増える",
    "reading": "ふえる",
    "indonesian": "bertambah",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 5
  },
  {
    "chapter": 8,
    "japanese": "減る",
    "reading": "へる",
    "indonesian": "berkurang",
    "category": "動詞",
    "note": "Kelompok 1. Berakhiran る tetapi grup 1.",
    "position": 6
  },
  {
    "chapter": 8,
    "japanese": "変わる",
    "reading": "かわる",
    "indonesian": "berubah",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 7
  },
  {
    "chapter": 8,
    "japanese": "戻る",
    "reading": "もどる",
    "indonesian": "kembali",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 8
  },
  {
    "chapter": 8,
    "japanese": "運ぶ",
    "reading": "はこぶ",
    "indonesian": "membawa; mengangkut",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 9
  },
  {
    "chapter": 8,
    "japanese": "届く",
    "reading": "とどく",
    "indonesian": "sampai; terkirim ke tujuan",
    "category": "動詞",
    "note": "Kelompok 1. 荷物が届く.",
    "position": 10
  },
  {
    "chapter": 8,
    "japanese": "出発",
    "reading": "しゅっぱつ",
    "indonesian": "keberangkatan",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 8,
    "japanese": "到着",
    "reading": "とうちゃく",
    "indonesian": "kedatangan",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 8,
    "japanese": "今から",
    "reading": "いまから",
    "indonesian": "mulai sekarang; segera setelah ini",
    "category": "副詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 8,
    "japanese": "さっき",
    "reading": "さっき",
    "indonesian": "barusan; tadi",
    "category": "副詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 8,
    "japanese": "まだ",
    "reading": "まだ",
    "indonesian": "masih; belum",
    "category": "副詞",
    "note": "Arti ditentukan predikat: まだ働いている / まだ終わっていない.",
    "position": 15
  },
  {
    "chapter": 8,
    "japanese": "もう",
    "reading": "もう",
    "indonesian": "sudah; lagi",
    "category": "副詞",
    "note": "Makna dasar bab ini: sudah selesai melakukan.",
    "position": 16
  },
  {
    "chapter": 8,
    "japanese": "だんだん",
    "reading": "だんだん",
    "indonesian": "sedikit demi sedikit; berangsur-angsur",
    "category": "副詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 9,
    "japanese": "方法",
    "reading": "ほうほう",
    "indonesian": "cara; metode",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 9,
    "japanese": "使い方",
    "reading": "つかいかた",
    "indonesian": "cara menggunakan",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 9,
    "japanese": "読み方",
    "reading": "よみかた",
    "indonesian": "cara membaca",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 9,
    "japanese": "高さ",
    "reading": "たかさ",
    "indonesian": "ketinggian",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 9,
    "japanese": "重さ",
    "reading": "おもさ",
    "indonesian": "berat suatu benda",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 9,
    "japanese": "軽い",
    "reading": "かるい",
    "indonesian": "ringan",
    "category": "い形容詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 9,
    "japanese": "重い",
    "reading": "おもい",
    "indonesian": "berat",
    "category": "い形容詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 9,
    "japanese": "柔らかい",
    "reading": "やわらかい",
    "indonesian": "lunak; lembut",
    "category": "い形容詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 9,
    "japanese": "硬い",
    "reading": "かたい",
    "indonesian": "keras",
    "category": "い形容詞",
    "note": "Keras saat disentuh; bandingkan 柔らかい.",
    "position": 9
  },
  {
    "chapter": 9,
    "japanese": "細い",
    "reading": "ほそい",
    "indonesian": "tipis; ramping untuk benda memanjang",
    "category": "い形容詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 9,
    "japanese": "太い",
    "reading": "ふとい",
    "indonesian": "tebal; besar untuk benda memanjang",
    "category": "い形容詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 9,
    "japanese": "簡単",
    "reading": "かんたん",
    "indonesian": "mudah; sederhana",
    "category": "な形容詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 9,
    "japanese": "複雑",
    "reading": "ふくざつ",
    "indonesian": "rumit",
    "category": "な形容詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 9,
    "japanese": "便利",
    "reading": "べんり",
    "indonesian": "praktis; memudahkan",
    "category": "な形容詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 9,
    "japanese": "不便",
    "reading": "ふべん",
    "indonesian": "tidak praktis; menyulitkan",
    "category": "な形容詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 9,
    "japanese": "ゆっくり",
    "reading": "ゆっくり",
    "indonesian": "pelan-pelan; dengan santai",
    "category": "副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 9,
    "japanese": "丁寧",
    "reading": "ていねい",
    "indonesian": "sopan; teliti",
    "category": "な形容詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 10,
    "japanese": "原因",
    "reading": "げんいん",
    "indonesian": "penyebab",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 10,
    "japanese": "都合",
    "reading": "つごう",
    "indonesian": "keadaan; kecocokan waktu atau jadwal",
    "category": "名詞",
    "note": "都合がいい / 都合が悪い.",
    "position": 2
  },
  {
    "chapter": 10,
    "japanese": "約束",
    "reading": "やくそく",
    "indonesian": "janji",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 10,
    "japanese": "問題",
    "reading": "もんだい",
    "indonesian": "masalah; soal",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 10,
    "japanese": "用事",
    "reading": "ようじ",
    "indonesian": "urusan; keperluan",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 10,
    "japanese": "忙しい",
    "reading": "いそがしい",
    "indonesian": "sibuk",
    "category": "い形容詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 10,
    "japanese": "眠い",
    "reading": "ねむい",
    "indonesian": "mengantuk",
    "category": "い形容詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 10,
    "japanese": "疲れる",
    "reading": "つかれる",
    "indonesian": "menjadi lelah",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 8
  },
  {
    "chapter": 10,
    "japanese": "困る",
    "reading": "こまる",
    "indonesian": "kesulitan; kebingungan menghadapi masalah",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 9
  },
  {
    "chapter": 10,
    "japanese": "休む",
    "reading": "やすむ",
    "indonesian": "beristirahat; tidak masuk",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 10,
    "japanese": "遅刻する",
    "reading": "ちこくする",
    "indonesian": "datang terlambat",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 11
  },
  {
    "chapter": 10,
    "japanese": "それで",
    "reading": "それで",
    "indonesian": "karena itu; lalu akibatnya",
    "category": "接続詞",
    "note": "Menghubungkan suatu keadaan dengan akibatnya.",
    "position": 12
  },
  {
    "chapter": 10,
    "japanese": "だから",
    "reading": "だから",
    "indonesian": "jadi; oleh karena itu",
    "category": "接続詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 10,
    "japanese": "それなのに",
    "reading": "それなのに",
    "indonesian": "meskipun demikian; padahal begitu",
    "category": "接続詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 10,
    "japanese": "でも",
    "reading": "でも",
    "indonesian": "tetapi; namun",
    "category": "接続詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 10,
    "japanese": "しかも",
    "reading": "しかも",
    "indonesian": "apalagi; terlebih lagi",
    "category": "接続詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 11,
    "japanese": "天気予報",
    "reading": "てんきよほう",
    "indonesian": "prakiraan cuaca",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 11,
    "japanese": "ニュース",
    "reading": "ニュース",
    "indonesian": "berita",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 11,
    "japanese": "連絡",
    "reading": "れんらく",
    "indonesian": "kabar; komunikasi",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 11,
    "japanese": "情報",
    "reading": "じょうほう",
    "indonesian": "informasi",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 11,
    "japanese": "うわさ",
    "reading": "うわさ",
    "indonesian": "kabar angin; desas-desus",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 11,
    "japanese": "様子",
    "reading": "ようす",
    "indonesian": "keadaan yang tampak; gelagat",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 11,
    "japanese": "空",
    "reading": "そら",
    "indonesian": "langit",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 11,
    "japanese": "雲",
    "reading": "くも",
    "indonesian": "awan",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 11,
    "japanese": "風",
    "reading": "かぜ",
    "indonesian": "angin",
    "category": "名詞",
    "note": "Bedakan 風邪: pilek/selesma, dengan bacaan yang sama.",
    "position": 9
  },
  {
    "chapter": 11,
    "japanese": "降る",
    "reading": "ふる",
    "indonesian": "turun untuk hujan atau salju",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 11,
    "japanese": "晴れる",
    "reading": "はれる",
    "indonesian": "menjadi cerah",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 11
  },
  {
    "chapter": 11,
    "japanese": "曇る",
    "reading": "くもる",
    "indonesian": "berawan; mendung",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 11,
    "japanese": "知らせる",
    "reading": "しらせる",
    "indonesian": "memberi tahu",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 13
  },
  {
    "chapter": 11,
    "japanese": "きっと",
    "reading": "きっと",
    "indonesian": "pasti menurut perkiraan pembicara",
    "category": "副詞",
    "note": "Bukan jaminan atau persentase kepastian tetap.",
    "position": 14
  },
  {
    "chapter": 11,
    "japanese": "もしかすると",
    "reading": "もしかすると",
    "indonesian": "barangkali; mungkin saja",
    "category": "副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 11,
    "japanese": "確か",
    "reading": "たしか",
    "indonesian": "kalau tidak salah; pasti menurut konteks",
    "category": "副詞・な形容詞",
    "note": "たしか来週です: kalau tidak salah minggu depan.",
    "position": 16
  },
  {
    "chapter": 12,
    "japanese": "気持ち",
    "reading": "きもち",
    "indonesian": "perasaan",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 12,
    "japanese": "気分",
    "reading": "きぶん",
    "indonesian": "suasana hati; kondisi perasaan tubuh",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 12,
    "japanese": "顔",
    "reading": "かお",
    "indonesian": "wajah",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 12,
    "japanese": "夢",
    "reading": "ゆめ",
    "indonesian": "mimpi; cita-cita",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 12,
    "japanese": "嬉しい",
    "reading": "うれしい",
    "indonesian": "senang; gembira",
    "category": "い形容詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 12,
    "japanese": "悲しい",
    "reading": "かなしい",
    "indonesian": "sedih",
    "category": "い形容詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 12,
    "japanese": "寂しい",
    "reading": "さびしい",
    "indonesian": "kesepian; merasa sepi",
    "category": "い形容詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 12,
    "japanese": "怖い",
    "reading": "こわい",
    "indonesian": "menakutkan; merasa takut",
    "category": "い形容詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 12,
    "japanese": "恥ずかしい",
    "reading": "はずかしい",
    "indonesian": "malu",
    "category": "い形容詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 12,
    "japanese": "嫌",
    "reading": "いや",
    "indonesian": "tidak suka; enggan",
    "category": "な形容詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 12,
    "japanese": "似る",
    "reading": "にる",
    "indonesian": "mirip",
    "category": "動詞",
    "note": "Kelompok 2. Umumnya dipakai sebagai 似ている: mirip dengan.",
    "position": 11
  },
  {
    "chapter": 12,
    "japanese": "笑う",
    "reading": "わらう",
    "indonesian": "tertawa; tersenyum",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 12,
    "japanese": "泣く",
    "reading": "なく",
    "indonesian": "menangis",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 13
  },
  {
    "chapter": 12,
    "japanese": "喜ぶ",
    "reading": "よろこぶ",
    "indonesian": "merasa senang; bergembira",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 14
  },
  {
    "chapter": 12,
    "japanese": "怖がる",
    "reading": "こわがる",
    "indonesian": "menunjukkan rasa takut",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 15
  },
  {
    "chapter": 12,
    "japanese": "欲しがる",
    "reading": "ほしがる",
    "indonesian": "menunjukkan keinginan memiliki",
    "category": "動詞",
    "note": "Kelompok 1. Bendaを欲しがる; lazim dipakai untuk orang lain.",
    "position": 16
  },
  {
    "chapter": 13,
    "japanese": "道",
    "reading": "みち",
    "indonesian": "jalan",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 13,
    "japanese": "交差点",
    "reading": "こうさてん",
    "indonesian": "persimpangan jalan",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 13,
    "japanese": "信号",
    "reading": "しんごう",
    "indonesian": "lampu atau isyarat lalu lintas",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 13,
    "japanese": "橋",
    "reading": "はし",
    "indonesian": "jembatan",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 13,
    "japanese": "角",
    "reading": "かど",
    "indonesian": "sudut; pojok jalan",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 13,
    "japanese": "場所",
    "reading": "ばしょ",
    "indonesian": "tempat; lokasi",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 13,
    "japanese": "地図",
    "reading": "ちず",
    "indonesian": "peta",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 13,
    "japanese": "曲がる",
    "reading": "まがる",
    "indonesian": "berbelok; membengkok",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 8
  },
  {
    "chapter": 13,
    "japanese": "渡る",
    "reading": "わたる",
    "indonesian": "menyeberang",
    "category": "動詞",
    "note": "Kelompok 1. 橋を渡る: menyeberangi jembatan.",
    "position": 9
  },
  {
    "chapter": 13,
    "japanese": "押す",
    "reading": "おす",
    "indonesian": "menekan; mendorong",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 13,
    "japanese": "動く",
    "reading": "うごく",
    "indonesian": "bergerak; berfungsi",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 11
  },
  {
    "chapter": 13,
    "japanese": "着く",
    "reading": "つく",
    "indonesian": "tiba",
    "category": "動詞",
    "note": "Kelompok 1. Tempatに着く.",
    "position": 12
  },
  {
    "chapter": 13,
    "japanese": "止まる",
    "reading": "とまる",
    "indonesian": "berhenti",
    "category": "動詞",
    "note": "Kelompok 1. 自動詞. Bandingkan 止める.",
    "position": 13
  },
  {
    "chapter": 13,
    "japanese": "もし",
    "reading": "もし",
    "indonesian": "jika; seandainya",
    "category": "副詞",
    "note": "Mendampingi bentuk pengandaian, bukan pengganti bentuknya.",
    "position": 14
  },
  {
    "chapter": 13,
    "japanese": "まっすぐ",
    "reading": "まっすぐ",
    "indonesian": "lurus; langsung",
    "category": "副詞・な形容詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 13,
    "japanese": "すると",
    "reading": "すると",
    "indonesian": "lalu; setelah itu ternyata",
    "category": "接続詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 14,
    "japanese": "条件",
    "reading": "じょうけん",
    "indonesian": "syarat; kondisi",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 14,
    "japanese": "場合",
    "reading": "ばあい",
    "indonesian": "keadaan; situasi; hal",
    "category": "名詞",
    "note": "Pola 場合は dibahas lebih lanjut pada Bab 20.",
    "position": 2
  },
  {
    "chapter": 14,
    "japanese": "機会",
    "reading": "きかい",
    "indonesian": "kesempatan",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 14,
    "japanese": "都合",
    "reading": "つごう",
    "indonesian": "kecocokan jadwal; keadaan",
    "category": "名詞",
    "note": "Pengulangan terarah untuk menyatakan syarat.",
    "position": 4
  },
  {
    "chapter": 14,
    "japanese": "お勧め",
    "reading": "おすすめ",
    "indonesian": "rekomendasi; hal yang disarankan",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 14,
    "japanese": "予約",
    "reading": "よやく",
    "indonesian": "reservasi; pemesanan sebelumnya",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 14,
    "japanese": "参加する",
    "reading": "さんかする",
    "indonesian": "ikut serta",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 7
  },
  {
    "chapter": 14,
    "japanese": "調べる",
    "reading": "しらべる",
    "indonesian": "memeriksa; mencari informasi",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 8
  },
  {
    "chapter": 14,
    "japanese": "比べる",
    "reading": "くらべる",
    "indonesian": "membandingkan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 9
  },
  {
    "chapter": 14,
    "japanese": "選ぶ",
    "reading": "えらぶ",
    "indonesian": "memilih",
    "category": "動詞",
    "note": "Kelompok 1. Pengulangan terarah dalam kalimat bersyarat.",
    "position": 10
  },
  {
    "chapter": 14,
    "japanese": "間に合う",
    "reading": "まにあう",
    "indonesian": "sempat; tepat waktu",
    "category": "動詞",
    "note": "Kelompok 1. Dipakai untuk syarat dan penyesalan.",
    "position": 11
  },
  {
    "chapter": 14,
    "japanese": "必要",
    "reading": "ひつよう",
    "indonesian": "perlu; diperlukan",
    "category": "な形容詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 14,
    "japanese": "十分",
    "reading": "じゅうぶん",
    "indonesian": "cukup; memadai",
    "category": "な形容詞・副詞",
    "note": "Bacaan じゅうぶん, bukan じゅっぷん yang berarti sepuluh menit.",
    "position": 13
  },
  {
    "chapter": 14,
    "japanese": "できれば",
    "reading": "できれば",
    "indonesian": "kalau memungkinkan",
    "category": "副詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 15,
    "japanese": "目的",
    "reading": "もくてき",
    "indonesian": "tujuan",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 15,
    "japanese": "ため",
    "reading": "ため",
    "indonesian": "kepentingan; tujuan",
    "category": "名詞",
    "note": "Dalam bab ini dipakai untuk tujuan/manfaat, bukan sebab.",
    "position": 2
  },
  {
    "chapter": 15,
    "japanese": "道具",
    "reading": "どうぐ",
    "indonesian": "alat; perkakas",
    "category": "名詞",
    "note": "Pengulangan terarah untuk menjelaskan kegunaan.",
    "position": 3
  },
  {
    "chapter": 15,
    "japanese": "材料",
    "reading": "ざいりょう",
    "indonesian": "bahan",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 15,
    "japanese": "資料",
    "reading": "しりょう",
    "indonesian": "bahan informasi; dokumen rujukan",
    "category": "名詞",
    "note": "Bedakan 資料 dari 材料: bahan pembuat sesuatu.",
    "position": 5
  },
  {
    "chapter": 15,
    "japanese": "説明書",
    "reading": "せつめいしょ",
    "indonesian": "buku petunjuk",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 15,
    "japanese": "授業",
    "reading": "じゅぎょう",
    "indonesian": "pelajaran; kegiatan belajar di kelas",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 15,
    "japanese": "教室",
    "reading": "きょうしつ",
    "indonesian": "ruang kelas",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 15,
    "japanese": "会場",
    "reading": "かいじょう",
    "indonesian": "tempat berlangsungnya acara",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 15,
    "japanese": "申し込む",
    "reading": "もうしこむ",
    "indonesian": "mendaftar; mengajukan permohonan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 15,
    "japanese": "準備する",
    "reading": "じゅんびする",
    "indonesian": "mempersiapkan",
    "category": "動詞",
    "note": "Kelompok 3. Pengulangan terarah untuk menyatakan tujuan.",
    "position": 11
  },
  {
    "chapter": 15,
    "japanese": "役に立つ",
    "reading": "やくにたつ",
    "indonesian": "berguna; bermanfaat",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 15,
    "japanese": "かかる",
    "reading": "かかる",
    "indonesian": "memerlukan waktu atau biaya",
    "category": "動詞",
    "note": "Kelompok 1. 時間がかかる / お金がかかる.",
    "position": 13
  },
  {
    "chapter": 15,
    "japanese": "伝える",
    "reading": "つたえる",
    "indonesian": "menyampaikan",
    "category": "動詞",
    "note": "Kelompok 2. Dipakai untuk instruksi tidak langsung.",
    "position": 14
  },
  {
    "chapter": 15,
    "japanese": "忘れ物",
    "reading": "わすれもの",
    "indonesian": "barang yang tertinggal atau terlupa dibawa",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 15,
    "japanese": "練習する",
    "reading": "れんしゅうする",
    "indonesian": "berlatih",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 16
  },
  {
    "chapter": 16,
    "japanese": "規則",
    "reading": "きそく",
    "indonesian": "peraturan",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 16,
    "japanese": "注意",
    "reading": "ちゅうい",
    "indonesian": "perhatian; peringatan",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 16,
    "japanese": "健康",
    "reading": "けんこう",
    "indonesian": "kesehatan; sehat",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 16,
    "japanese": "病気",
    "reading": "びょうき",
    "indonesian": "sakit; penyakit",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 16,
    "japanese": "薬",
    "reading": "くすり",
    "indonesian": "obat",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 16,
    "japanese": "熱",
    "reading": "ねつ",
    "indonesian": "demam; panas",
    "category": "名詞",
    "note": "熱がある: demam.",
    "position": 6
  },
  {
    "chapter": 16,
    "japanese": "無理",
    "reading": "むり",
    "indonesian": "tidak masuk akal; memaksakan diri",
    "category": "名詞・な形容詞",
    "note": "無理をする: memaksakan diri.",
    "position": 7
  },
  {
    "chapter": 16,
    "japanese": "危険",
    "reading": "きけん",
    "indonesian": "bahaya; berbahaya",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 16,
    "japanese": "安全",
    "reading": "あんぜん",
    "indonesian": "aman; keselamatan",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 16,
    "japanese": "守る",
    "reading": "まもる",
    "indonesian": "menaati; melindungi",
    "category": "動詞",
    "note": "Kelompok 1. 規則を守る: menaati aturan.",
    "position": 10
  },
  {
    "chapter": 16,
    "japanese": "気をつける",
    "reading": "きをつける",
    "indonesian": "berhati-hati",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 11
  },
  {
    "chapter": 16,
    "japanese": "休憩する",
    "reading": "きゅうけいする",
    "indonesian": "beristirahat sejenak",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 16,
    "japanese": "禁止する",
    "reading": "きんしする",
    "indonesian": "melarang",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 13
  },
  {
    "chapter": 16,
    "japanese": "洗う",
    "reading": "あらう",
    "indonesian": "mencuci",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 14
  },
  {
    "chapter": 16,
    "japanese": "片付ける",
    "reading": "かたづける",
    "indonesian": "membereskan",
    "category": "動詞",
    "note": "Kelompok 2. Pengulangan terarah untuk instruksi.",
    "position": 15
  },
  {
    "chapter": 16,
    "japanese": "すぐ",
    "reading": "すぐ",
    "indonesian": "segera; langsung",
    "category": "副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 17,
    "japanese": "あげる",
    "reading": "あげる",
    "indonesian": "memberi kepada orang lain",
    "category": "動詞",
    "note": "Kelompok 2. Pemberiは penerimaに bendaをあげる.",
    "position": 1
  },
  {
    "chapter": 17,
    "japanese": "もらう",
    "reading": "もらう",
    "indonesian": "menerima",
    "category": "動詞",
    "note": "Kelompok 1. Penerimaは pemberiに／から bendaをもらう.",
    "position": 2
  },
  {
    "chapter": 17,
    "japanese": "くれる",
    "reading": "くれる",
    "indonesian": "memberi kepada saya atau pihak saya",
    "category": "動詞",
    "note": "Kelompok 2. Pelaku adalah pemberi; arah manfaat menuju pihak pembicara.",
    "position": 3
  },
  {
    "chapter": 17,
    "japanese": "贈る",
    "reading": "おくる",
    "indonesian": "menghadiahkan",
    "category": "動詞",
    "note": "Kelompok 1. Bedakan 贈る dengan 送る: mengirim.",
    "position": 4
  },
  {
    "chapter": 17,
    "japanese": "送る",
    "reading": "おくる",
    "indonesian": "mengirim",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 5
  },
  {
    "chapter": 17,
    "japanese": "受け取る",
    "reading": "うけとる",
    "indonesian": "menerima sesuatu yang diserahkan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 6
  },
  {
    "chapter": 17,
    "japanese": "渡す",
    "reading": "わたす",
    "indonesian": "menyerahkan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 7
  },
  {
    "chapter": 17,
    "japanese": "貸す",
    "reading": "かす",
    "indonesian": "meminjamkan",
    "category": "動詞",
    "note": "Kelompok 1. Peminjamに bendaを貸す.",
    "position": 8
  },
  {
    "chapter": 17,
    "japanese": "借りる",
    "reading": "かりる",
    "indonesian": "meminjam",
    "category": "動詞",
    "note": "Kelompok 2. Pemilikに bendaを借りる.",
    "position": 9
  },
  {
    "chapter": 17,
    "japanese": "返す",
    "reading": "かえす",
    "indonesian": "mengembalikan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 10
  },
  {
    "chapter": 17,
    "japanese": "プレゼント",
    "reading": "プレゼント",
    "indonesian": "hadiah",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 17,
    "japanese": "お土産",
    "reading": "おみやげ",
    "indonesian": "oleh-oleh",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 17,
    "japanese": "お祝い",
    "reading": "おいわい",
    "indonesian": "ucapan atau hadiah perayaan",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 17,
    "japanese": "お礼",
    "reading": "おれい",
    "indonesian": "ucapan atau tanda terima kasih",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 17,
    "japanese": "誕生日",
    "reading": "たんじょうび",
    "indonesian": "ulang tahun",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 17,
    "japanese": "家族",
    "reading": "かぞく",
    "indonesian": "keluarga",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 17,
    "japanese": "親戚",
    "reading": "しんせき",
    "indonesian": "kerabat",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 17,
    "japanese": "先輩",
    "reading": "せんぱい",
    "indonesian": "senior dalam sekolah atau tempat kerja",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 18,
    "japanese": "手伝う",
    "reading": "てつだう",
    "indonesian": "membantu pekerjaan seseorang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 1
  },
  {
    "chapter": 18,
    "japanese": "助ける",
    "reading": "たすける",
    "indonesian": "menolong; menyelamatkan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 2
  },
  {
    "chapter": 18,
    "japanese": "頼む",
    "reading": "たのむ",
    "indonesian": "meminta; mengandalkan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 3
  },
  {
    "chapter": 18,
    "japanese": "お願いする",
    "reading": "おねがいする",
    "indonesian": "meminta; memohon",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 4
  },
  {
    "chapter": 18,
    "japanese": "迎える",
    "reading": "むかえる",
    "indonesian": "menjemput; menyambut",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 5
  },
  {
    "chapter": 18,
    "japanese": "教える",
    "reading": "おしえる",
    "indonesian": "mengajar; memberi tahu",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 6
  },
  {
    "chapter": 18,
    "japanese": "直す",
    "reading": "なおす",
    "indonesian": "memperbaiki",
    "category": "動詞",
    "note": "Kelompok 1. Dipakai sebagai kata kerja mandiri; gabungan Vます-stem＋直す merupakan pengayaan.",
    "position": 7
  },
  {
    "chapter": 18,
    "japanese": "持つ",
    "reading": "もつ",
    "indonesian": "memegang; membawa; memiliki",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 8
  },
  {
    "chapter": 18,
    "japanese": "荷物",
    "reading": "にもつ",
    "indonesian": "barang bawaan; paket",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 18,
    "japanese": "引っ越し",
    "reading": "ひっこし",
    "indonesian": "pindah tempat tinggal",
    "category": "名詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 18,
    "japanese": "案内",
    "reading": "あんない",
    "indonesian": "panduan; kegiatan mengantar atau menunjukkan tempat",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 18,
    "japanese": "連絡する",
    "reading": "れんらくする",
    "indonesian": "menghubungi; memberi kabar",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 18,
    "japanese": "迷惑",
    "reading": "めいわく",
    "indonesian": "gangguan; kerepotan bagi orang lain",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 18,
    "japanese": "親切",
    "reading": "しんせつ",
    "indonesian": "baik hati; suka menolong",
    "category": "な形容詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 18,
    "japanese": "感謝する",
    "reading": "かんしゃする",
    "indonesian": "berterima kasih; bersyukur",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 15
  },
  {
    "chapter": 18,
    "japanese": "後輩",
    "reading": "こうはい",
    "indonesian": "junior dalam sekolah atau tempat kerja",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 19,
    "japanese": "人数",
    "reading": "にんずう",
    "indonesian": "jumlah orang",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 19,
    "japanese": "数",
    "reading": "かず",
    "indonesian": "jumlah; bilangan",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 19,
    "japanese": "住所",
    "reading": "じゅうしょ",
    "indonesian": "alamat",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 19,
    "japanese": "予定",
    "reading": "よてい",
    "indonesian": "jadwal; rencana",
    "category": "名詞",
    "note": "Pengulangan terarah untuk pertanyaan tertanam.",
    "position": 4
  },
  {
    "chapter": 19,
    "japanese": "出席",
    "reading": "しゅっせき",
    "indonesian": "kehadiran",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 19,
    "japanese": "欠席",
    "reading": "けっせき",
    "indonesian": "ketidakhadiran",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 19,
    "japanese": "残り",
    "reading": "のこり",
    "indonesian": "sisa",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 19,
    "japanese": "一部",
    "reading": "いちぶ",
    "indonesian": "sebagian; satu bagian",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 19,
    "japanese": "全部",
    "reading": "ぜんぶ",
    "indonesian": "semua; seluruhnya",
    "category": "名詞・副詞",
    "note": "Pengulangan terarah untuk pembatasan jumlah.",
    "position": 9
  },
  {
    "chapter": 19,
    "japanese": "足りる",
    "reading": "たりる",
    "indonesian": "cukup; mencukupi",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 10
  },
  {
    "chapter": 19,
    "japanese": "残る",
    "reading": "のこる",
    "indonesian": "tersisa; tinggal",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 11
  },
  {
    "chapter": 19,
    "japanese": "確認する",
    "reading": "かくにんする",
    "indonesian": "memeriksa untuk memastikan",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 12
  },
  {
    "chapter": 19,
    "japanese": "尋ねる",
    "reading": "たずねる",
    "indonesian": "bertanya; menanyakan",
    "category": "動詞",
    "note": "Kelompok 2. Bedakan 尋ねる dari 訪ねる: mengunjungi.",
    "position": 13
  },
  {
    "chapter": 19,
    "japanese": "調べる",
    "reading": "しらべる",
    "indonesian": "memeriksa; mencari informasi",
    "category": "動詞",
    "note": "Kelompok 2. Pengulangan terarah untuk hal yang belum diketahui.",
    "position": 14
  },
  {
    "chapter": 19,
    "japanese": "ほとんど",
    "reading": "ほとんど",
    "indonesian": "hampir seluruhnya; hampir tidak",
    "category": "副詞",
    "note": "Dengan predikat negatif berarti hampir tidak.",
    "position": 15
  },
  {
    "chapter": 19,
    "japanese": "たった",
    "reading": "たった",
    "indonesian": "hanya; cuma",
    "category": "副詞",
    "note": "Menekankan kecilnya jumlah.",
    "position": 16
  },
  {
    "chapter": 20,
    "japanese": "以上",
    "reading": "いじょう",
    "indonesian": "sekurang-kurangnya; atau lebih",
    "category": "名詞",
    "note": "Dengan angka, batas termasuk: 18歳以上 mencakup 18 tahun.",
    "position": 1
  },
  {
    "chapter": 20,
    "japanese": "以下",
    "reading": "いか",
    "indonesian": "paling banyak; atau kurang",
    "category": "名詞",
    "note": "Dengan angka, batas termasuk: 10人以下 mencakup 10 orang.",
    "position": 2
  },
  {
    "chapter": 20,
    "japanese": "未満",
    "reading": "みまん",
    "indonesian": "kurang dari",
    "category": "名詞",
    "note": "Batas tidak termasuk: 18歳未満 tidak mencakup 18 tahun.",
    "position": 3
  },
  {
    "chapter": 20,
    "japanese": "以外",
    "reading": "いがい",
    "indonesian": "selain; di luar",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 20,
    "japanese": "以内",
    "reading": "いない",
    "indonesian": "dalam batas",
    "category": "名詞",
    "note": "Waktu atau jarak: 一時間以内.",
    "position": 5
  },
  {
    "chapter": 20,
    "japanese": "回数",
    "reading": "かいすう",
    "indonesian": "jumlah kali",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 20,
    "japanese": "距離",
    "reading": "きょり",
    "indonesian": "jarak",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 20,
    "japanese": "温度",
    "reading": "おんど",
    "indonesian": "suhu",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 20,
    "japanese": "場合",
    "reading": "ばあい",
    "indonesian": "situasi; keadaan tertentu",
    "category": "名詞",
    "note": "Pengulangan terarah untuk petunjuk bersyarat.",
    "position": 9
  },
  {
    "chapter": 20,
    "japanese": "状態",
    "reading": "じょうたい",
    "indonesian": "keadaan; kondisi",
    "category": "名詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 20,
    "japanese": "順番",
    "reading": "じゅんばん",
    "indonesian": "urutan; giliran",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 20,
    "japanese": "説明",
    "reading": "せつめい",
    "indonesian": "penjelasan",
    "category": "名詞",
    "note": "Pengulangan terarah: 説明したとおりに.",
    "position": 12
  },
  {
    "chapter": 20,
    "japanese": "同じ",
    "reading": "おなじ",
    "indonesian": "sama",
    "category": "連体詞・名詞",
    "note": "Langsung sebelum nomina: 同じ物; bukan 同じな物.",
    "position": 13
  },
  {
    "chapter": 20,
    "japanese": "違う",
    "reading": "ちがう",
    "indonesian": "berbeda; tidak benar",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 14
  },
  {
    "chapter": 20,
    "japanese": "比べる",
    "reading": "くらべる",
    "indonesian": "membandingkan",
    "category": "動詞",
    "note": "Kelompok 2. Pengulangan terarah untuk perbandingan derajat.",
    "position": 15
  },
  {
    "chapter": 20,
    "japanese": "そのまま",
    "reading": "そのまま",
    "indonesian": "tetap begitu; tanpa mengubahnya",
    "category": "副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 20,
    "japanese": "例えば",
    "reading": "たとえば",
    "indonesian": "misalnya",
    "category": "副詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 20,
    "japanese": "一回",
    "reading": "いっかい",
    "indonesian": "satu kali",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 21,
    "japanese": "褒める",
    "reading": "ほめる",
    "indonesian": "memuji",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 1
  },
  {
    "chapter": 21,
    "japanese": "叱る",
    "reading": "しかる",
    "indonesian": "memarahi; menegur",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 2
  },
  {
    "chapter": 21,
    "japanese": "注意する",
    "reading": "ちゅういする",
    "indonesian": "memperingatkan; berhati-hati",
    "category": "動詞",
    "note": "Kelompok 3. 人に注意する: menegur seseorang; 物事に注意する: memperhatikan sesuatu.",
    "position": 3
  },
  {
    "chapter": 21,
    "japanese": "誘う",
    "reading": "さそう",
    "indonesian": "mengajak; mengundang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 4
  },
  {
    "chapter": 21,
    "japanese": "呼ぶ",
    "reading": "よぶ",
    "indonesian": "memanggil; mengundang",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 5
  },
  {
    "chapter": 21,
    "japanese": "盗む",
    "reading": "ぬすむ",
    "indonesian": "mencuri",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 6
  },
  {
    "chapter": 21,
    "japanese": "踏む",
    "reading": "ふむ",
    "indonesian": "menginjak",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 7
  },
  {
    "chapter": 21,
    "japanese": "壊す",
    "reading": "こわす",
    "indonesian": "merusakkan",
    "category": "動詞",
    "note": "Kelompok 1. Pengulangan terarah untuk pihak yang terdampak.",
    "position": 8
  },
  {
    "chapter": 21,
    "japanese": "建てる",
    "reading": "たてる",
    "indonesian": "membangun bangunan",
    "category": "動詞",
    "note": "Kelompok 2.",
    "position": 9
  },
  {
    "chapter": 21,
    "japanese": "発明する",
    "reading": "はつめいする",
    "indonesian": "menemukan atau menciptakan teknologi baru",
    "category": "動詞",
    "note": "Kelompok 3.",
    "position": 10
  },
  {
    "chapter": 21,
    "japanese": "発見する",
    "reading": "はっけんする",
    "indonesian": "menemukan sesuatu yang sudah ada",
    "category": "動詞",
    "note": "Kelompok 3. Bedakan 発見する dengan 発明する.",
    "position": 11
  },
  {
    "chapter": 21,
    "japanese": "被害",
    "reading": "ひがい",
    "indonesian": "kerugian; dampak buruk yang diderita",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 21,
    "japanese": "事故",
    "reading": "じこ",
    "indonesian": "kecelakaan",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 21,
    "japanese": "財布",
    "reading": "さいふ",
    "indonesian": "dompet",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 21,
    "japanese": "足",
    "reading": "あし",
    "indonesian": "kaki",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 21,
    "japanese": "世界",
    "reading": "せかい",
    "indonesian": "dunia",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 22,
    "japanese": "親",
    "reading": "おや",
    "indonesian": "orang tua",
    "category": "名詞",
    "note": "",
    "position": 1
  },
  {
    "chapter": 22,
    "japanese": "子供",
    "reading": "こども",
    "indonesian": "anak",
    "category": "名詞",
    "note": "",
    "position": 2
  },
  {
    "chapter": 22,
    "japanese": "上司",
    "reading": "じょうし",
    "indonesian": "atasan",
    "category": "名詞",
    "note": "",
    "position": 3
  },
  {
    "chapter": 22,
    "japanese": "部下",
    "reading": "ぶか",
    "indonesian": "bawahan",
    "category": "名詞",
    "note": "",
    "position": 4
  },
  {
    "chapter": 22,
    "japanese": "部長",
    "reading": "ぶちょう",
    "indonesian": "kepala bagian atau departemen",
    "category": "名詞",
    "note": "",
    "position": 5
  },
  {
    "chapter": 22,
    "japanese": "残業",
    "reading": "ざんぎょう",
    "indonesian": "lembur",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 22,
    "japanese": "作文",
    "reading": "さくぶん",
    "indonesian": "karangan; kegiatan mengarang",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 22,
    "japanese": "練習",
    "reading": "れんしゅう",
    "indonesian": "latihan",
    "category": "名詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 22,
    "japanese": "許可",
    "reading": "きょか",
    "indonesian": "izin",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 22,
    "japanese": "自由",
    "reading": "じゆう",
    "indonesian": "kebebasan; bebas",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 22,
    "japanese": "待つ",
    "reading": "まつ",
    "indonesian": "menunggu",
    "category": "動詞",
    "note": "Kelompok 1. Pengulangan untuk kausatif: 待たせる.",
    "position": 11
  },
  {
    "chapter": 22,
    "japanese": "座る",
    "reading": "すわる",
    "indonesian": "duduk",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 12
  },
  {
    "chapter": 22,
    "japanese": "立つ",
    "reading": "たつ",
    "indonesian": "berdiri",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 13
  },
  {
    "chapter": 22,
    "japanese": "走る",
    "reading": "はしる",
    "indonesian": "berlari",
    "category": "動詞",
    "note": "Kelompok 1. Berakhiran る tetapi grup 1.",
    "position": 14
  },
  {
    "chapter": 22,
    "japanese": "運ぶ",
    "reading": "はこぶ",
    "indonesian": "mengangkut; membawa",
    "category": "動詞",
    "note": "Kelompok 1. Pengulangan terarah untuk peran pelaku.",
    "position": 15
  },
  {
    "chapter": 22,
    "japanese": "歌う",
    "reading": "うたう",
    "indonesian": "bernyanyi",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 16
  },
  {
    "chapter": 22,
    "japanese": "許す",
    "reading": "ゆるす",
    "indonesian": "mengizinkan; memaafkan",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 17
  },
  {
    "chapter": 22,
    "japanese": "無理に",
    "reading": "むりに",
    "indonesian": "dengan paksa; memaksakan",
    "category": "副詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 23,
    "japanese": "いらっしゃる",
    "reading": "いらっしゃる",
    "indonesian": "pergi; datang; berada, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk 行く・来る・いる. Bentuk sopan: いらっしゃいます.",
    "position": 1
  },
  {
    "chapter": 23,
    "japanese": "召し上がる",
    "reading": "めしあがる",
    "indonesian": "makan; minum, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk 食べる・飲む; bukan untuk meninggikan tindakan diri sendiri.",
    "position": 2
  },
  {
    "chapter": 23,
    "japanese": "ご覧になる",
    "reading": "ごらんになる",
    "indonesian": "melihat, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk 見る.",
    "position": 3
  },
  {
    "chapter": 23,
    "japanese": "なさる",
    "reading": "なさる",
    "indonesian": "melakukan, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk する. Bentuk sopan: なさいます.",
    "position": 4
  },
  {
    "chapter": 23,
    "japanese": "おっしゃる",
    "reading": "おっしゃる",
    "indonesian": "mengatakan, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk 言う. Bentuk sopan: おっしゃいます.",
    "position": 5
  },
  {
    "chapter": 23,
    "japanese": "ご存じ",
    "reading": "ごぞんじ",
    "indonesian": "tahu; mengenal, dalam bahasa hormat",
    "category": "名詞",
    "note": "ご存じです adalah ungkapan hormat untuk 知っている.",
    "position": 6
  },
  {
    "chapter": 23,
    "japanese": "お客様",
    "reading": "おきゃくさま",
    "indonesian": "pelanggan; tamu, dengan sapaan hormat",
    "category": "名詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 23,
    "japanese": "先生",
    "reading": "せんせい",
    "indonesian": "guru; pengajar; sapaan profesi tertentu",
    "category": "名詞",
    "note": "Pengulangan untuk menentukan siapa yang dihormati.",
    "position": 8
  },
  {
    "chapter": 23,
    "japanese": "社長",
    "reading": "しゃちょう",
    "indonesian": "direktur atau pimpinan perusahaan",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 23,
    "japanese": "受付",
    "reading": "うけつけ",
    "indonesian": "bagian penerimaan; resepsionis",
    "category": "名詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 23,
    "japanese": "会議",
    "reading": "かいぎ",
    "indonesian": "rapat",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 23,
    "japanese": "出張",
    "reading": "しゅっちょう",
    "indonesian": "perjalanan dinas",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 23,
    "japanese": "お名前",
    "reading": "おなまえ",
    "indonesian": "nama, dengan bentuk hormat",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 23,
    "japanese": "お仕事",
    "reading": "おしごと",
    "indonesian": "pekerjaan, dengan bentuk hormat",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 23,
    "japanese": "ご家族",
    "reading": "ごかぞく",
    "indonesian": "keluarga pihak yang dihormati",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 23,
    "japanese": "ご都合",
    "reading": "ごつごう",
    "indonesian": "ketersediaan atau kecocokan jadwal pihak lain",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 23,
    "japanese": "失礼",
    "reading": "しつれい",
    "indonesian": "tidak sopan; permisi dalam ungkapan tertentu",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 24,
    "japanese": "参る",
    "reading": "まいる",
    "indonesian": "pergi; datang, dalam bahasa sangat sopan",
    "category": "動詞",
    "note": "Kelompok 1. Bentuk kenjougo II untuk tindakan pihak sendiri; berbeda dari 伺う yang diarahkan ke pihak yang dihormati.",
    "position": 1
  },
  {
    "chapter": 24,
    "japanese": "申す",
    "reading": "もうす",
    "indonesian": "mengatakan; bernama, dalam bahasa sangat sopan",
    "category": "動詞",
    "note": "Kelompok 1. Contoh perkenalan: リナと申します.",
    "position": 2
  },
  {
    "chapter": 24,
    "japanese": "いたす",
    "reading": "いたす",
    "indonesian": "melakukan, dalam bahasa merendah atau sangat sopan",
    "category": "動詞",
    "note": "Kelompok 1. Bentuk sopan: いたします.",
    "position": 3
  },
  {
    "chapter": 24,
    "japanese": "おる",
    "reading": "おる",
    "indonesian": "berada, dalam bahasa sangat sopan",
    "category": "動詞",
    "note": "Kelompok 1. Untuk pihak sendiri dalam penggunaan formal bab ini; bentuk sopan: おります.",
    "position": 4
  },
  {
    "chapter": 24,
    "japanese": "伺う",
    "reading": "うかがう",
    "indonesian": "bertanya; mendengar; berkunjung, secara merendah",
    "category": "動詞",
    "note": "Kelompok 1. Pilih makna sesuai konteks dan pihak yang dihormati.",
    "position": 5
  },
  {
    "chapter": 24,
    "japanese": "拝見する",
    "reading": "はいけんする",
    "indonesian": "melihat, dalam bahasa merendah",
    "category": "動詞",
    "note": "Kelompok 3. Untuk tindakan pihak sendiri terhadap sesuatu yang terkait pihak yang dihormati.",
    "position": 6
  },
  {
    "chapter": 24,
    "japanese": "お目にかかる",
    "reading": "おめにかかる",
    "indonesian": "bertemu, dalam bahasa merendah",
    "category": "動詞",
    "note": "Kelompok 1.",
    "position": 7
  },
  {
    "chapter": 24,
    "japanese": "存じる",
    "reading": "ぞんじる",
    "indonesian": "mengetahui; berpikir, dalam bahasa merendah",
    "category": "動詞",
    "note": "Kelompok 2. 存じております: mengetahui. Tentang orang dapat memakai 存じ上げる.",
    "position": 8
  },
  {
    "chapter": 24,
    "japanese": "差し上げる",
    "reading": "さしあげる",
    "indonesian": "memberi, dalam bahasa merendah",
    "category": "動詞",
    "note": "Kelompok 2. Pihak sendiri memberi kepada pihak yang dihormati.",
    "position": 9
  },
  {
    "chapter": 24,
    "japanese": "いただく",
    "reading": "いただく",
    "indonesian": "menerima; makan; minum, dalam bahasa merendah",
    "category": "動詞",
    "note": "Kelompok 1. Pada memberi-menerima, pembicara atau pihaknya menjadi penerima.",
    "position": 10
  },
  {
    "chapter": 24,
    "japanese": "くださる",
    "reading": "くださる",
    "indonesian": "memberi kepada pihak saya, dalam bahasa hormat",
    "category": "動詞",
    "note": "Kelompok 1. Sonkeigo untuk くれる. Bentuk sopan: くださいます.",
    "position": 11
  },
  {
    "chapter": 24,
    "japanese": "ございます",
    "reading": "ございます",
    "indonesian": "ada; tersedia, dalam bahasa sopan",
    "category": "表現",
    "note": "Bentuk sopan dari ある; bukan otomatis kenjougo.",
    "position": 12
  },
  {
    "chapter": 24,
    "japanese": "こちら",
    "reading": "こちら",
    "indonesian": "sebelah sini; orang atau pihak ini, secara sopan",
    "category": "代名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 24,
    "japanese": "そちら",
    "reading": "そちら",
    "indonesian": "sebelah situ; orang atau pihak Anda, secara sopan",
    "category": "代名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 24,
    "japanese": "承知する",
    "reading": "しょうちする",
    "indonesian": "memahami; menyetujui permintaan",
    "category": "動詞",
    "note": "Kelompok 3. 承知しました: saya mengerti/baik, dalam konteks formal.",
    "position": 15
  },
  {
    "chapter": 24,
    "japanese": "案内する",
    "reading": "あんないする",
    "indonesian": "memandu; menunjukkan tempat",
    "category": "動詞",
    "note": "Kelompok 3. Bentuk merendah yang sesuai konteks: ご案内します.",
    "position": 16
  },
  {
    "chapter": 24,
    "japanese": "お手数",
    "reading": "おてすう",
    "indonesian": "kerepotan; usaha yang diminta dari pihak lain",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 24,
    "japanese": "ご連絡",
    "reading": "ごれんらく",
    "indonesian": "kabar atau komunikasi, dengan bentuk sopan",
    "category": "名詞",
    "note": "",
    "position": 18
  }
]$vocabulary$::jsonb) LOOP
    SELECT id INTO STRICT target_module FROM modules
      WHERE course_id=course AND slug LIKE 'n4-b' || lpad(item->>'chapter',2,'0') || '-%';
    SELECT id INTO STRICT target_lesson FROM lessons
      WHERE module_id=target_module AND slug='pelajaran-2-kosakata' AND type='deck';
    SELECT v.id INTO target_word FROM module_vocabulary v
      WHERE v.module_id=target_module AND v.japanese=item->>'japanese'
        AND (v.reading=item->>'reading' OR coalesce(v.reading,'') !~ '[ぁ-ゖァ-ヺ]')
      ORDER BY EXISTS(SELECT 1 FROM lesson_deck_items d WHERE d.lesson_id=target_lesson AND d.vocabulary_id=v.id) DESC,
        (v.reading=item->>'reading') DESC NULLS LAST, v.created_at, v.id LIMIT 1;
    IF target_word IS NULL THEN
      INSERT INTO module_vocabulary(module_id,japanese,reading,indonesian,category,note,sort_order)
        VALUES(target_module,item->>'japanese',item->>'reading',item->>'indonesian',item->>'category',
          nullif(item->>'note',''),(item->>'position')::int) RETURNING id INTO target_word;
    ELSE
      UPDATE module_vocabulary SET
        reading=CASE WHEN coalesce(reading,'') !~ '[ぁ-ゖァ-ヺ]' THEN item->>'reading' ELSE reading END,
        indonesian=coalesce(nullif(btrim(indonesian),''),item->>'indonesian'),
        category=coalesce(nullif(btrim(category),''),item->>'category'),
        note=coalesce(nullif(btrim(note),''),nullif(item->>'note',''))
        WHERE id=target_word AND (
          coalesce(reading,'') !~ '[ぁ-ゖァ-ヺ]'
          OR nullif(btrim(indonesian),'') IS NULL
          OR nullif(btrim(category),'') IS NULL
          OR (nullif(btrim(note),'') IS NULL AND nullif(item->>'note','') IS NOT NULL));
    END IF;
    INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order)
      VALUES(target_lesson,target_word,(item->>'position')::int)
      ON CONFLICT(lesson_id,vocabulary_id) DO NOTHING;
  END LOOP;
  RAISE NOTICE '159: N4 vocabulary decks populated across 24 chapters';
END $migration$;
