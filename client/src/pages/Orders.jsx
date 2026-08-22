import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import NewOrderModal from '../components/NewOrderModal';
import {
  Calendar,
  Download,
  Plus,
  FileText,
  CheckSquare,
  Truck,
  Clock,
  XCircle,
  ArrowUpDown,
  Eye,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

export default function Orders() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  const canDelete = role === 'super_admin';

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders');
      setOrders(res.data?.orders || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      notify.error(err.response?.data?.message || 'Error loading orders from database');
      setOrders([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (orderId, orderNo) => {
    const isConfirmed = await confirm({
      title: 'Move Order to Trash',
      message: `Are you sure you want to soft-delete order "${orderNo || orderId}"?`,
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
      notify.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  // Status Badge Styling matching reference design
  const renderStatusBadge = (statusStr) => {
    const s = (statusStr || '').toLowerCase();
    switch (s) {
      case 'delivered':
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Delivered
          </span>
        );
      case 'confirmed':
        return (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Confirmed
          </span>
        );
      case 'dispatched':
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Dispatched
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Pending
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {statusStr || 'Pending'}
          </span>
        );
    }
  };

  const getInitials = (name) => {
    if (!name) return 'EX';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 pb-12 font-sans">

      {/* Top Controls Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Order Management</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Track confirmed customer orders, dispatch status, and revenue</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Export Button */}
          {/* <button
            onClick={() => notify.success('Orders report exported successfully')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <Download size={14} className="text-slate-400" />
            <span>Export CSV</span>
          </button> */}

          {/* New Order Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Top 6 KPI Metric Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

        {/* 1. Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Total Orders</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {(summary?.totalOrders ?? orders.length).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* 2. Confirmed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CheckSquare size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Confirmed</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {summary?.statusCounts?.confirmed ?? orders.filter(o => o.status === 'confirmed').length}
            </span>
          </div>
        </div>

        {/* 3. Delivered */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Delivered</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {summary?.statusCounts?.delivered ?? orders.filter(o => o.status === 'delivered').length}
            </span>
          </div>
        </div>

        {/* 4. Dispatched */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Dispatched</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {summary?.statusCounts?.dispatched ?? orders.filter(o => o.status === 'dispatched').length}
            </span>
          </div>
        </div>

        {/* 5. Pending */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Pending</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {summary?.statusCounts?.pending ?? orders.filter(o => o.status === 'pending').length}
            </span>
          </div>
        </div>

        {/* 6. Cancelled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Cancelled</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {summary?.statusCounts?.cancelled ?? orders.filter(o => o.status === 'cancelled').length}
            </span>
          </div>
        </div>

      </div>

      {/* Main Data Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <FileText size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
            There are no active order records in the database.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-2xs hover:bg-red-700"
          >
            <Plus size={16} />
            <span>Create New Order</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden scrollbar-hide">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">

              {/* Table Header */}
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] bg-slate-50/50">
                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span>Order ID</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">Customer</th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span>Order Date</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span>Amount</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">Status</th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span>Delivery Date</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">Sales Executive</th>

                  <th className="p-4 py-3.5 text-center">Actions</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => {
                  const custName = ord.customerId?.name || ord.customerName || 'N/A';
                  const company = ord.customerId?.company || ord.company || 'Individual Account';
                  const formattedOrderNo = ord.orderNo || `ORD-${ord._id?.slice(-6)}`;
                  const orderDateStr = ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                  const amountVal = ord.amount || 0;
                  const deliveryDateStr = ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
                  const execName = ord.salesExecutive?.name || 'Unassigned';
                  const execRole = ord.salesExecutive?.role ? (ord.salesExecutive.role === 'caller' ? 'Caller' : ord.salesExecutive.role) : 'Executive';

                  return (
                    <tr key={ord._id} className="hover:bg-slate-50/80 transition group">

                      {/* Order ID */}
                      <td
                        className="p-4 font-bold text-blue-600 hover:underline cursor-pointer"
                        onClick={() => setViewingOrder(ord)}
                      >
                        {formattedOrderNo}
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <p className="font-bold text-slate-900 leading-tight">{custName}</p>
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">{company}</p>
                      </td>

                      {/* Order Date */}
                      <td className="p-4 text-slate-700 font-medium">{orderDateStr}</td>

                      {/* Amount */}
                      <td className="p-4 font-bold text-slate-900">₹ {amountVal.toLocaleString('en-IN')}</td>

                      {/* Status */}
                      <td className="p-4">{renderStatusBadge(ord.status)}</td>

                      {/* Delivery Date */}
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{deliveryDateStr}</div>
                      </td>

                      {/* Sales Executive */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          {ord.salesExecutive?.avatarUrl ? (
                            <img
                              src={ord.salesExecutive.avatarUrl}
                              alt={execName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                              {getInitials(execName)}
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium leading-tight capitalize">{execRole}</p>
                            <p className="text-xs font-semibold text-slate-800">{execName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Actions - Eye View Only */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => setViewingOrder(ord)}
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            title="View Order Details"
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

          {/* Table Footer / Pagination Row */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span className="text-slate-500 font-medium">Showing {orders.length} of {summary?.totalOrders || orders.length} orders</span>
          </div>

        </div>
      )}

      {/* View Order Details Popup Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide font-sans">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Details</span>
                <h3 className="text-base font-bold text-slate-900">{viewingOrder.orderNo || `ORD-${viewingOrder._id?.slice(-6)}`}</h3>
              </div>
              <button onClick={() => setViewingOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Customer Account Info */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Customer Account</p>
                  <p className="font-bold text-slate-900">{viewingOrder.customerId?.name || viewingOrder.customerName || 'Customer Account'}</p>
                  {viewingOrder.customerId?.company && (
                    <p className="text-[11px] text-slate-500 font-normal">{viewingOrder.customerId.company}</p>
                  )}
                </div>
                {viewingOrder.customerId?._id && (
                  <button
                    onClick={() => {
                      setViewingOrder(null);
                      navigate(`/customers/${viewingOrder.customerId._id}`);
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Customer Details →
                  </button>
                )}
              </div>

              {/* Status & Order Date */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5">Order Status</p>
                  {renderStatusBadge(viewingOrder.status)}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-medium">Order Date</p>
                  <p className="font-semibold text-slate-800">
                    {new Date(viewingOrder.orderDate || viewingOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {viewingOrder.expectedReorderDate && (
                <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex items-center justify-between">
                  <span className="font-medium text-slate-700">Expected Reorder Date:</span>
                  <span className="font-bold text-red-600">
                    {new Date(viewingOrder.expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {viewingOrder.deliveryDate && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-medium text-slate-600">Delivery Date:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(viewingOrder.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {viewingOrder.poNumber && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-medium text-slate-600">PO Number:</span>
                  <span className="font-semibold text-slate-900">{viewingOrder.poNumber}</span>
                </div>
              )}

              {viewingOrder.salesExecutive?.name && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-medium text-slate-600">Sales Executive:</span>
                  <span className="font-semibold text-slate-900">{viewingOrder.salesExecutive.name}</span>
                </div>
              )}

              {/* Line Items Table */}
              {viewingOrder.lineItems && viewingOrder.lineItems.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Order Line Items</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px]">
                          <th className="p-2.5">Item Description</th>
                          <th className="p-2.5 text-right">Qty</th>
                          <th className="p-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingOrder.lineItems.map((item, idx) => {
                          const lineAmt = item.lineTotal !== undefined && item.lineTotal !== null
                            ? item.lineTotal
                            : (item.amount || (item.rate && item.qty ? (item.qty / 1000) * item.rate : 0));
                          return (
                            <tr key={idx}>
                              <td className="p-2.5 font-medium text-slate-800">{item.name || item.description}</td>
                              <td className="p-2.5 text-right text-slate-600">{item.qty?.toLocaleString('en-IN')}</td>
                              <td className="p-2.5 text-right font-bold text-slate-900">₹ {lineAmt.toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-bold text-sm text-slate-900">
                <span>Total Order Value</span>
                <span className="text-red-600">₹ {(viewingOrder.amount || 0).toLocaleString('en-IN')}</span>
              </div>

              {viewingOrder.deliveryAddress && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold text-slate-800 block mb-1">Delivery Address:</span>
                  {viewingOrder.deliveryAddress}
                </div>
              )}

              {viewingOrder.notes && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold text-slate-800 block mb-1">Order Notes:</span>
                  {viewingOrder.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {isModalOpen && (
        <NewOrderModal
          isOpen={isModalOpen}
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


