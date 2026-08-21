-- 039_assignment_bab1_hiragana.sql — Assignment Bab 1: Tes Membaca Hiragana.
--
-- 50 soal untuk menguji kemampuan MEMBACA/DEKODING hiragana (arti kata tidak
-- diuji). Struktur mengikuti lembar tes aslinya, 7 bagian:
--   Bagian A (12) kana dasar            → section_number 1
--   Bagian B  (8) dakuten & handakuten  → section_number 2
--   Bagian C  (7) youon (ゃ ゅ ょ kecil) → section_number 3
--   Bagian D  (7) sokuon (っ kecil)      → section_number 4
--   Bagian E  (6) vokal panjang          → section_number 5
--   Bagian F  (4) kata tanpa arti        → section_number 6
--   Bagian G  (6) kalimat + partikel     → section_number 7
--
-- CATATAN FORMAT: lembar aslinya minta siswa MENGETIK romaji. Engine kuis di
-- repo ini menilai lewat quiz_options (option id), bukan string bebas —
-- question_type 'fill_blank' ada di schema tapi tidak dinilai/dirender di sisi
-- siswa. Jadi tiap soal dijadikan pilihan ganda dengan 3 pengecoh yang
-- SENGAJA merupakan salah-baca khas (dakuten hilang, っ dibaca "tsu", ゃ dibaca
-- besar, とお → "tou", partikel は/へ/を dibaca literal). Nilai diagnostiknya
-- tetap: pengecoh menunjuk jenis kesalahannya. Kalau kelak butuh versi ketik
-- (produksi, bukan pengenalan), butuh dukungan fill_blank end-to-end dulu.
--
-- question_category = 'custom' (non-JLPT): label soal jadi "Soal N" dan urutan
-- soal mengikuti sort_order admin (lihat renderQuizSections di welcome.html),
-- bukan teracak — penting karena bagian A→G bertingkat kesulitannya.
--
-- Passing 80% = 40/50 sesuai lembar aslinya; semua 50 soal dipakai per attempt
-- (questions_per_attempt NULL), cooldown 12 jam.
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama pelajaran ini
-- dihapus dulu (CASCADE ke quiz_options) lalu di-insert ulang. Kalau modul
-- target tidak ada (DB belum di-seed), migration jadi no-op yang aman.

