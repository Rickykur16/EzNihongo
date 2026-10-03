# Final exams N5 and N4

Migration 194 adds one final-exam module and one quiz lesson at the end of each existing course. It does not change chapter assignments, grammar memberships, previous question IDs, or attempts. All 170 questions are newly authored for EzNihongo; none of the previously downloaded official PDF/audio content is embedded or republished.

| Level | Vocabulary / kanji | Grammar | Reading | Listening | Total |
|---|---:|---:|---:|---:|---:|
| N5 | 25 | 25 | 6 | 24 | 80 |
| N4 | 27 | 25 | 10 | 28 | 90 |

The bank includes kanji readings, orthography, contextual vocabulary, paraphrases, N4 word usage, grammar selection, five sentence-composition stars per level, connected-text grammar, short and medium readings, information retrieval, listening tasks, key points, situational expressions and quick responses. Curriculum chapter tags are editorial references; they are not database foreign keys or per-concept mastery evidence. Kana is assumed as foundational knowledge rather than given a separate final-exam section.

The 52 original listening scripts use the existing private TTS endpoint. Numbered spoken choices remain in the same order as their audio. Nine original schematic scene SVGs support ten situational questions. TTS is generated on demand using the deployment's existing provider and speaker configuration. Tests exercise the private transport contract without calling the paid provider; human pronunciation and pacing review remains necessary.

## Scoring and delivery

The existing assessment start/draft/resume/submit/review flow serves all 80 or 90 questions. Answer keys, scripts, ordered star solutions and explanations stay in the server-side snapshot until submission. Existing snapshots retain their own keys even if a teacher later edits the bank.

The final module remains below all ordinary sections, including material added later: course delivery and the student course transform both place final modules last while preserving the order of ordinary material. The student UI displays all questions in the selected category together, grouped by item type and shared reading passage. A numbered question map, category completion counts, device-local review flags, server draft status and a pre-submit review screen support long exams. Empty answers prevent submission. Flags do not change grading. Listening keeps one player per item-type section, allows replay, stops other players when a new one starts and waits for the learner to choose the next audio.

Classroom passing criteria are 70% of all items and at least 50% in each of the four categories. Every question has equal raw weight; this is not the official JLPT scaled score or a prediction of passing JLPT. The current implementation is untimed, permits audio replay and keeps the existing 12-hour retake cooldown. It is a final course assessment, not a strict timed JLPT simulator.

Difficulty was authored and reviewed against basic N5 and N4 task demands. Equivalent psychometric difficulty cannot be claimed without pilot results and item analysis. Content may be revised after teacher review or learner trials. Published official item types are the structural reference: https://www.jlpt.jp/e/guideline/testsections.html . Official historical PDFs and audio are not an import dependency.

## Build and inspect

```
node backend/scripts/build-final-exams.mjs
node backend/scripts/build-final-exams.mjs --check
node backend/scripts/export-final-exam-review.mjs <private-output-folder>
node backend/scripts/export-final-exam-student-preview.mjs <private-output-folder>
node --test backend/src/final-exams.test.js
```

Set `TEST_DATABASE_URL` to an isolated local PostgreSQL instance and run `node --test backend/src/final-exams-http.test.js` for migration and authenticated HTTP tests. Each test uses and drops only its own randomly named schema.

The student interaction preview reuses production UI code and public question payloads, with browser-local simulated persistence. It does not contact production or generate official results/audio. The teacher review remains a separate page containing the answer keys.

Source files are `backend/content/final-exams/n5.mjs`, `n4.mjs`, and `index.mjs`. JSON exports and the review HTML contain answer keys; they belong in a private editorial folder and must not be added to public static hosting. The migration is installed through the normal backend migration runner after the accompanying backend code is deployed.

Migration preflights both course slugs, detects conflicting module identities, appends modules after existing order values, and preserves later teacher edits on replay. Missing courses or identity conflicts abort before any exam is written. It is intentionally additive. The final-exam runtime extends the existing versioned assessment dispatcher without altering old chapter blueprints.
