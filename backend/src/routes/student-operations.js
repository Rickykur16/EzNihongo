import {Router} from 'express';
import {withTransaction} from '../db.js';
import {asyncHandler} from '../middleware.js';
import {allowed,requestAccess,accessFor,companyEnabled,fail} from '../company-policy.js';
import {id,text,choice,instant,version,keys,parseCase,STATUSES} from '../student-operations-rules.js';

export const operationsEnabled=()=>companyEnabled()&&process.env.STUDENT_OPERATIONS_ENABLED==='true';
const router=Router();
router.use((req,res,next)=>{if(!operationsEnabled())return res.status(404).json({error:'student_operations_disabled'});next();});
function check(access,courseId){if(!allowed(access,'work.operations',courseId))throw fail(403,'operations_scope_required');}
function page(value){if(value===undefined)return 0;if(typeof value!=='string'||!/^\d{1,5}$/.test(value)||Number(value)>10000)throw fail(400,'invalid_page');return Number(value);}
async function run(req,courseId,write,people,fn){
  check(req.access,courseId);
  return withTransaction(async client=>{
    await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
    if(write){
      const ids=[...new Set([req.access.user.id,...people].filter(Boolean))].sort();
      const rows=(await client.query('SELECT id,email FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows;
      if(rows.length!==ids.length||rows.some(u=>u.email.endsWith('@dihapus.invalid')))throw fail(400,'active_user_required');
    }
    const access=await requestAccess(req,client);check(access,courseId);
    if(!operationsEnabled())throw fail(404,'student_operations_disabled');
    const result=await fn(client,access);
    check(await requestAccess(req,client),courseId);
    if(!operationsEnabled())throw fail(404,'student_operations_disabled');
    return result;
  });
}
async function enrolled(client,userId,courseId){
  const r=await client.query("SELECT e.* FROM user_enrollments e JOIN users u ON u.id=e.user_id WHERE e.user_id=$1 AND e.course_id=$2 AND u.email NOT LIKE '%@dihapus.invalid'",[userId,courseId]);
  if(!r.rows.length)throw fail(404,'student_enrollment_not_found');return r.rows[0];
}
async function assignee(client,userId,courseId){
  if(!userId)return;
  const u=(await client.query("SELECT id,email FROM users WHERE id=$1 AND email NOT LIKE '%@dihapus.invalid'",[userId])).rows[0];
  if(!u||!allowed(await accessFor(u,client),'work.operations',courseId))throw fail(400,'assignee_lacks_operations_access');
}
// All evidence is restricted to the selected course. Progress and purchases are never written here.
export const STUDENTS_CTE=`WITH course_lessons AS MATERIALIZED (
 SELECT l.id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.course_id=$1
), activity AS (
 SELECT user_id,updated_at AS at FROM user_progress WHERE lesson_id IN (SELECT id FROM course_lessons)
 UNION ALL SELECT user_id,completed_at FROM quiz_attempts WHERE lesson_id IN (SELECT id FROM course_lessons) AND completed_at IS NOT NULL
 UNION ALL SELECT user_id,created_at FROM practice_attempts WHERE course_id=$1 OR (course_id IS NULL AND lesson_id IN (SELECT id FROM course_lessons))
 UNION ALL SELECT user_id,created_at FROM grammar_attempts WHERE lesson_id IN (SELECT id FROM course_lessons)
), last_activity AS (SELECT user_id,MAX(at) AS last_activity FROM activity GROUP BY user_id),
 completion AS (SELECT user_id,COUNT(*) FILTER(WHERE completed)::int AS completed FROM user_progress WHERE lesson_id IN (SELECT id FROM course_lessons) GROUP BY user_id),
 students AS (
 SELECT u.id,u.full_name,u.email,e.enrolled_at,e.expires_at,e.source,
 CASE WHEN e.status='revoked' THEN 'revoked' WHEN e.expires_at<=NOW() THEN 'expired' ELSE 'active' END AS access_status,
 COALESCE(p.onboarding,'new') AS onboarding,COALESCE(p.goal,'') AS goal,p.assigned_to,p.next_follow_up,COALESCE(p.version,0) AS version,
 a.full_name AS assignee_name,l.last_activity,COALESCE(c.completed,0) AS completed,(SELECT COUNT(*)::int FROM course_lessons) AS total_lessons,
 (e.status='active' AND (e.expires_at IS NULL OR e.expires_at>NOW())) AS active,
 (e.status='active' AND e.expires_at>NOW() AND e.expires_at<=NOW()+INTERVAL '7 days') AS expiring,
 (e.status='active' AND (e.expires_at IS NULL OR e.expires_at>NOW()) AND COALESCE(l.last_activity,e.enrolled_at)<=NOW()-INTERVAL '7 days') AS inactive,
 (p.next_follow_up<=NOW()) AS follow_up_due
 FROM user_enrollments e JOIN users u ON u.id=e.user_id
 LEFT JOIN student_operation_profiles p ON p.user_id=e.user_id AND p.course_id=e.course_id
 LEFT JOIN users a ON a.id=p.assigned_to LEFT JOIN last_activity l ON l.user_id=e.user_id LEFT JOIN completion c ON c.user_id=e.user_id
 WHERE e.course_id=$1 AND u.email NOT LIKE '%@dihapus.invalid'
)`;
router.get('/students',asyncHandler(async(req,res)=>{
  keys(req.query,['courseId','q','queue','offset']);
  const courseId=id(req.query.courseId),q=text(req.query.q??'',120),offset=page(req.query.offset);
  const queue=choice(req.query.queue??'all',['all','onboarding','inactive','expiring','follow_up']);
  const filters={all:'TRUE',onboarding:"active AND onboarding<>'ready'",inactive:'inactive',expiring:'expiring',follow_up:'follow_up_due'};
  res.json(await run(req,courseId,false,[],async client=>{
    const summary=(await client.query(STUDENTS_CTE+` SELECT COUNT(*)::int AS students,COUNT(*) FILTER(WHERE active)::int AS active,
      COUNT(*) FILTER(WHERE active AND onboarding<>'ready')::int AS onboarding,COUNT(*) FILTER(WHERE inactive)::int AS inactive,
      COUNT(*) FILTER(WHERE expiring)::int AS expiring,COUNT(*) FILTER(WHERE follow_up_due)::int AS follow_up FROM students`,[courseId])).rows[0];
    const rows=(await client.query(STUDENTS_CTE+` SELECT * FROM students WHERE ${filters[queue]} AND (strpos(lower(COALESCE(full_name,'')),lower($2))>0 OR strpos(lower(email),lower($2))>0) ORDER BY full_name NULLS LAST,id LIMIT 51 OFFSET $3`,[courseId,q,offset])).rows;
    return {students:rows.slice(0,50),hasMore:rows.length>50,offset,summary};
  }));
}));
router.put('/students/:userId',asyncHandler(async(req,res)=>{
  keys(req.body,['courseId','version','onboarding','goal','assignedTo','nextFollowUp']);
  const userId=id(req.params.userId),courseId=id(req.body.courseId),v=version(req.body.version);
  const onboarding=choice(req.body.onboarding,['new','contacted','ready']),goal=text(req.body.goal??'',2000);
  const assignedTo=req.body.assignedTo?id(req.body.assignedTo):null,nextFollowUp=instant(req.body.nextFollowUp??null);
  res.json(await run(req,courseId,true,[userId,assignedTo],async client=>{
    await enrolled(client,userId,courseId);await assignee(client,assignedTo,courseId);
    const current=(await client.query('SELECT version FROM student_operation_profiles WHERE user_id=$1 AND course_id=$2 FOR UPDATE',[userId,courseId])).rows[0];
    if((current?.version??0)!==v)throw fail(409,'operations_version_conflict');
    const row=(await client.query(`INSERT INTO student_operation_profiles(user_id,course_id,onboarding,goal,assigned_to,next_follow_up) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT(user_id,course_id) DO UPDATE SET onboarding=$3,goal=$4,assigned_to=$5,next_follow_up=$6,version=student_operation_profiles.version+1,updated_at=NOW() RETURNING *`,[userId,courseId,onboarding,goal,assignedTo,nextFollowUp])).rows[0];
    return {profile:row};
  }));
}));
router.get('/students/:userId/progress',asyncHandler(async(req,res)=>{
  const courseId=id(req.query.courseId),userId=id(req.params.userId);
  res.json(await run(req,courseId,false,[],async client=>{
    await enrolled(client,userId,courseId);
    const rows=(await client.query(`SELECT l.id,l.title,m.title AS chapter,COALESCE(p.completed,FALSE) AS completed,p.completed_at,p.updated_at
      FROM lessons l JOIN modules m ON m.id=l.module_id LEFT JOIN user_progress p ON p.lesson_id=l.id AND p.user_id=$2
      WHERE m.course_id=$1 ORDER BY m.sort_order,l.sort_order,l.id`,[courseId,userId])).rows;
    return {lessons:rows};
  }));
}));
router.get('/cases',asyncHandler(async(req,res)=>{
  keys(req.query,['courseId','userId','queue','offset']);
  const courseId=id(req.query.courseId),userId=req.query.userId?id(req.query.userId):null,offset=page(req.query.offset);
  const queue=choice(req.query.queue??'open',['open','all','overdue','resolved']);
  const where={open:"c.status<>'resolved'",all:'TRUE',overdue:"c.status<>'resolved' AND c.due_at<NOW()",resolved:"c.status='resolved'"}[queue];
  res.json(await run(req,courseId,false,[],async client=>{
    const rows=(await client.query(`SELECT c.*,u.full_name AS student_name,a.full_name AS assignee_name FROM student_operation_cases c JOIN users u ON u.id=c.user_id LEFT JOIN users a ON a.id=c.assigned_to
      WHERE c.course_id=$1 AND ($2::uuid IS NULL OR c.user_id=$2) AND ${where} AND u.email NOT LIKE '%@dihapus.invalid'
      ORDER BY CASE c.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,c.due_at NULLS LAST,c.created_at DESC,c.id LIMIT 51 OFFSET $3`,[courseId,userId,offset])).rows;
    const summary=(await client.query(`SELECT COUNT(*) FILTER(WHERE status<>'resolved')::int AS open,COUNT(*) FILTER(WHERE status<>'resolved' AND due_at<NOW())::int AS overdue FROM student_operation_cases WHERE course_id=$1`,[courseId])).rows[0];
    return {cases:rows.slice(0,50),hasMore:rows.length>50,offset,summary};
  }));
}));
router.post('/cases',asyncHandler(async(req,res)=>{
  const d=parseCase(req.body);
  res.status(201).json(await run(req,d.courseId,true,[d.userId,d.assignedTo],async(client,access)=>{
    await enrolled(client,d.userId,d.courseId);await assignee(client,d.assignedTo,d.courseId);
    const item=(await client.query(`INSERT INTO student_operation_cases(user_id,course_id,title,category,priority,assigned_to,escalated_to,description,due_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[d.userId,d.courseId,d.title,d.category,d.priority,d.assignedTo,d.escalatedTo,d.description,d.dueAt,access.user.id])).rows[0];
    await client.query("INSERT INTO student_operation_events(case_id,actor_user_id,event_key) VALUES ($1,$2,'created')",[item.id,access.user.id]);return {case:item};
  }));
}));
router.patch('/cases/:caseId',asyncHandler(async(req,res)=>{
  const caseId=id(req.params.caseId),courseId=id(req.body.courseId),userId=id(req.body.userId),v=version(req.body.version);
  const assignedTo=req.body.assignedTo?id(req.body.assignedTo):null;
  res.json(await run(req,courseId,true,[userId,assignedTo],async(client,access)=>{
    const current=(await client.query('SELECT * FROM student_operation_cases WHERE id=$1 AND course_id=$2 AND user_id=$3 FOR UPDATE',[caseId,courseId,userId])).rows[0];
    if(!current)throw fail(404,'case_not_found');if(current.version!==v)throw fail(409,'operations_version_conflict');
    const d=parseCase(req.body,current);await assignee(client,d.assignedTo,courseId);
    const item=(await client.query(`UPDATE student_operation_cases SET title=$2,category=$3,status=$4,priority=$5,assigned_to=$6,escalated_to=$7,description=$8,resolution=$9,due_at=$10,
      resolved_at=CASE WHEN $4='resolved' THEN COALESCE(resolved_at,NOW()) ELSE NULL END,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,[caseId,d.title,d.category,d.status,d.priority,d.assignedTo,d.escalatedTo,d.description,d.resolution,d.dueAt])).rows[0];
    await client.query('INSERT INTO student_operation_events(case_id,actor_user_id,event_key,note) VALUES ($1,$2,$3,$4)',[caseId,access.user.id,current.status===d.status?'updated':'status_changed',current.status===d.status?'':current.status+' → '+d.status]);return {case:item};
  }));
}));
router.get('/cases/:caseId/events',asyncHandler(async(req,res)=>{
  const courseId=id(req.query.courseId),caseId=id(req.params.caseId);
  res.json(await run(req,courseId,false,[],async client=>{
    if(!(await client.query('SELECT id FROM student_operation_cases WHERE id=$1 AND course_id=$2',[caseId,courseId])).rows.length)throw fail(404,'case_not_found');
    return {events:(await client.query('SELECT event_key,note,occurred_at FROM student_operation_events WHERE case_id=$1 ORDER BY occurred_at DESC,id LIMIT 100',[caseId])).rows};
  }));
}));
router.post('/cases/:caseId/events',asyncHandler(async(req,res)=>{
  keys(req.body,['courseId','userId','note']);
  const courseId=id(req.body.courseId),userId=id(req.body.userId),caseId=id(req.params.caseId),note=text(req.body.note,4000,true);
  res.status(201).json(await run(req,courseId,true,[userId],async(client,access)=>{
    if(!(await client.query('SELECT id FROM student_operation_cases WHERE id=$1 AND course_id=$2 AND user_id=$3 FOR UPDATE',[caseId,courseId,userId])).rows.length)throw fail(404,'case_not_found');
    await client.query("INSERT INTO student_operation_events(case_id,actor_user_id,event_key,note) VALUES ($1,$2,'note',$3)",[caseId,access.user.id,note]);return {ok:true};
  }));
}));
router.get('/sessions',asyncHandler(async(req,res)=>{
  const courseId=id(req.query.courseId),offset=page(req.query.offset);
  res.json(await run(req,courseId,false,[],async client=>{
    const sessions=(await client.query(`SELECT l.id,l.title,l.starts_at,l.ends_at,l.status,COUNT(a.user_id)::int AS recorded,COUNT(a.user_id) FILTER(WHERE a.status IN ('present','late'))::int AS attended
      FROM live_classes l LEFT JOIN student_operation_attendance a ON a.live_class_id=l.id WHERE l.course_id=$1 GROUP BY l.id
      ORDER BY CASE WHEN l.starts_at>=NOW() AND l.status='scheduled' THEN 0 ELSE 1 END,CASE WHEN l.starts_at>=NOW() THEN l.starts_at END ASC,l.starts_at DESC,l.id LIMIT 51 OFFSET $2`,[courseId,offset])).rows;
    return {sessions:sessions.slice(0,50),hasMore:sessions.length>50,offset};
  }));
}));
router.get('/sessions/:sessionId/attendance',asyncHandler(async(req,res)=>{
  const courseId=id(req.query.courseId),sessionId=id(req.params.sessionId),offset=page(req.query.offset),q=text(req.query.q??'',120);
  res.json(await run(req,courseId,false,[],async client=>{
    const session=(await client.query('SELECT id,starts_at,status FROM live_classes WHERE id=$1 AND course_id=$2',[sessionId,courseId])).rows[0];if(!session)throw fail(404,'session_not_found');
    const rows=(await client.query(`SELECT u.id,u.full_name,u.email,a.status,a.note,COALESCE(a.version,0) AS version,
      (e.enrolled_at<=l.starts_at AND (e.expires_at IS NULL OR e.expires_at>l.starts_at) AND (e.revoked_at IS NULL OR e.revoked_at>l.starts_at)) AS eligible
      FROM users u JOIN user_enrollments e ON e.user_id=u.id AND e.course_id=$1 JOIN live_classes l ON l.id=$2
      LEFT JOIN student_operation_attendance a ON a.user_id=u.id AND a.live_class_id=l.id
      WHERE u.email NOT LIKE '%@dihapus.invalid' AND (strpos(lower(COALESCE(u.full_name,'')),lower($3))>0 OR strpos(lower(u.email),lower($3))>0)
      ORDER BY u.full_name,u.id LIMIT 51 OFFSET $4`,[courseId,sessionId,q,offset])).rows;
    return {session,students:rows.slice(0,50),hasMore:rows.length>50,offset};
  }));
}));
router.put('/sessions/:sessionId/attendance/:userId',asyncHandler(async(req,res)=>{
  keys(req.body,['courseId','version','status','note']);
  const courseId=id(req.body.courseId),sessionId=id(req.params.sessionId),userId=id(req.params.userId),v=version(req.body.version),status=choice(req.body.status,['present','late','excused','absent']),note=text(req.body.note??'',2000);
  res.json(await run(req,courseId,true,[userId],async(client,access)=>{
    const e=await enrolled(client,userId,courseId),s=(await client.query('SELECT * FROM live_classes WHERE id=$1 AND course_id=$2 FOR SHARE',[sessionId,courseId])).rows[0];
    if(!s)throw fail(404,'session_not_found');
    if(s.status==='cancelled'||new Date(s.starts_at)>new Date())throw fail(409,'session_not_started');
    if(new Date(e.enrolled_at)>s.starts_at||(e.expires_at&&e.expires_at<=s.starts_at)||(e.revoked_at&&e.revoked_at<=s.starts_at))throw fail(409,'not_enrolled_at_session');
    const current=(await client.query('SELECT version FROM student_operation_attendance WHERE live_class_id=$1 AND user_id=$2 FOR UPDATE',[sessionId,userId])).rows[0];
    if((current?.version??0)!==v)throw fail(409,'operations_version_conflict');
    const row=(await client.query(`INSERT INTO student_operation_attendance(live_class_id,user_id,status,note,recorded_by) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT(live_class_id,user_id) DO UPDATE SET status=$3,note=$4,recorded_by=$5,version=student_operation_attendance.version+1,updated_at=NOW() RETURNING *`,[sessionId,userId,status,note,access.user.id])).rows[0];return {attendance:row};
  }));
}));
export default router;
