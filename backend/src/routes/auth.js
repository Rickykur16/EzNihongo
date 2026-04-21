import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import {
  verifyGoogleIdToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  isAdminEmail,
} from '../auth.js';
import { requireAuth, asyncHandler } from '../middleware.js';

const router = Router();

// Per-IP throttle on auth endpoints. Prevents brute-forcing Google token
// replay, refresh-cookie probing, and logout spam. Server trusts the first
// proxy hop (app.set('trust proxy', 1) in server.js), so req.ip reflects the
// real client IP behind nginx.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth requests, slow down' },
});

const REFRESH_COOKIE = 'ez_refresh';
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/api/auth',
  });
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    isAdmin: isAdminEmail(user.email),
  };
}

// POST /api/auth/google — exchange Google ID token for app session
// body: { credential: google_id_token, fullName?: string }
// - If user exists: login, ignore fullName
// - If new user: fullName REQUIRED (user-typed display name)
router.post('/google', authLimiter, asyncHandler(async (req, res) => {
  const { credential, fullName } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  const googleUser = await verifyGoogleIdToken(credential);

  const existing = await query(
    'SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1',
    [googleUser.googleId, googleUser.email]
  );

  let user;
  if (existing.rows.length > 0) {
    user = existing.rows[0];
    // Keep google_name + avatar fresh for audit
    await query(
      `UPDATE users SET google_name = $1, avatar_url = $2 WHERE id = $3`,
      [googleUser.googleName, googleUser.avatarUrl, user.id]
    );
  } else {
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        error: 'profile_required',
        message: 'fullName required for new signup',
        googleName: googleUser.googleName,
      });
    }
    const inserted = await query(
      `INSERT INTO users (google_id, email, google_name, full_name, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        googleUser.googleId,
        googleUser.email,
        googleUser.googleName,
        fullName.trim().slice(0, 100),
        googleUser.avatarUrl,
      ]
    );
    user = inserted.rows[0];
    // Init stats row
    await query(
      `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [user.id]
    );
  }

  // Create session
  const sessionResult = await query(
    `INSERT INTO sessions (user_id, refresh_token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)
     RETURNING id`,
    [user.id, 'pending', req.headers['user-agent'] || null, req.ip || null]
  );
  const sessionId = sessionResult.rows[0].id;

  const refreshToken = await signRefreshToken(user.id, sessionId);
  await query(
    `UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2`,
    [hashToken(refreshToken), sessionId]
  );

  const accessToken = await signAccessToken(user.id, user.email);
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user: userResponse(user) });
}));

// POST /api/auth/refresh — use refresh cookie to get new access token
router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let payload;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokenHash = hashToken(token);
  const session = await query(
    `SELECT s.*, u.email, u.full_name, u.avatar_url
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.refresh_token_hash = $2 AND s.expires_at > NOW()
     LIMIT 1`,
    [payload.sid, tokenHash]
  );

  if (session.rows.length === 0) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Session not found or expired' });
  }

  const row = session.rows[0];
  await query(`UPDATE sessions SET last_used_at = NOW() WHERE id = $1`, [row.id]);

  const accessToken = await signAccessToken(row.user_id, row.email);
  res.json({
    accessToken,
    user: {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      isAdmin: isAdminEmail(row.email),
    },
  });
}));

// POST /api/auth/logout — invalidate session
router.post('/logout', authLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const tokenHash = hashToken(token);
    await query(`DELETE FROM sessions WHERE refresh_token_hash = $1`, [tokenHash]);
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
}));

// GET /api/auth/me — current user info (via access token)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: userResponse(result.rows[0]) });
}));

export default router;
