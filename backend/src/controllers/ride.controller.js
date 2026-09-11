'use strict';

const asyncHandler = require('../utils/asyncHandler');
const rideService = require('../services/ride.service');
const { buildBookingLinks } = require('../services/booking.service');
const { isSameUser } = require('../middleware/rideAccess');

/** Adds the caller's perspective so the UI knows which controls to show. */
const present = (ride, user) => {
  const json = ride.toJSON();
  const isAdmin = user ? isSameUser(ride.admin, user) : false;
  return {
    ...json,
    fare: rideService.fareBreakdown(ride),
    isAdmin,
    isMember: user ? ride.members.some((member) => isSameUser(member, user)) : false,
    // Booking hand-off is an admin-only control; omit it for everyone else.
    bookingLinks: isAdmin ? buildBookingLinks(ride) : undefined,
  };
};

const createRide = asyncHandler(async (req, res) => {
  const ride = await rideService.createRide(req.body, req.user);
  res.status(201).json({ ride: present(ride, req.user) });
});

const listRides = asyncHandler(async (req, res) => {
  const rides = await rideService.listRides(req.query);
  res.json({ rides: rides.map((ride) => present(ride, req.user)) });
});

const listMyRides = asyncHandler(async (req, res) => {
  const rides = await rideService.listMyRides(req.user);
  res.json({ rides: rides.map((ride) => present(ride, req.user)) });
});

const getRide = asyncHandler(async (req, res) => {
  res.json({ ride: present(req.ride, req.user) });
});

const joinRide = asyncHandler(async (req, res) => {
  const ride = await rideService.joinRide(req.ride, req.user);
  res.json({ ride: present(ride, req.user) });
});

const leaveRide = asyncHandler(async (req, res) => {
  const ride = await rideService.leaveRide(req.ride, req.user);
  res.json({ ride: present(ride, req.user) });
});

const cancelRide = asyncHandler(async (req, res) => {
  const ride = await rideService.cancelRide(req.ride);
  res.json({ ride: present(ride, req.user) });
});

const completeRide = asyncHandler(async (req, res) => {
  const ride = await rideService.completeRide(req.ride);
  res.json({ ride: present(ride, req.user) });
});

const setFare = asyncHandler(async (req, res) => {
  const ride = await rideService.setFare(req.ride, req.body.totalFare);
  res.json({ ride: present(ride, req.user) });
});

module.exports = {
  createRide,
  listRides,
  listMyRides,
  getRide,
  joinRide,
  leaveRide,
  cancelRide,
  completeRide,
  setFare,
};
