const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrdersSummary,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder
} = require('../controllers/orderController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('salesExecutive'), getOrders);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, getTrash);
router.get('/summary', protect, applyOwnershipScope('salesExecutive'), getOrdersSummary);
router.post('/', protect, createOrder);
router.patch('/:id', protect, updateOrder);
router.patch('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteOrder);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, restoreRecord);

module.exports = router;
