const cron = require('node-cron');
const Settings = require('../models/Settings');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Reminder = require('../models/Reminder');
const notificationService = require('../services/notificationService');

const runReorderReminderCheck = async () => {
  console.log('[JOB] Starting Reorder Reminder Check...');

  try {
    // 1. Get or create singleton Settings
    let settings = await Settings.findOne({ singleton: true });
    if (!settings) {
      settings = await Settings.create({
        reminderLeadDays: [7, 3, 0],
        singleton: true
      });
    }

    const leadDays = settings.reminderLeadDays || [7, 3, 0];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalNotificationsSent = 0;

    // 2. Loop through each milestone leadDay
    for (const leadDay of leadDays) {
      const targetStart = new Date(today.getTime() + leadDay * 24 * 60 * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Find Customers with expectedReorderDate in target range
      const matchingCustomers = await Customer.find({
        expectedReorderDate: { $gte: targetStart, $lte: targetEnd }
      });

      for (const customer of matchingCustomers) {
        // Check duplicate send for this milestoneDay
        const existing = await Reminder.findOne({
          customerId: customer._id,
          milestoneDay: leadDay
        });

        if (!existing) {
          // Send WhatsApp Notification
          if (customer.phone) {
            await notificationService.send('whatsapp', customer.phone, 'reorder_reminder', {
              customerName: customer.name,
              company: customer.company,
              expectedReorderDate: customer.expectedReorderDate,
              leadDayMilestone: leadDay
            });
          }

          // Send Email Notification
          if (customer.email) {
            await notificationService.send('email', customer.email, 'reorder_reminder', {
              customerName: customer.name,
              company: customer.company,
              expectedReorderDate: customer.expectedReorderDate,
              leadDayMilestone: leadDay
            });
          }

          // Create Reminder Record
          await Reminder.create({
            customerId: customer._id,
            type: 'reorder',
            channel: 'whatsapp',
            scheduledAt: targetStart,
            sentAt: new Date(),
            status: 'sent',
            milestoneDay: leadDay,
            probabilityScore: customer.reorderProbability || 50
          });

          totalNotificationsSent++;
        }
      }
    }

    // 3. Recalculate reorderProbability for all customers with expectedReorderDate
    const allRemindersCustomers = await Customer.find({ expectedReorderDate: { $ne: null } });

    for (const cust of allRemindersCustomers) {
      const pastOrdersCount = await Order.countDocuments({ customerId: cust._id });
      const expDate = new Date(cust.expectedReorderDate);
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      let score = 50;

      // +10 if more than 2 past orders
      if (pastOrdersCount > 2) score += 10;

      // +15 if today is within 3 days of expectedReorderDate
      if (Math.abs(diffDays) <= 3) score += 15;

      // -20 if daysOverdue > 14 (diffDays < -14)
      if (diffDays < -14) score -= 20;

      // Clamp between 0 and 100
      const clampedScore = Math.max(0, Math.min(100, score));

      cust.reorderProbability = clampedScore;
      await cust.save();
    }

    console.log(`[JOB] Reorder Reminder Check Completed. Notifications sent: ${totalNotificationsSent}`);
    return { success: true, notificationsSent: totalNotificationsSent };
  } catch (error) {
    console.error('[JOB] Error in runReorderReminderCheck:', error);
    throw error;
  }
};

// Schedule Cron at 8:00 AM daily
const initReorderReminderJob = () => {
  cron.schedule('0 8 * * *', () => {
    runReorderReminderCheck();
  });
  console.log('[CRON] Reorder Reminder Job scheduled (8:00 AM daily).');
};

module.exports = {
  runReorderReminderCheck,
  initReorderReminderJob
};
