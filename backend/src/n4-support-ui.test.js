import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

test('N4 grammar card no longer embeds the dialogue; the Percakapan lesson shows goal, scene and optional checks',()=>{
 const start=html.indexOf('function renderLessonGrammar(lesson) {'),end=html.indexOf('// A Percakapan lesson',start);
 const ctx=vm.createContext({escapeHtml,AUDIO_SVG:'',grammarKaraokeHtml:()=>{throw Error('grammar card must not render a dialogue');}});
 vm.runInContext(html.slice(start,end),ctx);
 const grammar={id:'existing',pattern:'fixed pattern',notes:'Usage',example_dialog:'A: はい。',example_dialog_id:'A: Ya.',communication_goal:'A & B <context>',dialogueSelfChecks:[{prompt:'Siapa?',answer:'A < B',explanation:'Evidence'}]};
 const card=ctx.renderLessonGrammar({grammar:[grammar]});
 assert.match(card,/fixed pattern/);assert.doesNotMatch(card,/Percakapan|Lihat jawaban/);
 const conv=html.slice(html.indexOf('function renderConversationLesson('),html.indexOf('// ── Dialog player'));
 assert.match(conv,/communication_goal/);assert.match(conv,/conversationSelfChecksHtml\(grammar\)/);assert.match(conv,/<details><summary[^>]*>Lihat jawaban/);assert.match(conv,/escapeHtml\(q\.explanation\)/);
});

test('N4 video-type grammar lessons are presented like N5: no written-lesson relabel',()=>{
 assert.doesNotMatch(html,/n4WrittenLesson/);
 assert.doesNotMatch(html,/currentState\.course === 'n4' && (typeKey|lesson\.type) === 'video'/);
 assert.match(html,/const videoBlock = lesson\.type === 'video' \? renderVideoLessonPlayer\(lesson\) : '';/);
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
