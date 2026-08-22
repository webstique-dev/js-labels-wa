const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getDashboardFunnel,
  getDashboardConversionTrend,
  getDashboardActivityFeed,
  getDashboardAlerts
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/summary', protect, applyOwnershipScope('assignedTo'), getDashboardSummary);
router.get('/funnel', protect, applyOwnershipScope('assignedTo'), getDashboardFunnel);
router.get('/conversion-trend', protect, applyOwnershipScope('assignedTo'), getDashboardConversionTrend);
router.get('/activity-feed', protect, getDashboardActivityFeed);
router.get('/alerts', protect, getDashboardAlerts);

module.exports = router;
