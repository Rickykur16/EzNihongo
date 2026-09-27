import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const sql = await fs.readFile(new URL('../migrations/169_n5_bunpou_canva_alignment.sql', import.meta.url), 'utf8');
const plan = JSON.parse(await fs.readFile(new URL('../scripts/n5-bunpou-canva-plan.json', import.meta.url), 'utf8'));
const dbAvailable = process.env.TEST_DATABASE_URL || process.env.TEST_PGLITE_URL;

test('Canva plan covers 18 chapters, exactly two consecutive slide segments, and preserves owner titles', () => {
  assert.deepEqual(plan.map(x => x.bab), Array.from({ length: 18 }, (_, i) => i + 3));
  assert.deepEqual(JSON.parse(sql.split('$plan$')[1]), plan);
  // The owner intentionally removed this Canva point; do not restore it.
  const bab4 = plan.find(c => c.bab === 4);
  assert.ok(!bab4.parts.some(p => p.patterns.some(x => x.includes('だれの'))));
  assert.equal(bab4.add, undefined);
  for (const c of plan) {
    assert.equal(c.parts.length, 2);
    const [first, second] = c.parts.map(p => p.slides.split('–').map(Number));
    assert.equal(first[0], 2);
    assert.equal(second[0], first[1] + 1);
    if ([3, 4, 5, 7].includes(c.bab)) assert.ok(c.parts.every(p => p.title === null));
    const patterns = c.parts.flatMap(p => p.patterns);
    assert.equal(new Set(patterns).size, patterns.length);
  }
});

