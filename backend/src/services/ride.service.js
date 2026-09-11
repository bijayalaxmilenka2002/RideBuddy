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

/**
 * Seat allocation is a single atomic conditional update, not read-then-write.
 * Two riders tapping "join" at the same moment cannot both take the last seat:
 * the capacity guard lives in the query, so the loser matches nothing. The
 * pipeline's second stage sees the pushed member, which is what flips a filled
 * ride to LOCKED in the same round trip.
 */
/** Every ride the caller is part of, newest departure first. Discovery hides
 * full rides, so without this a user could not get back to their own locked
 * pool. */
async function listMyRides(user) {
  return Ride.find({ members: user._id }).sort({ departureTime: -1 }).limit(50).populate(POPULATE);
}

async function joinRide(ride, user) {
  // These pre-checks exist only to return a precise message. The update below
  // is what actually enforces the rule.
  if (ride.status === RIDE_STATUS.CANCELLED) throw ApiError.conflict('This ride was cancelled');
  if (ride.status === RIDE_STATUS.COMPLETED) throw ApiError.conflict('This ride is already completed');
  if (ride.status === RIDE_STATUS.LOCKED) throw ApiError.conflict('This ride is full');
  // Discovery hides departed rides, but the id is guessable from a shared link.
  if (new Date(ride.departureTime).getTime() <= Date.now()) {
    throw ApiError.conflict('This ride has already departed');
  }
  if (ride.members.some((member) => isSameUser(member, user))) {
    throw ApiError.conflict('You have already joined this ride');
  }

  const updated = await Ride.findOneAndUpdate(
    {
      _id: ride._id,
      status: RIDE_STATUS.OPEN,
      members: { $ne: user._id },
      $expr: { $lt: [{ $size: '$members' }, '$maxCapacity'] },
    },
    [
      { $set: { members: { $concatArrays: ['$members', [user._id]] } } },
      {
        $set: {
          status: {
            $cond: [
              { $gte: [{ $size: '$members' }, '$maxCapacity'] },
              RIDE_STATUS.LOCKED,
              '$status',
            ],
          },
        },
      },
    ],
    { new: true }
  ).populate(POPULATE);

  // Nothing matched: someone else took the seat between the check and the write.
  if (!updated) throw ApiError.conflict('This ride is full');
  return updated;
}

/**
 * A co-rider gives up their seat. The freed seat re-opens a LOCKED ride in the
 * same atomic update. The admin cannot leave - the admin cancels instead, so a
 * pool is never left without an owner.
 */
async function leaveRide(ride, user) {
  if (isSameUser(ride.admin, user)) {
    throw ApiError.conflict('The ride admin cannot leave; cancel the ride instead');
  }
  if (ride.status === RIDE_STATUS.COMPLETED) throw ApiError.conflict('This ride is already completed');
  if (!ride.members.some((member) => isSameUser(member, user))) {
    throw ApiError.conflict('You are not a member of this ride');
  }

  const updated = await Ride.findOneAndUpdate(
    { _id: ride._id, members: user._id, status: { $in: [RIDE_STATUS.OPEN, RIDE_STATUS.LOCKED] } },
    [
      {
        $set: {
          members: {
            $filter: {
              input: '$members',
              as: 'member',
              cond: { $ne: ['$$member', user._id] },
            },
          },
        },
      },
      {
        $set: {
          status: {
            $cond: [
              { $lt: [{ $size: '$members' }, '$maxCapacity'] },
              RIDE_STATUS.OPEN,
              '$status',
            ],
          },
        },
      },
    ],
    { new: true }
  ).populate(POPULATE);

  if (!updated) throw ApiError.conflict('You are not a member of this ride');
  return updated;
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
  listMyRides,
  joinRide,
  leaveRide,
  cancelRide,
  completeRide,
  setFare,
  fareBreakdown,
  POPULATE,
};
