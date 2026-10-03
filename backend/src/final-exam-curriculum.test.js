import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {curriculumBanks,validateCurriculumBank,scopeChanges} from '../content/final-exams/curriculum.mjs';
import {namedBanks} from '../content/final-exams/names.mjs';
import {buildCurriculumSql} from '../scripts/build-final-exam-curriculum.mjs';
for(const [i,b]of curriculumBanks.entries())test(`${b.level}: scoped choices preserve composition, keys, scoring and synchronized audio`,()=>{
 validateCurriculumBank(b);assert.deepEqual(b.policy,namedBanks[i].policy);
 for(const [j,q]of b.rows.entries()){
  const before=namedBanks[i].rows[j];assert.equal(q.id,before.id);
  assert.deepEqual(q.options.map(({option_text,...o})=>o),before.options.map(({option_text,...o})=>o));
  const choices=q.assessment_meta.spokenChoices||q.options.map(o=>o.option_text);
  assert.equal(new Set(choices).size,choices.length);
  assert.doesNotMatch(JSON.stringify(q),/[AB]さん|それなのにので|準番|用備|順美|器会|期械|予走|用定/);
  if(b.level==='n5')assert.doesNotMatch([q.question,q.passage,q.audio_script,...choices].join('\n'),/ほど|ことが\s*できます|あとで|て\s*もら|作って\s*くれ|すぎます|あげま|はって\s*あります|だけ/);
  if(q.audio_script&&!q.assessment_meta.spokenChoices)assert.ok(q.audio_script.includes('N: '+q.question),q.assessment_meta.key);
 }
});
test('scope revision covers both complete forms and is a reproducible migration',()=>{
 assert.ok(new Set(scopeChanges.map(x=>x.key)).size>=90);
 for(const b of curriculumBanks)for(const form of ['A','B'])assert.ok(b.rows.some(q=>q.assessment_meta.form===form&&q.assessment_meta.scopeRevision));
 assert.equal(fs.readFileSync(new URL('../migrations/199_final_exam_curriculum_scope.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildCurriculumSql());
});
