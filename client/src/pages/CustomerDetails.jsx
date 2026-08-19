import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'CU';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getRelativeTime = (dateString) => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const getOrderStatusBadgeClass = (status) => {
  switch (status) {
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'dispatched': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'production': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'confirmed': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotification();

  const [customer, setCustomer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab Selection
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'timeline' | 'orders'

  // Quick Note Input for Timeline
  const [newNoteInput, setNewNoteInput] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

  const loadCustomerData = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, sumRes, ordRes, timeRes] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/summary`),
        api.get(`/customers/${id}/orders`),
        api.get(`/customers/${id}/timeline`)
      ]);

      setCustomer(custRes.data);
      setSummary(sumRes.data);
      setOrders(ordRes.data || []);
      setTimeline(timeRes.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        navigate('/dashboard', {
          replace: true,
          state: { deniedMessage: "You don't have access to this customer's profile" }
        });
      } else {
        notify.error(err.response?.data?.message || 'Error loading customer 360° profile');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate, notify]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Handle Note Submit for Timeline
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    try {
      setIsPostingNote(true);
      await api.post('/activities', {
        relatedType: 'customer',
        relatedId: id,
        type: 'note',
        description: newNoteInput
      });
      setNewNoteInput('');
      notify.success('Note added to customer timeline');
      loadCustomerData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to add note');
    } finally {
      setIsPostingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-semibold">Loading Customer 360° Profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const isHighValue = summary?.totalSpent > 50000;

  return (
    <div className="space-y-6 pb-12">
      {/* Soft-Deleted Customer Warning Banner */}
      {customer?.isDeleted && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl flex items-center gap-3 shadow-xs">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Deleted Customer Record:</span> This customer was soft-deleted. Historical order details are retained.
          </div>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="space-y-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Customer Directory</span>
        </Link>

        {/* Customer Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md">
              {getInitials(customer.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h1>
                {isHighValue && (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black rounded-md uppercase">
                    ⭐ High Value VIP
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{customer.company || 'Individual Account'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Spent</span>
              <span className="text-lg font-black text-slate-900">₹{(summary?.totalSpent || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Reorder Prob.</span>
              <span className="text-lg font-black text-emerald-600">{customer.reorderProbability || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition ${
            activeTab === 'overview' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview 360°
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition ${
            activeTab === 'timeline' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Timeline & Notes ({timeline.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition ${
            activeTab === 'orders' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Order History ({orders.length})
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Account Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">Account Details</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={14} className="text-slate-400" />
                <span className="font-semibold">{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={14} className="text-slate-400" />
                <span>{customer.email || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                <span>{customer.address || customer.city || 'Address N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 pt-2 border-t border-slate-100">
                <Building2 size={14} className="text-slate-400" />
                <span>Executive: <strong className="text-slate-800">{customer.salesExecutive?.name || 'Unassigned'}</strong></span>
              </div>
            </div>
          </div>

          {/* Purchasing Insights */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">Purchasing Insights</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Total Orders:</span>
                <span className="font-bold text-slate-900">{summary?.totalOrders || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Average Order Value:</span>
                <span className="font-bold text-slate-900">₹{(summary?.averageOrderValue || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Expected Reorder:</span>
                <span className="font-bold text-red-600">
                  {customer.expectedReorderDate ? new Date(customer.expectedReorderDate).toLocaleDateString('en-IN') : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('timeline')}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition text-left flex items-center justify-between"
              >
                <span>Add Quick Note to Timeline</span>
                <ArrowLeft size={14} className="rotate-180" />
              </button>
              <Link
                to="/orders"
                className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition text-left flex items-center justify-between block"
              >
                <span>Create New Order</span>
                <ShoppingBag size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <form onSubmit={handleNoteSubmit} className="space-y-3">
            <textarea
              rows={3}
              value={newNoteInput}
              onChange={(e) => setNewNoteInput(e.target.value)}
              placeholder="Post a note to customer timeline..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPostingNote || !newNoteInput.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {isPostingNote ? 'Posting...' : 'Post Timeline Note'}
              </button>
            </div>
          </form>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm">Timeline Stream</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No timeline entries found.</p>
            ) : (
              timeline.map((act) => (
                <div key={act._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-slate-800">{act.createdBy?.name || 'System'}</span>
                    <span className="text-slate-400">{getRelativeTime(act.createdAt)}</span>
                  </div>
                  <p className="text-slate-700">{act.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-extrabold text-[11px]">
                <th className="p-4">Order No</th>
                <th className="p-4">Order Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">No orders placed by this customer yet.</td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-900">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</td>
                    <td className="p-4">{new Date(ord.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-4 font-black">₹{(ord.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-md uppercase ${getOrderStatusBadgeClass(ord.status)}`}>
                        {ord.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
