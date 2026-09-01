-- 129_grammar_examples_bab3_4_variety.sql — Diversifikasi contoh Bab 3 & 4:
-- dua contoh per pola dibuat BEDA topik/subjek/predikat, bukan cuma tukar
-- nama di kerangka kalimat yang sama.
--
-- User: "dalam satu pembahasan pola, kamu membuat yang 1 dan kedua dengan
-- kalimat yg sama, harusnya jangan sama". Root cause: migration 126/127/128
-- menulis 4 pola Bab 3 (〜は〜です／〜は〜じゃありません／〜は〜ですか／〜も)
-- dengan kerangka PERSIS SAMA -- [orang]は/も [negara]の [profesi]です --
-- cuma nama orang & negara & profesi yang ditukar. Dua pola Bab 4
-- (この／その／あの／どの + 名詞, だれの〜ですか) juga menukar demonstratif +
-- kata benda di kerangka yang identik. Kalimatnya secara TEKS tidak sama
-- persis (jadi tidak ketahuan di pengecekan duplikat literal), tapi
-- strukturnya berulang -- siswa cuma berlatih SATU bentuk kalimat berkali-
-- kali dengan kata diganti, bukan variasi pemakaian pola yang sesungguhnya.
--
-- PERBAIKAN Bab 3 (4 pola): satu contoh KELUARGA (pendek, 2 bunsetsu,
-- ditaruh pertama -- lebih ringkas untuk materi Step 1) + satu contoh
-- たなかさん dengan negara/institusi (>=3 bunsetsu, dipakai Step 2 susun-
-- kalimat). Profesi & anggota keluarga TIDAK diulang antar pola (dokter/
-- ayah, perawat/ibu, karyawan/kakak laki-laki, guru/kakak perempuan) --
-- kosakatanya ikut variatif, bukan cuma strukturnya. Semua masih dalam
-- cakupan vocab Bab 3 (pronomina, sufiks nama, negara, profesi, keluarga,
-- per header migration 041).
--
-- PERBAIKAN Bab 4 (2 pola): contoh kedua diganti STRUKTUR kalimatnya, bukan
-- cuma kata bendanya -- この／その／あの／どの + 名詞 sekarang punya satu
-- contoh predikat KEPEMILIKAN (わたしのです) dan satu predikat IDENTITAS
-- (たなかさんです); だれの〜ですか punya satu bentuk "Xは だれのNですか" dan
-- satu bentuk "Xは だれのですか" (N-nya di subjek, bukan di frasa tanya).
--
-- DIVALIDASI OFFLINE: cakupan arrange TIDAK berubah (34/44, karena cuma
-- struktur yang diganti, jumlah bunsetsu tetap dijaga >=3 untuk salah satu
-- contoh tiap pola) -- 0 opsi timpang/kembar/bawa-tanda-baca, 0 highlight
-- yang bukan substring kalimatnya, 0 kalimat dipakai dua kali (exact-text).
--
-- Pola migrasi sama dengan 127/128 (DELETE+INSERT replay), dipersempit ke
-- Bab 3 dan 4 saja -- bab lain kontennya tidak berubah di migrasi ini.

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
    RAISE NOTICE '129: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '129: modul Bab 3 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は〜です",
    "examples": [
      {
        "jp": "ちちは いしゃです。",
        "hl": "です",
        "id": "Ayah saya dokter."
      },
      {
        "jp": "たなかさんは だいがくの せんせいです。",
        "hl": "です",
        "id": "Tanaka-san dosen universitas."
      }
    ]
  },
  {
    "pattern": "〜は〜じゃありません",
    "examples": [
      {
        "jp": "ははは かんごしじゃありません。",
        "hl": "じゃありません",
        "id": "Ibu saya bukan perawat."
      },
      {
        "jp": "たなかさんは かんこくの がくせいじゃありません。",
        "hl": "じゃありません",
        "id": "Tanaka-san bukan siswa Korea."
      }
    ]
  },
  {
    "pattern": "〜は〜ですか",
    "examples": [
      {
        "jp": "あには かいしゃいんですか。",
        "hl": "ですか",
        "id": "Apakah kakak laki-lakimu karyawan?"
      },
      {
        "jp": "たなかさんは アメリカの せんせいですか。",
        "hl": "ですか",
        "id": "Apakah Tanaka-san guru Amerika?"
      }
    ]
  },
  {
    "pattern": "〜も",
    "examples": [
      {
        "jp": "あねも せんせいです。",
        "hl": "も",
        "id": "Kakak perempuan saya juga guru."
      },
      {
        "jp": "たなかさんも にほんの がくせいです。",
        "hl": "も",
        "id": "Tanaka-san juga siswa Jepang."
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
      RAISE NOTICE '129: Bab 3 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
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

  RAISE NOTICE '129: Bab 3 "%" — % pola ditimpa, % pattern tidak ketemu.',
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
    RAISE NOTICE '129: modul Bab 4 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(benda|sekitar)' THEN
    RAISE NOTICE '129: modul Bab 4 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
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
        "jp": "あの ひとは たなかさんです。",
        "hl": "あの",
        "id": "Orang itu Tanaka-san."
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
        "jp": "あの かばんは だれのですか。",
        "hl": "だれのですか",
        "id": "Tas itu punya siapa?"
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
      RAISE NOTICE '129: Bab 4 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
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

  RAISE NOTICE '129: Bab 4 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
END $$;

