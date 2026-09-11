'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBookingLinks } = require('../../src/services/booking.service');

const ride = {
  pickupLocation: { name: 'Koramangala', coordinates: [77.6245, 12.9352] },
  dropLocation: { name: 'Whitefield', coordinates: [77.7499, 12.9698] },
};

test('builds a hand-off link per provider', () => {
  const links = buildBookingLinks(ride);
  assert.deepEqual(links.map((l) => l.provider), ['UBER', 'OLA', 'RAPIDO']);
});

test('uber link carries latitude and longitude the right way round', () => {
  const uber = new URL(buildBookingLinks(ride)[0].url);
  assert.equal(uber.searchParams.get('pickup[latitude]'), '12.9352');
  assert.equal(uber.searchParams.get('pickup[longitude]'), '77.6245');
  assert.equal(uber.searchParams.get('dropoff[latitude]'), '12.9698');
  assert.equal(uber.searchParams.get('dropoff[nickname]'), 'Whitefield');
});

test('rapido is flagged as not prefilling the route', () => {
  // Rapido publishes no documented route-prefill link. The UI reads this flag
  // to avoid promising a prefilled booking.
  const rapido = buildBookingLinks(ride).find((l) => l.provider === 'RAPIDO');
  assert.equal(rapido.prefillsRoute, false);
});

test('place names with spaces and symbols stay url safe', () => {
  const links = buildBookingLinks({
    pickupLocation: { name: 'MG Road & 5th Cross', coordinates: [77.6, 12.97] },
    dropLocation: { name: 'Airport T2', coordinates: [77.7, 13.19] },
  });
  const uber = new URL(links[0].url);
  assert.equal(uber.searchParams.get('pickup[nickname]'), 'MG Road & 5th Cross');
  assert.equal(links[0].url.includes(' '), false);
});
