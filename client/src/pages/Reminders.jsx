import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Plus
} from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

// Sample fallback dataset matching reference screenshot 1:1
const REMINDER_CARDS = [
  {
    id: '1',
    initials: 'RK',
    initialsBg: 'bg-rose-100 text-rose-600',
    name: 'Ramesh Kumar',
    company: 'Apex Traders Pvt. Ltd.',
    priority: 'High',
    priorityBg: 'bg-rose-50 text-rose-600 border-rose-100',
    cycleText: '30 Days Completed',
    reorderText: 'Likely to reorder in 12 days',
    probability: '85%',
    nextActionTitle: 'Follow-up Call',
    nextActionTime: 'Today 10:00 AM',
    nextActionColor: 'text-rose-600',
    phone: '9876543210',
    email: 'ramesh.kumar@apextraders.com'
  },
  {
    id: '2',
    initials: 'SP',
    initialsBg: 'bg-amber-100 text-amber-700',
    name: 'Suresh Patel',
    company: 'Shree Enterprises',
    priority: 'High',
    priorityBg: 'bg-rose-50 text-rose-600 border-rose-100',
    cycleText: '25 Days Completed',
    reorderText: 'Likely to reorder in 15 days',
    probability: '78%',
    nextActionTitle: 'Send WhatsApp',
    nextActionTime: 'Today 11:30 AM',
    nextActionColor: 'text-amber-600',
    phone: '9876543211',
    email: 'suresh@shreeent.com'
  },
  {
    id: '3',
    initials: 'PV',
    initialsBg: 'bg-rose-100 text-rose-600',
    name: 'Pooja Verma',
    company: 'Verma Industries',
    priority: 'High',
    priorityBg: 'bg-rose-50 text-rose-600 border-rose-100',
    cycleText: '45 Days Completed',
    reorderText: 'Very high reorder probability',
    probability: '92%',
    nextActionTitle: 'Call & Share Catalogue',
    nextActionTime: 'Tomorrow 09:00 AM',
    nextActionColor: 'text-rose-600',
    phone: '9876543212',
    email: 'pooja@vermaind.com'
  },
  {
    id: '4',
    initials: 'AS',
    initialsBg: 'bg-amber-100 text-amber-700',
    name: 'Anita Sharma',
    company: 'Sharma Packaging',
    priority: 'Medium',
    priorityBg: 'bg-amber-50 text-amber-700 border-amber-100',
    cycleText: '18 Days Completed',
    reorderText: 'Likely to reorder in 27 days',
    probability: '62%',
    nextActionTitle: 'Follow-up Call',
    nextActionTime: 'May 24, 2025 02:00 PM',
    nextActionColor: 'text-amber-600',
    phone: '9876543213',
    email: 'anita@sharmapackaging.com'
  },
  {
    id: '5',
    initials: 'VS',
    initialsBg: 'bg-blue-100 text-blue-700',
    name: 'Vikram Singh',
    company: 'Precision Prints',
    priority: 'Medium',
    priorityBg: 'bg-amber-50 text-amber-700 border-amber-100',
    cycleText: '15 Days Completed',
    reorderText: 'Likely to reorder in 20 days',
    probability: '58%',
    nextActionTitle: 'Send Quotation',
    nextActionTime: 'May 24, 2025 04:00 PM',
    nextActionColor: 'text-blue-600',
    phone: '9876543214',
    email: 'vikram@precisionprints.com'
  },
  {
    id: '6',
    initials: 'KM',
    initialsBg: 'bg-emerald-100 text-emerald-700',
    name: 'Karan Mehta',
    company: 'Mehta Labels',
    priority: 'Low',
    priorityBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cycleText: '5 Days Completed',
    reorderText: 'Keep in nurture',
    probability: '30%',
    nextActionTitle: 'Send Promotional Offer',
    nextActionTime: 'May 26, 2025 10:30 AM',
    nextActionColor: 'text-emerald-600',
    phone: '9876543215',
    email: 'karan@mehtalabels.com'
  }
];

