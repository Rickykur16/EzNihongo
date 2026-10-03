import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scoredBanks} from '../content/final-exams/scoring.mjs';
import {namedBanks,validateNamedBank} from '../content/final-exams/names.mjs';
import {parseDialog,voiceForSpeaker} from './routes/tts.js';
import {buildNamesSql} from '../scripts/build-final-exam-names.mjs';
for(const [i,bank] of namedBanks.entries())test(`${bank.level}: natural names stay consistent without changing answer identity or voice routing`,()=>{
 validateNamedBank(bank);
 for(const [j,q] of bank.rows.entries()){
  const old=scoredBanks[i].rows[j];assert.equal(q.id,old.id);
  assert.deepEqual(q.options.map(({option_text,...o})=>o),old.options.map(({option_text,...o})=>o));
  if(!q.audio_script){assert.deepEqual(q,old);continue;}
  assert.doesNotMatch(JSON.stringify(q),/[AB]さん|\\n[AB]:/);
  const turns=parseDialog(q.audio_script);assert.ok(turns?.length);
  for(const turn of turns){assert.ok(['N','女の人','男の人'].includes(turn.speaker));
   if(turn.speaker!=='N')assert.deepEqual(voiceForSpeaker(turn.speaker,0),voiceForSpeaker(turn.speaker==='女の人'?'A':'B',0));
  }
  if(/[AB]さん/.test(old.audio_script)&&!q.image_url){
   const introduction=turns[0].text;
   for(const name of new Set((JSON.stringify(q).match(/(?:あや|けん|ゆみ|たろう|はな|ひろし|みき|ゆうた)さん/g)||[])))assert.ok(introduction.includes(name),name);
  }
  if(q.image_url){const svg=fs.readFileSync(new URL('../../'+q.image_url.slice(1),import.meta.url),'utf8');assert.match(svg,/>あや<\/text>/);assert.doesNotMatch(svg,/>[AB]<\/text>|Aさん/);assert.match(q.audio_script,/あやさん/);}
 }
});
test('natural-name migration remains reproducible',()=>assert.equal(fs.readFileSync(new URL('../migrations/197_final_exam_natural_names.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildNamesSql()));
