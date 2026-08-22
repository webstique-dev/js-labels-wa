const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const User = require('../models/User');

const calcChange = (thisVal, lastVal) => {
  if (!lastVal || lastVal === 0) return thisVal > 0 ? 100 : 0;
  return Math.round(((thisVal - lastVal) / lastVal) * 100);
};

// Helper: Build query filter objects based on request parameters
const buildFilters = (req) => {
  const scope = req.scopeFilter || {};
  const { period, assignedTo, source, startDate, endDate } = req.query;

  const leadFilter = { ...scope };
  const custFilter = req.user.role === 'caller' ? { salesExecutive: req.user.id } : {};
  const followUpFilter = req.user.role === 'caller' ? { assignedTo: req.user.id } : {};
  const orderFilter = req.user.role === 'caller' ? { salesExecutive: req.user.id } : {};
  const activityFilter = {};

  // Executive / Caller Filter (for Super Admin / Manager)
  if (assignedTo && assignedTo !== 'all' && req.user.role !== 'caller') {
    leadFilter.assignedTo = assignedTo;
    custFilter.salesExecutive = assignedTo;
    followUpFilter.assignedTo = assignedTo;
    orderFilter.salesExecutive = assignedTo;
    activityFilter.createdBy = assignedTo;
  }

  // Lead / Customer Source Filter
  if (source && source !== 'all') {
    leadFilter.source = source;
    custFilter.source = source;
  }

  // Date Range / Period Filter
  let dateQuery = null;
  const now = new Date();

  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    dateQuery = { $gte: s, $lte: e };
  } else if (period && period !== 'all_time') {
    if (period === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1);
      dateQuery = { $gte: s, $lte: e };
    } else if (period === 'this_week') {
      const dayOfWeek = now.getDay() || 7;
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek - 1));
      dateQuery = { $gte: s };
    } else if (period === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      dateQuery = { $gte: s };
    } else if (period === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const s = new Date(now.getFullYear(), qMonth, 1);
      dateQuery = { $gte: s };
    } else if (period === 'this_year') {
      const s = new Date(now.getFullYear(), 0, 1);
      dateQuery = { $gte: s };
    }
  }

  if (dateQuery) {
    leadFilter.createdAt = dateQuery;
    custFilter.createdAt = dateQuery;
    orderFilter.createdAt = dateQuery;
    activityFilter.createdAt = dateQuery;
  }

  return { leadFilter, custFilter, followUpFilter, orderFilter, activityFilter };
};

