const express = require('express');
const router = express.Router();
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  reassignLead,
  addLeadActivity,
  deleteLead,
  rescheduleFollowUp,
  addFollowUpNote,
  updateFollowUpNote,
  deleteFollowUpNote
} = require('../controllers/leadController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { applyOwnershipScope } = require('../middleware/scope');

router.get('/', protect, applyOwnershipScope('assignedTo'), getLeads);
router.get('/trash', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'leads'; next(); }, getTrash);
router.get('/:id', protect, getLeadById);
router.post('/', protect, allowRoles('super_admin', 'manager', 'caller'), createLead);
router.put('/:id', protect, allowRoles('super_admin', 'manager', 'caller'), updateLead);
router.patch('/:id', protect, allowRoles('super_admin', 'manager', 'caller'), updateLead);
router.patch('/:id/status', protect, updateLeadStatus);
router.patch('/:id/reschedule-followup', protect, rescheduleFollowUp);
router.post('/:id/followup-notes', protect, addFollowUpNote);
router.patch('/:id/followup-notes/:noteId', protect, updateFollowUpNote);
router.delete('/:id/followup-notes/:noteId', protect, deleteFollowUpNote);
router.patch('/:id/assign', protect, allowRoles('super_admin', 'manager'), reassignLead);
router.post('/:id/activity', protect, addLeadActivity);
router.delete('/:id', protect, allowRoles('super_admin', 'manager'), deleteLead);
router.post('/:id/restore', protect, allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'leads'; next(); }, restoreRecord);

module.exports = router;
