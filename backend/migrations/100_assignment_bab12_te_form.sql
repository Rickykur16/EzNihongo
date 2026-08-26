-- 100_assignment_bab12_te_form.sql — Assignment Bab 12: Bentuk Te.
--
-- Ujian bab untuk Bab 12, melanjutkan pola assignment Bab 1-11
-- (039/040/041/045/047/051/053/055/057/059/061). Modul di-resolve ordinal
-- (OFFSET 11, lanjutan pola 039-061; sama dengan 062/065/081 untuk Bab 12).
--
-- JUDUL pakai TITIK DUA ('Assignment Bab 12: Bentuk Te'), bukan em dash —
-- konvensi yang ditetapkan migration 079. File 039-061 lahir sebelum 079
-- jadi judulnya di-normalisasi belakangan; migrasi baru langsung benar.
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 12 memperkenalkan 2 kanji baru — 食 dan 飲 — dan keduanya
-- justru kanji KATA KERJA, jadi untuk pertama kalinya §1/§2 bisa diisi
-- 100% konten bab itu sendiri (bukan review kanji lama seperti 059/061).
-- Whitelist badan kalimat = 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎
-- (Bab 11) + 食飲 (Bab 12), identik dengan daftar di 081_bunpou_bab12.sql.
-- CATATAN: 日 BELUM diajarkan (baru Bab 16), jadi 日本／日本語 TIDAK boleh
-- muncul di badan kalimat — dihindari total di file ini.
--
-- PAGAR KATA KERJA: DIHAPUS di migrasi ini (analog penghapusan pagar
-- partikel di 059). Alasannya struktural, bukan kelonggaran: Bab 12 adalah
-- bab konjugasi kata kerja itu sendiri, dan regex banned lama
-- '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)' justru
-- memuat token yang SEKARANG jadi materi inti — 'いて' adalah hasil sah
-- aturan く→いて (書く→書いて), dan bentuk ます/ました wajib muncul sebagai
-- kata kerja terakhir pada pola 〜て、〜. Mempertahankan pagar itu berarti
-- melarang materi bab ini sendiri. Pagar kanji (yang menegakkan level)
-- tetap ada dan justru itu yang menahan kosakata di luar level.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini.
--
-- REF_CHECK bacaan bentuk te (sumber kebenaran tunggal — inti bab ini):
--   食べる→食べて＝たべて     (Golongan 2: buang る + て)
--   見る→見て＝みて           (Golongan 2)
--   飲む→飲んで＝のんで       (む→んで)
--   読む→読んで＝よんで       (む→んで)
--   書く→書いて＝かいて       (く→いて)
--   行く→行って＝いって       (く→って — KEKECUALIAN, bukan 行いて)
--   かう→かって (う→って)     まつ→まって (つ→って)
--   およぐ→およいで (ぐ→いで) はなす→はなして (す→して)
--   する→して、くる→きて      (2 kata tidak beraturan)
--   食べもの＝たべもの         飲みもの＝のみもの
--   行きました＝いきました
--
-- DEDUP WAJIB (pola established sejak 047): 18 target <u> di file ini
-- di-cek terhadap 159 target unik yang sudah dipakai 042-061 (di-grep ulang
-- dari file migrasi sungguhan, bukan disalin dari daftar 061 yang lebih
-- pendek). Semua target di sini bentuk te / turunannya — bentuk yang belum
-- pernah ada sebelum Bab 12, jadi tabrakan memang tidak diharapkan; daftar
-- tetap ditegakkan sebagai jaring pengaman untuk migrasi berikutnya.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 = 50 soal, SEMUA ditampilkan tiap attempt,
-- lulus 70% (35/50), cooldown 12 jam.
--
-- POSISI: sort_order 100 (akhir modul) — SENGAJA tidak ada penomoran ulang.
-- Struktur Bab 12 sekarang 1..3 (Pengantar/Kosakata/Kanji) + 4/6 (Tata
-- Bahasa) + 5/7 (Tugas Bunpou); assignment memang penutup bab, jadi taruh
-- di belakang sudah benar tanpa perlu menggeser apa pun. Pola sama dengan
-- 039-061 yang juga memakai sort_order 100.
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
  v_lesson_slug  TEXT := 'assignment-bab-12-te-form';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 11 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '100: modul Bab 12 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(te-?form|konjugasi|penghubung)' THEN
    RAISE NOTICE '100: modul Bab 12 terbaca "%" — kalau ternyata bukan Bab Te-form, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '100: seed Assignment Bab 12 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 12: Bentuk Te', 'quiz',
    'Tes materi Bab 12 (Bentuk Te) gaya JLPT. Moji-Goi: cara baca bentuk te kata kerja berkanji (食べて・飲んで・読んで・書いて・見て・行って) termasuk kekecualian 行く→行って, cara menulisnya, serta kosakata kegiatan harian sesuai konteks. Tata Bahasa: konjugasi bentuk te Golongan 1 (う・つ・る→って, ぬ・ぶ・む→んで, く→いて, ぐ→いで, す→して), Golongan 2 (buang る + て), 2 kata tidak beraturan (する→して, くる→きて), menghubungkan aksi berurutan dengan 〜て、〜, dan menegaskan urutan waktu dengan 〜てから. Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
    30, 100, 70, 50, 12
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
    -- ===== もんだい1 漢字読み (1-9) — bentuk te kata kerja berkanji =====
    (1, 'vocabulary'::TEXT, 1, 'あさごはんを <u>食べて</u>、学校へ 行きます。',
        '食べて dibaca たべて. 食べる kata kerja Golongan 2, jadi bentuk te-nya cukup buang る lalu tambah て.'),
    (2, 'vocabulary', 1, 'くすりを <u>飲んで</u>、ねます。',
        '飲んで dibaca のんで. 飲む berakhiran む, dan aturan Golongan 1 untuk ぬ・ぶ・む adalah berubah jadi んで.'),
    (3, 'vocabulary', 1, '本を <u>読んで</u>、レポートを 書きます。',
        '読んで dibaca よんで. 読む berakhiran む, jadi mengikuti aturan yang sama dengan 飲む → んで.'),
    (4, 'vocabulary', 1, '名前を <u>書いて</u>、先生に わたします。',
        '書いて dibaca かいて. 書く berakhiran く, dan aturan Golongan 1 untuk く adalah berubah jadi いて.'),
    (5, 'vocabulary', 1, 'テレビを <u>見て</u>、ばんごはんを 食べます。',
        '見て dibaca みて. 見る kata kerja Golongan 2, jadi bentuk te-nya buang る lalu tambah て.'),
    (6, 'vocabulary', 1, '学校へ <u>行って</u>、ともだちに あいます。',
        '行って dibaca いって. Ini KEKECUALIAN penting: 行く berakhiran く tapi TIDAK jadi 行いて — satu-satunya kata kerja く yang berubah jadi って.'),
    (7, 'vocabulary', 1, 'ひるごはんを <u>食べてから</u>、しごとを します。',
        '食べてから dibaca たべてから. Bentuk te 食べて ditambah から untuk menegaskan urutan: makan siang selesai dulu, baru bekerja.'),
    (8, 'vocabulary', 1, 'くすりを <u>飲んでから</u>、三十分 まちます。',
        '飲んでから dibaca のんでから. Bentuk te 飲んで ditambah から — minum obatnya selesai dulu, baru menunggu.'),
    (9, 'vocabulary', 1, 'テレビを <u>見てから</u>、ねます。',
        '見てから dibaca みてから. Bentuk te 見て ditambah から untuk menegaskan urutan waktu.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'くだものを <u>たべて</u>、コーヒーを 飲みます。',
        'たべて ditulis 食べて. Salah: 飲んで (のんで, minum), 読んで (よんで, membaca), 見て (みて, melihat).'),
    (11, 'vocabulary', 2, 'みずを <u>のんで</u>、ねました。',
        'のんで ditulis 飲んで. Salah: 食べて (たべて, makan), 読んで (よんで, membaca), 見て (みて, melihat).'),
    (12, 'vocabulary', 2, 'しんぶんを <u>よんで</u>、しごとを します。',
        'よんで ditulis 読んで. Salah: 飲んで (のんで, minum), 食べて (たべて, makan), 書いて (かいて, menulis).'),
    (13, 'vocabulary', 2, 'てがみを <u>かいて</u>、ともだちに おくります。',
        'かいて ditulis 書いて. Salah: 読んで (よんで, membaca), 見て (みて, melihat), 行って (いって, pergi).'),
    (14, 'vocabulary', 2, 'えいがを <u>みて</u>、うちへ かえりました。',
        'みて ditulis 見て. Salah: 食べて (たべて, makan), 飲んで (のんで, minum), 書いて (かいて, menulis).'),
    (15, 'vocabulary', 2, '駅へ <u>いって</u>、電車に のります。',
        'いって ditulis 行って. Salah: 見て (みて, melihat), 書いて (かいて, menulis), 食べて (たべて, makan).'),
    (16, 'vocabulary', 2, 'すきな <u>たべもの</u>は なんですか。',
        'たべもの ditulis 食べもの (makanan). Salah: 飲みもの (のみもの, minuman), 読みもの (よみもの, bacaan), 見もの (みもの, tontonan).'),
    (17, 'vocabulary', 2, 'けさ コーヒーを <u>のみました</u>。',
        'のみました ditulis 飲みました (minum, bentuk lampau). Salah: 食べました (たべました, makan), 見ました (みました, melihat), 書きました (かきました, menulis).'),
    (18, 'vocabulary', 2, 'きのう 学校へ <u>いきました</u>。',
        'いきました ditulis 行きました (pergi, bentuk lampau). Salah: 見ました (みました), 読みました (よみました), 書きました (かきました).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata kegiatan harian =====
    (19, 'vocabulary', 3, 'あさ おきてから、（　）を あびます。',
        'Jawabannya シャワー (shower), yang dipakai dengan kata kerja あびる. せんたく, そうじ, かいもの tidak dipakai dengan あびる.'),
    (20, 'vocabulary', 3, 'よる、（　）を してから ねます。',
        'Jawabannya はみがき (sikat gigi), kegiatan sebelum tidur. せんたく, さんぽ, りょうり bukan kegiatan membersihkan gigi.'),
    (21, 'vocabulary', 3, 'よごれた ふくを（　）します。',
        'Jawabannya せんたく (mencuci pakaian), sesuai objek ふく yang kotor. そうじ, かいもの, りょうり tidak berkaitan dengan mencuci baju.'),
    (22, 'vocabulary', 3, 'へやを きれいに（　）します。',
        'Jawabannya そうじ (bersih-bersih), sesuai objek へや. せんたく, さんぽ, はみがき tidak dipakai untuk membersihkan ruangan.'),
    (23, 'vocabulary', 3, 'スーパーで（　）を してから、うちへ かえります。',
        'Jawabannya かいもの (belanja), kegiatan yang dilakukan di スーパー. そうじ, はみがき, さんぽ tidak dilakukan di supermarket.'),
    (24, 'vocabulary', 3, 'だいどころで（　）を して、ばんごはんを つくります。',
        'Jawabannya りょうり (memasak), kegiatan di だいどころ (dapur). せんたく, かいもの, はみがき bukan kegiatan memasak.'),
    (25, 'vocabulary', 3, 'ゆうがた こうえんで（　）を します。',
        'Jawabannya さんぽ (jalan-jalan), kegiatan yang lazim di taman. そうじ, せんたく, はみがき tidak dilakukan di taman.'),
    (26, 'vocabulary', 3, 'あさ おきて、（　）を あらいます。',
        'Jawabannya かお (wajah), yang dicuci setelah bangun tidur. みず, でんき, まど tidak cocok sebagai objek あらう di pagi hari.'),
    (27, 'vocabulary', 3, 'へやが くらいです。（　）を つけます。',
        'Jawabannya でんき (lampu), yang dinyalakan saat ruangan gelap. まど, みず, かお tidak dinyalakan.'),
    (28, 'vocabulary', 3, 'あついですから、（　）を あけます。',
        'Jawabannya まど (jendela), yang dibuka saat kepanasan. でんき, かお, みず bukan benda yang dibuka.'),
    (29, 'vocabulary', 3, 'のどが かわきました。（　）を 飲みます。',
        'Jawabannya みず (air), yang diminum saat haus. でんき, まど, かお bukan benda yang bisa diminum.'),
    (30, 'vocabulary', 3, 'しごとが おわってから、（　）へ かえります。',
        'Jawabannya うち (rumah), tempat yang dituju dengan かえる setelah kerja selesai. えき, こうえん, スーパー bukan tempat "pulang".'),

    -- ===== もんだい1 文の文法1 (31-50) — 5 pola grammar Bab 12 =====
    -- Pola 1: Te-form Golongan 1 / u-verbs (31-36)
    (31, 'grammar'::TEXT, 1, 'スーパーで パンを（　）、うちへ かえりました。',
        'Jawabannya かって — かう berakhiran う, dan aturan Golongan 1 untuk う・つ・る adalah berubah jadi って.'),
    (32, 'grammar', 1, 'くすりを（　）から、ねます。',
        'Jawabannya 飲んで — 飲む berakhiran む, dan aturan untuk ぬ・ぶ・む adalah berubah jadi んで. 飲みて／飲って／飲いて bukan bentuk te yang benar.'),
    (33, 'grammar', 1, '名前を（　）から、テストを はじめます。',
        'Jawabannya 書いて — 書く berakhiran く, dan aturan untuk く adalah berubah jadi いて. 書きて／書って／書んで bukan bentuk te yang benar.'),
    (34, 'grammar', 1, 'うみで（　）から、ひるごはんを 食べます。',
        'Jawabannya およいで — およぐ berakhiran ぐ, dan aturan untuk ぐ adalah berubah jadi いで (bersuara, bukan いて).'),
    (35, 'grammar', 1, 'せんせいと（　）から、うちへ かえります。',
        'Jawabannya はなして — はなす berakhiran す, dan aturan untuk す adalah berubah jadi して.'),
    (36, 'grammar', 1, '学校へ（　）から、ともだちに あいます。',
        'Jawabannya 行って — 行く adalah KEKECUALIAN: walaupun berakhiran く, bentuk te-nya って bukan いて. 行いて justru bentuk yang salah.'),

    -- Pola 2: Te-form Golongan 2 / ru-verbs (37-39)
    (37, 'grammar', 1, 'ひるごはんを（　）から、しごとを します。',
        'Jawabannya 食べて — 食べる kata kerja Golongan 2, bentuk te-nya cukup buang る lalu tambah て. Aturan って／んで／いて hanya untuk Golongan 1.'),
    (38, 'grammar', 1, 'テレビを（　）から、ねます。',
        'Jawabannya 見て — 見る kata kerja Golongan 2, jadi buang る lalu tambah て.'),
    (39, 'grammar', 1, 'あさ 六時に（　）、かおを あらいます。',
        'Jawabannya おきて — おきる kata kerja Golongan 2 (berakhiran きる), jadi buang る lalu tambah て.'),

    -- Pola 3: Te-form tidak beraturan する／くる (40-42)
    (40, 'grammar', 1, 'べんきょうを（　）から、あそびます。',
        'Jawabannya して — する adalah kata kerja tidak beraturan, bentuk te-nya して. Wajib dihafal karena tidak mengikuti pola Golongan 1 maupun 2.'),
    (41, 'grammar', 1, 'ともだちが うちへ（　）、いっしょに 食べました。',
        'Jawabannya きて — くる adalah kata kerja tidak beraturan, bentuk te-nya きて (bukan くて). Wajib dihafal.'),
    (42, 'grammar', 1, 'さんぽを（　）から、シャワーを あびます。',
        'Jawabannya して — さんぽを する memakai する, jadi bentuk te-nya して, sama seperti べんきょうを する → べんきょうを して.'),

    -- Pola 4: 〜て、〜 penghubung aksi berurutan (43-46)
    (43, 'grammar', 1, 'あさ おきて、かおを あらって、ごはんを（　）。',
        'Jawabannya 食べます — pada pola 〜て、〜 hanya kata kerja TERAKHIR yang memakai bentuk ます; おきて dan あらって sebelumnya sudah bentuk te.'),
    (44, 'grammar', 1, 'うちへ かえって、シャワーを あびて、ばんごはんを（　）。',
        'Jawabannya 食べました — kata kerja terakhir yang menentukan kala kalimat, dan di sini lampau. かえって／あびて tetap bentuk te.'),
    (45, 'grammar', 1, '本を（　）、ねます。',
        'Jawabannya 読んで — kata kerja yang BUKAN terakhir harus bentuk te. 読みます／読む tidak bisa menyambung langsung ke kalimat berikutnya, 読みて bukan bentuk te yang benar.'),
    (46, 'grammar', 1, '学校へ（　）、べんきょうします。',
        'Jawabannya 行って — kata kerja penyambung memakai bentuk te, dan kata kerja terakhir べんきょうします yang memakai bentuk ます.'),

    -- Pola 5: 〜てから urutan tegas (47-50)
    (47, 'grammar', 1, 'ごはんを（　）から、くすりを 飲みます。',
        'Jawabannya 食べて — pola 〜てから dibentuk dari bentuk te + から, jadi yang mendahului から wajib bentuk te, bukan 食べます／食べ／食べた.'),
    (48, 'grammar', 1, 'シャワーを あびて（　）、ねます。',
        'Jawabannya から — 〜てから menegaskan urutan: mandi selesai dulu, baru tidur. まで (sampai), ながら (sambil), ので (karena) tidak membentuk pola urutan ini.'),
    (49, 'grammar', 1, 'しごとが（　）から、うちへ かえります。',
        'Jawabannya おわって — sebelum から wajib bentuk te. おわる kata kerja Golongan 1 berakhiran る, jadi bentuk te-nya おわって.'),
    (50, 'grammar', 1, 'くすりを 飲んで（　）、三十分 まちます。',
        'Jawabannya から — 〜てから menegaskan minum obatnya selesai dulu, baru menunggu. まで, ながら, より tidak menyatakan urutan "setelah selesai".')
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
    (1, 0, 'たべて', TRUE), (1, 1, 'のんで', FALSE), (1, 2, 'よんで', FALSE), (1, 3, 'みて', FALSE),
    (2, 0, 'のんで', TRUE), (2, 1, 'たべて', FALSE), (2, 2, 'よんで', FALSE), (2, 3, 'のみて', FALSE),
    (3, 0, 'よんで', TRUE), (3, 1, 'のんで', FALSE), (3, 2, 'かいて', FALSE), (3, 3, 'よみて', FALSE),
    (4, 0, 'かいて', TRUE), (4, 1, 'きいて', FALSE), (4, 2, 'かって', FALSE), (4, 3, 'かきて', FALSE),
    (5, 0, 'みて', TRUE), (5, 1, 'みって', FALSE), (5, 2, 'みいて', FALSE), (5, 3, 'けんて', FALSE),
    (6, 0, 'いって', TRUE), (6, 1, 'いいて', FALSE), (6, 2, 'いきて', FALSE), (6, 3, 'ぎょうて', FALSE),
    (7, 0, 'たべてから', TRUE), (7, 1, 'のんでから', FALSE), (7, 2, 'みてから', FALSE), (7, 3, 'たべますから', FALSE),
    (8, 0, 'のんでから', TRUE), (8, 1, 'たべてから', FALSE), (8, 2, 'よんでから', FALSE), (8, 3, 'のみてから', FALSE),
    (9, 0, 'みてから', TRUE), (9, 1, 'たべてから', FALSE), (9, 2, 'いってから', FALSE), (9, 3, 'みますから', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '食べて', TRUE), (10, 1, '飲んで', FALSE), (10, 2, '読んで', FALSE), (10, 3, '見て', FALSE),
    (11, 0, '飲んで', TRUE), (11, 1, '食べて', FALSE), (11, 2, '読んで', FALSE), (11, 3, '見て', FALSE),
    (12, 0, '読んで', TRUE), (12, 1, '飲んで', FALSE), (12, 2, '食べて', FALSE), (12, 3, '書いて', FALSE),
    (13, 0, '書いて', TRUE), (13, 1, '読んで', FALSE), (13, 2, '見て', FALSE), (13, 3, '行って', FALSE),
    (14, 0, '見て', TRUE), (14, 1, '食べて', FALSE), (14, 2, '飲んで', FALSE), (14, 3, '書いて', FALSE),
    (15, 0, '行って', TRUE), (15, 1, '見て', FALSE), (15, 2, '書いて', FALSE), (15, 3, '食べて', FALSE),
    (16, 0, '食べもの', TRUE), (16, 1, '飲みもの', FALSE), (16, 2, '読みもの', FALSE), (16, 3, '見もの', FALSE),
    (17, 0, '飲みました', TRUE), (17, 1, '食べました', FALSE), (17, 2, '見ました', FALSE), (17, 3, '書きました', FALSE),
    (18, 0, '行きました', TRUE), (18, 1, '見ました', FALSE), (18, 2, '読みました', FALSE), (18, 3, '書きました', FALSE),

    -- 文脈規定
    (19, 0, 'シャワー', TRUE), (19, 1, 'せんたく', FALSE), (19, 2, 'そうじ', FALSE), (19, 3, 'かいもの', FALSE),
    (20, 0, 'はみがき', TRUE), (20, 1, 'せんたく', FALSE), (20, 2, 'さんぽ', FALSE), (20, 3, 'りょうり', FALSE),
    (21, 0, 'せんたく', TRUE), (21, 1, 'そうじ', FALSE), (21, 2, 'かいもの', FALSE), (21, 3, 'りょうり', FALSE),
    (22, 0, 'そうじ', TRUE), (22, 1, 'せんたく', FALSE), (22, 2, 'さんぽ', FALSE), (22, 3, 'はみがき', FALSE),
    (23, 0, 'かいもの', TRUE), (23, 1, 'そうじ', FALSE), (23, 2, 'はみがき', FALSE), (23, 3, 'さんぽ', FALSE),
    (24, 0, 'りょうり', TRUE), (24, 1, 'せんたく', FALSE), (24, 2, 'かいもの', FALSE), (24, 3, 'はみがき', FALSE),
    (25, 0, 'さんぽ', TRUE), (25, 1, 'そうじ', FALSE), (25, 2, 'せんたく', FALSE), (25, 3, 'はみがき', FALSE),
    (26, 0, 'かお', TRUE), (26, 1, 'みず', FALSE), (26, 2, 'でんき', FALSE), (26, 3, 'まど', FALSE),
    (27, 0, 'でんき', TRUE), (27, 1, 'まど', FALSE), (27, 2, 'みず', FALSE), (27, 3, 'かお', FALSE),
    (28, 0, 'まど', TRUE), (28, 1, 'でんき', FALSE), (28, 2, 'かお', FALSE), (28, 3, 'みず', FALSE),
    (29, 0, 'みず', TRUE), (29, 1, 'でんき', FALSE), (29, 2, 'まど', FALSE), (29, 3, 'かお', FALSE),
    (30, 0, 'うち', TRUE), (30, 1, 'えき', FALSE), (30, 2, 'こうえん', FALSE), (30, 3, 'スーパー', FALSE),

    -- 文の文法1 — Golongan 1
    (31, 0, 'かって', TRUE), (31, 1, 'かいて', FALSE), (31, 2, 'かんで', FALSE), (31, 3, 'かして', FALSE),
    (32, 0, '飲んで', TRUE), (32, 1, '飲みて', FALSE), (32, 2, '飲って', FALSE), (32, 3, '飲いて', FALSE),
    (33, 0, '書いて', TRUE), (33, 1, '書きて', FALSE), (33, 2, '書って', FALSE), (33, 3, '書んで', FALSE),
    (34, 0, 'およいで', TRUE), (34, 1, 'およぎて', FALSE), (34, 2, 'およんで', FALSE), (34, 3, 'およって', FALSE),
    (35, 0, 'はなして', TRUE), (35, 1, 'はなって', FALSE), (35, 2, 'はないて', FALSE), (35, 3, 'はなしって', FALSE),
    (36, 0, '行って', TRUE), (36, 1, '行いて', FALSE), (36, 2, '行きて', FALSE), (36, 3, '行んで', FALSE),

    -- Golongan 2
    (37, 0, '食べて', TRUE), (37, 1, '食べって', FALSE), (37, 2, '食べんで', FALSE), (37, 3, '食べいて', FALSE),
    (38, 0, '見て', TRUE), (38, 1, '見って', FALSE), (38, 2, '見いて', FALSE), (38, 3, '見んで', FALSE),
    (39, 0, 'おきて', TRUE), (39, 1, 'おきって', FALSE), (39, 2, 'おきんで', FALSE), (39, 3, 'おきいて', FALSE),

    -- Tidak beraturan
    (40, 0, 'して', TRUE), (40, 1, 'しって', FALSE), (40, 2, 'すて', FALSE), (40, 3, 'さして', FALSE),
    (41, 0, 'きて', TRUE), (41, 1, 'くて', FALSE), (41, 2, 'こて', FALSE), (41, 3, 'きって', FALSE),
    (42, 0, 'して', TRUE), (42, 1, 'しって', FALSE), (42, 2, 'せて', FALSE), (42, 3, 'さって', FALSE),

    -- 〜て、〜
    (43, 0, '食べます', TRUE), (43, 1, '食べて', FALSE), (43, 2, '食べ', FALSE), (43, 3, '食べてから', FALSE),
    (44, 0, '食べました', TRUE), (44, 1, '食べて', FALSE), (44, 2, '食べ', FALSE), (44, 3, '食べてから', FALSE),
    (45, 0, '読んで', TRUE), (45, 1, '読みます', FALSE), (45, 2, '読みて', FALSE), (45, 3, '読み', FALSE),
    (46, 0, '行って', TRUE), (46, 1, '行きます', FALSE), (46, 2, '行きて', FALSE), (46, 3, '行き', FALSE),

    -- 〜てから
    (47, 0, '食べて', TRUE), (47, 1, '食べます', FALSE), (47, 2, '食べ', FALSE), (47, 3, '食べました', FALSE),
    (48, 0, 'から', TRUE), (48, 1, 'まで', FALSE), (48, 2, 'ながら', FALSE), (48, 3, 'ので', FALSE),
    (49, 0, 'おわって', TRUE), (49, 1, 'おわります', FALSE), (49, 2, 'おわり', FALSE), (49, 3, 'おわりて', FALSE),
    (50, 0, 'から', TRUE), (50, 1, 'まで', FALSE), (50, 2, 'ながら', FALSE), (50, 3, 'より', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '100: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '100: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12). Daftar identik dengan 081_bunpou_bab12.sql. 日 SENGAJA
  --    tidak ada (baru Bab 16), jadi 日本／日本語 memang tidak dipakai.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '100: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION (dihapus sejak 059).
  -- 3. Kata kerja: TIDAK ADA ASSERTION (dihapus di migrasi ini — lihat
  --    header: Bab 12 adalah bab konjugasi kata kerja, token yang dulu
  --    dilarang justru materi intinya).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '100: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '100: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '100: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    159 target unik yang sudah dipakai di 042-061 (di-grep ulang dari
  --    file migrasi sungguhan; daftar di 061 lebih pendek karena hanya
  --    mencakup sampai 059).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いんど','えきまえ','かきます','がいこく','がくせい','がっこう','きゅうにん',
         'きゅうひゃくえん','くじかん','くに','こくどう','ごご','ごじ','ごじゅうにん',
         'ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん',
         'さかな','さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん',
         'じゅうにじ','じゅうにん','じゅっぽん','じょうげ','せんえん','せんげつ','せんせい',
         'せんにん','ぜんご','たい','ちゅうかん','ちゅうがくせい','ちゅうねん','とうざい',
         'ななひゃくえん','なに','なんじ','なんせい','なんとう','なんねん','なんぼく',
         'にじゅうにん','にせんえん','にねんせい','にひゃくえん','にほん','はちじ','はちにん',
         'はな','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい',
         'ほくとう','ほん','まいにち','まんえん','みました','よにん','よねんせい','よみました',
         'よんじゅうにん','よんほん','ろくにん',
         '一人','一分','一時','一本','七人','七分','三十人','三十分','三時','三本','三百円',
         '上','下','中','中国','九時','二人','二十歳','二時','二百人','人気','人間','何人',
         '何年生','何本','先生','先週','八時半','八百円','六分','六年生','六時','六本','六百円',
         '前','北','十分','十時','南','古い','右','名前','四時','国','外','大学生','女',
         '女の人','学校','学生','安い','左','後ろ','新しい','日本','日本人','日本語',
         '書きました','本','東','毎月','毎週','気分','男','男の人','男女','留学生','白い','花',
         '行','西','見ません','読みます','車','道','長い','電車','韓国人','駅','高い','高校',
         '高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '100: ada target <u> yang sudah pernah diujikan di migration 042-061';
  END IF;

  RAISE NOTICE '100: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
