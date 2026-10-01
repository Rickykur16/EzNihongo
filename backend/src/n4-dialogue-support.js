import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../content/n4-support/'+name,import.meta.url),'utf8'));
const plan=read('dialogue-plan.json');
const byId=new Map(plan.items.map(i=>[i.grammarId,i]));
// Migration 192 rewrote the same dialogues with the kanji already taught;
// both spellings carry the same checks.
const kanjiText=new Map(read('dialogue-kanji-plan.json').items.map(i=>[i.grammarId,i.replacement.example_dialog]));

// These are voluntary reading checks, not graded quiz answers. Hide them when
// an editor changes the conversation, rather than showing stale explanations.
export function n4DialogueSelfChecks(grammar){
 const item=byId.get(grammar.id);
 if(!item||grammar.example_dialog_id!==item.replacement.example_dialog_id)return [];
 if(grammar.example_dialog!==item.replacement.example_dialog&&grammar.example_dialog!==kanjiText.get(grammar.id))return [];
 return item.checks;
}
