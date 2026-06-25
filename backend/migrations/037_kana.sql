-- Hiragana & Katakana jadi jenis pelajaran (lessons.type = 'kana'), mirror pola
-- 'kanji' (015) + 'grammar_task' (023). Satu pelajaran kana berisi video (opsional)
-- + chart gojuon + modal goresan + drill dua arah (lihat welcome.html renderKanaLesson).
--
-- Data kana DB-backed + admin-editable (mirror Daftar Kanji):
--   kana_items       — bank global karakter (di-seed sekali, di bawah)
--   lesson_kana_items — karakter dipilih ke sebuah pelajaran kana (mirror lesson_deck_items)
--   kana_examples     — contoh kata per karakter (mirror vocabulary_examples)
--
-- Idempotent: CHECK di-drop/re-add, CREATE TABLE IF NOT EXISTS, index di-gate via
-- pg_indexes (konvensi repo), seed pakai ON CONFLICT. Runner jalan sekali per DB.

-- 1. Izinkan lesson type 'kana'
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video', 'quiz', 'text', 'deck', 'kanji', 'grammar_task', 'kana'));

-- 2. Bank karakter kana (global, universal — bukan per-modul seperti kosakata)
CREATE TABLE IF NOT EXISTS kana_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hiragana', 'katakana')),
  romaji TEXT NOT NULL,
  mnemonic TEXT,
  group_label TEXT,
  variant_type TEXT NOT NULL DEFAULT 'base'
    CHECK (variant_type IN ('base', 'dakuten', 'handakuten', 'youon', 'special')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, character)
);

-- 3. Karakter dipilih ke sebuah pelajaran kana (join, mirror lesson_deck_items)
CREATE TABLE IF NOT EXISTS lesson_kana_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kana_id UUID NOT NULL REFERENCES kana_items(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (lesson_id, kana_id)
);

-- 4. Contoh kata per karakter (mirror vocabulary_examples)
CREATE TABLE IF NOT EXISTS kana_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kana_id UUID NOT NULL REFERENCES kana_items(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  reading TEXT,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_lesson_kana_items_lesson') THEN
    EXECUTE 'CREATE INDEX idx_lesson_kana_items_lesson ON lesson_kana_items(lesson_id, sort_order)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kana_examples_kana') THEN
    EXECUTE 'CREATE INDEX idx_kana_examples_kana ON kana_examples(kana_id, sort_order)';
  END IF;
END $$;

-- ============================================================================
-- SEED bank karakter. romaji wajib; mnemonic (Bahasa Indonesia) untuk huruf
-- dasar; varian (dakuten/handakuten/youon) tanpa mnemonic (bisa diisi admin).
-- ============================================================================

