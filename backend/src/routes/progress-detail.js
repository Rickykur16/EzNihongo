import { Router } from 'express';
import { requireAuth, asyncHandler } from '../middleware.js';
import { loadProgressDetail } from '../progress-detail-service.js';
const router = Router();
router.use(requireAuth);
router.get('/me', asyncHandler(async (req, res) => {
  const data = await loadProgressDetail(req.user, String(req.query.course || '').trim().toLowerCase());
  if (data.error) return res.status(data.status || 403).json({ error: data.error });
  res.json(data);
}));
export default router;
