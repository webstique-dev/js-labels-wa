import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Calendar, CheckCircle2, ArrowRight, Clock } from 'lucide-react';

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'open': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'done': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export default function FollowUps() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [followUps, setFollowUps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState('');

  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  // Fetch Caller / Executive options if Manager or Admin
  useEffect(() => {
    if (isManagerOrAdmin) {
      api.get('/users?role=caller')
        .then((res) => setExecutives(res.data || []))
        .catch((err) => console.error('Error loading callers:', err));
    }
  }, [isManagerOrAdmin]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus) params.status = selectedStatus;
      if (selectedExecutive) params.assignedTo = selectedExecutive;

      const [listRes, sumRes] = await Promise.all([
        api.get('/followups', { params }),
        api.get('/followups/summary')
      ]);

      setFollowUps(listRes.data || []);
      setSummary(sumRes.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error fetching follow-ups');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedExecutive, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark Follow-Up Done
  const handleMarkDone = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Complete Follow-up',
      message: `Mark follow-up for "${name || 'Record'}" as completed?`,
      confirmLabel: 'Mark Done',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      await api.patch(`/followups/${id}`, { status: 'done' });
      notify.success('Follow-up marked as completed!');
      loadData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update follow-up');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Follow-ups Workspace</h1>
          <p className="text-slate-500 text-sm mt-1">Manage scheduled lead and customer follow-up calls, emails, and meetings</p>
        </div>
        <div className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold uppercase tracking-wider">
          Active Follow-Up Pipeline
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-amber-500">Open Follow-ups</span>
          <span className="text-2xl font-black text-amber-700 block">{summary?.open || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-blue-500">Due Today</span>
          <span className="text-2xl font-black text-blue-700 block">{summary?.dueToday || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-rose-500">Overdue</span>
          <span className="text-2xl font-black text-rose-700 block">{summary?.overdue || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-emerald-500">Completed</span>
          <span className="text-2xl font-black text-emerald-700 block">{summary?.completed || 0}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max">
            {[
              { key: '', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'done', label: 'Completed' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3 py-1.5 text-xs font-extrabold capitalize rounded-lg transition whitespace-nowrap ${
                  selectedStatus === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Executive Filter Dropdown (Manager/Admin Only) */}
        {isManagerOrAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Executive:</span>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Executives</option>
              {executives.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main List Table / Stacked Cards */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading Follow-ups...</p>
          </div>
        </div>
      ) : followUps.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Calendar size={24} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Follow-ups Found</h3>
          <p className="text-xs text-slate-400">There are no follow-ups matching your selected filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Contact / Record</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Notes Preview</th>
                  {isManagerOrAdmin && <th className="p-4">Assigned To</th>}
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {followUps.map((f) => {
                  const rec = f.relatedRecord || {};
                  const viewUrl = f.relatedType === 'lead' ? `/leads/${f.relatedId}/followup` : `/customers/${f.relatedId}`;

                  return (
                    <tr key={f._id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link to={viewUrl} className="font-bold text-slate-900 text-sm hover:text-red-600">
                            {rec.name || 'Record'}
                          </Link>
                          <span className={`px-1.5 py-0.5 border text-[9px] font-extrabold rounded uppercase ${
                            f.relatedType === 'lead' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {f.relatedType}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs block mt-0.5">{rec.company || 'Individual'}</span>
                      </td>

                      <td className="p-4 font-semibold">
                        <span className={f.status === 'overdue' ? 'text-rose-600 font-bold block' : 'text-slate-800 block'}>
                          {new Date(f.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {f.status === 'overdue' && (
                          <span className="text-[10px] text-rose-600 font-extrabold uppercase">Overdue</span>
                        )}
                      </td>

                      <td className="p-4 text-slate-600 font-medium max-w-xs truncate">
                        {f.notes || 'No notes added'}
                      </td>

                      {isManagerOrAdmin && (
                        <td className="p-4 font-semibold text-slate-700">
                          {f.assignedTo?.name || 'Unassigned'}
                        </td>
                      )}

                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[10px] font-extrabold rounded-lg uppercase ${getStatusBadgeClass(f.status)}`}>
                          {f.status}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2">
                        {f.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDone(f._id, rec.name)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            <span>Done</span>
                          </button>
                        )}
                        <Link
                          to={viewUrl}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-3">
            {followUps.map((f) => {
              const rec = f.relatedRecord || {};
              const viewUrl = f.relatedType === 'lead' ? `/leads/${f.relatedId}/followup` : `/customers/${f.relatedId}`;

              return (
                <div key={f._id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link to={viewUrl} className="font-bold text-slate-900 text-sm">
                          {rec.name || 'Record'}
                        </Link>
                        <span className={`px-1.5 py-0.5 border text-[9px] font-extrabold rounded uppercase ${
                          f.relatedType === 'lead' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {f.relatedType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{rec.company || 'Individual'}</p>
                    </div>

                    <span className={`px-2 py-0.5 border text-[10px] font-extrabold rounded uppercase ${getStatusBadgeClass(f.status)}`}>
                      {f.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Notes</span>
                    {f.notes || 'No notes added'}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className={f.status === 'overdue' ? 'font-bold text-rose-600' : 'font-semibold text-slate-600'}>
                      Due: {new Date(f.dueDate).toLocaleDateString('en-IN')}
                    </span>

                    <div className="space-x-1.5">
                      {f.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => handleMarkDone(f._id, rec.name)}
                          className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-[10px] rounded-lg inline-flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} />
                          <span>Done</span>
                        </button>
                      )}
                      <Link
                        to={viewUrl}
                        className="px-3 py-1 bg-red-600 text-white font-bold text-[10px] rounded-lg inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
