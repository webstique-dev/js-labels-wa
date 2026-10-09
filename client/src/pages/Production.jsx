import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import {
  exportAllProductionToExcel,
  exportProductProductionToExcel
} from '../utils/exportUtils';
import {
  Factory,
  Layers,
  Ruler,
  TrendingUp,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Users,
  ChevronRight,
  Info,
  Calendar,
  PackageCheck,
  ShoppingCart,
  CheckCircle2,
  Tag,
  BarChart3,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  Table as TableIcon,
  X,
  ExternalLink,
  ChevronDown,
  Percent,
  SlidersHorizontal
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

export default function Production() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('machine-dimensions'); // 'machine-dimensions' | 'products' | 'current-month-sales'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' (for products tab)
  const [trailingMonths, setTrailingMonths] = useState(2);
  const [forecastData, setForecastData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('qty'); // 'qty' | 'forecast' | 'orders' | 'name'
  const [selectedDriverMonths, setSelectedDriverMonths] = useState({}); // { [key]: 'trailing' | '2026-08' | ... }
  const [selectedDimensionProducts, setSelectedDimensionProducts] = useState({}); // { [dimensionKey]: 'all' | productName }
  
  // Export loading states
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingProduct, setExportingProduct] = useState({}); // { [prodKey]: boolean }

  // Modal State for viewing full product dossier
  const [modalProduct, setModalProduct] = useState(null);
  const [modalDriverMonth, setModalDriverMonth] = useState('trailing');

  const fetchForecasts = useCallback(async (months = trailingMonths) => {
    try {
      setLoading(true);
      const res = await api.get(`/production/forecast-all?trailingMonths=${months}`);
      setForecastData(res.data);
    } catch (err) {
      console.error('Error fetching production forecasts:', err);
      notify.error(err.response?.data?.message || 'Failed to load production forecasts');
    } finally {
      setLoading(false);
    }
  }, [trailingMonths, notify]);

  useEffect(() => {
    fetchForecasts(trailingMonths);
  }, [trailingMonths, fetchForecasts]);

  // Helper to format dimension nicely: "4x45" -> "4mm × 45mm"
  const formatDimensionDimensions = (dimKey) => {
    if (!dimKey || !dimKey.includes('x')) return dimKey || '—';
    const [w, h] = dimKey.split('x');
    return `${w}mm × ${h}mm`;
  };

  // Helper to calculate trend between trailing months
  const getTrendData = (trailingMonthsArr) => {
    if (!trailingMonthsArr || trailingMonthsArr.length < 2) return null;
    const m1 = trailingMonthsArr[trailingMonthsArr.length - 2].totalQty || 0;
    const m2 = trailingMonthsArr[trailingMonthsArr.length - 1].totalQty || 0;

    if (m1 === 0) {
      return { direction: 'flat', pct: 0, label: 'Stable (0%)' };
    }

    const pctChange = Math.round(((m2 - m1) / m1) * 100);
    if (pctChange > 0) {
      return { direction: 'up', pct: pctChange, label: `+${pctChange}% vs prev` };
    } else if (pctChange < 0) {
      return { direction: 'down', pct: Math.abs(pctChange), label: `${pctChange}% vs prev` };
    }
    return { direction: 'flat', pct: 0, label: 'Stable (0%)' };
  };

  // Build Comprehensive List of All Specific Products
  const allSpecificProducts = useMemo(() => {
    if (!forecastData?.forecasts) return [];
    const list = [];
    const seenMap = new Map();

    forecastData.forecasts.forEach(d => {
      if (d.productBreakdowns && Object.keys(d.productBreakdowns).length > 0) {
        Object.values(d.productBreakdowns).forEach(pb => {
          const uniqueKey = `${pb.productName}___${d.dimensionKey}`;
          if (!seenMap.has(uniqueKey)) {
            const item = {
              ...pb,
              dimensionKey: d.dimensionKey,
              forecastForMonth: d.forecastForMonth,
              currentMonth: d.currentMonth,
              dimensionForecastRangeHigh: d.forecastRangeHigh,
              uniqueKey
            };
            seenMap.set(uniqueKey, item);
            list.push(item);
          }
        });
      } else if (d.productNames && d.productNames.length > 0) {
        d.productNames.forEach(pName => {
          const uniqueKey = `${pName}___${d.dimensionKey}`;
          if (!seenMap.has(uniqueKey)) {
            const item = {
              productName: pName,
              dimensionKey: d.dimensionKey,
              category: (d.categories && d.categories[0]) || 'Label',
              unitPrice: null,
              forecastRangeLow: d.forecastRangeLow,
              forecastRangeHigh: d.forecastRangeHigh,
              lowConfidence: d.lowConfidence,
              insufficientData: d.insufficientData,
              forecastForMonth: d.forecastForMonth,
              currentMonth: d.currentMonth,
              currentMonthSoldQty: d.currentMonthSoldQty || 0,
              currentMonthRevenue: d.currentMonthRevenue || 0,
              currentMonthOrderCount: d.currentMonthOrderCount || 0,
              currentMonthCustomers: d.currentMonthCustomers || [],
              sumTrailing: d.sumTrailing || 0,
              averagePerMonth: d.averagePerMonth || 0,
              trailingMonths: d.trailingMonths || [],
              trailingPeriodLabel: d.trailingPeriodLabel || '',
              monthlyDrivers: d.monthlyDrivers || {},
              topContributingCustomers: d.topContributingCustomers || [],
              availableMonths: d.availableMonths || [],
              uniqueKey
            };
            seenMap.set(uniqueKey, item);
            list.push(item);
          }
        });
      }
    });

    // Also include products from currentMonthSummary.productsSold if not present
    if (forecastData.currentMonthSummary?.productsSold) {
      forecastData.currentMonthSummary.productsSold.forEach(p => {
        const uniqueKey = `${p.productName}___${p.dimensionKey}`;
        if (!seenMap.has(uniqueKey)) {
          const item = {
            productName: p.productName,
            dimensionKey: p.dimensionKey,
            category: p.category || 'Label',
            unitPrice: null,
            forecastRangeLow: null,
            forecastRangeHigh: null,
            lowConfidence: true,
            insufficientData: true,
            forecastForMonth: forecastData.forecastForMonth,
            currentMonth: forecastData.currentMonth,
            currentMonthSoldQty: p.totalQty || 0,
            currentMonthRevenue: p.totalRevenue || 0,
            currentMonthOrderCount: p.orderCount || 0,
            currentMonthCustomers: (p.buyingCustomers || []).map(name => ({ customerName: name, percentage: 0 })),
            sumTrailing: 0,
            averagePerMonth: 0,
            trailingMonths: [],
            trailingPeriodLabel: 'No prior completed records',
            monthlyDrivers: {},
            topContributingCustomers: [],
            availableMonths: [],
            uniqueKey
          };
          seenMap.set(uniqueKey, item);
          list.push(item);
        }
      });
    }

    return list;
  }, [forecastData]);

  // Extract all unique categories across all products and dimensions
  const allCategories = useMemo(() => {
    const catSet = new Set();
    allSpecificProducts.forEach(p => {
      if (p.category) catSet.add(p.category);
    });
    if (forecastData?.forecasts) {
      forecastData.forecasts.forEach(f => {
        (f.categories || []).forEach(c => catSet.add(c));
      });
    }
    return Array.from(catSet).sort();
  }, [allSpecificProducts, forecastData]);

  // Filter & Sort All Specific Products
  const filteredSpecificProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let list = allSpecificProducts.filter(p => {
      const matchesSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        p.dimensionKey.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.topContributingCustomers || []).some(c =>
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q))
        ) ||
        (p.currentMonthCustomers || []).some(c =>
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q))
        );

      const matchesCat =
        selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCat;
    });

    list.sort((a, b) => {
      if (sortBy === 'forecast') {
        const fA = a.forecastRangeHigh ?? -1;
        const fB = b.forecastRangeHigh ?? -1;
        if (fB !== fA) return fB - fA;
        return (b.currentMonthSoldQty || 0) - (a.currentMonthSoldQty || 0);
      }
      if (sortBy === 'revenue') {
        return (b.currentMonthRevenue || 0) - (a.currentMonthRevenue || 0);
      }
      if (sortBy === 'orders') {
        return (b.currentMonthOrderCount || 0) - (a.currentMonthOrderCount || 0);
      }
      if (sortBy === 'name') {
        return a.productName.localeCompare(b.productName);
      }
      // Default: 'qty' (Volume Sold)
      const qA = a.currentMonthSoldQty || 0;
      const qB = b.currentMonthSoldQty || 0;
      if (qB !== qA) return qB - qA;
      return (b.forecastRangeHigh || 0) - (a.forecastRangeHigh || 0);
    });

    return list;
  }, [allSpecificProducts, searchTerm, selectedCategory, sortBy]);

  // Filter Machine Dimensions view
  const filteredForecasts = useMemo(() => {
    if (!forecastData?.forecasts) return [];
    return forecastData.forecasts.filter(f => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        f.dimensionKey.toLowerCase().includes(q) ||
        (f.productNames || []).some(p => p.toLowerCase().includes(q)) ||
        (f.topContributingCustomers || []).some(c => c.customerName.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)) ||
        (f.currentMonthCustomers || []).some(c => c.customerName.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === 'all' ||
        (f.categories || []).includes(selectedCategory);

      return matchesSearch && matchesCat;
    });
  }, [forecastData, searchTerm, selectedCategory]);

  // Filter Current Month Products Sold Ledger
  const filteredCurrentMonthProducts = useMemo(() => {
    if (!forecastData?.currentMonthSummary?.productsSold) return [];
    let list = forecastData.currentMonthSummary.productsSold.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        p.dimensionKey.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.buyingCustomers || []).some(c => c.toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCat;
    });

    list.sort((a, b) => {
      if (sortBy === 'revenue') return b.totalRevenue - a.totalRevenue;
      if (sortBy === 'orders') return b.orderCount - a.orderCount;
      if (sortBy === 'name') return a.productName.localeCompare(b.productName);
      return b.totalQty - a.totalQty;
    });

    return list;
  }, [forecastData, searchTerm, selectedCategory, sortBy]);

  // Compute Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (!forecastData?.forecasts) {
      return {
        totalForecastVolume: 0,
        totalDimensions: 0,
        totalProductsCount: 0,
        totalBatchHoursSaved: 0,
        batchingDimensionsCount: 0,
        currentMonthSoldQty: 0,
        currentMonthRevenue: 0,
        currentMonthOrders: 0,
        currentMonthDistinctProducts: 0
      };
    }

    let totalForecastVolume = 0;
    let totalBatchHoursSaved = 0;
    let batchingDimensionsCount = 0;

    forecastData.forecasts.forEach(f => {
      if (f.forecastRangeHigh) {
        totalForecastVolume += f.forecastRangeHigh;
      }

      const recentMonth = f.trailingMonths?.[f.trailingMonths.length - 1];
      const recentOrders = recentMonth?.orderCount || 0;
      if (recentOrders > 1) {
        totalBatchHoursSaved += (recentOrders - 1) * 12;
        batchingDimensionsCount++;
      }
    });

    return {
      totalForecastVolume,
      totalDimensions: forecastData.totalDimensions || forecastData.forecasts.length,
      totalProductsCount: allSpecificProducts.length,
      totalBatchHoursSaved,
      batchingDimensionsCount,
      currentMonthSoldQty: forecastData.currentMonthSummary?.totalSoldQty || 0,
      currentMonthRevenue: forecastData.currentMonthSummary?.totalRevenue || 0,
      currentMonthOrders: forecastData.currentMonthSummary?.totalOrders || 0,
      currentMonthDistinctProducts: forecastData.currentMonthSummary?.distinctProductsCount || 0
    };
  }, [forecastData, allSpecificProducts]);

  // Handler: Export All to Excel
  const handleExportAll = async () => {
    try {
      setExportingAll(true);
      await exportAllProductionToExcel({
        trailingMonths,
        notify
      });
    } catch (err) {
      console.error('Export all failed:', err);
    } finally {
      setExportingAll(false);
    }
  };

  // Handler: Export Specific Product to Excel
  const handleExportProduct = async (product, e) => {
    if (e) e.stopPropagation();
    const prodKey = product.uniqueKey || `${product.productName}_${product.dimensionKey}`;
    try {
      setExportingProduct(prev => ({ ...prev, [prodKey]: true }));
      await exportProductProductionToExcel({
        productName: product.productName,
        dimensionKey: product.dimensionKey,
        trailingMonths,
        notify
      });
    } catch (err) {
      console.error('Product export failed:', err);
    } finally {
      setExportingProduct(prev => ({ ...prev, [prodKey]: false }));
    }
  };

  const currentMonthTitle = forecastData?.currentMonth || 'Current Month';
  const forecastMonthTitle = forecastData?.forecastForMonth || 'Upcoming Month';

  // Loading Skeleton State
  if (loading && !forecastData) {
    return (
      <div className="space-y-6 pb-12 font-sans animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-9 w-72 rounded-xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-44 rounded-xl" />
          </div>
        </div>

        {/* 4 Summary KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          ))}
        </div>

        {/* Product Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <Skeleton className="h-6 w-40 rounded-lg" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 2xl:space-y-8 pb-12 font-sans max-w-full overflow-hidden">
      
      {/* 1. TOP HEADER & PRIMARY ACTION CONTROLS */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-slate-900 tracking-tight">
              Production Planning & Demand Forecast
            </h1>
            <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 shadow-2xs">
              Live Production
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-md shrink-0 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {currentMonthTitle} Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
            Product-level demand forecasting, confirmed sales tracking, machine die batching, and automated production dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full xl:w-auto shrink-0 justify-between xl:justify-end flex-wrap">
          {/* Horizon Toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setTrailingMonths(2)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trailingMonths === 2
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Trailing 2 Mo
            </button>
            <button
              onClick={() => setTrailingMonths(3)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trailingMonths === 3
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Trailing 3 Mo
            </button>
          </div>

          {/* EXPORT ALL BUTTON */}
          <button
            onClick={handleExportAll}
            disabled={exportingAll || loading}
            title="Download complete production forecast data for all products in Excel format (.xlsx)"
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition font-semibold text-xs sm:text-sm cursor-pointer disabled:opacity-50 shrink-0"
          >
            {exportingAll ? (
              <RefreshCw size={15} className="animate-spin text-white" />
            ) : (
              <FileSpreadsheet size={16} className="text-white" />
            )}
            <span>{exportingAll ? 'Exporting...' : 'Export All (.xlsx)'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchForecasts(trailingMonths)}
            title="Refresh Forecast & Sales Data"
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-2xs transition cursor-pointer shrink-0"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE KPI CARDS (AT-A-GLANCE METRICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 2xl:gap-6">
        
        {/* Card 1: Total Forecasted Demand */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">Upcoming Demand Forecast</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            ~{summaryMetrics.totalForecastVolume.toLocaleString('en-IN')}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Labels</span>
          </div>
          <div className="text-xs font-semibold text-blue-600 flex items-center gap-1.5 truncate">
            <Calendar size={13} className="shrink-0" />
            <span className="truncate">Expected in {forecastMonthTitle}</span>
          </div>
        </div>

        {/* Card 2: Current Month Volume Sold */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">{currentMonthTitle} Volume Sold</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <PackageCheck size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            {summaryMetrics.currentMonthSoldQty.toLocaleString('en-IN')}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Units Sold</span>
          </div>
          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 truncate">
            <ShoppingCart size={13} className="shrink-0" />
            <span className="truncate">Across {summaryMetrics.currentMonthOrders} confirmed orders</span>
          </div>
        </div>

        {/* Card 3: Machine Setup Batching Efficiency */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">Setup Batching Efficiency</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            {summaryMetrics.totalBatchHoursSaved}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Hrs Saved</span>
          </div>
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 truncate">
            <Sparkles size={13} className="shrink-0" />
            <span className="truncate">{summaryMetrics.batchingDimensionsCount} multi-order machine dies</span>
          </div>
        </div>

        {/* Card 4: Production Dies & Scope */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">Production Dies & Scope</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Ruler size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            {summaryMetrics.totalDimensions}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1 font-sans">Dies</span>
            <span className="text-slate-300 font-normal mx-1.5">•</span>
            {summaryMetrics.totalProductsCount}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1 font-sans">Labels</span>
          </div>
          <div className="text-xs font-semibold text-purple-700 flex items-center gap-1.5 truncate">
            <Tag size={13} className="shrink-0" />
            <span className="truncate">Active machine setups & label products</span>
          </div>
        </div>

      </div>

      {/* 3. VIEW SWITCHER & FILTER CONTROLS TOOLBAR */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          
          {/* Main Navigation Tabs - Machine Dies & Setups FIRST & DEFAULT */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
            {/* Tab 1: Machine Dies & Setups (DEFAULT) */}
            <button
              onClick={() => setActiveTab('machine-dimensions')}
              className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'machine-dimensions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Factory size={15} className={activeTab === 'machine-dimensions' ? 'text-amber-600' : ''} />
              <span>Machine Dies & Setups</span>
              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded-md">
                {filteredForecasts.length}
              </span>
            </button>

            {/* Tab 2: Specific Products */}
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'products'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag size={15} className={activeTab === 'products' ? 'text-blue-600' : ''} />
              <span>Specific Products</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md">
                {filteredSpecificProducts.length}
              </span>
            </button>

            {/* Tab 3: Current Month Sales Ledger */}
            <button
              onClick={() => setActiveTab('current-month-sales')}
              className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'current-month-sales'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck size={15} className="text-emerald-600" />
              <span>{currentMonthTitle} Ledger</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md">
                {filteredCurrentMonthProducts.length}
              </span>
            </button>
          </div>

          {/* Search, Filter & Layout Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start xl:justify-end shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-44 md:w-52 lg:w-60 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'machine-dimensions'
                    ? "Search dies, dimensions, labels..."
                    : activeTab === 'products'
                    ? "Search products, sizes, buyers..."
                    : "Search products, buyers..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition truncate"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-900 transition cursor-pointer shrink-0 max-w-[140px] truncate"
            >
              <option value="all">All Categories</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-900 transition cursor-pointer shrink-0 max-w-[145px] truncate"
            >
              <option value="qty">Sort by Volume</option>
              {activeTab === 'products' && <option value="forecast">Sort by Demand</option>}
              <option value="orders">Sort by Orders</option>
              <option value="name">Sort by Name</option>
            </select>

            {/* View Mode Toggle (for Products tab) */}
            {activeTab === 'products' && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid Cards View"
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  title="Detailed Table View"
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TableIcon size={14} />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 4. VIEW 1: SPECIFIC PRODUCTS VIEW (PRIMARY) */}
      {activeTab === 'products' && (
        <>
          {filteredSpecificProducts.length > 0 ? (
            viewMode === 'grid' ? (
              /* GRID CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 2xl:gap-6">
                {filteredSpecificProducts.map((p, idx) => {
                  const trend = getTrendData(p.trailingMonths);
                  const isSingleVal = p.forecastRangeLow === p.forecastRangeHigh;
                  const hasForecast = p.forecastRangeHigh != null && !p.insufficientData;
                  const prodKey = p.uniqueKey || `${p.productName}_${p.dimensionKey}`;
                  const isExportingThis = !!exportingProduct[prodKey];

                  return (
                    <div
                      key={prodKey}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between space-y-4 group min-w-0"
                    >
                      {/* Product Header */}
                      <div className="space-y-2 border-b border-slate-100 pb-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h2
                              className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate group-hover:text-blue-600 transition"
                              title={p.productName}
                            >
                              {p.productName}
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-[11px] rounded-md shadow-2xs shrink-0">
                                [{p.dimensionKey}]
                              </span>
                              <span className="text-xs text-slate-500 font-semibold truncate">
                                {formatDimensionDimensions(p.dimensionKey)}
                              </span>
                            </div>
                          </div>

                          {/* Export Button for this Specific Product */}
                          <button
                            onClick={(e) => handleExportProduct(p, e)}
                            disabled={isExportingThis}
                            title={`Download ${p.productName} complete production dossier in Excel (.xlsx)`}
                            className="p-2 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-xl transition cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                          >
                            {isExportingThis ? (
                              <RefreshCw size={15} className="animate-spin text-emerald-600" />
                            ) : (
                              <Download size={15} />
                            )}
                          </button>
                        </div>

                        {/* Category Badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-md">
                            {p.category || 'Label'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            #{idx + 1}
                          </span>
                        </div>
                      </div>

                      {/* Demand Forecast Hero Box */}
                      <div className="p-3.5 bg-gradient-to-br from-slate-50 to-slate-100/70 rounded-xl border border-slate-200/80 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Layers size={12} className="text-blue-500" />
                            <span>Upcoming Demand Forecast</span>
                          </span>

                          {trend && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                trend.direction === 'up'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : trend.direction === 'down'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {trend.direction === 'up' && <ArrowUpRight size={12} className="shrink-0" />}
                              {trend.direction === 'down' && <ArrowDownRight size={12} className="shrink-0" />}
                              {trend.direction === 'flat' && <Minus size={12} className="shrink-0" />}
                              <span>{trend.label}</span>
                            </span>
                          )}
                        </div>

                        {/* Forecast Quantity Number */}
                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                          {hasForecast ? (
                            isSingleVal ? (
                              <>
                                ~{p.forecastRangeHigh.toLocaleString('en-IN')}{' '}
                                <span className="text-xs sm:text-sm font-bold text-slate-400">Labels</span>
                              </>
                            ) : (
                              <>
                                {p.forecastRangeLow.toLocaleString('en-IN')} – {p.forecastRangeHigh.toLocaleString('en-IN')}{' '}
                                <span className="text-xs sm:text-sm font-bold text-slate-400">Labels</span>
                              </>
                            )
                          ) : (
                            <span className="text-sm font-bold text-slate-400 italic">Insufficient History</span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 truncate">
                          <Calendar size={13} className="shrink-0" />
                          <span className="truncate">Expected in {p.forecastForMonth || forecastMonthTitle}</span>
                        </div>

                        {p.lowConfidence && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <AlertCircle size={11} className="shrink-0 text-amber-600" />
                            <span className="truncate">Based on single trailing month</span>
                          </div>
                        )}
                      </div>

                      {/* Current Month Actual Sales Progress */}
                      <div className="bg-emerald-50/70 border border-emerald-200/90 p-3 rounded-xl space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5 truncate">
                            <PackageCheck size={14} className="text-emerald-600 shrink-0" />
                            <span className="truncate">{p.currentMonth || currentMonthTitle} Sold</span>
                          </span>
                          <span className="text-emerald-700 font-extrabold shrink-0">
                            {p.currentMonthSoldQty > 0
                              ? `${p.currentMonthSoldQty.toLocaleString('en-IN')} units`
                              : '0 units'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 pt-0.5 border-t border-emerald-100">
                          <span>Confirmed Orders</span>
                          <span className="font-bold">{p.currentMonthOrderCount || 0} Orders</span>
                        </div>

                        {/* Current Month Buyers list */}
                        {p.currentMonthCustomers && p.currentMonthCustomers.length > 0 && (
                          <div className="pt-1 border-t border-emerald-100/90 space-y-1">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                              Recent Buyers ({p.currentMonth || currentMonthTitle})
                            </div>
                            <div className="space-y-0.5">
                              {p.currentMonthCustomers.slice(0, 2).map((cust, ci) => (
                                <div key={ci} className="flex items-center justify-between text-[11px] bg-emerald-100/60 py-0.5 px-2 rounded-md text-emerald-950">
                                  <span className="truncate font-medium">{cust.customerName}</span>
                                  {cust.qty > 0 && (
                                    <span className="font-bold shrink-0 ml-2 text-emerald-900">
                                      {cust.percentage ? `${cust.percentage}% · ` : ''}{cust.qty.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Trailing Record & Average */}
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 min-w-0">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Trailing Record ({trailingMonths} Mo)</span>
                          <span className="text-slate-600 font-bold">
                            Avg: {(p.averagePerMonth || 0).toLocaleString('en-IN')} / mo
                          </span>
                        </div>
                        <div className="font-semibold text-slate-800 text-xs truncate">
                          {p.trailingMonths && p.trailingMonths.length > 0 ? (
                            p.trailingMonths.map(m => `${m.month.split(' ')[0]}: ${m.totalQty.toLocaleString('en-IN')}`).join(' · ')
                          ) : (
                            <span className="text-slate-400 italic">No prior completed months</span>
                          )}
                        </div>
                      </div>

                      {/* Top Historical Demand Drivers */}
                      <div className="space-y-1.5 pt-0.5 min-w-0">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1 truncate">
                            <Users size={12} className="text-slate-400 shrink-0" />
                            <span>Top Demand Drivers</span>
                          </span>
                          <span className="text-slate-400 font-normal">Past {trailingMonths} Mo</span>
                        </div>

                        {p.topContributingCustomers && p.topContributingCustomers.length > 0 ? (
                          <div className="space-y-1">
                            {p.topContributingCustomers.slice(0, 2).map((cust, ci) => (
                              <div key={ci} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-800 truncate" title={cust.customerName}>
                                  {ci + 1}. {cust.customerName}
                                </span>
                                <span className="text-[11px] font-bold text-slate-900 shrink-0 ml-2">
                                  {cust.percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-1 bg-slate-50/60 rounded-lg px-2 text-center border border-dashed border-slate-200">
                            No prior buyer breakdown recorded.
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setModalProduct(p);
                            setModalDriverMonth('trailing');
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        >
                          <span>View Full Breakdown</span>
                          <ChevronRight size={14} />
                        </button>

                        <button
                          onClick={(e) => handleExportProduct(p, e)}
                          disabled={isExportingThis}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg transition cursor-pointer disabled:opacity-50"
                        >
                          {isExportingThis ? (
                            <RefreshCw size={13} className="animate-spin text-emerald-600" />
                          ) : (
                            <FileSpreadsheet size={13} />
                          )}
                          <span>Export Dossier</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              /* DETAILED TABLE VIEW */
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Dimension</th>
                        <th className="py-3 px-4 text-right">Upcoming Forecast</th>
                        <th className="py-3 px-4 text-right">{currentMonthTitle} Sold</th>
                        <th className="py-3 px-4 text-center">Orders</th>
                        <th className="py-3 px-4 text-right">Trailing Avg</th>
                        <th className="py-3 px-4">Top Drivers</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                      {filteredSpecificProducts.map((p, idx) => {
                        const trend = getTrendData(p.trailingMonths);
                        const hasForecast = p.forecastRangeHigh != null && !p.insufficientData;
                        const prodKey = p.uniqueKey || `${p.productName}_${p.dimensionKey}`;
                        const isExportingThis = !!exportingProduct[prodKey];

                        return (
                          <tr
                            key={prodKey}
                            className="hover:bg-slate-50/80 transition duration-150 cursor-pointer"
                            onClick={() => {
                              setModalProduct(p);
                              setModalDriverMonth('trailing');
                            }}
                          >
                            <td className="py-3.5 px-4 text-slate-400 font-bold">{idx + 1}</td>

                            {/* Product Name */}
                            <td className="py-3.5 px-4 min-w-[180px]">
                              <div className="font-bold text-slate-900 text-sm hover:text-blue-600 transition">
                                {p.productName}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-md">
                                {p.category || 'Label'}
                              </span>
                            </td>

                            {/* Dimension */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-md shadow-2xs">
                                [{p.dimensionKey}]
                              </span>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {formatDimensionDimensions(p.dimensionKey)}
                              </div>
                            </td>

                            {/* Upcoming Forecast */}
                            <td className="py-3.5 px-4 text-right min-w-[140px]">
                              <div className="font-extrabold text-slate-900 text-sm">
                                {hasForecast ? (
                                  `~${p.forecastRangeHigh.toLocaleString('en-IN')}`
                                ) : (
                                  <span className="text-slate-400 font-normal italic">Insufficient</span>
                                )}
                              </div>
                              {trend && (
                                <span
                                  className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                                    trend.direction === 'up'
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : trend.direction === 'down'
                                      ? 'text-rose-700 bg-rose-50'
                                      : 'text-slate-500 bg-slate-100'
                                  }`}
                                >
                                  {trend.label}
                                </span>
                              )}
                            </td>

                            {/* Current Month Sold */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="font-extrabold text-emerald-800 text-sm">
                                {(p.currentMonthSoldQty || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1">units</span>
                            </td>

                            {/* Confirmed Orders */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-bold text-xs rounded-lg">
                                {p.currentMonthOrderCount || 0}
                              </span>
                            </td>

                            {/* Trailing Average */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold text-slate-600">
                              {(p.averagePerMonth || 0).toLocaleString('en-IN')}
                            </td>

                            {/* Top Drivers */}
                            <td className="py-3.5 px-4 min-w-[200px]">
                              {p.topContributingCustomers && p.topContributingCustomers.length > 0 ? (
                                <div className="truncate max-w-[220px]" title={p.topContributingCustomers.map(c => `${c.customerName} (${c.percentage}%)`).join(', ')}>
                                  {p.topContributingCustomers.slice(0, 2).map((c, ci) => (
                                    <span key={ci} className="inline-block text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 mr-1 mb-0.5">
                                      {c.customerName} ({c.percentage}%)
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleExportProduct(p, e)}
                                disabled={isExportingThis}
                                title={`Download Excel dossier for ${p.productName}`}
                                className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-2xs"
                              >
                                {isExportingThis ? (
                                  <RefreshCw size={14} className="animate-spin text-emerald-600" />
                                ) : (
                                  <FileSpreadsheet size={14} />
                                )}
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-2xs text-center space-y-3">
              <Tag size={36} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No Matching Products Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || selectedCategory !== 'all'
                  ? 'Try clearing search or filters to explore all available manufactured products.'
                  : 'No products recorded in the system yet.'}
              </p>
              {(searchTerm || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xs hover:bg-slate-800 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 5. VIEW 2: MACHINE SETUP & DIES VIEW */}
      {activeTab === 'machine-dimensions' && (
        <>
          {filteredForecasts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 2xl:gap-6">
              {filteredForecasts.map((d, index) => {
                const selectedProdName = selectedDimensionProducts[d.dimensionKey] || 'all';
                const isAll = selectedProdName === 'all';
                const activeData = (!isAll && d.productBreakdowns?.[selectedProdName])
                  ? d.productBreakdowns[selectedProdName]
                  : d;

                const trend = getTrendData(activeData.trailingMonths);
                const isSingleValue = activeData.forecastRangeLow === activeData.forecastRangeHigh;
                const hasForecastData = activeData.forecastRangeHigh != null && !activeData.insufficientData;

                const previousMonthsSummary = (activeData.trailingMonths || [])
                  .map(m => `${m.month.split(' ')[0]}: ${m.totalQty.toLocaleString('en-IN')}`)
                  .join(' · ');

                return (
                  <div
                    key={d.dimensionKey}
                    className="bg-white rounded-2xl p-4 sm:p-5 2xl:p-6 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between space-y-4 group min-w-0"
                  >
                    {/* Dimension Header */}
                    <div className="space-y-2 border-b border-slate-100 pb-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs shrink-0">
                            [{d.dimensionKey}]
                          </span>
                          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                            {formatDimensionDimensions(d.dimensionKey)}
                          </h2>
                        </div>

                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Product Selector Pills */}
                      {d.productNames && d.productNames.length > 1 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <button
                            onClick={() => setSelectedDimensionProducts(prev => ({ ...prev, [d.dimensionKey]: 'all' }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              isAll
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span>All Labels</span>
                            <span className={`px-1.5 py-0.2 text-[10px] rounded-md ${isAll ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {d.productNames.length}
                            </span>
                          </button>

                          {d.productNames.map(pName => {
                            const isSelected = selectedProdName === pName;
                            return (
                              <button
                                key={pName}
                                onClick={() => setSelectedDimensionProducts(prev => ({ ...prev, [d.dimensionKey]: pName }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <span className="truncate">{pName}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-medium truncate pt-0.5">
                          {d.productNames && d.productNames.length > 0
                            ? d.productNames.join(' · ')
                            : `${d.dimensionKey} Standard Label`}
                        </div>
                      )}

                      {/* Categories Badges */}
                      {d.categories && d.categories.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {(!isAll && activeData.category ? [activeData.category] : d.categories).map((cat, ci) => (
                            <span key={ci} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md shrink-0">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Forecast Hero Box */}
                    <div className="p-3.5 sm:p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl border border-slate-200/80 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {isAll ? 'Machine Demand Forecast' : `${activeData.productName} Forecast`}
                        </span>

                        {trend && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                              trend.direction === 'up'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : trend.direction === 'down'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {trend.direction === 'up' && <ArrowUpRight size={12} className="shrink-0" />}
                            {trend.direction === 'down' && <ArrowDownRight size={12} className="shrink-0" />}
                            {trend.direction === 'flat' && <Minus size={12} className="shrink-0" />}
                            <span>{trend.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xl sm:text-2xl min-[1440px]:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        {hasForecastData ? (
                          isSingleValue ? (
                            <>~{activeData.forecastRangeHigh.toLocaleString('en-IN')} <span className="text-sm sm:text-base font-bold text-slate-400">Labels</span></>
                          ) : (
                            <>{activeData.forecastRangeLow.toLocaleString('en-IN')} – {activeData.forecastRangeHigh.toLocaleString('en-IN')} <span className="text-sm sm:text-base font-bold text-slate-400">Labels</span></>
                          )
                        ) : (
                          <span className="text-base sm:text-lg font-bold text-slate-400 italic">Insufficient Data</span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 truncate">
                        <Calendar size={13} className="shrink-0" />
                        <span className="truncate">Expected demand in {d.forecastForMonth}</span>
                      </div>
                    </div>

                    {/* Current Month Actuals */}
                    <div className="bg-emerald-50/70 border border-emerald-200/90 p-3 sm:p-3.5 rounded-xl space-y-2.5 min-w-0">
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 truncate">
                          <PackageCheck size={14} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{d.currentMonth || currentMonthTitle} Sold</span>
                        </span>
                        <span className="text-emerald-700 font-extrabold shrink-0">
                          {activeData.currentMonthSoldQty > 0 ? `${activeData.currentMonthSoldQty.toLocaleString('en-IN')} units` : '0 units'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 pt-0.5 border-t border-emerald-100/80">
                        <span>Orders Confirmed</span>
                        <span>{activeData.currentMonthOrderCount || 0} Orders</span>
                      </div>
                    </div>

                    {/* Trailing Record */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 space-y-0.5 min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Previous {d.trailingMonthsCount} Months Record
                      </div>
                      <div className="font-semibold text-slate-800 leading-snug break-words text-xs">
                        {previousMonthsSummary ? (
                          <>
                            <span>{previousMonthsSummary}</span>
                            <span className="text-slate-400 font-normal"> — Total: </span>
                            <span className="font-bold text-slate-900">{(activeData.sumTrailing || 0).toLocaleString('en-IN')} labels</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">No prior completed months</span>
                        )}
                      </div>
                    </div>

                    {/* Customer Demand Drivers with Dynamic Month Selection */}
                    {(() => {
                      const activeDriverKey = selectedDriverMonths[d.dimensionKey] || 'trailing';
                      const activeDriverGroup = activeData.monthlyDrivers?.[activeDriverKey] || {
                        month: activeData.trailingPeriodLabel || d.mostRecentCompletedMonth || 'Trailing Period',
                        totalQty: activeData.sumTrailing,
                        drivers: activeData.topContributingCustomers || []
                      };
                      const driversList = activeDriverGroup.drivers || [];

                      return (
                        <div className="space-y-2 pt-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <Users size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">Top Drivers</span>
                            </div>

                            <select
                              value={activeDriverKey}
                              onChange={(e) => {
                                const newKey = e.target.value;
                                setSelectedDriverMonths(prev => ({
                                  ...prev,
                                  [d.dimensionKey]: newKey
                                }));
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[10px] font-semibold text-slate-700 rounded-lg focus:outline-none transition cursor-pointer max-w-[170px] truncate"
                            >
                              <option value="trailing">
                                Trailing ({activeData.trailingPeriodLabel || `${d.trailingMonthsCount} Mo`})
                              </option>
                              {(activeData.availableMonths || []).map((m) => (
                                <option key={m.yearMonth} value={m.yearMonth}>
                                  {m.month} ({m.totalQty?.toLocaleString('en-IN')})
                                </option>
                              ))}
                            </select>
                          </div>

                          {driversList.length > 0 ? (
                            <div className="space-y-1">
                              {driversList.slice(0, 3).map((cust, ci) => (
                                <div key={ci} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg transition border border-slate-100 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{ci + 1}.</span>
                                    <span className="font-semibold text-slate-800 truncate" title={cust.customerName}>
                                      {cust.customerName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 pl-2">
                                    <span className="text-[11px] font-bold text-slate-900">{cust.percentage}%</span>
                                    <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                                      ({cust.qty?.toLocaleString('en-IN')})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic py-1 bg-slate-50/60 rounded-lg px-2 text-center border border-dashed border-slate-200">
                              No customer breakdown recorded for this period.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-2xs text-center space-y-3">
              <Factory size={36} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No Matching Dimensions Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No machine setup dimensions match the selected filters.
              </p>
            </div>
          )}
        </>
      )}

      {/* 6. VIEW 3: CURRENT MONTH SALES LEDGER */}
      {activeTab === 'current-month-sales' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck size={20} className="text-emerald-600" />
                <span>Products Sold in {currentMonthTitle}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed ledger of all actual orders received and produced in the current calendar month
              </p>
            </div>

            <div className="flex items-center gap-3 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 shrink-0">
              <span>Total Volume: {summaryMetrics.currentMonthSoldQty.toLocaleString('en-IN')} units</span>
            </div>
          </div>

          {filteredCurrentMonthProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Product Name & Category</th>
                    <th className="py-3 px-4">Dimension</th>
                    <th className="py-3 px-4 text-right">Volume Sold</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4">Key Buying Customers</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredCurrentMonthProducts.map((prod, idx) => {
                    const pctOfTotal = summaryMetrics.currentMonthSoldQty > 0
                      ? Math.round((prod.totalQty / summaryMetrics.currentMonthSoldQty) * 100)
                      : 0;
                    const prodKey = `${prod.productName}_${prod.dimensionKey}`;
                    const isExportingThis = !!exportingProduct[prodKey];

                    return (
                      <tr key={prodKey} className="hover:bg-slate-50/80 transition duration-150">
                        <td className="py-3.5 px-4 text-slate-400 font-bold">{idx + 1}</td>
                        
                        {/* Product & Category */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="font-bold text-slate-900 text-sm">{prod.productName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md">
                              {prod.category}
                            </span>
                          </div>
                        </td>

                        {/* Dimension */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-md shadow-2xs">
                            [{prod.dimensionKey}]
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {formatDimensionDimensions(prod.dimensionKey)}
                          </div>
                        </td>

                        {/* Volume Sold */}
                        <td className="py-3.5 px-4 text-right min-w-[140px]">
                          <div className="font-extrabold text-slate-900 text-sm">
                            {prod.totalQty.toLocaleString('en-IN')}
                            <span className="text-[11px] text-slate-400 font-normal ml-1">labels</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(5, pctOfTotal)}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">{pctOfTotal}% of month volume</span>
                        </td>

                        {/* Order count */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded-lg">
                            {prod.orderCount} {prod.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </td>

                        {/* Buying Customers */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          {prod.buyingCustomers && prod.buyingCustomers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {prod.buyingCustomers.map((cust, ci) => (
                                <span
                                  key={ci}
                                  className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-md flex items-center gap-1 truncate max-w-[200px]"
                                  title={cust}
                                >
                                  <Users size={11} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{cust}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Export Button */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => handleExportProduct(prod, e)}
                            disabled={isExportingThis}
                            title={`Export ${prod.productName} dossier to Excel (.xlsx)`}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            {isExportingThis ? (
                              <RefreshCw size={14} className="animate-spin text-emerald-600" />
                            ) : (
                              <Download size={14} />
                            )}
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center space-y-3">
              <PackageCheck size={36} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No Products Sold Matching Filters</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No orders match the selected criteria for {currentMonthTitle}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 7. PRODUCT DOSSIER MODAL / SLIDE-OVER */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3 sticky top-0 bg-white z-10 rounded-t-3xl">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-md shadow-2xs">
                    [{modalProduct.dimensionKey}]
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-md">
                    {modalProduct.category || 'Label'}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    {formatDimensionDimensions(modalProduct.dimensionKey)}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
                  {modalProduct.productName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Production specifications, trailing demand forecasting, and customer order breakdown
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleExportProduct(modalProduct, e)}
                  disabled={exportingProduct[modalProduct.uniqueKey || `${modalProduct.productName}_${modalProduct.dimensionKey}`]}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
                  title="Export this product dossier to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={14} />
                  <span>Export Dossier</span>
                </button>
                <button
                  onClick={() => setModalProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6">
              
              {/* Top 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Demand Forecast */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Upcoming Demand Forecast
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">
                    {modalProduct.forecastRangeHigh != null && !modalProduct.insufficientData ? (
                      modalProduct.forecastRangeLow === modalProduct.forecastRangeHigh ? (
                        `~${modalProduct.forecastRangeHigh.toLocaleString('en-IN')}`
                      ) : (
                        `${modalProduct.forecastRangeLow.toLocaleString('en-IN')} – ${modalProduct.forecastRangeHigh.toLocaleString('en-IN')}`
                      )
                    ) : (
                      'Insufficient Data'
                    )}
                    <span className="text-xs font-bold text-slate-400 ml-1">Labels</span>
                  </div>
                  <div className="text-xs font-semibold text-blue-600">
                    Planning for {modalProduct.forecastForMonth || forecastMonthTitle}
                  </div>
                </div>

                {/* Current Month Sold */}
                <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    {modalProduct.currentMonth || currentMonthTitle} Sold
                  </div>
                  <div className="text-xl font-extrabold text-emerald-950">
                    {(modalProduct.currentMonthSoldQty || 0).toLocaleString('en-IN')}
                    <span className="text-xs font-bold text-emerald-700 ml-1">Units</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700">
                    Across {modalProduct.currentMonthOrderCount || 0} confirmed orders
                  </div>
                </div>

                {/* Trailing Average */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Trailing Average / Month
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">
                    {(modalProduct.averagePerMonth || 0).toLocaleString('en-IN')}
                    <span className="text-xs font-bold text-slate-400 ml-1">Labels/Mo</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    Total: {(modalProduct.sumTrailing || 0).toLocaleString('en-IN')} units
                  </div>
                </div>
              </div>

              {/* Trailing Months History Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  <span>Historical Completed Months Production Log</span>
                </h3>

                {modalProduct.trailingMonths && modalProduct.trailingMonths.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-2.5 px-3">Completed Month</th>
                          <th className="py-2.5 px-3 text-right">Units Produced / Sold</th>
                          <th className="py-2.5 px-3 text-center">Confirmed Orders</th>
                          <th className="py-2.5 px-3 text-right">vs Trailing Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {modalProduct.trailingMonths.map((m, mi) => {
                          const diff = modalProduct.averagePerMonth
                            ? Math.round(((m.totalQty - modalProduct.averagePerMonth) / modalProduct.averagePerMonth) * 100)
                            : 0;
                          return (
                            <tr key={mi} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{m.month}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                {m.totalQty.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-bold">
                                  {m.orderCount}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold">
                                <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'}>
                                  {diff > 0 ? `+${diff}%` : `${diff}%`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No prior completed calendar months recorded.
                  </div>
                )}
              </div>

              {/* Customer Demand Drivers Explorer */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-purple-500" />
                    <span>Customer Demand Drivers</span>
                  </h3>

                  {modalProduct.availableMonths && modalProduct.availableMonths.length > 0 && (
                    <select
                      value={modalDriverMonth}
                      onChange={(e) => setModalDriverMonth(e.target.value)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer"
                    >
                      <option value="trailing">
                        Trailing Horizon ({modalProduct.trailingPeriodLabel || `${trailingMonths} Mo`})
                      </option>
                      {modalProduct.availableMonths.map(m => (
                        <option key={m.yearMonth} value={m.yearMonth}>
                          {m.month} ({m.totalQty?.toLocaleString('en-IN')} units)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {(() => {
                  const activeGroup = modalProduct.monthlyDrivers?.[modalDriverMonth] || {
                    month: modalProduct.trailingPeriodLabel || 'Trailing Horizon',
                    totalQty: modalProduct.sumTrailing,
                    drivers: modalProduct.topContributingCustomers || []
                  };
                  const drivers = activeGroup.drivers || [];

                  return drivers.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Customer Name</th>
                            <th className="py-2.5 px-3">Company</th>
                            <th className="py-2.5 px-3 text-right">Volume Ordered</th>
                            <th className="py-2.5 px-3 text-center">Orders</th>
                            <th className="py-2.5 px-3 text-right">Share %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {drivers.map((c, ci) => (
                            <tr key={ci} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-slate-400 font-bold">{ci + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{c.customerName}</td>
                              <td className="py-2.5 px-3 text-slate-600">{c.company || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                {c.qty?.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-bold">
                                  {c.orderCount || 1}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                {c.percentage}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No customer demand drivers breakdown available for this selected period.
                    </div>
                  );
                })()}
              </div>

              {/* Current Month Active Buyers */}
              {modalProduct.currentMonthCustomers && modalProduct.currentMonthCustomers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <PackageCheck size={14} className="text-emerald-600" />
                    <span>Active Buyers in {modalProduct.currentMonth || currentMonthTitle}</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {modalProduct.currentMonthCustomers.map((cust, ci) => (
                      <div
                        key={ci}
                        className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-950 flex items-center gap-2"
                      >
                        <span>{cust.customerName}</span>
                        {cust.qty > 0 && (
                          <span className="font-extrabold text-emerald-800">
                            {cust.percentage ? `${cust.percentage}% · ` : ''}{cust.qty.toLocaleString('en-IN')} units
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-medium">
                Production Forecast Engine • Dimension [{modalProduct.dimensionKey}]
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalProduct(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={(e) => handleExportProduct(modalProduct, e)}
                  disabled={exportingProduct[modalProduct.uniqueKey || `${modalProduct.productName}_${modalProduct.dimensionKey}`]}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={15} />
                  <span>Download Excel Dossier</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 8. FOOTER INFORMATION NOTE */}
      <div className="flex items-center justify-start gap-1.5 text-xs text-slate-400 font-medium pt-2">
        <Info size={14} className="shrink-0" />
        <span>
          Demand forecasts are calculated strictly from completed calendar months to avoid partial-month bias, while live tracking monitors current in-progress orders and sales revenue in real-time.
        </span>
      </div>

    </div>
  );
}
