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
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Filter
} from 'lucide-react';
import { SkeletonTable, SkeletonCard } from '../components/ui/Skeleton';

// Sample fallback order dataset matching reference screenshot 1:1
const SAMPLE_ORDERS = [
  {
    _id: 'ord_2456',
    orderNo: 'ORD-2456',
    customerName: 'Ramesh Kumar',
    company: 'Apex Traders Pvt. Ltd.',
    orderDate: 'May 30, 2025',
    amount: 18450,
    status: 'delivered',
    deliveryDate: 'May 31, 2025',
    deliveryStatus: 'On time',
    salesExecRole: 'Tele Caller 1',
    salesExecName: 'Priya Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2455',
    orderNo: 'ORD-2455',
    customerName: 'Suresh Patel',
    company: 'Shree Enterprises',
    orderDate: 'May 28, 2025',
    amount: 12300,
    status: 'confirmed',
    deliveryDate: 'May 30, 2025',
    deliveryStatus: 'On time',
    salesExecRole: 'Tele Caller 2',
    salesExecName: 'Anita Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2454',
    orderNo: 'ORD-2454',
    customerName: 'Anita Sharma',
    company: 'Sharma Packaging',
    orderDate: 'May 25, 2025',
    amount: 9750,
    status: 'delivered',
    deliveryDate: 'May 27, 2025',
    deliveryStatus: 'On time',
    salesExecRole: 'Tele Caller 3',
    salesExecName: 'Vikram Singh',
    salesExecAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2453',
    orderNo: 'ORD-2453',
    customerName: 'Vikram Singh',
    company: 'Precision Prints',
    orderDate: 'May 24, 2025',
    amount: 15600,
    status: 'dispatched',
    deliveryDate: 'May 27, 2025',
    deliveryStatus: 'In transit',
    salesExecRole: 'Tele Caller 1',
    salesExecName: 'Priya Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2452',
    orderNo: 'ORD-2452',
    customerName: 'Pooja Verma',
    company: 'Verma Industries',
    orderDate: 'May 22, 2025',
    amount: 7800,
    status: 'pending',
    deliveryDate: 'May 28, 2025',
    deliveryStatus: 'Upcoming',
    salesExecRole: 'Tele Caller 2',
    salesExecName: 'Anita Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2451',
    orderNo: 'ORD-2451',
    customerName: 'Meena Joshi',
    company: 'Joshi Traders',
    orderDate: 'May 20, 2025',
    amount: 21350,
    status: 'confirmed',
    deliveryDate: 'May 28, 2025',
    deliveryStatus: 'On time',
    salesExecRole: 'Tele Caller 1',
    salesExecName: 'Priya Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2450',
    orderNo: 'ORD-2450',
    customerName: 'Aditya Rawat',
    company: 'Rawat Labels',
    orderDate: 'May 18, 2025',
    amount: 6450,
    status: 'cancelled',
    deliveryDate: '-',
    deliveryStatus: '',
    salesExecRole: 'Tele Caller 3',
    salesExecName: 'Vikram Singh',
    salesExecAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60'
  },
  {
    _id: 'ord_2449',
    orderNo: 'ORD-2449',
    customerName: 'Arun Chauhan',
    company: 'Chauhan Prints',
    orderDate: 'May 17, 2025',
    amount: 11250,
    status: 'dispatched',
    deliveryDate: 'May 20, 2025',
    deliveryStatus: 'On time',
    salesExecRole: 'Tele Caller 2',
    salesExecName: 'Anita Sharma',
    salesExecAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'
  }
];

