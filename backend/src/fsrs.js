// FSRS-5 — the scheduler memorisation apps actually use (Anki et al).
//
// Written from the published FSRS-5 specification, NOT ported from
// `app/fsrs.js`. That file (Kanji PWA) claims FSRS v5 but its difficulty
// update is wrong: it computes `w6*D0(3) + (1-w6)*(D - w7*(G-3))`, which
// swaps the roles of w6/w7, drops the linear damping, and anchors mean
// reversion on D0(3) instead of D0(4). Because its w6 > 1 the reversion
// coefficient goes negative and difficulty freezes near 5.31 no matter how
// the learner performs — five wrong answers in a row leave it unchanged.
// That kills per-item adaptation, which is the whole point of FSRS. The
// Kanji PWA still runs on that file; fixing it would reschedule every kanji
// card already in flight, so it is deliberately left alone here.
//
// Ratings are the standard 1..4 (Again / Hard / Good / Easy). This app only
// records correct/incorrect, so callers map correct -> GOOD and wrong ->
// AGAIN; w15/w16 (hard penalty / easy bonus) therefore never engage today.

export const AGAIN = 1;
export const HARD = 2;
export const GOOD = 3;
export const EASY = 4;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
// A sanity rail only. FSRS itself has no ceiling, and removing the old
// 14-day cap is the point of this module — this just stops an absurd value
// from ever reaching the database.
const MAX_INTERVAL_DAYS = 3650;

export const DEFAULT_WEIGHTS = Object.freeze([
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
]);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// R(t,S) = (1 + FACTOR * t/S)^DECAY — probability the item is still recallable
// t days after a review that left stability S.
export function retrievability(elapsedDays, stability) {
  if (!(stability > 0)) return 0;
  return Math.pow(1 + FACTOR * Math.max(0, elapsedDays) / stability, DECAY);
}

// I(r,S) = S/FACTOR * (r^(1/DECAY) - 1) — days until R decays to the desired
// retention r.
export function intervalDays(stability, desiredRetention = 0.9) {
  if (!(stability > 0)) return 1;
  const raw = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, MAX_INTERVAL_DAYS);
}

export function initialStability(rating, w = DEFAULT_WEIGHTS) {
  return Math.max(w[rating - 1], 0.1);
}

// D0(G) = w4 - e^(w5*(G-1)) + 1
export function initialDifficulty(rating, w = DEFAULT_WEIGHTS) {
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
}

// ΔD  = -w6*(G-3)
// D'  = D + ΔD*(10-D)/9        ← linear damping: hard cards resist further
//                                hardening, easy ones resist softening
// D'' = w7*D0(4) + (1-w7)*D'   ← mean reversion toward the "Easy" anchor
export function nextDifficulty(difficulty, rating, w = DEFAULT_WEIGHTS) {
  const damped = difficulty + (-w[6] * (rating - 3)) * ((10 - difficulty) / 9);
  return clamp(w[7] * initialDifficulty(EASY, w) + (1 - w[7]) * damped, 1, 10);
}

// S'r = S * (1 + e^w8 * (11-D) * S^-w9 * (e^(w10*(1-R)) - 1) * hard * easy)
export function stabilityAfterRecall(stability, difficulty, r, rating, w = DEFAULT_WEIGHTS) {
  const hard = rating === HARD ? w[15] : 1;
  const easy = rating === EASY ? w[16] : 1;
  const grown = stability * (1
    + Math.exp(w[8])
    * (11 - difficulty)
    * Math.pow(stability, -w[9])
    * (Math.exp(w[10] * (1 - r)) - 1)
    * hard * easy);
  return Math.max(grown, 0.1);
}

// S'f = w11 * D^-w12 * ((S+1)^w13 - 1) * e^(w14*(1-R))
// A lapse shrinks stability, it does not reset it: an item forgotten after
// 192 days comes back at about a week, not at day one.
export function stabilityAfterForgetting(stability, difficulty, r, w = DEFAULT_WEIGHTS) {
  const shrunk = w[11]
    * Math.pow(difficulty, -w[12])
    * (Math.pow(stability + 1, w[13]) - 1)
    * Math.exp(w[14] * (1 - r));
  return Math.max(shrunk, 0.1);
}

// S' = S * e^(w17*(G-3+w18)) — same-day repeats, where the power-law curve
// has not had time to say anything useful.
export function stabilityShortTerm(stability, rating, w = DEFAULT_WEIGHTS) {
  return Math.max(stability * Math.exp(w[17] * (rating - 3 + w[18])), 0.1);
}

export function emptyCard() {
  return { stability: 0, difficulty: 0, state: 'new', reps: 0, lapses: 0, lastReviewAt: null };
}

// Pure: `now` is injected so tests are deterministic, mirroring
// applyPracticeAttempt({ now }) in learning-foundations.js.
export function reviewCard(card, rating, { now = new Date(), weights = DEFAULT_WEIGHTS, desiredRetention = 0.9 } = {}) {
  const w = weights;
  const at = now instanceof Date ? now : new Date(now);
  const nowMs = at.getTime();
  const prior = { ...emptyCard(), ...(card || {}) };
  const state = prior.state || 'new';
  const next = {
    stability: prior.stability,
    difficulty: prior.difficulty,
    state,
    reps: prior.reps || 0,
    lapses: prior.lapses || 0,
    lastReviewAt: at.toISOString(),
  };

  const elapsedDays = prior.lastReviewAt
    ? (nowMs - new Date(prior.lastReviewAt).getTime()) / DAY_MS
    : 0;
  const r = state !== 'new' && prior.stability > 0
    ? retrievability(elapsedDays, prior.stability)
    : 0;

  const schedule = (days) => { next.dueAt = new Date(nowMs + days * DAY_MS).toISOString(); next.intervalDays = days; };
  const scheduleMinutes = (minutes) => { next.dueAt = new Date(nowMs + minutes * MINUTE_MS).toISOString(); next.intervalDays = 0; };

  if (state === 'new') {
    next.stability = initialStability(rating, w);
    next.difficulty = initialDifficulty(rating, w);
    if (rating === AGAIN || rating === HARD) {
      next.state = 'learning';
      scheduleMinutes(rating === AGAIN ? 1 : 5);
    } else {
      next.state = 'review';
      next.reps += 1;
      schedule(intervalDays(next.stability, desiredRetention));
    }
    return next;
  }

  next.difficulty = nextDifficulty(prior.difficulty || initialDifficulty(GOOD, w), rating, w);

  if (state === 'learning' || state === 'relearning') {
    if (rating === AGAIN || rating === HARD) {
      // Still in the short-term steps: same-day repeats use S'short, which is
      // what w17/w18 exist for.
      next.stability = stabilityShortTerm(prior.stability || initialStability(rating, w), rating, w);
      next.state = state;
      scheduleMinutes(rating === AGAIN ? 1 : 5);
    } else {
      next.stability = stabilityShortTerm(prior.stability || initialStability(rating, w), rating, w);
      next.state = 'review';
      next.reps += 1;
      schedule(intervalDays(next.stability, desiredRetention));
    }
    return next;
  }

  // state === 'review'
  if (rating === AGAIN) {
    next.lapses += 1;
    next.stability = stabilityAfterForgetting(prior.stability, prior.difficulty, r, w);
    next.state = 'relearning';
    scheduleMinutes(1);
    return next;
  }
  next.stability = stabilityAfterRecall(prior.stability, prior.difficulty, r, rating, w);
  next.state = 'review';
  next.reps += 1;
  schedule(intervalDays(next.stability, desiredRetention));
  return next;
}
