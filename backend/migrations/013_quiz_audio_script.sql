-- Listening questions JLPT-style: kebutuhan field terpisah buat
-- conversation script. Sebelumnya dialog disisipin di question field via
-- "\n\n" convention — terlalu rancu sama pertanyaan biasa.
-- audio_script: multi-line dialog (e.g. "A: お国はどちらですか。\nB: ...")
-- yg di-play via TTS. Kosong/NULL untuk non-listening questions.

ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS audio_script TEXT;
