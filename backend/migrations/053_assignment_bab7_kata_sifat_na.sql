-- 053_assignment_bab7_kata_sifat_na.sql — Assignment Bab 7: Kata Sifat (な).
--
-- Ujian bab untuk Bab 7, sumber Notion N5-B7 "Mendeskripsikan (な)". Modul
-- di-resolve ordinal (OFFSET 6, lanjutan pola 039-047/051).
--
-- KANJI: hanya 3 kanji baru resmi Bab 7 — 男安古... koreksi: 男女気
-- (dikonfirmasi dari kanji_items production DAN Notion Kanji DB "First
-- Lesson"). Karena cuma 3 kanji baru (jauh lebih sedikit dari Bab 6 yang
-- 6), もんだい1/2 dipadatkan dengan kombinasi kanji taught (男/女/気 + 28
-- kanji Bab3-6) yang BELUM pernah jadi target di 042/045/047/051 — bukan
-- kata bank Notion langsung, tapi kombinasi valid & lazim (男の人, 人気,
-- 気分, dst), sama strategi dengan 051's 二年生/百人/五百円.
-- Kanji whitelist badan kalimat = union: 先何語校国生学名人 (9, Bab3) +
-- 魚本花 (3, Bab4) + 八三十九一五四二六七 (10, Bab5) + 安高古新白長 (6, Bab6)
-- + 男女気 (3, Bab7) + 時分円百千万年月半歳午前後 (13, counter Bab5).
--
-- REF_CHECK bacaan (sumber kebenaran tunggal, sama metodologi dgn 047/051):
--   男＝おとこ   女＝おんな   男の人＝おとこのひと   女の人＝おんなのひと
--   男女＝だんじょ   人気＝にんき   気分＝きぶん
--   十時＝じゅうじ (beraturan)   一時＝いちじ (beraturan)
--   四人＝よにん (TIDAK BERATURAN, pola sama dgn 四時＝よじ)
--   三人＝さんにん   五人＝ごにん   六人＝ろくにん   八人＝はちにん
--   九人＝きゅうにん   十人＝じゅうにん (semua beraturan)
--   四年生＝よねんせい (TIDAK BERATURAN, pola よ- sama dgn 四人/四時)
--   五年生＝ごねんせい (beraturan)
--
-- KATA SIFAT な: 19 kosakata な-adjektiva resmi Bab 7 dari Vocabulary DB
-- (filter Lesson=Bab7) — sah dipakai bebas: げんき/しずか/にぎやか/ひま/
-- ゆうめい/べんり/ふべん/きれい/だいじょうぶ/おなじ/きけん/あんぜん/まじめ/
-- すてき/しんせつ dipakai di §3/§4. きらい／すき／じょうず／へた SENGAJA
-- TIDAK dipakai sebagai vocab §3 — keempatnya secara gramatikal wajib
-- partikel が (〜が好き／嫌い／上手／下手), dan catatan Notion pola grammar
-- itu eksplisit "TEASER ONLY, jangan ajarkan semua varian di B7" — cukup
-- diuji sebagai SATU pola grammar minimal di §4 (lihat di bawah), bukan
-- sebagai vocab section penuh.
--
-- PARTIKEL & PENGHUBUNG が／で (BACA INI SEBELUM UBAH PAGAR): whitelist
-- partikel teks-soal TETAP は/も/の/か/ね/よ/から/まで seperti 047/051 —
-- TIDAK diperluas. が (pola 6, teaser 好き) dan で (pola 4, penghubung
-- な-adj/noun) sengaja HANYA muncul sebagai KUNCI JAWABAN tersembunyi di
-- balik （　）, tidak pernah tertulis eksplisit di teks soal yang dibaca
-- siswa (assertion pagar di bawah cuma scan kolom `question`, bukan
-- `quiz_options`) — jadi pagar existing TIDAK perlu diubah. Distraktor
-- untuk soal-soal ini tetap dijaga dari partikel taught (は/も/の/だ/な/
-- くて), TIDAK memakai を/に/へ/と yang juga belum diajarkan, supaya
-- opsi salah pun tidak diam-diam mengajarkan partikel yang belum waktunya.
--
-- DEDUP WAJIB (pola established sejak 047): tidak boleh menguji ulang
-- target <u> yang sudah dipakai di 042 (Bab 3) / 045 (Bab 4) / 047 (Bab 5)
-- / 051 (Bab 6). Sudah di-grep ULANG dari file migrasi sungguhan di repo —
-- 60 target unik, assertion di bawah membuktikan machine-checked.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 = pool 50, sample 30 per attempt, lulus 70%,
-- cooldown 12 jam — seimbang seperti assignment Bab 3/4/5/6.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) cuma
-- menjalankan file ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus
-- lalu di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-7-kata-sifat-na';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 6 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '053: modul Bab 7 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(sifat|adjective|adjektiva|deskripsi)' THEN
    RAISE NOTICE '053: modul Bab 7 terbaca "%" — kalau ternyata bukan Bab Kata Sifat (な), pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '053: seed Assignment Bab 7 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 7 — Kata Sifat (な)', 'quiz',
    'Tes materi Bab 7 (Kata Sifat な) gaya JLPT. Moji-Goi: cara baca 3 kanji baru (男／女／気) dan kombinasinya, cara menulisnya, serta kosakata kata sifat な sesuai konteks. Tata Bahasa: bentuk です／じゃありません, kata sifat な menerangkan kata benda (wajib な), penghubung くて／で, bentuk lampau でした／じゃありませんでした, dan pengenalan singkat 〜が好きです. Tiap attempt mengambil 30 soal acak dari 50. Lulus 70% (21/30), cooldown 12 jam.',
    25, 100, 70, 30, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes,
    passing_score_pct = EXCLUDED.passing_score_pct,
    questions_per_attempt = EXCLUDED.questions_per_attempt,
    cooldown_hours = EXCLUDED.cooldown_hours,
    updated_at = NOW()
  RETURNING id INTO v_lesson_id;

  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(cat, num, label, instruction) AS (VALUES
    ('vocabulary'::TEXT, 1, 'もんだい1 漢字読み',
        'Bagaimana cara membaca kata yang bergaris bawah? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 2, 'もんだい2 表記',
        'Kata yang bergaris bawah ditulis dengan huruf apa? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 3, 'もんだい3 文脈規定',
        'Kata apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.'),
    ('grammar', 1, 'もんだい1 文の文法1',
        'Kata atau partikel apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.')
  ), q(no, cat, sect_num, question, explanation) AS (VALUES
    -- ===== もんだい1 漢字読み (1-9) — 3 kanji inti Bab 7 + kombinasi =====
    (1, 'vocabulary'::TEXT, 1, 'あの ひとは <u>男</u>です。',
        '男 dibaca おとこ (pria/laki-laki). Onyomi ダン/ナン dipakai di kata gabungan seperti 男女 (だんじょ), bukan saat berdiri sendiri sebagai kata benda seperti di sini.'),
    (2, 'vocabulary', 1, 'あの ひとは <u>女</u>です。',
        '女 dibaca おんな (wanita/perempuan). Onyomi ジョ/ニョ dipakai di kata gabungan, bukan saat berdiri sendiri seperti di sini.'),
    (3, 'vocabulary', 1, '<u>男の人</u>は せんせいです。',
        '男の人 dibaca おとこのひと (pria itu/orang laki-laki). 男 (おとこ) + の + 人 (ひと) — gabungan langsung, bukan onyomi.'),
    (4, 'vocabulary', 1, '<u>女の人</u>は がくせいです。',
        '女の人 dibaca おんなのひと (wanita itu/orang perempuan). 女 (おんな) + の + 人 (ひと).'),
    (5, 'vocabulary', 1, 'これは <u>男女</u>の もんだいです。',
        '男女 dibaca だんじょ (laki-laki dan perempuan, kata gabungan formal) — memakai onyomi kedua kanji (ダン+ジョ), beda dari おとこおんな yang bukan bacaan yang lazim untuk kata gabungan ini.'),
    (6, 'vocabulary', 1, 'この みせは <u>人気</u>です。',
        '人気 dibaca にんき (populer/terkenal) — 人 dibaca ニン (bukan じん) saat digabung dengan 気 di kata ini.'),
    (7, 'vocabulary', 1, 'きょうの <u>気分</u>は いいです。',
        '気分 dibaca きぶん (mood/perasaan) — 気 (キ) + 分 (ぶん, berubah dari ふん).'),
    (8, 'vocabulary', 1, 'いま <u>十時</u>です。',
        '十時 dibaca じゅうじ — bacaan biasa/beraturan.'),
    (9, 'vocabulary', 1, 'いま <u>一時</u>です。',
        '一時 dibaca いちじ — bacaan biasa/beraturan.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'かぞくは <u>よにん</u>です。',
        'よにん ditulis 四人 (empat orang) — bacaan TIDAK beraturan, 四 dibaca よ (bukan よん) saat digabung dengan 人, pola sama dengan 四時＝よじ. Salah: 三人 (さんにん), 五人 (ごにん), 八人 (はちにん) — semuanya angka berbeda.'),
    (11, 'vocabulary', 2, 'この クラスは <u>さんにん</u>です。',
        'さんにん ditulis 三人 (tiga orang) — bacaan beraturan. Salah: 四人 (よにん), 六人 (ろくにん), 十人 (じゅうにん) — semuanya angka berbeda.'),
    (12, 'vocabulary', 2, 'あの グループは <u>ごにん</u>です。',
        'ごにん ditulis 五人 (lima orang) — bacaan beraturan. Salah: 四人, 六人, 九人 — semuanya angka berbeda.'),
    (13, 'vocabulary', 2, 'この チームは <u>ろくにん</u>です。',
        'ろくにん ditulis 六人 (enam orang) — bacaan beraturan (beda dari 六時＝ろくじ yang juga beraturan tapi digabung 時, bukan 人). Salah: 三人, 五人, 八人 — semuanya angka berbeda.'),
    (14, 'vocabulary', 2, 'あの かぞくは <u>はちにん</u>です。',
        'はちにん ditulis 八人 (delapan orang) — bacaan beraturan. Salah: 四人, 六人, 九人 — semuanya angka berbeda.'),
    (15, 'vocabulary', 2, 'この クラブは <u>きゅうにん</u>です。',
        'きゅうにん ditulis 九人 (sembilan orang) — bacaan beraturan. Salah: 四人, 八人, 十人 — semuanya angka berbeda.'),
    (16, 'vocabulary', 2, 'あの きょうしつは <u>じゅうにん</u>です。',
        'じゅうにん ditulis 十人 (sepuluh orang) — bacaan beraturan. Salah: 九人, 八人, 六人 — semuanya angka berbeda.'),
    (17, 'vocabulary', 2, 'あには <u>よねんせい</u>です。',
        'よねんせい ditulis 四年生 (siswa tahun ke-4) — bacaan TIDAK beraturan, 四 dibaca よ (bukan よん), pola sama dengan よにん/よじ. Salah: 五年生 (ごねんせい), 三年生 (さんねんせい), 四月生 (bulan, bukan tahun).'),
    (18, 'vocabulary', 2, 'あねは <u>ごねんせい</u>です。',
        'ごねんせい ditulis 五年生 (siswa tahun ke-5) — bacaan beraturan. Salah: 四年生 (よねんせい), 二年生 (にねんせい), 五月生 (bulan, bukan tahun).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata kata sifat な, 100% kana =====
    (19, 'vocabulary', 3, 'としょかんは（　）です。',
        'Jawabannya しずか (tenang). にぎやか berarti ramai (kebalikan), きけん berarti bahaya, べんり berarti praktis — ketiganya tidak cocok untuk perpustakaan.'),
    (20, 'vocabulary', 3, 'まつりは（　）です。',
        'Jawabannya にぎやか (ramai/meriah). しずか berarti tenang (kebalikan), きけん berarti bahaya, あんぜん berarti aman — ketiganya tidak cocok untuk suasana festival.'),
    (21, 'vocabulary', 3, 'きょうは（　）です。',
        'Jawabannya ひま (luang/tidak sibuk). げんき berarti sehat, まじめ berarti rajin, しんせつ berarti baik hati — ketiganya tidak cocok untuk menyatakan waktu luang.'),
    (22, 'vocabulary', 3, 'あの せんせいは（　）です。',
        'Jawabannya しんせつ (baik hati/ramah). まじめ berarti rajin (masih mungkin tapi kurang tepat), きけん berarti bahaya, ふべん berarti tidak praktis — ketiganya tidak cocok untuk menilai sifat orang yang baik.'),
    (23, 'vocabulary', 3, 'この コンピューターは（　）です。',
        'Jawabannya べんり (praktis/berguna). ふべん berarti tidak praktis (kebalikan), きけん berarti bahaya, あんぜん berarti aman — ketiganya tidak cocok untuk menilai kegunaan benda.'),
    (24, 'vocabulary', 3, 'この みちは（　）です。',
        'Jawabannya きけん (berbahaya). あんぜん berarti aman (kebalikan), べんり berarti praktis, ふべん berarti tidak praktis — ketiganya tidak cocok untuk menilai bahaya.'),
    (25, 'vocabulary', 3, 'この こうえんは（　）です。',
        'Jawabannya あんぜん (aman). きけん berarti bahaya (kebalikan), ふべん berarti tidak praktis, べんり berarti praktis — ketiganya tidak cocok untuk menilai keamanan.'),
    (26, 'vocabulary', 3, 'あの ひとは（　）です。',
        'Jawabannya ゆうめい (terkenal). げんき berarti sehat, まじめ berarti rajin, すてき berarti bagus/keren — ketiganya tidak secara langsung berarti "dikenal banyak orang".'),
    (27, 'vocabulary', 3, 'この へやは（　）です。',
        'Jawabannya きれい (bersih/cantik). だいじょうぶ berarti tidak apa-apa, ふべん berarti tidak praktis, きけん berarti bahaya — ketiganya tidak cocok untuk menilai kebersihan ruangan.'),
    (28, 'vocabulary', 3, 'たなかさんは（　）です。',
        'Jawabannya げんき (sehat/bersemangat) — sapaan umum menanyakan kabar. ひま berarti luang, まじめ berarti rajin, すてき berarti bagus — ketiganya kurang cocok sebagai jawaban kabar seseorang.'),
    (29, 'vocabulary', 3, 'この こたえは（　）です。',
        'Jawabannya おなじ (sama). べんり berarti praktis, きけん berarti bahaya, まじめ berarti rajin — ketiganya tidak berarti "sama/identik".'),
    (30, 'vocabulary', 3, 'あの ふくは（　）です。',
        'Jawabannya すてき (bagus/keren). きれい juga bisa cocok tapi すてき lebih menekankan kesan modis, ゆうめい berarti terkenal, まじめ berarti rajin — keduanya tidak cocok untuk menilai pakaian.'),

    -- ===== もんだい1 文の文法1 (31-50) — 6 pola grammar Bab 7 =====
    (31, 'grammar'::TEXT, 1, 'この へやは しずか（　）。',
        'Jawabannya です — kata sifat な kehilangan な lalu langsung diikuti です, tidak butuh だ. だ salah karena tidak diperlukan setelah kata sifat な + です, でした mengubah jadi lampau (tidak sesuai konteks kini), じゃありません mengubah jadi negatif (tidak sesuai konteks afirmatif).'),
    (32, 'grammar', 1, 'あの がくせいは まじめ（　）。',
        'Jawabannya です, sama seperti 〜は[な-adj]です. だ, でした, dan じゃありません tidak cocok untuk kalimat afirmatif bentuk kini ini.'),
    (33, 'grammar', 1, 'この カメラは べんり（　）。',
        'Jawabannya です. だ, でした, dan じゃありません tidak cocok di sini.'),
    (34, 'grammar', 1, 'その ふくは すてき（　）。',
        'Jawabannya です. だ, でした, dan じゃありません tidak cocok di sini.'),
    (35, 'grammar', 1, 'この みちは あんぜん（　）。',
        'Jawabannya じゃありません — bentuk negatif kata sifat な (kasual, paling umum dipakai). くない adalah bentuk negatif kata sifat い (kesalahan umum kalau dipakai untuk kata sifat な), だ dan でした tidak cocok untuk kalimat negatif bentuk kini.'),
    (36, 'grammar', 1, 'あの みせは ゆうめい（　）。',
        'Jawabannya じゃありません, sama seperti [な-adj]じゃありません. くない, だ, dan でした tidak cocok di sini.'),
    (37, 'grammar', 1, 'この どうぐは べんり（　）。',
        'Jawabannya じゃありません. くない, だ, dan でした tidak cocok di sini.'),
    (38, 'grammar', 1, 'きょうは ひま（　）。',
        'Jawabannya じゃありません. くない, だ, dan でした tidak cocok di sini.'),
    (39, 'grammar', 1, 'あれは（　）へやです。',
        'Jawabannya しずかな — kata sifat な WAJIB disisipi な sebelum kata benda. しずか saja (tanpa な) salah karena kata sifat な tidak bisa langsung menempel ke kata benda (beda dari kata sifat い), しずかの salah karena bukan の, しずかで adalah bentuk penghubung yang tidak cocok di sini.'),
    (40, 'grammar', 1, 'これは（　）どうぐです。',
        'Jawabannya べんりな, sama seperti [な-adj]+な+名詞. べんり saja, べんりの, dan べんりで tidak cocok di sini.'),
    (41, 'grammar', 1, 'あの ひとは（　）せんせいです。',
        'Jawabannya しんせつな. しんせつ saja, しんせつの, dan しんせつで tidak cocok di sini.'),
    (42, 'grammar', 1, 'これは（　）まちです。',
        'Jawabannya にぎやかな. にぎやか saja, にぎやかの, dan にぎやかで tidak cocok di sini.'),
    (43, 'grammar', 1, 'この へやは しずか（　）きれいです。',
        'Jawabannya で — menyambung kata sifat な しずか dengan kata sifat な きれい yang sepolaritas (sama-sama positif), memakai で (bukan くて yang khusus kata sifat い). な dan だ salah karena bukan bentuk penghubung, くて salah karena itu bentuk penghubung kata sifat い.'),
    (44, 'grammar', 1, 'この まちは にぎやか（　）ゆうめいです。',
        'Jawabannya で, sama seperti pola sebelumnya — menyambung dua kata sifat な. な, くて, dan だ tidak cocok di sini.'),
    (45, 'grammar', 1, 'まつりは たのしく（　）にぎやかです。',
        'Jawabannya て — kata sifat い たのしい berubah jadi たのしくて untuk menyambung ke kata sifat な にぎやかです. で salah karena itu bentuk penghubung kata sifat な/kata benda, bukan kata sifat い, な dan だ tidak cocok untuk bentuk penghubung.'),
    (46, 'grammar', 1, 'きのうは げんき（　）。',
        'Jawabannya でした — bentuk lampau afirmatif kata sifat な (げんき → げんきでした). です adalah bentuk kini (tidak sesuai konteks きのう), くなかった adalah pola kata sifat い (kesalahan umum kalau dipakai untuk kata sifat な), じゃありませんでした adalah bentuk lampau negatif (kebalikan makna).'),
    (47, 'grammar', 1, 'せんしゅうは ひま（　）。',
        'Jawabannya でした, sama seperti pola sebelumnya. です, くなかった, dan じゃありませんでした tidak cocok di sini.'),
    (48, 'grammar', 1, 'きょねんは この まちは あんぜん（　）。',
        'Jawabannya じゃありませんでした — bentuk lampau negatif kata sifat な. でした adalah bentuk lampau afirmatif (kebalikan makna), くなかった adalah pola kata sifat い, です adalah bentuk kini.'),
    (49, 'grammar', 1, 'すし（　）すきです。',
        'Jawabannya が — partikel が menandai objek yang disukai pada pola な-adj khusus 〜が好きです. は sering jadi kesalahan umum (menandai topik, bukan objek yang disukai), も berarti "juga", の menyatakan kepemilikan — ketiganya tidak cocok di sini.'),
    (50, 'grammar', 1, 'にほんご（　）すきです。',
        'Jawabannya が, sama seperti pola sebelumnya — menandai objek yang disukai. は, も, dan の tidak cocok di sini.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', q.cat,
         s.num, s.label, s.instruction, q.explanation, q.no
    FROM q JOIN sect s ON s.cat = q.cat AND s.num = q.sect_num;

  -- Opsi: baris pertama tiap soal = jawaban benar; urutan tampil diacak
  -- frontend tiap attempt (transformQuestionFromApi).
  WITH o(qno, ord, option_text, ok) AS (VALUES
    -- 漢字読み — opsi hiragana murni
    (1, 0, 'おとこ', TRUE),   (1, 1, 'だん', FALSE),      (1, 2, 'なん', FALSE),      (1, 3, 'おとご', FALSE),
    (2, 0, 'おんな', TRUE),   (2, 1, 'じょ', FALSE),      (2, 2, 'にょ', FALSE),      (2, 3, 'おんあ', FALSE),
    (3, 0, 'おとこのひと', TRUE), (3, 1, 'だんのひと', FALSE), (3, 2, 'おとこのじん', FALSE), (3, 3, 'なんのひと', FALSE),
    (4, 0, 'おんなのひと', TRUE), (4, 1, 'じょのひと', FALSE), (4, 2, 'おんなのじん', FALSE), (4, 3, 'にょのひと', FALSE),
    (5, 0, 'だんじょ', TRUE), (5, 1, 'おとこおんな', FALSE), (5, 2, 'なんにょ', FALSE),   (5, 3, 'だんにょ', FALSE),
    (6, 0, 'にんき', TRUE),   (6, 1, 'じんき', FALSE),     (6, 2, 'ひとけ', FALSE),     (6, 3, 'にんけ', FALSE),
    (7, 0, 'きぶん', TRUE),   (7, 1, 'きふん', FALSE),     (7, 2, 'けぶん', FALSE),     (7, 3, 'きぷん', FALSE),
    (8, 0, 'じゅうじ', TRUE), (8, 1, 'とおじ', FALSE),     (8, 2, 'じゅうとき', FALSE), (8, 3, 'じゅじ', FALSE),
    (9, 0, 'いちじ', TRUE),   (9, 1, 'ひとじ', FALSE),     (9, 2, 'いちとき', FALSE),   (9, 3, 'いつじ', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '四人', TRUE),  (10, 1, '三人', FALSE), (10, 2, '五人', FALSE), (10, 3, '八人', FALSE),
    (11, 0, '三人', TRUE),  (11, 1, '四人', FALSE), (11, 2, '六人', FALSE), (11, 3, '十人', FALSE),
    (12, 0, '五人', TRUE),  (12, 1, '四人', FALSE), (12, 2, '六人', FALSE), (12, 3, '九人', FALSE),
    (13, 0, '六人', TRUE),  (13, 1, '三人', FALSE), (13, 2, '五人', FALSE), (13, 3, '八人', FALSE),
    (14, 0, '八人', TRUE),  (14, 1, '四人', FALSE), (14, 2, '六人', FALSE), (14, 3, '九人', FALSE),
    (15, 0, '九人', TRUE),  (15, 1, '四人', FALSE), (15, 2, '八人', FALSE), (15, 3, '十人', FALSE),
    (16, 0, '十人', TRUE),  (16, 1, '九人', FALSE), (16, 2, '八人', FALSE), (16, 3, '六人', FALSE),
    (17, 0, '四年生', TRUE),(17, 1, '五年生', FALSE),(17, 2, '三年生', FALSE),(17, 3, '四月生', FALSE),
    (18, 0, '五年生', TRUE),(18, 1, '四年生', FALSE),(18, 2, '二年生', FALSE),(18, 3, '五月生', FALSE),

    -- 文脈規定
    (19, 0, 'しずか', TRUE),   (19, 1, 'にぎやか', FALSE), (19, 2, 'きけん', FALSE),   (19, 3, 'べんり', FALSE),
    (20, 0, 'にぎやか', TRUE), (20, 1, 'しずか', FALSE),   (20, 2, 'きけん', FALSE),   (20, 3, 'あんぜん', FALSE),
    (21, 0, 'ひま', TRUE),     (21, 1, 'げんき', FALSE),   (21, 2, 'まじめ', FALSE),   (21, 3, 'しんせつ', FALSE),
    (22, 0, 'しんせつ', TRUE), (22, 1, 'まじめ', FALSE),   (22, 2, 'きけん', FALSE),   (22, 3, 'ふべん', FALSE),
    (23, 0, 'べんり', TRUE),   (23, 1, 'ふべん', FALSE),   (23, 2, 'きけん', FALSE),   (23, 3, 'あんぜん', FALSE),
    (24, 0, 'きけん', TRUE),   (24, 1, 'あんぜん', FALSE), (24, 2, 'べんり', FALSE),   (24, 3, 'ふべん', FALSE),
    (25, 0, 'あんぜん', TRUE), (25, 1, 'きけん', FALSE),   (25, 2, 'ふべん', FALSE),   (25, 3, 'べんり', FALSE),
    (26, 0, 'ゆうめい', TRUE), (26, 1, 'げんき', FALSE),   (26, 2, 'まじめ', FALSE),   (26, 3, 'すてき', FALSE),
    (27, 0, 'きれい', TRUE),   (27, 1, 'だいじょうぶ', FALSE), (27, 2, 'ふべん', FALSE), (27, 3, 'きけん', FALSE),
    (28, 0, 'げんき', TRUE),   (28, 1, 'ひま', FALSE),     (28, 2, 'まじめ', FALSE),   (28, 3, 'すてき', FALSE),
    (29, 0, 'おなじ', TRUE),   (29, 1, 'べんり', FALSE),   (29, 2, 'きけん', FALSE),   (29, 3, 'まじめ', FALSE),
    (30, 0, 'すてき', TRUE),   (30, 1, 'きれい', FALSE),   (30, 2, 'ゆうめい', FALSE), (30, 3, 'まじめ', FALSE),

    -- 文の文法1
    (31, 0, 'です', TRUE), (31, 1, 'だ', FALSE), (31, 2, 'でした', FALSE), (31, 3, 'じゃありません', FALSE),
    (32, 0, 'です', TRUE), (32, 1, 'だ', FALSE), (32, 2, 'でした', FALSE), (32, 3, 'じゃありません', FALSE),
    (33, 0, 'です', TRUE), (33, 1, 'だ', FALSE), (33, 2, 'でした', FALSE), (33, 3, 'じゃありません', FALSE),
    (34, 0, 'です', TRUE), (34, 1, 'だ', FALSE), (34, 2, 'でした', FALSE), (34, 3, 'じゃありません', FALSE),
    (35, 0, 'じゃありません', TRUE), (35, 1, 'くない', FALSE), (35, 2, 'だ', FALSE), (35, 3, 'でした', FALSE),
    (36, 0, 'じゃありません', TRUE), (36, 1, 'くない', FALSE), (36, 2, 'だ', FALSE), (36, 3, 'でした', FALSE),
    (37, 0, 'じゃありません', TRUE), (37, 1, 'くない', FALSE), (37, 2, 'だ', FALSE), (37, 3, 'でした', FALSE),
    (38, 0, 'じゃありません', TRUE), (38, 1, 'くない', FALSE), (38, 2, 'だ', FALSE), (38, 3, 'でした', FALSE),
    (39, 0, 'しずかな', TRUE), (39, 1, 'しずか', FALSE), (39, 2, 'しずかの', FALSE), (39, 3, 'しずかで', FALSE),
    (40, 0, 'べんりな', TRUE), (40, 1, 'べんり', FALSE), (40, 2, 'べんりの', FALSE), (40, 3, 'べんりで', FALSE),
    (41, 0, 'しんせつな', TRUE), (41, 1, 'しんせつ', FALSE), (41, 2, 'しんせつの', FALSE), (41, 3, 'しんせつで', FALSE),
    (42, 0, 'にぎやかな', TRUE), (42, 1, 'にぎやか', FALSE), (42, 2, 'にぎやかの', FALSE), (42, 3, 'にぎやかで', FALSE),
    (43, 0, 'で', TRUE), (43, 1, 'な', FALSE), (43, 2, 'くて', FALSE), (43, 3, 'だ', FALSE),
    (44, 0, 'で', TRUE), (44, 1, 'な', FALSE), (44, 2, 'くて', FALSE), (44, 3, 'だ', FALSE),
    (45, 0, 'て', TRUE), (45, 1, 'で', FALSE), (45, 2, 'な', FALSE), (45, 3, 'だ', FALSE),
    (46, 0, 'でした', TRUE), (46, 1, 'です', FALSE), (46, 2, 'くなかった', FALSE), (46, 3, 'じゃありませんでした', FALSE),
    (47, 0, 'でした', TRUE), (47, 1, 'です', FALSE), (47, 2, 'くなかった', FALSE), (47, 3, 'じゃありませんでした', FALSE),
    (48, 0, 'じゃありませんでした', TRUE), (48, 1, 'でした', FALSE), (48, 2, 'くなかった', FALSE), (48, 3, 'です', FALSE),
    (49, 0, 'が', TRUE), (49, 1, 'は', FALSE), (49, 2, 'も', FALSE), (49, 3, 'の', FALSE),
    (50, 0, 'が', TRUE), (50, 1, 'は', FALSE), (50, 2, 'も', FALSE), (50, 3, 'の', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '053: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '053: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 9 Bab3 + 3 Bab4 + 10 Bab5 + 6 Bab6 + 3 Bab7 + 13 counter Bab5.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気時分円百千万年月半歳午前後]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '053: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel di luar Bab 1-7 (が/を/で/へ/に/と) pada TEKS SOAL yang
  --    terlihat siswa. が (pola 好き) dan で (pola penghubung な-adj) hanya
  --    muncul sebagai kunci jawaban tersembunyi di balik （　）, tidak
  --    pernah tertulis eksplisit di teks soal — jadi pagar ini TETAP ketat
  --    (tidak diperlonggar) dan seharusnya tetap lolos.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(が |を |で |へ |に |と )'
  ) THEN
    RAISE EXCEPTION '053: ada partikel di luar materi Bab 1-7 pada teks soal';
  END IF;

  -- 3. Kata kerja masih dilarang total (termasuk あります／います).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(question,
             'そうじゃありません', ''), 'じゃありません', ''), 'ありません', ''),
             'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''),
             'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '053: ada indikasi kata kerja pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '053: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '053: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '053: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 60
  --    target unik yang sudah dipakai di 042 (Bab 3) / 045 (Bab 4) /
  --    047 (Bab 5) / 051 (Bab 6).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いんど','がくせい','がっこう','くに','さかな','せんせい','たい','なに',
         'はな','ひと','べとなむ','ほん','中国','何人','先生','名前','国',
         '大学生','学校','学生','日本','日本人','日本語','本','留学生','花',
         '韓国人','高校','魚',
         'ごご','ごじ','ごぜん','じゅうにじ','せんえん','なんじ','はちじ',
         'はん','まんえん','一人','一分','七分','三百円','九時','二人',
         '二十歳','八百円','六分','六百円','十分','四時',
         'きゅうひゃくえん','ごひゃくえん','さんねんせい','せんにん',
         'ななひゃくえん','なんねん','にねんせい','にひゃくえん','ひゃくにん',
         '三時','二時','六時','古い','安い','新しい','白い','長い','高い'
       ])
  ) THEN
    RAISE EXCEPTION '053: ada target <u> yang sudah pernah diujikan di migration 042/045/047/051';
  END IF;

  RAISE NOTICE '053: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
