const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  widthMm: { type: Number, required: true },
  heightMm: { type: Number, required: true },
  dimensionKey: { type: String, trim: true, index: true },
  category: { type: String, trim: true },
  defaultUsageCycleDays: { type: Number, enum: [30, 45], default: 30 },
  unitPrice: { type: Number, required: false, default: null },
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
