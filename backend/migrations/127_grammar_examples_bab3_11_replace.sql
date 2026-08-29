-- 127_grammar_examples_bab3_11_replace.sql — TIMPA contoh Bab 3-11 dengan
-- kalimat yang sama seperti migration 126, untuk SELURUH pola (bukan cuma
-- yang kosong).
--
-- KENAPA: 126 sengaja pakai NOT EXISTS supaya tidak menimpa kurasi admin
-- yang sudah ada — pagar yang wajar sebagai default. Hasilnya di produksi:
-- 34 dari 44 pola Bab 3-11 TERNYATA sudah punya baris grammar_examples
-- sebelum 126 jalan (migration 126 cuma sempat mengisi 9 yang kosong + 1
-- pattern Bab 3 tidak ketemu). Sumber 34 baris itu BUKAN dari tombol AI
-- yang sempat dibangun PR #225 — endpoint itu cuma bisa UPDATE baris yang
-- SUDAH ADA, tidak pernah INSERT baris baru, jadi tidak mungkin jadi
-- sumbernya untuk bab yang sebelumnya nol baris (established di 126: migrasi
-- 043-060 tidak pernah mengisi grammar_examples sama sekali). Sumber paling
-- masuk akal: tombol "📝 Contoh" admin (fitur manual lama, di luar migrasi
-- apa pun) — dan konten yang diketik lewat situ TIDAK memakai konvensi
-- spasi antar-bunsetsu yang baru mulai dipakai migration 081-089/126, jadi
-- `buildArrangeDrill` (butuh 3-8 token berspasi) gagal terpicu untuk
-- ke-34 pola itu dan otomatis jatuh ke pilihan ganda — user melaporkan ini
-- sebagai "Step 2 balik seperti semula, bukan susun kata yang diharapkan".
--
-- KEPUTUSAN: user mau SEMUA 44 pola Bab 3-11 pakai kalimat yang sudah
-- diaudit (30 di antaranya memang jadi susun-kata, 14 sisanya pilihan ganda
-- karena kalimatnya cuma 1-2 bunsetsu — itu batas alami, bukan kegagalan).
-- Daripada menambah pagar/heuristik baru untuk "mendeteksi & menspasi ulang"
-- kalimat admin yang sudah ada (mustahil dilakukan aman tanpa tahu isi
-- persisnya, dan berisiko mengarang ulang kalimat orang lain), migrasi ini
-- MENIMPA total: DELETE seluruh grammar_examples milik pola yang match,
-- lalu INSERT ulang 2 kalimat yang SAMA PERSIS dengan migration 126 (v_pola
-- byte-identik). Pola sama dengan replay DELETE+INSERT yang sudah dipakai
-- berulang di repo ini (065/098/101/104) untuk konten yang sudah live.
--
-- ISI KALIMATNYA SUDAH DIVALIDASI di migration 126 (offline + Postgres
-- sungguhan + end-to-end lewat endpoint asli) — migrasi ini TIDAK menulis
-- kalimat baru, cuma mengganti cara penerapannya dari "isi yang kosong"
-- jadi "timpa semua yang match".
--
-- Satu pattern Bab 3 (〜ね・〜よ) yang di 126 tidak ketemu di module_grammar
-- produksi TETAP tidak ketemu di sini (nama polanya di production berbeda
-- dari tebakan) — kalau mau pola itu ikut dapat susun-kata, cek nama
-- persisnya di admin lalu tambahkan manual lewat 📝 Contoh (spasi
-- antar-bunsetsu + terjemahan), atau kabari supaya ditambahkan ke migrasi
-- berikutnya dengan nama yang benar.
--
-- Idempotent: DELETE+INSERT tanpa syarat utk pola yang ketemu, jadi re-run
-- di environment yang sama cukup aman (hasilnya identik), tapi runner hanya
-- mengeksekusi file ini sekali per DB seperti migrasi lain.

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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '127: modul Bab 3 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 3 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 3 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 3 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 4 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(benda|sekitar)' THEN
    RAISE NOTICE '127: modul Bab 4 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 4 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 4 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 4 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 5 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(angka|waktu|uang)' THEN
    RAISE NOTICE '127: modul Bab 5 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 5 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 5 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 5 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 6 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '127: modul Bab 6 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 6 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 6 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 6 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 7 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '127: modul Bab 7 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 7 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 7 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 7 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 8 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(lokasi|tempat|posisi|location)' THEN
    RAISE NOTICE '127: modul Bab 8 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 8 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 8 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 8 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 9 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(bepergian|perjalanan|transport|travel)' THEN
    RAISE NOTICE '127: modul Bab 9 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 9 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 9 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 9 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 10 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(aktivitas|harian|daily|kegiatan)' THEN
    RAISE NOTICE '127: modul Bab 10 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 10 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 10 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
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
  v_replaced    INT := 0;
  v_skipped_pattern INT := 0;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 10 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '127: modul Bab 11 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(counter|penghitung|hitung)' THEN
    RAISE NOTICE '127: modul Bab 11 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
      RAISE NOTICE '127: Bab 11 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    DELETE FROM grammar_examples WHERE grammar_id = v_grammar_id;

    v_ord := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(r.value->'examples') LOOP
      INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
      VALUES (v_grammar_id, ex.value->>'jp', ex.value->>'hl', ex.value->>'id', v_ord);
      v_ord := v_ord + 1;
    END LOOP;
    v_replaced := v_replaced + 1;
  END LOOP;

  RAISE NOTICE '127: Bab 11 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
END $$;

