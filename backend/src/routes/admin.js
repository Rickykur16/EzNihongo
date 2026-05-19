import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';
import {
  NOTION_BAB_DB_ID_DEFAULT,
  NOTION_VOCAB_LESSON_RELATION,
  notionIdFromInput,
  notionPlainText,
  notionNumber,
  pickProp,
  notionQueryAll,
} from '../notion.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

// Notion import endpoints hit external API + heavy DB writes; cap at
// 5/min per admin IP supaya spam ga habisin Notion quota (3 req/s
// upstream limit). Aplikasi ke import-notion-deck, import-notion-pelajaran,
// import-notion-kanji-bab.
const notionImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_imports', detail: 'Tunggu 1 menit sebelum import lagi.' },
});

// Generic Notion error response — internal error message di-log ke
// server, tapi response ke client cuma generic. Sebelumnya
// `err.message` bocorin "Unauthorized" / "Invalid database" / request
// ID yang nge-disclose state integration ke client (info leak).
function notionErrorResponse(res, err, fallback = 'Sumber Notion tidak bisa diakses.') {
  console.error('[notion-import]', err?.notionStatus || '', err?.message || err);
  return res.status(502).json({
    error: 'notion_error',
    status: err?.notionStatus || 0,
    detail: fallback,
  });
}

// Mirror of the config in routes/uploads.js. Kept here so DELETE handlers
// can map a stored photo_url back to a filesystem path and unlink the file.
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/eznihongo/uploads';
const UPLOAD_PUBLIC_BASE = process.env.UPLOAD_PUBLIC_BASE || '/uploads';

// Unlink an uploaded photo from disk when its row is deleted. Ignores files
// we didn't manage (external URLs), and tolerates ENOENT (file already gone).
// path.basename strips any `..` shenanigans so we can't escape UPLOAD_DIR
// even if photo_url in DB was tampered with.
async function unlinkUploadByUrl(url) {
  if (!url || typeof url !== 'string') return;
  if (!url.startsWith(UPLOAD_PUBLIC_BASE + '/')) return;
  const filename = path.basename(url);
  if (!filename || filename === '.' || filename === '..') return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('unlinkUploadByUrl failed:', filePath, err.code || err.message);
    }
  }
}

// Slug: lowercase letters, digits, hyphens — no leading/trailing/double hyphens.
// Must match the client-side SLUG_REGEX in admin.html.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function badSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_REGEX.test(slug)) {
    return 'slug must be lowercase letters/digits/hyphens (e.g. "n5-dasar")';
  }
  return null;
}

// ===== COURSES =====

router.get('/courses', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM courses ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ courses: result.rows });
}));

router.post('/courses', asyncHandler(async (req, res) => {
  const {
    slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured,
  } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' });
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await query(
    `INSERT INTO courses
       (slug, title, description, level, thumbnail_url, sort_order, is_published, is_available,
        price_idr, price_label, period_label, tagline, features, cta_label, is_featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      slug, title, description || null, level || null, thumbnailUrl || null,
      sortOrder || 0, !!isPublished, isAvailable !== false,
      priceIdr || null, priceLabel || null, periodLabel || null, tagline || null,
      JSON.stringify(Array.isArray(features) ? features : []),
      ctaLabel || null, !!isFeatured,
    ]
  );
  res.status(201).json({ course: result.rows[0] });
}));

router.put('/courses/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const result = await query(
    `UPDATE courses SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       level = COALESCE($5, level),
       thumbnail_url = COALESCE($6, thumbnail_url),
       sort_order = COALESCE($7, sort_order),
       is_published = COALESCE($8, is_published),
       is_available = COALESCE($9, is_available),
       price_idr = COALESCE($10, price_idr),
       price_label = COALESCE($11, price_label),
       period_label = COALESCE($12, period_label),
       tagline = COALESCE($13, tagline),
       features = COALESCE($14::jsonb, features),
       cta_label = COALESCE($15, cta_label),
       is_featured = COALESCE($16, is_featured),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
      priceIdr, priceLabel, periodLabel, tagline,
      Array.isArray(features) ? JSON.stringify(features) : null,
      ctaLabel, isFeatured,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ course: result.rows[0] });
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  // Block delete when any student has enrolled — keeps paid users from losing access silently.
  // Admins can still set the course to draft/coming_soon via PUT instead.
  const enroll = await query(
    `SELECT COUNT(*)::int AS n FROM user_enrollments WHERE course_id = $1`,
    [req.params.id]
  );
  const n = enroll.rows[0]?.n || 0;
  if (n > 0) {
    return res.status(409).json({
      error: `Tidak bisa hapus: ${n} siswa sudah terdaftar di kursus ini. Ubah status ke Draft supaya tidak tampil di landing.`,
      enrollmentCount: n,
    });
  }
  await query(`DELETE FROM courses WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== MODULES =====

router.get('/modules/:id', asyncHandler(async (req, res) => {
  const m = await query(`SELECT * FROM modules WHERE id = $1`, [req.params.id]);
  if (m.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const [lessons, vocab, grammar] = await Promise.all([
    query(`SELECT id, slug, title, type, sort_order, duration_minutes
           FROM lessons WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
    query(`SELECT * FROM module_vocabulary WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
    query(`SELECT * FROM module_grammar WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`, [req.params.id]),
  ]);
  res.json({
    module: { ...m.rows[0], lessons: lessons.rows, vocabulary: vocab.rows, grammar: grammar.rows },
  });
}));

router.post('/modules', asyncHandler(async (req, res) => {
  const {
    courseId, slug, title, description, sortOrder,
    jfTopic, cefrLevel, titleEn, scenario, sectionName,
    candoStatements, skillDistribution, quizSpec,
  } = req.body || {};
  if (!courseId || !slug || !title) {
    return res.status(400).json({ error: 'courseId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await query(
    `INSERT INTO modules (
       course_id, slug, title, description, sort_order,
       jf_topic, cefr_level, title_en, scenario, section_name,
       cando_statements, skill_distribution, quiz_spec
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)
     RETURNING *`,
    [
      courseId, slug, title, description || null, sortOrder || 0,
      jfTopic || null, cefrLevel || null, titleEn || null, scenario || null,
      (sectionName && String(sectionName).trim()) || null,
      JSON.stringify(Array.isArray(candoStatements) ? candoStatements : []),
      JSON.stringify(typeof skillDistribution === 'object' && skillDistribution ? skillDistribution : {}),
      JSON.stringify(typeof quizSpec === 'object' && quizSpec ? quizSpec : {}),
    ]
  );
  res.status(201).json({ module: result.rows[0] });
}));

router.put('/modules/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, description, sortOrder,
    jfTopic, cefrLevel, titleEn, scenario, sectionName,
    candoStatements, skillDistribution, quizSpec,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  // sectionName is special-cased: an empty string means "unset" so admin can
  // clear the value, whereas `undefined` keeps the current value.
  const hasSection = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionName');
  const sectionNorm = hasSection ? ((sectionName && String(sectionName).trim()) || null) : null;
  const result = await query(
    `UPDATE modules SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       sort_order = COALESCE($5, sort_order),
       jf_topic = COALESCE($6, jf_topic),
       cefr_level = COALESCE($7, cefr_level),
       title_en = COALESCE($8, title_en),
       scenario = COALESCE($9, scenario),
       section_name = CASE WHEN $13::boolean THEN $10 ELSE section_name END,
       cando_statements = COALESCE($11::jsonb, cando_statements),
       skill_distribution = COALESCE($12::jsonb, skill_distribution),
       quiz_spec = COALESCE($14::jsonb, quiz_spec),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, sortOrder,
      jfTopic, cefrLevel, titleEn, scenario, sectionNorm,
      Array.isArray(candoStatements) ? JSON.stringify(candoStatements) : null,
      skillDistribution && typeof skillDistribution === 'object' ? JSON.stringify(skillDistribution) : null,
      hasSection,
      quizSpec && typeof quizSpec === 'object' ? JSON.stringify(quizSpec) : null,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ module: result.rows[0] });
}));

