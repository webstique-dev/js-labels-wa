const express = require('express');
const router = express.Router();
const { getEscalations, reassignEscalatedLead } = require('../controllers/escalationController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/', protect, allowRoles('super_admin', 'manager'), getEscalations);
router.post('/:id/reassign', protect, allowRoles('super_admin'), reassignEscalatedLead);

module.exports = router;
