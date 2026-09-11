'use strict';

const { z } = require('zod');

const lng = z.coerce.number().min(-180).max(180);
const lat = z.coerce.number().min(-90).max(90);

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'type at least 2 characters').max(120),
  limit: z.coerce.number().int().positive().max(10).default(6),
});

const reverseQuerySchema = z.object({ lng, lat });

const routeQuerySchema = z.object({
  fromLng: lng,
  fromLat: lat,
  toLng: lng,
  toLat: lat,
});

module.exports = { searchQuerySchema, reverseQuerySchema, routeQuerySchema };
