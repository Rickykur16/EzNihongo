import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { n5KanjiSupportInventory } from '../content/n5-support/kanji-support.mjs';
import { renderKanjiMemory } from '../content/n5-support/render-kanji-memory.mjs';

const contentUrl = new URL('../content/n5-support/kanji-mnemonics.json', import.meta.url);
const migrationUrl = new URL('../migrations/212_n5_visual_mnemonics.sql', import.meta.url);
// Bab 3 has a separate support source; Bab 4–20 use the existing shared inventory.
const bab3Characters = [...'先生学校国名人語何'];
const chapters = new Map(bab3Characters.map(character => [character, 3]));
for (const { chapter, characters } of n5KanjiSupportInventory) {
  for (const character of characters) if (!chapters.has(character)) chapters.set(character, chapter);
}
const loadContent = async () => JSON.parse(await readFile(contentUrl, 'utf8'));

test('component-first memory catalog covers every existing N5 chapter kanji, including previously blank stories', async () => {
  const stories = await loadContent();
  assert.equal(chapters.size, 103, 'existing class curriculum inventory');
  assert.equal(stories.length, chapters.size);
  assert.equal(new Set(stories.map(story => story.character)).size, stories.length, 'one story per kanji');
  assert.deepEqual(new Set(stories.map(story => story.character)), new Set(chapters.keys()));
  for (const story of stories) {
    assert.match(story.character, /^\p{Unified_Ideograph}$/u);
    assert.equal(typeof story.meaning, 'string', story.character);
    assert.ok(story.meaning.trim(), `${story.character}: a primary meaning`);
    for (const field of ['components', 'componentNote', 'shapeHint', 'mnemonic']) {
      assert.ok(Object.hasOwn(story, field), `${story.character}: explicit ${field}`);
      const value = story[field];
      assert.ok(value === null || typeof value === 'string', `${story.character}: ${field} is text or null`);
      if (value !== null) {
        assert.equal(value, value.trim(), `${story.character}: ${field} has no stray whitespace`);
        assert.ok(value.length > 0 && value.length <= 320, `${story.character}: concise nonempty ${field}`);
      }
    }
    assert.ok(story.components || story.shapeHint, `${story.character}: components or a shape hint`);
    if (story.mnemonic !== null) {
      assert.match(story.mnemonic, /^Bayangkan\b/u, `${story.character}: clearly marked imagined scene`);
      assert.doesNotMatch(story.mnemonic, /piktogram|etimologi|asal[- ]usul|peminjaman bunyi/iu,
        `${story.character}: mnemonic rather than a historical claim`);
    }
    if (story.sources !== undefined) {
      assert.ok(Array.isArray(story.sources), `${story.character}: source metadata is a list`);
      for (const source of story.sources) {
        assert.equal(typeof source, 'string', `${story.character}: source URL`);
        const url = new URL(source);
        assert.ok(['http:', 'https:'].includes(url.protocol), `${story.character}: web source`);
      }
    }
    assert.ok(renderKanjiMemory(story).startsWith('<p>'), `${story.character}: renderable learning aid`);
  }
});

test('kanji memory renderer escapes every editorial field, orders explanations and omits source metadata', () => {
  const html = renderKanjiMemory({
    character: '<script>ignored</script>',
    meaning: '<script>ignored</script>',
    components: '木 <b>pohon</b> & 斤 "kapak"',
    componentNote: "斤 berperan sebagai bunyi; 'bukan arti baru'.",
    shapeHint: 'Bentuk <ujung> & goresan "kanan".',
    mnemonic: 'Bayangkan <img src=x onerror=alert(1)> & "pohon".',
    sources: ['https://metadata.invalid/never-render-this-source'],
  });
  assert.equal(html,
    '<p><strong>Penyusun:</strong> 木 &lt;b&gt;pohon&lt;/b&gt; &amp; 斤 &quot;kapak&quot;</p>'
    + '<p>斤 berperan sebagai bunyi; &#39;bukan arti baru&#39;.</p>'
    + '<p><strong>Petunjuk bentuk:</strong> Bentuk &lt;ujung&gt; &amp; goresan &quot;kanan&quot;.</p>'
    + '<p><strong>Cara ingat:</strong> Bayangkan &lt;img src=x onerror=alert(1)&gt; &amp; &quot;pohon&quot;.</p>');
  assert.doesNotMatch(html, /<script|<img|<b>|metadata\.invalid|never-render-this-source/u);
  assert.equal(renderKanjiMemory({ components: null, componentNote: null,
    shapeHint: 'Tiga garis seperti aliran sungai.', mnemonic: null }),
  '<p><strong>Petunjuk bentuk:</strong> Tiga garis seperti aliran sungai.</p>');
  assert.equal(renderKanjiMemory({ components: '亻 (orang) + 木 (pohon)', componentNote: null,
    shapeHint: null, mnemonic: null }),
  '<p><strong>Penyusun:</strong> 亻 (orang) + 木 (pohon)</p>');
  assert.throws(() => renderKanjiMemory({ components: null, shapeHint: null }), /components or a shape hint/u);
  assert.throws(() => renderKanjiMemory({ components: 123, shapeHint: null }), /text or null/u);
});

