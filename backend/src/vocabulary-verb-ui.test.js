import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { n5VerbForms } from './n5-verb-forms.js';
import { n5VocabularyType } from './n5-vocabulary-type.js';

const html = readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8');
const display = readFileSync(new URL('../../src/vocabulary-verb-display.js', import.meta.url), 'utf8');
const grouping = readFileSync(new URL('../../src/vocabulary-groups.js', import.meta.url), 'utf8');
const content = readFileSync(new URL('./routes/content.js', import.meta.url), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const items = [
  {id:'verb',japanese:'読む',reading:'よむ',indonesian:'membaca',verbForms:n5VerbForms({japanese:'読む'},'n5')},
  {id:'early',japanese:'寝ます',indonesian:'tidur',verbForms:n5VerbForms({japanese:'寝ます'},'n5')},
  {id:'noun',japanese:'本',reading:'ほん',indonesian:'buku',category:'名詞',verbForms:null},
].map(item => ({...item,wordType:n5VocabularyType(item,'n5')}));
function setup(view = 'card') {
  const nodes = new Map();
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, { innerHTML:'', textContent:'', hidden:false, disabled:false,
      style:{setProperty(){}}, classList:{contains:()=>false,add(){}}, focus(){},
      insertAdjacentHTML(_, text) { this.innerHTML = text + this.innerHTML; },
      querySelector: key => node('modal:'+key) });
    return nodes.get(key);
  }
  const context = vm.createContext({
    console, escapeHtml:esc, currentState:{course:'n5'}, _kanjiByIdCache:new Map(), AUDIO_SVG:'',
    localStorage:{getItem:()=>view}, document:{getElementById:node,addEventListener(){}},
    deckAccent:()=>'red', viewToggleHtml:()=>'', deckUpdateComplete(){}, deckDrillShowOverview(){},
    syncPracticeStateForLesson(){}, learningStepAction:()=>'', setTimeout:fn=>fn(),
    playTTS: text => { context.lastAudio=text; },
  });
  context.window=context; context.EzBunnyVideo={normalizeUrl:()=>''};
  vm.runInContext(display, context);
  vm.runInContext(grouping, context);
  vm.runInContext(html.slice(html.indexOf('window.playDeckAudio ='), html.indexOf('window.playDeckExample =')), context);
  vm.runInContext(html.slice(html.indexOf('function renderDeckLesson('), html.indexOf('window.setDeckView =')), context);
  vm.runInContext(html.slice(html.indexOf('window.openDeckModal ='), html.indexOf('window.deckModalStep =')), context);
  return {context,node};
}

for (const view of ['card','list']) test(`${view} displays dictionary then masu, preserves nouns, and searches both readings`, () => {
  const {context,node}=setup(view);
  context.renderDeckLesson({name:'N5'}, {title:'Kegiatan'}, {title:'Kosakata',deck:items}, {});
  const output=node('main-content').innerHTML;
  assert.equal((output.match(/class="deck-verb-forms"/g)||[]).length, 2);
  assert.ok(output.indexOf('>読む</span>') < output.indexOf('>読みます</span>'));
  assert.ok(output.indexOf('>寝る</span>') < output.indexOf('>寝ます</span>'));
  assert.match(output, /data-deck-search="[^"]*よみます/);
  assert.match(output, /lang="ja">本<\/div>/);
  assert.match(output, /event.target===this/,'Nested audio controls must work with Enter/Space');
  assert.equal((output.match(/class="deck-type-group"/g)||[]).length,2);
  assert.match(output, /id="deck-type-verb">Kata kerja<\/h2>/);
  assert.match(output, /id="deck-type-noun">Kata benda<\/h2>/);
  assert.match(output, /data-deck-group-count>2 kata/);
  context.__deckData=items; context.playDeckAudio(0,{});
  assert.equal(context.lastAudio, '読む');
  context.playDeckAudio(2,{}); assert.equal(context.lastAudio,'本');
  assert.match(output,/aria-label="Dengar bentuk biasa 読む"/);
  assert.doesNotMatch(output,/mendengar keduanya berurutan/);
});

