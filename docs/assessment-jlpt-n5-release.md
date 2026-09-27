# Assessment Bab 4–20: JLPT N5 format revision

Migration 172 activates `n5-assessment-v3`: 408 original items, 24 per chapter, 1,598 choices. The composition is 6 vocabulary, 10 grammar, 4 reading and 4 listening. All items appear on each new attempt. Bab 3 is unchanged.

The bank adds 34 sentence-composition ★ questions, grammar in connected text, short/medium reading and information retrieval. There are 68 independent listening stimuli, including 17 original situation illustrations and 34 sets of three spoken choices. Spoken-choice buttons remain in numerical order even though ordinary written options shuffle. The correct ★ order, audio scripts, spoken choice text, explanations and keys remain private until submission.

Questions and options become Japanese throughout from Bab 10. Bab 10–14 offer collapsed Indonesian directions; Bab 15–20 use Japanese directions. Explanations after submission remain Indonesian. Known-kanji checks use the cumulative curriculum; other content uses kana. No `だれの` item is added to Bab 4. Early listening emphasizes information rather than actions before the necessary verbs are introduced.

The existing per-character ElevenLabs editor and private audio endpoint are reused. Migration copies the corresponding previous listening item's `audio_scene`, including owner settings or an intentional null. New IDs retain all previous question rows and attempt snapshots. Lesson IDs, chapter/subchapter titles, media, progress, and navigation behavior are not changed. A migration backup stores old policies; reruns preserve later owner edits.

## Validation

- Authored-bank validation: 24 items and category/objective coverage per chapter; one key, unique options, private/public projection, ★ slot/key consistency, numbered audio/choice alignment, language transition, cumulative kanji, original image generation and checked-in SQL parity.
- PGlite migration integration: real SQL for 171 then 172, all 408 active rows, old questions/options/attempts retained, per-question voice settings retained, Bab 3 untouched, rollback on missing target, idempotent reruns.
- UI unit test: numbered listening choices keep 1–2–3 order and corresponding option IDs; ordinary option shuffle remains enabled.
- PostgreSQL HTTP test added for v3: all 24 questions, no private evidence before submit, draft/resume, owner-scoped cached audio transport, grading three-choice items and delayed image/transcript review. CI runs this alongside the existing v2/Bab 3 tests.
- Local full suite: 422 passed, 25 database-dependent tests skipped, 11 existing deployment shell tests failed because Bash is unavailable on this Windows runtime. Linux/PostgreSQL CI is required before merge.

## Boundaries

This is a chapter assessment using official N5 task formats, not a complete timed JLPT mock or official scaled score. Replay remains available. A classroom passing threshold is not a prediction of JLPT success. Difficulty and discrimination still require real learner results. TTS transport fixtures do not constitute a human pronunciation review of all 68 generated recordings.

See [official references and learning progression](assessment-jlpt-n5-reference.md). Generate the local editorial review with `node backend/scripts/export-jlpt-review.mjs <output.html>`; its answer/transcript disclosures are for reviewers, not the student attempt payload.
