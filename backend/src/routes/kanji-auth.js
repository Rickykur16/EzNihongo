import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { verifyGoogleIdToken, hashToken } from '../auth.js';
import {
  signKanjiAccessToken,
  signKanjiRefreshToken,
  verifyKanjiRefreshToken,
} from '../kanji-auth.js';
import { requireKanjiAuth } from '../kanji-middleware.js';
import { asyncHandler } from '../middleware.js';

// Parallel to routes/auth.js but for app.eznihongo.com (Kanji PWA).
// Writes to kanji_users + kanji_sessions, refresh cookie is `ez_kanji_refresh`
// scoped host-only so the main-site /api/auth flow can never read it.

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth requests, slow down' },
});

const REFRESH_COOKIE = 'ez_kanji_refresh';
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Host-only cookie on purpose — we do NOT set `domain`, so browsers only send
// it back to the exact host that issued it (app.eznihongo.com when served
// through the PWA's nginx). This keeps the Kanji realm isolated even though
// the sibling /api/auth cookie uses a wildcard `.eznihongo.com` domain.
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/api/kanji-auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/kanji-auth' });
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
  };
}

// POST /api/kanji-auth/google — exchange Google ID token for PWA session.
// body: { credential, fullName? }
// - If kanji_users row exists: login, full_name update only when caller sent a new one.
// - If no row: fullName REQUIRED. On first login the user types their display
//   name even if Google already supplied one, so the PWA gets its own
//   editable copy isolated from the main site.
router.post('/google', authLimiter, asyncHandler(async (req, res) => {
  const { credential, fullName } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  const googleUser = await verifyGoogleIdToken(credential);

  const existing = await query(
    'SELECT * FROM kanji_users WHERE google_id = $1 OR email = $2 LIMIT 1',
    [googleUser.googleId, googleUser.email]
  );

  let user;
  if (existing.rows.length > 0) {
    user = existing.rows[0];
    // Keep google_name + avatar fresh; only overwrite full_name if the caller
    // sent a new one (re-login flows don't, name-edit flows do).
    if (fullName && fullName.trim()) {
      await query(
        `UPDATE kanji_users
           SET google_name = $1, avatar_url = $2, full_name = $3
         WHERE id = $4`,
        [googleUser.googleName, googleUser.avatarUrl, fullName.trim().slice(0, 100), user.id]
      );
      user.full_name = fullName.trim().slice(0, 100);
    } else {
      await query(
        `UPDATE kanji_users SET google_name = $1, avatar_url = $2 WHERE id = $3`,
        [googleUser.googleName, googleUser.avatarUrl, user.id]
      );
    }
  } else {
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        error: 'profile_required',
        message: 'fullName required for new signup',
        googleName: googleUser.googleName,
      });
    }
    const inserted = await query(
      `INSERT INTO kanji_users (google_id, email, google_name, full_name, avatar_url)
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
  }

  const sessionResult = await query(
    `INSERT INTO kanji_sessions (user_id, refresh_token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)
     RETURNING id`,
    [user.id, 'pending', req.headers['user-agent'] || null, req.ip || null]
  );
  const sessionId = sessionResult.rows[0].id;

  const refreshToken = await signKanjiRefreshToken(user.id, sessionId);
  await query(
    `UPDATE kanji_sessions SET refresh_token_hash = $1 WHERE id = $2`,
    [hashToken(refreshToken), sessionId]
  );

  const accessToken = await signKanjiAccessToken(user.id, user.email);
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user: userResponse(user) });
}));

// POST /api/kanji-auth/refresh — rotate access token from refresh cookie
router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let payload;
  try {
    payload = await verifyKanjiRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokenHash = hashToken(token);
  const session = await query(
    `SELECT s.*, u.email, u.full_name, u.avatar_url
     FROM kanji_sessions s
     JOIN kanji_users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.refresh_token_hash = $2 AND s.expires_at > NOW()
     LIMIT 1`,
    [payload.sid, tokenHash]
  );

  if (session.rows.length === 0) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Session not found or expired' });
  }

  const row = session.rows[0];
  await query(`UPDATE kanji_sessions SET last_used_at = NOW() WHERE id = $1`, [row.id]);

  const accessToken = await signKanjiAccessToken(row.user_id, row.email);
  res.json({
    accessToken,
    user: {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
    },
  });
}));

// POST /api/kanji-auth/logout — invalidate session
router.post('/logout', authLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const tokenHash = hashToken(token);
    await query(`DELETE FROM kanji_sessions WHERE refresh_token_hash = $1`, [tokenHash]);
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
}));

// GET /api/kanji-auth/me — current kanji_user
router.get('/me', requireKanjiAuth, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, full_name, avatar_url, created_at FROM kanji_users WHERE id = $1`,
    [req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: userResponse(result.rows[0]) });
}));

export default router;
