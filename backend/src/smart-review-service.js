// Deterministic, content-backed Smart Review rules.  The browser only receives
// public choices; the authoritative correct choice remains in the session row.

const DAY = 86_400_000;
export const REVIEW_CATEGORIES = Object.freeze(['kana', 'vocabulary', 'kanji', 'grammar']);
export const SMART_REVIEW_SOURCE = 'smart_review';

export function reviewPriority(candidate, now = new Date()) {
  const state = candidate.state || {};
  const attempts = Number(state.attempts ?? candidate.attempts) || 0;
  const correct = Number(state.correct ?? candidate.correct) || 0;
  const streak = Number(state.streak ?? candidate.streak) || 0;
  const mistakes = Math.max(0, Number(candidate.mistakes) || (attempts - correct));
  const next = state.nextReviewAt || state.next_review_at;
  const seen = state.lastSeenAt || state.last_seen_at || candidate.lastSeenAt;
  const nowMs = new Date(now).getTime();
  const overdueDays = next ? Math.max(0, (nowMs - new Date(next).getTime()) / DAY) : 0;
  const staleDays = seen ? Math.max(0, (nowMs - new Date(seen).getTime()) / DAY) : 0;
  const accuracy = attempts ? correct / attempts : 0.5;
  // Transparent first policy: due items lead; then errors/weakness/streak,
  // then time since seen.  Unseen completed material is given a modest start.
  return Math.round(
    (next && new Date(next) <= new Date(now) ? 40 + Math.min(30, overdueDays * 3) : 0)
    + Math.round((1 - accuracy) * 25)
    + Math.min(20, mistakes * 5)
    + Math.max(0, 3 - streak) * 4
    + Math.min(10, staleDays)
    + (attempts === 0 ? 12 : 0)
  );
}

// A completed item becomes reviewable when it is new (no evidence yet) or
// its stored/reconstructed review time has arrived.  Strong items scheduled in
// the future remain out of both the home count and sessions.
export function isReviewNeeded(candidate, now = new Date()) {
  const state = candidate.state || {};
  const attempts = Number(state.attempts ?? candidate.attempts) || 0;
  const next = state.nextReviewAt || state.next_review_at;
  return attempts === 0 || !next || new Date(next) <= new Date(now);
}

export function filterReviewScope(items, { completedLessonIds, accessibleCourseIds }) {
  const lessons = new Set(completedLessonIds || []);
  const courses = new Set(accessibleCourseIds || []);
  return (items || []).filter((item) => lessons.has(item.lessonId) && courses.has(item.courseId));
}

export function summarizeCandidates(candidates) {
  const byCategory = Object.fromEntries(REVIEW_CATEGORIES.map((category) => [category, 0]));
  for (const candidate of candidates || []) if (candidate.category in byCategory) byCategory[candidate.category] += 1;
  return { total: Object.values(byCategory).reduce((sum, count) => sum + count, 0), byCategory };
}

