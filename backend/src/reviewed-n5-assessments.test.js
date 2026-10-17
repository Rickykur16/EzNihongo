import test from 'node:test';
import assert from 'node:assert/strict';
import {plans,validateReviewedPlans,editorialRevisionCount} from '../content/assessments/expanded/reviewed.mjs';
import {plans as v5Plans} from '../content/assessments/expanded/index.mjs';
import earlyPatches from '../content/assessments/expanded/review-early.mjs';
import middlePatches from '../content/assessments/expanded/review-middle.mjs';
import latePatches from '../content/assessments/expanded/review-late.mjs';
import visualPatches from '../content/assessments/expanded/review-visual.mjs';
import {
  REVIEWED_N5_ASSESSMENT_VERSION,EXPANDED_N5_ASSESSMENT_VERSION,
  EXPANDED_CHAPTER_BLUEPRINT,assertChapterForm,createChapterSnapshot,
  publicChapterQuestions,publicChapterRules,gradeChapterAssessment,
} from './chapter-assessment.js';

const patches={...earlyPatches,...middlePatches,...latePatches,...visualPatches};
const formsFor=plan=>plan.chapter===3?['A','B']:['A'];
const snapshotFor=(plan,form='A',policy=plan.policy)=>createChapterSnapshot(policy,plan.rows,form==='A'?'B':'A');
const answers=(snapshot,predicate=()=>true)=>new Map(snapshot.questions.map(q=>[q.id,{correct:predicate(q)}]));
const correctIndex=q=>q.options.findIndex(o=>o.is_correct);
const stimulus=q=>[q.question,q.passage,q.audio_script,...(q.assessment_meta.spokenChoices||q.options.map(o=>o.option_text))].filter(Boolean).join('\n');

test('reviewed packets keep unique identities, the 36-item blueprint and at least two direct evidence items per goal/form',()=>{
  assert.equal(validateReviewedPlans(),plans);
  assert.equal(plans.length,18);
  assert.ok(editorialRevisionCount>0);
  const rows=plans.flatMap(p=>p.rows);
  assert.equal(rows.length,684);
  assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
  const options=rows.flatMap(q=>q.options);
  assert.equal(new Set(options.map(o=>o.id)).size,options.length);
  const historicIds=new Set(v5Plans.flatMap(p=>p.rows.map(q=>q.id)));
  assert.ok(rows.every(q=>!historicIds.has(q.id)),'v6 must not reuse the identities of frozen v5 questions');
  for(const plan of plans)for(const form of formsFor(plan)){
    const packet=plan.rows.filter(q=>q.assessment_meta.form===form);
    assert.equal(plan.policy.version,REVIEWED_N5_ASSESSMENT_VERSION);
    assert.equal(packet.length,36);
    assert.doesNotThrow(()=>assertChapterForm(plan.policy,packet));
    for(const [category,count] of Object.entries(EXPANDED_CHAPTER_BLUEPRINT))assert.equal(packet.filter(q=>q.question_category===category).length,count);
    for(const goal of plan.policy.objectives){
      const evidence=packet.filter(q=>q.assessment_meta.objective===goal.id&&q.assessment_meta.objectiveEvidence===true);
      assert.ok(evidence.length>=2,`Bab ${plan.chapter}/${form}/${goal.id} has insufficient direct evidence`);
      assert.ok(evidence.every(q=>!['kanji_reading','orthography'].includes(q.assessment_meta.itemType)),`isolated kanji cannot establish ${goal.id}`);
    }
  }
});

test('all correct answers pass every reviewed packet, while insufficient listening still fails its category',()=>{
  for(const plan of plans)for(const form of formsFor(plan)){
    const snapshot=snapshotFor(plan,form);
    const perfect=gradeChapterAssessment(snapshot,answers(snapshot));
    assert.equal(perfect.score,36);assert.equal(perfect.total,36);assert.equal(perfect.passed,true);
    assert.ok(perfect.objectiveResults.every(g=>g.passed));
    const missed=new Set(snapshot.questions.filter(q=>q.question_category==='listening').slice(0,7).map(q=>q.id));
    const partial=gradeChapterAssessment(snapshot,answers(snapshot,q=>!missed.has(q.id)));
    assert.equal(partial.score,29);
    assert.ok(partial.score*100/partial.total>=snapshot.policy.passingScorePct,'overall passing score must not bypass a failed listening category');
    const listening=partial.sectionResults.find(s=>s.key==='listening');
    assert.equal(listening.score,6);assert.equal(listening.total,13);assert.equal(listening.passed,false);
    assert.equal(partial.passed,false);
  }
});

