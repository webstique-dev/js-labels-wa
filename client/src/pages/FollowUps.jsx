import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  Trash2,
  Calendar,
  Filter,
  Search,
  ChevronDown
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

export default function FollowUps() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [followupsList, setFollowupsList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/followups');
      const list = Array.isArray(res.data) ? res.data : (res.data?.followups || []);
      const sum = res.data?.summary || null;
      setFollowupsList(list);
      setSummary(sum);
    } catch (err) {
      console.error('Error fetching follow-ups from DB:', err);
      notify.error('Failed to load follow-up records');
      setFollowupsList([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const getInitials = (name) => {
    if (!name) return 'CU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Filter rows
  const filteredFollowups = followupsList.filter((item) => {
    const related = item.relatedRecord || (typeof item.relatedId === 'object' ? item.relatedId : null);
    const nameStr = related?.name || item.name || '';
    const companyStr = related?.company || item.company || '';
    
    const nameMatch = nameStr.toLowerCase().includes(searchQuery.toLowerCase());
    const companyMatch = companyStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || companyMatch;

    if (!matchesSearch) return false;
    const s = (item.status || '').toLowerCase();
    if (statusFilter === 'open') return s === 'open';
    if (statusFilter === 'overdue') return s === 'overdue';
    if (statusFilter === 'completed') return s === 'completed' || s === 'done';
    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Follow-ups Workspace</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage scheduled customer call interactions, reorder follow-ups, and active pipelines</p>
        </div>
        <div className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold uppercase tracking-wider shrink-0">
          Active Follow-Up Pipeline
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-amber-600">Open Follow-ups</span>
          <span className="text-2xl font-bold text-amber-700 block">
            {summary?.open ?? followupsList.filter(f => f.status === 'open').length}
          </span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-blue-600">Due Today</span>
          <span className="text-2xl font-bold text-blue-700 block">
            {summary?.dueToday ?? 0}
          </span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-rose-600">Overdue</span>
          <span className="text-2xl font-bold text-rose-700 block">
            {summary?.overdue ?? followupsList.filter(f => f.status === 'overdue').length}
          </span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-emerald-600">Completed</span>
          <span className="text-2xl font-bold text-emerald-700 block">
            {summary?.completed ?? followupsList.filter(f => f.status === 'completed' || f.status === 'done').length}
          </span>
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', label: 'All Records' },
            { key: 'open', label: 'Open Pipeline' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'completed', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold capitalize rounded-lg transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-2xs'
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
            placeholder="Search customer or company..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Customer Follow-ups Data Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : filteredFollowups.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Clock size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No Follow-ups Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
            {searchQuery || statusFilter !== 'all'
              ? 'No follow-up records match your current search or status filter.'
              : 'There are no active follow-up tasks in the database.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <th className="p-4">Customer Entity</th>
                  <th className="p-4">Notes / Task</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Assigned To</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFollowups.map((item) => {
                  const related = item.relatedRecord || (typeof item.relatedId === 'object' ? item.relatedId : null);
                  const custName = related?.name || item.name || 'N/A';
                  const custCompany = related?.company || item.company || 'Individual Account';
                  const initials = getInitials(custName);
                  const notesText = item.notes || (item.relatedType === 'lead' ? 'Scheduled Lead Call' : 'Customer Follow-up');
                  const dueDateStr = item.dueDate ? new Date(item.dueDate).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
                  const assignedName = item.assignedTo?.name || 'Unassigned';

                  const statusStr = (item.status || 'open').toLowerCase();
                  let statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  let statusLabel = 'Open';

                  if (statusStr === 'overdue') {
                    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                    statusLabel = 'Overdue';
                  } else if (statusStr === 'completed' || statusStr === 'done') {
                    statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    statusLabel = 'Completed';
                  }

                  const targetId = item._id || item.id;
                  const workspaceNavId = item.relatedId?._id || item.relatedId || targetId;

                  return (
                    <tr key={targetId} className="hover:bg-slate-50/80 transition">
                      
                      {/* Customer Entity */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{custName}</p>
                            <p className="text-[11px] text-slate-400 font-normal">{custCompany}</p>
                          </div>
                        </div>
                      </td>

                      {/* Notes / Task */}
                      <td className="p-4 font-medium text-slate-700 max-w-xs truncate">
                        {notesText}
                      </td>

                      {/* Due Date */}
                      <td className="p-4 font-medium text-slate-800">
                        {dueDateStr}
                      </td>

                      {/* Assigned Executive */}
                      <td className="p-4 font-semibold text-slate-700">
                        {assignedName}
                      </td>

                      {/* Status Pill */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-md uppercase ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => navigate(`/followups/${workspaceNavId}`)}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-xs shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>View Followup</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}



