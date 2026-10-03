// Local interaction preview. Uses the production UI and public question projection;
// persistence is simulated in this browser, with no requests to the live platform.
import fs from 'node:fs';
import path from 'node:path';
import {banks} from '../content/final-exams/index.mjs';
import {createChapterSnapshot,publicChapterQuestions} from '../src/chapter-assessment.js';
const dest=path.resolve(process.argv[2]||'final-exam-student-preview');
fs.mkdirSync(dest,{recursive:true});
const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
function slice(start,end){const i=html.indexOf(start),j=html.indexOf(end,i);if(i<0||j<0)throw Error('Missing UI source '+start);return html.slice(i,j);}
const source=[
 slice('const QUIZ_CATEGORY_META =','async function hydrateEnrolledCourses'),
 slice('function quizLocalDraftKey(', 'function getQuizKey('),
 slice('function renderQuizPassage(', 'window.pickQuizAnswer = async'),
 slice('function updateQuizPaperProgress()', 'window.nextQuizQuestion ='),
 slice('const _SANITIZE_ALLOWED =', 'function formatDurationLong('),
].join('\n');
for(const file of ['final-exam.js','final-exam.css'])fs.copyFileSync(new URL('../../'+file,import.meta.url),path.join(dest,file));
fs.mkdirSync(path.join(dest,'assets'),{recursive:true});
for(const b of banks)for(const q of b.rows.filter(q=>q.image_url))fs.copyFileSync(new URL('../../'+q.image_url.slice(1),import.meta.url),path.join(dest,'assets',path.basename(q.image_url)));
const packets=Object.fromEntries(banks.map(bank=>[bank.level,{version:bank.version,lesson:bank.lessonId,questions:publicChapterQuestions(createChapterSnapshot(bank.policy,bank.rows)).map(q=>({...q,...(q.image_url?{image_url:'assets/'+path.basename(q.image_url)}:{})}))}]));
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync(path.join(dest,'student-preview.html'),`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pratinjau Final Exam — EzNihongo</title><style>${css}</style><link rel="stylesheet" href="final-exam.css"><style>body{display:block;margin:0;background:#f6f8fa;height:auto;overflow:auto}.demo-bar{padding:12px 24px;background:#fff;border-bottom:1px solid #dce4ec;font:12px/1.6 system-ui;color:#526174;display:flex;gap:18px;flex-wrap:wrap}.demo-bar a{color:#a72a36;font-weight:700}#main-content{margin:0 auto;max-width:1200px;padding:28px 24px;height:auto;overflow:visible}@media(max-width:600px){#main-content{padding:20px 12px}.demo-bar{padding:10px 12px}}</style>
<div class="demo-bar"><span>Pratinjau interaksi · simpan di browser ini · audio dan penilaian memerlukan aplikasi.</span><a href="?level=n5">N5</a><a href="?level=n4">N4</a><label><input id="demo-offline" type="checkbox"> Simulasi gagal menyimpan</label></div><main id="main-content"></main><script src="final-exam.js"></script><script>
const packets=${JSON.stringify(packets).replaceAll('<','\\u003c')};
const session={id:'preview'},QUIZ_DATA={};let quizState;
window.__quizNavigationEpoch=1;
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
${source}
window.ezApi=async(url,options={})=>{
 if(url.includes('/audio/'))return {ok:false,status:503};
 if(document.getElementById('demo-offline').checked)throw Error('preview offline');
 const body=JSON.parse(options.body),key='ez_preview_server:'+body.attemptToken;
 const existing=JSON.parse(localStorage.getItem(key)||'{"revision":0,"answers":[]}');
 if(existing.revision!==body.revision)return {ok:false,json:async()=>({error:'draft_conflict'})};
 const saved={revision:body.revision+1,answers:body.answers};localStorage.setItem(key,JSON.stringify(saved));
 return {ok:true,json:async()=>({revision:saved.revision})};
};
async function finishQuiz(){
 if(EzFinalExam.summary(quizState).missing.length)return;
 await saveChapterDraft(quizState);if(quizState.draftConflict||quizState.draftDirty)return;
 destroyAllListeningPlayers();document.getElementById('main-content').innerHTML='<div class="final-exam"><h1>Pratinjau selesai</h1><p>Semua jawaban telah diisi. Ini hanya pratinjau interaksi; hasil resmi dihitung oleh server EzNihongo.</p><a href="?level='+level+'">Kembali ke pratinjau</a></div>';
}
const level=new URLSearchParams(location.search).get('level')==='n4'?'n4':'n5',packet=packets[level];
const attemptToken='preview-'+packet.version;
let saved;try{saved=JSON.parse(localStorage.getItem('ez_preview_server:'+attemptToken)||'null');}catch{}
quizState={key:level+':final:exam',assessmentVersion:packet.version,questions:packet.questions.map(transformQuestionFromApi),answers:[],answeredByIndex:{},selectedByIndex:{},finalFlags:{},deferFeedback:true,draftEnabled:true,draftRevision:saved?.revision||0,lessonApiId:packet.lesson,attemptToken,viewEpoch:1,draftStatus:'Jawaban tersimpan otomatis setelah diisi.'};
for(const answer of recoverQuizLocalDraft(quizState,saved?.answers||[])){
 const i=quizState.questions.findIndex(q=>q.questionId===answer.questionId);if(i<0)continue;
 const selected=quizState.questions[i].optionIds.indexOf(answer.optionId);if(selected<0)continue;
 quizState.answers.push(answer);quizState.answeredByIndex[i]=true;quizState.selectedByIndex[i]=selected;
}
renderQuizQuestion(document.getElementById('main-content'));if(quizState.draftDirty)scheduleChapterDraft(quizState);
</script></html>`);
console.log(path.join(dest,'student-preview.html'));
