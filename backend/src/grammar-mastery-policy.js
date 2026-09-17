// Paket 3 — kebijakan penguasaan BERVERSI, dijalankan dalam MODE SHADOW.
//
// Yang dikerjakan file ini: menghitung penilaian USULAN di samping penilaian
// yang berjalan, supaya perbedaannya bisa ditinjau. Yang TIDAK dikerjakan:
// mengubah label, completion, XP, antrean review, atau apa pun yang dilihat
// siswa. `grammar-mastery.js#computeConceptMastery` tetap jadi satu-satunya
// pembaca aktif sampai pemilik produk memutuskan sebaliknya.
//
// ── Batas yang ditetapkan rencana, bukan preferensi saya ───────────────────
// Rencana Paket 3 menulis, harfiah: "Syarat numerik, minimum variasi soal,
// minimum keberhasilan produksi, jeda retensi, dan perlakuan confidence AI
// BELUM DITETAPKAN dokumen ini. Codex boleh membuat konfigurasi dan test
// case, tetapi TIDAK BOLEH memilih threshold baru lalu mengaktifkannya
// sebagai kebijakan resmi."
//
// Karena itu seluruh angka di V2_CONFIG bertanda `ratified: false`. Angka-
// angka itu ADA supaya kebijakan ini bisa dijalankan dan dibandingkan sama
// sekali — bukan usulan nilai final, dan tidak pernah menyentuh siswa selama
// flag-nya mati.
//
// ── Tidak ada perhitungan ulang destruktif ────────────────────────────────
// "Data lama tanpa metadata tetap diketahui sebagai evidence terbatas, bukan
// diubah menjadi gagal atau nol." Percobaan yang ditulis sebelum Paket 1/2
// tidak punya assistance_state/independent_eligible/question_fingerprint —
// percobaan itu diklasifikasikan LIMITED dan TIDAK pernah dihitung sebagai
// kegagalan, tidak pernah menurunkan state, dan tidak pernah dianggap bukti
// mandiri. Ia cuma tidak menambah keyakinan.

// Kosakata state SENGAJA sama persis dengan kebijakan berjalan. Rencana:
// "Jangan memberi lima badge baru tanpa kebutuhan desain." Yang baru bukan
// labelnya, melainkan RINCIAN BUKTI di sebelahnya.
export { STATES, STATE_LABEL } from './grammar-mastery.js';

export const POLICY_V1 = 'v1';
export const POLICY_V2 = 'v2';
export const POLICY_DEFAULT = POLICY_V1;
export const POLICY_SETTING_KEY = 'grammar_mastery_policy';

// Jenis bukti yang dipisahkan. Lima yang disebut rencana (materi, latihan
// dengan bantuan, penggunaan mandiri, produksi, retensi) plus LIMITED untuk
// riwayat lama — bukan jenis bukti keenam, melainkan pengakuan jujur bahwa
// jenisnya tidak diketahui.
export const EVIDENCE = Object.freeze({
  LIMITED: 'limited',
  ASSISTED: 'assisted',
  INDEPENDENT: 'independent',
  PRODUCTION: 'production',
  RETENTION: 'retention',
});

export const V2_CONFIG = Object.freeze({
  // BELUM DIRATIFIKASI. Lihat catatan panjang di atas: angka di bawah ada
  // supaya kebijakan ini bisa DIJALANKAN dan DIBANDINGKAN, bukan supaya
  // dipakai menilai siswa. Pemilik produk yang menetapkan nilai final.
  ratified: false,

  // Berapa percobaan MANDIRI (tanpa bantuan) yang dibutuhkan sebelum sebuah
  // konsep boleh dinyatakan lebih dari sekadar "sedang dipelajari".
  minIndependentAttempts: 3,

  // Berapa SOAL BERBEDA yang harus pernah dijawab mandiri. Ini yang menutup
  // kasus "soal yang sama berulang" — lihat compareMastery().
  minDistinctQuestions: 2,

  // Berapa kalimat produksi (bebas, dinilai evaluator) yang harus pernah
  // lulus sebelum penguasaan diklaim penuh.
  minProductionPasses: 1,

  // Jarak hari antara dua keberhasilan mandiri supaya yang kedua dihitung
  // sebagai bukti RETENSI, bukan pengulangan di sesi yang sama.
  retentionGapDays: 7,

  // Skor AI adalah bukti evaluator, bukan kepastian objektif (rencana).
  // Percobaan produksi yang dinilai AI tetap dihitung, tapi ditandai supaya
  // perbandingannya bisa memisahkan "lulus menurut AI" dari "lulus menurut
  // penilaian deterministik".
  countAiProductionAsEvidence: true,
});

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

const ASSISTED_STATES = new Set(['hint_served', 'answer_served', 'correction_served']);

