'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { publicUser } = require('../../src/controllers/ride.controller');

const person = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Asha Nair',
  email: 'asha@example.com',
  phone: '9876543210',
};

test('a member sees a co-rider\'s contact details', () => {
  assert.deepEqual(publicUser(person, true), {
    _id: person._id,
    name: 'Asha Nair',
    email: 'asha@example.com',
    phone: '9876543210',
  });
});

test('a non-member sees the name only', () => {
  // Without this, any account could page through discovery and harvest the
  // email and phone number of every user on the platform.
  const shown = publicUser(person, false);
  assert.deepEqual(shown, { _id: person._id, name: 'Asha Nair' });
  assert.equal('email' in shown, false);
  assert.equal('phone' in shown, false);
});

test('an unpopulated reference is passed through untouched', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.equal(publicUser(id, false), id);
  assert.equal(publicUser(null, true), null);
  assert.equal(publicUser(undefined, false), undefined);
});
