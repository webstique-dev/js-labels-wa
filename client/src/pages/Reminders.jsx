import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Bell, Phone, MessageSquare, Mail, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'CU';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getPriorityBadgeClass = (prio) => {
  switch (prio) {
    case 'high': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export default function Reminders() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // Priority Tab Filter
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'high' | 'medium' | 'low'

  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab !== 'all') params.priority = activeTab;

      const [remRes, sumRes] = await Promise.all([
        api.get('/reminders', { params }),
        api.get('/reminders/summary')
      ]);

      setReminders(remRes.data || []);
      setSummary(sumRes.data);

      if (isManagerOrAdmin) {
        const leadRes = await api.get('/reminders/leaderboard');
        setLeaderboard(leadRes.data || []);
      }
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error loading reminders data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isManagerOrAdmin, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Log Quick Action
  const handleQuickAction = async (customer, actionType) => {
    try {
      let desc = '';
      if (actionType === 'call') desc = `Initiated call to ${customer.phone}`;
      else if (actionType === 'whatsapp') desc = `Opened WhatsApp chat with ${customer.phone}`;
      else if (actionType === 'email') desc = `Sent email to ${customer.email}`;

      await api.post('/activities', {
        relatedType: 'customer',
        relatedId: customer._id,
        type: actionType,
        description: desc
      });
      notify.success(`Logged ${actionType} action for ${customer.name}`);
    } catch (err) {
      console.error('Error logging action:', err);
    }

    if (actionType === 'call') {
      window.location.href = `tel:${customer.phone}`;
    } else if (actionType === 'whatsapp') {
      const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } else if (actionType === 'email') {
      window.location.href = `mailto:${customer.email}`;
    }
  };

  // Dismiss / Mark Done
  const handleDismiss = async (customerId, customerName) => {
    const isConfirmed = await confirm({
      title: 'Acknowledge Reorder Reminder',
      message: `Mark reorder reminder for "${customerName}" as acknowledged/completed?`,
      confirmLabel: 'Mark Done',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      await api.patch(`/reminders/${customerId}/dismiss`);
      notify.success(`Acknowledged reminder for ${customerName}`);
      loadData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to acknowledge reminder');
    }
  };

  // Filter overdue reminders
  const overdueReminders = reminders.filter((r) => r.isOverdue);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Reorder Reminders</h1>
          <p className="text-slate-500 text-sm mt-1">AI-predicted customer reorder timing, probability scores, and proactive follow-ups</p>
        </div>
        <div className="px-3.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-wider">
          Proactive Reminders Engine
        </div>
      </div>

      {/* 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT SECTION: Tabs, Reminder Cards Grid & Overdue Table */}
        <div className="lg:col-span-8 space-y-6">

          {/* Priority Tabs */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { key: 'all', label: `All (${summary?.total || 0})` },
                { key: 'high', label: `High (${summary?.high || 0})` },
                { key: 'medium', label: `Medium (${summary?.medium || 0})` },
                { key: 'low', label: `Low (${summary?.low || 0})` }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-xs font-extrabold capitalize rounded-lg transition ${
                    activeTab === tab.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Cards Stream */}
          {loading ? (
            <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-xs font-semibold">Computing Reorder Predictions...</p>
              </div>
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <Bell size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">No Reminders Found</h3>
              <p className="text-xs text-slate-400">No active customer reorder reminders match this priority filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reminders.map((r) => {
                const c = r.customer;

                return (
                  <div key={r._id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <Link
                            to={`/customers/${c._id}`}
                            className="font-bold text-slate-900 text-sm hover:text-red-600 transition block truncate max-w-[150px]"
                          >
                            {c.name}
                          </Link>
                          <span className="text-slate-500 text-xs truncate block max-w-[140px]">{c.company || 'Individual'}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 border text-[10px] font-extrabold rounded-md uppercase ${getPriorityBadgeClass(r.priority)}`}>
                        {r.priority} Priority
                      </span>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Reorder Timing:</span>
                        <span className={`font-extrabold ${r.isOverdue ? 'text-rose-600 font-black' : 'text-slate-900'}`}>
                          {r.isOverdue
                            ? `Overdue by ${Math.abs(r.daysUntilReorder)} days`
                            : r.daysUntilReorder === 0
                            ? 'Due Today!'
                            : `Due in ${r.daysUntilReorder} days`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Reorder Probability</span>
                          <span className="text-slate-900 font-extrabold">{r.probabilityScore}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.probabilityScore >= 80
                                ? 'bg-emerald-500'
                                : r.probabilityScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${r.probabilityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAction(c, 'call')}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition"
                          title="Call"
                        >
                          <Phone size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAction(c, 'whatsapp')}
                          className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-bold transition"
                          title="WhatsApp"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAction(c, 'email')}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition"
                          title="Email"
                        >
                          <Mail size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDismiss(c._id, c.name)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-bold text-[11px] rounded-xl shadow-xs transition flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} />
                        <span>Mark Done</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overdue Reminders Table Section */}
          {overdueReminders.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-rose-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                <h3 className="font-extrabold text-slate-900 text-sm">Overdue Reorder Reminders ({overdueReminders.length})</h3>
              </div>

              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-rose-50/60 border-b border-rose-100 text-[10px] font-extrabold uppercase text-rose-800 tracking-wider">
                      <th className="p-3">Customer</th>
                      <th className="p-3">Days Overdue</th>
                      <th className="p-3">Expected Date</th>
                      <th className="p-3">Sales Executive</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {overdueReminders.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <Link to={`/customers/${r.customer._id}`} className="font-bold text-slate-900 hover:text-red-600">
                            {r.customer.name}
                          </Link>
                          <span className="text-slate-400 text-[10px] block">{r.customer.company || 'Individual'}</span>
                        </td>
                        <td className="p-3 font-black text-rose-600">
                          {Math.abs(r.daysUntilReorder)} Days
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {new Date(r.customer.expectedReorderDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {r.customer.salesExecutive?.name || 'Unassigned'}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => handleQuickAction(r.customer, 'call')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] inline-flex items-center gap-1"
                          >
                            <Phone size={10} />
                            <span>Call</span>
                          </button>
                          <button
                            onClick={() => handleDismiss(r.customer._id, r.customer.name)}
                            className="px-2 py-1 bg-slate-900 text-white font-bold rounded text-[10px] inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={10} />
                            <span>Done</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT SECTION: Summary Card, Leaderboard & Mini Calendar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reminder Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Reminders</span>
                <span className="text-xl font-black text-slate-900">{summary?.total || 0}</span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-[10px] text-rose-600 font-bold uppercase block">Overdue</span>
                <span className="text-xl font-black text-rose-700">{summary?.overdue || 0}</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-[10px] text-red-600 font-bold uppercase block">High Priority</span>
                <span className="text-xl font-black text-red-700">{summary?.high || 0}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-[10px] text-amber-600 font-bold uppercase block">Medium / Low</span>
                <span className="text-xl font-black text-amber-700">{(summary?.medium || 0) + (summary?.low || 0)}</span>
              </div>
            </div>
          </div>

          {isManagerOrAdmin && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Sales Executive Leaderboard</h3>
              <div className="space-y-2.5">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No leaderboard metrics available.</p>
                ) : (
                  leaderboard.map((exec, idx) => (
                    <div key={exec.execId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{exec.name}</p>
                          <span className="text-[10px] text-slate-400">{exec.count} active reminders</span>
                        </div>
                      </div>
                      <span className="font-extrabold text-red-600">{exec.percentage}% Share</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Month Due Dates</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Active reorder reminders are distributed across upcoming week cycles.
              </p>
              <div className="pt-2 border-t border-slate-200 text-xs font-bold text-emerald-600">
                ✓ AI Automation Engine Operational
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
