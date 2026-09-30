import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dialogueCatalog, normalizeDialogScene } from '../src/dialogue-scene.js';
import { dialogueFingerprint, questionFingerprint } from '../src/dialogue-question-service.js';

export const planUrl = new URL('../content/n5-support/dialogue-support.json', import.meta.url);
export const migrationUrl = new URL('../migrations/186_n5_dialogue_support.sql', import.meta.url);
export const manifestVersion = 'n5-b3-b20-dialogue-support-v1';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object'
  ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
export const manifestHash = plan => 'sha256:'+createHash('sha256').update(JSON.stringify(canonical(plan))).digest('hex');
const subset = (value,keys) => Object.fromEntries(keys.map(k=>[k,value[k]??null]));
export const coreFields = ['id','module_id','lesson_id','pattern','meaning','example','notes','sort_order'];

// Voice references are deliberately absent from the source manifest. The apply
// transaction takes the current configured voice from each existing profile.
export function sceneStructure(scene) {
  if(scene==null) return null;
  return {...subset(scene,['schemaVersion','enabled','backgroundKey']),
    participants:(scene.participants||[]).map(p=>subset(p,['characterKey','position','speaker','displayName'])),
    expressions:scene.expressions??null};
}

export function buildPlan({course,inventory,authored,questionContexts,capturedAt}) {
  if(inventory.length!==97 || authored.length!==97 || new Set(authored.map(i=>i.grammarId)).size!==97) throw Error('Expected exactly 97 reviewed dialogues');
  const owners=new Map(course.modules.flatMap(m=>m.lessons.flatMap(l=>(l.grammar||[]).map(g=>[g.id,g]))));
  const chapters=course.modules.filter(m=>m.sort_order>=3&&m.sort_order<=20).map(m=>({id:m.id,slug:m.slug,sortOrder:m.sort_order}));
  const allLessons=course.modules.flatMap(m=>m.lessons);
  const questionById=new Map(questionContexts.map(q=>[q.grammarId,q]));
  const items=inventory.map(source=>{
    const input=authored.find(a=>a.grammarId===source.grammarId);
    const g=owners.get(source.grammarId),q=questionById.get(source.grammarId);
    if(!input || !g || (!q && !input.keepQuestions) || g.lesson_id!==source.sourceLessonId || input.chapter!==source.chapter) throw Error('Missing source context '+source.grammarId);
    if(q && (q.sourceLessonId!==g.lesson_id || (q.dialogueFingerprint && q.dialogueFingerprint!==dialogueFingerprint(g)))) throw Error('Source questions changed '+source.grammarId);
    if(input.cast.length!==2 || new Set(input.cast).size!==2 || input.turns.length<4 || input.turns.length>6 || !input.goal?.trim()) throw Error('Invalid dialogue '+g.id);
    const participants=input.cast.map((key,index)=>{
      const character=dialogueCatalog.characters.find(c=>c.key===key);
      if(!character) throw Error('Unknown character '+key);
      const original=g.dialog_scene?.participants?.find(p=>p.speaker===(index?'B':'A'));
      return {characterKey:key,position:index?'right':'left',speaker:index?'B':'A',
        displayName:input.keepQuestions ? original?.displayName : character.displayName,
        voiceId:null,voiceName:'',profileVersion:1,custom:false};
    });
    for(const turn of input.turns) if(!['A','B'].includes(turn.speaker) || !turn.japanese?.trim() || !turn.indonesian?.trim()) throw Error('Invalid turn '+g.id);
    const scene=normalizeDialogScene({schemaVersion:1,enabled:true,backgroundKey:input.backgroundKey,participants,
      expressions:input.turns.map(t=>t.expression?{speaker:t.speaker,text:t.japanese,expression:t.expression}:null)});
    const replacement={example_dialog:input.turns.map(t=>t.speaker+': '+t.japanese).join('\n'),
      example_dialog_id:input.turns.map(t=>t.speaker+': '+t.indonesian).join('\n'),communication_goal:input.goal,
      dialog_scene:scene,dialog_furigana:input.keepQuestions ? g.dialog_furigana??null : null};
    const fingerprint=dialogueFingerprint(replacement);
    if(input.keepQuestions && (input.chapter!==3 || fingerprint!==dialogueFingerprint(g))) throw Error('Bab 3 dialogue fingerprint must remain unchanged '+g.id);
    if(!input.keepQuestions && input.chapter===3) throw Error('Bab 3 questions must be preserved');
    const questions=input.keepQuestions?[]:input.questions.map((question,index)=>{
      if(!['comprehension','transfer'].includes(question.kind) || !question.prompt?.trim() || !question.explanation?.trim() ||
        question.options?.length!==3 || new Set(question.options.map(s=>s.trim())).size!==3 || !Number.isInteger(question.correctIndex) || question.correctIndex<0 || question.correctIndex>2) throw Error('Invalid question '+g.id);
      if(question.kind==='comprehension' && (!question.evidence?.length || question.evidence.some(e=>!input.turns[e.turnIndex]?.japanese.includes(e.quote)))) throw Error('Ungrounded question '+g.id);
      if(question.kind==='transfer' && question.evidence!=null) throw Error('Transfer cannot claim dialogue evidence '+g.id);
      return {...question,sortOrder:0};
    });
    if(!input.keepQuestions && (questions.length!==2 || new Set(questions.map(q=>q.kind)).size!==2)) throw Error('Expected one comprehension and one transfer question '+g.id);
    return {grammarId:g.id,chapter:input.chapter,moduleId:g.module_id,sourceLessonId:g.lesson_id,
      conversationLessonId:source.conversationLessonId,keepQuestions:!!input.keepQuestions,
      expectedCore:subset(g,coreFields),expectedSource:{...subset(g,['example_dialog','example_dialog_id','communication_goal','dialog_furigana']),dialog_scene:sceneStructure(g.dialog_scene)},
      expectedTaskLessonIds:allLessons.filter(l=>(l.grammarTask||[]).some(t=>t.id===g.id)).map(l=>l.id).sort(),
      expectedQuestions:q?{dialogueFingerprint:q.dialogueFingerprint??dialogueFingerprint(g),questionsRevision:q.questionsRevision??null,questions:q.questions}:null,
      replacement,dialogueFingerprint:fingerprint,questions};
  });
  const lessonIds=[...new Set(items.flatMap(i=>[i.sourceLessonId,i.conversationLessonId]))];
  return {version:manifestVersion,courseId:course.id,capturedAt,chapters,
    lessons:lessonIds.map(id=>subset(allLessons.find(l=>l.id===id),['id','module_id','slug','type','conversation_source_lesson_id'])),items};
}

