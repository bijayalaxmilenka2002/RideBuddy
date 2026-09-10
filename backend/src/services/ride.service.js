'use strict';

const Ride = require('../models/Ride');
const ApiError = require('../utils/ApiError');
const { RIDE_STATUS } = require('../config/constants');
const { splitFare } = require('../utils/fare');
const { isSameUser } = require('../middleware/rideAccess');

const POPULATE = [
  { path: 'admin', select: 'name email phone' },
  { path: 'members', select: 'name email phone' },
];

/** The creator is the admin and occupies the first seat. */
async function createRide(payload, adminUser) {
  const ride = await Ride.create({
    ...payload,
    admin: adminUser._id,
    members: [adminUser._id],
  });
  return ride.populate(POPULATE);
}

/**
 * Ride discovery. Only OPEN rides with a free seat and a future departure
 * are listed; optionally restricted to a radius around a pickup point.
 */
async function listRides({ status, vehicleType, lng, lat, radiusKm, limit }) {
  const query = {
    status: status || RIDE_STATUS.OPEN,
    departureTime: { $gte: new Date() },
  };
  if (vehicleType) query.vehicleType = vehicleType;

  if (lng !== undefined && lat !== undefined) {
    query.pickupLocation = {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000,
      },
    };
  }

  const rides = await Ride.find(query).limit(limit).populate(POPULATE);
  // A LOCKED ride is already excluded by status, but stay defensive.
  return rides.filter((ride) => ride.members.length < ride.maxCapacity);
}

async function joinRide(ride, user) {
  if (ride.status === RIDE_STATUS.CANCELLED) throw ApiError.conflict('This ride was cancelled');
  if (ride.status === RIDE_STATUS.COMPLETED) throw ApiError.conflict('This ride is already completed');
  if (ride.status === RIDE_STATUS.LOCKED) throw ApiError.conflict('This ride is full');
  if (ride.members.some((member) => isSameUser(member, user))) {
    throw ApiError.conflict('You have already joined this ride');
  }
  if (ride.members.length >= ride.maxCapacity) throw ApiError.conflict('This ride is full');

  ride.members.push(user._id);
  await ride.save(); // pre-save hook flips OPEN -> LOCKED at capacity
  return ride.populate(POPULATE);
}

async function cancelRide(ride) {
  if (ride.status === RIDE_STATUS.COMPLETED) throw ApiError.conflict('Completed rides cannot be cancelled');
  ride.status = RIDE_STATUS.CANCELLED;
  await ride.save();
  return ride;
}

async function completeRide(ride) {
  if (ride.status === RIDE_STATUS.CANCELLED) throw ApiError.conflict('Cancelled rides cannot be completed');
  ride.status = RIDE_STATUS.COMPLETED;
  await ride.save();
  return ride;
}

/** The admin enters the real fare after booking; the split follows from it. */
async function setFare(ride, totalFare) {
  ride.totalFare = totalFare;
  await ride.save();
  return ride;
}

/** Fare view attached to ride responses. */
function fareBreakdown(ride) {
  const passengers = ride.members.length;
  return {
    totalFare: ride.totalFare,
    passengers,
    individualFare: splitFare(ride.totalFare, passengers),
  };
}

module.exports = {
  createRide,
  listRides,
  joinRide,
  cancelRide,
  completeRide,
  setFare,
  fareBreakdown,
  POPULATE,
};
