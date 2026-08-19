import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import NewOrderModal from '../components/NewOrderModal';
import {
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  ArrowRight,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  UserCheck,
  AlertTriangle,
  X
} from 'lucide-react';

const COLUMNS = [
  { id: 'new', title: 'New', color: 'border-t-blue-500', headerBg: 'bg-blue-500/10 text-blue-700', badgeClass: 'bg-blue-100 text-blue-800' },
  { id: 'contacted', title: 'Contacted', color: 'border-t-purple-500', headerBg: 'bg-purple-500/10 text-purple-700', badgeClass: 'bg-purple-100 text-purple-800' },
  { id: 'follow_up', title: 'Follow-up', color: 'border-t-amber-500', headerBg: 'bg-amber-500/10 text-amber-700', badgeClass: 'bg-amber-100 text-amber-800' },
  { id: 'won', title: 'Order Received', color: 'border-t-emerald-500', headerBg: 'bg-emerald-500/10 text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-800' },
  { id: 'cancelled', title: 'Cancelled', color: 'border-t-rose-500', headerBg: 'bg-rose-500/10 text-rose-700', badgeClass: 'bg-rose-100 text-rose-800' }
];

const SOURCE_LABELS = {
  website: 'Website',
  referral: 'Referral',
  walk_in: 'Walk-in',
  google_ads: 'Google Ads',
  tele_caller: 'Tele-caller'
};

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

