'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../validators');
const { signupSchema, loginSchema } = require('../validators/auth.validators');

const router = express.Router();

router.post('/signup', authLimiter, validate(signupSchema), controller.signup);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.get('/me', requireAuth, controller.me);

module.exports = router;
