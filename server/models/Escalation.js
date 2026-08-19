const mongoose = require('mongoose');

const escalationSchema = new mongoose.Schema({
  followUpId: { type: mongoose.Schema.Types.ObjectId, ref: 'FollowUp', required: true },
  stage: {
    type: String,
    enum: ['reminder', 'warning', 'escalation', 'md_review', 'reassignment'],
    default: 'reminder'
  },
  triggeredAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reassignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Escalation', escalationSchema);
