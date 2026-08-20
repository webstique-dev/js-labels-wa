import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
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
import { initiatePhoneCall, openWhatsApp, openEmail, WhatsAppIcon } from '../utils/contactUtils';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';

export default function FollowUpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();

  const [activeTab, setActiveTab] = useState('feed');
  const [isMarkedDone, setIsMarkedDone] = useState(false);
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const [leadRes, actRes] = await Promise.all([
        api.get(`/leads/${id}`).catch(() => ({ data: null })),
        api.get(`/activities?relatedType=lead&relatedId=${id}`).catch(() => ({ data: [] }))
      ]);

      if (leadRes.data) {
        setLead(leadRes.data);
      } else {
        notify.error('Lead details not found');
      }

      setActivities(Array.isArray(actRes.data) ? actRes.data : []);
    } catch (err) {
      console.error('Error loading lead workspace details:', err);
      notify.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchWorkspaceData();
    }
  }, [id]);

  const handleMarkAsDone = async () => {
    try {
      setIsMarkedDone(true);
      await api.patch(`/leads/${id}/status`, { status: 'won' });
      notify.success('Lead marked as Order Received!');
      fetchWorkspaceData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update lead status');
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    try {
      await api.post(`/leads/${id}/activity`, {
        type: 'notes',
        description: newNoteInput.trim()
      });
      notify.success('Note added to lead timeline');
      setNewNoteInput('');
      setIsAddingNote(false);
      fetchWorkspaceData();
    } catch (err) {
      notify.error('Failed to save note');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'LD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12 font-sans">
        <div className="flex items-center justify-between">
          <Link to="/leads" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <ArrowLeft size={16} /> Back to Leads
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-slate-500 font-semibold text-base">Lead workspace not found.</p>
        <button
          onClick={() => navigate('/leads')}
          className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  const custName = lead.name || 'N/A';
  const company = lead.company || 'Individual Prospect';
  const phone = lead.phone || '';
  const email = lead.email || '';
  const status = lead.status || 'new';
  const priority = lead.priority || 'medium';
  const source = lead.source || 'Website';
  const execName = lead.assignedTo?.name || 'Unassigned Caller';
  const initials = getInitials(custName);

  const filteredActivities = activities.filter((act) => {
    if (activeTab === 'calls') return act.type === 'call';
    if (activeTab === 'whatsapp') return act.type === 'whatsapp';
    if (activeTab === 'emails') return act.type === 'email';
    if (activeTab === 'notes') return act.type === 'notes';
    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Leads Kanban</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMarkAsDone()}
            disabled={isMarkedDone || status === 'won'}
            className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer ${
              status === 'won' || isMarkedDone ? 'bg-emerald-600' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{status === 'won' || isMarkedDone ? 'Order Received' : 'Mark as Won / Order Received'}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMN 1: Lead Profile & Details (3.5 / 12 cols) */}
        <div className="xl:col-span-4 space-y-5">
          
          {/* Card 1: Lead Profile */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            
            {/* Top row: Avatar, Name, Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-bold text-slate-900 text-sm truncate">{custName}</h2>
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 font-bold text-[10px] rounded-md uppercase">
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-normal truncate mt-0.5">{company}</p>
                </div>
              </div>
            </div>

            {/* Priority & Source Badges */}
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold rounded-md uppercase">
                {priority} Priority
              </span>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold rounded-md">
                Source: {source}
              </span>
            </div>

            {/* Contact Information List */}
            <div className="space-y-3 text-xs text-slate-600 pt-2 border-t border-slate-100 font-medium">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900">{phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => initiatePhoneCall(phone, custName, notify)}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                    title="Call Lead"
                  >
                    <Phone size={13} />
                  </button>
                  <button
                    onClick={() => openWhatsApp(phone, custName, null, notify)}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                    title="Send WhatsApp"
                  >
                    <WhatsAppIcon size={13} className="text-slate-500 hover:text-emerald-600" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{email || 'No email recorded'}</span>
                </div>
                {email && (
                  <button
                    onClick={() => openEmail(email, custName, null, null, notify)}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    title="Send Email"
                  >
                    <Mail size={13} />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Card 2: Workspace Lead Summary */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3.5">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight">Lead Workspace Summary</h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Executive</span>
                <span className="font-bold text-slate-900">{execName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Stage Status</span>
                <span className="font-bold text-red-600 uppercase">{status}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Created On</span>
                <span className="font-bold text-slate-900">
                  {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last Activity</span>
                <span className="font-bold text-slate-900">
                  {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </span>
              </div>

              {lead.followUpDate && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Follow-up Scheduled</span>
                  <span className="font-bold text-red-600">
                    {new Date(lead.followUpDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at {lead.followUpTime || '10:00 AM'}
                  </span>
                </div>
              )}

              {lead.cancelReason && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-slate-500 font-medium block">Rejection Reason</span>
                  <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg italic">
                    "{lead.cancelReason}"
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* COLUMN 2: Real Activity Timeline Feed (8 / 12 cols) */}
        <div className="xl:col-span-8 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            
            {/* Header & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Lead Activity Timeline</h3>

              <div className="flex items-center gap-3 text-xs font-semibold overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('feed')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'feed' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All Feed ({activities.length})
                </button>
                <button
                  onClick={() => setActiveTab('calls')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'calls' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Calls
                </button>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'whatsapp' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => setActiveTab('emails')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'emails' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Emails
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'notes' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Notes
                </button>
              </div>
            </div>

            {/* Quick Add Note Bar */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <form onSubmit={handleAddNoteSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newNoteInput}
                  onChange={(e) => setNewNoteInput(e.target.value)}
                  placeholder="Type a new activity note or update..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0"
                >
                  Add Note
                </button>
              </form>
            </div>

            {/* Timeline Feed Items Stream */}
            {filteredActivities.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-normal border border-dashed border-slate-200 rounded-xl">
                No activity records found for this filter tab.
              </div>
            ) : (
              <div className="space-y-3 text-xs pt-1">
                {filteredActivities.map((act) => {
                  let iconElement = <FileText size={15} />;
                  let iconBg = 'bg-blue-50 text-blue-600';

                  if (act.type === 'call') {
                    iconElement = <Phone size={15} />;
                    iconBg = 'bg-amber-50 text-amber-600';
                  } else if (act.type === 'whatsapp') {
                    iconElement = <WhatsAppIcon size={15} className="text-emerald-600" />;
                    iconBg = 'bg-emerald-50 text-emerald-600';
                  } else if (act.type === 'email') {
                    iconElement = <Mail size={15} />;
                    iconBg = 'bg-indigo-50 text-indigo-600';
                  } else if (act.type === 'notes') {
                    iconElement = <FileText size={15} />;
                    iconBg = 'bg-purple-50 text-purple-600';
                  }

                  const dateStr = act.createdAt
                    ? new Date(act.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Just now';

                  const authorName = act.createdBy?.name || 'Executive';

                  return (
                    <div key={act._id} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition shadow-2xs">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                          {iconElement}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{act.description}</p>
                          <p className="text-[11px] text-slate-400 font-normal mt-0.5">By {authorName}</p>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-medium shrink-0">
                        {dateStr}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}


