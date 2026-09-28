import { query } from './db.js';
import { dialogueCatalog } from './dialogue-scene.js';

// Character art uploaded from the admin (migration 177). 'base' replaces the
// bundled image; every other key is an expression of that character.
export const BASE_EXPRESSION = 'base';
export const MAX_ART_BYTES = 2 * 1024 * 1024;
export const MAX_EXPRESSIONS_PER_CHARACTER = 24;
const EXPRESSION_KEY = /^[a-z0-9][a-z0-9-]{0,31}$/;
const characterKeys = new Set(dialogueCatalog.characters.map(c => c.key));

export const isCharacterKey = key => characterKeys.has(key);
export const isExpressionKey = key => typeof key === 'string' && EXPRESSION_KEY.test(key);

// Reads the header of an uploaded image. The stage draws uploads without a
// mask, so only formats that can carry transparency are accepted, and only
// when the file actually declares an alpha channel.
export function inspectArt(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30) return { error: 'Berkas gambar tidak terbaca.' };
  if (buffer.length > MAX_ART_BYTES) return { error: 'Gambar maksimal 2 MB.' };
  const png = inspectPng(buffer) || inspectWebp(buffer);
  if (!png) return { error: 'Gunakan gambar PNG atau WebP.' };
  if (!png.alpha) return { error: 'Latar gambar harus transparan (PNG/WebP dengan alpha).' };
  if (png.width > 4096 || png.height > 4096) return { error: 'Ukuran gambar maksimal 4096 px.' };
  return png;
}

function inspectPng(b) {
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20), colorType = b[25];
  let alpha = colorType === 4 || colorType === 6;
  // Palette/greyscale/RGB images carry transparency in a tRNS chunk before IDAT.
  for (let at = 8; !alpha && at + 8 <= b.length;) {
    const length = b.readUInt32BE(at), type = b.toString('latin1', at + 4, at + 8);
    if (type === 'tRNS') alpha = true;
    if (type === 'IDAT' || type === 'IEND') break;
    at += 12 + length;
  }
  return { mime: 'image/png', width, height, alpha };
}

function inspectWebp(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('latin1', 12, 16);
  if (chunk === 'VP8X') {
    return { mime: 'image/webp', alpha: (b[20] & 0x10) !== 0,
      width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  if (chunk === 'VP8L' && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return { mime: 'image/webp', alpha: ((bits >>> 28) & 1) === 1,
      width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { mime: 'image/webp', alpha: false, width: 0, height: 0 };
  return null;
}

// What the stage and the admin need to build image URLs: per character, the
// uploaded base (or null = bundled image) and its expressions in upload order.
export async function loadArtManifest(run = query) {
  const rows = (await run(`SELECT character_key, expression_key, label, width, height, version
    FROM dialogue_character_art ORDER BY character_key, created_at, expression_key`)).rows;
  const characters = {};
  for (const key of characterKeys) characters[key] = { base: null, expressions: [] };
  for (const row of rows) {
    const entry = characters[row.character_key];
    if (!entry) continue;
    const art = { v: row.version, width: row.width, height: row.height };
    if (row.expression_key === BASE_EXPRESSION) entry.base = art;
    else entry.expressions.push({ key: row.expression_key, label: row.label, ...art });
  }
  return { characters };
}
