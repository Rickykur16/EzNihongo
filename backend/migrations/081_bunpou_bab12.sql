-- 081_bunpou_bab12.sql — Dua pelajaran Tata Bahasa (bunpou) Bab 12:
-- "Konjugasi Te-form" (urutan 4) dan "Menghubungkan Kalimat dengan Te-form"
-- (urutan 6).
--
-- Awal seri 081-089 yang mengisi materi Tata Bahasa Bab 12-20 — bagian yang
-- masih kosong setelah 070-078 membuat tiga pelajaran pertama tiap bab
-- (Pengantar / Kosakata 語彙 / Kanji 漢字). Daftar pola diambil dari dokumen
-- kurikulum "EzNihongo — Daftar Grammar 文法 (JLPT N5 + N4)" bagian N5-B12.
--
-- STRUKTUR TARGET tiap Bab 12-20 setelah seri ini:
--     1 Pengantar (video)   2 Kosakata 語彙 (deck)   3 Kanji 漢字 (kanji)
--     4 Tata Bahasa #1      5 Tugas Bunpou #1        6 Tata Bahasa #2
--     7 Tugas Bunpou #2     8 Assignment (quiz)
-- Slot 5 dan 7 disiapkan untuk Tugas Bunpou. Bab 12 sudah punya keduanya
-- (dibuat 062/065, sebelum migrasi ini ada di urutan 4 dan 5) — penomoran di
-- bawah mendorongnya ke 5 dan 7. Bab 13-20 belum punya, jadi di sana slot 5
-- dan 7 sengaja dibiarkan kosong (gap sort_order tidak masalah, rendering
-- pakai ORDER BY).
--
-- BENTUK PELAJARAN: lesson bertipe `text`. Isi ajarnya BUKAN di kolom
-- lessons.content (welcome.html membungkusnya dengan <p>…</p>, jadi content
-- ditulis sebagai satu paragraf teks polos tanpa tag blok) melainkan di
-- baris module_grammar yang lesson_id-nya menunjuk ke pelajaran ini —
-- content.js mengelompokkannya jadi lesson.grammar[] dan welcome.html
-- renderLessonGrammar() merendernya sebagai kartu pola (pattern / meaning /
-- blok "📝 Contoh" collapsible / notes). Tiap contoh kalimat = baris
-- grammar_examples (migration 031); kolomnya sudah di-whitelist di /api/tts,
-- jadi tombol 🔊 per contoh langsung jalan tanpa perubahan backend.
--
-- GAYA FILE: berbeda dari 043-065 yang menulis tiap pola sebagai blok SQL
-- terpisah, seri 081-089 menaruh seluruh konten di satu literal JSONB
-- (v_pola) lalu meng-upsert-nya dalam satu loop. 46 pola × 2-3 contoh di
-- sembilan bab terlalu banyak untuk ditulis manual per blok; bentuk data +
-- loop bikin isinya gampang di-review dan gampang ditambah.
--
-- PEMAKAIAN ULANG BANK: pola di-find-or-create by (module_id, pattern) —
-- lima pola Bab 12 SUDAH ada di bank karena dibuat migrasi 065 untuk Tugas
-- Bunpou, jadi `pattern` di bawah ditulis PERSIS sama dengan 065 supaya
-- baris yang sama dipakai ulang (bukan bikin duplikat). meaning/example/
-- notes baris lama TIDAK ditimpa; yang di-set cuma lesson_id + sort_order,
-- plus contoh kalimat di grammar_examples.
--
-- JUDUL memuat daftar pola di dalam kurung, dipisah ・ — mengikuti gaya
-- lesson buatan admin (mis. Bab 3 "Kalimat Identitas (です・じゃありません・
-- ですか)"). Pola yang bentuk aslinya bukan formula bersih (nama konjugasi
-- atau formula ber-placeholder) memakai label pendek lewat key `short` di
-- v_pola; key itu cuma dokumentasi asal-usul judul, tidak dibaca SQL.
--
-- KANJI: contoh kalimat memakai kanji yang sudah diajarkan sampai Bab 12
-- saja — 62 kanji Bab 3-11 (daftar persis dari 061) + 食・飲 dari Bab 12
-- (070). Ditegakkan lewat assertion di akhir file.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring pola di-reset
-- lalu di-set ulang, grammar_examples dihapus per pola lalu di-insert ulang,
-- penomoran deterministik; no-op aman kalau kursus/modul target belum ada.

