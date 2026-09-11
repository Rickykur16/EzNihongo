'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LearningState = require('./learning-state.js');

test('accepts only explicit canonical learning states', () => {
  assert.equal(LearningState.normalize('learning'), 'learning');
  assert.equal(LearningState.normalize({ learningState: 'mastered' }), 'mastered');
  assert.equal(LearningState.normalize({ state: 'mastered' }), null);
  assert.equal(LearningState.normalize('complete'), null);
  assert.equal(LearningState.normalize(null), null);
});

test('keeps missing evidence explicit instead of inventing a state or zero', () => {
  assert.deepEqual(LearningState.describe({ percentage: 0 }), {
    state: null,
    label: 'Belum cukup data',
    tone: 'neutral',
    evidence: 'insufficient'
  });
});

test('uses semantic roles and preserves an authoritative custom label', () => {
  assert.deepEqual(LearningState.describe('review_due', { label: '12 perlu direview' }), {
    state: 'review_due',
    label: '12 perlu direview',
    tone: 'warning',
    evidence: 'authoritative'
  });
  assert.equal(LearningState.describe('mastered').tone, 'success');
  assert.equal(LearningState.describe('locked').tone, 'locked');
});
