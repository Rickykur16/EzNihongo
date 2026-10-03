// Langkah 2 (setelah review manusia): suara + foto + render.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { resolveModel, resolveVoice, ttsWithTimestamps, tts } from './elevenlabs.mjs';
import { findPhoto } from './photos.mjs';
import { joinVo, sceneTimings, timingsFromDurations } from './timing.mjs';
import { validateScript } from './plan.mjs';
import { renderVideo } from './render.mjs';

const durationOf = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

async function photoFor(dir, name, query, credits) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const own = path.join(dir, 'photos', `${name}.${ext}`);
    if (existsSync(own)) return path.resolve(own);
  }
  if (!query) return '';
  const { data, credit, provider } = await findPhoto(query);
  const file = path.join(dir, 'photos', `${name}.${provider}.jpg`);
  await fs.writeFile(file, data);
  credits.push(`- Adegan ${name}: ${credit}`);
  return path.resolve(file);
}

async function voice(dir, scenes) {
  const modelId = await resolveModel();
  const voiceId = await resolveVoice();
  console.log(`  suara: model ${modelId}, voice ${voiceId}`);
  const audioPath = path.join(dir, 'vo.mp3');
  try {
    const { text } = joinVo(scenes);
    const { audio, alignment } = await ttsWithTimestamps(text, { voiceId, modelId });
    await fs.writeFile(audioPath, audio);
    await fs.writeFile(path.join(dir, 'alignment.json'), JSON.stringify(alignment));
    return { audioPath, timings: sceneTimings(scenes, alignment) };
  } catch (e) {
    if (!e.status || e.status >= 500) throw e;
    // Model tanpa dukungan timestamp: generate per adegan lalu sambung dengan jeda 0,15 dtk.
    console.warn(`  ⚠ timestamp tidak tersedia (${e.message.slice(0, 80)}…), memakai suara per adegan.`);
    const parts = [];
    const durations = [];
    for (const [i, sc] of scenes.entries()) {
      const f = path.join(dir, `vo-${i + 1}.mp3`);
      await fs.writeFile(f, await tts(sc.vo, { voiceId, modelId }));
      parts.push(f); durations.push(durationOf(f));
    }
    const list = path.join(dir, 'vo-list.txt');
    const gap = path.join(dir, 'gap.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.15', '-q:a', '9', gap]);
    await fs.writeFile(list, parts.map((p, i) => `file '${path.resolve(p)}'` + (i < parts.length - 1 ? `\nfile '${path.resolve(gap)}'` : '')).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '128k', audioPath]);
    return { audioPath, timings: timingsFromDurations(scenes, durations) };
  }
}

export async function build(dir, { force = false } = {}) {
  const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
  const problems = validateScript(script).filter((p) => !p.includes('perlu_dicek'));
  if (problems.length && !force) {
    throw new Error(`Naskah belum siap:\n- ${problems.join('\n- ')}\nPerbaiki script.json (atau pakai --force).`);
  }
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });

  console.log('▶ Suara…');
  const { audioPath, timings } = await voice(dir, script.scenes);

  console.log('▶ Foto…');
  const credits = [];
  const scenes = [];
  for (const [i, sc] of script.scenes.entries()) {
    const n = i + 1;
    const photo = await photoFor(dir, String(n), sc.photo_query, credits);
    const items = [];
    for (const [j, it] of sc.items.entries()) {
      items.push({ ...it, photo: sc.type === 'list' ? await photoFor(dir, `${n}-${j + 1}`, it.photo_query, credits) : '' });
    }
    scenes.push({ ...sc, photo, items, dur: timings[i].dur, cues: timings[i].cues });
  }
  if (credits.length) await fs.writeFile(path.join(dir, 'credits.md'), `# Foto stok\n\n${credits.join('\n')}\n`);

  console.log('▶ Render…');
  const outPath = path.join(dir, 'video.mp4');
  const { total } = await renderVideo({ spec: { scenes }, workDir: dir, audioPath, outPath });
  await fs.writeFile(path.join(dir, 'caption.txt'), `${script.caption}\n\nKomentar sematan: ${script.pinned_comment}\n`);
  console.log(`✔ Selesai: ${outPath} (${total.toFixed(1)} dtk). Cover: ${path.join(dir, 'cover.png')}`);
  return outPath;
}
