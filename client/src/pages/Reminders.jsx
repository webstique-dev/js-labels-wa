import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Bell,
  Phone,
  MessageCircle,
  Mail,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ArrowUp,
  ArrowDown,
  Hexagon,
  ChevronRight as ChevronRightIcon,
  Plus,
  ShoppingBag,
  User
} from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { initiatePhoneCall, openWhatsApp, openEmail, WhatsAppIcon } from '../utils/contactUtils';
import NewOrderModal from '../components/NewOrderModal';
import {
  getLiveReorderProbability,
  getProbabilityColorClass,
  getProbabilityTextColorClass
} from '../utils/reorderHelper';

export default function Reminders() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { role } = useAuth();

  const [activeFilterTab, setActiveFilterTab] = useState('all');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Order Modal State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderCustomer, setSelectedOrderCustomer] = useState(null);

  // Calendar Filter State
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const [remRes, sumRes] = await Promise.all([
        api.get('/reminders'),
        api.get('/reminders/summary')
      ]);
      setReminders(Array.isArray(remRes.data) ? remRes.data : []);
      setSummary(sumRes.data || null);
    } catch (err) {
      console.error('Error fetching reminders from DB:', err);
      notify.error(err.response?.data?.message || 'Failed to load reorder reminders');
      setReminders([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const getInitials = (name) => {
    if (!name) return 'CU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getItemPriority = (item) => {
    const cust = item.customer || {};
    const probScore = getLiveReorderProbability(cust);
    if (probScore >= 80) return 'high';
    if (probScore >= 50) return 'medium';
    return 'low';
  };

  const highCount = reminders.filter(r => getItemPriority(r) === 'high').length;
  const mediumCount = reminders.filter(r => getItemPriority(r) === 'medium').length;
  const lowCount = reminders.filter(r => getItemPriority(r) === 'low').length;

  // Build map of YYYY-MM-DD -> set of priority strings for calendar dots
  const reminderDotsMap = {};
  reminders.forEach((r) => {
    const rawDate = r.customer?.expectedReorderDate || r.expectedReorderDate;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        if (!reminderDotsMap[key]) reminderDotsMap[key] = new Set();
        reminderDotsMap[key].add(getItemPriority(r));
      }
    }
  });

  // Filter reminder cards according to top tab selection & calendar date
  const filteredCards = reminders.filter((item) => {
    const prio = getItemPriority(item);

    // If calendar date is selected, display all reminders for that date regardless of priority view
    if (!selectedCalendarDate) {
      if (activeFilterTab === 'high' && prio !== 'high') return false;
      if (activeFilterTab === 'medium' && prio !== 'medium') return false;
      if (activeFilterTab === 'low' && prio !== 'low') return false;
    }

    if (selectedCalendarDate) {
      const rawDate = item.customer?.expectedReorderDate || item.expectedReorderDate;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const itemKey = `${yyyy}-${mm}-${dd}`;
      if (itemKey !== selectedCalendarDate) return false;
    }

    return true;
  });

  const overdueReminders = reminders.filter((r) => {
    const cust = r.customer || {};
    const expDateStr = cust.expectedReorderDate || r.expectedReorderDate;
    if (!expDateStr) return false;
    const expDate = new Date(expDateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return expDate < todayStart || r.daysUntilReorder < 0;
  });

  const handleWhatsAppClick = async (cust) => {
    if (!cust || !cust.phone) {
      notify.info(`No phone number recorded for ${cust?.name || 'customer'}`);
      return;
    }

    const cleanPhone = cust.phone.toString().replace(/\D/g, '');
    const expDateFormatted = cust.expectedReorderDate
      ? new Date(cust.expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'soon';

    const message = `Hi ${cust.name || 'Customer'}, this is JS Labels. Your label supply is expected to need a reorder around ${expDateFormatted}. Would you like us to prepare your next order? Happy to help whenever you're ready!`;

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    notify.success(`Opening WhatsApp chat for ${cust.name}...`);

    try {
      await api.post('/activities', {
        relatedType: 'customer',
        relatedId: cust._id,
        type: 'whatsapp',
        description: 'WhatsApp reminder opened for reorder'
      });
    } catch (err) {
      console.error('Error logging WhatsApp activity:', err);
    }
  };

  const handleAcknowledge = async (customerId, custName) => {
    try {
      await api.patch(`/reminders/${customerId}/dismiss`);
      notify.success(`Reorder reminder for ${custName} acknowledged`);
      fetchReminders();
    } catch (err) {
      notify.error('Failed to acknowledge reminder');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">

      {/* Top Header & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">

        {/* Left Filter Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveFilterTab('all')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeFilterTab === 'all'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
          >
            All Reminders ({reminders.length})
          </button>

          <button
            onClick={() => setActiveFilterTab('high')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeFilterTab === 'high'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
          >
            High Priority ({highCount})
          </button>

          <button
            onClick={() => setActiveFilterTab('medium')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeFilterTab === 'medium'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
          >
            Medium Priority ({mediumCount})
          </button>

          <button
            onClick={() => setActiveFilterTab('low')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeFilterTab === 'low'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
          >
            Low Priority ({lowCount})
          </button>
        </div>
      </div>

      {/* Main Workspace Layout (12 Columns) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT SECTION: Reminder Cards Stream & Overdue Table (8 / 12 cols) */}
        <div className="xl:col-span-8 space-y-6">

          {/* Reminder Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <Bell size={24} />
              </div>
              <h3 className="font-semibold text-slate-800 text-base">No Reorder Reminders</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
                {activeFilterTab !== 'all'
                  ? `No ${activeFilterTab} priority reorder reminders found.`
                  : 'There are no active reorder reminders in the database.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredCards.map((card) => {
                const cust = card.customer || {};
                const custName = cust.name || 'N/A';
                const company = cust.company || 'Individual Account';
                const initials = getInitials(custName);
                const probScore = getLiveReorderProbability(cust);
                const prio = getItemPriority(card);

                let prioBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                if (prio === 'high') prioBadgeClass = 'bg-rose-50 text-rose-600 border-rose-200';
                if (prio === 'low') prioBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

                const daysText = card.daysUntilReorder < 0
                  ? `${Math.abs(card.daysUntilReorder)} Days Overdue`
                  : card.daysUntilReorder === 0
                    ? 'Reorder Expected Today'
                    : `Expected in ${card.daysUntilReorder} days`;

                const expDateStr = cust.expectedReorderDate
                  ? new Date(cust.expectedReorderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'N/A';

                return (
                  <div key={card._id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">

                    {/* Header: Avatar & Name & Priority Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h4
                            onClick={() => navigate(`/customers/${cust._id}`)}
                            className="font-bold text-slate-900 text-xs truncate hover:text-red-600 cursor-pointer"
                          >
                            {custName}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate font-normal">{company}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase shrink-0 ${prioBadgeClass}`}>
                        {prio}
                      </span>
                    </div>

                    {/* Body Details */}
                    <div className="space-y-2 text-[11px] pt-1">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                        <span>Expected Date: {expDateStr}</span>
                      </div>

                      <p className={`font-semibold ${card.daysUntilReorder < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {daysText}
                      </p>

                      {/* Reorder Probability Progress Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Reorder Probability</span>
                          <span className={getProbabilityTextColorClass(probScore)}>{probScore}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getProbabilityColorClass(probScore)}`}
                            style={{ width: `${Math.min(100, Math.max(0, probScore))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Action Icon Buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={cust.phone ? `tel:+91${cust.phone.toString().replace(/\D/g, '')}` : '#'}
                          onClick={(e) => {
                            if (!cust.phone) {
                              e.preventDefault();
                              notify.info(`No phone number recorded for ${custName}`);
                            } else {
                              notify.success(`Initiating call to ${custName}...`);
                            }
                          }}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          title="Call Customer"
                        >
                          <Phone size={13} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleWhatsAppClick(cust)}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          title="Send WhatsApp"
                        >
                          <WhatsAppIcon size={13} className="text-slate-500 hover:text-emerald-600" />
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveDropdownId(activeDropdownId === card._id ? null : card._id)}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {activeDropdownId === card._id && (
                          <div className="absolute right-0 bottom-8 w-44 bg-white rounded-2xl border border-slate-200 shadow-xl p-1 z-30 text-xs font-medium space-y-0.5">
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownId(null); navigate(`/customers/${cust._id}`); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                            >
                              <User size={13} className="text-slate-400" />
                              <span>View Customer 360</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdownId(null);
                                setSelectedOrderCustomer(cust);
                                setShowNewOrderModal(true);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                            >
                              <ShoppingBag size={13} className="text-slate-400" />
                              <span>Create Order</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownId(null); handleAcknowledge(cust._id, custName); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 cursor-pointer text-emerald-700"
                            >
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>Dismiss / Handled</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Overdue Reminders Table Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-red-600 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                <span>Overdue Reminders ({overdueReminders.length})</span>
              </h3>
            </div>

            {overdueReminders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 font-normal">
                No overdue reorder reminders at this time.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <th className="p-3">Customer</th>
                      <th className="p-3">Days Overdue</th>
                      <th className="p-3">Expected Reorder Date</th>
                      <th className="p-3">Sales Executive</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overdueReminders.map((row) => {
                      const cust = row.customer || {};
                      const custName = cust.name || 'N/A';
                      const company = cust.company || 'Individual Account';
                      const initials = getInitials(custName);
                      const daysOver = Math.abs(row.daysUntilReorder);
                      const expDateStr = cust.expectedReorderDate
                        ? new Date(cust.expectedReorderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A';
                      const execName = cust.salesExecutive?.name || 'Unassigned';

                      return (
                        <tr key={row._id} className="hover:bg-slate-50/80 transition">

                          {/* Customer */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p
                                  onClick={() => navigate(`/customers/${cust._id}`)}
                                  className="font-bold text-slate-900 leading-tight hover:text-red-600 cursor-pointer"
                                >
                                  {custName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-normal">{company}</p>
                              </div>
                            </div>
                          </td>

                          {/* Days Overdue */}
                          <td className="p-3 font-bold text-red-600">{daysOver} Days</td>

                          {/* Expected Reorder Date */}
                          <td className="p-3 font-medium text-slate-800">{expDateStr}</td>

                          {/* Sales Executive */}
                          <td className="p-3 font-semibold text-slate-700">
                            {execName}
                          </td>

                          {/* Action Icon Buttons */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <a
                                href={cust.phone ? `tel:+91${cust.phone.toString().replace(/\D/g, '')}` : '#'}
                                onClick={(e) => {
                                  if (!cust.phone) {
                                    e.preventDefault();
                                    notify.info(`No phone number recorded for ${custName}`);
                                  } else {
                                    notify.success(`Initiating call to ${custName}...`);
                                  }
                                }}
                                className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                title="Call Customer"
                              >
                                <Phone size={12} />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppClick(cust)}
                                className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                title="Send WhatsApp"
                              >
                                <WhatsAppIcon size={12} className="text-slate-500 hover:text-emerald-600" />
                              </button>
                            </div>
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

        {/* RIGHT SECTION: Summary Cards Widget (4 / 12 cols) */}
        <div className="xl:col-span-4 space-y-5">

          {/* Card 1: Reminder Summary */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Reminder Summary</h3>
              {/* <span className="text-[11px] font-semibold text-slate-500">Live DB Metrics</span> */}
            </div>

            <div className="grid grid-cols-2 gap-3">

              {/* Total Reminders */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Total Reminders</span>
                  <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Bell size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.total ?? 0}</div>
              </div>

              {/* High Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">High Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ArrowUp size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.high ?? 0}</div>
              </div>

              {/* Medium Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Medium Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Hexagon size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.medium ?? 0}</div>
              </div>

              {/* Low Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Low Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ArrowDown size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.low ?? 0}</div>
              </div>

              {/* Completed */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Completed</span>
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.completed ?? 0}</div>
              </div>

              {/* Overdue */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Overdue</span>
                  <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Clock size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">{summary?.overdue ?? 0}</div>
              </div>

            </div>
          </div>

          {/* Card 2: Interactive Calendar Widget (Matching Reference UI) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            {/* Header: Title & Selected Date Filter Badge / Clear */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                <CalendarIcon size={16} className="text-slate-500" />
                <span>Calendar</span>
              </h3>
              {selectedCalendarDate ? (
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(null)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                >
                  Clear Filter
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400">Date Filter</span>
              )}
            </div>

            {/* Month & Year Navigation Header */}
            <div className="flex items-center justify-between px-1 py-1">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-xs font-bold text-slate-900 tracking-tight">
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"
                ][calendarMonth]} {calendarYear}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* 7-Column Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {(() => {
                const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

                const cells = [];
                // Leading empty cells
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<div key={`empty-${i}`} className="h-8" />);
                }

                // Month days
                for (let day = 1; day <= totalDaysInMonth; day++) {
                  const mm = String(calendarMonth + 1).padStart(2, '0');
                  const dd = String(day).padStart(2, '0');
                  const dateKey = `${calendarYear}-${mm}-${dd}`;

                  const isToday =
                    day === new Date().getDate() &&
                    calendarMonth === new Date().getMonth() &&
                    calendarYear === new Date().getFullYear();

                  const isSelected = selectedCalendarDate === dateKey;
                  const prioritiesSet = reminderDotsMap[dateKey];

                  cells.push(
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCalendarDate(null);
                        } else {
                          setSelectedCalendarDate(dateKey);
                          setActiveFilterTab('all');
                        }
                      }}
                      className={`h-8 w-full rounded-xl flex flex-col items-center justify-center relative transition cursor-pointer text-xs font-semibold ${isSelected
                          ? 'bg-indigo-600 text-white shadow-md font-bold'
                          : isToday
                            ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <span>{day}</span>
                      {/* Priority Indicator Dots */}
                      {prioritiesSet && !isSelected && (
                        <div className="flex items-center gap-0.5 absolute bottom-1">
                          {prioritiesSet.has('high') && <span className="w-1 h-1 rounded-full bg-rose-500" />}
                          {prioritiesSet.has('medium') && <span className="w-1 h-1 rounded-full bg-amber-500" />}
                          {prioritiesSet.has('low') && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                        </div>
                      )}
                    </button>
                  );
                }

                return cells;
              })()}
            </div>

            {/* Bottom Legend */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-3 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>High</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Medium</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Low</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* New Order Popup Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          isOpen={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            notify.success('New order created successfully');
            fetchReminders();
          }}
          initialCustomer={selectedOrderCustomer}
        />
      )}
    </div>
  );
}

