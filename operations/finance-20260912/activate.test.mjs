import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { activate, snapshotFiles, scratchName } from './activate.mjs';

for (const failure of ['preflight', 'backupAndRehearse', 'migrate', 'captureConfiguration', 'enable', 'verify', null]) {
  test(`activation ${failure ? `failure at ${failure}` : 'success'} retains ordering and rollback boundaries`, async () => {
    const calls = [];
    const stages = ['preflight', 'backupAndRehearse', 'migrate', 'captureConfiguration', 'enable', 'verify'];
    const ops = Object.fromEntries(stages.map(stage => [stage, async () => {
      calls.push(stage);
      if (stage === failure) throw new Error(stage);
      if (stage === 'captureConfiguration') return async () => calls.push('restoreConfiguration');
    }]));
    if (failure) await assert.rejects(activate(ops), { message: failure });
    else await activate(ops);
    const expected = failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages;
    if (['enable', 'verify'].includes(failure)) expected.push('restoreConfiguration');
    assert.deepEqual(calls, expected);
  });
}

test('rollback restores exact previous bytes and removes only newly created Finance config', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'eznihongo-finance-config-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const previous = path.join(dir, 'existing.env');
  const added = path.join(dir, 'finance.conf');
  const unrelated = path.join(dir, 'unrelated.env');
  writeFileSync(previous, 'FINANCE_ENABLED=false\nSENTINEL=preserved\n');
  chmodSync(previous, 0o640);
  writeFileSync(unrelated, 'untouched');
  const restore = snapshotFiles([previous, added], dir);
  writeFileSync(previous, 'new');
  writeFileSync(added, 'new');
  restore();
  assert.equal(readFileSync(previous, 'utf8'), 'FINANCE_ENABLED=false\nSENTINEL=preserved\n');
  assert.equal(existsSync(added), false);
  assert.equal(readFileSync(unrelated, 'utf8'), 'untouched');
  if (process.platform !== 'win32') assert.equal(statSync(previous).mode & 0o777, 0o640);
});

test('scratch database name cannot equal production or contain injected SQL', () => {
  const name = scratchName('eznihongo', '0123456789abcdef');
  assert.equal(name, 'eznihongo_finance_restore_0123456789abcdef');
  assert.throws(() => scratchName(name, '0123456789abcdef'));
  for (const suffix of ['', 'x'.repeat(16), 'abc; DROP DATABASE production', '0'.repeat(17)]) {
    assert.throws(() => scratchName('eznihongo', suffix));
  }
});
