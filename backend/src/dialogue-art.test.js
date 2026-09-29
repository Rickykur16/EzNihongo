import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectArt, isExpressionKey, loadArtManifest } from './dialogue-art.js';
import { normalizeDialogScene, publicDialogScene } from './dialogue-scene.js';

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};
function png(colorType, { trns = false, width = 480, height = 720 } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    ...(trns ? [chunk('tRNS', Buffer.from([0, 0, 0, 0, 0, 0]))] : []), chunk('IDAT', Buffer.alloc(8)), chunk('IEND', Buffer.alloc(0))]);
}
function webp(kind, { alpha = true, width = 480, height = 720 } = {}) {
  const body = Buffer.alloc(18);
  if (kind === 'VP8X') { body[0] = alpha ? 0x10 : 0; body.writeUIntLE(width - 1, 4, 3); body.writeUIntLE(height - 1, 7, 3); }
  if (kind === 'VP8L') { body[0] = 0x2f; body.writeUInt32LE(((width - 1) | ((height - 1) << 14) | ((alpha ? 1 : 0) << 28)) >>> 0, 1); }
  const size = Buffer.alloc(4); size.writeUInt32LE(body.length);
  const riff = Buffer.alloc(4); riff.writeUInt32LE(4 + 8 + body.length);
  return Buffer.concat([Buffer.from('RIFF'), riff, Buffer.from('WEBP'), Buffer.from(kind, 'latin1'), size, body]);
}

test('uploads must be PNG/WebP that declare transparency, with their real size', () => {
  assert.deepEqual(inspectArt(png(6)), { mime: 'image/png', width: 480, height: 720, alpha: true });
  assert.equal(inspectArt(png(4)).alpha, true);
  assert.equal(inspectArt(png(2, { trns: true })).alpha, true);
  assert.match(inspectArt(png(2)).error, /transparan/);
  assert.deepEqual(inspectArt(webp('VP8X', { width: 960, height: 1440 })), { mime: 'image/webp', alpha: true, width: 960, height: 1440 });
  assert.deepEqual(inspectArt(webp('VP8L', { width: 300, height: 450 })), { mime: 'image/webp', alpha: true, width: 300, height: 450 });
  assert.match(inspectArt(webp('VP8X', { alpha: false })).error, /transparan/);
  assert.match(inspectArt(webp('VP8 ')).error, /transparan/);
  assert.match(inspectArt(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.padEnd(64))).error, /PNG atau WebP/);
  assert.match(inspectArt(png(6, { width: 5000 })).error, /4096/);
  assert.match(inspectArt(Buffer.concat([png(6), Buffer.alloc(2 * 1024 * 1024)])).error, /2 MB/);
});

test('expression keys are URL- and file-name-safe slugs', () => {
  assert.ok(isExpressionKey('senyum-lebar'));
  for (const bad of ['', '-kaget', 'Kaget', 'a/b', 'x'.repeat(33), null]) assert.equal(isExpressionKey(bad), false);
});

test('manifest groups uploads per catalog character and ignores unknown characters', async () => {
  const rows = [
    { character_key: 'anna-wijaya', expression_key: 'base', label: 'Dasar', width: 480, height: 720, version: 2 },
    { character_key: 'anna-wijaya', expression_key: 'kaget', label: 'Kaget', width: 480, height: 720, version: 1 },
    { character_key: 'someone-else', expression_key: 'kaget', label: 'Kaget', width: 1, height: 1, version: 1 },
  ];
  const { characters } = await loadArtManifest(async () => ({ rows }));
  assert.deepEqual(characters['anna-wijaya'], { base: { v: 2, width: 480, height: 720 },
    expressions: [{ key: 'kaget', label: 'Kaget', v: 1, width: 480, height: 720 }] });
  assert.deepEqual(characters['hadi-pratama'], { base: null, expressions: [] });
  assert.ok(!('someone-else' in characters));
});

const scene = () => ({ schemaVersion: 1, enabled: true, backgroundKey: 'classroom', participants: [
  { characterKey: 'anna-wijaya', position: 'left', speaker: 'A', displayName: 'Anna', voiceId: 'v1', voiceName: '', profileVersion: 1, custom: false },
  { characterKey: 'hadi-pratama', position: 'right', speaker: 'B', displayName: 'Hadi', voiceId: 'v2', voiceName: '', profileVersion: 1, custom: false }] });

test('scene keeps per-turn expressions aligned with lines and reaches the student', () => {
  const s = { ...scene(), expressions: [null, { speaker: 'A', text: 'えっ。', expression: 'kaget', extra: 1 }] };
  const normalized = normalizeDialogScene(s);
  assert.deepEqual(normalized.expressions, [null, { speaker: 'A', text: 'えっ。', expression: 'kaget' }]);
  assert.deepEqual(publicDialogScene(s).expressions, normalized.expressions);
  // No expression chosen: the stored scene stays exactly as before this feature.
  assert.ok(!('expressions' in normalizeDialogScene({ ...scene(), expressions: [null, null] })));
  assert.ok(!('expressions' in normalizeDialogScene(scene())));
  for (const bad of [[{ speaker: 'A', text: 'x', expression: 'Kaget' }], [{ speaker: 'A', expression: 'kaget' }],
    [{ speaker: 1, text: 'x', expression: 'kaget' }], 'kaget', Array(101).fill(null),
    [{ speaker: 'A', text: 'x'.repeat(2001), expression: 'kaget' }]]) {
    assert.throws(() => normalizeDialogScene({ ...scene(), expressions: bad }));
  }
});
