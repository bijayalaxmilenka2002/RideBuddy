'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, dbTest, call, makeUser, ridePayload } = require('./helpers');

test.before(setup);
test.after(teardown);

const KORAMANGALA = [77.6245, 12.9352];
const INDIRANAGAR = [77.6408, 12.9784]; // ~5 km away
const DELHI = [77.209, 28.6139]; // ~1750 km away

const createRide = (token, overrides) =>
  call('/api/rides', { method: 'POST', body: ridePayload(overrides), token });

dbTest('discovery lists open rides with a free seat', async () => {
  const admin = await makeUser('Admin');
  await createRide(admin.token);
  const rider = await makeUser('Rider');

  const { status, body } = await call('/api/rides', { token: rider.token });
  assert.equal(status, 200);
  assert.equal(body.rides.length, 1);
  assert.equal(body.rides[0].vacancies, 2);
});

dbTest('a full ride drops out of discovery', async () => {
  const admin = await makeUser('Admin');
  const created = await createRide(admin.token, { vehicleType: 'BIKE' });
  const rider = await makeUser('Rider');
  await call(`/api/rides/${created.body.ride._id}/join`, { method: 'POST', token: rider.token });

  const onlooker = await makeUser('Onlooker');
  const { body } = await call('/api/rides', { token: onlooker.token });
  assert.equal(body.rides.length, 0);
});

dbTest('a departed ride drops out of discovery', async () => {
  const admin = await makeUser('Admin');
  // The API refuses a past departureTime, so create it valid then age it.
  const created = await createRide(admin.token);
  const mongoose = require('mongoose');
  await mongoose
    .model('Ride')
    .updateOne({ _id: created.body.ride._id }, { departureTime: new Date(Date.now() - 60_000) });

  const rider = await makeUser('Rider');
  const { body } = await call('/api/rides', { token: rider.token });
  assert.equal(body.rides.length, 0);
});

dbTest('discovery filters by vehicle type', async () => {
  const a = await makeUser('A');
  const b = await makeUser('B');
  await createRide(a.token, { vehicleType: 'BIKE' });
  await createRide(b.token, { vehicleType: 'CAB' });

  const rider = await makeUser('Rider');
  const { body } = await call('/api/rides?vehicleType=CAB', { token: rider.token });
  assert.equal(body.rides.length, 1);
  assert.equal(body.rides[0].vehicleType, 'CAB');
});

dbTest('near-me search returns rides inside the radius and excludes distant ones', async () => {
  const near = await makeUser('Near');
  const far = await makeUser('Far');
  await createRide(near.token, {
    pickupLocation: { name: 'Indiranagar', coordinates: INDIRANAGAR },
  });
  await createRide(far.token, { pickupLocation: { name: 'Delhi', coordinates: DELHI } });

  const rider = await makeUser('Rider');
  const [lng, lat] = KORAMANGALA;
  const { status, body } = await call(`/api/rides?lng=${lng}&lat=${lat}&radiusKm=10`, {
    token: rider.token,
  });

  assert.equal(status, 200);
  assert.equal(body.rides.length, 1);
  assert.equal(body.rides[0].pickupLocation.name, 'Indiranagar');
});

dbTest('a tight radius excludes a ride a few km away', async () => {
  const near = await makeUser('Near');
  await createRide(near.token, {
    pickupLocation: { name: 'Indiranagar', coordinates: INDIRANAGAR },
  });

  const rider = await makeUser('Rider');
  const [lng, lat] = KORAMANGALA;
  const { body } = await call(`/api/rides?lng=${lng}&lat=${lat}&radiusKm=1`, { token: rider.token });
  assert.equal(body.rides.length, 0);
});

dbTest('/rides/mine returns your own rides even once they are locked', async () => {
  const admin = await makeUser('Admin');
  const rider = await makeUser('Rider');
  const created = await createRide(admin.token, { vehicleType: 'BIKE' });
  const id = created.body.ride._id;
  await call(`/api/rides/${id}/join`, { method: 'POST', token: rider.token });

  // Discovery hides it now, but both participants must still reach it.
  assert.equal((await call('/api/rides', { token: admin.token })).body.rides.length, 0);

  for (const who of [admin, rider]) {
    const { status, body } = await call('/api/rides/mine', { token: who.token });
    assert.equal(status, 200);
    assert.equal(body.rides.length, 1);
    assert.equal(body.rides[0]._id, id);
  }
});

dbTest('/rides/mine does not leak other people\'s rides', async () => {
  const admin = await makeUser('Admin');
  await createRide(admin.token);
  const stranger = await makeUser('Stranger');

  const { body } = await call('/api/rides/mine', { token: stranger.token });
  assert.equal(body.rides.length, 0);
});

dbTest('free-text search matches the pickup or the drop name', async () => {
  const a = await makeUser('A');
  const b = await makeUser('B');
  await createRide(a.token, {
    pickupLocation: { name: 'Koramangala 5th Block', coordinates: KORAMANGALA },
    dropLocation: { name: 'Electronic City', coordinates: [77.6701, 12.8452] },
  });
  await createRide(b.token, {
    pickupLocation: { name: 'Indiranagar Metro', coordinates: INDIRANAGAR },
    dropLocation: { name: 'Airport', coordinates: [77.7064, 13.1986] },
  });

  const rider = await makeUser('Rider');
  const byPickup = await call('/api/rides?q=koramangala', { token: rider.token });
  assert.equal(byPickup.body.rides.length, 1);
  assert.equal(byPickup.body.rides[0].pickupLocation.name, 'Koramangala 5th Block');

  const byDrop = await call('/api/rides?q=airport', { token: rider.token });
  assert.equal(byDrop.body.rides.length, 1);
  assert.equal(byDrop.body.rides[0].dropLocation.name, 'Airport');

  const none = await call('/api/rides?q=nowhere-at-all', { token: rider.token });
  assert.equal(none.body.rides.length, 0);
});

dbTest('a search term with regex characters is treated as literal text', async () => {
  const a = await makeUser('A');
  await createRide(a.token, {
    pickupLocation: { name: 'MG Road (Gate 2)', coordinates: KORAMANGALA },
  });

  const rider = await makeUser('Rider');
  const literal = await call(`/api/rides?q=${encodeURIComponent('(Gate 2)')}`, { token: rider.token });
  assert.equal(literal.body.rides.length, 1);

  // Unescaped, this would match everything; escaped, it matches nothing.
  const wildcard = await call(`/api/rides?q=${encodeURIComponent('.*')}`, { token: rider.token });
  assert.equal(wildcard.body.rides.length, 0);
});

dbTest('the departure window filters the list', async () => {
  const a = await makeUser('A');
  const b = await makeUser('B');
  const soon = new Date(Date.now() + 60 * 60_000);
  const later = new Date(Date.now() + 48 * 60 * 60_000);
  await createRide(a.token, { departureTime: soon.toISOString() });
  await createRide(b.token, { departureTime: later.toISOString() });

  const rider = await makeUser('Rider');
  const within = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
  const near = await call(`/api/rides?to=${encodeURIComponent(within)}`, { token: rider.token });
  assert.equal(near.body.rides.length, 1);

  const all = await call('/api/rides', { token: rider.token });
  assert.equal(all.body.rides.length, 2);
});
