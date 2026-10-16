import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../welcome.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../src/n5-learning-copy.js', import.meta.url), 'utf8');
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
function setup() {
  const ctx = vm.createContext({ escapeHtml: esc, currentState: { course:'n5' } });
  vm.runInContext(source, ctx);
  return ctx;
}
const plain = value => JSON.parse(JSON.stringify(value));
const plan = JSON.parse(readFileSync(new URL('../content/n5-support/grammar-support.json', import.meta.url), 'utf8'));

test('all N5 chapters retain lesson IDs, source grammar, task requirements and content', () => {
  const ctx = setup();
  const modules = Array.from({ length:20 }, (_,i) => {
    const bab=i+1;
    const grammar=plan.chapters.find(c=>c.bab===bab)?.items.map(i=>i.expectedCore) || [];
    return { id:`module-${bab}`, slug:`n5-b${bab}`, title:`BAB ${bab} : Bab ${bab}`, title_en:'Template', description:'Template',
      section_name:'Section 1 : Belajar', lessons:[
        { id:`source-${bab}`,slug:'grammar',type:'video',title:'Bentuk Kata Kerja (ます・ません)',content:'Catatan khusus',grammar },
        { id:`conversation-${bab}`,slug:'conversation',type:'conversation',title:'Percakapan: Bentuk Kata Kerja (ます・ません)',conversation_source_lesson_id:`source-${bab}` },
        { id:`task-${bab}`,slug:'task',type:'grammar_task',title:'Tugas Bunpou 1',popup_after_lesson_id:`source-${bab}`,grammarTask:[{ id:'g1',pattern:'[verb]ます',requiredCount:2,instruction:'Buat dua kalimat.' }] },
      ] };
  });
  const original={slug:'n5',modules};
  const before=JSON.stringify(original);
  const out=ctx.EzN5Copy.prepareCourse(original);
  assert.equal(JSON.stringify(original),before,'Do not mutate CMS input');
  for(let i=0;i<20;i++) {
    const old=original.modules[i], m=out.modules[i];
    assert.equal(m.slug,old.slug); assert.equal(m.id,old.id);
    assert.equal(m.lessons[0].title,'Bentuk Kata Kerja');
    assert.equal(m.lessons[1].title,'Percakapan: Bentuk Kata Kerja');
    assert.equal(m.lessons[2].title,'Latihan: Bentuk Kata Kerja');
    assert.deepEqual(plain(m.lessons[0].grammar),plain(old.lessons[0].grammar));
    assert.deepEqual(plain(m.lessons[2].grammarTask),plain(old.lessons[2].grammarTask));
    assert.equal(m.lessons[0].content,'Catatan khusus');
    assert.ok(m.description.length>40); assert.doesNotMatch(m.description,/Template/);
  }
  const n4={slug:'n4',modules};
  assert.equal(ctx.EzN5Copy.prepareCourse(n4),n4,'Other courses bypass copy adaptation');
});

