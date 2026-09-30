import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=new URL('../content/n4-support/',import.meta.url);
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]??null]));
export function makeVocabularyPlan(snapshot,authored){
 const course=snapshot.course, owners=new Map(course.modules.flatMap(m=>m.vocabulary).map(v=>[v.id,v]));
 const decks=course.modules.flatMap(m=>m.lessons.filter(l=>l.type==='deck').map(l=>({chapter:m.sort_order,moduleId:m.id,id:l.id,slug:l.slug,ids:l.deck.map(v=>v.id).sort()})));
 const ids=new Set(decks.flatMap(d=>d.ids));
 if(ids.size!==771||authored.items.length!==771||new Set(authored.items.map(i=>i.id)).size!==771)throw Error('Complete all 771 N4 vocabulary items');
 const items=authored.items.map(a=>{
  if(!ids.has(a.id))throw Error('Unknown active vocabulary '+a.id);
  const owner=owners.get(a.id);if(!owner||owner.japanese!==a.japanese)throw Error('Changed source '+a.id);
  const memberships=decks.filter(d=>d.ids.includes(a.id));
  if(memberships.length!==1||memberships[0].chapter!==a.chapter)throw Error('Unexpected N4 membership '+a.id);
  if(!a.examples?.length)throw Error('Missing examples '+a.id);
  return {id:a.id,chapter:a.chapter,expectedCore:pick(owner,['id','module_id','lesson_id','japanese','reading','romaji','indonesian','category','sort_order']),expectedNote:owner.note??null,
   note:[owner.note,a.note].filter(Boolean).join('\n')||null,deckIds:memberships.map(d=>d.id).sort(),
   examples:a.examples.map(e=>({...e,highlight:e.highlight??(e.japanese.includes(a.japanese)?a.japanese:null)}))};
 });
 return {schemaVersion:1,courseId:course.id,capturedAt:snapshot.capturedAt,decks,items};
}
export function vocabularySql(p){return `-- N4 vocabulary supporting examples. No words, readings, meanings, ordering or deck membership changes.
CREATE TABLE IF NOT EXISTS n4_vocabulary_backup_188(id uuid PRIMARY KEY,owner jsonb NOT NULL,examples jsonb NOT NULL,memberships jsonb NOT NULL,created_at timestamptz DEFAULT now());
DO $support$
DECLARE p jsonb := $content$${JSON.stringify(p,null,2)}$content$::jsonb; d jsonb; x jsonb; actual jsonb; n int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:'||(p->>'courseId')));
 SELECT count(*) INTO n FROM n4_vocabulary_backup_188;
 IF n=771 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') i WHERE NOT EXISTS(SELECT 1 FROM n4_vocabulary_backup_188 WHERE id=(i->>'id')::uuid)) THEN RETURN; END IF;
 IF n<>0 THEN RAISE EXCEPTION '188 incomplete backup; inspect before retry'; END IF;
 IF NOT EXISTS(SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4') THEN RAISE EXCEPTION '188 course changed'; END IF;
 LOCK TABLE module_vocabulary,vocabulary_examples,lesson_deck_items IN SHARE ROW EXCLUSIVE MODE;
 FOR d IN SELECT value FROM jsonb_array_elements(p->'decks') LOOP
  IF NOT EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=(d->>'id')::uuid AND l.module_id=(d->>'moduleId')::uuid AND m.course_id=(p->>'courseId')::uuid AND l.slug=d->>'slug' AND l.type='deck') THEN RAISE EXCEPTION '188 deck changed'; END IF;
  SELECT coalesce(jsonb_agg(vocabulary_id::text ORDER BY vocabulary_id::text),'[]') INTO actual FROM lesson_deck_items WHERE lesson_id=(d->>'id')::uuid;
  IF actual IS DISTINCT FROM d->'ids' THEN RAISE EXCEPTION '188 deck membership changed: %',d->>'chapter'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT EXISTS(SELECT 1 FROM module_vocabulary WHERE id=(x->>'id')::uuid AND to_jsonb(module_vocabulary) @> (x->'expectedCore') AND note IS NOT DISTINCT FROM x->>'expectedNote') THEN RAISE EXCEPTION '188 core/note changed: %',x->>'id'; END IF;
  SELECT coalesce(jsonb_agg(lesson_id::text ORDER BY lesson_id::text),'[]') INTO actual FROM lesson_deck_items WHERE vocabulary_id=(x->>'id')::uuid;
  IF actual IS DISTINCT FROM x->'deckIds' THEN RAISE EXCEPTION '188 unexpected cross-course consumer: %',x->>'id'; END IF;
  IF EXISTS(SELECT 1 FROM vocabulary_examples WHERE vocabulary_id=(x->>'id')::uuid) THEN RAISE EXCEPTION '188 examples added since audit: %',x->>'id'; END IF;
 END LOOP;
 INSERT INTO n4_vocabulary_backup_188(id,owner,examples,memberships)
 SELECT v.id,to_jsonb(v),'[]'::jsonb,(SELECT jsonb_agg(to_jsonb(membership) ORDER BY membership.lesson_id) FROM lesson_deck_items membership WHERE membership.vocabulary_id=v.id)
 FROM module_vocabulary v WHERE v.id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(p->'items'));
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  UPDATE module_vocabulary SET note=x->>'note',updated_at=now() WHERE id=(x->>'id')::uuid;
  INSERT INTO vocabulary_examples(vocabulary_id,japanese,reading,highlight,indonesian,sort_order)
   SELECT (x->>'id')::uuid,value->>'japanese',value->>'reading',value->>'highlight',value->>'indonesian',ordinality-1 FROM jsonb_array_elements(x->'examples') WITH ORDINALITY;
 END LOOP;
END $support$;
`;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const snapshot=JSON.parse(fs.readFileSync(process.argv[2]||new URL('../../../n4-material-audit/live-course.json',import.meta.url),'utf8'));
 const authored=JSON.parse(fs.readFileSync(new URL('vocabulary-examples.json',dir),'utf8'));
 const plan=makeVocabularyPlan(snapshot,authored);
 fs.writeFileSync(new URL('vocabulary-plan.json',dir),JSON.stringify(plan,null,2)+'\n');
 fs.writeFileSync(new URL('../migrations/188_n4_vocabulary_support.sql',import.meta.url),vocabularySql(plan));
 console.log(JSON.stringify({items:plan.items.length,examples:plan.items.reduce((n,x)=>n+x.examples.length,0)}));
}
