-- Dialog contoh per pola grammar (bunpou). Disimpan as-is dalam format
-- listening dialog "A: ... \n B: ..." supaya bisa di-render pakai listening
-- player + multi-voice TTS yang sama dengan quiz listening.
--
-- Note: text ini di-whitelist di /api/tts (module_grammar.example_dialog)
-- biar bisa di-generate audio-nya tanpa kena 403 anti-abuse.

ALTER TABLE module_grammar
  ADD COLUMN IF NOT EXISTS example_dialog TEXT;
