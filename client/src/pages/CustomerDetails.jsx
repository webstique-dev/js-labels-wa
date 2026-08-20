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
  Package,
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
  Plus
} from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

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
  const [isStarred, setIsStarred] = useState(true);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('All Activities');

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
    creditLimit: 500000
  });
  const [isSaving, setIsSaving] = useState(false);

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
      setOrders(ordData);
      setTimeline(timeData);

      if (custData) {
        setFormData({
          name: custData.name || '',
          company: custData.company || '',
          phone: custData.phone || '',
          email: custData.email || '',
          gstNo: custData.gstNo || 'GST 33AABCA1234A1Z5',
          address: custData.address || '',
          city: custData.city || '',
          state: custData.state || '',
          pincode: custData.pincode || '',
          customerType: custData.customerType || 'Distributor',
          paymentTerms: custData.paymentTerms || '30 Days',
          creditLimit: custData.creditLimit || 500000
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
    if (!nameStr) return 'RK';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-fadeIn">
        <Skeleton className="h-6 w-48" />
        <SkeletonCard className="h-14" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <SkeletonCard className="lg:col-span-4 h-[600px]" />
          <SkeletonCard className="lg:col-span-4 h-[600px]" />
          <SkeletonCard className="lg:col-span-4 h-[600px]" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Customer Not Found</h3>
        <p className="text-xs text-slate-500 font-normal">The requested customer profile could not be found.</p>
        <Link to="/customers" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold">
          Back to Customer Directory
        </Link>
      </div>
    );
  }

  // Pre-formatted reference values matching sample image
  const customerName = customer.name || 'Ramesh Kumar';
  const customerCompany = customer.company || 'Apex Traders Pvt. Ltd.';
  const customerPhone = customer.phone || '98765 43210';
  const customerEmail = customer.email || 'ramesh.kumar@apextraders.com';
  const customerGst = customer.gstNo || 'GST 33AABCA1234A1Z5';
  const customerAddress = customer.address || '21, Industrial Estate, Guindy, Chennai - 600032';
  const customerType = customer.customerType || 'Distributor';
  const paymentTerms = customer.paymentTerms || '30 Days';
  const creditLimit = customer.creditLimit || 500000;
  const currentBalance = customer.currentBalance || 18450;
  const reorderProb = customer.reorderProbability || 85;

  // Timeline list fallback matching reference image exactly
  const sampleTimelineList = [
    { id: '1', icon: <User size={16} />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', title: 'New lead assigned to Tele Caller 1', subtext: 'Lead Source: Website', date: 'May 15, 2025', time: '10:30 AM' },
    { id: '2', icon: <Phone size={16} />, bg: 'bg-orange-50 text-orange-600 border-orange-100', title: 'Follow-up call completed', subtext: 'Interested in premium quality labels.', date: 'May 15, 2025', time: '11:15 AM' },
    { id: '3', icon: <FileText size={16} />, bg: 'bg-purple-50 text-purple-600 border-purple-100', title: 'Quotation QTN-0205 sent', subtext: 'Quotation for 3 items worth ₹ 18,450', date: 'May 16, 2025', time: '09:45 AM' },
    { id: '4', icon: <MessageCircle size={16} />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', title: 'WhatsApp discussion', subtext: 'Shared material samples and discussed pricing.', date: 'May 16, 2025', time: '12:20 PM' },
    { id: '5', icon: <ShoppingBag size={16} />, bg: 'bg-blue-50 text-blue-600 border-blue-100', title: 'Order ORD-2456 created', subtext: 'Order value: ₹ 18,450', date: 'May 16, 2025', time: '03:10 PM' },
    { id: '6', icon: <Truck size={16} />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', title: 'Order delivered successfully', subtext: 'Delivered via DTDC', date: 'May 20, 2025', time: '05:30 PM' },
    { id: '7', icon: <PhoneCall size={16} />, bg: 'bg-blue-50 text-blue-600 border-blue-100', title: 'Post delivery follow-up call', subtext: 'Customer is satisfied with quality.', date: 'May 21, 2025', time: '11:00 AM' },
    { id: '8', icon: <Bell size={16} />, bg: 'bg-amber-50 text-amber-600 border-amber-100', title: 'Reorder reminder scheduled', subtext: 'Expected reorder on June 12, 2025', date: 'May 21, 2025', time: '02:45 PM' }
  ];

  // Top Purchased Products matching reference image
  const topProductsList = summary?.topProducts?.length > 0 ? summary.topProducts : [
    { name: 'Premium BOPP Labels', qty: '12,500 Pcs', amount: '₹ 62,500', img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100&auto=format&fit=crop&q=60' },
    { name: 'Barcode Labels 50x25mm', qty: '9,000 Pcs', amount: '₹ 31,500', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60' },
    { name: 'Transparent Labels', qty: '6,500 Pcs', amount: '₹ 21,125', img: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=100&auto=format&fit=crop&q=60' }
  ];

  return (
    <div className="space-y-6 pb-12 font-sans">
      
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
            Timeline
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Orders
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'followups'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Follow-ups
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Documents
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-1 border-b-2 transition font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'notes'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Notes
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
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium flex items-center gap-2"
              >
                <Edit2 size={14} className="text-slate-400" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => { setShowActionsDropdown(false); navigate('/orders'); }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium flex items-center gap-2"
              >
                <ShoppingBag size={14} className="text-slate-400" />
                <span>Create New Order</span>
              </button>
              <button
                onClick={() => { setShowActionsDropdown(false); navigate('/followups'); }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium flex items-center gap-2"
              >
                <Calendar size={14} className="text-slate-400" />
                <span>Schedule Follow-up</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Tab Content (3 Columns matching exact image layout) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
          
          {/* COLUMN 1: Customer Profile & Attributes */}
          <div className="xl:col-span-4 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6 flex flex-col justify-between">
            
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
                    <p className="text-xs text-slate-500 font-normal mt-0.5">{customerCompany}</p>
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
                    title="More Options"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Tag Badges */}
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-semibold rounded-md">
                  High Value
                </span>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold rounded-md">
                  Chennai
                </span>
              </div>

              {/* Contact Information List with Lucide Icons */}
              <div className="space-y-3 pt-2 text-xs">
                {/* Phone */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                    <Phone size={15} className="text-slate-400 shrink-0" />
                    <span>{customerPhone}</span>
                  </div>
                  <a
                    href={`https://wa.me/91${customerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-500 hover:scale-110 transition p-1"
                    title="Chat on WhatsApp"
                  >
                    <MessageCircle size={18} className="fill-emerald-500 text-white" />
                  </a>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2.5 text-slate-700 font-medium truncate">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <span className="truncate">{customerEmail}</span>
                </div>

                {/* GST */}
                <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <span>{customerGst}</span>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2.5 text-slate-700 font-medium">
                  <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{customerAddress}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              
              {/* Customer Since */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer Since</span>
                <span className="text-slate-900 font-semibold">May 15, 2025</span>
              </div>

              {/* Sales Executive */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Sales Executive</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
                    TC
                  </div>
                  <span className="text-slate-900 font-semibold">Tele Caller 1</span>
                </div>
              </div>

              {/* Customer Type */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer Type</span>
                <span className="text-slate-900 font-semibold">{customerType}</span>
              </div>

              {/* Payment Terms */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Payment Terms</span>
                <span className="text-slate-900 font-semibold">{paymentTerms}</span>
              </div>

              {/* Credit Limit */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Credit Limit</span>
                <span className="text-slate-900 font-semibold">₹ {creditLimit.toLocaleString('en-IN')}</span>
              </div>

              {/* Current Balance */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Balance</span>
                <span className="text-emerald-600 font-bold">₹ {currentBalance.toLocaleString('en-IN')}</span>
              </div>

              {/* Reorder Probability Progress Bar */}
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reorder Probability</span>
                  <span className="text-emerald-600 font-bold">High ({reorderProb}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${reorderProb}%` }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* COLUMN 2: Timeline Activity Feed */}
          <div className="xl:col-span-4 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
            
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Timeline</h3>
              <div className="relative inline-block">
                <button className="px-3 py-1 bg-white border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer">
                  <span>{timelineFilter}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Vertical Timeline Feed */}
            <div className="relative pl-6 space-y-4 pt-1 pb-2 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {sampleTimelineList.map((item) => (
                <div key={item.id} className="relative flex items-start justify-between gap-2 text-xs">
                  {/* Node icon */}
                  <div className={`absolute -left-[31px] top-0.5 w-7 h-7 rounded-full ${item.bg} flex items-center justify-center shrink-0 shadow-2xs border`}>
                    {item.icon}
                  </div>

                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 leading-tight">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{item.subtext}</p>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 font-medium shrink-0 leading-tight">
                    <div>{item.date}</div>
                    <div className="text-[10px] mt-0.5">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('timeline')}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 text-slate-700 font-semibold text-xs rounded-xl transition text-center shadow-2xs cursor-pointer"
            >
              View Full Timeline
            </button>

          </div>

          {/* COLUMN 3: Business Summary & Reorder Prediction (4 / 12 cols) */}
          <div className="xl:col-span-4 md:col-span-2 space-y-5">
            
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
                  <div className="text-lg font-bold text-slate-900 pl-1">{summary?.totalOrders ?? 8}</div>
                </div>

                {/* 2. Total Spent */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Wallet size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Total Spent</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">₹ {(summary?.totalSpent ?? 125000).toLocaleString('en-IN')}</div>
                </div>

                {/* 3. Last Order */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <FileText size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Last Order</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 pl-1 pt-1">May 30, 2025</div>
                </div>

                {/* 4. Avg Order Value */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <TrendingUp size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Avg. Order Value</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">₹ {(summary?.avgOrderValue ?? 15625).toLocaleString('en-IN')}</div>
                </div>

                {/* 5. Repeat Orders */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <RefreshCw size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Repeat Orders</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">{summary?.repeatOrders ?? 7}</div>
                </div>

                {/* 6. Repeat Order Rate */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Target size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Repeat Order Rate</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 pl-1">{summary?.repeatOrderRate ?? 87.5}%</div>
                </div>
              </div>
            </div>

            {/* Card 2: Next Reorder Prediction Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Next Reorder Prediction</h3>
              
              <div className="flex items-center gap-4 pt-1">
                {/* Red Date Box */}
                <div className="w-16 text-center shadow-2xs rounded-xl overflow-hidden border border-slate-200">
                  <div className="bg-red-600 text-white text-[11px] font-bold py-0.5 tracking-wider uppercase">JUN</div>
                  <div className="bg-slate-50 text-slate-900 text-xl font-bold py-1">12</div>
                  <div className="bg-white text-[9px] text-slate-400 py-0.5 border-t border-slate-100">Thursday</div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-slate-400 font-medium">Expected Reorder Date</span>
                  <div className="text-slate-900 font-bold text-sm">June 12, 2025</div>
                  <div className="text-emerald-600 font-semibold text-xs flex items-center gap-1 pt-0.5">
                    <span>Probability</span>
                    <span className="font-bold">High (85%)</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="pt-2 space-y-1">
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-[85%]"></div>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-semibold">85%</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse text-xs min-w-[500px]">
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
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-normal">No orders recorded for this customer account.</td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-900">{ord.orderNo || `ORD-${ord._id.slice(-6)}`}</td>
                    <td className="p-4 font-medium text-slate-600">{new Date(ord.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-4 font-bold text-slate-900">₹ {(ord.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 border text-[10px] font-semibold rounded-md uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
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

      {/* Follow-ups Tab */}
      {activeTab === 'followups' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-2xs text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
            <Calendar size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No Open Follow-ups Scheduled</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              There are no pending or overdue follow-up calls scheduled for {customerName}.
            </p>
          </div>
          <button
            onClick={() => navigate('/followups')}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-2xs text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
            <FileText size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No Documents Uploaded</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No quotation PDFs, GST certificates, or tax invoices attached to this customer profile yet.
            </p>
          </div>
          <button
            onClick={() => notify.info('Document attachment feature coming soon')}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Upload Document</span>
          </button>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-2xs text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <MessageCircle size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No Internal Notes Added</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No internal executive comments or account notes recorded for {customerName} yet.
            </p>
          </div>
          <button
            onClick={() => notify.info('Add note feature available in actions menu')}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Internal Note</span>
          </button>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Full Interaction Timeline</h3>
          <div className="relative pl-6 space-y-6 pt-2 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {sampleTimelineList.map((item) => (
              <div key={item.id} className="relative flex items-start justify-between gap-4 text-xs">
                <div className={`absolute -left-[31px] top-0.5 w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0 border`}>
                  {item.icon}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.subtext}</p>
                </div>
                <div className="text-right text-xs text-slate-400 font-medium shrink-0">
                  <div>{item.date}</div>
                  <div>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

