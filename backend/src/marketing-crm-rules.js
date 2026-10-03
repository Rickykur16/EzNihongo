import {isCanonicalUuid} from './live-class-admin-rules.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});

export const STAGES = ['new','contacted','qualified','consulting','offered','won','lost'];
export const SOURCES = ['referral','instagram','tiktok','whatsapp','website','event','other'];
export const BACKGROUNDS=['','ex_intern_hospitality','ex_intern_other','fresh_graduate','worker','other'];
export const PROBLEMS=['','cost','language','jobs','time','trust','other'];
export const ANGLES=['','cost','career','convenience','other'];
export const PRICE_REACTIONS=['','cheap','reasonable','somewhat_expensive','expensive','not_relevant'];
const mapping = {courseId:'course_id',fullName:'full_name',phone:'phone',email:'email',source:'source',sourceDetail:'source_detail',goal:'goal',stage:'stage',offeredPrice:'offered_price',lostReason:'lost_reason',assignedTo:'assigned_to',nextFollowUp:'next_follow_up',referrerName:'referrer_name',background:'background',categoryInterest:'category_interest',primaryProblem:'primary_problem',targetTimeline:'target_timeline',qualificationNote:'qualification_note',alternative:'alternative',offerAngle:'offer_angle',priceReaction:'price_reaction',willingnessToPay:'willingness_to_pay',objection:'objection',customerWords:'customer_words',decisionReason:'decision_reason',nextAction:'next_action',interviewedAt:'interviewed_at'};
export function uuid(value,required=false) {
  if ((value===null||value===undefined||value==='')&&!required) return null;
  if (!isCanonicalUuid(value)) throw fail(400,'crm_invalid_id');
  return value;
}
export function text(value,max,required=false) {
  if (typeof value!=='string'||value.trim().length>max||(required&&!value.trim())) throw fail(400,'crm_invalid_text');
  return value.trim();
}
export function version(value) {if(!Number.isSafeInteger(value)||value<1)throw fail(400,'crm_invalid_version');return value;}
export function parseLead(body,old=null) {
  if (!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!Object.hasOwn(mapping,k)&&!['id','version'].includes(k))) throw fail(400,'crm_invalid_fields');
  const defaults={courseId:null,fullName:'',phone:'',email:'',source:'other',sourceDetail:'',goal:'',stage:'new',offeredPrice:null,lostReason:'',assignedTo:null,nextFollowUp:null,referrerName:'',background:'',categoryInterest:'',primaryProblem:'',targetTimeline:'',qualificationNote:'',alternative:'',offerAngle:'',priceReaction:'',willingnessToPay:null,objection:'',customerWords:'',decisionReason:'',nextAction:'',interviewedAt:null};
  const d=Object.fromEntries(Object.entries(mapping).map(([k,col])=>[k,body[k]!==undefined?body[k]:old?old[col]:defaults[k]]));
  if(old&&body.offeredPrice===undefined&&d.offeredPrice!==null)d.offeredPrice=Number(d.offeredPrice);
  if(old&&body.willingnessToPay===undefined&&d.willingnessToPay!==null)d.willingnessToPay=Number(d.willingnessToPay);
  if(old&&body.nextFollowUp===undefined&&d.nextFollowUp instanceof Date)d.nextFollowUp=d.nextFollowUp.toISOString();
  if(old&&body.interviewedAt===undefined&&d.interviewedAt instanceof Date)d.interviewedAt=d.interviewedAt.toISOString();
  d.courseId=uuid(d.courseId);d.assignedTo=uuid(d.assignedTo);
  for(const [key,max,required]of [['fullName',160,true],['phone',40],['email',254],['sourceDetail',240],['goal',2000],['lostReason',1000],['referrerName',160],['categoryInterest',160],['targetTimeline',160],['qualificationNote',1000],['alternative',500],['objection',1000],['customerWords',1500],['decisionReason',1000],['nextAction',500]])d[key]=text(d[key],max,required);
  if(d.phone){
    if(!/^\+?[\d\s().-]+$/.test(d.phone))throw fail(400,'crm_invalid_phone');
    d.phone=d.phone.replace(/[^\d]/g,'');
    if(d.phone.startsWith('0'))d.phone='62'+d.phone.slice(1);
    if(!/^[1-9]\d{7,14}$/.test(d.phone))throw fail(400,'crm_invalid_phone');
    d.phone='+'+d.phone;
  }
  d.email=d.email.toLowerCase();
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))throw fail(400,'crm_invalid_email');
  if(!d.phone&&!d.email)throw fail(400,'crm_contact_required');
  if(!STAGES.includes(d.stage)||!SOURCES.includes(d.source)||!BACKGROUNDS.includes(d.background)||!PROBLEMS.includes(d.primaryProblem)||!ANGLES.includes(d.offerAngle)||!PRICE_REACTIONS.includes(d.priceReaction))throw fail(400,'crm_invalid_choice');
  if(d.source==='referral'&&!d.referrerName)d.referrerName=d.sourceDetail;
  for(const key of ['offeredPrice','willingnessToPay'])if(d[key]!==null&&(!Number.isSafeInteger(d[key])||d[key]<0||d[key]>1e12))throw fail(400,'crm_invalid_price');
  for(const key of ['nextFollowUp','interviewedAt'])if(d[key]!==null){
    if(typeof d[key]!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(d[key])||!Number.isFinite(Date.parse(d[key])))throw fail(400,'crm_invalid_date');
    d[key]=new Date(d[key]).toISOString();
  }
  if(['qualified','consulting','offered','won'].includes(d.stage)&&(!old||['new','contacted','lost'].includes(old.stage))&&!d.qualificationNote)throw fail(400,'crm_qualification_required');
  if(d.stage==='lost'&&!d.lostReason)throw fail(400,'crm_lost_reason_required');
  if(d.stage!=='lost')d.lostReason='';
  if(['won','lost'].includes(d.stage))d.nextFollowUp=null;
  return d;
}
