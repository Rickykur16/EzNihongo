// Public "Daftar Kanji" untuk welcome.html. Source of truth = tabel
// `kanji_items` (admin CRUD-able). Pola mirror notion-public.js untuk
// section structure — kalau ada curator page Notion (env
// NOTION_KANJI_<SLUG>_PAGE_ID atau fallback NOTION_<SLUG>_PAGE_ID),
// section structure di-parse dari sana. Tanpa curator → flat list per
// bab_kode.
//
// Tidak pakai cache Notion table — kanji_items kecil (<500 row per
// level), query DB langsung cukup cepat. Browser cache 5 menit.
//
// Compound vocab per kanji diambil dari module_vocabulary course yang sama,
// lalu diverifikasi terhadap level setiap Kanji penyusun katanya.

import { Router } from 'express';
import { asyncHandler } from '../middleware.js';
import { query } from '../db.js';
import {
  notionIdFromInput,
  notionGetBlockChildren,
  richTextAllBold,
  richTextPlain,
  notionPlainPageId,
} from '../notion.js';
import { loadCourseVocab, deriveCompounds, loadKanjiCatalog } from '../kanji-compounds.js';

const router = Router();

const SUPPORTED_SLUGS = ['n5', 'n4', 'n3', 'n2', 'n1'];

function levelPageId(slug) {
  const env = process.env[`NOTION_KANJI_${slug.toUpperCase()}_PAGE_ID`]
    || process.env[`NOTION_${slug.toUpperCase()}_PAGE_ID`];
  return notionIdFromInput(env) || null;
}

// Walk Notion curator page → list of sections [{ name, babKodes: [...] }].
// Curator should use bulleted list items whose text contains the Kode Bab
// (e.g. "N5-01 Hiragana"); parser extracts the first matching Kode pattern.
// Optional layer — kalau gagal, fallback ke flat list per bab_kode.
const KODE_RE = /([A-Z]\d+-\d+)/i;
async function parseKanjiLevelSections(pageId, token) {
  const sections = [];
  let current = null;
  const visited = new Set();
  async function walk(blockId, depth) {
    if (depth > 5 || visited.has(blockId)) return;
    visited.add(blockId);
    let children;
    try { children = await notionGetBlockChildren(blockId, token); }
    catch (err) { console.warn('parseKanjiLevelSections children:', err.message); return; }
    for (const block of children) {
      const type = block.type;
      if (type === 'synced_block') {
        const src = block.synced_block && block.synced_block.synced_from;
        await walk((src && src.block_id) || block.id, depth + 1);
      } else if (type === 'paragraph') {
        const rich = (block.paragraph && block.paragraph.rich_text) || [];
        if (richTextAllBold(rich)) {
          const name = richTextPlain(rich).trim();
          if (name) {
            current = { name, babKodes: [] };
            sections.push(current);
          }
        }
      } else if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
        const rich = (block[type] && block[type].rich_text) || [];
        const text = richTextPlain(rich);
        const m = text.match(KODE_RE);
        if (m && current) current.babKodes.push(m[1].toUpperCase());
      }
    }
  }
  await walk(pageId, 0);
  return sections;
}

router.get('/kanji', asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase().trim();
  if (!SUPPORTED_SLUGS.includes(slug)) {
    return res.status(400).json({ error: 'unsupported_slug', supported: SUPPORTED_SLUGS });
  }

  // Aggregate kanji dari semua pelajaran type='kanji' di course slug ini.
  // Group by lesson (= 1 Bab di UI), order by module.sort_order > lesson.sort_order.
  const rows = (await query(
    `SELECT k.id, k.character, k.jlpt_level, k.on_reading, k.kun_reading,
            k.meaning_id, k.mnemonic, k.compounds, k.stroke_count, k.bab_kode, k.sort_order,
            l.id AS lesson_id, l.title AS lesson_title, l.sort_order AS lesson_sort,
            m.id AS module_id, m.title AS module_title, m.sort_order AS module_sort,
            c.level AS course_level
       FROM kanji_items k
       JOIN lessons l ON l.id = k.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE c.slug = $1 AND l.type = 'kanji'
      ORDER BY m.sort_order ASC, l.sort_order ASC, k.sort_order ASC, k.character ASC`,
    [slug]
  )).rows;

  // Attach compound vocab per kanji (lihat src/kanji-compounds.js — logika
  // sama dipakai juga oleh /api/courses/:slug supaya pelajaran & Daftar Kanji
  // menampilkan contoh kosakata yang identik).
  const vocab = await loadCourseVocab(slug);
  const kanjiCatalog = await loadKanjiCatalog();
  const attach = (k) => ({
    id: k.id, character: k.character, jlpt_level: k.jlpt_level,
    on_reading: k.on_reading, kun_reading: k.kun_reading,
    meaning_id: k.meaning_id, mnemonic: k.mnemonic,
    stroke_count: k.stroke_count, bab_kode: k.bab_kode,
    compounds: deriveCompounds(k.character, k.compounds, vocab, {
      moduleId: k.module_id,
      moduleSort: k.module_sort,
      courseLevel: k.course_level,
      kanjiCatalog,
    }),
  });

  // Group by lesson (1 Bab = 1 pelajaran tipe kanji).
  const babMap = new Map(); // lesson_id -> { ... }
  for (const k of rows) {
    if (!babMap.has(k.lesson_id)) {
      babMap.set(k.lesson_id, {
        kode: k.bab_kode || null,
        nomor: null,
        name: k.lesson_title || 'Pelajaran',
        moduleId: k.module_id,
        moduleTitle: k.module_title,
        kanji: [],
      });
    }
    babMap.get(k.lesson_id).kanji.push(attach(k));
  }
  const allBab = Array.from(babMap.values());

  // Optional section structure dari Notion curator page (kalau ada).
  // Fallback: kalau ada >1 module, group by module sebagai section.
  const token = process.env.NOTION_TOKEN || '';
  const pageId = levelPageId(slug);
  let sections = null;
  if (token && pageId) {
    try {
      const parsed = await parseKanjiLevelSections(pageId, token);
      if (parsed.length > 0) {
        sections = parsed.map((sec) => ({
          name: sec.name,
          bab: sec.babKodes
            .map((kode) => allBab.find((b) => b.kode && b.kode.toUpperCase() === kode))
            .filter(Boolean),
        }));
        const seen = new Set();
        for (const s of sections) for (const b of s.bab) seen.add(b.kode);
        const orphans = allBab.filter((b) => !b.kode || !seen.has(b.kode));
        if (orphans.length > 0) sections.push({ name: 'Lainnya', bab: orphans });
      }
    } catch (err) {
      console.warn('kanji-public: parseSections failed:', err.message);
    }
  }
  if (!sections) {
    const moduleMap = new Map();
    for (const b of allBab) {
      if (!moduleMap.has(b.moduleId)) {
        moduleMap.set(b.moduleId, { name: b.moduleTitle, bab: [] });
      }
      moduleMap.get(b.moduleId).bab.push(b);
    }
    if (moduleMap.size > 1) sections = Array.from(moduleMap.values());
  }

  const totalKanji = rows.length;
  res.set('Cache-Control', 'private, max-age=300');
  if (sections) {
    res.json({ slug, fetchedAt: new Date().toISOString(), sections, totalKanji });
  } else {
    res.json({ slug, fetchedAt: new Date().toISOString(), bab: allBab, totalKanji });
  }
}));

export default router;
