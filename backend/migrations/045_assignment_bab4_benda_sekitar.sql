-- 045_assignment_bab4_benda_sekitar.sql — Assignment Bab 4: Benda di Sekitar.
--
-- Ujian bab untuk Bab 4, fokus KANJI + GRAMMAR Bab 4, dengan kanji/grammar/
-- kosakata Bab 3 sebagai variasi (permintaan user). Konten ditarik dari Notion
-- N5-B4 "Benda di Sekitar" + N5-B3 "Perkenalan Diri"; modul di-resolve ordinal
-- (OFFSET 3, lanjutan pola 039-044).
--
-- ATURAN KANJI — BERUBAH dari migration 042 (assignment Bab 3).
-- 042 memaksa badan kalimat 100% kana karena siswa Bab 3 baru kenal 9 kanji
-- dan kanji cuma boleh muncul di dalam target <u>…</u>. Di Bab 4 siswa sudah
-- kenal 12 kanji, jadi atas keputusan user badan kalimat KINI BOLEH memakai
-- kanji — tapi HANYA 12 yang sudah diajarkan:
--     Bab 3: 人 名 何 学 校 先 生 国 語
--     Bab 4: 本 花 魚   (本=ホン/もと, 花=はな/カ, 魚=さかな・うお/ギョ)
-- Kata Bab 4 yang kanjinya BELUM diajarkan (傘・鞄・靴・時計・辞書 dst) tetap
-- ditulis kana. Diverifikasi mesin di bawah: kanji di luar 12 pada badan
-- kalimat → migrasi GAGAL.
-- Pengecualian sempit: target <u>…</u> di もんだい1 boleh memuat karakter
-- ikutan dari kata kosakata utuh (日 di 日本/日本人/日本語, 中 di 中国, 前 di
-- 名前) — kata-kata itu memang ditulis begitu di daftar kosakata Bab 3.
-- Karena itu pagar kanji dijalankan pada badan kalimat SETELAH bagian
-- <u>…</u> dibuang.
--
-- BATAS GRAMMAR KUMULATIF BAB 1-4 (11 pola, dari Notion):
--   Bab 3 (GRM-13..17, 230): 〜は〜です / 〜は〜じゃありません / 〜は〜ですか /
--     〜も / 〜の (kepemilikan) / 〜ね・〜よ
--   Bab 4 (GRM-18..21, 227): これ／それ／あれは〜です / 〜の〜 (penjelas) /
--     この／その／あの／どの + 名詞 / だれの〜ですか / そうです／そうじゃありません
-- MASIH DILARANG (belum diajarkan sama sekali): kata kerja apa pun (termasuk
-- bentuk ます), kata sifat い/な (Bab 6-7), partikel が・を・で・に・へ・と,
-- dan rantai の dalam satu kalimat (AのBのC — membingungkan di level ini).
-- Keempatnya dipagari sebagai assertion SQL di bawah, dan pagarnya diuji
-- benar-benar menggigit (bukan lolos kosong) waktu verifikasi lokal.
--
-- KENAPA PAGAR ITU ADA: migration 041 (assignment Bab 3) menegakkan aturan
-- kanji dengan ketat tapi TIDAK memagari grammar & kosakata — hasilnya soal
-- terlihat mudah (semua kana) padahal isinya N4 (klausa relatif, bentuk
-- lampau biasa, kutipan). 21 dari 50 soal fatal dan harus ditulis ulang total
-- lewat 042. Pagar di bawah supaya itu tidak terulang diam-diam.
--
-- Komposisi (sama seperti assignment Bab 3, pilihan user): もんだい1 漢字読み 12
-- + もんだい2 表記 9 + もんだい3 文脈規定 13 + 文の文法1 16 = pool 50, sample
-- 30 per attempt. Tanpa section 文の組み立て (keputusan user, konsisten dgn Bab 3).
-- Section terkecil 9 soal → peluang satu attempt kehilangan section itu ~0,007%.
--
-- Label section tetap gaya JLPT, INSTRUKSI Bahasa Indonesia (pola 042) —
-- aman karena tombol "✨ Generate JLPT" mencocokkan section lewat
-- (question_category, section_number) lalu MEWARISI label/instruction dari
-- baris yang sudah ada, bukan bikin section kembar.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat — kalau
-- admin sudah menambah soal manual/AI ke pelajaran ini, re-run migrasi ini
-- manual akan menghapusnya. Runner (migrations/run.js) sendiri cuma
-- menjalankan file ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus lalu
-- di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-4-benda-sekitar';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 3 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '045: modul Bab 4 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(benda|sekitar)' THEN
    RAISE NOTICE '045: modul Bab 4 terbaca "%" — kalau ternyata bukan Bab Benda di Sekitar, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '045: seed Assignment Bab 4 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 4 — Benda di Sekitar', 'quiz',
    'Tes materi Bab 4 (Benda di Sekitar) gaya JLPT. Moji-Goi: cara baca kanji 本・花・魚 dan 9 kanji Bab 3, cara menulisnya, serta memilih kosakata benda sesuai konteks. Tata Bahasa: これ／それ／あれ, この／その／あの／どの, だれの〜ですか, そうです／そうじゃありません, dan partikel は・も・の・か・ね・よ. Semua kalimat memakai pola Bab 1-4 saja — tanpa kata kerja dan tanpa kata sifat. Tiap attempt mengambil 30 soal acak dari 50. Lulus 70% (21/30), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-12) — fokus kanji Bab 4, variasi Bab 3 =====
    (1, 'vocabulary'::TEXT, 1, 'これは わたしの <u>本</u>です。',
        '本 dibaca ほん (buku). もと adalah bacaan kun yang dipakai untuk arti asal/pangkal, bukan untuk buku. ぼん menambah dakuten yang tidak ada, ほう salah bunyi panjang.'),
    (2, 'vocabulary', 1, 'あれは <u>花</u>です。',
        '花 dibaca はな (bunga). か adalah bacaan on yang hanya muncul di gabungan kata, bukan berdiri sendiri. ばな menambah dakuten, くさ adalah kata lain (rumput), bukan bacaan 花.'),
    (3, 'vocabulary', 1, 'それは <u>魚</u>です。',
        '魚 dibaca さかな (ikan). さがな dan ざかな menambah dakuten di tempat yang salah, さなか membalik urutan suku kata.'),
    (4, 'vocabulary', 1, 'わたしの くには <u>日本</u>です。',
        '日本 dibaca にほん (Jepang). Perhatikan: 本 di sini dibaca ほん sama seperti kata 本 sendirian, tetapi digabung dengan 日 menjadi にほん. にもと memakai bacaan kun もと, ひほん dan にっぼん salah bunyi.'),
    (5, 'vocabulary', 1, 'あの 人は <u>先生</u>です。',
        '先生 dibaca せんせい (guru). せんせえ salah menulis bunyi panjang (harus せい bukan せえ), ぜんせい menambah dakuten, せいせん membalik urutan.'),
    (6, 'vocabulary', 1, 'わたしは <u>学生</u>です。',
        '学生 dibaca がくせい (siswa). がっせい menambah sokuon っ yang tidak ada, がくせえ salah menulis bunyi panjang, かくせい menghilangkan dakuten pada が.'),
    (7, 'vocabulary', 1, 'あねは <u>学校</u>の 先生です。',
        '学校 dibaca がっこう (sekolah). Ada sokuon っ dan bunyi panjang こう. がこう menghilangkan sokuon, かっこう menghilangkan dakuten, がっごう menambah dakuten pada こ.'),
    (8, 'vocabulary', 1, 'すみません、お<u>名前</u>は？',
        '名前 dibaca なまえ (nama). 名 di sini dibaca な. なまへ memakai へ, めいまえ memakai bacaan on メイ yang tidak dipakai di kata ini, なあまえ menambah bunyi panjang yang tidak ada.'),
    (9, 'vocabulary', 1, 'わたしの <u>国</u>は タイです。',
        '国 sendirian dibaca くに (bacaan kun). Bacaan on コク hanya muncul kalau digabung, misalnya 中国 ちゅうごく. ぐに menambah dakuten, くにん menambah bunyi yang tidak ada.'),
    (10, 'vocabulary', 1, 'たなかさんは <u>中国</u>の しゅっしんです。',
        '中国 dibaca ちゅうごく (Tiongkok). 国 di sini memakai bacaan on dengan dakuten: ごく. ちゅうこく tanpa dakuten, じゅうごく mengubah ち jadi じ, ちゅごく menghilangkan bunyi panjang ゅう.'),
    (11, 'vocabulary', 1, 'あには <u>日本語</u>の 先生です。',
        '日本語 dibaca にほんご (bahasa Jepang). Kanji 語 berarti bahasa dan dibaca ご. にほんこ tanpa dakuten, にっぽんご memakai bacaan にっぽん yang tidak dipakai di sini, にほんかた memakai bacaan kun かた(る).'),
    (12, 'vocabulary', 1, 'かぞくは <u>何人</u>ですか。',
        'Di kalimat ini 何人 dibaca なんにん, artinya berapa orang. Bandingkan なにじん yang artinya orang dari negara mana — di sini yang ditanya jumlah anggota keluarga, jadi なんにん. なんじん dan なににん bukan bacaan yang benar.'),

    -- ===== もんだい2 表記 (13-21) — target hiragana, jawaban bentuk tulisan =====
    (13, 'vocabulary', 2, 'これは わたしの <u>ほん</u>です。',
        'ほん ditulis 本. Salah: 木 (pohon) yang mirip tapi tanpa garis mendatar di bawah, 未 dan 末 yang sama-sama mirip tapi posisi garis mendatarnya berbeda.'),
    (14, 'vocabulary', 2, 'あれは <u>はな</u>です。',
        'はな ditulis 花. Salah: 草 (rumput), 芸 (seni), 荷 (barang) — ketiganya sama-sama memakai radikal rumput di atas sehingga mudah tertukar, tapi bagian bawahnya berbeda.'),
    (15, 'vocabulary', 2, 'それは <u>さかな</u>です。',
        'さかな ditulis 魚. Salah: 漁 yang memakai radikal air di kiri (artinya menangkap ikan), 鳥 (burung) dan 馬 (kuda) yang sama-sama punya empat titik di bawah.'),
    (16, 'vocabulary', 2, 'わたしは <u>がくせい</u>です。',
        'がくせい ditulis 学生. Salah: 字生 memakai 字 (huruf) yang mirip 学, 学正 memakai 正 (benar), 学主 memakai 主 (tuan) yang mirip 生.'),
    (17, 'vocabulary', 2, 'あの 人は <u>せんせい</u>です。',
        'せんせい ditulis 先生. Salah: 失生 memakai 失 (kehilangan) yang sangat mirip 先, 洗生 memakai 洗 (mencuci) yang juga mirip, 先正 memakai 正.'),
    (18, 'vocabulary', 2, 'あねは <u>がっこう</u>の 先生です。',
        'がっこう ditulis 学校. Salah: 学枝 memakai 枝 (ranting), 学交 memakai 交 tanpa radikal kayu, 字校 memakai 字 sebagai ganti 学.'),
    (19, 'vocabulary', 2, 'わたしの <u>くに</u>は タイです。',
        'くに ditulis 国. Salah: 困 (susah), 因 (sebab), 回 (putaran) — ketiganya berbingkai kotak 囗 seperti 国 sehingga mudah tertukar, tapi isi di dalam kotaknya berbeda.'),
    (20, 'vocabulary', 2, 'あの <u>ひと</u>は りゅうがくせいです。',
        'ひと ditulis 人. Salah: 入 (masuk) yang arah coretannya terbalik, 八 (delapan) yang kedua garisnya tidak menyatu di atas, 大 (besar) yang punya garis mendatar.'),
    (21, 'vocabulary', 2, 'これは <u>なに</u>ですか。',
        'なに ditulis 何. Salah: 可 (bisa) yang merupakan bagian kanan 何 tanpa radikal orang 亻, 河 (sungai) memakai radikal air, 荷 (barang) memakai radikal rumput.'),

    -- ===== もんだい3 文脈規定 (22-34) — kosakata benda Bab 4 + variasi Bab 3 =====
    (22, 'vocabulary', 3, 'これは かぞくの（　）です。',
        'Jawabannya しゃしん (foto) — かぞくの しゃしん berarti foto keluarga. しんぶん (koran), ざっし (majalah), dan きって (perangko) sama-sama benda dari kertas, tapi tidak wajar dimiliki atau menggambarkan keluarga.'),
    (23, 'vocabulary', 3, 'これは ドアの（　）です。',
        'Jawabannya かぎ (kunci) — benda yang berpasangan dengan ドア (pintu). とけい (jam), かがみ (cermin), dan めがね (kacamata) sama-sama benda kecil, tapi tidak ada hubungannya dengan pintu.'),
    (24, 'vocabulary', 3, 'これは てがみの（　）です。',
        'Jawabannya きって (perangko) — benda yang ditempel pada てがみ (surat). かみ (kertas), ノート (buku catatan), dan ペン (pulpen) memang dipakai untuk menulis, tapi bukan bagian dari surat yang dikirim.'),
    (25, 'vocabulary', 3, 'これは かいしゃの（　）です。',
        'Jawabannya めいし (kartu nama) — kartu berisi nama dan かいしゃ (perusahaan) tempat bekerja. きょうかしょ (buku pelajaran), じしょ (kamus), dan ざっし (majalah) tidak menunjukkan identitas perusahaan.'),
    (26, 'vocabulary', 3, 'これは がっこうの（　）です。',
        'Jawabannya きょうかしょ (buku pelajaran) — benda yang dipakai di がっこう (sekolah). さいふ (dompet), くつ (sepatu), dan ぼうし (topi) adalah barang pribadi, bukan barang khas sekolah.'),
    (27, 'vocabulary', 3, 'あねは がっこうの 人です。あねは（　）です。',
        'Jawabannya せんせい (guru) — pekerjaan yang ada di がっこう. いしゃ (dokter) dan かんごし (perawat) bekerja di rumah sakit, ぎんこういん (pegawai bank) bekerja di bank.'),
    (28, 'vocabulary', 3, 'ちちは かいしゃの 人です。ちちは（　）です。',
        'Jawabannya かいしゃいん (karyawan) — orang yang bekerja di かいしゃ (perusahaan). がくせい masih belajar, せんせい mengajar, いしゃ merawat orang sakit.'),
    (29, 'vocabulary', 3, '「はじめまして。アニサです。」「はじめまして。たなかです。（　）。」',
        'Jawabannya よろしくおねがいします — kalimat penutup baku setelah menyebutkan nama saat perkenalan. ありがとうございます untuk berterima kasih, すみません untuk minta maaf, こちらこそ hanya dipakai sebagai balasan ucapan lawan bicara.'),
    (30, 'vocabulary', 3, '「（　）。」「ありがとうございます。」',
        'Jawabannya どうぞ — diucapkan saat mempersilakan atau menyerahkan sesuatu, lalu dibalas dengan terima kasih. すみません untuk minta maaf, はじめまして salam perkenalan, こちらこそ balasan ucapan.'),
    (31, 'vocabulary', 3, 'これは にほんの（　）です。',
        'Jawabannya おみやげ (oleh-oleh) — barang khas dari sebuah negara atau daerah. しごと berarti pekerjaan, くに berarti negara itu sendiri, なまえ berarti nama.'),
    (32, 'vocabulary', 3, 'これは かみです。てがみじゃありません。（　）です。',
        'Jawabannya はがき (kartu pos) — sama-sama terbuat dari かみ (kertas) dan dikirim lewat pos, tapi bukan てがみ (surat). かばん, くつ, dan いす bukan benda dari kertas.'),
    (33, 'vocabulary', 3, 'これは きょうかしょじゃありません。にほんごの（　）です。',
        'Jawabannya じしょ (kamus) — sama-sama buku untuk belajar にほんご, tapi bukan buku pelajaran. くつ (sepatu), かさ (payung), dan かがみ (cermin) bukan buku.'),
    (34, 'vocabulary', 3, '「よろしくおねがいします。」「（　）、よろしくおねがいします。」',
        'Jawabannya こちらこそ — artinya saya juga, dipakai membalas ucapan lawan bicara. はじめまして sudah lewat di awal perkenalan, どうぞ untuk mempersilakan, ありがとうございます untuk berterima kasih.'),

    -- ===== もんだい1 文の文法1 (35-50) — fokus pola Bab 4 =====
    (35, 'grammar'::TEXT, 1, '（　）は わたしの ペンです。',
        'Jawabannya これ. これ berdiri sendiri sebagai kata ganti, jadi bisa langsung diikuti は. この, その, dan あの WAJIB diikuti kata benda (この ペン), tidak bisa langsung diikuti は.'),
    (36, 'grammar', 1, '（　）本は わたしのです。',
        'Jawabannya この. Sebelum kata benda 本 harus memakai この, bukan これ. これ, それ, dan あれ adalah kata ganti yang berdiri sendiri dan tidak boleh langsung menempel pada kata benda.'),
    (37, 'grammar', 1, '「（　）は なんですか。」「これは じしょです。」',
        'Jawabannya それ. Lawan bicara menjawab dengan これ, artinya benda itu dekat dengan dia — jadi dari sisi penanya benda itu dekat lawan bicara, dan dipakai それ. これ dipakai untuk benda dekat diri sendiri; この dan どの harus diikuti kata benda.'),
    (38, 'grammar', 1, '「（　）本は あなたのですか。」',
        'Jawabannya どの (yang mana), karena diikuti kata benda 本. どれ juga berarti yang mana tapi berdiri sendiri tanpa kata benda. この dan これ tidak menanyakan pilihan.'),
    (39, 'grammar', 1, '「あなたの 本は（　）ですか。」',
        'Jawabannya どれ. Di posisi ini tidak ada kata benda setelahnya, jadi harus memakai kata ganti どれ, bukan どの yang wajib diikuti kata benda. この dan その bukan kata tanya.'),
    (40, 'grammar', 1, '（　）とけいは あにのです。',
        'Jawabannya あの, karena langsung diikuti kata benda とけい. あれ, これ, dan それ adalah kata ganti yang berdiri sendiri dan tidak bisa menempel pada kata benda.'),
    (41, 'grammar', 1, '「これは（　）本ですか。」「わたしのです。」',
        'Jawabannya だれの (punya siapa), karena dijawab dengan わたしのです yang menyebut pemilik. だれ tidak bisa langsung menempel pada kata benda tanpa の. なに menanyakan benda apa, どの menanyakan yang mana — keduanya tidak cocok dengan jawaban tentang pemilik.'),
    (42, 'grammar', 1, '「その かばんは（　）ですか。」「あねのです。」',
        'Jawabannya だれの. Jawabannya あねのです (punya kakak perempuan saya), jadi yang ditanyakan adalah pemiliknya. だれ tanpa の tidak bisa dipakai di sini, どの wajib diikuti kata benda, なんの menanyakan jenis, bukan pemilik.'),
    (43, 'grammar', 1, '「それは あなたの けいたいですか。」「はい、（　）。」',
        'Jawabannya そうです. Setelah はい dipakai そうです untuk membenarkan tanpa mengulang seluruh kalimat. そうじゃありません justru menyangkal, jadi bertentangan dengan はい. どうぞ dan こちらこそ bukan jawaban ya atau bukan.'),
    (44, 'grammar', 1, '「これは たなかさんの めいしですか。」「いいえ、（　）。わたしのです。」',
        'Jawabannya そうじゃありません. Setelah いいえ dipakai bentuk sangkalan, dan kalimat berikutnya menegaskan bahwa itu miliknya sendiri. そうです justru membenarkan. はじめまして dan ありがとうございます bukan jawaban ya atau bukan.'),
    (45, 'grammar', 1, 'これは にほんご（　）本です。',
        'Jawabannya の. Pola KB1 の KB2 dipakai untuk menerangkan jenis: にほんごの本 berarti buku berbahasa Jepang. は adalah penanda topik, も berarti juga, か membuat kalimat jadi pertanyaan.'),
    (46, 'grammar', 1, '「わたしも あなたも りゅうがくせいです（　）。」「はい！」',
        'Jawabannya ね. Partikel ね dipakai saat pembicara mengajak lawan bicara menyetujui hal yang sama-sama sudah diketahui, dan lawan bicara setuju dengan はい. よ justru dipakai untuk memberi tahu hal yang belum diketahui lawan bicara, padahal di sini lawan bicara sudah tahu. も dan の tidak bisa diletakkan setelah です di akhir kalimat.'),
    (47, 'grammar', 1, 'わたしは がくせいです。あに（　）せんせいです。',
        'Jawabannya は. Pekerjaan kakak berbeda dari pembicara, jadi ini informasi baru yang dikontraskan. Kalau memakai も artinya menjadi kakak juga がくせい, padahal beliau せんせい.'),
    (48, 'grammar', 1, 'わたしは りゅうがくせいです。リナさん（　）りゅうがくせいです。',
        'Jawabannya も yang berarti juga, karena keterangannya sama persis dengan kalimat sebelumnya. Kalau memakai は, kesan sama-sama itu hilang.'),
    (49, 'grammar', 1, '「おなまえは なんです（　）。」「たなかです。」',
        'Jawabannya か. Kalimat yang memakai kata tanya seperti なん WAJIB diakhiri か — tanpa か kalimatnya belum menjadi pertanyaan, dan tanda tanya tidak dipakai dalam bahasa Jepang. ね dan よ tidak bisa dipakai bersama kata tanya. の tidak bisa diletakkan setelah です di akhir kalimat.'),
    (50, 'grammar', 1, '「たなかさんは がくせいですか。」「いいえ、せんせいです（　）。」',
        'Jawabannya よ. Partikel よ dipakai untuk menegaskan informasi baru yang belum diketahui lawan bicara — di sini meluruskan dugaan yang salah. Kalimat ini sudah berupa jawaban, jadi tidak mungkin memakai か lagi.')
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
    (1,  0, 'ほん', TRUE),        (1,  1, 'もと', FALSE),       (1,  2, 'ぼん', FALSE),       (1,  3, 'ほう', FALSE),
    (2,  0, 'はな', TRUE),        (2,  1, 'か', FALSE),         (2,  2, 'ばな', FALSE),       (2,  3, 'くさ', FALSE),
    (3,  0, 'さかな', TRUE),      (3,  1, 'さがな', FALSE),     (3,  2, 'ざかな', FALSE),     (3,  3, 'さなか', FALSE),
    (4,  0, 'にほん', TRUE),      (4,  1, 'にもと', FALSE),     (4,  2, 'ひほん', FALSE),     (4,  3, 'にっぼん', FALSE),
    (5,  0, 'せんせい', TRUE),    (5,  1, 'せんせえ', FALSE),   (5,  2, 'ぜんせい', FALSE),   (5,  3, 'せいせん', FALSE),
    (6,  0, 'がくせい', TRUE),    (6,  1, 'がっせい', FALSE),   (6,  2, 'がくせえ', FALSE),   (6,  3, 'かくせい', FALSE),
    (7,  0, 'がっこう', TRUE),    (7,  1, 'がこう', FALSE),     (7,  2, 'かっこう', FALSE),   (7,  3, 'がっごう', FALSE),
    (8,  0, 'なまえ', TRUE),      (8,  1, 'なまへ', FALSE),     (8,  2, 'めいまえ', FALSE),   (8,  3, 'なあまえ', FALSE),
    (9,  0, 'くに', TRUE),        (9,  1, 'こく', FALSE),       (9,  2, 'ぐに', FALSE),       (9,  3, 'くにん', FALSE),
    (10, 0, 'ちゅうごく', TRUE),  (10, 1, 'ちゅうこく', FALSE), (10, 2, 'じゅうごく', FALSE), (10, 3, 'ちゅごく', FALSE),
    (11, 0, 'にほんご', TRUE),    (11, 1, 'にほんこ', FALSE),   (11, 2, 'にっぽんご', FALSE), (11, 3, 'にほんかた', FALSE),
    (12, 0, 'なんにん', TRUE),    (12, 1, 'なにじん', FALSE),   (12, 2, 'なんじん', FALSE),   (12, 3, 'なににん', FALSE),

    -- 表記 — opsi bentuk tulisan
    (13, 0, '本', TRUE),   (13, 1, '木', FALSE),   (13, 2, '未', FALSE),   (13, 3, '末', FALSE),
    (14, 0, '花', TRUE),   (14, 1, '草', FALSE),   (14, 2, '芸', FALSE),   (14, 3, '荷', FALSE),
    (15, 0, '魚', TRUE),   (15, 1, '漁', FALSE),   (15, 2, '鳥', FALSE),   (15, 3, '馬', FALSE),
    (16, 0, '学生', TRUE), (16, 1, '字生', FALSE), (16, 2, '学正', FALSE), (16, 3, '学主', FALSE),
    (17, 0, '先生', TRUE), (17, 1, '失生', FALSE), (17, 2, '洗生', FALSE), (17, 3, '先正', FALSE),
    (18, 0, '学校', TRUE), (18, 1, '学枝', FALSE), (18, 2, '学交', FALSE), (18, 3, '字校', FALSE),
    (19, 0, '国', TRUE),   (19, 1, '困', FALSE),   (19, 2, '因', FALSE),   (19, 3, '回', FALSE),
    (20, 0, '人', TRUE),   (20, 1, '入', FALSE),   (20, 2, '八', FALSE),   (20, 3, '大', FALSE),
    (21, 0, '何', TRUE),   (21, 1, '可', FALSE),   (21, 2, '河', FALSE),   (21, 3, '荷', FALSE),

    -- 文脈規定
    (22, 0, 'しゃしん', TRUE),    (22, 1, 'しんぶん', FALSE),   (22, 2, 'ざっし', FALSE),     (22, 3, 'きって', FALSE),
    (23, 0, 'かぎ', TRUE),        (23, 1, 'とけい', FALSE),     (23, 2, 'かがみ', FALSE),     (23, 3, 'めがね', FALSE),
    (24, 0, 'きって', TRUE),      (24, 1, 'かみ', FALSE),       (24, 2, 'ノート', FALSE),     (24, 3, 'ペン', FALSE),
    (25, 0, 'めいし', TRUE),      (25, 1, 'きょうかしょ', FALSE), (25, 2, 'じしょ', FALSE),   (25, 3, 'ざっし', FALSE),
    (26, 0, 'きょうかしょ', TRUE),(26, 1, 'さいふ', FALSE),     (26, 2, 'くつ', FALSE),       (26, 3, 'ぼうし', FALSE),
    (27, 0, 'せんせい', TRUE),    (27, 1, 'いしゃ', FALSE),     (27, 2, 'かんごし', FALSE),   (27, 3, 'ぎんこういん', FALSE),
    (28, 0, 'かいしゃいん', TRUE),(28, 1, 'がくせい', FALSE),   (28, 2, 'せんせい', FALSE),   (28, 3, 'いしゃ', FALSE),
    (29, 0, 'よろしくおねがいします', TRUE), (29, 1, 'ありがとうございます', FALSE), (29, 2, 'すみません', FALSE), (29, 3, 'こちらこそ', FALSE),
    (30, 0, 'どうぞ', TRUE),      (30, 1, 'すみません', FALSE), (30, 2, 'はじめまして', FALSE), (30, 3, 'こちらこそ', FALSE),
    (31, 0, 'おみやげ', TRUE),    (31, 1, 'しごと', FALSE),     (31, 2, 'くに', FALSE),       (31, 3, 'なまえ', FALSE),
    (32, 0, 'はがき', TRUE),      (32, 1, 'かばん', FALSE),     (32, 2, 'くつ', FALSE),       (32, 3, 'いす', FALSE),
    (33, 0, 'じしょ', TRUE),      (33, 1, 'くつ', FALSE),       (33, 2, 'かさ', FALSE),       (33, 3, 'かがみ', FALSE),
    (34, 0, 'こちらこそ', TRUE),  (34, 1, 'はじめまして', FALSE), (34, 2, 'どうぞ', FALSE),   (34, 3, 'ありがとうございます', FALSE),

    -- 文の文法1
    (35, 0, 'これ', TRUE),   (35, 1, 'この', FALSE),   (35, 2, 'その', FALSE),   (35, 3, 'あの', FALSE),
    (36, 0, 'この', TRUE),   (36, 1, 'これ', FALSE),   (36, 2, 'それ', FALSE),   (36, 3, 'あれ', FALSE),
    (37, 0, 'それ', TRUE),   (37, 1, 'これ', FALSE),   (37, 2, 'この', FALSE),   (37, 3, 'どの', FALSE),
    (38, 0, 'どの', TRUE),   (38, 1, 'どれ', FALSE),   (38, 2, 'この', FALSE),   (38, 3, 'これ', FALSE),
    (39, 0, 'どれ', TRUE),   (39, 1, 'どの', FALSE),   (39, 2, 'この', FALSE),   (39, 3, 'その', FALSE),
    (40, 0, 'あの', TRUE),   (40, 1, 'あれ', FALSE),   (40, 2, 'これ', FALSE),   (40, 3, 'それ', FALSE),
    (41, 0, 'だれの', TRUE), (41, 1, 'だれ', FALSE),   (41, 2, 'なに', FALSE),   (41, 3, 'どの', FALSE),
    (42, 0, 'だれの', TRUE), (42, 1, 'だれ', FALSE),   (42, 2, 'どの', FALSE),   (42, 3, 'なんの', FALSE),
    (43, 0, 'そうです', TRUE), (43, 1, 'そうじゃありません', FALSE), (43, 2, 'どうぞ', FALSE), (43, 3, 'こちらこそ', FALSE),
    (44, 0, 'そうじゃありません', TRUE), (44, 1, 'そうです', FALSE), (44, 2, 'はじめまして', FALSE), (44, 3, 'ありがとうございます', FALSE),
    (45, 0, 'の', TRUE),     (45, 1, 'は', FALSE),     (45, 2, 'も', FALSE),     (45, 3, 'か', FALSE),
    (46, 0, 'ね', TRUE),     (46, 1, 'よ', FALSE),     (46, 2, 'も', FALSE),     (46, 3, 'の', FALSE),
    (47, 0, 'は', TRUE),     (47, 1, 'も', FALSE),     (47, 2, 'の', FALSE),     (47, 3, 'か', FALSE),
    (48, 0, 'も', TRUE),     (48, 1, 'は', FALSE),     (48, 2, 'の', FALSE),     (48, 3, 'か', FALSE),
    (49, 0, 'か', TRUE),     (49, 1, 'ね', FALSE),     (49, 2, 'よ', FALSE),     (49, 3, 'の', FALSE),
    (50, 0, 'よ', TRUE),     (50, 1, 'ね', FALSE),     (50, 2, 'か', FALSE),     (50, 3, 'の', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '045: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '045: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai 12 kanji
  --    yang sudah diajarkan. Target <u>…</u> dikecualikan karena memuat kata
  --    kosakata utuh yang boleh mengandung karakter ikutan (日/中/前).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[人名何学校先生国語本花魚]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '045: ada kanji di luar 12 yang diajarkan pada badan kalimat soal';
  END IF;

  -- 2. Partikel yang belum diajarkan di Bab 1-4.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(が |を |で |へ |に |と )'
  ) THEN
    RAISE EXCEPTION '045: ada partikel di luar materi Bab 1-4 (が/を/で/へ/に/と) pada teks soal';
  END IF;

  -- 3. Kata kerja / kata sifat. Frasa Bab 1-4 yang memuat ます/ません tapi
  --    BUKAN kata kerja bebas (bentuk negatif kata benda + salam baku +
  --    そうです／そうじゃありません dari Bab 4) dibuang dulu sebelum dicek —
  --    termasuk すみません, yang di Bab 3 diajarkan sebagai ungkapan utuh,
  --    bukan konjugasi kata kerja.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(question,
             'そうじゃありません', ''), 'じゃありません', ''), 'ありません', ''),
             'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''),
             'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '045: ada indikasi kata kerja pada teks soal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(おおい|おもしろい|じょうず|たかい|やすい|おおきい|ちいさい|あたらしい|ふるい)'
  ) THEN
    RAISE EXCEPTION '045: ada kata sifat (Bab 6-7) pada teks soal';
  END IF;

  -- 4. Rantai の DALAM SATU KALIMAT (「AのBのC」). Dua kalimat yang
  --    masing-masing punya satu の tetap boleh — makanya polanya の…の tanpa
  --    melewati 。, bukan menghitung の per baris.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '045: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '045: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '045: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  RAISE NOTICE '045: selesai — 50 soal (vocabulary 34, grammar 16), semua pagar level lolos.';
END $$;
