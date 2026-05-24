// gen-kanji-tts-allowlist.mjs — extract the set of Japanese strings that the
// Kanji PWA (app/kanji.html) can speak, into a static allowlist consumed by
// the TTS anti-abuse whitelist (backend/src/routes/tts.js).
//
// The kanji content (KD array) is embedded client-side in app/kanji.html and
// is NOT mirrored in Postgres, so the DB-based /api/tts whitelist can't see
// it. The speaker buttons read `v.w` (vocab) and `s.j` (example sentence);
// this script collects exactly those strings (plus the kanji char itself) so
// the backend accepts them — and only them — for ElevenLabs generation.
//
// Regenerate whenever KD changes:
//   cd backend && node scripts/gen-kanji-tts-allowlist.mjs
//
// Output: backend/data/kanji-tts-allowlist.json (array of unique strings).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const KANJI_HTML = resolve(REPO_ROOT, 'app', 'kanji.html');
const OUT_DIR = resolve(__dirname, '..', 'data');
const OUT_FILE = resolve(OUT_DIR, 'kanji-tts-allowlist.json');

const html = readFileSync(KANJI_HTML, 'utf8');

// Slice the `const KD = [ ... ];` array literal out of the file. The array is
// our own trusted content, so evaluating it with new Function is acceptable
// for this build-time script.
const startMarker = 'const KD = [';
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) {
  console.error('Could not find `const KD = [` in', KANJI_HTML);
  process.exit(1);
}
const arrStart = html.indexOf('[', startIdx);
// Match brackets to find the array's closing `]`.
let depth = 0;
let endIdx = -1;
let inStr = null;
for (let i = arrStart; i < html.length; i++) {
  const ch = html[i];
  if (inStr) {
    if (ch === '\\') { i++; continue; }
    if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx === -1) {
  console.error('Could not find end of KD array');
  process.exit(1);
}

const arrLiteral = html.slice(arrStart, endIdx + 1);
// eslint-disable-next-line no-new-func
const KD = Function(`"use strict"; return (${arrLiteral});`)();

const set = new Set();
const add = (v) => {
  const s = String(v || '').trim();
  if (s) set.add(s);
};

for (const entry of KD) {
  if (!entry || typeof entry !== 'object') continue;
  add(entry.k); // kanji character
  if (Array.isArray(entry.v)) {
    for (const v of entry.v) add(v && v.w); // vocab word
  }
  // Sentences: array or single object (frontend supports both).
  const sentences = Array.isArray(entry.s) ? entry.s : (entry.s ? [entry.s] : []);
  for (const s of sentences) add(s && s.j); // example sentence
}

const list = Array.from(set).sort();
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(list) + '\n', 'utf8');
console.log(`Wrote ${list.length} strings to ${OUT_FILE}`);
