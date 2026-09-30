import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { getCurriculumBoundary } from './curriculum-boundary.js';
import { validateContentAgainstBoundary } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';
import { dialogueFingerprint, questionsRevision, saveDialogueQuestions } from './dialogue-question-service.js';
import { normalizeDialogScene } from './dialogue-scene.js';
import { coreFields, manifestHash, manifestVersion, planUrl, sceneStructure } from '../scripts/build-n5-dialogue-support.mjs';

const fail=(code,details)=>{const e=new Error(code);e.details=details;throw e;};
const subset=(value,keys)=>Object.fromEntries(keys.map(k=>[k,value[k]??null]));
const compare=(actual,expected,code,details)=>{if(!isDeepStrictEqual(actual,expected))fail(code,details);};
const questionContent=q=>({kind:q.kind,prompt:q.prompt,options:q.options,correctIndex:q.correctIndex??q.correct_index,
  explanation:q.explanation,evidence:q.evidence??null,sortOrder:q.sortOrder??q.sort_order??0});
const sortedQuestions=rows=>rows.map(questionContent).sort((a,b)=>a.kind.localeCompare(b.kind)||a.sortOrder-b.sortOrder);

// All writes, boundary reports, old-question archival and the completion marker
// share one transaction. No student history, speaker profile, or art row is edited.
export async function finalizeN5DialogueSupport({transaction=withTransaction,resolveBoundary=getCurriculumBoundary,
  saveQuestions=saveDialogueQuestions,plan:providedPlan=null}={}) {
  const plan=providedPlan??JSON.parse(await readFile(planUrl,'utf8'));
  const hash=manifestHash(plan);
  return transaction(async client=>{
    const staged=(await client.query('SELECT * FROM n5_dialogue_plan_186 WHERE version=$1 FOR SHARE',[manifestVersion])).rows[0];
    if(!staged || staged.manifest_hash!==hash || !isDeepStrictEqual(staged.content,plan))fail('n5_dialogue_reviewed_manifest_mismatch');
    await lockCurriculumCourse(client,plan.courseId);
    const done=(await client.query('SELECT manifest_hash,report FROM n5_dialogue_backup_186 WHERE course_id=$1',[plan.courseId])).rows[0];
    if(done){
      if(done.manifest_hash!==hash)fail('n5_dialogue_applied_manifest_mismatch');
      if(done.report?.status!=='finalized')fail('n5_dialogue_incomplete_backup');
      return {...done.report,status:'already_finalized'};
    }
    if(plan.items.length!==97 || new Set(plan.items.map(i=>i.grammarId)).size!==97)fail('n5_dialogue_invalid_plan');
    const course=(await client.query('SELECT id,slug,curriculum_boundary_mode FROM courses WHERE id=$1 FOR SHARE',[plan.courseId])).rows[0];
    if(course?.slug!=='n5')fail('n5_dialogue_course_changed');
    const modules=(await client.query('SELECT id,slug,sort_order FROM modules WHERE course_id=$1 ORDER BY id FOR UPDATE',[plan.courseId])).rows;
    for(const c of plan.chapters) compare(modules.find(m=>m.id===c.id),{id:c.id,slug:c.slug,sort_order:c.sortOrder},'n5_dialogue_module_changed',c.id);
    const ids=plan.items.map(i=>i.grammarId),sourceIds=[...new Set(plan.items.map(i=>i.sourceLessonId))];
    // N5 source edits also change boundary fingerprints of dependent courses.
    // Refuse an unseen active consumer rather than silently invalidating it or
    // widening this migration to questions outside the reviewed 97 dialogues.
    const external=(await client.query(`WITH RECURSIVE affected(id) AS (
      SELECT $1::uuid UNION SELECT p.course_id FROM course_prerequisites p JOIN affected a ON a.id=p.prerequisite_course_id
    ) SELECT q.id,q.grammar_id,m.course_id FROM grammar_dialog_questions q
      JOIN module_grammar g ON g.id=q.grammar_id JOIN modules m ON m.id=g.module_id
      WHERE q.state='active' AND m.course_id IN (SELECT id FROM affected)
        AND NOT(q.grammar_id=ANY($2::uuid[])) ORDER BY q.id FOR SHARE OF q`,[plan.courseId,ids])).rows;
    if(external.length)fail('n5_dialogue_active_questions_outside_scope',external);
    const lessonIds=plan.lessons.map(l=>l.id);
    const lessons=(await client.query('SELECT * FROM lessons WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[lessonIds])).rows;
    for(const expected of plan.lessons) compare(subset(lessons.find(l=>l.id===expected.id)||{},Object.keys(expected)),expected,'n5_dialogue_lesson_changed',expected.id);
    const consumers=(await client.query("SELECT id,conversation_source_lesson_id FROM lessons WHERE type='conversation' AND conversation_source_lesson_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",[sourceIds])).rows;
    compare(consumers,plan.lessons.filter(l=>l.type==='conversation').map(l=>({id:l.id,conversation_source_lesson_id:l.conversation_source_lesson_id})).sort((a,b)=>a.id.localeCompare(b.id)),'n5_dialogue_conversation_membership_changed');
    const grammar=(await client.query('SELECT * FROM module_grammar WHERE lesson_id=ANY($1::uuid[]) OR id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[sourceIds,ids])).rows;
    compare(grammar.map(g=>g.id).sort(),[...ids].sort(),'n5_dialogue_grammar_membership_changed');
    const taskItems=(await client.query('SELECT lesson_id,grammar_id FROM lesson_grammar_task_items WHERE grammar_id=ANY($1::uuid[]) ORDER BY grammar_id,lesson_id FOR UPDATE',[ids])).rows;
    const oldQuestions=(await client.query('SELECT * FROM grammar_dialog_questions WHERE grammar_id=ANY($1::uuid[]) ORDER BY grammar_id,kind,sort_order,id FOR UPDATE',[ids])).rows;
    const characterKeys=[...new Set(plan.items.flatMap(i=>i.replacement.dialog_scene.participants.map(p=>p.characterKey)))];
    if(characterKeys.length!==6)fail('n5_dialogue_expected_six_existing_characters');
    const profiles=(await client.query('SELECT * FROM dialogue_speakers WHERE character_key=ANY($1::text[]) ORDER BY character_key FOR SHARE',[characterKeys])).rows;
    if(profiles.length!==6 || profiles.some(p=>!/^[-_a-zA-Z0-9]{1,100}$/.test(p.voice_id||'') || !Number.isInteger(p.profile_version) || p.profile_version<1))fail('n5_dialogue_voice_profile_unconfigured');
    const art=(await client.query('SELECT character_key,expression_key FROM dialogue_character_art WHERE character_key=ANY($1::text[]) FOR SHARE',[characterKeys])).rows;
    const sourceReports=[],prepared=[];

    // Verify the entire captured scope before writing any dialogue or question.
    for(const item of plan.items){
      const g=grammar.find(g=>g.id===item.grammarId),old=oldQuestions.filter(q=>q.grammar_id===g.id);
      compare(subset(g,coreFields),item.expectedCore,'n5_dialogue_core_changed',g.id);
      compare({...subset(g,['example_dialog','example_dialog_id','communication_goal','dialog_furigana']),dialog_scene:sceneStructure(g.dialog_scene)},item.expectedSource,'n5_dialogue_source_changed',g.id);
      compare(taskItems.filter(t=>t.grammar_id===g.id).map(t=>t.lesson_id).sort(),item.expectedTaskLessonIds,'n5_dialogue_task_membership_changed',g.id);
      if(old.some(q=>q.source_lesson_id!==item.sourceLessonId))fail('n5_dialogue_question_owner_changed',g.id);
      if(!item.keepQuestions){
        compare(sortedQuestions(old.filter(q=>q.state==='active')),sortedQuestions(item.expectedQuestions.questions),'n5_dialogue_questions_changed',g.id);
        if(item.expectedQuestions.questionsRevision && questionsRevision(old)!==item.expectedQuestions.questionsRevision)fail('n5_dialogue_question_revision_changed',g.id);
        if(lessons.find(l=>l.id===item.sourceLessonId).bunpou_flow_published)fail('n5_dialogue_published_companion_requires_review',g.id);
      }
      const scene=normalizeDialogScene({...item.replacement.dialog_scene,participants:item.replacement.dialog_scene.participants.map(p=>{
        const profile=profiles.find(s=>s.character_key===p.characterKey);
        return {...p,voiceId:profile.voice_id,voiceName:profile.voice_name||'',profileVersion:profile.profile_version,custom:false};
      })});
      for(const line of scene.expressions||[]) if(line){
        const character=scene.participants.find(p=>p.speaker===line.speaker)?.characterKey;
        if(!art.some(a=>a.character_key===character&&a.expression_key===line.expression))fail('n5_dialogue_expression_not_uploaded',{grammarId:g.id,character,expression:line.expression});
      }
      const replacement={...item.replacement,dialog_scene:scene};
      if(dialogueFingerprint(replacement)!==item.dialogueFingerprint)fail('n5_dialogue_generated_fingerprint_mismatch',g.id);
      if(item.keepQuestions){
        if(dialogueFingerprint(g)!==item.dialogueFingerprint || old.filter(q=>q.state==='active').some(q=>q.dialogue_fingerprint!==item.dialogueFingerprint))fail('n5_dialogue_preserved_question_stale',g.id);
      }
      prepared.push({item,g,old,replacement});
    }

    await client.query(`INSERT INTO n5_dialogue_backup_186(course_id,manifest_hash,before_grammar,before_lessons,before_questions,report)
      SELECT $1,$2,
        (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM module_grammar g WHERE g.id=ANY($3::uuid[])),
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM lessons l WHERE l.id=ANY($4::uuid[])),
        coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.grammar_id,q.kind,q.sort_order,q.id)
          FROM grammar_dialog_questions q WHERE q.grammar_id=ANY($3::uuid[])),'[]'::jsonb),
        '{"status":"applying"}'::jsonb`,[plan.courseId,hash,ids,lessonIds]);
    const questionResults=[];
    // Boundary fingerprints include every source dialogue in the course. Write
    // all reviewed sources first, then validate/version questions against that
    // final state, so early questions cannot become stale later in this loop.
    for(const {item,g,old,replacement} of prepared){
      await client.query(`UPDATE module_grammar SET example_dialog=$2,example_dialog_id=$3,communication_goal=$4,
        dialog_scene=$5::jsonb,dialog_furigana=$6::jsonb WHERE id=$1`,[g.id,replacement.example_dialog,replacement.example_dialog_id,
        replacement.communication_goal,JSON.stringify(replacement.dialog_scene),replacement.dialog_furigana==null?null:JSON.stringify(replacement.dialog_furigana)]);
    }
    for(const {item,g,old,replacement} of prepared){
      const boundary=await resolveBoundary({grammarId:g.id,lessonId:item.sourceLessonId},{dbQuery:client.query.bind(client)});
      if(boundary.course?.id!==plan.courseId || boundary.course?.mode!==course.curriculum_boundary_mode)fail('n5_dialogue_boundary_context_mismatch',g.id);
      if(!item.keepQuestions){
        const evaluated=validateContentAgainstBoundary({boundary,contentType:'grammar_dialog',operation:'live_write',
          communicationGoal:replacement.communication_goal,contentIsNewOrChanged:true,
          fields:[{path:'dialogue',text:replacement.example_dialog},{path:'translation',text:replacement.example_dialog_id}]});
        const report=course.curriculum_boundary_mode==='off' && !['schema_invalid','context_invalid'].includes(evaluated.status)
          ? {...evaluated,status:'not_run',valid:null,violations:[],warnings:[]} : evaluated;
        const decision=decideBoundaryAction({mode:course.curriculum_boundary_mode,operation:'live_write',report});
        if(!decision.canProceed)fail('n5_dialogue_boundary_rejected',{grammarId:g.id,report,decision});
        sourceReports.push({grammarId:g.id,status:report.status,decision:decision.decision,boundaryFingerprint:report.boundaryFingerprint});
      }
      {
        // Preserve Bab 3's exact IDs, versions, text and answer keys; the service
        // refreshes its boundary metadata after the later chapters change.
        const questions=item.keepQuestions ? old.filter(q=>q.state==='active').map(q=>({id:q.id,...questionContent(q)})) : item.questions;
        const result=await saveQuestions(g.id,{sourceLessonId:item.sourceLessonId,expectedDialogueFingerprint:item.dialogueFingerprint,
          expectedQuestionsRevision:questionsRevision(old),questions},{transaction:fn=>fn(client),
          rejectedReportTransaction:fn=>fn(client),resolveBoundary:async()=>boundary});
        if(result.questions.length!==2 || result.questions.some(q=>!q.current))fail('n5_dialogue_question_write_incomplete',g.id);
        if(item.keepQuestions && result.questions.some(q=>!old.some(o=>o.id===q.id&&o.question_version===q.questionVersion)))fail('n5_dialogue_preserved_question_version_changed',g.id);
        questionResults.push({grammarId:g.id,preserved:item.keepQuestions,questions:result.questions.map(q=>({id:q.id,version:q.questionVersion}))});
      }
    }
    const report={status:'finalized',courseId:plan.courseId,dialogues:97,rewritten:91,preserved:6,
      newQuestions:questionResults.filter(r=>!r.preserved).reduce((sum,r)=>sum+r.questions.length,0),
      preservedQuestions:questionResults.filter(r=>r.preserved).reduce((sum,r)=>sum+r.questions.length,0),boundaryMode:course.curriculum_boundary_mode,
      questionResults,sourceReports};
    await client.query('UPDATE n5_dialogue_backup_186 SET report=$2::jsonb WHERE course_id=$1',[plan.courseId,JSON.stringify(report)]);
    return report;
  });
}
