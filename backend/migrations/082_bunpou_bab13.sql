-- 082_bunpou_bab13.sql — Dua pelajaran Tata Bahasa (bunpou) Bab 13:
-- "Tata Bahasa Bab 13: Progresif & Permintaan (〜ています・〜てください・〜てくれませんか)" (urutan 4) dan
-- "Tata Bahasa Bab 13: Izin & Larangan (〜てもいいですか・〜てはいけません)" (urutan 6).
--
-- Bagian dari seri 081-089 yang mengisi materi Tata Bahasa Bab 12-20 — lihat
-- 081_bunpou_bab12.sql untuk penjelasan lengkap: struktur target tiap bab,
-- alasan isi ajar ditaruh di module_grammar (bukan lessons.content), bentuk
-- data + loop yang dipakai, dan semantik penomoran ulang.
--
-- Daftar pola diambil dari dokumen kurikulum "EzNihongo — Daftar Grammar 文法
-- (JLPT N5 + N4)" bagian N5-B13 (5 pola), dibagi 3 pola di pelajaran
-- pertama dan 2 pola di pelajaran kedua.
--
-- JUDUL memuat daftar pola di dalam kurung, dipisah ・ — mengikuti gaya
-- lesson buatan admin (mis. Bab 3 "Kalimat Identitas (です・じゃありません・
-- ですか)"). Pola yang bentuk aslinya bukan formula bersih (nama konjugasi
-- atau formula ber-placeholder) memakai label pendek lewat key `short` di
-- v_pola; key itu cuma dokumentasi asal-usul judul, tidak dibaca SQL.
--
-- POSISI: pelajaran ini menempati urutan 4 dan 6; slot 5 dan 7 disediakan
-- untuk dua Tugas Bunpou Bab 13 yang belum dibuat, jadi untuk sementara
-- sort_order 5 dan 7 memang kosong (gap tidak masalah — rendering pakai
-- ORDER BY, bukan nomor slot).
--
-- KANJI: contoh kalimat cuma boleh memakai kanji yang sudah diajarkan
-- (ditegakkan lewat assertion di akhir file) —
-- Bab 13 tidak memperkenalkan kanji baru, jadi daftarnya sama dengan Bab
-- 12: 62 kanji Bab 3-11 (dari 061) + 食・飲.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring pola di-reset
-- lalu di-set ulang, grammar_examples dihapus per pola lalu di-insert ulang,
-- penomoran deterministik; no-op aman kalau kursus/modul target belum ada.

