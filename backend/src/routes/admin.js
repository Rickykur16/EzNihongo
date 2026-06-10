import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { COACH_PROMPT_DEFAULT } from './recommendations.js';
import { callClaude, anthropicEnabled } from '../anthropic.js';
import {
  NOTION_BAB_DB_ID_DEFAULT,
  NOTION_VOCAB_LESSON_RELATION,
  notionIdFromInput,
  notionPlainText,
  notionNumber,
  pickProp,
  notionQueryAll,
} from '../notion.js';
import {
  ttsHashKey,
  parseDialog,
  voiceForSpeaker,
  fetchElevenAudio,
  TTS_ELEVEN_VOICE_ID,
  TTS_ELEVEN_MODEL,
  TTS_SETTINGS_VERSION,
} from './tts.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

// POST /api/admin/set-password — admin meng-set/ubah password (self-service).
// Tanpa `email` → set password milik admin yang sedang login. Dengan `email`
// (provisioning co-admin) → email itu WAJIB ada di ADMIN_EMAILS. Authz admin
// tetap via ADMIN_EMAILS; ini hanya menambah cara login email+password.
router.post('/set-password', asyncHandler(async (req, res) => {
  const password = String(req.body?.password || '');
  const targetEmailRaw = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const email = targetEmailRaw || String(req.user.email || '').toLowerCase();

  if (password.length < 10) {
    return res.status(400).json({ error: 'weak_password', detail: 'Password minimal 10 karakter.' });
  }
  if (targetEmailRaw && !isAdminEmail(targetEmailRaw)) {
    return res.status(400).json({ error: 'not_admin_email', detail: 'Email itu bukan admin (tidak ada di ADMIN_EMAILS).' });
  }

  const hash = await bcrypt.hash(password, 12);
  // UPSERT: kalau row email sudah ada → update password_hash; kalau belum ada
  // (admin password-only yang belum pernah login Google) → insert row minimal.
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rows.length > 0) {
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, existing.rows[0].id]);
  } else {
    const fallbackName = email.split('@')[0] || 'Admin';
    const ins = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      [email, hash, fallbackName]
    );
    await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [ins.rows[0].id]);
  }
  res.json({ ok: true, email });
}));

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

// ===== GRAMMAR TASK ITEMS (grammar picked into a 'grammar_task' lesson) =====
// Reuse module_grammar as the bank (same grammar can be used across tasks).

router.get('/lessons/:lessonId/grammar-task-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT gi.lesson_id, gi.grammar_id, gi.sort_order, gi.instruction, gi.required_count,
            g.pattern, g.meaning, g.example, g.module_id
     FROM lesson_grammar_task_items gi JOIN module_grammar g ON g.id = gi.grammar_id
     WHERE gi.lesson_id = $1
     ORDER BY gi.sort_order ASC, g.sort_order ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.put('/lessons/:lessonId/grammar-task-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (!it.grammarId) continue;
    const reqCount = Math.min(10, Math.max(1, Number(it.requiredCount) || 1));
    await query(
      `INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (lesson_id, grammar_id)
         DO UPDATE SET sort_order = EXCLUDED.sort_order,
                       instruction = EXCLUDED.instruction,
                       required_count = EXCLUDED.required_count`,
      [req.params.lessonId, it.grammarId, it.sortOrder ?? i, (it.instruction || '').trim() || null, reqCount]
    );
  }
  res.json({ ok: true });
}));

router.delete('/lessons/:lessonId/grammar-task-items/:grammarId', asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM lesson_grammar_task_items WHERE lesson_id = $1 AND grammar_id = $2`,
    [req.params.lessonId, req.params.grammarId]
  );
  res.json({ ok: true });
}));

// ===== APP SETTINGS (editable AI grammar-eval prompt) =====

router.get('/settings/grammar-eval-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'grammar_eval_prompt'`);
  res.json({ value: r.rows[0]?.value || '' });
}));

router.put('/settings/grammar-eval-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('grammar_eval_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

router.get('/settings/quiz-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'quiz_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: QUIZ_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/quiz-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('quiz_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

// Prompt catatan coaching belajar adaptif (app_settings.coaching_note_prompt).
// Placeholder: {{studentName}} {{weakCategory}} {{accuracyPct}} {{lessonTitles}}.
router.get('/settings/coaching-note-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'coaching_note_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: COACH_PROMPT_DEFAULT });
}));

router.put('/settings/coaching-note-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('coaching_note_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
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

// ===== AI QUIZ GENERATOR (Claude) =====
// Generate draft soal kuis pakai Claude, grounded ke kosakata + grammar modul
// pelajaran. Endpoint ini TIDAK menyimpan ke DB — balikin draft buat admin
// review/edit di UI, lalu admin simpan lewat POST /admin/quiz-questions.
// ANTHROPIC_API_KEY opsional (kosong -> 503).
const QUIZ_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const QUIZ_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const QUIZ_GEN_SYSTEM = `You are a Japanese-language quiz author for Indonesian learners (JLPT N5/N4) on the EzNihongo platform. Write accurate questions grounded ONLY in the study material provided. Always reply with a single valid JSON object and nothing else.`;

const quizGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'Tunggu sebentar sebelum generate lagi.' },
});

function _extractJsonObject(text) {
  const str = String(text || '');
  const a = str.indexOf('{');
  const b = str.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(str.slice(a, b + 1)); } catch { return null; }
}

// Jenis soal yang bisa diminta admin -> (questionType, questionCategory).
const QUIZ_KINDS = {
  mc_vocab:   { type: 'multiple_choice', cat: 'vocabulary', label: 'pilihan ganda kosakata (questionType=multiple_choice, questionCategory=vocabulary, 4 opsi 1 benar)' },
  mc_grammar: { type: 'multiple_choice', cat: 'grammar',    label: 'pilihan ganda grammar (multiple_choice, grammar, 4 opsi 1 benar)' },
  fill_blank: { type: 'fill_blank',      cat: 'vocabulary', label: 'isian (questionType=fill_blank, isi "correctAnswer", "options": [])' },
  listening:  { type: 'multiple_choice', cat: 'listening',  label: 'menyimak (multiple_choice, questionCategory=listening, isi "audioScript" dialog gaya JLPT format N:/A:/B:, 4 opsi 1 benar)' },
};

