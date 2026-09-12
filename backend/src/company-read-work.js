import { createHash } from 'node:crypto';
import { withTransaction } from './db.js';
import { allowed, companyEnabled, requestAccess, fail, DIVISIONS } from './company-policy.js';
import { FLOWS } from './company-work.js';
import { isCanonicalUuid } from './live-class-admin-rules.js';

const CLOSED = ['done', 'resolved', 'completed', 'published', 'measured', 'verified', 'archived'];
const ALL_STATUSES = [...new Set(Object.values(FLOWS).flatMap(flow => Object.keys(flow)))];
const RANK = "CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END";
const OPEN = `w.status NOT IN (${CLOSED.map(s => `'${s}'`).join(',')})`;

function scalar(value, fallback = '') {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string') throw fail(400, 'invalid_work_filter');
  return value;
}
function choice(value, choices, fallback = '') {
  const result = scalar(value, fallback);
  if (result && !choices.includes(result)) throw fail(400, 'invalid_work_filter');
  return result;
}
function integer(value, fallback, max) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) throw fail(400, 'invalid_work_page');
  const n = Number(value); if (n > max) throw fail(400, 'invalid_work_page');
  return n;
}
function utcInstant(value) {
  const text = scalar(value);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,6}Z$/.test(text) || !Number.isFinite(Date.parse(text))) throw fail(400, 'invalid_calendar_range');
  // Reject dates normalized by JS, e.g. February 30. Preserve microseconds.
  if (new Date(text).toISOString().slice(0,19) !== text.slice(0,19)) throw fail(400, 'invalid_calendar_range');
  return text;
}

