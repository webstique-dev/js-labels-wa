const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const Escalation = require('../models/Escalation');
const User = require('../models/User');

const calcChange = (thisVal, lastVal) => {
  if (!lastVal || lastVal === 0) return thisVal > 0 ? 100 : 0;
  return Math.round(((thisVal - lastVal) / lastVal) * 100);
};

// GET /api/dashboard/summary
const getDashboardSummary = async (req, res) => {
  try {
    const scope = req.scopeFilter || {};
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. Total Leads
    const totalLeadsAllTime = await Lead.countDocuments(scope);
    const leadsThisMonth = await Lead.countDocuments({ ...scope, createdAt: { $gte: thisMonthStart } });
    const leadsPrevMonth = await Lead.countDocuments({ ...scope, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const leadsChange = calcChange(leadsThisMonth, leadsPrevMonth);

    // 2. Converted Customers (status: 'won')
    const wonLeadsAllTime = await Lead.countDocuments({ ...scope, status: 'won' });
    const wonThisMonth = await Lead.countDocuments({ ...scope, status: 'won', updatedAt: { $gte: thisMonthStart } });
    const wonPrevMonth = await Lead.countDocuments({ ...scope, status: 'won', updatedAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const wonChange = calcChange(wonThisMonth, wonPrevMonth);

    // 3. Orders Delivered
    const custScope = req.user.role === 'caller' ? { salesExecutive: req.user.id } : {};
    const deliveredAllTime = await Order.countDocuments({ ...custScope, status: 'delivered' });
    const deliveredThisMonth = await Order.countDocuments({ ...custScope, status: 'delivered', updatedAt: { $gte: thisMonthStart } });
    const deliveredPrevMonth = await Order.countDocuments({ ...custScope, status: 'delivered', updatedAt: { $gte: prevMonthStart, $lte: prevMonthEnd } });
    const deliveredChange = calcChange(deliveredThisMonth, deliveredPrevMonth);

    // 4. Repeat Orders (Customers with >1 order)
    const customers = await Customer.find(custScope);
    let repeatCustCount = 0;
    for (const c of customers) {
      const orderCount = await Order.countDocuments({ customerId: c._id });
      if (orderCount > 1) repeatCustCount++;
    }

    return res.json({
      totalLeads: { count: totalLeadsAllTime, change: leadsChange },
      convertedCustomers: { count: wonLeadsAllTime, change: wonChange },
      ordersDelivered: { count: deliveredAllTime, change: deliveredChange },
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
    const scope = req.scopeFilter || {};

    const [totalLeads, contacted, followUp, won] = await Promise.all([
      Lead.countDocuments(scope),
      Lead.countDocuments({ ...scope, status: { $in: ['contacted', 'follow_up', 'won', 'cancelled'] } }),
      Lead.countDocuments({ ...scope, status: 'follow_up' }),
      Lead.countDocuments({ ...scope, status: 'won' })
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
    const scope = req.scopeFilter || {};
    const now = new Date();
    const currentDay = now.getDate();
    const trend = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = monthNames[now.getMonth()];

    for (let day = 1; day <= Math.min(currentDay, 15); day++) {
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59);

      const [totalUpToDay, wonUpToDay] = await Promise.all([
        Lead.countDocuments({ ...scope, createdAt: { $lte: dayEnd } }),
        Lead.countDocuments({ ...scope, status: 'won', createdAt: { $lte: dayEnd } })
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
    const activities = await Activity.find()
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const followUpScope = req.user.role === 'caller' ? { assignedTo: req.user.id } : {};
    const custScope = req.user.role === 'caller' ? { salesExecutive: req.user.id } : {};

    // 1. Overdue Follow-ups
    const overdueFollowups = await FollowUp.countDocuments({
      ...followUpScope,
      status: 'open',
      dueDate: { $lt: now }
    });

    // 2. Due Today
    const dueToday = await FollowUp.countDocuments({
      ...followUpScope,
      status: 'open',
      dueDate: { $gte: todayStart, $lte: todayEnd }
    });

    // 3. Upcoming Reminders (7 days)
    const upcomingReminders = await Customer.countDocuments({
      ...custScope,
      expectedReorderDate: { $gte: now, $lte: in7Days }
    });

    // 4. Reorder Forecast (Sum of orders for customers due in 30 days)
    const dueCustomers30Days = await Customer.find({
      ...custScope,
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

// GET /api/dashboard/needs-review (Super Admin / Manager)
const getDashboardNeedsReview = async (req, res) => {
  try {
    const escalations = await Escalation.find({ stage: 'md_review', resolvedAt: null })
      .populate({
        path: 'followUpId',
        populate: [
          { path: 'assignedTo', select: 'name email phone avatarUrl role' },
          { path: 'relatedId' }
        ]
      })
      .sort({ updatedAt: -1 });

    const now = new Date();

    const formatted = escalations.map((e) => {
      const f = e.followUpId || {};
      const hoursOverdue = f.dueDate ? Math.floor((now.getTime() - new Date(f.dueDate).getTime()) / (1000 * 60 * 60)) : 72;

      return {
        _id: e._id,
        followUpId: f._id,
        relatedType: f.relatedType,
        relatedRecord: f.relatedId,
        assignedTo: f.assignedTo,
        hoursOverdue,
        triggeredAt: e.triggeredAt,
        notes: f.notes
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('Error fetching needs review escalations:', error);
    return res.status(500).json({ message: 'Server error fetching needs review escalations' });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardFunnel,
  getDashboardConversionTrend,
  getDashboardActivityFeed,
  getDashboardAlerts,
  getDashboardNeedsReview
};