// Prompt generator editable admin (app_settings.quiz_gen_prompt). Placeholder
// diisi per request: {{count}} {{kinds}} {{instruction}} {{vocab}} {{grammar}}.
const QUIZ_GEN_PROMPT_DEFAULT = `Buatkan {{count}} soal kuis bahasa Jepang gaya JLPT N5/N4. Distribusikan sesuai jenis yang diminta.

Jenis soal yang diminta:
{{kinds}}

{{instruction}}
Gunakan HANYA materi di bawah sebagai sumber. Jangan mengarang kosakata atau pola di luar ini.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}

Aturan umum:
- "explanation": 1 kalimat Bahasa Indonesia, alasan/arti singkat.
- multiple_choice: tepat 4 opsi, tepat 1 dengan "isCorrect": true. Distraktor masuk akal & sepadan (panjang/jenis mirip).

Aturan per jenis soal:
- kosakata (questionCategory "vocabulary", multiple_choice) = MOJI-GOI cara baca kanji:
  * field "question" HANYA satu kalimat contoh natural. DILARANG menulis pertanyaan ("読み方は何ですか" dsb) atau tanda kutip 「」 — instruksi mondai sudah otomatis tampil di header section.
  * kata target ditulis KANJI dan WAJIB dibungkus tag <u>…</u> (hanya kata target, bukan seluruh kalimat). Contoh: 私の <u>仕事</u> はエンジニアです。
  * 4 opsi = cara baca HIRAGANA kata target; 1 benar (sesuai "reading" di daftar), 3 salah = kana mirip/diacak (ubah urutan kana, vokal panjang/pendek, dengung す/ず・し/じ, atau っ/つ). Contoh しごと → しゅう, じぎょう, しぎょう.
- grammar (questionCategory "grammar", multiple_choice): kalimat dengan ＿＿ kosong; 4 opsi pola/partikel, 1 benar.
- isian (questionType "fill_blank", questionCategory "vocabulary"): isi "correctAnswer" (jawaban singkat), "options": [].
- menyimak (questionCategory "listening", multiple_choice): isi "audioScript" = dialog gaya JLPT, 1 baris per turn dengan prefix speaker — "N: " narator (baris pertama: situasi + pertanyaan; baris terakhir: pertanyaan diulang), "A: " perempuan, "B: " laki-laki, turn dipisah \\n. "question" = pertanyaan Jepang yang dibacakan narator; 4 opsi, 1 benar sesuai isi dialog. (Untuk soal listening per-mondai yang lebih autentik pakai tombol "Generate Listening JLPT".)

Balas HANYA JSON valid tanpa teks lain, bentuk:
{"questions":[{"question":"私の <u>仕事</u> はエンジニアです。","questionType":"multiple_choice","questionCategory":"vocabulary","audioScript":"","correctAnswer":"","explanation":"仕事 dibaca しごと = pekerjaan.","options":[{"text":"しごと","isCorrect":true},{"text":"しゅう","isCorrect":false},{"text":"じぎょう","isCorrect":false},{"text":"しぎょう","isCorrect":false}]}]}`;

function _fillTemplate(tpl, vars) {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

async function _loadQuizGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'quiz_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : QUIZ_GEN_PROMPT_DEFAULT;
  } catch {
    return QUIZ_GEN_PROMPT_DEFAULT;
  }
}

router.post('/lessons/:lessonId/generate-quiz', quizGenLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const count = Math.min(30, Math.max(1, Number(req.body?.count) || 10));
  let kinds = Array.isArray(req.body?.kinds) ? req.body.kinds.filter((k) => QUIZ_KINDS[k]) : [];
  if (kinds.length === 0) kinds = ['mc_vocab', 'mc_grammar'];
  const instruction = String(req.body?.instruction || '').slice(0, 500).trim();

  const lessonRes = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });

  // Grounding: vocab (prefer deck-wired di modul) + grammar modul.
  let vocabRes = await query(
    `SELECT DISTINCT v.japanese, v.reading, v.indonesian, v.category
     FROM module_vocabulary v
     JOIN lesson_deck_items di ON di.vocabulary_id = v.id
     JOIN lessons l ON l.id = di.lesson_id
     WHERE l.module_id = $1 AND l.type = 'deck' AND v.japanese IS NOT NULL AND v.japanese <> ''
     LIMIT 80`,
    [lesson.module_id]
  );
  if (vocabRes.rows.length < 4) {
    vocabRes = await query(
      `SELECT japanese, reading, indonesian, category
       FROM module_vocabulary
       WHERE module_id = $1 AND japanese IS NOT NULL AND japanese <> ''
       LIMIT 80`,
      [lesson.module_id]
    );
  }
  const grammarRes = await query(
    `SELECT pattern, meaning, example FROM module_grammar
     WHERE module_id = $1 AND pattern IS NOT NULL AND pattern <> ''
     LIMIT 30`,
    [lesson.module_id]
  );

  if (vocabRes.rows.length === 0 && grammarRes.rows.length === 0) {
    return res.status(400).json({ error: 'not_enough_material', detail: 'Modul ini belum punya kosakata/grammar. Import materi dulu.' });
  }
  if (!QUIZ_ANTHROPIC_KEY) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const vocabLines = vocabRes.rows.map((v) =>
    `- ${v.japanese}${v.reading ? ` (${v.reading})` : ''} = ${v.indonesian || '?'}${v.category ? ` [${v.category}]` : ''}`).join('\n');
  const grammarLines = grammarRes.rows.map((g) =>
    `- ${g.pattern}${g.meaning ? ` = ${g.meaning}` : ''}${g.example ? `. Contoh: ${g.example}` : ''}`).join('\n');
  const kindLines = kinds.map((k) => `- ${QUIZ_KINDS[k].label}`).join('\n');

  const promptTpl = await _loadQuizGenPrompt();
  const userContent = _fillTemplate(promptTpl, {
    count,
    kinds: kindLines,
    instruction: instruction ? `Instruksi tambahan dari admin: ${instruction}` : '',
    vocab: vocabLines || '(tidak ada)',
    grammar: grammarLines || '(tidak ada)',
  });

  let parsed;
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': QUIZ_ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: QUIZ_ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: QUIZ_GEN_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('Anthropic quiz-gen:', upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'ai_upstream' });
    }
    const data = await upstream.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      : '';
    parsed = _extractJsonObject(text);
  } catch (err) {
    console.error('Anthropic quiz-gen error:', err.message);
    return res.status(502).json({ error: 'ai_upstream' });
  }
  if (!parsed || !Array.isArray(parsed.questions)) return res.status(502).json({ error: 'ai_parse' });

  const allowedTypes = new Set(kinds.map((k) => QUIZ_KINDS[k].type));
  const allowedCats = new Set(kinds.map((k) => QUIZ_KINDS[k].cat));
  const fallbackCat = allowedCats.values().next().value;
  const clean = [];
  for (const q of parsed.questions) {
    if (!q || typeof q !== 'object') continue;
    const question = String(q.question || '').trim().slice(0, 1000);
    if (!question) continue;
    const qtype = q.questionType === 'fill_blank' ? 'fill_blank' : 'multiple_choice';
    if (!allowedTypes.has(qtype)) continue;
    let qcat = ['vocabulary', 'grammar', 'listening'].includes(q.questionCategory) ? q.questionCategory : 'vocabulary';
    if (!allowedCats.has(qcat)) qcat = fallbackCat;
    const explanation = String(q.explanation || '').trim().slice(0, 1000);
    const audioScript = String(q.audioScript || '').trim().slice(0, 500);
    if (qtype === 'fill_blank') {
      const correctAnswer = String(q.correctAnswer || '').trim().slice(0, 200);
      if (!correctAnswer) continue;
      clean.push({ question, questionType: 'fill_blank', questionCategory: qcat, audioScript: '', correctAnswer, explanation, options: [] });
    } else {
      let options = Array.isArray(q.options)
        ? q.options.map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect })).filter((o) => o.text)
        : [];
      if (options.length < 2) continue;
      options = options.slice(0, 6);
      let firstCorrect = options.findIndex((o) => o.isCorrect);
      if (firstCorrect === -1) firstCorrect = 0;
      options = options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
      clean.push({ question, questionType: 'multiple_choice', questionCategory: qcat, audioScript: qcat === 'listening' ? audioScript : '', correctAnswer: '', explanation, options });
    }
    if (clean.length >= count) break;
  }
  if (clean.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan soal valid. Coba lagi.' });

  res.json({ questions: clean, vocabPool: vocabRes.rows.length, grammarPool: grammarRes.rows.length });
}));