const OVERDUE_LIST = [
  {
    id: 'ov_1',
    initials: 'MJ',
    name: 'Meena Joshi',
    company: 'Joshi Traders',
    lastInteraction: 'Apr 10, 2025 (Call)',
    daysOverdue: '6 Days',
    expectedDate: 'May 08, 2025',
    salesRole: 'Tele Caller 2',
    salesName: 'Anita Sharma',
    salesAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
    phone: '9876543216'
  },
  {
    id: 'ov_2',
    initials: 'AC',
    name: 'Arun Chauhan',
    company: 'Chauhan Prints',
    lastInteraction: 'Apr 12, 2025 (WhatsApp)',
    daysOverdue: '5 Days',
    expectedDate: 'May 09, 2025',
    salesRole: 'Tele Caller 3',
    salesName: 'Vikram Singh',
    salesAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60',
    phone: '9876543217'
  },
  {
    id: 'ov_3',
    initials: 'SN',
    name: 'Sonal Naik',
    company: 'Naik Enterprises',
    lastInteraction: 'Apr 15, 2025 (Call)',
    daysOverdue: '2 Days',
    expectedDate: 'May 12, 2025',
    salesRole: 'Tele Caller 1',
    salesName: 'Priya Sharma',
    salesAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60',
    phone: '9876543218'
  },
  {
    id: 'ov_4',
    initials: 'AR',
    name: 'Aditya Rawat',
    company: 'Rawat Labels',
    lastInteraction: 'Apr 17, 2025 (Email)',
    daysOverdue: '1 Day',
    expectedDate: 'May 14, 2025',
    salesRole: 'Tele Caller 2',
    salesName: 'Anita Sharma',
    salesAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
    phone: '9876543219'
  }
];

