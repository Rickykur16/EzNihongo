import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';
import {
  isAdminEmail,
  isEnvAdminEmail,
  listEnvAdminEmails,
  invalidateAdminEmailCache,
} from '../auth.js';
import { COACH_PROMPT_DEFAULT } from './recommendations.js';
import { callClaude, anthropicEnabled, ANTHROPIC_GEN_MODEL } from '../anthropic.js';
import { controlledSlot, slotShaped } from '../grammar-drills.js';
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
import {
  loadCourseVocab,
  deriveCompounds,
  loadKanjiCatalog,
  invalidateCourseVocabCache,
  invalidateKanjiCatalogCache,
} from '../kanji-compounds.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

// ── YouTube video sources ────────────────────────────────────────────────
// Store an ID, never an embed URL. The same source can then be picked by many
// lessons, each with its own start/end range. This accepts the share, watch,
// embed, shorts, live, and youtu.be forms that creators commonly paste.
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function parseYouTubeSource(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (YOUTUBE_VIDEO_ID_RE.test(raw)) {
    return { externalId: raw, sourceUrl: `https://www.youtube.com/watch?v=${raw}` };
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  let externalId = '';

  if (host === 'youtu.be') {
    externalId = parts[0] || '';
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') ||
             host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    if (url.pathname === '/watch') externalId = url.searchParams.get('v') || '';
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) externalId = parts[1] || '';
  }

  if (!YOUTUBE_VIDEO_ID_RE.test(externalId)) return null;
  return {
    externalId,
    sourceUrl: `https://www.youtube.com/watch?v=${externalId}`,
  };
}

function normalizeSegment(sourceIdValue, startValue, endValue) {
  const sourceId = String(sourceIdValue || '').trim() || null;
  const hasStart = startValue !== undefined && startValue !== null && startValue !== '';
  const hasEnd = endValue !== undefined && endValue !== null && endValue !== '';
  if (!sourceId) {
    if (hasStart || hasEnd) return { error: 'Pilih sumber YouTube untuk memakai rentang waktu video.' };
    return { videoSourceId: null, videoStartSeconds: null, videoEndSeconds: null };
  }

  const start = hasStart ? Number(startValue) : 0;
  const end = hasEnd ? Number(endValue) : null;
  if (!Number.isInteger(start) || start < 0) {
    return { error: 'Waktu mulai video harus berupa detik bulat positif atau nol.' };
  }
  if (!Number.isInteger(end) || end <= start) {
    return { error: 'Waktu selesai video harus lebih besar dari waktu mulai.' };
  }
  return { videoSourceId: sourceId, videoStartSeconds: start, videoEndSeconds: end };
}

function supportsVideoSegment(type) {
  return type === 'video' || type === 'kana';
}

// GET /api/admin/video-sources — source picker for reusable YouTube videos.
router.get('/video-sources', asyncHandler(async (_req, res) => {
  const sources = await query(
    `SELECT vs.id, vs.provider, vs.external_id, vs.source_url, vs.title,
            vs.duration_seconds, vs.created_at, vs.updated_at,
            COUNT(l.id)::int AS lesson_count
       FROM video_sources vs
       LEFT JOIN lessons l ON l.video_source_id = vs.id
      GROUP BY vs.id
      ORDER BY vs.updated_at DESC, vs.created_at DESC`
  );
  res.json({ sources: sources.rows });
}));

// POST /api/admin/video-sources — creates (or reuses) a canonical YouTube
// source. No YouTube Data API key is needed just to embed a known video.
router.post('/video-sources', asyncHandler(async (req, res) => {
  const parsed = parseYouTubeSource(req.body?.youtubeUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'URL YouTube tidak valid. Tempel URL watch, share, embed, shorts, atau ID video.' });
  }
  const title = String(req.body?.title || '').trim().slice(0, 240) || null;
  const created = await query(
    `INSERT INTO video_sources (provider, external_id, source_url, title)
     VALUES ('youtube', $1, $2, $3)
     ON CONFLICT (provider, external_id) DO UPDATE
       SET source_url = EXCLUDED.source_url,
           title = COALESCE(EXCLUDED.title, video_sources.title),
           updated_at = NOW()
     RETURNING *`,
    [parsed.externalId, parsed.sourceUrl, title]
  );
  res.status(201).json({ source: created.rows[0], reused: created.rows[0].created_at !== created.rows[0].updated_at });
}));

// POST /api/admin/set-password — admin meng-set/ubah password (self-service).
// Tanpa `email` → set password milik admin yang sedang login. Dengan `email`
// (provisioning co-admin) → email itu WAJIB sudah admin (env ADMIN_EMAILS
// atau tabel admin_emails — tambah dulu via Kelola Admin). Ini hanya
// menambah cara login email+password, bukan pemberian akses.
router.post('/set-password', asyncHandler(async (req, res) => {
  const password = String(req.body?.password || '');
  const targetEmailRaw = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const email = targetEmailRaw || String(req.user.email || '').toLowerCase();

  if (password.length < 10) {
    return res.status(400).json({ error: 'weak_password', detail: 'Password minimal 10 karakter.' });
  }
  if (targetEmailRaw && !(await isAdminEmail(targetEmailRaw))) {
    return res.status(400).json({ error: 'not_admin_email', detail: 'Email itu bukan admin — tambahkan dulu lewat Kelola Admin.' });
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

// ── Kelola admin (tabel admin_emails, migration 035) ──────────────────────
// Admin env (ADMIN_EMAILS) read-only dari UI — bootstrap anti-lockout.
// Admin DB bisa ditambah/dihapus tanpa edit .env + restart.

// GET /api/admin/admins — gabungan env + DB
router.get('/admins', asyncHandler(async (req, res) => {
  const envSet = new Set(listEnvAdminEmails());
  const result = await query(
    'SELECT email, added_by, created_at FROM admin_emails ORDER BY created_at ASC'
  );
  const admins = [
    ...[...envSet].map((email) => ({ email, source: 'env' })),
    ...result.rows
      .filter((r) => !envSet.has(String(r.email).toLowerCase()))
      .map((r) => ({
        email: r.email,
        source: 'db',
        addedBy: r.added_by,
        createdAt: r.created_at,
      })),
  ];
  res.json({ admins });
}));

// POST /api/admin/admins — tambah admin baru { email }
router.post('/admins', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email', detail: 'Format email tidak valid.' });
  }
  if (isEnvAdminEmail(email)) {
    return res.json({ ok: true, email, source: 'env', detail: 'Email sudah admin (via .env).' });
  }
  await query(
    `INSERT INTO admin_emails (email, added_by) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, String(req.user.email || '').toLowerCase()]
  );
  invalidateAdminEmailCache();
  res.json({ ok: true, email, source: 'db' });
}));

// DELETE /api/admin/admins/:email — cabut akses admin DB
router.delete('/admins/:email', asyncHandler(async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (isEnvAdminEmail(email)) {
    return res.status(400).json({ error: 'env_admin', detail: 'Admin bootstrap (.env) tidak bisa dihapus dari sini.' });
  }
  if (email === String(req.user.email || '').toLowerCase()) {
    return res.status(400).json({ error: 'cannot_remove_self', detail: 'Tidak bisa menghapus akses sendiri.' });
  }
  await query('DELETE FROM admin_emails WHERE email = $1', [email]);
  invalidateAdminEmailCache();
  res.json({ ok: true });
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
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured, isFree,
  } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' });
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  // isFree is tri-state (true/false/null = "not yet classified") — pass
  // through as-is rather than coercing with !!, which would collapse
  // "unclassified" into "paid". See migration 121.
  const result = await query(
    `INSERT INTO courses
       (slug, title, description, level, thumbnail_url, sort_order, is_published, is_available,
        price_idr, price_label, period_label, tagline, features, cta_label, is_featured, is_free)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      slug, title, description || null, level || null, thumbnailUrl || null,
      sortOrder || 0, !!isPublished, isAvailable !== false,
      priceIdr || null, priceLabel || null, periodLabel || null, tagline || null,
      JSON.stringify(Array.isArray(features) ? features : []),
      ctaLabel || null, !!isFeatured,
      isFree === true ? true : (isFree === false ? false : null),
    ]
  );
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.status(201).json({ course: result.rows[0] });
}));

router.put('/courses/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
    priceIdr, priceLabel, periodLabel, tagline, features, ctaLabel, isFeatured, isFree,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  // isFree: only overwrite when the client explicitly sent true/false.
  // Omitted (undefined) keeps the existing value — it never collapses to
  // NULL/paid just because a caller didn't include the field.
  const isFreeExplicit = isFree === true || isFree === false;
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
       is_free = CASE WHEN $17 THEN $18::boolean ELSE is_free END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      req.params.id, slug, title, description, level, thumbnailUrl, sortOrder, isPublished, isAvailable,
      priceIdr, priceLabel, periodLabel, tagline,
      Array.isArray(features) ? JSON.stringify(features) : null,
      ctaLabel, isFeatured,
      isFreeExplicit, isFreeExplicit ? isFree : null,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
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
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
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
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
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
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
  res.json({ module: result.rows[0] });
}));

router.delete('/modules/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM modules WHERE id = $1`, [req.params.id]);
  invalidateCourseVocabCache();
  invalidateKanjiCatalogCache();
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
  invalidateCourseVocabCache();
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
  invalidateCourseVocabCache();
  res.json({ vocabulary: result.rows[0] });
}));

router.delete('/module-vocabulary/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM module_vocabulary WHERE id = $1`, [req.params.id]);
  invalidateCourseVocabCache();
  res.json({ ok: true });
}));

router.post('/module-vocabulary/bulk', asyncHandler(async (req, res) => {
  const { moduleId, items, replace } = req.body || {};
  if (!moduleId || !Array.isArray(items)) return res.status(400).json({ error: 'moduleId and items[] required' });
  // replace=true DELETEs the whole module first; without a transaction a crash
  // mid-insert leaves the module emptied or half-populated.
  const inserted = await withTransaction(async (client) => {
    if (replace) await client.query(`DELETE FROM module_vocabulary WHERE module_id = $1`, [moduleId]);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const v = items[i] || {};
      if (!v.japanese) continue;
      const r = await client.query(
        `INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [moduleId, v.lessonId || null, v.japanese, v.reading || null, v.romaji || null, v.indonesian || null,
         v.category || null, v.note || null, v.sortOrder ?? i]
      );
      out.push(r.rows[0]);
    }
    return out;
  });
  invalidateCourseVocabCache();
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
  const { vocabularyId, japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  if (!vocabularyId || !japanese) return res.status(400).json({ error: 'vocabularyId and japanese required' });
  const r = await query(
    `INSERT INTO vocabulary_examples (vocabulary_id, japanese, reading, highlight, indonesian, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [vocabularyId, japanese, reading || null, highlight || null, indonesian || null, sortOrder || 0]
  );
  invalidateCourseVocabCache();
  res.status(201).json({ example: r.rows[0] });
}));

router.put('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  const hasHighlight = Object.prototype.hasOwnProperty.call(req.body || {}, 'highlight');
  const hasReading = Object.prototype.hasOwnProperty.call(req.body || {}, 'reading');
  const r = await query(
    `UPDATE vocabulary_examples SET
       japanese = COALESCE($2, japanese),
       reading = CASE WHEN $7::boolean THEN $8 ELSE reading END,
       highlight = CASE WHEN $5::boolean THEN $3 ELSE highlight END,
       indonesian = COALESCE($4, indonesian),
       sort_order = COALESCE($6, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, highlight || null, indonesian, hasHighlight, sortOrder, hasReading, reading || null]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  invalidateCourseVocabCache();
  res.json({ example: r.rows[0] });
}));

router.delete('/vocabulary-examples/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM vocabulary_examples WHERE id = $1`, [req.params.id]);
  invalidateCourseVocabCache();
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
  // Whole reorder/upsert applied atomically — a partial failure must not leave
  // the deck with a mix of old and new sort orders.
  await withTransaction(async (client) => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.vocabularyId) continue;
      await client.query(
        `INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order, accent_color)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (lesson_id, vocabulary_id)
           DO UPDATE SET sort_order = EXCLUDED.sort_order, accent_color = EXCLUDED.accent_color`,
        [req.params.lessonId, it.vocabularyId, it.sortOrder ?? i, it.accentColor || null]
      );
    }
  });
  res.json({ ok: true });
}));

router.delete('/lessons/:lessonId/deck-items/:vocabularyId', asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM lesson_deck_items WHERE lesson_id = $1 AND vocabulary_id = $2`,
    [req.params.lessonId, req.params.vocabularyId]
  );
  res.json({ ok: true });
}));

// ===== KANA (hiragana/katakana) =====
// Source of truth = tabel kana_items (bank global). Admin "Kelola Kana"
// (mirror "Kelola Deck") memilih karakter ke pelajaran 'kana' via
// lesson_kana_items, edit mnemonic + contoh kata. Mirror pola deck/vocab.

const KANA_VARIANTS = ['base', 'dakuten', 'handakuten', 'youon', 'special'];

// Bank picker — semua karakter, searchable, optional filter kind.
router.get('/kana-bank', asyncHandler(async (req, res) => {
  const { kind, q } = req.query;
  const params = [];
  const where = [];
  if (kind === 'hiragana' || kind === 'katakana') {
    params.push(kind);
    where.push(`kind = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push('%' + String(q).trim() + '%');
    const p = `$${params.length}`;
    where.push(`(character ILIKE ${p} OR romaji ILIKE ${p} OR group_label ILIKE ${p})`);
  }
  const rows = await query(
    `SELECT k.id, k.character, k.kind, k.romaji, k.mnemonic, k.group_label, k.variant_type, k.sort_order,
            (SELECT COUNT(*)::int FROM kana_examples e WHERE e.kana_id = k.id) AS example_count
     FROM kana_items k
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY k.kind ASC, k.sort_order ASC LIMIT 400`,
    params
  );
  res.json({ kana: rows.rows });
}));

router.post('/kana', asyncHandler(async (req, res) => {
  const { character, kind, romaji, mnemonic, groupLabel, variantType, sortOrder } = req.body || {};
  const ch = String(character || '').trim();
  if (!ch) return res.status(400).json({ error: 'character required' });
  const kd = kind === 'katakana' ? 'katakana' : 'hiragana';
  const variant = KANA_VARIANTS.includes(variantType) ? variantType : 'base';
  const result = await query(
    `INSERT INTO kana_items (character, kind, romaji, mnemonic, group_label, variant_type, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (kind, character) DO UPDATE SET
       romaji = EXCLUDED.romaji, mnemonic = EXCLUDED.mnemonic,
       group_label = EXCLUDED.group_label, variant_type = EXCLUDED.variant_type,
       sort_order = EXCLUDED.sort_order, updated_at = NOW()
     RETURNING *`,
    [ch, kd, String(romaji || '').trim() || ch, (mnemonic && String(mnemonic).trim()) || null,
     (groupLabel && String(groupLabel).trim()) || null, variant, Number(sortOrder) || 0]
  );
  res.status(201).json({ kana: result.rows[0] });
}));

