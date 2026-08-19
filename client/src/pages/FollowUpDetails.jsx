import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Building,
  RefreshCw,
  XCircle,
  CheckSquare,
  FileText,
  UserCheck,
  AlertTriangle
} from 'lucide-react';

export default function FollowUpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [followup, setFollowup] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [callStatus, setCallStatus] = useState('connected');
  const [noteText, setNoteText] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead Conversion Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertOrderAmount, setConvertOrderAmount] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Root Cause Fix: Remove notify from useCallback dependencies to prevent infinite request loops
  const fetchFollowupDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.get(`/followups/${id}`);
      setFollowup(res.data?.followup || null);
      setHistory(Array.isArray(res.data?.history) ? res.data.history : []);
    } catch (err) {
      console.error('Error fetching followup details:', err);
      const msg = err.response?.data?.message || 'Failed to load follow-up workspace';
      setErrorMessage(msg);
      setFollowup(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFollowupDetails();
  }, [fetchFollowupDetails]);

  // Log Activity & Schedule Next Follow-up
  const handleLogInteraction = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) {
      notify.error('Please enter call notes before submitting');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        callStatus,
        notes: noteText,
        nextFollowupDate: nextFollowupDate || null
      };

      await api.post(`/followups/${id}/log`, payload);
      notify.success('Interaction logged & follow-up updated!');
      setNoteText('');
      setNextFollowupDate('');
      fetchFollowupDetails();
    } catch (err) {
      console.error('Error logging interaction:', err);
      notify.error(err.response?.data?.message || 'Failed to log call interaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Lead to Customer
  const handleConvertLead = async (e) => {
    e.preventDefault();
    const leadId = followup?.relatedId?._id || followup?.relatedRecord?._id || followup?.relatedId;
    if (!leadId) return;

    try {
      setIsConverting(true);
      await api.post(`/leads/${leadId}/convert`, {
        orderAmount: convertOrderAmount ? Number(convertOrderAmount) : 0
      });
      notify.success('Lead converted to Customer & Won Order created!');
      setShowConvertModal(false);
      fetchFollowupDetails();
    } catch (err) {
      console.error('Error converting lead:', err);
      notify.error(err.response?.data?.message || 'Failed to convert lead');
    } finally {
      setIsConverting(false);
    }
  };

  // Quick Action Buttons (Phone, WhatsApp, Email)
  const handleQuickAction = (channel) => {
    const contactPhone = followup?.relatedRecord?.phone || followup?.relatedId?.phone;
    const contactEmail = followup?.relatedRecord?.email || followup?.relatedId?.email;
    const contactName = followup?.relatedRecord?.name || followup?.relatedId?.name || '';

    if (channel === 'call' && contactPhone) {
      window.open(`tel:${contactPhone}`);
    } else if (channel === 'whatsapp' && contactPhone) {
      const cleanPhone = contactPhone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(contactName)}%2C%20following%20up%20from%20JS%20Labels.`);
    } else if (channel === 'email' && contactEmail) {
      window.open(`mailto:${contactEmail}?subject=JS%20Labels%20Follow-up`);
    } else {
      notify.error(`No valid ${channel} contact details available.`);
    }
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return 'JS';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  const formatDateBlock = (dateStr) => {
    if (!dateStr) return { month: 'JAN', day: '01', year: '2026' };
    const date = new Date(dateStr);
    return {
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(date.getDate()).padStart(2, '0'),
      year: date.getFullYear()
    };
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-medium">Loading Follow-up Workspace...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !followup) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Follow-up Task Not Found</h3>
        <p className="text-xs text-slate-500 font-normal">
          {errorMessage || 'The requested follow-up task does not exist or was soft-deleted.'}
        </p>
        <div className="pt-2">
          <Link to="/followups" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition inline-block">
            Back to Follow-ups Workspace
          </Link>
        </div>
      </div>
    );
  }

  const lead = followup.relatedRecord || followup.relatedId || {};
  const isLeadType = followup.relatedType === 'lead';
  const openFollowUp = followup.status === 'open' ? followup : null;
  const dateObj = formatDateBlock(followup.dueDate);

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/followups"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Follow-ups Workspace</span>
        </Link>

        {/* Lead Conversion CTA Button */}
        {isLeadType && lead.status !== 'won' && (
          <button
            onClick={() => setShowConvertModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck size={16} />
            <span>Convert Lead to Customer (Won)</span>
          </button>
        )}
      </div>

      {/* 3-Panel Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT PANEL: Contact Card (3 Cols) */}
        <div className="lg:col-span-3 space-y-6 order-1 lg:order-none">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5 text-center">
            
            {/* Avatar & Lead Info */}
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xl shadow-md">
                {getInitials(lead.name)}
              </div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{lead.name || 'Prospect'}</h2>
              <p className="text-slate-500 text-xs font-medium">{lead.company || 'Individual Prospect'}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium rounded-md uppercase">
                Source: {lead.source || 'Website'}
              </span>
              <span className={`px-2.5 py-0.5 border text-[10px] font-medium rounded-md uppercase ${
                lead.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {lead.priority || 'medium'} priority
              </span>
            </div>

            {/* Quick Action Dialers */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleQuickAction('call')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition flex flex-col items-center gap-1 cursor-pointer"
                title="Call Lead"
              >
                <Phone size={16} />
                <span className="text-[10px] font-medium">Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('whatsapp')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition flex flex-col items-center gap-1 cursor-pointer"
                title="WhatsApp Message"
              >
                <MessageSquare size={16} />
                <span className="text-[10px] font-medium">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('email')}
                className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition flex flex-col items-center gap-1 cursor-pointer"
                title="Email Lead"
              >
                <Mail size={16} />
                <span className="text-[10px] font-medium">Email</span>
              </button>
            </div>

            {/* Direct Contact Details */}
            <div className="space-y-2 text-left pt-2 border-t border-slate-100 text-xs text-slate-600 font-normal">
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-900">{lead.phone}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-2">
                  <Building size={14} className="text-slate-400 flex-shrink-0" />
                  <span>{lead.city}</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* MIDDLE PANEL: Follow-up Logger & Next Scheduled Block (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 order-2 lg:order-none">
          
          {/* Scheduled Date Display Block */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex flex-col items-center justify-center font-bold flex-shrink-0">
              <span className="text-[10px] uppercase font-semibold tracking-wider">{dateObj.month}</span>
              <span className="text-xl leading-none">{dateObj.day}</span>
              <span className="text-[9px] font-normal text-slate-400">{dateObj.year}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium uppercase text-slate-400 block">Scheduled Follow-up Date</span>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">
                {followup.status === 'open' ? 'Active Action Required' : 'Completed Task'}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-normal">
                {followup.notes || 'Routine follow-up call with customer executive.'}
              </p>
            </div>
          </div>

          {/* Log Interaction Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Plus size={16} className="text-red-600" />
              <span>Log Call Interaction & Update Follow-up</span>
            </h3>

            <form onSubmit={handleLogInteraction} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Call Outcome Status</label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="connected">Call Connected & Discussed</option>
                  <option value="no_answer">No Answer / Busy</option>
                  <option value="callback_requested">Callback Requested</option>
                  <option value="quotation_requested">Quotation Sent / Requested</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Call Notes & Discussion Points *</label>
                <textarea
                  rows={4}
                  required
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record summary of call, customer requirements, label dimensions, quantity..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Next Follow-up Date (Optional)</label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'Saving Interaction...' : 'Log Activity & Save'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT PANEL: Timeline & Activity Log History (4 Cols) */}
        <div className="lg:col-span-4 space-y-6 order-3 lg:order-none">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Clock size={16} className="text-slate-500" />
              <span>Activity History & Timeline</span>
            </h3>

            <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-hide pr-1">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 font-normal text-center py-8">No prior activity logs found for this record.</p>
              ) : (
                history.map((act) => (
                  <div key={act._id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 capitalize">{act.type?.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(act.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 font-normal leading-relaxed">{act.description}</p>
                    {act.createdBy?.name && (
                      <div className="text-[10px] text-slate-400 font-normal pt-1 border-t border-slate-200/60">
                        By: <span className="font-medium text-slate-700">{act.createdBy.name}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Convert Lead to Customer Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck size={18} className="text-emerald-600" />
              <span>Convert Lead to Customer</span>
            </h3>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              This will convert lead <strong className="text-slate-900">{lead.name}</strong> into an active Customer account and record their initial order as Won.
            </p>

            <form onSubmit={handleConvertLead} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Initial Order Amount (INR)</label>
                <input
                  type="number"
                  value={convertOrderAmount}
                  onChange={(e) => setConvertOrderAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {isConverting ? 'Converting...' : 'Confirm Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
