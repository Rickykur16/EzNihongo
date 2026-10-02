// Classroom raw-score exams, not the official JLPT scaled score.
export const FINAL_EXAMS = Object.freeze({
 'jlpt-final-n5-v1': Object.freeze({level:'n5',blueprint:{vocabulary:25,grammar:25,reading:6,listening:24},questionsPerForm:80}),
 'jlpt-final-n4-v1': Object.freeze({level:'n4',blueprint:{vocabulary:27,grammar:25,reading:10,listening:28},questionsPerForm:90}),
});
export function isFinalExam(policy) { return Object.hasOwn(FINAL_EXAMS,policy?.version || ''); }
export function finalExamRules(policy) {
 const spec=FINAL_EXAMS[policy?.version];
 if(!spec) throw new Error('assessment_bank_invalid');
 return {passingScorePct:70,categoryMinimumPct:50,minimumObjectiveCorrect:1,questionsPerForm:spec.questionsPerForm};
}
