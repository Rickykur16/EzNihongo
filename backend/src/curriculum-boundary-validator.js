import { extractKanjiCharacters } from './kanji-compounds.js';

export const CURRICULUM_VALIDATOR_VERSION = 'v1';
const OPERATIONS = new Set(['audit', 'generate', 'live_write', 'publish']);
const CONTENT_TYPES = new Set([
  'grammar_dialog', 'grammar_example', 'vocabulary_example', 'dialogue_comprehension',
  'dialogue_transfer', 'dialogue_question', 'quiz_question', 'quiz', 'assessment',
  'listening', 'reading', 'listening_question', 'reading_question', 'shared_passage',
  'grammar_distractors', 'quiz_options', 'distractors',
  'kanji_compound_exploration', 'kanji_compound_assessed',
]);
const QUESTION_TYPES = new Set(['dialogue_comprehension', 'dialogue_transfer', 'dialogue_question', 'quiz_question']);
const normalize = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ja');
const hasJapanese = text => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Unified_Ideograph}]/u.test(text);
const hasKanji = text => extractKanjiCharacters(text).length > 0;
const unique = values => [...new Set(values)];
const emptyUsage = () => ({
  targetVocabulary: [], previousVocabulary: [], prerequisiteVocabulary: [],
  targetKanji: [], previousKanji: [], prerequisiteKanji: [],
  targetGrammar: [], previousGrammar: [], prerequisiteGrammar: [], auxiliary: [],
});
const sourceDetails = entry => ({
  introducedIn: entry.earliestIntroduction ?? null, sourceIds: entry.sourceIds ?? [],
  ...(entry.japanese != null ? { japanese: entry.japanese, reading: entry.reading ?? null } : {}),
  ...(entry.pattern != null ? { pattern: entry.pattern } : {}),
  ...(entry.character != null ? { character: entry.character } : {}),
});
const record = (bucket, value) => {
  if (!bucket.some(item => item.key === value.key && item.field === value.field)) bucket.push(value);
};

function decodeEntity(entity) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const key = entity.slice(1, -1);
  if (Object.hasOwn(named, key)) return named[key];
  if (/^#x[\da-f]+$/iu.test(key)) {
    const code = parseInt(key.slice(2), 16);
    return code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  }
  if (/^#\d+$/u.test(key)) {
    const code = Number(key.slice(1));
    return code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  }
  return entity;
}

