const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for order Excel uploads in memory
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
  getOrders,
  getOrdersSummary,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  exportAllOrdersExcel,
  exportSingleOrderExcel,
  importOrdersExcel
} = require('../controllers/orderController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('salesExecutive'), getOrders);
router.get('/export-all', protect, applyOwnershipScope('salesExecutive'), exportAllOrdersExcel);
router.post('/import-excel', protect, allowRoles('super_admin', 'manager'), upload.single('file'), importOrdersExcel);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, getTrash);
router.get('/summary', protect, applyOwnershipScope('salesExecutive'), getOrdersSummary);
router.get('/:id/export-excel', protect, exportSingleOrderExcel);
router.post('/', protect, createOrder);
router.patch('/:id', protect, updateOrder);
router.patch('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteOrder);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'orders'; next(); }, restoreRecord);

module.exports = router;
