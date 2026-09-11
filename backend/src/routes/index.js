'use strict';

const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./auth.routes');
const rideRoutes = require('./ride.routes');

const router = express.Router();

// Used by hosting platforms as the health probe, so it reports the database
// link too: the process can be up while Mongo is unreachable.
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (_req, res) => {
  const dbState = DB_STATES[mongoose.connection.readyState] || 'unknown';
  const healthy = dbState === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    database: dbState,
    uptime: process.uptime(),
  });
});
router.use('/auth', authRoutes);
router.use('/rides', rideRoutes);

module.exports = router;
