-- 151_bunpou_flow_bab3_dialog_checks.sql — isi soal PEMERIKSAAN MANDIRI
-- (Paket 2) untuk Bab 3: satu soal pemahaman dialog + satu soal pembanding
-- per pola.
--
-- KENAPA MIGRASI, BUKAN DIKETIK LEWAT ADMIN: konvensi yang user tetapkan
-- sendiri waktu tombol AI "Lengkapi contoh" dihapus dan diganti migrasi 126 —
-- konten siswa ditulis & direview sebagai diff. Editor "🧭 Pendamping Bunpou"
-- tetap jalan normal di atas hasilnya.
--
-- ATURAN YANG DIWARISI DARI MIGRASI 149, DAN INI YANG PALING MUDAH DILANGGAR:
-- **NAMA TOKOH TIDAK DIPAKAI DI MANA PUN** — tidak di teks soal, tidak di
-- opsi, tidak di penanda klasifikasi. Nama tokoh adalah bagian dialog yang
-- paling gampang berubah (mengganti ハディ→山口 sekarang cuma beberapa klik
-- lewat editor 🎭 Dialog), jadi soal yang menyebut nama otomatis basi begitu
-- admin mengganti tokoh. Tiap soal menunjuk GILIRAN-nya lewat kalimat yang
-- benar-benar terdengar atau lewat struktur partikelnya.
--
-- Berlaku juga untuk KALIMAT PEMBANDING: draf pertama memakai 「たなかさん」
-- sebagai subjek kalimat baru, dan pagar verifikasi menangkapnya — たなか
-- adalah tokoh di dialog Bab 3 (guru bahasa Jepang di dialog 〜の, guru di
-- dialog 〜も), jadi menyebutnya dokter di soal pembanding membingungkan
-- siswa yang baru saja mendengar dialognya. 「やまだ」 juga dibuang: nama
-- tokoh produksi bisa apa saja, jadi nama apa pun berisiko bentrok. Subjek
-- kalimat pembanding memakai わたし / あのひと — bebas nama, selamanya.
--
-- KLASIFIKASI: penanda unik DI DALAM `example_dialog`, sama persis dengan
-- migrasi 149 (Bab 3 punya SEBELAS baris untuk ENAM konsep — dua set
-- penamaan berdampingan, dan teks `pattern` set B buatan admin tidak bisa
-- dipercaya karakter per karakter: 〜 U+301C vs ～ U+FF5E, ／ vs /; itu
-- temuan migrasi 145). Baris yang dialognya sudah ditulis ulang admin
-- DILEWATI dengan NOTICE — soal pemahaman diturunkan dari naskah, jadi
-- memaksakannya ke dialog yang sudah diganti akan menghasilkan soal yang
-- jawabannya tidak ada di dialognya. Konvensi 135→136: laporkan lewat log
-- deploy, jangan menebak.
--
-- MERGE, BUKAN TIMPA: migrasi 149 sudah menulis objective + directions ke
-- envelope yang sama. `||` pada JSONB hanya mengganti kunci `dialogChecks`
-- dan membiarkan sisanya utuh — termasuk editan admin sesudahnya.
--
-- KELAYAKAN (bunpou-flow-service.js#dialogCheckAvailability): pemeriksaan
-- baru disajikan kalau KEDUA soal ada, sah, dan berasal dari KELUARGA yang
-- berbeda — family ID di-hash dari opsi terurut + jawaban benar, jadi soal
-- pembanding yang cuma memindah posisi opsi akan ditolak. Di sini opsi
-- pemahaman selalu berbahasa Indonesia dan opsi pembanding selalu kalimat
-- Jepang, jadi keduanya tidak mungkin sekeluarga.
--
-- Idempotent: UPDATE tanpa syarat, re-run menulis nilai yang sama.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_soal         JSONB;
  v_stamp        TIMESTAMPTZ := '2026-09-17T00:00:00.000Z';
  v_lessons      INT := 0;
  v_checks       INT := 0;
  v_skipped      INT := 0;
  v_bad          INT;
  r              RECORD;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '151: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  -- comprehension = dari NASKAH dialog pelajaran ini.
  -- comparison    = pola yang SAMA di kalimat/situasi LAIN (bukan kalimat
  --                 yang ada di dialog, dan bukan opsi yang sama diacak).
  v_soal := $json${
  "kopula": {
    "comprehension": {
      "prompt": "Orang yang mengucapkan 「どうぞよろしくおねがいします」 menyebut pekerjaannya sebagai apa?",
      "options": ["Insinyur", "Pelajar", "Guru"],
      "correctIndex": 0,
      "explanation": "Di giliran terakhirnya ia berkata 「わたしはエンジニアです」. Pola 〜は〜です dipakai untuk menyatakan identitas: apa/siapa sesuatu itu."
    },
    "comparison": {
      "prompt": "Mana kalimat yang benar untuk mengatakan bahwa seseorang adalah dokter?",
      "options": ["あのひとは いしゃです", "あのひとを いしゃです", "あのひとに いしゃです"],
      "correctIndex": 0,
      "explanation": "Yang menjadi topik kalimat ditandai は. Partikel を menandai objek dan に menandai tujuan, jadi keduanya tidak bisa dipakai di sini."
    }
  },
  "negatif": {
    "comprehension": {
      "prompt": "Setelah menyangkal sebagai orang Amerika, ia mengaku berasal dari negara mana?",
      "options": ["Australia", "Amerika", "Indonesia"],
      "correctIndex": 0,
      "explanation": "Ia berkata 「アメリカじんじゃありません。オーストラリアじんです」 — setelah menyangkal, ia selalu menyebutkan yang benar."
    },
    "comparison": {
      "prompt": "Mana kalimat yang benar untuk mengatakan 「saya bukan karyawan」?",
      "options": ["わたしは かいしゃいんじゃありません", "わたしは かいしゃいんくないです", "わたしは かいしゃいんじゃないでした"],
      "correctIndex": 0,
      "explanation": "Bentuk negatif dari 〜です adalah 〜じゃありません. Akhiran 〜くない dipakai untuk kata sifat い, bukan kata benda."
    }
  },
  "tanya": {
    "comprehension": {
      "prompt": "Di akhir dialog, orang yang tadi ditanya balik bertanya. Apa yang ia tanyakan?",
      "options": ["Apakah lawan bicaranya seorang pelajar", "Berapa umur lawan bicaranya", "Di mana lawan bicaranya tinggal"],
      "correctIndex": 0,
      "explanation": "Ia menutup dengan 「〜さんはがくせいですか」. Menambahkan か di akhir kalimat mengubah pernyataan menjadi pertanyaan."
    },
    "comparison": {
      "prompt": "Mana kalimat yang benar untuk menanyakan 「apakah dia orang Jepang?」",
      "options": ["あのひとは にほんじんですか", "あのひとは にほんじんかです", "あのひとは ですか にほんじん"],
      "correctIndex": 0,
      "explanation": "か diletakkan di AKHIR kalimat, sesudah です — bukan disisipkan di tengah."
    }
  },
  "juga": {
    "comprehension": {
      "prompt": "Pertanyaan terakhir memakai 〜も, tetapi jawabannya memakai 〜は. Mengapa?",
      "options": ["Karena jawabannya ternyata tidak sama", "Karena も tidak boleh dipakai dua kali", "Karena yang menjawab lupa memakai も"],
      "correctIndex": 0,
      "explanation": "も dipakai ketika hal yang sama juga berlaku. Begitu jawabannya berbeda, も tidak dipakai lagi dan kembali ke は."
    },
    "comparison": {
      "prompt": "Teman Anda seorang pelajar, dan Anda juga pelajar. Mana kalimat yang benar?",
      "options": ["わたしも がくせいです", "わたしは がくせいも です", "わたしも がくせいも です"],
      "correctIndex": 0,
      "explanation": "も menggantikan posisi は, yaitu menempel pada orang yang keadaannya sama — bukan pada kata setelahnya."
    }
  },
  "milik": {
    "comprehension": {
      "prompt": "Salah satu orang mengaku mahasiswa. Dari mana?",
      "options": ["Universitas Sakura", "Sekolah bahasa Jepang", "Universitas Tokyo"],
      "correctIndex": 0,
      "explanation": "Ia berkata 「さくらだいがくのがくせいです」. Lawan bicaranya yang menyebut sekolah bahasa Jepang, jadi simak siapa yang berbicara."
    },
    "comparison": {
      "prompt": "Mana susunan yang benar untuk 「buku bahasa Jepang」?",
      "options": ["にほんごの ほん", "ほんの にほんご", "にほんご ほんの"],
      "correctIndex": 0,
      "explanation": "Kata yang menerangkan berada SEBELUM の, dan kata yang diterangkan sesudahnya. 「ほんのにほんご」 berarti 「bahasa Jepang milik buku」."
    }
  },
  "partikel": {
    "comprehension": {
      "prompt": "Ada giliran yang memakai 〜よ. Apa yang sedang dilakukan orang itu?",
      "options": ["Memberi tahu hal yang belum diketahui lawan bicara", "Meminta persetujuan lawan bicara", "Mengulang yang baru saja didengarnya"],
      "correctIndex": 0,
      "explanation": "Lawan bicaranya menyangka ia pelajar, lalu ia meluruskan dengan 「エンジニアですよ」. よ dipakai saat menyampaikan informasi baru."
    },
    "comparison": {
      "prompt": "Cuaca hari ini bagus dan Anda ingin lawan bicara ikut menyetujui. Mana yang paling tepat?",
      "options": ["いいてんきですね", "いいてんきですよ", "いいてんきですか"],
      "correctIndex": 0,
      "explanation": "ね mengajak lawan bicara menyetujui sesuatu yang sama-sama dirasakan. よ memberi tahu, dan か bertanya."
    }
  }
}$json$;

  -- Pagar isi: dijalankan atas v_soal itu sendiri, jadi salah ketik ketahuan
  -- sebelum satu baris pun tersentuh.
  SELECT count(*) INTO v_bad
    FROM jsonb_each(v_soal) AS konsep(k, v),
         LATERAL (VALUES ('comprehension'), ('comparison')) AS sisi(nama),
         LATERAL (SELECT v -> sisi.nama AS q) AS soal
   WHERE soal.q IS NULL
      OR jsonb_array_length(soal.q -> 'options') NOT BETWEEN 3 AND 4
      OR (soal.q ->> 'correctIndex')::int NOT BETWEEN 0 AND jsonb_array_length(soal.q -> 'options') - 1
      OR length(soal.q ->> 'prompt') > 300
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(soal.q -> 'options') o WHERE length(o) > 160)
      OR (SELECT count(DISTINCT o) FROM jsonb_array_elements_text(soal.q -> 'options') o)
         <> jsonb_array_length(soal.q -> 'options');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '151: % soal melanggar pagar bentuk (jumlah opsi, indeks jawaban, panjang, atau opsi kembar).', v_bad;
  END IF;

  -- Opsi pemahaman (Indonesia) dan opsi pembanding (Jepang) tidak boleh
  -- beririsan sama sekali — kalau beririsan, keduanya berisiko dihitung satu
  -- keluarga dan pemeriksaannya tidak akan pernah disajikan.
  SELECT count(*) INTO v_bad
    FROM jsonb_each(v_soal) AS konsep(k, v)
   WHERE EXISTS (
     SELECT 1
       FROM jsonb_array_elements_text(v -> 'comprehension' -> 'options') a
       JOIN jsonb_array_elements_text(v -> 'comparison' -> 'options') b ON a = b
   );
  IF v_bad > 0 THEN
    RAISE EXCEPTION '151: % konsep punya opsi yang sama di soal pemahaman dan pembanding — pembandingnya akan dianggap terlalu dekat.', v_bad;
  END IF;

  FOR r IN
    WITH klasifikasi AS (
      SELECT g.id, g.lesson_id, g.pattern,
             left(split_part(g.example_dialog, E'\n', 1), 60) AS dialog_awal,
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
    )
    SELECT k.konsep, k.pattern, k.dialog_awal, k.lesson_id, k.id
      FROM klasifikasi k
     WHERE k.konsep IS NULL
     ORDER BY k.pattern
  LOOP
    v_skipped := v_skipped + 1;
    RAISE NOTICE '151: pola "%" dilewati — dialognya tidak dikenali. Baris pertama dialog: "%"',
      r.pattern, coalesce(r.dialog_awal, '(kosong)');
  END LOOP;

  FOR r IN
    WITH klasifikasi AS (
      SELECT g.id, g.lesson_id,
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
    )
    SELECT k.lesson_id, l.title AS lesson_title, count(*) AS n,
           jsonb_object_agg(k.id::text, v_soal -> k.konsep) AS checks
      FROM klasifikasi k
      JOIN lessons l ON l.id = k.lesson_id
     WHERE k.konsep IS NOT NULL
     GROUP BY k.lesson_id, l.title
  LOOP
    UPDATE lessons
       SET bunpou_flow_draft = coalesce(bunpou_flow_draft, jsonb_build_object('schemaVersion', 1))
             || jsonb_build_object(
                  'dialogChecks', r.checks,
                  'editor', jsonb_build_object('email', 'migration/151_bunpou_flow_bab3_dialog_checks.sql', 'at', to_char(v_stamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                ),
           bunpou_flow_published = coalesce(bunpou_flow_published, jsonb_build_object('schemaVersion', 1))
             || jsonb_build_object(
                  'dialogChecks', r.checks,
                  'publishedBy', jsonb_build_object('email', 'migration/151_bunpou_flow_bab3_dialog_checks.sql', 'at', to_char(v_stamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                ),
           updated_at = NOW()
     WHERE id = r.lesson_id;

    v_lessons := v_lessons + 1;
    v_checks := v_checks + r.n;
    RAISE NOTICE '151: pelajaran "%" → % pemeriksaan terisi. lesson_id=%.',
      r.lesson_title, r.n, r.lesson_id;
  END LOOP;

  IF v_lessons = 0 THEN
    RAISE NOTICE '151: tidak ada baris grammar Bab 3 yang punya lesson_id SEKALIGUS dialog yang dikenali — tidak ada pemeriksaan yang ditulis.';
  END IF;

  RAISE NOTICE '151: Bab 3 "%" — % pelajaran ditulis, % pemeriksaan total, % baris dilewati. Pilot TIDAK diubah (app_settings tidak disentuh).',
    v_module_title, v_lessons, v_checks, v_skipped;
END $$;