router.put('/kana/:id', asyncHandler(async (req, res) => {
  const { character, kind, romaji, mnemonic, groupLabel, variantType, sortOrder } = req.body || {};
  const kd = kind === 'hiragana' || kind === 'katakana' ? kind : null;
  const variant = variantType && KANA_VARIANTS.includes(variantType) ? variantType : null;
  const result = await query(
    `UPDATE kana_items SET
       character = COALESCE($2, character),
       kind = COALESCE($3, kind),
       romaji = COALESCE($4, romaji),
       mnemonic = $5,
       group_label = $6,
       variant_type = COALESCE($7, variant_type),
       sort_order = COALESCE($8, sort_order),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, character != null ? String(character).trim() : null, kd,
     romaji != null && String(romaji).trim() ? String(romaji).trim() : null,
     (mnemonic && String(mnemonic).trim()) || null,
     (groupLabel && String(groupLabel).trim()) || null,
     variant, sortOrder != null && sortOrder !== '' ? Number(sortOrder) : null]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ kana: result.rows[0] });
}));

router.delete('/kana/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM kana_items WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// Contoh kata per karakter (mirror vocabulary-examples).
router.get('/kana-examples', asyncHandler(async (req, res) => {
  const { kanaId } = req.query;
  if (!kanaId) return res.status(400).json({ error: 'kanaId required' });
  const rows = await query(
    `SELECT * FROM kana_examples WHERE kana_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [kanaId]
  );
  res.json({ examples: rows.rows });
}));

router.post('/kana-examples', asyncHandler(async (req, res) => {
  const { kanaId, japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  if (!kanaId || !japanese) return res.status(400).json({ error: 'kanaId and japanese required' });
  const r = await query(
    `INSERT INTO kana_examples (kana_id, japanese, reading, highlight, indonesian, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [kanaId, japanese, reading || null, highlight || null, indonesian || null, sortOrder || 0]
  );
  res.status(201).json({ example: r.rows[0] });
}));

router.put('/kana-examples/:id', asyncHandler(async (req, res) => {
  const { japanese, reading, highlight, indonesian, sortOrder } = req.body || {};
  const r = await query(
    `UPDATE kana_examples SET
       japanese = COALESCE($2, japanese),
       reading = $3, highlight = $4, indonesian = $5,
       sort_order = COALESCE($6, sort_order), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, japanese, reading || null, highlight || null, indonesian || null, sortOrder]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ example: r.rows[0] });
}));

router.delete('/kana-examples/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM kana_examples WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// Karakter dipilih ke pelajaran 'kana' (mirror deck-items).
router.get('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT lki.lesson_id, lki.kana_id, lki.sort_order,
            k.character, k.kind, k.romaji, k.mnemonic, k.group_label, k.variant_type,
            (SELECT COUNT(*)::int FROM kana_examples e WHERE e.kana_id = k.id) AS example_count
     FROM lesson_kana_items lki JOIN kana_items k ON k.id = lki.kana_id
     WHERE lki.lesson_id = $1
     ORDER BY lki.sort_order ASC, k.sort_order ASC`,
    [req.params.lessonId]
  );
  res.json({ items: rows.rows });
}));

router.post('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const { kanaId, sortOrder } = req.body || {};
  if (!kanaId) return res.status(400).json({ error: 'kanaId required' });
  const r = await query(
    `INSERT INTO lesson_kana_items (lesson_id, kana_id, sort_order)
     VALUES ($1,$2,$3)
     ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
     RETURNING *`,
    [req.params.lessonId, kanaId, sortOrder ?? 0]
  );
  res.status(201).json({ item: r.rows[0] });
}));

router.put('/lessons/:lessonId/kana-items', asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required' });
  // Whole reorder/upsert applied atomically.
  await withTransaction(async (client) => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.kanaId) continue;
      await client.query(
        `INSERT INTO lesson_kana_items (lesson_id, kana_id, sort_order)
         VALUES ($1,$2,$3)
         ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [req.params.lessonId, it.kanaId, it.sortOrder ?? i]
      );
    }
  });
  res.json({ ok: true });
}));

router.delete('/lessons/:lessonId/kana-items/:kanaId', asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM lesson_kana_items WHERE lesson_id = $1 AND kana_id = $2`,
    [req.params.lessonId, req.params.kanaId]
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
  // Whole task-item set applied atomically.
  await withTransaction(async (client) => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!it.grammarId) continue;
      const reqCount = Math.min(10, Math.max(1, Number(it.requiredCount) || 1));
      await client.query(
        `INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (lesson_id, grammar_id)
           DO UPDATE SET sort_order = EXCLUDED.sort_order,
                         instruction = EXCLUDED.instruction,
                         required_count = EXCLUDED.required_count`,
        [req.params.lessonId, it.grammarId, it.sortOrder ?? i, (it.instruction || '').trim() || null, reqCount]
      );
    }
  });
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
  invalidateCourseVocabCache();
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

// Notion menamai child page "Pelajaran 1: Pengantar", "Pelajaran 2: Kosakata",
// dst. Nomornya redundan dengan nomor urut yang sudah dirender sendiri oleh
// sidebar welcome.html, dan artinya beda (posisi dalam modul vs nomor global),
// jadi di layar jadi "87. Pelajaran 1: Pengantar". Strip prefix-nya lalu
// samakan varian generik ke bentuk kanonik — sejajar dengan migration 080 yang
// merapikan baris yang sudah terlanjur masuk DB. Judul spesifik (mis. "Kalimat
// Identitas (です…)") dikembalikan apa adanya setelah prefix di-strip.
function canonicalPelajaranTitle(title) {
  const t = String(title || '').replace(/^\s*pelajaran\s*\d+\s*[:\-–—]\s*/i, '').trim();
  if (/^(introduction|intro|pengantar)$/i.test(t)) return 'Pengantar';
  if (/^(kosakata|vocabulary|vocab)(\s*語彙)?$/i.test(t)) return 'Kosakata 語彙';
  if (/^kanji(\s*漢字)?$/i.test(t)) return 'Kanji 漢字';
  return t;
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
    const title = canonicalPelajaranTitle(notionPlainText(titleProp)) || '(tanpa judul)';
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

// ===== PENGECOH STEP 1 TUGAS BUNPOU (migration 124) =====
// Soal Step 1 menanyakan "Apa fungsi <pola>?". Tanpa pengecoh kurasi, pengecoh
// diturunkan dari arti pola LAIN di bab yang sama — terlalu mudah, karena bisa
// dieliminasi cuma dengan menyadari "ini bukan soal も". Endpoint ini membuat
// pengecoh yang menguji betulan: fungsi yang SALAH untuk pola itu sendiri.
//
// Di-generate SEKALI per pola oleh admin lalu disimpan. Siswa tidak pernah
// memicu panggilan AI untuk soal pilihan ganda — lihat prinsip "jangan
// overuse AI" di CLAUDE.md.
const DISTRACTOR_SYSTEM = `You write multiple-choice distractors for a Japanese-grammar course taught in Indonesian to JLPT N5/N4 beginners. Reply with plain lines only — no numbering, no bullets, no extra prose.`;

// Satu pola → daftar pengecoh (atau null kalau gagal). Dipakai endpoint
// tunggal (draft untuk di-review admin) DAN endpoint massal (auto-simpan).
async function generateDistractorsFor(item) {
  // Fungsi pola LAIN di bab yang sama dikirim sebagai daftar-hindari: kalau
  // pengecoh kebetulan mendeskripsikan pola lain, soalnya jadi ambigu untuk
  // siswa yang tahu pola itu.
  const sib = await query(
    `SELECT pattern, meaning FROM module_grammar
      WHERE module_id = $1 AND id <> $2 AND meaning IS NOT NULL AND TRIM(meaning) <> ''
      ORDER BY sort_order ASC LIMIT 12`,
    [item.module_id, item.id]
  );
  const avoid = sib.rows.map((r) => `- ${r.pattern}: ${r.meaning}`).join('\n') || '(tidak ada)';

  const userContent = `Pola grammar target: ${item.pattern}
Fungsi yang BENAR dari pola ini: ${item.meaning}

Fungsi pola lain di bab yang sama (JANGAN tulis ulang salah satu dari ini):
${avoid}

Tulis 3 pengecoh untuk soal pilihan ganda "Apa fungsi ${item.pattern}?".

Aturan:
- Tiap pengecoh adalah fungsi yang SALAH untuk pola target, tapi masuk akal
  sebagai kekeliruan pemula — bukan fungsi yang benar, dan bukan fungsi pola
  lain yang didaftarkan di atas.
- Bahasa Indonesia, gaya dan panjang MIRIP dengan fungsi yang benar di atas
  (satu kalimat). Opsi yang panjangnya timpang langsung ketahuan jawabannya.
- JANGAN menyebut atau menuliskan pola targetnya sendiri (${item.pattern})
  maupun huruf Jepangnya di dalam pengecoh — itu membocorkan jawaban.
- Level N5/N4: pakai istilah sederhana (partikel, kata kerja, kata benda,
  kata sifat, bentuk sopan), bukan istilah linguistik lanjutan.
- Balas TEPAT 3 baris, satu pengecoh per baris, tanpa nomor dan tanpa tanda
  hubung di depan.`;

  const text = await callClaude({
    system: DISTRACTOR_SYSTEM,
    userContent,
    maxTokens: 500,
    model: ANTHROPIC_GEN_MODEL,
  });
  if (text == null) return null;

  // Bersihkan penomoran/bullet yang kadang tetap muncul, buang baris yang
  // menyalin fungsi benar, dan buang yang membocorkan pola targetnya.
  const correct = (item.meaning || '').trim().toLowerCase();
  const distractors = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
    .filter((l) => l.toLowerCase() !== correct)
    .filter((l) => !l.includes(item.pattern))
    .slice(0, 3);

  return distractors.length >= 2 ? distractors : null;
}

// Pengecoh Step 2: alternatif untuk POTONGAN yang dikosongkan di satu kalimat.
// Beda dari Step 1 — di sini yang diuji BENTUK, dan syarat utamanya pengecoh
// harus benar-benar SALAH di kalimat itu. Aturan mekanis tidak bisa menjamin
// itu (lihat migration 125), makanya butuh AI + review admin.
async function generateControlledFor(item) {
  const slot = controlledSlot(item);
  if (!slot) return null;

  const userContent = `Pola grammar: ${item.pattern}
Arti pola: ${item.meaning || '(tidak ada)'}

Soal isian:
${slot.sentence}
${slot.indonesian ? `Arti kalimat: ${slot.indonesian}` : ''}
Jawaban yang BENAR untuk bagian ＿＿＿ : ${slot.answer}

Tulis 3 pilihan SALAH untuk mengisi ＿＿＿ pada kalimat di atas.

Aturan:
- Tiap pilihan harus kata/bentuk bahasa Jepang yang BENAR-BENAR ADA. Jangan
  mengarang bentuk seperti "すってはいけます" atau menempelkan partikel ke
  frasa ("書いてくださいを").
- Tiap pilihan harus JELAS SALAH kalau dimasukkan ke kalimat itu. Ini yang
  paling penting: kalau sebuah pilihan ternyata juga menghasilkan kalimat yang
  benar, soalnya jadi punya dua jawaban dan tidak bisa dipakai.
- Bentuknya mirip jawaban benar (panjang dan jenis kata sebanding), supaya
  tidak ketahuan hanya dari bentuknya.
- Utamakan kekeliruan yang wajar dilakukan pemula: bentuk kata kerja yang
  keliru, partikel yang keliru, atau pola lain yang mirip tapi tidak cocok
  konteksnya.
- Level N5/N4. Jangan memakai kanji di luar level itu.
- Tulis ISI ＿＿＿ saja, bukan kalimat utuh. Panjangnya sebanding dengan
  jawaban benar dan tanpa tanda baca akhir kalimat.
- Balas TEPAT 3 baris, satu pilihan per baris, tanpa nomor dan tanpa penjelasan.`;

  const text = await callClaude({
    system: DISTRACTOR_SYSTEM,
    userContent,
    maxTokens: 400,
    model: ANTHROPIC_GEN_MODEL,
  });
  if (text == null) return null;

  const distractors = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
    // Pagar yang sama dengan penurunan otomatis: pilihan harus muat di ＿＿＿.
    // Model kadang membalas kalimat utuh walau diminta potongan, dan pilihan
    // sepanjang kalimat membuat soalnya bisa dijawab tanpa tahu tata bahasanya.
    .filter((l) => slotShaped(slot.answer, l))
    .slice(0, 3);
  return distractors.length >= 2 ? { distractors, slot } : null;
}

// Muat satu pola LENGKAP dengan contohnya — dibutuhkan controlledSlot().
async function loadGrammarWithExamples(id) {
  const g = await query(
    `SELECT id, module_id, pattern, meaning, recognition_distractors, controlled_distractors
       FROM module_grammar WHERE id = $1`,
    [id]
  );
  if (g.rows.length === 0) return null;
  const ex = await query(
    `SELECT japanese, highlight, indonesian FROM grammar_examples
      WHERE grammar_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [id]
  );
  return { ...g.rows[0], examples: ex.rows };
}

router.post('/module-grammar/:id/generate-distractors', asyncHandler(async (req, res) => {
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled' });
  const item = await loadGrammarWithExamples(req.params.id);
  if (!item) return res.status(404).json({ error: 'grammar not found' });
  if (!(item.meaning || '').trim()) {
    return res.status(400).json({ error: 'no_meaning', detail: 'Isi kolom Arti dulu — pengecoh dibuat berdasarkan fungsi yang benar.' });
  }
  // Dua tahap sekaligus supaya admin cukup sekali klik per pola.
  const [step1, step2] = await Promise.all([
    generateDistractorsFor(item),
    generateControlledFor(item),
  ]);
  if (!step1 && !step2) {
    return res.status(502).json({ error: 'ai_unusable', detail: 'AI tidak menghasilkan pengecoh yang layak. Coba lagi.' });
  }
  // TIDAK disimpan di sini — admin review dulu lalu tekan Simpan.
  res.json({
    distractors: step1 || [],
    controlled: step2 ? step2.distractors : [],
    slot: step2 ? { sentence: step2.slot.sentence, answer: step2.slot.answer } : null,
  });
}));

