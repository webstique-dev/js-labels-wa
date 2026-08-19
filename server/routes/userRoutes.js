const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  reassignAndDeactivateUser,
  deleteUser
} = require('../controllers/userController');
const { getTrash, restoreRecord } = require('../controllers/trashController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// All user routes require authentication
router.use(protect);

// GET /api/users: Accessible to authenticated users (used for executive selectors and filters)
router.get('/', getUsers);
router.get('/trash', allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'users'; next(); }, getTrash);

// Modification & Administration Endpoints: Super Admin Only
router.post('/', allowRoles('super_admin'), createUser);
router.patch('/:id', allowRoles('super_admin'), updateUser);
router.patch('/:id/deactivate', allowRoles('super_admin'), deactivateUser);
router.post('/:id/reassign-and-deactivate', allowRoles('super_admin'), reassignAndDeactivateUser);
router.delete('/:id', allowRoles('super_admin'), deleteUser);
router.post('/:id/restore', allowRoles('super_admin'), (req, res, next) => { req.params.resource = 'users'; next(); }, restoreRecord);

module.exports = router;
