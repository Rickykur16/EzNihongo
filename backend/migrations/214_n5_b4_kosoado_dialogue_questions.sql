-- N5 Bab 4, Percakapan 1, pola これ／それ／あれは〜です: soal dialog diselaraskan
-- dengan dialognya (permintaan pemilik 14 Okt 2026; simpan lewat admin gagal).
--
-- Soal pemahaman lama ("Benda jauh dari kedua penutur ternyata apa?" → Tas milik
-- Hadi) bisa dijawab dari わたしのです (pola 〜の〜, Percakapan 2) tanpa paham
-- これ／それ／あれ. Soal baru menanyakan inti dialog: Anna memakai それ dan Hadi
-- memakai これ untuk buku yang sama. Soal penerapan lama menyebut "jauh dari
-- tangan Anda" padahal kuncinya それ; frasa itu menggiring ke あれ.
--
-- Baris soal yang ada diperbarui di tempat dengan question_version baru, sama
-- seperti editor admin saat menyimpan soal yang sudah ada: ID tetap, jawaban
-- siswa lama tetap menunjuk versi lamanya. question_fingerprint dihitung oleh
-- questionFingerprint() (dialogue-question-service.js); tesnya
-- n5-b4-kosoado-questions-migration.test.js. Hanya berlaku bila dialognya masih
-- teks hasil 186 (dialogue_fingerprint sama); selain itu NOTICE, tanpa perubahan.
CREATE TABLE IF NOT EXISTS n5_b4_kosoado_questions_backup_214 (
  question_id UUID PRIMARY KEY,
  before_row JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $migration$
DECLARE
  v_grammar_id CONSTANT UUID := 'b7874295-4a7e-471d-a29e-d316af9f2af9';
  v_dialogue_fingerprint CONSTANT TEXT :=
    'sha256:f68fb79a0b4a6d1351d3a36e4a3900c168d5f8a3383d2b08978de014e4df5662';
  v_dialogue CONSTANT TEXT := E'A: それは ほんですか。\nB: はい、これは ほんです。\nA: あれも ほんですか。\nB: いいえ、あれは かばんです。\nA: ハディさんの かばんですか。\nB: はい、わたしのです。';
  v_questions CONSTANT JSONB := $questions$[
    {"kind":"comprehension",
     "prompt":"Anna bertanya 「それは ほんですか」, lalu Hadi menjawab 「これは ほんです」. Di mana buku itu berada?",
     "options":["Dekat Hadi.","Dekat Anna.","Jauh dari keduanya."],
     "correctIndex":0,
     "explanation":"Anna memakai それ karena buku itu dekat lawan bicaranya. Hadi memakai これ karena buku itu dekat dirinya sendiri. Bendanya sama, kata penunjuknya mengikuti posisi pembicara.",
     "evidence":[{"turnIndex":0,"quote":"それは ほんですか"},{"turnIndex":1,"quote":"これは ほんです"}],
     "fingerprint":"sha256:837749daad9740c7d348800310fe50e32067cb2de5e83f7de19660a0057d7e7b"},
    {"kind":"transfer",
     "prompt":"Teman Anda memegang sebuah pena. Anda bertanya tentang pena di tangan teman itu. Pilih pertanyaan yang tepat.",
     "options":["それは ペンですか。","これは ペンですか。","あれは ペンですか。"],
     "correctIndex":0,
     "explanation":"Benda yang dekat lawan bicara ditunjuk dengan それ, seperti Anna bertanya tentang buku yang dipegang Hadi. これ untuk benda yang dekat diri sendiri, あれ untuk benda yang jauh dari keduanya.",
     "evidence":null,
     "fingerprint":"sha256:7fc2a4f93a7c18ea6bc79b19bf0c43d243b23c54f6415ba11773de1ba07195ff"}
  ]$questions$;
  v_dialog_now TEXT;
  q JSONB;
  r grammar_dialog_questions%ROWTYPE;
  v_changed INT := 0;
BEGIN
  SELECT example_dialog INTO v_dialog_now FROM module_grammar WHERE id = v_grammar_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE '214: grammar これ／それ／あれ Bab 4 tidak ada; tidak ada perubahan.';
    RETURN;
  END IF;
  IF v_dialog_now IS DISTINCT FROM v_dialogue THEN
    RAISE NOTICE '214: dialog これ／それ／あれ sudah diubah (baris pertama: %); soal tidak diubah.',
      split_part(coalesce(v_dialog_now, ''), E'\n', 1);
    RETURN;
  END IF;

  FOR q IN SELECT value FROM jsonb_array_elements(v_questions) LOOP
    SELECT * INTO r FROM grammar_dialog_questions
     WHERE grammar_id = v_grammar_id AND kind = q->>'kind' AND state = 'active'
     ORDER BY sort_order, id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      RAISE NOTICE '214: tidak ada soal % aktif; dilewati.', q->>'kind';
      CONTINUE;
    END IF;
    IF r.question_fingerprint = q->>'fingerprint' THEN
      CONTINUE; -- sudah diterapkan
    END IF;
    IF r.dialogue_fingerprint IS DISTINCT FROM v_dialogue_fingerprint THEN
      RAISE NOTICE '214: soal % (%) memakai dialog versi lain; dilewati.', q->>'kind', r.id;
      CONTINUE;
    END IF;

    INSERT INTO n5_b4_kosoado_questions_backup_214(question_id, before_row)
      VALUES (r.id, to_jsonb(r)) ON CONFLICT (question_id) DO NOTHING;
    RAISE NOTICE '214: soal % (%) diganti; prompt lama: %', q->>'kind', r.id, r.prompt;

    UPDATE grammar_dialog_questions SET
      prompt = q->>'prompt',
      options = q->'options',
      correct_index = (q->>'correctIndex')::int,
      explanation = q->>'explanation',
      evidence = CASE WHEN jsonb_typeof(q->'evidence') = 'array' THEN q->'evidence' END,
      question_version = gen_random_uuid(),
      question_fingerprint = q->>'fingerprint',
      updated_at = NOW()
    WHERE id = r.id;
    v_changed := v_changed + 1;
  END LOOP;
  RAISE NOTICE '214: % soal Bab 4 これ／それ／あれ diperbarui.', v_changed;
END
$migration$;
