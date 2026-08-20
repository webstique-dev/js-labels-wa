import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Users,
  UserCheck,
  Package,
  RefreshCw,
  TrendingUp,
  Clock,
  Calendar,
  Bell,
  ArrowRight,
  ChevronDown,
  FileText,
  CheckCircle2,
  UserPlus,
  AlertTriangle,
  X,
  ArrowUp
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

/**
 * Responsive Skeleton Loader for Dashboard matching exact 3-row layout
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header Banner Skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 md:w-64" />
          <Skeleton className="h-4 w-80 md:w-96" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Row 1: Top 4 KPI Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-8 w-24 mt-2" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>

      {/* Row 2: 3 Middle Widgets Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
        {/* Widget 1: Line Chart Skeleton */}
        <div className="xl:col-span-5 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="space-y-1 pt-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>

        {/* Widget 2: Funnel Skeleton */}
        <div className="xl:col-span-4 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="space-y-4 py-2">
            {Array.from({ length: 5 }).map((_, fIdx) => (
              <div key={fIdx} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 flex-1 rounded-lg" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Widget 3: Recent Activities Skeleton */}
        <div className="xl:col-span-3 md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3.5 pt-1">
            {Array.from({ length: 5 }).map((_, aIdx) => (
              <div key={aIdx} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </div>

      {/* Row 3: Bottom 4 KPI Action Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [activities, setActivities] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [needsReview, setNeedsReview] = useState([]);
  const [callers, setCallers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Timefilter pill state (mock selector)
  const [timeFilter, setTimeFilter] = useState('This Month');

  // Reassign Modal State
  const [reassignModalItem, setReassignModalItem] = useState(null);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, funRes, trendRes, actRes, altRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/funnel'),
        api.get('/dashboard/conversion-trend'),
        api.get('/dashboard/activity-feed?limit=5'),
        api.get('/dashboard/alerts')
      ]);

      setSummary(sumRes.data);
      setFunnel(funRes.data);
      setTrendData(trendRes.data || []);
      setActivities(actRes.data || []);
      setAlerts(altRes.data);

      if (role === 'super_admin' || role === 'manager') {
        try {
          const [reviewRes, usersRes] = await Promise.all([
            api.get('/dashboard/needs-review'),
            api.get('/users?role=caller')
          ]);
          setNeedsReview(reviewRes.data || []);
          setCallers(Array.isArray(usersRes.data) ? usersRes.data.filter(u => u.role === 'caller') : []);
        } catch (subErr) {
          console.warn('Non-fatal error fetching manager sub-panels:', subErr);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      notify.error(err.response?.data?.message || 'Error loading dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle Reassign Submit
  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalItem || !selectedCallerId) return;

    const isConfirmed = await confirm({
      title: 'Reassign Escalated Lead',
      message: 'Are you sure you want to reassign this escalated lead to the selected executive?',
      confirmLabel: 'Reassign Lead',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      setIsReassigning(true);
      await api.post(`/escalations/${reassignModalItem._id}/reassign`, {
        reassignedTo: selectedCallerId
      });
      notify.success('Escalated lead reassigned successfully');
      setReassignModalItem(null);
      setSelectedCallerId('');
      fetchDashboardData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reassign lead');
    } finally {
      setIsReassigning(false);
    }
  };

  // Format currency for Reorder Forecast
  const formatReorderAmount = (amount) => {
    if (!amount) return '₹ 0';
    if (amount >= 100000) {
      return `₹ ${(amount / 100000).toFixed(1)} Lakhs`;
    }
    return `₹ ${amount.toLocaleString('en-IN')}`;
  };

  // Sample or API Activity Icons helper
  const getActivityIcon = (act, index) => {
    const desc = (act.description || '').toLowerCase();
    if (desc.includes('order') || desc.includes('delivered')) {
      return { icon: <Package size={16} />, bg: 'bg-orange-50 text-orange-600 border-orange-100' };
    }
    if (desc.includes('reminder') || desc.includes('follow-up')) {
      return { icon: <Bell size={16} />, bg: 'bg-amber-50 text-amber-600 border-amber-100' };
    }
    if (desc.includes('completed') || desc.includes('won')) {
      return { icon: <CheckCircle2 size={16} />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }
    if (desc.includes('quotation') || desc.includes('sent')) {
      return { icon: <FileText size={16} />, bg: 'bg-purple-50 text-purple-600 border-purple-100' };
    }
    const colors = [
      'bg-indigo-50 text-indigo-600 border-indigo-100',
      'bg-orange-50 text-orange-600 border-orange-100',
      'bg-amber-50 text-amber-600 border-amber-100',
      'bg-emerald-50 text-emerald-600 border-emerald-100',
      'bg-purple-50 text-purple-600 border-purple-100'
    ];
    return { icon: <Users size={16} />, bg: colors[index % colors.length] };
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Calculate funnel stage values from DB response
  const funnelLeads = funnel?.leads || 0;
  const funnelContacted = funnel?.contacted || 0;
  const funnelFollowUp = funnel?.followUp || 0;
  const funnelOrderReceived = funnel?.orderReceived || 0;
  const funnelWon = funnel?.won || 0;

  // Chart conversion rate display
  const latestConversionRate = trendData.length > 0 ? (trendData[trendData.length - 1].conversionRate || 0) : 0;

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Real-time CRM metrics, conversion performance, and reorder forecasts</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Refresh Data</span>
          </button>

          <Link
            to="/leads"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-2"
          >
            <span>Lead Board</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ROW 1: Top 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* 1. Total Leads */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 hover:border-slate-300 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <span className="text-slate-500 font-semibold text-xs tracking-tight">Total Leads</span>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">
              {(summary?.totalLeads?.count ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>{summary?.totalLeads?.change ?? 0}%</span>
              </span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        {/* 2. Converted Customers */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 hover:border-slate-300 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <span className="text-slate-500 font-semibold text-xs tracking-tight">Converted Customers</span>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">
              {(summary?.convertedCustomers?.count ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>{summary?.convertedCustomers?.change ?? 0}%</span>
              </span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        {/* 3. Orders Delivered */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 hover:border-slate-300 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <span className="text-slate-500 font-semibold text-xs tracking-tight">Orders Delivered</span>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">
              {(summary?.ordersDelivered?.count ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>{summary?.ordersDelivered?.change ?? 0}%</span>
              </span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        {/* 4. Repeat Orders */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 hover:border-slate-300 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw size={20} />
            </div>
            <span className="text-slate-500 font-semibold text-xs tracking-tight">Repeat Orders</span>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">
              {(summary?.repeatOrders?.count ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>{summary?.repeatOrders?.change ?? 0}%</span>
              </span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 2: 3 Main Middle Widgets (Conversion Chart, Sales Funnel, Recent Activities) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
        
        {/* Widget 1: Lead to Customer Conversion Line Chart */}
        <div className="xl:col-span-5 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Lead to Customer Conversion</h3>
            <div className="relative inline-block">
              <button className="px-3 py-1 bg-white border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer">
                <span>{timeFilter}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">{latestConversionRate}%</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>0%</span>
              </span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            {trendData && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="conversionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" ticks={[0, 15, 30, 45, 100]} domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF', padding: '8px 12px' }}
                    itemStyle={{ color: '#4ADE80', fontWeight: '600', fontSize: '12px' }}
                    formatter={(val) => [`${val}%`, 'Conversion Rate']}
                  />
                  <Area
                    type="monotone"
                    dataKey="conversionRate"
                    stroke="#22C55E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#conversionGrad)"
                    dot={{ fill: '#22C55E', r: 4, stroke: '#FFFFFF', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#16A34A', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <TrendingUp size={24} className="text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">No Conversion Trend Data</p>
                <p className="text-[10px] text-slate-400 font-normal">Conversion stats will appear here as leads progress</p>
              </div>
            )}
          </div>
        </div>

        {/* Widget 2: Sales Funnel */}
        <div className="xl:col-span-4 md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Sales Funnel</h3>
            <div className="relative inline-block">
              <button className="px-3 py-1 bg-white border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer">
                <span>{timeFilter}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Visual SVG & Layered Funnel Chart */}
          <div className="space-y-2.5 py-1">
            {/* Stage 1: Leads */}
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="w-24 font-semibold text-slate-600 truncate">Leads</span>
              <div className="flex-1 flex justify-center">
                <div className="h-7 bg-[#E0E7FF] rounded-md w-full max-w-[220px] flex items-center justify-center transition-all duration-300 hover:brightness-95">
                </div>
              </div>
              <span className="w-14 text-right font-bold text-slate-900">{funnelLeads.toLocaleString('en-IN')}</span>
            </div>

            {/* Stage 2: Contacted */}
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="w-24 font-semibold text-slate-600 truncate">Contacted</span>
              <div className="flex-1 flex justify-center">
                <div className="h-7 bg-[#DBEAFE] rounded-md w-[80%] max-w-[176px] flex items-center justify-center transition-all duration-300 hover:brightness-95">
                </div>
              </div>
              <span className="w-14 text-right font-bold text-slate-900">{funnelContacted.toLocaleString('en-IN')}</span>
            </div>

            {/* Stage 3: Follow Up */}
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="w-24 font-semibold text-slate-600 truncate">Follow Up</span>
              <div className="flex-1 flex justify-center">
                <div className="h-7 bg-[#D1FAE5] rounded-md w-[60%] max-w-[132px] flex items-center justify-center transition-all duration-300 hover:brightness-95">
                </div>
              </div>
              <span className="w-14 text-right font-bold text-slate-900">{funnelFollowUp.toLocaleString('en-IN')}</span>
            </div>

            {/* Stage 4: Order Received */}
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="w-24 font-semibold text-slate-600 truncate">Order Received</span>
              <div className="flex-1 flex justify-center">
                <div className="h-7 bg-[#FFEDD5] rounded-md w-[40%] max-w-[88px] flex items-center justify-center transition-all duration-300 hover:brightness-95">
                </div>
              </div>
              <span className="w-14 text-right font-bold text-slate-900">{funnelOrderReceived.toLocaleString('en-IN')}</span>
            </div>

            {/* Stage 5: Won */}
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="w-24 font-semibold text-slate-600 truncate">Won</span>
              <div className="flex-1 flex justify-center">
                <div className="h-7 bg-[#FCA5A5] rounded-b-lg w-[22%] max-w-[48px] flex items-center justify-center transition-all duration-300 hover:brightness-95">
                </div>
              </div>
              <span className="w-14 text-right font-bold text-slate-900">{funnelWon.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link to="/leads" className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              <span>View Full Pipeline</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Widget 3: Recent Activities */}
        <div className="xl:col-span-3 md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Recent Activities</h3>
            <Link to="/leads" className="text-xs font-semibold text-blue-600 hover:underline">View All</Link>
          </div>

          <div className="space-y-3 overflow-hidden">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((act, idx) => {
                const iconInfo = getActivityIcon(act, idx);
                return (
                  <div key={act._id || idx} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${iconInfo.bg} flex items-center justify-center shrink-0 border`}>
                        {iconInfo.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate leading-tight">{act.description}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                          {act.createdBy?.name || 'System User'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-normal">
                No recent activity records found.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/leads')}
            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 text-slate-700 font-semibold text-xs rounded-xl transition text-center shadow-2xs cursor-pointer"
          >
            View All Activities
          </button>
        </div>

      </div>

      {/* ROW 3: Bottom 4 KPI Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* 1. Overdue Follow-ups */}
        <Link
          to="/followups?status=overdue"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-rose-300 transition group"
        >
          <div>
            <span className="text-slate-600 font-semibold text-xs">Overdue Follow-ups</span>
            <div className="text-3xl font-bold text-red-600 tracking-tight mt-2">
              {alerts?.overdueFollowups ?? 0}
            </div>
            <span className="text-red-600 font-semibold text-xs mt-1 block">Requires Action</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100">
            <Clock size={22} />
          </div>
        </Link>

        {/* 2. Due Today */}
        <Link
          to="/followups?status=open"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-blue-300 transition group"
        >
          <div>
            <span className="text-slate-600 font-semibold text-xs">Due Today</span>
            <div className="text-3xl font-bold text-slate-900 tracking-tight mt-2">
              {alerts?.dueToday ?? 0}
            </div>
            <span className="text-blue-600 font-semibold text-xs mt-1 block">Follow-ups</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Calendar size={22} />
          </div>
        </Link>

        {/* 3. Upcoming Reminders */}
        <Link
          to="/reminders"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-indigo-300 transition group"
        >
          <div>
            <span className="text-slate-600 font-semibold text-xs">Upcoming Reminders</span>
            <div className="text-3xl font-bold text-slate-900 tracking-tight mt-2">
              {alerts?.upcomingReminders ?? 0}
            </div>
            <span className="text-indigo-600 font-semibold text-xs mt-1 block">This Week</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Bell size={22} />
          </div>
        </Link>

        {/* 4. Reorder Forecast */}
        <Link
          to="/customers"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition group"
        >
          <div>
            <span className="text-slate-600 font-semibold text-xs">Reorder Forecast</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-2">
              {formatReorderAmount(alerts?.reorderForecast)}
            </div>
            <span className="text-blue-600 font-semibold text-xs mt-1 block">Next 30 Days</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <TrendingUp size={22} />
          </div>
        </Link>

      </div>

      {/* Super Admin / Manager Needs MD Review Escalation Panel */}
      {isManagerOrAdmin && needsReview.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle size={18} />
              <h3 className="font-semibold text-sm">Escalations Pending MD Review</h3>
            </div>
            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-xs font-semibold">
              {needsReview.length} Urgent
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
            {needsReview.map((item) => (
              <div key={item._id} className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl space-y-2 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-xs">
                    {item.relatedType === 'lead' ? item.relatedRecord?.name : item.relatedRecord?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    {item.relatedType === 'lead' ? item.relatedRecord?.company : 'Customer Reorder'} • Overdue: {item.hoursOverdue}h
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReassignModalItem(item);
                    setSelectedCallerId(item.assignedTo?._id || '');
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition shrink-0 cursor-pointer"
                >
                  Reassign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reassign Executive Modal */}
      {reassignModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Reassign Escalated Account</h3>
              <button
                onClick={() => setReassignModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                <p className="font-medium text-slate-800">
                  Target: {reassignModalItem.relatedRecord?.name || 'Account'} ({reassignModalItem.relatedType})
                </p>
                <p className="text-slate-500">Currently assigned to: {reassignModalItem.assignedTo?.name || 'Unassigned'}</p>
                <p className="text-rose-600 font-semibold">Overdue Duration: {reassignModalItem.hoursOverdue} Hours</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Executive Caller</label>
                <select
                  required
                  value={selectedCallerId}
                  onChange={(e) => setSelectedCallerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                >
                  <option value="">Select an active caller...</option>
                  {callers.map((caller) => (
                    <option key={caller._id} value={caller._id}>
                      {caller.name} ({caller.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignModalItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning || !selectedCallerId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isReassigning ? 'Reassigning...' : 'Confirm Reassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

