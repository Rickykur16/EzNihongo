// Bunpou Flow pilot (Paket 1) — pure logic shared by the admin companion
// editor (routes/admin.js), the public serializer (routes/content.js), and
// the session API (routes/grammar-task-sessions.js). No DB access here on
// purpose: everything below is a plain function of its arguments, so it can
// be unit tested without Postgres (see bunpou-flow-service.test.js).
//
// "Companion envelope" = the JSONB stored in lessons.bunpou_flow_draft /
// .bunpou_flow_published. Shape documented in migration 147.

import crypto from 'crypto';

export const COMPANION_SCHEMA_VERSION = 1;
export const EVIDENCE_SCHEMA_VERSION = 1;

// Kept in one place (not duplicated as a literal in the new session route,
// the old drill-answer route, and welcome.html) — this repo has been bitten
// before by GT_MAX_WRONG drifting out of sync between layers (see
// grammar-task.js). The legacy route still keeps its own copy of the value
// for now (changing its import would touch a file this pilot must not
// otherwise modify), but both read the same number.
export const DRILL_MAX_WRONG = 2;

const OBJECTIVE_MAX = 240;
const DIRECTION_MAX = 300;
const OVERLAY_TEXT_MAX = 500;

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Deterministic JSON: object keys sorted recursively so the same logical
// content always hashes the same way regardless of insertion order.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Fingerprints the exact source rows a Tugas Bunpou task lesson's Step 1/2
// questions are derived from (module_grammar + grammar_examples content, as
// loaded by grammar-task.js#loadTaskConcepts/#loadModulePool). Changes to
// pattern/meaning/examples/distractors — or their order, which seededOrder()
// in grammar-drills.js is sensitive to — change this value. Used only to
// decide whether a resumed session's frozen snapshot is still fresh; the
// snapshot itself, once created, is graded as-is regardless (T12).
export function contentRevisionId(items, pool) {
  const shape = (rows) => (rows || []).map((r) => ({
    id: r.id,
    pattern: r.pattern,
    meaning: r.meaning,
    example: r.example,
    dialog: r.example_dialog,
    dialogTranslation: r.example_dialog_id,
    instruction: r.instruction,
    requiredCount: r.requiredCount,
    recognitionDistractors: r.recognitionDistractors || [],
    controlledDistractors: r.controlledDistractors || [],
    examples: (r.examples || []).map((e) => ({
      japanese: e.japanese, highlight: e.highlight, indonesian: e.indonesian,
    })),
  }));
  return sha256(stableStringify({ derivationVersion: 2, items: shape(items), pool: shape(pool) }));
}

export function companionIsCurrent(published, fingerprint) {
  return !!published?.sourceFingerprint && published.sourceFingerprint === fingerprint;
}

export function sessionRevisionId(fingerprint, published) {
  return sha256(stableStringify({ fingerprint, published }));
}

export function companionDraftRevision(draft) {
  return draft ? sha256(stableStringify(draft)) : null;
}

// Identifies one specific question actually shown to a student — not just
// "this grammar point", but this exact prompt/options/tokens. Two different
// sessions deriving the identical question (nothing in the source changed)
// get the identical fingerprint; that's what lets a later session recognise
// "this is the same question that was answer-revealed before" (see
// taintedAssistanceState below) instead of resetting to a clean slate just
// because the student started a new session.
export function questionFingerprint(grammarId, step, drill) {
  return sha256(stableStringify({
    grammarId, step,
    variant: drill.variant || null,
    prompt: drill.prompt || null,
    sentence: drill.sentence || null,
    example: drill.example || null,
    indonesian: drill.indonesian || null,
    options: drill.options || null,
    tokens: drill.tokens || null,
    correctIndex: drill.correctIndex ?? null,
    answer: drill.answer ?? null,
    japanese: drill.japanese ?? null,
  }));
}

// What assistance, if any, applies to the attempt about to be recorded for
// one session item. `tainted` means: this exact question (by fingerprint)
// was answer-revealed to this student before, in an earlier session — so a
// "first" answer in a brand new session is not independent evidence either.
// Order matters: a carried-over taint outranks this session's own state,
// which outranks a same-session hint.
export function deriveAssistanceState({ hintServedAt, revealedAt, tainted }) {
  if (tainted || revealedAt) return 'answer_served';
  if (hintServedAt) return 'hint_served';
  return 'none_observed';
}

