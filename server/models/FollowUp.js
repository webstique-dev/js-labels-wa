const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const followUpSchema = new mongoose.Schema({
  relatedType: { type: String, enum: ['lead', 'customer'] },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['open', 'done', 'overdue'], default: 'open' },
  notes: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rescheduleHistory: [
    {
      previousDueDate: { type: Date },
      newDueDate: { type: Date },
      reason: { type: String },
      rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rescheduledAt: { type: Date, default: Date.now }
    }
  ],
  notesList: [
    {
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ]
}, {
  timestamps: true
});

followUpSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('FollowUp', followUpSchema);