// Generate + SIMPAN untuk semua pola satu kursus yang pengecohnya masih kosong.
//
// Dikerjakan per BATCH KECIL, bukan sekali jalan: nginx memutus request di 60s
// (proxy_read_timeout), dan satu panggilan AI makan beberapa detik. Frontend
// memanggil ini berulang sampai `remaining` habis.
//
// Aman diulang: yang sudah terisi dilewati, jadi klik ulang = melanjutkan,
// bukan menimpa. Pola tanpa `meaning` dilewati (tidak ada dasar jawabannya).
router.post('/module-grammar/generate-distractors-bulk', asyncHandler(async (req, res) => {
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled' });
  const { fromGrammarId, courseSlug } = req.body || {};
  const limit = Math.min(10, Math.max(1, Number(req.body?.limit) || 6));

  // Cakupan kursus diturunkan dari pola yang sedang dibuka admin — tidak perlu
  // menyalurkan courseId lewat seluruh UI hanya demi tombol ini.
  let courseId = null;
  if (fromGrammarId) {
    const c = await query(
      `SELECT m.course_id FROM module_grammar g JOIN modules m ON m.id = g.module_id WHERE g.id = $1`,
      [fromGrammarId]
    );
    courseId = c.rows[0]?.course_id || null;
  } else if (courseSlug) {
    const c = await query(`SELECT id FROM courses WHERE slug = $1`, [courseSlug]);
    courseId = c.rows[0]?.id || null;
  }
  if (!courseId) return res.status(400).json({ error: 'course_not_resolved' });

  // "Belum lengkap" = salah satu dari dua kolom masih kosong.
  const pendingSql = `
    SELECT g.id, g.module_id, g.pattern, g.meaning
      FROM module_grammar g
      JOIN modules m ON m.id = g.module_id
     WHERE m.course_id = $1
       AND g.meaning IS NOT NULL AND TRIM(g.meaning) <> ''
       AND ((g.recognition_distractors IS NULL OR TRIM(g.recognition_distractors) = '')
         OR (g.controlled_distractors  IS NULL OR TRIM(g.controlled_distractors)  = ''))
     ORDER BY m.sort_order ASC, g.sort_order ASC`;

  const batch = await query(`${pendingSql} LIMIT $2`, [courseId, limit]);

  let saved = 0;
  const failed = [];
  for (const row of batch.rows) {
    const item = await loadGrammarWithExamples(row.id);
    if (!item) continue;
    // Hanya isi kolom yang masih kosong — yang sudah dikurasi admin tidak
    // pernah ditimpa, walau baris ini terpilih karena kolom satunya kosong.
    const needS1 = !(item.recognition_distractors || '').trim();
    const needS2 = !(item.controlled_distractors || '').trim();
    const [s1, s2] = await Promise.all([
      needS1 ? generateDistractorsFor(item) : null,
      needS2 ? generateControlledFor(item) : null,
    ]);
    if ((needS1 && !s1) && (needS2 && !s2)) { failed.push(row.pattern); continue; }
    await query(
      `UPDATE module_grammar SET
         recognition_distractors = COALESCE($2, recognition_distractors),
         controlled_distractors  = COALESCE($3, controlled_distractors),
         updated_at = NOW()
       WHERE id = $1`,
      [row.id, s1 ? s1.join('\n') : null, s2 ? s2.distractors.join('\n') : null]
    );
    saved++;
  }

  const rest = await query(`SELECT COUNT(*)::int AS n FROM (${pendingSql}) t`, [courseId]);
  const noMeaning = await query(
    `SELECT COUNT(*)::int AS n FROM module_grammar g JOIN modules m ON m.id = g.module_id
      WHERE m.course_id = $1 AND (g.meaning IS NULL OR TRIM(g.meaning) = '')`,
    [courseId]
  );

  res.json({
    processed: batch.rows.length,
    saved,
    failed,
    remaining: rest.rows[0].n,
    skippedNoMeaning: noMeaning.rows[0].n,
  });
}));

// Baca pengecoh tersimpan untuk satu pola (dipakai modal admin saat dibuka).
router.get('/module-grammar/:id/distractors', asyncHandler(async (req, res) => {
  const item = await loadGrammarWithExamples(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  // Soal Step 2 (kalimat + jawaban) ikut dikirim: admin perlu melihat soal yang
  // sedang ia buatkan pengecohnya, sekaligus langsung sadar kalau contoh
  // kalimatnya berubah dan pengecoh lamanya jadi tidak cocok.
  const slot = controlledSlot({ ...item, examples: item.examples });
  res.json({
    pattern: item.pattern,
    meaning: item.meaning,
    value: item.recognition_distractors || '',
    controlled: item.controlled_distractors || '',
    slot: slot ? { sentence: slot.sentence, answer: slot.answer, indonesian: slot.indonesian } : null,
  });
}));

// Simpan (atau kosongkan) pengecoh kurasi. Kosong = kembali ke penurunan lama.
const cleanLines = (raw) => String(raw || '')
  .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);

router.put('/module-grammar/:id/distractors', asyncHandler(async (req, res) => {
  const body = req.body || {};
  // Presence-checked per field: modal boleh menyimpan salah satunya saja tanpa
  // diam-diam mengosongkan yang lain.
  const hasS1 = Object.prototype.hasOwnProperty.call(body, 'value')
    || Object.prototype.hasOwnProperty.call(body, 'distractors');
  const hasS2 = Object.prototype.hasOwnProperty.call(body, 'controlled');
  const s1 = Array.isArray(body.distractors) ? body.distractors.map(String) : cleanLines(body.value);
  const s2 = cleanLines(body.controlled);

  const r = await query(
    `UPDATE module_grammar SET
       recognition_distractors = CASE WHEN $3::boolean THEN $2 ELSE recognition_distractors END,
       controlled_distractors  = CASE WHEN $5::boolean THEN $4 ELSE controlled_distractors END,
       updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [
      req.params.id,
      s1.length ? s1.join('\n') : null, hasS1,
      s2.length ? s2.join('\n') : null, hasS2,
    ]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, distractors: s1, controlled: s2 });
}));

// Bank pola grammar milik MODUL sebuah pelajaran — dipakai dropdown "Pola
// grammar yang diuji" di form soal kuis (migration 122). Terpisah dari
// /module-grammar di atas yang menuntut moduleId: editor kuis cuma memegang
// lessonId, dan menyalurkan moduleId ke seluruh alur Kelola Kuis hanya demi
// satu dropdown tidak sepadan.
router.get('/lessons/:lessonId/grammar-bank', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT g.id, g.pattern, g.meaning
       FROM module_grammar g
       JOIN lessons l ON l.module_id = g.module_id
      WHERE l.id = $1
      ORDER BY g.sort_order ASC, g.created_at ASC`,
    [req.params.lessonId]
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

const QUIZ_GEN_SYSTEM = `You are a Japanese-language quiz author for Indonesian learners (JLPT N5/N4) on the EzNihongo platform. Write accurate questions grounded ONLY in the study material provided. CRITICAL: every "explanation" field MUST be written in Indonesian (Bahasa Indonesia), NEVER in Japanese — you may quote Japanese words/phrases inline, but the explanatory sentence itself must be Indonesian. Always reply with a single valid JSON object and nothing else.`;

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
- menyimak (questionCategory "listening", multiple_choice): "audioScript" WAJIB diisi (soal tanpa audioScript akan DIBUANG) dengan dialog gaya JLPT, alurnya: narator → dialog → pertanyaan diulang. 1 baris per turn dengan prefix speaker, turn dipisah \\n:
  * baris pertama "N: " = narator membacakan kalimat situasi + pertanyaan (contoh: N: 店で、男の人と女の人が話しています。男の人は何を買いますか。)
  * baris tengah = dialog "A: " (perempuan) dan "B: " (laki-laki) bergantian, 3-6 turn — WAJIB ada baris A: dan B:, jangan pakai N: di sini
  * baris terakhir "N: " = pertanyaan yang sama diulang persis
  * N/A/B adalah KODE PERAN suara, BUKAN nama tokoh — dilarang menyebut 「Nさん」「Aさん」 di dialog/pertanyaan. Sebut tokoh sebagai 男の人/女の人/田中さん dsb.
  * dialog harus terdengar ALAMI seperti percakapan sehari-hari — jangan menjejalkan kosakata daftar (cukup 1-3 kata per soal, dipakai wajar); kealamian lebih penting daripada cakupan materi.
  * "question" = HANYA kalimat pertanyaan Jepang yang dibacakan narator. DILARANG menyalin dialog, prefix speaker (N:/A:/B:), atau instruksi meta ("音声を聞いてください" dsb) ke "question".
  4 opsi, 1 benar sesuai isi dialog. (Untuk soal listening per-mondai yang lebih autentik pakai tombol "Generate Listening JLPT".)

Balas HANYA JSON valid tanpa teks lain, bentuk:
{"questions":[{"question":"私の <u>仕事</u> はエンジニアです。","questionType":"multiple_choice","questionCategory":"vocabulary","audioScript":"","correctAnswer":"","explanation":"仕事 dibaca しごと = pekerjaan.","options":[{"text":"しごと","isCorrect":true},{"text":"しゅう","isCorrect":false},{"text":"じぎょう","isCorrect":false},{"text":"しぎょう","isCorrect":false}]},{"question":"女の人は何を買いますか。","questionType":"multiple_choice","questionCategory":"listening","audioScript":"N: 店で、女の人と店の人が話しています。女の人は何を買いますか。\\nA: すみません、りんごを三つください。\\nB: はい。みかんも安いですよ。\\nA: じゃあ、みかんも三つください。\\nN: 女の人は何を買いますか。","correctAnswer":"","explanation":"Perempuan membeli 3 apel lalu menambah 3 jeruk.","options":[{"text":"りんごとみかん","isCorrect":true},{"text":"りんごだけ","isCorrect":false},{"text":"みかんだけ","isCorrect":false},{"text":"バナナ","isCorrect":false}]}]}`;

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

// DEPRECATED: tombol "✨ Generate AI" (bulk) di admin sudah dihapus — diganti
// generator per-mondai (generate-jlpt + generate-listening). Endpoint ini
// dibiarkan dulu tanpa pemanggil; hapus di cleanup berikutnya bareng
// QUIZ_KINDS/QUIZ_GEN_PROMPT_DEFAULT/settings quiz-gen-prompt.
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
    let question = String(q.question || '').trim().slice(0, 1000);
    if (!question) continue;
    const qtype = q.questionType === 'fill_blank' ? 'fill_blank' : 'multiple_choice';
    if (!allowedTypes.has(qtype)) continue;
    let qcat = ['vocabulary', 'grammar', 'reading', 'listening'].includes(q.questionCategory) ? q.questionCategory : 'vocabulary';
    if (!allowedCats.has(qcat)) qcat = fallbackCat;
    const explanation = String(q.explanation || '').trim().slice(0, 1000);
    // 1400 < MAX_TEXT_LEN tts publik (1500) — dialog JLPT bisa panjang.
    const audioScript = String(q.audioScript || '').trim().slice(0, 1400);
    const passage = String(q.passage || '').trim().slice(0, 4000);
    if (qcat === 'listening' && qtype !== 'fill_blank') {
      // Listening tanpa script dialog yang dikenali parser TTS = soal cacat
      // (ga ada audio buat diputar siswa) → buang draft-nya.
      const turns = parseDialog(audioScript);
      if (!turns) continue;
      // Wajib struktur JLPT penuh sesuai prompt: ≥3 turn, ada baris narator
      // (N) DAN dua pembicara dialog (cewe + cowo). Menolak output model yg
      // memperlakukan N sebagai tokoh / dialog 2-turn tanpa kerangka soal.
      const spk = turns.map((t) => String(t.speaker).toUpperCase());
      const hasNarrator = spk.some((s) => /^N/.test(s));
      const hasFemale = spk.some((s) => /^(A|W|F|女)/.test(s));
      const hasMale = spk.some((s) => /^(B|M|男)/.test(s));
      if (turns.length < 3 || !hasNarrator || !hasFemale || !hasMale) continue;
      // "question" = teks yang TAMPIL di soal — model kadang menyalin dialog
      // / instruksi meta ("音声を聞いてください。N: ...") ke sini. Pangkas ke
      // baris pertama tanpa prefix speaker; kalau masih ada pola speaker
      // inline (dialog nyelip dalam 1 baris), ganti dengan baris narator
      // TERAKHIR dari script (= pertanyaan yang diulang, sesuai alur JLPT).
      question = question.split('\n')[0].replace(/^[A-Za-z]{1,3}:\s*/, '').trim();
      if (/[A-Za-z]{1,3}:\s/.test(question)) {
        const nTurns = turns.filter((t) => /^n/i.test(String(t.speaker)));
        question = (nTurns.length ? nTurns[nTurns.length - 1].text : '').trim();
        if (!question) continue;
      }
    }
    if (qtype === 'fill_blank') {
      const correctAnswer = String(q.correctAnswer || '').trim().slice(0, 200);
      if (!correctAnswer) continue;
      clean.push({ question, questionType: 'fill_blank', questionCategory: qcat, audioScript: '', passage: '', correctAnswer, explanation, options: [] });
    } else {
      let options = Array.isArray(q.options)
        ? q.options.map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect })).filter((o) => o.text)
        : [];
      if (options.length < 2) continue;
      options = options.slice(0, 6);
      let firstCorrect = options.findIndex((o) => o.isCorrect);
      if (firstCorrect === -1) firstCorrect = 0;
      options = options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
      clean.push({ question, questionType: 'multiple_choice', questionCategory: qcat, audioScript: qcat === 'listening' ? audioScript : '', passage: qcat === 'reading' ? passage : '', correctAnswer: '', explanation, options });
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
// Cari definisi tipe mondai di kedua peta (JLPT tulis + listening) supaya
// generate-question-options bisa meminjam aturan "Opsi:" tipe spesifik.
function _taskForType(taskType) {
  if (!taskType) return null;
  return JLPT_GEN_TASKS[taskType] || JLPT_LISTENING_TASKS[taskType] || null;
}

router.post('/generate-question-options', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const question = String(body.question || '').trim().slice(0, 2000);
  const category = normalizeQuizCategory(body.questionCategory);
  const passage = String(body.passage || '').trim().slice(0, 4000);
  const audioScript = String(body.audioScript || '').trim().slice(0, 1000);
  const taskType = String(body.taskType || '').trim();
  const level = String(body.level || '').trim();
  const task = _taskForType(taskType);
  const optionCount = task ? (task.optionCount || 4) : 4;
  if (!question) return res.status(400).json({ error: 'question required' });
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const ctxBlocks = [];
  if (category === 'reading' && passage) ctxBlocks.push(`Teks bacaan (dokkai):\n${passage}`);
  if (category === 'listening' && audioScript) ctxBlocks.push(`Skrip audio (listening):\n${audioScript}`);

  // Kalibrasi opsi ke tipe mondai spesifik: pinjam aturan "Opsi:" dari definisi
  // tugas (rules), buang baris contoh "Balas:" (shape jawaban penuh) karena di
  // sini kita cuma minta opsi untuk soal yang SUDAH ada.
  let taskGuidance = '';
  if (task) {
    const taskRules = String(task.rules || '').split(/\nBalas\s*:/)[0].trim();
    const lvl = JLPT_LISTENING_TASKS[taskType]
      ? (JLPT_LISTENING_LEVELS[level] || '')
      : (JLPT_GEN_LEVELS[level] || '');
    taskGuidance = `Tipe soal: ${task.name} (${task.label}).
PENTING: soal SUDAH ada (di bawah). JANGAN bikin soal baru atau ubah teksnya — buat OPSI jawabannya saja.
Ikuti HANYA aturan "Opsi:" untuk tipe mondai ini; ABAIKAN bagian "Format soal"/"Struktur audioScript".
${taskRules}${lvl ? `\n\nBatasan level:\n${lvl}` : ''}`;
  }

  const userContent = `Buat ${optionCount} opsi jawaban pilihan ganda untuk soal kuis bahasa Jepang (JLPT N5/N4).
Kategori: ${category}.
${taskGuidance ? '\n' + taskGuidance + '\n' : ''}${ctxBlocks.join('\n\n')}

Soal: ${question}

Aturan:
- Tepat ${optionCount} opsi, TEPAT 1 yang benar.${category === 'reading' ? ' Jawaban benar HARUS sesuai isi teks bacaan di atas.' : ''}${category === 'listening' ? ' Jawaban benar HARUS sesuai isi skrip audio di atas.' : ''}
- Distraktor (opsi salah) masuk akal & sepadan (panjang/jenis mirip), bukan asal-asalan.
${task ? '' : '- Bahasa opsi mengikuti konteks soal (Indonesia atau Jepang).\n'}- "explanation": alasan singkat WAJIB dalam Bahasa Indonesia (JANGAN bahasa Jepang; istilah Jepang boleh dikutip seperlunya) kenapa jawaban benar.

Balas HANYA JSON valid tanpa teks lain (buat TEPAT ${optionCount} objek opsi):
{"options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"explanation":"..."}`;

  const text = await callClaude({ system: QUIZ_GEN_SYSTEM, userContent, maxTokens: 700 });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.options)) return res.status(502).json({ error: 'ai_parse' });

  // Jalur kalibrasi (taskType dikenal): enforce aturan opsi per tipe via
  // _normalizeJlptOptions (mis. goi_kanji wajib hiragana). Kalau gagal, 1 retry
  // diperketat lalu fallback generik supaya admin tak pernah terblokir.
  if (task) {
    let options = _normalizeJlptOptions(parsed.options, optionCount, taskType, question);
    let explanation = String(parsed.explanation || '').trim().slice(0, 1000);
    if (!options) {
      const hardened = userContent + `\n\nKOREKSI: opsi sebelumnya melanggar aturan "Opsi:" di atas. ` +
        (taskType === 'goi_kanji'
          ? 'Setiap opsi WAJIB HIRAGANA murni (tanpa kanji/katakana/romaji).'
          : 'Pastikan SEMUA opsi mengikuti aturan "Opsi:" tipe ini dengan ketat.');
      const text2 = await callClaude({ system: QUIZ_GEN_SYSTEM, userContent: hardened, maxTokens: 700 });
      const parsed2 = text2 ? _extractJsonObject(text2) : null;
      if (parsed2 && Array.isArray(parsed2.options)) {
        const opts2 = _normalizeJlptOptions(parsed2.options, optionCount, taskType, question);
        if (opts2) {
          options = opts2;
          const exp2 = String(parsed2.explanation || '').trim().slice(0, 1000);
          if (exp2) explanation = exp2;
        }
      }
    }
    if (!options) {
      // Fallback: normalisasi generik (jangan blokir admin meski belum 100% pas tipe).
      const generic = parsed.options
        .map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect }))
        .filter((o) => o.text)
        .slice(0, optionCount);
      if (generic.length < 2) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan opsi valid. Coba lagi.' });
      let fc = generic.findIndex((o) => o.isCorrect);
      if (fc === -1) fc = 0;
      options = generic.map((o, i) => ({ text: o.text, isCorrect: i === fc }));
    }
    return res.json({ options, explanation });
  }

  // Jalur generik (tanpa taskType) — perilaku lama, tidak berubah.
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
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian. WAJIB ada minimal satu baris A: DAN satu baris B: — narator (N:) HANYA untuk baris pertama & terakhir, JANGAN pakai N: untuk isi dialog.
- Baris terakhir → N: [pertanyaan yang SAMA PERSIS diulang].
Konvensi distraktor: dialog menyinggung opsi-opsi lain secara ALAMI lalu mengeliminasinya di alur percakapan (sudah dikerjakan / untuk besok / batal — 「もう〜ました」「やっぱり」「その前に」「あとで」). Tidak wajib menyebut semua opsi kalau hasilnya jadi kaku — kealamian lebih penting. Jawaban TIDAK boleh hanya dari kalimat pertama dialog.
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
- Baris tengah → dialog A: (perempuan) dan B: (laki-laki) bergantian; sedikit lebih panjang dari mondai 1. WAJIB ada minimal satu baris A: DAN satu baris B: — narator (N:) HANYA untuk baris pertama & terakhir, JANGAN pakai N: untuk isi dialog.
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
    rules: `Struktur audioScript WAJIB (pendek; HANYA narator — pilihan TIDAK dibacakan karena sudah tampil di layar siswa):
- Satu baris saja → N: [1-2 kalimat situasi]。何と言いますか。 Contoh pola: 「朝、学校で先生に会いました。何と言いますか。」「友達の消しゴムを使いたいです。何と言いますか。」 JANGAN tulis baris lain selain baris N: ini.
"question" = teks yang SAMA PERSIS dengan baris narator (tanpa prefix N:).
Opsi (field "options"): 3 ucapan Jepang pendek (3-8 kata), TEPAT 1 benar. Distraktor memakai kesalahan khas: arah memberi-menerima (あげます/くれます/もらいます), tingkat kesopanan salah, atau set phrase tertukar (いただきます vs ごちそうさま, 失礼します vs すみません).`,
  },
  sokuji: {
    number: 4,
    label: 'もんだい4 即時応答',
    instruction: 'もんだい4では、ぶんを きいて、1から3の なかから、いちばん いい へんじを ひとつ えらんで ください。',
    optionCount: 3,
    name: '即時応答 (respon cepat percakapan)',
    rules: `Struktur audioScript WAJIB (paling pendek, TANPA narator; balasan TIDAK dibacakan karena sudah tampil di layar siswa):
- Satu baris saja → A: [satu ucapan pendek] ATAU B: [satu ucapan pendek] (pertanyaan/permintaan/komentar 1 kalimat). Contoh pola: 「お国はどちらですか。」「この荷物、ちょっと持ってもらえない？」 JANGAN tulis baris lain.
"question" = teks tetap: いちばん いい へんじを えらんで ください。
Opsi (field "options"): 3 balasan Jepang sangat pendek (2-6 kata) seolah diucapkan LAWAN bicara, TEPAT 1 benar. Distraktor memakai: kata tanya tertukar (どちら = tempat vs pilihan), mengulang kata dari ucapan dengan makna salah, pasangan set phrase salah, atau bentuk waktu tidak nyambung.`,
  },
};

