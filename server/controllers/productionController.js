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

  const dimRegex = new RegExp('^' + cleanDimKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

  // 1. Fetch completed calendar months strictly before current in-progress month
  const completedMonthsAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": { $regex: dimRegex }
      }
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": { $regex: dimRegex }
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
    $or: [{ dimensionKey: { $regex: dimRegex } }, { $expr: { $eq: [{ $concat: [{ $toString: "$widthMm" }, "x", { $toString: "$heightMm" }] }, cleanDimKey] } }],
    isDeleted: { $ne: true }
  });

  const productNames = Array.from(new Set(products.map(p => p.name).filter(Boolean)));
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // If no product found in catalog, fallback to any names recorded in line items
  if (productNames.length === 0) {
    const recordedNameSample = await Order.findOne({ "lineItems.dimensionKey": { $regex: dimRegex } }, { "lineItems.$": 1 });
    if (recordedNameSample?.lineItems?.[0]?.name) {
      productNames.push(recordedNameSample.lineItems[0].name);
    }
  }

  // 3. Current Calendar Month Actual Sales for this Dimension
  const currentMonthAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": { $regex: dimRegex }
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
        orderYearMonth: currentYearMonth
      }
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": { $regex: dimRegex }
      }
    },
    {
      $group: {
        _id: "$lineItems.name",
        productId: { $first: "$lineItems.productId" },
        productName: { $first: "$lineItems.name" },
        totalQty: { $sum: "$lineItems.qty" },
        totalRevenue: {
          $sum: {
            $ifNull: [
              "$lineItems.lineTotal",
              { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
            ]
          }
        },
        distinctOrders: { $addToSet: "$_id" },
        distinctCustomers: { $addToSet: "$customerId" }
      }
    },
    { $sort: { totalQty: -1 } }
  ]);

  let currentMonthSoldQty = 0;
  let currentMonthRevenue = 0;
  const currentMonthOrderIds = new Set();
  const currentMonthProductDetails = [];

  currentMonthAgg.forEach((item) => {
    currentMonthSoldQty += item.totalQty || 0;
    currentMonthRevenue += item.totalRevenue || 0;
    (item.distinctOrders || []).forEach(id => currentMonthOrderIds.add(id.toString()));
    currentMonthProductDetails.push({
      productName: item.productName || cleanDimKey,
      totalQty: item.totalQty || 0,
      totalRevenue: Math.round((item.totalRevenue || 0) * 100) / 100,
      orderCount: (item.distinctOrders || []).length
    });
  });

  // 4. Current Month Customers for this dimension
  const currentMonthCustAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": { $regex: dimRegex }
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
        orderYearMonth: currentYearMonth
      }
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": { $regex: dimRegex }
      }
    },
    {
      $group: {
        _id: "$customerId",
        qty: { $sum: "$lineItems.qty" },
        revenue: {
          $sum: {
            $ifNull: [
              "$lineItems.lineTotal",
              { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
            ]
          }
        }
      }
    },
    { $sort: { qty: -1 } },
    { $limit: 5 }
  ]);

  let currentMonthCustomers = [];
  if (currentMonthCustAgg.length > 0) {
    const curCustIds = currentMonthCustAgg.map(c => c._id).filter(Boolean);
    const curCustDocs = await Customer.find({ _id: { $in: curCustIds } });
    const curCustMap = {};
    curCustDocs.forEach(c => { curCustMap[c._id.toString()] = c; });

    currentMonthCustomers = currentMonthCustAgg.map(item => {
      const doc = curCustMap[item._id?.toString()] || {};
      const custName = doc.name || 'Customer Account';
      const company = doc.company || '—';
      const pct = currentMonthSoldQty > 0
        ? Math.round((item.qty / currentMonthSoldQty) * 100)
        : 0;

      return {
        customerId: item._id?.toString(),
        customerName: custName,
        company,
        qty: item.qty,
        revenue: Math.round((item.revenue || 0) * 100) / 100,
        percentage: pct
      };
    });
  }

  // 5. Compute Trailing Average and Forecast Range
  const availableMonthsCount = trailingMonths.length;

  if (availableMonthsCount === 0) {
    return {
      dimensionKey: cleanDimKey,
      forecastForMonth,
      currentMonth: formatYearMonth(currentYearMonth),
      currentMonthYearMonth: currentYearMonth,
      currentMonthSoldQty,
      currentMonthRevenue: Math.round(currentMonthRevenue * 100) / 100,
      currentMonthOrderCount: currentMonthOrderIds.size,
      currentMonthProducts: currentMonthProductDetails,
      currentMonthCustomers,
      trailingMonthsCount: N,
      completedMonthsAvailable: 0,
      trailingMonths: [],
      sumTrailing: 0,
      averagePerMonth: null,
      forecastRangeLow: null,
      forecastRangeHigh: null,
      lowConfidence: true,
      insufficientData: true,
      productNames,
      categories,
      mostRecentCompletedMonth: null,
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

  // 6. Trailing Period Label
  const trailingPeriodLabel = availableMonthsCount === 1
    ? trailingMonths[0].month
    : `${trailingMonths[0].month} – ${trailingMonths[trailingMonths.length - 1].month}`;

  // 7. Aggregate all recorded months' customer drivers dynamically from database
  const monthlyCustAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": { $regex: dimRegex }
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
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": { $regex: dimRegex }
      }
    },
    {
      $group: {
        _id: {
          yearMonth: "$orderYearMonth",
          customerId: "$customerId"
        },
        qty: { $sum: "$lineItems.qty" },
        revenue: {
          $sum: {
            $ifNull: [
              "$lineItems.lineTotal",
              { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
            ]
          }
        },
        orderCount: { $addToSet: "$_id" }
      }
    },
    { $sort: { qty: -1 } }
  ]);

  // Aggregate monthly totals across all recorded months for accurate percentages
  const monthlyTotalsAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        "lineItems.dimensionKey": { $regex: dimRegex }
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
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.dimensionKey": { $regex: dimRegex }
      }
    },
    {
      $group: {
        _id: "$orderYearMonth",
        totalQty: { $sum: "$lineItems.qty" },
        totalRevenue: {
          $sum: {
            $ifNull: [
              "$lineItems.lineTotal",
              { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
            ]
          }
        },
        orderCount: { $addToSet: "$_id" }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  const monthTotalMap = {};
  monthlyTotalsAgg.forEach(m => {
    monthTotalMap[m._id] = {
      totalQty: m.totalQty || 0,
      totalRevenue: Math.round((m.totalRevenue || 0) * 100) / 100,
      orderCount: (m.orderCount || []).length
    };
  });

  // Lookup customer profiles
  const allRecordedCustIds = Array.from(new Set(monthlyCustAgg.map(i => i._id?.customerId).filter(Boolean)));
  const allCustDocs = await Customer.find({ _id: { $in: allRecordedCustIds } });
  const allCustMap = {};
  allCustDocs.forEach(c => { allCustMap[c._id.toString()] = c; });

  // Map customer drivers per yearMonth
  const monthlyDrivers = {};
  monthlyCustAgg.forEach(item => {
    const ym = item._id.yearMonth;
    if (!ym) return;
    if (!monthlyDrivers[ym]) {
      monthlyDrivers[ym] = {
        yearMonth: ym,
        month: formatYearMonth(ym),
        totalQty: monthTotalMap[ym]?.totalQty || 0,
        totalRevenue: monthTotalMap[ym]?.totalRevenue || 0,
        orderCount: monthTotalMap[ym]?.orderCount || 0,
        drivers: []
      };
    }

    const doc = allCustMap[item._id?.customerId?.toString()] || {};
    const monthTotal = monthTotalMap[ym]?.totalQty || 0;
    const pct = monthTotal > 0 ? Math.round((item.qty / monthTotal) * 100) : 0;

    monthlyDrivers[ym].drivers.push({
      customerId: item._id?.customerId?.toString(),
      customerName: doc.name || doc.company || 'Customer Account',
      company: doc.company || '—',
      qty: item.qty,
      revenue: Math.round((item.revenue || 0) * 100) / 100,
      orderCount: (item.orderCount || []).length,
      percentage: pct
    });
  });

  // Available months list (newest to oldest)
  const availableMonths = monthlyTotalsAgg.map(m => ({
    yearMonth: m._id,
    month: formatYearMonth(m._id),
    totalQty: m.totalQty,
    totalRevenue: Math.round((m.totalRevenue || 0) * 100) / 100,
    orderCount: (m.orderCount || []).length
  }));

  // 8. Top Contributing Customers across ALL trailing completed months in the selected horizon
  const trailingYearMonths = trailingMonths.map(m => m.yearMonth);
  let topContributingCustomers = [];

  if (trailingYearMonths.length > 0) {
    const trailingCustAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.dimensionKey": { $regex: dimRegex }
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
          orderYearMonth: { $in: trailingYearMonths }
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      {
        $group: {
          _id: "$customerId",
          qty: { $sum: "$lineItems.qty" },
          revenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { qty: -1 } },
      { $limit: 10 }
    ]);

    topContributingCustomers = trailingCustAgg.map(item => {
      const doc = allCustMap[item._id?.toString()] || {};
      const pct = sumTrailing > 0
        ? Math.round((item.qty / sumTrailing) * 100)
        : 0;

      return {
        customerId: item._id?.toString(),
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: item.qty,
        revenue: Math.round((item.revenue || 0) * 100) / 100,
        orderCount: (item.orderCount || []).length,
        percentage: pct
      };
    });

    // Also register trailing horizon in monthlyDrivers
    monthlyDrivers['trailing'] = {
      yearMonth: 'trailing',
      month: `Trailing Horizon (${trailingPeriodLabel})`,
      totalQty: sumTrailing,
      totalRevenue: Math.round(trailingCustAgg.reduce((acc, c) => acc + (c.revenue || 0), 0) * 100) / 100,
      orderCount: trailingMonths.reduce((acc, m) => acc + (m.orderCount || 0), 0),
      drivers: topContributingCustomers
    };
  }

  // 9. Compute Product-Level Breakdown (Individual Products within this dimension)
  const productBreakdowns = {};
  for (const pName of productNames) {
    const pCatalog = (products || []).find(p => p.name === pName) || {};

    // Completed months for this product
    const pCompletedMonthsAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
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
          totalRevenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          distinctOrders: { $addToSet: "$_id" }
        }
      },
      {
        $match: {
          _id: { $lt: currentYearMonth }
        }
      },
      {
        $project: {
          _id: 0,
          yearMonth: "$_id",
          totalQty: 1,
          totalRevenue: 1,
          orderCount: { $size: "$distinctOrders" }
        }
      },
      { $sort: { yearMonth: -1 } },
      { $limit: N }
    ]);

    const pTrailingMonths = pCompletedMonthsAgg.reverse().map((item) => ({
      yearMonth: item.yearMonth,
      month: formatYearMonth(item.yearMonth),
      totalQty: item.totalQty,
      totalRevenue: Math.round((item.totalRevenue || 0) * 100) / 100,
      orderCount: item.orderCount
    }));

    const pAvailCount = pTrailingMonths.length;
    const pQtys = pTrailingMonths.map(m => m.totalQty);
    const pSumTrailing = pQtys.reduce((sum, q) => sum + q, 0);
    const pAvgPerMonth = pAvailCount > 0 ? Math.round(pSumTrailing / pAvailCount) : null;
    let pRangeLow = null;
    let pRangeHigh = null;
    let pLowConf = false;

    if (pAvailCount === 1) {
      pRangeLow = pQtys[0];
      pRangeHigh = pQtys[0];
      pLowConf = true;
    } else if (pAvailCount > 1) {
      pRangeLow = Math.min(...pQtys);
      pRangeHigh = Math.max(...pQtys);
    }

    const pTrailingPeriodLabel = pAvailCount === 1
      ? pTrailingMonths[0].month
      : pAvailCount > 1
      ? `${pTrailingMonths[0].month} – ${pTrailingMonths[pTrailingMonths.length - 1].month}`
      : 'No prior records';

    // Current month for this product
    const pCurrentDetail = currentMonthProductDetails.find(d => d.productName === pName) || {
      productName: pName,
      totalQty: 0,
      totalRevenue: 0,
      orderCount: 0
    };

    // Current month customers for this product
    const pCurrentCustAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
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
      { $match: { orderYearMonth: currentYearMonth } },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      {
        $group: {
          _id: "$customerId",
          qty: { $sum: "$lineItems.qty" },
          revenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { qty: -1 } }
    ]);

    const pCurrentCustomers = pCurrentCustAgg.map(item => {
      const doc = allCustMap[item._id?.toString()] || {};
      const pct = pCurrentDetail.totalQty > 0
        ? Math.round((item.qty / pCurrentDetail.totalQty) * 100)
        : 0;
      return {
        customerId: item._id?.toString(),
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: item.qty,
        revenue: Math.round((item.revenue || 0) * 100) / 100,
        orderCount: (item.orderCount || []).length,
        percentage: pct
      };
    });

    // Monthly Drivers for this product across all recorded months
    const pMonthlyCustAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
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
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      {
        $group: {
          _id: {
            yearMonth: "$orderYearMonth",
            customerId: "$customerId"
          },
          qty: { $sum: "$lineItems.qty" },
          revenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { qty: -1 } }
    ]);

    // Monthly totals for this product
    const pMonthlyTotalsAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
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
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      {
        $group: {
          _id: "$orderYearMonth",
          totalQty: { $sum: "$lineItems.qty" },
          totalRevenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const pMonthTotalMap = {};
    pMonthlyTotalsAgg.forEach(m => {
      pMonthTotalMap[m._id] = {
        totalQty: m.totalQty || 0,
        totalRevenue: Math.round((m.totalRevenue || 0) * 100) / 100,
        orderCount: (m.orderCount || []).length
      };
    });

    const pMonthlyDrivers = {};
    pMonthlyCustAgg.forEach(item => {
      const ym = item._id.yearMonth;
      if (!ym) return;
      if (!pMonthlyDrivers[ym]) {
        pMonthlyDrivers[ym] = {
          yearMonth: ym,
          month: formatYearMonth(ym),
          totalQty: pMonthTotalMap[ym]?.totalQty || 0,
          totalRevenue: pMonthTotalMap[ym]?.totalRevenue || 0,
          orderCount: pMonthTotalMap[ym]?.orderCount || 0,
          drivers: []
        };
      }
      const doc = allCustMap[item._id?.customerId?.toString()] || {};
      const mTot = pMonthTotalMap[ym]?.totalQty || 0;
      const pct = mTot > 0 ? Math.round((item.qty / mTot) * 100) : 0;
      pMonthlyDrivers[ym].drivers.push({
        customerId: item._id?.customerId?.toString(),
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: item.qty,
        revenue: Math.round((item.revenue || 0) * 100) / 100,
        orderCount: (item.orderCount || []).length,
        percentage: pct
      });
    });

    const pAvailableMonths = pMonthlyTotalsAgg.map(m => ({
      yearMonth: m._id,
      month: formatYearMonth(m._id),
      totalQty: m.totalQty,
      totalRevenue: Math.round((m.totalRevenue || 0) * 100) / 100,
      orderCount: (m.orderCount || []).length
    }));

    // Top drivers across trailing months for this product
    const pTrailingCustAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' },
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
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
          orderYearMonth: { $in: pTrailingMonths.map(m => m.yearMonth) }
        }
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.name": pName,
          "lineItems.dimensionKey": { $regex: dimRegex }
        }
      },
      {
        $group: {
          _id: "$customerId",
          qty: { $sum: "$lineItems.qty" },
          revenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { qty: -1 } },
      { $limit: 10 }
    ]);

    const pTopContributingCustomers = pTrailingCustAgg.map(item => {
      const doc = allCustMap[item._id?.toString()] || {};
      const pct = pSumTrailing > 0 ? Math.round((item.qty / pSumTrailing) * 100) : 0;
      return {
        customerId: item._id?.toString(),
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: item.qty,
        revenue: Math.round((item.revenue || 0) * 100) / 100,
        orderCount: (item.orderCount || []).length,
        percentage: pct
      };
    });

    pMonthlyDrivers['trailing'] = {
      yearMonth: 'trailing',
      month: `Trailing Horizon (${pTrailingPeriodLabel})`,
      totalQty: pSumTrailing,
      totalRevenue: Math.round(pTrailingCustAgg.reduce((acc, c) => acc + (c.revenue || 0), 0) * 100) / 100,
      orderCount: pTrailingMonths.reduce((acc, m) => acc + (m.orderCount || 0), 0),
      drivers: pTopContributingCustomers
    };

    productBreakdowns[pName] = {
      productName: pName,
      category: pCatalog.category || 'Label',
      unitPrice: pCatalog.unitPrice ?? null,
      forecastRangeLow: pRangeLow,
      forecastRangeHigh: pRangeHigh,
      lowConfidence: pLowConf,
      sumTrailing: pSumTrailing,
      averagePerMonth: pAvgPerMonth,
      trailingMonths: pTrailingMonths,
      trailingPeriodLabel: pTrailingPeriodLabel,
      currentMonthSoldQty: pCurrentDetail.totalQty,
      currentMonthRevenue: pCurrentDetail.totalRevenue,
      currentMonthOrderCount: pCurrentDetail.orderCount,
      currentMonthCustomers: pCurrentCustomers,
      availableMonths: pAvailableMonths,
      monthlyDrivers: pMonthlyDrivers,
      topContributingCustomers: pTopContributingCustomers
    };
  }

  return {
    dimensionKey: cleanDimKey,
    forecastForMonth,
    currentMonth: formatYearMonth(currentYearMonth),
    currentMonthYearMonth: currentYearMonth,
    currentMonthSoldQty,
    currentMonthRevenue: Math.round(currentMonthRevenue * 100) / 100,
    currentMonthOrderCount: currentMonthOrderIds.size,
    currentMonthProducts: currentMonthProductDetails,
    currentMonthCustomers,
    trailingMonthsCount: N,
    completedMonthsAvailable: availableMonthsCount,
    trailingMonths,
    trailingPeriodLabel,
    availableMonths,
    monthlyDrivers,
    productBreakdowns,
    sumTrailing,
    averagePerMonth,
    forecastRangeLow,
    forecastRangeHigh,
    lowConfidence,
    insufficientData: false,
    productNames,
    categories,
    mostRecentCompletedMonth: trailingMonths[trailingMonths.length - 1]?.month || null,
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
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const forecastForMonth = formatYearMonth(`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`);
    const currentMonthFormatted = formatYearMonth(currentYearMonth);

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

    // 4. Compute comprehensive current calendar month product sales summary across entire catalog
    const currentMonthAllAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' }
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
          orderYearMonth: currentYearMonth
        }
      },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: {
            name: "$lineItems.name",
            dimensionKey: "$lineItems.dimensionKey"
          },
          productId: { $first: "$lineItems.productId" },
          productName: { $first: "$lineItems.name" },
          dimensionKey: { $first: "$lineItems.dimensionKey" },
          totalQty: { $sum: "$lineItems.qty" },
          totalRevenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          distinctOrders: { $addToSet: "$_id" },
          distinctCustomers: { $addToSet: "$customerId" }
        }
      },
      { $sort: { totalQty: -1 } }
    ]);

    // Fetch product catalog categories for enrichment
    const catalogProducts = await Product.find({ isDeleted: { $ne: true } });
    const catMap = {};
    catalogProducts.forEach(p => {
      if (p.name) catMap[p.name] = p.category;
    });

    // Fetch customer details for buying customer names
    const allCustIds = Array.from(new Set(currentMonthAllAgg.flatMap(i => i.distinctCustomers || [])));
    const custDocs = await Customer.find({ _id: { $in: allCustIds } }, { name: 1, company: 1 });
    const customerLookup = {};
    custDocs.forEach(c => {
      customerLookup[c._id.toString()] = c.name || c.company || 'Customer';
    });

    let totalCurrentMonthSoldQty = 0;
    let totalCurrentMonthRevenue = 0;
    const globalDistinctOrders = new Set();

    const productsSoldCurrentMonth = currentMonthAllAgg.map(item => {
      totalCurrentMonthSoldQty += item.totalQty || 0;
      totalCurrentMonthRevenue += item.totalRevenue || 0;
      (item.distinctOrders || []).forEach(o => globalDistinctOrders.add(o.toString()));

      const buyingCustomers = (item.distinctCustomers || [])
        .map(cid => customerLookup[cid?.toString()])
        .filter(Boolean);

      return {
        productName: item.productName || item._id.name || 'Unnamed Product',
        dimensionKey: item.dimensionKey || item._id.dimensionKey || 'Standard',
        category: catMap[item.productName] || 'Label',
        totalQty: item.totalQty || 0,
        totalRevenue: Math.round((item.totalRevenue || 0) * 100) / 100,
        orderCount: (item.distinctOrders || []).length,
        customerCount: (item.distinctCustomers || []).length,
        buyingCustomers: Array.from(new Set(buyingCustomers))
      };
    });

    const currentMonthSummary = {
      currentMonth: currentMonthFormatted,
      currentMonthYearMonth: currentYearMonth,
      totalSoldQty: totalCurrentMonthSoldQty,
      totalRevenue: Math.round(totalCurrentMonthRevenue * 100) / 100,
      totalOrders: globalDistinctOrders.size,
      distinctProductsCount: productsSoldCurrentMonth.length,
      productsSold: productsSoldCurrentMonth
    };

    return res.json({
      forecastForMonth,
      currentMonth: currentMonthFormatted,
      trailingMonthsCount: N,
      totalDimensions: forecasts.length,
      currentMonthSummary,
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

// GET /api/production/current-month-products
const getCurrentMonthProductsSold = async (req, res) => {
  try {
    const { search, category, sortBy = 'qty', sortOrder = 'desc' } = req.query;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthFormatted = formatYearMonth(currentYearMonth);

    // Aggregate all active order line items in the current calendar month
    const aggPipeline = [
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: 'cancelled' }
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
          orderYearMonth: currentYearMonth
        }
      },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: {
            name: "$lineItems.name",
            dimensionKey: "$lineItems.dimensionKey"
          },
          productId: { $first: "$lineItems.productId" },
          productName: { $first: "$lineItems.name" },
          dimensionKey: { $first: "$lineItems.dimensionKey" },
          unitPrice: { $first: "$lineItems.price" },
          totalQty: { $sum: "$lineItems.qty" },
          totalRevenue: {
            $sum: {
              $ifNull: [
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          },
          distinctOrders: { $addToSet: "$_id" },
          distinctCustomers: { $addToSet: "$customerId" }
        }
      }
    ];

    const results = await Order.aggregate(aggPipeline);

    // Enrich with catalog info (categories and latest product pricing if missing)
    const catalogProducts = await Product.find({ isDeleted: { $ne: true } });
    const productCatalogMap = {};
    catalogProducts.forEach(p => {
      if (p.name) productCatalogMap[p.name] = p;
    });

    // Customer lookup
    const allCustIds = Array.from(new Set(results.flatMap(i => i.distinctCustomers || [])));
    const custDocs = await Customer.find({ _id: { $in: allCustIds } }, { name: 1, company: 1 });
    const custLookup = {};
    custDocs.forEach(c => {
      custLookup[c._id.toString()] = {
        id: c._id.toString(),
        name: c.name || c.company || 'Customer Account',
        company: c.company || '—'
      };
    });

    let totalSoldQty = 0;
    let totalRevenue = 0;
    const globalOrderSet = new Set();

    let formattedProducts = results.map(item => {
      totalSoldQty += item.totalQty || 0;
      totalRevenue += item.totalRevenue || 0;
      (item.distinctOrders || []).forEach(o => globalOrderSet.add(o.toString()));

      const catInfo = productCatalogMap[item.productName] || {};
      const customers = (item.distinctCustomers || [])
        .map(cid => custLookup[cid?.toString()])
        .filter(Boolean);

      return {
        productName: item.productName || item._id.name || 'Unnamed Label',
        dimensionKey: item.dimensionKey || item._id.dimensionKey || 'Standard',
        category: catInfo.category || 'Label',
        unitPrice: item.unitPrice ?? catInfo.unitPrice ?? null,
        totalQty: item.totalQty || 0,
        totalRevenue: Math.round((item.totalRevenue || 0) * 100) / 100,
        orderCount: (item.distinctOrders || []).length,
        customerCount: customers.length,
        customers
      };
    });

    // Optional Filtering
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      formattedProducts = formattedProducts.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        p.dimensionKey.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.customers.some(c => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      );
    }

    if (category && category !== 'all') {
      formattedProducts = formattedProducts.filter(p => p.category === category);
    }

    // Sorting
    formattedProducts.sort((a, b) => {
      let valA = a.totalQty;
      let valB = b.totalQty;
      if (sortBy === 'revenue') {
        valA = a.totalRevenue;
        valB = b.totalRevenue;
      } else if (sortBy === 'name') {
        return sortOrder === 'desc'
          ? b.productName.localeCompare(a.productName)
          : a.productName.localeCompare(b.productName);
      } else if (sortBy === 'orders') {
        valA = a.orderCount;
        valB = b.orderCount;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return res.json({
      currentMonth: currentMonthFormatted,
      currentMonthYearMonth: currentYearMonth,
      totalSoldQty,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: globalOrderSet.size,
      totalProductsCount: formattedProducts.length,
      products: formattedProducts
    });
  } catch (error) {
    console.error('Error fetching current month products sold:', error);
    return res.status(500).json({ message: 'Server error fetching current month products sold' });
  }
};

module.exports = {
  getDimensionForecast,
  getAllDimensionsForecast,
  getDimensionHistory,
  getDimensionsList,
  getCurrentMonthProductsSold
};
