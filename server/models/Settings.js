const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  reminderLeadDays: { type: [Number], default: [7, 3, 0] },
  notificationTemplates: {
    reorderWhatsapp: {
      type: String,
      default: 'Hello {{customerName}}, your predicted label reorder date for {{company}} is {{expectedReorderDate}}. Reorder probability: {{probability}}%.'
    },
    reorderEmail: {
      type: String,
      default: 'Dear {{customerName}},\n\nBased on usage cycles, your next label reorder date is predicted to be {{expectedReorderDate}}.\n\nRegards,\nJS Labels Team'
    }
  },
  autoAssignmentRule: {
    type: String,
    enum: ['round_robin', 'load_based'],
    default: 'round_robin'
  },
  singleton: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
