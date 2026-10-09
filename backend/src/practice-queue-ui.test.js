import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../practice-queue.js', import.meta.url), 'utf8');
const payload = {itemType:'kana',itemId:'kana-1',skill:'k2r',isCorrect:true,source:'lesson_drill',lessonId:'lesson-1'};
const response = (status = 201, body = {ok:true}) => ({ok:status >= 200 && status < 300,status,json:async()=>body});
const deferred = () => { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; };
function storage() {
  const data = new Map();
  return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,
    getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
let serial=0;
function harness(store, send, initialUser='a') {
  const context=vm.createContext({module:{exports:{}},setTimeout,clearTimeout});vm.runInContext(source,context);
  let user=initialUser,clock=100; const statuses=[],timers=new Map();let timerId=0;
  const queue=context.module.exports.create({storage:store,getUserId:()=>user,send,
    uuid:()=>`event-${++serial}`,onStatus:s=>statuses.push(s),now:()=>clock,
    schedule:fn=>{timers.set(++timerId,fn);return timerId;},cancel:id=>timers.delete(id)});
  return {queue,statuses,setUser:value=>{user=value;},setTime:value=>{clock=value;},timers};
}

test('practice queue persists before transport, checks HTTP status and replays the same event after reload',async()=>{
  const store=storage();const sent=[];
  const first=harness(store,async(p,u)=>{assert.equal(store.length,1);sent.push({p,u});return response(503,{error:'unavailable'});});
  const eventId=first.queue.enqueue(payload);await first.queue.flush();
  assert.equal(first.queue.pending(),1);assert.equal(first.statuses.at(-1).error,'unavailable');
  const reloaded=harness(store,async(p,u)=>{sent.push({p,u});return response();});
  await reloaded.queue.flush();assert.equal(store.length,0);
  assert.equal(sent.length,2);assert.equal(sent[0].p.eventId,eventId);assert.equal(sent[1].p.eventId,eventId);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])),JSON.parse(JSON.stringify(sent[1])));
});

test('network or unreadable acknowledgement retains evidence and retry does not invent a new event',async()=>{
  for(const fail of [async()=>{throw Error('offline');},async()=>({ok:true,status:201,json:async()=>{throw Error('response lost');}})]) {
    const store=storage(),first=harness(store,fail);const id=first.queue.enqueue(payload);await first.queue.flush();
    let retried;const next=harness(store,async p=>{retried=p.eventId;return response();});
    await next.queue.flush();assert.equal(retried,id);assert.equal(store.length,0);
  }
});

test('account B never sends account A events, including a switch while an acknowledgement is pending',async()=>{
  const store=storage(),gate=deferred(),sent=[];
  const tab=harness(store,async(p,u)=>{sent.push({id:p.eventId,user:u});return gate.promise;});
  const aId=tab.queue.enqueue(payload);tab.setUser('b');gate.resolve(response());await tab.queue.flush();
  assert.equal(store.length,1,'A receipt was not consumed by B');assert.equal(tab.queue.pending(),0);
  const b=harness(store,async(p,u)=>{sent.push({id:p.eventId,user:u});return response();},'b');
  await b.queue.flush();assert.equal(sent.length,1);
  const bId=b.queue.enqueue(payload);await b.queue.flush();assert.equal(store.length,1);
  const a=harness(store,async(p,u)=>{sent.push({id:p.eventId,user:u});return response();});
  await a.queue.flush();assert.equal(store.length,0);
  assert.deepEqual(sent,[{id:aId,user:'a'},{id:bId,user:'b'},{id:aId,user:'a'}]);
  a.setUser(null);assert.equal(a.queue.enqueue(payload),false);assert.equal(store.length,0);
});

test('two tabs cannot overwrite each other pending events and duplicate sends keep stable IDs',async()=>{
  const store=storage(),gate=deferred(),requests=[];
  const send=async p=>{requests.push(p.eventId);return gate.promise;};
  const a=harness(store,send),b=harness(store,send);
  const aId=a.queue.enqueue(payload),bId=b.queue.enqueue({...payload,isCorrect:false});
  assert.equal(store.length,2);assert.equal(new Set([...store.data.values()].map(s=>JSON.parse(s).payload.eventId)).size,2);
  gate.resolve(response());await Promise.all([a.queue.flush(),b.queue.flush()]);
  assert.equal(store.length,0);assert.ok(requests.includes(aId)&&requests.includes(bId));
  assert.equal(new Set(requests).size,2);
});

