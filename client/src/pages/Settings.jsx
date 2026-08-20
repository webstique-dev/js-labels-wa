import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Settings as SettingsIcon,
  Save,
  Clock,
  Bell,
  UserCheck,
  FileText,
  AlertTriangle,
  Sparkles,
  Check
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Section 1 Skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>

      {/* Section 2 Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Section 3 Skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [escalationHours, setEscalationHours] = useState({
    warning: 24,
    escalation: 48,
    mdReview: 72
  });

  const [leadDaysStr, setLeadDaysStr] = useState('7, 3, 0');

  const [templates, setTemplates] = useState({
    reorderWhatsapp: '',
    reorderEmail: '',
    escalationEmail: ''
  });

  const [autoAssignmentRule, setAutoAssignmentRule] = useState('round_robin');

  // Live Ascending Validation
  const w = parseInt(escalationHours.warning) || 0;
  const e = parseInt(escalationHours.escalation) || 0;
  const m = parseInt(escalationHours.mdReview) || 0;
  const isEscalationValid = w < e && e < m;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/settings');
        const data = res.data;

        if (data.escalationDelaysHours) {
          setEscalationHours(data.escalationDelaysHours);
        }
        if (data.reminderLeadDays) {
          setLeadDaysStr(data.reminderLeadDays.join(', '));
        }
        if (data.notificationTemplates) {
          setTemplates(data.notificationTemplates);
        }
        if (data.autoAssignmentRule) {
          setAutoAssignmentRule(data.autoAssignmentRule);
        }
      } catch (err) {
        notify.error(err.response?.data?.message || 'Error fetching system settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [notify]);

  // Submit Settings Form
  const handleSubmit = async (eForm) => {
    eForm.preventDefault();

    if (!isEscalationValid) {
      notify.error('Escalation delay hours must be strictly ascending: Warning < Escalation < MD Review');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Save System Settings',
      message: 'Are you sure you want to update global automation rules and notification templates?',
      confirmLabel: 'Save Changes',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      setIsSaving(true);

      const parsedLeadDays = leadDaysStr
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));

      const payload = {
        escalationDelaysHours: {
          warning: w,
          escalation: e,
          mdReview: m
        },
        reminderLeadDays: parsedLeadDays,
        notificationTemplates: templates,
        autoAssignmentRule
      };

      const res = await api.patch('/settings', payload);
      notify.success('System settings saved successfully!');

      if (res.data.escalationDelaysHours) setEscalationHours(res.data.escalationDelaysHours);
      if (res.data.reminderLeadDays) setLeadDaysStr(res.data.reminderLeadDays.join(', '));
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const copyVariable = (varName) => {
    navigator.clipboard.writeText(`{{${varName}}}`);
    notify.success(`Copied placeholder {{${varName}}} to clipboard`);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Automation Rules</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Configure escalation timing thresholds, reminder lead milestones, notification templates, and lead routing strategies</p>
        </div>

        <div className="px-3.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0">
          Super Admin Console
        </div>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Escalation Timing */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock size={16} className="text-slate-500" />
                  <span>1. Follow-up Escalation Delays (Hours)</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Set overdue hours required to trigger stage transitions. Must be strictly ascending.</p>
              </div>

              {!isEscalationValid ? (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200 whitespace-nowrap flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  <span>Warning &lt; Escalation &lt; MD Review Required</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 whitespace-nowrap flex items-center gap-1.5">
                  <Check size={14} />
                  <span>Threshold Hours Valid</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              
              <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-amber-900">Stage 1: Warning Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.warning}
                  onChange={(e) => setEscalationHours({ ...escalationHours, warning: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-amber-700 font-medium block">Default: 24h</span>
              </div>

              <div className="p-4 bg-rose-50/40 border border-rose-200/80 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-rose-900">Stage 2: Escalation Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.escalation}
                  onChange={(e) => setEscalationHours({ ...escalationHours, escalation: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-rose-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-[10px] text-rose-700 font-medium block">Default: 48h</span>
              </div>

              <div className="p-4 bg-purple-50/40 border border-purple-200/80 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-purple-900">Stage 3: MD Review Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.mdReview}
                  onChange={(e) => setEscalationHours({ ...escalationHours, mdReview: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-purple-700 font-medium block">Default: 72h</span>
              </div>

            </div>
          </div>

          {/* Section 2: Reminder Lead Days & Auto-Assignment Rule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Reminder Lead Days */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Bell size={16} className="text-slate-500" />
                  <span>2. Reorder Reminder Lead Milestones (Days)</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Comma-separated list of days before expected reorder date to dispatch reminders</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Milestone Days (Comma Separated)</label>
                <input
                  type="text"
                  required
                  value={leadDaysStr}
                  onChange={(e) => setLeadDaysStr(e.target.value)}
                  placeholder="7, 3, 0"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                />
                <span className="text-[11px] text-slate-400 mt-1.5 block font-normal leading-relaxed">
                  Example: "7, 3, 0" sends automated reminders 7 days prior, 3 days prior, and on the due date.
                </span>
              </div>
            </div>

            {/* Auto Assignment Rule */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck size={16} className="text-slate-500" />
                  <span>3. Lead Auto-Assignment Routing Strategy</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Rule used to automatically assign incoming website and tele-caller leads</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Assignment Strategy</label>
                <select
                  value={autoAssignmentRule}
                  onChange={(e) => setAutoAssignmentRule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="round_robin">Round Robin (Distribute sequentially across all active callers)</option>
                  <option value="load_based">Load Based (Assign to active caller with lowest open lead count)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Section 3: Notification Templates */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText size={16} className="text-slate-500" />
                  <span>4. Notification Templates & Variable Placeholders</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Click any variable chip below to copy to clipboard for template customization</p>
              </div>

              {/* Variable Chips */}
              <div className="flex flex-wrap gap-1.5">
                {['customerName', 'company', 'expectedReorderDate', 'probability', 'followUpId', 'hoursOverdue'].map((varName) => (
                  <button
                    key={varName}
                    type="button"
                    onClick={() => copyVariable(varName)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded-md transition cursor-pointer"
                  >
                    &#123;&#123;{varName}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Reorder Reminder Template</label>
                <textarea
                  rows="2"
                  value={templates.reorderWhatsapp}
                  onChange={(e) => setTemplates({ ...templates, reorderWhatsapp: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-medium focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Reorder Reminder Template</label>
                <textarea
                  rows="3"
                  value={templates.reorderEmail}
                  onChange={(e) => setTemplates({ ...templates, reorderEmail: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-medium focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Escalation Alert Email Template</label>
                <textarea
                  rows="2"
                  value={templates.escalationEmail}
                  onChange={(e) => setTemplates({ ...templates, escalationEmail: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-medium focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || !isEscalationValid}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Configurations...' : 'Save System Settings'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}

