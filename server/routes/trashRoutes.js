const express = require('express');
const router = express.Router({ mergeParams: true });
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// Super Admin Only Protection for System Trash
router.use(protect);
router.use(allowRoles('super_admin'));

// GET /api/trash/:resource (e.g. /api/trash/orders, /api/trash/leads, /api/trash/customers, /api/trash/products, /api/trash/users, /api/trash/followups)
router.get('/:resource', getTrash);

// POST /api/trash/:resource/:id/restore
router.post('/:resource/:id/restore', restoreRecord);

// Additional fallback aliases to support all legacy or nested patterns
router.get('/:resource/trash', getTrash);
router.get('/trash/:resource', getTrash);
router.post('/:resource/restore/:id', restoreRecord);
router.post('/trash/:resource/:id/restore', restoreRecord);

module.exports = router;
