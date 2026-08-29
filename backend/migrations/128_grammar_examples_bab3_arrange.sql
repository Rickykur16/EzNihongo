-- 128_grammar_examples_bab3_arrange.sql — Perpanjang kalimat contoh Bab 3
-- supaya jadi susun-kalimat, bukan pilihan ganda.
--
-- User: "Kenapa bab 3 yang bagian tugas bunpou pertama masih pilihan ganda
-- sedangkan yg bagian kedua sudah susun kalimat". Root cause BUKAN bug
-- aturan: 4 dari 6 pola Bab 3 (〜は〜です／〜は〜じゃありません／〜は〜ですか／
-- 〜も, yang ditulis migration 126/127) semua kalimat contohnya cuma 2
-- bunsetsu (topik + predikat polos, mis. "わたしは がくせいです。") —
-- di bawah MIN_ARRANGE_TOKENS (3), jadi SELALU jatuh ke pilihan ganda.
-- Pola 〜の (dan 〜ね・〜よ, yang tidak ketemu di module_grammar produksi)
-- kebetulan 3 bunsetsu, jadi jadi susun-kalimat. Kalau ke-4 pola pendek itu
-- kebetulan ada di "Tugas Bunpou 1" dan 〜の di "Tugas Bunpou 2" (pembagian
-- 2 tugas per bab, konvensi yang sama dipakai semua Bab 3-11), user melihat
-- tugas pertama "semua pilihan ganda" dan tugas kedua "sudah susun kalimat"
-- — persis yang dilaporkan.
--
-- PERBAIKAN: kalimat ke-4 pola pendek itu DIPERPANJANG jadi 3 bunsetsu
-- dengan menambah modifier asal-negara (にほんの／アメリカの／かんこくの)
-- sebagai bunsetsu ke-2 — natural, tetap level N5, dan levelnya cocok
-- dengan tema Bab 3 (perkenalan diri: nama, kewarganegaraan, profesi).
-- Modifier ini menambah SATU の per kalimat, tidak digabung dengan の lain
-- (aman dari jebakan rantai-の yang jadi masalah di konteks LAIN — soal
-- isian mondai seri 100-119; di sini tidak relevan karena tidak ada
-- assertion rantai-の untuk grammar_examples/susun-kalimat).
--
-- DIVALIDASI OFFLINE sebelum ditulis (deriveDrills fungsi murni, pool =
-- seluruh 6 pola Bab 3): SEMUA 6 pola sekarang arrange (3 token), 0 opsi
-- timpang/kembar/bawa-tanda-baca, 0 highlight yang bukan substring
-- kalimatnya. Cakupan Bab 3-11 total naik dari 30 ke 34 dari 44 pola.
--
-- Pola migrasi SAMA PERSIS dengan 127 (DELETE+INSERT replace, v_pola JSON,
-- FIND bukan CREATE) — cuma Bab 3 yang datanya berubah, jadi migrasi ini
-- dipersempit ke satu bab saja (Bab 4-11 tidak perlu ditimpa ulang dengan
-- konten yang sama).
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
    RAISE NOTICE '128: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '128: modul Bab 3 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は〜です",
    "examples": [
      {
        "jp": "たなかさんは にほんの せんせいです。",
        "hl": "です",
        "id": "Tanaka-san adalah guru Jepang."
      },
      {
        "jp": "わたしは アメリカの がくせいです。",
        "hl": "です",
        "id": "Saya siswa Amerika."
      }
    ]
  },
  {
    "pattern": "〜は〜じゃありません",
    "examples": [
      {
        "jp": "わたしは にほんの せんせいじゃありません。",
        "hl": "じゃありません",
        "id": "Saya bukan guru Jepang."
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
        "jp": "あなたは にほんの がくせいですか。",
        "hl": "ですか",
        "id": "Apakah kamu siswa Jepang?"
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
        "jp": "わたしも にほんの がくせいです。",
        "hl": "も",
        "id": "Saya juga siswa Jepang."
      },
      {
        "jp": "たなかさんも アメリカの せんせいです。",
        "hl": "も",
        "id": "Tanaka-san juga guru Amerika."
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
      RAISE NOTICE '128: Bab 3 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
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

  RAISE NOTICE '128: Bab 3 "%" — % pola ditimpa, % pattern tidak ketemu.',
    v_module_title, v_replaced, v_skipped_pattern;
END $$;
