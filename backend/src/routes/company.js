import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { companyEnabled, staffEnabled, insightsEnabled, requestAccess, accessFor, liveAdmin, allowed, fail, DIVISIONS, ROLE_CATALOG, companyError } from '../company-policy.js';
import { FLOWS, fields, initialStatus, optionalId, validateTransition, campaignLink } from '../company-work.js';
import { readInsights } from '../company-insights.js';
import { readCompanyWork } from '../company-read-work.js';
import rateLimit from 'express-rate-limit';
import studentOperationsRouter, {operationsEnabled} from './student-operations.js';

const router = Router();
router.use((req,res,next) => {
  res.set('Cache-Control','private, no-store'); res.vary('Authorization');
  if (!companyEnabled()) return res.status(404).json({error:'company_workspace_disabled'});
  next();
});
router.use(asyncHandler(async (req,res,next) => {
  req.access = await requestAccess(req);
  if (!req.access.isAdmin && !req.access.divisions.length) throw fail(403,'staff_access_required');
  next();
}));
function owner(access) { if (!access.isAdmin) throw fail(403,'owner_required'); }
function check(access, division, courseId = null) { if (!allowed(access,'work.' + division,courseId)) throw fail(403,'division_scope_required'); }
async function lockPeople(client, ids) {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  const result = await client.query('SELECT id,email FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',[unique]);
  if (result.rows.length !== unique.length || result.rows.some(u=>u.email.endsWith('@dihapus.invalid'))) throw fail(400,'active_user_required');
  return result.rows;
}
async function mutation(req, otherIds, fn) {
  return withTransaction(async client => {
    await lockPeople(client,[req.access.user.id,...otherIds]);
    const access = await requestAccess(req,client);
    return fn(client,access);
  });
}
async function audit(client, item, actor, event) {
  await client.query('INSERT INTO company_work_events(item_id,actor_user_id,event_key,item_version) VALUES ($1,$2,$3,$4)',[item.id,actor,event,item.version]);
}
async function queueSchedule(client,item) {
  await client.query("UPDATE company_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE item_id=$1 AND state IN ('pending','leased','failed')",[item.id]);
  if (item.kind === 'content' && item.status === 'scheduled') {
    if (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= Date.now()) throw fail(400,'future_schedule_required');
    await client.query("INSERT INTO company_outbox(item_id,item_version,event_key,available_at) VALUES ($1,$2,'work.scheduled',$3) ON CONFLICT DO NOTHING",[item.id,item.version,item.scheduled_at]);
  }
}
async function validateAssignee(client,access, data) {
  if (!data.assignedTo) return;
  const r = await client.query('SELECT id,email FROM users WHERE id=$1',[data.assignedTo]);
  const assignee = r.rows[0];
  if (!assignee || assignee.email.endsWith('@dihapus.invalid')) throw fail(400,'active_assignee_required');
  // Memberships are checked even during owner-only canary so assignment cannot
  // imply a grant. No email invitations or implicit account creation.
  const targetAccess = await accessFor(assignee,client);
  if (!allowed(targetAccess,'work.'+data.division,data.courseId)) throw fail(400,'assignee_lacks_division_access');
}
router.get('/access',asyncHandler(async(req,res)=> {
  res.json({version:1,isAdmin:req.access.isAdmin,staffEnabled:staffEnabled(),divisions:req.access.divisions.map(id=>({id,name:DIVISIONS[id]})),
    studentOperations:{enabled:operationsEnabled()},
    insights: { enabled: insightsEnabled(), scopes: !insightsEnabled() ? {} : Object.fromEntries(Object.keys(DIVISIONS).flatMap(d => {
      const permission = 'insights.' + d;
      if (allowed(req.access, permission)) return [[d, 'global']];
      const ids = req.access.grants.filter(g => g.permission_key === permission && g.scope_type === 'course').map(g => g.course_id);
      return ids.length ? [[d, ids]] : [];
    })) },
    flows:FLOWS,roles:req.access.isAdmin?Object.keys(ROLE_CATALOG):[],
    scopes:req.access.isAdmin ? {} : Object.fromEntries(req.access.divisions.map(d=>[d, allowed(req.access,'work.'+d)?'global':req.access.grants.filter(g=>g.permission_key==='work.'+d).map(g=>g.course_id)]))});
}));
const insightsLimit = rateLimit({ windowMs: 60000, limit: 20, keyGenerator: req => req.access.user.id,
  standardHeaders: true, legacyHeaders: false, message: { error: 'insights_rate_limit' } });
