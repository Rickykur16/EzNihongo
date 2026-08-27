-- 105_assignment_bab15_pelayanan_perubahan.sql — Assignment Bab 15: Bahasa
-- Pelayanan & Perubahan.
--
-- Ujian bab untuk Bab 15, melanjutkan pola assignment Bab 1-14
-- (039/040/041/045/047/051/053/055/057/059/061/100/102/104/103). Modul
-- di-resolve ordinal (OFFSET 14, lanjutan pola 039-104).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 15 memperkenalkan 7 kanji BARU — 言(いう)・話(はなす)・聞(きく)・
-- 買(かう)・店(みせ)・会(あう)・社(かいしゃ, cuma dipakai dalam 会社) —
-- dikonfirmasi header 084_bunpou_bab15.sql. Karena ADA kanji baru,
-- もんだい1/2 mengikuti pola 103 (Bab 14): diisi 100% kanji baru bab ini
-- sendiri sebagai KOSAKATA polos (言います／話します／聞きます／買います／
-- 会います／お店／電話／会社／店の人), BUKAN dikonjugasi memakai salah
-- satu dari 6 pola grammar Bab 15 — beda dari 100/102/103 (Bab 12-14) yang
-- babnya sendiri bertema konjugasi kata kerja (te-form/progresif/nai-form)
-- sehingga もんだい1/2 alami diisi bentuk konjugasi. Bab 15 bertema
-- "bahasa pelayanan" (frasa tetap: 〜を…お願いします／〜はいかがですか／
-- 〜になります／お〜ください／〜にします／〜くなります) yang kata
-- kerjanya sendiri tidak bervariasi per pola, jadi memaksakan konjugasi di
-- もんだい1/2 tidak alami — kosakata polos gaya 039-061 lebih pas, dan
-- ke-6 pola grammar tetap diuji penuh di もんだい1 文の文法1.
--
-- Whitelist kanji = whitelist 100/102/104/103 UNION 言話聞買店会社 (SAMA
-- PERSIS dengan v_kanji_ok di 084_bunpou_bab15.sql).
--
-- PAGAR KATA KERJA: TIDAK RELEVAN di sini (もんだい1/2 kosakata polos,
-- bukan konjugasi kata kerja) — tidak ada assertion kata kerja di file ini,
-- konsisten dengan 100/102/104/103 yang sudah menghapusnya sejak 100.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini.
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   言います＝いいます   話します＝はなします   聞きます＝ききます
--   買います＝かいます   会います＝あいます   お店＝おみせ
--   電話＝でんわ   会社＝かいしゃ   店の人＝みせのひと
--
-- JEBAKAN PAGAR "RANTAI の": satu-satunya の di もんだい1/2 ada di
-- "店の人"/"みせのひと" (soal ke-9/18) — cuma SATU の, aman (sudah dicek
-- manual, tidak ada kata/frasa ber-の ganda lain di section ini).
--
-- DEDUP WAJIB (pola established sejak 047, DIPERBAIKI di migrasi ini —
-- lihat catatan di CLAUDE.md): array di bawah adalah HASIL GREP ULANG
-- LENGKAP `<u>...</u>` dari SEMUA migrasi assignment 039-104 yang benar-
-- benar ada di repo saat ini (215 target unik), bukan disusun incremental
-- dari catatan migrasi sebelumnya (pendekatan incremental itu yang
-- sebelumnya sempat salah hitung lantaran pola glob shell yang keliru
-- melewatkan file 039 dan 055 — lihat riwayat sesi). 9 pasang target baru
-- di file ini (もんだい1/2) sudah diverifikasi tidak beririsan dengan
-- daftar ini.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (4/3/3/4/3/3 per pola: 〜を…お願いします／
-- 〜はいかがですか／〜になります(keigo)／お〜ください／〜にします／
-- 〜くなります・〜になります) = 50 soal, SEMUA ditampilkan tiap attempt,
-- lulus 70% (35/50), cooldown 12 jam.
--
-- Pola grammar fixed-phrase (お願いします／いかがですか／になります／
-- にします) tidak punya variasi kata kerja alami untuk dijadikan distraktor
-- konjugasi (beda dari pola verb-conjugation Bab 12-14), jadi opsi salah
-- di もんだい1 文の文法1 untuk 4 pola ini memakai CROSS-PATTERN — opsi
-- salah adalah 3 frasa tetap LAIN dari 6 pola Bab 15, menguji siswa
-- memilih pola yang tepat untuk konteks (gaya JLPT 文法 asli). Dua pola
-- お〜ください dan 〜くなります/〜になります tetap SELF-CONTAINED (opsi
-- salah = bentuk konjugasi lain dari kata kerja/kata sifat yang sama),
-- konsisten dengan gaya 100/102/103.
--
-- もんだい3 文脈規定: 12 kosakata fungsional dari bank kosakata Bab 15
-- (073_bab15_intro_kosakata_kanji.sql) — いらっしゃいませ／かしこまりました／
-- おかいけい／げんきん／くれじっとかーど／おつり／れしーと／ちゅうもん／
-- よやく／へや／のみもの／たべもの. SEMUA ditulis kana/katakana polos
-- (bukan お会計／現金／クレジットカード dst dengan kanji) karena section
-- ini TIDAK memakai <u> — seluruh kolom question kena pagar whitelist, dan
-- kanji seperti 現／計／約／屋／物 belum diajarkan.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-104.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) cuma
-- menjalankan file ini SEKALI per DB.
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus
-- lalu di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_bab_no       INT  := 15;
  v_title_re     TEXT := '(pelayanan|komunikasi|service)';
  v_lesson_slug  TEXT := 'assignment-bab-15-pelayanan-perubahan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '105: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '105: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '105: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 15: Bahasa Pelayanan & Perubahan', 'quiz',
    'Tes materi Bab 15 (Bahasa Pelayanan & Perubahan) gaya JLPT. Moji-Goi: cara baca dan menulis 7 kanji baru (言う・話す・聞く・買う・店・会う・社, khusus dalam kata 会社) sebagai kosakata dasar, serta kosakata fungsional pelayanan (いらっしゃいませ・かしこまりました・おかいけい・げんきん・れしーと dst). Tata Bahasa: 〜を…お願いします (memesan/meminta), 〜はいかがですか (menawarkan), 〜になります (keigo, menyebut total), お〜ください (mempersilakan hormat), 〜にします (memutuskan), 〜くなります／〜になります (perubahan keadaan). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 7 kanji baru (言/話/聞/買/店/会/社) sebagai kosakata polos =====
    (1, 'vocabulary'::TEXT, 1, '名前を <u>言います</u>。',
        '言います dibaca いいます. 言う kata kerja dasar untuk "berkata/mengatakan".'),
    (2, 'vocabulary', 1, '先生と <u>話します</u>。',
        '話します dibaca はなします. 話す kata kerja dasar untuk "berbicara".'),
    (3, 'vocabulary', 1, 'ラジオを <u>聞きます</u>。',
        '聞きます dibaca ききます. 聞く kata kerja dasar untuk "mendengar/mendengarkan" (juga dipakai untuk "bertanya").'),
    (4, 'vocabulary', 1, 'パンを <u>買います</u>。',
        '買います dibaca かいます. 買う kata kerja dasar untuk "membeli".'),
    (5, 'vocabulary', 1, 'ともだちに <u>会います</u>。',
        '会います dibaca あいます. 会う kata kerja dasar untuk "bertemu".'),
    (6, 'vocabulary', 1, 'あれは <u>お店</u>です。',
        'お店 dibaca おみせ. 店 kata benda untuk "toko".'),
    (7, 'vocabulary', 1, 'これは <u>電話</u>です。',
        '電話 dibaca でんわ. 電 (Bab 9) + 話 (Bab 15) membentuk kata "telepon".'),
    (8, 'vocabulary', 1, 'ちちは <u>会社</u>で はたらきます。',
        '会社 dibaca かいしゃ. 会 + 社 membentuk kata "perusahaan" — 社 hanya dipakai dalam kata ini di level N5.'),
    (9, 'vocabulary', 1, '<u>店の人</u>は しんせつです。',
        '店の人 dibaca みせのひと. 店 (toko) + の + 人 (orang) = "orang toko/pelayan toko".'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'なまえを <u>いいます</u>。',
        'いいます ditulis 言います. Salah: 話します (はなします, berbicara), 聞きます (ききます, mendengar), 買います (かいます, membeli).'),
    (11, 'vocabulary', 2, 'せんせいと <u>はなします</u>。',
        'はなします ditulis 話します. Salah: 言います (いいます, berkata), 聞きます (ききます, mendengar), 会います (あいます, bertemu).'),
    (12, 'vocabulary', 2, 'らじおを <u>ききます</u>。',
        'ききます ditulis 聞きます. Salah: 話します (はなします, berbicara), 買います (かいます, membeli), 会います (あいます, bertemu).'),
    (13, 'vocabulary', 2, 'ぱんを <u>かいます</u>。',
        'かいます ditulis 買います. Salah: 言います (いいます, berkata), 聞きます (ききます, mendengar), 会います (あいます, bertemu).'),
    (14, 'vocabulary', 2, 'ともだちに <u>あいます</u>。',
        'あいます ditulis 会います. Salah: 話します (はなします, berbicara), 聞きます (ききます, mendengar), 買います (かいます, membeli).'),
    (15, 'vocabulary', 2, 'あれは <u>おみせ</u>です。',
        'おみせ ditulis お店. Salah: 電話 (でんわ, telepon), 会社 (かいしゃ, perusahaan), 店の人 (みせのひと, pelayan toko).'),
    (16, 'vocabulary', 2, 'これは <u>でんわ</u>です。',
        'でんわ ditulis 電話. Salah: お店 (おみせ, toko), 会社 (かいしゃ, perusahaan), 店の人 (みせのひと, pelayan toko).'),
    (17, 'vocabulary', 2, 'ちちは <u>かいしゃ</u>で はたらきます。',
        'かいしゃ ditulis 会社. Salah: お店 (おみせ, toko), 電話 (でんわ, telepon), 店の人 (みせのひと, pelayan toko).'),
    (18, 'vocabulary', 2, '<u>みせのひと</u>は しんせつです。',
        'みせのひと ditulis 店の人. Salah: お店 (おみせ, toko), 電話 (でんわ, telepon), 会社 (かいしゃ, perusahaan).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata fungsional bahasa pelayanan =====
    (19, 'vocabulary', 3, '店に 人が きます。店の人は「（　）」と 言います。',
        'Jawabannya いらっしゃいませ (selamat datang), sapaan khas pelayan toko/restoran ke pelanggan yang datang. かしこまりました, おかいけい, よやく tidak cocok sebagai sapaan.'),
    (20, 'vocabulary', 3, '人に 何か おねがいされたら、店の人は「（　）」と 言って ひきうけます。',
        'Jawabannya かしこまりました (baik, dengan hormat), respon formal saat menerima permintaan. いらっしゃいませ, おつり, ちゅうもん tidak cocok sebagai respon menerima permintaan.'),
    (21, 'vocabulary', 3, 'レストランで 食べおわったら、（　）を おねがいします。',
        'Jawabannya おかいけい (tagihan/bill). れしーと, おつり, ちゅうもん tidak cocok diminta setelah selesai makan.'),
    (22, 'vocabulary', 3, 'カードじゃなくて、（　）で はらいます。',
        'Jawabannya げんきん (uang tunai), lawan dari kartu. くれじっとかーど, おかいけい, れしーと tidak cocok untuk "bukan kartu".'),
    (23, 'vocabulary', 3, 'げんきんが ないから、（　）で はらいます。',
        'Jawabannya くれじっとかーど (kartu kredit), dipakai kalau tidak ada uang tunai. げんきん, おつり, れしーと tidak cocok sebagai alat bayar pengganti tunai.'),
    (24, 'vocabulary', 3, '千円 出したら、店の人が（　）を くれました。',
        'Jawabannya おつり (kembalian), diberikan kalau uang yang dibayar lebih besar dari harga. れしーと, げんきん, おかいけい tidak cocok sebagai sesuatu yang diberikan kembali.'),
    (25, 'vocabulary', 3, 'お店で かいものすると、（　）を もらいます。',
        'Jawabannya れしーと (struk), bukti belanja. おつり, おかいけい, げんきん tidak cocok sebagai bukti tertulis belanja.'),
    (26, 'vocabulary', 3, '食べたいメニューを 店の人に（　）します。',
        'Jawabannya ちゅうもん (memesan). よやく, へや, かしこまりました tidak cocok untuk memilih menu ke pelayan.'),
    (27, 'vocabulary', 3, 'ホテルの へやを 前もって（　）しました。',
        'Jawabannya よやく (reservasi), dilakukan sebelum datang. ちゅうもん, へや, いらっしゃいませ tidak cocok untuk mengamankan tempat sebelumnya.'),
    (28, 'vocabulary', 3, 'ホテルで 一ばん とまる ところを（　）と いいます。',
        'Jawabannya へや (kamar). よやく, のみもの, たべもの tidak cocok sebagai tempat menginap.'),
    (29, 'vocabulary', 3, 'のどが かわいたから、（　）が ほしいです。',
        'Jawabannya のみもの (minuman), cocok untuk tenggorokan kering. たべもの, へや, げんきん tidak cocok untuk rasa haus.'),
    (30, 'vocabulary', 3, 'おなかが すいたから、（　）が ほしいです。',
        'Jawabannya たべもの (makanan), cocok untuk perut lapar. のみもの, へや, げんきん tidak cocok untuk rasa lapar.'),

    -- ===== もんだい1 文の文法1 (31-50) — 6 pola grammar Bab 15 (4/3/3/4/3/3) =====
    -- Pola 1: 〜を…お願いします (31-34) — opsi cross-pattern
    (31, 'grammar'::TEXT, 1, 'コーヒーを 二つ（　）。「おねがいします。」',
        'Jawabannya おねがいします — pola 〜を[jumlah]お願いします dipakai untuk memesan/meminta dengan sopan. いかがですか (menawarkan), になります (menyebut total), にします (memutuskan) tidak tepat untuk meminta pesanan.'),
    (32, 'grammar', 1, 'この 本を 三さつ（　）。「おねがいします。」',
        'Jawabannya おねがいします — meminta buku dengan sopan memakai pola 〜を[jumlah]お願いします. いかがですか, になります, にします tidak tepat.'),
    (33, 'grammar', 1, 'さかなを 一ぴき（　）。「おねがいします。」',
        'Jawabannya おねがいします — memesan ikan dengan sopan memakai pola 〜を[jumlah]お願いします. いかがですか, になります, にします tidak tepat.'),
    (34, 'grammar', 1, 'タクシーを 一だい（　）。「おねがいします。」',
        'Jawabannya おねがいします — memesan taksi dengan sopan memakai pola 〜を[jumlah]お願いします. いかがですか, になります, にします tidak tepat.'),

    -- Pola 2: 〜はいかがですか (35-37) — opsi cross-pattern
    (35, 'grammar', 1, '「コーヒーは（　）。」「はい、おねがいします。」',
        'Jawabannya いかがですか — pola 〜はいかがですか dipakai untuk MENAWARKAN dengan sopan. おねがいします (meminta), になります (menyebut total), にします (memutuskan) tidak tepat untuk menawarkan.'),
    (36, 'grammar', 1, '「おちゃは（　）。」「いいえ、けっこうです。」',
        'Jawabannya いかがですか — menawarkan teh dengan sopan. おねがいします, になります, にします tidak tepat.'),
    (37, 'grammar', 1, '「もう 一ぱい（　）。」「はい、いただきます。」',
        'Jawabannya いかがですか — menawarkan segelas lagi dengan sopan. おねがいします, になります, にします tidak tepat.'),

    -- Pola 3: 〜になります (keigo) (38-40) — opsi cross-pattern
    (38, 'grammar', 1, 'ぜんぶで 千円（　）。「になります。」',
        'Jawabannya になります — pola 〜になります (keigo) dipakai petugas untuk menyebut TOTAL harga. おねがいします (meminta), いかがですか (menawarkan), にします (memutuskan) tidak tepat untuk menyebut total.'),
    (39, 'grammar', 1, 'おかいけいは 二千円（　）。「になります。」',
        'Jawabannya になります — menyebut total pembayaran. おねがいします, いかがですか, にします tidak tepat.'),
    (40, 'grammar', 1, 'こちらが おつり（　）。「になります。」',
        'Jawabannya になります — menyebut hasil (kembalian) dengan gaya pelayanan. おねがいします, いかがですか, にします tidak tepat.'),

    -- Pola 4: お〜ください (41-44) — opsi self-contained (konjugasi kata kerja sama)
    (41, 'grammar', 1, 'こちらで しょうしょう（　）。「おまちください。」',
        'Jawabannya おまちください — pola お〜ください (bentuk hormat) dipakai petugas untuk mempersilakan tamu menunggu. おまちします, まっています, まちました tidak menyatakan persilaan hormat.'),
    (42, 'grammar', 1, 'どうぞ（　）。「おはいりください。」',
        'Jawabannya おはいりください — bentuk hormat mempersilakan masuk. おはいりします, はいっています, はいりました tidak menyatakan persilaan hormat.'),
    (43, 'grammar', 1, 'こちらの 店を（　）。「ごりようください。」',
        'Jawabannya ごりようください — kata kerja する memakai pola ご+[kata benda]+ください. ごりようします, りようしています, りようしました tidak menyatakan persilaan hormat.'),
    (44, 'grammar', 1, 'しょるいに 名前を（　）。「おかきください。」',
        'Jawabannya おかきください — bentuk hormat mempersilakan menulis. おかきします, かいています, かきました tidak menyatakan persilaan hormat.'),

    -- Pola 5: 〜にします (45-47) — opsi cross-pattern
    (45, 'grammar', 1, 'わたしは コーヒー（　）。「にします。」',
        'Jawabannya にします — pola 〜にします menyatakan PILIHAN yang diambil orangnya. になります (perubahan), いかがですか (menawarkan), をおねがいします (meminta) tidak menyatakan keputusan memilih.'),
    (46, 'grammar', 1, 'この 白い かばん（　）。「にします。」',
        'Jawabannya にします — memutuskan memilih tas putih ini. になります, いかがですか, をおねがいします tidak tepat.'),
    (47, 'grammar', 1, 'りょこうは らいげつ（　）。「にします。」',
        'Jawabannya にします — memutuskan waktu perjalanan. になります, いかがですか, をおねがいします tidak tepat.'),

    -- Pola 6: 〜くなります／〜になります (48-50) — opsi self-contained (tense/bentuk)
    (48, 'grammar', 1, 'さいきん さむく（　）。「なりました。」',
        'Jawabannya なりました — 〜くなります menyatakan PERUBAHAN keadaan (kata sifat い buang い ganti く); bentuk lampau なりました berarti "sudah menjadi". なります (belum lampau, kurang tepat dengan さいきん), しました, しています tidak menyatakan perubahan keadaan.'),
    (49, 'grammar', 1, 'この 店は 新しく（　）。「なりました。」',
        'Jawabannya なりました — perubahan keadaan toko yang sudah terjadi. なります, しました, しています tidak tepat.'),
    (50, 'grammar', 1, 'あには 先生に（　）。「なりました。」',
        'Jawabannya なりました — kata benda 先生 + に + なります menyatakan perubahan status/profesi yang sudah terjadi. なります, しました, しています tidak tepat.')
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
    -- 漢字読み — opsi kanji murni
    (1, 0, '言います', TRUE), (1, 1, '話します', FALSE), (1, 2, '聞きます', FALSE), (1, 3, '買います', FALSE),
    (2, 0, '話します', TRUE), (2, 1, '言います', FALSE), (2, 2, '聞きます', FALSE), (2, 3, '会います', FALSE),
    (3, 0, '聞きます', TRUE), (3, 1, '話します', FALSE), (3, 2, '買います', FALSE), (3, 3, '会います', FALSE),
    (4, 0, '買います', TRUE), (4, 1, '言います', FALSE), (4, 2, '聞きます', FALSE), (4, 3, '会います', FALSE),
    (5, 0, '会います', TRUE), (5, 1, '話します', FALSE), (5, 2, '聞きます', FALSE), (5, 3, '買います', FALSE),
    (6, 0, 'お店', TRUE), (6, 1, '電話', FALSE), (6, 2, '会社', FALSE), (6, 3, '店の人', FALSE),
    (7, 0, '電話', TRUE), (7, 1, 'お店', FALSE), (7, 2, '会社', FALSE), (7, 3, '店の人', FALSE),
    (8, 0, '会社', TRUE), (8, 1, 'お店', FALSE), (8, 2, '電話', FALSE), (8, 3, '店の人', FALSE),
    (9, 0, '店の人', TRUE), (9, 1, 'お店', FALSE), (9, 2, '電話', FALSE), (9, 3, '会社', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '言います', TRUE), (10, 1, '話します', FALSE), (10, 2, '聞きます', FALSE), (10, 3, '買います', FALSE),
    (11, 0, '話します', TRUE), (11, 1, '言います', FALSE), (11, 2, '聞きます', FALSE), (11, 3, '会います', FALSE),
    (12, 0, '聞きます', TRUE), (12, 1, '話します', FALSE), (12, 2, '買います', FALSE), (12, 3, '会います', FALSE),
    (13, 0, '買います', TRUE), (13, 1, '言います', FALSE), (13, 2, '聞きます', FALSE), (13, 3, '会います', FALSE),
    (14, 0, '会います', TRUE), (14, 1, '話します', FALSE), (14, 2, '聞きます', FALSE), (14, 3, '買います', FALSE),
    (15, 0, 'お店', TRUE), (15, 1, '電話', FALSE), (15, 2, '会社', FALSE), (15, 3, '店の人', FALSE),
    (16, 0, '電話', TRUE), (16, 1, 'お店', FALSE), (16, 2, '会社', FALSE), (16, 3, '店の人', FALSE),
    (17, 0, '会社', TRUE), (17, 1, 'お店', FALSE), (17, 2, '電話', FALSE), (17, 3, '店の人', FALSE),
    (18, 0, '店の人', TRUE), (18, 1, 'お店', FALSE), (18, 2, '電話', FALSE), (18, 3, '会社', FALSE),

    -- 文脈規定
    (19, 0, 'いらっしゃいませ', TRUE), (19, 1, 'かしこまりました', FALSE), (19, 2, 'おかいけい', FALSE), (19, 3, 'よやく', FALSE),
    (20, 0, 'かしこまりました', TRUE), (20, 1, 'いらっしゃいませ', FALSE), (20, 2, 'おつり', FALSE), (20, 3, 'ちゅうもん', FALSE),
    (21, 0, 'おかいけい', TRUE), (21, 1, 'れしーと', FALSE), (21, 2, 'おつり', FALSE), (21, 3, 'ちゅうもん', FALSE),
    (22, 0, 'げんきん', TRUE), (22, 1, 'くれじっとかーど', FALSE), (22, 2, 'おかいけい', FALSE), (22, 3, 'れしーと', FALSE),
    (23, 0, 'くれじっとかーど', TRUE), (23, 1, 'げんきん', FALSE), (23, 2, 'おつり', FALSE), (23, 3, 'れしーと', FALSE),
    (24, 0, 'おつり', TRUE), (24, 1, 'れしーと', FALSE), (24, 2, 'げんきん', FALSE), (24, 3, 'おかいけい', FALSE),
    (25, 0, 'れしーと', TRUE), (25, 1, 'おつり', FALSE), (25, 2, 'おかいけい', FALSE), (25, 3, 'げんきん', FALSE),
    (26, 0, 'ちゅうもん', TRUE), (26, 1, 'よやく', FALSE), (26, 2, 'へや', FALSE), (26, 3, 'かしこまりました', FALSE),
    (27, 0, 'よやく', TRUE), (27, 1, 'ちゅうもん', FALSE), (27, 2, 'へや', FALSE), (27, 3, 'いらっしゃいませ', FALSE),
    (28, 0, 'へや', TRUE), (28, 1, 'よやく', FALSE), (28, 2, 'のみもの', FALSE), (28, 3, 'たべもの', FALSE),
    (29, 0, 'のみもの', TRUE), (29, 1, 'たべもの', FALSE), (29, 2, 'へや', FALSE), (29, 3, 'げんきん', FALSE),
    (30, 0, 'たべもの', TRUE), (30, 1, 'のみもの', FALSE), (30, 2, 'へや', FALSE), (30, 3, 'げんきん', FALSE),

    -- 文の文法1 — 〜を…お願いします (cross-pattern)
    (31, 0, 'おねがいします', TRUE), (31, 1, 'いかがですか', FALSE), (31, 2, 'になります', FALSE), (31, 3, 'にします', FALSE),
    (32, 0, 'おねがいします', TRUE), (32, 1, 'いかがですか', FALSE), (32, 2, 'になります', FALSE), (32, 3, 'にします', FALSE),
    (33, 0, 'おねがいします', TRUE), (33, 1, 'いかがですか', FALSE), (33, 2, 'になります', FALSE), (33, 3, 'にします', FALSE),
    (34, 0, 'おねがいします', TRUE), (34, 1, 'いかがですか', FALSE), (34, 2, 'になります', FALSE), (34, 3, 'にします', FALSE),

    -- 〜はいかがですか (cross-pattern)
    (35, 0, 'いかがですか', TRUE), (35, 1, 'おねがいします', FALSE), (35, 2, 'になります', FALSE), (35, 3, 'にします', FALSE),
    (36, 0, 'いかがですか', TRUE), (36, 1, 'おねがいします', FALSE), (36, 2, 'になります', FALSE), (36, 3, 'にします', FALSE),
    (37, 0, 'いかがですか', TRUE), (37, 1, 'おねがいします', FALSE), (37, 2, 'になります', FALSE), (37, 3, 'にします', FALSE),

    -- 〜になります keigo (cross-pattern)
    (38, 0, 'になります', TRUE), (38, 1, 'おねがいします', FALSE), (38, 2, 'いかがですか', FALSE), (38, 3, 'にします', FALSE),
    (39, 0, 'になります', TRUE), (39, 1, 'おねがいします', FALSE), (39, 2, 'いかがですか', FALSE), (39, 3, 'にします', FALSE),
    (40, 0, 'になります', TRUE), (40, 1, 'おねがいします', FALSE), (40, 2, 'いかがですか', FALSE), (40, 3, 'にします', FALSE),

    -- お〜ください (self-contained)
    (41, 0, 'おまちください', TRUE), (41, 1, 'おまちします', FALSE), (41, 2, 'まっています', FALSE), (41, 3, 'まちました', FALSE),
    (42, 0, 'おはいりください', TRUE), (42, 1, 'おはいりします', FALSE), (42, 2, 'はいっています', FALSE), (42, 3, 'はいりました', FALSE),
    (43, 0, 'ごりようください', TRUE), (43, 1, 'ごりようします', FALSE), (43, 2, 'りようしています', FALSE), (43, 3, 'りようしました', FALSE),
    (44, 0, 'おかきください', TRUE), (44, 1, 'おかきします', FALSE), (44, 2, 'かいています', FALSE), (44, 3, 'かきました', FALSE),

    -- 〜にします (cross-pattern)
    (45, 0, 'にします', TRUE), (45, 1, 'になります', FALSE), (45, 2, 'いかがですか', FALSE), (45, 3, 'をおねがいします', FALSE),
    (46, 0, 'にします', TRUE), (46, 1, 'になります', FALSE), (46, 2, 'いかがですか', FALSE), (46, 3, 'をおねがいします', FALSE),
    (47, 0, 'にします', TRUE), (47, 1, 'になります', FALSE), (47, 2, 'いかがですか', FALSE), (47, 3, 'をおねがいします', FALSE),

    -- 〜くなります／〜になります (self-contained)
    (48, 0, 'なりました', TRUE), (48, 1, 'なります', FALSE), (48, 2, 'しました', FALSE), (48, 3, 'しています', FALSE),
    (49, 0, 'なりました', TRUE), (49, 1, 'なります', FALSE), (49, 2, 'しました', FALSE), (49, 3, 'しています', FALSE),
    (50, 0, 'なりました', TRUE), (50, 1, 'なります', FALSE), (50, 2, 'しました', FALSE), (50, 3, 'しています', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '105: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '105: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) — SAMA PERSIS
  --    dengan v_kanji_ok di 084_bunpou_bab15.sql. もんだい3 tidak memakai
  --    <u>, jadi SELURUH kolom question-nya kena pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '105: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION (dihapus sejak 059).
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 kosakata polos, bukan
  --    konjugasi — tidak relevan sejak 100).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '105: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '105: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '105: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    215 target unik yang sudah dipakai di 039-104 (di-grep ulang penuh
  --    dari file migrasi sungguhan, bukan disusun incremental — lihat
  --    catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いきました','いって','いんど','えきでまっています','えきまえ','かいて','かきます','がいこく','がくせい','がっこう',
         'きゅうにん','きゅうひゃくえん','くじかん','くに','くるまをつかってもいいですか','くるまをもっています','こくどう','ごご',
         'ごじ','ごじゅうにん','ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん','さかな',
         'さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん','じゅうにじ','じゅうにん','じゅっぽん',
         'じょうげ','せんえん','せんげつ','せんせい','せんにん','ぜんご','たい','たたない','たつ','たべて','たべもの',
         'ちゅうかん','ちゅうがくせい','ちゅうねん','でた','でない','でる','でんしゃにのっています','でんしゃにのってください',
         'とうざい','ななひゃくえん','なに','なんじ','なんせい','なんとう','なんねん','なんぼく','にじゅうにん','にせんえん',
         'にねんせい','にひゃくえん','にほん','のみました','のんで','はいらない','はいる','はちじ','はちにん','はな',
         'はながさいています','はなをとってはいけません','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい',
         'ほくとう','ほん','まいにち','まんえん','みちをあるいています','みちをあるいてください','みて','みました','やすまない',
         'やすむ','よにん','よねんせい','よみました','よんじゅうにん','よんで','よんほん','ろくにん','一人','一分','一年',
         '一時','一本','七人','七分','三十人','三十分','三時','三本','三百円','上','下','中','中国','九時',
         '二人','二十歳','二時','二百人','人','人気','人間','休まない','休む','何人','何年生','何本','先生','先週',
         '入らない','入る','八時半','八百円','六分','六年生','六時','六本','六百円','出た','出ない','出る','前',
         '北','十分','十時','南','古い','右','名前','四時','国','外','大学','大学生','女','女の人','学校',
         '学生','安い','左','後ろ','新しい','日本','日本人','日本語','書いて','書きました','本','東','毎月','毎週',
         '気分','男','男の人','男女','留学生','白い','立たない','立つ','花','花がさいています','花をとってはいけません',
         '行','行って','西','見て','見てから','見ません','読みます','読んで','車','車をつかってもいいですか',
         '車をもっています','道','道をあるいています','道をあるいてください','長い','電車','電車にのっています',
         '電車にのってください','韓国人','食べて','食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校',
         '高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '105: ada target <u> yang sudah pernah diujikan di migration 039-104';
  END IF;

  RAISE NOTICE '105: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