export default function Leads() {
  const { user, role, permissions } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [leads, setLeads] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'kanban' or 'grid'
  const [viewMode, setViewMode] = useState('kanban');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState('');
  const [activeStageTab, setActiveStageTab] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    source: 'website',
    priority: 'medium',
    assignedTo: ''
  });

  // Reassign Modal
  const [reassignModalLead, setReassignModalLead] = useState(null);
  const [reassignTargetUser, setReassignTargetUser] = useState('');

  // Cancel Reason Modal
  const [pendingCancelMove, setPendingCancelMove] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Quick Activity Modal
  const [activeActivityModal, setActiveActivityModal] = useState(null);
  const [activityNote, setActivityNote] = useState('');

  // Order Received Drag Modal
  const [orderModalLead, setOrderModalLead] = useState(null);

  const canCreate = permissions.leads?.includes('create');
  const canDelete = permissions.leads?.includes('delete') || role === 'super_admin' || role === 'manager';
  const isManagerOrAdmin = role === 'super_admin' || role === 'manager';

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedSource) params.source = selectedSource;
      if (selectedExecutive && isManagerOrAdmin) params.assignedTo = selectedExecutive;

      const res = await api.get('/leads', { params });
      setLeads(res.data.leads || []);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error loading leads');
    } finally {
      setLoading(false);
    }
  }, [selectedSource, selectedExecutive, isManagerOrAdmin, notify]);

  const fetchUsers = async () => {
    if (!isManagerOrAdmin) return;
    try {
      const res = await api.get('/users');
      setUsersList(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchUsers();
  }, [role]);

  // Soft Delete Lead
  const handleDeleteLead = async (leadId, leadName) => {
    const isConfirmed = await confirm({
      title: 'Move Lead to Trash',
      message: `Are you sure you want to soft delete lead "${leadName}"? It can be restored later from System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/leads/${leadId}`);
      notify.success(`Lead "${leadName}" moved to Trash`);
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete lead');
    }
  };

  // Reassign Lead
  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalLead || !reassignTargetUser) return;

    try {
      await api.patch(`/leads/${reassignModalLead._id}/assign`, { assignedTo: reassignTargetUser });
      notify.success(`Reassigned lead "${reassignModalLead.name}" successfully`);
      setReassignModalLead(null);
      setReassignTargetUser('');
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reassign lead');
    }
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadToMove = leads.find(l => l._id === draggableId);
    if (!leadToMove) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    if (destStatus === 'cancelled') {
      setPendingCancelMove({
        leadId: draggableId,
        sourceStatus,
        destStatus,
        lead: leadToMove
      });
      setCancelReasonInput('');
      return;
    }

    if (destStatus === 'won') {
      setOrderModalLead(leadToMove);
      return;
    }

    const updatedLeads = leads.map(l => l._id === draggableId ? { ...l, status: destStatus } : l);
    setLeads(updatedLeads);

    try {
      await api.patch(`/leads/${draggableId}/status`, { status: destStatus });
    } catch (err) {
      setLeads(leads);
      notify.error(err.response?.data?.message || 'Failed to update lead status');
    }
  };

  // Submit Cancel Reason
  const confirmCancelMove = async () => {
    if (!pendingCancelMove || !cancelReasonInput.trim()) {
      notify.error('Please provide a reason for cancellation');
      return;
    }

    const { leadId, destStatus } = pendingCancelMove;
    const updatedLeads = leads.map(l => l._id === leadId ? { ...l, status: destStatus, cancelReason: cancelReasonInput } : l);
    setLeads(updatedLeads);

    try {
      await api.patch(`/leads/${leadId}/status`, {
        status: destStatus,
        cancelReason: cancelReasonInput
      });
      notify.info('Lead marked as cancelled');
    } catch (err) {
      setLeads(leads);
      notify.error(err.response?.data?.message || 'Failed to cancel lead');
    } finally {
      setPendingCancelMove(null);
      setCancelReasonInput('');
    }
  };

  // Submit Add Lead Form
  const handleAddLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leads', newLeadForm);
      notify.success('Lead created successfully!');
      setIsAddModalOpen(false);
      setNewLeadForm({
        name: '',
        company: '',
        phone: '',
        email: '',
        source: 'website',
        priority: 'medium',
        assignedTo: ''
      });
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to create lead');
    }
  };

  // Submit Quick Activity Note
  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    if (!activeActivityModal || !activityNote.trim()) return;

    try {
      await api.post(`/leads/${activeActivityModal.leadId}/activity`, {
        type: activeActivityModal.type,
        description: activityNote
      });
      notify.success(`Logged ${activeActivityModal.type} note!`);
      setActiveActivityModal(null);
      setActivityNote('');
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to log activity');
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter(l => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = l.name?.toLowerCase().includes(q);
      const matchCompany = l.company?.toLowerCase().includes(q);
      const matchPhone = l.phone?.includes(q);
      const matchEmail = l.email?.toLowerCase().includes(q);
      if (!matchName && !matchCompany && !matchPhone && !matchEmail) return false;
    }
    if (selectedPriority && l.priority !== selectedPriority) return false;
    if (activeStageTab !== 'all' && l.status !== activeStageTab) return false;
    return true;
  });

  // Calculate Pipeline Metrics
  const totalCount = leads.length;
  const newCount = leads.filter(l => l.status === 'new').length;
  const contactedCount = leads.filter(l => l.status === 'contacted').length;
  const followUpCount = leads.filter(l => l.status === 'follow_up').length;
  const wonCount = leads.filter(l => l.status === 'won').length;
  const cancelledCount = leads.filter(l => l.status === 'cancelled').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-semibold text-sm shadow-md shadow-red-600/30">
              LD
            </span>
            Leads Management & Pipeline
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
            Track inquiries, update stages, and convert leads into active customer orders
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Grid / Cards</span>
            </button>
          </div>

          {/* Add Lead Button */}
          {canCreate && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-red-600/20 transition flex items-center gap-2"
            >
              <Plus size={16} />
              <span>New Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Total Leads</span>
          <span className="text-xl font-semibold text-slate-900">{totalCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[11px] font-medium text-blue-500 uppercase tracking-wider block">New</span>
          <span className="text-xl font-semibold text-blue-700">{newCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[11px] font-medium text-purple-500 uppercase tracking-wider block">Contacted</span>
          <span className="text-xl font-semibold text-purple-700">{contactedCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[11px] font-medium text-amber-500 uppercase tracking-wider block">Follow-up</span>
          <span className="text-xl font-semibold text-amber-700">{followUpCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[11px] font-medium text-emerald-500 uppercase tracking-wider block">Won</span>
          <span className="text-xl font-semibold text-emerald-700">{wonCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-center col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-rose-500 uppercase tracking-wider block">Cancelled</span>
          <span className="text-xl font-semibold text-rose-700">{cancelledCount}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Real-time Search */}
        <div className="relative flex-1">
          <Search size={16} className="text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by lead name, company, phone, email..."
            className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="walk_in">Walk-in</option>
            <option value="google_ads">Google Ads</option>
            <option value="tele_caller">Tele-caller</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {isManagerOrAdmin && (
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Executives</option>
              {usersList.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto scrollbar-hide pb-0.5">
        <button
          onClick={() => setActiveStageTab('all')}
          className={`px-3.5 py-2 rounded-t-xl text-xs font-medium transition whitespace-nowrap ${
            activeStageTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          All Stages ({filteredLeads.length})
        </button>
        {COLUMNS.map((col) => {
          const cnt = leads.filter(l => l.status === col.id).length;
          return (
            <button
              key={col.id}
              onClick={() => setActiveStageTab(col.id)}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeStageTab === col.id
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{col.title}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeStageTab === col.id ? 'bg-white/20 text-white' : col.badgeClass
              }`}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Board View */}
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading Lead Pipeline...</p>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex md:grid md:grid-cols-3 lg:grid-cols-5 gap-4 items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4">
            {COLUMNS.filter(c => activeStageTab === 'all' || activeStageTab === c.id).map((column) => {
              const columnLeads = filteredLeads.filter(l => l.status === column.id);

              return (
                <div
                  key={column.id}
                  className={`bg-slate-100/90 rounded-2xl border border-slate-200/80 border-t-4 ${column.color} flex flex-col max-h-[calc(100vh-250px)] min-w-[85vw] sm:min-w-[320px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink`}
                >
                  <div className="p-3.5 border-b border-slate-200/60 flex items-center justify-between bg-white rounded-t-xl">
                    <h3 className="font-semibold text-slate-800 text-sm">{column.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${column.headerBg}`}>
                      {columnLeads.length}
                    </span>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-3 space-y-3 overflow-y-auto scrollbar-hide flex-1 min-h-[320px] transition-colors ${
                          snapshot.isDraggingOver ? 'bg-slate-200/60' : ''
                        }`}
                      >
                        {columnLeads.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-200 rounded-xl">
                            No leads in this stage
                          </div>
                        ) : (
                          columnLeads.map((lead, index) => (
                            <Draggable key={lead._id} draggableId={lead._id} index={index}>
                              {(provided, snapshot) => (
                                <LeadCard
                                  lead={lead}
                                  provided={provided}
                                  snapshot={snapshot}
                                  isManagerOrAdmin={isManagerOrAdmin}
                                  canDelete={canDelete}
                                  onDelete={() => handleDeleteLead(lead._id, lead.name)}
                                  onReassign={() => {
                                    setReassignModalLead(lead);
                                    setReassignTargetUser(lead.assignedTo?._id || '');
                                  }}
                                  onLogActivity={(type) => {
                                    setActiveActivityModal({ leadId: lead._id, leadName: lead.name, type });
                                    setActivityNote('');
                                  }}
                                />
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-slate-400 font-bold text-sm">No leads match your current search or filters.</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <LeadCard
                key={lead._id}
                lead={lead}
                isManagerOrAdmin={isManagerOrAdmin}
                canDelete={canDelete}
                onDelete={() => handleDeleteLead(lead._id, lead.name)}
                onReassign={() => {
                  setReassignModalLead(lead);
                  setReassignTargetUser(lead.assignedTo?._id || '');
                }}
                onLogActivity={(type) => {
                  setActiveActivityModal({ leadId: lead._id, leadName: lead.name, type });
                  setActivityNote('');
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Reassign Executive Modal */}
      {reassignModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Reassign Lead</h3>
              <button onClick={() => setReassignModalLead(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select new sales executive for lead: <strong className="text-slate-800">{reassignModalLead.name}</strong>
            </p>
            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <select
                required
                value={reassignTargetUser}
                onChange={(e) => setReassignTargetUser(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="" disabled>Select Executive</option>
                {usersList.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalLead(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition"
                >
                  Reassign Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Reason Modal */}
      {pendingCancelMove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold text-slate-900">Lead Cancellation Reason</h3>
            </div>
            <p className="text-xs text-slate-500">
              Please enter the reason for marking lead <strong className="text-slate-800">{pendingCancelMove.lead?.name}</strong> as cancelled.
            </p>
            <textarea
              rows={3}
              required
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="e.g. Budget constraints, selected competitor..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCancelMove(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel Move
              </button>
              <button
                type="button"
                onClick={confirmCancelMove}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition"
              >
                Submit & Cancel Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                Add New Lead
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newLeadForm.company}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                  placeholder="e.g. Acme Printing Ltd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    placeholder="ramesh@acme.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Source
                  </label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tele_caller">Tele-caller</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={newLeadForm.priority}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {isManagerOrAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assign Executive *
                  </label>
                  <select
                    required
                    value={newLeadForm.assignedTo}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="" disabled>Select Executive</option>
                    {usersList.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Activity Note Modal */}
      {activeActivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                Log {activeActivityModal.type} Note
              </h3>
              <button onClick={() => setActiveActivityModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Record a quick note for lead: <strong className="text-slate-800">{activeActivityModal.leadName}</strong>
            </p>

            <form onSubmit={handleActivitySubmit} className="space-y-4">
              <textarea
                rows={3}
                required
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder={`Describe the outcome of your ${activeActivityModal.type}...`}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveActivityModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition"
                >
                  Log Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={!!orderModalLead}
        initialLead={orderModalLead}
        onClose={() => setOrderModalLead(null)}
        onSuccess={(newOrder) => {
          notify.success(`Order ${newOrder.orderNo} created! Lead converted to Customer & marked as Order Received.`);
          setOrderModalLead(null);
          fetchLeads();
        }}
      />
    </div>
  );
}

function LeadCard({ lead, provided, snapshot, isManagerOrAdmin, canDelete, onDelete, onReassign, onLogActivity }) {
  return (
    <div
      ref={provided?.innerRef}
      {...(provided?.draggableProps || {})}
      {...(provided?.dragHandleProps || {})}
      className={`bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition space-y-3 relative group ${
        snapshot?.isDragging ? 'shadow-2xl ring-2 ring-red-500 rotate-1 z-30' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
            {getInitials(lead.name)}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">{lead.name}</h4>
            <p className="text-slate-500 text-xs truncate">{lead.company || 'Individual Lead'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            to={`/leads/${lead._id}/followup`}
            onClick={(e) => e.stopPropagation()}
            title="Open Follow-up / Lead Profile"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <ArrowRight size={16} />
          </Link>
          {canDelete && (
            <button
              type="button"
              title="Move to Trash"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1 text-xs text-slate-600 pt-0.5">
        {lead.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={14} className="text-slate-400 flex-shrink-0" />
            <span className="font-semibold">{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail size={14} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-md uppercase">
          {SOURCE_LABELS[lead.source] || lead.source}
        </span>
        <span
          className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase ${
            lead.priority === 'high'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : lead.priority === 'medium'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {lead.priority} priority
        </span>
        {lead.assignedTo?.name && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isManagerOrAdmin) onReassign();
            }}
            title={isManagerOrAdmin ? "Click to reassign" : "Assigned executive"}
            className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-md uppercase flex items-center gap-1 hover:bg-blue-100 transition"
          >
            <UserCheck size={12} />
            <span>{lead.assignedTo.name}</span>
          </button>
        )}
      </div>

      {lead.status === 'cancelled' && lead.cancelReason && (
        <p className="text-[11px] text-rose-700 bg-rose-50/80 p-2 rounded-lg italic border border-rose-100">
          "{lead.cancelReason}"
        </p>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span title="Last updated timestamp">{getRelativeTime(lead.updatedAt)}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Log Phone Call"
            onClick={(e) => {
              e.stopPropagation();
              onLogActivity('call');
            }}
            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition"
          >
            <Phone size={14} />
          </button>

          <button
            type="button"
            title="Log WhatsApp Message"
            onClick={(e) => {
              e.stopPropagation();
              onLogActivity('whatsapp');
            }}
            className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition"
          >
            <MessageSquare size={14} />
          </button>

          <button
            type="button"
            title="Log Email"
            onClick={(e) => {
              e.stopPropagation();
              onLogActivity('email');
            }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
          >
            <Mail size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
