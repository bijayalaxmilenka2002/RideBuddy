'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');

/** Resolves the bearer token into req.user, or rejects with 401. */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }

  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  req.user = user;
  next();
});

module.exports = { requireAuth };
