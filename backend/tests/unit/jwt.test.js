'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../../src/utils/jwt');

test('a signed token round trips to the user id', () => {
  const payload = verifyToken(signToken('507f1f77bcf86cd799439011'));
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
});

test('a token signed with another secret is rejected', () => {
  const forged = jwt.sign({ sub: 'attacker' }, 'some-other-secret');
  assert.throws(() => verifyToken(forged), /invalid signature/);
});

test('an expired token is rejected', () => {
  const expired = jwt.sign({ sub: 'x' }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.throws(() => verifyToken(expired), /jwt expired/);
});

test('a tampered payload is rejected', () => {
  const token = signToken('507f1f77bcf86cd799439011');
  const [header, , signature] = token.split('.');
  const swapped = Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url');
  assert.throws(() => verifyToken(`${header}.${swapped}.${signature}`));
});

test('the token carries no password or personal data', () => {
  const payload = verifyToken(signToken('507f1f77bcf86cd799439011'));
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'sub']);
});
