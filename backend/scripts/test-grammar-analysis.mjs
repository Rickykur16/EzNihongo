#!/usr/bin/env node
// Uji end-to-end Analisis Belajar Bunpou (migration 122).
//
//   DATABASE_URL=postgres://... node backend/scripts/test-grammar-analysis.mjs
//
// Menjalankan router ASLI di atas Postgres ASLI. Hanya panggilan keluar ke
// Anthropic / ElevenLabs yang di-stub — sisanya jalur produksi apa adanya.
// DATABASE_URL WAJIB menunjuk database sekali-pakai: skrip ini men-TRUNCATE
// tabel konten & progres. Ada pengaman di bawah supaya tidak bisa dijalankan
// ke database produksi tanpa sengaja.
//
// Tiga mode dijalankan sebagai proses terpisah karena kunci API dibaca sekali
// saat modul dimuat — "AI mati" tidak bisa disimulasikan di proses yang sama
// dengan "AI hidup".
//
// Kasus yang dicakup (lihat juga bagian Analisis Bunpou di CLAUDE.md):
//   1  kalimat benar + pola target benar          7  gagal berulang
//   2  gramatikal tapi salah pola target          8  data belum cukup
//   3  partikel salah                             9  AI nonaktif
//   4  konjugasi salah                           10  STT nonaktif
//   5  elemen wajib hilang                       11  Tugas Bunpou Bab 3-20
//   6  retry berhasil setelah gagal              12  kalimat identik dari cache

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const MODE = process.argv[2] || '';

// ── Runner: tanpa argumen, jalankan ketiga mode sebagai proses anak ────────
if (!MODE) {
  const url = new URL(import.meta.url).pathname;
  const modes = [
    ['eval', { ANTHROPIC_API_KEY: 'test-key', ELEVENLABS_API_KEY: 'test-key' }],
    ['mastery', { ANTHROPIC_API_KEY: '' }],
    ['degraded', { ANTHROPIC_API_KEY: '', ELEVENLABS_API_KEY: '' }],
  ];
  let failed = 0;
  for (const [mode, env] of modes) {
    console.log(`\n########## MODE: ${mode} ##########`);
    const r = spawnSync(process.execPath, [url, mode], {
      stdio: 'inherit',
      env: {
        ...process.env,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'test-access-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        ...env,
      },
    });
    if (r.status !== 0) failed++;
  }
  console.log(failed === 0 ? '\nSEMUA MODE LULUS' : `\n${failed} MODE GAGAL`);
  process.exit(failed === 0 ? 0 : 1);
}

// ── Pengaman: skrip ini men-TRUNCATE, jangan sampai kena produksi ─────────
const DB = process.env.DATABASE_URL || '';
if (!DB) { console.error('FATAL: DATABASE_URL not set.'); process.exit(1); }
if (!/test|tmp|local|dev/i.test(DB)) {
  console.error('FATAL: nama database tidak mengandung test/tmp/local/dev — skrip ini menghapus data. Batal.');
  process.exit(1);
}

import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';

