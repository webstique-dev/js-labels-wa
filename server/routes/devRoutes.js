/**
 * Dev Manual Job Trigger Routes (Testing / Debugging Only)
 * Allows super_admin users to trigger background cron jobs on demand.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { runReorderReminderCheck } = require('../jobs/reorderReminderJob');
const { runEscalationCheck } = require('../jobs/escalationJob');

// POST /api/dev/run-reminder-job
router.post('/run-reminder-job', protect, allowRoles('super_admin'), async (req, res) => {
  try {
    const result = await runReorderReminderCheck();
    return res.json({ message: 'Reorder reminder check executed successfully', result });
  } catch (error) {
    console.error('Error triggering reorder reminder job:', error);
    return res.status(500).json({ message: 'Error triggering reminder job', error: error.message });
  }
});

// POST /api/dev/run-escalation-job
router.post('/run-escalation-job', protect, allowRoles('super_admin'), async (req, res) => {
  try {
    const result = await runEscalationCheck();
    return res.json({ message: 'FollowUp escalation check executed successfully', result });
  } catch (error) {
    console.error('Error triggering escalation job:', error);
    return res.status(500).json({ message: 'Error triggering escalation job', error: error.message });
  }
});

module.exports = router;
