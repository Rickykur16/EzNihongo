import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const bank = JSON.parse(await readFile(new URL('../content/assessments/n5-b03.json', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../migrations/168_correct_bab3_listening_speakers.sql', import.meta.url), 'utf8');
const items = Object.values(bank.forms).flat();
const corrections = [...migration.matchAll(/\('(b03-[ab]-l\d{2})', \$old\$([\s\S]*?)\$old\$, \$new\$([\s\S]*?)\$new\$\)/g)]
  .map(([, id, oldScript, newScript]) => ({ id, oldScript, newScript }));

test('Bab 3 voice correction preserves every question, answer, explanation and curriculum field', () => {
  const contentOnly = structuredClone(bank);
  Object.values(contentOnly.forms).flat().forEach(q => { delete q.audioScript; });
  // Reviewed bank before this bounded audio-role-only correction.
  const digest = createHash('sha256').update(JSON.stringify(contentOnly)).digest('hex');
  assert.equal(digest, '2a390e26a07c3ba1ee14a43d8258c55b559a616196f0ce14c085fd7df2028b21');
  assert.deepEqual(corrections.map(c => c.id), ['b03-a-l01','b03-a-l02','b03-a-l03','b03-b-l02','b03-b-l04']);
  const spokenText = script => script.split('\n').map(line => line.replace(/^[A-Z]: /, ''));
  for (const correction of corrections) {
    assert.equal(items.find(q => q.id === correction.id).audioScript, correction.newScript);
    assert.deepEqual(spokenText(correction.newScript), spokenText(correction.oldScript), correction.id);
  }
});

test('explicit Bab 3 characters use the intended legacy voice, including Sari on the second turn', () => {
  // Isolate module-level env configuration. These labels are test fixtures only;
  // no API request is made and no fictional voice ID is stored in content.
  const script = `
    import fs from 'node:fs';
    import {parseDialog,voiceForSpeaker,ttsHashKey} from ${JSON.stringify(new URL('./routes/tts.js', import.meta.url).href)};
    const bank=JSON.parse(fs.readFileSync(new URL(${JSON.stringify(new URL('../content/assessments/n5-b03.json', import.meta.url).href)}),'utf8'));
    const rows=Object.values(bank.forms).flat().filter(q=>q.category==='listening').map(q=>{
      const turns=parseDialog(q.audioScript);
      const voices=turns.map((t,i)=>voiceForSpeaker(t.speaker,i).voiceId);
      return {id:q.id,speakers:turns.map(t=>t.speaker),voices,cacheKey:ttsHashKey(q.audioScript,voices)};
    });
    process.stdout.write(JSON.stringify(rows));
  `;
  const rows = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { ...process.env, ELEVENLABS_API_KEY: '', ELEVENLABS_VOICE_FEMALE: 'fixture-female', ELEVENLABS_VOICE_MALE: 'fixture-male' },
    encoding: 'utf8', timeout: 15000,
  }));
  const expected = {
    'b03-a-l01': ['A','F'], // Maria, Yuki
    'b03-a-l02': ['M','F'], // Ken, questioner
    'b03-a-l03': ['A','F'], // Dewi, Sari
    'b03-a-l04': ['A','B'], // questioner, Hadi
    'b03-b-l01': ['A','B'], // Sumi, questioner
    'b03-b-l02': ['M'],     // Leo
    'b03-b-l03': ['A'],     // Emi
    'b03-b-l04': ['A','F'], // questioner, Mina
  };
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.deepEqual(row.speakers, expected[row.id], row.id);
    assert.deepEqual(row.voices, expected[row.id].map(role => ['A','F'].includes(role) ? 'fixture-female' : 'fixture-male'), row.id);
  }
  assert.equal(rows.find(q => q.id === 'b03-a-l03').voices[1], 'fixture-female', 'Sari must not inherit the second-turn male default');
});

test('migration 168 changes only exact unedited Bab 3 scripts and preserves admin edits and attempt snapshots', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 20000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Use a local test database only');
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  t.after(() => client.end());
  // Temporary tables shadow application tables for this connection. This test
  // never modifies the real bank or real attempt snapshots in the database.
  await client.query(`CREATE TEMP TABLE quiz_questions (
    id text PRIMARY KEY, question text, options jsonb, question_category text,
    assessment_meta jsonb, audio_script text, audio_scene jsonb
  ); CREATE TEMP TABLE quiz_attempts (id text PRIMARY KEY, assessment_snapshot jsonb);`);
  const makeRow = (id, correction, overrides = {}) => ({
    id, question: 'Keep question', options: [{ text: 'Keep answer', correct: true }],
    question_category: 'listening', assessment_meta: { version: 'n5-assessment-v2', key: correction.id },
    audio_script: correction.oldScript, audio_scene: null, ...overrides,
  });
  const first = corrections[0];
  const fixtures = [
    ...corrections.map(c => makeRow(c.id, c)),
    makeRow('admin-script', first, { audio_script: first.oldScript + '\nA: ありがとうございます。' }),
    makeRow('admin-scene', first, { audio_scene: { schemaVersion: 1, fixture: 'preserve admin scene' } }),
    makeRow('other-version', first, { assessment_meta: { version: 'older-version', key: first.id } }),
    makeRow('other-key', first, { assessment_meta: { version: 'n5-assessment-v2', key: 'b04-a-l01' } }),
    makeRow('other-category', first, { question_category: 'reading' }),
  ];
  for (const row of fixtures) await client.query(
    'INSERT INTO quiz_questions(id,question,options,question_category,assessment_meta,audio_script,audio_scene) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [row.id,row.question,JSON.stringify(row.options),row.question_category,JSON.stringify(row.assessment_meta),row.audio_script,row.audio_scene && JSON.stringify(row.audio_scene)],
  );
  const frozen = { version: 'n5-assessment-v2', questions: corrections.map(c => ({ id: c.id, audioScript: c.oldScript })) };
  await client.query('INSERT INTO quiz_attempts VALUES($1,$2)', ['existing-attempt', JSON.stringify(frozen)]);
  assert.equal((await client.query(migration)).rowCount, 5);
  const result = await client.query('SELECT * FROM quiz_questions ORDER BY id');
  const expectedRows = fixtures.map(row => ({ ...row, audio_script: corrections.find(c => c.id === row.id)?.newScript || row.audio_script }))
    .sort((a,b) => a.id.localeCompare(b.id));
  assert.deepEqual(result.rows, expectedRows);
  assert.deepEqual((await client.query('SELECT assessment_snapshot FROM quiz_attempts')).rows[0].assessment_snapshot, frozen);
  assert.equal((await client.query(migration)).rowCount, 0, 'Already corrected scripts are not rewritten');
});
