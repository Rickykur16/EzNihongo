import test, {after, mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET='scene-test-secret';
process.env.JWT_REFRESH_SECRET='scene-test-refresh';
process.env.ADMIN_EMAILS='scene-admin@example.invalid';
process.env.COMPANY_STAFF_ENABLED='false';
process.env.ELEVENLABS_API_KEY='test-not-a-real-key';
process.env.ELEVENLABS_VOICE_NARRATOR='narrator-voice';
const {db}=await import('./db.js');
const {signAccessToken}=await import('./auth.js');
const {default:admin}=await import('./routes/admin.js');
const {default:tts}=await import('./routes/tts.js');
const id='11111111-1111-4111-8111-111111111111';
const text='A: こんにちは。\nB: はじめまして。';
const fixture=()=>({schemaVersion:1,enabled:true,backgroundKey:'classroom',participants:[
  {characterKey:'anna-wijaya',position:'left',speaker:'A',displayName:'Anna',voiceId:'anna-voice',voiceName:'Anna Voice',profileVersion:1,custom:false},
  {characterKey:'hadi-pratama',position:'right',speaker:'B',displayName:'Hadi',voiceId:'hadi-voice',voiceName:'Hadi Voice',profileVersion:1,custom:false}
]});
let saved=fixture(),savedFurigana=null,known=true,grammarMatches=true,available=['anna-voice','hadi-voice'],upstream=[],cache=new Map(),writes=[];
let savedPattern='test',savedMeaning=null,savedGoal=null;
const profiles=[{id, name:'Anna Wijaya', character_key:'anna-wijaya',default_display_name:'Anna',voice_id:'anna-voice',voice_name:'Anna Voice',profile_version:1}];
const grammarRow=()=>({id,module_id:id,lesson_id:null,pattern:savedPattern,meaning:savedMeaning,
  example:null,notes:null,example_dialog:null,example_dialog_id:null,communication_goal:savedGoal,
  dialog_scene:structuredClone(saved),dialog_furigana:structuredClone(savedFurigana)});
const fakeQuery=async(sql,p=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK','SAVEPOINT boundary_resolve','RELEASE SAVEPOINT boundary_resolve',
    'ROLLBACK TO SAVEPOINT boundary_resolve'].includes(sql))return{rows:[]};
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[]};
  if(sql.includes('WITH RECURSIVE required'))return{rows:[{id}]};
  if(sql.includes('SELECT c.id,c.curriculum_boundary_mode AS mode,m.id AS module_id'))return{rows:[{id,mode:'off',module_id:id}]};
  if(sql.includes('boundary:courses'))return{rows:[{id,slug:'n5',level:'N5',curriculum_boundary_mode:'off'}]};
  if(sql.includes('boundary:edges'))return{rows:[]};
  if(sql.includes('boundary:scope-grammar'))return{rows:[{id,module_id:id,lesson_id:null}]};
  if(sql.includes('boundary:scope-module')||sql.includes('boundary:modules'))return{rows:[{id,course_id:id,sort_order:1,title:'Bab 1'}]};
  if(sql.includes('boundary:scope-lesson')||sql.includes('boundary:lessons'))return{rows:[]};
  if(sql.includes('boundary:vocabulary')||sql.includes('boundary:kanji')||sql.includes('boundary:decks'))return{rows:[]};
  if(sql.includes('boundary:grammar'))return{rows:[grammarRow()]};
  if(sql.includes("curriculum_boundary_auxiliary_terms"))return{rows:[]};
  if(sql.includes('INSERT INTO curriculum_boundary_reports'))return{rows:[]};
  if(sql.includes('SELECT g.example, g.example_dialog, g.module_id'))return{rows:[]};
  if(sql.includes('FROM admin_emails'))return{rows:[]};
  if(sql.startsWith('SELECT 1 WHERE EXISTS'))return{rows:known?[{}]:[]};
  if(sql.includes('SELECT dialog_scene FROM module_grammar'))return{rows:grammarMatches?[{dialog_scene:structuredClone(saved)}]:[]};
  if(sql.startsWith('SELECT name, voice_id FROM dialogue_speakers'))return{rows:profiles};
  if(sql.includes('SELECT alignment FROM tts_cache'))return{rows:cache.has(p[0])?[{alignment:cache.get(p[0])}]:[]};
  if(sql.includes('UPDATE tts_cache'))return{rows:[]};
  if(sql.includes('INSERT INTO tts_cache')){writes.push(p);if(p[7])cache.set(p[0],JSON.parse(p[7]));return{rows:[]};}
  if(sql.includes('SELECT audio, content_type FROM tts_cache'))return{rows:[]};
  if(sql.includes('SELECT * FROM dialogue_speakers'))return{rows:profiles};
  if(sql.includes('SELECT character_key FROM dialogue_speakers'))return{rows:[{character_key:'anna-wijaya'}]};
  if(sql.includes('FROM dialogue_speakers ORDER'))return{rows:profiles};
  if(sql.includes('UPDATE dialogue_speakers SET default_display_name')){Object.assign(profiles[0],{default_display_name:p[1],voice_id:p[2],voice_name:p[3],profile_version:profiles[0].profile_version+1});return{rows:profiles};}
  if(sql.includes('SELECT * FROM module_grammar WHERE id='))return{rows:[grammarRow()]};
  if(sql.includes('INSERT INTO module_grammar')){saved=JSON.parse(p[9]);savedFurigana=p[10]?JSON.parse(p[10]):null;savedGoal=p[11];savedPattern=p[2];savedMeaning=p[3];return{rows:[grammarRow()]};}
  if(sql.includes('UPDATE module_grammar SET')){if(p[17])saved=p[18]?JSON.parse(p[18]):null;if(p[19])savedFurigana=p[20]?JSON.parse(p[20]):null;if(p[12])savedMeaning=p[3];if(p[21])savedGoal=p[22];return{rows:[grammarRow()]};}
  throw Error('Unexpected query: '+sql);
};
mock.method(db,'query',fakeQuery);
mock.method(db,'connect',async()=>({query:fakeQuery,release(){}}));
const realFetch=globalThis.fetch;
mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).startsWith('https://api.elevenlabs.io/')){
    upstream.push(String(url));
    if(String(url).endsWith('/voices'))return new Response(JSON.stringify({voices:available.map(voice_id=>({voice_id,name:voice_id+' label'}))}),{headers:{'Content-Type':'application/json'}});
    return new Response(Buffer.from('fixture-audio'),{headers:{'Content-Type':'audio/mpeg'}});
  }
  return realFetch(url,options);
});
const token=await signAccessToken(id,'scene-admin@example.invalid');
const app=express();app.set('trust proxy',1);app.use(express.json());app.use('/api/admin',admin);app.use('/api',tts);
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'test error'});});
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;let count=1;
async function request(url,{method='GET',body,auth=true}={}){
  const r=await fetch(base+url,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json','X-Forwarded-For':'192.0.2.'+(count++)},body:body===undefined?undefined:JSON.stringify(body)});
  return{status:r.status,body:r.headers.get('Content-Type')?.includes('application/json')?await r.json():await r.text()};
}
const dialog=()=>request('/api/tts/dialog?grammarId='+id+'&text='+encodeURIComponent(text));
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));mock.restoreAll();await db.end();});

