import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Settings as SettingsIcon, Save, Clock, Bell, UserCheck, FileText, AlertTriangle } from 'lucide-react';

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

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings & Automation Configuration</h1>
          <p className="text-slate-500 text-sm mt-1">Configure escalation timing thresholds, reminder lead milestones, notification templates, and lead routing rules</p>
        </div>

        <div className="px-3.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-wider">
          Super Admin Console
        </div>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading System Configurations...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Escalation Timing */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Clock size={16} className="text-slate-500" />
                  <span>1. Follow-up Escalation Delays (Hours)</span>
                </h3>
                <p className="text-xs text-slate-500">Set overdue hours required to trigger stage transitions. Must be strictly ascending.</p>
              </div>
              {!isEscalationValid && (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 whitespace-nowrap flex items-center gap-1">
                  <AlertTriangle size={14} />
                  <span>Warning &lt; Escalation &lt; MD Review</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage 1: Warning Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.warning}
                  onChange={(e) => setEscalationHours({ ...escalationHours, warning: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage 2: Escalation Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.escalation}
                  onChange={(e) => setEscalationHours({ ...escalationHours, escalation: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage 3: MD Review Delay (Hours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={escalationHours.mdReview}
                  onChange={(e) => setEscalationHours({ ...escalationHours, mdReview: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Reminder Lead Days & Auto-Assignment Rule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Reminder Lead Days */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Bell size={16} className="text-slate-500" />
                  <span>2. Reorder Reminder Lead Milestones (Days)</span>
                </h3>
                <p className="text-xs text-slate-500">Comma-separated list of days before expected reorder date to dispatch reminders</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Milestone Days (Comma Separated)</label>
                <input
                  type="text"
                  required
                  value={leadDaysStr}
                  onChange={(e) => setLeadDaysStr(e.target.value)}
                  placeholder="7, 3, 0"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">e.g. "7, 3, 0" sends reminders 7 days prior, 3 days prior, and on due date.</span>
              </div>
            </div>

            {/* Auto Assignment Rule */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck size={16} className="text-slate-500" />
                  <span>3. Lead Auto-Assignment Routing</span>
                </h3>
                <p className="text-xs text-slate-500">Rule used to automatically assign incoming website and tele-caller leads</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Rule Strategy</label>
                <select
                  value={autoAssignmentRule}
                  onChange={(e) => setAutoAssignmentRule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="round_robin">Round Robin (Distribute sequentially to all active callers)</option>
                  <option value="load_based">Load Based (Assign to caller with lowest open lead count)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Section 3: Notification Templates */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileText size={16} className="text-slate-500" />
                <span>4. Notification Templates & Placeholders</span>
              </h3>
              <p className="text-xs text-slate-500">Supported variables: &#123;&#123;customerName&#125;&#125;, &#123;&#123;company&#125;&#125;, &#123;&#123;expectedReorderDate&#125;&#125;, &#123;&#123;probability&#125;&#125;, &#123;&#123;followUpId&#125;&#125;, &#123;&#123;hoursOverdue&#125;&#125;</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Reorder Reminder Template</label>
                <textarea
                  rows="2"
                  value={templates.reorderWhatsapp}
                  onChange={(e) => setTemplates({ ...templates, reorderWhatsapp: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Reorder Reminder Template</label>
                <textarea
                  rows="3"
                  value={templates.reorderEmail}
                  onChange={(e) => setTemplates({ ...templates, reorderEmail: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Escalation Alert Email Template</label>
                <textarea
                  rows="2"
                  value={templates.escalationEmail}
                  onChange={(e) => setTemplates({ ...templates, escalationEmail: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || !isEscalationValid}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Configurations...' : 'Save Settings & Configurations'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
