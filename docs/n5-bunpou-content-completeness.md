# N5 Bunpou card completion, 27 September 2026

The production DOM audit covered both teaching sublessons in each chapter 3–20:
36 lessons, 97 teaching cards, 8 cards without examples, 74 without dialogue,
and one existing example without an Indonesian translation. All 97 patterns in
the previously approved Canva alignment were present. The gaps were inside the
cards rather than missing chapters or missing teaching-pattern rows.

## Content changes

- Explain formation, function, contrasts and important exceptions on all 97 cards.
- Supply missing examples and cover omitted variants such as あれ, どの, いつ,
  何枚, いつも and positional words. Keep good existing examples.
- Add original short dialogues with matching Indonesian translations where absent.
  Replace mismatched or premature dialogue in chapters 4, 5, 6, 8 and 9.
- Correct 日本の本 versus 日本語の本, past-tense translations, the bank/house
  mismatch, and the advanced ～てしまいました sentence in chapter 6.
- Correct the erroneous “remove い” rule for ないでください, incomplete counter
  and date explanations, overbroad politeness advice, and treatment of になります
  as a universal polite replacement for です.
- Do not restore だれの〜ですか, change titles, move teaching cards, add later
  grammar topics, or modify assessment banks.

The canonical authored material is `backend/content/bunpou/completeness.mjs`.
Examples and dialogues are original, not copied from JLPT exam material.
Coverage follows `backend/scripts/n5-bunpou-canva-plan.json` and the source links
in `docs/n5-bunpou-canva-alignment.md`. Grammar cross-checks include the
[TUFS explanation of Vないでください](https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/060.html)
and [Japan Foundation guidance on instructions and prohibition](https://www.jpf.go.jp/j/project/japanese/teach/tsushin/grammar/201603.html).

## Rollout and preservation

Migration 176 resolves cards by N5 course + existing teaching lesson slug + exact
pattern. A missing or ambiguous card aborts the transaction. It backs up complete
grammar rows and example rows before editing, appends coverage examples, and
updates only explicitly identified incorrect examples. No student tables are
written. Lesson IDs, titles, order, card IDs, task links, and existing good
examples remain intact.

Existing custom scenes, speaker aliases, and ElevenLabs voice IDs are preserved.
New scenes use Anna/Hadi's already configured profiles when both have voices;
otherwise the existing legacy dialogue audio path remains available. Changed
dialogues clear stale furigana; audio cache keys already include text and voices.
The migration does not generate paid audio in advance or claim that audio was
listened to. New scenes remain editable through the existing admin dialogue editor.

Bab 3 changes only notes, preserving its published learning-flow source fingerprint
and custom Hadi speaker alias. Other changed dialogue sources naturally invalidate
dependent question fingerprints; the migration never invents editorial approval,
republishes companion questions, or changes frozen student answers.

`n5_bunpou_content_backup_176` stores before/after rows and examples for recovery.
A rerun skips already updated cards so later teacher edits are retained. Recovery
must compare live rows with `after_*` before restoring `before_*`; never blindly
restore over newer admin edits.

## Verification

Content checks cover all 97 approved pattern/lesson pairs, dialogue/translation
turn alignment, example highlights and the deliberately omitted Bab 4 pattern.
Transactional SQL tests cover gap filling, custom speaker mapping and voice
preservation, Bab 3 fingerprints, unchanged lesson titles and card IDs, rerun
safety, and rollback on a missing card. The fixture is synthetic, not a production
database dump; the live audit supplies the actual completeness counts above.
