'use strict';

const http = require('http');
const app = require('./src/app');
const env = require('./src/config/env');
const { connectDatabase } = require('./src/config/db');
const { initSockets } = require('./src/sockets');

async function start() {
  await connectDatabase();
  console.log('MongoDB connected');

  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`RideBuddy API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
