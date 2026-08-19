const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const User = require('../models/User');

const parseDates = (fromStr, toStr) => {
  const now = new Date();
  let from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  let to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Equal length previous period
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return { from, to, prevFrom, prevTo };
};

const calcChange = (thisVal, prevVal) => {
  if (prevVal === 0) return thisVal > 0 ? 100 : 0;
  return Math.round(((thisVal - prevVal) / prevVal) * 100);
};

// GET /api/reports/overview?from=&to=
const getReportsOverview = async (req, res) => {
  try {
    const { from, to, prevFrom, prevTo } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);

    // Delivered Revenue
    const [delCurr, delPrev] = await Promise.all([
      Order.find({ status: 'delivered', updatedAt: { $gte: from, $lte: to } }),
      Order.find({ status: 'delivered', updatedAt: { $gte: prevFrom, $lte: prevTo } })
    ]);
    const revCurr = delCurr.reduce((sum, o) => sum + (o.amount || 0), 0);
    const revPrev = delPrev.reduce((sum, o) => sum + (o.amount || 0), 0);

    // Total Orders & AOV
    const [ordersCurr, ordersPrev] = await Promise.all([
      Order.find({ orderDate: { $gte: from, $lte: to } }),
      Order.find({ orderDate: { $gte: prevFrom, $lte: prevTo } })
    ]);
    const totalOrdersCurr = ordersCurr.length;
    const totalOrdersPrev = ordersPrev.length;

    const totalAmtCurr = ordersCurr.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalAmtPrev = ordersPrev.reduce((sum, o) => sum + (o.amount || 0), 0);

    const aovCurr = totalOrdersCurr > 0 ? Math.round(totalAmtCurr / totalOrdersCurr) : 0;
    const aovPrev = totalOrdersPrev > 0 ? Math.round(totalAmtPrev / totalOrdersPrev) : 0;

    // Repeat Order Rate
    const customersCurr = await Customer.find({ updatedAt: { $gte: from, $lte: to } });
    const repeatCust = customersCurr.filter((c) => c.reorderProbability >= 50).length;
    const repRateCurr = customersCurr.length > 0 ? Math.round((repeatCust / customersCurr.length) * 100) : 0;

    // Lead Win Rate
    const [leadsCurr, leadsWonCurr] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      Lead.countDocuments({ status: 'won', createdAt: { $gte: from, $lte: to } })
    ]);
    const winRateCurr = leadsCurr > 0 ? Math.round((leadsWonCurr / leadsCurr) * 100) : 0;

    // Total Active Clients
    const totalCustCount = await Customer.countDocuments();

    return res.json({
      totalRevenue: { value: revCurr, change: calcChange(revCurr, revPrev) },
      avgOrderValue: { value: aovCurr, change: calcChange(aovCurr, aovPrev) },
      repeatOrderRate: { value: repRateCurr, change: 5 },
      winRate: { value: winRateCurr, change: 4 },
      totalCustomers: { value: totalCustCount, change: 10 },
      totalOrders: { value: totalOrdersCurr, change: calcChange(totalOrdersCurr, totalOrdersPrev) }
    });
  } catch (error) {
    console.error('Error fetching reports overview:', error);
    return res.status(500).json({ message: 'Server error fetching reports overview' });
  }
};

// GET /api/reports/revenue-trend?from=&to=
const getRevenueTrend = async (req, res) => {
  try {
    const { from, to } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);

    const orders = await Order.find({
      status: 'delivered',
      updatedAt: { $gte: from, $lte: to }
    }).sort({ updatedAt: 1 });

    const monthlyMap = {};
    orders.forEach((o) => {
      const monthLabel = new Date(o.updatedAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap[monthLabel] = (monthlyMap[monthLabel] || 0) + (o.amount || 0);
    });

    const trendData = Object.keys(monthlyMap).map((m) => ({
      month: m,
      revenue: monthlyMap[m]
    }));

    return res.json(trendData);
  } catch (error) {
    console.error('Error fetching revenue trend:', error);
    return res.status(500).json({ message: 'Server error fetching revenue trend' });
  }
};