router.delete('/modules/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM modules WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== MODULE VOCABULARY =====

router.get('/module-vocabulary', asyncHandler(async (req, res) => {
  const { moduleId, lessonId } = req.query;
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });
  const params = [moduleId];
  let where = 'module_id = $1';
  if (lessonId) { where += ' AND lesson_id = $2'; params.push(lessonId); }
  const rows = await query(
    `SELECT * FROM module_vocabulary WHERE ${where} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  res.json({ vocabulary: rows.rows });
}));

router.post('/module-vocabulary', asyncHandler(async (req, res) => {
  const { moduleId, lessonId, japanese, reading, romaji, indonesian, category, note, sortOrder } = req.body || {};
  if (!moduleId || !japanese) return res.status(400).json({ error: 'moduleId and japanese required' });
  const result = await query(
    `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [moduleId, lessonId || null, japanese, reading || null, romaji || null, indonesian || null, category || null, note || null, sortOrder || 0]
  );
  res.status(201).json({ vocabulary: result.rows[0] });
}));

router.put('/module-vocabulary/:id', asyncHandler(async (req, res) => {
  const { lessonId, japanese, reading, romaji, indonesian, category, note, sortOrder } = req.body || {};
  // lessonId is special: allow explicit null to unassign. Use has-own-property semantics.
  const hasLesson = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const result = await query(
    `UPDATE module_vocabulary SET
       lesson_id = CASE WHEN $10::boolean THEN $2 ELSE lesson_id END,
       japanese = COALESCE($3, japanese),
       reading = COALESCE($4, reading),
       romaji = COALESCE($5, romaji),
       indonesian = COALESCE($6, indonesian),
       category = COALESCE($7, category),
       note = COALESCE($8, note),
       sort_order = COALESCE($9, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, lessonId || null, japanese, reading, romaji, indonesian, category, note, sortOrder, hasLesson]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ vocabulary: result.rows[0] });
}));

router.delete('/module-vocabulary/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM module_vocabulary WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

router.post('/module-vocabulary/bulk', asyncHandler(async (req, res) => {
  const { moduleId, items, replace } = req.body || {};
  if (!moduleId || !Array.isArray(items)) return res.status(400).json({ error: 'moduleId and items[] required' });
  if (replace) await query(`DELETE FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
  const inserted = [];
  for (let i = 0; i < items.length; i++) {
    const v = items[i] || {};
    if (!v.japanese) continue;
    const r = await query(
      `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [moduleId, v.lessonId || null, v.japanese, v.reading || null, v.romaji || null, v.indonesian || null,
       v.category || null, v.note || null, v.sortOrder ?? i]
    );
    inserted.push(r.rows[0]);
  }
  res.status(201).json({ vocabulary: inserted });
}));

// ===== VOCAB BANK PICKER (for deck lessons) =====
// All vocab items, searchable, optionally scoped to a course. Used by the deck
// editor's "tambah dari bank" picker.
router.get('/vocab-bank', asyncHandler(async (req, res) => {
  const { courseId, q } = req.query;
  const params = [];
  const where = [];
  if (courseId) {
    params.push(courseId);
    where.push(`v.module_id IN (SELECT id FROM modules WHERE course_id = $${params.length})`);
  }
  if (q && String(q).trim()) {
    params.push('%' + String(q).trim() + '%');
    const p = `$${params.length}`;
    where.push(`(v.japanese ILIKE ${p} OR v.reading ILIKE ${p} OR v.romaji ILIKE ${p} OR v.indonesian ILIKE ${p})`);
  }
  const rows = await query(
    `SELECT v.id, v.module_id, v.japanese, v.reading, v.romaji, v.indonesian, v.category,
            m.title AS module_title,
            (SELECT COUNT(*)::int FROM vocabulary_examples e WHERE e.vocabulary_id = v.id) AS example_count
     FROM module_vocabulary v JOIN modules m ON m.id = v.module_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY v.japanese ASC LIMIT 200`,
    params
  );
  res.json({ vocabulary: rows.rows });
}));

// ===== VOCABULARY EXAMPLE SENTENCES =====

router.get('/vocabulary-examples', asyncHandler(async (req, res) => {
  const { vocabularyId } = req.query;
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  const rows = await query(
    `SELECT * FROM vocabulary_examples WHERE vocabulary_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [vocabularyId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/vocabulary-examples', asyncHandler(async (req, res) => {
  const { vocabularyId, japanese, highlight, indonesian, sortOrder } = req.body || {};
  if (!vocabularyId || !japanese) return res.status(400).json({ error: 'vocabularyId and japanese required' });
  const r = await query(
    `INSERT INTO vocabulary_examples (vocabulary_id, japanese, highlight, indonesian, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [vocabularyId, japanese, highlight || null, indonesian || null, sortOrder || 0]
  );
  res.status(201).json({ example: r.rows[0] });
}));

router.put('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, highlight, indonesian, sortOrder } = req.body || {};
  const hasHighlight = Object.prototype.hasOwnProperty.call(req.body || {}, 'highlight');
  const r = await query(
    `UPDATE vocabulary_examples SET
       japanese = COALESCE($2, japanese),
       highlight = CASE WHEN $5::boolean THEN $3 ELSE highlight END,
       indonesian = COALESCE($4, indonesian),
       sort_order = COALESCE($6, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, highlight || null, indonesian, hasHighlight, sortOrder]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ example: r.rows[0] });
}));

router.delete('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM vocabulary_examples WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== DECK ITEMS (vocab picked into a 'deck' lesson) =====

router.get('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT di.lesson_id, di.vocabulary_id, di.sort_order, di.accent_color,
            v.japanese, v.reading, v.romaji, v.indonesian, v.category, v.module_id,
            (SELECT COUNT(*)::int FROM vocabulary_examples e WHERE e.vocabulary_id = v.id) AS example_count
     FROM lesson_deck_items di JOIN module_vocabulary v ON v.id = di.vocabulary_id
     WHERE di.lesson_id = $1
     ORDER BY di.sort_order ASC, v.japanese ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.post('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const { vocabularyId, sortOrder, accentColor } = req.body || {};
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  const r = await query(
    `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (lesson_id, vocabulary_id)
       DO UPDATE SET sort_order = EXCLUDED.sort_order, accent_color = EXCLUDED.accent_color
     RETURNING *`,
    [req.params.lessonId, vocabularyId, sortOrder ?? 0, accentColor || null]
  );
  res.status(201).json({ item: r.rows[0] });
}));

router.put('/lessons/:lessonId/deck-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (!it.vocabularyId) continue;
    await query(
      `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (lesson_id, vocabulary_id)
         DO UPDATE SET sort_order = EXCLUDED.sort_order, accent_color = EXCLUDED.accent_color`,
      [req.params.lessonId, it.vocabularyId, it.sortOrder ?? i, it.accentColor || null]
    );
  }
  res.json({ ok: true });
}));