test('all 143 verb speakers use one existing curriculum dictionary headword accepted by the TTS allowlist', () => {
  const corpus=JSON.parse(readFileSync(new URL('../content/n5-support/vocabulary-examples.json',import.meta.url))).items;
  const known=new Set(corpus.flatMap(row=>[row.expectedCore.japanese,row.expectedCore.reading]).filter(Boolean));
  const verbs=corpus.map(row=>({...row.expectedCore,verbForms:n5VerbForms(row.expectedCore,'n5')})).filter(row=>row.verbForms);
  const {context}=setup();context.__deckData=verbs;
  assert.equal(verbs.length,143);
  verbs.forEach((row,index)=>{
    context.playDeckAudio(index,{});
    assert.equal(context.lastAudio,row.verbForms.dictionary);
    assert.ok(known.has(context.lastAudio),`TTS must recognize ${context.lastAudio}`);
    assert.doesNotMatch(context.lastAudio,/[。]|ます$/);
  });
});

test('N4 keeps its flat vocabulary layout', () => {
  const {context,node}=setup();context.currentState.course='n4';
  context.renderDeckLesson({name:'N4'}, {title:'Kegiatan'}, {title:'Kosakata',deck:items}, {});
  assert.doesNotMatch(node('main-content').innerHTML,/class="deck-type-group"/);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__deckModalOrder)),[0,1,2]);
});

test('modal counters follow grouped order while card actions keep source indices', () => {
  const {context,node}=setup();const deck=[items[2],items[0]];
  context.renderDeckLesson({name:'N5'},{title:'Kegiatan'},{title:'Kosakata',deck},{});
  assert.deepEqual(JSON.parse(JSON.stringify(context.__deckModalOrder)),[1,0]);
  const output=node('main-content').innerHTML;
  assert.ok(output.indexOf('onclick="openDeckModal(1)"')<output.indexOf('onclick="openDeckModal(0)"'));
  context.openDeckModal(1);assert.equal(node('deck-modal-counter').textContent,'1 / 2');
  assert.equal(node('deck-modal-prev').disabled,true);
  context.openDeckModal(0);assert.equal(node('deck-modal-counter').textContent,'2 / 2');
  assert.equal(node('deck-modal-next').disabled,true);
  assert.deepEqual(deck.map(row=>row.id),['noun','verb']);
});

test('modal switches from an early masu word to a noun without leaving stale forms', () => {
  const {context,node}=setup(); context.__deckData=items;
  context.openDeckModal(1);
  assert.equal(node('modal:.dm-jp').textContent,'寝る');
  assert.equal(node('modal:.deck-modal-head').hidden,true);
  assert.match(node('dm-verb-forms').innerHTML, /寝る[\s\S]*寝ます/);
  assert.match(node('dm-verb-forms').innerHTML,/>Dengar bentuk biasa<\/button>/);
  context.openDeckModal(2);
  assert.equal(node('modal:.deck-modal-head').hidden,false);
  assert.equal(node('dm-verb-forms').hidden,true);
  assert.equal(node('dm-verb-forms').innerHTML,'');
  assert.equal(node('modal:.dm-jp').textContent,'本');
});

test('display escapes all authored text and course/lesson endpoints include the same forms', () => {
  const {context}=setup();
  const rendered=context.EzVocabularyVerbDisplay.render({dictionary:'<img>',dictionaryReading:'&',masu:'"',masuReading:"'"},esc);
  assert.doesNotMatch(rendered, /<img>/); assert.match(rendered,/&lt;img&gt;/);
  assert.match(content,/verbForms: n5VerbForms\(r, course.rows\[0\].slug\)/);
  assert.match(content,/verbForms: n5VerbForms\(r, row.course_slug\)/);
  assert.match(content,/wordType: n5VocabularyType\(r, course.rows\[0\].slug\)/);
  assert.match(content,/wordType: n5VocabularyType\(r, row.course_slug\)/);
});
