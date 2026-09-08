import { AGAIN, GOOD, emptyCard, reviewCard } from './fsrs.js';

// Shared, side-effect-free learning-data rules.  Keeping these rules here
// lets route tests exercise idempotency without requiring a live PostgreSQL
// instance.

export const PRACTICE_ITEM_TYPES = new Set(['kana', 'vocabulary', 'kanji']);
export const PRACTICE_SOURCES = new Set(['lesson_drill', 'smart_review', 'quiz', 'grammar_task']);

export function normalizeLegacyProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return [];
  const result = [];
  for (const [courseSlug, courseProgress] of Object.entries(progress)) {
    if (!courseProgress || typeof courseProgress !== 'object' || Array.isArray(courseProgress)) continue;
    for (const [legacyKey, completed] of Object.entries(courseProgress)) {
      if (completed !== true) continue;
      const splitAt = legacyKey.indexOf(':');
      if (splitAt < 1 || splitAt === legacyKey.length - 1) continue;
      result.push({
        courseSlug,
        moduleSlug: legacyKey.slice(0, splitAt),
        lessonSlug: legacyKey.slice(splitAt + 1),
      });
    }
  }
  return result;
}

// The lesson page still keeps a slug-keyed cache for instant/offline rendering,
// while Dashboard reads the relational user_progress table. Overlay canonical
// rows into that cache so both surfaces always use the same completion facts.
// Completion is monotonic: canonical TRUE may add a flag, never remove one.
export function mergeCanonicalLessonProgress(progress, canonicalRows) {
  const source = progress && typeof progress === 'object' && !Array.isArray(progress)
    ? progress
    : {};
  const out = {};
  for (const [courseSlug, courseProgress] of Object.entries(source)) {
    out[courseSlug] = courseProgress && typeof courseProgress === 'object' && !Array.isArray(courseProgress)
      ? { ...courseProgress }
      : {};
  }
  for (const row of canonicalRows || []) {
    const courseSlug = String(row?.course_slug || '').trim();
    const moduleSlug = String(row?.module_slug || '').trim();
    const lessonSlug = String(row?.lesson_slug || '').trim();
    if (!courseSlug || !moduleSlug || !lessonSlug) continue;
    out[courseSlug] ||= {};
    out[courseSlug][`${moduleSlug}:${lessonSlug}`] = true;
  }
  return out;
}

// Return only keys that still resolve to the current lesson catalog. This
// prevents renamed/deleted lesson slugs from living forever in the legacy
// cache and inflating the Belajar sidebar even though Dashboard correctly
// reads the relational user_progress table.
export function mergeCurrentLessonProgress(progress, catalogRows) {
  const source = progress && typeof progress === 'object' && !Array.isArray(progress)
    ? progress
    : {};
  const out = {};
  for (const row of catalogRows || []) {
    const courseSlug = String(row?.course_slug || '').trim();
    const moduleSlug = String(row?.module_slug || '').trim();
    const lessonSlug = String(row?.lesson_slug || '').trim();
    if (!courseSlug || !moduleSlug || !lessonSlug) continue;
    const key = `${moduleSlug}:${lessonSlug}`;
    const cachedCourse = source[courseSlug];
    const hasCachedValue = cachedCourse && typeof cachedCourse === 'object' && !Array.isArray(cachedCourse)
      && Object.hasOwn(cachedCourse, key);
    const cachedValue = hasCachedValue ? cachedCourse[key] : undefined;
    const value = row.completed === true || cachedValue === true ? true : cachedValue;
    if (value === undefined) continue;
    out[courseSlug] ||= {};
    out[courseSlug][key] = value;
  }
  return out;
}

export function mergeCompletionProgress(a, b) {
  const out = {};
  for (const source of [a, b]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [courseSlug, courseProgress] of Object.entries(source)) {
      if (!courseProgress || typeof courseProgress !== 'object' || Array.isArray(courseProgress)) continue;
      out[courseSlug] ||= {};
      for (const [lessonKey, value] of Object.entries(courseProgress)) {
        out[courseSlug][lessonKey] = out[courseSlug][lessonKey] === true || value === true
          ? true
          : value;
      }
    }
  }
  return out;
}

export function mergeBestQuizScores(a, b) {
  const out = {};
  for (const source of [a, b]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      out[key] = Math.max(Number(out[key]) || 0, Number(value) || 0);
    }
  }
  return out;
}

export function normalizeLegacyPracticeStat(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const attempts = Math.max(0, Math.min(1_000_000, Math.floor(Number(raw.attempts) || 0)));
  const correct = Math.min(attempts, Math.max(0, Math.min(1_000_000, Math.floor(Number(raw.correct) || 0))));
  const streak = Math.max(0, Math.min(attempts, Math.floor(Number(raw.streak) || 0)));
  const lastSeenMs = Number(raw.lastSeen);
  const lastSeenDate = Number.isFinite(lastSeenMs) && lastSeenMs > 0 ? new Date(lastSeenMs) : null;
  const lastSeenAt = lastSeenDate && Number.isFinite(lastSeenDate.getTime())
    ? lastSeenDate.toISOString()
    : null;
  return { attempts, correct, streak, lastSeenAt };
}

