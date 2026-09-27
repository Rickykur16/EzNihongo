import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cards} from '../content/bunpou/completeness.mjs';

export function buildMigration() {
 return `-- Teaching-card completion, based on the live 36-lesson audit, 2026-09-27.
-- Run transactionally by migrations/run.js. IDs, lesson order, titles, progress,
-- assessment banks, character voices and frozen student snapshots are retained.
CREATE TABLE IF NOT EXISTS n5_bunpou_content_backup_176 (
 grammar_id UUID PRIMARY KEY, before_grammar JSONB NOT NULL,
 before_examples JSONB NOT NULL, after_grammar JSONB, after_examples JSONB
);
DO $complete$
DECLARE
 plan JSONB := $data$${JSON.stringify(cards)}$data$::jsonb;
 item JSONB; ex JSONB; g RECORD; found_count INT; gid UUID; next_order INT;
 scene JSONB; profiles JSONB; new_dialog TEXT; new_translation TEXT;
 speaker_a TEXT; speaker_b TEXT;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('characterKey',s.character_key,
   'position',CASE WHEN s.character_key='anna-wijaya' THEN 'left' ELSE 'right' END,
   'speaker',CASE WHEN s.character_key='anna-wijaya' THEN 'A' ELSE 'B' END,
   'displayName',s.default_display_name,'voiceId',s.voice_id,'voiceName',s.voice_name,
   'profileVersion',s.profile_version,'custom',false) ORDER BY s.character_key)
 INTO profiles FROM dialogue_speakers s
 WHERE s.character_key IN ('anna-wijaya','hadi-pratama') AND coalesce(s.voice_id,'')<>'';

 FOR item IN SELECT value FROM jsonb_array_elements(plan) LOOP
   SELECT count(*),(array_agg(mg.id))[1] INTO found_count,gid
   FROM module_grammar mg JOIN lessons l ON l.id=mg.lesson_id
   JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
   WHERE c.slug='n5' AND l.slug=item->>'lesson' AND mg.pattern=item->>'pattern';
   IF found_count<>1 THEN
     RAISE EXCEPTION '176: missing/ambiguous teaching card % / %',item->>'lesson',item->>'pattern';
   END IF;
   SELECT * INTO STRICT g FROM module_grammar WHERE id=gid FOR UPDATE;
   -- A deliberate re-run never overwrites later teacher edits.
   IF EXISTS(SELECT 1 FROM n5_bunpou_content_backup_176 WHERE grammar_id=gid) THEN CONTINUE; END IF;
   INSERT INTO n5_bunpou_content_backup_176(grammar_id,before_grammar,before_examples)
   SELECT gid,to_jsonb(g),coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.sort_order,e.id)
     FILTER(WHERE e.id IS NOT NULL),'[]'::jsonb) FROM grammar_examples e WHERE e.grammar_id=gid;

   UPDATE module_grammar SET notes=item->>'notes',meaning=coalesce(item->>'meaning',meaning),updated_at=now() WHERE id=gid;
   FOR ex IN SELECT value FROM jsonb_array_elements(coalesce(item->'replaceExamples','[]')) LOOP
     UPDATE grammar_examples SET japanese=ex->>1,highlight=ex->>2,indonesian=ex->>3,updated_at=now()
       WHERE grammar_id=gid AND japanese=ex->>0;
     -- Keep the legacy single-example fallback in sync only when it matches.
     UPDATE module_grammar SET example=ex->>1 WHERE id=gid AND example=ex->>0;
   END LOOP;
   FOR ex IN SELECT value FROM jsonb_array_elements(coalesce(item->'translateExamples','[]')) LOOP
     UPDATE grammar_examples SET indonesian=ex->>1,updated_at=now()
       WHERE grammar_id=gid AND japanese=ex->>0 AND nullif(trim(indonesian),'') IS NULL;
     IF NOT EXISTS(SELECT 1 FROM grammar_examples WHERE grammar_id=gid AND japanese=ex->>0)
       AND g.example=ex->>0 THEN
       INSERT INTO grammar_examples(grammar_id,japanese,indonesian,sort_order) VALUES(gid,ex->>0,ex->>1,0);
     END IF;
   END LOOP;
   SELECT coalesce(max(sort_order),-1)+1 INTO next_order FROM grammar_examples WHERE grammar_id=gid;
   FOR ex IN SELECT value FROM jsonb_array_elements(item->'addExamples') LOOP
     IF NOT EXISTS(SELECT 1 FROM grammar_examples WHERE grammar_id=gid AND japanese=ex->>'japanese') THEN
       INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order)
         VALUES(gid,ex->>'japanese',ex->>'highlight',ex->>'indonesian',next_order);
       next_order:=next_order+1;
     END IF;
   END LOOP;
   IF nullif(trim(g.example_dialog),'') IS NULL OR coalesce((item->>'replaceDialog')::boolean,false) THEN
     scene:=g.dialog_scene;
     -- Keep custom per-character voices, labels, positions and profile versions.
     -- New dialogues use the configured character profiles, never invented IDs.
     IF scene IS NULL AND jsonb_array_length(profiles)=2 THEN
       scene:=jsonb_build_object('schemaVersion',1,'enabled',true,'backgroundKey','classroom','participants',profiles);
     END IF;
     speaker_a:=coalesce((SELECT p->>'speaker' FROM jsonb_array_elements(scene->'participants') p WHERE p->>'position'='left'),'A');
     speaker_b:=coalesce((SELECT p->>'speaker' FROM jsonb_array_elements(scene->'participants') p WHERE p->>'position'='right'),'B');
     -- Replace only line prefixes, without chained replacements or changing speech.
     SELECT string_agg(CASE left(line,2) WHEN 'A:' THEN speaker_a||substr(line,2)
       WHEN 'B:' THEN speaker_b||substr(line,2) ELSE line END,E'\n' ORDER BY ord)
       INTO new_dialog FROM unnest(string_to_array(item->>'dialog',E'\n')) WITH ORDINALITY t(line,ord);
     SELECT string_agg(CASE left(line,2) WHEN 'A:' THEN speaker_a||substr(line,2)
       WHEN 'B:' THEN speaker_b||substr(line,2) ELSE line END,E'\n' ORDER BY ord)
       INTO new_translation FROM unnest(string_to_array(item->>'translation',E'\n')) WITH ORDINALITY t(line,ord);
     UPDATE module_grammar SET example_dialog=new_dialog,example_dialog_id=new_translation,
       dialog_scene=scene,dialog_furigana=NULL WHERE id=gid;
   END IF;
   FOR ex IN SELECT value FROM jsonb_array_elements(coalesce(item->'dialogReplacements','[]')) LOOP
     IF position(ex->>0 IN g.example_dialog)>0 THEN
       UPDATE module_grammar SET example_dialog=replace(example_dialog,ex->>0,ex->>1),dialog_furigana=NULL WHERE id=gid;
     END IF;
   END LOOP;
   FOR ex IN SELECT value FROM jsonb_array_elements(coalesce(item->'translationReplacements','[]')) LOOP
     UPDATE module_grammar SET example_dialog_id=replace(example_dialog_id,ex->>0,ex->>1) WHERE id=gid;
   END LOOP;
   -- Existing question/companion fingerprints naturally become stale when their
   -- source changes. Never forge publication readiness or regrade frozen answers.
   IF NOT EXISTS(SELECT 1 FROM grammar_examples WHERE grammar_id=gid)
     AND nullif(trim(g.example),'') IS NULL THEN
     RAISE EXCEPTION '176: teaching card without examples %',gid;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM module_grammar WHERE id=gid AND nullif(trim(example_dialog),'') IS NOT NULL) THEN
     RAISE EXCEPTION '176: teaching card without dialogue %',gid;
   END IF;
   UPDATE n5_bunpou_content_backup_176 SET
     after_grammar=(SELECT to_jsonb(mg) FROM module_grammar mg WHERE id=gid),
     after_examples=(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.sort_order,e.id),'[]'::jsonb)
       FROM grammar_examples e WHERE grammar_id=gid) WHERE grammar_id=gid;
 END LOOP;
 RAISE NOTICE '176: completed % N5 teaching cards across 36 lessons',jsonb_array_length(plan);
END;
$complete$;
`;
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
 fs.writeFileSync(new URL('../migrations/176_bunpou_content_completeness.sql',import.meta.url),buildMigration());
 console.log('Built revision for',cards.length,'cards');
}
