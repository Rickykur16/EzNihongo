// Paket 3 — kebijakan penguasaan berversi (mode shadow).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeConceptMastery } from './grammar-mastery.js';
import {
  computeConceptMasteryV2, compareMastery, summarizeEvidence, classifyAttempt,
  hasEvidenceMetadata, resolvePolicy, EVIDENCE, V2_CONFIG, POLICY_V1, POLICY_V2,
} from './grammar-mastery-policy.js';

const NOW = Date.UTC(2026, 8, 17);
const at = (days) => new Date(NOW - days * 86400000).toISOString();

const independent = (i, over = {}) => ({
  passed: true, created_at: at(i), source: 'recognition',
  assistance_state: 'none_observed', independent_eligible: true,
  question_fingerprint: 'q' + i, ...over,
});
const legacy = (i, over = {}) => ({ passed: true, created_at: at(i), source: 'recognition', ...over });

// ── Gerbang kebijakan ─────────────────────────────────────────────────────

test('the proposed thresholds are explicitly unratified', () => {
  assert.equal(V2_CONFIG.ratified, false);
});

test('the active policy defaults to v1 and only an exact "v2" switches it', () => {
  assert.equal(resolvePolicy(undefined), POLICY_V1);
  assert.equal(resolvePolicy(null), POLICY_V1);
  assert.equal(resolvePolicy(''), POLICY_V1);
  assert.equal(resolvePolicy('true'), POLICY_V1);
  assert.equal(resolvePolicy('V2'), POLICY_V1, 'case-sensitive on purpose');
  assert.equal(resolvePolicy('v2'), POLICY_V2);
});

// ── Invarian yang paling penting ──────────────────────────────────────────

test('v2 never fails a student that v1 would not: it only ever withholds MASTERED', () => {
  const RANK = { UNSEEN: 0, NEEDS_PRACTICE: 1, LEARNING: 2, PROGRESSING: 3, MASTERED: 4 };
  const cases = [
    [],
    [legacy(0, { passed: false })],
    [legacy(0, { passed: false }), legacy(1, { passed: false })],
    [legacy(0, { passed: false }), legacy(1, { passed: false }), legacy(2)],
    [independent(0), independent(1), independent(2), independent(3)],
    [independent(0), independent(1, { passed: false }), independent(2), independent(3)],
    [{ ...independent(0), source: 'production' }, independent(1), independent(2), independent(3)],
    [legacy(0), legacy(1), legacy(2), legacy(3), legacy(4)],
  ];
  for (const rows of cases) {
    const v1 = computeConceptMastery(rows, NOW);
    const v2 = computeConceptMasteryV2(rows, NOW);
    if (v1.state === v2.state) continue;
    assert.equal(v1.state, 'MASTERED', `hanya MASTERED yang boleh ditahan, bukan ${v1.state}→${v2.state}`);
    assert.equal(v2.state, 'PROGRESSING');
    assert.ok(RANK[v2.state] < RANK[v1.state]);
  }
});

test('v2 never changes the score — accuracy did not change, only our confidence in calling it mastery', () => {
  const rows = [independent(0), independent(1), independent(2), independent(3)];
  assert.equal(computeConceptMasteryV2(rows, NOW).score, computeConceptMastery(rows, NOW).score);
});

// ── Empat kasus yang rencana minta ditinjau ───────────────────────────────

test('four correct recognition answers alone do not prove mastery', () => {
  const rows = [0, 1, 2, 3].map((i) => independent(i));
  assert.equal(computeConceptMastery(rows, NOW).state, 'MASTERED');
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v2.state, 'PROGRESSING');
  assert.match(v2.withheldReasons.join(' '), /produksi/);
  assert.ok(compareMastery(computeConceptMastery(rows, NOW), v2).flags.includes('recognition_only'));
});

test('passes that all came after assistance are not independent evidence', () => {
  const rows = [0, 1, 2, 3].map((i) => independent(i, {
    assistance_state: 'answer_served', independent_eligible: false,
  }));
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v2.evidence.independentPasses, 0);
  assert.equal(v2.evidence.passed[EVIDENCE.ASSISTED], 4);
  assert.ok(compareMastery(computeConceptMastery(rows, NOW), v2).flags.includes('assisted_passes_only'));
});

test('the same question answered four times counts as one question', () => {
  const rows = [0, 1, 2, 3].map((i) => independent(i, { question_fingerprint: 'SAME' }));
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v2.evidence.distinctQuestions, 1);
  assert.match(v2.withheldReasons.join(' '), /variasi/);
  assert.ok(compareMastery(computeConceptMastery(rows, NOW), v2).flags.includes('repeated_question'));
});

