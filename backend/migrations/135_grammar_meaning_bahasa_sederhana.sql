-- 135_grammar_meaning_bahasa_sederhana.sql
--
-- Mengganti istilah asing di `module_grammar.meaning` dengan kata yang
-- dipahami pemula. 22 pola di Bab 4-14.
--
-- KENAPA: kolom ini bukan sekadar catatan materi — ia jadi TEKS PILIHAN
-- JAWABAN di soal Step 1 ("Apa fungsi 〜X?"), baik di Tugas Bunpou maupun di
-- Smart Review (keduanya lewat deriveDrills() yang sama). User melaporkan
-- soalnya tidak terbaca karena istilahnya terlalu tinggi.
--
-- PRINSIPNYA BEDAH, BUKAN TULIS ULANG. Draf pertama menulis ulang SEMUA 48
-- arti jadi gaya "untuk bilang ..."; itu ditolak user dua kali — hasilnya
-- janggal dalam bahasa Indonesia, dan koreksi pentingnya: "bentuk negatif
-- masih bisa dipahami, bentuk lampau juga masih bisa dipahami". Jadi:
--
--   DIGANTI (asing bagi pemula): afirmatif, demonstratif, konstruksi, plain,
--     non-lampau, moda transportasi, konjugasi, posisi relatif, verb.
--   DIPERTAHANKAN (istilah pelajaran yang memang dipakai): bentuk negatif,
--     bentuk lampau, kata sifat, kata benda, kata kerja, partikel, objek,
--     subjek, kata bantu bilangan, penghubung, penguat.
--
-- Pola yang artinya sudah bersih TIDAK disentuh sama sekali (Bab 5, Bab 11,
-- Bab 16, dan sebagian besar Bab 4/8/9).
--
-- DUA PAGAR YANG DIJAGA:
--   1. Panjang harus sebanding dalam satu bab. Pengecoh Step 1 diambil dari
--      arti pola LAIN di bab yang sama lalu disaring balancedMeaning()
--      (grammar-drills.js) yang membuang kandidat di luar ~3x panjang
--      jawaban; kalau tersisa < 2 pengecoh, buildRecognitionDrill()
--      mengembalikan NULL dan SOALNYA HILANG tanpa error. Perubahan di sini
--      justru memperbaiki: 'negatif kini' (12 huruf, sudah di ambang) naik
--      jadi 23 huruf. Ditegakkan assertion 15-60 huruf di bawah.
--   2. Satu kalimat saja — shortMeaning() cuma memakai kalimat pertama
--      (ditambah kalimat kedua kalau yang pertama < 25 huruf), potong di 90.
--
-- MENIMPA, bukan mengisi yang kosong: kalau ada arti yang sudah diubah lewat
-- admin, migrasi ini menggantinya (pola replay yang sama dipakai
-- 065/098/101/104/127). Dicocokkan lewat teks `pattern` PERSIS — pola yang
-- tidak ketemu dilewati dengan NOTICE, bukan error. Idempoten.
--
-- BAB 3 TIDAK TERSENTUH: bank polanya diisi manual lewat admin di produksi
-- dan tidak terlihat dari repo. Sisa jargon di luar cakupan hanya DILAPORKAN
-- lewat NOTICE di akhir file, tidak menggagalkan migrasi.