INSERT INTO kana_items (character, kind, romaji, group_label, variant_type, sort_order, mnemonic) VALUES
-- Hiragana — Vokal
('あ','hiragana','a','Vokal','base',1,'Mulut terbuka lebar berkata "Ah!" — あ.'),
('い','hiragana','i','Vokal','base',2,'Dua garis tegak seperti angka 11 — bunyi "i".'),
('う','hiragana','u','Vokal','base',3,'Orang menunduk berkata "uuh" — う.'),
('え','hiragana','e','Vokal','base',4,'Berlekuk penuh "energi" — え.'),
('お','hiragana','o','Vokal','base',5,'Mirip あ tapi mulut bulat "O" — お.'),
-- Hiragana — Baris K
('か','hiragana','ka','Baris K','base',6,'Seperti pisau katana memotong — "ka".'),
('き','hiragana','ki','Baris K','base',7,'Seperti kunci (key) bergerigi — "ki".'),
('く','hiragana','ku','Baris K','base',8,'Seperti paruh burung terbuka — "ku".'),
('け','hiragana','ke','Baris K','base',9,'Seperti orang menendang (kick) — "ke".'),
('こ','hiragana','ko','Baris K','base',10,'Dua ekor ikan koi sejajar — "ko".'),
-- Hiragana — Baris S
('さ','hiragana','sa','Baris S','base',11,'Seperti kail pancing — "sa".'),
('し','hiragana','shi','Baris S','base',12,'Satu lengkungan panjang ke bawah — "shi".'),
('す','hiragana','su','Baris S','base',13,'Pusaran dengan ekor (swirl) — "su".'),
('せ','hiragana','se','Baris S','base',14,'Mulut terbuka berseru — "se".'),
('そ','hiragana','so','Baris S','base',15,'Garis zig-zag seperti jahitan (sew) — "so".'),
-- Hiragana — Baris T
('た','hiragana','ta','Baris T','base',16,'Seperti huruf "t" dengan tanda — "ta".'),
('ち','hiragana','chi','Baris T','base',17,'Seperti angka 5 terbalik — "chi".'),
('つ','hiragana','tsu','Baris T','base',18,'Gelombang tsunami kecil — "tsu".'),
('て','hiragana','te','Baris T','base',19,'Seperti tangan (te = tangan) — "te".'),
('と','hiragana','to','Baris T','base',20,'Seperti jari kaki tertusuk (toe) — "to".'),
-- Hiragana — Baris N
('な','hiragana','na','Baris N','base',21,'Orang berlutut berdoa — "na".'),
('に','hiragana','ni','Baris N','base',22,'Dua bagian seperti angka "ni" (2) — "ni".'),
('ぬ','hiragana','nu','Baris N','base',23,'Mie (noodle) melilit — "nu".'),
('ね','hiragana','ne','Baris N','base',24,'Ekor kucing (neko) melingkar — "ne".'),
('の','hiragana','no','Baris N','base',25,'Tanda "no entry" melingkar — "no".'),
-- Hiragana — Baris H
('は','hiragana','ha','Baris H','base',26,'Seperti huruf "h" + tambahan — "ha".'),
('ひ','hiragana','hi','Baris H','base',27,'Mulut tersenyum "hihi" — "hi".'),
('ふ','hiragana','fu','Baris H','base',28,'Seperti gunung Fuji — "fu".'),
('へ','hiragana','he','Baris H','base',29,'Puncak bukit (head) — "he".'),
('ほ','hiragana','ho','Baris H','base',30,'Mirip は dengan garis ekstra — "ho".'),
-- Hiragana — Baris M
('ま','hiragana','ma','Baris M','base',31,'Ikat rambut mama — "ma".'),
('み','hiragana','mi','Baris M','base',32,'Seperti angka 21 melingkar — "mi".'),
('む','hiragana','mu','Baris M','base',33,'Seperti sapi berkata "moo" — "mu".'),
('め','hiragana','me','Baris M','base',34,'Seperti mata (me = mata) — "me".'),
('も','hiragana','mo','Baris M','base',35,'Kail dengan dua umpan — "mo".'),
-- Hiragana — Baris Y
('や','hiragana','ya','Baris Y','base',36,'Seperti ketapel — "ya".'),
('ゆ','hiragana','yu','Baris Y','base',37,'Seperti ikan berenang — "yu".'),
('よ','hiragana','yo','Baris Y','base',38,'Seperti yoyo tergantung — "yo".'),
-- Hiragana — Baris R
('ら','hiragana','ra','Baris R','base',39,'Seperti orang berlari (run) — "ra".'),
('り','hiragana','ri','Baris R','base',40,'Dua garis seperti tetesan — "ri".'),
('る','hiragana','ru','Baris R','base',41,'Jalur dengan loop di bawah — "ru".'),
('れ','hiragana','re','Baris R','base',42,'Mirip る tapi lurus — "re".'),
('ろ','hiragana','ro','Baris R','base',43,'Seperti る tanpa loop — "ro".'),
-- Hiragana — Baris W + N
('わ','hiragana','wa','Baris W','base',44,'Mirip れ, orang melambai — "wa".'),
('を','hiragana','wo','Baris W','base',45,'Partikel objek; dibaca "o".'),
('ん','hiragana','n','Bunyi N','base',46,'Seperti huruf "n" kursif — bunyi "n".'),
-- Hiragana — Dakuten
('が','hiragana','ga','Dakuten G','dakuten',47,NULL),
('ぎ','hiragana','gi','Dakuten G','dakuten',48,NULL),
('ぐ','hiragana','gu','Dakuten G','dakuten',49,NULL),
('げ','hiragana','ge','Dakuten G','dakuten',50,NULL),
('ご','hiragana','go','Dakuten G','dakuten',51,NULL),
('ざ','hiragana','za','Dakuten Z','dakuten',52,NULL),
('じ','hiragana','ji','Dakuten Z','dakuten',53,NULL),
('ず','hiragana','zu','Dakuten Z','dakuten',54,NULL),
('ぜ','hiragana','ze','Dakuten Z','dakuten',55,NULL),
('ぞ','hiragana','zo','Dakuten Z','dakuten',56,NULL),
('だ','hiragana','da','Dakuten D','dakuten',57,NULL),
('ぢ','hiragana','ji','Dakuten D','dakuten',58,NULL),
('づ','hiragana','zu','Dakuten D','dakuten',59,NULL),
('で','hiragana','de','Dakuten D','dakuten',60,NULL),
('ど','hiragana','do','Dakuten D','dakuten',61,NULL),
('ば','hiragana','ba','Dakuten B','dakuten',62,NULL),
('び','hiragana','bi','Dakuten B','dakuten',63,NULL),
('ぶ','hiragana','bu','Dakuten B','dakuten',64,NULL),
('べ','hiragana','be','Dakuten B','dakuten',65,NULL),
('ぼ','hiragana','bo','Dakuten B','dakuten',66,NULL),
-- Hiragana — Handakuten
('ぱ','hiragana','pa','Handakuten P','handakuten',67,NULL),
('ぴ','hiragana','pi','Handakuten P','handakuten',68,NULL),
('ぷ','hiragana','pu','Handakuten P','handakuten',69,NULL),
('ぺ','hiragana','pe','Handakuten P','handakuten',70,NULL),
('ぽ','hiragana','po','Handakuten P','handakuten',71,NULL),
-- Hiragana — Yoon
('きゃ','hiragana','kya','Yōon','youon',72,NULL),
('きゅ','hiragana','kyu','Yōon','youon',73,NULL),
('きょ','hiragana','kyo','Yōon','youon',74,NULL),
('しゃ','hiragana','sha','Yōon','youon',75,NULL),
('しゅ','hiragana','shu','Yōon','youon',76,NULL),
('しょ','hiragana','sho','Yōon','youon',77,NULL),
('ちゃ','hiragana','cha','Yōon','youon',78,NULL),
('ちゅ','hiragana','chu','Yōon','youon',79,NULL),
('ちょ','hiragana','cho','Yōon','youon',80,NULL),
('にゃ','hiragana','nya','Yōon','youon',81,NULL),
('にゅ','hiragana','nyu','Yōon','youon',82,NULL),
('にょ','hiragana','nyo','Yōon','youon',83,NULL),
('ひゃ','hiragana','hya','Yōon','youon',84,NULL),
('ひゅ','hiragana','hyu','Yōon','youon',85,NULL),
('ひょ','hiragana','hyo','Yōon','youon',86,NULL),
('みゃ','hiragana','mya','Yōon','youon',87,NULL),
('みゅ','hiragana','myu','Yōon','youon',88,NULL),
('みょ','hiragana','myo','Yōon','youon',89,NULL),
('りゃ','hiragana','rya','Yōon','youon',90,NULL),
('りゅ','hiragana','ryu','Yōon','youon',91,NULL),
('りょ','hiragana','ryo','Yōon','youon',92,NULL),
('ぎゃ','hiragana','gya','Yōon','youon',93,NULL),
('ぎゅ','hiragana','gyu','Yōon','youon',94,NULL),
('ぎょ','hiragana','gyo','Yōon','youon',95,NULL),
('じゃ','hiragana','ja','Yōon','youon',96,NULL),
('じゅ','hiragana','ju','Yōon','youon',97,NULL),
('じょ','hiragana','jo','Yōon','youon',98,NULL),
('びゃ','hiragana','bya','Yōon','youon',99,NULL),
('びゅ','hiragana','byu','Yōon','youon',100,NULL),
('びょ','hiragana','byo','Yōon','youon',101,NULL),
('ぴゃ','hiragana','pya','Yōon','youon',102,NULL),
('ぴゅ','hiragana','pyu','Yōon','youon',103,NULL),
('ぴょ','hiragana','pyo','Yōon','youon',104,NULL),
-- Hiragana — Khusus
('っ','hiragana','(sokuon)','Khusus','special',105,'Tsu kecil (sokuon): menggandakan konsonan berikutnya, mis. きって "kitte".'),
-- Katakana — Vokal
('ア','katakana','a','Vokal','base',1,'Sudut huruf "A" tanpa palang — ア.'),
('イ','katakana','i','Vokal','base',2,'Dua garis seperti "i" — イ.'),
('ウ','katakana','u','Vokal','base',3,'Seperti atap rumah — "u".'),
('エ','katakana','e','Vokal','base',4,'Seperti huruf "E" tegak — エ.'),
('オ','katakana','o','Vokal','base',5,'Seperti orang berdiri tegak — "o".'),
-- Katakana — Baris K
('カ','katakana','ka','Baris K','base',6,'Mirip hiragana か tanpa titik — "ka".'),
('キ','katakana','ki','Baris K','base',7,'Seperti kunci (key) — "ki".'),
('ク','katakana','ku','Baris K','base',8,'Seperti paruh — "ku".'),
('ケ','katakana','ke','Baris K','base',9,'Seperti huruf "k" patah — "ke".'),
('コ','katakana','ko','Baris K','base',10,'Seperti sudut kotak — "ko".'),
-- Katakana — Baris S
('サ','katakana','sa','Baris S','base',11,'Tiga garis seperti kail — "sa".'),
('シ','katakana','shi','Baris S','base',12,'Tiga goresan miring ke ATAS — "shi".'),
('ス','katakana','su','Baris S','base',13,'Seperti orang duduk — "su".'),
('セ','katakana','se','Baris S','base',14,'Mirip hiragana せ — "se".'),
('ソ','katakana','so','Baris S','base',15,'Dua goresan dari atas (vertikal) — "so".'),
-- Katakana — Baris T
('タ','katakana','ta','Baris T','base',16,'Seperti huruf "g" kasar — "ta".'),
('チ','katakana','chi','Baris T','base',17,'Mirip angka "f" — "chi".'),
('ツ','katakana','tsu','Baris T','base',18,'Dua mata + ekor; goresan dari atas (≠ シ) — "tsu".'),
('テ','katakana','te','Baris T','base',19,'Seperti antena — "te".'),
('ト','katakana','to','Baris T','base',20,'Tiang + satu goresan — "to".'),
-- Katakana — Baris N
('ナ','katakana','na','Baris N','base',21,'Palang + ekor — "na".'),
('ニ','katakana','ni','Baris N','base',22,'Dua garis = angka "ni" (2) — "ni".'),
('ヌ','katakana','nu','Baris N','base',23,'Seperti ヌ menyilang — "nu".'),
('ネ','katakana','ne','Baris N','base',24,'Banyak goresan bertumpuk — "ne".'),
('ノ','katakana','no','Baris N','base',25,'Satu goresan miring — "no".'),
-- Katakana — Baris H
('ハ','katakana','ha','Baris H','base',26,'Dua kaki terbuka — "ha".'),
('ヒ','katakana','hi','Baris H','base',27,'Seperti kursi menghadap — "hi".'),
('フ','katakana','fu','Baris H','base',28,'Satu goresan seperti hidung — "fu".'),
('ヘ','katakana','he','Baris H','base',29,'Sama seperti hiragana へ — "he".'),
('ホ','katakana','ho','Baris H','base',30,'Seperti pohon + palang — "ho".'),
-- Katakana — Baris M
('マ','katakana','ma','Baris M','base',31,'Seperti bendera berkibar — "ma".'),
('ミ','katakana','mi','Baris M','base',32,'Tiga garis (mirip angka 3) — "mi".'),
('ム','katakana','mu','Baris M','base',33,'Seperti sudut runcing — "mu".'),
('メ','katakana','me','Baris M','base',34,'Seperti tanda silang — "me".'),
('モ','katakana','mo','Baris M','base',35,'Palang + kail — "mo".'),
-- Katakana — Baris Y
('ヤ','katakana','ya','Baris Y','base',36,'Seperti ketapel — "ya".'),
('ユ','katakana','yu','Baris Y','base',37,'Huruf U + garis — "yu".'),
('ヨ','katakana','yo','Baris Y','base',38,'Seperti E menghadap kanan — "yo".'),
-- Katakana — Baris R
('ラ','katakana','ra','Baris R','base',39,'Seperti angka 7 + garis — "ra".'),
('リ','katakana','ri','Baris R','base',40,'Dua garis tegak — "ri".'),
('ル','katakana','ru','Baris R','base',41,'Seperti dua kaki melangkah — "ru".'),
('レ','katakana','re','Baris R','base',42,'Satu goresan siku — "re".'),
('ロ','katakana','ro','Baris R','base',43,'Kotak persegi — "ro".'),
-- Katakana — Baris W + N
('ワ','katakana','wa','Baris W','base',44,'Seperti mulut terbuka — "wa".'),
('ヲ','katakana','wo','Baris W','base',45,'Jarang dipakai; dibaca "o".'),
('ン','katakana','n','Bunyi N','base',46,'Dua goresan dari BAWAH (≠ ソ) — "n".'),
-- Katakana — Dakuten
('ガ','katakana','ga','Dakuten G','dakuten',47,NULL),
('ギ','katakana','gi','Dakuten G','dakuten',48,NULL),
('グ','katakana','gu','Dakuten G','dakuten',49,NULL),
('ゲ','katakana','ge','Dakuten G','dakuten',50,NULL),
('ゴ','katakana','go','Dakuten G','dakuten',51,NULL),
('ザ','katakana','za','Dakuten Z','dakuten',52,NULL),
('ジ','katakana','ji','Dakuten Z','dakuten',53,NULL),
('ズ','katakana','zu','Dakuten Z','dakuten',54,NULL),
('ゼ','katakana','ze','Dakuten Z','dakuten',55,NULL),
('ゾ','katakana','zo','Dakuten Z','dakuten',56,NULL),
('ダ','katakana','da','Dakuten D','dakuten',57,NULL),
('ヂ','katakana','ji','Dakuten D','dakuten',58,NULL),
('ヅ','katakana','zu','Dakuten D','dakuten',59,NULL),
('デ','katakana','de','Dakuten D','dakuten',60,NULL),
('ド','katakana','do','Dakuten D','dakuten',61,NULL),
('バ','katakana','ba','Dakuten B','dakuten',62,NULL),
('ビ','katakana','bi','Dakuten B','dakuten',63,NULL),
('ブ','katakana','bu','Dakuten B','dakuten',64,NULL),
('ベ','katakana','be','Dakuten B','dakuten',65,NULL),
('ボ','katakana','bo','Dakuten B','dakuten',66,NULL),
-- Katakana — Handakuten
('パ','katakana','pa','Handakuten P','handakuten',67,NULL),
('ピ','katakana','pi','Handakuten P','handakuten',68,NULL),
('プ','katakana','pu','Handakuten P','handakuten',69,NULL),
('ペ','katakana','pe','Handakuten P','handakuten',70,NULL),
('ポ','katakana','po','Handakuten P','handakuten',71,NULL),
-- Katakana — Yoon
('キャ','katakana','kya','Yōon','youon',72,NULL),
('キュ','katakana','kyu','Yōon','youon',73,NULL),
('キョ','katakana','kyo','Yōon','youon',74,NULL),
('シャ','katakana','sha','Yōon','youon',75,NULL),
('シュ','katakana','shu','Yōon','youon',76,NULL),
('ショ','katakana','sho','Yōon','youon',77,NULL),
('チャ','katakana','cha','Yōon','youon',78,NULL),
('チュ','katakana','chu','Yōon','youon',79,NULL),
('チョ','katakana','cho','Yōon','youon',80,NULL),
('ニャ','katakana','nya','Yōon','youon',81,NULL),
('ニュ','katakana','nyu','Yōon','youon',82,NULL),
('ニョ','katakana','nyo','Yōon','youon',83,NULL),
('ヒャ','katakana','hya','Yōon','youon',84,NULL),
('ヒュ','katakana','hyu','Yōon','youon',85,NULL),
('ヒョ','katakana','hyo','Yōon','youon',86,NULL),
('ミャ','katakana','mya','Yōon','youon',87,NULL),
('ミュ','katakana','myu','Yōon','youon',88,NULL),
('ミョ','katakana','myo','Yōon','youon',89,NULL),
('リャ','katakana','rya','Yōon','youon',90,NULL),
('リュ','katakana','ryu','Yōon','youon',91,NULL),
('リョ','katakana','ryo','Yōon','youon',92,NULL),
('ギャ','katakana','gya','Yōon','youon',93,NULL),
('ギュ','katakana','gyu','Yōon','youon',94,NULL),
('ギョ','katakana','gyo','Yōon','youon',95,NULL),
('ジャ','katakana','ja','Yōon','youon',96,NULL),
('ジュ','katakana','ju','Yōon','youon',97,NULL),
('ジョ','katakana','jo','Yōon','youon',98,NULL),
('ビャ','katakana','bya','Yōon','youon',99,NULL),
('ビュ','katakana','byu','Yōon','youon',100,NULL),
('ビョ','katakana','byo','Yōon','youon',101,NULL),
('ピャ','katakana','pya','Yōon','youon',102,NULL),
('ピュ','katakana','pyu','Yōon','youon',103,NULL),
('ピョ','katakana','pyo','Yōon','youon',104,NULL),
-- Katakana — Khusus
('ッ','katakana','(sokuon)','Khusus','special',105,'Tsu kecil (sokuon): menggandakan konsonan, mis. ベッド "beddo".'),
('ー','katakana','(panjang)','Khusus','special',106,'Chōonpu: memanjangkan vokal sebelumnya, mis. コーヒー "kōhī".')
ON CONFLICT (kind, character) DO UPDATE SET
  romaji = EXCLUDED.romaji,
  group_label = EXCLUDED.group_label,
  variant_type = EXCLUDED.variant_type,
  sort_order = EXCLUDED.sort_order,
  mnemonic = COALESCE(EXCLUDED.mnemonic, kana_items.mnemonic),
  updated_at = NOW();

