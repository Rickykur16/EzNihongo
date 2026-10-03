import {Router} from 'express';
import {withTransaction} from '../db.js';
import {asyncHandler} from '../middleware.js';
import {allowed,requestAccess,accessFor,fail} from '../company-policy.js';
import {uuid,text,version,SOURCES,ANGLES} from '../marketing-crm-rules.js';

const router=Router();
const VARIABLES=['','message','cta','sales_script','price_framing','channel','other'];
const REVIEW_STATES=['planned','running','complete'];
const paymentJoin=`LEFT JOIN LATERAL (
  SELECT o.id,o.approved_at,o.amount_idr FROM users buyer JOIN orders o ON o.user_id=buyer.id
  WHERE l.email<>'' AND buyer.email=l.email AND o.course_id=l.course_id AND o.status='approved'
    AND o.approved_at IS NOT NULL AND o.created_at>=l.created_at
    AND EXISTS(SELECT 1 FROM order_payments p WHERE p.order_id=o.id AND p.status='approved')
  ORDER BY o.approved_at,o.id LIMIT 1
) payment ON TRUE`;
function week(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))throw fail(400,'crm_invalid_week');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==1)throw fail(400,'crm_invalid_week');
  return value;
}
function course(access,value){
  const id=uuid(value);
  if(!allowed(access,'work.marketing',id))throw fail(403,'crm_scope_required');
  return id;
}
function scoped(access,courseId,params){
  if(courseId){params.push(courseId);return `l.course_id=$${params.length}`;}
  if(!allowed(access,'work.marketing'))throw fail(403,'crm_scope_required');
  return 'TRUE';
}
function reviewInput(body){
  const fields={segmentDecision:1000,buyerLanguage:1500,topObjection:1000,decision:1000,experimentHypothesis:1000,successMetric:300,experimentResult:1000};
  const allowedKeys=['courseId','week','version','experimentVariable','experimentAngle','experimentOwner','status',...Object.keys(fields)];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowedKeys.includes(k)))throw fail(400,'crm_invalid_fields');
  const data=Object.fromEntries(Object.entries(fields).map(([key,max])=>[key,text(body[key]??'',max)]));
  data.experimentVariable=body.experimentVariable??'';data.experimentAngle=body.experimentAngle??'';data.status=body.status??'planned';
  if(!VARIABLES.includes(data.experimentVariable)||!ANGLES.includes(data.experimentAngle)||!REVIEW_STATES.includes(data.status))throw fail(400,'crm_invalid_choice');
  data.experimentOwner=uuid(body.experimentOwner);
  if(data.experimentVariable&&!data.experimentHypothesis)throw fail(400,'crm_experiment_hypothesis_required');
  if(data.status==='complete'&&data.experimentVariable&&!data.experimentResult)throw fail(400,'crm_experiment_result_required');
  return data;
}
function spendInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['courseId','week','source','amountIdr','note','version'].includes(k)))throw fail(400,'crm_invalid_fields');
  if(!SOURCES.includes(body.source)||!Number.isSafeInteger(body.amountIdr)||body.amountIdr<0||body.amountIdr>1e12)throw fail(400,'crm_invalid_spend');
  return {source:body.source,amountIdr:body.amountIdr,note:text(body.note??'',500)};
}
function accessKey(access){return JSON.stringify([access.user.id,access.isAdmin,access.grants.filter(g=>g.permission_key==='work.marketing').map(g=>[g.scope_type,g.course_id]).sort()]);}
async function verifyOwner(client,access,id,courseId){
  if(!id)return;
  const person=(await client.query('SELECT id,email FROM users WHERE id=$1',[id])).rows[0];
  if(!person||person.email.endsWith('@dihapus.invalid')||!allowed(await accessFor(person,client),'work.marketing',courseId))throw fail(400,'crm_experiment_owner_scope');
}
async function mutate(req,ids,fn){
  return withTransaction(async client=>{
    const people=[...new Set([req.access.user.id,...ids.filter(Boolean)])].sort();
    const rows=(await client.query('SELECT id,email FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[people])).rows;
    if(rows.length!==people.length||rows.some(u=>u.email.endsWith('@dihapus.invalid')))throw fail(400,'crm_active_user_required');
    const access=await requestAccess(req,client);return fn(client,access);
  });
}
router.get('/',asyncHandler(async(req,res)=>{
  if(Object.keys(req.query).some(k=>!['courseId','week'].includes(k))||Object.values(req.query).some(v=>typeof v!=='string'))throw fail(400,'crm_invalid_filter');
  const courseId=course(req.access,req.query.courseId),start=week(req.query.week);
  const end=new Date(Date.parse(start+'T00:00:00Z')+7*86400000).toISOString();
  const result=await withTransaction(async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const params=[],condition=scoped(req.access,courseId,params),scopeParams=[...params],startParam=params.push(start),endParam=params.push(end);
    const cohort=`${condition} AND l.created_at >= $${startParam} AND l.created_at < $${endParam}`;
    const paid=paymentJoin;
    const summary=(await client.query(`SELECT count(*) FILTER(WHERE ${cohort})::int AS leads,
      count(*) FILTER(WHERE ${cohort} AND l.qualification_note<>'')::int AS qualified,
      count(*) FILTER(WHERE ${cohort} AND (l.stage IN ('consulting','offered','won') OR EXISTS(SELECT 1 FROM marketing_lead_events event WHERE event.lead_id=l.id AND event.stage IN ('consulting','offered','won'))))::int AS consulted,
      count(*) FILTER(WHERE ${cohort} AND l.offered_price IS NOT NULL)::int AS offered,
      count(*) FILTER(WHERE ${cohort} AND payment.id IS NOT NULL)::int AS cohort_paid,
      count(*) FILTER(WHERE ${cohort} AND l.qualification_note<>'' AND payment.id IS NOT NULL)::int AS qualified_paid,
      count(*) FILTER(WHERE l.interviewed_at >= $${startParam} AND l.interviewed_at < $${endParam})::int AS interviews,
      count(*) FILTER(WHERE ${cohort} AND l.stage='won' AND payment.id IS NULL)::int AS unverified_deals,
      count(*) FILTER(WHERE payment.approved_at >= $${startParam} AND payment.approved_at < $${endParam})::int AS period_paid,
      COALESCE(sum(payment.amount_idr) FILTER(WHERE payment.approved_at >= $${startParam} AND payment.approved_at < $${endParam}),0)::text AS period_revenue_idr
      FROM marketing_leads l ${paid} WHERE ${condition}`,[...scopeParams,start,end])).rows[0];
    const group=async(column,extra='')=>(await client.query(`SELECT ${column} AS label,count(*)::int AS leads,
      count(*) FILTER(WHERE l.qualification_note<>'')::int AS qualified,
      count(*) FILTER(WHERE payment.id IS NOT NULL)::int AS paid
      FROM marketing_leads l ${paid} WHERE ${cohort} ${extra} GROUP BY 1 ORDER BY leads DESC,label LIMIT 20`,params)).rows;
    const sources=await group('l.source');
    const angles=await group("COALESCE(NULLIF(l.offer_angle,''),'unrecorded')");
    const backgrounds=await group("COALESCE(NULLIF(l.background,''),'unrecorded')");
    const problems=await group("COALESCE(NULLIF(l.primary_problem,''),'unrecorded')");
    const priceReactions=await group("COALESCE(NULLIF(l.price_reaction,''),'unrecorded')");
    const referrers=(await client.query(`SELECT l.referrer_name AS label,count(*)::int AS leads,count(*) FILTER(WHERE payment.id IS NOT NULL)::int AS paid FROM marketing_leads l ${paid} WHERE ${cohort} AND l.source='referral' AND l.referrer_name<>'' GROUP BY l.referrer_name ORDER BY leads DESC,label LIMIT 20`,params)).rows;
    const objections=(await client.query(`SELECT l.objection AS label,count(*)::int AS leads FROM marketing_leads l WHERE ${cohort} AND l.objection<>'' GROUP BY l.objection ORDER BY leads DESC,label LIMIT 10`,params)).rows;
    const customerWords=(await client.query(`SELECT l.customer_words AS quote FROM marketing_leads l WHERE ${cohort} AND l.customer_words<>'' ORDER BY l.interviewed_at DESC NULLS LAST,l.id LIMIT 10`,params)).rows.map(r=>r.quote);
    const review=(await client.query('SELECT * FROM marketing_growth_reviews WHERE course_id IS NOT DISTINCT FROM $1 AND week_start=$2',[courseId,start])).rows[0]||null;
    const spend=(await client.query('SELECT id,source,amount_idr,note,version FROM marketing_channel_spend WHERE course_id IS NOT DISTINCT FROM $1 AND week_start=$2 ORDER BY source',[courseId,start])).rows;
    return {window:{start,end},summary,sources,angles,backgrounds,problems,priceReactions,referrers,objections,customerWords,review,spend};
  });
  const current=await requestAccess(req);if(accessKey(current)!==accessKey(req.access))throw fail(403,'crm_access_changed');
  res.json(result);
}));
router.put('/review',asyncHandler(async(req,res)=>{
  const courseId=course(req.access,req.body?.courseId),start=week(req.body?.week),expected=req.body.version===0?0:version(req.body?.version),d=reviewInput(req.body);
  const result=await mutate(req,[d.experimentOwner],async(client,access)=>{
    course(access,courseId);await verifyOwner(client,access,d.experimentOwner,courseId);
    const current=(await client.query('SELECT * FROM marketing_growth_reviews WHERE course_id IS NOT DISTINCT FROM $1 AND week_start=$2 FOR UPDATE',[courseId,start])).rows[0];
    if((current?.version||0)!==expected)throw fail(409,'crm_version_conflict');
    const vals=[courseId,start,d.segmentDecision,d.buyerLanguage,d.topObjection,d.decision,d.experimentVariable,d.experimentAngle,d.experimentHypothesis,d.successMetric,d.experimentOwner,d.experimentResult,d.status];
    let row;
    if(!current)row=(await client.query(`INSERT INTO marketing_growth_reviews(course_id,week_start,segment_decision,buyer_language,top_objection,decision,experiment_variable,experiment_angle,experiment_hypothesis,success_metric,experiment_owner,experiment_result,status,created_by)
      VALUES(${Array.from({length:14},(_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,[...vals,access.user.id])).rows[0];
    else row=(await client.query(`UPDATE marketing_growth_reviews SET segment_decision=$1,buyer_language=$2,top_objection=$3,decision=$4,experiment_variable=$5,experiment_angle=$6,experiment_hypothesis=$7,success_metric=$8,experiment_owner=$9,experiment_result=$10,status=$11,version=version+1,updated_at=NOW() WHERE id=$12 RETURNING *`,[...vals.slice(2),current.id])).rows[0];
    return row;
  });res.json({review:result});
}));
router.put('/spend',asyncHandler(async(req,res)=>{
  const courseId=course(req.access,req.body?.courseId),start=week(req.body?.week),expected=req.body.version===0?0:version(req.body?.version),d=spendInput(req.body);
  const item=await mutate(req,[],async(client,access)=>{
    course(access,courseId);
    const current=(await client.query('SELECT * FROM marketing_channel_spend WHERE course_id IS NOT DISTINCT FROM $1 AND week_start=$2 AND source=$3 FOR UPDATE',[courseId,start,d.source])).rows[0];
    if((current?.version||0)!==expected)throw fail(409,'crm_version_conflict');
    if(!current)return (await client.query('INSERT INTO marketing_channel_spend(course_id,week_start,source,amount_idr,note,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[courseId,start,d.source,d.amountIdr,d.note,access.user.id])).rows[0];
    return (await client.query('UPDATE marketing_channel_spend SET amount_idr=$2,note=$3,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[current.id,d.amountIdr,d.note])).rows[0];
  });res.json({spend:item});
}));
export default router;
