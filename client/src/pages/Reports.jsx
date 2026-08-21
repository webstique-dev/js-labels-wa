import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import {
  Calendar,
  Filter,
  Download,
  Wallet,
  ShoppingBag,
  RefreshCw,
  TrendingUp,
  Users,
  FileText,
  ChevronDown,
  ChevronRight,
  Info,
  ArrowUp,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { Skeleton, SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';

export default function Reports() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('this_month');

  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [ordersStatusData, setOrdersStatusData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [execPerformance, setExecPerformance] = useState([]);

  const PERIOD_OPTIONS = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'all_time', label: 'All Time' }
  ];

  const fetchAllReports = useCallback(async (period = periodFilter) => {
    try {
      setLoading(true);
      const queryParam = `?period=${period}`;
      const [overRes, trendRes, prodRes, statRes, custRes, execRes] = await Promise.allSettled([
        api.get(`/reports/overview${queryParam}`),
        api.get(`/reports/revenue-trend${queryParam}`),
        api.get(`/reports/top-products${queryParam}`),
        api.get(`/reports/orders-by-status${queryParam}`),
        api.get(`/reports/top-customers${queryParam}`),
        api.get(`/reports/executive-performance${queryParam}`)
      ]);

      setOverview(overRes.status === 'fulfilled' ? overRes.value.data : null);
      setTrendData(trendRes.status === 'fulfilled' ? trendRes.value.data : []);
      setTopProducts(prodRes.status === 'fulfilled' ? prodRes.value.data : []);
      setOrdersStatusData(statRes.status === 'fulfilled' ? statRes.value.data : []);
      setTopCustomers(custRes.status === 'fulfilled' ? custRes.value.data : []);
      setExecPerformance(execRes.status === 'fulfilled' ? execRes.value.data : []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    fetchAllReports(periodFilter);
  }, [periodFilter, fetchAllReports]);

  const handleExportCSV = async (type = 'orders') => {
    try {
      const response = await api.get(`/reports/export?type=${type}&period=${periodFilter}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_executive_report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify.success(`Exported professional ${type.toUpperCase()} Excel report!`);
    } catch (err) {
      console.error('Export Error:', err);
      notify.error('Failed to export Excel report');
    }
  };

  // Responsive Skeleton Loader
  if (loading) {
    return (
      <div className="space-y-6 pb-12 font-sans animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-7 w-36 rounded-xl" />
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Skeleton className="h-9 w-40 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* Top 6 KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Full-width Revenue Trend Skeleton */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        {/* 2 Donut Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header & Action Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Executive Reports & Analytics</h1>
          <p className="text-xs text-slate-500 font-normal">Real-time performance analytics calculated directly from database records</p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
          {/* Interactive Period Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={() => handleExportCSV('orders')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Download size={14} className="shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Row 1: Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* 1. Total Revenue */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.totalRevenue?.display || '₹ 0'}</div>
          <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 truncate">
            <ArrowUp size={10} className="shrink-0" />
            <span className="truncate">{overview?.totalRevenue?.change || 0}% vs prev period</span>
          </div>
        </div>

        {/* 2. Average Order Value */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Avg Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.avgOrderValue?.display || '₹ 0'}</div>
          <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 truncate">
            <ArrowUp size={10} className="shrink-0" />
            <span className="truncate">{overview?.avgOrderValue?.change || 0}% vs prev period</span>
          </div>
        </div>

        {/* 3. Repeat Order Rate */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Repeat Order Rate</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.repeatOrderRate?.display || '0%'}</div>
          <div className="text-[10px] font-semibold text-amber-600 flex items-center gap-1 truncate">
            <span className="truncate">Customer Reorders</span>
          </div>
        </div>

        {/* 4. Lead Win Rate */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Lead Win Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.winRate?.display || '0%'}</div>
          <div className="text-[10px] font-semibold text-purple-600 flex items-center gap-1 truncate">
            <span className="truncate">Leads Converted</span>
          </div>
        </div>

        {/* 5. Total Customers */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Total Customers</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.totalCustomers?.display || '0'}</div>
          <div className="text-[10px] font-semibold text-teal-600 flex items-center gap-1 truncate">
            <span className="truncate">Database Records</span>
          </div>
        </div>

        {/* 6. Total Orders */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate">{overview?.totalOrders?.display || '0'}</div>
          <div className="text-[10px] font-semibold text-rose-600 flex items-center gap-1 truncate">
            <span className="truncate">Orders Created</span>
          </div>
        </div>

      </div>

      {/* Section 1: Revenue Trend Area Chart */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
              <span>Revenue Trend Progression</span>
              <Info size={14} className="text-slate-400 shrink-0" />
            </h3>
            <p className="text-xs text-slate-500 font-normal">Real-time revenue curve calculated strictly from confirmed orders</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filter Period:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {trendData && trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFF', borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val) => [`₹ ${val.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <TrendingUp size={28} className="text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No Revenue Trend Data Available</p>
              <p className="text-xs text-slate-400 font-normal">Create orders in the database to visualize live sales trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Visual Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Top Products by Sales */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Top Products by Sales</h3>
              <p className="text-[11px] text-slate-400 font-normal">Product revenue distribution from orders</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {topProducts.length} Products
            </span>
          </div>

          {topProducts && topProducts.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Donut with center text */}
              <div className="w-40 h-40 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProducts}
                      dataKey="percentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2}
                    >
                      {topProducts.map((entry, index) => (
                        <Cell key={`prod-${index}`} fill={entry.color || '#2563EB'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Total Sales</span>
                  <span className="text-xs font-extrabold text-slate-900">{overview?.totalRevenue?.display || '₹ 0'}</span>
                </div>
              </div>

              {/* Legend list */}
              <div className="space-y-2 text-xs w-full min-w-0">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#2563EB' }}></span>
                      <span className="text-slate-700 truncate font-semibold">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 font-medium">{p.percentage}%</span>
                      <span className="font-bold text-slate-900">{p.sales}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-normal">No product sales data recorded in database yet.</div>
          )}
        </div>

        {/* Card 2: Orders by Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Orders by Status</h3>
              <p className="text-[11px] text-slate-400 font-normal">Status breakdown of all orders in database</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {overview?.totalOrders?.display || '0'} Total
            </span>
          </div>

          {ordersStatusData && ordersStatusData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Donut with center text */}
              <div className="w-40 h-40 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ordersStatusData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2}
                    >
                      {ordersStatusData.map((entry, index) => (
                        <Cell key={`stat-${index}`} fill={entry.color || '#16A34A'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Total Orders</span>
                  <span className="text-sm font-extrabold text-slate-900">{overview?.totalOrders?.display || '0'}</span>
                </div>
              </div>

              {/* Legend list */}
              <div className="space-y-2 text-xs w-full min-w-0">
                {ordersStatusData.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || '#16A34A' }}></span>
                      <span className="text-slate-700 truncate font-semibold">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">{s.count} orders</span>
                      <span className="text-slate-400 font-medium">({s.percentage})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-normal">No order status data recorded in database yet.</div>
          )}
        </div>
      </div>

      {/* Section 3: Top Customers Table (Full-Width Card) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">Top Customers by Revenue</h3>
            <p className="text-xs text-slate-400 font-normal">Highest contributing customer accounts recorded in database</p>
          </div>
          <button onClick={() => navigate('/customers')} className="text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer">
            <span>View All Customers</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[10px] uppercase">
                <th className="pb-2.5">Customer Name & Company</th>
                <th className="pb-2.5 text-center">Orders Placed</th>
                <th className="pb-2.5 text-right">Total Revenue (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topCustomers && topCustomers.length > 0 ? (
                topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${c.initialsBg} font-bold text-xs flex items-center justify-center shrink-0`}>
                          {c.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 leading-tight truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-400 font-normal truncate">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-slate-800">{c.orders}</td>
                    <td className="py-3 text-right font-bold text-slate-900">{c.revenue}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-400 italic">No customer revenue records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info Note */}
      <div className="flex items-center justify-start gap-1.5 text-xs text-slate-400 font-medium pt-2">
        <span>All metrics calculated live from database records</span>
        <Info size={14} />
      </div>

    </div>
  );
}
