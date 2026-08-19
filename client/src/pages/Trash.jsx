import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Trash2, RotateCcw, Check, User, AlertTriangle } from 'lucide-react';

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'leads', label: 'Leads' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products' },
  { key: 'users', label: 'Users' },
  { key: 'followups', label: 'Follow-ups' }
];

export default function Trash() {
  const notify = useNotification();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('orders');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchTrashItems = async (resource) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get(`/trash/${resource}`);
      const dataList = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setItems(dataList);
    } catch (err) {
      console.error(`Error fetching trashed ${resource}:`, err);
      const msg = err.response?.data?.message || `Failed to fetch trashed ${resource}`;
      setErrorMessage(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems(activeTab);
  }, [activeTab]);

  const handleRestore = async (id, displayName) => {
    const isConfirmed = await confirm({
      title: 'Restore Record',
      message: `Are you sure you want to restore "${displayName || id}" back to active system records?`,
      confirmLabel: 'Restore Record',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      await api.post(`/trash/${activeTab}/${id}/restore`);
      notify.success(`Restored "${displayName || id}" successfully`);
      fetchTrashItems(activeTab);
    } catch (err) {
      console.error('Error restoring record:', err);
      notify.error(err.response?.data?.message || 'Failed to restore record');
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getItemDisplayName = (item) => {
    if (!item) return 'Unknown Record';
    if (activeTab === 'orders') return item.orderNo || `Order #${item._id?.slice(-6)}`;
    if (activeTab === 'leads') return `${item.name || 'Lead'}${item.company ? ` (${item.company})` : ''}`;
    if (activeTab === 'customers') return `${item.name || 'Customer'}${item.company ? ` (${item.company})` : ''}`;
    if (activeTab === 'products') return item.name || 'Product';
    if (activeTab === 'users') return `${item.name || 'User'} (${item.email || 'No email'})`;
    if (activeTab === 'followups') return `Follow-up #${item._id?.slice(-6)} (${item.relatedType || 'Record'})`;
    return item.name || item._id || 'Record';
  };

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Trash2 size={24} className="text-red-600" />
            System Trash & Recovery
          </h1>
          <p className="text-sm text-slate-500 font-normal mt-1">
            Super Admin center for reviewing and restoring soft-deleted records across all modules.
          </p>
        </div>
      </div>

      {/* Resource Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto scrollbar-hide pb-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'border-red-600 text-red-600 bg-red-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-medium">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Content Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-500 mt-3 font-normal">Loading trashed records...</p>
          </div>
        ) : safeItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Check size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Trashed Items</h3>
            <p className="text-sm text-slate-500 mt-1 font-normal">
              There are no deleted records in the <span className="font-medium">{TABS.find(t => t.key === activeTab)?.label}</span> bin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Item Details</th>
                  <th className="py-3.5 px-4">Deleted At</th>
                  <th className="py-3.5 px-4">Deleted By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeItems.map((item) => {
                  const displayName = getItemDisplayName(item);
                  const deletedByUser = item.deletedBy?.name || item.deletedBy?.email || 'System / Admin';

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{displayName}</div>
                        {activeTab === 'orders' && item.customerId && (
                          <div className="text-xs text-slate-400 font-normal">
                            Customer: {item.customerId.name || 'Deleted Customer'} • ₹{(item.amount || 0).toLocaleString('en-IN')}
                          </div>
                        )}
                        {activeTab === 'leads' && (
                          <div className="text-xs text-slate-400 font-normal">
                            Phone: {item.phone || 'N/A'} • Status: {item.status || 'N/A'}
                          </div>
                        )}
                        {activeTab === 'customers' && (
                          <div className="text-xs text-slate-400 font-normal">
                            Phone: {item.phone || 'N/A'} • City: {item.city || 'N/A'}
                          </div>
                        )}
                        {activeTab === 'followups' && (
                          <div className="text-xs text-slate-400 font-normal">
                            Notes: {item.notes || 'No notes'}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-normal text-slate-600">
                        {formatDateTime(item.deletedAt || item.updatedAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          <User size={12} className="text-slate-400" />
                          <span>{deletedByUser}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRestore(item._id, displayName)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
