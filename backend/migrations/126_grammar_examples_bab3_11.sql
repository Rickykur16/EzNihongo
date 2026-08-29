-- 126_grammar_examples_bab3_11.sql — Contoh kalimat Step 2 (susun kalimat)
-- untuk Bab 3-11.
--
-- LATAR BELAKANG: migrasi 043/046/048/052/054/056/058/060 (Tugas Bunpou
-- Bab 4-11) hanya mengisi `module_grammar.example` (kolom lama, satu
-- kalimat, TANPA spasi antar-bunsetsu dan TANPA terjemahan) — TIDAK PERNAH
-- mengisi `grammar_examples` (tabel multi-contoh, migration 031). Backfill
-- 031 sendiri sudah berjalan SEBELUM 043-060 (nomor migrasi lebih kecil),
-- jadi tidak pernah menjangkau baris yang baru dibuat 043-060. Akibatnya
-- Bab 4-11 punya NOL baris grammar_examples sama sekali: bukan cuma "belum
-- ada spasi", tapi Step 2 (baik pilihan ganda maupun susun-kalimat) benar-
-- benar tidak ada bahan untuk diturunkan (`controlledSlot` butuh
-- `item.examples`), persis gejala yang dilaporkan user (Step 1 → langsung
-- Step 3). Bab 3 malah tidak punya module_grammar SAMA SEKALI di repo (bank
-- pola Bab 3 diisi manual lewat admin UI di produksi, bukan migrasi) — pola
-- di bawah untuk Bab 3 memakai FIND (bukan CREATE): kalau teks pattern-nya
-- tidak cocok persis dengan yang tersimpan di produksi, baris itu di-skip
-- dengan NOTICE, TIDAK membuat duplikat.
--
-- KEPUTUSAN: tulis kalimat contoh secara MANUAL di migrasi ini (2 per pola,
-- gaya sama dengan 081-089: JSONB v_pola per bab + loop), BUKAN lewat
-- tombol AI runtime (yang sempat dibangun lalu dihapus lagi — user minta
-- konten sensitif seperti ini ditulis dan direview sebagai diff migrasi,
-- konsisten dengan cara SELURUH konten lain di repo ini dibuat, bukan
-- dieksekusi live tanpa pratinjau). Bab 4-11: kalimat PERTAMA tiap pola
-- byte-identik dengan `module_grammar.example` yang sudah ter-deploy di
-- produksi (disalin apa adanya dari migrasi 043-060, cuma ditambah spasi
-- antar-bunsetsu + terjemahan Indonesia); kalimat KEDUA baru, gaya & level
-- sama. Semua kana (gaya legacy Bab 4-11 asli, sama sekali tanpa kanji) —
-- aman tanpa perlu whitelist kanji per-bab seperti seri 100-119.
--
-- DIVALIDASI OFFLINE sebelum ditulis ke sini (tanpa DB — deriveDrills fungsi
-- murni): parse v_pola tiap bab lewat Node, jalankan deriveDrills dengan
-- pool = seluruh pola bab (persis loadModulePool produksi). Hasil: 44/44
-- pola dapat Step 1 DAN Step 2 (30 jadi susun-kalimat 3-4 kepingan, 14 jatuh
-- ke pilihan ganda karena kalimatnya cuma 1-2 bunsetsu — itu wajar, bukan
-- kegagalan), 0 opsi timpang/kembar/bawa-tanda-baca, 0 highlight yang tidak
-- match substring-nya sendiri, 0 kalimat terpakai dua kali.
--
-- DEDUP: tiap pola di-cek dulu `NOT EXISTS (SELECT 1 FROM grammar_examples
-- WHERE grammar_id = v_grammar_id)` sebelum insert — kalau admin sudah
-- menambah contoh manual utk pola itu (via UI, kapan pun), pola itu
-- DILEWATI, tidak ditambah maupun ditimpa. Idempotent: re-run migrasi yang
-- sama pasti no-op (baris pertama sudah membuat grammar_examples ada).
--
-- Satu DO $$ block per bab (9 total) — kalau modul Bab tertentu belum ada
-- di sebuah environment (mis. DB test kosong), bab lain tetap lanjut jalan.

