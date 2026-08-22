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
  Check,
  Copy
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
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
  const [leadDaysStr, setLeadDaysStr] = useState('7, 3, 0');

  const [templates, setTemplates] = useState({
    reorderWhatsapp: '',
    reorderEmail: ''
  });

  const [autoAssignmentRule, setAutoAssignmentRule] = useState('round_robin');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/settings');
        const data = res.data;

        if (data.reminderLeadDays) {
          setLeadDaysStr(data.reminderLeadDays.join(', '));
        }
        if (data.notificationTemplates) {
          setTemplates({
            reorderWhatsapp: data.notificationTemplates.reorderWhatsapp || '',
            reorderEmail: data.notificationTemplates.reorderEmail || ''
          });
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
        reminderLeadDays: parsedLeadDays,
        notificationTemplates: templates,
        autoAssignmentRule
      };

      const res = await api.patch('/settings', payload);
      notify.success('System settings saved successfully!');

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
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Automation Rules</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Configure reminder lead milestones, notification templates, and lead routing strategies</p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Save size={16} />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Section 1: Reminder Lead Days & Auto-Assignment Rule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Reminder Lead Days */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <Bell size={16} className="text-slate-500" />
                  <span>1. Reorder Reminder Lead Milestones (Days)</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Comma-separated list of days before expected reorder date to dispatch reminders</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Milestone Days (Comma Separated)</label>
                <input
                  type="text"
                  required
                  value={leadDaysStr}
                  onChange={(e) => setLeadDaysStr(e.target.value)}
                  placeholder="7, 3, 0"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-[11px] text-slate-400 mt-1.5 block font-normal leading-relaxed">
                  Example: "7, 3, 0" sends automated reminders 7 days prior, 3 days prior, and on the due date.
                </span>
              </div>
            </div>

            {/* Auto Assignment Rule */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck size={16} className="text-slate-500" />
                  <span>2. Lead Auto-Assignment Routing Strategy</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Rule used to automatically assign incoming website and tele-caller leads</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assignment Strategy</label>
                <select
                  value={autoAssignmentRule}
                  onChange={(e) => setAutoAssignmentRule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-2xs"
                >
                  <option value="round_robin">Round Robin (Distribute sequentially across all active callers)</option>
                  <option value="load_based">Load Based (Assign to active caller with lowest open lead count)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Section 2: Notification Templates */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <FileText size={16} className="text-slate-500" />
                  <span>3. Notification Templates & Variable Placeholders</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Click any variable chip below to copy placeholder to clipboard</p>
              </div>

              {/* Variable Chips */}
              <div className="flex flex-wrap gap-1.5">
                {['customerName', 'company', 'expectedReorderDate', 'probability'].map((varName) => (
                  <button
                    key={varName}
                    type="button"
                    onClick={() => copyVariable(varName)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1"
                    title={`Copy {{${varName}}}`}
                  >
                    <span>&#123;&#123;{varName}&#125;&#125;</span>
                    <Copy size={11} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Reorder Reminder Template</label>
                <textarea
                  rows="2"
                  value={templates.reorderWhatsapp}
                  onChange={(e) => setTemplates({ ...templates, reorderWhatsapp: e.target.value })}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Reorder Reminder Template</label>
                <textarea
                  rows="3"
                  value={templates.reorderEmail}
                  onChange={(e) => setTemplates({ ...templates, reorderEmail: e.target.value })}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Submit Action Footer */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Configurations...' : 'Save Settings'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
