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
