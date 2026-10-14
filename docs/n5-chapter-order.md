# N5 chapter order after migration 213

The owner requested that complete chapters 13 and 14 exchange places on
14 October 2026. All content stays attached to its original module and lesson
UUIDs. Slugs remain stable so bookmarked lesson URLs and browser/account
progress continue to identify the same material.

| Displayed chapter | Stable module slug | Material |
|---|---|---|
| 12 | `n5-b12` | Te conjugation and action sequences |
| 13 | `n5-b14` | Dictionary, nai, ta, nakatta; negative requests and obligations |
| 14 | `n5-b13` | Te requests, ongoing states, permission and prohibition |

Migration 213 changes module ordering/numbered titles, numbered lesson titles,
the two chapters' section slots, and existing canonical kanji chapter labels.
Section 6 is renamed **Bentuk Kata Kerja** for chapters 12 and 13; the new
chapter 14 joins the existing permission/prohibition/service section. Custom
section names outside the standard Section 6 label are retained.

Descriptions, scenarios, can-dos, video references, all vocabulary/grammar and
deck memberships, question banks, assessment versions, attempts, frozen drafts,
grammar sessions and user progress are not rewritten. Historical content
manifests and their hashes retain their source chapter numbers. In particular,
`EzN5Copy` must continue selecting authored summaries by stable source slug,
not by the current displayed chapter number.

The Notion vocabulary reference is projected against the loaded CMS order:
its original B13/B14 nodes exchange slots and get current titles/section labels.
The cached source payload and vocabulary/Notion IDs remain untouched, including
after an ordinary source refresh. Curated kanji support uses the new positions;
the former chapter 14 kanji set now belongs to displayed chapter 13.

The migration archives complete before/after rows in
`n5_chapter_swap_backup_213`. It verifies both original chapter identities before
writing, handles immediate unique order constraints, runs in the migration
runner's transaction, and records a completion marker. A second execution
preserves later editor changes rather than swapping the chapters back.

This is an ordering change. The introductory prerequisite gap before chapter
12 and future references within the moved chapter are not rewritten. Existing
recordings, external Canva slides and historical source URLs retain their
original contents. Curriculum boundary fingerprints will correctly reflect the
new order; previous readiness attestations must be evaluated against the new
curriculum before a later flow rollout. Do not relabel old validation reports
as if they had reviewed this order.

Validation covers rollback on an unexpected source, actual PostgreSQL ordering,
N4/neighbor isolation, preservation of progress/current assessment drafts and
grammar sessions, idempotent replay, authored summaries/task source links,
grouped/flat reference projections, and the kanji support set.
