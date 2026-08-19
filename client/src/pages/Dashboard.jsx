import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Target,
  Star,
  Package,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  X,
  UserCheck
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [activities, setActivities] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [needsReview, setNeedsReview] = useState([]);
  const [callers, setCallers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reassign Modal State
  const [reassignModalItem, setReassignModalItem] = useState(null);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, funRes, trendRes, actRes, altRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/funnel'),
        api.get('/dashboard/conversion-trend'),
        api.get('/dashboard/activity-feed?limit=8'),
        api.get('/dashboard/alerts')
      ]);

      setSummary(sumRes.data);
      setFunnel(funRes.data);
      setTrendData(trendRes.data || []);
      setActivities(actRes.data || []);
      setAlerts(altRes.data);

      if (isManagerOrAdmin) {
        try {
          const [reviewRes, usersRes] = await Promise.all([
            api.get('/dashboard/needs-review'),
            api.get('/users?role=caller')
          ]);
          setNeedsReview(reviewRes.data || []);
          setCallers(usersRes.data || []);
        } catch (subErr) {
          console.warn('Non-fatal error fetching manager dashboard sub-panels:', subErr);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      notify.error(err.response?.data?.message || 'Error loading dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [isManagerOrAdmin, notify]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle Reassign Submit
  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalItem || !selectedCallerId) return;

    const isConfirmed = await confirm({
      title: 'Reassign Escalated Lead',
      message: 'Are you sure you want to reassign this escalated lead to the selected executive?',
      confirmLabel: 'Reassign Lead',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      setIsReassigning(true);
      await api.post(`/escalations/${reassignModalItem._id}/reassign`, {
        reassignedTo: selectedCallerId
      });
      notify.success('Lead successfully reassigned and escalation resolved!');
      setReassignModalItem(null);
      setSelectedCallerId('');
      fetchDashboardData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reassign lead');
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time performance metrics, conversion funnels, and urgent action alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {role === 'caller' ? `Sales Executive Scope (${user?.name})` : 'Company-Wide Scope'}
          </span>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Leads */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-400">
            <span>Total Leads</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Target size={18} /></span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{summary?.totalLeads?.count || 0}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              (summary?.totalLeads?.change || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {(summary?.totalLeads?.change || 0) >= 0 ? `+${summary?.totalLeads?.change}%` : `${summary?.totalLeads?.change}%`} vs last mo
            </span>
          </div>
        </div>

        {/* Converted Customers */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-400">
            <span>Converted Customers</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Star size={18} /></span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{summary?.convertedCustomers?.count || 0}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              (summary?.convertedCustomers?.change || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {(summary?.convertedCustomers?.change || 0) >= 0 ? `+${summary?.convertedCustomers?.change}%` : `${summary?.convertedCustomers?.change}%`} vs last mo
            </span>
          </div>
        </div>

        {/* Orders Delivered */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-400">
            <span>Orders Delivered</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Package size={18} /></span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{summary?.ordersDelivered?.count || 0}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              (summary?.ordersDelivered?.change || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {(summary?.ordersDelivered?.change || 0) >= 0 ? `+${summary?.ordersDelivered?.change}%` : `${summary?.ordersDelivered?.change}%`} vs last mo
            </span>
          </div>
        </div>

        {/* Repeat Orders */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-400">
            <span>Repeat Order Clients</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><RefreshCw size={18} /></span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{summary?.repeatOrders?.count || 0}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
              +{summary?.repeatOrders?.change || 12}% vs last mo
            </span>
          </div>
        </div>

      </div>

      {/* Alert Cards Row (4 Clickable Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Overdue Follow-ups */}
        <Link
          to="/followups?status=overdue"
          className="p-4 bg-rose-50/70 hover:bg-rose-50 border border-rose-200 rounded-2xl shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase text-rose-700">Overdue Follow-ups</span>
            <span className="text-2xl font-black text-rose-900 block mt-0.5">{alerts?.overdueFollowups || 0}</span>
          </div>
          <ArrowRight size={16} className="text-rose-500 group-hover:translate-x-1 transition" />
        </Link>

        {/* Due Today */}
        <Link
          to="/followups?status=open"
          className="p-4 bg-amber-50/70 hover:bg-amber-50 border border-amber-200 rounded-2xl shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase text-amber-700">Follow-ups Due Today</span>
            <span className="text-2xl font-black text-amber-900 block mt-0.5">{alerts?.dueToday || 0}</span>
          </div>
          <ArrowRight size={16} className="text-amber-500 group-hover:translate-x-1 transition" />
        </Link>

        {/* Upcoming Reminders */}
        <Link
          to="/reminders"
          className="p-4 bg-blue-50/70 hover:bg-blue-50 border border-blue-200 rounded-2xl shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase text-blue-700">Reminders (7 Days)</span>
            <span className="text-2xl font-black text-blue-900 block mt-0.5">{alerts?.upcomingReminders || 0}</span>
          </div>
          <ArrowRight size={16} className="text-blue-500 group-hover:translate-x-1 transition" />
        </Link>

        {/* Reorder Forecast */}
        <Link
          to="/customers"
          className="p-4 bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase text-emerald-700">30-Day Reorder Forecast</span>
            <span className="text-xl font-black text-emerald-900 block mt-0.5">
              ₹{(alerts?.reorderForecast || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <ArrowRight size={16} className="text-emerald-500 group-hover:translate-x-1 transition" />
        </Link>

      </div>

      {/* Middle Section: Chart & Sales Funnel (8 Cols / 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Conversion Rate Line Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Lead to Customer Conversion Rate Trend</h3>
              <p className="text-xs text-slate-500">Daily running conversion % throughout the current month</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
              Current Month
            </span>
          </div>

          <div className="h-64 w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF' }}
                    itemStyle={{ color: '#38BDF8', fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversionRate"
                    stroke="#DC2626"
                    strokeWidth={3}
                    dot={{ fill: '#DC2626', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sales Funnel Progress Bars (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Sales Funnel</h3>
            <p className="text-xs text-slate-500">Lead progression across pipeline stages</p>
          </div>

          <div className="space-y-4">
            {/* Total Leads */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Leads (Total)</span>
                <span className="text-slate-900 font-black">{funnel?.leads || 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-full"></div>
              </div>
            </div>

            {/* Contacted */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Contacted</span>
                <span className="text-slate-900 font-black">{funnel?.contacted || 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full"
                  style={{ width: `${funnel?.leads ? Math.min(100, Math.round((funnel.contacted / funnel.leads) * 100)) : 75}%` }}
                ></div>
              </div>
            </div>

            {/* Follow-up */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Follow-up</span>
                <span className="text-slate-900 font-black">{funnel?.followUp || 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${funnel?.leads ? Math.min(100, Math.round((funnel.followUp / funnel.leads) * 100)) : 50}%` }}
                ></div>
              </div>
            </div>

            {/* Order Received */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Order Received (Won)</span>
                <span className="text-emerald-700 font-black">{funnel?.orderReceived || 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${funnel?.leads ? Math.min(100, Math.round((funnel.orderReceived / funnel.leads) * 100)) : 30}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-center">
            <Link to="/leads" className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1">
              <span>Open Leads Kanban Board</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

      </div>

      {/* Bottom Section: Recent Activities & Needs MD Review Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Recent Activity Stream */}
        <div className={`${isManagerOrAdmin && needsReview.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm">Recent Activities Stream</h3>
            <span className="text-xs text-slate-400 font-semibold">Live Feed</span>
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No recent activity entries recorded.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div key={act._id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                    {act.createdBy?.name ? act.createdBy.name.slice(0, 2).toUpperCase() : 'SY'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{act.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>By: {act.createdBy?.name || 'System'}</span>
                      <span>•</span>
                      <span>{new Date(act.createdAt).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs MD Review Panel */}
        {isManagerOrAdmin && needsReview.length > 0 && (
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-rose-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                <h3 className="font-extrabold text-slate-900 text-sm">Needs MD Review</h3>
              </div>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-md flex items-center gap-1">
                <AlertTriangle size={12} />
                Critical Escalation
              </span>
            </div>

            <div className="space-y-3">
              {needsReview.map((item) => {
                const rec = item.relatedRecord || {};
                const callerName = item.assignedTo?.name || 'Unassigned Caller';

                return (
                  <div key={item._id} className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-black text-slate-900 text-sm block">{rec.name || 'Escalated Lead'}</span>
                        <span className="text-slate-500 text-xs">{rec.company || rec.phone || ''}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded uppercase">
                        {item.hoursOverdue}h Overdue
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-rose-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Assigned Caller</span>
                      <span className="font-bold text-slate-800">{callerName}</span>
                      <span className="block text-[11px] text-slate-500 mt-1">{item.notes || 'No follow-up notes'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReassignModalItem(item);
                        setSelectedCallerId(callers[0]?._id || '');
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <span>Reassign Executive</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Reassign Executive Modal */}
      {reassignModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Reassign Escalated Lead</h3>
              <button
                onClick={() => setReassignModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Select a new Tele Caller / Sales Executive to take over this escalated lead and resolve the MD Review flag.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Executive *</label>
                <select
                  required
                  value={selectedCallerId}
                  onChange={(e) => setSelectedCallerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Choose Sales Executive --</option>
                  {callers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