export function parseWorkFilters(input, mode) {
  const keys = ['division','status','kind','priority','courseId','assignee','q','bucket','limit','cursor'];
  if (mode === 'board') keys.push('offset');
  if (mode === 'calendar') keys.push('from','to');
  if (Object.keys(input).some(k => !keys.includes(k))) throw fail(400, 'invalid_work_filter');
  const division = choice(input.division, Object.keys(DIVISIONS), mode === 'calendar' ? 'marketing' : '');
  if ((mode === 'board' && !division) || (mode === 'calendar' && division !== 'marketing')) throw fail(400, 'work_division_required');
  const courseId = scalar(input.courseId);
  if (courseId && courseId !== 'global' && !isCanonicalUuid(courseId)) throw fail(400, 'invalid_work_filter');
  const q = scalar(input.q).trim(); if (q.length > 120) throw fail(400, 'work_search_too_long');
  const filters = { division, status:choice(input.status, ALL_STATUSES), kind:choice(input.kind, Object.keys(FLOWS)),
    priority:choice(input.priority, ['urgent','high','normal','low']), courseId,
    assignee:choice(input.assignee, ['me','unassigned']), q,
    bucket:choice(input.bucket, ['all','open','mine','unassigned','review','overdue','upcoming'], mode === 'desk' ? 'open' : 'all') };
  if (mode === 'calendar') {
    filters.from = utcInstant(input.from); filters.to = utcInstant(input.to);
    const span = Date.parse(filters.to) - Date.parse(filters.from);
    if (span <= 0 || span > 32 * 86400000) throw fail(400, 'invalid_calendar_range');
  }
  const limit = integer(input.limit, 50, 100); if (limit < 1) throw fail(400, 'invalid_work_page');
  const offset = integer(input.offset, 0, 10000), cursor = scalar(input.cursor);
  if (cursor && (offset || cursor.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) throw fail(400, 'invalid_work_cursor');
  return { filters, limit, offset, cursor };
}

export function workScopes(access) {
  return Object.keys(DIVISIONS).flatMap(division => {
    const permission = 'work.' + division;
    if (allowed(access, permission)) return [{ division, global:true, courses:[] }];
    const courses = [...new Set(access.grants.filter(g => g.permission_key === permission && g.scope_type === 'course' && isCanonicalUuid(g.course_id)).map(g => g.course_id))].sort();
    return courses.length ? [{ division, global:false, courses }] : [];
  });
}
function scopeSql(scopes, params) {
  const bind = value => { params.push(value); return '$' + params.length; };
  return '(' + scopes.map(s => `(w.division_key=${bind(s.division)}${s.global ? '' : ` AND w.course_id=ANY(${bind(s.courses)}::uuid[])`})`).join(' OR ') + ')';
}
function cursorTag(mode, filters, access, scopes) {
  return createHash('sha256').update(JSON.stringify([mode, filters, access.user.id, scopes])).digest('base64url');
}
function readCursor(value, tag) {
  if (!value) return null;
  try {
    const c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (c.v !== 1 || c.tag !== tag || !Number.isInteger(c.rank) || c.rank < 0 || c.rank > 3 || !isCanonicalUuid(c.id)) throw new Error();
    utcInstant(c.time); return c;
  } catch { throw fail(400, 'invalid_work_cursor'); }
}

export async function readCompanyWork(req, mode = 'board') {
  const { filters:f, limit, offset, cursor } = parseWorkFilters(req.query, mode);
  const scopes = workScopes(req.access);
  const selected = f.division ? scopes.filter(s => s.division === f.division) : scopes;
  if (!selected.length || (f.courseId && !selected.some(s => s.global || s.courses.includes(f.courseId)))) throw fail(403, 'work_scope_required');
  const tag = cursorTag(mode, f, req.access, scopes), after = readCursor(cursor, tag);
  const params=[], conditions=[scopeSql(selected, params)];
  const bind = value => { params.push(value); return '$' + params.length; };
  for (const key of ['status','kind','priority']) if (f[key]) conditions.push(`w.${key}=${bind(f[key])}`);
  if (f.courseId) conditions.push(f.courseId === 'global' ? 'w.course_id IS NULL' : `w.course_id=${bind(f.courseId)}::uuid`);
  if (f.q) {
    const p=bind(f.q); conditions.push(`(strpos(lower(w.title),lower(${p}))>0 OR strpos(lower(w.description),lower(${p}))>0)`);
  }
  if (f.assignee === 'me' || f.bucket === 'mine') conditions.push(`w.assigned_to=${bind(req.access.user.id)}::uuid`);
  if (f.assignee === 'unassigned' || f.bucket === 'unassigned') conditions.push('w.assigned_to IS NULL');
  if (['open','mine','unassigned','overdue','upcoming'].includes(f.bucket)) conditions.push(OPEN);
  if (f.bucket === 'review') conditions.push("w.status IN ('review','testing')");
  if (f.bucket === 'overdue') conditions.push('w.scheduled_at < NOW()');
  if (f.bucket === 'upcoming') conditions.push("w.scheduled_at >= NOW() AND w.scheduled_at < NOW()+INTERVAL '168 hours'");
  if (mode === 'calendar') conditions.push(`w.scheduled_at >= ${bind(f.from)}::timestamptz AND w.scheduled_at < ${bind(f.to)}::timestamptz`);
  if (after) {
    const rank=bind(after.rank), time=bind(after.time), id=bind(after.id);
    conditions.push(mode === 'calendar'
      ? `(w.scheduled_at, ${RANK}, w.id) > (${time}::timestamptz, ${rank}::int, ${id}::uuid)`
      : `(${RANK}>${rank}::int OR (${RANK}=${rank}::int AND (w.updated_at<${time}::timestamptz OR (w.updated_at=${time}::timestamptz AND w.id>${id}::uuid))))`);
  }
  const timeColumn=mode === 'calendar' ? 'w.scheduled_at' : 'w.updated_at';
  const order=mode === 'calendar' ? `w.scheduled_at, ${RANK}, w.id` : `${RANK}, w.updated_at DESC, w.id`;
  // Keep exact PostgreSQL microseconds in the cursor; JS Date truncates them.
  const sql=`SELECT w.*, ${RANK} AS sort_rank,
    to_char(${timeColumn} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time,
    CASE WHEN o.id IS NULL THEN NULL WHEN o.status IN ('approved','cancelled') THEN o.status
      WHEN o.expires_at < NOW() THEN 'expired' ELSE o.status END AS source_payment_status
    FROM company_work_items w LEFT JOIN orders o ON o.id=w.source_order_id
    WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT ${bind(limit+1)} OFFSET ${bind(offset)}`;
  try {
    return await withTransaction(async client => {
      await client.query('SET TRANSACTION READ ONLY');
      await client.query("SET LOCAL statement_timeout='3s'");
      await client.query("SET LOCAL lock_timeout='500ms'");
      const result = await client.query(sql, params), hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0,limit), last = rows.at(-1);
      let summary;
      if (mode === 'desk') {
        const p=[], authorized=scopeSql(scopes,p); p.push(req.access.user.id);
        summary=(await client.query(`SELECT
          COUNT(*) FILTER (WHERE ${OPEN} AND w.assigned_to=$${p.length}::uuid)::int AS mine,
          COUNT(*) FILTER (WHERE ${OPEN} AND w.assigned_to IS NULL)::int AS unassigned,
          COUNT(*) FILTER (WHERE w.status IN ('review','testing'))::int AS review,
          COUNT(*) FILTER (WHERE ${OPEN} AND w.scheduled_at<NOW())::int AS overdue
          FROM company_work_items w WHERE ${authorized}`,p)).rows[0];
      }
      // No cached authorization: re-check changes before returning counts/data.
      const fresh = await requestAccess(req, client);
      if (!companyEnabled() || JSON.stringify(workScopes(fresh)) !== JSON.stringify(scopes)) throw fail(403, 'work_access_changed');
      return { items:rows.map(({sort_rank,page_time,...item})=>item), limit, offset, hasMore,
        nextCursor:hasMore ? Buffer.from(JSON.stringify({v:1,tag,rank:last.sort_rank,time:last.page_time,id:last.id})).toString('base64url') : null,
        ...(summary ? {summary,summaryScope:'all_authorized_work'} : {}),
        ...(mode === 'calendar' ? {range:{from:f.from,to:f.to}} : {}) };
    });
  } catch (error) {
    if (error.status) throw error;
    throw fail(503, 'work_list_unavailable');
  }
}
