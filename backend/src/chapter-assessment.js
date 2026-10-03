// Versioned, bounded evidence for chapter assessments. This is not the
// grammar-mastery policy and does not claim open-ended speaking proficiency.
import {FINAL_EXAMS,isFinalExam,finalExamRules,isJlptEstimate,gradeJlptEstimate} from './final-exam-policy.js';
export const CHAPTER_ASSESSMENT_VERSION = 'n5-assessment-v2';
export const JLPT_ASSESSMENT_VERSION = 'n5-assessment-v3';
export const REVISED_JLPT_ASSESSMENT_VERSION = 'n5-assessment-v4';
export const N4_ASSESSMENT_VERSION = 'n4-assessment-v1';
export const CHAPTER_BLUEPRINT = Object.freeze({ vocabulary: 6, grammar: 10, reading: 4, listening: 4 });
export const CHAPTER_LABELS = Object.freeze({
  vocabulary: 'Aksara dan kosakata',
  grammar: 'Tata bahasa dan ungkapan',
  reading: 'Membaca',
  listening: 'Menyimak',
});
export const CHAPTER_POLICY = Object.freeze({ passingScorePct: 70, categoryMinimumPct: 50, minimumObjectiveCorrect: 1, questionsPerForm: 24 });

export function isChapterAssessment(policy) {
  return isFinalExam(policy) || [CHAPTER_ASSESSMENT_VERSION, JLPT_ASSESSMENT_VERSION, REVISED_JLPT_ASSESSMENT_VERSION, N4_ASSESSMENT_VERSION].includes(policy?.version);
}

export function publicChapterRules(policy) {
  if (isFinalExam(policy)) return finalExamRules(policy);
  return Object.fromEntries(Object.entries(CHAPTER_POLICY).map(([key, value]) => [key, policy?.[key] ?? value]));
}

export function assertChapterForm(policy, rows) {
  const final = isFinalExam(policy);
  const rules = final ? finalExamRules(policy) : CHAPTER_POLICY;
  const blueprint = final ? FINAL_EXAMS[policy.version].blueprint : CHAPTER_BLUEPRINT;
  if (!isChapterAssessment(policy) || !Array.isArray(rows) || rows.length !== rules.questionsPerForm || (final && policy.selection !== (FINAL_EXAMS[policy.version].selection || 'all'))) throw new Error('assessment_bank_invalid');
  const objectives = new Set((policy.objectives || []).map(o => o.id));
  if (!objectives.size || objectives.size !== policy.objectives.length) throw new Error('assessment_bank_invalid');
  for (const [category, count] of Object.entries(blueprint)) {
    if (rows.filter(q => q.question_category === category).length !== count) throw new Error('assessment_bank_invalid');
  }
  if (new Set(rows.map(q => q.id)).size !== rows.length) throw new Error('assessment_bank_invalid');
  if (final && FINAL_EXAMS[policy.version].items) {
    for (const [type, count] of Object.entries(FINAL_EXAMS[policy.version].items)) {
      if (rows.filter(q => q.assessment_meta?.itemType === type).length !== count) throw new Error('assessment_bank_invalid');
    }
  }
  for (const q of rows) {
    if (!objectives.has(q.assessment_meta?.objective) || q.assessment_meta?.version !== policy.version) throw new Error('assessment_bank_invalid');
    const audioChoices = (final || [JLPT_ASSESSMENT_VERSION, REVISED_JLPT_ASSESSMENT_VERSION].includes(policy.version)) && q.question_category === 'listening' &&
      ['verbal_expression', 'quick_response'].includes(q.assessment_meta.itemType);
    const validOptionCount = policy.version === N4_ASSESSMENT_VERSION ? [3,4].includes(q.options?.length) : q.options?.length === (audioChoices ? 3 : 4);
    if (q.question_type !== 'multiple_choice' || !validOptionCount || q.options.filter(o => o.is_correct === true).length !== 1) throw new Error('assessment_bank_invalid');
    if (final && (new Set(q.options.map(o => o.id)).size !== q.options.length || new Set(q.options.map(o => o.option_text)).size !== q.options.length)) throw new Error('assessment_bank_invalid');
    if (audioChoices && q.options.some((o,i) => o.option_text !== `${i+1}ばん`)) throw new Error('assessment_bank_invalid');
    if (q.question_category === 'reading' && !q.passage?.trim()) throw new Error('assessment_bank_invalid');
    if (q.question_category === 'listening' && !q.audio_script?.trim()) throw new Error('assessment_bank_invalid');
  }
  for (const id of objectives) if (!rows.some(q => q.assessment_meta.objective === id)) throw new Error('assessment_bank_invalid');
}

export function createChapterSnapshot(policy, rows, previousForm, random = Math.random) {
  if (policy.selection === 'all') {
    assertChapterForm(policy, rows);
    if (rows.some(q => q.assessment_meta.form !== 'A')) throw new Error('assessment_bank_invalid');
    return structuredClone({ version: policy.version, form: 'ALL',
      policy: { ...policy, ...(isFinalExam(policy) ? finalExamRules(policy) : CHAPTER_POLICY) },
      questions: [...rows].sort((a, b) => a.section_number - b.section_number || a.sort_order - b.sort_order) });
  }
  const form = previousForm === 'A' ? 'B' : previousForm === 'B' ? 'A' : random() < 0.5 ? 'A' : 'B';
  if (isFinalExam(policy) && (rows.length !== finalExamRules(policy).questionsPerForm * 2 || rows.some(q => !['A','B'].includes(q.assessment_meta?.form)))) throw new Error('assessment_bank_invalid');
  // Validate BOTH forms before allowing either one to start.
  for (const name of ['A', 'B']) assertChapterForm(policy, rows.filter(q => q.assessment_meta?.form === name));
  const questions = rows.filter(q => q.assessment_meta.form === form).sort((a, b) => a.sort_order - b.sort_order);
  return structuredClone({ version: policy.version, form, policy: { ...policy, ...(isFinalExam(policy) ? finalExamRules(policy) : CHAPTER_POLICY) }, questions });
}

export function publicChapterQuestions(snapshot) {
  return snapshot.questions.map(q => ({
    id: q.id, question: q.question, question_type: q.question_type,
    question_category: q.question_category, section_number: q.section_number,
    section_label: q.section_label, section_instruction: q.section_instruction,
    passage: q.passage || null, sort_order: q.sort_order,
    ...(q.image_url ? { image_url: q.image_url } : {}),
    has_audio: q.question_category === 'listening',
    ...(['verbal_expression', 'quick_response'].includes(q.assessment_meta?.itemType) ? { preserve_option_order: true } : {}),
    options: (q.options || []).map(o => ({ id: o.id, option_text: o.option_text, sort_order: o.sort_order })),
  }));
}

export function gradeChapterAssessment(snapshot, answersByQuestion) {
  assertChapterForm(snapshot.policy, snapshot.questions);
  const correctByQuestion = Object.fromEntries(snapshot.questions.map(q => [q.id, answersByQuestion.get(q.id)?.correct === true]));
  const policy = snapshot.policy;
  if(isJlptEstimate(policy)) {
    const scoreReport=gradeJlptEstimate(policy,snapshot.questions,correctByQuestion);
    return {score:Object.values(correctByQuestion).filter(Boolean).length,total:snapshot.questions.length,correctByQuestion,
      scoreReport,sectionResults:scoreReport.sections,objectiveResults:[],passed:scoreReport.passed};
  }
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
      ...(q.image_url ? { imageUrl: q.image_url } : {}),
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
