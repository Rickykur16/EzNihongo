import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET='local-no-xp-test-access';
process.env.JWT_REFRESH_SECRET='local-no-xp-test-refresh';
const {db}=await import('./db.js');
const {signAccessToken}=await import('./auth.js');
const {default:router}=await import('./routes/progress.js');

test('stats API retains study counters, streak and daily goal without XP/level',async()=>{
  let empty=false;
  const history={streak_days:4,last_active_date:'2026-10-13',total_lessons_completed:12,total_minutes_learned:80};
  const spy=mock.method(db,'query',async(sql,params)=>{
    assert.equal(params[0],'student-no-xp');
    if(sql.includes('FROM user_stats')){
      assert.doesNotMatch(sql,/\bxp\b|\blevel\b/);
      return {rows:empty?[]:[history]};
    }
    if(sql.includes('FROM user_progress up'))return {rows:[{minutes_today:empty?0:7,lessons_today:empty?0:1}]};
    throw new Error('Unexpected query');
  });
  const app=express();app.use(router);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/stats/me`;
  const token=await signAccessToken('student-no-xp','student@example.invalid');
  try{
    for(empty of [false,true]){
      const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
      assert.equal(res.status,200);const {stats}=await res.json();
      assert.equal('xp' in stats,false);assert.equal('level' in stats,false);
      assert.equal(stats.streak_days,empty?0:4);assert.equal(stats.total_lessons_completed,empty?0:12);
      assert.equal(stats.total_minutes_learned,empty?0:80);
      assert.equal(stats.today.goalMet,!empty);assert.equal(stats.today.goalMinutes,10);
    }
  }finally{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));spy.mock.restore();await db.end();
  }
});