router.delete('/lessons/:lessonId/deck-items/:vocabularyId', asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM lesson_deck_items WHERE lesson_id = $1 AND vocabulary_id = $2`,
    [req.params.lessonId, req.params.vocabularyId]
  );
  res.json({ ok: true });
}));

// ===== NOTION IMPORT (vocab bank + per-chapter deck) =====
// "📚 Vocabulary 語彙" Notion DB -> module_vocabulary. Each vocab page is linked
// (relation "Lesson") to a "📗 Bab" page; the deck importer filters by that so
// one EzNihongo deck-lesson can pull exactly one chapter's words. Needs
// NOTION_TOKEN in env (integration shared with both DBs). Notion helpers
// (notionQueryAll/notionPlainText/etc.) live in src/notion.js — see imports.

// Upsert Notion vocab pages into module_vocabulary for `moduleId`, keyed by
// `japanese`. Existing rows get reading/indonesian/category/note refreshed from
// Notion (lesson_id + deck wiring untouched); new rows are appended. Returns
// counts plus `vocabIds` = the resulting row id for each page (Notion order).
async function upsertNotionVocab(moduleId, pages) {
  const existing = await query(`SELECT id, japanese FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
  const byJapanese = new Map();
  for (const r of existing.rows) {
    const j = (r.japanese || '').trim();
    if (j && !byJapanese.has(j)) byJapanese.set(j, r.id);
  }
  let imported = 0, updated = 0, total = 0, sort = byJapanese.size;
  const vocabIds = [];
  for (const page of pages) {
    const props = page.properties || {};
    const japanese = notionPlainText(pickProp(props, ['Japanese 日本語', 'Japanese', '日本語', 'Bahasa Jepang'])).trim();
    if (!japanese) continue;
    total++;
    const reading = notionPlainText(pickProp(props, ['Reading 読み', 'Reading', '読み', 'Cara Baca'])).trim() || null;
    const indonesian = notionPlainText(pickProp(props, ['Indonesian', 'Bahasa Indonesia'])).trim() || null;
    const category = notionPlainText(pickProp(props, ['Category', 'Kategori'])).trim() || null;
    const note = notionPlainText(pickProp(props, ['Note', 'Catatan'])).trim() || null;
    let id = byJapanese.get(japanese);
    if (id) {
      await query(
        `UPDATE module_vocabulary SET reading = $2, indonesian = $3, category = $4, note = $5, updated_at = NOW()
         WHERE id = $1`,
        [id, reading, indonesian, category, note]
      );
      updated++;
    } else {
      const r = await query(
        `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [moduleId, japanese, reading, indonesian, category, note, sort++]
      );
      id = r.rows[0].id;
      byJapanese.set(japanese, id);
      imported++;
    }
    vocabIds.push(id);
  }
  return { imported, updated, total, vocabIds };
}

// Lists chapters ("Bab") from the "📗 Bab" Notion DB so the deck editor can pick
// which chapter to pull. Sorted by Nomor Bab.
router.get('/notion-bab', asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const dbId = notionIdFromInput(req.query.notionDbId)
    || notionIdFromInput(process.env.NOTION_BAB_DB_ID)
    || NOTION_BAB_DB_ID_DEFAULT;
  let pages;
  try { pages = await notionQueryAll(dbId, token); }
  catch (err) { return notionErrorResponse(res, err, 'Gagal load daftar Bab dari Notion.'); }
  const bab = pages.map((p) => {
    const props = p.properties || {};
    return {
      id: p.id,
      name: notionPlainText(pickProp(props, ['Bab', 'Name', 'Title'])).trim() || '(tanpa judul)',
      kode: notionPlainText(pickProp(props, ['Kode Bab', 'Kode'])).trim() || null,
      nomor: notionNumber(pickProp(props, ['Nomor Bab', 'Nomor'])),
    };
  });
  bab.sort((a, b) => {
    if (a.nomor != null && b.nomor != null) return a.nomor - b.nomor;
    if (a.nomor != null) return -1;
    if (b.nomor != null) return 1;
    return a.name.localeCompare(b.name);
  });
  res.json({ bab });
}));

// Pulls one chapter's vocab into a deck-lesson: upsert the words into the
// module's bank, then append them to lesson_deck_items. body: { babPageId }.
router.post('/lessons/:lessonId/import-notion-deck', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const { babPageId } = req.body || {};
  if (!babPageId) return res.status(400).json({ error: 'babPageId required' });
  const dbId = notionIdFromInput((req.body || {}).notionVocabDbId) || notionIdFromInput(process.env.NOTION_VOCAB_DB_ID);
  if (!dbId) return res.status(400).json({ error: 'notion_db_required', detail: 'Set NOTION_VOCAB_DB_ID' });

  const lessonRow = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [req.params.lessonId]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const { module_id: moduleId, type } = lessonRow.rows[0];
  if (type !== 'deck') return res.status(400).json({ error: 'lesson_not_deck', detail: 'Pelajaran ini bukan tipe deck' });

  let pages;
  try {
    pages = await notionQueryAll(dbId, token, {
      filter: { property: NOTION_VOCAB_LESSON_RELATION, relation: { contains: babPageId } },
    });
  } catch (err) {
    return notionErrorResponse(res, err, 'Gagal import vocab dari Notion.');
  }
  const { imported, updated, total, vocabIds } = await upsertNotionVocab(moduleId, pages);

  const cur = await query(`SELECT vocabulary_id, sort_order FROM lesson_deck_items WHERE lesson_id = $1`, [req.params.lessonId]);
  const inDeck = new Set(cur.rows.map((r) => r.vocabulary_id));
  let nextSort = cur.rows.reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0);
  let added = 0;
  for (const vid of vocabIds) {
    if (inDeck.has(vid)) continue;
    inDeck.add(vid);
    await query(
      `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
       VALUES ($1, $2, $3, NULL) ON CONFLICT (lesson_id, vocabulary_id) DO NOTHING`,
      [req.params.lessonId, vid, nextSort++]
    );
    added++;
  }
  res.json({ imported, updated, added, total });
}));

// ===== NOTION: BAB PELAJARAN (5 child pages of a Bab → EzNihongo lessons) =====
// Each Notion Bab page has child pages like "Pelajaran 1: Pengantar",
// "Pelajaran 2: Kosakata", "Pelajaran 3: Kanji", "Pelajaran 4: Tata Bahasa",
// "Pelajaran 5: Latihan". This pair of endpoints lets admin pick which child
// pages to import as EzNihongo lessons under a module, complete with the page
// body converted to HTML.

const SAFE_HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function _h(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => SAFE_HTML_ESCAPES[c]); }

function notionRichTextToHtml(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((t) => {
    let txt = _h(t.plain_text || '');
    const ann = t.annotations || {};
    if (ann.code) txt = `<code>${txt}</code>`;
    if (ann.strikethrough) txt = `<del>${txt}</del>`;
    if (ann.underline) txt = `<u>${txt}</u>`;
    if (ann.italic) txt = `<em>${txt}</em>`;
    if (ann.bold) txt = `<strong>${txt}</strong>`;
    const url = t.href || (t.text && t.text.link && t.text.link.url);
    if (url) txt = `<a href="${_h(url)}" target="_blank" rel="noopener">${txt}</a>`;
    return txt;
  }).join('');
}

// Convert a Notion page's body into simple HTML. Walks block children
// recursively (depth-limited), consolidating consecutive list items into
// <ul>/<ol>. Skips media types we don't render (table/columns/embeds) — the
// goal is "good enough text body that admin can polish", not 1:1 mirror.
async function notionBlocksToHtml(blockId, token, depth = 0, visited = new Set()) {
  if (depth > 5 || visited.has(blockId)) return '';
  visited.add(blockId);
  let children;
  try { children = await notionGetBlockChildren(blockId, token); }
  catch (err) { console.warn('notionBlocksToHtml:', err.message); return ''; }

  const parts = [];
  let listType = null;
  let listItems = [];
  const flushList = () => {
    if (listType && listItems.length) {
      parts.push(`<${listType}>${listItems.join('')}</${listType}>`);
    }
    listType = null;
    listItems = [];
  };

  for (const block of children) {
    const type = block.type;
    const data = block[type] || {};
    if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
      const want = type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (listType !== want) flushList();
      listType = want;
      const inner = notionRichTextToHtml(data.rich_text || []);
      listItems.push(`<li>${inner}</li>`);
      continue;
    }
    flushList();
    if (type === 'paragraph') {
      const inner = notionRichTextToHtml(data.rich_text || []);
      parts.push(inner.trim() ? `<p>${inner}</p>` : '<p><br></p>');
    } else if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
      const tag = type === 'heading_1' ? 'h2' : (type === 'heading_2' ? 'h3' : 'h4');
      parts.push(`<${tag}>${notionRichTextToHtml(data.rich_text || [])}</${tag}>`);
    } else if (type === 'quote') {
      parts.push(`<blockquote>${notionRichTextToHtml(data.rich_text || [])}</blockquote>`);
    } else if (type === 'code') {
      const code = (data.rich_text || []).map((t) => t.plain_text || '').join('');
      parts.push(`<pre><code>${_h(code)}</code></pre>`);
    } else if (type === 'divider') {
      parts.push('<hr>');
    } else if (type === 'toggle') {
      const title = notionRichTextToHtml(data.rich_text || []);
      if (title.trim()) parts.push(`<p><strong>${title}</strong></p>`);
      if (block.has_children) {
        const inner = await notionBlocksToHtml(block.id, token, depth + 1, visited);
        if (inner) parts.push(inner);
      }
    } else if (type === 'synced_block') {
      const src = data.synced_from;
      const srcId = (src && src.block_id) || block.id;
      const inner = await notionBlocksToHtml(srcId, token, depth + 1, visited);
      if (inner) parts.push(inner);
    } else if (type === 'image') {
      const url = (data.file && data.file.url) || (data.external && data.external.url);
      const caption = notionRichTextToHtml(data.caption || []);
      if (url) {
        parts.push(`<figure><img src="${_h(url)}" alt="${caption ? caption.replace(/<[^>]+>/g, '') : ''}">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`);
      }
    } else if (type === 'child_page') {
      // Note its title so admin can decide to import it as a separate lesson.
      const t = data.title || '';
      if (t) parts.push(`<p><em>↳ Sub-page Notion: ${_h(t)}</em></p>`);
    } else if (type === 'callout') {
      const ico = (data.icon && (data.icon.emoji || '')) || '💡';
      parts.push(`<blockquote>${_h(ico)} ${notionRichTextToHtml(data.rich_text || [])}</blockquote>`);
    }
    // Skip: table, column_list, embed, video, file, bookmark, equation —
    // either complex to render or rarely used in pelajaran pages.
  }
  flushList();
  return parts.join('\n');
}

function notionPelajaranType(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('kosakata') || t.includes('語彙') || t.includes('vocab')) return 'deck';
  if (t.includes('latihan') || t.includes('練習') || t.includes('quiz') || t.includes('exercise')) return 'quiz';
  // pengantar / kanji / tata bahasa / grammar / 漢字 / 文法 → text
  return 'text';
}

function slugifyJa(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `pelajaran-${Date.now()}`;
}

// List child pages of a Bab — admin uses this to choose which pelajaran to
// import. Returns [{ id, title, type }] in Notion order.
router.get('/notion-bab/:babPageId/pelajaran', asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const babPageId = req.params.babPageId;
  let blocks;
  try { blocks = await notionGetBlockChildren(babPageId, token); }
  catch (err) { return notionErrorResponse(res, err, 'Gagal load Pelajaran dari Bab Notion.'); }
  const pelajaran = [];
  for (const b of blocks) {
    if (b.type === 'child_page') {
      const title = (b.child_page && b.child_page.title) || '(tanpa judul)';
      pelajaran.push({ id: b.id, title, type: notionPelajaranType(title) });
    }
  }
  res.json({ pelajaran });
}));

// Create EzNihongo lessons under a module, one per Notion child-page id given.
// Body content rendered from the Notion page's blocks.
// body: { babPageId, pelajaranIds: [string], startSortOrder?: number }
router.post('/modules/:moduleId/import-notion-pelajaran', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const moduleId = req.params.moduleId;
  const { pelajaranIds } = req.body || {};
  if (!Array.isArray(pelajaranIds) || pelajaranIds.length === 0) {
    return res.status(400).json({ error: 'pelajaranIds[] required' });
  }
  const mod = await query(`SELECT id FROM modules WHERE id = $1`, [moduleId]);
  if (mod.rows.length === 0) return res.status(404).json({ error: 'module not found' });

  // Avoid slug collisions within the module by tacking on a counter if needed.
  const existing = await query(`SELECT slug FROM lessons WHERE module_id = $1`, [moduleId]);
  const used = new Set(existing.rows.map((r) => r.slug));
  const sortStart = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM lessons WHERE module_id = $1`,
    [moduleId]
  );
  let nextSort = Number(sortStart.rows[0]?.next) || 0;

  const created = [];
  const errors = [];
  for (const pageId of pelajaranIds) {
    let page;
    try {
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
      });
      if (!resp.ok) throw new Error(`Notion ${resp.status}`);
      page = await resp.json();
    } catch (err) {
      errors.push({ pageId, error: err.message });
      continue;
    }
    // Title — child_page block title or page properties.title.
    const titleProp = page.properties && Object.values(page.properties).find((p) => p.type === 'title');
    const title = notionPlainText(titleProp) || '(tanpa judul)';
    const type = notionPelajaranType(title);
    // Slug — ensure unique within module.
    let baseSlug = slugifyJa(title);
    let slug = baseSlug;
    let n = 2;
    while (used.has(slug)) { slug = `${baseSlug}-${n++}`; }
    used.add(slug);
    // Body content as HTML.
    let html = '';
    try { html = await notionBlocksToHtml(pageId, token); }
    catch (err) { console.warn('notionBlocksToHtml failed:', err.message); }
    try {
      const r = await query(
        `INSERT INTO lessons (module_id, slug, title, type, content, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, slug, title, type, sort_order`,
        [moduleId, slug, title, type, html || null, nextSort++]
      );
      created.push(r.rows[0]);
    } catch (err) {
      errors.push({ pageId, title, error: err.message });
    }
  }
  res.json({ created, errors });
}));

