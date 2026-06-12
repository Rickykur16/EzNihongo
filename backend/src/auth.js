import { SignJWT, jwtVerify } from 'jose';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import { query } from './db.js';

const accessSecret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email_verified) {
    throw new Error('Google email not verified');
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    googleName: payload.name || '',
    avatarUrl: payload.picture || null,
  };
}

export async function signAccessToken(userId, email) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret);
}

export async function signRefreshToken(userId, sessionId) {
  return new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(refreshSecret);
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload;
}

export async function verifyRefreshToken(token) {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Admin authz ──────────────────────────────────────────────────────────
// Admin = env ADMIN_EMAILS (bootstrap, tidak bisa dihapus dari UI) ∪ tabel
// admin_emails (migration 035, dikelola via panel admin tanpa edit .env).
// isAdminEmail() async — SEMUA call site wajib `await` (Promise itu truthy,
// lupa await = semua orang lolos cek admin).

export function listEnvAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnvAdminEmail(email) {
  return listEnvAdminEmails().includes((email || '').toLowerCase());
}

// Cache set email DB dengan TTL pendek — requireAdmin dipanggil tiap request
// admin, jangan query tiap kali. Mutasi (add/remove) memanggil invalidate.
let adminCache = { set: null, at: 0 };
const ADMIN_CACHE_TTL_MS = 15_000;

export function invalidateAdminEmailCache() {
  adminCache = { set: null, at: 0 };
}

async function dbAdminEmails() {
  if (adminCache.set && Date.now() - adminCache.at < ADMIN_CACHE_TTL_MS) {
    return adminCache.set;
  }
  try {
    const result = await query('SELECT email FROM admin_emails');
    adminCache = {
      set: new Set(result.rows.map((r) => String(r.email).toLowerCase())),
      at: Date.now(),
    };
    return adminCache.set;
  } catch {
    // DB down / tabel belum ter-migrate → fallback cache lama atau env-only.
    return adminCache.set || new Set();
  }
}

export async function isAdminEmail(email) {
  const normalized = (email || '').toLowerCase();
  if (!normalized) return false;
  if (isEnvAdminEmail(normalized)) return true;
  return (await dbAdminEmails()).has(normalized);
}
