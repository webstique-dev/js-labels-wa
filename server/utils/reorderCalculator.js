const Order = require('../models/Order');

/**
 * Calculates customer reorder probability score (0 - 100)
 * based on order history and expected reorder date.
 */
const calculateCustomerReorderProbability = async (customerId, expectedReorderDate) => {
  if (!expectedReorderDate) return 0;

  try {
    const expDate = new Date(expectedReorderDate);
    if (isNaN(expDate.getTime())) return 0;

    const pastOrdersCount = await Order.countDocuments({ customerId, status: { $ne: 'cancelled' } });
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let score = 0;

    if (diffDays <= 0 && diffDays >= -14) {
      // Due today or overdue up to 14 days -> High urgency (90 - 95%)
      score = 95 + diffDays;
    } else if (diffDays < -14) {
      // Overdue by > 2 weeks -> Score gradually drops over time
      score = Math.max(10, 80 + diffDays);
    } else if (diffDays <= 3) {
      // Due in 1 to 3 days -> 89 - 95%
      score = 95 - (diffDays * 2);
    } else if (diffDays <= 14) {
      // 4 to 14 days away -> 70 - 88%
      score = 88 - Math.round((diffDays - 3) * 1.6);
    } else if (diffDays <= 30) {
      // 15 to 30 days away -> 45 - 69%
      score = 69 - Math.round((diffDays - 14) * 1.5);
    } else if (diffDays <= 60) {
      // 31 to 60 days away -> 20 - 44%
      score = 44 - Math.round((diffDays - 30) * 0.8);
    } else {
      // > 60 days away -> 15%
      score = 15;
    }

    if (pastOrdersCount > 2) {
      score += 5;
    }

    return Math.max(5, Math.min(100, Math.round(score)));
  } catch (err) {
    console.error('Error calculating customer reorder probability:', err);
    return 0;
  }
};

module.exports = {
  calculateCustomerReorderProbability
};
