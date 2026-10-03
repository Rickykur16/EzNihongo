import test from 'node:test';
import assert from 'node:assert/strict';
import { joinVo, sceneTimings, timingsFromDurations } from './timing.mjs';
import { validateScript } from './plan.mjs';

// Alignment palsu: tiap karakter 0,05 dtk, spasi/pemisah ikut dihitung.
function fakeAlignment(text, cps = 0.05) {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * cps),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * cps),
  };
}

const scenes = [
  { vo: 'Program magang dihapus?!', cues: [] },
  { vo: 'Iya, resmi. Gantinya Ikusei Shuuro.', cues: [{ target: 'highlight', phrase: 'Ikusei Shuuro' }] },
  { vo: 'Minimal en lima.', cues: [{ target: 'badge', phrase: 'EN LIMA' }, { target: 'item0', phrase: 'tidak ada' }] },
];

test('joinVo menghitung offset tiap adegan', () => {
  const { text, offsets } = joinVo(scenes);
  assert.equal(text.slice(offsets[1], offsets[1] + 4), 'Iya,');
  assert.equal(text.slice(offsets[2], offsets[2] + 7), 'Minimal');
});

test('durasi adegan menyambung tanpa celah dan adegan pertama mulai di 0', () => {
  const { text } = joinVo(scenes);
  const t = sceneTimings(scenes, fakeAlignment(text));
  assert.equal(t[0].start, 0);
  for (let i = 1; i < t.length; i++) assert.ok(Math.abs(t[i - 1].start + t[i - 1].dur - t[i].start) < 1e-3);
  // adegan 2 dimulai sedikit sebelum kata pertamanya
  const { offsets } = joinVo(scenes);
  assert.ok(t[1].start < offsets[1] * 0.05 && t[1].start > offsets[1] * 0.05 - 0.2);
});

test('cue jatuh tepat saat frasa diucapkan, case-insensitive, frasa hilang diabaikan', () => {
  const { text, offsets } = joinVo(scenes);
  const t = sceneTimings(scenes, fakeAlignment(text));
  const spoken = (offsets[1] + scenes[1].vo.indexOf('Ikusei')) * 0.05;
  assert.ok(Math.abs(t[1].start + t[1].cues.highlight - spoken) < 0.1);
  assert.ok('badge' in t[2].cues);
  assert.ok(!('item0' in t[2].cues));
});

test('cadangan durasi per adegan', () => {
  const t = timingsFromDurations(scenes, [1.5, 2.5, 1.2]);
  assert.equal(t[1].start, 1.65);
  assert.ok(t[1].cues.highlight > 0 && t[1].cues.highlight < 2.5);
});

test('validateScript menangkap hook hilang, cue salah, dan singkatan di vo', () => {
  const bad = {
    scenes: [
      { type: 'statement', vo: 'Syaratnya N5.', cues: [{ target: 'badge', phrase: 'nggak ada' }], items: [] },
      { type: 'compare', vo: 'Dulu dan sekarang.', cues: [], items: [{}] },
    ],
    facts: [{ claim: 'x', source_url: 'u', confidence: 'perlu_dicek' }],
  };
  const p = validateScript(bad).join('\n');
  assert.match(p, /bukan tipe "hook"/);
  assert.match(p, /cue "nggak ada"/);
  assert.match(p, /N5/);
  assert.match(p, /compare\) harus punya 2/);
  assert.match(p, /perlu_dicek/);
});
