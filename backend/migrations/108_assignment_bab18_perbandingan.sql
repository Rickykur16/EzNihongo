-- 108_assignment_bab18_perbandingan.sql — Assignment Bab 18: Perbandingan.
--
-- Ujian bab untuk Bab 18, melanjutkan pola assignment Bab 1-17
-- (039/040/041/045/047/051/053/055/057/059/061/100/104/103/105/106/107).
-- Modul di-resolve ordinal (OFFSET 17, lanjutan pola 039-107).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 18 memperkenalkan 4 kanji BARU — 大(おお)・小(ちい)・多(おお)・
-- 少(すく), semuanya kata sifat い ukuran/jumlah — dikonfirmasi header
-- 087_bunpou_bab18.sql. 番 (dari いちばん) BELUM diajarkan, jadi いちばん
-- SELALU kana. もんだい1/2 menguji 4 kanji baru ini LEWAT KONJUGASI
-- (bentuk kini + bentuk lampau かった), gaya 100/103 — beda dari
-- 105/106/107 (Bab 15-17) yang kanji barunya kata benda sehingga diuji
-- polos — di sini kanji barunya kata SIFAT い yang alami dikonjugasi,
-- jadi kembali ke pola konjugasi seperti Bab 12/14. Soal ke-9/18 sengaja
-- menaruh いちばん (kana, dari pola 〜が一番〜 bab ini) berdampingan dengan
-- 大きい sebagai bonus preview grammar, tanpa memaksakannya ke semua soal.
--
-- Whitelist kanji = whitelist 100/104/103/105/106/107 UNION 大小多少 (SAMA
-- PERSIS dengan v_kanji_ok di 087_bunpou_bab18.sql). CATATAN PENTING:
-- 大 di bab ini BARU RESMI masuk whitelist badan-kalimat — di 107 (Bab 17)
-- 大 SENGAJA dihindari di luar tag karena waktu itu belum taught (lihat
-- catatan jebakan whitelist di 107 dan CLAUDE.md); sekarang boleh dipakai
-- bebas di badan kalimat.
--
-- PAGAR KATA KERJA: TIDAK RELEVAN (もんだい1/2 konjugasi KATA SIFAT い,
-- bukan kata kerja) — tidak ada assertion kata kerja di file ini.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini. (Partikel
-- より justru jadi topik utama もんだい1 文の文法1 pola 1 — lihat di
-- bawah.)
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   大きい＝おおきい   小さい＝ちいさい   多い＝おおい   少ない＝すくない
--   大きかった＝おおきかった   小さかった＝ちいさかった
--   多かった＝おおかった   少なかった＝すくなかった
--   いちばん大きい＝いちばんおおきい
--
-- JEBAKAN PAGAR "RANTAI の": satu-satunya の di もんだい1/2 ada di
-- "くだものの 中で" (soal ke-9/18, di LUAR target <u>) — cuma SATU の per
-- kalimat, aman (sudah dicek manual, tidak ada kata/frasa ber-の ganda
-- lain di section ini).
--
-- CATATAN PROSES (lanjutan dari 106/107): array dedup di bawah di-grep
-- ulang PENUH dari SEMUA migrasi assignment 039-107 yang benar-benar ada
-- di repo saat ini (269 target unik, sudah bersih dari baris komentar
-- palsu — lihat catatan di 106 soal placeholder tag di komentar).
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (5/5/5/5 per pola: AはBより〜です／
-- AよりBのほうが〜／AとBとどちらが〜／〜の中で〜が一番〜) = 50 soal,
-- SEMUA ditampilkan tiap attempt, lulus 70% (35/50), cooldown 12 jam.
--
-- Pola 1-2 (31-40) menguji partikel/frasa pembanding (より／のほうが) yang
-- WAJIB muncul, opsi salah partikel lain yang salah (と／の／が). Pola 3
-- (41-45) menguji どちら vs kata tanya lain (どれ／なに／だれ) — nuansa
-- inti yang ditegaskan di catatan grammar 087 ("jangan pakai どれ — どれ
-- untuk tiga pilihan atau lebih", di sini SEMUA konteks tepat dua pilihan
-- jadi jawabannya konsisten どちら). Pola 4 (46-50) menguji いちばん vs
-- kata/frasa lain yang mirip posisi (なか／より／のほうが).
--
-- もんだい3 文脈規定: Bab 18 BELUM punya bank kosakata resmi
-- (076_bab18_intro_kosakata_kanji.sql cuma seed kanji_items, TIDAK seed
-- module_vocabulary — deck kosakata Bab 18 masih kosong, lihat catatan
-- "Sisa pekerjaan Bab 12-20" di CLAUDE.md). 12 target di sini memakai
-- kosakata umum N5 yang tematik dengan Bab 18 (hal-hal yang lazim
-- dibandingkan): 4 musim (はる／なつ／あき／ふゆ, dari bank kosakata
-- Bab 16 yang belum pernah dites) + 4 alat transportasi
-- (バス／ひこうき／ふね／じてんしゃ) + 4 makanan (すし／ラーメン／
-- カレー／ピザ). SEMUA soal berupa definisi/ciri-ciri, bukan penyebutan
-- langsung, supaya tidak trivial.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-107.
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
  v_bab_no       INT  := 18;
  v_title_re     TEXT := '(perbandingan|banding)';
  v_lesson_slug  TEXT := 'assignment-bab-18-perbandingan';
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
    RAISE NOTICE '108: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '108: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '108: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 18: Perbandingan', 'quiz',
    'Tes materi Bab 18 (Perbandingan) gaya JLPT. Moji-Goi: cara baca dan menulis 4 kanji baru (大きい・小さい・多い・少ない) dalam bentuk kini dan lampau, serta kosakata musim/transportasi/makanan yang lazim dibandingkan. Tata Bahasa: AはBより〜です dan AよりBのほうが〜 (dua sudut pandang membandingkan dua hal), AとBとどちらが〜 (bertanya pilihan di antara dua hal), dan 〜の中で〜が一番〜 (superlatif di dalam satu kelompok). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 4 kanji baru (大/小/多/少) x kini/lampau =====
    (1, 'vocabulary'::TEXT, 1, 'とうきょうは おおさかより <u>大きい</u>です。',
        '大きい dibaca おおきい. 大 kanji baru Bab 18 untuk "besar".'),
    (2, 'vocabulary', 1, 'おおさかは とうきょうより <u>小さい</u>です。',
        '小さい dibaca ちいさい. 小 kanji baru Bab 18 untuk "kecil".'),
    (3, 'vocabulary', 1, '学生が <u>多い</u>です。',
        '多い dibaca おおい. 多 kanji baru Bab 18 untuk "banyak".'),
    (4, 'vocabulary', 1, '時間が <u>少ない</u>です。',
        '少ない dibaca すくない. 少 kanji baru Bab 18 untuk "sedikit".'),
    (5, 'vocabulary', 1, 'むかし、この まちは <u>大きかった</u>です。',
        '大きかった dibaca おおきかった. Bentuk lampau dari 大きい.'),
    (6, 'vocabulary', 1, 'むかし、この 店は <u>小さかった</u>です。',
        '小さかった dibaca ちいさかった. Bentuk lampau dari 小さい.'),
    (7, 'vocabulary', 1, 'きょねん、学生が <u>多かった</u>です。',
        '多かった dibaca おおかった. Bentuk lampau dari 多い.'),
    (8, 'vocabulary', 1, 'せんしゅう、時間が <u>少なかった</u>です。',
        '少なかった dibaca すくなかった. Bentuk lampau dari 少ない.'),
    (9, 'vocabulary', 1, 'やさいの 中で とまとが <u>いちばん大きい</u>です。',
        'いちばん大きい dibaca いちばんおおきい. いちばん (belum ada kanjinya di level ini) + 大きい.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'とうきょうは おおさかより <u>おおきい</u>です。',
        'おおきい ditulis 大きい. Salah: 小さい (ちいさい, kecil), 多い (おおい, banyak), 少ない (すくない, sedikit).'),
    (11, 'vocabulary', 2, 'おおさかは とうきょうより <u>ちいさい</u>です。',
        'ちいさい ditulis 小さい. Salah: 大きい (おおきい, besar), 多い (おおい, banyak), 少ない (すくない, sedikit).'),
    (12, 'vocabulary', 2, '学生が <u>おおい</u>です。',
        'おおい ditulis 多い. Salah: 大きい (おおきい, besar), 小さい (ちいさい, kecil), 少ない (すくない, sedikit).'),
    (13, 'vocabulary', 2, '時間が <u>すくない</u>です。',
        'すくない ditulis 少ない. Salah: 大きい (おおきい, besar), 小さい (ちいさい, kecil), 多い (おおい, banyak).'),
    (14, 'vocabulary', 2, 'むかし、この まちは <u>おおきかった</u>です。',
        'おおきかった ditulis 大きかった. Salah: 小さかった (ちいさかった, dulu kecil), 多かった (おおかった, dulu banyak), 少なかった (すくなかった, dulu sedikit).'),
    (15, 'vocabulary', 2, 'むかし、この 店は <u>ちいさかった</u>です。',
        'ちいさかった ditulis 小さかった. Salah: 大きかった (おおきかった, dulu besar), 多かった (おおかった, dulu banyak), 少なかった (すくなかった, dulu sedikit).'),
    (16, 'vocabulary', 2, 'きょねん、学生が <u>おおかった</u>です。',
        'おおかった ditulis 多かった. Salah: 大きかった (おおきかった, dulu besar), 小さかった (ちいさかった, dulu kecil), 少なかった (すくなかった, dulu sedikit).'),
    (17, 'vocabulary', 2, 'せんしゅう、時間が <u>すくなかった</u>です。',
        'すくなかった ditulis 少なかった. Salah: 大きかった (おおきかった, dulu besar), 小さかった (ちいさかった, dulu kecil), 多かった (おおかった, dulu banyak).'),
    (18, 'vocabulary', 2, 'やさいの 中で とまとが <u>いちばんおおきい</u>です。',
        'いちばんおおきい ditulis いちばん大きい. Salah: いちばん小さい (いちばんちいさい, paling kecil), いちばん多い (いちばんおおい, paling banyak), いちばん少ない (いちばんすくない, paling sedikit).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata musim/transportasi/makanan =====
    (19, 'vocabulary', 3, '一年で いちばん あついのは（　）です。',
        'Jawabannya なつ (musim panas, paling panas dalam setahun). はる, あき, ふゆ tidak paling panas.'),
    (20, 'vocabulary', 3, '一年で いちばん さむいのは（　）です。',
        'Jawabannya ふゆ (musim dingin, paling dingin dalam setahun). はる, なつ, あき tidak paling dingin.'),
    (21, 'vocabulary', 3, 'さくらが さく きせつは（　）です。',
        'Jawabannya はる (musim semi, musim bunga sakura). なつ, あき, ふゆ tidak cocok dengan sakura.'),
    (22, 'vocabulary', 3, '木の はが あかく なる きせつは（　）です。',
        'Jawabannya あき (musim gugur, daun berubah merah). はる, なつ, ふゆ tidak cocok dengan daun merah.'),
    (23, 'vocabulary', 3, 'まちの 中を はしります。タイヤが 四つ あります。それは（　）です。',
        'Jawabannya バス (bus, kendaraan beroda empat yang berjalan di kota). ひこうき, ふね, じてんしゃ tidak cocok.'),
    (24, 'vocabulary', 3, 'そらを とびます。それは（　）です。',
        'Jawabannya ひこうき (pesawat, terbang di langit). バス, ふね, じてんしゃ tidak terbang.'),
    (25, 'vocabulary', 3, 'うみを はしります。それは（　）です。',
        'Jawabannya ふね (perahu/kapal, berjalan di laut). バス, ひこうき, じてんしゃ tidak berjalan di laut.'),
    (26, 'vocabulary', 3, '足を つかって こぎます。それは（　）です。',
        'Jawabannya じてんしゃ (sepeda, dikayuh pakai kaki). バス, ひこうき, ふね tidak dikayuh dengan kaki.'),
    (27, 'vocabulary', 3, 'さかなを なまで たべます。（　）が すきです。',
        'Jawabannya すし (sushi, memakai ikan mentah). ラーメン, カレー, ピザ tidak memakai ikan mentah.'),
    (28, 'vocabulary', 3, 'あつくて ながい めんを たべます。（　）が すきです。',
        'Jawabannya ラーメン (ramen, mi panjang dan panas). すし, カレー, ピザ bukan mi.'),
    (29, 'vocabulary', 3, 'からい たべもので、インドで よく たべます。（　）が すきです。',
        'Jawabannya カレー (kari, makanan India yang pedas). すし, ラーメン, ピザ bukan dari India.'),
    (30, 'vocabulary', 3, 'まるくて、うえに チーズが あります。（　）が すきです。',
        'Jawabannya ピザ (pizza, bundar dengan keju di atas). すし, ラーメン, カレー tidak bundar dengan keju di atas.'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 18 (5/5/5/5) =====
    -- Pola 1: AはBより〜です (31-35)
    (31, 'grammar'::TEXT, 1, 'とうきょうは おおさか（　）大きいです。「より。」',
        'Jawabannya より — menandai pembanding (B) dalam pola AはBより〜です. と, の, が tidak tepat untuk menandai pembanding.'),
    (32, 'grammar', 1, 'とけいは ペン（　）高いです。「より。」',
        'Jawabannya より — konsisten dengan pola AはBより〜です. と, の, が tidak tepat.'),
    (33, 'grammar', 1, '父は 母（　）せが 高いです。「より。」',
        'Jawabannya より — konsisten dengan pola AはBより〜です. と, の, が tidak tepat.'),
    (34, 'grammar', 1, '日本語は えいご（　）むずかしいです。「より。」',
        'Jawabannya より — konsisten dengan pola AはBより〜です. と, の, が tidak tepat.'),
    (35, 'grammar', 1, 'きょうは きのう（　）あついです。「より。」',
        'Jawabannya より — konsisten dengan pola AはBより〜です. と, の, が tidak tepat.'),

    -- Pola 2: AよりBのほうが〜 (36-40)
    (36, 'grammar', 1, 'バスより 電車（　）はやいです。「のほうが。」',
        'Jawabannya のほうが — menyorot B (電車) sebagai yang unggul dalam pola AよりBのほうが〜. より, と, が tidak tepat sendirian di posisi ini.'),
    (37, 'grammar', 1, 'にくより 魚（　）すきです。「のほうが。」',
        'Jawabannya のほうが — konsisten dengan pola AよりBのほうが〜. より, と, が tidak tepat.'),
    (38, 'grammar', 1, 'スーパーより コンビニ（　）安いです。「のほうが。」',
        'Jawabannya のほうが — konsisten dengan pola AよりBのほうが〜. より, と, が tidak tepat.'),
    (39, 'grammar', 1, 'なつより ふゆ（　）すきです。「のほうが。」',
        'Jawabannya のほうが — konsisten dengan pola AよりBのほうが〜. より, と, が tidak tepat.'),
    (40, 'grammar', 1, 'バスより ひこうき（　）はやいです。「のほうが。」',
        'Jawabannya のほうが — konsisten dengan pola AよりBのほうが〜. より, と, が tidak tepat.'),

    -- Pola 3: AとBとどちらが〜 (41-45)
    (41, 'grammar', 1, 'コーヒーと おちゃと（　）が すきですか。「どちら。」',
        'Jawabannya どちら — pertanyaan pilihan antara TEPAT DUA hal. どれ (tiga pilihan atau lebih), なに, だれ tidak tepat untuk dua pilihan.'),
    (42, 'grammar', 1, '電車と バスと（　）が 安いですか。「どちら。」',
        'Jawabannya どちら — dua pilihan (電車 dan バス). どれ, なに, だれ tidak tepat.'),
    (43, 'grammar', 1, '日本語と えいごと（　）が むずかしいですか。「どちら。」',
        'Jawabannya どちら — dua pilihan (日本語 dan えいご). どれ, なに, だれ tidak tepat.'),
    (44, 'grammar', 1, 'すしと ラーメンと（　）が すきですか。「どちら。」',
        'Jawabannya どちら — dua pilihan (すし dan ラーメン). どれ, なに, だれ tidak tepat.'),
    (45, 'grammar', 1, 'はると なつと（　）が すきですか。「どちら。」',
        'Jawabannya どちら — dua pilihan (はる dan なつ). どれ, なに, だれ tidak tepat.'),

    -- Pola 4: 〜の中で〜が一番〜 (46-50)
    (46, 'grammar', 1, 'やさいの 中で とまとが（　）すきです。「いちばん。」',
        'Jawabannya いちばん — menyatakan PALING di dalam satu kelompok. なか, より, のほうが tidak tepat untuk superlatif.'),
    (47, 'grammar', 1, 'この 中で どれが（　）安いですか。「いちばん。」',
        'Jawabannya いちばん — konsisten dengan pola 〜の中で〜が一番〜. なか, より, のほうが tidak tepat.'),
    (48, 'grammar', 1, 'かぞくの 中で 父が（　）はやく おきます。「いちばん。」',
        'Jawabannya いちばん — konsisten dengan pola 〜の中で〜が一番〜. なか, より, のほうが tidak tepat.'),
    (49, 'grammar', 1, 'きせつの 中で なつが（　）あついです。「いちばん。」',
        'Jawabannya いちばん — konsisten dengan pola 〜の中で〜が一番〜. なか, より, のほうが tidak tepat.'),
    (50, 'grammar', 1, 'この 中で ひこうきが（　）はやいです。「いちばん。」',
        'Jawabannya いちばん — konsisten dengan pola 〜の中で〜が一番〜. なか, より, のほうが tidak tepat.')
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
    (1, 0, 'おおきい', TRUE), (1, 1, 'ちいさい', FALSE), (1, 2, 'おおい', FALSE), (1, 3, 'すくない', FALSE),
    (2, 0, 'ちいさい', TRUE), (2, 1, 'おおきい', FALSE), (2, 2, 'おおい', FALSE), (2, 3, 'すくない', FALSE),
    (3, 0, 'おおい', TRUE), (3, 1, 'おおきい', FALSE), (3, 2, 'ちいさい', FALSE), (3, 3, 'すくない', FALSE),
    (4, 0, 'すくない', TRUE), (4, 1, 'おおきい', FALSE), (4, 2, 'ちいさい', FALSE), (4, 3, 'おおい', FALSE),
    (5, 0, 'おおきかった', TRUE), (5, 1, 'ちいさかった', FALSE), (5, 2, 'おおかった', FALSE), (5, 3, 'すくなかった', FALSE),
    (6, 0, 'ちいさかった', TRUE), (6, 1, 'おおきかった', FALSE), (6, 2, 'おおかった', FALSE), (6, 3, 'すくなかった', FALSE),
    (7, 0, 'おおかった', TRUE), (7, 1, 'おおきかった', FALSE), (7, 2, 'ちいさかった', FALSE), (7, 3, 'すくなかった', FALSE),
    (8, 0, 'すくなかった', TRUE), (8, 1, 'おおきかった', FALSE), (8, 2, 'ちいさかった', FALSE), (8, 3, 'おおかった', FALSE),
    (9, 0, 'いちばんおおきい', TRUE), (9, 1, 'いちばんちいさい', FALSE), (9, 2, 'いちばんおおい', FALSE), (9, 3, 'いちばんすくない', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '大きい', TRUE), (10, 1, '小さい', FALSE), (10, 2, '多い', FALSE), (10, 3, '少ない', FALSE),
    (11, 0, '小さい', TRUE), (11, 1, '大きい', FALSE), (11, 2, '多い', FALSE), (11, 3, '少ない', FALSE),
    (12, 0, '多い', TRUE), (12, 1, '大きい', FALSE), (12, 2, '小さい', FALSE), (12, 3, '少ない', FALSE),
    (13, 0, '少ない', TRUE), (13, 1, '大きい', FALSE), (13, 2, '小さい', FALSE), (13, 3, '多い', FALSE),
    (14, 0, '大きかった', TRUE), (14, 1, '小さかった', FALSE), (14, 2, '多かった', FALSE), (14, 3, '少なかった', FALSE),
    (15, 0, '小さかった', TRUE), (15, 1, '大きかった', FALSE), (15, 2, '多かった', FALSE), (15, 3, '少なかった', FALSE),
    (16, 0, '多かった', TRUE), (16, 1, '大きかった', FALSE), (16, 2, '小さかった', FALSE), (16, 3, '少なかった', FALSE),
    (17, 0, '少なかった', TRUE), (17, 1, '大きかった', FALSE), (17, 2, '小さかった', FALSE), (17, 3, '多かった', FALSE),
    (18, 0, 'いちばん大きい', TRUE), (18, 1, 'いちばん小さい', FALSE), (18, 2, 'いちばん多い', FALSE), (18, 3, 'いちばん少ない', FALSE),

    -- 文脈規定
    (19, 0, 'なつ', TRUE), (19, 1, 'はる', FALSE), (19, 2, 'あき', FALSE), (19, 3, 'ふゆ', FALSE),
    (20, 0, 'ふゆ', TRUE), (20, 1, 'はる', FALSE), (20, 2, 'なつ', FALSE), (20, 3, 'あき', FALSE),
    (21, 0, 'はる', TRUE), (21, 1, 'なつ', FALSE), (21, 2, 'あき', FALSE), (21, 3, 'ふゆ', FALSE),
    (22, 0, 'あき', TRUE), (22, 1, 'はる', FALSE), (22, 2, 'なつ', FALSE), (22, 3, 'ふゆ', FALSE),
    (23, 0, 'バス', TRUE), (23, 1, 'ひこうき', FALSE), (23, 2, 'ふね', FALSE), (23, 3, 'じてんしゃ', FALSE),
    (24, 0, 'ひこうき', TRUE), (24, 1, 'バス', FALSE), (24, 2, 'ふね', FALSE), (24, 3, 'じてんしゃ', FALSE),
    (25, 0, 'ふね', TRUE), (25, 1, 'バス', FALSE), (25, 2, 'ひこうき', FALSE), (25, 3, 'じてんしゃ', FALSE),
    (26, 0, 'じてんしゃ', TRUE), (26, 1, 'バス', FALSE), (26, 2, 'ひこうき', FALSE), (26, 3, 'ふね', FALSE),
    (27, 0, 'すし', TRUE), (27, 1, 'ラーメン', FALSE), (27, 2, 'カレー', FALSE), (27, 3, 'ピザ', FALSE),
    (28, 0, 'ラーメン', TRUE), (28, 1, 'すし', FALSE), (28, 2, 'カレー', FALSE), (28, 3, 'ピザ', FALSE),
    (29, 0, 'カレー', TRUE), (29, 1, 'すし', FALSE), (29, 2, 'ラーメン', FALSE), (29, 3, 'ピザ', FALSE),
    (30, 0, 'ピザ', TRUE), (30, 1, 'すし', FALSE), (30, 2, 'ラーメン', FALSE), (30, 3, 'カレー', FALSE),

    -- 文の文法1 — AはBより〜です
    (31, 0, 'より', TRUE), (31, 1, 'と', FALSE), (31, 2, 'の', FALSE), (31, 3, 'が', FALSE),
    (32, 0, 'より', TRUE), (32, 1, 'と', FALSE), (32, 2, 'の', FALSE), (32, 3, 'が', FALSE),
    (33, 0, 'より', TRUE), (33, 1, 'と', FALSE), (33, 2, 'の', FALSE), (33, 3, 'が', FALSE),
    (34, 0, 'より', TRUE), (34, 1, 'と', FALSE), (34, 2, 'の', FALSE), (34, 3, 'が', FALSE),
    (35, 0, 'より', TRUE), (35, 1, 'と', FALSE), (35, 2, 'の', FALSE), (35, 3, 'が', FALSE),

    -- AよりBのほうが〜
    (36, 0, 'のほうが', TRUE), (36, 1, 'より', FALSE), (36, 2, 'と', FALSE), (36, 3, 'が', FALSE),
    (37, 0, 'のほうが', TRUE), (37, 1, 'より', FALSE), (37, 2, 'と', FALSE), (37, 3, 'が', FALSE),
    (38, 0, 'のほうが', TRUE), (38, 1, 'より', FALSE), (38, 2, 'と', FALSE), (38, 3, 'が', FALSE),
    (39, 0, 'のほうが', TRUE), (39, 1, 'より', FALSE), (39, 2, 'と', FALSE), (39, 3, 'が', FALSE),
    (40, 0, 'のほうが', TRUE), (40, 1, 'より', FALSE), (40, 2, 'と', FALSE), (40, 3, 'が', FALSE),

    -- AとBとどちらが〜
    (41, 0, 'どちら', TRUE), (41, 1, 'どれ', FALSE), (41, 2, 'なに', FALSE), (41, 3, 'だれ', FALSE),
    (42, 0, 'どちら', TRUE), (42, 1, 'どれ', FALSE), (42, 2, 'なに', FALSE), (42, 3, 'だれ', FALSE),
    (43, 0, 'どちら', TRUE), (43, 1, 'どれ', FALSE), (43, 2, 'なに', FALSE), (43, 3, 'だれ', FALSE),
    (44, 0, 'どちら', TRUE), (44, 1, 'どれ', FALSE), (44, 2, 'なに', FALSE), (44, 3, 'だれ', FALSE),
    (45, 0, 'どちら', TRUE), (45, 1, 'どれ', FALSE), (45, 2, 'なに', FALSE), (45, 3, 'だれ', FALSE),

    -- 〜の中で〜が一番〜
    (46, 0, 'いちばん', TRUE), (46, 1, 'なか', FALSE), (46, 2, 'より', FALSE), (46, 3, 'のほうが', FALSE),
    (47, 0, 'いちばん', TRUE), (47, 1, 'なか', FALSE), (47, 2, 'より', FALSE), (47, 3, 'のほうが', FALSE),
    (48, 0, 'いちばん', TRUE), (48, 1, 'なか', FALSE), (48, 2, 'より', FALSE), (48, 3, 'のほうが', FALSE),
    (49, 0, 'いちばん', TRUE), (49, 1, 'なか', FALSE), (49, 2, 'より', FALSE), (49, 3, 'のほうが', FALSE),
    (50, 0, 'いちばん', TRUE), (50, 1, 'なか', FALSE), (50, 2, 'より', FALSE), (50, 3, 'のほうが', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '108: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '108: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) +
  --    日火水木金土 (Bab 16) + 子父母友手足口目耳 (Bab 17) + 大小多少
  --    (Bab 18) — SAMA PERSIS dengan v_kanji_ok di 087_bunpou_bab18.sql.
  --    もんだい3 tidak memakai <u>, jadi SELURUH kolom question-nya kena
  --    pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '108: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION UMUM (dihapus sejak 059) — partikel
  --    より justru topik utama もんだい1 文の文法1, diuji manual di atas.
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 konjugasi kata sifat い,
  --    bukan kata kerja — tidak relevan).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '108: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '108: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '108: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    269 target unik yang sudah dipakai di 039-107 (di-grep ulang penuh
  --    dari file migrasi sungguhan, dibersihkan dari baris komentar
  --    palsu — lihat catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'あいます','あし','いいます','いきました','いって','いんど','えきでまっています','えきまえ','おみせ','お店',
         'かいしゃ','かいて','かいます','かきます','かようび','がいこく','がくせい','がっこう','ききます','きゅうにん',
         'きゅうひゃくえん','きんようび','くじかん','くち','くに','くるまをつかってもいいですか','くるまをもっています','げつようび',
         'こくどう','こども','ごご','ごじ','ごじゅうにん','ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい',
         'ごひゃくえん','ごほん','さかな','さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん','じゅうにじ',
         'じゅうにん','じゅっぽん','じょうげ','すいようび','せんえん','せんげつ','せんせい','せんにん','ぜんご','たい',
         'たたない','たつ','たべて','たべもの','ちち','ちゅうかん','ちゅうがくせい','ちゅうねん','て','でた','でない',
         'でる','でんしゃにのっています','でんしゃにのってください','でんわ','とうざい','ともだち','どようび','ななひゃくえん',
         'なに','なんがつなんにち','なんじ','なんせい','なんとう','なんねん','なんぼく','にじゅうにん','にせんえん',
         'にちようび','にねんせい','にひゃくえん','にほん','のみました','のんで','はいらない','はいる','はちじ','はちにん',
         'はな','はながさいています','はなします','はなをとってはいけません','はは','はん','はんとし','はんぶん','ひと',
         'ひゃくにん','べとなむ','ほくせい','ほくとう','ほん','まいにち','まんえん','みせのひと','みちをあるいています',
         'みちをあるいてください','みて','みました','みみ','め','もくようび','やすまない','やすむ','よにん','よねんせい',
         'よみました','よんじゅうにん','よんで','よんほん','ろくがつみっか','ろくにん','一人','一分','一年','一時','一本',
         '七人','七分','三十人','三十分','三時','三本','三百円','上','下','中','中国','九時','二人','二十歳',
         '二時','二百人','人','人気','人間','休まない','休む','会います','会社','何人','何年生','何月何日','何本',
         '先生','先週','入らない','入る','八時半','八百円','六分','六年生','六時','六月三日','六本','六百円','出た',
         '出ない','出る','前','北','十分','十時','南','友だち','口','古い','右','名前','四時','国','土ようび',
         '外','大学','大学生','女','女の人','子ども','学校','学生','安い','左','店の人','後ろ','手','新しい',
         '日ようび','日本','日本人','日本語','書いて','書きました','月ようび','木ようび','本','東','母','毎月','毎週',
         '気分','水ようび','火ようび','父','男','男の人','男女','留学生','白い','目','立たない','立つ','耳',
         '聞きます','花','花がさいています','花をとってはいけません','行','行って','西','見て','見てから','見ません',
         '言います','話します','読みます','読んで','買います','足','車','車をつかってもいいですか','車をもっています','道',
         '道をあるいています','道をあるいてください','金ようび','長い','電話','電車','電車にのっています','電車にのってください',
         '韓国人','食べて','食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校','高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '108: ada target <u> yang sudah pernah diujikan di migration 039-107';
  END IF;

  RAISE NOTICE '108: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
