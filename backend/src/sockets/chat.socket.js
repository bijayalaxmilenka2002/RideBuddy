'use strict';

const Ride = require('../models/Ride');
const messageService = require('../services/message.service');
const { sendMessageSchema } = require('../validators/message.validators');

const roomFor = (rideId) => `ride:${rideId}`;

/** Membership is re-checked on the server for every join and every message. */
async function isRideMember(rideId, userId) {
  const ride = await Ride.findById(rideId).select('members').lean();
  if (!ride) return false;
  return ride.members.some((member) => String(member) === String(userId));
}

function registerChatHandlers(io, socket) {
  socket.on('ride:join', async (rideId, ack) => {
    if (!(await isRideMember(rideId, socket.user._id))) {
      return ack?.({ ok: false, error: 'You are not a member of this ride' });
    }
    socket.join(roomFor(rideId));
    const messages = await messageService.listMessages(rideId);
    return ack?.({ ok: true, messages });
  });

  socket.on('ride:leave', (rideId) => {
    socket.leave(roomFor(rideId));
  });

  socket.on('message:send', async (payload, ack) => {
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
  });
}

module.exports = { registerChatHandlers, roomFor };
