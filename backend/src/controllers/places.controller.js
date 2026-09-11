'use strict';

const asyncHandler = require('../utils/asyncHandler');
const placesService = require('../services/places.service');

/** GET /api/places/search?q=koramangala */
const search = asyncHandler(async (req, res) => {
  const places = await placesService.searchPlaces(req.query.q, req.query.limit);
  res.json({ places });
});

/** GET /api/places/reverse?lng=&lat= - turns a GPS fix into a place name. */
const reverse = asyncHandler(async (req, res) => {
  const place = await placesService.reverseGeocode(req.query.lng, req.query.lat);
  res.json({ place });
});

/** GET /api/places/route?fromLng=&fromLat=&toLng=&toLat= */
const route = asyncHandler(async (req, res) => {
  const { fromLng, fromLat, toLng, toLat } = req.query;
  const result = await placesService.getRoute([fromLng, fromLat], [toLng, toLat]);
  res.json({ route: result });
});

module.exports = { search, reverse, route };
