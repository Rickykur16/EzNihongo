import fs from 'node:fs';
const sourcePath=process.argv[2];
if(!sourcePath)throw Error('Usage: node build-vocabulary.mjs <authoritative-live-course.json> [--partial]');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8').replace(/^\uFEFF/,''));
const course=source.course??source;
if(course.slug!=='n4')throw Error('Expected N4 source');
const dir=new URL('./',import.meta.url);
const files=fs.readdirSync(dir).filter(f=>/^vocabulary-\d\d-\d\d\.mjs$/.test(f)).sort();
const corpus={};
for(const f of files){
  const authored=(await import(new URL(f,dir))).default;
  for(const [chapter,text]of Object.entries(authored)){
    if(chapter in corpus)throw Error(`Duplicate chapter ${chapter}`);
    corpus[chapter]=text;
  }
}
const items=[], missing=[];
const normal=s=>s.replace(/\s+/gu,'');
for(const m of course.modules){
  const chapter=m.sort_order;
  const deck=m.lessons.flatMap(l=>l.deck||[]);
  const seenWords=new Set();
  const byWord=new Map(deck.map(w=>[w.japanese,w]));
  if(byWord.size!==deck.length)throw Error('Cannot map ambiguous Japanese in chapter '+chapter);
  const examplesById=new Map();
  const notesById=new Map();
  const raw=corpus[chapter]||'';
  for(const line of raw.trim().split('\n').map(s=>s.trim()).filter(Boolean)){
    const fields=line.split('|');
    if(fields.length<3||fields.length>4)throw Error(`Bad columns ${chapter}: ${line}`);
    const [word,marked,id,note]=fields;
    const w=byWord.get(word);if(!w)throw Error(`Unknown word ${chapter}: ${word}`);
    seenWords.add(word);
    const markers=[...marked.matchAll(/\{([^{}]+)\}/gu)];
    if(!markers.length)throw Error(`Missing reading marker ${chapter}: ${word}`);
    const japanese=normal(marked.replace(/\{([^{}]+)\}/gu,(_,tag)=>tag.split('~')[0]));
    const reading=normal(marked.replace(/\{([^{}]+)\}/gu,(_,tag)=>{
      const parts=tag.split('~');
      if(parts.length>2)throw Error('Invalid marker '+tag);
      if(parts.length===2)return parts[1];
      if(parts[0]!==w.japanese)throw Error(`Need explicit reading for ${tag} (entry ${word})`);
      return w.reading;
    }));
    if(!/^[\p{Script=Hiragana}\p{Script=Katakana}ー々ゝゞヽヾ\p{P}\p{Z}\d]+$/u.test(reading))throw Error(`Non-kana reading ${chapter} ${word}: ${reading}`);
    if(/[{}~]/u.test(japanese+reading))throw Error('Unresolved marker '+word);
    const examples=examplesById.get(w.id)||[];
    if(examples.some(e=>e.japanese===japanese))throw Error('Duplicate example '+word);
    examples.push({japanese,reading,indonesian:id});
    examplesById.set(w.id,examples);
    if(note){const notes=notesById.get(w.id)||[];if(!notes.includes(note))notes.push(note);notesById.set(w.id,notes);}
  }
  for(const w of deck){
    const examples=examplesById.get(w.id)||[];
    if(!examples.length){missing.push({chapter,japanese:w.japanese});continue;}
    const item={id:w.id,chapter,japanese:w.japanese,examples};
    if(notesById.has(w.id))item.note=notesById.get(w.id).join(' ');
    items.push(item);
  }
}
if(missing.length&&!process.argv.includes('--partial'))throw Error('Missing words: '+JSON.stringify(missing));
if(new Set(items.map(w=>w.id)).size!==items.length)throw Error('Duplicate IDs');
const output={schemaVersion:1,items};
fs.writeFileSync(new URL('vocabulary-examples.json',dir),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({items:items.length,examples:items.reduce((n,w)=>n+w.examples.length,0),withNotes:items.filter(w=>w.note).length,missing:missing.length,chapters:[...new Set(items.map(w=>w.chapter))]}));
