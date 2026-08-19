const express = require('express');
const router = express.Router();
const {
  getReportsOverview,
  getRevenueTrend,
  getTopProducts,
  getOrdersByStatus,
  getTopCustomersReport,
  getExecutivePerformance,
  exportReportCSV
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// Strict RBAC: All endpoints restricted to super_admin and manager ONLY
router.use(protect);
router.use(allowRoles('super_admin', 'manager'));

router.get('/overview', getReportsOverview);
router.get('/revenue-trend', getRevenueTrend);
router.get('/top-products', getTopProducts);
router.get('/orders-by-status', getOrdersByStatus);
router.get('/top-customers', getTopCustomersReport);
router.get('/executive-performance', getExecutivePerformance);
router.get('/export', exportReportCSV);

module.exports = router;
