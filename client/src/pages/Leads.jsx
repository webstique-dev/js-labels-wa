import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  X,
  UserPlus,
  PhoneCall,
  Clock,
  FileText,
  XCircle,
  MoreVertical,
  MoreHorizontal,
  SlidersHorizontal,
  Eye,
  Calendar,
  User,
  CheckCircle2
} from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

const COLUMNS = [
  {
    id: 'new',
    title: 'New',
    icon: UserPlus,
    iconBg: 'bg-blue-50 text-blue-600',
    avatarBg: 'bg-blue-100 text-blue-700',
    color: 'border-t-blue-500',
    badgeClass: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'contacted',
    title: 'Contacted',
    icon: PhoneCall,
    iconBg: 'bg-emerald-50 text-emerald-600',
    avatarBg: 'bg-emerald-100 text-emerald-700',
    color: 'border-t-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800'
  },
  {
    id: 'follow_up',
    title: 'Follow-up',
    icon: Clock,
    iconBg: 'bg-amber-50 text-amber-600',
    avatarBg: 'bg-amber-100 text-amber-700',
    color: 'border-t-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800'
  },
  {
    id: 'won',
    title: 'Order Received',
    icon: FileText,
    iconBg: 'bg-purple-50 text-purple-700',
    avatarBg: 'bg-purple-100 text-purple-700',
    color: 'border-t-purple-500',
    badgeClass: 'bg-purple-100 text-purple-800'
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: XCircle,
    iconBg: 'bg-rose-50 text-rose-600',
    avatarBg: 'bg-rose-100 text-rose-700',
    color: 'border-t-rose-500',
    badgeClass: 'bg-rose-100 text-rose-800'
  }
];

const SOURCE_LABELS = {
  website: 'Website',
  referral: 'Referral',
  walk_in: 'Walk-in',
  google_ads: 'Google Ads',
  tele_caller: 'Tele-caller',
  tele_caller_1: 'Tele Caller 1',
  tele_caller_2: 'Tele Caller 2',
  tele_caller_3: 'Tele Caller 3'
};

