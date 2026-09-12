import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { activate, inspectSchema, snapshotFiles, scratchName } from './activate.mjs';

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

test('actual Finance cleanup inspection runs inside its required transaction and releases locks', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.match(target.pathname, /test/);
  const require = createRequire(new URL('../../backend/package.json', import.meta.url));
  const pg = require('pg');
  const { applyFinanceMigration } = await import('../../backend/finance-migrations/run.js');
  const { inspectStaffErasureTables } = await import('../../backend/src/staff-erasure.js');
  const client = new pg.Client({ connectionString: target.href });
  const schema = `finance_activation_test_${process.pid}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}, public`);
    await client.query('CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE orders(id uuid PRIMARY KEY)');
    await applyFinanceMigration(client);
    assert.ok((await inspectSchema(client, inspectStaffErasureTables)).has('finance_audit'));
    assert.equal((await client.query("SELECT count(*)::int AS count FROM pg_locks WHERE pid=pg_backend_pid() AND mode='RowExclusiveLock'")).rows[0].count, 0);
    await assert.rejects(inspectSchema(client, async c => {
      await c.query("INSERT INTO finance_settings(id,start_date) VALUES(true,'2026-09-12')");
      throw new Error('inspection failure');
    }), { message: 'inspection failure' });
    assert.equal((await client.query('SELECT count(*)::int AS count FROM finance_settings')).rows[0].count, 0);
  } finally {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
