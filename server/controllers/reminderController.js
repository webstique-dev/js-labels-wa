const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Activity = require('../models/Activity');
const User = require('../models/User');

// Calculate live reorder probability (0 - 100%) dynamically from expectedReorderDate
const getLiveReorderProbability = (customer) => {
  if (!customer || !customer.expectedReorderDate) {
    return customer?.reorderProbability ?? 50;
  }
  const expDate = new Date(customer.expectedReorderDate);
  if (isNaN(expDate.getTime())) {
    return customer?.reorderProbability ?? 50;
  }
  const now = new Date();
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let score = 0;
  if (diffDays <= 0 && diffDays >= -14) {
    score = 95 + diffDays;
  } else if (diffDays < -14) {
    score = Math.max(10, 80 + diffDays);
  } else if (diffDays <= 3) {
    score = 95 - (diffDays * 2);
  } else if (diffDays <= 14) {
    score = 88 - Math.round((diffDays - 3) * 1.6);
  } else if (diffDays <= 30) {
    score = 69 - Math.round((diffDays - 14) * 1.5);
  } else if (diffDays <= 60) {
    score = 44 - Math.round((diffDays - 30) * 0.8);
  } else {
    score = 15;
  }
  return Math.max(5, Math.min(100, Math.round(score)));
};

// Derive priority strictly from reorder probability percentage score
const derivePriority = (score) => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

// GET /api/reminders
const getReminders = async (req, res) => {
  try {
    const { priority, assignedTo } = req.query;

    let queryFilter = { expectedReorderDate: { $ne: null }, ...req.scopeFilter };

    if (assignedTo && req.user.role !== 'caller') {
      queryFilter.salesExecutive = assignedTo;
    }

    const customers = await Customer.find(queryFilter)
      .populate('salesExecutive', 'name email avatarUrl role');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Map customers into computed reminder objects
    let reminders = customers.map((c) => {
      const expDate = new Date(c.expectedReorderDate);
      const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const daysUntilReorder = Math.round((expDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
      const probScore = getLiveReorderProbability(c);
      const derivedPrio = derivePriority(probScore);

      return {
        _id: `rem-${c._id}`,
        customer: {
          _id: c._id,
          name: c.name,
          company: c.company,
          phone: c.phone,
          email: c.email,
          city: c.city,
          reorderProbability: probScore,
          expectedReorderDate: c.expectedReorderDate,
          salesExecutive: c.salesExecutive
        },
        daysUntilReorder,
        priority: derivedPrio,
        probabilityScore: probScore,
        isOverdue: daysUntilReorder < 0
      };
    });

    // Filter by priority if requested
    if (priority) {
      reminders = reminders.filter((r) => r.priority === priority.toLowerCase());
    }

    // Sort by daysUntilReorder ascending (most urgent/overdue first)
    reminders.sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);

    return res.json(reminders);
  } catch (error) {
    console.error('Error computing reminders:', error);
    return res.status(500).json({ message: 'Server error computing reminders' });
  }
};

// GET /api/reminders/summary
const getRemindersSummary = async (req, res) => {
  try {
    const queryFilter = { expectedReorderDate: { $ne: null }, ...req.scopeFilter };
    const customers = await Customer.find(queryFilter);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const summary = {
      total: customers.length,
      overdue: 0,
      high: 0,
      medium: 0,
      low: 0,
      completed: 0
    };

    for (const c of customers) {
      if (!c.expectedReorderDate) continue;
      const expDate = new Date(c.expectedReorderDate);
      if (isNaN(expDate.getTime())) continue;

      // Overdue if expected date is strictly before today
      if (expDate < todayStart) {
        summary.overdue += 1;
      }

      const probScore = getLiveReorderProbability(c);
      const prio = derivePriority(probScore);
      if (summary[prio] !== undefined) {
        summary[prio] += 1;
      }

      // Completed: Check if customer placed an order on/after their previous reorder window
      const recentOrder = await Order.findOne({
        customerId: c._id,
        orderDate: { $gte: new Date(expDate.getTime() - 14 * 24 * 60 * 60 * 1000) },
        status: { $ne: 'cancelled' }
      });
      if (recentOrder) {
        summary.completed += 1;
      }
    }

    return res.json(summary);
  } catch (error) {
    console.error('Error fetching reminders summary:', error);
    return res.status(500).json({ message: 'Server error fetching reminders summary' });
  }
};

// PATCH /api/reminders/:customerId/dismiss
const dismissReminder = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Log Activity Entry on Customer
    await Activity.create({
      relatedType: 'customer',
      relatedId: customer._id,
      type: 'status_change',
      description: `Reorder reminder acknowledged by ${req.user.name}`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Reminder acknowledged successfully' });
  } catch (error) {
    console.error('Error acknowledging reminder:', error);
    return res.status(500).json({ message: 'Server error acknowledging reminder' });
  }
};

// GET /api/reminders/leaderboard
const getRemindersLeaderboard = async (req, res) => {
  try {
    const customers = await Customer.find({ expectedReorderDate: { $ne: null } })
      .populate('salesExecutive', 'name email avatarUrl role');

    const execMap = {};
    const totalCount = customers.length;

    customers.forEach((c) => {
      const execName = c.salesExecutive?.name || 'Unassigned';
      const execId = c.salesExecutive?._id?.toString() || 'unassigned';

      if (!execMap[execId]) {
        execMap[execId] = {
          execId,
          name: execName,
          avatarUrl: c.salesExecutive?.avatarUrl,
          count: 0,
          percentage: 0
        };
      }
      execMap[execId].count += 1;
    });

    const leaderboard = Object.values(execMap).map((e) => ({
      ...e,
      percentage: totalCount > 0 ? Math.round((e.count / totalCount) * 100) : 0
    }));

    leaderboard.sort((a, b) => b.count - a.count);

    return res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching reminders leaderboard:', error);
    return res.status(500).json({ message: 'Server error fetching reminders leaderboard' });
  }
};

module.exports = {
  getReminders,
  getRemindersSummary,
  dismissReminder,
  getRemindersLeaderboard
};