// ===== MODULE GRAMMAR =====

router.get('/module-grammar', asyncHandler(async (req, res) => {
  const { moduleId, lessonId } = req.query;
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });
  const params = [moduleId];
  let where = 'module_id = $1';
  if (lessonId) { where += ' AND lesson_id = $2'; params.push(lessonId); }
  const rows = await query(
    `SELECT * FROM module_grammar WHERE ${where} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  res.json({ grammar: rows.rows });
}));

// ===== AUTO-GENERATE QUIZ (JLPT-style multiple choice dari vocab) =====
// Generates `count` multiple-choice questions from the vocab tied to the
// lesson's module (preferring vocab actually wired to a deck lesson in that
// module so questions stay scoped to one Bab). Replaces any existing
// quiz_questions on the lesson — idempotent.
function _pickRandom(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
function _sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _hasKanji(s) { return /[一-龯]/.test(String(s || '')); }
function _generateQuizQuestions(vocab, count) {
  const out = [];
  const withId = vocab.filter((v) => (v.indonesian || '').trim());
  const withReading = vocab.filter((v) => (v.reading || '').trim() && v.reading !== v.japanese && _hasKanji(v.japanese || ''));
  // Bucket distractors so options share the rough "shape" of the answer.
  if (withId.length < 4) return out; // need 4 minimum for distractors

  const types = [];
  // Build a balanced type rotation. Skip types whose pool < 4.
  if (withReading.length >= 4) types.push('reading');
  types.push('arti', 'jp', 'listening');

  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    let q = null;
    if (t === 'reading') {
      const correct = _sample(withReading);
      const otherReadings = _pickRandom(
        withReading.filter((v) => v.id !== correct.id && v.reading !== correct.reading),
        3
      );
      if (otherReadings.length < 3) continue;
      const options = _pickRandom([correct.reading, ...otherReadings.map((v) => v.reading)], 4);
      q = {
        question: `Bagaimana cara baca **${correct.japanese}** ?`,
        category: 'vocabulary',
        jp: correct.japanese,
        options,
        correctIdx: options.indexOf(correct.reading),
        explanation: correct.indonesian ? `${correct.japanese} (${correct.reading}) — ${correct.indonesian}` : null,
      };
    } else if (t === 'arti') {
      const correct = _sample(withId);
      const others = _pickRandom(
        withId.filter((v) => v.id !== correct.id && v.indonesian !== correct.indonesian),
        3
      );
      if (others.length < 3) continue;
      const options = _pickRandom([correct.indonesian, ...others.map((v) => v.indonesian)], 4);
      q = {
        question: `Apa arti dari **${correct.japanese}** ?`,
        category: 'vocabulary',
        jp: correct.japanese,
        options,
        correctIdx: options.indexOf(correct.indonesian),
        explanation: correct.reading ? `${correct.japanese} (${correct.reading}) — ${correct.indonesian}` : null,
      };
    } else if (t === 'jp') {
      const correct = _sample(withId);
      const others = _pickRandom(
        withId.filter((v) => v.id !== correct.id && v.japanese !== correct.japanese),
        3
      );
      if (others.length < 3) continue;
      const options = _pickRandom([correct.japanese, ...others.map((v) => v.japanese)], 4);
      q = {
        question: `Bahasa Jepang untuk **"${correct.indonesian}"** ?`,
        category: 'vocabulary',
        options,
        correctIdx: options.indexOf(correct.japanese),
        explanation: correct.reading ? `${correct.japanese} (${correct.reading}) — ${correct.indonesian}` : null,
      };
    } else if (t === 'listening') {
      const correct = _sample(withId);
      const others = _pickRandom(
        withId.filter((v) => v.id !== correct.id && v.indonesian !== correct.indonesian),
        3
      );
      if (others.length < 3) continue;
      const options = _pickRandom([correct.indonesian, ...others.map((v) => v.indonesian)], 4);
      q = {
        category: 'listening',
        question: `🎧 Dengar audio, pilih arti yang benar:`,
        jp: correct.japanese,
        options,
        correctIdx: options.indexOf(correct.indonesian),
        explanation: `${correct.japanese} (${correct.reading || '-'}) — ${correct.indonesian}`,
      };
    }
    if (q) out.push(q);
  }
  return out;
}

router.post('/lessons/:lessonId/generate-quiz', asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const count = Math.min(50, Math.max(4, Number(req.body?.count) || 10));

  const lessonRes = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });

  // Prefer vocab wired into a deck lesson in this module — keeps quiz scoped
  // to one Bab when admin imports per-Bab. Fall back to all module vocab.
  let vocabRes = await query(
    `SELECT DISTINCT v.id, v.japanese, v.reading, v.romaji, v.indonesian, v.category
     FROM module_vocabulary v
     JOIN lesson_deck_items di ON di.vocabulary_id = v.id
     JOIN lessons l ON l.id = di.lesson_id
     WHERE l.module_id = $1 AND l.type = 'deck' AND v.japanese IS NOT NULL AND v.japanese <> ''`,
    [lesson.module_id]
  );
  if (vocabRes.rows.length < 4) {
    vocabRes = await query(
      `SELECT id, japanese, reading, romaji, indonesian, category
       FROM module_vocabulary
       WHERE module_id = $1 AND japanese IS NOT NULL AND japanese <> ''`,
      [lesson.module_id]
    );
  }
  if (vocabRes.rows.length < 4) {
    return res.status(400).json({
      error: 'not_enough_vocab',
      detail: `Modul ini cuma punya ${vocabRes.rows.length} kosakata, butuh ≥ 4. Import dari Notion dulu.`,
    });
  }

  const questions = _generateQuizQuestions(vocabRes.rows, count);
  if (questions.length === 0) {
    return res.status(400).json({ error: 'generation_failed', detail: 'Vocab pool terlalu kecil untuk variasi 4 opsi.' });
  }

  // Replace existing — idempotent. Admin yg ngerasa generator-nya jelek bisa
  // tekan tombol lagi buat re-roll.
  await query(`DELETE FROM quiz_questions WHERE lesson_id = $1`, [lessonId]);

  let sort = 0;
  for (const q of questions) {
    const qText = q.jp ? `${q.question}\n\n${q.jp}` : q.question;
    const category = q.category || 'vocabulary';
    const sectionNumber = category === 'listening' ? 2 : 1;
    const sectionLabel = `Section ${sectionNumber}`;
    const sectionInstruction = category === 'listening'
      ? '音声を聞いて、ただしい答えをえらんでください。'
      : '問題1：＿＿の　ことばは　ひらがなで　どう　かきますか。 1・2・3・4から　いちばん　いい　ものを　ひとつ　えらんで　ください。';
    const ins = await query(
      `INSERT INTO quiz_questions (
         lesson_id, question, question_type, question_category,
         section_number, section_label, section_instruction,
         explanation, sort_order
       )
       VALUES ($1, $2, 'multiple_choice', $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [lessonId, qText, category, sectionNumber, sectionLabel, sectionInstruction, q.explanation || null, sort++]
    );
    const qid = ins.rows[0].id;
    let osort = 0;
    for (let i = 0; i < q.options.length; i++) {
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [qid, q.options[i], i === q.correctIdx, osort++]
      );
    }
  }
  res.json({ created: questions.length, vocabPool: vocabRes.rows.length });
}));

