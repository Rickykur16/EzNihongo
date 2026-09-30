import fs from 'node:fs';
const plan=JSON.parse(fs.readFileSync(new URL('../content/n4-support/dialogue-plan.json',import.meta.url),'utf8'));
const byId=new Map(plan.items.map(i=>[i.grammarId,i]));

// These are voluntary reading checks, not graded quiz answers. Hide them when
// an editor changes the conversation, rather than showing stale explanations.
export function n4DialogueSelfChecks(grammar){
 const item=byId.get(grammar.id);
 if(!item||grammar.example_dialog!==item.replacement.example_dialog||grammar.example_dialog_id!==item.replacement.example_dialog_id)return [];
 return item.checks;
}
