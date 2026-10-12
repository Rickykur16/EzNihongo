// VM-slice tests for the 🎭 Dialog editor's per-turn audio buttons in
// admin.html — the REAL admDialogRowHtml / admDialogRowTest source, not a
// reimplementation. The server side (one shared take per turn) is covered by
// dialogue-turn-audio.test.js; this pins what the editor sends it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const slice = (from, to) => {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  assert.ok(start > 0 && end > start, `slice markers not found: ${from}`);
  return html.slice(start, end);
};
const source = [
  slice('function escapeHtml(s) {', '\n}\n') + '\n}\n',
  slice('function admSerializeDialogPair(rows) {', '\n}\n') + '\n}\n',
  slice('function admDialogRowHtml(r, i) {', 'function admDialogModalHtml()'),
  slice('// Dialogue turn previews read the same cached take', 'window.admDialogSave ='),
].join('\n');

function setup({ mode = 'grammar', scene = null, ok = true } = {}) {
  const calls = [], notes = [];
  const audio = { src: '', style: { display: 'none' }, played: 0, play() { this.played++; return Promise.resolve(); } };
  const ctx = vm.createContext({
    calls, notes, audio,
    window: { __dialogMode: mode, __dialogScene: scene, __dialogRows: [
      { speaker: 'N', jp: 'ふたりが はなしています。', id: '' },
      { speaker: 'A', jp: '   ', id: '' },
      { speaker: 'B', jp: ' はじめまして。 ', id: '' },
    ] },
    document: { getElementById: (key) => (key === 'dlg-audio-2' ? audio : null) },
    URL: { createObjectURL: () => 'blob:take', revokeObjectURL() {} },
    notify: (message, error) => notes.push({ message, error: !!error }),
    admSpeakerOptionsHtml: () => '',
    ezApi: async (path, opts) => {
      calls.push({ path, body: JSON.parse(opts.body) });
      return ok
        ? { ok: true, blob: async () => ({}) }
        : { ok: false, status: 409, json: async () => ({ error: 'turn_mismatch', detail: 'Teks giliran ini memuat baris baru.' }) };
    },
  });
  vm.runInContext(source, ctx);
  return ctx;
}
const button = () => ({ disabled: false, textContent: '🔊 Tes giliran ini' });

test('grammar dialogue: the turn test asks the shared per-turn cache with the whole dialogue', async () => {
  const ctx = setup({ scene: { participants: [{ speaker: 'B', voiceId: 'hadi-voice' }] } });
  const btn = button();
  await ctx.window.admDialogRowTest(2, btn);
  assert.equal(ctx.calls.length, 1);
  const { path, body } = ctx.calls[0];
  assert.equal(path, '/admin/tts/dialog-turn');
  assert.equal(body.dialog, 'N: ふたりが はなしています。\nB: はじめまして。', 'the dialogue exactly as it is saved');
  assert.equal(body.turnIndex, 1, 'blank rows are not turns');
  assert.equal(body.speaker, 'B');
  assert.equal(body.turnText, 'はじめまして。');
  assert.equal(body.regenerate, false);
  assert.equal(body.listening, false);
  assert.equal(body.dialogScene.participants[0].voiceId, 'hadi-voice');
  assert.equal(ctx.audio.src, 'blob:take');
  assert.equal(ctx.audio.played, 1);
  assert.equal(ctx.notes.length, 0);
  assert.equal(btn.disabled, false);
  assert.equal(btn.textContent, '🔊 Tes giliran ini');
});

test('"Buat ulang suara" replaces the shared turn in both modes and identifies the whole listening audio', async () => {
  for (const mode of ['grammar', 'listening']) {
    const ctx = setup({ mode });
    await ctx.window.admDialogRowTest(2, button(), true);
    assert.equal(ctx.calls[0].path, '/admin/tts/dialog-turn');
    assert.equal(ctx.calls[0].body.regenerate, true);
    assert.equal(ctx.calls[0].body.listening, mode === 'listening');
    assert.equal(ctx.audio.played, 1);
    assert.equal(ctx.notes.length, 1);
    assert.equal(ctx.notes[0].error, false);
    assert.match(ctx.notes[0].message, /[Ss]iswa/);
    if (mode === 'listening') assert.match(ctx.notes[0].message, /Audio listening utuh/);
  }
});

test('a refused turn shows the server reason instead of playing', async () => {
  const ctx = setup({ ok: false });
  await ctx.window.admDialogRowTest(2, button());
  assert.equal(ctx.audio.played, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.notes)), [{ message: 'Gagal generate audio: Teks giliran ini memuat baris baru.', error: true }]);
});

test('listening turn preview sends the full dialogue and exact turn to the shared cache at student tempo', async () => {
  const scene = { participants: [{ speaker: 'B', voiceId: 'hadi-voice' }] };
  const ctx = setup({ mode: 'listening', scene });
  ctx.window.EzDialogueFuriganaAdmin = { data: () => assert.fail('Listening must not inherit grammar furigana') };
  await ctx.window.admDialogRowTest(2, button());
  assert.equal(ctx.calls[0].path, '/admin/tts/dialog-turn');
  assert.deepEqual(ctx.calls[0].body, { dialog: 'N: ふたりが はなしています。\nB: はじめまして。',
    turnIndex: 1, speaker: 'B', turnText: 'はじめまして。', dialogScene: scene,
    regenerate: false, listening: true, dialogFurigana: null });
  assert.equal(ctx.audio.playbackRate, 0.9);
  assert.equal(ctx.audio.defaultPlaybackRate, 0.9);
  assert.equal(ctx.audio.preservesPitch, true);
});

test('both listening and grammar offer regeneration for voiced turns and hide it when voice is missing', () => {
  const row = { speaker: 'B', jp: 'はじめまして。', id: '' };
  for (const mode of ['grammar', 'listening']) {
    const voiced = setup({ mode, scene: { participants: [{ speaker: 'B', voiceId: 'hadi-voice' }] } });
    assert.match(voiced.admDialogRowHtml(row, 2), /onclick="admDialogRowTest\(2, this, true\)"[^>]*>↻ Buat ulang suara</);
    const voiceless = setup({ mode, scene: { participants: [{ speaker: 'B', voiceId: null }] } });
    assert.doesNotMatch(voiceless.admDialogRowHtml(row, 2), /Buat ulang suara/);
  }
});

test('grammar preview still sends its furigana and uses its own playback rate', async () => {
  const ctx = setup();
  const furigana = { lines: [{ text: 'fixture' }] };
  ctx.window.EzDialogueFuriganaAdmin = { data: () => furigana };
  await ctx.window.admDialogRowTest(2, button());
  assert.deepEqual(ctx.calls[0].body.dialogFurigana, furigana);
  assert.equal(ctx.calls[0].body.listening, false);
  assert.equal(ctx.audio.playbackRate, 1);
});

test('a preview finishing after its editor was closed cannot play into the replacement form', async () => {
  const ctx = setup({ mode: 'listening' });
  let release;
  ctx.ezApi = () => new Promise(resolve => { release = resolve; });
  const btn = button(), pending = ctx.window.admDialogRowTest(2, btn);
  ctx.document.getElementById = () => null;
  release({ ok: true, blob: async () => ({}) });
  await pending;
  assert.equal(ctx.audio.played, 0);
  assert.equal(btn.disabled, false);
});