-- ============================================================================
-- SEED contoh kata (highlight menandai karakter di kalimat). Hiragana lengkap;
-- katakana contoh ikonik. reading = bacaan kana penuh.
-- ============================================================================

INSERT INTO kana_examples (kana_id, japanese, reading, highlight, indonesian, sort_order)
SELECT ki.id, e.japanese, e.reading, e.highlight, e.indonesian, 0
FROM (VALUES
  ('hiragana','あ','あめ','あめ','あ','hujan'),
  ('hiragana','い','いぬ','いぬ','い','anjing'),
  ('hiragana','う','うみ','うみ','う','laut'),
  ('hiragana','え','えき','えき','え','stasiun'),
  ('hiragana','お','おちゃ','おちゃ','お','teh'),
  ('hiragana','か','かさ','かさ','か','payung'),
  ('hiragana','き','きって','きって','き','perangko'),
  ('hiragana','く','くつ','くつ','く','sepatu'),
  ('hiragana','け','けさ','けさ','け','tadi pagi'),
  ('hiragana','こ','こども','こども','こ','anak'),
  ('hiragana','さ','さかな','さかな','さ','ikan'),
  ('hiragana','し','しお','しお','し','garam'),
  ('hiragana','す','すし','すし','す','sushi'),
  ('hiragana','せ','せんせい','せんせい','せ','guru'),
  ('hiragana','そ','そら','そら','そ','langit'),
  ('hiragana','た','たまご','たまご','た','telur'),
  ('hiragana','ち','ちず','ちず','ち','peta'),
  ('hiragana','つ','つくえ','つくえ','つ','meja'),
  ('hiragana','て','てがみ','てがみ','て','surat'),
  ('hiragana','と','とけい','とけい','と','jam'),
  ('hiragana','な','なつ','なつ','な','musim panas'),
  ('hiragana','に','にく','にく','に','daging'),
  ('hiragana','ぬ','ぬの','ぬの','ぬ','kain'),
  ('hiragana','ね','ねこ','ねこ','ね','kucing'),
  ('hiragana','の','のり','のり','の','rumput laut'),
  ('hiragana','は','はな','はな','は','bunga'),
  ('hiragana','ひ','ひと','ひと','ひ','orang'),
  ('hiragana','ふ','ふね','ふね','ふ','kapal'),
  ('hiragana','へ','へや','へや','へ','kamar'),
  ('hiragana','ほ','ほし','ほし','ほ','bintang'),
  ('hiragana','ま','まど','まど','ま','jendela'),
  ('hiragana','み','みみ','みみ','み','telinga'),
  ('hiragana','む','むし','むし','む','serangga'),
  ('hiragana','め','めがね','めがね','め','kacamata'),
  ('hiragana','も','もも','もも','も','persik'),
  ('hiragana','や','やま','やま','や','gunung'),
  ('hiragana','ゆ','ゆき','ゆき','ゆ','salju'),
  ('hiragana','よ','よる','よる','よ','malam'),
  ('hiragana','ら','さくら','さくら','ら','bunga sakura'),
  ('hiragana','り','りんご','りんご','り','apel'),
  ('hiragana','る','はる','はる','る','musim semi'),
  ('hiragana','れ','れいぞうこ','れいぞうこ','れ','kulkas'),
  ('hiragana','ろ','ろく','ろく','ろ','enam'),
  ('hiragana','わ','わたし','わたし','わ','saya'),
  ('hiragana','ん','ほん','ほん','ん','buku'),
  ('katakana','ア','アメリカ','アメリカ','ア','Amerika'),
  ('katakana','イ','イタリア','イタリア','イ','Italia'),
  ('katakana','ウ','ウール','ウール','ウ','wol'),
  ('katakana','エ','エレベーター','エレベーター','エ','lift'),
  ('katakana','オ','オレンジ','オレンジ','オ','jeruk'),
  ('katakana','カ','カメラ','カメラ','カ','kamera'),
  ('katakana','ク','クラス','クラス','ク','kelas'),
  ('katakana','コ','コーヒー','コーヒー','コ','kopi'),
  ('katakana','テ','テレビ','テレビ','テ','televisi'),
  ('katakana','ト','トマト','トマト','ト','tomat'),
  ('katakana','ノ','ノート','ノート','ノ','buku catatan'),
  ('katakana','パ','パン','パン','パ','roti'),
  ('katakana','ホ','ホテル','ホテル','ホ','hotel'),
  ('katakana','メ','メール','メール','メ','surel'),
  ('katakana','ラ','ラジオ','ラジオ','ラ','radio')
) AS e(kind, ch, japanese, reading, highlight, indonesian)
JOIN kana_items ki ON ki.kind = e.kind AND ki.character = e.ch
-- Idempotent: jangan dobel kalau migration di-apply ulang (runner sebenarnya
-- jalan sekali, tapi aman kalau di-rerun manual); tidak menyentuh contoh admin.
WHERE NOT EXISTS (
  SELECT 1 FROM kana_examples x WHERE x.kana_id = ki.id AND x.japanese = e.japanese
);

