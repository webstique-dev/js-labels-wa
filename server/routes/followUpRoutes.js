const express = require('express');
const router = express.Router();
const {
  getFollowUps,
  getFollowUpById,
  getFollowUpSummary,
  createFollowUp,
  logFollowUpInteraction,
  updateFollowUpStatus,
  deleteFollowUp
} = require('../controllers/followUpController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('assignedTo'), getFollowUps);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'followups'; next(); }, getTrash);
router.get('/summary', protect, applyOwnershipScope('assignedTo'), getFollowUpSummary);
router.get('/:id', protect, getFollowUpById);
router.post('/', protect, createFollowUp);
router.post('/:id/log', protect, logFollowUpInteraction);
router.patch('/:id', protect, updateFollowUpStatus);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteFollowUp);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'followups'; next(); }, restoreRecord);

module.exports = router;
