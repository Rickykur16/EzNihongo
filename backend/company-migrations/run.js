// Separate, explicit release gate. Never called by npm run migrate or CI deploy.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { inspectStaffErasureTables } from '../src/staff-erasure.js';

export const COMPANY_MIGRATIONS = [
  ['001_staff_v1', new URL('../contracts/staff-schema-v1.sql',import.meta.url)],
  ['002_company_work_v1', new URL('../contracts/company-work-v1.sql',import.meta.url)],
];
export async function applyCompanyMigrations(client) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eznihongo-company-migrations-v1'))");
    await client.query('CREATE TABLE IF NOT EXISTS company_schema_migrations(name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied=new Map((await client.query('SELECT name,sha256 FROM company_schema_migrations')).rows.map(r=>[r.name,r.sha256]));
    const completed=[];
    for (const [name,path] of COMPANY_MIGRATIONS) {
      const sql=await readFile(path,'utf8'); const hash=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
      if(applied.has(name)) { if(applied.get(name)!==hash)throw new Error('company_migration_checksum_mismatch'); continue; }
      await client.query(sql);
      await client.query('INSERT INTO company_schema_migrations(name,sha256) VALUES ($1,$2)',[name,hash]); completed.push(name);
    }
    await inspectStaffErasureTables(client);
    await client.query('COMMIT'); return completed;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
}
async function main() {
  if(!process.argv.includes('--apply') || !process.argv.includes('--ack-compatible-cleanup'))throw new Error('Requires --apply --ack-compatible-cleanup after restore/staging/release review');
  if(!process.env.COMPANY_DATABASE_URL)throw new Error('COMPANY_DATABASE_URL must explicitly identify the reviewed target; DATABASE_URL is never used');
  const client=new pg.Client({connectionString:process.env.COMPANY_DATABASE_URL});
  await client.connect(); try { console.log({applied:await applyCompanyMigrations(client)}); } finally { await client.end(); }
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error(e.message);process.exitCode=1;});