-- ============================================================================
-- SEED pelajaran kana di modul "hiragana-katakana" (course n5) + wiring item.
-- Kalau modul tak ada (mis. DB belum di-seed-n5), SELECT kosong → no-op aman.
-- ============================================================================

INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
SELECT m.id, v.slug, v.title, 'kana', v.content, v.sort_order, 15
FROM (SELECT id FROM modules
      WHERE slug = 'hiragana-katakana'
        AND course_id = (SELECT id FROM courses WHERE slug = 'n5')) m
CROSS JOIN (VALUES
  ('hiragana-1','Hiragana 1 — Vokal, K, S','Mulai dari 5 vokal lalu baris K dan S. Klik karakter untuk dengar bunyi, lihat urutan goresan, dan contoh kata.',1),
  ('hiragana-2','Hiragana 2 — T, N, H','Lanjut baris T, N, dan H. Perhatikan し·ち·つ·ふ yang bacaannya tidak beraturan.',2),
  ('hiragana-3','Hiragana 3 — M, Y, R, W, ん','Baris M, Y, R, W dan bunyi ん. Setelah ini kamu bisa baca semua hiragana dasar.',3),
  ('hiragana-4','Hiragana 4 — Dakuten & Handakuten','Tambah tanda " (dakuten) dan ° (handakuten): か→が, は→ば→ぱ.',4),
  ('hiragana-5','Hiragana 5 — Yōon & Khusus','Gabungan dengan ゃゅょ kecil (きゃ, しゃ…) dan っ kecil (sokuon).',5),
  ('katakana-1','Katakana 1 — Vokal, K, S','Katakana dipakai untuk kata serapan. Bentuk lebih bersudut dari hiragana.',6),
  ('katakana-2','Katakana 2 — T, N, H','Hati-hati pasangan mirip: シ vs ツ, ソ vs ン.',7),
  ('katakana-3','Katakana 3 — M, Y, R, W, ン','Baris M, Y, R, W dan bunyi ン.',8),
  ('katakana-4','Katakana 4 — Dakuten & Handakuten','Dakuten & handakuten katakana: カ→ガ, ハ→バ→パ.',9),
  ('katakana-5','Katakana 5 — Yōon & Khusus','Yōon (キャ, シャ…), sokuon ッ, dan tanda panjang ー (chōonpu).',10)
) AS v(slug, title, content, sort_order)
ON CONFLICT (module_id, slug) DO UPDATE SET
  title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO lesson_kana_items (lesson_id, kana_id, sort_order)
