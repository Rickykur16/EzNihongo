// Public vocab catalog sourced from Notion, level-scoped.
//
// Notion is treated as a REFERENCE source: there is no background sync. The
// in-memory cache (per slug) is primed from `notion_vocab_cache` on boot and
// then only mutated when an admin calls POST /api/admin/notion-vocab/refresh
// (or :slug). Reads never trigger a Notion fetch.
//
// Payload shape returned to the dashboard:
//   { sections: [{ name, bab: [{ kode, nomor, name, vocab: [...] }] }] }  ← preferred
//   { bab: [{ kode, nomor, name, vocab: [...] }] }                        ← when no
//     curator section structure can be parsed (no level page, parse failed)
// Both also carry `totalKata`. The persisted payload uses the same shape.
//
// Section structure is read once per refresh from a curator page in Notion
// (env NOTION_<SLUG>_PAGE_ID). Pattern recognised: a paragraph whose rich_text
// is entirely bold = section header; the bulleted_list_items that follow it
// (with a link to a Notion page) = the Bab in that section. Synced_blocks are
// traversed transparently.

import { Router } from 'express';
import { asyncHandler, requireAuth, requireAdmin } from '../middleware.js';
import { query } from '../db.js';
import {
  NOTION_VOCAB_DB_ID_DEFAULT,
  NOTION_BAB_DB_ID_DEFAULT,
  NOTION_VOCAB_LESSON_RELATION,
  notionIdFromInput,
  notionPlainText,
  notionNumber,
  pickProp,
  notionQueryAll,
  notionGetBlockChildren,
  richTextAllBold,
  richTextPlain,
  notionPlainPageId,
} from '../notion.js';

const router = Router();

// Levels we ship right now. Adding a new one is just an entry here — the slug
// is uppercased and used as the "Kode Bab" prefix filter on Notion.
const SUPPORTED_SLUGS = ['n5', 'n4', 'n3', 'n2', 'n1'];

// Slug -> Notion page holding the curator's section structure. Override per
// slug via env NOTION_<SLUG>_PAGE_ID. Without a configured page, the response
// falls back to a flat Bab list ordered by Nomor Bab.
const DEFAULT_LEVEL_PAGE_IDS = {
  n5: '34dbb13ef58381cfba40f2065a7f262e',
};
function levelPageId(slug) {
  const env = process.env[`NOTION_${slug.toUpperCase()}_PAGE_ID`];
  return notionIdFromInput(env) || DEFAULT_LEVEL_PAGE_IDS[slug] || null;
}

// cache[slug] = { fetchedAt: number, data: { bab: [...], totalKata: N }, error: string | null }
const cache = new Map();
const inflight = new Map(); // slug -> Promise

function envIds() {
  return {
    vocabDbId: notionIdFromInput(process.env.NOTION_VOCAB_DB_ID) || NOTION_VOCAB_DB_ID_DEFAULT,
    babDbId: notionIdFromInput(process.env.NOTION_BAB_DB_ID) || NOTION_BAB_DB_ID_DEFAULT,
    token: process.env.NOTION_TOKEN || '',
  };
}

// Walk the curator's level page in Notion to extract sections. Returns
// [{ name, babIds: ['<32-hex>', ...] }, ...] in the order they appear on the
// page. Synced_blocks are followed transparently; max depth 5 prevents loops.
async function parseLevelSections(pageId, token) {
  const sections = [];
  let current = null;
  const visited = new Set();
  async function walk(blockId, depth) {
    if (depth > 5 || visited.has(blockId)) return;
    visited.add(blockId);
    let children;
    try { children = await notionGetBlockChildren(blockId, token); }
    catch (err) {
      console.warn(`parseLevelSections: get children ${blockId} failed:`, err.message);
      return;
    }
    for (const block of children) {
      const type = block.type;
      if (type === 'synced_block') {
        const src = block.synced_block && block.synced_block.synced_from;
        const srcId = (src && src.block_id) || block.id;
        await walk(srcId, depth + 1);
      } else if (type === 'paragraph') {
        const rich = (block.paragraph && block.paragraph.rich_text) || [];
        if (richTextAllBold(rich)) {
          const name = richTextPlain(rich).trim();
          if (name) {
            current = { name, babIds: [] };
            sections.push(current);
          }
        }
      } else if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
        const rich = (block[type] && block[type].rich_text) || [];
        let pid = null;
        for (const t of rich) {
          let url = null;
          if (t.href) url = t.href;
          else if (t.text && t.text.link && t.text.link.url) url = t.text.link.url;
          else if (t.mention && t.mention.page && t.mention.page.id) url = t.mention.page.id;
          pid = notionPlainPageId(url);
          if (pid) break;
        }
        if (pid && current) current.babIds.push(pid);
      }
    }
  }
  await walk(pageId, 0);
  return sections;
}