DO $mig$
DECLARE
  v_course_slug TEXT := 'n5';
  v_bab_no      INT  := 12;
  v_title_re    TEXT := '(te.?form|konjugasi|penghubung|permintaan)';
  v_slug1       TEXT := 'tata-bahasa-bab-12-konjugasi-te-form';
  v_slug2       TEXT := 'tata-bahasa-bab-12-menghubungkan-kalimat-te-form';
  v_title1      TEXT := 'Tata Bahasa Bab 12: Konjugasi Te-form (Golongan 1・Golongan 2・する／くる)';
  v_title2      TEXT := 'Tata Bahasa Bab 12: Menghubungkan Kalimat dengan Te-form (〜て、〜・〜てから)';
  v_body1       TEXT := 'Bentuk te (て形) adalah pintu masuk ke sebagian besar tata bahasa Jepang setelah bentuk ます. Di pelajaran ini kamu belajar cara mengubah kata kerja golongan 1, golongan 2, dan dua kata kerja tidak beraturan (する・くる) ke bentuk te. Hafalkan polanya lewat kartu di bawah, lalu ucapkan tiap contoh kalimatnya.';
  v_body2       TEXT := 'Setelah bisa mengkonjugasi bentuk te, sekarang kita pakai untuk menyambung kalimat: 〜て、〜 untuk merangkai aksi berurutan, dan 〜てから untuk menegaskan bahwa aksi pertama harus selesai dulu. Perhatikan bahwa hanya kata kerja TERAKHIR yang menentukan bentuk sopan dan waktu kalimat.';
  -- 62 kanji Bab 3-11 (daftar persis dari 061) + 食・飲 dari Bab 12 (070).
  v_kanji_ok    TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲';
  v_n_l1        INT  := 3;   -- jumlah pola yang diharapkan di pelajaran 1
  v_n_l2        INT  := 2;   -- jumlah pola yang diharapkan di pelajaran 2

  v_pola JSONB := $json$[
  {
    "lesson": 1,
    "pattern": "Te-form Golongan 1 (u-verbs)",
    "short": "Golongan 1",
    "meaning": "konjugasi te-form kata kerja golongan 1",
    "example": "のむ→のんで、かく→かいて",
    "notes": "Akhiran kamus menentukan bentuk te: う・つ・る→って (かう→かって、まつ→まって、かえる→かえって); ぬ・ぶ・む→んで (しぬ→しんで、よぶ→よんで、のむ→のんで); く→いて (かく→かいて, KECUALI いく→いって); ぐ→いで (およぐ→およいで); す→して (はなす→はなして).",
    "examples": [
      {
        "jp": "本を 読んで、うちへ かえります。",
        "hl": "読んで",
        "id": "Membaca buku, lalu pulang ke rumah."
      },
      {
        "jp": "ジュースを 飲んで、学校へ 行きます。",
        "hl": "飲んで",
        "id": "Minum jus, lalu berangkat ke sekolah."
      },
      {
        "jp": "ともだちを まって、いっしょに 駅へ 行きます。",
        "hl": "まって",
        "id": "Menunggu teman, lalu pergi ke stasiun bersama."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "Te-form Golongan 2 (ru-verbs)",
    "short": "Golongan 2",
    "meaning": "konjugasi te-form kata kerja golongan 2",
    "example": "たべる→たべて、みる→みて",
    "notes": "Cukup buang る di akhir kata kamus, ganti dengan て. Berlaku untuk semua kata kerja golongan 2 (berakhiran いる／える yang bentuk kamusnya ichidan).",
    "examples": [
      {
        "jp": "ごはんを 食べて、コーヒーを 飲みます。",
        "hl": "食べて",
        "id": "Makan nasi, lalu minum kopi."
      },
      {
        "jp": "テレビを 見て、ねます。",
        "hl": "見て",
        "id": "Menonton TV, lalu tidur."
      },
      {
        "jp": "あさ 六時に おきて、シャワーを あびます。",
        "hl": "おきて",
        "id": "Bangun jam enam pagi, lalu mandi."
      }
    ]
  },
  {
    "lesson": 1,
    "pattern": "Te-form Tidak Beraturan",
    "short": "する／くる",
    "meaning": "konjugasi te-form 2 kata kerja tidak beraturan",
    "example": "する→して、くる→きて",
    "notes": "Hanya 2 kata kerja tidak beraturan di N5: する (melakukan) → して, くる (datang) → きて. Wajib dihafal, tidak mengikuti pola golongan 1 atau 2.",
    "examples": [
      {
        "jp": "べんきょうを して、ねます。",
        "hl": "して",
        "id": "Belajar, lalu tidur."
      },
      {
        "jp": "学校から かえって きて、ごはんを 食べます。",
        "hl": "きて",
        "id": "Pulang dari sekolah, lalu makan."
      },
      {
        "jp": "そうじを して、テレビを 見ます。",
        "hl": "して",
        "id": "Bersih-bersih, lalu menonton TV."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜て、〜",
    "meaning": "lalu／kemudian (penghubung aksi berurutan)",
    "example": "あさおきて、コーヒーをのみます。",
    "notes": "Menghubungkan 2 aksi atau lebih yang terjadi berurutan dalam satu kalimat. Semua kata kerja SEBELUM yang terakhir pakai bentuk te, hanya kata kerja TERAKHIR yang pakai bentuk ます／ました.",
    "examples": [
      {
        "jp": "あさ おきて、かおを あらって、ごはんを 食べます。",
        "hl": "おきて、",
        "id": "Pagi hari saya bangun, cuci muka, lalu makan."
      },
      {
        "jp": "電車に のって、駅で おります。",
        "hl": "のって、",
        "id": "Naik kereta, lalu turun di stasiun."
      },
      {
        "jp": "本やへ 行って、本を かいました。",
        "hl": "行って、",
        "id": "Saya pergi ke toko buku, lalu membeli buku."
      }
    ]
  },
  {
    "lesson": 2,
    "pattern": "〜てから",
    "meaning": "setelah ~ (urutan tegas: X selesai dulu baru Y)",
    "example": "ごはんをたべてから、でかけます。",
    "notes": "Mirip 〜て、〜 tapi menegaskan urutan waktu: aksi pertama HARUS selesai dulu sebelum aksi kedua terjadi. てから lebih tegas daripada 〜て、〜 yang netral soal urutan.",
    "examples": [
      {
        "jp": "ごはんを 食べてから、くすりを 飲みます。",
        "hl": "食べてから",
        "id": "Setelah selesai makan, saya minum obat."
      },
      {
        "jp": "しゅくだいを してから、あそびます。",
        "hl": "してから",
        "id": "Setelah selesai mengerjakan PR, saya main."
      },
      {
        "jp": "うちへ かえってから、テレビを 見ます。",
        "hl": "かえってから",
        "id": "Setelah sampai rumah, saya menonton TV."
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
    RAISE NOTICE '081: modul Bab % di kursus % tidak ditemukan — skip Tata Bahasa.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '081: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '081: seed 2 pelajaran Tata Bahasa Bab % ke modul "%".', v_bab_no, v_module_title;

  -- Jaring pengaman: kalau bab ini ternyata sudah punya materi Tata Bahasa
  -- lain (dibuat manual lewat admin dengan slug berbeda), migrasi tetap
  -- jalan tapi log deploy menyebut judulnya supaya duplikasi ketahuan.
  IF EXISTS (
    SELECT 1 FROM lessons
     WHERE module_id = v_module_id AND type = 'text' AND slug NOT IN (v_slug1, v_slug2)
  ) THEN
    RAISE NOTICE '081: modul "%" sudah punya pelajaran bertipe text lain (%) — cek duplikasi materi Tata Bahasa lewat admin.',
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
    RAISE NOTICE '081: modul "%" cuma punya % lesson lain (< 3) — urutan 4 dan 6 tidak bisa dibentuk, kedua pelajaran ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '081: jumlah pola harus % dan % (dapat % dan %)',
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
    RAISE EXCEPTION '081: ada pola dengan < 2 contoh kalimat atau contoh tanpa terjemahan';
  END IF;

  -- Pagar level: contoh kalimat hanya boleh memakai kanji yang sudah
  -- diajarkan sampai Bab 12 (lihat v_kanji_ok).
  IF EXISTS (
    SELECT 1 FROM grammar_examples ge
      JOIN module_grammar g ON g.id = ge.grammar_id
     WHERE g.lesson_id IN (v_l1, v_l2)
       AND regexp_replace(ge.japanese, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '081: ada kanji di luar daftar taught (s/d Bab %) pada contoh kalimat', v_bab_no;
  END IF;

  IF v_other >= 3 THEN
    SELECT sort_order INTO v_pos1 FROM lessons WHERE id = v_l1;
    SELECT sort_order INTO v_pos2 FROM lessons WHERE id = v_l2;

    IF v_pos1 <> 4 OR v_pos2 <> 6 THEN
      RAISE EXCEPTION '081: sort_order final pelajaran bukan 4 dan 6 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '081: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '081: selesai — "%" di sort_order 4, "%" di sort_order 6, % pola / % contoh (slot 5 & 7 untuk Tugas Bunpou: % terisi).',
      v_title1, v_title2, v_n_l1 + v_n_l2,
      (SELECT COUNT(*) FROM grammar_examples ge JOIN module_grammar g ON g.id = ge.grammar_id
        WHERE g.lesson_id IN (v_l1, v_l2)),
      (SELECT COUNT(*) FROM lessons WHERE module_id = v_module_id AND sort_order IN (5, 7));
  ELSE
    RAISE NOTICE '081: selesai — % pola ter-wire, posisi menyusul diatur manual.', v_n_l1 + v_n_l2;
  END IF;
END $mig$;
