import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {inspectStaffErasureTables} from '../src/staff-erasure.js';

export async function applyCrmMigrations(client){
  const migrations=[['001_marketing_crm',new URL('./001_marketing_crm.sql',import.meta.url)],['002_marketing_strategy',new URL('./002_marketing_strategy.sql',import.meta.url)],['003_registration_sources',new URL('./003_registration_sources.sql',import.meta.url)]];
  await client.query('BEGIN');
  try{
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eznihongo-marketing-crm-v1'))");
    await client.query('CREATE TABLE IF NOT EXISTS crm_schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied=new Map((await client.query('SELECT name,sha256 FROM crm_schema_migrations')).rows.map(r=>[r.name,r.sha256]));
    const completed=[];
    for(const [name,path] of migrations){
      const sql=await readFile(path,'utf8'),hash=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
      if(applied.has(name)){if(applied.get(name)!==hash)throw new Error('crm_migration_checksum_mismatch');continue;}
      await client.query(sql);await client.query('INSERT INTO crm_schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);completed.push(name);
    }
    await inspectStaffErasureTables(client);
    await client.query('COMMIT');return completed;
  }catch(e){await client.query('ROLLBACK');throw e;}
}
async function main(){
  if(!process.argv.includes('--apply')||!process.env.CRM_DATABASE_URL)throw new Error('Requires --apply and explicit CRM_DATABASE_URL');
  const client=new pg.Client({connectionString:process.env.CRM_DATABASE_URL});await client.connect();
  try{console.log({applied:await applyCrmMigrations(client)});}finally{await client.end();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error(e.message);process.exitCode=1;});
