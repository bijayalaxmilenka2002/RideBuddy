'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Ride = require('../../src/models/Ride');
const { capacityFor, VEHICLE_TYPES, RIDE_STATUS } = require('../../src/config/constants');

const point = (name, coordinates) => ({ name, type: 'Point', coordinates });

const rideDoc = (overrides = {}) =>
  new Ride({
    admin: new mongoose.Types.ObjectId(),
    vehicleType: VEHICLE_TYPES.AUTO,
    pickupLocation: point('Koramangala', [77.6245, 12.9352]),
    dropLocation: point('Whitefield', [77.7499, 12.9698]),
    departureTime: new Date(Date.now() + 3600_000),
    members: [new mongoose.Types.ObjectId()],
    ...overrides,
  });

test('capacity is fixed per vehicle type', () => {
  assert.equal(capacityFor('BIKE'), 2);
  assert.equal(capacityFor('AUTO'), 3);
  assert.equal(capacityFor('CAB'), 3);
});

test('capacity is derived on validate, overriding anything a client sent', async () => {
  const ride = rideDoc({ vehicleType: VEHICLE_TYPES.BIKE, maxCapacity: 99 });
  await ride.validate();
  assert.equal(ride.maxCapacity, 2);
});

test('vacancies account for the admin occupying a seat', async () => {
  const ride = rideDoc();
  await ride.validate();
  assert.equal(ride.maxCapacity, 3);
  assert.equal(ride.vacancies, 2);
});

test('vacancies never go negative', async () => {
  const ride = rideDoc({
    vehicleType: VEHICLE_TYPES.BIKE,
    members: [1, 2, 3].map(() => new mongoose.Types.ObjectId()),
  });
  await ride.validate();
  assert.equal(ride.vacancies, 0);
});

test('rejects coordinates given as [latitude, longitude]', async () => {
  // 77.6 is a valid longitude but an impossible latitude, so the swapped pair
  // is what the validator has to catch.
  const ride = rideDoc({ pickupLocation: point('Swapped', [12.9352, 77.6245]) });
  await ride.validate();

  const bad = rideDoc({ pickupLocation: point('Swapped', [12.9352, 177.6245]) });
  await assert.rejects(() => bad.validate(), /coordinates must be \[longitude, latitude\]/);
});

test('a new ride starts OPEN', async () => {
  const ride = rideDoc();
  await ride.validate();
  assert.equal(ride.status, RIDE_STATUS.OPEN);
});