// Generate opsi pilihan ganda (AI) untuk SATU soal — dipakai tombol "Generate
// opsi" di editor soal admin. Admin tulis pertanyaannya, AI isikan 4 opsi
// (1 benar) + penjelasan. Untuk listening, jawaban di-grounding ke audio
// script. ANTHROPIC_API_KEY kosong → 503.
router.post('/generate-question-options', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const question = String(body.question || '').trim().slice(0, 2000);
  const category = normalizeQuizCategory(body.questionCategory);
  const audioScript = String(body.audioScript || '').trim().slice(0, 1000);
  if (!question) return res.status(400).json({ error: 'question required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const ctxBlocks = [];
  if (category === 'listening' && audioScript) ctxBlocks.push(`Skrip audio (listening):\n${audioScript}`);

  const userContent = `Buat 4 opsi jawaban pilihan ganda untuk soal kuis bahasa Jepang (JLPT N5/N4).
Kategori: ${category}.
${ctxBlocks.join('\n\n')}

Soal: ${question}

Aturan:
- Tepat 4 opsi, TEPAT 1 yang benar.${category === 'listening' ? ' Jawaban benar HARUS sesuai isi skrip audio di atas.' : ''}
- Distraktor (opsi salah) masuk akal & sepadan (panjang/jenis mirip), bukan asal-asalan.
- Bahasa opsi mengikuti konteks soal (Indonesia atau Jepang).
- "explanation": alasan singkat dalam Bahasa Indonesia kenapa jawaban benar.

Balas HANYA JSON valid tanpa teks lain:
{"options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"explanation":"..."}`;

  const text = await callClaude({ system: QUIZ_GEN_SYSTEM, userContent, maxTokens: 700 });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.options)) return res.status(502).json({ error: 'ai_parse' });

  let options = parsed.options
    .map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect }))
    .filter((o) => o.text)
    .slice(0, 6);
  if (options.length < 2) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan opsi valid. Coba lagi.' });
  let firstCorrect = options.findIndex((o) => o.isCorrect);
  if (firstCorrect === -1) firstCorrect = 0;
  options = options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
  const explanation = String(parsed.explanation || '').trim().slice(0, 1000);
  res.json({ options, explanation });
}));

// ===== GENERATOR SOAL LISTENING GAYA JLPT (Claude) =====
// Satu run = satu tipe mondai JLPT (課題理解 / ポイント理解 / 発話表現 / 即時応答).
// AI menghasilkan soal LENGKAP: audioScript dialog format 3-voice (N:/A:/B:,
// sama dgn format yang dimengerti parseDialog di tts.js) + pertanyaan + opsi +
// penjelasan. Draft TIDAK disimpan — admin review di UI lalu simpan via
// POST /admin/quiz-questions, masuk section listening sesuai nomor mondai.
//
// Struktur tiap tipe mengikuti format resmi ujian JLPT N5/N4:
// - 課題理解 (mondai 1): N: situasi+pertanyaan → dialog A/B → N: pertanyaan
//   diulang. Pertanyaan = aksi berikutnya / barang yang dibeli. 4 opsi.
// - ポイント理解 (mondai 2): kerangka sama, pertanyaan menarget satu poin
//   (alasan/waktu/tempat/orang). 4 opsi.
// - 発話表現 (mondai 3): N: situasi singkat + 「何と言いますか。」. 3 opsi ucapan.
// - 即時応答 (mondai 4): satu ucapan pendek A/B tanpa narator. 3 opsi balasan.
// (Di ujian asli opsi mondai 3/4 dibacakan, tidak dicetak — di platform kita
// opsi tampil di layar; kompromi yang disengaja.)
const JLPT_LISTENING_TASKS = {
  kadai: {
    number: 1,
    label: 'もんだい1 課題理解',
    instruction: 'もんだい1では、はじめに しつもんを きいて ください。それから はなしを きいて、1から4の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 4,
    name: '課題理解 (memahami tugas/aksi berikutnya)',
    rules: `Struktur audioScript WAJIB:
- Baris pertama → N: [kalimat situasi][pertanyaan]. Pola situasi baku: 「店で、男の人と女の人が話しています。」「学校で先生が話しています。」 Pertanyaan menarget AKSI berikutnya atau barang/jumlah: 「男の人はこのあとまず何をしますか。」「女の人は何を買いますか。」
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian.
- Baris terakhir → N: [pertanyaan yang SAMA PERSIS diulang].
Konvensi distraktor: dialog menyebut KEEMPAT opsi secara alami, tiga dieliminasi di alur percakapan (sudah dikerjakan / untuk besok / batal — 「もう〜ました」「やっぱり」「その前に」「あとで」). Jawaban TIDAK boleh hanya dari kalimat pertama dialog.
"question" = teks pertanyaan Jepang yang sama dengan yang dibacakan narator.
Opsi: 4 frasa Jepang pendek (bukan kalimat panjang), TEPAT 1 benar.`,
  },
  point: {
    number: 2,
    label: 'もんだい2 ポイント理解',
    instruction: 'もんだい2では、はじめに しつもんを きいて ください。それから はなしを きいて、1から4の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 4,
    name: 'ポイント理解 (menangkap poin spesifik)',
    rules: `Struktur audioScript WAJIB:
- Baris pertama → N: [kalimat situasi][pertanyaan]. Pertanyaan menarget SATU poin spesifik: alasan (どうして), waktu (いつ/何時), tempat (どこ), orang (だれ), atau hal yang disukai/tidak. Contoh pola: 「女の人はどうしてパーティーに行きませんか。」「二人は何時に会いますか。」
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian; sedikit lebih panjang dari mondai 1.
- Baris terakhir → N: [pertanyaan yang SAMA PERSIS diulang].
Konvensi distraktor: dialog menyebut beberapa kandidat jawaban yang salah sebelum jawaban benar muncul (mis. tebakan pertama lawan bicara salah, lalu dikoreksi).
"question" = teks pertanyaan Jepang yang sama dengan yang dibacakan narator.
Opsi: 4 frasa/klausa Jepang pendek, TEPAT 1 benar.`,
  },
  hatsuwa: {
    number: 3,
    label: 'もんだい3 発話表現',
    instruction: 'もんだい3では、ぶんを きいて、1から3の なかから、いちばん いい ものを ひとつ えらんで ください。',
    optionCount: 3,
    name: '発話表現 (memilih ucapan yang tepat untuk situasi)',
    rules: `Struktur audioScript WAJIB (di ujian asli ketiga pilihan DIBACAKAN, jadi ikutkan di script):
- Baris 1 → N: [1-2 kalimat situasi]。何と言いますか。 Contoh pola: 「朝、学校で先生に会いました。何と言いますか。」「友達の消しゴムを使いたいです。何と言いますか。」
- Baris 2-4 → tiga pilihan dibacakan tokoh dalam situasi (A: kalau perempuan, B: kalau laki-laki), 1 baris per opsi, diawali nomor: 「A: 1、消しゴム、借りてもいい？」
"question" = teks baris narator (situasi + 何と言いますか。).
Opsi (field "options", urutan SAMA dengan yang dibacakan): 3 ucapan Jepang pendek (3-8 kata) TANPA nomor di depannya, TEPAT 1 benar. Distraktor memakai kesalahan khas: arah memberi-menerima (あげます/くれます/もらいます), tingkat kesopanan salah, atau set phrase tertukar (いただきます vs ごちそうさま, 失礼します vs すみません).`,
  },
  sokuji: {
    number: 4,
    label: 'もんだい4 即時応答',
    instruction: 'もんだい4では、ぶんを きいて、1から3の なかから、いちばん いい へんじを ひとつ えらんで ください。',
    optionCount: 3,
    name: '即時応答 (respon cepat percakapan)',
    rules: `Struktur audioScript WAJIB (paling pendek, TANPA narator; di ujian asli ketiga balasan DIBACAKAN, jadi ikutkan di script):
- Baris 1 → A: [satu ucapan pendek] ATAU B: [satu ucapan pendek] (pertanyaan/permintaan/komentar 1 kalimat). Contoh pola: 「お国はどちらですか。」「この荷物、ちょっと持ってもらえない？」
- Baris 2-4 → tiga balasan dibacakan LAWAN bicara (gender berlawanan dari baris 1), 1 baris per opsi, diawali nomor: 「A: 1、うん、いいよ。」
"question" = teks tetap: いちばん いい へんじを えらんで ください。
Opsi (field "options", urutan SAMA dengan yang dibacakan): 3 balasan Jepang sangat pendek (2-6 kata) TANPA nomor di depannya, TEPAT 1 benar. Distraktor memakai: kata tanya tertukar (どちら = tempat vs pilihan), mengulang kata dari ucapan dengan makna salah, pasangan set phrase salah, atau bentuk waktu tidak nyambung.`,
  },
};

