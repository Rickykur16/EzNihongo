import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { isDeepStrictEqual } from 'node:util';

test('N5 intro cleanup removes only Bab 3-20 intros and archives cascading and nullable references',
  { skip: !process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_URL }, async () => {
    let db;
    const schema = `n5_intro_cleanup_${Date.now()}`;
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
        `CREATE TABLE video_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_url text)`,
        `CREATE TABLE lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid REFERENCES modules, slug text, title text,
          type text, sort_order int, video_source_id uuid REFERENCES video_sources, video_start_seconds int, video_end_seconds int)`,
        `CREATE TABLE user_progress(lesson_id uuid REFERENCES lessons ON DELETE CASCADE, user_id uuid, completed boolean, PRIMARY KEY(lesson_id,user_id))`,
        `CREATE TABLE quiz_questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id uuid REFERENCES lessons ON DELETE CASCADE)`,
        `CREATE TABLE quiz_options(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid REFERENCES quiz_questions ON DELETE CASCADE, text text)`,
        `CREATE TABLE module_grammar(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id uuid REFERENCES lessons ON DELETE SET NULL, pattern text)`,
        `CREATE TABLE progress_details(lesson_id uuid, user_id uuid, score int,
          FOREIGN KEY(lesson_id,user_id) REFERENCES user_progress ON DELETE CASCADE)`,
      ]) await db.query(sql);
      const courses = (await db.query("INSERT INTO courses(slug) VALUES('n5'),('n4') RETURNING *")).rows;
      const source = (await db.query("INSERT INTO video_sources(source_url) VALUES('bunny-video') RETURNING id")).rows[0].id;
      const user = (await db.query('SELECT gen_random_uuid() AS id')).rows[0].id;
      const targets = [];
      for (const course of courses) {
        for (let number = 1; number <= 21; number++) {
          const moduleId = (await db.query('INSERT INTO modules(course_id,slug) VALUES($1,$2) RETURNING id', [course.id, `n5-b${number}`])).rows[0].id;
          const introSlug = number < 6 ? `intro-n5-b${number}` : number < 12 ? 'intro' : 'pelajaran-1-pengantar';
          for (const [slug, type, order] of [[introSlug, 'video', 1], ['bunpou1', 'video', 4], ['intro-practice', 'video', 5], ['kosakata', 'deck', 2], ['quiz', 'quiz', 6]]) {
            const lessonId = (await db.query(`INSERT INTO lessons(module_id,slug,title,type,sort_order,video_source_id,video_start_seconds,video_end_seconds)
              VALUES($1,$2,'Pengantar',$3,$4,$5,30,90) RETURNING id`, [moduleId, slug, type, order, source])).rows[0].id;
            if (course.slug === 'n5' && number >= 3 && number <= 20 && slug === introSlug) targets.push(lessonId);
            await db.query('INSERT INTO user_progress VALUES($1,$2,true)', [lessonId, user]);
            await db.query('INSERT INTO progress_details VALUES($1,$2,100)', [lessonId, user]);
          }
        }
      }
      const question = (await db.query('INSERT INTO quiz_questions(lesson_id) VALUES($1) RETURNING id', [targets[0]])).rows[0].id;
      await db.query("INSERT INTO quiz_options(question_id,text) VALUES($1,'saved option')", [question]);
      await db.query("INSERT INTO module_grammar(lesson_id,pattern) VALUES($1,'keep grammar')", [targets[0]]);
      const before = {};
      for (const table of ['lessons', 'user_progress', 'progress_details', 'video_sources', 'quiz_questions', 'quiz_options', 'module_grammar']) {
        before[table] = (await db.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows;
      }
      const migration = await readFile(new URL('../migrations/211_n5_remove_bab3_20_intro_lessons.sql', import.meta.url), 'utf8');
      const migrate = async () => {
        await db.query('BEGIN');
        try {
          if (db.exec) await db.exec(migration); else await db.query(migration);
          await db.query('COMMIT');
        } catch (err) { await db.query('ROLLBACK'); throw err; }
      };
      // A partial/ambiguous inventory must roll back without touching any data.
      await db.query("UPDATE lessons SET slug='custom-intro' WHERE id=$1", [targets[0]]);
      await assert.rejects(migrate, /expected one reviewed intro/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM lessons')).rows[0].n, before.lessons.length);
      await db.query('UPDATE lessons SET slug=$1 WHERE id=$2', [before.lessons.find(row => row.id === targets[0]).slug, targets[0]]);
      await migrate();
      for (const table of ['lessons', 'user_progress', 'progress_details']) {
        const key = table === 'lessons' ? 'id' : 'lesson_id';
        assert.deepEqual((await db.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows,
          before[table].filter(row => !targets.includes(row[key])));
      }
      assert.deepEqual((await db.query('SELECT * FROM video_sources')).rows, before.video_sources);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM quiz_options')).rows[0].n, 0);
      assert.equal((await db.query('SELECT lesson_id FROM module_grammar')).rows[0].lesson_id, null);
      const archive = (await db.query("SELECT * FROM curriculum_cleanup_archive WHERE cleanup_key='211-n5-bab3-20-intros' ORDER BY table_name,row_hash")).rows;
      for (const [table, rows] of Object.entries(before)) {
        const affected = rows.filter(row => targets.includes(row.id) || targets.includes(row.lesson_id) || row.question_id === question || row.id === question);
        for (const row of affected) assert.ok(archive.some(entry => entry.table_name === table && isDeepStrictEqual(entry.row_data, JSON.parse(JSON.stringify(row)))), `${table} archived`);
      }
      assert.equal(archive.filter(row => row.table_name === 'lessons').length, 18);
      await migrate();
      assert.deepEqual((await db.query("SELECT * FROM curriculum_cleanup_archive WHERE cleanup_key='211-n5-bab3-20-intros' ORDER BY table_name,row_hash")).rows, archive);
    } finally {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      if (db.close) await db.close(); else await db.end();
    }
  });
