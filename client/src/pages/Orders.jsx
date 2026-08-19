import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import NewOrderModal from '../components/NewOrderModal';
import { Plus, Trash2, CheckCircle2, Package, Calendar, Filter, X } from 'lucide-react';

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'dispatched': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'quality_check': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'production': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'confirmed': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const getDeliveryStatusLabel = (order) => {
  if (order.status === 'delivered') {
    return { text: 'On time', class: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (['confirmed', 'production', 'quality_check', 'dispatched'].includes(order.status)) {
    return { text: 'In transit', class: 'text-blue-700 bg-blue-50 border-blue-200' };
  }
  if (order.status === 'pending') {
    return { text: 'Upcoming', class: 'text-slate-700 bg-slate-100 border-slate-200' };
  }
  return { text: 'Cancelled', class: 'text-rose-700 bg-rose-50 border-rose-200' };
};

export default function Orders() {
  const { user, permissions, role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canDelete = role === 'super_admin' || role === 'manager';

  const fetchOrdersAndSummary = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus) params.status = selectedStatus;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const [ordersRes, sumRes] = await Promise.all([
        api.get('/orders', { params }),
        api.get('/orders/summary', { params })
      ]);

      setOrders(ordersRes.data.orders || []);
      setSummary(sumRes.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error fetching orders');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, fromDate, toDate, notify]);

  useEffect(() => {
    fetchOrdersAndSummary();
  }, [fetchOrdersAndSummary]);

  // Handle Status Update
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      notify.success(`Order ${res.data.orderNo || ''} status updated to ${newStatus}`);
      fetchOrdersAndSummary();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update order status');
    }
  };

  // Handle Order Delete
  const handleDeleteOrder = async (orderId, orderNo) => {
    const isConfirmed = await confirm({
      title: 'Move Order to Trash',
      message: `Are you sure you want to delete order "${orderNo}"? It will be soft deleted and moved to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/orders/${orderId}`);
      notify.success(`Order ${orderNo} moved to Trash`);
      fetchOrdersAndSummary();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Orders Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track customer orders, production stages, delivery dates, and reorder cycles</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2"
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Orders</span>
          <span className="text-2xl font-black text-slate-900 block">{summary?.totalOrders || 0}</span>
          <span className="text-[10px] text-emerald-600 font-bold">₹{(summary?.totalRevenue || 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Pending</span>
          <span className="text-2xl font-black text-slate-700 block">{summary?.statusCounts?.pending || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-amber-500">Production</span>
          <span className="text-2xl font-black text-amber-700 block">{summary?.statusCounts?.production || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-blue-500">Dispatched</span>
          <span className="text-2xl font-black text-blue-700 block">{summary?.statusCounts?.dispatched || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-emerald-500">Delivered</span>
          <span className="text-2xl font-black text-emerald-700 block">{summary?.statusCounts?.delivered || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-extrabold uppercase text-rose-500">Cancelled</span>
          <span className="text-2xl font-black text-rose-700 block">{summary?.statusCounts?.cancelled || 0}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Order Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="production">In Production</option>
            <option value="quality_check">Quality Check</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            />
          </div>

          {(selectedStatus || fromDate || toDate) && (
            <button
              onClick={() => {
                setSelectedStatus('');
                setFromDate('');
                setToDate('');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1"
            >
              <X size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading Orders...</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Package size={24} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No order records match your selected filters.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Order & Customer</th>
                <th className="p-4">Order Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Delivery Status</th>
                <th className="p-4">Sales Executive</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {orders.map((ord) => {
                const delLabel = getDeliveryStatusLabel(ord);

                return (
                  <tr key={ord._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <span className="font-black text-slate-900 block text-sm">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</span>
                      <span className="text-slate-600 font-semibold text-xs">{ord.customerId?.name || 'Deleted Customer'}</span>
                      {ord.customerId?.company ? (
                        <span className="text-slate-400 text-[11px] block">{ord.customerId.company}</span>
                      ) : (
                        !ord.customerId && <span className="text-slate-400 text-[11px] italic block">(Soft-deleted)</span>
                      )}
                    </td>

                    <td className="p-4 font-semibold text-slate-700">
                      {new Date(ord.orderDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="p-4 font-extrabold text-slate-900 text-sm">
                      ₹{(ord.amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="p-4">
                      <select
                        value={ord.status}
                        onChange={(e) => handleStatusChange(ord._id, e.target.value)}
                        className={`px-2.5 py-1 border text-[11px] font-extrabold rounded-lg uppercase focus:ring-2 focus:ring-red-500 cursor-pointer ${getStatusBadgeClass(ord.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="production">Production</option>
                        <option value="quality_check">Quality Check</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase ${delLabel.class}`}>
                        {delLabel.text}
                      </span>
                    </td>

                    <td className="p-4 font-semibold text-slate-700">
                      {ord.salesExecutive?.name || 'Unassigned'}
                    </td>

                    <td className="p-4 text-right">
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteOrder(ord._id, ord.orderNo || ord._id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
      )}

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          notify.success('New order created successfully!');
          fetchOrdersAndSummary();
        }}
      />
    </div>
  );
}
