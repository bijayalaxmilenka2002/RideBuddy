'use strict';

const Message = require('../models/Message');

const listMessages = (rideId, limit = 100) =>
  Message.find({ rideId }).sort({ timestamp: 1 }).limit(limit).lean();

const saveMessage = ({ rideId, sender, senderName, message }) =>
  Message.create({ rideId, sender, senderName, message });

module.exports = { listMessages, saveMessage };