test('only non-evidence kanji answers cannot satisfy any reviewed objective, even when total/category gates are relaxed',()=>{
  // Bab3 is the identity foundation and has no kanji-reading items.
  for(const plan of plans.filter(p=>p.chapter>3))for(const form of formsFor(plan)){
    const snapshot=snapshotFor(plan,form,{...plan.policy,passingScorePct:1,categoryMinimumPct:0});
    const result=gradeChapterAssessment(snapshot,answers(snapshot,q=>['kanji_reading','orthography'].includes(q.assessment_meta.itemType)));
    assert.ok(result.score>0,'fixture must include correct kanji answers');
    assert.ok(result.sectionResults.every(s=>s.passed),'the goal gate is independently responsible for failure');
    assert.ok(result.objectiveResults.every(g=>g.score===0&&!g.passed));
    assert.equal(result.passed,false);
  }
});

test('a high overall score cannot hide failure on the directly assessed change-state objective',()=>{
  const plan=plans.find(p=>p.chapter===15),snapshot=snapshotFor(plan);
  const result=gradeChapterAssessment(snapshot,answers(snapshot,q=>!(q.assessment_meta.objective==='goal3'&&q.assessment_meta.objectiveEvidence===true)));
  assert.ok(result.score*100/result.total>=snapshot.policy.passingScorePct);
  assert.ok(result.sectionResults.every(s=>s.passed));
  const change=result.objectiveResults.find(g=>g.objectiveId==='goal3');
  assert.equal(change.total,3);assert.equal(change.score,0);assert.equal(change.passed,false);
  assert.equal(result.passed,false);
});

test('snapshots preserve owner thresholds, and v5 history remains a 36-item independently gradable packet',()=>{
  const narrow=plans.find(p=>p.chapter===17);
  assert.throws(()=>snapshotFor(narrow,'A',{...narrow.policy,minimumObjectiveCorrect:3}),/assessment_bank_invalid/,'a bank cannot start with an unreachable owner threshold');
  for(const plan of plans)for(const form of formsFor(plan)){
    const policy={...plan.policy,passingScorePct:91,categoryMinimumPct:75,minimumObjectiveCorrect:2,questionsPerForm:24,ownerNote:'keep owner setting'};
    const snapshot=snapshotFor(plan,form,policy);
    assert.equal(snapshot.policy.passingScorePct,91);assert.equal(snapshot.policy.categoryMinimumPct,75);
    assert.equal(snapshot.policy.minimumObjectiveCorrect,2);assert.equal(snapshot.policy.questionsPerForm,36);
    assert.equal(snapshot.policy.ownerNote,'keep owner setting');
    assert.deepEqual(publicChapterRules(policy),publicChapterRules(snapshot.policy));
    assert.equal(gradeChapterAssessment(snapshot,answers(snapshot)).passed,true);
  }
  for(const old of v5Plans)for(const form of formsFor(old)){
    const snapshot=snapshotFor(old,form);
    assert.equal(snapshot.version,EXPANDED_N5_ASSESSMENT_VERSION);
    const result=gradeChapterAssessment(snapshot,answers(snapshot));
    assert.equal(result.score,36);assert.equal(result.total,36);assert.equal(result.passed,true);
    assert.ok(snapshot.questions.every(q=>q.assessment_meta.version===EXPANDED_N5_ASSESSMENT_VERSION));
  }
});

