// One-time, explicitly authorized activation of the already deployed PR #310.
// Database credentials and backups stay on the VPS. Never log command errors,
// environment values, query results containing business data, or backup content.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync,
  chmodSync, chownSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const release = '60505806007c717e3dab5078396fd7ad48777c52';
const root = '/var/www/eznihongo';
const service = 'eznihongo-api';

export async function activate(ops) {
  await ops.preflight();
  await ops.backupAndRehearse();
  await ops.migrate();
  // Capture rollback state before any configuration write, including a partial
  // failure in enable(). DDL is additive and is deliberately retained on rollback.
  const restore = await ops.captureConfiguration();
  try {
    await ops.enable();
    await ops.verify();
  } catch (error) {
    await restore();
    throw error;
  }
}

export async function inspectSchema(client, inspect) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
    return await inspect(client);
  } finally { await client.query('ROLLBACK'); }
}

export function snapshotFiles(files, backupDirectory) {
  const snapshots = files.map((file, i) => {
    if (!existsSync(file)) return { file, absent: true };
    const info = statSync(file);
    assert.ok(info.isFile(), 'Configuration target must be a regular file');
    const bytes = readFileSync(file);
    writeFileSync(path.join(backupDirectory, `configuration-${i}.before`), bytes, { mode: 0o600, flag: 'wx' });
    return { file, bytes, mode: info.mode & 0o777, uid: info.uid, gid: info.gid };
  });
  return () => {
    for (const s of snapshots) {
      if (s.absent) { if (existsSync(s.file)) unlinkSync(s.file); }
      else {
        writeFileSync(s.file, s.bytes, { mode: s.mode });
        chmodSync(s.file, s.mode);
        if (process.platform !== 'win32') chownSync(s.file, s.uid, s.gid);
      }
    }
  };
}

export function scratchName(database, suffix) {
  assert.match(suffix, /^[0-9a-f]{16}$/);
  const name = `eznihongo_finance_restore_${suffix}`;
  assert.notEqual(name, database, 'Restore target must differ from production');
  return name;
}

