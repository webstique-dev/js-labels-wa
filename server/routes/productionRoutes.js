const express = require('express');
const router = express.Router();
const {
  getDimensionForecast,
  getAllDimensionsForecast,
  getDimensionHistory,
  getDimensionsList,
  getCurrentMonthProductsSold
} = require('../controllers/productionController');
const { protect } = require('../middleware/auth');

router.get('/forecast', protect, getDimensionForecast);
router.get('/forecast-all', protect, getAllDimensionsForecast);
router.get('/dimension-history', protect, getDimensionHistory);
router.get('/dimensions-list', protect, getDimensionsList);
router.get('/current-month-products', protect, getCurrentMonthProductsSold);

module.exports = router;

