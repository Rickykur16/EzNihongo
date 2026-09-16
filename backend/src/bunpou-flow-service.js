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
    recognitionDistractors: r.recognitionDistractors || [],
    controlledDistractors: r.controlledDistractors || [],
    examples: (r.examples || []).map((e) => ({
      japanese: e.japanese, highlight: e.highlight, indonesian: e.indonesian,
    })),
  }));
  return sha256(stableStringify({ items: shape(items), pool: shape(pool) }));
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
    answered: row.answered_at != null,
    hintAvailable: !!(snap.overlayHint) && !row.hint_served_at,
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
  return step === 1 ? 'meaning_mismatch' : (RULE_ERROR[drillRule] || 'wrong_grammar_pattern');
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
