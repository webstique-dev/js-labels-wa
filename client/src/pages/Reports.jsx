import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Download, AlertTriangle } from 'lucide-react';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#64748B'];

export default function Reports() {
  const notify = useNotification();
  const [rangePreset, setRangePreset] = useState('this_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [overview, setOverview] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [ordersByStatus, setOrdersByStatus] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [callerPerformance, setCallerPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Helper to Calculate Preset Dates
  const calculatePresetDates = useCallback((preset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === '30_days') {
      start = new Date();
      start.setDate(start.getDate() - 30);
      end = new Date();
    }

    const formatDateStr = (d) => d.toISOString().split('T')[0];
    return { from: formatDateStr(start), to: formatDateStr(end) };
  }, []);

  // Update dates on preset change
  useEffect(() => {
    if (rangePreset !== 'custom') {
      const { from, to } = calculatePresetDates(rangePreset);
      setFromDate(from);
      setToDate(to);
    }
  }, [rangePreset, calculatePresetDates]);

  // Stable Data Fetcher (empty deps to prevent infinite re-render loops)
  const fetchReportData = useCallback(async (fDate, tDate) => {
    if (!fDate || !tDate) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = { from: fDate, to: tDate, fromDate: fDate, toDate: tDate };

      // Root Cause Fix: Corrected route paths to match reportRoutes.js
      // /reports/executive-performance (not /reports/caller-performance)
      const [overRes, revRes, statRes, prodRes, callRes] = await Promise.all([
        api.get('/reports/overview', { params }),
        api.get('/reports/revenue-trend', { params }),
        api.get('/reports/orders-by-status', { params }),
        api.get('/reports/top-products', { params }),
        api.get('/reports/executive-performance', { params })
      ]);

      setOverview(overRes.data);
      setRevenueTrend(Array.isArray(revRes.data) ? revRes.data : []);
      setOrdersByStatus(Array.isArray(statRes.data) ? statRes.data : []);
      setTopProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCallerPerformance(Array.isArray(callRes.data) ? callRes.data : []);
    } catch (err) {
      console.error('Error fetching reports data:', err);
      const msg = err.response?.data?.message || 'Failed to load analytics reports';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch ONLY when dates change
  useEffect(() => {
    if (fromDate && toDate) {
      fetchReportData(fromDate, toDate);
    }
  }, [fromDate, toDate, fetchReportData]);

  // CSV Export Trigger
  const handleExportCSV = async (type) => {
    try {
      // Root Cause Fix: Corrected route path to /reports/export?type=...
      const response = await api.get('/reports/export', {
        params: { type, from: fromDate, to: toDate, fromDate, toDate },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${fromDate}_to_${toDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify.success(`Exported ${type} report successfully!`);
    } catch (err) {
      console.error(`Export ${type} error:`, err);
      notify.error(`Failed to export ${type} report.`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Executive Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Company-wide financial performance, product sales shares, and caller conversion benchmarks</p>
        </div>

        {/* CSV Export Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportCSV('orders')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-medium text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>Orders CSV</span>
          </button>
          <button
            onClick={() => handleExportCSV('customers')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>Customers CSV</span>
          </button>
          <button
            onClick={() => handleExportCSV('leads')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
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
                className={`px-3 py-1.5 text-xs font-medium capitalize rounded-lg transition whitespace-nowrap cursor-pointer ${
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

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          <span>From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setRangePreset('custom');
              setFromDate(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
          />
          <span>To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setRangePreset('custom');
              setToDate(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-medium">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Overview KPI Cards Row (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Total Revenue</span>
          <span className="text-xl font-semibold text-slate-900 block">
            ₹{(overview?.totalRevenue?.value || 0).toLocaleString('en-IN')}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            (overview?.totalRevenue?.change || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {(overview?.totalRevenue?.change || 0) >= 0 ? `+${overview?.totalRevenue?.change}%` : `${overview?.totalRevenue?.change}%`}
          </span>
        </div>

        {/* Avg Order Value */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Avg Order Value</span>
          <span className="text-xl font-semibold text-slate-900 block">
            ₹{(overview?.avgOrderValue?.value || 0).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.avgOrderValue?.change || 0}%
          </span>
        </div>

        {/* Repeat Order Rate */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Repeat Order Rate</span>
          <span className="text-xl font-semibold text-slate-900 block">
            {overview?.repeatOrderRate?.value || 0}%
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.repeatOrderRate?.change || 5}%
          </span>
        </div>

        {/* Lead Win Rate */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Lead Win Rate</span>
          <span className="text-xl font-semibold text-slate-900 block">
            {overview?.winRate?.value || 0}%
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.winRate?.change || 4}%
          </span>
        </div>

        {/* Total Customers */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Active Clients</span>
          <span className="text-xl font-semibold text-slate-900 block">
            {overview?.totalCustomers?.value || 0}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.totalCustomers?.change || 10}%
          </span>
        </div>

        {/* Total Orders */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Total Orders</span>
          <span className="text-xl font-semibold text-slate-900 block">
            {overview?.totalOrders?.value || 0}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
            +{overview?.totalOrders?.change || 0}%
          </span>
        </div>

      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-medium">Processing Analytics Datasets...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Charts Row 1: Revenue Growth & Orders Status Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Revenue Growth Trend Bar Chart */}
            <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Revenue Growth Trend</h3>
                  <p className="text-xs text-slate-500 font-normal">Monthly breakdown of delivered order value</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {revenueTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-normal">No revenue data for selected range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF' }}
                        formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#DC2626" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Orders by Status Donut Chart */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Orders by Status</h3>
                <p className="text-xs text-slate-500 font-normal">Distribution across order states</p>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                {ordersByStatus.length === 0 ? (
                  <span className="text-xs text-slate-400 font-normal">No order status breakdown.</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {ordersByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(count, name) => [count, `Status: ${name}`]} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Charts Row 2: Top Products & Executive Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Top Products */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Top Products by Revenue</h3>
                <p className="text-xs text-slate-500 font-normal">Highest performing label categories</p>
              </div>

              <div className="space-y-3">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 font-normal text-center py-6">No top products recorded.</p>
                ) : (
                  topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div>
                        <span className="font-medium text-slate-900 block">{p._id || 'Standard Label'}</span>
                        <span className="text-slate-400 text-[11px] font-normal">{p.totalQty} Units Ordered</span>
                      </div>
                      <span className="font-semibold text-slate-900">₹{(p.totalAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tele-Caller Performance Leaderboard */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 overflow-hidden">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Tele Caller Executive Performance</h3>
                <p className="text-xs text-slate-500 font-normal">Conversion metrics, lead count, and generated revenue</p>
              </div>

              <div className="overflow-x-auto scrollbar-hide">
                {callerPerformance.length === 0 ? (
                  <p className="text-xs text-slate-400 font-normal text-center py-6">No executive performance data available.</p>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                        <th className="p-3">Executive</th>
                        <th className="p-3 text-center">Leads Handled</th>
                        <th className="p-3 text-center">Won Leads</th>
                        <th className="p-3 text-center">Win Rate %</th>
                        <th className="p-3 text-right">Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {callerPerformance.map((exec) => (
                        <tr key={exec._id || exec.callerId} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-medium text-slate-900">
                            {exec.name}
                          </td>
                          <td className="p-3 text-center font-normal text-slate-700">{exec.assignedLeads ?? exec.totalLeads ?? 0}</td>
                          <td className="p-3 text-center font-normal text-slate-700">{exec.wonLeads ?? 0}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded text-[11px]">
                              {exec.winRate ?? 0}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-900">
                            ₹{(exec.revenueSum || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
