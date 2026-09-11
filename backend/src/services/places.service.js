'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Place search, reverse geocoding and routing, using free OpenStreetMap
 * services: Nominatim for geocoding and OSRM for the driving route. Neither
 * needs an API key or a credit card.
 *
 * Everything goes through this module rather than straight from the browser so
 * that:
 *  - Nominatim's usage policy is honoured in one place (a real User-Agent, at
 *    most one request per second, results cached).
 *  - the provider can be swapped by changing two environment variables.
 *  - the browser never depends on a third-party origin's CORS headers.
 */

const SEARCH_TTL_MS = 10 * 60 * 1000; // places move rarely
const ROUTE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const UPSTREAM_TIMEOUT_MS = 8000;

const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, ttl) {
  // Cheap bound: drop the oldest entry once full (Map keeps insertion order).
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
}

/**
 * Serialises outbound geocoding calls at most one per second. Requests queue
 * behind each other rather than all firing at once, which is what the policy
 * asks for and what keeps this API from being blocked.
 */
let queue = Promise.resolve();
let lastCallAt = 0;

function throttled(task) {
  const run = async () => {
    const wait = Math.max(0, env.placesMinGapMs - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  };
  // Keep the chain alive even when one call fails.
  queue = queue.then(run, run);
  return queue;
}

async function fetchJson(url, { identify = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: identify ? { 'User-Agent': env.placesUserAgent } : {},
    });
    if (!response.ok) {
      throw ApiError.badGateway(`Map service responded with ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.isApiError) throw error;
    if (error.name === 'AbortError') {
      throw ApiError.badGateway('The map service timed out. Try again.');
    }
    throw ApiError.badGateway('The map service is unreachable right now.');
  } finally {
    clearTimeout(timer);
  }
}

/** Nominatim's display_name is long; the first part is the useful label. */
const shortName = (displayName) => String(displayName || '').split(',')[0].trim();

/** Free-text place search, e.g. "koramangala 5th block". */
async function searchPlaces(query, limit = 6) {
  const key = `search:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL('/search', env.nominatimUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');
  if (env.placesCountryCodes) url.searchParams.set('countrycodes', env.placesCountryCodes);

  const raw = await throttled(() => fetchJson(url.toString(), { identify: true }));

  const places = (Array.isArray(raw) ? raw : []).map((item) => ({
    name: shortName(item.display_name),
    label: item.display_name,
    // GeoJSON order, which is what the ride API stores.
    coordinates: [Number(item.lon), Number(item.lat)],
  }));

  cacheSet(key, places, SEARCH_TTL_MS);
  return places;
}

/** Turns the browser's GPS fix into a place name. */
async function reverseGeocode(lng, lat) {
  const key = `reverse:${lng.toFixed(5)}:${lat.toFixed(5)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL('/reverse', env.nominatimUrl);
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('format', 'jsonv2');

  const raw = await throttled(() => fetchJson(url.toString(), { identify: true }));
  if (!raw || raw.error) throw ApiError.notFound('No place found at that point');

  const place = {
    name: shortName(raw.display_name),
    label: raw.display_name,
    coordinates: [Number(raw.lon), Number(raw.lat)],
  };
  cacheSet(key, place, SEARCH_TTL_MS);
  return place;
}

/**
 * Driving route between two points. Returns the road geometry for the map plus
 * the distance and duration, so a ride can show "14.2 km, about 32 min".
 */
async function getRoute(from, to) {
  const key = `route:${from.join(',')}:${to.join(',')}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // OSRM takes lon,lat pairs, the same order the app stores.
  const path = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = new URL(`/route/v1/driving/${path}`, env.osrmUrl);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const raw = await fetchJson(url.toString());
  const best = raw?.routes?.[0];
  if (!best) throw ApiError.notFound('No route found between those points');

  const route = {
    distanceMeters: Math.round(best.distance),
    durationSeconds: Math.round(best.duration),
    // [[lng, lat], ...] along the road.
    geometry: best.geometry?.coordinates || [from, to],
  };
  cacheSet(key, route, ROUTE_TTL_MS);
  return route;
}

module.exports = {
  searchPlaces,
  reverseGeocode,
  getRoute,
  shortName,
  // Test seam: the module-level cache would otherwise leak between cases.
  _clearCache: () => cache.clear(),
};
