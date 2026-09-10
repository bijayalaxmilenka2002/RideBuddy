'use strict';

const express = require('express');
const controller = require('../controllers/ride.controller');
const messageController = require('../controllers/message.controller');
const { requireAuth } = require('../middleware/auth');
const { loadRide, requireRideAdmin, requireRideMember } = require('../middleware/rideAccess');
const { validate } = require('../validators');
const {
  createRideSchema,
  listRidesQuerySchema,
  fareSchema,
  objectIdSchema,
} = require('../validators/ride.validators');

const router = express.Router();

// Every ride route needs an identity: discovery included, so the response can
// say whether the caller is the admin or already a member.
router.use(requireAuth);

router.post('/', validate(createRideSchema), controller.createRide);
router.get('/', validate(listRidesQuerySchema, 'query'), controller.listRides);

router.use('/:id', validate(objectIdSchema, 'params'), loadRide);

router.get('/:id', controller.getRide);
router.post('/:id/join', controller.joinRide);

// Admin-only controls. A co-rider can never reach these.
router.patch('/:id/cancel', requireRideAdmin, controller.cancelRide);
router.patch('/:id/complete', requireRideAdmin, controller.completeRide);
router.patch('/:id/fare', requireRideAdmin, validate(fareSchema), controller.setFare);

// Chat history is members-only.
router.get('/:id/messages', requireRideMember, messageController.listMessages);

module.exports = router;
