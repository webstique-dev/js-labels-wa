const express = require('express');
const router = express.Router({ mergeParams: true });
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(protect);
router.use(allowRoles('super_admin'));

router.get('/:resource/trash', getTrash);
router.post('/:resource/:id/restore', restoreRecord);

// Also support /api/trash/:resource and /api/trash/:resource/:id/restore
router.get('/trash/:resource', getTrash);
router.post('/trash/:resource/:id/restore', restoreRecord);

module.exports = router;
