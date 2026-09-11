'use strict';

// No gap between calls, so the throttle does not slow the suite down.
process.env.PLACES_MIN_GAP_MS = '0';
require('../setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const places = require('../../src/services/places.service');

/** Replaces global fetch and records what was requested. */
function stubFetch(responder) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return responder(String(url), options);
  };
  return {
    calls,
    restore: () => {
      global.fetch = original;
    },
  };
}

const json = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const NOMINATIM_HIT = [
  {
    display_name: 'Koramangala 5th Block, Bengaluru, Karnataka, 560095, India',
    lon: '77.6245',
    lat: '12.9352',
  },
];

test.beforeEach(() => places._clearCache());

test('search maps a Nominatim result into the app\'s place shape', async () => {
  const fetchStub = stubFetch(() => json(NOMINATIM_HIT));
  try {
    const [place] = await places.searchPlaces('koramangala');
    assert.equal(place.name, 'Koramangala 5th Block');
    assert.match(place.label, /Bengaluru/);
    // GeoJSON order: [longitude, latitude]. Swapping these is the classic bug.
    assert.deepEqual(place.coordinates, [77.6245, 12.9352]);
    assert.equal(typeof place.coordinates[0], 'number');
  } finally {
    fetchStub.restore();
  }
});

test('search identifies itself, as the Nominatim policy requires', async () => {
  const fetchStub = stubFetch(() => json(NOMINATIM_HIT));
  try {
    await places.searchPlaces('koramangala');
    const agent = fetchStub.calls[0].options.headers['User-Agent'];
    assert.ok(agent && agent.length > 0, 'a User-Agent must be sent');
    assert.match(agent, /RideBuddy/);
  } finally {
    fetchStub.restore();
  }
});

test('search sends the query and the limit upstream', async () => {
  const fetchStub = stubFetch(() => json(NOMINATIM_HIT));
  try {
    await places.searchPlaces('mg road', 3);
    const url = new URL(fetchStub.calls[0].url);
    assert.equal(url.pathname, '/search');
    assert.equal(url.searchParams.get('q'), 'mg road');
    assert.equal(url.searchParams.get('limit'), '3');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
  } finally {
    fetchStub.restore();
  }
});

test('repeated searches are served from cache, not re-fetched', async () => {
  // The usage policy asks for caching, and it keeps the app responsive.
  const fetchStub = stubFetch(() => json(NOMINATIM_HIT));
  try {
    await places.searchPlaces('koramangala');
    await places.searchPlaces('KORAMANGALA');
    await places.searchPlaces('koramangala');
    assert.equal(fetchStub.calls.length, 1, 'only the first call should hit the network');
  } finally {
    fetchStub.restore();
  }
});

test('an empty result set is not an error', async () => {
  const fetchStub = stubFetch(() => json([]));
  try {
    assert.deepEqual(await places.searchPlaces('nowhere at all'), []);
  } finally {
    fetchStub.restore();
  }
});

test('reverse geocoding turns a point into a place name', async () => {
  const fetchStub = stubFetch(() =>
    json({ display_name: 'Indiranagar, Bengaluru, India', lon: '77.6408', lat: '12.9784' })
  );
  try {
    const place = await places.reverseGeocode(77.6408, 12.9784);
    assert.equal(place.name, 'Indiranagar');
    assert.deepEqual(place.coordinates, [77.6408, 12.9784]);
    const url = new URL(fetchStub.calls[0].url);
    assert.equal(url.pathname, '/reverse');
    assert.equal(url.searchParams.get('lon'), '77.6408');
    assert.equal(url.searchParams.get('lat'), '12.9784');
  } finally {
    fetchStub.restore();
  }
});

test('reverse geocoding an empty ocean point is a 404', async () => {
  const fetchStub = stubFetch(() => json({ error: 'Unable to geocode' }));
  try {
    await assert.rejects(() => places.reverseGeocode(0, 0), (err) => err.statusCode === 404);
  } finally {
    fetchStub.restore();
  }
});

test('a route carries distance, duration and the road geometry', async () => {
  const fetchStub = stubFetch(() =>
    json({
      routes: [
        {
          distance: 14238.6,
          duration: 1920.4,
          geometry: { coordinates: [[77.62, 12.93], [77.68, 12.96], [77.75, 12.98]] },
        },
      ],
    })
  );
  try {
    const route = await places.getRoute([77.62, 12.93], [77.75, 12.98]);
    assert.equal(route.distanceMeters, 14239);
    assert.equal(route.durationSeconds, 1920);
    assert.equal(route.geometry.length, 3);

    // OSRM takes lon,lat pairs separated by a semicolon.
    assert.match(fetchStub.calls[0].url, /\/route\/v1\/driving\/77\.62,12\.93;77\.75,12\.98/);
  } finally {
    fetchStub.restore();
  }
});

test('a route with no result is a 404, not a crash', async () => {
  const fetchStub = stubFetch(() => json({ routes: [] }));
  try {
    await assert.rejects(
      () => places.getRoute([77.62, 12.93], [77.75, 12.98]),
      (err) => err.statusCode === 404
    );
  } finally {
    fetchStub.restore();
  }
});

test('an upstream failure becomes a 502, and never leaks internals', async () => {
  const fetchStub = stubFetch(() => json({}, false, 503));
  try {
    await assert.rejects(
      () => places.searchPlaces('anything at all'),
      (err) => {
        assert.equal(err.statusCode, 502);
        assert.match(err.message, /Map service responded with 503/);
        return true;
      }
    );
  } finally {
    fetchStub.restore();
  }
});

test('a network error becomes a 502 with a readable message', async () => {
  const fetchStub = stubFetch(() => {
    throw new Error('getaddrinfo ENOTFOUND nominatim.openstreetmap.org');
  });
  try {
    await assert.rejects(
      () => places.searchPlaces('some other place'),
      (err) => {
        assert.equal(err.statusCode, 502);
        // The upstream hostname and DNS detail must not reach the client.
        assert.equal(/ENOTFOUND|nominatim/.test(err.message), false);
        return true;
      }
    );
  } finally {
    fetchStub.restore();
  }
});

test('a failed call does not wedge the request queue', async () => {
  // The throttle chains calls; one rejection must not stall every later one.
  let first = true;
  const fetchStub = stubFetch(() => {
    if (first) {
      first = false;
      throw new Error('boom');
    }
    return json(NOMINATIM_HIT);
  });
  try {
    await assert.rejects(() => places.searchPlaces('first query'));
    const [place] = await places.searchPlaces('second query');
    assert.equal(place.name, 'Koramangala 5th Block');
  } finally {
    fetchStub.restore();
  }
});

test('shortName takes the leading part of a long display name', () => {
  assert.equal(places.shortName('MG Road, Bengaluru, Karnataka, India'), 'MG Road');
  assert.equal(places.shortName(''), '');
  assert.equal(places.shortName(undefined), '');
});
