import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dialogueCatalog, editorDialogScene, keepStoredVoices, normalizeDialogScene, publicDialogScene, sceneTurnVoices,
  validateSceneVoices} from './dialogue-scene.js';

const fixture = () => ({schemaVersion:1,enabled:true,backgroundKey:'classroom',participants:[
  {characterKey:'anna-wijaya',position:'left',speaker:'A',displayName:'Anna',voiceId:'voice-anna',voiceName:'Anna voice',profileVersion:1,custom:false},
  {characterKey:'hadi-pratama',position:'right',speaker:'B',displayName:'Hadi',voiceId:'voice-hadi',voiceName:'Hadi voice',profileVersion:1,custom:false}
]});

test('scene normalization preserves snapshots and only allowlisted fields',()=>{
  const s=fixture();s.url='https://evil.test';s.participants[0].css='opacity:0.5';
  const normalized=normalizeDialogScene(s);
  assert.deepEqual(normalized,fixture());
  assert.equal(normalizeDialogScene(null),null);
  assert.equal(normalizeDialogScene({...s,enabled:false}).enabled,false);
});
test('scene rejects unknown assets, duplicate actors/slots/speakers, narrator and unsafe voices',()=>{
  for(const change of [s=>s.backgroundKey='url(x)',s=>s.participants[0].characterKey='unknown',
    s=>s.participants[0].speaker='N',s=>s.participants[0].speaker='nasi',s=>s.participants[0].speaker='name:html',
    s=>s.participants[1].speaker='A',s=>s.participants[1].position='left',s=>s.participants[1].characterKey='anna-wijaya',
    s=>s.participants[0].voiceId='https://voice',s=>s.participants[0].displayName='',s=>s.participants[0].profileVersion=0,
    s=>s.participants.pop(),s=>s.schemaVersion=99]){
    const s=fixture();change(s);assert.throws(()=>normalizeDialogScene(s));
  }
});
test('public scene hides provider references and fails closed on invalid data',()=>{
  const s=publicDialogScene(fixture());
  assert.equal(s.participants[0].displayName,'Anna');
  assert.ok(!('voiceId' in s.participants[0]));assert.ok(!('voiceName' in s.participants[0]));
  assert.equal(publicDialogScene({enabled:true}),null);
  const draft=fixture();draft.participants[0].voiceId=null;
  assert.equal(publicDialogScene(draft).audioReady,false);
});
test('the editor copy keeps voices; a saved copy without voices keeps the stored ones',()=>{
  const editor=editorDialogScene(fixture());
  assert.equal(editor.participants[0].voiceId,'voice-anna');assert.equal(editor.audioReady,true);
  // What an editor sent back when it only had the student snapshot.
  const stripped=normalizeDialogScene({...publicDialogScene(fixture()),participants:publicDialogScene(fixture()).participants.map(p=>({...p}))});
  assert.equal(stripped.participants[0].voiceId,null);
  const kept=keepStoredVoices(stripped,fixture());
  assert.deepEqual(kept.participants.map(p=>[p.voiceId,p.voiceName]),[['voice-anna','Anna voice'],['voice-hadi','Hadi voice']]);
  // Matched by character: renaming the speaker code keeps the voice ...
  const remapped=normalizeDialogScene({...stripped,participants:stripped.participants.map(p=>({...p,speaker:p.speaker+'2'}))});
  assert.equal(keepStoredVoices(remapped,fixture()).participants[0].voiceId,'voice-anna');
  // ... swapping in another character does not inherit the old voice.
  const recast=normalizeDialogScene({...stripped,participants:[{...stripped.participants[0],characterKey:'aoi-takahashi'},stripped.participants[1]]});
  assert.equal(keepStoredVoices(recast,fixture()).participants[0].voiceId,null);
  // A newly chosen voice always wins; nothing stored or no scene sent leaves it alone.
  const chosen=fixture();chosen.participants[0].voiceId='voice-new';
  assert.equal(keepStoredVoices(normalizeDialogScene(chosen),fixture()).participants[0].voiceId,'voice-new');
  assert.equal(keepStoredVoices(stripped,null),stripped);
  assert.equal(keepStoredVoices(null,fixture()),null);
});
test('browser catalog matches the server allowlist',()=>{
  const ctx={window:{}};
  vm.runInNewContext(readFileSync(new URL('../../assets/dialogue/catalog.js',import.meta.url),'utf8'),ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.EZ_DIALOGUE_CATALOG)),dialogueCatalog);
});
test('explicit speaker mapping wins over registry and remains stable with visual disabled',()=>{
  const fallback=()=>({voiceId:'narrator',role:'narrator'}),turns=[{speaker:'N'},{speaker:'B'},{speaker:'A'}];
  const expected=[fallback(),{voiceId:'voice-hadi',role:'dialogue'},{voiceId:'voice-anna',role:'dialogue'}];
  assert.deepEqual(sceneTurnVoices(turns,fixture(),fallback),expected);
  assert.deepEqual(sceneTurnVoices(turns,{...fixture(),enabled:false},fallback),expected);
  assert.deepEqual(sceneTurnVoices(turns,null,fallback),turns.map(fallback));
});
test('draft voices can be saved but unknown/missing mapped voices cannot generate',()=>{
  const s=fixture();s.participants[0].voiceId=null;
  assert.equal(normalizeDialogScene(s).participants[0].voiceId,null);
  assert.throws(()=>sceneTurnVoices([{speaker:'A'}],s,()=>({voiceId:'guessed'})));
  assert.throws(()=>sceneTurnVoices([{speaker:'C'}],s,()=>({voiceId:'guessed'})));
});
test('provider validation checks availability before generation and skips empty drafts',async()=>{
  await validateSceneVoices(fixture(),async()=>[{voiceId:'voice-anna'},{voiceId:'voice-hadi'}]);
  await assert.rejects(validateSceneVoices(fixture(),async()=>[{voiceId:'voice-hadi'}]));
  const s=fixture();s.participants.forEach(p=>p.voiceId=null);
  await validateSceneVoices(s,async()=>{throw new Error('must not fetch');});
});