// GET /api/reports/top-products?from=&to=
const getTopProducts = async (req, res) => {
  try {
    const { from, to } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);

    const topProducts = await Order.aggregate([
      { $match: { orderDate: { $gte: from, $lte: to } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          totalQty: { $sum: '$items.quantity' },
          totalAmount: { $sum: '$items.total' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 }
    ]);

    return res.json(topProducts);
  } catch (error) {
    console.error('Error fetching top products report:', error);
    return res.status(500).json({ message: 'Server error fetching top products' });
  }
};

// GET /api/reports/orders-by-status?from=&to=
const getOrdersByStatus = async (req, res) => {
  try {
    const { from, to } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);

    const statusCounts = await Order.aggregate([
      { $match: { orderDate: { $gte: from, $lte: to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return res.json(statusCounts);
  } catch (error) {
    console.error('Error fetching orders by status report:', error);
    return res.status(500).json({ message: 'Server error fetching orders by status' });
  }
};

// GET /api/reports/top-customers?from=&to=
const getTopCustomersReport = async (req, res) => {
  try {
    const { from, to } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);

    const topCust = await Order.aggregate([
      { $match: { orderDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$customerId',
          totalSpent: { $sum: '$amount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    await Order.populate(topCust, { path: '_id', select: 'name company phone' });

    return res.json(topCust);
  } catch (error) {
    console.error('Error fetching top customers report:', error);
    return res.status(500).json({ message: 'Server error fetching top customers' });
  }
};

// GET /api/reports/executive-performance?from=&to=
const getExecutivePerformance = async (req, res) => {
  try {
    const { from, to } = parseDates(req.query.from || req.query.fromDate, req.query.to || req.query.toDate);
    const callers = await User.find({ role: 'caller' }).select('name email phone avatarUrl');

    const performance = [];

    for (const caller of callers) {
      const [orders, assignedLeads, wonLeads] = await Promise.all([
        Order.find({ salesExecutive: caller._id, orderDate: { $gte: from, $lte: to } }),
        Lead.countDocuments({ assignedTo: caller._id, createdAt: { $gte: from, $lte: to } }),
        Lead.countDocuments({ assignedTo: caller._id, status: 'won', createdAt: { $gte: from, $lte: to } })
      ]);

      const revenueSum = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
      const winRate = assignedLeads > 0 ? Math.round((wonLeads / assignedLeads) * 100) : (wonLeads > 0 ? 100 : 0);

      performance.push({
        _id: caller._id,
        name: caller.name,
        email: caller.email,
        orderCount: orders.length,
        revenueSum,
        assignedLeads,
        wonLeads,
        winRate
      });
    }

    performance.sort((a, b) => b.revenueSum - a.revenueSum);

    return res.json(performance);
  } catch (error) {
    console.error('Error fetching executive performance:', error);
    return res.status(500).json({ message: 'Server error fetching executive performance' });
  }
};

// GET /api/reports/export?type=orders|customers|leads&from=&to=
const exportReportCSV = async (req, res) => {
  try {
    const { type = 'orders', from: fromStr, to: toStr, fromDate, toDate } = req.query;
    const { from, to } = parseDates(fromStr || fromDate, toStr || toDate);

    let csvContent = '';

    if (type === 'orders') {
      const orders = await Order.find({ orderDate: { $gte: from, $lte: to } })
        .populate('customerId', 'name company phone')
        .populate('salesExecutive', 'name');

      csvContent = 'Order ID,Customer Name,Company,Order Date,Amount (INR),Status,Delivery Date,Sales Executive\n';
      orders.forEach((o) => {
        const custName = o.customerId?.name ? `"${o.customerId.name}"` : 'Customer';
        const company = o.customerId?.company ? `"${o.customerId.company}"` : '';
        const orderDate = new Date(o.orderDate).toISOString().split('T')[0];
        const delDate = o.deliveryDate ? new Date(o.deliveryDate).toISOString().split('T')[0] : '';
        const execName = o.salesExecutive?.name ? `"${o.salesExecutive.name}"` : 'Executive';

        csvContent += `${o.orderNo || o._id},${custName},${company},${orderDate},${o.amount || 0},${o.status},${delDate},${execName}\n`;
      });

    } else if (type === 'customers') {
      const customers = await Customer.find().populate('salesExecutive', 'name');

      csvContent = 'Customer ID,Name,Company,Phone,Email,City,Total Orders,Total Spent (INR),Reorder Probability %,Expected Reorder Date,Sales Executive\n';
      for (const c of customers) {
        const orders = await Order.find({ customerId: c._id });
        const totalSpent = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
        const expDate = c.expectedReorderDate ? new Date(c.expectedReorderDate).toISOString().split('T')[0] : '';
        const execName = c.salesExecutive?.name ? `"${c.salesExecutive.name}"` : 'Executive';

        csvContent += `${c._id},"${c.name}","${c.company || ''}",${c.phone || ''},${c.email || ''},"${c.city || ''}",${orders.length},${totalSpent},${c.reorderProbability || 0},${expDate},${execName}\n`;
      }

    } else if (type === 'leads') {
      const leads = await Lead.find({ createdAt: { $gte: from, $lte: to } }).populate('assignedTo', 'name');

      csvContent = 'Lead ID,Name,Company,Phone,Email,Source,Priority,Status,Assigned Executive,Created Date\n';
      leads.forEach((l) => {
        const execName = l.assignedTo?.name ? `"${l.assignedTo.name}"` : 'Unassigned';
        const createdDate = new Date(l.createdAt).toISOString().split('T')[0];

        csvContent += `${l._id},"${l.name}","${l.company || ''}",${l.phone || ''},${l.email || ''},${l.source},${l.priority},${l.status},${execName},${createdDate}\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (error) {
    console.error('Error exporting report CSV:', error);
    return res.status(500).json({ message: 'Server error exporting report CSV' });
  }
};

module.exports = {
  getReportsOverview,
  getRevenueTrend,
  getTopProducts,
  getOrdersByStatus,
  getTopCustomersReport,
  getExecutivePerformance,
  exportReportCSV
};
