import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Bell, Phone, MessageSquare, Mail, CheckCircle2, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

export default function Reminders() {
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);

  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  const fetchRemindersData = async () => {
    try {
      setLoading(true);
      setErrorState(null);
      const url = activeTab === 'all' ? '/reminders' : `/reminders?priority=${activeTab}`;
      
      // Root Cause Fix: /reminders/leaderboard is restricted to super_admin and manager ONLY.
      // Only include leaderboard request for authorized roles so caller/executive roles do not trigger 403 errors.
      const requests = [
        api.get(url),
        api.get('/reminders/summary')
      ];

      if (isManagerOrAdmin) {
        requests.push(api.get('/reminders/leaderboard'));
      }

      // Use Promise.allSettled so individual endpoint failures do not crash the entire page
      const results = await Promise.allSettled(requests);

      const remRes = results[0];
      const sumRes = results[1];
      const leadRes = isManagerOrAdmin ? results[2] : null;

      if (remRes.status === 'fulfilled') {
        setReminders(Array.isArray(remRes.value.data) ? remRes.value.data : []);
      } else {
        console.error('Error fetching reminders:', remRes.reason);
        if (remRes.reason?.response?.status === 403) {
          setErrorState('Access Denied: You do not have permission to view reorder reminders.');
        } else {
          setErrorState(remRes.reason?.response?.data?.message || 'Error fetching reorder reminders');
        }
      }

      if (sumRes?.status === 'fulfilled') {
        setSummary(sumRes.value.data || null);
      }

      if (leadRes?.status === 'fulfilled') {
        setLeaderboard(Array.isArray(leadRes.value.data) ? leadRes.value.data : []);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching reminders:', err);
      setErrorState('Unexpected error loading reminders data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemindersData();
  }, [activeTab, role]);

  const handleDismiss = async (customerId, customerName) => {
    const isConfirmed = await confirm({
      title: 'Complete Reorder Reminder',
      message: `Mark reorder reminder for "${customerName}" as resolved and update next forecast date?`,
      confirmLabel: 'Mark Completed',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      await api.patch(`/reminders/${customerId}/dismiss`);
      notify.success(`Reorder reminder for "${customerName}" completed!`);
      fetchRemindersData();
    } catch (err) {
      console.error('Error dismissing reminder:', err);
      notify.error(err.response?.data?.message || 'Failed to dismiss reminder');
    }
  };

  const handleQuickAction = async (customer, channel) => {
    try {
      if (channel === 'call') {
        window.open(`tel:${customer.phone}`);
      } else if (channel === 'whatsapp') {
        const cleanPhone = customer.phone?.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(customer.name)}%2C%20following%20up%20on%20your%20label%20reorder.`);
      } else if (channel === 'email') {
        window.open(`mailto:${customer.email}?subject=JS%20Labels%20Reorder%20Follow-up`);
      }

      await api.post(`/reminders/${customer._id}/action`, { channel });
      notify.success(`Logged ${channel} interaction for ${customer.name}`);
      fetchRemindersData();
    } catch (err) {
      console.error(`Error executing ${channel} action:`, err);
      notify.error(`Failed to log ${channel} interaction`);
    }
  };

  const getPriorityBadgeClass = (p) => {
    switch (p) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'JS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Defensive array checks
  const safeReminders = Array.isArray(reminders) ? reminders : [];
  const overdueReminders = safeReminders.filter((r) => r?.isOverdue);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Smart Reorder Reminders</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">AI-predicted customer reorder timing, probability scores, and proactive follow-ups</p>
        </div>
        <div className="px-3.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-medium uppercase tracking-wider">
          Proactive Reminders Engine
        </div>
      </div>

      {/* Permission Error Banner */}
      {errorState && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-medium">
          <ShieldAlert size={18} className="flex-shrink-0" />
          <span>{errorState}</span>
        </div>
      )}

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
                  className={`px-3 py-1.5 text-xs font-medium capitalize rounded-lg transition cursor-pointer ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonCard key={idx} className="h-44" />
              ))}
            </div>
          ) : safeReminders.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <Bell size={24} />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No Reminders Found</h3>
              <p className="text-xs text-slate-400 font-normal">No active customer reorder reminders match this priority filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {safeReminders.map((r) => {
                const c = r.customer || {};

                return (
                  <div key={r._id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <Link
                            to={`/customers/${c._id}`}
                            className="font-semibold text-slate-900 text-sm hover:text-red-600 transition block truncate max-w-[150px]"
                          >
                            {c.name || 'Customer'}
                          </Link>
                          <span className="text-slate-500 text-xs truncate block max-w-[140px] font-normal">{c.company || 'Individual'}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getPriorityBadgeClass(r.priority)}`}>
                        {r.priority} Priority
                      </span>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">Reorder Timing:</span>
                        <span className={`font-semibold ${r.isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-900'}`}>
                          {r.isOverdue
                            ? `Overdue by ${Math.abs(r.daysUntilReorder)} days`
                            : r.daysUntilReorder === 0
                            ? 'Due Today!'
                            : `Due in ${r.daysUntilReorder} days`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-slate-500">
                          <span>Reorder Probability</span>
                          <span className="text-slate-900 font-semibold">{r.probabilityScore}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.probabilityScore >= 80
                                ? 'bg-emerald-500'
                                : r.probabilityScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${r.probabilityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickAction(c, 'call')}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                          title="Call Customer"
                        >
                          <Phone size={14} />
                        </button>
                        <button
                          onClick={() => handleQuickAction(c, 'whatsapp')}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                          title="WhatsApp Reorder Reminder"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => handleQuickAction(c, 'email')}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer"
                          title="Email Reorder Template"
                        >
                          <Mail size={14} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDismiss(c._id, c.name)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 size={12} />
                        <span>Done</span>
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
                <h3 className="font-semibold text-slate-900 text-sm">Overdue Reorder Reminders ({overdueReminders.length})</h3>
              </div>

              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-rose-50/60 border-b border-rose-100 text-[10px] font-semibold uppercase text-rose-800 tracking-wider">
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
                          <Link to={`/customers/${r.customer?._id}`} className="font-semibold text-slate-900 hover:text-red-600">
                            {r.customer?.name}
                          </Link>
                          <span className="text-slate-400 text-[10px] block font-normal">{r.customer?.company || 'Individual'}</span>
                        </td>
                        <td className="p-3 font-semibold text-rose-600">
                          {Math.abs(r.daysUntilReorder)} Days
                        </td>
                        <td className="p-3 font-normal text-slate-700">
                          {r.customer?.expectedReorderDate ? new Date(r.customer.expectedReorderDate).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="p-3 font-normal text-slate-700">
                          {r.customer?.salesExecutive?.name || 'Unassigned'}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => handleQuickAction(r.customer, 'call')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 font-medium rounded text-[10px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Phone size={10} />
                            <span>Call</span>
                          </button>
                          <button
                            onClick={() => handleDismiss(r.customer?._id, r.customer?.name)}
                            className="px-2 py-1 bg-slate-900 text-white font-medium rounded text-[10px] inline-flex items-center gap-1 cursor-pointer"
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
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reminder Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Total Reminders</span>
                <span className="text-xl font-semibold text-slate-900">{summary?.total || 0}</span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-[10px] text-rose-600 font-medium uppercase block">Overdue</span>
                <span className="text-xl font-semibold text-rose-700">{summary?.overdue || 0}</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-[10px] text-red-600 font-medium uppercase block">High Priority</span>
                <span className="text-xl font-semibold text-red-700">{summary?.high || 0}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-[10px] text-amber-600 font-medium uppercase block">Medium / Low</span>
                <span className="text-xl font-semibold text-amber-700">{(summary?.medium || 0) + (summary?.low || 0)}</span>
              </div>
            </div>
          </div>

          {isManagerOrAdmin && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Sales Executive Leaderboard</h3>
              <div className="space-y-2.5">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-400 font-normal italic">No leaderboard metrics available.</p>
                ) : (
                  leaderboard.map((exec, idx) => (
                    <div key={exec.execId || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-semibold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{exec.name}</p>
                          <span className="text-[10px] text-slate-400 font-normal">{exec.count} active reminders</span>
                        </div>
                      </div>
                      <span className="font-semibold text-red-600">{exec.percentage}% Share</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
