// kanji-auth.js — JWT helpers for the Kanji PWA (app.eznihongo.com).
//
// Tokens carry `scope: 'kanji'` so a main-app eznihongo.com token can never
// be replayed against a /api/kanji-* route even though both realms share
// JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (see verifyKanjiAccessToken which
// rejects any token missing the scope claim).
//
// Google ID-token verification and generic SHA256 hashing are reused from
// ./auth.js — those are identity-agnostic and don't need duplicating.

import { SignJWT, jwtVerify } from 'jose';

const accessSecret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

const KANJI_SCOPE = 'kanji';

export async function signKanjiAccessToken(userId, email) {
  return new SignJWT({ sub: userId, email, scope: KANJI_SCOPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret);
}

export async function signKanjiRefreshToken(userId, sessionId) {
  return new SignJWT({ sub: userId, sid: sessionId, scope: KANJI_SCOPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(refreshSecret);
}

export async function verifyKanjiAccessToken(token) {
  const { payload } = await jwtVerify(token, accessSecret);
  if (payload.scope !== KANJI_SCOPE) throw new Error('wrong_scope');
  return payload;
}

export async function verifyKanjiRefreshToken(token) {
  const { payload } = await jwtVerify(token, refreshSecret);
  if (payload.scope !== KANJI_SCOPE) throw new Error('wrong_scope');
  return payload;
}