async function fetchLevelFromNotion(slug) {
  const { vocabDbId, babDbId, token } = envIds();
  if (!token) {
    const e = new Error('NOTION_TOKEN not set');
    e.code = 'notion_not_configured';
    throw e;
  }
  const prefix = slug.toUpperCase() + '-';

  // 1) Bab pages matching the slug. Filter: `Kode Bab` starts_with "N5-".
  const babPages = await notionQueryAll(babDbId, token, {
    filter: { property: 'Kode Bab', rich_text: { starts_with: prefix } },
  });
  const babs = babPages.map((p) => {
    const props = p.properties || {};
    return {
      id: p.id,
      kode: notionPlainText(pickProp(props, ['Kode Bab', 'Kode'])).trim() || null,
      nomor: notionNumber(pickProp(props, ['Nomor Bab', 'Nomor'])),
      name: notionPlainText(pickProp(props, ['Bab', 'Name', 'Title'])).trim() || '(tanpa judul)',
    };
  }).sort((a, b) => {
    if (a.nomor != null && b.nomor != null) return a.nomor - b.nomor;
    if (a.nomor != null) return -1;
    if (b.nomor != null) return 1;
    return (a.kode || '').localeCompare(b.kode || '');
  });

  // 2) For each Bab, vocab pages linked via the `Lesson` relation. Sequential
  // (not parallel) to be polite to Notion's rate limits; each level has
  // bounded N so total wall-time stays modest.
  const out = [];
  let totalKata = 0;
  for (const bab of babs) {
    let vocabPages = [];
    try {
      vocabPages = await notionQueryAll(vocabDbId, token, {
        filter: { property: NOTION_VOCAB_LESSON_RELATION, relation: { contains: bab.id } },
      });
    } catch (err) {
      // One Bab's vocab failing shouldn't kill the whole level. Log + continue.
      console.warn(`notion-public: bab ${bab.kode || bab.id} vocab fetch failed:`, err.message);
    }
    const vocab = [];
    for (const page of vocabPages) {
      const props = page.properties || {};
      const japanese = notionPlainText(pickProp(props, ['Japanese 日本語', 'Japanese', '日本語', 'Bahasa Jepang'])).trim();
      if (!japanese) continue;
      vocab.push({
        id: page.id,
        japanese,
        reading: notionPlainText(pickProp(props, ['Reading 読み', 'Reading', '読み', 'Cara Baca'])).trim() || '',
        indonesian: notionPlainText(pickProp(props, ['Indonesian', 'Bahasa Indonesia'])).trim() || '',
        category: notionPlainText(pickProp(props, ['Category', 'Kategori'])).trim() || '',
        note: notionPlainText(pickProp(props, ['Note', 'Catatan'])).trim() || '',
      });
    }
    vocab.sort((a, b) => a.japanese.localeCompare(b.japanese));
    out.push({
      id: bab.id,
      kode: bab.kode,
      nomor: bab.nomor,
      name: bab.name,
      vocab,
    });
    totalKata += vocab.length;
  }

  // 3) Try to layer the curator's section structure on top. Bab the page
  // doesn't reference go into a trailing "Lainnya" group so nothing is lost.
  const pageId = levelPageId(slug);
  if (pageId) {
    try {
      const parsed = await parseLevelSections(pageId, token);
      if (parsed.length > 0) {
        const byPlainId = new Map(out.map((b) => [String(b.id).replace(/-/g, ''), b]));
        const sections = parsed
          .map((s) => ({
            name: s.name,
            bab: s.babIds.map((pid) => byPlainId.get(pid)).filter(Boolean),
          }))
          .filter((s) => s.bab.length > 0);
        if (sections.length > 0) {
          const seenBabIds = new Set();
          for (const s of sections) for (const b of s.bab) seenBabIds.add(b.id);
          const orphans = out.filter((b) => !seenBabIds.has(b.id));
          if (orphans.length > 0) sections.push({ name: 'Lainnya', bab: orphans });
          return { sections, totalKata };
        }
      }
    } catch (err) {
      console.warn('parseLevelSections failed (falling back to flat bab list):', err.message);
    }
  }
  return { bab: out, totalKata };
}

async function persistSlug(slug, data, fetchedAtMs) {
  try {
    await query(
      `INSERT INTO notion_vocab_cache (slug, payload, fetched_at)
       VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0))
       ON CONFLICT (slug) DO UPDATE
         SET payload = EXCLUDED.payload,
             fetched_at = EXCLUDED.fetched_at`,
      [slug, JSON.stringify(data), fetchedAtMs]
    );
  } catch (err) {
    console.warn(`notion-public: persist ${slug} failed:`, err.message);
  }
}