const source=readFileSync(new URL('../../src/admin-dialogue-scene.js',import.meta.url),'utf8');
function admin(){
  const profiles=dialogueCatalog.characters.map((c,i)=>({id:String(i),character_key:c.key,default_display_name:c.displayName,voice_id:'v'+i,voice_name:'Voice '+i,profile_version:1}));
  const ctx={window:null,document:{getElementById:()=>null},notify:()=>{},admLoadElevenVoices:async()=>[]};
  ctx.window=ctx;ctx.EzDialogue={catalog:dialogueCatalog,esc:s=>String(s??''),html:()=>'',mount:()=>{}};
  ctx.admRenderDialogModal=()=>{};ctx.__dialogSpeakers=profiles;ctx.__dialogRows=[{speaker:'A',jp:'hello'},{speaker:'B',jp:'hi'}];
  ctx.admLoadDialogSpeakers=async()=>profiles;
  vm.runInNewContext(source,ctx);return ctx;
}
test('choosing a character autofills name/voice; switching clears override only for that slot',async()=>{
  const c=admin(),ui=c.EzDialogueAdmin;ui.toggle(true);
  await ui.custom(0,true);ui.field(0,'displayName','Custom');
  c.__dialogScene.participants[1].displayName='Keep';
  ui.character(0,'daniel-foster');const p=c.__dialogScene.participants[0];
  assert.equal(p.displayName,'ダニエル');assert.equal(p.voiceId,'v5');assert.equal(p.custom,false);
  assert.equal(c.__dialogScene.participants[1].displayName,'Keep');
  ui.character(0,'hadi-pratama');assert.equal(c.__dialogScene.participants[0].characterKey,'daniel-foster');
});
test('profile updates do not mutate old snapshots; explicit refresh opts in',async()=>{
  const c=admin(),ui=c.EzDialogueAdmin;ui.toggle(true);
  c.__dialogSpeakers[0].voice_id='new-voice';c.__dialogSpeakers[0].profile_version=2;
  assert.equal(c.__dialogScene.participants[0].voiceId,'v0');await ui.latest(0);
  assert.equal(c.__dialogScene.participants[0].voiceId,'new-voice');assert.equal(c.__dialogScene.participants[0].profileVersion,2);
});
test('save/load round trip preserves custom snapshot; unmapped rows fail',()=>{
  const c=admin(),ui=c.EzDialogueAdmin;ui.toggle(true);ui.background('park');
  const textarea={value:''},tr={querySelector:()=>textarea};ui.save(tr);
  const saved=textarea.value;c.__dialogScene=null;ui.load(tr);assert.equal(JSON.stringify(c.__dialogScene),saved);
  c.__dialogRows.push({speaker:'C',jp:'third'});assert.throws(()=>ui.save(tr));
});
test('disabling a visual keeps its cast and voice snapshots intact',()=>{
  const c=admin(),ui=c.EzDialogueAdmin;ui.toggle(true);const saved=JSON.stringify(c.__dialogScene.participants);
  ui.toggle(false);assert.equal(JSON.stringify(c.__dialogScene.participants),saved);
});
