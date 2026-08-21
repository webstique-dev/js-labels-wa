const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  source: { type: String, enum: ['website', 'referral', 'walk_in', 'google_ads', 'tele_caller', 'other', null, ''], default: null },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['new', 'contacted', 'follow_up', 'won', 'cancelled'], default: 'new' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String },
  nextFollowUpDate: { type: Date },
  followUpDate: { type: String },
  followUpTime: { type: String },
  followUpNotes: { type: String }
}, {
  timestamps: true
});

leadSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Lead', leadSchema);
