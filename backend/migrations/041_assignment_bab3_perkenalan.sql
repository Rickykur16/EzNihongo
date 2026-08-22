-- 041_assignment_bab3_perkenalan.sql — Assignment Bab 3: Perkenalan Diri.
--
-- Beda dari 039/040 (hiragana/katakana): Bab 3 mengajarkan BAHASA beneran
-- (kosakata + kanji + grammar perkenalan diri), jadi soalnya bersumber dari
-- materi Bab 3 sendiri — bukan dikarang dari lembar tes lepas. Repo TIDAK
-- menyimpan kurikulum sama sekali (tidak ada satu pun INSERT INTO
-- module_vocabulary/module_grammar/kanji_items di seluruh migrasi & seed),
-- jadi konten di bawah ditarik dari Notion "N5-B3 — Perkenalan Diri" (Nomor
-- Bab 3, Kode Bab N5-B3), dikonfirmasi user sebagai Bab 3 yang sesungguhnya
-- di produksi:
--   - 9 kanji: 人・学・生・先・名・国・語・校・何
--   - 6 pola grammar: 〜は〜です / 〜は〜じゃありません / 〜は〜ですか /
--     〜も / 〜の / 〜ね・〜よ
--   - 46 kosakata: pronomina, sufiks nama, negara & kewarganegaraan,
--     profesi, salam, keluarga.
--
-- ATURAN KANJI (permintaan eksplisit user): siswa Bab 3 baru menyelesaikan
-- hiragana (Bab 1) + katakana (Bab 2) dan baru kenal 9 kanji di atas. Badan
-- tiap kalimat soal karena itu 100% kana (termasuk 私→わたし, 医者→いしゃ,
-- dst) — kanji CUMA muncul di dalam <u>…</u> target もんだい1 漢字読み, dan
-- itu pun dibatasi ke kata yang benar-benar diajarkan Bab 3. もんだい2 表記
-- malah lebih ketat: seluruh kalimatnya kana, kanji cuma muncul di opsi
-- jawaban. Diverifikasi mesin lewat query di bawah, lihat catatan di akhir
-- file.
--
-- KATEGORI JLPT ASLI (bukan 'custom' seperti 039/040): question_category
-- 'vocabulary'/'grammar' supaya siswa dapat tab "Moji-Goi"/"Tata Bahasa" ala
-- JLPT (bukan satu tab "Custom"), dan supaya quiz_question_results
-- men-snapshot kategori yang bermakna → panel "Fokus belajarmu"
-- (/api/recommendations/me) bisa membedakan lemah-kosakata vs lemah-grammar.
-- Tuple (question_category, section_number, section_label,
-- section_instruction) disalin BYTE-EXACT dari JLPT_GEN_TASKS
-- (backend/src/routes/admin.js) supaya soal yang nanti di-generate admin via
-- tombol "✨ Generate JLPT" menempel ke section yang sama, bukan bikin
-- section kembar.
--
-- SAMPLING: questions_per_attempt = 30 dari pool 50. sampleQuestionIds
-- (progress.js) mengambil UNIFORM atas seluruh pool, tanpa stratifikasi per
-- section — makanya section terkecil (もんだい2 文の組み立て) sengaja diisi
-- 8 soal, bukan lebih sedikit, supaya peluang section itu kosong di satu
-- attempt tetap sangat kecil (~0.024%, lihat perhitungan Π(20-i)/(50-i) di
-- percakapan desain). Nomor soal ("1ばん" dst) dihitung ulang dari array
-- yang benar-benar ter-render per section (welcome.html), jadi sampling
-- tidak menyisakan nomor bolong di sisi siswa.
--
-- Sama seperti 039/040: pilihan ganda 4 opsi (quiz_options), question_type
-- 'multiple_choice'. Passing 70% (=21/30), cooldown 12 jam.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) sendiri
-- cuma menjalankan file ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus lalu
-- di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-3-perkenalan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  -- Bab 3 = modul KETIGA kelas N5 menurut sort_order (posisi, bukan title —
  -- seed-n5.sql lama menaruh 'Salam & Perkenalan Diri' di posisi KEDUA,
  -- jadi title-match '%perkenalan%' justru menyambar Bab 2).
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '041: modul Bab 3 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '041: modul Bab 3 terbaca "%" — kalau ternyata bukan Bab Perkenalan Diri, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '041: seed Assignment Bab 3 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 3 — Perkenalan Diri', 'quiz',
    'Tes JLPT-style materi Bab 3 (Perkenalan Diri): pool 50 soal lintas Moji-Goi (kanji dasar, penulisan, kosakata sesuai konteks) dan Tata Bahasa (partikel は/も/の, bentuk です/じゃありません/ですか, susun kalimat). Tiap attempt sample 30 soal acak dari pool — retry tidak persis sama. Lulus di 70% (21/30), cooldown 12 jam. Materi: 9 kanji dasar (人学生先名国語校何), 6 pola grammar perkenalan diri, kosakata profesi/negara/keluarga/salam.',
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

  -- Re-seed bersih (quiz_options ikut CASCADE).
  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(cat, num, label, instruction) AS (VALUES
    ('vocabulary'::TEXT, 1, 'もんだい1 漢字読み',
        '＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。'),
    ('vocabulary', 2, 'もんだい2 表記',
        '＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。'),
    ('vocabulary', 3, 'もんだい3 文脈規定',
        '（　）に なにを いれますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。'),
    ('grammar', 1, 'もんだい1 文の文法1',
        '（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。'),
    ('grammar', 2, 'もんだい2 文の組み立て',
        '＿★＿に 入る ものは どれですか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。')
  ), q(no, cat, sect_num, question, explanation) AS (VALUES
    -- ===== もんだい1 漢字読み (sort_order 1-12) =====
    -- Target: kata yang mengandung 9 kanji Bab 3 (人学生先名国語校何).
    -- Karakter ikutan (前/日/本/大/高/中) memang bagian kosakata Bab 3.
    (1, 'vocabulary'::TEXT, 1, 'わたしは <u>学生</u>です。', '学生＝がくせい。がっせい・がぐせい・かくせいは 間違った 読み方です。'),
    (2, 'vocabulary', 1, 'あの かたは <u>先生</u>です。', '先生＝せんせい。せんせえ（長音の 場所が 違う）・ぜんせい（濁点が 違う）・せんせは 間違いです。'),
    (3, 'vocabulary', 1, 'これは わたしの <u>学校</u>です。', '学校＝がっこう。促音「っ」を 忘れずに。がこう・かっこう・がっごうは 間違いです。'),
    (4, 'vocabulary', 1, 'あには <u>大学</u>で にほんごを べんきょうして います。', '大学＝だいがく。だいかく・たいがく・だいがっは 間違いです。'),
    (5, 'vocabulary', 1, 'あねは <u>高校</u>の せんせいです。', '高校＝こうこう。こうごう・こおこう・かんこうは 間違いです。'),
    (6, 'vocabulary', 1, 'あなたの <u>国</u>は どこですか。', '国＝くに。「くに」は 訓読み。こく・ぐに・くねは 間違いです。'),
    (7, 'vocabulary', 1, 'たなかさんは <u>中国</u>の しゅっしんです。', '中国＝ちゅうごく。ちゅうこく（濁点なし）・じゅうごく・ちゅごくは 間違いです。'),
    (8, 'vocabulary', 1, 'すみません、お <u>名前</u>は？', '名前＝なまえ。なめえ・なあまえ・めいぜんは 間違いです。'),
    (9, 'vocabulary', 1, 'かのじょは <u>日本人</u>です。', '日本人＝にほんじん。「じん」は 音読み。にっぽんじん・にほんにん・にぼんじんは この 文脈では 間違いです。'),
    (10, 'vocabulary', 1, 'すこし <u>日本語</u>が わかります。', '日本語＝にほんご。「ご」は 音読み。にほんこ・にっぽんご・にぼんごは 間違いです。'),
    (11, 'vocabulary', 1, 'かぞくは <u>何人</u>ですか。', '何人＝なんにん（人数を 聞く 質問）。なにじん（国籍）・なんじん・なにひとは この 文脈では 間違いです。'),
    (12, 'vocabulary', 1, '<u>人</u>が おおいですね。', '人＝ひと（訓読み）。にん・じん・ひとつは 間違いです。'),

    -- ===== もんだい2 表記 (sort_order 13-21) =====
    -- Kalimat 100% kana, target hiragana dalam <u>…</u>, jawaban 4 opsi kanji/katakana.
    (13, 'vocabulary', 2, 'わたしは <u>がくせい</u>です。', 'がくせい＝学生。学せい・字生・楽生は 間違った 漢字です。'),
    (14, 'vocabulary', 2, 'あの かたは <u>せんせい</u>です。', 'せんせい＝先生。失生・先性・専生は 間違った 漢字です。'),
    (15, 'vocabulary', 2, 'これは わたしの <u>がっこう</u>です。', 'がっこう＝学校。学枝・学交・学効は 間違った 漢字です。'),
    (16, 'vocabulary', 2, 'あなたの <u>くに</u>は どこですか。', 'くに＝国。困・園・固は 形が 似ていますが 間違いです。'),
    (17, 'vocabulary', 2, '<u>ひと</u>が おおいですね。', 'ひと＝人。入・八・入間は 形が 似ていますが 間違いです。'),
    (18, 'vocabulary', 2, 'これは <u>なに</u>ですか。', 'なに＝何。可・河・荷は 形が 似ていますが 間違いです。'),
    (19, 'vocabulary', 2, 'わたしは <u>べとなむ</u>の しゅっしんです。', 'べとなむ＝ベトナム。片仮名の「ソ」と「ン」、「シ」と「ツ」は 形が 似ているので 注意して ください。'),
    (20, 'vocabulary', 2, 'かのじょは <u>たい</u>じんです。', 'たい＝タイ。片仮名の「タ」と「ク」、「イ」と「ヤ」は 形が 似ているので 注意して ください。'),
    (21, 'vocabulary', 2, 'かれは <u>いんど</u>の しゅっしんです。', 'いんど＝インド。片仮名の「イ」と「ソ」、「ン」と「ソ」は 形が 似ているので 注意して ください。'),

    -- ===== もんだい3 文脈規定 (sort_order 22-30) — 100% kana =====
    (22, 'vocabulary', 3, 'かのじょは びょういんで はたらいて いる（　）です。', 'いしゃ（医者）が 正解。びょういんで びょうきの ひとを みる しごとです。'),
    (23, 'vocabulary', 3, 'わたしの あには（　）で、まいにち かいしゃへ いきます。', 'かいしゃいんが 正解。かいしゃで はたらく ひとを かいしゃいんと いいます。'),
    (24, 'vocabulary', 3, 'わたしの（　）は、りょうりが じょうずです。', 'あにが 正解。「わたしの」の あとには かぞくの ことばが きます。'),
    (25, 'vocabulary', 3, 'はじめて あった ひとに「（　）」と いいます。', 'はじめましてが 正解。はじめて あった ときの あいさつです。'),
    (26, 'vocabulary', 3, 'あいさつの あとに「（　）」と いって、じこしょうかいを おわります。', 'よろしくおねがいしますが 正解。じこしょうかいの さいごに いう ことばです。'),
    (27, 'vocabulary', 3, 'かのじょは（　）の しゅっしんで、にほんごが じょうずでは ありません。', 'インドが 正解。「〜の 出身」の まえには くにの なまえが きます。'),
    (28, 'vocabulary', 3, 'はじめて あう ひとに、「（　）は？」と ききます。', 'おなまえが 正解。ていねいな ききかたです。'),
    (29, 'vocabulary', 3, 'たなかさんは、たなかが（　）で、たろうが なまえです。', 'みょうじが 正解。かぞくの なまえの ことです。'),
    (30, 'vocabulary', 3, 'すみません、あの、これを ひとつ（　）。', 'どうぞが 正解。ものを わたす ときや すすめる ときに つかいます。'),

    -- ===== もんだい1 文の文法1 (sort_order 31-42) — 100% kana =====
    (31, 'grammar'::TEXT, 1, 'わたし（　）がくせいです。', 'は（トピックの 助詞）が 正解。「A（　）Bです」で「AはBです」の 文型に なります。'),
    (32, 'grammar', 1, 'これ（　）ほんです。', 'は（トピックの 助詞）が 正解。「これは〜です」で ものを しめします。'),
    (33, 'grammar', 1, 'わたしは がくせい（　）ありません。', 'じゃ（否定の 形）が 正解。「〜じゃありません」で「〜ではない」を あらわします。'),
    (34, 'grammar', 1, 'わたしは せんせい（　）ありません、がくせいです。', 'じゃ（否定の 形）が 正解。「AはBじゃありません」で AはBでは ないと いう いみです。'),
    (35, 'grammar', 1, 'あなたは がくせいです（　）。', 'か（疑問の 助詞）が 正解。文の さいごに「か」を つけると しつもんに なります。'),
    (36, 'grammar', 1, 'これは ほんです（　）。', 'か（疑問の 助詞）が 正解。「？」は つかわず「か」で しつもんを つくります。'),
    (37, 'grammar', 1, 'わたしは がくせいです。あなた（　）？', 'も（追加の 助詞）が 正解。「あなたも？」で「あなたも がくせいですか」の いみに なります。'),
    (38, 'grammar', 1, 'わたしは にほんじんでは ありません。かれ（　）にほんじんでは ありません。', 'も（追加の 助詞）が 正解。おなじ ことが もう ひとつ ある ときに つかいます。'),
    (39, 'grammar', 1, 'これは わたし（　）ほんです。', 'の（しょゆうの 助詞）が 正解。「わたしの ほん」で「わたしが もって いる ほん」の いみです。'),
    (40, 'grammar', 1, 'あれは せんせい（　）くるまです。', 'の（しょゆうの 助詞）が 正解。「せんせいの くるま」で しょゆうしゃを しめします。'),
    (41, 'grammar', 1, 'きょうは いい てんきです（　）。', 'ね（かくにんの 助詞）が 正解。あいての どういを もとめる ときに つかいます。'),
    (42, 'grammar', 1, 'この ほんは おもしろいです（　）。', 'よ（つよめの 助詞）が 正解。あいてが しらない ことを つたえる ときに つかいます。'),

    -- ===== もんだい2 文の組み立て (sort_order 43-50) — 100% kana =====
    (43, 'grammar', 2, 'わたし　＿＿　＿＿　＿★＿　＿＿。', 'Susunan benar：わたしはたなかさんのかいしゃのしゃいんです。 Artinya：Saya adalah karyawan perusahaan Tanaka-san.'),
    (44, 'grammar', 2, 'これ　＿＿　＿＿　＿★＿　＿＿ありません。', 'Susunan benar：これはわたしのかぞくのしゃしんじゃありません。 Artinya：Ini bukan foto keluarga saya.'),
    (45, 'grammar', 2, 'あなた　＿＿　＿＿　＿★＿　＿＿か。', 'Susunan benar：あなたはかんこくのだいがくのがくせいですか。 Artinya：Apakah kamu mahasiswa universitas di Korea?'),
    (46, 'grammar', 2, 'あね　＿＿　＿＿　＿★＿　＿＿。', 'Susunan benar：あねもだいがくのがくせいのひとりです。 Artinya：Kakak perempuan saya juga salah satu mahasiswa universitas.'),
    (47, 'grammar', 2, 'ここ　＿＿　＿＿　＿★＿　＿＿。', 'Susunan benar：ここはわたしのかぞくのいえです。 Artinya：Di sini adalah rumah keluarga saya.'),
    (48, 'grammar', 2, 'あね　＿＿　＿＿　＿★＿　＿＿。', 'Susunan benar：あねもいしゃのしごとですね。 Artinya：Pekerjaan kakak perempuan saya juga dokter, ya.'),
    (49, 'grammar', 2, 'これ　＿＿　＿＿　＿★＿　＿＿よ。', 'Susunan benar：これはあにのかいしゃのめいしですよ。 Artinya：Ini kartu nama perusahaan kakak laki-laki saya, lho.'),
    (50, 'grammar', 2, 'かのじょ　＿＿　＿＿　＿★＿　＿＿ありません。', 'Susunan benar：かのじょはわたしのがっこうのともだちじゃありません。 Artinya：Dia bukan teman sekolah saya.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', q.cat,
         s.num, s.label, s.instruction, q.explanation, q.no
    FROM q JOIN sect s ON s.cat = q.cat AND s.num = q.sect_num;

  -- Opsi: baris pertama tiap soal = jawaban benar; urutan tampil diacak
  -- frontend tiap attempt (transformQuestionFromApi), jadi aman ditulis
  -- berurutan di sini.
  WITH o(qno, ord, option_text, ok) AS (VALUES
    -- もんだい1 漢字読み — opsi hiragana murni
    (1,  0, 'がくせい', TRUE),  (1,  1, 'がっせい', FALSE), (1,  2, 'がぐせい', FALSE), (1,  3, 'かくせい', FALSE),
    (2,  0, 'せんせい', TRUE),  (2,  1, 'せんせえ', FALSE), (2,  2, 'ぜんせい', FALSE), (2,  3, 'せんせ', FALSE),
    (3,  0, 'がっこう', TRUE),  (3,  1, 'がこう', FALSE),   (3,  2, 'かっこう', FALSE), (3,  3, 'がっごう', FALSE),
    (4,  0, 'だいがく', TRUE),  (4,  1, 'だいかく', FALSE), (4,  2, 'たいがく', FALSE), (4,  3, 'だいがっ', FALSE),
    (5,  0, 'こうこう', TRUE),  (5,  1, 'こうごう', FALSE), (5,  2, 'こおこう', FALSE), (5,  3, 'かんこう', FALSE),
    (6,  0, 'くに', TRUE),      (6,  1, 'こく', FALSE),     (6,  2, 'ぐに', FALSE),     (6,  3, 'くね', FALSE),
    (7,  0, 'ちゅうごく', TRUE),(7,  1, 'ちゅうこく', FALSE),(7,  2, 'じゅうごく', FALSE),(7,  3, 'ちゅごく', FALSE),
    (8,  0, 'なまえ', TRUE),    (8,  1, 'なめえ', FALSE),   (8,  2, 'なあまえ', FALSE), (8,  3, 'めいぜん', FALSE),
    (9,  0, 'にほんじん', TRUE),(9,  1, 'にっぽんじん', FALSE),(9,  2, 'にほんにん', FALSE),(9, 3, 'にぼんじん', FALSE),
    (10, 0, 'にほんご', TRUE),  (10, 1, 'にほんこ', FALSE), (10, 2, 'にっぽんご', FALSE),(10, 3, 'にぼんご', FALSE),
    (11, 0, 'なんにん', TRUE),  (11, 1, 'なにじん', FALSE), (11, 2, 'なんじん', FALSE), (11, 3, 'なにひと', FALSE),
    (12, 0, 'ひと', TRUE),      (12, 1, 'にん', FALSE),     (12, 2, 'じん', FALSE),     (12, 3, 'ひとつ', FALSE),

    -- もんだい2 表記 — opsi kanji/katakana
    (13, 0, '学生', TRUE), (13, 1, '学せい', FALSE), (13, 2, '字生', FALSE), (13, 3, '楽生', FALSE),
    (14, 0, '先生', TRUE), (14, 1, '失生', FALSE),   (14, 2, '先性', FALSE), (14, 3, '専生', FALSE),
    (15, 0, '学校', TRUE), (15, 1, '学枝', FALSE),   (15, 2, '学交', FALSE), (15, 3, '学効', FALSE),
    (16, 0, '国', TRUE),   (16, 1, '困', FALSE),     (16, 2, '園', FALSE),   (16, 3, '固', FALSE),
    (17, 0, '人', TRUE),   (17, 1, '入', FALSE),     (17, 2, '八', FALSE),   (17, 3, '入間', FALSE),
    (18, 0, '何', TRUE),   (18, 1, '可', FALSE),     (18, 2, '河', FALSE),   (18, 3, '荷', FALSE),
    (19, 0, 'ベトナム', TRUE), (19, 1, 'ヘトナム', FALSE), (19, 2, 'ベトナソ', FALSE), (19, 3, 'ペトナム', FALSE),
    (20, 0, 'タイ', TRUE),     (20, 1, 'クイ', FALSE),     (20, 2, 'タヤ', FALSE),     (20, 3, 'ライ', FALSE),
    (21, 0, 'インド', TRUE),   (21, 1, 'イソド', FALSE),   (21, 2, 'インヅ', FALSE),   (21, 3, 'イント', FALSE),

    -- もんだい3 文脈規定
    (22, 0, 'いしゃ', TRUE),      (22, 1, 'かんごし', FALSE), (22, 2, 'がくせい', FALSE), (22, 3, 'せんせい', FALSE),
    (23, 0, 'かいしゃいん', TRUE),(23, 1, 'いしゃ', FALSE),   (23, 2, 'がくせい', FALSE), (23, 3, 'かんごし', FALSE),
    (24, 0, 'あに', TRUE),        (24, 1, 'はは', FALSE),     (24, 2, 'おとうと', FALSE), (24, 3, 'あね', FALSE),
    (25, 0, 'はじめまして', TRUE),(25, 1, 'すみません', FALSE),(25, 2, 'どうぞ', FALSE),   (25, 3, 'こちらこそ', FALSE),
    (26, 0, 'よろしくおねがいします', TRUE), (26, 1, 'はじめまして', FALSE), (26, 2, 'ありがとうございます', FALSE), (26, 3, 'すみません', FALSE),
    (27, 0, 'インド', TRUE),      (27, 1, 'ベトナム', FALSE), (27, 2, 'タイ', FALSE), (27, 3, 'かんこく', FALSE),
    (28, 0, 'おなまえ', TRUE),    (28, 1, 'おしごと', FALSE), (28, 2, 'おくに', FALSE),   (28, 3, 'おげんき', FALSE),
    (29, 0, 'みょうじ', TRUE),    (29, 1, 'なまえ', FALSE),   (29, 2, 'しゅっしん', FALSE), (29, 3, 'しごと', FALSE),
    (30, 0, 'どうぞ', TRUE),      (30, 1, 'どうも', FALSE),   (30, 2, 'こちらこそ', FALSE), (30, 3, 'すみません', FALSE),

    -- もんだい1 文の文法1
    (31, 0, 'は', TRUE), (31, 1, 'が', FALSE), (31, 2, 'を', FALSE), (31, 3, 'で', FALSE),
    (32, 0, 'は', TRUE), (32, 1, 'に', FALSE), (32, 2, 'を', FALSE), (32, 3, 'も', FALSE),
    (33, 0, 'じゃ', TRUE), (33, 1, 'では', FALSE), (33, 2, 'です', FALSE), (33, 3, 'にも', FALSE),
    (34, 0, 'じゃ', TRUE), (34, 1, 'では', FALSE), (34, 2, 'にも', FALSE), (34, 3, 'かも', FALSE),
    (35, 0, 'か', TRUE), (35, 1, 'ね', FALSE), (35, 2, 'よ', FALSE), (35, 3, 'の', FALSE),
    (36, 0, 'か', TRUE), (36, 1, 'よ', FALSE), (36, 2, 'ね', FALSE), (36, 3, 'を', FALSE),
    (37, 0, 'も', TRUE), (37, 1, 'は', FALSE), (37, 2, 'の', FALSE), (37, 3, 'か', FALSE),
    (38, 0, 'も', TRUE), (38, 1, 'は', FALSE), (38, 2, 'が', FALSE), (38, 3, 'を', FALSE),
    (39, 0, 'の', TRUE), (39, 1, 'は', FALSE), (39, 2, 'が', FALSE), (39, 3, 'も', FALSE),
    (40, 0, 'の', TRUE), (40, 1, 'は', FALSE), (40, 2, 'を', FALSE), (40, 3, 'で', FALSE),
    (41, 0, 'ね', TRUE), (41, 1, 'よ', FALSE), (41, 2, 'か', FALSE), (41, 3, 'も', FALSE),
    (42, 0, 'よ', TRUE), (42, 1, 'ね', FALSE), (42, 2, 'か', FALSE), (42, 3, 'の', FALSE),

    -- もんだい2 文の組み立て — opsi = potongan kalimat, benar = potongan di posisi ★
    (43, 0, 'かいしゃの', TRUE), (43, 1, 'は', FALSE), (43, 2, 'たなかさんの', FALSE), (43, 3, 'しゃいんです', FALSE),
    (44, 0, 'かぞくの', TRUE),   (44, 1, 'は', FALSE), (44, 2, 'わたしの', FALSE), (44, 3, 'しゃしんじゃ', FALSE),
    (45, 0, 'だいがくの', TRUE), (45, 1, 'は', FALSE), (45, 2, 'かんこくの', FALSE), (45, 3, 'がくせいです', FALSE),
    (46, 0, 'がくせいの', TRUE), (46, 1, 'も', FALSE), (46, 2, 'だいがくの', FALSE), (46, 3, 'ひとりです', FALSE),
    (47, 0, 'かぞくの', TRUE),   (47, 1, 'は', FALSE), (47, 2, 'わたしの', FALSE), (47, 3, 'いえです', FALSE),
    (48, 0, 'しごとです', TRUE), (48, 1, 'も', FALSE), (48, 2, 'いしゃの', FALSE), (48, 3, 'ね', FALSE),
    (49, 0, 'かいしゃの', TRUE), (49, 1, 'は', FALSE), (49, 2, 'あにの', FALSE), (49, 3, 'めいしです', FALSE),
    (50, 0, 'がっこうの', TRUE), (50, 1, 'は', FALSE), (50, 2, 'わたしの', FALSE), (50, 3, 'ともだちじゃ', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- Assertion — 200 baris opsi di-join lewat kunci integer adalah bentuk
  -- yang typo-nya menghasilkan kuis rusak diam-diam (bukan error SQL), jadi
  -- verifikasi bentuknya di sini sebelum migration dianggap sukses.
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '041: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '041: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;
END $$;