-- ===== Bab 3 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '126: modul Bab 3 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は〜です",
    "examples": [
      {
        "jp": "わたしは がくせいです。",
        "hl": "です",
        "id": "Saya adalah siswa."
      },
      {
        "jp": "たなかさんは せんせいです。",
        "hl": "です",
        "id": "Tanaka-san adalah guru."
      }
    ]
  },
  {
    "pattern": "〜は〜じゃありません",
    "examples": [
      {
        "jp": "わたしは せんせいじゃありません。",
        "hl": "じゃありません",
        "id": "Saya bukan guru."
      },
      {
        "jp": "これは ほんじゃありません。",
        "hl": "じゃありません",
        "id": "Ini bukan buku."
      }
    ]
  },
  {
    "pattern": "〜は〜ですか",
    "examples": [
      {
        "jp": "あなたは がくせいですか。",
        "hl": "ですか",
        "id": "Apakah kamu siswa?"
      },
      {
        "jp": "たなかさんは せんせいですか。",
        "hl": "ですか",
        "id": "Apakah Tanaka-san guru?"
      }
    ]
  },
  {
    "pattern": "〜も",
    "examples": [
      {
        "jp": "わたしも がくせいです。",
        "hl": "も",
        "id": "Saya juga siswa."
      },
      {
        "jp": "たなかさんも にほんじんです。",
        "hl": "も",
        "id": "Tanaka-san juga orang Jepang."
      }
    ]
  },
  {
    "pattern": "〜の",
    "examples": [
      {
        "jp": "これは わたしの ほんです。",
        "hl": "の",
        "id": "Ini buku saya."
      },
      {
        "jp": "これは たなかさんの かばんです。",
        "hl": "の",
        "id": "Ini tas milik Tanaka-san."
      }
    ]
  },
  {
    "pattern": "〜ね・〜よ",
    "examples": [
      {
        "jp": "これは あなたの ほんですね。",
        "hl": "ですね",
        "id": "Ini bukumu, ya."
      },
      {
        "jp": "たなかさんは にほんごの せんせいですよ。",
        "hl": "ですよ",
        "id": "Tanaka-san itu guru bahasa Jepang, lho."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 3 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 3 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 4 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 3 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 4 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(benda|sekitar)' THEN
    RAISE NOTICE '126: modul Bab 4 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "これ／それ／あれは〜です",
    "examples": [
      {
        "jp": "これは ほんです。",
        "hl": "です",
        "id": "Ini buku."
      },
      {
        "jp": "それは かばんです。",
        "hl": "です",
        "id": "Itu tas."
      }
    ]
  },
  {
    "pattern": "〜の〜 (penjelas)",
    "examples": [
      {
        "jp": "にほんごの ほんです。",
        "hl": "の",
        "id": "Buku bahasa Jepang."
      },
      {
        "jp": "これは えいごの ほんです。",
        "hl": "の",
        "id": "Ini buku bahasa Inggris."
      }
    ]
  },
  {
    "pattern": "この／その／あの／どの + 名詞",
    "examples": [
      {
        "jp": "この ペンは わたしのです。",
        "hl": "この",
        "id": "Pena ini punya saya."
      },
      {
        "jp": "その かばんは たなかさんのです。",
        "hl": "その",
        "id": "Tas itu punya Tanaka-san."
      }
    ]
  },
  {
    "pattern": "だれの〜ですか",
    "examples": [
      {
        "jp": "これは だれの ほんですか。",
        "hl": "だれの",
        "id": "Ini buku siapa?"
      },
      {
        "jp": "それは だれの かばんですか。",
        "hl": "だれの",
        "id": "Itu tas siapa?"
      }
    ]
  },
  {
    "pattern": "そうです／そうじゃありません",
    "examples": [
      {
        "jp": "はい、そうです。",
        "hl": "そうです",
        "id": "Ya, betul."
      },
      {
        "jp": "いいえ、そうじゃありません。",
        "hl": "そうじゃありません",
        "id": "Tidak, bukan begitu."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 4 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 4 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 5 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 4 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 5 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(angka|waktu|uang)' THEN
    RAISE NOTICE '126: modul Bab 5 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "今〜時〜分です",
    "examples": [
      {
        "jp": "今 9時半です。",
        "hl": "9時半",
        "id": "Sekarang jam 9.30."
      },
      {
        "jp": "今 7時15分です。",
        "hl": "7時15分",
        "id": "Sekarang jam 7.15."
      }
    ]
  },
  {
    "pattern": "〜時から〜時まで",
    "examples": [
      {
        "jp": "9時から 5時までです。",
        "hl": "9時から 5時まで",
        "id": "Dari jam 9 sampai jam 5."
      },
      {
        "jp": "がっこうは 8時から 3時までです。",
        "hl": "8時から 3時まで",
        "id": "Sekolah dari jam 8 sampai jam 3."
      }
    ]
  },
  {
    "pattern": "これはいくらですか",
    "examples": [
      {
        "jp": "これは 300円です。",
        "hl": "300円",
        "id": "Ini 300 yen."
      },
      {
        "jp": "これは いくらですか。",
        "hl": "いくらですか",
        "id": "Ini berapa harganya?"
      }
    ]
  },
  {
    "pattern": "おいくつですか／何歳ですか",
    "examples": [
      {
        "jp": "23歳です。",
        "hl": "23歳",
        "id": "23 tahun."
      },
      {
        "jp": "たなかさんは 23歳です。",
        "hl": "23歳",
        "id": "Tanaka-san berusia 23 tahun."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 5 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 5 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 6 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 5 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 6 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '126: modul Bab 6 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は[い-adj]です",
    "examples": [
      {
        "jp": "この りょうりは おいしいです。",
        "hl": "おいしいです",
        "id": "Masakan ini enak."
      },
      {
        "jp": "にほんごは むずかしいです。",
        "hl": "むずかしいです",
        "id": "Bahasa Jepang itu sulit."
      }
    ]
  },
  {
    "pattern": "〜は[い-adj]くないです",
    "examples": [
      {
        "jp": "たかくないです。",
        "hl": "たかくないです",
        "id": "Tidak mahal."
      },
      {
        "jp": "この みせは たかくないです。",
        "hl": "たかくないです",
        "id": "Toko ini tidak mahal."
      }
    ]
  },
  {
    "pattern": "[い-adj]+ 名詞",
    "examples": [
      {
        "jp": "あたらしい みせ。",
        "hl": "あたらしい",
        "id": "Toko baru."
      },
      {
        "jp": "おいしい りょうりです。",
        "hl": "おいしい",
        "id": "Masakan yang enak."
      }
    ]
  },
  {
    "pattern": "とても／あまり",
    "examples": [
      {
        "jp": "とても おいしいです。",
        "hl": "とても",
        "id": "Sangat enak."
      },
      {
        "jp": "あまり たかくないです。",
        "hl": "あまり",
        "id": "Tidak terlalu mahal."
      }
    ]
  },
  {
    "pattern": "〜はどうですか",
    "examples": [
      {
        "jp": "にほんは どうですか。",
        "hl": "どうですか",
        "id": "Bagaimana Jepang?"
      },
      {
        "jp": "この りょうりは どうですか。",
        "hl": "どうですか",
        "id": "Bagaimana masakan ini?"
      }
    ]
  },
  {
    "pattern": "〜かったです／〜くなかったです",
    "examples": [
      {
        "jp": "りょこうは たのしかったです。",
        "hl": "たのしかったです",
        "id": "Perjalanannya menyenangkan."
      },
      {
        "jp": "きのうは あつかったです。",
        "hl": "あつかったです",
        "id": "Kemarin panas."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 6 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 6 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 7 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 6 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 7 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '126: modul Bab 7 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は[な-adj]です",
    "examples": [
      {
        "jp": "この へやは しずかです。",
        "hl": "しずかです",
        "id": "Kamar ini tenang."
      },
      {
        "jp": "たなかさんは しんせつです。",
        "hl": "しんせつです",
        "id": "Tanaka-san ramah."
      }
    ]
  },
  {
    "pattern": "[な-adj]じゃありません",
    "examples": [
      {
        "jp": "この みちは べんりじゃありません。",
        "hl": "べんりじゃありません",
        "id": "Jalan ini tidak praktis."
      },
      {
        "jp": "この まちは にぎやかじゃありません。",
        "hl": "にぎやかじゃありません",
        "id": "Kota ini tidak ramai."
      }
    ]
  },
  {
    "pattern": "[な-adj]+な+名詞",
    "examples": [
      {
        "jp": "しずかな へやです。",
        "hl": "しずかな",
        "id": "Kamar yang tenang."
      },
      {
        "jp": "べんりな みせです。",
        "hl": "べんりな",
        "id": "Toko yang praktis."
      }
    ]
  },
  {
    "pattern": "〜くて／〜で",
    "examples": [
      {
        "jp": "この へやは しずかで おおきいです。",
        "hl": "しずかで",
        "id": "Kamar ini tenang dan luas."
      },
      {
        "jp": "たなかさんは しんせつで げんきです。",
        "hl": "しんせつで",
        "id": "Tanaka-san ramah dan sehat."
      }
    ]
  },
  {
    "pattern": "〜でした／〜じゃありませんでした",
    "examples": [
      {
        "jp": "きょねんは げんきでした。",
        "hl": "げんきでした",
        "id": "Tahun lalu (saya) sehat."
      },
      {
        "jp": "テストは かんたんじゃありませんでした。",
        "hl": "かんたんじゃありませんでした",
        "id": "Ujiannya tidak mudah."
      }
    ]
  },
  {
    "pattern": "〜が好き／嫌い／上手／下手",
    "examples": [
      {
        "jp": "すしが すきです。",
        "hl": "すきです",
        "id": "Suka sushi."
      },
      {
        "jp": "たなかさんは うたが じょうずです。",
        "hl": "じょうずです",
        "id": "Tanaka-san mahir menyanyi."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 7 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 7 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 8 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 7 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 8 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(lokasi|tempat|posisi|location)' THEN
    RAISE NOTICE '126: modul Bab 8 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜に〜があります／います",
    "examples": [
      {
        "jp": "つくえの うえに ほんが あります。",
        "hl": "に",
        "id": "Ada buku di atas meja."
      },
      {
        "jp": "きょうしつに がくせいが います。",
        "hl": "に",
        "id": "Ada siswa di kelas."
      }
    ]
  },
  {
    "pattern": "どこに〜がありますか",
    "examples": [
      {
        "jp": "としょかんは どこに ありますか。",
        "hl": "どこに",
        "id": "Perpustakaan ada di mana?"
      },
      {
        "jp": "トイレは どこに ありますか。",
        "hl": "どこに",
        "id": "Toilet ada di mana?"
      }
    ]
  },
  {
    "pattern": "〜は〜にあります／います",
    "examples": [
      {
        "jp": "ほんは つくえの うえに あります。",
        "hl": "あります",
        "id": "Bukunya ada di atas meja."
      },
      {
        "jp": "せんせいは きょうしつに います。",
        "hl": "います",
        "id": "Gurunya ada di kelas."
      }
    ]
  },
  {
    "pattern": "[noun]の[position]",
    "examples": [
      {
        "jp": "ねこは つくえの したに います。",
        "hl": "の した",
        "id": "Kucingnya ada di bawah meja."
      },
      {
        "jp": "ほんは はこの なかに あります。",
        "hl": "の なか",
        "id": "Bukunya ada di dalam kotak."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 8 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 8 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 9 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 8 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 9 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(bepergian|perjalanan|transport|travel)' THEN
    RAISE NOTICE '126: modul Bab 9 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜へ行きます／来ます／帰ります",
    "examples": [
      {
        "jp": "がっこうへ いきます。",
        "hl": "いきます",
        "id": "Pergi ke sekolah."
      },
      {
        "jp": "らいしゅう くにへ かえります。",
        "hl": "かえります",
        "id": "Minggu depan pulang ke negara asal."
      }
    ]
  },
  {
    "pattern": "〜で行きます",
    "examples": [
      {
        "jp": "でんしゃで いきます。",
        "hl": "でんしゃで",
        "id": "Pergi naik kereta."
      },
      {
        "jp": "バスで がっこうへ いきます。",
        "hl": "バスで",
        "id": "Pergi ke sekolah naik bus."
      }
    ]
  },
  {
    "pattern": "〜から〜まで",
    "examples": [
      {
        "jp": "いえから えきまで あるきます。",
        "hl": "いえから えきまで",
        "id": "Jalan kaki dari rumah sampai stasiun."
      },
      {
        "jp": "とうきょうから おおさかまで いきます。",
        "hl": "とうきょうから おおさかまで",
        "id": "Pergi dari Tokyo sampai Osaka."
      }
    ]
  },
  {
    "pattern": "いつ／どこへ／だれと",
    "examples": [
      {
        "jp": "あした どこへ いきますか。",
        "hl": "どこへ",
        "id": "Besok mau pergi ke mana?"
      },
      {
        "jp": "だれと りょこうしますか。",
        "hl": "だれと",
        "id": "Mau bepergian dengan siapa?"
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 9 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 9 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 10 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 9 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 10 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(aktivitas|harian|daily|kegiatan)' THEN
    RAISE NOTICE '126: modul Bab 10 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜を[verb]ます",
    "examples": [
      {
        "jp": "ごはんを たべます。",
        "hl": "たべます",
        "id": "Makan nasi."
      },
      {
        "jp": "まいあさ しんぶんを よみます。",
        "hl": "よみます",
        "id": "Setiap pagi membaca koran."
      }
    ]
  },
  {
    "pattern": "[verb]ません",
    "examples": [
      {
        "jp": "きょう はたらきません。",
        "hl": "はたらきません",
        "id": "Hari ini tidak bekerja."
      },
      {
        "jp": "にちようびは がっこうへ いきません。",
        "hl": "いきません",
        "id": "Hari Minggu tidak pergi ke sekolah."
      }
    ]
  },
  {
    "pattern": "[verb]ました",
    "examples": [
      {
        "jp": "きのう べんきょうしました。",
        "hl": "べんきょうしました",
        "id": "Kemarin belajar."
      },
      {
        "jp": "けさ しんぶんを よみました。",
        "hl": "よみました",
        "id": "Tadi pagi membaca koran."
      }
    ]
  },
  {
    "pattern": "[verb]ませんでした",
    "examples": [
      {
        "jp": "きのう たべませんでした。",
        "hl": "たべませんでした",
        "id": "Kemarin tidak makan."
      },
      {
        "jp": "きのうの よる べんきょうしませんでした。",
        "hl": "べんきょうしませんでした",
        "id": "Tadi malam tidak belajar."
      }
    ]
  },
  {
    "pattern": "毎日／いつも／時々",
    "examples": [
      {
        "jp": "まいにち コーヒーを のみます。",
        "hl": "まいにち",
        "id": "Setiap hari minum kopi."
      },
      {
        "jp": "ときどき テレビを みます。",
        "hl": "ときどき",
        "id": "Kadang-kadang menonton TV."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 10 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 10 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

-- ===== Bab 11 =====
DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id   UUID;
  v_module_title TEXT;
  v_grammar_id  UUID;
  v_pola        JSONB;
  r             RECORD;
  ex            RECORD;
  v_ord         INT;
  v_added       INT := 0;
  v_skipped_pattern INT := 0;
  v_skipped_has_examples INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 10 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '126: modul Bab 11 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(counter|penghitung|hitung)' THEN
    RAISE NOTICE '126: modul Bab 11 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 043-060), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜を[counter]+[verb]",
    "examples": [
      {
        "jp": "ビールを にほん ください。",
        "hl": "にほん",
        "id": "Tolong berikan bir 2 botol."
      },
      {
        "jp": "きってを さんまい ください。",
        "hl": "さんまい",
        "id": "Tolong berikan perangko 3 lembar."
      }
    ]
  },
  {
    "pattern": "[counter]+ あります／います",
    "examples": [
      {
        "jp": "テーブルが みっつ あります。",
        "hl": "みっつ",
        "id": "Ada 3 meja."
      },
      {
        "jp": "こどもが ふたり います。",
        "hl": "ふたり",
        "id": "Ada 2 anak."
      }
    ]
  },
  {
    "pattern": "いくつ／何人／何枚",
    "examples": [
      {
        "jp": "なんにんですか。",
        "hl": "なんにんですか",
        "id": "Berapa orang?"
      },
      {
        "jp": "りんごは いくつ ありますか。",
        "hl": "いくつ",
        "id": "Ada berapa apel?"
      }
    ]
  },
  {
    "pattern": "Native counters",
    "examples": [
      {
        "jp": "りんごを みっつ ください。",
        "hl": "みっつ",
        "id": "Tolong berikan apel 3 buah."
      },
      {
        "jp": "みかんを ふたつ ください。",
        "hl": "ふたつ",
        "id": "Tolong berikan jeruk 2 buah."
      }
    ]
  }
]$json$;

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped_pattern := v_skipped_pattern + 1;
      RAISE NOTICE '126: Bab 11 pola "%" tidak ditemukan di module_grammar (mungkin di-rename admin) — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM grammar_examples WHERE grammar_id = v_grammar_id) THEN
      v_skipped_has_examples := v_skipped_has_examples + 1;
      CONTINUE;
    END IF;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_added := v_added + 1;
  END LOOP;

  RAISE NOTICE '126: Bab 11 "%" — % pola diisi, % pattern tidak ketemu, % sudah punya contoh (dilewati).',
    v_module_title, v_added, v_skipped_pattern, v_skipped_has_examples;
END $$;

