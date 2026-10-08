import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

for (const chapterSlug of ['hiragana-katakana', 'n5-b1']) {
test(`Bunny migration replaces only N5 Bab 1 (${chapterSlug}) video/kana while preserving ranges and progress`,
  { skip: !process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_URL }, async () => {
    let db;
    const schema = `bunny_test_${Date.now()}`;
    if (process.env.TEST_PGLITE_URL) {
      const { PGlite } = await import(process.env.TEST_PGLITE_URL);
      db = new PGlite();
    } else {
      db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
      await db.connect();
    }
    try {
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(`SET search_path TO ${schema}, public`);
      for (const sql of [
        `CREATE TABLE courses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text)`,
        `CREATE TABLE modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid REFERENCES courses, slug text)`,
        `CREATE TABLE video_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text DEFAULT 'youtube' CHECK(provider IN ('youtube')),
          external_id text, source_url text, title text, UNIQUE(provider, external_id))`,
        `CREATE TABLE lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid REFERENCES modules, type text,
          video_source_id uuid REFERENCES video_sources, video_url text, video_start_seconds int, video_end_seconds int, updated_at timestamptz DEFAULT NOW())`,
        `CREATE TABLE progress(lesson_id uuid REFERENCES lessons, completed boolean)`,
      ]) await db.query(sql);
      const course = (await db.query("INSERT INTO courses(slug) VALUES('n5'),('n4') RETURNING *")).rows;
      const module = [];
      for (const [courseId, slug] of [[course[0].id, chapterSlug], [course[0].id, 'n5-b2'], [course[1].id, chapterSlug]]) {
        module.push((await db.query('INSERT INTO modules(course_id,slug) VALUES($1,$2) RETURNING *', [courseId, slug])).rows[0]);
      }
      const old = (await db.query("INSERT INTO video_sources(provider,external_id,source_url) VALUES('youtube','old-video','old-url') RETURNING id")).rows[0].id;
      const lessons = [];
      for (const [moduleId, type] of [[module[0].id, 'video'], [module[0].id, 'kana'], [module[0].id, 'quiz'], [module[0].id, 'deck'], [module[1].id, 'video'], [module[2].id, 'video']]) {
        const lesson = (await db.query(`INSERT INTO lessons(module_id,type,video_source_id,video_url,video_start_seconds,video_end_seconds)
          VALUES($1,$2,$3,'old-url',30,90) RETURNING *`, [moduleId, type, old])).rows[0];
        lessons.push(lesson);
        await db.query('INSERT INTO progress VALUES($1,true)', [lesson.id]);
      }
      const progress = (await db.query('SELECT * FROM progress ORDER BY lesson_id')).rows;
      const migrate = async () => {
        for (const name of ['205_bunny_video_sources.sql', '206_n5_bab1_bunny_video.sql', '207_n5_bab1_bunny_current_slug.sql']) {
          const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
          if (db.exec) await db.exec(sql); else await db.query(sql);
        }
      };
      await migrate();
      const source = (await db.query("SELECT * FROM video_sources WHERE provider='bunny'")).rows[0];
      assert.equal(source.external_id, '770041/0495cf1c-2e6b-4306-b94e-fa08ce239e2a');
      for (const [index, before] of lessons.entries()) {
        const after = (await db.query('SELECT * FROM lessons WHERE id=$1', [before.id])).rows[0];
        assert.equal(after.video_start_seconds, 30);
        assert.equal(after.video_end_seconds, 90);
        assert.equal(after.video_source_id, index < 2 ? source.id : old);
        assert.equal(after.video_url, index < 2 ? null : 'old-url');
      }
      assert.deepEqual((await db.query('SELECT * FROM progress ORDER BY lesson_id')).rows, progress);
      assert.equal((await db.query('SELECT source_url FROM video_sources WHERE id=$1', [old])).rows[0].source_url, 'old-url');
      await migrate();
      assert.equal((await db.query("SELECT count(*)::int AS n FROM video_sources WHERE provider='bunny'")).rows[0].n, 1);
      const backup = (await db.query('SELECT * FROM bunny_bab1_video_backup_206')).rows;
      assert.equal(backup.length, 2);
      assert.ok(backup.every(row => row.video_source_id === old && row.video_url === 'old-url'));
    } finally {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      if (db.close) await db.close(); else await db.end();
    }
  });
}
