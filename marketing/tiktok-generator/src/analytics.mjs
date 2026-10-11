// /hasil dengan screenshot: Claude membaca angka di screenshot analitik TikTok
// lalu menulis ringkasan pendek yang disimpan ke out/results.json (lihat guidance.mjs).
import Anthropic from '@anthropic-ai/sdk';
import { ask, textOf } from './plan.mjs';

const SYSTEM = `Kamu membaca screenshot analitik TikTok untuk akun EzNihongo.
Tulis ringkasan 1-3 baris berbahasa Indonesia berisi HANYA angka yang terlihat di gambar:
tayangan, rata-rata ditonton (detik/%), % menonton sampai habis, titik penonton paling banyak berhenti,
suka, komentar, dibagikan, disimpan, pengikut baru, sumber trafik. Lewati yang tidak terlihat; jangan menebak.`;

export async function summarizeScreenshot(data, mediaType = 'image/jpeg') {
  const msg = await ask(new Anthropic(), {
    role: 'research',
    system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: data.toString('base64') } },
      { type: 'text', text: 'Ringkas angka di screenshot ini.' },
    ] }],
  });
  return textOf(msg);
}
