# Paket 4: Dialogue Scenes

## Scope

Opt-in scenes inside the existing Bunpou dialogue player, using six permanent
characters and four preset backgrounds (or no background). No changes to XP,
completion, enrollment, mastery, or the Bunpou pilot gates. This branch includes
the lesson-picker fix from PR #328 as its base; it does not activate the pilot.

## Deployment

1. Run the normal migration pipeline, including `153_dialogue_scenes.sql` and
   `154_dialogue_furigana.sql`, before
   serving the new API and frontend. Migration 148 must already be applied.
2. Deploy backend and static assets from the same release. There are no additional
   runtime dependencies or provider credentials in frontend code.
3. In Admin, open an existing grammar row's Dialog editor. Open a character's
   profile, choose its display name and a real ElevenLabs voice, and save it.
   Profiles with no voice remain valid drafts. Generation is blocked until the
   selected voices are available in the provider account.
4. Enable the scene, choose the left/right cast and background, and map existing
   script speakers to the cast. Review names mentioned inside the actual script:
   selecting a character does not rewrite sentences or narrator introductions.
5. Save the dialog into the row, then save the grammar row, following the existing
   editor workflow. Confirm persistence after reloading and test a real audio turn.

Choosing a character copies its profile name/voice/version into the dialogue.
Custom overrides affect only that dialogue. Saving a global profile affects future
selections; `Gunakan profil terbaru` explicitly refreshes an existing snapshot.
Speaker prefixes remain stable keys. Display names are not used to route audio.

Changing a voice changes the existing TTS cache key; old audio is not served under
the new voice. Audio is generated lazily on play, with provider availability checked
before generation. Students receive visual metadata without provider voice IDs.
Missing images hide the visual stage without removing transcript/audio controls.

## Assets And Motion

Optimized WebP sources preserve the approved character artwork. Precomputed CSS
silhouette masks remove only the exterior white backdrop, retaining solid clothes
and skin. No runtime canvas, base64 source bundle, multiply blending, or reduced
character opacity is shipped. Both actors face the center; the right image is
mirrored. Speaking uses a subtle breathing motion, not lip synchronization or new
facial poses. Paused audio freezes motion; waiting/stalled/error/ended stop it.
Reduced-motion preference disables the animation while retaining speaker emphasis.

The source manifest is `backend/src/dialogue-catalog.json`; the checked-in browser
catalog at `assets/dialogue/catalog.js` must match it. Backgrounds are 77-168 KB at
desktop width and 28-56 KB at mobile width. Characters are 23-30 KB plus 14-17 KB
per silhouette mask. Only the opened student dialogue loads scene images.

## Furigana

The student toolbar has an independent Furigana toggle, on by default, persisted
in localStorage. It affects both the stage caption and the full transcript,
including narrator lines. It does not change translation mode or audio playback.

The existing per-turn editor has a reading input for each contiguous kanji group,
with a live ruby preview. Admin enters or corrects the kana reading directly;
there is no automatic reading guess or provider call. Empty readings are allowed
and leave those kanji unannotated. Save into the row, then save the grammar row.
This also works for legacy dialogues without a visual character scene.

Annotations are stored separately in `module_grammar.dialog_furigana`, using
speaker/text snapshots and exact UTF-16 character ranges. Reordering editor rows
moves their annotations with them. Editing Japanese text clears its old readings;
stale snapshots from other content edits render as plain text. Readings and source
text are escaped, never accepted as HTML. Japanese TTS input and cache keys remain
unchanged. Both browser and server use `src/dialogue-furigana.js` for validation.

Run `node --test src/dialogue-furigana.test.js src/dialogue-scene-api.test.js`
from backend for annotation validation, stale text, editor persistence and TTS
separation. Browser QA additionally checks toggle/reload, corrections, per-turn
audio captions and mobile layout with real ruby markup.

## Verification

- `node --test src/dialogue-scene.test.js src/dialogue-scene-api.test.js` from backend:
  normalization, voice availability, snapshot stability, default autofill, overrides,
  independent slots, authentication, grammar persistence, stale text, and cache keys.
- `node --test src/dialogue-scene-migration.test.js` with a local disposable
  `TEST_DATABASE_URL` containing `test` in its database name: repeat migration,
  uniqueness, unchanged legacy text, and preservation of existing voices. CI supplies it.
- `node backend/scripts/dialogue-scene-browser-qa.mjs` from repository root, with
  Playwright and pngjs installed in the QA toolchain. `EZ_QA_NODE_PACKAGE` can point
  to that toolchain's package.json, `EZ_QA_BROWSER` to a Chromium/Edge executable,
  and `EZ_QA_OUTPUT` to a screenshot directory. The test uses actual source slices
  and mocked provider/audio events; it does not spend ElevenLabs credits.
- Set `EZ_QA_SERVE` to an unused port to keep the same integration fixture open
  for manual review. It is explicitly test data, not a production lesson.

Browser coverage: save/reopen, profile refresh, 360/390/768/1280px, play/pause,
waiting, per-line replay, ended, audio failure, late audio response after lesson
switch, reduced motion, opaque clothing under different backdrops, and asset failure.

## Disable Or Roll Back

Uncheck `Tampilkan panggung dialog` to hide the stage while retaining snapshot names,
voices, audio, and transcript. Legacy dialogues with no scene keep their existing
player and voice resolution. Keep the additive columns during an application rollback;
do not drop profiles, dialogue content, or student history.

Live ElevenLabs generation and production save/reload need an authorized admin account
after deployment. Automated tests mock that external provider; they are not evidence
of a live production audio check. Background uploads, lip-sync, and separate illustrated
speaking/listening poses are outside this first release.