async function fixture() {
  let db;
  if (process.env.TEST_PGLITE_URL) {
    const { PGlite } = await import(process.env.TEST_PGLITE_URL);
    db = new PGlite();
  } else {
    db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
  }
  const schema = `bunpou_${randomUUID().replaceAll('-', '')}`;
  await db.query(`CREATE SCHEMA ${schema}`);
  await db.query(`SET search_path TO ${schema}`);
  // Minimal real SQL tables with the relevant production FK/unique rules.
  for (const statement of [
    'CREATE TABLE courses(id uuid PRIMARY KEY, slug text)',
    'CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid REFERENCES courses(id), title text)',
    `CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid REFERENCES modules(id), slug text, title text, type text,
      content text, video_source_id uuid, video_start_seconds int, video_end_seconds int, updated_at timestamptz,
      UNIQUE(module_id, slug))`,
    `CREATE TABLE module_grammar(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid REFERENCES modules(id),
      lesson_id uuid REFERENCES lessons(id), pattern text, meaning text, notes text, example text, sort_order int,
      dialog_scene jsonb, example_dialog text)`,
    `CREATE TABLE grammar_examples(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grammar_id uuid REFERENCES module_grammar(id),
      japanese text, highlight text, indonesian text, sort_order int)`,
    `CREATE TABLE lesson_grammar_task_items(lesson_id uuid REFERENCES lessons(id), grammar_id uuid REFERENCES module_grammar(id),
      sort_order int, instruction text, required_count int, PRIMARY KEY(lesson_id, grammar_id))`,
    'CREATE TABLE student_progress(lesson_id uuid REFERENCES lessons(id), completed boolean)',
  ]) await db.query(statement);
  const course = randomUUID();
  await db.query('INSERT INTO courses VALUES($1, $2)', [course, 'n5']);
  const lessons = new Map();
  const grammar = new Map();
  const tasks = new Map();
  for (const c of plan) {
    const module = randomUUID();
    await db.query('INSERT INTO modules VALUES($1,$2,$3)', [module, course, `BAB ${c.bab} : Materi`]);
    for (const p of c.parts) {
      const id = randomUUID(); lessons.set(p.slug, id);
      await db.query(`INSERT INTO lessons VALUES($1,$2,$3,$4,'video',$5,$6,50,350,now())`,
        [id, module, p.slug, `Judul admin ${p.slug}`, 'Catatan yang ditulis admin', randomUUID()]);
      await db.query('INSERT INTO student_progress VALUES($1,true)', [id]);
      if (p.task) {
        const tid = randomUUID(); tasks.set(p.task, tid);
        await db.query(`INSERT INTO lessons(id,module_id,slug,title,type,content) VALUES($1,$2,$3,$4,'grammar_task','Pengantar lama')`,
          [tid, module, p.task, `Tugas lama ${p.task}`]);
      }
    }
    for (const [pi, p] of c.parts.entries()) {
      for (const [order, pattern] of p.patterns.entries()) {
        if (c.add?.some(a => a.pattern === pattern)) continue;
        const id = randomUUID(); grammar.set(`${c.bab}:${pattern}`, id);
        // Emulate live errors: wrong sublesson in Bab 8/14, and unlinked
        // teaching content in Bab 9–11; examples/dialogue must survive.
        const lid = [9, 10, 11].includes(c.bab) && pi === 1 ? null
          : lessons.get(c.parts[[8, 14].includes(c.bab) ? 1 - pi : pi].slug);
        await db.query(`INSERT INTO module_grammar VALUES($1,$2,$3,$4,'arti admin','catatan admin','例文', $5, $6,'dialog lama')`,
          [id, module, lid, pattern, 20 - order, JSON.stringify({ speaker: 'Sari', voice: 'preserve-voice' })]);
        await db.query(`INSERT INTO grammar_examples(grammar_id,japanese,indonesian,sort_order) VALUES($1,'例文','contoh admin',0)`, [id]);
      }
    }
    for (const [pi, p] of c.parts.entries()) {
      for (const [order, pattern] of (p.taskPatterns || []).entries()) {
        if (c.add?.some(a => a.pattern === pattern)) continue;
        let id = grammar.get(`${c.bab}:${pattern}`);
        // Live Bab 5 has a distinct task-bank card named 今〜時〜分です.
        if (!id || (c.bab === 5 && pattern === '今〜時〜分です')) {
          id = randomUUID();
          await db.query(`INSERT INTO module_grammar(id,module_id,pattern,meaning) VALUES($1,$2,$3,'arti tugas')`, [id, module, pattern]);
        }
        const tid = tasks.get(c.parts[[5, 6, 8, 10, 14].includes(c.bab) ? 1 - pi : pi].task);
        await db.query(`INSERT INTO lesson_grammar_task_items VALUES($1,$2,$3,$4,3)`, [tid, id, 20 - order, `Instruksi admin: ${pattern}`]);
      }
    }
  }
  // An unrelated course and manually authored additional teaching card.
  const other = randomUUID(), otherModule = randomUUID(), otherLesson = randomUUID();
  await db.query('INSERT INTO courses VALUES($1,$2)', [other, 'n4']);
  await db.query('INSERT INTO modules VALUES($1,$2,$3)', [otherModule, other, 'BAB 14 : N4']);
  await db.query(`INSERT INTO lessons(id,module_id,slug,title,type,content) VALUES($1,$2,$3,'N4 unchanged','video','N4 notes')`,
    [otherLesson, otherModule, plan.find(c => c.bab === 14).parts[0].slug]);
  await db.query(`INSERT INTO module_grammar(module_id,lesson_id,pattern,notes,sort_order)
    SELECT module_id,id,'Tambahan admin','Jangan hapus',99 FROM lessons WHERE id=$1`, [lessons.get('bunpou2-n5-b6')]);
  const close = async () => { await db.query(`DROP SCHEMA ${schema} CASCADE`); await (db.end ? db.end() : db.close()); };
  return { db, lessons, grammar, tasks, close };
}

async function runMigration(db) {
  await db.query('BEGIN');
  try { await (db.exec ? db.exec(sql) : db.query(sql)); await db.query('COMMIT'); }
  catch (error) { await db.query('ROLLBACK'); throw error; }
}

