'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Builds middleware that validates one part of the request with a zod schema
 * and replaces it with the parsed (and therefore stripped) value.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  req[source] = result.data;
  return next();
};

module.exports = { validate };
