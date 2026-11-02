const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for customer Excel uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    const isExcel =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.match(/\.(xlsx|xls)$/i);

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
    }
  }
});

const {
  getCustomers,
  createCustomer,
  getCustomerById,
  getCustomerSummary,
  getCustomerOrders,
  getCustomerTimeline,
  updateCustomer,
  deleteCustomer,
  exportCustomerExcel,
  exportAllCustomersExcel,
  importCustomersExcel
} = require('../controllers/customerController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

// Base List & Export-All / Import routes (must precede :id)
router.get('/', protect, applyOwnershipScope('salesExecutive'), getCustomers);
router.get('/export-all', protect, applyOwnershipScope('salesExecutive'), exportAllCustomersExcel);
router.post('/import-excel', protect, allowRoles('super_admin', 'manager'), upload.single('file'), importCustomersExcel);
router.post('/', protect, createCustomer);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'customers'; next(); }, getTrash);

// Single Customer routes
router.get('/:id/export-excel', protect, exportCustomerExcel);
router.get('/:id', protect, getCustomerById);
router.get('/:id/summary', protect, getCustomerSummary);
router.get('/:id/orders', protect, getCustomerOrders);
router.get('/:id/timeline', protect, getCustomerTimeline);
router.put('/:id', protect, updateCustomer);
router.patch('/:id', protect, updateCustomer);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteCustomer);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'customers'; next(); }, restoreRecord);

module.exports = router;