export default function Reminders() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [activeFilterTab, setActiveFilterTab] = useState('all');
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Filter reminder cards according to top tab selection
  const filteredCards = REMINDER_CARDS.filter((item) => {
    if (activeFilterTab === 'high') return item.priority.toLowerCase() === 'high';
    if (activeFilterTab === 'medium') return item.priority.toLowerCase() === 'medium';
    if (activeFilterTab === 'low') return item.priority.toLowerCase() === 'low';
    return true;
  });

  const handleActionClick = (name, actionType) => {
    notify.success(`Action "${actionType}" initiated for ${name}`);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        
        {/* Left Filter Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveFilterTab('all')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'all'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            All Reminders
          </button>

          <button
            onClick={() => setActiveFilterTab('high')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'high'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            High Priority (12)
          </button>

          <button
            onClick={() => setActiveFilterTab('medium')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'medium'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Medium Priority (18)
          </button>

          <button
            onClick={() => setActiveFilterTab('low')}
            className={`py-2 px-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'low'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Low Priority (9)
          </button>
        </div>

        {/* Right Executive Filter & Filter Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs cursor-pointer">
            <span>All Sales Executives</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          <button className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs cursor-pointer">
            <Filter size={14} className="text-slate-400" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout (12 Columns) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT SECTION: 6 Cards Stream & Overdue Table (8 / 12 cols) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* 6 Reminder Cards Grid (2 rows x 3 cols on desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredCards.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
                
                {/* Header: Avatar, Name, Priority Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-full ${card.initialsBg} font-bold text-xs flex items-center justify-center shrink-0`}>
                      {card.initials}
                    </div>
                    <div className="min-w-0">
                      <h4
                        onClick={() => navigate('/customers')}
                        className="font-bold text-slate-900 text-xs truncate hover:text-red-600 cursor-pointer"
                      >
                        {card.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate font-normal">{card.company}</p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase ${card.priorityBg} shrink-0`}>
                    {card.priority}
                  </span>
                </div>

                {/* Body Details */}
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                    <span>{card.cycleText}</span>
                  </div>

                  <p className="text-slate-700 font-semibold">{card.reorderText}</p>

                  <p className="text-emerald-600 font-bold">
                    Probability <span className="font-extrabold">{card.probability}</span>
                  </p>
                </div>

                {/* Next Action Box */}
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 font-medium block uppercase">Next Action</span>
                    <span className={`font-bold ${card.nextActionColor}`}>{card.nextActionTitle}</span>
                  </div>

                  <div className="text-right text-slate-500 font-medium text-[10px]">
                    <div className="flex items-center gap-1">
                      <CalendarIcon size={10} className="text-slate-400" />
                      <span>{card.nextActionTime}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Icon Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleActionClick(card.name, 'Call')}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                      title="Call Customer"
                    >
                      <Phone size={13} />
                    </button>
                    <button
                      onClick={() => handleActionClick(card.name, 'WhatsApp')}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                      title="Send WhatsApp"
                    >
                      <MessageCircle size={13} />
                    </button>
                    <button
                      onClick={() => handleActionClick(card.name, 'Email')}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                      title="Send Email"
                    >
                      <Mail size={13} />
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdownId(activeDropdownId === card.id ? null : card.id)}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <MoreHorizontal size={13} />
                    </button>

                    {activeDropdownId === card.id && (
                      <div className="absolute right-0 bottom-8 w-36 bg-white rounded-xl border border-slate-200 shadow-lg p-1 z-20 text-xs">
                        <button
                          onClick={() => { setActiveDropdownId(null); notify.success(`Marked ${card.name} reminder completed`); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 font-medium"
                        >
                          Mark Completed
                        </button>
                        <button
                          onClick={() => { setActiveDropdownId(null); navigate('/customers'); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 font-medium"
                        >
                          View 360 Profile
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Overdue Reminders Table Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-red-600 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                <span>Overdue Reminders (4)</span>
              </h3>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Last Interaction</th>
                    <th className="p-3">Days Overdue</th>
                    <th className="p-3">Expected Reorder Date</th>
                    <th className="p-3">Sales Executive</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {OVERDUE_LIST.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Customer */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {row.initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{row.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{row.company}</p>
                          </div>
                        </div>
                      </td>

                      {/* Last Interaction */}
                      <td className="p-3 font-medium text-slate-600">{row.lastInteraction}</td>

                      {/* Days Overdue */}
                      <td className="p-3 font-bold text-red-600">{row.daysOverdue}</td>

                      {/* Expected Reorder Date */}
                      <td className="p-3 font-medium text-slate-800">{row.expectedDate}</td>

                      {/* Sales Executive */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={row.salesAvatar}
                            alt={row.salesName}
                            className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <p className="text-[9px] text-slate-400 font-medium leading-none">{row.salesRole}</p>
                            <p className="text-[11px] font-semibold text-slate-800">{row.salesName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Action Icon Buttons */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleActionClick(row.name, 'Call')}
                            className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <Phone size={12} />
                          </button>
                          <button
                            onClick={() => handleActionClick(row.name, 'WhatsApp')}
                            className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <MessageCircle size={12} />
                          </button>
                          <button
                            onClick={() => handleActionClick(row.name, 'Schedule')}
                            className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <CalendarIcon size={12} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => notify.info('Showing all overdue reminders')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All Overdue Reminders</span>
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT SECTION: Summary Cards, Leaderboard & Calendar (4 / 12 cols) */}
        <div className="xl:col-span-4 space-y-5">
          
          {/* Card 1: Reminder Summary */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Reminder Summary</h3>
              <button className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer">
                <span>This Week</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
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
                <div className="text-lg font-bold text-slate-900">39</div>
              </div>

              {/* High Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">High Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ArrowUp size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">12</div>
              </div>

              {/* Medium Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Medium Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Hexagon size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">18</div>
              </div>

              {/* Low Priority */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Low Priority</span>
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ArrowDown size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">9</div>
              </div>

              {/* Completed */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Completed</span>
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">16</div>
              </div>

              {/* Overdue */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">Overdue</span>
                  <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Clock size={12} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900">4</div>
              </div>

            </div>
          </div>

          {/* Card 3: Interactive Calendar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Calendar</h3>
              <button className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                View Full Calendar
              </button>
            </div>

            {/* Month Header */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 px-2">
              <button className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><ChevronLeft size={14} /></button>
              <span>May 2025</span>
              <button className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><ChevronRight size={14} /></button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 text-center text-xs gap-y-2 font-semibold text-slate-700">
              <span className="text-slate-300">27</span>
              <span className="text-slate-300">28</span>
              <span className="text-slate-300">29</span>
              <span className="text-slate-300">30</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
              <span>11</span>
              <span>12</span>
              <span>13</span>
              <span>14</span>
              <span>15</span>
              <span>16</span>
              <span>17</span>
              <span>18</span>
              <span>19</span>
              <span>20</span>
              <span>21</span>
              <span>22</span>
              <span>23</span>
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto shadow-2xs">24</span>
              <span>25</span>
              <span>26</span>
              <span>27</span>
              <span>28</span>
              <span>29</span>
              <span>30</span>
              <span>31</span>
            </div>

            {/* Legend Bottom */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> Completed</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
