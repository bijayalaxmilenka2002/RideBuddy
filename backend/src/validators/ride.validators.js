'use strict';

const { z } = require('zod');
const { VEHICLE_TYPES, RIDE_STATUS } = require('../config/constants');

const locationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90), // latitude
  ]),
});

// maxCapacity and status are deliberately absent: the server owns both.
const createRideSchema = z.object({
  vehicleType: z.nativeEnum(VEHICLE_TYPES),
  pickupLocation: locationSchema,
  dropLocation: locationSchema,
  departureTime: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'departureTime must be in the future',
  }),
});

const listRidesQuerySchema = z.object({
  status: z.nativeEnum(RIDE_STATUS).optional(),
  vehicleType: z.nativeEnum(VEHICLE_TYPES).optional(),
  // Optional "near me" filter, in GeoJSON order.
  lng: z.coerce.number().min(-180).max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  radiusKm: z.coerce.number().positive().max(100).default(10),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const fareSchema = z.object({
  totalFare: z.number().nonnegative().max(100000),
});

const objectIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'invalid id'),
});

module.exports = { createRideSchema, listRidesQuerySchema, fareSchema, objectIdSchema };