// GET /api/dashboard/summary
const getDashboardSummary = async (req, res) => {
  try {
    const { leadFilter, custFilter, orderFilter } = buildFilters(req);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. Total Leads
    const totalLeadsCount = await Lead.countDocuments(leadFilter);
    const leadsThisMonth = await Lead.countDocuments({ ...leadFilter, createdAt: { $gte: thisMonthStart } });
    const leadsPrevMonth = await Lead.countDocuments({ ...leadFilter, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const leadsChange = calcChange(leadsThisMonth, leadsPrevMonth);

    // 2. Converted Customers (status: 'won')
    const wonLeadsCount = await Lead.countDocuments({ ...leadFilter, status: 'won' });
    const wonThisMonth = await Lead.countDocuments({ ...leadFilter, status: 'won', updatedAt: { $gte: thisMonthStart } });
    const wonPrevMonth = await Lead.countDocuments({ ...leadFilter, status: 'won', updatedAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const wonChange = calcChange(wonThisMonth, wonPrevMonth);

    // 3. Orders Delivered
    const deliveredCount = await Order.countDocuments({ ...orderFilter, status: 'delivered' });
    const deliveredThisMonth = await Order.countDocuments({ ...orderFilter, status: 'delivered', updatedAt: { $gte: thisMonthStart } });
    const deliveredPrevMonth = await Order.countDocuments({ ...orderFilter, status: 'delivered', updatedAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const deliveredChange = calcChange(deliveredThisMonth, deliveredPrevMonth);

    // 4. Repeat Orders (Customers with >1 order)
    const customers = await Customer.find(custFilter);
    let repeatCustCount = 0;
    for (const c of customers) {
      const orderCount = await Order.countDocuments({ customerId: c._id });
      if (orderCount > 1) repeatCustCount++;
    }

    return res.json({
      totalLeads: { count: totalLeadsCount, change: leadsChange },
      convertedCustomers: { count: wonLeadsCount, change: wonChange },
      ordersDelivered: { count: deliveredCount, change: deliveredChange },
      repeatOrders: { count: repeatCustCount, change: 0 }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({ message: 'Server error fetching dashboard summary' });
  }
};

// GET /api/dashboard/funnel
const getDashboardFunnel = async (req, res) => {
  try {
    const { leadFilter } = buildFilters(req);

    const [totalLeads, contacted, followUp, won] = await Promise.all([
      Lead.countDocuments(leadFilter),
      Lead.countDocuments({ ...leadFilter, status: { $in: ['contacted', 'follow_up', 'won', 'cancelled'] } }),
      Lead.countDocuments({ ...leadFilter, status: 'follow_up' }),
      Lead.countDocuments({ ...leadFilter, status: 'won' })
    ]);

    return res.json({
      leads: totalLeads,
      contacted: contacted,
      followUp: followUp,
      orderReceived: won,
      won: won
    });
  } catch (error) {
    console.error('Error fetching dashboard funnel:', error);
    return res.status(500).json({ message: 'Server error fetching dashboard funnel' });
  }
};

// GET /api/dashboard/conversion-trend
const getDashboardConversionTrend = async (req, res) => {
  try {
    const { leadFilter } = buildFilters(req);
    const now = new Date();
    const currentDay = now.getDate();
    const trend = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = monthNames[now.getMonth()];

    for (let day = 1; day <= Math.min(currentDay, 15); day++) {
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59);
      const dayLeadFilter = { ...leadFilter };
      if (!dayLeadFilter.createdAt) {
        dayLeadFilter.createdAt = { $lte: dayEnd };
      }

      const [totalUpToDay, wonUpToDay] = await Promise.all([
        Lead.countDocuments(dayLeadFilter),
        Lead.countDocuments({ ...dayLeadFilter, status: 'won' })
      ]);

      const rate = totalUpToDay > 0 ? Math.round((wonUpToDay / totalUpToDay) * 100) : 0;

      trend.push({
        day: `${monthLabel} ${day}`,
        totalLeads: totalUpToDay,
        wonLeads: wonUpToDay,
        conversionRate: rate
      });
    }

    return res.json(trend);
  } catch (error) {
    console.error('Error fetching conversion trend:', error);
    return res.status(500).json({ message: 'Server error fetching conversion trend' });
  }
};

// GET /api/dashboard/activity-feed?limit=10
const getDashboardActivityFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { activityFilter } = buildFilters(req);

    const activities = await Activity.find(activityFilter)
      .populate('createdBy', 'name email avatarUrl role')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(activities);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return res.status(500).json({ message: 'Server error fetching activity feed' });
  }
};

// GET /api/dashboard/alerts
const getDashboardAlerts = async (req, res) => {
  try {
    const { followUpFilter, custFilter } = buildFilters(req);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. Overdue Follow-ups
    const overdueFollowups = await FollowUp.countDocuments({
      ...followUpFilter,
      status: 'open',
      dueDate: { $lt: now }
    });

    // 2. Due Today
    const dueToday = await FollowUp.countDocuments({
      ...followUpFilter,
      status: 'open',
      dueDate: { $gte: todayStart, $lte: todayEnd }
    });

    // 3. Upcoming Reminders (7 days)
    const upcomingReminders = await Customer.countDocuments({
      ...custFilter,
      expectedReorderDate: { $gte: now, $lte: in7Days }
    });

    // 4. Reorder Forecast (Sum of orders for customers due in 30 days)
    const dueCustomers30Days = await Customer.find({
      ...custFilter,
      expectedReorderDate: { $gte: now, $lte: in30Days }
    });

    let reorderForecastAmount = 0;
    for (const c of dueCustomers30Days) {
      const orders = await Order.find({ customerId: c._id });
      if (orders.length > 0) {
        const totalSpent = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
        reorderForecastAmount += Math.round(totalSpent / orders.length);
      }
    }

    return res.json({
      overdueFollowups,
      dueToday,
      upcomingReminders,
      reorderForecast: reorderForecastAmount
    });
  } catch (error) {
    console.error('Error fetching dashboard alerts:', error);
    return res.status(500).json({ message: 'Server error fetching dashboard alerts' });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardFunnel,
  getDashboardConversionTrend,
  getDashboardActivityFeed,
  getDashboardAlerts
};

