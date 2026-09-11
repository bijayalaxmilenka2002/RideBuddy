'use strict';

const http = require('http');
const mongoose = require('mongoose');

/**
 * Configuration is read when these modules load, so a missing variable throws
 * here. Catching it turns a stack trace into instructions.
 */
let app;
let env;
let connectDatabase;
let initSockets;

try {
  app = require('./src/app');
  env = require('./src/config/env');
  ({ connectDatabase } = require('./src/config/db'));
  ({ initSockets } = require('./src/sockets'));
} catch (error) {
  if (error.code === 'ENV_MISSING') {
    console.error(`\nRideBuddy API cannot start: ${error.missing.join(', ')} is not set.\n`);
    console.error('Set it in backend/.env (copy backend/.env.example to get started):\n');
    if (error.missing.includes('MONGO_URI')) {
      console.error('  MONGO_URI=mongodb://127.0.0.1:27017/ridebuddy');
    }
    if (error.missing.includes('JWT_SECRET')) {
      console.error('  JWT_SECRET=<a long random string>');
      console.error('  Generate one with:');
      console.error('    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    }
    console.error('\nOr run the whole stack with:  docker compose up\n');
    process.exit(1);
  }
  throw error;
}

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
  console.error('\nFailed to start server:', error.message);
  if (/ECONNREFUSED|ENOTFOUND|ServerSelection/i.test(error.message)) {
    console.error('The API could not reach MongoDB. Check MONGO_URI, and that MongoDB is running.');
    console.error('The easiest way to get one:  docker compose up\n');
  }
  process.exit(1);
});
