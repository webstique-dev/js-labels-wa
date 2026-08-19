import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Download, BarChart3, TrendingUp, Users, Package } from 'lucide-react';

const PIE_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#64748B', '#EF4444'];

export default function Reports() {
  const { user, role } = useAuth();
  const notify = useNotification();

  const [overview, setOverview] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [execPerformance, setExecPerformance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date Range Presets: 'this_month' | 'last_month' | '30_days' | 'custom'
  const [rangePreset, setRangePreset] = useState('this_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Compute preset dates
  useEffect(() => {
    const now = new Date();
    if (rangePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (rangePreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    } else if (rangePreset === '30_days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    }
  }, [rangePreset]);

  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const [ovRes, revRes, prodRes, stRes, custRes, execRes] = await Promise.all([
        api.get('/reports/overview', { params }),
        api.get('/reports/revenue-trend', { params }),
        api.get('/reports/top-products', { params }),
        api.get('/reports/orders-by-status', { params }),
        api.get('/reports/top-customers', { params }),
        api.get('/reports/executive-performance', { params })
      ]);

      setOverview(ovRes.data);
      setRevenueTrend(revRes.data || []);
      setTopProducts(prodRes.data || []);
      setOrdersStatus(stRes.data || []);
      setTopCustomers(custRes.data || []);
      setExecPerformance(execRes.data || []);
    } catch (err) {
      console.error('Error loading reports analytics:', err);
      notify.error(err.response?.data?.message || 'Error fetching analytics data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, notify]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Handle CSV Export
  const handleExportCSV = async (type) => {
    try {
      notify.info(`Generating ${type} CSV export download...`);
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      params.append('type', type);

      const response = await api.get(`/reports/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify.success(`${type.toUpperCase()} CSV downloaded successfully!`);
    } catch (err) {
      notify.error('Failed to export CSV data');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Company-wide financial performance, product sales shares, and caller conversion benchmarks</p>
        </div>

        {/* CSV Export Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportCSV('orders')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Orders CSV</span>
          </button>
          <button
            onClick={() => handleExportCSV('customers')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Customers CSV</span>
          </button>
          <button
            onClick={() => handleExportCSV('leads')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Leads CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max">
            {[
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: '30_days', label: 'Last 30 Days' },
              { key: 'custom', label: 'Custom' }
            ].map((preset) => (
              <button
                key={preset.key}
                onClick={() => setRangePreset(preset.key)}
                className={`px-3 py-1.5 text-xs font-extrabold capitalize rounded-lg transition whitespace-nowrap ${
                  rangePreset === preset.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span>From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setRangePreset('custom');
              setFromDate(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          />
          <span>To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setRangePreset('custom');
              setToDate(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          />
        </div>
      </div>

      {/* Overview KPI Cards Row (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Revenue</span>
          <span className="text-xl font-black text-slate-900 block">
            ₹{(overview?.totalRevenue?.value || 0).toLocaleString('en-IN')}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            (overview?.totalRevenue?.change || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {(overview?.totalRevenue?.change || 0) >= 0 ? `+${overview?.totalRevenue?.change}%` : `${overview?.totalRevenue?.change}%`}
          </span>
        </div>

        {/* Avg Order Value */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Avg Order Value</span>
          <span className="text-xl font-black text-slate-900 block">
            ₹{(overview?.avgOrderValue?.value || 0).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.avgOrderValue?.change || 0}%
          </span>
        </div>

        {/* Repeat Order Rate */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Repeat Order Rate</span>
          <span className="text-xl font-black text-slate-900 block">
            {overview?.repeatOrderRate?.value || 0}%
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.repeatOrderRate?.change || 5}%
          </span>
        </div>

        {/* Lead Win Rate */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Lead Win Rate</span>
          <span className="text-xl font-black text-slate-900 block">
            {overview?.winRate?.value || 0}%
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.winRate?.change || 4}%
          </span>
        </div>

        {/* Total Customers */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Active Clients</span>
          <span className="text-xl font-black text-slate-900 block">
            {overview?.totalCustomers?.value || 0}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.totalCustomers?.change || 10}%
          </span>
        </div>

        {/* Total Orders */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Orders</span>
          <span className="text-xl font-black text-slate-900 block">
            {overview?.totalOrders?.value || 0}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.totalOrders?.change || 0}%
          </span>
        </div>

      </div>

      {/* Middle Section: Revenue Trend Line Chart & Orders Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Revenue Trend Line Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Revenue Growth Trend</h3>
              <p className="text-xs text-slate-500">Daily delivered order revenue across selected period</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Sales Delivered
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF' }}
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status Donut Chart (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Orders by Status</h3>
            <p className="text-xs text-slate-500">Percentage distribution across pipeline stages</p>
          </div>

          <div className="h-44 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ordersStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {ordersStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [`${value} Orders (${props.payload.percentage}%)`, name.toUpperCase()]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Breakdown Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            {ordersStatus.slice(0, 4).map((st, idx) => (
              <div key={st.status} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                <span className="capitalize text-slate-700 font-semibold">{st.status} ({st.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Lower Section: Top Products & Sales Executive Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Top Products by Sales Share (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">Top Products by Revenue</h3>
          
          <div className="space-y-3.5">
            {topProducts.map((p, idx) => (
              <div key={p.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{idx + 1}. {p.name}</span>
                  <span className="font-black text-slate-900">₹{(p.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-full rounded-full"
                    style={{ width: `${p.percentage || 25}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Executive Performance Scorecard (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm">Tele Caller Executive Performance</h3>
            <span className="text-xs text-slate-400 font-semibold">Ranked by Revenue</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-3">Executive</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3">Won</th>
                  <th className="p-3">Win Rate</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {execPerformance.map((exec) => (
                  <tr key={exec._id} className="hover:bg-slate-50 transition font-semibold text-slate-800">
                    <td className="p-3 font-bold text-slate-900">{exec.name}</td>
                    <td className="p-3 text-slate-600">{exec.assignedLeads}</td>
                    <td className="p-3 text-emerald-600 font-bold">{exec.wonLeads}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[11px]">
                        {exec.winRate}%
                      </span>
                    </td>
                    <td className="p-3">{exec.orderCount}</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      ₹{(exec.revenueSum || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="sm:hidden space-y-3">
            {execPerformance.map((exec, idx) => (
              <div key={exec._id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{idx + 1}. {exec.name}</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[11px] border border-emerald-200">
                    {exec.winRate}% win
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Leads</span>
                    <span className="font-bold text-slate-800">{exec.assignedLeads}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Won</span>
                    <span className="font-bold text-emerald-700">{exec.wonLeads}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Orders</span>
                    <span className="font-bold text-slate-800">{exec.orderCount}</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200 flex justify-between text-xs">
                  <span className="text-slate-500">Total Revenue:</span>
                  <span className="font-black text-slate-900">₹{(exec.revenueSum || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
