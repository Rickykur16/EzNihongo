-- 148_grammar_bab3_ですか_fix.sql — Perbaiki DUA hal pada pola 〜は〜ですか
-- Bab 3, ditemukan lewat review manual modal admin "🎯 Pengecoh Step 1/2":
--
-- (1) `module_grammar.meaning` ("Arti", dipakai sebagai jawaban benar Step 1
-- recognition-quiz) isinya cuma "Apakah A B?" -- bukan salah gramatikal
-- (predikat nominal Indonesia memang tanpa kopula), tapi melanggar niat
-- desain field ini sendiri: komentar `grammar-drills.js` bilang `meaning`
-- "ditulis untuk dibaca sebagai materi" (harus menjelaskan FUNGSI pola,
-- bukan echo rumus). Lebih konkret: `balancedMeaning()` mensyaratkan opsi
-- Step 1 sebanding panjangnya supaya tidak bisa ditebak dari BENTUKNYA saja
-- -- "Apakah A B?" (11 karakter) berdampingan dengan 3 pengecoh kurasi
-- admin yang sudah ada (46-57 karakter) itu jomplang, siswa bisa menebak
-- jawaban benar murni dari panjangnya tanpa paham Jepang sama sekali.
-- Diganti "Menanyakan apakah A adalah B dalam bentuk sopan" -- notasi A/B
-- dipertahankan (sudah diajarkan eksplisit di Bab 3, lihat migration 042:
-- "AはBです berarti A adalah B"), cuma kalimatnya sekarang menjelaskan
-- fungsinya (menanyakan + sopan), dan panjangnya (47 karakter) sekarang
-- sebanding dengan pengecoh yang ada.
--
-- (2) `grammar_examples.japanese` (contoh pertama, dipakai Step 2 latihan
-- bentuk) -- "あには かいしゃいんですか。" -- memakai あに, istilah untuk
-- KELUARGA SENDIRI (dipakai saat bicara TENTANG keluarga sendiri KEPADA
-- orang lain), padahal terjemahannya menanyakan keluarga LAWAN BICARA
-- ("Apakah kakak laki-lakimu karyawan?"). Untuk bertanya soal keluarga
-- ORANG LAIN, Jepang wajib pakai bentuk hormat おにいさん, bukan あに. Tiga
-- contoh keluarga lain di migration 139 (ちちは.../ははは.../あねも...)
-- semuanya PERNYATAAN tentang keluarga SENDIRI -- itu memang benar pakai
-- istilah rendah. Pola ini satu-satunya PERTANYAAN tentang keluarga orang
-- lain, jadi satu-satunya yang salah pakai istilah rendah.
--
-- Sumber migration 139 SUDAH diedit langsung di repo untuk (2) (fresh
-- install lewat 000-148 sudah benar sejak awal); field `meaning` (1) tidak
-- pernah diisi lewat migrasi apa pun (bank pola Bab 3 diisi manual lewat
-- admin, sama seperti dicatat di 126/127/128), jadi tidak ada "sumber" utk
-- diedit -- migrasi ini SATU-SATUNYA tempat perbaikannya. Kedua UPDATE
-- idempoten: WHERE mencocokkan teks lama persis, jadi re-run aman (0 baris
-- kena kalau sudah diperbaiki atau sudah diedit admin sejak saat ini).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_grammar_id   UUID;
  v_updated      INT;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '148: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(perkenalan|kosakata)' THEN
    RAISE NOTICE '148: modul Bab 3 terbaca "%" — dilanjutkan tetap, tapi cek manual kalau meleset.', v_module_title;
  END IF;

  SELECT id INTO v_grammar_id FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜は〜ですか';

  IF v_grammar_id IS NULL THEN
    RAISE NOTICE '148: pola "〜は〜ですか" Bab 3 tidak ditemukan di module_grammar — skip.';
    RETURN;
  END IF;

  -- (1) Arti / meaning — jawaban benar Step 1.
  UPDATE module_grammar
     SET meaning = 'Menanyakan apakah A adalah B dalam bentuk sopan'
   WHERE id = v_grammar_id
     AND meaning = 'Apakah A B?';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE NOTICE '148: module_grammar.meaning tidak berisi teks lama "Apakah A B?" (sudah diperbaiki / sudah diedit admin) — 0 baris diubah.';
  ELSE
    RAISE NOTICE '148: module_grammar.meaning diperbaiki untuk modul "%".', v_module_title;
  END IF;

  -- (2) Contoh kalimat pertama — jawaban benar Step 2.
  UPDATE grammar_examples
     SET japanese = 'おにいさんは かいしゃいんですか。'
   WHERE grammar_id = v_grammar_id
     AND japanese = 'あには かいしゃいんですか。';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE NOTICE '148: grammar_examples tidak berisi teks lama "あには かいしゃいんですか。" (sudah diperbaiki / sudah diedit admin) — 0 baris diubah.';
  ELSE
    RAISE NOTICE '148: grammar_examples.japanese diperbaiki (あに → おにいさん) untuk modul "%".', v_module_title;
  END IF;
END $$;
