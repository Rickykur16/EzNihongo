import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { buildMigration, contentUrl, migrationUrl } from '../scripts/build-n5-vocabulary-support.mjs';

const plan = JSON.parse(await readFile(contentUrl, 'utf8'));
const sql = await readFile(migrationUrl, 'utf8');
const counts = [52,57,55,23,60,46,56,53,48,40,27,41,41,46,22,29,28];
const fourFields = e => Object.fromEntries(['japanese','reading','highlight','indonesian'].map(k=>[k,e[k]??null]));
const normalizedReading = text => text.replace(/[\u30a1-\u30f6]/gu,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s。、？！!?]/gu,'');

test('N5 vocabulary corpus covers the 724 fixed deck IDs with 2–3 complete, distinct examples', () => {
  assert.equal(plan.items.length, 724);
  assert.equal(new Set(plan.items.map(i=>i.vocabularyId)).size, 724);
  assert.deepEqual(plan.chapters.map(c=>c.chapter), Array.from({length:17},(_,i)=>i+4));
  assert.deepEqual(plan.chapters.map(c=>plan.items.filter(i=>i.chapter===c.chapter).length), counts);
  assert.equal(plan.items.flatMap(i=>i.examples).length, 1455);
  assert.equal(plan.items.flatMap(i=>i.sourceExamples).length, 253);
  for (const item of plan.items) {
    assert.equal(item.expectedCore.japanese, item.word);
    assert.deepEqual(item.expectedDeckIds, [item.lessonId]);
    assert.deepEqual(Object.keys(item.expectedCore).sort(), ['module_id','lesson_id','japanese','reading','romaji','indonesian','category','note','sort_order'].sort());
    assert.ok(item.examples.length>=2 && item.examples.length<=3, item.word);
    assert.equal(new Set(item.examples.map(e=>normalizedReading(e.reading))).size,item.examples.length,item.word);
    for (const e of item.examples) {
      for (const value of Object.values(fourFields(e))) assert.ok(typeof value==='string' && value.trim(),item.word);
      assert.ok(e.japanese.includes(e.highlight),item.word);
      assert.doesNotMatch(e.japanese,/[{}~〜]/u,item.word);
      assert.doesNotMatch(e.reading,/[\p{Script=Han}a-zA-Z{}~]/u,item.word);
      if(item.chapter<12) assert.doesNotMatch(e.reading,/(?:て|で)から、/u,item.word);
      if(item.chapter<13) assert.doesNotMatch(e.reading,/(?:て|で)(?:います|ください|もいいです|はいけません)/u,item.word);
      if(item.chapter<19) assert.doesNotMatch(e.reading,/(?:のみ|たべ|いき)たいです|つもりです/u,item.word);
      if(item.chapter<20) assert.doesNotMatch(e.reading,/ことがあります|とおもいます/u,item.word);
    }
  }
});

test('Migration 183 is generated exactly from its reviewable vocabulary corpus', () => {
  assert.equal(sql.replaceAll('\r\n','\n'), buildMigration(plan));
  assert.doesNotMatch(sql,/UPDATE\s+(?:module_vocabulary|lesson_deck_items|lessons|modules)\s/iu);
});

