# Bunpou pilot: activation and session integrity

This document's selector and checkbox describe the original **v1 pilot**.
For the later v2 communication flow, see
[learning-flow-boundary-rollout.md](learning-flow-boundary-rollout.md).
The two flags are independent. Neither document records production activation.

## V1 pilot activation without IDs

1. Open the AI settings tab in the existing admin workspace.
2. In Bunpou Flow, choose a lesson from the course/bab groups. The selector shows lesson names and readiness, not UUIDs.
3. If the lesson needs review, use Edit Pendamping Bunpou. Inspect the actual dialogue and derived questions, review the objective, directions, hints and explanations, then save/publish explicitly.
4. Refresh the lesson list, select the ready lesson, enable the checkbox, and save.
5. Open the source lesson and its existing Tugas Bunpou as an enrolled test student. Check hint, explanation, two-error reveal, refresh, popup reopening, and production revision.

Shadow comparison has a separate named selector. It remains read-only and does not activate the proposed mastery policy.

## Deployment prerequisites

- Apply additive migration 152 on isolated staging using the existing migration runner before deploying the new server. It adds a request ledger and production-slot snapshots, without rewriting attempts, curriculum, XP, completion, enrollment, or settings.
- Existing publications without the expanded source fingerprint must be reviewed and republished. The admin selector explains this state. No migration fabricates editorial approval or enables the pilot.
- Verify the chosen N5 lesson has linked video, examples, dialogue, and exactly one task mapping. The server checks readiness even if a client bypasses the selector.
- No production deployment, production migration, or flag activation is part of this code change.

## Data and behavior

- Answers, attempt evidence and immutable request responses commit together. A repeated request returns its stored response; changing its item/payload returns a conflict before mutation.
- Hint/reveal exposure is read across saved sessions, including expired ones. Previously disclosed answers cannot become independent by starting a new session.
- Production uses the existing evaluator. A short reservation precedes AI work; finalization records evidence and the slot exactly once. Database transactions are not held during AI calls. Leases allow retries after interruption.
- A completed production slot never reports a different sentence as graded. Requests competing for the same slot wait/retry instead of overwriting newer work.
- Published companion content is checked against the actual task sources, including dialogues, instructions, examples and distractors. Stale content is withheld from new sessions and Smart Review. Existing authorized snapshots remain unchanged.
- Publishing requires the exact draft revision returned by the reviewed save. Replacing a draft during review or publication cannot silently publish another editor's changes.
- Session reads and writes recheck account, enrollment, expiry and course scope after acquiring the user lock. V1 additionally rechecks its live pilot flag; an issued v2 session uses its persisted version and immutable snapshot, so disabling the v2 allowlist does not revoke it. Account erasure takes the same lock; production checks access before reservation and again after evaluation.
- Student UI restores completed/revealed states, wrong counts and production results. Hints and explanations are escaped before display. Revising a sentence preserves the original text in the input; earlier attempts stay in history.
- The shadow policy tracks independent, assisted and limited production separately. Assisted or unknown production cannot satisfy the proposed independent-production requirement. Active mastery remains unchanged.
- Account erasure deletes request records and sessions; session deletion cascades to production snapshots and item state.

## Verification commands

Run the existing backend test command: `npm --prefix backend test`.

The new session API and safety regression suites run on the same local `TEST_DATABASE_URL` used by CI, inside unique disposable schemas. They never read `DATABASE_URL`. For local environments without a PostgreSQL server, an explicitly supplied `PGLITE_TEST_MODULE` file URL can run them against in-memory PostgreSQL/WASM. If neither is available, those integration suites report a skip rather than a pass. PGlite verifies sequential SQL scenarios, not native PostgreSQL multi-connection concurrency.

Focused tests cover source invalidation, public/private state, request replays and conflicts, rollback on storage failure, exposure across sessions, production reservations, revoked access, named selectors, editor fingerprints, IME composition, feedback and resume.

## Rollback

For a **v1 pilot** issue, turn off the Bunpou Flow checkbox and save. Disabling remains possible even when the old selected lesson has been removed or is no longer ready. V1 sessions continue to observe that flag and may no longer resume.

For a **v2 communication-flow** issue, the owner disables new v2 creation through `PUT /api/admin/settings/learning-flow-communication`, using the latest `expectedConfigRevision` and preserving the explicit ID lists. Already-active v2 sessions still resume and use their frozen internal step 5; account, enrollment, scope and expiry checks remain. Do not turn off the v1 pilot flag expecting it to stop or rewrite v2 sessions. Keep migrations and accumulated records; do not delete attempts, sessions or reverse additive schema merely to disable a flow.
