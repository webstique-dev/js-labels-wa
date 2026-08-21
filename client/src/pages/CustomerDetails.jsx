import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Edit2,
  Check,
  X,
  Star,
  MoreVertical,
  ChevronDown,
  ShoppingBag,
  FileText,
  MessageCircle,
  Truck,
  PhoneCall,
  Bell,
  Wallet,
  Target,
  RefreshCw,
  User,
  UserCheck,
  ExternalLink,
  Plus,
  Package,
  Eye,
  Pencil,
  Trash2
} from 'lucide-react';
import { SkeletonCustomer360 } from '../components/ui/Skeleton';
import NewOrderModal from '../components/NewOrderModal';
import {
  getLiveReorderProbability,
  getProbabilityColorClass,
  getProbabilityTextColorClass,
  getProbabilityBadgeClass
} from '../utils/reorderHelper';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Star / Favorite toggle state
  const [isStarred, setIsStarred] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  // New Order Popup Modal State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  // Activity Note State
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    gstNo: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    customerType: '',
    paymentTerms: '',
    creditLimit: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Order View & Edit Modal States
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderForm, setEditOrderForm] = useState({
    status: '',
    deliveryAddress: '',
    notes: '',
    expectedReorderDate: ''
  });
  const [submittingOrderEdit, setSubmittingOrderEdit] = useState(false);

  const handleDeleteOrder = async (orderId, orderNo) => {
    const isConfirmed = await confirm({
      title: 'Delete Order',
      message: `Are you sure you want to delete Order ${orderNo}? This action will soft-delete the order.`,
      confirmText: 'Delete Order',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/orders/${orderId}`);
      notify.success(`Order ${orderNo} deleted successfully`);
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
      fetchSummary();
      fetchTimeline();
    } catch (err) {
      console.error('Error deleting order:', err);
      notify.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleOpenEditOrder = (ord) => {
    setEditingOrder(ord);
    setEditOrderForm({
      status: ord.status || 'pending',
      deliveryAddress: ord.deliveryAddress || '',
      notes: ord.notes || '',
      expectedReorderDate: ord.expectedReorderDate ? new Date(ord.expectedReorderDate).toISOString().split('T')[0] : ''
    });
  };

  const handleSaveOrderEdit = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
      setSubmittingOrderEdit(true);
      const res = await api.put(`/orders/${editingOrder._id}`, editOrderForm);
      notify.success(`Order ${editingOrder.orderNo || ''} updated successfully`);
      setOrders((prev) => prev.map((o) => (o._id === editingOrder._id ? res.data : o)));
      setEditingOrder(null);
      fetchSummary();
      fetchTimeline();
    } catch (err) {
      console.error('Error updating order:', err);
      notify.error(err.response?.data?.message || 'Failed to update order');
    } finally {
      setSubmittingOrderEdit(false);
    }
  };

  const fetchCustomer360 = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, sumRes, ordRes, timeRes] = await Promise.allSettled([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/summary`),
        api.get(`/customers/${id}/orders`),
        api.get(`/customers/${id}/timeline`)
      ]);

      const custData = custRes.status === 'fulfilled' ? custRes.value.data : null;
      const sumData = sumRes.status === 'fulfilled' ? sumRes.value.data : null;
      const ordData = ordRes.status === 'fulfilled' ? ordRes.value.data : [];
      const timeData = timeRes.status === 'fulfilled' ? timeRes.value.data : [];

      setCustomer(custData);
      setSummary(sumData);
      setOrders(Array.isArray(ordData) ? ordData : []);
      setTimeline(Array.isArray(timeData) ? timeData : []);

      if (custData) {
        setFormData({
          name: custData.name || '',
          company: custData.company || '',
          phone: custData.phone || '',
          email: custData.email || '',
          gstNo: custData.gstNo || '',
          address: custData.address || '',
          city: custData.city || '',
          state: custData.state || '',
          pincode: custData.pincode || '',
          customerType: custData.customerType || '',
          paymentTerms: custData.paymentTerms || '',
          creditLimit: custData.creditLimit !== undefined && custData.creditLimit !== null ? custData.creditLimit : ''
        });
      }
    } catch (err) {
      console.error('Error fetching customer 360:', err);
      notify.error(err.response?.data?.message || 'Failed to load customer 360 details');
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    fetchCustomer360();
  }, [fetchCustomer360]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await api.patch(`/customers/${id}`, formData);
      notify.success('Customer profile updated successfully!');
      setIsEditing(false);
      fetchCustomer360();
    } catch (err) {
      console.error('Error updating customer profile:', err);
      notify.error(err.response?.data?.message || 'Failed to save customer profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return 'CU';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  const getStatusBadgeClass = (statusStr) => {
    switch (statusStr) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'dispatched':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'production':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'quality_check':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  if (loading) {
    return <SkeletonCustomer360 />;
  }

  if (!customer) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 font-sans">
        <h3 className="text-base font-semibold text-slate-800">Customer Not Found</h3>
        <p className="text-xs text-slate-500 font-normal">The requested customer profile could not be found.</p>
        <Link to="/customers" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold">
          Back to Customer Directory
        </Link>
      </div>
    );
  }

  // Pure DB values - only provided information rendered
  const customerName = customer.name || 'Customer';
  const customerCompany = customer.company || '';
  const customerPhone = customer.phone || '';
  const customerEmail = customer.email || '';
  const customerGst = customer.gstNo || '';
  const customerAddress = customer.address || '';
  const customerType = customer.customerType || '';
  const paymentTerms = customer.paymentTerms || '';
  const creditLimitStr = customer.creditLimit !== undefined && customer.creditLimit !== null ? `₹ ${customer.creditLimit.toLocaleString('en-IN')}` : null;
  const currentBalanceStr = customer.currentBalance !== undefined && customer.currentBalance !== null ? `₹ ${customer.currentBalance.toLocaleString('en-IN')}` : null;
  const reorderProb = getLiveReorderProbability(customer);
  const salesExecName = customer.salesExecutive?.name || null;
  const salesExecInitials = customer.salesExecutive?.name ? getInitials(customer.salesExecutive.name) : null;
  const customerSinceStr = customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  // Business Summary Metrics derived dynamically from DB
  const totalOrdersCount = summary?.totalOrders ?? orders.length;
  const totalSpentAmt = summary?.totalSpent ?? orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const lastOrderDateStr = summary?.lastOrder?.orderDate
    ? new Date(summary.lastOrder.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (orders.length > 0
        ? new Date(orders[0].orderDate || orders[0].createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'No orders');
  const avgOrderVal = summary?.avgOrderValue ?? (totalOrdersCount > 0 ? Math.round(totalSpentAmt / totalOrdersCount) : 0);
  const repeatOrdersCount = summary?.repeatOrders ?? (totalOrdersCount > 1 ? totalOrdersCount - 1 : 0);
  const repeatOrderRatePct = summary?.repeatOrderRate ?? (totalOrdersCount > 0 ? Math.round((repeatOrdersCount / totalOrdersCount) * 100) : 0);

  // Next Reorder Prediction Date
  const expectedDate = customer.expectedReorderDate ? new Date(customer.expectedReorderDate) : null;
  const monthAbbr = expectedDate ? expectedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const dayNum = expectedDate ? expectedDate.getDate() : '';
  const dayOfWeek = expectedDate ? expectedDate.toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const fullExpectedDateStr = expectedDate ? expectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const getActivityIcon = (type) => {
    switch (type) {
      case 'call':
        return <Phone size={14} className="text-indigo-600" />;
      case 'email':
        return <Mail size={14} className="text-purple-600" />;
      case 'whatsapp':
        return <MessageCircle size={14} className="text-emerald-600" />;
      case 'status_change':
        return <ShoppingBag size={14} className="text-emerald-600" />;
      case 'note':
        return <FileText size={14} className="text-blue-600" />;
      default:
        return <User size={14} className="text-slate-600" />;
    }
  };

  const getActivityBadgeBg = (type) => {
    switch (type) {
      case 'call':
        return 'bg-indigo-50 border-indigo-200';
      case 'email':
        return 'bg-purple-50 border-purple-200';
      case 'whatsapp':
        return 'bg-emerald-50 border-emerald-200';
      case 'status_change':
        return 'bg-emerald-50 border-emerald-200';
      case 'note':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-100 border-slate-200';
    }
  };

  const handleAddActivityNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    try {
      setSubmittingNote(true);
      const res = await api.post('/activities', {
        relatedType: 'customer',
        relatedId: id,
        type: 'note',
        description: newNoteText.trim()
      });
      setTimeline((prev) => [res.data, ...prev]);
      setNewNoteText('');
      notify.success('Activity note added to timeline');
    } catch (err) {
      console.error('Error adding activity note:', err);
      notify.error(err.response?.data?.message || 'Failed to add activity note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!customerPhone) return;
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const expDateStr = customer?.expectedReorderDate
      ? new Date(customer.expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'soon';

    let message = '';
    if (reorderProb >= 80) {
      message = `Hi ${customerName}, this is JS Labels. Your label supply is expected to need an urgent reorder around ${expDateStr} (${reorderProb}% reorder probability). Would you like us to process your next batch of custom labels today?`;
    } else if (reorderProb >= 50) {
      message = `Hi ${customerName}, greetings from JS Labels! Based on your usage cycle, your next label reorder is expected around ${expDateStr}. Please let us know if you'd like us to prepare your upcoming order!`;
    } else {
      message = `Hi ${customerName}, hope you are doing well! JS Labels is following up to check on your label inventory. Feel free to reach out whenever you're ready for your next reorder!`;
    }

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    notify.success(`Opening WhatsApp chat for ${customerName}...`);

    try {
      await api.post('/activities', {
        relatedType: 'customer',
        relatedId: id,
        type: 'whatsapp',
        description: `WhatsApp reminder opened for reorder (Reorder Probability: ${reorderProb}%)`
      });
      fetchTimeline();
    } catch (err) {
      console.error('Error logging WhatsApp activity:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <button
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Customers</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{customerName}</h1>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold rounded-md uppercase">
              Active Customer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 size={14} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag size={14} />
            <span>+ New Order</span>
          </button>
        </div>
      </div>

      {/* Top Header Navigation Tabs & Action Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-0">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-6 overflow-x-auto scrollbar-hide text-xs font-medium text-slate-500">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 transition font-semibold cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Timeline ({timeline.length})
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Orders ({orders.length})
          </button>
        </div>

        {/* Right Actions Dropdown Menu */}
        <div className="relative mb-2 sm:mb-0">
          <button
            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <span>Actions</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showActionsDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-30 p-1 space-y-0.5 text-xs">
              <button
                onClick={() => { setShowActionsDropdown(false); setIsEditing(true); }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
              >
                <Edit2 size={14} className="text-slate-400" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => { setShowActionsDropdown(false); setShowNewOrderModal(true); }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag size={14} className="text-slate-400" />
                <span>Create New Order</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUMN 1: Customer Profile & Attributes */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
            
            {/* Header Profile Info */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                    {getInitials(customerName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">{customerName}</h2>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold rounded-md uppercase">
                        Customer
                      </span>
                    </div>
                    {customerCompany && (
                      <p className="text-xs text-slate-500 font-normal mt-0.5">{customerCompany}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => setIsStarred(!isStarred)}
                    className="p-1 hover:text-amber-500 transition cursor-pointer"
                    title="Bookmark Customer"
                  >
                    <Star size={18} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
                  </button>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-1 hover:text-slate-700 transition cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Dynamic Tag Badges if available */}
              {customer.priority && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-semibold rounded-md uppercase">
                    {customer.priority} Priority
                  </span>
                </div>
              )}

              {/* Contact Information List - Only rendered if present */}
              <div className="space-y-3 pt-2 text-xs">
                {/* Phone */}
                {customerPhone && (
                  <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                    <Phone size={15} className="text-slate-400 shrink-0" />
                    <span>{customerPhone}</span>
                  </div>
                )}

                {/* Email */}
                {customerEmail && (
                  <div className="flex items-center gap-2.5 text-slate-700 font-medium truncate">
                    <Mail size={15} className="text-slate-400 shrink-0" />
                    <span className="truncate">{customerEmail}</span>
                  </div>
                )}

                {/* GST */}
                {customerGst && (
                  <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                    <FileText size={15} className="text-slate-400 shrink-0" />
                    <span>{customerGst}</span>
                  </div>
                )}

                {/* Address */}
                {customerAddress && (
                  <div className="flex items-start gap-2.5 text-slate-700 font-medium">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{customerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              
              {/* Customer Since */}
              {customerSinceStr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Customer Since</span>
                  <span className="text-slate-900 font-semibold">{customerSinceStr}</span>
                </div>
              )}

              {/* Sales Executive */}
              {salesExecName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Sales Executive</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
                      {salesExecInitials}
                    </div>
                    <span className="text-slate-900 font-semibold">{salesExecName}</span>
                  </div>
                </div>
              )}

              {/* Customer Type */}
              {customerType && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Customer Type</span>
                  <span className="text-slate-900 font-semibold">{customerType}</span>
                </div>
              )}

              {/* Payment Terms */}
              {paymentTerms && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Payment Terms</span>
                  <span className="text-slate-900 font-semibold">{paymentTerms}</span>
                </div>
              )}

              {/* Credit Limit */}
              {creditLimitStr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Credit Limit</span>
                  <span className="text-slate-900 font-semibold">{creditLimitStr}</span>
                </div>
              )}

              {/* Current Balance */}
              {currentBalanceStr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Current Balance</span>
                  <span className="text-emerald-600 font-bold">{currentBalanceStr}</span>
                </div>
              )}

              {/* Reorder Probability Progress Bar */}
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reorder Probability</span>
                  <span className={getProbabilityTextColorClass(reorderProb)}>{reorderProb}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center">
                  <div
                    className={`${getProbabilityColorClass(reorderProb)} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(0, reorderProb))}%` }}
                  ></div>
                </div>
              </div>

            </div>
          </div>

          {/* COLUMN 2: Dynamic Live Timeline Activity Feed */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Timeline</h3>
              <span className="text-[11px] font-semibold text-slate-400">{timeline.length} Activities</span>
            </div>

            {/* Quick Note Input Form */}
            <form onSubmit={handleAddActivityNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Log activity or note..."
                className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingNote || !newNoteText.trim()}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer shrink-0"
              >
                {submittingNote ? 'Posting...' : 'Post Note'}
              </button>
            </form>

            {/* Timeline Feed */}
            {timeline.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-normal bg-slate-50 rounded-xl border border-slate-100">
                No activity recorded yet for this customer.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-[460px] overflow-y-auto scrollbar-hide">
                {timeline.map((item) => (
                  <div key={item._id || item.id} className="p-3.5 flex items-start gap-3.5 text-xs hover:bg-slate-50/60 transition">
                    {/* Node icon */}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${getActivityBadgeBg(item.type)}`}>
                      {getActivityIcon(item.type)}
                    </div>

                    <div className="min-w-0 pr-2 flex-1">
                      <p className="font-bold text-slate-900 leading-snug break-words">{item.description || item.title || 'Activity'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                        {item.createdBy?.name ? `By ${item.createdBy.name}` : ''}
                      </p>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 font-medium shrink-0 leading-tight">
                      <div>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</div>
                      <div className="text-[10px] mt-0.5">{item.createdAt ? new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setActiveTab('timeline')}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 text-slate-700 font-semibold text-xs rounded-xl transition text-center shadow-2xs cursor-pointer"
            >
              View Full Timeline
            </button>

          </div>

          {/* COLUMN 3: Dynamic Business Summary, Reorder Prediction & Top Products */}
          <div className="space-y-5">
            
            {/* Card 1: Business Summary Metrics Grid */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Business Summary</h3>
              
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* 1. Total Orders */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShoppingBag size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Total Orders</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">{totalOrdersCount}</div>
                </div>

                {/* 2. Total Spent */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Wallet size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Total Spent</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">₹ {totalSpentAmt.toLocaleString('en-IN')}</div>
                </div>

                {/* 3. Last Order */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <FileText size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Last Order</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 pl-1 pt-1">{lastOrderDateStr}</div>
                </div>

                {/* 4. Avg Order Value */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <TrendingUp size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Avg. Order Value</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">₹ {avgOrderVal.toLocaleString('en-IN')}</div>
                </div>

                {/* 5. Repeat Orders */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <RefreshCw size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Repeat Orders</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">{repeatOrdersCount}</div>
                </div>

                {/* 6. Repeat Order Rate */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Target size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Repeat Order Rate</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">{repeatOrderRatePct}%</div>
                </div>
              </div>
            </div>

            {/* Card 2: Next Reorder Prediction Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Next Reorder Prediction</h3>
              
              {expectedDate ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pt-1">
                    {/* Red Date Box */}
                    <div className="w-16 text-center shadow-2xs rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <div className="bg-red-600 text-white text-[11px] font-bold py-0.5 tracking-wider uppercase">{monthAbbr}</div>
                      <div className="bg-slate-50 text-slate-900 text-xl font-bold py-1">{dayNum}</div>
                      <div className="bg-white text-[9px] text-slate-400 py-0.5 border-t border-slate-100">{dayOfWeek}</div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-slate-400 font-medium">Expected Reorder Date</span>
                      <div className="text-slate-900 font-bold text-sm">{fullExpectedDateStr}</div>
                      <div className={`font-semibold text-xs flex items-center gap-1 pt-0.5 ${getProbabilityTextColorClass(reorderProb)}`}>
                        <span>Probability</span>
                        <span className="font-bold">({reorderProb}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`${getProbabilityColorClass(reorderProb)} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(0, reorderProb))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Buttons Row matching UI design (Call, WhatsApp) */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    {/* Call Button */}
                    <a
                      href={customerPhone ? `tel:+91${customerPhone.toString().replace(/\D/g, '')}` : '#'}
                      onClick={(e) => {
                        if (!customerPhone) {
                          e.preventDefault();
                          notify.info(`No phone number recorded for ${customerName}`);
                        } else {
                          notify.success(`Initiating call to ${customerName}...`);
                        }
                      }}
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                    >
                      <Phone size={14} className="text-emerald-600" />
                      <span>Call</span>
                    </a>

                    {/* WhatsApp Button */}
                    <button
                      type="button"
                      onClick={handleWhatsAppClick}
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-emerald-600 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs font-normal">
                    No reorder prediction scheduled
                  </div>

                  {/* Action Buttons Row even if no date */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <a
                      href={customerPhone ? `tel:+91${customerPhone.toString().replace(/\D/g, '')}` : '#'}
                      onClick={(e) => {
                        if (!customerPhone) {
                          e.preventDefault();
                          notify.info(`No phone number recorded for ${customerName}`);
                        } else {
                          notify.success(`Initiating call to ${customerName}...`);
                        }
                      }}
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                    >
                      <Phone size={14} className="text-emerald-600" />
                      <span>Call</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleWhatsAppClick}
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-emerald-600 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Top Purchased Products Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Top Purchased Products</h3>
              {summary?.topProducts && summary.topProducts.length > 0 ? (
                <div className="space-y-2 pt-1 text-xs">
                  {summary.topProducts.map((prod, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-900 truncate">{prod.name}</p>
                        <p className="text-[10px] text-slate-400 font-normal">{prod.totalQty.toLocaleString('en-IN')} units purchased</p>
                      </div>
                      <span className="font-bold text-slate-800 shrink-0">₹ {prod.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs font-normal">
                  No product purchase history yet
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Full Activity Timeline</h3>
              <p className="text-xs text-slate-500 font-normal">Complete audit trail of customer interactions, status updates, and note entries</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
              {timeline.length} Total Activities
            </span>
          </div>

          {/* Quick Note Input Form */}
          <form onSubmit={handleAddActivityNote} className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Log a new activity note or update for this customer account..."
              className="flex-1 min-w-0 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingNote || !newNoteText.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer shrink-0"
            >
              {submittingNote ? 'Saving...' : 'Add Note'}
            </button>
          </form>

          {timeline.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-normal">No activity recorded for this customer account yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {timeline.map((item) => (
                <div key={item._id || item.id} className="p-4 flex items-start gap-4 text-xs hover:bg-slate-50/60 transition">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${getActivityBadgeBg(item.type)}`}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="min-w-0 pr-2 flex-1">
                    <p className="font-bold text-slate-900 leading-snug break-words">{item.description || item.title || 'Activity'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                      {item.createdBy?.name ? `Logged by ${item.createdBy.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-medium shrink-0 leading-tight">
                    <div>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                    <div className="text-[10px] mt-0.5">{item.createdAt ? new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse text-xs min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <th className="p-4">Order No</th>
                <th className="p-4">Order Date</th>
                <th className="p-4">Line Items</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-normal">No orders recorded for this customer account.</td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-900">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</td>
                    <td className="p-4 font-medium text-slate-600">{new Date(ord.orderDate || ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="p-4 text-slate-700">
                      {ord.lineItems && ord.lineItems.length > 0 ? (
                        <div className="space-y-0.5">
                          {ord.lineItems.map((li, idx) => (
                            <div key={idx} className="font-medium text-slate-800">
                              {li.name || li.description} <span className="text-slate-400 font-normal">({li.qty} units)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No line items specified</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-900">₹ {(ord.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 border text-[10px] font-semibold rounded-md uppercase ${getStatusBadgeClass(ord.status)}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingOrder(ord)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(ord._id, ord.orderNo || `ORD-${ord._id.slice(-6)}`)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Order"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View Order Modal Card */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Details</span>
                <h3 className="text-base font-bold text-slate-900">{viewingOrder.orderNo || `ORD-${viewingOrder._id.slice(-6)}`}</h3>
              </div>
              <button onClick={() => setViewingOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5">Order Status</p>
                  <span className={`px-2.5 py-0.5 border text-[10px] font-semibold rounded-md uppercase ${getStatusBadgeClass(viewingOrder.status)}`}>
                    {viewingOrder.status}
                  </span>
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

              {viewingOrder.advanceReceived && viewingOrder.advanceAmount > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <span className="font-medium text-emerald-800">Advance Received:</span>
                  <span className="font-bold text-emerald-700">₹ {viewingOrder.advanceAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Line Items */}
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

      {/* Edit Order Modal Card */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Update Order</span>
                <h3 className="text-base font-bold text-slate-900">{editingOrder.orderNo || `ORD-${editingOrder._id.slice(-6)}`}</h3>
              </div>
              <button onClick={() => setEditingOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Order Status</label>
                <select
                  value={editOrderForm.status}
                  onChange={(e) => setEditOrderForm({ ...editOrderForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="production">In Production</option>
                  <option value="quality_check">Quality Check</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected Reorder Date</label>
                <input
                  type="date"
                  value={editOrderForm.expectedReorderDate}
                  onChange={(e) => setEditOrderForm({ ...editOrderForm, expectedReorderDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Address</label>
                <textarea
                  rows={2}
                  value={editOrderForm.deliveryAddress}
                  onChange={(e) => setEditOrderForm({ ...editOrderForm, deliveryAddress: e.target.value })}
                  placeholder="Delivery address..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Order Notes</label>
                <textarea
                  rows={2}
                  value={editOrderForm.notes}
                  onChange={(e) => setEditOrderForm({ ...editOrderForm, notes: e.target.value })}
                  placeholder="Special instructions or notes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrderEdit}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                >
                  {submittingOrderEdit ? 'Saving...' : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Customer Profile</h3>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={formData.gstNo}
                  onChange={(e) => setFormData({ ...formData, gstNo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Popup Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          isOpen={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            notify.success('New order created successfully');
            fetchCustomerDetails();
            fetchTimeline();
            fetchOrders();
          }}
          initialCustomer={customer}
        />
      )}
    </div>
  );
}
