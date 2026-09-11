'use strict';

const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const messageService = require('../services/message.service');
const { sendMessageSchema } = require('../validators/message.validators');

const roomFor = (rideId) => `ride:${rideId}`;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

/**
 * Wraps a socket handler so a rejected promise can never become an unhandled
 * rejection (which terminates the Node process). The client gets an ack with
 * an error; the details stay in the server log.
 */
const safeHandler = (name, fn) => async (...args) => {
  const ack = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  try {
    await fn(...args);
  } catch (error) {
    console.error(`socket ${name} failed:`, error);
    ack?.({ ok: false, error: 'Something went wrong' });
  }
};

/** Membership is re-checked on the server for every join and every message. */
async function isRideMember(rideId, userId) {
  // An unchecked id would make findById throw a CastError.
  if (!isObjectId(rideId)) return false;
  const ride = await Ride.findById(rideId).select('members').lean();
  if (!ride) return false;
  return ride.members.some((member) => String(member) === String(userId));
}

function registerChatHandlers(io, socket) {
  socket.on(
    'ride:join',
    safeHandler('ride:join', async (rideId, ack) => {
      if (!(await isRideMember(rideId, socket.user._id))) {
        return ack?.({ ok: false, error: 'You are not a member of this ride' });
      }
      socket.join(roomFor(rideId));
      const messages = await messageService.listMessages(rideId);
      return ack?.({ ok: true, messages });
    })
  );

  socket.on('ride:leave', (rideId) => {
    if (!isObjectId(rideId)) return;
    socket.leave(roomFor(rideId));
  });

  socket.on(
    'message:send',
    safeHandler('message:send', async (payload, ack) => {
      const parsed = sendMessageSchema.safeParse({ message: payload?.message });
      if (!parsed.success) return ack?.({ ok: false, error: 'Message cannot be empty' });

      const { rideId } = payload || {};
      // Never trust the room membership alone - re-verify against the database.
      if (!(await isRideMember(rideId, socket.user._id))) {
        return ack?.({ ok: false, error: 'You are not a member of this ride' });
      }

      const saved = await messageService.saveMessage({
        rideId,
        sender: socket.user._id,
        senderName: socket.user.name,
        message: parsed.data.message,
      });

      io.to(roomFor(rideId)).emit('message:new', {
        _id: saved._id,
        rideId: saved.rideId,
        sender: saved.sender,
        senderName: saved.senderName,
        message: saved.message,
        timestamp: saved.timestamp,
      });
      return ack?.({ ok: true });
    })
  );
}

module.exports = { registerChatHandlers, roomFor, isRideMember };
