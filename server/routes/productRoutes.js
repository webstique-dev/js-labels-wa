const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for Excel uploads in memory
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
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addJobTime,
  updateJobTime,
  deleteJobTime,
  exportProductExcel,
  exportAllProductsExcel,
  importProductsExcel
} = require('../controllers/productController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// List, Export-All, and Trash routes (must be defined BEFORE :id)
router.get('/', protect, getProducts);
router.get('/export-all', protect, exportAllProductsExcel);
router.post('/import-excel', protect, allowRoles('super_admin'), upload.single('file'), importProductsExcel);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'products'; next(); }, getTrash);

// Single Product Export & Details
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
