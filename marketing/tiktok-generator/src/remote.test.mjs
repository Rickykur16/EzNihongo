import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dispatchRender, jobName, readJob, writeJob } from './remote.mjs';

test('jobName hanya menerima folder out/YYYY-MM-DD-slug', () => {
  assert.equal(jobName('out/2026-10-12-biaya-ssw'), '2026-10-12-biaya-ssw');
  assert.equal(jobName('/srv/gen/out/2026-10-12-biaya-ssw/'), '2026-10-12-biaya-ssw');
  for (const bad of ['out/video', 'out/2026-10-12-Biaya', "out/2026-10-12-a'b", 'out/2026-10-12-a b']) {
    assert.throws(() => jobName(bad), /tidak bisa dipakai/, bad);
  }
});

test('writeJob → tar → readJob: foto & suara ikut, path foto jadi milik folder job', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'job-'));
  const dir = path.join(tmp, '2026-10-12-uji');
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
  const p1 = path.join(dir, 'photos', '1.jpg');
  const p2 = path.join(dir, 'photos', '3-1.pexels.jpg');
  await fs.writeFile(p1, 'A'); await fs.writeFile(p2, 'B');
  await fs.writeFile(path.join(dir, 'vo.mp3'), 'VO');
  const scenes = [
    { type: 'hook', photo: p1, items: [] },
    { type: 'list', photo: '', items: [{ text: 'x', photo: p2 }, { text: 'y', photo: p1 }] },
  ];
  const tgz = await writeJob(dir, { scenes, audioPath: path.join(dir, 'vo.mp3') });

  const jobDir = path.join(tmp, 'runner-job');
  await fs.mkdir(jobDir);
  execFileSync('tar', ['-xzf', tgz, '-C', jobDir]);
  const { spec, audioPath } = await readJob(jobDir);
  assert.equal(await fs.readFile(audioPath, 'utf8'), 'VO');
  assert.equal(await fs.readFile(spec.scenes[0].photo, 'utf8'), 'A');
  assert.equal(await fs.readFile(spec.scenes[1].items[0].photo, 'utf8'), 'B');
  assert.equal(spec.scenes[1].items[1].photo, spec.scenes[0].photo, 'foto yang sama hanya disalin sekali');
  assert.equal(spec.scenes[1].photo, '');
  assert.ok(spec.scenes[0].photo.startsWith(jobDir + path.sep), 'path foto menunjuk ke folder job di runner');
});

test('readJob menolak path foto yang keluar dari folder job', async () => {
  const jobDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-'));
  await fs.writeFile(path.join(jobDir, 'spec.json'), JSON.stringify({ scenes: [{ photo: '../../etc/passwd', items: [] }] }));
  await assert.rejects(readJob(jobDir), /di luar folder job/);
});

test('dispatchRender memicu workflow tiktok-render.yml di main dengan input job', async () => {
  process.env.GITHUB_RENDER_TOKEN = 'tok';
  process.env.GITHUB_RENDER_REPO = 'Rickykur16/EzNihongo';
  const calls = [];
  const orig = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, init }); return { status: 204, text: async () => '' }; };
  try {
    await dispatchRender('2026-10-12-uji');
    assert.equal(calls[0].url, 'https://api.github.com/repos/Rickykur16/EzNihongo/actions/workflows/tiktok-render.yml/dispatches');
    assert.equal(calls[0].init.headers.authorization, 'Bearer tok');
    assert.deepEqual(JSON.parse(calls[0].init.body), { ref: 'main', inputs: { job: '2026-10-12-uji' } });

    global.fetch = async () => ({ status: 403, text: async () => 'Resource not accessible' });
    await assert.rejects(dispatchRender('2026-10-12-uji'), /403/);
    await assert.rejects(dispatchRender('../etc'), /tidak valid/);
  } finally { global.fetch = orig; }
});
