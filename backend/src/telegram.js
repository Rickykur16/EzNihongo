// Admin notification pipe — used wherever admin needs to know something
// happened without checking a panel manually (new payment proof, new student
// profile). Telegram over email/WA Business API: free, no dependency in
// package.json to add (fetch is built into Node), and admin owns the bot
// token instead of handing credentials to a third party — see the "Deteksi
// mutasi bank otomatis" rejection in CLAUDE.md for why that distinction
// mattered to the decision.
//
// Same optional-env-var shape as ELEVENLABS_API_KEY in tts.js: unset means
// the feature no-ops, not that anything errors.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

// Best-effort: a Telegram outage or missing config must never fail the
// caller's own request, so every failure is swallowed here, not thrown.
export async function notifyAdmin(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text }),
    });
  } catch { /* best-effort — see comment above */ }
}
