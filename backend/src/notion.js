// Shared Notion helpers. Used by:
//   - admin.js: per-Bab vocab import into module_vocabulary + lesson_deck_items
//   - routes/notion-public.js: public vocab catalog with in-memory cache
//
// All requests use the integration token from NOTION_TOKEN. The two Notion DBs
// involved (📚 Vocabulary 語彙, 📗 Bab) must be shared with that integration.

export const NOTION_VOCAB_DB_ID_DEFAULT = 'bd1f0d912aa24b139b5e68f3610b7c51';
export const NOTION_BAB_DB_ID_DEFAULT = '472c7178a513459caf536c30c1008b66';
export const NOTION_VOCAB_LESSON_RELATION = 'Lesson';

export function notionIdFromInput(s) {
  if (!s) return null;
  const m = String(s).match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  return m ? m[0].replace(/-/g, '') : null;
}

export function notionPlainText(prop) {
  if (!prop) return '';
  const arr = prop.title || prop.rich_text;
  if (Array.isArray(arr)) return arr.map((t) => (t && t.plain_text) || '').join('');
  if (prop.select && typeof prop.select === 'object') return prop.select.name || '';
  if (prop.status && typeof prop.status === 'object') return prop.status.name || '';
  return '';
}

export function notionNumber(prop) {
  return prop && typeof prop.number === 'number' ? prop.number : null;
}

export function notionRelationIds(prop) {
  if (!prop || !Array.isArray(prop.relation)) return [];
  return prop.relation.map((r) => r && r.id).filter(Boolean);
}

export function pickProp(props, names) {
  for (const n of names) if (props[n] !== undefined) return props[n];
  const lower = {};
  for (const k of Object.keys(props)) lower[k.toLowerCase()] = props[k];
  for (const n of names) if (lower[n.toLowerCase()] !== undefined) return lower[n.toLowerCase()];
  return null;
}

// Query every page of a Notion database (paginating start_cursor). `body` may
// carry a `filter`. Throws an Error with `.notionStatus` on a non-2xx response.
export async function notionQueryAll(dbId, token, body = {}) {
  const pages = [];
  let cursor = null;
  for (let guard = 0; guard < 200; guard++) {
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      const err = new Error(`Notion ${resp.status}: ${detail.slice(0, 300)}`);
      err.notionStatus = resp.status;
      throw err;
    }
    const data = await resp.json();
    for (const p of data.results || []) pages.push(p);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}
