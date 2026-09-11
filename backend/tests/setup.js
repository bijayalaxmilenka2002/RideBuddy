'use strict';

// Tests must never read a developer's real .env, and env.js refuses to load
// without these, so they are set before anything requires it.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-anywhere-real';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ridebuddy_test';
process.env.CORS_ORIGINS = 'http://localhost:5173,https://example.com';

module.exports = {};
