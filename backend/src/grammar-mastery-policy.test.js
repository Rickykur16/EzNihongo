// Paket 3 — kebijakan penguasaan berversi (mode shadow).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeConceptMastery } from './grammar-mastery.js';
import { summarizeShadow } from './grammar-mastery-shadow.js';
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
    independent(0, { source: 'production', eval_source: 'ai' }),
    independent(1), independent(2), independent(3),
  ];
  const v1 = computeConceptMastery(rows, NOW);
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v1.state, 'MASTERED');
  assert.equal(v2.state, 'MASTERED', 'tidak ditahan');
  assert.equal(v2.evidence.independentProductionPasses, 1);
  assert.equal(v2.evidence.eligibleProductionPasses, 1);
  assert.deepEqual(v2.withheldReasons, []);
  assert.ok(compareMastery(v1, v2).flags.includes('has_production_or_retention'));
});

for (const assistance_state of ['hint_served', 'answer_served', 'correction_served']) {
  test(`${assistance_state} production plus three independent recognition passes stays progressing`, () => {
    // Explicit assistance overrides even a contradictory eligibility marker.
    const rows = [
      independent(0, { source: 'production', assistance_state }),
      independent(1), independent(2), independent(3),
    ];
    const v1 = computeConceptMastery(rows, NOW);
    const v2 = computeConceptMasteryV2(rows, NOW);
    assert.equal(classifyAttempt(rows[0]), EVIDENCE.ASSISTED);
    assert.equal(v1.state, 'MASTERED');
    assert.equal(v2.state, 'PROGRESSING');
    assert.equal(v2.evidence.independentPasses, 3);
    assert.equal(v2.evidence.independentProductionPasses, 0);
    assert.equal(v2.evidence.assistedProductionAttempts, 1);
    assert.equal(v2.evidence.assistedProductionPasses, 1);
    assert.equal(v2.evidence.tally.production, 1);
    assert.equal(v2.evidence.passed.production, 1);
    assert.equal(v2.passedCount, 4);
    assert.equal(v2.score, v1.score);
    assert.equal(v2.withheldReasons.length, 1);
    assert.match(v2.withheldReasons[0], /produksi mandiri/);
    const flags = compareMastery(v1, v2).flags;
    assert.ok(!flags.includes('recognition_only'));
    assert.ok(!flags.includes('has_production_or_retention'));
  });
}

test('production confidence counts preserve passed and failed attempts without double counting', () => {
  const rows = [
    independent(0, { source: 'production' }),
    independent(1, { source: 'production', passed: false }),
    independent(2, { source: 'production', independent_eligible: false }),
    independent(3, { source: 'production', assistance_state: 'correction_served', passed: false }),
    legacy(4, { source: 'production' }),
    legacy(5, { source: 'production', passed: false }),
    independent(6),
  ];
  const ev = summarizeEvidence(rows);
  assert.equal(ev.tally.production, 6);
  assert.equal(ev.passed.production, 3);
  for (const confidence of ['independent', 'assisted', 'limited']) {
    assert.equal(ev[`${confidence}ProductionAttempts`], 2);
    assert.equal(ev[`${confidence}ProductionPasses`], 1);
  }
  assert.equal(Object.values(ev.tally).reduce((a, b) => a + b, 0), rows.length);
  assert.equal(Object.values(ev.passed).reduce((a, b) => a + b, 0), 4);
  assert.equal(ev.independentAttempts, 1);
  assert.equal(ev.distinctQuestions, 1);
});

test('production assistance is reflected in comparison flags without hiding independent production', () => {
  const rows = [0, 1, 2, 3].map((i) => independent(i, {
    source: 'production', assistance_state: 'correction_served', independent_eligible: false,
  }));
  const flags = compareMastery(computeConceptMastery(rows, NOW), computeConceptMasteryV2(rows, NOW)).flags;
  assert.ok(flags.includes('assisted_passes_only'));
  assert.ok(!flags.includes('has_production_or_retention'));
  rows[0] = independent(0, { source: 'production' });
  assert.ok(!compareMastery(computeConceptMastery(rows, NOW), computeConceptMasteryV2(rows, NOW))
    .flags.includes('assisted_passes_only'));
});