// Stub upstream: HANYA host AI/STT; permintaan lain (termasuk fetch ke server
// uji sendiri) tetap lewat implementasi asli.
const realFetch = globalThis.fetch;
let anthropicReply = null;
let anthropicCalls = 0;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    anthropicCalls++;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(anthropicReply) }] }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('api.elevenlabs.io')) {
    return new Response(JSON.stringify({ text: 'わたしは がくせいです。' }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, opts);
};

const { query } = await import(path.join(SRC, 'db.js'));
const { signAccessToken } = await import(path.join(SRC, 'auth.js'));
const grammarTaskRouter = (await import(path.join(SRC, 'routes/grammar-task.js'))).default;
const grammarAnalysisRouter = (await import(path.join(SRC, 'routes/grammar-analysis.js'))).default;
const recommendationsRouter = (await import(path.join(SRC, 'routes/recommendations.js'))).default;
const contentRouter = (await import(path.join(SRC, 'routes/content.js'))).default;
const progressRouter = (await import(path.join(SRC, 'routes/progress.js'))).default;
const { computeConceptMastery } = await import(path.join(SRC, 'grammar-mastery.js'));
const { formDistractors, buildRecognitionDrill, buildControlledDrill, deriveHighlight, shortMeaning } =
  await import(path.join(SRC, 'grammar-drills.js'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}

async function seed() {
  await query(`TRUNCATE grammar_attempts, grammar_eval_cache, quiz_question_results,
               quiz_attempts, quiz_options, quiz_questions, user_enrollments,
               lesson_grammar_task_items, module_grammar, lessons, modules, courses, users
               RESTART IDENTITY CASCADE`);
  const c = await query(`INSERT INTO courses (slug,title,is_published) VALUES ('n5','N5',true) RETURNING id`);
  const courseId = c.rows[0].id;
  const mo = await query(`INSERT INTO modules (course_id,slug,title,sort_order) VALUES ($1,'bab3','BAB 3',3) RETURNING id`, [courseId]);
  const moduleId = mo.rows[0].id;
  // type='video' disengaja: migration 099 sudah mengubah 18 pelajaran Tata
  // Bahasa Bab 12-20 dari 'text' ke 'video' tanpa menyentuh relasi grammar-nya,
  // jadi analisis TIDAK boleh bergantung pada lessons.type.
  const lt = await query(`INSERT INTO lessons (module_id,slug,title,type,sort_order) VALUES ($1,'tata-bahasa','Tata Bahasa Bab 3','video',4) RETURNING id`, [moduleId]);
  const bunpouLessonId = lt.rows[0].id;
  const lg = await query(`INSERT INTO lessons (module_id,slug,title,type,sort_order) VALUES ($1,'tugas-bunpou','Tugas Bunpou Bab 3','grammar_task',5) RETURNING id`, [moduleId]);
  const taskLessonId = lg.rows[0].id;
  const lq = await query(`INSERT INTO lessons (module_id,slug,title,type,sort_order,questions_per_attempt) VALUES ($1,'assignment','Assignment Bab 3','quiz',6,2) RETURNING id`, [moduleId]);
  const quizLessonId = lq.rows[0].id;

  const gids = [];
  const patterns = ['〜は〜です', '〜じゃありません', '〜ですか'];
  for (let i = 0; i < patterns.length; i++) {
    // Arti per pola sengaja BERBEDA: pengecoh Step 1 diambil dari arti pola
    // lain di bab yang sama, jadi pola bermakna identik memang tidak dapat
    // soal Step 1 (di-skip, bukan dipaksakan).
    const g = await query(
      `INSERT INTO module_grammar (module_id,lesson_id,pattern,meaning,example,sort_order)
       VALUES ($1,$2,$3,$5,'例文',$4) RETURNING id`,
      [moduleId, bunpouLessonId, patterns[i], i, `arti ${i}`]);
    gids.push(g.rows[0].id);
    await query(`INSERT INTO lesson_grammar_task_items (lesson_id,grammar_id,sort_order,instruction,required_count)
                 VALUES ($1,$2,$3,'buat kalimat tentang dirimu',1)`, [taskLessonId, g.rows[0].id, i]);
    // Bahan Step 1 & 2 — highlight = potongan kalimat yang memuat polanya.
    const ex = [
      ['わたしは がくせいです。', 'がくせい', 'Saya seorang siswa.'],
      ['わたしは せんせいじゃありません。', 'じゃありません', 'Saya bukan guru.'],
      ['あなたは がくせいです。', 'です', 'Kamu seorang siswa.'],
    ][i];
    await query(`INSERT INTO grammar_examples (grammar_id,japanese,highlight,indonesian,sort_order)
                 VALUES ($1,$2,$3,$4,0)`, [g.rows[0].id, ex[0], ex[1], ex[2]]);
  }
  // Tugas Bunpou KEDUA tiap bab di produksi sering hanya berisi 2 pola
  // (mis. Bab 13 tugas 2 = 〜てもいいですか + 〜てはいけません). Ini yang dulu
  // membuat Step 1 hilang karena pengecoh hanya diambil dari tugas itu sendiri.
  const lg2 = await query(`INSERT INTO lessons (module_id,slug,title,type,sort_order) VALUES ($1,'tugas-bunpou-2','Tugas Bunpou Bab 3 (2)','grammar_task',7) RETURNING id`, [moduleId]);
  const taskLesson2Id = lg2.rows[0].id;
  await query(`INSERT INTO lesson_grammar_task_items (lesson_id,grammar_id,sort_order,required_count)
               VALUES ($1,$2,1,1),($1,$3,2,1)`, [taskLesson2Id, gids[1], gids[2]]);

  const u = await query(`INSERT INTO users (google_id,email,full_name) VALUES ('g1','s@example.com','Rina Sari') RETURNING id`);
  const userId = u.rows[0].id;
  await query(`INSERT INTO user_enrollments (user_id,course_id) VALUES ($1,$2)`, [userId, courseId]);

  // Dua soal kuis: satu DITAUTKAN ke pola, satu TIDAK — persis seperti seluruh
  // Assignment Bab 1-20 yang sudah live.
  const q1 = await query(`INSERT INTO quiz_questions (lesson_id,question,question_category,grammar_id) VALUES ($1,'soal terikat pola','grammar',$2) RETURNING id`, [quizLessonId, gids[0]]);
  const q2 = await query(`INSERT INTO quiz_questions (lesson_id,question,question_category) VALUES ($1,'soal lama tanpa tautan','grammar') RETURNING id`, [quizLessonId]);
  const opts = {};
  for (const q of [q1.rows[0].id, q2.rows[0].id]) {
    const a = await query(`INSERT INTO quiz_options (question_id,option_text,is_correct,sort_order) VALUES ($1,'benar',true,0) RETURNING id`, [q]);
    await query(`INSERT INTO quiz_options (question_id,option_text,is_correct,sort_order) VALUES ($1,'salah',false,1)`, [q]);
    opts[q] = a.rows[0].id;
  }
  return { courseId, moduleId, bunpouLessonId, taskLessonId, taskLesson2Id, quizLessonId, gids, userId,
           q1: q1.rows[0].id, q2: q2.rows[0].id, opts };
}

function makeApp(routers) {
  const app = express();
  app.use(express.json());
  for (const r of routers) app.use('/api', r);
  app.use((err, _q, res, _n) => { console.error('APP ERR', err); res.status(500).json({ error: err.message }); });
  return app;
}

// ══════════════════════════════════════════════════════════════════════════
// MODE: eval — penilaian kalimat, klasifikasi error, cache (Case 1-5, 12)
// ══════════════════════════════════════════════════════════════════════════
if (MODE === 'eval') {
  const ctx = await seed();
  const token = await signAccessToken(ctx.userId, 's@example.com');
  const server = makeApp([grammarTaskRouter]).listen(0);
  await sleep(120);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, body) => {
    const res = await realFetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  const attemptsFor = async (gid) =>
    (await query(`SELECT * FROM grammar_attempts WHERE grammar_id=$1 ORDER BY created_at`, [gid])).rows;
  const [G1, G2, G3] = ctx.gids;
  let r, rows;

  console.log('\nCase 1 — kalimat benar, pola target dipakai');
  anthropicReply = { correct: true, usesPattern: true, feedback: 'Bagus!', correction: '',
    grammarScore: 95, errorTypes: [], primaryError: null, severity: 'none', conceptSignal: 'solid' };
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'わたしは がくせいです。', inputMode: 'speech' });
  check('200 + kontrak lama utuh', r.status === 200 && r.json.correct === true && r.json.usesPattern === true
    && typeof r.json.feedback === 'string' && typeof r.json.correction === 'string', r.json);
  check('field terstruktur baru terisi', r.json.grammarScore === 95 && r.json.severity === 'none' && r.json.conceptSignal === 'solid', r.json);
  rows = await attemptsFor(G1);
  check('percobaan tercatat, passed=true, input_mode=speech',
    rows.length === 1 && rows[0].passed === true && rows[0].input_mode === 'speech' && rows[0].eval_source === 'ai', rows[0]);

  console.log('\nCase 2 — gramatikal tapi salah pola target');
  anthropicReply = { correct: true, usesPattern: false, feedback: 'Polanya belum dipakai.', correction: 'わたしは がくせいです。',
    grammarScore: 55, errorTypes: ['wrong_grammar_pattern'], primaryError: 'wrong_grammar_pattern', severity: 'major', conceptSignal: 'not_used' };
  r = await call('/grammar-task/evaluate', { grammarId: G2, lessonId: ctx.taskLessonId, sentence: 'これは ほんです。', inputMode: 'text' });
  check('usesPattern false → tidak lulus', r.status === 200 && r.json.correct === true && r.json.usesPattern === false, r.json);
  rows = await attemptsFor(G2);
  check('passed=false walau correct=true', rows[0].passed === false && rows[0].correct === true, rows[0]);
  check('primary_error=wrong_grammar_pattern', rows[0].primary_error === 'wrong_grammar_pattern', rows[0]);

  console.log('\nCase 3 — partikel salah');
  anthropicReply = { correct: false, usesPattern: true, feedback: 'Partikelnya keliru.', correction: 'わたしは せんせいです。',
    grammarScore: 60, errorTypes: ['wrong_particle'], primaryError: 'wrong_particle', severity: 'minor', conceptSignal: 'shaky' };
  r = await call('/grammar-task/evaluate', { grammarId: G3, lessonId: ctx.taskLessonId, sentence: 'わたしが せんせいです。', inputMode: 'text' });
  rows = await attemptsFor(G3);
  check('wrong_particle tersimpan + tidak lulus', rows[0].primary_error === 'wrong_particle' && rows[0].passed === false, rows[0]);
  check('errorTypes ikut ke respons', Array.isArray(r.json.errorTypes) && r.json.errorTypes[0] === 'wrong_particle', r.json);

  console.log('\nCase 4 — konjugasi salah');
  anthropicReply = { correct: false, usesPattern: true, feedback: 'Bentuknya salah.', correction: 'たべました',
    grammarScore: 45, errorTypes: ['wrong_conjugation'], primaryError: 'wrong_conjugation', severity: 'major', conceptSignal: 'shaky' };
  await call('/grammar-task/evaluate', { grammarId: G3, lessonId: ctx.taskLessonId, sentence: 'たべるました', inputMode: 'text' });
  rows = await attemptsFor(G3);
  check('wrong_conjugation tercatat', rows.some((x) => x.primary_error === 'wrong_conjugation'), rows.map((x) => x.primary_error));

  console.log('\nCase 5 — elemen wajib hilang');
  anthropicReply = { correct: false, usesPattern: false, feedback: 'Ada bagian yang kelewat.', correction: 'わたしは がくせいじゃありません。',
    grammarScore: 30, errorTypes: ['missing_element'], primaryError: 'missing_element', severity: 'major', conceptSignal: 'not_used' };
  await call('/grammar-task/evaluate', { grammarId: G2, lessonId: ctx.taskLessonId, sentence: 'がくせい', inputMode: 'text' });
  rows = await attemptsFor(G2);
  check('missing_element tercatat', rows.some((x) => x.primary_error === 'missing_element'), rows.map((x) => x.primary_error));

  console.log('\nCase 12 — kalimat identik dilayani cache');
  const before = anthropicCalls;
  anthropicReply = { correct: true, usesPattern: true, feedback: 'JANGAN DIPAKAI', correction: '',
    grammarScore: 1, errorTypes: [], primaryError: null, severity: 'none', conceptSignal: 'solid' };
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'わたしは がくせいです。', inputMode: 'text' });
  check('tidak ada panggilan AI baru', anthropicCalls === before, { before, after: anthropicCalls });
  check('hasil lama yang dikembalikan (grammarScore 95)', r.json.grammarScore === 95, r.json);
  rows = await attemptsFor(G1);
  check('percobaan TETAP tercatat dengan eval_source=cache',
    rows.length === 2 && rows[1].eval_source === 'cache', rows.map((x) => x.eval_source));

  console.log('\nEkstra — transcription_issue hanya berlaku untuk input ucapan');
  const missheard = { correct: false, usesPattern: false, feedback: 'salah dengar', correction: '',
    grammarScore: 20, errorTypes: ['transcription_issue'], primaryError: 'transcription_issue', severity: 'minor', conceptSignal: 'not_used' };
  anthropicReply = missheard;
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'たいぷしたぶん', inputMode: 'text' });
  check('input ketik → diturunkan jadi other', r.json.primaryError === 'other', r.json);
  anthropicReply = missheard;
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'はなしたぶん', inputMode: 'speech' });
  check('input ucapan → tetap transcription_issue', r.json.primaryError === 'transcription_issue', r.json);

  console.log('\nEkstra — output model yang menyimpang dinormalkan');
  anthropicReply = { correct: false, usesPattern: true, feedback: 'x', correction: '',
    grammarScore: 500, errorTypes: ['keigo_mismatch', 'wrong_particle'], primaryError: 'keigo_mismatch',
    severity: 'catastrophic', conceptSignal: 'weird' };
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'へんなぶんです', inputMode: 'text' });
  check('tipe error karangan → other', r.json.primaryError === 'other' && r.json.errorTypes.includes('other'), r.json);
  check('grammarScore di-clamp ke 100', r.json.grammarScore === 100, r.json);
  check('severity/conceptSignal tak dikenal → null', r.json.severity === null && r.json.conceptSignal === null, r.json);

  console.log('\nEkstra — prompt admin versi lama (model balas 4 field saja)');
  anthropicReply = { correct: true, usesPattern: true, feedback: 'ok', correction: '' };
  r = await call('/grammar-task/evaluate', { grammarId: G1, lessonId: ctx.taskLessonId, sentence: 'ふるいぷろんぷと', inputMode: 'text' });
  check('tetap 200; field baru null/kosong, tidak error', r.status === 200 && r.json.correct === true
    && r.json.grammarScore === null && r.json.severity === null
    && Array.isArray(r.json.errorTypes) && r.json.errorTypes.length === 0, r.json);

  // ── Step 1 & 2: latihan terarah, dinilai server tanpa AI ──────────────
  console.log('\nStep 1/2 — pengecoh diturunkan sesuai BENTUK jawabannya');
  check('kata benda → tempel partikel (pola がくせい/がくせいの/がくせいを)',
    formDistractors('がくせい').rule === 'particle-append'
    && formDistractors('がくせい').distractors.includes('がくせいの'), formDistractors('がくせい'));
  check('bentuk te → pengecohnya bentuk lain, bukan partikel (読んで → 読んだ)',
    formDistractors('読んで').rule === 'te' && formDistractors('読んで').distractors.includes('読んだ'),
    formDistractors('読んで'));
  check('んで dicek sebelum partikel で (tidak jadi "読んは")',
    !formDistractors('読んで').distractors.some((d) => d.startsWith('読んは')), formDistractors('読んで'));
  check('bentuk masu → keluarga masu', formDistractors('たべます').rule === 'masu'
    && formDistractors('たべます').distractors.includes('たべました'), formDistractors('たべます'));
  check('bentuk nai → keluarga nai', formDistractors('行かない').rule === 'nai'
    && formDistractors('行かない').distractors.includes('行かなかった'), formDistractors('行かない'));
  check('partikel di akhir → tukar partikel', formDistractors('がっこうで').rule === 'particle-swap',
    formDistractors('がっこうで'));

  console.log('\nStep 2 — contoh lama tanpa highlight (backfill 031) tetap dapat soal');
  check('pola 〜てください → potongan literalnya ketemu di kalimat',
    deriveHighlight('〜てください', 'ここに 名前を かいてください。') === 'てください',
    deriveHighlight('〜てください', 'ここに 名前を かいてください。'));
  check('pola 〜は〜です → ambil potongan terpanjang yang muncul',
    deriveHighlight('〜は〜です', 'わたしは がくせいです。') === 'です',
    deriveHighlight('〜は〜です', 'わたしは がくせいです。'));
  check('potongan yang tidak muncul di kalimat tidak dipaksakan',
    deriveHighlight('〜てから', 'わたしは がくせいです。') === null,
    deriveHighlight('〜てから', 'わたしは がくせいです。'));
  const legacy = { id: ctx.gids[0], pattern: '〜じゃありません', meaning: 'arti 0',
    examples: [{ japanese: 'わたしは せんせいじゃありません。', highlight: null, indonesian: null }] };
  const legacyDrill = buildControlledDrill(legacy, [legacy]);
  check('contoh tanpa highlight tetap menghasilkan Step 2',
    legacyDrill && legacyDrill.sentence.includes('＿＿＿'), legacyDrill);

  console.log('\nStep 1/2 — soal diturunkan dari materi yang sudah ada');
  const gres = await realFetch(`${base}/grammar-task/lesson/${ctx.taskLessonId}/drills`,
    { headers: { authorization: 'Bearer ' + token } });
  const gdata = await gres.json();
  check('200 + satu entri per pola', gres.status === 200 && gdata.drills.length === 3, gdata);
  const d1 = gdata.drills[0];
  check('Step 1 menanyakan fungsi pola', d1.step1 && d1.step1.prompt.includes(d1.pattern), d1.step1);
  check('Step 1 pengecohnya arti pola LAIN di bab yang sama',
    d1.step1.options.length === 3 && d1.step1.options.includes('arti 1')
    && d1.step1.options.includes('arti 2'), d1.step1.options);
  check('Step 2 mengosongkan bagian berpola',
    d1.step2 && d1.step2.sentence.includes('＿＿＿') && !d1.step2.sentence.includes('がくせいです'), d1.step2);
  check('KUNCI JAWABAN tidak ikut dikirim ke browser',
    !('correctIndex' in d1.step1) && !('correctIndex' in d1.step2), Object.keys(d1.step1));

  const gres2 = await realFetch(`${base}/grammar-task/lesson/${ctx.taskLessonId}/drills`,
    { headers: { authorization: 'Bearer ' + token } });
  const gdata2 = await gres2.json();
  check('urutan opsi deterministik (soal yang dinilai = soal yang dikirim)',
    JSON.stringify(gdata2.drills[0]) === JSON.stringify(d1), gdata2.drills[0]);

  console.log('\nStep 1 — pengecoh kurasi dipakai kalau ada (migration 124)');
  await query(
    `UPDATE module_grammar SET recognition_distractors = $2 WHERE id = $1`,
    [ctx.gids[0], 'Menandai objek yang dikenai perbuatan.\nMenyatakan tempat berlangsungnya kegiatan.\nMenyatakan alat atau cara melakukan sesuatu.']
  );
  const cur = await realFetch(`${base}/grammar-task/lesson/${ctx.taskLessonId}/drills`,
    { headers: { authorization: 'Bearer ' + token } });
  const curData = await cur.json();
  const curDrill = curData.drills.find((d) => d.grammarId === ctx.gids[0]);
  check('opsi memakai pengecoh kurasi, bukan arti pola lain',
    curDrill.step1.options.includes('Menandai objek yang dikenai perbuatan.')
    && !curDrill.step1.options.includes('arti 1'), curDrill.step1.options);
  check('jawaban benar tetap ikut jadi opsi',
    curDrill.step1.options.includes('arti 0'), curDrill.step1.options);
  const curAns = await realFetch(base + '/grammar-task/drill-answer', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ lessonId: ctx.taskLessonId, grammarId: ctx.gids[0], step: 1,
      optionIndex: curDrill.step1.options.indexOf('arti 0') }),
  });
  check('penilaian server konsisten dengan opsi kurasi',
    curAns.status === 200 && (await curAns.json()).passed === true);
  await query(`UPDATE module_grammar SET recognition_distractors = NULL WHERE id = $1`, [ctx.gids[0]]);
  const back = await realFetch(`${base}/grammar-task/lesson/${ctx.taskLessonId}/drills`,
    { headers: { authorization: 'Bearer ' + token } });
  const backDrill = (await back.json()).drills.find((d) => d.grammarId === ctx.gids[0]);
  check('dikosongkan → kembali ke pengecoh otomatis (tidak rusak)',
    backDrill.step1 && backDrill.step1.options.includes('arti 1'), backDrill.step1.options);

  console.log('\nStep 1 — opsi dipendekkan supaya panjangnya sebanding');
  const notaPanjang = "Partikel の di sini menyatakan kepunyaan: KB 2 milik KB 1. Pola: \"B milik A\".";
  check('catatan ajar multi-kalimat dipotong ke kalimat pertama',
    shortMeaning(notaPanjang) === 'Partikel の di sini menyatakan kepunyaan: KB 2 milik KB 1.',
    shortMeaning(notaPanjang));
  check('kalimat pertama yang terlalu pendek tidak dipakai sendirian',
    shortMeaning("Menyatakan \"juga\". Partikel も menggantikan posisi は.").length > 25,
    shortMeaning("Menyatakan \"juga\". Partikel も menggantikan posisi は."));
  check('arti satu kalimat dibiarkan apa adanya',
    shortMeaning('Menyatakan kepemilikan antara dua kata benda.') === 'Menyatakan kepemilikan antara dua kata benda.');
  check('teks tanpa titik tetap aman', shortMeaning('arti tanpa titik').length > 0);

  console.log('\nStep 1 — tugas berisi 2 pola tetap dapat soal (pengecoh se-bab)');
  const g2res = await realFetch(`${base}/grammar-task/lesson/${ctx.taskLesson2Id}/drills`,
    { headers: { authorization: 'Bearer ' + token } });
  const g2data = await g2res.json();
  check('200 + 2 pola', g2res.status === 200 && g2data.drills.length === 2, g2data);
  check('Step 1 TIDAK hilang walau tugasnya cuma 2 pola',
    g2data.drills.every((d) => d.step1 && d.step1.options.length >= 3),
    g2data.drills.map((d) => (d.step1 ? d.step1.options.length : null)));
  check('pengecohnya arti pola lain di bab yang sama (termasuk yang di luar tugas ini)',
    g2data.drills[0].step1.options.includes('arti 0'), g2data.drills[0].step1.options);
  const g2ans = await realFetch(base + '/grammar-task/drill-answer', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ lessonId: ctx.taskLesson2Id, grammarId: g2data.drills[0].grammarId, step: 1, optionIndex: 0 }),
  });
  const g2j = await g2ans.json();
  check('penilaian server memakai pool yang sama (tidak 404/500)',
    g2ans.status === 200 && typeof g2j.passed === 'boolean' && Number.isInteger(g2j.correctIndex), g2j);

  console.log('\nStep 1/2 — penilaian di server + pencatatan percobaan');
  // Kunci jawaban benar diturunkan ulang di sini, sama seperti yang server lakukan.
  const items = [
    { id: ctx.gids[0], pattern: '〜は〜です', meaning: 'arti 0',
      examples: [{ japanese: 'わたしは がくせいです。', highlight: 'がくせい', indonesian: 'Saya seorang siswa.' }] },
    { id: ctx.gids[1], pattern: '〜じゃありません', meaning: 'arti 1',
      examples: [{ japanese: 'わたしは せんせいじゃありません。', highlight: 'じゃありません', indonesian: 'Saya bukan guru.' }] },
    { id: ctx.gids[2], pattern: '〜ですか', meaning: 'arti 2',
      examples: [{ japanese: 'あなたは がくせいです。', highlight: 'です', indonesian: 'Kamu seorang siswa.' }] },
  ];
  const s1 = buildRecognitionDrill(items[0], items);
  const s2 = buildControlledDrill(items[0], items);

  const answer = async (grammarId, step, optionIndex) => {
    const res = await realFetch(base + '/grammar-task/drill-answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ lessonId: ctx.taskLessonId, grammarId, step, optionIndex }),
    });
    return { status: res.status, json: await res.json() };
  };

  let a = await answer(ctx.gids[0], 1, s1.correctIndex);
  check('Step 1 jawaban benar → passed', a.status === 200 && a.json.passed === true, a.json);
  a = await answer(ctx.gids[0], 1, (s1.correctIndex + 1) % s1.options.length);
  check('Step 1 jawaban salah → passed false + kunci dibuka setelah dinilai',
    a.json.passed === false && a.json.correctIndex === s1.correctIndex, a.json);

  a = await answer(ctx.gids[0], 2, s2.correctIndex);
  check('Step 2 jawaban benar → passed', a.json.passed === true, a.json);
  a = await answer(ctx.gids[0], 2, (s2.correctIndex + 1) % s2.options.length);
  check('Step 2 jawaban salah → passed false', a.json.passed === false, a.json);

  // Ambil 4 TERAKHIR: blok pengecoh kurasi di atas sudah menulis percobaan lain
  // untuk pola yang sama, jadi menghitung seluruh baris bikin tes rapuh.
  const drillRows = (await query(
    `SELECT source, passed, primary_error FROM grammar_attempts
      WHERE grammar_id=$1 AND source <> 'production' ORDER BY created_at`, [ctx.gids[0]])).rows.slice(-4);
  check('4 percobaan terakhir tercatat dengan source recognition/controlled',
    drillRows.length === 4 && drillRows[0].source === 'recognition' && drillRows[2].source === 'controlled',
    drillRows.map((x) => x.source));
  check('Step 1 salah → primary_error meaning_mismatch',
    drillRows[1].primary_error === 'meaning_mismatch', drillRows[1]);
  check('Step 2 salah → error terklasifikasi dari ATURAN pengecoh, tanpa AI',
    drillRows[3].primary_error === 'wrong_particle', drillRows[3]);
  check('jawaban benar tidak menuliskan error', drillRows[0].primary_error === null, drillRows[0]);

  a = await answer(ctx.gids[0], 2, 99);
  check('indeks opsi di luar jangkauan ditolak', a.status === 400, a);
  a = await answer(ctx.gids[0], 3, 0);
  check('step selain 1/2 ditolak', a.status === 400, a);

  server.close();
}

