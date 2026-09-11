'use strict';

/**
 * Business rules. These live on the server on purpose: capacity is never
 * taken from the client, it is derived from the vehicle type.
 */
const VEHICLE_TYPES = Object.freeze({
  BIKE: 'BIKE',
  AUTO: 'AUTO',
  CAB: 'CAB',
});

// Total seats including the ride admin.
const VEHICLE_CAPACITY = Object.freeze({
  [VEHICLE_TYPES.BIKE]: 2, // 1 admin + 1 co-rider
  [VEHICLE_TYPES.AUTO]: 3, // 1 admin + 2 co-riders
  [VEHICLE_TYPES.CAB]: 3, // 1 admin + 2 co-riders
});

const RIDE_STATUS = Object.freeze({
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

/**
 * Lifecycle of a request to join a ride that the admin screens.
 * WITHDRAWN is the rider backing out; REJECTED is the admin declining.
 */
const REQUEST_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
});

const capacityFor = (vehicleType) => VEHICLE_CAPACITY[vehicleType];

module.exports = {
  VEHICLE_TYPES,
  VEHICLE_CAPACITY,
  RIDE_STATUS,
  REQUEST_STATUS,
  capacityFor,
};