test('generated introductions lose metadata while authored material is preserved', () => {
  const {EzN5Copy:c}=setup();
  assert.doesNotMatch(c.lessonBody({body:'## Tentang L4 **JF Topic:** Daily Life **⏱ 3 jam**'}, {id:'n5-b4'}),/##|JF|3 jam/);
  assert.match(c.lessonBody({body:'',title:'Apa Itu Hiragana'}, {id:'n5-b1'}),/huruf hiragana/);
  assert.equal(c.lessonBody({body:'Penjelasan baru pengajar.'}, {id:'n5-b4'}),'Penjelasan baru pengajar.');
});

test('counts match visible items and kana instructions explain the current group', () => {
  const {EzN5Copy:c}=setup();
  assert.match(c.intro({body:'3 item'}, {}, 'deck',52),/52 kata/);
  assert.doesNotMatch(c.intro({body:'4 pola'}, {}, 'grammar_task',2),/4 pola/);
  assert.match(c.intro({}, {}, 'grammar_task',2),/2 pola/);
  assert.match(c.intro({sourceTitle:'Dakuon dan Handakuon'}, {},'kana',25),/dakuten.*handakuten/);
  assert.match(c.intro({sourceTitle:'Youon, Sokuon dan Chouon'}, {},'kana',35),/ー/);
});

test('plain Markdown becomes blocks, preserves examples and safely escapes text', () => {
  const {EzN5Copy:c}=setup();
  const out=c.renderBody('## Pola\n\n**Arti:** Buku\n\n- Satu\n- Dua\n\n> この本です。\n\nA & B',esc,()=>assert.fail('Plain text must not invoke HTML sanitizer'));
  assert.match(out,/<h3>Pola<\/h3>/); assert.match(out,/<strong>Arti:<\/strong>/);
  assert.match(out,/<ul><li>Satu<\/li><li>Dua<\/li><\/ul>/);
  assert.match(out,/<blockquote>この本です。<\/blockquote>/);assert.match(out,/A &amp; B/);
  assert.doesNotMatch(out,/##|\*\*/);
  let received;
  const sanitized=c.renderBody('<p onclick="bad()">Buku</p>',esc,input=>{received=input;return '<p>Buku</p>';});
  assert.equal(received,'<p onclick="bad()">Buku</p>');assert.equal(sanitized,'<p>Buku</p>');
});

test('long notes are separated without dropping information; number notation is explicit', () => {
  const {EzN5Copy:c}=setup();
  assert.equal(c.notes('Pola: A. Contoh: B. Perhatikan C.',esc),'<p>Pola: A.</p><p>Contoh: B.</p><p>Perhatikan C.</p>');
  assert.match(c.numbers(esc),/12\.500/);assert.doesNotMatch(c.numbers(esc),/1\.2000|1\.2500/);
  assert.match(c.numbers(esc),/pemisah ribuan/);
});

test('actual course transform preserves UUIDs, source links and Japanese examples', () => {
  const ctx=setup();
  ctx.splitJpFromContent=content=>({body:content,jp:''});
  const start=html.indexOf('function transformCourseFromApi('),end=html.indexOf('const QUIZ_CATEGORY_META',start);
  vm.runInContext(html.slice(start,end),ctx);
  const out=ctx.transformCourseFromApi({slug:'n5',modules:[{slug:'n5-b3',title:'BAB 3 : Memperkenalkan Diri',lessons:[
    {id:'uuid-source',slug:'bunpou1',title:'Kalimat Identitas (です・じゃありません)',type:'video',duration_minutes:4,grammar:[{id:'grammar-id',pattern:'〜は〜です',example:'わたしは アンナです。'}]},
    {id:'uuid-task',slug:'tugas1',title:'Tugas Bunpou 1',type:'grammar_task',popup_after_lesson_id:'uuid-source'},
  ]}]});
  const [lesson,task]=out.modules[0].lessons;
  assert.equal(lesson.apiId,'uuid-source');assert.equal(lesson.id,'bunpou1');assert.equal(lesson.duration,'4 menit');
  assert.equal(task.popupAfterLessonId,'uuid-source');assert.equal(task.title,'Latihan: Kalimat Identitas');
  assert.equal(lesson.grammar[0].pattern,'〜は〜です');assert.equal(lesson.grammar[0].example,'わたしは アンナです。');
});

test('N5 grammar renderer shows readable labels but keeps source IDs for analysis', () => {
  const ctx=setup(); ctx.AUDIO_SVG='';
  const start=html.indexOf('function renderLessonGrammar('),end=html.indexOf('// A Percakapan lesson',start);
  vm.runInContext(html.slice(start,end),ctx);
  const out=ctx.renderLessonGrammar({grammar:[{id:'original-id',pattern:'[verb]ません',meaning:'bentuk negatif sekarang',notes:'Pola: ません. Gunakan setelah dasar kata kerja.',examples:[{japanese:'のみません。',indonesian:'Tidak minum.'}]}]});
  assert.match(out,/data-grammar-id="original-id"/);assert.match(out,/Kata Kerja Bentuk ません/);
  assert.match(out,/<strong>Fungsi:<\/strong>/);assert.match(out,/のみません。/);
  assert.match(out,/<p>Pola: ません\.<\/p>/);assert.doesNotMatch(out,/\[verb\]/);
});

test('N5 resource card does not promise a downloadable PDF', () => {
  const ctx=setup();
  const start=html.indexOf('function renderLessonMaterials('),end=html.indexOf('window.speakLessonJP',start);
  vm.runInContext(html.slice(start,end),ctx);
  const out=ctx.renderLessonMaterials({},{});
  assert.match(out,/Lembar latihan belum tersedia/);assert.doesNotMatch(out,/href="#"|2 halaman|showToast/);
  ctx.currentState.course='n4';assert.match(ctx.renderLessonMaterials({},{}),/openChapterWorksheet/);
});

test('N5 test preview displays actual counts, passing rules and wait time in Indonesian', () => {
  const ctx=setup();ctx.escapeAttr=esc;ctx.kanaPlacementMeta=()=>null;ctx.COURSE_CONTENT={};
  const start=html.indexOf('function renderQuizLandingCard('),end=html.indexOf('function escapeAttr',start);
  vm.runInContext(html.slice(start,end),ctx);
  const container={innerHTML:''};
  const status={canAttempt:true,poolSize:48,questionsPerAttempt:24,passingScorePct:75,cooldownHours:12,assessmentVersion:'n5-assessment-v4',assessmentRules:{categoryMinimumPct:55,minimumObjectiveCorrect:2},objectives:[]};
  ctx.renderQuizLandingCard(container,'n5:n5-b4:test','Tes Bab 4',status);
  assert.match(container.innerHTML,/Bank soal/);assert.match(container.innerHTML,/Soal per tes/);
  assert.match(container.innerHTML,/12 jam/);assert.match(container.innerHTML,/total minimal 75%/);
  assert.match(container.innerHTML,/kategori minimal 55%/);assert.match(container.innerHTML,/Minimal 2 jawaban/);
  assert.doesNotMatch(container.innerHTML,/Pool soal|Per attempt|Cooldown|Mulai assessment|12h/);
  assert.equal(status.passingScorePct,75);assert.equal(status.questionsPerAttempt,24);
});

test('Percakapan and Latihan titles drop the "Tata Bahasa Bab N:" prefix of their source', () => {
  const ctx = setup();
  const out = ctx.EzN5Copy.prepareCourse({ slug:'n5', modules:[{ id:'m13', slug:'n5-b13', title:'BAB 13 : Bentuk Biasa', lessons:[
    { id:'src', type:'video', title:'Tata Bahasa Bab 13: Bentuk Plain (V-kamus・〜た)' },
    { id:'conv', type:'conversation', title:'Percakapan: lama', conversation_source_lesson_id:'src' },
    { id:'task', type:'grammar_task', title:'Tugas Bunpou Bab 13: Bentuk Biasa', popup_after_lesson_id:'src' },
    { id:'src2', type:'video', title:'Tata Bahasa: Kalimat Identitas' },
    { id:'conv2', type:'conversation', title:'Percakapan: lama', conversation_source_lesson_id:'src2' },
  ] }] });
  const titles = out.modules[0].lessons.map(l => l.title);
  assert.equal(titles[0], 'Tata Bahasa Bab 13: Bentuk Plain', 'the grammar lesson itself keeps its title');
  assert.equal(titles[1], 'Percakapan: Bentuk Plain');
  assert.equal(titles[2], 'Latihan: Bentuk Plain');
  assert.equal(titles[4], 'Percakapan: Kalimat Identitas');
});
