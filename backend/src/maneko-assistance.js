// Kunci per-pengguna untuk menserialkan penulisan bukti belajar (state FSRS,
// percobaan latihan). Konsep "jawaban berbantuan" (paparan Maneko yang membuat
// jawaban tidak dicatat) sudah dihapus: setiap jawaban selalu tercatat.
export const evidenceLock = (userId) => `learning-evidence:${userId}`;

export async function lockEvidence(client, userId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [evidenceLock(userId)]);
}
