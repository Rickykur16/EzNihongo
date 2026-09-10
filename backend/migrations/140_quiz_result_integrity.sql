-- Persist the authoritative response and submitted choices for safe retries.
-- Historical attempts remain unchanged: their original threshold/choices
-- cannot be reconstructed reliably after edits to the question bank.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS grading_result JSONB,
  ADD COLUMN IF NOT EXISTS submitted_answers JSONB;
