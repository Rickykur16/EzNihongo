-- Make the two N5 Bab 3 grammar tasks use the grammar rows owned by their
-- teaching lessons, then republish the reviewed legacy question source with
-- explicit dialogue evidence. The rollout flag and course mode stay off.

DO $migration$
DECLARE
  v_course_id UUID;
  v_module_id UUID;
  v_source_id UUID;
  v_task_id UUID;
  v_lock_id UUID;
  v_soal JSONB;
  v_snapshot_md5 TEXT;
  v_next_draft JSONB;
  v_next_published JSONB;
  v_review JSONB;
  v_stamp JSONB := jsonb_build_object(
    'email', 'migration/174_prepare_bab3_learning_flow.sql',
    'at', '2026-09-27T00:00:00.000Z'
  );
  pair JSONB;
  r RECORD;
  matches INTEGER;
  changed INTEGER := 0;
BEGIN
  SELECT count(*), (array_agg(c.id))[1] INTO matches, v_course_id
    FROM courses c WHERE c.slug = 'n5';
  IF matches = 0 THEN
    RAISE NOTICE '174: no N5 course; nothing to prepare';
    RETURN;
  END IF;
  IF matches <> 1 THEN
    RAISE EXCEPTION '174: expected exactly one N5 course; found %', matches;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  FOR v_lock_id IN WITH RECURSIVE required(id) AS (
    SELECT v_course_id
    UNION
    SELECT p.prerequisite_course_id FROM course_prerequisites p
      JOIN required r2 ON r2.id = p.course_id
  ) SELECT id FROM required ORDER BY id::text LOOP
    PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || v_lock_id::text));
  END LOOP;

  SELECT count(*), (array_agg(m.id))[1] INTO matches, v_module_id
    FROM modules m WHERE m.course_id = v_course_id AND m.slug = 'n5-b3';
  IF matches <> 1 THEN
    RAISE EXCEPTION '174: expected exactly one N5 module n5-b3; found %', matches;
  END IF;

  -- A task item and its teaching grammar are paired only by the reviewed
  -- sort slot. Counts and uniqueness are checked before any update, so an
  -- unexpected curriculum shape aborts instead of guessing by pattern text.
  FOR pair IN SELECT value FROM jsonb_array_elements('[
    {"source":"bunpou-n5-b3","task":"tesbunpou1-n5-b3"},
    {"source":"bunpou2-n5-b3","task":"tesbunpou2-n5-b3"}
  ]'::jsonb) LOOP
    SELECT count(*), (array_agg(l.id))[1] INTO matches, v_source_id
      FROM lessons l WHERE l.module_id = v_module_id
      AND l.slug = pair->>'source' AND l.type IN ('video', 'text');
    IF matches <> 1 THEN
      RAISE EXCEPTION '174: source % is missing or ambiguous', pair->>'source';
    END IF;
    SELECT count(*), (array_agg(l.id))[1] INTO matches, v_task_id
      FROM lessons l WHERE l.module_id = v_module_id
      AND l.slug = pair->>'task' AND l.type = 'grammar_task'
      AND l.popup_after_lesson_id = v_source_id;
    IF matches <> 1 THEN
      RAISE EXCEPTION '174: linked task % is missing or ambiguous', pair->>'task';
    END IF;

    SELECT count(*) INTO matches FROM module_grammar g WHERE g.lesson_id = v_source_id;
    IF matches <> 3 OR EXISTS (
      SELECT 1 FROM module_grammar g WHERE g.lesson_id = v_source_id AND g.sort_order IS NULL
    ) OR EXISTS (
      SELECT 1 FROM module_grammar g WHERE g.lesson_id = v_source_id
      GROUP BY g.sort_order HAVING count(*) <> 1
    ) THEN
      RAISE EXCEPTION '174: source % must own exactly three unique grammar slots', pair->>'source';
    END IF;
    SELECT count(*) INTO matches FROM lesson_grammar_task_items i WHERE i.lesson_id = v_task_id;
    IF matches <> 3 OR EXISTS (
      SELECT 1 FROM lesson_grammar_task_items i WHERE i.lesson_id = v_task_id AND i.sort_order IS NULL
    ) OR EXISTS (
      SELECT 1 FROM lesson_grammar_task_items i WHERE i.lesson_id = v_task_id
      GROUP BY i.sort_order HAVING count(*) <> 1
    ) OR EXISTS (
      SELECT 1 FROM lesson_grammar_task_items i
      JOIN module_grammar g ON g.id = i.grammar_id
      WHERE i.lesson_id = v_task_id AND g.module_id <> v_module_id
    ) THEN
      RAISE EXCEPTION '174: task % must contain exactly three unique in-module slots', pair->>'task';
    END IF;

    UPDATE lesson_grammar_task_items i
       SET grammar_id = source_grammar.id
      FROM module_grammar source_grammar
     WHERE i.lesson_id = v_task_id
       AND source_grammar.lesson_id = v_source_id
       AND source_grammar.sort_order = i.sort_order
       AND i.grammar_id <> source_grammar.id;
    GET DIAGNOSTICS matches = ROW_COUNT;
    changed := changed + matches;

    IF EXISTS (
      SELECT 1 FROM lesson_grammar_task_items i
      LEFT JOIN module_grammar g ON g.id = i.grammar_id
      WHERE i.lesson_id = v_task_id
        AND (g.lesson_id IS DISTINCT FROM v_source_id OR g.sort_order <> i.sort_order)
    ) THEN
      RAISE EXCEPTION '174: task % did not converge on its source grammar slots', pair->>'task';
    END IF;
  END LOOP;

  -- Freeze every module grammar field and every task-membership field after
  -- the remap. Timestamps are excluded because they are metadata, not authored
  -- content. Preparation recomputes this digest under the same course lock and
  -- refuses any drift.
  SELECT md5(
    coalesce((SELECT jsonb_agg((to_jsonb(g) - 'created_at' - 'updated_at') ORDER BY g.id)
      FROM module_grammar g WHERE g.module_id = v_module_id), '[]'::jsonb)::text
    || '|' ||
    coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.lesson_id,i.sort_order,i.grammar_id)
      FROM lesson_grammar_task_items i JOIN lessons t ON t.id=i.lesson_id
      WHERE t.module_id = v_module_id), '[]'::jsonb)::text
  ) INTO v_snapshot_md5;

  -- These are reviewed questions from migration 151, with a corrected
  -- identity question for the shortened production dialogue and grounded
  -- evidence for every comprehension item. Transfer items intentionally have
  -- no evidence because they test a new situation.
  v_soal := $json${
    "kopula": {
      "comprehension": {
        "prompt": "Apa yang dilakukan penutur kedua pada gilirannya?",
        "options": ["Memperkenalkan diri", "Menanyakan pekerjaan", "Menyangkal asal negara"],
        "correctIndex": 0,
        "explanation": "Penutur kedua berkata 「ハディです」 lalu memberi salam perkenalan. Akhiran です dipakai untuk menyatakan identitas.",
        "evidence": [{"turnIndex": 2, "quote": "ハディです"}]
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
        "explanation": "Ia berkata 「アメリカじんじゃありません。オーストラリアじんです」 — setelah menyangkal, ia menyebutkan yang benar.",
        "evidence": [{"turnIndex": 2, "quote": "アメリカじんじゃありません。オーストラリアじんです"}]
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
        "explanation": "Ia bertanya 「マリアさんはがくせいですか」. Menambahkan か di akhir kalimat mengubah pernyataan menjadi pertanyaan.",
        "evidence": [{"turnIndex": 4, "quote": "マリアさんはがくせいですか"}]
      },
      "comparison": {
        "prompt": "Mana kalimat yang benar untuk menanyakan 「apakah dia orang Jepang?」",
        "options": ["あのひとは にほんじんですか", "あのひとは にほんじんかです", "あのひとは ですか にほんじん"],
        "correctIndex": 0,
        "explanation": "か diletakkan di akhir kalimat, sesudah です — bukan disisipkan di tengah."
      }
    },
    "juga": {
      "comprehension": {
        "prompt": "Pertanyaan terakhir memakai 〜も, tetapi jawabannya memakai 〜は. Mengapa?",
        "options": ["Karena jawabannya ternyata tidak sama", "Karena も tidak boleh dipakai dua kali", "Karena yang menjawab lupa memakai も"],
        "correctIndex": 0,
        "explanation": "Pertanyaannya menebak bahwa orang itu juga pelajar, tetapi jawabannya menyatakan bahwa ia guru. Karena tidak sama, jawabannya kembali memakai は.",
        "evidence": [{"turnIndex": 3, "quote": "たなかさんもがくせいですか"}, {"turnIndex": 4, "quote": "たなかさんはせんせいです"}]
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
        "explanation": "Ia berkata 「さくらだいがくのがくせいです」. Lawan bicaranya yang menyebut sekolah bahasa Jepang, jadi simak siapa yang berbicara.",
        "evidence": [{"turnIndex": 2, "quote": "さくらだいがくのがくせいです"}]
      },
      "comparison": {
        "prompt": "Mana susunan yang benar untuk 「buku bahasa Jepang」?",
        "options": ["にほんごの ほん", "ほんの にほんご", "にほんご ほんの"],
        "correctIndex": 0,
        "explanation": "Kata yang menerangkan berada sebelum の, dan kata yang diterangkan sesudahnya. 「ほんのにほんご」 berarti 「bahasa Jepang milik buku」."
      }
    },
    "partikel": {
      "comprehension": {
        "prompt": "Ada giliran yang memakai 〜よ. Apa yang sedang dilakukan orang itu?",
        "options": ["Memberi tahu hal yang belum diketahui lawan bicara", "Meminta persetujuan lawan bicara", "Mengulang yang baru saja didengarnya"],
        "correctIndex": 0,
        "explanation": "Lawan bicaranya menyangka ia pelajar, lalu ia meluruskan dengan 「エンジニアですよ」. よ dipakai saat menyampaikan informasi baru.",
        "evidence": [{"turnIndex": 3, "quote": "エンジニアですよ"}]
      },
      "comparison": {
        "prompt": "Cuaca hari ini bagus dan Anda ingin lawan bicara ikut menyetujui. Mana yang paling tepat?",
        "options": ["いいてんきですね", "いいてんきですよ", "いいてんきですか"],
        "correctIndex": 0,
        "explanation": "ね mengajak lawan bicara menyetujui sesuatu yang sama-sama dirasakan. よ memberi tahu, dan か bertanya."
      }
    }
  }$json$;

  -- Every concept must resolve once among the six source-owned grammar rows.
  WITH classified AS (
    SELECT g.id, g.lesson_id, g.example_dialog,
      CASE
        WHEN g.example_dialog LIKE '%どうぞよろしくおねがいします%' THEN 'kopula'
        WHEN g.example_dialog LIKE '%オーストラリア%' THEN 'negatif'
        WHEN g.example_dialog LIKE '%おしごとはなんですか%' THEN 'tanya'
        WHEN g.example_dialog LIKE '%わたしもがくせい%' THEN 'juga'
        WHEN g.example_dialog LIKE '%にほんごの%' THEN 'milik'
        WHEN g.example_dialog LIKE '%ですよ%' THEN 'partikel'
      END AS concept
    FROM module_grammar g JOIN lessons l ON l.id = g.lesson_id
    WHERE g.module_id = v_module_id
      AND l.slug IN ('bunpou-n5-b3', 'bunpou2-n5-b3')
  )
  SELECT count(*) INTO matches FROM classified
    WHERE concept IS NOT NULL;
  IF matches <> 6 OR EXISTS (
    WITH classified AS (
      SELECT CASE
        WHEN g.example_dialog LIKE '%どうぞよろしくおねがいします%' THEN 'kopula'
        WHEN g.example_dialog LIKE '%オーストラリア%' THEN 'negatif'
        WHEN g.example_dialog LIKE '%おしごとはなんですか%' THEN 'tanya'
        WHEN g.example_dialog LIKE '%わたしもがくせい%' THEN 'juga'
        WHEN g.example_dialog LIKE '%にほんごの%' THEN 'milik'
        WHEN g.example_dialog LIKE '%ですよ%' THEN 'partikel'
      END AS concept
      FROM module_grammar g JOIN lessons l ON l.id = g.lesson_id
      WHERE g.module_id = v_module_id
        AND l.slug IN ('bunpou-n5-b3', 'bunpou2-n5-b3')
    ) SELECT 1 FROM classified GROUP BY concept HAVING concept IS NULL OR count(*) <> 1
  ) THEN
    RAISE EXCEPTION '174: the six reviewed Bab 3 dialogue concepts are missing or ambiguous';
  END IF;

  -- SQL mirrors dialogueTurns(): prefer dialog_scene.turns, otherwise remove
  -- blank lines and strip a short speaker prefix from example_dialog.
  IF EXISTS (
    WITH classified AS (
      SELECT g.example_dialog, g.dialog_scene, CASE
        WHEN g.example_dialog LIKE '%どうぞよろしくおねがいします%' THEN 'kopula'
        WHEN g.example_dialog LIKE '%オーストラリア%' THEN 'negatif'
        WHEN g.example_dialog LIKE '%おしごとはなんですか%' THEN 'tanya'
        WHEN g.example_dialog LIKE '%わたしもがくせい%' THEN 'juga'
        WHEN g.example_dialog LIKE '%にほんごの%' THEN 'milik'
        WHEN g.example_dialog LIKE '%ですよ%' THEN 'partikel'
      END AS concept
      FROM module_grammar g JOIN lessons l ON l.id = g.lesson_id
      WHERE g.module_id = v_module_id
        AND l.slug IN ('bunpou-n5-b3', 'bunpou2-n5-b3')
    ), parsed AS (
      SELECT c.*,
        CASE WHEN jsonb_typeof(c.dialog_scene->'turns') = 'array'
          AND jsonb_array_length(c.dialog_scene->'turns') > 0 THEN
          ARRAY(SELECT regexp_replace(
              coalesce(nullif(turn->>'text', ''), turn->>'japanese', ''),
              '^[[:space:]　]+|[[:space:]　]+$', '', 'g')
            FROM jsonb_array_elements(c.dialog_scene->'turns') turn)
        ELSE ARRAY(SELECT regexp_replace(regexp_replace(
            regexp_replace(line, '^[[:space:]　]+|[[:space:]　]+$', '', 'g'),
            '^[^:：]{1,40}[:：][[:space:]　]*', ''),
            '^[[:space:]　]+|[[:space:]　]+$', '', 'g')
          FROM regexp_split_to_table(coalesce(c.example_dialog, ''), E'\r?\n') line
          WHERE regexp_replace(line, '^[[:space:]　]+|[[:space:]　]+$', '', 'g') <> '') END AS turns
      FROM classified c
    )
    SELECT 1 FROM parsed p
    CROSS JOIN LATERAL jsonb_array_elements(v_soal->p.concept->'comprehension'->'evidence') e
    WHERE NOT coalesce(p.turns[(e->>'turnIndex')::int + 1]
      LIKE '%' || (e->>'quote') || '%', false)
  ) THEN
    RAISE EXCEPTION '174: reviewed evidence no longer matches the Bab 3 dialogue text';
  END IF;

  FOR r IN
    WITH classified AS (
      SELECT g.id, g.lesson_id, CASE
        WHEN g.example_dialog LIKE '%どうぞよろしくおねがいします%' THEN 'kopula'
        WHEN g.example_dialog LIKE '%オーストラリア%' THEN 'negatif'
        WHEN g.example_dialog LIKE '%おしごとはなんですか%' THEN 'tanya'
        WHEN g.example_dialog LIKE '%わたしもがくせい%' THEN 'juga'
        WHEN g.example_dialog LIKE '%にほんごの%' THEN 'milik'
        WHEN g.example_dialog LIKE '%ですよ%' THEN 'partikel'
      END AS concept
      FROM module_grammar g JOIN lessons l ON l.id = g.lesson_id
      WHERE g.module_id = v_module_id
        AND l.slug IN ('bunpou-n5-b3', 'bunpou2-n5-b3')
    )
    SELECT lesson_id,
      jsonb_object_agg(id::text, v_soal->concept) AS checks,
      (array_agg(id) FILTER (WHERE concept = 'kopula'))[1] AS kopula_id
    FROM classified GROUP BY lesson_id
  LOOP
    SELECT bunpou_flow_draft,bunpou_flow_published
      INTO v_next_draft,v_next_published FROM lessons WHERE id=r.lesson_id FOR UPDATE;
    IF v_next_draft IS NULL OR v_next_published IS NULL THEN
      RAISE EXCEPTION '174: companion is missing for source lesson %', r.lesson_id;
    END IF;

    -- A rerun after successful preparation must preserve the current source
    -- fingerprint. It is accepted only when both immutable artifact digests
    -- and the reviewed source snapshot still match.
    IF v_next_published->'publishedBy'->>'email' = 'migration/174_prepare_bab3_learning_flow.sql' THEN
      v_review := v_next_published->'preparationReview';
      IF v_review IS NULL
        OR v_next_draft->'editor'->>'email' IS DISTINCT FROM 'migration/174_prepare_bab3_learning_flow.sql'
        OR v_review IS DISTINCT FROM v_next_draft->'preparationReview'
        OR v_review->>'version' <> '1'
        OR v_review->>'sourceSnapshotMd5' <> v_snapshot_md5
        OR v_review->>'draftPayloadMd5' <> md5((v_next_draft - 'sourceFingerprint' - 'preparationReview')::text)
        OR v_review->>'publishedPayloadMd5' <> md5((v_next_published - 'sourceFingerprint' - 'preparationReview')::text)
        OR v_next_draft->'dialogChecks' IS DISTINCT FROM r.checks
        OR v_next_published->'dialogChecks' IS DISTINCT FROM r.checks THEN
        RAISE EXCEPTION '174: reviewed companion/source snapshot changed for lesson %', r.lesson_id;
      END IF;
      CONTINUE;
    END IF;

    -- Migration 151 is the only accepted predecessor. Any admin draft or
    -- publication made after that review stops deploy instead of being lost.
    IF v_next_published->'publishedBy'->>'email' IS DISTINCT FROM 'migration/151_bunpou_flow_bab3_dialog_checks.sql'
      OR v_next_draft->'editor'->>'email' IS DISTINCT FROM 'migration/151_bunpou_flow_bab3_dialog_checks.sql' THEN
      RAISE EXCEPTION '174: companion for lesson % has an unreviewed predecessor', r.lesson_id;
    END IF;

    v_next_draft := jsonb_set(
        (v_next_draft - 'sourceFingerprint' - 'preparationReview')
          || jsonb_build_object('dialogChecks', r.checks, 'editor', v_stamp),
        '{directions}',
        coalesce(v_next_draft->'directions', '{}'::jsonb) ||
          CASE WHEN r.kopula_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
            r.kopula_id::text,
            'Perhatikan dua giliran perkenalan. Penutur pertama memakai わたしは sebelum nama, sedangkan penutur kedua cukup menyebut namanya lalu です. Saat topik sudah jelas, 〜は dapat dihilangkan; です tetap menutup kalimat identitas.'
          ) END,
        true);
    v_next_published := jsonb_set(
        (v_next_published - 'sourceFingerprint' - 'preparationReview')
          || jsonb_build_object('dialogChecks', r.checks, 'publishedBy', v_stamp),
        '{directions}',
        coalesce(v_next_published->'directions', '{}'::jsonb) ||
          CASE WHEN r.kopula_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
            r.kopula_id::text,
            'Perhatikan dua giliran perkenalan. Penutur pertama memakai わたしは sebelum nama, sedangkan penutur kedua cukup menyebut namanya lalu です. Saat topik sudah jelas, 〜は dapat dihilangkan; です tetap menutup kalimat identitas.'
          ) END,
        true);
    v_review := jsonb_build_object(
      'version', 1,
      'migration', '174_prepare_bab3_learning_flow.sql',
      'sourceSnapshotMd5', v_snapshot_md5,
      'draftPayloadMd5', md5(v_next_draft::text),
      'publishedPayloadMd5', md5(v_next_published::text)
    );
    v_next_draft := v_next_draft || jsonb_build_object('preparationReview', v_review);
    v_next_published := v_next_published || jsonb_build_object('preparationReview', v_review);

    UPDATE lessons SET
      bunpou_flow_draft = v_next_draft,
      bunpou_flow_published = v_next_published,
      updated_at = NOW()
    WHERE id = r.lesson_id;
  END LOOP;

  RAISE NOTICE '174: Bab 3 source membership prepared (% task rows changed); companion fingerprint intentionally cleared pending reviewed backfill', changed;
END;
$migration$;
