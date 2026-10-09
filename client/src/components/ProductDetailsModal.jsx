import React, { useState, useMemo } from 'react';
import api from '../api/axios';
import {
  X,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Ruler,
  Briefcase,
  Box,
  Palette,
  Tag,
  History,
  AlertCircle,
  Timer,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import Button from './ui/Button';
import CustomDatePicker from './ui/DatePicker';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { exportProductToExcel } from '../utils/exportUtils';

const QUICK_TIME_PRESETS = [
  '30 min',
  '45 min',
  '1 hour',
  '1 hr 30 min',
  '2 hours',
  '2 hr 30 min',
  '3 hours',
  '4 hours',
  '5 hours'
];

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    }
    const dt = new Date(dateStr);
    return isNaN(dt.getTime())
      ? dateStr
      : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

export default function ProductDetailsModal({
  isOpen,
  onClose,
  product,
  onUpdateProduct
}) {
  const notify = useNotification();
  const confirm = useConfirm();

  // Local job times state initialized from product
  const [jobTimes, setJobTimes] = useState(product?.jobTimes || []);
  const [date, setDate] = useState(getTodayStr());
  const [timeSpent, setTimeSpent] = useState('');
  const [notes, setNotes] = useState('');
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Sync state if product prop changes
  React.useEffect(() => {
    if (product?.jobTimes) {
      setJobTimes(product.jobTimes);
    } else {
      setJobTimes([]);
    }
  }, [product]);

  // Sorted job times (most recent date first)
  const sortedJobTimes = useMemo(() => {
    return [...(jobTimes || [])].sort((a, b) => {
      const dtA = new Date(a.date).getTime() || 0;
      const dtB = new Date(b.date).getTime() || 0;
      return dtB - dtA;
    });
  }, [jobTimes]);

  // Latest / Most recent job time entry
  const latestEntry = useMemo(() => {
    return sortedJobTimes.length > 0 ? sortedJobTimes[0] : null;
  }, [sortedJobTimes]);

  if (!isOpen || !product) return null;

  const resetForm = () => {
    setDate(getTodayStr());
    setTimeSpent('');
    setNotes('');
    setEditingTimeId(null);
  };

  const handleStartEdit = (entry) => {
    setEditingTimeId(entry._id);
    setDate(entry.date || getTodayStr());
    setTimeSpent(entry.timeSpent || '');
    setNotes(entry.notes || '');
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!date || !date.trim()) {
      notify.error('Please select a date');
      return;
    }

    if (!timeSpent || !timeSpent.trim()) {
      notify.error('Please enter or select a Job Time (e.g. 1 hour, 1 hr 30 min)');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        date: date.trim(),
        timeSpent: timeSpent.trim(),
        notes: (notes || '').trim()
      };

      let res;
      if (editingTimeId) {
        res = await api.patch(`/products/${product._id}/job-times/${editingTimeId}`, payload);
        notify.success('Job time entry updated');
      } else {
        res = await api.post(`/products/${product._id}/job-times`, payload);
        notify.success('Job time entry added');
      }

      if (res.data?.jobTimes) {
        setJobTimes(res.data.jobTimes);
      }
      if (res.data?.product && onUpdateProduct) {
        onUpdateProduct(res.data.product);
      }

      resetForm();
    } catch (err) {
      console.error('Error saving job time:', err);
      notify.error(err.response?.data?.message || 'Failed to save job time entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (timeId, entryDate, entryDuration) => {
    const isConfirmed = await confirm({
      title: 'Delete Time Entry?',
      message: `Are you sure you want to remove the entry for ${formatDisplayDate(entryDate)} (${entryDuration})?`,
      confirmLabel: 'Delete Entry',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/products/${product._id}/job-times/${timeId}`);
      notify.success('Job time entry removed');

      if (res.data?.jobTimes) {
        setJobTimes(res.data.jobTimes);
      }
      if (res.data?.product && onUpdateProduct) {
        onUpdateProduct(res.data.product);
      }

      if (editingTimeId === timeId) {
        resetForm();
      }
    } catch (err) {
      console.error('Error deleting job time:', err);
      notify.error(err.response?.data?.message || 'Failed to delete job time entry');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 animate-scale-up my-6 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Timer size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {product.name}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-[11px] rounded-md shadow-2xs">
                  <Ruler size={11} className="text-red-400 stroke-[2.5]" />
                  {product.dimensionKey || `${product.widthMm}x${product.heightMm}`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Product Details & Job Time Tracking History
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Product Specifications Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Briefcase size={11} /> Job Name
              </span>
              <p className="font-semibold text-slate-900 truncate">
                {product.jobName || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Box size={11} /> Material
              </span>
              <p className="font-semibold text-slate-900 truncate">
                {product.material || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Palette size={11} /> Colour
              </span>
              <p className="font-semibold text-slate-900 truncate">
                {product.colour || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Tag size={11} /> Category
              </span>
              <p className="font-semibold text-slate-900 truncate">
                {product.category || '—'}
              </p>
            </div>
          </div>

          {/* Latest Job Time Highlight Banner */}
          <div className="p-4 bg-gradient-to-r from-red-50/70 via-slate-50 to-amber-50/50 border border-red-100/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-red-200 shadow-2xs flex items-center justify-center text-red-600 shrink-0">
                <Clock size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Latest Job Time
                </span>
                {latestEntry ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                      {latestEntry.timeSpent}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      on {formatDisplayDate(latestEntry.date)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-600">
                    No time entries recorded yet
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-2xs">
                {sortedJobTimes.length} {sortedJobTimes.length === 1 ? 'Record' : 'Records'} Logged
              </span>
            </div>
          </div>

          {/* Add / Edit Time Entry Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {editingTimeId ? 'Edit Job Time Entry' : 'Log New Job Time Entry'}
                </h3>
              </div>
              {editingTimeId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker
                  required
                  selectedDate={date}
                  onChange={(val) => setDate(val)}
                  placeholder="Select date (e.g. YYYY-MM-DD)"
                />
              </div>

              {/* Job Time Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Job Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  placeholder="e.g. 1 hour, 2 hours, 1 hr 30 min"
                  className="w-full h-[42px] px-3.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none transition shadow-2xs"
                />
              </div>
            </div>

            {/* Quick Duration Preset Chips */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Quick Select Duration:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTimeSpent(preset)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                      timeSpent === preset
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-semibold text-slate-700">
                Notes / Context <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Batch of 5000 labels, Operator: Anil, Heidelberg 4C"
                className="w-full h-[38px] px-3.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs text-slate-800 focus:outline-none transition shadow-2xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {editingTimeId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={editingTimeId ? CheckCircle2 : Plus}
                loading={isSubmitting}
                loadingText={editingTimeId ? 'Updating...' : 'Adding...'}
              >
                {editingTimeId ? 'Update Entry' : 'Add Time Entry'}
              </Button>
            </div>
          </form>

          {/* Time History List / Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={15} className="text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Job Time History ({sortedJobTimes.length})
                </h3>
              </div>
            </div>

            {sortedJobTimes.length === 0 ? (
              <div className="p-8 bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                <Clock size={26} className="text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  No Job Time entries recorded yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Use the form above to log the time taken to produce or process this product on specific dates.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {/* Desktop / Tablet Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Job Time</th>
                        <th className="py-3 px-4">Notes / Remarks</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {sortedJobTimes.map((entry, idx) => (
                        <tr
                          key={entry._id || idx}
                          className={`hover:bg-slate-50/70 transition ${
                            editingTimeId === entry._id ? 'bg-red-50/30' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <span>{formatDisplayDate(entry.date)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-lg border border-red-200/80 font-mono">
                              <Clock size={12} className="text-red-500 stroke-[2.5]" />
                              {entry.timeSpent}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                            {entry.notes ? (
                              <span>{entry.notes}</span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Edit Entry"
                                onClick={() => handleStartEdit(entry)}
                                className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Delete Entry"
                                onClick={() => handleDelete(entry._id, entry.date, entry.timeSpent)}
                                className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {sortedJobTimes.map((entry, idx) => (
                    <div
                      key={entry._id || idx}
                      className={`p-3.5 space-y-2 ${
                        editingTimeId === entry._id ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatDisplayDate(entry.date)}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-red-700 font-bold text-xs rounded-md border border-red-200 font-mono">
                          <Clock size={11} className="text-red-500" />
                          {entry.timeSpent}
                        </span>
                      </div>

                      {entry.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {entry.notes}
                        </p>
                      )}

                      <div className="pt-1 flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleStartEdit(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDelete(entry._id, entry.date, entry.timeSpent)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={FileSpreadsheet}
            loading={isExporting}
            loadingText="Exporting..."
            disabled={isExporting}
            onClick={async () => {
              try {
                setIsExporting(true);
                await exportProductToExcel(product._id, product.name, notify);
              } catch (e) {
                // handled in utility
              } finally {
                setIsExporting(false);
              }
            }}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            Export Excel (.xlsx)
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
