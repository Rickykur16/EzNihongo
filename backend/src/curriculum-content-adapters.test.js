import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundaryContextError } from './curriculum-boundary.js';
import { assertQuizGrammarReachable, dialogueVisibleFields } from './routes/admin.js';

test('dialogue adapter compares learner-visible text, not stage position or voice', () => {
  const scene = { participants: [
    { speaker: 'A', displayName: '先生', position: 'left', voiceId: 'old' },
    { speaker: 'B', displayName: '生徒', position: 'right', voiceId: 'old2' },
  ] };
  const furigana = { lines: [{ speaker: 'A', text: '学校', readings: [{ reading: 'がっこう', start: 0, end: 2 }] }] };
  const before = dialogueVisibleFields(scene, furigana);
  assert.deepEqual(dialogueVisibleFields({ participants: scene.participants.map(person => ({
    ...person, position: person.position === 'left' ? 'right' : 'left', voiceId: 'new', voiceName: 'voice',
  })) }, furigana), before);
  assert.notDeepEqual(dialogueVisibleFields({ participants: [{ ...scene.participants[0], displayName: '教師' },
    scene.participants[1]] }, furigana), before);
  assert.notDeepEqual(dialogueVisibleFields(scene, { lines: [{ ...furigana.lines[0],
    readings: [{ reading: 'がくこう', start: 0, end: 2 }] }] }), before);
});

test('quiz grammar link accepts transitive prerequisites and rejects unrelated IDs', async () => {
  const observed = [];
  const accepted = { query: async (sql, params) => {
    observed.push({ sql, params }); return { rows: [{ id: params[0] }] };
  } };
  await assertQuizGrammarReachable(accepted, 'grammar-id', 'lesson-id');
  assert.match(observed[0].sql, /WITH RECURSIVE reachable/);
  assert.match(observed[0].sql, /prerequisite_course_id/);
  assert.deepEqual(observed[0].params, ['grammar-id', 'lesson-id']);
  await assert.rejects(assertQuizGrammarReachable({ query: async () => ({ rows: [] }) },
    'unrelated-grammar', 'lesson-id'), error => error instanceof BoundaryContextError);
});
