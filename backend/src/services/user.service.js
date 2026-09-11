'use strict';

const User = require('../models/User');
const Ride = require('../models/Ride');
const ApiError = require('../utils/ApiError');
const { RIDE_STATUS } = require('../config/constants');

/** Counts shown on the profile page. */
async function getStats(userId) {
  const [ridesCreated, ridesJoined, ridesCompleted] = await Promise.all([
    Ride.countDocuments({ admin: userId }),
    // Rides they are on but do not run.
    Ride.countDocuments({ members: userId, admin: { $ne: userId } }),
    Ride.countDocuments({ members: userId, status: RIDE_STATUS.COMPLETED }),
  ]);
  return { ridesCreated, ridesJoined, ridesCompleted };
}

/**
 * Updates the caller's own profile. Email is deliberately not editable here:
 * it is the login identifier, so changing it needs a verification flow this
 * app does not have yet.
 */
async function updateProfile(user, { name, phone }) {
  if (phone && phone !== user.phone) {
    const taken = await User.findOne({ phone, _id: { $ne: user._id } });
    if (taken) throw ApiError.conflict('That phone number is already in use');
    user.phone = phone;
  }
  if (name) user.name = name;

  await user.save();
  return user.toPublicJSON();
}

/** Requires the current password, so a stolen token alone cannot lock someone out. */
async function changePassword(user, { currentPassword, newPassword }) {
  // req.user comes from a query that excludes the hash, so re-read it.
  const withHash = await User.findById(user._id).select('+password');
  if (!withHash) throw ApiError.unauthorized('Account no longer exists');

  const matches = await withHash.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect');

  if (await withHash.comparePassword(newPassword)) {
    throw ApiError.badRequest('The new password must be different from the current one');
  }

  // Assigning triggers the pre-save hook, which hashes it.
  withHash.password = newPassword;
  await withHash.save();
}

module.exports = { getStats, updateProfile, changePassword };
