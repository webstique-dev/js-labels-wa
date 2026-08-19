import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Clock, CheckCircle2, Phone, Mail, User, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

export default function FollowUps() {
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const initialStatus = searchParams.get('status') || 'open';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [followups, setFollowups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const canDelete = role === 'super_admin';

  const fetchFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' ? '/followups' : `/followups?status=${statusFilter}`;
      const res = await api.get(url);
      setFollowups(res.data?.followups || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error('Error fetching followups:', err);
      notify.error(err.response?.data?.message || 'Error loading follow-ups list');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, notify]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const handleDeleteFollowup = async (id) => {
    const isConfirmed = await confirm({
      title: 'Move Follow-up to Trash',
      message: 'Are you sure you want to soft delete this follow-up record? It will be moved to System Trash.',
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/followups/${id}`);
      notify.success('Follow-up record moved to Trash');
      fetchFollowups();
    } catch (err) {
      console.error('Error deleting followup:', err);
      notify.error(err.response?.data?.message || 'Failed to delete follow-up');
    }
  };

  const getStatusBadgeClass = (statusStr, isOverdue) => {
    if (statusStr === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (isOverdue) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Follow-ups Workspace</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage scheduled lead and customer follow-up calls, emails, and meetings</p>
        </div>
        <div className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-medium uppercase tracking-wider">
          Active Follow-Up Pipeline
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-amber-500">Open Follow-ups</span>
          <span className="text-2xl font-semibold text-amber-700 block">{summary?.open || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-blue-500">Due Today</span>
          <span className="text-2xl font-semibold text-blue-700 block">{summary?.dueToday || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-rose-500">Overdue</span>
          <span className="text-2xl font-semibold text-rose-700 block">{summary?.overdue || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-emerald-500">Completed</span>
          <span className="text-2xl font-semibold text-emerald-700 block">{summary?.completed || 0}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max">
            {[
              { key: 'open', label: 'Open Pipeline' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'completed', label: 'Completed' },
              { key: 'all', label: 'All Records' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 text-xs font-medium capitalize rounded-lg transition whitespace-nowrap ${
                  statusFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="text-slate-900 font-semibold">{followups.length}</span> follow-up tasks
        </div>
      </div>

      {/* Main Table / Stream View */}
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : followups.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Follow-ups Found</h3>
          <p className="text-xs text-slate-400 font-normal">There are no follow-up entries matching your filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Target Entity</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Assigned To</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followups.map((item) => {
                  const targetName = item.relatedId?.name || 'Account';
                  const targetSub = item.relatedId?.company || item.relatedId?.phone || item.relatedType;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <span className="font-semibold text-slate-900 block text-sm">{targetName}</span>
                        <span className="text-slate-400 text-[11px] font-normal">{targetSub}</span>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium rounded-lg uppercase text-[10px]">
                          {item.type || 'Call'}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`font-semibold ${item.isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                          {item.dueDate ? new Date(item.dueDate).toLocaleString('en-IN') : 'N/A'}
                        </span>
                        {item.isOverdue && item.status !== 'completed' && (
                          <span className="block text-[10px] text-rose-500 font-medium">Overdue</span>
                        )}
                      </td>

                      <td className="p-4 font-medium text-slate-700">
                        {item.assignedTo?.name || 'Unassigned'}
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getStatusBadgeClass(item.status, item.isOverdue)}`}>
                          {item.status === 'completed' ? 'Completed' : item.isOverdue ? 'Overdue' : 'Open'}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <Link
                          to={`/followups/${item._id}`}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl border border-red-200 text-xs transition inline-flex items-center gap-1"
                        >
                          <span>Open Call Workspace</span>
                          <ArrowRight size={12} />
                        </Link>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteFollowup(item._id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center"
                            title="Move to Trash"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {followups.map((item) => (
              <div key={item._id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block text-sm">{item.relatedId?.name || 'Account'}</span>
                    <span className="text-xs text-slate-500 font-normal">{item.relatedId?.company || item.relatedType}</span>
                  </div>
                  <span className={`px-2 py-0.5 border text-[10px] font-medium rounded uppercase ${getStatusBadgeClass(item.status, item.isOverdue)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-normal">
                    Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-IN') : 'N/A'}
                  </span>
                  <Link
                    to={`/followups/${item._id}`}
                    className="px-2.5 py-1 bg-slate-900 text-white font-medium rounded-lg text-[10px]"
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