/** Visible base and ruby reading keep offsets into the original UTF-16 field. */
export function extractVisibleJapanese(text) {
  const source = String(text ?? '');
  const base = { text: '', offsets: [], role: 'base' };
  const reading = { text: '', offsets: [], role: 'ruby_reading' };
  let i = 0, rtDepth = 0, hiddenDepth = 0;
  while (i < source.length) {
    if (source[i] === '<') {
      const end = source.indexOf('>', i + 1);
      if (end !== -1) {
        const tag = source.slice(i, end + 1).match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/iu);
        if (tag) {
          const closing = Boolean(tag[1]);
          const name = tag[2].toLowerCase();
          if (name === 'rt') rtDepth += closing ? -1 : 1;
          if (name === 'script' || name === 'style' || name === 'rp') hiddenDepth += closing ? -1 : 1;
          rtDepth = Math.max(0, rtDepth); hiddenDepth = Math.max(0, hiddenDepth);
          i = end + 1;
          continue;
        }
      }
    }
    const target = rtDepth ? reading : base;
    let value, end;
    if (source[i] === '&') {
      const match = source.slice(i).match(/^&(?:#x[\da-f]+|#\d+|[a-z]+);/iu);
      if (match) { value = decodeEntity(match[0]); end = i + match[0].length; }
    }
    if (value == null) { value = String.fromCodePoint(source.codePointAt(i)); end = i + value.length; }
    if (!hiddenDepth) {
      target.text += value;
      for (let j = 0; j < value.length; j++) target.offsets.push({ start: i, end });
    }
    i = end;
  }
  return [base, reading].filter(segment => segment.text && hasJapanese(segment.text));
}

const span = (segment, start, length) => ({
  start: segment.offsets[start]?.start ?? start,
  end: segment.offsets[start + length - 1]?.end ?? start + length,
});

function nfcSegment(segment) {
  const output = { text: '', offsets: [], role: segment.role };
  const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(segment.text);
  for (const grapheme of graphemes) {
    const value = grapheme.segment.normalize('NFC');
    const first = segment.offsets[grapheme.index];
    const last = segment.offsets[grapheme.index + grapheme.segment.length - 1];
    output.text += value;
    for (let index = 0; index < value.length; index++) {
      output.offsets.push({ start: first?.start ?? grapheme.index, end: last?.end ?? grapheme.index + grapheme.segment.length });
    }
  }
  return output;
}

export function validateQuestionShape(question) {
  if (!question || typeof question.prompt !== 'string' || !question.prompt.trim() ||
      !Array.isArray(question.options) || question.options.length < 3 || question.options.length > 4 ||
      question.options.some(option => typeof option !== 'string' || !option.trim()) ||
      new Set(question.options.map(normalize)).size !== question.options.length ||
      !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) {
    return [{ code: 'invalid_question_schema' }];
  }
  return [];
}

function invalidEnvelope(envelope) {
  const errors = [];
  if (!CONTENT_TYPES.has(envelope?.contentType)) errors.push({ code: 'invalid_content_type' });
  if (!OPERATIONS.has(envelope?.operation)) errors.push({ code: 'invalid_operation' });
  if (!Array.isArray(envelope?.fields) || envelope.fields.some(field =>
    !field || typeof field.path !== 'string' || !field.path || typeof field.text !== 'string')) {
    errors.push({ code: 'invalid_visible_fields' });
  }
  if (envelope?.question != null && QUESTION_TYPES.has(envelope.contentType)) errors.push(...validateQuestionShape(envelope.question));
  return errors;
}

function isMetadata(field) {
  // A client-provided language label cannot exempt visible Japanese text.
  return /(?:^|\.)(?:url|uuid|voiceId|providerId|audioCacheKey|imageUrl)$/iu.test(field.path) ||
    /^(?:https?:\/\/\S+|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/iu.test(field.text.trim());
}

function isKanaCarrier(boundary, contentType) {
  return ['quiz_question', 'quiz', 'assessment'].includes(contentType) && boundary.course?.slug === 'n5' &&
    ['assignment-bab-1-hiragana', 'assignment-bab-2-katakana'].includes(boundary.lesson?.slug);
}

function auxiliaryFor(boundary, contentType) {
  return (boundary.auxiliaryPolicy?.terms || []).filter(term =>
    (!term.courseIds?.length || term.courseIds.includes(boundary.course?.id)) &&
    (!term.contentTypes?.length || term.contentTypes.includes(contentType)));
}

function exactBoundary(text, start, length, surface) {
  const before = start ? String.fromCodePoint(text.codePointAt(start - 1)) : '';
  const after = start + length < text.length ? String.fromCodePoint(text.codePointAt(start + length)) : '';
  const delimiter = char => !char || /[\s\p{P}\p{S}]/u.test(char);
  if (delimiter(before) && delimiter(after)) return true;
  // A single explicit particle can delimit a kanji surface in a sentence.
  const particle = char => /^(?:は|が|を|に|で|へ|と|も)$/u.test(char);
  return hasKanji(surface) && (delimiter(before) || particle(before)) && (delimiter(after) || particle(after));
}

function vocabularyMatches(segments, boundary, contentType, report, carrier) {
  const available = ['target', 'previous', 'prerequisite', 'future'].flatMap(bucket =>
    (boundary[bucket]?.vocabulary || []).map(entry => ({ bucket, entry })));
  const auxiliaries = auxiliaryFor(boundary, contentType);
  const surfaces = unique([...available.map(item => normalize(item.entry.japanese)),
    ...auxiliaries.map(term => normalize(term.surface))].filter(Boolean))
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'ja'));
  let targetUsed = false;
  for (const { field, segment } of segments) {
    const matchedSegment = nfcSegment(segment);
    const text = matchedSegment.text;
    const matches = [];
    for (const surface of surfaces) {
      let at = -1;
      while ((at = text.indexOf(surface, at + 1)) !== -1) matches.push({ at, surface, length: surface.length });
    }
    matches.sort((a, b) => b.length - a.length || a.at - b.at);
    const covered = new Set();
    for (const match of matches) {
      if (Array.from({ length: match.length }, (_, n) => match.at + n).some(index => covered.has(index))) continue;
      for (let n = 0; n < match.length; n++) covered.add(match.at + n);
      const location = { field: field.path, ...span(matchedSegment, match.at, match.length) };
      const candidates = available.filter(item => normalize(item.entry.japanese) === match.surface);
      const allowed = candidates.filter(item => item.bucket !== 'future');
      const future = candidates.filter(item => item.bucket === 'future');
      const auxiliary = auxiliaries.find(term => normalize(term.surface) === match.surface);
      const confident = exactBoundary(text, match.at, match.length, match.surface);
      if (auxiliary && confident) {
        record(report.usage.auxiliary, { key: match.surface, ...location, reason: auxiliary.reason });
        continue;
      }
      if (auxiliary && !confident && !candidates.length) {
        report.warnings.push({ code: 'auxiliary_match_uncertain', value: match.surface, ...location, confidence: 'low' });
        continue;
      }
      const ambiguousSense = unique(candidates.map(item => item.entry.key)).length > 1;
      if (allowed.length) {
        for (const item of allowed) {
          const key = `${item.bucket}Vocabulary`;
          record(report.usage[key], { key: item.entry.key, value: match.surface, ...location, ...sourceDetails(item.entry) });
          if (item.bucket === 'target') targetUsed = true;
        }
        if (future.length && ambiguousSense) report.warnings.push({ code: 'ambiguous_vocabulary_sense', value: match.surface, ...location, confidence: 'low' });
      } else if (future.length) {
        if (carrier) {
          report.exceptions.push({ code: 'kana_decoding_carrier', value: match.surface, ...location });
        } else if (confident && !ambiguousSense) {
          report.violations.push({ code: 'future_vocabulary', value: match.surface, ...location,
            confidence: 'high', ...sourceDetails(future[0].entry) });
        } else report.warnings.push({ code: ambiguousSense ? 'ambiguous_vocabulary_sense' : 'future_vocabulary_uncertain',
          value: match.surface, ...location, confidence: 'low', ...sourceDetails(future[0].entry) });
      }
    }
    // Readings/homophones cannot prove the intended word or sense.
    for (const item of available.filter(candidate => candidate.bucket === 'future')) {
      const reading = normalize(item.entry.reading);
      if (!reading || reading === normalize(item.entry.japanese) || !text.includes(reading)) continue;
      const at = text.indexOf(reading);
      for (let index = 0; index < reading.length; index++) covered.add(at + index);
      if (carrier) report.exceptions.push({ code: 'kana_decoding_carrier', value: reading, field: field.path, ...span(matchedSegment, at, reading.length) });
      else report.warnings.push({ code: 'future_vocabulary_reading_ambiguous', value: reading,
        field: field.path, ...span(matchedSegment, at, reading.length), confidence: 'low', ...sourceDetails(item.entry) });
    }
    for (let at = 0; at < text.length;) {
      const value = String.fromCodePoint(text.codePointAt(at));
      const length = value.length;
      if (!hasJapanese(value) || Array.from({ length }, (_, index) => covered.has(at + index)).every(Boolean)) {
        at += length; continue;
      }
      const start = at;
      let unknown = '';
      while (at < text.length) {
        const next = String.fromCodePoint(text.codePointAt(at));
        const nextLength = next.length;
        if (!hasJapanese(next) || Array.from({ length: nextLength }, (_, index) => covered.has(at + index)).every(Boolean)) break;
        unknown += next; at += nextLength;
      }
      report.warnings.push({ code: 'lexical_coverage_unknown', value: unknown, field: field.path,
        ...span(matchedSegment, start, at - start), confidence: 'unknown' });
    }
  }
  if (contentType === 'grammar_dialog' && !targetUsed) report.warnings.push({ code: 'target_vocabulary_not_observed', confidence: 'low' });
}

