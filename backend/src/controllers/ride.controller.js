'use strict';

const asyncHandler = require('../utils/asyncHandler');
const rideService = require('../services/ride.service');
const { buildBookingLinks } = require('../services/booking.service');
const { isSameUser } = require('../middleware/rideAccess');
const { findMyRequest } = require('../services/rideRequest.service');

/**
 * Contact details are shared only inside a pool. Discovery and a ride page
 * viewed by a non-member expose names alone - otherwise anyone with an account
 * could list every ride and harvest the phone number and email of everyone on
 * the platform.
 */
const publicUser = (person, includeContact) => {
  // Guard against an unpopulated ObjectId reference.
  if (!person || !person.name) return person;
  const base = { _id: person._id, name: person.name };
  return includeContact ? { ...base, email: person.email, phone: person.phone } : base;
};

/** Adds the caller's perspective so the UI knows which controls to show. */
const present = (ride, user) => {
  const json = ride.toJSON();
  const isAdmin = user ? isSameUser(ride.admin, user) : false;
  const isMember = user ? ride.members.some((member) => isSameUser(member, user)) : false;

  return {
    ...json,
    admin: publicUser(json.admin, isMember),
    members: Array.isArray(json.members)
      ? json.members.map((member) => publicUser(member, isMember))
      : json.members,
    fare: rideService.fareBreakdown(ride),
    isAdmin,
    isMember,
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
  const ride = present(req.ride, req.user);
  // The detail page needs to know whether the caller has already applied, so
  // it can show "Request pending" rather than the request button again.
  if (req.ride.approvalRequired && !ride.isMember) {
    const mine = await findMyRequest(req.ride._id, req.user._id);
    ride.myRequest = mine
      ? { _id: mine._id, status: mine.status, message: mine.message, createdAt: mine.createdAt }
      : null;
  }
  res.json({ ride });
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
  // Exported for tests: this is the boundary that keeps contact details inside
  // a pool, so it is worth asserting directly.
  publicUser,
  // Reused by the ride-request controller so both return the same ride shape.
  presentRide: present,
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
