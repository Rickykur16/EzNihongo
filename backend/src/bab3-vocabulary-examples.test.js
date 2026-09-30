import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const plan = JSON.parse(await readFile(new URL('../content/bab3/vocabulary-examples.json', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../migrations/179_bab3_vocabulary_examples.sql', import.meta.url), 'utf8');
const coreWords = 'どうぞ,家族,ベトナム,大学,よろしくお願いします,貴方,インド,会社員,留学生,仕事,会社,中国,先生,ありがとうございます,タイ,私,高校,すみません,〜さん,韓国人,看護師,姉,こちらこそ,名前,銀行員,国,父,大学生,母,〜ちゃん,中国人,苗字,日本,〜君,はじめまして,お名前,兄,韓国,弟,〜人,学生,エンジニア,僕,日本人,出身,医者'.split(',');

test('Bab 3 example corpus preserves all 46 words and keeps 138 examples within the approved language', () => {
  assert.deepEqual(plan.map(item => item.word), coreWords);
  const names = ['ミナ', 'リナ', 'ケン', 'ハディ', 'ミン', 'リン', 'スジン', 'ラビ', 'マリ', 'さくら', 'やまだ', 'たなか'];
  const language = [
    ...coreWords.map(word => word.replace(/^〜/, '')), ...names,
    'あなた', 'はい', 'いいえ', 'そう', 'です', 'じゃありません', 'ではありません',
    'は', 'の', 'も', 'ね', 'よ', 'か',
  ].sort((a, b) => b.length - a.length);
  for (const item of plan) {
    assert.equal(item.examples.length, 3, item.word);
    assert.equal(new Set(item.examples.map(example => example.japanese)).size, 3, item.word);
    for (const example of item.examples) {
      assert.ok(example.japanese.includes(example.highlight), item.word);
      assert.match(example.reading, /^[\p{Script=Hiragana}\p{Script=Katakana}ー。「」、\s]+$/u, item.word);
      assert.ok(example.indonesian.trim().length > 0, item.word);
      assert.ok(!example.japanese.includes('〜'), item.word);
      // Lexical closure catches accidental verbs, new vocabulary, and syntax
      // outside the six fixed Bab 3 patterns while allowing proper names.
      let remainder = example.japanese.replace(/[。「」、\s]/gu, '');
      while (remainder) {
        const token = language.find(word => remainder.startsWith(word));
        assert.ok(token, item.word + ': unsupported text ' + remainder);
        remainder = remainder.slice(token.length);
      }
    }
  }
  assert.equal(plan.flatMap(item => item.examples).length, 138);
  const embedded = migration.match(/plan JSONB := \$content\$([\s\S]*?)\$content\$::jsonb/);
  assert.ok(embedded, 'migration embeds its reviewable corpus');
  assert.deepEqual(JSON.parse(embedded[1]), plan);
});

const integrationOptions = {
  skip: !process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_URL &&
    'Set a local TEST_DATABASE_URL or TEST_PGLITE_URL for migration execution',
  timeout: 30000,
};

async function fixture(t, { legacy = false } = {}) {
  let client;
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    assert.match(decodeURIComponent(url.pathname), /test/i);
    assert.equal(url.searchParams.has('host'), false);
    assert.equal(url.searchParams.has('hostaddr'), false);
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
    await client.connect();
  } else {
    const { PGlite } = await import(process.env.TEST_PGLITE_URL);
    const db = new PGlite();
    client = {
      query: async (sql, params) => params ? db.query(sql, params) :
        (await db.exec(sql)).at(-1) || { rows: [] },
      end: () => db.close(),
    };
  }
  const schemaName = 'bab3_vocab_test_' + randomUUID().replaceAll('-', '');
  const schema = '"' + schemaName + '"';
  t.after(async () => {
    try { await client.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); }
    finally { await client.end(); }
  });
  await client.query('CREATE SCHEMA ' + schema + '; SET search_path TO ' + schema);
  await client.query(`
    CREATE TABLE courses(id UUID PRIMARY KEY, slug TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY, course_id UUID NOT NULL, slug TEXT NOT NULL);
    CREATE TABLE lessons(id UUID PRIMARY KEY, module_id UUID NOT NULL, slug TEXT NOT NULL, type TEXT NOT NULL);
    CREATE TABLE module_vocabulary(id UUID PRIMARY KEY, module_id UUID NOT NULL, lesson_id UUID,
      japanese TEXT NOT NULL, reading TEXT, indonesian TEXT, note TEXT, sort_order INT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE lesson_deck_items(lesson_id UUID NOT NULL, vocabulary_id UUID NOT NULL,
      sort_order INT, accent_color TEXT, PRIMARY KEY(lesson_id,vocabulary_id));
    CREATE TABLE vocabulary_examples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), vocabulary_id UUID NOT NULL,
      japanese TEXT NOT NULL, reading TEXT, highlight TEXT, indonesian TEXT, sort_order INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
  `);
  if (legacy) await client.query(`ALTER TABLE module_vocabulary ADD COLUMN example_japanese TEXT,
    ADD COLUMN example_reading TEXT, ADD COLUMN example_indonesian TEXT`);
  const ids = Object.fromEntries(['course', 'module', 'deck', 'otherModule', 'otherDeck', 'otherWord'].map(key => [key, randomUUID()]));
  await client.query("INSERT INTO courses VALUES ($1,'n5')", [ids.course]);
  await client.query("INSERT INTO modules VALUES ($1,$3,'n5-b3'),($2,$3,'n5-b4')", [ids.module, ids.otherModule, ids.course]);
  await client.query("INSERT INTO lessons VALUES ($1,$3,'kosakata-n5-b3','deck'),($2,$4,'kosakata-n5-b4','deck')",
    [ids.deck, ids.otherDeck, ids.module, ids.otherModule]);
  const wordIds = new Map();
  for (const [index, item] of plan.entries()) {
    const id = randomUUID();
    wordIds.set(item.word, id);
    await client.query(`INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese,reading,indonesian,note,sort_order)
      VALUES($1,$2,$3,$4,'original-reading','original-meaning','original-note',$5)`, [id, ids.module, ids.deck, item.word, index]);
    await client.query("INSERT INTO lesson_deck_items VALUES($1,$2,$3,'#abcdef')", [ids.deck, id, index]);
    // Include surplus/duplicate old examples to prove that the full history is
    // backed up and none survives as an unintended fourth example.
    for (let exampleIndex = 0; exampleIndex < (index === 0 ? 5 : 2); exampleIndex++) {
      await client.query(`INSERT INTO vocabulary_examples(vocabulary_id,japanese,reading,highlight,indonesian,sort_order)
        VALUES($1,'古い例文','ふるいれいぶん','例文','Terjemahan lama',$2)`, [id, exampleIndex]);
    }
  }
  await client.query(`INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese) VALUES($1,$2,$3,'別の語');
    `, [ids.otherWord, ids.otherModule, ids.otherDeck]);
  await client.query("INSERT INTO lesson_deck_items VALUES($1,$2,0,NULL)", [ids.otherDeck, ids.otherWord]);
  await client.query("INSERT INTO vocabulary_examples(vocabulary_id,japanese,sort_order) VALUES($1,'untouched',0)", [ids.otherWord]);
  if (legacy) await client.query(`UPDATE module_vocabulary SET example_japanese='legacy Japanese',
    example_reading='legacy reading',example_indonesian='legacy Indonesian'`);
  const rows = async (sql, params = []) => (await client.query(sql, params)).rows;
  const apply = async () => {
    await client.query('BEGIN');
    try { await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  return { client, rows, apply, ids, wordIds };
}

test('Bab 3 vocabulary migration backs up every example and changes only scoped examples', integrationOptions, async t => {
  const { client, rows, apply, ids, wordIds } = await fixture(t);
  const beforeOwners = await rows('SELECT * FROM module_vocabulary ORDER BY id');
  const beforeDecks = await rows('SELECT * FROM lesson_deck_items ORDER BY lesson_id,vocabulary_id');
  const beforeExamples = await rows('SELECT * FROM vocabulary_examples ORDER BY id');
  await apply();
  assert.deepEqual(await rows('SELECT * FROM module_vocabulary ORDER BY id'), beforeOwners);
  assert.deepEqual(await rows('SELECT * FROM lesson_deck_items ORDER BY lesson_id,vocabulary_id'), beforeDecks);
  const backups = await rows('SELECT * FROM bab3_vocabulary_backup_179 ORDER BY vocabulary_id');
  assert.equal(backups.length, 46);
  const backedExampleIds = backups.flatMap(row => row.before_examples.map(example => example.id)).sort();
  assert.deepEqual(backedExampleIds, beforeExamples.filter(row => row.vocabulary_id !== ids.otherWord).map(row => row.id).sort());
  for (const backup of backups) {
    const original = beforeOwners.find(row => row.id === backup.vocabulary_id);
    assert.equal(backup.before_vocabulary.japanese, original.japanese);
    assert.equal(backup.before_vocabulary.note, original.note);
    assert.deepEqual(backup.before_deck_items, beforeDecks.filter(row => row.vocabulary_id === backup.vocabulary_id));
  }
  for (const item of plan) {
    assert.deepEqual(await rows('SELECT japanese,reading,highlight,indonesian FROM vocabulary_examples WHERE vocabulary_id=$1 ORDER BY sort_order',
      [wordIds.get(item.word)]), item.examples);
  }
  assert.deepEqual(await rows('SELECT * FROM vocabulary_examples WHERE vocabulary_id=$1 ORDER BY id', [ids.otherWord]),
    beforeExamples.filter(row => row.vocabulary_id === ids.otherWord));
  const firstId = wordIds.get(plan[0].word);
  await client.query("UPDATE vocabulary_examples SET indonesian='Later teacher edit' WHERE vocabulary_id=$1 AND sort_order=0", [firstId]);
  const afterTeacherEdit = await rows('SELECT * FROM vocabulary_examples ORDER BY id');
  await apply();
  assert.deepEqual(await rows('SELECT * FROM vocabulary_examples ORDER BY id'), afterTeacherEdit);
  assert.equal((await rows('SELECT count(*)::int AS n FROM bab3_vocabulary_backup_179'))[0].n, 46);
});

for (const fault of ['missing', 'duplicate', 'shared']) {
  test('Bab 3 vocabulary migration refuses ' + fault + ' scope before replacing content', integrationOptions, async t => {
    const { client, rows, apply, ids, wordIds } = await fixture(t);
    if (fault === 'missing') await client.query('DELETE FROM lesson_deck_items WHERE lesson_id=$1 AND vocabulary_id=$2', [ids.deck, wordIds.get('どうぞ')]);
    if (fault === 'duplicate') await client.query("UPDATE module_vocabulary SET japanese='どうぞ' WHERE id=$1", [wordIds.get('家族')]);
    if (fault === 'shared') await client.query('INSERT INTO lesson_deck_items VALUES($1,$2,1,NULL)', [ids.otherDeck, wordIds.get('どうぞ')]);
    const before = await rows('SELECT * FROM vocabulary_examples ORDER BY id');
    await assert.rejects(apply(), fault === 'missing' ? /exactly 46/ : fault === 'duplicate' ? /missing or duplicate/ : /shared with another deck/);
    assert.deepEqual(await rows('SELECT * FROM vocabulary_examples ORDER BY id'), before);
    assert.equal((await rows("SELECT to_regclass('bab3_vocabulary_backup_179') AS table_name"))[0].table_name, null);
  });
}

test('Bab 3 vocabulary migration captures and updates optional legacy fallback fields', integrationOptions, async t => {
  const { rows, apply, wordIds } = await fixture(t, { legacy: true });
  await apply();
  const id = wordIds.get('どうぞ');
  const backup = (await rows('SELECT before_vocabulary FROM bab3_vocabulary_backup_179 WHERE vocabulary_id=$1', [id]))[0].before_vocabulary;
  assert.equal(backup.example_japanese, 'legacy Japanese');
  assert.equal(backup.example_reading, 'legacy reading');
  assert.equal(backup.example_indonesian, 'legacy Indonesian');
  const current = (await rows('SELECT example_japanese,example_reading,example_indonesian FROM module_vocabulary WHERE id=$1', [id]))[0];
  const example = plan[0].examples[0];
  assert.deepEqual(current, {
    example_japanese: example.japanese, example_reading: example.reading, example_indonesian: example.indonesian,
  });
});
