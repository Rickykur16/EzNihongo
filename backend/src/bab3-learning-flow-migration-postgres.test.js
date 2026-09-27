import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('Bab 3 preparation migration remaps task slots and grounds companion checks', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);

  const schema = `bab3_prepare_test_${randomUUID().replaceAll('-', '')}`;
  const quoted = `"${schema}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => {
    try { await client.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); }
    finally { await client.end(); }
  });
  await client.query(`CREATE SCHEMA ${quoted}; SET search_path TO ${quoted};
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID NOT NULL,slug TEXT NOT NULL);
    CREATE TABLE course_prerequisites(course_id UUID NOT NULL,prerequisite_course_id UUID NOT NULL);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID NOT NULL,slug TEXT NOT NULL,type TEXT NOT NULL,
      popup_after_lesson_id UUID,bunpou_flow_draft JSONB,bunpou_flow_published JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE module_grammar(id UUID PRIMARY KEY,module_id UUID NOT NULL,lesson_id UUID,
      pattern TEXT NOT NULL,sort_order INT,example_dialog TEXT,dialog_scene JSONB);
    CREATE TABLE lesson_grammar_task_items(lesson_id UUID NOT NULL,grammar_id UUID NOT NULL,
      sort_order INT,instruction TEXT,required_count INT,PRIMARY KEY(lesson_id,grammar_id));`);

  const courseId = randomUUID(), moduleId = randomUUID();
  const lesson1 = randomUUID(), lesson2 = randomUUID();
  const task1 = randomUUID(), task2 = randomUUID();
  await client.query("INSERT INTO courses VALUES ($1,'n5')", [courseId]);
  await client.query("INSERT INTO modules VALUES ($1,$2,'n5-b3')", [moduleId, courseId]);
  await client.query(`INSERT INTO lessons(id,module_id,slug,type,popup_after_lesson_id,
      bunpou_flow_draft,bunpou_flow_published) VALUES
    ($1,$5,'bunpou-n5-b3','video',NULL,
      '{"schemaVersion":1,"editor":{"email":"migration/151_bunpou_flow_bab3_dialog_checks.sql"}}',
      '{"schemaVersion":1,"publishedBy":{"email":"migration/151_bunpou_flow_bab3_dialog_checks.sql"}}'),
    ($2,$5,'bunpou2-n5-b3','video',NULL,
      '{"schemaVersion":1,"editor":{"email":"migration/151_bunpou_flow_bab3_dialog_checks.sql"}}',
      '{"schemaVersion":1,"publishedBy":{"email":"migration/151_bunpou_flow_bab3_dialog_checks.sql"}}'),
    ($3,$5,'tesbunpou1-n5-b3','grammar_task',$1,NULL,NULL),
    ($4,$5,'tesbunpou2-n5-b3','grammar_task',$2,NULL,NULL)`,
  [lesson1, lesson2, task1, task2, moduleId]);

  const dialogue = [
    'N: はじめてあいます。\n\t\nA: わたしはアンナです。\nB: ハディです。どうぞよろしくおねがいします。',
    'N: はなしています。\nA: アメリカじんですか。\nB: アメリカじんじゃありません。オーストラリアじんです。',
    'N: はなしています。\nA: かいしゃいんですか。\nB: はい。\nA: おしごとはなんですか。\nB: マリアさんはがくせいですか。',
    'N: はなしています。\nA: がくせいですか。\nB: さくらだいがくのがくせいです。\nA: にほんごがっこうのがくせいです。\nB: にほんごのせんせいです。',
    'N: はなしています。\nA: がくせいです。\nB: わたしもがくせいです。\nA: たなかさんもがくせいですか。\nB: たなかさんはせんせいです。',
    'N: はなしています。\nA: にほんじんですね。\nB: そうです。\nA: エンジニアですよ。\nB: そうですか。',
  ];
  const sourceIds = Array.from({ length: 6 }, () => randomUUID());
  const duplicateIds = Array.from({ length: 6 }, () => randomUUID());
  for (let index = 0; index < 6; index++) {
    const owner = index < 3 ? lesson1 : lesson2;
    const order = index % 3;
    await client.query(`INSERT INTO module_grammar
      (id,module_id,lesson_id,pattern,sort_order,example_dialog) VALUES
      ($1,$2,$3,$4,$5,$6),($7,$2,NULL,$8,$5,$6)`,
    [sourceIds[index], moduleId, owner, `source-${index}`, order, dialogue[index],
      duplicateIds[index], `duplicate-${index}`]);
    await client.query(`INSERT INTO lesson_grammar_task_items
      (lesson_id,grammar_id,sort_order,instruction,required_count) VALUES ($1,$2,$3,$4,1)`,
    [index < 3 ? task1 : task2, duplicateIds[index], order, `instruction-${index}`]);
  }
  await client.query(`UPDATE module_grammar SET dialog_scene=$2::jsonb WHERE id=$1`, [sourceIds[1],
    JSON.stringify({ turns: [
      { text: 'はなしています。' },
      { text: 'アメリカじんですか。' },
      { text: '', japanese: 'アメリカじんじゃありません。オーストラリアじんです。' },
    ] })]);

  const migration = await readFile(new URL('../migrations/174_prepare_bab3_learning_flow.sql',
    import.meta.url), 'utf8');
  await client.query(migration);
  await client.query(`UPDATE lessons SET
    bunpou_flow_draft=jsonb_set(bunpou_flow_draft,'{sourceFingerprint}','"sha256:current"'),
    bunpou_flow_published=jsonb_set(bunpou_flow_published,'{sourceFingerprint}','"sha256:current"')
    WHERE id=ANY($1::uuid[])`, [[lesson1, lesson2]]);
  await client.query(migration);

  const memberships = (await client.query(`SELECT lesson_id,grammar_id,sort_order,instruction
    FROM lesson_grammar_task_items ORDER BY lesson_id,sort_order`)).rows;
  assert.deepEqual(new Set(memberships.map(row => row.grammar_id)), new Set(sourceIds));
  assert.deepEqual(new Set(memberships.map(row => row.instruction)),
    new Set(Array.from({ length: 6 }, (_, index) => `instruction-${index}`)));

  const companions = (await client.query(`SELECT slug,bunpou_flow_published FROM lessons
    WHERE id=ANY($1::uuid[]) ORDER BY slug`, [[lesson1, lesson2]])).rows;
  const snapshotMd5 = (await client.query(`SELECT md5(
      coalesce((SELECT jsonb_agg((to_jsonb(g) - 'created_at' - 'updated_at') ORDER BY g.id)
        FROM module_grammar g WHERE g.module_id=$1), '[]'::jsonb)::text
      || '|' ||
      coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.lesson_id,i.sort_order,i.grammar_id)
        FROM lesson_grammar_task_items i JOIN lessons t ON t.id=i.lesson_id
        WHERE t.module_id=$1), '[]'::jsonb)::text
    ) AS value`, [moduleId])).rows[0].value;
  assert.deepEqual(companions.map(row => Object.keys(row.bunpou_flow_published.dialogChecks).length), [3, 3]);
  assert.equal(companions.every(row =>
    row.bunpou_flow_published.preparationReview.sourceSnapshotMd5 === snapshotMd5), true);
  assert.equal(companions.every(row =>
    row.bunpou_flow_published.sourceFingerprint === 'sha256:current'), true);
  for (const lesson of companions) for (const check of Object.values(lesson.bunpou_flow_published.dialogChecks)) {
    assert.ok(check.comprehension.evidence.length >= 1);
    assert.equal(check.comparison.evidence, undefined);
  }
  const firstChecks = companions.find(row => row.slug === 'bunpou-n5-b3').bunpou_flow_published.dialogChecks;
  assert.ok(Object.values(firstChecks).some(check =>
    check.comprehension.prompt === 'Apa yang dilakukan penutur kedua pada gilirannya?'));

  await client.query(`UPDATE lessons SET bunpou_flow_draft=jsonb_set(
    bunpou_flow_draft,'{editor,email}','"owner@example.test"') WHERE id=$1`, [lesson1]);
  await assert.rejects(client.query(migration), /reviewed companion\/source snapshot changed/u);
  assert.equal((await client.query(`SELECT bunpou_flow_published->>'sourceFingerprint' AS fingerprint
    FROM lessons WHERE id=$1`, [lesson1])).rows[0].fingerprint, 'sha256:current');
});
