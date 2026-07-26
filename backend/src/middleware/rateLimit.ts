import rateLimit from "express-rate-limit";

// Polling endpoints a client hits on a timer while waiting for background work.
// These must be exempt from generalLimiter: a single multi-minute analysis would
// otherwise consume the entire 100-request budget and lock the user out of the
// whole API. They get their own, much larger budget below.
const POLLING_PATHS = /\/analysis-status$/;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: req => POLLING_PATHS.test(req.path),
});

// Sized for polling: a long analysis polls on a 3-10s backoff, so a user running
// several reviews in a window can legitimately make a few hundred cheap reads.
export const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many status checks, please try again later." },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached. Maximum 20 uploads per hour." },
});

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis limit reached. Maximum 30 analyses per hour." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again later or email us directly." },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Chat limit reached. Please wait a moment before sending another message." },
});
