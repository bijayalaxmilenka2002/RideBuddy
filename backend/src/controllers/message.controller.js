'use strict';

const asyncHandler = require('../utils/asyncHandler');
const messageService = require('../services/message.service');

/** Chat history. Reachable only after the ride-membership check. */
const listMessages = asyncHandler(async (req, res) => {
  const messages = await messageService.listMessages(req.ride._id);
  res.json({ messages });
});

module.exports = { listMessages };
