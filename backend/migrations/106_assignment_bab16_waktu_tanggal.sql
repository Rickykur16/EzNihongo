-- 106_assignment_bab16_waktu_tanggal.sql — Assignment Bab 16: Waktu &
-- Tanggal.
--
-- Ujian bab untuk Bab 16, melanjutkan pola assignment Bab 1-15
-- (039/040/041/045/047/051/053/055/057/059/061/100/104/103/105). Modul
-- di-resolve ordinal (OFFSET 15, lanjutan pola 039-105).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 16 memperkenalkan 6 kanji BARU — 日(hi/nichi)・火(ka)・水(sui)・
-- 木(moku)・金(kin)・土(do), nama-nama hari — dikonfirmasi header
-- 085_bunpou_bab16.sql. 曜 BELUM diajarkan (dikonfirmasi di 085 juga), jadi
-- "ようび" SELALU ditulis kana, tidak pernah 曜日. もんだい1/2 diisi
-- KOSAKATA POLOS 7 nama hari (日ようび／月ようび／火ようび／水ようび／
-- 木ようび／金ようび／土ようび — 月 sendiri sudah taught sejak Bab3-9,
-- tapi tetap dimasukkan supaya siklus 7 hari lengkap) + 2 frasa tanggal
-- (何月何日／六月三日), gaya 105 (Bab 15) — bukan konjugasi kata kerja,
-- karena Bab 16 sendiri bertema partikel waktu & kosakata tanggal, bukan
-- keluarga konjugasi verba.
--
-- Whitelist kanji = whitelist 100/104/103/105 UNION 日火水木金土 (SAMA
-- PERSIS dengan v_kanji_ok di 085_bunpou_bab16.sql).
--
-- PAGAR KATA KERJA: TIDAK RELEVAN (もんだい1/2 kosakata polos) — tidak ada
-- assertion kata kerja di file ini, konsisten sejak 100.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini. (Pola に
-- justru jadi topik utama もんだい1 文の文法1 Bab ini — lihat di bawah.)
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   日ようび＝にちようび   月ようび＝げつようび   火ようび＝かようび
--   水ようび＝すいようび   木ようび＝もくようび   金ようび＝きんようび
--   土ようび＝どようび   何月何日＝なんがつなんにち   六月三日＝ろくがつみっか
--
-- JEBAKAN PAGAR "RANTAI の": satu-satunya の di もんだい1/2 ada di
-- "わたしの" (soal ke-9/18, di LUAR target <u>) — cuma SATU の per
-- kalimat, aman. もんだい3 soal 28/29 juga masing-masing cuma SATU の
-- ("こんしゅうの まえは"／"こんしゅうの つぎは") — sudah dicek manual.
--
-- CATATAN PROSES (biar tidak terulang): draft dedup array migrasi ini
-- sempat ke-grep 2 baris PALSU dari KOMENTAR migrasi 105 sendiri — literal
-- tag pembuka+penutup dengan isi tiga-titik atau ellipsis dipakai sebagai
-- placeholder di teks penjelasan — bukan target soal sungguhan. Sudah
-- difilter manual sebelum dipakai di array di bawah. Migrasi masa depan
-- yang menulis placeholder serupa di komentar sebaiknya pakai bentuk lain
-- (mis. tag pembuka+KATA+tag penutup) supaya tidak ketangkep grep
-- `(?<=<u>)[^<]+(?=</u>)` — atau paling tidak sadar bahwa isi tag apa pun
-- di teks komentar akan ikut ter-grep dan harus difilter manual sebelum
-- dipakai sebagai dedup array.
--
-- DEDUP WAJIB (pola established sejak 047, di-grep ulang PENUH — pola sama
-- dengan 105): array di bawah adalah 233 target unik dari SEMUA migrasi
-- assignment 039-105 yang benar-benar ada di repo saat ini (sudah bersih
-- dari 2 baris palsu di atas). 18 target baru di file ini (もんだい1/2)
-- sudah diverifikasi tidak beririsan.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (5/5/5/5 per pola: 〜に (partikel waktu)／
-- 〜月〜日 (tanggal)／毎週・毎月・毎年／何曜日・何月何日・いつ) = 50 soal,
-- SEMUA ditampilkan tiap attempt, lulus 70% (35/50), cooldown 12 jam.
--
-- Pola 〜に (31-35) menguji DUA ARAH: waktu berangka (jam/hari/bulan) WAJIB
-- に (soal 31-33), waktu relatif (あした／まいにち) JUSTRU TIDAK memakai に
-- (soal 34-35) — opsi salah adalah bentuk +を/+で/+ni yang salah, menguji
-- pemahaman nuansa partikel bukan cuma hafalan pola. Pola 〜月〜日 (36-40)
-- opsi salah adalah tanggal LAIN yang mirip (angka digeser), menguji
-- ketelitian bacaan, termasuk bacaan khusus tanggal 3 (みっか) dan 20
-- (はつか). Pola 毎週／毎月／毎年 (41-45) opsi salah cross-pattern +毎日
-- (kata sungguhan tapi di luar 3 pola resmi Bab ini). Pola
-- 何曜日／何月何日／いつ (46-50) opsi salah cross-pattern + 何時 (kata
-- tanya waktu lain yang belum diajarkan sebagai pola, cuma distraktor).
--
-- もんだい3 文脈規定: 12 kosakata waktu relatif dari bank kosakata Bab 16
-- (074_bab16_intro_kosakata_kanji.sql) — あした／きのう／あさって／
-- せんげつ／らいげつ／こんげつ／きょねん／らいねん／しゅうまつ／
-- せんしゅう／らいしゅう／こんしゅう. Kata-kata ini TIDAK memakai kanji
-- yang belum taught (banyak kata lain di bank 074 seperti 明日／今日／
-- 昨日／来月／今月 memakai kanji 明／今／昨／来 yang belum diajarkan —
-- SEMUA ditulis kana polos untuk aman, konsisten dengan cara 105 menulis
-- もんだい3-nya).
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-105.
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
  v_bab_no       INT  := 16;
  v_title_re     TEXT := '(hari|jadwal|tanggal)';
  v_lesson_slug  TEXT := 'assignment-bab-16-waktu-tanggal';
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
    RAISE NOTICE '106: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '106: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '106: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 16: Waktu & Tanggal', 'quiz',
    'Tes materi Bab 16 (Waktu & Tanggal) gaya JLPT. Moji-Goi: cara baca dan menulis 6 kanji baru (日・火・水・木・金・土) dalam nama hari serta frasa tanggal, plus kosakata waktu relatif (あした・きのう・あさって・せんげつ・らいげつ dst). Tata Bahasa: partikel 〜に untuk waktu berangka (jam/hari/bulan) vs waktu relatif tanpa に, cara membaca tanggal 〜月〜日 (termasuk bacaan khusus みっか/はつか), 毎週／毎月／毎年 untuk pengulangan, dan kata tanya 何曜日／何月何日／いつ. Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 6 kanji baru (日/火/水/木/金/土) + 何月何日 =====
    (1, 'vocabulary'::TEXT, 1, 'きょうは <u>日ようび</u>です。',
        '日ようび dibaca にちようび. 日 kanji baru Bab 16 untuk hari Minggu (曜 belum diajarkan, jadi ようび tetap kana).'),
    (2, 'vocabulary', 1, 'あしたは <u>月ようび</u>です。',
        '月ようび dibaca げつようび. 月 (bulan, sudah taught sejak lama) dipakai juga untuk hari Senin.'),
    (3, 'vocabulary', 1, 'きのうは <u>火ようび</u>でした。',
        '火ようび dibaca かようび. 火 kanji baru Bab 16 untuk hari Selasa.'),
    (4, 'vocabulary', 1, '<u>水ようび</u>に テストが あります。',
        '水ようび dibaca すいようび. 水 kanji baru Bab 16 untuk hari Rabu.'),
    (5, 'vocabulary', 1, '<u>木ようび</u>に としょかんへ 行きます。',
        '木ようび dibaca もくようび. 木 kanji baru Bab 16 untuk hari Kamis.'),
    (6, 'vocabulary', 1, '<u>金ようび</u>に えいがを 見ます。',
        '金ようび dibaca きんようび. 金 kanji baru Bab 16 untuk hari Jumat.'),
    (7, 'vocabulary', 1, '<u>土ようび</u>に 休みます。',
        '土ようび dibaca どようび. 土 kanji baru Bab 16 untuk hari Sabtu.'),
    (8, 'vocabulary', 1, 'たんじょうびは <u>何月何日</u>ですか。',
        '何月何日 dibaca なんがつなんにち. 何 (taught) + 月 (taught) + 何 + 日 (baru) membentuk frasa tanya tanggal.'),
    (9, 'vocabulary', 1, 'わたしの たんじょうびは <u>六月三日</u>です。',
        '六月三日 dibaca ろくがつみっか. Tanggal 3 punya bacaan khusus みっか, bukan さんにち.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'きょうは <u>にちようび</u>です。',
        'にちようび ditulis 日ようび. Salah: 月ようび (げつようび, Senin), 火ようび (かようび, Selasa), 水ようび (すいようび, Rabu).'),
    (11, 'vocabulary', 2, 'あしたは <u>げつようび</u>です。',
        'げつようび ditulis 月ようび. Salah: 日ようび (にちようび, Minggu), 火ようび (かようび, Selasa), 水ようび (すいようび, Rabu).'),
    (12, 'vocabulary', 2, 'きのうは <u>かようび</u>でした。',
        'かようび ditulis 火ようび. Salah: 日ようび (にちようび, Minggu), 月ようび (げつようび, Senin), 木ようび (もくようび, Kamis).'),
    (13, 'vocabulary', 2, '<u>すいようび</u>に テストが あります。',
        'すいようび ditulis 水ようび. Salah: 火ようび (かようび, Selasa), 木ようび (もくようび, Kamis), 金ようび (きんようび, Jumat).'),
    (14, 'vocabulary', 2, '<u>もくようび</u>に としょかんへ 行きます。',
        'もくようび ditulis 木ようび. Salah: 水ようび (すいようび, Rabu), 金ようび (きんようび, Jumat), 土ようび (どようび, Sabtu).'),
    (15, 'vocabulary', 2, '<u>きんようび</u>に えいがを 見ます。',
        'きんようび ditulis 金ようび. Salah: 木ようび (もくようび, Kamis), 土ようび (どようび, Sabtu), 日ようび (にちようび, Minggu).'),
    (16, 'vocabulary', 2, '<u>どようび</u>に 休みます。',
        'どようび ditulis 土ようび. Salah: 金ようび (きんようび, Jumat), 日ようび (にちようび, Minggu), 月ようび (げつようび, Senin).'),
    (17, 'vocabulary', 2, 'たんじょうびは <u>なんがつなんにち</u>ですか。',
        'なんがつなんにち ditulis 何月何日. Salah: 六月三日 (ろくがつみっか, tanggal 3 Juni — jawaban spesifik, bukan pertanyaan), 日ようび (にちようび, Minggu), 月ようび (げつようび, Senin).'),
    (18, 'vocabulary', 2, 'わたしの たんじょうびは <u>ろくがつみっか</u>です。',
        'ろくがつみっか ditulis 六月三日. Salah: 何月何日 (なんがつなんにち, pertanyaan tanggal), 日ようび (にちようび, Minggu), 月ようび (げつようび, Senin).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata waktu relatif =====
    (19, 'vocabulary', 3, 'きょう すいようびです。（　）は もくようびです。',
        'Jawabannya あした (besok) — もくようび (Kamis) adalah hari setelah すいようび (Rabu). きのう, あさって, せんげつ tidak cocok.'),
    (20, 'vocabulary', 3, 'きょう すいようびです。（　）は かようびでした。',
        'Jawabannya きのう (kemarin) — かようび (Selasa) adalah hari sebelum すいようび (Rabu). あした, あさって, らいげつ tidak cocok.'),
    (21, 'vocabulary', 3, 'きょう すいようびです。（　）は きんようびです。',
        'Jawabannya あさって (lusa) — きんようび (Jumat) adalah dua hari setelah すいようび (Rabu). あした, きのう, こんげつ tidak cocok.'),
    (22, 'vocabulary', 3, 'いま 三月です。（　）は 二月でした。',
        'Jawabannya せんげつ (bulan lalu) — 二月 adalah bulan sebelum 三月. らいげつ, こんげつ, きょねん tidak cocok.'),
    (23, 'vocabulary', 3, 'いま 三月です。（　）は 四月です。',
        'Jawabannya らいげつ (bulan depan) — 四月 adalah bulan setelah 三月. せんげつ, こんげつ, らいねん tidak cocok.'),
    (24, 'vocabulary', 3, 'いま 見ている 月は（　）です。',
        'Jawabannya こんげつ (bulan ini). せんげつ, らいげつ, こんしゅう tidak cocok untuk bulan yang sedang berjalan.'),
    (25, 'vocabulary', 3, 'いま 二千二十六年です。（　）は 二千二十五年でした。',
        'Jawabannya きょねん (tahun lalu) — 二千二十五年 adalah tahun sebelum 二千二十六年. らいねん, せんげつ, らいげつ tidak cocok.'),
    (26, 'vocabulary', 3, 'いま 二千二十六年です。（　）は 二千二十七年です。',
        'Jawabannya らいねん (tahun depan) — 二千二十七年 adalah tahun setelah 二千二十六年. きょねん, せんげつ, らいげつ tidak cocok.'),
    (27, 'vocabulary', 3, 'どようびと 日ようびは（　）です。',
        'Jawabannya しゅうまつ (akhir pekan) — Sabtu dan Minggu bersama disebut akhir pekan. せんしゅう, らいしゅう, こんしゅう tidak cocok.'),
    (28, 'vocabulary', 3, 'こんしゅうの まえは（　）です。',
        'Jawabannya せんしゅう (minggu lalu) — minggu sebelum minggu ini. らいしゅう, こんしゅう, しゅうまつ tidak cocok.'),
    (29, 'vocabulary', 3, 'こんしゅうの つぎは（　）です。',
        'Jawabannya らいしゅう (minggu depan) — minggu setelah minggu ini. せんしゅう, こんしゅう, しゅうまつ tidak cocok.'),
    (30, 'vocabulary', 3, 'いま いる しゅうは（　）です。',
        'Jawabannya こんしゅう (minggu ini). せんしゅう, らいしゅう, しゅうまつ tidak cocok untuk minggu yang sedang berjalan.'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 16 (5/5/5/5) =====
    -- Pola 1: 〜に (partikel waktu) — waktu berangka WAJIB に, waktu relatif TIDAK (31-35)
    (31, 'grammar'::TEXT, 1, '（　）、おきます。「七時に。」',
        'Jawabannya 七時に — partikel に dipakai untuk waktu yang bisa diangkakan seperti jam. 七時 (tanpa に), 七時を, 七時で tidak tepat untuk menandai waktu jam.'),
    (32, 'grammar', 1, '（　）、ともだちと あいます。「日ようびに。」',
        'Jawabannya 日ようびに — nama hari juga memakai に. 日ようび (tanpa に), 日ようびを, 日ようびで tidak tepat.'),
    (33, 'grammar', 1, '（　）、日本へ 行きます。「九月に。」',
        'Jawabannya 九月に — nama bulan juga memakai に. 九月 (tanpa に), 九月を, 九月で tidak tepat.'),
    (34, 'grammar', 1, '（　）、テストが あります。「あした。」',
        'Jawabannya あした — kata waktu RELATIF seperti あした TIDAK memakai partikel に. あしたに, あしたを, あしたで tidak tepat.'),
    (35, 'grammar', 1, '（　）、しゅくだいを します。「まいにち。」',
        'Jawabannya まいにち — sama seperti あした, まいにち adalah kata waktu yang TIDAK memakai partikel に. まいにちに, まいにちを, まいにちで tidak tepat.'),

    -- Pola 2: 〜月〜日 (tanggal) (36-40)
    (36, 'grammar', 1, 'たんじょうびは（　）です。「四月十日。」',
        'Jawabannya 四月十日 — bulan + tanggal yang sesuai konteks. 三月十日, 四月九日, 五月十日 adalah tanggal lain yang mirip tapi salah.'),
    (37, 'grammar', 1, 'しけんは（　）です。「三月一日。」',
        'Jawabannya 三月一日. 二月一日, 三月二日, 四月一日 adalah tanggal lain yang mirip tapi salah.'),
    (38, 'grammar', 1, 'パーティーは（　）に あります。「十二月二十五日。」',
        'Jawabannya 十二月二十五日. 十一月二十五日, 十二月二十四日, 十二月二十六日 adalah tanggal lain yang mirip tapi salah.'),
    (39, 'grammar', 1, 'わたしの たんじょうびは（　）です。「六月三日。」',
        'Jawabannya 六月三日 (bacaan みっか untuk tanggal 3). 六月四日, 五月三日, 七月三日 adalah tanggal lain yang mirip tapi salah.'),
    (40, 'grammar', 1, 'きょうは（　）です。「八月二十日。」',
        'Jawabannya 八月二十日 (bacaan はつか untuk tanggal 20). 八月十日, 七月二十日, 八月二十一日 adalah tanggal lain yang mirip tapi salah.'),

    -- Pola 3: 毎週／毎月／毎年 (41-45)
    (41, 'grammar', 1, '（　）、土ようびに テニスを します。「毎週。」',
        'Jawabannya 毎週 — kegiatan berulang tiap minggu di hari yang sama. 毎月, 毎年, 毎日 tidak cocok untuk pola mingguan.'),
    (42, 'grammar', 1, '（　）、本を 三さつ 読みます。「毎月。」',
        'Jawabannya 毎月 — kegiatan berulang tiap bulan. 毎週, 毎年, 毎日 tidak cocok.'),
    (43, 'grammar', 1, '（　）、うみへ 行きます。「毎年。」',
        'Jawabannya 毎年 — kegiatan berulang tiap tahun. 毎週, 毎月, 毎日 tidak cocok.'),
    (44, 'grammar', 1, '（　）、テストが あります。「毎週。」',
        'Jawabannya 毎週 — tes rutin tiap minggu. 毎月, 毎年, 毎日 tidak cocok.'),
    (45, 'grammar', 1, '（　）、りょこうを します。「毎年。」',
        'Jawabannya 毎年 — liburan rutin tiap tahun. 毎週, 毎月, 毎日 tidak cocok.'),

    -- Pola 4: 何曜日／何月何日／いつ (46-50)
    (46, 'grammar', 1, '「きょうは（　）ですか。」「すいようびです。」「何ようび。」',
        'Jawabannya 何ようび — jawabannya nama hari (すいようび), jadi pertanyaannya menanyakan hari. 何月何日, いつ, 何時 tidak setepat 何ようび untuk konteks ini.'),
    (47, 'grammar', 1, '「たんじょうびは（　）ですか。」「四月十日です。」「何月何日。」',
        'Jawabannya 何月何日 — jawabannya tanggal lengkap (四月十日). 何ようび, いつ, 何時 tidak setepat 何月何日.'),
    (48, 'grammar', 1, '「しけんは（　）ですか。」「らいしゅうです。」「いつ。」',
        'Jawabannya いつ — jawabannya waktu umum (らいしゅう), bukan hari/tanggal/jam spesifik, jadi いつ paling tepat. 何ようび, 何月何日, 何時 terlalu spesifik.'),
    (49, 'grammar', 1, '「かいぎは（　）ですか。」「木ようびです。」「何ようび。」',
        'Jawabannya 何ようび — jawabannya nama hari (木ようび). 何月何日, いつ, 何時 tidak setepat 何ようび.'),
    (50, 'grammar', 1, '「なつやすみは（　）ですか。」「八月です。」「いつ。」',
        'Jawabannya いつ — jawabannya bulan saja (八月), waktu umum, bukan hari/tanggal/jam spesifik. 何ようび, 何月何日, 何時 terlalu spesifik.')
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
    (1, 0, 'にちようび', TRUE), (1, 1, 'げつようび', FALSE), (1, 2, 'かようび', FALSE), (1, 3, 'すいようび', FALSE),
    (2, 0, 'げつようび', TRUE), (2, 1, 'にちようび', FALSE), (2, 2, 'かようび', FALSE), (2, 3, 'もくようび', FALSE),
    (3, 0, 'かようび', TRUE), (3, 1, 'にちようび', FALSE), (3, 2, 'げつようび', FALSE), (3, 3, 'もくようび', FALSE),
    (4, 0, 'すいようび', TRUE), (4, 1, 'かようび', FALSE), (4, 2, 'もくようび', FALSE), (4, 3, 'きんようび', FALSE),
    (5, 0, 'もくようび', TRUE), (5, 1, 'すいようび', FALSE), (5, 2, 'きんようび', FALSE), (5, 3, 'どようび', FALSE),
    (6, 0, 'きんようび', TRUE), (6, 1, 'もくようび', FALSE), (6, 2, 'どようび', FALSE), (6, 3, 'にちようび', FALSE),
    (7, 0, 'どようび', TRUE), (7, 1, 'きんようび', FALSE), (7, 2, 'にちようび', FALSE), (7, 3, 'げつようび', FALSE),
    (8, 0, 'なんがつなんにち', TRUE), (8, 1, 'ろくがつみっか', FALSE), (8, 2, 'にちようび', FALSE), (8, 3, 'げつようび', FALSE),
    (9, 0, 'ろくがつみっか', TRUE), (9, 1, 'なんがつなんにち', FALSE), (9, 2, 'にちようび', FALSE), (9, 3, 'げつようび', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '日ようび', TRUE), (10, 1, '月ようび', FALSE), (10, 2, '火ようび', FALSE), (10, 3, '水ようび', FALSE),
    (11, 0, '月ようび', TRUE), (11, 1, '日ようび', FALSE), (11, 2, '火ようび', FALSE), (11, 3, '水ようび', FALSE),
    (12, 0, '火ようび', TRUE), (12, 1, '日ようび', FALSE), (12, 2, '月ようび', FALSE), (12, 3, '木ようび', FALSE),
    (13, 0, '水ようび', TRUE), (13, 1, '火ようび', FALSE), (13, 2, '木ようび', FALSE), (13, 3, '金ようび', FALSE),
    (14, 0, '木ようび', TRUE), (14, 1, '水ようび', FALSE), (14, 2, '金ようび', FALSE), (14, 3, '土ようび', FALSE),
    (15, 0, '金ようび', TRUE), (15, 1, '木ようび', FALSE), (15, 2, '土ようび', FALSE), (15, 3, '日ようび', FALSE),
    (16, 0, '土ようび', TRUE), (16, 1, '金ようび', FALSE), (16, 2, '日ようび', FALSE), (16, 3, '月ようび', FALSE),
    (17, 0, '何月何日', TRUE), (17, 1, '六月三日', FALSE), (17, 2, '日ようび', FALSE), (17, 3, '月ようび', FALSE),
    (18, 0, '六月三日', TRUE), (18, 1, '何月何日', FALSE), (18, 2, '日ようび', FALSE), (18, 3, '月ようび', FALSE),

    -- 文脈規定
    (19, 0, 'あした', TRUE), (19, 1, 'きのう', FALSE), (19, 2, 'あさって', FALSE), (19, 3, 'せんげつ', FALSE),
    (20, 0, 'きのう', TRUE), (20, 1, 'あした', FALSE), (20, 2, 'あさって', FALSE), (20, 3, 'らいげつ', FALSE),
    (21, 0, 'あさって', TRUE), (21, 1, 'あした', FALSE), (21, 2, 'きのう', FALSE), (21, 3, 'こんげつ', FALSE),
    (22, 0, 'せんげつ', TRUE), (22, 1, 'らいげつ', FALSE), (22, 2, 'こんげつ', FALSE), (22, 3, 'きょねん', FALSE),
    (23, 0, 'らいげつ', TRUE), (23, 1, 'せんげつ', FALSE), (23, 2, 'こんげつ', FALSE), (23, 3, 'らいねん', FALSE),
    (24, 0, 'こんげつ', TRUE), (24, 1, 'せんげつ', FALSE), (24, 2, 'らいげつ', FALSE), (24, 3, 'こんしゅう', FALSE),
    (25, 0, 'きょねん', TRUE), (25, 1, 'らいねん', FALSE), (25, 2, 'せんげつ', FALSE), (25, 3, 'らいげつ', FALSE),
    (26, 0, 'らいねん', TRUE), (26, 1, 'きょねん', FALSE), (26, 2, 'せんげつ', FALSE), (26, 3, 'らいげつ', FALSE),
    (27, 0, 'しゅうまつ', TRUE), (27, 1, 'せんしゅう', FALSE), (27, 2, 'らいしゅう', FALSE), (27, 3, 'こんしゅう', FALSE),
    (28, 0, 'せんしゅう', TRUE), (28, 1, 'らいしゅう', FALSE), (28, 2, 'こんしゅう', FALSE), (28, 3, 'しゅうまつ', FALSE),
    (29, 0, 'らいしゅう', TRUE), (29, 1, 'せんしゅう', FALSE), (29, 2, 'こんしゅう', FALSE), (29, 3, 'しゅうまつ', FALSE),
    (30, 0, 'こんしゅう', TRUE), (30, 1, 'せんしゅう', FALSE), (30, 2, 'らいしゅう', FALSE), (30, 3, 'しゅうまつ', FALSE),

    -- 文の文法1 — 〜に (partikel waktu)
    (31, 0, '七時に', TRUE), (31, 1, '七時', FALSE), (31, 2, '七時を', FALSE), (31, 3, '七時で', FALSE),
    (32, 0, '日ようびに', TRUE), (32, 1, '日ようび', FALSE), (32, 2, '日ようびを', FALSE), (32, 3, '日ようびで', FALSE),
    (33, 0, '九月に', TRUE), (33, 1, '九月', FALSE), (33, 2, '九月を', FALSE), (33, 3, '九月で', FALSE),
    (34, 0, 'あした', TRUE), (34, 1, 'あしたに', FALSE), (34, 2, 'あしたを', FALSE), (34, 3, 'あしたで', FALSE),
    (35, 0, 'まいにち', TRUE), (35, 1, 'まいにちに', FALSE), (35, 2, 'まいにちを', FALSE), (35, 3, 'まいにちで', FALSE),

    -- 〜月〜日 (tanggal)
    (36, 0, '四月十日', TRUE), (36, 1, '三月十日', FALSE), (36, 2, '四月九日', FALSE), (36, 3, '五月十日', FALSE),
    (37, 0, '三月一日', TRUE), (37, 1, '二月一日', FALSE), (37, 2, '三月二日', FALSE), (37, 3, '四月一日', FALSE),
    (38, 0, '十二月二十五日', TRUE), (38, 1, '十一月二十五日', FALSE), (38, 2, '十二月二十四日', FALSE), (38, 3, '十二月二十六日', FALSE),
    (39, 0, '六月三日', TRUE), (39, 1, '六月四日', FALSE), (39, 2, '五月三日', FALSE), (39, 3, '七月三日', FALSE),
    (40, 0, '八月二十日', TRUE), (40, 1, '八月十日', FALSE), (40, 2, '七月二十日', FALSE), (40, 3, '八月二十一日', FALSE),

    -- 毎週／毎月／毎年
    (41, 0, '毎週', TRUE), (41, 1, '毎月', FALSE), (41, 2, '毎年', FALSE), (41, 3, '毎日', FALSE),
    (42, 0, '毎月', TRUE), (42, 1, '毎週', FALSE), (42, 2, '毎年', FALSE), (42, 3, '毎日', FALSE),
    (43, 0, '毎年', TRUE), (43, 1, '毎週', FALSE), (43, 2, '毎月', FALSE), (43, 3, '毎日', FALSE),
    (44, 0, '毎週', TRUE), (44, 1, '毎月', FALSE), (44, 2, '毎年', FALSE), (44, 3, '毎日', FALSE),
    (45, 0, '毎年', TRUE), (45, 1, '毎週', FALSE), (45, 2, '毎月', FALSE), (45, 3, '毎日', FALSE),

    -- 何曜日／何月何日／いつ
    (46, 0, '何ようび', TRUE), (46, 1, '何月何日', FALSE), (46, 2, 'いつ', FALSE), (46, 3, '何時', FALSE),
    (47, 0, '何月何日', TRUE), (47, 1, '何ようび', FALSE), (47, 2, 'いつ', FALSE), (47, 3, '何時', FALSE),
    (48, 0, 'いつ', TRUE), (48, 1, '何ようび', FALSE), (48, 2, '何月何日', FALSE), (48, 3, '何時', FALSE),
    (49, 0, '何ようび', TRUE), (49, 1, '何月何日', FALSE), (49, 2, 'いつ', FALSE), (49, 3, '何時', FALSE),
    (50, 0, 'いつ', TRUE), (50, 1, '何ようび', FALSE), (50, 2, '何月何日', FALSE), (50, 3, '何時', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '106: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '106: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) +
  --    日火水木金土 (Bab 16) — SAMA PERSIS dengan v_kanji_ok di
  --    085_bunpou_bab16.sql. もんだい3 tidak memakai <u>, jadi SELURUH
  --    kolom question-nya kena pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '106: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION UMUM (dihapus sejak 059) — pola 〜に
  --    justru topik utama もんだい1 文の文法1, diuji manual di atas.
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 kosakata polos, bukan
  --    konjugasi — tidak relevan sejak 100).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '106: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '106: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '106: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    233 target unik yang sudah dipakai di 039-105 (di-grep ulang penuh
  --    dari file migrasi sungguhan, dibersihkan dari 2 baris komentar
  --    palsu — lihat catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'あいます','いいます','いきました','いって','いんど','えきでまっています','えきまえ','おみせ','お店','かいしゃ',
         'かいて','かいます','かきます','がいこく','がくせい','がっこう','ききます','きゅうにん','きゅうひゃくえん','くじかん',
         'くに','くるまをつかってもいいですか','くるまをもっています','こくどう','ごご','ごじ','ごじゅうにん','ごせんえん',
         'ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん','さかな','さゆう','さんにん','さんねんせい',
         'しゃどう','じかん','じゅうごふん','じゅうにじ','じゅうにん','じゅっぽん','じょうげ','せんえん','せんげつ','せんせい',
         'せんにん','ぜんご','たい','たたない','たつ','たべて','たべもの','ちゅうかん','ちゅうがくせい','ちゅうねん','でた',
         'でない','でる','でんしゃにのっています','でんしゃにのってください','でんわ','とうざい','ななひゃくえん','なに','なんじ',
         'なんせい','なんとう','なんねん','なんぼく','にじゅうにん','にせんえん','にねんせい','にひゃくえん','にほん',
         'のみました','のんで','はいらない','はいる','はちじ','はちにん','はな','はながさいています','はなします',
         'はなをとってはいけません','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい','ほくとう','ほん',
         'まいにち','まんえん','みせのひと','みちをあるいています','みちをあるいてください','みて','みました','やすまない',
         'やすむ','よにん','よねんせい','よみました','よんじゅうにん','よんで','よんほん','ろくにん','一人','一分','一年',
         '一時','一本','七人','七分','三十人','三十分','三時','三本','三百円','上','下','中','中国','九時',
         '二人','二十歳','二時','二百人','人','人気','人間','休まない','休む','会います','会社','何人','何年生',
         '何本','先生','先週','入らない','入る','八時半','八百円','六分','六年生','六時','六本','六百円','出た',
         '出ない','出る','前','北','十分','十時','南','古い','右','名前','四時','国','外','大学','大学生',
         '女','女の人','学校','学生','安い','左','店の人','後ろ','新しい','日本','日本人','日本語','書いて',
         '書きました','本','東','毎月','毎週','気分','男','男の人','男女','留学生','白い','立たない','立つ',
         '聞きます','花','花がさいています','花をとってはいけません','行','行って','西','見て','見てから','見ません',
         '言います','話します','読みます','読んで','買います','車','車をつかってもいいですか','車をもっています','道',
         '道をあるいています','道をあるいてください','長い','電話','電車','電車にのっています','電車にのってください','韓国人',
         '食べて','食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校','高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '106: ada target <u> yang sudah pernah diujikan di migration 039-105';
  END IF;

  RAISE NOTICE '106: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
