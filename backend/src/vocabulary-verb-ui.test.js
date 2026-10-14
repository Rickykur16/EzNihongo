import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { n5VerbForms } from './n5-verb-forms.js';

const html = readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8');
const display = readFileSync(new URL('../../src/vocabulary-verb-display.js', import.meta.url), 'utf8');
const content = readFileSync(new URL('./routes/content.js', import.meta.url), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const items = [
  {id:'verb',japanese:'読む',reading:'よむ',indonesian:'membaca',verbForms:n5VerbForms({japanese:'読む'},'n5')},
  {id:'early',japanese:'寝ます',indonesian:'tidur',verbForms:n5VerbForms({japanese:'寝ます'},'n5')},
  {id:'noun',japanese:'本',reading:'ほん',indonesian:'buku',verbForms:null},
];
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
  context.__deckData=items; context.playDeckAudio(0,{});
  assert.equal(context.lastAudio, 'よむ。よみます');
  context.playDeckAudio(2,{}); assert.equal(context.lastAudio,'本');
});

test('modal switches from an early masu word to a noun without leaving stale forms', () => {
  const {context,node}=setup(); context.__deckData=items;
  context.openDeckModal(1);
  assert.equal(node('modal:.dm-jp').textContent,'寝る');
  assert.equal(node('modal:.deck-modal-head').hidden,true);
  assert.match(node('dm-verb-forms').innerHTML, /寝る[\s\S]*寝ます/);
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
});
