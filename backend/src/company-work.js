import { fail, DIVISIONS } from './company-policy.js';
import { isCanonicalUuid } from './live-class-admin-rules.js';

export const FLOWS = Object.freeze({
  task: { draft: ['ready','archived'], ready: ['doing','archived'], doing: ['blocked','review'], blocked: ['doing','archived'], review: ['doing','done'], done: ['ready','archived'], archived: [] },
  case: { new: ['triaged'], triaged: ['waiting','resolved'], waiting: ['triaged','resolved'], resolved: ['triaged','archived'], archived: [] },
  campaign: { draft: ['review','archived'], review: ['draft','approved'], approved: ['active','draft'], active: ['paused','completed'], paused: ['active','completed'], completed: ['archived'], archived: [] },
  content: { draft: ['review','archived'], review: ['draft','approved'], approved: ['draft','scheduled','published'], scheduled: ['draft','published'], published: ['measured','archived'], measured: ['archived'], archived: [] },
  release: { draft: ['ready','archived'], ready: ['testing'], testing: ['ready','merged'], merged: ['deployed'], deployed: ['verified'], verified: ['archived'], archived: [] },
});
export const initialStatus = kind => kind === 'case' ? 'new' : 'draft';
export function cleanText(value, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw fail(400, 'invalid_text');
  return value.trim();
}
export function safeUrl(value) {
  if (!value) return '';
  let url; try { url = new URL(value); } catch { throw fail(400, 'invalid_url'); }
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 2000) throw fail(400, 'https_url_required');
  return url.href;
}
export function optionalId(value) {
  if (!value) return null;
  if (!isCanonicalUuid(value)) throw fail(400, 'invalid_id');
  return value;
}
export function fields(body, existing = null) {
  const kind = existing?.kind || body.kind;
  const division = existing?.division_key || body.division;
  if (!Object.hasOwn(FLOWS, kind) || !Object.hasOwn(DIVISIONS, division)) throw fail(400, 'invalid_kind_or_division');
  if (['campaign','content'].includes(kind) && division !== 'marketing') throw fail(400, 'marketing_division_required');
  if (kind === 'release' && division !== 'technology') throw fail(400, 'technology_division_required');
  const pick = (key, oldKey = key, fallback = '') => body[key] === undefined ? existing?.[oldKey] ?? fallback : body[key];
  const priority = pick('priority', 'priority', 'normal');
  if (!['urgent','high','normal','low'].includes(priority)) throw fail(400, 'invalid_priority');
  const scheduled = pick('scheduledAt','scheduled_at',null);
  if (scheduled && !Number.isFinite(new Date(scheduled).getTime())) throw fail(400, 'invalid_schedule');
  const sha = cleanText(pick('releaseSha','release_sha'),40);
  if (sha && !/^[a-f0-9]{40}$/.test(sha)) throw fail(400, 'full_commit_sha_required');
  return { kind, division, title: cleanText(pick('title'),160,true), description: cleanText(pick('description'),6000),
    priority, assignedTo: optionalId(pick('assignedTo','assigned_to',null)), courseId: optionalId(pick('courseId','course_id',null)),
    linkUrl: safeUrl(pick('linkUrl','link_url')), publishedUrl: safeUrl(pick('publishedUrl','published_url')),
    releaseSha: sha, scheduledAt: scheduled ? new Date(scheduled).toISOString() : null };
}
export function validateTransition(item, next, now = Date.now()) {
  if (!FLOWS[item.kind]?.[item.status]?.includes(next)) throw fail(409, 'invalid_status_transition');
  if (next === 'scheduled' && (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= now)) throw fail(400, 'future_schedule_required');
  if (next === 'published' && !item.published_url) throw fail(400, 'published_url_required');
  if (item.kind === 'release' && ['merged','deployed','verified'].includes(next) && (!item.release_sha || !item.link_url)) {
    throw fail(400, 'release_sha_and_evidence_url_required');
  }
}
export function campaignLink(campaign, body) {
  if (campaign.kind !== 'campaign' || !campaign.link_url) throw fail(400, 'campaign_destination_required');
  const url = new URL(safeUrl(campaign.link_url));
  for (const key of ['source','medium','content']) {
    const value = cleanText(body[key] || '', 80, key !== 'content');
    if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) throw fail(400, 'utm_slug_required');
    if (value) url.searchParams.set('utm_' + key,value);
  }
  url.searchParams.set('utm_campaign', campaign.id);
  return url.href;
}
