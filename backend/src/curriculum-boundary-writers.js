// Reviewed write-path inventory. Keep this explicit when adding routes: a
// missing path must not be described as covered by curriculum enforcement.
export const VALIDATED_WRITERS = [
  ['POST', '/module-vocabulary'], ['PUT', '/module-vocabulary/:id'],
  ['POST', '/module-vocabulary/bulk'],
  ['POST', '/vocabulary-examples'], ['PUT', '/vocabulary-examples/:id'],
  ['POST', '/module-grammar'], ['PUT', '/module-grammar/:id'],
  ['POST', '/module-grammar/bulk'],
  ['POST', '/grammar-examples'], ['PUT', '/grammar-examples/:id'],
  ['POST', '/lessons'], ['PUT', '/lessons/:id'],
  ['POST', '/quiz-questions'], ['PUT', '/quiz-questions/:id'],
  ['PUT', '/lessons/:lessonId/quiz/sections/:category/:number'],
  ['POST', '/lessons/:lessonId/bunpou-flow/publish'],
  ['POST', '/module-grammar/generate-distractors-bulk'],
  ['POST', '/lessons/:lessonId/generate-deck-readings'],
  ['POST', '/lessons/:lessonId/import-notion-deck'],
  ['POST', '/modules/:moduleId/import-notion-pelajaran'],
  ['POST', '/lessons/:lessonId/import-notion-kanji-bab'],
];

export const LOCKED_TOPOLOGY_WRITERS = [
  ['POST', '/courses'], ['PUT', '/courses/:id'], ['DELETE', '/courses/:id'],
  ['POST', '/modules'], ['PUT', '/modules/:id'], ['DELETE', '/modules/:id'],
];

export const OFF_ONLY_CLI_IMPORTERS = [
  'scripts/import-content.mjs', 'scripts/import-curriculum.mjs',
];

// These existing writes still need service adapters or explicit enforce-mode
// gates. Until then, no deployment should enable enforce for affected courses.
export const PENDING_BOUNDARY_WRITERS = [
  ['DELETE', '/module-vocabulary/:id'], ['DELETE', '/vocabulary-examples/:id'],
  ['DELETE', '/module-grammar/:id'], ['DELETE', '/grammar-examples/:id'],
  ['DELETE', '/lessons/:id'], ['DELETE', '/quiz-questions/:id'],
  ['DELETE', '/lessons/:lessonId/quiz/sections/:category/:number'],
  ['POST', '/lessons/:lessonId/deck-items'], ['PUT', '/lessons/:lessonId/deck-items'],
  ['DELETE', '/lessons/:lessonId/deck-items/:vocabularyId'],
  ['PUT', '/lessons/:lessonId/grammar-task-items'],
  ['DELETE', '/lessons/:lessonId/grammar-task-items/:grammarId'],
  ['PUT', '/lessons/:lessonId/bunpou-flow/draft'],
  ['PUT', '/module-grammar/:id/distractors'],
  ['POST', '/kanji'], ['PUT', '/kanji/:id'], ['DELETE', '/kanji/:id'],
  ['POST', '/kanji/:id/move'],
  ['POST', '/dialogue-speakers'], ['PUT', '/dialogue-speakers/:id'],
  ['DELETE', '/dialogue-speakers/:id'],
  ['POST', '/kana'], ['PUT', '/kana/:id'], ['DELETE', '/kana/:id'],
  ['POST', '/kana-examples'], ['PUT', '/kana-examples/:id'], ['DELETE', '/kana-examples/:id'],
  ['POST', '/lessons/:lessonId/kana-items'], ['PUT', '/lessons/:lessonId/kana-items'],
  ['DELETE', '/lessons/:lessonId/kana-items/:kanaId'],
];
