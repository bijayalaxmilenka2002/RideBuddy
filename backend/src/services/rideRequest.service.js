'use strict';

const RideRequest = require('../models/RideRequest');
const ApiError = require('../utils/ApiError');
const { RIDE_STATUS, REQUEST_STATUS } = require('../config/constants');
const { addMemberAtomically } = require('./ride.service');
const { isSameUser } = require('../middleware/rideAccess');

const RIDER_FIELDS = 'name email phone';

/** Guards shared by requesting and accepting: the ride must still be joinable. */
function assertRideAcceptsRiders(ride) {
  if (ride.status === RIDE_STATUS.CANCELLED) throw ApiError.conflict('This ride was cancelled');
  if (ride.status === RIDE_STATUS.COMPLETED) throw ApiError.conflict('This ride is already completed');
  if (ride.status === RIDE_STATUS.LOCKED) throw ApiError.conflict('This ride is full');
  if (new Date(ride.departureTime).getTime() <= Date.now()) {
    throw ApiError.conflict('This ride has already departed');
  }
}

/**
 * A rider applies for a seat. One row per rider per ride: re-applying after a
 * rejection or a withdrawal reuses it, so the admin never sees duplicates.
 */
async function requestToJoin(ride, user, message) {
  if (!ride.approvalRequired) {
    throw ApiError.conflict('This ride can be joined directly - no request needed');
  }
  if (isSameUser(ride.admin, user)) {
    throw ApiError.conflict('You are the admin of this ride');
  }
  if (ride.members.some((member) => isSameUser(member, user))) {
    throw ApiError.conflict('You are already on this ride');
  }
  assertRideAcceptsRiders(ride);

  const existing = await RideRequest.findOne({ ride: ride._id, rider: user._id });
  if (existing?.status === REQUEST_STATUS.PENDING) {
    throw ApiError.conflict('You already have a pending request for this ride');
  }

  if (existing) {
    existing.status = REQUEST_STATUS.PENDING;
    existing.message = message;
    existing.respondedAt = null;
    await existing.save();
    return existing.populate({ path: 'rider', select: RIDER_FIELDS });
  }

  const created = await RideRequest.create({
    ride: ride._id,
    rider: user._id,
    message,
    status: REQUEST_STATUS.PENDING,
  });
  return created.populate({ path: 'rider', select: RIDER_FIELDS });
}

/** The admin's queue for one ride. */
function listRequestsForRide(rideId, status) {
  const query = { ride: rideId };
  if (status) query.status = status;
  return RideRequest.find(query)
    .sort({ createdAt: 1 })
    .populate({ path: 'rider', select: RIDER_FIELDS });
}

/** Everything the caller has applied for, newest first. */
function listMyRequests(user) {
  return RideRequest.find({ rider: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'ride', select: 'pickupLocation dropLocation departureTime vehicleType status' });
}

/** Loads a pending request and checks it really belongs to this ride. */
async function loadPendingRequest(ride, requestId) {
  const request = await RideRequest.findOne({ _id: requestId, ride: ride._id });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== REQUEST_STATUS.PENDING) {
    throw ApiError.conflict(`This request was already ${request.status.toLowerCase()}`);
  }
  return request;
}

/**
 * The admin accepts a rider. The seat is granted by the same atomic update the
 * instant join uses, so an accept cannot overfill a ride. If that accept fills
 * the last seat, everyone still waiting is rejected rather than left hanging
 * on a ride they can no longer be given a seat on.
 */
async function acceptRequest(ride, requestId) {
  const request = await loadPendingRequest(ride, requestId);
  assertRideAcceptsRiders(ride);

  const updatedRide = await addMemberAtomically(ride._id, request.rider);
  if (!updatedRide) throw ApiError.conflict('This ride is full');

  request.status = REQUEST_STATUS.ACCEPTED;
  request.respondedAt = new Date();
  await request.save();

  if (updatedRide.status === RIDE_STATUS.LOCKED) {
    await RideRequest.updateMany(
      { ride: ride._id, status: REQUEST_STATUS.PENDING },
      { $set: { status: REQUEST_STATUS.REJECTED, respondedAt: new Date() } }
    );
  }

  await request.populate({ path: 'rider', select: RIDER_FIELDS });
  return { ride: updatedRide, request };
}

async function rejectRequest(ride, requestId) {
  const request = await loadPendingRequest(ride, requestId);
  request.status = REQUEST_STATUS.REJECTED;
  request.respondedAt = new Date();
  await request.save();
  return request.populate({ path: 'rider', select: RIDER_FIELDS });
}

/** A rider takes their own application back. */
async function withdrawRequest(ride, user) {
  const request = await RideRequest.findOne({
    ride: ride._id,
    rider: user._id,
    status: REQUEST_STATUS.PENDING,
  });
  if (!request) throw ApiError.notFound('You have no pending request for this ride');

  request.status = REQUEST_STATUS.WITHDRAWN;
  request.respondedAt = new Date();
  await request.save();
  return request;
}

/** The caller's own request on a ride, used to drive the button in the UI. */
function findMyRequest(rideId, userId) {
  return RideRequest.findOne({ ride: rideId, rider: userId });
}

module.exports = {
  requestToJoin,
  listRequestsForRide,
  listMyRequests,
  acceptRequest,
  rejectRequest,
  withdrawRequest,
  findMyRequest,
};
