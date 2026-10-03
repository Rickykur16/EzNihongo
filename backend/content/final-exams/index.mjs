import {createHash} from 'node:crypto';
import makeN5 from './n5.mjs';
import makeN4 from './n4.mjs';
import {FINAL_EXAMS,finalExamRules} from '../../src/final-exam-policy.js';

export const types={
 kanji_reading:['vocabulary','漢字の読み方','【　】のことばの読み方をえらんでください。'],
 orthography:['vocabulary','表記','【　】のことばを漢字でどう書きますか。'],
 context_vocabulary:['vocabulary','文脈規定','（　）に入ることばをえらんでください。'],
 paraphrase:['vocabulary','言い換え','いちばん近い意味の文をえらんでください。'],
 usage:['vocabulary','用法','ことばの使い方が正しい文をえらんでください。'],
 grammar_form:['grammar','文の文法','（　）に入るものをえらんでください。'],
 sentence_composition:['grammar','文の組み立て','四つのことばを並べて、★に入るものをえらんでください。'],
 text_grammar:['grammar','文章の文法','文章を読んで、番号のところに入るものをえらんでください。'],
 short_reading:['reading','短文理解','文章を読んで、質問に答えてください。'],
 medium_reading:['reading','中文理解','文章を読んで、質問に答えてください。'],
 information_retrieval:['reading','情報検索','お知らせを読んで、必要な情報をえらんでください。'],
 task_comprehension:['listening','課題理解','音声を聞いて、することをえらんでください。'],
 key_points:['listening','ポイント理解','音声を聞いて、質問に答えてください。'],
 verbal_expression:['listening','発話表現','場面を見て、音声を聞いてください。いちばんいいことばをえらんでください。'],
 quick_response:['listening','即時応答','音声を聞いて、いちばんいい返事をえらんでください。'],
};
export const uid=key=>{const b=createHash('sha256').update('eznihongo-final:'+key).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const x=b.toString('hex');return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;};
const categoryNames={vocabulary:'Aksara dan kosakata',grammar:'Tata bahasa',reading:'Membaca',listening:'Menyimak'};
export function make(level,author,{version=`jlpt-final-${level}-v1`,form='A',keyPrefix=level}={}){
 const rows=[];
 const add=(itemType,prompt,options,explanation,chapters,extra={})=>{
  const number=rows.length+1,key=`${keyPrefix}-${String(number).padStart(3,'0')}`;
  const original=Array.isArray(options)?options:options.split('|');
  const offset=createHash('sha256').update(version+':position:'+key).digest().readUInt32BE(0)%original.length;
  const choices=original.slice(offset).concat(original.slice(0,offset));
  const spoken=['verbal_expression','quick_response'].includes(itemType);
  const [category,label,instruction]=types[itemType];
  let script=extra.audio_script||null;
  if(script && !spoken) script=`N: ${prompt}\n${script}\nN: ${prompt}`;
  if(spoken) script+='\n'+choices.map((s,i)=>`N: ${['いちばん','にばん','さんばん'][i]}。\nB: ${s}`).join('\n');
  const row={id:uid(version+':'+key),question:prompt,question_type:'multiple_choice',question_category:category,
   section_number:Object.keys(types).indexOf(itemType)+1,section_label:label,section_instruction:instruction,
   passage:extra.passage||null,audio_script:script,image_url:extra.scene?`/assets/final-exams/${extra.scene}.svg`:null,
   explanation:spoken?`${explanation} Jawaban audio: “${original[0]}”.`:explanation,sort_order:number,assessment_meta:{version,form,key,objective:category,itemType,
    source:'eznihongo-original',curriculumChapters:chapters,
    ...(extra.ordered?{ordered:extra.ordered,starPosition:extra.starPosition}:{}),
    ...(spoken?{spokenChoices:choices}:{}),
    distractorReasons:choices.map((o,i)=>original[0]===o?explanation:`Pilihan “${o}” tidak memenuhi petunjuk pada konteks. ${explanation}`)},
   options:choices.map((o,i)=>({id:uid(version+':'+key+':o'+i),option_text:spoken?`${i+1}ばん`:o,is_correct:o===original[0],sort_order:i+1}))};
  rows.push(row);
 };
 author({q:add,
  reading:(type,passage,p,o,e,c)=>add(type,p,o,e,c,{passage}),
  listening:(type,audio_script,p,o,e,c,scene)=>add(type,p,o,e,c,{audio_script,scene}),
  star:(p,ordered,pos,e,c)=>add('sentence_composition',p,[ordered[pos],...ordered.filter((_,i)=>i!==pos)],e,c,{ordered,starPosition:pos}),
  text:(passage,n,o,e,c)=>add('text_grammar',`${n}に何を入れますか。`,o,e,c,{passage}),
 });
 const rules=finalExamRules({version});
 return {schemaVersion:1,level,version,title:`Final Exam ${level.toUpperCase()}`,moduleId:uid(level+':module'),lessonId:uid(level+':lesson'),
  moduleSlug:`${level}-final-exam`,lessonSlug:`final-exam-${level}`,
  policy:{version,selection:'all',...rules,objectives:Object.entries(categoryNames).map(([id,canDo])=>({id,canDo})),
   level,scoreScale:'raw_percentage',timerMode:'untimed',audioReplay:true,
   provenance:'Original EzNihongo assessment; task types referenced from JLPT, no official questions or recordings reproduced.'},
  content:`Ujian akhir ${level.toUpperCase()}: ${rules.questionsPerForm} soal orisinal mencakup aksara/kosakata, tata bahasa, membaca, dan listening. Kerjakan setelah menyelesaikan materi level. Lulus kelas: total 70% dan setiap kategori 50%. Nilai berupa persentase, bukan skala resmi JLPT. Jawaban tersimpan dan bisa dilanjutkan. Audio dapat diulang; tidak ada batas waktu otomatis. Pembahasan dan transkrip tampil setelah submit.`,
  rows};
}
export const banks=[make('n5',makeN5),make('n4',makeN4)];
export function validateFinalBank(bank){
 const spec=FINAL_EXAMS[bank.version];
 if(!spec||bank.rows.length!==spec.questionsPerForm)throw Error('Final count '+bank.level+': '+bank.rows.length);
 for(const [cat,n]of Object.entries(spec.blueprint))if(bank.rows.filter(q=>q.question_category===cat).length!==n)throw Error('Blueprint '+bank.level+'/'+cat);
 for(const q of bank.rows){
  const a=q.assessment_meta,options=q.options,spoken=!!a.spokenChoices;
  if(!q.question.trim()||!q.explanation.trim()||!a.curriculumChapters.length||!a.curriculumChapters.every(c=>Number.isInteger(c)&&c>=1&&c<=(bank.level==='n5'?20:24)))throw Error('Incomplete '+a.key);
  if(options.length!==(spoken?3:4)||new Set(options.map(o=>o.option_text)).size!==options.length||options.filter(o=>o.is_correct).length!==1)throw Error('Choices '+a.key);
  if(q.question_category==='reading'&&!q.passage)throw Error('Passage '+a.key);
  if(q.question_category==='listening'&&(!q.audio_script||!q.audio_script.split('\n').every(l=>/^[NAB]: .+/.test(l))))throw Error('Audio '+a.key);
  if(spoken&&a.spokenChoices.some((s,i)=>!q.audio_script.includes(`${['いちばん','にばん','さんばん'][i]}。\nB: ${s}`)))throw Error('Spoken '+a.key);
  if(a.ordered&&(options.find(o=>o.is_correct).option_text!==a.ordered[a.starPosition]||(q.question.match(/★/g)||[]).length!==1||(q.question.match(/＿＿/g)||[]).length!==3))throw Error('Star '+a.key);
 }
 return bank.rows;
}
for(const bank of banks)validateFinalBank(bank);
