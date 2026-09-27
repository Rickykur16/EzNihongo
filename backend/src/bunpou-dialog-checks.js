import { dialogueFingerprint, questionFingerprint } from './dialogue-question-service.js';

// Sumber soal pemeriksaan dialog (Tugas Bunpou langkah 4/5 + Smart Review).
//
// Sejak 2026-09-27 tempat membuat dan mengedit soal ini adalah editor
// 🎭 Dialog (tabel grammar_dialog_questions, sama dengan yang dipakai flow v2):
// soal comprehension pertama → langkah 4, soal transfer → langkah 5
// ("pembanding" di sistem lama). Soal lama di envelope Pendamping Bunpou
// (`dialogChecks`) hanya dipakai sebagai CADANGAN untuk pola yang BELUM punya
// set pertanyaan sama sekali, supaya siswa tidak kehilangan soal selama
// admin memindahkannya.
//
// Perpindahan bersifat satu arah per pola: begitu sebuah pola punya satu saja
// baris aktif di set pertanyaan, soal lamanya tidak pernah dipakai lagi —
// termasuk ketika set barunya belum lengkap atau dialognya sudah diedit
// sehingga soalnya perlu ditinjau ulang. Kalau jatuh balik ke soal lama di
// keadaan itu, siswa bisa diam-diam mendapat soal yang tidak cocok lagi dengan
// dialog yang sekarang.

// Map<grammarId, { comprehension?, comparison?, activeCount, currentCount }>
export async function loadQuestionSets(sourceLessonId, grammarIds, dbQuery) {
  const sets = new Map();
  const ids = [...new Set((grammarIds || []).filter(Boolean))];
  if (!sourceLessonId || !ids.length) return sets;
  const rows = (await dbQuery(`SELECT q.grammar_id, q.kind, q.prompt, q.options, q.correct_index,
        q.explanation, q.evidence, q.question_fingerprint, q.dialogue_fingerprint,
        g.example_dialog, g.example_dialog_id, g.communication_goal, g.dialog_scene
      FROM grammar_dialog_questions q JOIN module_grammar g ON g.id = q.grammar_id
     WHERE q.grammar_id = ANY($1::uuid[]) AND q.source_lesson_id = $2 AND q.state = 'active'
     ORDER BY q.grammar_id, q.kind, q.sort_order, q.id`, [ids, sourceLessonId])).rows;
  for (const row of rows) {
    const set = sets.get(row.grammar_id) || { activeCount: 0, currentCount: 0 };
    set.activeCount++;
    sets.set(row.grammar_id, set);
    // Soal yang ditulis untuk versi dialog sebelumnya, atau yang isinya tidak
    // cocok lagi dengan sidik jarinya sendiri, tidak disajikan.
    const current = row.dialogue_fingerprint === dialogueFingerprint(row) &&
      row.question_fingerprint === questionFingerprint({ kind: row.kind, prompt: row.prompt,
        options: row.options, correctIndex: row.correct_index, explanation: row.explanation,
        evidence: row.evidence });
    if (!current) continue;
    set.currentCount++;
    const key = row.kind === 'transfer' ? 'comparison' : 'comprehension';
    if (!set[key]) {
      set[key] = { prompt: row.prompt, options: row.options, correctIndex: row.correct_index,
        explanation: row.explanation };
    }
  }
  return sets;
}

// Murni: gabungkan set pertanyaan dengan soal lama menjadi soal yang dipakai.
// `sources[gid]`: 'dialog' (set lengkap & sesuai dialog sekarang),
// 'dialog_incomplete' (set ada tapi belum bisa disajikan), 'legacy' (belum
// dipindah, soal lama dipakai), atau 'none'.
export function effectiveDialogChecks(grammarIds, questionSets, legacyChecks) {
  const checks = {};
  const sources = {};
  let usesQuestionSet = false;
  const legacy = legacyChecks && typeof legacyChecks === 'object' ? legacyChecks : {};
  for (const gid of grammarIds || []) {
    const set = questionSets?.get(gid);
    if (set?.activeCount) {
      usesQuestionSet = true;
      if (set.comprehension && set.comparison) {
        checks[gid] = { comprehension: set.comprehension, comparison: set.comparison };
        sources[gid] = 'dialog';
      } else sources[gid] = 'dialog_incomplete';
    } else if (legacy[gid]) {
      checks[gid] = legacy[gid];
      sources[gid] = 'legacy';
    } else sources[gid] = 'none';
  }
  return { checks, sources, usesQuestionSet };
}
