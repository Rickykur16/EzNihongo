// Shared "kombinasi kosakata" (compound vocab) derivation untuk kanji.
//
// Dipakai oleh DUA jalur yang sama-sama mengisi modal detail kanji di
// welcome.html (`openKanjiDetail`):
//   - routes/kanji-public.js  → GET /api/kanji        ("Daftar Kanji" sidebar)
//   - routes/content.js       → GET /api/courses/:slug ("pelajaran" tipe kanji)
//
// Sebelumnya cuma kanji-public.js yang auto-derive compounds dari bank
// kosakata course, sedangkan content.js cuma mengirim kolom mentah
// `kanji_items.compounds` (biasanya kosong) → kanji yang sama tampil beda /
// kosong tergantung dibuka dari Daftar Kanji atau dari pelajaran. Menyatukan
// logika di sini supaya keduanya identik.

import { query } from './db.js';

// Cap jumlah contoh kosakata auto per kanji. Dipakai sama di kedua jalur
// supaya hasilnya identik.
export const COMPOUND_CAP = 8;

// Cache vocab per slug (in-memory only, 5-minute TTL). Avoids re-querying
// the same course-vocab list across concurrent requests (dipakai bersama
// oleh /api/kanji dan /api/courses/:slug).
const vocabCache = new Map(); // slug -> { ts, rows }
const VOCAB_TTL = 5 * 60 * 1000;

export function normalizeKanjiCompounds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    japanese: String(item?.japanese || '').trim(),
    reading: String(item?.reading || '').trim(),
    indonesian: String(item?.indonesian || '').trim(),
  })).filter((item) => item.japanese || item.reading || item.indonesian);
}

export async function loadCourseVocab(slug) {
  const key = String(slug || '').toLowerCase().trim();
  const entry = vocabCache.get(key);
  if (entry && (Date.now() - entry.ts) < VOCAB_TTL) return entry.rows;
  const r = await query(
    `SELECT v.japanese, v.reading, v.indonesian
       FROM module_vocabulary v
       JOIN modules m ON m.id = v.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE c.slug = $1 AND v.japanese IS NOT NULL AND length(v.japanese) > 0`,
    [key]
  );
  vocabCache.set(key, { ts: Date.now(), rows: r.rows });
  return r.rows;
}

// Compounds manual (admin-set) menang; kalau kosong, auto-cari kata di bank
// kosakata course yang MENGANDUNG karakter kanji ini (cap COMPOUND_CAP).
export function deriveCompounds(character, manualCompounds, vocab) {
  const manual = normalizeKanjiCompounds(manualCompounds);
  if (manual.length > 0) return manual;
  const ch = character;
  const out = [];
  if (!ch) return out;
  for (const v of vocab || []) {
    if ((v.japanese || '').includes(ch)) {
      out.push({ japanese: v.japanese, reading: v.reading, indonesian: v.indonesian });
      if (out.length >= COMPOUND_CAP) break;
    }
  }
  return out;
}
