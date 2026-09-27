import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {banks,buildRollout} from '../scripts/build-assessments-04-20.mjs';
import {validateBank} from '../scripts/build-chapter-assessments.mjs';
import {createChapterSnapshot,gradeChapterAssessment,publicChapterQuestions} from './chapter-assessment.js';
import {normalizeDialogScene} from './dialogue-scene.js';

test('all 17 full-bank assessments have bounded coverage, independent audio and no sampling',async()=>{
  assert.equal(banks.length,17);
  const ids=new Set();
  for(const bank of banks){
    const rows=validateBank(bank);
    const introduced={3:'人名何学校先生国語',4:'本花魚',5:'一二三四五六七八九十時分円百千万年月半歳午前後',6:'安高古新白長',7:'男女気',8:'下前外間右中左後上',9:'車東道駅行西電北南',10:'見読書',11:'週毎',12:'食飲',14:'立休入出',15:'言話聞買店会社',16:'日火水木金土曜',17:'子父母友手足口目耳'};
    const known=new Set(Object.entries(introduced).filter(([c])=>Number(c)<=bank.chapter).map(([,s])=>s).join(''));
    for(const item of bank.forms.A) {
      const visible=[item.prompt,item.passage,item.audioScript,...item.options].filter(Boolean).join('\n');
      for(const c of visible.match(/[一-龯]/g)||[])assert.ok(known.has(c),`Untaught kanji ${c} in ${item.id}`);
    }
    const a=createChapterSnapshot(bank,rows,'A',()=>0);
    const b=createChapterSnapshot(bank,rows,'ALL',()=>0.99);
    assert.equal(a.form,'ALL');
    assert.equal(a.questions.length,24);
    assert.deepEqual(a.questions.map(q=>q.id),b.questions.map(q=>q.id));
    for(const q of rows){assert.ok(!ids.has(q.id));ids.add(q.id);}
    for(const q of publicChapterQuestions(a)) {
      assert.ok(!('audio_script' in q));assert.ok(!('assessment_meta' in q));
      assert.ok(!('explanation' in q));assert.ok(q.options.every(o=>!('is_correct' in o)));
    }
    assert.equal(gradeChapterAssessment(a,new Map(rows.map(q=>[q.id,{correct:true}]))).passed,true);
    for(const category of ['grammar','reading','listening']) {
      assert.equal(gradeChapterAssessment(a,new Map(rows.map(q=>[q.id,{correct:q.question_category!==category}]))).passed,false);
    }
    assert.throws(()=>createChapterSnapshot(bank,rows.slice(1)),/assessment_bank_invalid/);
  }
  assert.equal(ids.size,408);
  assert.ok(!JSON.stringify(banks[0]).includes('だれの'));
  assert.equal((await readFile(new URL('../migrations/171_rebuild_n5_assessments_04_20.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n'),buildRollout());
});

test('rollout preserves old questions, attempts, lesson IDs and media; snapshots support configured character voices',
{skip:!process.env.TEST_DATABASE_URL&&!process.env.TEST_PGLITE_URL},async()=>{
  let db;
  if(process.env.TEST_PGLITE_URL){const {PGlite}=await import(process.env.TEST_PGLITE_URL);db=new PGlite();}
  else {db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();}
  const schema='assessment_rollout_'+randomUUID().replaceAll('-','');
  await db.query(`CREATE SCHEMA ${schema}`);await db.query(`SET search_path TO ${schema}`);
  const exec=sql=>db.exec?db.exec(sql):db.query(sql);
  try {
    await exec(`CREATE TABLE courses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text);
    CREATE TABLE modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id uuid,title text);
    CREATE TABLE lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),module_id uuid,slug text,type text,title text,
      assessment_policy jsonb,content text,questions_per_attempt int,updated_at timestamptz,video_url text);
    CREATE TABLE quiz_questions(id uuid PRIMARY KEY,lesson_id uuid,question text,question_type text,question_category text,
      section_number int,section_label text,section_instruction text,passage text,audio_script text,explanation text,
      sort_order int,assessment_meta jsonb,audio_scene jsonb);
    CREATE TABLE quiz_options(id uuid PRIMARY KEY,question_id uuid REFERENCES quiz_questions(id),option_text text,is_correct boolean,sort_order int);
    CREATE TABLE quiz_attempts(id uuid,lesson_id uuid,sampled_question_ids jsonb,completed_at timestamptz);
    CREATE TABLE dialogue_speakers(character_key text UNIQUE,voice_id text,voice_name text,profile_version int);
    INSERT INTO courses(slug) VALUES('n5'),('n4');
    INSERT INTO dialogue_speakers VALUES('anna-wijaya','saved-female','Anna',2),('hadi-pratama','saved-male','Hadi',3);`);
    for(let chapter=3;chapter<=20;chapter++){
      const m=(await db.query("INSERT INTO modules(course_id,title) SELECT id,$1 FROM courses WHERE slug='n5' RETURNING id",[`BAB ${chapter} : Existing`])).rows[0].id;
      const l=(await db.query(`INSERT INTO lessons(module_id,slug,type,title,content,questions_per_attempt,video_url)
        VALUES($1,$2,'quiz','Preserve title','Old instructions',50,'Preserve media') RETURNING id`,[m,`assignment-bab-${chapter}-existing`])).rows[0].id;
      const q=randomUUID();
      await db.query('INSERT INTO quiz_questions(id,lesson_id,question) VALUES($1,$2,$3)',[q,l,'Legacy question']);
      await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,now())',[randomUUID(),l,JSON.stringify([q])]);
      await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,NULL)',[randomUUID(),l,JSON.stringify([q])]);
    }
    const oldAttempts=(await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows;
    const ids=(await db.query('SELECT id,module_id,slug,type,title,video_url FROM lessons ORDER BY id')).rows;
    const sql=buildRollout();
    // A missing target must roll back earlier chapter updates and backups.
    await db.query("UPDATE lessons SET slug='temporarily-missing' WHERE slug='assignment-bab-20-existing'");
    await db.query('BEGIN');
    await assert.rejects(exec(sql),/missing\/ambiguous Bab 20/);
    await db.query('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,18);
    await db.query("UPDATE lessons SET slug='assignment-bab-20-existing' WHERE slug='temporarily-missing'");
    await exec('BEGIN;'+sql+'COMMIT;');
    assert.deepEqual((await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,oldAttempts);
    assert.deepEqual((await db.query('SELECT id,module_id,slug,type,title,video_url FROM lessons ORDER BY id')).rows,ids);
    assert.equal((await db.query("SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta IS NULL")).rows[0].n,18);
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,426);
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_options')).rows[0].n,1632);
    const audio=(await db.query("SELECT audio_scene FROM quiz_questions WHERE question_category='listening'")).rows;
    assert.equal(audio.length,68);
    for(const row of audio)assert.deepEqual(normalizeDialogScene(row.audio_scene).participants.map(p=>p.voiceId),['saved-female','saved-male']);
    assert.equal((await db.query("SELECT content FROM lessons WHERE slug='assignment-bab-3-existing'")).rows[0].content,'Old instructions');
    await db.query("UPDATE lessons SET content='Later owner edit' WHERE slug='assignment-bab-4-existing'");
    await exec(sql);
    assert.equal((await db.query("SELECT content FROM lessons WHERE slug='assignment-bab-4-existing'")).rows[0].content,'Later owner edit');
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,426);
  }finally{await db.query(`DROP SCHEMA ${schema} CASCADE`);await(db.end?db.end():db.close());}
});