export function independentEligible(assistanceState) {
  return assistanceState === 'none_observed';
}

// Public (redacted) view of one session item — the analogue of
// grammar-drills.js#publicDrill, but session-aware: once an item is passed,
// or its key has been legitimately revealed, the earlier hidden fields are
// safe to include because the server itself already decided disclosure was
// allowed (T05/T07 — never inferred client-side from wrongCount alone).
export function publicSessionItem(row) {
  const snap = row.snapshot || {};
  const isArrange = snap.variant === 'arrange';
  const revealed = !!row.revealed_at || row.passed === true;
  const out = {
    itemId: row.item_id,
    grammarId: row.grammar_id,
    step: row.step,
    variant: snap.variant || null,
    prompt: snap.prompt || null,
    example: snap.example || null,
    sentence: snap.sentence || null,
    indonesian: snap.indonesian || null,
    options: isArrange ? null : (snap.options || null),
    tokens: isArrange ? (snap.tokens || null) : null,
    wrongCount: row.wrong_count || 0,
    passed: row.passed === true,
    revealed: !!row.revealed_at,
    completed: revealed,
    saved: true,
    answered: row.answered_at != null,
    hintAvailable: !!(snap.overlayHint) && !row.hint_served_at && !revealed,
    hint: row.hint_served_at ? (snap.overlayHint || null) : null,
    revealEligible: !revealed && (row.wrong_count || 0) >= DRILL_MAX_WRONG,
  };
  if (revealed) {
    out.correctIndex = isArrange ? null : (snap.correctIndex ?? null);
    out.correctOrder = isArrange ? (snap.answer || null) : null;
    out.japanese = isArrange ? (snap.japanese || null) : null;
    out.explanation = snap.overlayExplanation || null;
  }
  return out;
}