test('alignment moves real SQL memberships atomically without replacing IDs, owner notes, examples, videos or progress',
  { skip: !dbAvailable }, async () => {
    const f = await fixture(); const { db } = f;
    try {
      const before = (await db.query('SELECT id,content,video_source_id,video_start_seconds,video_end_seconds FROM lessons WHERE type=\'video\' ORDER BY id')).rows;
      const examples = (await db.query('SELECT * FROM grammar_examples ORDER BY id')).rows;
      const progress = (await db.query('SELECT * FROM student_progress ORDER BY lesson_id')).rows;
      const dialogs = (await db.query('SELECT id,dialog_scene,example_dialog,meaning,notes FROM module_grammar ORDER BY id')).rows;
      await runMigration(db);
      assert.deepEqual((await db.query('SELECT id,content,video_source_id,video_start_seconds,video_end_seconds FROM lessons WHERE type=\'video\' ORDER BY id')).rows, before);
      assert.deepEqual((await db.query('SELECT * FROM student_progress ORDER BY lesson_id')).rows, progress);
      for (const row of examples) assert.deepEqual((await db.query('SELECT * FROM grammar_examples WHERE id=$1', [row.id])).rows[0], row);
      for (const row of dialogs) assert.deepEqual((await db.query('SELECT id,dialog_scene,example_dialog,meaning,notes FROM module_grammar WHERE id=$1', [row.id])).rows[0], row);
      for (const c of plan) for (const p of c.parts) {
        const l = (await db.query('SELECT title FROM lessons WHERE id=$1', [f.lessons.get(p.slug)])).rows[0];
        assert.equal(l.title, p.title ?? `Judul admin ${p.slug}`);
        const rows = (await db.query('SELECT pattern FROM module_grammar WHERE lesson_id=$1 ORDER BY sort_order', [f.lessons.get(p.slug)])).rows.map(r => r.pattern);
        assert.deepEqual(rows.filter(x => x !== 'Tambahan admin'), p.patterns);
        if (p.task) {
          const actual = (await db.query(`SELECT g.pattern,gi.instruction,gi.required_count FROM lesson_grammar_task_items gi
            JOIN module_grammar g ON g.id=gi.grammar_id WHERE gi.lesson_id=$1 ORDER BY gi.sort_order`, [f.tasks.get(p.task)])).rows;
          assert.deepEqual(actual.map(r => r.pattern), p.taskPatterns);
          for (const r of actual.filter(x => x.pattern !== 'よく／ぜんぜん')) {
            assert.equal(r.instruction, `Instruksi admin: ${r.pattern}`); assert.equal(r.required_count, 3);
          }
        }
      }
      assert.equal((await db.query("SELECT count(*)::int n FROM module_grammar WHERE pattern='今〜時〜分です' AND module_id=(SELECT module_id FROM lessons WHERE id=$1)", [f.lessons.get('bunpou1-n5-b5')])).rows[0].n, 2);
      assert.equal((await db.query("SELECT count(*)::int n FROM n5_bunpou_canva_backup_169 WHERE entity='new_grammar'")).rows[0].n, 1);
      // Manual replay leaves subsequent admin corrections intact.
      await db.query("UPDATE lessons SET title='Edit setelah migrasi' WHERE id=$1", [f.lessons.get('bunpou1-n5-b6')]);
      await runMigration(db);
      assert.equal((await db.query('SELECT title FROM lessons WHERE id=$1', [f.lessons.get('bunpou1-n5-b6')])).rows[0].title, 'Edit setelah migrasi');
    } finally { await f.close(); }
  });

test('unexpected curriculum drift rolls back all earlier chapter changes and backup writes', { skip: !dbAvailable }, async () => {
  const f = await fixture();
  try {
    await f.db.query("UPDATE module_grammar SET pattern='Changed by owner' WHERE id=$1", [f.grammar.get('20:〜が、〜')]);
    await assert.rejects(runMigration(f.db), /missing\/ambiguous pattern/);
    assert.equal((await f.db.query('SELECT title FROM lessons WHERE id=$1', [f.lessons.get('bunpou1-n5-b6')])).rows[0].title, 'Judul admin bunpou1-n5-b6');
    assert.equal((await f.db.query("SELECT count(*)::int n FROM module_grammar WHERE pattern='よく／ぜんぜん'")).rows[0].n, 0);
    assert.equal((await f.db.query("SELECT to_regclass('n5_bunpou_canva_backup_169') AS backup")).rows[0].backup, null);
  } finally { await f.close(); }
});