const JLPT_LISTENING_LEVELS = {
  N5: `Level N5: dialog 3-6 turn (di luar baris narator), total dialog ±80-120 karakter. SEMUA bentuk sopan です/ます. Kosakata dasar sehari-hari; angka/hari/jam diucapkan jelas. Tepat SATU "jebakan" revisi per dialog (mis. 「あ、やっぱり三つでいいです」). Setting: rumah, sekolah, toko, stasiun, restoran, rumah teman.`,
  N4: `Level N4: dialog 4-8 turn, total dialog ±120-200 karakter. Boleh satu pertukaran bentuk kasual antar teman; pegawai/staf boleh keigo ringan (いらっしゃいませ dsb). Boleh dua jebakan per dialog. Grammar boleh: 〜てもいい/〜てはいけない, 〜なければならない, kondisional と/ば/たら, あげる/くれる/もらう, bentuk potensial. Setting: + kantor, dokter, telepon, pengumuman stasiun.`,
};

// Prompt wrapper editable admin (app_settings.listening_gen_prompt).
// Placeholder per request: {{count}} {{level}} {{taskName}} {{taskRules}}
// {{levelRules}} {{topic}} {{vocab}} {{grammar}} {{avoid}}.
const LISTENING_GEN_PROMPT_DEFAULT = `Buatkan {{count}} soal LISTENING bahasa Jepang gaya ujian JLPT {{level}}, tipe {{taskName}}.

{{taskRules}}

{{levelRules}}

Format speaker audioScript (1 baris per turn, prefix + titik dua):
- "N: " = narator (membacakan situasi & pertanyaan)
- "A: " = pembicara perempuan
- "B: " = pembicara laki-laki

{{topic}}
Utamakan kosakata & pola grammar dari materi di bawah supaya siswa mengenalinya. Kata fungsi umum (partikel, salam, angka, kata tanya) boleh dari luar daftar, tapi JANGAN pakai kosakata konten yang jauh di atas level.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}
{{avoid}}
Aturan umum:
- Setiap soal harus berdiri sendiri dengan situasi/topik BERBEDA satu sama lain.
- TEPAT 1 opsi "isCorrect": true per soal. Distraktor sepadan (panjang/jenis mirip), masuk akal, dan disebut/terkait di dialog.
- "explanation": 1-2 kalimat Bahasa Indonesia — kutip frasa kunci dialog yang menentukan jawaban.
- audioScript maksimal 1200 karakter.

Balas HANYA JSON valid tanpa teks lain, bentuk:
{"questions":[{"question":"...","audioScript":"N: ...\\nB: ...\\nA: ...\\nN: ...","options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"explanation":"..."}]}`;

async function _loadListeningGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'listening_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : LISTENING_GEN_PROMPT_DEFAULT;
  } catch {
    return LISTENING_GEN_PROMPT_DEFAULT;
  }
}

router.get('/settings/listening-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'listening_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: LISTENING_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/listening-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('listening_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

router.post('/lessons/:lessonId/generate-listening', quizGenLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const task = JLPT_LISTENING_TASKS[String(req.body?.taskType || '')];
  if (!task) return res.status(400).json({ error: 'bad_task', detail: 'taskType harus kadai/point/hatsuwa/sokuji.' });
  const level = JLPT_LISTENING_LEVELS[req.body?.level] ? String(req.body.level) : 'N5';
  const count = Math.min(8, Math.max(1, Number(req.body?.count) || 3));
  const topic = String(req.body?.topic || '').slice(0, 300).trim();
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const lessonRes = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });

  // Grounding vocab + grammar modul — query sama dgn generate-quiz.
  let vocabRes = await query(
    `SELECT DISTINCT v.japanese, v.reading, v.indonesian, v.category
     FROM module_vocabulary v
     JOIN lesson_deck_items di ON di.vocabulary_id = v.id
     JOIN lessons l ON l.id = di.lesson_id
     WHERE l.module_id = $1 AND l.type = 'deck' AND v.japanese IS NOT NULL AND v.japanese <> ''
     LIMIT 80`,
    [lesson.module_id]
  );
  if (vocabRes.rows.length < 4) {
    vocabRes = await query(
      `SELECT japanese, reading, indonesian, category
       FROM module_vocabulary
       WHERE module_id = $1 AND japanese IS NOT NULL AND japanese <> ''
       LIMIT 80`,
      [lesson.module_id]
    );
  }
  const grammarRes = await query(
    `SELECT pattern, meaning, example FROM module_grammar
     WHERE module_id = $1 AND pattern IS NOT NULL AND pattern <> ''
     LIMIT 30`,
    [lesson.module_id]
  );

  // Anti-duplikat: kasih AI baris situasi soal listening yang sudah ada.
  const existingRes = await query(
    `SELECT audio_script, question FROM quiz_questions
     WHERE lesson_id = $1 AND question_category = 'listening'
     ORDER BY created_at DESC LIMIT 30`,
    [lessonId]
  );
  const avoidLines = existingRes.rows
    .map((r) => String(r.audio_script || r.question || '').split('\n')[0].trim())
    .filter(Boolean);

  const vocabLines = vocabRes.rows.map((v) =>
    `- ${v.japanese}${v.reading ? ` (${v.reading})` : ''} = ${v.indonesian || '?'}${v.category ? ` [${v.category}]` : ''}`).join('\n');
  const grammarLines = grammarRes.rows.map((g) =>
    `- ${g.pattern}${g.meaning ? ` = ${g.meaning}` : ''}${g.example ? `. Contoh: ${g.example}` : ''}`).join('\n');

  const promptTpl = await _loadListeningGenPrompt();
  const userContent = _fillTemplate(promptTpl, {
    count,
    level,
    taskName: task.name,
    taskRules: task.rules,
    levelRules: JLPT_LISTENING_LEVELS[level],
    topic: topic ? `Topik/instruksi tambahan dari admin: ${topic}\n` : '',
    vocab: vocabLines || '(tidak ada — pakai kosakata standar level ini)',
    grammar: grammarLines || '(tidak ada — pakai grammar standar level ini)',
    avoid: avoidLines.length
      ? `\nSoal listening yang SUDAH ADA di kuis ini (jangan bikin situasi/pertanyaan serupa):\n${avoidLines.map((s) => `- ${s.slice(0, 120)}`).join('\n')}\n`
      : '',
  });

  const text = await callClaude({ system: QUIZ_GEN_SYSTEM, userContent, maxTokens: 4096 });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.questions)) return res.status(502).json({ error: 'ai_parse' });

  const clean = [];
  for (const q of parsed.questions) {
    if (!q || typeof q !== 'object') continue;
    const question = String(q.question || '').trim().slice(0, 1000);
    // Batas 1400 < MAX_TEXT_LEN tts publik (1500) supaya audio pasti bisa
    // di-generate untuk siswa.
    const audioScript = String(q.audioScript || '').trim().slice(0, 1400);
    if (!question || !audioScript) continue;
    // Script harus dialog valid yang dikenali parser TTS (prefix speaker).
    if (!parseDialog(audioScript)) continue;
    let options = Array.isArray(q.options)
      ? q.options.map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect })).filter((o) => o.text)
      : [];
    if (options.length < 2) continue;
    options = options.slice(0, task.optionCount);
    let firstCorrect = options.findIndex((o) => o.isCorrect);
    if (firstCorrect === -1) firstCorrect = 0;
    options = options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
    const explanation = String(q.explanation || '').trim().slice(0, 1000);
    clean.push({ question, audioScript, options, explanation });
    if (clean.length >= count) break;
  }
  if (clean.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan soal valid. Coba lagi.' });

  res.json({
    questions: clean,
    section: { number: task.number, label: task.label, instruction: task.instruction },
    vocabPool: vocabRes.rows.length,
    grammarPool: grammarRes.rows.length,
  });
}));

