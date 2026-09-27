import {banks as previousBanks} from '../source/index.mjs';
import vocabulary from './vocabulary.mjs';
import earlyGrammar from './grammar-early.mjs';
import lateGrammar from './grammar-late.mjs';
import reading from './reading.mjs';
import earlyListening from './listening-early.mjs';
import lateListening from './listening-late.mjs';
import {stableId} from '../../../scripts/build-chapter-assessments.mjs';
import {JLPT_ASSESSMENT_VERSION,CHAPTER_POLICY,assertChapterForm} from '../../../src/chapter-assessment.js';

const types=[
  ['kanji_reading','漢字の よみかた','ことばの よみかたを えらんで ください。','Pilih bacaan kata yang digarisbawahi.'],
  ['orthography','ことばの かきかた','ことばの かきかたを えらんで ください。','Pilih penulisan kata yang digarisbawahi.'],
  ['context_vocabulary','ことばと ぶん','（　）に あう ことばを えらんで ください。','Pilih kata yang sesuai dengan konteks.'],
  ['paraphrase','おなじ いみ','おなじ いみの ぶんを えらんで ください。','Pilih ungkapan yang bermakna setara.'],
  ['grammar_form','ぶんぽう','（　）に あう ものを えらんで ください。','Lengkapi kalimat atau dialog.'],
  ['sentence_composition','ぶんの じゅんばん','４つの ことばを ならべて、★ の ことばを えらんで ください。','Susun keempat potongan; pilih potongan pada posisi ★. Tidak perlu mengetik.'],
  ['text_grammar','ぶんしょうの ぶんぽう','ぶんしょうを よんで、①と②に あう ものを えらんで ください。','Baca keseluruhan teks sebelum mengisi bagian bernomor.'],
  ['short_reading','みじかい ぶんしょう','ぶんしょうを よんで、こたえて ください。','Baca teks, lalu pilih jawabannya.'],
  ['medium_reading','ぶんしょう','ぶんしょうを よんで、こたえて ください。','Gunakan informasi dalam keseluruhan bacaan.'],
  ['information_retrieval','おしらせ・ひょう','ひょうを みて、こたえて ください。','Cari informasi yang diminta pada tabel atau daftar.'],
  ['task_comprehension','きいて すること','こえを きいて、することを えらんで ください。','Dengarkan, lalu pilih tindakan yang perlu dilakukan.'],
  ['key_points','きいて わかること','こえを きいて、こたえて ください。','Dengarkan informasi yang diminta.'],
  ['verbal_expression','えを みて はなす','えと こえから、Aさんの ことばを えらんで ください。こたえも こえで ききます。','Perhatikan tokoh A dan situasi dalam audio. Pilih ucapan A; ketiga pilihan dibacakan.'],
  ['quick_response','すぐに こたえる','こえを きいて、へんじを えらんで ください。こたえも こえで ききます。','Dengarkan ujaran dan tiga respons, lalu pilih respons yang sesuai.'],
];
const slotTypes=[0,0,1,2,2,3,4,4,4,4,4,4,5,5,6,6,7,8,9,9,10,11,12,13];
export const banks=previousBanks.map(previous=>{
  const chapter=previous.chapter;
  const sections=[vocabulary[chapter],({...earlyGrammar,...lateGrammar})[chapter],reading[chapter],({...earlyListening,...lateListening})[chapter]];
  if(sections.some((s,i)=>s?.length!==[6,10,4,4][i]))throw Error(`Missing authored rows in Bab ${chapter}`);
  const items=sections.flat().map((raw,i)=>{
    const category=i<6?'vocabulary':i<16?'grammar':i<20?'reading':'listening';
    const type=types[slotTypes[i]];
    const offset=(i+chapter)%raw.options.length;
    const options=[...raw.options.slice(offset),...raw.options.slice(0,offset)];
    const answer=(raw.options.length-offset)%raw.options.length;
    let audioScript=raw.audioScript;
    if(raw.audioOptions) audioScript+='\n'+options.map((option,j)=>`N: ${['いちばん','にばん','さんばん'][j]}。\n${raw.imageUrl?'A':'B'}: ${option}`).join('\n');
    const earlyKey=chapter<9&&i===20;
    const [itemType,label,instruction,help]=earlyKey?types[11]:type;
    return {id:`b${String(chapter).padStart(2,'0')}-a-jlpt-${i+1}`,category,itemType,
      prompt:raw.prompt,options:raw.audioOptions?['1ばん','2ばん','3ばん']:options,answer,
      explanation:raw.explanation+(raw.audioOptions?` Jawaban: ${options[answer]}`:''),
      objective:`goal${raw.goal}`,sectionNumber:slotTypes[i]+1,sectionLabel:label,
      sectionInstruction:chapter<=9?`${instruction}\n${help}`:chapter<=14?`${instruction}<details><summary>Petunjuk</summary>${help}</details>`:instruction,
      distractorReasons:options.map((o,j)=>j===answer?raw.explanation:`“${o}” tidak sesuai konteks. ${raw.explanation}`),
      ...(raw.passage?{passage:raw.passage}:{}),...(audioScript?{audioScript}:{}),
      ...(raw.imageUrl?{imageUrl:`/assets/assessments/b${chapter}.svg`}:{}),
      ...(raw.ordered?{ordered:raw.ordered,starPosition:raw.position}:{}),
      ...(raw.audioOptions?{spokenChoices:options}:{}),
    };
  });
  return {...structuredClone(previous),version:JLPT_ASSESSMENT_VERSION,format:'jlpt-n5',
    boundary:{...previous.boundary,notes:'Format N5 bertahap; isi Jepang mulai Bab 10, petunjuk Jepang penuh Bab 15. Materi kumulatif sampai bab ini. Pembahasan Indonesia sesudah submit.'},
    ...CHAPTER_POLICY,forms:{A:items}};
});

