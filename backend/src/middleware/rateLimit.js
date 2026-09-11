'use strict';

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later' } },
});

// Tighter budget on the endpoints worth brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication attempts, please try again later' } },
});

/**
 * Map lookups proxy a free public service that asks for at most one request a
 * second, so each account gets a modest budget of its own. Typing in the place
 * search is debounced client-side, which keeps normal use well inside this.
 */
const placesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many map lookups, please slow down' } },
});

module.exports = { apiLimiter, authLimiter, placesLimiter };