test('student question payloads expose neither editorial evidence nor private answer/audio material',()=>{
  const forbidden=new Set(['is_correct','correct_answer','audio_script','audio_scene','assessment_meta','spokenChoices','ordered','starPosition','distractorReasons','explanation','objectiveEvidence','revision','sourceId']);
  const inspect=value=>{
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){assert.ok(!forbidden.has(key),`private field ${key} leaked`);inspect(child);}
  };
  for(const plan of plans)for(const form of formsFor(plan)){
    const snapshot=snapshotFor(plan,form),publicRows=publicChapterQuestions(snapshot);
    inspect(publicRows);
    assert.equal(publicRows.length,36);assert.equal(publicRows.filter(q=>q.has_audio).length,13);
    for(const row of publicRows){
      const source=snapshot.questions.find(q=>q.id===row.id);
      if(source.assessment_meta.spokenChoices){
        assert.equal(row.preserve_option_order,true);
        assert.deepEqual(row.options.map(o=>o.option_text),['1ばん','2ばん','3ばん']);
      }
    }
  }
});

test('editorial choice rotation preserves keys, concrete reasons, star positions and the numbered spoken script',()=>{
  for(const plan of plans)for(const row of plan.rows){
    const meta=row.assessment_meta,key=meta.key.replace(/-reviewed$/,''),patch=patches[key];
    assert.equal(row.options.filter(o=>o.is_correct).length,1,key);
    assert.equal(meta.distractorReasons.length,row.options.length,key);
    if(meta.ordered){
      assert.equal(meta.ordered.length,4,key);assert.equal(new Set(meta.ordered).size,4,key);
      assert.ok(Number.isInteger(meta.starPosition)&&meta.starPosition>=0&&meta.starPosition<4,key);
      assert.equal(row.options[correctIndex(row)].option_text,meta.ordered[meta.starPosition],key);
      assert.equal((row.question.match(/★/g)||[]).length,1,key);
    }
    const choices=meta.spokenChoices||row.options.map(o=>o.option_text);
    assert.equal(new Set(choices).size,choices.length,key);
    if(patch?.options){
      assert.equal(choices[correctIndex(row)],patch.options[0],`correct-first authored answer drifted: ${key}`);
      for(const [i,choice] of choices.entries())assert.equal(meta.distractorReasons[i],patch.reasons[patch.options.indexOf(choice)],`reason detached from choice: ${key}`);
    }
    if(meta.spokenChoices){
      assert.equal(choices.length,3,key);
      assert.deepEqual(row.options.map(o=>o.option_text),['1ばん','2ばん','3ばん']);
      const actor=row.image_url?'A':'B';
      const numbered=choices.map((choice,i)=>`N: ${['いちばん','にばん','さんばん'][i]}。\n${actor}: ${choice}`).join('\n');
      assert.ok(row.audio_script.endsWith(numbered),`spoken choice order/key mismatch: ${key}`);
    }
  }
});

test('the swapped early plain-form chapter and late course-boundary repairs do not reintroduce identified future material',()=>{
  const beforePermission=plans.find(p=>p.chapter===14);
  for(const row of beforePermission.rows){
    // Source14 now displays as Bab13. Negative requests and なくてもいい
    // belong here; te requests, ongoing states and permission/prohibition do not.
    // Generic task directions are supported instructions, not the assessed
    // grammar; evaluate the actual situation/utterances/options instead.
    const content=row.assessment_meta.spokenChoices
      ? [row.passage,row.audio_script,...row.assessment_meta.spokenChoices].filter(Boolean).join('\n')
      : stimulus(row);
    const text=content.replace(/\s/g,'').replaceAll('なくてもいい','');
    assert.doesNotMatch(text,/(?<!ない)[てで]ください|[てで](?:います|いました|いません)|[てで]はいけ|[てで]もいい/,row.assessment_meta.key);
  }
  for(const plan of plans.filter(p=>p.chapter>=15))for(const row of plan.rows){
    const text=stimulus(row).replace(/\s/g,'');
    assert.doesNotMatch(text,/だけ|[ただ]あと|さらいげつ|ぬれ/,row.assessment_meta.key);
  }
});

test('generic A/B illustrations describe an audio situation honestly instead of claiming visual evidence for the answer',()=>{
  const generic=plans.flatMap(p=>p.rows).filter(q=>q.image_url==='/assets/assessments/speakers-ab.svg');
  assert.ok(generic.length>0);
  for(const row of generic){
    assert.equal(row.assessment_meta.itemType,'verbal_expression');
    assert.equal(row.section_label,'ばめんに あう ことば');
    assert.match(row.section_instruction,/ばめんと こたえは こえで ききます/);
    assert.doesNotMatch(row.section_label,/えを みて はなす/);
  }
});
