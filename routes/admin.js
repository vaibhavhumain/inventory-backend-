const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAdminDashboard } = require('../controllers/adminController');
const { getAllUsers } = require('../controllers/authController');
const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getAdminDashboard);
router.get('/users', protect , authorize('admin'), getAllUsers);
module.exports = router;
