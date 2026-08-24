-- 086_bunpou_bab17.sql — Dua pelajaran Tata Bahasa (bunpou) Bab 17:
-- "Tata Bahasa Bab 17: Suka & Mahir" (urutan 4) dan
-- "Tata Bahasa Bab 17: Kemampuan & Bertanya Jenis" (urutan 6).
--
-- Bagian dari seri 081-089 yang mengisi materi Tata Bahasa Bab 12-20 — lihat
-- 081_bunpou_bab12.sql untuk penjelasan lengkap: struktur target tiap bab,
-- alasan isi ajar ditaruh di module_grammar (bukan lessons.content), bentuk
-- data + loop yang dipakai, dan semantik penomoran ulang.
--
-- Daftar pola diambil dari dokumen kurikulum "EzNihongo — Daftar Grammar 文法
-- (JLPT N5 + N4)" bagian N5-B17 (4 pola), dibagi 2 pola di pelajaran
-- pertama dan 2 pola di pelajaran kedua.
--
-- POSISI: pelajaran ini menempati urutan 4 dan 6; slot 5 dan 7 disediakan
-- untuk dua Tugas Bunpou Bab 17 yang belum dibuat, jadi untuk sementara
-- sort_order 5 dan 7 memang kosong (gap tidak masalah — rendering pakai
-- ORDER BY, bukan nomor slot).
--
-- KANJI: contoh kalimat cuma boleh memakai kanji yang sudah diajarkan
-- (ditegakkan lewat assertion di akhir file) —
-- Kumulatif s/d Bab 17 (BASE Bab 3-11 + 12/14/15/16) + 子父母友手足口目耳 (17). 好・嫌
-- belum diajarkan, jadi contoh menulis すき／きらい dengan kana.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring pola di-reset
-- lalu di-set ulang, grammar_examples dihapus per pola lalu di-insert ulang,
-- penomoran deterministik; no-op aman kalau kursus/modul target belum ada.