function kanjiMatches(segments, boundary, report) {
  const set = bucket => new Map((boundary[bucket]?.kanji || []).map(entry => [entry.character, entry]));
  const allowed = new Map([...set('prerequisite'), ...set('previous'), ...set('target')]);
  const future = set('future');
  const target = set('target'), previous = set('previous'), prerequisite = set('prerequisite');
  for (const { field, segment } of segments) {
    const characters = new Set(extractKanjiCharacters(segment.text));
    for (let at = 0; at < segment.text.length;) {
      const char = String.fromCodePoint(segment.text.codePointAt(at));
      const length = char.length;
      if (characters.has(char)) {
        const location = { field: field.path, ...span(segment, at, length) };
        const entry = allowed.get(char);
        if (entry) {
          for (const [bucket, map] of [['targetKanji', target], ['previousKanji', previous], ['prerequisiteKanji', prerequisite]]) {
            if (map.has(char)) record(report.usage[bucket], { key: char, value: char, ...location, ...sourceDetails(map.get(char)) });
          }
        } else if (future.has(char)) report.violations.push({ code: 'future_kanji', value: char, ...location,
          confidence: 'high', ...sourceDetails(future.get(char)), suggestedKana: null });
        else report.warnings.push({ code: 'unregistered_kanji', value: char, ...location, confidence: 'unknown' });
      }
      at += length;
    }
  }
}

