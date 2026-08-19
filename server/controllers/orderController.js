const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 50 } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (status) queryFilter.status = status;

    if (from || to) {
      queryFilter.orderDate = {};
      if (from) queryFilter.orderDate.$gte = new Date(from);
      if (to) queryFilter.orderDate.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(queryFilter)
        .populate('customerId', 'name company phone email city')
        .populate('salesExecutive', 'name email avatarUrl role')
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(queryFilter)
    ]);

    return res.json({
      orders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Server error fetching orders' });
  }
};

// GET /api/orders/summary
const getOrdersSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (from || to) {
      queryFilter.orderDate = {};
      if (from) queryFilter.orderDate.$gte = new Date(from);
      if (to) queryFilter.orderDate.$lte = new Date(to);
    }

    const orders = await Order.find(queryFilter);

    const summary = {
      totalOrders: orders.length,
      pending: 0,
      confirmed: 0,
      production: 0,
      quality_check: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0
    };

    orders.forEach((o) => {
      if (summary[o.status] !== undefined) {
        summary[o.status] += 1;
      }
      if (o.status !== 'cancelled') {
        summary.totalRevenue += (o.amount || 0);
      }
    });

    return res.json(summary);
  } catch (error) {
    console.error('Error computing order summary:', error);
    return res.status(500).json({ message: 'Server error computing order summary' });
  }
};

// POST /api/orders
const createOrder = async (req, res) => {
  try {
    let { customerId, newCustomer, lineItems, deliveryDate, usageCycleDays, leadId } = req.body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }

    // 1. If customerId is not provided, create Customer inline
    if (!customerId) {
      if (!newCustomer || !newCustomer.name || !newCustomer.phone) {
        return res.status(400).json({ message: 'Customer selection or new customer details are required' });
      }

      const createdCustomer = await Customer.create({
        name: newCustomer.name,
        company: newCustomer.company,
        phone: newCustomer.phone,
        email: newCustomer.email,
        city: newCustomer.city || 'Mumbai',
        address: newCustomer.address,
        gstNo: newCustomer.gstNo,
        leadId: leadId || newCustomer.leadId,
        salesExecutive: req.user.id,
        reorderProbability: 80,
        expectedReorderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      customerId = createdCustomer._id;
    }

    // 2. Fetch products and compute line items & total amount
    let computedAmount = 0;
    let defaultUsageCycle = 30;
    const processedLineItems = [];

    for (const item of lineItems) {
      const prod = await Product.findById(item.productId);
      if (!prod) {
        return res.status(400).json({ message: `Product not found for ID: ${item.productId}` });
      }

      const qty = parseInt(item.qty) || 1;
      const price = item.price !== undefined ? parseFloat(item.price) : prod.unitPrice;
      const lineTotal = qty * price;
      computedAmount += lineTotal;

      if (prod.defaultUsageCycleDays) {
        defaultUsageCycle = prod.defaultUsageCycleDays;
      }

      processedLineItems.push({
        productId: prod._id,
        name: prod.name,
        qty,
        price
      });
    }

    // 3. Auto-generate Order Number
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;

    // 4. Create Order
    const newOrder = await Order.create({
      orderNo,
      customerId,
      orderDate: new Date(),
      amount: computedAmount,
      status: 'confirmed',
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      salesExecutive: req.user.id,
      usageCycleDays: usageCycleDays || defaultUsageCycle,
      lineItems: processedLineItems
    });

    // 5. Create Activity Entry for Customer
    await Activity.create({
      relatedType: 'customer',
      relatedId: customerId,
      type: 'status_change',
      description: `Order ${orderNo} created for ₹${computedAmount.toLocaleString('en-IN')}`,
      createdBy: req.user.id
    });

    // 6. If converted from Lead, update Lead status to 'won'
    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (lead) {
        lead.status = 'won';
        await lead.save();

        await Activity.create({
          relatedType: 'lead',
          relatedId: leadId,
          type: 'status_change',
          description: `Lead converted to Order ${orderNo}`,
          createdBy: req.user.id
        });
      }
    }

    const populatedOrder = await Order.findById(newOrder._id)
      .populate('customerId', 'name company phone email city')
      .populate('salesExecutive', 'name email avatarUrl role');

    return res.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ message: 'Server error creating order' });
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'production', 'quality_check', 'dispatched', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && order.salesExecutive?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own orders' });
    }

    const oldStatus = order.status;
    order.status = status;

    // CRITICAL: Delivered status automation
    if (status === 'delivered') {
      if (!order.deliveryDate) {
        order.deliveryDate = new Date();
      }

      const cycleDays = order.usageCycleDays || 30;
      const expectedReorderDate = new Date(order.deliveryDate.getTime() + (cycleDays * 24 * 60 * 60 * 1000));

      // Update related Customer's expectedReorderDate
      const customer = await Customer.findById(order.customerId);
      if (customer) {
        customer.expectedReorderDate = expectedReorderDate;
        customer.reorderProbability = Math.min(100, (customer.reorderProbability || 50) + 15);
        await customer.save();

        await Activity.create({
          relatedType: 'customer',
          relatedId: customer._id,
          type: 'status_change',
          description: `Order ${order.orderNo || ''} delivered. Next expected reorder date set to ${expectedReorderDate.toLocaleDateString('en-IN')}`,
          createdBy: req.user.id
        });
      }
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customerId', 'name company phone email city')
      .populate('salesExecutive', 'name email avatarUrl role');

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ message: 'Server error updating order status' });
  }
};

// DELETE /api/orders/:id
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.softDelete(req.user.id);

    await Activity.create({
      relatedType: 'customer',
      relatedId: order.customerId,
      type: 'status_change',
      description: `Order ${order.orderNo || ''} was deleted`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ message: 'Server error deleting order' });
  }
};

module.exports = {
  getOrders,
  getOrdersSummary,
  createOrder,
  updateOrderStatus,
  deleteOrder
};
