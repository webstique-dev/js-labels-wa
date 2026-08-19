const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  type: { type: String, enum: ['reorder', 'follow_up_escalation'], default: 'reorder' },
  channel: { type: String, enum: ['whatsapp', 'email', 'call'] },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  probabilityScore: { type: Number },
  milestoneDay: { type: Number }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reminder', reminderSchema);
