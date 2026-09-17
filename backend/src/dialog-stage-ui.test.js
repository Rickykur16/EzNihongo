// Paket 4 — panggung dialog, dijalankan sebagai KODE ASLI welcome.html
// (teknik vm-slice yang sama dengan grammar-task-sessions-ui.test.js), bukan
// reimplementasi. Yang diuji adalah klaim yang paling mudah rusak diam-diam:
// panggung tidak punya timer sendiri, identitasnya tidak pernah dikarang, dan
// transkrip lama tidak berubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `slice tidak ketemu: ${start}`);
  return html.slice(from, to);
};
const source = slice('function parseDialogLinesFE(text)', 'window.grammarKaraokePlay = async (key)');

// DOM tiruan seperlunya: cukup untuk merender string dan untuk
// gkStageSpeak/gkStageIdle mencari elemen.
function makeCtx() {
  const listeners = [];
  const store = {};
  const mkEl = (attrs = {}, cls = []) => ({
    dataset: attrs, _cls: new Set(cls), style: { _v: {},
      setProperty(k, v) { this._v[k] = v; }, removeProperty(k) { delete this._v[k]; } },
    classList: {
      _o: null,
      toggle(c, on) { if (on) this._o._cls.add(c); else this._o._cls.delete(c); },
      add(c) { this._o._cls.add(c); }, remove(c) { this._o._cls.delete(c); },
      contains(c) { return this._o._cls.has(c); },
    },
  });
  const wire = (el) => { el.classList._o = el; return el; };
  const ctx = {
    window: { __gk: {} },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    escapeHtml: (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    document: { _root: null, getElementById: (id) => ctx.document._root },
    setTimeout: () => 0, clearTimeout: () => {},
    Audio: function (src) {
      this.src = src; this.paused = true; this.playbackRate = 1;
      this.addEventListener = (ev, fn) => listeners.push([ev, fn, this]);
      this.play = () => { this.paused = false; fire(this, 'play'); return { catch: () => {} }; };
      this.pause = () => { this.paused = true; fire(this, 'pause'); };
      this.end = () => { fire(this, 'ended'); };
    },
    console,
  };
  const fire = (target, ev) => listeners.filter(([e, , t]) => e === ev && t === target).forEach(([, fn]) => fn());
  ctx._mkEl = (a, c) => wire(mkEl(a, c));
  ctx._store = store;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx;
}

const DIALOG = [
  'N: ミナさんとハディさんが はなしています。',
  'ミナ: はじめまして。ミナです。',
  'ハディ: はじめまして。ハディです。',
  'ミナ: どうぞ よろしく。',
].join('\n');

test('panggung merender satu actor per pembicara, narator tidak dapat actor', () => {
  const ctx = makeCtx();
  const out = vm.runInContext(`renderKaraokeStatic(${JSON.stringify(DIALOG)}, 'k1', '')`, ctx);
  const actors = out.match(/class="gk-actor"/g) || [];
  assert.equal(actors.length, 2, 'ミナ + ハディ, bukan narator');
  assert.match(out, /data-sp-idx="0"/);
  assert.match(out, /data-sp-idx="1"/);
});

test('identitas panggung diambil dari sumber yang sama dengan bubble — tidak dikarang', () => {
  const ctx = makeCtx();
  const out = vm.runInContext(`renderKaraokeStatic(${JSON.stringify(DIALOG)}, 'k1', '')`, ctx);
  // Nama yang muncul di actor harus nama yang sama dengan yang dipakai bubble.
  assert.match(out, /<div class="gk-actor-name">ミナ<\/div>/);
  assert.match(out, /<div class="gk-actor-name">ハディ<\/div>/);
  // Dialog tanpa nama sama sekali: kode pembicara dipakai apa adanya, bukan
  // diganti tokoh rekaan.
  const anon = 'A: こんにちは。\nB: こんにちは。';
  const out2 = vm.runInContext(`renderKaraokeStatic(${JSON.stringify(anon)}, 'k2', '')`, ctx);
  assert.match(out2, /<div class="gk-actor-name">A<\/div>/);
  assert.match(out2, /<div class="gk-actor-name">B<\/div>/);
  assert.doesNotMatch(out2, /さん/);
});

test('panggung bergerak hanya ketika audio benar-benar berbunyi', () => {
  const ctx = makeCtx();
  const line0 = ctx._mkEl({ lineIndex: '1', spIdx: '0' }, ['gk-line']);
  const actor0 = ctx._mkEl({ spIdx: '0', tint: '#FFE7E5' }, ['gk-actor']);
  const actor1 = ctx._mkEl({ spIdx: '1', tint: '#E9EEF8' }, ['gk-actor']);
  const stage = {
    style: { _v: {}, setProperty(k, v) { this._v[k] = v; }, removeProperty(k) { delete this._v[k]; } },
    querySelectorAll: () => [actor0, actor1],
  };
  ctx.document._root = {
    querySelector: (sel) => (sel.includes('gk-stage') ? stage : sel.includes('data-line-index="1"') ? line0 : null),
  };

  const audio = vm.runInContext(`(function(){ const a = new Audio('x'); gkStageBind('k', a, 1); return a; })()`, ctx);
  assert.equal(actor0.classList.contains('is-speaking'), false, 'diam sebelum play');

  audio.play();
  assert.equal(actor0.classList.contains('is-speaking'), true, 'bicara saat play');
  assert.equal(actor1.classList.contains('is-speaking'), false, 'yang lain tetap diam');
  assert.equal(stage.style._v['--gk-stage-tint'], '#FFE7E5', 'latar ikut pembicara aktif');

  audio.pause();
  assert.equal(actor0.classList.contains('is-speaking'), false, 'JEDA menghentikan gerak');
  assert.equal(stage.style._v['--gk-stage-tint'], undefined);

  audio.play();
  assert.equal(actor0.classList.contains('is-speaking'), true, 'lanjut lagi setelah resume');
  audio.end();
  assert.equal(actor0.classList.contains('is-speaking'), false, 'selesai → diam');
});

test('segment milik narator membuat semua actor diam, bukan menebak penutur', () => {
  const ctx = makeCtx();
  const actor0 = ctx._mkEl({ spIdx: '0', tint: '#FFE7E5' }, ['gk-actor', 'is-speaking']);
  const stage = {
    style: { _v: { '--gk-stage-tint': '#FFE7E5' }, setProperty(k, v) { this._v[k] = v; }, removeProperty(k) { delete this._v[k]; } },
    querySelectorAll: () => [actor0],
  };
  // Segment 0 = narator: tidak ada .gk-line dengan index itu.
  ctx.document._root = { querySelector: (sel) => (sel.includes('gk-stage') ? stage : null) };
  vm.runInContext(`gkStageSpeak('k', 0)`, ctx);
  assert.equal(actor0.classList.contains('is-speaking'), false);
  assert.equal(stage.style._v['--gk-stage-tint'], undefined);
});

test('panggung bisa dimatikan sebagai kontrol statis, dan pilihannya bertahan', () => {
  const ctx = makeCtx();
  assert.equal(vm.runInContext('gkGetStageMode()', ctx), 'on', 'default menyala');
  ctx._store.ez_dialog_stage = 'off';
  assert.equal(vm.runInContext('gkGetStageMode()', ctx), 'off');
  assert.equal(vm.runInContext(`gkStageLabel('off')`, ctx), 'Panggung: off');
  // Nilai asing tidak boleh diterima diam-diam.
  ctx._store.ez_dialog_stage = 'maybe';
  assert.equal(vm.runInContext('gkGetStageMode()', ctx), 'on');
});

test('transkrip lama tidak berubah: bubble, tombol per-baris, dan arti tetap ada', () => {
  const ctx = makeCtx();
  const out = vm.runInContext(
    `renderKaraokeStatic(${JSON.stringify(DIALOG)}, 'k1', 'N: Mina dan Hadi sedang berbicara.\\nA: Salam kenal.\\nB: Salam kenal.\\nA: Mohon bantuannya.')`,
    ctx);
  assert.match(out, /gk-scene-tag/, 'kartu Situasi');
  assert.equal((out.match(/class="gk-line gk-side-/g) || []).length, 3, 'tiga bubble percakapan');
  assert.equal((out.match(/grammarKaraokeJumpTo/g) || []).length, 4, 'putar per-baris utuh (3 bubble + 1 narator)');
  assert.match(out, /gk-reveal/, 'tombol lihat arti');
  // Panggung berada DI ANTARA situasi dan bubble — di dalam blok dialog yang
  // sudah ada, bukan hero terpisah di atas halaman.
  assert.ok(out.indexOf('gk-scene') < out.indexOf('gk-stage'));
  assert.ok(out.indexOf('gk-stage') < out.indexOf('gk-bubbles'));
});

test('tidak ada timer adegan mandiri di kode panggung', () => {
  // Pagar tekstual: rencana melarang timer yang jalan sendiri saat audio
  // berhenti. Kalau suatu saat ada yang menambahkannya, tes ini yang jatuh.
  const stageCode = slice('function gkStageEls(key)', 'function gkSyncActiveLine');
  assert.doesNotMatch(stageCode, /setInterval|requestAnimationFrame|setTimeout/);
});
