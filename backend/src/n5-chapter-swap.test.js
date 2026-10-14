import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import pg from 'pg';

const migration = await readFile(new URL('../migrations/213_swap_n5_chapters_13_14.sql', import.meta.url), 'utf8');
const copy = await readFile(new URL('../../src/n5-learning-copy.js', import.meta.url), 'utf8');
const plan = JSON.parse(await readFile(new URL('../scripts/n5-bunpou-canva-plan.json', import.meta.url), 'utf8'));

test('reordered chapter summaries follow their material while stable links and task ownership survive', () => {
  const context = vm.createContext({});
  vm.runInContext(copy, context);
  const modules = [14, 13].map((original, index) => ({
    id: `uuid-${original}`, slug: `n5-b${original}`, sort_order: index + 13,
    title: `BAB ${index + 13} : ${original === 14 ? 'Bentuk Biasa Kata Kerja & Kewajiban' : 'Bentuk Te: Permintaan, Keadaan, Izin & Larangan'}`,
    description: '', lessons: [
      { id: `source-${original}`, slug: `source-bab-${original}`, title: plan.find(c => c.bab === original).parts[0].title, type: 'video' },
      { id: `task-${original}`, slug: `task-bab-${original}`, title: `Tugas Bunpou Bab ${index + 13}`, type: 'grammar_task', popup_after_lesson_id: `source-${original}` },
      { id: `quiz-${original}`, slug: `quiz-bab-${original}`, title: `Assignment Bab ${index + 13}: Tes`, type: 'quiz' },
    ],
  }));
  const before = JSON.stringify(modules);
  const transformed = context.EzN5Copy.prepareCourse({ slug: 'n5', modules }).modules;
  assert.equal(JSON.stringify(modules), before);
  assert.match(transformed[0].title, /^Bab 13: Bentuk Biasa/);
  assert.match(transformed[0].description, /bentuk biasa/);
  assert.match(transformed[0].lessons[1].title, /Latihan: Bentuk Biasa/);
  assert.match(transformed[1].title, /^Bab 14: Bentuk Te/);
  assert.match(transformed[1].description, /bentuk て/);
  for (let index = 0; index < 2; index++) {
    const original = modules[index], current = transformed[index];
    assert.equal(current.slug, original.slug);
    assert.equal(current.id, original.id);
    assert.equal(current.lessons[1].popup_after_lesson_id, original.lessons[0].id);
    assert.equal(current.lessons[2].title, `Tes Bab ${index + 13}: Tes`);
    assert.deepEqual(current.lessons.map(l => l.id), original.lessons.map(l => l.id));
  }
});

const database = process.env.TEST_DATABASE_URL;
test('Notion vocabulary references follow the new CMS chapter order without changing source IDs or cached data', () => {
  const context = vm.createContext({});
  vm.runInContext(copy, context);
  const course = { level: 'N5', modules: [
    { id: 'n5-b14', title: 'Bab 13: Bentuk Biasa', sectionName: 'Bagian 6: Bentuk Kata Kerja' },
    { id: 'n5-b13', title: 'Bab 14: Penggunaan Te', sectionName: 'Bagian 7: Izin dan Larangan' },
  ] };
  const source13 = { id: 'notion-te', kode: 'N5-B13', nomor: 13, name: 'Te', vocab: [{ id: 'te-word' }] };
  const source14 = { id: 'notion-plain', kode: 'N5-B14', nomor: 14, name: 'Plain', vocab: [{ id: 'plain-word' }] };
  const source = { totalKata: 2, sections: [
    { name: 'Old section 6', bab: [{ id: 'twelve', kode: 'N5-B12' }, source13] },
    { name: 'Old section 7', bab: [source14, { id: 'fifteen', kode: 'N5-B15' }] },
  ] };
  const before = JSON.stringify(source);
  const project = context.EzN5Copy.prepareVocabularyReference;
  const output = project(source, course);
  assert.equal(JSON.stringify(source), before);
  assert.equal(output.sections[0].name, course.modules[0].sectionName);
  assert.equal(output.sections[1].name, course.modules[1].sectionName);
  assert.deepEqual(output.sections[0].bab.map(b => b.id), ['twelve', 'notion-plain']);
  assert.deepEqual(output.sections[1].bab.map(b => b.id), ['notion-te', 'fifteen']);
  assert.equal(output.sections[0].bab[1].kode, 'N5-B13');
  assert.equal(output.sections[0].bab[1].vocab[0].id, 'plain-word');
  assert.equal(output.sections[1].bab[0].kode, 'N5-B14');
  const flat = project({ bab: [source13, source14] }, course);
  assert.deepEqual(flat.bab.map(b => b.id), ['notion-plain', 'notion-te']);
  assert.deepEqual(project({ sections: [], bab: [source13, source14] }, course).bab.map(b => b.id), ['notion-plain', 'notion-te']);
  assert.equal(project(source, { ...course, level: 'N4' }), source);
  assert.equal(project(source, { level: 'N5', modules: [] }), source, 'No projection before the DB migration');
});