// Generate contoh kalimat (AI) untuk satu kosakata deck — dipakai tombol
// "Generate contoh (AI)" di modal Kelola Deck → Contoh. Grounded ke kata di
// module_vocabulary. Mengembalikan daftar { japanese, highlight, indonesian }
// untuk di-review admin sebelum disimpan ke vocabulary_examples.
router.post('/generate-vocab-examples', asyncHandler(async (req, res) => {
  const { vocabularyId } = req.body || {};
  const count = Math.max(1, Math.min(5, Number((req.body || {}).count) || 3));
  const avoidRaw = Array.isArray((req.body || {}).avoid) ? (req.body || {}).avoid : [];
  const avoid = avoidRaw
    .map((s) => String(s || '').trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 20);
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const v = await query(`SELECT japanese, reading, indonesian FROM module_vocabulary WHERE id = $1`, [vocabularyId]);
  if (v.rows.length === 0) return res.status(404).json({ error: 'vocab not found' });
  const word = v.rows[0];

  const avoidBlock = avoid.length > 0
    ? `\nSudah ada contoh berikut — buat yang BERBEDA dan variasikan situasi/pelaku/waktu, jangan mirip:\n${avoid.map((s) => `- ${s}`).join('\n')}\n`
    : '';

  const userContent = `Buat ${count} contoh kalimat bahasa Jepang gaya JLPT N5/N4 yang memakai kata berikut.
Kata: ${word.japanese}${word.reading ? ` (${word.reading})` : ''}${word.indonesian ? ` = ${word.indonesian}` : ''}
${avoidBlock}
Aturan:
- Tiap kalimat pendek, natural, level pemula, dan BENAR-BENAR memakai kata "${word.japanese}".
- "highlight" = potongan persis yang muncul di kalimat untuk kata itu (biasanya "${word.japanese}" atau bentuk yang dipakai di kalimat).
- "indonesian" = terjemahan kalimat ke Bahasa Indonesia.
- Kalimat polos, tanpa tag HTML / tanpa furigana.

Balas HANYA JSON valid tanpa teks lain:
{"examples":[{"japanese":"…","highlight":"${word.japanese}","indonesian":"…"}]}`;

  const text = await callClaude({
    system: 'You write Japanese example sentences for Indonesian beginner learners. Reply with a single valid JSON object only.',
    userContent,
    maxTokens: 800,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.examples)) return res.status(502).json({ error: 'ai_parse' });

  const examples = parsed.examples
    .map((e) => ({
      japanese: String(e?.japanese || '').trim().slice(0, 300),
      highlight: (String(e?.highlight || '').trim().slice(0, 100)) || null,
      indonesian: (String(e?.indonesian || '').trim().slice(0, 300)) || null,
    }))
    .filter((e) => e.japanese)
    .slice(0, count);
  if (examples.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan contoh valid. Coba lagi.' });
  res.json({ examples });
}));

// Generate gambar ilustrasi (AI) untuk kosakata deck — tombol "Gambar (AI)"
// di Kelola Deck. Provider default: OpenAI gpt-image-1 (quality=low,
// ~$0.011/gambar). Bytes disimpan di vocab_image_cache (BYTEA), 1 gambar
// per kosakata; klik ulang dgn force=true untuk regenerate. Public serve
// lewat GET /api/vocab-image?vocabularyId=... (routes/vocab-image.js).
// OPENAI_API_KEY opsional (bukan REQUIRED_ENV); kosong → 503.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

router.post('/generate-vocab-image', asyncHandler(async (req, res) => {
  const { vocabularyId, force } = req.body || {};
  if (!vocabularyId) return res.status(400).json({ error: 'vocabularyId required' });
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'image_disabled', detail: 'OPENAI_API_KEY belum diset.' });

  const v = await query(`SELECT japanese, reading, indonesian, category FROM module_vocabulary WHERE id = $1`, [vocabularyId]);
  if (v.rows.length === 0) return res.status(404).json({ error: 'vocab not found' });
  const word = v.rows[0];

  if (!force) {
    const hit = await query(`SELECT 1 FROM vocab_image_cache WHERE vocabulary_id = $1`, [vocabularyId]);
    if (hit.rows.length > 0) {
      query(`UPDATE vocab_image_cache SET last_used_at = NOW() WHERE vocabulary_id = $1`, [vocabularyId]).catch(() => {});
      return res.json({ ok: true, cached: true });
    }
  }

  const concept = word.indonesian || word.japanese;
  const prompt = `Simple flat illustration showing the concept of "${concept}" (Japanese: ${word.japanese}${word.reading ? `, ${word.reading}` : ''}). Minimalist textbook-style art for a vocabulary card. No text or letters in the image. Clean white background. Friendly, clear, instantly recognizable.`;

  let bytes;
  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        n: 1,
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('OpenAI image:', upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'image_upstream', detail: detail.slice(0, 200) });
    }
    const data = await upstream.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: 'image_empty' });
    bytes = Buffer.from(b64, 'base64');
  } catch (err) {
    console.error('OpenAI image error:', err.message);
    return res.status(502).json({ error: 'image_upstream' });
  }

  await query(
    `INSERT INTO vocab_image_cache (vocabulary_id, image_bytes, mime, model, prompt, last_used_at)
     VALUES ($1, $2, 'image/png', $3, $4, NOW())
     ON CONFLICT (vocabulary_id) DO UPDATE
       SET image_bytes = EXCLUDED.image_bytes, mime = EXCLUDED.mime,
           model = EXCLUDED.model, prompt = EXCLUDED.prompt,
           created_at = NOW(), last_used_at = NOW()`,
    [vocabularyId, bytes, OPENAI_IMAGE_MODEL, prompt]
  );
  res.json({ ok: true, cached: false, sizeBytes: bytes.length });
}));