export function buildMigration(plan) {
  return `-- Stage the reviewed dialogue manifest. Content is applied atomically by
-- finalize-n5-dialogue-support.mjs, using the existing question version service.
CREATE TABLE IF NOT EXISTS n5_dialogue_plan_186 (
  version TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL,content JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS n5_dialogue_backup_186 (
  course_id UUID PRIMARY KEY,manifest_hash TEXT NOT NULL,
  before_grammar JSONB NOT NULL,before_lessons JSONB NOT NULL,before_questions JSONB NOT NULL,
  report JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $migration$
DECLARE reviewed JSONB := $content$${JSON.stringify(plan)}$content$::jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM n5_dialogue_plan_186 WHERE version='${manifestVersion}'
    AND (manifest_hash<>'${manifestHash(plan)}' OR content IS DISTINCT FROM reviewed)) THEN
    RAISE EXCEPTION '186: staged dialogue manifest differs from reviewed content';
  END IF;
  INSERT INTO n5_dialogue_plan_186(version,manifest_hash,content)
    VALUES('${manifestVersion}','${manifestHash(plan)}',reviewed) ON CONFLICT(version) DO NOTHING;
END
$migration$;
`;
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) {
    const plan=JSON.parse(fs.readFileSync(planUrl,'utf8'));
    if(fs.readFileSync(migrationUrl,'utf8').replaceAll('\r\n','\n')!==buildMigration(plan)) throw Error('Regenerate dialogue migration 186');
  } else if(process.argv.includes('--migration-only')) fs.writeFileSync(migrationUrl,buildMigration(JSON.parse(fs.readFileSync(planUrl,'utf8'))));
  else {
    const baseline=JSON.parse(fs.readFileSync(process.argv[2]||new URL('../../../n5-support-audit/live-course-after.json',import.meta.url),'utf8'));
    const inventory=JSON.parse(fs.readFileSync(new URL('../../../n5-support-audit/dialogue-inventory.json',import.meta.url),'utf8'));
    const context=JSON.parse(fs.readFileSync(process.argv[3]||new URL('../../../n5-support-audit/dialogue-context.json',import.meta.url),'utf8').replace(/^\uFEFF/u,''));
    const authored=(await Promise.all(['03','04-11','12-20'].map(x=>import('../content/n5-support/dialogues-'+x+'.mjs')))).flatMap(m=>m.default);
    const plan=buildPlan({course:baseline.course,inventory,authored,questionContexts:context.questions,capturedAt:context.capturedAt});
    fs.writeFileSync(planUrl,JSON.stringify(plan,null,2)+'\n');fs.writeFileSync(migrationUrl,buildMigration(plan));
    console.log(JSON.stringify({dialogues:plan.items.length,rewritten:plan.items.filter(i=>!i.keepQuestions).length,questions:plan.items.flatMap(i=>i.questions).length,manifestHash:manifestHash(plan)}));
  }
}
