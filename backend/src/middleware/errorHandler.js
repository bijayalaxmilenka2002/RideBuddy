'use strict';

const env = require('../config/env');

const notFound = (req, _res, next) => {
  next(Object.assign(new Error(`Route not found: ${req.method} ${req.originalUrl}`), {
    statusCode: 404,
    isApiError: true,
  }));
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    statusCode = 409;
    message = `An account with that ${Object.keys(err.keyValue).join(', ')} already exists`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Malformed identifier';
  }

  // Never leak internals to the client on a 500.
  if (statusCode >= 500) {
    console.error(err);
    if (env.nodeEnv === 'production') message = 'Internal server error';
  }

  res.status(statusCode).json({ error: { message, ...(details ? { details } : {}) } });
};

module.exports = { notFound, errorHandler };
