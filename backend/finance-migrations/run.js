import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export async function applyFinanceMigration(client) {
  const sql = await readFile(new URL('./001_finance.sql', import.meta.url), 'utf8');
  const hash = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eznihongo-finance-migration'))");
    await client.query('CREATE TABLE IF NOT EXISTS finance_schema_migrations(name text PRIMARY KEY, sha256 text NOT NULL)');
    const previous = (await client.query("SELECT sha256 FROM finance_schema_migrations WHERE name = '001_finance'")).rows[0];
    if (previous && previous.sha256 !== hash) throw new Error('finance_migration_checksum_mismatch');
    if (!previous) {
      await client.query(sql);
      await client.query("INSERT INTO finance_schema_migrations VALUES ('001_finance',$1)", [hash]);
    }
    await client.query('COMMIT');
    return !previous;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.argv.includes('--apply') || !process.env.FINANCE_DATABASE_URL) {
    console.error('Requires --apply and explicit FINANCE_DATABASE_URL after staging review'); process.exitCode = 1;
  } else {
    const client = new pg.Client({ connectionString: process.env.FINANCE_DATABASE_URL });
    try { await client.connect(); console.log({ applied: await applyFinanceMigration(client) }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { await client.end(); }
  }
}
