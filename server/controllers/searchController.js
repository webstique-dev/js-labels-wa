const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Product = require('../models/Product');

// GET /api/search?q=
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim() || q.trim().length < 2) {
      return res.json({ leads: [], customers: [], orders: [], products: [] });
    }

    const regex = new RegExp(q.trim(), 'i');

    const [leads, customers, orders, products] = await Promise.all([
      Lead.find({
        $or: [
          { name: regex },
          { company: regex },
          { phone: regex },
          { email: regex }
        ]
      }).limit(5),

      Customer.find({
        $or: [
          { name: regex },
          { company: regex },
          { phone: regex },
          { email: regex },
          { city: regex }
        ]
      }).limit(5),

      Order.find({
        orderNo: regex
      }).populate('customerId', 'name company').limit(5),

      Product.find({
        $or: [
          { name: regex },
          { category: regex }
        ]
      }).limit(5)
    ]);

    return res.json({ leads, customers, orders, products });
  } catch (error) {
    console.error('Error performing global search:', error);
    return res.status(500).json({ message: 'Server error performing search' });
  }
};

module.exports = {
  globalSearch
};
