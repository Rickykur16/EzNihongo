-- 084_bunpou_bab15.sql — Dua pelajaran Tata Bahasa (bunpou) Bab 15:
-- "Tata Bahasa Bab 15: Bahasa Pelayanan" (urutan 4) dan
-- "Tata Bahasa Bab 15: Memutuskan & Perubahan" (urutan 6).
--
-- Bagian dari seri 081-089 yang mengisi materi Tata Bahasa Bab 12-20 — lihat
-- 081_bunpou_bab12.sql untuk penjelasan lengkap: struktur target tiap bab,
-- alasan isi ajar ditaruh di module_grammar (bukan lessons.content), bentuk
-- data + loop yang dipakai, dan semantik penomoran ulang.
--
-- Daftar pola diambil dari dokumen kurikulum "EzNihongo — Daftar Grammar 文法
-- (JLPT N5 + N4)" bagian N5-B15 (6 pola), dibagi 4 pola di pelajaran
-- pertama dan 2 pola di pelajaran kedua.
--
-- POSISI: pelajaran ini menempati urutan 4 dan 6; slot 5 dan 7 disediakan
-- untuk dua Tugas Bunpou Bab 15 yang belum dibuat, jadi untuk sementara
-- sort_order 5 dan 7 memang kosong (gap tidak masalah — rendering pakai
-- ORDER BY, bukan nomor slot).
--
-- KANJI: contoh kalimat cuma boleh memakai kanji yang sudah diajarkan
-- (ditegakkan lewat assertion di akhir file) —
-- 62 kanji Bab 3-11 (dari 061) + 食飲 (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社
-- (Bab 15).
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring pola di-reset
-- lalu di-set ulang, grammar_examples dihapus per pola lalu di-insert ulang,
-- penomoran deterministik; no-op aman kalau kursus/modul target belum ada.

DO $mig$
DECLARE
  v_course_slug TEXT := 'n5';
  v_bab_no      INT  := 15;
  v_title_re    TEXT := '(pelayanan|komunikasi|service)';
  v_slug1       TEXT := 'tata-bahasa-bab-15-bahasa-pelayanan';
  v_slug2       TEXT := 'tata-bahasa-bab-15-memutuskan-perubahan';
  v_title1      TEXT := 'Tata Bahasa Bab 15: Bahasa Pelayanan';
  v_title2      TEXT := 'Tata Bahasa Bab 15: Memutuskan & Perubahan';
  v_body1       TEXT := 'Bab 15 mengajarkan bahasa yang kamu dengar di toko, restoran, dan hotel Jepang. Empat pola di pelajaran ini adalah "suara petugas dan tamu": cara memesan, cara menawarkan, cara menyebut total harga, dan cara mempersilakan dengan hormat.';
  v_body2       TEXT := 'Dua pola penutup Bab 15 mengurus keputusan dan perubahan: 〜にします untuk menyatakan pilihan yang kamu ambil, dan 〜くなります／〜になります untuk menyatakan sesuatu berubah menjadi lain. Perhatikan bedanya — yang satu keputusan, yang satu perubahan yang terjadi.';
  -- 62 kanji Bab 3-11 (dari 061) + 食飲 (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社
  -- (Bab 15).
  v_kanji_ok    TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社';
  v_n_l1        INT  := 4;   -- jumlah pola yang diharapkan di pelajaran 1
  v_n_l2        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 2

  v_pola JSONB := $json$[
  {
    "lesson": 1,
    "pattern": "〜を[counter]お願いします",
    "meaning": "memesan / meminta sesuatu dengan sopan",
    "example": "コーヒーを 二つ おねがいします。",
    "notes": "Pola standar saat memesan di restoran, toko, atau meminta layanan. Urutan: [benda]を [jumlah + kata bantu bilangan] おねがいします. Boleh juga tanpa jumlah: [benda]を おねがいします.",
    "examples": [
      {
        "jp": "コーヒーを 二つ おねがいします。",
        "hl": "おねがいします",
        "id": "Tolong kopinya dua."
      },
      {
        "jp": "この 本を 三さつ おねがいします。",
        "hl": "おねがいします",
        "id": "Tolong buku ini tiga buah."
      },
      {
        "jp": "すみません、みずを 一つ おねがいします。",
        "hl": "おねがいします",
        "id": "Permisi, tolong airnya satu."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "〜はいかがですか",
    "meaning": "bagaimana dengan ~ (menawarkan dengan sopan)",
    "example": "コーヒーは いかがですか。",
    "notes": "Versi sopan dari 〜はどうですか, dipakai pelayan atau tuan rumah untuk MENAWARKAN. Menerima tawaran: はい、おねがいします. Menolak dengan sopan: いいえ、けっこうです.",
    "examples": [
      {
        "jp": "おちゃは いかがですか。",
        "hl": "いかがですか",
        "id": "Bagaimana kalau teh?"
      },
      {
        "jp": "この 白い シャツは いかがですか。",
        "hl": "いかがですか",
        "id": "Bagaimana dengan kemeja putih ini?"
      },
      {
        "jp": "もう 一ぱい いかがですか。",
        "hl": "いかがですか",
        "id": "Bagaimana kalau satu gelas lagi?"
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "〜になります (keigo)",
    "meaning": "jadinya ~ / totalnya ~ (bahasa pelayanan)",
    "example": "千円に なります。",
    "notes": "Dipakai petugas toko atau restoran untuk menyebut total harga dan hasil. Secara harfiah berarti \"menjadi\", tapi fungsinya menghaluskan pernyataan です. Jangan dipakai saat kamu berada di posisi pelanggan.",
    "examples": [
      {
        "jp": "ぜんぶで 千円に なります。",
        "hl": "になります",
        "id": "Totalnya menjadi 1000 yen."
      },
      {
        "jp": "おかいけいは 二千五百円に なります。",
        "hl": "になります",
        "id": "Pembayarannya menjadi 2500 yen."
      },
      {
        "jp": "こちらが おつりに なります。",
        "hl": "になります",
        "id": "Ini kembaliannya."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "お〜ください",
    "meaning": "silakan ~ (bentuk hormat)",
    "example": "しょうしょう おまちください。",
    "notes": "Bentuk hormat: お + [batang kata kerja bentuk ます] + ください. Dipakai petugas kepada tamu. Untuk kata kerja する, polanya ご + [kata benda] + ください (ごりようください).",
    "examples": [
      {
        "jp": "こちらで しょうしょう おまちください。",
        "hl": "おまちください",
        "id": "Silakan tunggu sebentar di sini."
      },
      {
        "jp": "どうぞ おはいりください。",
        "hl": "おはいりください",
        "id": "Silakan masuk."
      },
      {
        "jp": "こちらの 店を ごりようください。",
        "hl": "ごりようください",
        "id": "Silakan gunakan toko kami."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜にします",
    "meaning": "memutuskan memilih ~",
    "example": "わたしは コーヒーに します。",
    "notes": "Menyatakan PILIHAN saat memesan atau memutuskan sesuatu. Beda dari 〜になります yang menyatakan perubahan yang terjadi dengan sendirinya — 〜にします adalah keputusan yang diambil orangnya.",
    "examples": [
      {
        "jp": "わたしは コーヒーに します。",
        "hl": "にします",
        "id": "Saya pilih kopi saja."
      },
      {
        "jp": "この 白い かばんに します。",
        "hl": "にします",
        "id": "Saya pilih tas putih ini."
      },
      {
        "jp": "りょこうは らいげつに します。",
        "hl": "にします",
        "id": "Perjalanannya saya putuskan bulan depan."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜くなります／〜になります",
    "meaning": "menjadi ~ (perubahan keadaan)",
    "example": "さむく なりました。",
    "notes": "Menyatakan PERUBAHAN. Kata sifat い: buang い ganti く + なります (たかい→たかくなります). Kata sifat な dan kata benda: + に + なります (しずかになります／学生になります). Bentuk lampau なりました berarti \"sudah menjadi\".",
    "examples": [
      {
        "jp": "さいきん さむく なりました。",
        "hl": "なりました",
        "id": "Akhir-akhir ini jadi dingin."
      },
      {
        "jp": "この 店は 新しく なりました。",
        "hl": "なりました",
        "id": "Toko ini jadi baru."
      },
      {
        "jp": "あには 先生に なりました。",
        "hl": "になりました",
        "id": "Kakak laki-laki saya menjadi guru."
      }
    ]
  }
]$json$::jsonb;

  v_module_id    UUID;
  v_module_title TEXT;
  v_l1           UUID;
  v_l2           UUID;
  v_lesson       UUID;
  v_gid          UUID;
  v_i            INT := 0;
  v_other        INT;
  v_pos1         INT;
  v_pos2         INT;
  r              JSONB;
BEGIN
  -- === 1. Resolve modul (ordinal, sama seperti 039-078) ===================
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '084: modul Bab % di kursus % tidak ditemukan — skip Tata Bahasa.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '084: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '084: seed 2 pelajaran Tata Bahasa Bab % ke modul "%".', v_bab_no, v_module_title;

  -- Jaring pengaman: kalau bab ini ternyata sudah punya materi Tata Bahasa
  -- lain (dibuat manual lewat admin dengan slug berbeda), migrasi tetap
  -- jalan tapi log deploy menyebut judulnya supaya duplikasi ketahuan.
  IF EXISTS (
    SELECT 1 FROM lessons
     WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2)
  ) THEN
    RAISE NOTICE '084: modul "%" sudah punya pelajaran bertipe text lain (%) — cek duplikasi materi Tata Bahasa lewat admin.',
      v_module_title,
      (SELECT string_agg(title, ', ') FROM lessons
        WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2));
  END IF;

  -- === 2. Dua lesson `text` (upsert; sort_order final diatur di langkah 4) =
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, v_slug1, v_title1, 'text', v_body1, 100, 20)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    updated_at = NOW()
  RETURNING id INTO v_l1;

  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, v_slug2, v_title2, 'text', v_body2, 101, 20)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    updated_at = NOW()
  RETURNING id INTO v_l2;

  -- === 3. Bank module_grammar + contoh kalimat ============================
  -- Lepas dulu pola yang sebelumnya nempel di dua pelajaran ini supaya
  -- re-run setelah daftar pola diedit tidak meninggalkan pola basi.
  UPDATE module_grammar SET lesson_id = NULL, updated_at = NOW()
   WHERE lesson_id IN (v_l1, v_l2);

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    v_i := v_i + 1;
    v_lesson := CASE WHEN (r->>'lesson')::INT = 1 THEN v_l1 ELSE v_l2 END;

    SELECT id INTO v_gid FROM module_grammar
     WHERE module_id = v_module_id AND pattern = r->>'pattern';

    IF v_gid IS NULL THEN
      INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
      VALUES (v_module_id, r->>'pattern', r->>'meaning', r->>'example', r->>'notes')
      RETURNING id INTO v_gid;
    END IF;

    UPDATE module_grammar
       SET lesson_id = v_lesson, sort_order = v_i, updated_at = NOW()
     WHERE id = v_gid;

    DELETE FROM grammar_examples WHERE grammar_id = v_gid;
    INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
    SELECT v_gid, e->>'jp', e->>'hl', e->>'id', ord::INT
      FROM jsonb_array_elements(r->'examples') WITH ORDINALITY AS t(e, ord);
  END LOOP;

  -- === 4. Penomoran ulang → Tata Bahasa #1 di urutan 4, #2 di urutan 6 ====
  -- Pola sisip-di-tengah yang sama dengan 058/062/065 (bukan renumber total,
  -- supaya pelajaran lain tidak ikut teracak):
  --     lesson lama ke-1..3 → 1..3      Tata Bahasa #1 → 4
  --     lesson lama ke-4    → 5         Tata Bahasa #2 → 6
  --     lesson lama ke-5..n → 7..n+2
  SELECT COUNT(*) INTO v_other
    FROM lessons WHERE module_id = v_module_id AND id <> v_l1 AND id <> v_l2;

  IF v_other < 3 THEN
    RAISE NOTICE '084: modul "%" cuma punya % lesson lain (< 3) — urutan 4 dan 6 tidak bisa dibentuk, kedua pelajaran ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
      v_module_title, v_other;
  ELSE
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons
       WHERE module_id = v_module_id AND id <> v_l1 AND id <> v_l2
    ), target AS (
      SELECT id,
             (CASE WHEN rn <= 3 THEN rn
                   WHEN rn = 4  THEN 5
                   ELSE rn + 2
              END)::INT AS new_sort
        FROM ordered
    )
    UPDATE lessons l
       SET sort_order = t.new_sort, updated_at = NOW()
      FROM target t
     WHERE l.id = t.id AND l.sort_order IS DISTINCT FROM t.new_sort;

    UPDATE lessons SET sort_order = 4, updated_at = NOW()
     WHERE id = v_l1 AND sort_order IS DISTINCT FROM 4;
    UPDATE lessons SET sort_order = 6, updated_at = NOW()
     WHERE id = v_l2 AND sort_order IS DISTINCT FROM 6;
  END IF;

  -- === 5. Assertion ======================================================
  IF (SELECT COUNT(*) FROM module_grammar WHERE lesson_id = v_l1) <> v_n_l1
     OR (SELECT COUNT(*) FROM module_grammar WHERE lesson_id = v_l2) <> v_n_l2 THEN
    RAISE EXCEPTION '084: jumlah pola harus % dan % (dapat % dan %)',
      v_n_l1, v_n_l2,
      (SELECT COUNT(*) FROM module_grammar WHERE lesson_id = v_l1),
      (SELECT COUNT(*) FROM module_grammar WHERE lesson_id = v_l2);
  END IF;

  IF EXISTS (
    SELECT 1 FROM module_grammar g
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND ((SELECT COUNT(*) FROM grammar_examples ge WHERE ge.grammar_id = g.id) < 2
            OR EXISTS (SELECT 1 FROM grammar_examples ge
                        WHERE ge.grammar_id = g.id
                          AND (ge.indonesian IS NULL OR ge.indonesian = '')))
  ) THEN
    RAISE EXCEPTION '084: ada pola dengan < 2 contoh kalimat atau contoh tanpa terjemahan';
  END IF;

  -- Pagar level: contoh kalimat hanya boleh memakai kanji yang sudah
  -- diajarkan sampai Bab 15 (lihat v_kanji_ok).
  IF EXISTS (
    SELECT 1 FROM grammar_examples ge
      JOIN module_grammar g ON g.id = ge.grammar_id
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND regexp_replace(ge.japanese, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '084: ada kanji di luar daftar taught (s/d Bab %) pada contoh kalimat', v_bab_no;
  END IF;

  IF v_other >= 3 THEN
    SELECT sort_order INTO v_pos1 FROM lessons WHERE id = v_l1;
    SELECT sort_order INTO v_pos2 FROM lessons WHERE id = v_l2;

    IF v_pos1 <> 4 OR v_pos2 <> 6 THEN
      RAISE EXCEPTION '084: sort_order final pelajaran bukan 4 dan 6 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '084: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '084: selesai — "%" di sort_order 4, "%" di sort_order 6, % pola / % contoh (slot 5 & 7 untuk Tugas Bunpou: % terisi).',
      v_title1, v_title2, v_n_l1 + v_n_l2,
      (SELECT COUNT(*) FROM grammar_examples ge JOIN module_grammar g ON g.id = ge.grammar_id
        WHERE g.lesson_id IN (v_l1, v_l2)),
      (SELECT COUNT(*) FROM lessons WHERE module_id = v_module_id AND sort_order IN (5, 7));
  ELSE
    RAISE NOTICE '084: selesai — % pola ter-wire, posisi menyusul diatur manual.', v_n_l1 + v_n_l2;
  END IF;
END $mig$;