async function fixture(t) {
  const url = new URL(database);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  const schema = `n5_swap_${randomUUID().replaceAll('-', '')}`;
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  t.after(async () => {
    try { await client.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await client.end(); }
  });
  await client.query(`
    CREATE TABLE courses(id uuid PRIMARY KEY, slug text UNIQUE);
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid REFERENCES courses, slug text, title text,
      sort_order int, section_name text, description text, scenario text, updated_at timestamptz,
      UNIQUE(course_id,slug), UNIQUE(course_id,sort_order));
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid REFERENCES modules, slug text, title text,
      type text, content text, video_source_id uuid, sort_order int, assessment_policy jsonb, updated_at timestamptz,
      UNIQUE(module_id,slug));
    CREATE TABLE kanji_items(id uuid PRIMARY KEY, lesson_id uuid REFERENCES lessons, character text, bab_kode text, mnemonic text);
    CREATE TABLE user_progress(user_id uuid, lesson_id uuid REFERENCES lessons, completed boolean);
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY, lesson_id uuid REFERENCES lessons, assessment_snapshot jsonb, draft_answers jsonb);
    CREATE TABLE module_grammar(id uuid PRIMARY KEY, module_id uuid REFERENCES modules, lesson_id uuid REFERENCES lessons, pattern text);
    CREATE TABLE module_vocabulary(id uuid PRIMARY KEY, module_id uuid REFERENCES modules, japanese text);
    CREATE TABLE grammar_task_sessions(id uuid PRIMARY KEY, lesson_id uuid REFERENCES lessons, snapshot jsonb);
  `);
  const courses = { n5: randomUUID(), n4: randomUUID() };
  for (const [slug, id] of Object.entries(courses)) {
    await client.query('INSERT INTO courses VALUES($1,$2)', [id, slug]);
    for (const chapter of [12, 13, 14, 15]) {
      const module = randomUUID();
      const section = chapter <= 13 ? 'Section 6 : Kata Kerja Bentuk Te て形' : 'Section 7 : Izin & Larangan & Keigo Dasar';
      await client.query(`INSERT INTO modules VALUES($1,$2,$3,$4,$5,$6,'Authored description','Authored scenario',NOW())`,
        [module, id, `n5-b${chapter}`, `BAB ${chapter} : ${chapter === 13 ? 'Bentuk Te' : chapter === 14 ? 'Bentuk Biasa' : 'Other'}`, chapter, section]);
      for (const [index, type] of ['deck', 'kanji', 'video', 'grammar_task', 'quiz'].entries()) {
        const lesson = randomUUID();
        await client.query(`INSERT INTO lessons VALUES($1,$2,$3,$4,$5,'Authored content',$6,$7,$8,NOW())`,
          [lesson, module, `lesson-${chapter}-${type}`, `${type} Bab ${chapter}`, type, randomUUID(), index,
            { version: 'n5-assessment-v4', sourceChapter: chapter, objectives: [{ id: 'original' }] }]);
        await client.query('INSERT INTO user_progress VALUES($1,$2,true)', [randomUUID(), lesson]);
        await client.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,$4)',
          [randomUUID(), lesson, { chapter, frozen: true }, JSON.stringify([{ questionId: 'original', optionId: 'original' }])]);
        await client.query('INSERT INTO grammar_task_sessions VALUES($1,$2,$3)', [randomUUID(), lesson, { original: true }]);
        await client.query('INSERT INTO module_grammar VALUES($1,$2,$3,$4)', [randomUUID(), module, lesson, `pattern-${chapter}`]);
        if (type === 'kanji') await client.query('INSERT INTO kanji_items VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), lesson, '休', `N5-B${chapter}`, 'Preserved mnemonic']);
      }
      await client.query('INSERT INTO module_vocabulary VALUES($1,$2,$3)', [randomUUID(), module, `word-${chapter}`]);
    }
  }
  const snapshot = async table => (await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row);
  const migrate = async () => {
    await client.query('BEGIN');
    try { await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  return { client, courses, snapshot, migrate };
}

test('PostgreSQL swaps complete chapters atomically and preserves N4, content, deep links and student history',
  { skip: !database }, async t => {
    const { client, courses, snapshot, migrate } = await fixture(t);
    const tables = ['courses','modules','lessons','kanji_items','user_progress','quiz_attempts','module_grammar','module_vocabulary','grammar_task_sessions'];
    const before = {};
    for (const table of tables) before[table] = await snapshot(table);
    const module13 = before.modules.find(m => m.course_id === courses.n5 && m.slug === 'n5-b13');
    const module14 = before.modules.find(m => m.course_id === courses.n5 && m.slug === 'n5-b14');
    // An unexpected source must abort without a partly moved chapter or backup.
    await client.query('UPDATE modules SET title=$1 WHERE id=$2', ['Unexpected title', module14.id]);
    await assert.rejects(migrate, /expected original N5 chapters/);
    assert.equal((await client.query("SELECT to_regclass('n5_chapter_swap_backup_213') AS relation")).rows[0].relation, null);
    assert.equal((await client.query('SELECT sort_order FROM modules WHERE id=$1', [module13.id])).rows[0].sort_order, 13);
    await client.query('UPDATE modules SET title=$1 WHERE id=$2', [module14.title, module14.id]);
    await migrate();
    const after = {};
    for (const table of tables) after[table] = await snapshot(table);
    for (const table of tables.filter(table => !['modules','lessons','kanji_items'].includes(table))) assert.deepEqual(after[table], before[table], table);
    for (const old of before.modules) {
      const current = after.modules.find(m => m.id === old.id);
      const number = old.id === module13.id ? 14 : old.id === module14.id ? 13 : old.sort_order;
      if (old.course_id !== courses.n5 || old.sort_order === 15) assert.deepEqual(current, old);
      else {
        assert.equal(current.sort_order, number);
        assert.equal(current.slug, old.slug);
        assert.match(current.title, new RegExp(`^BAB ${number} :`));
        assert.deepEqual(Object.fromEntries(Object.entries(current).filter(([key]) => !['title','sort_order','section_name','updated_at'].includes(key))),
          Object.fromEntries(Object.entries(old).filter(([key]) => !['title','sort_order','section_name','updated_at'].includes(key))));
        assert.equal(current.section_name, number <= 13 ? 'Section 6 : Bentuk Kata Kerja' : module14.section_name);
      }
    }
    for (const old of before.lessons) {
      const current = after.lessons.find(l => l.id === old.id);
      const number = old.module_id === module13.id ? 14 : old.module_id === module14.id ? 13 : null;
      assert.deepEqual({ ...current, title: old.title, updated_at: old.updated_at }, old);
      assert.equal(current.title, number ? old.title.replace(/Bab (13|14)/g, `Bab ${number}`) : old.title);
    }
    for (const old of before.kanji_items) {
      const lesson = before.lessons.find(l => l.id === old.lesson_id);
      const number = lesson.module_id === module13.id ? 14 : lesson.module_id === module14.id ? 13 : null;
      assert.deepEqual(after.kanji_items.find(k => k.id === old.id), { ...old, bab_kode: number ? `N5-B${number}` : old.bab_kode });
    }
    const backup = await snapshot('n5_chapter_swap_backup_213');
    for (const record of backup.filter(b => b.entity !== 'migration')) {
      const table = { module: 'modules', lesson: 'lessons', kanji: 'kanji_items' }[record.entity];
      assert.deepEqual(record.before_data, before[table].find(row => row.id === record.id));
      assert.deepEqual(record.after_data, after[table].find(row => row.id === record.id));
    }
    await client.query("UPDATE modules SET title='BAB 13 : Teacher revision' WHERE id=$1", [module14.id]);
    const edited = await snapshot('modules');
    await migrate();
    assert.deepEqual(await snapshot('modules'), edited, 'Replay must not swap back or overwrite later edits');
    assert.deepEqual(await snapshot('n5_chapter_swap_backup_213'), backup);
  });
