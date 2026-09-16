// VM-slice tests for the per-turn dialogue editor's pure helpers
// (admParseDialogPair / admSerializeDialogPair) in admin.html — same
// technique as grammar-task-sessions-ui.test.js: run the ACTUAL source
// slice out of admin.html, not a reimplementation, so a change to the real
// function is what these tests exercise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const start = html.indexOf('const DIALOG_SPK_RE =');
const end = html.indexOf('async function admLoadDialogSpeakers', start);
assert.ok(start > 0 && end > start, 'dialogue editor pure-helper slice markers not found');

function setup() {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}
// vm.createContext objects/arrays are a DIFFERENT realm than this file's —
// assert/strict's deepEqual checks prototype identity, so a vm-context [},
// even with identical own-properties, never reference-equals an outer-realm
// literal. Round-tripping through JSON strips realm identity, leaving only
// the plain data deepEqual actually needs to compare (same technique used
// by admin-boot.test.js / grammar-task-sessions-ui.test.js).
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));

test('admParseDialogPair: zips JP and ID lines by position, speaker from JP wins', () => {
  const ctx = setup();
  const rows = plain(ctx.admParseDialogPair(
    'N: 場面です。\nアンナ: はじめまして。\nハディ: どうぞよろしく。',
    'N: A scene.\nアンナ: Nice to meet you.\nハディ: Pleasure.'
  ));
  assert.deepEqual(rows, [
    { speaker: 'N', jp: '場面です。', id: 'A scene.' },
    { speaker: 'アンナ', jp: 'はじめまして。', id: 'Nice to meet you.' },
    { speaker: 'ハディ', jp: 'どうぞよろしく。', id: 'Pleasure.' },
  ]);
});

test('admParseDialogPair: mismatched line counts still zip by index instead of crashing', () => {
  const ctx = setup();
  const rows = plain(ctx.admParseDialogPair('N: 一つ目。\nアンナ: 二つ目。', 'N: Only one line.'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'Only one line.');
  assert.equal(rows[1].id, '', 'row with no matching ID line gets an empty translation, not undefined/crash');
});

test('admParseDialogPair: empty input produces zero rows (caller adds a blank starter row)', () => {
  const ctx = setup();
  assert.deepEqual(plain(ctx.admParseDialogPair('', '')), []);
});

test('admSerializeDialogPair: round-trips through the flat "PREFIX: text" format parseDialog expects', () => {
  const ctx = setup();
  const { jp, id } = ctx.admSerializeDialogPair([
    { speaker: 'N', jp: '場面です。', id: 'A scene.' },
    { speaker: 'アンナ', jp: 'はじめまして。', id: 'Nice to meet you.' },
  ]);
  assert.equal(jp, 'N: 場面です。\nアンナ: はじめまして。');
  assert.equal(id, 'N: A scene.\nアンナ: Nice to meet you.');
});

test('admSerializeDialogPair: a row with blank JP is dropped, not serialized as an empty turn', () => {
  const ctx = setup();
  const { jp, id } = ctx.admSerializeDialogPair([
    { speaker: 'N', jp: '', id: 'should be dropped too' },
    { speaker: 'アンナ', jp: 'はじめまして。', id: '' },
  ]);
  assert.equal(jp, 'アンナ: はじめまして。');
  assert.equal(id, 'アンナ: ');
});

test('admParseDialogPair → admSerializeDialogPair round trip is stable (idempotent re-edit)', () => {
  const ctx = setup();
  const originalJp = 'N: 男の人と女の人が話しています。\nアンナ: お国はどちらですか。\nハディ: インドネシアです。';
  const originalId = 'N: A man and woman are talking.\nアンナ: Where are you from?\nハディ: Indonesia.';
  const rows = ctx.admParseDialogPair(originalJp, originalId);
  const { jp, id } = ctx.admSerializeDialogPair(rows);
  assert.equal(jp, originalJp);
  assert.equal(id, originalId);
});
