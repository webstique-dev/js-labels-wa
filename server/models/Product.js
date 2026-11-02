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
  widthMm: { type: Number, required: false, default: 0 },
  heightMm: { type: Number, required: false, default: 0 },
  unit: { type: String, enum: ['MM', 'MTR'], default: 'MM', uppercase: true, trim: true },
  dimensionKey: { type: String, trim: true, index: true },
  jobName: { type: String, trim: true, default: '' },
  material: { type: String, trim: true, default: '' },
  colour: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: 'General' },
  defaultUsageCycleDays: { type: Number, default: 30 },
  unitPrice: { type: Number, required: false, default: null },
  description: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  jobTimes: [jobTimeEntrySchema],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true }
}, {
  timestamps: true
});

// Auto-generate dimensionKey before saving
productSchema.pre('save', function (next) {
  const unit = (this.unit || 'MM').toUpperCase();
  if (this.widthMm != null && this.heightMm != null && (this.widthMm > 0 || this.heightMm > 0)) {
    this.dimensionKey = unit === 'MTR' ? `${this.widthMm}x${this.heightMm} MTR` : `${this.widthMm}x${this.heightMm}`;
  } else if (!this.dimensionKey) {
    this.dimensionKey = 'N/A';
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
    const unit = (update.unit !== undefined ? update.unit : update.$set?.unit) || 'MM';
    if (widthMm != null && heightMm != null) {
      if (widthMm > 0 || heightMm > 0) {
        const isMtr = String(unit).toUpperCase() === 'MTR';
        const key = isMtr ? `${widthMm}x${heightMm} MTR` : `${widthMm}x${heightMm}`;
        if (update.$set) {
          update.$set.dimensionKey = key;
        } else {
          update.dimensionKey = key;
        }
      } else {
        if (update.$set) {
          update.$set.dimensionKey = 'N/A';
        } else {
          update.dimensionKey = 'N/A';
        }
      }
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

productSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Product', productSchema);
