// Model penguasaan (mastery) per KONSEP grammar — sadar-keyakinan.
//
// Identitas konsep = module_grammar.id (sudah stabil, dipakai bersama oleh
// pelajaran Tata Bahasa lewat lesson_id DAN Tugas Bunpou lewat
// lesson_grammar_task_items). Tidak ada tabel konsep baru.
//
// Kenapa BUKAN benar/total:
//   - satu-dua percobaan tidak boleh melahirkan klaim "86% dikuasai" →
//     persentase baru dikeluarkan setelah MIN_ATTEMPTS_FOR_SCORE percobaan,
//     di bawah itu state-nya LEARNING dan `score` sengaja null supaya UI
//     tidak punya angka untuk dirender;
//   - percobaan lama harus meluruh → bobot half-life 45 hari, jadi retry yang
//     berhasil mengalahkan kegagalan sebelumnya, dan penguasaan basi turun
//     sendiri tanpa cron;
//   - kegagalan beruntun harus terasa lebih cepat daripada rata-rata bergerak →
//     dua percobaan terakhir gagal langsung menurunkan ke NEEDS_PRACTICE;
//   - MASTERED menuntut sampel cukup (effectiveN) DAN percobaan terakhir lulus.
//
// Sinyal produksi (kalimat bebas, dinilai AI) dan pengenalan/latihan terkontrol
// (soal kuis yang ditautkan ke pola, dinilai deterministik) masuk ke perhitungan
// yang sama tapi tetap dilaporkan terpisah — "bisa memilih jawaban benar" bukan
// hal yang sama dengan "bisa membuat kalimat sendiri".

import { query } from './db.js';

export const WINDOW_DAYS = 180;          // percobaan lebih tua dari ini diabaikan
export const MAX_ATTEMPTS = 12;          // hanya N percobaan terbaru per konsep
export const MIN_ATTEMPTS_FOR_SCORE = 3; // di bawah ini: LEARNING, tanpa angka
export const HALF_LIFE_DAYS = 45;
export const NEEDS_PRACTICE_MAX = 0.55;
export const PROGRESSING_MAX = 0.85;
export const MASTERED_MIN_ATTEMPTS = 4;
export const MASTERED_MIN_EFFECTIVE_N = 2.5;
export const REVIEW_AFTER_DAYS = 21;     // MASTERED tapi lama tak disentuh → dueReview

export const STATES = ['UNSEEN', 'LEARNING', 'NEEDS_PRACTICE', 'PROGRESSING', 'MASTERED'];

// Label siswa (Bahasa Indonesia, tanpa istilah teknis AI).
export const STATE_LABEL = {
  UNSEEN: 'Belum dianalisis',
  LEARNING: 'Sedang dipelajari',
  NEEDS_PRACTICE: 'Perlu latihan',
  PROGRESSING: 'Sedang dipelajari',
  MASTERED: 'Dikuasai',
};

// Percobaan yang gagal HANYA karena transkripsi meleset bukan kegagalan
// grammar — dicatat (untuk audit) tapi tidak ikut agregasi.
const EXCLUDED_PRIMARY_ERRORS = new Set(['transcription_issue']);

