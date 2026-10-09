const express = require('express');
const router = express.Router();
const {
  getDimensionForecast,
  getAllDimensionsForecast,
  getDimensionHistory,
  getDimensionsList,
  getCurrentMonthProductsSold,
  exportAllProductionExcel,
  exportProductProductionExcel
} = require('../controllers/productionController');
const { protect } = require('../middleware/auth');

router.get('/forecast', protect, getDimensionForecast);
router.get('/forecast-all', protect, getAllDimensionsForecast);
router.get('/dimension-history', protect, getDimensionHistory);
router.get('/dimensions-list', protect, getDimensionsList);
router.get('/current-month-products', protect, getCurrentMonthProductsSold);
router.get('/export-all', protect, exportAllProductionExcel);
router.get('/export-product', protect, exportProductProductionExcel);

module.exports = router;