router.post('/module-grammar', asyncHandler(async (req, res) => {
  const { moduleId, lessonId, pattern, meaning, example, notes, sortOrder } = req.body || {};
  if (!moduleId || !pattern) return res.status(400).json({ error: 'moduleId and pattern required' });
  const result = await query(
    `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [moduleId, lessonId || null, pattern, meaning || null, example || null, notes || null, sortOrder || 0]
  );
  res.status(201).json({ grammar: result.rows[0] });
}));

router.put('/module-grammar/:id', asyncHandler(async (req, res) => {
  const { lessonId, pattern, meaning, example, notes, sortOrder } = req.body || {};
  const hasLesson = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const result = await query(
    `UPDATE module_grammar SET
       lesson_id = CASE WHEN $8::boolean THEN $2 ELSE lesson_id END,
       pattern = COALESCE($3, pattern),
       meaning = COALESCE($4, meaning),
       example = COALESCE($5, example),
       notes = COALESCE($6, notes),
       sort_order = COALESCE($7, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, lessonId || null, pattern, meaning, example, notes, sortOrder, hasLesson]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ grammar: result.rows[0] });
}));

router.delete('/module-grammar/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM module_grammar WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

router.post('/module-grammar/bulk', asyncHandler(async (req, res) => {
  const { moduleId, items, replace } = req.body || {};
  if (!moduleId || !Array.isArray(items)) return res.status(400).json({ error: 'moduleId and items[] required' });
  if (replace) await query(`DELETE FROM module_grammar WHERE module_id = $1`, [moduleId]);
  const inserted = [];
  for (let i = 0; i < items.length; i++) {
    const g = items[i] || {};
    if (!g.pattern) continue;
    const r = await query(
      `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [moduleId, g.lessonId || null, g.pattern, g.meaning || null, g.example || null, g.notes || null, g.sortOrder ?? i]
    );
    inserted.push(r.rows[0]);
  }
  res.status(201).json({ grammar: inserted });
}));

// ===== LESSONS =====

router.post('/lessons', asyncHandler(async (req, res) => {
  const {
    moduleId, slug, title, type, content, videoUrl, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours,
  } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await query(
    `INSERT INTO lessons (
       module_id, slug, title, type, content, video_url, duration_minutes, sort_order,
       passing_score_pct, questions_per_attempt, cooldown_hours
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      moduleId, slug, title, type || 'text',
      content || null, videoUrl || null, durationMinutes || null, sortOrder || 0,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : 70,
      questionsPerAttempt != null && questionsPerAttempt !== '' ? Number(questionsPerAttempt) : null,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : 12,
    ]
  );
  res.status(201).json({ lesson: result.rows[0] });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, type, content, videoUrl, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const hasQPA = Object.prototype.hasOwnProperty.call(req.body || {}, 'questionsPerAttempt');

  // Lesson type-switch cleanup: kalau type berubah dari yang punya konten
  // (quiz/kanji/deck), hapus konten lama sebelum UPDATE. Tanpa ini,
  // quiz_questions/kanji_items/lesson_deck_items orphan di DB + counter
  // di list pelajaran salah. FK ON DELETE CASCADE handle quiz_options +
  // quiz_attempts otomatis. ON DELETE CASCADE buat kanji_items udah ada
  // (migration 015), buat lesson_deck_items juga.
  if (type) {
    const cur = await query(`SELECT type FROM lessons WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const oldType = cur.rows[0].type;
    if (oldType !== type) {
      if (oldType === 'quiz') {
        await query(`DELETE FROM quiz_questions WHERE lesson_id = $1`, [req.params.id]);
        await query(`DELETE FROM quiz_attempts WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'kanji') {
        await query(`DELETE FROM kanji_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'deck') {
        await query(`DELETE FROM lesson_deck_items WHERE lesson_id = $1`, [req.params.id]);
      }
    }
  }

  const result = await query(
    `UPDATE lessons SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       type = COALESCE($4, type),
       content = COALESCE($5, content),
       video_url = COALESCE($6, video_url),
       duration_minutes = COALESCE($7, duration_minutes),
       sort_order = COALESCE($8, sort_order),
       passing_score_pct = COALESCE($9, passing_score_pct),
       questions_per_attempt = CASE WHEN $11::boolean THEN $10 ELSE questions_per_attempt END,
       cooldown_hours = COALESCE($12, cooldown_hours)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, type, content, videoUrl, durationMinutes, sortOrder,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : null,
      hasQPA && questionsPerAttempt !== '' && questionsPerAttempt != null ? Number(questionsPerAttempt) : null,
      hasQPA,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : null,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ lesson: result.rows[0] });
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM lessons WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== QUIZ QUESTIONS (with options in one call) =====

const QUIZ_CATEGORIES = new Set(['vocabulary', 'grammar', 'listening']);

function normalizeQuizCategory(value) {
  const category = String(value || 'vocabulary').toLowerCase();
  return QUIZ_CATEGORIES.has(category) ? category : 'vocabulary';
}

function normalizeQuizSectionNumber(value) {
  return Math.max(1, Number(value) || 1);
}

router.get('/lessons/:lessonId/quiz', asyncHandler(async (req, res) => {
  const lessonRow = await query(
    `SELECT id, passing_score_pct, questions_per_attempt, cooldown_hours
       FROM lessons WHERE id = $1 LIMIT 1`,
    [req.params.lessonId]
  );
  const lessonMeta = lessonRow.rows[0] || null;
  const questions = await query(
    `SELECT * FROM quiz_questions
     WHERE lesson_id = $1
     ORDER BY CASE question_category
                WHEN 'vocabulary' THEN 1
                WHEN 'grammar' THEN 2
                WHEN 'listening' THEN 3
                ELSE 9
              END,
              section_number ASC, sort_order ASC`,
    [req.params.lessonId]
  );
  const qIds = questions.rows.map((q) => q.id);
  let optsByQ = {};
  if (qIds.length > 0) {
    const opts = await query(
      `SELECT * FROM quiz_options WHERE question_id = ANY($1::uuid[]) ORDER BY sort_order ASC`,
      [qIds]
    );
    for (const o of opts.rows) {
      if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
      optsByQ[o.question_id].push(o);
    }
  }
  res.json({
    questions: questions.rows.map((q) => ({ ...q, options: optsByQ[q.id] || [] })),
    lessonMeta,
  });
}));

router.post('/quiz-questions', asyncHandler(async (req, res) => {
  const {
    lessonId, question, questionType, questionCategory, sectionNumber,
    sectionLabel, sectionInstruction, audioScript, imageUrl,
    correctAnswer, explanation, sortOrder, options,
  } = req.body || {};
  if (!lessonId || !question) return res.status(400).json({ error: 'lessonId and question required' });

  const category = normalizeQuizCategory(questionCategory);
  const sectionNo = normalizeQuizSectionNumber(sectionNumber);
  const sectionTitle = (sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`;

  const qRes = await query(
    `INSERT INTO quiz_questions (
       lesson_id, question, question_type, question_category,
       section_number, section_label, section_instruction, audio_script, image_url,
       correct_answer, explanation, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      lessonId,
      question,
      questionType || 'multiple_choice',
      category,
      sectionNo,
      sectionTitle,
      sectionInstruction || null,
      (audioScript && String(audioScript).trim()) || null,
      (imageUrl && String(imageUrl).trim()) || null,
      correctAnswer || null,
      explanation || null,
      sortOrder || 0,
    ]
  );
  const q = qRes.rows[0];

  if (Array.isArray(options) && options.length > 0) {
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [q.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
      );
    }
  }

  res.status(201).json({ question: q });
}));

router.put('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const {
    question, questionType, questionCategory, sectionNumber,
    sectionLabel, sectionInstruction, audioScript, imageUrl,
    correctAnswer, explanation, sortOrder, options,
  } = req.body || {};
  const category = questionCategory ? normalizeQuizCategory(questionCategory) : null;
  const sectionNo = sectionNumber == null ? null : normalizeQuizSectionNumber(sectionNumber);
  const hasSectionInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  const hasAudioScript = Object.prototype.hasOwnProperty.call(req.body || {}, 'audioScript');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'imageUrl');
  const audioScriptNorm = hasAudioScript ? ((audioScript && String(audioScript).trim()) || null) : null;
  const imageUrlNorm = hasImageUrl ? ((imageUrl && String(imageUrl).trim()) || null) : null;
  const result = await query(
    `UPDATE quiz_questions SET
       question = COALESCE($2, question),
       question_type = COALESCE($3, question_type),
       correct_answer = COALESCE($4, correct_answer),
       explanation = COALESCE($5, explanation),
       sort_order = COALESCE($6, sort_order),
       question_category = COALESCE($7, question_category),
       section_number = COALESCE($8, section_number),
       section_label = COALESCE($9, section_label),
       section_instruction = CASE WHEN $11::boolean THEN $10 ELSE section_instruction END,
       audio_script = CASE WHEN $13::boolean THEN $12 ELSE audio_script END,
       image_url = CASE WHEN $15::boolean THEN $14 ELSE image_url END
      WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      question,
      questionType,
      correctAnswer,
      explanation,
      sortOrder,
      category,
      sectionNo,
      sectionLabel || (sectionNo ? `Section ${sectionNo}` : null),
      sectionInstruction || null,
      hasSectionInstruction,
      audioScriptNorm,
      hasAudioScript,
      imageUrlNorm,
      hasImageUrl,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  if (Array.isArray(options)) {
    // Replace options wholesale
    await query(`DELETE FROM quiz_options WHERE question_id = $1`, [req.params.id]);
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
      );
    }
  }

  res.json({ question: result.rows[0] });
}));

router.delete('/quiz-questions/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// Bulk update section meta (label / instruction) — semua soal di (lesson,
// category, number) yang sama. Dipakai admin pas mereka edit info section,
// supaya ga perlu update tiap pertanyaan satu-satu.
router.put('/lessons/:lessonId/quiz/sections/:category/:number', asyncHandler(async (req, res) => {
  const { lessonId, category, number } = req.params;
  const { sectionLabel, sectionInstruction } = req.body || {};
  const cat = normalizeQuizCategory(category);
  const sectionNo = normalizeQuizSectionNumber(number);
  const hasLabel = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionLabel');
  const hasInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  if (!hasLabel && !hasInstruction) {
    return res.status(400).json({ error: 'sectionLabel or sectionInstruction required' });
  }
  const labelNorm = hasLabel
    ? ((sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`)
    : null;
  const instructionNorm = hasInstruction
    ? ((sectionInstruction && String(sectionInstruction).trim()) || null)
    : null;
  const result = await query(
    `UPDATE quiz_questions
        SET section_label = CASE WHEN $5::boolean THEN $3 ELSE section_label END,
            section_instruction = CASE WHEN $6::boolean THEN $4 ELSE section_instruction END
      WHERE lesson_id = $1 AND question_category = $2 AND section_number = $7`,
    [lessonId, cat, labelNorm, instructionNorm, hasLabel, hasInstruction, sectionNo]
  );
  res.json({ ok: true, updated: result.rowCount });
}));

// Delete whole section — semua soal di (lesson, category, number) terhapus.
router.delete('/lessons/:lessonId/quiz/sections/:category/:number', asyncHandler(async (req, res) => {
  const { lessonId, category, number } = req.params;
  const cat = normalizeQuizCategory(category);
  const sectionNo = normalizeQuizSectionNumber(number);
  const result = await query(
    `DELETE FROM quiz_questions
      WHERE lesson_id = $1 AND question_category = $2 AND section_number = $3`,
    [lessonId, cat, sectionNo]
  );
  res.json({ ok: true, deleted: result.rowCount });
}));

// ===== SENSEI =====

router.get('/sensei', asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM sensei ORDER BY sort_order ASC, created_at ASC`);
  res.json({ sensei: result.rows });
}));

router.post('/sensei', asyncHandler(async (req, res) => {
  const { name, title, bio, tags, photoUrl, photoPosition, sortOrder, isPublished } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = await query(
    `INSERT INTO sensei (name, title, bio, tags, photo_url, photo_position, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      name, title || null, bio || null,
      JSON.stringify(Array.isArray(tags) ? tags : []),
      photoUrl || null, photoPosition || null, sortOrder || 0, isPublished !== false,
    ]
  );
  res.status(201).json({ sensei: result.rows[0] });
}));

