const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatYearMonth = (yearMonthStr) => {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr || 'Unknown';
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
};

/**
 * Core Helper: Computes a trailing-average forecast range for a single dimensionKey
 */
const computeDimensionForecast = async (dimensionKey, trailingMonthsCount = 2, targetDate = new Date()) => {
  const cleanDimKey = dimensionKey.trim();
  const N = Math.max(1, Math.min(parseInt(trailingMonthsCount, 10) || 2, 12));

  const now = targetDate instanceof Date && !isNaN(targetDate.getTime()) ? targetDate : new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const forecastForMonth = formatYearMonth(`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`);

  // 1. Fetch completed calendar months strictly before current in-progress month
  const completedMonthsAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": cleanDimKey
      }
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": cleanDimKey
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m",
            date: { $ifNull: ["$orderDate", "$createdAt"] }
          }
        },
        totalQty: { $sum: "$lineItems.qty" },
        distinctOrders: { $addToSet: "$_id" }
      }
    },
    {
      $match: {
        _id: { $lt: currentYearMonth } // Strictly completed calendar months
      }
    },
    {
      $project: {
        _id: 0,
        yearMonth: "$_id",
        totalQty: 1,
        orderCount: { $size: "$distinctOrders" }
      }
    },
    { $sort: { yearMonth: -1 } },
    { $limit: N }
  ]);

  // Sort chronological (oldest to newest)
  const trailingMonths = completedMonthsAgg.reverse().map((item) => ({
    yearMonth: item.yearMonth,
    month: formatYearMonth(item.yearMonth),
    totalQty: item.totalQty,
    orderCount: item.orderCount
  }));

  // 2. Fetch associated friendly product names and categories
  const products = await Product.find({
    $or: [{ dimensionKey: cleanDimKey }, { $expr: { $eq: [{ $concat: [{ $toString: "$widthMm" }, "x", { $toString: "$heightMm" }] }, cleanDimKey] } }],
    isDeleted: { $ne: true }
  });

  const productNames = Array.from(new Set(products.map(p => p.name).filter(Boolean)));
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // If no product found in catalog, fallback to any names recorded in line items
  if (productNames.length === 0) {
    const recordedNameSample = await Order.findOne({ "lineItems.dimensionKey": cleanDimKey }, { "lineItems.$": 1 });
    if (recordedNameSample?.lineItems?.[0]?.name) {
      productNames.push(recordedNameSample.lineItems[0].name);
    }
  }

  // 3. Compute Trailing Average and Forecast Range
  const availableMonthsCount = trailingMonths.length;

  if (availableMonthsCount === 0) {
    return {
      dimensionKey: cleanDimKey,
      forecastForMonth,
      trailingMonthsCount: N,
      trailingMonths: [],
      sumTrailing: 0,
      averagePerMonth: null,
      forecastRangeLow: null,
      forecastRangeHigh: null,
      lowConfidence: true,
      insufficientData: true,
      productNames,
      categories,
      topContributingCustomers: []
    };
  }

  const individualQtys = trailingMonths.map(m => m.totalQty);
  const sumTrailing = individualQtys.reduce((sum, q) => sum + q, 0);
  const averagePerMonth = Math.round(sumTrailing / availableMonthsCount);

  let forecastRangeLow;
  let forecastRangeHigh;
  let lowConfidence = false;

  if (availableMonthsCount === 1) {
    forecastRangeLow = individualQtys[0];
    forecastRangeHigh = individualQtys[0];
    lowConfidence = true; // Flag low confidence when only 1 completed month exists
  } else {
    forecastRangeLow = Math.min(...individualQtys);
    forecastRangeHigh = Math.max(...individualQtys);
    lowConfidence = false;
  }

  // 4. Top Contributing Customers from the most recent completed month
  const mostRecentCompleted = trailingMonths[trailingMonths.length - 1];
  let topContributingCustomers = [];

  if (mostRecentCompleted?.yearMonth) {
    const topCustAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.dimensionKey": cleanDimKey
        }
      },
      {
        $addFields: {
          orderYearMonth: {
            $dateToString: {
              format: "%Y-%m",
              date: { $ifNull: ["$orderDate", "$createdAt"] }
            }
          }
        }
      },
      {
        $match: {
          orderYearMonth: mostRecentCompleted.yearMonth
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.dimensionKey": cleanDimKey
        }
      },
      {
        $group: {
          _id: "$customerId",
          qty: { $sum: "$lineItems.qty" }
        }
      },
      { $sort: { qty: -1 } },
      { $limit: 5 }
    ]);

    if (topCustAgg.length > 0) {
      const custIds = topCustAgg.map(c => c._id).filter(Boolean);
      const custDocs = await Customer.find({ _id: { $in: custIds } });
      const custMap = {};
      custDocs.forEach(c => { custMap[c._id.toString()] = c; });

      topContributingCustomers = topCustAgg.map(item => {
        const doc = custMap[item._id?.toString()] || {};
        const custName = doc.name || 'Customer Account';
        const company = doc.company || '—';
        const pct = mostRecentCompleted.totalQty > 0
          ? Math.round((item.qty / mostRecentCompleted.totalQty) * 100)
          : 0;

        return {
          customerId: item._id?.toString(),
          customerName: custName,
          company,
          qty: item.qty,
          percentage: pct
        };
      });
    }
  }

  return {
    dimensionKey: cleanDimKey,
    forecastForMonth,
    trailingMonthsCount: N,
    completedMonthsAvailable: availableMonthsCount,
    trailingMonths,
    sumTrailing,
    averagePerMonth,
    forecastRangeLow,
    forecastRangeHigh,
    lowConfidence,
    insufficientData: false,
    productNames,
    categories,
    mostRecentCompletedMonth: mostRecentCompleted?.month || null,
    topContributingCustomers
  };
};

