import { withTransaction } from './db.js';
import { getCurriculumBoundary } from './curriculum-boundary.js';
import { DialogueQuestionError, loadDialogueQuestionContext, questionFingerprint,
  questionsRevision, saveDialogueQuestions } from './dialogue-question-service.js';

// N5 Bab 4, Percakapan 1, pola これ／それ／あれは〜です (owner request, 14 Oct 2026).
// The 186 comprehension item could be answered from わたしのです (〜の〜) and the
// transfer prompt said "jauh dari tangan Anda" while its key was それ. Students
// saw no question at all once the dialogue had been edited in Ruang Kerja, since
// stale questions are hidden. The set is therefore saved through the regular
// question service against the CURRENT dialogue, never against a captured text.
// Prompts are name-free: character names are edited from the admin.
export const KOSOADO_GRAMMAR_ID = 'b7874295-4a7e-471d-a29e-d316af9f2af9';
export const KOSOADO_SOURCE_LESSON_ID = 'c05893dc-051b-4a6b-bd04-cbd5d1f204ea';
// One-shot: once applied, later admin edits to this set are never overwritten.
export const KOSOADO_DONE_KEY = 'finalize_n5_b4_kosoado_questions';

const ASK = 'それは ほんですか';
const ANSWER = 'これは ほんです';
const squeeze = value => String(value || '').normalize('NFC').replace(/[\s　]+/gu, '');

// Finds `wanted` in a turn while ignoring spacing, and returns the exact
// substring of the stored turn (the service requires a literal match).
export function findQuote(text, wanted) {
  const source = String(text || '').normalize('NFC');
  const target = squeeze(wanted);
  const kept = [];
  for (let index = 0; index < source.length; index += 1) {
    if (!/[\s　]/u.test(source[index])) kept.push(index);
  }
  const at = kept.map(index => source[index]).join('').indexOf(target);
  if (!target || at < 0) return null;
  return source.slice(kept[at], kept[at + target.length - 1] + 1);
}

export function kosoadoQuestions(turns) {
  for (let index = 0; index + 1 < turns.length; index += 1) {
    const ask = findQuote(turns[index].text, ASK);
    const answer = findQuote(turns[index + 1].text, ANSWER);
    if (!ask || !answer || turns[index].speaker === turns[index + 1].speaker) continue;
    return [{
      kind: 'comprehension', sortOrder: 0,
      prompt: 'Seseorang bertanya 「それは ほんですか」, lalu lawan bicaranya menjawab 「はい、これは ほんです」. Buku itu ada di dekat siapa?',
      options: ['Dekat orang yang menjawab.', 'Dekat orang yang bertanya.', 'Jauh dari keduanya.'],
      correctIndex: 0,
      explanation: 'Penanya memakai それ karena buku itu dekat lawan bicaranya. Penjawab memakai これ karena buku itu dekat dirinya sendiri. Bendanya sama, kata penunjuknya mengikuti posisi pembicara.',
      evidence: [{ turnIndex: index, quote: ask }, { turnIndex: index + 1, quote: answer }],
    }, {
      kind: 'transfer', sortOrder: 0,
      prompt: 'Teman Anda memegang sebuah pena. Anda bertanya tentang pena di tangan teman itu. Pilih pertanyaan yang tepat.',
      options: ['それは ペンですか。', 'これは ペンですか。', 'あれは ペンですか。'],
      correctIndex: 0,
      explanation: 'Benda yang dekat lawan bicara ditunjuk dengan それ, sama seperti pertanyaan pertama di dialog. これ untuk benda yang dekat diri sendiri, あれ untuk benda yang jauh dari keduanya.',
      evidence: null,
    }];
  }
  return null;
}

const content = row => ({ kind: row.kind, prompt: row.prompt, options: row.options,
  correctIndex: row.correct_index, explanation: row.explanation, evidence: row.evidence ?? null });

export async function finalizeN5B4KosoadoQuestions({ transaction = withTransaction,
  saveQuestions = saveDialogueQuestions, resolveBoundary = getCurriculumBoundary } = {}) {
  try {
    return await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [KOSOADO_DONE_KEY]);
      const done = await client.query('SELECT value FROM app_settings WHERE key=$1', [KOSOADO_DONE_KEY]);
      if (done.rows.length) return { status: 'already_applied', at: done.rows[0].value };
      const exists = await client.query('SELECT 1 FROM module_grammar WHERE id=$1', [KOSOADO_GRAMMAR_ID]);
      if (!exists.rows.length) return { status: 'skipped', reason: 'grammar_not_found' };
      const context = await loadDialogueQuestionContext(client, KOSOADO_GRAMMAR_ID, null, { shared: true });
      if (context.sourceLessonId !== KOSOADO_SOURCE_LESSON_ID) {
        return { status: 'skipped', reason: 'source_lesson_changed', sourceLessonId: context.sourceLessonId };
      }
      const questions = kosoadoQuestions(context.turns);
      if (!questions) {
        return { status: 'skipped', reason: 'dialogue_changed',
          firstTurn: context.turns[0] ? `${context.turns[0].speaker}: ${context.turns[0].text}` : null };
      }
      const rows = (await client.query(`SELECT * FROM grammar_dialog_questions
        WHERE grammar_id=$1 ORDER BY kind,sort_order,id`, [KOSOADO_GRAMMAR_ID])).rows;
      const active = rows.filter(row => row.state === 'active');
      const wanted = questions.map(questionFingerprint).sort();
      const markDone = () => client.query(`INSERT INTO app_settings(key,value) VALUES ($1,$2)
        ON CONFLICT (key) DO NOTHING`, [KOSOADO_DONE_KEY, new Date().toISOString()]);
      if (active.length === questions.length &&
          active.every(row => row.dialogue_fingerprint === context.dialogueFingerprint &&
            row.question_fingerprint === questionFingerprint(content(row))) &&
          active.map(row => row.question_fingerprint).sort().join() === wanted.join()) {
        await markDone();
        return { status: 'already_applied' };
      }
      const keep = kind => active.find(row => row.kind === kind)?.id;
      const saved = await saveQuestions(KOSOADO_GRAMMAR_ID, {
        sourceLessonId: context.sourceLessonId,
        expectedDialogueFingerprint: context.dialogueFingerprint,
        expectedQuestionsRevision: questionsRevision(rows),
        questions: questions.map(question => ({ ...(keep(question.kind) ? { id: keep(question.kind) } : {}),
          ...question })),
      }, { transaction: fn => fn(client), rejectedReportTransaction: fn => fn(client), resolveBoundary });
      await markDone();
      return { status: 'applied',
        previous: active.map(row => ({ id: row.id, kind: row.kind, prompt: row.prompt,
          current: row.dialogue_fingerprint === context.dialogueFingerprint })),
        questions: saved.questions.map(q => ({ id: q.id, kind: q.kind, version: q.questionVersion, current: q.current })) };
    });
  } catch (error) {
    // A content fix must never block a deploy; the log names the reason.
    if (error instanceof DialogueQuestionError) {
      return { status: 'skipped', reason: error.code, report: error.report || undefined };
    }
    throw error;
  }
}
