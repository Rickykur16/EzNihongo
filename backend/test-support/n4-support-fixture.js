import {randomUUID} from 'node:crypto';

export async function seedN4Support(client,plan,vocab) {
 await client.query(`
 CREATE TABLE courses(id uuid PRIMARY KEY,slug text);
 CREATE TABLE modules(id uuid PRIMARY KEY,course_id uuid REFERENCES courses(id),slug text,title text,sort_order int,description text,title_en text,scenario text,cando_statements jsonb,quiz_spec jsonb,updated_at timestamptz DEFAULT now(),protected text DEFAULT 'KEEP');
 CREATE TABLE lessons(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),slug text,type text,sort_order int,content text,assessment_policy jsonb,questions_per_attempt int,updated_at timestamptz DEFAULT now(),protected text DEFAULT 'KEEP');
 CREATE TABLE module_grammar(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),lesson_id uuid REFERENCES lessons(id),pattern text,meaning text,sort_order int,example text,notes text,practice_config jsonb,updated_at timestamptz DEFAULT now(),example_dialog text DEFAULT 'KEEP',dialog_scene jsonb DEFAULT '{"keep":true}',protected text DEFAULT 'KEEP');
 CREATE TABLE grammar_examples(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),grammar_id uuid REFERENCES module_grammar(id),japanese text,highlight text,indonesian text,sort_order int);
 CREATE TABLE lesson_grammar_task_items(lesson_id uuid REFERENCES lessons(id),grammar_id uuid REFERENCES module_grammar(id),instruction text,required_count int,sort_order int,protected text DEFAULT 'KEEP',PRIMARY KEY(lesson_id,grammar_id));
 CREATE TABLE module_vocabulary(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),lesson_id uuid REFERENCES lessons(id),japanese text,reading text,romaji text,indonesian text,category text,sort_order int,note text,updated_at timestamptz DEFAULT now(),protected text DEFAULT 'KEEP');
 CREATE TABLE lesson_deck_items(lesson_id uuid REFERENCES lessons(id),vocabulary_id uuid REFERENCES module_vocabulary(id),sort_order int,accent_color text DEFAULT 'KEEP',PRIMARY KEY(lesson_id,vocabulary_id));
 CREATE TABLE vocabulary_examples(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vocabulary_id uuid REFERENCES module_vocabulary(id),japanese text,reading text,highlight text,indonesian text,sort_order int);
 CREATE TABLE kanji_items(id uuid PRIMARY KEY,character text,protected text);
 CREATE TABLE grammar_task_attempts(id uuid PRIMARY KEY,grammar_id uuid REFERENCES module_grammar(id),answer text);
 CREATE TABLE quiz_questions(id uuid PRIMARY KEY,lesson_id uuid REFERENCES lessons(id),question text,question_type text,question_category text,section_number int,section_label text,section_instruction text,passage text,audio_script text,explanation text,sort_order int,assessment_meta jsonb,grammar_id uuid REFERENCES module_grammar(id));
 CREATE TABLE quiz_options(id uuid PRIMARY KEY,question_id uuid REFERENCES quiz_questions(id),option_text text,is_correct boolean,sort_order int);
 CREATE TABLE quiz_attempts(id uuid PRIMARY KEY,lesson_id uuid REFERENCES lessons(id),assessment_snapshot jsonb);
 `);
 await client.query('INSERT INTO courses VALUES($1,$2)',[plan.courseId,'n4']);
 for(const m of plan.chapters){
  await client.query('INSERT INTO modules(id,course_id,slug,title,sort_order,description,title_en,scenario,cando_statements) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[m.id,plan.courseId,m.slug,m.title,m.sort_order,m.expectedMeta.description,m.expectedMeta.title_en,m.expectedMeta.scenario,JSON.stringify(m.expectedMeta.cando_statements)]);
  for(const l of m.lessons) await client.query('INSERT INTO lessons(id,module_id,slug,type,sort_order,content) VALUES($1,$2,$3,$4,$5,$6)',[l.id,l.module_id,l.slug,l.type,l.sort_order,m.content.find(x=>x.id===l.id)?.expectedContent??null]);
 }
 for(const g of plan.grammar){
  const v=g.expectedCore;
  await client.query('INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,sort_order,example,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[v.id,v.module_id,v.lesson_id,v.pattern,v.meaning,v.sort_order,g.expectedSupport.example,g.expectedSupport.notes]);
  await client.query('INSERT INTO grammar_task_attempts VALUES($1,$2,$3)',[randomUUID(),g.id,'Submitted before this change']);
 }
 for(const [i,t] of plan.tasks.entries())await client.query('INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id,instruction,required_count,sort_order) VALUES($1,$2,$3,$4,$5)',[t.lessonId,t.grammarId,t.expectedInstruction,t.requiredCount,i*7+2]);
 if(vocab)for(const v of vocab.items){
  const x=v.expectedCore;
  await client.query('INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese,reading,romaji,indonesian,category,sort_order,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[x.id,x.module_id,x.lesson_id,x.japanese,x.reading,x.romaji,x.indonesian,x.category,x.sort_order,v.expectedNote]);
  for(const lessonId of v.deckIds)await client.query('INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order) VALUES($1,$2,$3)',[lessonId,x.id,x.sort_order]);
 }
 await client.query('INSERT INTO kanji_items VALUES($1,$2,$3)',[randomUUID(),'保持','KEEP original kanji']);
 for(const m of plan.chapters)await client.query('INSERT INTO quiz_attempts VALUES($1,$2,$3)',[randomUUID(),m.lessons.find(l=>l.type==='quiz').id,{keep:'previous snapshot'}]);
}
