// Tiny DB-touching counterpart to bunpou-flow-service.js (kept separate so
// that file can stay pure/unit-testable without Postgres). Shared by the
// session API, the admin companion editor, and the public content
// serializer so all three read the exact same two settings the exact same
// way — this repo has been bitten before by a setting's meaning drifting
// out of sync between call sites (see privacy.html section-numbering
// incident in CLAUDE.md).
import { query } from './db.js';

// Both keys use the existing app_settings key/value table (same mechanism
// as grammar_eval_prompt etc.) — no new settings table. Absent = disabled,
// matching every other optional app_settings row in this codebase.
export async function loadPilotConfig() {
  const r = await query(
    `SELECT key, value FROM app_settings
      WHERE key IN ('bunpou_flow_pilot_enabled', 'bunpou_flow_pilot_lesson_id')`
  );
  const byKey = Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
  return {
    enabled: byKey.bunpou_flow_pilot_enabled === 'true',
    lessonId: byKey.bunpou_flow_pilot_lesson_id || null,
  };
}
