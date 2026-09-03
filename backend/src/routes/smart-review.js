import { Router } from 'express';
import { query, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { userCanAccessCourse } from '../entitlements.js';
import { isAdminEmail } from '../auth.js';
import { recordPracticeAttemptWithState } from '../practice-service.js';
import { loadMastery } from '../grammar-mastery.js';
import { deriveDrills, publicDrill, arrangeIsCorrect } from '../grammar-drills.js';
import { REVIEW_CATEGORIES, SMART_REVIEW_SOURCE, filterReviewScope, isReviewNeeded, makeReviewQuestion, pickCompoundOwners, unlockedSkills, publicQuestion, reviewPriority, selectReviewCandidates, summarizeCandidates } from '../smart-review-service.js';
import { deriveCompounds, extractKanjiCharacters, loadKanjiCatalog } from '../kanji-compounds.js';

const router = Router();
router.use(requireAuth);
const SESSION_MINUTES = 45;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Matches welcome.html's _kanjiWordKey/_kanjiWordPracticeSkill exactly so a
// Smart Review answer hydrates the existing Kanji adaptive mastery cache.
const WORD_DIRECTIONS = ['word2reading', 'word2meaning', 'meaning2word', 'reading2word'];
const wordSkill = (direction, word) => `word:${direction}:${Buffer.from(`${String(word.japanese || '').trim().toLowerCase()}::${String(word.reading || '').trim().toLowerCase()}`, 'utf8').toString('base64url')}`;
const parseDistractors = (raw) => String(raw || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 6);

function stateMap(rows) {
  const out = new Map();
  for (const row of rows) out.set(`${row.item_type}:${row.item_id}:${row.skill}`, { attempts: Number(row.attempts) || 0, correct: Number(row.correct) || 0, streak: Number(row.streak) || 0, lastSeenAt: row.last_seen_at, nextReviewAt: row.next_review_at, fsrsState: row.fsrs_state });
  return out;
}

async function accessScope(user) {
  const enrolled = await query(`SELECT course_id FROM user_enrollments WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`, [user.id]);
  const ids = new Set(enrolled.rows.map((row) => row.course_id));
  if (await isAdminEmail(user.email)) for (const row of (await query(`SELECT id FROM courses WHERE is_published = TRUE`)).rows) ids.add(row.id);
  const courseIds = [...ids];
  if (!courseIds.length) return { courseIds, completedLessonIds: [] };
  const progress = await query(`SELECT p.lesson_id FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = ANY($2::uuid[])`, [user.id, courseIds]);
  return { courseIds, completedLessonIds: progress.rows.map((row) => row.lesson_id) };
}

async function genericRows(scope) {
  if (!scope.courseIds.length || !scope.completedLessonIds.length) return { kana: [], vocabulary: [], kanji: [] };
  const args = [scope.courseIds, scope.completedLessonIds];
  const [kana, vocabulary, kanji] = await Promise.all([
    query(`SELECT DISTINCT ON (k.id) k.id, k.character, k.romaji, k.kind, lk.lesson_id, m.course_id FROM kana_items k JOIN lesson_kana_items lk ON lk.kana_id = k.id JOIN lessons l ON l.id = lk.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = ANY($1::uuid[]) AND lk.lesson_id = ANY($2::uuid[]) ORDER BY k.id, l.sort_order`, args),
    query(`SELECT DISTINCT ON (v.id) v.id, v.japanese, v.reading, v.indonesian, di.lesson_id, m.course_id FROM module_vocabulary v JOIN lesson_deck_items di ON di.vocabulary_id = v.id JOIN lessons l ON l.id = di.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = ANY($1::uuid[]) AND di.lesson_id = ANY($2::uuid[]) ORDER BY v.id, l.sort_order`, args),
    query(`SELECT k.id, k.character, k.on_reading, k.kun_reading, k.meaning_id, k.compounds, k.lesson_id, m.course_id, c.level AS course_level, m.id AS module_id, m.sort_order AS module_sort FROM kanji_items k JOIN lessons l ON l.id = k.lesson_id JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE m.course_id = ANY($1::uuid[]) AND k.lesson_id = ANY($2::uuid[])`, args),
  ]);
  // Vocabulary linked directly to a completed (non-deck) lesson is equally learned.
  const direct = await query(`SELECT DISTINCT ON (v.id) v.id, v.japanese, v.reading, v.indonesian, v.lesson_id, m.course_id FROM module_vocabulary v JOIN modules m ON m.id = v.module_id WHERE m.course_id = ANY($1::uuid[]) AND v.lesson_id = ANY($2::uuid[]) ORDER BY v.id`, args);
  const vocab = new Map(vocabulary.rows.map((row) => [row.id, row])); for (const row of direct.rows) if (!vocab.has(row.id)) vocab.set(row.id, row);
  return { kana: kana.rows, vocabulary: [...vocab.values()], kanji: kanji.rows };
}

async function grammarTaskData(lessonId) {
  const [task, module] = await Promise.all([
    query(`SELECT g.id, g.pattern, g.meaning, g.recognition_distractors, g.controlled_distractors, gi.sort_order FROM lesson_grammar_task_items gi JOIN module_grammar g ON g.id = gi.grammar_id WHERE gi.lesson_id = $1 ORDER BY gi.sort_order, g.sort_order`, [lessonId]),
    query(`SELECT g.id, g.pattern, g.meaning, g.recognition_distractors, g.controlled_distractors FROM module_grammar g JOIN lessons l ON l.module_id = g.module_id WHERE l.id = $1 ORDER BY g.sort_order, g.created_at`, [lessonId]),
  ]);
  const ids = [...new Set([...task.rows, ...module.rows].map((row) => row.id))]; if (!ids.length) return { items: [], pool: [] };
  const examples = await query(`SELECT grammar_id, japanese, highlight, indonesian FROM grammar_examples WHERE grammar_id = ANY($1::uuid[]) ORDER BY grammar_id, sort_order, created_at`, [ids]);
  const byId = new Map(); for (const row of examples.rows) { if (!byId.has(row.grammar_id)) byId.set(row.grammar_id, []); byId.get(row.grammar_id).push(row); }
  const enrich = (row) => ({ ...row, recognitionDistractors: parseDistractors(row.recognition_distractors), controlledDistractors: parseDistractors(row.controlled_distractors), examples: byId.get(row.id) || [] });
  return { items: task.rows.map(enrich), pool: module.rows.map(enrich) };
}

// Shared by the Dashboard aggregator.  Keeping this as the one source means
// the home-card counts and a started Review session always have identical
// learned-scope and due-item rules.
export async function buildReviewCandidates(user) {
  const scope = await accessScope(user); const rows = await genericRows(scope);
  const baseRows = filterReviewScope([...rows.kana.map((item) => ({ lessonId: item.lesson_id, courseId: item.course_id, category: 'kana', item })), ...rows.vocabulary.map((item) => ({ lessonId: item.lesson_id, courseId: item.course_id, category: 'vocabulary', item })), ...rows.kanji.map((item) => ({ lessonId: item.lesson_id, courseId: item.course_id, category: 'kanji', item }))], { completedLessonIds: scope.completedLessonIds, accessibleCourseIds: scope.courseIds });
  const states = stateMap((await query(`SELECT * FROM user_practice_state WHERE user_id = $1`, [user.id])).rows); const candidates = [];
  const add = (base, skill, extra = {}) => candidates.push({ ...base, itemId: base.item.id, skill, state: states.get(`${base.category}:${base.item.id}:${skill}`) || {}, ...extra });
  for (const base of baseRows) { if (base.category === 'kana') { add(base, 'k2r'); add(base, 'r2k'); } if (base.category === 'vocabulary') { add(base, 'jp2id'); add(base, 'id2jp'); add(base, 'audio2id'); } }
  const catalog = await loadKanjiCatalog(); const learnedChars = new Set(rows.kanji.map((item) => item.character));
  const kanjiBases = baseRows.filter((row) => row.category === 'kanji');
  for (const base of kanjiBases) { add(base, 'char2meaning'); add(base, 'meaning2char'); }
  // One entry per (kanji, word) pair, then a single owner per word — see
  // pickCompoundOwners(). Without this the same word is added once per kanji it
  // contains, producing an identical question tracked as two separate items.
  const wordEntries = [];
  for (const base of kanjiBases) {
    const words = deriveCompounds(base.item.character, base.item.compounds, rows.vocabulary.map((v) => ({ vocabulary_id: v.id, module_id: null, course_level: base.item.course_level, japanese: v.japanese, reading: v.reading, indonesian: v.indonesian, module_sort: 0, vocab_sort: 0 })), { courseLevel: base.item.course_level, moduleId: base.item.module_id, moduleSort: base.item.module_sort, kanjiCatalog: catalog }).filter((word) => extractKanjiCharacters(word.japanese).every((char) => learnedChars.has(char)));
    for (const word of words) wordEntries.push({ key: `${word.japanese}::${word.reading}`, baseId: base.item.id, hasState: WORD_DIRECTIONS.some((direction) => states.has(`kanji:${base.item.id}:${wordSkill(direction, word)}`)), base, word });
  }
  for (const { base, word } of pickCompoundOwners(wordEntries).values()) for (const direction of WORD_DIRECTIONS) add(base, wordSkill(direction, word), { word });
  if (scope.courseIds.length) {
    const links = await query(`SELECT DISTINCT gi.grammar_id, gi.lesson_id, m.course_id FROM lesson_grammar_task_items gi JOIN lessons l ON l.id = gi.lesson_id JOIN modules m ON m.id = l.module_id JOIN user_progress p ON p.lesson_id = l.id WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = ANY($2::uuid[])`, [user.id, scope.courseIds]);
    const mastery = await loadMastery(user.id, links.rows.map((row) => row.grammar_id)); const cache = new Map();
    for (const link of links.rows) {
      if (!cache.has(link.lesson_id)) cache.set(link.lesson_id, await grammarTaskData(link.lesson_id)); const { items, pool } = cache.get(link.lesson_id); const item = items.find((row) => row.id === link.grammar_id); if (!item) continue;
      const drills = deriveDrills(items, pool).get(item.id); const m = mastery.get(item.id); const raw = (m?.recognitionAttempts || 0) > (m?.productionAttempts || 0) ? (drills.step2 || drills.step1) : (drills.step1 || drills.step2); if (!raw) continue;
      const nextReviewAt = !m || m.state === 'UNSEEN' || m.state === 'LEARNING' || m.state === 'NEEDS_PRACTICE' || m.dueReview
        ? new Date(0).toISOString()
        : new Date(new Date(m.lastAttemptAt).getTime() + (21 * 86400000)).toISOString();
      candidates.push({ category: 'grammar', itemId: item.id, lessonId: link.lesson_id, courseId: link.course_id, skill: raw.step === 1 ? 'recognition' : 'controlled', item, grammarDrill: raw, state: { attempts: m?.attempts || 0, correct: m?.passedCount || 0, streak: 0, lastSeenAt: m?.lastAttemptAt || null, nextReviewAt }, mistakes: Math.max(0, (m?.attempts || 0) - (m?.passedCount || 0)) });
    }
  }
  const pools = {
    kanaCharactersByKind: {
      hiragana: rows.kana.filter((row) => row.kind === 'hiragana').map((row) => row.character),
      katakana: rows.kana.filter((row) => row.kind === 'katakana').map((row) => row.character),
    },
    kanaRomajiByKind: {
      hiragana: rows.kana.filter((row) => row.kind === 'hiragana').map((row) => row.romaji),
      katakana: rows.kana.filter((row) => row.kind === 'katakana').map((row) => row.romaji),
    },
    vocabJapanese: rows.vocabulary.map((row) => row.japanese),
    vocabIndonesian: rows.vocabulary.map((row) => row.indonesian),
    vocabReadingByJapanese: Object.fromEntries(rows.vocabulary.map((row) => [row.japanese, row.reading || null])),
    kanjiCharacters: rows.kanji.map((row) => row.character),
    kanjiMeanings: rows.kanji.map((row) => row.meaning_id),
    words: candidates.filter((row) => row.word).map((row) => row.word.japanese),
    wordReadings: candidates.filter((row) => row.word).map((row) => row.word.reading),
    wordMeanings: candidates.filter((row) => row.word).map((row) => row.word.indonesian),
  };
  // Gate arah-baru: arah yang belum pernah dilatih menunggu sampai arah lain
  // pada item yang sama benar-benar mantap (FSRS 'review').  Grammar punya
  // model mastery sendiri dan tidak lewat user_practice_state, jadi dilewati.
  const unlocked = unlockedSkills(candidates
    .filter((candidate) => candidate.category !== 'grammar')
    .map((candidate) => ({
      key: `${candidate.category}:${candidate.itemId}:${candidate.skill}`,
      itemType: candidate.category,
      itemId: candidate.itemId,
      skill: candidate.skill,
      attempts: Number(candidate.state?.attempts) || 0,
      fsrsState: candidate.state?.fsrsState || null,
    })));
  const gated = candidates.filter((candidate) => candidate.category === 'grammar'
    || unlocked.has(`${candidate.category}:${candidate.itemId}:${candidate.skill}`));
  return { candidates: gated.filter((candidate) => isReviewNeeded(candidate)), pools };
}

function asPublic(candidate, question) { return { category: candidate.category, itemType: candidate.category, itemId: candidate.itemId, skill: candidate.skill, lessonId: candidate.lessonId, priority: reviewPriority(candidate), question }; }

router.get('/summary', asyncHandler(async (req, res) => { const { candidates } = await buildReviewCandidates(req.user); res.json({ ...summarizeCandidates(candidates), categories: REVIEW_CATEGORIES }); }));

router.post('/sessions', asyncHandler(async (req, res) => {
  const category = String(req.body?.category || 'mixed').toLowerCase(); if (category !== 'mixed' && !REVIEW_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid_category' });
  const { candidates, pools } = await buildReviewCandidates(req.user); const selected = selectReviewCandidates(candidates, { category, limit: req.body?.limit });
  if (!selected.length) return res.json({ category, sessionId: null, questions: [], summary: summarizeCandidates(candidates) });
  const session = await withAdvisoryLock(`smart-review-session:${req.user.id}`, async (client) => {
    const created = await client.query(`INSERT INTO smart_review_sessions (user_id, category, expires_at) VALUES ($1,$2,NOW() + ($3 || ' minutes')::interval) RETURNING id, expires_at`, [req.user.id, category, String(SESSION_MINUTES)]); const questions = [];
    for (const candidate of selected) { const payload = candidate.category === 'grammar' ? candidate.grammarDrill : makeReviewQuestion(candidate, pools); if (!payload || (payload.options && payload.options.length < 2)) continue; const index = questions.length; await client.query(`INSERT INTO smart_review_session_items (session_id, question_index, item_type, item_id, skill, lesson_id, payload) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [created.rows[0].id, index, candidate.category, candidate.itemId, candidate.skill, candidate.lessonId, JSON.stringify(payload)]); questions.push(asPublic(candidate, candidate.category === 'grammar' ? publicDrill(payload) : publicQuestion(payload))); }
    return { id: created.rows[0].id, expiresAt: created.rows[0].expires_at, questions };
  });
  res.status(201).json({ category, sessionId: session.id, expiresAt: session.expiresAt, questions: session.questions, summary: summarizeCandidates(candidates) });
}));

async function lockedSessionItem(client, user, sessionId, index) {
  // FOR UPDATE OF si — Postgres refuses a plain FOR UPDATE here because
  // lessons/modules sit on the nullable side of a LEFT JOIN ("FOR UPDATE
  // cannot be applied to the nullable side of an outer join"); si is the
  // only row this handler actually updates (answered_at), so it's also the
  // only one that needs locking.
  const result = await client.query(`SELECT si.*, s.user_id, s.expires_at, m.course_id FROM smart_review_session_items si JOIN smart_review_sessions s ON s.id = si.session_id LEFT JOIN lessons l ON l.id = si.lesson_id LEFT JOIN modules m ON m.id = l.module_id WHERE si.session_id = $1 AND si.question_index = $2 FOR UPDATE OF si`, [sessionId, index]); const row = result.rows[0];
  if (!row || row.user_id !== user.id) return { error: 'session_not_found', status: 404 }; if (new Date(row.expires_at) <= new Date()) return { error: 'session_expired', status: 410 }; if (row.answered_at) return { error: 'already_answered', status: 409 };
  if (!row.lesson_id || !(await userCanAccessCourse(user, row.course_id))) return { error: 'not_enrolled', status: 403 };
  const complete = await client.query(`SELECT 1 FROM user_progress WHERE user_id = $1 AND lesson_id = $2 AND completed = TRUE`, [user.id, row.lesson_id]); if (!complete.rows.length) return { error: 'lesson_not_completed', status: 403 }; return { row };
}

router.post('/sessions/:sessionId/answers', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId; const questionIndex = Number(req.body?.questionIndex); const optionIndex = Number(req.body?.optionIndex); const order = req.body?.order;
  if (!UUID.test(sessionId) || !Number.isInteger(questionIndex) || questionIndex < 0) return res.status(400).json({ error: 'invalid_answer' });
  const result = await withAdvisoryLock(`smart-review-answer:${req.user.id}:${sessionId}:${questionIndex}`, async (client) => {
    const access = await lockedSessionItem(client, req.user, sessionId, questionIndex); if (access.error) return access; const row = access.row; const payload = row.payload; let passed;
    if (row.item_type === 'grammar') { const arrange = Array.isArray(order); if (arrange !== (payload.variant === 'arrange')) return { error: 'drill_changed', status: 409 }; passed = arrange ? arrangeIsCorrect(payload, order) : Number.isInteger(optionIndex) && optionIndex === payload.correctIndex; const value = arrange ? order.map((i) => payload.tokens[i]).filter(Boolean).join(' ') : (payload.options?.[optionIndex] || ''); const primary = passed ? null : (payload.step === 1 ? 'meaning_mismatch' : 'wrong_grammar_pattern'); await client.query(`INSERT INTO grammar_attempts (user_id, grammar_id, lesson_id, source, input_mode, sentence, correct, uses_pattern, passed, primary_error, error_types, eval_source) VALUES ($1,$2,$3,$4,'text',$5,$6,$6,$6,$7,$8,$9)`, [req.user.id, row.item_id, row.lesson_id, payload.step === 1 ? 'recognition' : 'controlled', String(value).slice(0, 200), passed, primary, primary ? [primary] : [], SMART_REVIEW_SOURCE]); }
    else { if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= (payload.options || []).length) return { error: 'invalid_option', status: 400 }; passed = optionIndex === payload.correctIndex; const state = await recordPracticeAttemptWithState(client, { userId: req.user.id, courseId: row.course_id, lessonId: row.lesson_id, itemType: row.item_type, itemId: row.item_id, skill: row.skill, isCorrect: passed, source: SMART_REVIEW_SOURCE }); await client.query(`UPDATE smart_review_session_items SET answered_at = NOW() WHERE session_id = $1 AND question_index = $2`, [sessionId, questionIndex]); return { passed, correctIndex: payload.correctIndex, state }; }
    await client.query(`UPDATE smart_review_session_items SET answered_at = NOW() WHERE session_id = $1 AND question_index = $2`, [sessionId, questionIndex]); return { passed, correctIndex: payload.correctIndex, correctOrder: payload.variant === 'arrange' ? payload.answer : undefined };
  });
  if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result);
}));

export default router;