const dbOptions = {skip: !process.env.TEST_DATABASE_URL && 'Set a local TEST_DATABASE_URL to execute the migration',timeout:60000};
async function fixture(t) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname),/test/i);
  assert.equal(url.searchParams.has('host'),false);
  assert.equal(url.searchParams.has('hostaddr'),false);
  const {default:pg} = await import('pg');
  const client = new pg.Client({connectionString:url.href,statement_timeout:45000});
  await client.connect();
  const schema = '"n5_vocabulary_test_'+randomUUID().replaceAll('-','')+'"';
  t.after(async()=>{try {await client.query('ROLLBACK');await client.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');} finally {await client.end();}});
  await client.query('CREATE SCHEMA '+schema+'; SET search_path TO '+schema);
  await client.query(`
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID REFERENCES courses(id),slug TEXT,sort_order INT);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID REFERENCES modules(id),slug TEXT,type TEXT,content TEXT);
    CREATE TABLE module_vocabulary(id UUID PRIMARY KEY,module_id UUID REFERENCES modules(id),lesson_id UUID REFERENCES lessons(id),
      japanese TEXT,reading TEXT,romaji TEXT,indonesian TEXT,category TEXT,note TEXT,sort_order INT,
      example_japanese TEXT,example_reading TEXT,example_indonesian TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE lesson_deck_items(lesson_id UUID REFERENCES lessons(id),vocabulary_id UUID REFERENCES module_vocabulary(id),
      sort_order INT,accent_color TEXT,PRIMARY KEY(lesson_id,vocabulary_id));
    CREATE TABLE vocabulary_examples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),vocabulary_id UUID REFERENCES module_vocabulary(id),
      japanese TEXT,reading TEXT,highlight TEXT,indonesian TEXT,sort_order INT,
      created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE INDEX ON vocabulary_examples(vocabulary_id);
    CREATE INDEX ON lesson_deck_items(vocabulary_id);
    CREATE TABLE user_vocabulary_progress(vocabulary_id UUID REFERENCES module_vocabulary(id),correct_count INT);
  `);
  const modules=new Map(plan.chapters.map(c=>[c.moduleId,{id:c.moduleId,course_id:plan.courseId,slug:c.slug,sort_order:c.chapter}]));
  for(const i of plan.items) if(!modules.has(i.expectedCore.module_id)) modules.set(i.expectedCore.module_id,{id:i.expectedCore.module_id,course_id:plan.courseId,slug:'bank-'+i.expectedCore.module_id,sort_order:3});
  const lessons=new Map(plan.chapters.flatMap(c=>c.deckIds.map(id=>[id,{id,module_id:c.moduleId,slug:'kosakata-n5-b'+c.chapter,type:'deck',content:'original deck content'}])));
  for(const i of plan.items) if(i.expectedCore.lesson_id && !lessons.has(i.expectedCore.lesson_id)) lessons.set(i.expectedCore.lesson_id,{id:i.expectedCore.lesson_id,module_id:i.expectedCore.module_id,slug:'owner-'+i.expectedCore.lesson_id,type:'text'});
  const unrelated={courseId:randomUUID(),moduleId:randomUUID(),lessonId:randomUUID(),wordId:randomUUID(),exampleId:randomUUID()};
  await client.query('INSERT INTO courses(id,slug) VALUES($1,\'n5\'),($2,\'n4\')',[plan.courseId,unrelated.courseId]);
  modules.set(unrelated.moduleId,{id:unrelated.moduleId,course_id:unrelated.courseId,slug:'n4-b1',sort_order:1});
  lessons.set(unrelated.lessonId,{id:unrelated.lessonId,module_id:unrelated.moduleId,slug:'n4-deck',type:'deck',content:'untouched conversation and unrelated content'});
  async function bulk(table, data, types) {
    await client.query('INSERT INTO '+table+'('+types.map(([k])=>k).join(',')+') SELECT * FROM jsonb_to_recordset($1::jsonb) AS x('+types.map(([k,type])=>k+' '+type).join(',')+')',[JSON.stringify(data)]);
  }
  await bulk('modules',[...modules.values()],[['id','uuid'],['course_id','uuid'],['slug','text'],['sort_order','int']]);
  await bulk('lessons',[...lessons.values()],[['id','uuid'],['module_id','uuid'],['slug','text'],['type','text'],['content','text']]);
  await bulk('module_vocabulary',plan.items.map(i=>({id:i.vocabularyId,...i.expectedCore,example_japanese:'legacy '+i.word,example_reading:'legacy reading',example_indonesian:'legacy translation'})),[['id','uuid'],['module_id','uuid'],['lesson_id','uuid'],['japanese','text'],['reading','text'],['romaji','text'],['indonesian','text'],['category','text'],['note','text'],['sort_order','int'],['example_japanese','text'],['example_reading','text'],['example_indonesian','text']]);
  await client.query('INSERT INTO module_vocabulary(id,module_id,japanese) VALUES($1,$2,\'untouched\')',[unrelated.wordId,unrelated.moduleId]);
  await bulk('lesson_deck_items',plan.items.map((i,n)=>({lesson_id:i.lessonId,vocabulary_id:i.vocabularyId,sort_order:n,accent_color:'original-color'})),[['lesson_id','uuid'],['vocabulary_id','uuid'],['sort_order','int'],['accent_color','text']]);
  await client.query('INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order) VALUES($1,$2,0)',[unrelated.lessonId,unrelated.wordId]);
  await bulk('vocabulary_examples',plan.items.flatMap(i=>i.sourceExamples.map((e,n)=>({id:randomUUID(),vocabulary_id:i.vocabularyId,...e,sort_order:n}))),[['id','uuid'],['vocabulary_id','uuid'],['japanese','text'],['reading','text'],['highlight','text'],['indonesian','text'],['sort_order','int']]);
  await client.query('INSERT INTO vocabulary_examples(id,vocabulary_id,japanese) VALUES($1,$2,\'unrelated example\')',[unrelated.exampleId,unrelated.wordId]);
  await client.query('INSERT INTO user_vocabulary_progress(vocabulary_id,correct_count) SELECT id,7 FROM module_vocabulary');
  const snapshot=async table=>(await client.query('SELECT to_jsonb(t) AS row FROM '+table+' t ORDER BY to_jsonb(t)::text')).rows.map(r=>r.row);
  const apply=async()=>{await client.query('BEGIN');try{await client.query(sql);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}};
  return {client,apply,snapshot,unrelated};
}

test('183 snapshots every old row, changes only examples and preserves stable vocabulary/progress IDs',dbOptions,async t=>{
  const f=await fixture(t);
  const protectedTables=['courses','modules','lessons','module_vocabulary','lesson_deck_items','user_vocabulary_progress'];
  const before={};
  for(const table of protectedTables) before[table]=await f.snapshot(table);
  const oldExamples=await f.snapshot('vocabulary_examples');
  await f.apply();
  for(const table of protectedTables) assert.deepEqual(await f.snapshot(table),before[table],table);
  const backups=await f.snapshot('n5_vocabulary_backup_183');
  assert.equal(backups.length,724);
  for(const b of backups){
    assert.deepEqual(b.before_vocabulary,before.module_vocabulary.find(v=>v.id===b.vocabulary_id));
    assert.deepEqual(b.before_examples.slice().sort((a,b)=>a.id.localeCompare(b.id)),oldExamples.filter(e=>e.vocabulary_id===b.vocabulary_id).sort((a,b)=>a.id.localeCompare(b.id)));
    assert.deepEqual(b.before_deck_items,before.lesson_deck_items.filter(d=>d.vocabulary_id===b.vocabulary_id));
  }
  const after=await f.snapshot('vocabulary_examples');
  for(const item of plan.items){
    const examples=after.filter(e=>e.vocabulary_id===item.vocabularyId).sort((a,b)=>a.sort_order-b.sort_order);
    assert.deepEqual(examples.map(fourFields),item.examples,item.word);
    const old=oldExamples.filter(e=>e.vocabulary_id===item.vocabularyId);
    assert.equal(examples.filter(e=>old.some(o=>o.id===e.id)).length,Math.min(old.length,examples.length),'reuse old slots '+item.word);
    if(item.examples.length===3){
      const retained=old.find(e=>JSON.stringify(fourFields(e))===JSON.stringify(item.examples[0]));
      assert.ok(retained,item.word);
      assert.equal(examples[0].id,retained.id,'retained example ID '+item.word);
    }
  }
  assert.deepEqual(after.find(e=>e.id===f.unrelated.exampleId),oldExamples.find(e=>e.id===f.unrelated.exampleId));
  await f.client.query('UPDATE vocabulary_examples SET indonesian=\'teacher revision\' WHERE id=$1',[after.find(e=>e.vocabulary_id===plan.items[0].vocabularyId).id]);
  const edited=await f.snapshot('vocabulary_examples');
  await f.apply();
  assert.deepEqual(await f.snapshot('vocabulary_examples'),edited);
  assert.deepEqual(await f.snapshot('n5_vocabulary_backup_183'),backups);
  await f.client.query('DELETE FROM n5_vocabulary_backup_183 WHERE vocabulary_id=$1',[plan.items[0].vocabularyId]);
  await assert.rejects(f.apply(),/partial or unexpected backup/);
  assert.deepEqual(await f.snapshot('vocabulary_examples'),edited);
});

for(const [name,mutate,expected] of [
  ['core reading drift',f=>f.client.query('UPDATE module_vocabulary SET reading=\'changed\' WHERE id=$1',[plan.items[0].vocabularyId]),/core vocabulary changed/],
  ['missing membership',f=>f.client.query('DELETE FROM lesson_deck_items WHERE vocabulary_id=$1',[plan.items[0].vocabularyId]),/deck membership changed/],
  ['unreviewed other-course consumer',f=>f.client.query('INSERT INTO lesson_deck_items(lesson_id,vocabulary_id) VALUES($1,$2)',[f.unrelated.lessonId,plan.items[0].vocabularyId]),/unexpected vocabulary consumer/],
  ['teacher example drift',f=>f.client.query('UPDATE vocabulary_examples SET reading=\'changed\' WHERE vocabulary_id=$1',[plan.items[0].vocabularyId]),/source examples changed/],
  ['unexpected example on previously empty word',f=>f.client.query('INSERT INTO vocabulary_examples(vocabulary_id,japanese) VALUES($1,\'teacher example\')',[plan.items.find(i=>i.chapter===8).vocabularyId]),/source examples changed/],
]) test('183 aborts atomically for '+name,dbOptions,async t=>{
  const f=await fixture(t);await mutate(f);
  const before=await f.snapshot('vocabulary_examples');
  await assert.rejects(f.apply(),expected);
  assert.deepEqual(await f.snapshot('vocabulary_examples'),before);
  assert.equal((await f.client.query("SELECT to_regclass('n5_vocabulary_backup_183') AS name")).rows[0].name,null);
});
