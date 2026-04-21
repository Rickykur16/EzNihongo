#!/usr/bin/env node
// Migration runner.
// Usage:  node backend/migrations/run.js   (from repo root OR backend/)
//
// Applies every *.sql file in this directory in alphabetical order,
// skipping any that already appear in the schema_migrations table.
// Each migration runs in its own transaction; a failure rolls back
// that migration only. Stops on first failure.
//
// Requires DATABASE_URL env var.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Bootstrap: ensure schema_migrations exists. The 000 migration creates it,
  // but on an empty DB we need the table before we can query it.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const applied = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`→ applying ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
      await client.query('COMMIT');
      appliedCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ failed on ${file}:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  if (appliedCount === 0) {
    console.log('✓ Database up to date. No migrations applied.');
  } else {
    console.log(`✓ Applied ${appliedCount} migration(s).`);
  }

  await client.end();
}

main().catch(err => {
  console.error('Migration runner crashed:', err);
  process.exit(1);
});
