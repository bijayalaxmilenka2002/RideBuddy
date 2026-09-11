'use strict';

const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');
const env = require('./src/config/env');
const { connectDatabase } = require('./src/config/db');
const { initSockets } = require('./src/sockets');

let server;

async function start() {
  await connectDatabase();
  console.log('MongoDB connected');

  server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`RideBuddy API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

/**
 * Stop taking new connections, finish the in-flight ones, then close Mongo.
 * Hosting platforms send SIGTERM on every redeploy; without this, requests in
 * flight are cut off mid-response.
 */
async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => {
    console.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000).unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
    clearTimeout(force);
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));

// A rejection that reaches here is a bug, but it should be logged rather than
// terminate the API silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
