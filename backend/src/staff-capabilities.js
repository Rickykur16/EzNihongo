// Navigation discovery only. Existing requireAdmin guards remain authoritative.
// Do not grant a limited staff account until every relevant API enforces RBAC.
export const STAFF_TAB_CAPABILITIES = Object.freeze({
  courses: 'curriculum.manage',
  modules: 'curriculum.manage',
  lessons: 'curriculum.manage',
  sensei: 'marketing.content.manage',
  testimonials: 'marketing.content.manage',
  users: 'students.manage',
  access: 'enrollments.manage',
  orders: 'orders.review',
  discussions: 'discussions.moderate',
  tts: 'tts.manage',
  live: 'live_classes.manage',
  ai: 'ai_settings.manage',
});

const DIVISIONS = [
  { id: 'technology', name: 'Product & Technology' },
  { id: 'academic', name: 'Academic & Learning' },
  { id: 'marketing', name: 'Growth & Marketing' },
  { id: 'operations', name: 'Student Success & Operations' },
  { id: 'finance', name: 'Finance & Business Administration' },
];

export function describeLegacyStaffAccess(isAdmin) {
  const allowed = isAdmin === true;
  return {
    version: 1,
    authorizationMode: 'legacy-admin-only',
    isAdmin: allowed,
    isStaff: allowed,
    capabilities: allowed ? [...new Set([...Object.values(STAFF_TAB_CAPABILITIES), 'admins.manage'])] : [],
    tabs: allowed ? Object.keys(STAFF_TAB_CAPABILITIES) : [],
    divisions: allowed ? DIVISIONS.map((division) => ({ ...division })) : [],
  };
}
