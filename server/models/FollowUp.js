const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const followUpSchema = new mongoose.Schema({
  relatedType: { type: String, enum: ['lead', 'customer'] },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['open', 'done', 'overdue'], default: 'open' },
  notes: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

followUpSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('FollowUp', followUpSchema);
