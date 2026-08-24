-- 087_bunpou_bab18.sql — Dua pelajaran Tata Bahasa (bunpou) Bab 18:
-- "Tata Bahasa Bab 18: Membandingkan Dua Hal (AはBより〜です・AよりBのほうが〜)" (urutan 4) dan
-- "Tata Bahasa Bab 18: Bertanya Perbandingan & Superlatif (AとBとどちらが〜・〜の中で〜が一番〜)" (urutan 6).
--
-- Bagian dari seri 081-089 yang mengisi materi Tata Bahasa Bab 12-20 — lihat
-- 081_bunpou_bab12.sql untuk penjelasan lengkap: struktur target tiap bab,
-- alasan isi ajar ditaruh di module_grammar (bukan lessons.content), bentuk
-- data + loop yang dipakai, dan semantik penomoran ulang.
--
-- Daftar pola diambil dari dokumen kurikulum "EzNihongo — Daftar Grammar 文法
-- (JLPT N5 + N4)" bagian N5-B18 (4 pola), dibagi 2 pola di pelajaran
-- pertama dan 2 pola di pelajaran kedua.
--
-- JUDUL memuat daftar pola di dalam kurung, dipisah ・ — mengikuti gaya
-- lesson buatan admin (mis. Bab 3 "Kalimat Identitas (です・じゃありません・
-- ですか)"). Pola yang bentuk aslinya bukan formula bersih (nama konjugasi
-- atau formula ber-placeholder) memakai label pendek lewat key `short` di
-- v_pola; key itu cuma dokumentasi asal-usul judul, tidak dibaca SQL.
--
-- POSISI: pelajaran ini menempati urutan 4 dan 6; slot 5 dan 7 disediakan
-- untuk dua Tugas Bunpou Bab 18 yang belum dibuat, jadi untuk sementara
-- sort_order 5 dan 7 memang kosong (gap tidak masalah — rendering pakai
-- ORDER BY, bukan nomor slot).
--
-- KANJI: contoh kalimat cuma boleh memakai kanji yang sudah diajarkan
-- (ditegakkan lewat assertion di akhir file) —
-- Kumulatif s/d Bab 18 (BASE Bab 3-11 + 12/14/15/16/17) + 大小多少 (18). 番
-- belum diajarkan, jadi contoh menulis いちばん dengan kana.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring pola di-reset
-- lalu di-set ulang, grammar_examples dihapus per pola lalu di-insert ulang,
-- penomoran deterministik; no-op aman kalau kursus/modul target belum ada.

