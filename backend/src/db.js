import pg from 'pg';
import { countRequestQuery } from './request-query-count.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

db.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  countRequestQuery();
  const res = await db.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`Slow query (${duration}ms):`, text.slice(0, 100));
  }
  return res;
}

function countedClient(client) {
  return new Proxy(client, { get(target, property) {
    if (property === 'query') return (...args) => {
      countRequestQuery();
      return target.query(...args);
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

// Serialize concurrent operations on the same logical key (e.g.
// user_id + lesson_id) via Postgres transactional advisory lock.
// Lock auto-released at COMMIT/ROLLBACK. Use for race-sensitive
// flows like quiz attempt creation that need cooldown enforcement.
//
// fn(client) receives a dedicated pooled client — pass it to subsequent
// queries inside the locked section so they share the same transaction.
// Returns whatever fn returns.
export async function withAdvisoryLock(key, fn) {
  const client = await db.connect();
  const tracked = countedClient(client);
  try {
    await tracked.query('BEGIN');
    await tracked.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(key)]);
    const result = await fn(tracked);
    await tracked.query('COMMIT');
    return result;
  } catch (err) {
    await tracked.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Run fn(client) inside a single BEGIN/COMMIT transaction on a dedicated
// pooled client. Use for any handler that performs more than one write that
// must be all-or-nothing (insert question + options, replace-then-insert
// bulk, lesson type-switch that deletes quiz_attempts, …). If fn throws the
// whole transaction is ROLLBACK'd and the error re-thrown — so a partial
// failure never leaves half-written rows or duplicates on retry.
//
// IMPORTANT: every query inside fn MUST use the passed `client` (client.query),
// not the module-level `query()` — the latter grabs a different pooled
// connection and would run OUTSIDE the transaction.
export async function withTransaction(fn) {
  const client = await db.connect();
  const tracked = countedClient(client);
  try {
    await tracked.query('BEGIN');
    const result = await fn(tracked);
    await tracked.query('COMMIT');
    return result;
  } catch (err) {
    await tracked.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
