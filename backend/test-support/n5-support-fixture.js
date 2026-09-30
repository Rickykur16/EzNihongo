import { randomUUID } from 'node:crypto';

export function grammarSupportTargets(plan) {
  const targets=new Map();
  for(const chapter of plan.chapters) {
    for(const item of chapter.items) targets.set(item.id,item);
    for(const item of chapter.taskItems) if(!targets.has(item.grammarId)) targets.set(item.grammarId,item);
  }
  return targets;
}

// A full-manifest fixture, independent of the moving live snapshot. Every core
// and support precondition comes from the reviewed manifest; protected fields
// deliberately contain sentinels to reveal broad or accidental writes.
export async function createN5SupportFixture(client,plan) {
  await client.query(`
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID,slug TEXT);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID,slug TEXT,type TEXT,popup_after_lesson_id UUID,
      bunpou_flow_draft JSONB,bunpou_flow_published JSONB,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE module_grammar(id UUID PRIMARY KEY,module_id UUID,lesson_id UUID,pattern TEXT,meaning TEXT,
      example TEXT,notes TEXT,example_dialog TEXT,example_dialog_id TEXT,communication_goal TEXT,
      dialog_scene JSONB,dialog_furigana JSONB,recognition_distractors TEXT,controlled_distractors TEXT,
      practice_config JSONB,sort_order INT,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE grammar_examples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),grammar_id UUID,japanese TEXT,
      highlight TEXT,indonesian TEXT,sort_order INT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE lesson_grammar_task_items(lesson_id UUID,grammar_id UUID,sort_order INT,instruction TEXT,required_count INT,
      PRIMARY KEY(lesson_id,grammar_id));
    CREATE TABLE grammar_dialog_questions(id UUID PRIMARY KEY,grammar_id UUID,state TEXT,question JSONB,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE module_vocabulary(id UUID PRIMARY KEY,data JSONB);
    CREATE TABLE module_kanji(id UUID PRIMARY KEY,data JSONB);
    CREATE TABLE grammar_task_attempts(id UUID PRIMARY KEY,grammar_id UUID,answer TEXT);
  `);
  await client.query('INSERT INTO courses VALUES($1,$2)',[plan.courseId,plan.courseSlug]);
  for(const chapter of plan.chapters) {
    await client.query('INSERT INTO modules VALUES($1,$2,$3)',[chapter.moduleId,plan.courseId,chapter.moduleSlug]);
    const lessons=new Map(chapter.items.map(i=>[i.lessonId,{id:i.lessonId,slug:i.lessonSlug,type:'video'}]));
    for(const item of chapter.taskItems)lessons.set(item.lessonId,{id:item.lessonId,slug:item.lessonSlug,type:'grammar_task'});
    for(const lesson of lessons.values()) await client.query(`INSERT INTO lessons(id,module_id,slug,type,popup_after_lesson_id,bunpou_flow_draft,bunpou_flow_published)
      VALUES($1,$2,$3,$4,NULL,$5,$5)`,[lesson.id,chapter.moduleId,lesson.slug,lesson.type,{sourceFingerprint:'protected',overlays:{untouched:true}}]);
  }
  const targets=grammarSupportTargets(plan);
  for(const [id,item] of targets) {
    const c=item.expectedCore;
    const scene={schemaVersion:1,enabled:true,participants:[{speaker:'A',characterKey:'anna-wijaya',voiceId:'custom-preserve'},{speaker:'B',characterKey:'hadi-pratama',voiceId:'other-preserve'}]};
    await client.query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,sort_order,example,practice_config,
      notes,example_dialog,example_dialog_id,communication_goal,dialog_scene,dialog_furigana,recognition_distractors,controlled_distractors)
      VALUES($1,$2,$3,$4,$5,$6,$7,NULL,'Protected notes','A: 保持。\nB: 保持。','A: Keep.\nB: Keep.','Protected goal',$8,$9,'Protected recognition','Protected controlled')`,
      [id,c.module_id,c.lesson_id,c.pattern,c.meaning,c.sort_order,item.expectedSupport.example,scene,{A:['protected']}]);
    for(const e of item.expectedSupport.examples) await client.query('INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order) VALUES($1,$2,$3,$4,$5)',[id,e.japanese,e.highlight,e.indonesian,e.sort_order]);
    await client.query('INSERT INTO grammar_dialog_questions VALUES($1,$2,$3,$4,NOW())',[randomUUID(),id,'active',{prompt:'Keep this question',evidence:['Protected']}]);
    await client.query('INSERT INTO grammar_task_attempts VALUES($1,$2,$3)',[randomUUID(),id,'Keep submitted work']);
  }
  for(const chapter of plan.chapters)for(const [index,t] of chapter.taskItems.entries()) {
    // Nonsequential orders prove that migration184 does not impose seed order.
    await client.query('INSERT INTO lesson_grammar_task_items VALUES($1,$2,$3,$4,$5)',[t.lessonId,t.grammarId,index*7+3,t.expectedInstruction,t.expectedRequiredCount]);
  }
  const otherId=randomUUID();
  await client.query(`INSERT INTO module_grammar(id,module_id,pattern,meaning,example,notes,practice_config,sort_order) VALUES($1,$2,'Unrelated','Keep core','KEEP','KEEP',$3,999)`,[otherId,plan.chapters[0].moduleId,{unrelated:true}]);
  await client.query('INSERT INTO module_vocabulary VALUES($1,$2)',[randomUUID(),{keep:'vocabulary'}]);
  await client.query('INSERT INTO module_kanji VALUES($1,$2)',[randomUUID(),{keep:'kanji'}]);
  return {targets,otherId};
}
