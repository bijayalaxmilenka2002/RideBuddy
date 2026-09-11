'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, dbTest, call, makeUser, ridePayload } = require('./helpers');

test.before(setup);
test.after(teardown);

dbTest('signup returns a token and never the password hash', async () => {
  const { status, body } = await call('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Asha',
      email: 'asha@example.com',
      phone: '9876543210',
      password: 'correct-horse-battery',
    },
  });
  assert.equal(status, 201);
  assert.ok(body.token);
  assert.equal(body.user.password, undefined);
  assert.equal(body.user.email, 'asha@example.com');
});

dbTest('a duplicate email is a 409, not a 500', async () => {
  const signup = (email) =>
    call('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Asha', email, phone: `98765432${Math.floor(Math.random() * 90 + 10)}`, password: 'correct-horse-battery' },
    });
  assert.equal((await signup('dup@example.com')).status, 201);
  const second = await signup('dup@example.com');
  assert.equal(second.status, 409);
  assert.match(second.body.error.message, /already exists/i);
});

dbTest('login works and a wrong password is rejected with the same message', async () => {
  await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Asha', email: 'login@example.com', phone: '9811111111', password: 'correct-horse-battery' },
  });

  const good = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'login@example.com', password: 'correct-horse-battery' },
  });
  assert.equal(good.status, 200);
  assert.ok(good.body.token);

  const bad = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'login@example.com', password: 'wrong-password' },
  });
  const missing = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody@example.com', password: 'wrong-password' },
  });
  assert.equal(bad.status, 401);
  assert.equal(missing.status, 401);
  // Identical wording, so the endpoint cannot be used to enumerate accounts.
  assert.equal(bad.body.error.message, missing.body.error.message);
});

dbTest('/auth/me resolves the token back to the caller', async () => {
  const { token, user } = await makeUser('Asha');
  const { status, body } = await call('/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(body.user._id, user._id);
});

dbTest('creating a ride makes you the admin and fills the first seat', async () => {
  const { token, user } = await makeUser('Admin');
  const { status, body } = await call('/api/rides', { method: 'POST', body: ridePayload(), token });

  assert.equal(status, 201);
  assert.equal(body.ride.admin._id, user._id);
  assert.equal(body.ride.members.length, 1);
  assert.equal(body.ride.maxCapacity, 3);
  assert.equal(body.ride.vacancies, 2);
  assert.equal(body.ride.status, 'OPEN');
  assert.equal(body.ride.isAdmin, true);
});

dbTest('a client cannot inflate capacity through the request body', async () => {
  const { token } = await makeUser('Admin');
  const { body } = await call('/api/rides', {
    method: 'POST',
    body: { ...ridePayload({ vehicleType: 'BIKE' }), maxCapacity: 99, status: 'OPEN' },
    token,
  });
  assert.equal(body.ride.maxCapacity, 2);
});

dbTest('a bike fills after one co-rider and locks itself', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', {
    method: 'POST',
    body: ridePayload({ vehicleType: 'BIKE' }),
    token: admin.token,
  });
  const id = created.body.ride._id;

  const joined = await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.ride.members.length, 2);
  assert.equal(joined.body.ride.status, 'LOCKED');
  assert.equal(joined.body.ride.vacancies, 0);

  const third = await makeUser('Late');
  const rejected = await call(`/api/rides/${id}/join`, { method: 'POST', token: third.token });
  assert.equal(rejected.status, 409);
  assert.match(rejected.body.error.message, /full/i);
});

dbTest('joining twice is refused', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;

  assert.equal((await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token })).status, 200);
  const again = await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });
  assert.equal(again.status, 409);
  assert.match(again.body.error.message, /already joined/i);
});