// CHECK migrasi 147 mengizinkan SATU nilai lagi: 'unknown'. Hari ini tidak ada
// kode yang menulisnya (deriveAssistanceState cuma menghasilkan none_observed/
// hint_served/answer_served), tapi nilainya sengaja disediakan untuk data yang
// jenis bantuannya memang tidak diketahui. Baris seperti itu TIDAK BOLEH
// dihitung sebagai bukti mandiri — mengklaim kemandirian dari baris yang
// tulisannya sendiri berbunyi "tidak diketahui" persis kelas over-claiming yang
// jadi alasan Paket 3 ada. Diperlakukan sebagai LIMITED, sama seperti riwayat
// lama: tidak dihitung sebagai kegagalan, cuma tidak menambah keyakinan.
const UNKNOWN_ASSISTANCE = 'unknown';

// Apakah baris ini membawa metadata Paket 1/2 sama sekali. Percobaan yang
// ditulis jalur lama (grammar-task.js drill-answer & evaluate, dan Smart
// Review sebelum Paket 2) tidak punya satu pun — itu bukan cacat data, cuma
// riwayat yang lahir sebelum kolomnya ada.
export function hasEvidenceMetadata(row) {
  const r = isPlainObject(row) ? row : {};
  return r.assistance_state != null
    || r.independent_eligible != null
    || r.question_fingerprint != null
    || r.evaluation_kind != null;
}

// Klasifikasi SATU percobaan. `previousPassAt` = waktu keberhasilan mandiri
// terakhir SEBELUM baris ini (dipakai menentukan retensi); null kalau belum
// ada.
export function classifyAttempt(row, { previousPassAt = null, config = V2_CONFIG } = {}) {
  const r = isPlainObject(row) ? row : {};

  // Produksi dinilai lebih dulu: kalimat bebas selalu bukti produksi, apa pun
  // metadata lainnya.
  if (r.source === 'production') return EVIDENCE.PRODUCTION;

  // Riwayat lama — dan baris yang bantuannya eksplisit 'unknown': jenisnya
  // tidak diketahui, jadi tidak diklaim apa-apa.
  if (!hasEvidenceMetadata(r)) return EVIDENCE.LIMITED;
  if (r.assistance_state === UNKNOWN_ASSISTANCE) return EVIDENCE.LIMITED;

  if (r.independent_eligible === false || ASSISTED_STATES.has(r.assistance_state)) {
    return EVIDENCE.ASSISTED;
  }

  // Keberhasilan mandiri yang berjarak cukup dari keberhasilan mandiri
  // sebelumnya dihitung sebagai retensi — bukan state terpisah, melainkan
  // bukti yang lebih kuat dari pengulangan di sesi yang sama.
  if (r.passed && previousPassAt) {
    const gapDays = (new Date(r.created_at).getTime() - new Date(previousPassAt).getTime()) / 86400000;
    if (Math.abs(gapDays) >= config.retentionGapDays) return EVIDENCE.RETENTION;
  }
  return EVIDENCE.INDEPENDENT;
}

// Identitas soal untuk menghitung VARIASI. question_fingerprint (Paket 1)
// paling tepat; check_family_id (Paket 2) dipakai kalau ada; kalau dua-duanya
// kosong, soal itu tidak menyumbang variasi yang diketahui — sekali lagi,
// tidak dihitung sebagai pelanggaran, cuma tidak dihitung sebagai bukti.
export function questionIdentity(row) {
  const r = isPlainObject(row) ? row : {};
  return r.question_fingerprint || r.check_family_id || null;
}

// Rincian bukti satu konsep. `rows` = percobaan konsep itu, TERBARU DULU
// (bentuk yang sama persis dengan yang diterima computeConceptMastery).
export function summarizeEvidence(rows, { config = V2_CONFIG } = {}) {
  // Diproses dari yang TERLAMA supaya "keberhasilan mandiri sebelumnya"
  // benar-benar sebelumnya.
  const chronological = [...(rows || [])].reverse();

  const tally = {
    [EVIDENCE.LIMITED]: 0,
    [EVIDENCE.ASSISTED]: 0,
    [EVIDENCE.INDEPENDENT]: 0,
    [EVIDENCE.PRODUCTION]: 0,
    [EVIDENCE.RETENTION]: 0,
  };
  const passed = { ...tally };
  const distinctQuestions = new Set();
  let unknownVariety = 0;
  let previousPassAt = null;
  let aiProductionPasses = 0;

  for (const row of chronological) {
    const kind = classifyAttempt(row, { previousPassAt, config });
    tally[kind] += 1;
    if (row.passed) {
      passed[kind] += 1;
      if (kind === EVIDENCE.INDEPENDENT || kind === EVIDENCE.RETENTION) {
        previousPassAt = row.created_at;
      }
      if (kind === EVIDENCE.PRODUCTION && row.eval_source !== 'smart_review') aiProductionPasses += 1;
    }
    if (kind === EVIDENCE.INDEPENDENT || kind === EVIDENCE.RETENTION) {
      const id = questionIdentity(row);
      if (id) distinctQuestions.add(id); else unknownVariety += 1;
    }
  }

  return {
    tally,
    passed,
    distinctQuestions: distinctQuestions.size,
    unknownVariety,
    aiProductionPasses,
    independentPasses: passed[EVIDENCE.INDEPENDENT] + passed[EVIDENCE.RETENTION],
    independentAttempts: tally[EVIDENCE.INDEPENDENT] + tally[EVIDENCE.RETENTION],
  };
}

