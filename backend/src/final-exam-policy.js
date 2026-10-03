// Historical classroom rules and versioned estimates using JLPT pass thresholds.
// Official IRT calibration is unavailable; estimates use rounded linear section scores.
export const JLPT_SCORING_VERSION = 'jlpt-linear-v1';
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
export function isJlptEstimate(policy) {
 return isFinalExam(policy) && policy.version.endsWith('-v2') && policy.scoringVersion === JLPT_SCORING_VERSION;
}
export function finalExamRules(policy) {
 const spec=FINAL_EXAMS[policy?.version];
 if(!spec) throw new Error('assessment_bank_invalid');
 if(policy.scoringVersion && !isJlptEstimate(policy)) throw new Error('assessment_bank_invalid');
 if(isJlptEstimate(policy)) {
  const passingScore=spec.level==='n5'?80:90;
  return {scoringVersion:JLPT_SCORING_VERSION,scoreScale:'jlpt_estimate',maximumScore:180,passingScore,
   passingScorePct:passingScore/180*100,categoryMinimumPct:null,minimumObjectiveCorrect:0,questionsPerForm:spec.questionsPerForm,
   scoringSections:[
    {key:'language_reading',sectionLabel:'Kosakata, tata bahasa & membaca',categories:['vocabulary','grammar','reading'],total:120,minimumScore:38},
    {key:'listening',sectionLabel:'Menyimak',categories:['listening'],total:60,minimumScore:19},
   ]};
 }
 return {passingScorePct:70,categoryMinimumPct:50,minimumObjectiveCorrect:1,questionsPerForm:spec.questionsPerForm};
}
export function gradeJlptEstimate(policy,questions,correctByQuestion) {
 const rules=finalExamRules(policy);
 if(!isJlptEstimate(policy))throw new Error('assessment_bank_invalid');
 const sections=rules.scoringSections.map(({categories,...section},i)=>{
  const rows=questions.filter(q=>categories.includes(q.question_category));
  if(!rows.length)throw new Error('assessment_bank_invalid');
  const rawScore=rows.filter(q=>correctByQuestion[q.id]).length;
  const score=Math.round(rawScore/rows.length*section.total);
  return {...section,sectionNumber:i+1,score,rawScore,rawTotal:rows.length,passed:score>=section.minimumScore};
 });
 const score=sections.reduce((sum,s)=>sum+s.score,0);
 const referenceResults=['vocabulary','grammar','reading'].map(category=>{
  const rows=questions.filter(q=>q.question_category===category),correct=rows.filter(q=>correctByQuestion[q.id]).length;
  return {category,correct,total:rows.length,band:correct*100>=rows.length*67?'A':correct*100>=rows.length*34?'B':'C'};
 });
 return {scoringVersion:JLPT_SCORING_VERSION,estimated:true,method:'linear_section_round_half_up',
  score,total:180,passingScore:rules.passingScore,sections,referenceResults,passed:score>=rules.passingScore&&sections.every(s=>s.passed)};
}
