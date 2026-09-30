import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { deriveDrills } from './grammar-drills.js';
import { createN5SupportFixture,grammarSupportTargets } from '../test-support/n5-support-fixture.js';

const plan=JSON.parse(await readFile(new URL('../content/n5-support/grammar-support.json',import.meta.url),'utf8'));
const migration=await readFile(new URL('../migrations/184_n5_grammar_support.sql',import.meta.url),'utf8');
const targets=grammarSupportTargets(plan);

test('Bab4–20 corpus covers the live source and task sets with valid contextual practice',()=>{
  assert.deepEqual(plan.chapters.map(c=>c.bab),Array.from({length:17},(_,i)=>i+4));
  assert.equal(plan.chapters.flatMap(c=>c.items).length,92);
  assert.equal(plan.chapters.flatMap(c=>c.taskItems).length,84);
  assert.equal(plan.chapters.flatMap(c=>c.taskItems).reduce((s,i)=>s+i.expectedRequiredCount,0),84);
  for(const [id,item]of targets) {
    assert.equal(id,item.expectedCore.id);
    assert.ok(item.examples.length>=3&&item.examples.length<=4,id);
    for(const e of item.examples){assert.ok(e.japanese.includes(e.highlight),`${id}: ${e.highlight}`);assert.ok(e.indonesian.trim());}
    assert.equal(item.expectedSupport.practice_config,null);
    assert.equal(item.dialogue,undefined);
    assert.equal(item.dialogueDraft,undefined);
    if(item.expectedCore.pattern==='Rumus belas'){assert.equal(item.drills,null);continue;}
    assert.ok(item.taskInstruction?.trim()||item.instruction?.trim());
    for(const d of Object.values(item.drills)){
      assert.equal(d.options.length,3,id);assert.equal(new Set(d.options).size,3,id);
      assert.equal(d.options.filter(o=>o===d.answer).length,1,id);assert.ok(d.prompt.trim());
    }
    assert.equal((item.drills.controlled.sentence.match(/＿＿＿/gu)||[]).length,1,id);
    const derived=deriveDrills([{id,pattern:item.expectedCore.pattern,meaning:item.expectedCore.meaning,examples:item.examples,practiceConfig:item.drills}]).get(id);
    assert.equal(derived.step1.rule,'curated-context');assert.equal(derived.step2.rule,'curated-context');
    assert.equal(derived.step1.options[derived.step1.correctIndex],item.drills.recognition.answer);
    assert.equal(derived.step2.options[derived.step2.correctIndex],item.drills.controlled.answer);
  }
  const numeric=plan.chapters[1].items.find(i=>i.pattern==='Rumus belas');
  assert.equal(numeric.expectedCore.meaning,null);
  assert.deepEqual(numeric.examples.map(e=>e.japanese),['11：じゅういち','12：じゅうに','17：じゅうなな']);
  const alias=plan.chapters[0].taskItems[3];
  assert.equal(alias.expectedCore.pattern,'そうです／そうじゃありません');
  assert.ok(alias.examples.some(e=>e.japanese.includes('そうじゃありません')));
  assert.ok(alias.examples.every(e=>!e.japanese.includes('ちがいます')));
  // These prompts describe facts different from one or more demonstration
  // examples. Never attach a substring-matched example that changes the facts.
  for(const [bab,index]of [[6,5],[12,4],[15,0],[15,2],[17,2]]) {
    const recognition=plan.chapters.find(c=>c.bab===bab).items[index].drills.recognition;
    assert.equal(recognition.example.japanese,'',`${bab}/${index}: prompt carries its own scenario`);
  }
  assert.match(plan.chapters.find(c=>c.bab===6).items[5].drills.recognition.prompt,/このケーキはとてもあまいです/u);
});

test('migration embeds the corpus and updates only agreed support fields',()=>{
  assert.deepEqual(JSON.parse(migration.match(/\$content\$([\s\S]*?)\$content\$::jsonb/u)[1]),plan);
  assert.doesNotMatch(migration,/UPDATE\s+(?:lessons|grammar_dialog_questions|module_vocabulary|module_kanji)\b/iu);
  const update=migration.match(/UPDATE module_grammar SET([\s\S]*?)WHERE id=target_id/u)[1];
  assert.doesNotMatch(update,/(?:pattern|meaning|lesson_id|notes|example_dialog|dialog_scene|dialog_furigana)\s*=/iu);
  assert.doesNotMatch(migration,/SET\s+(?:required_count|sort_order|popup_after_lesson_id)\s*=/iu);
});

