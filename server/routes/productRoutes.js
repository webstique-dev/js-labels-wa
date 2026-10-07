const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addJobTime,
  updateJobTime,
  deleteJobTime,
  exportProductExcel
} = require('../controllers/productController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// List and detail routes - accessible to all authenticated users with view access
router.get('/', protect, getProducts);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'products'; next(); }, getTrash);
router.get('/:id/export-excel', protect, exportProductExcel);
router.get('/:id', protect, getProductById);

// Job Time Management routes
router.post('/:id/job-times', protect, addJobTime);
router.patch('/:id/job-times/:timeId', protect, updateJobTime);
router.delete('/:id/job-times/:timeId', protect, deleteJobTime);

// Admin-only mutation routes
router.post('/', protect, allowRoles('super_admin'), createProduct);
router.patch('/:id', protect, allowRoles('super_admin'), updateProduct);
router.delete('/:id', protect, allowRoles('super_admin'), deleteProduct);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'products'; next(); }, restoreRecord);

module.exports = router;
