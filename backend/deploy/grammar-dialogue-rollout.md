# Reviewed grammar dialogue rollout

This is an additive pipeline. Existing quiz/vocabulary TTS is unchanged.
Grammar dialogue transcripts remain available. Saving the first draft opts that
grammar into the reviewed player; other grammar keeps its existing player during
the pilot. An opted-in dialogue serves audio only from a reviewed, published
version, so do not opt in more material than the review team can process.

## Deployment

Deploy the backend, shared src/grammar-dialogue-core.mjs, both frontend scripts,
the stylesheet, admin.html and welcome.html together. Run npm run migrate from
backend before restarting eznihongo-api. Migration 142 creates draft, version,
publication and report tables; it does not rewrite curriculum or old TTS caches.

Keep the existing ELEVENLABS_API_KEY and three role voice IDs. No global voice
change is required. New dialogue generation selects eleven_v3 explicitly;
the optional per-utterance comparison uses eleven_multilingual_v2 explicitly.
Both use reviewed kana, including whole-word readings and okurigana.

## Pilot

1. Choose 10-20 short grammar dialogues containing names, ambiguous readings,
   dates/counters, verb endings, questions, and answers.
2. In the grammar manager choose "Bacaan & audio". Fill speaker names and kana.
3. Use vocabulary suggestions, then correct unresolved or context-dependent
   readings. A dictionary entry can include the complete inflected word.
4. Check the exact TTS input and approve each utterance's reading/translation.
5. Save the draft. Generate a v3 preview; if needed generate the v2 comparison.
   Each preview consumes ElevenLabs credits; failed requests are not auto-retried.
6. Listen to the complete preview, check the audio review box, and publish.
   Confirm pronunciation, speaker continuity, turn replay, and mobile layout.
7. Expand only after every target reading in the pilot is correct.

The active manifest is never cached. Reviewed audio has version-specific immutable
URLs, including per-turn URLs for the v2 comparison. Editing a draft does not
alter the active text/audio pair. "Aktifkan kembali" restores only a previously
reviewed version. Old reviewed assets remain available for cache consistency.

Draft saves use optimistic revision checks. Generation reserves a unique take
before contacting ElevenLabs. A repeated take ID returns the same reservation.
If a connection is interrupted, inspect the version list/provider history before
creating another paid take. Permissions errors never include the API key.

## Checks

Run node --test src/grammar-dialogue.test.js src/grammar-dialogue-http.test.js
from backend. HTTP/transaction checks require TEST_DATABASE_URL pointing to a
disposable local PostgreSQL database; they create and remove an isolated schema.
They never use production DATABASE_URL as a fallback and mock paid generation.

Actual Japanese pronunciation and expression still require human listening.
Automatic tests cannot certify acoustic quality. Word-by-word karaoke timing,
automatic AI reading suggestions, role-play and additional speakers are not
included. The player intentionally highlights full utterances; token readings
are used for furigana and grammar emphasis, not guessed character timing.