const getInitials = (name) => {
  if (!name) return 'LD';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const formatLeadTime = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInMinutes < 180) return `${Math.floor(diffInMinutes / 60)} hrs ago`;

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const calculateColumnTotal = (columnLeads) => {
  const sum = columnLeads.reduce((acc, lead) => {
    const val = lead.orderAmount || lead.estimatedValue || lead.amount || 25000;
    return acc + val;
  }, 0);

  if (sum >= 10000000) return `₹ ${(sum / 10000000).toFixed(1)} Cr`;
  if (sum >= 100000) return `₹ ${(sum / 100000).toFixed(1)} Lakhs`;
  if (sum >= 1000) return `₹ ${(sum / 1000).toFixed(1)} K`;
  return `₹ ${sum}`;
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
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    source: 'website',
    priority: 'medium',
    status: 'new',
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

  // Open Add Lead Modal with Target Stage
  const openAddLeadForStage = (stageId = 'new') => {
    setNewLeadForm({
      name: '',
      company: '',
      phone: '',
      email: '',
      source: 'website',
      priority: 'medium',
      status: stageId,
      assignedTo: ''
    });
    setIsAddModalOpen(true);
  };

  // Submit Add Lead Form
  const handleAddLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leads', newLeadForm);
      notify.success('Lead created successfully!');
      setIsAddModalOpen(false);
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

  return (
    <div className="space-y-6 pb-12">
      
      {/* Reference UI Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/50 backdrop-blur-xs p-2 rounded-2xl">
        
        {/* Left: Optional Title / Search Input */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right Action Controls Matching Reference Design */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Dropdown */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="walk_in">Walk-in</option>
            <option value="google_ads">Google Ads</option>
            <option value="tele_caller">Tele-caller</option>
          </select>

          {/* Sales Executive Dropdown */}
          {isManagerOrAdmin && (
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
            >
              <option value="">All Sales Executives</option>
              {usersList.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`px-3.5 py-2 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition shadow-2xs flex items-center gap-1.5 cursor-pointer ${
              showFiltersPanel ? 'ring-2 ring-red-500/20 border-red-500' : ''
            }`}
          >
            <SlidersHorizontal size={14} className="text-slate-500" />
            <span>Filters</span>
          </button>

          {/* Add Lead Red Button */}
          {canCreate && (
            <button
              onClick={() => openAddLeadForStage('new')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {showFiltersPanel && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Priority Filter</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">View Layout</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Kanban Board
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Grid View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {Array.from({ length: 5 }).map((_, colIdx) => (
            <div key={colIdx} className="bg-white/70 rounded-2xl border border-slate-200/80 p-3 space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
              <SkeletonCard className="h-32" />
              <SkeletonCard className="h-32" />
              <SkeletonCard className="h-32" />
            </div>
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex md:grid md:grid-cols-5 lg:grid-cols-5 gap-4 items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4">
            {COLUMNS.map((column) => {
              const columnLeads = filteredLeads.filter(l => l.status === column.id);
              const columnTotalStr = calculateColumnTotal(columnLeads);
              const IconComp = column.icon;

              return (
                <div
                  key={column.id}
                  className="bg-white/70 rounded-2xl border border-slate-200/80 shadow-2xs p-3 flex flex-col max-h-[calc(100vh-180px)] min-w-[85vw] sm:min-w-[300px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink"
                >
                  {/* Column Header */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${column.iconBg}`}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight">
                          {column.title} ({columnLeads.length})
                        </h3>
                        <span className="text-xs text-slate-500 font-medium block">
                          {columnTotalStr}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 overflow-y-auto scrollbar-hide flex-1 min-h-[340px] p-1 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-slate-100/80 rounded-xl' : ''
                        }`}
                      >
                        {columnLeads.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 text-xs font-normal border border-dashed border-slate-200 rounded-xl">
                            No leads in this stage
                          </div>
                        ) : (
                          columnLeads.map((lead, index) => (
                            <Draggable key={lead._id} draggableId={lead._id} index={index}>
                              {(provided, snapshot) => (
                                <KanbanLeadCard
                                  lead={lead}
                                  column={column}
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

                  {/* Bottom + Add Lead Action */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => openAddLeadForStage(column.id)}
                      className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-blue-600 hover:text-blue-700 transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Lead</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-slate-400 font-semibold text-sm">No leads match your current search or filters.</p>
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const col = COLUMNS.find(c => c.id === lead.status) || COLUMNS[0];
              return (
                <KanbanLeadCard
                  key={lead._id}
                  lead={lead}
                  column={col}
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
              );
            })
          )}
        </div>
      )}

      {/* Reassign Executive Modal */}
      {reassignModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Reassign Lead</h3>
              <button onClick={() => setReassignModalLead(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Executive Caller</label>
                <select
                  required
                  value={reassignTargetUser}
                  onChange={(e) => setReassignTargetUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                >
                  <option value="" disabled>Select Executive</option>
                  {usersList.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalLead(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  Confirm Reassign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Lead Reason Modal */}
      {pendingCancelMove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-rose-600 flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>Mark Lead as Cancelled</span>
              </h3>
              <button onClick={() => setPendingCancelMove(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-normal">
              Please enter the reason for marking lead <strong className="text-slate-800">{pendingCancelMove.lead?.name}</strong> as cancelled.
            </p>
            <textarea
              rows={3}
              required
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="e.g. Budget constraints, selected competitor..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCancelMove(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel Move
              </button>
              <button
                type="button"
                onClick={confirmCancelMove}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
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
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                Add New Lead
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Lead Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newLeadForm.company}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                  placeholder="e.g. Apex Traders Pvt. Ltd."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    placeholder="ramesh@apex.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Source
                  </label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tele_caller">Tele-caller</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newLeadForm.priority}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {isManagerOrAdmin && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Assign Executive *
                  </label>
                  <select
                    required
                    value={newLeadForm.assignedTo}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
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
              <h3 className="text-base font-semibold text-slate-900 capitalize">
                Log {activeActivityModal.type} Note
              </h3>
              <button onClick={() => setActiveActivityModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-normal">
              Record a quick note for lead: <strong className="text-slate-800">{activeActivityModal.leadName}</strong>
            </p>

            <form onSubmit={handleActivitySubmit} className="space-y-4">
              <textarea
                rows={3}
                required
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder={`Describe the outcome of your ${activeActivityModal.type}...`}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveActivityModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
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

// Kanban Lead Card matching exact reference design
function KanbanLeadCard({ lead, column, provided, snapshot, isManagerOrAdmin, canDelete, onDelete, onReassign, onLogActivity }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPriorityColorClass = (p) => {
    switch (p) {
      case 'high':
        return 'text-rose-600 font-semibold';
      case 'medium':
        return 'text-amber-600 font-semibold';
      default:
        return 'text-emerald-600 font-semibold';
    }
  };

  const isFollowUpStage = lead.status === 'follow_up';
  const isWonStage = lead.status === 'won';

  return (
    <div
      ref={provided?.innerRef}
      {...(provided?.draggableProps || {})}
      {...(provided?.dragHandleProps || {})}
      className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition space-y-3 relative group ${
        snapshot?.isDragging ? 'shadow-2xl ring-2 ring-red-500 rotate-1 z-30' : ''
      }`}
    >
      {/* Lead Card Header: Avatar Initials + Lead Name + Company */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-2xs ${column.avatarBg}`}>
            {getInitials(lead.name)}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 text-sm leading-snug truncate">
              {lead.name}
            </h4>
            <p className="text-slate-500 text-xs truncate font-normal mt-0.5">
              {lead.company || 'Individual Prospect'}
            </p>
          </div>
        </div>
      </div>

      {/* Source & Priority Line: Source: Website • Priority: High */}
      <div className="text-xs text-slate-500 font-normal">
        <span>Source: {SOURCE_LABELS[lead.source] || lead.source || 'Website'}</span>
        <span className="mx-1.5">•</span>
        <span>Priority: </span>
        <span className={getPriorityColorClass(lead.priority)}>
          {lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Medium'}
        </span>
      </div>

      {/* Follow-up Today Badge if in Follow-up Column */}
      {isFollowUpStage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium pt-0.5">
          <Calendar size={14} className="text-rose-500" />
          <span>Follow-up today</span>
        </div>
      )}

      {/* Order Received Green Badge if in Order Received Column */}
      {isWonStage && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-md text-[11px] font-medium">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span>Order Received</span>
        </div>
      )}

      {/* Cancelled Reason Box if Cancelled */}
      {lead.status === 'cancelled' && lead.cancelReason && (
        <p className="text-[11px] text-rose-700 bg-rose-50/80 p-2 rounded-lg italic border border-rose-100">
          "{lead.cancelReason}"
        </p>
      )}

      {/* Footer Row: Timestamp + Quick Interaction Icons */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span className="font-normal text-slate-400" title="Time relative">
          {formatLeadTime(lead.createdAt || lead.updatedAt)}
        </span>

        {/* Action Buttons based on stage */}
        <div className="flex items-center gap-1.5" ref={menuRef}>
          {/* Quick Contact Options for Follow-up or Standard Cards */}
          {(isFollowUpStage || lead.status === 'contacted' || lead.status === 'new') && (
            <>
              <button
                type="button"
                title="Call Lead"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogActivity('call');
                }}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
              >
                <Phone size={14} />
              </button>

              <button
                type="button"
                title="WhatsApp Lead"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogActivity('whatsapp');
                }}
                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
              >
                <MessageSquare size={14} />
              </button>

              <button
                type="button"
                title="Email Lead"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogActivity('email');
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                <Mail size={14} />
              </button>
            </>
          )}

          {/* Quick View & Order Icons for Order Received Stage */}
          {isWonStage && (
            <>
              <Link
                to={`/leads/${lead._id}/followup`}
                onClick={(e) => e.stopPropagation()}
                title="View Lead 360"
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                <Eye size={14} />
              </Link>
              <Link
                to="/orders"
                onClick={(e) => e.stopPropagation()}
                title="View Orders"
                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
              >
                <FileText size={14} />
              </Link>
            </>
          )}

          {/* User Assign Icon */}
          <button
            type="button"
            title={lead.assignedTo?.name ? `Assigned to ${lead.assignedTo.name}` : "Assign Executive"}
            onClick={(e) => {
              e.stopPropagation();
              if (isManagerOrAdmin) onReassign();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            <User size={14} />
          </button>

          {/* 3-dots Menu Button */}
          <div className="relative">
            <button
              type="button"
              title="More Options"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-slate-400 hover:text-slate-800 rounded-lg transition"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-40 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-xs py-1 animate-scale-up">
                <Link
                  to={`/leads/${lead._id}/followup`}
                  className="px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <ArrowRight size={12} />
                  <span>Open Workspace</span>
                </Link>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReassign();
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <UserCheck size={12} />
                    <span>Reassign</span>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                  >
                    <Trash2 size={12} />
                    <span>Move to Trash</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
