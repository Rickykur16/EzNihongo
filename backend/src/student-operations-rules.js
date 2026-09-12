import {isCanonicalUuid} from './live-class-admin-rules.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const CATEGORIES=['onboarding','access','schedule','academic','payment','inactive','other'];
export const STATUSES=['new','handling','waiting_student','waiting_team','resolved'];
export function id(value){if(!isCanonicalUuid(value))throw fail(400,'invalid_id');return value;}
export function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw fail(400,'invalid_text');return value.trim();}
export function choice(value,options){if(!options.includes(value))throw fail(400,'invalid_option');return value;}
export function instant(value){if(value===null||value==='')return null;if(value instanceof Date)value=value.toISOString();if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)||!Number.isFinite(Date.parse(value)))throw fail(400,'invalid_date');return new Date(value).toISOString();}
export function version(value){if(!Number.isInteger(value)||value<0)throw fail(400,'version_required');return value;}
export function keys(body,allowed){if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!allowed.includes(k)))throw fail(400,'invalid_fields');}
export function parseCase(body,current=null){
  keys(body,['userId','courseId','title','category','status','priority','assignedTo','escalatedTo','description','resolution','dueAt','version']);
  if(current&&((body.userId&&body.userId!==current.user_id)||(body.courseId&&body.courseId!==current.course_id)))throw fail(400,'case_student_is_fixed');
  const pick=(key,col=key,fallback='')=>body[key]===undefined?(current?.[col]??fallback):body[key];
  const data={userId:id(current?.user_id||body.userId),courseId:id(current?.course_id||body.courseId),
    title:text(pick('title'),160,true),category:choice(pick('category'),CATEGORIES),
    status:choice(pick('status','status','new'),STATUSES),priority:choice(pick('priority','priority','normal'),['normal','high','urgent']),
    assignedTo:pick('assignedTo','assigned_to',null)?id(pick('assignedTo','assigned_to')):null,
    escalatedTo:choice(pick('escalatedTo','escalated_to'),['','academic','finance','technology']),
    description:text(pick('description'),6000),resolution:text(pick('resolution'),4000),dueAt:instant(pick('dueAt','due_at',null))};
  if(!current&&data.status!=='new')throw fail(400,'new_case_status_required');
  if(data.status==='resolved'&&!data.resolution)throw fail(400,'resolution_required');
  if(data.status==='waiting_team'&&!data.escalatedTo)throw fail(400,'escalation_team_required');
  return data;
}
