import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {banks,buildRollout,illustration} from '../scripts/build-jlpt-assessments.mjs';
import {buildRollout as previousRollout} from '../scripts/build-assessments-04-20.mjs';
import {validateBank} from '../content/assessments/jlpt/index.mjs';
import {createChapterSnapshot,publicChapterQuestions,chapterReview,gradeChapterAssessment,assertChapterForm} from './chapter-assessment.js';

test('408 original JLPT-style items retain curricular bounds, full banks, and private answer evidence',async()=>{
  const ids=new Set();let options=0,stars=0,spoken=0;
  const introduced={3:'人名何学校先生国語',4:'本花魚',5:'一二三四五六七八九十時分円百千万年月半歳午前後',6:'安高古新白長',7:'男女気',8:'下前外間右中左後上',9:'車東道駅行西電北南',10:'見読書',11:'週毎',12:'食飲',14:'立休入出',15:'言話聞買店会社',16:'日火水木金土曜',17:'子父母友手足口目耳'};
  assert.equal(banks.length,17);
  for(const bank of banks){
    const rows=validateBank(bank);
    const known=new Set(Object.entries(introduced).filter(([c])=>+c<=bank.chapter).map(([,s])=>s).join(''));
    for(const item of bank.forms.A){
      const visible=[item.prompt,item.passage,item.audioScript,...item.options].filter(Boolean).join('\n');
      for(const c of visible.match(/[一-龯]/g)||[])assert.ok(known.has(c),`Untaught kanji ${c} in ${item.id}`);
      if(bank.chapter>=10)assert.doesNotMatch(visible.replace(/<[^>]*>/g,''),/[A-Za-z]{3,}/,item.id);
      if(bank.chapter>=15)assert.doesNotMatch(item.sectionInstruction,/[A-Za-z]{3,}/);
      if(bank.chapter>=10&&bank.chapter<=14)assert.match(item.sectionInstruction,/<details><summary>Petunjuk<\/summary>/);
      stars+=!!item.ordered;spoken+=!!item.spokenChoices;
      if(item.spokenChoices)assert.deepEqual(item.options,['1ばん','2ばん','3ばん']);
    }
    const snapshot=createChapterSnapshot(bank,rows);
    assert.equal(snapshot.questions.length,24);assert.equal(snapshot.form,'ALL');
    for(const row of rows){assert.ok(!ids.has(row.id));ids.add(row.id);options+=row.options.length;}
    const publicRows=publicChapterQuestions(snapshot);
    assert.doesNotMatch(JSON.stringify(publicRows),/is_correct|audio_script|audioScene|assessment_meta|explanation|spokenChoices|ordered|distractorReasons/);
    assert.equal(publicRows.filter(q=>q.preserve_option_order).length,2);
    assert.equal(publicRows.filter(q=>q.image_url).length,1);
    const results=gradeChapterAssessment(snapshot,new Map(rows.map(q=>[q.id,{correct:true}])));
    assert.equal(results.passed,true);assert.equal(results.score,24);
    const review=chapterReview(snapshot,[],results.correctByQuestion);
    assert.equal(review.filter(q=>q.imageUrl).length,1);assert.equal(review.filter(q=>q.audioScript).length,4);
    const broken=structuredClone(rows);broken[23].options[0].option_text='Leaked spoken response';
    assert.throws(()=>assertChapterForm(bank,broken),/assessment_bank_invalid/);
    const original=snapshot.questions[0].options[0].option_text;
    rows[0].options[0].option_text='Later owner change';
    assert.equal(snapshot.questions[0].options[0].option_text,original);
    assert.equal((await readFile(new URL(`../../assets/assessments/b${bank.chapter}.svg`,import.meta.url),'utf8')).replaceAll('\r\n','\n'),illustration(bank.chapter));
  }
  assert.equal(ids.size,408);assert.equal(options,1598);assert.equal(stars,34);assert.equal(spoken,34);
  assert.ok(!JSON.stringify(banks[0]).includes('だれの'));
  assert.equal((await readFile(new URL('../migrations/172_jlpt_n5_assessment_format.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n'),buildRollout());
});

test('v3 rollout retains v2 history and owner voices; failure is atomic and reruns preserve edits',
{skip:!process.env.TEST_DATABASE_URL&&!process.env.TEST_PGLITE_URL},async()=>{
  let db;
  if(process.env.TEST_PGLITE_URL){const {PGlite}=await import(process.env.TEST_PGLITE_URL);db=new PGlite();}
  else{db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();}
  const schema='jlpt_rollout_'+randomUUID().replaceAll('-','');
  await db.query(`CREATE SCHEMA ${schema}`);await db.query(`SET search_path TO ${schema}`);
  const exec=sql=>db.exec?db.exec(sql):db.query(sql);
  try{
    await exec(`CREATE TABLE courses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text);
      CREATE TABLE modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id uuid,title text);
      CREATE TABLE lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),module_id uuid,slug text,type text,title text,
        assessment_policy jsonb,content text,questions_per_attempt int,updated_at timestamptz,video_url text);
      CREATE TABLE quiz_questions(id uuid PRIMARY KEY,lesson_id uuid,question text,question_type text,question_category text,
        section_number int,section_label text,section_instruction text,passage text,audio_script text,image_url text,explanation text,
        sort_order int,assessment_meta jsonb,audio_scene jsonb);
      CREATE TABLE quiz_options(id uuid PRIMARY KEY,question_id uuid REFERENCES quiz_questions(id),option_text text,is_correct boolean,sort_order int);
      CREATE TABLE quiz_attempts(id uuid,lesson_id uuid,sampled_question_ids jsonb,completed_at timestamptz);
      CREATE TABLE dialogue_speakers(character_key text UNIQUE,voice_id text,voice_name text,profile_version int);
      INSERT INTO courses(slug) VALUES('n5');`);
    for(let chapter=3;chapter<=20;chapter++){
      const m=(await db.query("INSERT INTO modules(course_id,title) SELECT id,$1 FROM courses WHERE slug='n5' RETURNING id",[`BAB ${chapter} : Existing`])).rows[0].id;
      const l=(await db.query(`INSERT INTO lessons(module_id,slug,type,title,content,questions_per_attempt,video_url)
        VALUES($1,$2,'quiz','Preserved','Original content',48,'Original media') RETURNING id`,[m,`assignment-bab-${chapter}-existing`])).rows[0].id;
      const q=randomUUID();
      await db.query('INSERT INTO quiz_questions(id,lesson_id,question) VALUES($1,$2,$3)',[q,l,'Legacy']);
      await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,NULL)',[randomUUID(),l,JSON.stringify([q])]);
    }
    await exec(previousRollout());
    // Distinct per-question settings, including an intentional null scene, must survive.
    await db.query(`UPDATE quiz_questions SET audio_scene=jsonb_set(audio_scene,'{participants,0,voiceId}',to_jsonb('owner_'||id::text))
      WHERE question_category='listening' AND sort_order<>24`);
    await db.query("UPDATE quiz_questions SET audio_scene=NULL WHERE question_category='listening' AND sort_order=24");
    const oldRows=(await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows;
    const oldOptions=(await db.query('SELECT * FROM quiz_options ORDER BY id')).rows;
    const attempts=(await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows;
    const identity=(await db.query('SELECT id,module_id,slug,type,title,video_url FROM lessons ORDER BY id')).rows;
    const sql=buildRollout();
    await db.query("UPDATE lessons SET slug='missing' WHERE slug='assignment-bab-20-existing'");
    await db.query('BEGIN');await assert.rejects(exec(sql),/missing\/ambiguous Bab 20/);await db.query('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows,oldRows);
    await db.query("UPDATE lessons SET slug='assignment-bab-20-existing' WHERE slug='missing'");
    await exec('BEGIN;'+sql+'COMMIT;');
    assert.deepEqual((await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,attempts);
    assert.deepEqual((await db.query('SELECT id,module_id,slug,type,title,video_url FROM lessons ORDER BY id')).rows,identity);
    const retained=(await db.query("SELECT * FROM quiz_questions WHERE assessment_meta IS NULL OR assessment_meta->>'version'='n5-assessment-v2' ORDER BY id")).rows;
    assert.deepEqual(retained,oldRows);
    assert.deepEqual((await db.query("SELECT o.* FROM quiz_options o JOIN quiz_questions q ON q.id=o.question_id WHERE q.assessment_meta->>'version'='n5-assessment-v2' ORDER BY o.id")).rows,oldOptions);
    const newRows=(await db.query("SELECT * FROM quiz_questions WHERE assessment_meta->>'version'='n5-assessment-v3'")).rows;
    assert.equal(newRows.length,408);
    for(const row of newRows.filter(q=>q.question_category==='listening')){
      assert.deepEqual(row.audio_scene,oldRows.find(q=>q.lesson_id===row.lesson_id&&q.sort_order===row.sort_order).audio_scene);
    }
    const counts=(await db.query(`SELECT l.id,count(q.id)::int n FROM lessons l JOIN quiz_questions q ON q.lesson_id=l.id
      AND q.assessment_meta->>'version'=l.assessment_policy->>'version' GROUP BY l.id`)).rows;
    assert.equal(counts.length,17);assert.ok(counts.every(c=>c.n===24));
    assert.equal((await db.query("SELECT content FROM lessons WHERE slug='assignment-bab-3-existing'")).rows[0].content,'Original content');
    await db.query("UPDATE lessons SET content='Owner edited' WHERE slug='assignment-bab-4-existing'");
    await exec(sql);
    assert.equal((await db.query("SELECT content FROM lessons WHERE slug='assignment-bab-4-existing'")).rows[0].content,'Owner edited');
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,834);
    // Editorial v4 copies unchanged owner content, while fixing only audited IDs.
    const {buildRollout:revisionRollout}=await import('../scripts/build-assessment-ambiguity-revision.mjs');
    const {banks:revised,bankRows:revisedRows,revisions}=await import('../content/assessments/jlpt/revised.mjs');
    await exec('ALTER TABLE quiz_questions ADD COLUMN grammar_id uuid, ADD COLUMN correct_answer text; ALTER TABLE quiz_options ADD COLUMN image_url text;');
    await db.query("UPDATE quiz_questions SET question='Owner wording preserved' WHERE assessment_meta->>'key'='b04-a-jlpt-1'");
    const beforeV4=(await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows;
    const beforeOptions=(await db.query('SELECT * FROM quiz_options ORDER BY id')).rows;
    await db.query("UPDATE lessons SET assessment_policy=jsonb_set(assessment_policy,'{version}','\"unexpected\"') WHERE slug='assignment-bab-20-existing'");
    await db.query('BEGIN');await assert.rejects(exec(revisionRollout()),/expected v3 Bab 20/);await db.query('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows,beforeV4);
    await db.query("UPDATE lessons SET assessment_policy=jsonb_set(assessment_policy,'{version}','\"n5-assessment-v3\"') WHERE slug='assignment-bab-20-existing'");
    await exec('BEGIN;'+revisionRollout()+'COMMIT;');
    const v4=(await db.query("SELECT q.*, (SELECT jsonb_agg(to_jsonb(o) ORDER BY sort_order) FROM quiz_options o WHERE question_id=q.id) options FROM quiz_questions q WHERE assessment_meta->>'version'='n5-assessment-v4'")).rows;
    assert.equal(v4.length,408);
    for(const bank of revised){
      const rows=v4.filter(q=>q.assessment_meta.key.startsWith(`b${String(bank.chapter).padStart(2,'0')}-`));
      assertChapterForm(bank,rows);
      for(const authored of revisedRows(bank)){
        const row=rows.find(q=>q.id===authored.id);
        const prior=beforeV4.find(q=>q.assessment_meta?.key===authored.assessment_meta.key.replace('-jlpt-r2-','-jlpt-'));
        assert.deepEqual(row.audio_scene,prior.audio_scene);
        if(revisions.has(`${bank.chapter}:${authored.sort_order}`)){
          assert.equal(row.question,authored.question);assert.equal(row.audio_script,authored.audio_script);
          assert.deepEqual(row.options.map(o=>[o.option_text,o.is_correct]),authored.options.map(o=>[o.option_text,o.is_correct]));
        }else{
          assert.equal(row.question,prior.question);assert.equal(row.audio_script,prior.audio_script);
          assert.deepEqual(row.options.map(o=>[o.option_text,o.is_correct]),beforeOptions.filter(o=>o.question_id===prior.id).sort((a,b)=>a.sort_order-b.sort_order).map(o=>[o.option_text,o.is_correct]));
        }
      }
    }
    assert.deepEqual((await db.query("SELECT * FROM quiz_questions WHERE assessment_meta->>'version' IS DISTINCT FROM 'n5-assessment-v4' ORDER BY id")).rows,beforeV4);
    assert.deepEqual((await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,attempts);
    assert.equal((await db.query("SELECT content FROM lessons WHERE slug='assignment-bab-4-existing'")).rows[0].content,'Owner edited');
    await db.query("UPDATE quiz_questions SET question='Owner after v4' WHERE id=$1",[v4[0].id]);
    await exec(revisionRollout());
    assert.equal((await db.query('SELECT question FROM quiz_questions WHERE id=$1',[v4[0].id])).rows[0].question,'Owner after v4');
    assert.equal((await db.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,1242);
  }finally{await db.query(`DROP SCHEMA ${schema} CASCADE`);await(db.end?db.end():db.close());}
});