test('N5 mnemonic migration updates all assigned stories, preserves catalog data and backs up original text once', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
  const schema = `n5_mnemonic_test_${randomUUID().replaceAll('-', '')}`;
  const quoted = `"${schema}"`;
  await client.connect();
  t.after(async () => {
    try { await client.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); }
    finally { await client.end(); }
  });
  await client.query(`CREATE SCHEMA ${quoted}; SET search_path TO ${quoted};
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID,slug TEXT NOT NULL);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID,slug TEXT NOT NULL,type TEXT NOT NULL,
      sort_order INT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE kanji_items(id UUID PRIMARY KEY,character TEXT NOT NULL,jlpt_level TEXT NOT NULL,
      on_reading TEXT,kun_reading TEXT,meaning_id TEXT,mnemonic TEXT,stroke_count INT,
      bab_kode TEXT,lesson_id UUID,sort_order INT NOT NULL,compounds JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL);`);

  const stories = await loadContent();
  const byCharacter = new Map(stories.map(story => [story.character, story]));
  const n5 = randomUUID(), n4 = randomUUID(), other = randomUUID();
  await client.query("INSERT INTO courses VALUES ($1,'n5'),($2,'n4'),($3,'other')", [n5, n4, other]);
  const lessons = new Map();
  for (const chapter of new Set(chapters.values())) {
    const moduleId = randomUUID(), lessonId = randomUUID();
    await client.query('INSERT INTO modules VALUES ($1,$2,$3)', [moduleId, n5, `n5-b${chapter}`]);
    await client.query("INSERT INTO lessons VALUES ($1,$2,$3,'kanji',$4,DEFAULT)",
      [lessonId, moduleId, `kanji-n5-b${chapter}`, chapter]);
    lessons.set(chapter, lessonId);
  }
  const outsideLessons = [];
  for (const [courseId, slug] of [[n4, 'n4-b3'], [other, 'other-b3'], [null, 'detached']]) {
    const moduleId = randomUUID(), lessonId = randomUUID();
    await client.query('INSERT INTO modules VALUES ($1,$2,$3)', [moduleId, courseId, slug]);
    await client.query("INSERT INTO lessons VALUES ($1,$2,$3,'kanji',1,DEFAULT)",
      [lessonId, moduleId, `kanji-${slug}`]);
    outsideLessons.push(lessonId);
  }
  const oldTime = '2020-01-02T03:04:05.000Z';
  const originals = new Map();
  const insertKanji = async (character, lessonId, level, mnemonic) => {
    const id = randomUUID();
    await client.query(`INSERT INTO kanji_items VALUES
      ($1,$2,$3,'オン','くん','meaning retained',$4,12,'original-bab',$5,7,
      '[{"japanese":"語","reading":"ご","indonesian":"bahasa"}]'::jsonb,$6,$6)`,
    [id, character, level, mnemonic, lessonId, oldTime]);
    originals.set(id, mnemonic);
    return id;
  };
  const targetIds = new Set();
  const unchangedIds = new Set();
  const formerlyBlank = new Set([...'父母友足口目耳小少雨天空山川']);
  for (const story of stories) {
    const { character } = story;
    const original = character === '木' ? renderKanjiMemory(story)
      : formerlyBlank.has(character) ? null : `Cerita lama ${character}`;
    const id = await insertKanji(character, lessons.get(chapters.get(character)), 'N5', original);
    targetIds.add(id);
    if (character === '木') unchangedIds.add(id);
  }
  // The same character can legitimately belong to more than one lesson.
  const duplicateId = await insertKanji('休', lessons.get(18), 'N5', '');
  targetIds.add(duplicateId);
  for (const [character, lessonId, level] of [
    ['休', outsideLessons[0], 'N4'],
    ['休', outsideLessons[0], 'N5'], // Incorrect level alone cannot pull another course into scope.
    ['休', outsideLessons[1], 'N5'],
    ['休', outsideLessons[2], 'N5'],
    ['休', lessons.get(14), 'N4'],
    ['休', null, 'N5'],
    ['漢', lessons.get(14), 'N5'], // Never create or replace unrelated catalog entries.
  ]) unchangedIds.add(await insertKanji(character, lessonId, level, 'Keep outside scope'));

  const snapshot = async table => (await client.query(
    `SELECT to_jsonb(row_data) AS row FROM ${table} row_data ORDER BY id`)).rows.map(({ row }) => row);
  const before = await snapshot('kanji_items');
  const structureBefore = {};
  for (const table of ['courses', 'modules', 'lessons']) structureBefore[table] = await snapshot(table);
  const migration = await readFile(migrationUrl, 'utf8');
  const migrate = async () => {
    await client.query('BEGIN');
    try { await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  await migrate();
  const after = await snapshot('kanji_items');
  assert.equal(after.length, before.length, 'no kanji rows inserted or deleted');
  const beforeById = new Map(before.map(row => [row.id, row]));
  for (const row of after) {
    const old = beforeById.get(row.id);
    if (unchangedIds.has(row.id)) {
      assert.deepEqual(row, old, `${row.character}: unchanged or outside scope`);
    } else {
      assert.ok(targetIds.has(row.id));
      assert.equal(row.mnemonic, renderKanjiMemory(byCharacter.get(row.character)), row.character);
      assert.notEqual(row.updated_at, old.updated_at, `${row.character}: update recorded`);
      const { mnemonic: oldMnemonic, updated_at: oldUpdatedAt, ...oldCatalog } = old;
      const { mnemonic, updated_at, ...catalog } = row;
      assert.deepEqual(catalog, oldCatalog, `${row.character}: readings, meaning, assignment, compounds and order retained`);
    }
  }
  for (const table of ['courses', 'modules', 'lessons']) {
    assert.deepEqual(await snapshot(table), structureBefore[table], `${table}: assignments retained`);
  }
  const backupSnapshot = async () => (await client.query(`SELECT kanji_id,mnemonic,
    backed_up_at::text FROM n5_kanji_mnemonic_backup_212 ORDER BY kanji_id`)).rows;
  const backup = await backupSnapshot();
  assert.equal(backup.length, targetIds.size - 1, 'only changed rows backed up');
  assert.deepEqual(new Set(backup.map(row => row.kanji_id)),
    new Set([...targetIds].filter(id => !unchangedIds.has(id))), 'every changed row has its own backup');
  for (const row of backup) {
    assert.ok(targetIds.has(row.kanji_id));
    assert.equal(row.mnemonic, originals.get(row.kanji_id), 'backup keeps exact old text, including NULL and empty text');
  }
  assert.ok(backup.some(row => row.mnemonic === null), 'previously empty stories have restorable NULL values');
  assert.equal(backup.find(row => row.kanji_id === duplicateId).mnemonic, '');

  await migrate();
  assert.deepEqual(await snapshot('kanji_items'), after, 'rerun does not churn timestamps');
  assert.deepEqual(await backupSnapshot(), backup, 'rerun keeps the first backup');
  await client.query('UPDATE kanji_items SET mnemonic=$2 WHERE id=$1', [duplicateId, 'Intervening text']);
  await migrate();
  assert.equal((await client.query('SELECT mnemonic FROM kanji_items WHERE id=$1',
    [duplicateId])).rows[0].mnemonic, renderKanjiMemory(byCharacter.get('休')));
  assert.deepEqual(await backupSnapshot(), backup, 'first backup survives a later repair');
});