router.put('/sensei/:id', asyncHandler(async (req, res) => {
  const { name, title, bio, tags, photoUrl, photoPosition, sortOrder, isPublished } = req.body || {};
  const result = await query(
    `UPDATE sensei SET
       name = COALESCE($2, name),
       title = COALESCE($3, title),
       bio = COALESCE($4, bio),
       tags = COALESCE($5::jsonb, tags),
       photo_url = COALESCE($6, photo_url),
       photo_position = COALESCE($7, photo_position),
       sort_order = COALESCE($8, sort_order),
       is_published = COALESCE($9, is_published),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, name, title, bio,
      Array.isArray(tags) ? JSON.stringify(tags) : null,
      photoUrl, photoPosition, sortOrder, isPublished,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ sensei: result.rows[0] });
}));

router.delete('/sensei/:id', asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT photo_url FROM sensei WHERE id = $1`,
    [req.params.id]
  );
  await query(`DELETE FROM sensei WHERE id = $1`, [req.params.id]);
  await unlinkUploadByUrl(existing.rows[0]?.photo_url);
  res.json({ ok: true });
}));

// ===== TESTIMONIALS =====

router.get('/testimonials', asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM testimonials ORDER BY sort_order ASC, created_at ASC`);
  res.json({ testimonials: result.rows });
}));

router.post('/testimonials', asyncHandler(async (req, res) => {
  const { name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = await query(
    `INSERT INTO testimonials (name, location, occupation, photo_url, photo_position, quote, course_slug, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      name, location || null, occupation || null, photoUrl || null, photoPosition || null,
      quote || null, courseSlug || null, sortOrder || 0, isPublished !== false,
    ]
  );
  res.status(201).json({ testimonial: result.rows[0] });
}));

