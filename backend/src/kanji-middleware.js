// kanji-middleware.js — Bearer-token guard for the Kanji PWA realm.
// Parallel to ./middleware.js's requireAuth, but accepts only scope='kanji'
// tokens signed by signKanjiAccessToken. req.user.id refers to a kanji_users
// row, not a main-app users row.

import { verifyKanjiAccessToken } from './kanji-auth.js';

export async function requireKanjiAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = await verifyKanjiAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
