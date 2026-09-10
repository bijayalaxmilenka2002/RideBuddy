'use strict';

const mongoose = require('mongoose');
const { VEHICLE_TYPES, RIDE_STATUS, capacityFor } = require('../config/constants');

const pointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    // GeoJSON order: [longitude, latitude]
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length === 2 &&
          value[0] >= -180 &&
          value[0] <= 180 &&
          value[1] >= -90 &&
          value[1] <= 90,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleType: { type: String, enum: Object.values(VEHICLE_TYPES), required: true },
    maxCapacity: { type: Number, required: true },
    pickupLocation: { type: pointSchema, required: true },
    dropLocation: { type: pointSchema, required: true },
    departureTime: { type: Date, required: true },
    // Includes the admin, so vacancies = maxCapacity - members.length.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: Object.values(RIDE_STATUS), default: RIDE_STATUS.OPEN, index: true },
    totalFare: { type: Number, default: null, min: 0 },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Geospatial discovery: "rides near my pickup point".
rideSchema.index({ pickupLocation: '2dsphere' });
rideSchema.index({ status: 1, departureTime: 1 });

// Capacity is always derived from the vehicle type, never from the request body.
rideSchema.pre('validate', function applyCapacity(next) {
  if (this.vehicleType) this.maxCapacity = capacityFor(this.vehicleType);
  next();
});

// A full ride locks itself; freeing a seat re-opens it.
rideSchema.pre('save', function syncStatus(next) {
  if (this.status === RIDE_STATUS.OPEN && this.members.length >= this.maxCapacity) {
    this.status = RIDE_STATUS.LOCKED;
  } else if (this.status === RIDE_STATUS.LOCKED && this.members.length < this.maxCapacity) {
    this.status = RIDE_STATUS.OPEN;
  }
  next();
});

rideSchema.virtual('vacancies').get(function vacancies() {
  return Math.max(this.maxCapacity - this.members.length, 0);
});

rideSchema.set('toJSON', { virtuals: true });
rideSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ride', rideSchema);
