import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/company-productivity.js',import.meta.url),'utf8');
const {templatesFor,canCreateFollowUp,followUpDraft,historyLabel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('templates cover non-academic divisions, return independent drafts and never execute work',()=>{
  for(const division of ['technology','marketing','operations','finance']){
    const templates=templatesFor(division,'task');assert.ok(templates.length);
    assert.match(templates[0].description,/Kriteria selesai[\s\S]*- \[ \]/);
    templates[0].title='changed';assert.notEqual(templatesFor(division,'task')[0].title,'changed');
  }
  for(const [division,kind] of [['technology','release'],['marketing','campaign'],['marketing','content']])assert.ok(templatesFor(division,kind).length);
  for(const kind of ['task','case','release','campaign','content'])assert.deepEqual(templatesFor('academic',kind),[]);
  assert.deepEqual(templatesFor('finance','campaign'),[]);
  assert.doesNotMatch(source,/\b(fetch|ezApi|localStorage|sessionStorage)\s*[.(]/);
});

test('Insights follow-up requires separate work scope and leaves Academic unchanged',()=>{
  const access={isAdmin:false,divisions:[{id:'marketing'},{id:'academic'}],scopes:{marketing:['c1'],academic:'global'},insights:{scopes:{marketing:'global'}}};
  assert.equal(canCreateFollowUp(access,'marketing','c1'),true);
  assert.equal(canCreateFollowUp(access,'marketing','c2'),false);
  assert.equal(canCreateFollowUp(access,'finance','c1'),false);
  assert.equal(canCreateFollowUp(access,'academic','c1'),false);
  assert.equal(canCreateFollowUp({...access,isAdmin:true},'academic','c1'),false);
  assert.equal(canCreateFollowUp({...access,scopes:{}},'marketing','c1'),false);
  assert.equal(canCreateFollowUp({...access,isAdmin:true},'marketing','c2'),true);
  assert.equal(canCreateFollowUp(access,'marketing',''),false);
});

test('follow-up copies authorized aggregate values, snapshot and period, never raw student fields or suppressed values',()=>{
  const report={window:{start:'2026-08-31',end:'2026-09-07'},generatedAt:'2026-09-12',activation:{status:'available',percent:50},completion:{status:'insufficient_sample',percent:99},retention:{status:'available',percent:0},dataQuality:{status:'available',percent:67},email:'private@example.invalid',answers:['SECRET'],progress:{note:'PRIVATE'}};
  const draft=followUpDraft({division:'marketing',courseId:'c1',courseTitle:'N5 <uji>',report});
  assert.deepEqual(Object.keys(draft).sort(),['courseId','description','division','title']);
  assert.match(draft.description,/50%/);assert.match(draft.description,/0%/);assert.match(draft.description,/2026-08-31 — 2026-09-07/);
  assert.doesNotMatch(draft.description,/99%|private@|SECRET|PRIVATE/);
  assert.match(followUpDraft({division:'finance',courseId:'c1',courseTitle:'N5',report:{...report,activation:null,completion:null,retention:null,dataQuality:null}}).description,/Bukti belum cukup/);
  assert.equal(historyLabel('transitioned'),'Status diperbarui');assert.equal(historyLabel('<script>'),'Perubahan dicatat');
});
