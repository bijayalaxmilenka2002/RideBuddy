'use strict';

require('dotenv').config();

/**
 * Central place for every environment variable the app reads.
 * Nothing else in the codebase should touch process.env directly.
 */
const missing = [];

/** Records a missing variable instead of throwing, so all are reported at once. */
const required = (name) => {
  const value = process.env[name];
  if (!value) {
    missing.push(name);
    return undefined;
  }
  return value;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Optional, attribution only - RideBuddy does not call the Uber API.
  uberClientId: process.env.UBER_CLIENT_ID || null,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

if (missing.length > 0) {
  // Tagged so server.js can print setup help rather than a stack trace.
  const error = new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  error.code = 'ENV_MISSING';
  error.missing = missing;
  throw error;
}

module.exports = env;
