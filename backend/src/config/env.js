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

  /**
   * Free OpenStreetMap services, proxied through this API so the usage policy
   * (identify yourself, at most one request per second, cache results) is
   * honoured in one place. Swap these for a self-hosted instance or another
   * provider without touching any other file.
   */
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org',
  // Nominatim requires a real identifier; add a contact address in production.
  placesUserAgent: process.env.PLACES_USER_AGENT || 'RideBuddy/1.0 (self-hosted)',
  // Bias search results towards one country, e.g. "in" for India. Blank = worldwide.
  placesCountryCodes: process.env.PLACES_COUNTRY_CODES || '',
  // Minimum gap between outbound geocoding calls. The public Nominatim asks
  // for 1/second; drop it to 0 if you self-host one.
  placesMinGapMs: Number(process.env.PLACES_MIN_GAP_MS ?? 1100),
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
