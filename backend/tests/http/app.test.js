'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../src/app');

// These exercise the real Express stack (helmet, CORS, body parsing, the
// validators and the central error handler). They deliberately touch no route
// that reads the database, so they run anywhere.
let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server?.close());

const call = async (path, options = {}) => {
  const response = await fetch(base + path, options);
  const body = await response.json().catch(() => null);
  return { status: response.status, body, headers: response.headers };
};

const json = (payload) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

test('health reports degraded while the database is not connected', async () => {
  const { status, body } = await call('/api/health');
  // No Mongo in this suite, so the probe must fail rather than claim health -
  // a platform that saw 200 here would route traffic to a broken instance.
  assert.equal(status, 503);
  assert.equal(body.status, 'degraded');
  assert.equal(body.database, 'disconnected');
});

test('an unknown route returns the standard error shape', async () => {
  const { status, body } = await call('/api/does-not-exist');
  assert.equal(status, 404);
  assert.match(body.error.message, /Route not found/);
});

test('ride routes reject a request with no token', async () => {
  for (const path of ['/api/rides', '/api/rides/mine', '/api/rides/507f1f77bcf86cd799439011']) {
    const { status, body } = await call(path);
    assert.equal(status, 401, `${path} should be 401`);
    assert.equal(body.error.message, 'Authentication required');
  }
});

test('a malformed bearer token is rejected before any database work', async () => {
  const { status, body } = await call('/api/rides', {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  assert.equal(status, 401);
  assert.equal(body.error.message, 'Invalid or expired token');
});

test('signup validation reports every offending field at once', async () => {
  const { status, body } = await call(
    '/api/auth/signup',
    json({ name: 'A', phone: '12', email: 'nope', password: 'short' })
  );
  assert.equal(status, 400);
  assert.equal(body.error.message, 'Validation failed');
  assert.deepEqual(
    body.error.details.map((d) => d.field).sort(),
    ['email', 'name', 'password', 'phone']
  );
});

test('malformed JSON is a 400, not a crash', async () => {
  const { status } = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": ',
  });
  assert.equal(status, 400);
});

test('an oversized body is refused', async () => {
  const { status } = await call('/api/auth/signup', json({ name: 'x'.repeat(200_000) }));
  assert.equal(status, 413);
});

test('an allow-listed origin gets CORS headers and others do not', async () => {
  const allowed = await call('/api/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const denied = await call('/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('helmet security headers are present', async () => {
  const { headers } = await call('/api/health');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(headers.get('x-powered-by'), null);
});

test('rate limit headers are advertised', async () => {
  const { headers } = await call('/api/health');
  assert.ok(headers.get('ratelimit-limit'), 'expected a RateLimit-Limit header');
});

test('every ride route requires authentication, and only the public ones do not', async () => {
  // The whole authorization surface in one place: if a route is added to the
  // ride router without requireAuth, this fails.
  const PROTECTED = [
    ['GET', '/api/auth/me'],
    ['GET', '/api/rides'],
    ['GET', '/api/rides/mine'],
    ['POST', '/api/rides'],
    ['GET', '/api/rides/507f1f77bcf86cd799439011'],
    ['POST', '/api/rides/507f1f77bcf86cd799439011/join'],
    ['POST', '/api/rides/507f1f77bcf86cd799439011/leave'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/cancel'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/complete'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/fare'],
    ['GET', '/api/rides/507f1f77bcf86cd799439011/messages'],
    ['GET', '/api/users/me'],
    ['PATCH', '/api/users/me'],
    ['PATCH', '/api/users/me/password'],
    ['GET', '/api/rides/requests/mine'],
    ['POST', '/api/rides/507f1f77bcf86cd799439011/requests'],
    ['GET', '/api/rides/507f1f77bcf86cd799439011/requests'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/requests/507f1f77bcf86cd799439012/accept'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/requests/507f1f77bcf86cd799439012/reject'],
    ['PATCH', '/api/rides/507f1f77bcf86cd799439011/requests/mine/withdraw'],
  ];

  for (const [method, path] of PROTECTED) {
    const { status } = await call(path, { method });
    assert.equal(status, 401, `${method} ${path} must reject an anonymous caller`);
  }

  // These three must stay reachable without a token, or nobody can sign in.
  const PUBLIC = [
    ['GET', '/api/health', [200, 503]],
    ['POST', '/api/auth/signup', [400]],
    ['POST', '/api/auth/login', [400]],
  ];

  for (const [method, path, allowed] of PUBLIC) {
    const { status } = await call(path, method === 'POST' ? json({}) : {});
    assert.ok(
      allowed.includes(status),
      `${method} ${path} should be public (got ${status}, expected one of ${allowed})`
    );
  }
});

test('an expired token is refused', async () => {
  const jwt = require('jsonwebtoken');
  const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, {
    expiresIn: -60,
  });
  const { status, body } = await call('/api/rides', {
    headers: { Authorization: `Bearer ${expired}` },
  });
  assert.equal(status, 401);
  assert.equal(body.error.message, 'Invalid or expired token');
});

test('a token signed with a different secret is refused', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'attacker-chosen-secret');
  const { status } = await call('/api/rides', { headers: { Authorization: `Bearer ${forged}` } });
  assert.equal(status, 401);
});
