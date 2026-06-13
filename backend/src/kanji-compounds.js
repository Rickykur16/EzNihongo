// Resolusi "Kombinasi kosakata" per kanji, dipakai bersama oleh dua endpoint
// publik supaya tidak pernah melenceng:
//   - GET /api/kanji        (kanji-public.js)  → "Daftar Kanji" sidebar
//   - GET /api/courses/:slug (content.js)      → kanji di dalam Materi
//
// Aturan: kalau admin sudah isi kolom manual `kanji_items.compounds`, itu yang
// dipakai. Kalau kosong (default '[]'), turunkan otomatis dari vocab kelas yang
// mengandung karakter kanji tsb (cap N).

export function normalizeKanjiCompounds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    japanese: String(item?.japanese || '').trim(),
    reading: String(item?.reading || '').trim(),
    indonesian: String(item?.indonesian || '').trim(),
  })).filter((item) => item.japanese || item.reading || item.indonesian);
}

// Manual compounds menang; kalau kosong, turunkan dari vocab kelas yang
// mengandung karakter (cap N). vocabRows = [{ japanese, reading, indonesian }].
export function resolveKanjiCompounds(rawCompounds, character, vocabRows, cap = 8) {
  const manual = normalizeKanjiCompounds(rawCompounds);
  if (manual.length > 0) return manual;
  const ch = character || '';
  if (!ch) return [];
  const out = [];
  for (const v of vocabRows || []) {
    if ((v.japanese || '').includes(ch)) {
      out.push({ japanese: v.japanese, reading: v.reading, indonesian: v.indonesian });
      if (out.length >= cap) break;
    }
  }
  return out;
}
