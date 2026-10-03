// Classroom raw-score exams, not the official JLPT scaled score.
export const FINAL_EXAMS = Object.freeze({
 'jlpt-final-n5-v1': Object.freeze({level:'n5',blueprint:{vocabulary:25,grammar:25,reading:6,listening:24},questionsPerForm:80}),
 'jlpt-final-n4-v1': Object.freeze({level:'n4',blueprint:{vocabulary:27,grammar:25,reading:10,listening:28},questionsPerForm:90}),
 // Approximate item counts published by JLPT for tests from December 2020.
 // https://www.jlpt.jp/e/topics/202009091599642827.html
 'jlpt-final-n5-v2': Object.freeze({level:'n5',selection:'alternating',blueprint:{vocabulary:21,grammar:17,reading:5,listening:24},questionsPerForm:67,
  items:{kanji_reading:7,orthography:5,context_vocabulary:6,paraphrase:3,grammar_form:9,sentence_composition:4,text_grammar:4,short_reading:2,medium_reading:2,information_retrieval:1,task_comprehension:7,key_points:6,verbal_expression:5,quick_response:6}}),
 'jlpt-final-n4-v2': Object.freeze({level:'n4',selection:'alternating',blueprint:{vocabulary:28,grammar:21,reading:8,listening:28},questionsPerForm:85,
  items:{kanji_reading:7,orthography:5,context_vocabulary:8,paraphrase:4,usage:4,grammar_form:13,sentence_composition:4,text_grammar:4,short_reading:3,medium_reading:3,information_retrieval:2,task_comprehension:8,key_points:7,verbal_expression:5,quick_response:8}}),
});
export function isFinalExam(policy) { return Object.hasOwn(FINAL_EXAMS,policy?.version || ''); }
export function finalExamRules(policy) {
 const spec=FINAL_EXAMS[policy?.version];
 if(!spec) throw new Error('assessment_bank_invalid');
 return {passingScorePct:70,categoryMinimumPct:50,minimumObjectiveCorrect:1,questionsPerForm:spec.questionsPerForm};
}
