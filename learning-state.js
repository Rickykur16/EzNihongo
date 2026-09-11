(function initLearningState(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EzLearningState = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createLearningState() {
  'use strict';

  const definitions = Object.freeze({
    new: Object.freeze({ label: 'Baru', tone: 'neutral' }),
    learning: Object.freeze({ label: 'Sedang dipelajari', tone: 'learning' }),
    review_due: Object.freeze({ label: 'Perlu direview', tone: 'warning' }),
    weak: Object.freeze({ label: 'Perlu diperkuat', tone: 'warning' }),
    mastered: Object.freeze({ label: 'Dikuasai', tone: 'success' }),
    locked: Object.freeze({ label: 'Terkunci', tone: 'locked' })
  });
  const stateNames = Object.freeze(Object.keys(definitions));

  // Only accept a presentation state supplied explicitly by its owning domain.
  // Percentages, labels, CSS classes, and missing evidence are deliberately not
  // converted into learning states here.
  function normalize(value) {
    const candidate = typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? value.learningState
        : null;
    return typeof candidate === 'string' && definitions[candidate] ? candidate : null;
  }

  function describe(value, options = {}) {
    const state = normalize(value);
    const fallbackLabel = typeof options.fallbackLabel === 'string' && options.fallbackLabel.trim()
      ? options.fallbackLabel.trim()
      : 'Belum cukup data';

    if (!state) {
      return Object.freeze({
        state: null,
        label: fallbackLabel,
        tone: 'neutral',
        evidence: 'insufficient'
      });
    }

    const suppliedLabel = typeof options.label === 'string' && options.label.trim()
      ? options.label.trim()
      : null;
    return Object.freeze({
      state,
      label: suppliedLabel || definitions[state].label,
      tone: definitions[state].tone,
      evidence: 'authoritative'
    });
  }

  function apply(element, value, options = {}) {
    if (!element || !element.classList || !element.dataset) return describe(value, options);

    const presentation = describe(value, options);
    element.classList.add('ez-learning-state');
    delete element.dataset.learningState;
    element.dataset.learningEvidence = presentation.evidence;

    if (presentation.state) element.dataset.learningState = presentation.state;
    if (options.setText !== false) element.textContent = presentation.label;
    return presentation;
  }

  return Object.freeze({
    states: stateNames,
    normalize,
    describe,
    apply
  });
}));