// GET /api/production/forecast?dimensionKey=&trailingMonths=2
const getDimensionForecast = async (req, res) => {
  try {
    const { dimensionKey, trailingMonths = 2 } = req.query;

    if (!dimensionKey || !dimensionKey.trim()) {
      return res.status(400).json({
        message: 'dimensionKey parameter is required (e.g. /api/production/forecast?dimensionKey=4x45&trailingMonths=2)'
      });
    }

    const forecast = await computeDimensionForecast(dimensionKey, trailingMonths);
    return res.json(forecast);
  } catch (error) {
    console.error('Error calculating dimension forecast:', error);
    return res.status(500).json({ message: 'Server error calculating dimension production forecast' });
  }
};

// GET /api/production/forecast-all?trailingMonths=2
const getAllDimensionsForecast = async (req, res) => {
  try {
    const { trailingMonths = 2 } = req.query;
    const N = Math.max(1, Math.min(parseInt(trailingMonths, 10) || 2, 12));

    // 1. Find all distinct dimension keys ever recorded in orders
    const distinctDimensions = await Order.distinct("lineItems.dimensionKey", {
      isDeleted: { $ne: true },
      status: { $ne: 'cancelled' }
    });

    const cleanDims = distinctDimensions.filter(d => d && typeof d === 'string' && d.trim().length > 0);

    // 2. Compute forecast for every dimension concurrently
    const forecasts = await Promise.all(
      cleanDims.map(dimKey => computeDimensionForecast(dimKey, N))
    );

    // 3. Sort by forecastRangeHigh descending, then sumTrailing descending
    forecasts.sort((a, b) => {
      const highA = a.forecastRangeHigh ?? (a.insufficientData ? -1 : 0);
      const highB = b.forecastRangeHigh ?? (b.insufficientData ? -1 : 0);
      if (highB !== highA) return highB - highA;
      return (b.sumTrailing || 0) - (a.sumTrailing || 0);
    });

    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const forecastForMonth = formatYearMonth(`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`);

    return res.json({
      forecastForMonth,
      trailingMonthsCount: N,
      totalDimensions: forecasts.length,
      forecasts
    });
  } catch (error) {
    console.error('Error calculating all dimension forecasts:', error);
    return res.status(500).json({ message: 'Server error calculating all dimension forecasts' });
  }
};

// GET /api/production/dimension-history?dimensionKey=&months=6
const getDimensionHistory = async (req, res) => {
  try {
    const { dimensionKey, months = 6 } = req.query;

    if (!dimensionKey || !dimensionKey.trim()) {
      return res.status(400).json({
        message: 'dimensionKey parameter is required (e.g. /api/production/dimension-history?dimensionKey=4x45)'
      });
    }

    const cleanDimKey = dimensionKey.trim();
    const monthsLimit = Math.max(1, Math.min(parseInt(months, 10) || 6, 60));

    // Aggregate Order lineItems for the given dimensionKey grouped by calendar month
    const historyAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.dimensionKey": cleanDimKey
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.dimensionKey": cleanDimKey
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: { $ifNull: ["$orderDate", "$createdAt"] }
            }
          },
          totalQty: { $sum: "$lineItems.qty" },
          distinctOrders: { $addToSet: "$_id" }
        }
      },
      {
        $project: {
          _id: 0,
          yearMonth: "$_id",
          totalQty: 1,
          orderCount: { $size: "$distinctOrders" }
        }
      },
      { $sort: { yearMonth: -1 } },
      { $limit: monthsLimit }
    ]);

    // Reverse results so they are sorted oldest to newest (trend line order)
    const chronologicalHistory = historyAgg.reverse().map((item) => ({
      yearMonth: item.yearMonth,
      month: formatYearMonth(item.yearMonth),
      totalQty: item.totalQty,
      orderCount: item.orderCount
    }));

    return res.json({
      dimensionKey: cleanDimKey,
      monthsRequested: monthsLimit,
      dataPointsCount: chronologicalHistory.length,
      history: chronologicalHistory
    });
  } catch (error) {
    console.error('Error fetching dimension history:', error);
    return res.status(500).json({ message: 'Server error fetching dimension production history' });
  }
};