const JLPT_LISTENING_LEVELS = {
  N5: `Level N5 (KETAT — pelajar pemula sekali): dialog 3-6 turn (di luar baris narator), total dialog ±80-120 karakter. SEMUA bentuk sopan です/ます, kalimat pendek satu klausa. Kosakata HANYA dari ±800 kata inti N5 — kalau ragu sebuah kata masuk N5, JANGAN pakai, ganti kata dari daftar Bab. Angka/hari/jam diucapkan jelas. Tepat SATU "jebakan" revisi per dialog (mis. 「あ、やっぱり三つでいいです」). Setting: rumah, sekolah, toko, stasiun, restoran, rumah teman.`,
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
GROUNDING MATERI (penting — soal ini ujian untuk Bab tertentu):
- Tiap dialog WAJIB berpusat pada kosakata/pola dari daftar di bawah — topik percakapan dan kata kuncinya (termasuk jawaban benar) diambil dari materi Bab.
- Kata konten lain di luar daftar hanya jika perlu melengkapi percakapan, dan WAJIB selevel. Kata fungsi (partikel, salam, angka, kata tanya) bebas.
- JANGAN menjejalkan banyak kata daftar ke satu dialog sampai kaku — cukup 2-3 kata daftar dipakai secara luwes per dialog, yang penting kata yang DIUJI berasal dari daftar.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}
{{avoid}}
Aturan umum:
- Dialog harus terdengar ALAMI seperti percakapan sehari-hari orang Jepang — bukan kalimat contoh buku teks yang kaku. Boleh respon pendek alami (そうですか、いいですね、あ、すみません) secukupnya.
- Setiap soal harus berdiri sendiri dengan situasi/topik BERBEDA satu sama lain.
- TEPAT 1 opsi "isCorrect": true per soal. Distraktor sepadan (panjang/jenis mirip), masuk akal, dan disebut/terkait di dialog.
- "explanation": WAJIB Bahasa Indonesia (JANGAN bahasa Jepang; frasa Jepang boleh dikutip), 1-2 kalimat — kutip frasa kunci dialog yang menentukan jawaban.
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
  const taskType = String(req.body?.taskType || '');
  const task = JLPT_LISTENING_TASKS[taskType];
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

  const text = await callClaude({ system: QUIZ_GEN_SYSTEM, userContent, maxTokens: 4096, model: ANTHROPIC_GEN_MODEL });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.questions)) return res.status(502).json({ error: 'ai_parse' });

  const clean = [];
  for (const q of parsed.questions) {
    if (!q || typeof q !== 'object') continue;
    // "question" = teks yang TAMPIL — kalau model kebablasan naruh dialog
    // multi-baris di sini, ambil baris pertama saja (jangan bocorin script)
    // dan buang prefix speaker.
    const question = String(q.question || '').split('\n')[0]
      .replace(/^[A-Za-z]{1,3}:\s*/, '').trim().slice(0, 1000);
    // Batas 1400 < MAX_TEXT_LEN tts publik (1500) supaya audio pasti bisa
    // di-generate untuk siswa.
    const audioScript = String(q.audioScript || '').trim().slice(0, 1400);
    if (!question || !audioScript) continue;
    // Script harus dialog valid yang dikenali parser TTS (prefix speaker).
    const turns = parseDialog(audioScript);
    if (!turns) continue;
    // Struktur per tipe mondai: dialog 1/2 wajib multi-speaker (ada cewe A
    // DAN cowo B — semua-narator = bug satu suara); mondai 3/4 wajib pendek
    // (opsi tidak ikut dibacakan).
    const speakers = turns.map((t) => String(t.speaker).toUpperCase());
    if (taskType === 'kadai' || taskType === 'point') {
      const hasFemale = speakers.some((s) => /^(A|W|F|女)/.test(s));
      const hasMale = speakers.some((s) => /^(B|M|男)/.test(s));
      if (turns.length < 3 || !hasFemale || !hasMale) continue;
    } else if (turns.length > 2) {
      continue;
    }
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

// ===== GENERATOR SOAL JLPT PER-MONDAI: VOCAB (文字・語彙) / GRAMMAR (文法) /
// DOKKAI (読解) =====
// Saudara dari generate-listening: satu run = satu tipe mondai, draft di-review
// admin lalu disimpan via POST /admin/quiz-questions ke section kategori-nya
// (section_number = nomor mondai). Tugas ber-passage (dokkai + 文章の文法)
// minta AI balas {"passages":[{passage, questions:[...]}]} lalu di-flatten —
// semua soal satu bacaan membawa string passage IDENTIK (kunci grouping render
// di welcome.html).
const JLPT_GEN_TASKS = {
  // --- 文字・語彙 (vocabulary) ---
  goi_kanji: {
    category: 'vocabulary', number: 1, optionCount: 4,
    label: 'もんだい1 漢字読み',
    instruction: '＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '漢字読み (cara baca kanji)',
    rules: `Format soal: "question" = SATU kalimat Jepang natural; kata target ditulis KANJI (isi <u>…</u> WAJIB mengandung kanji, BUKAN kana) dan WAJIB dibungkus tag <u>…</u> (hanya kata target). Contoh: 私の <u>仕事</u> はエンジニアです。 DILARANG menulis kalimat tanya meta ("読み方は何ですか" dsb) — instruksi mondai sudah tampil otomatis.
Opsi: 4 cara baca HIRAGANA kata target (hiragana saja, tanpa kanji/romaji); 1 benar, 3 distraktor kana mirip: vokal panjang/pendek (おばさん/おばあさん), dakuten (か/が, す/ず), っ kecil (きて/きって), urutan kana ditukar.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_hyouki: {
    category: 'vocabulary', number: 2, optionCount: 4,
    label: 'もんだい2 表記',
    instruction: '＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '表記 (penulisan kanji/katakana)',
    rules: `Format soal: "question" = SATU kalimat Jepang; kata target ditulis HIRAGANA dan dibungkus <u>…</u>. Contoh: わたしは <u>でんしゃ</u>で がっこうへ いきます。 DILARANG menulis bentuk KANJI kata target di mana pun dalam kalimat (isi <u>…</u> WAJIB hiragana, tanpa kanji) — kalau kanjinya tertulis di soal, jawabannya bocor.
Opsi: 4 penulisan kanji (atau katakana utk kata serapan) kata target; 1 benar, 3 distraktor kanji mirip visual (電/雷, 持/待, 牛/午) atau katakana mirip (シ/ツ, ソ/ン).
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_bunmyaku: {
    category: 'vocabulary', number: 3, optionCount: 4,
    label: 'もんだい3 文脈規定',
    instruction: '（　）に なにを いれますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '文脈規定 (kata sesuai konteks)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan bagian kosong ditulis （　）. Contoh: あついですから、まどを（　）ください。
Opsi: 4 kata Jepang SEKELAS kata (semuanya kata kerja, atau semuanya kata benda, dst); 1 cocok konteks, 3 distraktor sekelas tapi nuansa/konteks salah.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_iikae: {
    category: 'vocabulary', number: 4, optionCount: 4,
    label: 'もんだい4 言い換え類義',
    instruction: '＿＿の ぶんと だいたい おなじ いみの ぶんが あります。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '言い換え類義 (makna terdekat / parafrase)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan kata/frasa target dibungkus <u>…</u>. Contoh: この へやは <u>くらい</u>です。
Opsi: 4 kalimat Jepang parafrase dari kalimat soal; 1 maknanya sama, 3 distraktor: antonim, konsep terkait tapi beda, salah tangkap makna kiasan.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  goi_yougou: {
    category: 'vocabulary', number: 5, optionCount: 4,
    label: 'もんだい5 用法',
    instruction: 'つぎの ことばの つかいかたで いちばん いい ものを 1・2・3・4から ひとつ えらんで ください。',
    name: '用法 (penggunaan kata — N4)',
    rules: `Format soal: "question" = HANYA kata targetnya saja (1 kata Jepang, tanpa kalimat). Contoh: るす
Opsi: 4 kalimat Jepang yang SEMUANYA memuat kata target; TEPAT 1 yang penggunaannya benar (makna + kelas kata + kolokasi), 3 distraktor memakai kata itu di konteks yang salah/tidak natural.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  // --- 文法 (grammar) ---
  bunpou_keishiki: {
    category: 'grammar', number: 1, optionCount: 4,
    label: 'もんだい1 文の文法1',
    instruction: '（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    name: '文の文法1 (pilih bentuk/partikel)',
    rules: `Format soal: "question" = SATU kalimat Jepang dengan bagian kosong （　）. Contoh: わたしは バス（　）がっこうへ 行きます。
Opsi: 4 partikel ATAU 4 bentuk konjugasi dari kata yang sama; 1 benar, 3 distraktor = kesalahan khas pembelajar (partikel tertukar は/が/を/に/で, bentuk て/た/ない tertukar).
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  bunpou_kumitate: {
    category: 'grammar', number: 2, optionCount: 4,
    label: 'もんだい2 文の組み立て',
    instruction: '＿★＿に 入る ものは どれですか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    name: '文の組み立て (susun kalimat ★)',
    rules: `Format soal: "question" = kalimat dengan 4 slot kosong berurutan, salah satu diberi tanda bintang, ditulis PERSIS dengan pola: [awal kalimat]＿＿　＿＿　＿★＿　＿＿[akhir kalimat]。 (underscore full-width ＿, dipisah spasi full-width; posisi ★ boleh di slot mana saja).
Opsi: 4 POTONGAN kalimat BERBEDA yang SEMUANYA dipakai mengisi keempat slot, masing-masing TEPAT SATU KALI — [awal kalimat] + keempat potongan tersusun + [akhir kalimat] HARUS PERSIS membentuk kalimat utuh yang gramatikal (kalimat itu wajib ditulis di "explanation"; server memverifikasi dengan menyusun ulang potongan, draft yang tidak bisa disusun DIBUANG). DILARANG: (a) opsi berupa kata-kata alternatif yang hanya satu dipakai; (b) 4 opsi yang merupakan acakan urutan dari potongan yang sama (mis. 弟は銀行員 / は弟銀行員 / …); (c) 4 kata benda polos tanpa partikel — tiap potongan biasanya membawa partikelnya (「友だちと」「えいがを」「見に」). Campur jenis potongan (frasa benda+partikel / kata kerja / pelengkap) supaya urutannya menantang. "isCorrect": true HANYA pada potongan yang jatuh di posisi ★.
Contoh lengkap: question = きのう　＿＿　＿＿　＿★＿　＿＿。 opsi = 友だちと / えいがを / 見に / 行きました → susunan benar: きのう友だちとえいがを見に行きました。 → posisi ★ (slot ke-3) diisi 見に → "isCorrect": true di 見に.
"explanation" WAJIB menampilkan kalimat utuh dengan urutan benar (memuat KEEMPAT potongan) + terjemahan Indonesia singkat.
Balas: {"questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}`,
  },
  bunpou_bunshou: {
    category: 'grammar', number: 3, optionCount: 4, needsPassage: true, qPerPassage: [1, 5],
    label: 'もんだい3 文章の文法',
    instruction: 'ぶんしょうの いみを かんがえて、（①）から（⑤）の 中に 入る いちばん いい ものを 1・2・3・4から 一つ えらんで ください。',
    name: '文章の文法 (cloze wacana — isi blank dalam teks)',
    rules: `Buat SATU wacana/teks pendek Jepang (cerita harian, surat, sakubun siswa; ±80-150 karakter utk N5, ±150-250 utk N4) berisi blank bernomor ditulis （①）（②）… sesuai jumlah soal yang diminta.
Tiap soal = satu blank: "question" = （①）に 入る ものは どれですか。 (sesuai nomornya); 4 opsi partikel/bentuk/kata penghubung yang cocok di blank itu, 1 benar.
Balas: {"passages":[{"passage":"[teks dengan （①）（②）…]","questions":[{"question":"（①）に 入る ものは どれですか。","options":[{"text":"...","isCorrect":true},...],"explanation":"..."},...]}]}`,
  },
  // --- 読解 (reading / dokkai) ---
  dokkai_tanbun: {
    category: 'reading', number: 1, optionCount: 4, needsPassage: true, qPerPassage: [1, 1],
    label: 'もんだい1 内容理解（短文）',
    instruction: 'つぎの ぶんしょうを よんで、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '内容理解・短文 (bacaan pendek, 1 soal/bacaan)',
    rules: `Tiap item = SATU bacaan pendek (±80-100 karakter utk N5, ±150-200 utk N4; topik harian: catatan, email pendek, pengalaman) + TEPAT 1 soal pemahaman.
Soal menarget: isi eksplisit, ide utama, atau inferensi sederhana. "question" = kalimat tanya Jepang. 4 opsi Jepang pendek, 1 benar (jawaban HARUS dari isi bacaan, distraktor = info yang disinggung tapi bukan jawaban).
Balas: {"passages":[{"passage":"...","questions":[{"question":"...","options":[{"text":"...","isCorrect":true},...],"explanation":"..."}]}]}`,
  },
  dokkai_chuubun: {
    category: 'reading', number: 2, optionCount: 4, needsPassage: true, qPerPassage: [2, 3],
    label: 'もんだい2 内容理解（中文）',
    instruction: 'つぎの ぶんしょうを よんで、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '内容理解・中文 (bacaan sedang, 2-3 soal/bacaan)',
    rules: `Tiap item = SATU bacaan sedang (±200-300 karakter utk N5, ±400-600 utk N4; esai pendek/pengalaman/opini sederhana) + 2-3 soal pemahaman tentang bacaan YANG SAMA.
Soal menarget: alasan (どうして), maksud penulis, detail, urutan kejadian — tiap soal menarget bagian BERBEDA dari bacaan. 4 opsi, 1 benar.
Balas: {"passages":[{"passage":"...","questions":[{...},{...}]}]} — semua soal satu bacaan di array "questions" passage itu.`,
  },
  dokkai_jouhou: {
    category: 'reading', number: 3, optionCount: 4, needsPassage: true, qPerPassage: [2, 2],
    label: 'もんだい3 情報検索',
    instruction: 'つぎの おしらせを みて、しつもんに こたえて ください。こたえは 1・2・3・4から いちばん いい ものを ひとつ えらんで ください。',
    name: '情報検索 (cari info dari pengumuman/jadwal)',
    rules: `Tiap item = SATU teks praktis (pengumuman, jadwal, poster acara, brosur toko; ±150-350 karakter) ditulis TEKS POLOS per baris (label: isi, tanpa tabel/markdown). Contoh format:
としょかんの りようじかん
げつようび〜きんようび：9じ〜18じ
どようび・にちようび：10じ〜16じ
おやすみ：まいしゅう げつようび
+ TEPAT 2 soal mencari/membandingkan info spesifik (jam, hari, harga, syarat). 4 opsi, 1 benar.
Balas: {"passages":[{"passage":"...","questions":[{...},{...}]}]}`,
  },
};

const JLPT_GEN_LEVELS = {
  N5: `Level N5 (KETAT — ini pelajar pemula sekali):
- Kosakata HANYA dari ±800 kata inti N5. Kalau ragu sebuah kata masuk N5 atau bukan, JANGAN pakai — ganti dengan kata dari daftar kosakata Bab.
- Kanji HANYA ±100 kanji dasar N5 (日 月 火 水 木 金 土 人 大 小 山 川 田 中 上 下 左 右 前 後 年 時 分 今 何 私 行 来 見 食 飲 読 書 話 聞 買 学 校 生 先 国 dst). Kata dengan kanji di luar itu WAJIB ditulis hiragana/katakana.
- SEMUA kalimat bentuk sopan です/ます, satu klausa sederhana (tanpa kalimat majemuk), pendek.
- Topik: rumah, sekolah, belanja, makanan, waktu, cuaca, keluarga, perkenalan.`,
  N4: `Level N4: kosakata ±1500 kata / ±300 kanji (kanji di luar itu tulis kana), boleh bentuk kasual & 〜てもいい/〜なければならない/potensial/あげるくれるもらう, kalimat majemuk sederhana. Topik: + pekerjaan, kesehatan, rencana, perasaan, pengalaman.`,
};

// Prompt wrapper editable admin (app_settings.jlpt_gen_prompt). Placeholder:
// {{count}} {{level}} {{taskName}} {{taskRules}} {{levelRules}} {{topic}}
// {{vocab}} {{grammar}} {{avoid}}. Bentuk JSON output ditentukan aturan
// per-tipe ({{taskRules}}).
const JLPT_GEN_PROMPT_DEFAULT = `Buatkan {{count}} {{unit}} soal bahasa Jepang gaya ujian JLPT {{level}}, tipe {{taskName}}.

{{taskRules}}

{{levelRules}}

{{topic}}
GROUNDING MATERI (penting — soal ini ujian untuk Bab tertentu):
- KATA TARGET yang diuji tiap soal WAJIB diambil dari daftar kosakata di bawah (untuk soal kosakata: kata yang digarisbawahi/diisi; untuk grammar: pola dari daftar grammar). Hanya kalau daftar benar-benar tidak punya kata yang cocok untuk format mondai ini, boleh pakai kata umum selevel.
- Kata KONTEN lain (benda/kerja/sifat) di kalimat & opsi: utamakan dari daftar juga; di luar daftar hanya jika perlu melengkapi kalimat, dan WAJIB selevel.
- Kata fungsi (partikel, kopula, angka, kata tanya, salam) bebas.

Kosakata (japanese (reading) = arti):
{{vocab}}

Pola grammar:
{{grammar}}
{{avoid}}
Aturan umum:
- Kalimat & teks harus terdengar ALAMI seperti bahasa Jepang sehari-hari — bukan kalimat buku teks kaku. Alami TIDAK berarti boleh keluar dari materi: pakai kosakata daftar dengan cara yang luwes.
- Setiap soal berdiri sendiri dengan topik/situasi BERBEDA satu sama lain.
- TEPAT 1 opsi "isCorrect": true per soal. Distraktor sepadan (panjang/jenis mirip) dan menarget kesalahan khas pembelajar, bukan asal-asalan.
- "explanation": WAJIB Bahasa Indonesia (JANGAN bahasa Jepang; kata/pola Jepang boleh dikutip), 1-2 kalimat, jelaskan kenapa jawaban benar (sebut arti kata/pola kuncinya).
- Balas HANYA JSON valid tanpa teks lain, dengan bentuk PERSIS seperti dicontohkan di aturan tipe soal di atas.`;

async function _loadJlptGenPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'jlpt_gen_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : JLPT_GEN_PROMPT_DEFAULT;
  } catch {
    return JLPT_GEN_PROMPT_DEFAULT;
  }
}

router.get('/settings/jlpt-gen-prompt', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'jlpt_gen_prompt'`);
  res.json({ value: r.rows[0]?.value || '', default: JLPT_GEN_PROMPT_DEFAULT });
}));

router.put('/settings/jlpt-gen-prompt', asyncHandler(async (req, res) => {
  const value = String((req.body || {}).value || '');
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('jlpt_gen_prompt', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  res.json({ ok: true });
}));

// Validasi struktural per tipe mondai — draft yang melanggar format dibuang
// (pola sama dgn validasi listening). Return question ternormalisasi atau null.
function _validateJlptQuestion(taskType, rawQuestion) {
  const question = String(rawQuestion || '').split('\n')[0].trim().slice(0, 1000);
  if (!question) return null;
  const HAS_U = /<u>[^<]+<\/u>/;
  const KANJI_RE = /[一-鿿々]/;
  // Isi tag <u>…</u> (kata target) — dicek jenis hurufnya per tipe.
  const uContent = question.match(/<u>([^<]+)<\/u>/)?.[1] || '';
  switch (taskType) {
    case 'goi_kanji':
      // 漢字読み: kata target wajib KANJI (kalau kana semua, soal "baca
      // kanji"-nya trivial).
      if (!HAS_U.test(question) || !KANJI_RE.test(uContent)) return null;
      break;
    case 'goi_hyouki':
      // 表記: kata target wajib KANA (tanpa kanji) — kalau kanji-nya sudah
      // tertulis di soal, jawaban bocor (opsi benar = kanji yang sama).
      if (!HAS_U.test(question) || KANJI_RE.test(uContent)) return null;
      break;
    case 'goi_iikae':
      if (!HAS_U.test(question)) return null;
      break;
    case 'goi_bunmyaku':
    case 'bunpou_keishiki':
      if (!question.includes('（　）') && !question.includes('＿＿') && !/（\s*）/.test(question)) return null;
      break;
    case 'goi_yougou':
      if (question.length > 30 || HAS_U.test(question)) return null;
      break;
    case 'bunpou_kumitate':
      if (!question.includes('★') || (question.match(/＿＿/g) || []).length < 3) return null;
      break;
    case 'bunpou_bunshou':
      if (!/[①②③④⑤]/.test(question)) return null;
      break;
    default:
      break;
  }
  return question;
}

function _normalizeJlptOptions(rawOptions, optionCount, taskType, question) {
  let options = Array.isArray(rawOptions)
    ? rawOptions.map((o) => ({ text: String(o?.text || '').trim().slice(0, 300), isCorrect: !!o?.isCorrect })).filter((o) => o.text)
    : [];
  if (options.length < 2) return null;
  options = options.slice(0, optionCount);
  // goi_kanji: opsi wajib hiragana murni (cara baca).
  if (taskType === 'goi_kanji' && !options.every((o) => /^[぀-ゟー\s]+$/.test(o.text))) return null;
  // goi_yougou: semua opsi harus memuat kata target (= question).
  if (taskType === 'goi_yougou' && question && !options.every((o) => o.text.includes(question))) return null;
  let firstCorrect = options.findIndex((o) => o.isCorrect);
  if (firstCorrect === -1) firstCorrect = 0;
  // goi_hyouki: jawaban (penulisan kanji) tidak boleh muncul di kalimat soal
  // — kalau muncul, jawabannya bocor (jaring pengaman kedua di samping cek
  // kana-only pada isi <u> di _validateJlptQuestion).
  if (taskType === 'goi_hyouki' && question && question.includes(options[firstCorrect].text)) return null;
  return options.map((o, i) => ({ text: o.text, isCorrect: i === firstCorrect }));
}

// 組み立て: verifikasi matematis bahwa soalnya beneran puzzle susun-kalimat.
// Kalimat soal = [prefix][4 slot][suffix]; kalimat utuh (wajib ada di
// explanation) harus PERSIS prefix + keempat potongan dalam suatu urutan +
// suffix (whitespace diabaikan). Coba 24 permutasi; kalau ada yang cocok,
// return indeks opsi yang jatuh di slot ★ (= kunci jawaban terverifikasi —
// dipakai meng-override penandaan model). Kalau tidak ada → null (soal
// pilihan-kata menyamar susun-kalimat, atau partikel penyambung hilang).
function _validateKumitate(question, options, explanation) {
  const slotRe = /(?:＿★＿|＿＿)(?:[　\s]*(?:＿★＿|＿＿)){3}/;
  const m = question.match(slotRe);
  if (!m) return null;
  const tokens = m[0].match(/＿★＿|＿＿/g) || [];
  if (tokens.length !== 4) return null;
  const starIdx = tokens.indexOf('＿★＿');
  if (starIdx === -1) return null;
  const strip = (s) => String(s).replace(/[\s　]/g, '');
  const prefix = strip(question.slice(0, m.index));
  const suffix = strip(question.slice(m.index + m[0].length));
  const expl = strip(explanation);
  const frags = options.map((o) => strip(o.text));
  if (frags.length !== 4 || frags.some((f) => !f)) return null;
  const ix = [0, 1, 2, 3];
  for (const a of ix) for (const b of ix) for (const c of ix) for (const d of ix) {
    if (new Set([a, b, c, d]).size !== 4) continue;
    const p = [a, b, c, d];
    const candidate = prefix + p.map((i) => frags[i]).join('') + suffix;
    if (expl.includes(candidate)) return p[starIdx];
  }
  return null;
}

const JLPT_PASSAGE_MAXLEN = { bunpou_bunshou: 600, dokkai_tanbun: 400, dokkai_chuubun: 1000, dokkai_jouhou: 800 };

router.post('/lessons/:lessonId/generate-jlpt', quizGenLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const taskType = String(req.body?.taskType || '');
  const task = JLPT_GEN_TASKS[taskType];
  if (!task) return res.status(400).json({ error: 'bad_task', detail: 'taskType tidak dikenal.' });
  const level = JLPT_GEN_LEVELS[req.body?.level] ? String(req.body.level) : 'N5';
  // count = jumlah soal (non-passage) atau jumlah bacaan (passage task);
  // bunpou_bunshou = 1 wacana dengan `count` blank.
  const count = Math.min(8, Math.max(1, Number(req.body?.count) || 3));
  const topic = String(req.body?.topic || '').slice(0, 300).trim();
  if (!anthropicEnabled()) return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.' });

  const lessonRes = await query(`SELECT id, module_id, type FROM lessons WHERE id = $1`, [lessonId]);
  if (lessonRes.rows.length === 0) return res.status(404).json({ error: 'lesson not found' });
  const lesson = lessonRes.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz', detail: 'Pelajaran ini bukan tipe quiz' });

  // Grounding vocab + grammar modul — query sama dgn generator lain.
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

  // Anti-duplikat: soal existing di kategori yang sama (+ baris pertama
  // passage utk tugas bacaan).
  const existingRes = await query(
    `SELECT question, passage FROM quiz_questions
     WHERE lesson_id = $1 AND question_category = $2
     ORDER BY created_at DESC LIMIT 30`,
    [lessonId, task.category]
  );
  const avoidLines = [...new Set(existingRes.rows.flatMap((r) => [
    String(r.question || '').split('\n')[0].trim(),
    String(r.passage || '').split('\n')[0].trim(),
  ]))].filter(Boolean);

  const vocabLines = vocabRes.rows.map((v) =>
    `- ${v.japanese}${v.reading ? ` (${v.reading})` : ''} = ${v.indonesian || '?'}${v.category ? ` [${v.category}]` : ''}`).join('\n');
  const grammarLines = grammarRes.rows.map((g) =>
    `- ${g.pattern}${g.meaning ? ` = ${g.meaning}` : ''}${g.example ? `. Contoh: ${g.example}` : ''}`).join('\n');

  const promptTpl = await _loadJlptGenPrompt();
  const userContent = _fillTemplate(promptTpl, {
    count: taskType === 'bunpou_bunshou' ? `1 wacana dengan ${count}` : count,
    unit: task.needsPassage
      ? (taskType === 'bunpou_bunshou' ? 'blank' : 'bacaan (lihat aturan jumlah soal per bacaan)')
      : '',
    level,
    taskName: task.name,
    taskRules: task.rules,
    levelRules: JLPT_GEN_LEVELS[level],
    topic: topic ? `Topik/instruksi tambahan dari admin: ${topic}\n` : '',
    vocab: vocabLines || '(tidak ada — pakai kosakata standar level ini)',
    grammar: grammarLines || '(tidak ada — pakai grammar standar level ini)',
    avoid: avoidLines.length
      ? `\nSoal yang SUDAH ADA di kuis ini (jangan bikin soal/bacaan serupa):\n${avoidLines.map((s) => `- ${s.slice(0, 120)}`).join('\n')}\n`
      : '',
  });

  const text = await callClaude({
    system: QUIZ_GEN_SYSTEM,
    userContent,
    maxTokens: task.needsPassage ? 6000 : 4096,
    model: ANTHROPIC_GEN_MODEL,
  });
  if (!text) return res.status(502).json({ error: 'ai_upstream' });
  const parsed = _extractJsonObject(text);
  if (!parsed) return res.status(502).json({ error: 'ai_parse' });

  const clean = [];
  if (task.needsPassage) {
    const passages = Array.isArray(parsed.passages) ? parsed.passages : [];
    const [minQ, maxQ] = taskType === 'bunpou_bunshou' ? [1, Math.min(count, 5)] : task.qPerPassage;
    const passageCount = taskType === 'bunpou_bunshou' ? 1 : count;
    for (const p of passages) {
      if (!p || typeof p !== 'object') continue;
      const passage = String(p.passage || '').trim().slice(0, Math.min(4000, JLPT_PASSAGE_MAXLEN[taskType] || 4000));
      if (!passage) continue;
      if (taskType === 'bunpou_bunshou' && !passage.includes('①')) continue;
      const group = [];
      for (const q of (Array.isArray(p.questions) ? p.questions : [])) {
        if (!q || typeof q !== 'object') continue;
        const question = _validateJlptQuestion(taskType, q.question);
        if (!question) continue;
        const options = _normalizeJlptOptions(q.options, task.optionCount, taskType, question);
        if (!options) continue;
        group.push({
          question, passage, options,
          explanation: String(q.explanation || '').trim().slice(0, 1000),
        });
        if (group.length >= maxQ) break;
      }
      // Bacaan dgn soal kurang dari minimum = buang seluruh bacaan (mis.
      // chuubun cuma 1 soal valid → bukan format mondai-nya).
      if (group.length < minQ) continue;
      clean.push(...group);
      if (clean.filter((x, i, arr) => arr.findIndex((y) => y.passage === x.passage) === i).length >= passageCount) break;
    }
  } else {
    for (const q of (Array.isArray(parsed.questions) ? parsed.questions : [])) {
      if (!q || typeof q !== 'object') continue;
      const question = _validateJlptQuestion(taskType, q.question);
      if (!question) continue;
      let options = _normalizeJlptOptions(q.options, task.optionCount, taskType, question);
      if (!options) continue;
      const explanation = String(q.explanation || '').trim().slice(0, 1000);
      // Kumitate: verifikasi permutasi (lihat _validateKumitate) — menolak
      // puzzle palsu (opsi kata-alternatif, opsi acakan chunk yang sama,
      // potongan tanpa partikel penyambung) DAN meng-override kunci jawaban
      // dengan potongan yang beneran jatuh di slot ★.
      if (taskType === 'bunpou_kumitate') {
        const starOptIdx = _validateKumitate(question, options, explanation);
        if (starOptIdx == null) continue;
        options = options.map((o, i) => ({ text: o.text, isCorrect: i === starOptIdx }));
      }
      clean.push({ question, passage: '', options, explanation });
      if (clean.length >= count) break;
    }
  }
  if (clean.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan soal valid. Coba lagi.' });

  res.json({
    questions: clean,
    section: { number: task.number, label: task.label, instruction: task.instruction },
    category: task.category,
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
- "reading" = cara baca SELURUH kalimat dalam hiragana/katakana penuh (semua kanji diganti kana, tanpa romaji).
- "indonesian" = terjemahan kalimat ke Bahasa Indonesia.
- Kalimat polos, tanpa tag HTML / tanpa furigana.

Balas HANYA JSON valid tanpa teks lain:
{"examples":[{"japanese":"…","reading":"…","highlight":"${word.japanese}","indonesian":"…"}]}`;

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
      reading: (String(e?.reading || '').trim().slice(0, 300)) || null,
      highlight: (String(e?.highlight || '').trim().slice(0, 100)) || null,
      indonesian: (String(e?.indonesian || '').trim().slice(0, 300)) || null,
    }))
    .filter((e) => e.japanese)
    .slice(0, count);
  if (examples.length === 0) return res.status(502).json({ error: 'ai_empty', detail: 'AI tidak menghasilkan contoh valid. Coba lagi.' });
  res.json({ examples });
}));