// ══════════════════════════════════════════════════════════════════════════
// MODE: mastery — model penguasaan, endpoint analisis, kompatibilitas mundur
// (Case 6, 7, 8, 11 + retensi Level D)
// ══════════════════════════════════════════════════════════════════════════
if (MODE === 'mastery') {
  const now = Date.now();
  const day = 86400000;
  const A = (passed, ageDays, source = 'production', primary_error = null) =>
    ({ passed, created_at: new Date(now - ageDays * day).toISOString(), source, primary_error });
  let m;

  console.log('\nCase 8 — data belum cukup: sistem TIDAK boleh mengklaim penguasaan');
  m = computeConceptMastery([], now);
  check('nol percobaan → UNSEEN, score null', m.state === 'UNSEEN' && m.score === null, m);
  m = computeConceptMastery([A(true, 0)], now);
  check('1 percobaan lulus → LEARNING, score TETAP null', m.state === 'LEARNING' && m.score === null, m);
  m = computeConceptMastery([A(true, 0), A(true, 1)], now);
  check('2 percobaan lulus → masih LEARNING, belum ada angka', m.state === 'LEARNING' && m.score === null, m);
  m = computeConceptMastery([A(true, 0), A(true, 1), A(true, 2)], now);
  check('3 percobaan → angka baru boleh muncul', m.score === 100, m);
  check('3x lulus belum MASTERED (sampel < 4)', m.state !== 'MASTERED', m);
  m = computeConceptMastery([A(true, 0), A(true, 1), A(true, 2), A(true, 3)], now);
  check('4 percobaan lulus beruntun → MASTERED', m.state === 'MASTERED' && m.score === 100, m);

  console.log('\nCase 6 — gagal lalu retry berhasil');
  m = computeConceptMastery([A(true, 0), A(true, 1), A(false, 8), A(false, 9)], now);
  check('recency menaikkan skor di atas rata-rata polos 50%', m.score > 50, m);
  check('dua retry berhasil terakhir → tidak lagi NEEDS_PRACTICE', m.state !== 'NEEDS_PRACTICE', m);
  m = computeConceptMastery([A(true, 0), A(true, 1), A(false, 3), A(false, 4), A(false, 5), A(false, 6), A(false, 7), A(false, 8)], now);
  check('2 berhasil di antara 6 gagal TIDAK dimaafkan', m.state === 'NEEDS_PRACTICE', m);
  m = computeConceptMastery([A(true, 0), A(false, 30), A(false, 60), A(false, 90)], now);
  check('satu keberhasilan baru belum cukup untuk MASTERED', m.state !== 'MASTERED', m);

  console.log('\nCase 7 — gagal berulang pada konsep yang sama');
  m = computeConceptMastery([A(false, 0), A(false, 1), A(false, 2), A(false, 3)], now);
  check('semua gagal → NEEDS_PRACTICE, score 0', m.state === 'NEEDS_PRACTICE' && m.score === 0, m);
  m = computeConceptMastery([A(false, 0), A(false, 1), A(true, 2), A(true, 3), A(true, 4)], now);
  check('dua kegagalan TERAKHIR langsung turun ke NEEDS_PRACTICE walau mayoritas lulus', m.state === 'NEEDS_PRACTICE', m);

  console.log('\nRetensi (Level D) — penguasaan yang basi');
  m = computeConceptMastery([A(true, 40), A(true, 41), A(true, 42), A(true, 43)], now);
  check('pernah kuat tapi 40 hari tak disentuh → dueReview', m.weightedAccuracy === 1 && m.dueReview === true, m);
  m = computeConceptMastery([A(true, 1), A(true, 2), A(true, 3), A(true, 4)], now);
  check('baru saja dipakai → dueReview false', m.dueReview === false, m);

  console.log('\nSalah dengar STT bukan kegagalan grammar');
  m = computeConceptMastery(
    [A(false, 0, 'production', 'transcription_issue'), A(true, 1), A(true, 2), A(true, 3), A(true, 4)], now);
  check('percobaan transcription_issue dibuang dari agregasi', m.attempts === 4 && m.score === 100, m);

  console.log('\nKesalahan grammar tidak pernah jadi kelemahan KOSAKATA');
  m = computeConceptMastery([A(false, 0, 'production', 'wrong_particle'),
    A(false, 1, 'production', 'wrong_conjugation'), A(false, 2)], now);
  check('percobaan grammar tetap di konsep grammar', m.attempts === 3 && m.state === 'NEEDS_PRACTICE', m);

  // ── endpoint di atas DB asli ──
  const ctx = await seed();
  const token = await signAccessToken(ctx.userId, 's@example.com');
  const server = makeApp([grammarAnalysisRouter, contentRouter, progressRouter, recommendationsRouter]).listen(0);
  await sleep(120);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (p, body, method) => {
    const res = await realFetch(base + p, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  const insertAttempts = async (gid, list) => {
    for (const [passed, ageDays] of list) {
      await query(
        `INSERT INTO grammar_attempts (user_id,grammar_id,lesson_id,input_mode,sentence,correct,uses_pattern,passed,primary_error,created_at)
         VALUES ($1,$2,$3,'text','テスト',$4,$4,$4,$5, NOW() - make_interval(days => $6::int))`,
        [ctx.userId, gid, ctx.taskLessonId, passed, passed ? null : 'wrong_particle', ageDays]
      );
    }
  };
  let r;

  console.log('\nEndpoint analisis — pelajaran tanpa data sama sekali');
  r = await call(`/grammar/mastery/lesson/${ctx.bunpouLessonId}`);
  check('200 dengan 3 pola meski nol percobaan', r.status === 200 && r.json.concepts.length === 3, r.json);
  check('semua UNSEEN, ringkasan pct null (tanpa klaim penguasaan)',
    r.json.concepts.every((c) => c.state === 'UNSEEN' && c.score === null) && r.json.summary.pct === null, r.json.summary);
  check('pola terambil walau lessons.type = "video" (migration 099)',
    r.json.concepts.map((c) => c.pattern).includes('〜じゃありません'), r.json.concepts.map((c) => c.pattern));

  console.log('\nEndpoint analisis — campuran dikuasai / perlu latihan / baru mulai');
  await insertAttempts(ctx.gids[0], [[true, 0], [true, 1], [true, 2], [true, 4]]);
  await insertAttempts(ctx.gids[1], [[false, 0], [false, 1], [false, 3], [true, 5]]);
  await insertAttempts(ctx.gids[2], [[true, 0]]);
  r = await call(`/grammar/mastery/lesson/${ctx.bunpouLessonId}`);
  const byPattern = Object.fromEntries(r.json.concepts.map((c) => [c.pattern, c]));
  check('〜は〜です → Dikuasai', byPattern['〜は〜です'].state === 'MASTERED', byPattern['〜は〜です']);
  check('〜じゃありません → Perlu latihan', byPattern['〜じゃありません'].state === 'NEEDS_PRACTICE', byPattern['〜じゃありません']);
  check('〜ですか → Sedang dipelajari, score tetap null (1 percobaan)',
    byPattern['〜ですか'].state === 'LEARNING' && byPattern['〜ですか'].score === null, byPattern['〜ですか']);
  check('ringkasan: 1 dikuasai, 1 perlu latihan',
    r.json.summary.mastered === 1 && r.json.summary.needsPractice === 1, r.json.summary);
  check('pct dirata-rata HANYA dari pola yang punya skor',
    r.json.summary.analyzed === 2 && r.json.summary.pct != null, r.json.summary);
  check('fokus menunjuk pola terlemah', r.json.focus && r.json.focus.pattern === '〜じゃありません', r.json.focus);
  check('fokus memakai bahasa siswa, bukan nama tipe error internal',
    r.json.focus.message && !/wrong_|_issue|_error/.test(r.json.focus.message), r.json.focus.message);
  check('tombol "Latihan sekarang" menunjuk Tugas Bunpou yang benar',
    r.json.focus.practice && r.json.focus.practice.lessonSlug === 'tugas-bunpou'
    && r.json.focus.practice.moduleSlug === 'bab3', r.json.focus.practice);

  console.log('\nRekomendasi dashboard menyebut POLA, bukan cuma kategori');
  r = await call('/recommendations/me');
  check('weakGrammar memuat pola yang lemah', Array.isArray(r.json.weakGrammar)
    && r.json.weakGrammar.some((g) => g.pattern === '〜じゃありません'), r.json.weakGrammar);
  check('panel tampil walau siswa belum pernah kuis sama sekali', r.json.hasData === true, r.json.hasData);

  console.log('\nCase 11 — alur Tugas Bunpou / Assignment Bab 3-20 tetap jalan');
  r = await call('/courses/n5');
  const mods = r.json.course.modules;
  const taskLesson = mods[0].lessons.find((l) => l.type === 'grammar_task');
  check('payload grammarTask tetap bentuk lama', Array.isArray(taskLesson.grammarTask)
    && taskLesson.grammarTask.length === 3
    && 'pattern' in taskLesson.grammarTask[0] && 'requiredCount' in taskLesson.grammarTask[0], taskLesson.grammarTask[0]);
  check('lesson.grammar tetap terkirim untuk halaman Tata Bahasa',
    mods[0].lessons.find((l) => l.slug === 'tata-bahasa').grammar.length === 3);

  const start = await call(`/progress/lesson/${ctx.quizLessonId}/quiz/start`, {});
  check('kuis lama tetap bisa dimulai', start.status === 200 && start.json.questions.length === 2, start.json);
  const answers = start.json.questions.map((q) => ({ questionId: q.id, optionId: ctx.opts[q.id] }));
  const sub = await call(`/progress/lesson/${ctx.quizLessonId}/quiz-attempt`,
    { attemptToken: start.json.attemptToken, answers });
  check('submit kuis tetap 200 + skor benar', sub.status === 200 && sub.json.score === 2, sub.json);
  const qqr = (await query(`SELECT question_id, grammar_id FROM quiz_question_results WHERE user_id=$1`, [ctx.userId])).rows;
  check('soal yang ditautkan menyimpan grammar_id',
    qqr.find((x) => x.question_id === ctx.q1)?.grammar_id === ctx.gids[0], qqr);
  check('soal lama tanpa tautan tetap tersimpan dengan grammar_id NULL',
    qqr.find((x) => x.question_id === ctx.q2)?.grammar_id === null, qqr);

  r = await call(`/grammar/mastery/lesson/${ctx.bunpouLessonId}`);
  check('jawaban kuis benar ikut mengisi analisis pola (tanpa AI)',
    r.json.concepts.find((c) => c.grammarId === ctx.gids[0]).recognitionAttempts === 1,
    r.json.concepts.find((c) => c.grammarId === ctx.gids[0]));

  server.close();
}

// ══════════════════════════════════════════════════════════════════════════
// MODE: degraded — AI dan STT nonaktif (Case 9, 10, 12b)
// ══════════════════════════════════════════════════════════════════════════
if (MODE === 'degraded') {
  const ctx = await seed();
  await query(
    `INSERT INTO grammar_attempts (user_id,grammar_id,lesson_id,input_mode,sentence,correct,uses_pattern,passed,primary_error)
     VALUES ($1,$2,$3,'text','テスト',false,false,false,'wrong_particle'),
            ($1,$2,$3,'text','テスト2',false,false,false,'wrong_particle'),
            ($1,$2,$3,'text','テスト3',false,false,false,'wrong_particle')`,
    [ctx.userId, ctx.gids[1], ctx.taskLessonId]
  );
  const token = await signAccessToken(ctx.userId, 's@example.com');
  const server = makeApp([grammarTaskRouter, recommendationsRouter]).listen(0);
  await sleep(120);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const H = { authorization: 'Bearer ' + token };

  console.log('\nCase 9 — AI nonaktif (ANTHROPIC_API_KEY kosong)');
  let res = await realFetch(base + '/grammar-task/evaluate', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ grammarId: ctx.gids[0], lessonId: ctx.taskLessonId, sentence: 'かんぜんに あたらしい ぶんです', inputMode: 'text' }),
  });
  let body = await res.json();
  check('503 eval_disabled (frontend un-gate tombol Selesai)', res.status === 503 && body.error === 'eval_disabled', { s: res.status, body });
  const n = (await query(`SELECT COUNT(*)::int c FROM grammar_attempts WHERE sentence = 'かんぜんに あたらしい ぶんです'`)).rows[0].c;
  check('tanpa verdict → tidak ada percobaan palsu yang dicatat', n === 0, n);

  console.log('\nCase 9b — rekomendasi tetap jalan tanpa AI');
  res = await realFetch(base + '/recommendations/me', { headers: H });
  body = await res.json();
  check('200, tidak pernah 503', res.status === 200, res.status);
  check('analisis pola tetap terisi tanpa AI', Array.isArray(body.weakGrammar) && body.weakGrammar.length > 0, body.weakGrammar);

  console.log('\nCase 10 — STT nonaktif (ELEVENLABS_API_KEY kosong)');
  const fd = new FormData();
  fd.append('audio', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), 'speech.webm');
  res = await realFetch(base + '/grammar-task/transcribe', { method: 'POST', headers: H, body: fd });
  body = await res.json();
  check('503 stt_disabled → frontend jatuh ke mode ketik', res.status === 503 && body.error === 'stt_disabled', { s: res.status, body });

  console.log('\nCase 12b — kalimat yang sudah di-cache tetap dilayani walau AI mati');
  const cached = 'きゃっしゅされた ぶん';
  const key = createHash('sha256')
    .update(`grammar-eval-v2|claude-haiku-4-5|${ctx.gids[0]}||${cached}`).digest('hex');
  await query(`INSERT INTO grammar_eval_cache (eval_hash, grammar_id, sentence, result, model)
               VALUES ($1,$2,$3,$4,'claude-haiku-4-5') ON CONFLICT DO NOTHING`,
    [key, ctx.gids[0], cached, JSON.stringify({ correct: true, usesPattern: true, feedback: 'ok', correction: '',
      grammarScore: 90, errorTypes: [], primaryError: null, severity: 'none', conceptSignal: 'solid' })]);
  res = await realFetch(base + '/grammar-task/evaluate', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ grammarId: ctx.gids[0], sentence: cached, inputMode: 'text' }),
  });
  body = await res.json();
  check('200 dari cache walau AI mati', res.status === 200 && body.grammarScore === 90, { s: res.status, body });
  const rec = (await query(`SELECT eval_source FROM grammar_attempts WHERE sentence=$1`, [cached])).rows;
  check('percobaannya tetap tercatat', rec.length === 1 && rec[0].eval_source === 'cache', rec);

  server.close();
}

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
process.exit(fail === 0 ? 0 : 1);
