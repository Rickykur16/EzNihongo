import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

test('N4 existing grammar lesson displays its scene and optional checks without moving the lesson',()=>{
 const start=html.indexOf('function renderLessonGrammar(lesson) {'),end=html.indexOf('// A Percakapan lesson',start);
 const calls=[];const ctx=vm.createContext({escapeHtml,AUDIO_SVG:'',grammarKaraokeHtml:(...args)=>{calls.push(args);return '<div class="scene-player"></div>';}});
 vm.runInContext(html.slice(start,end),ctx);
 const grammar={id:'existing',pattern:'fixed pattern',notes:'Usage',example_dialog:'A: はい。',example_dialog_id:'A: Ya.',communication_goal:'A & B <context>',dialogueSelfChecks:[{prompt:'Siapa?',answer:'A < B',explanation:'Evidence'}]};
 const out=ctx.renderLessonGrammar({grammar:[grammar]});
 assert.equal(calls.length,1);assert.equal(calls[0][4],'existing');assert.match(out,/fixed pattern/);
 assert.match(out,/scene-player/);assert.match(out,/A &amp; B &lt;context&gt;/);assert.match(out,/<details><summary[^>]*>Lihat jawaban/);
 assert.match(out,/A &lt; B/);assert.doesNotMatch(out,/markComplete|selectLesson/);
 const legacy=ctx.renderLessonGrammar({grammar:[{...grammar,dialogueSelfChecks:undefined}]});assert.doesNotMatch(legacy,/scene-player/);
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
