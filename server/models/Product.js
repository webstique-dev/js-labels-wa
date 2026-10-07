const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const jobTimeEntrySchema = new mongoose.Schema({
  date: { type: String, required: true, trim: true }, // e.g. "2026-10-07"
  timeSpent: { type: String, required: true, trim: true }, // e.g. "1 hour", "1 hr 30 min", "2 hours"
  notes: { type: String, trim: true, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  widthMm: { type: Number, required: true },
  heightMm: { type: Number, required: true },
  dimensionKey: { type: String, trim: true, index: true },
  jobName: { type: String, trim: true, default: '' },
  material: { type: String, trim: true, default: '' },
  colour: { type: String, trim: true, default: '' },
  category: { type: String, trim: true },
  defaultUsageCycleDays: { type: Number, default: 30 },
  unitPrice: { type: Number, required: false, default: null },
  jobTimes: [jobTimeEntrySchema],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true }
}, {
  timestamps: true
});

// Auto-generate dimensionKey before saving
productSchema.pre('save', function (next) {
  if (this.widthMm != null && this.heightMm != null) {
    this.dimensionKey = `${this.widthMm}x${this.heightMm}`;
  }
  if (typeof next === 'function') {
    next();
  }
});

// Auto-generate dimensionKey on findOneAndUpdate
productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update) {
    const widthMm = update.widthMm !== undefined ? update.widthMm : update.$set?.widthMm;
    const heightMm = update.heightMm !== undefined ? update.heightMm : update.$set?.heightMm;
    if (widthMm != null && heightMm != null) {
      if (update.$set) {
        update.$set.dimensionKey = `${widthMm}x${heightMm}`;
      } else {
        update.dimensionKey = `${widthMm}x${heightMm}`;
      }
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

productSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Product', productSchema);
