'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  timestamp: { type: Date, default: Date.now },
});

messageSchema.index({ rideId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
