const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const customerSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String },
  email: { type: String },
  gstNo: { type: String },
  address: { type: String },
  city: { type: String },
  customerType: { type: String },
  paymentTerms: { type: String },
  creditLimit: { type: Number },
  currentBalance: { type: Number, default: 0 },
  source: { type: String },
  priority: { type: String },
  salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reorderProbability: { type: Number, default: 0 },
  expectedReorderDate: { type: Date }
}, {
  timestamps: true
});

customerSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Customer', customerSchema);
