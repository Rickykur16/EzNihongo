import { Router } from 'express';
import { requireAuth, asyncHandler } from '../middleware.js';
import { loadEntitledLiveClasses } from '../live-class-service.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(async (req, res) => {
  const course = String(req.query.course || '').trim().toLowerCase();
  if (!course) return res.status(400).json({ error: 'course_required' });
  const data = await loadEntitledLiveClasses(req.user, course);
  if (data.error) return res.status(data.status).json({ error: data.error });
  res.json(data);
}));
export default router;
