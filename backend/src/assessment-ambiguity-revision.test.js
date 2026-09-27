import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {banks,bankRows,revisions} from '../content/assessments/jlpt/revised.mjs';
import {banks as oldBanks} from '../content/assessments/jlpt/index.mjs';
import {buildRollout,illustration} from '../scripts/build-assessment-ambiguity-revision.mjs';
import {createChapterSnapshot,publicChapterQuestions,gradeChapterAssessment} from './chapter-assessment.js';

test('v4 retains 408 items, bounds, private keys and independent old snapshots',async()=>{
 assert.equal(revisions.size,24);
 const known=new Set('人名何学校先生国語本花魚一二三四五六七八九十時分円百千万年月半歳午前後安高古新白長男女気下前外間右中左後上車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土曜子父母友手足口目耳');
 for(const bank of banks){
   const rows=bankRows(bank),snapshot=createChapterSnapshot(bank,rows);
   assert.equal(rows.length,24);assert.equal(snapshot.version,'n5-assessment-v4');
   assert.equal(gradeChapterAssessment(snapshot,new Map(rows.map(q=>[q.id,{correct:true}]))).passed,true);
   assert.doesNotMatch(JSON.stringify(publicChapterQuestions(snapshot)),/is_correct|audio_script|spokenChoices|ordered|distractorReasons/);
   for(const q of bank.forms.A){
     const visible=[q.prompt,q.passage,q.audioScript,...q.options].filter(Boolean).join('\n');
     for(const c of visible.match(/[一-龯]/g)||[])assert.ok(known.has(c),`${q.id}: ${c}`);
     if(bank.chapter>=10)assert.doesNotMatch(visible.replace(/<[^>]*>/g,''),/[A-Za-z]{3,}/,q.id);
     assert.ok(!oldBanks.flatMap(b=>b.forms.A).some(old=>old.id===q.id));
   }
 }
 assert.equal((await readFile(new URL('../migrations/175_assessment_ambiguity_revision.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n'),buildRollout());
 for(const c of [6,18])assert.equal(await readFile(new URL(`../../assets/assessments/b${c}-r2.svg`,import.meta.url),'utf8'),illustration(c));
});

test('known alternative answers are closed by facts or inseparable chunks',()=>{
 const item=(c,n)=>banks.find(b=>b.chapter===c).forms.A[n-1];
 assert.match(item(5,13).prompt,/09.00–12.00/); // The reverse interval no longer fits supplied facts.
 assert.ok(item(7,14).ordered.includes('しずかで'));
 assert.ok(!item(7,14).ordered.includes('で')); // Cannot build きれいな まち で しずか.
 assert.ok(item(18,14).ordered.includes('が いちばん')); // Adverb cannot move independently.
 assert.match(item(8,7).prompt,/どこに いますか/);
 assert.match(item(14,21).audioScript,/じしょは もって いきません/);
 assert.match(item(4,22).audioScript,/ただしい ものは どれですか/);
 assert.equal(item(9,6).options[item(9,6).answer],'えきから がっこうへ いきます。');
 assert.match(item(20,6).options[item(20,6).answer],/らいねん、はじめて/);
 assert.ok(!item(20,10).options.includes('から'));
 assert.doesNotMatch(item(18,23).audioScript,/Aの かばん|Bの かばん/);
 assert.doesNotMatch(JSON.stringify(banks[0]),/だれの/);
});