export function bankRows(bank){
  return bank.forms.A.map((item,i)=>({
    id:stableId(item.id),question:item.prompt,question_type:'multiple_choice',question_category:item.category,
    section_number:item.sectionNumber,section_label:item.sectionLabel,section_instruction:item.sectionInstruction,
    passage:item.passage||null,audio_script:item.audioScript||null,image_url:item.imageUrl||null,
    explanation:item.explanation,sort_order:i+1,
    assessment_meta:{version:bank.version,form:'A',key:item.id,objective:item.objective,itemType:item.itemType,
      distractorReasons:item.distractorReasons,...(item.ordered?{ordered:item.ordered,starPosition:item.starPosition}:{}),
      ...(item.spokenChoices?{spokenChoices:item.spokenChoices}:{})},
    options:item.options.map((option,j)=>({id:stableId(`${item.id}:o${j}`),option_text:option,is_correct:j===item.answer,sort_order:j+1})),
  }));
}
export function validateBank(bank){
  const rows=bankRows(bank);
  assertChapterForm(bank,rows);
  for(const item of bank.forms.A){
    const spoken=!!item.spokenChoices;
    if(item.options.length!==(spoken?3:4)||new Set(item.options).size!==item.options.length||!item.explanation||!item.prompt)throw Error(`Invalid choices ${item.id}`);
    if(item.answer<0||item.answer>=item.options.length)throw Error(`Invalid key ${item.id}`);
    if(item.ordered){
      if(item.ordered.length!==4||new Set(item.ordered).size!==4||item.options[item.answer]!==item.ordered[item.starPosition])throw Error(`Invalid star ${item.id}`);
      if((item.prompt.match(/★/g)||[]).length!==1||(item.prompt.match(/＿＿/g)||[]).length!==3)throw Error(`Invalid star slots ${item.id}`);
    }
    if(bank.chapter>=10&&/[A-Za-z]{3,}/.test(item.prompt.replace(/<[^>]*>/g,'')))throw Error(`Indonesian prompt ${item.id}`);
    if(spoken&&item.spokenChoices.some((o,j)=>!item.audioScript.includes(`${['いちばん','にばん','さんばん'][j]}。\n${item.imageUrl?'A':'B'}: ${o}`)))throw Error(`Audio/key mismatch ${item.id}`);
  }
  if(new Set(bank.forms.A.filter(q=>q.category==='listening').map(q=>q.audioScript)).size!==4)throw Error(`Repeated audio ${bank.chapter}`);
  if(new Set(bank.forms.A.filter(q=>q.category==='reading').map(q=>q.passage)).size!==3)throw Error(`Reading coverage ${bank.chapter}`);
  return rows;
}
for(const bank of banks)validateBank(bank);
