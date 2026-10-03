import {make,types} from './index.mjs';
import makeN5 from './n5.mjs';
import makeN4 from './n4.mjs';
import * as n5 from './n5-rotation.mjs';
import * as n4 from './n4-rotation.mjs';
import {FINAL_EXAMS} from '../../src/final-exam-policy.js';
import {assertChapterForm} from '../../src/chapter-assessment.js';

// Select authored items before building IDs/choices. Related text-grammar
// questions are authored as whole passages; never randomly sample their blanks.
function collect(author) {
 const rows=[];
 const helper=Object.fromEntries(['q','reading','listening','star','text'].map(method=>[method,(...args)=>rows.push({method,args,type:({star:'sentence_composition',text:'text_grammar'})[method]||args[0]})]));
 author(helper);return rows;
}
function build(level,legacy,extra) {
 const version=`jlpt-final-${level}-v2`, spec=FINAL_EXAMS[version];
 const old=collect(legacy), vocabulary=collect(extra.vocabulary);
 const forms=['A','B'].map(form=>{
  const alternate=collect(h=>{(form==='A'?extra.textA:extra.textB)(h);if(form==='B'){extra.readingB(h);extra.listeningB(h);}});
  const selected=[];
  for(const [type,count] of Object.entries(spec.items)) {
   const existing=old.filter(q=>q.type===type), fresh=alternate.filter(q=>q.type===type), newWords=vocabulary.filter(q=>q.type===type);
   let items;
   if(fresh.length)items=fresh;
   else if(form==='B'&&newWords.length)items=[...existing.slice(-(count-1)),newWords.at(-1)];
   else if(existing.length<count)items=[...existing,...newWords.slice(0,count-existing.length)];
   else items=form==='A'?existing.slice(0,count):existing.slice(-count);
   if(items.length!==count)throw Error(`${version}/${form}/${type}: ${items.length} != ${count}`);
   selected.push(...items);
  }
  return make(level,h=>selected.forEach(q=>h[q.method](...q.args)),{version,form,keyPrefix:`${level}-${form.toLowerCase()}`});
 });
 const bank={...forms[0],rows:forms.flatMap(b=>b.rows),policy:{...forms[0].policy,selection:'alternating',forms:['A','B'],
  reference:'https://www.jlpt.jp/e/topics/202009091599642827.html',itemCounts:spec.items},
  content:`Ujian akhir ${level.toUpperCase()}: ${spec.questionsPerForm} soal orisinal per paket. Komposisi mengikuti perkiraan jumlah soal JLPT sejak Desember 2020; jumlah resmi dapat sedikit berbeda pada tiap pelaksanaan. Ada dua paket (A/B) yang bergantian setiap ujian baru. Sebagian soal dasar dapat sama; paket yang dilanjutkan tetap sama. Lulus kelas: total 70% dan setiap kategori 50%. Nilai berupa persentase EzNihongo, bukan skala resmi JLPT. Audio dapat diulang; tidak ada batas waktu otomatis. Pembahasan dan transkrip tampil setelah submit.`};
 validateRotationBank(bank);return bank;
}
export function validateRotationBank(bank) {
 const spec=FINAL_EXAMS[bank.version];
 if(!spec?.items||bank.rows.length!==spec.questionsPerForm*2||new Set(bank.rows.map(q=>q.id)).size!==bank.rows.length)throw Error('Rotation identity/count');
 for(const form of ['A','B']) {
  const rows=bank.rows.filter(q=>q.assessment_meta.form===form);
  assertChapterForm(bank.policy,rows);
  for(const q of rows) {
   const meta=q.assessment_meta;
   if(types[meta.itemType]?.[0]!==q.question_category||!q.explanation||!meta.curriculumChapters?.length)throw Error('Incomplete item '+meta.key);
   if(q.audio_script&&!q.audio_script.split('\n').every(line=>/^[NAB]: .+/.test(line)))throw Error('Audio '+meta.key);
   if(meta.spokenChoices?.some((choice,i)=>!q.audio_script.includes(`${['いちばん','にばん','さんばん'][i]}。\nB: ${choice}`)))throw Error('Spoken choices '+meta.key);
   if(meta.ordered&&(q.options.find(o=>o.is_correct).option_text!==meta.ordered[meta.starPosition]||(q.question.match(/★/g)||[]).length!==1))throw Error('Star '+meta.key);
   if(meta.itemType==='text_grammar') {
    const blanks=q.passage.match(/[①②③④⑤]/g)||[];
    const companions=rows.filter(r=>r.assessment_meta.itemType==='text_grammar'&&r.passage===q.passage);
    if(blanks.length!==companions.length||new Set(blanks).size!==blanks.length||blanks.some(blank=>!companions.some(r=>r.question===`${blank}に何を入れますか。`)))throw Error('Incomplete passage '+meta.key);
   }
  }
 }
 return bank;
}
export const rotationBanks=[build('n5',makeN5,n5),build('n4',makeN4,n4)];