// ── Companion envelope validation (admin draft/publish) ────────────────────
// `grammarIds` = the set of module_grammar ids that actually belong to this
// lesson (its own cards) and its paired task — publish must not reference
// anything outside that scope (implementation plan §5: "Publikasi wajib
// memastikan semua grammarId milik lesson/tugas terkait").
export function validateCompanionEnvelope(envelope, grammarIds) {
  const errors = [];
  const known = new Set(grammarIds || []);
  const env = isPlainObject(envelope) ? envelope : {};

  if (env.objective != null) {
    const o = String(env.objective).trim();
    if (o.length > OBJECTIVE_MAX) {
      errors.push(`objective melebihi ${OBJECTIVE_MAX} karakter — tujuan pelajaran harus cukup satu kalimat`);
    }
  }

  if (env.directions != null) {
    if (!isPlainObject(env.directions)) {
      errors.push('directions harus berupa object {grammarId: teks}');
    } else {
      for (const [gid, text] of Object.entries(env.directions)) {
        if (!known.has(gid)) errors.push(`directions memuat grammarId di luar cakupan: ${gid}`);
        if (String(text ?? '').length > DIRECTION_MAX) errors.push(`arahan menyimak untuk ${gid} melebihi ${DIRECTION_MAX} karakter`);
      }
    }
  }

  if (env.overlays != null) {
    if (!isPlainObject(env.overlays)) {
      errors.push('overlays harus berupa object {grammarId: {step1?, step2?}}');
    } else {
      for (const [gid, byStep] of Object.entries(env.overlays)) {
        if (!known.has(gid)) errors.push(`overlays memuat grammarId di luar cakupan: ${gid}`);
        if (!isPlainObject(byStep)) { errors.push(`overlay untuk ${gid} harus berupa object`); continue; }
        for (const stepKey of ['step1', 'step2']) {
          const tier = byStep[stepKey];
          if (tier == null) continue;
          if (!isPlainObject(tier)) { errors.push(`overlay ${gid}.${stepKey} harus berupa object`); continue; }
          for (const field of ['hint', 'explanation']) {
            if (tier[field] != null && String(tier[field]).length > OVERLAY_TEXT_MAX) {
              errors.push(`${gid}.${stepKey}.${field} melebihi ${OVERLAY_TEXT_MAX} karakter`);
            }
          }
        }
      }
    }
  }

  if (env.dialogChecks != null) {
    if (!isPlainObject(env.dialogChecks)) {
      errors.push('dialogChecks harus berupa object {grammarId: {comprehension, comparison}}');
    } else {
      for (const [gid, check] of Object.entries(env.dialogChecks)) {
        if (!known.has(gid)) errors.push(`dialogChecks memuat grammarId di luar cakupan: ${gid}`);
        if (!isPlainObject(check)) { errors.push(`dialogChecks.${gid} harus berupa object`); continue; }
        for (const [field, label] of [['comprehension', 'soal pemahaman'], ['comparison', 'soal pembanding']]) {
          if (check[field] == null) continue;
          const r = validateDialogCheckQuestion(check[field], `${gid} ${label}`);
          if (!r.ok) errors.push(...r.errors);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// Normalizes a raw envelope into the stored shape, dropping anything not
// recognised rather than persisting arbitrary admin-supplied keys.
export function sanitizeCompanionEnvelope(raw) {
  const env = isPlainObject(raw) ? raw : {};
  const out = { schemaVersion: COMPANION_SCHEMA_VERSION };
  if (typeof env.objective === 'string' && env.objective.trim()) out.objective = env.objective.trim();
  if (isPlainObject(env.directions)) {
    const dirs = {};
    for (const [gid, text] of Object.entries(env.directions)) {
      const t = String(text ?? '').trim();
      if (t) dirs[gid] = t;
    }
    if (Object.keys(dirs).length) out.directions = dirs;
  }
  if (isPlainObject(env.overlays)) {
    const overlays = {};
    for (const [gid, byStep] of Object.entries(env.overlays)) {
      if (!isPlainObject(byStep)) continue;
      const tiers = {};
      for (const stepKey of ['step1', 'step2']) {
        const tier = byStep[stepKey];
        if (!isPlainObject(tier)) continue;
        const cleaned = {};
        if (typeof tier.hint === 'string' && tier.hint.trim()) cleaned.hint = tier.hint.trim();
        if (typeof tier.explanation === 'string' && tier.explanation.trim()) cleaned.explanation = tier.explanation.trim();
        if (Object.keys(cleaned).length) tiers[stepKey] = cleaned;
      }
      if (Object.keys(tiers).length) overlays[gid] = tiers;
    }
    if (Object.keys(overlays).length) out.overlays = overlays;
  }
  if (isPlainObject(env.dialogChecks)) {
    const checks = {};
    for (const [gid, check] of Object.entries(env.dialogChecks)) {
      if (!isPlainObject(check)) continue;
      const cleaned = {};
      for (const field of ['comprehension', 'comparison']) {
        const q = check[field];
        if (!isPlainObject(q)) continue;
        const prompt = String(q.prompt ?? '').trim();
        // Opsi TIDAK disaring dari yang kosong: membuang satu opsi di tengah
        // akan menggeser indeks dan diam-diam memindahkan kunci jawaban ke
        // opsi lain. Soal yang punya opsi kosong dibuang utuh, bukan
        // "dirapikan" jadi soal yang jawabannya salah.
        const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()) : [];
        if (!prompt || options.length < CHECK_MIN_OPTIONS || options.some((o) => !o)) continue;
        const idx = Number(q.correctIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) continue;
        const outQ = { prompt, options, correctIndex: idx };
        const ex = String(q.explanation ?? '').trim();
        if (ex) outQ.explanation = ex;
        cleaned[field] = outQ;
      }
      if (Object.keys(cleaned).length) checks[gid] = cleaned;
    }
    if (Object.keys(checks).length) out.dialogChecks = checks;
  }
  if (typeof env.sourceFingerprint === 'string' && env.sourceFingerprint) out.sourceFingerprint = env.sourceFingerprint;
  for (const stampField of ['editor', 'publishedBy']) {
    const stamp = env[stampField];
    if (isPlainObject(stamp) && typeof stamp.email === 'string' && typeof stamp.at === 'string') {
      out[stampField] = { email: stamp.email, at: stamp.at };
    }
  }
  return out;
}

// Mirrors grammar-task.js's RULE_ERROR (same table, duplicated rather than
// imported — see the DRILL_MAX_WRONG note above for why: that file is one of
// the ones this pilot must not otherwise touch). Maps a drill's derivation
// `rule` to the primary_error label recorded on a failed grammar_attempts row.
export const RULE_ERROR = {
  arrange: 'wrong_word_order',
  'particle-swap': 'wrong_particle',
  'particle-append': 'wrong_particle',
  masu: 'wrong_conjugation',
  desu: 'wrong_conjugation',
  nai: 'wrong_conjugation',
  tai: 'wrong_conjugation',
  te: 'wrong_conjugation',
};

export function primaryErrorFor(step, drillRule) {
  // Step 1 (fungsi pola) dan step 4 (pemahaman dialog) sama-sama menguji
  // MAKNA, jadi kegagalannya dilabeli sama; step 2 dan 5 menguji pemakaian
  // bentuk di kalimat, jadi jatuh ke label pola/aturan.
  if (step === STEP_RECOGNITION || step === STEP_DIALOG_COMPREHENSION) return 'meaning_mismatch';
  return RULE_ERROR[drillRule] || 'wrong_grammar_pattern';
}

// Satu-satunya tempat step -> grammar_attempts.source dipetakan. Dibuat
// sebagai fungsi (bukan ekspresi inline di route) supaya penambahan jenis
// item berikutnya tidak bisa diam-diam jatuh ke 'controlled' karena sebuah
// ternary di file lain tidak ikut diperbarui.
export function attemptSourceFor(step) {
  if (step === STEP_RECOGNITION) return 'recognition';
  if (step === STEP_CONTROLLED) return 'controlled';
  return DIALOG_CHECK_SOURCE[step] || 'controlled';
}

// Same 200-char text-of-the-answer convention as the legacy
// POST /grammar-task/drill-answer, so grammar_attempts.sentence reads the
// same way regardless of which route produced the row.
export function answerSentenceFor(drill, { isArrange, order, optionIndex }) {
  const text = isArrange
    ? (order || []).map((i) => drill.tokens[i]).filter(Boolean).join(' ')
    : (drill.options[optionIndex] || '');
  return String(text).slice(0, 200);
}

// Default pilot session lifetime. Longer than Smart Review's 45 minutes
// (smart-review.js#SESSION_MINUTES) because one Tugas Bunpou session can
// cover several grammar points' Step 1 *and* Step 2 in one sitting — a
// product policy, not a researched number (see implementation plan §6 on
// the equally-unresearched two-mistake reveal threshold).
export const SESSION_MINUTES = 120;

// What the public content serializer (routes/content.js) attaches to the
// one lesson the pilot is scoped to — objective + per-grammar listening
// direction only. Overlay hints/explanations are deliberately NOT part of
// this view: those are delivered through the session API's hint/reveal
// endpoints instead, at the point disclosure is actually earned, never
// bundled into a page's initial payload (implementation plan §5: "jangan
// kirim draft/kunci lewat /courses atau respons pelajaran").
export function publicCompanionView(published) {
  if (!published) return null;
  return {
    objective: published.objective || null,
    directions: published.directions || {},
  };
}

export function overlayFor(published, grammarId, step) {
  const tier = published && published.overlays && published.overlays[grammarId];
  const t = tier && tier[`step${step}`];
  return t || null;
}

// Server-computed scope: is this lesson the one lesson the pilot is
// currently switched on for? Both settings must agree — a stray/misspelled
// bunpou_flow_pilot_lesson_id with the flag on must not silently light up
// the wrong lesson, and the flag itself defaults OFF (see
// routes/grammar-task-sessions.js#loadPilotConfig).
export function isPilotLesson(config, lessonId) {
  return !!(config && config.enabled && config.lessonId && lessonId && config.lessonId === lessonId);
}

// ── Paket 2: pemeriksaan mandiri (soal pemahaman dialog + pembanding) ──────
// Nomor step dipakai sebagai satu-satunya pembeda jenis item sesi, supaya
// seluruh mesin Paket 1 (publicSessionItem, handler /answer, fingerprint,
// index UNIQUE slot) berlaku apa adanya tanpa kolom "kind" baru. Angka 3
// SENGAJA dilewati — lihat komentar panjang di migrasi 150.
export const STEP_RECOGNITION = 1;
export const STEP_CONTROLLED = 2;
export const STEP_DIALOG_COMPREHENSION = 4;
export const STEP_DIALOG_COMPARISON = 5;
export const DIALOG_CHECK_STEPS = Object.freeze([STEP_DIALOG_COMPREHENSION, STEP_DIALOG_COMPARISON]);

// Bukti pemeriksaan ditulis ke bucket grammar_attempts.source yang SUDAH ADA
// (enum-nya sengaja tidak diperluas, lihat migrasi 150): pemahaman dialog
// adalah bukti mengenali makna pola di konteks, pembanding adalah bukti
// memakai pola itu di kalimat lain.
export const DIALOG_CHECK_SOURCE = Object.freeze({
  [STEP_DIALOG_COMPREHENSION]: 'recognition',
  [STEP_DIALOG_COMPARISON]: 'controlled',
});

const CHECK_PROMPT_MAX = 300;
const CHECK_OPTION_MAX = 160;
const CHECK_EXPLANATION_MAX = 500;
const CHECK_MIN_OPTIONS = 3;
const CHECK_MAX_OPTIONS = 4;

// Normalisasi khusus perbandingan "seberapa mirip dua soal" — bukan untuk
// ditampilkan. Spasi (termasuk U+3000), tanda baca Jepang/Latin, dan beda
// lebar karakter dibuang supaya "はい、そうです。" dan "はい そうです"
// dihitung sebagai jawaban yang sama, bukan dua opsi berbeda.
function normalizeCheckText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[。、．，・!?！？「」『』（）()]/g, '')
    .toLowerCase();
}

// Item family ID internal (rencana Paket 2: "Gunakan item family ID internal
// untuk mendeteksi variasi yang terlalu dekat").
//
// SENGAJA tidak memasukkan teks pertanyaan: yang dilarang rencana itu
// "soal pembanding yang sekadar memindahkan posisi opsi dari soal yang baru
// dikerjakan", dan pemindahan posisi tidak mengubah teks pertanyaan sama
// sekali. Karena opsi diurutkan sebelum di-hash, permutasi murni menghasilkan
// family yang IDENTIK dan langsung ketahuan. Jawaban benar ikut di-hash,
// sehingga dua soal yang memakai opsi sama tapi menanyakan hal berbeda
// (jawaban benarnya beda) tetap dihitung sebagai keluarga yang berbeda —
// itu memang dua soal yang berbeda, bukan variasi dangkal.
export function dialogCheckFamilyId(question) {
  const q = isPlainObject(question) ? question : {};
  const options = Array.isArray(q.options) ? q.options : [];
  const answer = options[Number(q.correctIndex)];
  return sha256(stableStringify({
    o: options.map(normalizeCheckText).filter(Boolean).sort(),
    a: normalizeCheckText(answer),
  })).slice(0, 16);
}

// Validasi struktural satu soal. `label` cuma untuk pesan error yang bisa
// dibaca admin.
export function validateDialogCheckQuestion(question, label) {
  const errors = [];
  if (!isPlainObject(question)) return { ok: false, errors: [`${label} harus berupa object`] };

  const prompt = String(question.prompt ?? '').trim();
  if (!prompt) errors.push(`${label}: pertanyaan wajib diisi`);
  else if (prompt.length > CHECK_PROMPT_MAX) errors.push(`${label}: pertanyaan melebihi ${CHECK_PROMPT_MAX} karakter`);

  const options = Array.isArray(question.options) ? question.options.map((o) => String(o ?? '').trim()) : null;
  if (!options) {
    errors.push(`${label}: options harus berupa array`);
  } else {
    if (options.length < CHECK_MIN_OPTIONS || options.length > CHECK_MAX_OPTIONS) {
      errors.push(`${label}: jumlah opsi harus ${CHECK_MIN_OPTIONS}-${CHECK_MAX_OPTIONS}, sekarang ${options.length}`);
    }
    if (options.some((o) => !o)) errors.push(`${label}: ada opsi kosong`);
    if (options.some((o) => o.length > CHECK_OPTION_MAX)) errors.push(`${label}: ada opsi melebihi ${CHECK_OPTION_MAX} karakter`);
    // Dua opsi yang secara makna sama membuat soal punya lebih dari satu
    // jawaban benar — tidak bisa dinilai adil, jadi ditolak di sini bukan
    // dibiarkan lolos ke siswa.
    const normalized = options.map(normalizeCheckText);
    if (new Set(normalized).size !== normalized.length) errors.push(`${label}: ada opsi kembar`);

    const idx = Number(question.correctIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      errors.push(`${label}: correctIndex harus menunjuk salah satu opsi`);
    }
  }

  if (question.explanation != null && String(question.explanation).length > CHECK_EXPLANATION_MAX) {
    errors.push(`${label}: pembahasan melebihi ${CHECK_EXPLANATION_MAX} karakter`);
  }

  return { ok: errors.length === 0, errors };
}

// Apakah pemeriksaan untuk satu pola benar-benar layak disajikan ke siswa.
//
// Rencana Paket 2, harfiah: "Bila tidak ada soal pembanding yang layak,
// tandai pemeriksaan belum tersedia. Jangan meloloskan siswa berdasarkan
// soal rekaan yang belum ditinjau." Jadi fungsi ini TIDAK pernah mengarang
// pengganti dan tidak pernah menyajikan separuh pemeriksaan — kedua soal
// harus ada, sah, dan berasal dari keluarga yang berbeda.
export function dialogCheckAvailability(check) {
  const c = isPlainObject(check) ? check : {};
  if (!isPlainObject(c.comprehension) && !isPlainObject(c.comparison)) {
    return { available: false, reason: 'belum_ada_soal' };
  }
  const comp = validateDialogCheckQuestion(c.comprehension, 'soal pemahaman');
  if (!comp.ok) return { available: false, reason: 'pemahaman_tidak_sah', errors: comp.errors };

  const cmp = validateDialogCheckQuestion(c.comparison, 'soal pembanding');
  if (!cmp.ok) return { available: false, reason: 'pembanding_tidak_sah', errors: cmp.errors };

  const famA = dialogCheckFamilyId(c.comprehension);
  const famB = dialogCheckFamilyId(c.comparison);
  if (famA === famB) {
    return {
      available: false,
      reason: 'pembanding_terlalu_dekat',
      errors: ['soal pembanding memakai opsi dan jawaban yang sama dengan soal pemahaman — ganti kalimat/situasinya, bukan urutan opsinya'],
      familyId: famA,
    };
  }
  return { available: true, families: { comprehension: famA, comparison: famB } };
}

// Menurunkan dua item sesi (pemahaman + pembanding) dari satu entri
// dialogChecks. Mengembalikan array KOSONG kalau pemeriksaannya tidak layak
// — tidak pernah separuh, dan tidak pernah mengarang pengganti: rencana
// Paket 2 melarang meloloskan siswa lewat soal yang belum ditinjau.
//
// Bentuk yang dikembalikan sengaja meniru keluaran deriveDrills()
// (variant/prompt/options/correctIndex), supaya publicSessionItem(),
// handler /answer, questionFingerprint(), dan renderer Step 1 di
// welcome.html semuanya berlaku apa adanya — nol renderer kedua.
export function dialogCheckDrills(check) {
  const avail = dialogCheckAvailability(check);
  if (!avail.available) return [];
  const build = (q, step, kind, familyId) => ({
    variant: 'choice',
    step,
    prompt: String(q.prompt).trim(),
    options: q.options.map((o) => String(o).trim()),
    correctIndex: Number(q.correctIndex),
    checkKind: kind,
    checkFamilyId: familyId,
    explanation: q.explanation ? String(q.explanation).trim() : null,
  });
  return [
    build(check.comprehension, STEP_DIALOG_COMPREHENSION, 'comprehension', avail.families.comprehension),
    build(check.comparison, STEP_DIALOG_COMPARISON, 'comparison', avail.families.comparison),
  ];
}
