// Shared derivation untuk "kata yang memakai kanji ini".
//
// Satu karakter diperkenalkan sekali lewat lesson Kanji, tetapi kosakata yang
// memakainya terus bertambah di level berikutnya. Modul ini menjaga kedua arah:
//   1. detail Kanji mendapat contoh kata yang terurut dan tidak duplikat;
//   2. deck Kosakata mendapat metadata kanji lama/baru tanpa perlu membuat
//      lesson Kanji duplikat di setiap level.

export const KANJI_LEVEL_RANK = Object.freeze({ N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 });

const VOCAB_TTL = 5 * 60 * 1000;
const CATALOG_TTL = 5 * 60 * 1000;
const vocabCache = new Map(); // slug -> { ts, rows }
let catalogCache = null; // { ts, value: Map }

async function dbQuery(text, params) {
  const { query } = await import('./db.js');
  return query(text, params);
}

function clean(value) {
  return String(value ?? '').trim();
}

function levelRank(value) {
  return KANJI_LEVEL_RANK[clean(value).toUpperCase()] || 99;
}

function compoundKey(item) {
  return `${clean(item?.japanese).toLowerCase()}::${clean(item?.reading).toLowerCase()}`;
}

export function extractKanjiCharacters(value) {
  const out = [];
  const seen = new Set();
  for (const char of Array.from(clean(value))) {
    if (!/\p{Script=Han}/u.test(char) || seen.has(char)) continue;
    seen.add(char);
    out.push(char);
  }
  return out;
}

// Klasifikasi ini sengaja struktural, bukan tebakan on/kun. Hubungan bacaan
// on/kun tidak selalu aman diinferensikan hanya dari bentuk permukaan kata.
export function kanjiUsageKind(japanese, character) {
  const word = clean(japanese);
  const char = clean(character);
  if (word === char) return 'single';
  const rest = char ? word.split(char).join('') : word;
  if (/[\u3040-\u30ff]/u.test(rest)) return 'kanji_kana';
  if (extractKanjiCharacters(word).length >= 2) return 'compound';
  return 'word';
}

