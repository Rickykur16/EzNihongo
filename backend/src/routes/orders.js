import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { query, withTransaction, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { hasCourseAccess } from '../entitlements.js';

const router = Router();
router.use(requireAuth);

// Order stays actionable (new proof can be submitted, cancellable) while in
// one of these DB-stored states AND not past expires_at. 'rejected' is
// deliberately included — rejection is not terminal, a resubmission flips
// the order back to 'awaiting_review'. Terminal states (approved, expired,
// cancelled) are never in this list.
// 3 days (bank transfer settlement + review latency) — see the order INSERT
// below, `NOW() + INTERVAL '3 days'`; kept in sync with this comment only.
const ACTIONABLE_STATUSES = ['pending_payment', 'awaiting_review', 'rejected'];

function generateOrderNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EZN-${today}-${suffix}`;
}

// 'expired' is never stored — computed at read/action time, same philosophy
// as user_enrollments.expires_at (Phase 1). A row whose DB status is still
// 'awaiting_review' but whose expires_at has passed is reported (and
// enforced) as expired without any cron sweep.
function effectiveStatus(order) {
  if (order.status === 'approved' || order.status === 'cancelled') return order.status;
  if (new Date(order.expires_at).getTime() < Date.now()) return 'expired';
  return order.status;
}

async function getBankAccounts() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'bank_transfer_accounts'`);
    const parsed = JSON.parse(r.rows[0]?.value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Admin used to learn about a new payment proof only by remembering to open
// the Pesanan tab — nothing pinged them. A Telegram bot is a one-way,
// admin-owned notification pipe: free, no credential-sharing with a third
// party (unlike a bank-mutation reader), no new dependency (fetch is
// built into Node). Same optional-env-var shape as ELEVENLABS_API_KEY in
// tts.js — unset means the feature no-ops, not that anything errors.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

// Best-effort: a Telegram outage or missing config must never fail the
// student's proof upload, so every failure is swallowed here, not thrown.
async function notifyAdminNewProof(order) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    const amount = Number(order.amount_idr) || 0;
    const text = [
      '🧾 Bukti pembayaran baru',
      `Pesanan: ${order.order_number}`,
      `Kursus: ${order.course_title_snapshot}`,
      `Nominal: Rp ${amount.toLocaleString('id-ID')}`,
      'https://eznihongo.com/admin.html',
    ].join('\n');
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text }),
    });
  } catch { /* best-effort — see comment above */ }
}

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    courseId: order.course_id,
    courseSlug: order.course_slug || null,
    courseTitle: order.course_title_snapshot,
    amountIdr: order.amount_idr,
    currency: order.currency,
    paymentProvider: order.payment_provider,
    status: effectiveStatus(order),
    expiresAt: order.expires_at,
    approvedAt: order.approved_at,
    createdAt: order.created_at,
  };
}

// Student-facing view of a payment attempt — never exposes reviewer identity.
function serializePayment(p) {
  return {
    id: p.id,
    status: p.status,
    claimedBankName: p.claimed_bank_name,
    claimedSenderName: p.claimed_sender_name,
    claimedAmountIdr: p.claimed_amount_idr,
    claimedTransferredAt: p.claimed_transferred_at,
    submittedAt: p.submitted_at,
    reviewedAt: p.reviewed_at,
    rejectionReason: p.rejection_reason,
    hasProof: !!p.proof_mime,
  };
}

async function loadOrderOr404(orderId, res) {
  const r = await query(
    `SELECT o.*, c.slug AS course_slug
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.id = $1 LIMIT 1`,
    [orderId]
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'order_not_found' });
    return null;
  }
  return r.rows[0];
}

async function requireOwnerOrAdmin(order, req, res) {
  if (order.user_id === req.user.id) return true;
  if (await isAdminEmail(req.user.email)) return true;
  res.status(403).json({ error: 'not_order_owner' });
  return false;
}

