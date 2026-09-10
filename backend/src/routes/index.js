'use strict';

const express = require('express');
const authRoutes = require('./auth.routes');
const rideRoutes = require('./ride.routes');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
router.use('/auth', authRoutes);
router.use('/rides', rideRoutes);

module.exports = router;
