import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  Mail,
  User,
  AlertCircle,
  Calendar,
  Search,
  Eye,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';
import { initiatePhoneCall, openWhatsApp, WhatsAppIcon } from '../utils/contactUtils';
import {
  getLiveReorderProbability,
  getProbabilityColorClass,
  getProbabilityTextColorClass
} from '../utils/reorderHelper';

export default function FollowUps() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      const list = Array.isArray(res.data) ? res.data : (res.data?.customers || []);
      setCustomers(list);
    } catch (err) {
      console.error('Error fetching customer follow-ups from DB:', err);
      notify.error('Failed to load customer follow-up records');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const getInitials = (name) => {
    if (!name || name === '-') return 'CU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Process live customer reminder & follow-up status metrics
  const processedCustomers = customers.map((cust) => {
    const name = cust.name || 'Customer';
    const company = cust.company || '-';
    const phone = cust.phone || '-';
    const email = cust.email || '';
    const expDateStr = cust.expectedReorderDate;
    const reorderProb = getLiveReorderProbability(cust);
    const execName = cust.salesExecutive?.name || 'Unassigned';

    let daysUntilReorder = null;
    let followupStatus = 'no_date'; // 'overdue', 'due_today', 'upcoming', 'no_date'
    let formattedDate = 'Not Scheduled';
    let daysText = 'No reorder date set';

    if (expDateStr) {
      const expDate = new Date(expDateStr);
      if (!isNaN(expDate.getTime())) {
        formattedDate = expDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const expStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        const diffTime = expStart - todayStart;
        daysUntilReorder = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilReorder < 0) {
          followupStatus = 'overdue';
          daysText = `Overdue by ${Math.abs(daysUntilReorder)} days`;
        } else if (daysUntilReorder === 0) {
          followupStatus = 'due_today';
          daysText = 'Reorder Due Today';
        } else {
          followupStatus = 'upcoming';
          daysText = `Expected in ${daysUntilReorder} days`;
        }
      }
    }

    return {
      ...cust,
      displayName: name,
      displayCompany: company,
      displayPhone: phone,
      displayEmail: email,
      expDateStr,
      formattedDate,
      daysUntilReorder,
      followupStatus,
      daysText,
      reorderProb,
      execName
    };
  });

  // Calculate live summary statistics
  const totalCount = processedCustomers.length;
  const overdueCount = processedCustomers.filter((c) => c.followupStatus === 'overdue').length;
  const dueTodayCount = processedCustomers.filter((c) => c.followupStatus === 'due_today').length;
  const upcomingCount = processedCustomers.filter((c) => c.followupStatus === 'upcoming').length;

  // Filter customers based on search and status filter tab
  const filteredCustomers = processedCustomers.filter((cust) => {
    // 1. Search Query Filter (Name, Company, Phone)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (cust.displayName || '').toLowerCase().includes(q);
      const companyMatch = (cust.displayCompany || '').toLowerCase().includes(q);
      const phoneMatch = (cust.displayPhone || '').toLowerCase().includes(q);
      if (!nameMatch && !companyMatch && !phoneMatch) return false;
    }

    // 2. Status Filter Tab
    if (statusFilter === 'overdue') return cust.followupStatus === 'overdue';
    if (statusFilter === 'due_today') return cust.followupStatus === 'due_today';
    if (statusFilter === 'upcoming') return cust.followupStatus === 'upcoming';

    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Follow-ups Workspace</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Real-time customer reorder follow-ups, reminder schedules, and sales executive assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFollowups}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Total Customers</span>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 block tracking-tight">
            {totalCount}
          </span>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-blue-600">Due Today</span>
          <span className="text-2xl sm:text-3xl font-bold text-blue-700 block tracking-tight">
            {dueTodayCount}
          </span>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-rose-600">Overdue Reminders</span>
          <span className="text-2xl sm:text-3xl font-bold text-rose-700 block tracking-tight">
            {overdueCount}
          </span>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-emerald-600">Upcoming Reorders</span>
          <span className="text-2xl sm:text-3xl font-bold text-emerald-700 block tracking-tight">
            {upcomingCount}
          </span>
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', label: `All Customers (${totalCount})` },
            { key: 'due_today', label: `Due Today (${dueTodayCount})` },
            { key: 'overdue', label: `Overdue (${overdueCount})` },
            { key: 'upcoming', label: `Upcoming (${upcomingCount})` }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, company, phone..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Customer Follow-ups Data Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : filteredCustomers.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Clock size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No Customer Follow-ups Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
            {searchQuery || statusFilter !== 'all'
              ? 'No customer records match your current search query or filter selection.'
              : 'There are no active customer records in the database.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Customer</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Reorder / Follow-up Date</th>
                <th className="p-4">Reorder Probability</th>
                <th className="p-4">Sales Executive</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-sans">
              {filteredCustomers.map((cust) => {
                const initials = getInitials(cust.displayName);

                let statusBadgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
                let statusLabel = 'No Schedule';

                if (cust.followupStatus === 'overdue') {
                  statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  statusLabel = 'Overdue';
                } else if (cust.followupStatus === 'due_today') {
                  statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                  statusLabel = 'Due Today';
                } else if (cust.followupStatus === 'upcoming') {
                  statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  statusLabel = 'Upcoming';
                }

                return (
                  <tr
                    key={cust._id}
                    onClick={() => navigate(`/followups/${cust._id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    
                    {/* Customer Entity */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate hover:text-red-600">{cust.displayName}</p>
                          <p className="text-slate-500 text-[11px] font-normal truncate">{cust.displayCompany}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact Phone */}
                    <td className="p-4 font-semibold text-slate-800">
                      {cust.displayPhone}
                    </td>

                    {/* Reorder / Follow-up Date */}
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{cust.formattedDate}</p>
                        <p className={`text-[11px] font-medium ${cust.followupStatus === 'overdue' ? 'text-red-600 font-bold' : cust.followupStatus === 'due_today' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                          {cust.daysText}
                        </p>
                      </div>
                    </td>

                    {/* Reorder Probability */}
                    <td className="p-4">
                      <div className="w-36 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Probability</span>
                          <span className={getProbabilityTextColorClass(cust.reorderProb)}>{cust.reorderProb}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getProbabilityColorClass(cust.reorderProb)}`}
                            style={{ width: `${Math.min(100, Math.max(0, cust.reorderProb))}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Sales Executive */}
                    <td className="p-4 font-semibold text-slate-700">
                      {cust.execName}
                    </td>

                    {/* Status Pill */}
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-md uppercase ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={`View follow-up details for ${cust.displayName}`}
                          onClick={() => navigate(`/followups/${cust._id}`)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
