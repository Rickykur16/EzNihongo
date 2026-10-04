// Different directions and content rows may represent the same learned subject.
// Keep their evidence independent, but wait for the latest real attempt's due
// time before offering another copy or direction of that subject.

function normalized(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
    : '';
}

const key = (...parts) => JSON.stringify(parts);

function descriptor(candidate, index) {
  const category = candidate?.category;
  const item = candidate?.item || {};
  const fallback = candidate?.itemId == null
    ? key('unidentified', index)
    : key('item', category, candidate.itemId);
  if (category === 'kana') {
    const character = normalized(item.character);
    const kind = normalized(item.kind);
    return { fallback: character && ['hiragana', 'katakana'].includes(kind)
      ? key('kana', kind, character) : fallback };
  }
  const word = category === 'kanji' ? candidate?.word
    : category === 'vocabulary' ? item : null;
  if (word) {
    const japanese = normalized(word.japanese);
    const meaning = normalized(word.indonesian);
    if (japanese && meaning) return {
      fallback, family: key(japanese, meaning), reading: normalized(word.reading),
    };
  } else if (category === 'kanji') {
    const character = normalized(item.character);
    const meaning = normalized(item.meaning_id);
    if (character && meaning) return {
      fallback: key('kanji', character, meaning),
      // Only a single-character word can also be the character question.
      family: Array.from(character).length === 1 ? key(character, meaning) : null,
      reading: '',
    };
  }
  return { fallback };
}

function timestamp(value) {
  if (value == null || value === '') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Resolve these keys against the complete content set, before hiding scheduled
// rows, so temporarily absent readings cannot make a homograph look unambiguous.
export function reviewScheduleSubjectKeys(candidates) {
  const descriptions = (candidates || []).map(descriptor);
  const readings = new Map();
  for (const entry of descriptions) {
    if (!entry.family) continue;
    if (!readings.has(entry.family)) readings.set(entry.family, new Set());
    if (entry.reading) readings.get(entry.family).add(entry.reading);
  }
  return descriptions.map(entry => {
    if (!entry.family) return entry.fallback;
    const known = readings.get(entry.family);
    // Missing readings may bridge vocabulary, compounds, and a character only
    // when the available content has no competing reading for that meaning.
    // An ambiguous row keeps its original identity; never guess a homograph.
    if (known.size > 1 && !entry.reading) return entry.fallback;
    const reading = entry.reading || [...known][0] || '';
    return key('word', entry.family, reading);
  });
}

export function filterScheduledReviewSubjects(candidates, { now = new Date() } = {}) {
  const rows = candidates || [];
  const nowMs = timestamp(now);
  if (nowMs == null) return [...rows];
  const subjects = reviewScheduleSubjectKeys(rows);
  const latest = new Map();
  rows.forEach((candidate, index) => {
    const state = candidate?.state || {};
    if (!(Number(state.attempts ?? candidate?.attempts) > 0)) return;
    const seen = timestamp(state.lastSeenAt ?? state.last_seen_at ?? candidate?.lastSeenAt);
    if (seen == null) return;
    const due = timestamp(state.nextReviewAt ?? state.next_review_at);
    const subject = subjects[index];
    const previous = latest.get(subject);
    if (!previous || seen > previous.seen) {
      latest.set(subject, { seen, due });
    } else if (seen === previous.seen) {
      // Conflicting evidence at the same instant must not postpone a failure.
      previous.due = due == null || previous.due == null ? null : Math.min(due, previous.due);
    }
  });
  return rows.filter((candidate, index) => {
    const due = latest.get(subjects[index])?.due;
    return due == null || due <= nowMs;
  });
}
