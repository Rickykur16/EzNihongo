-- Expand N4 vocabulary while keeping N5 vocabulary out of every N4 deck.
-- N5 is defined by the cards currently linked to the Kelas N5 decks, not by an external label.
-- Removed links are archived; vocabulary bank rows and editor-authored fields are preserved.
CREATE TABLE IF NOT EXISTS curriculum_cleanup_archive (
  cleanup_key TEXT NOT NULL, table_name TEXT NOT NULL, row_hash TEXT NOT NULL,
  row_data JSONB NOT NULL, archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleanup_key, table_name, row_hash)
);

DO $migration$
DECLARE
  item JSONB;
  n4_course UUID;
  target_module UUID;
  target_lesson UUID;
  target_word UUID;
BEGIN
  SELECT id INTO STRICT n4_course FROM courses WHERE slug='n4';

  INSERT INTO curriculum_cleanup_archive(cleanup_key,table_name,row_hash,row_data)
    SELECT '160-n4-remove-n5-overlap','lesson_deck_items',md5(to_jsonb(d)::text),to_jsonb(d)
    FROM lesson_deck_items d
    JOIN lessons l ON l.id=d.lesson_id JOIN modules m ON m.id=l.module_id
    JOIN module_vocabulary v ON v.id=d.vocabulary_id
    WHERE m.course_id=n4_course AND l.slug='pelajaran-2-kosakata'
      AND EXISTS (
        SELECT 1 FROM lesson_deck_items n5d
        JOIN lessons n5l ON n5l.id=n5d.lesson_id JOIN modules n5m ON n5m.id=n5l.module_id
        JOIN courses n5c ON n5c.id=n5m.course_id JOIN module_vocabulary n5v ON n5v.id=n5d.vocabulary_id
        WHERE n5c.slug='n5' AND btrim(n5v.japanese)=btrim(v.japanese))
    ON CONFLICT DO NOTHING;

  DELETE FROM lesson_deck_items d USING lessons l, modules m, module_vocabulary v
    WHERE d.lesson_id=l.id AND l.module_id=m.id AND d.vocabulary_id=v.id
      AND m.course_id=n4_course AND l.slug='pelajaran-2-kosakata'
      AND EXISTS (
        SELECT 1 FROM lesson_deck_items n5d
        JOIN lessons n5l ON n5l.id=n5d.lesson_id JOIN modules n5m ON n5m.id=n5l.module_id
        JOIN courses n5c ON n5c.id=n5m.course_id JOIN module_vocabulary n5v ON n5v.id=n5d.vocabulary_id
        WHERE n5c.slug='n5' AND btrim(n5v.japanese)=btrim(v.japanese));

  FOR item IN SELECT value FROM jsonb_array_elements($vocabulary$[
  {
    "chapter": 1,
    "japanese": "美術館",
    "reading": "びじゅつかん",
    "indonesian": "museum seni",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 1,
    "japanese": "小説",
    "reading": "しょうせつ",
    "indonesian": "novel",
    "category": "名詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 1,
    "japanese": "文学",
    "reading": "ぶんがく",
    "indonesian": "sastra",
    "category": "名詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 1,
    "japanese": "文化",
    "reading": "ぶんか",
    "indonesian": "budaya",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 1,
    "japanese": "技術",
    "reading": "ぎじゅつ",
    "indonesian": "teknik; teknologi; keterampilan",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 1,
    "japanese": "展覧会",
    "reading": "てんらんかい",
    "indonesian": "pameran",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 1,
    "japanese": "見物",
    "reading": "けんぶつ",
    "indonesian": "melihat-lihat; wisata tontonan",
    "category": "名詞・動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 1,
    "japanese": "興味",
    "reading": "きょうみ",
    "indonesian": "minat; ketertarikan",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 1,
    "japanese": "楽しみ",
    "reading": "たのしみ",
    "indonesian": "hal yang dinantikan; kesenangan",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 2,
    "japanese": "会話",
    "reading": "かいわ",
    "indonesian": "percakapan",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 2,
    "japanese": "嘘",
    "reading": "うそ",
    "indonesian": "kebohongan",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 2,
    "japanese": "訳",
    "reading": "わけ",
    "indonesian": "alasan; arti; keadaan di balik sesuatu",
    "category": "名詞",
    "note": "Makna dipilih menurut konteks.",
    "position": 17
  },
  {
    "chapter": 2,
    "japanese": "返事",
    "reading": "へんじ",
    "indonesian": "jawaban; balasan",
    "category": "名詞・動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 2,
    "japanese": "はっきり",
    "reading": "はっきり",
    "indonesian": "dengan jelas",
    "category": "副詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 2,
    "japanese": "なるほど",
    "reading": "なるほど",
    "indonesian": "oh, begitu; masuk akal",
    "category": "副詞・感動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 2,
    "japanese": "もちろん",
    "reading": "もちろん",
    "indonesian": "tentu saja",
    "category": "副詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 2,
    "japanese": "やはり",
    "reading": "やはり",
    "indonesian": "seperti dugaan; tetap saja",
    "category": "副詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 2,
    "japanese": "レポート",
    "reading": "レポート",
    "indonesian": "laporan",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 2,
    "japanese": "翻訳",
    "reading": "ほんやく",
    "indonesian": "penerjemahan tertulis",
    "category": "名詞・動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 2,
    "japanese": "発音",
    "reading": "はつおん",
    "indonesian": "pelafalan",
    "category": "名詞・動詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 2,
    "japanese": "文法",
    "reading": "ぶんぽう",
    "indonesian": "tata bahasa",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 3,
    "japanese": "この間",
    "reading": "このあいだ",
    "indonesian": "beberapa waktu lalu",
    "category": "名詞・副詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 3,
    "japanese": "この頃",
    "reading": "このごろ",
    "indonesian": "akhir-akhir ini",
    "category": "名詞・副詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 3,
    "japanese": "しばらく",
    "reading": "しばらく",
    "indonesian": "sebentar; selama beberapa waktu",
    "category": "副詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 3,
    "japanese": "そろそろ",
    "reading": "そろそろ",
    "indonesian": "sebentar lagi; sudah waktunya",
    "category": "副詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 3,
    "japanese": "もうすぐ",
    "reading": "もうすぐ",
    "indonesian": "sebentar lagi",
    "category": "副詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 3,
    "japanese": "とうとう",
    "reading": "とうとう",
    "indonesian": "akhirnya, setelah proses panjang",
    "category": "副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 3,
    "japanese": "最後",
    "reading": "さいご",
    "indonesian": "akhir; terakhir",
    "category": "名詞・副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 3,
    "japanese": "昼間",
    "reading": "ひるま",
    "indonesian": "siang hari",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 3,
    "japanese": "昼休み",
    "reading": "ひるやすみ",
    "indonesian": "istirahat siang",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 3,
    "japanese": "今度",
    "reading": "こんど",
    "indonesian": "kali ini; lain kali",
    "category": "名詞・副詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 3,
    "japanese": "久しぶり",
    "reading": "ひさしぶり",
    "indonesian": "setelah lama tidak bertemu atau melakukan",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 4,
    "japanese": "柔道",
    "reading": "じゅうどう",
    "indonesian": "judo",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 4,
    "japanese": "競争",
    "reading": "きょうそう",
    "indonesian": "persaingan; perlombaan",
    "category": "名詞・動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 4,
    "japanese": "負ける",
    "reading": "まける",
    "indonesian": "kalah",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 4,
    "japanese": "上手い",
    "reading": "うまい",
    "indonesian": "pandai; enak",
    "category": "い形容詞",
    "note": "Makna bergantung konteks kemampuan atau rasa.",
    "position": 19
  },
  {
    "chapter": 4,
    "japanese": "美しい",
    "reading": "うつくしい",
    "indonesian": "indah",
    "category": "い形容詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 4,
    "japanese": "珍しい",
    "reading": "めずらしい",
    "indonesian": "langka; tidak biasa",
    "category": "い形容詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 4,
    "japanese": "素晴らしい",
    "reading": "すばらしい",
    "indonesian": "luar biasa",
    "category": "い形容詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 4,
    "japanese": "光",
    "reading": "ひかり",
    "indonesian": "cahaya",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 4,
    "japanese": "光る",
    "reading": "ひかる",
    "indonesian": "bersinar",
    "category": "動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 4,
    "japanese": "形",
    "reading": "かたち",
    "indonesian": "bentuk",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 4,
    "japanese": "鳴る",
    "reading": "なる",
    "indonesian": "berbunyi",
    "category": "動詞",
    "note": "Dipakai saat benda atau alat menghasilkan bunyi.",
    "position": 26
  },
  {
    "chapter": 5,
    "japanese": "つもり",
    "reading": "つもり",
    "indonesian": "niat; rencana",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 5,
    "japanese": "一生懸命",
    "reading": "いっしょうけんめい",
    "indonesian": "dengan sekuat tenaga",
    "category": "な形容詞・副詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 5,
    "japanese": "できるだけ",
    "reading": "できるだけ",
    "indonesian": "sebisa mungkin",
    "category": "副詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 5,
    "japanese": "ぜひ",
    "reading": "ぜひ",
    "indonesian": "pasti; sangat diharapkan",
    "category": "副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 5,
    "japanese": "支度",
    "reading": "したく",
    "indonesian": "persiapan",
    "category": "名詞・動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 5,
    "japanese": "用意",
    "reading": "ようい",
    "indonesian": "persiapan; kesiapan",
    "category": "名詞・動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 5,
    "japanese": "研究",
    "reading": "けんきゅう",
    "indonesian": "penelitian",
    "category": "名詞・動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 5,
    "japanese": "教育",
    "reading": "きょういく",
    "indonesian": "pendidikan",
    "category": "名詞・動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 5,
    "japanese": "卒業",
    "reading": "そつぎょう",
    "indonesian": "kelulusan",
    "category": "名詞・動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 5,
    "japanese": "入学",
    "reading": "にゅうがく",
    "indonesian": "masuk sekolah atau universitas",
    "category": "名詞・動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 5,
    "japanese": "アルバイト",
    "reading": "アルバイト",
    "indonesian": "pekerjaan paruh waktu",
    "category": "名詞・動詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 5,
    "japanese": "パート",
    "reading": "パート",
    "indonesian": "pekerjaan paruh waktu",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 6,
    "japanese": "故障",
    "reading": "こしょう",
    "indonesian": "kerusakan mesin",
    "category": "名詞・動詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 6,
    "japanese": "治る",
    "reading": "なおる",
    "indonesian": "sembuh",
    "category": "動詞",
    "note": "Untuk penyakit atau luka.",
    "position": 14
  },
  {
    "chapter": 6,
    "japanese": "直る",
    "reading": "なおる",
    "indonesian": "menjadi baik; selesai diperbaiki",
    "category": "動詞",
    "note": "Untuk benda atau kesalahan.",
    "position": 15
  },
  {
    "chapter": 6,
    "japanese": "済む",
    "reading": "すむ",
    "indonesian": "selesai; terselesaikan",
    "category": "動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 6,
    "japanese": "びっくりする",
    "reading": "びっくりする",
    "indonesian": "terkejut",
    "category": "動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 6,
    "japanese": "驚く",
    "reading": "おどろく",
    "indonesian": "terkejut; merasa heran",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 6,
    "japanese": "大事",
    "reading": "だいじ",
    "indonesian": "penting; berharga",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 6,
    "japanese": "酷い",
    "reading": "ひどい",
    "indonesian": "parah; kejam",
    "category": "い形容詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 6,
    "japanese": "しっかり",
    "reading": "しっかり",
    "indonesian": "dengan mantap; dengan baik",
    "category": "副詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 6,
    "japanese": "すっかり",
    "reading": "すっかり",
    "indonesian": "sepenuhnya",
    "category": "副詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 6,
    "japanese": "退院",
    "reading": "たいいん",
    "indonesian": "keluar dari rumah sakit",
    "category": "名詞・動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 6,
    "japanese": "入院",
    "reading": "にゅういん",
    "indonesian": "masuk rumah sakit",
    "category": "名詞・動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 6,
    "japanese": "怪我",
    "reading": "けが",
    "indonesian": "cedera",
    "category": "名詞・動詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 6,
    "japanese": "間違い",
    "reading": "まちがい",
    "indonesian": "kesalahan",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 7,
    "japanese": "割れる",
    "reading": "われる",
    "indonesian": "pecah; retak",
    "category": "動詞",
    "note": "自動詞. Pasangan: 割る.",
    "position": 10
  },
  {
    "chapter": 7,
    "japanese": "焼く",
    "reading": "やく",
    "indonesian": "membakar; memanggang",
    "category": "動詞",
    "note": "他動詞. Pasangan: 焼ける.",
    "position": 11
  },
  {
    "chapter": 7,
    "japanese": "焼ける",
    "reading": "やける",
    "indonesian": "terbakar; matang karena dipanggang",
    "category": "動詞",
    "note": "自動詞. Pasangan: 焼く.",
    "position": 12
  },
  {
    "chapter": 7,
    "japanese": "乾く",
    "reading": "かわく",
    "indonesian": "menjadi kering",
    "category": "動詞",
    "note": "自動詞. Pasangan: 乾かす.",
    "position": 13
  },
  {
    "chapter": 7,
    "japanese": "汚れる",
    "reading": "よごれる",
    "indonesian": "menjadi kotor",
    "category": "動詞",
    "note": "自動詞. Pasangan: 汚す.",
    "position": 14
  },
  {
    "chapter": 7,
    "japanese": "折る",
    "reading": "おる",
    "indonesian": "mematahkan; melipat",
    "category": "動詞",
    "note": "他動詞. Pasangan: 折れる.",
    "position": 15
  },
  {
    "chapter": 7,
    "japanese": "折れる",
    "reading": "おれる",
    "indonesian": "patah; terlipat",
    "category": "動詞",
    "note": "自動詞. Pasangan: 折る.",
    "position": 16
  },
  {
    "chapter": 7,
    "japanese": "沸かす",
    "reading": "わかす",
    "indonesian": "merebus; memanaskan air",
    "category": "動詞",
    "note": "他動詞. Pasangan: 沸く.",
    "position": 17
  },
  {
    "chapter": 7,
    "japanese": "沸く",
    "reading": "わく",
    "indonesian": "mendidih",
    "category": "動詞",
    "note": "自動詞. Pasangan: 沸かす.",
    "position": 18
  },
  {
    "chapter": 7,
    "japanese": "冷える",
    "reading": "ひえる",
    "indonesian": "menjadi dingin",
    "category": "動詞",
    "note": "自動詞. Pasangan: 冷やす.",
    "position": 19
  },
  {
    "chapter": 8,
    "japanese": "移る",
    "reading": "うつる",
    "indonesian": "berpindah; menular",
    "category": "動詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 8,
    "japanese": "過ぎる",
    "reading": "すぎる",
    "indonesian": "melewati; berlalu; terlalu",
    "category": "動詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 8,
    "japanese": "回る",
    "reading": "まわる",
    "indonesian": "berputar; berkeliling",
    "category": "動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 8,
    "japanese": "向かう",
    "reading": "むかう",
    "indonesian": "menuju; menghadap",
    "category": "動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 8,
    "japanese": "下がる",
    "reading": "さがる",
    "indonesian": "turun; mundur",
    "category": "動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 8,
    "japanese": "上がる",
    "reading": "あがる",
    "indonesian": "naik",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 8,
    "japanese": "続く",
    "reading": "つづく",
    "indonesian": "berlanjut",
    "category": "動詞",
    "note": "自動詞. Pasangan: 続ける.",
    "position": 19
  },
  {
    "chapter": 8,
    "japanese": "育てる",
    "reading": "そだてる",
    "indonesian": "membesarkan; memelihara",
    "category": "動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 8,
    "japanese": "生きる",
    "reading": "いきる",
    "indonesian": "hidup",
    "category": "動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 8,
    "japanese": "変える",
    "reading": "かえる",
    "indonesian": "mengubah",
    "category": "動詞",
    "note": "他動詞. Pasangan: 変わる.",
    "position": 22
  },
  {
    "chapter": 8,
    "japanese": "暮れる",
    "reading": "くれる",
    "indonesian": "menjadi gelap; berakhir",
    "category": "動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 8,
    "japanese": "通る",
    "reading": "とおる",
    "indonesian": "melewati; melalui",
    "category": "動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 8,
    "japanese": "倒れる",
    "reading": "たおれる",
    "indonesian": "jatuh; roboh",
    "category": "動詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 9,
    "japanese": "仕方",
    "reading": "しかた",
    "indonesian": "cara; metode",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 9,
    "japanese": "適当",
    "reading": "てきとう",
    "indonesian": "sesuai; secukupnya; sembarangan",
    "category": "名詞・な形容詞",
    "note": "Makna berubah menurut konteks.",
    "position": 17
  },
  {
    "chapter": 9,
    "japanese": "正しい",
    "reading": "ただしい",
    "indonesian": "benar; tepat",
    "category": "い形容詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 9,
    "japanese": "厳しい",
    "reading": "きびしい",
    "indonesian": "ketat; keras",
    "category": "い形容詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 9,
    "japanese": "深い",
    "reading": "ふかい",
    "indonesian": "dalam",
    "category": "い形容詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 9,
    "japanese": "浅い",
    "reading": "あさい",
    "indonesian": "dangkal",
    "category": "い形容詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 9,
    "japanese": "固い",
    "reading": "かたい",
    "indonesian": "keras; kaku",
    "category": "い形容詞",
    "note": "Kanji dapat berbeda menurut nuansa.",
    "position": 22
  },
  {
    "chapter": 9,
    "japanese": "美しい",
    "reading": "うつくしい",
    "indonesian": "indah",
    "category": "い形容詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 9,
    "japanese": "珍しい",
    "reading": "めずらしい",
    "indonesian": "langka; tidak biasa",
    "category": "い形容詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 9,
    "japanese": "普通",
    "reading": "ふつう",
    "indonesian": "biasa; umum",
    "category": "名詞・な形容詞・副詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 9,
    "japanese": "特別",
    "reading": "とくべつ",
    "indonesian": "khusus; istimewa",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 9,
    "japanese": "割合",
    "reading": "わりあい",
    "indonesian": "perbandingan; persentase; relatif",
    "category": "名詞・副詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 9,
    "japanese": "合う",
    "reading": "あう",
    "indonesian": "cocok; sesuai",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 10,
    "japanese": "おかげ",
    "reading": "おかげ",
    "indonesian": "berkat; akibat baik dari sesuatu",
    "category": "名詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 10,
    "japanese": "それに",
    "reading": "それに",
    "indonesian": "selain itu",
    "category": "接続詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 10,
    "japanese": "それほど",
    "reading": "それほど",
    "indonesian": "sampai tingkat itu",
    "category": "副詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 10,
    "japanese": "そんなに",
    "reading": "そんなに",
    "indonesian": "sebanyak atau separah itu",
    "category": "副詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 10,
    "japanese": "または",
    "reading": "または",
    "indonesian": "atau",
    "category": "接続詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 10,
    "japanese": "反対",
    "reading": "はんたい",
    "indonesian": "lawan; pertentangan",
    "category": "名詞・な形容詞・動詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 10,
    "japanese": "代わり",
    "reading": "かわり",
    "indonesian": "pengganti; sebagai ganti",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 10,
    "japanese": "関係",
    "reading": "かんけい",
    "indonesian": "hubungan",
    "category": "名詞・動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 10,
    "japanese": "別",
    "reading": "べつ",
    "indonesian": "lain; terpisah",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 10,
    "japanese": "特に",
    "reading": "とくに",
    "indonesian": "terutama",
    "category": "副詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 10,
    "japanese": "ちっとも",
    "reading": "ちっとも",
    "indonesian": "sama sekali tidak",
    "category": "副詞",
    "note": "Umumnya dipakai dengan bentuk negatif.",
    "position": 19
  },
  {
    "chapter": 10,
    "japanese": "やっぱり",
    "reading": "やっぱり",
    "indonesian": "seperti dugaan; tetap saja",
    "category": "副詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 11,
    "japanese": "台風",
    "reading": "たいふう",
    "indonesian": "topan",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 11,
    "japanese": "地震",
    "reading": "じしん",
    "indonesian": "gempa bumi",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 11,
    "japanese": "降り出す",
    "reading": "ふりだす",
    "indonesian": "mulai turun, tentang hujan atau salju",
    "category": "動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 11,
    "japanese": "止む",
    "reading": "やむ",
    "indonesian": "berhenti, tentang hujan atau angin",
    "category": "動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 11,
    "japanese": "空気",
    "reading": "くうき",
    "indonesian": "udara; suasana",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 11,
    "japanese": "番組",
    "reading": "ばんぐみ",
    "indonesian": "program televisi atau radio",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 11,
    "japanese": "放送",
    "reading": "ほうそう",
    "indonesian": "siaran",
    "category": "名詞・動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 11,
    "japanese": "新聞社",
    "reading": "しんぶんしゃ",
    "indonesian": "perusahaan surat kabar",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 11,
    "japanese": "テレビ局",
    "reading": "テレビきょく",
    "indonesian": "stasiun televisi",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 11,
    "japanese": "ニュース番組",
    "reading": "ニュースばんぐみ",
    "indonesian": "program berita",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 11,
    "japanese": "確かに",
    "reading": "たしかに",
    "indonesian": "memang; dengan pasti",
    "category": "副詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 11,
    "japanese": "かなり",
    "reading": "かなり",
    "indonesian": "cukup; lumayan; sangat",
    "category": "副詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 11,
    "japanese": "非常に",
    "reading": "ひじょうに",
    "indonesian": "sangat",
    "category": "副詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 11,
    "japanese": "様子を見る",
    "reading": "ようすをみる",
    "indonesian": "mengamati keadaan",
    "category": "表現",
    "note": "",
    "position": 30
  },
  {
    "chapter": 12,
    "japanese": "心",
    "reading": "こころ",
    "indonesian": "hati; batin",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 12,
    "japanese": "驚く",
    "reading": "おどろく",
    "indonesian": "terkejut; merasa heran",
    "category": "動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 12,
    "japanese": "怒る",
    "reading": "おこる",
    "indonesian": "marah",
    "category": "動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 12,
    "japanese": "優しい",
    "reading": "やさしい",
    "indonesian": "baik hati; lembut",
    "category": "い形容詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 12,
    "japanese": "酷い",
    "reading": "ひどい",
    "indonesian": "parah; kejam",
    "category": "い形容詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 12,
    "japanese": "素晴らしい",
    "reading": "すばらしい",
    "indonesian": "luar biasa",
    "category": "い形容詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 12,
    "japanese": "大事",
    "reading": "だいじ",
    "indonesian": "penting; berharga",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 12,
    "japanese": "熱心",
    "reading": "ねっしん",
    "indonesian": "tekun; antusias",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 12,
    "japanese": "可笑しい",
    "reading": "おかしい",
    "indonesian": "aneh; lucu",
    "category": "い形容詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 12,
    "japanese": "凄い",
    "reading": "すごい",
    "indonesian": "hebat; luar biasa",
    "category": "い形容詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 12,
    "japanese": "楽しみ",
    "reading": "たのしみ",
    "indonesian": "hal yang dinantikan; kesenangan",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 12,
    "japanese": "恥ずかしがる",
    "reading": "はずかしがる",
    "indonesian": "menunjukkan rasa malu",
    "category": "動詞",
    "note": "Biasanya untuk perasaan orang lain.",
    "position": 25
  },
  {
    "chapter": 13,
    "japanese": "坂",
    "reading": "さか",
    "indonesian": "tanjakan; lereng",
    "category": "名詞",
    "note": "",
    "position": 6
  },
  {
    "chapter": 13,
    "japanese": "向かう",
    "reading": "むかう",
    "indonesian": "menuju; menghadap",
    "category": "動詞",
    "note": "",
    "position": 7
  },
  {
    "chapter": 13,
    "japanese": "通る",
    "reading": "とおる",
    "indonesian": "melewati; melalui",
    "category": "動詞",
    "note": "",
    "position": 8
  },
  {
    "chapter": 13,
    "japanese": "寄る",
    "reading": "よる",
    "indonesian": "mampir; mendekat",
    "category": "動詞",
    "note": "",
    "position": 9
  },
  {
    "chapter": 13,
    "japanese": "回る",
    "reading": "まわる",
    "indonesian": "berputar; berkeliling",
    "category": "動詞",
    "note": "",
    "position": 10
  },
  {
    "chapter": 13,
    "japanese": "下りる",
    "reading": "おりる",
    "indonesian": "turun; keluar dari kendaraan",
    "category": "動詞",
    "note": "",
    "position": 11
  },
  {
    "chapter": 13,
    "japanese": "乗り換える",
    "reading": "のりかえる",
    "indonesian": "berganti kendaraan",
    "category": "動詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 13,
    "japanese": "交通",
    "reading": "こうつう",
    "indonesian": "lalu lintas; transportasi",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 13,
    "japanese": "急行",
    "reading": "きゅうこう",
    "indonesian": "kereta ekspres",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 13,
    "japanese": "特急",
    "reading": "とっきゅう",
    "indonesian": "kereta ekspres terbatas",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 13,
    "japanese": "港",
    "reading": "みなと",
    "indonesian": "pelabuhan",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 13,
    "japanese": "海岸",
    "reading": "かいがん",
    "indonesian": "pantai; pesisir",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 13,
    "japanese": "郊外",
    "reading": "こうがい",
    "indonesian": "pinggiran kota",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 14,
    "japanese": "適当",
    "reading": "てきとう",
    "indonesian": "sesuai; secukupnya; sembarangan",
    "category": "名詞・な形容詞",
    "note": "Makna berubah menurut konteks.",
    "position": 13
  },
  {
    "chapter": 14,
    "japanese": "駄目",
    "reading": "だめ",
    "indonesian": "tidak boleh; tidak berguna",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 14,
    "japanese": "よろしい",
    "reading": "よろしい",
    "indonesian": "baik; boleh, bentuk sopan",
    "category": "い形容詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 14,
    "japanese": "ぜひ",
    "reading": "ぜひ",
    "indonesian": "pasti; sangat diharapkan",
    "category": "副詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 14,
    "japanese": "できるだけ",
    "reading": "できるだけ",
    "indonesian": "sebisa mungkin",
    "category": "副詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 14,
    "japanese": "大事",
    "reading": "だいじ",
    "indonesian": "penting; berharga",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 14,
    "japanese": "用",
    "reading": "よう",
    "indonesian": "urusan; kegunaan",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 14,
    "japanese": "利用",
    "reading": "りよう",
    "indonesian": "pemanfaatan; penggunaan",
    "category": "名詞・動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 14,
    "japanese": "仕方",
    "reading": "しかた",
    "indonesian": "cara; metode",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 14,
    "japanese": "特別",
    "reading": "とくべつ",
    "indonesian": "khusus; istimewa",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 14,
    "japanese": "決して",
    "reading": "けっして",
    "indonesian": "sama sekali tidak; tidak pernah",
    "category": "副詞",
    "note": "Umumnya dipakai dengan bentuk negatif.",
    "position": 23
  },
  {
    "chapter": 14,
    "japanese": "なるほど",
    "reading": "なるほど",
    "indonesian": "oh, begitu; masuk akal",
    "category": "副詞・感動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 14,
    "japanese": "それなら",
    "reading": "それなら",
    "indonesian": "kalau begitu",
    "category": "接続詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 14,
    "japanese": "いつでも",
    "reading": "いつでも",
    "indonesian": "kapan saja",
    "category": "副詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 14,
    "japanese": "詳しい",
    "reading": "くわしい",
    "indonesian": "terperinci; memahami dengan baik",
    "category": "い形容詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 14,
    "japanese": "やり方",
    "reading": "やりかた",
    "indonesian": "cara melakukan sesuatu",
    "category": "名詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 15,
    "japanese": "用",
    "reading": "よう",
    "indonesian": "urusan; kegunaan",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 15,
    "japanese": "利用",
    "reading": "りよう",
    "indonesian": "pemanfaatan; penggunaan",
    "category": "名詞・動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 15,
    "japanese": "用意",
    "reading": "ようい",
    "indonesian": "persiapan; kesiapan",
    "category": "名詞・動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 15,
    "japanese": "支度",
    "reading": "したく",
    "indonesian": "persiapan",
    "category": "名詞・動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 15,
    "japanese": "研究",
    "reading": "けんきゅう",
    "indonesian": "penelitian",
    "category": "名詞・動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 15,
    "japanese": "講義",
    "reading": "こうぎ",
    "indonesian": "kuliah; ceramah",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 15,
    "japanese": "講堂",
    "reading": "こうどう",
    "indonesian": "aula",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 15,
    "japanese": "会議室",
    "reading": "かいぎしつ",
    "indonesian": "ruang rapat",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 15,
    "japanese": "事務所",
    "reading": "じむしょ",
    "indonesian": "kantor",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 15,
    "japanese": "工業",
    "reading": "こうぎょう",
    "indonesian": "industri manufaktur",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 15,
    "japanese": "技術",
    "reading": "ぎじゅつ",
    "indonesian": "teknik; teknologi; keterampilan",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 15,
    "japanese": "テキスト",
    "reading": "テキスト",
    "indonesian": "buku teks; teks",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 15,
    "japanese": "スクリーン",
    "reading": "スクリーン",
    "indonesian": "layar",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 16,
    "japanese": "具合",
    "reading": "ぐあい",
    "indonesian": "kondisi; keadaan kesehatan",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 16,
    "japanese": "怪我",
    "reading": "けが",
    "indonesian": "cedera",
    "category": "名詞・動詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 16,
    "japanese": "入院",
    "reading": "にゅういん",
    "indonesian": "masuk rumah sakit",
    "category": "名詞・動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 16,
    "japanese": "退院",
    "reading": "たいいん",
    "indonesian": "keluar dari rumah sakit",
    "category": "名詞・動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 16,
    "japanese": "注射",
    "reading": "ちゅうしゃ",
    "indonesian": "suntikan",
    "category": "名詞・動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 16,
    "japanese": "歯医者",
    "reading": "はいしゃ",
    "indonesian": "dokter gigi",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 16,
    "japanese": "治る",
    "reading": "なおる",
    "indonesian": "sembuh",
    "category": "動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 16,
    "japanese": "直る",
    "reading": "なおる",
    "indonesian": "menjadi baik; selesai diperbaiki",
    "category": "動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 16,
    "japanese": "警察",
    "reading": "けいさつ",
    "indonesian": "polisi; kepolisian",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 16,
    "japanese": "法律",
    "reading": "ほうりつ",
    "indonesian": "hukum",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 16,
    "japanese": "火事",
    "reading": "かじ",
    "indonesian": "kebakaran",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 16,
    "japanese": "地震",
    "reading": "じしん",
    "indonesian": "gempa bumi",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 16,
    "japanese": "非常口",
    "reading": "ひじょうぐち",
    "indonesian": "pintu darurat",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 17,
    "japanese": "贈り物",
    "reading": "おくりもの",
    "indonesian": "hadiah",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 17,
    "japanese": "アクセサリー",
    "reading": "アクセサリー",
    "indonesian": "aksesori",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 17,
    "japanese": "おもちゃ",
    "reading": "おもちゃ",
    "indonesian": "mainan",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 17,
    "japanese": "指輪",
    "reading": "ゆびわ",
    "indonesian": "cincin",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 17,
    "japanese": "品物",
    "reading": "しなもの",
    "indonesian": "barang; produk",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 17,
    "japanese": "ハンドバッグ",
    "reading": "ハンドバッグ",
    "indonesian": "tas tangan",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 17,
    "japanese": "お見舞い",
    "reading": "おみまい",
    "indonesian": "kunjungan atau hadiah untuk orang sakit",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 17,
    "japanese": "お嬢さん",
    "reading": "おじょうさん",
    "indonesian": "putri orang lain; nona muda",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 17,
    "japanese": "ご主人",
    "reading": "ごしゅじん",
    "indonesian": "suami orang lain",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 17,
    "japanese": "妻",
    "reading": "つま",
    "indonesian": "istri sendiri",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 17,
    "japanese": "夫",
    "reading": "おっと",
    "indonesian": "suami sendiri",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 17,
    "japanese": "息子",
    "reading": "むすこ",
    "indonesian": "putra sendiri",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 18,
    "japanese": "世話",
    "reading": "せわ",
    "indonesian": "bantuan; perawatan",
    "category": "名詞・動詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 18,
    "japanese": "招待",
    "reading": "しょうたい",
    "indonesian": "undangan",
    "category": "名詞・動詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 18,
    "japanese": "遠慮",
    "reading": "えんりょ",
    "indonesian": "menahan diri; sungkan",
    "category": "名詞・動詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 18,
    "japanese": "邪魔",
    "reading": "じゃま",
    "indonesian": "gangguan; menghalangi",
    "category": "名詞・な形容詞・動詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 18,
    "japanese": "構う",
    "reading": "かまう",
    "indonesian": "mempedulikan; mempermasalahkan",
    "category": "動詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 18,
    "japanese": "届ける",
    "reading": "とどける",
    "indonesian": "mengantarkan; melaporkan",
    "category": "動詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 18,
    "japanese": "連れる",
    "reading": "つれる",
    "indonesian": "mengajak atau membawa seseorang",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 18,
    "japanese": "訪ねる",
    "reading": "たずねる",
    "indonesian": "mengunjungi",
    "category": "動詞",
    "note": "Bedakan dari 尋ねる: bertanya.",
    "position": 19
  },
  {
    "chapter": 18,
    "japanese": "相談",
    "reading": "そうだん",
    "indonesian": "konsultasi; berdiskusi",
    "category": "名詞・動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 18,
    "japanese": "返事",
    "reading": "へんじ",
    "indonesian": "jawaban; balasan",
    "category": "名詞・動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 18,
    "japanese": "留守",
    "reading": "るす",
    "indonesian": "ketidakhadiran; rumah kosong",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 18,
    "japanese": "お宅",
    "reading": "おたく",
    "indonesian": "rumah Anda, bentuk sopan",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 18,
    "japanese": "ご馳走",
    "reading": "ごちそう",
    "indonesian": "hidangan istimewa; jamuan",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 18,
    "japanese": "挨拶",
    "reading": "あいさつ",
    "indonesian": "salam; sapaan",
    "category": "名詞・動詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 19,
    "japanese": "割合",
    "reading": "わりあい",
    "indonesian": "perbandingan; persentase",
    "category": "名詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 19,
    "japanese": "倍",
    "reading": "ばい",
    "indonesian": "kali lipat",
    "category": "名詞・接尾詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 19,
    "japanese": "億",
    "reading": "おく",
    "indonesian": "seratus juta",
    "category": "名詞・数詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 19,
    "japanese": "人口",
    "reading": "じんこう",
    "indonesian": "jumlah penduduk",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 19,
    "japanese": "市民",
    "reading": "しみん",
    "indonesian": "warga kota",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 19,
    "japanese": "両方",
    "reading": "りょうほう",
    "indonesian": "kedua pihak; keduanya",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 19,
    "japanese": "皆",
    "reading": "みな",
    "indonesian": "semua orang",
    "category": "代名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 19,
    "japanese": "点",
    "reading": "てん",
    "indonesian": "titik; nilai",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 19,
    "japanese": "足す",
    "reading": "たす",
    "indonesian": "menambahkan",
    "category": "動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 19,
    "japanese": "字",
    "reading": "じ",
    "indonesian": "huruf; karakter",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 20,
    "japanese": "割合",
    "reading": "わりあい",
    "indonesian": "perbandingan; persentase; relatif",
    "category": "名詞・副詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 20,
    "japanese": "倍",
    "reading": "ばい",
    "indonesian": "kali lipat",
    "category": "名詞・接尾詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 20,
    "japanese": "両方",
    "reading": "りょうほう",
    "indonesian": "kedua pihak; keduanya",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 20,
    "japanese": "別",
    "reading": "べつ",
    "indonesian": "lain; terpisah",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 20,
    "japanese": "反対",
    "reading": "はんたい",
    "indonesian": "lawan; pertentangan",
    "category": "名詞・な形容詞・動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 20,
    "japanese": "普通",
    "reading": "ふつう",
    "indonesian": "biasa; umum",
    "category": "名詞・な形容詞・副詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 20,
    "japanese": "特別",
    "reading": "とくべつ",
    "indonesian": "khusus; istimewa",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 20,
    "japanese": "非常に",
    "reading": "ひじょうに",
    "indonesian": "sangat",
    "category": "副詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 20,
    "japanese": "大分",
    "reading": "だいぶ",
    "indonesian": "cukup banyak; sangat",
    "category": "副詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 20,
    "japanese": "ずいぶん",
    "reading": "ずいぶん",
    "indonesian": "sangat; cukup jauh",
    "category": "副詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 20,
    "japanese": "それほど",
    "reading": "それほど",
    "indonesian": "sampai tingkat itu",
    "category": "副詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 20,
    "japanese": "最も",
    "reading": "もっとも",
    "indonesian": "paling",
    "category": "副詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 21,
    "japanese": "泥棒",
    "reading": "どろぼう",
    "indonesian": "pencuri",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 21,
    "japanese": "すり",
    "reading": "すり",
    "indonesian": "pencopet",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 21,
    "japanese": "警察",
    "reading": "けいさつ",
    "indonesian": "polisi; kepolisian",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 21,
    "japanese": "捕まえる",
    "reading": "つかまえる",
    "indonesian": "menangkap",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 21,
    "japanese": "逃げる",
    "reading": "にげる",
    "indonesian": "melarikan diri",
    "category": "動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 21,
    "japanese": "割れる",
    "reading": "われる",
    "indonesian": "pecah; retak",
    "category": "動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 21,
    "japanese": "折れる",
    "reading": "おれる",
    "indonesian": "patah; terlipat",
    "category": "動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 21,
    "japanese": "倒れる",
    "reading": "たおれる",
    "indonesian": "jatuh; roboh",
    "category": "動詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 21,
    "japanese": "亡くなる",
    "reading": "なくなる",
    "indonesian": "meninggal dunia",
    "category": "動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 21,
    "japanese": "騒ぐ",
    "reading": "さわぐ",
    "indonesian": "membuat keributan",
    "category": "動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 21,
    "japanese": "火事",
    "reading": "かじ",
    "indonesian": "kebakaran",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 21,
    "japanese": "地震",
    "reading": "じしん",
    "indonesian": "gempa bumi",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 21,
    "japanese": "戦争",
    "reading": "せんそう",
    "indonesian": "perang",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 21,
    "japanese": "ぶつかる",
    "reading": "ぶつかる",
    "indonesian": "bertabrakan; membentur",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 22,
    "japanese": "育てる",
    "reading": "そだてる",
    "indonesian": "membesarkan; memelihara",
    "category": "動詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 22,
    "japanese": "校長",
    "reading": "こうちょう",
    "indonesian": "kepala sekolah",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 22,
    "japanese": "課長",
    "reading": "かちょう",
    "indonesian": "kepala bagian",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 22,
    "japanese": "公務員",
    "reading": "こうむいん",
    "indonesian": "pegawai negeri",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 22,
    "japanese": "運転手",
    "reading": "うんてんしゅ",
    "indonesian": "pengemudi",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 22,
    "japanese": "高校生",
    "reading": "こうこうせい",
    "indonesian": "siswa SMA",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 22,
    "japanese": "教育",
    "reading": "きょういく",
    "indonesian": "pendidikan",
    "category": "名詞・動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 23,
    "japanese": "おいでになる",
    "reading": "おいでになる",
    "indonesian": "datang; pergi; berada, bahasa hormat",
    "category": "動詞",
    "note": "",
    "position": 12
  },
  {
    "chapter": 23,
    "japanese": "ご主人",
    "reading": "ごしゅじん",
    "indonesian": "suami orang lain",
    "category": "名詞",
    "note": "",
    "position": 13
  },
  {
    "chapter": 23,
    "japanese": "お嬢さん",
    "reading": "おじょうさん",
    "indonesian": "putri orang lain; nona muda",
    "category": "名詞",
    "note": "",
    "position": 14
  },
  {
    "chapter": 23,
    "japanese": "お宅",
    "reading": "おたく",
    "indonesian": "rumah atau keluarga Anda, bentuk sopan",
    "category": "名詞",
    "note": "",
    "position": 15
  },
  {
    "chapter": 23,
    "japanese": "客",
    "reading": "きゃく",
    "indonesian": "tamu; pelanggan",
    "category": "名詞",
    "note": "",
    "position": 16
  },
  {
    "chapter": 23,
    "japanese": "校長",
    "reading": "こうちょう",
    "indonesian": "kepala sekolah",
    "category": "名詞",
    "note": "",
    "position": 17
  },
  {
    "chapter": 23,
    "japanese": "課長",
    "reading": "かちょう",
    "indonesian": "kepala bagian",
    "category": "名詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 23,
    "japanese": "女性",
    "reading": "じょせい",
    "indonesian": "perempuan; wanita",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 23,
    "japanese": "男性",
    "reading": "だんせい",
    "indonesian": "laki-laki; pria",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 23,
    "japanese": "皆様",
    "reading": "みなさま",
    "indonesian": "Anda semua; hadirin, bentuk hormat",
    "category": "代名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 23,
    "japanese": "よろしい",
    "reading": "よろしい",
    "indonesian": "baik; boleh, bentuk sopan",
    "category": "い形容詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 23,
    "japanese": "お待ちになる",
    "reading": "おまちになる",
    "indonesian": "menunggu, bahasa hormat",
    "category": "動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 24,
    "japanese": "申し上げる",
    "reading": "もうしあげる",
    "indonesian": "mengatakan; menyampaikan, bahasa merendah",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 24,
    "japanese": "遠慮",
    "reading": "えんりょ",
    "indonesian": "menahan diri; sungkan",
    "category": "名詞・動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 24,
    "japanese": "承知",
    "reading": "しょうち",
    "indonesian": "pemahaman; persetujuan formal",
    "category": "名詞・動詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 24,
    "japanese": "返事",
    "reading": "へんじ",
    "indonesian": "jawaban; balasan",
    "category": "名詞・動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 24,
    "japanese": "会議室",
    "reading": "かいぎしつ",
    "indonesian": "ruang rapat",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 24,
    "japanese": "事務所",
    "reading": "じむしょ",
    "indonesian": "kantor",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 24,
    "japanese": "国際",
    "reading": "こくさい",
    "indonesian": "internasional",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 24,
    "japanese": "貿易",
    "reading": "ぼうえき",
    "indonesian": "perdagangan internasional",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 24,
    "japanese": "輸出",
    "reading": "ゆしゅつ",
    "indonesian": "ekspor",
    "category": "名詞・動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 24,
    "japanese": "輸入",
    "reading": "ゆにゅう",
    "indonesian": "impor",
    "category": "名詞・動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 24,
    "japanese": "翻訳",
    "reading": "ほんやく",
    "indonesian": "penerjemahan tertulis",
    "category": "名詞・動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 24,
    "japanese": "研究室",
    "reading": "けんきゅうしつ",
    "indonesian": "ruang penelitian; laboratorium",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 1,
    "japanese": "写す",
    "reading": "うつす",
    "indonesian": "menyalin; memotret",
    "category": "動詞",
    "note": "",
    "position": 18
  },
  {
    "chapter": 1,
    "japanese": "飾る",
    "reading": "かざる",
    "indonesian": "menghias",
    "category": "動詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 1,
    "japanese": "人形",
    "reading": "にんぎょう",
    "indonesian": "boneka; figur",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 1,
    "japanese": "着物",
    "reading": "きもの",
    "indonesian": "kimono",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 1,
    "japanese": "絹",
    "reading": "きぬ",
    "indonesian": "sutra",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 1,
    "japanese": "木綿",
    "reading": "もめん",
    "indonesian": "katun",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 1,
    "japanese": "花見",
    "reading": "はなみ",
    "indonesian": "melihat bunga sakura",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 1,
    "japanese": "お祭り",
    "reading": "おまつり",
    "indonesian": "festival",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 1,
    "japanese": "コンサート",
    "reading": "コンサート",
    "indonesian": "konser",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 1,
    "japanese": "ステレオ",
    "reading": "ステレオ",
    "indonesian": "perangkat stereo",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 1,
    "japanese": "踊り",
    "reading": "おどり",
    "indonesian": "tarian",
    "category": "名詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 1,
    "japanese": "遊び",
    "reading": "あそび",
    "indonesian": "permainan; kegiatan bersantai",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 1,
    "japanese": "スクリーン",
    "reading": "スクリーン",
    "indonesian": "layar",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 2,
    "japanese": "辞典",
    "reading": "じてん",
    "indonesian": "kamus",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 2,
    "japanese": "紹介",
    "reading": "しょうかい",
    "indonesian": "perkenalan; pengenalan",
    "category": "名詞・動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 2,
    "japanese": "社会",
    "reading": "しゃかい",
    "indonesian": "masyarakat",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 2,
    "japanese": "政治",
    "reading": "せいじ",
    "indonesian": "politik; pemerintahan",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 2,
    "japanese": "経済",
    "reading": "けいざい",
    "indonesian": "ekonomi",
    "category": "名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 2,
    "japanese": "国際",
    "reading": "こくさい",
    "indonesian": "internasional",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 2,
    "japanese": "キーワード",
    "reading": "キーワード",
    "indonesian": "kata kunci",
    "category": "名詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 2,
    "japanese": "講義",
    "reading": "こうぎ",
    "indonesian": "kuliah; ceramah",
    "category": "名詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 3,
    "japanese": "再来週",
    "reading": "さらいしゅう",
    "indonesian": "dua minggu lagi",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 3,
    "japanese": "再来月",
    "reading": "さらいげつ",
    "indonesian": "dua bulan lagi",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 3,
    "japanese": "日記",
    "reading": "にっき",
    "indonesian": "buku harian",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 3,
    "japanese": "時代",
    "reading": "じだい",
    "indonesian": "zaman; era",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 3,
    "japanese": "昔",
    "reading": "むかし",
    "indonesian": "dahulu",
    "category": "名詞・副詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 3,
    "japanese": "帰り",
    "reading": "かえり",
    "indonesian": "kepulangan; perjalanan pulang",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 3,
    "japanese": "終わり",
    "reading": "おわり",
    "indonesian": "akhir",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 3,
    "japanese": "途中で",
    "reading": "とちゅうで",
    "indonesian": "di tengah perjalanan atau proses",
    "category": "表現",
    "note": "",
    "position": 28
  },
  {
    "chapter": 4,
    "japanese": "見つかる",
    "reading": "みつかる",
    "indonesian": "ditemukan",
    "category": "動詞",
    "note": "自動詞. Pasangan: 見つける.",
    "position": 27
  },
  {
    "chapter": 4,
    "japanese": "見つける",
    "reading": "みつける",
    "indonesian": "menemukan",
    "category": "動詞",
    "note": "他動詞. Pasangan: 見つかる.",
    "position": 28
  },
  {
    "chapter": 4,
    "japanese": "噛む",
    "reading": "かむ",
    "indonesian": "menggigit; mengunyah",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 4,
    "japanese": "滑る",
    "reading": "すべる",
    "indonesian": "tergelincir; meluncur",
    "category": "動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 4,
    "japanese": "釣る",
    "reading": "つる",
    "indonesian": "memancing",
    "category": "動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 4,
    "japanese": "踊る",
    "reading": "おどる",
    "indonesian": "menari",
    "category": "動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 4,
    "japanese": "運動",
    "reading": "うんどう",
    "indonesian": "olahraga; gerak badan",
    "category": "名詞・動詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 5,
    "japanese": "生産",
    "reading": "せいさん",
    "indonesian": "produksi",
    "category": "名詞・動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 5,
    "japanese": "産業",
    "reading": "さんぎょう",
    "indonesian": "industri",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 5,
    "japanese": "公務員",
    "reading": "こうむいん",
    "indonesian": "pegawai negeri",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 5,
    "japanese": "運転",
    "reading": "うんてん",
    "indonesian": "mengemudi; pengoperasian",
    "category": "名詞・動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 5,
    "japanese": "引っ越す",
    "reading": "ひっこす",
    "indonesian": "pindah rumah",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 5,
    "japanese": "下宿",
    "reading": "げしゅく",
    "indonesian": "indekos; tempat kos",
    "category": "名詞・動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 5,
    "japanese": "スケジュール",
    "reading": "スケジュール",
    "indonesian": "jadwal",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 6,
    "japanese": "取り替える",
    "reading": "とりかえる",
    "indonesian": "mengganti; menukar",
    "category": "動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 6,
    "japanese": "無くなる",
    "reading": "なくなる",
    "indonesian": "hilang; habis",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 6,
    "japanese": "拾う",
    "reading": "ひろう",
    "indonesian": "memungut; menemukan barang",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 6,
    "japanese": "捨てる",
    "reading": "すてる",
    "indonesian": "membuang",
    "category": "動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 6,
    "japanese": "捕まえる",
    "reading": "つかまえる",
    "indonesian": "menangkap",
    "category": "動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 6,
    "japanese": "逃げる",
    "reading": "にげる",
    "indonesian": "melarikan diri",
    "category": "動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 6,
    "japanese": "残る",
    "reading": "のこる",
    "indonesian": "tersisa; tertinggal",
    "category": "動詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 7,
    "japanese": "付く",
    "reading": "つく",
    "indonesian": "menempel; terpasang",
    "category": "動詞",
    "note": "自動詞. Pasangan: 付ける.",
    "position": 20
  },
  {
    "chapter": 7,
    "japanese": "掛ける",
    "reading": "かける",
    "indonesian": "menggantungkan; memasang",
    "category": "動詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 7,
    "japanese": "下げる",
    "reading": "さげる",
    "indonesian": "menurunkan; menggantungkan",
    "category": "動詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 7,
    "japanese": "立てる",
    "reading": "たてる",
    "indonesian": "mendirikan; menegakkan",
    "category": "動詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 7,
    "japanese": "植える",
    "reading": "うえる",
    "indonesian": "menanam",
    "category": "動詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 7,
    "japanese": "塗る",
    "reading": "ぬる",
    "indonesian": "mengecat; mengoleskan",
    "category": "動詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 7,
    "japanese": "包む",
    "reading": "つつむ",
    "indonesian": "membungkus",
    "category": "動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 7,
    "japanese": "取り替える",
    "reading": "とりかえる",
    "indonesian": "mengganti; menukar",
    "category": "動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 7,
    "japanese": "割る",
    "reading": "わる",
    "indonesian": "memecahkan; membagi",
    "category": "動詞",
    "note": "他動詞. Pasangan: 割れる.",
    "position": 28
  },
  {
    "chapter": 7,
    "japanese": "乾かす",
    "reading": "かわかす",
    "indonesian": "mengeringkan",
    "category": "動詞",
    "note": "他動詞. Pasangan: 乾く.",
    "position": 29
  },
  {
    "chapter": 7,
    "japanese": "汚す",
    "reading": "よごす",
    "indonesian": "mengotori",
    "category": "動詞",
    "note": "他動詞. Pasangan: 汚れる.",
    "position": 30
  },
  {
    "chapter": 8,
    "japanese": "引っ越す",
    "reading": "ひっこす",
    "indonesian": "pindah rumah",
    "category": "動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 8,
    "japanese": "増やす",
    "reading": "ふやす",
    "indonesian": "menambah; meningkatkan",
    "category": "動詞",
    "note": "他動詞. Pasangan: 増える.",
    "position": 27
  },
  {
    "chapter": 8,
    "japanese": "減らす",
    "reading": "へらす",
    "indonesian": "mengurangi",
    "category": "動詞",
    "note": "他動詞. Pasangan: 減る.",
    "position": 28
  },
  {
    "chapter": 8,
    "japanese": "上げる",
    "reading": "あげる",
    "indonesian": "menaikkan",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 8,
    "japanese": "下げる",
    "reading": "さげる",
    "indonesian": "menurunkan",
    "category": "動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 8,
    "japanese": "通り過ぎる",
    "reading": "とおりすぎる",
    "indonesian": "melewati",
    "category": "動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 8,
    "japanese": "冷える",
    "reading": "ひえる",
    "indonesian": "menjadi dingin",
    "category": "動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 8,
    "japanese": "育つ",
    "reading": "そだつ",
    "indonesian": "tumbuh; dibesarkan",
    "category": "動詞",
    "note": "自動詞. Pasangan: 育てる.",
    "position": 33
  },
  {
    "chapter": 9,
    "japanese": "盛ん",
    "reading": "さかん",
    "indonesian": "aktif; berkembang pesat",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 9,
    "japanese": "急",
    "reading": "きゅう",
    "indonesian": "mendadak; curam; darurat",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 9,
    "japanese": "変",
    "reading": "へん",
    "indonesian": "aneh",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 9,
    "japanese": "裏",
    "reading": "うら",
    "indonesian": "sisi belakang; bagian dalam",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 9,
    "japanese": "表",
    "reading": "おもて",
    "indonesian": "sisi depan; permukaan",
    "category": "名詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 9,
    "japanese": "真ん中",
    "reading": "まんなか",
    "indonesian": "tengah",
    "category": "名詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 9,
    "japanese": "隅",
    "reading": "すみ",
    "indonesian": "sudut",
    "category": "名詞",
    "note": "",
    "position": 35
  },
  {
    "chapter": 9,
    "japanese": "細かさ",
    "reading": "こまかさ",
    "indonesian": "tingkat kerincian atau kehalusan",
    "category": "名詞",
    "note": "",
    "position": 36
  },
  {
    "chapter": 10,
    "japanese": "決して",
    "reading": "けっして",
    "indonesian": "sama sekali tidak; tidak pernah",
    "category": "副詞",
    "note": "Umumnya dipakai dengan bentuk negatif.",
    "position": 21
  },
  {
    "chapter": 10,
    "japanese": "別れる",
    "reading": "わかれる",
    "indonesian": "berpisah",
    "category": "動詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 10,
    "japanese": "すると",
    "reading": "すると",
    "indonesian": "kemudian; kalau begitu",
    "category": "接続詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 10,
    "japanese": "そのため",
    "reading": "そのため",
    "indonesian": "oleh sebab itu",
    "category": "接続詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 10,
    "japanese": "その上",
    "reading": "そのうえ",
    "indonesian": "selain itu; terlebih lagi",
    "category": "接続詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 10,
    "japanese": "ところで",
    "reading": "ところで",
    "indonesian": "ngomong-ngomong",
    "category": "接続詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 10,
    "japanese": "なぜなら",
    "reading": "なぜなら",
    "indonesian": "karena; alasannya adalah",
    "category": "接続詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 10,
    "japanese": "訳",
    "reading": "わけ",
    "indonesian": "alasan; arti; keadaan di balik sesuatu",
    "category": "名詞",
    "note": "Makna dipilih menurut konteks.",
    "position": 28
  },
  {
    "chapter": 10,
    "japanese": "うまくいく",
    "reading": "うまくいく",
    "indonesian": "berjalan dengan baik",
    "category": "表現",
    "note": "",
    "position": 29
  },
  {
    "chapter": 11,
    "japanese": "曇り",
    "reading": "くもり",
    "indonesian": "cuaca berawan",
    "category": "名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 11,
    "japanese": "星",
    "reading": "ほし",
    "indonesian": "bintang",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 11,
    "japanese": "月",
    "reading": "つき",
    "indonesian": "bulan di langit",
    "category": "名詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 11,
    "japanese": "電灯",
    "reading": "でんとう",
    "indonesian": "lampu listrik",
    "category": "名詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 11,
    "japanese": "火",
    "reading": "ひ",
    "indonesian": "api",
    "category": "名詞",
    "note": "",
    "position": 35
  },
  {
    "chapter": 11,
    "japanese": "海岸",
    "reading": "かいがん",
    "indonesian": "pantai; pesisir",
    "category": "名詞",
    "note": "",
    "position": 36
  },
  {
    "chapter": 11,
    "japanese": "雷",
    "reading": "かみなり",
    "indonesian": "petir; guntur",
    "category": "名詞",
    "note": "",
    "position": 37
  },
  {
    "chapter": 11,
    "japanese": "気温",
    "reading": "きおん",
    "indonesian": "suhu udara",
    "category": "名詞",
    "note": "",
    "position": 38
  },
  {
    "chapter": 12,
    "japanese": "慣れる",
    "reading": "なれる",
    "indonesian": "menjadi terbiasa",
    "category": "動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 12,
    "japanese": "痩せる",
    "reading": "やせる",
    "indonesian": "menjadi kurus; menurunkan berat badan",
    "category": "動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 12,
    "japanese": "太る",
    "reading": "ふとる",
    "indonesian": "menjadi gemuk; bertambah berat badan",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 12,
    "japanese": "眠る",
    "reading": "ねむる",
    "indonesian": "tidur",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 12,
    "japanese": "具合",
    "reading": "ぐあい",
    "indonesian": "kondisi; keadaan kesehatan",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 12,
    "japanese": "気",
    "reading": "き",
    "indonesian": "perasaan; semangat; niat",
    "category": "名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 12,
    "japanese": "安心",
    "reading": "あんしん",
    "indonesian": "rasa lega; tenang",
    "category": "名詞・な形容詞・動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 12,
    "japanese": "残念がる",
    "reading": "ざんねんがる",
    "indonesian": "menunjukkan rasa kecewa",
    "category": "動詞",
    "note": "Biasanya untuk perasaan orang lain.",
    "position": 33
  },
  {
    "chapter": 13,
    "japanese": "乗り物",
    "reading": "のりもの",
    "indonesian": "kendaraan",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 13,
    "japanese": "旅館",
    "reading": "りょかん",
    "indonesian": "penginapan gaya Jepang",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 13,
    "japanese": "田舎",
    "reading": "いなか",
    "indonesian": "daerah pedesaan; kampung halaman",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 13,
    "japanese": "島",
    "reading": "しま",
    "indonesian": "pulau",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 13,
    "japanese": "湖",
    "reading": "みずうみ",
    "indonesian": "danau",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 13,
    "japanese": "屋上",
    "reading": "おくじょう",
    "indonesian": "atap gedung; rooftop",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 13,
    "japanese": "汽車",
    "reading": "きしゃ",
    "indonesian": "kereta api bertenaga uap; kereta",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 13,
    "japanese": "飛行場",
    "reading": "ひこうじょう",
    "indonesian": "lapangan terbang; bandara",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 13,
    "japanese": "二階建て",
    "reading": "にかいだて",
    "indonesian": "bangunan dua lantai",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 13,
    "japanese": "見物",
    "reading": "けんぶつ",
    "indonesian": "melihat-lihat; wisata tontonan",
    "category": "名詞・動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 13,
    "japanese": "帰り",
    "reading": "かえり",
    "indonesian": "kepulangan; perjalanan pulang",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 13,
    "japanese": "バス停",
    "reading": "バスてい",
    "indonesian": "halte bus",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 14,
    "japanese": "遠慮",
    "reading": "えんりょ",
    "indonesian": "menahan diri; sungkan",
    "category": "名詞・動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 14,
    "japanese": "相談",
    "reading": "そうだん",
    "indonesian": "konsultasi; berdiskusi",
    "category": "名詞・動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 14,
    "japanese": "承知",
    "reading": "しょうち",
    "indonesian": "pemahaman; persetujuan formal",
    "category": "名詞・動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 14,
    "japanese": "安心",
    "reading": "あんしん",
    "indonesian": "rasa lega; tenang",
    "category": "名詞・な形容詞・動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 14,
    "japanese": "急",
    "reading": "きゅう",
    "indonesian": "mendadak; curam; darurat",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 14,
    "japanese": "都合がいい",
    "reading": "つごうがいい",
    "indonesian": "waktunya cocok; keadaannya menguntungkan",
    "category": "表現",
    "note": "",
    "position": 34
  },
  {
    "chapter": 14,
    "japanese": "都合が悪い",
    "reading": "つごうがわるい",
    "indonesian": "waktunya tidak cocok; keadaannya buruk",
    "category": "表現",
    "note": "",
    "position": 35
  },
  {
    "chapter": 14,
    "japanese": "ちょうどいい",
    "reading": "ちょうどいい",
    "indonesian": "pas; tepat",
    "category": "表現",
    "note": "",
    "position": 36
  },
  {
    "chapter": 15,
    "japanese": "辞典",
    "reading": "じてん",
    "indonesian": "kamus",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 15,
    "japanese": "教会",
    "reading": "きょうかい",
    "indonesian": "gereja",
    "category": "名詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 15,
    "japanese": "神社",
    "reading": "じんじゃ",
    "indonesian": "kuil Shinto",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 15,
    "japanese": "寺",
    "reading": "てら",
    "indonesian": "kuil Buddha",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 15,
    "japanese": "水道",
    "reading": "すいどう",
    "indonesian": "saluran air; air ledeng",
    "category": "名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 15,
    "japanese": "電灯",
    "reading": "でんとう",
    "indonesian": "lampu listrik",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 15,
    "japanese": "暖房",
    "reading": "だんぼう",
    "indonesian": "pemanas ruangan",
    "category": "名詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 15,
    "japanese": "冷房",
    "reading": "れいぼう",
    "indonesian": "pendingin ruangan",
    "category": "名詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 16,
    "japanese": "非常",
    "reading": "ひじょう",
    "indonesian": "darurat; luar biasa",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 16,
    "japanese": "事故",
    "reading": "じこ",
    "indonesian": "kecelakaan",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 16,
    "japanese": "倒れる",
    "reading": "たおれる",
    "indonesian": "jatuh; roboh",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 16,
    "japanese": "亡くなる",
    "reading": "なくなる",
    "indonesian": "meninggal dunia",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 16,
    "japanese": "騒ぐ",
    "reading": "さわぐ",
    "indonesian": "membuat keributan",
    "category": "動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 16,
    "japanese": "火傷",
    "reading": "やけど",
    "indonesian": "luka bakar",
    "category": "名詞・動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 16,
    "japanese": "救急車",
    "reading": "きゅうきゅうしゃ",
    "indonesian": "ambulans",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 17,
    "japanese": "娘",
    "reading": "むすめ",
    "indonesian": "putri sendiri",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 17,
    "japanese": "祖父",
    "reading": "そふ",
    "indonesian": "kakek sendiri",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 17,
    "japanese": "祖母",
    "reading": "そぼ",
    "indonesian": "nenek sendiri",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 17,
    "japanese": "赤ん坊",
    "reading": "あかんぼう",
    "indonesian": "bayi",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 17,
    "japanese": "お金持ち",
    "reading": "おかねもち",
    "indonesian": "orang kaya",
    "category": "名詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 17,
    "japanese": "家内",
    "reading": "かない",
    "indonesian": "istri sendiri",
    "category": "名詞",
    "note": "Istilah tradisional; 妻 lebih netral.",
    "position": 29
  },
  {
    "chapter": 17,
    "japanese": "贈り物をする",
    "reading": "おくりものをする",
    "indonesian": "memberikan hadiah",
    "category": "表現",
    "note": "",
    "position": 30
  },
  {
    "chapter": 17,
    "japanese": "お礼を言う",
    "reading": "おれいをいう",
    "indonesian": "mengucapkan terima kasih",
    "category": "表現",
    "note": "",
    "position": 31
  },
  {
    "chapter": 18,
    "japanese": "訪問",
    "reading": "ほうもん",
    "indonesian": "kunjungan",
    "category": "名詞・動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 18,
    "japanese": "世話になる",
    "reading": "せわになる",
    "indonesian": "menerima bantuan atau perhatian",
    "category": "表現",
    "note": "",
    "position": 27
  },
  {
    "chapter": 18,
    "japanese": "遠慮なく",
    "reading": "えんりょなく",
    "indonesian": "tanpa sungkan",
    "category": "副詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 18,
    "japanese": "お邪魔する",
    "reading": "おじゃまする",
    "indonesian": "berkunjung; permisi mengganggu",
    "category": "表現",
    "note": "",
    "position": 29
  },
  {
    "chapter": 18,
    "japanese": "留守番",
    "reading": "るすばん",
    "indonesian": "menjaga rumah saat penghuni pergi",
    "category": "名詞・動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 18,
    "japanese": "迎え",
    "reading": "むかえ",
    "indonesian": "jemputan",
    "category": "名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 18,
    "japanese": "見送る",
    "reading": "みおくる",
    "indonesian": "mengantar kepergian; melepas",
    "category": "動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 18,
    "japanese": "頼み",
    "reading": "たのみ",
    "indonesian": "permintaan; andalan",
    "category": "名詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 19,
    "japanese": "二階建て",
    "reading": "にかいだて",
    "indonesian": "bangunan dua lantai",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 19,
    "japanese": "データ",
    "reading": "データ",
    "indonesian": "data",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 19,
    "japanese": "キロ",
    "reading": "キロ",
    "indonesian": "kilo; kilometer atau kilogram",
    "category": "名詞・助数詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 19,
    "japanese": "かなり",
    "reading": "かなり",
    "indonesian": "cukup; lumayan; sangat",
    "category": "副詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 19,
    "japanese": "何人か",
    "reading": "なんにんか",
    "indonesian": "beberapa orang",
    "category": "表現",
    "note": "",
    "position": 26
  },
  {
    "chapter": 19,
    "japanese": "チェック",
    "reading": "チェック",
    "indonesian": "pemeriksaan; pengecekan",
    "category": "名詞・動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 19,
    "japanese": "関係",
    "reading": "かんけい",
    "indonesian": "hubungan",
    "category": "名詞・動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 19,
    "japanese": "社会",
    "reading": "しゃかい",
    "indonesian": "masyarakat",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 19,
    "japanese": "経済",
    "reading": "けいざい",
    "indonesian": "ekonomi",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 20,
    "japanese": "以内に",
    "reading": "いないに",
    "indonesian": "dalam batas waktu atau jarak",
    "category": "表現",
    "note": "",
    "position": 27
  },
  {
    "chapter": 20,
    "japanese": "以外に",
    "reading": "いがいに",
    "indonesian": "selain; di luar",
    "category": "表現",
    "note": "",
    "position": 28
  },
  {
    "chapter": 20,
    "japanese": "別々",
    "reading": "べつべつ",
    "indonesian": "terpisah satu sama lain",
    "category": "名詞・な形容詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 20,
    "japanese": "ずっと",
    "reading": "ずっと",
    "indonesian": "jauh lebih; terus-menerus",
    "category": "副詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 20,
    "japanese": "ほど",
    "reading": "ほど",
    "indonesian": "tingkat; sejauh",
    "category": "助詞・名詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 20,
    "japanese": "かなり",
    "reading": "かなり",
    "indonesian": "cukup; lumayan; sangat",
    "category": "副詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 21,
    "japanese": "パトカー",
    "reading": "パトカー",
    "indonesian": "mobil polisi",
    "category": "名詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 21,
    "japanese": "110番",
    "reading": "ひゃくとうばん",
    "indonesian": "nomor darurat polisi 110",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 21,
    "japanese": "生産",
    "reading": "せいさん",
    "indonesian": "produksi",
    "category": "名詞・動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 21,
    "japanese": "社会",
    "reading": "しゃかい",
    "indonesian": "masyarakat",
    "category": "名詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 21,
    "japanese": "発見",
    "reading": "はっけん",
    "indonesian": "penemuan",
    "category": "名詞・動詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 21,
    "japanese": "発明",
    "reading": "はつめい",
    "indonesian": "penemuan atau ciptaan baru",
    "category": "名詞・動詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 22,
    "japanese": "妻",
    "reading": "つま",
    "indonesian": "istri sendiri",
    "category": "名詞",
    "note": "",
    "position": 19
  },
  {
    "chapter": 22,
    "japanese": "夫",
    "reading": "おっと",
    "indonesian": "suami sendiri",
    "category": "名詞",
    "note": "",
    "position": 20
  },
  {
    "chapter": 22,
    "japanese": "息子",
    "reading": "むすこ",
    "indonesian": "putra sendiri",
    "category": "名詞",
    "note": "",
    "position": 21
  },
  {
    "chapter": 22,
    "japanese": "娘",
    "reading": "むすめ",
    "indonesian": "putri sendiri",
    "category": "名詞",
    "note": "",
    "position": 22
  },
  {
    "chapter": 22,
    "japanese": "祖父",
    "reading": "そふ",
    "indonesian": "kakek sendiri",
    "category": "名詞",
    "note": "",
    "position": 23
  },
  {
    "chapter": 22,
    "japanese": "祖母",
    "reading": "そぼ",
    "indonesian": "nenek sendiri",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 22,
    "japanese": "赤ん坊",
    "reading": "あかんぼう",
    "indonesian": "bayi",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 22,
    "japanese": "研究",
    "reading": "けんきゅう",
    "indonesian": "penelitian",
    "category": "名詞・動詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 22,
    "japanese": "女性",
    "reading": "じょせい",
    "indonesian": "perempuan; wanita",
    "category": "名詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 22,
    "japanese": "男性",
    "reading": "だんせい",
    "indonesian": "laki-laki; pria",
    "category": "名詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 22,
    "japanese": "家内",
    "reading": "かない",
    "indonesian": "istri sendiri",
    "category": "名詞",
    "note": "Istilah tradisional; 妻 lebih netral.",
    "position": 29
  },
  {
    "chapter": 22,
    "japanese": "お嬢さん",
    "reading": "おじょうさん",
    "indonesian": "putri orang lain; nona muda",
    "category": "名詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 23,
    "japanese": "お年寄り",
    "reading": "おとしより",
    "indonesian": "orang lanjut usia, bentuk sopan",
    "category": "名詞",
    "note": "",
    "position": 24
  },
  {
    "chapter": 23,
    "japanese": "奥様",
    "reading": "おくさま",
    "indonesian": "istri orang lain, bentuk hormat",
    "category": "名詞",
    "note": "",
    "position": 25
  },
  {
    "chapter": 23,
    "japanese": "ご意見",
    "reading": "ごいけん",
    "indonesian": "pendapat pihak lain, bentuk hormat",
    "category": "名詞",
    "note": "",
    "position": 26
  },
  {
    "chapter": 23,
    "japanese": "ご利用",
    "reading": "ごりよう",
    "indonesian": "penggunaan oleh pelanggan, bentuk hormat",
    "category": "名詞・動詞",
    "note": "",
    "position": 27
  },
  {
    "chapter": 23,
    "japanese": "お帰りになる",
    "reading": "おかえりになる",
    "indonesian": "pulang, bahasa hormat",
    "category": "動詞",
    "note": "",
    "position": 28
  },
  {
    "chapter": 23,
    "japanese": "お休みになる",
    "reading": "おやすみになる",
    "indonesian": "tidur atau beristirahat, bahasa hormat",
    "category": "動詞",
    "note": "",
    "position": 29
  },
  {
    "chapter": 24,
    "japanese": "ご挨拶",
    "reading": "ごあいさつ",
    "indonesian": "salam atau sapaan formal",
    "category": "名詞・動詞",
    "note": "",
    "position": 30
  },
  {
    "chapter": 24,
    "japanese": "ご説明",
    "reading": "ごせつめい",
    "indonesian": "penjelasan formal kepada pihak lain",
    "category": "名詞・動詞",
    "note": "",
    "position": 31
  },
  {
    "chapter": 24,
    "japanese": "ご報告",
    "reading": "ごほうこく",
    "indonesian": "laporan formal",
    "category": "名詞・動詞",
    "note": "",
    "position": 32
  },
  {
    "chapter": 24,
    "japanese": "ご相談",
    "reading": "ごそうだん",
    "indonesian": "konsultasi formal",
    "category": "名詞・動詞",
    "note": "",
    "position": 33
  },
  {
    "chapter": 24,
    "japanese": "お知らせ",
    "reading": "おしらせ",
    "indonesian": "pemberitahuan",
    "category": "名詞",
    "note": "",
    "position": 34
  },
  {
    "chapter": 24,
    "japanese": "お届けする",
    "reading": "おとどけする",
    "indonesian": "mengantarkan, bahasa merendah",
    "category": "動詞",
    "note": "",
    "position": 35
  },
  {
    "chapter": 24,
    "japanese": "お持ちする",
    "reading": "おもちする",
    "indonesian": "membawakan, bahasa merendah",
    "category": "動詞",
    "note": "",
    "position": 36
  },
  {
    "chapter": 24,
    "japanese": "お待ちする",
    "reading": "おまちする",
    "indonesian": "menunggu, bahasa merendah",
    "category": "動詞",
    "note": "",
    "position": 37
  }
]$vocabulary$::jsonb) LOOP
    IF EXISTS (
      SELECT 1 FROM lesson_deck_items d JOIN lessons l ON l.id=d.lesson_id
      JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
      JOIN module_vocabulary v ON v.id=d.vocabulary_id
      WHERE c.slug='n5' AND btrim(v.japanese)=btrim(item->>'japanese')) THEN
      CONTINUE;
    END IF;
    SELECT id INTO STRICT target_module FROM modules
      WHERE course_id=n4_course AND slug LIKE 'n4-b' || lpad(item->>'chapter',2,'0') || '-%';
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
        coalesce(reading,'') !~ '[ぁ-ゖァ-ヺ]' OR nullif(btrim(indonesian),'') IS NULL
        OR nullif(btrim(category),'') IS NULL
        OR (nullif(btrim(note),'') IS NULL AND nullif(item->>'note','') IS NOT NULL));
    END IF;
    INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order)
      VALUES(target_lesson,target_word,(item->>'position')::int)
      ON CONFLICT(lesson_id,vocabulary_id) DO NOTHING;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM lesson_deck_items a JOIN lessons al ON al.id=a.lesson_id
    JOIN modules am ON am.id=al.module_id JOIN courses ac ON ac.id=am.course_id
    JOIN module_vocabulary av ON av.id=a.vocabulary_id
    JOIN lesson_deck_items b ON true JOIN lessons bl ON bl.id=b.lesson_id
    JOIN modules bm ON bm.id=bl.module_id JOIN courses bc ON bc.id=bm.course_id
    JOIN module_vocabulary bv ON bv.id=b.vocabulary_id
    WHERE ac.slug='n4' AND bc.slug='n5' AND btrim(av.japanese)=btrim(bv.japanese)) THEN
    RAISE EXCEPTION '160: N4 and N5 decks still share vocabulary';
  END IF;
  RAISE NOTICE '160: N4 vocabulary expanded with N5 overlaps excluded';
END $migration$;
