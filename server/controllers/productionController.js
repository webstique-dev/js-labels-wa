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
 * Core In-Memory Calculation Engine:
 * Computes trailing-average demand forecast ranges, customer driver rankings,
 * product-level breakdowns, and live calendar month sales ledger across all dimensions
 * with zero N+1 database roundtrips.
 */
async function computeAllForecastsEngine(trailingMonthsCount = 2, targetDate = new Date(), filterDimensionKey = null) {
  const N = Math.max(1, Math.min(parseInt(trailingMonthsCount, 10) || 2, 12));
  const now = targetDate instanceof Date && !isNaN(targetDate.getTime()) ? targetDate : new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const forecastForMonth = formatYearMonth(`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`);
  const currentMonthFormatted = formatYearMonth(currentYearMonth);

  const [orders, products, customers] = await Promise.all([
    Order.find({ isDeleted: { $ne: true }, status: { $ne: 'cancelled' } }).lean(),
    Product.find({ isDeleted: { $ne: true } }).lean(),
    Customer.find({ isDeleted: { $ne: true } }).select('_id name company').lean()
  ]);

  const custMap = new Map();
  customers.forEach(c => custMap.set(c._id.toString(), c));

  const prodByName = new Map();
  const prodByDim = new Map();
  const catMap = {};

  products.forEach(p => {
    if (p.name) {
      prodByName.set(p.name, p);
      if (p.category) catMap[p.name] = p.category;
    }
    const dKeys = [];
    if (p.dimensionKey) dKeys.push(p.dimensionKey.trim().toLowerCase());
    if (p.widthMm && p.heightMm) dKeys.push(`${p.widthMm}x${p.heightMm}`.toLowerCase());

    dKeys.forEach(k => {
      if (!prodByDim.has(k)) prodByDim.set(k, []);
      prodByDim.get(k).push(p);
    });
  });

  const dimSet = new Set();
  const flattenedLines = [];

  orders.forEach(ord => {
    const d = ord.orderDate || ord.createdAt;
    const dateObj = d ? new Date(d) : new Date();
    const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const custId = ord.customerId ? ord.customerId.toString() : null;

    (ord.lineItems || []).forEach(li => {
      const dKey = (li.dimensionKey || '').trim();
      if (!dKey) return;
      const qty = li.qty || 0;
      const price = li.price || 0;
      const lineTotal = li.lineTotal != null ? li.lineTotal : (qty * price);

      dimSet.add(dKey);
      flattenedLines.push({
        orderId: ord._id.toString(),
        customerId: custId,
        orderDate: dateObj,
        yearMonth: ym,
        name: li.name || '',
        dimensionKey: dKey,
        lowerDim: dKey.toLowerCase(),
        qty,
        price,
        lineTotal
      });
    });
  });

  let cleanDims = Array.from(dimSet);
  if (filterDimensionKey) {
    const target = filterDimensionKey.trim().toLowerCase();
    cleanDims = cleanDims.filter(d => d.toLowerCase() === target);
    if (cleanDims.length === 0) {
      cleanDims = [filterDimensionKey.trim()];
    }
  }

  const forecasts = [];

  for (const cleanDimKey of cleanDims) {
    const lowerTarget = cleanDimKey.toLowerCase();
    const matchingLines = flattenedLines.filter(l => l.lowerDim === lowerTarget);

    // 1. Group by completed yearMonth (< currentYearMonth)
    const completedMonthMap = new Map();
    const currentMonthLines = [];

    matchingLines.forEach(l => {
      if (l.yearMonth < currentYearMonth) {
        if (!completedMonthMap.has(l.yearMonth)) {
          completedMonthMap.set(l.yearMonth, { totalQty: 0, distinctOrders: new Set() });
        }
        const m = completedMonthMap.get(l.yearMonth);
        m.totalQty += l.qty;
        m.distinctOrders.add(l.orderId);
      } else if (l.yearMonth === currentYearMonth) {
        currentMonthLines.push(l);
      }
    });

    const sortedCompletedYMs = Array.from(completedMonthMap.keys()).sort().reverse().slice(0, N);
    const trailingMonths = sortedCompletedYMs.reverse().map(ym => {
      const data = completedMonthMap.get(ym);
      return {
        yearMonth: ym,
        month: formatYearMonth(ym),
        totalQty: data.totalQty,
        orderCount: data.distinctOrders.size
      };
    });

    const dimCatalogProds = prodByDim.get(lowerTarget) || [];
    const productNamesSet = new Set(dimCatalogProds.map(p => p.name).filter(Boolean));
    const categoriesSet = new Set(dimCatalogProds.map(p => p.category).filter(Boolean));

    matchingLines.forEach(l => {
      if (l.name) productNamesSet.add(l.name);
    });

    const productNames = Array.from(productNamesSet);
    const categories = Array.from(categoriesSet);

    // Current month stats
    let currentMonthSoldQty = 0;
    let currentMonthRevenue = 0;
    const curDistinctOrders = new Set();
    const curCustMapLocal = new Map();
    const curProdMapLocal = new Map();

    currentMonthLines.forEach(l => {
      currentMonthSoldQty += l.qty;
      currentMonthRevenue += l.lineTotal;
      curDistinctOrders.add(l.orderId);

      const pName = l.name || cleanDimKey;
      if (!curProdMapLocal.has(pName)) {
        curProdMapLocal.set(pName, { productName: pName, totalQty: 0, totalRevenue: 0, distinctOrders: new Set() });
      }
      const pData = curProdMapLocal.get(pName);
      pData.totalQty += l.qty;
      pData.totalRevenue += l.lineTotal;
      pData.distinctOrders.add(l.orderId);

      if (l.customerId) {
        if (!curCustMapLocal.has(l.customerId)) {
          curCustMapLocal.set(l.customerId, { qty: 0, revenue: 0 });
        }
        const cData = curCustMapLocal.get(l.customerId);
        cData.qty += l.qty;
        cData.revenue += l.lineTotal;
      }
    });

    const currentMonthProducts = Array.from(curProdMapLocal.values()).map(p => ({
      productName: p.productName,
      totalQty: p.totalQty,
      totalRevenue: Math.round(p.totalRevenue * 100) / 100,
      orderCount: p.distinctOrders.size
    })).sort((a, b) => b.totalQty - a.totalQty);

    const currentMonthCustomers = Array.from(curCustMapLocal.entries()).map(([cid, data]) => {
      const doc = custMap.get(cid) || {};
      const pct = currentMonthSoldQty > 0 ? Math.round((data.qty / currentMonthSoldQty) * 100) : 0;
      return {
        customerId: cid,
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: data.qty,
        revenue: Math.round(data.revenue * 100) / 100,
        percentage: pct
      };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);

    const availableMonthsCount = trailingMonths.length;

    // Monthly totals and drivers across all recorded months
    const allMonthsTotalsMap = new Map();
    const allMonthsCustMap = new Map();

    matchingLines.forEach(l => {
      const ym = l.yearMonth;
      if (!allMonthsTotalsMap.has(ym)) {
        allMonthsTotalsMap.set(ym, { totalQty: 0, totalRevenue: 0, distinctOrders: new Set() });
        allMonthsCustMap.set(ym, new Map());
      }
      const mTot = allMonthsTotalsMap.get(ym);
      mTot.totalQty += l.qty;
      mTot.totalRevenue += l.lineTotal;
      mTot.distinctOrders.add(l.orderId);

      if (l.customerId) {
        const cMap = allMonthsCustMap.get(ym);
        if (!cMap.has(l.customerId)) {
          cMap.set(l.customerId, { qty: 0, revenue: 0, distinctOrders: new Set() });
        }
        const cEntry = cMap.get(l.customerId);
        cEntry.qty += l.qty;
        cEntry.revenue += l.lineTotal;
        cEntry.distinctOrders.add(l.orderId);
      }
    });

    const availableMonths = Array.from(allMonthsTotalsMap.keys()).sort().reverse().map(ym => {
      const data = allMonthsTotalsMap.get(ym);
      return {
        yearMonth: ym,
        month: formatYearMonth(ym),
        totalQty: data.totalQty,
        totalRevenue: Math.round(data.totalRevenue * 100) / 100,
        orderCount: data.distinctOrders.size
      };
    });

    const monthlyDrivers = {};
    for (const ym of allMonthsTotalsMap.keys()) {
      const tot = allMonthsTotalsMap.get(ym);
      const cMap = allMonthsCustMap.get(ym);
      const drivers = Array.from(cMap.entries()).map(([cid, data]) => {
        const doc = custMap.get(cid) || {};
        const pct = tot.totalQty > 0 ? Math.round((data.qty / tot.totalQty) * 100) : 0;
        return {
          customerId: cid,
          customerName: doc.name || doc.company || 'Customer Account',
          company: doc.company || '—',
          qty: data.qty,
          revenue: Math.round(data.revenue * 100) / 100,
          orderCount: data.distinctOrders.size,
          percentage: pct
        };
      }).sort((a, b) => b.qty - a.qty);

      monthlyDrivers[ym] = {
        yearMonth: ym,
        month: formatYearMonth(ym),
        totalQty: tot.totalQty,
        totalRevenue: Math.round(tot.totalRevenue * 100) / 100,
        orderCount: tot.distinctOrders.size,
        drivers
      };
    }

    if (availableMonthsCount === 0) {
      forecasts.push({
        dimensionKey: cleanDimKey,
        forecastForMonth,
        currentMonth: currentMonthFormatted,
        currentMonthYearMonth: currentYearMonth,
        currentMonthSoldQty,
        currentMonthRevenue: Math.round(currentMonthRevenue * 100) / 100,
        currentMonthOrderCount: curDistinctOrders.size,
        currentMonthProducts,
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
        topContributingCustomers: [],
        availableMonths,
        monthlyDrivers,
        productBreakdowns: {}
      });
      continue;
    }

    const individualQtys = trailingMonths.map(m => m.totalQty);
    const sumTrailing = individualQtys.reduce((sum, q) => sum + q, 0);
    const averagePerMonth = Math.round(sumTrailing / availableMonthsCount);
    const forecastRangeLow = availableMonthsCount === 1 ? individualQtys[0] : Math.min(...individualQtys);
    const forecastRangeHigh = availableMonthsCount === 1 ? individualQtys[0] : Math.max(...individualQtys);
    const lowConfidence = availableMonthsCount === 1;

    const trailingPeriodLabel = availableMonthsCount === 1
      ? trailingMonths[0].month
      : `${trailingMonths[0].month} – ${trailingMonths[trailingMonths.length - 1].month}`;

    const trailingYearMonths = new Set(trailingMonths.map(m => m.yearMonth));
    const trailingCustMap = new Map();

    matchingLines.forEach(l => {
      if (trailingYearMonths.has(l.yearMonth) && l.customerId) {
        if (!trailingCustMap.has(l.customerId)) {
          trailingCustMap.set(l.customerId, { qty: 0, revenue: 0, distinctOrders: new Set() });
        }
        const entry = trailingCustMap.get(l.customerId);
        entry.qty += l.qty;
        entry.revenue += l.lineTotal;
        entry.distinctOrders.add(l.orderId);
      }
    });

    const topContributingCustomers = Array.from(trailingCustMap.entries()).map(([cid, data]) => {
      const doc = custMap.get(cid) || {};
      const pct = sumTrailing > 0 ? Math.round((data.qty / sumTrailing) * 100) : 0;
      return {
        customerId: cid,
        customerName: doc.name || doc.company || 'Customer Account',
        company: doc.company || '—',
        qty: data.qty,
        revenue: Math.round(data.revenue * 100) / 100,
        orderCount: data.distinctOrders.size,
        percentage: pct
      };
    }).sort((a, b) => b.qty - a.qty).slice(0, 10);

    monthlyDrivers['trailing'] = {
      yearMonth: 'trailing',
      month: `Trailing Horizon (${trailingPeriodLabel})`,
      totalQty: sumTrailing,
      totalRevenue: Math.round(topContributingCustomers.reduce((acc, c) => acc + (c.revenue || 0), 0) * 100) / 100,
      orderCount: trailingMonths.reduce((acc, m) => acc + (m.orderCount || 0), 0),
      drivers: topContributingCustomers
    };

    // Product-level breakdown
    const productBreakdowns = {};
    for (const pName of productNames) {
      const pCatalog = prodByName.get(pName) || {};
      const pLines = matchingLines.filter(l => l.name === pName);

      const pCompMap = new Map();
      pLines.forEach(l => {
        if (l.yearMonth < currentYearMonth) {
          if (!pCompMap.has(l.yearMonth)) pCompMap.set(l.yearMonth, { totalQty: 0, totalRevenue: 0, distinctOrders: new Set() });
          const entry = pCompMap.get(l.yearMonth);
          entry.totalQty += l.qty;
          entry.totalRevenue += l.lineTotal;
          entry.distinctOrders.add(l.orderId);
        }
      });

      const pSortedYMs = Array.from(pCompMap.keys()).sort().reverse().slice(0, N);
      const pTrailingMonths = pSortedYMs.reverse().map(ym => {
        const d = pCompMap.get(ym);
        return {
          yearMonth: ym,
          month: formatYearMonth(ym),
          totalQty: d.totalQty,
          totalRevenue: Math.round(d.totalRevenue * 100) / 100,
          orderCount: d.distinctOrders.size
        };
      });

      const pAvailCount = pTrailingMonths.length;
      const pQtys = pTrailingMonths.map(m => m.totalQty);
      const pSumTrailing = pQtys.reduce((sum, q) => sum + q, 0);
      const pAvgPerMonth = pAvailCount > 0 ? Math.round(pSumTrailing / pAvailCount) : null;
      const pRangeLow = pAvailCount === 1 ? pQtys[0] : (pAvailCount > 1 ? Math.min(...pQtys) : null);
      const pRangeHigh = pAvailCount === 1 ? pQtys[0] : (pAvailCount > 1 ? Math.max(...pQtys) : null);
      const pLowConf = pAvailCount <= 1;

      const pTrailingPeriodLabel = pAvailCount === 1
        ? pTrailingMonths[0].month
        : (pAvailCount > 1 ? `${pTrailingMonths[0].month} – ${pTrailingMonths[pTrailingMonths.length - 1].month}` : 'No prior records');

      const pCurLines = pLines.filter(l => l.yearMonth === currentYearMonth);
      let pCurQty = 0;
      let pCurRev = 0;
      const pCurOrders = new Set();
      const pCurCustMap = new Map();

      pCurLines.forEach(l => {
        pCurQty += l.qty;
        pCurRev += l.lineTotal;
        pCurOrders.add(l.orderId);
        if (l.customerId) {
          if (!pCurCustMap.has(l.customerId)) pCurCustMap.set(l.customerId, { qty: 0, revenue: 0 });
          const c = pCurCustMap.get(l.customerId);
          c.qty += l.qty;
          c.revenue += l.lineTotal;
        }
      });

      const pCurCustomers = Array.from(pCurCustMap.entries()).map(([cid, data]) => {
        const doc = custMap.get(cid) || {};
        const pct = pCurQty > 0 ? Math.round((data.qty / pCurQty) * 100) : 0;
        return {
          customerId: cid,
          customerName: doc.name || doc.company || 'Customer Account',
          company: doc.company || '—',
          qty: data.qty,
          revenue: Math.round(data.revenue * 100) / 100,
          orderCount: 1,
          percentage: pct
        };
      }).sort((a, b) => b.qty - a.qty);

      const pMonthsTotalsMap = new Map();
      const pMonthsCustMap = new Map();
      pLines.forEach(l => {
        if (!pMonthsTotalsMap.has(l.yearMonth)) {
          pMonthsTotalsMap.set(l.yearMonth, { totalQty: 0, totalRevenue: 0, distinctOrders: new Set() });
          pMonthsCustMap.set(l.yearMonth, new Map());
        }
        const m = pMonthsTotalsMap.get(l.yearMonth);
        m.totalQty += l.qty;
        m.totalRevenue += l.lineTotal;
        m.distinctOrders.add(l.orderId);

        if (l.customerId) {
          const cm = pMonthsCustMap.get(l.yearMonth);
          if (!cm.has(l.customerId)) cm.set(l.customerId, { qty: 0, revenue: 0, distinctOrders: new Set() });
          const ce = cm.get(l.customerId);
          ce.qty += l.qty;
          ce.revenue += l.lineTotal;
          ce.distinctOrders.add(l.orderId);
        }
      });

      const pAvailableMonths = Array.from(pMonthsTotalsMap.keys()).sort().reverse().map(ym => {
        const d = pMonthsTotalsMap.get(ym);
        return {
          yearMonth: ym,
          month: formatYearMonth(ym),
          totalQty: d.totalQty,
          totalRevenue: Math.round(d.totalRevenue * 100) / 100,
          orderCount: d.distinctOrders.size
        };
      });

      const pMonthlyDrivers = {};
      for (const ym of pMonthsTotalsMap.keys()) {
        const tot = pMonthsTotalsMap.get(ym);
        const cm = pMonthsCustMap.get(ym);
        const drivers = Array.from(cm.entries()).map(([cid, data]) => {
          const doc = custMap.get(cid) || {};
          const pct = tot.totalQty > 0 ? Math.round((data.qty / tot.totalQty) * 100) : 0;
          return {
            customerId: cid,
            customerName: doc.name || doc.company || 'Customer Account',
            company: doc.company || '—',
            qty: data.qty,
            revenue: Math.round(data.revenue * 100) / 100,
            orderCount: data.distinctOrders.size,
            percentage: pct
          };
        }).sort((a, b) => b.qty - a.qty);

        pMonthlyDrivers[ym] = {
          yearMonth: ym,
          month: formatYearMonth(ym),
          totalQty: tot.totalQty,
          totalRevenue: Math.round(tot.totalRevenue * 100) / 100,
          orderCount: tot.distinctOrders.size,
          drivers
        };
      }

      const pTrailingYMs = new Set(pTrailingMonths.map(m => m.yearMonth));
      const pTrailingCustMap = new Map();
      pLines.forEach(l => {
        if (pTrailingYMs.has(l.yearMonth) && l.customerId) {
          if (!pTrailingCustMap.has(l.customerId)) pTrailingCustMap.set(l.customerId, { qty: 0, revenue: 0, distinctOrders: new Set() });
          const ce = pTrailingCustMap.get(l.customerId);
          ce.qty += l.qty;
          ce.revenue += l.lineTotal;
          ce.distinctOrders.add(l.orderId);
        }
      });

      const pTopCustomers = Array.from(pTrailingCustMap.entries()).map(([cid, data]) => {
        const doc = custMap.get(cid) || {};
        const pct = pSumTrailing > 0 ? Math.round((data.qty / pSumTrailing) * 100) : 0;
        return {
          customerId: cid,
          customerName: doc.name || doc.company || 'Customer Account',
          company: doc.company || '—',
          qty: data.qty,
          revenue: Math.round(data.revenue * 100) / 100,
          orderCount: data.distinctOrders.size,
          percentage: pct
        };
      }).sort((a, b) => b.qty - a.qty).slice(0, 10);

      pMonthlyDrivers['trailing'] = {
        yearMonth: 'trailing',
        month: `Trailing Horizon (${pTrailingPeriodLabel})`,
        totalQty: pSumTrailing,
        totalRevenue: Math.round(pTopCustomers.reduce((acc, c) => acc + (c.revenue || 0), 0) * 100) / 100,
        orderCount: pTrailingMonths.reduce((acc, m) => acc + (m.orderCount || 0), 0),
        drivers: pTopCustomers
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
        currentMonthSoldQty: pCurQty,
        currentMonthRevenue: Math.round(pCurRev * 100) / 100,
        currentMonthOrderCount: pCurOrders.size,
        currentMonthCustomers: pCurCustomers,
        availableMonths: pAvailableMonths,
        monthlyDrivers: pMonthlyDrivers,
        topContributingCustomers: pTopCustomers
      };
    }

    forecasts.push({
      dimensionKey: cleanDimKey,
      forecastForMonth,
      currentMonth: currentMonthFormatted,
      currentMonthYearMonth: currentYearMonth,
      currentMonthSoldQty,
      currentMonthRevenue: Math.round(currentMonthRevenue * 100) / 100,
      currentMonthOrderCount: curDistinctOrders.size,
      currentMonthProducts,
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
    });
  }

  // Sort by forecastRangeHigh descending, then sumTrailing descending
  forecasts.sort((a, b) => {
    const highA = a.forecastRangeHigh ?? (a.insufficientData ? -1 : 0);
    const highB = b.forecastRangeHigh ?? (b.insufficientData ? -1 : 0);
    if (highB !== highA) return highB - highA;
    return (b.sumTrailing || 0) - (a.sumTrailing || 0);
  });

  // Current calendar month summary across entire catalog
  const curAllLines = flattenedLines.filter(l => l.yearMonth === currentYearMonth);
  let totalCurrentMonthSoldQty = 0;
  let totalCurrentMonthRevenue = 0;
  const globalDistinctOrders = new Set();
  const globalCurProdMap = new Map();

  curAllLines.forEach(l => {
    totalCurrentMonthSoldQty += l.qty;
    totalCurrentMonthRevenue += l.lineTotal;
    globalDistinctOrders.add(l.orderId);

    const prodKey = `${l.name}:::${l.dimensionKey}`;
    if (!globalCurProdMap.has(prodKey)) {
      globalCurProdMap.set(prodKey, {
        productName: l.name || 'Unnamed Product',
        dimensionKey: l.dimensionKey || 'Standard',
        category: catMap[l.name] || 'Label',
        totalQty: 0,
        totalRevenue: 0,
        distinctOrders: new Set(),
        distinctCustomers: new Set()
      });
    }
    const pEntry = globalCurProdMap.get(prodKey);
    pEntry.totalQty += l.qty;
    pEntry.totalRevenue += l.lineTotal;
    pEntry.distinctOrders.add(l.orderId);
    if (l.customerId) pEntry.distinctCustomers.add(l.customerId);
  });

  const productsSoldCurrentMonth = Array.from(globalCurProdMap.values()).map(item => {
    const buyingCustomers = Array.from(item.distinctCustomers).map(cid => {
      const doc = custMap.get(cid);
      return doc?.name || doc?.company || null;
    }).filter(Boolean);

    return {
      productName: item.productName,
      dimensionKey: item.dimensionKey,
      category: item.category,
      totalQty: item.totalQty,
      totalRevenue: Math.round(item.totalRevenue * 100) / 100,
      orderCount: item.distinctOrders.size,
      customerCount: item.distinctCustomers.size,
      buyingCustomers: Array.from(new Set(buyingCustomers))
    };
  }).sort((a, b) => b.totalQty - a.totalQty);

  const currentMonthSummary = {
    currentMonth: currentMonthFormatted,
    currentMonthYearMonth: currentYearMonth,
    totalSoldQty: totalCurrentMonthSoldQty,
    totalRevenue: Math.round(totalCurrentMonthRevenue * 100) / 100,
    totalOrders: globalDistinctOrders.size,
    distinctProductsCount: productsSoldCurrentMonth.length,
    productsSold: productsSoldCurrentMonth
  };

  return {
    forecastForMonth,
    currentMonth: currentMonthFormatted,
    trailingMonthsCount: N,
    totalDimensions: forecasts.length,
    currentMonthSummary,
    forecasts
  };
}

/**
 * Core Helper: Computes a trailing-average forecast range for a single dimensionKey
 */
const computeDimensionForecast = async (dimensionKey, trailingMonthsCount = 2, targetDate = new Date()) => {
  const result = await computeAllForecastsEngine(trailingMonthsCount, targetDate, dimensionKey);
  return result.forecasts[0] || {
    dimensionKey: dimensionKey.trim(),
    forecastForMonth: result.forecastForMonth,
    currentMonth: result.currentMonth,
    currentMonthYearMonth: result.currentMonthSummary?.currentMonthYearMonth || '',
    currentMonthSoldQty: 0,
    currentMonthRevenue: 0,
    currentMonthOrderCount: 0,
    currentMonthProducts: [],
    currentMonthCustomers: [],
    trailingMonthsCount: result.trailingMonthsCount,
    completedMonthsAvailable: 0,
    trailingMonths: [],
    sumTrailing: 0,
    averagePerMonth: null,
    forecastRangeLow: null,
    forecastRangeHigh: null,
    lowConfidence: true,
    insufficientData: true,
    productNames: [],
    categories: [],
    mostRecentCompletedMonth: null,
    topContributingCustomers: [],
    availableMonths: [],
    monthlyDrivers: {},
    productBreakdowns: {}
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
    const result = await computeAllForecastsEngine(N, new Date());
    return res.json(result);
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

    const result = await computeAllForecastsEngine(N, new Date());
    const { forecasts, currentMonthSummary, forecastForMonth, currentMonth: currentMonthFormatted } = result;

    // Catalog products for enrichment
    const catalogProducts = await Product.find({ isDeleted: { $ne: true } }).lean();
    const productCatalogMap = {};
    catalogProducts.forEach(p => {
      if (p.name) productCatalogMap[p.name] = p;
    });

    const customerLookup = {};
    const custDocs = await Customer.find({ isDeleted: { $ne: true } }, { name: 1, company: 1 }).lean();
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