// POST /api/orders  { courseSlug }
// Creates a purchase order for a paid course, or returns the caller's
// existing open order for that course instead of duplicating it. Course
// eligibility and price are always re-derived from the DB — never trusted
// from the client.
router.post('/orders', asyncHandler(async (req, res) => {
  const courseSlug = String(req.body?.courseSlug || '').trim();
  if (!courseSlug) return res.status(400).json({ error: 'courseSlug required' });

  const courseRes = await query(
    `SELECT id, slug, title, price_idr, is_published, is_available, is_free
       FROM courses WHERE slug = $1 LIMIT 1`,
    [courseSlug]
  );
  const course = courseRes.rows[0];
  if (!course || !course.is_published) return res.status(404).json({ error: 'course_not_found' });
  if (course.is_available === false) return res.status(403).json({ error: 'course_not_available' });
  // Excludes NULL by construction — an unclassified course is neither
  // free-joinable nor purchasable until an admin explicitly sets is_free.
  if (course.is_free !== false) return res.status(403).json({ error: 'course_not_purchasable' });
  if (!course.price_idr) return res.status(500).json({ error: 'course_price_not_configured' });

  if (await hasCourseAccess(req.user.id, course.id)) {
    return res.status(409).json({ error: 'already_enrolled' });
  }

  // Critical section — locked per (user, course). Without this, two
  // concurrent requests (double-click, duplicate tab) can both pass the
  // "no existing open order" check before either INSERT commits, creating
  // two open orders for the same purchase. Same pattern as progress.js's
  // quiz/start advisory lock.
  const { order, alreadyOpen } = await withAdvisoryLock(`order:${req.user.id}:${course.id}`, async (client) => {
    const runQuery = (text, params) => client.query(text, params);

    const existing = await runQuery(
      `SELECT * FROM orders
        WHERE user_id = $1 AND course_id = $2
          AND status = ANY($3::text[]) AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, course.id, ACTIONABLE_STATUSES]
    );
    if (existing.rows.length > 0) {
      return { order: existing.rows[0], alreadyOpen: true };
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ins = await runQuery(
          `INSERT INTO orders
             (order_number, user_id, course_id, course_title_snapshot, amount_idr, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '3 days')
           RETURNING *`,
          [generateOrderNumber(), req.user.id, course.id, course.title, course.price_idr]
        );
        return { order: ins.rows[0], alreadyOpen: false };
      } catch (err) {
        if (err.code === '23505' && attempt < 2) continue; // order_number collision — retry
        throw err;
      }
    }
    throw new Error('order_number_generation_failed');
  });

  const bankAccounts = await getBankAccounts();
  res.status(alreadyOpen ? 200 : 201).json({
    order: serializeOrder({ ...order, course_slug: course.slug }),
    bankAccounts, alreadyOpen,
  });
}));

// GET /api/orders/me — caller's own order history
router.get('/orders/me', asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT o.*, c.slug AS course_slug
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: r.rows.map(serializeOrder) });
}));

// GET /api/orders/:id — owner or admin, with full payment-attempt history
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await loadOrderOr404(req.params.id, res);
  if (!order) return;
  if (!(await requireOwnerOrAdmin(order, req, res))) return;

  const payments = await query(
    `SELECT * FROM order_payments WHERE order_id = $1 ORDER BY submitted_at DESC`,
    [order.id]
  );
  const bankAccounts = ACTIONABLE_STATUSES.includes(effectiveStatus(order)) ? await getBankAccounts() : [];
  res.json({ order: serializeOrder(order), payments: payments.rows.map(serializePayment), bankAccounts });
}));

// POST /api/orders/:id/cancel — owner only, while still actionable
router.post('/orders/:id/cancel', asyncHandler(async (req, res) => {
  const order = await loadOrderOr404(req.params.id, res);
  if (!order) return;
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'not_order_owner' });

  const upd = await query(
    `UPDATE orders SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND status = ANY($2::text[]) AND expires_at > NOW()
      RETURNING *`,
    [order.id, ACTIONABLE_STATUSES]
  );
  if (upd.rows.length === 0) return res.status(409).json({ error: 'order_not_cancellable' });
  res.json({ order: serializeOrder({ ...upd.rows[0], course_slug: order.course_slug }) });
}));

// ---- Payment proof upload ----
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Only JPEG, PNG, WEBP or PDF files are allowed'));
    cb(null, true);
  },
});

const proofLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// POST /api/orders/:id/payment-proof (multipart: file=<proof>, + optional
// claimed* fields) — owner only. Student-entered claimed* fields are
// informational only for the admin's review; they never set order/payment
// status themselves.
router.post('/orders/:id/payment-proof', proofLimiter, proofUpload.single('file'),
  asyncHandler(async (req, res) => {
    const order = await loadOrderOr404(req.params.id, res);
    if (!order) return;
    if (order.user_id !== req.user.id) return res.status(403).json({ error: 'not_order_owner' });
    if (!ACTIONABLE_STATUSES.includes(effectiveStatus(order))) {
      return res.status(409).json({ error: 'order_not_open' });
    }
    if (!req.file || !req.file.buffer?.length) return res.status(400).json({ error: 'file required' });

    const claimedAmountIdr = req.body?.claimedAmountIdr ? Number(req.body.claimedAmountIdr) || null : null;
    const claimedTransferredAt = req.body?.claimedTransferredAt ? new Date(req.body.claimedTransferredAt) : null;
    if (claimedTransferredAt && Number.isNaN(claimedTransferredAt.getTime())) {
      return res.status(400).json({ error: 'invalid_claimed_transferred_at' });
    }

    const payment = await withTransaction(async (client) => {
      // A fresh submission supersedes whatever was still pending review —
      // the admin queue should only ever show the latest attempt as actionable.
      await client.query(
        `UPDATE order_payments SET status = 'superseded' WHERE order_id = $1 AND status = 'pending'`,
        [order.id]
      );
      const ins = await client.query(
        `INSERT INTO order_payments
           (order_id, status, proof_image, proof_mime, proof_filename,
            claimed_bank_name, claimed_sender_name, claimed_amount_idr, claimed_transferred_at,
            submitted_by)
         VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          order.id, req.file.buffer, req.file.mimetype, req.file.originalname || null,
          (req.body?.claimedBankName || '').trim().slice(0, 200) || null,
          (req.body?.claimedSenderName || '').trim().slice(0, 200) || null,
          claimedAmountIdr, claimedTransferredAt,
          req.user.id,
        ]
      );
      await client.query(
        `UPDATE orders SET status = 'awaiting_review', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      return ins.rows[0];
    });

    await notifyAdminNewProof(order);
    res.status(201).json({ payment: serializePayment(payment) });
  })
);

// GET /api/orders/:id/payments/:paymentId/proof — owner or admin, streamed.
// No public URL exists for this — every fetch re-checks ownership.
router.get('/orders/:id/payments/:paymentId/proof', asyncHandler(async (req, res) => {
  const order = await loadOrderOr404(req.params.id, res);
  if (!order) return;
  if (!(await requireOwnerOrAdmin(order, req, res))) return;

  const p = await query(
    `SELECT proof_image, proof_mime FROM order_payments WHERE id = $1 AND order_id = $2 LIMIT 1`,
    [req.params.paymentId, order.id]
  );
  const row = p.rows[0];
  if (!row || !row.proof_image) return res.status(404).json({ error: 'proof_not_found' });

  res.set('Content-Type', row.proof_mime || 'application/octet-stream');
  res.set('Cache-Control', 'private, no-store');
  res.send(row.proof_image);
}));

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message?.includes('allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

export default router;