// Backfill kana (reading) untuk contoh kalimat di sebuah deck yang masih kosong
// — tombol "Generate kana (AI)" di Kelola Deck. Contoh lama (sebelum kolom
// `reading` ada) tidak punya kana; ini mengisinya dari `japanese` via Claude.
// Hemat AI: kalimat tanpa kanji di-set reading=japanese langsung (exact, tanpa
// panggil model). Idempoten — default cuma isi yang kosong; { force:true }
// regenerate semua. Cap per run + batch supaya tidak timeout (re-run lanjut).
const _hasKanji = (s) => /[々一-鿿]/.test(String(s || ''));
router.post('/lessons/:lessonId/generate-deck-readings', asyncHandler(async (req, res) => {
  const force = (req.body || {}).force === true;
  const rows = await query(
    `SELECT e.id, e.japanese
       FROM vocabulary_examples e
       JOIN lesson_deck_items di ON di.vocabulary_id = e.vocabulary_id
      WHERE di.lesson_id = $1 AND ($2::boolean OR e.reading IS NULL OR e.reading = '')
      ORDER BY e.id`,
    [req.params.lessonId, force]
  );
  const all = rows.rows.slice(0, 500); // cap aman per run; re-run lanjut sisanya
  const total = all.length;
  if (total === 0) return res.json({ total: 0, updated: 0, failed: 0 });

  let updated = 0;
  const needAi = [];
  // 1) Kalimat tanpa kanji → reading == japanese (exact, tanpa AI).
  for (const r of all) {
    const jp = String(r.japanese || '').trim();
    if (!jp) continue;
    if (_hasKanji(jp)) { needAi.push(r); continue; }
    await query(`UPDATE vocabulary_examples SET reading = $1, updated_at = NOW() WHERE id = $2`, [jp.slice(0, 300), r.id]);
    updated++;
  }

  // 2) Sisanya (mengandung kanji) → Claude per batch.
  if (needAi.length > 0) {
    if (!anthropicEnabled()) {
      return res.status(503).json({ error: 'ai_disabled', detail: 'ANTHROPIC_API_KEY belum diset.', total, updated, failed: needAi.length });
    }
    const BATCH = 20;
    for (let i = 0; i < needAi.length; i += BATCH) {
      const batch = needAi.slice(i, i + BATCH);
      const list = batch.map((r, j) => `${j + 1}. ${String(r.japanese).trim().slice(0, 280)}`).join('\n');
      const userContent = `Ubah tiap kalimat Jepang berikut menjadi cara baca KANA penuh.
Aturan:
- Semua kanji diganti hiragana (katakana untuk kata serapan).
- TANPA kanji, TANPA romaji, TANPA furigana/tanda kurung.
- Pertahankan partikel dan tanda baca (。、？！) apa adanya.

Kalimat:
${list}

Balas HANYA JSON valid tanpa teks lain, "n" = nomor kalimat:
{"items":[{"n":1,"reading":"…"}]}`;
      const text = await callClaude({
        system: 'You convert Japanese sentences to full kana readings. Reply with a single valid JSON object only.',
        userContent,
        maxTokens: 1200,
        model: ANTHROPIC_GEN_MODEL,
      });
      const parsed = text ? _extractJsonObject(text) : null;
      const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
      for (const it of items) {
        const n = Number(it?.n);
        const reading = String(it?.reading || '').trim().slice(0, 300);
        if (!reading || !Number.isInteger(n) || n < 1 || n > batch.length) continue;
        await query(`UPDATE vocabulary_examples SET reading = $1, updated_at = NOW() WHERE id = $2`, [reading, batch[n - 1].id]);
        updated++;
      }
    }
  }

  res.json({ total, updated, failed: total - updated });
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
  // replace=true wipes the module's grammar first; wrap so a crash mid-insert
  // can't leave it emptied or half-populated.
  const inserted = await withTransaction(async (client) => {
    if (replace) await client.query(`DELETE FROM module_grammar WHERE module_id = $1`, [moduleId]);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const g = items[i] || {};
      if (!g.pattern) continue;
      const r = await client.query(
        `INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [moduleId, g.lessonId || null, g.pattern, g.meaning || null, g.example || null, g.notes || null, g.sortOrder ?? i]
      );
      out.push(r.rows[0]);
    }
    return out;
  });
  res.status(201).json({ grammar: inserted });
}));

// ===== LESSONS =====

router.post('/lessons', asyncHandler(async (req, res) => {
  const {
    moduleId, slug, title, type, content, videoUrl, videoSourceId,
    videoStartSeconds, videoEndSeconds, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
  } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const slugErr = badSlug(slug);
  if (slugErr) return res.status(400).json({ error: slugErr });
  // Video and kana lessons can share one YouTube source while using different
  // timeline ranges. Legacy video_url remains independent for Bunny content.
  const acceptsVideoSegment = supportsVideoSegment(type);
  const segment = normalizeSegment(
    acceptsVideoSegment ? videoSourceId : null,
    acceptsVideoSegment ? videoStartSeconds : null,
    acceptsVideoSegment ? videoEndSeconds : null
  );
  if (segment.error) return res.status(400).json({ error: segment.error });
  const result = await query(
    `INSERT INTO lessons (
       module_id, slug, title, type, content, video_url,
       video_source_id, video_start_seconds, video_end_seconds,
       duration_minutes, sort_order, passing_score_pct, questions_per_attempt,
       cooldown_hours, popup_after_lesson_id
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [
      moduleId, slug, title, type || 'text',
      content || null, videoUrl || null,
      segment.videoSourceId, segment.videoStartSeconds, segment.videoEndSeconds,
      durationMinutes || null, sortOrder || 0,
      passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : 70,
      questionsPerAttempt != null && questionsPerAttempt !== '' ? Number(questionsPerAttempt) : null,
      cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : 12,
      popupAfterLessonId || null,
    ]
  );
  invalidateKanjiCatalogCache();
  res.status(201).json({ lesson: result.rows[0] });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const {
    slug, title, type, content, videoUrl, videoSourceId, videoStartSeconds,
    videoEndSeconds, durationMinutes, sortOrder,
    passingScorePct, questionsPerAttempt, cooldownHours, popupAfterLessonId,
  } = req.body || {};
  if (slug !== undefined && slug !== null) {
    const slugErr = badSlug(slug);
    if (slugErr) return res.status(400).json({ error: slugErr });
  }
  const hasQPA = Object.prototype.hasOwnProperty.call(req.body || {}, 'questionsPerAttempt');
  const hasPopup = Object.prototype.hasOwnProperty.call(req.body || {}, 'popupAfterLessonId');
  const hasVideoSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoSourceId');
  const hasVideoStart = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoStartSeconds');
  const hasVideoEnd = Object.prototype.hasOwnProperty.call(req.body || {}, 'videoEndSeconds');

  // Lesson type-switch cleanup: kalau type berubah dari yang punya konten
  // (quiz/kanji/deck), hapus konten lama sebelum UPDATE. Tanpa ini,
  // quiz_questions/kanji_items/lesson_deck_items orphan di DB + counter
  // di list pelajaran salah. FK ON DELETE CASCADE handle quiz_options +
  // quiz_attempts otomatis. ON DELETE CASCADE buat kanji_items udah ada
  // (migration 015), buat lesson_deck_items juga.
  // Type-switch cleanup + UPDATE must be atomic: this deletes quiz_attempts
  // (student progress) and other nested content before re-typing the lesson.
  // A crash between the DELETEs and the UPDATE would orphan content and lose
  // student history with no consistent state to recover to.
  const outcome = await withTransaction(async (client) => {
    const cur = await client.query(
      `SELECT type, video_source_id, video_start_seconds, video_end_seconds
         FROM lessons WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (cur.rows.length === 0) return { notFound: true };
    const current = cur.rows[0];
    const oldType = current.type;
    if (type && oldType !== type) {
      if (oldType === 'quiz') {
        await client.query(`DELETE FROM quiz_questions WHERE lesson_id = $1`, [req.params.id]);
        await client.query(`DELETE FROM quiz_attempts WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'kanji') {
        await client.query(`DELETE FROM kanji_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'deck') {
        await client.query(`DELETE FROM lesson_deck_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'kana') {
        await client.query(`DELETE FROM lesson_kana_items WHERE lesson_id = $1`, [req.params.id]);
      } else if (oldType === 'grammar_task') {
        await client.query(`DELETE FROM lesson_grammar_task_items WHERE lesson_id = $1`, [req.params.id]);
      }
    }

      // PUT also supports partial callers. Only fields actually supplied in
      // the payload replace a saved segment; the admin editor sends all three
      // so it can deliberately clear the source when lesson type changes.
      const effectiveType = type || oldType;
      const acceptsVideoSegment = supportsVideoSegment(effectiveType);
      const segment = normalizeSegment(
        acceptsVideoSegment
          ? (hasVideoSource ? videoSourceId : current.video_source_id)
          : null,
        acceptsVideoSegment
          ? (hasVideoStart ? videoStartSeconds : current.video_start_seconds)
          : null,
        acceptsVideoSegment
          ? (hasVideoEnd ? videoEndSeconds : current.video_end_seconds)
          : null
      );
      if (segment.error) return { error: segment.error };

      const result = await client.query(
        `UPDATE lessons SET
          slug = COALESCE($2, slug),
          title = COALESCE($3, title),
          type = COALESCE($4, type),
          content = COALESCE($5, content),
          video_url = COALESCE($6, video_url),
          video_source_id = CASE WHEN $10::boolean THEN $7 ELSE video_source_id END,
          video_start_seconds = CASE WHEN $11::boolean THEN $8 ELSE video_start_seconds END,
          video_end_seconds = CASE WHEN $12::boolean THEN $9 ELSE video_end_seconds END,
          duration_minutes = COALESCE($13, duration_minutes),
          sort_order = COALESCE($14, sort_order),
          passing_score_pct = COALESCE($15, passing_score_pct),
          questions_per_attempt = CASE WHEN $17::boolean THEN $16 ELSE questions_per_attempt END,
          cooldown_hours = COALESCE($18, cooldown_hours),
          popup_after_lesson_id = CASE WHEN $20::boolean THEN $19 ELSE popup_after_lesson_id END
        WHERE id = $1 RETURNING *`,
        [
          req.params.id, slug, title, type, content, videoUrl,
          segment.videoSourceId, segment.videoStartSeconds, segment.videoEndSeconds,
          true, true, true,
          durationMinutes, sortOrder,
          passingScorePct != null && passingScorePct !== '' ? Number(passingScorePct) : null,
          hasQPA && questionsPerAttempt !== '' && questionsPerAttempt != null ? Number(questionsPerAttempt) : null,
          hasQPA,
          cooldownHours != null && cooldownHours !== '' ? Number(cooldownHours) : null,
          hasPopup && popupAfterLessonId ? popupAfterLessonId : null,
          hasPopup,
        ]
      );
    if (result.rows.length === 0) return { notFound: true };
    return { lesson: result.rows[0] };
  });

  if (outcome.notFound) return res.status(404).json({ error: 'Not found' });
  if (outcome.error) return res.status(400).json({ error: outcome.error });
  invalidateKanjiCatalogCache();
  res.json({ lesson: outcome.lesson });
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM lessons WHERE id = $1`, [req.params.id]);
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// ===== QUIZ QUESTIONS (with options in one call) =====

const QUIZ_CATEGORIES = new Set(['vocabulary', 'grammar', 'reading', 'listening', 'custom']);

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
                WHEN 'reading' THEN 3
                WHEN 'listening' THEN 4
                WHEN 'custom' THEN 5
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
    sectionLabel, sectionInstruction, audioScript, passage, imageUrl,
    correctAnswer, explanation, sortOrder, options, grammarId,
  } = req.body || {};
  if (!lessonId || !question) return res.status(400).json({ error: 'lessonId and question required' });

  const category = normalizeQuizCategory(questionCategory);
  const sectionNo = normalizeQuizSectionNumber(sectionNumber);
  const sectionTitle = (sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`;

  // Question + options written atomically: a crash mid-loop must not leave a
  // question with a partial option set (a broken live quiz).
  const q = await withTransaction(async (client) => {
    const qRes = await client.query(
      `INSERT INTO quiz_questions (
         lesson_id, question, question_type, question_category,
         section_number, section_label, section_instruction, audio_script, passage, image_url,
         correct_answer, explanation, sort_order, grammar_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        lessonId,
        question,
        questionType || 'multiple_choice',
        category,
        sectionNo,
        sectionTitle,
        sectionInstruction || null,
        (audioScript && String(audioScript).trim()) || null,
        (passage && String(passage).trim()) || null,
        (imageUrl && String(imageUrl).trim()) || null,
        correctAnswer || null,
        explanation || null,
        sortOrder || 0,
        // Tautan opsional ke pola grammar (migration 122) — bikin soal ini ikut
        // mengisi analisis per-konsep tanpa biaya AI (penilaiannya deterministik).
        (grammarId && String(grammarId).trim()) || null,
      ]
    );
    const row = qRes.rows[0];

    if (Array.isArray(options) && options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await client.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
        );
      }
    }
    return row;
  });

  res.status(201).json({ question: q });
}));

router.put('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const {
    question, questionType, questionCategory, sectionNumber,
    sectionLabel, sectionInstruction, audioScript, passage, imageUrl,
    correctAnswer, explanation, sortOrder, options, grammarId,
  } = req.body || {};
  const category = questionCategory ? normalizeQuizCategory(questionCategory) : null;
  // Presence-checked, bukan COALESCE: admin harus bisa MELEPAS tautan pola
  // (kirim grammarId: null) — dengan COALESCE itu mustahil.
  const hasGrammarId = Object.prototype.hasOwnProperty.call(req.body || {}, 'grammarId');
  const grammarIdNorm = hasGrammarId ? ((grammarId && String(grammarId).trim()) || null) : null;
  const sectionNo = sectionNumber == null ? null : normalizeQuizSectionNumber(sectionNumber);
  const hasSectionInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  const hasAudioScript = Object.prototype.hasOwnProperty.call(req.body || {}, 'audioScript');
  const hasPassage = Object.prototype.hasOwnProperty.call(req.body || {}, 'passage');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'imageUrl');
  const audioScriptNorm = hasAudioScript ? ((audioScript && String(audioScript).trim()) || null) : null;
  const passageNorm = hasPassage ? ((passage && String(passage).trim()) || null) : null;
  const imageUrlNorm = hasImageUrl ? ((imageUrl && String(imageUrl).trim()) || null) : null;
  // Update + wholesale option replace must be atomic: the old DELETE-then-loop
  // could wipe every option then crash, leaving a live question answerless.
  const updated = await withTransaction(async (client) => {
    const result = await client.query(
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
         image_url = CASE WHEN $15::boolean THEN $14 ELSE image_url END,
         passage = CASE WHEN $17::boolean THEN $16 ELSE passage END,
         grammar_id = CASE WHEN $19::boolean THEN $18::uuid ELSE grammar_id END
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
        passageNorm,
        hasPassage,
        grammarIdNorm,
        hasGrammarId,
      ]
    );
    if (result.rows.length === 0) return null;

    if (Array.isArray(options)) {
      // Replace options wholesale
      await client.query(`DELETE FROM quiz_options WHERE question_id = $1`, [req.params.id]);
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await client.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, image_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, o.imageUrl || o.image_url || null, i]
        );
      }
    }
    return result.rows[0];
  });

  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ question: updated });
}));

router.delete('/quiz-questions/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// Bulk update section meta (label / instruction / passage) — semua soal di
// (lesson, category, number) yang sama. Dipakai admin pas mereka edit info
// section, supaya ga perlu update tiap pertanyaan satu-satu. Passage dishare
// section-level untuk dokkai (reading).
router.put('/lessons/:lessonId/quiz/sections/:category/:number', asyncHandler(async (req, res) => {
  const { lessonId, category, number } = req.params;
  const { sectionLabel, sectionInstruction, passage } = req.body || {};
  const cat = normalizeQuizCategory(category);
  const sectionNo = normalizeQuizSectionNumber(number);
  const hasLabel = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionLabel');
  const hasInstruction = Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionInstruction');
  const hasPassage = Object.prototype.hasOwnProperty.call(req.body || {}, 'passage');
  if (!hasLabel && !hasInstruction && !hasPassage) {
    return res.status(400).json({ error: 'sectionLabel, sectionInstruction or passage required' });
  }
  const labelNorm = hasLabel
    ? ((sectionLabel && String(sectionLabel).trim()) || `Section ${sectionNo}`)
    : null;
  const instructionNorm = hasInstruction
    ? ((sectionInstruction && String(sectionInstruction).trim()) || null)
    : null;
  const passageNorm = hasPassage
    ? ((passage && String(passage).trim()) || null)
    : null;
  const result = await query(
    `UPDATE quiz_questions
        SET section_label = CASE WHEN $5::boolean THEN $3 ELSE section_label END,
            section_instruction = CASE WHEN $6::boolean THEN $4 ELSE section_instruction END,
            passage = CASE WHEN $8::boolean THEN $9 ELSE passage END
      WHERE lesson_id = $1 AND question_category = $2 AND section_number = $7`,
    [lessonId, cat, labelNorm, instructionNorm, hasLabel, hasInstruction, sectionNo, hasPassage, passageNorm]
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
  // Server-side search + pagination so users beyond the old hard cap of 500
  // are reachable (search by name/email; page with limit/offset).
  const q = String(req.query.q || '').trim();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const params = [];
  let where = '';
  if (q) {
    params.push('%' + q + '%');
    const p = `$${params.length}`;
    where = `WHERE (u.email ILIKE ${p} OR u.full_name ILIKE ${p} OR u.google_name ILIKE ${p})`;
  }
  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM users u ${where}`, params);
  const listParams = params.slice();
  listParams.push(limit, offset);
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.google_name, u.avatar_url, u.created_at,
            COALESCE(s.xp, 0) AS xp, COALESCE(s.streak_days, 0) AS streak_days,
            COALESCE(s.total_lessons_completed, 0) AS total_lessons_completed,
            s.last_active_date
     FROM users u
     LEFT JOIN user_stats s ON s.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  res.json({ users: result.rows, total: totalRes.rows[0].n });
}));

// ===== AKSES DASHBOARD (course entitlement grants) =====
// Beri/cabut akses kursus tanpa lewat checkout: insert/soft-revoke baris
// user_enrollments (grant sama persis dengan POST /api/enrollments, tapi
// admin bisa pilih user mana by email; revoke mengubah status, bukan
// DELETE — lihat migration 120). user_enrollments = single source of
// truth akses, di-scope per course_id (akses N5 tidak pernah membuka N4).

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
    `SELECT c.id AS course_id, c.slug, c.title, c.level, e.enrolled_at,
            e.status, e.expires_at, e.source, e.revoked_at
       FROM user_enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC`,
    [user.id]
  );
  const courses = await query(
    `SELECT id, slug, title, level, is_published, is_available, is_free
       FROM courses WHERE is_published = TRUE
      ORDER BY sort_order ASC, created_at ASC`
  );
  // Order history for this user — surfaced alongside enrollments so an
  // admin looking at "why does this user have access" (or "do they have a
  // pending order I should review") doesn't have to cross-reference the
  // Pesanan tab separately. Same effective-status computation as the
  // orders list/detail endpoints.
  const orders = await query(
    `SELECT o.id, o.order_number, o.course_title_snapshot, o.amount_idr,
            ${ORDER_EFFECTIVE_STATUS_SQL} AS status, o.created_at, o.expires_at, o.approved_at
       FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
    [user.id]
  );
  res.json({ user, enrollments: enrolled.rows, courses: courses.rows, orders: orders.rows });
}));

// POST /api/admin/user-access/grant — { email, courseSlug, expiresAt? } →
// enroll user ke kursus (atau reaktivasi entitlement yang sebelumnya
// di-revoke). expiresAt opsional (ISO string) untuk akses time-boxed;
// kosong = akses permanen sampai di-revoke manual.
router.post('/user-access/grant', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseSlug = String(req.body?.courseSlug || '').trim();
  const expiresAtRaw = req.body?.expiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAtRaw && Number.isNaN(expiresAt?.getTime())) {
    return res.status(400).json({ error: 'invalid_expires_at' });
  }
  // A past expiresAt would create a grant that's already lapsed the instant
  // it's saved (hasCourseAccess checks expires_at > NOW()) — silently
  // useless rather than an error, so reject it instead of accepting it.
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'expires_at_in_past' });
  }
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

  // ON CONFLICT reactivates a previously-revoked row (status back to active,
  // revoked_at cleared) instead of leaving it stuck revoked — grant is the
  // one explicit "give this user access" action, so it should always work.
  const ins = await query(
    `INSERT INTO user_enrollments (user_id, course_id, status, source, expires_at)
     VALUES ($1, $2, 'active', 'admin_grant', $3)
     ON CONFLICT (user_id, course_id) DO UPDATE
       SET status = 'active', revoked_at = NULL, expires_at = $3
     RETURNING id, (xmax = 0) AS inserted`,
    [user.id, course.id, expiresAt]
  );
  res.json({
    ok: true,
    alreadyEnrolled: !ins.rows[0].inserted,
    user: { email: user.email, full_name: user.full_name },
    course: { slug: course.slug, title: course.title },
  });
}));

// POST /api/admin/user-access/revoke — { email, courseId } → cabut akses
// (soft-revoke: status='revoked', bukan DELETE) supaya baris enrollment +
// riwayatnya tetap ada dan progres siswa (user_progress, tidak di-FK ke
// user_enrollments) tidak tersentuh.
router.post('/user-access/revoke', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const courseId = String(req.body?.courseId || '');
  if (!email) return res.status(400).json({ error: 'email_required' });
  if (!courseId) return res.status(400).json({ error: 'course_required' });

  const userRow = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const upd = await query(
    `UPDATE user_enrollments
        SET status = 'revoked', revoked_at = NOW()
      WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      RETURNING id`,
    [user.id, courseId]
  );
  if (upd.rows.length === 0) return res.status(404).json({ error: 'enrollment_not_found' });
  res.json({ ok: true });
}));

// ===== ORDERS (Phase 2 — manual bank transfer payment verification) =====
// Course purchase orders, separate from the Kanji PWA's Midtrans-driven
// `subscriptions` (different table, different identity realm). Approval is
// the ONLY event that grants access — the user_enrollments upsert happens
// inside the same transaction as the order/payment status flip below, never
// at order-creation or proof-upload time. See backend/src/routes/orders.js
// for the student-facing side and migration 121 for the schema.

const ORDER_ACTIONABLE_STATUSES = ['pending_payment', 'awaiting_review', 'rejected'];
function orderEffectiveStatus(order) {
  if (order.status === 'approved' || order.status === 'cancelled') return order.status;
  if (new Date(order.expires_at).getTime() < Date.now()) return 'expired';
  return order.status;
}

// GET /api/admin/orders?status=&q=&limit=&offset= — queue listing.
// status: exact DB status to filter on, or omitted/'' for all.
// q: matches order_number or user email.
// 'expired' is never a stored status (see orderEffectiveStatus above) — a
// row can sit at status='pending_payment'/'awaiting_review' in the DB long
// after its expires_at has passed. Filtering on the raw `status` column
// would make `?status=expired` match zero rows forever, so both the list
// and the count query filter on this same CASE expression instead —
// mirrors orderEffectiveStatus() exactly, just computed in SQL.
const ORDER_EFFECTIVE_STATUS_SQL = `
  CASE
    WHEN o.status IN ('approved', 'cancelled') THEN o.status
    WHEN o.expires_at < NOW() THEN 'expired'
    ELSE o.status
  END`;

router.get('/orders', asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const result = await query(
    `SELECT o.*, u.email AS user_email, u.full_name AS user_full_name,
            (SELECT COUNT(*)::int FROM order_payments p WHERE p.order_id = o.id) AS payment_attempts
       FROM orders o
       JOIN users u ON u.id = o.user_id
      WHERE ($1 = '' OR ${ORDER_EFFECTIVE_STATUS_SQL} = $1)
        AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
      ORDER BY o.created_at DESC
      LIMIT $3 OFFSET $4`,
    [status, q, limit, offset]
  );
  const totalRes = await query(
    `SELECT COUNT(*)::int AS n
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE ($1 = '' OR ${ORDER_EFFECTIVE_STATUS_SQL} = $1)
        AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')`,
    [status, q]
  );
  res.json({
    orders: result.rows.map((o) => ({
      id: o.id, orderNumber: o.order_number, courseTitle: o.course_title_snapshot,
      amountIdr: o.amount_idr, status: orderEffectiveStatus(o), createdAt: o.created_at,
      expiresAt: o.expires_at, paymentAttempts: o.payment_attempts,
      user: { email: o.user_email, fullName: o.user_full_name },
    })),
    total: totalRes.rows[0].n,
  });
}));

// GET /api/admin/orders/:id — full detail incl. every payment attempt.
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const orderRes = await query(
    `SELECT o.*, u.email AS user_email, u.full_name AS user_full_name
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 LIMIT 1`,
    [req.params.id]
  );
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  const payments = await query(
    `SELECT p.*, r.email AS reviewed_by_email
       FROM order_payments p
       LEFT JOIN users r ON r.id = p.reviewed_by
      WHERE p.order_id = $1
      ORDER BY p.submitted_at DESC`,
    [order.id]
  );
  res.json({
    order: {
      id: order.id, orderNumber: order.order_number, courseId: order.course_id,
      courseTitle: order.course_title_snapshot, amountIdr: order.amount_idr,
      status: orderEffectiveStatus(order), createdAt: order.created_at,
      expiresAt: order.expires_at, approvedAt: order.approved_at,
      user: { email: order.user_email, fullName: order.user_full_name },
    },
    payments: payments.rows.map((p) => ({
      id: p.id, status: p.status, hasProof: !!p.proof_mime,
      claimedBankName: p.claimed_bank_name, claimedSenderName: p.claimed_sender_name,
      claimedAmountIdr: p.claimed_amount_idr, claimedTransferredAt: p.claimed_transferred_at,
      submittedAt: p.submitted_at, reviewedAt: p.reviewed_at, reviewedBy: p.reviewed_by_email,
      rejectionReason: p.rejection_reason,
    })),
  });
}));

