const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');

const lineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String },
  qty: { type: Number },
  price: { type: Number }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, unique: true, sparse: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  orderDate: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'production', 'quality_check', 'dispatched', 'delivered', 'cancelled'],
    default: 'pending'
  },
  deliveryDate: { type: Date },
  salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usageCycleDays: { type: Number },
  lineItems: [lineItemSchema]
}, {
  timestamps: true
});

orderSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Order', orderSchema);
