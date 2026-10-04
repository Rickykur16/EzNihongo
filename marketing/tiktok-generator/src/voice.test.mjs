import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { voice } from './build.mjs';
import { joinVo } from './timing.mjs';

const scenes = [{ vo: 'Program magang dihapus?!', cues: [] }, { vo: 'Gantinya Ikusei Shuuro.', cues: [] }];
const alignmentFor = (text) => {
  const characters = [...text];
  return { characters, character_start_times_seconds: characters.map((_, i) => i * 0.05), character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.05) };
};

function fakeEleven() {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(String(url));
    const { text } = JSON.parse(init.body);
    return new Response(JSON.stringify({ audio_base64: Buffer.from('mp3').toString('base64'), alignment: alignmentFor(text) }), { status: 200 });
  };
  return calls;
}

test('render ulang memakai suara sebelumnya; teks berubah → suara dibuat ulang', async () => {
  process.env.ELEVENLABS_API_KEY = 'k'; process.env.ELEVENLABS_MODEL = 'm'; process.env.ELEVENLABS_VOICE_ID = 'v';
  const realFetch = global.fetch;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-'));
  try {
    const calls = fakeEleven();
    await voice(dir, scenes);
    assert.equal(calls.length, 1);
    const again = await voice(dir, scenes);
    assert.equal(calls.length, 1, 'tidak boleh memanggil ElevenLabs lagi');
    assert.equal(again.timings.length, 2);
    await voice(dir, [scenes[0], { ...scenes[1], vo: 'Gantinya program baru.' }]);
    assert.equal(calls.length, 2, 'teks berubah harus generate ulang');
  } finally { global.fetch = realFetch; }
});

test('hasil versi lama (tanpa voice-cache.json) dipakai bila teks alignment sama', async () => {
  const realFetch = global.fetch;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-'));
  try {
    await fs.writeFile(path.join(dir, 'vo.mp3'), 'mp3');
    await fs.writeFile(path.join(dir, 'alignment.json'), JSON.stringify(alignmentFor(joinVo(scenes).text)));
    const calls = fakeEleven();
    await voice(dir, scenes);
    assert.equal(calls.length, 0);
  } finally { global.fetch = realFetch; }
});
