import { createHash } from 'node:crypto';

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// Hash exactly the persisted inputs used by the generation prompts. A result
// generated outside the transaction may only be saved while those inputs still
// match the snapshot sent to the model.
export function deckReadingSourceFingerprint(row) {
  return fingerprint({ id: row.id, vocabularyId: row.vocabulary_id,
    japanese: row.japanese, reading: row.reading });
}

export function distractorSourceFingerprint(item, siblings) {
  return fingerprint({ grammar: {
    id: item.id, moduleId: item.module_id, pattern: item.pattern, meaning: item.meaning,
    recognitionDistractors: item.recognition_distractors,
    controlledDistractors: item.controlled_distractors,
  }, examples: item.examples.map(example => ({ japanese: example.japanese,
    highlight: example.highlight, indonesian: example.indonesian })),
  siblings: siblings.map(sibling => ({ id: sibling.id, pattern: sibling.pattern,
    meaning: sibling.meaning })) });
}

export function assertGenerationSourceUnchanged(expected, current) {
  if (expected === current) return;
  const error = new Error('source_changed_since_generation');
  error.status = 409;
  throw error;
}