export function masteryStateFor({ attempts = 0, correct = 0, streak = 0 }) {
  if (!attempts) return 'new';
  // This is only a scheduling label.  The legacy UI keeps its more nuanced
  // per-direction/per-word mastery calculations, and Grammar is separate.
  return attempts >= 3 && correct / attempts >= 0.8 && streak >= 2
    ? 'mastered'
    : 'learning';
}

// Superseded by FSRS (see fsrs.js) and no longer used for scheduling.  Kept
// because its ladder is what migration 137 seeds existing rows from, and the
// tests contrast the two to prove the 14-day ceiling is gone.
export function nextReviewDelayMs({ correct, streak }) {
  if (!correct) return 0;
  if (streak >= 6) return 14 * 24 * 60 * 60 * 1000;
  if (streak >= 4) return 7 * 24 * 60 * 60 * 1000;
  if (streak >= 2) return 3 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

// Reads the FSRS card off whatever shape the caller has: snake_case straight
// from Postgres, camelCase once mapped, or the nested `fsrs` object that this
// function itself returns.  The last one matters — feeding a previous result
// back in is the natural way to chain attempts, and missing it silently
// restarts the card as new, throwing away its whole history.
function cardFrom(row) {
  const nested = row.fsrs || {};
  return {
    ...emptyCard(),
    stability: Number(row.fsrs_stability ?? row.fsrsStability ?? nested.stability) || 0,
    difficulty: Number(row.fsrs_difficulty ?? row.fsrsDifficulty ?? nested.difficulty) || 0,
    state: row.fsrs_state ?? row.fsrsState ?? nested.state ?? 'new',
    reps: Number(row.fsrs_reps ?? row.fsrsReps ?? nested.reps) || 0,
    lapses: Number(row.fsrs_lapses ?? row.fsrsLapses ?? nested.lapses) || 0,
    lastReviewAt: row.last_reviewed_at ?? row.lastReviewedAt ?? null,
  };
}

export function applyPracticeAttempt(current, { isCorrect, now = new Date() }) {
  const old = current || {};
  const attempts = Math.max(0, Number(old.attempts) || 0) + 1;
  const correct = Math.max(0, Number(old.correct) || 0) + (isCorrect ? 1 : 0);
  const streak = isCorrect ? Math.max(0, Number(old.streak) || 0) + 1 : 0;
  const seenAt = now instanceof Date ? now : new Date(now);
  // The app records only right/wrong, so the four-level FSRS grade collapses
  // to Good / Again.  attempts/correct/streak/masteryState keep their old
  // meaning — the adaptive drill UI and reviewPriority() still read them; only
  // the schedule now comes from FSRS.
  const card = reviewCard(cardFrom(old), isCorrect ? GOOD : AGAIN, { now: seenAt });
  return {
    attempts,
    correct,
    streak,
    lastSeenAt: seenAt.toISOString(),
    lastReviewedAt: seenAt.toISOString(),
    nextReviewAt: card.dueAt,
    masteryState: masteryStateFor({ attempts, correct, streak }),
    fsrs: {
      stability: card.stability,
      difficulty: card.difficulty,
      state: card.state,
      reps: card.reps,
      lapses: card.lapses,
    },
  };
}

// Import is aggregate data, so merge maxima rather than adding.  Addition
// would count the same localStorage snapshot twice on a retry.
export function mergeImportedPracticeState(current, incoming) {
  const attempts = Math.max(Number(current?.attempts) || 0, Number(incoming?.attempts) || 0);
  const correct = Math.min(attempts, Math.max(Number(current?.correct) || 0, Number(incoming?.correct) || 0));
  const incomingIsNewer = !!incoming?.lastSeenAt
    && (!current?.lastSeenAt || new Date(incoming.lastSeenAt) >= new Date(current.lastSeenAt));
  const streak = incomingIsNewer ? (Number(incoming?.streak) || 0) : (Number(current?.streak) || 0);
  const lastSeenAt = incomingIsNewer ? incoming.lastSeenAt : (current?.lastSeenAt || null);
  return {
    attempts,
    correct,
    streak: Math.min(attempts, Math.max(0, streak)),
    lastSeenAt,
    masteryState: masteryStateFor({ attempts, correct, streak }),
  };
}

export function isSafePracticeSkill(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    && /^[A-Za-z0-9:_-]+$/.test(value);
}

export function hasPracticeScopeAccess({ entitled, itemBelongsToScope }) {
  // Keep the access rule explicit and reusable: owning an ID alone never
  // grants a caller permission to create or retrieve practice evidence.
  return entitled === true && itemBelongsToScope === true;
}
