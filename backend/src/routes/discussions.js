import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { requireLessonCourseAccess, requireLessonBodyCourseAccess } from '../entitlements.js';

const router = Router();
router.use(requireAuth);

const discussionWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_discussion_posts' },
});

// GET /api/discussions/lesson/:lessonId — enrolled student or admin only.
router.get('/lesson/:lessonId', requireLessonCourseAccess(), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.parent_id, d.content, d.is_admin_reply, d.created_at, d.updated_at,
            (d.user_id = $2) AS is_own, u.full_name, u.avatar_url
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     WHERE d.lesson_id = $1 AND d.is_deleted = FALSE
     ORDER BY d.created_at ASC`,
    [req.params.lessonId, req.user.id]
  );
  res.json({ discussions: result.rows });
}));

// POST /api/discussions — new top-level comment on a lesson
router.post('/', discussionWriteLimiter, requireLessonBodyCourseAccess(), asyncHandler(async (req, res) => {
  const { lessonId, content, parentId } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'lessonId and content required' });
  }

  if (parentId) {
    const parent = await query(
      `SELECT id FROM discussions
        WHERE id = $1 AND lesson_id = $2 AND is_deleted = FALSE LIMIT 1`,
      [parentId, lessonId]
    );
    if (parent.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid parent' });
    }
  }

  const isAdmin = await isAdminEmail(req.user.email);
  const result = await query(
    `INSERT INTO discussions (lesson_id, user_id, parent_id, content, is_admin_reply)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, lesson_id, parent_id, content, is_admin_reply, created_at, TRUE AS is_own`,
    [lessonId, req.user.id, parentId || null, content.trim().slice(0, 5000), isAdmin]
  );
  res.status(201).json({ discussion: result.rows[0] });
}));

// DELETE /api/discussions/:id — soft delete (owner or admin)
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'invalid_discussion_id' });
  }
  const existing = await query(
    `SELECT user_id FROM discussions WHERE id = $1 LIMIT 1`,
    [req.params.id]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const isOwner = existing.rows[0].user_id === req.user.id;
  const isAdmin = await isAdminEmail(req.user.email);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  await query(
    `UPDATE discussions SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ ok: true });
}));

export default router;