// POST /api/admin/orders/:id/approve — { paymentId? } (defaults to the
// order's current pending attempt). Grants access atomically: guarded
// status transitions on both order_payments and orders, then the
// user_enrollments upsert, all in one transaction — a duplicate/concurrent
// approve call finds nothing left in 'pending'/'awaiting_review' and 409s
// before it ever reaches the enrollment upsert.
router.post('/orders/:id/approve', asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  let paymentId = req.body?.paymentId;
  if (!paymentId) {
    const p = await query(
      `SELECT id FROM order_payments WHERE order_id = $1 AND status = 'pending'
        ORDER BY submitted_at DESC LIMIT 1`,
      [orderId]
    );
    paymentId = p.rows[0]?.id;
  }
  if (!paymentId) return res.status(404).json({ error: 'no_pending_payment' });

  try {
    const result = await withTransaction(async (client) => {
      const payRes = await client.query(
        `UPDATE order_payments SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
          WHERE id = $2 AND order_id = $3 AND status = 'pending'
          RETURNING *`,
        [req.user.id, paymentId, orderId]
      );
      if (payRes.rows.length === 0) throw Object.assign(new Error('payment_not_pending'), { code: 'ORDER_CONFLICT' });

      const orderRes = await client.query(
        `UPDATE orders SET status = 'approved', approved_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'awaiting_review' AND expires_at > NOW()
          RETURNING *`,
        [orderId]
      );
      if (orderRes.rows.length === 0) throw Object.assign(new Error('order_not_approvable'), { code: 'ORDER_CONFLICT' });
      const order = orderRes.rows[0];

      await client.query(
        `INSERT INTO user_enrollments (user_id, course_id, status, source, order_id, expires_at, revoked_at)
         VALUES ($1, $2, 'active', 'purchase', $3, NULL, NULL)
         ON CONFLICT (user_id, course_id) DO UPDATE
           SET status = 'active', source = 'purchase', order_id = $3, expires_at = NULL, revoked_at = NULL`,
        [order.user_id, order.course_id, orderId]
      );

      return { order, payment: payRes.rows[0] };
    });
    res.json({
      ok: true,
      order: { id: result.order.id, status: orderEffectiveStatus(result.order) },
    });
  } catch (err) {
    if (err.code === 'ORDER_CONFLICT') return res.status(409).json({ error: err.message });
    throw err;
  }
}));

