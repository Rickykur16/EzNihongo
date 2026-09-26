// cleanup-n5-seed-modules.mjs — one-shot cleanup BEFORE running import-content.mjs.
//
// seed-n5.sql (the initial N5 seed) created 5 module shells with these slugs:
//   hiragana-katakana, salam-perkenalan, kosakata-harian,
//   pola-kalimat-dasar, persiapan-jlpt-n5
//
// data/courses.json (what import-content.mjs reads from) uses different module
// slugs: m1, m2, m3, m4, m5. If both are present the N5 course ends up with 10
// duplicate modules.
//
// This script deletes the 5 seed-era modules (and any lessons under them — the
// ON DELETE CASCADE on modules/lessons takes care of that) so import-content.mjs
// leaves N5 with a clean 5-module set.
//
// Safe to run because:
//   - We only target the 5 exact legacy slugs.
//   - user_enrollments reference courses, not modules — no student data at risk.
//   - user_progress references lessons; seed-n5.sql never created lessons under
//     these modules, so no progress rows are affected. Script aborts loudly if
//     it ever finds any, so you don't silently destroy progress.
//
// Usage on VPS (from backend/):
//   node scripts/cleanup-n5-seed-modules.mjs
//
// After it runs clean, run:
//   node scripts/import-content.mjs

import 'dotenv/config';
import { db, withTransaction } from '../src/db.js';
import { lockCurriculumGraph } from '../src/curriculum-content-service.js';

const LEGACY_N5_MODULE_SLUGS = [
  'hiragana-katakana',
  'salam-perkenalan',
  'kosakata-harian',
  'pola-kalimat-dasar',
  'persiapan-jlpt-n5',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Run from backend/ with .env loaded.');
    process.exit(1);
  }

  const outcome = await withTransaction(async client => {
    await lockCurriculumGraph(client, { exclusive: true });
    const course = await client.query(`SELECT id,curriculum_boundary_mode FROM courses WHERE slug = 'n5' FOR UPDATE`);
    if (!course.rows.length) return { kind: 'no_course' };
    if (course.rows[0].curriculum_boundary_mode !== 'off') {
      throw new Error('cleanup_n5_seed_modules_requires_off_mode');
    }
    const courseId = course.rows[0].id;
    const existing = await client.query(
      `SELECT id,slug FROM modules WHERE course_id=$1 AND slug=ANY($2::text[])`,
      [courseId, LEGACY_N5_MODULE_SLUGS]);
    if (!existing.rows.length) return { kind: 'no_modules' };
    const modIds = existing.rows.map(row => row.id);
    const prog = await client.query(
      `SELECT COUNT(*)::int AS n FROM user_progress up JOIN lessons l ON l.id=up.lesson_id
        WHERE l.module_id=ANY($1::uuid[])`, [modIds]);
    if ((prog.rows[0]?.n || 0) > 0) {
      throw new Error(`cleanup_n5_seed_modules_has_${prog.rows[0].n}_progress_rows`);
    }
    const del = await client.query('DELETE FROM modules WHERE id=ANY($1::uuid[]) RETURNING slug', [modIds]);
    return { kind: 'deleted', slugs: del.rows.map(row => row.slug) };
  });
  if (outcome.kind === 'no_course') {
    console.log('No n5 course found — nothing to clean up.');
    await db.end();
    return;
  }
  if (outcome.kind === 'no_modules') {
    console.log('No legacy seed modules found under n5 — already clean.');
    await db.end();
    return;
  }
  console.log(`✓ Deleted ${outcome.slugs.length} legacy n5 modules:`);
  for (const slug of outcome.slugs) console.log('  -', slug);
  console.log('\nNext step: node scripts/import-content.mjs');
  await db.end();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  db.end().catch(() => {});
  process.exit(1);
});
