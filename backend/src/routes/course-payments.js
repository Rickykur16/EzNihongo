import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isCanonicalUuid } from '../live-class-admin-rules.js';
import { courseMidtransConfig, validCourseMidtransSignature, createCourseMidtransCheckout, syncCourseMidtransOrder } from '../course-midtrans.js';

const router = Router();
router.post('/webhook', asyncHandler(async (req, res) => {
  const config = courseMidtransConfig();
  if (!validCourseMidtransSignature(req.body, config.serverKey)) return res.status(403).json({ error: 'bad_signature' });
  await syncCourseMidtransOrder(req.body.order_id);
  res.json({ ok: true });
}));

router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60000, limit: 12, keyGenerator: req => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false });
router.use(limiter);
router.post('/orders/:id/checkout', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid_order_id' });
  res.json(await createCourseMidtransCheckout(req.params.id, req.user.id));
}));
router.post('/orders/:id/sync', asyncHandler(async (req, res) => {
  if (!isCanonicalUuid(req.params.id)) return res.status(400).json({ error: 'invalid_order_id' });
  const order = (await query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0];
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'not_order_owner' });
  res.json(await syncCourseMidtransOrder(order.order_number));
}));
export default router;
