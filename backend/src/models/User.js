'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // `select: false` keeps the hash out of every query that does not ask for it.
    password: { type: String, required: true, select: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Public shape sent to clients. The hash is never part of it.
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
