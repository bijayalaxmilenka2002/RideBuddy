'use strict';

const asyncHandler = require('../utils/asyncHandler');
const requestService = require('../services/rideRequest.service');
const { presentRide } = require('./ride.controller');

/** POST /api/rides/:id/requests - a rider applies for a seat. */
const createRequest = asyncHandler(async (req, res) => {
  const request = await requestService.requestToJoin(req.ride, req.user, req.body.message);
  res.status(201).json({ request });
});

/** GET /api/rides/:id/requests - admin only. */
const listRequests = asyncHandler(async (req, res) => {
  const requests = await requestService.listRequestsForRide(req.ride._id, req.query.status);
  res.json({ requests });
});

/** GET /api/rides/requests/mine - every ride the caller has applied for. */
const listMyRequests = asyncHandler(async (req, res) => {
  const requests = await requestService.listMyRequests(req.user);
  res.json({ requests });
});

/** PATCH /api/rides/:id/requests/:requestId/accept - admin only. */
const acceptRequest = asyncHandler(async (req, res) => {
  const { ride, request } = await requestService.acceptRequest(req.ride, req.params.requestId);
  res.json({ request, ride: presentRide(ride, req.user) });
});

/** PATCH /api/rides/:id/requests/:requestId/reject - admin only. */
const rejectRequest = asyncHandler(async (req, res) => {
  const request = await requestService.rejectRequest(req.ride, req.params.requestId);
  res.json({ request });
});

/** PATCH /api/rides/:id/requests/mine/withdraw - the rider takes it back. */
const withdrawRequest = asyncHandler(async (req, res) => {
  const request = await requestService.withdrawRequest(req.ride, req.user);
  res.json({ request });
});

module.exports = {
  createRequest,
  listRequests,
  listMyRequests,
  acceptRequest,
  rejectRequest,
  withdrawRequest,
};
