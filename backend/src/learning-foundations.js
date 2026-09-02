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

export function nextReviewDelayMs({ correct, streak }) {
  if (!correct) return 0;
  if (streak >= 6) return 14 * 24 * 60 * 60 * 1000;
  if (streak >= 4) return 7 * 24 * 60 * 60 * 1000;
  if (streak >= 2) return 3 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export function applyPracticeAttempt(current, { isCorrect, now = new Date() }) {
  const old = current || {};
  const attempts = Math.max(0, Number(old.attempts) || 0) + 1;
  const correct = Math.max(0, Number(old.correct) || 0) + (isCorrect ? 1 : 0);
  const streak = isCorrect ? Math.max(0, Number(old.streak) || 0) + 1 : 0;
  const seenAt = now instanceof Date ? now : new Date(now);
  const nextReviewAt = new Date(seenAt.getTime() + nextReviewDelayMs({ correct: isCorrect, streak }));
  return {
    attempts,
    correct,
    streak,
    lastSeenAt: seenAt.toISOString(),
    lastReviewedAt: seenAt.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    masteryState: masteryStateFor({ attempts, correct, streak }),
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
