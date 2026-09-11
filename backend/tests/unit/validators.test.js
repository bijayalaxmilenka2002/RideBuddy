'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRideSchema,
  listRidesQuerySchema,
  fareSchema,
  objectIdSchema,
} = require('../../src/validators/ride.validators');
const { signupSchema, loginSchema } = require('../../src/validators/auth.validators');
const { sendMessageSchema } = require('../../src/validators/message.validators');

const validRide = () => ({
  vehicleType: 'AUTO',
  pickupLocation: { name: 'Koramangala', coordinates: [77.6245, 12.9352] },
  dropLocation: { name: 'Whitefield', coordinates: [77.7499, 12.9698] },
  departureTime: new Date(Date.now() + 3600_000).toISOString(),
});

test('accepts a well formed ride', () => {
  assert.equal(createRideSchema.safeParse(validRide()).success, true);
});

test('strips a client supplied maxCapacity and status', () => {
  const parsed = createRideSchema.parse({ ...validRide(), maxCapacity: 99, status: 'LOCKED' });
  assert.equal('maxCapacity' in parsed, false);
  assert.equal('status' in parsed, false);
});

test('rejects a departure time in the past', () => {
  const past = { ...validRide(), departureTime: new Date(Date.now() - 60_000).toISOString() };
  const result = createRideSchema.safeParse(past);
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /future/);
});

test('rejects an unknown vehicle type', () => {
  assert.equal(createRideSchema.safeParse({ ...validRide(), vehicleType: 'TRUCK' }).success, false);
});

test('rejects out of range coordinates', () => {
  const bad = { ...validRide(), pickupLocation: { name: 'Nowhere', coordinates: [200, 12] } };
  assert.equal(createRideSchema.safeParse(bad).success, false);
});

test('discovery query applies default radius and limit', () => {
  const parsed = listRidesQuerySchema.parse({});
  assert.equal(parsed.radiusKm, 10);
  assert.equal(parsed.limit, 20);
});

test('discovery query coerces numeric strings from the query string', () => {
  const parsed = listRidesQuerySchema.parse({ lng: '77.62', lat: '12.93', limit: '5' });
  assert.equal(parsed.lng, 77.62);
  assert.equal(parsed.lat, 12.93);
  assert.equal(parsed.limit, 5);
});

test('discovery limit is capped so a caller cannot ask for the whole table', () => {
  assert.equal(listRidesQuerySchema.safeParse({ limit: '5000' }).success, false);
});

test('fare must be a non negative number', () => {
  assert.equal(fareSchema.safeParse({ totalFare: 300 }).success, true);
  assert.equal(fareSchema.safeParse({ totalFare: -1 }).success, false);
  assert.equal(fareSchema.safeParse({ totalFare: '300' }).success, false);
});

test('object id must look like a mongo id', () => {
  assert.equal(objectIdSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success, true);
  assert.equal(objectIdSchema.safeParse({ id: 'mine' }).success, false);
  assert.equal(objectIdSchema.safeParse({ id: '../../etc/passwd' }).success, false);
});

test('signup normalises email casing and enforces a 10 digit phone', () => {
  const parsed = signupSchema.parse({
    name: 'Asha',
    phone: '9876543210',
    email: '  Asha@Example.COM ',
    password: 'correct-horse',
  });
  assert.equal(parsed.email, 'asha@example.com');

  assert.equal(
    signupSchema.safeParse({ name: 'Asha', phone: '123', email: 'a@b.co', password: 'correct-horse' })
      .success,
    false
  );
});

test('signup rejects a short password', () => {
  const result = signupSchema.safeParse({
    name: 'Asha',
    phone: '9876543210',
    email: 'a@b.co',
    password: 'short',
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /at least 8/);
});

test('login does not impose the signup password rules', () => {
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success, true);
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
});

test('a chat message cannot be blank or unbounded', () => {
  assert.equal(sendMessageSchema.safeParse({ message: '   ' }).success, false);
  assert.equal(sendMessageSchema.safeParse({ message: 'x'.repeat(1001) }).success, false);
  assert.equal(sendMessageSchema.parse({ message: '  hi  ' }).message, 'hi');
});

/* --- profile and join-request schemas ------------------------------------ */

const { updateProfileSchema, changePasswordSchema } = require('../../src/validators/user.validators');
const { createRequestSchema, requestParamsSchema } = require('../../src/validators/rideRequest.validators');

test('a profile update accepts a name, a phone, or both', () => {
  assert.equal(updateProfileSchema.safeParse({ name: 'Asha N' }).success, true);
  assert.equal(updateProfileSchema.safeParse({ phone: '9876543210' }).success, true);
  assert.equal(updateProfileSchema.safeParse({ name: 'Asha N', phone: '9876543210' }).success, true);
});

test('a profile update must actually change something', () => {
  assert.equal(updateProfileSchema.safeParse({}).success, false);
});

test('a profile update cannot change the email or the password', () => {
  // Email is the login identifier and the hash is never client-settable, so
  // both must be stripped rather than accepted.
  const parsed = updateProfileSchema.parse({
    name: 'Asha N',
    email: 'attacker@example.com',
    password: 'hunter2hunter2',
  });
  assert.deepEqual(Object.keys(parsed), ['name']);
});

test('a password change needs the current password and a strong new one', () => {
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'a-new-password' })
      .success,
    true
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'a-new-password' }).success,
    false
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'short' }).success,
    false
  );
});

test('a join request may carry a short note, bounded in length', () => {
  assert.equal(createRequestSchema.safeParse({}).success, true);
  assert.equal(createRequestSchema.parse({ message: '  at the east gate  ' }).message, 'at the east gate');
  assert.equal(createRequestSchema.safeParse({ message: 'x'.repeat(301) }).success, false);
});

test('request params must both look like mongo ids', () => {
  const ok = { id: '507f1f77bcf86cd799439011', requestId: '507f1f77bcf86cd799439012' };
  assert.equal(requestParamsSchema.safeParse(ok).success, true);
  assert.equal(requestParamsSchema.safeParse({ ...ok, requestId: 'mine' }).success, false);
});

test('discovery accepts a free-text query and a departure window', () => {
  const parsed = listRidesQuerySchema.parse({
    q: '  Koramangala  ',
    from: '2030-01-01T00:00:00.000Z',
    to: '2030-01-02T00:00:00.000Z',
  });
  assert.equal(parsed.q, 'Koramangala');
  assert.ok(parsed.from instanceof Date);
  assert.ok(parsed.to instanceof Date);
});

test('createRide accepts the approval flag and defaults it to false', () => {
  assert.equal(createRideSchema.parse(validRide()).approvalRequired, false);
  assert.equal(createRideSchema.parse({ ...validRide(), approvalRequired: true }).approvalRequired, true);
  assert.equal(createRideSchema.safeParse({ ...validRide(), approvalRequired: 'yes' }).success, false);
});