test('storage failure is reported and pending memory fallback survives until acknowledged',async()=>{
  const store=storage();const original=store.setItem;store.setItem=()=>{throw Error('quota');};
  const first=harness(store,async()=>response(500,{error:'offline'}));first.queue.enqueue(payload);await first.queue.flush();
  assert.equal(first.queue.pending(),1);assert.equal(first.statuses.at(-1).durable,false);
  store.setItem=original;await first.queue.flush();assert.equal(store.length,1);
  assert.equal(first.statuses.at(-1).durable,true);
});

test('acknowledgement clears memory fallback even when storage removal also throws',async()=>{
  const store=storage();store.setItem=store.removeItem=()=>{throw Error('SecurityError');};
  const tab=harness(store,async()=>response());tab.queue.enqueue(payload);await tab.queue.flush();
  assert.equal(tab.queue.pending(),0);assert.equal(tab.statuses.at(-1).pending,0);
});

test('invalid event is retained for inspection without blocking another valid answer',async()=>{
  const store=storage(),gate=deferred();let calls=0;
  const tab=harness(store,async p=>{calls++;if(p.isCorrect)return gate.promise;return response();});
  tab.queue.enqueue(payload);tab.queue.enqueue({...payload,isCorrect:false});
  gate.resolve(response(400,{error:'invalid_item_id'}));await tab.queue.flush();
  assert.equal(store.length,1);assert.equal(calls,2);assert.equal(tab.statuses.at(-1).blocked,1);
  await tab.queue.flush();assert.equal(calls,2);
});

test('denied course backs off its event while eligible answers continue and later entitlement recovers',async()=>{
  const store=storage(),gate=deferred();let denied=true;const sent=[];
  const tab=harness(store,async p=>{sent.push(p.eventId);if(p.isCorrect && denied)return gate.promise;return response();});
  const deniedId=tab.queue.enqueue(payload),validId=tab.queue.enqueue({...payload,isCorrect:false});
  gate.resolve(response(403,{error:'not_enrolled'}));await tab.queue.flush();
  assert.deepEqual(sent,[deniedId,validId]);assert.equal(store.length,1);
  assert.equal(tab.statuses.at(-1).error,'not_enrolled');assert.equal(tab.timers.size,1);
  await tab.queue.flush();assert.equal(sent.length,2);
  denied=false;tab.setTime(60100);await tab.queue.flush();
  assert.deepEqual(sent,[deniedId,validId,deniedId]);assert.equal(store.length,0);
});

test('browser bootstrap survives disabled localStorage and memory-only answers can be acknowledged',async()=>{
  const sent=[],statuses=[],listeners=new Map();let offline=true;
  const sandbox={document:{addEventListener(){},visibilityState:'visible'},setTimeout:()=>1,clearTimeout(){},
    get localStorage(){throw Error('SecurityError');},crypto:{randomUUID:()=> 'browser-event'},
    ezGetAuthenticatedUserId:()=> 'a',ezApi:async(path,options)=>{sent.push({path,options});if(offline)throw Error('offline');return response();},
    addEventListener:(event,handler)=>listeners.set(event,handler),dispatchEvent:event=>statuses.push(event.detail),
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}};
  const context=vm.createContext(sandbox);vm.runInContext(source,context);
  await context.EzPracticeQueue.flush();
  context.EzPracticeQueue.enqueue(payload);await context.EzPracticeQueue.flush();
  assert.equal(context.EzPracticeQueue.pending(),1);assert.equal(statuses.at(-1).durable,false);
  offline=false;await context.EzPracticeQueue.flush();
  assert.equal(context.EzPracticeQueue.pending(),0);assert.equal(sent[0].options.expectedUserId,'a');
  assert.equal(JSON.parse(sent[0].options.body).eventId,JSON.parse(sent[1].options.body).eventId);
  assert.ok(listeners.has('ez:auth-changed'));
});

test('lesson answers route through the durable queue and authenticated transport pins owner',()=>{
  const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
  const body=html.slice(html.indexOf('function _recordPracticeAttempt('),html.indexOf('// Gate "Tandai Selesai"'));
  assert.match(body,/EzPracticeQueue\.enqueue/);assert.doesNotMatch(body,/\.catch\(\(\) => \{\}\)/);
  assert.ok(html.indexOf('api-client.js')<html.indexOf('practice-queue.js'));
  assert.match(source,/expectedUserId: userId/);assert.match(source,/ezGetAuthenticatedUserId/);
});
