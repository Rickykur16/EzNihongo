import {createHash} from 'node:crypto';
import {plans as expanded} from './index.mjs';
import early,{objectiveEvidenceKeys as earlyEvidence} from './review-early.mjs';
import middle,{objectiveEvidenceKeys as middleEvidence} from './review-middle.mjs';
import late,{objectiveEvidenceKeys as lateEvidence} from './review-late.mjs';
import visual from './review-visual.mjs';
import {stableId} from '../../../scripts/build-chapter-assessments.mjs';
import {REVIEWED_N5_ASSESSMENT_VERSION as version,assertChapterForm} from '../../../src/chapter-assessment.js';

const patches={...early,...middle,...late,...visual};
const evidence=new Set([...earlyEvidence,...middleEvidence,...lateEvidence]);
const rotate=(a,n)=>a.slice(n).concat(a.slice(0,n));
export function reviewedOptionId(id){
 const h=createHash('md5').update(`${id}:${version}`).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const alias={audioScript:'audio_script',imageUrl:'image_url',prompt:'question'};
const validFields=new Set(['question','passage','audio_script','image_url','explanation','section_number','section_label','section_instruction']);
const seen=new Set();
export const plans=expanded.map(p=>{
 const rows=p.rows.map((source,index)=>{
  const key=source.assessment_meta.key,patch=patches[key]||{},fields={};
  seen.add(key);
  for(const [name,value] of Object.entries(patch))if(validFields.has(alias[name]||name))fields[alias[name]||name]=value;
  const id=stableId(`${version}:${source.id}`),meta={...source.assessment_meta,...patch.assessment_meta,version,key:`${key}-reviewed`,objectiveEvidence:evidence.has(key)};
  let options=source.options.map(o=>({...o,id:reviewedOptionId(o.id)}));
  if(patch.options){
   if(patch.reasons?.length!==patch.options.length||patch.reasons.some(r=>!r?.trim())||new Set(patch.options.map(o=>o.normalize('NFKC').trim())).size!==patch.options.length)throw Error(`Invalid revision choices ${key}`);
   const n=(p.chapter+index)%patch.options.length,choices=rotate(patch.options,n),reasons=rotate(patch.reasons,n),correct=(patch.options.length-n)%patch.options.length;
   const spoken=['quick_response','verbal_expression'].includes(meta.itemType);
   meta.distractorReasons=reasons;
   if(spoken){
    meta.spokenChoices=choices;
    const script=(fields.audio_script??source.audio_script).split('\nN: いちばん。')[0];
    fields.audio_script=script+'\n'+choices.map((c,i)=>`N: ${['いちばん','にばん','さんばん'][i]}。\n${(fields.image_url??source.image_url)?'A':'B'}: ${c}`).join('\n');
   }
   options=choices.map((text,i)=>({id:stableId(`${version}:${key}:option:${i}`),option_text:spoken?`${i+1}ばん`:text,is_correct:i===correct,sort_order:i+1}));
  }
  const image=fields.image_url??source.image_url;
  if(meta.itemType==='verbal_expression'&&image==='/assets/assessments/speakers-ab.svg'){
   fields.section_label='ばめんに あう ことば';
   const jp='えは Aさんと Bさんを あらわします。ばめんと こたえは こえで ききます。Aさんの ことばを えらんで ください。';
   const help='Gambar menunjukkan tokoh A dan B. Dengarkan situasi dan tiga ucapan; pilih ucapan A.';
   fields.section_instruction=p.chapter<=9?`${jp}\n${help}`:p.chapter<=14?`${jp}<details><summary>Petunjuk</summary>${help}</details>`:jp;
  }
  const {sourceId:unused,...base}=source;
  const row={...structuredClone(base),...fields,id,assessment_meta:meta,options,sourceId:source.id};
  const metaPatch={version,key:meta.key,objectiveEvidence:meta.objectiveEvidence,...patch.assessment_meta};
  if(patch.options){metaPatch.distractorReasons=meta.distractorReasons;if(meta.spokenChoices)metaPatch.spokenChoices=meta.spokenChoices;}
  // Each changed field is guarded against the published source. Other live
  // fields, teacher notes, option images and voices are copied by migration.
  row.revision={fields,meta:metaPatch,expected:Object.fromEntries(Object.keys(fields).map(k=>[k,source[k]??null])),...(patch.options?{options,expectedOptions:source.options.map(o=>({id:o.id,option_text:o.option_text,is_correct:o.is_correct,sort_order:o.sort_order,image_url:o.image_url??null}))}:{} )};
  return row;
 });
 const policy={...p.policy,version};
 return {chapter:p.chapter,expectedVersion:p.policy.version,policy,sourceRows:p.rows,rows};
});
for(const key of [...Object.keys(patches),...evidence])if(!seen.has(key))throw Error(`Unknown review key ${key}`);
export function validateReviewedPlans(){
 for(const p of plans)for(const form of p.chapter===3?['A','B']:['A'])assertChapterForm(p.policy,p.rows.filter(q=>q.assessment_meta.form===form));
 return plans;
}
export const editorialRevisionCount=Object.keys(patches).length;