// POST /api/admin/orders/:id/reject — { paymentId?, reason } — reason required.
// NOT terminal for the order: the student can submit a new proof, which
// flips the order back to 'awaiting_review' (see orders.js payment-proof).
router.post('/orders/:id/reject', asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'reason_required' });
  let paymentId = req.body?.paymentId;
  if (!paymentId) {
    const p = await query(
      `SELECT id FROM order_payments WHERE order_id = $1 AND status = 'pending'
        ORDER BY submitted_at DESC LIMIT 1`,
      [orderId]
    );
    paymentId = p.rows[0]?.id;
  }
  if (!paymentId) return res.status(404).json({ error: 'no_pending_payment' });

  try {
    const result = await withTransaction(async (client) => {
      const payRes = await client.query(
        `UPDATE order_payments
            SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
          WHERE id = $3 AND order_id = $4 AND status = 'pending'
          RETURNING *`,
        [req.user.id, reason, paymentId, orderId]
      );
      if (payRes.rows.length === 0) throw Object.assign(new Error('payment_not_pending'), { code: 'ORDER_CONFLICT' });

      const orderRes = await client.query(
        `UPDATE orders SET status = 'rejected', updated_at = NOW()
          WHERE id = $1 AND status = 'awaiting_review'
          RETURNING *`,
        [orderId]
      );
      if (orderRes.rows.length === 0) throw Object.assign(new Error('order_not_rejectable'), { code: 'ORDER_CONFLICT' });
      return { order: orderRes.rows[0] };
    });
    res.json({ ok: true, order: { id: result.order.id, status: orderEffectiveStatus(result.order) } });
  } catch (err) {
    if (err.code === 'ORDER_CONFLICT') return res.status(409).json({ error: err.message });
    throw err;
  }
}));

