import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dialogueCatalog,normalizeDialogScene} from '../src/dialogue-scene.js';
const dir=new URL('../content/n4-support/',import.meta.url);
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]??null]));
export function makeDialoguePlan(snapshot,authored){
 const sources=snapshot.course.modules.flatMap(m=>m.lessons.filter(l=>l.grammar?.length).map(l=>({chapter:m.sort_order,moduleId:m.id,lesson:l,anchor:l.grammar.slice().sort((a,b)=>a.sort_order-b.sort_order)[0]})));
 if(sources.length!==47||authored.length!==47||new Set(authored.map(a=>a.grammarId)).size!==47)throw Error('Exactly one scene per existing 47 grammar lessons');
 const items=authored.map(a=>{
  const source=sources.find(s=>s.anchor.id===a.grammarId);
  if(!source||source.chapter!==a.chapter||a.cast.length!==2||new Set(a.cast).size!==2||a.turns.length<4||a.turns.length>6||a.checks.length!==2||!a.goal?.trim())throw Error('Invalid scene '+a.grammarId);
  const participants=a.cast.map((key,i)=>{const c=dialogueCatalog.characters.find(c=>c.key===key);if(!c)throw Error('Unknown character');return {characterKey:key,position:i?'right':'left',speaker:i?'B':'A',displayName:c.displayName,voiceId:null,voiceName:'',profileVersion:1,custom:false};});
  for(const t of a.turns)if(!['A','B'].includes(t.speaker)||!t.japanese?.trim()||!t.indonesian?.trim())throw Error('Invalid line');
  for(const q of a.checks)if(!q.prompt?.trim()||!q.answer?.trim()||!q.explanation?.trim())throw Error('Invalid self check');
  const scene=normalizeDialogScene({schemaVersion:1,enabled:true,backgroundKey:a.backgroundKey,participants,expressions:a.turns.map(t=>t.expression?{speaker:t.speaker,text:t.japanese,expression:t.expression}:null)});
  return {grammarId:a.grammarId,chapter:a.chapter,moduleId:source.moduleId,lessonId:source.lesson.id,
   expectedCore:pick(source.anchor,['id','module_id','lesson_id','pattern','meaning','sort_order']),
   expectedDialogue:pick(source.anchor,['example_dialog','example_dialog_id','communication_goal','dialog_scene','dialog_furigana']),
   replacement:{example_dialog:a.turns.map(t=>t.speaker+': '+t.japanese).join('\n'),example_dialog_id:a.turns.map(t=>t.speaker+': '+t.indonesian).join('\n'),communication_goal:a.goal,dialog_scene:scene},checks:a.checks};
 });
 return {schemaVersion:1,courseId:snapshot.course.id,capturedAt:snapshot.capturedAt,items};
}
export function dialogueSql(p){return `-- Conversations remain inline in the existing 47 Canva-aligned grammar lessons.
CREATE TABLE IF NOT EXISTS n4_dialogue_backup_190(grammar_id uuid PRIMARY KEY,before_data jsonb NOT NULL,created_at timestamptz DEFAULT now());
DO $support$
DECLARE p jsonb := $content$${JSON.stringify(p,null,2)}$content$::jsonb; x jsonb; s jsonb; participant jsonb; line jsonb; character text; n int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:'||(p->>'courseId')));
 SELECT count(*) INTO n FROM n4_dialogue_backup_190;
 IF n=47 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') i WHERE NOT EXISTS(SELECT 1 FROM n4_dialogue_backup_190 WHERE grammar_id=(i->>'grammarId')::uuid)) THEN RETURN; END IF;
 IF n<>0 THEN RAISE EXCEPTION '190 incomplete backup'; END IF;
 IF NOT EXISTS(SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4') THEN RAISE EXCEPTION '190 course changed'; END IF;
 LOCK TABLE module_grammar,lessons,dialogue_speakers,dialogue_character_art IN SHARE ROW EXCLUSIVE MODE;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT EXISTS(SELECT 1 FROM module_grammar g JOIN modules m ON m.id=g.module_id JOIN lessons l ON l.id=g.lesson_id WHERE g.id=(x->>'grammarId')::uuid AND m.course_id=(p->>'courseId')::uuid AND l.module_id=m.id AND to_jsonb(g) @> (x->'expectedCore') AND to_jsonb(g) @> (x->'expectedDialogue')) THEN RAISE EXCEPTION '190 dialogue/core changed: %',x->>'grammarId'; END IF;
  IF EXISTS(SELECT 1 FROM grammar_dialog_questions WHERE grammar_id=(x->>'grammarId')::uuid) THEN RAISE EXCEPTION '190 dialogue questions added since audit'; END IF;
  FOR participant IN SELECT value FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') LOOP
   IF NOT EXISTS(SELECT 1 FROM dialogue_speakers WHERE character_key=participant->>'characterKey' AND voice_id ~ '^[-_a-zA-Z0-9]{1,100}$' AND profile_version>=1) THEN RAISE EXCEPTION '190 character voice unconfigured: %',participant->>'characterKey'; END IF;
  END LOOP;
  FOR line IN SELECT value FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'expressions') WHERE value<>'null'::jsonb LOOP
   SELECT value->>'characterKey' INTO character FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') WHERE value->>'speaker'=line->>'speaker';
   IF NOT EXISTS(SELECT 1 FROM dialogue_character_art WHERE character_key=character AND expression_key=line->>'expression') THEN RAISE EXCEPTION '190 expression missing: %/%',character,line->>'expression'; END IF;
  END LOOP;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  INSERT INTO n4_dialogue_backup_190 SELECT id,to_jsonb(module_grammar),now() FROM module_grammar WHERE id=(x->>'grammarId')::uuid;
  SELECT jsonb_set(x->'replacement'->'dialog_scene','{participants}',jsonb_agg(a.value || jsonb_build_object('voiceId',d.voice_id,'voiceName',coalesce(d.voice_name,''),'profileVersion',d.profile_version) ORDER BY a.ordinality)) INTO s
   FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') WITH ORDINALITY a JOIN dialogue_speakers d ON d.character_key=a.value->>'characterKey';
  UPDATE module_grammar SET example_dialog=x->'replacement'->>'example_dialog',example_dialog_id=x->'replacement'->>'example_dialog_id',communication_goal=x->'replacement'->>'communication_goal',dialog_scene=s,dialog_furigana=null,updated_at=now() WHERE id=(x->>'grammarId')::uuid;
 END LOOP;
END $support$;
`;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const snapshot=JSON.parse(fs.readFileSync(process.argv[2]||new URL('../../../n4-material-audit/live-course.json',import.meta.url),'utf8'));
 const authored=(await Promise.all(['01-12','13-24'].map(x=>import('../content/n4-support/dialogues-'+x+'.mjs')))).flatMap(m=>m.default);
 const plan=makeDialoguePlan(snapshot,authored);
 fs.writeFileSync(new URL('dialogue-plan.json',dir),JSON.stringify(plan,null,2)+'\n');
 fs.writeFileSync(new URL('../migrations/190_n4_dialogues.sql',import.meta.url),dialogueSql(plan));
 console.log(JSON.stringify({scenes:plan.items.length,characters:new Set(plan.items.flatMap(i=>i.replacement.dialog_scene.participants.map(p=>p.characterKey))).size}));
}
