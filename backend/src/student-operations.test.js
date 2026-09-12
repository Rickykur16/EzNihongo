import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import pg from 'pg';
import {applyCompanyMigrations} from '../company-migrations/run.js';
import {applyOperationsMigrations} from '../operations-migrations/run.js';
import {parseCase} from './student-operations-rules.js';

test('case input requires a resolution and an explicit escalation team',()=>{
  const old={user_id:randomUUID(),course_id:randomUUID(),title:'Akses belum muncul',category:'access',status:'handling'};
  assert.throws(()=>parseCase({status:'resolved'},old),/resolution_required/);
  assert.throws(()=>parseCase({status:'waiting_team'},old),/escalation_team_required/);
  assert.throws(()=>parseCase({userId:randomUUID()},old),/case_student_is_fixed/);
  assert.throws(()=>parseCase({paymentStatus:'approved'},old),/invalid_fields/);
  assert.equal(parseCase({status:'resolved',resolution:'Akses diperiksa bersama siswa.'},old).status,'resolved');
});

test('student operations with real PostgreSQL: scope, queues, lifecycle, conflicts and erasure',{skip:!process.env.TEST_DATABASE_URL,timeout:90000},async t=>{
  const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.match(url.pathname,/test/);
  const schema='operations_test_'+randomUUID().replaceAll('-',''),control=new pg.Client({connectionString:url.href});await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.href;process.env.ADMIN_EMAILS='owner@example.invalid';process.env.JWT_ACCESS_SECRET='test-operations-access';process.env.JWT_REFRESH_SECRET='test-operations-refresh';
  process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';process.env.STUDENT_OPERATIONS_ENABLED='true';
  const {db}=await import('./db.js'),{signAccessToken}=await import('./auth.js'),{default:company}=await import('./routes/company.js');
  const {inspectStaffErasureTables,eraseStaffUserData}=await import('./staff-erasure.js');
  let server;t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text UNIQUE,full_name text);CREATE TABLE admin_emails(email text);
    CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text);CREATE TABLE modules(id uuid PRIMARY KEY,course_id uuid REFERENCES courses(id),title text,sort_order integer);
    CREATE TABLE lessons(id uuid PRIMARY KEY,module_id uuid REFERENCES modules(id),title text,sort_order integer);
    CREATE TABLE orders(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),status text,expires_at timestamptz);CREATE TABLE discussions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id));
    CREATE TABLE user_enrollments(user_id uuid REFERENCES users(id),course_id uuid REFERENCES courses(id),enrolled_at timestamptz NOT NULL DEFAULT NOW(),expires_at timestamptz,status text DEFAULT 'active',source text DEFAULT 'purchase',revoked_at timestamptz,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_progress(user_id uuid REFERENCES users(id),lesson_id uuid REFERENCES lessons(id),completed boolean,completed_at timestamptz,updated_at timestamptz);
    CREATE TABLE quiz_attempts(user_id uuid REFERENCES users(id),lesson_id uuid,completed_at timestamptz);
    CREATE TABLE practice_attempts(user_id uuid REFERENCES users(id),lesson_id uuid,course_id uuid,created_at timestamptz);
    CREATE TABLE grammar_attempts(user_id uuid REFERENCES users(id),lesson_id uuid,created_at timestamptz);
    CREATE TABLE live_classes(id uuid PRIMARY KEY,course_id uuid REFERENCES courses(id),title text,status text,starts_at timestamptz,ends_at timestamptz);`);
  await applyCompanyMigrations(control);
  assert.deepEqual(await applyOperationsMigrations(control),['001_student_operations']);assert.deepEqual(await applyOperationsMigrations(control),[]);
  const ids=Object.fromEntries(['owner','ops','scoped','finance','student','other','new','expired','revoked'].map(k=>[k,randomUUID()])),c1=randomUUID(),c2=randomUUID(),l1=randomUUID(),l2=randomUUID(),session=randomUUID();
  for(const [name,value]of Object.entries(ids))await control.query('INSERT INTO users VALUES($1,$2,$3)',[value,name+'@example.invalid',name]);
  await control.query("INSERT INTO courses VALUES($1,'N5','n5'),($2,'N4','n4');",[c1,c2]);
  await control.query("INSERT INTO modules VALUES($1,$1,'Bab 1',1),($2,$2,'Bab lain',1)",[c1,c2]);await control.query("INSERT INTO lessons VALUES($1,$2,'Hiragana',1),($3,$4,'N4',1)",[l1,c1,l2,c2]);
  for(const who of ['student','new','expired','revoked'])await control.query("INSERT INTO user_enrollments(user_id,course_id,enrolled_at,expires_at,status) VALUES($1,$2,NOW()-INTERVAL '20 days',NOW()+INTERVAL '5 days','active')",[ids[who],c1]);
  await control.query("UPDATE user_enrollments SET enrolled_at=NOW() WHERE user_id=$1",[ids.new]);
  await control.query("UPDATE user_enrollments SET expires_at=NOW()-INTERVAL '1 day' WHERE user_id=$1",[ids.expired]);
  await control.query("UPDATE user_enrollments SET status='revoked',revoked_at=NOW()-INTERVAL '3 days' WHERE user_id=$1",[ids.revoked]);
  await control.query('INSERT INTO user_enrollments(user_id,course_id) VALUES($1,$2)',[ids.other,c2]);
  // Activity in another course must not suppress the N5 inactivity queue.
  await control.query('INSERT INTO quiz_attempts VALUES($1,$2,NOW())',[ids.student,l2]);
  await control.query("INSERT INTO live_classes VALUES($1,$2,'Percakapan','completed',NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'+INTERVAL '1 hour')",[session,c1]);
  const app=express();app.use(express.json());app.use('/company',company);app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  server=app.listen(0,'127.0.0.1');await once(server,'listening');
  async function request(who,path,body,method=body?'POST':'GET'){
    const token=await signAccessToken(ids[who],who+'@example.invalid');const r=await fetch(`http://127.0.0.1:${server.address().port}/company${path}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
  }
  for(const [who,role,scope]of [['ops','operations',{type:'global'}],['scoped','operations',{type:'course',courseId:c1}],['finance','finance',{type:'global'}]]){const r=await request('owner','/members',{userId:ids[who],role,scopes:[scope]});assert.equal(r.status,201,JSON.stringify(r.data));}
  const before=(await control.query('SELECT * FROM user_enrollments ORDER BY user_id')).rows;
  await t.test('denies students, Finance and out-of-scope course access',async()=>{
    for(const who of ['student','finance'])assert.equal((await request(who,'/operations/students?courseId='+c1)).status,403);
    assert.equal((await request('scoped','/operations/students?courseId='+c2)).status,403);
    assert.equal((await request('scoped','/operations/students?courseId='+c1)).status,200);
    assert.equal((await request('ops','/operations/students')).status,400);
  });
  await t.test('queues reflect actual enrollment and course-specific evidence',async()=>{
    const r=await request('ops','/operations/students?courseId='+c1);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.summary.active,2);assert.equal(r.data.summary.inactive,1);assert.equal(r.data.summary.expiring,2);
    const inactive=await request('ops','/operations/students?courseId='+c1+'&queue=inactive');assert.deepEqual(inactive.data.students.map(s=>s.id),[ids.student]);
    await control.query('INSERT INTO user_progress VALUES($1,$2,TRUE,NOW(),NOW())',[ids.student,l1]);
    const progress=await request('scoped','/operations/students/'+ids.student+'/progress?courseId='+c1);assert.equal(progress.data.lessons.length,1);assert.equal(progress.data.lessons[0].completed,true);
    assert.equal((await request('ops','/operations/students?courseId='+c1+'&queue=inactive')).data.students.length,0);
  });
  await t.test('onboarding has optimistic locking and validates PIC scope',async()=>{
    const path='/operations/students/'+ids.student,body={courseId:c1,version:0,onboarding:'contacted',goal:'JLPT N5',assignedTo:ids.ops,nextFollowUp:new Date(Date.now()-60000).toISOString()};
    assert.equal((await request('scoped',path,body,'PUT')).status,200);assert.equal((await request('scoped',path,body,'PUT')).status,409);
    assert.equal((await request('ops',path,{...body,version:1,assignedTo:ids.finance},'PUT')).status,400);
    assert.equal((await request('ops','/operations/students?courseId='+c1+'&queue=follow_up')).data.students.length,1);
  });
  let item;
  await t.test('cases link students, enforce completion, preserve notes and reject stale edits',async()=>{
    const r=await request('ops','/operations/cases',{courseId:c1,userId:ids.student,title:'Akses belum muncul',category:'access',description:'Periksa akses',assignedTo:ids.ops,dueAt:new Date(Date.now()-60000).toISOString()});assert.equal(r.status,201,JSON.stringify(r.data));item=r.data.case;
    assert.equal((await request('scoped','/operations/cases',{courseId:c1,userId:ids.other,title:'Salah kursus',category:'other'})).status,404);
    const patch=extra=>request('ops','/operations/cases/'+item.id,{courseId:c1,userId:ids.student,version:item.version,...extra},'PATCH');
    assert.equal((await patch({status:'resolved'})).status,400);
    assert.equal((await patch({status:'waiting_team'})).status,400);
    const updated=await patch({status:'waiting_team',escalatedTo:'finance'});assert.equal(updated.status,200);assert.equal((await patch({status:'handling'})).status,409);item=updated.data.case;
    assert.equal((await request('ops','/operations/cases/'+item.id+'/events',{courseId:c1,userId:ids.student,note:'Sudah dikoordinasikan dengan Finance.'})).status,201);
    assert.equal((await request('ops','/operations/cases/'+item.id+'/events?courseId='+c1)).data.events.length,3);
    assert.equal((await request('ops','/operations/cases?courseId='+c1+'&queue=overdue')).data.cases.length,1);
    const done=await patch({status:'resolved',resolution:'Siswa sudah dapat mengakses materi.'});assert.equal(done.status,200);item=done.data.case;
    assert.equal((await request('ops','/operations/cases?courseId='+c1+'&queue=open')).data.cases.length,0);
    assert.equal((await request('finance','/operations/cases/'+item.id+'/events?courseId='+c1)).status,403);
  });
  await t.test('attendance starts unrecorded, checks session eligibility and prevents lost updates',async()=>{
    const path='/operations/sessions/'+session+'/attendance/';
    const roster=await request('ops','/operations/sessions/'+session+'/attendance?courseId='+c1);assert.equal(roster.status,200);assert.ok(roster.data.students.every(s=>s.status===null));
    const body={courseId:c1,version:0,status:'present',note:'Mengikuti sesi'};
    assert.equal((await request('ops',path+ids.student,body,'PUT')).status,200);assert.equal((await request('ops',path+ids.student,body,'PUT')).status,409);
    assert.equal((await request('ops',path+ids.new,body,'PUT')).status,409);assert.equal((await request('ops',path+ids.revoked,body,'PUT')).status,409);
    assert.equal((await request('ops',path+ids.other,body,'PUT')).status,404);
    assert.equal((await request('ops','/operations/sessions?courseId='+c1)).data.sessions[0].attended,1);
  });
  await t.test('does not mutate enrollment, payments or learner progress',async()=>{
    assert.deepEqual((await control.query('SELECT * FROM user_enrollments ORDER BY user_id')).rows,before);
    assert.equal((await control.query('SELECT count(*) FROM orders')).rows[0].count,'0');
    assert.equal((await control.query('SELECT completed FROM user_progress')).rows[0].completed,true);
  });
  await t.test('erasure clears student cases, notes, profile and attendance',async()=>{
    await control.query('BEGIN');const tables=await inspectStaffErasureTables(control);await eraseStaffUserData(control,ids.student,tables);await control.query('COMMIT');
    for(const table of ['student_operation_profiles','student_operation_cases','student_operation_events','student_operation_attendance'])assert.equal((await control.query('SELECT count(*) FROM '+table)).rows[0].count,'0');
  });
  await t.test('feature flag and revoked staff fail closed',async()=>{
    process.env.STUDENT_OPERATIONS_ENABLED='false';assert.equal((await request('owner','/operations/students?courseId='+c1)).status,404);process.env.STUDENT_OPERATIONS_ENABLED='true';
    await control.query("UPDATE staff_memberships SET status='revoked',revoked_at=NOW() WHERE user_id=$1",[ids.ops]);assert.equal((await request('ops','/operations/students?courseId='+c1)).status,403);
  });
});
