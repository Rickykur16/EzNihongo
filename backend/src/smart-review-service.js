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
  // A session should test a memory once, not exhaust every direction for the
  // same Kana/word/Kanji back-to-back. The highest-priority due direction wins
  // this session; the remaining directions keep their own FSRS schedule and
  // can appear in a later session.
  const sessionRanked = [];
  const seenFamilies = new Set();
  for (const candidate of ranked) {
    const family = reviewFamilyKey(candidate);
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    sessionRanked.push(candidate);
  }
  if (category !== 'mixed') return sessionRanked.slice(0, max);

  // A soft 65% cap only defers an item when another category is nearly as
  // urgent.  It preserves need-driven mixes instead of an artificial 25/25/25/25.
  const out = [];
  const counts = Object.fromEntries(REVIEW_CATEGORIES.map((key) => [key, 0]));
  const softCap = Math.ceil(max * 0.65);
  for (const candidate of sessionRanked) {
    if (out.length >= max) break;
    const alternative = sessionRanked.find((row) => !out.includes(row) && row.category !== candidate.category
      && counts[row.category] < softCap && row.priority >= candidate.priority - 15);
    if (counts[candidate.category] >= softCap && alternative) continue;
    out.push(candidate);
    counts[candidate.category] += 1;
  }
  // Deferred candidates fill any remaining places; fewer than max remains valid.
  for (const candidate of sessionRanked) {
    if (out.length >= max) break;
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

// A compound word is re-derived once per kanji it contains, because
// deriveCompounds() runs per character — 学生 comes back under both 学 and 生.
// The copies carry an IDENTICAL skill but a different itemId (the kanji), so
// practice state is stored per copy: answering one leaves the other at
// attempts = 0, still due, and the same question returns. Each word therefore
// gets exactly one owner.
//
// Preference order matters. A kanji that already holds the learner's state for
// this word wins, so existing progress is never orphaned; otherwise the lowest
// baseId wins, which keeps ownership stable between sessions (the kanji query
// has no ORDER BY, so arrival order alone would not be).
export function pickCompoundOwners(entries) {
  const owners = new Map();
  for (const entry of entries || []) {
    const current = owners.get(entry.key);
    const better = !current
      || (entry.hasState && !current.hasState)
      || (entry.hasState === current.hasState && String(entry.baseId) < String(current.baseId));
    if (better) owners.set(entry.key, entry);
  }
  return owners;
}

// One word carries several directions (jp2id / id2jp / audio2id, or the four
// compound-word directions), but a lesson drill only ever asks ONE of them per
// item, and the "Tandai Selesai" gate only requires one attempt per item. So
// after finishing a lesson every remaining direction still had attempts = 0 and
// isReviewNeeded() called it due immediately — the learner answers 学生
// correctly in the lesson and Smart Review asks for 学生 again straight away,
// in a direction they were never taught. Reported as "itu saya tidak salah tapi
// muncul berkali kali".
//
// A direction the learner has never practised now waits until a direction they
// HAVE practised on the same item has reached FSRS 'review' — i.e. the memory
// actually took hold, not merely one lucky answer. An item with no history at
// all still offers exactly one direction, otherwise material practised before
// this rule existed would become permanently invisible.
export function unlockedSkills(entries) {
  const byItem = new Map();
  for (const entry of entries || []) {
    // Compound directions are stored under their owner Kanji id, so grouping
    // by itemId alone mixes every word owned by that Kanji. The encoded word
    // suffix is the actual memory family and must be scheduled independently.
    const parts = String(entry.skill || '').split(':');
    const key = entry.itemType === 'kanji' && parts[0] === 'word' && parts[2]
      ? `${entry.itemType}:${entry.itemId}:word:${parts.slice(2).join(':')}`
      : `${entry.itemType}:${entry.itemId}`;
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key).push(entry);
  }
  const out = new Set();
  for (const group of byItem.values()) {
    const practised = group.filter((entry) => entry.attempts > 0);
    for (const entry of practised) out.add(entry.key);
    if (!practised.length) {
      // Deterministic pick so the same direction is offered every session; an
      // unstable choice would keep looking "new" and defeat the whole point.
      const first = [...group].sort((a, b) => String(a.skill).localeCompare(String(b.skill)))[0];
      if (first) out.add(first.key);
      continue;
    }
    // Unlock only one new direction at a time. Opening every sibling as soon
    // as one direction reaches review made the same word return three times
    // immediately. A new sibling must itself settle into FSRS review before
    // the next direction is introduced.
    if (practised.every((entry) => entry.fsrsState === 'review')) {
      const next = group.filter((entry) => entry.attempts === 0)
        .sort((a, b) => String(a.skill).localeCompare(String(b.skill)))[0];
      if (next) out.add(next.key);
    }
  }
  return out;
}

// One pedagogical memory per session, regardless of how many directions are
// currently due. Compound words use their content identity because their state
// is stored under a Kanji owner; other categories already have stable item ids.
export function reviewFamilyKey(candidate = {}) {
  if (candidate.category === 'kanji' && candidate.word) {
    return `kanji-word:${String(candidate.word.japanese || '').trim().toLowerCase()}::${String(candidate.word.reading || '').trim().toLowerCase()}`;
  }
  return `${candidate.category || 'unknown'}:${candidate.itemId || candidate.item?.id || ''}`;
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
    const kanaKind = item.kind === 'katakana' ? 'katakana' : 'hiragana';
    const script = kanaKind === 'katakana' ? 'Katakana' : 'Hiragana';
    const characterPool = pools.kanaCharactersByKind?.[kanaKind] || [];
    const romajiPool = pools.kanaRomajiByKind?.[kanaKind] || [];
    if (candidate.skill === 'k2r') {
      prompt = item.character;
      answer = romaji;
      return { kind: 'choice', prompt, script, instruction: `Pilih bunyi ${script} yang tepat.`, ...choices(answer, romajiPool, seed) };
    }
    prompt = romaji;
    answer = item.character;
    return { kind: 'choice', prompt, script, instruction: `Pilih karakter ${script} yang tepat.`, ...choices(answer, characterPool, seed) };
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
    // Production keys are `word:<direction>:<encoded-word>`. The previous
    // startsWith('word2reading') checks never matched that shape, so all four
    // directions fell through to reading2word and rendered the same question.
    const skillParts = String(candidate.skill || '').split(':');
    const direction = skillParts[0] === 'word' ? skillParts[1] : skillParts[0];
    if (direction === 'word2reading') { prompt = word.japanese; answer = word.reading; return { kind: 'choice', prompt, instruction: 'Pilih bacaan yang tepat.', meaning: word.indonesian, ...choices(answer, pools.wordReadings, seed) }; }
    if (direction === 'word2meaning') { prompt = word.japanese; answer = word.indonesian; return { kind: 'choice', prompt, instruction: 'Pilih arti yang tepat.', ...choices(answer, pools.wordMeanings, seed) }; }
    if (direction === 'meaning2word') { prompt = word.indonesian; answer = word.japanese; return { kind: 'choice', prompt, instruction: 'Pilih kata Jepang yang tepat.', reading: word.reading, ...choices(answer, pools.words, seed) }; }
    if (direction === 'reading2word') { prompt = word.reading; answer = word.japanese; return { kind: 'choice', prompt, instruction: 'Pilih penulisan yang tepat.', meaning: word.indonesian, ...choices(answer, pools.words, seed) }; }
    return null;
  }
  return null;
}

export function publicQuestion(payload) {
  const { correctIndex, ...question } = payload;
  return question;
}
