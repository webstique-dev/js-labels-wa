import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  ArrowLeft,
  Edit,
  Edit2,
  CheckCircle2,
  Star,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  Clock,
  Plus,
  Trash2,
  FileText,
  FileSpreadsheet,
  Download,
  Bell,
  Truck,
  User,
  ChevronDown,
  X,
  Send,
  UploadCloud,
  FileCheck,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { initiatePhoneCall, openWhatsApp, openEmail, WhatsAppIcon } from '../utils/contactUtils';
import SkeletonFollowUpDetails from '../components/ui/Skeleton';
import NewOrderModal from '../components/NewOrderModal';
import LoadingButton from '../components/ui/LoadingButton';
import {
  getLiveReorderProbability,
  getProbabilityColorClass,
  getProbabilityTextColorClass,
  getProbabilityBadgeClass
} from '../utils/reorderHelper';

export default function FollowUpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);

  // DB State
  const [followUpData, setFollowUpData] = useState(null);
  const [entity, setEntity] = useState(null); // Lead or Customer record
  const [activities, setActivities] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [isStarFav, setIsStarFav] = useState(false);
  const [showMoreActivities, setShowMoreActivities] = useState(false);

  // Form & Action States
  const [isMarkedDone, setIsMarkedDone] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAllFilesModalOpen, setIsAllFilesModalOpen] = useState(false);
  const [show3DotMenu, setShow3DotMenu] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Profile Edit Modal Form State
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    gstNo: '',
    source: 'Website',
    priority: 'medium',
    expectedReorderDate: ''
  });

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);

      let res;
      try {
        res = await api.get(`/followups/${id}`);
      } catch (err) {
        // Fallback 1: Try fetching as Customer record
        try {
          const custRes = await api.get(`/customers/${id}`);
          const actRes = await api.get(`/activities?relatedType=customer&relatedId=${id}`);
          const custData = custRes.data;
          const actData = Array.isArray(actRes.data) ? actRes.data : [];

          res = {
            data: {
              followup: {
                _id: custData._id,
                relatedType: 'customer',
                relatedId: custData._id,
                dueDate: custData.expectedReorderDate,
                status: 'open',
                assignedTo: custData.salesExecutive
              },
              relatedRecord: custData,
              history: actData,
              summaryStats: {
                totalFollowUps: actData.length,
                openFollowUps: 1,
                lastContacted: actData[0]?.createdAt || custData.updatedAt || custData.createdAt,
                customerSince: custData.createdAt,
                reorderProbability: getLiveReorderProbability(custData),
                nextReorderDate: custData.expectedReorderDate
              }
            }
          };
        } catch (custErr) {
          // Fallback 2: Try fetching as Lead record
          const leadRes = await api.get(`/leads/${id}`);
          const actRes = await api.get(`/activities?relatedType=lead&relatedId=${id}`);
          const leadData = leadRes.data;
          const actData = Array.isArray(actRes.data) ? actRes.data : [];

          res = {
            data: {
              followup: {
                _id: leadData._id,
                relatedType: 'lead',
                relatedId: leadData._id,
                dueDate: leadData.followUpDate || leadData.nextFollowUpDate,
                status: leadData.status === 'won' ? 'done' : 'open',
                assignedTo: leadData.assignedTo
              },
              relatedRecord: leadData,
              history: actData,
              summaryStats: {
                totalFollowUps: actData.length,
                openFollowUps: leadData.status === 'won' ? 0 : 1,
                lastContacted: actData[0]?.createdAt || leadData.updatedAt || leadData.createdAt,
                customerSince: leadData.createdAt,
                reorderProbability: getLiveReorderProbability(leadData),
                nextReorderDate: leadData.followUpDate || leadData.nextFollowUpDate
              }
            }
          };
        }
      }

      if (res.data) {
        const { followup, relatedRecord, history, summaryStats } = res.data;
        const targetEntity = relatedRecord || followup?.relatedId || followup;

        setFollowUpData(followup);
        setEntity(targetEntity);
        setActivities(Array.isArray(history) ? history : []);
        setSummaryStats(summaryStats || {});
        setIsMarkedDone(followup?.status === 'done' || targetEntity?.status === 'won');

        const rawSrc = (targetEntity.source || 'website').toLowerCase().replace(/[\s-]+/g, '_');
        const validEnums = ['website', 'referral', 'google_ads', 'tele_caller', 'walk_in', 'other'];
        const normalizedSource = validEnums.includes(rawSrc) ? rawSrc : 'website';

        const rawDate = targetEntity.expectedReorderDate || targetEntity.nextFollowUpDate || followup?.dueDate || targetEntity.followUpDate;
        const formattedDate = (rawDate && !isNaN(new Date(rawDate).getTime()))
          ? new Date(rawDate).toISOString().split('T')[0]
          : '';

        // Populate Edit Form
        setEditForm({
          name: targetEntity.name || '',
          company: targetEntity.company || '',
          phone: targetEntity.phone || '',
          email: targetEntity.email || '',
          address: targetEntity.address || targetEntity.city || '',
          gstNo: targetEntity.gstNo || '',
          source: normalizedSource,
          priority: targetEntity.priority || 'medium',
          expectedReorderDate: formattedDate
        });
      } else {
        notify.error('Follow-up details not found');
      }
    } catch (err) {
      console.error('Error loading follow-up workspace details:', err);
      notify.error('Failed to load follow-up details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchWorkspaceData();
    }
  }, [id]);

  // Mark as Done action
  const handleMarkAsDone = async () => {
    try {
      setIsMarkedDone(true);
      if (followUpData?._id) {
        await api.patch(`/followups/${followUpData._id}`, { status: 'done' });
      }
      if (entity?._id) {
        await api.patch(`/leads/${entity._id}/status`, { status: 'won' });
      }
      notify.success('Follow-up marked as completed!');
      fetchWorkspaceData();
    } catch (err) {
      setIsMarkedDone(false);
      notify.error(err.response?.data?.message || 'Failed to update status');
    }
  };



  // Add Note action
  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    try {
      setIsSavingNote(true);
      const relType = followUpData?.relatedType || (entity?.leadId ? 'customer' : 'lead');
      const relId = entity?._id || (typeof followUpData?.relatedId === 'object' ? followUpData?.relatedId?._id : followUpData?.relatedId) || id;

      try {
        await api.post('/activities', {
          relatedType: relType === 'customer' ? 'customer' : 'lead',
          relatedId: relId,
          type: 'note',
          description: newNoteInput.trim()
        });
      } catch (primaryErr) {
        // Fallback for lead entity
        if (relType === 'lead') {
          await api.post(`/leads/${relId}/activity`, {
            type: 'note',
            description: newNoteInput.trim()
          });
        } else {
          throw primaryErr;
        }
      }

      notify.success('Note added successfully!');
      setNewNoteInput('');
      setIsAddingNote(false);
      fetchWorkspaceData();
    } catch (err) {
      console.error('Failed to save note:', err.response?.data || err);
      notify.error(err.response?.data?.message || 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Edit Note action
  const handleUpdateNote = async (actId) => {
    if (!editingNoteText.trim()) return;
    try {
      await api.patch(`/activities/${actId}`, { description: editingNoteText.trim() });
      notify.success('Note updated');
      setEditingNoteId(null);
      setEditingNoteText('');
      fetchWorkspaceData();
    } catch (err) {
      console.error('Failed to update note:', err.response?.data || err);
      notify.error(err.response?.data?.message || 'Failed to update note');
    }
  };

  // Call & WhatsApp Action Handlers with Automatic Activity Tracking
  const handleCallClick = () => {
    if (!phone || phone === '-') return;
    const relType = followUpData?.relatedType || (entity?.leadId ? 'customer' : 'lead');
    const relId = entity?._id || (typeof followUpData?.relatedId === 'object' ? followUpData?.relatedId?._id : followUpData?.relatedId) || id;
    initiatePhoneCall(phone, name, notify, {
      relatedType: relType === 'customer' ? 'customer' : 'lead',
      relatedId: relId,
      description: `Phone call initiated with ${name}`,
      onSuccess: () => fetchWorkspaceData()
    });
  };

  const handleWhatsAppClick = () => {
    if (!phone || phone === '-') return;
    const relType = followUpData?.relatedType || (entity?.leadId ? 'customer' : 'lead');
    const relId = entity?._id || (typeof followUpData?.relatedId === 'object' ? followUpData?.relatedId?._id : followUpData?.relatedId) || id;
    openWhatsApp(phone, name, null, notify, probabilityScore, nextDateRaw, {
      relatedType: relType === 'customer' ? 'customer' : 'lead',
      relatedId: relId,
      description: `WhatsApp conversation opened for ${name}`,
      onSuccess: () => fetchWorkspaceData()
    });
  };

  // Delete Note / Activity / Document action using custom confirm modal
  const handleDeleteActivity = async (actId, itemType = 'note') => {
    const label = itemType === 'file' ? 'Document' : 'Note';
    const isConfirmed = await confirm({
      title: `Delete ${label}`,
      message: `Are you sure you want to delete this ${label.toLowerCase()}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/activities/${actId}`);
      notify.success(`${label} deleted successfully`);
      fetchWorkspaceData();
    } catch (err) {
      console.error('Failed to delete activity:', err.response?.data || err);
      let errMsg = `Failed to delete ${label.toLowerCase()}`;
      if (typeof err.response?.data?.message === 'string') {
        errMsg = err.response.data.message;
      }
      notify.error(errMsg);
    }
  };

  // Server URL Base for uploaded static files
  const getServerBaseUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return apiUrl.replace(/\/api\/?$/, '');
  };

  const getFileDownloadUrl = (fileUrl) => {
    if (!fileUrl) return '#';
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
    const baseUrl = getServerBaseUrl();
    return `${baseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
  };

  const handleDownloadFile = (file) => {
    if (!file?.fileUrl) {
      notify.error('File link not available');
      return;
    }
    const fullUrl = getFileDownloadUrl(file.fileUrl);
    window.open(fullUrl, '_blank');
  };

  // File Upload action
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploadingFile(true);
      const relType = followUpData?.relatedType || (entity?.leadId ? 'customer' : 'lead');
      const relId = entity?._id || (typeof followUpData?.relatedId === 'object' ? followUpData?.relatedId?._id : followUpData?.relatedId) || id;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('relatedType', relType === 'customer' ? 'customer' : 'lead');
      formData.append('relatedId', relId);
      formData.append('description', `Document uploaded: ${file.name}`);

      await api.post('/activities/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      notify.success(`File "${file.name}" uploaded successfully!`);
      fetchWorkspaceData();
    } catch (err) {
      console.error('Upload error:', err.response?.data || err);
      notify.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Profile Edit Submit
  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      const isCustomer = followUpData?.relatedType === 'customer' || (entity && (entity.leadId || entity.customerType || entity.gstNo !== undefined));
      const relId = entity?._id || (typeof followUpData?.relatedId === 'object' ? followUpData?.relatedId?._id : followUpData?.relatedId) || id;
      const endpoint = isCustomer ? `/customers/${relId}` : `/leads/${relId}`;

      const cleanPhone = (editForm.phone || '').replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        notify.error('Phone number must be exactly 10 digits');
        return;
      }

      if (editForm.email && editForm.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editForm.email.trim())) {
          notify.error('Please enter a valid email address');
          return;
        }
      }

      const payload = {
        name: editForm.name.trim(),
        company: editForm.company ? editForm.company.trim() : '',
        phone: cleanPhone,
        email: editForm.email ? editForm.email.trim().toLowerCase() : '',
        address: editForm.address,
        city: editForm.address,
        gstNo: editForm.gstNo,
        source: editForm.source,
        priority: editForm.priority,
        expectedReorderDate: editForm.expectedReorderDate || undefined,
        nextFollowUpDate: editForm.expectedReorderDate || undefined
      };

      await api.patch(endpoint, payload);

      notify.success('Details updated successfully!');
      setIsEditModalOpen(false);
      fetchWorkspaceData();
    } catch (err) {
      console.error('Error updating profile details:', err);
      let errMsg = 'Failed to update details';
      if (typeof err.response?.data?.message === 'string') {
        errMsg = err.response.data.message;
      } else if (typeof err.response?.data === 'string') {
        errMsg = err.response.data;
      } else if (err.message && typeof err.message === 'string') {
        errMsg = err.message;
      }
      notify.error(errMsg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper formatting utilities
  const getInitials = (name) => {
    if (!name || name === '-') return '-';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} (${timeFormatted})`;
  };

  const getTimeString = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-16 font-sans text-slate-800 bg-slate-50/50 min-h-screen -mt-2 -mx-4 px-4 pt-4 sm:px-6">
        {/* Top Header Bar Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-200 rounded"></div>
            <div className="h-4 bg-slate-200 rounded w-36"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded-xl w-24"></div>
        </div>

        {/* 3-Column Responsive Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* Col 1 Skeleton: Profile Card (col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-full shrink-0"></div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="h-3.5 bg-slate-200 rounded w-full"></div>
                <div className="h-3.5 bg-slate-200 rounded w-5/6"></div>
                <div className="h-3.5 bg-slate-200 rounded w-4/6"></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
            </div>
          </div>

          {/* Col 2 Skeleton: Activity Feed & Timeline (col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 animate-pulse min-h-[460px]">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="h-6 bg-slate-200 rounded w-24"></div>
                <div className="h-6 bg-slate-200 rounded w-16"></div>
                <div className="h-6 bg-slate-200 rounded w-20"></div>
              </div>
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-full shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Col 3 Skeleton: Prediction, Notes, Files (col-span-3) */}
          <div className="lg:col-span-3 md:col-span-2 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-20 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-16 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-slate-500 font-semibold text-base">Follow-up record not found in database.</p>
        <button
          onClick={() => navigate('/followups')}
          className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Back to Follow-ups
        </button>
      </div>
    );
  }

  // Dynamic values extracted directly from DB model (No hardcoded fallback strings!)
  const name = entity.name || '-';
  const company = entity.company || '-';
  const phone = entity.phone || '-';
  const email = entity.email || '-';
  const address = entity.address || entity.city || '-';
  const gstNo = entity.gstNo || '-';
  const status = entity.status || followUpData?.status || '-';
  const source = entity.source || '-';
  const executiveName = entity.assignedTo?.name || entity.salesExecutive?.name || '-';
  const initials = getInitials(name);

  // Target next date calculation & Countdown
  const nextDateRaw = summaryStats?.nextReorderDate || followUpData?.dueDate || entity.expectedReorderDate || entity.followUpDate;
  const nextDateObj = nextDateRaw ? new Date(nextDateRaw) : null;
  const isValidNextDate = nextDateObj && !isNaN(nextDateObj.getTime());

  const monthAbbr = isValidNextDate ? nextDateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '-';
  const dayNum = isValidNextDate ? nextDateObj.getDate() : '-';
  const dayOfWeek = isValidNextDate ? nextDateObj.toLocaleString('en-US', { weekday: 'long' }) : '-';
  const formattedNextDate = isValidNextDate ? formatDateShort(nextDateObj) : '-';

  // Calculate live reorder probability score
  const probabilityScore = getLiveReorderProbability(entity) || summaryStats?.reorderProbability || 0;
  const probabilityLabel = probabilityScore >= 80 ? 'High Urgency' : (probabilityScore >= 50 ? 'Medium' : 'Low');

  // Days countdown calculation
  let daysDiffText = '-';
  if (isValidNextDate) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expStart = new Date(nextDateObj.getFullYear(), nextDateObj.getMonth(), nextDateObj.getDate());
    const diffDays = Math.round((expStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      daysDiffText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
    } else if (diffDays === 0) {
      daysDiffText = 'Due Today';
    } else {
      daysDiffText = `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    }
  }

  // Extract Notes & Files strictly from DB Activities
  const notesList = activities.filter((act) => act.type === 'notes' || act.type === 'note');
  const filesList = activities.filter((act) => act.fileName || act.fileUrl);

  // Filter activities based on tab
  const filteredActivities = activities.filter((act) => {
    if (activeTab === 'calls') return act.type === 'call';
    if (activeTab === 'whatsapp') return act.type === 'whatsapp';
    if (activeTab === 'emails') return act.type === 'email';
    if (activeTab === 'notes') return act.type === 'notes' || act.type === 'note';
    return true;
  });

  const displayedActivities = showMoreActivities ? filteredActivities : filteredActivities.slice(0, 6);

  // Group activities by date string
  const groupedActivities = displayedActivities.reduce((acc, act) => {
    const dateKey = act.createdAt ? formatDateShort(act.createdAt) : '-';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(act);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-16 font-sans text-slate-800 bg-slate-50/50 min-h-screen -mt-2 -mx-4 px-4 pt-4 sm:px-6">

      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            to="/followups"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft size={16} className="text-slate-500" />
            <span>Back to Follow-ups</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Edit Button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <Edit size={14} className="text-slate-500" />
            <span>Edit</span>
          </button>

          {/* Mark as Done Button */}
          {/* <button
            onClick={handleMarkAsDone}
            disabled={isMarkedDone || status === 'won'}
            className={`px-4 py-2 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer text-white ${
              isMarkedDone || status === 'won'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
            }`}
          >
            <CheckCircle2 size={15} />
            <span>{isMarkedDone || status === 'won' ? 'Marked as Done' : 'Mark as Done'}</span>
          </button> */}
        </div>
      </div>

      {/* 2. THREE-COLUMN WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ================= COLUMN 1 (Left - Profile & Follow-up Summary) ================= */}
        <div className="lg:col-span-4 space-y-6">

          {/* Card 1: Profile & Contact Details Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-5">

            {/* Top Avatar + Name + Badges + Actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5 min-w-0">
                {/* Initials Circle */}
                <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs border-2 border-indigo-100">
                  {initials}
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-slate-900 text-base leading-snug truncate">{name}</h2>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[11px] rounded-md capitalize">
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{company}</p>
                </div>
              </div>

              {/* Edit Profile Pencil Action */}
              <div className="shrink-0 text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-1 hover:text-slate-700 transition cursor-pointer"
                  title="Edit Profile"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>

            {/* Tag Badges */}
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              {entity.priority && (
                <span className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-100 font-bold text-[11px] rounded-lg capitalize">
                  {entity.priority} Priority
                </span>
              )}
              {entity.city && (
                <span className="px-2.5 py-1 bg-sky-50 text-sky-600 border border-sky-100 font-bold text-[11px] rounded-lg">
                  {entity.city}
                </span>
              )}
              {!entity.priority && !entity.city && (
                <span className="text-xs text-slate-400 italic">No tags assigned</span>
              )}
            </div>

            {/* Detailed Contact List */}
            <div className="space-y-3.5 text-xs text-slate-600 pt-3 border-t border-slate-100 font-medium">

              {/* Phone Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">{phone}</span>
                </div>
                {phone !== '-' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCallClick}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                      title="Call"
                    >
                      <Phone size={13} />
                    </button>
                    <button
                      onClick={handleWhatsAppClick}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                      title="WhatsApp"
                    >
                      <WhatsAppIcon size={13} className="text-emerald-600" />
                    </button>
                  </div>
                )}
              </div>

              {/* Email Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate max-w-[210px]">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate text-slate-700">{email}</span>
                </div>
                {email !== '-' && (
                  <button
                    onClick={() => openEmail(email, name, null, null, notify)}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer shrink-0"
                    title="Send Email"
                  >
                    <Mail size={13} />
                  </button>
                )}
              </div>

              {/* Address Row */}
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-600 leading-relaxed">{address}</span>
              </div>

              {/* GST Row */}
              <div className="flex items-center gap-2.5 pt-1">
                <CreditCard size={14} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-900 uppercase">
                  {gstNo !== '-' ? `GST: ${gstNo}` : 'GST: -'}
                </span>
              </div>

            </div>

          </div>

          {/* Card 2: Follow-up Summary Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight border-b border-slate-100 pb-2.5">
              Follow-up Summary
            </h3>

            <div className="space-y-3 text-xs font-medium">

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Lead Source</span>
                <span className="font-bold text-slate-900 capitalize">{source}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Sales Executive</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  {executiveName !== '-' && (
                    <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                      {getInitials(executiveName)}
                    </div>
                  )}
                  <span>{executiveName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer Since</span>
                <span className="font-bold text-slate-900">
                  {formatDateShort(summaryStats?.customerSince || entity.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Contacted</span>
                <span className="font-bold text-slate-900">
                  {formatDateTime(summaryStats?.lastContacted || entity.updatedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Follow-ups</span>
                <span className="font-bold text-slate-900">{summaryStats?.totalFollowUps ?? activities.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Open Follow-ups</span>
                <span className="font-bold text-red-600">{summaryStats?.openFollowUps ?? (followUpData?.status === 'open' ? 1 : 0)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-md capitalize">
                  {isMarkedDone ? 'Completed' : status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reorder Probability</span>
                <span className={getProbabilityTextColorClass(probabilityScore)}>
                  {probabilityScore > 0 ? `${probabilityLabel} (${probabilityScore}%)` : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Next Reorder Date</span>
                <span className="font-bold text-slate-900">{formattedNextDate}</span>
              </div>

            </div>
          </div>

        </div>


        {/* ================= COLUMN 2 (Middle - Activity Feed & Timeline) ================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4 min-h-[580px] flex flex-col justify-between">

            <div className="space-y-4">
              {/* Filter Tabs Bar */}
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3 text-xs font-semibold overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'all' || activeTab === 'feed' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                  All Activities
                </button>
                <button
                  onClick={() => setActiveTab('calls')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'calls' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Calls
                </button>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'whatsapp' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => setActiveTab('emails')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'emails' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Emails
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`pb-1 border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'notes' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Notes
                </button>
              </div>

              {/* Timeline Items Stream */}
              {Object.keys(groupedActivities).length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-600">No activities recorded</p>
                  <p>No log records match this filter tab.</p>
                </div>
              ) : (
                <div className="space-y-5 text-xs">
                  {Object.entries(groupedActivities).map(([dateLabel, items]) => (
                    <div key={dateLabel} className="space-y-3">
                      {/* Date Header */}
                      <p className="font-bold text-slate-500 text-[11px] border-b border-slate-100 pb-1">
                        {dateLabel}
                      </p>

                      {/* Items under this date */}
                      <div className="space-y-3">
                        {items.map((act) => {
                          let icon = <Bell size={15} />;
                          let iconBg = 'bg-amber-100 text-amber-600';

                          if (act.type === 'call') {
                            icon = <Phone size={15} />;
                            iconBg = 'bg-orange-100 text-orange-600';
                          } else if (act.type === 'whatsapp') {
                            icon = <WhatsAppIcon size={15} className="text-emerald-600" />;
                            iconBg = 'bg-emerald-50 text-emerald-600';
                          } else if (act.type === 'email') {
                            icon = <Mail size={15} />;
                            iconBg = 'bg-indigo-100 text-indigo-600';
                          } else if (act.type === 'notes' || act.type === 'note') {
                            icon = <FileText size={15} />;
                            iconBg = 'bg-purple-100 text-purple-600';
                          } else if (act.description?.toLowerCase().includes('delivered')) {
                            icon = <Truck size={15} />;
                            iconBg = 'bg-emerald-100 text-emerald-600';
                          } else if (act.description?.toLowerCase().includes('created') || act.description?.toLowerCase().includes('order')) {
                            icon = <FileText size={15} />;
                            iconBg = 'bg-blue-100 text-blue-600';
                          } else if (act.description?.toLowerCase().includes('quotation') || act.description?.toLowerCase().includes('sent')) {
                            icon = <FileSpreadsheet size={15} />;
                            iconBg = 'bg-purple-100 text-purple-600';
                          } else if (act.type === 'reorder_date' || act.description?.toLowerCase().includes('reorder') || act.description?.toLowerCase().includes('pre-order')) {
                            icon = <Calendar size={15} />;
                            iconBg = 'bg-rose-100 text-rose-600';
                          } else if (act.description?.toLowerCase().includes('assigned') || act.type === 'status_change') {
                            icon = <User size={15} />;
                            iconBg = 'bg-emerald-100 text-emerald-600';
                          }

                          const author = act.createdBy?.name || executiveName;
                          const timeStr = getTimeString(act.createdAt);

                          return (
                            <div
                              key={act._id}
                              className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0 shadow-2xs mt-0.5`}>
                                  {icon}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 leading-snug">{act.description}</p>
                                  {act.subText && (
                                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">{act.subText}</p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[11px] text-slate-400 font-medium block">{timeStr}</span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">{author}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View More Activities Button */}
            {filteredActivities.length > 6 && (
              <div className="pt-4 border-t border-slate-100 text-center">
                <button
                  onClick={() => setShowMoreActivities(!showMoreActivities)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  <span>{showMoreActivities ? 'Show Less Activities' : 'View More Activities'}</span>
                  <ChevronDown size={14} className={`transition-transform ${showMoreActivities ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}

          </div>
        </div>


        {/* ================= COLUMN 3 (Right - Next Reorder Prediction UI, Notes, Files) ================= */}
        <div className="lg:col-span-3 space-y-6">

          {/* Card 1: Next Reorder Prediction Card (matching Customer Details) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Next Reorder Prediction</h3>

            {isValidNextDate ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pt-1">
                  {/* Red Date Box */}
                  <div className="w-16 text-center shadow-2xs rounded-xl overflow-hidden border border-slate-200 shrink-0">
                    <div className="bg-red-600 text-white text-[11px] font-bold py-0.5 tracking-wider uppercase">{monthAbbr}</div>
                    <div className="bg-slate-50 text-slate-900 text-xl font-bold py-1">{dayNum}</div>
                    <div className="bg-white text-[9px] text-slate-400 py-0.5 border-t border-slate-100 truncate">{dayOfWeek}</div>
                  </div>

                  <div className="space-y-1 text-xs min-w-0 flex-1">
                    <span className="text-slate-400 font-medium block">Expected Reorder Date</span>
                    <div className="text-slate-900 font-bold text-sm truncate">{formattedNextDate}</div>
                    <div className={`font-semibold text-xs flex items-center gap-1 pt-0.5 ${getProbabilityTextColorClass(probabilityScore)}`}>
                      <span>Probability</span>
                      <span className="font-bold">({probabilityScore}%)</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`${getProbabilityColorClass(probabilityScore)} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, probabilityScore))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Action Buttons Row matching Customer Details (Call & WhatsApp ONLY - Email removed!) */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  {/* Call Button */}
                  <button
                    type="button"
                    onClick={() => phone !== '-' && initiatePhoneCall(phone, name, notify)}
                    disabled={phone === '-'}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                  >
                    <Phone size={14} className="text-emerald-600" />
                    <span>Call</span>
                  </button>

                  {/* WhatsApp Button */}
                  <button
                    type="button"
                    onClick={() => phone !== '-' && openWhatsApp(phone, name, null, notify)}
                    disabled={phone === '-'}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-emerald-600 flex items-center justify-center gap-2 shadow-2xs transition hover:border-slate-300 cursor-pointer"
                  >
                    <WhatsAppIcon size={14} className="text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs font-normal">
                No reorder prediction scheduled
              </div>
            )}

          </div>

          {/* Card 2: Notes Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Notes</h3>
              <button
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Add Note</span>
              </button>
            </div>

            {/* Quick Add Note Form */}
            {isAddingNote && (
              <form onSubmit={handleAddNoteSubmit} className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <textarea
                  rows={3}
                  value={newNoteInput}
                  onChange={(e) => setNewNoteInput(e.target.value)}
                  placeholder="Type note details..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={isSavingNote}
                    loadingText="Saving..."
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Save Note
                  </LoadingButton>
                </div>
              </form>
            )}

            {/* Notes Stream from DB (No Hardcoded Fallbacks!) */}
            {notesList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                <p className="font-bold text-slate-600">No notes recorded</p>
                <p>Click "+ Add Note" to add an entry.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {notesList.map((note) => {
                  const author = note.createdBy?.name || executiveName || '-';
                  const dateStr = note.createdAt ? formatDateTime(note.createdAt) : '-';

                  if (editingNoteId === note._id) {
                    return (
                      <div key={note._id} className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                        <textarea
                          rows={2}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateNote(note._id)}
                            className="px-2 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={note._id} className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-2">
                      <p className="text-slate-800 leading-relaxed font-normal">{note.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-medium border-t border-amber-200/50">
                        <span>{author} • {dateStr}</span>
                        <div className="flex items-center gap-2 text-slate-400">
                          <button
                            onClick={() => { setEditingNoteId(note._id); setEditingNoteText(note.description); }}
                            className="hover:text-slate-700 transition cursor-pointer"
                            title="Edit note"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteActivity(note._id, 'note')}
                            className="hover:text-red-600 transition cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Card 3: Files & Documents Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Files & Documents</h3>

              {/* Hidden Upload Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
                className="text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} />
                <span>{isUploadingFile ? 'Uploading...' : 'Upload'}</span>
              </button>
            </div>

            {/* List of Files from DB (No Hardcoded Fallbacks!) */}
            <div className="space-y-3 text-xs font-medium">
              {filesList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-600">No documents uploaded</p>
                  <p>Click "+ Upload" to attach a file.</p>
                </div>
              ) : (
                filesList.map((file) => {
                  const isPdf = file.fileName?.toLowerCase().endsWith('.pdf');
                  const isExcel = file.fileName?.toLowerCase().endsWith('.xlsx') || file.fileName?.toLowerCase().endsWith('.xls');

                  return (
                    <div key={file._id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${isPdf ? 'bg-rose-50 text-rose-600' : (isExcel ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')} flex items-center justify-center shrink-0`}>
                          {isExcel ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{file.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            {isPdf ? 'PDF' : (isExcel ? 'XLSX' : 'DOC')} • {formatDateShort(file.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Download / View file"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(file._id, 'file')}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* View All Files Footer Link */}
            {filesList.length > 0 && (
              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  onClick={() => setIsAllFilesModalOpen(true)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                >
                  View All Files
                </button>
              </div>
            )}

          </div>

        </div>

      </div>


      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Edit Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditProfileSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">GST Number</label>
                  <input
                    type="text"
                    value={editForm.gstNo}
                    onChange={(e) => setEditForm({ ...editForm, gstNo: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Source</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 font-medium"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tele_caller">Tele Caller</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address / Location</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Next Reorder / Follow-up Date</label>
                <input
                  type="date"
                  value={editForm.expectedReorderDate}
                  onChange={(e) => setEditForm({ ...editForm, expectedReorderDate: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={isSavingProfile}
                  loadingText="Saving..."
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-2xs cursor-pointer"
                >
                  Save Changes
                </LoadingButton>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ALL FILES & DOCUMENTS MODAL */}
      {isAllFilesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">All Uploaded Files & Documents</h3>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
                  {filesList.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsAllFilesModalOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploadingFile}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>{isUploadingFile ? 'Uploading...' : 'Upload File'}</span>
                </button>
                <button
                  onClick={() => setIsAllFilesModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {filesList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-600">No documents uploaded yet</p>
                  <p>Click "Upload File" to attach document files to this record.</p>
                </div>
              ) : (
                filesList.map((file) => {
                  const isPdf = file.fileName?.toLowerCase().endsWith('.pdf');
                  const isExcel = file.fileName?.toLowerCase().endsWith('.xlsx') || file.fileName?.toLowerCase().endsWith('.xls');

                  return (
                    <div
                      key={file._id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl ${
                            isPdf
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : isExcel
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          } flex items-center justify-center shrink-0`}
                        >
                          {isExcel ? <FileSpreadsheet size={18} /> : <FileText size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">{file.fileName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="uppercase font-semibold">{isPdf ? 'PDF Document' : isExcel ? 'Excel Sheet' : 'Document'}</span>
                            <span>•</span>
                            <span>Uploaded on {formatDateShort(file.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                          title="Download / Open file"
                        >
                          <Download size={13} />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(file._id, 'file')}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsAllFilesModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          isOpen={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            notify.success('New order created successfully');
            fetchFollowUpDetails();
          }}
          initialCustomer={entity}
        />
      )}

    </div>
  );
}
