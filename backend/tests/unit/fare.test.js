'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitFare } = require('../../src/utils/fare');

test('splits a fare evenly across passengers', () => {
  assert.equal(splitFare(300, 3), 100);
  assert.equal(splitFare(240, 2), 120);
});

test('rounds to two decimals rather than leaking floating point noise', () => {
  assert.equal(splitFare(100, 3), 33.33);
  assert.equal(splitFare(0.1 + 0.2, 1), 0.3);
});

test('returns null until the admin has entered the real fare', () => {
  assert.equal(splitFare(null, 3), null);
  assert.equal(splitFare(undefined, 3), null);
});

test('never divides by zero passengers', () => {
  assert.equal(splitFare(300, 0), null);
});

test('a free ride splits to zero, not null', () => {
  assert.equal(splitFare(0, 3), 0);
});
