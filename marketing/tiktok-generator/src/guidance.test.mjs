import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadGuidance, recordResult, NOTES_FILE } from './guidance.mjs';
import { validateScript } from './plan.mjs';

test('NOTES_FILE menunjuk ke marketing/catatan-video-tiktok.md', () => {
  assert.equal(path.basename(NOTES_FILE), 'catatan-video-tiktok.md');
  assert.equal(path.basename(path.dirname(NOTES_FILE)), 'marketing');
});

test('loadGuidance: catatan tim + hasil terbaru masuk prompt, dengan aturan prioritasnya', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'g-'));
  const notesFile = path.join(out, 'catatan.md');
  assert.equal(await loadGuidance(out, { notesFile }), '', 'tanpa catatan & hasil: prompt tidak berubah');

  await fs.writeFile(notesFile, '# Catatan\nFrame 0 harus berisi angka.');
  for (let i = 1; i <= 15; i++) await recordResult(out, { video: `Video ${i}`, summary: `${i}rb tayangan`, date: '2026-10-11' });
  const g = await loadGuidance(out, { notesFile });
  assert.match(g, /Frame 0 harus berisi angka/);
  assert.match(g, /Video 15: 15rb tayangan/);
  assert.doesNotMatch(g, /Video 3:/, 'hanya 12 hasil terakhir');
  assert.match(g, /kejujuran & larangan TIDAK pernah dilonggarkan/);
});

test('validateScript menjaga syarat gaya fyp', () => {
  const base = {
    layout: 'fyp', title_bar: 'Biaya TG mandiri\ndibedah', hook_bar: 'Modal mulai 8 jutaan',
    facts: [], scenes: [{ type: 'hook', vo: 'Halo', highlight: 'Rp8 JUTAAN', cues: [], items: [] }],
  };
  assert.deepEqual(validateScript(base), []);
  assert.match(validateScript({ ...base, hook_bar: '' }).join('|'), /butuh title_bar dan hook_bar/);
  assert.match(validateScript({ ...base, title_bar: 'Judul yang terlalu panjang untuk satu baris bar' }).join('|'), /lebih dari 30/);
  assert.match(validateScript({ ...base, scenes: [{ ...base.scenes[0], highlight: '' }] }).join('|'), /frame pertama/);
  const price = { type: 'price', vo: 'Visa', highlight: 'mahal', cues: [], items: [] };
  assert.match(validateScript({ ...base, scenes: [base.scenes[0], price] }).join('|'), /price.*angka/);
  assert.deepEqual(validateScript({ ...base, layout: 'klasik', title_bar: '', hook_bar: '' }), [], 'klasik tidak butuh bar');
});
