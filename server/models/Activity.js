const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  relatedType: { type: String, enum: ['lead', 'customer'] },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['call', 'whatsapp', 'email', 'note', 'status_change'] },
  description: { type: String },
  fileName: { type: String },
  fileUrl: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Activity', activitySchema);
