/**
 * Computes live reorder probability (0 - 100%) based on
 * the number of days remaining from today until expectedReorderDate.
 */
export const getLiveReorderProbability = (customer) => {
  if (!customer || !customer.expectedReorderDate) {
    return customer?.reorderProbability ?? 0;
  }

  const expDate = new Date(customer.expectedReorderDate);
  if (isNaN(expDate.getTime())) {
    return customer?.reorderProbability ?? 0;
  }

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

  const ordersCount = customer.totalOrders || customer.ordersCount || customer.pastOrdersCount || 0;
  if (ordersCount > 2) {
    score += 5;
  }

  return Math.max(5, Math.min(100, Math.round(score)));
};

/**
 * Returns progress bar background color based on probability score:
 * High (>=80%): RED (urgent)
 * Mid (50-79%): ORANGE (warning)
 * Low (<50%): GREEN (safe)
 */
export const getProbabilityColorClass = (score) => {
  const safeScore = score ?? 0;
  if (safeScore >= 80) return 'bg-red-500';
  if (safeScore >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
};

/**
 * Returns text color class based on probability score:
 * High (>=80%): RED
 * Mid (50-79%): ORANGE
 * Low (<50%): GREEN
 */
export const getProbabilityTextColorClass = (score) => {
  const safeScore = score ?? 0;
  if (safeScore >= 80) return 'text-red-600 font-bold';
  if (safeScore >= 50) return 'text-amber-600 font-bold';
  return 'text-emerald-600 font-bold';
};

/**
 * Returns badge styling based on probability score:
 * High (>=80%): RED badge
 * Mid (50-79%): ORANGE badge
 * Low (<50%): GREEN badge
 */
export const getProbabilityBadgeClass = (score) => {
  const safeScore = score ?? 0;
  if (safeScore >= 80) return 'bg-red-50 text-red-700 border-red-200';
  if (safeScore >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

/**
 * Returns button styling matching reorder priority:
 * High (>=80%): RED button
 * Mid (50-79%): ORANGE button
 * Low (<50%): GREEN button
 */
export const getOrderButtonClass = (score) => {
  const safeScore = score ?? 0;
  if (safeScore >= 80) return 'bg-red-600 hover:bg-red-700 text-white';
  if (safeScore >= 50) return 'bg-amber-500 hover:bg-amber-600 text-white';
  return 'bg-emerald-600 hover:bg-emerald-700 text-white';
};
