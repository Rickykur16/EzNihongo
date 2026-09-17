-- 149_bunpou_flow_bab3_companion.sql — isi "Pendamping Bunpou" (tujuan
-- pelajaran + arahan menyimak per pola) untuk pelajaran Tata Bahasa Bab 3.
--
-- KENAPA MIGRASI, BUKAN DIKETIK LEWAT ADMIN: konten siswa di repo ini selalu
-- ditulis & direview sebagai diff migrasi, bukan dieksekusi live tanpa
-- pratinjau — konvensi yang ditetapkan user sendiri waktu tombol AI
-- "Lengkapi contoh" dihapus dan diganti migration 126. Editor
-- "🧭 Pendamping Bunpou" di admin tetap jalan normal di atas hasil migrasi
-- ini (draft bisa diedit lalu dipublikasikan ulang seperti biasa).
--
-- YANG DIISI, DAN YANG SENGAJA TIDAK:
--   objective  → DIISI. Dirender di kepala pelajaran sebagai "🎯 …"
--                (welcome.html:12435).
--   directions → DIISI. Dirender DI DALAM blok "💬 Dialog contoh", tepat di
--                ATAS pemutar dialog, sebagai "🎧 …" (welcome.html:8031).
--                Karena posisinya begitu, tiap arahan ditulis untuk dialog
--                yang persis ada di bawahnya — menyebut giliran dan kalimat
--                yang benar-benar terdengar di dialog itu, bukan definisi
--                pola yang generik (arti polanya sudah ada di kartu).
--   overlays   → TIDAK DIISI. Hint/penjelasan per-step memang sudah
--                tersalur di backend (bunpou-flow-service.js#overlayFor →
--                snapshot sesi → publicSessionItem), TAPI belum ada yang
--                merendernya di sisi siswa: tombol "Minta petunjuk" belum
--                dibuat (sudah dicatat di CLAUDE.md sebagai di luar cakupan
--                Paket 1), dan jalur reveal sesi (welcome.html:9432) cuma
--                membaca correctIndex/correctOrder/japanese — field
--                `explanation` dibuang begitu saja. Mengisinya sekarang =
--                menulis teks yang tidak pernah sampai ke siswa; pola yang
--                sama sudah pernah sengaja dihindari sebelumnya (auto-warm
--                cache dialog, lihat CLAUDE.md). Isi overlays kalau UI-nya
--                sudah ada, jangan sebelum itu.
--
-- TIDAK MENYALAKAN PILOT: `bunpou_flow_pilot_enabled` dan
-- `bunpou_flow_pilot_lesson_id` TIDAK disentuh sama sekali. Selama flag
-- mati, content.js hanya melampirkan companion kalau
-- `pilotConfig.enabled AND pilotConfig.lessonId = row.id` (content.js:393),
-- jadi migrasi ini NOL dampak ke siswa sampai admin menyalakannya sendiri
-- lewat tab AI → "Bunpou Flow — pilot satu pelajaran". Menyalakan tetap
-- keputusan manusia, sesuai desain Paket 1.
--
-- DICOCOKKAN LEWAT ISI DIALOG, BUKAN NAMA POLA: Bab 3 punya SEBELAS baris
-- untuk enam konsep — dua set penamaan berjalan berdampingan, dan teks
-- pattern set B (buatan admin) tidak bisa dipercaya karakter per karakter
-- (〜 U+301C vs ～ U+FF5E, ／ vs /); lihat catatan panjang di migrasi 145.
-- Karena arahan ini menerangkan DIALOGNYA — bukan nama polanya — tiap baris
-- dicocokkan lewat penanda unik di dalam example_dialog itu sendiri. Keenam
-- penanda di bawah dicek saling eksklusif terhadap keenam dialog 145.
--
-- TANPA NAMA TOKOH, DI ARAHAN MAUPUN DI PENANDA — ini dikoreksi user setelah
-- draf pertama: "Lah namanya udah bukan hadi tapi yamguchi". Draf pertama
-- menyebut nama tokoh dari dialog versi REPO (Hadi/Kevin/Yuto) dan memakai
-- 「たなかさん…」/「ユウトさん」 sebagai penanda, padahal nama tokoh di
-- produksi sudah diganti admin lewat editor 🎭 Dialog yang baru. Nama tokoh
-- adalah bagian dialog yang PALING gampang berubah — apalagi sekarang
-- menggantinya cuma beberapa klik — jadi arahan maupun penanda tidak boleh
-- bergantung padanya. Yang dipakai sekarang hanya struktur giliran dan
-- partikelnya (〜も vs 〜は, ね vs よ, dst): tetap konkret karena menunjuk
-- kalimat yang benar-benar terdengar, tapi tidak ikut basi kalau tokohnya
-- berganti nama. Kalau suatu saat menulis arahan lagi: jangan sebut nama
-- tokoh, sebut gilirannya.
-- Baris yang dialognya BUKAN salah satu dialog itu (mis. sudah ditulis ulang
-- admin) DILEWATI dengan NOTICE — arahan yang menyebut giliran yang sudah
-- tidak ada akan menyesatkan siswa, dan lebih baik kosong daripada
-- diam-diam salah.
--
-- CAKUPAN: envelope ditulis PER-PELAJARAN, dan directions-nya hanya memuat
-- baris grammar milik pelajaran itu sendiri (g.lesson_id = pelajaran itu).
-- Ini menyamai bunpouFlowScope() di routes/admin.js, supaya draft hasil
-- migrasi ini tidak pernah ditolak "grammarId di luar cakupan" kalau admin
-- membukanya lalu menekan Simpan/Publikasikan.
--
-- Idempotent: stempel editor/publishedBy memakai tanggal TETAP (bukan NOW())
-- supaya re-run menulis JSONB byte-identik.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_stamp        JSONB;
  v_objective    TEXT;
  v_arahan       JSONB;
  v_env          JSONB;
  v_bad          INT;
  v_lessons      INT := 0;
  v_rows         INT := 0;
  v_skipped      INT := 0;
  r              RECORD;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '149: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  -- Provenance jujur: ini bukan hasil ketikan seorang admin. Tanggal tetap
  -- (bukan NOW()) supaya re-run idempoten byte-per-byte.
  v_stamp := jsonb_build_object(
    'email', 'migration/149_bunpou_flow_bab3_companion.sql',
    'at',    '2026-09-17T00:00:00.000Z'
  );

  v_objective := 'Setelah bab ini kamu bisa memperkenalkan diri dan orang lain: menyebut nama, asal, dan pekerjaan dengan 〜です, menyangkal dengan 〜じゃありません, bertanya dengan 〜か, lalu merangkainya memakai も, の, serta partikel ね／よ.';

  -- Satu arahan per konsep. Tiap teks menunjuk giliran yang benar-benar ada
  -- di dialog 145 untuk konsep itu — kalau dialognya diganti, arahannya ikut
  -- harus ditulis ulang (itulah sebabnya pencocokan di bawah berbasis isi).
  v_arahan := $json${
  "kopula": "Hitung berapa kali わたしは muncul. Penutur pertama memakainya untuk nama dan asal, lalu langsung bilang がくせいです tanpa わたしは — lawan bicaranya pun menyebut namanya tanpa わたしは. Kalau topiknya sudah jelas, bagian 〜は boleh hilang; yang wajib tetap ada hanya です di akhir.",
  "negatif": "Ada dua jawaban yang diawali いいえ, dan dua-duanya berpola sama: 〜じゃありません lalu langsung disusul kalimat 〜です yang membetulkan. Perhatikan bahwa menyangkal tidak pernah berdiri sendiri di dialog ini — selalu ada jawaban benarnya sesudahnya.",
  "tanya": "Kalimat tanyanya sama persis dengan kalimat berita, cuma ditambah か di akhir: 〜です → 〜ですか. Lihat jawabannya — mengulang kata bendanya tanpa か. Di giliran terakhir pertanyaannya dibalikkan ke lawan bicara dengan pola yang sama.",
  "juga": "Dengarkan sampai giliran terakhir. Pertanyaannya memakai 〜も, tapi jawabannya berganti ke 〜は — begitu ternyata tidak sama, も tidak dipakai lagi. も hanya untuk hal yang memang berlaku sama.",
  "milik": "Ada tiga の di dialog ini, dan polanya selalu sama: kata sebelum の menerangkan kata sesudahnya — nama kampus/sekolah untuk がくせい, dan bidang yang diajarkan untuk せんせい.",
  "partikel": "Bandingkan ね dan よ. ね dipakai saat penutur merasa sudah tahu lalu minta persetujuan — dua giliran pertama memakainya untuk menebak. よ dipakai saat memberi kabar baru: jawaban 〜ですよ justru membetulkan tebakan yang salah."
}$json$;

  -- Pagar panjang, disamakan dengan validateCompanionEnvelope
  -- (bunpou-flow-service.js: OBJECTIVE_MAX 240, DIRECTION_MAX 300) supaya
  -- tidak ada draft hasil migrasi yang justru ditolak endpoint-nya sendiri
  -- begitu admin menekan Simpan.
  IF length(v_objective) > 240 THEN
    RAISE EXCEPTION '149: objective % karakter, melebihi batas 240.', length(v_objective);
  END IF;
  SELECT count(*) INTO v_bad FROM jsonb_each_text(v_arahan) WHERE length(value) > 300;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '149: % arahan melebihi batas 300 karakter.', v_bad;
  END IF;

  -- Baris Bab 3 yang punya dialog tapi dialognya tidak dikenali → lapor,
  -- jangan tebak. (Konvensi 135/136: satu deploy sekaligus mengisi & melapor.)
  FOR r IN
    SELECT g.pattern, g.example_dialog, coalesce(l.title, '(tidak tertaut)') AS lesson_title
      FROM module_grammar g
      LEFT JOIN lessons l ON l.id = g.lesson_id
     WHERE g.module_id = v_module_id
       AND coalesce(g.example_dialog, '') <> ''
       AND g.example_dialog NOT LIKE '%どうぞよろしくおねがいします%'
       AND g.example_dialog NOT LIKE '%オーストラリア%'
       AND g.example_dialog NOT LIKE '%おしごとはなんですか%'
       AND g.example_dialog NOT LIKE '%わたしもがくせい%'
       AND g.example_dialog NOT LIKE '%にほんごの%'
       AND g.example_dialog NOT LIKE '%ですよ%'
     ORDER BY g.sort_order ASC, g.created_at ASC
  LOOP
    v_skipped := v_skipped + 1;
    -- Cetak juga baris pertama dialognya. Sandbox tidak bisa melihat
    -- database produksi, jadi log deploy adalah satu-satunya cara tahu isi
    -- dialog yang sudah ditulis ulang admin — persis alur 135 → 136: pasang
    -- NOTICE dulu, baca log, baru tulis migrasi lanjutannya.
    RAISE NOTICE '149: pola "%" (pelajaran: %) dialognya tidak dikenali — arahan dilewati, bukan ditebak. Baris pertama: "%"',
      r.pattern, r.lesson_title, left(split_part(r.example_dialog, E'\n', 1), 60);
  END LOOP;

  FOR r IN
    WITH klasifikasi AS (
      SELECT g.id,
             g.lesson_id,
             CASE
               WHEN g.example_dialog LIKE '%どうぞよろしくおねがいします%' THEN 'kopula'
               WHEN g.example_dialog LIKE '%オーストラリア%'               THEN 'negatif'
               WHEN g.example_dialog LIKE '%おしごとはなんですか%'          THEN 'tanya'
               WHEN g.example_dialog LIKE '%わたしもがくせい%'             THEN 'juga'
               WHEN g.example_dialog LIKE '%にほんごの%'                   THEN 'milik'
               WHEN g.example_dialog LIKE '%ですよ%'                       THEN 'partikel'
               ELSE NULL
             END AS konsep
        FROM module_grammar g
       WHERE g.module_id = v_module_id
         AND g.lesson_id IS NOT NULL
         AND coalesce(g.example_dialog, '') <> ''
    )
    SELECT k.lesson_id,
           l.title AS lesson_title,
           l.type  AS lesson_type,
           count(*) AS n,
           jsonb_object_agg(k.id::text, v_arahan->>k.konsep) AS directions
      FROM klasifikasi k
      JOIN lessons l ON l.id = k.lesson_id
     WHERE k.konsep IS NOT NULL
     GROUP BY k.lesson_id, l.title, l.type
     ORDER BY count(*) DESC
  LOOP
    v_env := jsonb_build_object(
      'schemaVersion', 1,
      'objective',     v_objective,
      'directions',    r.directions,
      'editor',        v_stamp,
      'publishedBy',   v_stamp
    );

    UPDATE lessons
       SET bunpou_flow_draft     = v_env,
           bunpou_flow_published = v_env,
           updated_at            = NOW()
     WHERE id = r.lesson_id;

    v_lessons := v_lessons + 1;
    v_rows    := v_rows + r.n;
    RAISE NOTICE '149: pelajaran "%" (type=%) → % arahan terisi. lesson_id=% (pakai ini kalau mau menyalakan pilot).',
      r.lesson_title, r.lesson_type, r.n, r.lesson_id;
  END LOOP;

  IF v_lessons = 0 THEN
    RAISE NOTICE '149: tidak ada baris grammar Bab 3 yang punya lesson_id SEKALIGUS dialog yang dikenali — tidak ada companion yang ditulis. Cek dulu keterkaitan grammar→pelajaran (lihat peringatan yang sama di migrasi 145).';
  END IF;

  RAISE NOTICE '149: Bab 3 "%" — % pelajaran ditulis, % arahan total, % baris dilewati. Pilot TIDAK dinyalakan (app_settings tidak disentuh).',
    v_module_title, v_lessons, v_rows, v_skipped;
END $$;
