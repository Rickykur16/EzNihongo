import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import foundation from './b03.mjs';
import early from './b04-09.mjs';
import middle from './b10-14.mjs';
import late from './b15-20.mjs';
import foundationExtra from './extra-b03.mjs';
import earlyExtra from './extra-b04-09.mjs';
import middleExtra from './extra-b10-14.mjs';
import lateExtra from './extra-b15-20.mjs';
import {banks as published,bankRows as publishedRows} from '../support/n5-04-20.mjs';
import {bankRows as foundationRows,stableId} from '../../../scripts/build-chapter-assessments.mjs';
import {EXPANDED_N5_ASSESSMENT_VERSION as version,EXPANDED_CHAPTER_POLICY,assertChapterForm} from '../../../src/chapter-assessment.js';

const bab3=JSON.parse(await readFile(new URL('../n5-b03.json',import.meta.url),'utf8'));
const authored={...early,...middle,...late};
const extras={...earlyExtra,...middleExtra,...lateExtra};
const types={
 kanji_reading:[1,'漢字の よみかた','ことばの よみかたを えらんで ください。','Pilih bacaan kata bergaris bawah.'],
 orthography:[2,'ことばの かきかた','ことばの かきかたを えらんで ください。','Pilih penulisan kata bergaris bawah.'],
 context_vocabulary:[3,'ことばと ぶん','（　）に あう ことばを えらんで ください。','Pilih kata sesuai konteks.'],
 paraphrase:[4,'おなじ いみ','おなじ いみの ぶんを えらんで ください。','Pilih ungkapan bermakna setara.'],
 grammar_form:[5,'ぶんぽう','（　）に あう ものを えらんで ください。','Pilih bentuk atau kalimat sesuai konteks.'],
 sentence_composition:[6,'ぶんの じゅんばん','４つの ことばを ならべて、★ の ことばを えらんで ください。','Susun empat potongan; pilih potongan pada ★.'],
 text_grammar:[7,'ぶんしょうの ぶんぽう','ぶんしょうを よんで、①に あう ものを えらんで ください。','Baca seluruh teks sebelum mengisi ①.'],
 short_reading:[8,'みじかい ぶんしょう','ぶんしょうを よんで、こたえて ください。','Baca teks, lalu pilih jawabannya.'],
 information_retrieval:[10,'おしらせ・ひょう','ひょうを みて、こたえて ください。','Cari informasi yang diminta pada daftar atau tabel.'],
 task_comprehension:[11,'きいて すること','こえを きいて、することを えらんで ください。','Dengarkan, lalu pilih tindakan yang perlu dilakukan.'],
 key_points:[12,'きいて わかること','こえを きいて、こたえて ください。','Dengarkan informasi yang diminta.'],
 verbal_expression:[13,'えを みて はなす','えと こえから、Aさんの ことばを えらんで ください。こたえも こえで ききます。','Perhatikan tokoh A dan situasi dalam audio. Pilih ucapan A; tiga pilihan dibacakan.'],
 quick_response:[14,'すぐに こたえる','こえを きいて、へんじを えらんで ください。こたえも こえで ききます。','Dengarkan ujaran dan tiga respons; pilih respons yang sesuai.'],
};
const categoryCounts={vocabulary:5,listening:9};
const rotate=(a,n)=>a.slice(n).concat(a.slice(0,n));
export function cloneOptionId(id){
 const hex=createHash('md5').update(`${id}:${version}`).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function compileAdditions(chapter,form,sections){
 if(JSON.stringify(Object.keys(sections))!==JSON.stringify(Object.keys(categoryCounts)))throw Error(`Incomplete sections ${chapter}/${form}`);
 return Object.entries(sections).flatMap(([category,items],ci)=>{
  if(items.length!==categoryCounts[category])throw Error(`Incorrect additions ${chapter}/${category}`);
  return items.map((raw,i)=>{
   const key=`b${String(chapter).padStart(2,'0')}-${form.toLowerCase()}-expanded-${category}-${i+1}`;
   const type=types[raw.itemType];
   if(!type||!raw.prompt?.trim()||!raw.explanation?.trim()||raw.reasons?.length!==raw.options.length||raw.reasons.some(r=>!r?.trim())||new Set(raw.options.map(s=>s.normalize('NFKC').trim())).size!==raw.options.length)throw Error(`Invalid authored item ${key}`);
   const n=(chapter+ci+i)%raw.options.length,choices=rotate(raw.options,n),reasons=rotate(raw.reasons,n),answer=(raw.options.length-n)%raw.options.length;
   let audio=raw.audioScript||null;
   if(raw.audioOptions)audio+='\n'+choices.map((o,j)=>`N: ${['いちばん','にばん','さんばん'][j]}。\n${raw.imageUrl?'A':'B'}: ${o}`).join('\n');
   if(raw.itemType==='quick_response'&&!raw.audioOptions)throw Error(`Missing private choices ${key}`);
   if(raw.ordered&&(raw.ordered.length!==4||raw.options[0]!==raw.ordered[raw.position]||new Set(raw.ordered).size!==4))throw Error(`Invalid star ${key}`);
   const instruction=chapter<=9?`${type[2]}\n${type[3]}`:chapter<=14?`${type[2]}<details><summary>Petunjuk</summary>${type[3]}</details>`:type[2];
   return {id:stableId(`${version}:${key}`),question:raw.prompt,question_type:'multiple_choice',question_category:category,
    section_number:chapter===3?(category==='vocabulary'?1:4):type[0],section_label:type[1],section_instruction:instruction,
    passage:raw.passage||null,audio_script:audio,image_url:raw.imageUrl||null,correct_answer:null,
    explanation:raw.explanation,sort_order:25+ci*9+i,
    assessment_meta:{version,form,key,objective:raw.objective||`goal${raw.goal}`,itemType:raw.itemType,distractorReasons:reasons,
     ...(raw.ordered?{ordered:raw.ordered,starPosition:raw.position}:{}),...(raw.audioOptions?{spokenChoices:choices}:{})},
    options:choices.map((text,j)=>({id:stableId(`${version}:${key}:o${j}`),option_text:raw.audioOptions?`${j+1}ばん`:text,is_correct:j===answer,sort_order:j+1})),
   };
  });
 });
}

export const plans=[bab3,...published].map(old=>{
 const sourceRows=old.chapter===3?foundationRows(old):publishedRows(old);
 const {forms,...oldPolicy}=old;
 const policy={...oldPolicy,version,...EXPANDED_CHAPTER_POLICY};
 const additions=Object.keys(forms).flatMap(form=>{
  const base=old.chapter===3?foundation[form]:authored[old.chapter],extra=old.chapter===3?foundationExtra[form]:extras[old.chapter];
  return compileAdditions(old.chapter,form,{vocabulary:[...base.vocabulary,...extra.vocabulary],listening:[...base.listening,...extra.listening]});
 });
 // Keep the original bank intact. The new packet omits one grammar-form item
 // and one repeated information-retrieval item to match the smaller JLPT ratio.
 const selected=sourceRows.filter(q=>{
  const formRows=sourceRows.filter(r=>r.assessment_meta.form===q.assessment_meta.form);
  const grammar=formRows.filter(r=>r.question_category==='grammar');
  const reading=formRows.filter(r=>r.question_category==='reading');
  return q.id!==(old.chapter===3?grammar[4]:grammar[5]).id&&q.id!==reading[3].id;
 });
 const clones=selected.map(q=>({...structuredClone(q),id:stableId(`${version}:clone:${q.id}`),
  assessment_meta:{...q.assessment_meta,version,key:`${q.assessment_meta.key}-expanded`},
  options:q.options.map(o=>({...o,id:cloneOptionId(o.id)})),sourceId:q.id}));
 const rows=[...clones,...additions];
 for(const form of Object.keys(forms))assertChapterForm(policy,rows.filter(q=>q.assessment_meta.form===form));
 return {chapter:old.chapter,expectedVersion:old.version,policy,sourceRows,clones,additions,rows};
});

export function validateAdditions(){
 const seen=new Set();
 for(const plan of plans)for(const row of plan.additions){
  // Numbered choices are rotated at compile time; they must not disguise a
  // repeated listening stimulus as a new item.
  const script=row.assessment_meta.spokenChoices?row.audio_script.split('\nN: いちばん。')[0]:row.audio_script;
  const stimulus=[row.question,row.passage||'',script||''].join('|').normalize('NFKC').replace(/\s+/g,' ');
  if(seen.has(stimulus))throw Error(`Repeated stimulus ${row.assessment_meta.key}`);
  seen.add(stimulus);
  if(row.question_category==='reading'&&!row.passage)throw Error('Missing passage');
  if(row.question_category==='listening'&&!row.audio_script)throw Error('Missing script');
  if(plan.chapter>=10&&/[A-Za-z]{3,}/.test([row.question,row.passage,row.audio_script,...row.options.map(o=>o.option_text)].filter(Boolean).join('\n').replace(/<[^>]*>/g,'')))throw Error(`Non-Japanese stimulus ${row.assessment_meta.key}`);
 }
 return plans;
}
validateAdditions();
