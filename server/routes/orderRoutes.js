const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrdersSummary,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  exportAllOrdersExcel,
  exportSingleOrderExcel
} = require('../controllers/orderController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('salesExecutive'), getOrders);
router.get('/export-all', protect, applyOwnershipScope('salesExecutive'), exportAllOrdersExcel);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, getTrash);
router.get('/summary', protect, applyOwnershipScope('salesExecutive'), getOrdersSummary);
router.get('/:id/export-excel', protect, exportSingleOrderExcel);
router.post('/', protect, createOrder);
router.patch('/:id', protect, updateOrder);
router.patch('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteOrder);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, restoreRecord);

module.exports = router;