router.put('/testimonials/:id', asyncHandler(async (req, res) => {
  const { name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished } = req.body || {};
  const result = await query(
    `UPDATE testimonials SET
       name = COALESCE($2, name),
       location = COALESCE($3, location),
       occupation = COALESCE($4, occupation),
       photo_url = COALESCE($5, photo_url),
       photo_position = COALESCE($6, photo_position),
       quote = COALESCE($7, quote),
       course_slug = COALESCE($8, course_slug),
       sort_order = COALESCE($9, sort_order),
       is_published = COALESCE($10, is_published),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, name, location, occupation, photoUrl, photoPosition, quote, courseSlug, sortOrder, isPublished]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ testimonial: result.rows[0] });
}));

router.delete('/testimonials/:id', asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT photo_url FROM testimonials WHERE id = $1`,
    [req.params.id]
  );
  await query(`DELETE FROM testimonials WHERE id = $1`, [req.params.id]);
  await unlinkUploadByUrl(existing.rows[0]?.photo_url);
  res.json({ ok: true });
}));

// ===== USERS (admin view only) =====

router.get('/users', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.google_name, u.avatar_url, u.created_at,
            COALESCE(s.xp, 0) AS xp, COALESCE(s.streak_days, 0) AS streak_days,
            COALESCE(s.total_lessons_completed, 0) AS total_lessons_completed,
            s.last_active_date
     FROM users u
     LEFT JOIN user_stats s ON s.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT 500`
  );
  res.json({ users: result.rows });
}));

// ===== DISCUSSIONS (admin moderation) =====

router.get('/discussions', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.lesson_id, d.parent_id, d.content, d.is_admin_reply, d.is_deleted,
            d.created_at, d.user_id, u.full_name, u.email, u.avatar_url,
            l.title AS lesson_title
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     JOIN lessons l ON l.id = d.lesson_id
     ORDER BY d.created_at DESC
     LIMIT 200`
  );
  res.json({ discussions: result.rows });
}));

// ===== KANJI ITEMS (Daftar Kanji di main site) =====
// Terpisah dari PWA app/kanji.html (yang punya KD[] hardcoded). Source of
// truth = tabel kanji_items. Pola mirror module_vocabulary admin endpoints.

const KANJI_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
function normalizeKanjiLevel(value) {
  const v = String(value || '').toUpperCase();
  return KANJI_LEVELS.includes(v) ? v : 'N5';
}
function normalizeKanjiCompounds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    japanese: String(item?.japanese || '').trim(),
    reading: String(item?.reading || '').trim(),
    indonesian: String(item?.indonesian || '').trim(),
  })).filter((item) => item.japanese || item.reading || item.indonesian);
}

// List kanji per pelajaran. Lesson scope dipake admin "Kelola Kanji"
// (mirror "Kelola Deck"). Kanji jadi jenis pelajaran (lessons.type =
// 'kanji'), bukan tab admin global.
router.get('/lessons/:lessonId/kanji', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, character, jlpt_level, on_reading, kun_reading, meaning_id,
            mnemonic, compounds, stroke_count, bab_kode, sort_order
       FROM kanji_items
      WHERE lesson_id = $1
      ORDER BY sort_order ASC, character ASC`,
    [req.params.lessonId]
  );
  res.json({ kanji: result.rows });
}));

router.post('/kanji', asyncHandler(async (req, res) => {
  const {
    lessonId, character, jlptLevel, onReading, kunReading, meaningId,
    mnemonic, compounds, strokeCount, babKode, sortOrder,
  } = req.body || {};
  const ch = String(character || '').trim();
  if (!ch) return res.status(400).json({ error: 'character required' });
  const level = normalizeKanjiLevel(jlptLevel);
  const hasCompounds = Object.prototype.hasOwnProperty.call(req.body || {}, 'compounds');
  const safeCompounds = normalizeKanjiCompounds(compounds);
  const result = await query(
    `INSERT INTO kanji_items (
       lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id,
       mnemonic, compounds, stroke_count, bab_kode, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (character, jlpt_level) DO UPDATE SET
       lesson_id = COALESCE(EXCLUDED.lesson_id, kanji_items.lesson_id),
       on_reading = EXCLUDED.on_reading,
       kun_reading = EXCLUDED.kun_reading,
       meaning_id = EXCLUDED.meaning_id,
       mnemonic = EXCLUDED.mnemonic,
       compounds = CASE WHEN $12::boolean THEN EXCLUDED.compounds ELSE kanji_items.compounds END,
       stroke_count = EXCLUDED.stroke_count,
       bab_kode = EXCLUDED.bab_kode,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING *`,
    [
      lessonId || null,
      ch,
      level,
      (onReading && String(onReading).trim()) || null,
      (kunReading && String(kunReading).trim()) || null,
      (meaningId && String(meaningId).trim()) || null,
      (mnemonic && String(mnemonic).trim()) || null,
      JSON.stringify(safeCompounds),
      strokeCount != null && strokeCount !== '' ? Number(strokeCount) : null,
      (babKode && String(babKode).trim()) || null,
      Number(sortOrder) || 0,
      hasCompounds,
    ]
  );
  res.status(201).json({ kanji: result.rows[0] });
}));

router.put('/kanji/:id', asyncHandler(async (req, res) => {
  const {
    lessonId, character, jlptLevel, onReading, kunReading, meaningId,
    mnemonic, compounds, strokeCount, babKode, sortOrder,
  } = req.body || {};
  const ch = character != null ? String(character).trim() : null;
  const level = jlptLevel ? normalizeKanjiLevel(jlptLevel) : null;
  const hasLessonId = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const hasCompounds = Object.prototype.hasOwnProperty.call(req.body || {}, 'compounds');
  const safeCompounds = normalizeKanjiCompounds(compounds);
  const result = await query(
    `UPDATE kanji_items SET
       character = COALESCE($2, character),
       jlpt_level = COALESCE($3, jlpt_level),
       on_reading = $4,
       kun_reading = $5,
       meaning_id = $6,
       mnemonic = $7,
       stroke_count = $8,
       bab_kode = $9,
       sort_order = COALESCE($10, sort_order),
       lesson_id = CASE WHEN $12::boolean THEN $11 ELSE lesson_id END,
       compounds = CASE WHEN $14::boolean THEN $13::jsonb ELSE kanji_items.compounds END
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      ch || null,
      level,
      (onReading && String(onReading).trim()) || null,
      (kunReading && String(kunReading).trim()) || null,
      (meaningId && String(meaningId).trim()) || null,
      (mnemonic && String(mnemonic).trim()) || null,
      strokeCount != null && strokeCount !== '' ? Number(strokeCount) : null,
      (babKode && String(babKode).trim()) || null,
      sortOrder != null && sortOrder !== '' ? Number(sortOrder) : null,
      lessonId || null,
      hasLessonId,
      JSON.stringify(safeCompounds),
      hasCompounds,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ kanji: result.rows[0] });
}));

