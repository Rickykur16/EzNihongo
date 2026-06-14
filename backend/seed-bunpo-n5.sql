-- seed-bunpo-n5.sql
-- Tambah 2 pelajaran bunpo (grammar, tipe 'video') ke tiap Bab N5 (Bab 7-20),
-- diposisikan tepat SEBELUM "Assignment BAB N" (jadi setelah Kanji) — persis
-- urutan Bab 3: Introduction -> Kosakata -> Kanji -> [2 bunpo] -> Assignment.
--
-- Anchor: tiap Bab dicari lewat lesson "Assignment BAB N"-nya, jadi script ini
-- TIDAK perlu tau module id/slug-nya. Module = Bab di dashboard.
--
-- AMAN di-rerun & anti-duplikat. Sebuah Bab di-SKIP kalau:
--   (a) lesson "Assignment BAB N" (anchor) nggak ketemu, atau
--   (b) module-nya sudah punya >= 2 lesson tipe 'video' (Introduction + bunpo
--       kemungkinan sudah ada — mis. Bab yang sudah kamu tambahin manual).
--
-- Jalankan di VPS (yang punya akses DB):
--   cd /var/www/eznihongo/backend
--   psql "$DATABASE_URL" -f seed-bunpo-n5.sql
-- (DATABASE_URL ada di backend/.env)
--
-- Atau langsung dari branch tanpa checkout:
--   cd /var/www/eznihongo && git fetch origin claude/awesome-fermi-icab7o \
--     && git show origin/claude/awesome-fermi-icab7o:backend/seed-bunpo-n5.sql \
--        | psql "$DATABASE_URL"

DO $$
DECLARE
  r      RECORD;
  v_mod  uuid;
  v_order int;
  v_vid  int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      (7,  'bunpo-7-1',  'Konjugasi な-Adjektiva（だ・じゃありません・でした）',
           'bunpo-7-2',  'Penggunaan な-Adjektiva（な＋名詞・〜が好き・〜で）'),
      (8,  'bunpo-8-1',  'Keberadaan Benda（〜に〜があります／います）',
           'bunpo-8-2',  'Bertanya & Posisi（どこ・うえ・した・まえ）'),
      (9,  'bunpo-9-1',  'Pergi & Transportasi（〜へ行く・〜で行く）',
           'bunpo-9-2',  'Rute & Kata Tanya（〜から〜まで・いつ・どこへ・だれと）'),
      (10, 'bunpo-10-1', 'Konjugasi Kata Kerja（〜ます・ません・ました・ませんでした）',
           'bunpo-10-2', 'Adverbia Frekuensi（毎日・いつも・時々・よく・ぜんぜん）'),
      (11, 'bunpo-11-1', 'Mengenal Counter & Tanya Jumlah（一つ・一人・いくつ・何人）',
           'bunpo-11-2', 'Pakai Counter dalam Kalimat（〜を＋counter・counterあります）'),
      (12, 'bunpo-12-1', 'Cara Membentuk Te-form（Group 1・2・Irregular）',
           'bunpo-12-2', 'Menyambung Aksi（〜て、〜・〜てから）'),
      (13, 'bunpo-13-1', 'Sedang Berlangsung & Permintaan（〜ています・〜てください・〜てくれませんか）',
           'bunpo-13-2', 'Izin & Larangan（〜てもいい・〜てはいけません）'),
      (14, 'bunpo-14-1', 'Bentuk Plain Lengkap（辞書形・ない・た・なかった）',
           'bunpo-14-2', 'Kewajiban & Larangan（〜なければ・〜なくてもいい・〜ないで）'),
      (15, 'bunpo-15-1', 'Frasa Pelayanan Sopan（お願いします・いかがですか・お〜ください）',
           'bunpo-15-2', 'Memutuskan & Menjadi（〜にします・〜になります・〜くなります）'),
      (16, 'bunpo-16-1', 'Tanggal & Hari（〜月〜日・何曜日・いつ）',
           'bunpo-16-2', 'Partikel Waktu & Rutinitas（〜に・毎週・毎月）'),
      (17, 'bunpo-17-1', 'Suka & Jenis Kesukaan（〜が好き／嫌い・どんな）',
           'bunpo-17-2', 'Kemampuan & Kemahiran（〜が上手／下手・〜ができる）'),
      (18, 'bunpo-18-1', 'Membandingkan Dua Hal（AはBより・AよりBのほうが）',
           'bunpo-18-2', 'Mana yang Lebih & Paling（どちらが・一番）'),
      (19, 'bunpo-19-1', 'Keinginan（〜たい・〜たくない・〜が欲しい）',
           'bunpo-19-2', 'Rencana & Ajakan（〜つもり・〜予定・〜ましょう）'),
      (20, 'bunpo-20-1', 'Pengalaman（〜たことがある／ない）',
           'bunpo-20-2', 'Penghubung Kalimat（〜から・〜が・そして・それから・でも）')
    ) AS t(bab, s1, t1, s2, t2)
  LOOP
    -- Cari Bab lewat lesson Assignment-nya. Regex pakai batas (\D|$) biar
    -- "BAB 1" nggak ke-match "BAB 10".
    SELECT module_id, sort_order INTO v_mod, v_order
      FROM lessons
     WHERE title ~* ('^assignment bab ' || r.bab || '(\D|$)')
     ORDER BY sort_order
     LIMIT 1;

    IF v_mod IS NULL THEN
      RAISE NOTICE 'BAB %: anchor "Assignment BAB %" tidak ketemu -> skip', r.bab, r.bab;
      CONTINUE;
    END IF;

    -- Anti-duplikat: kalau sudah ada >= 2 video (Introduction + bunpo), lewati.
    SELECT count(*) INTO v_vid FROM lessons WHERE module_id = v_mod AND type = 'video';
    IF v_vid >= 2 THEN
      RAISE NOTICE 'BAB %: sudah ada % lesson video -> skip (bunpo kemungkinan sudah ada)', r.bab, v_vid;
      CONTINUE;
    END IF;

    -- Geser Assignment (dan apa pun setelahnya) supaya ada ruang buat 2 bunpo.
    UPDATE lessons SET sort_order = sort_order + 2
     WHERE module_id = v_mod AND sort_order >= v_order;

    INSERT INTO lessons (module_id, slug, title, type, sort_order) VALUES
      (v_mod, r.s1, r.t1, 'video', v_order),
      (v_mod, r.s2, r.t2, 'video', v_order + 1);

    RAISE NOTICE 'BAB %: + 2 bunpo lessons (sebelum Assignment)', r.bab;
  END LOOP;
END $$;

-- Cek hasil (opsional):
-- SELECT m.sort_order AS bab, l.sort_order, l.type, l.title
-- FROM courses c JOIN modules m ON m.course_id=c.id JOIN lessons l ON l.module_id=m.id
-- WHERE c.slug='n5' ORDER BY m.sort_order, l.sort_order;
