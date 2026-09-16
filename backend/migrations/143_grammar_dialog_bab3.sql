-- 143_grammar_dialog_bab3.sql — isi dialog contoh (example_dialog +
-- example_dialog_id) untuk 6 pola grammar Bab 3.
--
-- KENAPA: pola Bab 3 belum punya dialog contoh yang konsisten. User minta
-- semua polanya diisi dialog yang sesuai konteks pembelajaran Bab 3
-- (perkenalan: nama / kewarganegaraan / profesi), format narator + dua
-- pembicara, dan isian lama DITIMPA.
--
-- MIGRASI PERTAMA yang menulis kolom example_dialog/example_dialog_id.
-- Sebelum ini kedua kolom hanya pernah diisi lewat admin saat runtime
-- (tombol "✨ Dialog"/isian manual), jadi tidak ada gaya migrasi lama untuk
-- disalin — yang disalin adalah idiom resolusi modul + FIND-by-pattern +
-- guard NOTICE dari 126/127.
--
-- ATURAN FORMAT (diverifikasi ke parser/renderer-nya, bukan diasumsikan):
--   * Prefix hanya N:/A:/B: (A perempuan, B laki-laki), SATU giliran per
--     baris — parseLegacy (src/grammar-dialogue-core.js) menempelkan baris
--     tanpa prefix ke giliran sebelumnya.
--   * example_dialog_id WAJIB sejajar: jumlah baris sama + urutan prefix
--     sama. legacyDraft() membuang SELURUH terjemahan kalau tidak sejajar
--     (bukan cuma baris yang meleset) — dijaga assertion di bawah.
--   * TANPA spasi antar-bunsetsu. Konvensi spasi itu milik grammar_examples
--     (dipakai drill susun-kalimat). Di dialog, spasi jadi token mati di
--     bubble karaoke DAN karakter tambahan yang ikut terkirim ke TTS.
--   * Nama pembicara katakana. resolveSpeakerNames (welcome.html) memakai
--     kelas [kanji+katakana] yang SENGAJA mengecualikan hiragana, jadi nama
--     hiragana tidak akan terbaca sebagai label bubble. Baris N: menyebut
--     kedua nama berurutan (pertama = A), sesuai fallback narator-order.
--   * Semua kana, tanpa kanji: sesuai level Bab 3, sejalan dengan gaya
--     konten legacy Bab 4-11, dan membuat needsReading() selalu false →
--     editor "Bacaan & audio" tidak perlu diisi bacaan sama sekali sebelum
--     audio bisa digenerate. Dijaga assertion di bawah.
--
-- Situasi tiap pola sengaja dibuat berbeda — pelajaran dari migrasi 139,
-- yang harus memperbaiki contoh Bab 3 justru karena semua polanya memakai
-- kerangka kalimat identik dengan kata yang tinggal ditukar.
--
-- Idempotent: UPDATE tanpa syarat, re-run menulis nilai yang sama.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_grammar_id   UUID;
  v_pola         JSONB;
  r              RECORD;
  v_known        TEXT[];
  v_written      UUID[] := ARRAY[]::UUID[];
  v_rest_count   INT;
  v_rest_pattern TEXT;
  v_filled       INT := 0;
  v_skipped      INT := 0;
  v_bad          INT;
  v_dialog_ne_jp TEXT;
  v_dialog_ne_id TEXT;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '143: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '143: modul Bab 3 terbaca "%" — dilanjutkan tetap (ordinal dipercaya seperti 126/127), tapi cek manual kalau meleset.', v_module_title;
  END IF;

  v_pola := $json$[
  {
    "pattern": "〜は〜です",
    "jp": "N: アンナさんとハディさんがはじめてあいます。\nA: はじめまして。わたしはアンナです。\nB: はじめまして。ハディです。どうぞよろしくおねがいします。\nA: わたしはインドネシアじんです。がくせいです。\nB: わたしはエンジニアです。",
    "id": "N: Anna dan Hadi bertemu untuk pertama kali.\nA: Perkenalkan, saya Anna.\nB: Perkenalkan, saya Hadi. Senang berkenalan.\nA: Saya orang Indonesia. Saya seorang pelajar.\nB: Saya seorang insinyur."
  },
  {
    "pattern": "〜は〜じゃありません",
    "jp": "N: リナさんとケビンさんがはなしています。\nA: ケビンさんはアメリカじんですか。\nB: いいえ、アメリカじんじゃありません。オーストラリアじんです。\nA: せんせいですか。\nB: いいえ、せんせいじゃありません。わたしはがくせいです。",
    "id": "N: Rina dan Kevin sedang berbicara.\nA: Apakah Kevin orang Amerika?\nB: Bukan, saya bukan orang Amerika. Saya orang Australia.\nA: Apakah Anda seorang guru?\nB: Bukan, saya bukan guru. Saya seorang pelajar."
  },
  {
    "pattern": "〜は〜ですか",
    "jp": "N: マリアさんとリョウさんがはなしています。\nA: リョウさんはかいしゃいんですか。\nB: はい、かいしゃいんです。\nA: おしごとはなんですか。\nB: エンジニアです。マリアさんはがくせいですか。\nA: はい、がくせいです。",
    "id": "N: Maria dan Ryo sedang berbicara.\nA: Apakah Ryo seorang karyawan?\nB: Ya, saya karyawan.\nA: Pekerjaannya apa?\nB: Insinyur. Apakah Maria seorang pelajar?\nA: Ya, saya pelajar."
  },
  {
    "pattern": "〜も",
    "jp": "N: デウィさんとサリさんがはなしています。\nA: わたしはがくせいです。サリさんもがくせいですか。\nB: はい、わたしもがくせいです。\nA: たなかさんもがくせいですか。\nB: いいえ、たなかさんはせんせいです。",
    "id": "N: Dewi dan Sari sedang berbicara.\nA: Saya seorang pelajar. Apakah Sari juga pelajar?\nB: Ya, saya juga pelajar.\nA: Apakah Tanaka juga pelajar?\nB: Bukan, Tanaka itu guru."
  },
  {
    "pattern": "〜の",
    "jp": "N: アンナさんとミナさんがはなしています。\nA: ミナさんはがくせいですか。\nB: はい、さくらだいがくのがくせいです。\nA: わたしはにほんごがっこうのがくせいです。\nB: たなかせんせいはにほんごのせんせいです。",
    "id": "N: Anna dan Mina sedang berbicara.\nA: Apakah Mina seorang mahasiswa?\nB: Ya, saya mahasiswa Universitas Sakura.\nA: Saya pelajar di sekolah bahasa Jepang.\nB: Pak Tanaka adalah guru bahasa Jepang."
  }
]$json$;

  SELECT array_agg(value->>'pattern') INTO v_known FROM jsonb_array_elements(v_pola);

  FOR r IN SELECT value FROM jsonb_array_elements(v_pola) LOOP
    SELECT id INTO v_grammar_id FROM module_grammar
     WHERE module_id = v_module_id AND pattern = (r.value->>'pattern');

    IF v_grammar_id IS NULL THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE '143: Bab 3 pola "%" tidak ditemukan di module_grammar — skip.', (r.value->>'pattern');
      CONTINUE;
    END IF;

    UPDATE module_grammar
       SET example_dialog    = (r.value->>'jp'),
           example_dialog_id = (r.value->>'id'),
           updated_at        = NOW()
     WHERE id = v_grammar_id;

    v_written := array_append(v_written, v_grammar_id);
    v_filled := v_filled + 1;
  END LOOP;

  -- Pola ke-6 (partikel akhir kalimat ね/よ). Teks pattern-nya di production
  -- BERBEDA dari tebakan repo dan tidak pernah cocok sejak 126, jadi
  -- barisnya dicari lewat ELIMINASI — bukan dengan menebak varian teksnya
  -- satu per satu. Bab 3 memang hanya punya 6 pola (dicatat di 042), jadi
  -- kalau tersisa tepat satu baris di luar 5 pola di atas, itulah dia.
  -- Kalau sisanya 0 atau lebih dari 1, migrasi TIDAK menebak: cukup lapor.
  v_dialog_ne_jp := 'N: ハディさんとユウトさんがはなしています。' || E'\n' ||
                    'A: ユウトさんはにほんじんですね。' || E'\n' ||
                    'B: はい、そうです。ハディさんもがくせいですね。' || E'\n' ||
                    'A: いいえ、わたしはエンジニアですよ。' || E'\n' ||
                    'B: そうですか。';
  v_dialog_ne_id := 'N: Hadi dan Yuto sedang berbicara.' || E'\n' ||
                    'A: Yuto orang Jepang, ya kan?' || E'\n' ||
                    'B: Ya, benar. Hadi juga pelajar, kan?' || E'\n' ||
                    'A: Bukan, saya ini insinyur, lho.' || E'\n' ||
                    'B: Oh, begitu.';

  SELECT count(*) INTO v_rest_count FROM module_grammar
   WHERE module_id = v_module_id AND NOT (pattern = ANY (v_known));

  IF v_rest_count = 1 THEN
    SELECT id, pattern INTO v_grammar_id, v_rest_pattern FROM module_grammar
     WHERE module_id = v_module_id AND NOT (pattern = ANY (v_known));

    UPDATE module_grammar
       SET example_dialog    = v_dialog_ne_jp,
           example_dialog_id = v_dialog_ne_id,
           updated_at        = NOW()
     WHERE id = v_grammar_id;

    v_written := array_append(v_written, v_grammar_id);
    v_filled := v_filled + 1;
    RAISE NOTICE '143: pola sisa "%" diisi dialog ね/よ lewat eliminasi.', v_rest_pattern;
  ELSE
    v_skipped := v_skipped + 1;
    RAISE NOTICE '143: ada % baris di luar 5 pola dikenal — dialog ね/よ TIDAK ditulis (eliminasi hanya aman kalau tersisa tepat 1).', v_rest_count;
  END IF;

  -- Pagar 1: terjemahan sejajar. legacyDraft() membuang SELURUH terjemahan
  -- kalau jumlah barisnya beda, jadi kesalahan ini tidak terlihat sebagai
  -- error — dialognya cuma diam-diam kehilangan arti.
  SELECT count(*) INTO v_bad FROM module_grammar
   WHERE id = ANY (v_written)
     AND array_length(string_to_array(example_dialog, E'\n'), 1)
         IS DISTINCT FROM array_length(string_to_array(example_dialog_id, E'\n'), 1);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '143: % dialog punya jumlah baris JP/ID berbeda — terjemahan akan dibuang legacyDraft().', v_bad;
  END IF;

  -- Pagar 2: tanpa kanji. Hanya atas baris yang DITULIS migrasi ini sendiri
  -- (pelajaran 135: jangan meng-EXCEPTION baris di luar cakupan sendiri).
  SELECT count(*) INTO v_bad FROM module_grammar
   WHERE id = ANY (v_written) AND example_dialog ~ '[一-龥]';
  IF v_bad > 0 THEN
    RAISE EXCEPTION '143: % dialog mengandung kanji — Bab 3 harus kana supaya tidak perlu isian bacaan di editor audio.', v_bad;
  END IF;

  -- Cetak daftar pattern Bab 3 yang BENAR-BENAR ada. Konvensi 135→136:
  -- NOTICE di log deploy adalah satu-satunya cara membaca teks pattern baris
  -- yang dibuat lewat admin, supaya migrasi lanjutan (kalau perlu) bisa
  -- ditulis tanpa ronde tebak-tebakan lagi.
  FOR r IN SELECT pattern FROM module_grammar
            WHERE module_id = v_module_id
            ORDER BY sort_order ASC, created_at ASC LOOP
    RAISE NOTICE '143: pola Bab 3 terdaftar: "%"', r.pattern;
  END LOOP;

  RAISE NOTICE '143: Bab 3 "%" — % pola diisi dialog, % dilewati.',
    v_module_title, v_filled, v_skipped;
END $$;
