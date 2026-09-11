'use strict';

const { z } = require('zod');

/**
 * Email is absent on purpose: it is the login identifier and changing it needs
 * a verification flow. Any other key sent by a client is stripped by zod.
 */
const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().regex(/^[0-9]{10}$/, 'phone must be 10 digits').optional(),
  })
  .refine((data) => data.name !== undefined || data.phone !== undefined, {
    message: 'Send a name or a phone number to update',
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'your current password is required'),
  newPassword: z.string().min(8, 'password must be at least 8 characters').max(128),
});

module.exports = { updateProfileSchema, changePasswordSchema };
