'use strict';

const { z } = require('zod');

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

module.exports = { sendMessageSchema };