// GET /api/production/dimensions-list
const getDimensionsList = async (req, res) => {
  try {
    // 1. Aggregate all distinct dimension keys across active orders
    const dimensionsAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.dimensionKey": { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$lineItems.dimensionKey",
          dimensionKey: { $first: "$lineItems.dimensionKey" },
          totalLifetimeQty: { $sum: "$lineItems.qty" },
          distinctOrders: { $addToSet: "$_id" },
          distinctCustomers: { $addToSet: "$customerId" },
          recordedNames: { $addToSet: "$lineItems.name" },
          monthlyBatches: {
            $push: {
              yearMonth: {
                $dateToString: {
                  format: "%Y-%m",
                  date: { $ifNull: ["$orderDate", "$createdAt"] }
                }
              },
              qty: "$lineItems.qty"
            }
          }
        }
      }
    ]);

    // 2. Fetch all products from Catalog to enrich product names and categories per dimensionKey
    const allProducts = await Product.find({ isDeleted: { $ne: true } });
    const productMap = {};
    allProducts.forEach((p) => {
      const dim = p.dimensionKey || `${p.widthMm}x${p.heightMm}`;
      if (!productMap[dim]) {
        productMap[dim] = {
          names: new Set(),
          categories: new Set()
        };
      }
      if (p.name) productMap[dim].names.add(p.name);
      if (p.category) productMap[dim].categories.add(p.category);
    });

    // 3. Process each dimension's volume and recent month
    const dimensionsList = dimensionsAgg.map((dim) => {
      const dimKey = dim.dimensionKey;

      // Group monthly batches to calculate recent month's quantity
      const monthlyTotals = {};
      (dim.monthlyBatches || []).forEach((b) => {
        if (b.yearMonth) {
          monthlyTotals[b.yearMonth] = (monthlyTotals[b.yearMonth] || 0) + (b.qty || 0);
        }
      });

      const sortedMonths = Object.keys(monthlyTotals).sort().reverse();
      const mostRecentYearMonth = sortedMonths[0] || null;
      const mostRecentMonthQty = mostRecentYearMonth ? monthlyTotals[mostRecentYearMonth] : 0;

      // Friendly Product names and categories (Product Catalog + Recorded Order names)
      const catalogInfo = productMap[dimKey];
      const combinedNames = new Set(dim.recordedNames.filter(Boolean));
      const combinedCategories = new Set();

      if (catalogInfo) {
        catalogInfo.names.forEach(n => combinedNames.add(n));
        catalogInfo.categories.forEach(c => combinedCategories.add(c));
      }

      return {
        dimensionKey: dimKey,
        productNames: Array.from(combinedNames),
        categories: Array.from(combinedCategories),
        mostRecentYearMonth,
        mostRecentMonth: mostRecentYearMonth ? formatYearMonth(mostRecentYearMonth) : 'No recent orders',
        mostRecentMonthQty,
        totalLifetimeQty: dim.totalLifetimeQty,
        totalOrdersCount: dim.distinctOrders.length,
        activeCustomersCount: dim.distinctCustomers.filter(Boolean).length
      };
    });

    // 4. Sort by most recent month's volume descending, secondary sort by total lifetime volume
    dimensionsList.sort((a, b) => {
      if (b.mostRecentMonthQty !== a.mostRecentMonthQty) {
        return b.mostRecentMonthQty - a.mostRecentMonthQty;
      }
      return b.totalLifetimeQty - a.totalLifetimeQty;
    });

    return res.json({
      totalDimensions: dimensionsList.length,
      dimensions: dimensionsList
    });
  } catch (error) {
    console.error('Error fetching production dimensions list:', error);
    return res.status(500).json({ message: 'Server error fetching production dimensions list' });
  }
};

module.exports = {
  getDimensionForecast,
  getAllDimensionsForecast,
  getDimensionHistory,
  getDimensionsList
};
