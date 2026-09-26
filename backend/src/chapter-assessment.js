// Versioned, bounded evidence for chapter assessments. This is not the
// grammar-mastery policy and does not claim open-ended speaking proficiency.
export const CHAPTER_ASSESSMENT_VERSION = 'n5-assessment-v2';
export const CHAPTER_BLUEPRINT = Object.freeze({ vocabulary: 6, grammar: 10, reading: 4, listening: 4 });
export const CHAPTER_LABELS = Object.freeze({
  vocabulary: 'Aksara dan kosakata',
  grammar: 'Tata bahasa dan ungkapan',
  reading: 'Membaca',
  listening: 'Menyimak',
});
export const CHAPTER_POLICY = Object.freeze({ passingScorePct: 70, categoryMinimumPct: 50, minimumObjectiveCorrect: 1, questionsPerForm: 24 });

export function isChapterAssessment(policy) {
  return policy?.version === CHAPTER_ASSESSMENT_VERSION;
}

export function publicChapterRules(policy) {
  return Object.fromEntries(Object.entries(CHAPTER_POLICY).map(([key, value]) => [key, policy?.[key] ?? value]));
}

export function assertChapterForm(policy, rows) {
  if (!isChapterAssessment(policy) || !Array.isArray(rows) || rows.length !== CHAPTER_POLICY.questionsPerForm) throw new Error('assessment_bank_invalid');
  const objectives = new Set((policy.objectives || []).map(o => o.id));
  if (!objectives.size || objectives.size !== policy.objectives.length) throw new Error('assessment_bank_invalid');
  for (const [category, count] of Object.entries(CHAPTER_BLUEPRINT)) {
    if (rows.filter(q => q.question_category === category).length !== count) throw new Error('assessment_bank_invalid');
  }
  if (new Set(rows.map(q => q.id)).size !== rows.length) throw new Error('assessment_bank_invalid');
  for (const q of rows) {
    if (!objectives.has(q.assessment_meta?.objective) || q.assessment_meta?.version !== policy.version) throw new Error('assessment_bank_invalid');
    if (q.question_type !== 'multiple_choice' || q.options?.length !== 4 || q.options.filter(o => o.is_correct === true).length !== 1) throw new Error('assessment_bank_invalid');
    if (q.question_category === 'reading' && !q.passage?.trim()) throw new Error('assessment_bank_invalid');
    if (q.question_category === 'listening' && !q.audio_script?.trim()) throw new Error('assessment_bank_invalid');
  }
  for (const id of objectives) if (!rows.some(q => q.assessment_meta.objective === id)) throw new Error('assessment_bank_invalid');
}

export function createChapterSnapshot(policy, rows, previousForm, random = Math.random) {
  const form = previousForm === 'A' ? 'B' : previousForm === 'B' ? 'A' : random() < 0.5 ? 'A' : 'B';
  // Validate BOTH forms before allowing either one to start.
  for (const name of ['A', 'B']) assertChapterForm(policy, rows.filter(q => q.assessment_meta?.form === name));
  const questions = rows.filter(q => q.assessment_meta.form === form).sort((a, b) => a.sort_order - b.sort_order);
  return structuredClone({ version: policy.version, form, policy: { ...policy, ...CHAPTER_POLICY }, questions });
}

export function publicChapterQuestions(snapshot) {
  return snapshot.questions.map(q => ({
    id: q.id, question: q.question, question_type: q.question_type,
    question_category: q.question_category, section_number: q.section_number,
    section_label: q.section_label, section_instruction: q.section_instruction,
    passage: q.passage || null, sort_order: q.sort_order,
    has_audio: q.question_category === 'listening',
    options: (q.options || []).map(o => ({ id: o.id, option_text: o.option_text, sort_order: o.sort_order })),
  }));
}

export function gradeChapterAssessment(snapshot, answersByQuestion) {
  assertChapterForm(snapshot.policy, snapshot.questions);
  const correctByQuestion = Object.fromEntries(snapshot.questions.map(q => [q.id, answersByQuestion.get(q.id)?.correct === true]));
  const policy = snapshot.policy;
  const resultFor = (rows, label, minimumCorrect, key) => ({
    key, sectionLabel: label, score: rows.filter(q => correctByQuestion[q.id]).length,
    total: rows.length, minimumCorrect,
    passed: rows.filter(q => correctByQuestion[q.id]).length >= minimumCorrect,
  });
  const sectionResults = Object.entries(CHAPTER_LABELS).map(([category, label], i) => {
    const rows = snapshot.questions.filter(q => q.question_category === category);
    return { ...resultFor(rows, label, Math.ceil(rows.length * policy.categoryMinimumPct / 100), category), sectionNumber: i + 1 };
  });
  const objectiveResults = policy.objectives.map(objective => ({
    ...resultFor(snapshot.questions.filter(q => q.assessment_meta.objective === objective.id), objective.canDo, policy.minimumObjectiveCorrect, objective.id),
    objectiveId: objective.id,
  }));
  const score = Object.values(correctByQuestion).filter(Boolean).length;
  const total = snapshot.questions.length;
  return { score, total, correctByQuestion, sectionResults, objectiveResults,
    passed: score * 100 / total >= policy.passingScorePct && sectionResults.every(s => s.passed) && objectiveResults.every(o => o.passed),
  };
}

export function chapterReview(snapshot, answers, correctByQuestion) {
  const byId = new Map(answers.map(a => [a.questionId, a]));
  return snapshot.questions.map(q => {
    const selected = byId.get(q.id);
    return {
      questionId: q.id, prompt: q.question, passage: q.passage || null,
      audioScript: q.audio_script || null, category: q.question_category,
      correct: correctByQuestion[q.id],
      submittedAnswer: q.options.find(o => o.id === selected?.optionId)?.option_text || '',
      correctAnswer: q.options.find(o => o.is_correct)?.option_text,
      explanation: q.explanation,
      choiceReason: q.assessment_meta.distractorReasons?.[q.options.findIndex(o => o.id === selected?.optionId)] || null,
    };
  });
}

export function validateChapterDraft(snapshot, answers) {
  if (!Array.isArray(answers) || answers.length > snapshot.questions.length) return false;
  const seen = new Set();
  return answers.every(a => {
    const q = snapshot.questions.find(q => q.id === a?.questionId);
    if (!q || seen.has(q.id)) return false;
    seen.add(q.id);
    return !a.textAnswer && q.options.some(o => o.id === a.optionId);
  });
}
