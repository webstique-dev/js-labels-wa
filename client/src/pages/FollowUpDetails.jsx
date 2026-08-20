import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  CheckCircle2,
  Star,
  MoreVertical,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  FileText,
  FileSpreadsheet,
  Download,
  Bell,
  Truck,
  User,
  ChevronDown
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { WhatsappIcon } from '../components/ui/WhatsappIcon';

export default function FollowUpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();

  const [activeTab, setActiveTab] = useState('feed');
  const [isMarkedDone, setIsMarkedDone] = useState(false);

  const handleMarkAsDone = () => {
    setIsMarkedDone(true);
    notify.success('Follow-up marked as completed!');
  };

  const handleActionClick = (actionName) => {
    notify.success(`Action "${actionName}" initiated`);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/followups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Follow-ups Workspace</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => notify.info('Opening edit follow-up modal')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Edit size={14} className="text-slate-400" />
            <span>Edit</span>
          </button>

          <button
            onClick={handleMarkAsDone}
            disabled={isMarkedDone}
            className={`px-4 py-1.5 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer ${
              isMarkedDone ? 'bg-emerald-600' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{isMarkedDone ? 'Completed' : 'Mark as Done'}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMN 1: Customer Contact Profile & Follow-up Summary (3.5 / 12 cols) */}
        <div className="xl:col-span-3 space-y-5">
          
          {/* Card 1: Customer Profile */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            
            {/* Top row: Avatar, Name, Badge, Star, Options */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                  RK
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-bold text-slate-900 text-sm truncate">Ramesh Kumar</h2>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] rounded-md">
                      Customer
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-normal truncate mt-0.5">Apex Traders Pvt. Ltd.</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 text-slate-400">
                <Star size={14} className="hover:text-amber-500 cursor-pointer" />
                <MoreVertical size={14} className="hover:text-slate-700 cursor-pointer" />
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold rounded-md">
                High Value
              </span>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold rounded-md">
                Chennai
              </span>
            </div>

            {/* Contact Information List */}
            <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100 font-medium">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900">98765 43210</span>
                </div>
                <button
                  onClick={() => handleActionClick('WhatsApp')}
                  className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 cursor-pointer"
                >
                  <WhatsappIcon size={14} className="text-emerald-600" />
                </button>
              </div>

              <div className="flex items-center gap-2 truncate">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">ramesh.kumar@apextraders.com</span>
              </div>

              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-600 leading-tight">21, Industrial Estate, Guindy, Chennai - 600032</span>
              </div>

              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-800">GST: 33AABCA1234A1Z5</span>
              </div>
            </div>

          </div>

          {/* Card 2: Follow-up Summary */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3.5">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight">Follow-up Summary</h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Lead Source</span>
                <span className="font-bold text-slate-900">Website</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Sales Executive</span>
                <div className="flex items-center gap-1.5">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60"
                    alt="Priya Sharma"
                    className="w-5 h-5 rounded-full object-cover border border-slate-200"
                  />
                  <span className="font-bold text-slate-900">Tele Caller 1</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer Since</span>
                <span className="font-bold text-slate-900">May 15, 2025</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last Contacted</span>
                <span className="font-bold text-slate-900">May 16, 2025 (12:20 PM)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Follow-ups</span>
                <span className="font-bold text-slate-900">6</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Open Follow-ups</span>
                <span className="font-bold text-red-600">2</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Reorder Probability</span>
                <span className="font-extrabold text-emerald-600">High (85%)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Next Reorder Date</span>
                <span className="font-bold text-slate-900">June 12, 2025</span>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMN 2: Activity Feed Chronological Stream (5.5 / 12 cols) */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-5 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide text-xs font-semibold">
              <button
                onClick={() => setActiveTab('feed')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'feed' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Activity Feed
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'all' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                All Activities
              </button>
              <button
                onClick={() => setActiveTab('calls')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'calls' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Calls
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'whatsapp' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('emails')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'emails' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Emails
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`pb-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'notes' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Notes
              </button>
            </div>

            {/* Timeline Feed Items Stream */}
            <div className="space-y-5 text-xs pt-1">
              
              {/* Group: May 21, 2025 */}
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-md">
                  May 21, 2025
                </span>

                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Bell size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Reorder reminder scheduled</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Expected reorder on June 12, 2025</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>02:45 PM</div>
                    <div>Tele Caller 1</div>
                  </div>
                </div>
              </div>

              {/* Group: May 20, 2025 */}
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-md">
                  May 20, 2025
                </span>

                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Truck size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Order delivered successfully</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Order ORD-2456 delivered via DTDC</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>05:30 PM</div>
                    <div>System</div>
                  </div>
                </div>
              </div>

              {/* Group: May 16, 2025 */}
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-md">
                  May 16, 2025
                </span>

                {/* Event 1 */}
                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Order ORD-2456 created</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Order value: ₹ 18,450</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>03:10 PM</div>
                    <div>Tele Caller 1</div>
                  </div>
                </div>

                {/* Event 2 */}
                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <WhatsappIcon size={15} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">WhatsApp discussion</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Shared material samples and discussed pricing.</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>12:20 PM</div>
                    <div>Tele Caller 1</div>
                  </div>
                </div>

                {/* Event 3 */}
                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Phone size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Follow-up call completed</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Interested in premium quality labels. Requested quotation.</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>11:15 AM</div>
                    <div>Tele Caller 1</div>
                  </div>
                </div>

                {/* Event 4 */}
                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileText size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Quotation QTN-0205 sent</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Quotation for 3 items worth ₹ 18,450</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>09:45 AM</div>
                    <div>Tele Caller 1</div>
                  </div>
                </div>
              </div>

              {/* Group: May 15, 2025 */}
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-md">
                  May 15, 2025
                </span>

                <div className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50/80 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <User size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">New lead assigned to Tele Caller 1</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">Lead source: Website</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                    <div>10:30 AM</div>
                    <div>System</div>
                  </div>
                </div>
              </div>

            </div>

            <div className="text-center pt-2 border-t border-slate-100">
              <button className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer">
                <span>View More Activities</span>
                <ChevronDown size={14} />
              </button>
            </div>

          </div>
        </div>

        {/* COLUMN 3: Next Reminder, Notes & Documents (3.5 / 12 cols) */}
        <div className="xl:col-span-4 space-y-5">
          
          {/* Card 1: Next Reminder */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight">Next Reminder</h3>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-4">
              
              {/* Red Date Box */}
              <div className="w-14 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden text-center shrink-0 shadow-2xs">
                <div className="bg-red-600 text-white font-bold text-[10px] py-0.5 uppercase tracking-wider">
                  JUN
                </div>
                <div className="text-xl font-extrabold text-slate-900 leading-tight pt-1">
                  12
                </div>
                <div className="text-[9px] text-slate-400 font-normal">
                  Thursday
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1 text-xs">
                <p className="font-bold text-slate-900">Follow-up Call</p>
                <div className="text-[11px] text-slate-500 font-normal">
                  <span>Expected Reorder Date</span>
                  <p className="font-semibold text-slate-800">June 12, 2025</p>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[10px]">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 font-semibold text-slate-700 rounded-md flex items-center gap-1">
                    <Clock size={10} className="text-slate-400" />
                    <span>10:00 AM</span>
                  </span>
                  <span className="font-bold text-emerald-600">High (85%)</span>
                </div>
              </div>

            </div>

            {/* Quick Action Dial Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => handleActionClick('Call')}
                className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                title="Call Customer"
              >
                <Phone size={13} className="text-emerald-600" />
                <span>Call</span>
              </button>
              <button
                onClick={() => handleActionClick('WhatsApp')}
                className="py-2 px-3.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold text-emerald-700 flex items-center justify-center shadow-2xs cursor-pointer"
                title="Send WhatsApp"
              >
                <WhatsappIcon size={16} className="text-emerald-600" />
              </button>
              <button
                onClick={() => handleActionClick('Email')}
                className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                title="Send Email"
              >
                <Mail size={13} className="text-blue-600" />
                <span>Email</span>
              </button>
            </div>
          </div>

          {/* Card 2: Notes */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs tracking-tight">Notes</h3>
              <button onClick={() => notify.info('Opening note editor')} className="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer">
                <Plus size={13} />
                <span>Add Note</span>
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2 text-xs">
              <p className="text-slate-800 font-medium leading-relaxed">
                Customer is looking for premium BOPP labels. Discussed pricing and quality. Waiting for approval from their management.
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-medium">
                <span>Tele Caller 1 • May 16, 2025 12:20 PM</span>
                <div className="flex items-center gap-1.5">
                  <button className="hover:text-slate-700 cursor-pointer"><Edit2 size={12} /></button>
                  <button className="hover:text-red-600 cursor-pointer"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Files & Documents */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs tracking-tight">Files & Documents</h3>
              <button onClick={() => notify.info('Opening document upload modal')} className="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer">
                <Plus size={13} />
                <span>Upload</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              
              {/* Doc 1 */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">Quotation_QTN-0205.pdf</p>
                    <p className="text-[10px] text-slate-400 font-normal">PDF • 245 KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-medium">May 16, 2025</span>
                  <button className="p-1 hover:text-slate-900 cursor-pointer text-slate-400"><Download size={13} /></button>
                </div>
              </div>

              {/* Doc 2 */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">Price_List_May2025.pdf</p>
                    <p className="text-[10px] text-slate-400 font-normal">PDF • 512 KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-medium">May 15, 2025</span>
                  <button className="p-1 hover:text-slate-900 cursor-pointer text-slate-400"><Download size={13} /></button>
                </div>
              </div>

              {/* Doc 3 */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">Product_Specifications.xlsx</p>
                    <p className="text-[10px] text-slate-400 font-normal">XLSX • 162 KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-medium">May 15, 2025</span>
                  <button className="p-1 hover:text-slate-900 cursor-pointer text-slate-400"><Download size={13} /></button>
                </div>
              </div>

            </div>

            <div className="text-center pt-2 border-t border-slate-100">
              <button className="text-xs font-bold text-red-600 hover:underline cursor-pointer">
                View All Files
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