export function selectReviewCandidates(candidates, { category = 'mixed', limit = 20 } = {}) {
  const max = Math.max(1, Math.min(20, Number(limit) || 20));
  const ranked = (candidates || [])
    .filter((candidate) => isReviewNeeded(candidate) && (category === 'mixed' || candidate.category === category))
    .map((candidate) => ({ ...candidate, priority: reviewPriority(candidate) }))
    .sort((a, b) => b.priority - a.priority
      || String(a.category).localeCompare(String(b.category))
      || String(a.itemId).localeCompare(String(b.itemId))
      || String(a.skill).localeCompare(String(b.skill)));
  if (category !== 'mixed') return ranked.slice(0, max);

  // A soft 65% cap only defers an item when another category is nearly as
  // urgent.  It preserves need-driven mixes instead of an artificial 25/25/25/25.
  const out = [];
  const counts = Object.fromEntries(REVIEW_CATEGORIES.map((key) => [key, 0]));
  const softCap = Math.ceil(max * 0.65);
  for (const candidate of ranked) {
    if (out.length >= max) break;
    const alternative = ranked.find((row) => !out.includes(row) && row.category !== candidate.category
      && counts[row.category] < softCap && row.priority >= candidate.priority - 15);
    if (counts[candidate.category] >= softCap && alternative) continue;
    out.push(candidate);
    counts[candidate.category] += 1;
  }
  // Deferred candidates fill any remaining places; fewer than max remains valid.
  for (const candidate of ranked) {
    if (out.length >= max) break;
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

function hash(value) {
  let n = 0x811c9dc5;
  for (const char of String(value)) { n ^= char.charCodeAt(0); n = Math.imul(n, 0x01000193) >>> 0; }
  return n >>> 0;
}

function ordered(values, seed) {
  return [...new Set(values.filter(Boolean))]
    .map((value, index) => ({ value, key: hash(`${seed}|${index}|${value}`) }))
    .sort((a, b) => a.key - b.key)
    .map((row) => row.value);
}

function choices(correct, pool, seed) {
  const distractors = ordered(pool.filter((value) => value !== correct), seed).slice(0, 3);
  const options = ordered([correct, ...distractors], `${seed}|options`);
  return { options, correctIndex: options.indexOf(correct) };
}

export function makeReviewQuestion(candidate, pools) {
  const item = candidate.item;
  const seed = `${candidate.category}|${candidate.itemId}|${candidate.skill}`;
  let prompt; let answer;
  if (candidate.category === 'kana') {
    const romaji = item.romaji;
    if (candidate.skill === 'k2r') { prompt = item.character; answer = romaji; return { kind: 'choice', prompt, ...choices(answer, pools.kanaRomaji, seed) }; }
    prompt = romaji; answer = item.character; return { kind: 'choice', prompt, ...choices(answer, pools.kanaCharacters, seed) };
  }
  if (candidate.category === 'vocabulary') {
    if (candidate.skill === 'jp2id') { prompt = item.japanese; answer = item.indonesian; return { kind: 'choice', prompt, reading: item.reading || null, ...choices(answer, pools.vocabIndonesian, seed) }; }
    if (candidate.skill === 'id2jp') { prompt = item.indonesian; answer = item.japanese; const question = { kind: 'choice', prompt, ...choices(answer, pools.vocabJapanese, seed) }; return { ...question, optionReadings: question.options.map((value) => pools.vocabReadingByJapanese?.[value] || null) }; }
    answer = item.indonesian; return { kind: 'choice', prompt: 'Dengarkan kata Jepang berikut.', audioText: item.japanese, ...choices(answer, pools.vocabIndonesian, seed) };
  }
  if (candidate.category === 'kanji') {
    const word = candidate.word;
    if (!word) {
      if (candidate.skill === 'char2meaning') { prompt = item.character; answer = item.meaning_id; return { kind: 'choice', prompt, ...choices(answer, pools.kanjiMeanings, seed) }; }
      prompt = item.meaning_id; answer = item.character; return { kind: 'choice', prompt, ...choices(answer, pools.kanjiCharacters, seed) };
    }
    if (candidate.skill.startsWith('word2reading')) { prompt = word.japanese; answer = word.reading; return { kind: 'choice', prompt, meaning: word.indonesian, ...choices(answer, pools.wordReadings, seed) }; }
    if (candidate.skill.startsWith('word2meaning')) { prompt = word.japanese; answer = word.indonesian; return { kind: 'choice', prompt, ...choices(answer, pools.wordMeanings, seed) }; }
    if (candidate.skill.startsWith('meaning2word')) { prompt = word.indonesian; answer = word.japanese; return { kind: 'choice', prompt, reading: word.reading, ...choices(answer, pools.words, seed) }; }
    prompt = word.reading; answer = word.japanese; return { kind: 'choice', prompt, meaning: word.indonesian, ...choices(answer, pools.words, seed) };
  }
  return null;
}

export function publicQuestion(payload) {
  const { correctIndex, ...question } = payload;
  return question;
}
