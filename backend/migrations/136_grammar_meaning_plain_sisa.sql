-- 136_grammar_meaning_plain_sisa.sql
--
-- Menyelesaikan sisa pekerjaan migrasi 135: 4 pola yang artinya masih memakai
-- kata "plain".
--
-- ASAL TEMUANNYA. 135 sengaja tidak menggagalkan deploy hanya karena ada
-- jargon di baris DI LUAR cakupannya — baris seperti itu cuma dilaporkan lewat
-- NOTICE. Pagar itu bekerja: log deploy produksi (run #336) menampilkan
--
--     V (ない形)      => negatif plain
--     V (た形)        => lampau plain
--     V (なかった形)  => lampau negatif plain
--     い-adj plain    => bentuk plain い-adj
--
-- Keempat pola ini TIDAK ADA di repo — `grep` atas seluruh backend/migrations/
-- tidak menemukan satu pun. Jadi baris ini diisi manual lewat admin di
-- produksi. Sebelum 135 dideploy, teks `pattern`-nya memang tidak bisa
-- diketahui dari sini; NOTICE itulah yang akhirnya memberikannya, dan itu yang
-- membuat migrasi ini bisa ditulis.
--
-- KENAPA PENTING: `module_grammar.meaning` bukan sekadar catatan materi — ia
-- jadi TEKS PILIHAN JAWABAN soal Step 1 ("Apa fungsi 〜X?"), di Tugas Bunpou
-- maupun Smart Review, lewat deriveDrills() yang sama.
--
-- PRINSIP SAMA DENGAN 135: bedah, bukan tulis ulang. Istilah pelajaran yang
-- memang dipakai siswa (bentuk negatif, bentuk lampau, kata sifat, kata kerja)
-- DIPERTAHANKAN; yang diganti hanya `plain` → `santai`, kosakata yang sudah
-- dipakai 135 ("bentuk negatif santai (〜ない)").
--
-- `pattern` SENGAJA TIDAK DIUBAH, termasuk 「い-adj plain」 yang namanya sendiri
-- berbunyi "plain" dan ikut tampil di pertanyaan. Alasannya: teks `pattern`
-- dipakai sebagai kunci pencocokan antar-migrasi (090-097 FIND-OR-CREATE pola
-- lewat pattern persis), jadi menggantinya berisiko membuat migrasi berikutnya
-- menyisipkan baris DUPLIKAT alih-alih memakai ulang baris yang sudah ada.
-- Konsekuensi yang diterima secara sadar: kata "plain" masih terlihat siswa di
-- pertanyaan untuk satu pola itu. Perbaikannya lewat admin.
--
-- DUA JEBAKAN YANG DIJAGA:
--   1. JANGAN KEMBAR DENGAN ARTI 135. sameMeaning() (grammar-drills.js)
--      membuang opsi yang salah satunya MEMUAT yang lain setelah dinormalkan
--      (huruf kecil, spasi & tanda baca dibuang). 135 sudah memberi Bab 14
--      "bentuk negatif santai (〜ない)", "bentuk lampau santai (〜た)", dan
--      "bentuk lampau negatif santai". Kalau 4 baris di sini diberi teks yang
--      sama persis DAN ternyata satu modul dengan Bab 14, pengecohnya saling
--      terbuang → tersisa < 2 pengecoh → buildRecognitionDrill() mengembalikan
--      NULL dan SOALNYA HILANG TANPA ERROR. Modul asal 4 baris ini tidak
--      terlihat dari repo, jadi teks di bawah diamankan untuk kasus terburuk
--      (satu modul): strukturnya sengaja dibedakan, mis. "bentuk lampau
--      negatif untuk bicara santai" vs "bentuk lampau negatif santai" — tidak
--      ada containment ke arah mana pun.
--   2. JANGAN ULANGI KANA BENTUKNYA DI ARTINYA. Pattern-nya sudah memuat
--      ない／た／なかった; kalau artinya ikut memuat 〜ない, siswa bisa
--      mencocokkan kana tanpa memahami polanya. Karena itu artinya
--      dideskripsikan lewat fungsi.
--
-- MENIMPA, bukan mengisi yang kosong. Dicocokkan lewat teks `pattern` PERSIS —
-- pola yang tidak ketemu dilewati dengan NOTICE, bukan error. Idempoten.

DO $$
DECLARE
  v_rows JSONB := '[
    {"pattern": "V (ない形)",    "meaning": "bentuk negatif kata kerja untuk bicara santai"},
    {"pattern": "V (た形)",      "meaning": "bentuk lampau kata kerja untuk bicara santai"},
    {"pattern": "V (なかった形)", "meaning": "bentuk lampau negatif untuk bicara santai"},
    {"pattern": "い-adj plain",  "meaning": "kata sifat い tanpa です untuk bicara santai"}
  ]'::jsonb;
  v_item     JSONB;
  v_pattern  TEXT;
  v_meaning  TEXT;
  v_len      INT;
  v_hit      INT;
  v_updated  INT := 0;
  v_missing  TEXT[] := '{}';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
    v_pattern := v_item->>'pattern';
    v_meaning := v_item->>'meaning';
    v_len     := char_length(v_meaning);

    -- Pagar balancedMeaning (lihat header 135): arti yang jauh lebih pendek
    -- atau panjang dari saudaranya membuat pengecoh gugur dan soal Step 1
    -- hilang diam-diam. 15-60 bukan angka karangan — setiap dua nilai di dalam
    -- rentang ini selalu lolos saling-uji balancedMeaning (kasus terburuk
    -- a=60, c=15 → 15*3+20 = 65 >= 60).
    IF v_len < 15 OR v_len > 60 THEN
      RAISE EXCEPTION 'meaning di luar rentang aman 15-60 huruf (% huruf) untuk pola %: %',
        v_len, v_pattern, v_meaning;
    END IF;
    -- Satu kalimat saja: shortMeaning() memotong sisanya.
    IF v_meaning LIKE '%. %' THEN
      RAISE EXCEPTION 'meaning harus satu kalimat (shortMeaning memotong sisanya) untuk pola %: %',
        v_pattern, v_meaning;
    END IF;

    UPDATE module_grammar SET meaning = v_meaning WHERE pattern = v_pattern;
    GET DIAGNOSTICS v_hit = ROW_COUNT;
    IF v_hit = 0 THEN
      v_missing := v_missing || v_pattern;
    ELSE
      v_updated := v_updated + v_hit;
    END IF;
  END LOOP;

  RAISE NOTICE '136: % baris module_grammar.meaning disederhanakan', v_updated;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE NOTICE '136: % pola tidak ditemukan di bank dan dilewati: %',
      array_length(v_missing, 1), array_to_string(v_missing, ' | ');
  END IF;