async function connect(t){
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol));assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/iu);
  assert.equal(url.searchParams.has('host'),false);assert.equal(url.searchParams.has('hostaddr'),false);
  const {default:pg}=await import('pg');const client=new pg.Client({connectionString:url.href,statement_timeout:15000});await client.connect();
  const schema=`n5_184_${randomUUID().replaceAll('-','')}`;
  await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";`);
  t.after(async()=>{try{await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await client.end();}});
  await createN5SupportFixture(client,plan);return client;
}
const protectedGrammar=`SELECT to_jsonb(g)-ARRAY['example','practice_config','updated_at'] AS row FROM module_grammar g ORDER BY id`;
const membership=`SELECT lesson_id,grammar_id,sort_order,required_count FROM lesson_grammar_task_items ORDER BY lesson_id,grammar_id`;
async function preserved(client){
  const out={grammar:(await client.query(protectedGrammar)).rows,membership:(await client.query(membership)).rows};
  for(const table of ['lessons','grammar_dialog_questions','grammar_task_attempts','module_vocabulary','module_kanji'])out[table]=(await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  return out;
}
test('real PostgreSQL updates all targets, preserves all dialogue/core/student records and replays safely',{skip:!process.env.TEST_DATABASE_URL,timeout:60000},async t=>{
  const client=await connect(t),before=await preserved(client);
  await client.query(migration);
  assert.deepEqual(await preserved(client),before);
  assert.equal((await client.query('SELECT count(*)::int n FROM n5_grammar_support_backup_184')).rows[0].n,targets.size);
  assert.equal((await client.query('SELECT count(*)::int n FROM n5_grammar_task_support_backup_184')).rows[0].n,84);
  for(const [id,item]of targets){
    const g=(await client.query('SELECT example,practice_config FROM module_grammar WHERE id=$1',[id])).rows[0];
    assert.equal(g.example,item.examples[0].japanese);assert.deepEqual(g.practice_config,item.drills);
    const examples=(await client.query('SELECT japanese,highlight,indonesian FROM grammar_examples WHERE grammar_id=$1 ORDER BY sort_order',[id])).rows;
    assert.deepEqual(examples,item.examples);
  }
  const id=plan.chapters[0].items[0].id;
  await client.query("UPDATE module_grammar SET example='Teacher edit',notes='Teacher notes',practice_config=$2 WHERE id=$1",[id,{teacher:true}]);
  await client.query("UPDATE grammar_examples SET japanese='Teacher example' WHERE grammar_id=$1",[id]);
  const task=plan.chapters[0].taskItems[0];
  await client.query("UPDATE lesson_grammar_task_items SET instruction='Teacher instruction' WHERE lesson_id=$1 AND grammar_id=$2",[task.lessonId,task.grammarId]);
  const teacher=(await client.query('SELECT * FROM module_grammar WHERE id=$1',[id])).rows;
  await client.query(migration);
  assert.deepEqual((await client.query('SELECT * FROM module_grammar WHERE id=$1',[id])).rows,teacher);
  assert.equal((await client.query('SELECT instruction FROM lesson_grammar_task_items WHERE lesson_id=$1 AND grammar_id=$2',[task.lessonId,task.grammarId])).rows[0].instruction,'Teacher instruction');
});

test('real PostgreSQL fails closed on core/support/task drift before any replacement',{skip:!process.env.TEST_DATABASE_URL,timeout:60000},async t=>{
  const client=await connect(t),id=plan.chapters[0].items[0].id,task=plan.chapters[0].taskItems[0];
  const mutations=[
    ["UPDATE module_grammar SET pattern='Edited core' WHERE id=$1",[id]],
    ["UPDATE module_grammar SET example='Edited example' WHERE id=$1",[id]],
    ["UPDATE module_grammar SET practice_config=$2 WHERE id=$1",[id,{admin:true}]],
    ["UPDATE grammar_examples SET indonesian='Edited translation' WHERE grammar_id=$1",[id]],
    ["UPDATE lesson_grammar_task_items SET instruction='Edited task' WHERE lesson_id=$1 AND grammar_id=$2",[task.lessonId,task.grammarId]],
    ["UPDATE lesson_grammar_task_items SET required_count=2 WHERE lesson_id=$1 AND grammar_id=$2",[task.lessonId,task.grammarId]],
    ["DELETE FROM lesson_grammar_task_items WHERE lesson_id=$1 AND grammar_id=$2",[task.lessonId,task.grammarId]],
  ];
  for(const [sql,params]of mutations){
    await client.query('BEGIN');await client.query(sql,params);await client.query('SAVEPOINT drift');
    await assert.rejects(client.query(migration),/184 (?:immutable grammar changed|captured support changed|captured task changed|missing task membership)/u);
    await client.query('ROLLBACK TO SAVEPOINT drift');
    assert.equal((await client.query("SELECT to_regclass('n5_grammar_support_backup_184') AS table_name")).rows[0].table_name,null);
    await client.query('ROLLBACK');
  }
});
