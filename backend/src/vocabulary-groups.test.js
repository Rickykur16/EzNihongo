import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { n5VocabularyType } from './n5-vocabulary-type.js';

const corpus = JSON.parse(readFileSync(new URL('../content/n5-support/vocabulary-examples.json', import.meta.url))).items;
const bab3 = JSON.parse(readFileSync(new URL('../content/bab3/vocabulary-examples.json', import.meta.url)));
const html = readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8');
const grouping = readFileSync(new URL('../../src/vocabulary-groups.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

test('all 770 N5 source entries have a reviewed type, without changing source categories or IDs', () => {
  const before=JSON.stringify(corpus);
  assert.equal(corpus.length+bab3.length,770);
  let verbs=0;
  for (const row of corpus) {
    const type=n5VocabularyType(row.expectedCore,'n5');
    assert.notEqual(type,'other',`${row.chapter}: ${row.word}`);
    if(type==='verb')verbs++;
  }
  assert.equal(verbs,143);
  for(const row of bab3)assert.notEqual(n5VocabularyType({japanese:row.word},'n5'),'other',row.word);
  assert.equal(JSON.stringify(corpus),before);
});

test('known legacy category errors and empty types resolve by the word used in the lesson', () => {
  for(const [word,type] of [
    ['レストラン','noun'],['生活','noun'],['毎朝','adverb'],['毎晩','adverb'],['よく','adverb'],
    ['ビール','noun'],['リンゴ','noun'],['高い','i-adjective'],['どうやって','question'],
    ['いつも','adverb'],['数','noun'],['ください','expression'],['よろしくお願いします','expression'],
    ['やる','verb'],['来る','verb'],['注文する','verb'],['きれい','na-adjective'],
  ]) {
    const rows=corpus.filter(row=>row.word===word);
    if(rows.length)for(const row of rows)assert.equal(n5VocabularyType(row.expectedCore,'n5'),type,word);
    else assert.equal(n5VocabularyType({japanese:word},'n5'),type,word);
  }
  assert.equal(n5VocabularyType({japanese:'〜人',reading:'〜じん'},'n5'),'affix');
  assert.equal(n5VocabularyType({japanese:'〜人',reading:'〜にん',category:'助数詞'},'n5'),'number');
  assert.equal(n5VocabularyType({japanese:'新しい語',category:'unknown'},'n5'),'other');
  assert.equal(n5VocabularyType({japanese:'読む'},'n4'),null);
});

test('grouping preserves duplicates, original indices and every item while ordering by type', () => {
  const ctx=vm.createContext({}); vm.runInContext(grouping,ctx);
  const items=[{id:'a',wordType:'noun'},{id:'v',wordType:'verb'},{id:'a',wordType:'noun'},{id:'i',wordType:'i-adjective'},{id:'x',wordType:'unrecognized'}];
  const before=JSON.stringify(items);
  const groups=ctx.EzVocabularyGroups.group(items);
  assert.deepEqual(plain(groups.map(g=>g.key)),['verb','i-adjective','noun','other']);
  assert.deepEqual(plain(groups.flatMap(g=>g.entries.map(e=>e.index))),[1,3,0,2,4]);
  assert.deepEqual(plain(groups.find(g=>g.key==='noun').entries.map(e=>e.item.id)),['a','a']);
  assert.equal(groups[0].entries[0].item,items[1]);
  assert.equal(JSON.stringify(items),before);
});

test('search hides empty sections, updates per-type counts and modal navigation follows visible order', () => {
  const ctx=vm.createContext({}); ctx.window=ctx;
  const cards=[
    {dataset:{deckIndex:'1',deckSearch:'読む よむ 読みます よみます'},style:{}},
    {dataset:{deckIndex:'3',deckSearch:'食べる たべます'},style:{}},
    {dataset:{deckIndex:'0',deckSearch:'本 ほん'},style:{}},
  ];
  const groups=[cards.slice(0,2),cards.slice(2)].map(children=>({hidden:false,count:{},
    querySelectorAll:()=>children, querySelector(){return this.count;}}));
  const nodes={'deck-visible-count':{},'deck-empty-filter':{}};
  ctx.document={querySelectorAll:selector=>selector==='[data-deck-group]'?groups:selector==='#deck-grid [data-deck-search]'?cards:[],getElementById:id=>nodes[id]};
  ctx.escapeHtml=value=>String(value).replaceAll('<','&lt;');
  const start=html.indexOf('window.filterDeck =');
  vm.runInContext(html.slice(start,html.indexOf('// Grammar task —',start)),ctx);
  ctx.filterDeck('よみます');
  assert.equal(nodes['deck-visible-count'].textContent,1);
  assert.equal(groups[0].count.textContent,'1 dari 2 kata'); assert.equal(groups[1].hidden,true);
  assert.deepEqual(plain(ctx.__deckModalOrder),[1]);
  ctx.filterDeck('<missing>'); assert.equal(nodes['deck-empty-filter'].hidden,false);
  assert.match(nodes['deck-empty-filter'].innerHTML,/&lt;missing>/);
  ctx.filterDeck(''); assert.equal(groups[1].hidden,false);
  assert.equal(groups[0].count.textContent,'2 kata');
  assert.deepEqual(plain(ctx.__deckModalOrder),[1,3,0]);
  ctx.__deckData=cards;ctx.__deckModalIdx=3;ctx.openDeckModal=idx=>{ctx.opened=idx;};
  const step=html.indexOf('window.deckModalStep =');
  vm.runInContext(html.slice(step,html.indexOf('window.closeDeckModal =',step)),ctx);
  ctx.deckModalStep(1); assert.equal(ctx.opened,0);
  ctx.deckModalStep(-1); assert.equal(ctx.opened,1);
  ctx.__deckModalIdx=0;ctx.opened=null;ctx.deckModalStep(1);assert.equal(ctx.opened,null);
});

test('changing card/list view preserves the active search', () => {
  const input={value:'よみます'};const calls=[];
  const ctx=vm.createContext({document:{querySelector:()=>input},localStorage:{setItem:(...a)=>calls.push(a)}});
  ctx.window=ctx;ctx.__deckLessonArgs=['course','module','lesson','nav'];
  ctx.renderDeckLesson=()=>{input.value='';};ctx.filterDeck=q=>calls.push(['filter',q]);
  const start=html.indexOf('window.setDeckView =');
  vm.runInContext(html.slice(start,html.indexOf('window.filterDeck =',start)),ctx);
  ctx.setDeckView('list');assert.equal(input.value,'よみます');
  assert.deepEqual(calls,[['ez_deck_view','list'],['filter','よみます']]);
});
