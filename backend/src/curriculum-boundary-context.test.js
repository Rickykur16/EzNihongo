import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroundedContext, GroundedContextError } from './curriculum-boundary-context.js';

const empty = () => ({ vocabulary: [], grammar: [], kanji: [] });
function boundary() {
  return { status: 'resolved', boundaryFingerprint: 'sha256:boundary',
    course: { id: 'n5', slug: 'n5', mode: 'enforce' },
    currentModule: { id: 'm1', title: 'Introduksi' }, lesson: { id: 'l1', slug: 'lesson-1' },
    target: { ...empty(), grammar: [{ key: 'g1', pattern: '〜です', meaning: 'kopula sopan', sourceIds: ['g1'] }],
      vocabulary: [{ key: 'b', japanese: 'せんせい', indonesian: 'guru', sourceIds: ['v2'] },
        { key: 'a', japanese: 'がくせい', sourceIds: ['v1'] }] },
    previous: { ...empty(), vocabulary: [{ key: 'c', japanese: 'こんにちは', sourceIds: ['v3'] }] },
    prerequisite: empty(), allowed: empty(), future: empty(),
    auxiliaryPolicy: { terms: [] } };
}

test('grounded context selects deterministic subsets with provenance and full source dialogue', () => {
  const sourceDialogue = { turns: [{ text: 'こんにちは。' }, { text: 'せんせいです。' }] };
  const first = buildGroundedContext({ boundary: boundary(), sourceDialogue,
    maxTargetVocabulary: 1, maxSupportItems: 0 });
  const shuffled = boundary(); shuffled.target.vocabulary.reverse();
  const second = buildGroundedContext({ boundary: shuffled, sourceDialogue,
    maxTargetVocabulary: 1, maxSupportItems: 0 });
  assert.equal(first.prompt, second.prompt);
  assert.deepEqual(first.context.targetGrammar.map(item => item.key), ['g1']);
  assert.equal(first.context.targetGrammar[0].meaning, 'kopula sopan');
  assert.equal(first.prompt.includes('kopula sopan'), true);
  assert.deepEqual(first.subsetIds.targetVocabulary, ['v1']);
  assert.equal(first.omitted.targetVocabulary, 1);
  assert.deepEqual(first.context.sourceDialogue, sourceDialogue);
  assert.equal(first.prompt.includes('future'), false);
  assert.ok(first.sourceFingerprint?.startsWith('sha256:'));
  const fullTarget = buildGroundedContext({ boundary: boundary(), maxTargetVocabulary: 2 });
  assert.equal(fullTarget.context.subset.targetVocabulary[1].indonesian, 'guru');
});

test('mandatory grammar and dialogue are never silently truncated', () => {
  assert.throws(() => buildGroundedContext({ boundary: boundary(),
    sourceDialogue: { turns: [{ text: 'あ'.repeat(300) }] }, maxPromptChars: 200 }),
  error => error instanceof GroundedContextError && error.code === 'mandatory_grounding_exceeds_budget');
});
