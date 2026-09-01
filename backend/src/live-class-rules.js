export const JOIN_EARLY_MS = 15 * 60 * 1000;
export const JOIN_FALLBACK_MS = 3 * 60 * 60 * 1000;

function value(row, camel, snake) { return row?.[camel] ?? row?.[snake] ?? null; }

export function canJoinLiveClass(liveClass, now = new Date()) {
  const status = value(liveClass, 'status', 'status');
  const meetingUrl = value(liveClass, 'meetingUrl', 'meeting_url');
  const startsAt = value(liveClass, 'startsAt', 'starts_at');
  const endsAt = value(liveClass, 'endsAt', 'ends_at');
  if (status !== 'scheduled' || !meetingUrl || !startsAt) return false;
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + JOIN_FALLBACK_MS;
  const time = new Date(now).getTime();
  return Number.isFinite(start) && time >= start - JOIN_EARLY_MS && time <= end;
}

export function organizeStudentLiveClasses(liveClasses, now = new Date()) {
  const time = new Date(now).getTime();
  const upcoming = (liveClasses || []).filter((item) => {
    const startsAt = value(item, 'startsAt', 'starts_at'); const endsAt = value(item, 'endsAt', 'ends_at');
    const fallbackEnd = new Date(startsAt).getTime() + JOIN_FALLBACK_MS;
    return value(item, 'status', 'status') === 'scheduled' && Number.isFinite(fallbackEnd) && (endsAt ? new Date(endsAt).getTime() : fallbackEnd) >= time;
  }).sort((a, b) => new Date(value(a, 'startsAt', 'starts_at')) - new Date(value(b, 'startsAt', 'starts_at')));
  const recordings = (liveClasses || []).filter((item) => value(item, 'status', 'status') === 'completed' && !!value(item, 'recordingUrl', 'recording_url'))
    .sort((a, b) => new Date(value(b, 'startsAt', 'starts_at')) - new Date(value(a, 'startsAt', 'starts_at')));
  return { next: upcoming[0] || null, upcoming, recordings };
}
