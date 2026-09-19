import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import F from '../../src/dialogue-furigana.js';
const line=()=>({speaker:'A',text:'今日、図書館へ行きます。',readings:[
  {start:0,end:2,reading:'きょう'},{start:3,end:6,reading:'としょかん'},{start:7,end:8,reading:'い'}
]});
test('kanji groups retain precise offsets, repeated words, and supplementary-plane characters',()=>{
  assert.deepEqual(F.groups('今日と今日'),[{start:0,end:2,text:'今日'},{start:3,end:5,text:'今日'}]);
  assert.deepEqual(F.groups('𠮷野さん'),[{start:0,end:3,text:'𠮷野'}]);
  assert.deepEqual(F.groups('ひらがな'),[]);
});
test('normalization strips extra fields; ruby leaves Japanese source untouched',()=>{
  const value={schemaVersion:1,lines:[{...line(),html:'<script>'}]};
  assert.deepEqual(F.normalize(value),{schemaVersion:1,lines:[line()]});
  assert.match(F.html(line().text,line()),/<ruby>今日<rp>\(<\/rp><rt>きょう<\/rt>/);
  assert.equal(value.lines[0].text,'今日、図書館へ行きます。');
  assert.equal(F.normalize(null),null);
});
test('unknown, overlapping, unsorted, non-kanji and unsafe readings are rejected',()=>{
  for(const reading of [
    {start:0,end:1,reading:'きょう'},{start:2,end:3,reading:'てん'},
    {start:0,end:2,reading:'<img onerror=x>'},{start:0,end:2,reading:'today'},
    {start:0,end:2,reading:''},{start:0,end:2,reading:'あ'.repeat(65)}
  ])assert.throws(()=>F.normalize({schemaVersion:1,lines:[{...line(),readings:[reading]}]}));
  assert.throws(()=>F.normalize({schemaVersion:1,lines:[{...line(),readings:[line().readings[0],line().readings[0]]}]}));
  assert.throws(()=>F.normalize({schemaVersion:1,lines:[{...line(),readings:[...line().readings].reverse()}]}));
});
test('rendering escapes text, fails closed on stale annotations and never interprets HTML',()=>{
  assert.equal(F.html('<img src=x>',null),'&lt;img src=x&gt;');
  assert.equal(F.html('明日',line()),'明日');
  assert.equal(F.html(line().text,{...line(),readings:[{start:0,end:2,reading:'<script>'}]}),line().text);
  const data={schemaVersion:1,lines:[line()]};
  assert.equal(F.lineFor(data,0,{speaker:'B',text:line().text}),null);
  assert.equal(F.lineFor(data,0,{speaker:'A',text:'明日'}),null);
  assert.equal(F.lineFor(data,9,line()),null);
});
function admin(){
  const ctx={window:null,document:{getElementById:()=>null},EzFurigana:F};ctx.window=ctx;
  ctx.__dialogRows=[{speaker:'A',jp:line().text,id:'Terjemahan'}];
  vm.runInNewContext(readFileSync(new URL('../../src/admin-dialogue-furigana.js',import.meta.url),'utf8'),ctx);
  return ctx;
}
test('admin correction round-trips without changing audio text or translation',()=>{
  const c=admin(),ui=c.EzDialogueFuriganaAdmin,ta={value:JSON.stringify({schemaVersion:1,lines:[line()]})},tr={querySelector:()=>ta};
  ui.load(tr);ui.edit(0,0,2,'こんにち');ui.save(tr);
  assert.equal(JSON.parse(ta.value).lines[0].readings[0].reading,'こんにち');
  assert.equal(c.__dialogRows[0].jp,line().text);assert.equal(c.__dialogRows[0].id,'Terjemahan');
  c.__dialogRows[0].furigana=[];ui.load(tr);assert.equal(c.__dialogRows[0].furigana[0].reading,'こんにち');
});
test('editing Japanese invalidates old readings; moving/deleting rows keeps annotations aligned',()=>{
  const c=admin(),ui=c.EzDialogueFuriganaAdmin;ui.edit(0,0,2,'きょう');
  const row=c.__dialogRows[0];c.__dialogRows.unshift({speaker:'N',jp:'',id:''});
  assert.equal(ui.data().lines[0].readings[0].reading,'きょう');
  c.__dialogRows.reverse();assert.equal(ui.data().lines[0].speaker,'A');
  row.jp='明日、行きます。';ui.changed(0);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.data().lines[0].readings)),[]);
});
test('annotations also work without a character scene or with incomplete readings',()=>{
  const c=admin();c.EzDialogueFuriganaAdmin.edit(0,0,2,'きょう');
  const saved=F.normalize(c.EzDialogueFuriganaAdmin.data());
  assert.equal(saved.lines[0].readings.length,1);
  assert.match(F.html(saved.lines[0].text,saved.lines[0]),/<rt>きょう<\/rt>/);
  assert.ok(F.html(saved.lines[0].text,saved.lines[0]).includes('図書館へ行きます。'));
});