DO $mig$
DECLARE
  v_course_slug TEXT := 'n5';
  v_bab_no      INT  := 13;
  v_title_re    TEXT := '(te.?form|progresif|aplikasi|ています)';
  v_slug1       TEXT := 'tata-bahasa-bab-13-progresif-permintaan';
  v_slug2       TEXT := 'tata-bahasa-bab-13-izin-larangan';
  v_title1      TEXT := 'Tata Bahasa Bab 13: Progresif & Permintaan (〜ています・〜てください・〜てくれませんか)';
  v_title2      TEXT := 'Tata Bahasa Bab 13: Izin & Larangan (〜てもいいですか・〜てはいけません)';
  v_body1       TEXT := 'Bentuk te bukan cuma penyambung kalimat. Digabung dengan います, kata kerja bentuk te menyatakan aksi yang sedang berlangsung, kondisi yang bertahan, kebiasaan, bahkan profesi. Di pelajaran ini kamu juga belajar dua cara meminta tolong: 〜てください yang tegas-sopan, dan 〜てくれませんか yang lebih halus.';
  v_body2       TEXT := 'Dua pola penutup Bab 13 mengurus izin dan larangan: 〜てもいいですか untuk meminta izin, dan 〜てはいけません untuk menyatakan sesuatu tidak boleh dilakukan. Keduanya sangat sering muncul di aturan tempat umum, sekolah, dan tempat kerja di Jepang.';
  -- Bab 13 tidak memperkenalkan kanji baru, jadi daftarnya sama dengan Bab
  -- 12: 62 kanji Bab 3-11 (dari 061) + 食・飲.
  v_kanji_ok    TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲';
  v_n_l1        INT  := 3;   -- jumlah pola yang diharapkan di pelajaran 1
  v_n_l2        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 2

  v_pola JSONB := $json$[
  {
    "lesson": 1,
    "pattern": "〜ています",
    "meaning": "sedang / kondisi / kebiasaan / profesi",
    "example": "いま ごはんを たべています。",
    "notes": "Bentuk te + います punya empat fungsi: (1) aksi yang SEDANG berlangsung (いま〜ています), (2) KONDISI hasil aksi yang masih bertahan (けっこんしています＝sudah menikah), (3) KEBIASAAN yang diulang (まいあさ〜ています), (4) PROFESI (ぎんこうで はたらいています). Konteks kalimat yang menentukan artinya.",
    "examples": [
      {
        "jp": "いま 本を 読んでいます。",
        "hl": "読んでいます",
        "id": "Sekarang saya sedang membaca buku."
      },
      {
        "jp": "あには とうきょうに すんでいます。",
        "hl": "すんでいます",
        "id": "Kakak laki-laki saya tinggal di Tokyo."
      },
      {
        "jp": "ちちは かいしゃで はたらいています。",
        "hl": "はたらいています",
        "id": "Ayah saya bekerja di perusahaan."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "〜てください",
    "meaning": "tolong lakukan ~ (permintaan sopan)",
    "example": "ここに 名前を かいてください。",
    "notes": "Bentuk te + ください = permintaan atau instruksi yang sopan. Dipakai guru ke murid, petugas ke tamu, atau saat menolong orang. Untuk permintaan yang lebih halus ke orang yang lebih tinggi, pakai 〜てくれませんか.",
    "examples": [
      {
        "jp": "ここに 名前を 書いてください。",
        "hl": "書いてください",
        "id": "Tolong tulis nama Anda di sini."
      },
      {
        "jp": "もう いちど ゆっくり はなしてください。",
        "hl": "はなしてください",
        "id": "Tolong bicara pelan-pelan sekali lagi."
      },
      {
        "jp": "この 本を 見てください。",
        "hl": "見てください",
        "id": "Tolong lihat buku ini."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "〜てくれませんか",
    "meaning": "bisa tolong ~? (permintaan halus)",
    "example": "ちょっと まってくれませんか。",
    "notes": "Lebih halus daripada 〜てください karena berbentuk pertanyaan negatif — penutur MENANYAKAN kesediaan lawan bicara, bukan menyuruh. Versi lebih sopan lagi: 〜てくださいませんか.",
    "examples": [
      {
        "jp": "すみません、ちょっと まってくれませんか。",
        "hl": "まってくれませんか",
        "id": "Maaf, bisa tolong tunggu sebentar?"
      },
      {
        "jp": "この かんじを 読んでくれませんか。",
        "hl": "読んでくれませんか",
        "id": "Bisa tolong bacakan kanji ini?"
      },
      {
        "jp": "しゃしんを とってくれませんか。",
        "hl": "とってくれませんか",
        "id": "Bisa tolong ambilkan foto?"
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜てもいいですか",
    "meaning": "boleh ~? (meminta izin)",
    "example": "ここで たべてもいいですか。",
    "notes": "Bentuk te + もいいですか untuk MEMINTA izin. Jawaban mengizinkan: はい、いいですよ／どうぞ. Jawaban menolak jarang langsung \"tidak boleh\", biasanya すみません、ちょっと…. Tanpa か (〜てもいいです) artinya MEMBERI izin.",
    "examples": [
      {
        "jp": "ここで しゃしんを とってもいいですか。",
        "hl": "とってもいいですか",
        "id": "Boleh saya memotret di sini?"
      },
      {
        "jp": "この 本を 読んでもいいですか。",
        "hl": "読んでもいいですか",
        "id": "Boleh saya membaca buku ini?"
      },
      {
        "jp": "すこし やすんでもいいですか。",
        "hl": "やすんでもいいですか",
        "id": "Boleh saya istirahat sebentar?"
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜てはいけません",
    "meaning": "tidak boleh ~ (larangan)",
    "example": "ここで たばこを すってはいけません。",
    "notes": "Larangan tegas — dipakai untuk aturan sekolah, rumah sakit, dan tempat umum. Kebalikan dari 〜てもいいです. Bentuk kasualnya 〜ちゃだめ. Untuk larangan yang lebih lembut, pakai 〜ないでください (Bab 14).",
    "examples": [
      {
        "jp": "ここで たばこを すってはいけません。",
        "hl": "すってはいけません",
        "id": "Di sini tidak boleh merokok."
      },
      {
        "jp": "この へやで あそんではいけません。",
        "hl": "あそんではいけません",
        "id": "Tidak boleh bermain di ruangan ini."
      },
      {
        "jp": "じゅぎょうちゅうに ものを 食べてはいけません。",
        "hl": "食べてはいけません",
        "id": "Tidak boleh makan saat pelajaran berlangsung."
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
    RAISE NOTICE '082: modul Bab % di kursus % tidak ditemukan — skip Tata Bahasa.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '082: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '082: seed 2 pelajaran Tata Bahasa Bab % ke modul "%".', v_bab_no, v_module_title;

  -- Jaring pengaman: kalau bab ini ternyata sudah punya materi Tata Bahasa
  -- lain (dibuat manual lewat admin dengan slug berbeda), migrasi tetap
  -- jalan tapi log deploy menyebut judulnya supaya duplikasi ketahuan.
  IF EXISTS (
    SELECT 1 FROM lessons
     WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2)
  ) THEN
    RAISE NOTICE '082: modul "%" sudah punya pelajaran bertipe text lain (%) — cek duplikasi materi Tata Bahasa lewat admin.',
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
    RAISE NOTICE '082: modul "%" cuma punya % lesson lain (< 3) — urutan 4 dan 6 tidak bisa dibentuk, kedua pelajaran ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '082: jumlah pola harus % dan % (dapat % dan %)',
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
    RAISE EXCEPTION '082: ada pola dengan < 2 contoh kalimat atau contoh tanpa terjemahan';
  END IF;

  -- Pagar level: contoh kalimat hanya boleh memakai kanji yang sudah
  -- diajarkan sampai Bab 13 (lihat v_kanji_ok).
  IF EXISTS (
    SELECT 1 FROM grammar_examples ge
      JOIN module_grammar g ON g.id = ge.grammar_id
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND regexp_replace(ge.japanese, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '082: ada kanji di luar daftar taught (s/d Bab %) pada contoh kalimat', v_bab_no;
  END IF;

  IF v_other >= 3 THEN
    SELECT sort_order INTO v_pos1 FROM lessons WHERE id = v_l1;
    SELECT sort_order INTO v_pos2 FROM lessons WHERE id = v_l2;

    IF v_pos1 <> 4 OR v_pos2 <> 6 THEN
      RAISE EXCEPTION '082: sort_order final pelajaran bukan 4 dan 6 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '082: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '082: selesai — "%" di sort_order 4, "%" di sort_order 6, % pola / % contoh (slot 5 & 7 untuk Tugas Bunpou: % terisi).',
      v_title1, v_title2, v_n_l1 + v_n_l2,
      (SELECT COUNT(*) FROM grammar_examples ge JOIN module_grammar g ON g.id = ge.grammar_id
        WHERE g.lesson_id IN (v_l1, v_l2)),
      (SELECT COUNT(*) FROM lessons WHERE module_id = v_module_id AND sort_order IN (5, 7));
  ELSE
    RAISE NOTICE '082: selesai — % pola ter-wire, posisi menyusul diatur manual.', v_n_l1 + v_n_l2;
  END IF;
END $mig$;
