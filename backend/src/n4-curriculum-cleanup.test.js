import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

async function openDatabase(t) {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    assert.match(decodeURIComponent(url.pathname), /test/i);
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
    const schema = 'n4_cleanup_test_' + randomUUID().replaceAll('-', '');
    const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
    await client.connect();
    t.after(async () => {
      try {
        await client.query('ROLLBACK');
        assert.match(schema, /^n4_cleanup_test_[a-f0-9]{32}$/);
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally { await client.end(); }
    });
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    return { query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql) };
  }
  if (!process.env.PGLITE_TEST_MODULE) {
    t.skip('Set TEST_DATABASE_URL or PGLITE_TEST_MODULE for an isolated test database');
    return null;
  }
  const url = new URL(process.env.PGLITE_TEST_MODULE);
  assert.equal(url.protocol, 'file:');
  const { PGlite } = await import(url.href);
  const db = new PGlite();
  t.after(() => db.close());
  return db;
}

test('N4 curriculum migration and legacy cleanup preserve canonical content and recovery snapshots', async t => {
  const db = await openDatabase(t);
  if (!db) return;
  const sql = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const rows = async query => (await db.query(query)).rows;
  const migrate = async name => db.exec(`BEGIN; ${sql(`migrations/${name}`)} COMMIT;`);
  await db.exec(sql('schema.sql'));
  await db.exec("INSERT INTO courses (slug, title) VALUES ('n5', 'Kelas N5');");
  await db.exec("INSERT INTO modules (course_id, slug, title) SELECT id, 'n5-sentinel', 'N5 unchanged' FROM courses WHERE slug='n5';");
  const n5Before = await rows("SELECT * FROM modules WHERE slug='n5-sentinel'");
  await migrate('155_n4_kanji_distribution.sql');
  assert.deepEqual(await rows("SELECT is_published, is_available FROM courses WHERE slug='n4'"), [{ is_published: false, is_available: false }]);
  const kanjiBefore = await rows('SELECT * FROM kanji_items ORDER BY id');
  await migrate('156_n4_lesson_flow.sql');
  assert.equal((await rows('SELECT count(*)::int AS n FROM lessons'))[0].n, 190);
  assert.equal((await rows('SELECT count(*)::int AS n FROM module_grammar'))[0].n, 125);
  assert.equal((await rows('SELECT count(*)::int AS n FROM lesson_grammar_task_items'))[0].n, 125);
  assert.equal((await rows("SELECT count(*)::int AS n FROM lessons WHERE type='grammar_task'"))[0].n, 47);
  assert.equal((await rows('SELECT count(*)::int AS n FROM module_vocabulary'))[0].n, 0);
  assert.deepEqual(await rows('SELECT * FROM kanji_items ORDER BY id'), kanjiBefore);
  assert.deepEqual(await rows("SELECT * FROM modules WHERE slug='n5-sentinel'"), n5Before);
  const chapters = await rows(`SELECT m.sort_order, array_agg(l.type ORDER BY l.sort_order) AS types
    FROM modules m JOIN courses c ON c.id=m.course_id JOIN lessons l ON l.module_id=m.id
    WHERE c.slug='n4' GROUP BY m.id ORDER BY m.sort_order`);
  for (const c of chapters) {
    assert.equal(c.types.filter(type => type === 'grammar_task').length, c.sort_order === 17 ? 1 : 2);
    assert.deepEqual(c.types.slice(0, 3), ['video', 'deck', 'kanji']);
    assert.equal(c.types.at(-1), 'quiz');
    for (let i = 3; i < c.types.length - 1; i += 2) assert.deepEqual(c.types.slice(i, i + 2), ['video', 'grammar_task']);
  }
  assert.equal((await rows(`SELECT count(*)::int AS n FROM lesson_grammar_task_items i
    JOIN lessons t ON t.id=i.lesson_id JOIN module_grammar g ON g.id=i.grammar_id
    JOIN lessons l ON l.id=g.lesson_id WHERE t.module_id<>l.module_id OR t.sort_order<>l.sort_order+1`))[0].n, 0);
  const identity = await rows('SELECT id, module_id, slug FROM lessons ORDER BY id');
  const grammarIds = await rows('SELECT id, lesson_id FROM module_grammar ORDER BY id');
  await db.exec(`UPDATE lessons SET content='editor content', video_url='https://example.com/video', duration_minutes=42 WHERE slug='pelajaran-1-pengantar';
    UPDATE module_grammar SET meaning='editor meaning', notes='editor notes';
    UPDATE lesson_grammar_task_items SET instruction='editor instruction', required_count=2;
    INSERT INTO lessons (module_id, slug, title, type, sort_order)
    SELECT id, 'editor-extra', 'Extra', 'text', 1 FROM modules WHERE slug LIKE 'n4-b01-%';`);
  await migrate('156_n4_lesson_flow.sql');
  assert.deepEqual(await rows("SELECT id, module_id, slug FROM lessons WHERE slug<>'editor-extra' ORDER BY id"), identity);
  assert.deepEqual(await rows('SELECT id, lesson_id FROM module_grammar ORDER BY id'), grammarIds);
  assert.equal((await rows("SELECT count(*)::int AS n FROM lessons WHERE content='editor content' AND duration_minutes=42 AND video_url='https://example.com/video'"))[0].n, 24);
  assert.equal((await rows("SELECT count(*)::int AS n FROM module_grammar WHERE meaning='editor meaning' AND notes='editor notes'"))[0].n, 125);
  assert.equal((await rows("SELECT count(*)::int AS n FROM lesson_grammar_task_items WHERE instruction='editor instruction' AND required_count=2"))[0].n, 125);
  assert.equal((await rows("SELECT sort_order FROM lessons WHERE slug='editor-extra'"))[0].sort_order, 9);
  assert.deepEqual(await rows('SELECT * FROM kanji_items ORDER BY id'), kanjiBefore);
  t.diagnostic('PASS: full schema, migrations 155+156, 24 chapters, 190 lessons, 47 groups (max 2 per chapter), 125 entries/tasks, 180 kanji, order, rerun, editor preservation, N5 isolation.');
  const lessonsBeforeSections = await rows('SELECT * FROM lessons ORDER BY id');
  await migrate('157_n4_curriculum_sections.sql');
  const sections = await rows(`SELECT m.sort_order, m.section_name FROM modules m JOIN courses c ON c.id=m.course_id WHERE c.slug='n4' ORDER BY m.sort_order`);
  assert.equal(sections.length, 24);
  assert.equal(new Set(sections.map(m => m.section_name)).size, 7);
  assert.ok(sections.every(m => m.section_name?.trim()));
  assert.deepEqual(sections.map(m => m.section_name), [
    ...Array(4).fill('Penjelasan, Waktu & Kemampuan'),
    ...Array(5).fill('Tindakan, Keadaan & Perubahan'),
    ...Array(5).fill('Alasan, Dugaan & Pengandaian'),
    ...Array(4).fill('Tujuan, Instruksi & Interaksi'),
    ...Array(2).fill('Informasi, Perbandingan & Kondisi'),
    ...Array(2).fill('Pasif & Kausatif'),
    ...Array(2).fill('Bahasa Hormat & Merendah'),
  ]);
  await migrate('157_n4_curriculum_sections.sql');
  assert.deepEqual(await rows(`SELECT m.sort_order, m.section_name FROM modules m JOIN courses c ON c.id=m.course_id WHERE c.slug='n4' ORDER BY m.sort_order`), sections);
  await db.exec("UPDATE modules SET section_name='Editor section' WHERE slug LIKE 'n4-b01-%'; UPDATE modules SET section_name='   ' WHERE slug LIKE 'n4-b02-%';");
  await migrate('157_n4_curriculum_sections.sql');
  assert.equal((await rows("SELECT section_name FROM modules WHERE slug LIKE 'n4-b01-%'"))[0].section_name, 'Editor section');
  assert.equal((await rows("SELECT section_name FROM modules WHERE slug LIKE 'n4-b02-%'"))[0].section_name, sections[1].section_name);
  assert.deepEqual(await rows('SELECT * FROM lessons ORDER BY id'), lessonsBeforeSections);
  assert.deepEqual(await rows("SELECT * FROM modules WHERE slug='n5-sentinel'"), n5Before);
  assert.deepEqual(await rows('SELECT * FROM kanji_items ORDER BY id'), kanjiBefore);
  t.diagnostic('PASS: migration 157, 24 chapters, 7 sections, exact boundaries, rerun, editor labels, whitespace recovery, unchanged lessons/kanji/N5.');
  await db.exec("DELETE FROM lessons WHERE slug='editor-extra'");
  await db.exec("INSERT INTO lessons(module_id,slug,title,type) SELECT id,'intro','Intro — N5 sentinel','text' FROM modules WHERE slug='n5-sentinel'");
  const retainedLessons = await rows('SELECT * FROM lessons ORDER BY id');
  const retainedGrammar = await rows('SELECT * FROM module_grammar ORDER BY id');
  const legacyCounts = [13,11,13,10,10,10,10,13,11,11,12,11,13,12,12,12,12,12,13,10,13,9];
  const grammarCounts = [7,5,6,5,5,5,5,5,5,6,5,6,6,5,5,7,7,6,6,5,6,5];
  for (let b=1; b<=22; b++) {
    const module = (await db.query("SELECT id FROM modules WHERE slug LIKE $1", [`n4-b${String(b).padStart(2,'0')}-%`])).rows[0].id;
    const legacy = [['intro','Intro — Legacy','text'], ['quiz','Kuis — Legacy','quiz']];
    for (let g=1; g<=grammarCounts[b-1]; g++) legacy.push([`grammar-legacy-${g}`,`Grammar — Legacy ${g}`,'text']);
    for (let v=1; v<=legacyCounts[b-1]-grammarCounts[b-1]-2; v++) legacy.push([`vocab-legacy-${v}`,`Kosakata — Legacy ${v}`,'text']);
    for (const [slug,title,type] of legacy) {
      const result=await db.query('INSERT INTO lessons(module_id,slug,title,type,sort_order) VALUES($1,$2,$3,$4,100) RETURNING id',[module,slug,title,type]);
      if(slug.startsWith('grammar-')) await db.query('INSERT INTO module_grammar(module_id,lesson_id,pattern) VALUES($1,$2,$3)',[module,result.rows[0].id,slug]);
    }
  }
  const oldQuiz=(await rows("SELECT id,module_id FROM lessons WHERE slug='quiz' ORDER BY id LIMIT 1"))[0];
  const oldGrammar=(await rows("SELECT id FROM module_grammar WHERE pattern='grammar-legacy-1' LIMIT 1"))[0].id;
  const user=(await rows("INSERT INTO users(google_id,email,full_name) VALUES('cleanup-fixture','fixture@example.invalid','Fixture') RETURNING id"))[0].id;
  const question=(await db.query("INSERT INTO quiz_questions(lesson_id,question) VALUES($1,'Fixture question') RETURNING id",[oldQuiz.id])).rows[0].id;
  await db.query("INSERT INTO quiz_options(question_id,option_text) VALUES($1,'Option')",[question]);
  const attempt=(await db.query('INSERT INTO quiz_attempts(user_id,lesson_id) VALUES($1,$2) RETURNING id',[user,oldQuiz.id])).rows[0].id;
  await db.query("INSERT INTO quiz_question_results(attempt_id,user_id,lesson_id,question_id,question_category,is_correct) VALUES($1,$2,$3,$4,'grammar',true)",[attempt,user,oldQuiz.id,question]);
  await db.query('INSERT INTO user_progress(user_id,lesson_id,completed) VALUES($1,$2,true)',[user,oldQuiz.id]);
  await db.query("INSERT INTO grammar_examples(grammar_id,japanese) VALUES($1,'Fixture')",[oldGrammar]);
  await db.query("INSERT INTO module_vocabulary(module_id,lesson_id,japanese) VALUES($1,$2,'Legacy word')",[oldQuiz.module_id,oldQuiz.id]);
  await db.query('INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id) VALUES($1,$2)',[oldQuiz.id,oldGrammar]);
  const backedTables=['lessons','module_grammar','quiz_questions','quiz_options','quiz_attempts','quiz_question_results','user_progress','grammar_examples','module_vocabulary','lesson_grammar_task_items'];
  const beforeCleanup=Object.fromEntries(await Promise.all(backedTables.map(async t=>[t,await rows(`SELECT to_jsonb(t) AS data FROM ${t} t`)])));
  await db.query("UPDATE lessons SET title='Edited quiz' WHERE id=$1",[oldQuiz.id]);
  await assert.rejects(migrate('158_n4_remove_legacy_lessons.sql'), /expected the 253 reviewed legacy lessons/);
  await db.exec('ROLLBACK');
  assert.equal((await rows("SELECT count(*)::int AS n FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE c.slug='n4'"))[0].n,443);
  await db.query("UPDATE lessons SET title='Kuis — Legacy' WHERE id=$1",[oldQuiz.id]);
  await migrate('158_n4_remove_legacy_lessons.sql');
  assert.deepEqual(await rows('SELECT * FROM lessons ORDER BY id'),retainedLessons);
  assert.deepEqual(await rows('SELECT * FROM module_grammar ORDER BY id'),retainedGrammar);
  assert.deepEqual(await rows('SELECT * FROM kanji_items ORDER BY id'),kanjiBefore);
  assert.deepEqual(await rows("SELECT * FROM modules WHERE slug='n5-sentinel'"),n5Before);
  const archive=await rows("SELECT table_name,row_data FROM curriculum_cleanup_archive WHERE cleanup_key='158-n4-legacy'");
  assert.equal(archive.filter(r=>r.table_name==='lessons').length,253);
  assert.equal(archive.filter(r=>r.table_name==='module_grammar').length,123);
  for(const table of backedTables.slice(2)) {
    const remaining=await rows(`SELECT to_jsonb(t) AS data FROM ${table} t`);
    for(const original of beforeCleanup[table]) assert.ok(
      remaining.some(r=>JSON.stringify(r.data)===JSON.stringify(original.data)) ||
      archive.some(r=>r.table_name===table && JSON.stringify(r.row_data)===JSON.stringify(original.data)),`archive missing ${table}`);
  }
  assert.equal((await rows("SELECT lesson_id FROM module_vocabulary WHERE japanese='Legacy word'"))[0].lesson_id,null);
  await migrate('158_n4_remove_legacy_lessons.sql');
  assert.equal((await rows('SELECT count(*)::int AS n FROM curriculum_cleanup_archive'))[0].n,archive.length);
  t.diagnostic('PASS: migration 158 removes only 253 old lessons/123 grammar; new curriculum and kanji unchanged; recursive recovery snapshots include quizzes/options/results/progress/composite mappings/SET NULL vocabulary; rerun safe.');
});
