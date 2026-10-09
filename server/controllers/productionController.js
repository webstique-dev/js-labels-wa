const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
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

// GET /api/production/export-all?trailingMonths=2
const exportAllProductionExcel = async (req, res) => {
  try {
    const { trailingMonths = 2 } = req.query;
    const N = Math.max(1, Math.min(parseInt(trailingMonths, 10) || 2, 12));

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const forecastForMonth = formatYearMonth(`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`);
    const currentMonthFormatted = formatYearMonth(currentYearMonth);

    // 1. Fetch all distinct dimension keys
    const distinctDimensions = await Order.distinct("lineItems.dimensionKey", {
      isDeleted: { $ne: true },
      status: { $ne: 'cancelled' }
    });
    const cleanDims = distinctDimensions.filter(d => d && typeof d === 'string' && d.trim().length > 0);

    // 2. Compute forecast for every dimension concurrently
    const forecasts = await Promise.all(
      cleanDims.map(dimKey => computeDimensionForecast(dimKey, N))
    );

    // 3. Current month catalog summary
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

    // Catalog products for enrichment
    const catalogProducts = await Product.find({ isDeleted: { $ne: true } });
    const productCatalogMap = {};
    catalogProducts.forEach(p => {
      if (p.name) productCatalogMap[p.name] = p;
    });

    const allCustIds = Array.from(new Set(currentMonthAllAgg.flatMap(i => i.distinctCustomers || [])));
    const custDocs = await Customer.find({ _id: { $in: allCustIds } }, { name: 1, company: 1 });
    const customerLookup = {};
    custDocs.forEach(c => {
      customerLookup[c._id.toString()] = c.name || c.company || 'Customer';
    });

    // Flatten all products across dimensions and current month
    const productMap = new Map();

    forecasts.forEach(d => {
      if (d.productBreakdowns && Object.keys(d.productBreakdowns).length > 0) {
        Object.values(d.productBreakdowns).forEach(pb => {
          const key = `${pb.productName}_${d.dimensionKey}`;
          productMap.set(key, {
            productName: pb.productName,
            category: pb.category || 'Label',
            dimensionKey: d.dimensionKey,
            unitPrice: pb.unitPrice ?? productCatalogMap[pb.productName]?.unitPrice ?? null,
            forecastRangeLow: pb.forecastRangeLow,
            forecastRangeHigh: pb.forecastRangeHigh,
            averagePerMonth: pb.averagePerMonth,
            sumTrailing: pb.sumTrailing,
            trailingPeriodLabel: pb.trailingPeriodLabel,
            lowConfidence: pb.lowConfidence,
            insufficientData: pb.forecastRangeHigh == null,
            currentMonthSoldQty: pb.currentMonthSoldQty || 0,
            currentMonthRevenue: pb.currentMonthRevenue || 0,
            currentMonthOrderCount: pb.currentMonthOrderCount || 0,
            topContributingCustomers: (pb.topContributingCustomers || []).map(c => `${c.customerName} (${c.percentage}%)`).join(', '),
            currentMonthCustomers: (pb.currentMonthCustomers || []).map(c => `${c.customerName} (${c.percentage}%)`).join(', ')
          });
        });
      } else if (d.productNames && d.productNames.length > 0) {
        d.productNames.forEach(pName => {
          const key = `${pName}_${d.dimensionKey}`;
          if (!productMap.has(key)) {
            productMap.set(key, {
              productName: pName,
              category: (d.categories && d.categories[0]) || 'Label',
              dimensionKey: d.dimensionKey,
              unitPrice: productCatalogMap[pName]?.unitPrice ?? null,
              forecastRangeLow: d.forecastRangeLow,
              forecastRangeHigh: d.forecastRangeHigh,
              averagePerMonth: d.averagePerMonth,
              sumTrailing: d.sumTrailing,
              trailingPeriodLabel: d.trailingPeriodLabel,
              lowConfidence: d.lowConfidence,
              insufficientData: d.forecastRangeHigh == null,
              currentMonthSoldQty: d.currentMonthSoldQty || 0,
              currentMonthRevenue: d.currentMonthRevenue || 0,
              currentMonthOrderCount: d.currentMonthOrderCount || 0,
              topContributingCustomers: (d.topContributingCustomers || []).map(c => `${c.customerName} (${c.percentage}%)`).join(', '),
              currentMonthCustomers: (d.currentMonthCustomers || []).map(c => `${c.customerName} (${c.percentage}%)`).join(', ')
            });
          }
        });
      }
    });

    currentMonthAllAgg.forEach(item => {
      const pName = item.productName || item._id.name;
      const dimKey = item.dimensionKey || item._id.dimensionKey || 'Standard';
      const key = `${pName}_${dimKey}`;
      if (!productMap.has(key)) {
        const catInfo = productCatalogMap[pName] || {};
        const buyers = (item.distinctCustomers || []).map(cid => customerLookup[cid?.toString()]).filter(Boolean);
        productMap.set(key, {
          productName: pName,
          category: catInfo.category || 'Label',
          dimensionKey: dimKey,
          unitPrice: catInfo.unitPrice ?? null,
          forecastRangeLow: null,
          forecastRangeHigh: null,
          averagePerMonth: null,
          sumTrailing: 0,
          trailingPeriodLabel: 'No prior completed records',
          lowConfidence: true,
          insufficientData: true,
          currentMonthSoldQty: item.totalQty || 0,
          currentMonthRevenue: Math.round((item.totalRevenue || 0) * 100) / 100,
          currentMonthOrderCount: (item.distinctOrders || []).length,
          topContributingCustomers: '—',
          currentMonthCustomers: buyers.join(', ') || '—'
        });
      }
    });

    const productsList = Array.from(productMap.values()).sort((a, b) => {
      const fA = a.forecastRangeHigh ?? 0;
      const fB = b.forecastRangeHigh ?? 0;
      if (fB !== fA) return fB - fA;
      return (b.currentMonthSoldQty || 0) - (a.currentMonthSoldQty || 0);
    });

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels Production Engine';
    workbook.created = new Date();

    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    const subtitleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    const navyHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Sapphire Navy
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    const titleFont = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };

    const formatDim = (dim) => {
      if (!dim || !dim.includes('x')) return dim || '—';
      const [w, h] = dim.split('x');
      return `${w}mm × ${h}mm`;
    };

    // SHEET 1: Products Forecast & Sales
    const ws1 = workbook.addWorksheet('Products Forecast & Sales', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
    });

    ws1.mergeCells('A1:N1');
    const t1 = ws1.getCell('A1');
    t1.value = 'JS LABELS — COMPLETE PRODUCT PRODUCTION & DEMAND FORECAST REPORT';
    t1.font = titleFont;
    t1.fill = titleFill;
    t1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws1.getRow(1).height = 32;

    ws1.mergeCells('A2:N2');
    const s1 = ws1.getCell('A2');
    s1.value = `Planning Horizon: Trailing ${N} Months  |  Upcoming Forecast Period: ${forecastForMonth}  |  Live Sales Month: ${currentMonthFormatted}  |  Total Products: ${productsList.length}  |  Exported: ${now.toLocaleString('en-IN')}`;
    s1.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
    s1.fill = subtitleFill;
    s1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws1.getRow(2).height = 22;

    ws1.getRow(3).height = 8;

    const headers1 = [
      { name: '#', width: 6, align: 'center' },
      { name: 'Product Name', width: 28, align: 'left' },
      { name: 'Category', width: 16, align: 'left' },
      { name: 'Dimension Key', width: 14, align: 'center' },
      { name: 'Dimensions (mm)', width: 18, align: 'left' },
      { name: `Forecast Expected (${forecastForMonth})`, width: 24, align: 'right' },
      { name: 'Forecast Range Low', width: 18, align: 'right' },
      { name: 'Forecast Range High', width: 18, align: 'right' },
      { name: 'Forecast Confidence', width: 18, align: 'center' },
      { name: `Sold Qty (${currentMonthFormatted})`, width: 20, align: 'right' },
      { name: `Confirmed Orders (${currentMonthFormatted})`, width: 18, align: 'center' },
      { name: `Trailing Avg/Mo`, width: 18, align: 'right' },
      { name: `Trailing Total Qty`, width: 18, align: 'right' },
      { name: 'Top Customer Demand Drivers', width: 35, align: 'left' }
    ];

    const hRow1 = ws1.getRow(4);
    hRow1.height = 28;
    headers1.forEach((h, idx) => {
      const cell = hRow1.getCell(idx + 1);
      cell.value = h.name;
      cell.font = headerFont;
      cell.fill = navyHeaderFill;
      cell.alignment = { vertical: 'middle', horizontal: h.align };
      cell.border = thinBorder;
    });

    let totalForecastSum = 0;
    let totalCurSoldSum = 0;
    let totalCurOrdersSum = 0;

    productsList.forEach((p, idx) => {
      const rNum = idx + 5;
      const row = ws1.getRow(rNum);
      row.height = 22;
      const isEven = idx % 2 === 0;
      const rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };

      const expectedVal = p.forecastRangeHigh != null ? p.forecastRangeHigh : (p.insufficientData ? 'Insufficient Data' : '—');
      const confLabel = p.insufficientData ? 'Insufficient History' : (p.lowConfidence ? 'Moderate (1 Mo)' : 'High Confidence');

      if (typeof p.forecastRangeHigh === 'number') totalForecastSum += p.forecastRangeHigh;
      totalCurSoldSum += (p.currentMonthSoldQty || 0);
      totalCurOrdersSum += (p.currentMonthOrderCount || 0);

      const rowValues = [
        idx + 1,
        p.productName,
        p.category,
        p.dimensionKey,
        formatDim(p.dimensionKey),
        expectedVal,
        p.forecastRangeLow != null ? p.forecastRangeLow : '—',
        p.forecastRangeHigh != null ? p.forecastRangeHigh : '—',
        confLabel,
        p.currentMonthSoldQty || 0,
        p.currentMonthOrderCount || 0,
        p.averagePerMonth != null ? p.averagePerMonth : '—',
        p.sumTrailing || 0,
        p.topContributingCustomers || '—'
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
        cell.fill = rowFill;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: headers1[cIdx].align };

        if (typeof val === 'number') {
          cell.numFmt = '#,##0';
        }
      });
    });

    // Summary Totals Row on Sheet 1
    const sumRowNum1 = productsList.length + 5;
    const sumRow1 = ws1.getRow(sumRowNum1);
    sumRow1.height = 26;
    for (let c = 1; c <= headers1.length; c++) {
      const cell = sumRow1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    }
    sumRow1.getCell(2).value = 'TOTALS / AGGREGATE';
    sumRow1.getCell(6).value = totalForecastSum;
    sumRow1.getCell(6).numFmt = '#,##0';
    sumRow1.getCell(10).value = totalCurSoldSum;
    sumRow1.getCell(10).numFmt = '#,##0';
    sumRow1.getCell(11).value = totalCurOrdersSum;
    sumRow1.getCell(11).numFmt = '#,##0';

    ws1.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: headers1.length }
    };
    headers1.forEach((h, i) => {
      ws1.getColumn(i + 1).width = h.width;
    });

    // SHEET 2: Machine Setup & Die Batching
    const ws2 = workbook.addWorksheet('Machine Dies & Batching', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
    });

    ws2.mergeCells('A1:K1');
    const t2 = ws2.getCell('A1');
    t2.value = 'JS LABELS — MACHINE SETUP & CYLINDER BATCHING FORECAST';
    t2.font = titleFont;
    t2.fill = titleFill;
    t2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(1).height = 32;

    ws2.mergeCells('A2:K2');
    const s2 = ws2.getCell('A2');
    s2.value = `Shop-Floor Machine Setup Reference  |  Total Dimensions: ${forecasts.length}  |  Planning Month: ${forecastForMonth}`;
    s2.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
    s2.fill = subtitleFill;
    s2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(2).height = 22;

    ws2.getRow(3).height = 8;

    const headers2 = [
      { name: '#', width: 6, align: 'center' },
      { name: 'Dimension Key', width: 14, align: 'center' },
      { name: 'Dimensions (Size mm)', width: 20, align: 'left' },
      { name: 'Associated Products', width: 30, align: 'left' },
      { name: 'Categories', width: 18, align: 'left' },
      { name: `Upcoming Demand Forecast (${forecastForMonth})`, width: 24, align: 'right' },
      { name: `Current Month Sold (${currentMonthFormatted})`, width: 20, align: 'right' },
      { name: 'Confirmed Orders', width: 16, align: 'center' },
      { name: 'Trailing Avg/Mo', width: 16, align: 'right' },
      { name: 'Setup Batch Hours Saved', width: 18, align: 'center' },
      { name: 'Top Customer Demand Drivers', width: 35, align: 'left' }
    ];

    const hRow2 = ws2.getRow(4);
    hRow2.height = 28;
    headers2.forEach((h, idx) => {
      const cell = hRow2.getCell(idx + 1);
      cell.value = h.name;
      cell.font = headerFont;
      cell.fill = navyHeaderFill;
      cell.alignment = { vertical: 'middle', horizontal: h.align };
      cell.border = thinBorder;
    });

    forecasts.forEach((d, idx) => {
      const rNum = idx + 5;
      const row = ws2.getRow(rNum);
      row.height = 22;
      const isEven = idx % 2 === 0;
      const rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };

      const recentMonth = d.trailingMonths?.[d.trailingMonths.length - 1];
      const recentOrders = recentMonth?.orderCount || 0;
      const batchHours = recentOrders > 1 ? (recentOrders - 1) * 12 : 0;

      const topCusts = (d.topContributingCustomers || []).map(c => `${c.customerName} (${c.percentage}%)`).join(', ');

      const rowValues = [
        idx + 1,
        d.dimensionKey,
        formatDim(d.dimensionKey),
        (d.productNames || []).join(', ') || '—',
        (d.categories || []).join(', ') || '—',
        d.forecastRangeHigh != null ? d.forecastRangeHigh : 'Insufficient Data',
        d.currentMonthSoldQty || 0,
        d.currentMonthOrderCount || 0,
        d.averagePerMonth != null ? d.averagePerMonth : '—',
        batchHours > 0 ? `${batchHours} hrs` : 'Standard',
        topCusts || '—'
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
        cell.fill = rowFill;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: headers2[cIdx].align };

        if (typeof val === 'number') {
          cell.numFmt = '#,##0';
        }
      });
    });

    ws2.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: headers2.length }
    };
    headers2.forEach((h, i) => {
      ws2.getColumn(i + 1).width = h.width;
    });

    // Response headers and stream
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="JS_Labels_Production_Forecast_All_${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating production all Excel report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating production all Excel report' });
    }
  }
};

