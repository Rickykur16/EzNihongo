-- audit-bab-structure.sql — cek struktur pelajaran per Bab (read-only).
--
-- Menjawab: "Bab mana yang belum punya deck Kanji / deck Kosakata / Tugas
-- Bunpou / Assignment kuis?" — dipakai sebelum menulis migrasi seeding bab
-- baru (pola 039-060), karena kurikulum TIDAK disimpan di repo: modules /
-- lessons / kanji_items / module_vocabulary semuanya hidup di DB produksi.
--
-- Jalankan di VPS:
--   set -a; . /var/www/eznihongo/backend/.env; set +a
--   psql "$DATABASE_URL" -f /var/www/eznihongo/backend/scripts/audit-bab-structure.sql
--
-- Tidak menulis apa pun — aman dijalankan kapan saja.

\echo '== 1. Jenis pelajaran per Bab (kursus n5) =============================='

SELECT
  m.sort_order                                                 AS bab,
  m.title,
  COUNT(*) FILTER (WHERE l.type = 'kana')         AS kana,
  COUNT(*) FILTER (WHERE l.type = 'kanji')        AS kanji,
  COUNT(*) FILTER (WHERE l.type = 'deck')         AS kosakata,
  COUNT(*) FILTER (WHERE l.type = 'text')         AS teori,
  COUNT(*) FILTER (WHERE l.type = 'video')        AS video,
  COUNT(*) FILTER (WHERE l.type = 'grammar_task') AS tugas_bunpou,
  COUNT(*) FILTER (WHERE l.type = 'quiz')         AS kuis
FROM modules m
JOIN courses c ON c.id = m.course_id
LEFT JOIN lessons l ON l.module_id = m.id
WHERE c.slug = 'n5'
GROUP BY m.id, m.sort_order, m.title
ORDER BY m.sort_order;

\echo ''
\echo '== 2. Bab yang MENYIMPANG dari struktur Bab 3-10 ======================='
\echo '   (patokan: 1 deck kanji + 1 deck kosakata + 2 tugas bunpou + 1 kuis)'

SELECT
  m.sort_order AS bab,
  m.title,
  CONCAT_WS(', ',
    CASE WHEN COUNT(*) FILTER (WHERE l.type = 'kanji') = 0        THEN 'tanpa deck kanji' END,
    CASE WHEN COUNT(*) FILTER (WHERE l.type = 'deck') = 0         THEN 'tanpa deck kosakata' END,
    CASE WHEN COUNT(*) FILTER (WHERE l.type = 'grammar_task') < 2 THEN 'tugas bunpou < 2' END,
    CASE WHEN COUNT(*) FILTER (WHERE l.type = 'quiz') = 0         THEN 'tanpa assignment kuis' END
  ) AS kurang
FROM modules m
JOIN courses c ON c.id = m.course_id
LEFT JOIN lessons l ON l.module_id = m.id
WHERE c.slug = 'n5'
GROUP BY m.id, m.sort_order, m.title
HAVING COUNT(*) FILTER (WHERE l.type = 'kanji') = 0
    OR COUNT(*) FILTER (WHERE l.type = 'deck') = 0
    OR COUNT(*) FILTER (WHERE l.type = 'grammar_task') < 2
    OR COUNT(*) FILTER (WHERE l.type = 'quiz') = 0
ORDER BY m.sort_order;

\echo ''
\echo '== 3. Pelajaran yang ADA tapi KOSONG isinya ============================'
\echo '   (deck tanpa kartu, kanji tanpa item, tugas tanpa pola, kuis tanpa soal)'

SELECT
  m.sort_order AS bab,
  l.type,
  l.title,
  CASE l.type
    WHEN 'deck'         THEN (SELECT COUNT(*) FROM lesson_deck_items d         WHERE d.lesson_id = l.id)
    WHEN 'kanji'        THEN (SELECT COUNT(*) FROM kanji_items k               WHERE k.lesson_id = l.id)
    WHEN 'grammar_task' THEN (SELECT COUNT(*) FROM lesson_grammar_task_items g WHERE g.lesson_id = l.id)
    WHEN 'quiz'         THEN (SELECT COUNT(*) FROM quiz_questions q            WHERE q.lesson_id = l.id)
  END AS jumlah_item
FROM lessons l
JOIN modules m ON m.id = l.module_id
JOIN courses c ON c.id = m.course_id
WHERE c.slug = 'n5'
  AND l.type IN ('deck', 'kanji', 'grammar_task', 'quiz')
  AND CASE l.type
        WHEN 'deck'         THEN (SELECT COUNT(*) FROM lesson_deck_items d         WHERE d.lesson_id = l.id)
        WHEN 'kanji'        THEN (SELECT COUNT(*) FROM kanji_items k               WHERE k.lesson_id = l.id)
        WHEN 'grammar_task' THEN (SELECT COUNT(*) FROM lesson_grammar_task_items g WHERE g.lesson_id = l.id)
        WHEN 'quiz'         THEN (SELECT COUNT(*) FROM quiz_questions q            WHERE q.lesson_id = l.id)
      END = 0
ORDER BY m.sort_order, l.sort_order;

\echo ''
\echo '== 4. Bank konten per Bab (bahan mentah untuk bikin deck) =============='

SELECT
  m.sort_order AS bab,
  m.title,
  (SELECT COUNT(*) FROM module_vocabulary v WHERE v.module_id = m.id) AS vocab_bank,
  (SELECT COUNT(*) FROM module_grammar   g WHERE g.module_id = m.id) AS grammar_bank
FROM modules m
JOIN courses c ON c.id = m.course_id
WHERE c.slug = 'n5'
ORDER BY m.sort_order;
