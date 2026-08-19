const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  unitPrice: { type: Number, required: true },
  defaultUsageCycleDays: { type: Number, enum: [30, 45], default: 30 }
}, {
  timestamps: true
});

productSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Product', productSchema);
