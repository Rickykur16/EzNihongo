import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chapters} from '../content/n4-support/chapters.mjs';
import early from '../content/n4-support/assessment-01-12.mjs';
import late from '../content/n4-support/assessment-13-24.mjs';
import {grammarExtra} from '../content/n4-support/assessment-extra.mjs';
import {N4_ASSESSMENT_VERSION as version,CHAPTER_POLICY,CHAPTER_LABELS,assertChapterForm} from '../src/chapter-assessment.js';

const dir=new URL('../content/n4-support/',import.meta.url);
const goalMap=[
 [1,2,2,2,3],[1,1,2,2,3,3],[1,1,1,2,3,3,3],[1,1,2,3],
 [1,2,3,3,3],[1,2,3,3],[1,2,2,3],[1,2,2,3,3,3],
 [1,1,2,3,3,3],[1,1,2,2,1,3],[1,1,2,2,2,3],[1,1,2,3,3],
 [1,1,2,3],[1,2,3],[1,2,2,3,3],[1,2,2,3,3],[1,2,3],
 [1,1,1,2,3,3],[1,2,2,3,3,3],[1,1,2,2,3,3,3],
 [1,2,2,2,3],[1,1,2,3,3,3],[1,1,2,2,3],[1,1,2,3,3,3],
];
const uid=key=>{const b=createHash('md5').update(version+':'+key).digest();b[6]=(b[6]&15)|48;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const rotate=(arr,n)=>arr.slice(n%arr.length).concat(arr.slice(0,n%arr.length));
export function makeAssessmentPlan(snapshot,support,vocabulary){
 const course=snapshot.course;
 if(course.slug!=='n4'||course.modules.length!==24||vocabulary.length!==24)throw Error('Expected all 24 N4 chapters');
 const banks=chapters.map(c=>{
  const m=course.modules.find(m=>m.sort_order===c.chapter),lessons=m.lessons.filter(l=>l.type==='quiz');
  if(lessons.length!==1)throw Error('Ambiguous assignment '+c.chapter);
  const lesson=lessons[0],grammar=support.grammar.filter(g=>g.chapter===c.chapter);
  if(grammar.length!==goalMap[c.chapter-1].length)throw Error('Goal mapping changed '+c.chapter);
  const recognition=grammar.map((g,i)=>({grammarId:g.id,goal:goalMap[c.chapter-1][i],prompt:g.drills.recognition.prompt+'\n'+g.drills.recognition.example.japanese,
   options:g.drills.recognition.options,answer:g.drills.recognition.answer,explanation:g.notes.split('\n').filter(Boolean).slice(0,2).join(' ')}));
  const controlled=grammar.map((g,i)=>({grammarId:g.id,goal:goalMap[c.chapter-1][i],prompt:g.drills.controlled.prompt+'\n'+g.drills.controlled.sentence,
   options:g.drills.controlled.options,answer:g.drills.controlled.answer,explanation:`Kalimat lengkap: ${g.drills.controlled.sentence.replace(/＿＿＿/g,g.drills.controlled.answer)}. ${g.drills.controlled.indonesian||''}`}));
  const grammarQuestions=[...controlled,...recognition.slice(0,Math.max(0,10-grammar.length)),...(grammarExtra[c.chapter]||[])];
  if(grammarQuestions.length!==10)throw Error('Ten grammar questions required '+c.chapter);
  const material=[...early,...late].find(x=>x.chapter===c.chapter),v=vocabulary.find(x=>x.chapter===c.chapter);
  if(v.questions.length!==6||material.reading.length!==4||material.listening.length!==4)throw Error('Blueprint '+c.chapter);
  const policy={version,chapter:c.chapter,title:m.title,selection:'all',...CHAPTER_POLICY,
   objectives:c.cando_statements.map((canDo,i)=>({id:`n4-b${c.chapter}-goal-${i+1}`,canDo})),
   boundary:{grammar:grammar.map(g=>g.expectedCore.pattern),notes:'Latihan bab ini memakai materi N5 serta bab N4 yang sudah dipelajari. Penempatan bunpou mengikuti materi kelas.'}};
  const rows=Object.entries({vocabulary:v.questions,grammar:grammarQuestions,reading:material.reading,listening:material.listening}).flatMap(([category,questions])=>questions.map((q,i)=>{
   if(!q.prompt?.trim()||!q.explanation?.trim()||![1,2,3].includes(q.goal)||new Set(q.options).size!==q.options.length||q.options.filter(x=>x===q.answer).length!==1)throw Error(`Invalid question ${c.chapter}/${category}/${i}`);
   const key=`b${c.chapter}-${category}-${i+1}`,options=rotate(q.options,(c.chapter+i)%q.options.length);
   return {id:uid(key),question:q.prompt,question_type:'multiple_choice',question_category:category,
    section_number:Object.keys(CHAPTER_LABELS).indexOf(category)+1,section_label:CHAPTER_LABELS[category],
    section_instruction:category==='listening'?'Dengarkan audio, lalu pilih jawaban. Audio boleh diputar ulang.':'Pilih satu jawaban sesuai konteks. Jawaban dapat diubah sebelum dikirim.',
    passage:q.passage||null,audio_script:q.audioScript||null,explanation:q.explanation,sort_order:i+1,grammar_id:q.grammarId||null,
    assessment_meta:{version,form:'A',key,objective:`n4-b${c.chapter}-goal-${q.goal}`,...(q.sourceVocabularyId?{sourceVocabularyId:q.sourceVocabularyId}:{}),...(q.sourceKanji?{sourceKanji:q.sourceKanji}:{})},
    options:options.map((s,j)=>({id:uid(key+':o'+j),option_text:s,is_correct:s===q.answer,sort_order:j+1}))};
  }));
  assertChapterForm(policy,rows);
  if(new Set(rows.filter(q=>q.question_category==='reading').map(q=>q.passage)).size!==2||new Set(rows.filter(q=>q.question_category==='listening').map(q=>q.audio_script)).size!==4)throw Error('Reading/audio coverage '+c.chapter);
  const content='24 soal: 6 aksara dan kosakata, 10 tata bahasa, 4 membaca, dan 4 menyimak. Siapkan audio. Lulus dengan total minimal 70%, setiap kategori minimal 50%, dan sekurangnya satu jawaban benar untuk setiap tujuan belajar. Jawaban dapat disimpan dan dilanjutkan. Pembahasan serta transkrip tersedia setelah jawaban dikirim.';
  return {chapter:c.chapter,moduleId:m.id,moduleSlug:m.slug,lessonId:lesson.id,lessonSlug:lesson.slug,expectedContent:lesson.content??null,expectedQuizSpec:m.quiz_spec??null,
   policy,content,quizSpec:{vocabulary:6,grammar:10,reading:4,listening:4,total:24,version},rows};
 });
 return {schemaVersion:1,version,courseId:course.id,capturedAt:snapshot.capturedAt,banks};
}
export function assessmentSql(p){return `-- Populate only the audited empty N4 assignment banks. Preserve all attempts and curriculum placement.
CREATE TABLE IF NOT EXISTS n4_assessment_backup_189(lesson_id uuid PRIMARY KEY,lesson jsonb NOT NULL,module jsonb NOT NULL,created_at timestamptz DEFAULT now());
DO $support$
DECLARE p jsonb := $content$${JSON.stringify(p,null,2)}$content$::jsonb; b jsonb; q jsonb; o jsonb; n int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:'||(p->>'courseId')));
 SELECT count(*) INTO n FROM n4_assessment_backup_189;
 IF n=24 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'banks') x WHERE NOT EXISTS(SELECT 1 FROM n4_assessment_backup_189 WHERE lesson_id=(x->>'lessonId')::uuid)) THEN RETURN; END IF;
 IF n<>0 THEN RAISE EXCEPTION '189 incomplete backup'; END IF;
 IF NOT EXISTS(SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4') THEN RAISE EXCEPTION '189 course changed'; END IF;
 LOCK TABLE modules,lessons,quiz_questions,quiz_options IN SHARE ROW EXCLUSIVE MODE;
 FOR b IN SELECT value FROM jsonb_array_elements(p->'banks') LOOP
  IF NOT EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=(b->>'lessonId')::uuid AND l.module_id=(b->>'moduleId')::uuid AND l.slug=b->>'lessonSlug' AND l.type='quiz' AND m.course_id=(p->>'courseId')::uuid AND m.slug=b->>'moduleSlug') THEN RAISE EXCEPTION '189 placement changed: %',b->>'chapter'; END IF;
  IF EXISTS(SELECT 1 FROM quiz_questions WHERE lesson_id=(b->>'lessonId')::uuid) THEN RAISE EXCEPTION '189 assignment no longer empty: %',b->>'chapter'; END IF;
  IF EXISTS(SELECT 1 FROM lessons WHERE id=(b->>'lessonId')::uuid AND (assessment_policy IS NOT NULL OR content IS DISTINCT FROM b->>'expectedContent')) THEN RAISE EXCEPTION '189 assignment changed: %',b->>'chapter'; END IF;
  IF EXISTS(SELECT 1 FROM modules WHERE id=(b->>'moduleId')::uuid AND coalesce(quiz_spec,'null'::jsonb) IS DISTINCT FROM b->'expectedQuizSpec') THEN RAISE EXCEPTION '189 quiz specification changed: %',b->>'chapter'; END IF;
 END LOOP;
 FOR b IN SELECT value FROM jsonb_array_elements(p->'banks') LOOP
  INSERT INTO n4_assessment_backup_189 SELECT l.id,to_jsonb(l),to_jsonb(m),now() FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=(b->>'lessonId')::uuid;
  FOR q IN SELECT value FROM jsonb_array_elements(b->'rows') LOOP
   INSERT INTO quiz_questions(id,lesson_id,question,question_type,question_category,section_number,section_label,section_instruction,passage,audio_script,explanation,sort_order,assessment_meta,grammar_id)
    VALUES((q->>'id')::uuid,(b->>'lessonId')::uuid,q->>'question',q->>'question_type',q->>'question_category',(q->>'section_number')::int,q->>'section_label',q->>'section_instruction',q->>'passage',q->>'audio_script',q->>'explanation',(q->>'sort_order')::int,q->'assessment_meta',(q->>'grammar_id')::uuid);
   FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
    INSERT INTO quiz_options(id,question_id,option_text,is_correct,sort_order) VALUES((o->>'id')::uuid,(q->>'id')::uuid,o->>'option_text',(o->>'is_correct')::boolean,(o->>'sort_order')::int);
   END LOOP;
  END LOOP;
  UPDATE lessons SET assessment_policy=b->'policy',questions_per_attempt=24,content=b->>'content',updated_at=now() WHERE id=(b->>'lessonId')::uuid;
  UPDATE modules SET quiz_spec=b->'quizSpec',updated_at=now() WHERE id=(b->>'moduleId')::uuid;
 END LOOP;
END $support$;
`;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const snapshot=JSON.parse(fs.readFileSync(process.argv[2]||new URL('../../../n4-material-audit/live-course.json',import.meta.url),'utf8'));
 const support=JSON.parse(fs.readFileSync(new URL('support-plan.json',dir),'utf8'));
 const {default:vocabulary}=await import('../content/n4-support/assessment-vocabulary.mjs');
 const plan=makeAssessmentPlan(snapshot,support,vocabulary);
 fs.writeFileSync(new URL('assessment-plan.json',dir),JSON.stringify(plan,null,2)+'\n');
 fs.writeFileSync(new URL('../migrations/189_n4_assessments.sql',import.meta.url),assessmentSql(plan));
 console.log(JSON.stringify({banks:plan.banks.length,questions:plan.banks.flatMap(b=>b.rows).length}));
}
