// Public vocab catalog sourced from Notion, level-scoped.
//
// Design: an in-memory cache keyed by slug (n5, n4, …) holds the aggregated
// {bab: [{ kode, nomor, name, vocab: […] }]} for each level. A background
// setInterval refreshes the cache for every supported level every
// NOTION_CACHE_TTL_MS so the dashboard's "Daftar Kosakata" stays fresh
// without admin needing to manually import each Bab.
//
// Slug -> Notion filter: each Bab in Notion has a `Kode Bab` text in the
// form "N5-B3", so we filter the Bab DB by `Kode Bab` starts_with
// "${slug.toUpperCase()}-". For each matching Bab we then query the Vocab
// DB filtered by the `Lesson` relation. N+1 but each level has a bounded
// number of Bab so it's fine; the result is cached.

import { Router } from 'express';
import { asyncHandler } from '../middleware.js';
import {
  NOTION_VOCAB_DB_ID_DEFAULT,
  NOTION_BAB_DB_ID_DEFAULT,
  NOTION_VOCAB_LESSON_RELATION,
  notionIdFromInput,
  notionPlainText,
  notionNumber,
  pickProp,
  notionQueryAll,
} from '../notion.js';

const router = Router();

// Levels we ship right now. Adding a new one is just an entry here — the slug
// is uppercased and used as the "Kode Bab" prefix filter on Notion.
const SUPPORTED_SLUGS = ['n5', 'n4', 'n3', 'n2', 'n1'];

const TTL_MS = Number(process.env.NOTION_CACHE_TTL_MS) || 30 * 60 * 1000; // 30 min default
const REFRESH_MS = Number(process.env.NOTION_CACHE_REFRESH_MS) || TTL_MS;

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
  return { bab: out, totalKata };
}

async function refreshSlug(slug) {
  // De-dupe concurrent refreshes for the same slug.
  if (inflight.has(slug)) return inflight.get(slug);
  const p = (async () => {
    try {
      const data = await fetchLevelFromNotion(slug);
      cache.set(slug, { fetchedAt: Date.now(), data, error: null });
      return cache.get(slug);
    } catch (err) {
      const prev = cache.get(slug);
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

router.get('/notion-vocab', asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase().trim();
  if (!SUPPORTED_SLUGS.includes(slug)) {
    return res.status(400).json({ error: 'unsupported_slug', supported: SUPPORTED_SLUGS });
  }
  const { token } = envIds();
  if (!token) {
    return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  }
  let entry = cache.get(slug);
  const stale = !entry || (Date.now() - entry.fetchedAt) > TTL_MS;
  if (stale) {
    // No cached payload at all → block on fetch (first hit after boot).
    // Stale-but-cached → serve stale + trigger refresh.
    if (!entry || !entry.data) {
      entry = await refreshSlug(slug);
    } else {
      refreshSlug(slug).catch((e) => console.warn('notion-public bg refresh err:', e.message));
    }
  }
  if (!entry?.data) {
    return res.status(502).json({ error: 'notion_error', detail: entry?.error || 'unknown' });
  }
  res.set('Cache-Control', 'public, max-age=300'); // 5 min browser cache
  res.json({
    slug,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    stale: (Date.now() - entry.fetchedAt) > TTL_MS,
    ...entry.data,
  });
}));

// Background refresh — primed once on boot, then runs every REFRESH_MS.
// Each level fetched sequentially to be polite to Notion. If NOTION_TOKEN is
// missing the whole scheduler is a no-op (handlers still return 503 cleanly).
let _refreshTimer = null;
async function refreshAllSlugs() {
  const { token } = envIds();
  if (!token) return;
  for (const slug of SUPPORTED_SLUGS) {
    try { await refreshSlug(slug); }
    catch (e) { console.warn(`notion-public initial refresh ${slug}:`, e.message); }
  }
}
export function startNotionCacheRefresh() {
  if (_refreshTimer) return;
  // Defer initial fetch a bit so server boot isn't blocked.
  setTimeout(() => { refreshAllSlugs().catch(() => {}); }, 5000);
  _refreshTimer = setInterval(() => {
    refreshAllSlugs().catch(() => {});
  }, REFRESH_MS);
  if (typeof _refreshTimer.unref === 'function') _refreshTimer.unref();
}

export default router;
