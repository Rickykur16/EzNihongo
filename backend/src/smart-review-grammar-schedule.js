const MINUTE = 60_000;
const DAY = 86_400_000;
const NEVER_REVIEWED = new Date(0).toISOString();

// Mastery measures confidence across attempts; it is not a due date. A correct
// first or second answer still leaves a concept LEARNING, but it must leave the
// immediate review queue. Keep the evidence and mastery unchanged, and anchor
// this schedule to the latest usable attempt rather than the time of this read.
export function deriveGrammarReviewAt(mastery) {
  const at = new Date(mastery?.lastAttemptAt || '').getTime();
  if (!(mastery?.attempts > 0) || !Number.isFinite(at)
    || typeof mastery.lastAttemptPassed !== 'boolean') return NEVER_REVIEWED;

  const confident = mastery.state === 'PROGRESSING' || mastery.state === 'MASTERED';
  const delay = mastery.lastAttemptPassed ? (confident ? 21 * DAY : DAY) : MINUTE;
  return new Date(at + delay).toISOString();
}
