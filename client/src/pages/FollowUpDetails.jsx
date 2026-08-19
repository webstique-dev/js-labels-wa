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
  FileText,
  Calendar,
  Upload,
  Download,
  CheckCircle2,
  Plus,
  X
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'LD';
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

const formatDateBlock = (dateString) => {
  if (!dateString) return { month: '---', day: '--', year: '----' };
  const d = new Date(dateString);
  const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return { month, day, year };
};

export default function FollowUpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [openFollowUp, setOpenFollowUp] = useState(null);
  const [loading, setLoading] = useState(true);

  // Center Feed Tab Filter
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'call' | 'whatsapp' | 'email' | 'note'
  const [newNoteInput, setNewNoteInput] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Modals / Forms
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    dueDate: '',
    notes: ''
  });

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadRes, actRes, followUpRes] = await Promise.all([
        api.get(`/leads/${id}`),
        api.get('/activities', { params: { relatedType: 'lead', relatedId: id } }),
        api.get('/followups', { params: { relatedType: 'lead', relatedId: id } })
      ]);

      setLead(leadRes.data);
      setActivities(actRes.data || []);
      setOpenFollowUp(followUpRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        navigate('/dashboard', {
          replace: true,
          state: { deniedMessage: "You don't have access to this lead's details" }
        });
      } else {
        notify.error(err.response?.data?.message || 'Error loading lead details');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate, notify]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Quick Note Submit
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    try {
      setIsPostingNote(true);
      await api.post('/activities', {
        relatedType: 'lead',
        relatedId: id,
        type: 'note',
        description: newNoteInput
      });
      setNewNoteInput('');
      notify.success('Note added to activity feed');
      loadAllData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to add note');
    } finally {
      setIsPostingNote(false);
    }
  };

  // Log Action & Open Link
  const handleQuickAction = async (actionType) => {
    if (!lead) return;

    try {
      let desc = '';
      if (actionType === 'call') desc = `Initiated call to ${lead.phone}`;
      else if (actionType === 'whatsapp') desc = `Opened WhatsApp chat with ${lead.phone}`;
      else if (actionType === 'email') desc = `Sent email to ${lead.email}`;

      await api.post('/activities', {
        relatedType: 'lead',
        relatedId: id,
        type: actionType,
        description: desc
      });

      loadAllData();
    } catch (err) {
      console.error('Error logging action:', err);
    }

    // Execute Browser Links
    if (actionType === 'call') {
      window.location.href = `tel:${lead.phone}`;
    } else if (actionType === 'whatsapp') {
      const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } else if (actionType === 'email') {
      window.location.href = `mailto:${lead.email}`;
    }
  };

  // Mark Follow-up Done
  const handleMarkDone = async () => {
    if (!openFollowUp) return;

    const isConfirmed = await confirm({
      title: 'Mark Follow-up as Done',
      message: 'Mark current follow-up as completed? You will be prompted to schedule the next follow-up.',
      confirmLabel: 'Mark Done',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      await api.patch(`/followups/${openFollowUp._id}`, { status: 'done' });
      notify.success('Follow-up marked as done!');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleForm({
        dueDate: tomorrow.toISOString().slice(0, 16),
        notes: ''
      });
      setIsScheduleModalOpen(true);
      loadAllData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update follow-up');
    }
  };

  // Schedule Follow-up Submit
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleForm.dueDate) {
      notify.error('Please select a due date & time');
      return;
    }

    try {
      await api.post('/followups', {
        relatedType: 'lead',
        relatedId: id,
        dueDate: scheduleForm.dueDate,
        notes: scheduleForm.notes,
        assignedTo: lead?.assignedTo?._id || user?.id
      });

      notify.success('New follow-up scheduled!');
      setIsScheduleModalOpen(false);
      loadAllData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to schedule follow-up');
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('relatedType', 'lead');
    formData.append('relatedId', id);
    formData.append('description', `Uploaded document: ${file.name}`);

    try {
      setIsUploading(true);
      await api.post('/activities/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notify.success(`Uploaded ${file.name} successfully!`);
      loadAllData();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const filteredActivities = activities.filter(a => {
    if (activeTab === 'all') return true;
    return a.type === activeTab;
  });

  const documentActivities = activities.filter(a => a.fileUrl);
  const noteActivities = activities.filter(a => a.type === 'note');

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-semibold">Loading Lead Follow-up Details...</p>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/leads"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Leads Kanban</span>
        </Link>
        <span className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold uppercase">
          Follow-up Workspace
        </span>
      </div>

      {/* 3-Panel Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT PANEL: Contact Card (3 Cols) */}
        <div className="lg:col-span-3 space-y-6 order-1 lg:order-none">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5 text-center">
            
            {/* Avatar & Lead Info */}
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md">
                {getInitials(lead.name)}
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{lead.name}</h2>
              <p className="text-slate-500 text-xs font-medium">{lead.company || 'Individual Prospect'}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                Source: {lead.source}
              </span>
              <span
                className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-md uppercase ${
                  lead.priority === 'high'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : lead.priority === 'medium'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                Priority: {lead.priority}
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md uppercase">
                Status: {lead.status}
              </span>
            </div>

            {/* Contact Details & Direct Links */}
            <div className="pt-4 border-t border-slate-100 space-y-3 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Phone:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAction('call')}
                  className="text-red-600 hover:text-red-700 font-semibold underline flex items-center gap-1"
                >
                  <Phone size={12} />
                  <span>{lead.phone}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">WhatsApp:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAction('whatsapp')}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold underline flex items-center gap-1"
                >
                  <MessageSquare size={12} />
                  <span>Open Chat</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Email:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAction('email')}
                  className="text-blue-600 hover:text-blue-700 font-semibold underline truncate max-w-[150px]"
                >
                  {lead.email || 'N/A'}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-medium">Executive:</span>
                <span className="font-bold text-slate-800">{lead.assignedTo?.name || 'Unassigned'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* CENTER PANEL: Activity Feed & Note Input (6 Cols) */}
        <div className="lg:col-span-6 space-y-6 order-3 lg:order-none">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col min-h-[600px]">
            
            {/* Feed Header Tabs */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900 text-sm">Activity Feed Timeline</h3>
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max">
                  {['all', 'call', 'whatsapp', 'email', 'note'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2.5 py-1 text-[11px] font-bold capitalize rounded-lg transition whitespace-nowrap ${
                        activeTab === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Stream */}
            <div className="p-5 flex-1 space-y-4 overflow-y-auto scrollbar-hide max-h-[480px]">
              {filteredActivities.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-medium">
                  No activity entries found under this category.
                </div>
              ) : (
                filteredActivities.map((act) => (
                  <div key={act._id} className="flex items-start gap-3.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 flex-shrink-0 bg-white border border-slate-200 shadow-2xs">
                      {act.type === 'call' && <Phone size={16} className="text-emerald-600" />}
                      {act.type === 'whatsapp' && <MessageSquare size={16} className="text-green-600" />}
                      {act.type === 'email' && <Mail size={16} className="text-blue-600" />}
                      {act.type === 'note' && <FileText size={16} className="text-amber-600" />}
                      {act.type === 'status_change' && <CheckCircle2 size={16} className="text-purple-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 text-xs">{act.createdBy?.name || 'System'}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{getRelativeTime(act.createdAt)}</span>
                      </div>
                      <p className="text-slate-700 text-xs mt-1 leading-relaxed">{act.description}</p>
                      
                      {act.fileUrl && (
                        <a
                          href={`http://localhost:5000${act.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-white border border-slate-300 hover:border-red-500 text-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          <FileText size={14} />
                          <span>{act.fileName}</span>
                          <Download size={12} className="text-red-600" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Note Post Input Form at Bottom */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <form onSubmit={handleNoteSubmit} className="space-y-2">
                <textarea
                  rows={2}
                  value={newNoteInput}
                  onChange={(e) => setNewNoteInput(e.target.value)}
                  placeholder="Type a new activity note for this lead..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isPostingNote || !newNoteInput.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    {isPostingNote ? 'Posting...' : 'Post Note'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>

        {/* RIGHT PANEL: Reminders, Notes & Documents (3 Cols) */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-none">
          
          {/* Next Reminder Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Reminder</h3>

            {openFollowUp ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="w-14 h-14 bg-red-600 text-white rounded-xl flex flex-col items-center justify-center shadow-md flex-shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider">{formatDateBlock(openFollowUp.dueDate).month}</span>
                    <span className="text-xl font-black leading-none">{formatDateBlock(openFollowUp.dueDate).day}</span>
                    <span className="text-[9px] opacity-80">{formatDateBlock(openFollowUp.dueDate).year}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Scheduled Follow-up</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{openFollowUp.notes || 'No specific notes'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAction('call')}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 text-center transition flex items-center justify-center gap-1"
                  >
                    <Phone size={12} />
                    <span>Call</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('whatsapp')}
                    className="py-1.5 px-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-[11px] rounded-lg border border-green-200 text-center transition flex items-center justify-center gap-1"
                  >
                    <MessageSquare size={12} />
                    <span>WA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('email')}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg border border-blue-200 text-center transition flex items-center justify-center gap-1"
                  >
                    <Mail size={12} />
                    <span>Email</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleMarkDone}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Mark as Done</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-3">
                <p className="text-xs text-slate-500 font-medium">No upcoming follow-up scheduled yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setScheduleForm({
                      dueDate: tomorrow.toISOString().slice(0, 16),
                      notes: ''
                    });
                    setIsScheduleModalOpen(true);
                  }}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} />
                  <span>Schedule Follow-up</span>
                </button>
              </div>
            )}
          </div>

          {/* Pinned Notes Panel */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Notes ({noteActivities.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {noteActivities.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No notes created yet.</p>
              ) : (
                noteActivities.map(n => (
                  <div key={n._id} className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                    <p>{n.description}</p>
                    <span className="text-[10px] text-amber-700/70 font-semibold block text-right">{getRelativeTime(n.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Files & Documents Upload Panel */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files & Documents</h3>
              <label className="cursor-pointer text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1">
                <Upload size={14} />
                <span>Upload</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            {isUploading && (
              <p className="text-xs text-slate-500 font-semibold animate-pulse">Uploading file...</p>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {documentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No documents attached yet.</p>
              ) : (
                documentActivities.map(doc => (
                  <div key={doc._id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="truncate max-w-[150px]">
                      <p className="font-semibold text-slate-800 truncate">{doc.fileName}</p>
                      <span className="text-[10px] text-slate-400">{getRelativeTime(doc.createdAt)}</span>
                    </div>
                    <a
                      href={`http://localhost:5000${doc.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-600 hover:text-red-800 font-bold text-[10px] uppercase flex items-center gap-1"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Schedule Follow-up Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Schedule Next Follow-up</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Due Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.dueDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Follow-up Notes
                </label>
                <textarea
                  rows={3}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="e.g. Call client regarding quotation review..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition"
                >
                  Save Follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
