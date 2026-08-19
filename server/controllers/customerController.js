const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Activity = require('../models/Activity');

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryFilter.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { city: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, total] = await Promise.all([
      Customer.find(queryFilter)
        .populate('salesExecutive', 'name email avatarUrl role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(queryFilter)
    ]);

    return res.json({
      customers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ message: 'Server error fetching customers' });
  }
};

// GET /api/customers/:id
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).setOptions({ includeDeleted: true })
      .populate('salesExecutive', 'name email phone avatarUrl role');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && customer.salesExecutive?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only view customers assigned to you' });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    return res.status(500).json({ message: 'Server error fetching customer detail' });
  }
};

// GET /api/customers/:id/summary
const getCustomerSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const customerObjId = new mongoose.Types.ObjectId(id);

    // Fetch basic order metrics
    const orders = await Order.find({ customerId: customerObjId }).sort({ orderDate: -1 });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const lastOrder = orders.length > 0 ? { orderDate: orders[0].orderDate, amount: orders[0].amount } : null;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    const repeatOrders = totalOrders > 1 ? totalOrders - 1 : 0;
    const repeatOrderRate = totalOrders > 0 ? Math.round((repeatOrders / totalOrders) * 100) : 0;

    // Aggregate Top Products across customer's orders
    const topProducts = await Order.aggregate([
      { $match: { customerId: customerObjId } },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: "$lineItems.name",
          name: { $first: "$lineItems.name" },
          totalQty: { $sum: "$lineItems.qty" },
          totalAmount: { $sum: { $multiply: ["$lineItems.qty", "$lineItems.price"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 }
    ]);

    return res.json({
      totalOrders,
      totalSpent,
      lastOrder,
      avgOrderValue,
      repeatOrders,
      repeatOrderRate,
      topProducts
    });
  } catch (error) {
    console.error('Error computing customer summary:', error);
    return res.status(500).json({ message: 'Server error computing customer summary' });
  }
};

// GET /api/customers/:id/orders
const getCustomerOrders = async (req, res) => {
  try {
    const { id } = req.params;

    const orders = await Order.find({ customerId: id })
      .populate('salesExecutive', 'name email avatarUrl')
      .sort({ orderDate: -1 });

    return res.json(orders);
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return res.status(500).json({ message: 'Server error fetching customer orders' });
  }
};

// GET /api/customers/:id/timeline
const getCustomerTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const [activities, orders] = await Promise.all([
      Activity.find({ relatedType: 'customer', relatedId: id })
        .populate('createdBy', 'name email avatarUrl role')
        .sort({ createdAt: -1 }),
      Order.find({ customerId: id }).sort({ orderDate: -1 })
    ]);

    // Map order updates to activity format
    const orderEvents = orders.map(o => ({
      _id: `ord-${o._id}`,
      type: 'status_change',
      description: `Order ${o.orderNo || ''} (${o.status.toUpperCase()}) created for ₹${o.amount.toLocaleString('en-IN')}`,
      createdAt: o.orderDate,
      createdBy: o.salesExecutive ? { name: 'Sales Executive' } : { name: 'System' }
    }));

    // Merge and sort newest first
    const combined = [...activities, ...orderEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json(combined);
  } catch (error) {
    console.error('Error fetching customer timeline:', error);
    return res.status(500).json({ message: 'Server error fetching customer timeline' });
  }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.softDelete(req.user.id);

    await Activity.create({
      relatedType: 'customer',
      relatedId: customer._id,
      type: 'status_change',
      description: `Customer ${customer.name} soft deleted`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({ message: 'Server error deleting customer' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  getCustomerSummary,
  getCustomerOrders,
  getCustomerTimeline,
  deleteCustomer
};
