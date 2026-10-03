// Mengubah alignment per karakter dari ElevenLabs menjadi durasi adegan dan
// waktu cue (kapan elemen muncul) per adegan.
//
// Teks VO dikirim ke ElevenLabs sebagai gabungan `vo` tiap adegan dengan
// pemisah SEP, jadi offset karakter tiap adegan bisa dihitung persis.

export const SEP = '\n';
const LEAD = 0.12;   // adegan mulai sedikit sebelum kata pertamanya terdengar
const TAIL = 0.9;    // jeda setelah kata terakhir sebelum video selesai

export function joinVo(scenes) {
  const offsets = [];
  let text = '';
  scenes.forEach((s, i) => {
    if (i) text += SEP;
    offsets.push(text.length);
    text += s.vo;
  });
  return { text, offsets };
}

// alignment: { characters[], character_start_times_seconds[], character_end_times_seconds[] }
export function sceneTimings(scenes, alignment) {
  const { offsets } = joinVo(scenes);
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const n = starts.length;
  const firstSpoken = (from, to) => {
    for (let i = from; i < Math.min(to, n); i++) {
      if (!/\s/.test(alignment.characters[i])) return starts[i];
    }
    return starts[Math.min(from, n - 1)];
  };
  const sceneStart = scenes.map((s, i) => {
    const t = firstSpoken(offsets[i], offsets[i] + s.vo.length);
    return i === 0 ? 0 : Math.max(0, t - LEAD);
  });
  const audioEnd = ends[n - 1];
  return scenes.map((s, i) => {
    const start = sceneStart[i];
    const end = i < scenes.length - 1 ? sceneStart[i + 1] : audioEnd + TAIL;
    const cues = {};
    for (const { target, phrase } of s.cues || []) {
      const at = s.vo.toLowerCase().indexOf(String(phrase).toLowerCase());
      if (at < 0) continue; // frasa tidak ditemukan -> template memakai waktu bawaan
      cues[target] = Math.max(0, firstSpoken(offsets[i] + at, offsets[i] + s.vo.length) - start - 0.05);
    }
    return { start, dur: +(end - start).toFixed(3), cues };
  });
}

// Cadangan bila model ElevenLabs tidak mendukung timestamp: suara dibuat per
// adegan, durasi diukur dari file, cue diperkirakan dari posisi karakter.
export function timingsFromDurations(scenes, durations) {
  let t = 0;
  return scenes.map((s, i) => {
    const dur = durations[i] + (i === scenes.length - 1 ? TAIL : 0.15);
    const cues = {};
    for (const { target, phrase } of s.cues || []) {
      const at = s.vo.toLowerCase().indexOf(String(phrase).toLowerCase());
      if (at >= 0) cues[target] = (at / Math.max(1, s.vo.length)) * durations[i];
    }
    const out = { start: t, dur: +dur.toFixed(3), cues };
    t += dur;
    return out;
  });
}