// GET /api/production/export-product?productName=&dimensionKey=&trailingMonths=2
const exportProductProductionExcel = async (req, res) => {
  try {
    const { productName, trailingMonths = 2 } = req.query;
    let { dimensionKey } = req.query;

    if (!productName || !productName.trim()) {
      return res.status(400).json({ message: 'productName is required for product export' });
    }

    const cleanProdName = productName.trim();
    const N = Math.max(1, Math.min(parseInt(trailingMonths, 10) || 2, 12));

    // Find product catalog entry if dimensionKey not provided
    const prodDoc = await Product.findOne({ name: cleanProdName, isDeleted: { $ne: true } });
    if (!dimensionKey && prodDoc) {
      dimensionKey = prodDoc.dimensionKey || `${prodDoc.widthMm}x${prodDoc.heightMm}`;
    }

    // If still no dimensionKey, search lineItems
    if (!dimensionKey) {
      const orderSample = await Order.findOne({ "lineItems.name": cleanProdName }, { "lineItems.$": 1 });
      if (orderSample?.lineItems?.[0]?.dimensionKey) {
        dimensionKey = orderSample.lineItems[0].dimensionKey;
      }
    }

    const cleanDimKey = (dimensionKey || 'Standard').trim();
    const dimForecast = await computeDimensionForecast(cleanDimKey, N);

    const productBreakdown = dimForecast?.productBreakdowns?.[cleanProdName] || {
      productName: cleanProdName,
      category: prodDoc?.category || 'Label',
      unitPrice: prodDoc?.unitPrice ?? null,
      forecastRangeLow: dimForecast?.forecastRangeLow,
      forecastRangeHigh: dimForecast?.forecastRangeHigh,
      lowConfidence: dimForecast?.lowConfidence,
      sumTrailing: dimForecast?.sumTrailing,
      averagePerMonth: dimForecast?.averagePerMonth,
      trailingMonths: dimForecast?.trailingMonths,
      trailingPeriodLabel: dimForecast?.trailingPeriodLabel,
      currentMonthSoldQty: dimForecast?.currentMonthSoldQty || 0,
      currentMonthRevenue: dimForecast?.currentMonthRevenue || 0,
      currentMonthOrderCount: dimForecast?.currentMonthOrderCount || 0,
      currentMonthCustomers: dimForecast?.currentMonthCustomers || [],
      monthlyDrivers: dimForecast?.monthlyDrivers || {},
      topContributingCustomers: dimForecast?.topContributingCustomers || []
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels Production Engine';
    workbook.created = new Date();

    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    const subtitleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    const navyHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const ws = workbook.addWorksheet('Production & Demand Dossier', {
      views: [{ showGridLines: true }]
    });

    const formatDim = (dim) => {
      if (!dim || !dim.includes('x')) return dim || '—';
      const [w, h] = dim.split('x');
      return `${w}mm × ${h}mm`;
    };

    // 1. Title Banner
    ws.mergeCells('A1:E1');
    const tCell = ws.getCell('A1');
    tCell.value = `JS LABELS — ${cleanProdName.toUpperCase()} PRODUCTION DOSSIER`;
    tCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tCell.fill = titleFill;
    tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 32;

    ws.mergeCells('A2:E2');
    const subCell = ws.getCell('A2');
    subCell.value = `Planning Horizon: Trailing ${N} Months  |  Dimension: [${cleanDimKey}] ${formatDim(cleanDimKey)}  |  Exported: ${new Date().toLocaleString('en-IN')}`;
    subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFCBD5E1' } };
    subCell.fill = subtitleFill;
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 22;

    ws.getRow(3).height = 10;

    // 2. Product Specifications Block (No unit price / money)
    const specRows = [
      ['Product Friendly Name', cleanProdName, 'Category', productBreakdown.category || 'Label'],
      ['Dimension Key', `[${cleanDimKey}]`, 'Dimension Size (mm)', formatDim(cleanDimKey)],
      ['Planning Horizon', `Trailing ${N} Completed Months`, 'Upcoming Planning Month', dimForecast.forecastForMonth || 'Upcoming Month'],
      ['Upcoming Demand Forecast', productBreakdown.forecastRangeHigh != null ? `~${productBreakdown.forecastRangeHigh.toLocaleString('en-IN')} Labels` : 'Insufficient History', 'Live Month Progress', `${dimForecast.currentMonth || 'Current Month'} (${(productBreakdown.currentMonthSoldQty || 0).toLocaleString('en-IN')} Sold)`]
    ];

    let curRowIdx = 4;
    specRows.forEach(sr => {
      const row = ws.getRow(curRowIdx);
      row.values = [sr[0], sr[1], sr[2], sr[3]];
      row.height = 24;

      ['A', 'C'].forEach(col => {
        const cell = row.getCell(col);
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
        cell.fill = sectionFill;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });
      ['B', 'D'].forEach(col => {
        const cell = row.getCell(col);
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });
      curRowIdx++;
    });

    curRowIdx++;

    // 3. Trailing Completed Months History (No money columns)
    ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
    const sec1 = ws.getCell(`A${curRowIdx}`);
    sec1.value = `TRAILING COMPLETED MONTHS PERFORMANCE RECORD (${productBreakdown.trailingPeriodLabel || `Past ${N} Months`})`;
    sec1.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sec1.fill = navyHeaderFill;
    sec1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(curRowIdx).height = 24;
    curRowIdx++;

    const histHeaders = ['#', 'Completed Calendar Month', 'Produced / Sold Qty', 'Confirmed Orders', 'vs Trailing Avg'];
    const hRowHist = ws.getRow(curRowIdx);
    hRowHist.height = 24;
    histHeaders.forEach((h, idx) => {
      const cell = hRowHist.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = sectionFill;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: idx >= 2 ? 'right' : 'left' };
    });
    curRowIdx++;

    const tMonths = productBreakdown.trailingMonths || [];
    if (tMonths.length > 0) {
      tMonths.forEach((m, idx) => {
        const row = ws.getRow(curRowIdx);
        row.height = 22;
        const diff = productBreakdown.averagePerMonth ? Math.round(((m.totalQty - productBreakdown.averagePerMonth) / productBreakdown.averagePerMonth) * 100) : 0;
        const diffStr = diff > 0 ? `+${diff}%` : `${diff}%`;

        const vals = [
          idx + 1,
          m.month,
          m.totalQty || 0,
          m.orderCount || 0,
          diffStr
        ];

        vals.forEach((v, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = v;
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: cIdx >= 2 ? 'right' : 'left' };
          if (cIdx === 2 || cIdx === 3) cell.numFmt = '#,##0';
        });
        curRowIdx++;
      });
    } else {
      const row = ws.getRow(curRowIdx);
      ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
      row.getCell('A').value = 'No prior completed calendar month records found for this product.';
      row.getCell('A').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
      row.height = 20;
      curRowIdx++;
    }

    curRowIdx++;

    // 4. Current Month Sales Performance (No money)
    ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
    const sec2 = ws.getCell(`A${curRowIdx}`);
    sec2.value = `CURRENT LIVE MONTH DEMAND (${dimForecast.currentMonth || 'Current Month'})`;
    sec2.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // Emerald 800
    sec2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(curRowIdx).height = 24;
    curRowIdx++;

    const curKpis = [
      ['Current Month Sold Units', `${(productBreakdown.currentMonthSoldQty || 0).toLocaleString('en-IN')} Labels`],
      ['Confirmed Orders Received', `${productBreakdown.currentMonthOrderCount || 0} Orders`],
      ['Production Ledger Status', 'Active Tracking In Progress']
    ];
    curKpis.forEach(k => {
      const row = ws.getRow(curRowIdx);
      row.values = [k[0], k[1]];
      row.height = 22;
      row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF475569' } };
      row.getCell(1).fill = sectionFill;
      row.getCell(1).border = thinBorder;
      row.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
      row.getCell(2).border = thinBorder;
      curRowIdx++;
    });

    curRowIdx++;

    // 5. Top Customer Demand Drivers
    ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
    const sec3 = ws.getCell(`A${curRowIdx}`);
    sec3.value = 'TOP CUSTOMER DEMAND DRIVERS';
    sec3.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sec3.fill = navyHeaderFill;
    sec3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(curRowIdx).height = 24;
    curRowIdx++;

    const custHeaders = ['#', 'Customer Name', 'Company', 'Volume Ordered', 'Orders', 'Demand Share %'];
    const hRowCust = ws.getRow(curRowIdx);
    hRowCust.height = 24;
    custHeaders.forEach((h, idx) => {
      const cell = hRowCust.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = sectionFill;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: idx >= 3 ? 'right' : 'left' };
    });
    curRowIdx++;

    const topDrivers = productBreakdown.topContributingCustomers || [];
    if (topDrivers.length > 0) {
      topDrivers.slice(0, 10).forEach((c, idx) => {
        const row = ws.getRow(curRowIdx);
        row.height = 22;
        const vals = [
          idx + 1,
          c.customerName || 'Customer',
          c.company && c.company !== '—' ? c.company : '—',
          c.qty || 0,
          c.orderCount || 1,
          `${c.percentage || 0}%`
        ];
        vals.forEach((v, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = v;
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: cIdx >= 3 ? 'right' : 'left' };
          if (cIdx === 3) cell.numFmt = '#,##0';
        });
        curRowIdx++;
      });
    } else {
      const row = ws.getRow(curRowIdx);
      ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
      row.getCell('A').value = 'No customer breakdown recorded for this period.';
      row.getCell('A').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
      row.height = 20;
      curRowIdx++;
    }

    // Set column widths
    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 24;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 18;

    const safeName = cleanProdName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Production_Dossier.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating product production Excel dossier:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating product production Excel dossier' });
    }
  }
};

module.exports = {
  getDimensionForecast,
  getAllDimensionsForecast,
  getDimensionHistory,
  getDimensionsList,
  getCurrentMonthProductsSold,
  exportAllProductionExcel,
  exportProductProductionExcel
};
