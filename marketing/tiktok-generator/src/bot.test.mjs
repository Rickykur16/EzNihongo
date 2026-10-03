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

test('filterNew membuang berita yang URL atau judulnya sudah pernah dilaporkan', async () => {
  const { filterNew } = await import('./scan.mjs');
  const seen = [{ headline: 'Jepang ubah syarat SSW!', url: 'https://a/1' }];
  const items = [
    { headline: 'Berita baru', url: 'https://a/1' },          // URL sama
    { headline: 'jepang UBAH syarat ssw', url: 'https://b/2' }, // judul sama (beda huruf/tanda baca)
    { headline: 'Tur rekrutmen baru', url: 'https://c/3' },
    { headline: 'Tanpa URL', url: '' },
  ];
  assert.deepEqual(filterNew(items, seen).map((i) => i.url), ['https://c/3']);
  assert.deepEqual(filterNew(undefined, seen), []);
});

test('foto: Pixabay dipakai lebih dulu, unduh largeImageURL, dan pesan jelas tanpa key', async () => {
  const { findPhoto, photoProvider } = await import('./photos.mjs');
  delete process.env.PIXABAY_API_KEY; delete process.env.PEXELS_API_KEY;
  assert.equal(photoProvider(), null);
  await assert.rejects(findPhoto('x'), /PIXABAY_API_KEY/);
  process.env.PEXELS_API_KEY = 'p'; process.env.PIXABAY_API_KEY = 'k';
  const calls = [];
  const prev = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://pixabay.com/api/')) return { ok: true, json: async () => ({ hits: [{ id: 1, user: 'u', pageURL: 'https://pixabay.com/p/1', largeImageURL: 'https://cdn.pixabay.com/1.jpg' }] }) };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(3) };
  };
  try {
    const r = await findPhoto('japan factory worker');
    assert.equal(r.provider, 'pixabay');
    assert.equal(r.data.length, 3);
    assert.match(calls[0], /key=k&q=japan%20factory%20worker/);
    assert.equal(calls[1], 'https://cdn.pixabay.com/1.jpg');
  } finally {
    global.fetch = prev; delete process.env.PIXABAY_API_KEY; delete process.env.PEXELS_API_KEY;
  }
});

test('/topik tanpa isi dijawab petunjuk dan tidak menjalankan riset', async () => {
  sent.length = 0;
  await handle(msg('/topik'));
  await handle(msg('/topik ab'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.length, 2);
  for (const s of sent) assert.match(s.text, /\/topik <topik bebas>/);
});