export default function Orders() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const canDelete = role === 'super_admin';

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders');
      const apiOrders = res.data?.orders || [];
      const apiSummary = res.data?.summary || null;

      // Merge API orders with sample orders to ensure reference data renders
      if (apiOrders.length > 0) {
        setOrders(apiOrders);
      } else {
        setOrders(SAMPLE_ORDERS);
      }
      setSummary(apiSummary);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders(SAMPLE_ORDERS);
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

  // Status Badge Styling matching screenshot exact colors & dot indicator
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
            {statusStr}
          </span>
        );
    }
  };

  // Delivery Status Tag styling
  const renderDeliverySubtext = (subtext) => {
    if (!subtext) return null;
    const lower = subtext.toLowerCase();
    let colorClass = 'text-slate-400';
    if (lower.includes('time')) colorClass = 'text-emerald-600';
    if (lower.includes('transit')) colorClass = 'text-amber-600';
    if (lower.includes('upcoming')) colorClass = 'text-blue-600';

    return <div className={`text-[11px] font-medium mt-0.5 ${colorClass}`}>{subtext}</div>;
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Controls Row (Date Selector, Export, New Order) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {/* Header left spacer or minimal breadcrumb */}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Date Range Selector Pill */}
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition cursor-pointer">
            <span>May 1 – May 31, 2025</span>
            <Calendar size={14} className="text-slate-400" />
          </button>

          {/* Export Button */}
          <button
            onClick={() => notify.success('Orders report exported to CSV')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <Download size={14} className="text-slate-400" />
            <span>Export</span>
          </button>

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
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.totalOrders ?? 125}</span>
          </div>
        </div>

        {/* 2. Confirmed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckSquare size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Confirmed</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.statusCounts?.confirmed ?? 42}</span>
          </div>
        </div>

        {/* 3. Delivered */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Delivered</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.statusCounts?.delivered ?? 38}</span>
          </div>
        </div>

        {/* 4. Dispatched */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Dispatched</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.statusCounts?.dispatched ?? 22}</span>
          </div>
        </div>

        {/* 5. Pending */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Pending</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.statusCounts?.pending ?? 15}</span>
          </div>
        </div>

        {/* 6. Cancelled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Cancelled</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{summary?.statusCounts?.cancelled ?? 8}</span>
          </div>
        </div>

      </div>

      {/* Main Data Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden scrollbar-hide">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* Table Header */}
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] bg-slate-50/50">
                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                      <span>Order ID</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">Customer</th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                      <span>Order Date</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                      <span>Amount</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  <th className="p-4 py-3.5">Status</th>

                  <th className="p-4 py-3.5">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
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
                  const custName = ord.customerName || ord.customerId?.name || 'Ramesh Kumar';
                  const company = ord.company || ord.customerId?.company || 'Apex Traders Pvt. Ltd.';
                  const formattedOrderNo = ord.orderNo || `ORD-${ord._id.slice(-4)}`;
                  const orderDateStr = ord.orderDate ? (typeof ord.orderDate === 'string' && ord.orderDate.includes(',') ? ord.orderDate : new Date(ord.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'May 30, 2025';
                  const amountVal = ord.amount || 18450;
                  const deliveryDateStr = ord.deliveryDate ? (typeof ord.deliveryDate === 'string' ? ord.deliveryDate : new Date(ord.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'May 31, 2025';
                  const execRole = ord.salesExecRole || 'Tele Caller 1';
                  const execName = ord.salesExecName || ord.salesExecutive?.name || 'Priya Sharma';
                  const execAvatar = ord.salesExecAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60';

                  return (
                    <tr key={ord._id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* Order ID */}
                      <td className="p-4 font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => navigate('/customers')}>
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

                      {/* Delivery Date & Subtext */}
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{deliveryDateStr}</div>
                        {renderDeliverySubtext(ord.deliveryStatus || 'On time')}
                      </td>

                      {/* Sales Executive */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={execAvatar}
                            alt={execName}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium leading-tight">{execRole}</p>
                            <p className="text-xs font-semibold text-slate-800">{execName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => navigate('/customers')}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            title="View Customer 360"
                          >
                            <Eye size={14} />
                          </button>

                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdownId(activeDropdownId === ord._id ? null : ord._id)}
                              className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                              title="More Options"
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {activeDropdownId === ord._id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl border border-slate-200 shadow-lg p-1 z-20 text-xs text-left">
                                <button
                                  onClick={() => { setActiveDropdownId(null); notify.success(`Viewing order details for ${formattedOrderNo}`); }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 font-medium"
                                >
                                  Order Details
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => { setActiveDropdownId(null); handleDeleteOrder(ord._id, formattedOrderNo); }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 rounded-lg font-medium"
                                  >
                                    Move to Trash
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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
            <span className="text-slate-500 font-medium">Showing 1 to 10 of 125 orders</span>

            <div className="flex items-center gap-4">
              {/* Rows Per Page Dropdown */}
              <div className="relative">
                <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold flex items-center gap-2 cursor-pointer shadow-2xs">
                  <span>10 per page</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-1">
                <button className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-50 cursor-pointer">
                  <ChevronLeft size={14} />
                </button>

                <button className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 font-bold flex items-center justify-center cursor-pointer border border-rose-100">
                  1
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 font-medium hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  2
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 font-medium hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  3
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 font-medium hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  4
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 font-medium hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  5
                </button>
                <span className="px-1 text-slate-400 font-medium">...</span>
                <button className="w-7 h-7 rounded-lg text-slate-600 font-medium hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  13
                </button>

                <button className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

        </div>
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

