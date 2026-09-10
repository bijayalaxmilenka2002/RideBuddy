'use strict';

/**
 * Ride-hailing hand-off.
 *
 * IMPORTANT: this is NOT an API integration. Nothing here books a ride, reads
 * pricing, or talks to Uber/Ola/Rapido servers. It only builds public web/deep
 * links that pre-fill pickup and drop in the provider's own app or site; the
 * user still books there. A real API integration would need partner
 * credentials supplied as environment variables (none are read here).
 */

const UBER_CLIENT_ID = process.env.UBER_CLIENT_ID || null; // optional attribution only

function buildBookingLinks(ride) {
  const [pickupLng, pickupLat] = ride.pickupLocation.coordinates;
  const [dropLng, dropLat] = ride.dropLocation.coordinates;

  const uber = new URL('https://m.uber.com/ul/');
  uber.searchParams.set('action', 'setPickup');
  uber.searchParams.set('pickup[latitude]', pickupLat);
  uber.searchParams.set('pickup[longitude]', pickupLng);
  uber.searchParams.set('pickup[nickname]', ride.pickupLocation.name);
  uber.searchParams.set('dropoff[latitude]', dropLat);
  uber.searchParams.set('dropoff[longitude]', dropLng);
  uber.searchParams.set('dropoff[nickname]', ride.dropLocation.name);
  if (UBER_CLIENT_ID) uber.searchParams.set('client_id', UBER_CLIENT_ID);

  const ola = new URL('https://book.olacabs.com/');
  ola.searchParams.set('lat', pickupLat);
  ola.searchParams.set('lng', pickupLng);
  ola.searchParams.set('drop_lat', dropLat);
  ola.searchParams.set('drop_lng', dropLng);

  return [
    { provider: 'UBER', label: 'Book on Uber', url: uber.toString(), prefillsRoute: true },
    { provider: 'OLA', label: 'Book on Ola', url: ola.toString(), prefillsRoute: true },
    {
      provider: 'RAPIDO',
      label: 'Book on Rapido',
      // Rapido publishes no documented route-prefill deep link, so this only
      // opens the app/site. Do not describe it as a prefilled booking.
      url: 'https://www.rapido.bike/',
      prefillsRoute: false,
    },
  ];
}

module.exports = { buildBookingLinks };
