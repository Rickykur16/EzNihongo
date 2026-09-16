-- 145_grammar_dialog_bab3_semua_baris.sql — isi dialog contoh untuk SELURUH
-- baris pola Bab 3, bukan hanya yang namanya cocok dengan repo.
--
-- KENAPA: 143 mengisi lima baris lewat pencocokan teks persis dan 144 mengisi
-- baris ね／よ, tapi dialognya tidak muncul di pelajaran Bab 3. Sebabnya ada
-- pada temuan log deploy run #410: Bab 3 punya SEBELAS baris untuk enam
-- konsep — dua set penamaan yang berjalan berdampingan.
--
--   set A (cocok dengan repo, diisi 143): 〜は〜です / 〜は〜じゃありません /
--                                          〜は〜ですか / 〜も / 〜の
--   set B (penamaan admin, masih kosong): 〜は〜です (dobel) / 〜の〜 /
--                                          〜は〜じゃ／ではありません /
--                                          〜も〜です / 〜ですか
--
-- Kalau yang tertaut ke pelajaran adalah set B, siswa melihat baris yang
-- example_dialog-nya NULL — dan welcome.html memang tidak merender blok
-- "💬 Dialog contoh" sama sekali kalau dialognya kosong, jadi gejalanya
-- "dialog tidak muncul" meski datanya ada di baris lain.
--
-- Daripada menebak set mana yang dipakai, migrasi ini mengisi SEMUANYA.
-- Baris kembar jadi punya dialog yang sama untuk konsep yang sama — itu
-- konsisten, dan tidak memperburuk duplikasi yang memang sudah ada
-- (membereskan baris kembar adalah keputusan konten tersendiri).
--
-- KLASIFIKASI, BUKAN PENCOCOKAN NAMA: baris set B dibuat lewat admin, jadi
-- teks persisnya tidak bisa dipercaya (log deploy tidak membedakan 〜 U+301C
-- dari ～ U+FF5E, atau ／ dari /). Tiap baris dipetakan ke konsep lewat tanda
-- yang ada di dalam pattern-nya, dengan urutan pemeriksaan yang penting:
--
--   1. memuat ね DAN よ            → partikel akhir kalimat
--   2. memuat じゃ atau では        → bentuk negatif
--   3. memuat か                   → bentuk tanya
--   4. memuat も                   → "juga"
--   5. memuat の                   → kepemilikan / afiliasi
--   6. memuat です                 → kopula dasar
--
-- Urutannya menentukan: 〜は〜ですか memuat です DAN か, dan harus jatuh ke
-- bentuk tanya, bukan kopula dasar. Baris yang tidak memenuhi satu aturan pun
-- TIDAK ditebak — dilewati dengan NOTICE.
--
-- Migrasi ini juga mencetak keterkaitan tiap baris ke pelajaran (lesson_id),
-- karena kalau ternyata TIDAK ADA baris Bab 3 yang punya lesson_id, kartu
-- polanya tidak akan tampil di pelajaran mana pun berapa pun dialog yang
-- diisi (content.js:325 hanya menyertakan grammar lewat grammarByLesson).
-- Konvensi 135→136: satu deploy sekaligus memperbaiki dan melapor.
--
-- Idempotent: UPDATE tanpa syarat, re-run menulis nilai yang sama.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_dialog       JSONB;
  v_key          TEXT;
  v_filled       INT := 0;
  v_skipped      INT := 0;
  v_linked       INT := 0;
  v_bad          INT;
  v_written      UUID[] := ARRAY[]::UUID[];
  r              RECORD;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '145: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  v_dialog := $json${
  "kopula": {
    "jp": "N: アンナさんとハディさんがはじめてあいます。\nA: はじめまして。わたしはアンナです。\nB: はじめまして。ハディです。どうぞよろしくおねがいします。\nA: わたしはインドネシアじんです。がくせいです。\nB: わたしはエンジニアです。",
    "id": "N: Anna dan Hadi bertemu untuk pertama kali.\nA: Perkenalkan, saya Anna.\nB: Perkenalkan, saya Hadi. Senang berkenalan.\nA: Saya orang Indonesia. Saya seorang pelajar.\nB: Saya seorang insinyur."
  },
  "negatif": {
    "jp": "N: リナさんとケビンさんがはなしています。\nA: ケビンさんはアメリカじんですか。\nB: いいえ、アメリカじんじゃありません。オーストラリアじんです。\nA: せんせいですか。\nB: いいえ、せんせいじゃありません。わたしはがくせいです。",
    "id": "N: Rina dan Kevin sedang berbicara.\nA: Apakah Kevin orang Amerika?\nB: Bukan, saya bukan orang Amerika. Saya orang Australia.\nA: Apakah Anda seorang guru?\nB: Bukan, saya bukan guru. Saya seorang pelajar."
  },
  "tanya": {
    "jp": "N: マリアさんとリョウさんがはなしています。\nA: リョウさんはかいしゃいんですか。\nB: はい、かいしゃいんです。\nA: おしごとはなんですか。\nB: エンジニアです。マリアさんはがくせいですか。\nA: はい、がくせいです。",
    "id": "N: Maria dan Ryo sedang berbicara.\nA: Apakah Ryo seorang karyawan?\nB: Ya, saya karyawan.\nA: Pekerjaannya apa?\nB: Insinyur. Apakah Maria seorang pelajar?\nA: Ya, saya pelajar."
  },
  "juga": {
    "jp": "N: デウィさんとサリさんがはなしています。\nA: わたしはがくせいです。サリさんもがくせいですか。\nB: はい、わたしもがくせいです。\nA: たなかさんもがくせいですか。\nB: いいえ、たなかさんはせんせいです。",
    "id": "N: Dewi dan Sari sedang berbicara.\nA: Saya seorang pelajar. Apakah Sari juga pelajar?\nB: Ya, saya juga pelajar.\nA: Apakah Tanaka juga pelajar?\nB: Bukan, Tanaka itu guru."
  },
  "milik": {
    "jp": "N: アンナさんとミナさんがはなしています。\nA: ミナさんはがくせいですか。\nB: はい、さくらだいがくのがくせいです。\nA: わたしはにほんごがっこうのがくせいです。\nB: たなかせんせいはにほんごのせんせいです。",
    "id": "N: Anna dan Mina sedang berbicara.\nA: Apakah Mina seorang mahasiswa?\nB: Ya, saya mahasiswa Universitas Sakura.\nA: Saya pelajar di sekolah bahasa Jepang.\nB: Pak Tanaka adalah guru bahasa Jepang."
  },
  "partikel": {
    "jp": "N: ハディさんとユウトさんがはなしています。\nA: ユウトさんはにほんじんですね。\nB: はい、そうです。ハディさんもがくせいですね。\nA: いいえ、わたしはエンジニアですよ。\nB: そうですか。",
    "id": "N: Hadi dan Yuto sedang berbicara.\nA: Yuto orang Jepang, ya kan?\nB: Ya, benar. Hadi juga pelajar, kan?\nA: Bukan, saya ini insinyur, lho.\nB: Oh, begitu."
  }
}$json$;

  FOR r IN SELECT g.id, g.pattern, g.lesson_id, l.title AS lesson_title
             FROM module_grammar g
             LEFT JOIN lessons l ON l.id = g.lesson_id
            WHERE g.module_id = v_module_id
            ORDER BY g.sort_order ASC, g.created_at ASC LOOP

    IF r.lesson_id IS NOT NULL THEN
      v_linked := v_linked + 1;
    END IF;

    -- Urutan pemeriksaan menentukan: 〜は〜ですか memuat です DAN か, dan
    -- harus jatuh ke "tanya", bukan "kopula".
    v_key := CASE
      WHEN r.pattern LIKE '%ね%' AND r.pattern LIKE '%よ%' THEN 'partikel'
      WHEN r.pattern LIKE '%じゃ%' OR r.pattern LIKE '%では%'              THEN 'negatif'
      WHEN r.pattern LIKE '%か%'                                          THEN 'tanya'
      WHEN r.pattern LIKE '%も%'                                          THEN 'juga'
      WHEN r.pattern LIKE '%の%'                                          THEN 'milik'
      WHEN r.pattern LIKE '%です%'                                        THEN 'kopula'
      ELSE NULL
    END;

    IF v_key IS NULL THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE '145: pola "%" tidak dikenali — dilewati (lesson_id=%).', r.pattern, coalesce(r.lesson_title, '(tidak tertaut)');
      CONTINUE;
    END IF;

    UPDATE module_grammar
       SET example_dialog    = (v_dialog->v_key->>'jp'),
           example_dialog_id = (v_dialog->v_key->>'id'),
           updated_at        = NOW()
     WHERE id = r.id;

    v_written := array_append(v_written, r.id);
    v_filled := v_filled + 1;
    RAISE NOTICE '145: "%" → dialog "%" (pelajaran: %).',
      r.pattern, v_key, coalesce(r.lesson_title, 'TIDAK TERTAUT');
  END LOOP;

  -- Pagar sama dengan 143/144, hanya atas baris yang ditulis migrasi ini.
  SELECT count(*) INTO v_bad FROM module_grammar
   WHERE id = ANY (v_written)
     AND (array_length(string_to_array(example_dialog, E'\n'), 1)
          IS DISTINCT FROM array_length(string_to_array(example_dialog_id, E'\n'), 1)
          OR example_dialog ~ '[一-龥]');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '145: % dialog gagal pagar baris-sejajar/tanpa-kanji.', v_bad;
  END IF;

  IF v_linked = 0 THEN
    RAISE NOTICE '145: PERHATIAN — tidak ada baris grammar Bab 3 yang punya lesson_id. Kartu pola tidak akan tampil di pelajaran mana pun berapa pun dialog yang diisi (content.js hanya menyertakan grammar lewat grammarByLesson).';
  END IF;

  RAISE NOTICE '145: Bab 3 "%" — % baris diisi, % dilewati, % tertaut ke pelajaran.',
    v_module_title, v_filled, v_skipped, v_linked;
END $$;