DO $mig$
DECLARE
  v_course_slug TEXT := 'n5';
  v_bab_no      INT  := 17;
  v_title_re    TEXT := '(suka|mahir|hobi)';
  v_slug1       TEXT := 'tata-bahasa-bab-17-suka-mahir';
  v_slug2       TEXT := 'tata-bahasa-bab-17-kemampuan-bertanya-jenis';
  v_title1      TEXT := 'Tata Bahasa Bab 17: Suka & Mahir';
  v_title2      TEXT := 'Tata Bahasa Bab 17: Kemampuan & Bertanya Jenis';
  v_body1       TEXT := 'Bab 17 memperkenalkan satu kebiasaan penting bahasa Jepang: hal yang disukai dan hal yang dikuasai ditandai partikel が, bukan を. Sebabnya すき、きらい、じょうず、へた semuanya kata SIFAT な, walaupun dalam bahasa Indonesia terdengar seperti kata kerja.';
  v_body2       TEXT := 'Melanjutkan pola が yang sama, 〜ができます menyatakan kemampuan. Ditutup dengan どんな — kata tanya yang selalu menempel pada kata benda dan sangat sering dipakai untuk menggali selera serta pendapat lawan bicara.';
  -- Kumulatif s/d Bab 17 (BASE Bab 3-11 + 12/14/15/16) + 子父母友手足口目耳 (17).
  -- 好・嫌 belum diajarkan, jadi contoh menulis すき／きらい dengan kana.
  v_kanji_ok    TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳';
  v_n_l1        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 1
  v_n_l2        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 2

  v_pola JSONB := $json$[
  {
    "lesson": 1,
    "pattern": "〜が好きです／嫌いです",
    "meaning": "suka / tidak suka",
    "example": "わたしは ねこが すきです。",
    "notes": "Objek yang disukai ditandai が, BUKAN を — karena すき dan きらい adalah kata sifat な, bukan kata kerja. Penguatnya だいすき (sangat suka) dan だいきらい (sangat benci). Bentuk negatifnya mengikuti kata sifat な: すきじゃありません.",
    "examples": [
      {
        "jp": "わたしは ねこが すきです。",
        "hl": "すきです",
        "id": "Saya suka kucing."
      },
      {
        "jp": "父は 魚が すきです。",
        "hl": "すきです",
        "id": "Ayah saya suka ikan."
      },
      {
        "jp": "おとうとは やさいが きらいです。",
        "hl": "きらいです",
        "id": "Adik laki-laki saya benci sayur."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "〜が上手です／下手です",
    "meaning": "mahir / tidak mahir",
    "example": "あねは りょうりが 上手です。",
    "notes": "Sama seperti すき, kemampuan ditandai が. じょうず dipakai untuk MEMUJI orang lain — memuji diri sendiri dengan じょうず terdengar sombong, untuk itu pakai とくいです. Lawannya へた (tidak mahir).",
    "examples": [
      {
        "jp": "母は りょうりが 上手です。",
        "hl": "上手です",
        "id": "Ibu saya pandai memasak."
      },
      {
        "jp": "あには 日本語が 上手です。",
        "hl": "上手です",
        "id": "Kakak laki-laki saya mahir berbahasa Jepang."
      },
      {
        "jp": "わたしは うたが 下手です。",
        "hl": "下手です",
        "id": "Saya tidak pandai menyanyi."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜ができます",
    "meaning": "bisa ~ (kemampuan)",
    "example": "わたしは 日本語が できます。",
    "notes": "できます menyatakan KEMAMPUAN atau kemungkinan, dan objeknya ditandai が. Dipakai untuk bahasa, keterampilan, dan olahraga (日本語が できます、うんてんが できます). Untuk kata kerja lain, N4 memakai pola 〜ことができる.",
    "examples": [
      {
        "jp": "あねは 日本語が できます。",
        "hl": "できます",
        "id": "Kakak perempuan saya bisa berbahasa Jepang."
      },
      {
        "jp": "父は うんてんが できます。",
        "hl": "できます",
        "id": "Ayah saya bisa menyetir."
      },
      {
        "jp": "わたしは ピアノが できません。",
        "hl": "できません",
        "id": "Saya tidak bisa main piano."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "どんな〜",
    "meaning": "~ yang seperti apa",
    "example": "どんな たべものが すきですか。",
    "notes": "どんな SELALU diikuti kata benda (どんな 人、どんな 本). Beda dari どう yang berdiri sendiri (どうですか＝bagaimana). Jawabannya berupa sifat atau jenis, bukan ya/tidak.",
    "examples": [
      {
        "jp": "どんな たべものが すきですか。",
        "hl": "どんな",
        "id": "Makanan seperti apa yang kamu suka?"
      },
      {
        "jp": "どんな 本を 読みますか。",
        "hl": "どんな",
        "id": "Buku seperti apa yang kamu baca?"
      },
      {
        "jp": "お父さんは どんな 人ですか。",
        "hl": "どんな",
        "id": "Ayahmu orang yang seperti apa?"
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
    RAISE NOTICE '086: modul Bab % di kursus % tidak ditemukan — skip Tata Bahasa.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '086: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '086: seed 2 pelajaran Tata Bahasa Bab % ke modul "%".', v_bab_no, v_module_title;

  -- Jaring pengaman: kalau bab ini ternyata sudah punya materi Tata Bahasa
  -- lain (dibuat manual lewat admin dengan slug berbeda), migrasi tetap
  -- jalan tapi log deploy menyebut judulnya supaya duplikasi ketahuan.
  IF EXISTS (
    SELECT 1 FROM lessons
     WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2)
  ) THEN
    RAISE NOTICE '086: modul "%" sudah punya pelajaran bertipe text lain (%) — cek duplikasi materi Tata Bahasa lewat admin.',
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
    RAISE NOTICE '086: modul "%" cuma punya % lesson lain (< 3) — urutan 4 dan 6 tidak bisa dibentuk, kedua pelajaran ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '086: jumlah pola harus % dan % (dapat % dan %)',
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
    RAISE EXCEPTION '086: ada pola dengan < 2 contoh kalimat atau contoh tanpa terjemahan';
  END IF;

  -- Pagar level: contoh kalimat hanya boleh memakai kanji yang sudah
  -- diajarkan sampai Bab 17 (lihat v_kanji_ok).
  IF EXISTS (
    SELECT 1 FROM grammar_examples ge
      JOIN module_grammar g ON g.id = ge.grammar_id
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND regexp_replace(ge.japanese, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '086: ada kanji di luar daftar taught (s/d Bab %) pada contoh kalimat', v_bab_no;
  END IF;

  IF v_other >= 3 THEN
    SELECT sort_order INTO v_pos1 FROM lessons WHERE id = v_l1;
    SELECT sort_order INTO v_pos2 FROM lessons WHERE id = v_l2;

    IF v_pos1 <> 4 OR v_pos2 <> 6 THEN
      RAISE EXCEPTION '086: sort_order final pelajaran bukan 4 dan 6 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '086: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '086: selesai — "%" di sort_order 4, "%" di sort_order 6, % pola / % contoh (slot 5 & 7 untuk Tugas Bunpou: % terisi).',
      v_title1, v_title2, v_n_l1 + v_n_l2,
      (SELECT COUNT(*) FROM grammar_examples ge JOIN module_grammar g ON g.id = ge.grammar_id
        WHERE g.lesson_id IN (v_l1, v_l2)),
      (SELECT COUNT(*) FROM lessons WHERE module_id = v_module_id AND sort_order IN (5, 7));
  ELSE
    RAISE NOTICE '086: selesai — % pola ter-wire, posisi menyusul diatur manual.', v_n_l1 + v_n_l2;
  END IF;
END $mig$;
