// import-content.mjs — one-shot import of data/courses.json + data/quizzes.json
// into Postgres. Idempotent — re-running updates modules/lessons/quizzes in
// place. Does NOT overwrite course top-level fields (price, features,
// is_published, etc.) so admin-curated metadata is preserved.
//
// Run on the VPS after `git pull`:
//   cd backend && node scripts/import-content.mjs
//
// Prerequisites: DATABASE_URL env var (same as API server).

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { db, query } from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const COURSES_JSON = resolve(REPO_ROOT, 'data', 'courses.json');
const QUIZZES_JSON = resolve(REPO_ROOT, 'data', 'quizzes.json');

function parseDurationMinutes(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(\d+)\s*min/i);
  return m ? Number(m[1]) : null;
}

function composeContent(body, jp) {
  if (!body && !jp) return null;
  const parts = [];
  if (body) parts.push(body);
  if (jp) parts.push(`<div class="jp">${jp}</div>`);
  return parts.join('\n\n');
}

async function upsertCourseShell(slug, courseData) {
  // Insert only if missing — never overwrite admin-curated fields. If the
  // course already exists (admin created it via panel), we just reuse its id.
  const existing = await query(`SELECT id FROM courses WHERE slug = $1`, [slug]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await query(
    `INSERT INTO courses (slug, title, tagline, level, is_published, is_available, sort_order)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, $5) RETURNING id`,
    [slug, courseData.name || slug.toUpperCase(), courseData.tagline || null,
     slug.toUpperCase(), 0]
  );
  return inserted.rows[0].id;
}

async function upsertModule(courseId, jsonModule, sortOrder) {
  // JSON keys: {id: "m1", num: "01", title, lessons}
  const result = await query(
    `INSERT INTO modules (course_id, slug, title, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (course_id, slug) DO UPDATE
       SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
     RETURNING id`,
    [courseId, jsonModule.id, jsonModule.title, sortOrder]
  );
  return result.rows[0].id;
}

async function upsertLesson(moduleId, jsonLesson, sortOrder) {
  // JSON keys: {id, title, type, duration, body, jp}
  const content = composeContent(jsonLesson.body, jsonLesson.jp);
  const duration = parseDurationMinutes(jsonLesson.duration);
  const result = await query(
    `INSERT INTO lessons (module_id, slug, title, type, content, duration_minutes, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (module_id, slug) DO UPDATE
       SET title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
           duration_minutes = EXCLUDED.duration_minutes, sort_order = EXCLUDED.sort_order,
           updated_at = NOW()
     RETURNING id`,
    [moduleId, jsonLesson.id, jsonLesson.title, jsonLesson.type || 'text',
     content, duration, sortOrder]
  );
  return result.rows[0].id;
}

async function replaceQuizQuestions(lessonId, questions) {
  // Replace strategy: wipe old questions + options (cascades), insert fresh.
  // Safe because quiz questions have no FK dependents from user-generated data
  // except quiz_attempts which store score/total, not per-question references.
  await query(`DELETE FROM quiz_questions WHERE lesson_id = $1`, [lessonId]);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prompt = q.jp ? `${q.q}\n\n${q.jp}` : q.q;
    const qRes = await query(
      `INSERT INTO quiz_questions (lesson_id, question, question_type, explanation, sort_order)
       VALUES ($1, $2, 'multiple_choice', $3, $4) RETURNING id`,
      [lessonId, prompt, q.explain || null, i]
    );
    const questionId = qRes.rows[0].id;
    for (let j = 0; j < (q.options || []).length; j++) {
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [questionId, q.options[j], j === q.correct, j]
      );
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Run from backend/ with .env loaded.');
    process.exit(1);
  }

  const coursesJson = JSON.parse(await readFile(COURSES_JSON, 'utf8'));
  const quizzesJson = JSON.parse(await readFile(QUIZZES_JSON, 'utf8'));

  const stats = { courses: 0, modules: 0, lessons: 0, quizzes: 0, questions: 0 };

  for (const [courseSlug, courseData] of Object.entries(coursesJson)) {
    const courseId = await upsertCourseShell(courseSlug, courseData);
    stats.courses++;
    console.log(`→ course: ${courseSlug}`);

    for (let mi = 0; mi < (courseData.modules || []).length; mi++) {
      const jsonModule = courseData.modules[mi];
      const moduleId = await upsertModule(courseId, jsonModule, mi);
      stats.modules++;

      for (let li = 0; li < (jsonModule.lessons || []).length; li++) {
        const jsonLesson = jsonModule.lessons[li];
        const lessonId = await upsertLesson(moduleId, jsonLesson, li);
        stats.lessons++;

        if (jsonLesson.type === 'quiz') {
          const quizKey = `${courseSlug}:${jsonModule.id}:${jsonLesson.id}`;
          const questions = quizzesJson[quizKey];
          if (Array.isArray(questions) && questions.length > 0) {
            await replaceQuizQuestions(lessonId, questions);
            stats.quizzes++;
            stats.questions += questions.length;
          } else {
            console.warn(`  ! quiz lesson has no questions: ${quizKey}`);
          }
        }
      }
    }
  }

  console.log('\n✓ import complete:', stats);
  await db.end();
}

main().catch((err) => {
  console.error('Import failed:', err);
  db.end().catch(() => {});
  process.exit(1);
});