// Generate MULTI contoh kalimat (AI) untuk pola grammar — tombol "Contoh (AI)"
// di modal Kelola Contoh Grammar. Output: array { japanese, highlight,
// indonesian } siap dimasukkan ke grammar_examples. Pola sama persis dgn
// generate-vocab-examples (avoid list, count, dgn terjemahan).
router.post('/generate-grammar-examples', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const pattern = String(body.pattern || '').trim().slice(0, 200);
  const meaning = String(body.meaning || '').trim().slice(0, 500);
  const count = Math.max(1, Math.min(5, Number(body.count) || 3));
  const avoidRaw = Array.isArray(body.avoid) ? body.avoid : [];
  const avoid = avoidRaw.map((s) => String(s || '').trim().slice(0, 300)).filter(Boolean).slice(0, 20);
  if (!pattern) return res.status(400).json({ error: 'pattern required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const avoidBlock = avoid.length > 0
    ? `\nSudah ada contoh berikut — buat yang BERBEDA dan variasikan situasi/pelaku/waktu, jangan mirip:\n${avoid.map((s) => `- ${s}`).join('\n')}\n`
    : '';

  const userContent = `Buat ${count} contoh kalimat bahasa Jepang gaya JLPT N5/N4 yang memakai pola grammar berikut.

Pola: ${pattern}
${meaning ? `Arti/fungsi: ${meaning}\n` : ''}${avoidBlock}
Aturan:
- Tiap kalimat pendek, natural, level pemula, dan BENAR-BENAR memakai pola "${pattern}".
- "highlight" = potongan kalimat yang menunjukkan pemakaian pola (biasanya frasa pendek yg memuat pola).
- "indonesian" = terjemahan kalimat ke Bahasa Indonesia.
- Kalimat polos, tanpa tag HTML / tanpa furigana.

Balas HANYA JSON valid tanpa teks lain:
{"examples":[{"japanese":"…","highlight":"…","indonesian":"…"}]}`;

  const text = await callClaude({
    system: 'You write Japanese grammar example sentences for Indonesian beginner learners. Reply with a single valid JSON object only.',
    userContent,
    maxTokens: 900,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.examples)) return res.status(502).json({ error: 'ai_parse' });
  const examples = parsed.examples
    .map((e) => ({
      japanese: String(e?.japanese || '').trim().slice(0, 300),
      highlight: (String(e?.highlight || '').trim().slice(0, 100)) || null,
      indonesian: (String(e?.indonesian || '').trim().slice(0, 300)) || null,
    }))
    .filter((e) => e.japanese)
    .slice(0, count);
  if (examples.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan contoh valid. Coba lagi.' });
  res.json({ examples });
}));

// Translate dialog 3-suara (AI) ke Bahasa Indonesia — output dgn struktur
// PARALEL (prefix N: / A: / B: per baris) supaya frontend bisa mencocokkan
// terjemahan tiap turn dgn turn dialog Jepangnya.
router.post('/generate-dialog-translation', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const dialog = String(body.dialog || '').trim().slice(0, 4000);
  if (!dialog) return res.status(400).json({ error: 'dialog required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const userContent = `Terjemahkan dialog Jepang berikut ke Bahasa Indonesia yang natural.

Dialog asli:
${dialog}

WAJIB: pertahankan struktur baris persis seperti aslinya — tiap baris diawali prefix yang sama (N:, A:, B:, dst). Jumlah baris harus sama dgn dialog asli. Terjemahkan tiap baris menjadi 1 baris Indonesia (tanpa pecah jadi 2 baris).

Aturan terjemahan:
- Pakai Bahasa Indonesia santai-natural sesuai konteks (bukan kaku formal kecuali konteksnya formal).
- Pertahankan nama tokoh (mis. 田中さん → Pak Tanaka / Tanaka-san — konsisten saja).
- Tidak ada tag HTML, tidak ada catatan tambahan.

Balas HANYA JSON valid tanpa teks lain:
{"dialog_id":"N: …\\nA: …\\nB: …\\nA: …"}`;

  const text = await callClaude({
    system: 'You translate Japanese dialog into natural Indonesian, preserving the speaker-prefix line structure exactly. Reply with a single valid JSON object only.',
    userContent,
    maxTokens: 800,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  const translation = String(parsed?.dialog_id || '').trim().slice(0, 4000);
  if (!translation) return res.status(502).json({ error: 'ai_empty' });
  res.json({ dialog_id: translation });
}));

// Generate contoh kalimat (AI) untuk pola grammar — tombol "Contoh (AI)" di
// editor grammar admin. Admin tulis pattern + meaning, AI bikin 1 kalimat
// pendek yang memakai pola itu (level pemula).
router.post('/generate-grammar-example', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const pattern = String(body.pattern || '').trim().slice(0, 200);
  const meaning = String(body.meaning || '').trim().slice(0, 500);
  if (!pattern) return res.status(400).json({ error: 'pattern required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const userContent = `Buat SATU contoh kalimat bahasa Jepang yang BENAR-BENAR memakai pola grammar berikut, untuk pembelajar JLPT N5/N4.

Pola: ${pattern}
${meaning ? `Arti/fungsi: ${meaning}\n` : ''}
Aturan:
- Kalimat pendek (5-15 kata), natural, level pemula.
- Tulis polos tanpa tag HTML, tanpa furigana.
- Kalimat harus jelas menggunakan pola di atas — bukan parafrase.

Balas HANYA JSON valid:
{"example":"…"}`;

  const text = await callClaude({
    system: 'You write Japanese example sentences for Indonesian beginner learners. Reply with a single valid JSON object only.',
    userContent,
    maxTokens: 200,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  const example = String(parsed?.example || '').trim().slice(0, 300);
  if (!example) return res.status(502).json({ error: 'ai_empty' });
  res.json({ example });
}));

// Generate dialog 3-suara (AI) untuk pola grammar — tombol "Dialog (AI)" di
// editor grammar admin. Output langsung kompatibel dengan player karaoke
// (format JLPT: N/A/B per baris). N = narrator, A = cewe, B = cowo.
router.post('/generate-grammar-dialog', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const pattern = String(body.pattern || '').trim().slice(0, 200);
  const meaning = String(body.meaning || '').trim().slice(0, 500);
  const example = String(body.example || '').trim().slice(0, 300);
  if (!pattern) return res.status(400).json({ error: 'pattern required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const userContent = `Buat dialog pendek bahasa Jepang gaya JLPT (level N5/N4) yang menampilkan pemakaian pola grammar berikut secara natural.

Pola: ${pattern}
${meaning ? `Arti/fungsi: ${meaning}\n` : ''}${example ? `Contoh kalimat: ${example}\n` : ''}
FORMAT WAJIB (tepat seperti ini, 1 baris per turn, prefix speaker + ":"):
N: kalimat narator yang mengenalkan situasi (1 baris).
A: ujaran perempuan…
B: ujaran lelaki…
A: …
B: …

Aturan:
- Hanya 3 peran: N (narrator), A (perempuan), B (lelaki). DILARANG peran lain.
- 4-6 turn dialog (di luar baris narator).
- Pola "${pattern}" muncul minimal 1x di dialog (idealnya dipakai A atau B, bukan narator).
- Tulis polos, tanpa tag HTML, tanpa furigana, tanpa romaji.

NAMA TOKOH (wajib — biar UI siswa bisa render nama, bukan kode A/B):
- Beri 2 tokoh nama keluarga Jepang umum berbeda (mis. 田中, 山田, 鈴木, 佐藤, 高橋, 中村, 小林, 加藤). Pakai KANJI, bukan hiragana.
- Baris N (narrator) WAJIB menyebut KEDUA nama dgn suffix さん di baris pertama (urutan = urutan bicara: nama pertama yang disebut = A, kedua = B). Contoh: "田中さんと山田さんが話しています。"
- Dialog A/B sendiri TIDAK harus saling menyebut nama — biarkan natural seperti percakapan Jepang biasa. Pemanggilan nama hanya kalau memang pas konteks (mis. pertama kali bicara, ingin menonjolkan lawan bicara), JANGAN dipaksakan tiap turn.

ATURAN KANJI (penting untuk TTS):
- **HINDARI kanji yang punya banyak cara baca / ambigu** — output ini akan dibacakan oleh TTS (ElevenLabs). Kalau ada keraguan, TULIS DALAM HIRAGANA, bukan kanji.
- Daftar kanji yang HARUS ditulis hiragana karena ambigu/sering salah baca TTS: 一人 (ひとり), 二人 (ふたり), 今日 (きょう), 昨日 (きのう), 明日 (あした), 一日 (いちにち), 上手 (じょうず), 下手 (へた), 大人 (おとな), 子供 (こども), 何 (なに), 人 (ひと), 大きい (おおきい), 小さい (ちいさい), 行く (いく), 来る (くる), 入る (はいる), 出る (でる).
- Kalau ragu apakah kanji punya bacaan tunggal yang jelas, **TULIS DI HIRAGANA**. Lebih aman daripada salah dibaca TTS.
- Boleh tetap pakai kanji untuk kata yang bacanya tunggal & umum (mis. 私, 学生, 先生, 仕事, 学校, 本, 山, 川, 日本, 中国).

Balas HANYA JSON valid:
{"dialog":"N: …\\nA: …\\nB: …\\nA: …\\nB: …"}`;

  const text = await callClaude({
    system: 'You write short Japanese dialogues in JLPT 3-role format (N/A/B) for Indonesian beginner learners. Reply with a single valid JSON object only.',
    userContent,
    maxTokens: 600,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  const dialog = String(parsed?.dialog || '').trim().slice(0, 2000);
  if (!dialog) return res.status(502).json({ error: 'ai_empty' });
  res.json({ dialog });
}));

router.post('/module-grammar', asyncHandler(async (req, res) => {
  const { moduleId, lessonId, pattern, meaning, example, notes, exampleDialog, exampleDialogId, sortOrder } = req.body || {};
  if (!moduleId || !pattern) return res.status(400).json({ error: 'moduleId and pattern required' });
  const result = await query(
    `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, example_dialog, example_dialog_id, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [moduleId, lessonId || null, pattern, meaning || null, example || null, notes || null, exampleDialog || null, exampleDialogId || null, sortOrder || 0]
  );
  res.status(201).json({ grammar: result.rows[0] });
}));

