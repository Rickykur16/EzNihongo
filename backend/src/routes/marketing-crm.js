import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {query,withTransaction} from '../db.js';
import {asyncHandler} from '../middleware.js';
import {companyEnabled,allowed,requestAccess,accessFor,fail} from '../company-policy.js';
import {parseLead,uuid,text,version,STAGES,SOURCES} from '../marketing-crm-rules.js';
import growthRouter from './marketing-growth.js';

export const crmEnabled=()=>companyEnabled()&&process.env.MARKETING_CRM_ENABLED==='true';
const router=Router();
const accessKey=access=>JSON.stringify([access.user.id,access.isAdmin,access.grants.filter(g=>g.permission_key==='work.marketing').map(g=>[g.scope_type,g.course_id]).sort()]);
router.use((req,res,next)=>{if(!crmEnabled())return res.status(404).json({error:'crm_disabled'});next();});
router.use(rateLimit({windowMs:60000,limit:120,keyGenerator:req=>req.access.user.id,standardHeaders:true,legacyHeaders:false,message:{error:'crm_rate_limit'}}));
function check(access,courseId){if(!allowed(access,'work.marketing',courseId))throw fail(403,'crm_scope_required');}
function scope(access,params){
  if(allowed(access,'work.marketing'))return 'TRUE';
  const ids=access.grants.filter(g=>g.permission_key==='work.marketing'&&g.scope_type==='course').map(g=>g.course_id);
  if(!ids.length)throw fail(403,'crm_scope_required');
  params.push(ids);return `l.course_id=ANY($${params.length}::uuid[])`;
}
async function refs(client,access,d){
  check(access,d.courseId);
  if(d.courseId&&!(await client.query('SELECT id FROM courses WHERE id=$1',[d.courseId])).rows.length)throw fail(400,'crm_course_not_found');
  if(d.assignedTo){
    const person=(await client.query('SELECT id,email FROM users WHERE id=$1',[d.assignedTo])).rows[0];
    if(!person||person.email.endsWith('@dihapus.invalid')||!allowed(await accessFor(person,client),'work.marketing',d.courseId))throw fail(400,'crm_assignee_scope');
  }
}
async function mutate(req,fn){
  return withTransaction(async client=>{
    // Same user lock order as account erasure / staff grants.
    const ids=[...new Set([req.access.user.id,uuid(req.body?.assignedTo)].filter(Boolean))].sort();
    const people=(await client.query('SELECT id,email FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows;
    if(people.length!==ids.length||people.some(u=>u.email.endsWith('@dihapus.invalid')))throw fail(400,'crm_active_user_required');
    const access=await requestAccess(req,client);
    if(!crmEnabled())throw fail(404,'crm_disabled');
    return fn(client,access);
  });
}
async function audit(client,item,actor,key,note=''){
  await client.query('INSERT INTO marketing_lead_events(lead_id,actor_user_id,event_key,stage,note,lead_version) VALUES($1,$2,$3,$4,$5,$6)',[item.id,actor,key,item.stage,note,item.version]);
}
const columns=['course_id','full_name','phone','email','source','source_detail','goal','stage','offered_price','lost_reason','assigned_to','next_follow_up','referrer_name','background','category_interest','primary_problem','target_timeline','qualification_note','alternative','offer_angle','price_reaction','willingness_to_pay','objection','customer_words','decision_reason','next_action','interviewed_at'];
const values=d=>[d.courseId,d.fullName,d.phone,d.email,d.source,d.sourceDetail,d.goal,d.stage,d.offeredPrice,d.lostReason,d.assignedTo,d.nextFollowUp,d.referrerName,d.background,d.categoryInterest,d.primaryProblem,d.targetTimeline,d.qualificationNote,d.alternative,d.offerAngle,d.priceReaction,d.willingnessToPay,d.objection,d.customerWords,d.decisionReason,d.nextAction,d.interviewedAt];
const paymentJoin=`LEFT JOIN LATERAL (
  SELECT o.id AS order_id,o.approved_at,o.amount_idr FROM users buyer JOIN orders o ON o.user_id=buyer.id
  WHERE l.email<>'' AND buyer.email=l.email AND o.course_id=l.course_id AND o.status='approved'
    AND o.approved_at IS NOT NULL AND o.created_at>=l.created_at
    AND EXISTS(SELECT 1 FROM order_payments p WHERE p.order_id=o.id AND p.status='approved')
  ORDER BY o.approved_at,o.id LIMIT 1
) payment ON TRUE`;
const select=`SELECT l.*,c.title AS course_title,u.full_name AS assignee_name,payment.order_id AS paid_order_id,payment.approved_at AS paid_at FROM marketing_leads l LEFT JOIN courses c ON c.id=l.course_id LEFT JOIN users u ON u.id=l.assigned_to ${paymentJoin}`;

router.get('/leads',asyncHandler(async(req,res)=>{
  if(Object.keys(req.query).some(k=>!['courseId','stage','source','q','queue','offset'].includes(k)))throw fail(400,'crm_invalid_filter');
  if(Object.values(req.query).some(v=>typeof v!=='string'))throw fail(400,'crm_invalid_filter');
  const params=[],where=[scope(req.access,params)],add=(sql,value)=>{params.push(value);where.push(sql.replace('?',`$${params.length}`));};
  if(req.query.courseId){if(req.query.courseId==='unassigned'){check(req.access,null);where.push('l.course_id IS NULL');}else{const id=uuid(req.query.courseId,true);check(req.access,id);add('l.course_id=?',id);}}
  for(const [key,choices]of [['stage',STAGES],['source',SOURCES]])if(req.query[key]){if(!choices.includes(req.query[key]))throw fail(400,'crm_invalid_filter');add(`l.${key}=?`,req.query[key]);}
  const q=req.query.q===undefined?'':text(req.query.q,160);
  if(q){params.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');where.push(`(l.full_name ILIKE $${params.length} OR l.email ILIKE $${params.length} OR l.phone ILIKE $${params.length} OR l.source_detail ILIKE $${params.length})`);}
  const queue=req.query.queue||'all';if(!['all','open','due','mine'].includes(queue))throw fail(400,'crm_invalid_filter');
  if(['open','due'].includes(queue))where.push("l.stage NOT IN ('won','lost')");
  if(queue==='due')where.push('l.next_follow_up<=NOW()');
  if(queue==='mine')add('l.assigned_to=?',req.access.user.id);
  if(req.query.offset!==undefined&&!/^\d{1,7}$/.test(req.query.offset))throw fail(400,'crm_invalid_filter');
  const offset=Number(req.query.offset||0),condition=where.join(' AND ');
  // Summary and page share one snapshot and exactly the same authorized filters.
  const data=await withTransaction(async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const summary=(await client.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE l.stage NOT IN ('won','lost'))::int AS open,count(*) FILTER(WHERE l.stage='won')::int AS won,count(*) FILTER(WHERE l.stage='lost')::int AS lost,count(*) FILTER(WHERE payment.order_id IS NOT NULL)::int AS paid,count(*) FILTER(WHERE l.stage NOT IN ('won','lost') AND l.next_follow_up<=NOW())::int AS due FROM marketing_leads l ${paymentJoin} WHERE ${condition}`,params)).rows[0];
    const rows=(await client.query(`${select} WHERE ${condition} ORDER BY l.updated_at DESC,l.id DESC LIMIT 51 OFFSET $${params.length+1}`,[...params,offset])).rows;
    return {leads:rows.slice(0,50),hasMore:rows.length>50,summary};
  });
  const current=await requestAccess(req);
  if(!crmEnabled()||accessKey(current)!==accessKey(req.access))throw fail(403,'crm_access_changed');
  res.json(data);
}));
router.post('/leads',asyncHandler(async(req,res)=>{
  const id=uuid(req.body.id,true),d=parseLead(req.body);check(req.access,d.courseId);
  const result=await mutate(req,async(client,access)=>{
    await refs(client,access,d);
    const row=(await client.query(`INSERT INTO marketing_leads(id,${columns.join(',')},created_by) VALUES(${Array.from({length:columns.length+2},(_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(id) DO NOTHING RETURNING *`,[id,...values(d),access.user.id])).rows[0];
    if(row){await audit(client,row,access.user.id,'created');return {lead:row,created:true};}
    const old=(await client.query('SELECT * FROM marketing_leads WHERE id=$1',[id])).rows[0];
    if(!old||old.created_by!==access.user.id)throw fail(409,'crm_create_conflict');
    check(access,old.course_id);
    if(old.version!==1||JSON.stringify(parseLead({},old))!==JSON.stringify(d))throw fail(409,'crm_create_conflict');
    return {lead:old,created:false};
  });res.status(result.created?201:200).json({lead:result.lead});
}));
router.patch('/leads/:id',asyncHandler(async(req,res)=>{
  const id=uuid(req.params.id,true),expected=version(req.body.version);
  const item=await mutate(req,async(client,access)=>{
    const old=(await client.query('SELECT * FROM marketing_leads WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!old)throw fail(404,'crm_not_found');check(access,old.course_id);
    if(old.version!==expected)throw fail(409,'crm_version_conflict');
    const d=parseLead(req.body,old);await refs(client,access,d);
    const row=(await client.query(`UPDATE marketing_leads SET ${columns.map((col,i)=>col+'=$'+(i+2)).join(',')},version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,[id,...values(d)])).rows[0];
    await audit(client,row,access.user.id,old.stage===row.stage?'updated':'stage_changed');return row;
  });res.json({lead:item});
}));
router.get('/leads/:id/events',asyncHandler(async(req,res)=>{
  const id=uuid(req.params.id,true);
  const item=(await query('SELECT course_id FROM marketing_leads WHERE id=$1',[id])).rows[0];
  if(!item)throw fail(404,'crm_not_found');check(req.access,item.course_id);
  const events=(await query('SELECT id,event_key,stage,note,lead_version,occurred_at FROM marketing_lead_events WHERE lead_id=$1 ORDER BY lead_version DESC LIMIT 100',[id])).rows;
  const current=await requestAccess(req),latest=(await query('SELECT course_id FROM marketing_leads WHERE id=$1',[id])).rows[0];
  if(!latest||!crmEnabled())throw fail(404,'crm_not_found');check(current,latest.course_id);
  res.json({events});
}));
router.post('/leads/:id/events',asyncHandler(async(req,res)=>{
  if(Object.keys(req.body).some(k=>!['note','version'].includes(k)))throw fail(400,'crm_invalid_fields');
  const id=uuid(req.params.id,true),expected=version(req.body.version),note=text(req.body.note,2000,true);
  const item=await mutate(req,async(client,access)=>{
    const old=(await client.query('SELECT * FROM marketing_leads WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!old)throw fail(404,'crm_not_found');check(access,old.course_id);
    if(old.version!==expected)throw fail(409,'crm_version_conflict');
    const row=(await client.query('UPDATE marketing_leads SET version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[id])).rows[0];
    await audit(client,row,access.user.id,'note',note);return row;
  });res.status(201).json({lead:item});
}));
router.delete('/leads/:id',asyncHandler(async(req,res)=>{
  const id=uuid(req.params.id,true),expected=version(req.body.version);
  await mutate(req,async(client,access)=>{
    if(!access.isAdmin)throw fail(403,'owner_required');
    const old=(await client.query('SELECT * FROM marketing_leads WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!old)throw fail(404,'crm_not_found');
    if(old.version!==expected)throw fail(409,'crm_version_conflict');
    await client.query('DELETE FROM marketing_leads WHERE id=$1',[id]);
  });res.json({ok:true});
}));
router.use('/growth',growthRouter);
router.use((error,req,res,next)=>{
  if(error.code==='23505')return res.status(409).json({error:'crm_duplicate_contact'});
  if(error.code==='42P01')return res.status(503).json({error:'crm_setup_required'});
  next(error);
});
export default router;
