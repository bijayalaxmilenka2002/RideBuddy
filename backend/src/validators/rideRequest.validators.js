'use strict';

const { z } = require('zod');
const { REQUEST_STATUS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');

const createRequestSchema = z.object({
  // A short note to the admin, e.g. where the rider will be waiting.
  message: z.string().trim().max(300).optional(),
});

const requestParamsSchema = z.object({
  id: objectId,
  requestId: objectId,
});

const listRequestsQuerySchema = z.object({
  status: z.nativeEnum(REQUEST_STATUS).optional(),
});

module.exports = { createRequestSchema, requestParamsSchema, listRequestsQuerySchema };
