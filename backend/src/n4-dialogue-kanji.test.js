import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import furigana from '../../src/dialogue-furigana.js';
import {buildPlan, buildMigration, taughtKanji, n4ChapterKanji} from '../scripts/build-n4-dialogue-kanji.mjs';
import {spokenTurnText, speechText, parseDialog} from './routes/tts.js';
import {n4DialogueSelfChecks} from './n4-dialogue-support.js';
import {seedN4Support} from '../test-support/n4-support-fixture.js';

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const source = read('../content/n4-support/dialogue-plan.json');
const plan = read('../content/n4-support/dialogue-kanji-plan.json');
const supportPlan = read('../content/n4-support/support-plan.json');
const sql190 = fs.readFileSync(new URL('../migrations/190_n4_dialogues.sql', import.meta.url), 'utf8');
const sql192 = fs.readFileSync(new URL('../migrations/192_n4_dialogue_kanji.sql', import.meta.url), 'utf8');

test('the kanji plan and migration 192 are generated from the reviewed rewrite', async () => {
  const authored = (await import('../content/n4-support/dialogue-kanji.mjs')).default;
  const built = buildPlan(source, authored);
  assert.deepEqual(plan, JSON.parse(JSON.stringify(built)));
  assert.equal(sql192, buildMigration(built));
});

test('every N4 dialogue uses only kanji taught by its chapter, each with furigana, and sounds as before', () => {
  const chapters = n4ChapterKanji();
  let kanjiWords = 0, sameTake = 0;
  for (const item of plan.items) {
    const taught = taughtKanji(item.chapter, chapters);
    const before = parseDialog(item.expected.example_dialog), after = parseDialog(item.replacement.example_dialog);
    const data = furigana.normalize(item.replacement.dialog_furigana);
    assert.equal(after.length, before.length);
    for (const [i, turn] of after.entries()) {
      for (const c of turn.text.match(/\p{Script=Han}/gu) || []) assert.ok(taught.has(c), `${c} before chapter ${item.chapter}`);
      const line = furigana.lineFor(data, i, turn);
      assert.ok(line, 'furigana line matches its turn');
      assert.deepEqual(line.readings.map(r => [r.start, r.end]), furigana.groups(turn.text).map(g => [g.start, g.end]));
      kanjiWords += line.readings.length;
      // ElevenLabs only ever gets kana: every kanji is voiced by its furigana.
      const spoken = spokenTurnText(turn, i, data);
      assert.doesNotMatch(spoken, /\p{Script=Han}/u);
      // A line that was all kana in 190 is spoken exactly as before, so its
      // stored take is reused (no new generation, no voice change).
      if (!/\p{Script=Han}/u.test(before[i].text)) { assert.equal(spoken, speechText(before[i].text)); sameTake++; }
    }
    assert.equal(n4DialogueSelfChecks({id: item.grammarId, example_dialog: item.replacement.example_dialog, example_dialog_id: item.expected.example_dialog_id}).length, 2,
      'reading checks stay attached to the kanji text');
  }
  assert.ok(kanjiWords > 300);
  assert.ok(sameTake > 150, 'most lines keep their take');
  assert.deepEqual(n4DialogueSelfChecks({id: plan.items[0].grammarId, example_dialog: 'Teacher revision', example_dialog_id: plan.items[0].expected.example_dialog_id}), []);
});

