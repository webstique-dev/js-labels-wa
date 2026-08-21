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
  MessageCircle,
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
  CheckCircle2,
  Pencil
} from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { initiatePhoneCall, openWhatsApp, openEmail, WhatsAppIcon } from '../utils/contactUtils';
import CustomDatePicker from '../components/ui/DatePicker';
import CustomTimePicker from '../components/ui/TimePicker';

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
    title: 'Rejected',
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

  // Edit Lead Modal State
  const [editLeadModalLead, setEditLeadModalLead] = useState(null);
  const [editLeadForm, setEditLeadForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    source: '',
    priority: 'medium'
  });
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);

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

  // Active Drag Source Status for Visual Target Dimming
  const [activeDragSourceStatus, setActiveDragSourceStatus] = useState(null);

  const getLiveDateStr = () => new Date().toISOString().split('T')[0];
  const getLiveTimeStr = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  // Schedule Follow-up Modal on Drag to follow_up
  const [pendingFollowUpMove, setPendingFollowUpMove] = useState(null);
  const [followUpDateInput, setFollowUpDateInput] = useState(getLiveDateStr());
  const [followUpTimeInput, setFollowUpTimeInput] = useState(getLiveTimeStr());
  const [followUpNotesInput, setFollowUpNotesInput] = useState('');

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
      const res = await api.get('/users?role=caller');
      setUsersList(Array.isArray(res.data) ? res.data.filter(u => u.role === 'caller') : []);
    } catch (err) {
      console.error('Error fetching callers:', err);
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

  // Allowed Kanban Status Transitions Graph
  const ALLOWED_KANBAN_TRANSITIONS = {
    new: ['contacted'],
    contacted: ['follow_up', 'won', 'cancelled'],
    follow_up: ['won', 'cancelled'],
    won: [],
    cancelled: []
  };

  // Drag Start Handler
  const handleDragStart = (start) => {
    setActiveDragSourceStatus(start.source.droppableId);
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result) => {
    setActiveDragSourceStatus(null);
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    // Validate Kanban status transition graph: snap back silently if invalid
    const allowed = ALLOWED_KANBAN_TRANSITIONS[sourceStatus] || [];
    if (!allowed.includes(destStatus)) {
      return;
    }

    const leadToMove = leads.find(l => l._id === draggableId);
    if (!leadToMove) return;

    if (destStatus === 'follow_up') {
      const todayStr = new Date().toISOString().split('T')[0];
      setPendingFollowUpMove({
        leadId: draggableId,
        sourceStatus,
        destStatus,
        lead: leadToMove
      });
      setFollowUpDateInput(todayStr);
      setFollowUpTimeInput(getLiveTimeStr());
      setFollowUpNotesInput('');
      return;
    }

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

  // Confirm Follow-up Schedule on Drag to follow_up
  const confirmFollowUpMove = async (e) => {
    e.preventDefault();
    if (!pendingFollowUpMove || !followUpDateInput || !followUpTimeInput) {
      notify.error('Please select both follow-up date and time');
      return;
    }

    const { leadId, destStatus } = pendingFollowUpMove;
    const updatedLeads = leads.map(l => l._id === leadId ? { ...l, status: destStatus } : l);
    setLeads(updatedLeads);

    try {
      await api.patch(`/leads/${leadId}/status`, {
        status: destStatus,
        followUpDate: followUpDateInput,
        followUpTime: followUpTimeInput,
        notes: followUpNotesInput
      });
      notify.success('Follow-up scheduled & lead moved!');
      fetchLeads();
    } catch (err) {
      setLeads(leads);
      notify.error(err.response?.data?.message || 'Failed to schedule follow-up');
    } finally {
      setPendingFollowUpMove(null);
    }
  };

  // Open Add Lead Modal with Target Stage
  const openAddLeadForStage = (stageId = 'new') => {
    setNewLeadForm({
      name: '',
      company: '',
      phone: '',
      email: '',
      source: '',
      priority: 'medium',
      status: stageId,
      assignedTo: role === 'caller' ? (user?.id || user?._id || '') : ''
    });
    setIsAddModalOpen(true);
  };

  // Submit Add Lead Form
  const handleAddLeadSubmit = async (e) => {
    e.preventDefault();

    // Validate 10-digit phone number
    const cleanPhone = (newLeadForm.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      notify.error('Phone number must be exactly 10 digits');
      return;
    }

    // Validate optional email format
    if (newLeadForm.email && newLeadForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newLeadForm.email.trim())) {
        notify.error('Please enter a valid email address');
        return;
      }
    }

    try {
      const payload = {
        ...newLeadForm,
        name: newLeadForm.name.trim(),
        company: newLeadForm.company ? newLeadForm.company.trim() : undefined,
        phone: cleanPhone,
        email: newLeadForm.email ? newLeadForm.email.trim().toLowerCase() : undefined,
        source: newLeadForm.source || null,
        assignedTo: role === 'caller' ? (user?.id || user?._id || '') : newLeadForm.assignedTo
      };
      await api.post('/leads', payload);
      notify.success('Lead created successfully!');
      setIsAddModalOpen(false);
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to create lead');
    }
  };

  // Open Edit Lead Modal
  const openEditLeadModal = (lead) => {
    setEditLeadModalLead(lead);
    setEditLeadForm({
      name: lead.name || '',
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      priority: lead.priority || 'medium'
    });
  };

  // Submit Edit Lead Form
  const handleEditLeadSubmit = async (e) => {
    e.preventDefault();
    if (!editLeadModalLead) return;

    const cleanPhone = (editLeadForm.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      notify.error('Phone number must be exactly 10 digits');
      return;
    }

    if (editLeadForm.email && editLeadForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editLeadForm.email.trim())) {
        notify.error('Please enter a valid email address');
        return;
      }
    }

    try {
      setIsUpdatingLead(true);
      const payload = {
        name: editLeadForm.name.trim(),
        company: editLeadForm.company ? editLeadForm.company.trim() : '',
        phone: cleanPhone,
        email: editLeadForm.email ? editLeadForm.email.trim().toLowerCase() : '',
        source: editLeadForm.source || null,
        priority: editLeadForm.priority || 'medium'
      };

      await api.put(`/leads/${editLeadModalLead._id}`, payload);
      notify.success('Lead details updated successfully!');
      setEditLeadModalLead(null);
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update lead details');
    } finally {
      setIsUpdatingLead(false);
    }
  };

  // Automatic Background Activity Logging (No modal note popup required)
  const handleAutoLogActivity = async (leadId, leadName, type) => {
    try {
      const descriptions = {
        call: `Initiated phone call with ${leadName}`,
        whatsapp: `Sent WhatsApp message to ${leadName}`,
        email: `Sent email follow-up to ${leadName}`
      };
      const description = descriptions[type] || `Executed ${type} action for ${leadName}`;

      await api.post(`/leads/${leadId}/activity`, {
        type,
        description
      });
      fetchLeads();
    } catch (err) {
      console.error(`Failed to auto-log ${type} activity for ${leadName}:`, err);
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
    <div className="space-y-4 pb-2">

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
              <option value="">All Executive Callers</option>
              {usersList.filter(u => u.role === 'caller').map(u => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`px-3.5 py-2 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition shadow-2xs flex items-center gap-1.5 cursor-pointer ${showFiltersPanel ? 'ring-2 ring-red-500/20 border-red-500' : ''
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
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
              >
                Kanban Board
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          {Array.from({ length: 4 }).map((_, colIdx) => (
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
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex md:grid md:grid-cols-4 lg:grid-cols-4 gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            {COLUMNS.filter(c => c.id !== 'cancelled').map((column) => {
              const columnLeads = filteredLeads.filter(l => l.status === column.id);
              const columnTotalStr = calculateColumnTotal(columnLeads);
              const IconComp = column.icon;

              const isDraggingCard = Boolean(activeDragSourceStatus);
              const isValidTarget = !isDraggingCard || (
                activeDragSourceStatus === column.id || (ALLOWED_KANBAN_TRANSITIONS[activeDragSourceStatus] || []).includes(column.id)
              );
              const isInvalidTarget = isDraggingCard && !isValidTarget;

              return (
                <div
                  key={column.id}
                  className={`rounded-2xl border shadow-2xs p-3 flex flex-col min-w-[85vw] sm:min-w-[280px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink transition-all duration-200 ${isInvalidTarget
                    ? 'bg-rose-50/20 border-dashed border-rose-300 opacity-40 grayscale pointer-events-none'
                    : isDraggingCard && activeDragSourceStatus !== column.id
                      ? 'bg-emerald-50/20 border-emerald-400 ring-2 ring-emerald-500/30'
                      : 'bg-white/70 border-slate-200/80'
                    }`}
                >
                  {/* Column Header */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${column.iconBg}`}>
                        <IconComp size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                          <span className="truncate">{column.title} ({columnLeads.length})</span>
                          {isInvalidTarget && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md shrink-0">
                              Blocked
                            </span>
                          )}
                          {isDraggingCard && isValidTarget && activeDragSourceStatus !== column.id && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
                              Allowed
                            </span>
                          )}
                        </h3>
                        <span className="text-xs text-slate-500 font-medium block">
                          {columnTotalStr}
                        </span>
                      </div>
                    </div>

                    {/* <div className="flex items-center gap-1">
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => openAddLeadForStage(column.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title={`Add Lead in ${column.title}`}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div> */}
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3.5 overflow-y-auto scrollbar-hide flex-1 min-h-[100px] p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80 rounded-xl' : ''
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
                                  onEdit={() => openEditLeadModal(lead)}
                                  onReassign={() => {
                                    setReassignModalLead(lead);
                                    setReassignTargetUser(lead.assignedTo?._id || '');
                                  }}
                                  onLogActivity={(type) => handleAutoLogActivity(lead._id, lead.name, type)}
                                  onCancel={() => {
                                    setPendingCancelMove({
                                      leadId: lead._id,
                                      sourceStatus: lead.status,
                                      destStatus: 'cancelled',
                                      lead: lead
                                    });
                                    setCancelReasonInput('');
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

                  {/* Bottom + Add Lead Action - Only in New stage */}
                  {column.id === 'new' && (
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
                  )}

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
                  onEdit={() => openEditLeadModal(lead)}
                  onReassign={() => {
                    setReassignModalLead(lead);
                    setReassignTargetUser(lead.assignedTo?._id || '');
                  }}
                  onLogActivity={(type) => handleAutoLogActivity(lead._id, lead.name, type)}
                  onCancel={() => {
                    setPendingCancelMove({
                      leadId: lead._id,
                      sourceStatus: lead.status,
                      destStatus: 'cancelled',
                      lead: lead
                    });
                    setCancelReasonInput('');
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
                  <option value="" disabled>Select Executive Caller</option>
                  {usersList.filter(u => u.role === 'caller').map(u => (
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
                <span>Mark Lead as Rejected</span>
              </h3>
              <button onClick={() => setPendingCancelMove(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-normal">
              Please enter the reason for marking lead <strong className="text-slate-800">{pendingCancelMove.lead?.name}</strong> as rejected.
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
                Submit & Reject Lead
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
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  Add New Lead
                </h3>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Create a new sales lead and assign to caller executive
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lead Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newLeadForm.company}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">
                      Phone Number *
                    </label>
                    {/* <span className={`text-[10px] ${newLeadForm.phone.length === 10 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      {newLeadForm.phone.length}/10 digits
                    </span> */}
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {newLeadForm.phone && newLeadForm.phone.length !== 10 && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">
                      Must be exactly 10 digits
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">
                      Email Address
                    </label>
                    {newLeadForm.email && newLeadForm.email.trim() && (
                      <span className={`text-[10px] ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadForm.email.trim()) ? 'text-emerald-600 font-bold' : 'text-rose-500 font-medium'}`}>
                        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadForm.email.trim()) ? 'Valid Email' : 'Invalid Format'}
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    placeholder="john@company.com (Optional)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Source <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                  </label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="">Select Source (Optional)</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tele_caller">Tele-caller</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newLeadForm.priority}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {isManagerOrAdmin ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Executive *
                  </label>
                  <select
                    required
                    value={newLeadForm.assignedTo}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="" disabled>Select Executive Caller</option>
                    {usersList.filter(u => u.role === 'caller').map(u => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Executive
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${user?.name || 'You'} (Assigned to Self)`}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-500 cursor-not-allowed"
                  />
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Create Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Details Modal */}
      {editLeadModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Pencil size={18} className="text-blue-600" />
                  <span>Edit Lead Details</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Update contact information, priority, or source for <strong className="text-slate-800">{editLeadModalLead.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditLeadModalLead(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditLeadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lead Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editLeadForm.name}
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={editLeadForm.company}
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, company: e.target.value })}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editLeadForm.phone}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {editLeadForm.phone && editLeadForm.phone.length !== 10 && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">
                      Must be exactly 10 digits
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editLeadForm.email}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })}
                    placeholder="john@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Source
                  </label>
                  <select
                    value={editLeadForm.source}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="">Select Lead Source</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tele_caller">Tele-caller</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={editLeadForm.priority}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditLeadModalLead(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLead}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdatingLead ? 'Saving Changes...' : 'Save Lead Details'}
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

      {/* Schedule Follow-up Modal on Drag to Follow Up stage */}
      {pendingFollowUpMove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200/90 my-auto max-h-[92vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-bold shrink-0">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">Schedule Follow-up</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Set date, time & notes for this lead</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingFollowUpMove(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-slate-700 space-y-0.5">
              <span className="font-semibold text-slate-900">Lead: {pendingFollowUpMove.lead?.name}</span>
              <p className="text-[11px] text-slate-500 font-normal">
                Moving to <span className="font-bold text-amber-700">Follow Up</span> stage upon confirmation.
              </p>
            </div>

            <form onSubmit={confirmFollowUpMove} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Follow-up Date <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    required
                    selectedDate={followUpDateInput}
                    onChange={(val) => setFollowUpDateInput(val)}
                    placeholder="Select follow-up date"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Follow-up Time <span className="text-red-500">*</span>
                  </label>
                  <CustomTimePicker
                    required
                    selectedTime={followUpTimeInput}
                    onChange={(val) => setFollowUpTimeInput(val)}
                    placeholder="Select follow-up time"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Follow-up Notes <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={followUpNotesInput}
                  onChange={(e) => setFollowUpNotesInput(e.target.value)}
                  placeholder="Add details about what to discuss during the follow-up..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/80 transition"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPendingFollowUpMove(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer text-center"
                >
                  Confirm & Schedule
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
function KanbanLeadCard({ lead, column, provided, snapshot, isManagerOrAdmin, canDelete, onDelete, onEdit, onReassign, onLogActivity, onCancel }) {
  const notify = useNotification();
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
      className={`bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition min-h-[145px] flex flex-col justify-between space-y-3.5 relative group ${snapshot?.isDragging ? 'shadow-2xl ring-2 ring-red-500 rotate-1 z-30' : ''
        }`}
    >
      {/* Lead Card Header: Avatar Initials + Lead Name + Company + Profile Workspace Button */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${column.avatarBg}`}>
            {getInitials(lead.name)}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm leading-snug truncate">
              {lead.name}
            </h4>
            <p className="text-slate-500 text-xs truncate font-medium mt-0.5">
              {lead.company || 'Individual Prospect'}
            </p>
          </div>
        </div>

        {/* View Workspace Profile Button */}
        <Link
          to={`/leads/${lead._id}/followup`}
          onClick={(e) => e.stopPropagation()}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-xl text-[11px] font-semibold transition border border-slate-200/80 hover:border-red-200 inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
          title={`View Workspace for ${lead.name}`}
        >
          <User size={14} className="text-slate-500" />
        </Link>
      </div>

      {/* Main Details Body */}
      <div className="space-y-2 flex-1 flex flex-col justify-center">
        {/* Priority Line */}
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <span>Priority:</span>
          <span className={getPriorityColorClass(lead.priority)}>
            {lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Medium'}
          </span>
        </div>

        {/* Follow-up Today Badge if in Follow-up Column */}
        {isFollowUpStage && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold pt-0.5">
            <Calendar size={14} className="text-rose-500" />
            <span>Follow-up today</span>
          </div>
        )}

        {/* Order Received Green Badge if in Order Received Column */}
        {isWonStage && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Order Received</span>
          </div>
        )}

        {/* Cancelled Reason Box if Cancelled */}
        {lead.status === 'cancelled' && lead.cancelReason && (
          <p className="text-[11px] text-rose-700 bg-rose-50/80 p-2 rounded-lg italic border border-rose-100">
            "{lead.cancelReason}"
          </p>
        )}
      </div>

      {/* Footer Row: Timestamp + Quick Interaction Icons */}
      <div className="pt-2.5 border-t border-slate-100/90 flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-400" title="Time relative">
          {formatLeadTime(lead.createdAt || lead.updatedAt)}
        </span>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-1" ref={menuRef}>
          {/* Call Icon */}
          <button
            type="button"
            title={`Call ${lead.name}`}
            onClick={(e) => {
              e.stopPropagation();
              initiatePhoneCall(lead.phone, lead.name, notify);
              onLogActivity('call');
            }}
            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
          >
            <Phone size={14} />
          </button>

          {/* WhatsApp Icon */}
          <button
            type="button"
            title={`WhatsApp ${lead.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openWhatsApp(lead.phone, lead.name, null, notify);
              onLogActivity('whatsapp');
            }}
            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
          >
            <WhatsAppIcon size={14} className="text-slate-400 hover:text-emerald-600" />
          </button>

          {/* Edit Icon */}
          <button
            type="button"
            title={`Edit details for ${lead.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
          >
            <Pencil size={14} />
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
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg transition"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-xs py-1 animate-scale-up">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <Pencil size={13} />
                  <span>Edit Details</span>
                </button>

                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onReassign();
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <UserCheck size={13} />
                    <span>Assign Executive</span>
                  </button>
                )}

                {['new', 'contacted', 'follow_up'].includes(lead.status) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onCancel();
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                  >
                    <XCircle size={13} />
                    <span>Reject Lead</span>
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
