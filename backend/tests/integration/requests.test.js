'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, dbTest, call, makeUser, ridePayload } = require('./helpers');

test.before(setup);
test.after(teardown);

const createScreenedRide = (token, overrides) =>
  call('/api/rides', {
    method: 'POST',
    body: ridePayload({ approvalRequired: true, ...overrides }),
    token,
  });

dbTest('a screened ride cannot be joined directly', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);

  const joined = await call(`/api/rides/${created.body.ride._id}/join`, {
    method: 'POST',
    token: rider.token,
  });
  assert.equal(joined.status, 409);
  assert.match(joined.body.error.message, /request instead/i);
});

dbTest('an open ride does not accept requests', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  // approvalRequired defaults to false.
  const created = await call('/api/rides', { method: 'POST', body: ridePayload(), token: admin.token });

  const requested = await call(`/api/rides/${created.body.ride._id}/requests`, {
    method: 'POST',
    token: rider.token,
  });
  assert.equal(requested.status, 409);
  assert.match(requested.body.error.message, /joined directly/i);
});

dbTest('request, accept, and the rider becomes a member', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  const requested = await call(`/api/rides/${id}/requests`, {
    method: 'POST',
    body: { message: 'I will be at the east gate' },
    token: rider.token,
  });
  assert.equal(requested.status, 201);
  assert.equal(requested.body.request.status, 'PENDING');
  assert.equal(requested.body.request.message, 'I will be at the east gate');

  // The rider is not on the ride yet.
  const before = await call(`/api/rides/${id}`, { token: admin.token });
  assert.equal(before.body.ride.members.length, 1);

  const queue = await call(`/api/rides/${id}/requests`, { token: admin.token });
  assert.equal(queue.body.requests.length, 1);
  const requestId = queue.body.requests[0]._id;

  const accepted = await call(`/api/rides/${id}/requests/${requestId}/accept`, {
    method: 'PATCH',
    token: admin.token,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.request.status, 'ACCEPTED');
  assert.equal(accepted.body.ride.members.length, 2);
});

dbTest('a rejected rider does not join, and can apply again', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  const queue = await call(`/api/rides/${id}/requests`, { token: admin.token });
  const requestId = queue.body.requests[0]._id;

  const rejected = await call(`/api/rides/${id}/requests/${requestId}/reject`, {
    method: 'PATCH',
    token: admin.token,
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.request.status, 'REJECTED');

  const ride = await call(`/api/rides/${id}`, { token: admin.token });
  assert.equal(ride.body.ride.members.length, 1);

  // Re-applying reuses the same row rather than creating a duplicate.
  const again = await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  assert.equal(again.status, 201);
  assert.equal(again.body.request.status, 'PENDING');
  const queue2 = await call(`/api/rides/${id}/requests`, { token: admin.token });
  assert.equal(queue2.body.requests.length, 1);
});

dbTest('the same request cannot be answered twice', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  const queue = await call(`/api/rides/${id}/requests`, { token: admin.token });
  const requestId = queue.body.requests[0]._id;

  await call(`/api/rides/${id}/requests/${requestId}/accept`, { method: 'PATCH', token: admin.token });
  const twice = await call(`/api/rides/${id}/requests/${requestId}/reject`, {
    method: 'PATCH',
    token: admin.token,
  });
  assert.equal(twice.status, 409);
  assert.match(twice.body.error.message, /already accepted/i);
});

dbTest('a duplicate pending request is refused', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  assert.equal((await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token })).status, 201);
  const dup = await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  assert.equal(dup.status, 409);
  assert.match(dup.body.error.message, /pending request/i);
});

dbTest('a rider can withdraw their own pending request', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  const withdrawn = await call(`/api/rides/${id}/requests/mine/withdraw`, {
    method: 'PATCH',
    token: rider.token,
  });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.request.status, 'WITHDRAWN');

  const queue = await call(`/api/rides/${id}/requests?status=PENDING`, { token: admin.token });
  assert.equal(queue.body.requests.length, 0);
});

dbTest('only the admin can see or answer the request queue', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const outsider = await makeUser('Outsider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  const queue = await call(`/api/rides/${id}/requests`, { token: admin.token });
  const requestId = queue.body.requests[0]._id;

  for (const token of [rider.token, outsider.token]) {
    assert.equal((await call(`/api/rides/${id}/requests`, { token })).status, 403);
    assert.equal(
      (await call(`/api/rides/${id}/requests/${requestId}/accept`, { method: 'PATCH', token })).status,
      403
    );
    assert.equal(
      (await call(`/api/rides/${id}/requests/${requestId}/reject`, { method: 'PATCH', token })).status,
      403
    );
  }
});

dbTest('filling the last seat rejects everyone still waiting', async () => {
  const admin = await makeUser('Admin');
  const first = await makeUser('First');
  const second = await makeUser('Second');
  // A bike has exactly one seat beyond the admin.
  const created = await createScreenedRide(admin.token, { vehicleType: 'BIKE' });
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: first.token });
  await call(`/api/rides/${id}/requests`, { method: 'POST', token: second.token });

  const queue = await call(`/api/rides/${id}/requests`, { token: admin.token });
  assert.equal(queue.body.requests.length, 2);

  const accepted = await call(`/api/rides/${id}/requests/${queue.body.requests[0]._id}/accept`, {
    method: 'PATCH',
    token: admin.token,
  });
  assert.equal(accepted.body.ride.status, 'LOCKED');

  // The loser is told, rather than left waiting on a ride with no seat.
  const after = await call(`/api/rides/${id}/requests`, { token: admin.token });
  const statuses = after.body.requests.map((r) => r.status).sort();
  assert.deepEqual(statuses, ['ACCEPTED', 'REJECTED']);
});

dbTest('the ride detail tells a rider the state of their own request', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  const before = await call(`/api/rides/${id}`, { token: rider.token });
  assert.equal(before.body.ride.approvalRequired, true);
  assert.equal(before.body.ride.myRequest, null);

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  const after = await call(`/api/rides/${id}`, { token: rider.token });
  assert.equal(after.body.ride.myRequest.status, 'PENDING');
});

dbTest('/rides/requests/mine lists only the caller\'s own applications', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const other = await makeUser('Other');
  const created = await createScreenedRide(admin.token);
  const id = created.body.ride._id;

  await call(`/api/rides/${id}/requests`, { method: 'POST', token: rider.token });
  await call(`/api/rides/${id}/requests`, { method: 'POST', token: other.token });

  const mine = await call('/api/rides/requests/mine', { token: rider.token });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.requests.length, 1);
  assert.equal(String(mine.body.requests[0].ride._id), String(id));
});
