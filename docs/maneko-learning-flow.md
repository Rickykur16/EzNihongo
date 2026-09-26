# Maneko learning flow

Maneko is the entry point for Fokus belajar. Its quiet mascot opens one recommendation; `focus.html` contains the full list with separate reinforcement and scheduled-repetition groups. The old inline focus panels and automatic reminder popups are removed. Chat remains available from Maneko on the learning page.

During Smart Review, Maneko is an explicit help disclosure below the question. The learner sees the scoring consequence before requesting a hint. The first hint, further explanation, and answer use server-held lesson/question content, with no AI call or answer key needed in the initial browser payload. The next question advances only when the learner chooses it.

## Independent evidence

- Help is recorded before any help text is returned. A failed storage write returns no help.
- Help and answer submissions share a user-level transaction lock. Ownership, entitlement, completed-lesson access, and session expiry are checked on the server.
- First answers are immutable and retries return the saved result. Help after a wrong answer does not erase the failure.
- Assisted responses stay in the session audit, not the independent FSRS or grammar attempt stream. Assisted lesson drills remain activity but cannot change the independent practice aggregate.
- Related lesson content and all directions of the same item are protected across tabs and sessions. Questions already exposed remain assisted until that session ends, even if the exposure window expires.
- Historical grammar/quiz mastery, recommendation accuracy and dashboard accuracy exclude attempts made within an applicable exposure window, before sampling/aggregation. Activity days still include supported practice.
- Untagged legacy local aggregates are not imported after a user has assistance history. They cannot prove which successes were independent.

## Initial product policy

Question help protects the item and its lesson for **24 hours**. Open-ended tutor chat protects all subsequent evidence for **30 minutes**, because a free-form answer cannot be safely attributed to a single concept. These are conservative configurable product defaults in `maneko-assistance.js`, not a scientific retention estimate. Asking the provider records the exposure even if it subsequently fails, to avoid false independent evidence after a partially delivered answer. These limits are described in the student interface.

The guard tracks help delivered by this application. It cannot detect outside resources. Existing historical mastery is retained; this release does not retroactively infer assistance on old attempts.

## Release and verification

Apply migration `164_maneko_learning_assistance.sql` before restarting the new backend. It adds an exposure log, immutable review-result storage, session assistance timestamps, and serialized timestamp triggers for newly recorded attempts. No backfill changes existing evidence.

Run `node --test src/maneko-assistance.test.js` from `backend` with a disposable local `TEST_DATABASE_URL` (name must contain `test`), or set `PGLITE_TEST_MODULE` to a local PGlite module URL. CI already supplies PostgreSQL. Tests exercise the real route handlers, migration, grading writes, mastery queries, FSRS preservation, expiry, rejected access, retry, rollback and dashboard accuracy.

Run `node backend/scripts/check-maneko-browser.cjs` with Playwright installed, or set `PLAYWRIGHT_MODULE` to its module path. Optional `BROWSER_EXECUTABLE` selects an installed browser and `MANEKO_OUTPUT_DIR` selects the screenshot directory. The browser check uses explicit fixture API responses, actual frontend scripts and 390/1280 px viewports; it covers navigation, help, totals, error recovery, keyboard closing and integration with the existing mascot. It does not call a live tutor provider or modify student data.