SELECT l.id, ki.id, ki.sort_order
FROM (VALUES
  ('hiragana-1','hiragana','Vokal'),  ('hiragana-1','hiragana','Baris K'),  ('hiragana-1','hiragana','Baris S'),
  ('hiragana-2','hiragana','Baris T'),('hiragana-2','hiragana','Baris N'),  ('hiragana-2','hiragana','Baris H'),
  ('hiragana-3','hiragana','Baris M'),('hiragana-3','hiragana','Baris Y'),  ('hiragana-3','hiragana','Baris R'),
  ('hiragana-3','hiragana','Baris W'),('hiragana-3','hiragana','Bunyi N'),
  ('hiragana-4','hiragana','Dakuten G'),('hiragana-4','hiragana','Dakuten Z'),('hiragana-4','hiragana','Dakuten D'),
  ('hiragana-4','hiragana','Dakuten B'),('hiragana-4','hiragana','Handakuten P'),
  ('hiragana-5','hiragana','Yōon'),   ('hiragana-5','hiragana','Khusus'),
  ('katakana-1','katakana','Vokal'),  ('katakana-1','katakana','Baris K'),  ('katakana-1','katakana','Baris S'),
  ('katakana-2','katakana','Baris T'),('katakana-2','katakana','Baris N'),  ('katakana-2','katakana','Baris H'),
  ('katakana-3','katakana','Baris M'),('katakana-3','katakana','Baris Y'),  ('katakana-3','katakana','Baris R'),
  ('katakana-3','katakana','Baris W'),('katakana-3','katakana','Bunyi N'),
  ('katakana-4','katakana','Dakuten G'),('katakana-4','katakana','Dakuten Z'),('katakana-4','katakana','Dakuten D'),
  ('katakana-4','katakana','Dakuten B'),('katakana-4','katakana','Handakuten P'),
  ('katakana-5','katakana','Yōon'),   ('katakana-5','katakana','Khusus')
) AS map(lesson_slug, kind, grp)
JOIN lessons l ON l.slug = map.lesson_slug
  AND l.module_id = (SELECT id FROM modules
                     WHERE slug = 'hiragana-katakana'
                       AND course_id = (SELECT id FROM courses WHERE slug = 'n5'))
JOIN kana_items ki ON ki.kind = map.kind AND ki.group_label = map.grp
ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
