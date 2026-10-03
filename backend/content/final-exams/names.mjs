import {scoredBanks} from './scoring.mjs';
import {validateRotationBank} from './rotation.mjs';
const pairs=[['あや','けん','Aya','Ken'],['ゆみ','たろう','Yumi','Taro'],['はな','ひろし','Hana','Hiroshi'],['みき','ゆうた','Miki','Yuta']];
export function nameFinalQuestion(original) {
 const q=structuredClone(original);
 if(q.question_category!=='listening')return q;
 const [a,b,latinA,latinB]=q.image_url?pairs[0]:pairs[(q.sort_order-1)%pairs.length];
 const replace=text=>typeof text==='string'?text.replaceAll('Aさん',a+'さん').replaceAll('Bさん',b+'さん'):text;
 const explain=text=>replace(text)?.replace(/\bA\b/g,latinA).replace(/\bB\b/g,latinB);
 q.question=replace(q.question);q.explanation=explain(q.explanation);
 q.options=q.options.map(o=>({...o,option_text:replace(o.option_text)}));
 q.assessment_meta.distractorReasons=q.assessment_meta.distractorReasons.map(explain);
 const named=/[AB]さん/.test(original.audio_script||'');
 q.audio_script=replace(q.audio_script);
 // Preserve female/male routing while removing internal letter labels from transcripts.
 q.audio_script=q.audio_script.replace(/^A:/gm,'女の人:').replace(/^B:/gm,'男の人:');
 if(named&&!q.image_url)q.audio_script=`N: 女の人は ${a}さんです。男の人は ${b}さんです。\n`+q.audio_script;
 if(q.image_url)q.image_url=q.image_url.replace('.svg','-names-v1.svg');
 q.assessment_meta.wordingVersion='natural-names-v1';
 return q;
}
export const namedBanks=scoredBanks.map(b=>({...b,rows:b.rows.map(nameFinalQuestion)}));
export function validateNamedBank(bank) {
 // The historical validator expects internal A/B voice codes. Normalize only
 // for that structural check, without changing public or generated content.
 validateRotationBank({...bank,rows:bank.rows.map(q=>({...q,audio_script:q.audio_script?.replace(/^女の人:/gm,'A:').replace(/^男の人:/gm,'B:')}))});
 for(const q of bank.rows)if(/[AB]さん/.test(JSON.stringify(q)))throw Error('Placeholder person '+q.id);
 return bank;
}
namedBanks.forEach(validateNamedBank);
