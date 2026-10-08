// POST /api/site-events — public, unauthenticated visit beacon (site-analytics.js
// in the site root). Best-effort: the page never waits for or shows the result.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';
import {
  RETENTION_DAYS, createVisitorHasher, deviceClass, isBot, jakartaDate, normalizeEvent, sourceLabel,
} from '../site-analytics.js';

const router = Router();
const visitorHash = createVisitorHasher();
const PRUNE_EVERY_MS = 3600_000;
let lastPrune = 0;

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

router.post('/', eventLimiter, asyncHandler(async (req, res) => {
  const event = normalizeEvent(req.body);
  if (!event) return res.status(400).json({ error: 'invalid_event' });
  const userAgent = String(req.get('user-agent') || '');
  // Bots and browsers that ask not to be tracked are acknowledged but not stored.
  if (isBot(userAgent) || req.get('sec-gpc') === '1' || req.get('dnt') === '1') return res.status(204).end();
  await query(
    `INSERT INTO site_events (kind, page, detail, referrer, utm_source, utm_medium, utm_campaign, device, visitor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [event.kind, event.page, event.detail, event.referrer, event.utmSource, event.utmMedium,
      event.utmCampaign, deviceClass(userAgent), visitorHash(req.ip, userAgent)],
  );
  if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = Date.now();
    query(`DELETE FROM site_events WHERE occurred_at < NOW() - make_interval(days => $1)`, [RETENTION_DAYS])
      .catch((err) => console.error('site_events prune failed', err.message));
  }
  res.status(204).end();
}));

export const REPORT_DAYS = [7, 30, 90];

// Every Jakarta date in the range, oldest first, so quiet days show as 0.
function dateRange(days, now = new Date()) {
  const today = Date.parse(jakartaDate(now) + 'T00:00:00Z');
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * 86400_000).toISOString().slice(0, 10));
}
const DAY = `(occurred_at AT TIME ZONE 'Asia/Jakarta')::date`;

// Read-only report for Ruang Kerja. "Pengunjung" = unique visitor hashes per
// Jakarta day, summed over the range (the salt rotates daily, so the same
// person on two days counts twice — the UI says so).
export async function siteReport(days) {
  const range = [days];
  const since = `occurred_at >= ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1)) AT TIME ZONE 'Asia/Jakarta'`;
  const visitorDays = (where = 'TRUE') =>
    `(SELECT COUNT(*)::int FROM (SELECT DISTINCT ${DAY}, visitor FROM site_events WHERE ${since} AND ${where}) v)`;
  const [totals, daily, pages, sources, campaigns, devices, consult, courses, signups] = await Promise.all([
    query(`SELECT
        (SELECT COUNT(*)::int FROM site_events WHERE ${since} AND kind = 'pageview') AS pageviews,
        ${visitorDays("kind = 'pageview'")} AS visitors,
        ${visitorDays("kind = 'pageview' AND page = 'home'")} AS home_visitors,
        ${visitorDays("kind = 'consult_open'")} AS consult_visitors,
        ${visitorDays("kind = 'wa_click'")} AS wa_visitors,
        (SELECT COUNT(*)::int FROM site_events WHERE ${since} AND kind = 'wa_click') AS wa_clicks`, range),
    query(`SELECT to_char(${DAY}, 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE kind = 'pageview')::int AS pageviews,
        COUNT(DISTINCT visitor) FILTER (WHERE kind = 'pageview')::int AS visitors,
        COUNT(*) FILTER (WHERE kind = 'wa_click')::int AS wa_clicks
      FROM site_events WHERE ${since} GROUP BY 1 ORDER BY 1`, range),
    query(`SELECT page, COUNT(*)::int AS pageviews FROM site_events
      WHERE ${since} AND kind = 'pageview' GROUP BY page ORDER BY pageviews DESC`, range),
    query(`SELECT utm_source, referrer, COUNT(*)::int AS pageviews FROM site_events
      WHERE ${since} AND kind = 'pageview' GROUP BY utm_source, referrer`, range),
    query(`SELECT utm_campaign AS campaign, COUNT(*)::int AS pageviews FROM site_events
      WHERE ${since} AND kind = 'pageview' AND utm_campaign <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, range),
    query(`SELECT device, COUNT(*)::int AS pageviews FROM site_events
      WHERE ${since} AND kind = 'pageview' GROUP BY 1 ORDER BY 2 DESC`, range),
    query(`SELECT detail AS path, COUNT(*) FILTER (WHERE kind = 'consult_open')::int AS opens,
        COUNT(*) FILTER (WHERE kind = 'wa_click')::int AS wa_clicks
      FROM site_events WHERE ${since} AND kind IN ('consult_open', 'wa_click') GROUP BY 1 ORDER BY 3 DESC, 2 DESC`, range),
    query(`SELECT detail AS slug, COUNT(*)::int AS pageviews FROM site_events
      WHERE ${since} AND kind = 'pageview' AND page = 'course' AND detail <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, range),
    query(`SELECT
        (SELECT COUNT(*)::int FROM users WHERE ${since.replaceAll('occurred_at', 'created_at')}
           AND email NOT LIKE '%@dihapus.invalid') AS signups,
        (SELECT COUNT(*)::int FROM orders WHERE status = 'approved' AND approved_at IS NOT NULL
           AND ${since.replaceAll('occurred_at', 'approved_at')}) AS paid_orders`, range),
  ]);
  const bySource = new Map();
  for (const row of sources.rows) {
    const key = sourceLabel(row.utm_source, row.referrer);
    bySource.set(key, (bySource.get(key) || 0) + row.pageviews);
  }
  const dailyByDate = new Map(daily.rows.map((r) => [r.day, r]));
  const t = totals.rows[0];
  return {
    days,
    timezone: 'Asia/Jakarta',
    totals: {
      pageviews: t.pageviews, visitors: t.visitors, waClicks: t.wa_clicks,
      signups: signups.rows[0].signups, paidOrders: signups.rows[0].paid_orders,
    },
    funnel: { homeVisitors: t.home_visitors, consultVisitors: t.consult_visitors, waVisitors: t.wa_visitors },
    daily: dateRange(days).map((date) => {
      const r = dailyByDate.get(date);
      return { date, pageviews: r?.pageviews || 0, visitors: r?.visitors || 0, waClicks: r?.wa_clicks || 0 };
    }),
    pages: pages.rows,
    sources: [...bySource].map(([source, pageviews]) => ({ source, pageviews }))
      .sort((a, b) => b.pageviews - a.pageviews || a.source.localeCompare(b.source)).slice(0, 10),
    campaigns: campaigns.rows,
    devices: devices.rows,
    consultPaths: consult.rows.map((r) => ({ path: r.path, opens: r.opens, waClicks: r.wa_clicks })),
    courses: courses.rows,
  };
}

export default router;
