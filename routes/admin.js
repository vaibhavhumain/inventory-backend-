const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getAdminDashboard } = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getAdminDashboard);

module.exports = router;