async function loadSlugFromDb(slug) {
  try {
    const r = await query(
      `SELECT payload, EXTRACT(EPOCH FROM fetched_at) * 1000 AS fetched_at_ms
       FROM notion_vocab_cache WHERE slug = $1`,
      [slug]
    );
    if (r.rows.length === 0) return null;
    return {
      fetchedAt: Number(r.rows[0].fetched_at_ms) || 0,
      data: r.rows[0].payload,
      error: null,
    };
  } catch (err) {
    console.warn(`notion-public: db load ${slug} failed:`, err.message);
    return null;
  }
}

async function refreshSlug(slug) {
  // De-dupe concurrent refreshes for the same slug.
  if (inflight.has(slug)) return inflight.get(slug);
  const p = (async () => {
    try {
      const data = await fetchLevelFromNotion(slug);
      const fetchedAt = Date.now();
      cache.set(slug, { fetchedAt, data, error: null });
      // Persist the fresh payload — UPSERT replaces the existing row so the
      // table doesn't grow with each sync, and a later Notion outage can be
      // served from this saved copy instead of returning empty.
      await persistSlug(slug, data, fetchedAt);
      return cache.get(slug);
    } catch (err) {
      // Notion failed. Keep the last good payload in memory (and on disk),
      // just annotate the error so the caller can surface it if needed.
      const prev = cache.get(slug) || (await loadSlugFromDb(slug));
      const entry = {
        fetchedAt: prev?.fetchedAt || 0,
        data: prev?.data || null,
        error: err.message || String(err),
      };
      cache.set(slug, entry);
      return entry;
    } finally {
      inflight.delete(slug);
    }
  })();
  inflight.set(slug, p);
  return p;
}

// Public read — never triggers a Notion fetch. Reads the in-memory cache,
// falls back to the persisted DB row, otherwise replies 502/503 so the
// frontend can render its own fallback.
router.get('/notion-vocab', asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase().trim();
  if (!SUPPORTED_SLUGS.includes(slug)) {
    return res.status(400).json({ error: 'unsupported_slug', supported: SUPPORTED_SLUGS });
  }
  let entry = cache.get(slug);
  if (!entry || !entry.data) {
    const fromDb = await loadSlugFromDb(slug);
    if (fromDb) {
      cache.set(slug, fromDb);
      entry = fromDb;
    }
  }
  if (!entry?.data) {
    return res.status(502).json({ error: 'notion_cache_empty', detail: 'Admin belum sinkronisasi dari Notion' });
  }
  res.set('Cache-Control', 'private, max-age=120'); // 2 min browser cache
  res.json({
    slug,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    ...entry.data,
  });
}));

// Admin-only manual sync. POST /api/admin/notion-vocab/refresh refreshes all
// slugs, /api/admin/notion-vocab/refresh/n5 refreshes one. Returns per-slug
// summary.
router.post('/admin/notion-vocab/refresh/:slug?', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { token } = envIds();
  if (!token) {
    return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  }
  const oneSlug = req.params.slug && String(req.params.slug).toLowerCase().trim();
  if (oneSlug && !SUPPORTED_SLUGS.includes(oneSlug)) {
    return res.status(400).json({ error: 'unsupported_slug', supported: SUPPORTED_SLUGS });
  }
  const slugs = oneSlug ? [oneSlug] : SUPPORTED_SLUGS;
  const results = [];
  for (const slug of slugs) {
    const entry = await refreshSlug(slug);
    const data = entry?.data || null;
    const totalKata = (data && typeof data.totalKata === 'number') ? data.totalKata : 0;
    const babCount = data?.sections
      ? data.sections.reduce((n, s) => n + (s.bab?.length || 0), 0)
      : (data?.bab?.length || 0);
    results.push({
      slug,
      ok: !entry?.error,
      error: entry?.error || null,
      totalKata,
      babCount,
      sectionCount: data?.sections?.length || 0,
      fetchedAt: entry?.fetchedAt ? new Date(entry.fetchedAt).toISOString() : null,
    });
  }
  res.json({ results });
}));

async function primeFromDb() {
  // Restore every persisted slug into the in-memory cache so reads after a
  // restart serve immediately. Notion is never touched from here.
  for (const slug of SUPPORTED_SLUGS) {
    const entry = await loadSlugFromDb(slug);
    if (entry && entry.data) cache.set(slug, entry);
  }
}

// Boot hook: load the DB-persisted cache into memory. No background sync —
// Notion is a reference, refreshes are admin-triggered via the route above.
export function startNotionCacheRefresh() {
  primeFromDb().catch((e) => console.warn('notion-public primeFromDb:', e.message));
}

export default router;

