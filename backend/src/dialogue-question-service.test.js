import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueFingerprint, dialogueTurns, questionFingerprint, questionsRevision,
  listDialogueQuestions, saveDialogueQuestions } from './dialogue-question-service.js';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const courseId = id(1), moduleId = id(2), lessonId = id(3), grammarId = id(4);
const grammar = { id: grammarId, module_id: moduleId, lesson_id: lessonId, course_id: courseId,
  boundary_mode: 'enforce', pattern: '〜です', example_dialog: 'A: ねこです。\nB: はい。',
  example_dialog_id: 'A: Ini kucing.\nB: Ya.', communication_goal: 'Mengenalkan kucing',
  dialog_scene: null, dialog_furigana: null };
const empty = { target: { vocabulary: [], grammar: [], kanji: [] },
  previous: { vocabulary: [], grammar: [], kanji: [] },
  prerequisite: { vocabulary: [], grammar: [], kanji: [] },
  future: { vocabulary: [], grammar: [], kanji: [] } };
const boundary = { status: 'resolved', boundaryFingerprint: 'sha256:test',
  course: { id: courseId, mode: 'enforce', slug: 'n5' },
  currentModule: { id: moduleId }, lesson: { id: lessonId }, ...empty, integrityIssues: [] };
const first = { kind: 'comprehension', prompt: 'Apa yang disebutkan?',
  options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
  explanation: 'Pembicara menyebut kucing.', sortOrder: 0,
  evidence: [{ turnIndex: 0, quote: 'ねこです' }] };

function harness() {
  let rows = [], reports = 0, contentWrites = 0;
  const copy = value => structuredClone(value);
  const client = { async query(sql, params = []) {
    if (sql.includes('WITH RECURSIVE required')) return { rows: [{ id: courseId }] };
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('SAVEPOINT') || sql.startsWith('RELEASE') ||
        sql.startsWith('ROLLBACK TO')) return { rows: [] };
    if (sql.includes('SELECT m.course_id FROM module_grammar')) return { rows: [{ course_id: courseId }] };
    if (sql.includes('SELECT g.*,m.course_id')) return { rows: [copy(grammar)] };
    if (sql.includes('SELECT id,module_id FROM lessons')) return { rows: [{ id: lessonId, module_id: moduleId }] };
    if (sql.includes('SELECT * FROM grammar_dialog_questions')) {
      return { rows: copy(sql.includes("state='active'") ? rows.filter(row => row.state === 'active') : rows) };
    }
    if (sql.includes('UPDATE grammar_dialog_questions SET state=')) {
      contentWrites++; rows.forEach(row => { if (row.state === 'active') row.state = 'archived'; });
      return { rows: [] };
    }
    if (sql.includes('UPDATE grammar_dialog_questions SET prompt=')) {
      contentWrites++;
      const row = rows.find(item => item.id === params[0]);
      Object.assign(row, { prompt: params[1], options: JSON.parse(params[2]), correct_index: params[3],
        explanation: params[4], evidence: params[5] ? JSON.parse(params[5]) : null,
        sort_order: params[6], question_version: params[7], question_fingerprint: params[8],
        dialogue_fingerprint: params[9], state: 'active' });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO grammar_dialog_questions')) {
      contentWrites++;
      rows.push({ id: params[0], grammar_id: params[1], source_lesson_id: params[2],
        kind: params[3], prompt: params[4], options: JSON.parse(params[5]), correct_index: params[6],
        explanation: params[7], sort_order: params[8], question_version: params[9],
        question_fingerprint: params[10], dialogue_fingerprint: params[11],
        evidence: params[12] ? JSON.parse(params[12]) : null, state: 'active' });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO curriculum_boundary_reports')) { reports++; return { rows: [] }; }
    throw Error(`Unexpected SQL: ${sql}`);
  } };
  const transaction = async fn => {
    const before = copy(rows), previousReports = reports, previousWrites = contentWrites;
    try { return await fn(client); }
    catch (error) { rows = before; reports = previousReports; contentWrites = previousWrites; throw error; }
  };
  return { transaction, resolveBoundary: async () => boundary,
    state: () => ({ rows: copy(rows), reports, contentWrites }) };
}

