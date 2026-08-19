const express = require('express');
const router = express.Router();
const { getProducts, deleteProduct } = require('../controllers/productController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/', protect, getProducts);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'products'; next(); }, getTrash);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteProduct);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'products'; next(); }, restoreRecord);

module.exports = router;
