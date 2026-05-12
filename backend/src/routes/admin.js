import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

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
    jfTopic, cefrLevel, titleEn, scenario,
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
       jf_topic, cefr_level, title_en, scenario,
       cando_statements, skill_distribution, quiz_spec
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)
     RETURNING *`,
    [
      courseId, slug, title, description || null, sortOrder || 0,
      jfTopic || null, cefrLevel || null, titleEn || null, scenario || null,
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
    jfTopic, cefrLevel, titleEn, scenario,
    candoStatements, skillDistribution, quizSpec,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
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
       cando_statements = COALESCE($10::jsonb, cando_statements),
       skill_distribution = COALESCE($11::jsonb, skill_distribution),
       quiz_spec = COALESCE($12::jsonb, quiz_spec),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, sortOrder,
      jfTopic, cefrLevel, titleEn, scenario,
      Array.isArray(candoStatements) ? JSON.stringify(candoStatements) : null,
      skillDistribution && typeof skillDistribution === 'object' ? JSON.stringify(skillDistribution) : null,
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

// ===== IMPORT VOCAB FROM NOTION =====
// Pulls the "📚 Vocabulary 語彙" Notion database into module_vocabulary as bank
// items (lesson_id NULL). Manual: triggered by an admin button. Upsert by
// `japanese` within the module — re-running adds new words AND refreshes
// reading/indonesian/category/note on existing ones from Notion (lesson_id and
// any manual deck wiring are left untouched). Needs NOTION_TOKEN in env
// (integration shared with the DB).
function notionIdFromInput(s) {
  if (!s) return null;
  const m = String(s).match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  return m ? m[0].replace(/-/g, '') : null;
}
function notionPlainText(prop) {
  if (!prop) return '';
  const arr = prop.title || prop.rich_text;
  if (Array.isArray(arr)) return arr.map((t) => (t && t.plain_text) || '').join('');
  if (prop.select && typeof prop.select === 'object') return prop.select.name || '';
  if (prop.status && typeof prop.status === 'object') return prop.status.name || '';
  return '';
}
function pickProp(props, names) {
  for (const n of names) if (props[n] !== undefined) return props[n];
  const lower = {};
  for (const k of Object.keys(props)) lower[k.toLowerCase()] = props[k];
  for (const n of names) if (lower[n.toLowerCase()] !== undefined) return lower[n.toLowerCase()];
  return null;
}

router.post('/import-notion-vocab', asyncHandler(async (req, res) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'notion_not_configured', detail: 'Set NOTION_TOKEN di backend/.env' });
  const { moduleId } = req.body || {};
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });
  const dbId = notionIdFromInput((req.body || {}).notionDbId) || notionIdFromInput(process.env.NOTION_VOCAB_DB_ID);
  if (!dbId) return res.status(400).json({ error: 'notion_db_required', detail: 'Set NOTION_VOCAB_DB_ID atau kirim notionDbId' });

  const mod = await query(`SELECT id FROM modules WHERE id = $1`, [moduleId]);
  if (mod.rows.length === 0) return res.status(404).json({ error: 'module not found' });

  // japanese -> existing row id, so re-import updates rows in place rather than
  // skipping them. Notion is the source of truth for the imported fields.
  const existing = await query(`SELECT id, japanese FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
  const byJapanese = new Map();
  for (const r of existing.rows) {
    const j = (r.japanese || '').trim();
    if (j && !byJapanese.has(j)) byJapanese.set(j, r.id);
  }

  let cursor = null, imported = 0, updated = 0, total = 0, sort = byJapanese.size;
  for (let guard = 0; guard < 100; guard++) {
    let resp;
    try {
      resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
      });
    } catch (err) {
      return res.status(502).json({ error: 'notion_unreachable', detail: err.message });
    }
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return res.status(502).json({ error: 'notion_error', status: resp.status, detail: detail.slice(0, 400) });
    }
    const data = await resp.json();
    for (const page of data.results || []) {
      const props = page.properties || {};
      const japanese = notionPlainText(pickProp(props, ['Japanese 日本語', 'Japanese', '日本語', 'Bahasa Jepang'])).trim();
      if (!japanese) continue;
      total++;
      const reading = notionPlainText(pickProp(props, ['Reading 読み', 'Reading', '読み', 'Cara Baca'])).trim() || null;
      const indonesian = notionPlainText(pickProp(props, ['Indonesian', 'Bahasa Indonesia'])).trim() || null;
      const category = notionPlainText(pickProp(props, ['Category', 'Kategori'])).trim() || null;
      const note = notionPlainText(pickProp(props, ['Note', 'Catatan'])).trim() || null;
      const existingId = byJapanese.get(japanese);
      if (existingId) {
        await query(
          `UPDATE module_vocabulary SET reading = $2, indonesian = $3, category = $4, note = $5, updated_at = NOW()
           WHERE id = $1`,
          [existingId, reading, indonesian, category, note]
        );
        updated++;
      } else {
        const r = await query(
          `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [moduleId, japanese, reading, indonesian, category, note, sort++]
        );
        byJapanese.set(japanese, r.rows[0].id);
        imported++;
      }
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  res.json({ imported, updated, total });
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
  const { moduleId, slug, title, type, content, videoUrl, durationMinutes, sortOrder } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await query(
    `INSERT INTO lessons (module_id, slug, title, type, content, video_url, duration_minutes, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [moduleId, slug, title, type || 'text', content || null, videoUrl || null, durationMinutes || null, sortOrder || 0]
  );
  res.status(201).json({ lesson: result.rows[0] });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const { slug, title, type, content, videoUrl, durationMinutes, sortOrder } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const result = await query(
    `UPDATE lessons SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       type = COALESCE($4, type),
       content = COALESCE($5, content),
       video_url = COALESCE($6, video_url),
       duration_minutes = COALESCE($7, duration_minutes),
       sort_order = COALESCE($8, sort_order)
     WHERE id = $1 RETURNING *`,
    [req.params.id, slug, title, type, content, videoUrl, durationMinutes, sortOrder]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ lesson: result.rows[0] });
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM lessons WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== QUIZ QUESTIONS (with options in one call) =====

router.get('/lessons/:lessonId/quiz', asyncHandler(async (req, res) => {
  const questions = await query(
    `SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY sort_order ASC`,
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
  });
}));

router.post('/quiz-questions', asyncHandler(async (req, res) => {
  const {
    lessonId, question, questionType, correctAnswer, explanation, sortOrder, options,
  } = req.body || {};
  if (!lessonId || !question) return res.status(400).json({ error: 'lessonId and question required' });

  const qRes = await query(
    `INSERT INTO quiz_questions (lesson_id, question, question_type, correct_answer, explanation, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [lessonId, question, questionType || 'multiple_choice', correctAnswer || null, explanation || null, sortOrder || 0]
  );
  const q = qRes.rows[0];

  if (Array.isArray(options) && options.length > 0) {
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [q.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, i]
      );
    }
  }

  res.status(201).json({ question: q });
}));

router.put('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const { question, questionType, correctAnswer, explanation, sortOrder, options } = req.body || {};
  const result = await query(
    `UPDATE quiz_questions SET
       question = COALESCE($2, question),
       question_type = COALESCE($3, question_type),
       correct_answer = COALESCE($4, correct_answer),
       explanation = COALESCE($5, explanation),
       sort_order = COALESCE($6, sort_order)
     WHERE id = $1 RETURNING *`,
    [req.params.id, question, questionType, correctAnswer, explanation, sortOrder]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  if (Array.isArray(options)) {
    // Replace options wholesale
    await query(`DELETE FROM quiz_options WHERE question_id = $1`, [req.params.id]);
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, i]
      );
    }
  }

  res.json({ question: result.rows[0] });
}));

router.delete('/quiz-questions/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
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

export default router;