async function connect(t) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)); assert.match(url.pathname, /test/i);
  assert.equal(url.searchParams.has('host'), false); assert.equal(url.searchParams.has('hostaddr'), false);
  const {default: pg} = await import('pg'); const client = new pg.Client({connectionString: url.href}); await client.connect();
  const schema = 'n4_kanji_' + randomUUID().replaceAll('-', '');
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};`);
  t.after(async () => { await client.query(`DROP SCHEMA ${schema} CASCADE`); await client.end(); });
  return client;
}

test('PostgreSQL: 192 rewrites dialogues still at their 190 text, moves expressions, leaves edited ones, replays cleanly',
  {skip: !process.env.TEST_DATABASE_URL}, async t => {
    const db = await connect(t);
    await seedN4Support(db, supportPlan);
    await db.query(`ALTER TABLE module_grammar ADD COLUMN example_dialog_id text, ADD COLUMN communication_goal text, ADD COLUMN dialog_furigana jsonb;
      CREATE TABLE grammar_dialog_questions(id uuid, grammar_id uuid);
      CREATE TABLE dialogue_speakers(character_key text PRIMARY KEY, voice_id text, voice_name text, profile_version int);
      CREATE TABLE dialogue_character_art(character_key text, expression_key text);`);
    const chars = new Set(source.items.flatMap(i => i.replacement.dialog_scene.participants.map(p => p.characterKey)));
    for (const key of chars) {
      await db.query('INSERT INTO dialogue_speakers VALUES($1,$2,$3,2)', [key, 'voice-' + key, 'Voice']);
      for (const e of ['senang', 'berpikir', 'bingung', 'kaget']) await db.query('INSERT INTO dialogue_character_art VALUES($1,$2)', [key, e]);
    }
    for (const i of source.items) {
      await db.query('UPDATE module_grammar SET example_dialog=$1,example_dialog_id=$2,communication_goal=$3,dialog_scene=$4,dialog_furigana=$5 WHERE id=$6',
        [i.expectedDialogue.example_dialog, i.expectedDialogue.example_dialog_id, i.expectedDialogue.communication_goal, i.expectedDialogue.dialog_scene, i.expectedDialogue.dialog_furigana, i.grammarId]);
    }
    await db.query(sql190);
    const [edited, questioned] = [plan.items[1].grammarId, plan.items[2].grammarId];
    await db.query("UPDATE module_grammar SET example_dialog='A: Teacher dialogue' WHERE id=$1", [edited]);
    await db.query('INSERT INTO grammar_dialog_questions VALUES($1,$2)', [randomUUID(), questioned]);
    const notices = []; db.on('notice', n => notices.push(n.message));
    await db.query(sql192);
    const rows = new Map((await db.query('SELECT id, example_dialog, dialog_furigana, dialog_scene FROM module_grammar')).rows.map(r => [r.id, r]));
    let rewritten = 0, movedExpressions = 0;
    for (const item of plan.items) {
      const row = rows.get(item.grammarId);
      if ([edited, questioned].includes(item.grammarId)) continue;
      assert.equal(row.example_dialog, item.replacement.example_dialog);
      assert.deepEqual(row.dialog_furigana, item.replacement.dialog_furigana);
      const turns = parseDialog(row.example_dialog);
      for (const [i, e] of row.dialog_scene.expressions.entries()) if (e) { assert.equal(e.text, turns[i].text); movedExpressions++; }
      assert.ok(row.dialog_scene.participants.every(p => p.voiceId === 'voice-' + p.characterKey), 'voices untouched');
      rewritten++;
    }
    assert.equal(rewritten, 45); assert.ok(movedExpressions > 0);
    assert.equal(rows.get(edited).example_dialog, 'A: Teacher dialogue');
    assert.equal(rows.get(questioned).example_dialog, plan.items[2].expected.example_dialog);
    assert.ok(notices.some(n => /dilewati/.test(n) && n.includes(edited)));
    const snapshot = JSON.stringify((await db.query('SELECT id, example_dialog, dialog_furigana, dialog_scene FROM module_grammar ORDER BY id')).rows);
    await db.query(sql192);
    assert.equal(JSON.stringify((await db.query('SELECT id, example_dialog, dialog_furigana, dialog_scene FROM module_grammar ORDER BY id')).rows), snapshot, 'idempotent');
    assert.equal(Number((await db.query('SELECT count(*) FROM n4_dialogue_kanji_backup_192')).rows[0].count), 45);
  });
