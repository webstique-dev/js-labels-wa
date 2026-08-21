const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Activity = require('../models/Activity');

const Lead = require('../models/Lead');

// Sync Won Leads into Customer Documents so all won leads appear in Customer Directory
const syncWonLeadsToCustomers = async () => {
  try {
    const wonLeads = await Lead.find({ status: 'won' });
    for (const lead of wonLeads) {
      const existingCust = await Customer.findOne({ $or: [{ leadId: lead._id }, { phone: lead.phone }] });
      if (!existingCust) {
        await Customer.create({
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          leadId: lead._id,
          salesExecutive: lead.assignedTo,
          customerType: 'Regular',
          paymentTerms: '30 Days'
        });
      }
    }
  } catch (err) {
    console.warn('Error syncing won leads to customers:', err);
  }
};

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    await syncWonLeadsToCustomers();
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

// POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const { name, company, phone, email, gstNo, address, city, customerType, paymentTerms, creditLimit, tags } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    let cleanPhone = undefined;
    if (phone) {
      cleanPhone = phone.toString().replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
      }
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }
    }

    const customer = await Customer.create({
      name: name.trim(),
      company: company ? company.trim() : undefined,
      phone: cleanPhone || phone,
      email: email ? email.trim().toLowerCase() : undefined,
      gstNo,
      address,
      city,
      customerType: customerType || 'Regular',
      paymentTerms: paymentTerms || '30 Days',
      creditLimit: creditLimit || 100000,
      currentBalance: 0,
      tags: tags || ['Customer'],
      salesExecutive: req.user.id
    });

    await Activity.create({
      relatedType: 'customer',
      relatedId: customer._id,
      type: 'status_change',
      description: `New customer account created for ${customer.name}`,
      createdBy: req.user.id
    });

    return res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ message: 'Server error creating customer' });
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
      { $match: { customerId: customerObjId, status: { $ne: 'cancelled' } } },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: "$lineItems.name",
          name: { $first: "$lineItems.name" },
          totalQty: { $sum: "$lineItems.qty" },
          totalAmount: {
            $sum: {
              $cond: [
                { $gt: ["$lineItems.lineTotal", 0] },
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          }
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
      topProducts: topProducts || []
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

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customerOrders = await Order.find({ customerId: id }).select('_id');
    const orderIds = customerOrders.map(o => o._id);

    const queryFilter = {
      $or: [
        { relatedType: 'customer', relatedId: id },
        { relatedType: 'order', relatedId: { $in: orderIds } }
      ]
    };

    if (customer.leadId) {
      queryFilter.$or.push({ relatedType: 'lead', relatedId: customer.leadId });
    }

    const activities = await Activity.find(queryFilter)
      .populate('createdBy', 'name email avatarUrl role')
      .sort({ createdAt: -1 });

    return res.json(activities);
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
  createCustomer,
  getCustomerById,
  getCustomerSummary,
  getCustomerOrders,
  getCustomerTimeline,
  deleteCustomer
};
