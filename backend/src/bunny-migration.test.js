import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const bab1Migrations = ['205_bunny_video_sources.sql', '206_n5_bab1_bunny_video.sql', '207_n5_bab1_bunny_current_slug.sql'];
for (const { chapterSlug, migrations, externalId, backupName } of [
  ...['hiragana-katakana', 'n5-b1'].map(chapterSlug => ({ chapterSlug,
    migrations: bab1Migrations, externalId: '770041/0495cf1c-2e6b-4306-b94e-fa08ce239e2a',
    backupName: 'bunny_bab1_video_backup_206' })),
  { chapterSlug: 'n5-b2', migrations: ['205_bunny_video_sources.sql', '208_n5_bab2_bunny_video.sql'],
    externalId: '770041/69a9a519-d9c2-4430-a9b8-f887cbb4bd88', backupName: 'bunny_bab2_video_backup_208' },
]) {
test(`Bunny migration replaces only N5 ${chapterSlug} video/kana while preserving ranges and progress`,
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
      const otherChapterSlug = chapterSlug === 'n5-b2' ? 'n5-b1' : 'n5-b2';
      for (const [courseId, slug] of [[course[0].id, chapterSlug], [course[0].id, otherChapterSlug], [course[1].id, chapterSlug]]) {
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
        for (const name of migrations) {
          const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
          if (db.exec) await db.exec(sql); else await db.query(sql);
        }
      };
      await migrate();
      const source = (await db.query("SELECT * FROM video_sources WHERE provider='bunny'")).rows[0];
      assert.equal(source.external_id, externalId);
      assert.equal(source.source_url, `https://player.mediadelivery.net/embed/${externalId}`);
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
      const backup = (await db.query(`SELECT * FROM ${backupName}`)).rows;
      assert.equal(backup.length, 2);
      assert.ok(backup.every(row => row.video_source_id === old && row.video_url === 'old-url'));
    } finally {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      if (db.close) await db.close(); else await db.end();
    }
  });
}

test('Bunny batch maps N5 Bab 3-9 to their own videos, preserving unrelated lessons and backups',
  { skip: !process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_URL }, async () => {
    let db;
    const schema = `bunny_batch_test_${Date.now()}`;
    if (process.env.TEST_PGLITE_URL) {
      const { PGlite } = await import(process.env.TEST_PGLITE_URL);
      db = new PGlite();
    } else {
      db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
      await db.connect();
    }
    const videos = {
      3: '20d7ff66-f606-4de0-8225-3c26fcf909b8',
      4: '3f389515-d086-4467-9238-43bace8a6d8c',
      5: '5a849ce6-ea38-4b4f-bcd9-087a668dafbd',
      6: '57d00353-1f07-4b5c-b142-c19584b2eb1f',
      7: '194c12a4-8d66-495f-be92-d7baf50566d5',
      8: '78a336c3-8150-43cd-8890-6871434ebe1b',
      9: '2b746361-5ba3-4c08-9281-d6c503d74449',
    };
    try {
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(`SET search_path TO ${schema}, public`);
      for (const sql of [
        `CREATE TABLE courses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text)`,
        `CREATE TABLE modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid REFERENCES courses, slug text)`,
        `CREATE TABLE video_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text CHECK(provider IN ('youtube','bunny')),
          external_id text, source_url text, title text, UNIQUE(provider, external_id))`,
        `CREATE TABLE lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid REFERENCES modules, type text,
          video_source_id uuid REFERENCES video_sources, video_url text, video_start_seconds int, video_end_seconds int, updated_at timestamptz DEFAULT NOW())`,
        `CREATE TABLE progress(lesson_id uuid REFERENCES lessons, completed boolean)`,
      ]) await db.query(sql);
      const courses = (await db.query("INSERT INTO courses(slug) VALUES('n5'),('n4') RETURNING *")).rows;
      const old = (await db.query("INSERT INTO video_sources(provider,external_id,source_url) VALUES('youtube','shared-old','old-url') RETURNING id")).rows[0].id;
      const beforeSources = (await db.query('SELECT * FROM video_sources')).rows;
      const lessons = [];
      for (const course of courses) {
        for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
          const module = (await db.query('INSERT INTO modules(course_id,slug) VALUES($1,$2) RETURNING id', [course.id, `n5-b${number}`])).rows[0];
          for (const type of ['video', 'kana', 'deck', 'quiz', 'kanji', 'conversation', 'grammar-task']) {
            const start = type === 'video' ? null : 240;
            const end = type === 'video' ? null : 360;
            const lesson = (await db.query(`INSERT INTO lessons(module_id,type,video_source_id,video_url,video_start_seconds,video_end_seconds)
              VALUES($1,$2,$3,'old-url',$4,$5) RETURNING *`, [module.id, type, old, start, end])).rows[0];
            lessons.push({ ...lesson, number, target: course.slug === 'n5' && number >= 3 && number <= 9 && ['video', 'kana'].includes(type) });
            await db.query('INSERT INTO progress VALUES($1,true)', [lesson.id]);
          }
        }
      }
      const progress = (await db.query('SELECT * FROM progress ORDER BY lesson_id')).rows;
      const sql = await readFile(new URL('../migrations/209_n5_bab3_9_bunny_videos.sql', import.meta.url), 'utf8');
      const migrate = () => db.exec ? db.exec(sql) : db.query(sql);
      await migrate();
      const sources = (await db.query("SELECT * FROM video_sources WHERE provider='bunny'")).rows;
      assert.equal(sources.length, 7);
      for (const before of lessons) {
        const after = (await db.query('SELECT * FROM lessons WHERE id=$1', [before.id])).rows[0];
        if (before.target) {
          const source = sources.find(row => row.id === after.video_source_id);
          assert.equal(source.external_id, `770041/${videos[before.number]}`);
          assert.equal(source.source_url, `https://player.mediadelivery.net/embed/770041/${videos[before.number]}`);
          assert.equal(after.video_url, null);
          assert.equal(after.video_start_seconds, before.video_start_seconds ?? 0);
          assert.equal(after.video_end_seconds, before.video_end_seconds);
        } else {
          const { number, target, ...original } = before;
          assert.deepEqual(after, original);
        }
      }
      assert.deepEqual((await db.query('SELECT * FROM progress ORDER BY lesson_id')).rows, progress);
      assert.deepEqual((await db.query('SELECT * FROM video_sources WHERE id=$1', [old])).rows, beforeSources);
      const backup = (await db.query('SELECT * FROM bunny_bab3_9_video_backup_209 ORDER BY lesson_id')).rows;
      assert.equal(backup.length, 14);
      assert.ok(backup.every(row => row.video_source_id === old && row.video_url === 'old-url'));
      const after = (await db.query('SELECT * FROM lessons ORDER BY id')).rows;
      await migrate();
      assert.deepEqual((await db.query('SELECT * FROM bunny_bab3_9_video_backup_209 ORDER BY lesson_id')).rows, backup);
      assert.deepEqual((await db.query("SELECT * FROM video_sources WHERE provider='bunny' ORDER BY id")).rows, sources.sort((a, b) => a.id.localeCompare(b.id)));
      const content = rows => rows.map(({ updated_at, ...row }) => row);
      assert.deepEqual(content((await db.query('SELECT * FROM lessons ORDER BY id')).rows), content(after));
    } finally {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      if (db.close) await db.close(); else await db.end();
    }
  });
