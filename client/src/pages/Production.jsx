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
  Calendar
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

export default function Production() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [trailingMonths, setTrailingMonths] = useState(2);
  const [forecastData, setForecastData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
        (f.topContributingCustomers || []).some(c => c.customerName.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === 'all' ||
        (f.categories || []).includes(selectedCategory);

      return matchesSearch && matchesCat;
    });
  }, [forecastData, searchTerm, selectedCategory]);

  // Compute summary metrics
  const summaryMetrics = useMemo(() => {
    if (!forecastData?.forecasts) {
      return { totalForecastVolume: 0, totalDimensions: 0, totalBatchHoursSaved: 0, batchingDimensionsCount: 0 };
    }

    let totalForecastVolume = 0;
    let totalBatchHoursSaved = 0;
    let batchingDimensionsCount = 0;

    forecastData.forecasts.forEach(f => {
      // Sum the expected forecast volume (using forecastRangeHigh or midpoint)
      if (f.forecastRangeHigh) {
        totalForecastVolume += f.forecastRangeHigh;
      }

      // Check recent completed month order count for batching savings: (orderCount - 1) * 12 hrs
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
      batchingDimensionsCount
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

        {/* 3 Top Summary KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 2xl:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 2xl:gap-6 pt-2">
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

  return (
    <div className="space-y-6 2xl:space-y-8 pb-12 font-sans">
      
      {/* Top Header & Planning Horizon Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-slate-900 tracking-tight">
              Production Planning & Machine Forecast
            </h1>
            <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md uppercase tracking-wider">
              Live Reference
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Machine setup reference and trailing-average demand forecasting for upcoming production runs
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Horizon Toggle */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setTrailingMonths(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trailingMonths === 2
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Trailing 2 Months
            </button>
            <button
              onClick={() => setTrailingMonths(3)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
            title="Refresh Forecast Data"
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-2xs transition cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Row 1: Summary Header KPI Cards (Shop-Floor At-a-Glance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 2xl:gap-6">
        
        {/* Card 1: Total Forecasted Volume */}
        <div className="bg-white p-5 2xl:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5 transition duration-200 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs 2xl:text-sm font-semibold text-slate-500">Upcoming Total Demand</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers size={20} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            ~{summaryMetrics.totalForecastVolume.toLocaleString('en-IN')}
            <span className="text-sm font-bold text-slate-400 ml-1.5 font-sans">Labels</span>
          </div>
          <div className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
            <Calendar size={13} className="shrink-0" />
            <span>Target Month: {forecastData?.forecastForMonth || 'Upcoming Month'}</span>
          </div>
        </div>

        {/* Card 2: Active Dimensions in Catalog */}
        <div className="bg-white p-5 2xl:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5 transition duration-200 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs 2xl:text-sm font-semibold text-slate-500">Active Tooling Dimensions</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Ruler size={20} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {summaryMetrics.totalDimensions}
            <span className="text-sm font-bold text-slate-400 ml-1.5 font-sans">Sizes Tracked</span>
          </div>
          <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5">
            <Factory size={13} className="shrink-0" />
            <span>Multi-customer historical order history</span>
          </div>
        </div>

        {/* Card 3: Machine Setup Batching Opportunity */}
        <div className="bg-white p-5 2xl:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5 transition duration-200 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs 2xl:text-sm font-semibold text-slate-500">Setup Batching Opportunity</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {summaryMetrics.totalBatchHoursSaved}
            <span className="text-sm font-bold text-slate-400 ml-1.5 font-sans">Hrs Saved</span>
          </div>
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Clock size={13} className="shrink-0" />
            <span>Across {summaryMetrics.batchingDimensionsCount} combined multi-order runs</span>
          </div>
        </div>

      </div>

      {/* Row 2: Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dimensions (e.g. 4x45, 10x15), product names, or customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
          />
        </div>

        {/* Category Pills (Scrollable on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: The Core Dimension Forecast Grid (Shop-Floor Readable) */}
      {filteredForecasts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 2xl:gap-6">
          {filteredForecasts.map((d, index) => {
            const trend = getTrendData(d.trailingMonths);
            const isSingleValue = d.forecastRangeLow === d.forecastRangeHigh;
            const hasForecastData = d.forecastRangeHigh != null && !d.insufficientData;

            // Generate previous months string: e.g. "June: 200,000 · July: 200,000 — Total: 400,000 labels"
            const previousMonthsSummary = (d.trailingMonths || [])
              .map(m => `${m.month.split(' ')[0]}: ${m.totalQty.toLocaleString('en-IN')}`)
              .join(' · ');

            return (
              <div
                key={d.dimensionKey}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between space-y-4 group"
              >
                
                {/* 1. Dimension Header & Product Catalog Association */}
                <div className="space-y-1.5 border-b border-slate-100 pb-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs">
                        [{d.dimensionKey}]
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                        {formatDimensionDimensions(d.dimensionKey)}
                      </h2>
                    </div>

                    {/* Rank Badge */}
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Friendly Product Names & Categories */}
                  <div className="text-xs text-slate-500 font-medium truncate pt-0.5">
                    {d.productNames && d.productNames.length > 0
                      ? d.productNames.join(' · ')
                      : `${d.dimensionKey} Standard Label`}
                  </div>

                  {d.categories && d.categories.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {d.categories.map((cat, ci) => (
                        <span key={ci} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. MAIN FORECAST HERO SECTION (Dominant, Bold, Large) */}
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Machine Production Forecast
                    </span>

                    {/* Trend Pill */}
                    {trend && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
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
                  <div className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {hasForecastData ? (
                      isSingleValue ? (
                        <>~{d.forecastRangeHigh.toLocaleString('en-IN')} <span className="text-base sm:text-lg font-bold text-slate-400">Labels</span></>
                      ) : (
                        <>{d.forecastRangeLow.toLocaleString('en-IN')} – {d.forecastRangeHigh.toLocaleString('en-IN')} <span className="text-base sm:text-lg font-bold text-slate-400">Labels</span></>
                      )
                    ) : (
                      <span className="text-lg font-bold text-slate-400 italic">Insufficient Data</span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <Calendar size={13} className="shrink-0" />
                    <span>Expected demand in {d.forecastForMonth}</span>
                  </div>

                  {/* Low Confidence Note */}
                  {d.lowConfidence && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50/90 border border-amber-200/80 px-2.5 py-1 rounded-lg mt-1.5">
                      <AlertCircle size={12} className="shrink-0 text-amber-600" />
                      <span>Based on limited history — forecast may be less accurate</span>
                    </div>
                  )}
                </div>

                {/* 3. Previous Trailing Months History Line */}
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Previous {d.trailingMonthsCount} Months Record
                  </div>
                  <div className="font-semibold text-slate-800 leading-snug">
                    {previousMonthsSummary ? (
                      <>
                        <span>{previousMonthsSummary}</span>
                        <span className="text-slate-400 font-normal"> — Total: </span>
                        <span className="font-bold text-slate-900">{(d.sumTrailing || 0).toLocaleString('en-IN')} labels</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">No prior completed months</span>
                    )}
                  </div>
                </div>

                {/* 4. Top Customers Driving Demand Breakdown */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Top Drivers ({d.mostRecentCompletedMonth || 'Recent'}):</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Share</span>
                  </div>

                  {d.topContributingCustomers && d.topContributingCustomers.length > 0 ? (
                    <div className="space-y-1.5">
                      {d.topContributingCustomers.slice(0, 3).map((cust, ci) => (
                        <div key={ci} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg transition border border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-bold text-slate-400">{ci + 1}.</span>
                            <span className="font-semibold text-slate-800 truncate">{cust.customerName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            <span className="text-[11px] font-bold text-slate-900">{cust.percentage}%</span>
                            <span className="text-[10px] text-slate-400 font-normal">({cust.qty?.toLocaleString('en-IN')})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-1">No driver breakdown recorded for this period.</div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-2xs text-center space-y-3">
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

      {/* Footer Info Note */}
      <div className="flex items-center justify-start gap-1.5 text-xs text-slate-400 font-medium pt-2">
        <Info size={14} className="shrink-0" />
        <span>Trailing averages exclude the current in-progress month to ensure growing partial volumes do not skew machine planning.</span>
      </div>

    </div>
  );
}
