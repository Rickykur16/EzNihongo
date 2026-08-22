-- 051_assignment_bab6_kata_sifat.sql — Assignment Bab 6: Kata Sifat (い).
--
-- Ujian bab untuk Bab 6, sumber Notion N5-B6 "Mendeskripsikan (い)". Modul
-- di-resolve ordinal (OFFSET 5, lanjutan pola 039-047; dikonfirmasi lewat
-- job log deploy production: modul ke-6 kursus n5 memang "BAB 6 : Kata
-- Sifat (い)" — bukan lagi asumsi seperti migrasi-migrasi sebelumnya).
--
-- KANJI: 6 kanji baru resmi Bab 6 — 高安新古長白 (dikonfirmasi dari
-- kanji_items production DAN Notion Kanji DB "First Lesson", keduanya
-- cocok). Bacaan (REF_CHECK, sumber kebenaran tunggal — sama metodologi
-- dengan tabel jam/menit di 047):
--   高い＝たかい (tinggi/mahal)   安い＝やすい (murah/aman)
--   新しい＝あたらしい (baru)     古い＝ふるい (lama/kuno)
--   長い＝ながい (panjang)        白い＝しろい (putih)
-- Kanji whitelist badan kalimat = union: 先何語校国生学名人 (9, Bab3) +
-- 魚本花 (3, Bab4) + 八三十九一五四二六七 (10, Bab5) + 安高古新白長 (6, Bab6)
-- + 時分円百千万年月半歳午前後 (13, counter Bab5 yang taught).
--
-- CATATAN 高い／安い: kedua kata ADA di Vocabulary DB Notion tapi di-tag ke
-- Lesson Bab 5 (konteks harga, konsisten dgn 046/047), BUKAN ke Bab 6 —
-- walau kanji 高／安 resmi "first introduced" di Bab 6 (kontradiksi kecil
-- yang sudah ada di data Notion sendiri, bukan salah tafsir migrasi ini).
-- Karena keduanya TIDAK PERNAH dipakai sebagai target <u> di migration 047
-- (sudah di-grep ulang, tidak ada di daftar dedup), keduanya tetap sah
-- dipakai sebagai target BARU di sini — aturan dedup yang dipegang adalah
-- "belum pernah jadi target <u>", bukan "belum pernah disinggung sama
-- sekali di kurikulum".
--
-- KATA SIFAT: Bab 6 mengajarkan 23 kata sifat い (dari Vocabulary DB,
-- filter Lesson=Bab6) — SEMUANYA sah dipakai bebas di badan kalimat/opsi,
-- beda dari 042/045/047 yang justru MELARANG kata sifat i (karena saat itu
-- belum diajarkan). Kata sifat な dan kata sifat lain di luar 23 ini
-- (materi Bab 7+) tetap tidak dipakai — dijaga manual lewat kurasi kosakata
-- di bawah, bukan lewat blocklist regex (blocklist 042/045/047 jadi usang
-- begitu adjektiva itu sendiri jadi materi resmi Bab 6).
--
-- GRAMMAR: 6 pola Bab 6 (GRM-26..30, GRM-224 — sudah live di module_grammar
-- via migration 048, di-query by pattern text, TIDAK di-insert ulang):
--   1. 〜は[い-adj]です          4. とても／あまり
--   2. 〜は[い-adj]くないです    5. 〜はどうですか
--   3. [い-adj]+ 名詞            6. 〜かったです／〜くなかったです
-- Aturan gramatikal pola 4 (WAJIB, assertion SQL): あまり cuma sah dipakai
-- bersama bentuk negatif (くない／くなかった) dalam kalimat yang sama.
--
-- PARTIKEL: masih dibatasi is/mo/no/ka/ne/yo/kara/made persis seperti 047
-- (は/も/の/か/ね/よ/から/まで) — Bab 6 tidak menambah partikel baru,
-- termasuk が/を/で/へ/に/と TETAP dilarang. Ini membatasi konstruksi
-- "X が [kata benda] おおいです" (X banyak) yang lazim dipakai untuk cuaca
-- — makanya §3 di bawah fokus ke pola は+です (deskripsi langsung), BUKAN
-- pola ada/banyak yang butuh partikel が.
--
-- DEDUP WAJIB (pola ketat sudah established sejak 047): tidak boleh
-- menguji ulang target <u> yang sudah dipakai di 042 (Bab 3) / 045 (Bab 4)
-- / 047 (Bab 5). Sudah di-grep ULANG dari file migrasi sungguhan di repo
-- (bukan dari memori sesi lama) — 42 target unik, assertion di bawah
-- membuktikan machine-checked, bukan cuma "kelihatannya beda". Karena
-- topik Bab 6 (kata sifat/cuaca) beda total dari topik 042/045/047, dan
-- kata waktu/uang review (三時/二時/六時 dst) sengaja dipilih yang BELUM
-- pernah jadi target di 047 (047 menguji 四時/九時/ごじ/はちじ/じゅうにじ/
-- なんじ, bukan 三時/二時/六時), tabrakan otomatis nol.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 = pool 50, sample 30 per attempt, lulus 70%,
-- cooldown 12 jam — seimbang seperti assignment Bab 3/4/5.
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
  v_lesson_slug  TEXT := 'assignment-bab-6-kata-sifat';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 5 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '051: modul Bab 6 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(sifat|adjective|adjektiva|deskripsi)' THEN
    RAISE NOTICE '051: modul Bab 6 terbaca "%" — kalau ternyata bukan Bab Kata Sifat (い), pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '051: seed Assignment Bab 6 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 6 — Kata Sifat (い)', 'quiz',
    'Tes materi Bab 6 (Kata Sifat い) gaya JLPT. Moji-Goi: cara baca 6 kanji baru (高い／安い／新しい／古い／長い／白い), cara menulisnya, serta kosakata kata sifat sesuai konteks. Tata Bahasa: bentuk です／くないです, kata sifat langsung menerangkan kata benda, とても／あまり, 〜はどうですか, dan bentuk lampau かったです／くなかったです. Tiap attempt mengambil 30 soal acak dari 50. Lulus 70% (21/30), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 6 kanji inti Bab 6 + 3 review waktu =====
    (1, 'vocabulary'::TEXT, 1, 'この コーヒーは <u>高い</u>です。',
        '高い dibaca たかい (mahal/tinggi). こうい dan だかい bukan bacaan kata sifat ini, たがい (互い, saling) adalah kata lain yang bunyinya mirip tapi kanjinya beda.'),
    (2, 'vocabulary', 1, 'この かばんは <u>安い</u>です。',
        '安い dibaca やすい (murah). あんい adalah cara baca onyomi yang salah untuk kata sifat ini, やすくない artinya "tidak murah" (negatif, bukan yang ditanyakan), あんぜん (安全, aman) adalah kata lain yang kanjinya mirip.'),
    (3, 'vocabulary', 1, 'これは <u>新しい</u> パソコンです。',
        '新しい dibaca あたらしい (baru). しんしい dan あらたしい bukan bacaan yang benar, しんちゃく bukan kata yang berkaitan.'),
    (4, 'vocabulary', 1, 'この つくえは <u>古い</u>です。',
        '古い dibaca ふるい (lama/kuno). こい (濃い, pekat) adalah kata lain, ふるくない artinya "tidak lama" (negatif), こふる bukan bacaan yang benar.'),
    (5, 'vocabulary', 1, 'この ひもは <u>長い</u>です。',
        '長い dibaca ながい (panjang). ちょうい adalah cara baca onyomi yang salah untuk kata sifat ini, ながくない artinya "tidak panjang" (negatif), じょうい bukan bacaan yang benar.'),
    (6, 'vocabulary', 1, 'この かみは <u>白い</u>です。',
        '白い dibaca しろい (putih). はくい dan びゃくい adalah cara baca onyomi yang salah untuk kata sifat ini, しろくない artinya "tidak putih" (negatif).'),
    (7, 'vocabulary', 1, 'いま <u>三時</u>です。',
        '三時 dibaca さんじ — bacaan biasa/beraturan, beda dari 四時 (よじ) atau 九時 (くじ) yang tidak beraturan. みじ, さんとき, dan さんし bukan bacaan yang benar.'),
    (8, 'vocabulary', 1, 'いま <u>二時</u>です。',
        '二時 dibaca にじ — bacaan biasa/beraturan. ふたじ, にとき, dan じに bukan bacaan yang benar.'),
    (9, 'vocabulary', 1, 'いま <u>六時</u>です。',
        '六時 dibaca ろくじ — bacaan biasa/beraturan (beda dari 六分＝ろっぷん yang pakai sokuon, karena digabung dengan 時 bukan 分). むじ, ろくとき, dan りくじ bukan bacaan yang benar.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'あには <u>にねんせい</u>です。',
        'にねんせい ditulis 二年生 (siswa tahun ke-2). Salah: 三年生 (さんねんせい, angka berbeda), 二月生 (bulan, bukan tahun), 二年制 (制 artinya "sistem", bukan "siswa").'),
    (11, 'vocabulary', 2, 'がっこうは <u>なんねん</u>ですか。',
        'なんねん ditulis 何年 (berapa tahun). Salah: 何日 (berapa hari, satuan beda), 何月 (bulan apa, satuan beda), 何年生 (kelebihan kanji 生).'),
    (12, 'vocabulary', 2, 'がっこうの がくせいは <u>ひゃくにん</u>です。',
        'ひゃくにん ditulis 百人 (seratus orang). Salah: 百円 (satuan uang, bukan orang), 千人 (angka berbeda), 白人 (白 mirip 百 tapi artinya "putih", beda arti total).'),
    (13, 'vocabulary', 2, 'この まちは <u>せんにん</u>です。',
        'せんにん ditulis 千人 (seribu orang). Salah: 千円 (satuan uang, bukan orang), 干人 (干 kehilangan satu titik dari 千, bentuknya sangat mirip), 百人 (angka berbeda).'),
    (14, 'vocabulary', 2, 'この ほんは <u>ごひゃくえん</u>です。',
        'ごひゃくえん ditulis 五百円. Salah: 五千円 (angka jauh lebih besar), 五百人 (satuan orang, bukan uang), 五白円 (白 mirip 百 tapi beda arti).'),
    (15, 'vocabulary', 2, 'この えんぴつは <u>にひゃくえん</u>です。',
        'にひゃくえん ditulis 二百円. Salah: 二千円 (angka jauh lebih besar), 二百人 (satuan orang, bukan uang), 一百円 (bukan cara penulisan yang benar untuk 100).'),
    (16, 'vocabulary', 2, 'この かさは <u>ななひゃくえん</u>です。',
        'ななひゃくえん ditulis 七百円. Salah: 七千円 (angka jauh lebih besar), 七百人 (satuan orang, bukan uang), 十百円 (bukan kombinasi angka yang valid).'),
    (17, 'vocabulary', 2, 'この とけいは <u>きゅうひゃくえん</u>です。',
        'きゅうひゃくえん ditulis 九百円. Salah: 九千円 (angka jauh lebih besar), 九百人 (satuan orang, bukan uang), 九白円 (白 mirip 百 tapi beda arti).'),
    (18, 'vocabulary', 2, 'あねは <u>さんねんせい</u>です。',
        'さんねんせい ditulis 三年生 (siswa tahun ke-3). Salah: 二年生 (angka berbeda), 三月生 (bulan, bukan tahun), 三年制 (制 artinya "sistem", bukan "siswa").'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata kata sifat, 100% kana =====
    (19, 'vocabulary', 3, 'ふゆは（　）です。',
        'Jawabannya さむい (dingin) — musim dingin. あつい (panas), あたたかい (hangat), dan すずしい (sejuk) tidak cocok dengan musim dingin.'),
    (20, 'vocabulary', 3, 'なつは（　）です。',
        'Jawabannya あつい (panas) — musim panas. さむい (dingin), すずしい (sejuk), dan あたたかい (hangat) tidak cocok dengan musim panas.'),
    (21, 'vocabulary', 3, 'はるは（　）です。',
        'Jawabannya あたたかい (hangat) — musim semi. さむい (dingin), あつい (panas), dan すずしい (sejuk) tidak cocok dengan musim semi.'),
    (22, 'vocabulary', 3, 'あきは（　）です。',
        'Jawabannya すずしい (sejuk) — musim gugur. あつい (panas), さむい (dingin), dan あたたかい (hangat) tidak cocok dengan musim gugur.'),
    (23, 'vocabulary', 3, 'にほんごの テストは（　）です。',
        'Jawabannya むずかしい (sulit). やさしい berarti mudah, たのしい berarti menyenangkan, おいしい berarti enak — ketiganya tidak cocok untuk menilai kesulitan tes.'),
    (24, 'vocabulary', 3, 'この せんせいは（　）です。',
        'Jawabannya やさしい (baik hati/lembut). むずかしい berarti sulit, さむい berarti dingin, とおい berarti jauh — ketiganya tidak cocok untuk menilai sifat orang.'),
    (25, 'vocabulary', 3, 'この りょうりは（　）です。',
        'Jawabannya おいしい (enak). むずかしい berarti sulit, さむい berarti dingin, とおい berarti jauh — ketiganya tidak cocok untuk menilai rasa makanan.'),
    (26, 'vocabulary', 3, 'あの いえは（　）です。',
        'Jawabannya おおきい (besar). ちいさい berarti kecil (kebalikan), むずかしい dan おいしい tidak dipakai untuk menilai ukuran rumah.'),
    (27, 'vocabulary', 3, 'この へやは（　）です。',
        'Jawabannya ちいさい (kecil). おおきい berarti besar (kebalikan), むずかしい dan おいしい tidak dipakai untuk menilai ukuran ruangan.'),
    (28, 'vocabulary', 3, 'あの でんしゃは（　）です。',
        'Jawabannya はやい (cepat). おそい berarti lambat (kebalikan), ちかい berarti dekat, とおい berarti jauh — ketiganya tidak cocok untuk menilai kecepatan kereta.'),
    (29, 'vocabulary', 3, 'この みちは（　）です。',
        'Jawabannya とおい (jauh). ちかい berarti dekat (kebalikan), はやい berarti cepat, おそい berarti lambat — ketiganya tidak cocok untuk menilai jarak.'),
    (30, 'vocabulary', 3, 'あの えきは（　）です。',
        'Jawabannya ちかい (dekat). とおい berarti jauh (kebalikan), はやい berarti cepat, おそい berarti lambat — ketiganya tidak cocok untuk menilai jarak.'),

    -- ===== もんだい1 文の文法1 (31-50) — 6 pola grammar Bab 6 =====
    (31, 'grammar'::TEXT, 1, 'きょうは あつい（　）。',
        'Jawabannya です — kata sifat い langsung diikuti です tanpa だ (beda dari kata benda/kata sifat な yang butuh だ). だ salah karena tidak diperlukan setelah kata sifat い, でした mengubah jadi bentuk lampau (tidak sesuai konteks kini), じゃありません mengubah jadi negatif (tidak sesuai konteks afirmatif).'),
    (32, 'grammar', 1, 'この かばんは たかい（　）。',
        'Jawabannya です, sama seperti pola 〜は[い-adj]です — tidak butuh だ. だ, でした, dan じゃありません tidak cocok untuk kalimat afirmatif bentuk kini ini.'),
    (33, 'grammar', 1, 'この りょうりは おいしい（　）。',
        'Jawabannya です. だ, でした, dan じゃありません tidak cocok untuk kalimat afirmatif bentuk kini ini.'),
    (34, 'grammar', 1, 'この コーヒーは あつくない（　）。',
        'Jawabannya です — bentuk negatif kata sifat い (あつくない) tetap diikuti です, bukan だ. だ tidak diperlukan, でした mengubah jadi lampau negatif (tidak sesuai konteks kini), じゃありません tidak dipakai setelah くない yang sudah negatif.'),
    (35, 'grammar', 1, 'この テストは むずかしくない（　）。',
        'Jawabannya です, sama seperti 〜は[い-adj]くないです. だ, でした, dan じゃありません tidak cocok di sini.'),
    (36, 'grammar', 1, 'きょうは さむくない（　）。',
        'Jawabannya です. だ, でした, dan じゃありません tidak cocok untuk kalimat negatif bentuk kini ini.'),
    (37, 'grammar', 1, 'これは（　）くつです。',
        'Jawabannya あたらしい — kata sifat い menerangkan kata benda langsung tanpa tambahan apa pun. あたらしいな dan あたらしいの salah karena kata sifat い tidak butuh な atau の sebelum kata benda (beda dari kata sifat な), あたらしくて adalah bentuk penghubung (untuk menyambung ke kalimat lain), bukan bentuk yang langsung menerangkan kata benda di sini.'),
    (38, 'grammar', 1, 'あれは（　）ほんです。',
        'Jawabannya ふるい, langsung menerangkan ほん tanpa tambahan. ふるいな dan ふるいの salah (kata sifat い tidak butuh な/の), ふるくて adalah bentuk penghubung yang tidak cocok di sini.'),
    (39, 'grammar', 1, 'これは（　）かばんです。',
        'Jawabannya ちいさい, langsung menerangkan かばん tanpa tambahan. ちいさいな dan ちいさいの salah (kata sifat い tidak butuh な/の), ちいさくて adalah bentuk penghubung yang tidak cocok di sini.'),
    (40, 'grammar', 1, 'あれは（　）たてものです。',
        'Jawabannya たかい, langsung menerangkan たてもの tanpa tambahan. たかいな dan たかいの salah (kata sifat い tidak butuh な/の), たかくて adalah bentuk penghubung yang tidak cocok di sini.'),
    (41, 'grammar', 1, 'この コーヒーは（　）あついです。',
        'Jawabannya とても (sangat), dipakai bebas di kalimat afirmatif. あまり hanya boleh dipakai bersama bentuk negatif (tidak ada di kalimat ini), すこし berarti sedikit (kurang cocok untuk penekanan "sangat"), ぜんぜん biasanya berpasangan dengan negatif juga.'),
    (42, 'grammar', 1, 'この テストは（　）むずかしくないです。',
        'Jawabannya あまり — kalimat ini negatif (むずかしくない), dan あまり memang HARUS berpasangan dengan bentuk negatif (artinya "tidak terlalu"). とても biasanya dipakai di kalimat afirmatif, すこし dan ぜんぜん kurang tepat maknanya di sini dibanding あまり.'),
    (43, 'grammar', 1, 'きょうは（　）さむいです。',
        'Jawabannya とても, dipakai di kalimat afirmatif. あまり hanya boleh dipakai bersama bentuk negatif (tidak ada di kalimat ini), すこし dan ぜんぜん kurang tepat maknanya untuk penekanan "sangat".'),
    (44, 'grammar', 1, 'この りょうりは（　）おいしくないです。',
        'Jawabannya あまり — kalimat ini negatif (おいしくない), dan あまり memang HARUS berpasangan dengan bentuk negatif. とても biasanya dipakai di kalimat afirmatif, すこし dan ぜんぶ tidak cocok maknanya di sini.'),
    (45, 'grammar', 1, 'にほんの てんきは（　）ですか。',
        'Jawabannya どう (bagaimana), dipakai menanyakan pendapat/kesan. なに menanyakan benda, だれ menanyakan orang, どこ menanyakan tempat — ketiganya tidak cocok untuk menanyakan pendapat tentang cuaca.'),
    (46, 'grammar', 1, 'この コーヒーは（　）ですか。「あついです。」',
        'Jawabannya どう, dijawab dengan kata sifat あついです yang menyatakan kesan. なに, だれ, dan どこ tidak cocok dengan jawaban berupa kesan/pendapat.'),
    (47, 'grammar', 1, 'がっこうの せいかつは（　）ですか。',
        'Jawabannya どう, menanyakan pendapat tentang kehidupan sekolah. なに, だれ, dan どこ tidak cocok untuk menanyakan pendapat.'),
    (48, 'grammar', 1, 'きのう テストは むずかし（　）。',
        'Jawabannya かったです — bentuk lampau afirmatif kata sifat い (むずかしい → むずかしかったです). いです adalah bentuk kini (tidak sesuai konteks きのう/kemarin), くないです adalah bentuk negatif kini, でした tidak bisa langsung menempel ke む ずかし tanpa かった.'),
    (49, 'grammar', 1, 'せんしゅうは あつ（　）。',
        'Jawabannya くなかったです — bentuk lampau negatif kata sifat い (あつい → あつくなかったです, "tidak panas"). かったです adalah bentuk lampau afirmatif (kebalikan makna), いです adalah bentuk kini, でした tidak bisa langsung menempel ke あつ tanpa くなかった.'),
    (50, 'grammar', 1, 'きょねんの ふゆは さむ（　）。',
        'Jawabannya かったです — bentuk lampau afirmatif (さむい → さむかったです, "dingin [tahun lalu]"). くなかったです adalah bentuk lampau negatif (kebalikan makna), いです adalah bentuk kini, でした tidak bisa langsung menempel ke さむ tanpa かった.')
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
    (1, 0, 'たかい', TRUE),   (1, 1, 'こうい', FALSE),   (1, 2, 'たがい', FALSE),   (1, 3, 'だかい', FALSE),
    (2, 0, 'やすい', TRUE),   (2, 1, 'あんい', FALSE),   (2, 2, 'やすくない', FALSE), (2, 3, 'あんぜん', FALSE),
    (3, 0, 'あたらしい', TRUE), (3, 1, 'しんしい', FALSE), (3, 2, 'あらたしい', FALSE), (3, 3, 'しんちゃく', FALSE),
    (4, 0, 'ふるい', TRUE),   (4, 1, 'こい', FALSE),     (4, 2, 'ふるくない', FALSE), (4, 3, 'こふる', FALSE),
    (5, 0, 'ながい', TRUE),   (5, 1, 'ちょうい', FALSE), (5, 2, 'ながくない', FALSE), (5, 3, 'じょうい', FALSE),
    (6, 0, 'しろい', TRUE),   (6, 1, 'はくい', FALSE),   (6, 2, 'しろくない', FALSE), (6, 3, 'びゃくい', FALSE),
    (7, 0, 'さんじ', TRUE),   (7, 1, 'みじ', FALSE),     (7, 2, 'さんとき', FALSE),   (7, 3, 'さんし', FALSE),
    (8, 0, 'にじ', TRUE),     (8, 1, 'ふたじ', FALSE),   (8, 2, 'にとき', FALSE),     (8, 3, 'じに', FALSE),
    (9, 0, 'ろくじ', TRUE),   (9, 1, 'むじ', FALSE),     (9, 2, 'ろくとき', FALSE),   (9, 3, 'りくじ', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '二年生', TRUE), (10, 1, '三年生', FALSE), (10, 2, '二月生', FALSE), (10, 3, '二年制', FALSE),
    (11, 0, '何年', TRUE),   (11, 1, '何日', FALSE),   (11, 2, '何月', FALSE),   (11, 3, '何年生', FALSE),
    (12, 0, '百人', TRUE),   (12, 1, '百円', FALSE),   (12, 2, '千人', FALSE),   (12, 3, '白人', FALSE),
    (13, 0, '千人', TRUE),   (13, 1, '千円', FALSE),   (13, 2, '干人', FALSE),   (13, 3, '百人', FALSE),
    (14, 0, '五百円', TRUE), (14, 1, '五千円', FALSE), (14, 2, '五百人', FALSE), (14, 3, '五白円', FALSE),
    (15, 0, '二百円', TRUE), (15, 1, '二千円', FALSE), (15, 2, '二百人', FALSE), (15, 3, '一百円', FALSE),
    (16, 0, '七百円', TRUE), (16, 1, '七千円', FALSE), (16, 2, '七百人', FALSE), (16, 3, '十百円', FALSE),
    (17, 0, '九百円', TRUE), (17, 1, '九千円', FALSE), (17, 2, '九百人', FALSE), (17, 3, '九白円', FALSE),
    (18, 0, '三年生', TRUE), (18, 1, '二年生', FALSE), (18, 2, '三月生', FALSE), (18, 3, '三年制', FALSE),

    -- 文脈規定
    (19, 0, 'さむい', TRUE),   (19, 1, 'あつい', FALSE),   (19, 2, 'あたたかい', FALSE), (19, 3, 'すずしい', FALSE),
    (20, 0, 'あつい', TRUE),   (20, 1, 'さむい', FALSE),   (20, 2, 'すずしい', FALSE),   (20, 3, 'あたたかい', FALSE),
    (21, 0, 'あたたかい', TRUE), (21, 1, 'さむい', FALSE), (21, 2, 'あつい', FALSE),     (21, 3, 'すずしい', FALSE),
    (22, 0, 'すずしい', TRUE), (22, 1, 'あつい', FALSE),   (22, 2, 'さむい', FALSE),     (22, 3, 'あたたかい', FALSE),
    (23, 0, 'むずかしい', TRUE), (23, 1, 'やさしい', FALSE), (23, 2, 'たのしい', FALSE), (23, 3, 'おいしい', FALSE),
    (24, 0, 'やさしい', TRUE), (24, 1, 'むずかしい', FALSE), (24, 2, 'さむい', FALSE),   (24, 3, 'とおい', FALSE),
    (25, 0, 'おいしい', TRUE), (25, 1, 'むずかしい', FALSE), (25, 2, 'さむい', FALSE),   (25, 3, 'とおい', FALSE),
    (26, 0, 'おおきい', TRUE), (26, 1, 'ちいさい', FALSE), (26, 2, 'むずかしい', FALSE), (26, 3, 'おいしい', FALSE),
    (27, 0, 'ちいさい', TRUE), (27, 1, 'おおきい', FALSE), (27, 2, 'むずかしい', FALSE), (27, 3, 'おいしい', FALSE),
    (28, 0, 'はやい', TRUE),   (28, 1, 'おそい', FALSE),   (28, 2, 'ちかい', FALSE),     (28, 3, 'とおい', FALSE),
    (29, 0, 'とおい', TRUE),   (29, 1, 'ちかい', FALSE),   (29, 2, 'はやい', FALSE),     (29, 3, 'おそい', FALSE),
    (30, 0, 'ちかい', TRUE),   (30, 1, 'とおい', FALSE),   (30, 2, 'はやい', FALSE),     (30, 3, 'おそい', FALSE),

    -- 文の文法1
    (31, 0, 'です', TRUE), (31, 1, 'だ', FALSE), (31, 2, 'でした', FALSE), (31, 3, 'じゃありません', FALSE),
    (32, 0, 'です', TRUE), (32, 1, 'だ', FALSE), (32, 2, 'でした', FALSE), (32, 3, 'じゃありません', FALSE),
    (33, 0, 'です', TRUE), (33, 1, 'だ', FALSE), (33, 2, 'でした', FALSE), (33, 3, 'じゃありません', FALSE),
    (34, 0, 'です', TRUE), (34, 1, 'だ', FALSE), (34, 2, 'でした', FALSE), (34, 3, 'じゃありません', FALSE),
    (35, 0, 'です', TRUE), (35, 1, 'だ', FALSE), (35, 2, 'でした', FALSE), (35, 3, 'じゃありません', FALSE),
    (36, 0, 'です', TRUE), (36, 1, 'だ', FALSE), (36, 2, 'でした', FALSE), (36, 3, 'じゃありません', FALSE),
    (37, 0, 'あたらしい', TRUE), (37, 1, 'あたらしいな', FALSE), (37, 2, 'あたらしいの', FALSE), (37, 3, 'あたらしくて', FALSE),
    (38, 0, 'ふるい', TRUE),     (38, 1, 'ふるいな', FALSE),     (38, 2, 'ふるいの', FALSE),     (38, 3, 'ふるくて', FALSE),
    (39, 0, 'ちいさい', TRUE),   (39, 1, 'ちいさいな', FALSE),   (39, 2, 'ちいさいの', FALSE),   (39, 3, 'ちいさくて', FALSE),
    (40, 0, 'たかい', TRUE),     (40, 1, 'たかいな', FALSE),     (40, 2, 'たかいの', FALSE),     (40, 3, 'たかくて', FALSE),
    (41, 0, 'とても', TRUE), (41, 1, 'あまり', FALSE), (41, 2, 'すこし', FALSE), (41, 3, 'ぜんぜん', FALSE),
    (42, 0, 'あまり', TRUE), (42, 1, 'とても', FALSE), (42, 2, 'すこし', FALSE), (42, 3, 'ぜんぜん', FALSE),
    (43, 0, 'とても', TRUE), (43, 1, 'あまり', FALSE), (43, 2, 'すこし', FALSE), (43, 3, 'ぜんぜん', FALSE),
    (44, 0, 'あまり', TRUE), (44, 1, 'とても', FALSE), (44, 2, 'すこし', FALSE), (44, 3, 'ぜんぶ', FALSE),
    (45, 0, 'どう', TRUE), (45, 1, 'なに', FALSE), (45, 2, 'だれ', FALSE), (45, 3, 'どこ', FALSE),
    (46, 0, 'どう', TRUE), (46, 1, 'なに', FALSE), (46, 2, 'だれ', FALSE), (46, 3, 'どこ', FALSE),
    (47, 0, 'どう', TRUE), (47, 1, 'なに', FALSE), (47, 2, 'だれ', FALSE), (47, 3, 'どこ', FALSE),
    (48, 0, 'かったです', TRUE), (48, 1, 'いです', FALSE), (48, 2, 'くないです', FALSE), (48, 3, 'でした', FALSE),
    (49, 0, 'くなかったです', TRUE), (49, 1, 'かったです', FALSE), (49, 2, 'いです', FALSE), (49, 3, 'でした', FALSE),
    (50, 0, 'かったです', TRUE), (50, 1, 'くなかったです', FALSE), (50, 2, 'いです', FALSE), (50, 3, 'でした', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '051: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '051: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 9 Bab3 + 3 Bab4 + 10 Bab5 + 6 Bab6 + 13 counter Bab5.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長時分円百千万年月半歳午前後]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '051: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel di luar Bab 1-6 (が/を/で/へ/に/と). Bab 6 tidak menambah
  --    partikel baru dibanding 047 — から/まで tetap boleh (dari Bab 5).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(が |を |で |へ |に |と )'
  ) THEN
    RAISE EXCEPTION '051: ada partikel di luar materi Bab 1-6 pada teks soal';
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
    RAISE EXCEPTION '051: ada indikasi kata kerja pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '051: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '051: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '051: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 42
  --    target unik yang sudah dipakai di 042 (Bab 3) / 045 (Bab 4) / 047 (Bab 5).
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
         '二十歳','八百円','六分','六百円','十分','四時'
       ])
  ) THEN
    RAISE EXCEPTION '051: ada target <u> yang sudah pernah diujikan di migration 042/045/047';
  END IF;

  -- 7. あまり cuma sah dipakai bersama bentuk negatif (くない／くなかった)
  --    dalam kalimat yang sama (soal + kunci jawaban digabung dulu).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
    JOIN quiz_options qo ON qo.question_id = qq.id AND qo.is_correct
     WHERE qq.lesson_id = v_lesson_id
       AND (qq.question || qo.option_text) LIKE '%あまり%'
       AND (qq.question || qo.option_text) !~ '(くない|くなかった)'
  ) THEN
    RAISE EXCEPTION '051: ada soal yang memakai あまり tanpa bentuk negatif';
  END IF;

  RAISE NOTICE '051: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