router.put('/module-grammar/:id', asyncHandler(async (req, res) => {
  const { lessonId, pattern, meaning, example, notes, exampleDialog, exampleDialogId, sortOrder } = req.body || {};
  const hasLesson = Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonId');
  const hasDialogId = Object.prototype.hasOwnProperty.call(req.body || {}, 'exampleDialogId');
  const result = await query(
    `UPDATE module_grammar SET
       lesson_id = CASE WHEN $9::boolean THEN $2 ELSE lesson_id END,
       pattern = COALESCE($3, pattern),
       meaning = COALESCE($4, meaning),
       example = COALESCE($5, example),
       notes = COALESCE($6, notes),
       example_dialog = COALESCE($7, example_dialog),
       sort_order = COALESCE($8, sort_order),
       example_dialog_id = CASE WHEN $11::boolean THEN $10 ELSE example_dialog_id END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, lessonId || null, pattern, meaning, example, notes, exampleDialog, sortOrder, hasLesson, exampleDialogId || null, hasDialogId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ grammar: result.rows[0] });
}));

// === grammar_examples CRUD (mirror vocabulary-examples) ===
router.get('/grammar-examples', asyncHandler(async (req, res) => {
  const { grammarId } = req.query;
  if (!grammarId) return res.status(400).json({ error: 'grammarId required' });
  const rows = await query(
    `SELECT * FROM grammar_examples WHERE grammar_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [grammarId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/grammar-examples', asyncHandler(async (req, res) => {
  const { grammarId, japanese, highlight, indonesian, sortOrder } = req.body || {};
  if (!grammarId || !japanese) return res.status(400).json({ error: 'grammarId and japanese required' });
  const r = await query(
    `INSERT INTO grammar_examples (grammar_id, japanese, highlight, indonesian, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [grammarId, japanese, highlight || null, indonesian || null, sortOrder || 0]
  );
  res.status(201).json({ example: r.rows[0] });
}));

router.put('/grammar-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, highlight, indonesian, sortOrder } = req.body || {};
  const hasHighlight = Object.prototype.hasOwnProperty.call(req.body || {}, 'highlight');
  const r = await query(
    `UPDATE grammar_examples SET
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

router.delete('/grammar-examples/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM grammar_examples WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
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
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
  } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  const result = await query(
    `INSERT INTO lessons (
       module_id, slug, title, type, content, video_url, duration_minutes, sort_order,
       passing_score_pct, questions_per_attempt, cooldown_hours, popup_after_lesson_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      moduleId, slug, title, type || 'text',
      content || null, videoUrl || null, durationMinutes || null, sortOrder || 0,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : 70,
      questionsPerAttempt != null && questionsPerAttempt !== '' ? Number(questionsPerAttempt) : null,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : 12,
      popupAfterLessonId || null,
    ]
  );
  res.status(201).json({ lesson: result.rows[0] });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, type, content, videoUrl, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const hasQPA = Object.prototype.hasOwnProperty.call(req.body || {}, 'questionsPerAttempt');
  const hasPopup = Object.prototype.hasOwnProperty.call(req.body || {}, 'popupAfterLessonId');

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
      } else if (oldType === 'grammar_task') {
        await query(`DELETE FROM lesson_grammar_task_items WHERE lesson_id = $1`, [req.params.id]);
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
       cooldown_hours = COALESCE($12, cooldown_hours),
       popup_after_lesson_id = CASE WHEN $14::boolean THEN $13 ELSE popup_after_lesson_id END
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, type, content, videoUrl, durationMinutes, sortOrder,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : null,
      hasQPA && questionsPerAttempt !== '' && questionsPerAttempt != null ? Number(questionsPerAttempt) : null,
      hasQPA,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : null,
      hasPopup && popupAfterLessonId ? popupAfterLessonId : null,
      hasPopup,
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

// ===== AKSES DASHBOARD (enrollment grants) =====
// Beri akses kursus tanpa lewat checkout: insert/hapus baris user_enrollments.
// Sama persis dengan yang dilakukan POST /api/enrollments, tapi admin bisa
// pilih user mana (by email). user_enrollments = single source of truth akses.

// GET /api/admin/user-access?email= — cari user + daftar kursus yang sudah di-enroll
router.get('/user-access', asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email_required' });

  const userRow = await query(
    `SELECT id, email, full_name, created_at FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const enrolled = await query(
    `SELECT c.id AS course_id, c.slug, c.title, c.level, e.enrolled_at
       FROM user_enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC`,
    [user.id]
  );
  const courses = await query(
    `SELECT id, slug, title, level, is_published, is_available
       FROM courses WHERE is_published = TRUE
      ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ user, enrollments: enrolled.rows, courses: courses.rows });
}));

// POST /api/admin/user-access/grant — { email, courseSlug } → enroll user ke kursus
router.post('/user-access/grant', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseSlug = String(req.body?.courseSlug || '').trim();
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (!courseSlug) return res.status(400).json({ error: 'course_required' });

  const userRow = await query(
    `SELECT id, email, full_name FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const courseRow = await query(
    `SELECT id, slug, title, is_published FROM courses WHERE slug = $1 LIMIT 1`,
    [courseSlug]
  );
  const course = courseRow.rows[0];
  if (!course) return res.status(404).json({ error: 'course_not_found' });
  if (!course.is_published) return res.status(400).json({ error: 'course_not_published' });

  const ins = await query(
    `INSERT INTO user_enrollments (user_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, course_id) DO NOTHING
     RETURNING id`,
    [user.id, course.id]
  );
  res.json({
    ok: true,
    alreadyEnrolled: ins.rows.length === 0,
    user: { email: user.email, full_name: user.full_name },
    course: { slug: course.slug, title: course.title },
  });
}));

// POST /api/admin/user-access/revoke — { email, courseId } → hapus enrollment
router.post('/user-access/revoke', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseId = String(req.body?.courseId || '');
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (!courseId) return res.status(400).json({ error: 'course_required' });

  const userRow = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const del = await query(
    `DELETE FROM user_enrollments WHERE user_id = $1 AND course_id = $2 RETURNING id`,
    [user.id, courseId]
  );
  if (del.rows.length === 0) return res.status(404).json({ error: 'enrollment_not_found' });
  res.json({ ok: true });
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

// ===== TTS ADMIN: test audio + cache management =====
//
// Endpoint admin-only buat dev workflow: preview audio sebelum save,
// hapus cache kalau hasil ga cocok, stats cache.
// Skip whitelist check (admin bisa test text apapun, bukan cuma yang
// udah saved di DB).

// POST /api/admin/tts/preview — body { text }, return MP3 stream.
router.post('/tts/preview', asyncHandler(async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 2000) return res.status(400).json({ error: 'text too long (max 2000 char)' });

  // Detect dialog. Single-voice fallback.
  const turns = parseDialog(text);
  const isDialog = !!turns;
  const turnVoices = isDialog
    ? turns.map((t, i) => voiceForSpeaker(t.speaker, i))
    : [{ voiceId: TTS_ELEVEN_VOICE_ID, role: 'single' }];
  const voices = turnVoices.map((v) => v.voiceId);

  // Cek cache dulu — kalau hit, gak kena cost ElevenLabs.
  const key = ttsHashKey(text, voices);
  const cached = await query(
    `SELECT audio, content_type FROM tts_cache WHERE text_hash = $1`,
    [key]
  );
  if (cached.rows.length > 0) {
    query(`UPDATE tts_cache SET last_used_at = NOW() WHERE text_hash = $1`, [key]).catch(() => {});
    res.set('Content-Type', cached.rows[0].content_type || 'audio/mpeg');
    res.set('Cache-Control', 'private, no-cache'); // admin preview, ga perlu CDN cache
    return res.send(cached.rows[0].audio);
  }

  // Generate baru.
  let combined;
  try {
    if (isDialog) {
      const buffers = [];
      for (let i = 0; i < turns.length; i++) {
        const isLast = i === turns.length - 1;
        const textWithBreak = isLast ? turns[i].text : `${turns[i].text} <break time="700ms" />`;
        buffers.push(await fetchElevenAudio(turnVoices[i].voiceId, textWithBreak, turnVoices[i].role));
      }
      combined = Buffer.concat(buffers);
    } else {
      combined = await fetchElevenAudio(TTS_ELEVEN_VOICE_ID, text, 'single');
    }
  } catch (err) {
    console.error('TTS admin preview:', err.message);
    return res.status(502).json({ error: 'tts_upstream', detail: err.message });
  }

  await query(
    `INSERT INTO tts_cache (text_hash, text, provider, voice, model, audio, content_type, byte_size, settings_version)
     VALUES ($1,$2,'elevenlabs',$3,$4,$5,'audio/mpeg',$6,$7)
     ON CONFLICT (text_hash) DO NOTHING`,
    [key, text, voices.join(','), TTS_ELEVEN_MODEL, combined, combined.length, TTS_SETTINGS_VERSION]
  );
  res.set('Content-Type', 'audio/mpeg');
  res.set('Cache-Control', 'private, no-cache');
  res.send(combined);
}));

// DELETE /api/admin/tts/cache — body { text } → cari cache entry yang
// match text hash (semua variasi voice), hapus. Berguna kalau admin
// tweak voice settings lalu mau force regen tertentu.
router.delete('/tts/cache', asyncHandler(async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  // Hapus by exact text match — coverage semua voice/model variasi.
  const r = await query(`DELETE FROM tts_cache WHERE text = $1`, [text]);
  res.json({ ok: true, deleted: r.rowCount });
}));

// GET /api/admin/tts/cache/stats — count + total size + breakdown
// current version vs orphan (version mismatch / NULL).
router.get('/tts/cache/stats', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(byte_size), 0)::bigint AS bytes,
            MAX(created_at) AS newest,
            MIN(created_at) AS oldest,
            COUNT(*) FILTER (WHERE settings_version = $1)::int AS current_count,
            COALESCE(SUM(byte_size) FILTER (WHERE settings_version = $1), 0)::bigint AS current_bytes,
            COUNT(*) FILTER (WHERE settings_version IS DISTINCT FROM $1)::int AS orphan_count,
            COALESCE(SUM(byte_size) FILTER (WHERE settings_version IS DISTINCT FROM $1), 0)::bigint AS orphan_bytes
       FROM tts_cache`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ...r.rows[0], current_version: TTS_SETTINGS_VERSION });
}));

// DELETE /api/admin/tts/cache/all — nuke all cache. Cost regenerate.
router.delete('/tts/cache/all', asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM tts_cache`);
  res.json({ ok: true, deleted: r.rowCount });
}));

