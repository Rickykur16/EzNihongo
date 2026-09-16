// VM-slice test for welcome.html's parseDialogLinesFE / resolveSpeakerNames —
// confirms a real chosen speaker name (migration 148) is used directly as
// the display name and is NEVER re-guessed by resolveSpeakerNames' text-
// scanning heuristic, while every existing legacy-coded dialogue (N/A/B,
// 男/女) keeps resolving exactly as it did before this change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const start = html.indexOf('function parseDialogLinesFE(text) {');
const end = html.indexOf('const GK_PALETTES', start);
assert.ok(start > 0 && end > start, 'parseDialogLinesFE/resolveSpeakerNames slice markers not found');

function setup() {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}

test('a real chosen name is used as speaker AND displayName directly, untouched by guessing', () => {
  const ctx = setup();
  const turns = ctx.parseDialogLinesFE(
    'N: アンナさんとハディさんがはじめてあいます。\nアンナ: はじめまして。わたしはリナです。\nハディ: どうぞよろしく。'
  );
  // Anna's own line mentions a DIFFERENT name ("リナ") — if the legacy
  // self-intro heuristic ran on this turn it would wrongly reassign her
  // displayName to "リナ". It must not, because her speaker code IS already
  // the real name.
  assert.equal(turns[1].speaker, 'アンナ');
  assert.equal(turns[1].displayName, undefined, 'no override needed — downstream already falls back to speaker for a real name');
  assert.equal(turns[2].speaker, 'ハディ');
  assert.equal(turns[2].displayName, undefined);
});

test('legacy A/B self-intro guessing is completely unchanged for old dialogues', () => {
  const ctx = setup();
  // resolveSpeakerNames' NAME_RE/SELF_RE are kanji+katakana only (hiragana
  // deliberately excluded, per its own comment) — 田中/山田 in kanji, as
  // real curriculum dialogues actually write them, not the hiragana spelling.
  const turns = ctx.parseDialogLinesFE(
    'N: 男の人と女の人が話しています。\nA: わたしは田中です。\nB: わたしは山田です。'
  );
  assert.equal(turns[1].speaker, 'A');
  assert.equal(turns[1].displayName, '田中');
  assert.equal(turns[2].speaker, 'B');
  assert.equal(turns[2].displayName, '山田');
});

test('legacy code with no resolvable name falls back to leaving displayName unset, as before', () => {
  const ctx = setup();
  const turns = ctx.parseDialogLinesFE('N: 場面です。\nA: こんにちは。\nB: こんにちは。');
  assert.equal(turns[1].displayName, undefined);
  assert.equal(turns[2].displayName, undefined);
});

test('narrator turn (N) is never assigned a displayName either way', () => {
  const ctx = setup();
  const turns = ctx.parseDialogLinesFE('N: これは場面です。\nアンナ: こんにちは。');
  assert.equal(turns[0].speaker, 'N');
  assert.equal(turns[0].displayName, undefined);
});
