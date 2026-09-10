'use strict';

const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/** Socket.IO handshake auth: the same JWT the REST API uses. */
async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return next(new Error('Account no longer exists'));

    socket.user = { _id: user._id, name: user.name };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
}

module.exports = { socketAuth };