test('real production evidence lets mastery stand', () => {
  const rows = [
    { passed: true, created_at: at(0), source: 'production', eval_source: 'ai' },
    independent(1), independent(2), independent(3),
  ];
  const v1 = computeConceptMastery(rows, NOW);
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v1.state, 'MASTERED');
  assert.equal(v2.state, 'MASTERED', 'tidak ditahan');
  assert.deepEqual(v2.withheldReasons, []);
  assert.ok(compareMastery(v1, v2).flags.includes('has_production_or_retention'));
});

// ── Riwayat lama ──────────────────────────────────────────────────────────

test('legacy attempts carry no evidence metadata and are classified as limited, never as failures', () => {
  const rows = [0, 1, 2, 3].map((i) => legacy(i));
  assert.equal(hasEvidenceMetadata(rows[0]), false);
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v2.evidence.tally[EVIDENCE.LIMITED], 4);
  assert.equal(v2.evidence.tally[EVIDENCE.ASSISTED], 0, 'bukan dianggap dibantu');
  assert.equal(v2.evidenceQuality, 'limited');
  // passedCount berasal dari v1 dan TIDAK boleh dinolkan.
  assert.equal(v2.passedCount, 4);
  assert.ok(compareMastery(computeConceptMastery(rows, NOW), v2).flags.includes('limited_history'));
});

test("an attempt whose assistance is recorded as 'unknown' is never counted as independent", () => {
  // CHECK migrasi 147 mengizinkan nilai ini, jadi ia bisa muncul di data —
  // dan barisnya secara harfiah menyatakan bahwa bantuannya TIDAK diketahui.
  // Menghitungnya sebagai bukti mandiri berarti mengklaim kemandirian dari
  // baris yang mengaku tidak tahu.
  const row = {
    passed: true, created_at: at(0), source: 'recognition',
    assistance_state: 'unknown', question_fingerprint: 'qX',
  };
  assert.equal(hasEvidenceMetadata(row), true, 'metadatanya ADA, cuma isinya tidak diketahui');
  assert.equal(classifyAttempt(row), EVIDENCE.LIMITED);

  const rows = [0, 1, 2, 3].map((i) => ({ ...row, created_at: at(i), question_fingerprint: 'q' + i }));
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v2.evidence.independentAttempts, 0);
  assert.equal(v2.evidence.distinctQuestions, 0, 'variasi dari baris tak diketahui tidak dihitung');
  assert.equal(computeConceptMastery(rows, NOW).state, 'MASTERED', 'v1 memang meluluskannya');
  assert.equal(v2.state, 'PROGRESSING', 'v2 menahan klaimnya');
  // Tetap BUKAN kegagalan: keberhasilannya utuh.
  assert.equal(v2.passedCount, 4);
  assert.equal(v2.evidence.tally[EVIDENCE.ASSISTED], 0);
});

// ── Retensi ───────────────────────────────────────────────────────────────

test('a later independent pass, far enough apart, counts as retention rather than repetition', () => {
  const rows = [independent(0), independent(30)];
  const ev = summarizeEvidence(rows);
  assert.equal(ev.tally[EVIDENCE.RETENTION], 1);
  assert.equal(ev.tally[EVIDENCE.INDEPENDENT], 1);
});

test('two passes in the same sitting are not retention', () => {
  const ev = summarizeEvidence([independent(0), independent(0.01)]);
  assert.equal(ev.tally[EVIDENCE.RETENTION], 0);
});

test('a free sentence is production evidence whatever its metadata', () => {
  assert.equal(classifyAttempt({ source: 'production', passed: true }), EVIDENCE.PRODUCTION);
});

// ── Pagar struktural: jalur siswa tidak boleh menyentuh kebijakan usulan ──

test('no student-facing module imports the proposed policy — shadow means shadow', () => {
  const studentPaths = [
    'src/grammar-mastery.js',
    'src/dashboard-service.js',
    'src/progress-detail-service.js',
    'src/routes/smart-review.js',
    'src/routes/recommendations.js',
    'src/routes/grammar-analysis.js',
    'src/routes/content.js',
    'src/routes/grammar-task.js',
    'src/routes/grammar-task-sessions.js',
  ];
  for (const rel of studentPaths) {
    const src = fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
    assert.ok(!src.includes('grammar-mastery-policy'), `${rel} mengimpor kebijakan usulan`);
    assert.ok(!src.includes('grammar-mastery-shadow'), `${rel} mengimpor pemuat shadow`);
  }
});
