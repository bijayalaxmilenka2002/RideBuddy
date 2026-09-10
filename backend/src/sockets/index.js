'use strict';

const { Server } = require('socket.io');
const env = require('../config/env');
const { socketAuth } = require('./auth.socket');
const { registerChatHandlers } = require('./chat.socket');

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use(socketAuth);
  io.on('connection', (socket) => registerChatHandlers(io, socket));

  return io;
}

module.exports = { initSockets };
