-- 155_n4_kanji_distribution.sql -- Sebar 180 Kanji N4 ke 24 Bab N4.
--
-- Source bab: EzNihongo_Grammar_N4_24_Bab.pdf (24 bab, 20 Sep 2026).
-- Source kanji: app/kanji.html, blok N4 (180 kanji).
--
-- Scope: hanya membuat/melengkapi lesson Kanji per Bab dan mengisi
-- kanji_items. Kosakata/deck sengaja tidak disentuh; akan disusun nanti.
--
-- Idempotent: memakai module ordinal/slug, lesson slug pelajaran-3-kanji,
-- dan update-lalu-insert per (lesson_id, jlpt_level, character).

DO $$
DECLARE
  v_course_id UUID;
  v_module_id UUID;
  v_l_kanji UUID;
  r RECORD;
  v_total INT;
BEGIN
  -- New installations get an editorial draft; existing publication settings stay intact.
  INSERT INTO courses (slug, title, description, level, sort_order, is_published, is_available)
  VALUES ('n4', 'Kelas N4', 'Kurikulum N4 dalam 24 bab.', 'N4', 2, FALSE, FALSE)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_course_id FROM courses WHERE slug = 'n4' LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE '155: kursus n4 tidak ditemukan - skip sebar Kanji N4.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _n4_chapters (
    bab_no INT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    kanji_chars TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _n4_chapters (bab_no, slug, title, kanji_chars) VALUES
    (1, 'n4-b01-menjelaskan-benda-kegiatan', 'N4-B01 | Menjelaskan Benda & Kegiatan', '物事者作用品題字'),
    (2, 'n4-b02-penjelasan-pendapat-kutipan', 'N4-B02 | Penjelasan, Pendapat & Kutipan', '知思考意説問答文'),
    (3, 'n4-b03-waktu-urutan-kegiatan-beriringan', 'N4-B03 | Waktu, Urutan & Kegiatan Beriringan', '朝昼夜今夕曜早帰'),
    (4, 'n4-b04-kemampuan-persepsi', 'N4-B04 | Kemampuan & Persepsi', '力強弱体頭声音味'),
    (5, 'n4-b05-niat-keputusan-kebiasaan', 'N4-B05 | Niat, Keputusan & Kebiasaan', '自主心正習仕働勉'),
    (6, 'n4-b06-mencoba-menyelesaikan-menanggapi-hasil', 'N4-B06 | Mencoba, Menyelesaikan & Menanggapi Hasil', '試験研究集計真悪'),
    (7, 'n4-b07-verba-berpasangan-keadaan-persiapan', 'N4-B07 | Verba Berpasangan, Keadaan & Persiapan', '開止動転起着持'),
    (8, 'n4-b08-arah-perkembangan-tahap-aktivitas', 'N4-B08 | Arah, Perkembangan & Tahap Aktivitas', '歩走通発去送運急'),
    (9, 'n4-b09-cara-kemudahan-perubahan-sifat', 'N4-B09 | Cara, Kemudahan & Perubahan Sifat', '方軽重短低太広暗'),
    (10, 'n4-b10-alasan-kontras-konsesi', 'N4-B10 | Alasan, Kontras & Konsesi', '不別合同有特明'),
    (11, 'n4-b11-dugaan-informasi-orang-lain', 'N4-B11 | Dugaan & Informasi dari Orang Lain', '図写映画色赤青黒'),
    (12, 'n4-b12-kemiripan-perasaan-keinginan', 'N4-B12 | Kemiripan, Perasaan & Keinginan', '好近遠便寒暑風顔'),
    (13, 'n4-b13-pengandaian-to-tara', 'N4-B13 | Pengandaian と & たら', '場所地市町村区都'),
    (14, 'n4-b14-pengandaian-ba-nara', 'N4-B14 | Pengandaian ば & なら', '世界元代京県銀'),
    (15, 'n4-b15-tujuan-kegunaan-instruksi-tidak-langsung', 'N4-B15 | Tujuan, Kegunaan & Instruksi Tidak Langsung', '教注料室屋館院堂'),
    (16, 'n4-b16-saran-kewajiban-instruksi-tegas', 'N4-B16 | Saran, Kewajiban & Instruksi Tegas', '切売使引建台工洗'),
    (17, 'n4-b17-memberi-menerima-benda', 'N4-B17 | Memberi & Menerima Benda', '私兄弟姉妹親族'),
    (18, 'n4-b18-bantuan-permintaan-harapan', 'N4-B18 | Bantuan, Permintaan & Harapan', '貸借茶飯肉牛菜服'),
    (19, 'n4-b19-pertanyaan-tertanam-pembatasan-jumlah', 'N4-B19 | Pertanyaan Tertanam & Pembatasan Jumlah', '員住田海池鳥犬門'),
    (20, 'n4-b20-perbandingan-batas-kondisi', 'N4-B20 | Perbandingan, Batas & Kondisi', '以回度野産首業'),
    (21, 'n4-b21-kalimat-pasif', 'N4-B21 | Kalimat Pasif', '病薬医死家光'),
    (22, 'n4-b22-kausatif-kausatif-pasif', 'N4-B22 | Kausatif & Kausatif-Pasif', '進始終待旅歌森'),
    (23, 'n4-b23-bahasa-hormat-sonkeigo', 'N4-B23 | Bahasa Hormat: Sonkeigo', '英洋秋林夏冬春乗'),
    (24, 'n4-b24-bahasa-merendah-permintaan-formal', 'N4-B24 | Bahasa Merendah & Permintaan Formal', '漢紙質理');

  CREATE TEMP TABLE _n4_kanji (
    bab_no INT NOT NULL,
    character TEXT NOT NULL,
    on_reading TEXT,
    kun_reading TEXT,
    meaning_id TEXT,
    sort_order INT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _n4_kanji (bab_no, character, on_reading, kun_reading, meaning_id, sort_order) VALUES
    (1, '物', 'ブツ・モツ', 'もの-', 'Benda; barang; sesuatu', 1),
    (1, '事', 'ジ', 'こと-', 'Hal; urusan; perkara', 2),
    (1, '者', 'シャ', 'もの-', 'Orang; pelaku', 3),
    (1, '作', 'サク・サ', 'つく-', 'Membuat; menciptakan; karya', 4),
    (1, '用', 'ヨウ', 'もち-', 'Keperluan; tujuan; menggunakan', 5),
    (1, '品', 'ヒン', 'しな-', 'Barang; produk; kualitas; mutu', 6),
    (1, '題', 'ダイ', '-', 'Topik; judul; soal; masalah', 7),
    (1, '字', 'ジ', '-', 'Huruf; karakter; tulisan tangan', 8),
    (2, '知', 'チ', 'し-', 'Mengetahui; tahu', 1),
    (2, '思', 'シ', 'おも-', 'Berpikir; merasa', 2),
    (2, '考', 'コウ', 'かんが-', 'Berpikir; mempertimbangkan', 3),
    (2, '意', 'イ', '-', 'Makna; niat; pikiran; perhatian', 4),
    (2, '説', 'セツ・ゼイ', '-', 'Menjelaskan; teori; cerita', 5),
    (2, '問', 'モン', 'と-', 'Pertanyaan; bertanya; masalah', 6),
    (2, '答', 'トウ', 'こた-', 'Jawaban; menjawab', 7),
    (2, '文', 'ブン・モン', 'ふみ-', 'Kalimat; tulisan; budaya', 8),
    (3, '朝', 'チョウ', 'あさ-', 'Pagi', 1),
    (3, '昼', 'チュウ', 'ひる-', 'Siang; tengah hari', 2),
    (3, '夜', 'ヤ', 'よる・よ', 'Malam', 3),
    (3, '今', 'コン・キン', 'いま-', 'Sekarang; saat ini', 4),
    (3, '夕', 'セキ', 'ゆう-', 'Sore; senja; malam awal', 5),
    (3, '曜', 'ヨウ', '-', 'Hari (dalam minggu)', 6),
    (3, '早', 'ソウ・サッ', 'はや-', 'Awal; cepat; dini', 7),
    (3, '帰', 'キ', 'かえ-', 'Pulang; kembali', 8),
    (4, '力', 'リョク・リキ', 'ちから-', 'Kekuatan; tenaga; usaha', 1),
    (4, '強', 'キョウ', 'つよ-', 'Kuat; keras; belajar', 2),
    (4, '弱', 'ジャク', 'よわ-', 'Lemah; tidak kuat', 3),
    (4, '体', 'タイ・テイ', 'からだ-', 'Tubuh; badan', 4),
    (4, '頭', 'トウ・ズ', 'あたま-', 'Kepala; otak', 5),
    (4, '声', 'セイ・ショウ', 'こえ-', 'Suara; bunyi (dari mulut)', 6),
    (4, '音', 'オン・イン', 'おと-', 'Suara; bunyi; nada', 7),
    (4, '味', 'ミ', 'あじ-', 'Rasa; cita rasa; minat', 8),
    (5, '自', 'ジ', 'みずか-', 'Diri sendiri; sendiri', 1),
    (5, '主', 'シュ・ス', 'ぬし-', 'Utama; tuan; pemilik', 2),
    (5, '心', 'シン', 'こころ-', 'Hati; pikiran; jiwa', 3),
    (5, '正', 'セイ・ショウ', 'ただ-', 'Benar; tepat; lurus', 4),
    (5, '習', 'シュウ', 'なら-', 'Belajar; berlatih; kebiasaan', 5),
    (5, '仕', 'シ・ジ', 'つか-', 'Bekerja; melayani; melakukan', 6),
    (5, '働', 'ドウ', 'はたら-', 'Bekerja; tenaga kerja', 7),
    (5, '勉', 'ベン', '-', 'Belajar; rajin; giat', 8),
    (6, '試', 'シ', 'こころ-', 'Mencoba; ujian; tes', 1),
    (6, '験', 'ケン', '-', 'Ujian; pengalaman; pemeriksaan', 2),
    (6, '研', 'ケン', 'と-', 'Meneliti; mengasah; studi', 3),
    (6, '究', 'キュウ', 'きわ-', 'Meneliti; menyelidiki; mengkaji', 4),
    (6, '集', 'シュウ', 'あつ-', 'Mengumpulkan; berkumpul; koleksi', 5),
    (6, '計', 'ケイ', 'はか-', 'Menghitung; rencana; mengukur', 6),
    (6, '真', 'シン', 'ま-', 'Sejati; asli; sungguh-sungguh', 7),
    (6, '悪', 'アク', 'わる-', 'Buruk; jahat; salah', 8),
    (7, '開', 'カイ', 'あ-', 'Membuka; mulai; terbuka', 1),
    (7, '止', 'シ', 'と-', 'Berhenti; menghentikan; melarang', 2),
    (7, '動', 'ドウ', 'うご-', 'Bergerak; gerak; gerakan', 3),
    (7, '転', 'テン', 'ころ-', 'Bergulir; berbalik; berubah; jatuh', 4),
    (7, '起', 'キ', 'お-', 'Bangun; terjadi; bangkit', 5),
    (7, '着', 'チャク', 'き-', 'Memakai (pakaian); tiba; menempel', 6),
    (7, '持', 'ジ', 'も-', 'Memegang; membawa; memiliki', 7),
    (8, '歩', 'ホ', 'ある-', 'Berjalan', 1),
    (8, '走', 'ソウ', 'はし-', 'Berlari', 2),
    (8, '通', 'ツウ', 'とお-', 'Melewati; tembus; berkomunikasi', 3),
    (8, '発', 'ハツ・ホツ', '-', 'Berangkat; mengeluarkan; memulai', 4),
    (8, '去', 'キョ・コ', 'さ-', 'Pergi; berlalu; lalu (waktu)', 5),
    (8, '送', 'ソウ', 'おく-', 'Mengirim; mengantarkan', 6),
    (8, '運', 'ウン', 'はこ-', 'Membawa; keberuntungan; nasib; transportasi', 7),
    (8, '急', 'キュウ', 'いそ-', 'Tergesa-gesa; mendesak; tiba-tiba', 8),
    (9, '方', 'ホウ', 'かた-', 'Arah; cara; orang (sopan)', 1),
    (9, '軽', 'ケイ', 'かる-', 'Ringan; mudah; kasual', 2),
    (9, '重', 'ジュウ・チョウ', 'おも-', 'Berat; penting; berlapis', 3),
    (9, '短', 'タン', 'みじか-', 'Pendek', 4),
    (9, '低', 'テイ', 'ひく-', 'Rendah; pendek; murah', 5),
    (9, '太', 'タ・タイ', 'ふと-', 'Gemuk; tebal; besar', 6),
    (9, '広', 'コウ', 'ひろ-', 'Luas; lebar; lapang', 7),
    (9, '暗', 'アン', 'くら-', 'Gelap; suram; menghafal', 8),
    (10, '不', 'フ・ブ', '-', 'Tidak; bukan; awalan negatif', 1),
    (10, '別', 'ベツ', 'わか-', 'Terpisah; berbeda; perpisahan', 2),
    (10, '合', 'ゴウ', 'あ-', 'Sesuai; cocok; bergabung', 3),
    (10, '同', 'ドウ', 'おな-', 'Sama; serupa', 4),
    (10, '有', 'ユウ・ウ', 'あ-', 'Ada; memiliki; berlaku', 5),
    (10, '特', 'トク', '-', 'Khusus; istimewa; luar biasa', 6),
    (10, '明', 'メイ・ミョウ', 'あか-', 'Terang; jelas; besok', 7),
    (11, '図', 'ズ・ト', '-', 'Diagram; peta; gambar; berencana', 1),
    (11, '写', 'シャ', 'うつ-', 'Memfoto; menyalin; mereproduksi', 2),
    (11, '映', 'エイ', 'うつ-', 'Memutar; memantulkan; film', 3),
    (11, '画', 'ガ・カク', '-', 'Gambar; lukisan; rencana; goresan', 4),
    (11, '色', 'ショク・シキ', 'いろ-', 'Warna', 5),
    (11, '赤', 'セキ', 'あか-', 'Merah', 6),
    (11, '青', 'セイ', 'あお-', 'Biru; hijau (muda); remaja', 7),
    (11, '黒', 'コク', 'くろ-', 'Hitam', 8),
    (12, '好', 'コウ', 'す-', 'Suka; menyukai; baik hati', 1),
    (12, '近', 'キン', 'ちか-', 'Dekat', 2),
    (12, '遠', 'エン', 'とお-', 'Jauh', 3),
    (12, '便', 'ベン・ビン', 'たよ-', 'Nyaman; surat; pengiriman; penerbangan', 4),
    (12, '寒', 'カン', 'さむ-', 'Dingin (cuaca); kedinginan', 5),
    (12, '暑', 'ショ', 'あつ-', 'Panas (cuaca); terik', 6),
    (12, '風', 'フウ・フ', 'かぜ-', 'Angin; gaya; cara; flu', 7),
    (12, '顔', 'ガン', 'かお-', 'Wajah; ekspresi; muka', 8),
    (13, '場', 'ジョウ', 'ば-', 'Tempat; lokasi; lapangan', 1),
    (13, '所', 'ショ', 'ところ-', 'Tempat; lokasi; bagian', 2),
    (13, '地', 'チ・ジ', '-', 'Tanah; bumi; daerah', 3),
    (13, '市', 'シ', 'いち-', 'Kota; pasar', 4),
    (13, '町', 'チョウ', 'まち-', 'Kota kecil; blok kota; jalan', 5),
    (13, '村', 'ソン', 'むら-', 'Desa; kampung', 6),
    (13, '区', 'ク', '-', 'Distrik; bagian; kecamatan', 7),
    (13, '都', 'ト・ツ', 'みやこ-', 'Ibu kota; metropolitan; Tokyo', 8),
    (14, '世', 'セ・セイ', '-', 'Dunia; generasi; era; zaman', 1),
    (14, '界', 'カイ', '-', 'Dunia; batas; ranah; bidang', 2),
    (14, '元', 'ゲン・ガン', 'もと-', 'Asal; asli; mantan; sumber', 3),
    (14, '代', 'ダイ・タイ', 'か-', 'Generasi; pengganti; biaya; era', 4),
    (14, '京', 'キョウ・ケイ', '-', 'Ibu kota; Tokyo; Kyoto', 5),
    (14, '県', 'ケン', '-', 'Prefektur (wilayah administrasi Jepang)', 6),
    (14, '銀', 'ギン', '-', 'Perak; bank', 7),
    (15, '教', 'キョウ', 'おし-', 'Mengajar; agama; pelajaran', 1),
    (15, '注', 'チュウ', 'そそ-', 'Menuangkan; memperhatikan; catatan', 2),
    (15, '料', 'リョウ', '-', 'Bahan; biaya; ongkos', 3),
    (15, '室', 'シツ', '-', 'Ruangan; kamar; kantor', 4),
    (15, '屋', 'オク', 'や-', 'Atap; toko; penjual; akhiran untuk toko', 5),
    (15, '館', 'カン', '-', 'Gedung; aula; hotel; pusat', 6),
    (15, '院', 'イン', '-', 'Lembaga; rumah sakit; kuil', 7),
    (15, '堂', 'ドウ', '-', 'Aula; kuil; megah', 8),
    (16, '切', 'セツ・サイ', 'き-', 'Memotong; penting; habis masa berlaku', 1),
    (16, '売', 'バイ', 'う-', 'Menjual', 2),
    (16, '使', 'シ', 'つか-', 'Menggunakan; memakai', 3),
    (16, '引', 'イン', 'ひ-', 'Menarik; mengutip; diskon', 4),
    (16, '建', 'ケン', 'た-', 'Membangun; mendirikan; konstruksi', 5),
    (16, '台', 'ダイ・タイ', '-', 'Alat; mesin (pencacah); stan; dasar', 6),
    (16, '工', 'コウ・ク', '-', 'Kerja; kerajinan; konstruksi; pabrik', 7),
    (16, '洗', 'セン', 'あら-', 'Mencuci; membilas; membersihkan', 8),
    (17, '私', 'シ', 'わたし-', 'Saya; aku; pribadi', 1),
    (17, '兄', 'ケイ・キョウ', 'あに-', 'Kakak laki-laki', 2),
    (17, '弟', 'テイ・ダイ', 'おとうと-', 'Adik laki-laki', 3),
    (17, '姉', 'シ', 'あね-', 'Kakak perempuan', 4),
    (17, '妹', 'マイ', 'いもうと-', 'Adik perempuan', 5),
    (17, '親', 'シン', 'おや-', 'Orang tua; akrab; keintiman', 6),
    (17, '族', 'ゾク', '-', 'Suku; keluarga; kelompok', 7),
    (18, '貸', 'タイ', 'か-', 'Meminjamkan; menyewakan', 1),
    (18, '借', 'シャク', 'か-', 'Meminjam; menyewa', 2),
    (18, '茶', 'チャ・サ', '-', 'Teh; cokelat (warna)', 3),
    (18, '飯', 'ハン', 'めし-', 'Nasi (matang); makan', 4),
    (18, '肉', 'ニク', '-', 'Daging; otot', 5),
    (18, '牛', 'ギュウ', 'うし-', 'Sapi; daging sapi', 6),
    (18, '菜', 'サイ', 'な-', 'Sayuran; sayur hijau', 7),
    (18, '服', 'フク', '-', 'Pakaian; baju; patuh', 8),
    (19, '員', 'イン', '-', 'Anggota; staf; pegawai', 1),
    (19, '住', 'ジュウ', 'す-', 'Tinggal; bertempat tinggal; bermukim', 2),
    (19, '田', 'デン', 'た-', 'Sawah; ladang', 3),
    (19, '海', 'カイ', 'うみ-', 'Laut; samudra', 4),
    (19, '池', 'チ', 'いけ-', 'Kolam; telaga', 5),
    (19, '鳥', 'チョウ', 'とり-', 'Burung; unggas', 6),
    (19, '犬', 'ケン', 'いぬ-', 'Anjing', 7),
    (19, '門', 'モン', 'かど-', 'Gerbang; pintu gerbang', 8),
    (20, '以', 'イ', '-', 'Dari; lebih dari; berdasarkan', 1),
    (20, '回', 'カイ', 'まわ-', 'Kali; putaran; berputar', 2),
    (20, '度', 'ド', 'たび-', 'Derajat; kali; jumlah', 3),
    (20, '野', 'ヤ', 'の-', 'Lapangan; alam liar; sayuran', 4),
    (20, '産', 'サン', 'う-', 'Menghasilkan; produk; kelahiran', 5),
    (20, '首', 'シュ', 'くび-', 'Leher; kepala; pemimpin', 6),
    (20, '業', 'ギョウ・ゴウ', 'わざ-', 'Pekerjaan; industri; usaha', 7),
    (21, '病', 'ビョウ', 'や-', 'Sakit; penyakit', 1),
    (21, '薬', 'ヤク', 'くすり-', 'Obat; obat-obatan', 2),
    (21, '医', 'イ', '-', 'Dokter; kedokteran; menyembuhkan', 3),
    (21, '死', 'シ', 'し-', 'Kematian; mati; meninggal', 4),
    (21, '家', 'カ・ケ', 'いえ・うち-', 'Rumah; keluarga; ahli', 5),
    (21, '光', 'コウ', 'ひか-', 'Cahaya; sinar; bersinar', 6),
    (22, '進', 'シン', 'すす-', 'Maju; berkembang; melanjutkan', 1),
    (22, '始', 'シ', 'はじ-', 'Mulai; memulai; awal', 2),
    (22, '終', 'シュウ', 'お-', 'Selesai; akhir; berakhir', 3),
    (22, '待', 'タイ', 'ま-', 'Menunggu; mengharapkan', 4),
    (22, '旅', 'リョ', 'たび-', 'Perjalanan; wisata; bepergian', 5),
    (22, '歌', 'カ', 'うた-', 'Lagu; menyanyikan', 6),
    (22, '森', 'シン', 'もり-', 'Hutan', 7),
    (23, '英', 'エイ', '-', 'Inggris; bahasa Inggris; pahlawan; unggul', 1),
    (23, '洋', 'ヨウ', '-', 'Barat; asing; samudra', 2),
    (23, '秋', 'シュウ', 'あき-', 'Musim gugur', 3),
    (23, '林', 'リン', 'はやし-', 'Hutan kecil; rumpun pohon', 4),
    (23, '夏', 'カ・ゲ', 'なつ-', 'Musim panas', 5),
    (23, '冬', 'トウ', 'ふゆ-', 'Musim dingin', 6),
    (23, '春', 'シュン', 'はる-', 'Musim semi', 7),
    (23, '乗', 'ジョウ', 'の-', 'Naik; menaiki; menumpang', 8),
    (24, '漢', 'カン', '-', 'Tiongkok; karakter Cina; pria', 1),
    (24, '紙', 'シ', 'かみ-', 'Kertas', 2),
    (24, '質', 'シツ・シチ', 'ただ-', 'Kualitas; sifat; pertanyaan', 3),
    (24, '理', 'リ', '-', 'Alasan; logika; prinsip; mengatur', 4);

  FOR r IN SELECT * FROM _n4_chapters ORDER BY bab_no LOOP
    SELECT m.id INTO v_module_id
      FROM modules m
     WHERE m.course_id = v_course_id
       AND (m.slug = r.slug OR m.sort_order = r.bab_no)
     ORDER BY CASE WHEN m.slug = r.slug THEN 0 ELSE 1 END, m.created_at ASC
     LIMIT 1;

    IF v_module_id IS NULL THEN
      INSERT INTO modules (course_id, slug, title, description, sort_order)
      VALUES (
        v_course_id,
        r.slug,
        r.title,
        'Bab N4 dari kurikulum Grammar N4 24 Bab. Kanji disiapkan lebih dulu; kosakata akan disusun pada tahap berikutnya.',
        r.bab_no
      )
      RETURNING id INTO v_module_id;
    ELSE
      UPDATE modules SET
        slug = CASE WHEN slug IS NULL OR slug = '' OR slug !~ '^n4-b[0-9]{2}-' THEN r.slug ELSE slug END,
        title = r.title,
        description = COALESCE(NULLIF(description, ''), 'Bab N4 dari kurikulum Grammar N4 24 Bab. Kanji disiapkan lebih dulu; kosakata akan disusun pada tahap berikutnya.'),
        sort_order = r.bab_no,
        updated_at = NOW()
      WHERE id = v_module_id;
    END IF;

    INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
    VALUES (
      v_module_id,
      'pelajaran-3-kanji',
      'Pelajaran 3: Kanji 漢字',
      'kanji',
      'Kanji N4 untuk ' || r.title || '. Kosakata/deck bab ini akan disusun terpisah.',
      3,
      20
    )
    ON CONFLICT (module_id, slug) DO UPDATE SET
      title = EXCLUDED.title,
      type = EXCLUDED.type,
      content = COALESCE(NULLIF(lessons.content, ''), EXCLUDED.content),
      sort_order = EXCLUDED.sort_order,
      duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
      updated_at = NOW()
    RETURNING id INTO v_l_kanji;

    UPDATE kanji_items ki SET
      jlpt_level = 'N4',
      on_reading = COALESCE(NULLIF(ki.on_reading, ''), k.on_reading),
      kun_reading = COALESCE(NULLIF(ki.kun_reading, ''), k.kun_reading),
      meaning_id = COALESCE(NULLIF(ki.meaning_id, ''), k.meaning_id),
      bab_kode = 'N4-B' || LPAD(r.bab_no::TEXT, 2, '0'),
      sort_order = k.sort_order,
      updated_at = NOW()
    FROM _n4_kanji k
    WHERE k.bab_no = r.bab_no
      AND ki.lesson_id = v_l_kanji
      AND ki.jlpt_level = 'N4'
      AND ki.character = k.character;

    INSERT INTO kanji_items (
      character, jlpt_level, on_reading, kun_reading, meaning_id,
      bab_kode, lesson_id, sort_order
    )
    SELECT
      k.character, 'N4', k.on_reading, k.kun_reading, k.meaning_id,
      'N4-B' || LPAD(r.bab_no::TEXT, 2, '0'), v_l_kanji, k.sort_order
    FROM _n4_kanji k
    WHERE k.bab_no = r.bab_no
      AND NOT EXISTS (
        SELECT 1 FROM kanji_items ki
         WHERE ki.lesson_id = v_l_kanji
           AND ki.jlpt_level = 'N4'
           AND ki.character = k.character
      );
  END LOOP;

  SELECT COUNT(*) INTO v_total
    FROM kanji_items ki
    JOIN lessons l ON l.id = ki.lesson_id
    JOIN modules m ON m.id = l.module_id
   WHERE m.course_id = v_course_id
     AND ki.jlpt_level = 'N4'
     AND ki.bab_kode ~ '^N4-B[0-9]{2}$';

  IF v_total < 180 THEN
    RAISE EXCEPTION '155: Kanji N4 belum lengkap - ditemukan %, minimum 180.', v_total;
  END IF;

  RAISE NOTICE '155: selesai - 180 Kanji N4 disebar ke 24 Bab sesuai kurikulum N4 baru.';
END $$;