// ===== SETTINGS — bank transfer accounts (manual payment instructions) =====
// Admin-editable, no redeploy needed — same app_settings pattern as the
// AI prompt settings below. Value is a JSON-encoded array of
// { label, bankName, accountNumber, accountHolder }. Never hardcoded in
// frontend source — fetched per-order from the student-facing API.
router.get('/settings/bank-accounts', asyncHandler(async (_req, res) => {
  const r = await query(`SELECT value FROM app_settings WHERE key = 'bank_transfer_accounts'`);
  let accounts = [];
  try { accounts = JSON.parse(r.rows[0]?.value || '[]'); } catch { accounts = []; }
  res.json({ accounts: Array.isArray(accounts) ? accounts : [] });
}));

router.put('/settings/bank-accounts', asyncHandler(async (req, res) => {
  const accounts = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
  const cleaned = accounts.map((a) => ({
    label: String(a?.label || '').trim().slice(0, 100),
    bankName: String(a?.bankName || '').trim().slice(0, 100),
    accountNumber: String(a?.accountNumber || '').trim().slice(0, 50),
    accountHolder: String(a?.accountHolder || '').trim().slice(0, 100),
  })).filter((a) => a.bankName && a.accountNumber);
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('bank_transfer_accounts', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(cleaned)]
  );
  res.json({ ok: true, accounts: cleaned });
}));

// ===== DISCUSSIONS (admin moderation) =====

router.get('/discussions', asyncHandler(async (req, res) => {
  // Search (content / user / lesson), status filter (active|deleted|all) and
  // pagination so moderation isn't limited to the most recent 200 comments.
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || 'all').toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const conds = [];
  const params = [];
  if (status === 'active') conds.push('d.is_deleted = FALSE');
  else if (status === 'deleted') conds.push('d.is_deleted = TRUE');
  if (q) {
    params.push('%' + q + '%');
    const p = `$${params.length}`;
    conds.push(`(d.content ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR l.title ILIKE ${p})`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const totalRes = await query(
    `SELECT COUNT(*)::int AS n FROM discussions d
       JOIN users u ON u.id = d.user_id JOIN lessons l ON l.id = d.lesson_id ${where}`,
    params
  );
  const listParams = params.slice();
  listParams.push(limit, offset);
  const result = await query(
    `SELECT d.id, d.lesson_id, d.parent_id, d.content, d.is_admin_reply, d.is_deleted,
            d.created_at, d.user_id, u.full_name, u.email, u.avatar_url,
            l.title AS lesson_title
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     JOIN lessons l ON l.id = d.lesson_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  res.json({ discussions: result.rows, total: totalRes.rows[0].n });
}));

// Restore a soft-deleted comment (admin moderation undo).
router.post('/discussions/:id/restore', asyncHandler(async (req, res) => {
  const r = await query(
    `UPDATE discussions SET is_deleted = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

// ===== KANJI ITEMS (Daftar Kanji di main site) =====
// Terpisah dari PWA app/kanji.html (yang punya KD[] hardcoded). Source of
// truth = tabel kanji_items. Pola mirror module_vocabulary admin endpoints.

const KANJI_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
function normalizeKanjiLevel(value) {
  const v = String(value || '').toUpperCase();
  return KANJI_LEVELS.includes(v) ? v : 'N5';
}
function validateKanjiCompounds(value, character = '') {
  if (!Array.isArray(value)) return { items: [], error: null };
  const target = String(character || '').trim();
  const items = [];
  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const item = {
      japanese: String(value[i]?.japanese || '').trim(),
      reading: String(value[i]?.reading || '').trim(),
      indonesian: String(value[i]?.indonesian || '').trim(),
    };
    if (!item.japanese && !item.reading && !item.indonesian) continue;
    if (!item.japanese || !item.reading || !item.indonesian) {
      return { items: [], error: `Kata #${i + 1}: kata, bacaan, dan arti wajib diisi lengkap` };
    }
    if (target && !item.japanese.includes(target)) {
      return { items: [], error: `Kata #${i + 1} harus mengandung kanji ${target}` };
    }
    const key = `${item.japanese.toLowerCase()}::${item.reading.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return { items, error: null };
}

// List kanji per pelajaran. Lesson scope dipake admin "Kelola Kanji"
// (mirror "Kelola Deck"). Kanji jadi jenis pelajaran (lessons.type =
// 'kanji'), bukan tab admin global.
router.get('/lessons/:lessonId/kanji', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT k.id, k.character, k.jlpt_level, k.on_reading, k.kun_reading,
            k.meaning_id, k.mnemonic, k.compounds, k.stroke_count, k.bab_kode,
            k.sort_order, l.module_id, m.sort_order AS module_sort,
            c.slug AS course_slug, c.level AS course_level
       FROM kanji_items k
       JOIN lessons l ON l.id = k.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE k.lesson_id = $1
      ORDER BY k.sort_order ASC, k.character ASC`,
    [req.params.lessonId]
  );
  if (result.rows.length === 0) return res.json({ kanji: [] });

  const context = result.rows[0];
  const [vocab, kanjiCatalog] = await Promise.all([
    loadCourseVocab(context.course_slug),
    loadKanjiCatalog(),
  ]);
  const kanji = result.rows.map((row) => ({
    id: row.id,
    character: row.character,
    jlpt_level: row.jlpt_level,
    on_reading: row.on_reading,
    kun_reading: row.kun_reading,
    meaning_id: row.meaning_id,
    mnemonic: row.mnemonic,
    compounds: row.compounds,
    usages: deriveCompounds(row.character, row.compounds, vocab, {
      moduleId: row.module_id,
      moduleSort: row.module_sort,
      courseLevel: row.course_level,
      kanjiCatalog,
    }),
    stroke_count: row.stroke_count,
    bab_kode: row.bab_kode,
    sort_order: row.sort_order,
  }));
  res.json({ kanji });
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
  const compoundValidation = validateKanjiCompounds(compounds, ch);
  if (compoundValidation.error) return res.status(400).json({ error: compoundValidation.error });
  const safeCompounds = compoundValidation.items;
  const result = await query(
    `INSERT INTO kanji_items (
       lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id,
       mnemonic, compounds, stroke_count, bab_kode, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (character, jlpt_level, lesson_id) DO UPDATE SET
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
  invalidateKanjiCatalogCache();
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
  const compoundValidation = validateKanjiCompounds(compounds, ch);
  if (compoundValidation.error) return res.status(400).json({ error: compoundValidation.error });
  const safeCompounds = compoundValidation.items;
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
  invalidateKanjiCatalogCache();
  res.json({ kanji: result.rows[0] });
}));

router.delete('/kanji/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM kanji_items WHERE id = $1`, [req.params.id]);
  invalidateKanjiCatalogCache();
  res.json({ ok: true });
}));

// Pindahkan kanji ke pelajaran lain TANPA menyentuh field lain. Dipakai oleh
// board drag "Atur Kartu". PUT /kanji/:id meng-null-kan on/kun/meaning/mnemonic/
// stroke/bab_kode saat tidak dikirim, jadi tidak aman untuk move parsial.
router.post('/kanji/:id/move', asyncHandler(async (req, res) => {
  const { targetLessonId, sortOrder } = req.body || {};
  if (!targetLessonId) return res.status(400).json({ error: 'targetLessonId required' });
  const r = await query(
    `UPDATE kanji_items
        SET lesson_id = $1,
            sort_order = COALESCE($2, sort_order),
            updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
    [targetLessonId, sortOrder ?? null, req.params.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  invalidateKanjiCatalogCache();
  res.json({ kanji: r.rows[0] });
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

    // Scoped by lesson_id (bukan cuma character+level) — kanji yang sama
    // dipakai di Bab lain harus dapat baris sendiri, bukan "dicuri" via
    // UPDATE lesson_id (root cause deck kanji Bab lain jadi kosong,
    // didiagnosis di migration 049/050). Unique index sudah disesuaikan
    // di migration 064.
    const existing = await query(
      `SELECT id FROM kanji_items WHERE character = $1 AND jlpt_level = $2 AND lesson_id = $3 LIMIT 1`,
      [character, level, lessonId]
    );
    if (existing.rows.length > 0) {
      await query(
        `UPDATE kanji_items SET
           on_reading = $2, kun_reading = $3, meaning_id = $4, mnemonic = $5,
           stroke_count = $6, bab_kode = COALESCE($7, bab_kode), updated_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].id, onReading, kunReading, meaningId, mnemonic, strokeCount, babKode]
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

  invalidateKanjiCatalogCache();
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