router.get('/insights', insightsLimit, asyncHandler(async(req,res)=> {
  if (!insightsEnabled()) throw fail(404, 'company_insights_disabled');
  // Fixed complete UTC weeks and one explicitly authorized course: no custom
  // user/date filters, exports, global totals or cross-course scope unions.
  if (Object.keys(req.query).some(k => !['division', 'courseId'].includes(k))) throw fail(400, 'invalid_insights_filter');
  const division = req.query.division, courseId = optionalId(req.query.courseId);
  if (typeof division !== 'string' || !Object.hasOwn(DIVISIONS, division) || !courseId) throw fail(400, 'insights_division_and_course_required');
  const permission = 'insights.' + division;
  if (!allowed(req.access, permission, courseId)) throw fail(403, 'insights_scope_required');
  const report = await readInsights(courseId);
  // Re-evaluate identity/expiry/revocation even on a cache hit and after a slow
  // calculation. Cached metrics never act as an authorization cache.
  const currentAccess = await requestAccess(req);
  if (!insightsEnabled() || !allowed(currentAccess, permission, courseId)) throw fail(403, 'insights_scope_required');
  const detailed = ['technology', 'academic'].includes(division);
  res.json({ ...report, difficulties: detailed ? report.difficulties : undefined, detailAccess: detailed });
}));
router.get('/members',asyncHandler(async(req,res)=> {
  owner(req.access);
  const r = await query(`SELECT m.*, u.email, COALESCE(json_agg(json_build_object('type',s.scope_type,'courseId',s.course_id)) FILTER (WHERE s.id IS NOT NULL),'[]') AS scopes
    FROM staff_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN staff_membership_scopes s ON s.membership_id=m.id
    GROUP BY m.id,u.email ORDER BY m.created_at DESC LIMIT 200`);
  res.json({members:r.rows});
}));
router.post('/members',asyncHandler(async(req,res)=> {
  owner(req.access);
  const userId = optionalId(req.body.userId); if (!userId) throw fail(400,'user_id_required');
  const role = req.body.role; if (!Object.hasOwn(ROLE_CATALOG,role)) throw fail(400,'unknown_role');
  const scopes = req.body.scopes;
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > 30) throw fail(400,'explicit_scope_required');
  for (const s of scopes) if (!s || !['global','course'].includes(s.type) || (s.type==='course' && !optionalId(s.courseId)) || (s.type==='global' && s.courseId)) throw fail(400,'invalid_scope');
  if (scopes.some(s=>s.type==='global') && scopes.length !== 1) throw fail(400,'global_scope_must_stand_alone');
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) throw fail(400,'future_expiry_required');
  const member = await mutation(req,[userId],async(client,access)=> {
    owner(access);
    const u=(await client.query('SELECT id,email FROM users WHERE id=$1',[userId])).rows[0];
    if (await liveAdmin(u.email,client)) throw fail(400,'existing_owner_does_not_need_limited_role');
    // Seed only code-owned catalogs; never seed users or memberships at boot.
    await client.query('INSERT INTO staff_roles(role_key,division_key,label) VALUES ($1,$1,$2) ON CONFLICT DO NOTHING',[role,DIVISIONS[role]]);
    for (const p of ROLE_CATALOG[role]) {
      await client.query('INSERT INTO staff_permissions(permission_key,description) VALUES ($1,$1) ON CONFLICT DO NOTHING',[p]);
      await client.query('INSERT INTO staff_role_permissions(role_key,permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',[role,p]);
    }
    const r=await client.query(`INSERT INTO staff_memberships(user_id,role_key,granted_by,expires_at) VALUES ($1,$2,$3,$4)
      ON CONFLICT(user_id,role_key) DO UPDATE SET status='active',granted_by=$3,expires_at=$4,revoked_at=NULL,revoked_by=NULL RETURNING *`,[userId,role,access.user.id,expiresAt]);
    const m=r.rows[0];
    await client.query('DELETE FROM staff_membership_scopes WHERE membership_id=$1',[m.id]);
    for (const s of scopes) await client.query('INSERT INTO staff_membership_scopes(membership_id,scope_type,course_id) VALUES ($1,$2,$3)',[m.id,s.type,s.courseId||null]);
    await client.query("INSERT INTO staff_audit_events(event_key,outcome,actor_user_id,subject_user_id) VALUES ('membership.granted','success',$1,$2)",[access.user.id,userId]);
    return m;
  }); res.status(201).json({member});
}));
router.post('/members/:id/revoke',asyncHandler(async(req,res)=> {
  owner(req.access); const id=optionalId(req.params.id);
  const target=(await query('SELECT user_id FROM staff_memberships WHERE id=$1',[id])).rows[0];
  if (!target) throw fail(404,'membership_not_found');
  await mutation(req,[target.user_id],async(client,access)=> {
    owner(access);
    await client.query("UPDATE staff_memberships SET status='revoked',revoked_at=NOW(),revoked_by=$2 WHERE id=$1 AND status='active'",[id,access.user.id]);
    await client.query("INSERT INTO staff_audit_events(event_key,outcome,actor_user_id,subject_user_id) VALUES ('membership.revoked','success',$1,$2)",[access.user.id,target.user_id]);
  }); res.json({ok:true});
}));
router.get('/people',asyncHandler(async(req,res)=> {
  owner(req.access);
  const email=String(req.query.email||'').trim(); if(!email || email.length>254)throw fail(400,'exact_email_required');
  const r=await query('SELECT id,email,full_name FROM users WHERE lower(email)=lower($1) LIMIT 2',[email]);
  res.json({people:r.rows});
}));
router.get('/courses',asyncHandler(async(req,res)=> {
  const r=await query('SELECT id,title,slug FROM courses ORDER BY title');
  // Only public catalog metadata; no lessons, drafts, progress, or user data.
  const ids=req.access.grants.filter(g=>g.scope_type==='course').map(g=>g.course_id);
  const global=req.access.isAdmin || req.access.grants.some(g=>g.scope_type==='global');
  res.json({courses:global?r.rows:r.rows.filter(c=>ids.includes(c.id))});
}));
router.get('/assignees',asyncHandler(async(req,res)=> {
  const division=String(req.query.division||''),courseId=optionalId(req.query.courseId);check(req.access,division,courseId);
  const r=await query(`SELECT DISTINCT u.id,u.full_name FROM users u
    JOIN staff_memberships m ON m.user_id=u.id JOIN staff_roles r ON r.role_key=m.role_key
    JOIN staff_role_permissions p ON p.role_key=m.role_key JOIN staff_membership_scopes s ON s.membership_id=m.id
    WHERE r.division_key=$1 AND p.permission_key=$2 AND m.status='active' AND m.revoked_at IS NULL
      AND (m.expires_at IS NULL OR m.expires_at>NOW()) AND (s.scope_type='global' OR s.course_id=$3)
      AND u.email NOT LIKE '%@dihapus.invalid' ORDER BY u.full_name LIMIT 100`,[division,'work.'+division,courseId]);
  const self=await query('SELECT id,full_name FROM users WHERE id=$1',[req.access.user.id]);
  res.json({people:[...new Map([...r.rows,...self.rows].map(u=>[u.id,u])).values()]});
}));
router.get('/work',asyncHandler(async(req,res)=> {
  res.json(await readCompanyWork(req,'board'));
}));
const deskLimit = rateLimit({windowMs:60000,limit:60,keyGenerator:req=>req.access.user.id,
  standardHeaders:true,legacyHeaders:false,message:{error:'work_list_rate_limit'}});
