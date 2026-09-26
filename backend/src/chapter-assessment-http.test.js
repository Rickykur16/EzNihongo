import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('versioned chapter assessment migration, grading and protected HTTP lifecycle', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  const schema = 'chapter_test_' + randomUUID().replaceAll('-','');
  const control = new pg.Client({connectionString:url.href});
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'chapter-test-only';
  process.env.ADMIN_EMAILS = '';
  process.env.ELEVENLABS_API_KEY = '';
  const { db } = await import('./db.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end();
  });
  await control.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await control.query(await readFile(new URL('../migrations/148_dialogue_speakers.sql', import.meta.url), 'utf8'));
  // Upgrade test: remove the new fields from a schema representing the old app.
  await control.query(`ALTER TABLE lessons DROP COLUMN assessment_policy;
    ALTER TABLE quiz_questions DROP COLUMN assessment_meta;
    ALTER TABLE quiz_attempts DROP COLUMN assessment_snapshot, DROP COLUMN draft_answers, DROP COLUMN draft_revision`);
  const user=randomUUID(), other=randomUUID(), course=randomUUID(), n4=randomUUID(), n4module=randomUUID(), n4lesson=randomUUID();
  await control.query(`INSERT INTO users(id,google_id,email,full_name) VALUES ($1,'chapter1','chapter1@example.invalid','Test'),($2,'chapter2','chapter2@example.invalid','Other')`, [user,other]);
  await control.query(`INSERT INTO courses(id,slug,title) VALUES ($1,'n5','N5'),($2,'n4','N4')`,[course,n4]);
  const lessons=[];
  for(let chapter=3;chapter<=4;chapter++) {
    const module=randomUUID(), lesson=randomUUID(); lessons.push(lesson);
    await control.query(`INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES ($1,$2,$3,$3,$4)`,[module,course,`bab${chapter}`,chapter]);
    await control.query(`INSERT INTO lessons(id,module_id,slug,title,type,cooldown_hours) VALUES ($1,$2,$3,$3,'quiz',0)`,[lesson,module,`assignment-bab-${chapter}-fixture`]);
  }
  await control.query(`INSERT INTO modules(id,course_id,slug,title) VALUES ($1,$2,'bab3','N4')`,[n4module,n4]);
  await control.query(`INSERT INTO lessons(id,module_id,slug,title,type) VALUES ($1,$2,'assignment-bab-3-fixture','N4','quiz')`,[n4lesson,n4module]);
  await control.query(`INSERT INTO user_enrollments(user_id,course_id,status) VALUES ($1,$3,'active'),($2,$3,'active')`,[user,other,course]);
  const legacyQuestion=randomUUID(),legacyOption=randomUUID(),legacyToken=randomUUID();
  await control.query(`UPDATE lessons SET passing_score_pct=75 WHERE id=$1`,[lessons[0]]);
  await control.query(`INSERT INTO quiz_questions(id,lesson_id,question) VALUES ($1,$2,'Legacy retained')`,[legacyQuestion,lessons[0]]);
  await control.query(`INSERT INTO quiz_options(id,question_id,option_text,is_correct) VALUES ($1,$2,'Legacy answer',true)`,[legacyOption,legacyQuestion]);
  await control.query(`INSERT INTO quiz_attempts(user_id,lesson_id,attempt_token,sampled_question_ids,started_at) VALUES ($1,$2,$3,$4,NOW())`,[user,lessons[0],legacyToken,JSON.stringify([legacyQuestion])]);
  const structure=await readFile(new URL('../migrations/165_chapter_assessment_versions.sql',import.meta.url),'utf8');
  const content=await readFile(new URL('../migrations/166_rebuild_n5_chapter_assessments.sql',import.meta.url),'utf8');
  await t.test('migration reruns preserve old content, attempts and N4 scope',async()=>{
    await control.query(structure); await control.query(structure);
    await control.query(content); await control.query(content);
    assert.equal((await control.query(`SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta IS NOT NULL`)).rows[0].n,48);
    assert.equal((await control.query(`SELECT count(*)::int n FROM quiz_questions WHERE id=$1`,[legacyQuestion])).rows[0].n,1);
    assert.equal((await control.query(`SELECT count(*)::int n FROM quiz_attempts WHERE attempt_token=$1`,[legacyToken])).rows[0].n,1);
    assert.equal((await control.query(`SELECT passing_score_pct FROM lessons WHERE id=$1`,[lessons[0]])).rows[0].passing_score_pct,75);
    assert.equal((await control.query(`SELECT assessment_policy FROM lessons WHERE id=$1`,[lessons[1]])).rows[0].assessment_policy,null);
    assert.equal((await control.query(`SELECT assessment_policy FROM lessons WHERE id=$1`,[n4lesson])).rows[0].assessment_policy,null);
  });
  const {signAccessToken}=await import('./auth.js');
  const {default:progress}=await import('./routes/progress.js');
  const {default:contentRouter}=await import('./routes/content.js');
  const {default:ttsRouter}=await import('./routes/tts.js');
  const app=express(); app.use(express.json(),ttsRouter,progress,contentRouter);
  app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:err.message});});
  server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const token=await signAccessToken(user,'chapter1@example.invalid'), otherToken=await signAccessToken(other,'chapter2@example.invalid');
  const path=(lesson,suffix)=>`/progress/lesson/${lesson}/${suffix}`;
  async function call(path,body,method='POST',auth=token) {
    const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},...(method!=='GET'&&{body:JSON.stringify(body||{})})});
    return {status:response.status,body:await response.json()};
  }
  await t.test('old pending attempt finishes with old rules after the version switch',async()=>{
    const status=await call(path(lessons[0],'quiz-status'),null,'GET');
    assert.equal(status.body.resumingLegacy,true);assert.equal(status.body.questionsPerAttempt,1);
    const resumed=await call(path(lessons[0],'quiz/start'));
    assert.equal(resumed.body.attemptToken,legacyToken);
    assert.equal(resumed.body.questions.length,1);
    const result=await call(path(lessons[0],'quiz-attempt'),{attemptToken:legacyToken,answers:[{questionId:legacyQuestion,optionId:legacyOption}]});
    assert.equal(result.status,200); assert.equal(result.body.passed,true);
  });
  const started=await call(path(lessons[0],'quiz/start'));
  assert.equal(started.status,200);
  const attemptToken=started.body.attemptToken;
  await control.query('UPDATE lessons SET questions_per_attempt=48 WHERE id=$1', [lessons[0]]);
  const activeStatus=await call(path(lessons[0],'quiz-status'),null,'GET');
  assert.equal(activeStatus.body.questionsPerAttempt,24,'snapshot packet count wins over stale lesson config');
  assert.equal(activeStatus.body.totalQuestions,24);
  assert.equal(activeStatus.body.inProgressAttemptToken,attemptToken);
  assert.equal(started.body.draftEnabled,true);
  let snapshot=(await control.query(`SELECT assessment_snapshot FROM quiz_attempts WHERE attempt_token=$1`,[attemptToken])).rows[0].assessment_snapshot;
  const answers=snapshot.questions.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.is_correct).id}));
  await t.test('public start, check and review do not reveal current answers or transcripts',async()=>{
    const text=JSON.stringify(started.body);
    assert.doesNotMatch(text,/is_correct|correct_answer|acceptedAnswers|audio_script|explanation|distractorReasons/);
    assert.equal(started.body.questions.length,24);
    const check=await call(`/lessons/${lessons[0]}/quiz/check`,answers[0]);
    assert.equal(check.status,409); assert.equal(check.body.error,'feedback_after_submit');
    assert.equal((await call(path(lessons[0],`quiz/review?attemptToken=${attemptToken}`),null,'GET')).status,404);
  });
  await t.test('draft revision protects two tabs and resume keeps the exact packet after 24 hours',async()=>{
    assert.equal((await call(path(lessons[0],'quiz/draft'),{attemptToken,answers:answers.slice(0,2),revision:0},'PUT')).body.revision,1);
    assert.equal((await call(path(lessons[0],'quiz/draft'),{attemptToken,answers:[],revision:0},'PUT')).status,409);
    assert.equal((await call(path(lessons[0],'quiz/draft'),{attemptToken,answers:[],revision:1},'PUT',otherToken)).status,404);
    await control.query(`UPDATE quiz_attempts SET started_at=NOW()-interval '24 hours' WHERE attempt_token=$1`,[attemptToken]);
    const resumed=await call(path(lessons[0],'quiz/start'));
    assert.equal(resumed.body.attemptToken,attemptToken); assert.equal(resumed.body.draftRevision,1);
    assert.deepEqual(resumed.body.draftAnswers,answers.slice(0,2));
    assert.deepEqual(resumed.body.questions,started.body.questions);
    assert.equal(resumed.body.expiresAt,null);
    assert.equal((await call(path(lessons[0],'quiz-attempt'),{attemptToken,answers,draftRevision:0})).status,409);
  });
  await t.test('audio is scoped to owner, lesson, sampled question, and entitlement',async()=>{
    const audio=snapshot.questions.find(q=>q.question_category==='listening');
    const suffix=`quiz/audio/${audio.id}?attemptToken=${attemptToken}`;
    for (const endpoint of ['tts','tts/dialog']) {
      const publicAudio=await fetch(`${base}/${endpoint}?text=${encodeURIComponent(audio.audio_script)}`);
      assert.equal(publicAudio.status,403,'versioned scripts are not a public TTS whitelist entry');
    }
    assert.equal((await call(path(lessons[0],suffix),null,'GET',otherToken)).status,404);
    assert.equal((await call(path(lessons[1],suffix),null,'GET')).status,404);
    assert.equal((await call(path(lessons[0],`quiz/audio/${snapshot.questions[0].id}?attemptToken=${attemptToken}`),null,'GET')).status,404);
    const denied=await call(path(n4lesson,suffix),null,'GET'); assert.equal(denied.status,403);
    // No paid audio generation in tests. The disabled provider yields an explicit retryable error, never a script.
    const own=await call(path(lessons[0],suffix),null,'GET'); assert.equal(own.status,503); assert.equal(own.body.error,'tts_disabled');
    const {ttsHashKey,parseDialog,voiceForSpeaker}=await import('./routes/tts.js');
    const voices=parseDialog(audio.audio_script).map((turn,i)=>voiceForSpeaker(turn.speaker,i).voiceId);
    const hash=ttsHashKey(audio.audio_script,voices);
    const bytes=Buffer.from('isolated cached audio transport fixture');
    await control.query(`INSERT INTO tts_cache(text_hash,text,audio) VALUES ($1,$2,$3)`,[hash,audio.audio_script,bytes]);
    const cached=await fetch(base+path(lessons[0],suffix),{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(cached.status,200);assert.equal(cached.headers.get('Cache-Control'),'private, no-store');
    assert.equal(cached.headers.get('Content-Type'),'audio/mpeg');
    assert.deepEqual(Buffer.from(await cached.arrayBuffer()),bytes);
  });
  await t.test('grading uses immutable keys and can be replayed safely',async()=>{
    await control.query(`UPDATE quiz_options SET is_correct=false WHERE question_id=$1`,[snapshot.questions[0].id]);
    await control.query(`UPDATE lessons SET passing_score_pct=99, cooldown_hours=99 WHERE id=$1`,[lessons[0]]);
    const resumed=await call(path(lessons[0],'quiz/start'));
    assert.equal(resumed.body.passingScorePct,70);assert.equal(resumed.body.assessmentRules.passingScorePct,70);
    const result=await call(path(lessons[0],'quiz-attempt'),{attemptToken,answers,draftRevision:1});
    assert.equal(result.status,200); assert.equal(result.body.score,24); assert.equal(result.body.passed,true);
    assert.equal(result.body.passingScorePct,70);assert.equal(result.body.cooldownHours,0);
    assert.equal(result.body.review.length,24); assert.equal(result.body.sectionResults.length,4);
    const replay=await call(path(lessons[0],'quiz-attempt'),{attemptToken,answers:[],draftRevision:0});
    assert.deepEqual(replay.body,result.body);
    assert.deepEqual((await call(path(lessons[0],`quiz/review?attemptToken=${attemptToken}`),null,'GET')).body,result.body);
    assert.equal((await call(path(lessons[0],`quiz/review?attemptToken=${attemptToken}`),null,'GET',otherToken)).status,404);
    assert.equal((await control.query(`SELECT count(*)::int n FROM quiz_question_results WHERE lesson_id=$1`,[lessons[0]])).rows[0].n,25);
    await control.query(content); // Restore bank row; the completed snapshot remains unchanged.
    assert.equal((await call(path(lessons[0],'quiz-status'),null,'GET')).body.canAttempt,true,'completed attempt retains its original cooldown');
    await control.query(`UPDATE lessons SET cooldown_hours=0 WHERE id=$1`,[lessons[0]]);
    const next=await call(path(lessons[0],'quiz/start'));
    assert.equal(next.status,200); assert.notEqual(next.body.assessmentForm,started.body.assessmentForm);
  });
});
