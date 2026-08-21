const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const lineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String },
  description: { type: String },
  qty: { type: Number },
  rate: { type: Number },
  price: { type: Number },
  lineTotal: { type: Number }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, unique: true, sparse: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  orderDate: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'production', 'quality_check', 'dispatched', 'delivered', 'cancelled'],
    default: 'confirmed'
  },
  deliveryDate: { type: Date },
  expectedReorderDate: { type: Date },
  isExpectedReorderDateOverridden: { type: Boolean, default: false },
  salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usageCycleDays: { type: Number },
  poNumber: { type: String },
  advanceReceived: { type: Boolean, default: false },
  advanceAmount: { type: Number, default: 0 },
  deliveryAddress: { type: String },
  notes: { type: String },
  lineItems: [lineItemSchema]
}, {
  timestamps: true
});

orderSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Order', orderSchema);
