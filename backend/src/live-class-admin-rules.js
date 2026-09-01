export const LIVE_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalUuid(value) { return UUID.test(String(value || '')); }

export function safeLiveUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

export function validateLiveClassFields({ courseId, title, startsAt, endsAt, meetingUrl, recordingUrl, status }) {
  const start = new Date(startsAt); const end = endsAt ? new Date(endsAt) : null;
  if (!isCanonicalUuid(courseId)) return { ok: false, error: 'invalid_courseId' };
  if (!String(title || '').trim() || String(title).trim().length > 240) return { ok: false, error: 'invalid_title' };
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'invalid_startsAt' };
  if (end && (Number.isNaN(end.getTime()) || end <= start)) return { ok: false, error: 'endsAt_must_be_after_startsAt' };
  if (!LIVE_STATUSES.has(status)) return { ok: false, error: 'invalid_status' };
  const normalizedMeetingUrl = safeLiveUrl(meetingUrl); const normalizedRecordingUrl = safeLiveUrl(recordingUrl);
  if (meetingUrl && !normalizedMeetingUrl) return { ok: false, error: 'invalid_meetingUrl' };
  if (recordingUrl && !normalizedRecordingUrl) return { ok: false, error: 'invalid_recordingUrl' };
  return { ok: true, startsAt: start.toISOString(), endsAt: end?.toISOString() || null, meetingUrl: normalizedMeetingUrl, recordingUrl: normalizedRecordingUrl };
}