// GET /api/admin/tts/cache/orphans — preview: count + bytes orphan
// (entries dgn settings_version != current atau NULL). Run sebelum
// DELETE supaya admin tau dampak.
router.get('/tts/cache/orphans', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(byte_size), 0)::bigint AS bytes
       FROM tts_cache
      WHERE settings_version IS DISTINCT FROM $1`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ...r.rows[0], current_version: TTS_SETTINGS_VERSION });
}));

// DELETE /api/admin/tts/cache/orphans — execute cleanup. Current version
// dibaca dari server const (bukan req body) → race-safe terhadap admin
// session lama yg hold version expired.
router.delete('/tts/cache/orphans', asyncHandler(async (req, res) => {
  const r = await query(
    `DELETE FROM tts_cache
      WHERE settings_version IS DISTINCT FROM $1`,
    [TTS_SETTINGS_VERSION]
  );
  res.json({ ok: true, deleted: r.rowCount, current_version: TTS_SETTINGS_VERSION });
}));

// ===== TTS TAG LIBRARY (shared antar admin device) =====
// Tag custom yang admin save buat dipake ulang via picker chip. Source
// of truth di DB (tts_tag_library), localStorage cuma cache + offline.

router.get('/tts/tags', asyncHandler(async (req, res) => {
  const r = await query(`SELECT tag FROM tts_tag_library ORDER BY created_at DESC`);
  res.json({ tags: r.rows.map((x) => x.tag) });
}));

router.post('/tts/tags', asyncHandler(async (req, res) => {
  const raw = String((req.body || {}).tag || '').trim().toLowerCase();
  // Normalize: huruf + angka + underscore, dimulai dengan huruf, max 24 char.
  const tag = raw.replace(/[^a-z0-9_]/g, '');
  if (!tag || !/^[a-z]/.test(tag) || tag.length > 24) {
    return res.status(400).json({ error: 'invalid_tag', detail: 'Tag harus mulai dgn huruf, hanya huruf/angka/underscore, max 24 char.' });
  }
  await query(
    `INSERT INTO tts_tag_library (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING`,
    [tag]
  );
  res.status(201).json({ ok: true, tag });
}));

router.delete('/tts/tags/:tag', asyncHandler(async (req, res) => {
  const tag = String(req.params.tag || '').toLowerCase();
  await query(`DELETE FROM tts_tag_library WHERE tag = $1`, [tag]);
  res.json({ ok: true });
}));

export default router;
