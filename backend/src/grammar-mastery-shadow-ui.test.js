// Paket 3 — layar tinjauan shadow di admin.html, dijalankan sebagai KODE ASLI
// (teknik vm-slice yang sama dengan admin-boot.test.js / quiz-result-ui.test.js),
// bukan reimplementasi. Yang diuji: angka cakupan metadata benar-benar muncul
// dan menjadi peringatan saat rendah, kartu ini tidak punya jalan untuk
// MENGAKTIFKAN kebijakan usulan, dan tabelnya membaca payload endpoint apa
// adanya.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `slice tidak ketemu: ${start}`);
  return html.slice(from, to);
};
const source = slice('const MS_FLAG_LABEL = {', 'window.bfPilotSaveSettings');

function run(payload) {
  const out = { innerHTML: '' };
  const calls = [];
  const win = {};
  const ctx = vm.createContext({
    window: win,
    document: {
      getElementById: (id) => (id === 'ms-shadow-out' ? out
        : id === 'ms-shadow-lesson' ? { value: payload.__lessonId || '' } : null),
    },
    api: async (path) => { calls.push(path); if (payload.__throw) throw new Error(payload.__throw); return payload; },
    escapeHtml: (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  });
  vm.runInContext(source, ctx);
  return { win, out, calls };
}

const base = {
  activePolicy: 'v1', proposedPolicy: 'v2', studentsScanned: 5,
  totals: { concepts: 5, changed: 3, unchanged: 2, limitedHistoryConcepts: 2 },
  byFlag: { recognition_only: 4, limited_history: 2 },
  metadataCoverage: { attempts: 21, withMetadata: 13, pct: 62 },
  samples: [{
    pattern: '〜は〜です', from: 'MASTERED', to: 'PROGRESSING',
    withheldReasons: ['variasi soal belum cukup'], flags: ['repeated_question'],
    evidenceQuality: 'tracked', attempts: 4, independentAttempts: 4,
    distinctQuestions: 1, productionPasses: 0,
  }],
};

test('cakupan metadata ditampilkan sebagai angka, bukan catatan kaki', async () => {
  const { win, out } = run(base);
  await win.msShadowRun();
  assert.match(out.innerHTML, /Cakupan metadata bukti: 62%/);
  assert.match(out.innerHTML, /13 dari 21 percobaan/);
  // Ditaruh sebelum ringkasan perubahan, supaya angkanya dibaca lebih dulu.
  assert.ok(out.innerHTML.indexOf('Cakupan metadata') < out.innerHTML.indexOf('konsep berbeda hasilnya'));
});

test('cakupan rendah memunculkan peringatan bahwa ini soal data, bukan siswa memburuk', async () => {
  const { win, out } = run({ ...base, metadataCoverage: { attempts: 21, withMetadata: 2, pct: 10 } });
  await win.msShadowRun();
  assert.match(out.innerHTML, /#fef3c7/, 'latar peringatan');
  assert.match(out.innerHTML, /data yang tidak tercatat/);
  assert.match(out.innerHTML, /tidak pernah diubah jadi gagal/);
});

test('cakupan tinggi tidak memunculkan peringatan itu', async () => {
  const { win, out } = run({ ...base, metadataCoverage: { attempts: 21, withMetadata: 20, pct: 95 } });
  await win.msShadowRun();
  assert.match(out.innerHTML, /#f0fdf4/, 'latar netral');
  assert.doesNotMatch(out.innerHTML, /data yang tidak tercatat/);
});

test('tanpa percobaan sama sekali, cakupannya dinyatakan apa adanya', async () => {
  const { win, out } = run({ ...base, metadataCoverage: { attempts: 0, withMetadata: 0, pct: null }, samples: [] });
  await win.msShadowRun();
  assert.match(out.innerHTML, /tidak ada percobaan/);
  assert.doesNotMatch(out.innerHTML, /NaN|undefined|null%/);
});

test('bendera diterjemahkan ke bahasa yang bisa dibaca pemilik produk', async () => {
  const { win, out } = run(base);
  await win.msShadowRun();
  assert.match(out.innerHTML, /lulus tanpa satu pun kalimat produksi/);
  assert.match(out.innerHTML, /riwayat lama tanpa metadata bukti/);
  assert.doesNotMatch(out.innerHTML, /recognition_only/);
});

test('contoh perubahan menampilkan alasan dan buktinya, bukan cuma state', async () => {
  const { win, out } = run(base);
  await win.msShadowRun();
  assert.match(out.innerHTML, /MASTERED[\s\S]*?PROGRESSING/);
  assert.match(out.innerHTML, /variasi soal belum cukup/);
  assert.match(out.innerHTML, /4 mandiri/);
  assert.match(out.innerHTML, /1 soal beda/);
});

test('kartu ini TIDAK punya cara mengaktifkan kebijakan usulan', async () => {
  const { win, out, calls } = run(base);
  await win.msShadowRun();
  assert.deepEqual(calls, ['/admin/grammar-mastery/shadow'], 'hanya satu GET, tanpa parameter');
  // Tidak ada tombol/toggle apa pun di keluarannya yang menulis kebijakan.
  assert.doesNotMatch(out.innerHTML, /<button|<input|onclick=/i);
  // Dan di seluruh markup kartunya pun tidak ada endpoint tulis kebijakan.
  const card = slice('Kebijakan penguasaan &mdash; mode shadow', 'window.bfPilotSaveSettings');
  assert.doesNotMatch(card, /grammar_mastery_policy|method:\s*['"]PUT|method:\s*['"]POST/);
});

test('ID pelajaran yang diketik dikirim sebagai parameter', async () => {
  const { win, calls } = run({ ...base, __lessonId: 'abc-123' });
  await win.msShadowRun();
  assert.deepEqual(calls, ['/admin/grammar-mastery/shadow?lessonId=abc-123']);
});

test('kegagalan endpoint dilaporkan, bukan diam-diam menampilkan nol', async () => {
  const { win, out } = run({ __throw: 'lesson_id_required' });
  await win.msShadowRun();
  assert.match(out.innerHTML, /Gagal: lesson_id_required/);
  assert.doesNotMatch(out.innerHTML, /Cakupan metadata/);
});
