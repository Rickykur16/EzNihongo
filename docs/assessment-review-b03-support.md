# Bab 3 assessment support revision

Reviewed all 48 source questions (two forms of 24), their four choices and
answer explanations, four reading passages, and eight listening scripts.
The six existing grammar objectives and the 6/10/4/4 category blueprint stay
the same. No core kanji, vocabulary entry, or grammar pattern is added.

## Content corrections

Two vocabulary stems lacked the facts needed to select their keyed answers:

- `b03-a-v04` now states that Deni is a nurse. The keyed answer remains
  `かんごし`; the three other professions contradict the supplied card.
- `b03-b-v04` now states that Mina's nationality is Japanese. The keyed answer
  remains `にほんじん`; nationality is never inferred from a person's name.

The other 46 items have a best answer supported by their wording, passage,
or audio script. Their grammar remains nominal identity, negation, questions,
`の`, `も`, and contextually supported `ね／よ`. The two readings and four
listening focuses per form still cover identity details, relationships,
responses, inference, and speaker intent. This review is of authored text;
it does not validate the rendered audio or establish equivalent difficulty
between forms statistically.

## Final communication activity

The existing `transferTask` now gives concrete directions for a 4–5 sentence
written and spoken introduction, followed by a 4–6 turn roleplay. Two role
cards supply all required information. A five-sentence introduction and a
six-turn model dialogue show the expected scale. Students then repeat with
different information from the existing vocabulary.

The four review criteria are information, grammar, relevant responses, and
intelligibility. The 0/1/2 scale supports self review or teacher feedback.
Equivalent polite negative forms and natural omission of an already clear
topic are accepted. `ね／よ` are used only where the situation warrants them;
they are not forced into every introduction. The activity is not automatically
scored and does not change the multiple-choice result.

## Source and history

Migration 166 remains immutable. The source generator checks that the 46
untouched questions, all choice text, answer keys, stable question/option IDs,
and the historical blueprint still match it. It separately generates and
checks additive migration 181 from the revised source.

Migration 181 resolves only course `n5`, module `n5-b3`, and quiz
`assignment-bab-3-perkenalan`. It snapshots the complete lesson row and the
two affected question rows with their choices before updating the two stems
and `assessment_policy.transferTask`. It does not write to attempt, result,
progress, or answer tables. A repeated execution preserves the first backup
and any later admin edits. Existing attempts retain their original snapshots;
new attempts receive the revised stems and communication activity.

## Verification

- Source/build consistency checks cover both historical migration 166 and
  additive migration 181.
- Unit checks confirm the repaired stems contain the missing evidence while
  IDs, options, answer keys, and the remaining 46 questions stay identical.
- A disposable PostgreSQL/PGlite fixture executes migration 181 and checks its
  backup, scope, unchanged pending/completed attempts, idempotence, and full
  rollback if a targeted question is missing or has unexpected metadata.

## Conversation finalization after migration 180

`scripts/finalize-bab3-support.mjs --apply` runs after SQL migrations and before
restart. Migration 182 provides its one-time ledger. The finalizer checks the
six migrated teaching rows, examples, drills, task instructions and companion
questions against the reviewed JSON. It computes real source fingerprints
using the same loaders as the student session API, then uses the normal
dialogue-question writer to create 12 current, validated questions. The six
replaced sets retain their archived rows and existing student attempts.

The entire finalization transaction commits only when the normal
`learningFlowReadiness` check reports both lessons ready. A validation failure
aborts deployment and rolls back companion/question writes. It never changes
rollout flags or course modes. Once its ledger exists, reruns leave subsequent
admin edits alone. It is inert on installations where migration 180 has not
been applied to N5 Bab 3.

The PostgreSQL integration fixture runs schema setup, migrations 180/182,
the real finalizer, the actual curriculum resolver/validator, and readiness.
It verifies ready conversations, unchanged attempts and settings, preservation
of later edits, and rollback when curriculum scope is invalid.
