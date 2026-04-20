import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';

const router = Router();

// GET /api/discussions/lesson/:lessonId — thread for a lesson (public)
router.get('/lesson/:lessonId', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.parent_id, d.content, d.is_admin_reply, d.created_at, d.updated_at,
            d.user_id, u.full_name, u.avatar_url
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     WHERE d.lesson_id = $1 AND d.is_deleted = FALSE
     ORDER BY d.created_at ASC`,
    [req.params.lessonId]
  );
  res.json({ discussions: result.rows });
}));

// POST /api/discussions — new top-level comment on a lesson
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { lessonId, content, parentId } = req.body || {};
  if (!lessonId || !content?.trim()) {
    return res.status(400).json({ error: 'lessonId and content required' });
  }

  if (parentId) {
    const parent = await query(
      `SELECT id, lesson_id FROM discussions WHERE id = $1 LIMIT 1`,
      [parentId]
    );
    if (parent.rows.length === 0 || parent.rows[0].lesson_id !== lessonId) {
      return res.status(400).json({ error: 'Invalid parent' });
    }
  }

  const isAdmin = isAdminEmail(req.user.email);
  const result = await query(
    `INSERT INTO discussions (lesson_id, user_id, parent_id, content, is_admin_reply)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, lesson_id, parent_id, content, is_admin_reply, created_at, user_id`,
    [lessonId, req.user.id, parentId || null, content.trim().slice(0, 5000), isAdmin]
  );
  res.status(201).json({ discussion: result.rows[0] });
}));

// DELETE /api/discussions/:id — soft delete (owner or admin)
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT user_id FROM discussions WHERE id = $1 LIMIT 1`,
    [req.params.id]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const isOwner = existing.rows[0].user_id === req.user.id;
  const isAdmin = isAdminEmail(req.user.email);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  await query(
    `UPDATE discussions SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ ok: true });
}));

export default router;
