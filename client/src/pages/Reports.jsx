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
  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [ordersStatusData, setOrdersStatusData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [execPerformance, setExecPerformance] = useState([]);

  const fetchAllReports = useCallback(async () => {
    try {
      setLoading(true);
      const [overRes, trendRes, prodRes, statRes, custRes, execRes] = await Promise.allSettled([
        api.get('/reports/overview'),
        api.get('/reports/revenue-trend'),
        api.get('/reports/top-products'),
        api.get('/reports/orders-by-status'),
        api.get('/reports/top-customers'),
        api.get('/reports/executive-performance')
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
  }, []);

  useEffect(() => {
    fetchAllReports();
  }, [fetchAllReports]);

  const handleExportCSV = async (type = 'orders') => {
    try {
      const response = await api.get(`/reports/export?type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify.success(`Exported ${type} report successfully!`);
    } catch (err) {
      console.error('CSV Export Error:', err);
      notify.error('Failed to export CSV report');
    }
  };

  // Static list for Recent Reports Card matching reference image
  const recentReportsList = [
    { id: '1', title: 'Sales Performance Report', type: 'Excel', size: '245 KB', date: 'May 31, 2025 10:30 AM', isPdf: false },
    { id: '2', title: 'Customer Summary Report', type: 'PDF', size: '521 KB', date: 'May 31, 2025 10:15 AM', isPdf: true },
    { id: '3', title: 'Order Status Report', type: 'Excel', size: '198 KB', date: 'May 31, 2025 09:45 AM', isPdf: false },
    { id: '4', title: 'Revenue Analysis Report', type: 'PDF', size: '612 KB', date: 'May 30, 2025 06:20 PM', isPdf: true },
    { id: '5', title: 'Product Performance Report', type: 'Excel', size: '310 KB', date: 'May 30, 2025 05:10 PM', isPdf: false }
  ];

  // Responsive Skeleton Loader
  if (loading) {
    return (
      <div className="space-y-6 pb-12 font-sans animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-7 w-36 rounded-xl" />
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <Skeleton className="h-9 w-40 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* Top 6 KPI Cards Skeleton (Fluid responsive grid: 2 cols mobile, 3 sm, 6 lg) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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

        {/* Row 2: 3 Visual Analytics Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="w-32 h-32 rounded-full shrink-0" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="w-32 h-32 rounded-full shrink-0" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Bottom Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <Skeleton className="h-5 w-44 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header & Action Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h1>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Date Selector */}
          <button className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs cursor-pointer">
            <span>May 1 – May 31, 2025</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {/* Filter Button */}
          <button className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs cursor-pointer">
            <Filter size={14} className="text-slate-400" />
            <span>Filters</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={() => handleExportCSV('orders')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <Download size={14} className="text-slate-400" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Row 1: Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* 1. Total Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.totalRevenue?.display || '₹ 0'}</div>
          <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
            <ArrowUp size={10} />
            <span>{overview?.totalRevenue?.change || 0}% vs last month</span>
          </div>
        </div>

        {/* 2. Average Order Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Average Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.avgOrderValue?.display || '₹ 0'}</div>
          <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
            <ArrowUp size={10} />
            <span>{overview?.avgOrderValue?.change || 0}% vs last month</span>
          </div>
        </div>

        {/* 3. Repeat Order Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Repeat Order Rate</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RefreshCw size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.repeatOrderRate?.display || '0%'}</div>
          <div className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
            <span>Customer Reorders</span>
          </div>
        </div>

        {/* 4. Win Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Lead Win Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.winRate?.display || '0%'}</div>
          <div className="text-[10px] font-semibold text-purple-600 flex items-center gap-1">
            <span>Leads Converted</span>
          </div>
        </div>

        {/* 5. Total Customers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Customers</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.totalCustomers?.display || '0'}</div>
          <div className="text-[10px] font-semibold text-teal-600 flex items-center gap-1">
            <span>Database Records</span>
          </div>
        </div>

        {/* 6. Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900">{overview?.totalOrders?.display || '0'}</div>
          <div className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
            <span>Orders Created</span>
          </div>
        </div>

      </div>

      {/* Row 2: 3 Visual Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Card 1: Revenue Trend Line Area Chart (4.5 / 12 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Revenue Trend</h3>
              <Info size={14} className="text-slate-400" />
            </div>
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
              <span>This Month</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>

          <div className="h-60 w-full pt-2">
            {trendData && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFF', borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(val) => [`₹ ${val.toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <TrendingUp size={24} className="text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">No Revenue Trend Data</p>
                <p className="text-[10px] text-slate-400 font-normal">Create orders in DB to visualize sales trends</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Top Products by Sales Donut Chart (4 / 12 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Top Products by Sales</h3>
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
              <span>This Month</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {/* Donut with center text */}
            <div className="w-36 h-36 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    dataKey="percentage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`prod-${index}`} fill={entry.color || '#2563EB'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] text-slate-400 font-medium">Total Sales</span>
                <span className="text-[11px] font-bold text-slate-900">{overview?.totalRevenue?.display || '₹ 0'}</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="space-y-1.5 text-[11px] w-full pl-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#2563EB' }}></span>
                    <span className="text-slate-600 truncate font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 font-medium">{p.percentage}%</span>
                    <span className="font-bold text-slate-900">{p.sales}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Orders by Status Donut Chart (3.5 / 12 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Orders by Status</h3>
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
              <span>This Month</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {/* Donut with center text */}
            <div className="w-36 h-36 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersStatusData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {ordersStatusData.map((entry, index) => (
                      <Cell key={`stat-${index}`} fill={entry.color || '#16A34A'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] text-slate-400 font-medium">Total Orders</span>
                <span className="text-lg font-bold text-slate-900">{overview?.totalOrders?.display || '0'}</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="space-y-1.5 text-[11px] w-full pl-2">
              {ordersStatusData.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || '#16A34A' }}></span>
                    <span className="text-slate-600 truncate font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900">{s.count}</span>
                    <span className="text-slate-400 font-medium">({s.percentage})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Row 3: 2 Bottom Cards (Top Customers, Recent Reports) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Top Customers by Revenue (1 / 2 cols) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Top Customers by Revenue</h3>
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
              <span>This Month</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[10px] uppercase">
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-center">Orders</th>
                  <th className="pb-2 text-right">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full ${c.initialsBg} font-bold text-[10px] flex items-center justify-center shrink-0`}>
                          {c.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 leading-tight truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal truncate">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-800">{c.orders}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{c.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center border-t border-slate-100 pt-3">
            <button onClick={() => navigate('/customers')} className="text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer">
              <span>View All Customers</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Card 2: Recent Reports (1 / 2 cols) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Recent Reports</h3>
          </div>

          <div className="space-y-3">
            {recentReportsList.map((rep) => (
              <div key={rep.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl ${rep.isPdf ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center shrink-0`}>
                    {rep.isPdf ? <FileText size={16} /> : <FileSpreadsheet size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 leading-tight truncate">{rep.title}</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">{rep.type} • {rep.size}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleExportCSV(rep.title.toLowerCase().includes('customer') ? 'customers' : 'orders')}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    title="Download Report"
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center border-t border-slate-100 pt-3">
            <button onClick={() => handleExportCSV('orders')} className="text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer">
              <span>View All Reports</span>
              <ChevronRight size={14} />
            </button>
          </div>
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

