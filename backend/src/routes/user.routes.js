'use strict';

const express = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../validators');
const { updateProfileSchema, changePasswordSchema } = require('../validators/user.validators');

const router = express.Router();

// Everything here is the caller's own account.
router.use(requireAuth);

router.get('/me', controller.getMe);
router.patch('/me', validate(updateProfileSchema), controller.updateMe);
router.patch('/me/password', validate(changePasswordSchema), controller.changePassword);

module.exports = router;
