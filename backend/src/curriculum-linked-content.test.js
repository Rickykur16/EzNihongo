import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedContentCandidate, kanjiUpsertCandidate } from './routes/admin.js';
import { validateContentAgainstBoundary } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';

const LESSON = '11111111-1111-4111-8111-111111111111';
const MODULE = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const COURSE = '44444444-4444-4444-8444-444444444444';
const ID = '55555555-5555-4555-8555-555555555555';

function clientFor(type, moduleId = MODULE) {
  const source = type === 'deck'
    ? { id: ID, module_id: moduleId, course_id: COURSE, japanese: 'あいさつ', reading: 'あいさつ' }
    : { id: ID, module_id: moduleId, course_id: COURSE, pattern: '〜です', meaning: 'adalah',
      example_dialog: '学校です。', example_dialog_id: 'Sekolah.',
      recognition_distractors: '未来', controlled_distractors: '学校',
      communication_goal: '学校を説明する' };
  return { query: async sql => {
    if (sql.includes('FROM module_vocabulary s') || sql.includes('FROM module_grammar s')) return { rows: [source] };
    if (sql.includes('SELECT module_id FROM lessons')) return { rows: [{ module_id: MODULE }] };
    if (sql.includes('WITH RECURSIVE courses')) return { rows: [{ id: COURSE }] };
    if (sql.includes('FROM vocabulary_examples')) return { rows: [{ vocabulary_id: ID,
      japanese: '学校です。', reading: 'がっこうです。', highlight: '学校', indonesian: 'Sekolah.' }] };
    if (sql.includes('FROM grammar_examples')) return { rows: [{ grammar_id: ID,
      japanese: '先生です。', reading: null, highlight: '先生', indonesian: 'Guru.' }] };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
}

test('deck link refuses vocabulary from another module even in the same course', async () => {
  await assert.rejects(linkedContentCandidate(clientFor('deck', OTHER), LESSON, [ID], 'deck'),
    error => error.code === 'vocabulary_deck_owner_mismatch');
});

test('deck link validates stored example text together with vocabulary', async () => {
  const candidate = await linkedContentCandidate(clientFor('deck'), LESSON, [ID], 'deck');
  assert.equal(candidate.scope.lessonId, LESSON);
  assert.ok(candidate.fields.some(field => field.path.includes('deckExamples') && field.text === '学校です。'));
  assert.ok(candidate.fields.some(field => field.path.includes('deckExamples') && field.text === 'がっこうです。'));
});

test('grammar-task link validates examples, dialogue, distractors, goal and instruction', async () => {
  const candidate = await linkedContentCandidate(clientFor('grammar'), LESSON, [ID], 'grammar', ['学校について話す']);
  for (const text of ['学校です。', '未来', '学校', '学校を説明する', '先生です。', '学校について話す']) {
    assert.ok(candidate.fields.some(field => field.text === text), `${text} missing from candidate`);
  }
});

test('kanji upsert preserves legacy compounds in the enforce validation candidate', async () => {
  const existing = { id: ID, lesson_id: LESSON, character: '日', jlpt_level: 'N5',
    compounds: [{ japanese: '学校', reading: 'がっこう' }], updated_at: new Date() };
  const client = { query: async sql => {
    if (sql.includes('WHERE character=$1')) return { rows: [existing] };
    if (sql.includes('FROM kanji_items WHERE id=$1')) return { rows: [existing] };
    if (sql.includes('SELECT DISTINCT m.course_id FROM lessons')) return { rows: [{ course_id: COURSE }] };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  const candidate = await kanjiUpsertCandidate(client, { character: '日', jlpt_level: 'N5',
    mnemonic: 'matahari', compounds: [] }, LESSON, false, true);
  assert.ok(candidate.fields.some(field => field.text === '学校'));
  const empty = () => ({ vocabulary: [], kanji: [], grammar: [] });
  const boundary = { status: 'resolved', boundaryFingerprint: 'test',
    course: { id: COURSE, slug: 'n5' }, lesson: { slug: 'kanji-lesson' },
    target: empty(), previous: empty(), prerequisite: empty(),
    future: { ...empty(), kanji: [
      { key: '学', character: '学', sourceIds: [ID] },
      { key: '校', character: '校', sourceIds: [ID] },
    ] }, integrityIssues: [], auxiliaryPolicy: { terms: [] } };
  const report = validateContentAgainstBoundary({ ...candidate, boundary });
  assert.equal(report.valid, false);
  assert.ok(report.violations.some(item => item.code === 'future_kanji' && item.value === '学'));
  assert.equal(decideBoundaryAction({ mode: 'enforce', operation: 'live_write', report }).canProceed, false);
});