function weightFor(createdAt, now) {
  const ageDays = Math.max(0, (now - new Date(createdAt).getTime()) / 86400000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// rows: percobaan SATU konsep, TERBARU DULU, sudah dibatasi window+limit.
// Tiap row: { passed, created_at, source, primary_error }.
export function computeConceptMastery(rows, now = Date.now()) {
  const usable = (rows || []).filter(
    (r) => !(r.primary_error && EXCLUDED_PRIMARY_ERRORS.has(r.primary_error))
  );

  const attempts = usable.length;
  const passedCount = usable.filter((r) => r.passed).length;
  const productionAttempts = usable.filter((r) => r.source === 'production').length;
  const recognitionAttempts = attempts - productionAttempts;
  const lastAttemptAt = usable.length ? usable[0].created_at : null;

  if (attempts === 0) {
    return {
      state: 'UNSEEN', score: null, attempts: 0, passedCount: 0,
      productionAttempts: 0, recognitionAttempts: 0,
      lastAttemptAt: null, dueReview: false, weightedAccuracy: null, effectiveN: 0,
    };
  }

  let wSum = 0;
  let wPassed = 0;
  for (const r of usable) {
    const w = weightFor(r.created_at, now);
    wSum += w;
    if (r.passed) wPassed += w;
  }
  const weightedAccuracy = wSum > 0 ? wPassed / wSum : 0;
  const effectiveN = wSum;

  const lastPassed = !!usable[0].passed;
  const twoRecentFails = usable.length >= 2 && !usable[0].passed && !usable[1].passed;
  // Retry yang berhasil harus terasa, bukan cuma sedikit menggeser rata-rata:
  // peluruhan 45 hari nyaris tidak menurunkan bobot kegagalan berumur beberapa
  // hari, jadi siswa yang sudah pulih tetap dicap "perlu latihan" tanpa aturan
  // ini. Syarat keberhasilan minimal separuh percobaan menahan aturan ini dari
  // memaafkan 2 keberhasilan di antara delapan kegagalan.
  const recovered = usable.length >= 2 && usable[0].passed && usable[1].passed
    && passedCount * 2 >= attempts;

  let state;
  if (attempts < MIN_ATTEMPTS_FOR_SCORE) {
    state = 'LEARNING';
  } else if (twoRecentFails || (weightedAccuracy < NEEDS_PRACTICE_MAX && !recovered)) {
    state = 'NEEDS_PRACTICE';
  } else if (weightedAccuracy < PROGRESSING_MAX) {
    state = 'PROGRESSING';
  } else if (
    attempts >= MASTERED_MIN_ATTEMPTS
    && effectiveN >= MASTERED_MIN_EFFECTIVE_N
    && lastPassed
  ) {
    state = 'MASTERED';
  } else {
    // Akurasi sudah tinggi tapi sampel/kesegaran belum cukup untuk MASTERED.
    state = 'PROGRESSING';
  }

  // Angka hanya keluar setelah sampelnya cukup — ini yang mencegah UI
  // mengklaim penguasaan dari satu-dua percobaan.
  const score = attempts >= MIN_ATTEMPTS_FOR_SCORE
    ? Math.round(weightedAccuracy * 100)
    : null;

  // Retensi (Level D) sengaja TIDAK disyaratkan state === 'MASTERED': syarat
  // effectiveN pada MASTERED sendiri sudah meluruh seiring waktu, jadi konsep
  // yang basi justru turun ke PROGRESSING lebih dulu — dan bendera "perlu
  // diulang" tidak akan pernah menyala kalau digantungkan ke MASTERED.
  // Yang ditandai di sini: pernah kuat, sekarang lama tidak disentuh.
  const ageDays = (now - new Date(lastAttemptAt).getTime()) / 86400000;
  const dueReview = attempts >= MIN_ATTEMPTS_FOR_SCORE
    && weightedAccuracy >= PROGRESSING_MAX
    && ageDays > REVIEW_AFTER_DAYS;

  return {
    state, score, attempts, passedCount,
    productionAttempts, recognitionAttempts,
    lastAttemptAt, dueReview,
    weightedAccuracy: Math.round(weightedAccuracy * 1000) / 1000,
    effectiveN: Math.round(effectiveN * 100) / 100,
  };
}

// Kesalahan yang paling sering muncul pada percobaan produksi yang GAGAL —
// dipakai untuk satu kalimat "fokus berikutnya", bukan untuk menentukan state.
export function dominantError(rows) {
  const tally = new Map();
  for (const r of rows || []) {
    if (r.passed) continue;
    const e = r.primary_error;
    if (!e || EXCLUDED_PRIMARY_ERRORS.has(e)) continue;
    tally.set(e, (tally.get(e) || 0) + 1);
  }
  let best = null;
  for (const [type, count] of tally) {
    if (!best || count > best.count) best = { type, count };
  }
  return best;
}

// Kalimat fokus untuk siswa. Sengaja tidak pernah menyebut nama tipe error
// internal (wrong_particle dst) — itu kosakata mesin, bukan kosakata siswa.
const ERROR_HINT = {
  wrong_particle: 'partikelnya masih sering tertukar',
  wrong_conjugation: 'perubahan bentuk kata kerjanya masih sering meleset',
  wrong_word_order: 'urutan katanya masih sering tertukar',
  missing_element: 'masih ada bagian kalimat yang kelewat',
  extra_element: 'masih ada kata berlebih yang bikin kalimatnya janggal',
  wrong_grammar_pattern: 'polanya belum benar-benar terpakai di kalimatmu',
  meaning_mismatch: 'kalimatnya belum sesuai maksud tugasnya',
  unnatural_but_grammatical: 'kalimatnya benar tapi terdengar belum alami',
  vocabulary_issue: 'pilihan katanya belum pas',
};

export function focusSentence(pattern, mastery, errInfo) {
  const p = pattern || 'pola ini';
  if (mastery.state === 'NEEDS_PRACTICE') {
    const hint = errInfo && ERROR_HINT[errInfo.type];
    return hint
      ? `Saat memakai ${p}, ${hint}. Coba latihan sekali lagi, ya.`
      : `${p} masih sering meleset. Coba latihan sekali lagi, ya.`;
  }
  if (mastery.dueReview) {
    return `Sudah lama kamu tidak memakai ${p}. Coba ulangi sebentar biar tidak lupa.`;
  }
  if (mastery.state === 'LEARNING') {
    return `${p} baru kamu coba beberapa kali — perbanyak latihan biar hasilnya kelihatan.`;
  }
  return null;
}

// Muat percobaan (produksi + pengenalan) untuk sekumpulan konsep milik satu
// siswa, lalu hitung mastery-nya. Return Map grammarId → mastery(+focus).
//
// Dua sumber di-UNION lalu dipotong per konsep pakai ROW_NUMBER supaya
// batas MAX_ATTEMPTS berlaku pada gabungan keduanya, bukan per sumber.
export async function loadMastery(userId, grammarIds) {
  const ids = [...new Set((grammarIds || []).filter(Boolean))];
  const out = new Map();
  if (ids.length === 0) return out;

  const r = await query(
    `WITH unioned AS (
       SELECT grammar_id, passed, created_at, source, primary_error
         FROM grammar_attempts
        WHERE user_id = $1 AND grammar_id = ANY($2::uuid[])
          AND created_at > NOW() - make_interval(days => $3::int)
       UNION ALL
       SELECT grammar_id, is_correct AS passed, created_at,
              'recognition'::text AS source, NULL::text AS primary_error
         FROM quiz_question_results
        WHERE user_id = $1 AND grammar_id = ANY($2::uuid[])
          AND created_at > NOW() - make_interval(days => $3::int)
     ), ranked AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY grammar_id ORDER BY created_at DESC) AS rn
         FROM unioned
     )
     SELECT grammar_id, passed, created_at, source, primary_error
       FROM ranked WHERE rn <= $4
      ORDER BY grammar_id, created_at DESC`,
    [userId, ids, WINDOW_DAYS, MAX_ATTEMPTS]
  );

  const byGrammar = new Map();
  for (const row of r.rows) {
    if (!byGrammar.has(row.grammar_id)) byGrammar.set(row.grammar_id, []);
    byGrammar.get(row.grammar_id).push(row);
  }

  const now = Date.now();
  for (const id of ids) {
    const rows = byGrammar.get(id) || [];
    const mastery = computeConceptMastery(rows, now);
    mastery.dominantError = dominantError(rows);
    out.set(id, mastery);
  }
  return out;
}

// Ringkasan tingkat-pelajaran. `pct` hanya dihitung dari konsep yang benar-benar
// punya skor — konsep yang belum cukup data tidak boleh menarik rata-rata ke
// bawah seolah-olah siswa salah.
export function summarize(entries) {
  const scored = entries.filter((e) => e.mastery.score != null);
  const pct = scored.length
    ? Math.round(scored.reduce((s, e) => s + e.mastery.score, 0) / scored.length)
    : null;
  return {
    pct,
    analyzed: scored.length,
    total: entries.length,
    mastered: entries.filter((e) => e.mastery.state === 'MASTERED').length,
    needsPractice: entries.filter((e) => e.mastery.state === 'NEEDS_PRACTICE').length,
    learning: entries.filter((e) => e.mastery.state === 'LEARNING' || e.mastery.state === 'PROGRESSING').length,
    unseen: entries.filter((e) => e.mastery.state === 'UNSEEN').length,
    dueReview: entries.filter((e) => e.mastery.dueReview).length,
  };
}