function run(label, binary, args, options = {}) {
  try {
    return execFileSync(binary, args, { encoding: 'utf8', timeout: 300000,
      maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
  } catch { throw new Error(`Activation stopped: ${label}`); }
}

function runtimeEnvironment() {
  const pid = run('read service PID', 'systemctl', ['show', service, '-p', 'MainPID', '--value']);
  assert.match(pid, /^[1-9][0-9]*$/, 'API must be running');
  return Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
}

async function responseStatus(endpoint) {
  try {
    const response = await fetch(`http://127.0.0.1:3001${endpoint}`, { signal: AbortSignal.timeout(3000) });
    await response.arrayBuffer();
    return response.status;
  } catch { return 0; }
}

async function waitForApi(finance = false) {
  for (let i = 0; i < 15; i++) {
    if (await responseStatus('/api/health') === 200 &&
        (!finance || await responseStatus('/api/finance/access') === 401)) return;
    await delay(2000);
  }
  throw new Error('API health or Finance authentication check failed');
}

async function main() {
  assert.equal(process.platform, 'linux', 'Activation requires the production Linux VPS');
  assert.equal(process.getuid(), 0, 'Activation requires the existing root deployment identity');
  assert.equal(process.argv[2], '--activate-pr-310', 'Explicit activation argument required');
  const require = createRequire(`${root}/backend/package.json`);
  const pg = require('pg');
  const dotenv = require('dotenv');
  const { applyFinanceMigration } = await import(pathToFileURL(`${root}/backend/finance-migrations/run.js`));
  const { inspectStaffErasureTables } = await import(pathToFileURL(`${root}/backend/src/staff-erasure.js`));
  const finance = await import(pathToFileURL(`${root}/backend/src/finance-service.js`));
  let database, backupDirectory, pgEnvironment, connection, timezone, originalDatabase, appRole, databaseOwner, port;
  let restoreFiles;
  const settingsFile = '/etc/eznihongo/finance.env';
  const dropInFile = '/etc/systemd/system/eznihongo-api.service.d/99-eznihongo-finance.conf';
  const localPg = (label, binary, args, input) => run(label, 'runuser', [
    '-u', 'postgres', '--', binary, '-h', '/var/run/postgresql', '-p', String(port), ...args,
  ], { ...(typeof input === 'number' ? { stdio: [input, 'pipe', 'pipe'] } : { input }), cwd: '/tmp' });
  const sql = (label, statement) => localPg(label, 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'], statement);
  const quote = s => '"' + s.replaceAll('"', '""') + '"';
  const log = s => console.log(s);
  try {
    await activate({
      async preflight() {
        assert.equal(run('verify installed release', 'git', ['-C', root, 'rev-parse', 'HEAD']), release,
          'Installed release changed; review activation against the new release');
        run('verify unmodified release', 'git', ['-C', root, 'diff', '--quiet', 'HEAD', '--']);
        await waitForApi();
        const config = { ...dotenv.parse(readFileSync(`${root}/backend/.env`)), ...runtimeEnvironment() };
        connection = config.DATABASE_URL;
        const target = new URL(connection);
        assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
        assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Only the local production PostgreSQL is supported');
        // Do not silently discard connection settings when invoking libpq.
        assert.equal(target.search, '', 'Review non-default database connection options');
        database = new pg.Client({ connectionString: connection, connectionTimeoutMillis: 5000 });
        await database.connect();
        const identity = (await database.query(`SELECT current_database() AS db, current_user AS role, inet_server_port() AS port,
          pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()`)).rows[0];
        originalDatabase = identity.db; appRole = identity.role; databaseOwner = identity.owner; port = identity.port;
        assert.ok(originalDatabase && appRole && Number.isInteger(port));
        assert.equal(decodeURIComponent(target.pathname.slice(1)), originalDatabase);
        assert.equal(Number(target.port || 5432), port);
        pgEnvironment = { PATH: process.env.PATH, PGHOST: target.hostname.replaceAll(/[\[\]]/g, ''),
          PGPORT: String(port), PGUSER: decodeURIComponent(target.username),
          PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: originalDatabase,
          PGCONNECT_TIMEOUT: '5' };
        timezone = config.FINANCE_TIMEZONE || 'Asia/Jayapura';
        assert.match(timezone, /^[A-Za-z_+/-]+$/);
        new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
        sql('verify local PostgreSQL administrator', 'SELECT 1;');
        for (const binary of ['pg_dump', 'pg_restore']) run(`check ${binary}`, binary, ['--version']);
        log(`Preflight passed for deployed release ${release}`);
      },
      async backupAndRehearse() {
        const suffix = randomBytes(8).toString('hex');
        const scratch = scratchName(originalDatabase, suffix);
        backupDirectory = `/var/backups/eznihongo/finance-activation-${suffix}`;
        mkdirSync(backupDirectory, { mode: 0o700 });
        const archive = `${backupDirectory}/database.dump`;
        run('backup production database', 'pg_dump', ['--format=custom', '--file', archive], { env: pgEnvironment });
        chmodSync(archive, 0o600);
        assert.ok(statSync(archive).size > 0, 'Empty database backup');
        run('validate backup archive', 'pg_restore', ['--list', archive]);
        log(`Database backup saved locally: ${archive}`);
        let created = false;
        try {
          // Restore original ownership and grants on the same cluster. Restrict
          // CONNECT before restoring; no temporary superuser grant to the app.
          sql('create isolated restore database', `CREATE DATABASE ${quote(scratch)} OWNER ${quote(databaseOwner)} TEMPLATE template0;`);
          created = true;
          sql('restrict restore database access', `REVOKE ALL ON DATABASE ${quote(scratch)} FROM PUBLIC; GRANT CONNECT ON DATABASE ${quote(scratch)} TO ${quote(appRole)};`);
          // Stream the root-only archive; postgres never needs filesystem access
          // to the production backup directory.
          const archiveFd = openSync(archive, 'r');
          try { localPg('restore complete database', 'pg_restore', ['--exit-on-error', '--single-transaction', '-d', scratch], archiveFd); }
          finally { closeSync(archiveFd); }
          const restoredUrl = new URL(connection); restoredUrl.pathname = `/${scratch}`;
          const restored = new pg.Client({ connectionString: restoredUrl.href, connectionTimeoutMillis: 5000 });
          try {
            await restored.connect();
            assert.equal((await restored.query('SELECT current_database() AS db')).rows[0].db, scratch);
            await applyFinanceMigration(restored);
            assert.equal(await applyFinanceMigration(restored), false, 'Migration must be repeatable');
            await inspectSchema(restored, inspectStaffErasureTables);
            await restored.query('BEGIN');
            try {
              await restored.query("INSERT INTO finance_settings(id,start_date) VALUES(true,'2026-09-12') ON CONFLICT DO NOTHING");
              const report = await finance.report(restored, { from: '2026-09-01', to: '2026-09-30' });
              assert.ok(report, 'Report must load with actual runtime grants');
            } finally { await restored.query('ROLLBACK'); }
          } finally { await restored.end(); }
          log('Full backup restored; Finance migration, runtime access, report and cleanup compatibility passed');
        } finally {
          if (created) {
            assert.equal(scratch, scratchName(originalDatabase, suffix));
            sql('remove isolated restore database', `DROP DATABASE ${quote(scratch)};`);
          }
        }
      },
      async migrate() {
        await applyFinanceMigration(database);
        await inspectSchema(database, inspectStaffErasureTables);
        assert.ok((await database.query("SELECT to_regclass('finance_settings') IS NOT NULL AS ready")).rows[0].ready);
        // Only inspect settings; starting dates, balances and transactions remain
        // business inputs supplied by the owner through the Finance UI.
        const configured = (await database.query('SELECT EXISTS(SELECT 1 FROM finance_settings) AS configured')).rows[0].configured;
        log(`Production Finance schema ready; owner setup ${configured ? 'already configured' : 'awaiting business inputs'}`);
      },
      async captureConfiguration() {
        restoreFiles = snapshotFiles([settingsFile, dropInFile], backupDirectory);
        return async () => {
          restoreFiles();
          run('reload previous service configuration', 'systemctl', ['daemon-reload']);
          run('restart previous API configuration', 'systemctl', ['restart', service]);
          await waitForApi();
          log('Previous feature configuration restored; additive Finance schema retained');
        };
      },
      async enable() {
        mkdirSync(path.dirname(settingsFile), { recursive: true, mode: 0o755 });
        mkdirSync(path.dirname(dropInFile), { recursive: true, mode: 0o755 });
        writeFileSync(settingsFile, `FINANCE_ENABLED=true\nFINANCE_TIMEZONE=${timezone}\n`, { mode: 0o600 });
        chmodSync(settingsFile, 0o600);
        writeFileSync(dropInFile, `[Service]\nEnvironmentFile=${settingsFile}\n`, { mode: 0o644 });
        run('reload Finance configuration', 'systemctl', ['daemon-reload']);
        run('restart API with Finance enabled', 'systemctl', ['restart', service]);
      },
      async verify() {
        await waitForApi(true);
        const env = runtimeEnvironment();
        assert.equal(env.FINANCE_ENABLED, 'true');
        assert.equal(env.FINANCE_TIMEZONE, timezone);
        assert.equal(env.DATABASE_URL, connection, 'API database must remain unchanged');
        const html = await fetch('http://127.0.0.1/admin.html', { headers: { Host: 'eznihongo.com' }, signal: AbortSignal.timeout(5000) });
        assert.ok((await html.text()).includes('finance-company-report-20260912'), 'Finance frontend release must be served');
        log('FINANCE ACTIVE: API healthy, authentication enforced, runtime flag and frontend verified');
      },
    });
  } finally { if (database) await database.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    // pg errors can include database names or business data; report only safe
    // labels for our own operational errors, otherwise a code/name.
    const safe = error.message?.startsWith('Activation stopped:') || error.message === 'API health or Finance authentication check failed' ||
      (error.name === 'AssertionError' && !error.generatedMessage);
    console.error(safe ? error.message : `Activation failed (${error.code || error.name || 'unknown'})`);
    process.exitCode = 1;
  });
}
