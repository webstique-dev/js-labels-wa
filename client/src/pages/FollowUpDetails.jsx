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
  UserCheck
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

  // Form State
  const [callStatus, setCallStatus] = useState('connected');
  const [noteText, setNoteText] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead Conversion Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertOrderAmount, setConvertOrderAmount] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  const fetchFollowupDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/followups/${id}`);
      setFollowup(res.data?.followup || null);
      setHistory(res.data?.history || []);
    } catch (err) {
      console.error('Error fetching followup details:', err);
      notify.error(err.response?.data?.message || 'Failed to load follow-up workspace');
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

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
    const leadId = followup?.relatedId?._id;
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
    const contactPhone = followup?.relatedId?.phone;
    const contactEmail = followup?.relatedId?.email;

    if (channel === 'call' && contactPhone) {
      window.open(`tel:${contactPhone}`);
    } else if (channel === 'whatsapp' && contactPhone) {
      const cleanPhone = contactPhone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(followup?.relatedId?.name || '')}%2C%20following%20up%20from%20JS%20Labels.`);
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

  if (!followup) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Follow-up Task Not Found</h3>
        <p className="text-xs text-slate-500 font-normal">The requested follow-up task does not exist or was deleted.</p>
        <Link to="/followups" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium">
          Back to Workspace
        </Link>
      </div>
    );
  }

  const lead = followup.relatedId || {};
  const isLeadType = followup.relatedType === 'lead';
  const openFollowUp = followup.status === 'open' ? followup : null;

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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
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
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{lead.name}</h2>
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
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition flex flex-col items-center gap-1"
                title="Call Lead"
              >
                <Phone size={16} />
                <span className="text-[10px] font-medium">Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('whatsapp')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition flex flex-col items-center gap-1"
                title="WhatsApp Message"
              >
                <MessageSquare size={16} />
                <span className="text-[10px] font-medium">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('email')}
                className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition flex flex-col items-center gap-1"
                title="Send Email"
              >
                <Mail size={16} />
                <span className="text-[10px] font-medium">Email</span>
              </button>
            </div>

            {/* Contact Details List */}
            <div className="space-y-3 pt-3 border-t border-slate-100 text-left text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Phone Number</span>
                <span className="font-semibold text-slate-800">{lead.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Email Address</span>
                <span className="font-semibold text-slate-800 truncate block">{lead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Assigned Executive</span>
                <span className="font-semibold text-slate-800">{followup.assignedTo?.name || 'Unassigned'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* MIDDLE PANEL: Log Call Interaction Form (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 order-2 lg:order-none">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Log Call Interaction & Schedule Next</h3>
              <p className="text-xs text-slate-500 font-normal">Record tele-caller notes, outcomes, and set next follow-up milestone</p>
            </div>

            <form onSubmit={handleLogInteraction} className="space-y-4 text-xs">
              
              {/* Call Status Options */}
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">Call Outcome Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'connected', label: 'Call Connected' },
                    { value: 'no_answer', label: 'No Answer' },
                    { value: 'busy', label: 'Line Busy' },
                    { value: 'rescheduled', label: 'Rescheduled' }
                  ].map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setCallStatus(st.value)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition text-center ${
                        callStatus === st.value
                          ? 'bg-red-50 text-red-700 border-red-200 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Notes Textarea */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Interaction Notes & Remarks</label>
                <textarea
                  rows="4"
                  required
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record customer response, label specifications required, pricing discussed..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                ></textarea>
              </div>

              {/* Next Follow-up Date Input */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Next Follow-up Date & Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              {/* Submit Action */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'Logging Activity...' : 'Log Activity & Update Follow-up'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* RIGHT PANEL: History Stream & Next Reminder (4 Cols) */}
        <div className="lg:col-span-4 space-y-6 order-3 lg:order-none">
          
          {/* Next Reminder Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Next Reminder</h3>

            {openFollowUp ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="w-14 h-14 bg-red-600 text-white rounded-xl flex flex-col items-center justify-center shadow-md flex-shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{formatDateBlock(openFollowUp.dueDate).month}</span>
                    <span className="text-xl font-semibold leading-none">{formatDateBlock(openFollowUp.dueDate).day}</span>
                    <span className="text-[9px] opacity-80">{formatDateBlock(openFollowUp.dueDate).year}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Scheduled Follow-up</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{openFollowUp.notes || 'No specific notes'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No open follow-up task scheduled.</p>
            )}
          </div>

          {/* Activity History Feed */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interaction History</h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No past interaction logs recorded.</p>
              ) : (
                history.map((act) => (
                  <div key={act._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-900">{act.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>By: {act.createdBy?.name || 'System'}</span>
                      <span>{new Date(act.createdAt).toLocaleString('en-IN')}</span>
                    </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Convert Lead to Customer Account</h3>
              <button onClick={() => setShowConvertModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleConvertLead} className="space-y-4 text-xs">
              <p className="text-slate-600 font-normal">
                Converting <span className="font-semibold text-slate-900">{lead.name}</span> will create an active Customer record and log their initial Won Order.
              </p>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Won Order Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={convertOrderAmount}
                  onChange={(e) => setConvertOrderAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
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
