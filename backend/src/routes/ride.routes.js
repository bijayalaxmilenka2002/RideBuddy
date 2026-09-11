'use strict';

const express = require('express');
const controller = require('../controllers/ride.controller');
const requestController = require('../controllers/rideRequest.controller');
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
const {
  createRequestSchema,
  requestParamsSchema,
  listRequestsQuerySchema,
} = require('../validators/rideRequest.validators');

const router = express.Router();

// Every ride route needs an identity: discovery included, so the response can
// say whether the caller is the admin or already a member.
router.use(requireAuth);

router.post('/', validate(createRideSchema), controller.createRide);
router.get('/', validate(listRidesQuerySchema, 'query'), controller.listRides);

// Must be declared before the '/:id' matcher below, or these static segments
// are read as ride ids.
router.get('/mine', controller.listMyRides);
router.get('/requests/mine', requestController.listMyRequests);

router.use('/:id', validate(objectIdSchema, 'params'), loadRide);

router.get('/:id', controller.getRide);
router.post('/:id/join', controller.joinRide);
router.post('/:id/leave', controller.leaveRide);

// Join requests, for rides whose admin screens riders.
router.post('/:id/requests', validate(createRequestSchema), requestController.createRequest);
router.patch('/:id/requests/mine/withdraw', requestController.withdrawRequest);

// Admin-only controls. A co-rider can never reach these.
router.get(
  '/:id/requests',
  requireRideAdmin,
  validate(listRequestsQuerySchema, 'query'),
  requestController.listRequests
);
router.patch(
  '/:id/requests/:requestId/accept',
  requireRideAdmin,
  validate(requestParamsSchema, 'params'),
  requestController.acceptRequest
);
router.patch(
  '/:id/requests/:requestId/reject',
  requireRideAdmin,
  validate(requestParamsSchema, 'params'),
  requestController.rejectRequest
);

router.patch('/:id/cancel', requireRideAdmin, controller.cancelRide);
router.patch('/:id/complete', requireRideAdmin, controller.completeRide);
router.patch('/:id/fare', requireRideAdmin, validate(fareSchema), controller.setFare);

// Chat history is members-only.
router.get('/:id/messages', requireRideMember, messageController.listMessages);

module.exports = router;
