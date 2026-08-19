import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  ArrowLeft,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  Clock,
  TrendingUp,
  Award,
  Edit2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';

export default function CustomerDetails() {
  const { id } = useParams();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomer360 = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers/${id}`);
      const data = res.data;
      setCustomer(data.customer);
      setOrders(data.orders || []);
      setSummary(data.summary || null);

      if (data.customer) {
        setFormData({
          name: data.customer.name || '',
          company: data.customer.company || '',
          phone: data.customer.phone || '',
          email: data.customer.email || '',
          address: data.customer.address || '',
          city: data.customer.city || '',
          state: data.customer.state || '',
          pincode: data.customer.pincode || '',
          notes: data.customer.notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching customer 360:', err);
      notify.error(err.response?.data?.message || 'Failed to load customer profile');
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

  const getOrderStatusBadgeClass = (statusStr) => {
    switch (statusStr) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'dispatched':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'production':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return 'JS';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-medium">Loading Customer 360 Profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Customer Not Found</h3>
        <p className="text-xs text-slate-500 font-normal">The requested customer account does not exist or was deleted.</p>
        <Link to="/customers" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium">
          Back to Directory
        </Link>
      </div>
    );
  }

  const isHighValue = (summary?.totalSpent || 0) > 100000;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Controls */}
      <div className="space-y-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Customer Directory</span>
        </Link>

        {/* Customer Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xl shadow-md">
              {getInitials(customer.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{customer.name}</h1>
                {isHighValue && (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-medium rounded-md uppercase">
                    ⭐ High Value VIP
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{customer.company || 'Individual Account'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-medium uppercase text-slate-400 block">Total Spent</span>
              <span className="text-lg font-semibold text-slate-900">₹{(summary?.totalSpent || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-medium uppercase text-slate-400 block">Reorder Prob.</span>
              <span className="text-lg font-semibold text-emerald-600">{customer.reorderProbability || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-red-600 text-red-600 bg-red-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          360° Overview
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition ${
            activeTab === 'orders'
              ? 'border-red-600 text-red-600 bg-red-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Orders History ({orders.length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Account Details Form / View */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Account & Contact Profile</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition inline-flex items-center gap-1.5"
                >
                  <Edit2 size={14} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={16} className="text-slate-400" />
                    <span>{customer.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={16} className="text-slate-400" />
                    <span>{customer.email || 'No email'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin size={16} className="text-slate-400 mt-0.5" />
                    <span>
                      {customer.address ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.pincode || ''}` : 'No address specified'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase block">Assigned Tele-Caller</span>
                    <span className="font-semibold text-slate-900">{customer.salesExecutive?.name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase block">Expected Reorder Date</span>
                    <span className="font-semibold text-slate-900">
                      {customer.expectedReorderDate ? new Date(customer.expectedReorderDate).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Reorder Intelligence Metrics */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">Reorder Intelligence</h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-medium uppercase block">Total Orders Delivered</span>
                  <span className="text-base font-semibold text-slate-900">{summary?.totalOrders || 0} Orders</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-medium uppercase block">Average Order Value</span>
                  <span className="text-base font-semibold text-slate-900">₹{(summary?.avgOrderValue || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Orders History Table */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <th className="p-4">Order No</th>
                <th className="p-4">Order Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-normal">No orders placed by this customer yet.</td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-semibold text-slate-900">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</td>
                    <td className="p-4 font-normal">{new Date(ord.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-4 font-semibold">₹{(ord.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getOrderStatusBadgeClass(ord.status)}`}>
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
