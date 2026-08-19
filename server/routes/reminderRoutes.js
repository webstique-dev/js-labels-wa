const express = require('express');
const router = express.Router();
const {
  getReminders,
  getRemindersSummary,
  dismissReminder,
  getRemindersLeaderboard
} = require('../controllers/reminderController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('salesExecutive'), getReminders);
router.get('/summary', protect, applyOwnershipScope('salesExecutive'), getRemindersSummary);
router.patch('/:customerId/dismiss', protect, dismissReminder);
router.get('/leaderboard', protect, allowRoles('super_admin', 'manager'), getRemindersLeaderboard);

module.exports = router;
