import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import NewOrderModal from '../components/NewOrderModal';
import Button from '../components/ui/Button';
import LoadingButton from '../components/ui/LoadingButton';
import CollapsibleFilterCard from '../components/ui/CollapsibleFilterCard';
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
  Pencil,
  CalendarClock,
  RotateCcw,
  History,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { initiatePhoneCall, openWhatsApp, openEmail, WhatsAppIcon } from '../utils/contactUtils';
import CustomDatePicker from '../components/ui/DatePicker';
import CustomTimePicker from '../components/ui/TimePicker';

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

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
    title: 'Order-Lost',
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

const formatFollowUpBadgeTime = (lead) => {
  if (!lead) return null;
  const rawDate = lead.nextFollowUpDate || lead.dueDate || lead.followUpDate;

  if (!rawDate && !lead.followUpTime) return null;

  try {
    let dt = null;
    if (lead.nextFollowUpDate) {
      dt = new Date(lead.nextFollowUpDate);
    } else if (lead.followUpDate && lead.followUpTime) {
      dt = new Date(`${lead.followUpDate}T${lead.followUpTime}`);
    } else if (rawDate) {
      dt = new Date(rawDate);
    }

    if (!dt || isNaN(dt.getTime())) {
      if (lead.followUpDate) return `${lead.followUpDate} ${lead.followUpTime || ''}`.trim();
      return null;
    }

    const formattedDate = dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let formattedTime = lead.followUpTime;
    if (!formattedTime || formattedTime.includes(':')) {
      formattedTime = dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    return `${formattedDate} at ${formattedTime}`;
  } catch (e) {
    return lead.followUpDate ? `${lead.followUpDate} ${lead.followUpTime || ''}` : null;
  }
};

const getFollowUpStatusInfo = (lead) => {
  if (!lead) return { isUrgent: false, isOverdue: false, label: 'Follow-up Scheduled' };

  let targetDate = null;
  if (lead.nextFollowUpDate) {
    targetDate = new Date(lead.nextFollowUpDate);
  } else if (lead.followUpDate && lead.followUpTime) {
    targetDate = new Date(`${lead.followUpDate}T${lead.followUpTime}`);
  } else if (lead.followUpDate) {
    targetDate = new Date(lead.followUpDate);
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    return { isUrgent: false, isOverdue: false, label: 'Follow-up Scheduled' };
  }

  const now = new Date();
  const diffInMs = targetDate.getTime() - now.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);

  // If follow-up is within 30 minutes (or overdue), mark as urgent (RED)
  if (diffInMinutes <= 30) {
    if (diffInMinutes < 0) {
      return { isUrgent: true, isOverdue: true, label: 'Overdue Follow-up' };
    }
    return { isUrgent: true, isOverdue: false, label: 'Due in < 30 Mins' };
  }

  return { isUrgent: false, isOverdue: false, label: 'Follow-up Scheduled' };
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
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
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
  const [isCreatingLead, setIsCreatingLead] = useState(false);

  // Reassign Modal
  const [reassignModalLead, setReassignModalLead] = useState(null);
  const [reassignTargetUser, setReassignTargetUser] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Cancel Reason Modal
  const [pendingCancelMove, setPendingCancelMove] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Quick Activity Modal
  const [activeActivityModal, setActiveActivityModal] = useState(null);
  const [activityNote, setActivityNote] = useState('');
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

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
  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false);

  // Reschedule Follow-up Modal State (Unlimited Rescheduling)
  const [rescheduleModalLead, setRescheduleModalLead] = useState(null);
  const [rescheduleDateInput, setRescheduleDateInput] = useState(getLiveDateStr());
  const [rescheduleTimeInput, setRescheduleTimeInput] = useState(getLiveTimeStr());
  const [rescheduleReasonInput, setRescheduleReasonInput] = useState('');
  const [rescheduleNotesInput, setRescheduleNotesInput] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);

  // Follow-up Notes Modal State (View, Add, Edit, Delete Notes)
  const [followUpNotesModalLead, setFollowUpNotesModalLead] = useState(null);
  const [newFollowUpNoteInput, setNewFollowUpNoteInput] = useState('');
  const [isAddingFollowUpNote, setIsAddingFollowUpNote] = useState(false);
  const [editingFollowUpNoteId, setEditingFollowUpNoteId] = useState(null);
  const [editingFollowUpNoteText, setEditingFollowUpNoteText] = useState('');
  const [isUpdatingFollowUpNote, setIsUpdatingFollowUpNote] = useState(false);
  const [deletingFollowUpNoteId, setDeletingFollowUpNoteId] = useState(null);

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
    if (!reassignModalLead || !reassignTargetUser || isReassigning) return;

    try {
      setIsReassigning(true);
      await api.patch(`/leads/${reassignModalLead._id}/assign`, { assignedTo: reassignTargetUser });
      notify.success(`Reassigned lead "${reassignModalLead.name}" successfully`);
      setReassignModalLead(null);
      setReassignTargetUser('');
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reassign lead');
    } finally {
      setIsReassigning(false);
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

    // Validate Kanban status transition graph: snap back with toast if invalid
    const allowed = ALLOWED_KANBAN_TRANSITIONS[sourceStatus] || [];
    if (!allowed.includes(destStatus)) {
      if (destStatus === 'cancelled') {
        notify.error('Leads can only be moved to Order-Lost from Contacted or Follow-up stages');
      }
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
      if (!['contacted', 'follow_up'].includes(sourceStatus)) {
        notify.error('Leads can only be moved to Order-Lost from Contacted or Follow-up stages');
        return;
      }
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
    if (!pendingCancelMove || !cancelReasonInput.trim() || isSubmittingCancel) {
      if (!cancelReasonInput.trim()) {
        notify.error('Please provide a reason for marking lead as Order-Lost');
      }
      return;
    }

    const { leadId, destStatus } = pendingCancelMove;
    const updatedLeads = leads.map(l => l._id === leadId ? { ...l, status: destStatus, cancelReason: cancelReasonInput } : l);
    setLeads(updatedLeads);

    try {
      setIsSubmittingCancel(true);
      await api.patch(`/leads/${leadId}/status`, {
        status: destStatus,
        cancelReason: cancelReasonInput
      });
      notify.info('Lead marked as Order-Lost');
      setPendingCancelMove(null);
      setCancelReasonInput('');
      fetchLeads();
    } catch (err) {
      setLeads(leads);
      notify.error(err.response?.data?.message || 'Failed to mark lead as Order-Lost');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Confirm Follow-up Schedule on Drag to follow_up
  const confirmFollowUpMove = async (e) => {
    e.preventDefault();
    if (isSchedulingFollowUp) return;
    if (!pendingFollowUpMove || !followUpDateInput || !followUpTimeInput) {
      notify.error('Please select both follow-up date and time');
      return;
    }

    const { leadId, destStatus } = pendingFollowUpMove;
    const computedNextDate = new Date(`${followUpDateInput}T${followUpTimeInput}`);
    const updatedLeads = leads.map(l => l._id === leadId ? {
      ...l,
      status: destStatus,
      followUpDate: followUpDateInput,
      followUpTime: followUpTimeInput,
      nextFollowUpDate: isNaN(computedNextDate.getTime()) ? new Date() : computedNextDate
    } : l);
    setLeads(updatedLeads);

    try {
      setIsSchedulingFollowUp(true);
      await api.patch(`/leads/${leadId}/status`, {
        status: destStatus,
        followUpDate: followUpDateInput,
        followUpTime: followUpTimeInput,
        notes: followUpNotesInput
      });
      notify.success('Follow-up scheduled successfully & lead moved!');
      setPendingFollowUpMove(null);
      await fetchLeads();
    } catch (err) {
      setLeads(leads);
      notify.error(err.response?.data?.message || 'Failed to schedule follow-up');
    } finally {
      setIsSchedulingFollowUp(false);
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
    if (isCreatingLead) return;

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
      setIsCreatingLead(true);
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
    } finally {
      setIsCreatingLead(false);
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
    if (!editLeadModalLead || isUpdatingLead) return;

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

  // Quick Activity Submit
  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    if (!activeActivityModal || !activityNote.trim() || isSubmittingActivity) return;

    try {
      setIsSubmittingActivity(true);
      await api.post(`/leads/${activeActivityModal.leadId}/activity`, {
        type: activeActivityModal.type || 'note',
        description: activityNote.trim()
      });
      notify.success('Activity logged successfully');
      setActiveActivityModal(null);
      setActivityNote('');
      fetchLeads();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to log activity');
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  // Open Reschedule Follow-up Modal
  const openRescheduleModal = (lead) => {
    setRescheduleModalLead(lead);
    setRescheduleDateInput(lead.followUpDate || getLiveDateStr());
    setRescheduleTimeInput(lead.followUpTime || getLiveTimeStr());
    setRescheduleReasonInput('');
    setRescheduleNotesInput('');
    setShowRescheduleHistory(false);
  };

  // Submit Reschedule Follow-up (Unlimited rescheduling support)
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleModalLead || isSubmittingReschedule) return;

    try {
      setIsSubmittingReschedule(true);
      const res = await api.patch(`/leads/${rescheduleModalLead._id}/reschedule-followup`, {
        followUpDate: rescheduleDateInput,
        followUpTime: rescheduleTimeInput,
        reason: rescheduleReasonInput,
        notes: rescheduleNotesInput
      });

      notify.success('Follow-up rescheduled successfully!');
      setLeads((prev) => prev.map((l) => (l._id === rescheduleModalLead._id ? res.data : l)));
      setRescheduleModalLead(null);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reschedule follow-up');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // Open Follow-up Notes Modal
  const openFollowUpNotesModal = (lead) => {
    setFollowUpNotesModalLead(lead);
    setNewFollowUpNoteInput('');
    setEditingFollowUpNoteId(null);
    setEditingFollowUpNoteText('');
  };

  // Add Follow-up Note
  const handleAddFollowUpNoteSubmit = async (e) => {
    e.preventDefault();
    if (!followUpNotesModalLead || !newFollowUpNoteInput.trim() || isAddingFollowUpNote) return;

    try {
      setIsAddingFollowUpNote(true);
      const res = await api.post(`/leads/${followUpNotesModalLead._id}/followup-notes`, {
        content: newFollowUpNoteInput.trim()
      });

      notify.success('Follow-up note added successfully!');
      setNewFollowUpNoteInput('');
      setFollowUpNotesModalLead(res.data);
      setLeads((prev) => prev.map((l) => (l._id === followUpNotesModalLead._id ? res.data : l)));
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to add follow-up note');
    } finally {
      setIsAddingFollowUpNote(false);
    }
  };

  // Update Follow-up Note
  const handleUpdateFollowUpNote = async (noteId) => {
    if (!followUpNotesModalLead || !editingFollowUpNoteText.trim() || isUpdatingFollowUpNote) return;

    try {
      setIsUpdatingFollowUpNote(true);
      const res = await api.patch(`/leads/${followUpNotesModalLead._id}/followup-notes/${noteId}`, {
        content: editingFollowUpNoteText.trim()
      });

      notify.success('Note updated successfully!');
      setEditingFollowUpNoteId(null);
      setEditingFollowUpNoteText('');
      setFollowUpNotesModalLead(res.data);
      setLeads((prev) => prev.map((l) => (l._id === followUpNotesModalLead._id ? res.data : l)));
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update note');
    } finally {
      setIsUpdatingFollowUpNote(false);
    }
  };

  // Delete Follow-up Note
  const handleDeleteFollowUpNote = async (noteId) => {
    if (!followUpNotesModalLead || deletingFollowUpNoteId) return;

    const isConfirmed = await confirm({
      title: 'Delete Follow-up Note',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      confirmLabel: 'Delete Note',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      setDeletingFollowUpNoteId(noteId);
      const res = await api.delete(`/leads/${followUpNotesModalLead._id}/followup-notes/${noteId}`);

      notify.success('Note deleted successfully');
      setFollowUpNotesModalLead(res.data);
      setLeads((prev) => prev.map((l) => (l._id === followUpNotesModalLead._id ? res.data : l)));
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete note');
    } finally {
      setDeletingFollowUpNoteId(null);
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
      const cleanQ = q.replace(/\D/g, '');

      const matchName = l.name?.toLowerCase().includes(q);
      const matchCompany = l.company?.toLowerCase().includes(q);
      const matchPhone = l.phone && (
        l.phone.includes(q) ||
        (cleanQ.length > 0 && l.phone.replace(/\D/g, '').includes(cleanQ))
      );
      const matchEmail = l.email?.toLowerCase().includes(q);

      if (!matchName && !matchCompany && !matchPhone && !matchEmail) return false;
    }
    if (selectedSource && l.source !== selectedSource) return false;
    if (selectedPriority && l.priority !== selectedPriority) return false;
    if (selectedExecutive && (l.assignedTo?._id || l.assignedTo) !== selectedExecutive) return false;
    if (activeStageTab !== 'all' && l.status !== activeStageTab) return false;

    // Date & Month Filter logic (matching createdAt / updatedAt / followUpDate)
    const rawDate = l.createdAt || l.updatedAt || l.nextFollowUpDate;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        const leadYearMonth = `${yr}-${mo}`;
        const leadFullDate = `${yr}-${mo}-${dy}`;

        if (selectedMonth && leadYearMonth !== selectedMonth) return false;
        if (selectedDate && leadFullDate !== selectedDate) return false;
      }
    } else if (selectedMonth || selectedDate) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-4 pb-2">

      {/* Reference UI Top Header Bar wrapped in CollapsibleFilterCard */}
      {(() => {
        const activeCount = (selectedSource ? 1 : 0) + (selectedExecutive ? 1 : 0) + (searchQuery ? 1 : 0);

        return (
          <CollapsibleFilterCard
            title="Lead Filters & Search"
            activeCount={activeCount}
            onClear={() => {
              setSelectedSource('');
              setSelectedExecutive('');
              setSearchQuery('');
            }}
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Left: Search Input */}
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-full">
                  <Search size={16} className="text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone number..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
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

              {/* Right Action Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Source Dropdown */}
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
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
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
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
                  className={`px-3.5 py-2 bg-slate-50 border border-slate-200/90 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition shadow-2xs flex items-center gap-1.5 cursor-pointer ${showFiltersPanel ? 'ring-2 ring-red-500/20 border-red-500' : ''
                    }`}
                >
                  <SlidersHorizontal size={14} className="text-slate-500" />
                  <span>More Filters</span>
                </button>

                {/* Add Lead Red Button */}
                {canCreate && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => openAddLeadForStage('new')}
                  >
                    Add Lead
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleFilterCard>
        );
      })()}

      {/* Expanded Filter Panel (Responsive Grid layout with Web UI Custom Date Pickers) */}
      {showFiltersPanel && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs items-end">
          
          {/* Month Calendar Filter */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter by Month</label>
            <CustomDatePicker
              allowEmpty={true}
              showMonthYearPicker={true}
              selectedDate={selectedMonth}
              onChange={(val) => {
                setSelectedMonth(val);
                if (val) setSelectedDate('');
              }}
              placeholder="Select month..."
            />
          </div>

          {/* Specific Date Calendar Filter */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter by Specific Date</label>
            <CustomDatePicker
              allowEmpty={true}
              selectedDate={selectedDate}
              onChange={(val) => {
                setSelectedDate(val);
                if (val) setSelectedMonth('');
              }}
              placeholder="Select date..."
            />
          </div>

          {/* Priority Filter */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Priority Filter</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-2xs"
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Layout Toggle */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">View Layout</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Responsive Reset Filters Button */}
          {(selectedMonth || selectedDate || selectedPriority || selectedSource || selectedExecutive) ? (
            <div className="w-full col-span-1 sm:col-span-2 md:col-span-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('');
                  setSelectedDate('');
                  setSelectedPriority('');
                  setSelectedSource('');
                  setSelectedExecutive('');
                }}
                className="w-full h-[40px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <X size={14} />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : null}

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
          <div className="flex gap-4 items-start overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-hide touch-pan-x min-w-full">
            {COLUMNS.map((column) => {
              let columnLeads = filteredLeads.filter(l => l.status === column.id);

              // Automatically position and sort follow-up cards chronologically by scheduled time
              if (column.id === 'follow_up') {
                columnLeads = [...columnLeads].sort((a, b) => {
                  const getTimestamp = (lead) => {
                    if (lead.nextFollowUpDate) {
                      const t = new Date(lead.nextFollowUpDate).getTime();
                      if (!isNaN(t)) return t;
                    }
                    if (lead.followUpDate) {
                      const dt = new Date(`${lead.followUpDate}T${lead.followUpTime || '00:00'}`);
                      const t = dt.getTime();
                      if (!isNaN(t)) return t;
                    }
                    return 9999999999999;
                  };
                  return getTimestamp(a) - getTimestamp(b);
                });
              }

              const IconComp = column.icon;

              const isDraggingCard = Boolean(activeDragSourceStatus);
              const isValidTarget = !isDraggingCard || (
                activeDragSourceStatus === column.id || (ALLOWED_KANBAN_TRANSITIONS[activeDragSourceStatus] || []).includes(column.id)
              );
              const isInvalidTarget = isDraggingCard && !isValidTarget;

              return (
                <div
                  key={column.id}
                  className={`w-80 sm:w-[320px] min-w-[300px] flex-shrink-0 snap-start rounded-2xl border shadow-2xs p-3 flex flex-col transition-all duration-200 ${isInvalidTarget
                    ? 'bg-rose-50/20 border-dashed border-rose-300 opacity-40 grayscale pointer-events-none'
                    : isDraggingCard && activeDragSourceStatus !== column.id
                      ? 'bg-emerald-50/20 border-emerald-400 ring-2 ring-emerald-500/30'
                      : 'bg-white/70 border-slate-200/80'
                    }`}
                >
                  {/* Sticky Column Header */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs flex items-center justify-between mb-3 sticky top-0 z-10">
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
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {column.id === 'new' && (
                        <button
                          type="button"
                          onClick={() => openAddLeadForStage('new')}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Add Lead in New stage"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Droppable Area (Independent Scroll Container per Column) */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3.5 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[140px] scrollbar-hide flex-1 p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80 rounded-xl' : ''
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
                                  onReschedule={() => openRescheduleModal(lead)}
                                  onOpenNotes={() => openFollowUpNotesModal(lead)}
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={Plus}
                        onClick={() => openAddLeadForStage(column.id)}
                        className="w-full text-blue-600 hover:text-blue-700"
                      >
                        Add Lead
                      </Button>
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
                  onReschedule={() => openRescheduleModal(lead)}
                  onOpenNotes={() => openFollowUpNotesModal(lead)}
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isReassigning}
                  onClick={() => setReassignModalLead(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isReassigning}
                  loadingText="Reassigning..."
                >
                  Confirm Reassign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order-Lost Reason Modal */}
      {pendingCancelMove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-rose-600 flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>Mark Lead as Order-Lost</span>
              </h3>
              <button onClick={() => setPendingCancelMove(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-normal">
              Please enter the reason for marking lead <strong className="text-slate-800">{pendingCancelMove.lead?.name}</strong> as Order-Lost.
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSubmittingCancel}
                onClick={() => setPendingCancelMove(null)}
              >
                Cancel Move
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={isSubmittingCancel}
                loadingText="Submitting..."
                onClick={confirmCancelMove}
              >
                Submit Order-Lost
              </Button>
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
                    Assign Executive <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                  </label>
                  <select
                    value={newLeadForm.assignedTo}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="">Unassigned (Optional)</option>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isCreatingLead}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isCreatingLead}
                  loadingText="Creating Lead..."
                  icon={Plus}
                >
                  Create Lead
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUpdatingLead}
                  onClick={() => setEditLeadModalLead(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isUpdatingLead}
                  loadingText="Saving Lead Details..."
                >
                  Save Lead Details
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSubmittingActivity}
                  onClick={() => setActiveActivityModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSubmittingActivity}
                  loadingText="Logging Activity..."
                >
                  Log Activity
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSchedulingFollowUp}
                  onClick={() => setPendingFollowUpMove(null)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSchedulingFollowUp}
                  loadingText="Scheduling..."
                  className="w-full sm:w-auto"
                >
                  Confirm & Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Follow-up Modal (Unlimited Rescheduling with History preservation) */}
      {rescheduleModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200/90 my-auto max-h-[92vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-bold shrink-0">
                  <CalendarClock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">Reschedule Follow-up</h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Update scheduled date, time & keep past schedule history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Schedule Summary */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 truncate">
                  Lead: {rescheduleModalLead.name} {rescheduleModalLead.company ? `(${rescheduleModalLead.company})` : ''}
                </span>
                {rescheduleModalLead.rescheduleHistory?.length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full shrink-0">
                    Rescheduled {rescheduleModalLead.rescheduleHistory.length}x
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-900 font-medium">
                Current Scheduled: <strong>{formatFollowUpBadgeTime(rescheduleModalLead) || (rescheduleModalLead.followUpDate ? `${rescheduleModalLead.followUpDate} ${rescheduleModalLead.followUpTime || ''}` : 'Not scheduled')}</strong>
              </p>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    New Follow-up Date <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    required
                    selectedDate={rescheduleDateInput}
                    onChange={(val) => setRescheduleDateInput(val)}
                    placeholder="Select new date"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    New Follow-up Time <span className="text-red-500">*</span>
                  </label>
                  <CustomTimePicker
                    required
                    selectedTime={rescheduleTimeInput}
                    onChange={(val) => setRescheduleTimeInput(val)}
                    placeholder="Select new time"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Reschedule Reason <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={rescheduleReasonInput}
                  onChange={(e) => setRescheduleReasonInput(e.target.value)}
                  placeholder="e.g. Client requested callback at 5 PM, Decision maker busy..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/80 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Add Discussion Note <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={rescheduleNotesInput}
                  onChange={(e) => setRescheduleNotesInput(e.target.value)}
                  placeholder="Record client requirements, discussion notes, or next steps..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/80 transition"
                />
              </div>

              {/* Collapsible Previous Schedule History */}
              {rescheduleModalLead.rescheduleHistory && rescheduleModalLead.rescheduleHistory.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleHistory(!showRescheduleHistory)}
                    className="w-full p-2.5 px-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <History size={14} className="text-slate-500" />
                      <span>Previous Schedule History ({rescheduleModalLead.rescheduleHistory.length})</span>
                    </span>
                    {showRescheduleHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showRescheduleHistory && (
                    <div className="p-3 pt-1 space-y-2 border-t border-slate-200/80 max-h-40 overflow-y-auto scrollbar-hide">
                      {rescheduleModalLead.rescheduleHistory.slice().reverse().map((entry, idx) => {
                        const dateFormatted = entry.previousDueDate
                          ? formatDateTime(entry.previousDueDate)
                          : `${entry.previousDate || '-'} ${entry.previousTime || ''}`;
                        const newDateFormatted = entry.newDueDate
                          ? formatDateTime(entry.newDueDate)
                          : `${entry.newDate || '-'} ${entry.newTime || ''}`;
                        const byUser = entry.rescheduledBy?.name || 'Executive';
                        const timeAgo = formatLeadTime(entry.rescheduledAt);

                        return (
                          <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200/70 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span className="text-slate-500 line-through truncate max-w-[140px]">{dateFormatted}</span>
                              <span className="text-amber-700 font-bold">→ {newDateFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>By {byUser} • {timeAgo}</span>
                              {entry.reason && (
                                <span className="text-slate-600 italic truncate max-w-[150px]">
                                  "{entry.reason}"
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSubmittingReschedule}
                  onClick={() => setRescheduleModalLead(null)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSubmittingReschedule}
                  loadingText="Rescheduling..."
                  className="w-full sm:w-auto"
                >
                  Save & Reschedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Notes Modal (View, Add, Edit, Delete Notes with Timestamps) */}
      {followUpNotesModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200/90 my-auto max-h-[92vh] overflow-y-auto scrollbar-hide flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center font-bold shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">Follow-up Notes</h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Record client responses, discussion notes, requirements & next steps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpNotesModalLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Lead Header Preview */}
            <div className="p-3 bg-purple-50/50 border border-purple-200/60 rounded-xl text-xs text-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">{followUpNotesModalLead.name}</span>
                <p className="text-[11px] text-slate-500">
                  {followUpNotesModalLead.company || 'Individual Prospect'} • {followUpNotesModalLead.phone}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                  {(followUpNotesModalLead.followUpNotesList?.length || (followUpNotesModalLead.followUpNotes ? 1 : 0))} Notes
                </span>
              </div>
            </div>

            {/* Add New Note Form */}
            <form onSubmit={handleAddFollowUpNoteSubmit} className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">
                Add Discussion / Follow-up Note
              </label>
              <textarea
                rows={3}
                required
                value={newFollowUpNoteInput}
                onChange={(e) => setNewFollowUpNoteInput(e.target.value)}
                placeholder="Record client response, requirements discussed, concerns, or next steps..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/60 transition"
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="xs"
                  loading={isAddingFollowUpNote}
                  loadingText="Adding Note..."
                  icon={Plus}
                >
                  Save Note
                </Button>
              </div>
            </form>

            {/* Notes List */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-64 scrollbar-hide pt-1">
              <h4 className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Recorded Notes History</span>
              </h4>

              {(!followUpNotesModalLead.followUpNotesList || followUpNotesModalLead.followUpNotesList.length === 0) && !followUpNotesModalLead.followUpNotes ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No notes recorded yet. Add what was discussed with the client above.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {/* Notes List Stream */}
                  {followUpNotesModalLead.followUpNotesList && followUpNotesModalLead.followUpNotesList.length > 0 ? (
                    followUpNotesModalLead.followUpNotesList.slice().reverse().map((note) => {
                      const author = note.createdBy?.name || user?.name || 'Executive';
                      const isEditing = editingFollowUpNoteId === note._id;

                      if (isEditing) {
                        return (
                          <div key={note._id} className="p-3 bg-purple-50 border border-purple-300 rounded-xl space-y-2">
                            <textarea
                              rows={2}
                              value={editingFollowUpNoteText}
                              onChange={(e) => setEditingFollowUpNoteText(e.target.value)}
                              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFollowUpNoteId(null);
                                  setEditingFollowUpNoteText('');
                                }}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isUpdatingFollowUpNote}
                                onClick={() => handleUpdateFollowUpNote(note._id)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition"
                              >
                                {isUpdatingFollowUpNote ? 'Saving...' : 'Save Note'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={note._id} className="p-3 bg-purple-50/40 border border-purple-200/70 rounded-xl space-y-1.5 hover:bg-purple-50/70 transition">
                          <p className="text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-purple-200/50">
                            <span>{author} • {formatDateTime(note.createdAt)}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFollowUpNoteId(note._id);
                                  setEditingFollowUpNoteText(note.content);
                                }}
                                className="text-slate-400 hover:text-purple-600 transition cursor-pointer"
                                title="Edit Note"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFollowUpNote(note._id)}
                                className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Legacy single note display fallback
                    <div className="p-3 bg-purple-50/40 border border-purple-200/70 rounded-xl space-y-1.5">
                      <p className="text-slate-800 leading-relaxed font-medium">{followUpNotesModalLead.followUpNotes}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-purple-200/50">
                        <span>Lead Note</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFollowUpNotesModalLead(null)}
              >
                Done
              </Button>
            </div>
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

// Kanban Lead Card matching exact reference design with Reschedule & Follow-up Notes
function KanbanLeadCard({
  lead,
  column,
  provided,
  snapshot,
  isManagerOrAdmin,
  canDelete,
  onDelete,
  onEdit,
  onReschedule,
  onOpenNotes,
  onReassign,
  onLogActivity,
  onCancel
}) {
  const notify = useNotification();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

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
  const followUpStatusInfo = isFollowUpStage ? getFollowUpStatusInfo(lead) : { isUrgent: false, isOverdue: false, label: '' };
  const notesCount = lead.followUpNotesList?.length || (lead.followUpNotes ? 1 : 0);

  return (
    <div
      ref={provided?.innerRef}
      {...(provided?.draggableProps || {})}
      {...(provided?.dragHandleProps || {})}
      className={`bg-white p-4.5 sm:p-5 rounded-2xl border shadow-2xs hover:shadow-md transition min-h-[145px] flex flex-col justify-between space-y-3.5 relative group ${
        followUpStatusInfo.isUrgent
          ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/10'
          : 'border-slate-200/90'
      } ${snapshot?.isDragging ? 'shadow-2xl ring-2 ring-red-500 rotate-1 z-30' : ''
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
        {/* Phone Number Row */}
        <div className="text-xs text-slate-800 font-semibold flex items-center gap-1.5">
          <Phone size={13} className="text-emerald-600 shrink-0" />
          <a
            href={lead.phone ? `tel:+91${lead.phone.toString().replace(/\D/g, '')}` : '#'}
            onClick={(e) => {
              e.stopPropagation();
              if (lead.phone) {
                initiatePhoneCall(lead.phone, lead.name, notify);
                onLogActivity('call');
              }
            }}
            className="hover:underline text-slate-900 font-bold tracking-wide cursor-pointer"
            title={`Call ${lead.name} (${lead.phone})`}
          >
            {lead.phone || '-'}
          </a>
        </div>

        {/* Priority Line */}
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <span>Priority:</span>
          <span className={getPriorityColorClass(lead.priority)}>
            {lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Medium'}
          </span>
        </div>

        {/* Scheduled Follow-up Date & Time Badge */}
        {isFollowUpStage && (
          <div className={`flex flex-col gap-1.5 text-xs p-2.5 sm:p-3 rounded-xl font-semibold w-full mt-1 transition-all ${
            followUpStatusInfo.isUrgent
              ? 'bg-rose-50 border border-rose-300 text-rose-950 shadow-xs ring-1 ring-rose-400/30'
              : 'bg-amber-50/90 border border-amber-200/90 text-amber-900 shadow-2xs'
          }`}>
            <div className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${
              followUpStatusInfo.isUrgent ? 'text-rose-700' : 'text-amber-700'
            }`}>
              <span className="flex items-center gap-1">
                {followUpStatusInfo.isUrgent ? (
                  <AlertTriangle size={12} className="text-rose-600 shrink-0 animate-bounce" />
                ) : (
                  <Calendar size={12} className="text-amber-600 shrink-0" />
                )}
                <span>{followUpStatusInfo.label}</span>
              </span>
              {lead.rescheduleHistory?.length > 0 && (
                <span className="text-[9px] font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md shrink-0">
                  Rescheduled {lead.rescheduleHistory.length}x
                </span>
              )}
            </div>

            {/* Latest Scheduled Date and Time */}
            <div className={`text-xs font-bold leading-tight flex items-center justify-between gap-1.5 ${
              followUpStatusInfo.isUrgent ? 'text-rose-950 font-extrabold' : 'text-amber-950'
            }`}>
              <span className="truncate">
                {formatFollowUpBadgeTime(lead) || (lead.followUpDate ? `${lead.followUpDate} ${lead.followUpTime || ''}` : 'Follow-up Scheduled')}
              </span>
              <Clock size={12} className={followUpStatusInfo.isUrgent ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'} />
            </div>

            {/* Latest Follow-up Note snippet */}
            {lead.followUpNotes && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNotes && onOpenNotes();
                }}
                className={`flex items-start gap-1.5 text-[11px] font-normal pt-1.5 border-t mt-0.5 cursor-pointer hover:underline ${
                  followUpStatusInfo.isUrgent ? 'text-rose-800 border-rose-200/70' : 'text-slate-700 border-amber-200/60'
                }`}
                title="Click to view & edit follow-up notes"
              >
                <FileText size={11} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="line-clamp-2 italic">
                  "{lead.followUpNotes}"
                </p>
              </div>
            )}

            {/* Quick In-Card Actions: Reschedule & Notes */}
            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/50 mt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReschedule && onReschedule();
                }}
                className="flex-1 py-1 px-2 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300/80 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
              >
                <CalendarClock size={11} className="text-amber-700" />
                <span>Reschedule</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNotes && onOpenNotes();
                }}
                className="flex-1 py-1 px-2 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
              >
                <MessageSquare size={11} className="text-purple-700" />
                <span>Notes {notesCount ? `(${notesCount})` : ''}</span>
              </button>
            </div>
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
        <div className="flex items-center gap-1">
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
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              title="More Options"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg transition cursor-pointer"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-xs py-1 animate-scale-up">
                {/* Reschedule Follow-up Option */}
                {['follow_up', 'contacted', 'new'].includes(lead.status) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onReschedule && onReschedule();
                    }}
                    className="w-full px-3 py-2 text-left text-amber-800 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <CalendarClock size={13} className="text-amber-600 shrink-0" />
                    <span>Reschedule Follow-up</span>
                  </button>
                )}

                {/* Follow-up Notes Option */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onOpenNotes && onOpenNotes();
                  }}
                  className="w-full px-3 py-2 text-left text-purple-800 hover:bg-purple-50 flex items-center gap-2 font-medium cursor-pointer"
                >
                  <MessageSquare size={13} className="text-purple-600 shrink-0" />
                  <span>Follow-up Notes {notesCount ? `(${notesCount})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
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
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <UserCheck size={13} />
                    <span>Assign Executive</span>
                  </button>
                )}

                {['contacted', 'follow_up'].includes(lead.status) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onCancel();
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <XCircle size={13} />
                    <span>Mark as Order-Lost</span>
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
