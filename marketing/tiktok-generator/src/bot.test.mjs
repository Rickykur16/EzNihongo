import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.TELEGRAM_BOT_TOKEN = 'T';
process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
const sent = [];
global.fetch = async (url, init) => {
  const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
  sent.push({ method: String(url).split('/').pop(), ...body });
  return { json: async () => ({ ok: true, result: [] }), status: 200 };
};
const { handle, reviewMessage } = await import('./bot.mjs');
const { ideasMessage, loadIdea } = await import('./ideas.mjs');

const msg = (text, id = 42) => ({ chat: { id }, text });

test('pesan dari selain admin diabaikan total', async () => {
  sent.length = 0;
  await handle(msg('/ide', 999));
  await handle(msg('/render', 7));
  assert.equal(sent.length, 0);
});

test('perintah tidak dikenal dan /buat tanpa nomor dijawab petunjuk, tidak menjalankan apa pun', async () => {
  sent.length = 0;
  await handle(msg('halo'));
  await handle(msg('/buat abc'));
  await new Promise((r) => setTimeout(r, 20));
  assert.match(sent[0].text, /Perintah/);
  assert.match(sent[1].text, /\/buat <nomor ide>/);
});

test('reviewMessage menampilkan klaim yang perlu dicek dan masalah naskah', () => {
  const s = {
    title: 'T', caption: 'C',
    scenes: [{ type: 'hook', vo: 'Halo' }],
    facts: [{ claim: 'Mulai April 2027', confidence: 'terkonfirmasi' }, { claim: 'Syarat N5', confidence: 'perlu_dicek' }],
  };
  const m = reviewMessage(s, ['cue hilang']);
  assert.match(m, /Perlu dicek:\n• Syarat N5/);
  assert.doesNotMatch(m, /• Mulai April 2027/);
  assert.match(m, /cue hilang/);
  assert.match(m, /\/render/);
});

test('ideasMessage bernomor dan muat di batas Telegram', () => {
  const long = Array.from({ length: 5 }, (_, i) => ({ title: 'x'.repeat(900), hook: `h${i}`, why_now: 'w' }));
  const m = ideasMessage(long);
  assert.ok(m.length <= 4000);
  assert.match(ideasMessage([{ title: 'A', hook: 'B', why_now: 'C' }]), /1\. A\n.*"B"/);
});

test('loadIdea menolak nomor di luar daftar', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ideas-'));
  await fs.mkdir(path.join(root, 'ideas/d'), { recursive: true });
  await fs.writeFile(path.join(root, 'ideas/d/ideas.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]));
  await fs.writeFile(path.join(root, 'latest-ideas.txt'), path.join(root, 'ideas/d'));
  assert.equal((await loadIdea(root, 2)).title, 'B');
  await assert.rejects(loadIdea(root, 3), /tidak ada \(tersedia 1-2\)/);
});