DO $mig$
DECLARE
  v_course_slug TEXT := 'n5';
  v_bab_no      INT  := 18;
  v_title_re    TEXT := '(perbandingan|banding)';
  v_slug1       TEXT := 'tata-bahasa-bab-18-membandingkan-dua-hal';
  v_slug2       TEXT := 'tata-bahasa-bab-18-superlatif';
  v_title1      TEXT := 'Tata Bahasa Bab 18: Membandingkan Dua Hal (AはBより〜です・AよりBのほうが〜)';
  v_title2      TEXT := 'Tata Bahasa Bab 18: Bertanya Perbandingan & Superlatif (AとBとどちらが〜・〜の中で〜が一番〜)';
  v_body1       TEXT := 'Bab 18 mengajarkan cara membandingkan dua hal. Dua pola di pelajaran ini isinya sama tapi sudut pandangnya kebalikan: AはBより menyorot A, sedangkan AよりBのほうが menyorot B. Pilih yang mana tergantung apa yang ingin kamu tonjolkan.';
  v_body2       TEXT := 'Setelah bisa membandingkan, sekarang bertanya dan menyimpulkan: どちらが untuk memilih di antara dua hal, dan 〜の中で〜が一番〜 untuk menyebut yang paling unggul di dalam satu kelompok.';
  -- Kumulatif s/d Bab 18 (BASE Bab 3-11 + 12/14/15/16/17) + 大小多少 (18). 番
  -- belum diajarkan, jadi contoh menulis いちばん dengan kana.
  v_kanji_ok    TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少';
  v_n_l1        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 1
  v_n_l2        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 2

  v_pola JSONB := $json$[
  {
    "lesson": 1,
    "pattern": "AはBより〜です",
    "meaning": "A lebih ~ daripada B",
    "example": "とうきょうは おおさかより 大きいです。",
    "notes": "より menempel di belakang pembanding (B). Urutannya: [A]は [B]より [sifat]です. Bagian [B]より boleh dipindah ke depan kalimat untuk penekanan, dan より sendiri tidak pernah diikuti です.",
    "examples": [
      {
        "jp": "とうきょうは おおさかより 大きいです。",
        "hl": "より",
        "id": "Tokyo lebih besar daripada Osaka."
      },
      {
        "jp": "この 本は あの 本より 高いです。",
        "hl": "より",
        "id": "Buku ini lebih mahal daripada buku itu."
      },
      {
        "jp": "父は 母より せが 高いです。",
        "hl": "より",
        "id": "Ayah saya lebih tinggi daripada ibu saya."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "AよりBのほうが〜",
    "meaning": "B lebih ~ daripada A",
    "example": "バスより 電車のほうが はやいです。",
    "notes": "Menyorot B sebagai yang unggul, jadi susunannya kebalikan dari pola sebelumnya: [A]より [B]のほうが [sifat]です. のほう secara harfiah berarti \"pihak/sisi\", jadi kalimatnya berbunyi \"pihak B yang lebih ~\".",
    "examples": [
      {
        "jp": "バスより 電車のほうが はやいです。",
        "hl": "のほうが",
        "id": "Kereta lebih cepat daripada bus."
      },
      {
        "jp": "にくより 魚のほうが すきです。",
        "hl": "のほうが",
        "id": "Saya lebih suka ikan daripada daging."
      },
      {
        "jp": "この 店より あの 店のほうが 安いです。",
        "hl": "のほうが",
        "id": "Toko itu lebih murah daripada toko ini."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "AとBとどちらが〜",
    "meaning": "mana yang lebih ~, A atau B?",
    "example": "コーヒーと おちゃと どちらが すきですか。",
    "notes": "Pertanyaan pilihan antara DUA hal; jawabannya memakai 〜のほうが〜です. Di percakapan santai どちら sering dipendekkan jadi どっち. Jangan pakai どれ — どれ untuk tiga pilihan atau lebih.",
    "examples": [
      {
        "jp": "コーヒーと おちゃと どちらが すきですか。",
        "hl": "どちらが",
        "id": "Mana yang lebih kamu suka, kopi atau teh?"
      },
      {
        "jp": "電車と バスと どちらが 安いですか。",
        "hl": "どちらが",
        "id": "Mana yang lebih murah, kereta atau bus?"
      },
      {
        "jp": "日本語と えいごと どちらが むずかしいですか。",
        "hl": "どちらが",
        "id": "Mana yang lebih sulit, bahasa Jepang atau bahasa Inggris?"
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜の中で〜が一番〜",
    "meaning": "paling ~ di antara ~",
    "example": "くだものの 中で りんごが いちばん すきです。",
    "notes": "Menyatakan yang PALING di dalam satu kelompok. Kalau kelompoknya berupa rentang waktu atau tempat, pakai 〜で saja tanpa 中 (一年で 八月が いちばん あついです). Kata tanya untuk kelompok: なにが／だれが／どこが いちばん〜.",
    "examples": [
      {
        "jp": "くだものの 中で りんごが いちばん すきです。",
        "hl": "いちばん",
        "id": "Di antara buah-buahan, saya paling suka apel."
      },
      {
        "jp": "この 中で どれが いちばん 安いですか。",
        "hl": "いちばん",
        "id": "Di antara ini, mana yang paling murah?"
      },
      {
        "jp": "かぞくの 中で 父が いちばん はやく おきます。",
        "hl": "いちばん",
        "id": "Di keluarga saya, ayah yang paling pagi bangun."
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
    RAISE NOTICE '087: modul Bab % di kursus % tidak ditemukan — skip Tata Bahasa.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '087: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '087: seed 2 pelajaran Tata Bahasa Bab % ke modul "%".', v_bab_no, v_module_title;

  -- Jaring pengaman: kalau bab ini ternyata sudah punya materi Tata Bahasa
  -- lain (dibuat manual lewat admin dengan slug berbeda), migrasi tetap
  -- jalan tapi log deploy menyebut judulnya supaya duplikasi ketahuan.
  IF EXISTS (
    SELECT 1 FROM lessons
     WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2)
  ) THEN
    RAISE NOTICE '087: modul "%" sudah punya pelajaran bertipe text lain (%) — cek duplikasi materi Tata Bahasa lewat admin.',
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
    RAISE NOTICE '087: modul "%" cuma punya % lesson lain (< 3) — urutan 4 dan 6 tidak bisa dibentuk, kedua pelajaran ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '087: jumlah pola harus % dan % (dapat % dan %)',
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
    RAISE EXCEPTION '087: ada pola dengan < 2 contoh kalimat atau contoh tanpa terjemahan';
  END IF;

  -- Pagar level: contoh kalimat hanya boleh memakai kanji yang sudah
  -- diajarkan sampai Bab 18 (lihat v_kanji_ok).
  IF EXISTS (
    SELECT 1 FROM grammar_examples ge
      JOIN module_grammar g ON g.id = ge.grammar_id
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND regexp_replace(ge.japanese, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '087: ada kanji di luar daftar taught (s/d Bab %) pada contoh kalimat', v_bab_no;
  END IF;

  IF v_other >= 3 THEN
    SELECT sort_order INTO v_pos1 FROM lessons WHERE id = v_l1;
    SELECT sort_order INTO v_pos2 FROM lessons WHERE id = v_l2;

    IF v_pos1 <> 4 OR v_pos2 <> 6 THEN
      RAISE EXCEPTION '087: sort_order final pelajaran bukan 4 dan 6 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '087: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '087: selesai — "%" di sort_order 4, "%" di sort_order 6, % pola / % contoh (slot 5 & 7 untuk Tugas Bunpou: % terisi).',
      v_title1, v_title2, v_n_l1 + v_n_l2,
      (SELECT COUNT(*) FROM grammar_examples ge JOIN module_grammar g ON g.id = ge.grammar_id
        WHERE g.lesson_id IN (v_l1, v_l2)),
      (SELECT COUNT(*) FROM lessons WHERE module_id = v_module_id AND sort_order IN (5, 7));
  ELSE
    RAISE NOTICE '087: selesai — % pola ter-wire, posisi menyusul diatur manual.', v_n_l1 + v_n_l2;
  END IF;
END $mig$;
