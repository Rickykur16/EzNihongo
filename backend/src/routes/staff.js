import { Router } from 'express';
import { query } from '../db.js';
import { verifyAccessToken, isAdminEmail } from '../auth.js';
import { asyncHandler } from '../middleware.js';
import { isCanonicalUuid } from '../live-class-admin-rules.js';
import { describeLegacyStaffAccess } from '../staff-capabilities.js';
import { staffEnabled, accessFor, allowed } from '../company-policy.js';
import { STAFF_TAB_CAPABILITIES } from '../staff-capabilities.js';

const router = Router();

// A read-only, additive endpoint. Keep this stricter principal validation local
// to staff discovery; main/kanji login, cookies and existing APIs are unchanged.
router.get('/capabilities', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Kanji shares signing secrets, but is a different identity realm. A matching
  // email alone must never grant main-app staff access (nor may a refresh JWT).
  if (payload.scope !== undefined || payload.sid !== undefined ||
      !isCanonicalUuid(payload.sub) || typeof payload.email !== 'string' || !payload.email) {
    return res.status(401).json({ error: 'Invalid staff principal' });
  }
  const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid staff principal' });
  }
  // Preserve env + DB allowlist semantics for existing administrators. No new
  // membership table, role assignment, migration, or business-data write here.
  if (!staffEnabled()) return res.json(describeLegacyStaffAccess(await isAdminEmail(user.email)));
  const access = await accessFor(user);
  if (access.isAdmin) return res.json(describeLegacyStaffAccess(true));
  const tabs = [];
  if (allowed(access,'legacy.academic')) tabs.push('courses','modules','lessons','live');
  if (allowed(access,'legacy.marketing')) tabs.push('sensei','testimonials');
  if (allowed(access,'legacy.operations')) tabs.push('users');
  if (allowed(access,'legacy.discussions')) tabs.push('discussions');
  if (allowed(access,'legacy.finance')) tabs.push('orders');
  res.json({version:1,authorizationMode:'company-rbac-v1',isAdmin:false,isStaff:access.divisions.length>0,
    tabs,capabilities:[...new Set(tabs.map(t=>STAFF_TAB_CAPABILITIES[t]))],divisions:access.divisions.map(id=>({id}))});
}));

export default router;
