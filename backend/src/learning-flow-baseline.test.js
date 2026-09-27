import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { summarizeLearningFlowBaseline } from './learning-flow-baseline.js';
import { main, parseArgs } from '../scripts/summarize-learning-flow-baseline.mjs';

const commitSha = 'a'.repeat(40);
const event = (durationMs, queryCount, operation = 'inline_fetch') => ({
  event: 'learning_flow_request', schemaVersion: 1,
  timestamp: '2026-09-27T00:00:00.000Z', operation, status: 200,
  outcome: 'success', durationMs, queryCount,
});
const lines = samples => samples.map(sample => JSON.stringify(sample));

test('baseline groups by fixed operation and uses nearest-rank p50/p95 without PASS claims', () => {
  const input = lines([event(100, 4), event(10, 1), event(30, 3), event(20, 2),
    event(25, 5, 'dialogue_answer')]);
  const summary = summarizeLearningFlowBaseline(input, { environment: 'staging', commitSha });
  assert.equal(summary.sampleCount, 5);
  assert.deepEqual(summary.operations.inline_fetch, { sampleCount: 4,
    durationMs: { p50: 20, p95: 100 }, queryCount: { p50: 2, p95: 4 } });
  assert.deepEqual(summary.operations.dialogue_answer, { sampleCount: 1,
    durationMs: { p50: 25, p95: 25 }, queryCount: { p50: 5, p95: 5 } });
  assert.equal(summary.provenance, 'operator_supplied_unverified');
  assert.equal(summary.readinessDecision, 'not_evaluated');
  assert.doesNotMatch(JSON.stringify(summary), /PASS|learner|sessionId|questionId/);
});

test('baseline fails closed on missing metadata, private fields, missing or capped counts', () => {
  const good = event(10, 2);
  for (const metadata of [{ environment: '', commitSha },
    { environment: 'staging', commitSha: 'bad' }]) {
    assert.throws(() => summarizeLearningFlowBaseline(lines([good]), metadata),
      /baseline_metadata_required/);
  }
  for (const bad of [
    { ...good, userId: 'private' }, { ...good, sql: 'SELECT private' },
    { ...good, queryCount: undefined }, { ...good, queryCountCapped: true },
    { ...good, operation: 'private-route' }, { ...good, durationMs: -1 },
    { ...good, status: 500, outcome: 'success' },
    { ...good, timestamp: 'yesterday' },
  ]) assert.throws(() => summarizeLearningFlowBaseline(lines([bad]),
    { environment: 'staging', commitSha }), /baseline_event_invalid/);
  assert.throws(() => summarizeLearningFlowBaseline(['{'],
    { environment: 'staging', commitSha }), /baseline_event_invalid/);
  assert.throws(() => summarizeLearningFlowBaseline([], { environment: 'staging', commitSha }),
    /baseline_samples_invalid/);
});

test('CLI requires explicit input, environment, and commit exactly once', () => {
  assert.deepEqual(parseArgs(['--input', 'events.ndjson', '--environment', 'staging',
    '--commit', commitSha]), { input: 'events.ndjson', environment: 'staging', commitSha });
  for (const args of [[], ['--input', 'events.ndjson'],
    ['--input', 'a', '--input', 'b', '--environment', 'staging', '--commit', commitSha],
    ['--input', 'a', '--environment', 'staging', '--commit', commitSha, '--pass', 'true']]) {
    assert.throws(() => parseArgs(args), /baseline_arguments_invalid/);
  }
});

test('CLI reads a local NDJSON file and emits only the unverified summary', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'learning-flow-baseline-test-'));
  const input = join(directory, 'events.ndjson');
  t.after(async () => { await unlink(input); await rmdir(directory); });
  await writeFile(input, `${lines([event(12, 3)]).join('\n')}\n`);
  const output = [];
  t.mock.method(process.stdout, 'write', chunk => { output.push(String(chunk)); return true; });
  const result = await main(['--input', input, '--environment', 'staging', '--commit', commitSha]);
  assert.deepEqual(JSON.parse(output.join('')), result);
  assert.equal(result.operations.inline_fetch.queryCount.p95, 3);
  assert.equal(result.readinessDecision, 'not_evaluated');
});