test('the AI production flag filters qualifying passes while preserving total and independent evidence', () => {
  const cases = [
    [{ evaluation_kind: 'ai', eval_source: 'ai' }, true],
    [{ eval_source: 'cache' }, true],
    [{}, true],
    [{ evaluation_kind: 'ai', eval_source: 'smart_review' }, true],
    [{ evaluation_kind: 'deterministic', eval_source: 'ai' }, false],
    [{ eval_source: 'smart_review' }, false],
  ];
  for (const [metadata, isAi] of cases) {
    const rows = [independent(0, { source: 'production', ...metadata }), independent(1), independent(2), independent(3)];
    for (const countAiProductionAsEvidence of [true, false]) {
      const v2 = computeConceptMasteryV2(rows, NOW, { ...V2_CONFIG, countAiProductionAsEvidence });
      const qualifies = !isAi || countAiProductionAsEvidence;
      assert.equal(v2.state, qualifies ? 'MASTERED' : 'PROGRESSING', JSON.stringify(metadata));
      assert.equal(v2.evidence.passed.production, 1);
      assert.equal(v2.evidence.independentProductionPasses, 1);
      assert.equal(v2.evidence.aiProductionPasses, Number(isAi));
      assert.equal(v2.evidence.eligibleProductionPasses, Number(qualifies));
      assert.equal(compareMastery(computeConceptMastery(rows, NOW), v2)
        .flags.includes('has_production_or_retention'), qualifies);
    }
  }
  const mixed = summarizeEvidence([
    independent(0, { source: 'production', evaluation_kind: 'deterministic' }),
    independent(1, { source: 'production', evaluation_kind: 'ai', assistance_state: 'correction_served' }),
    legacy(2, { source: 'production', eval_source: 'ai' }),
  ], { config: { ...V2_CONFIG, countAiProductionAsEvidence: false } });
  assert.equal(mixed.passed.production, 3);
  assert.equal(mixed.aiProductionPasses, 2);
  assert.equal(mixed.independentProductionPasses, 1);
  assert.equal(mixed.eligibleProductionPasses, 1, 'assisted/limited AI passes do not subtract independent deterministic passes');
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

test('legacy production stays limited confidence and retains successful evidence in shadow reports', () => {
  const rows = [0, 1, 2, 3].map((i) => legacy(i, { source: 'production' }));
  const original = structuredClone(rows);
  const v1 = computeConceptMastery(rows, NOW);
  const v2 = computeConceptMasteryV2(rows, NOW);
  assert.equal(v1.state, 'MASTERED');
  assert.equal(v2.state, 'PROGRESSING');
  assert.equal(v2.evidenceQuality, 'limited');
  assert.equal(v2.passedCount, 4);
  assert.equal(v2.score, v1.score);
  assert.equal(v2.evidence.passed.production, 4);
  assert.equal(v2.evidence.limitedProductionPasses, 4);
  assert.equal(v2.evidence.independentProductionPasses, 0);
  assert.equal(v2.evidence.assistedProductionPasses, 0);
  const diff = compareMastery(v1, v2);
  assert.deepEqual(diff.flags, ['limited_history']);
  const report = summarizeShadow({ concepts: [{ v1, v2, diff }] });
  assert.equal(report.limitedHistoryConcepts, 1);
  assert.equal(report.byFlag.limited_history, 1);
  assert.deepEqual(rows, original);
});

test('partial and unknown metadata never establish independence, production eligibility, or retention', () => {
  const partials = [
    {},
    { evaluation_kind: 'ai' },
    { evaluation_kind: 'deterministic', question_fingerprint: 'partial' },
    { independent_eligible: true },
    { assistance_state: 'none_observed' },
    { assistance_state: 'none_observed', independent_eligible: null },
    { assistance_state: 'none_observed', independent_eligible: 'true' },
    { assistance_state: 'unknown', independent_eligible: true },
    { assistance_state: 'unknown', independent_eligible: false },
    { assistance_state: 'unexpected', independent_eligible: true },
  ];
  for (const source of ['recognition', 'production']) {
    for (const metadata of partials) {
      const row = legacy(0, { source, ...metadata });
      assert.equal(classifyAttempt(row, { previousPassAt: at(30) }), EVIDENCE.LIMITED, JSON.stringify(row));
      const v2 = computeConceptMasteryV2([row, independent(1), independent(2), independent(3)], NOW);
      assert.equal(v2.state, 'PROGRESSING');
      assert.equal(v2.evidence.independentAttempts, 3);
      assert.equal(v2.evidence.distinctQuestions, 3);
      assert.equal(v2.evidence.independentProductionPasses, 0);
      assert.equal(v2.evidence.limitedProductionPasses, source === 'production' ? 1 : 0);
      assert.equal(v2.evidence.tally.retention, 0);
      assert.equal(v2.passedCount, 4);
    }
  }
  const ev = summarizeEvidence([independent(0), legacy(30, { evaluation_kind: 'ai' })]);
  assert.equal(ev.tally.retention, 0, 'partial evidence cannot seed subsequent retention');
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

test('production classification requires explicit independence but source totals retain every sentence', () => {
  assert.equal(classifyAttempt(legacy(0, { source: 'production' })), EVIDENCE.LIMITED);
  assert.equal(classifyAttempt(independent(0, { source: 'production' })), EVIDENCE.PRODUCTION);
  assert.equal(summarizeEvidence([legacy(0, { source: 'production' })]).tally.production, 1);
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
