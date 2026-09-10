'use strict';

const Ride = require('../models/Ride');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** Loads the ride named by :id onto req.ride. */
const loadRide = asyncHandler(async (req, _res, next) => {
  const ride = await Ride.findById(req.params.id)
    .populate('admin', 'name email phone')
    .populate('members', 'name email phone');
  if (!ride) throw ApiError.notFound('Ride not found');
  req.ride = ride;
  next();
});

const isSameUser = (a, b) => String(a._id || a) === String(b._id || b);

/** Only the ride admin may pass. The admin can never be replaced. */
const requireRideAdmin = (req, _res, next) => {
  if (!isSameUser(req.ride.admin, req.user)) {
    return next(ApiError.forbidden('Only the ride admin can do that'));
  }
  return next();
};

/** Only accepted members of this ride may pass (the admin is a member). */
const requireRideMember = (req, _res, next) => {
  const isMember = req.ride.members.some((member) => isSameUser(member, req.user));
  if (!isMember) {
    return next(ApiError.forbidden('You are not a member of this ride'));
  }
  return next();
};

module.exports = { loadRide, requireRideAdmin, requireRideMember, isSameUser };
