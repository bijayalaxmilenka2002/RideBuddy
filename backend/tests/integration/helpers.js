'use strict';

require('../setup');
const test = require('node:test');
const mongoose = require('mongoose');
const app = require('../../src/app');

const state = { available: false, reason: '', server: null, base: '', dbName: '' };

/**
 * Each test file runs in its own process, so each gets its own throwaway
 * database. That keeps parallel files from deleting each other's fixtures,
 * and - more importantly - means pointing MONGO_URI at a real cluster can
 * never touch the real database: only this scratch one is written and dropped.
 */
const scratchDbName = () => `ridebuddy_test_${process.pid}_${Date.now().toString(36)}`;

/**
 * These tests need a real MongoDB because they exercise geospatial queries,
 * unique indexes and atomic conditional updates - behaviour that only the
 * database itself can provide. When none is reachable they skip loudly rather
 * than fail, so `npm test` stays green on a machine without Mongo.
 */
async function setup() {
  state.dbName = scratchDbName();
  try {
    // dbName overrides whatever database the URI names.
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: state.dbName,
      serverSelectionTimeoutMS: 3000,
    });
    state.available = true;
  } catch (error) {
    state.reason = `no MongoDB at MONGO_URI (${error.message})`;
    return;
  }
  // A 2dsphere index is required for $nearSphere; in production it is built at
  // startup by Mongoose autoIndex.
  await mongoose.model('Ride').createIndexes();
  await mongoose.model('User').createIndexes();

  state.server = app.listen(0);
  await new Promise((resolve) => state.server.once('listening', resolve));
  state.base = `http://127.0.0.1:${state.server.address().port}`;
}

async function teardown() {
  if (state.server) await new Promise((resolve) => state.server.close(resolve));
  if (state.available) {
    // Safe by construction: this is the scratch database created above.
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
}

async function reset() {
  if (!state.available) return;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Registers a test that skips itself when no database is reachable. */
const dbTest = (name, fn) =>
  test(name, async (t) => {
    if (!state.available) return t.skip(state.reason || 'no database');
    await reset();
    return fn(t);
  });

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(state.base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

let seq = 0;
/** Creates a user through the real signup endpoint and returns their token. */
async function makeUser(name = 'Rider') {
  seq += 1;
  const suffix = String(seq).padStart(4, '0');
  const { status, body } = await call('/api/auth/signup', {
    method: 'POST',
    body: {
      name,
      email: `${name.toLowerCase()}${suffix}@example.com`,
      phone: `9${suffix}${String(Date.now()).slice(-5)}`.slice(0, 10),
      password: 'correct-horse-battery',
    },
  });
  if (status !== 201) throw new Error(`signup failed: ${JSON.stringify(body)}`);
  return { token: body.token, user: body.user };
}

const ridePayload = (overrides = {}) => ({
  vehicleType: 'AUTO',
  pickupLocation: { name: 'Koramangala', coordinates: [77.6245, 12.9352] },
  dropLocation: { name: 'Whitefield', coordinates: [77.7499, 12.9698] },
  departureTime: new Date(Date.now() + 3600_000).toISOString(),
  ...overrides,
});

module.exports = { setup, teardown, dbTest, call, makeUser, ridePayload, state };