dbTest('concurrent joins cannot oversell the last seat', async () => {
  const admin = await makeUser('Admin');
  const created = await call('/api/rides', {
    method: 'POST',
    body: ridePayload({ vehicleType: 'BIKE' }), // exactly one free seat
    token: admin.token,
  });
  const id = created.body.ride._id;

  const contenders = await Promise.all([makeUser('R1'), makeUser('R2'), makeUser('R3')]);
  const results = await Promise.all(
    contenders.map((c) => call(`/api/rides/${id}/join`, { method: 'POST', token: c.token }))
  );

  // Exactly one wins; the rest get a clean 409 rather than a seat that does
  // not exist. This is what the atomic conditional update buys.
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 2);

  const final = await call(`/api/rides/${id}`, { token: admin.token });
  assert.equal(final.body.ride.members.length, 2);
  assert.equal(final.body.ride.status, 'LOCKED');
});

dbTest('a co-rider can leave, which frees the seat and re-opens the ride', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', {
    method: 'POST',
    body: ridePayload({ vehicleType: 'BIKE' }),
    token: admin.token,
  });
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });
  const left = await call(`/api/rides/${id}/leave`, { method: 'POST', token: rider.token });

  assert.equal(left.status, 200);
  assert.equal(left.body.ride.members.length, 1);
  assert.equal(left.body.ride.status, 'OPEN');
  assert.equal(left.body.ride.vacancies, 1);
});

dbTest('the admin cannot leave their own ride', async () => {
  const admin = await makeUser('Admin');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const left = await call(`/api/rides/${created.body.ride._id}/leave`, {
    method: 'POST',
    token: admin.token,
  });
  assert.equal(left.status, 409);
  assert.match(left.body.error.message, /cancel the ride instead/i);
});

dbTest('fare is split across everyone on board', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;
  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });

  const priced = await call(`/api/rides/${id}/fare`, {
    method: 'PATCH',
    body: { totalFare: 300 },
    token: admin.token,
  });
  assert.equal(priced.status, 200);
  assert.equal(priced.body.ride.fare.totalFare, 300);
  assert.equal(priced.body.ride.fare.passengers, 2);
  assert.equal(priced.body.ride.fare.individualFare, 150);
});

dbTest('only the admin can price, cancel or complete a ride', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;
  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });

  for (const [path, method] of [
    [`/api/rides/${id}/fare`, 'PATCH'],
    [`/api/rides/${id}/cancel`, 'PATCH'],
    [`/api/rides/${id}/complete`, 'PATCH'],
  ]) {
    const res = await call(path, { method, body: { totalFare: 100 }, token: rider.token });
    assert.equal(res.status, 403, `${path} should be admin-only`);
  }
});

dbTest('booking hand-off links are admin-only', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;
  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });

  const asAdmin = await call(`/api/rides/${id}`, { token: admin.token });
  const asRider = await call(`/api/rides/${id}`, { token: rider.token });
  assert.equal(asAdmin.body.ride.bookingLinks.length, 3);
  assert.equal(asRider.body.ride.bookingLinks, undefined);
  assert.equal(asRider.body.ride.isAdmin, false);
  assert.equal(asRider.body.ride.isMember, true);
});

dbTest('a cancelled ride cannot be joined', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/cancel`, { method: 'PATCH', token: admin.token });
  const joined = await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });
  assert.equal(joined.status, 409);
  assert.match(joined.body.error.message, /cancelled/i);
});

dbTest('chat history is readable by members and refused to everyone else', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const outsider = await makeUser('Outsider');
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });
  const id = created.body.ride._id;
  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });

  assert.equal((await call(`/api/rides/${id}/messages`, { token: rider.token })).status, 200);
  const denied = await call(`/api/rides/${id}/messages`, { token: outsider.token });
  assert.equal(denied.status, 403);
  assert.match(denied.body.error.message, /not a member/i);
});

dbTest('a missing ride is a 404 and a malformed id is a 400', async () => {
  const { token } = await makeUser('Asha');
  assert.equal((await call('/api/rides/507f1f77bcf86cd799439011', { token })).status, 404);
  assert.equal((await call('/api/rides/not-an-id', { token })).status, 400);
});
