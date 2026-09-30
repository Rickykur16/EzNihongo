import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { authored as early } from '../content/n5-support/grammar-authored-04-11.mjs';
import { authored as later } from '../content/n5-support/grammar-authored-12-20.mjs';

// The baseline is an authenticated course export captured before authoring.
// Regeneration is deliberate: never fetch a moving production baseline here.
const baselinePath = process.argv[2] || new URL('../../../n5-support-audit/live-course.json', import.meta.url);
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const approved = JSON.parse(await readFile(new URL('./n5-bunpou-canva-plan.json', import.meta.url), 'utf8'));
// Apply only reviewed lexical spellings whose characters have all been taught
// by that chapter. Numeric reading examples intentionally retain kana.
const knownSpellings=[
  [3,'がっこう','学校'],[3,'がくせい','学生'],[3,'せんせい','先生'],
  [9,'でんしゃ','電車'],[9,'えき','駅'],[9,'いきます','行きます'],[9,'いきません','行きません'],[9,'いきました','行きました'],
  [10,'よみます','読みます'],[10,'よみません','読みません'],[10,'よみました','読みました'],
];
function cumulative(a){
  if(a.bab>11)return a;
  const spell=value=>{
    if(typeof value==='string'){
      for(const [first,kana,kanji]of knownSpellings)if(a.bab>=first)value=value.replaceAll(kana,kanji);
      if(a.bab>=4)value=value.replace(/(?<![\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])ほん(?=[\s。、？！?!]|$|を|は|が|です|の)/gu,'本');
      return value;
    }
    if(Array.isArray(value))return value.map(spell);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,spell(v)]));
    return value;
  };
  // Dialogue drafts stay outside this phase and outside the generated corpus.
  return {...a,examples:spell(a.examples),recognition:spell(a.recognition),controlled:spell(a.controlled),taskInstruction:spell(a.taskInstruction)};
}
const authored = [...early, ...later].map(cumulative);
const core = g => Object.fromEntries(['id','module_id','lesson_id','pattern','meaning','sort_order'].map(k=>[k,g[k]??null]));
const examplesBefore = g => (g.examples||[]).map(e=>({japanese:e.japanese,highlight:e.highlight,indonesian:e.indonesian,sort_order:e.sort_order})).sort((a,b)=>a.sort_order-b.sort_order||a.japanese.localeCompare(b.japanese));
const beforeSupport = g => ({example:g.example??null,practice_config:null,examples:examplesBefore(g)});
function drills(a) {
  const [prompt,answer,...wrong]=a.recognition;
  const [controlledPrompt,sentence,indonesian,controlledAnswer,...controlledWrong]=a.controlled;
  return {
    recognition:{prompt,example:{japanese:a.recognitionExample??'',indonesian:''},options:[answer,...wrong],answer},
    controlled:{prompt:controlledPrompt,sentence,indonesian,options:[controlledAnswer,...controlledWrong],answer:controlledAnswer}
  };
}
const aliases = {
  4:[[0],[1],[2],[3]], 5:[[0],[1],[2],[3]], 6:[[0],[1],[2,3],[4],[5,6],[7]],
  7:[[0],[1],[2],[3],[4],[5]], 8:[[0],[1],[5],[7]], 9:[[0],[2],[3],[4]],
};
const chapters = [];
for (const chapter of approved.filter(x=>x.bab>=4&&x.bab<=20)) {
  const bab=chapter.bab;
  const m=baseline.course.modules.find(x=>x.slug===`n5-b${bab}`);
  if(!m)throw Error(`Missing module ${bab}`);
  let index=0;
  const items=[];
  for(const part of chapter.parts) {
    const lesson=m.lessons.find(l=>l.slug===part.slug);
    if(!lesson)throw Error(`Missing source ${part.slug}`);
    for(const pattern of part.patterns) {
      const matches=m.grammar.filter(g=>g.lesson_id===lesson.id&&g.pattern===pattern);
      if(matches.length!==1)throw Error(`Source selector ${bab}/${pattern}: ${matches.length}`);
      const pointIndex=index++;
      const g=matches[0], a=authored.find(a=>a.bab===bab&&a.index===pointIndex);
      if(!a)throw Error(`Missing authored ${bab}/${index-1}`);
      items.push({id:g.id,lessonId:lesson.id,lessonSlug:lesson.slug,pattern:g.pattern,
        expectedCore:core(g),expectedSupport:beforeSupport(g),examples:a.examples,drills:drills(a),taskInstruction:a.taskInstruction});
    }
  }
  const taskItems=[];
  const lessons=m.lessons.filter(l=>l.grammarTask?.length);
  let taskIndex=0;
  for(const lesson of lessons) for(const t of lesson.grammarTask) {
    const g=m.grammar.find(g=>g.id===t.id);
    if(!g)throw Error(`Missing task bank ${t.id}`);
    const indices=aliases[bab]?.[taskIndex]??[taskIndex];
    const sources=indices.map(i=>items[i]);
    if(sources.some(s=>!s))throw Error(`Missing alias ${bab}/${taskIndex}`);
    let examples=sources.length===1?sources[0].examples:sources.flatMap(s=>s.examples.slice(0,2));
    let practice=sources.length===1?sources[0].drills:{recognition:sources[0].drills.recognition,controlled:sources[1].drills.controlled};
    let instruction=sources[0].taskInstruction;
    if(bab===6&&taskIndex===2) instruction='Kartu pengalaman kemarin: りょうり (masakan) → おいしい (enak); ほん (buku) → tidak おもしろい (menarik). Buat satu jawaban berisi dua kalimat: positif lampau untuk masakan dan negatif lampau untuk buku.';
    if(bab===6&&taskIndex===4) instruction='Kartu: りょうり (masakan) sangat おいしい (enak), tetapi tidak terlalu からい (pedas). Buat satu jawaban berisi dua kalimat terpisah, memakai とても dan あまり. Tidak perlu kata penghubung.';
    // This existing task-bank card teaches a different negative response than
    // the source card. Keep its own fixed pattern and practice that exact form.
    if(bab===4&&taskIndex===3) {
      examples=[
        {japanese:'はい、そうです。',highlight:'そうです',indonesian:'Ya, benar. (Menjawab pertanyaan apakah benda itu buku; memang buku.)'},
        {japanese:'いいえ、そうじゃありません。ペンです。',highlight:'そうじゃありません',indonesian:'Bukan. Itu pena. (Lawan bicara mengira benda itu pensil.)'},
        {japanese:'いいえ、そうじゃありません。わたしのです。',highlight:'そうじゃありません',indonesian:'Bukan. Itu milik saya. (Lawan bicara mengira buku itu milik Hadi.)'}
      ];
      practice={recognition:{prompt:'Teman mengira benda itu pensil. Anda menjawab いいえ、そうじゃありません。ペンです. Apa yang Anda lakukan?',example:{japanese:examples[1].japanese,indonesian:''},options:['Membetulkan dugaan; benda itu pena.','Membenarkan bahwa benda itu pensil.','Menanyakan pemilik pena.'],answer:'Membetulkan dugaan; benda itu pena.'},controlled:{prompt:'Teman bertanya apakah ini buku. Kartu menyatakan benda itu memang buku. Pilih jawaban yang membenarkan.',sentence:'はい、＿＿＿。',indonesian:'Ya, benar.',options:['そうです','そうじゃありません','そうですか'],answer:'そうです'}};
      instruction='Teman mengira benda yang Anda pegang adalah えんぴつ (pensil). Kartu: benda itu ペン (pena). Buat satu respons singkat memakai そうじゃありません, lalu sebutkan benda yang benar.';
    }
    taskItems.push({lessonId:lesson.id,lessonSlug:lesson.slug,grammarId:g.id,expectedSortOrder:null,
      expectedRequiredCount:t.requiredCount,expectedInstruction:t.instruction??null,
      sourceIds:sources.map(s=>s.id),instruction,examples,drills:practice,expectedCore:core(g),expectedSupport:beforeSupport(g)});
    taskIndex++;
  }
  if(bab===5) {
    const g=m.grammar.find(g=>g.id==='78b6bd3c-cfd5-4a52-b8ec-0f141edc90bf');
    if(!g||g.pattern!=='Rumus belas'||g.meaning!==null)throw Error('Numeric point drifted');
    items.push({id:g.id,lessonId:g.lesson_id,lessonSlug:m.lessons.find(l=>l.id===g.lesson_id).slug,pattern:g.pattern,
      expectedCore:core(g),expectedSupport:beforeSupport(g),examples:[
        {japanese:'11：じゅういち',highlight:'じゅういち',indonesian:'Sebelas: じゅう (10) + いち (1).'},
        {japanese:'12：じゅうに',highlight:'じゅうに',indonesian:'Dua belas: じゅう (10) + に (2).'},
        {japanese:'17：じゅうなな',highlight:'じゅうなな',indonesian:'Tujuh belas: じゅう (10) + なな (7).'}
      ],drills:null,taskInstruction:null});
  }
  chapters.push({bab,moduleId:m.id,moduleSlug:m.slug,items,taskItems});
}
const plan={schemaVersion:1,version:'n5-b4-20-non-dialog-support-v1',capturedAt:baseline.capturedAt,courseId:baseline.course.id,courseSlug:'n5',chapters};
const target=new URL('../content/n5-support/grammar-support.json',import.meta.url);
await writeFile(target,JSON.stringify(plan,null,2)+'\n');
const template=await readFile(new URL('../content/n5-support/grammar-support.template.sql',import.meta.url),'utf8');
await writeFile(new URL('../migrations/184_n5_grammar_support.sql',import.meta.url),template.replace('__CONTENT__',JSON.stringify(plan,null,2)));
console.log(`Wrote ${fileURLToPath(target)}: ${chapters.flatMap(c=>c.items).length} source points, ${chapters.flatMap(c=>c.taskItems).length} task memberships.`);