test('scene/profile writes require admin authentication',async()=>{
  assert.equal((await request('/api/admin/dialogue-speakers/'+id,{method:'PUT',auth:false,body:{displayName:'Changed'}})).status,401);
  assert.equal((await request('/api/admin/module-grammar/'+id,{method:'PUT',auth:false,body:{dialogScene:fixture()}})).status,401);
});
test('grammar round trip: additive update preserves omitted scene and explicit null clears it',async()=>{
  saved=null;
  let r=await request('/api/admin/module-grammar',{method:'POST',body:{moduleId:id,pattern:'test',dialogScene:fixture()}});
  assert.equal(r.status,201);assert.deepEqual(r.body.grammar.dialog_scene,fixture());
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{meaning:'updated'}});assert.deepEqual(r.body.grammar.dialog_scene,fixture());
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{dialogScene:null}});assert.equal(r.body.grammar.dialog_scene,null);
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{dialogScene:{...fixture(),backgroundKey:'https://evil.test'}}});assert.equal(r.status,400);
  saved=fixture();
});
test('reusable profile uses real provider voice and cannot rename/delete official identity',async()=>{
  const savedSceneBefore=structuredClone(saved);
  let r=await request('/api/admin/dialogue-speakers/'+id,{method:'PUT',body:{name:'hacked',displayName:'Anna Baru',voiceId:'missing'}});assert.equal(r.status,400);
  r=await request('/api/admin/dialogue-speakers/'+id,{method:'PUT',body:{name:'hacked',displayName:'Anna Baru',voiceId:'hadi-voice'}});assert.equal(r.status,200);
  assert.equal(r.body.speaker.name,'Anna Wijaya');assert.equal(r.body.speaker.profile_version,2);
  assert.deepEqual(saved,savedSceneBefore,'profile defaults must not rewrite the learner-visible scene snapshot');
  assert.equal(saved.participants[0].voiceId,'anna-voice');
  assert.equal((await request('/api/admin/dialogue-speakers/'+id,{method:'DELETE'})).status,409);
});
test('student generation uses snapshot voice, cache changes when voice changes, provider availability enforced',async()=>{
  saved=fixture();cache.clear();upstream=[];writes=[];
  let r=await dialog();assert.equal(r.status,200);assert.equal(r.body.segments.length,2);
  assert.ok(upstream.some(u=>u.includes('/text-to-speech/anna-voice')));
  const firstKey=writes.at(-1)[0],before=upstream.length;
  assert.equal((await dialog()).status,200);assert.equal(upstream.length,before);
  saved.participants[0].voiceId='hadi-voice';r=await dialog();assert.equal(r.status,200);assert.notEqual(writes.at(-1)[0],firstKey);
  saved.participants[0].voiceId='removed-voice';r=await dialog();assert.equal(r.status,502);
  saved.participants[0].voiceId=null;r=await dialog();assert.equal(r.status,422);
  saved=fixture();
});
test('mismatched saved text rejects stale requests instead of voicing a different dialog',async()=>{
  grammarMatches=false;assert.equal((await dialog()).status,409);grammarMatches=true;
  known=false;assert.equal((await dialog()).status,403);known=true;
});
test('admin preview honors custom snapshot and refuses missing voice',async()=>{
  upstream=[];
  const r=await request('/api/admin/tts/preview',{method:'POST',body:{text:'A: こんにちは。',dialogScene:fixture()}});
  assert.equal(r.status,200);assert.ok(upstream.some(u=>u.includes('/text-to-speech/anna-voice')));
  const s=fixture();s.participants[0].voiceId=null;
  assert.equal((await request('/api/admin/tts/preview',{method:'POST',body:{text:'A: こんにちは。',dialogScene:s}})).status,400);
});
test('furigana persists independently, rejects unsafe readings, preserves omissions and supports clearing',async()=>{
  const furigana={schemaVersion:1,lines:[{speaker:'A',text:'今日',readings:[{start:0,end:2,reading:'きょう'}]}]};
  let r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{dialogFurigana:furigana}});
  assert.equal(r.status,200);assert.deepEqual(r.body.grammar.dialog_furigana,furigana);
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{meaning:'new meaning'}});
  assert.deepEqual(r.body.grammar.dialog_furigana,furigana);
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{dialogFurigana:{schemaVersion:1,lines:[{...furigana.lines[0],readings:[{start:0,end:2,reading:'<script>'}]}]}}});
  assert.equal(r.status,400);
  r=await request('/api/admin/module-grammar/'+id,{method:'PUT',body:{dialogFurigana:null}});assert.equal(r.body.grammar.dialog_furigana,null);
});