END $$;

-- Assertion + laporan sisa jargon — cakupannya sama persis dengan 135:
-- DIGAGALKAN hanya kalau pola yang ditulis ulang migrasi INI sendiri masih
-- berjargon (berarti isi migrasi ini yang salah). Baris di luar daftar hanya
-- DILAPORKAN lewat NOTICE, karena satu baris admin yang tidak terlihat dari
-- repo tidak boleh sanggup menggagalkan seluruh deploy.
DO $$
DECLARE
  v_jargon TEXT := '(afirmatif|demonstratif|konstruksi|non-lampau|moda transportasi|\mplain\M)';
  v_mine   TEXT[] := ARRAY[
    'V (ない形)', 'V (た形)', 'V (なかった形)', 'い-adj plain'
  ];
  v_bad   TEXT;
  v_other TEXT;
BEGIN
  SELECT string_agg(pattern || ' => ' || meaning, E'\n') INTO v_bad
    FROM module_grammar WHERE pattern = ANY(v_mine) AND meaning ~* v_jargon;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'isi migrasi 136 sendiri masih berjargon:%', E'\n' || v_bad;
  END IF;

  SELECT string_agg(pattern || ' => ' || meaning, E'\n') INTO v_other
    FROM module_grammar WHERE NOT (pattern = ANY(v_mine)) AND meaning ~* v_jargon;
  IF v_other IS NOT NULL THEN
    RAISE NOTICE '136: pola DI LUAR cakupan migrasi ini masih berjargon (perbaiki lewat admin, mis. Bab 3):%',
      E'\n' || v_other;
  END IF;
END $$;
