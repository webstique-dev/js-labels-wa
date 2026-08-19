import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import NewOrderModal from '../components/NewOrderModal';
import { Plus, Trash2, CheckCircle2, Package, Calendar, Filter, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'production', label: 'In Production' },
  { value: 'qc', label: 'Quality Check' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE_MAP = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  production: 'bg-amber-50 text-amber-700 border-amber-200',
  qc: 'bg-purple-50 text-purple-700 border-purple-200',
  dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function Orders() {
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const canDelete = role === 'super_admin';

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const url = selectedStatus === 'all' ? '/orders' : `/orders?status=${selectedStatus}`;
      const res = await api.get(url);
      setOrders(res.data?.orders || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      notify.error(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      notify.success('Order status updated successfully');
      fetchOrders();
    } catch (err) {
      console.error('Status update error:', err);
      notify.error(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId, orderNo) => {
    const isConfirmed = await confirm({
      title: 'Move Order to Trash',
      message: `Are you sure you want to soft-delete order "${orderNo || orderId}"? It will be moved to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/orders/${orderId}`);
      notify.success(`Order "${orderNo || orderId}" moved to Trash`);
      fetchOrders();
    } catch (err) {
      console.error('Error deleting order:', err);
      notify.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Orders Management</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Track customer orders, production stages, delivery dates, and reorder cycles</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2"
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Total Orders</span>
          <span className="text-2xl font-semibold text-slate-900 block">{summary?.totalOrders || 0}</span>
          <span className="text-[10px] text-emerald-600 font-medium">₹{(summary?.totalRevenue || 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">Pending</span>
          <span className="text-2xl font-semibold text-slate-700 block">{summary?.statusCounts?.pending || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-amber-500">Production</span>
          <span className="text-2xl font-semibold text-amber-700 block">{summary?.statusCounts?.production || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-blue-500">Dispatched</span>
          <span className="text-2xl font-semibold text-blue-700 block">{summary?.statusCounts?.dispatched || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-emerald-500">Delivered</span>
          <span className="text-2xl font-semibold text-emerald-700 block">{summary?.statusCounts?.delivered || 0}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-medium uppercase text-rose-500">Cancelled</span>
          <span className="text-2xl font-semibold text-rose-700 block">{summary?.statusCounts?.cancelled || 0}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-red-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="text-slate-900 font-semibold">{orders.length}</span> orders
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <div className="min-h-[300px] bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Package size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-400 font-normal">There are no orders matching your selected status filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Order Details</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Order Date</th>
                  <th className="p-4">Delivery Date</th>
                  <th className="p-4">Status Stage</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-semibold text-slate-900">
                      <div>{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {ord.lineItems?.length || 0} Line Items • Usage Cycle: {ord.usageCycleDays || 30} days
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">
                        {ord.customerId?.name || 'Walk-in / Direct'}
                      </div>
                      <div className="text-slate-400 text-[11px] font-normal">
                        {ord.customerId?.company || ord.customerId?.phone || 'N/A'}
                      </div>
                    </td>

                    <td className="p-4 font-semibold text-slate-900">
                      ₹{(ord.amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="p-4 font-normal text-slate-600">
                      {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : 'N/A'}
                    </td>

                    <td className="p-4 font-normal text-slate-600">
                      {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN') : 'Pending'}
                    </td>

                    <td className="p-4">
                      <select
                        disabled={updatingId === ord._id}
                        value={ord.status}
                        onChange={(e) => handleStatusUpdate(ord._id, e.target.value)}
                        className={`px-2.5 py-1 border text-[11px] font-medium rounded-lg uppercase cursor-pointer focus:outline-none ${STATUS_BADGE_MAP[ord.status] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {STATUS_OPTIONS.filter(o => o.value !== 'all').map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-4 text-right">
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteOrder(ord._id, ord.orderNo)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked View */}
          <div className="md:hidden space-y-3">
            {orders.map((ord) => (
              <div key={ord._id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block text-sm">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</span>
                    <span className="text-xs text-slate-500 font-normal">{ord.customerId?.name || 'Walk-in / Direct'}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">₹{(ord.amount || 0).toLocaleString('en-IN')}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <select
                    disabled={updatingId === ord._id}
                    value={ord.status}
                    onChange={(e) => handleStatusUpdate(ord._id, e.target.value)}
                    className={`px-2.5 py-1 border text-[10px] font-medium rounded-lg uppercase ${STATUS_BADGE_MAP[ord.status] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {STATUS_OPTIONS.filter(o => o.value !== 'all').map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteOrder(ord._id, ord.orderNo)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Order Modal */}
      {isModalOpen && (
        <NewOrderModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
