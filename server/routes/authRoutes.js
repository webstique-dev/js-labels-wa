const express = require('express');
const router = express.Router();
const { login, me, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, me);
router.post('/logout', logout);

module.exports = router;