function grammarMatches(segments, boundary, envelope, report) {
  const locations = new Map(['target', 'previous', 'prerequisite', 'future'].flatMap(bucket =>
    (boundary[bucket]?.grammar || []).map(entry => [String(entry.sourceIds?.[0] ?? entry.key), { bucket, entry }])));
  for (const grammarId of envelope.verifiedGrammarIds || []) {
    const found = locations.get(String(grammarId));
    if (!found) { report.warnings.push({ code: 'linked_grammar_unmapped', grammarId, confidence: 'unknown' }); continue; }
    if (found.bucket === 'future') report.violations.push({ code: 'future_grammar', grammarId, confidence: 'high', ...sourceDetails(found.entry) });
    else record(report.usage[`${found.bucket}Grammar`], { key: String(grammarId), ...sourceDetails(found.entry) });
  }
  const observed = new Set();
  for (const rule of envelope.grammarSignatures || []) {
    if (!rule || rule.version !== CURRICULUM_VALIDATOR_VERSION || !rule.grammarId || !(rule.regex instanceof RegExp)) continue;
    const found = locations.get(String(rule.grammarId));
    if (!found) continue;
    for (const { field, segment } of segments) {
      const flags = rule.regex.flags.replaceAll('g', '').replaceAll('y', '');
      const match = new RegExp(rule.regex.source, flags).exec(segment.text);
      if (!match) continue;
      observed.add(String(rule.grammarId));
      const location = { field: field.path, ...span(segment, match.index, match[0].length) };
      if (found.bucket === 'future') report.violations.push({ code: 'future_grammar', grammarId: rule.grammarId,
        value: match[0], ...location, confidence: 'high', ...sourceDetails(found.entry) });
      else record(report.usage[`${found.bucket}Grammar`], { key: String(rule.grammarId), ...location, ...sourceDetails(found.entry) });
    }
  }
  for (const grammarId of envelope.focusGrammarIds || []) {
    if (!observed.has(String(grammarId)) && !(envelope.verifiedGrammarIds || []).map(String).includes(String(grammarId))) {
      report.warnings.push({ code: 'target_grammar_unverified', grammarId, confidence: 'unknown' });
    }
  }
  // Model declarations are hints, never independent high-confidence evidence.
  for (const grammarId of envelope.usedGrammarIds || []) {
    if (!observed.has(String(grammarId)) && !(envelope.verifiedGrammarIds || []).map(String).includes(String(grammarId))) {
      report.warnings.push({ code: 'model_grammar_claim_unverified', grammarId, confidence: 'unknown' });
    }
  }
}

// verifiedGrammarIds, grammarSignatures and contentIsNewOrChanged must be
// derived by the server from persisted links/content revisions, never forwarded
// from an LLM or browser request as authority.
export function validateContentAgainstBoundary(envelope) {
  const report = {
    status: 'evaluated', valid: null, boundaryFingerprint: envelope?.boundary?.boundaryFingerprint ?? null,
    validatorVersion: CURRICULUM_VALIDATOR_VERSION, violations: [], warnings: [], usage: emptyUsage(),
    integrityIssues: envelope?.boundary?.integrityIssues ?? [], exceptions: [],
    coverage: { vocabulary: 'partial', grammar: 'partial', kanji: 'character_scan' },
  };
  const schemaErrors = invalidEnvelope(envelope);
  if (schemaErrors.length) return { ...report, status: 'schema_invalid', valid: false, violations: schemaErrors };
  const boundary = envelope.boundary;
  if (!boundary) return { ...report, status: 'unavailable', valid: null, warnings: [{ code: 'boundary_unavailable' }] };
  if (boundary.status === 'context_invalid' || report.integrityIssues.some(item => item.severity === 'error')) {
    return { ...report, status: 'context_invalid', valid: null };
  }
  if (boundary.status !== 'resolved' || !['target', 'previous', 'prerequisite', 'future'].every(bucket =>
    boundary[bucket] && ['vocabulary', 'kanji', 'grammar'].every(kind => Array.isArray(boundary[bucket][kind])))) {
    return { ...report, status: 'unavailable', valid: null, warnings: [{ code: 'boundary_unavailable' }] };
  }
  if (envelope.contentType === 'kanji_compound_exploration') {
    return { ...report, status: 'not_run', valid: null,
      coverage: { vocabulary: 'exploration_policy', grammar: 'exploration_policy', kanji: 'exploration_policy' } };
  }
  const segments = envelope.fields.filter(field => !isMetadata(field)).flatMap(field =>
    extractVisibleJapanese(field.text).map(segment => ({ field, segment })));
  const carrier = isKanaCarrier(boundary, envelope.contentType);
  if (carrier) report.coverage.vocabulary = 'kana_decoding_carrier';
  vocabularyMatches(segments, boundary, envelope.contentType, report, carrier);
  kanjiMatches(segments, boundary, report);
  grammarMatches(segments, boundary, envelope, report);
  if (envelope.contentType === 'grammar_dialog' && envelope.operation !== 'audit' &&
      envelope.contentIsNewOrChanged !== false && !String(envelope.communicationGoal ?? '').trim()) {
    report.violations.push({ code: 'communication_goal_missing', confidence: 'high' });
  }
  report.valid = report.violations.length === 0;
  return report;
}