DO $$
DECLARE
  v_rows JSONB := '[
    {"pattern": "この／その／あの／どの + 名詞",    "meaning": "kata tunjuk sebelum kata benda: buku ini, buku itu"},

    {"pattern": "〜は[い-adj]です",                 "meaning": "subjek + kata sifat い, kalimat biasa: kopinya panas"},
    {"pattern": "〜かったです／〜くなかったです",   "meaning": "bentuk lampau kata sifat い (biasa/negatif)"},

    {"pattern": "〜は[な-adj]です",                 "meaning": "subjek + kata sifat な, kalimat biasa: kamarnya ramai"},
    {"pattern": "〜でした／〜じゃありませんでした", "meaning": "bentuk lampau kata sifat な (biasa/negatif)"},
    {"pattern": "〜が好き／嫌い／上手／下手",       "meaning": "kata sifat な yang memakai partikel が: suka, benci, mahir"},

    {"pattern": "〜は〜にあります／います",         "meaning": "benda dulu, baru tempatnya: bukunya ada di meja"},
    {"pattern": "[noun]の[position]",               "meaning": "letak benda: atas, bawah, dalam, luar"},

    {"pattern": "〜へ行きます／来ます／帰ります",   "meaning": "kata kerja arah: pergi/datang/pulang ke ~"},
    {"pattern": "〜で行きます",                     "meaning": "kendaraan yang dipakai: pergi naik ~"},

    {"pattern": "〜を[verb]ます",                   "meaning": "kalimat biasa dengan objek: makan nasi"},
    {"pattern": "[verb]ません",                     "meaning": "bentuk negatif sekarang"},
    {"pattern": "[verb]ました",                     "meaning": "bentuk lampau, sudah dilakukan"},
    {"pattern": "[verb]ませんでした",               "meaning": "bentuk lampau negatif"},
    {"pattern": "毎日／いつも／時々",               "meaning": "kata keterangan seberapa sering"},

    {"pattern": "Te-form Golongan 1 (u-verbs)",     "meaning": "perubahan kata kerja golongan 1 ke bentuk te"},
    {"pattern": "Te-form Golongan 2 (ru-verbs)",    "meaning": "perubahan kata kerja golongan 2 ke bentuk te"},
    {"pattern": "Te-form Tidak Beraturan",          "meaning": "perubahan 2 kata kerja tidak beraturan ke bentuk te"},

    {"pattern": "Nai-form (konjugasi)",             "meaning": "bentuk negatif santai (〜ない)"},
    {"pattern": "[V-jisho] (Bentuk Kamus)",         "meaning": "bentuk dasar kata kerja seperti di kamus"},
    {"pattern": "[V-ta] (Lampau Plain)",            "meaning": "bentuk lampau santai (〜た)"},
    {"pattern": "[V-nakatta]",                      "meaning": "bentuk lampau negatif santai"}
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

    -- Pagar balancedMeaning (lihat header): arti yang jauh lebih pendek atau
    -- panjang dari saudara sebabnya membuat pengecoh gugur dan soal Step 1
    -- hilang diam-diam. Digagalkan di sini, bukan ketahuan nanti sebagai soal
    -- yang tiba-tiba tidak muncul.
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

  RAISE NOTICE '135: % baris module_grammar.meaning disederhanakan', v_updated;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE NOTICE '135: % pola tidak ditemukan di bank dan dilewati: %',
      array_length(v_missing, 1), array_to_string(v_missing, ' | ');
  END IF;
END $$;

-- Assertion + laporan sisa jargon.
--
-- PENTING soal cakupannya: yang DIGAGALKAN hanya kalau pola yang ditulis
-- ulang migrasi ini sendiri masih berjargon (itu berarti isi migrasi ini yang
-- salah). Baris DI LUAR daftar — terutama Bab 3, yang bank polanya diisi
-- manual lewat admin dan tidak terlihat dari repo — hanya DILAPORKAN lewat
-- NOTICE. Versi pertama pengecekan ini memindai seluruh tabel dan me-RAISE
-- EXCEPTION; itu berarti satu baris Bab 3 berjargon (yang tidak bisa
-- dikendalikan dari sini) sanggup menggagalkan seluruh deploy. Tidak sepadan.
DO $$
DECLARE
  v_jargon TEXT := '(afirmatif|demonstratif|konstruksi|non-lampau|moda transportasi|\mplain\M)';
  v_mine   TEXT[] := ARRAY[
    'この／その／あの／どの + 名詞',
    '〜は[い-adj]です','〜かったです／〜くなかったです',
    '〜は[な-adj]です','〜でした／〜じゃありませんでした','〜が好き／嫌い／上手／下手',
    '〜は〜にあります／います','[noun]の[position]',
    '〜へ行きます／来ます／帰ります','〜で行きます',
    '〜を[verb]ます','[verb]ません','[verb]ました','[verb]ませんでした','毎日／いつも／時々',
    'Te-form Golongan 1 (u-verbs)','Te-form Golongan 2 (ru-verbs)','Te-form Tidak Beraturan',
    'Nai-form (konjugasi)','[V-jisho] (Bentuk Kamus)','[V-ta] (Lampau Plain)','[V-nakatta]'
  ];
  v_bad   TEXT;
  v_other TEXT;
BEGIN
  SELECT string_agg(pattern || ' => ' || meaning, E'\n') INTO v_bad
    FROM module_grammar WHERE pattern = ANY(v_mine) AND meaning ~* v_jargon;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'isi migrasi 135 sendiri masih berjargon:%', E'\n' || v_bad;
  END IF;

  SELECT string_agg(pattern || ' => ' || meaning, E'\n') INTO v_other
    FROM module_grammar WHERE NOT (pattern = ANY(v_mine)) AND meaning ~* v_jargon;
  IF v_other IS NOT NULL THEN
    RAISE NOTICE '135: pola DI LUAR cakupan migrasi ini masih berjargon (perbaiki lewat admin, mis. Bab 3):%',
      E'\n' || v_other;
  END IF;
END $$;
