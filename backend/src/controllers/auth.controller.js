'use strict';

const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

module.exports = { signup, login, me };
