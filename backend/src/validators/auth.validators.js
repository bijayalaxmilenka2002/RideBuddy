'use strict';

const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'phone must be 10 digits'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'password is required'),
});

module.exports = { signupSchema, loginSchema };
