import rateLimit from 'express-rate-limit';

// Separate counters: opening pages/refreshing a session must not consume the
// Google sign-in budget. Each auth realm gets its own limiter instances.
export function createAuthLimiters() {
  const make = (limit, message) => rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });
  return {
    google: make(10, 'Too many login attempts, slow down'),
    refresh: make(60, 'Too many refresh requests, slow down'),
    logout: make(30, 'Too many logout requests, slow down'),
  };
}
