import { Router } from 'express';
import { query, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { userCanAccessCourse } from '../entitlements.js';
import {
  PRACTICE_ITEM_TYPES,
  PRACTICE_SOURCES,
  isSafePracticeSkill,
  hasPracticeScopeAccess,
  masteryStateFor,
  mergeImportedPracticeState,
  normalizeLegacyPracticeStat,
} from '../learning-foundations.js';
import { recordPracticeAttemptWithState } from '../practice-service.js';

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_SOURCE = 'welcome_local_mastery_v1';
const DIRECTIONS = {
  kana: ['k2r', 'r2k'],
  vocabulary: ['jp2id', 'id2jp', 'audio2id'],
  kanji: ['char2meaning', 'meaning2char'],
};
const KANJI_WORD_DIRECTIONS = ['word2reading', 'word2meaning', 'meaning2word', 'reading2word'];

function validUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function stateJson(row) {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    skill: row.skill,
    attempts: Number(row.attempts) || 0,
    correct: Number(row.correct) || 0,
    streak: Number(row.streak) || 0,
    lastSeenAt: row.last_seen_at || null,
    lastReviewedAt: row.last_reviewed_at || null,
    nextReviewAt: row.next_review_at || null,
    masteryState: row.mastery_state,
  };
}

async function accessibleCourseIds(user, runQuery = query) {
  const active = await runQuery(
    `SELECT course_id FROM user_enrollments
      WHERE user_id = $1 AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [user.id]
  );
  const ids = new Set(active.rows.map((r) => r.course_id));
  if (await isAdminEmail(user.email)) {
    const all = await runQuery(`SELECT id FROM courses WHERE is_published = TRUE`);
    for (const row of all.rows) ids.add(row.id);
  }
  return [...ids];
}

async function lessonScope(lessonId) {
  const result = await query(
    `SELECT l.id, m.course_id
       FROM lessons l JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1 LIMIT 1`,
    [lessonId]
  );
  return result.rows[0] || null;
}

async function assertLessonAccess(req, lessonId) {
  if (!validUuid(lessonId)) return { error: 'invalid_lesson_id', status: 400 };
  const scope = await lessonScope(lessonId);
  if (!scope) return { error: 'lesson_not_found', status: 404 };
  if (!(await userCanAccessCourse(req.user, scope.course_id))) {
    return { error: 'not_enrolled', status: 403 };
  }
  return { scope };
}

async function itemBelongsToLesson(runQuery, itemType, itemId, lessonId) {
  let result;
  if (itemType === 'kana') {
    result = await runQuery(
      `SELECT 1 FROM lesson_kana_items WHERE lesson_id = $1 AND kana_id = $2 LIMIT 1`,
      [lessonId, itemId]
    );
  } else if (itemType === 'vocabulary') {
    result = await runQuery(
      `SELECT 1
         FROM module_vocabulary v
        WHERE v.id = $2 AND (v.lesson_id = $1 OR EXISTS (
          SELECT 1 FROM lesson_deck_items di
           WHERE di.lesson_id = $1 AND di.vocabulary_id = v.id
        ))
        LIMIT 1`,
      [lessonId, itemId]
    );
  } else {
    result = await runQuery(
      `SELECT 1 FROM kanji_items WHERE id = $2 AND lesson_id = $1 LIMIT 1`,
      [lessonId, itemId]
    );
  }
  return result.rows.length > 0;
}

async function itemBelongsToCourse(runQuery, itemType, itemId, courseId) {
  let result;
  if (itemType === 'kana') {
    result = await runQuery(
      `SELECT 1 FROM lesson_kana_items lk
        JOIN lessons l ON l.id = lk.lesson_id
        JOIN modules m ON m.id = l.module_id
       WHERE lk.kana_id = $1 AND m.course_id = $2 LIMIT 1`,
      [itemId, courseId]
    );
  } else if (itemType === 'vocabulary') {
    result = await runQuery(
      `SELECT 1 FROM module_vocabulary v
        JOIN modules m ON m.id = v.module_id
       WHERE v.id = $1 AND m.course_id = $2 LIMIT 1`,
      [itemId, courseId]
    );
  } else {
    result = await runQuery(
      `SELECT 1 FROM kanji_items k
        JOIN lessons l ON l.id = k.lesson_id
        JOIN modules m ON m.id = l.module_id
       WHERE k.id = $1 AND m.course_id = $2 LIMIT 1`,
      [itemId, courseId]
    );
  }
  return result.rows.length > 0;
}

function itemsForLessonSql(itemType) {
  if (itemType === 'kana') {
    return `SELECT kana_id AS item_id FROM lesson_kana_items WHERE lesson_id = $1`;
  }
  if (itemType === 'vocabulary') {
    return `SELECT vocabulary_id AS item_id FROM lesson_deck_items WHERE lesson_id = $1
            UNION
            SELECT id AS item_id FROM module_vocabulary WHERE lesson_id = $1`;
  }
  return `SELECT id AS item_id FROM kanji_items WHERE lesson_id = $1`;
}

async function upsertImportedState(client, { userId, itemType, itemId, skill, incoming }) {
  const existing = await client.query(
    `SELECT attempts, correct, streak, last_seen_at
       FROM user_practice_state
      WHERE user_id = $1 AND item_type = $2 AND item_id = $3 AND skill = $4
      FOR UPDATE`,
    [userId, itemType, itemId, skill]
  );
  const old = existing.rows[0] && {
    attempts: existing.rows[0].attempts,
    correct: existing.rows[0].correct,
    streak: existing.rows[0].streak,
    lastSeenAt: existing.rows[0].last_seen_at
      ? new Date(existing.rows[0].last_seen_at).toISOString()
      : null,
  };
  const merged = mergeImportedPracticeState(old, incoming);
  await client.query(
    `INSERT INTO user_practice_state
       (user_id, item_type, item_id, skill, attempts, correct, streak,
        last_seen_at, last_reviewed_at, next_review_at, mastery_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,NULL,$9)
     ON CONFLICT (user_id, item_type, item_id, skill) DO UPDATE
       SET attempts = EXCLUDED.attempts,
           correct = EXCLUDED.correct,
           streak = EXCLUDED.streak,
           last_seen_at = EXCLUDED.last_seen_at,
           last_reviewed_at = EXCLUDED.last_reviewed_at,
           next_review_at = EXCLUDED.next_review_at,
           mastery_state = EXCLUDED.mastery_state,
           updated_at = NOW()`,
    [
      userId, itemType, itemId, skill, merged.attempts, merged.correct,
      merged.streak, merged.lastSeenAt, merged.masteryState,
    ]
  );
}

async function resolveLegacyIdentity(client, itemType, legacyKey, courseIds) {
  if (!courseIds.length) return null;
  const parts = String(legacyKey || '').split('::');
  let result;
  if (itemType === 'kana' && parts.length === 3) {
    result = await client.query(
      `SELECT DISTINCT k.id
         FROM kana_items k
         JOIN lesson_kana_items lk ON lk.kana_id = k.id
         JOIN lessons l ON l.id = lk.lesson_id
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ANY($1::uuid[])
          AND LOWER(BTRIM(k.kind)) = LOWER(BTRIM($2))
          AND k.character = $3
          AND LOWER(BTRIM(k.romaji)) = LOWER(BTRIM($4))`,
      [courseIds, parts[0], parts[1], parts[2]]
    );
  } else if (itemType === 'vocabulary' && parts.length === 3) {
    result = await client.query(
      `SELECT DISTINCT v.id
         FROM module_vocabulary v
         JOIN modules m ON m.id = v.module_id
        WHERE m.course_id = ANY($1::uuid[])
          AND LOWER(BTRIM(v.japanese)) = LOWER(BTRIM($2))
          AND LOWER(BTRIM(COALESCE(v.reading, ''))) = LOWER(BTRIM($3))
          AND LOWER(BTRIM(COALESCE(v.indonesian, ''))) = LOWER(BTRIM($4))`,
      [courseIds, parts[0], parts[1], parts[2]]
    );
  } else if (itemType === 'kanji' && parts.length === 1 && parts[0]) {
    result = await client.query(
      `SELECT DISTINCT k.id
         FROM kanji_items k
         JOIN lessons l ON l.id = k.lesson_id
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ANY($1::uuid[]) AND k.character = $2`,
      [courseIds, parts[0]]
    );
  } else {
    return null;
  }
  // Ambiguous legacy descriptions are deliberately not guessed.  The local
  // cache remains untouched, and a future resolver can safely revisit them.
  return result.rows.length === 1 ? result.rows[0].id : null;
}

function legacyWordSkill(direction, legacyKey) {
  return `word:${direction}:${Buffer.from(String(legacyKey), 'utf8').toString('base64url')}`;
}

async function resolveLegacyKanjiWordOwner(client, legacyKey, suppliedOwners, courseIds) {
  const parts = String(legacyKey || '').split('::');
  const ownerIds = [...new Set(Array.isArray(suppliedOwners) ? suppliedOwners.filter(validUuid) : [])];
  if (parts.length !== 2 || !parts[0] || !ownerIds.length || !courseIds.length) return null;
  // The client proposes owners from the authenticated course payload.  Verify
  // both entitlement and that the word really belongs to the same course and
  // contains that Kanji before accepting the mapping.
  const result = await client.query(
    `SELECT DISTINCT k.id
       FROM kanji_items k
       JOIN lessons l ON l.id = k.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN modules vm ON vm.course_id = m.course_id
       JOIN module_vocabulary v ON v.module_id = vm.id
      WHERE k.id = ANY($1::uuid[])
        AND m.course_id = ANY($2::uuid[])
        AND LOWER(BTRIM(v.japanese)) = LOWER(BTRIM($3))
        AND LOWER(BTRIM(COALESCE(v.reading, ''))) = LOWER(BTRIM($4))
        AND POSITION(k.character IN v.japanese) > 0`,
    [ownerIds, courseIds, parts[0], parts[1]]
  );
  return result.rows.length === 1 ? result.rows[0].id : null;
}

// GET /api/practice/state?lessonId=...&itemType=kana|vocabulary|kanji
router.get('/state', asyncHandler(async (req, res) => {
  const lessonId = req.query.lessonId;
  const itemType = req.query.itemType;
  if (!PRACTICE_ITEM_TYPES.has(itemType)) return res.status(400).json({ error: 'invalid_item_type' });
  const access = await assertLessonAccess(req, lessonId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const items = await query(itemsForLessonSql(itemType), [lessonId]);
  const itemIds = items.rows.map((r) => r.item_id);
  if (!itemIds.length) return res.json({ states: [] });
  const states = await query(
    `SELECT item_type, item_id, skill, attempts, correct, streak,
            last_seen_at, last_reviewed_at, next_review_at, mastery_state
       FROM user_practice_state
      WHERE user_id = $1 AND item_type = $2 AND item_id = ANY($3::uuid[])
      ORDER BY updated_at DESC`,
    [req.user.id, itemType, itemIds]
  );
  res.json({ states: states.rows.map(stateJson) });
}));

// GET /api/practice/due?courseId=<optional>&limit=<optional>
router.get('/due', asyncHandler(async (req, res) => {
  const requestedCourseId = req.query.courseId;
  if (requestedCourseId && !validUuid(requestedCourseId)) {
    return res.status(400).json({ error: 'invalid_course_id' });
  }
  if (requestedCourseId && !(await userCanAccessCourse(req.user, requestedCourseId))) {
    return res.status(403).json({ error: 'not_enrolled' });
  }
  const courseIds = requestedCourseId ? [requestedCourseId] : await accessibleCourseIds(req.user);
  if (!courseIds.length) return res.json({ states: [] });
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const states = await query(
    `WITH accessible_items AS (
       SELECT DISTINCT 'kana'::text AS item_type, lk.kana_id AS item_id
         FROM lesson_kana_items lk
         JOIN lessons l ON l.id = lk.lesson_id
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ANY($2::uuid[])
       UNION
       SELECT DISTINCT 'vocabulary'::text, v.id
         FROM module_vocabulary v JOIN modules m ON m.id = v.module_id
        WHERE m.course_id = ANY($2::uuid[])
       UNION
       SELECT DISTINCT 'kanji'::text, k.id
         FROM kanji_items k
         JOIN lessons l ON l.id = k.lesson_id
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ANY($2::uuid[])
     )
     SELECT s.item_type, s.item_id, s.skill, s.attempts, s.correct, s.streak,
            s.last_seen_at, s.last_reviewed_at, s.next_review_at, s.mastery_state
       FROM user_practice_state s
       JOIN accessible_items i ON i.item_type = s.item_type AND i.item_id = s.item_id
      WHERE s.user_id = $1
        AND (s.next_review_at IS NULL OR s.next_review_at <= NOW())
      ORDER BY s.next_review_at ASC NULLS FIRST, s.last_seen_at ASC NULLS FIRST
      LIMIT $3`,
    [req.user.id, courseIds, limit]
  );
  res.json({ states: states.rows.map(stateJson) });
}));

// POST /api/practice/attempts
router.post('/attempts', asyncHandler(async (req, res) => {
  const { itemType, itemId, skill, lessonId, courseId } = req.body || {};
  const isCorrect = req.body?.isCorrect;
  const source = req.body?.source || 'lesson_drill';
  if (!PRACTICE_ITEM_TYPES.has(itemType)) return res.status(400).json({ error: 'invalid_item_type' });
  if (!validUuid(itemId)) return res.status(400).json({ error: 'invalid_item_id' });
  if (!isSafePracticeSkill(skill)) return res.status(400).json({ error: 'invalid_skill' });
  if (typeof isCorrect !== 'boolean') return res.status(400).json({ error: 'isCorrect_required' });
  if (!PRACTICE_SOURCES.has(source)) return res.status(400).json({ error: 'invalid_source' });

  let access;
  if (lessonId != null) {
    access = await assertLessonAccess(req, lessonId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const belongs = await itemBelongsToLesson(query, itemType, itemId, lessonId);
    if (!hasPracticeScopeAccess({ entitled: true, itemBelongsToScope: belongs })) {
      return res.status(404).json({ error: 'practice_item_not_in_lesson' });
    }
  } else {
    if (!validUuid(courseId)) return res.status(400).json({ error: 'course_id_required_without_lesson' });
    const entitled = await userCanAccessCourse(req.user, courseId);
    if (!entitled) return res.status(403).json({ error: 'not_enrolled' });
    const belongs = await itemBelongsToCourse(query, itemType, itemId, courseId);
    if (!hasPracticeScopeAccess({ entitled, itemBelongsToScope: belongs })) {
      return res.status(404).json({ error: 'practice_item_not_in_course' });
    }
    access = { scope: { course_id: courseId } };
  }

  const state = await withAdvisoryLock(
    `practice-attempt:${req.user.id}:${itemType}:${itemId}:${skill}`,
    (client) => recordPracticeAttemptWithState(client, {
      userId: req.user.id,
      courseId: access.scope.course_id,
      lessonId: lessonId || null,
      itemType,
      itemId,
      skill,
      isCorrect,
      source,
    })
  );
  res.status(201).json({ ok: true, state: stateJson(state) });
}));

// POST /api/practice/import-legacy
// Body carries the three existing localStorage blobs.  This endpoint never
// clears a browser key; a successful import only writes a server-side ledger.
router.post('/import-legacy', asyncHandler(async (req, res) => {
  const legacy = req.body?.mastery && typeof req.body.mastery === 'object' ? req.body.mastery : {};
  const stores = {
    kana: legacy.kana?.items && typeof legacy.kana.items === 'object' ? legacy.kana.items : {},
    vocabulary: legacy.vocabulary?.items && typeof legacy.vocabulary.items === 'object' ? legacy.vocabulary.items : {},
    kanji: legacy.kanji?.items && typeof legacy.kanji.items === 'object' ? legacy.kanji.items : {},
  };
  const kanjiWords = legacy.kanji?.words && typeof legacy.kanji.words === 'object'
    ? legacy.kanji.words : {};
  const wordOwners = legacy.kanjiWordOwners && typeof legacy.kanjiWordOwners === 'object'
    ? legacy.kanjiWordOwners : {};
  const entryCount = Object.values(stores).reduce((n, items) => n + Object.keys(items).length, 0)
    + Object.keys(kanjiWords).length;
  if (entryCount > 10_000) return res.status(413).json({ error: 'legacy_payload_too_large' });

  const outcome = await withAdvisoryLock(`practice-import:${req.user.id}`, async (client) => {
    const courseIds = await accessibleCourseIds(req.user, (text, params) => client.query(text, params));
    const result = { imported: 0, alreadyImported: 0, unresolved: 0 };
    for (const itemType of Object.keys(stores)) {
      for (const [legacyKey, saved] of Object.entries(stores[itemType])) {
        const prior = await client.query(
          `SELECT 1 FROM user_practice_legacy_imports
            WHERE user_id = $1 AND source = $2 AND item_type = $3 AND legacy_key = $4`,
          [req.user.id, LEGACY_SOURCE, itemType, legacyKey]
        );
        if (prior.rows.length) { result.alreadyImported++; continue; }
        const itemId = await resolveLegacyIdentity(client, itemType, legacyKey, courseIds);
        if (!itemId) { result.unresolved++; continue; }

        let wroteState = false;
        for (const skill of DIRECTIONS[itemType]) {
          const normalized = normalizeLegacyPracticeStat(saved?.[skill]);
          if (!normalized.attempts) continue;
          await upsertImportedState(client, {
            userId: req.user.id, itemType, itemId, skill,
            incoming: { ...normalized, masteryState: masteryStateFor(normalized) },
          });
          wroteState = true;
        }
        if (!wroteState) { result.unresolved++; continue; }
        await client.query(
          `INSERT INTO user_practice_legacy_imports
             (user_id, source, item_type, legacy_key, item_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.user.id, LEGACY_SOURCE, itemType, legacyKey, itemId]
        );
        result.imported++;
      }
    }
    for (const [legacyKey, saved] of Object.entries(kanjiWords)) {
      const ledgerKey = `word:${legacyKey}`;
      const prior = await client.query(
        `SELECT 1 FROM user_practice_legacy_imports
          WHERE user_id = $1 AND source = $2 AND item_type = 'kanji' AND legacy_key = $3`,
        [req.user.id, LEGACY_SOURCE, ledgerKey]
      );
      if (prior.rows.length) { result.alreadyImported++; continue; }
      const itemId = await resolveLegacyKanjiWordOwner(client, legacyKey, wordOwners[legacyKey], courseIds);
      if (!itemId) { result.unresolved++; continue; }
      let wroteState = false;
      for (const direction of KANJI_WORD_DIRECTIONS) {
        const normalized = normalizeLegacyPracticeStat(saved?.[direction]);
        if (!normalized.attempts) continue;
        await upsertImportedState(client, {
          userId: req.user.id, itemType: 'kanji', itemId,
          skill: legacyWordSkill(direction, legacyKey),
          incoming: { ...normalized, masteryState: masteryStateFor(normalized) },
        });
        wroteState = true;
      }
      if (!wroteState) { result.unresolved++; continue; }
      await client.query(
        `INSERT INTO user_practice_legacy_imports
           (user_id, source, item_type, legacy_key, item_id)
         VALUES ($1,$2,'kanji',$3,$4)`,
        [req.user.id, LEGACY_SOURCE, ledgerKey, itemId]
      );
      result.imported++;
    }
    return result;
  });
  res.json({ ok: true, ...outcome });
}));

export default router;