// ── Penilaian usulan (v2) ─────────────────────────────────────────────────
// KEPUTUSAN DESAIN YANG MENENTUKAN: v2 TIDAK PERNAH menjatuhkan siswa yang
// tidak dijatuhkan v1. Ia memakai ulang penilaian v1 apa adanya — termasuk
// seluruh aturan kegagalan (dua kegagalan terakhir, akurasi berbobot,
// pemulihan) — dan HANYA boleh MENAHAN klaim MASTERED ketika buktinya tipis.
//
// Alasannya langsung dari rencana: kekhawatiran yang disebut bukan "siswa
// terlalu jarang gagal", melainkan penguasaan yang DIKLAIM dari empat jawaban
// pengenalan, dari jawaban yang semuanya benar SETELAH dibantu, atau dari
// soal yang sama diulang-ulang. Menambah cara baru untuk GAGAL akan jadi
// perhitungan ulang destruktif atas riwayat — yang dilarang eksplisit.
import { computeConceptMastery } from './grammar-mastery.js';

export function computeConceptMasteryV2(rows, now = Date.now(), config = V2_CONFIG) {
  const base = computeConceptMastery(rows, now);
  const evidence = summarizeEvidence(rows, { config });

  const reasons = [];
  let state = base.state;

  if (base.state === 'MASTERED') {
    if (evidence.independentAttempts < config.minIndependentAttempts) {
      reasons.push('bukti mandiri belum cukup');
    }
    if (evidence.distinctQuestions < config.minDistinctQuestions) {
      reasons.push('variasi soal belum cukup');
    }
    if (evidence.passed[EVIDENCE.PRODUCTION] < config.minProductionPasses) {
      reasons.push('belum ada kalimat produksi yang lulus');
    }
    if (reasons.length) state = 'PROGRESSING';
  }

  return {
    ...base,
    state,
    // `score` sengaja TIDAK diubah: angkanya adalah akurasi berbobot, dan
    // akurasinya memang tidak berubah — yang berubah cuma seberapa yakin
    // kita menyebutnya penguasaan.
    policy: POLICY_V2,
    evidence,
    withheldReasons: reasons,
    evidenceQuality: evidence.tally[EVIDENCE.LIMITED] > 0
      && evidence.independentAttempts === 0 ? 'limited' : 'tracked',
  };
}

// Perbandingan satu konsep, ditandai dengan kasus-kasus yang rencana minta
// ditinjau pemilik produk secara eksplisit.
export function compareMastery(v1, v2) {
  const ev = v2?.evidence || summarizeEvidence([]);
  const flags = [];

  // "empat jawaban recognition benar" — lulus tanpa satu pun bukti produksi.
  if (ev.tally[EVIDENCE.PRODUCTION] === 0 && (v1?.passedCount || 0) > 0) {
    flags.push('recognition_only');
  }
  // "semua benar setelah bantuan".
  if (ev.passed[EVIDENCE.ASSISTED] > 0 && ev.independentPasses === 0) {
    flags.push('assisted_passes_only');
  }
  // "banyak pengulangan soal sama".
  if (ev.independentAttempts >= 2 && ev.distinctQuestions <= 1) {
    flags.push('repeated_question');
  }
  // "bukti produksi/retensi yang benar-benar ada" — sisi positifnya, supaya
  // tinjauan tidak cuma melihat kasus yang mencurigakan.
  if (ev.passed[EVIDENCE.PRODUCTION] > 0 || ev.passed[EVIDENCE.RETENTION] > 0) {
    flags.push('has_production_or_retention');
  }
  // Riwayat lama tanpa metadata: dilaporkan apa adanya, tidak diperlakukan
  // sebagai kegagalan.
  if (ev.tally[EVIDENCE.LIMITED] > 0) flags.push('limited_history');

  return {
    changed: (v1?.state || null) !== (v2?.state || null),
    from: v1?.state || null,
    to: v2?.state || null,
    withheldReasons: v2?.withheldReasons || [],
    flags,
  };
}

// Pembaca aktif. Selama setting-nya bukan 'v2' — dan defaultnya bukan —
// fungsi ini mengembalikan kebijakan berjalan apa adanya.
export function resolvePolicy(settingValue) {
  return settingValue === POLICY_V2 ? POLICY_V2 : POLICY_V1;
}
