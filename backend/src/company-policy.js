import { verifyAccessToken, isAdminEmail, listEnvAdminEmails } from './auth.js';
import { query } from './db.js';
import { isCanonicalUuid } from './live-class-admin-rules.js';
import { requireAdmin } from './middleware.js';

export const DIVISIONS = Object.freeze({ technology: 'Product & Technology', academic: 'Academic & Learning',
  marketing: 'Growth & Marketing', operations: 'Student Success & Operations', finance: 'Finance & Business Administration' });
export const ROLE_CATALOG = Object.freeze({
  technology: ['work.technology', 'legacy.technology', 'insights.technology'],
  academic: ['work.academic', 'legacy.academic', 'legacy.course_picker', 'insights.academic'],
  marketing: ['work.marketing', 'legacy.marketing', 'insights.marketing'],
  operations: ['work.operations', 'legacy.operations', 'legacy.course_picker', 'legacy.discussions', 'insights.operations'],
  finance: ['work.finance', 'legacy.finance', 'orders.proof.read', 'insights.finance'],
});
export const companyEnabled = () => process.env.COMPANY_WORKSPACE_ENABLED === 'true';
export const insightsEnabled = () => companyEnabled() && process.env.COMPANY_INSIGHTS_ENABLED === 'true';
export const staffEnabled = () => companyEnabled() && process.env.COMPANY_STAFF_ENABLED === 'true';
export function fail(status, message) { return Object.assign(new Error(message), { status }); }

export async function principal(req, client = { query }) {
  const raw = req.headers.authorization || '';
  let p;
  try { p = await verifyAccessToken(raw.startsWith('Bearer ') ? raw.slice(7) : ''); }
  catch { throw fail(401, 'invalid_staff_token'); }
  if (p.scope !== undefined || p.sid !== undefined || !isCanonicalUuid(p.sub) || typeof p.email !== 'string') {
    throw fail(401, 'invalid_staff_principal');
  }
  const { rows } = await client.query('SELECT id, email FROM users WHERE id = $1', [p.sub]);
  const u = rows[0];
  if (!u || u.email.toLowerCase() !== p.email.toLowerCase() || u.email.endsWith('@dihapus.invalid')) {
    throw fail(401, 'invalid_staff_principal');
  }
  return u;
}

export async function liveAdmin(email, client = { query }) {
  if (listEnvAdminEmails().includes(email.toLowerCase())) return true;
  const { rows } = await client.query('SELECT 1 FROM admin_emails WHERE lower(email) = lower($1)', [email]);
  return rows.length > 0;
}

export async function accessFor(user, client = { query }) {
  const isAdmin = await liveAdmin(user.email, client);
  if (isAdmin) return { user, isAdmin: true, grants: [], divisions: Object.keys(DIVISIONS) };
  if (!staffEnabled()) return { user, isAdmin: false, grants: [], divisions: [] };
  const { rows } = await client.query(`
    SELECT r.division_key, rp.permission_key, s.scope_type, s.course_id
      FROM staff_memberships m JOIN staff_roles r ON r.role_key = m.role_key
      JOIN staff_role_permissions rp ON rp.role_key = m.role_key
      JOIN staff_membership_scopes s ON s.membership_id = m.id
     WHERE m.user_id = $1 AND m.status = 'active' AND m.revoked_at IS NULL
       AND (m.expires_at IS NULL OR m.expires_at > clock_timestamp())`, [user.id]);
  // Catalog is code-owned. An accidental DB permission not in the shipped
  // catalog cannot expand an account's powers.
  const grants = rows.filter(r => ROLE_CATALOG[r.division_key]?.includes(r.permission_key));
  return { user, isAdmin: false, grants, divisions: [...new Set(grants.map(g => g.division_key))] };
}

export function allowed(access, permission, courseId = null) {
  return access.isAdmin || access.grants.some(g => g.permission_key === permission &&
    (g.scope_type === 'global' || (courseId !== null && g.scope_type === 'course' && g.course_id === courseId)));
}
export async function requestAccess(req, client = { query }) {
  return accessFor(await principal(req, client), client);
}

// All legacy handlers remain in place. The allowlist is exact, generated from
// the reviewed route inventory; new routes default to owner-only.
export async function requireCompanyAdmin(req, res, next) {
  if (!staffEnabled()) return requireAdmin(req, res, next);
  try {
    const access = await requestAccess(req);
    req.companyAccess = access;
    req.user = { id: access.user.id, email: access.user.email };
    if (access.isAdmin) return next();
    const { permissionForLegacyRoute } = await import('./company-route-policy.js');
    const permission = permissionForLegacyRoute(req.method, req.path);
    if (!permission || !allowed(access, permission)) return res.status(403).json({ error: 'staff_permission_required' });
    // Bulk replace deletes existing content. A lesson type switch is checked
    // in the actual edit transaction under its row lock (not a preflight read).
    if (permission === 'legacy.academic' && req.body?.replace) return res.status(403).json({ error: 'owner_required_for_bulk_replace' });
    res.set('Cache-Control', 'private, no-store');
    next();
  } catch (error) { next(error); }
}

// Optional branch for proof viewing only. Never broadens order ownership,
// upload, cancellation, checkout, enrollment, or the shared student auth API.
export async function canReadCompanyProof(req) {
  if (!staffEnabled()) return false;
  return allowed(await requestAccess(req), 'orders.proof.read');
}

export async function companyError(error, req, res, next) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  next(error);
}
