// Paket 2 — logika murni pemeriksaan mandiri. Flat di src/ karena
// package.json's "test": "node --test src/*.test.js" adalah glob shell POSIX
// yang TIDAK turun ke subfolder (pelajaran mahal dari tts.test.js, lihat
// CLAUDE.md): file tes di src/routes/ tidak akan pernah dijalankan CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dialogCheckFamilyId, dialogCheckAvailability, dialogCheckDrills,
  validateDialogCheckQuestion, validateCompanionEnvelope, sanitizeCompanionEnvelope,
  attemptSourceFor, primaryErrorFor,
  STEP_DIALOG_COMPREHENSION, STEP_DIALOG_COMPARISON,
} from './bunpou-flow-service.js';

const q = (over = {}) => ({
  prompt: 'Apa pekerjaan orang kedua?',
  options: ['insinyur', 'pelajar', 'guru'],
  correctIndex: 0,
  ...over,
});

// ── item family ID ────────────────────────────────────────────────────────

test('family id ignores option order, so a reordered copy is detected as the same question', () => {
  const original = q();
  const reordered = q({ options: ['guru', 'insinyur', 'pelajar'], correctIndex: 1 });
  assert.equal(dialogCheckFamilyId(original), dialogCheckFamilyId(reordered));
});

test('family id ignores the prompt wording, so rewording alone is not a new question', () => {
  assert.equal(
    dialogCheckFamilyId(q()),
    dialogCheckFamilyId(q({ prompt: 'Orang kedua bekerja sebagai apa?' })),
  );
});

test('family id separates questions that share options but have different answers', () => {
  assert.notEqual(dialogCheckFamilyId(q()), dialogCheckFamilyId(q({ correctIndex: 2 })));
});

test('family id ignores spacing and Japanese punctuation differences', () => {
  const a = q({ options: ['はい、そうです。', 'いいえ', 'わかりません'], correctIndex: 0 });
  const b = q({ options: ['はい そうです', 'いいえ', 'わかりません'], correctIndex: 0 });
  assert.equal(dialogCheckFamilyId(a), dialogCheckFamilyId(b));
});

// ── kelayakan ─────────────────────────────────────────────────────────────

test('a check needs both questions — a lone comprehension question is not served', () => {
  const r = dialogCheckAvailability({ comprehension: q() });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'pembanding_tidak_sah');
});

test('a comparison that only reshuffles the options is rejected as too close', () => {
  const r = dialogCheckAvailability({
    comprehension: q(),
    comparison: q({ options: ['pelajar', 'guru', 'insinyur'], correctIndex: 2 }),
  });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'pembanding_terlalu_dekat');
});

test('a genuinely different comparison passes and reports both families', () => {
  const r = dialogCheckAvailability({
    comprehension: q(),
    comparison: q({ prompt: 'Mana kalimat yang benar?', options: ['わたしはがくせいです', 'わたしをがくせいです', 'わたしにがくせいです'], correctIndex: 0 }),
  });
  assert.equal(r.available, true);
  assert.notEqual(r.families.comprehension, r.families.comparison);
});

test('duplicate options are rejected — two right answers cannot be graded fairly', () => {
  const r = validateDialogCheckQuestion(q({ options: ['guru', 'guru ', 'pelajar'] }), 'soal');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /opsi kembar/);
});

test('correctIndex outside the option list is rejected', () => {
  assert.equal(validateDialogCheckQuestion(q({ correctIndex: 9 }), 'soal').ok, false);
  assert.equal(validateDialogCheckQuestion(q({ correctIndex: -1 }), 'soal').ok, false);
});

// ── penurunan item sesi ───────────────────────────────────────────────────

test('an unavailable check yields no session items at all — never half a check', () => {
  assert.deepEqual(dialogCheckDrills({ comprehension: q() }), []);
  assert.deepEqual(dialogCheckDrills(undefined), []);
});

test('an available check yields exactly the two steps, shaped like a derived drill', () => {
  const drills = dialogCheckDrills({
    comprehension: q(),
    comparison: q({ prompt: 'Mana kalimat yang benar?', options: ['A です', 'A を です', 'A に です'], correctIndex: 0 }),
  });
  assert.equal(drills.length, 2);
  assert.deepEqual(drills.map((d) => d.step), [STEP_DIALOG_COMPREHENSION, STEP_DIALOG_COMPARISON]);
  for (const d of drills) {
    assert.equal(d.variant, 'choice');
    assert.ok(d.prompt && Array.isArray(d.options) && Number.isInteger(d.correctIndex));
    assert.ok(d.checkFamilyId, 'tiap item membawa family id-nya sendiri');
  }
});

// ── envelope ──────────────────────────────────────────────────────────────

test('dialogChecks outside the lesson scope is rejected', () => {
  const r = validateCompanionEnvelope({ dialogChecks: { gX: { comprehension: q() } } }, ['g1']);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /di luar cakupan/);
});

test('sanitize drops a question with a blank option instead of shifting the answer key', () => {
  // Opsi ke-2 kosong; jawaban benar ada di baris ke-3. Menyaring yang kosong
  // akan memindahkan kunci ke opsi lain tanpa ada yang sadar.
  const out = sanitizeCompanionEnvelope({
    dialogChecks: { g1: { comprehension: { prompt: 'P', options: ['a', '', 'c'], correctIndex: 2 } } },
  });
  assert.equal(out.dialogChecks, undefined);
});

test('sanitize round-trips a valid check without losing the explanation', () => {
  const out = sanitizeCompanionEnvelope({
    dialogChecks: { g1: { comprehension: { prompt: ' P ', options: [' a', 'b ', 'c'], correctIndex: 1, explanation: ' karena ... ' } } },
  });
  assert.deepEqual(out.dialogChecks.g1.comprehension, {
    prompt: 'P', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'karena ...',
  });
});

// ── pemetaan bukti ────────────────────────────────────────────────────────

test('check steps map onto the existing grammar_attempts.source buckets, never a new enum value', () => {
  const allowed = new Set(['production', 'controlled', 'recognition']);
  for (const step of [1, 2, STEP_DIALOG_COMPREHENSION, STEP_DIALOG_COMPARISON]) {
    assert.ok(allowed.has(attemptSourceFor(step)), `step ${step} -> ${attemptSourceFor(step)}`);
  }
  assert.equal(attemptSourceFor(STEP_DIALOG_COMPREHENSION), 'recognition');
  assert.equal(attemptSourceFor(STEP_DIALOG_COMPARISON), 'controlled');
});

test('comprehension failures are labelled as meaning errors, like step 1', () => {
  assert.equal(primaryErrorFor(STEP_DIALOG_COMPREHENSION), primaryErrorFor(1));
  assert.equal(primaryErrorFor(STEP_DIALOG_COMPARISON), 'wrong_grammar_pattern');
});
