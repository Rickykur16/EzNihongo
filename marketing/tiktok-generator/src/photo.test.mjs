import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.TELEGRAM_BOT_TOKEN = 'T';
process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
const sent = [];
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.endsWith('/getFile')) {
    const { file_id } = JSON.parse(init.body);
    return { json: async () => ({ ok: true, result: { file_path: `photos/${file_id}.jpg` } }) };
  }
  if (u.includes('/file/botT/')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode(u).buffer };
  sent.push(JSON.parse(init.body).text);
  return { json: async () => ({ ok: true, result: {} }) };
};
const { handle } = await import('./bot.mjs');
const { photoSlots, pickSlot } = await import('./photoslots.mjs');

const script = {
  scenes: [
    { type: 'hook', vo: 'a', photo_query: 'factory', items: [] },
    { type: 'statement', vo: 'b', photo_query: '', items: [] },
    { type: 'list', vo: 'c', photo_query: '', items: [{ label: 'x', photo_query: 'warehouse' }, { label: 'y', photo_query: '' }] },
  ],
};

test('photoSlots: hanya adegan/item yang butuh foto', () => {
  assert.deepEqual(photoSlots(script).map((s) => s.slot), ['1', '3-1']);
});

test('foto dari Telegram tersimpan ke slot caption, lalu slot kosong berikutnya, dan menimpa format lama', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-'));
  process.chdir(root);
  const dir = path.join('out', 'v1');
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
  await fs.writeFile(path.join(dir, 'script.json'), JSON.stringify(script));
  await fs.writeFile(path.join('out', 'latest-plan.txt'), dir + '\n');
  await fs.writeFile(path.join(dir, 'photos', '3-1.png'), 'lama');

  await handle({ chat: { id: 42 }, caption: 'slot 3-1', photo: [{ file_id: 'kecil' }, { file_id: 'besar' }] });
  assert.match(await fs.readFile(path.join(dir, 'photos', '3-1.jpg'), 'utf8'), /besar/); // resolusi terbesar
  await assert.rejects(fs.access(path.join(dir, 'photos', '3-1.png')));                  // file lama dibuang
  assert.match(sent.at(-1), /Foto slot 3-1 tersimpan/);

  await handle({ chat: { id: 42 }, photo: [{ file_id: 'tanpacaption' }] });
  assert.match(await fs.readFile(path.join(dir, 'photos', '1.jpg'), 'utf8'), /tanpacaption/);

  await handle({ chat: { id: 42 }, caption: '9', photo: [{ file_id: 'z' }] });
  assert.match(sent.at(-1), /Slot "9" tidak ada/);

  sent.length = 0;
  await handle({ chat: { id: 7 }, photo: [{ file_id: 'orang-lain' }] });
  assert.equal(sent.length, 0);
  await assert.rejects(fs.access(path.join(dir, 'photos', '2.jpg')));
});

test('pickSlot tanpa caption saat semua terisi memberi pesan jelas', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slot-'));
  await fs.mkdir(path.join(root, 'photos'));
  await fs.writeFile(path.join(root, 'photos', '1.jpg'), 'x');
  await fs.writeFile(path.join(root, 'photos', '3-1.webp'), 'x');
  assert.throws(() => pickSlot('', photoSlots(script), root), /Semua slot sudah ada fotonya/);
});
