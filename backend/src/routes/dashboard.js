import { Router } from 'express';
import { requireAuth, asyncHandler } from '../middleware.js';
import { loadDashboard } from '../dashboard-service.js';

const router = Router();
router.use(requireAuth);
router.get('/me', asyncHandler(async (req, res) => {
  const course = typeof req.query.course === 'string' ? req.query.course.trim().toLowerCase() : '';
  res.json(await loadDashboard(req.user, course));
}));
export default router;
