// Product guardrails, not an estimate of retention. Related lesson/item content
// waits one day; open-ended chat uses a conservative, global 30-minute window.
export const CONTENT_COOLDOWN_MINUTES = 24 * 60;
export const CHAT_COOLDOWN_MINUTES = 30;
export const evidenceLock = (userId) => `learning-evidence:${userId}`;

export async function lockEvidence(client, userId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [evidenceLock(userId)]);
}

export async function assistanceFor(client, { userId, lessonId, itemType, itemId }) {
  const result = await client.query(
    `SELECT id, expires_at FROM maneko_exposures
      WHERE user_id = $1 AND expires_at > clock_timestamp()
        AND (lesson_id IS NULL AND item_id IS NULL
          OR lesson_id = $2
          OR item_type = $3 AND item_id = $4)
      ORDER BY expires_at DESC LIMIT 1`,
    [userId, lessonId || null, itemType || null, itemId || null]);
  return result.rows[0] || null;
}

export async function recordExposure(client, { userId, lessonId, itemType, itemId, sessionId, questionIndex, type }) {
  const minutes = type === 'tutor_chat' ? CHAT_COOLDOWN_MINUTES : CONTENT_COOLDOWN_MINUTES;
  const result = await client.query(
    `INSERT INTO maneko_exposures
      (user_id, lesson_id, item_type, item_id, session_id, question_index, assistance_type, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,clock_timestamp() + ($8 || ' minutes')::interval)
      RETURNING id, expires_at`,
    [userId, lessonId || null, itemType || null, itemId || null, sessionId || null, questionIndex ?? null, type, String(minutes)]);
  // Existing questions stay assisted for their whole session even if a chat
  // cooldown expires before submission. Only a later session can reassess.
  await client.query(`UPDATE smart_review_session_items si SET assisted_at = COALESCE(si.assisted_at, clock_timestamp())
    FROM smart_review_sessions s, maneko_exposures me
    WHERE si.session_id = s.id AND me.id = $1 AND s.user_id = me.user_id
      AND s.expires_at > clock_timestamp() AND si.answered_at IS NULL
      AND (me.lesson_id IS NULL AND me.item_id IS NULL
        OR me.lesson_id = si.lesson_id OR me.item_type = si.item_type AND me.item_id = si.item_id)`, [result.rows[0].id]);
  return result.rows[0];
}

// SQL expressions here are constants supplied by our queries, never user input.
// Historical eligibility is determined at the attempt timestamp, so asking for
// help later cannot erase an earlier wrong (or right) independent answer.
export function independentEvidenceSql({ user = 'user_id', time = 'created_at', lesson = 'lesson_id', item = 'NULL::uuid', type = "'grammar'" }, alias) {
  return `NOT EXISTS (SELECT 1 FROM maneko_exposures me
    WHERE me.user_id = ${alias}.${user}
      AND me.created_at <= ${alias}.${time} AND me.expires_at > ${alias}.${time}
      AND (me.lesson_id IS NULL AND me.item_id IS NULL
        OR me.lesson_id = ${alias}.${lesson}
        OR me.item_type = ${type} AND me.item_id = ${item}))`;
}

export function reviewHelp(payload, level) {
  if (level === 1) return payload.variant === 'arrange'
    ? 'Tentukan topik dan predikatnya dulu, lalu perhatikan posisi partikel. Susun semua kepingan menjadi satu kalimat.'
    : 'Baca instruksi sekali lagi. Tentukan apakah yang diminta adalah arti, bacaan, atau bentuk kalimat; lalu bandingkan pilihan satu per satu.';
  if (level === 2) return [payload.meaning, payload.example?.indonesian, payload.indonesian, payload.instruction]
    .filter(Boolean).join('\n') || 'Coba jelaskan dengan kata-katamu sendiri apa yang ditanyakan. Jika masih sulit, buka pembahasan jawaban lalu pelajari materi terkait.';
  const answer = payload.variant === 'arrange' ? (payload.answer || []).join(' ') : payload.options?.[payload.correctIndex];
  return `Jawaban pada materi ini: ${answer || 'Buka kembali materi pelajaran.'}${payload.example?.japanese ? `\nContoh: ${payload.example.japanese}` : ''}`;
}