// Baris parsial tidak berguna untuk belajar. Manual yang valid tetap menjadi
// pilihan utama; metadata contoh/Bab akan dilengkapi dari bank kosakata bila
// kata yang sama ditemukan di sana.
export function normalizeKanjiCompounds(value, character = '') {
  if (!Array.isArray(value)) return [];
  const target = clean(character);
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const item = {
      japanese: clean(raw?.japanese),
      reading: clean(raw?.reading),
      indonesian: clean(raw?.indonesian),
    };
    if (!item.japanese || !item.reading || !item.indonesian) continue;
    if (target && !item.japanese.includes(target)) continue;
    const key = compoundKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function loadCourseVocab(slug) {
  const key = clean(slug).toLowerCase();
  const entry = vocabCache.get(key);
  if (entry && (Date.now() - entry.ts) < VOCAB_TTL) return entry.rows;
  const result = await dbQuery(
    `SELECT v.id AS vocabulary_id, v.module_id, c.level AS course_level,
            m.title AS module_title, m.sort_order AS module_sort,
            v.sort_order AS vocab_sort, v.japanese, v.reading,
            v.indonesian, v.category,
            ex.japanese AS example_japanese,
            ex.reading AS example_reading,
            ex.indonesian AS example_indonesian
       FROM module_vocabulary v
       JOIN modules m ON m.id = v.module_id
       JOIN courses c ON c.id = m.course_id
       LEFT JOIN LATERAL (
         SELECT e.japanese, e.reading, e.indonesian
           FROM vocabulary_examples e
          WHERE e.vocabulary_id = v.id
          ORDER BY e.sort_order ASC, e.created_at ASC
          LIMIT 1
       ) ex ON TRUE
      WHERE c.slug = $1
        AND v.japanese IS NOT NULL AND length(trim(v.japanese)) > 0
      ORDER BY m.sort_order ASC, v.sort_order ASC, v.created_at ASC`,
    [key]
  );
  vocabCache.set(key, { ts: Date.now(), rows: result.rows });
  return result.rows;
}

function catalogEntry(row) {
  const introducedLevel = clean(row.introduced_level || row.jlpt_level || row.course_level).toUpperCase();
  return {
    id: row.id,
    character: clean(row.character),
    jlpt_level: introducedLevel,
    introducedLevel,
    on_reading: clean(row.on_reading),
    kun_reading: clean(row.kun_reading),
    meaning_id: clean(row.meaning_id),
    stroke_count: row.stroke_count == null ? null : Number(row.stroke_count),
    bab_kode: clean(row.bab_kode),
    courseSlug: clean(row.course_slug),
    moduleTitle: clean(row.module_title),
    moduleSort: Number(row.module_sort) || 0,
    lessonSort: Number(row.lesson_sort) || 0,
  };
}

export function buildKanjiCatalog(rows) {
  const sorted = (rows || []).map(catalogEntry).filter((row) => row.character).sort((a, b) => (
    levelRank(a.introducedLevel) - levelRank(b.introducedLevel)
    || a.moduleSort - b.moduleSort
    || a.lessonSort - b.lessonSort
    || String(a.id).localeCompare(String(b.id))
  ));
  const catalog = new Map();
  for (const row of sorted) if (!catalog.has(row.character)) catalog.set(row.character, row);
  return catalog;
}

export async function loadKanjiCatalog() {
  if (catalogCache && (Date.now() - catalogCache.ts) < CATALOG_TTL) return catalogCache.value;
  const result = await dbQuery(
    `SELECT k.id, k.character, k.jlpt_level, k.on_reading, k.kun_reading,
            k.meaning_id, k.stroke_count, k.bab_kode,
            COALESCE(NULLIF(k.jlpt_level, ''), c.level) AS introduced_level,
            c.level AS course_level, c.slug AS course_slug,
            m.title AS module_title, m.sort_order AS module_sort,
            l.sort_order AS lesson_sort
       FROM kanji_items k
       JOIN lessons l ON l.id = k.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE c.is_published = TRUE AND l.type = 'kanji'`
  );
  const value = buildKanjiCatalog(result.rows);
  catalogCache = { ts: Date.now(), value };
  return value;
}

export function deriveKanjiUsages(japanese, catalog, context = {}) {
  const currentLevel = clean(context.currentLevel).toUpperCase();
  const currentRank = levelRank(currentLevel);
  const currentModuleSort = Number(context.currentModuleSort) || 0;
  return extractKanjiCharacters(japanese).map((character) => {
    const found = catalog instanceof Map ? catalog.get(character) : null;
    if (!found) return { character, status: 'unregistered', introducedLevel: '' };
    const introducedRank = levelRank(found.introducedLevel);
    let status = 'known';
    if (introducedRank > currentRank) status = 'future';
    else if (introducedRank === currentRank) {
      if (!currentModuleSort || !found.moduleSort) status = 'current_level';
      else if (found.moduleSort < currentModuleSort) status = 'known';
      else if (found.moduleSort === currentModuleSort) status = 'current';
      else status = 'upcoming';
    }
    return { ...found, status };
  });
}

function compoundScope(vocab, context) {
  const moduleId = clean(context.moduleId);
  const currentSort = Number(context.moduleSort) || 0;
  const rowSort = Number(vocab.module_sort) || 0;
  if (moduleId && clean(vocab.module_id) === moduleId) return 'current';
  if (currentSort && rowSort < currentSort) return 'previous';
  if (currentSort && rowSort > currentSort) return 'next';
  return 'course';
}

function enrichCompound(vocab, character, context) {
  return {
    japanese: clean(vocab.japanese),
    reading: clean(vocab.reading),
    indonesian: clean(vocab.indonesian),
    vocabularyId: vocab.vocabulary_id || null,
    kind: kanjiUsageKind(vocab.japanese, character),
    source: 'course',
    scope: compoundScope(vocab, context),
    usageLevel: clean(context.courseLevel).toUpperCase(),
    moduleId: vocab.module_id || null,
    moduleTitle: clean(vocab.module_title),
    moduleSort: Number(vocab.module_sort) || 0,
    vocabSort: Number(vocab.vocab_sort) || 0,
    exampleJapanese: clean(vocab.example_japanese),
    exampleReading: clean(vocab.example_reading),
    exampleIndonesian: clean(vocab.example_indonesian),
  };
}

function autoCompoundOrder(a, b, context) {
  const scopeRank = { current: 0, previous: 1, course: 2, next: 3 };
  const currentSort = Number(context.moduleSort) || 0;
  const aDistance = currentSort ? Math.abs(a.moduleSort - currentSort) : a.moduleSort;
  const bDistance = currentSort ? Math.abs(b.moduleSort - currentSort) : b.moduleSort;
  return (scopeRank[a.scope] ?? 9) - (scopeRank[b.scope] ?? 9)
    || aDistance - bDistance
    || a.vocabSort - b.vocabSort
    || Array.from(a.japanese).length - Array.from(b.japanese).length
    || a.japanese.localeCompare(b.japanese, 'ja');
}

// Manual menjadi kata utama, lalu bank kosakata dari level JLPT yang sama
// melengkapinya lintas Bab. Tidak ada target jumlah: semua kata relevan pada
// level aktif ditampilkan apa adanya, tanpa mengambil kosakata level berikutnya.
// Semua bentuk dipertahankan: kata tunggal, kanji+kana/okurigana, dan gabungan.
export function deriveCompounds(character, manualCompounds, vocab, context = {}) {
  const target = clean(character);
  if (!target) return [];
  const currentLevel = clean(context.courseLevel).toUpperCase();
  const automatic = (vocab || [])
    .filter((row) => !currentLevel || clean(row.course_level).toUpperCase() === currentLevel)
    .filter((row) => clean(row.japanese).includes(target))
    .filter((row) => clean(row.japanese) && clean(row.reading) && clean(row.indonesian))
    .map((row) => enrichCompound(row, target, context))
    .sort((a, b) => autoCompoundOrder(a, b, context));
  const autoByKey = new Map();
  for (const row of automatic) if (!autoByKey.has(compoundKey(row))) autoByKey.set(compoundKey(row), row);

  const out = [];
  const seen = new Set();
  for (const manual of normalizeKanjiCompounds(manualCompounds, target)) {
    const key = compoundKey(manual);
    const matched = autoByKey.get(key) || {};
    out.push({
      ...matched,
      ...manual,
      kind: matched.kind || kanjiUsageKind(manual.japanese, target),
      source: 'manual',
      scope: matched.scope || 'manual',
      usageLevel: matched.usageLevel || clean(context.courseLevel).toUpperCase(),
    });
    seen.add(key);
  }
  for (const row of automatic) {
    const key = compoundKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
