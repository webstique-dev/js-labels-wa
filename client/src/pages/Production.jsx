import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
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
  IndianRupee,
  ShoppingCart,
  CheckCircle2,
  Tag,
  BarChart3
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

export default function Production() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'current-month-products'
  const [trailingMonths, setTrailingMonths] = useState(2);
  const [forecastData, setForecastData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('qty'); // 'qty' | 'revenue' | 'orders' | 'name'
  const [selectedDriverMonths, setSelectedDriverMonths] = useState({}); // { [dimensionKey]: 'trailing' | '2026-08' | ... }
  const [selectedProducts, setSelectedProducts] = useState({}); // { [dimensionKey]: 'all' | productName }

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

  // Extract all unique categories across all dimensions for category filter pills
  const allCategories = useMemo(() => {
    if (!forecastData?.forecasts) return [];
    const catSet = new Set();
    forecastData.forecasts.forEach(f => {
      (f.categories || []).forEach(c => catSet.add(c));
    });
    if (forecastData?.currentMonthSummary?.productsSold) {
      forecastData.currentMonthSummary.productsSold.forEach(p => {
        if (p.category) catSet.add(p.category);
      });
    }
    return Array.from(catSet);
  }, [forecastData]);

  // Filter forecasts by search query and category
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

  // Filter and Sort Current Month Products
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

  // Compute summary metrics
  const summaryMetrics = useMemo(() => {
    if (!forecastData?.forecasts) {
      return {
        totalForecastVolume: 0,
        totalDimensions: 0,
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
      totalBatchHoursSaved,
      batchingDimensionsCount,
      currentMonthSoldQty: forecastData.currentMonthSummary?.totalSoldQty || 0,
      currentMonthRevenue: forecastData.currentMonthSummary?.totalRevenue || 0,
      currentMonthOrders: forecastData.currentMonthSummary?.totalOrders || 0,
      currentMonthDistinctProducts: forecastData.currentMonthSummary?.distinctProductsCount || 0
    };
  }, [forecastData]);

  // Helper to format dimension nicely: "4x45" -> "4mm × 45mm"
  const formatDimensionDimensions = (dimKey) => {
    if (!dimKey || !dimKey.includes('x')) return dimKey;
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
      return { direction: 'up', pct: pctChange, label: `+${pctChange}% vs prev month` };
    } else if (pctChange < 0) {
      return { direction: 'down', pct: Math.abs(pctChange), label: `${pctChange}% vs prev month` };
    }
    return { direction: 'flat', pct: 0, label: 'Stable (0%)' };
  };

  // Loading Skeleton State
  if (loading && !forecastData) {
    return (
      <div className="space-y-6 pb-12 font-sans animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-10 w-52 rounded-xl" />
        </div>

        {/* 4 Summary KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 min-[1200px]:grid-cols-4 gap-4 2xl:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          ))}
        </div>

        {/* Dimension Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-3 gap-4 sm:gap-5 2xl:gap-6 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <Skeleton className="h-6 w-32 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentMonthTitle = forecastData?.currentMonth || 'Current Month';

  return (
    <div className="space-y-5 sm:space-y-6 2xl:space-y-8 pb-12 font-sans max-w-full overflow-hidden">
      
      {/* Top Header & Planning Horizon Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-slate-900 tracking-tight">
              Production Planning & Machine Forecast
            </h1>
            <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 shadow-2xs">
              Live Reference
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-md shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {currentMonthTitle} Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
            Machine setup reference, trailing-average demand forecasting, and live {currentMonthTitle} sales tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0 justify-between lg:justify-end flex-wrap">
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
              Trailing 2 Months
            </button>
            <button
              onClick={() => setTrailingMonths(3)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trailingMonths === 3
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Trailing 3 Months
            </button>
          </div>

          <button
            onClick={() => fetchForecasts(trailingMonths)}
            title="Refresh Forecast & Sales Data"
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-2xs transition cursor-pointer shrink-0"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Row 1: Summary Header KPI Cards (Shop-Floor & Commercial At-a-Glance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 min-[1200px]:grid-cols-4 gap-3.5 sm:gap-4 2xl:gap-6">
        
        {/* Card 1: Total Forecasted Volume */}
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
            <span className="truncate">Expected in {forecastData?.forecastForMonth || 'Upcoming Month'}</span>
          </div>
        </div>

        {/* Card 2: Current Month Actual Volume Sold */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">{currentMonthTitle} Volume Sold</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <PackageCheck size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            {summaryMetrics.currentMonthSoldQty.toLocaleString('en-IN')}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Labels Sold</span>
          </div>
          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 truncate">
            <ShoppingCart size={13} className="shrink-0" />
            <span className="truncate">Across {summaryMetrics.currentMonthOrders} confirmed orders</span>
          </div>
        </div>

        {/* Card 3: Current Month Total Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">{currentMonthTitle} Sales Value</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <IndianRupee size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            ₹{summaryMetrics.currentMonthRevenue.toLocaleString('en-IN')}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Total</span>
          </div>
          <div className="text-xs font-semibold text-violet-700 flex items-center gap-1.5 truncate">
            <Tag size={13} className="shrink-0" />
            <span className="truncate">{summaryMetrics.currentMonthDistinctProducts} distinct products ordered</span>
          </div>
        </div>

        {/* Card 4: Machine Setup Batching Opportunity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 transition duration-200 hover:shadow-md hover:border-slate-300 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-500 truncate">Setup Batching Efficiency</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            {summaryMetrics.totalBatchHoursSaved}
            <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1.5 font-sans">Hrs Saved</span>
          </div>
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 truncate">
            <Clock size={13} className="shrink-0" />
            <span className="truncate">{summaryMetrics.batchingDimensionsCount} multi-order dimensions</span>
          </div>
        </div>

      </div>

      {/* Row 2: View Switcher Tabs & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Factory size={15} />
            <span>Machine Demand Forecast</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded-md">
              {filteredForecasts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('current-month-products')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'current-month-products'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PackageCheck size={15} className="text-emerald-600" />
            <span>Products Sold ({currentMonthTitle})</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md">
              {filteredCurrentMonthProducts.length}
            </span>
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'forecast' ? "Search dimensions, products, customers..." : "Search products, dimensions, buyers..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
          </div>

          {/* Category Dropdown/Pills */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-900 transition cursor-pointer shrink-0"
          >
            <option value="all">All Categories</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {activeTab === 'current-month-products' && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-900 transition cursor-pointer shrink-0"
            >
              <option value="qty">Sort by Volume</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="orders">Sort by Orders</option>
              <option value="name">Sort by Name</option>
            </select>
          )}
        </div>
      </div>

      {/* VIEW 1: MACHINE FORECAST & DEMAND VIEW */}
      {activeTab === 'forecast' && (
        <>
          {filteredForecasts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-3 gap-4 sm:gap-5 2xl:gap-6">
              {filteredForecasts.map((d, index) => {
                const selectedProdName = selectedProducts[d.dimensionKey] || 'all';
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
                    {/* 1. Dimension Header & Product Association */}
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

                        {/* Rank Badge */}
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Product Selector Pills (When dimension has multiple products) */}
                      {d.productNames && d.productNames.length > 1 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <button
                            onClick={() => setSelectedProducts(prev => ({ ...prev, [d.dimensionKey]: 'all' }))}
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
                                onClick={() => setSelectedProducts(prev => ({ ...prev, [d.dimensionKey]: pName }))}
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

                      {/* Categories & Pricing Badge */}
                      {d.categories && d.categories.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {(!isAll && activeData.category ? [activeData.category] : d.categories).map((cat, ci) => (
                            <span key={ci} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md shrink-0">
                              {cat}
                            </span>
                          ))}
                          {!isAll && activeData.unitPrice != null && (
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold rounded-md shrink-0">
                              ₹{activeData.unitPrice}/label
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. MAIN FORECAST HERO SECTION */}
                    <div className="p-3.5 sm:p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl border border-slate-200/80 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {isAll ? 'Machine Demand Forecast' : `${activeData.productName} Forecast`}
                        </span>

                        {/* Trend Pill */}
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

                      {/* THE PROMINENT FORECAST NUMBER */}
                      <div className="text-xl sm:text-2xl min-[1440px]:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-normal">
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

                      {activeData.lowConfidence && (
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-lg mt-1">
                          <AlertCircle size={12} className="shrink-0 text-amber-600" />
                          <span className="truncate">Based on limited history — forecast may be less accurate</span>
                        </div>
                      )}
                    </div>

                    {/* 3. CURRENT MONTH ACTUAL SALES PROGRESS (Live In-Progress Month) */}
                    <div className="bg-emerald-50/70 border border-emerald-200/90 p-3 sm:p-3.5 rounded-xl space-y-2.5 min-w-0">
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 truncate">
                          <PackageCheck size={14} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{d.currentMonth || 'Current Month'} Sold</span>
                        </span>
                        <span className="text-emerald-700 font-extrabold shrink-0">
                          {activeData.currentMonthSoldQty > 0 ? `${activeData.currentMonthSoldQty.toLocaleString('en-IN')} units` : '0 units'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 pt-0.5 border-t border-emerald-100/80">
                        <span>Revenue: ₹{(activeData.currentMonthRevenue || 0).toLocaleString('en-IN')}</span>
                        <span>{activeData.currentMonthOrderCount || 0} Orders</span>
                      </div>

                      {/* Products Sold under this dimension this month */}
                      {isAll ? (
                        d.currentMonthProducts && d.currentMonthProducts.length > 0 ? (
                          <div className="space-y-1 pt-0.5">
                            {d.currentMonthProducts.map((p, pi) => (
                              <div key={pi} className="flex items-center justify-between text-[11px] bg-white/90 py-1 px-2 rounded-lg border border-emerald-100 text-slate-700 shadow-2xs">
                                <span className="truncate font-medium">{p.productName}</span>
                                <span className="font-bold text-emerald-800 shrink-0 ml-2">
                                  {p.totalQty.toLocaleString('en-IN')} ({p.orderCount} ord)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-600/80 italic">No orders recorded in {d.currentMonth || 'current month'} yet.</div>
                        )
                      ) : (
                        <div className="text-[11px] bg-white/90 py-1 px-2 rounded-lg border border-emerald-100 text-slate-700 flex items-center justify-between shadow-2xs">
                          <span className="truncate font-medium">{activeData.productName}</span>
                          <span className="font-bold text-emerald-800 shrink-0 ml-2">
                            {activeData.currentMonthSoldQty > 0 ? `${activeData.currentMonthSoldQty.toLocaleString('en-IN')} (${activeData.currentMonthOrderCount} ord)` : '0 units'}
                          </span>
                        </div>
                      )}

                      {/* Current Month Active Buyers */}
                      {activeData.currentMonthCustomers && activeData.currentMonthCustomers.length > 0 && (
                        <div className="pt-1 border-t border-emerald-100/80 space-y-1">
                          <div className="text-[10px] font-bold text-emerald-800/80 uppercase tracking-wider">
                            {d.currentMonth || 'Current Month'} Buyers
                          </div>
                          <div className="space-y-1">
                            {activeData.currentMonthCustomers.map((cust, ci) => (
                              <div key={ci} className="flex items-center justify-between text-[11px] bg-emerald-100/50 py-0.5 px-2 rounded-md text-emerald-950">
                                <span className="truncate font-medium">{cust.customerName}</span>
                                <span className="font-bold shrink-0 ml-2 text-emerald-900">
                                  {cust.percentage}% ({cust.qty?.toLocaleString('en-IN')})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Previous Trailing Months Record */}
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

                    {/* 5. Top Customer Drivers with Dynamic Month Selection */}
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

                            {/* Month Selection Dropdown */}
                            <select
                              value={activeDriverKey}
                              onChange={(e) => {
                                const newKey = e.target.value;
                                setSelectedDriverMonths(prev => ({
                                  ...prev,
                                  [d.dimensionKey]: newKey
                                }));
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[10px] font-semibold text-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition cursor-pointer max-w-[170px] truncate"
                              title="Select month to view customer demand drivers"
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

                          {/* Selected Period Context Pill */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                            <span className="truncate font-medium text-slate-500">
                              {activeDriverGroup.month}
                            </span>
                            <span className="font-semibold text-slate-600 shrink-0 ml-1">
                              {(activeDriverGroup.totalQty || 0).toLocaleString('en-IN')} units
                            </span>
                          </div>

                          {/* Driver List */}
                          {driversList.length > 0 ? (
                            <div className="space-y-1">
                              {driversList.slice(0, 3).map((cust, ci) => (
                                <div key={ci} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg transition border border-slate-100 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{ci + 1}.</span>
                                    <span className="font-semibold text-slate-800 truncate" title={cust.company && cust.company !== '—' ? `${cust.customerName} (${cust.company})` : cust.customerName}>
                                      {cust.customerName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 pl-2">
                                    <span className="text-[11px] font-bold text-slate-900">{cust.percentage}%</span>
                                    <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">({cust.qty?.toLocaleString('en-IN')})</span>
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
                {searchTerm || selectedCategory !== 'all'
                  ? 'Try adjusting your search query or category filter to view other label dimensions.'
                  : 'No orders have been recorded in the database yet to generate dimension production forecasts.'}
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

      {/* VIEW 2: DEDICATED PRODUCTS SOLD IN CURRENT MONTH VIEW */}
      {activeTab === 'current-month-products' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck size={20} className="text-emerald-600" />
                  <span>Products Sold in {currentMonthTitle}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed product-level breakdown of all actual orders received and produced this calendar month
                </p>
              </div>

              <div className="flex items-center gap-3 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 shrink-0">
                <span>Total: {summaryMetrics.currentMonthSoldQty.toLocaleString('en-IN')} units</span>
                <span>•</span>
                <span>₹{summaryMetrics.currentMonthRevenue.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {filteredCurrentMonthProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Product Name & Category</th>
                      <th className="py-3 px-4">Dimension</th>
                      <th className="py-3 px-4 text-right">Volume Sold</th>
                      <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4">Key Buying Customers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                    {filteredCurrentMonthProducts.map((prod, idx) => {
                      const pctOfTotal = summaryMetrics.currentMonthSoldQty > 0
                        ? Math.round((prod.totalQty / summaryMetrics.currentMonthSoldQty) * 100)
                        : 0;

                      return (
                        <tr key={`${prod.productName}-${prod.dimensionKey}`} className="hover:bg-slate-50/80 transition duration-150">
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

                          {/* Revenue */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="font-extrabold text-emerald-800 text-sm">
                              ₹{prod.totalRevenue.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Exact line calculated
                            </div>
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
                  No products match the selected criteria for {currentMonthTitle}.
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
          </div>
        </div>
      )}

      {/* Footer Info Note */}
      <div className="flex items-center justify-start gap-1.5 text-xs text-slate-400 font-medium pt-2">
        <Info size={14} className="shrink-0" />
        <span>
          Machine demand forecasts utilize strictly completed historical trailing months to eliminate partial month distortion, while {currentMonthTitle} data tracks live active demand and sales revenue.
        </span>
      </div>

    </div>
  );
}

