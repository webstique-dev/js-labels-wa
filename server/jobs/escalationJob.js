const cron = require('node-cron');
const Settings = require('../models/Settings');
const FollowUp = require('../models/FollowUp');
const Escalation = require('../models/Escalation');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

const STAGE_HIERARCHY = {
  reminder: 1,
  warning: 2,
  escalation: 3,
  md_review: 4,
  reassignment: 5
};

const runEscalationCheck = async () => {
  console.log('[JOB] Starting FollowUp Escalation Check...');

  try {
    // 1. Get or create singleton Settings
    let settings = await Settings.findOne({ singleton: true });
    if (!settings) {
      settings = await Settings.create({
        reminderLeadDays: [7, 3, 0],
        escalationDelaysHours: { warning: 24, escalation: 48, mdReview: 72 },
        singleton: true
      });
    }

    const delays = settings.escalationDelaysHours || { warning: 24, escalation: 48, mdReview: 72 };
    const now = new Date();

    // 2. Find open overdue FollowUps
    const overdueFollowUps = await FollowUp.find({
      status: 'open',
      dueDate: { $lt: now }
    });

    let stageTransitionsCount = 0;

    for (const f of overdueFollowUps) {
      // Find or create Escalation record
      let escalation = await Escalation.findOne({ followUpId: f._id });
      if (!escalation) {
        escalation = await Escalation.create({
          followUpId: f._id,
          stage: 'reminder',
          triggeredAt: now
        });
      }

      const hoursOverdue = Math.floor((now.getTime() - new Date(f.dueDate).getTime()) / (1000 * 60 * 60));

      // Determine new stage
      let newStage = 'reminder';
      if (hoursOverdue >= delays.mdReview) {
        newStage = 'md_review';
      } else if (hoursOverdue >= delays.escalation) {
        newStage = 'escalation';
      } else if (hoursOverdue >= delays.warning) {
        newStage = 'warning';
      }

      // Check if stage actually advanced
      const currentLevel = STAGE_HIERARCHY[escalation.stage] || 1;
      const newLevel = STAGE_HIERARCHY[newStage] || 1;

      if (newLevel > currentLevel) {
        console.log(`[ESCALATION] FollowUp ${f._id} stage advanced from ${escalation.stage} -> ${newStage} (${hoursOverdue}h overdue)`);

        // Stage: escalation -> Notify Managers
        if (newStage === 'escalation') {
          const managers = await User.find({ role: 'manager' });
          for (const mgr of managers) {
            if (mgr.email) {
              await notificationService.send('email', mgr.email, 'followup_escalation_manager', {
                followUpId: f._id,
                hoursOverdue,
                notes: f.notes
              });
            }
          }
        }

        // Stage: md_review -> Notify Super Admins
        if (newStage === 'md_review') {
          const admins = await User.find({ role: 'super_admin' });
          for (const admin of admins) {
            if (admin.email) {
              await notificationService.send('email', admin.email, 'followup_md_review', {
                followUpId: f._id,
                hoursOverdue,
                notes: f.notes
              });
            }
          }
        }

        escalation.stage = newStage;
        await escalation.save();
        stageTransitionsCount++;
      }
    }

    console.log(`[JOB] FollowUp Escalation Check Completed. Stage transitions: ${stageTransitionsCount}`);
    return { success: true, transitions: stageTransitionsCount };
  } catch (error) {
    console.error('[JOB] Error in runEscalationCheck:', error);
    throw error;
  }
};

// Schedule Cron Hourly
const initEscalationJob = () => {
  cron.schedule('0 * * * *', () => {
    runEscalationCheck();
  });
  console.log('[CRON] Escalation Job scheduled (hourly).');
};

module.exports = {
  runEscalationCheck,
  initEscalationJob
};
