import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cards} from '../content/bunpou/completeness.mjs';
import {buildMigration} from '../scripts/build-bunpou-completeness.mjs';
import {normalizeDialogScene,sceneTurnVoices} from './dialogue-scene.js';
import {contentRevisionId} from './bunpou-flow-service.js';
import {randomUUID} from 'node:crypto';

const plan=JSON.parse(fs.readFileSync(new URL('../scripts/n5-bunpou-canva-plan.json',import.meta.url)));
const sql=buildMigration();
test('all 97 Canva-aligned teaching cards have specific explanations and translated dialogue',()=>{
 assert.equal(cards.length,97);
 assert.equal(new Set(cards.map(c=>c.lesson)).size,36);
 assert.deepEqual(cards.map(c=>[c.bab,c.lesson,c.pattern]),plan.flatMap(ch=>ch.parts.flatMap(p=>p.patterns.map(pattern=>[ch.bab,p.slug,pattern]))));
 for(const card of cards){
   assert.ok(card.notes.length>=110,card.pattern);
   const ja=card.dialog.split('\n'),id=card.translation.split('\n');
   assert.equal(ja.length,id.length,card.pattern);
   assert.ok(ja.length>=2 && ja.length<=6);
   for(let i=0;i<ja.length;i++){
     assert.match(ja[i],/^[AB]: [^|]+[。？！？]$/u);
     assert.match(id[i],/^[AB]: [^|]+/u);
     assert.equal(ja[i].slice(0,2),id[i].slice(0,2));
   }
   for(const ex of card.addExamples){
     assert.ok(ex.indonesian && ex.highlight && ex.japanese.includes(ex.highlight),card.pattern);
   }
   for(const [,ja,highlight,meaning] of card.replaceExamples||[]){
     assert.ok(meaning && highlight && ja.includes(highlight));
   }
 }
 assert.doesNotMatch(JSON.stringify(cards.filter(c=>c.bab===4)),/だれの/);
 assert.match(cards.find(c=>c.pattern==='〜ないでください').notes,/ない UTUH/);
 assert.doesNotMatch(cards.filter(c=>c.bab<12).map(c=>c.dialog).join('\n'),/しまいました|行きましょう|いきましょう/);
 assert.equal(fs.readFileSync(new URL('../migrations/176_bunpou_content_completeness.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),sql);
});

let PGlite;
try { ({PGlite}=await import(process.env.TEST_PGLITE_URL || '@electric-sql/pglite')); } catch {}
async function fixture(){
 let db;
 if(process.env.TEST_DATABASE_URL){
   const {default:pg}=await import('pg');
   const client=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
   await client.connect();
   const schema='bunpou_content_'+randomUUID().replaceAll('-','');
   await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema},public;`);
   db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:async()=>{
     await client.query(`ROLLBACK; DROP SCHEMA ${schema} CASCADE;`); await client.end();
   }};
 } else db=new PGlite();
 await db.exec(`CREATE TABLE courses(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),slug TEXT);
 CREATE TABLE modules(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),course_id UUID,slug TEXT);
 CREATE TABLE lessons(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),module_id UUID,slug TEXT,title TEXT);
 CREATE TABLE module_grammar(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),module_id UUID,lesson_id UUID,pattern TEXT,meaning TEXT,
   example TEXT,notes TEXT,example_dialog TEXT,example_dialog_id TEXT,dialog_scene JSONB,dialog_furigana JSONB,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE grammar_examples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),grammar_id UUID,japanese TEXT,highlight TEXT,indonesian TEXT,sort_order INT,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE dialogue_speakers(character_key TEXT,default_display_name TEXT,voice_id TEXT,voice_name TEXT,profile_version INT);
 INSERT INTO dialogue_speakers VALUES('anna-wijaya','アンナ','voiceAnna','Anna',2),('hadi-pratama','ハディ','voiceHadi','Hadi',1);
 INSERT INTO courses(slug) VALUES('n5');`);
 for(const ch of plan){
   const mid=(await db.query('INSERT INTO modules(course_id,slug) SELECT id,$1 FROM courses RETURNING id',[`n5-b${ch.bab}`])).rows[0].id;
   for(const part of ch.parts){
     const lid=(await db.query('INSERT INTO lessons(module_id,slug,title) VALUES($1,$2,$3) RETURNING id',[mid,part.slug,'Preserve title'])).rows[0].id;
     for(const pattern of part.patterns){
       const card=cards.find(c=>c.lesson===part.slug && c.pattern===pattern);
       const gid=(await db.query(`INSERT INTO module_grammar(module_id,lesson_id,pattern,meaning,notes,example_dialog,example_dialog_id)
         VALUES($1,$2,$3,'Existing meaning','Existing notes',$4,$5) RETURNING id`,[mid,lid,pattern,ch.bab===3?'A: はじめまして。\nB: はじめまして。':null,ch.bab===3?'A: Salam kenal.\nB: Salam kenal.':null])).rows[0].id;
       if(!([5,7].includes(ch.bab) && card.addExamples.length)) await db.query(`INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order) VALUES($1,'ほんです。','です','Ini buku.',0)`,[gid]);
       for(const [old] of card.replaceExamples||[])await db.query(`INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order) VALUES($1,$2,'old','Old translation',1)`,[gid,old]);
     }
   }
 }
 return db;
}
test('migration fills gaps, preserves custom voices, titles, IDs, good content and Bab 3 fingerprints; rerun retains later edits',{skip:!PGlite&&!process.env.TEST_DATABASE_URL},async()=>{
 const db=await fixture();
 try{
   const get=async(pattern)=> (await db.query('SELECT * FROM module_grammar WHERE pattern=$1 ORDER BY id',[pattern])).rows[0];
   const bab3=(await db.query(`SELECT g.* FROM module_grammar g JOIN lessons l ON l.id=g.lesson_id WHERE l.slug IN ('bunpou-n5-b3','bunpou2-n5-b3') ORDER BY g.id`)).rows;
   const before=contentRevisionId(bab3,bab3);
   const custom={schemaVersion:1,enabled:true,backgroundKey:'cafe',participants:[
     {characterKey:'anna-wijaya',position:'left',speaker:'店員',displayName:'店員',voiceId:'customSeller',voiceName:'Seller',profileVersion:4,custom:true},
     {characterKey:'hadi-pratama',position:'right',speaker:'客',displayName:'客',voiceId:'customGuest',voiceName:'Guest',profileVersion:6,custom:true}]};
   const time=await get('今〜時〜分です');
   await db.query(`UPDATE module_grammar SET example_dialog='店員: 古い。',example_dialog_id='店員: Lama.',dialog_scene=$1,dialog_furigana='{"old":true}' WHERE id=$2`,[custom,time.id]);
   await db.exec(`BEGIN;${sql}COMMIT;`);
   assert.equal((await db.query('SELECT * FROM n5_bunpou_content_backup_176')).rows.length,97);
   const all=(await db.query('SELECT * FROM module_grammar')).rows;
   assert.ok(all.every(c=>c.notes && c.example_dialog && c.example_dialog_id));
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM module_grammar g WHERE NOT EXISTS(SELECT 1 FROM grammar_examples e WHERE e.grammar_id=g.id)`)).rows[0].n,0);
   const revised=await get('今〜時〜分です');
   assert.deepEqual(revised.dialog_scene,custom);
   assert.match(revised.example_dialog,/^店員: いま、なんじですか。\n客: さんじはんです。$/u);
   assert.equal(revised.dialog_furigana,null);
   assert.deepEqual(sceneTurnVoices([{speaker:'店員'},{speaker:'客'}],normalizeDialogScene(revised.dialog_scene),()=>null).map(v=>v.voiceId),['customSeller','customGuest']);
   const newScene=(await get('〜ないでください')).dialog_scene;
   assert.deepEqual(newScene.participants.map(p=>p.voiceId),['voiceAnna','voiceHadi']);
   const after3=(await db.query(`SELECT g.* FROM module_grammar g JOIN lessons l ON l.id=g.lesson_id WHERE l.slug IN ('bunpou-n5-b3','bunpou2-n5-b3') ORDER BY g.id`)).rows;
   assert.equal(contentRevisionId(after3,after3),before);
   assert.equal((await db.query(`SELECT count(*)::int n FROM lessons WHERE title<>'Preserve title'`)).rows[0].n,0);
   const wrong=(await db.query(`SELECT * FROM grammar_examples WHERE japanese LIKE '%しまいました%'`)).rows;
   assert.equal(wrong.length,0);
   const ids=all.map(g=>g.id).sort();
   await db.query(`UPDATE module_grammar SET notes='Teacher edit after rollout' WHERE id=$1`,[time.id]);
   await db.exec(sql);
   assert.equal((await get('今〜時〜分です')).notes,'Teacher edit after rollout');
   assert.deepEqual((await db.query('SELECT id FROM module_grammar')).rows.map(g=>g.id).sort(),ids);
 }finally{await db.close();}
});
test('missing teaching card rolls back the whole revision, not a partially updated chapter',{skip:!PGlite&&!process.env.TEST_DATABASE_URL},async()=>{
 const db=await fixture();
 try{
   await db.exec(`DELETE FROM module_grammar WHERE pattern='〜たことがありません'; BEGIN;`);
   await assert.rejects(db.exec(sql),/missing\/ambiguous teaching card/);
   await db.exec('ROLLBACK;');
   assert.equal((await db.query(`SELECT count(*)::int n FROM module_grammar WHERE notes<>'Existing notes'`)).rows[0].n,0);
 }finally{await db.close();}
});