test('canonical private fingerprints ignore question order but track semantic edits and dialogue', () => {
  assert.equal(dialogueTurns(grammar)[0].text, 'ねこです。');
  const original = questionFingerprint(first);
  assert.equal(questionFingerprint({ ...first, sortOrder: 7 }), original);
  assert.notEqual(questionFingerprint({ ...first, correctIndex: 1 }), original);
  assert.notEqual(dialogueFingerprint({ ...grammar, example_dialog_id: 'Terjemahan lain' }),
    dialogueFingerprint(grammar));
  assert.equal(dialogueFingerprint({ ...grammar, dialog_furigana: { lines: [{ readings: [] }] } }),
    dialogueFingerprint(grammar));
  assert.equal(questionsRevision([]), questionsRevision([{ state: 'archived', id: id(9) }]));
});

test('atomic active-set save preserves IDs, versions on reorder, and archives removed IDs', async () => {
  const db = harness();
  const base = { sourceLessonId: lessonId, expectedDialogueFingerprint: dialogueFingerprint(grammar),
    expectedQuestionsRevision: questionsRevision([]) };
  const saved = await saveDialogueQuestions(grammarId, { ...base, questions: [first] }, db);
  assert.equal(saved.questions.length, 1);
  assert.equal(db.state().reports, 1);
  const row = saved.questions[0];
  assert.match(row.questionVersion, /^[0-9a-f-]{36}$/u);
  const listed = await listDialogueQuestions(grammarId,
    { sourceLessonId: lessonId, transaction: db.transaction });
  assert.equal(listed.questions[0].correctIndex, 0);
  assert.equal(listed.questions[0].current, true);
  const reordered = await saveDialogueQuestions(grammarId, { ...base,
    expectedQuestionsRevision: saved.questionsRevision,
    questions: [{ ...first, id: row.id, sortOrder: 1 }] }, db);
  assert.equal(reordered.questions[0].questionVersion, row.questionVersion);
  assert.notEqual(reordered.questionsRevision, saved.questionsRevision);
  const archived = await saveDialogueQuestions(grammarId, { ...base,
    expectedQuestionsRevision: reordered.questionsRevision, questions: [] }, db);
  assert.equal(archived.questions.length, 0);
  assert.equal(db.state().rows[0].state, 'archived');
});

test('stale dialogue or set revision, malformed options and fabricated evidence write nothing', async () => {
  const db = harness();
  const base = { sourceLessonId: lessonId, expectedDialogueFingerprint: dialogueFingerprint(grammar),
    expectedQuestionsRevision: questionsRevision([]), questions: [first] };
  for (const [request, status] of [
    [{ ...base, expectedDialogueFingerprint: 'sha256:old' }, 409],
    [{ ...base, expectedQuestionsRevision: 'sha256:old' }, 409],
    [{ ...base, questions: [{ ...first, options: ['Kucing', ' kucing ', 'Burung'] }] }, 422],
    [{ ...base, questions: [{ ...first, evidence: [{ turnIndex: 0, quote: 'みらい' }] }] }, 422],
    [{ ...base, sourceLessonId: id(99) }, 409],
  ]) {
    await assert.rejects(saveDialogueQuestions(grammarId, request, db), error => error.status === status);
    assert.equal(db.state().contentWrites, 0);
    assert.equal(db.state().reports, 0);
  }
});

test('enforce rejection writes a separate report after rollback without changing the set', async () => {
  const db = harness();
  const futureBoundary = { ...boundary, future: { ...boundary.future,
    vocabulary: [{ key: 'future', japanese: 'みらい', reading: 'みらい' }] } };
  const request = { sourceLessonId: lessonId,
    expectedDialogueFingerprint: dialogueFingerprint(grammar),
    expectedQuestionsRevision: questionsRevision([]),
    questions: [{ ...first, prompt: 'みらい は です。' }] };
  await assert.rejects(saveDialogueQuestions(grammarId, request,
    { ...db, resolveBoundary: async () => futureBoundary }), error =>
    error.status === 422 && error.report?.violations.some(item => item.code === 'future_vocabulary'));
  assert.equal(db.state().contentWrites, 0);
  assert.equal(db.state().rows.length, 0);
  assert.equal(db.state().reports, 1);
});
