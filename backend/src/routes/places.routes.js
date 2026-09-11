'use strict';

const express = require('express');
const controller = require('../controllers/places.controller');
const { requireAuth } = require('../middleware/auth');
const { placesLimiter } = require('../middleware/rateLimit');
const { validate } = require('../validators');
const {
  searchQuerySchema,
  reverseQuerySchema,
  routeQuerySchema,
} = require('../validators/places.validators');

const router = express.Router();

// Signed in only, and separately rate limited: this proxies a free public
// service that would otherwise be open to anyone to abuse through us.
router.use(requireAuth, placesLimiter);

router.get('/search', validate(searchQuerySchema, 'query'), controller.search);
router.get('/reverse', validate(reverseQuerySchema, 'query'), controller.reverse);
router.get('/route', validate(routeQuerySchema, 'query'), controller.route);

module.exports = router;