DO $$
DECLARE
  -- Bab 1 = modul pertama kelas N5. Default ke slug modul hiragana (dipakai
  -- juga oleh migration 037); kalau tidak ada, ambil modul dengan sort_order
  -- terkecil di kursus n5.
  v_course_slug  TEXT := 'n5';
  v_module_slug  TEXT := 'hiragana-katakana';
  v_lesson_slug  TEXT := 'assignment-bab-1-hiragana';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug AND m.slug = v_module_slug
   LIMIT 1;

  IF v_module_id IS NULL THEN
    SELECT m.id, m.title INTO v_module_id, v_module_title
      FROM modules m
      JOIN courses c ON c.id = m.course_id
     WHERE c.slug = v_course_slug
     ORDER BY m.sort_order ASC, m.created_at ASC
     LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '039: modul Bab 1 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  RAISE NOTICE '039: seed Assignment Bab 1 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 1 — Tes Membaca Hiragana', 'quiz',
    E'Tes membaca hiragana: 50 soal, 7 bagian, lulus di 80% (40/50).\n\nAturan romaji yang dipakai di semua pilihan jawaban: し=shi, つ=tsu, ち=chi, ふ=fu, じ=ji. Vokal panjang ditulis persis sesuai kana (こう=kou, せい=sei, とお=too). っ menggandakan konsonan berikutnya (きって=kitte). Partikel は=wa, へ=e, を=o.\n\nYang diuji cuma kemampuan mendekode huruf — arti kata tidak diuji. Bagian F sengaja memakai kata yang bukan bahasa Jepang supaya tidak bisa ditebak dari hafalan kosakata.',
    20, 100, 80, NULL, 12
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

  -- Re-seed bersih (quiz_options ikut CASCADE). quiz_attempts lama tidak
  -- disentuh — sampled_question_ids yang menunjuk soal terhapus di-handle
  -- grader sebagai "removed from pool".
  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(num, label, instruction) AS (VALUES
    (1, 'Bagian A — Kana Dasar',
        'Baca kata berikut, lalu pilih bacaan romaji yang tepat. Ingat huruf yang bacaannya tidak beraturan: し=shi, つ=tsu, ち=chi, ふ=fu.'),
    (2, 'Bagian B — Dakuten & Handakuten',
        'Perhatikan tanda kecil di kanan atas huruf: ゛(dakuten) dan ゜(handakuten). は → ば → ぱ.'),
    (3, 'Bagian C — Yōon (ゃ ゅ ょ kecil)',
        'Huruf kecil ゃ ゅ ょ menyatu dengan huruf sebelumnya: きゃ = kya, bukan kiya.'),
    (4, 'Bagian D — Sokuon (っ kecil)',
        'っ kecil tidak dibaca tsu. Ia menggandakan konsonan berikutnya: きって = kitte.'),
    (5, 'Bagian E — Vokal Panjang',
        'Tulis panjangnya persis sesuai kana: こう = kou, せい = sei, とお = too. Jangan hilangkan dan jangan ganti hurufnya.'),
    (6, 'Bagian F — Kata Tanpa Arti',
        'Kata di bawah ini bukan kata Jepang. Tetap baca huruf per huruf dan pilih bunyinya.'),
    (7, 'Bagian G — Kalimat',
        'Pilih bacaan kalimat yang tepat. Ingat partikel: は dibaca wa, へ dibaca e, を dibaca o.')
  ), q(no, sect_num, question, explanation) AS (VALUES
    -- Bagian A
    (1,  1, 'くるま', 'く=ku, る=ru, ま=ma. ろ (ro) lebih membulat tanpa lengkung ke dalam, dan ま bukan も.'),
    (2,  1, 'そら', 'そ=so, ら=ra. Tidak ada dakuten, jadi bukan zora; ら juga bukan ろ.'),
    (3,  1, 'みせ', 'み=mi (bukan に=ni), せ=se (bukan さ=sa).'),
    (4,  1, 'ぬの', 'ぬ=nu — mirip め (me) dan ね (ne), bedanya ekor melingkar di kanan bawah. の=no.'),
    (5,  1, 'ちから', 'ち dibaca chi, bukan shi atau ti. ら=ra, bukan る=ru.'),
    (6,  1, 'まつり', 'つ ditulis tsu, bukan tu. ま=ma, bukan む (mu) atau も (mo).'),
    (7,  1, 'ゆめ', 'ゆ=yu (bukan よ=yo), め=me (bukan ぬ=nu).'),
    (8,  1, 'はれ', 'れ=re — mirip ね (ne) dan わ (wa), bedanya di ekor. は tanpa dakuten = ha.'),
    (9,  1, 'おかね', 'お=o (bukan あ=a), ね=ne (bukan わ=wa), か tanpa dakuten = ka.'),
    (10, 1, 'せなか', 'せ=se — jangan tertukar dengan さ (sa) atau そ (so). か tanpa dakuten = ka.'),
    (11, 1, 'あいて', 'あ=a (bukan お=o), て=te (bukan れ=re). Tanpa dakuten, jadi te bukan de.'),
    (12, 1, 'むすめ', 'む=mu, す=su, め=me. め (me) bukan ぬ (nu), dan む (mu) bukan す (su).'),
    -- Bagian B
    (13, 2, 'かがみ', 'Dakuten cuma ada di huruf kedua: か-が-み = kagami.'),
    (14, 2, 'みず', 'ず = す + dakuten = zu. み=mi, bukan に=ni.'),
    (15, 2, 'ぶたにく', 'ぶ = ふ + dakuten = bu. た tanpa dakuten tetap ta.'),
    (16, 2, 'でぐち', 'で=de dan ぐ=gu (dua dakuten), ち dibaca chi bukan shi.'),
    (17, 2, 'さんぽ', 'ぽ = ほ + handakuten ゜ = po. Kalau tandanya dakuten ゛baru dibaca bo.'),
    (18, 2, 'えんぴつ', 'ぴ=pi (handakuten), dan つ ditulis tsu bukan tu.'),
    (19, 2, 'ざぶとん', 'ざ=za dan ぶ=bu (dua-duanya dakuten), と tanpa dakuten = to.'),
    (20, 2, 'げんき', 'げ = け + dakuten = ge. き tidak berdakuten, jadi ki bukan gi.'),
    -- Bagian C
    (21, 3, 'しゃしん', 'しゃ = sha (ゃ kecil menyatu, bukan shiya). し tetap ditulis shi, bukan si.'),
    (22, 3, 'きゃく', 'きゃ = kya. ゃ kecil berbeda dengan や besar (kiyaku).'),
    (23, 3, 'りょうり', 'りょ = ryo, lalu う ditulis u → ryouri. う-nya jangan dihilangkan.'),
    (24, 3, 'じゅんび', 'じゅ = ju (じ + ゅ kecil). び=bi pakai dakuten, bukan handakuten ぴ.'),
    (25, 3, 'ひゃく', 'ひゃ = hya. Tidak ada dakuten, jadi bukan bya.'),
    (26, 3, 'びょうき', 'び=bi (dakuten) + ょ kecil = byo, lalu う ditulis u → byouki.'),
    (27, 3, 'ちゅうい', 'ちゅ = chu, lalu う = u dan い = i → chuui. Jangan dipangkas jadi chui.'),
    -- Bagian D
    (28, 4, 'きっぷ', 'っ menggandakan konsonan berikutnya: き + っ + ぷ = kippu, bukan kitsupu.'),
    (29, 4, 'まって', 'っ di depan て menggandakan t: matte. Tanpa っ baru mate.'),
    (30, 4, 'ざっし', 'ざ=za (dakuten) + っ + し=shi → zasshi.'),
    (31, 4, 'いっしょ', 'っ + しょ (sho) = ssho → issho. Sokuon dan youon sekaligus.'),
    (32, 4, 'とっきゅう', 'っ (gandakan k) + きゅ (kyu) + う (u) = tokkyuu. Tiga hal sekaligus.'),
    (33, 4, 'みっつ', 'っ + つ = ttsu → mittsu. つ tetap ditulis tsu, dan っ tidak boleh hilang.'),
    (34, 4, 'はっぱ', 'は + っ + ぱ (handakuten) = happa.'),
    -- Bagian E
    (35, 5, 'とおり', 'Panjangnya ditulis dengan お, jadi too- bukan tou-. Panjangnya juga tidak boleh hilang.'),
    (36, 5, 'おうさま', 'Di sini panjangnya ditulis dengan う, jadi ou- bukan oo-.'),
    (37, 5, 'えいご', 'えい ditulis ei sesuai kana. ご=go pakai dakuten.'),
    (38, 5, 'ゆうき', 'ゆ + う = yuu. Kalau kananya cuma ゆき baru dibaca yuki.'),
    (39, 5, 'おねえさん', 'Panjangnya pakai え, jadi nee — bukan nei. ね=ne, bukan め=me.'),
    (40, 5, 'こおり', 'こおり pakai お (koo-), bukan う. こ tanpa dakuten = ko.'),
    -- Bagian F
    (41, 6, 'ぬめろ', 'ぬ=nu, め=me, ろ=ro. Bukan kata Jepang — ぬ dan め mirip, jangan tertukar.'),
    (42, 6, 'きゃっぷ', 'きゃ (kya) + っ (gandakan p) + ぷ (pu) = kyappu.'),
    (43, 6, 'へずぽ', 'ず=zu (dakuten) dan ぽ=po (handakuten). Perhatikan bedanya tanda ゛dan ゜.'),
    (44, 6, 'とっしゃ', 'っ + しゃ (sha) = ssha → tossha.'),
    -- Bagian G
    (45, 7, 'わたしは がっこうへ いきます。', 'Partikel は dibaca wa dan へ dibaca e. がっこう = gakkou (っ + う).'),
    (46, 7, 'これを ください。', 'Partikel を dibaca o, bukan wo. だ=da pakai dakuten.'),
    (47, 7, 'きょうは いい てんきですね。', 'きょ=kyo + う=u → kyou. Partikel は dibaca wa.'),
    (48, 7, 'えきの まえで まって います。', 'で=de pakai dakuten, dan まって = matte karena ada っ.'),
    (49, 7, 'にほんごの べんきょうは たのしいです。', 'べんきょう = benkyou (きょ + う). Partikel は = wa, dan し ditulis shi.'),
    (50, 7, 'おおきい びょういんへ いきました。', 'おおきい pakai お (ookii), びょう = byou, dan partikel へ dibaca e.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', 'custom',
         s.num, s.label, s.instruction, q.explanation, q.no
    FROM q JOIN sect s ON s.num = q.sect_num;

  -- Opsi: baris pertama tiap soal = jawaban benar; urutan tampil diacak
  -- frontend tiap attempt (transformQuestionFromApi), jadi aman ditulis
  -- berurutan di sini.
  WITH o(qno, ord, option_text, ok) AS (VALUES
    -- Bagian A
    (1,  0, 'kuruma', TRUE), (1,  1, 'kuroma', FALSE), (1,  2, 'kurumo', FALSE), (1,  3, 'guruma', FALSE),
    (2,  0, 'sora', TRUE),   (2,  1, 'zora', FALSE),   (2,  2, 'soro', FALSE),   (2,  3, 'sara', FALSE),
    (3,  0, 'mise', TRUE),   (3,  1, 'nise', FALSE),   (3,  2, 'misa', FALSE),   (3,  3, 'mize', FALSE),
    (4,  0, 'nuno', TRUE),   (4,  1, 'meno', FALSE),   (4,  2, 'nono', FALSE),   (4,  3, 'numo', FALSE),
    (5,  0, 'chikara', TRUE),(5,  1, 'shikara', FALSE),(5,  2, 'chikaru', FALSE),(5,  3, 'jikara', FALSE),
    (6,  0, 'matsuri', TRUE),(6,  1, 'maturi', FALSE), (6,  2, 'mutsuri', FALSE),(6,  3, 'motsuri', FALSE),
    (7,  0, 'yume', TRUE),   (7,  1, 'yome', FALSE),   (7,  2, 'yunu', FALSE),   (7,  3, 'yumi', FALSE),
    (8,  0, 'hare', TRUE),   (8,  1, 'hane', FALSE),   (8,  2, 'hawa', FALSE),   (8,  3, 'bare', FALSE),
    (9,  0, 'okane', TRUE),  (9,  1, 'okawa', FALSE),  (9,  2, 'akane', FALSE),  (9,  3, 'ogane', FALSE),
    (10, 0, 'senaka', TRUE), (10, 1, 'sanaka', FALSE), (10, 2, 'sonaka', FALSE), (10, 3, 'senaga', FALSE),
    (11, 0, 'aite', TRUE),   (11, 1, 'oite', FALSE),   (11, 2, 'aire', FALSE),   (11, 3, 'aide', FALSE),
    (12, 0, 'musume', TRUE), (12, 1, 'musunu', FALSE), (12, 2, 'susume', FALSE), (12, 3, 'muzume', FALSE),
    -- Bagian B
    (13, 0, 'kagami', TRUE),   (13, 1, 'kakami', FALSE),  (13, 2, 'gagami', FALSE),   (13, 3, 'kagani', FALSE),
    (14, 0, 'mizu', TRUE),     (14, 1, 'misu', FALSE),    (14, 2, 'nizu', FALSE),     (14, 3, 'mizo', FALSE),
    (15, 0, 'butaniku', TRUE), (15, 1, 'futaniku', FALSE),(15, 2, 'budaniku', FALSE), (15, 3, 'butaniko', FALSE),
    (16, 0, 'deguchi', TRUE),  (16, 1, 'dekuchi', FALSE), (16, 2, 'tekuchi', FALSE),  (16, 3, 'degushi', FALSE),
    (17, 0, 'sanpo', TRUE),    (17, 1, 'sanbo', FALSE),   (17, 2, 'sanho', FALSE),    (17, 3, 'sanpu', FALSE),
    (18, 0, 'enpitsu', TRUE),  (18, 1, 'enbitsu', FALSE), (18, 2, 'enpitu', FALSE),   (18, 3, 'enhitsu', FALSE),
    (19, 0, 'zabuton', TRUE),  (19, 1, 'sabuton', FALSE), (19, 2, 'zafuton', FALSE),  (19, 3, 'zabudon', FALSE),
    (20, 0, 'genki', TRUE),    (20, 1, 'kenki', FALSE),   (20, 2, 'gengi', FALSE),    (20, 3, 'genke', FALSE),
    -- Bagian C
    (21, 0, 'shashin', TRUE), (21, 1, 'shiyashin', FALSE),(21, 2, 'shasin', FALSE),  (21, 3, 'sashin', FALSE),
    (22, 0, 'kyaku', TRUE),   (22, 1, 'kiyaku', FALSE),   (22, 2, 'kyoku', FALSE),   (22, 3, 'kaku', FALSE),
    (23, 0, 'ryouri', TRUE),  (23, 1, 'riyouri', FALSE),  (23, 2, 'ryuuri', FALSE),  (23, 3, 'ryori', FALSE),
    (24, 0, 'junbi', TRUE),   (24, 1, 'jiyunbi', FALSE),  (24, 2, 'shunbi', FALSE),  (24, 3, 'junpi', FALSE),
    (25, 0, 'hyaku', TRUE),   (25, 1, 'hiyaku', FALSE),   (25, 2, 'byaku', FALSE),   (25, 3, 'hyoku', FALSE),
    (26, 0, 'byouki', TRUE),  (26, 1, 'biyouki', FALSE),  (26, 2, 'hyouki', FALSE),  (26, 3, 'byuuki', FALSE),
    (27, 0, 'chuui', TRUE),   (27, 1, 'chiyuui', FALSE),  (27, 2, 'chui', FALSE),    (27, 3, 'tsuui', FALSE),
    -- Bagian D
    (28, 0, 'kippu', TRUE),   (28, 1, 'kitsupu', FALSE),  (28, 2, 'kipu', FALSE),    (28, 3, 'kibbu', FALSE),
    (29, 0, 'matte', TRUE),   (29, 1, 'matsute', FALSE),  (29, 2, 'mate', FALSE),    (29, 3, 'madde', FALSE),
    (30, 0, 'zasshi', TRUE),  (30, 1, 'zatsushi', FALSE), (30, 2, 'zashi', FALSE),   (30, 3, 'sasshi', FALSE),
    (31, 0, 'issho', TRUE),   (31, 1, 'itsusho', FALSE),  (31, 2, 'isho', FALSE),    (31, 3, 'isshi', FALSE),
    (32, 0, 'tokkyuu', TRUE), (32, 1, 'totsukyuu', FALSE),(32, 2, 'tokyuu', FALSE),  (32, 3, 'tokkyu', FALSE),
    (33, 0, 'mittsu', TRUE),  (33, 1, 'mitsu', FALSE),    (33, 2, 'mittu', FALSE),   (33, 3, 'nittsu', FALSE),
    (34, 0, 'happa', TRUE),   (34, 1, 'hatsupa', FALSE),  (34, 2, 'hapa', FALSE),    (34, 3, 'habba', FALSE),
    -- Bagian E
    (35, 0, 'toori', TRUE),   (35, 1, 'touri', FALSE),   (35, 2, 'tori', FALSE),    (35, 3, 'doori', FALSE),
    (36, 0, 'ousama', TRUE),  (36, 1, 'oosama', FALSE),  (36, 2, 'osama', FALSE),   (36, 3, 'ouzama', FALSE),
    (37, 0, 'eigo', TRUE),    (37, 1, 'eego', FALSE),    (37, 2, 'eiko', FALSE),    (37, 3, 'ego', FALSE),
    (38, 0, 'yuuki', TRUE),   (38, 1, 'yuki', FALSE),    (38, 2, 'youki', FALSE),   (38, 3, 'yuuke', FALSE),
    (39, 0, 'oneesan', TRUE), (39, 1, 'oneisan', FALSE), (39, 2, 'onesan', FALSE),  (39, 3, 'omeesan', FALSE),
    (40, 0, 'koori', TRUE),   (40, 1, 'kouri', FALSE),   (40, 2, 'kori', FALSE),    (40, 3, 'goori', FALSE),
    -- Bagian F
    (41, 0, 'numero', TRUE),  (41, 1, 'nunero', FALSE),  (41, 2, 'menero', FALSE),  (41, 3, 'numeru', FALSE),
    (42, 0, 'kyappu', TRUE),  (42, 1, 'kiyappu', FALSE), (42, 2, 'kyapu', FALSE),   (42, 3, 'kyabbu', FALSE),
    (43, 0, 'hezupo', TRUE),  (43, 1, 'hesupo', FALSE),  (43, 2, 'hezubo', FALSE),  (43, 3, 'hezupa', FALSE),
    (44, 0, 'tossha', TRUE),  (44, 1, 'totsusha', FALSE),(44, 2, 'tosha', FALSE),   (44, 3, 'dossha', FALSE),
    -- Bagian G
    (45, 0, 'watashi wa gakkou e ikimasu', TRUE),
    (45, 1, 'watashi ha gakkou he ikimasu', FALSE),
    (45, 2, 'watashi wa gakkoo e ikimasu', FALSE),
    (45, 3, 'watashi wa gakou e ikimasu', FALSE),
    (46, 0, 'kore o kudasai', TRUE),
    (46, 1, 'kore wo kudasai', FALSE),
    (46, 2, 'kore o kutasai', FALSE),
    (46, 3, 'kore wo kutasai', FALSE),
    (47, 0, 'kyou wa ii tenki desu ne', TRUE),
    (47, 1, 'kyou ha ii tenki desu ne', FALSE),
    (47, 2, 'kiyou wa ii tenki desu ne', FALSE),
    (47, 3, 'kyoo wa ii tenki desu ne', FALSE),
    (48, 0, 'eki no mae de matte imasu', TRUE),
    (48, 1, 'eki no mae te matte imasu', FALSE),
    (48, 2, 'eki no mae de mate imasu', FALSE),
    (48, 3, 'eki no mae de matsute imasu', FALSE),
    (49, 0, 'nihongo no benkyou wa tanoshii desu', TRUE),
    (49, 1, 'nihongo no benkyou ha tanoshii desu', FALSE),
    (49, 2, 'nihongo no benkiyou wa tanoshii desu', FALSE),
    (49, 3, 'nihonko no benkyou wa tanosii desu', FALSE),
    (50, 0, 'ookii byouin e ikimashita', TRUE),
    (50, 1, 'ookii byouin he ikimashita', FALSE),
    (50, 2, 'oukii byouin e ikimashita', FALSE),
    (50, 3, 'ookii biyouin e ikimashita', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;
END $$;
