-- 040_assignment_bab2_katakana.sql — Assignment Bab 2: Tes Membaca Katakana.
--
-- Kembaran migration 039 (hiragana) untuk katakana: 60 soal, menguji
-- kemampuan MEMBACA/DEKODING, arti kata tidak diuji. Struktur 8 bagian:
--   Bagian A (12) kana dasar (pasangan mirip シ/ツ, ソ/ン, ク/ワ, ス/ヌ, ナ/メ)
--   Bagian B  (8) dakuten & handakuten           → section_number 2
--   Bagian C  (7) youon (ャ ュ ョ kecil)          → section_number 3
--   Bagian D  (7) sokuon (ッ kecil)               → section_number 4
--   Bagian E  (6) chōonpu (ー)                    → section_number 5
--   Bagian F (10) gabungan khas katakana          → section_number 6
--   Bagian G  (4) kata tanpa arti                 → section_number 7
--   Bagian H  (6) kata serapan panjang            → section_number 8
--
-- BEDA DARI VERSI HIRAGANA (disengaja, karena bahasanya beda):
-- - Bagian E menguji ー (chōonpu), bukan おう/えい/とお. Aturannya: ー mengulang
--   vokal sebelumnya → コーヒー = koohii, ケーキ = keeki.
-- - Bagian F tidak ada padanannya di tes hiragana: gabungan yang cuma dipakai
--   katakana untuk bunyi asing (ファ フィ フェ フォ, ティ, ディ, チェ, シェ,
--   ウェ, ヴ). Ini sumber salah-baca yang tidak akan pernah muncul di hiragana,
--   jadi diuji sendiri.
-- - Bagian H bukan kalimat berpartikel. Kalimat utuh dalam katakana tidak
--   wajar di bahasa Jepang; padanan "soal terberat"-nya adalah kata serapan
--   panjang yang menumpuk ッ + ー + huruf kecil sekaligus (チョコレート,
--   コンピューター, クリスマスツリー). Partikel は/へ/を tidak muncul di
--   katakana, jadi trap-nya diganti trap yang relevan.
-- - ン tetap ditulis n walau di depan b/p (ハンバーガー = hanbaagaa), sejalan
--   dengan aturan "tulis persis sesuai kana" di 039 (さんぽ = sanpo).
--
-- Sama seperti 039: pilihan ganda (engine menilai lewat quiz_options; teks
-- bebas belum didukung end-to-end), 3 pengecoh per soal = salah-baca khas.
-- question_category 'custom' supaya urutan soal ikut sort_order dan labelnya
-- "Soal N". Passing 80% (48/60), semua 60 soal per attempt, cooldown 12 jam.
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus lalu
-- di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  -- Bab 2 = modul KEDUA kelas N5 menurut sort_order (urutan yang sama dengan
  -- daftar Bab di admin). Sengaja pakai posisi, bukan slug: nama/slug modul
  -- Bab 2 beda-beda antar environment. Kalau ternyata nyasar, pelajaran bisa
  -- dipindah lewat admin tanpa migrasi baru.
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-2-katakana';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 1 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '040: modul Bab 2 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  RAISE NOTICE '040: seed Assignment Bab 2 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 2 — Tes Membaca Katakana', 'quiz',
    E'Tes membaca katakana: 60 soal, 8 bagian, lulus di 80% (48/60).\n\nAturan romaji yang dipakai di semua pilihan jawaban: シ=shi, ツ=tsu, チ=chi, フ=fu, ジ=ji. Tanda ー mengulang vokal sebelumnya (コーヒー=koohii, ケーキ=keeki). ッ menggandakan konsonan berikutnya (ベッド=beddo). ン selalu ditulis n, termasuk di depan b dan p (ハンバーガー=hanbaagaa). Gabungan khas katakana untuk bunyi asing: ファ=fa, フィ=fi, フェ=fe, フォ=fo, ティ=ti, ディ=di, チェ=che, シェ=she, ウェ=we, ヴァ=va.\n\nYang diuji cuma kemampuan mendekode huruf — arti kata tidak diuji. Titik paling rawan di katakana adalah pasangan yang bentuknya mirip: シ vs ツ, ソ vs ン, ク vs ワ, ス vs ヌ, ナ vs メ, ル vs レ.',
    20, 100, 80, NULL, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes,
    passing_score_pct = EXCLUDED.passing_score_pct,
    questions_per_attempt = EXCLUDED.questions_per_attempt,
    cooldown_hours = EXCLUDED.cooldown_hours,
    updated_at = NOW()
  RETURNING id INTO v_lesson_id;

  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(num, label, instruction) AS (VALUES
    (1, 'Bagian A — Kana Dasar',
        'Baca kata berikut, lalu pilih bacaan romaji yang tepat. Hati-hati pasangan yang bentuknya mirip: シ vs ツ, ソ vs ン, ク vs ワ, ス vs ヌ, ナ vs メ, ル vs レ.'),
    (2, 'Bagian B — Dakuten & Handakuten',
        'Perhatikan tanda kecil di kanan atas huruf: ゛(dakuten) dan ゜(handakuten). ハ → バ → パ.'),
    (3, 'Bagian C — Yōon (ャ ュ ョ kecil)',
        'Huruf kecil ャ ュ ョ menyatu dengan huruf sebelumnya: シャ = sha, bukan shiya.'),
    (4, 'Bagian D — Sokuon (ッ kecil)',
        'ッ kecil tidak dibaca tsu. Ia menggandakan konsonan berikutnya: ベッド = beddo.'),
    (5, 'Bagian E — Chōonpu (ー)',
        'Tanda ー memanjangkan vokal sebelumnya, ditulis dengan mengulang vokal itu: コーヒー = koohii, ケーキ = keeki. Jangan dihilangkan, dan jangan diganti u atau i.'),
    (6, 'Bagian F — Gabungan Khas Katakana',
        'Gabungan ini cuma ada di katakana, untuk menulis bunyi asing yang tidak dimiliki hiragana: ファ=fa, フィ=fi, フェ=fe, フォ=fo, ティ=ti, ディ=di, チェ=che, シェ=she, ウェ=we, ヴァ=va. Huruf kecil ァ ィ ェ ォ menyatu dengan huruf sebelumnya, bukan dibaca terpisah.'),
    (7, 'Bagian G — Kata Tanpa Arti',
        'Kata di bawah ini bukan kata Jepang. Tetap baca huruf per huruf dan pilih bunyinya.'),
    (8, 'Bagian H — Kata Serapan Panjang',
        'Kata-kata ini menumpuk ッ, ー, dan huruf kecil sekaligus. Baca pelan-pelan dari kiri ke kanan, jangan tebak dari bentuk kata.')
  ), q(no, sect_num, question, explanation) AS (VALUES
    -- Bagian A
    (1,  1, 'カメラ', 'カ=ka (bukan ワ=wa), メ=me (bukan ネ=ne), ラ=ra (bukan ル=ru).'),
    (2,  1, 'テニス', 'ニ=ni (bukan ミ=mi), ス=su (bukan ソ=so). Tanpa dakuten, jadi su bukan zu.'),
    (3,  1, 'ミルク', 'ミ=mi (bukan シ=shi), ル=ru (bukan レ=re), ク=ku (bukan ワ=wa).'),
    (4,  1, 'シネマ', 'シ=shi — goresannya miring ke ATAS, beda dengan ツ=tsu yang dari atas. マ=ma, bukan ム=mu.'),
    (5,  1, 'ツナ', 'ツ=tsu — pasangan mirip シ=shi dan ス=su. ナ=na, bukan メ=me.'),
    (6,  1, 'ソフト', 'ソ=so — dua goresan dari ATAS, beda dengan ン=n yang dari BAWAH. フ ditulis fu, bukan hu.'),
    (7,  1, 'ワイン', 'ワ=wa (bukan ク=ku), ン=n — bedakan dari ソ=so dan ノ=no.'),
    (8,  1, 'ナイフ', 'ナ=na (bukan メ=me), フ ditulis fu bukan hu, dan tanpa dakuten jadi fu bukan bu.'),
    (9,  1, 'メロン', 'メ=me (bukan ナ=na), ン=n di akhir — bukan ソ (so) atau ノ (no).'),
    (10, 1, 'ホテル', 'ホ=ho (bukan オ=o), ル=ru (bukan レ=re), テ tanpa dakuten = te.'),
    (11, 1, 'クラス', 'ク=ku — bedakan dari ワ (wa) dan タ (ta). ス=su, bukan ヌ=nu.'),
    (12, 1, 'スイス', 'ス=su — mirip ヌ (nu). Dua-duanya su, dan tidak ada dakuten.'),
    -- Bagian B
    (13, 2, 'ドイツ', 'ド = ト + dakuten = do. ツ ditulis tsu, bukan tu, dan bukan シ (shi).'),
    (14, 2, 'バナナ', 'バ = ハ + dakuten = ba. Kalau tandanya ゜ baru dibaca pa. ナ=na, bukan マ=ma.'),
    (15, 2, 'ガラス', 'ガ = カ + dakuten = ga. Perhatikan vokalnya: ガ (ga), bukan グ (gu). ス=su, bukan ヌ=nu.'),
    (16, 2, 'ズボン', 'ズ = ス + dakuten = zu, ボ = ホ + dakuten = bo. Kalau ゜ baru po.'),
    (17, 2, 'パン', 'パ = ハ + handakuten ゜ = pa. Dengan ゛jadi ba, tanpa tanda jadi ha. ン=n, bukan ソ=so.'),
    (18, 2, 'ピンク', 'ピ = ヒ + handakuten = pi (bukan bi). ク=ku, bukan ワ=wa.'),
    (19, 2, 'プレゼント', 'プ=pu (handakuten) dan ゼ=ze (dakuten). ト tanpa dakuten = to.'),
    (20, 2, 'デザイン', 'デ=de dan ザ=za, dua-duanya pakai dakuten. ン=n, bukan ソ=so.'),
    -- Bagian C
    (21, 3, 'シャツ', 'シャ = sha (ャ kecil menyatu, bukan shiya). ツ ditulis tsu, bukan tu.'),
    (22, 3, 'ジャム', 'ジャ = ja (ジ pakai dakuten + ャ kecil). ム=mu, bukan マ=ma.'),
    (23, 3, 'チョコ', 'チョ = cho. チ dibaca chi, bukan shi, dan ッ tidak ada di sini.'),
    (24, 3, 'キャベツ', 'キャ = kya, ベ=be (dakuten), ツ = tsu bukan tu.'),
    (25, 3, 'チャンス', 'チャ = cha (bukan sha). ス=su, bukan ソ=so.'),
    (26, 3, 'キャンプ', 'キャ = kya, ン = n, プ = pu (handakuten, bukan bu).'),
    (27, 3, 'ジャズ', 'ジャ = ja dan ズ = zu — dua-duanya pakai dakuten.'),
    -- Bagian D
    (28, 4, 'ベッド', 'ッ menggandakan konsonan berikutnya: ベ + ッ + ド = beddo, bukan betsudo. ベ pakai dakuten.'),
    (29, 4, 'ネット', 'ッ di depan ト menggandakan t → netto. Tanpa ッ baru neto.'),
    (30, 4, 'カップ', 'ッ + プ = ppu → kappu. プ pakai handakuten, jadi pu bukan bu.'),
    (31, 4, 'ポケット', 'ポ=po (handakuten) dan ッ + ト = tto → poketto.'),
    (32, 4, 'バッグ', 'バ=ba dan グ=gu (dua dakuten), ッ menggandakan g → baggu.'),
    (33, 4, 'スリッパ', 'ッ + パ = ppa → surippa. ス tanpa dakuten = su.'),
    (34, 4, 'ラケット', 'ッ ada di antara ケ dan ト → raketto. Posisinya jangan digeser.'),
    -- Bagian E
    (35, 5, 'コーヒー', 'ー mengulang vokal sebelumnya: コー = koo, ヒー = hii → koohii. Bukan kou.'),
    (36, 5, 'ケーキ', 'ケー = kee. Panjangnya tidak boleh hilang, dan bukan kei.'),
    (37, 5, 'ノート', 'ノー = noo → nooto. Bukan nou, bukan noto.'),
    (38, 5, 'スーパー', 'Ada DUA ー: スー = suu dan パー = paa → suupaa. パ pakai handakuten.'),
    (39, 5, 'テーブル', 'テー = tee, lalu ブ=bu (dakuten) → teeburu.'),
    (40, 5, 'カレー', 'レー = ree → karee. Tanpa ー cuma kare.'),
    -- Bagian F
    (41, 6, 'ソファ', 'ファ = fa (ァ kecil menyatu dengan フ), bukan fua. フ tanpa dakuten.'),
    (42, 6, 'フィルム', 'フィ = fi, bukan fui. ル=ru, bukan レ=re.'),
    (43, 6, 'カフェ', 'フェ = fe, bukan fue. Tidak ada dakuten, jadi bukan be.'),
    (44, 6, 'フォーク', 'フォ = fo, lalu ー memanjangkannya → fooku. フ ditulis f, bukan h.'),
    (45, 6, 'パーティー', 'ティ = ti — bunyi yang tidak ada di hiragana. Bukan tei, bukan chi.'),
    (46, 6, 'ディスク', 'ディ = di (ティ + dakuten). Bukan dei, bukan ji.'),
    (47, 6, 'チェック', 'チェ = che, lalu ッ menggandakan k → chekku.'),
    (48, 6, 'シェフ', 'シェ = she (bukan chi/che), フ ditulis fu bukan hu.'),
    (49, 6, 'ウェブ', 'ウェ = we, bukan ue. ブ=bu pakai dakuten.'),
    (50, 6, 'ヴァイオリン', 'ヴ = v (ウ + dakuten), jadi ヴァ = va — bunyi yang tidak dimiliki hiragana. ン=n, bukan ソ=so.'),
    -- Bagian G
    (51, 7, 'ヌメロ', 'ヌ=nu, メ=me, ロ=ro. Bukan kata Jepang — ヌ mirip ス (su) dan メ mirip ナ (na).'),
    (52, 7, 'ヘズポ', 'ズ=zu (dakuten) dan ポ=po (handakuten). Perhatikan bedanya tanda ゛dan ゜.'),
    (53, 7, 'トッシャ', 'ッ + シャ (sha) = ssha → tossha.'),
    (54, 7, 'ケッポー', 'ッ menggandakan p dan ー memanjangkan o → keppoo. Dua-duanya harus kebaca.'),
    -- Bagian H
    (55, 8, 'チョコレート', 'チョ = cho dan レート = reeto → chokoreeto. ー-nya jangan hilang.'),
    (56, 8, 'ハンバーガー', 'Dua ー: バー = baa dan ガー = gaa → hanbaagaa. ン tetap ditulis n walau di depan b.'),
    (57, 8, 'インターネット', 'ター = taa dan ッ + ト = tto → intaanetto. ン=n, bukan ソ=so.'),
    (58, 8, 'コンピューター', 'ピュ = pyu + ー = pyuu, lalu ター = taa → konpyuutaa. ピ pakai handakuten.'),
    (59, 8, 'サッカーチーム', 'ッ (gandakan k) + カー (kaa) + チー (chii) → sakkaachiimu. Tiga hal sekaligus.'),
    (60, 8, 'クリスマスツリー', 'ク=ku (bukan ワ=wa), ツ=tsu (bukan シ=shi), リー = rii → kurisumasutsurii.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', 'custom',
         s.num, s.label, s.instruction, q.explanation, q.no
    FROM q JOIN sect s ON s.num = q.sect_num;

  -- Baris pertama tiap soal = jawaban benar; urutan tampil diacak frontend
  -- tiap attempt (transformQuestionFromApi).
  WITH o(qno, ord, option_text, ok) AS (VALUES
    -- Bagian A
    (1,  0, 'kamera', TRUE),  (1,  1, 'wamera', FALSE),  (1,  2, 'kanera', FALSE),  (1,  3, 'kameru', FALSE),
    (2,  0, 'tenisu', TRUE),  (2,  1, 'teniso', FALSE),  (2,  2, 'temisu', FALSE),  (2,  3, 'tenizu', FALSE),
    (3,  0, 'miruku', TRUE),  (3,  1, 'mireku', FALSE),  (3,  2, 'miruwa', FALSE),  (3,  3, 'shiruku', FALSE),
    (4,  0, 'shinema', TRUE), (4,  1, 'tsunema', FALSE), (4,  2, 'sonema', FALSE),  (4,  3, 'shinemu', FALSE),
    (5,  0, 'tsuna', TRUE),   (5,  1, 'shina', FALSE),   (5,  2, 'tsume', FALSE),   (5,  3, 'suna', FALSE),
    (6,  0, 'sofuto', TRUE),  (6,  1, 'nofuto', FALSE),  (6,  2, 'sohuto', FALSE),  (6,  3, 'sofudo', FALSE),
    (7,  0, 'wain', TRUE),    (7,  1, 'waiso', FALSE),   (7,  2, 'kuin', FALSE),    (7,  3, 'waino', FALSE),
    (8,  0, 'naifu', TRUE),   (8,  1, 'meifu', FALSE),   (8,  2, 'naihu', FALSE),   (8,  3, 'naibu', FALSE),
    (9,  0, 'meron', TRUE),   (9,  1, 'meroso', FALSE),  (9,  2, 'naron', FALSE),   (9,  3, 'merono', FALSE),
    (10, 0, 'hoteru', TRUE),  (10, 1, 'hotere', FALSE),  (10, 2, 'oteru', FALSE),   (10, 3, 'hoderu', FALSE),
    (11, 0, 'kurasu', TRUE),  (11, 1, 'warasu', FALSE),  (11, 2, 'kuranu', FALSE),  (11, 3, 'tarasu', FALSE),
    (12, 0, 'suisu', TRUE),   (12, 1, 'nuisu', FALSE),   (12, 2, 'suizu', FALSE),   (12, 3, 'suiso', FALSE),
    -- Bagian B
    (13, 0, 'doitsu', TRUE),     (13, 1, 'toitsu', FALSE),     (13, 2, 'doishi', FALSE),     (13, 3, 'doitu', FALSE),
    (14, 0, 'banana', TRUE),     (14, 1, 'hanana', FALSE),     (14, 2, 'panana', FALSE),     (14, 3, 'banama', FALSE),
    (15, 0, 'garasu', TRUE),     (15, 1, 'karasu', FALSE),     (15, 2, 'gurasu', FALSE),     (15, 3, 'garanu', FALSE),
    (16, 0, 'zubon', TRUE),      (16, 1, 'subon', FALSE),      (16, 2, 'zuhon', FALSE),      (16, 3, 'zupon', FALSE),
    (17, 0, 'pan', TRUE),        (17, 1, 'ban', FALSE),        (17, 2, 'han', FALSE),        (17, 3, 'paso', FALSE),
    (18, 0, 'pinku', TRUE),      (18, 1, 'binku', FALSE),      (18, 2, 'hinku', FALSE),      (18, 3, 'pinwa', FALSE),
    (19, 0, 'purezento', TRUE),  (19, 1, 'puresento', FALSE),  (19, 2, 'burezento', FALSE),  (19, 3, 'purezendo', FALSE),
    (20, 0, 'dezain', TRUE),     (20, 1, 'tesain', FALSE),     (20, 2, 'desain', FALSE),     (20, 3, 'dezaiso', FALSE),
    -- Bagian C
    (21, 0, 'shatsu', TRUE),   (21, 1, 'shiyatsu', FALSE),  (21, 2, 'satsu', FALSE),    (21, 3, 'shatu', FALSE),
    (22, 0, 'jamu', TRUE),     (22, 1, 'jiyamu', FALSE),    (22, 2, 'shamu', FALSE),    (22, 3, 'jama', FALSE),
    (23, 0, 'choko', TRUE),    (23, 1, 'chiyoko', FALSE),   (23, 2, 'shoko', FALSE),    (23, 3, 'chokko', FALSE),
    (24, 0, 'kyabetsu', TRUE), (24, 1, 'kiyabetsu', FALSE), (24, 2, 'kyahetsu', FALSE), (24, 3, 'kyabetu', FALSE),
    (25, 0, 'chansu', TRUE),   (25, 1, 'chiyansu', FALSE),  (25, 2, 'shansu', FALSE),   (25, 3, 'chanso', FALSE),
    (26, 0, 'kyanpu', TRUE),   (26, 1, 'kiyanpu', FALSE),   (26, 2, 'kyanbu', FALSE),   (26, 3, 'kyanhu', FALSE),
    (27, 0, 'jazu', TRUE),     (27, 1, 'jiyazu', FALSE),    (27, 2, 'shazu', FALSE),    (27, 3, 'jasu', FALSE),
    -- Bagian D
    (28, 0, 'beddo', TRUE),    (28, 1, 'betsudo', FALSE),   (28, 2, 'bedo', FALSE),     (28, 3, 'heddo', FALSE),
    (29, 0, 'netto', TRUE),    (29, 1, 'netsuto', FALSE),   (29, 2, 'neto', FALSE),     (29, 3, 'neddo', FALSE),
    (30, 0, 'kappu', TRUE),    (30, 1, 'katsupu', FALSE),   (30, 2, 'kapu', FALSE),     (30, 3, 'kabbu', FALSE),
    (31, 0, 'poketto', TRUE),  (31, 1, 'poketsuto', FALSE), (31, 2, 'poketo', FALSE),   (31, 3, 'boketto', FALSE),
    (32, 0, 'baggu', TRUE),    (32, 1, 'batsugu', FALSE),   (32, 2, 'bagu', FALSE),     (32, 3, 'hakku', FALSE),
    (33, 0, 'surippa', TRUE),  (33, 1, 'suritsupa', FALSE), (33, 2, 'suripa', FALSE),   (33, 3, 'zurippa', FALSE),
    (34, 0, 'raketto', TRUE),  (34, 1, 'raketsuto', FALSE), (34, 2, 'raketo', FALSE),   (34, 3, 'rakketo', FALSE),
    -- Bagian E
    (35, 0, 'koohii', TRUE),   (35, 1, 'kohi', FALSE),      (35, 2, 'kouhii', FALSE),   (35, 3, 'goohii', FALSE),
    (36, 0, 'keeki', TRUE),    (36, 1, 'keki', FALSE),      (36, 2, 'keiki', FALSE),    (36, 3, 'geeki', FALSE),
    (37, 0, 'nooto', TRUE),    (37, 1, 'noto', FALSE),      (37, 2, 'nouto', FALSE),    (37, 3, 'noodo', FALSE),
    (38, 0, 'suupaa', TRUE),   (38, 1, 'supa', FALSE),      (38, 2, 'suupa', FALSE),    (38, 3, 'suubaa', FALSE),
    (39, 0, 'teeburu', TRUE),  (39, 1, 'teburu', FALSE),    (39, 2, 'teiburu', FALSE),  (39, 3, 'teepuru', FALSE),
    (40, 0, 'karee', TRUE),    (40, 1, 'kare', FALSE),      (40, 2, 'karei', FALSE),    (40, 3, 'garee', FALSE),
    -- Bagian F
    (41, 0, 'sofa', TRUE),      (41, 1, 'sofua', FALSE),      (41, 2, 'sohua', FALSE),      (41, 3, 'zofa', FALSE),
    (42, 0, 'firumu', TRUE),    (42, 1, 'fuirumu', FALSE),    (42, 2, 'hirumu', FALSE),     (42, 3, 'firemu', FALSE),
    (43, 0, 'kafe', TRUE),      (43, 1, 'kafue', FALSE),      (43, 2, 'kahue', FALSE),      (43, 3, 'kabe', FALSE),
    (44, 0, 'fooku', TRUE),     (44, 1, 'fuooku', FALSE),     (44, 2, 'foku', FALSE),       (44, 3, 'hooku', FALSE),
    (45, 0, 'paatii', TRUE),    (45, 1, 'paatei', FALSE),     (45, 2, 'paachii', FALSE),    (45, 3, 'baatii', FALSE),
    (46, 0, 'disuku', TRUE),    (46, 1, 'deisuku', FALSE),    (46, 2, 'jisuku', FALSE),     (46, 3, 'tisuku', FALSE),
    (47, 0, 'chekku', TRUE),    (47, 1, 'chiekku', FALSE),    (47, 2, 'cheku', FALSE),      (47, 3, 'tsuekku', FALSE),
    (48, 0, 'shefu', TRUE),     (48, 1, 'shiefu', FALSE),     (48, 2, 'shehu', FALSE),      (48, 3, 'chefu', FALSE),
    (49, 0, 'webu', TRUE),      (49, 1, 'uebu', FALSE),       (49, 2, 'wehu', FALSE),       (49, 3, 'webo', FALSE),
    (50, 0, 'vaiorin', TRUE),   (50, 1, 'baiorin', FALSE),    (50, 2, 'vuaiorin', FALSE),   (50, 3, 'vaioriso', FALSE),
    -- Bagian G
    (51, 0, 'numero', TRUE),   (51, 1, 'menero', FALSE),    (51, 2, 'sumero', FALSE),   (51, 3, 'numeru', FALSE),
    (52, 0, 'hezupo', TRUE),   (52, 1, 'hesupo', FALSE),    (52, 2, 'hezubo', FALSE),   (52, 3, 'hezupa', FALSE),
    (53, 0, 'tossha', TRUE),   (53, 1, 'totsusha', FALSE),  (53, 2, 'tosha', FALSE),    (53, 3, 'dossha', FALSE),
    (54, 0, 'keppoo', TRUE),   (54, 1, 'ketsupoo', FALSE),  (54, 2, 'keppo', FALSE),    (54, 3, 'keppou', FALSE),
    -- Bagian H
    (55, 0, 'chokoreeto', TRUE),
    (55, 1, 'chiyokoreeto', FALSE),
    (55, 2, 'chokoreto', FALSE),
    (55, 3, 'shokoreeto', FALSE),
    (56, 0, 'hanbaagaa', TRUE),
    (56, 1, 'hanbaaga', FALSE),
    (56, 2, 'hanbagaa', FALSE),
    (56, 3, 'hanpaagaa', FALSE),
    (57, 0, 'intaanetto', TRUE),
    (57, 1, 'intanetto', FALSE),
    (57, 2, 'intaanetsuto', FALSE),
    (57, 3, 'indaanetto', FALSE),
    (58, 0, 'konpyuutaa', TRUE),
    (58, 1, 'konpiyuutaa', FALSE),
    (58, 2, 'konpyutaa', FALSE),
    (58, 3, 'konbyuutaa', FALSE),
    (59, 0, 'sakkaachiimu', TRUE),
    (59, 1, 'satsukaachiimu', FALSE),
    (59, 2, 'sakaachiimu', FALSE),
    (59, 3, 'sakkaachimu', FALSE),
    (60, 0, 'kurisumasutsurii', TRUE),
    (60, 1, 'kurisumasushirii', FALSE),
    (60, 2, 'kurisumasutsuri', FALSE),
    (60, 3, 'warisumasutsurii', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;
END $$;