router.get('/desk',deskLimit,asyncHandler(async(req,res)=>res.json(await readCompanyWork(req,'desk'))));
router.get('/calendar',deskLimit,asyncHandler(async(req,res)=>res.json(await readCompanyWork(req,'calendar'))));
router.post('/work',asyncHandler(async(req,res)=> {
  const d=fields(req.body); check(req.access,d.division,d.courseId);
  if (d.kind==='case') throw fail(400,'use_case_sync');
  const item=await mutation(req,[d.assignedTo],async(client,access)=> {
    check(access,d.division,d.courseId); await validateAssignee(client,access,d);
    const r=await client.query(`INSERT INTO company_work_items(division_key,kind,title,description,status,priority,created_by,assigned_to,course_id,link_url,published_url,release_sha,scheduled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[d.division,d.kind,d.title,d.description,initialStatus(d.kind),d.priority,access.user.id,d.assignedTo,d.courseId,d.linkUrl,d.publishedUrl,d.releaseSha,d.scheduledAt]);
    await audit(client,r.rows[0],access.user.id,'created'); return r.rows[0];
  }); res.status(201).json({item});
}));
router.patch('/work/:id',asyncHandler(async(req,res)=> {
  const id=optionalId(req.params.id);
  const assignedTo=req.body.assignedTo?optionalId(req.body.assignedTo):null;
  const item=await mutation(req,[assignedTo],async(client,access)=> {
    const current=(await client.query('SELECT * FROM company_work_items WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!current)throw fail(404,'work_not_found'); check(access,current.division_key,current.course_id);
    if(req.body.version!==current.version)throw fail(409,'work_version_conflict');
    if(current.status==='archived')throw fail(409,'archived_work_is_read_only');
    const d=fields(req.body,current); check(access,d.division,d.courseId); await validateAssignee(client,access,d);
    let status=current.status;
    const changedCopy=d.title!==current.title || d.description!==current.description || d.linkUrl!==current.link_url || d.courseId!==current.course_id;
    if(['content','campaign'].includes(current.kind) && changedCopy && status!=='draft') status='draft';
    if(req.body.status!==undefined) {
      if(changedCopy && ['content','campaign'].includes(current.kind))throw fail(409,'save_revision_before_approval');
      validateTransition({...current,scheduled_at:d.scheduledAt,published_url:d.publishedUrl,release_sha:d.releaseSha,link_url:d.linkUrl},req.body.status);
      status=req.body.status;
    }
    const r=await client.query(`UPDATE company_work_items SET title=$2,description=$3,priority=$4,assigned_to=$5,course_id=$6,
      link_url=$7,published_url=$8,release_sha=$9,scheduled_at=$10,status=$11,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id,d.title,d.description,d.priority,d.assignedTo,d.courseId,d.linkUrl,d.publishedUrl,d.releaseSha,d.scheduledAt,status]);
    await audit(client,r.rows[0],access.user.id,req.body.status?'transitioned':'updated'); await queueSchedule(client,r.rows[0]); return r.rows[0];
  }); res.json({item});
}));
router.get('/work/:id/events',asyncHandler(async(req,res)=> {
  const id=optionalId(req.params.id), item=(await query('SELECT * FROM company_work_items WHERE id=$1',[id])).rows[0];
  if(!item)throw fail(404,'work_not_found'); check(req.access,item.division_key,item.course_id);
  const r=await query('SELECT event_key,item_version,occurred_at FROM company_work_events WHERE item_id=$1 ORDER BY occurred_at DESC LIMIT 100',[id]);res.json({events:r.rows});
}));
router.post('/work/:id/link',asyncHandler(async(req,res)=> {
  const item=(await query('SELECT * FROM company_work_items WHERE id=$1',[optionalId(req.params.id)])).rows[0];
  if(!item)throw fail(404,'work_not_found'); check(req.access,item.division_key,item.course_id);
  res.json({url:campaignLink(item,req.body),measurement:'UTM link only; no historical attribution inferred'});
}));
router.post('/cases/sync',asyncHandler(async(req,res)=> {
  const division=req.body.division; if(!['finance','operations'].includes(division))throw fail(400,'case_division_required');
  check(req.access,division);
  const result=await mutation(req,[],async(client,access)=> {
    check(access,division);
    // Read current sources; no payment/enrollment mutations, no historic sends.
    if(division==='finance')return client.query(`INSERT INTO company_work_items(division_key,kind,title,status,course_id,source_order_id)
      SELECT 'finance','case','Review bukti pembayaran','new',o.course_id,o.id FROM orders o
      WHERE o.status='awaiting_review' AND o.expires_at>NOW() AND EXISTS(SELECT 1 FROM order_payments p WHERE p.order_id=o.id AND p.status='pending')
      ORDER BY o.created_at LIMIT 200 ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING RETURNING id`);
    return client.query(`INSERT INTO company_work_items(division_key,kind,title,status,course_id,source_discussion_id)
      SELECT 'operations','case','Tinjau diskusi siswa','new',m.course_id,d.id FROM discussions d JOIN lessons l ON l.id=d.lesson_id JOIN modules m ON m.id=l.module_id
      WHERE NOT d.is_deleted AND d.parent_id IS NULL AND d.created_at>NOW()-INTERVAL '14 days'
      ORDER BY d.created_at LIMIT 200 ON CONFLICT (source_discussion_id) WHERE source_discussion_id IS NOT NULL DO NOTHING RETURNING id`);
  });res.json({created:result.rowCount});
}));
router.get('/jobs',asyncHandler(async(req,res)=> {
  owner(req.access);const r=await query('SELECT id,item_id,event_key,state,attempts,available_at,last_error FROM company_outbox ORDER BY created_at DESC LIMIT 100');res.json({jobs:r.rows});
}));
router.use('/operations',studentOperationsRouter);
router.use(companyError);
export default router;
