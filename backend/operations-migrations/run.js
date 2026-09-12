import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {inspectStaffErasureTables} from '../src/staff-erasure.js';

export async function applyOperationsMigrations(client) {
  const sql=await readFile(new URL('./001_student_operations.sql',import.meta.url),'utf8');
  const hash=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eznihongo-student-operations-v1'))");
    await client.query('CREATE TABLE IF NOT EXISTS operations_schema_migrations(name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const row=(await client.query("SELECT sha256 FROM operations_schema_migrations WHERE name='001_student_operations'")).rows[0];
    if(row && row.sha256!==hash)throw new Error('operations_migration_checksum_mismatch');
    if(!row){await client.query(sql);await client.query("INSERT INTO operations_schema_migrations(name,sha256) VALUES ('001_student_operations',$1)",[hash]);}
    await inspectStaffErasureTables(client);
    await client.query('COMMIT');return row?[]:['001_student_operations'];
  }catch(e){await client.query('ROLLBACK');throw e;}
}
async function main(){
  if(!process.argv.includes('--apply')||!process.env.OPERATIONS_DATABASE_URL)throw new Error('Requires --apply and explicit OPERATIONS_DATABASE_URL');
  const client=new pg.Client({connectionString:process.env.OPERATIONS_DATABASE_URL});await client.connect();
  try{console.log({applied:await applyOperationsMigrations(client)});}finally{await client.end();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error(e.message);process.exitCode=1;});
