'use strict';

const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');

/** GET /api/users/me */
const getMe = asyncHandler(async (req, res) => {
  const stats = await userService.getStats(req.user._id);
  res.json({ user: req.user.toPublicJSON(), stats });
});

/** PATCH /api/users/me */
const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user, req.body);
  res.json({ user });
});

/** PATCH /api/users/me/password */
const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user, req.body);
  res.json({ message: 'Password updated' });
});

module.exports = { getMe, updateMe, changePassword };
