'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

async function signup({ name, phone, email, password }) {
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    const field = existing.email === email ? 'email' : 'phone number';
    throw ApiError.conflict(`An account with that ${field} already exists`);
  }

  const user = await User.create({ name, phone, email, password });
  return { user: user.toPublicJSON(), token: signToken(user._id) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  // Same message either way, so the response cannot be used to probe for accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  return { user: user.toPublicJSON(), token: signToken(user._id) };
}

module.exports = { signup, login };
