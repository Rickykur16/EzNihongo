import test from 'node:test';
import assert from 'node:assert/strict';
import { bunpouValidationParts, validateBunpouPublish } from './curriculum-bunpou-validation.js';

const empty = () => ({ vocabulary: [], kanji: [], grammar: [] });
const futureWord = { key: 'school', japanese: '学校', reading: 'がっこう', sourceIds: ['v-school'] };
function boundary() {
  return { status: 'resolved', boundaryFingerprint: 'test', course: { id: 'n5', slug: 'n5' },
    lesson: { slug: 'lesson-bab-1' }, target: empty(), previous: empty(), prerequisite: empty(),
    future: { ...empty(), vocabulary: [futureWord] }, integrityIssues: [],
    auxiliaryPolicy: { terms: [{ surface: '学校', courseIds: ['n5'],
      contentTypes: ['dialogue_comprehension'], reason: 'comprehension-only' }] } };
}
const question = prompt => ({ prompt, options: ['はい', 'いいえ', 'まだ'], correctIndex: 0 });

test('Bunpou comprehension and comparison receive distinct content policies', () => {
  const sanitized = { objective: '学校', directions: { g1: '学校' },
    overlays: { g1: { step1: { hint: '学校' } } },
    dialogChecks: { g1: { comprehension: question('学校'), comparison: question('学校') } } };
  const parts = bunpouValidationParts(sanitized);
  assert.deepEqual(parts.map(part => part.contentType), [
    'dialogue_comprehension', 'dialogue_transfer', 'dialogue_comprehension', 'dialogue_transfer',
  ]);
  const report = validateBunpouPublish({ sanitized, boundary: boundary(), operation: 'publish',
    contentIsNewOrChanged: true });
  assert.equal(report.status, 'evaluated');
  assert.ok(report.usage.auxiliary.some(item => item.contentType === 'dialogue_comprehension'));
  assert.ok(report.usage.auxiliary.every(item => item.contentType === 'dialogue_comprehension'));
  assert.ok(report.violations.some(item => item.code === 'future_vocabulary' && item.contentType === 'dialogue_transfer'));
  assert.ok(!report.violations.some(item => item.code === 'future_vocabulary' && item.contentType === 'dialogue_comprehension'));
});

test('Bunpou transfer question schema is validated independently', () => {
  const sanitized = { dialogChecks: { g1: { comprehension: question('はい'),
    comparison: { prompt: '学校', options: ['はい', 'はい', 'まだ'], correctIndex: 0 } } } };
  const report = validateBunpouPublish({ sanitized, boundary: null, operation: 'publish' });
  assert.equal(report.status, 'schema_invalid');
  assert.ok(report.violations.some(item => item.code === 'invalid_question_schema' &&
    item.contentType === 'dialogue_transfer'));
});
