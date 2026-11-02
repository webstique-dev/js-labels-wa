const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const customerSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String },
  phone2: { type: String, default: '' },
  email: { type: String },
  gstNo: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  country: { type: String, default: 'India' },
  billingAttention: { type: String, default: '' },
  billingPhone: { type: String, default: '' },
  customerType: { type: String, default: 'Regular' },
  paymentTerms: { type: String, default: '30 Days' },
  creditLimit: { type: Number, default: 100000 },
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
