const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(protect);
router.use(allowRoles('super_admin'));

router.get('/', getSettings);
router.patch('/', updateSettings);

module.exports = router;
