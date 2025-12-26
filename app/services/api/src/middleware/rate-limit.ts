import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public API endpoints
 */
export const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for bot webhook endpoints
 */
export const botWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Higher limit for bot events
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many webhook events, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
