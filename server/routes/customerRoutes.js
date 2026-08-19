const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  getCustomerSummary,
  getCustomerOrders,
  getCustomerTimeline,
  deleteCustomer
} = require('../controllers/customerController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('salesExecutive'), getCustomers);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'customers'; next(); }, getTrash);
router.get('/:id', protect, getCustomerById);
router.get('/:id/summary', protect, getCustomerSummary);
router.get('/:id/orders', protect, getCustomerOrders);
router.get('/:id/timeline', protect, getCustomerTimeline);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteCustomer);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'customers'; next(); }, restoreRecord);

module.exports = router;
