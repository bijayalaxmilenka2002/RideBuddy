'use strict';

const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('../config/constants');

/**
 * A rider asking to join a ride whose admin screens its passengers
 * (`Ride.approvalRequired`). Rides without that flag are joined directly and
 * never produce a request.
 *
 * Kept in its own collection rather than embedded in Ride so that "my
 * requests" is a single indexed query, and so a ride document does not grow
 * without bound as people apply and withdraw.
 */
const rideRequestSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      index: true,
    },
    // Optional note from the rider, e.g. "I'll be at the east gate".
    message: { type: String, trim: true, maxlength: 300 },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// One request row per rider per ride. Re-applying after a rejection or a
// withdrawal reuses this row rather than creating a second one, so this unique
// index is what keeps the admin's list free of duplicates.
rideRequestSchema.index({ ride: 1, rider: 1 }, { unique: true });

module.exports = mongoose.model('RideRequest', rideRequestSchema);
