import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

test('N4 grammar lesson without a Percakapan still displays its scene and optional checks inline',()=>{
 const start=html.indexOf('function renderLessonGrammar(lesson) {'),end=html.indexOf('// ── Dialog player',start);
 const calls=[];const ctx=vm.createContext({escapeHtml,AUDIO_SVG:'',grammarKaraokeHtml:(...args)=>{calls.push(args);return '<div class="scene-player"></div>';}});
 vm.runInContext(html.slice(start,end),ctx);
 const grammar={id:'existing',pattern:'fixed pattern',notes:'Usage',example_dialog:'A: はい。',example_dialog_id:'A: Ya.',communication_goal:'A & B <context>',dialogueSelfChecks:[{prompt:'Siapa?',answer:'A < B',explanation:'Evidence'}]};
 const out=ctx.renderLessonGrammar({grammar:[grammar]});
 assert.equal(calls.length,1);assert.equal(calls[0][4],'existing');assert.match(out,/fixed pattern/);
 assert.match(out,/scene-player/);assert.match(out,/A &amp; B &lt;context&gt;/);assert.match(out,/<details><summary[^>]*>Lihat jawaban/);
 assert.match(out,/A &lt; B/);assert.doesNotMatch(out,/markComplete|selectLesson/);
 const legacy=ctx.renderLessonGrammar({grammar:[{...grammar,dialogueSelfChecks:undefined}]});assert.doesNotMatch(legacy,/scene-player/);
});

// Migration 191: N4 dialogues move to their own Percakapan lesson, as in N5.
test('N4 grammar lesson with a Percakapan leaves the dialogue and checks to that lesson',()=>{
 const start=html.indexOf('function renderLessonGrammar(lesson) {'),end=html.indexOf('// ── Dialog player',start);
 const calls=[];const root={innerHTML:''};const mounts=[];
 const ctx=vm.createContext({escapeHtml,AUDIO_SVG:'',document:{getElementById:()=>root},learningStepAction:()=>'',
  window:{EzDialogue:{enhance(){}},EzDialogueQuestions:{mount:value=>mounts.push(value)}},
  grammarKaraokeHtml:(...args)=>{calls.push(args);return '<div class="scene-player"></div>';}});
 vm.runInContext(html.slice(start,end),ctx);
 vm.runInContext(html.slice(html.indexOf('// ── Learning sequence'),html.indexOf('// ── End learning sequence')),ctx);
 ctx.visibleLessons=module=>module.lessons;
 const grammar={id:'g1',pattern:'fixed pattern',notes:'Usage',example_dialog:'A: はい。',example_dialog_id:'A: Ya.',communication_goal:'Tujuan',dialogueSelfChecks:[{prompt:'Siapa <A>?',answer:'Hadi',explanation:'Bukti'}]};
 const source={id:'tata-bahasa-1',apiId:'src',type:'video',title:'Tata Bahasa: X',grammar:[grammar],hasConversation:true};
 const conversation={id:'tata-bahasa-1-percakapan',apiId:'conv',type:'conversation',title:'Percakapan: X',conversationSourceLessonId:'src'};
 const out=ctx.renderLessonGrammar(source);
 assert.match(out,/fixed pattern/);assert.match(out,/Usage/);
 assert.equal(calls.length,0);assert.doesNotMatch(out,/scene-player|Lihat jawaban|Siapa/);
 ctx.renderConversationLesson({name:'N4'},{id:'b1',num:'01',title:'Bab 1',lessons:[source,conversation]},conversation,{prev:null,next:null,isDone:false});
 assert.equal(calls.length,1);assert.equal(calls[0][4],'g1');
 assert.match(root.innerHTML,/Siapa &lt;A&gt;\?/);assert.match(root.innerHTML,/<details><summary[^>]*>Lihat jawaban/);
 assert.ok(root.innerHTML.indexOf('scene-player')<root.innerHTML.indexOf('Siapa'),'checks follow their dialogue');
 assert.equal(mounts[0].lesson,source,'dialogue questions stay keyed to the grammar source');
});

test('course transform marks only grammar lessons that own a Percakapan',()=>{
 const start=html.indexOf('function transformCourseFromApi(apiCourse) {'),end=html.indexOf('const QUIZ_CATEGORY_META',start);
 const ctx=vm.createContext({splitJpFromContent:()=>({body:'',jp:''})});
 vm.runInContext(html.slice(start,end),ctx);
 const course=ctx.transformCourseFromApi({slug:'n4',modules:[{slug:'b1',lessons:[
  {id:'a',slug:'tata-bahasa-1',type:'video'},{id:'b',slug:'tata-bahasa-1-percakapan',type:'conversation',conversation_source_lesson_id:'a'},
  {id:'c',slug:'tata-bahasa-2',type:'video'}]}]});
 assert.deepEqual(course.modules[0].lessons.map(l=>l.hasConversation),[true,false,false]);
});

test('worksheet opens all current chapter tasks, escapes content and returns through the normal lesson renderer',()=>{
 const start=html.indexOf('window.openChapterWorksheet ='),end=html.indexOf('function renderLessonMaterials(',start);
 const root={innerHTML:''};let renders=0,stopped=0;
 const module={id:'m',title:'Bab <1>',lessons:[{type:'video',grammar:[{id:'g',pattern:'P',notes:'N',examples:[{japanese:'はい。',indonesian:'Ya.'}]}]},{type:'grammar_task',grammarTask:[{id:'g',instruction:'Untuk jawaban di situs, pilih satu konteks.\n\nTugas <contoh>'}]}]};
 const ctx=vm.createContext({window:{scrollTo(){}},document:{getElementById:()=>root},currentState:{course:'n4',moduleId:'m',view:'intro'},COURSE_CONTENT:{n4:{modules:[module]}},prepareMobileSidebarContentFocus:()=>()=>{},closeSidebar(){},escapeHtml,gkStopAll(){stopped++;},_stopAllTts(){stopped++;},destroyYoutubeSegmentPlayer(){stopped++;},renderLesson:()=>{renders++;root.innerHTML='intro';}});
 vm.runInContext(html.slice(start,end),ctx);ctx.window.openChapterWorksheet();
 assert.match(root.innerHTML,/Tugas &lt;contoh&gt;/);assert.doesNotMatch(root.innerHTML,/Untuk jawaban di situs/);assert.match(root.innerHTML,/window.print/);
 assert.equal(stopped,3);assert.equal(ctx.window.__quizNavigationEpoch,1);
 ctx.window.closeChapterWorksheet();assert.equal(renders,1);assert.equal(root.innerHTML,'intro');
});
