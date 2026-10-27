const rateLimit = require('express-rate-limit');

const limited = (message) => (_req, res) =>
    res.status(429).json({ error: { code: 'rate_limited', message } });

/** Brute-force protection for the login endpoint (counts every attempt per IP). */
const loginLimiter = ({ loginMax, loginWindowMin }) =>
    rateLimit({
        windowMs: loginWindowMin * 60 * 1000,
        limit: loginMax,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: limited('Too many login attempts. Try again later.'),
    });

/** Generous global limiter for the rest of the API. */
const apiLimiter = ({ apiMax }) =>
    rateLimit({
        windowMs: 60 * 1000,
        limit: apiMax,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: limited('Too many requests. Slow down.'),
    });

module.exports = { loginLimiter, apiLimiter };
