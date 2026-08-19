const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'manager', 'caller'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  avatarUrl: { type: String },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('User', userSchema);