router.delete('/kanji/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM kanji_items WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// Bulk-import kanji dari Notion DB "📖 Kanji" ke satu pelajaran. Mirror
// pola import-notion-deck: filter by relation Bab page, upsert by
// (character, jlpt_level), set lesson_id ke pelajaran target.
//
// Robust matching:
// - babPageId opsional: kalau kosong / "all", import semua row di DB.
// - Coba beberapa relation prop name (Lesson/Pelajaran/Bab/Chapter).
//   Kalau semua gagal di-filter, fallback ke unfiltered + warn.
// - Kalau total=0 (ga ada character yg match property), return diagnostic
//   berisi property names yg ada di sample page biar admin bisa sesuain
//   nama propertinya di Notion.
router.post('/lessons/:lessonId/import-notion-kanji-bab', notionImportLimiter, asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const { babPageId, jlptLevel } = req.body || {};
  const dbId = notionIdFromInput((req.body || {}).notionKanjiDbId) || notionIdFromInput(process.env.NOTION_KANJI_DB_ID);
  if (!dbId) return res.status(400).json({ error: 'notion_db_required', detail: 'Set NOTION_KANJI_DB_ID atau paste URL DB di field' });
  const level = normalizeKanjiLevel(jlptLevel);
  const lessonId = req.params.lessonId;

  const lessonRow = await query(`SELECT id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  if (lessonRow.rows[0].type !== 'kanji') {
    return res.status(400).json({ error: 'lesson_not_kanji', detail: 'Pelajaran ini bukan tipe kanji' });
  }

  // Strategi filter berlapis:
  // 1. Coba pakai relation prop (Lesson/Pelajaran/Bab/Chapter/First Lesson)
  //    kalau babPageId valid. Lots of Notion DB nyebut beda-beda.
  // 2. Kalau gagal / babPageId='all', fallback ke filter by JLPT Level
  //    (kalau DB punya select property "JLPT Level") — supaya admin pilih
  //    level N5 ga dapet 2000+ kanji semua level.
  // 3. Kalau semuanya gagal, ambil unfiltered (warn user).
  const wantFilter = !!babPageId && babPageId !== 'all';
  const RELATION_CANDIDATES = [
    'Lesson', 'Pelajaran', 'Bab', 'Chapter', 'First Lesson',
    NOTION_VOCAB_LESSON_RELATION,
  ];
  const LEVEL_PROP_CANDIDATES = ['JLPT Level', 'JLPT', 'Level', 'Tingkat'];
  let pages = null;
  let matchedRelationProp = null;
  let matchedLevelProp = null;
  let usedFallbackUnfiltered = false;
  let notionError = null;

  if (wantFilter) {
    for (const propName of RELATION_CANDIDATES) {
      try {
        const r = await notionQueryAll(dbId, token, {
          filter: { property: propName, relation: { contains: babPageId } },
        });
        if (r.length > 0) { pages = r; matchedRelationProp = propName; break; }
      } catch (err) {
        notionError = err;
      }
    }
  }

  // Filter by JLPT Level select sebagai langkah kedua / fallback utama.
  if (!pages) {
    for (const propName of LEVEL_PROP_CANDIDATES) {
      try {
        const r = await notionQueryAll(dbId, token, {
          filter: { property: propName, select: { equals: level } },
        });
        if (r.length > 0) { pages = r; matchedLevelProp = propName; break; }
      } catch (err) {
        notionError = err;
      }
    }
  }

  // Fallback terakhir: ambil semua row dari DB (unfiltered).
  if (!pages) {
    try {
      pages = await notionQueryAll(dbId, token);
      usedFallbackUnfiltered = true;
    } catch (err) {
      return notionErrorResponse(res, err, 'Cek integration share ke DB Kanji di Notion.');
    }
  }

  let imported = 0, updated = 0, total = 0;
  const startSort = (await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kanji_items WHERE lesson_id = $1`,
    [lessonId]
  )).rows[0].next;
  let sort = startSort;
  // Aliases super-banyak supaya tahan beda-beda schema. Misal:
  // - On'yomi 音読み / On 音読み / On / 音読み / Onyomi / On Reading / On'yomi
  // - Meaning (ID) / Indonesian / Arti / Meaning / Bahasa Indonesia / Indo
  // Fallback meaning_id ke Meaning (EN) kalau ID kosong.
  for (const page of pages) {
    const props = page.properties || {};
    const character = notionPlainText(pickProp(props, ['Kanji 漢字', 'Kanji', '漢字', 'Character', 'Karakter', 'Name', 'Title'])).trim();
    if (!character) continue;
    total++;
    const onReading = notionPlainText(pickProp(props, [
      "On'yomi 音読み", "On'yomi", 'On 音読み', 'On', '音読み', 'Onyomi', 'On Reading',
    ])).trim() || null;
    const kunReading = notionPlainText(pickProp(props, [
      "Kun'yomi 訓読み", "Kun'yomi", 'Kun 訓読み', 'Kun', '訓読み', 'Kunyomi', 'Kun Reading',
    ])).trim() || null;
    const meaningIdRaw = notionPlainText(pickProp(props, [
      'Meaning (ID)', 'Indonesian', 'Arti', 'Bahasa Indonesia', 'Indo',
    ])).trim();
    const meaningEn = notionPlainText(pickProp(props, ['Meaning (EN)', 'Meaning', 'English'])).trim();
    const meaningId = meaningIdRaw || meaningEn || null;
    const mnemonic = notionPlainText(pickProp(props, [
      'Mnemonic', 'Mnemonik', 'Cara Ingat', 'Trik', 'Note', 'Catatan',
    ])).trim() || null;
    const strokeCount = notionNumber(pickProp(props, ['Stroke Count', 'Goresan', 'Strokes', 'Stroke']));
    const babKode = notionPlainText(pickProp(props, ['Kode Bab', 'Kode', 'Code'])).trim() || null;

    const existing = await query(
      `SELECT id FROM kanji_items WHERE character = $1 AND jlpt_level = $2 LIMIT 1`,
      [character, level]
    );
    if (existing.rows.length > 0) {
      await query(
        `UPDATE kanji_items SET
           lesson_id = $2,
           on_reading = $3, kun_reading = $4, meaning_id = $5, mnemonic = $6,
           stroke_count = $7, bab_kode = COALESCE($8, bab_kode), updated_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].id, lessonId, onReading, kunReading, meaningId, mnemonic, strokeCount, babKode]
      );
      updated++;
    } else {
      await query(
        `INSERT INTO kanji_items (
           lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id,
           mnemonic, stroke_count, bab_kode, sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [lessonId, character, level, onReading, kunReading, meaningId, mnemonic, strokeCount, babKode, sort++]
      );
      imported++;
    }
  }

  // Diagnostic: kalau ga ada satu pun character ke-extract, kasih tahu
  // properti apa yg sebenarnya ada di Notion biar admin bisa sesuain.
  const diagnostic = {};
  if (total === 0 && pages.length > 0) {
    const sampleProps = pages[0].properties || {};
    diagnostic.notionPropertyNames = Object.keys(sampleProps);
    diagnostic.expectedCharacterProperty = ['Kanji 漢字', 'Kanji', '漢字', 'Character', 'Karakter'];
    diagnostic.hint = 'Pages ditemukan tapi nama properti karakter di Notion ga match. Rename salah satu properti DB Notion-mu jadi "Kanji" atau "漢字".';
  } else if (pages.length === 0) {
    diagnostic.hint = 'DB Notion-mu kosong atau integration belum di-share ke DB tersebut (notion.so → Share → Add connection → pilih integration).';
  }

  res.json({
    imported,
    updated,
    total,
    notionPagesScanned: pages.length,
    matchedRelationProp,
    matchedLevelProp,
    usedFallbackUnfiltered,
    ...(Object.keys(diagnostic).length ? { diagnostic } : {}),
  });
}));

export default router;
