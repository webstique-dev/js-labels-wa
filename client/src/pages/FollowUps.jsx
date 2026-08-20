import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  Trash2,
  Calendar,
  Filter,
  Search,
  ChevronDown
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

// Dataset matching customer follow-up records for table display
const CUSTOMER_FOLLOWUPS_TABLE = [
  {
    id: 'f1',
    initials: 'RK',
    initialsBg: 'bg-indigo-100 text-indigo-700',
    name: 'Ramesh Kumar',
    company: 'Apex Traders Pvt. Ltd.',
    phone: '98765 43210',
    city: 'Chennai',
    type: 'Follow-up Call',
    dueDate: 'June 12, 2025 (10:00 AM)',
    assignedTo: 'Tele Caller 1',
    probability: 'High (85%)',
    status: 'Open',
    statusBg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'f2',
    initials: 'SP',
    initialsBg: 'bg-purple-100 text-purple-700',
    name: 'Suresh Patel',
    company: 'Shree Enterprises',
    phone: '98765 43211',
    city: 'Mumbai',
    type: 'Send WhatsApp',
    dueDate: 'June 15, 2025 (11:30 AM)',
    assignedTo: 'Tele Caller 2',
    probability: 'High (78%)',
    status: 'Open',
    statusBg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'f3',
    initials: 'MJ',
    initialsBg: 'bg-rose-100 text-rose-700',
    name: 'Meena Joshi',
    company: 'Joshi Traders',
    phone: '98765 43216',
    city: 'Delhi',
    type: 'Overdue Call',
    dueDate: 'May 08, 2025 (6 Days Overdue)',
    assignedTo: 'Tele Caller 2',
    probability: 'High (80%)',
    status: 'Overdue',
    statusBg: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'f4',
    initials: 'AS',
    initialsBg: 'bg-amber-100 text-amber-700',
    name: 'Anita Sharma',
    company: 'Sharma Packaging',
    phone: '98765 43213',
    city: 'Bangalore',
    type: 'Follow-up Call',
    dueDate: 'June 27, 2025 (02:00 PM)',
    assignedTo: 'Tele Caller 2',
    probability: 'Medium (62%)',
    status: 'Open',
    statusBg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'f5',
    initials: 'VS',
    initialsBg: 'bg-blue-100 text-blue-700',
    name: 'Vikram Singh',
    company: 'Precision Prints',
    phone: '98765 43214',
    city: 'Hyderabad',
    type: 'Send Quotation',
    dueDate: 'June 20, 2025 (04:00 PM)',
    assignedTo: 'Tele Caller 3',
    probability: 'Medium (58%)',
    status: 'Open',
    statusBg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'f6',
    initials: 'PV',
    initialsBg: 'bg-emerald-100 text-emerald-700',
    name: 'Pooja Verma',
    company: 'Verma Industries',
    phone: '98765 43212',
    city: 'Pune',
    type: 'Call & Share Catalogue',
    dueDate: 'May 16, 2025 (11:15 AM)',
    assignedTo: 'Tele Caller 1',
    probability: 'High (92%)',
    status: 'Completed',
    statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
];

export default function FollowUps() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [followupsList, setFollowupsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/followups');
      if (Array.isArray(res.data?.followups) && res.data.followups.length > 0) {
        setFollowupsList(res.data.followups);
      } else {
        setFollowupsList(CUSTOMER_FOLLOWUPS_TABLE);
      }
    } catch (err) {
      console.warn('Using fallback follow-ups list:', err);
      setFollowupsList(CUSTOMER_FOLLOWUPS_TABLE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  // Filter rows
  const filteredFollowups = followupsList.filter((item) => {
    const nameMatch = (item.name || item.relatedId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const companyMatch = (item.company || item.relatedId?.company || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || companyMatch;

    if (!matchesSearch) return false;
    if (statusFilter === 'open') return (item.status || '').toLowerCase() === 'open';
    if (statusFilter === 'overdue') return (item.status || '').toLowerCase() === 'overdue';
    if (statusFilter === 'completed') return (item.status || '').toLowerCase() === 'completed';
    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Follow-ups Workspace</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage scheduled customer call interactions, reorder follow-ups, and active pipelines</p>
        </div>
        <div className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold uppercase tracking-wider shrink-0">
          Active Follow-Up Pipeline
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-amber-600">Open Follow-ups</span>
          <span className="text-2xl font-bold text-amber-700 block">4</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-blue-600">Due Today</span>
          <span className="text-2xl font-bold text-blue-700 block">2</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-rose-600">Overdue</span>
          <span className="text-2xl font-bold text-rose-700 block">1</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-medium uppercase text-emerald-600">Completed</span>
          <span className="text-2xl font-bold text-emerald-700 block">1</span>
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', label: 'All Records' },
            { key: 'open', label: 'Open Pipeline' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'completed', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold capitalize rounded-lg transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer or company..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Customer Follow-ups Data Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <th className="p-4">Customer Entity</th>
                  <th className="p-4">Follow-up Type</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Reorder Probability</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFollowups.map((item) => {
                  const custName = item.name || item.relatedId?.name || 'Ramesh Kumar';
                  const custCompany = item.company || item.relatedId?.company || 'Apex Traders Pvt. Ltd.';
                  const initials = item.initials || 'RK';
                  const initialsBg = item.initialsBg || 'bg-indigo-100 text-indigo-700';

                  return (
                    <tr key={item.id || item._id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Customer Entity */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${initialsBg} font-bold text-xs flex items-center justify-center shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{custName}</p>
                            <p className="text-[11px] text-slate-400 font-normal">{custCompany}</p>
                          </div>
                        </div>
                      </td>

                      {/* Follow-up Type */}
                      <td className="p-4 font-semibold text-slate-700">
                        {item.type || 'Follow-up Call'}
                      </td>

                      {/* Due Date */}
                      <td className="p-4 font-medium text-slate-800">
                        {item.dueDate || 'June 12, 2025'}
                      </td>

                      {/* Reorder Probability */}
                      <td className="p-4 font-bold text-emerald-600">
                        {item.probability || 'High (85%)'}
                      </td>

                      {/* Status Pill */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-md uppercase ${item.statusBg || 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {item.status || 'Open'}
                        </span>
                      </td>

                      {/* Action Button: View Followup / Open Call Workspace */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => navigate(`/followups/${item.id || item._id || 'f1'}`)}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-xs shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>View Followup</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}


