-- 131_fix_nande_meaning.sql — Koreksi arti kartu なんで di Bab 9.
--
-- Sebagai ungkapan percakapan yang berdiri sendiri, なんで berarti
-- "kenapa / mengapa". Arti "dengan apa" hanya muncul bila bentuknya
-- dianalisis sebagai 何 + partikel で dalam konteks alat/cara, misalnya
-- 何で行きますか. Menaruh "dengan apa" sebagai arti utama kartu tanpa
-- konteks membuat siswa salah memahami penggunaan yang paling umum.
--
-- Migrasi dibatasi ke N5 Bab 9 agar entri 何で yang sengaja dikurasi sebagai
-- frasa berpartikel di level atau bab lain tidak ikut berubah.

DO $$
DECLARE
  v_module_id       UUID;
  v_vocab_updated   INT := 0;
  v_quiz_updated    INT := 0;
  v_usage_note      TEXT := 'Catatan: 何で (何 + partikel で) dapat berarti "dengan apa / memakai apa" dalam konteks alat atau transportasi. Untuk menanyakan cara secara jelas, gunakan どうやって.';
BEGIN
  SELECT m.id INTO v_module_id
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5'
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 8 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '131: modul N5 Bab 9 tidak ditemukan — skip koreksi なんで.';
    RETURN;
  END IF;

  UPDATE module_vocabulary
     SET indonesian = 'kenapa / mengapa',
         note = CASE
           WHEN COALESCE(note, '') ILIKE '%何で (何 + partikel で)%' THEN note
           WHEN NULLIF(BTRIM(COALESCE(note, '')), '') IS NULL THEN v_usage_note
           ELSE BTRIM(note) || E'\n' || v_usage_note
         END,
         updated_at = NOW()
   WHERE module_id = v_module_id
     AND (
       BTRIM(japanese) IN ('なんで', '何で')
       OR BTRIM(COALESCE(reading, '')) = 'なんで'
       OR LOWER(BTRIM(COALESCE(romaji, ''))) = 'nande'
     )
     AND LOWER(BTRIM(COALESCE(indonesian, ''))) LIKE 'dengan apa%';

  GET DIAGNOSTICS v_vocab_updated = ROW_COUNT;

  -- Selaraskan penjelasan soal Bab 9 yang membandingkan どうやって dan
  -- なんで. Soal dan jawaban tidak berubah; hanya alasannya dibuat presisi.
  UPDATE quiz_questions q
     SET explanation = 'Jawabannya どうやって (bagaimana caranya), dijawab dengan cara transportasi タクシーで. なんで biasanya berarti "kenapa/mengapa"; sebagai 何で dalam konteks alat dapat berarti "dengan apa", sehingga bentuk kana saja ambigu. Untuk menanyakan CARA secara jelas, どうやって paling tepat. いつ menanyakan waktu dan だれと menanyakan teman.',
         updated_at = NOW()
    FROM lessons l
   WHERE q.lesson_id = l.id
     AND l.module_id = v_module_id
     AND l.slug = 'assignment-bab-9-bepergian'
     AND q.question LIKE '%くうこうまで%タクシーで%';

  GET DIAGNOSTICS v_quiz_updated = ROW_COUNT;

  RAISE NOTICE '131: arti なんで dikoreksi menjadi "kenapa / mengapa" — % kartu dan % penjelasan soal diperbarui.',
    v_vocab_updated, v_quiz_updated;
END $$;
