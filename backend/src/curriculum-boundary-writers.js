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
  ['POST', '/lessons/:lessonId/deck-items'], ['PUT', '/lessons/:lessonId/deck-items'],
  ['POST', '/lessons/:lessonId/kana-items'], ['PUT', '/lessons/:lessonId/kana-items'],
  ['PUT', '/lessons/:lessonId/grammar-task-items'],
  ['PUT', '/module-grammar/:id/distractors'],
  ['POST', '/kanji/:id/move'],
];

export const LOCKED_TOPOLOGY_WRITERS = [
  ['POST', '/courses'], ['PUT', '/courses/:id'], ['DELETE', '/courses/:id'],
  ['POST', '/modules'], ['PUT', '/modules/:id'], ['DELETE', '/modules/:id'],
];

export const OFF_ONLY_CLI_IMPORTERS = [
  'scripts/import-content.mjs', 'scripts/import-curriculum.mjs',
  'scripts/cleanup-n5-seed-modules.mjs',
];

// Destructive one-shot fixture, not an operational writer: it truncates a
// disposable database after a test/tmp/local/dev DATABASE_URL guard.
export const TEST_ONLY_DIAGNOSTIC_SCRIPTS = ['scripts/test-grammar-analysis.mjs'];

// Removing material or changing associations needs a stable prerequisite
// closure but has no new text to validate. Drafts are checked at publish.
export const LOCKED_CONTEXT_WRITERS = [
  ['DELETE', '/module-vocabulary/:id'], ['DELETE', '/vocabulary-examples/:id'],
  ['DELETE', '/module-grammar/:id'], ['DELETE', '/grammar-examples/:id'],
  ['DELETE', '/lessons/:id'], ['DELETE', '/quiz-questions/:id'],
  ['DELETE', '/lessons/:lessonId/quiz/sections/:category/:number'],
  ['DELETE', '/lessons/:lessonId/deck-items/:vocabularyId'],
  ['DELETE', '/lessons/:lessonId/grammar-task-items/:grammarId'],
  ['PUT', '/lessons/:lessonId/bunpou-flow/draft'],
  ['DELETE', '/lessons/:lessonId/kana-items/:kanaId'],
];

// Global kana reference rows and their dynamic examples can feed any lesson.
// Until multi-consumer validation exists, exclusive graph lock + all-courses-
// off check prevents edits during audit/warn/enforce.
export const OFF_ONLY_GLOBAL_WRITERS = [
  ['POST', '/kana'], ['PUT', '/kana/:id'], ['DELETE', '/kana/:id'],
  ['POST', '/kana-examples'], ['PUT', '/kana-examples/:id'], ['DELETE', '/kana-examples/:id'],
];

// Scoped kanji text is validated; null/global scope uses the off-only gate.
export const MIXED_SCOPE_KANJI_WRITERS = [
  ['POST', '/kanji'], ['PUT', '/kanji/:id'], ['DELETE', '/kanji/:id'],
];

// Profile registry changes are presentation defaults. Saved dialogue scenes
// freeze speaker/displayName/voice snapshots; profile changes do not rewrite
// scenes or any input used by the curriculum boundary resolver.
export const SNAPSHOT_METADATA_WRITERS = [
  ['POST', '/dialogue-speakers'], ['PUT', '/dialogue-speakers/:id'],
  ['DELETE', '/dialogue-speakers/:id'],
];

export const PENDING_BOUNDARY_WRITERS = [];
